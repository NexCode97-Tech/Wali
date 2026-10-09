import crypto from 'crypto'
import type { CrmConexion, Prisma } from '@prisma/client'
import { prisma, prismaGlobal } from './bd'
import { espacioActual } from './espacio'
import { cifrar, descifrar } from './cifrado'
import {
  ErrorEnvio, ErrorMeta, VEINTICUATRO_H, archivoPermitido, audioParaWhatsapp, baseGraph, baseInstagram, graph, idDeOpcion, opcionesLista, recortar, revisarToken,
  type InfoToken, type OpcionLista,
} from './whatsapp'
import { conexionAFront, emitirConexiones, porQueNoConecta, proveedorPaginas, type ConexionFront } from './conexiones'
import { AppError, ConflictError, NotFoundError, ValidationError } from '../../utils/errors'
import { logger } from '../../utils/logger'

/**
 * Messenger del CRM. Una conexión `tipo: 'pagina'` es una página de
 * Facebook, y por ella entran y salen los mensajes de Messenger. Instagram va aparte, con su propio
 * inicio de sesión (instagram.ts), aunque el envío es el mismo y vive aquí (`enviarPorPagina`).
 * Dos caminos, como WhatsApp:
 *
 * - Manual: App ID, clave secreta de la app y un token (el de un usuario del sistema con la página
 *   asignada, o el de la página). El CRM revisa el token con la llave de la app, configura en la
 *   app los avisos del objeto `page` hacia la dirección propia de la conexión
 *   (`/api/crm/meta/webhook/:clave`) y suscribe la app a la página. Si la app ya manda esos avisos
 *   a otra parte, no se pisa: la conexión queda con el aviso de configurarlo a mano.
 * - Con el botón de Meta (Facebook Login for Business con la configuración de páginas de la app de
 *   la plataforma): la empresa elige sus páginas en la ventana de Meta y el CRM las conecta todas.
 *   Los avisos llegan a la dirección general `/api/crm/meta/webhook`.
 *
 * Por la API no hay plantillas en estos canales: solo se responde dentro de las 24 horas desde el
 * último mensaje de la persona. Guía: docs/crm/api-instagram-messenger.md.
 */

type Json = Record<string, any>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})
const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const azar = (n: number) => crypto.randomBytes(n).toString('hex')
const json = (v: unknown) => v as Prisma.InputJsonValue

/** Lo que el token necesita para Messenger. */
export const PERMISOS_FB = ['pages_messaging', 'pages_manage_metadata']
/** Los avisos de la página que el CRM usa. */
const CAMPOS_PAGINA = 'messages,messaging_postbacks,message_deliveries,message_reads,message_echoes'

export interface DatosPagina {
  appId: string
  pageId: string
  pageNombre: string
  /** El código que Meta repite al verificar la dirección de los avisos. No es secreto de acceso. */
  verifyToken: string
  webhookUrl?: string
  /** propio: la app manda sus avisos de páginas al CRM. otro: ya tenía otra dirección y hay que cambiarla a mano. */
  webhookApp?: 'propio' | 'otro'
  permisos?: string[]
  vence?: number
}

export const urlAvisosPagina = (baseApi: string, clave: string) => `${baseApi}/api/crm/meta/webhook/${clave}`

const SIN_PAGINA = 'La página de Facebook de esta conversación ya no está conectada al CRM: vuelve a conectarla en Ajustes del CRM, Canales'
const nombreCanal = (canal: string) => (canal === 'ig' ? 'Instagram' : 'Messenger')

// ─── Páginas del token ───────────────────────────────────────────────────────

interface PaginaMeta { id: string; name?: string; access_token?: string }

