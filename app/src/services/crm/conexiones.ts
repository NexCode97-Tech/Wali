import crypto from 'crypto'
import type { CrmConexion, Prisma } from '@prisma/client'
import type { Request } from 'express'
import { prisma, prismaGlobal } from './bd'
import { espacioActual } from './espacio'
import { cifrar, descifrar } from './cifrado'
import { ErrorMeta, graph, numerosDeWaba, revisarToken, numeroListo, calidadTexto, limiteTexto, estadoMetaTexto } from './whatsapp'
import { telDigitos, telVisible } from './formas'
import { emitirConv, emitirCrm } from './tiempoReal'
import { AppError, ConflictError, NotFoundError, ValidationError } from '../../utils/errors'
import { logger } from '../../utils/logger'
import { BASE } from '../../utils/base'

/**
 * Conexiones de WhatsApp que cada espacio hace desde el propio CRM. Dos caminos:
 *
 * - Manual: la empresa pega el App ID, la clave secreta de su app de Meta y el token de un
 *   usuario del sistema. El CRM revisa el token con la llave de esa app (así valida también la
 *   clave), le configura a la app el aviso de mensajes hacia la dirección propia de la conexión
 *   (`/api/crm/whatsapp/webhook/:clave`) y suscribe la app a cada cuenta de WhatsApp del token.
 *   Si la app ya manda sus avisos a otra parte (la línea de Alma, por ejemplo), no se toca: cada
 *   línea que se conecte se desvía sola a la dirección del CRM.
 * - Con el botón de Meta (registro integrado): la empresa inicia sesión en Meta desde el CRM y
 *   elige o crea su número; el CRM cambia el código que devuelve Meta por un token de la app
 *   proveedora (la de la plataforma, `proveedorMeta`). Los avisos llegan a la dirección general
 *   `/api/crm/whatsapp/webhook`, firmados con la clave de esa app.
 *
 * Las claves van cifradas (cifrado.ts) y nunca vuelven a la pantalla.
 */

type Json = Record<string, any>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})

/** Lo que el token necesita para atender por WhatsApp. */
const PERMISOS_WA = ['whatsapp_business_management', 'whatsapp_business_messaging']
/** Los avisos que el CRM usa: mensajes y estados, plantillas y calidad de las líneas. */
const CAMPOS_AVISOS = 'messages,message_template_status_update,message_template_quality_update,template_category_update,phone_number_quality_update'

export interface DatosWhatsapp {
  appId: string
  wabas: string[]
  /** El código que Meta repite al verificar la dirección de los avisos. No es secreto de acceso. */
  verifyToken: string
  /** Números conectados «Con tu app de WhatsApp Business» (coexistencia): siguen en la app del celular, sin PIN. */
  coex?: string[]
  /** propio: la app manda sus avisos a esta conexión. otro: la app ya tenía otra dirección; se desvía cada línea. */
  webhookApp?: 'propio' | 'otro'
  webhookUrl?: string
  vence?: number
  permisos?: string[]
}

// ─── Direcciones ─────────────────────────────────────────────────────────────

/** La dirección pública de este API: API_PUBLIC_URL si existe, o la de la petición (detrás del proxy de Railway). */
export function urlApi(req: Request): string {
  const propia = (process.env.API_PUBLIC_URL ?? '').trim().replace(/\/+$/, '')
  return propia || `${req.protocol}://${req.get('host')}${BASE}`
}
export const urlAvisosConexion = (baseApi: string, clave: string) => `${baseApi}/api/crm/whatsapp/webhook/${clave}`
export const urlAvisosGeneral = (baseApi: string) => `${baseApi}/api/crm/whatsapp/webhook`

const azar = (n: number) => crypto.randomBytes(n).toString('hex')

// ─── Lo que ve la pantalla ───────────────────────────────────────────────────

