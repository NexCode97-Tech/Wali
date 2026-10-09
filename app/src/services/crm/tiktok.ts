import crypto from 'crypto'
import type { CrmConexion, Prisma } from '@prisma/client'
import { prisma, prismaGlobal } from './bd'
import { espacioActual } from './espacio'
import { cifrar, descifrar } from './cifrado'
import { ErrorEnvio, VEINTICUATRO_H, archivoPermitido, idDeOpcion, opcionesLista, recortar, type OpcionLista } from './whatsapp'
import { sinFormatoWa } from './paginas'
import { conexionAFront, emitirConexiones, type ConexionFront } from './conexiones'
import { AppError, ConflictError, NotFoundError, ValidationError } from '../../utils/errors'
import { logger } from '../../utils/logger'

/**
 * TikTok en el CRM,
 * con la Business Messaging API de TikTok API for Business.
 *
 * Una conexión `tipo: 'tiktok'` es una cuenta de empresa de TikTok (`open_id`, el `business_id` de
 * la API). Se autoriza con el enlace de autorización de una app de desarrollador de TikTok que ya
 * tenga acceso a Business Messaging (TikTok lo da tras su revisión de seguridad y privacidad):
 *
 * - Manual: la empresa pega el App ID, el Secret y el enlace de autorización de su app, y pone en
 *   su app la dirección de regreso del CRM. El CRM apunta los avisos de la app a
 *   `/api/crm/tiktok/webhook/:clave`.
 * - Con la app de la plataforma: la configura su administrador (Líneas de WhatsApp, caja de
 *   proveedores) y los avisos llegan a `/api/crm/tiktok/webhook`.
 *
 * En los dos, el CRM abre el enlace en una ventana, TikTok vuelve a `/api/crm/tiktok/regreso` con
 * el código y el CRM lo cambia por el acceso (vence cada día y se renueva solo; la renovación dura
 * un año). Solo se responde dentro de las 48 horas desde el último mensaje de la persona. No está
 * disponible en el Espacio Económico Europeo, Suiza ni el Reino Unido. Guía: docs/crm/api-tiktok.md.
 */

type Json = Record<string, any>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})
const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const azar = (n: number) => crypto.randomBytes(n).toString('hex')
const json = (v: unknown) => v as Prisma.InputJsonValue

export const baseTiktok = () => (process.env.CRM_TIKTOK_URL || 'https://business-api.tiktok.com/open_api/v1.3').replace(/\/+$/, '')
export const urlRegresoTiktok = (baseApi: string) => `${baseApi}/api/crm/tiktok/regreso`
export const urlAvisosTiktok = (baseApi: string, clave?: string) => `${baseApi}/api/crm/tiktok/webhook${clave ? `/${clave}` : ''}`
/** Los permisos que tiene que aceptar la empresa para leer y mandar mensajes. */
const PERMISOS = ['message.list.read', 'message.list.send', 'message.list.manage']
const CUARENTA_Y_OCHO_H = 2 * VEINTICUATRO_H

export interface DatosTiktok {
  appId: string
  /** El enlace de autorización de la app (el de TikTok API for Business, sin el `state`). */
  urlAutorizacion: string
  openId?: string
  usuario?: string
  webhookUrl?: string
  venceAcceso?: number
  venceRenovar?: number
  permisos?: string[]
  /** Mientras la empresa autoriza: el código que TikTok devuelve en `state`, y hasta cuándo sirve. */
  estadoOauth?: string
  estadoVence?: number
}

// ─── Errores y cliente ───────────────────────────────────────────────────────

const EXPLICACION: Record<number, string> = {
  40001: 'La app de TikTok no tiene permiso para esto: revisa que tenga acceso a Business Messaging y que la cuenta aceptó todos los permisos',
  40002: 'TikTok no aceptó los datos enviados',
  40007: 'TikTok no encontró lo pedido',
  40100: 'Se pasó el límite de llamadas a TikTok. Espera un momento',
  40105: 'El acceso a la cuenta de TikTok venció o no es válido: vuelve a autorizarla en Ajustes del CRM, Canales',
  40908: 'TikTok no acepta ese tipo de archivo',
  40064: 'TikTok bloqueó el mensaje por sus reglas de mensajes directos (por ejemplo, el límite de mensajes sin respuesta)',
  51065: 'TikTok tuvo un error. Intenta de nuevo',
}