/** Las páginas a las que llega el token, con el token de cada una. */
async function paginasDelToken(token: string, info: InfoToken): Promise<PaginaMeta[]> {
  if (info.tipo === 'PAGE') {
    const p = await graph<PaginaMeta>(`/${encodeURIComponent(info.perfilId || 'me')}`, { cred: { token }, query: { fields: 'id,name' } })
    return p.id ? [{ id: String(p.id), name: p.name, access_token: token }] : []
  }
  const r = await graph<{ data?: PaginaMeta[] }>('/me/accounts', { cred: { token }, query: { fields: 'id,name,access_token', limit: 100 } })
  const todas = (r.data ?? []).filter(p => p.id && p.access_token).map(p => ({ ...p, id: String(p.id) }))
  // Si Meta dice a qué páginas llega el permiso de mensajes, solo esas.
  return info.paginas.length ? todas.filter(p => info.paginas.includes(p.id)) : todas
}

// ─── Guardar y configurar una página ─────────────────────────────────────────

interface OpcionesGuardar {
  modo: 'manual' | 'meta'
  appId: string
  appSecret?: string
  pagina: PaginaMeta
  permisos: string[]
  vence: number
  baseApi: string
}

/**
 * Deja la página conectada en el espacio (o actualiza la que ya estaba) y configura Meta para que
 * sus mensajes lleguen: los avisos de la app (solo en la manual; los de la app de la plataforma
 * los configura su administrador) y la suscripción de la app a la página.
 */
async function guardarPagina(o: OpcionesGuardar): Promise<CrmConexion & { _count: { lineas: number } }> {
  const pageId = o.pagina.id
  const pageToken = String(o.pagina.access_token ?? '')
  if (!pageToken) throw new AppError(`Meta no entregó el acceso a la página ${o.pagina.name ?? pageId}`, 502)
  const otra = await prismaGlobal.crmConexion.findFirst({
    where: { espacioId: { not: espacioActual() }, tipo: 'pagina', datos: { path: ['pageId'], equals: pageId } }, select: { id: true },
  })
  if (otra) throw new ConflictError(`La página «${o.pagina.name ?? pageId}» ya está conectada en otro espacio del CRM`)

  const previa = await prisma.crmConexion.findFirst({ where: { tipo: 'pagina', datos: { path: ['pageId'], equals: pageId } } })
  const clave = previa?.clave ?? azar(24)
  const verifyToken = txt(obj(previa?.datos).verifyToken) || azar(16)
  const datos: DatosPagina = {
    appId: o.appId, pageId, pageNombre: txt(o.pagina.name) || `Página ${pageId}`,
    verifyToken, ...(o.modo === 'manual' ? { webhookUrl: urlAvisosPagina(o.baseApi, clave) } : {}),
    permisos: o.permisos, vence: o.vence || 0,
  }
  const secretos = cifrar(o.modo === 'manual' ? { token: pageToken, appSecret: o.appSecret } : { token: pageToken })
  // Se guarda antes de pedirle nada a Meta: al configurar los avisos, Meta llama de una vez a la
  // dirección para verificarla, y la conexión tiene que existir para contestarle.
  const c = previa
    ? await prisma.crmConexion.update({ where: { id: previa.id }, data: { modo: o.modo, nombre: datos.pageNombre, secretos, datos: json(datos), estado: 'pendiente', error: null } })
    : await prisma.crmConexion.create({ data: { tipo: 'pagina', modo: o.modo, nombre: datos.pageNombre, clave, secretos, datos: json(datos) } })

  let error: string | null = null
  try {
    if (o.modo === 'manual') {
      // 1. Los avisos de la app hacia esta conexión, sin pisar los de otro sistema.
      const llave = { token: `${o.appId}|${o.appSecret}` }
      const subs = await graph<{ data?: { object?: string; callback_url?: string; active?: boolean }[] }>(`/${o.appId}/subscriptions`, { cred: llave })
      const actual = (subs.data ?? []).find(s => s.object === 'page')
      if (actual && actual.active && actual.callback_url && actual.callback_url !== datos.webhookUrl) {
        datos.webhookApp = 'otro'
        error = 'Tu app de Meta ya manda los avisos de Messenger a otra dirección. Cámbiala por la del CRM en tu app (Webhooks, «Page») para que lleguen los mensajes'
      } else {
        await graph(`/${o.appId}/subscriptions`, { cred: llave, method: 'POST', query: { object: 'page', callback_url: datos.webhookUrl, verify_token: verifyToken, fields: CAMPOS_PAGINA, include_values: 'true' } })
        datos.webhookApp = 'propio'
      }
    }
    // 2. La app, suscrita a la página: sin esto no llega ningún mensaje.
    await graph(`/${encodeURIComponent(pageId)}/subscribed_apps`, { cred: { token: pageToken }, method: 'POST', query: { subscribed_fields: CAMPOS_PAGINA } })
  } catch (e) {
    error = porQueNoConecta(e, 'Las claves están bien, pero no se pudo configurar el aviso de mensajes en Meta').message
  }
  if (error) logger.warn(`[CRM páginas] ${c.id}: ${error}`)
  return prisma.crmConexion.update({
    where: { id: c.id },
    data: { estado: error ? 'error' : 'conectada', error, datos: json(datos) },
    include: { _count: { select: { lineas: true } } },
  })
}