export interface ConexionFront {
  id: string; tipo: string; modo: string; nombre: string; estado: string; error: string | null
  appId: string | null; cuentas: number; lineas: number
  /** Messenger: la página de Facebook (paginas.ts). */
  pagina?: { id: string; nombre: string }
  /** Instagram: la cuenta profesional (instagram.ts). */
  instagram?: { id: string; usuario: string; nombre: string }
  /** Telegram: el bot (telegram.ts). TikTok: la cuenta (tiktok.ts). */
  bot?: { usuario: string; nombre: string }
  tiktok?: { usuario: string; autorizada: boolean }
  /** Correo: el buzón (correo.ts). */
  correo?: { direccion: string; remitente: string; proveedor: string; servidor: string; revisado: string | null }
  /** Solo en las manuales: lo que se pega en Meta si hubo que configurarlo a mano. */
  webhookUrl: string | null; verifyToken: string | null; webhookApp: string | null
  verificado: string | null; ultimoAviso: string | null; vence: string | null
}

export function conexionAFront(c: CrmConexion & { _count?: { lineas: number } }): ConexionFront {
  const d = obj(c.datos) as Partial<DatosWhatsapp>
  const dj = obj(c.datos)
  const manual = c.modo === 'manual'
  return {
    id: c.id, tipo: c.tipo, modo: c.modo, nombre: c.nombre, estado: c.estado, error: c.error,
    appId: d.appId ?? null, cuentas: (d.wabas ?? []).length, lineas: c._count?.lineas ?? 0,
    webhookUrl: manual ? d.webhookUrl ?? null : null, verifyToken: manual ? d.verifyToken ?? null : null, webhookApp: d.webhookApp ?? null,
    verificado: c.verificadoEn?.toISOString() ?? null, ultimoAviso: c.ultimoEventoEn?.toISOString() ?? null,
    vence: d.vence ? new Date(d.vence * 1000).toISOString() : null,
    ...(c.tipo === 'pagina' ? { pagina: { id: String(dj.pageId ?? ''), nombre: String(dj.pageNombre ?? '') } } : {}),
    ...(c.tipo === 'instagram' ? { instagram: { id: String(dj.igId ?? ''), usuario: String(dj.igUsuario ?? ''), nombre: String(dj.nombre ?? '') } } : {}),
    ...(c.tipo === 'telegram' ? { bot: { usuario: String(dj.usuario ?? ''), nombre: String(dj.nombre ?? '') } } : {}),
    ...(c.tipo === 'tiktok' ? { tiktok: { usuario: String(dj.usuario ?? ''), autorizada: !!dj.openId } } : {}),
    ...(c.tipo === 'correo' ? { correo: { direccion: String(dj.correo ?? ''), remitente: String(dj.remitente ?? ''), proveedor: String(dj.proveedor ?? ''), servidor: String(obj(dj.imap).host ?? ''), revisado: dj.revisado ?? null } } : {}),
  }
}

export async function listarConexiones(): Promise<ConexionFront[]> {
  const filas = await prisma.crmConexion.findMany({ orderBy: { createdAt: 'asc' }, include: { _count: { select: { lineas: true } } } })
  return filas.map(conexionAFront)
}

/**
 * Los canales conectados por conexión (Messenger, Instagram, Telegram, TikTok), sin nada de la
 * conexión: todos los ven (la barra lateral y la bandeja). Una cuenta de TikTok sin autorizar no cuenta.
 */
export async function canalesConectados() {
  const filas = await prisma.crmConexion.findMany({
    where: { tipo: { in: ['pagina', 'instagram', 'telegram', 'tiktok', 'correo'] }, estado: { not: 'desconectada' } },
    orderBy: { createdAt: 'asc' }, select: { id: true, tipo: true, nombre: true, estado: true, datos: true },
  })
  const canal: Record<string, string> = { pagina: 'fb', instagram: 'ig', telegram: 'tg', tiktok: 'tt', correo: 'mail' }
  return filas.filter(c => c.tipo !== 'tiktok' || obj(c.datos).openId).filter(c => c.tipo !== 'instagram' || obj(c.datos).igId)
    .map(c => ({ id: c.id, canal: canal[c.tipo], nombre: c.nombre, estado: c.estado }))
}

export async function emitirConexiones(por: string | null) {
  emitirCrm({ tipo: 'conexiones', conexiones: await listarConexiones() }, por)
  emitirCrm({ tipo: 'canales', canales: await canalesConectados() }, por)
}

// ─── Errores de Meta, dichos para quien conecta ──────────────────────────────

