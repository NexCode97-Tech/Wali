import crypto from 'crypto'
import type { CrmConexion, Prisma } from '@prisma/client'
import { prisma, prismaGlobal } from './bd'
import { espacioActual } from './espacio'
import { cifrar, descifrar } from './cifrado'
import { baseInstagram, ErrorMeta, graph } from './whatsapp'
import { conexionAFront, emitirConexiones, porQueNoConecta, proveedorBase, type ConexionFront } from './conexiones'
import { urlAvisosPagina } from './paginas'
import { AppError, ConflictError, NotFoundError, ValidationError } from '../../utils/errors'
import { logger } from '../../utils/logger'

/**
 * Instagram del CRM, conectado solo: API de Instagram con inicio de sesión de Instagram, sin página de Facebook.
 * Una conexión `tipo: 'instagram'` es una cuenta profesional de Instagram (empresa o creador).
 *
 * - Manual: App ID y clave secreta de la app de Meta (la que firma los avisos) y el token de la
 *   cuenta que da la app (Instagram, Configuración de la API con inicio de sesión de Instagram,
 *   «Generar token»). El CRM revisa el token (`/me`), configura en la app los avisos del objeto
 *   `instagram` hacia `/api/crm/meta/webhook/:clave` y suscribe la cuenta (`/me/subscribed_apps`).
 * - Con el botón «Continuar con Instagram» (inicio de sesión para empresas de Instagram, con la
 *   app de Instagram de la plataforma): la ventana de Instagram vuelve a `/api/crm/instagram/regreso`.
 *
 * El token dura 60 días y el CRM lo renueva solo cuando tiene más de 30. Los mensajes entran y
 * salen igual que los de Messenger (entrantes.ts y `enviarPorPagina`), por graph.instagram.com.
 */

type Json = Record<string, any>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})
const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const azar = (n: number) => crypto.randomBytes(n).toString('hex')
const json = (v: unknown) => v as Prisma.InputJsonValue

const CAMPOS_APP = 'messages,messaging_postbacks,messaging_seen'
const TREINTA_DIAS = 30 * 86_400_000
export const baseInstagramOauth = () => (process.env.CRM_INSTAGRAM_OAUTH_URL || 'https://api.instagram.com').replace(/\/+$/, '')
export const urlRegresoInstagram = (baseApi: string) => `${baseApi}/api/crm/instagram/regreso`
const sinVersion = () => baseInstagram().replace(/\/v\d+\.\d+$/, '')

export interface DatosInstagram {
  appId: string
  igId: string
  igUsuario: string
  nombre?: string
  verifyToken: string
  webhookUrl?: string
  webhookApp?: 'propio' | 'otro'
  /** Cuándo se sacó o renovó el token (dura 60 días). */
  tokenDesde?: number
  estadoOauth?: string
  estadoVence?: number
  /** Conectada con el token corto (1 hora) porque Meta no dejó cambiarlo por el de 60 días: se reintenta solo. */
  tokenCorto?: boolean
  /** El id salió de la respuesta del token porque `/me` falló: se confirma con `/me` en el proceso de tokens. */
  igIdProvisional?: boolean
}

interface Yo { user_id?: string | number; id?: string; username?: string; name?: string; account_type?: string; provisional?: boolean }

/** Meta responde a veces «Unsupported request - method type: get» (código 100) en llamadas GET válidas, según la cuenta. */
const esFallaDeMetodo = (e: unknown) => e instanceof ErrorMeta && e.codigo === 100 && /unsupported request/i.test(e.textoMeta || e.message)

