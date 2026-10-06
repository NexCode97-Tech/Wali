import type { CrmMensaje, Prisma } from '@prisma/client'
import { prisma } from './bd'
import { logger } from '../../utils/logger'
import { AppError } from '../../utils/errors'
import { emitirMsg } from './tiempoReal'
import { nombreDe } from './usuarios'
import { telDigitos } from './formas'
import { buscarPlantilla, variablesDe, type PlantillaMeta } from './plantillas'
import { credDeLinea, hayWhatsapp, type CredMeta } from './credenciales'
import { leerAjuste } from './ajustes'

/**
 * WhatsApp Cloud API del CRM (26-sep-2026): el cliente de la Graph API de Meta
 * y el envío de los mensajes de salida. Contrato en docs/crm/CONTRATO-CRM.md
 * §5 y detalles de operación en docs/crm/api-whatsapp.md.
 *
 * Cada llamada lleva la credencial de la conexión que el espacio hizo desde el
 * CRM (credenciales.ts). El token solo viaja en la cabecera Authorization y
 * nunca se escribe en el registro: los errores se arman sin la URL.
 */

type Json = Record<string, any>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})

// CRM_GRAPH_URL solo existe para las pruebas locales (el Meta simulado); en producción es la Graph API.
export const baseGraph = () => (process.env.CRM_GRAPH_URL || 'https://graph.facebook.com/v21.0').replace(/\/+$/, '')
const base = baseGraph

/** ¿El espacio tiene WhatsApp conectado desde el CRM? */
export async function waConfigurado(): Promise<boolean> {
  return hayWhatsapp()
}

export const VENTANA_24H = 'Pasaron más de 24 horas desde el último mensaje del cliente: WhatsApp solo deja enviar una plantilla aprobada'

// ─── Errores de Meta en español ──────────────────────────────────────────────

/** Qué significa cada código de Meta y qué hacer. Lo que no está aquí sale con el texto de Meta. */
const EXPLICACION: Record<number, string> = {
  1: 'Meta tuvo un error pasajero. Intenta de nuevo en unos minutos',
  2: 'Meta no está disponible en este momento. Intenta de nuevo en unos minutos',
  3: 'La app de Meta no tiene acceso a esta función',
  4: 'Se pasó el límite de llamadas a la API de Meta. Espera unos minutos',
  10: 'El token no tiene el permiso necesario. El usuario del sistema necesita whatsapp_business_management y whatsapp_business_messaging',
  100: 'Meta no aceptó los datos enviados',
  190: 'El token de Meta venció o no es válido. Genera uno nuevo para el usuario del sistema y vuelve a conectar WhatsApp en Ajustes del CRM, Canales',
  200: 'El token no tiene permiso sobre esta cuenta de WhatsApp. Asigna la cuenta al usuario del sistema en el administrador de negocios de Meta',
  368: 'Meta bloqueó temporalmente la cuenta por incumplir sus políticas',
  80007: 'Se pasó el límite de llamadas a la API de WhatsApp. Espera unos minutos',
  130429: 'Se pasó el límite de mensajes por segundo de la línea. Intenta de nuevo en un momento',
  131000: 'Meta tuvo un error al procesar el mensaje. Intenta de nuevo',
  131005: 'El token no tiene permiso para enviar por esta línea. Si conectaste con el token temporal de la app, ya venció: genera el token del usuario del sistema con whatsapp_business_messaging y la cuenta de WhatsApp asignada, y pégalo en Ajustes del CRM, Líneas de WhatsApp, Revisar',
  131008: 'Falta un dato obligatorio en el mensaje',
  131009: 'Uno de los datos del mensaje no es válido',
  131016: 'WhatsApp no está disponible en este momento. Intenta de nuevo en unos minutos',
  131021: 'No se puede enviar un mensaje al mismo número de la línea',
  131026: 'No se pudo entregar: el número no tiene WhatsApp, no aceptó los términos nuevos de WhatsApp o usa una versión muy vieja',
  131031: 'Meta bloqueó o restringió la cuenta de WhatsApp. Revisa el administrador de WhatsApp',
  131037: 'La línea todavía no tiene el nombre visible aprobado por Meta',
  131042: 'Hay un problema con el método de pago de la cuenta de WhatsApp. Revísalo en el administrador de WhatsApp de Meta',
  131045: 'El número no está registrado en la API de Meta. Vuelve a conectar la línea',
  131047: VENTANA_24H,
  131048: 'Meta frenó los envíos de esta línea porque muchos destinatarios la marcaron como spam o la bloquearon',
  131049: 'Meta no entregó este mensaje de marketing para cuidar la experiencia de la persona. Intenta más adelante',
  131050: 'La persona pidió no recibir mensajes de marketing de esta empresa',
  131051: 'WhatsApp no admite este tipo de mensaje',
  131052: 'No se pudo descargar el archivo que mandó el cliente',
  131053: 'Meta no pudo tomar el archivo. Revisa que el formato y el tamaño sean de los que admite WhatsApp',
  131056: 'Se mandaron demasiados mensajes seguidos a este número. Espera un momento',
  131057: 'La cuenta de WhatsApp está en mantenimiento',
  132000: 'La cantidad de variables no coincide con la plantilla aprobada',
  132001: 'La plantilla no existe o no está aprobada en ese idioma',
  132005: 'El texto de la plantilla con las variables quedó demasiado largo',
  132007: 'La plantilla no cumple las políticas de formato de Meta',
  132012: 'Una variable de la plantilla tiene un formato que Meta no acepta',
  132015: 'La plantilla está pausada por baja calidad. Edítala o espera a que Meta la reactive',
  132016: 'Meta deshabilitó la plantilla por baja calidad',
  133000: 'El número quedó a medio desregistrar. Intenta de nuevo en unos minutos',
  133004: 'El servidor de Meta no está disponible. Intenta de nuevo en unos minutos',
  133005: 'El PIN no coincide con la verificación en dos pasos del número. Si no lo recuerdas, cámbialo en el administrador de WhatsApp de Meta (Números de teléfono, Configuración, Verificación en dos pasos)',
  133006: 'El número no está verificado. Verifícalo por SMS o llamada en el administrador de WhatsApp de Meta y vuelve a intentar',
  133008: 'Demasiados intentos con el PIN. Espera el tiempo que indique Meta',
  133009: 'Se intentó el PIN demasiado rápido. Espera un momento',
  133010: 'El número no está registrado en la API de Meta',
  133015: 'El número se borró hace poco de otra cuenta. Espera unos minutos y vuelve a intentar',
  133016: 'Se pasó el límite de registros de este número. Espera 72 horas o escribe al soporte de Meta',
  135000: 'Meta tuvo un error genérico con los datos del mensaje',
}