export class ErrorTiktok extends AppError {
  codigo: number
  constructor(codigo: number, mensaje: string) {
    super(`${EXPLICACION[codigo] ?? 'TikTok rechazó la solicitud'} (TikTok ${codigo || 'sin código'}${mensaje ? ': ' + mensaje : ''})`, codigo === 40105 ? 409 : codigo >= 50000 ? 502 : 400)
    Object.setPrototypeOf(this, ErrorTiktok.prototype)
    this.codigo = codigo
  }
}

interface OpcionesTiktok { token?: string; body?: Json; form?: FormData; method?: string; query?: Record<string, string> }

export async function tiktok<T = Json>(ruta: string, op: OpcionesTiktok = {}): Promise<T> {
  const qs = op.query ? `?${new URLSearchParams(op.query).toString()}` : ''
  let res: Response
  try {
    res = await fetch(`${baseTiktok()}${ruta}${qs}`, {
      method: op.method ?? 'POST',
      headers: { ...(op.token ? { 'Access-Token': op.token } : {}), ...(op.body ? { 'Content-Type': 'application/json' } : {}) },
      body: op.form ?? (op.body ? JSON.stringify(op.body) : undefined),
      signal: AbortSignal.timeout(60_000),
    })
  } catch (e) {
    throw new AppError(`No se pudo hablar con TikTok: ${(e as Error).name === 'TimeoutError' ? 'no respondió a tiempo' : (e as Error).message}`, 502)
  }
  const d = await res.json().catch(() => ({})) as Json
  if (d.code !== 0) throw new ErrorTiktok(Number(d.code) || res.status, txt(d.message))
  return (d.data ?? {}) as T
}

// ─── App de la plataforma ────────────────────────────────────────────────────

const CLAVES = { appId: 'CRM_TIKTOK_APP_ID', secreto: 'CRM_TIKTOK_APP_SECRET', auth: 'CRM_TIKTOK_AUTH_URL' } as const

export async function proveedorTiktok(): Promise<{ appId: string; appSecret: string; urlAutorizacion: string } | null> {
  const filas = await prismaGlobal.configApp.findMany({ where: { clave: { in: Object.values(CLAVES) } } })
  const v = (k: string) => filas.find(f => f.clave === k)?.valor ?? ''
  if (!v(CLAVES.appId) || !v(CLAVES.secreto) || !v(CLAVES.auth)) return null
  let appSecret = ''
  try { appSecret = String(descifrar<{ s?: string }>(v(CLAVES.secreto)).s ?? '') } catch { return null }
  return appSecret ? { appId: v(CLAVES.appId), appSecret, urlAutorizacion: v(CLAVES.auth) } : null
}

export async function proveedorTiktokPublico(baseApi: string) {
  const p = await proveedorTiktok()
  const filas = await prismaGlobal.configApp.findMany({ where: { clave: { in: [CLAVES.appId, CLAVES.auth] } } })
  const v = (k: string) => filas.find(f => f.clave === k)?.valor ?? ''
  return { listo: !!p, appId: v(CLAVES.appId), urlAutorizacion: v(CLAVES.auth), regreso: urlRegresoTiktok(baseApi), webhookUrl: urlAvisosTiktok(baseApi) }
}

function validarAutorizacion(url: string): URL {
  let u: URL
  try { u = new URL(url) } catch { throw new ValidationError('El enlace de autorización no es un enlace: cópialo completo de TikTok API for Business, My Apps, App Detail, Basic Information') }
  const propio = new URL(baseTiktok()).host
  if (u.protocol !== 'https:' && u.host !== propio) throw new ValidationError('El enlace de autorización debe empezar por https://')
  if (!/(^|\.)tiktok\.com$/i.test(u.hostname) && u.host !== propio) throw new ValidationError('Ese enlace no es de TikTok: es el «TikTok account holder authorization URL» de tu app')
  return u
}

