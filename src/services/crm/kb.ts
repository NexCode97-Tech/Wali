import http from 'http'
import https from 'https'
import dns from 'dns'
import net from 'net'
import zlib from 'zlib'
import type { Readable } from 'stream'
import * as XLSX from 'xlsx'
import mammoth from 'mammoth'
import { ValidationError, AppError } from '../../utils/errors'

/**
 * Base de conocimiento de los agentes del CRM: leer un sitio web desde el
 * servidor y sacar el texto de un documento subido (PDF, TXT o CSV). Lo que
 * sale se guarda en el ajuste `kb` desde la pantalla. docs/crm/api-core.md.
 */

export const MAX_TEXTO_WEB = 100_000
export const MAX_TEXTO_DOC = 200_000
const MAX_BYTES_WEB = 2 * 1024 * 1024
const TIEMPO_WEB = 15_000
const MAX_REDIRECCIONES = 5

// ─── Direcciones prohibidas (nada de la red interna del servidor) ───────────
//
// Se compara la IP en bytes, no el texto: `new URL()` escribe
// 'http://[::ffff:127.0.0.1]/' como '[::ffff:7f00:1]', y un filtro de texto
// dejaba pasar esa forma. Las IPv6 que llevan una IPv4 adentro (::ffff:, NAT64,
// 6to4) se desenvuelven y la IPv4 se revisa con la lista de IPv4.

const PROHIBIDAS_V4 = new net.BlockList()
for (const [red, bits] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3],
] as const) PROHIBIDAS_V4.addSubnet(red, bits, 'ipv4')

const PROHIBIDAS_V6 = new net.BlockList()
for (const [red, bits] of [
  ['::', 96],            // ::, ::1 y las viejas «IPv4 compatibles»
  ['::ffff:0:0:0', 96],  // IPv4 traducidas (SIIT)
  ['64:ff9b:1::', 48],   // NAT64 de uso local
  ['100::', 64],         // descarte
  ['2001::', 32],        // Teredo (lleva una IPv4 escondida)
  ['2001:db8::', 32],    // documentación
  ['fc00::', 7],         // redes privadas (ULA)
  ['fe80::', 10],        // enlace local
  ['fec0::', 10],        // sitio local (obsoleta)
  ['ff00::', 8],         // multidifusión
] as const) PROHIBIDAS_V6.addSubnet(red, bits, 'ipv6')

/** Una IPv6 escrita de cualquier forma (con '::', con IPv4 al final, con zona %eth0) → sus 16 bytes. */
function bytesV6(ip: string): number[] | null {
  let x = ip.replace(/^\[|\]$/g, '').split('%')[0].toLowerCase()
  const cola = x.match(/(\d+\.\d+\.\d+\.\d+)$/)
  if (cola) {
    if (!net.isIPv4(cola[1])) return null
    const [a, b, c, d] = cola[1].split('.').map(Number)
    x = x.slice(0, -cola[1].length) + ((a << 8) | b).toString(16) + ':' + ((c << 8) | d).toString(16)
  }
  const partes = x.split('::')
  if (partes.length > 2) return null
  const grupos = (t: string) => (t ? t.split(':') : [])
  const izq = grupos(partes[0])
  const der = partes.length === 2 ? grupos(partes[1]) : []
  const faltan = 8 - izq.length - der.length
  if (partes.length === 2 ? faltan < 1 : faltan !== 0) return null
  const todos = [...izq, ...Array(partes.length === 2 ? faltan : 0).fill('0'), ...der]
  const out: number[] = []
  for (const g of todos) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null
    const n = parseInt(g, 16)
    out.push(n >> 8, n & 0xff)
  }
  return out
}

const v4De = (b: number[], desde: number) => b.slice(desde, desde + 4).join('.')