/** Subcódigos (sobre todo al crear plantillas). */
const EXPLICACION_SUB: Record<number, string> = {
  33: 'El objeto no existe o el token no tiene permiso sobre él',
  2388019: 'La cuenta llegó al máximo de plantillas que permite Meta',
  2388023: 'Meta está borrando una plantilla con ese nombre. Usa otro nombre',
  2388024: 'Ya existe una plantilla con ese nombre en ese idioma. Usa otro nombre',
  2388293: 'La plantilla tiene demasiadas variables para su largo. Agrega más texto fijo entre ellas',
  2388299: 'Las variables no pueden ir al principio ni al final del mensaje',
}

interface ErrorGraph { code?: number; error_subcode?: number; message?: string; title?: string; error_user_msg?: string; error_user_title?: string; error_data?: { details?: string } | string }

/** Un error de Meta con el texto en español para la persona, más el código y el texto original. */
export function explicarErrorMeta(e: ErrorGraph | null | undefined): string {
  if (!e) return 'Meta rechazó la solicitud sin decir por qué'
  const codigo = Number(e.code) || 0
  const sub = Number(e.error_subcode) || 0
  const detalle = typeof e.error_data === 'string' ? e.error_data : e.error_data?.details
  const textoMeta = String(detalle || e.error_user_msg || e.message || e.title || '').trim()
  const explicacion = EXPLICACION_SUB[sub] ?? EXPLICACION[codigo] ?? 'Meta rechazó la solicitud'
  return `${explicacion} (Meta ${codigo || 'sin código'}${sub ? '/' + sub : ''}${textoMeta ? ': ' + textoMeta : ''})`
}

export class ErrorMeta extends AppError {
  codigo: number
  sub: number
  textoMeta: string
  constructor(e: ErrorGraph, http: number) {
    super(explicarErrorMeta(e), http >= 500 ? 502 : 400)
    Object.setPrototypeOf(this, ErrorMeta.prototype)
    this.codigo = Number(e.code) || 0
    this.sub = Number(e.error_subcode) || 0
    this.textoMeta = String(e.message ?? '')
  }
}

// ─── Cliente de la Graph API ─────────────────────────────────────────────────

interface OpcionesGraph {
  cred: CredMeta; method?: string; query?: Record<string, string | number | undefined>; body?: unknown; timeoutMs?: number
  /** Otro host de Meta con la misma forma (graph.instagram.com para Instagram con inicio de sesión de Instagram). */
  base?: string
}

/** La API de Instagram con inicio de sesión de Instagram (services/crm/instagram.ts). */
export const baseInstagram = () => (process.env.CRM_INSTAGRAM_URL || 'https://graph.instagram.com/v21.0').replace(/\/+$/, '')

