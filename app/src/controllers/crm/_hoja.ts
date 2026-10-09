import { Worker } from 'worker_threads'
import { ValidationError } from '../../utils/errors'
import { logger } from '../../utils/logger'

/**
 * Lee la primera hoja de un Excel (.xlsx, .xls) o CSV que sube alguien de
 * Ventas, con todas las celdas como TEXTO: un celular guardado como número
 * (573001234567) sale entero, nunca «5.73001E+11».
 *
 * El archivo no es de confianza y la librería instalada (xlsx 0.18.5) tiene
 * fallas conocidas al leer archivos armados (CVE-2023-30533, contaminación de
 * Object.prototype; CVE-2024-22363, expresión regular lenta). Por eso:
 * - antes de abrirlo se miran los tamaños descomprimidos que declara el .xlsx
 *   (un zip de 1 MB puede crecer a varios GB en memoria);
 * - se lee en un hilo aparte (worker) con su propia memoria (tope de
 *   MEMORIA_MB), su propio Object.prototype y un tiempo máximo: si el archivo
 *   es malo, se cae el hilo y el API sigue;
 * - se leen como mucho `maxFilas + 2` filas (sheetRows) y solo la primera hoja.
 */

export const MAX_BYTES = 10 * 1024 * 1024
/** Suma de lo que declaran las partes del .xlsx ya descomprimidas. */
const MAX_DESCOMPRIMIDO = 120 * 1024 * 1024
const MAX_PARTES = 5_000
const MEMORIA_MB = 384
const TIEMPO_MS = 30_000
const A_LA_VEZ = 2

export type Fila = Record<string, string>

/**
 * Recorre el directorio central del zip (sin descomprimir nada) y devuelve la
 * suma de los tamaños descomprimidos que declara. null si no se pudo leer.
 */
export function tamanoDescomprimido(buf: Buffer): { total: number; partes: number } | null {
  // Fin del directorio central: firma 0x06054b50 en los últimos 22 a 65.557 bytes.
  const desde = Math.max(0, buf.length - 65_557)
  let fin = -1
  for (let i = buf.length - 22; i >= desde; i--) if (buf.readUInt32LE(i) === 0x06054b50) { fin = i; break }
  if (fin < 0) return null
  const partes = buf.readUInt16LE(fin + 10)
  const tamDir = buf.readUInt32LE(fin + 12)
  let p = buf.readUInt32LE(fin + 16)
  // Zip64 o números que no caben: se trata como demasiado grande.
  if (partes === 0xffff || tamDir === 0xffffffff || p === 0xffffffff) return { total: Number.POSITIVE_INFINITY, partes }
  if (p + tamDir > buf.length) return null
  let total = 0
  for (let n = 0; n < partes; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) return null
    const tam = buf.readUInt32LE(p + 24)
    if (tam === 0xffffffff) return { total: Number.POSITIVE_INFINITY, partes }
    total += tam
    p += 46 + buf.readUInt16LE(p + 28) + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32)
  }
  return { total, partes }
}

/** El código del hilo: JavaScript plano (corre igual con tsx en local y con node en producción). */
const CODIGO_HILO = `
const { parentPort, workerData } = require('worker_threads')
const XLSX = require(workerData.ruta)
const dos = n => String(n).padStart(2, '0')
function aTexto(v) {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'boolean') return v ? 'Sí' : 'No'
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return ''
    // Enteros (celulares, cédulas) con todas sus cifras, sin notación científica.
    if (Number.isInteger(v)) return BigInt(v).toString()
    const s = String(v)
    return /e/i.test(s) ? v.toFixed(20).replace(/\\.?0+$/, '') : s
  }
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return ''
    // cellDates entrega la fecha del Excel en hora local del hilo; se escribe tal cual la ve la persona.
    const f = v.getFullYear() + '-' + dos(v.getMonth() + 1) + '-' + dos(v.getDate())
    return v.getHours() || v.getMinutes() ? f + ' ' + dos(v.getHours()) + ':' + dos(v.getMinutes()) : f
  }
  return String(v)
}
try {
  const { datos, esCsv, maxFilas } = workerData
  const op = { sheetRows: maxFilas + 2, sheets: 0, cellFormula: false, cellHTML: false, cellStyles: false, cellNF: false, bookVBA: false }
  let libro
  if (esCsv) {
    const buf = Buffer.from(datos)
    let texto = buf.toString('utf8').replace(/^\\uFEFF/, '')
    if (texto.includes('\\uFFFD')) texto = buf.toString('latin1')
    // raw: los textos del CSV no se convierten a números (el celular queda como lo escribieron).
    libro = XLSX.read(texto, { ...op, type: 'string', raw: true })
  } else {
    libro = XLSX.read(Buffer.from(datos), { ...op, type: 'buffer', cellDates: true })
  }
  const nombreHoja = libro.SheetNames[0]
  const hoja = nombreHoja ? libro.Sheets[nombreHoja] : null
  if (!hoja) parentPort.postMessage({ ok: false, motivo: 'sin-hoja' })
  else {
    // raw: true entrega el valor de la celda (no el texto con formato, que recorta los números largos).
    const crudas = XLSX.utils.sheet_to_json(hoja, { defval: '', raw: true })
    const filas = crudas.map(f => { const o = {}; for (const k of Object.keys(f)) o[String(k)] = aTexto(f[k]); return o })
    parentPort.postMessage({ ok: true, filas })
  }
} catch (e) {
  parentPort.postMessage({ ok: false, motivo: 'ilegible', detalle: String(e && e.message || e).slice(0, 300) })
}
`