export function porQueNoConecta(e: unknown, paso: string): AppError {
  if (e instanceof ErrorMeta) {
    const codigo = e.codigo
    if (paso === 'token' && (codigo === 190 || codigo === 100 || codigo === 102 || codigo === 101)) {
      return new ValidationError('Meta no aceptó esos datos: revisa que el App ID y la clave secreta sean de la misma app, y que el token esté completo')
    }
    return new AppError(`${paso === 'token' ? 'No se pudo revisar el token' : paso}: ${e.message}`, e.statusCode)
  }
  return e instanceof AppError ? e : new AppError(`${paso}: ${(e as Error)?.message ?? e}`, 502)
}

// ─── Conexión manual ─────────────────────────────────────────────────────────

/** ¿Alguna de estas cuentas ya está en este espacio, pero por el otro camino (manual o botón de Meta)? Dos conexiones a la misma cuenta duplicarían los avisos. */
async function cuentaPorOtroCamino(wabas: string[], modo: 'manual' | 'meta'): Promise<boolean> {
  const otras = await prisma.crmConexion.findMany({ where: { tipo: 'whatsapp', modo: { not: modo } }, select: { datos: true } })
  return otras.some(c => (obj(c.datos).wabas ?? []).some((w: string) => wabas.includes(w)))
}

/** ¿Alguna de estas cuentas de WhatsApp ya está conectada en otro espacio? */
async function cuentaEnOtroEspacio(wabas: string[]): Promise<boolean> {
  for (const w of wabas) {
    const otra = await prismaGlobal.crmConexion.findFirst({
      where: { espacioId: { not: espacioActual() }, tipo: 'whatsapp', datos: { path: ['wabas'], array_contains: [w] } }, select: { id: true },
    })
    if (otra) return true
  }
  return false
}

/**
 * Conecta (o vuelve a conectar) la app de Meta de la empresa con sus propios datos. Si esa app ya
 * estaba conectada en el espacio, se actualizan sus claves y conserva su dirección de avisos.
 */