/** Llama a la Graph API con la credencial dada. Lanza ErrorMeta (con el texto en español) si Meta dice que no. */
/** Errores de red en los que el pedido nunca llegó a Meta. */
const SIN_SALIR = new Set(['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'UND_ERR_CONNECT_TIMEOUT', 'ENETUNREACH', 'EHOSTUNREACH'])

export async function graph<T = Json>(ruta: string, op: OpcionesGraph): Promise<T> {
  if (!op.cred?.token) throw new AppError('Falta la conexión con Meta: conecta WhatsApp en Ajustes del CRM, Canales', 409)
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(op.query ?? {})) if (v !== undefined && v !== '') qs.set(k, String(v))
  const url = `${op.base ?? base()}${ruta.startsWith('/') ? '' : '/'}${ruta}${qs.toString() ? '?' + qs.toString() : ''}`
  let res: Response | null = null
  // Si la conexión falla antes de llegar a Meta (DNS o conexión rechazada), se reintenta: el pedido no salió, así que
  // no hay riesgo de mandar un mensaje dos veces. Un corte a mitad de camino no se reintenta (28-sep: «fetch failed»).
  for (let intento = 0; ; intento++) {
    try {
      res = await fetch(url, {
        method: op.method ?? 'GET',
        headers: { Authorization: `Bearer ${op.cred.token}`, ...(op.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        body: op.body !== undefined ? JSON.stringify(op.body) : undefined,
        signal: AbortSignal.timeout(op.timeoutMs ?? 30_000),
      })
      break
    } catch (e) {
      const causa = String(((e as { cause?: { code?: unknown } }).cause ?? {}).code ?? '')
      if (intento < 2 && SIN_SALIR.has(causa)) { await new Promise(r => setTimeout(r, intento ? 4000 : 1500)); continue }
      // Sin la URL: puede llevar el token (debug_token). La causa (código de red) sí, para saber qué pasó.
      throw new AppError(`No se pudo hablar con Meta: ${(e as Error).name === 'TimeoutError' ? 'no respondió a tiempo' : (e as Error).message}${causa ? ` (${causa})` : ''}`, 502)
    }
  }
  const texto = await res.text()
  let datos: Json = {}
  try { datos = texto ? JSON.parse(texto) : {} } catch { datos = {} }
  if (!res.ok || datos.error) throw new ErrorMeta(obj(datos.error) as ErrorGraph, res.ok ? 400 : res.status)
  return datos as T
}

/** Solo se manda el token a los dominios de Meta (o al Meta simulado de las pruebas). */
function hostDeMeta(url: string): boolean {
  try {
    const h = new URL(url).host
    if (h === new URL(base()).host) return true
    return /(^|\.)(facebook\.com|fbsbx\.com|fbcdn\.net|whatsapp\.net)$/i.test(new URL(url).hostname)
  } catch { return false }
}

/** Un archivo que llegó por WhatsApp: GET /{media_id} da la URL y se descarga con el token. */
export async function descargarMedia(mediaId: string, cred: CredMeta): Promise<{ buffer: Buffer; mime: string; bytes: number }> {
  const info = await graph<{ url?: string; mime_type?: string; file_size?: number }>(`/${encodeURIComponent(mediaId)}`, { cred })
  if (!info.url) throw new AppError('Meta no dio el enlace del archivo', 502)
  if (!hostDeMeta(info.url)) throw new AppError('El enlace del archivo no es de Meta', 502)
  const res = await fetch(info.url, { headers: { Authorization: `Bearer ${cred.token}` }, signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new AppError(`Meta no entregó el archivo (HTTP ${res.status})`, 502)
  const buffer = Buffer.from(await res.arrayBuffer())
  return { buffer, mime: (info.mime_type || res.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim(), bytes: buffer.length }
}

// ─── Cuentas y números ───────────────────────────────────────────────────────

/** GREEN → Alta… (como lo muestra la pantalla: «Calidad según Meta: Alta»). */
export function calidadTexto(q: unknown): string {
  return ({ GREEN: 'Alta', YELLOW: 'Media', RED: 'Baja' } as Record<string, string>)[String(q ?? '').toUpperCase()] ?? 'Sin calificar'
}

/** TIER_2K → «2.000 por día»; TIER_UNLIMITED → «Sin límite». */
export function limiteTexto(t: unknown): string | null {
  const s = String(t ?? '').toUpperCase()
  if (!s) return null
  if (s === 'TIER_UNLIMITED') return 'Sin límite'
  const m = s.match(/^TIER_(\d+)(K)?$/)
  if (!m) return s
  return `${(Number(m[1]) * (m[2] ? 1000 : 1)).toLocaleString('es-CO')} por día`
}

/** Lo que Meta dice de un token (debug_token): de qué app es, si vale, cuándo vence y a qué cuentas llega. */
export interface InfoToken {
  appId: string; valido: boolean; vence: number; permisos: string[]; wabas: string[]; tipo: string
  /** Token de página: el id de la página. */
  perfilId: string
  /** Las páginas a las que llega con permiso de mensajes (pages_messaging). */
  paginas: string[]
}

/**
 * Revisa un token con la llave de su app (`appId|appSecret`). Si la clave secreta
 * no es de esa app, Meta lo rechaza: así se valida también la clave.
 */
export async function revisarToken(token: string, llaveApp: string): Promise<InfoToken> {
  const r = await graph<{ data?: { app_id?: string; is_valid?: boolean; expires_at?: number; scopes?: string[]; type?: string; profile_id?: string; granular_scopes?: { scope?: string; target_ids?: string[] }[] } }>(
    '/debug_token', { cred: { token: llaveApp }, query: { input_token: token } })
  const d = r.data ?? {}
  const wabas = new Set<string>(), paginas = new Set<string>()
  for (const g of d.granular_scopes ?? []) {
    if (g.scope === 'whatsapp_business_management' || g.scope === 'whatsapp_business_messaging') for (const id of g.target_ids ?? []) wabas.add(String(id))
    if (g.scope === 'pages_messaging') for (const id of g.target_ids ?? []) paginas.add(String(id))
  }
  return {
    appId: String(d.app_id ?? ''), valido: d.is_valid === true, vence: Number(d.expires_at ?? 0), permisos: d.scopes ?? [], wabas: [...wabas], tipo: String(d.type ?? ''),
    perfilId: String(d.profile_id ?? ''), paginas: [...paginas],
  }
}

export interface NumeroMeta {
  id: string; display_phone_number?: string; verified_name?: string; code_verification_status?: string; quality_rating?: string
  messaging_limit_tier?: string; platform_type?: string; status?: string; name_status?: string
}

export async function numerosDeWaba(waba: string, cred: CredMeta): Promise<NumeroMeta[]> {
  const r = await graph<{ data?: NumeroMeta[] }>(`/${encodeURIComponent(waba)}/phone_numbers`, {
    cred,
    query: { fields: 'display_phone_number,verified_name,code_verification_status,quality_rating,messaging_limit_tier,platform_type,status,name_status', limit: 100 },
  })
  return r.data ?? []
}

/**
 * ¿Se puede conectar? Verificado por SMS, ya conectado a la API en la nube, o registrado en la API local de Meta
 * (On-Premises, apagada por Meta): al conectarlo, el registro con su PIN lo pasa a la API en la nube. Si Meta no lo acepta, el error de /register dice por qué.
 */
export const numeroListo = (n: NumeroMeta) => n.code_verification_status === 'VERIFIED' || (n.platform_type === 'CLOUD_API' && n.status === 'CONNECTED') || n.platform_type === 'ON_PREMISE'

export function estadoMetaTexto(n: NumeroMeta): string {
  if (n.platform_type === 'CLOUD_API' && n.status === 'CONNECTED') return 'Ya está en la API en la nube'
  if (n.platform_type === 'ON_PREMISE') return 'Viene de la API local de Meta: al conectarlo pasa a la API en la nube con su PIN'
  if (!numeroListo(n)) return 'Falta verificarlo por SMS en el administrador de WhatsApp de Meta'
  if (n.name_status && !['APPROVED', 'AVAILABLE_WITHOUT_REVIEW'].includes(n.name_status)) return 'Verificado; el nombre visible sigue en revisión en Meta'
  return 'Verificado, listo para conectar'
}

// ─── Envío ───────────────────────────────────────────────────────────────────

export const VEINTICUATRO_H = 24 * 60 * 60 * 1000
const primerNombre = (n?: string | null) => String(n ?? '').trim().split(/\s+/)[0] || ''
const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/**
 * Cloudinary guarda las notas de voz del navegador como webm, que WhatsApp no
 * acepta: se pide la versión mp3 cambiando la extensión (Cloudinary la convierte).
 * Instagram no recibe mp3: a Instagram va en m4a.
 */
export function audioParaWhatsapp(url: string, formato = 'mp3'): string {
  if (!/res\.cloudinary\.com\/.+\/video\/upload\//.test(url)) return url
  if (formato === 'mp3' ? /\.(mp3|m4a|aac|amr|ogg)(\?|$)/i.test(url) : new RegExp(`\\.${formato}(\\?|$)`, 'i').test(url)) return url
  return /\.[a-z0-9]{2,5}(\?|$)/i.test(url) ? url.replace(/\.[a-z0-9]{2,5}(\?|$)/i, `.${formato}$1`) : `${url}.${formato}`
}

/** La nota de voz en OGG con OPUS (lo que WhatsApp muestra como nota de voz), o null si no está en Cloudinary. */
export function notaDeVozOgg(url: string): string | null {
  const m = url.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\/)(.+)$/)
  if (!m) return null
  const resto = m[2].replace(/^ac_[a-z0-9]+\//, '')
  return `${m[1]}ac_opus/${resto.replace(/\.[a-z0-9]{2,5}(\?.*)?$/i, '')}.ogg`
}

export class ErrorEnvio extends Error {}

// ─── Archivos que salen ──────────────────────────────────────────────────────
// Se suben a Meta (POST /{phone_number_id}/media) con su tipo real y se mandan
// por id. Por enlace, Meta mira el tipo que sirve Cloudinary, y los PDF (raw sin
// extensión) salen como application/octet-stream y los rechaza. Tamaños y tipos
// de WhatsApp: imagen JPG o PNG ≤ 5 MB, video MP4 o 3GP ≤ 16 MB, audio AAC, AMR,
// MP3, M4A u OGG ≤ 16 MB, documento ≤ 100 MB; lo que no cabe como lo que es va
// como documento.

const MB = 1024 * 1024
const TIPOS_META: { tipo: 'image' | 'video' | 'audio' | 'document'; re: RegExp; max: number }[] = [
  { tipo: 'image', re: /^image\/(jpeg|png)$/, max: 5 * MB },
  { tipo: 'video', re: /^video\/(mp4|3gpp)$/, max: 16 * MB },
  { tipo: 'audio', re: /^audio\/(aac|amr|mpeg|mp4|ogg)$/, max: 16 * MB },
  { tipo: 'document', re: /./, max: 100 * MB },
]

/** Solo se descargan archivos del Cloudinary del CRM (o del Meta simulado en pruebas). */
export function archivoPermitido(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && u.hostname === 'res.cloudinary.com' || u.host === new URL(base()).host
  } catch { return false }
}

/** Un corte de red a mitad de camino («terminated», conexión reiniciada, tiempo agotado) o la Nube todavía convirtiendo. */
class CorteDeRed extends Error {}
const esCorte = (e: unknown) => {
  if (e instanceof CorteDeRed) return true
  const msg = String((e as Error)?.message ?? ''), causa = String(((e as { cause?: { code?: unknown } }).cause ?? {}).code ?? '')
  return (e as Error)?.name === 'TimeoutError' || /terminated|fetch failed|other side closed|socket/i.test(msg) || ['ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT', ...SIN_SALIR].includes(causa)
}
/** Bajar el archivo de la Nube y subirlo a Meta se puede repetir sin riesgo: todavía no sale ningún mensaje (28-sep: «terminated» en un despliegue). */
async function conReintentos<T>(fn: () => Promise<T>, veces = 3): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn() } catch (e) {
      if (i >= veces - 1 || !esCorte(e)) throw e
      await new Promise(r => setTimeout(r, 1500 * (i + 1)))
    }
  }
}
const textoCorte = (e: unknown) => (e as Error)?.name === 'TimeoutError' ? 'tardó demasiado' : esCorte(e) ? 'la conexión se cortó' : (e as Error)?.message

async function subirAMeta(cred: CredMeta, phoneNumberId: string, url: string, mimeDado: string, nombre: string, soloAudio = false): Promise<{ tipo: string; id: string }> {
  if (!archivoPermitido(url)) throw new ErrorEnvio('El archivo no está en la Nube del CRM: vuelve a adjuntarlo')
  let buffer: Buffer, tipoNube: string
  try {
    ;({ buffer, tipoNube } = await conReintentos(async () => {
      const res = await fetch(url, { signal: AbortSignal.timeout(60_000) })
      // 423: la Nube todavía está convirtiendo el archivo (la nota de voz a OGG); 5xx: falla pasajera.
      if (res.status === 423 || res.status >= 500) throw new CorteDeRed(`HTTP ${res.status}`)
      if (!res.ok) throw new ErrorEnvio(`No se pudo descargar el archivo para enviarlo (HTTP ${res.status})`)
      return { buffer: Buffer.from(await res.arrayBuffer()), tipoNube: res.headers.get('content-type') || '' }
    }))
  } catch (e) {
    if (e instanceof ErrorEnvio) throw e
    throw new ErrorEnvio(`No se pudo descargar el archivo para enviarlo: ${textoCorte(e)}. Toca Reintentar.`)
  }
  const mime = (mimeDado || tipoNube || 'application/octet-stream').split(';')[0].trim().toLowerCase()
  const destino = soloAudio
    ? TIPOS_META[2]
    : TIPOS_META.find(t => t.re.test(mime) && (t.tipo === 'document' || buffer.length <= t.max)) ?? TIPOS_META[3]
  if (buffer.length > destino.max) {
    throw new ErrorEnvio(`El archivo pesa ${(buffer.length / MB).toFixed(1).replace('.', ',')} MB y WhatsApp acepta hasta ${destino.max / MB} MB para este tipo`)
  }
  const form = new FormData()
  form.append('messaging_product', 'whatsapp')
  form.append('type', mime)
  form.append('file', new Blob([buffer], { type: mime }), nombre || 'archivo')
  let r: Response, datos: Json
  try {
    ;({ r, datos } = await conReintentos(async () => {
      const r = await fetch(`${base()}/${phoneNumberId}/media`, { method: 'POST', headers: { Authorization: `Bearer ${cred.token}` }, body: form, signal: AbortSignal.timeout(90_000) })
      return { r, datos: await r.json().catch(() => ({})) as Json }
    }))
  } catch (e) {
    throw new ErrorEnvio(`No se pudo subir el archivo a WhatsApp: ${textoCorte(e)}. Toca Reintentar.`)
  }
  if (!r.ok || datos.error || !datos.id) throw new ErrorMeta(obj(datos.error) as ErrorGraph, r.ok ? 400 : r.status)
  return { tipo: destino.tipo, id: String(datos.id) }
}

// ─── Mensajes interactivos (botones y listas) ────────────────────────────────
// Límites de Meta: botones de respuesta, máximo 3, título de 20 caracteres,
// id de 256, cuerpo de 1.024; lista, botón de 20, máximo 10 filas, título de
// fila de 24, descripción de 72, id de 200, cuerpo de 4.096.

const LIM = { botones: 3, tituloBoton: 20, idBoton: 256, cuerpoBotones: 1024, botonLista: 20, filas: 10, tituloFila: 24, descFila: 72, idFila: 200, cuerpoLista: 4096 }

/** Minúsculas, sin tildes ni signos: para comparar textos y armar ids. */
const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * Id estable de una opción (botón o fila): su posición y su texto. El flujo
 * lo vuelve a calcular para saber qué eligió la persona, aunque WhatsApp
 * devuelva el título recortado.
 */
export function idDeOpcion(i: number, titulo: string): string {
  return `op${i + 1}_${plano(titulo).replace(/ /g, '-').slice(0, 60) || 'opcion'}`
}

/**
 * Recorta un texto a `max` caracteres (como los cuenta JavaScript, que es lo
 * más estricto con los emojis) sin partir un emoji, por palabra si se puede y
 * con «…» al final. `unaLinea` junta los espacios y saltos (títulos).
 */
export function recortar(s: string, max: number, unaLinea = false): string {
  const limpio = unaLinea ? s.replace(/\s+/g, ' ').trim() : s.trim()
  if (limpio.length <= max) return limpio
  let out = ''
  for (const ch of Array.from(limpio)) {
    if (out.length + ch.length > max - 1) break
    out += ch
  }
  const espacio = out.lastIndexOf(' ')
  if (espacio >= Math.floor(max * 0.6)) out = out.slice(0, espacio)
  return out.replace(/[\s.,;:·—-]+$/u, '') + '…'
}

/** Títulos sin repetir: Meta rechaza botones con el mismo título. */
function sinRepetir(titulos: string[], max: number): string[] {
  const vistos = new Set<string>()
  return titulos.map(t => {
    let x = t || 'Opción'
    for (let n = 2; vistos.has(x.toLowerCase()); n++) x = recortar(t, max - String(n).length - 1, true) + ' ' + n
    vistos.add(x.toLowerCase())
    return x
  })
}

export interface OpcionLista { t: string; d?: string; id?: string }

function cuerpoLista(texto: string, boton: string, ops: OpcionLista[]): Json {
  if (ops.length > LIM.filas) logger.warn(`[CRM WA] la lista trae ${ops.length} opciones; WhatsApp permite ${LIM.filas} y se mandan las primeras`)
  const usadas = ops.slice(0, LIM.filas)
  const titulos = sinRepetir(usadas.map(o => recortar(o.t, LIM.tituloFila, true)), LIM.tituloFila)
  const ids = new Set<string>()
  const rows = usadas.map((o, j) => {
    let id = (txt(o.id) || idDeOpcion(j, o.t)).slice(0, LIM.idFila)
    if (ids.has(id)) id = `${id.slice(0, LIM.idFila - 4)}_${j + 1}`
    ids.add(id)
    const d = txt(o.d) ? recortar(o.d!, LIM.descFila, true) : ''
    return { id, title: titulos[j], ...(d ? { description: d } : {}) }
  })
  return {
    type: 'interactive',
    interactive: {
      type: 'list',
      body: { text: recortar(texto || 'Elige una opción.', LIM.cuerpoLista) },
      action: { button: recortar(txt(boton) || 'Ver opciones', LIM.botonLista, true), sections: [{ rows }] },
    },
  }
}

/**
 * `{bot, botones:[títulos]}` → botones de respuesta. Con más de 3 opciones
 * WhatsApp no deja botones: salen como lista, con los mismos ids.
 */
function cuerpoBotones(texto: string, botones: unknown[]): Json {
  const ops: OpcionLista[] = botones.map(b => (typeof b === 'string' ? { t: b } : { t: txt(obj(b).t) || txt(obj(b).title) || txt(obj(b).op), id: txt(obj(b).id) || undefined }))
    .filter(o => o.t)
  if (!ops.length) throw new ErrorEnvio('Los botones del mensaje están vacíos')
  if (ops.length > LIM.botones) return cuerpoLista(texto, 'Ver opciones', ops)
  const titulos = sinRepetir(ops.map(o => recortar(o.t, LIM.tituloBoton, true)), LIM.tituloBoton)
  // Meta rechaza dos botones con el mismo id: si vienen repetidos, el segundo lleva su posición.
  const ids = new Set<string>()
  const buttons = ops.map((o, i) => {
    let id = (o.id || idDeOpcion(i, o.t)).slice(0, LIM.idBoton)
    if (ids.has(id)) id = `${id.slice(0, LIM.idBoton - 4)}_${i + 1}`
    ids.add(id)
    return { type: 'reply', reply: { id, title: titulos[i] } }
  })
  return {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: recortar(texto || 'Elige una opción.', LIM.cuerpoBotones) },
      action: { buttons },
    },
  }
}

