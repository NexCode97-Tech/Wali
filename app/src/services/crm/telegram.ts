import crypto from 'crypto'
import type { CrmConexion, Prisma } from '@prisma/client'
import { prisma, prismaGlobal } from './bd'
import { espacioActual } from './espacio'
import { cifrar, descifrar } from './cifrado'
import { ErrorEnvio, archivoPermitido, audioParaWhatsapp, idDeOpcion, opcionesLista, recortar, type OpcionLista } from './whatsapp'
import { sinFormatoWa } from './paginas'
import { conexionAFront, emitirConexiones, type ConexionFront } from './conexiones'
import { AppError, ConflictError, NotFoundError, ValidationError } from '../../utils/errors'
import { logger } from '../../utils/logger'

/**
 * Telegram en el CRM. La empresa crea su bot con @BotFather y pega el token: el CRM
 * lo revisa (getMe) y le pone la dirección de avisos propia de la conexión
 * (`/api/crm/telegram/webhook/:clave`), con un código secreto que Telegram manda en cada aviso
 * (X-Telegram-Bot-Api-Secret-Token). Telegram no cobra por mensaje ni tiene ventana de 24 horas:
 * el bot le escribe a quien le haya escrito antes. Guía: docs/crm/api-telegram.md.
 */

type Json = Record<string, any>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})
const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const azar = (n: number) => crypto.randomBytes(n).toString('hex')
const json = (v: unknown) => v as Prisma.InputJsonValue

export const baseTelegram = () => (process.env.CRM_TELEGRAM_URL || 'https://api.telegram.org').replace(/\/+$/, '')
export const urlAvisosTelegram = (baseApi: string, clave: string) => `${baseApi}/api/crm/telegram/webhook/${clave}`

export interface DatosTelegram { botId: string; usuario: string; nombre: string; webhookUrl: string }

/** Un error de Telegram, dicho para quien atiende. */
export class ErrorTelegram extends AppError {
  codigo: number
  constructor(codigo: number, descripcion: string) {
    const d = descripcion || 'sin detalle'
    const t = codigo === 401 || /unauthorized/i.test(d) ? 'Telegram no reconoce el token del bot: revísalo o genera uno nuevo con @BotFather'
      : codigo === 403 && /blocked/i.test(d) ? 'La persona bloqueó el bot en Telegram'
      : codigo === 403 ? 'Telegram no deja escribirle a esta persona: nunca le escribió al bot o lo bloqueó'
      : codigo === 400 && /chat not found/i.test(d) ? 'Telegram no encontró la conversación con esta persona'
      : codigo === 429 ? 'Se mandaron demasiados mensajes seguidos por Telegram. Intenta de nuevo en un momento'
      : 'Telegram rechazó la solicitud'
    super(`${t} (Telegram ${codigo || 'sin código'}: ${d})`, codigo === 401 ? 400 : codigo >= 500 ? 502 : 400)
    Object.setPrototypeOf(this, ErrorTelegram.prototype)
    this.codigo = codigo
  }
}

