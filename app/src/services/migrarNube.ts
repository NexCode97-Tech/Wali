import { v2 as cloudinary } from 'cloudinary'
import { prismaGlobal } from './crm/bd'
import { almacenListo, subir } from './almacen'
import { logger } from '../utils/logger'

/**
 * Migración de Cloudinary al banco multimedia de Railway (12-nov, aprobada por el usuario). Desde el 11-nov todo archivo
 * nuevo va al bucket; esto pasa los de antes: adjuntos y notas de voz del chat, fotos, logos, base de conocimiento,
 * términos, saludo del buzón, adjuntos de soporte y grabaciones de llamadas (`grab:`, privadas).
 *
 * Corre en procesos.ts (cada 10 minutos) hasta terminar: en cada vuelta, a lo sumo LOTE archivos. Recorre cada tabla
 * por su llave en orden (el avance queda en config_app, MIGRACION_NUBE), así retoma donde iba y no repite. Cada
 * dirección se baja de Cloudinary, se sube al bucket y se cambia en la fila (leída de nuevo justo antes de escribir).
 * Lo que ya se pasó queda en NUBE_MAPA (dirección vieja → nueva), así una misma dirección no se sube dos veces. Si un
 * archivo ya no existe en Cloudinary, la dirección vieja se deja y se anota en `fallas`.
 */

const LOTE = 150
const CLAVE_ESTADO = 'MIGRACION_NUBE'
const CLAVE_MAPA = 'NUBE_MAPA'

type Objetivo = { t: string; col: string; json: boolean; pk: string[] }
/** Las tablas y columnas que pueden tener archivos de Cloudinary (nombres fijos: nunca vienen de afuera). */
const OBJETIVOS: Objetivo[] = [
  { t: 'crm_mensajes', col: 'datos', json: true, pk: ['id'] },
  { t: 'crm_ajustes', col: 'valor', json: true, pk: ['espacio_id', 'clave'] },
  { t: 'crm_preferencias', col: 'valor', json: true, pk: ['espacio_id', 'user_id'] },
  { t: 'crm_lineas', col: 'ajustes', json: true, pk: ['id'] },
  { t: 'crm_solicitud_mensajes', col: 'archivos', json: true, pk: ['id'] },
  { t: 'crm_solicitudes', col: 'contexto', json: true, pk: ['id'] },
  { t: 'crm_solicitudes', col: 'adjunto', json: false, pk: ['id'] },
  { t: 'crm_contactos', col: 'ficha', json: true, pk: ['id'] },
  { t: 'crm_contactos', col: 'campos', json: true, pk: ['id'] },
  { t: 'crm_conversaciones', col: 'extra', json: true, pk: ['id'] },
  { t: 'crm_conversaciones', col: 'recs', json: true, pk: ['id'] },
  { t: 'crm_conexiones', col: 'datos', json: true, pk: ['id'] },
  { t: 'crm_espacios', col: 'logo', json: false, pk: ['id'] },
  { t: 'usuarios', col: 'image', json: false, pk: ['id'] },
]

interface Estado { i: number; cursor: string[] | null; hechos: number; fallas: string[]; terminado: boolean; inicio: string; fin?: string }

const NUBE = () => (process.env.CLOUDINARY_CLOUD_NAME ?? '').trim()
const esDeLaNube = (s: string) => !!NUBE() && s.startsWith(`https://res.cloudinary.com/${NUBE()}/`)
const REF_GRAB = /^grab:([\w/.-]{1,200}):([a-z0-9]{1,8})$/

async function leerConfig<T>(clave: string, defecto: T): Promise<T> {
  const f = await prismaGlobal.configApp.findUnique({ where: { clave } })
  if (!f) return defecto
  try { return JSON.parse(f.valor) as T } catch { return defecto }
}
const guardarConfig = (clave: string, v: unknown) => prismaGlobal.configApp.upsert({ where: { clave }, create: { clave, valor: JSON.stringify(v) }, update: { valor: JSON.stringify(v) } })

/** Baja un archivo (una dirección pública o una grabación privada) y lo sube al bucket. Devuelve la referencia nueva o null. */
async function pasar(vieja: string): Promise<string | null> {
  const g = vieja.match(REF_GRAB)
  let url = vieja
  if (g) {
    cloudinary.config({ cloud_name: NUBE(), api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET })
    url = cloudinary.utils.private_download_url(g[1], g[2], { resource_type: 'video', type: 'authenticated', expires_at: Math.floor(Date.now() / 1000) + 600 })
  }
  const r = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  if (!r.ok) return null
  const buffer = Buffer.from(await r.arrayBuffer())
  const mime = (r.headers.get('content-type') ?? 'application/octet-stream').split(';')[0].trim()
  const nombre = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'archivo').slice(0, 120) || 'archivo'
  if (g) {
    const { clave } = await subir(buffer, { carpeta: 'crm/grabaciones', nombre: `llamada.${g[2]}`, mime, privado: true })
    return `grabr:${clave}`
  }
  const { url: nueva } = await subir(buffer, { carpeta: 'crm/migrado', nombre, mime })
  return nueva
}