/** Las opciones de `{lista:{boton, ops}}`: texto suelto o `{t, d, id}`. */
export function opcionesLista(lista: Json): OpcionLista[] {
  const ops = Array.isArray(lista.ops) ? lista.ops : []
  return ops.map(o => (typeof o === 'string' ? { t: o } : { t: txt(obj(o).t), d: txt(obj(o).d), id: txt(obj(o).id) || undefined })).filter(o => o.t)
}

type MsgConTodo = CrmMensaje & {
  conversacion: { id: number; canal: string; asignadoId: string | null; ultimoEntranteAt: Date | null; contactoId: number; lineaId: string | null
    contacto: { nombre: string | null; telefono: string | null; campos: unknown }
    linea: { phoneNumberId: string; wabaId: string; conexionId: string | null } | null }
}

/** Valores para las variables de una plantilla: los que manda la pantalla y, si faltan, los del contacto. */
async function valorVariable(nombre: string, m: MsgConTodo, datos: Json): Promise<string> {
  const vars = obj(datos.vars)
  const dado = vars[nombre]
  if (dado !== undefined && dado !== null && String(dado).trim()) return String(dado).trim()
  const c = m.conversacion
  switch (nombre) {
    case 'nombre': return primerNombre(c.contacto.nombre)
    case 'asesor': return primerNombre(await nombreDe(c.asignadoId ?? m.autorId))
    case 'producto': return txt(obj(c.contacto.campos).producto)
    case 'enlace': return txt(obj(datos.link).url)
    default: return ''
  }
}