// ─── Conexión manual ─────────────────────────────────────────────────────────

export type ResultadoPagina = { conexion: ConexionFront; paginas?: undefined } | { conexion?: undefined; paginas: { id: string; nombre: string }[] }

/**
 * Conecta una página con los datos de la app de la empresa. Si el token llega a varias páginas y
 * no se dijo cuál, devuelve la lista para elegir (sin guardar nada).
 */
export async function conectarPaginaManual(entrada: Json, baseApi: string, por: string | null): Promise<ResultadoPagina> {
  const appId = String(entrada.appId ?? '').trim()
  const appSecret = String(entrada.appSecret ?? '').trim()
  const token = String(entrada.token ?? '').replace(/\s+/g, '')
  const pageId = String(entrada.pageId ?? '').trim()
  if (!/^\d{5,30}$/.test(appId)) throw new ValidationError('El App ID son solo números: está arriba en el panel de tu app en developers.facebook.com')
  if (!/^[0-9a-f]{32}$/i.test(appSecret)) throw new ValidationError('La clave secreta de la app tiene 32 caracteres: está en Configuración de la app, Básica, «Clave secreta de la app»')
  if (token.length < 40) throw new ValidationError('Pega el token completo')
  if (pageId && !/^\d{5,30}$/.test(pageId)) throw new ValidationError('Elige la página que vas a conectar')

  let info: InfoToken
  try { info = await revisarToken(token, `${appId}|${appSecret}`) } catch (e) { throw porQueNoConecta(e, 'token') }
  if (!info.valido) throw new ValidationError('Ese token ya no es válido. Genera uno nuevo y vuelve a pegarlo')
  if (info.appId && info.appId !== appId) throw new ValidationError(`Ese token es de otra app de Meta (App ID ${info.appId}). Genera el token con la misma app`)
  const faltan = PERMISOS_FB.filter(p => !info.permisos.includes(p))
  if (faltan.length) throw new ValidationError(`Al token le faltan estos permisos: ${faltan.join(', ')}. Vuelve a generarlo marcándolos`)

  let paginas: PaginaMeta[]
  try { paginas = await paginasDelToken(token, info) } catch (e) { throw porQueNoConecta(e, 'No se pudieron leer las páginas del token') }
  if (!paginas.length) throw new ValidationError('El token no llega a ninguna página de Facebook. En la configuración del negocio de Meta, asígnale la página al usuario del sistema con control total')
  const elegida = pageId ? paginas.find(p => p.id === pageId) : paginas.length === 1 ? paginas[0] : null
  if (pageId && !elegida) throw new ValidationError('Esa página no está entre las del token')
  if (!elegida) return { paginas: paginas.map(p => ({ id: p.id, nombre: txt(p.name) || `Página ${p.id}` })) }

  const c = await guardarPagina({ modo: 'manual', appId, appSecret, pagina: elegida, permisos: info.permisos, vence: info.vence, baseApi })
  logger.info(`[CRM páginas] página ${elegida.id} conectada a mano (${c.estado}), por ${por}`)
  await emitirConexiones(por)
  return { conexion: conexionAFront(c) }
}