/** La cuenta del token. Con la falla de Meta se intenta sin versión y con menos campos; si tampoco, el id que dio Instagram al entregar el token. */
async function yo(token: string, idRespaldo = ''): Promise<Yo> {
  try {
    return await graph<Yo>('/me', { cred: { token }, base: baseInstagram(), query: { fields: 'user_id,username,name,account_type' } })
  } catch (e) {
    if (!esFallaDeMetodo(e)) throw e
    logger.warn(`[CRM instagram] /me con versión: ${(e as Error).message}`)
  }
  try {
    return await graph<Yo>('/me', { cred: { token }, base: sinVersion(), query: { fields: 'user_id,username' } })
  } catch (e) {
    if (!esFallaDeMetodo(e) || !idRespaldo) throw e
    logger.warn(`[CRM instagram] /me sin versión: ${(e as Error).message}`)
  }
  try {
    return await graph<Yo>(`/${idRespaldo}`, { cred: { token }, base: baseInstagram(), query: { fields: 'user_id,username,name,account_type' } })
  } catch (e) {
    if (!esFallaDeMetodo(e)) throw e
    logger.warn(`[CRM instagram] /${'{id}'} tampoco: ${(e as Error).message}; queda el id que dio Instagram, provisional`)
    return { user_id: idRespaldo, provisional: true }
  }
}

/** Token corto → token de 60 días. Si Meta da su falla de método, se intenta con la dirección con versión. */
async function tokenLargo(corto: string, secreto: string): Promise<string> {
  const q = { grant_type: 'ig_exchange_token', client_secret: secreto, access_token: corto }
  try {
    return txt((await graph<{ access_token?: string }>('/access_token', { cred: { token: corto }, base: sinVersion(), query: q })).access_token)
  } catch (e) {
    if (!esFallaDeMetodo(e)) throw e
    logger.warn(`[CRM instagram] token de 60 días sin versión: ${(e as Error).message}`)
  }
  return txt((await graph<{ access_token?: string }>('/access_token', { cred: { token: corto }, base: baseInstagram(), query: q })).access_token)
}

/** El token vigente de la cuenta, renovado si tiene más de 30 días (Instagram lo deja renovar mientras no venza). */
export async function tokenInstagram(c: CrmConexion): Promise<string> {
  const s = descifrar<{ token?: string; appSecret?: string }>(c.secretos)
  const d = obj(c.datos) as DatosInstagram
  if (!s.token) return ''
  if (d.tokenCorto) {
    // Conectada con el token corto: se vuelve a pedir el de 60 días (sirve mientras el corto no venza, una hora).
    const p = c.modo === 'meta' ? await proveedorInstagram() : null
    if (!p) return s.token
    try {
      const largo = await tokenLargo(s.token, p.appSecret)
      if (!largo) return s.token
      await prismaGlobal.crmConexion.update({ where: { id: c.id }, data: { secretos: cifrar({ ...s, token: largo }), datos: json({ ...d, tokenCorto: false, tokenDesde: Date.now() }) } })
      logger.info(`[CRM instagram] token de 60 días conseguido para @${d.igUsuario}`)
      return largo
    } catch (e) {
      logger.warn(`[CRM instagram] sigue sin el token de 60 días @${d.igUsuario}: ${(e as Error).message}`)
      return s.token
    }
  }
  if ((d.tokenDesde ?? 0) > Date.now() - TREINTA_DIAS) return s.token
  try {
    const r = await graph<{ access_token?: string }>('/refresh_access_token', { cred: { token: s.token }, base: sinVersion(), query: { grant_type: 'ig_refresh_token', access_token: s.token } })
    if (!r.access_token) return s.token
    await prismaGlobal.crmConexion.update({ where: { id: c.id }, data: { secretos: cifrar({ ...s, token: r.access_token }), datos: json({ ...d, tokenDesde: Date.now() }) } })
    logger.info(`[CRM instagram] token renovado de @${d.igUsuario}`)
    return r.access_token
  } catch (e) {
    logger.warn(`[CRM instagram] no se pudo renovar el token de @${d.igUsuario}: ${(e as Error).message}`)
    return s.token
  }
}