export async function conectarWhatsappManual(entrada: Json, baseApi: string, por: string | null): Promise<ConexionFront> {
  const appId = String(entrada.appId ?? '').trim()
  const appSecret = String(entrada.appSecret ?? '').trim()
  const token = String(entrada.token ?? '').replace(/\s+/g, '')
  const nombre = String(entrada.nombre ?? '').trim().slice(0, 60)
  if (!/^\d{5,30}$/.test(appId)) throw new ValidationError('El App ID son solo números: está arriba en el panel de tu app en developers.facebook.com')
  if (!/^[0-9a-f]{32}$/i.test(appSecret)) throw new ValidationError('La clave secreta de la app tiene 32 caracteres: está en Configuración de la app, Básica, «Clave secreta de la app»')
  if (token.length < 40) throw new ValidationError('Pega el token completo del usuario del sistema')

  let info
  try { info = await revisarToken(token, `${appId}|${appSecret}`) } catch (e) { throw porQueNoConecta(e, 'token') }
  if (!info.valido) throw new ValidationError('Ese token ya no es válido. Genera uno nuevo para el usuario del sistema y vuelve a pegarlo')
  if (info.appId && info.appId !== appId) throw new ValidationError(`Ese token es de otra app de Meta (App ID ${info.appId}). Genera el token con la misma app`)
  const faltan = PERMISOS_WA.filter(p => !info.permisos.includes(p))
  if (faltan.length) throw new ValidationError(`Al token le faltan estos permisos: ${faltan.join(', ')}. Vuelve a generarlo marcándolos`)
  // Con tokens de usuario del sistema Meta a veces no dice las cuentas (granular_scopes sin target_ids, aunque la cuenta
  // esté asignada): entonces se pide el identificador de la cuenta y se comprueba con el mismo token que la puede leer.
  let wabas = info.wabas
  const wabaPedida = String(entrada.wabaId ?? '').replace(/\D/g, '')
  if (!wabas.length && wabaPedida) {
    try { await numerosDeWaba(wabaPedida, { token }) } catch {
      throw new ValidationError('El token no tiene acceso a esa cuenta de WhatsApp. Revisa el identificador y que la cuenta esté asignada al usuario del sistema con control total', [{ field: 'wabaId', message: 'sin acceso' }])
    }
    wabas = [wabaPedida]
  }
  if (!wabas.length) throw new ValidationError('Meta no dice a qué cuenta de WhatsApp tiene acceso este token. Escribe el identificador de la cuenta de WhatsApp Business: está en tu app de Meta, en WhatsApp, Configuración de la API, junto al número', [{ field: 'wabaId', message: 'falta' }])
  if (await cuentaEnOtroEspacio(wabas)) throw new ConflictError('Esa cuenta de WhatsApp ya está conectada en otro espacio del CRM')
  if (await cuentaPorOtroCamino(wabas, 'manual')) throw new ConflictError('Esa cuenta de WhatsApp ya está conectada con el botón de Meta. Si quieres usar los datos de la app, desconéctala primero en Líneas de WhatsApp')

  const previa = (await prisma.crmConexion.findMany({ where: { tipo: 'whatsapp', modo: 'manual' } })).find(c => obj(c.datos).appId === appId)
  // Volver a conectar la misma app suma cuentas: las líneas de las que ya tenía siguen listándose y recibiendo avisos.
  if (previa) wabas = [...new Set([...((obj(previa.datos).wabas as string[] | undefined) ?? []), ...wabas])]
  const clave = previa?.clave ?? azar(24)
  const verifyToken = String(obj(previa?.datos).verifyToken ?? '') || azar(16)
  const webhookUrl = urlAvisosConexion(baseApi, clave)
  const datos: DatosWhatsapp = { appId, wabas, verifyToken, webhookUrl, vence: info.vence || 0, permisos: info.permisos }
  // Se guarda antes de pedirle nada a Meta: al configurar los avisos, Meta llama de una vez a la
  // dirección para verificarla, y la conexión tiene que existir para contestarle.
  const c = previa
    ? await prisma.crmConexion.update({ where: { id: previa.id }, data: { secretos: cifrar({ token, appSecret }), datos: datos as unknown as Prisma.InputJsonValue, estado: 'pendiente', error: null, ...(nombre ? { nombre } : {}) } })
    : await prisma.crmConexion.create({ data: { tipo: 'whatsapp', modo: 'manual', nombre: nombre || `App de Meta ${appId}`, clave, secretos: cifrar({ token, appSecret }), datos: datos as unknown as Prisma.InputJsonValue } })

  let error: string | null = null
  try {
    // 1. La dirección de los avisos de la app, sin pisar la de otro sistema (p. ej. la línea de Alma).
    const llave = { token: `${appId}|${appSecret}` }
    const subs = await graph<{ data?: { object?: string; callback_url?: string; active?: boolean }[] }>(`/${appId}/subscriptions`, { cred: llave })
    const actual = (subs.data ?? []).find(s => s.object === 'whatsapp_business_account')
    if (!actual || !actual.active || !actual.callback_url || actual.callback_url === webhookUrl) {
      await graph(`/${appId}/subscriptions`, { cred: llave, method: 'POST', query: { object: 'whatsapp_business_account', callback_url: webhookUrl, verify_token: verifyToken, fields: CAMPOS_AVISOS, include_values: 'true' } })
      datos.webhookApp = 'propio'
    } else {
      datos.webhookApp = 'otro'
    }
    // 2. La app, suscrita a cada cuenta de WhatsApp del token.
    for (const w of wabas) await graph(`/${encodeURIComponent(w)}/subscribed_apps`, { cred: { token }, method: 'POST' })
  } catch (e) {
    error = porQueNoConecta(e, 'Las claves están bien, pero no se pudo configurar el aviso de mensajes en Meta').message
    logger.warn(`[CRM conexiones] ${c.id}: ${error}`)
  }
  const final = await prisma.crmConexion.update({
    where: { id: c.id },
    data: { estado: error ? 'error' : 'conectada', error, datos: datos as unknown as Prisma.InputJsonValue },
    include: { _count: { select: { lineas: true } } },
  })
  logger.info(`[CRM conexiones] WhatsApp manual ${final.estado}: app ${appId}, ${wabas.length} cuenta(s)${wabaPedida && !info.wabas.length ? ' (dada a mano)' : ''}, por ${por}`)
  await emitirConexiones(por)
  return conexionAFront(final)
}