/** Llama a la API de bots. `metodo` es getMe, sendMessage…; con FormData manda archivos. */
export async function telegram<T = Json>(token: string, metodo: string, cuerpo?: Json | FormData): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${baseTelegram()}/bot${token}/${metodo}`, {
      method: 'POST',
      ...(cuerpo instanceof FormData ? { body: cuerpo } : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo ?? {}) }),
      signal: AbortSignal.timeout(60_000),
    })
  } catch (e) {
    // Sin la URL: lleva el token.
    throw new AppError(`No se pudo hablar con Telegram: ${(e as Error).name === 'TimeoutError' ? 'no respondió a tiempo' : (e as Error).message}`, 502)
  }
  const d = await res.json().catch(() => ({})) as Json
  if (!d.ok) throw new ErrorTelegram(Number(d.error_code) || res.status, txt(d.description))
  return d.result as T
}

function tokenDe(c: Pick<CrmConexion, 'secretos'>): string {
  try { return String(descifrar<{ token?: string }>(c.secretos).token ?? '') } catch { return '' }
}
export function secretoAvisosTelegram(c: Pick<CrmConexion, 'secretos'>): string {
  try { return String(descifrar<{ secreto?: string }>(c.secretos).secreto ?? '') } catch { return '' }
}

// ─── Conectar, revisar, desconectar ──────────────────────────────────────────

/** Conecta (o vuelve a conectar) el bot con su token de @BotFather. */
export async function conectarTelegram(entrada: Json, baseApi: string, por: string | null): Promise<ConexionFront> {
  const token = String(entrada.token ?? '').replace(/\s+/g, '')
  if (!/^\d{5,15}:[\w-]{30,60}$/.test(token)) throw new ValidationError('El token del bot se ve así: 123456789:AAH… Cópialo completo del mensaje de @BotFather')
  let bot: { id?: number; username?: string; first_name?: string; is_bot?: boolean }
  try { bot = await telegram(token, 'getMe') } catch (e) {
    throw e instanceof ErrorTelegram && (e.codigo === 401 || e.codigo === 404) ? new ValidationError('Telegram no reconoce ese token: revísalo o genera uno nuevo con @BotFather (/token)') : e
  }
  const botId = String(bot.id ?? '')
  if (!botId || bot.is_bot === false) throw new ValidationError('Ese token no es de un bot de Telegram')
  const otra = await prismaGlobal.crmConexion.findFirst({ where: { espacioId: { not: espacioActual() }, tipo: 'telegram', datos: { path: ['botId'], equals: botId } }, select: { id: true } })
  if (otra) throw new ConflictError('Ese bot ya está conectado en otro espacio del CRM')

  const previa = await prisma.crmConexion.findFirst({ where: { tipo: 'telegram', datos: { path: ['botId'], equals: botId } } })
  const clave = previa?.clave ?? azar(24)
  const secreto = azar(24)
  const datos: DatosTelegram = { botId, usuario: txt(bot.username), nombre: txt(bot.first_name) || txt(bot.username), webhookUrl: urlAvisosTelegram(baseApi, clave) }
  const nombre = datos.usuario ? `@${datos.usuario}` : datos.nombre
  const c = previa
    ? await prisma.crmConexion.update({ where: { id: previa.id }, data: { nombre, secretos: cifrar({ token, secreto }), datos: json(datos), estado: 'pendiente', error: null } })
    : await prisma.crmConexion.create({ data: { tipo: 'telegram', modo: 'manual', nombre, clave, secretos: cifrar({ token, secreto }), datos: json(datos) } })
  let error: string | null = null
  try {
    await telegram(token, 'setWebhook', { url: datos.webhookUrl, secret_token: secreto, allowed_updates: ['message', 'edited_message', 'callback_query'], drop_pending_updates: false })
  } catch (e) {
    error = `El token está bien, pero Telegram no aceptó la dirección de avisos: ${(e as Error).message}`
  }
  const f = await prisma.crmConexion.update({
    where: { id: c.id }, data: { estado: error ? 'error' : 'conectada', error }, include: { _count: { select: { lineas: true } } },
  })
  logger.info(`[CRM telegram] bot ${datos.usuario || botId} ${f.estado}, por ${por}`)
  await emitirConexiones(por)
  return conexionAFront(f)
}

/** Mira en Telegram que el bot siga respondiendo y que su dirección de avisos sea la del CRM. */
export async function revisarTelegram(id: string, por: string | null): Promise<ConexionFront> {
  const c = await prisma.crmConexion.findUnique({ where: { id } })
  if (!c || c.tipo !== 'telegram') throw new NotFoundError('Ese bot no está conectado')
  const token = tokenDe(c), d = obj(c.datos) as DatosTelegram
  let estado = 'conectada', error: string | null = null
  try {
    await telegram(token, 'getMe')
    const w = await telegram<{ url?: string; last_error_message?: string; last_error_date?: number }>(token, 'getWebhookInfo')
    if (w.url !== d.webhookUrl) { estado = 'error'; error = 'La dirección de avisos del bot ya no es la del CRM (otro sistema la cambió). Vuelve a conectarlo para recuperarla' }
    else if (w.last_error_message && w.last_error_date && Date.now() / 1000 - w.last_error_date < 3600) { estado = 'error'; error = `Telegram no pudo entregar un aviso hace poco: ${w.last_error_message}` }
  } catch (e) { estado = 'error'; error = (e as Error).message }
  const f = await prisma.crmConexion.update({ where: { id }, data: { estado, error }, include: { _count: { select: { lineas: true } } } })
  await emitirConexiones(por)
  return conexionAFront(f)
}

/** Al desconectar: el bot deja de mandar sus avisos al CRM. */
export async function soltarTelegram(c: CrmConexion): Promise<void> {
  const token = tokenDe(c)
  if (token) await telegram(token, 'deleteWebhook', {}).catch(e => logger.warn(`[CRM telegram] deleteWebhook ${c.id}: ${(e as Error).message}`))
}

// ─── Archivos que llegan ─────────────────────────────────────────────────────

/** Baja un archivo que mandó la persona (getFile y su enlace, que lleva el token). Telegram deja bajar hasta 20 MB. */
export async function bajarDeTelegram(c: Pick<CrmConexion, 'secretos'>, fileId: string): Promise<{ buffer: Buffer; mime: string; ruta: string }> {
  const token = tokenDe(c)
  const f = await telegram<{ file_path?: string; file_size?: number }>(token, 'getFile', { file_id: fileId })
  if (!f.file_path) throw new Error('Telegram no dio el archivo (puede pesar más de 20 MB)')
  const res = await fetch(`${baseTelegram()}/file/bot${token}/${f.file_path}`, { signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new Error(`Telegram no entregó el archivo (HTTP ${res.status})`)
  return { buffer: Buffer.from(await res.arrayBuffer()), mime: (res.headers.get('content-type') || '').split(';')[0].trim(), ruta: f.file_path }
}

/** Al tocar un botón, Telegram espera que se le conteste (si no, el botón queda cargando). */
export async function contestarBoton(c: Pick<CrmConexion, 'secretos'>, callbackId: string): Promise<void> {
  await telegram(tokenDe(c), 'answerCallbackQuery', { callback_query_id: callbackId }).catch(e => logger.info(`[CRM telegram] answerCallbackQuery: ${(e as Error).message}`))
}

// ─── Envío ───────────────────────────────────────────────────────────────────

export interface MsgTelegram {
  datos: unknown
  conversacion: { conexionId: string | null; contacto: { tgId: string | null } }
}

const MAX_TEXTO = 4096, MAX_PIE = 1024

/** Botones y listas de flujos y agentes: teclado bajo el mensaje, con los mismos ids que en WhatsApp (máximo 64 bytes). */
function teclado(ops: OpcionLista[], enFilas: boolean): Json {
  const ids = new Set<string>()
  const botones = ops.slice(0, 20).map((o, i) => {
    let id = Buffer.from(txt(o.id) || idDeOpcion(i, o.t)).subarray(0, 60).toString().replace(/�+$/, '')
    if (ids.has(id)) id = `${id.slice(0, 56)}_${i + 1}`
    ids.add(id)
    return { text: recortar(o.t, 60, true), callback_data: id }
  })
  const filas = enFilas || botones.length > 3 ? botones.map(b => [b]) : [botones]
  return { inline_keyboard: filas }
}

/** Envía por Telegram un CrmMensaje de salida ya guardado. Devuelve el id del mensaje en Telegram. */
export async function enviarPorTelegram(m: MsgTelegram): Promise<{ id: string; extra: string[] }> {
  const c = m.conversacion
  if (!c.conexionId) throw new ErrorEnvio('El bot de Telegram de esta conversación ya no está conectado al CRM: vuelve a conectarlo en Ajustes del CRM, Canales')
  const cx = await prisma.crmConexion.findUnique({ where: { id: c.conexionId } })
  if (!cx || cx.tipo !== 'telegram') throw new ErrorEnvio('El bot de Telegram de esta conversación ya no está conectado al CRM: vuelve a conectarlo en Ajustes del CRM, Canales')
  const token = tokenDe(cx)
  if (!token) throw new ErrorEnvio('Al bot le faltan sus claves: vuelve a conectarlo en Ajustes del CRM, Canales')
  const chat = c.contacto.tgId
  if (!chat) throw new ErrorEnvio('El contacto no tiene cuenta de Telegram')
  const datos = obj(m.datos)
  if (txt(datos.plantilla)) throw new ErrorEnvio('Las plantillas son de WhatsApp: Telegram no las usa y deja escribir sin ellas')

  let texto = sinFormatoWa(txt(datos.out) || txt(datos.bot) || txt(datos.ia) || txt(datos.recepcion))
  const url = txt(obj(datos.link).url)
  if (url && !texto.includes(url)) texto = texto ? `${texto}\n${url}` : url
  const lista = obj(datos.lista)
  const archivo = obj(datos.file), audio = obj(datos.audio)
  const ids: string[] = []
  const mandar = async (metodo: string, cuerpo: Json | FormData) => {
    try {
      const r = await telegram<{ message_id?: number }>(token, metodo, cuerpo)
      ids.push(String(r.message_id ?? ''))
    } catch (e) {
      throw new ErrorEnvio(ids.length ? `Salió una parte, pero no el resto: ${(e as Error).message}` : (e as Error).message)
    }
  }

  if (Array.isArray(datos.botones) && datos.botones.length) {
    const ops: OpcionLista[] = datos.botones.map((b: unknown) => (typeof b === 'string' ? { t: b } : { t: txt(obj(b).t) || txt(obj(b).title) || txt(obj(b).op), id: txt(obj(b).id) || undefined }))
      .filter((o: OpcionLista) => o.t)
    if (!ops.length) throw new ErrorEnvio('Los botones del mensaje están vacíos')
    await mandar('sendMessage', { chat_id: chat, text: recortar(texto || 'Elige una opción.', MAX_TEXTO), reply_markup: teclado(ops, false) })
  } else if (Array.isArray(lista.ops) && lista.ops.length) {
    const ops = opcionesLista(lista)
    if (!ops.length) throw new ErrorEnvio('La lista del mensaje no tiene opciones')
    const detalle = ops.some(o => txt(o.d)) ? `\n\n${ops.map(o => `• ${o.t}${txt(o.d) ? `: ${txt(o.d)}` : ''}`).join('\n')}` : ''
    await mandar('sendMessage', { chat_id: chat, text: recortar(`${texto || 'Elige una opción.'}${detalle}`, MAX_TEXTO), reply_markup: teclado(ops, true) })
  } else if (txt(archivo.url) || txt(audio.url)) {
    const esAudio = !txt(archivo.url)
    // Telegram recibe notas de voz en OGG con Opus, MP3 o M4A: la de la Nube va en MP3.
    const fuente = esAudio ? audioParaWhatsapp(txt(audio.url), 'mp3') : txt(archivo.url)
    if (!archivoPermitido(fuente)) throw new ErrorEnvio('El archivo no está en la Nube del CRM: vuelve a adjuntarlo')
    let res: Response
    try { res = await fetch(fuente, { signal: AbortSignal.timeout(60_000) }) } catch (e) { throw new ErrorEnvio(`No se pudo descargar el archivo para enviarlo: ${(e as Error).message}`) }
    if (!res.ok) throw new ErrorEnvio(`No se pudo descargar el archivo para enviarlo (HTTP ${res.status})`)
    const buffer = Buffer.from(await res.arrayBuffer())
    if (buffer.length > 50 * 1024 * 1024) throw new ErrorEnvio('El archivo pasa de 50 MB, el máximo que un bot puede mandar por Telegram')
    const mime = (esAudio ? 'audio/mpeg' : txt(archivo.mime) || res.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim().toLowerCase()
    const nombre = esAudio ? 'nota-de-voz.mp3' : txt(archivo.n) || 'archivo'
    const [metodo, campo] = esAudio ? ['sendVoice', 'voice'] : /^image\/(jpeg|png|webp)$/.test(mime) && buffer.length <= 10 * 1024 * 1024 ? ['sendPhoto', 'photo'] : /^video\/mp4$/.test(mime) ? ['sendVideo', 'video'] : ['sendDocument', 'document']
    const form = new FormData()
    form.append('chat_id', chat)
    form.append(campo, new Blob([buffer], { type: mime }), nombre)
    const pie = texto && texto.length <= MAX_PIE && !esAudio
    if (pie) form.append('caption', texto)
    await mandar(metodo, form)
    if (texto && !pie) await mandar('sendMessage', { chat_id: chat, text: recortar(texto, MAX_TEXTO) })
  } else {
    if (!texto) throw new ErrorEnvio('El mensaje está vacío')
    if (texto.length > MAX_TEXTO) throw new ErrorEnvio('El mensaje pasa de 4.096 caracteres, el máximo de Telegram')
    await mandar('sendMessage', { chat_id: chat, text: texto, link_preview_options: { is_disabled: !/https?:\/\//i.test(texto) } })
  }
  // El id de Telegram es por conversación: se guarda con el bot y la persona para que sea único.
  const propios = ids.map(i => `tg:${obj(cx.datos).botId}:${chat}:${i}`)
  return { id: propios[0], extra: propios.slice(1) }
}