/** Texto final de cada plantilla que se está enviando (por id de mensaje), para guardarlo en el chat. */
const textoFinalPlantilla = new Map<string, string>()

async function cuerpoPlantilla(m: MsgConTodo, datos: Json, p: PlantillaMeta): Promise<Json> {
  const faltan: string[] = []
  const componentes: Json[] = []
  const llenos = new Map<string, string>()
  const valores = async (texto: string) => {
    const params: Json[] = []
    for (const v of variablesDe(texto)) {
      const valor = await valorVariable(v, m, datos)
      if (!valor) { faltan.push(v); continue }
      llenos.set(v, valor)
      params.push(p.parameter_format === 'NAMED' ? { type: 'text', parameter_name: v, text: valor } : { type: 'text', text: valor })
    }
    return params
  }
  for (const comp of p.components ?? []) {
    const tipo = String(comp.type ?? '').toUpperCase()
    if (tipo === 'HEADER') {
      const formato = String(comp.format ?? 'TEXT').toUpperCase()
      if (formato === 'TEXT' && comp.text) {
        const params = await valores(comp.text)
        if (params.length) componentes.push({ type: 'header', parameters: params })
      } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(formato)) {
        // Sin archivo en el mensaje, el guardado de la plantilla (lote 7: las de video creadas desde el CRM).
        let f = obj(datos.file)
        if (!txt(f.url)) f = obj(obj(await leerAjuste<unknown>('plantillasMedia'))[String(p.name)])
        if (!txt(f.url)) { faltan.push(formato === 'IMAGE' ? 'imagen' : formato === 'VIDEO' ? 'video' : 'documento'); continue }
        const clave = formato.toLowerCase()
        componentes.push({ type: 'header', parameters: [{ type: clave, [clave]: { link: f.url, ...(clave === 'document' && f.n ? { filename: f.n } : {}) } }] })
      }
    } else if (tipo === 'BODY' && comp.text) {
      const params = await valores(comp.text)
      if (params.length) componentes.push({ type: 'body', parameters: params })
    } else if (tipo === 'BUTTONS') {
      const botones: Json[] = comp.buttons ?? []
      for (let i = 0; i < botones.length; i++) {
        const b = botones[i]
        if (String(b.type).toUpperCase() !== 'URL' || !String(b.url ?? '').includes('{{')) continue
        // El final variable del enlace: el que mande la pantalla o lo que sobra del enlace de pago.
        const prefijo = String(b.url).split('{{')[0]
        const enlace = txt(obj(datos.vars)[`boton${i + 1}`]) || txt(obj(datos.link).url)
        const sufijo = enlace.startsWith(prefijo) ? enlace.slice(prefijo.length) : txt(obj(datos.vars)[`boton${i + 1}`])
        if (!sufijo) { faltan.push(`enlace del botón «${b.text ?? i + 1}»`); continue }
        componentes.push({ type: 'button', sub_type: 'url', index: String(i), parameters: [{ type: 'text', text: sufijo }] })
      }
    }
  }
  if (faltan.length) throw new ErrorEnvio(`La plantilla «${datos.plantilla}» necesita ${faltan.map(f => `«${f}»`).join(', ')}: escríbelo al elegir la plantilla`)
  // Lo que de verdad recibe el cliente, para dejarlo igual en el chat.
  const llenar = (t: string) => t.replace(/\{\{\s*([^}\s]+)\s*\}\}/g, (_x, v: string) => llenos.get(v) ?? `{{${v}}}`)
  const partes: string[] = []
  for (const comp of p.components ?? []) {
    const tipo = String(comp.type ?? '').toUpperCase()
    if ((tipo === 'HEADER' && String(comp.format ?? 'TEXT').toUpperCase() === 'TEXT' && comp.text) || (tipo === 'BODY' && comp.text) || (tipo === 'FOOTER' && comp.text)) partes.push(llenar(String(comp.text)))
  }
  textoFinalPlantilla.set(m.id, partes.join('\n\n'))
  return { type: 'template', template: { name: p.name, language: { code: p.language }, ...(componentes.length ? { components: componentes } : {}) } }
}