// ─── Con el botón de Meta ────────────────────────────────────────────────────

/** Termina Facebook Login for Business: cambia el código por el acceso y conecta todas las páginas que la empresa eligió. */
export async function conectarPaginasMeta(entrada: Json, baseApi: string, por: string | null): Promise<ConexionFront[]> {
  const p = await proveedorPaginas()
  if (!p) throw new AppError('El botón de Meta para páginas todavía no está configurado en la plataforma. Usa «Con los datos de tu app»', 409)
  const code = String(entrada.code ?? '').trim()
  if (!code) throw new ValidationError('Meta no devolvió el código de la conexión. Vuelve a intentarlo')
  let token: string
  try {
    const r = await graph<{ access_token?: string }>('/oauth/access_token', {
      cred: { token: `${p.appId}|${p.appSecret}` }, query: { client_id: p.appId, client_secret: p.appSecret, code },
    })
    token = String(r.access_token ?? '')
  } catch (e) { throw porQueNoConecta(e, 'Meta no aceptó la conexión') }
  if (!token) throw new AppError('Meta no entregó el acceso a las páginas', 502)

  let info: InfoToken
  try { info = await revisarToken(token, `${p.appId}|${p.appSecret}`) } catch (e) { throw porQueNoConecta(e, 'No se pudo revisar el acceso que dio Meta') }
  const faltan = PERMISOS_FB.filter(x => !info.permisos.includes(x))
  if (faltan.length) throw new ValidationError(`En la ventana de Meta no se dieron estos permisos: ${faltan.join(', ')}. Vuelve a conectar y acéptalos`)
  let paginas: PaginaMeta[]
  try { paginas = await paginasDelToken(token, info) } catch (e) { throw porQueNoConecta(e, 'No se pudieron leer las páginas') }
  if (!paginas.length) throw new ValidationError('No elegiste ninguna página en la ventana de Meta. Vuelve a conectar y marca la página de tu empresa')

  const hechas: ConexionFront[] = []
  let primerError: unknown = null
  for (const pagina of paginas) {
    try {
      hechas.push(conexionAFront(await guardarPagina({ modo: 'meta', appId: p.appId, pagina, permisos: info.permisos, vence: info.vence, baseApi })))
    } catch (e) {
      primerError ??= e
      logger.warn(`[CRM páginas] no se conectó la página ${pagina.id}: ${(e as Error).message}`)
    }
  }
  if (!hechas.length) throw primerError instanceof Error ? primerError : new AppError('No se pudo conectar ninguna página', 502)
  logger.info(`[CRM páginas] ${hechas.length} página(s) con el botón de Meta, por ${por}`)
  await emitirConexiones(por)
  return hechas
}

// ─── Revisar ─────────────────────────────────────────────────────────────────

/** Vuelve a mirar en Meta que el acceso a la página siga sirviendo y (en la manual) que sus avisos lleguen al CRM. */
export async function revisarPagina(id: string, por: string | null): Promise<ConexionFront> {
  const c = await prisma.crmConexion.findUnique({ where: { id } })
  if (!c || c.tipo !== 'pagina') throw new NotFoundError('Esa página no está conectada')
  const s = descifrar<{ token?: string; appSecret?: string }>(c.secretos)
  const datos = obj(c.datos) as DatosPagina
  let estado = 'conectada', error: string | null = null
  try {
    if (!s.token) throw new AppError('A esta conexión le faltan sus claves: vuelve a conectarla', 409)
    const llave = c.modo === 'manual' ? `${datos.appId}|${s.appSecret ?? ''}` : await proveedorPaginas().then(p => (p ? `${p.appId}|${p.appSecret}` : ''))
    if (!llave || llave.endsWith('|')) throw new AppError('La app de Meta de esta conexión ya no está configurada', 409)
    const info = await revisarToken(s.token, llave)
    if (!info.valido) throw new AppError('El acceso a la página ya no es válido: vuelve a conectarla', 409)
    datos.permisos = info.permisos
    datos.vence = info.vence || 0
    if (c.modo === 'manual' && datos.webhookUrl) {
      const subs = await graph<{ data?: { object?: string; callback_url?: string; active?: boolean }[] }>(`/${datos.appId}/subscriptions`, { cred: { token: llave } })
      const x = (subs.data ?? []).find(y => y.object === 'page')
      const ajeno = !x || !x.active || x.callback_url !== datos.webhookUrl
      datos.webhookApp = ajeno ? 'otro' : 'propio'
      if (ajeno) {
        estado = 'error'
        error = 'Los avisos de Messenger de tu app no llegan al CRM. En tu app de Meta, Webhooks, «Page», pon la dirección y el código de esta conexión'
      }
    }
  } catch (e) {
    estado = 'error'; error = porQueNoConecta(e, 'No se pudo revisar la conexión').message
  }
  const f = await prisma.crmConexion.update({
    where: { id }, data: { estado, error, datos: json(datos) }, include: { _count: { select: { lineas: true } } },
  })
  await emitirConexiones(por)
  return conexionAFront(f)
}