/** Revisa el token, guarda la cuenta y la suscribe a los avisos. `appSecret` solo en la manual. */
async function guardarCuenta(o: { modo: 'manual' | 'meta'; appId: string; appSecret?: string; token: string; baseApi: string; previaId?: string; igIdRespaldo?: string; tokenCorto?: boolean }): Promise<CrmConexion & { _count: { lineas: number } }> {
  let me: Yo
  try { me = await yo(o.token, o.igIdRespaldo) } catch (e) {
    throw e instanceof AppError && /190|OAuth|token/i.test(e.message) ? new ValidationError('Instagram no aceptó ese token: genéralo de nuevo en tu app (Instagram, Configuración de la API con inicio de sesión de Instagram, «Generar token») y pégalo completo') : e
  }
  const igId = String(me.user_id ?? '')
  if (!igId) throw new ValidationError('Instagram no dio el id de la cuenta: revisa que el token sea de una cuenta profesional')
  if (me.account_type && !['BUSINESS', 'MEDIA_CREATOR'].includes(String(me.account_type).toUpperCase())) {
    throw new ValidationError('Esa cuenta de Instagram es personal. Pásala a profesional (empresa o creador) en la app de Instagram y vuelve a conectarla')
  }
  const otra = await prismaGlobal.crmConexion.findFirst({ where: { espacioId: { not: espacioActual() }, tipo: 'instagram', datos: { path: ['igId'], equals: igId } }, select: { id: true } })
  if (otra) throw new ConflictError(`La cuenta @${me.username ?? igId} ya está conectada en otro espacio del CRM`)

  const previa = o.previaId ? await prisma.crmConexion.findUnique({ where: { id: o.previaId } }) : await prisma.crmConexion.findFirst({ where: { tipo: 'instagram', datos: { path: ['igId'], equals: igId } } })
  const repetida = o.previaId ? await prisma.crmConexion.findFirst({ where: { tipo: 'instagram', id: { not: o.previaId }, datos: { path: ['igId'], equals: igId } } }) : null
  const base = repetida ?? previa
  const clave = base?.clave ?? azar(24)
  const datos: DatosInstagram = {
    appId: o.appId, igId, igUsuario: txt(me.username), nombre: txt(me.name), verifyToken: txt(obj(base?.datos).verifyToken) || azar(16),
    ...(o.modo === 'manual' ? { webhookUrl: urlAvisosPagina(o.baseApi, clave) } : {}), tokenDesde: Date.now(),
    ...(o.tokenCorto ? { tokenCorto: true } : {}),
    ...(me.provisional ? { igIdProvisional: true } : {}),
  }
  const nombre = datos.igUsuario ? `@${datos.igUsuario}` : datos.nombre || 'Instagram'
  const secretos = cifrar(o.modo === 'manual' ? { token: o.token, appSecret: o.appSecret } : { token: o.token })
  // Se guarda antes de configurar los avisos: Meta verifica la dirección en ese momento.
  const c = base
    ? await prisma.crmConexion.update({ where: { id: base.id }, data: { modo: o.modo, nombre, secretos, datos: json(datos), estado: 'pendiente', error: null } })
    : await prisma.crmConexion.create({ data: { tipo: 'instagram', modo: o.modo, nombre, clave, secretos, datos: json(datos) } })
  if (repetida && previa && previa.id !== repetida.id) await prisma.crmConexion.delete({ where: { id: previa.id } }).catch(() => null)

  let error: string | null = null
  try {
    if (o.modo === 'manual') {
      const llave = { token: `${o.appId}|${o.appSecret}` }
      const subs = await graph<{ data?: { object?: string; callback_url?: string; active?: boolean }[] }>(`/${o.appId}/subscriptions`, { cred: llave })
      const actual = (subs.data ?? []).find(s => s.object === 'instagram')
      if (actual && actual.active && actual.callback_url && actual.callback_url !== datos.webhookUrl) {
        datos.webhookApp = 'otro'
        error = 'Tu app de Meta ya manda los avisos de Instagram a otra dirección. Cámbiala por la del CRM en tu app (Webhooks, «Instagram») para que lleguen los mensajes'
      } else {
        await graph(`/${o.appId}/subscriptions`, { cred: llave, method: 'POST', query: { object: 'instagram', callback_url: datos.webhookUrl, verify_token: datos.verifyToken, fields: CAMPOS_APP, include_values: 'true' } })
        datos.webhookApp = 'propio'
      }
    }
    // La cuenta, suscrita a la app: sin esto no llega ningún mensaje.
    await graph('/me/subscribed_apps', { cred: { token: o.token }, base: baseInstagram(), method: 'POST', query: { subscribed_fields: CAMPOS_APP } })
  } catch (e) {
    error = porQueNoConecta(e, 'La cuenta está bien, pero no se pudo configurar el aviso de mensajes en Meta').message
  }
  if (error) logger.warn(`[CRM instagram] ${c.id}: ${error}`)
  return prisma.crmConexion.update({ where: { id: c.id }, data: { estado: error ? 'error' : 'conectada', error, datos: json(datos) }, include: { _count: { select: { lineas: true } } } })
}