let enCurso = 0
const esperando: (() => void)[] = []
async function turno(): Promise<() => void> {
  if (enCurso >= A_LA_VEZ) await new Promise<void>(r => esperando.push(r))
  enCurso++
  return () => { enCurso--; esperando.shift()?.() }
}

const NO_SE_LEE = 'No se pudo leer el archivo. Súbelo como Excel (.xlsx) o CSV con los encabezados en la primera fila.'

/**
 * Las filas de la primera hoja como texto, con los encabezados de la fila 1
 * como claves. Lanza ValidationError con un texto que dice qué hacer.
 */
export async function leerHoja(buffer: Buffer, nombre: string, maxFilas: number): Promise<Fila[]> {
  if (buffer.length > MAX_BYTES) throw new ValidationError(`El archivo pesa más de ${MAX_BYTES / 1024 / 1024} MB. Divídelo en varios archivos.`)
  const esCsv = /\.(csv|txt)$/i.test(nombre)
  if (!esCsv && buffer.length >= 4 && buffer.readUInt32LE(0) === 0x04034b50) {
    const z = tamanoDescomprimido(buffer)
    if (!z) throw new ValidationError(NO_SE_LEE)
    if (z.total > MAX_DESCOMPRIMIDO || z.partes > MAX_PARTES) {
      throw new ValidationError(`El Excel es demasiado grande por dentro (más de ${Math.round(MAX_DESCOMPRIMIDO / 1024 / 1024)} MB sin comprimir). Copia solo las columnas y filas de los contactos a un libro nuevo, o guárdalo como CSV, y vuelve a subirlo.`)
    }
  }
  const soltar = await turno()
  try {
    return await new Promise<Fila[]>((resolve, reject) => {
      const w = new Worker(CODIGO_HILO, {
        eval: true,
        workerData: { ruta: require.resolve('xlsx'), datos: new Uint8Array(buffer), esCsv, maxFilas },
        resourceLimits: { maxOldGenerationSizeMb: MEMORIA_MB, maxYoungGenerationSizeMb: 48, stackSizeMb: 4 },
      })
      let listo = false
      const terminar = (fn: () => void) => { if (listo) return; listo = true; clearTimeout(reloj); fn(); void w.terminate() }
      const reloj = setTimeout(() => terminar(() => reject(new ValidationError('El archivo tardó demasiado en leerse. Guárdalo como CSV o divídelo en archivos más pequeños y vuelve a subirlo.'))), TIEMPO_MS)
      w.on('message', (r: { ok: boolean; filas?: Fila[]; motivo?: string; detalle?: string }) => terminar(() => {
        if (r.ok && Array.isArray(r.filas)) return resolve(r.filas)
        if (r.motivo === 'sin-hoja') return reject(new ValidationError('El archivo no tiene hojas. Revisa que sea el Excel correcto.'))
        logger.warn(`[CRM importar] no se pudo leer «${nombre}»: ${r.detalle ?? r.motivo}`)
        reject(new ValidationError(NO_SE_LEE))
      }))
      w.on('error', (e: Error & { code?: string }) => terminar(() => {
        logger.warn(`[CRM importar] el hilo de lectura de «${nombre}» se cayó: ${e.code ?? ''} ${e.message}`)
        reject(new ValidationError(e.code === 'ERR_WORKER_OUT_OF_MEMORY'
          ? 'El archivo necesita demasiada memoria para leerse. Copia solo las columnas y filas de los contactos a un libro nuevo, o guárdalo como CSV, y vuelve a subirlo.'
          : NO_SE_LEE))
      }))
      w.on('exit', code => terminar(() => reject(new ValidationError(code ? NO_SE_LEE : 'El archivo no devolvió filas. Revisa que la primera hoja tenga los contactos.'))))
    })
  } finally {
    soltar()
  }
}