/**
 * Agrega otra cuenta de WhatsApp Business a una conexión que ya existe, para conectar sus números como líneas
 * nuevas. Meta no siempre lista en el token todas las cuentas asignadas al usuario del sistema (28-sep), así
 * que la persona da el identificador y se comprueba con el mismo token leyendo sus números.
 */
export async function agregarCuentaWhatsapp(id: string, entrada: unknown, por: string | null): Promise<ConexionFront> {
  const { c, datos, token } = await conexionConClaves(id)
  const waba = String(entrada ?? '').replace(/\D/g, '')
  if (!/^\d{5,30}$/.test(waba)) throw new ValidationError('Escribe el identificador de la cuenta de WhatsApp Business: son solo números y está en tu app de Meta, en WhatsApp, Configuración de la API')
  if ((datos.wabas ?? []).includes(waba)) throw new ValidationError('Esa cuenta de WhatsApp ya está en esta conexión: sus números libres ya salen en la lista')
  try { await numerosDeWaba(waba, { token }) } catch {
    throw new ValidationError('El token de esta conexión no tiene acceso a esa cuenta de WhatsApp. En la configuración del negocio de Meta, asígnala al usuario del sistema con control total')
  }
  if (await cuentaEnOtroEspacio([waba])) throw new ConflictError('Esa cuenta de WhatsApp ya está conectada en otro espacio del CRM')
  if (await cuentaPorOtroCamino([waba], c.modo === 'meta' ? 'meta' : 'manual')) throw new ConflictError('Esa cuenta de WhatsApp ya está conectada por el otro camino (botón de Meta o datos de la app)')
  try { await graph(`/${encodeURIComponent(waba)}/subscribed_apps`, { cred: { token }, method: 'POST' }) } catch (e) {
    throw porQueNoConecta(e, 'No se pudo suscribir la app a esa cuenta de WhatsApp')
  }
  const nuevos = { ...datos, wabas: [...(datos.wabas ?? []), waba] }
  const final = await prisma.crmConexion.update({ where: { id: c.id }, data: { datos: nuevos as unknown as Prisma.InputJsonValue }, include: { _count: { select: { lineas: true } } } })
  logger.info(`[CRM conexiones] ${c.id}: cuenta de WhatsApp agregada (${nuevos.wabas.length} en total), por ${por}`)
  await emitirConexiones(por)
  return conexionAFront(final)
}

// ─── Conexión con el botón de Meta (registro integrado) ─────────────────────

const CLAVES_PROVEEDOR = {
  appId: 'CRM_META_APP_ID', configId: 'CRM_META_CONFIG_ID', configPaginas: 'CRM_META_CONFIG_PAGINAS', secreto: 'CRM_META_APP_SECRET', verify: 'CRM_META_VERIFY',
} as const

export interface ProveedorMeta { appId: string; configId: string; appSecret: string; verifyToken: string }

/**
 * La app de Meta de la plataforma, sin importar para qué canal: su clave firma los avisos que
 * llegan a las direcciones generales. null si falta el App ID o la clave.
 */
export async function proveedorBase(): Promise<(ProveedorMeta & { configPaginas: string }) | null> {
  const filas = await prismaGlobal.configApp.findMany({ where: { clave: { in: Object.values(CLAVES_PROVEEDOR) } } })
  const v = (k: string) => filas.find(f => f.clave === k)?.valor ?? ''
  const appId = v(CLAVES_PROVEEDOR.appId), cifrada = v(CLAVES_PROVEEDOR.secreto)
  if (!appId || !cifrada) return null
  let appSecret = ''
  try { appSecret = String(descifrar<{ s?: string }>(cifrada).s ?? '') } catch { return null }
  if (!appSecret) return null
  return { appId, appSecret, configId: v(CLAVES_PROVEEDOR.configId), configPaginas: v(CLAVES_PROVEEDOR.configPaginas), verifyToken: v(CLAVES_PROVEEDOR.verify) }
}

/** La app de la plataforma para el botón «Conectar con Facebook» de WhatsApp. null si no está configurada. */
export async function proveedorMeta(): Promise<ProveedorMeta | null> {
  const p = await proveedorBase()
  return p && p.configId ? p : null
}