/** Conecta la cuenta con los datos de la app de Meta de la empresa y el token de la cuenta. */
export async function conectarInstagramManual(entrada: Json, baseApi: string, por: string | null): Promise<ConexionFront> {
  const appId = String(entrada.appId ?? '').trim()
  const appSecret = String(entrada.appSecret ?? '').trim()
  const token = String(entrada.token ?? '').replace(/\s+/g, '')
  if (!/^\d{5,30}$/.test(appId)) throw new ValidationError('El App ID son solo números: está arriba en el panel de tu app en developers.facebook.com')
  if (!/^[0-9a-f]{32}$/i.test(appSecret)) throw new ValidationError('La clave secreta de la app tiene 32 caracteres: está en Configuración de la app, Básica, «Clave secreta de la app»')
  if (token.length < 40) throw new ValidationError('Pega el token completo de la cuenta de Instagram')
  // La clave firma los avisos: se revisa con la llave de la app antes de guardar nada.
  try { await graph(`/${appId}/subscriptions`, { cred: { token: `${appId}|${appSecret}` } }) } catch (e) {
    throw porQueNoConecta(e, 'token')
  }
  const c = await guardarCuenta({ modo: 'manual', appId, appSecret, token, baseApi })
  logger.info(`[CRM instagram] @${obj(c.datos).igUsuario} conectada a mano (${c.estado}), por ${por}`)
  await emitirConexiones(por)
  return conexionAFront(c)
}

// ─── Con el botón «Continuar con Instagram» ──────────────────────────────────

const CLAVES = { appId: 'CRM_IG_APP_ID', secreto: 'CRM_IG_APP_SECRET' } as const

/** La app de Instagram de la plataforma (inicio de sesión para empresas de Instagram). */
export async function proveedorInstagram(): Promise<{ appId: string; appSecret: string } | null> {
  const filas = await prismaGlobal.configApp.findMany({ where: { clave: { in: Object.values(CLAVES) } } })
  const v = (k: string) => filas.find(f => f.clave === k)?.valor ?? ''
  if (!v(CLAVES.appId) || !v(CLAVES.secreto)) return null
  try { const s = String(descifrar<{ s?: string }>(v(CLAVES.secreto)).s ?? ''); return s ? { appId: v(CLAVES.appId), appSecret: s } : null } catch { return null }
}

export async function proveedorInstagramPublico(baseApi: string) {
  const p = await proveedorInstagram()
  const id = (await prismaGlobal.configApp.findUnique({ where: { clave: CLAVES.appId } }))?.valor ?? ''
  return { listo: !!p && !!(await proveedorBase()), appId: id, regreso: urlRegresoInstagram(baseApi) }
}

export async function guardarProveedorInstagram(entrada: Json, baseApi: string) {
  const appId = String(entrada.appId ?? '').trim(), appSecret = String(entrada.appSecret ?? '').trim()
  if (!/^\d{5,30}$/.test(appId)) throw new ValidationError('El identificador de la app de Instagram son solo números')
  const actual = await proveedorInstagram()
  if (!appSecret && (!actual || actual.appId !== appId)) throw new ValidationError('Falta la clave secreta de la app de Instagram')
  if (appSecret && !/^[0-9a-f]{32}$/i.test(appSecret)) throw new ValidationError('La clave secreta de la app de Instagram tiene 32 caracteres')
  const poner = (clave: string, valor: string) => prismaGlobal.configApp.upsert({ where: { clave }, create: { clave, valor }, update: { valor } })
  await poner(CLAVES.appId, appId)
  if (appSecret) await poner(CLAVES.secreto, cifrar({ s: appSecret }))
  return proveedorInstagramPublico(baseApi)
}