/** Las referencias a pasar dentro de un valor (texto o JSON). */
function referencias(v: unknown, out: Set<string>) {
  if (typeof v === 'string') { if (esDeLaNube(v) || REF_GRAB.test(v)) out.add(v); return }
  if (Array.isArray(v)) { for (const x of v) referencias(x, out); return }
  if (v && typeof v === 'object') for (const x of Object.values(v)) referencias(x, out)
}
function reemplazar(v: unknown, mapa: Record<string, string>): unknown {
  if (typeof v === 'string') return mapa[v] || v
  if (Array.isArray(v)) return v.map(x => reemplazar(x, mapa))
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, reemplazar(x, mapa)]))
  return v
}

/** Una vuelta de la migración. Devuelve cuántos archivos pasó. */
export async function migrarNube(): Promise<number> {
  if (!almacenListo() || !NUBE()) return 0
  const estado = await leerConfig<Estado>(CLAVE_ESTADO, { i: 0, cursor: null, hechos: 0, fallas: [], terminado: false, inicio: new Date().toISOString() })
  if (estado.terminado) return 0
  const mapa = await leerConfig<Record<string, string>>(CLAVE_MAPA, {})
  let pasados = 0
  while (estado.i < OBJETIVOS.length && pasados < LOTE) {
    const o = OBJETIVOS[estado.i]
    const pk = o.pk.map(c => `"${c}"`).join(', ')
    const filtro = o.json ? `("${o.col}"::text LIKE '%res.cloudinary.com%' OR "${o.col}"::text LIKE '%"grab:%')` : `("${o.col}" LIKE 'https://res.cloudinary.com/%')`
    // Keyset por la llave (como texto): avanza sin repetir aunque una fila quede con un archivo que ya no existe.
    const despues = estado.cursor ? `AND (${o.pk.map(c => `"${c}"::text`).join(', ')}) > (${estado.cursor.map((_, k) => `$${k + 1}`).join(', ')})` : ''
    const filas = await prismaGlobal.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT ${o.pk.map(c => `"${c}"::text AS "${c}"`).join(', ')}, "${o.col}"::text AS v FROM "${o.t}" WHERE ${filtro} ${despues} ORDER BY ${o.pk.map(c => `"${c}"::text`).join(', ')} LIMIT 20`,
      ...(estado.cursor ?? []),
    )
    if (!filas.length) { estado.i++; estado.cursor = null; continue }
    for (const f of filas) {
      const llave = o.pk.map(c => String(f[c]))
      const valor = o.json ? JSON.parse(String(f.v)) : String(f.v)
      const refs = new Set<string>(); referencias(valor, refs)
      for (const r of refs) {
        if (mapa[r] !== undefined) continue
        try { mapa[r] = (await pasar(r)) ?? '' } catch (e) { logger.warn(`[nube] no se pudo pasar un archivo de ${o.t}: ${(e as Error).message}`); mapa[r] = '' }
        if (mapa[r]) { pasados++; estado.hechos++ } else if (estado.fallas.length < 200) estado.fallas.push(`${o.t}.${o.col} ${llave.join('/')}: ${r.slice(0, 160)}`)
      }
      if ([...refs].some(r => mapa[r])) {
        // Se vuelve a leer la fila justo antes de escribir: si alguien la cambió mientras tanto, se reemplaza sobre lo nuevo.
        const donde = o.pk.map((c, k) => `"${c}"::text = $${k + 1}`).join(' AND ')
        const fresca = await prismaGlobal.$queryRawUnsafe<{ v: string | null }[]>(`SELECT "${o.col}"::text AS v FROM "${o.t}" WHERE ${donde}`, ...llave)
        if (fresca.length && fresca[0].v != null) {
          const nuevo = o.json ? JSON.stringify(reemplazar(JSON.parse(fresca[0].v), mapa)) : String(reemplazar(fresca[0].v, mapa))
          await prismaGlobal.$executeRawUnsafe(`UPDATE "${o.t}" SET "${o.col}" = $${llave.length + 1}${o.json ? '::jsonb' : ''} WHERE ${donde}`, ...llave, nuevo)
        }
      }
      estado.cursor = llave
      if (pasados >= LOTE) break
    }
    await guardarConfig(CLAVE_MAPA, mapa)
    await guardarConfig(CLAVE_ESTADO, estado)
  }
  if (estado.i >= OBJETIVOS.length) {
    estado.terminado = true; estado.fin = new Date().toISOString()
    logger.info(`[nube] migración terminada: ${estado.hechos} archivos pasados al bucket, ${estado.fallas.length} que ya no estaban en Cloudinary`)
  } else if (pasados) logger.info(`[nube] migración: ${pasados} archivos en esta vuelta (${estado.hechos} en total), va por ${OBJETIVOS[estado.i].t}.${OBJETIVOS[estado.i].col}`)
  await guardarConfig(CLAVE_MAPA, mapa)
  await guardarConfig(CLAVE_ESTADO, estado)
  return pasados
}