/** Solo el administrador de la plataforma: la app de TikTok con acceso a Business Messaging. */
export async function guardarProveedorTiktok(entrada: Json, baseApi: string) {
  const appId = String(entrada.appId ?? '').trim(), appSecret = String(entrada.appSecret ?? '').trim(), url = String(entrada.urlAutorizacion ?? '').trim()
  if (!/^\d{6,30}$/.test(appId)) throw new ValidationError('El App ID de TikTok son solo números')
  validarAutorizacion(url)
  const actual = await proveedorTiktok()
  if (!appSecret && (!actual || actual.appId !== appId)) throw new ValidationError('Falta el Secret de la app de TikTok')
  if (appSecret && !/^[\w-]{20,80}$/.test(appSecret)) throw new ValidationError('El Secret de la app de TikTok no se ve completo')
  const poner = (clave: string, valor: string) => prismaGlobal.configApp.upsert({ where: { clave }, create: { clave, valor }, update: { valor } })
  await poner(CLAVES.appId, appId)
  await poner(CLAVES.auth, url)
  if (appSecret) await poner(CLAVES.secreto, cifrar({ s: appSecret }))
  const p = await proveedorTiktok()
  // Los avisos de todas las cuentas que autoricen la app llegan a la dirección general.
  let avisos: string | null = null
  if (p) {
    try { await tiktok('/business/webhook/update/', { body: { app_id: p.appId, secret: p.appSecret, event_type: 'DIRECT_MESSAGE', callback_url: urlAvisosTiktok(baseApi) } }) }
    catch (e) { avisos = (e as Error).message }
  }
  return { ...(await proveedorTiktokPublico(baseApi)), errorAvisos: avisos }
}

// ─── Conectar ────────────────────────────────────────────────────────────────

/**
 * Deja lista la conexión para autorizar y devuelve el enlace que se abre en la ventana de TikTok.
 * `modo: 'plataforma'` usa la app de la plataforma; `manual`, la de la empresa.
 */
export async function empezarTiktok(entrada: Json, baseApi: string, por: string | null): Promise<{ conexion: ConexionFront; url: string }> {
  const modo = entrada.modo === 'plataforma' ? 'plataforma' : 'manual'
  let appId: string, appSecret: string, urlAut: string
  if (modo === 'plataforma') {
    const p = await proveedorTiktok()
    if (!p) throw new AppError('El botón de TikTok todavía no está configurado en la plataforma. Usa «Con los datos de tu app»', 409)
    ;({ appId, appSecret, urlAutorizacion: urlAut } = p)
  } else {
    appId = String(entrada.appId ?? '').trim(); appSecret = String(entrada.appSecret ?? '').trim(); urlAut = String(entrada.urlAutorizacion ?? '').trim()
    if (!/^\d{6,30}$/.test(appId)) throw new ValidationError('El App ID son solo números: está en TikTok API for Business, My Apps, App Detail, Basic Information')
    if (!/^[\w-]{20,80}$/.test(appSecret)) throw new ValidationError('Pega el Secret completo de la app: está junto al App ID')
    validarAutorizacion(urlAut)
  }
  // Una conexión pendiente por app y espacio: si ya había una sin terminar, se reusa.
  const previa = (await prisma.crmConexion.findMany({ where: { tipo: 'tiktok', modo } }))
    .find(c => obj(c.datos).appId === appId && !obj(c.datos).openId)
  const clave = previa?.clave ?? azar(24)
  const nonce = azar(12)
  const datos: DatosTiktok = { appId, urlAutorizacion: urlAut, estadoOauth: nonce, estadoVence: Date.now() + 15 * 60_000, ...(modo === 'manual' ? { webhookUrl: urlAvisosTiktok(baseApi, clave) } : {}) }
  const secretos = modo === 'manual' ? cifrar({ appSecret }) : cifrar({})
  const c = previa
    ? await prisma.crmConexion.update({ where: { id: previa.id }, data: { secretos, datos: json(datos), estado: 'pendiente', error: null }, include: { _count: { select: { lineas: true } } } })
    : await prisma.crmConexion.create({ data: { tipo: 'tiktok', modo, nombre: 'TikTok', clave, secretos, datos: json(datos) }, include: { _count: { select: { lineas: true } } } })
  if (modo === 'manual') {
    // Los avisos de la app de la empresa, a la dirección de esta conexión.
    try { await tiktok('/business/webhook/update/', { body: { app_id: appId, secret: appSecret, event_type: 'DIRECT_MESSAGE', callback_url: datos.webhookUrl } }) }
    catch (e) {
      await prisma.crmConexion.delete({ where: { id: c.id } }).catch(() => null)
      throw e instanceof ErrorTiktok && e.codigo === 40001 ? new ValidationError('TikTok no aceptó el App ID y el Secret, o la app todavía no tiene acceso a Business Messaging') : e
    }
  }
  const u = new URL(urlAut)
  u.searchParams.set('state', `${c.clave}.${nonce}`)
  u.searchParams.set('disable_auto_auth', '1')
  logger.info(`[CRM tiktok] autorización empezada (${modo}), app ${appId}, por ${por}`)
  return { conexion: conexionAFront(c), url: u.toString() }
}