/** Deja la conexión esperando y devuelve el enlace de la ventana de Instagram. */
export async function empezarInstagram(baseApi: string, por: string | null): Promise<{ url: string }> {
  const p = await proveedorInstagram()
  if (!p) throw new AppError('El botón de Instagram todavía no está configurado en la plataforma. Usa «Con los datos de tu app de Meta»', 409)
  const nonce = azar(12)
  const pendiente = (await prisma.crmConexion.findMany({ where: { tipo: 'instagram', modo: 'meta' } })).find(c => !obj(c.datos).igId)
  const datos = { appId: p.appId, igId: '', igUsuario: '', verifyToken: '', estadoOauth: nonce, estadoVence: Date.now() + 15 * 60_000 }
  const c = pendiente
    ? await prisma.crmConexion.update({ where: { id: pendiente.id }, data: { datos: json(datos), estado: 'pendiente', error: null } })
    : await prisma.crmConexion.create({ data: { tipo: 'instagram', modo: 'meta', nombre: 'Instagram', clave: azar(24), secretos: cifrar({}), datos: json(datos) } })
  const u = new URL('https://www.instagram.com/oauth/authorize')
  u.searchParams.set('client_id', p.appId)
  u.searchParams.set('redirect_uri', urlRegresoInstagram(baseApi))
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('scope', 'instagram_business_basic,instagram_business_manage_messages')
  u.searchParams.set('state', `${c.clave}.${nonce}`)
  logger.info(`[CRM instagram] inicio de sesión empezado por ${por}`)
  return { url: u.toString() }
}