/** La misma app, con la configuración de Facebook Login for Business para páginas (Messenger e Instagram). */
export async function proveedorPaginas(): Promise<ProveedorMeta | null> {
  const p = await proveedorBase()
  return p && p.configPaginas ? { ...p, configId: p.configPaginas } : null
}

/** Lo que el CRM necesita saber del proveedor sin ver la clave. */
export async function proveedorPublico(baseApi: string) {
  const p = await proveedorBase()
  const filas = await prismaGlobal.configApp.findMany({ where: { clave: { in: [CLAVES_PROVEEDOR.verify, CLAVES_PROVEEDOR.appId, CLAVES_PROVEEDOR.configId, CLAVES_PROVEEDOR.configPaginas] } } })
  const v = (k: string) => filas.find(f => f.clave === k)?.valor ?? ''
  return {
    listo: !!(p && p.configId), listoPaginas: !!(p && p.configPaginas), conClave: !!p,
    appId: v(CLAVES_PROVEEDOR.appId), configId: v(CLAVES_PROVEEDOR.configId), configPaginas: v(CLAVES_PROVEEDOR.configPaginas),
    webhookUrl: urlAvisosGeneral(baseApi), webhookPaginas: `${baseApi}/api/crm/meta/webhook`, verifyToken: v(CLAVES_PROVEEDOR.verify),
  }
}

/** Solo el administrador de la plataforma: la app proveedora del botón de Meta. */
export async function guardarProveedor(entrada: Json) {
  const appId = String(entrada.appId ?? '').trim()
  const configId = String(entrada.configId ?? '').trim()
  const configPaginas = String(entrada.configPaginas ?? '').trim()
  const appSecret = String(entrada.appSecret ?? '').trim()
  if (!/^\d{5,30}$/.test(appId)) throw new ValidationError('El App ID son solo números')
  if (!configId && !configPaginas) throw new ValidationError('Falta el ID de configuración (config_id) de WhatsApp o el de páginas: salen de Facebook Login for Business, Configuraciones')
  if (configId && !/^\d{5,30}$/.test(configId)) throw new ValidationError('El ID de configuración de WhatsApp (config_id) son solo números: sale de Facebook Login for Business, Configuraciones')
  if (configPaginas && !/^\d{5,30}$/.test(configPaginas)) throw new ValidationError('El ID de configuración de páginas (config_id) son solo números: sale de Facebook Login for Business, Configuraciones')
  if (appSecret && !/^[0-9a-f]{32}$/i.test(appSecret)) throw new ValidationError('La clave secreta de la app tiene 32 caracteres')
  const actual = await proveedorBase()
  if (!appSecret && (!actual || actual.appId !== appId)) throw new ValidationError('Falta la clave secreta de la app')
  const verify = (await prismaGlobal.configApp.findUnique({ where: { clave: CLAVES_PROVEEDOR.verify } }))?.valor || azar(16)
  const poner = (clave: string, valor: string) => prismaGlobal.configApp.upsert({ where: { clave }, create: { clave, valor }, update: { valor } })
  await poner(CLAVES_PROVEEDOR.appId, appId)
  await poner(CLAVES_PROVEEDOR.configId, configId)
  await poner(CLAVES_PROVEEDOR.configPaginas, configPaginas)
  await poner(CLAVES_PROVEEDOR.verify, verify)
  if (appSecret) await poner(CLAVES_PROVEEDOR.secreto, cifrar({ s: appSecret }))
}

/**
 * Termina el registro integrado: cambia el código de Meta por el token de la empresa, suscribe la
 * app proveedora a su cuenta de WhatsApp y deja la conexión. El número se registra después, al
 * ponerle nombre y equipo (POST /crm/lineas), igual que en la conexión manual.
 */