/**
 * TikTok vuelve aquí con el código (público, sin sesión: el `state` dice qué conexión es). Cambia el
 * código por el acceso y deja la conexión lista. Devuelve el texto para la ventana que se cierra.
 */
export async function terminarTiktok(query: Json, baseApi: string): Promise<{ ok: boolean; texto: string; espacioId?: string }> {
  const [clave, nonce] = String(query.state ?? '').split('.')
  const code = String(query.code ?? query.auth_code ?? '')
  if (!clave || !nonce) return { ok: false, texto: 'Falta el código de la conexión: vuelve a intentarlo desde el CRM' }
  const c = /^[0-9a-f]{48}$/.test(clave) ? await prismaGlobal.crmConexion.findUnique({ where: { clave } }) : null
  const d = obj(c?.datos) as DatosTiktok
  if (!c || c.tipo !== 'tiktok' || d.estadoOauth !== nonce) return { ok: false, texto: 'Esta autorización ya no sirve: vuelve a intentarlo desde el CRM' }
  if ((d.estadoVence ?? 0) < Date.now()) return { ok: false, texto: 'Pasaron más de 15 minutos: vuelve a intentarlo desde el CRM' }
  if (query.error || !code) return { ok: false, texto: `TikTok no terminó la autorización${query.error_description ? `: ${query.error_description}` : ''}` }
  const secreto = c.modo === 'plataforma' ? (await proveedorTiktok())?.appSecret ?? '' : String(descifrar<{ appSecret?: string }>(c.secretos).appSecret ?? '')
  let r: Json
  try {
    r = await tiktok('/tt_user/oauth2/token/', { body: { client_id: d.appId, client_secret: secreto, grant_type: 'authorization_code', auth_code: code, redirect_uri: urlRegresoTiktok(baseApi) } })
  } catch (e) { return { ok: false, texto: `TikTok no aceptó la autorización: ${(e as Error).message}` } }
  const openId = txt(r.open_id)
  const permisos = String(r.scope ?? '').split(',').map(s => s.trim()).filter(Boolean)
  const faltan = PERMISOS.filter(p => !permisos.includes(p))
  if (!openId || !r.access_token) return { ok: false, texto: 'TikTok no entregó el acceso a la cuenta' }
  if (faltan.length) return { ok: false, texto: `En TikTok no se aceptaron todos los permisos de mensajes (${faltan.join(', ')}). Vuelve a autorizar y acéptalos todos` }
  const otra = await prismaGlobal.crmConexion.findFirst({ where: { tipo: 'tiktok', id: { not: c.id }, datos: { path: ['openId'], equals: openId } } })
  if (otra && otra.espacioId !== c.espacioId) return { ok: false, texto: 'Esa cuenta de TikTok ya está conectada en otro espacio del CRM' }
  let usuario = ''
  try {
    const info = await tiktok<Json>('/business/get/', { method: 'GET', token: String(r.access_token), query: { business_id: openId, fields: '["username","display_name"]' } })
    usuario = txt(info.username) || txt(info.display_name)
  } catch (e) { logger.info(`[CRM tiktok] sin nombre de la cuenta ${openId}: ${(e as Error).message}`) }
  const ahora = Date.now()
  const nuevos: DatosTiktok = {
    ...d, openId, usuario, permisos, estadoOauth: undefined, estadoVence: undefined,
    venceAcceso: ahora + Number(r.expires_in ?? 86400) * 1000, venceRenovar: ahora + Number(r.refresh_token_expires_in ?? 31536000) * 1000,
  }
  const guardar = { ...descifrar<Json>(c.secretos), access: String(r.access_token), refresh: String(r.refresh_token ?? '') }
  // La misma cuenta ya estaba en este espacio: se actualiza esa y se borra la pendiente.
  const destino = otra && otra.espacioId === c.espacioId ? otra : c
  await prismaGlobal.crmConexion.update({
    where: { id: destino.id },
    data: { nombre: usuario ? `@${usuario.replace(/^@/, '')}` : 'TikTok', modo: c.modo, secretos: cifrar(guardar), datos: json({ ...nuevos, webhookUrl: c.modo === 'manual' ? d.webhookUrl : undefined }), estado: 'conectada', error: null },
  })
  if (destino.id !== c.id) await prismaGlobal.crmConexion.delete({ where: { id: c.id } }).catch(() => null)
  logger.info(`[CRM tiktok] cuenta ${usuario || openId} conectada (${c.modo})`)
  return { ok: true, texto: `Listo: ${usuario ? `@${usuario.replace(/^@/, '')}` : 'la cuenta de TikTok'} quedó conectada. Ya puedes cerrar esta ventana.`, espacioId: c.espacioId }
}

