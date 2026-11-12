import { createHmac, timingSafeEqual } from 'node:crypto'
import { spawn } from 'node:child_process'
import { Readable } from 'node:stream'
import type { Request, Response } from 'express'
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import ffmpegRuta from 'ffmpeg-static'
import { logger } from '../utils/logger'

/**
 * El banco multimedia de Wali (11-nov): todo archivo vive en el bucket de Railway (S3 compatible, privado), no en
 * Cloudinary. Un solo módulo para subir, servir, convertir y borrar.
 *
 * - Cada archivo tiene una clave `<carpeta>/<nombre>-<sello>.<ext>`.
 * - Los archivos del chat y del equipo se sirven desde Wali: `${CRM_URL}/m/<clave>?f=<firma>`. La firma (HMAC con
 *   AUTH_SECRET) hace la dirección imposible de adivinar, como las de Cloudinary, y la dirección no vence: sirve en el
 *   chat, en los correos y para mandarla a Meta. Se sirve con su tipo, con soporte de Range (audio y video) y caché.
 * - Lo que no es imagen, audio, video ni PDF se sirve como descarga y con una CSP que no deja correr nada: un HTML o un
 *   SVG subido nunca se ejecuta en walicrm.com.
 * - Lo privado (grabaciones de llamadas) no tiene dirección pública: se lee con un enlace firmado del bucket que vence.
 * - Audios: `&v=ogg` (Opus, nota de voz de WhatsApp), `&v=mp3` o `&v=m4a`. La primera vez se convierte con ffmpeg y la
 *   versión queda guardada en el bucket.
 */

const env = (k: string) => (process.env[k] ?? '').trim()
export const almacenListo = () => !!(env('S3_ENDPOINT') && env('S3_BUCKET') && env('S3_ACCESS_KEY_ID') && env('S3_SECRET_ACCESS_KEY'))

let cliente: S3Client | null = null
function s3(): S3Client {
  if (!almacenListo()) throw new Error('El almacenamiento de archivos no está configurado (faltan las variables S3_).')
  if (!cliente) {
    cliente = new S3Client({
      endpoint: env('S3_ENDPOINT'), region: env('S3_REGION') || 'auto', forcePathStyle: env('S3_URL_STYLE') === 'path',
      credentials: { accessKeyId: env('S3_ACCESS_KEY_ID'), secretAccessKey: env('S3_SECRET_ACCESS_KEY') },
    })
  }
  return cliente
}
const bucket = () => env('S3_BUCKET')

const CLAVE = /^[a-z0-9][a-z0-9/._-]{2,300}$/
const FORMATOS = { ogg: 'audio/ogg', mp3: 'audio/mpeg', m4a: 'audio/mp4' } as const
type Formato = keyof typeof FORMATOS

const base = () => (env('CRM_URL') || 'https://walicrm.com/crm').replace(/\/+$/, '')
const firmaDe = (clave: string) => createHmac('sha256', env('AUTH_SECRET') || env('CRM_CLAVE_CIFRADO')).update('media:' + clave).digest('base64url').slice(0, 32)

/** La dirección pública (con firma) de un archivo. */
export const urlDe = (clave: string) => `${base()}/m/${clave}?f=${firmaDe(clave)}`

/** La clave si la dirección es un archivo de Wali con su firma correcta; si no, null. */
export function claveDeUrl(url: string): string | null {
  try {
    const u = new URL(url), b = new URL(base())
    if (u.host !== b.host || !u.pathname.startsWith(b.pathname.replace(/\/$/, '') + '/m/')) return null
    const clave = decodeURIComponent(u.pathname.slice(b.pathname.replace(/\/$/, '').length + 3))
    const f = u.searchParams.get('f') ?? ''
    if (!CLAVE.test(clave) || clave.includes('..')) return null
    const a = Buffer.from(f), e = Buffer.from(firmaDe(clave))
    return a.length === e.length && timingSafeEqual(a, e) ? clave : null
  } catch { return null }
}
export const esUrlDeWali = (url: string) => claveDeUrl(url) !== null

/** La misma dirección pidiendo el audio en otro formato (nota de voz de WhatsApp, mp3, m4a). null si no es de Wali. */
export function urlEnFormato(url: string, formato: Formato): string | null {
  const clave = claveDeUrl(url)
  return clave ? `${urlDe(clave)}&v=${formato}` : null
}

function nombreSeguro(nombre: string): { base: string; ext: string } {
  const ext = (nombre.match(/\.([^.]+)$/)?.[1] ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
  const b = nombre.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 50) || 'archivo'
  return { base: b, ext }
}
const EXT_DE: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/webm': 'webm', 'video/mp4': 'mp4', 'video/webm': 'webm', 'application/pdf': 'pdf' }

/** Sube un archivo y devuelve su clave y su dirección. `privado`: sin dirección pública (grabaciones). */
export async function subir(buffer: Buffer, o: { carpeta: string; nombre: string; mime: string; privado?: boolean }): Promise<{ clave: string; url: string }> {
  const { base: b, ext } = nombreSeguro(o.nombre)
  const sello = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const carpeta = o.carpeta.toLowerCase().replace(/[^a-z0-9/_-]+/g, '-').replace(/^\/+|\/+$/g, '') || 'crm'
  const e = ext || EXT_DE[o.mime] || ''
  const clave = `${o.privado ? 'privado/' : ''}${carpeta}/${b}-${sello}${e ? '.' + e : ''}`
  await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: clave, Body: buffer, ContentType: o.mime || 'application/octet-stream', CacheControl: 'private, max-age=31536000, immutable' }))
  return { clave, url: o.privado ? '' : urlDe(clave) }
}

export async function leer(clave: string): Promise<Buffer> {
  const r = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: clave }))
  return Buffer.from(await r.Body!.transformToByteArray())
}