export async function conectarWhatsappMeta(entrada: Json, por: string | null): Promise<ConexionFront & { phoneNumberId: string; wabaId: string }> {
  const p = await proveedorMeta()
  if (!p) throw new AppError('El botón de Meta todavía no está configurado en la plataforma. Usa «Con los datos de tu app»', 409)
  const code = String(entrada.code ?? '').trim()
  const wabaId = String(entrada.wabaId ?? '').trim()
  const phoneNumberId = String(entrada.phoneNumberId ?? '').trim()
  if (!code) throw new ValidationError('Meta no devolvió el código de la conexión. Vuelve a intentarlo')
  if (!/^\d{5,30}$/.test(wabaId)) throw new ValidationError('Meta no devolvió la cuenta de WhatsApp. Vuelve a intentarlo y elige la cuenta hasta el final')
  if (phoneNumberId && !/^\d{5,30}$/.test(phoneNumberId)) throw new ValidationError('Meta devolvió un número que no se reconoce')
  // «Con tu app de WhatsApp Business» (coexistencia): el número sigue en la app del celular; no se registra con PIN.
  const coexistencia = entrada.coexistencia === true
  if (coexistencia && !phoneNumberId) throw new ValidationError('Meta no devolvió el número de tu app de WhatsApp Business. Vuelve a intentarlo y escanea el QR hasta el final')

  let token: string
  try {
    const r = await graph<{ access_token?: string }>('/oauth/access_token', {
      cred: { token: `${p.appId}|${p.appSecret}` }, query: { client_id: p.appId, client_secret: p.appSecret, code },
    })
    token = String(r.access_token ?? '')
  } catch (e) { throw porQueNoConecta(e, 'Meta no aceptó la conexión') }
  if (!token) throw new AppError('Meta no entregó el acceso a la cuenta', 502)
  if (await cuentaEnOtroEspacio([wabaId])) throw new ConflictError('Esa cuenta de WhatsApp ya está conectada en otro espacio del CRM')
  if (await cuentaPorOtroCamino([wabaId], 'meta')) throw new ConflictError('Esa cuenta de WhatsApp ya está conectada con los datos de la app. Si quieres usar el botón de Meta, desconéctala primero en Líneas de WhatsApp')
  try {
    await graph(`/${wabaId}/subscribed_apps`, { cred: { token }, method: 'POST' })
  } catch (e) { throw porQueNoConecta(e, 'No se pudo suscribir el CRM a la cuenta de WhatsApp') }

  const previa = (await prisma.crmConexion.findMany({ where: { tipo: 'whatsapp', modo: 'meta' } })).find(c => (obj(c.datos).wabas ?? []).includes(wabaId))
  const coexAntes = previa ? (obj(previa.datos) as DatosWhatsapp).coex ?? [] : []
  const datos: DatosWhatsapp = { appId: p.appId, wabas: [wabaId], verifyToken: '', ...(coexistencia || coexAntes.length ? { coex: [...new Set([...coexAntes, ...(coexistencia ? [phoneNumberId] : [])])] } : {}) }
  const c = previa
    ? await prisma.crmConexion.update({ where: { id: previa.id }, data: { secretos: cifrar({ token }), datos: datos as unknown as Prisma.InputJsonValue, estado: 'conectada', error: null }, include: { _count: { select: { lineas: true } } } })
    : await prisma.crmConexion.create({
      data: { tipo: 'whatsapp', modo: 'meta', nombre: 'WhatsApp con Meta', clave: azar(24), estado: 'conectada', secretos: cifrar({ token }), datos: datos as unknown as Prisma.InputJsonValue },
      include: { _count: { select: { lineas: true } } },
    })
  logger.info(`[CRM conexiones] WhatsApp con el botón de Meta: cuenta ${wabaId}, por ${por}`)
  await emitirConexiones(por)
  return { ...conexionAFront(c), phoneNumberId, wabaId }
}

// ─── Números, revisión y desconexión ─────────────────────────────────────────

async function conexionConClaves(id: string) {
  const c = await prisma.crmConexion.findUnique({ where: { id } })
  if (!c || c.tipo !== 'whatsapp') throw new NotFoundError('Esa conexión de WhatsApp no existe')
  const s = descifrar<{ token?: string; appSecret?: string }>(c.secretos)
  if (!s.token) throw new AppError('A esta conexión le faltan sus claves: vuelve a conectarla', 409)
  return { c, datos: obj(c.datos) as DatosWhatsapp, token: s.token, appSecret: s.appSecret ?? '' }
}