// ─── Acceso vigente ──────────────────────────────────────────────────────────

/** El acceso de la cuenta, renovado si vence en menos de 10 minutos (vence cada día). */
export async function accesoTiktok(c: CrmConexion): Promise<string> {
  const s = descifrar<{ access?: string; refresh?: string; appSecret?: string }>(c.secretos)
  const d = obj(c.datos) as DatosTiktok
  if (s.access && (d.venceAcceso ?? 0) > Date.now() + 10 * 60_000) return s.access
  if (!s.refresh) throw new ErrorEnvio('La cuenta de TikTok no terminó de autorizarse: vuelve a conectarla en Ajustes del CRM, Canales')
  if ((d.venceRenovar ?? 0) < Date.now()) throw new ErrorEnvio('La autorización de TikTok venció (dura un año): vuelve a autorizar la cuenta en Ajustes del CRM, Canales')
  const secreto = c.modo === 'plataforma' ? (await proveedorTiktok())?.appSecret ?? '' : String(s.appSecret ?? '')
  const r = await tiktok<Json>('/tt_user/oauth2/refresh_token/', { body: { client_id: d.appId, client_secret: secreto, grant_type: 'refresh_token', refresh_token: s.refresh } })
  const ahora = Date.now()
  await prismaGlobal.crmConexion.update({
    where: { id: c.id },
    data: {
      secretos: cifrar({ ...s, access: String(r.access_token), refresh: String(r.refresh_token ?? s.refresh) }),
      datos: json({ ...d, venceAcceso: ahora + Number(r.expires_in ?? 86400) * 1000, venceRenovar: ahora + Number(r.refresh_token_expires_in ?? 31536000) * 1000 }),
    },
  })
  return String(r.access_token)
}

/** El secreto con que TikTok firma los avisos de esta conexión (el de su app). */
export async function secretoAvisosTiktok(c: CrmConexion | null): Promise<string> {
  if (!c) return (await proveedorTiktok())?.appSecret ?? ''
  try { return String(descifrar<{ appSecret?: string }>(c.secretos).appSecret ?? '') } catch { return '' }
}

/** TikTok-Signature: t=…,s=HMAC-SHA256(secreto, t + '.' + cuerpo). Se acepta hasta una hora de diferencia. */
export function firmaTiktokValida(cuerpo: Buffer, cabecera: string | undefined, secreto: string): boolean {
  if (!cabecera || !secreto) return false
  const partes = Object.fromEntries(cabecera.split(',').map(x => x.split('=').map(y => y.trim())))
  const t = Number(partes.t), s = String(partes.s ?? '')
  if (!t || !/^[0-9a-f]{64}$/i.test(s) || Math.abs(Date.now() / 1000 - t) > 3600) return false
  const esperada = crypto.createHmac('sha256', secreto).update(`${t}.${cuerpo.toString('utf8')}`).digest()
  const dada = Buffer.from(s, 'hex')
  return dada.length === esperada.length && crypto.timingSafeEqual(dada, esperada)
}

export async function revisarTiktok(id: string, por: string | null): Promise<ConexionFront> {
  const c = await prisma.crmConexion.findUnique({ where: { id } })
  if (!c || c.tipo !== 'tiktok') throw new NotFoundError('Esa cuenta de TikTok no está conectada')
  let estado = 'conectada', error: string | null = null
  try {
    const d = obj(c.datos) as DatosTiktok
    if (!d.openId) throw new AppError('La cuenta no terminó de autorizarse en TikTok: vuelve a conectarla', 409)
    const token = await accesoTiktok(c)
    await tiktok('/business/message/conversation/list/', { method: 'GET', token, query: { business_id: d.openId, conversation_type: 'SINGLE', limit: '1' } })
  } catch (e) { estado = 'error'; error = (e as Error).message }
  const f = await prisma.crmConexion.update({ where: { id }, data: { estado, error }, include: { _count: { select: { lineas: true } } } })
  await emitirConexiones(por)
  return conexionAFront(f)
}