/** El cuerpo que se manda a POST /{phone_number_id}/messages, según la forma del mensaje (contrato §3). */
async function armarCuerpo(m: MsgConTodo, cred: CredMeta): Promise<Json> {
  const datos = obj(m.datos)
  const c = m.conversacion
  if (c.canal !== 'wa') throw new ErrorEnvio('Esta conversación no es de WhatsApp')
  if (!c.linea) throw new ErrorEnvio('La conversación no tiene una línea de WhatsApp conectada')
  if (!c.contacto.telefono) throw new ErrorEnvio('El contacto no tiene número de WhatsApp')

  const plantilla = txt(datos.plantilla)
  if (plantilla) {
    const p = await buscarPlantilla(c.linea.wabaId, plantilla, txt(datos.idioma) || undefined)
    if (!p) throw new ErrorEnvio(`La plantilla «${plantilla}» no existe en Meta para esta línea`)
    if (p.status !== 'APPROVED') throw new ErrorEnvio(`La plantilla «${plantilla}» no está aprobada por Meta todavía`)
    return cuerpoPlantilla(m, datos, p)
  }

  // La ventana de 24 h es de Meta por línea y cliente, no por conversación del CRM.
  const otra = await prisma.crmConversacion.aggregate({ where: { contactoId: c.contactoId, lineaId: c.lineaId }, _max: { ultimoEntranteAt: true } })
  const entrante = Math.max(c.ultimoEntranteAt?.getTime() ?? 0, otra._max.ultimoEntranteAt?.getTime() ?? 0)
  if (!entrante || Date.now() - entrante > VEINTICUATRO_H) throw new ErrorEnvio(VENTANA_24H)

  const texto = txt(datos.out) || txt(datos.bot) || txt(datos.ia) || txt(datos.recepcion)

  // Botones o lista de WhatsApp (flujos y agentes): {bot, botones:[…]} o {bot, lista:{boton, ops}}.
  if (Array.isArray(datos.botones) && datos.botones.length) return cuerpoBotones(texto, datos.botones)
  const lista = obj(datos.lista)
  if (Array.isArray(lista.ops) && lista.ops.length) {
    const ops = opcionesLista(lista)
    if (!ops.length) throw new ErrorEnvio('La lista del mensaje no tiene opciones')
    return cuerpoLista(texto, txt(lista.boton), ops)
  }

  const archivo = obj(datos.file)
  if (txt(archivo.url)) {
    if (texto.length > 1024) throw new ErrorEnvio('El texto que acompaña el archivo pasa de 1.024 caracteres, el máximo de WhatsApp. Envía el texto como un mensaje aparte.')
    const nombre = txt(archivo.n) || 'archivo'
    const { tipo, id } = await subirAMeta(cred, c.linea.phoneNumberId, txt(archivo.url), txt(archivo.mime), nombre)
    const caption = texto && tipo !== 'audio' ? { caption: texto } : {}
    return { type: tipo, [tipo]: { id, ...caption, ...(tipo === 'document' ? { filename: nombre } : {}) } }
  }
  const audio = obj(datos.audio)
  if (txt(audio.url)) {
    // Nota de voz de verdad: Meta la muestra como nota de voz solo si
    // es OGG con OPUS y va con voice: true. Cloudinary la convierte (ac_opus); si el archivo no está allá, va en mp3 como audio.
    const ogg = notaDeVozOgg(txt(audio.url))
    if (ogg) {
      const { id } = await subirAMeta(cred, c.linea.phoneNumberId, ogg, 'audio/ogg', 'nota-de-voz.ogg', true)
      return { type: 'audio', audio: { id, voice: true } }
    }
    const { id } = await subirAMeta(cred, c.linea.phoneNumberId, audioParaWhatsapp(txt(audio.url)), 'audio/mpeg', 'nota-de-voz.mp3', true)
    return { type: 'audio', audio: { id } }
  }

  let cuerpo = texto
  const url = txt(obj(datos.link).url)
  if (url && !cuerpo.includes(url)) cuerpo = cuerpo ? `${cuerpo}\n${url}` : url
  if (!cuerpo) throw new ErrorEnvio('El mensaje está vacío')
  if (cuerpo.length > 4096) throw new ErrorEnvio('El mensaje pasa de 4.096 caracteres, el máximo de WhatsApp')
  return { type: 'text', text: { body: cuerpo, preview_url: /https?:\/\//i.test(cuerpo) } }
}

/** Envía por WhatsApp un CrmMensaje de salida ya guardado. Nunca lanza: deja el estado en la fila. */
/** Códigos de Meta que dicen que el token de la cuenta ya no sirve para esa línea. */
const TOKEN_MALO = new Set([10, 190, 200, 131005])

async function marcarCuentaConError(msgId: string, error: string) {
  const m = await prisma.crmMensaje.findUnique({ where: { id: msgId }, select: { conversacion: { select: { linea: { select: { conexionId: true } } } } } })
  const id = m?.conversacion.linea?.conexionId
  if (!id) return
  await prisma.crmConexion.update({ where: { id }, data: { estado: 'error', error: error.slice(0, 500) } })
  const { emitirConexiones } = await import('./conexiones')
  await emitirConexiones(null)
}

export async function enviarPorWhatsapp(msgId: string): Promise<void> {
  let convId: number | null = null
  try {
    const m = await prisma.crmMensaje.findUnique({
      where: { id: msgId },
      include: { conversacion: { include: { contacto: true, linea: true } } },
    }) as MsgConTodo | null
    if (!m) return
    convId = m.conversacionId
    if (m.waId) return // ya salió
    // Chat de la página web: no hay a quién mandarlo; queda enviado y la burbuja lo trae (chatWeb.ts).
    if (m.conversacion.canal === 'web') {
      const f = await prisma.crmMensaje.update({ where: { id: msgId }, data: { estado: 'enviado', error: null } })
      emitirMsg(f.conversacionId, f)
      return
    }
    // Messenger e Instagram (paginas.ts), Telegram (telegram.ts), TikTok (tiktok.ts) y correo (correo.ts): salen por su conexión.
    const canal = m.conversacion.canal
    if (canal === 'fb' || canal === 'ig' || canal === 'tg' || canal === 'tt' || canal === 'mail') {
      const r = canal === 'tg' ? await (await import('./telegram')).enviarPorTelegram(m as never).then(x => ({ mid: x.id, extra: x.extra }))
        : canal === 'mail' ? await (await import('./correo')).enviarPorCorreo(m as never).then(x => ({ mid: x.id, extra: x.extra }))
        : canal === 'tt' ? await (await import('./tiktok')).enviarPorTiktok(m as never).then(x => ({ mid: x.id, extra: x.extra }))
        : await (await import('./paginas')).enviarPorPagina(m as never)
      const f = await prisma.crmMensaje.update({
        where: { id: msgId },
        data: { waId: r.mid, estado: 'enviado', error: null, ...(r.extra.length ? { datos: { ...obj(m.datos), _mids: r.extra } as Prisma.InputJsonValue } : {}) },
      })
      emitirMsg(f.conversacionId, f)
      return
    }
    if (!m.conversacion.linea) throw new ErrorEnvio('La conversación ya no tiene línea de WhatsApp: esa línea se quitó del CRM')
    const cred = await credDeLinea(m.conversacion.linea)
    const cuerpo = await armarCuerpo(m, cred)
    const r = await graph<{ messages?: { id?: string }[]; contacts?: { wa_id?: string }[] }>(`/${m.conversacion.linea.phoneNumberId}/messages`, {
      cred,
      method: 'POST',
      body: { messaging_product: 'whatsapp', recipient_type: 'individual', to: m.conversacion.contacto.telefono, ...cuerpo },
    })
    const wamid = r.messages?.[0]?.id
    if (!wamid) throw new ErrorEnvio('Meta no devolvió el id del mensaje')
    const final = textoFinalPlantilla.get(msgId)
    textoFinalPlantilla.delete(msgId)
    const f = await prisma.crmMensaje.update({
      where: { id: msgId },
      data: { waId: wamid, estado: 'enviado', error: null, ...(final ? { datos: { ...obj(m.datos), out: final } as Prisma.InputJsonValue } : {}) },
    })
    emitirMsg(f.conversacionId, f)
    // Meta devuelve el número con que WhatsApp conoce al cliente (México, Argentina, Brasil cambian
    // dígitos): se guarda ese, para que su respuesta caiga en el mismo contacto.
    const waIdCliente = telDigitos(r.contacts?.[0]?.wa_id)
    if (waIdCliente && waIdCliente !== m.conversacion.contacto.telefono) {
      await prisma.crmContacto.update({ where: { id: m.conversacion.contactoId }, data: { telefono: waIdCliente } })
        .catch(e => logger.warn(`[CRM WA] no se pudo guardar el wa_id ${waIdCliente} del contacto ${m.conversacion.contactoId}: ${(e as Error).message}`))
    }
  } catch (e) {
    textoFinalPlantilla.delete(msgId)
    const texto = e instanceof ErrorEnvio || e instanceof AppError ? e.message : esCorte(e) ? 'No se pudo enviar: la conexión se cortó mientras salía. Toca Reintentar.' : `No se pudo enviar: ${(e as Error)?.message ?? e}`
    logger.warn(`[CRM WA] envío ${msgId} falló: ${texto}`)
    // Token vencido o sin permiso: la cuenta de Meta queda con el problema a la vista en Líneas de WhatsApp (6-oct),
    // no solo en el mensaje que falló.
    if (e instanceof ErrorMeta && TOKEN_MALO.has(e.codigo)) await marcarCuentaConError(msgId, explicarErrorMeta({ code: e.codigo, message: e.textoMeta })).catch(() => {})
    try {
      const f = await prisma.crmMensaje.update({ where: { id: msgId }, data: { estado: 'fallido', error: texto.slice(0, 1000) } })
      emitirMsg(f.conversacionId, f)
    } catch (e2) {
      logger.error(`[CRM WA] no se pudo guardar el fallo del mensaje ${msgId} (conversación ${convId ?? '?'}): ${(e2 as Error).message}`)
    }
  }
}