export async function borrar(clave: string): Promise<void> {
  await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: clave }))
  for (const f of Object.keys(FORMATOS)) await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: `${clave}.v.${f}` })).catch(() => {})
}

/** Enlace firmado del bucket que vence (lo privado: grabaciones). */
export async function enlaceTemporal(clave: string, segundos: number, descargar = false): Promise<string> {
  const nombre = clave.split('/').pop() ?? 'archivo'
  return getSignedUrl(s3(), new GetObjectCommand({ Bucket: bucket(), Key: clave, ...(descargar ? { ResponseContentDisposition: `attachment; filename="${nombre}"` } : {}) }), { expiresIn: segundos })
}

// ─── Audio en otro formato (ffmpeg) ──────────────────────────────────────────

const ARGS: Record<Formato, string[]> = {
  ogg: ['-c:a', 'libopus', '-b:a', '32k', '-ac', '1', '-ar', '48000', '-f', 'ogg'],
  mp3: ['-c:a', 'libmp3lame', '-b:a', '96k', '-f', 'mp3'],
  m4a: ['-c:a', 'aac', '-b:a', '96k', '-movflags', 'frag_keyframe+empty_moov', '-f', 'mp4'],
}
export function convertirAudio(entrada: Buffer, formato: Formato): Promise<Buffer> {
  return new Promise((ok, mal) => {
    if (!ffmpegRuta) { mal(new Error('ffmpeg no está disponible')); return }
    const p = spawn(ffmpegRuta as unknown as string, ['-hide_banner', '-loglevel', 'error', '-i', 'pipe:0', '-vn', ...ARGS[formato], 'pipe:1'], { stdio: ['pipe', 'pipe', 'pipe'] })
    const partes: Buffer[] = [], err: Buffer[] = []
    const reloj = setTimeout(() => { p.kill('SIGKILL'); mal(new Error('La conversión del audio tardó demasiado')) }, 60_000)
    p.stdout.on('data', d => partes.push(d)); p.stderr.on('data', d => err.push(d))
    p.on('error', e => { clearTimeout(reloj); mal(e) })
    p.on('close', c => { clearTimeout(reloj); if (c === 0 && partes.length) ok(Buffer.concat(partes)); else mal(new Error('No se pudo convertir el audio: ' + Buffer.concat(err).toString('utf8').slice(0, 200))) })
    p.stdin.on('error', () => { /* ffmpeg cerró la entrada: el error sale en close */ })
    p.stdin.end(entrada)
  })
}

const enCurso = new Map<string, Promise<void>>()
/** Se asegura de que exista la versión del audio en ese formato y devuelve su clave. */
async function variante(clave: string, formato: Formato): Promise<string> {
  const destino = `${clave}.v.${formato}`
  try { await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: destino })); return destino } catch { /* no existe todavía */ }
  let p = enCurso.get(destino)
  if (!p) {
    p = (async () => {
      const salida = await convertirAudio(await leer(clave), formato)
      await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: destino, Body: salida, ContentType: FORMATOS[formato], CacheControl: 'private, max-age=31536000, immutable' }))
    })().finally(() => enCurso.delete(destino))
    enCurso.set(destino, p)
  }
  await p
  return destino
}

// ─── Servir: GET /m/<clave>?f=<firma>[&v=ogg|mp3|m4a] ────────────────────────

const EN_LINEA = /^(image\/(jpeg|png|gif|webp|avif)|audio\/|video\/|application\/pdf$)/

export async function servirArchivo(req: Request, res: Response) {
  const clave = decodeURIComponent(req.path.replace(/^\/+/, ''))
  const f = String(req.query.f ?? '')
  const esperado = CLAVE.test(clave) && !clave.includes('..') && !clave.startsWith('privado/') ? firmaDe(clave) : ''
  if (!esperado || f.length !== esperado.length || !timingSafeEqual(Buffer.from(f), Buffer.from(esperado))) return res.status(404).json({ error: 'Ese archivo no existe' })
  const v = String(req.query.v ?? '')
  try {
    const k = v in FORMATOS ? await variante(clave, v as Formato) : clave
    const r = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: k, ...(req.headers.range ? { Range: String(req.headers.range) } : {}) }))
    const tipo = r.ContentType || 'application/octet-stream'
    res.status(r.ContentRange ? 206 : 200)
    res.setHeader('Content-Type', tipo)
    if (r.ContentLength != null) res.setHeader('Content-Length', String(r.ContentLength))
    if (r.ContentRange) res.setHeader('Content-Range', r.ContentRange)
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    // Solo el navegador guarda copia. El CDN de Vercel no: no separa las peticiones por Range y llegó a servir
    // un pedazo de 1 byte (206) como si fuera el archivo entero (11-nov).
    res.setHeader('CDN-Cache-Control', 'no-store')
    res.setHeader('Vercel-CDN-Cache-Control', 'no-store')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; sandbox")
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
    const nombre = (k.split('/').pop() ?? 'archivo').replace(/[^\w.-]/g, '')
    res.setHeader('Content-Disposition', `${EN_LINEA.test(tipo) ? 'inline' : 'attachment'}; filename="${nombre}"`)
    ;(r.Body as Readable).pipe(res)
  } catch (e) {
    const n = (e as { name?: string }).name
    if (n === 'NoSuchKey' || n === 'NotFound') return res.status(404).json({ error: 'Ese archivo no existe' })
    if (n === 'InvalidRange') return res.status(416).end()
    logger.error({ evento: 'MEDIA_ERROR', clave, err: (e as Error).message })
    if (!res.headersSent) res.status(502).json({ error: 'No se pudo leer el archivo. Intenta de nuevo.' })
  }
}