/** Baja una imagen o un video que mandó la persona (el enlace dura un día y pide el acceso en `x-user`). */
export async function bajarDeTiktok(c: CrmConexion, conversationId: string, messageId: string, mediaId: string, tipo: 'IMAGE' | 'VIDEO'): Promise<{ buffer: Buffer; mime: string }> {
  const token = await accesoTiktok(c)
  const d = obj(c.datos) as DatosTiktok
  const r = await tiktok<{ download_url?: string }>('/business/message/media/download/', { token, body: { business_id: d.openId, conversation_id: conversationId, message_id: messageId, media_id: mediaId, media_type: tipo } })
  if (!r.download_url) throw new Error('TikTok no dio el enlace del archivo')
  const res = await fetch(r.download_url, { headers: { 'x-user': token }, signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new Error(`TikTok no entregó el archivo (HTTP ${res.status})`)
  return { buffer: Buffer.from(await res.arrayBuffer()), mime: (res.headers.get('content-type') || (tipo === 'IMAGE' ? 'image/jpeg' : 'video/mp4')).split(';')[0].trim() }
}

// ─── Envío ───────────────────────────────────────────────────────────────────

export interface MsgTiktok {
  datos: unknown
  conversacion: { id: number; canal: string; contactoId: number; conexionId: string | null; ultimoEntranteAt: Date | null; extra: unknown; contacto: { ttId: string | null } }
}

/** Envía por TikTok un CrmMensaje de salida ya guardado. */
export async function enviarPorTiktok(m: MsgTiktok): Promise<{ id: string; extra: string[] }> {
  const c = m.conversacion
  const SIN = 'La cuenta de TikTok de esta conversación ya no está conectada al CRM: vuelve a conectarla en Ajustes del CRM, Canales'
  if (!c.conexionId) throw new ErrorEnvio(SIN)
  const cx = await prisma.crmConexion.findUnique({ where: { id: c.conexionId } })
  if (!cx || cx.tipo !== 'tiktok') throw new ErrorEnvio(SIN)
  const d = obj(cx.datos) as DatosTiktok
  const datos = obj(m.datos)
  if (txt(datos.plantilla)) throw new ErrorEnvio('Las plantillas son de WhatsApp: TikTok no las usa. Escríbele un mensaje normal mientras estén abiertas las 48 horas')
  // La conversación de TikTok (conversation_id) llega con cada mensaje de la persona.
  let conversacion = txt(obj(c.extra).ttConversacion)
  if (!conversacion) {
    const otras = await prisma.crmConversacion.findMany({ where: { contactoId: c.contactoId, conexionId: c.conexionId, canal: 'tt' }, orderBy: { createdAt: 'desc' }, select: { extra: true }, take: 20 })
    conversacion = otras.map(x => txt(obj(x.extra).ttConversacion)).find(Boolean) ?? ''
  }
  if (!conversacion) throw new ErrorEnvio('Todavía no hay una conversación de TikTok con esta persona: TikTok solo deja responder a quien escribió primero')
  const otra = await prisma.crmConversacion.aggregate({ where: { contactoId: c.contactoId, conexionId: c.conexionId, canal: 'tt' }, _max: { ultimoEntranteAt: true } })
  const entrante = Math.max(c.ultimoEntranteAt?.getTime() ?? 0, otra._max.ultimoEntranteAt?.getTime() ?? 0)
  if (!entrante || Date.now() - entrante > CUARENTA_Y_OCHO_H) throw new ErrorEnvio('Pasaron más de 48 horas desde el último mensaje del cliente: TikTok no deja escribirle hasta que vuelva a escribir')
  const token = await accesoTiktok(cx)

  let texto = sinFormatoWa(txt(datos.out) || txt(datos.bot) || txt(datos.ia) || txt(datos.recepcion))
  const url = txt(obj(datos.link).url)
  if (url && !texto.includes(url)) texto = texto ? `${texto}\n${url}` : url
  const partes: Json[] = []
  const conTexto = (t: string) => partes.push({ message_type: 'TEXT', text: { body: t } })
  const tarjeta = (ops: OpcionLista[]) => {
    // Tarjeta de botones de TikTok: pregunta de 40 caracteres y de 1 a 3 botones de 20. Al tocar uno, TikTok
    // manda su texto como mensaje de la persona. Con más de 3 opciones van escritas.
    if (ops.length > 3) { conTexto(`${texto || 'Elige una opción.'}\n\n${ops.map((o, i) => `${i + 1}. ${o.t}${txt(o.d) ? `: ${txt(o.d)}` : ''}`).join('\n')}`); return }
    const titulo = texto && texto.length <= 40 ? texto : 'Elige una opción'
    if (texto && texto.length > 40) conTexto(texto)
    partes.push({ message_type: 'TEMPLATE', template: { type: 'QA_BUTTON_CARD', title: titulo, buttons: ops.map((o, i) => ({ type: 'REPLY', title: recortar(o.t, 20, true), id: (txt(o.id) || idDeOpcion(i, o.t)).slice(0, 40) })) } })
  }
  const lista = obj(datos.lista), archivo = obj(datos.file)
  if (Array.isArray(datos.botones) && datos.botones.length) {
    const ops: OpcionLista[] = datos.botones.map((b: unknown) => (typeof b === 'string' ? { t: b } : { t: txt(obj(b).t) || txt(obj(b).title) || txt(obj(b).op), id: txt(obj(b).id) || undefined })).filter((o: OpcionLista) => o.t)
    if (!ops.length) throw new ErrorEnvio('Los botones del mensaje están vacíos')
    tarjeta(ops)
  } else if (Array.isArray(lista.ops) && lista.ops.length) {
    const ops = opcionesLista(lista)
    if (!ops.length) throw new ErrorEnvio('La lista del mensaje no tiene opciones')
    tarjeta(ops)
  } else if (txt(archivo.url) || txt(obj(datos.audio).url)) {
    const fuente = txt(archivo.url) || txt(obj(datos.audio).url)
    const mime = txt(archivo.mime).toLowerCase()
    if (txt(archivo.url) && /^image\/(jpeg|png)$/.test(mime) && archivoPermitido(fuente)) {
      // Imagen: se sube a TikTok (JPG o PNG hasta 3 MB) y va sola; el texto va aparte.
      const res = await fetch(fuente, { signal: AbortSignal.timeout(60_000) }).catch(e => { throw new ErrorEnvio(`No se pudo descargar la imagen para enviarla: ${(e as Error).message}`) })
      if (!res.ok) throw new ErrorEnvio(`No se pudo descargar la imagen para enviarla (HTTP ${res.status})`)
      const buffer = Buffer.from(await res.arrayBuffer())
      if (buffer.length > 3 * 1024 * 1024) throw new ErrorEnvio('La imagen pasa de 3 MB, el máximo de TikTok')
      const form = new FormData()
      form.append('business_id', d.openId ?? '')
      form.append('media_type', 'IMAGE')
      form.append('file', new Blob([buffer], { type: mime }), txt(archivo.n) || 'imagen.jpg')
      const up = await tiktok<{ media_id?: string }>('/business/message/media/upload/', { token, form })
      partes.push({ message_type: 'IMAGE', image: { media_id: up.media_id } })
      if (texto) conTexto(texto)
    } else {
      // TikTok solo recibe texto e imágenes: lo demás va como enlace.
      conTexto(`${texto ? `${texto}\n\n` : ''}${txt(archivo.n) || 'Nota de voz'}: ${fuente}`)
    }
  } else {
    if (!texto) throw new ErrorEnvio('El mensaje está vacío')
    conTexto(texto)
  }
  for (const p of partes) if (p.text && p.text.body.length > 6000) throw new ErrorEnvio('El mensaje pasa de 6.000 caracteres, el máximo de TikTok')

  const ids: string[] = []
  for (const p of partes) {
    try {
      const r = await tiktok<{ message?: { message_id?: string } }>('/business/message/send/', { token, body: { business_id: d.openId, recipient_type: 'CONVERSATION', recipient: conversacion, ...p } })
      ids.push(txt(r.message?.message_id) || `tt-sin-id-${Date.now()}`)
    } catch (e) {
      throw new ErrorEnvio(ids.length ? `Salió una parte, pero no el resto: ${(e as Error).message}` : (e as Error).message)
    }
  }
  return { id: ids[0], extra: ids.slice(1) }
}