/** Los números de las cuentas de WhatsApp de la conexión que todavía no están en ningún espacio. */
export async function numerosDisponibles(conexionId: string) {
  const { datos, token } = await conexionConClaves(conexionId)
  const conectadas = new Set((await prismaGlobal.crmLinea.findMany({ select: { phoneNumberId: true } })).map(l => l.phoneNumberId))
  const numeros: Json[] = []
  for (const waba of datos.wabas ?? []) {
    for (const n of await numerosDeWaba(waba, { token })) {
      if (conectadas.has(n.id)) continue
      numeros.push({
        phoneNumberId: n.id, wabaId: waba, tel: telVisible(telDigitos(n.display_phone_number)) || n.display_phone_number || '',
        nombre: n.verified_name ?? '', nombreEstado: n.name_status ?? '', ok: numeroListo(n), calidad: calidadTexto(n.quality_rating), limite: limiteTexto(n.messaging_limit_tier),
        estadoMeta: estadoMetaTexto(n),
      })
    }
  }
  return numeros
}

/** Vuelve a mirar en Meta que el token siga sirviendo. */
export async function revisarConexion(id: string, por: string | null): Promise<ConexionFront> {
  const { c, datos, token, appSecret } = await conexionConClaves(id)
  let estado = 'conectada', error: string | null = null
  try {
    const llave = c.modo === 'manual' ? `${datos.appId}|${appSecret}` : await proveedorMeta().then(p => (p ? `${p.appId}|${p.appSecret}` : ''))
    if (!llave) throw new AppError('El botón de Meta de la plataforma ya no está configurado', 409)
    const info = await revisarToken(token, llave)
    if (!info.valido) { estado = 'error'; error = 'El token ya no es válido: vuelve a conectar la app' }
    else {
      datos.wabas = [...new Set([...(datos.wabas ?? []), ...info.wabas])]
      datos.vence = info.vence || 0
    }
  } catch (e) {
    estado = 'error'; error = porQueNoConecta(e, 'No se pudo revisar la conexión').message
  }
  const f = await prisma.crmConexion.update({
    where: { id }, data: { estado, error, datos: datos as unknown as Prisma.InputJsonValue }, include: { _count: { select: { lineas: true } } },
  })
  await emitirConexiones(por)
  return conexionAFront(f)
}

/**
 * Quita la conexión y sus líneas del CRM. Las conversaciones se quedan (sin línea o sin página).
 * En Meta se desuscribe la app de las cuentas de WhatsApp o de la página, si se puede.
 */
export async function desconectar(id: string, por: string | null) {
  const c = await prisma.crmConexion.findUnique({ where: { id }, include: { lineas: { select: { id: true } } } })
  if (!c) throw new NotFoundError('Esa conexión no existe')
  try {
    const s = descifrar<{ token?: string }>(c.secretos)
    const d = obj(c.datos)
    if (s.token) for (const w of d.wabas ?? []) await graph(`/${encodeURIComponent(w)}/subscribed_apps`, { cred: { token: s.token }, method: 'DELETE' }).catch(() => null)
    if (s.token && c.tipo === 'pagina' && d.pageId) await graph(`/${encodeURIComponent(String(d.pageId))}/subscribed_apps`, { cred: { token: s.token }, method: 'DELETE' }).catch(() => null)
    if (c.tipo === 'instagram') await (await import('./instagram')).soltarInstagram(c)
    if (c.tipo === 'telegram') await (await import('./telegram')).soltarTelegram(c)
  } catch { /* sin claves que usar: se borra igual */ }
  // Las conversaciones abiertas de la página se quedan sin por dónde responder: la bandeja lo ve al instante.
  const vigentes = await prisma.crmConversacion.findMany({ where: { conexionId: id, estado: { not: 'finalizadas' } }, select: { id: true } })
  await prisma.crmConexion.delete({ where: { id } })
  for (const l of c.lineas) emitirCrm({ tipo: 'linea-borrada', id: l.id }, por)
  for (const v of vigentes) await emitirConv(v.id, por)
  await emitirConexiones(por)
  logger.info(`[CRM conexiones] ${c.id} desconectada por ${por}`)
}

/** La conexión dueña de una dirección de avisos, para el webhook (antes de saber el espacio). */
export async function conexionPorClave(clave: string) {
  if (!/^[0-9a-f]{48}$/.test(clave)) return null
  return prismaGlobal.crmConexion.findUnique({ where: { clave } })
}

export { conexionConClaves }