/** Instagram vuelve aquí con el código (público; el `state` dice qué conexión es). */
export async function terminarInstagram(query: Json, baseApi: string): Promise<{ ok: boolean; texto: string; espacioId?: string }> {
  const [clave, nonce] = String(query.state ?? '').split('.')
  const c = /^[0-9a-f]{48}$/.test(clave ?? '') ? await prismaGlobal.crmConexion.findUnique({ where: { clave } }) : null
  const d = obj(c?.datos)
  if (!c || c.tipo !== 'instagram' || !nonce || d.estadoOauth !== nonce) return { ok: false, texto: 'Esta autorización ya no sirve: vuelve a intentarlo desde el CRM' }
  if ((d.estadoVence ?? 0) < Date.now()) return { ok: false, texto: 'Pasaron más de 15 minutos: vuelve a intentarlo desde el CRM' }
  const code = String(query.code ?? '').replace(/#_$/, '')
  if (query.error || !code) return { ok: false, texto: `Instagram no terminó la conexión${query.error_description ? `: ${query.error_description}` : ''}` }
  const p = await proveedorInstagram()
  if (!p) return { ok: false, texto: 'El botón de Instagram ya no está configurado en la plataforma' }
  try {
    // 1. Código → token corto.
    const res = await fetch(`${baseInstagramOauth()}/oauth/access_token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: p.appId, client_secret: p.appSecret, grant_type: 'authorization_code', redirect_uri: urlRegresoInstagram(baseApi), code }),
      signal: AbortSignal.timeout(30_000),
    })
    const corto = await res.json().catch(() => ({})) as Json
    const t1 = txt(corto.access_token) || txt(obj(corto.data?.[0]).access_token)
    const igIdRespaldo = String(corto.user_id ?? obj(corto.data?.[0]).user_id ?? '')
    if (!res.ok || !t1) return { ok: false, texto: `Instagram no aceptó la conexión: ${txt(corto.error_message) || txt(obj(corto.error).message) || `HTTP ${res.status}`}` }
    // 2. Token corto → token de 60 días.
    // Si Meta no lo deja (su falla de método), se conecta con el corto y el proceso de tokens lo vuelve a pedir.
    let largo = ''
    try { largo = await tokenLargo(t1, p.appSecret) } catch (e) {
      if (!esFallaDeMetodo(e)) throw e
      logger.warn(`[CRM instagram] sin token de 60 días al conectar, queda el corto: ${(e as Error).message}`)
    }
    const token = largo || t1
    const hecha = await import('./espacio').then(m => m.enEspacio(c.espacioId, () => guardarCuenta({ modo: 'meta', appId: p.appId, token, baseApi, previaId: c.id, igIdRespaldo, tokenCorto: !largo })))
    await import('./espacio').then(m => m.enEspacio(c.espacioId, () => emitirConexiones(null)))
    const u = obj(hecha.datos).igUsuario
    return { ok: true, texto: hecha.estado === 'error' ? `La cuenta quedó conectada, pero falta un paso: ${hecha.error}` : `Listo: ${u ? `@${u}` : 'la cuenta de Instagram'} quedó conectada. Ya puedes cerrar esta ventana.`, espacioId: c.espacioId }
  } catch (e) {
    logger.warn(`[CRM instagram] no se pudo terminar la conexión ${c.id}: ${(e as Error).message}`)
    return { ok: false, texto: `No se pudo conectar la cuenta: ${(e as Error).message}` }
  }
}

// ─── Revisar ─────────────────────────────────────────────────────────────────

export async function revisarInstagram(id: string, por: string | null): Promise<ConexionFront> {
  const c = await prisma.crmConexion.findUnique({ where: { id } })
  if (!c || c.tipo !== 'instagram') throw new NotFoundError('Esa cuenta de Instagram no está conectada')
  const d = obj(c.datos) as DatosInstagram
  let estado = 'conectada', error: string | null = null
  try {
    const token = await tokenInstagram(c)
    if (!token) throw new AppError('A la cuenta le faltan sus claves: vuelve a conectarla', 409)
    const me = await yo(token, d.igId)
    if (!me.provisional && d.igIdProvisional) {
      await prisma.crmConexion.update({ where: { id }, data: { datos: json({ ...d, igId: String(me.user_id ?? d.igId), igUsuario: txt(me.username) || d.igUsuario, igIdProvisional: false }) } })
      d.igId = String(me.user_id ?? d.igId)
    }
    if (String(me.user_id ?? '') !== d.igId) throw new AppError('El token ya no es de la misma cuenta: vuelve a conectarla', 409)
    if (c.modo === 'manual' && d.webhookUrl) {
      const s = descifrar<{ appSecret?: string }>(c.secretos)
      const subs = await graph<{ data?: { object?: string; callback_url?: string; active?: boolean }[] }>(`/${d.appId}/subscriptions`, { cred: { token: `${d.appId}|${s.appSecret ?? ''}` } })
      const x = (subs.data ?? []).find(y => y.object === 'instagram')
      if (!x || !x.active || x.callback_url !== d.webhookUrl) {
        estado = 'error'
        error = 'Los avisos de Instagram de tu app no llegan al CRM. En tu app de Meta, Webhooks, «Instagram», pon la dirección y el código de esta conexión'
      }
    }
  } catch (e) { estado = 'error'; error = porQueNoConecta(e, 'No se pudo revisar la cuenta').message }
  const f = await prisma.crmConexion.update({ where: { id }, data: { estado, error }, include: { _count: { select: { lineas: true } } } })
  await emitirConexiones(por)
  return conexionAFront(f)
}

/** Al desconectar: la cuenta deja de mandar sus avisos a la app. */
export async function soltarInstagram(c: CrmConexion): Promise<void> {
  try {
    const s = descifrar<{ token?: string }>(c.secretos)
    if (s.token) await graph('/me/subscribed_apps', { cred: { token: s.token }, base: baseInstagram(), method: 'DELETE' })
  } catch (e) { logger.info(`[CRM instagram] no se pudo desuscribir ${c.id}: ${(e as Error).message}`) }
}

const enEspacioDe = <T>(c: CrmConexion, f: () => Promise<T>) => import('./espacio').then(m => m.enEspacio(c.espacioId, f))

/** Cada día: los tokens con más de 30 días se renuevan aunque la cuenta no haya escrito (así no vencen a los 60). */
export async function renovarTokensInstagram(): Promise<number> {
  const filas = await prismaGlobal.crmConexion.findMany({ where: { tipo: 'instagram', estado: { not: 'desconectada' } } })
  let n = 0
  for (const c of filas) {
    const d = obj(c.datos) as DatosInstagram
    if (d.igIdProvisional) await enEspacioDe(c, () => revisarInstagram(c.id, null)).catch(() => null)
    if (!d.tokenCorto && (d.tokenDesde ?? 0) > Date.now() - TREINTA_DIAS) continue
    await tokenInstagram(c).then(() => { n++ }).catch(() => null)
  }
  return n
}