export function ipPrivada(ip: string): boolean {
  const limpia = ip.replace(/^\[|\]$/g, '').split('%')[0]
  if (net.isIPv4(limpia)) return PROHIBIDAS_V4.check(limpia, 'ipv4')
  if (!net.isIPv6(limpia)) return true // lo que no es una IP válida no se deja pasar
  const b = bytesV6(limpia)
  if (!b) return true
  const ceros = (hasta: number) => b.slice(0, hasta).every(n => n === 0)
  // ::ffff:a.b.c.d (IPv4 mapeada, también la que da un socket de doble pila)
  if (ceros(10) && b[10] === 0xff && b[11] === 0xff) return PROHIBIDAS_V4.check(v4De(b, 12), 'ipv4')
  // 64:ff9b::a.b.c.d (NAT64 general): sale a la IPv4 de adentro
  if (b[0] === 0x00 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b && b.slice(4, 12).every(n => n === 0)) return PROHIBIDAS_V4.check(v4De(b, 12), 'ipv4')
  // 2002:aabb:ccdd::/48 (6to4): la IPv4 va en los bytes 2 a 5
  if (b[0] === 0x20 && b[1] === 0x02) return PROHIBIDAS_V4.check(v4De(b, 2), 'ipv4')
  const canonica = Array.from({ length: 8 }, (_, i) => ((b[2 * i] << 8) | b[2 * i + 1]).toString(16)).join(':')
  return PROHIBIDAS_V6.check(canonica, 'ipv6')
}

const RED_INTERNA = 'Esa dirección apunta a una red interna. Solo se pueden leer sitios públicos de internet.'

/** `lookup` que rechaza IP privadas: se valida la IP con la que de verdad se conecta (evita el truco del DNS que cambia). */
const lookupSeguro: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, direcciones) => {
    if (err) return (callback as (e: Error | null, a: string, f: number) => void)(err, '', 0)
    const lista = (Array.isArray(direcciones) ? direcciones : [direcciones]) as dns.LookupAddress[]
    const mala = lista.find(d => ipPrivada(d.address))
    if (!lista.length || mala) {
      return (callback as (e: Error | null, a: string, f: number) => void)(new ValidationError(RED_INTERNA), '', 0)
    }
    if ((options as dns.LookupOptions).all) return (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, lista)
    return (callback as (e: null, a: string, f: number) => void)(null, lista[0].address, lista[0].family)
  })
}