// ─── Perfil de la persona ────────────────────────────────────────────────────

/** Nombre (y @usuario en Instagram) de quien escribe. Si Meta no lo da, sigue sin nombre. */
export async function perfilDe(canal: 'fb' | 'ig', idPersona: string, token: string): Promise<{ nombre: string; usuario: string }> {
  try {
    if (canal === 'ig') {
      const r = await graph<{ name?: string; username?: string }>(`/${encodeURIComponent(idPersona)}`, { cred: { token }, base: baseInstagram(), query: { fields: 'name,username' } })
      return { nombre: txt(r.name), usuario: txt(r.username) ? `@${txt(r.username)}` : '' }
    }
    const r = await graph<{ first_name?: string; last_name?: string; name?: string }>(`/${encodeURIComponent(idPersona)}`, { cred: { token }, query: { fields: 'first_name,last_name' } })
    return { nombre: [txt(r.first_name), txt(r.last_name)].filter(Boolean).join(' ') || txt(r.name), usuario: '' }
  } catch (e) {
    logger.info(`[CRM páginas] sin perfil de ${canal} ${idPersona}: ${(e as Error).message}`)
    return { nombre: '', usuario: '' }
  }
}

/** El token de la página de una conexión (para leer perfiles y archivos). */
export function tokenDePagina(c: Pick<CrmConexion, 'secretos'>): string {
  try { return String(descifrar<{ token?: string }>(c.secretos).token ?? '') } catch { return '' }
}

// ─── Envío ───────────────────────────────────────────────────────────────────

/** Lo que el envío necesita del mensaje (el mismo include de enviarPorWhatsapp). */
export interface MsgPagina {
  id: string
  datos: unknown
  conversacion: {
    canal: string; contactoId: number; conexionId: string | null; ultimoEntranteAt: Date | null
    contacto: { fbId: string | null; igId: string | null }
  }
}

/** Los errores de Meta que más salen en estos canales, dichos para quien atiende. */
function explicarEnvio(e: ErrorMeta, canal: string): string {
  const n = nombreCanal(canal)
  const base = (t: string) => `${t} (Meta ${e.codigo || 'sin código'}${e.sub ? '/' + e.sub : ''}${e.textoMeta ? ': ' + e.textoMeta : ''})`
  if (e.sub === 2018278 || e.sub === 2534022) return base(`Pasaron más de 24 horas desde el último mensaje del cliente: ${n} no deja escribirle hasta que vuelva a escribir`)
  if (e.codigo === 551 || e.sub === 1545041) return base(`La persona no está disponible en ${n} (puede haber bloqueado la página o borrado la conversación)`)
  if (e.sub === 2018001 || e.sub === 2018108) return base(`${n} no encontró a la persona`)
  if (e.codigo === 190) return base(`El acceso a ${canal === 'ig' ? 'la cuenta de Instagram' : 'la página'} venció o no es válido: vuelve a conectarla en Ajustes del CRM, Canales`)
  if (e.codigo === 10 || e.codigo === 200) return base(`La app no tiene permiso para escribir por ${n}: revisa los permisos del token (${canal === 'ig' ? 'instagram_business_basic e instagram_business_manage_messages' : 'pages_messaging'})`)
  return e.message
}

/** Sin el formato de WhatsApp (*negrilla*, _cursiva_, ~tachado~): Messenger e Instagram mostrarían los signos. */
export function sinFormatoWa(t: string): string {
  return t.replace(/(^|[\s(¡¿"'])([*_~])(?!\s)([^\n*_~]*?\S)\2(?=$|[\s).,;:!?"'])/gm, '$1$3')
}

const MB = 1024 * 1024

/** Messenger: el archivo se sube a Meta con su tipo real (así los PDF de la Nube, que salen sin extensión, llegan bien). */
async function subirAdjunto(pageId: string, token: string, url: string, mimeDado: string, nombre: string): Promise<{ tipo: string; id: string }> {
  if (!archivoPermitido(url)) throw new ErrorEnvio('El archivo no está en la Nube del CRM: vuelve a adjuntarlo')
  let res: Response
  try { res = await fetch(url, { signal: AbortSignal.timeout(60_000) }) } catch (e) {
    throw new ErrorEnvio(`No se pudo descargar el archivo para enviarlo: ${(e as Error).name === 'TimeoutError' ? 'tardó demasiado' : (e as Error).message}`)
  }
  if (!res.ok) throw new ErrorEnvio(`No se pudo descargar el archivo para enviarlo (HTTP ${res.status})`)
  const buffer = Buffer.from(await res.arrayBuffer())
  if (buffer.length > 25 * MB) throw new ErrorEnvio(`El archivo pesa ${(buffer.length / MB).toFixed(1).replace('.', ',')} MB y Messenger acepta hasta 25 MB`)
  const mime = (mimeDado || res.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim().toLowerCase()
  const tipo = /^image\/(jpeg|png|gif)$/.test(mime) ? 'image' : mime.startsWith('video/') ? 'video' : mime.startsWith('audio/') ? 'audio' : 'file'
  const form = new FormData()
  form.append('message', JSON.stringify({ attachment: { type: tipo, payload: { is_reusable: true } } }))
  form.append('filedata', new Blob([buffer], { type: mime }), nombre || 'archivo')
  let r: Response
  try {
    r = await fetch(`${baseGraph()}/${encodeURIComponent(pageId)}/message_attachments`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form, signal: AbortSignal.timeout(90_000) })
  } catch (e) {
    throw new ErrorEnvio(`No se pudo subir el archivo a Messenger: ${(e as Error).message}`)
  }
  const d = await r.json().catch(() => ({})) as Json
  if (!r.ok || d.error || !d.attachment_id) throw new ErrorMeta(obj(d.error), r.ok ? 400 : r.status)
  return { tipo, id: String(d.attachment_id) }
}

/** Instagram: se manda por enlace (imagen, video o audio). Lo demás va como enlace en el texto. */
function tipoInstagram(url: string, mime: string): 'image' | 'video' | 'audio' | null {
  const m = mime.toLowerCase()
  if (/^image\/(jpeg|png)$/.test(m) || (!m && /\/image\/upload\//.test(url))) return 'image'
  if (m.startsWith('video/') || (!m && /\/video\/upload\/.+\.(mp4|mov|webm)(\?|$)/i.test(url))) return 'video'
  if (m.startsWith('audio/')) return 'audio'
  return null
}

const MAX_RESPUESTAS = 13
const MAX_TITULO = 20

/** Botones o lista del flujo → respuestas rápidas (hasta 13, título de 20). Devuelven el mismo id que en WhatsApp. */
function conRespuestasRapidas(texto: string, ops: OpcionLista[], maxTexto: number): Json {
  const usadas = ops.slice(0, MAX_RESPUESTAS)
  if (ops.length > MAX_RESPUESTAS) logger.warn(`[CRM páginas] ${ops.length} opciones; Messenger e Instagram permiten ${MAX_RESPUESTAS} y se mandan las primeras`)
  const vistos = new Set<string>(), ids = new Set<string>()
  const quick_replies = usadas.map((o, i) => {
    let title = recortar(o.t, MAX_TITULO, true) || 'Opción'
    for (let n = 2; vistos.has(title.toLowerCase()); n++) title = `${recortar(o.t, MAX_TITULO - String(n).length - 1, true)} ${n}`
    vistos.add(title.toLowerCase())
    let payload = (txt(o.id) || idDeOpcion(i, o.t)).slice(0, 1000)
    if (ids.has(payload)) payload = `${payload.slice(0, 990)}_${i + 1}`
    ids.add(payload)
    return { content_type: 'text', title, payload }
  })
  // Las descripciones de una lista de WhatsApp no caben en una respuesta rápida: van en el texto.
  const detalle = usadas.some(o => txt(o.d)) ? `\n\n${usadas.map(o => `• ${o.t}${txt(o.d) ? `: ${txt(o.d)}` : ''}`).join('\n')}` : ''
  return { text: recortar(`${texto || 'Elige una opción.'}${detalle}`, maxTexto), quick_replies }
}

/**
 * Envía por Messenger o Instagram un CrmMensaje de salida ya guardado. Lanza ErrorEnvio o
 * ErrorMeta si no sale; enviarPorWhatsapp deja el estado en la fila. Un archivo con texto sale
 * en dos mensajes (el archivo y después el texto): el primero queda como `waId` y el resto en
 * `extra`, para reconocer sus ecos.
 */
export async function enviarPorPagina(m: MsgPagina): Promise<{ mid: string; extra: string[] }> {
  const c = m.conversacion
  const canal = c.canal
  const n = nombreCanal(canal)
  // Messenger sale por la página (graph.facebook.com/{página}/messages); Instagram, por la cuenta con su
  // propio inicio de sesión (graph.instagram.com/me/messages, instagram.ts).
  const SIN = canal === 'ig' ? 'La cuenta de Instagram de esta conversación ya no está conectada al CRM: vuelve a conectarla en Ajustes del CRM, Canales' : SIN_PAGINA
  if (!c.conexionId) throw new ErrorEnvio(SIN)
  const cx = await prisma.crmConexion.findUnique({ where: { id: c.conexionId } })
  if (!cx || cx.tipo !== (canal === 'ig' ? 'instagram' : 'pagina')) throw new ErrorEnvio(SIN)
  const d = obj(cx.datos) as DatosPagina
  const token = canal === 'ig' ? await (await import('./instagram')).tokenInstagram(cx) : tokenDePagina(cx)
  if (!token) throw new ErrorEnvio(`${canal === 'ig' ? 'A la cuenta de Instagram' : 'A la página'} le faltan sus claves: vuelve a conectarla en Ajustes del CRM, Canales`)
  const destino = canal === 'ig' ? { ruta: '/me/messages', base: baseInstagram() } : { ruta: `/${encodeURIComponent(d.pageId)}/messages`, base: undefined }
  const para = canal === 'ig' ? c.contacto.igId : c.contacto.fbId
  if (!para) throw new ErrorEnvio(`El contacto no tiene cuenta de ${n}`)
  const datos = obj(m.datos)
  if (txt(datos.plantilla)) throw new ErrorEnvio(`Las plantillas son de WhatsApp: ${n} no las usa. Escríbele un mensaje normal mientras estén abiertas las 24 horas`)

  // Las 24 horas son de Meta por página y persona, no por conversación del CRM.
  const otra = await prisma.crmConversacion.aggregate({ where: { contactoId: c.contactoId, conexionId: c.conexionId, canal }, _max: { ultimoEntranteAt: true } })
  const entrante = Math.max(c.ultimoEntranteAt?.getTime() ?? 0, otra._max.ultimoEntranteAt?.getTime() ?? 0)
  if (!entrante || Date.now() - entrante > VEINTICUATRO_H) throw new ErrorEnvio(`Pasaron más de 24 horas desde el último mensaje del cliente: ${n} no deja escribirle hasta que vuelva a escribir`)

  const maxTexto = canal === 'ig' ? 1000 : 2000
  let texto = sinFormatoWa(txt(datos.out) || txt(datos.bot) || txt(datos.ia) || txt(datos.recepcion))
  const url = txt(obj(datos.link).url)
  if (url && !texto.includes(url)) texto = texto ? `${texto}\n${url}` : url

  const partes: Json[] = []
  const lista = obj(datos.lista)
  const archivo = obj(datos.file)
  const audio = obj(datos.audio)
  if (Array.isArray(datos.botones) && datos.botones.length) {
    const ops: OpcionLista[] = datos.botones.map((b: unknown) => (typeof b === 'string' ? { t: b } : { t: txt(obj(b).t) || txt(obj(b).title) || txt(obj(b).op), id: txt(obj(b).id) || undefined }))
      .filter((o: OpcionLista) => o.t)
    if (!ops.length) throw new ErrorEnvio('Los botones del mensaje están vacíos')
    partes.push(conRespuestasRapidas(texto, ops, maxTexto))
  } else if (Array.isArray(lista.ops) && lista.ops.length) {
    const ops = opcionesLista(lista)
    if (!ops.length) throw new ErrorEnvio('La lista del mensaje no tiene opciones')
    partes.push(conRespuestasRapidas(texto, ops, maxTexto))
  } else if (txt(archivo.url) || txt(audio.url)) {
    const esAudio = !txt(archivo.url)
    const fuente = esAudio ? audioParaWhatsapp(txt(audio.url), canal === 'ig' ? 'm4a' : 'mp3') : txt(archivo.url)
    const mime = esAudio ? (canal === 'ig' ? 'audio/mp4' : 'audio/mpeg') : txt(archivo.mime)
    const nombre = esAudio ? `nota-de-voz.${canal === 'ig' ? 'm4a' : 'mp3'}` : txt(archivo.n) || 'archivo'
    if (canal === 'fb') {
      const a = await subirAdjunto(d.pageId, token, fuente, mime, nombre)
      partes.push({ attachment: { type: a.tipo, payload: { attachment_id: a.id } } })
    } else {
      if (!archivoPermitido(fuente)) throw new ErrorEnvio('El archivo no está en la Nube del CRM: vuelve a adjuntarlo')
      const tipo = esAudio ? 'audio' : tipoInstagram(fuente, mime)
      // Instagram por enlace no recibe bien los documentos de la Nube (salen sin tipo): van como enlace.
      if (tipo) partes.push({ attachment: { type: tipo, payload: { url: fuente } } })
      else texto = texto ? `${texto}\n\n${nombre}: ${fuente}` : `${nombre}: ${fuente}`
    }
    if (texto) partes.push({ text: texto })
  } else {
    if (!texto) throw new ErrorEnvio('El mensaje está vacío')
    partes.push({ text: texto })
  }
  for (const p of partes) {
    if (typeof p.text === 'string' && p.text.length > maxTexto) throw new ErrorEnvio(`El mensaje pasa de ${maxTexto.toLocaleString('es-CO')} caracteres, el máximo de ${n}`)
  }

  const mids: string[] = []
  for (const message of partes) {
    let r: { message_id?: string }
    try {
      r = await graph<{ message_id?: string }>(destino.ruta, {
        cred: { token }, method: 'POST', base: destino.base, body: { recipient: { id: para }, ...(canal === 'ig' ? {} : { messaging_type: 'RESPONSE' }), message },
      })
    } catch (e) {
      // Si ya salió una parte, se dice: el cliente ya la tiene.
      const t = e instanceof ErrorMeta ? explicarEnvio(e, canal) : (e as Error).message
      throw new ErrorEnvio(mids.length ? `Salió el archivo, pero no el texto: ${t}` : t)
    }
    if (!r.message_id) throw new ErrorEnvio(`${n} no devolvió el id del mensaje`)
    mids.push(String(r.message_id))
  }
  return { mid: mids[0], extra: mids.slice(1) }
}