export function validarUrl(crudo: string): URL {
  let u: URL
  try { u = new URL(/^https?:\/\//i.test(crudo.trim()) ? crudo.trim() : `https://${crudo.trim()}`) } catch {
    throw new ValidationError('Esa dirección no es válida. Escríbela completa, por ejemplo https://www.tuempresa.com')
  }
  if (!['http:', 'https:'].includes(u.protocol)) throw new ValidationError('Solo se pueden leer direcciones http o https.')
  if (u.username || u.password) throw new ValidationError('La dirección no puede llevar usuario ni contraseña.')
  const host = u.hostname.replace(/^\[|\]$/g, '')
  if (net.isIP(host) && ipPrivada(host)) throw new ValidationError(RED_INTERNA)
  if (/^(localhost|.*\.localhost|.*\.local|.*\.internal)\.?$/i.test(host)) throw new ValidationError(RED_INTERNA)
  if (u.port && !['80', '443', '8080', '8443'].includes(u.port)) throw new ValidationError('Solo se pueden leer sitios en los puertos normales de la web (80 y 443).')
  return u
}

interface Respuesta { status: number; tipo: string; cuerpo: Buffer; ubicacion?: string }

function pedir(u: URL, fin: number): Promise<Respuesta> {
  return new Promise((resolve, reject) => {
    const mod = u.protocol === 'https:' ? https : http
    const restante = fin - Date.now()
    if (restante <= 0) return reject(new AppError('El sitio tardó más de 15 segundos en responder. Intenta de nuevo o sube la información como documento.', 504))
    const req = mod.request(u, {
      method: 'GET',
      // Conexión nueva cada vez (sin reusar sockets de otra petición) y con la IP validada al resolver.
      agent: false,
      lookup: lookupSeguro,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; CRM-BaseDeConocimiento/1.0)', accept: 'text/html,text/plain;q=0.9,*/*;q=0.5', 'accept-encoding': 'gzip, deflate, br', 'accept-language': 'es-CO,es;q=0.9' },
      timeout: restante,
    }, res => {
      const status = res.statusCode ?? 0
      const tipo = String(res.headers['content-type'] ?? '')
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume()
        return resolve({ status, tipo, cuerpo: Buffer.alloc(0), ubicacion: String(res.headers.location) })
      }
      const enc = String(res.headers['content-encoding'] ?? '').toLowerCase()
      let flujo: Readable = res
      if (enc.includes('gzip')) flujo = res.pipe(zlib.createGunzip())
      else if (enc.includes('br')) flujo = res.pipe(zlib.createBrotliDecompress())
      else if (enc.includes('deflate')) flujo = res.pipe(zlib.createInflate())
      const partes: Buffer[] = []
      let total = 0
      flujo.on('data', (c: Buffer) => {
        total += c.length
        if (total > MAX_BYTES_WEB) {
          req.destroy()
          reject(new ValidationError('La página pesa más de 2 MB. Copia el texto importante en un fragmento o súbelo como documento.'))
          return
        }
        partes.push(c)
      })
      flujo.on('end', () => resolve({ status, tipo, cuerpo: Buffer.concat(partes) }))
      flujo.on('error', e => reject(e))
    })
    // Segunda red: la IP con la que de verdad quedó conectado el socket. Cubre las
    // IP escritas tal cual en la dirección, con las que Node no llama a `lookup`.
    // Se revisa al conectar, antes de que salga la petición.
    req.on('socket', s => {
      const revisar = () => { if (ipPrivada(s.remoteAddress ?? '')) req.destroy(new ValidationError(RED_INTERNA)) }
      if (s.connecting) s.once('connect', revisar)
      else revisar()
    })
    req.on('timeout', () => { req.destroy(new AppError('El sitio tardó más de 15 segundos en responder. Intenta de nuevo o sube la información como documento.', 504)) })
    req.on('error', e => reject(e))
    req.end()
  })
}

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', uuml: 'ü', iexcl: '¡', iquest: '¿', laquo: '«', raquo: '»', middot: '·', hellip: '…', ndash: '–', mdash: '—', copy: '©', reg: '®', deg: '°' }
function decodificar(t: string): string {
  return t.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ''
    }
    return ENTIDADES[e] ?? m
  })
}

/** De HTML a texto legible: sin scripts ni estilos, con saltos de línea en los bloques. */
export function htmlATexto(html: string): { titulo: string; texto: string } {
  const titulo = decodificar((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/\s+/g, ' ').trim())
  let t = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(p|div|section|article|header|footer|li|ul|ol|h[1-6]|tr|table|blockquote|main|nav|aside)\b[^>]*>/gi, '\n')
    .replace(/<\/?(td|th)\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
  t = decodificar(t).replace(/[ \t\f\v ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return { titulo, texto: t }
}

function charsetDe(tipo: string, cuerpo: Buffer): string {
  const deTipo = tipo.match(/charset=([^;]+)/i)?.[1]?.trim().replace(/["']/g, '')
  if (deTipo) return deTipo.toLowerCase()
  const meta = cuerpo.subarray(0, 4096).toString('latin1').match(/<meta[^>]+charset=["']?([a-z0-9_-]+)/i)?.[1]
  return (meta ?? 'utf-8').toLowerCase()
}

/** Lee una página pública y devuelve su título y su texto (máximo 100.000 caracteres). */
export async function leerWeb(crudo: string): Promise<{ titulo: string; texto: string; pag: number; url: string; recortado: boolean }> {
  let u = validarUrl(crudo)
  const fin = Date.now() + TIEMPO_WEB
  let r: Respuesta | null = null
  for (let i = 0; i <= MAX_REDIRECCIONES; i++) {
    try {
      r = await pedir(u, fin)
    } catch (e) {
      if (e instanceof AppError) throw e
      const code = (e as NodeJS.ErrnoException)?.code
      if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') throw new ValidationError(`No encontré el sitio ${u.hostname}. Revisa que la dirección esté bien escrita.`)
      throw new AppError(`No se pudo leer ${u.hostname}: ${(e as Error)?.message ?? 'error de conexión'}. Intenta de nuevo en un rato o sube la información como documento.`, 502)
    }
    if (!r.ubicacion) break
    if (i === MAX_REDIRECCIONES) throw new ValidationError('El sitio redirige demasiadas veces. Escribe la dirección final de la página.')
    u = validarUrl(new URL(r.ubicacion, u).toString())
  }
  if (!r) throw new AppError('No se pudo leer el sitio.', 502)
  if (r.status >= 400) throw new ValidationError(`El sitio respondió con error ${r.status}. Revisa que la página exista y sea pública.`)
  const tipo = r.tipo.toLowerCase()
  if (tipo && !/text\/html|text\/plain|application\/xhtml|text\/markdown/.test(tipo)) {
    throw new ValidationError(`Esa dirección no es una página web (es ${tipo.split(';')[0]}). Si es un PDF, descárgalo y súbelo como documento.`)
  }
  let crudoTexto: string
  try { crudoTexto = new TextDecoder(charsetDe(tipo, r.cuerpo)).decode(r.cuerpo) } catch { crudoTexto = r.cuerpo.toString('utf8') }
  const { titulo, texto } = /html|xhtml/.test(tipo) || /<html|<body|<div/i.test(crudoTexto.slice(0, 2000)) ? htmlATexto(crudoTexto) : { titulo: '', texto: crudoTexto.trim() }
  if (!texto) throw new ValidationError('La página no tiene texto legible (puede que se arme solo con JavaScript). Copia el texto en un fragmento.')
  return { titulo: titulo || u.hostname, texto: texto.slice(0, MAX_TEXTO_WEB), pag: 1, url: u.toString(), recortado: texto.length > MAX_TEXTO_WEB }
}

// ─── Documentos ──────────────────────────────────────────────────────────────
//
// El agente entiende mejor un documento cuando cada fila de una tabla queda junta («Plan Pro | $3.000.000 | Tienda»)
// y los datos van como «Campo: valor». El texto plano de pdf2json salía desordenado y perdía filas: el PDF se arma
// de nuevo con la posición de cada texto. Word y Excel convierten sus tablas a «Campo: valor».

interface TextoPdf { x: number; y: number; w?: number; R?: { T?: string }[] }
interface PaginaPdf { Texts?: TextoPdf[] }

/** Unidades de pdf2json: `x`/`y` en 1/16 de pulgada aprox., `w` en 1/16 de eso. Más de 1 unidad de hueco = otra columna. */
const HUECO_COLUMNA = 1
const MISMA_LINEA = 0.35

const decodificarPdf = (s: string) => { if (!s.includes('%')) return s; try { return decodeURIComponent(s) } catch { return s } }

/** Las líneas de una página, de arriba abajo; las columnas de una misma línea separadas con « | ». */
export function lineasDePagina(textos: TextoPdf[]): string[] {
  const items = textos
    .map(t => ({ x: t.x, y: t.y, fin: t.x + (t.w ?? 0) / 16, s: decodificarPdf((t.R ?? []).map(r => r.T ?? '').join('')) }))
    .filter(t => t.s.trim())
    .sort((a, b) => a.y - b.y || a.x - b.x)
  const lineas: { y: number; items: typeof items }[] = []
  for (const it of items) {
    const l = lineas.find(x => Math.abs(x.y - it.y) <= MISMA_LINEA)
    if (l) l.items.push(it); else lineas.push({ y: it.y, items: [it] })
  }
  return lineas.sort((a, b) => a.y - b.y).map(l => {
    const fila = l.items.sort((a, b) => a.x - b.x)
    let out = ''
    fila.forEach((it, k) => {
      if (k > 0) out += it.x - fila[k - 1].fin > HUECO_COLUMNA ? ' | ' : /\s$/.test(out) || /^\s/.test(it.s) ? '' : ' '
      out += it.s
    })
    return out.replace(/[ \t]+/g, ' ').trim()
  }).filter(Boolean)
}

/** Texto de un PDF con pdf2json, armado por posición. */
function textoDePdf(buffer: Buffer): Promise<{ texto: string; paginas: number }> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('pdf2json') as { default?: unknown; PDFParser?: unknown }
    const PDFParser = (mod.default ?? mod.PDFParser ?? mod) as new (ctx: null, needRawText: boolean) => {
      on(ev: 'pdfParser_dataReady', cb: (d: { Pages?: PaginaPdf[] }) => void): void
      on(ev: 'pdfParser_dataError', cb: (e: { parserError?: Error } | Error) => void): void
      parseBuffer(b: Buffer): void
    }
    const p = new PDFParser(null, true)
    const tope = setTimeout(() => reject(new ValidationError('El PDF tardó demasiado en leerse. Prueba con un archivo más liviano o pega el texto en un fragmento.')), 60_000)
    p.on('pdfParser_dataError', e => {
      clearTimeout(tope)
      const err = (e as { parserError?: Error }).parserError ?? (e as Error)
      reject(new ValidationError(`No se pudo leer el PDF (${err?.message ?? 'formato no reconocido'}). Si está protegido con clave o es una imagen escaneada, pega el texto en un fragmento.`))
    })
    p.on('pdfParser_dataReady', d => {
      clearTimeout(tope)
      const paginas = Array.isArray(d.Pages) ? d.Pages : []
      const texto = paginas.map(pg => lineasDePagina(Array.isArray(pg.Texts) ? pg.Texts : []).join('\n')).filter(Boolean).join('\n\n').trim()
      resolve({ texto, paginas: paginas.length })
    })
    p.parseBuffer(buffer)
  })
}

const limpio = (v: unknown) => String(v ?? '').replace(/\s+/g, ' ').trim()

/** Una tabla como texto: con encabezados, cada fila «Encabezado: valor · Encabezado: valor»; sin ellos, « | ». */
function tablaATexto(filas: string[][]): string[] {
  const llenas = filas.map(f => f.map(limpio)).filter(f => f.some(Boolean))
  if (!llenas.length) return []
  const [cab, ...resto] = llenas
  // Hay encabezados si la primera fila es texto corto y no repite celdas (no es una fila de datos).
  const conCab = resto.length > 0 && cab.filter(Boolean).length >= 2 && cab.every(c => c.length <= 40) && new Set(cab.filter(Boolean)).size === cab.filter(Boolean).length
  if (!conCab) return llenas.map(f => f.filter(Boolean).join(' | '))
  return resto.map(f => f.map((v, k) => (v ? (cab[k] ? `${cab[k]}: ${v}` : v) : '')).filter(Boolean).join(' · '))
}

/** Texto de un Excel (xlsx/xls): cada hoja con su nombre y sus filas como «Columna: valor». */
function textoDeExcel(buffer: Buffer): { texto: string; paginas: number } {
  const libro = XLSX.read(buffer, { type: 'buffer', cellDates: true })
  const partes = libro.SheetNames.map(n => {
    const filas = XLSX.utils.sheet_to_json<unknown[]>(libro.Sheets[n], { header: 1, raw: false, defval: '' }) as unknown[][]
    const lineas = tablaATexto(filas.map(f => f.map(limpio)))
    return lineas.length ? `## Hoja «${n}»\n${lineas.join('\n')}` : ''
  }).filter(Boolean)
  return { texto: partes.join('\n\n'), paginas: libro.SheetNames.length }
}

/** HTML de mammoth → texto: títulos y párrafos por línea, viñetas con «- » y tablas como «Campo: valor». */
function htmlDeWordATexto(html: string): string {
  const sinEtiquetas = (s: string) => s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  const tablas: string[] = []
  const conMarcas = html.replace(/<table[\s\S]*?<\/table>/gi, t => {
    const filas = [...t.matchAll(/<tr[\s\S]*?<\/tr>/gi)].map(tr => [...tr[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c => sinEtiquetas(c[1])))
    tablas.push(tablaATexto(filas).join('\n'))
    return `\n@@TABLA${tablas.length - 1}@@\n`
  })
  const texto = conMarcas
    .replace(/<li[^>]*>/gi, '\n- ').replace(/<\/(p|h[1-6]|li|ul|ol|div)>/gi, '\n').replace(/<h[1-6][^>]*>/gi, '\n')
  return sinEtiquetas(texto)
    .replace(/@@TABLA(\d+)@@/g, (_, k: string) => tablas[+k] ?? '')
    .split('\n').map(l => l.replace(/[ \t]+/g, ' ').trim()).filter(Boolean).join('\n')
}

async function textoDeWord(buffer: Buffer): Promise<{ texto: string; paginas: number }> {
  const { value } = await mammoth.convertToHtml({ buffer })
  return { texto: htmlDeWordATexto(value), paginas: 1 }
}

export const TIPOS_DOC = new Set([
  'application/pdf', 'text/plain', 'text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])
/** Las extensiones que se pueden leer (también lo que acepta la pantalla). */
export const EXT_DOC = /\.(pdf|txt|csv|md|docx|xlsx|xls)$/i
export const MENSAJE_TIPOS = 'Sube un PDF, un Word (.docx), un Excel (.xlsx), un TXT o un CSV.'

export async function extraerTexto(buffer: Buffer, mime: string, nombre: string): Promise<{ texto: string; paginas: number; recortado: boolean }> {
  const ext = (nombre.match(/\.([^.]+)$/)?.[1] ?? '').toLowerCase()
  let texto = ''
  let paginas = 0
  if (mime === 'application/pdf' || ext === 'pdf') {
    ({ texto, paginas } = await textoDePdf(buffer))
    if (!texto) throw new ValidationError('El PDF no tiene texto que se pueda leer (parece una imagen escaneada). Pega el texto en un fragmento.')
  } else if (ext === 'docx' || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    try { ({ texto, paginas } = await textoDeWord(buffer)) } catch { throw new ValidationError('No se pudo leer el Word. Guárdalo como .docx (no .doc) o pega el texto en un fragmento.') }
    if (!texto) throw new ValidationError('El Word no tiene texto que se pueda leer.')
  } else if (ext === 'xlsx' || ext === 'xls' || mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || (mime === 'application/vnd.ms-excel' && ext !== 'csv')) {
    try { ({ texto, paginas } = textoDeExcel(buffer)) } catch { throw new ValidationError('No se pudo leer el Excel. Revisa que no esté protegido con clave.') }
    if (!texto) throw new ValidationError('El Excel no tiene datos que se puedan leer.')
  } else if (['txt', 'csv', 'md'].includes(ext) || mime.startsWith('text/') || mime === 'application/csv') {
    texto = buffer.toString('utf8').replace(/^﻿/, '')
    // Archivos guardados en Excel viejo vienen en latin1: si el UTF-8 salió con errores, se lee así.
    if (texto.includes('�')) texto = buffer.toString('latin1')
    texto = texto.replace(/\r\n?/g, '\n').trim()
    paginas = 1
  } else {
    throw new ValidationError(`Ese tipo de archivo no se puede leer. ${MENSAJE_TIPOS}`)
  }
  return { texto: texto.slice(0, MAX_TEXTO_DOC), paginas, recortado: texto.length > MAX_TEXTO_DOC }
}
