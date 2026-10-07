import { Router, Request, Response } from 'express'
import { createHmac, timingSafeEqual } from 'crypto'
import { Prisma } from '@prisma/client'
import { prisma, prismaGlobal } from '../services/crm/bd'
import { requireRole } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import { ApiResponse } from '../utils/response'
import { CONFIGURAN } from '../utils/roles'
import { logger } from '../utils/logger'
import { AppError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors'
import { lineaAFront, telDigitos, telVisible } from '../services/crm/formas'
import { emitirConv, emitirCrm } from '../services/crm/tiempoReal'
import { procesarEventoGuardado } from '../services/crm/entrantes'
import { crearPlantilla, listarPlantillas } from '../services/crm/plantillas'
import { ErrorMeta, calidadTexto, graph, limiteTexto, numeroListo, numerosDeWaba } from '../services/crm/whatsapp'
import {
  agregarCuentaWhatsapp, conectarWhatsappManual, conectarWhatsappMeta, conexionConClaves, conexionPorClave, desconectar, guardarProveedor, listarConexiones,
  numerosDisponibles, proveedorBase, proveedorPublico, revisarConexion, urlApi, type DatosWhatsapp,
} from '../services/crm/conexiones'
import { conectarPaginaManual, conectarPaginasMeta, revisarPagina } from '../services/crm/paginas'
import { conectarInstagramManual, empezarInstagram, guardarProveedorInstagram, proveedorInstagramPublico, revisarInstagram, terminarInstagram } from '../services/crm/instagram'
import { conectarTelegram, revisarTelegram, secretoAvisosTelegram } from '../services/crm/telegram'
import { conectarCorreo, revisarCorreo } from '../services/crm/correo'
import {
  empezarTiktok, firmaTiktokValida, guardarProveedorTiktok, proveedorTiktokPublico, revisarTiktok, secretoAvisosTiktok, terminarTiktok,
} from '../services/crm/tiktok'
import { descifrar } from '../services/crm/cifrado'
import { enEspacio } from '../services/crm/espacio'
import { emitirConexiones as emitirConexionesDe } from '../services/crm/conexiones'

/**
 * WhatsApp Cloud API del CRM (26-sep-2026). Todo se conecta desde el CRM, sin variables del
 * servidor (services/crm/conexiones.ts).
 * - `webhookCrmWa`: público, montado en /api/crm/whatsapp con el cuerpo crudo para verificar la
 *   firma X-Hub-Signature-256. `/webhook` recibe lo de la app proveedora (botón de Meta);
 *   `/webhook/:clave`, lo de cada app conectada a mano, firmado con la clave de esa app.
 * - `webhookCrmMeta`: lo mismo para Messenger e Instagram, en /api/crm/meta.
 * - `rutasWaCrm`: conexiones, líneas y plantillas, dentro del router del CRM (con sesión).
 * Guía de operación: docs/crm/api-whatsapp.md.
 */
export const webhookCrmWa = Router()
/** Messenger e Instagram (services/crm/paginas.ts): las mismas dos direcciones en /api/crm/meta. */
export const webhookCrmMeta = Router()
export const rutasWaCrm = Router()

type Json = Record<string, any>

// ─── Webhook (público) ───────────────────────────────────────────────────────

function firmaValida(cuerpo: Buffer, cabecera: string | undefined, secreto: string): boolean {
  if (!cabecera || !cabecera.startsWith('sha256=') || !secreto) return false
  const esperada = createHmac('sha256', secreto).update(cuerpo).digest()
  const dada = Buffer.from(cabecera.slice(7), 'hex')
  return dada.length === esperada.length && timingSafeEqual(dada, esperada)
}

/** Guarda el aviso y lo procesa aparte. Lo que no se va a procesar igual recibe 200: si no, Meta lo reintenta durante días. */
async function recibirAviso(req: Request, res: Response, secreto: string, origen: { espacioId: string | null; conexionId: string | null }) {
  const crudo: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from('')
  if (!firmaValida(crudo, req.get('x-hub-signature-256'), secreto)) {
    logger.warn('[CRM Meta] aviso con firma que no cuadra: se ignora')
    // En una conexión propia queda dicho: casi siempre es la clave secreta de otra app.
    if (origen.conexionId) void prismaGlobal.crmConexion.update({ where: { id: origen.conexionId }, data: { error: 'Llegó un aviso de Meta con una firma que no cuadra con la clave secreta guardada: revisa que sea la de la misma app y vuelve a conectar' } }).catch(() => null)
    return res.sendStatus(200)
  }
  let cuerpo: Json
  try { cuerpo = JSON.parse(crudo.toString('utf8')) } catch { logger.warn('[CRM WA] aviso de Meta que no es JSON: se ignora'); return res.sendStatus(200) }
  return guardarAviso(res, cuerpo, origen)
}

/** Primero se guarda y después se responde: si la base no responde, el canal recibe 500 y lo vuelve a mandar. */
export async function guardarAviso(res: Response, cuerpo: Json, origen: { espacioId: string | null; conexionId: string | null }) {
  let evento: { id: string }
  try {
    evento = await prismaGlobal.crmWebhookEvento.create({ data: { cuerpo: cuerpo as Prisma.InputJsonValue, ...origen }, select: { id: true } })
  } catch (e) {
    logger.error(`[CRM WA] no se pudo guardar el aviso de Meta, que lo reintentará: ${(e as Error).message}`)
    return res.sendStatus(500)
  }
  res.sendStatus(200)
  setImmediate(() => { void procesarEventoGuardado(evento.id) })
}

/**
 * Las dos direcciones de avisos de un router: `/webhook` para la app proveedora (botón «Conectar
 * con Facebook»: su clave y su código de verificación viven en la plataforma) y `/webhook/:clave`
 * para cada app conectada a mano (su propio código y su propia clave secreta).
 */
function direccionesDeAvisos(r: Router) {
  r.get('/webhook', asyncHandler(async (req: Request, res: Response) => {
    const p = await proveedorBase()
    if (p && req.query['hub.mode'] === 'subscribe' && p.verifyToken && req.query['hub.verify_token'] === p.verifyToken) {
      return res.status(200).type('text/plain').send(String(req.query['hub.challenge'] ?? ''))
    }
    return res.sendStatus(403)
  }))

  r.post('/webhook', async (req: Request, res: Response) => {
    const p = await proveedorBase().catch(() => null)
    if (!p) { logger.warn('[CRM Meta] llegó un aviso a la dirección general, pero el botón de Meta no está configurado: no se procesa'); return res.sendStatus(200) }
    return recibirAviso(req, res, p.appSecret, { espacioId: null, conexionId: null })
  })

  r.get('/webhook/:clave', asyncHandler(async (req: Request, res: Response) => {
    const c = await conexionPorClave(String(req.params.clave))
    const verify = String((c?.datos as Json | undefined)?.verifyToken ?? '')
    if (c && verify && req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === verify) {
      await prismaGlobal.crmConexion.update({ where: { id: c.id }, data: { verificadoEn: new Date() } }).catch(() => null)
      return res.status(200).type('text/plain').send(String(req.query['hub.challenge'] ?? ''))
    }
    return res.sendStatus(403)
  }))

  r.post('/webhook/:clave', async (req: Request, res: Response) => {
    const c = await conexionPorClave(String(req.params.clave)).catch(() => null)
    if (!c) return res.sendStatus(404)
    let secreto = ''
    try { secreto = String(descifrar<{ appSecret?: string }>(c.secretos).appSecret ?? '') } catch (e) { logger.warn(`[CRM Meta] conexión ${c.id}: ${(e as Error).message}`) }
    if (!secreto) return res.sendStatus(200)
    void prismaGlobal.crmConexion.update({ where: { id: c.id }, data: { ultimoEventoEn: new Date() } }).catch(() => null)
    return recibirAviso(req, res, secreto, { espacioId: c.espacioId, conexionId: c.id })
  })
}
direccionesDeAvisos(webhookCrmWa)
direccionesDeAvisos(webhookCrmMeta)

// ─── Conexiones (con sesión) ─────────────────────────────────────────────────

const soloLideres = requireRole(...CONFIGURAN)

rutasWaCrm.get('/conexiones', asyncHandler(async (_req: Request, res: Response) => {
  return ApiResponse.success(res, await listarConexiones())
}))

rutasWaCrm.post('/conexiones/whatsapp', soloLideres, asyncHandler(async (req: Request, res: Response) => {
  return ApiResponse.created(res, await conectarWhatsappManual(req.body ?? {}, urlApi(req), req.userId ?? null))
}))

rutasWaCrm.post('/conexiones/whatsapp/meta', soloLideres, asyncHandler(async (req: Request, res: Response) => {
  return ApiResponse.created(res, await conectarWhatsappMeta(req.body ?? {}, req.userId ?? null))
}))

rutasWaCrm.post('/conexiones/:id/cuentas', soloLideres, asyncHandler(async (req: Request, res: Response) => {
  return ApiResponse.success(res, await agregarCuentaWhatsapp(String(req.params.id), (req.body ?? {}).wabaId, req.userId ?? null))
}))

rutasWaCrm.post('/conexiones/:id/revisar', soloLideres, asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id)
  const c = await prisma.crmConexion.findUnique({ where: { id }, select: { tipo: true } })
  if (!c) throw new NotFoundError('Esa conexión no existe')
  const por = req.userId ?? null
  const r = c.tipo === 'pagina' ? await revisarPagina(id, por)
    : c.tipo === 'instagram' ? await revisarInstagram(id, por)
    : c.tipo === 'telegram' ? await revisarTelegram(id, por)
    : c.tipo === 'tiktok' ? await revisarTiktok(id, por)
    : c.tipo === 'correo' ? await revisarCorreo(id, por)
    : await revisarConexion(id, por)
  return ApiResponse.success(res, r)
}))

/** Instagram con los datos de la app de Meta y el token de la cuenta. */
rutasWaCrm.post('/conexiones/instagram', soloLideres, asyncHandler(async (req: Request, res: Response) => {
  return ApiResponse.created(res, await conectarInstagramManual(req.body ?? {}, urlApi(req), req.userId ?? null))
}))

/** Instagram con el botón «Continuar con Instagram»: devuelve el enlace de la ventana de Instagram. */
rutasWaCrm.post('/conexiones/instagram/empezar', soloLideres, asyncHandler(async (req: Request, res: Response) => {
  return ApiResponse.success(res, await empezarInstagram(urlApi(req), req.userId ?? null))
}))

/** Correo: el buzón por IMAP y SMTP (Google con clave de aplicación u otro proveedor). */
rutasWaCrm.post('/conexiones/correo', soloLideres, asyncHandler(async (req: Request, res: Response) => {
  return ApiResponse.created(res, await conectarCorreo(req.body ?? {}, req.userId ?? null))
}))

/** Telegram: el token del bot de @BotFather. */
rutasWaCrm.post('/conexiones/telegram', soloLideres, asyncHandler(async (req: Request, res: Response) => {
  return ApiResponse.created(res, await conectarTelegram(req.body ?? {}, urlApi(req), req.userId ?? null))
}))

/** TikTok: deja la conexión esperando y devuelve el enlace de autorización de TikTok. */
rutasWaCrm.post('/conexiones/tiktok', soloLideres, asyncHandler(async (req: Request, res: Response) => {
  return ApiResponse.success(res, await empezarTiktok(req.body ?? {}, urlApi(req), req.userId ?? null))
}))

/** Las apps de la plataforma para los botones de Instagram y TikTok (sin claves). */
rutasWaCrm.get('/conexiones/proveedores', asyncHandler(async (req: Request, res: Response) => {
  return ApiResponse.success(res, { instagram: await proveedorInstagramPublico(urlApi(req)), tiktok: await proveedorTiktokPublico(urlApi(req)) })
}))

rutasWaCrm.put('/conexiones/proveedores/:canal', asyncHandler(async (req: Request, res: Response) => {
  if (!req.operador) throw new ForbiddenError('Solo el operador de la plataforma configura los botones de conexión')
  const canal = String(req.params.canal)
  if (canal === 'instagram') return ApiResponse.success(res, await guardarProveedorInstagram(req.body ?? {}, urlApi(req)))
  if (canal === 'tiktok') return ApiResponse.success(res, await guardarProveedorTiktok(req.body ?? {}, urlApi(req)))
  throw new NotFoundError('Ese canal no tiene botón de conexión')
}))

/** Instagram y Messenger con los datos de la app. Si el token llega a varias páginas, devuelve cuáles para elegir. */
rutasWaCrm.post('/conexiones/pagina', soloLideres, asyncHandler(async (req: Request, res: Response) => {
  const r = await conectarPaginaManual(req.body ?? {}, urlApi(req), req.userId ?? null)
  return r.conexion ? ApiResponse.created(res, r) : ApiResponse.success(res, r)
}))

/** Instagram y Messenger con el botón de Meta: conecta todas las páginas que se eligieron en la ventana de Meta. */
rutasWaCrm.post('/conexiones/pagina/meta', soloLideres, asyncHandler(async (req: Request, res: Response) => {
  return ApiResponse.created(res, await conectarPaginasMeta(req.body ?? {}, urlApi(req), req.userId ?? null))
}))

rutasWaCrm.delete('/conexiones/:id', soloLideres, asyncHandler(async (req: Request, res: Response) => {
  await desconectar(String(req.params.id), req.userId ?? null)
  return ApiResponse.success(res, { id: req.params.id })
}))

/** El botón de Meta: lo que el CRM necesita para abrirlo (sin la clave secreta). */
rutasWaCrm.get('/conexiones/proveedor', asyncHandler(async (req: Request, res: Response) => {
  return ApiResponse.success(res, await proveedorPublico(urlApi(req)))
}))

/** Configurar la app proveedora: solo el operador de la plataforma (cuenta con `operador`). */
rutasWaCrm.put('/conexiones/proveedor', asyncHandler(async (req: Request, res: Response) => {
  if (!req.operador) throw new ForbiddenError('Solo el operador de la plataforma configura el botón de Meta')
  await guardarProveedor(req.body ?? {})
  return ApiResponse.success(res, await proveedorPublico(urlApi(req)))
}))

// ─── Líneas (con sesión) ─────────────────────────────────────────────────────

rutasWaCrm.get('/lineas/disponibles', asyncHandler(async (req: Request, res: Response) => {
  const conexionId = typeof req.query.conexionId === 'string' ? req.query.conexionId : ''
  if (!conexionId) {
    const hay = await prisma.crmConexion.count({ where: { tipo: 'whatsapp' } })
    return ApiResponse.success(res, { configurado: hay > 0, numeros: [] })
  }
  return ApiResponse.success(res, { configurado: true, numeros: await numerosDisponibles(conexionId) })
}))

/** Un error de Meta en un paso de la conexión, con el paso al frente. */
const enPaso = (paso: string, e: unknown) => (e instanceof AppError ? new AppError(`${paso}: ${e.message}`, e.statusCode) : e)

rutasWaCrm.post('/lineas', soloLideres, asyncHandler(async (req: Request, res: Response) => {
  const b = (req.body ?? {}) as Json
  const conexionId = String(b.conexionId ?? '').trim()
  const phoneNumberId = String(b.phoneNumberId ?? '').trim()
  const wabaId = String(b.wabaId ?? '').trim()
  const nombre = String(b.nombre ?? '').trim()
  const equipo = String(b.equipo ?? '').trim() || 'Ventas'
  const pin = String(b.pin ?? '').trim()
  if (!conexionId) throw new ValidationError('Primero conecta la cuenta de WhatsApp de Meta')
  // Los id de Meta son números; basta con que no traigan nada que cambie la ruta de la Graph API.
  if (!/^\w{1,40}$/.test(phoneNumberId) || !/^\w{1,40}$/.test(wabaId)) throw new ValidationError('Elige el número que vas a conectar')
  if (!nombre) throw new ValidationError('Ponle un nombre a la línea')
  if (nombre.length > 60) throw new ValidationError('El nombre de la línea es demasiado largo')
  if (await prismaGlobal.crmLinea.findUnique({ where: { phoneNumberId } })) throw new ConflictError('Esa línea ya está conectada al CRM')

  const { c, datos, token } = await conexionConClaves(conexionId)
  // «Con tu app de WhatsApp Business» (coexistencia): el número ya está registrado por la app; no lleva PIN ni /register.
  const coex = b.coexistencia === true && ((datos as DatosWhatsapp).coex ?? []).includes(phoneNumberId)
  if (!coex && !/^\d{6}$/.test(pin)) throw new ValidationError('El PIN debe tener 6 dígitos')
  if (!(datos.wabas ?? []).includes(wabaId)) throw new ValidationError('Ese número no es de las cuentas de WhatsApp de esta conexión')
  const cred = { token }
  const n = (await numerosDeWaba(wabaId, cred).catch(e => { throw enPaso('No se pudo leer la cuenta de WhatsApp en Meta', e) })).find(x => x.id === phoneNumberId)
  if (!n) throw new ValidationError('Ese número no está en esa cuenta de WhatsApp de Meta, o el token no tiene acceso a ella')
  if (!numeroListo(n)) throw new ValidationError('El número no está verificado. Verifícalo por SMS en el administrador de WhatsApp de Meta y vuelve a intentar')

  // 1. Registrar el número en la API en la nube con el PIN de verificación en dos pasos (no en coexistencia).
  if (!coex) try {
    await graph(`/${phoneNumberId}/register`, { cred, method: 'POST', body: { messaging_product: 'whatsapp', pin } })
  } catch (e) {
    if (!(e instanceof ErrorMeta && /already registered|ya est[aá] registrad/i.test(`${e.textoMeta} ${e.message}`))) {
      throw enPaso('No se pudo registrar el número en Meta', e)
    }
  }
  // 2. Suscribir la app a la cuenta para que los mensajes lleguen al webhook.
  try {
    await graph(`/${wabaId}/subscribed_apps`, { cred, method: 'POST' })
  } catch (e) {
    throw enPaso('El número quedó registrado, pero no se pudo suscribir la app para recibir sus mensajes', e)
  }
  // 2b. Conexión manual cuya app ya mandaba sus avisos a otra parte: los de ESTE número se desvían
  // a la dirección de la conexión (override por número; Meta la verifica en el momento).
  const d = datos as DatosWhatsapp
  if (c.modo === 'manual' && d.webhookApp === 'otro' && d.webhookUrl && d.verifyToken) {
    try {
      await graph(`/${phoneNumberId}`, { cred, method: 'POST', body: { webhook_configuration: { override_callback_uri: d.webhookUrl, verify_token: d.verifyToken } } })
    } catch (e) {
      throw enPaso('El número quedó registrado, pero no se pudo apuntar su webhook al CRM', e)
    }
  }
  // 3. Guardar la línea (el PIN no se guarda).
  let linea
  try {
    linea = await prisma.crmLinea.create({
      data: {
        conexionId: c.id, nombre, telefono: telVisible(telDigitos(n.display_phone_number)) || n.display_phone_number || '', phoneNumberId, wabaId,
        estado: 'conectada', calidad: calidadTexto(n.quality_rating), limite: limiteTexto(n.messaging_limit_tier),
        ajustes: { equipo, llamadas: Boolean(b.llamadas), ...(coex ? { coex: true } : {}) },
      },
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictError('Esa línea ya está conectada al CRM')
    throw e
  }
  logger.info(`[CRM WA] línea conectada: ${linea.nombre} ${linea.telefono} por ${req.userId}${coex ? ' (con la app de WhatsApp Business)' : ''}`)
  // Coexistencia: Meta pide sincronizar en las primeras 24 horas los contactos de la app y su historial (6 meses).
  if (coex) {
    for (const sync_type of ['smb_app_state_sync', 'history']) {
      await graph(`/${phoneNumberId}/smb_app_data`, { cred, method: 'POST', body: { messaging_product: 'whatsapp', sync_type } })
        .catch(e => logger.warn(`[CRM WA] coexistencia ${phoneNumberId}: ${sync_type} sin sincronizar: ${(e as Error)?.message ?? e}`))
    }
  }
  const front = lineaAFront(linea)
  emitirCrm({ tipo: 'linea', linea: front }, req.userId ?? null)
  return ApiResponse.created(res, front)
}))

rutasWaCrm.patch('/lineas/:id', soloLideres, asyncHandler(async (req: Request, res: Response) => {
  const cambios = (req.body?.cambios ?? req.body ?? {}) as Json
  const actual = await prisma.crmLinea.findUnique({ where: { id: req.params.id } })
  if (!actual) throw new NotFoundError('Esa línea no existe')
  const data: Prisma.CrmLineaUpdateInput = {}
  if (cambios.nombre !== undefined) {
    const nombre = String(cambios.nombre ?? '').trim()
    if (!nombre) throw new ValidationError('Ponle un nombre a la línea')
    if (nombre.length > 60) throw new ValidationError('El nombre de la línea es demasiado largo')
    data.nombre = nombre
  }
  if (cambios.ajustes && typeof cambios.ajustes === 'object' && !Array.isArray(cambios.ajustes)) {
    data.ajustes = { ...(actual.ajustes as Json ?? {}), ...cambios.ajustes }
  }
  if (!Object.keys(data).length) throw new ValidationError('No hay nada que cambiar')
  const linea = await prisma.crmLinea.update({ where: { id: actual.id }, data })
  const front = lineaAFront(linea)
  emitirCrm({ tipo: 'linea', linea: front }, req.userId ?? null)
  return ApiResponse.success(res, front)
}))

rutasWaCrm.delete('/lineas/:id', soloLideres, asyncHandler(async (req: Request, res: Response) => {
  const actual = await prisma.crmLinea.findUnique({ where: { id: req.params.id } })
  if (!actual) throw new NotFoundError('Esa línea no existe')
  // Las conversaciones quedan con lineaId null (onDelete: SetNull). En Meta no se toca nada.
  const vigentes = await prisma.crmConversacion.findMany({ where: { lineaId: actual.id, estado: { not: 'finalizadas' } }, select: { id: true } })
  await prisma.crmLinea.delete({ where: { id: actual.id } })
  logger.info(`[CRM WA] línea quitada del CRM: ${actual.nombre} ${actual.telefono} por ${req.userId}`)
  emitirCrm({ tipo: 'linea-borrada', id: actual.id }, req.userId ?? null)
  // La bandeja las ve sin línea al instante (y ya no deja responderlas por esa línea).
  for (const c of vigentes) await emitirConv(c.id, req.userId ?? null)
  return ApiResponse.success(res, { id: actual.id })
}))

// ─── Plantillas ──────────────────────────────────────────────────────────────

rutasWaCrm.get('/plantillas', asyncHandler(async (_req: Request, res: Response) => {
  return ApiResponse.success(res, await listarPlantillas())
}))

rutasWaCrm.post('/plantillas', soloLideres, asyncHandler(async (req: Request, res: Response) => {
  return ApiResponse.created(res, await crearPlantilla(req.body ?? {}, req.userId ?? null))
}))

// ─── Telegram, TikTok y el regreso de las ventanas de autorización (públicos) ─

/** Telegram: cada bot tiene su dirección, y cada aviso trae el código secreto que se le dio al bot. */
export const webhookCrmTelegram = Router()
webhookCrmTelegram.post('/webhook/:clave', async (req: Request, res: Response) => {
  const c = await conexionPorClave(String(req.params.clave)).catch(() => null)
  if (!c || c.tipo !== 'telegram') return res.sendStatus(404)
  const secreto = secretoAvisosTelegram(c)
  const dado = String(req.get('x-telegram-bot-api-secret-token') ?? '')
  if (!secreto || dado.length !== secreto.length || !timingSafeEqual(Buffer.from(dado), Buffer.from(secreto))) {
    logger.warn(`[CRM tg] aviso sin el código secreto del bot ${c.id}: se ignora`)
    return res.sendStatus(200)
  }
  const cuerpo = (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) ? req.body as Json : (() => { try { return JSON.parse(String(req.body ?? '')) } catch { return {} } })()
  void prismaGlobal.crmConexion.update({ where: { id: c.id }, data: { ultimoEventoEn: new Date() } }).catch(() => null)
  return guardarAviso(res, cuerpo, { espacioId: c.espacioId, conexionId: c.id })
})

/** TikTok: firma TikTok-Signature con el Secret de la app (la de la empresa o la de la plataforma). */
export const webhookCrmTiktok = Router()
async function avisoTiktok(req: Request, res: Response, conexion: Awaited<ReturnType<typeof conexionPorClave>>) {
  const crudo: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from('')
  const secreto = await secretoAvisosTiktok(conexion)
  if (!firmaTiktokValida(crudo, req.get('tiktok-signature'), secreto)) { logger.warn('[CRM tt] aviso con firma que no cuadra: se ignora'); return res.sendStatus(200) }
  let cuerpo: Json
  try { cuerpo = JSON.parse(crudo.toString('utf8')) } catch { return res.sendStatus(200) }
  if (conexion) void prismaGlobal.crmConexion.update({ where: { id: conexion.id }, data: { ultimoEventoEn: new Date() } }).catch(() => null)
  return guardarAviso(res, cuerpo, { espacioId: conexion?.espacioId ?? null, conexionId: conexion?.id ?? null })
}
webhookCrmTiktok.post('/webhook', (req: Request, res: Response) => { void avisoTiktok(req, res, null) })
webhookCrmTiktok.post('/webhook/:clave', async (req: Request, res: Response) => {
  const c = await conexionPorClave(String(req.params.clave)).catch(() => null)
  if (!c || c.tipo !== 'tiktok') return res.sendStatus(404)
  return avisoTiktok(req, res, c)
})

/** La ventanita que se abre al autorizar: dice cómo terminó, avisa al CRM y se cierra sola. */
function paginaDeRegreso(res: Response, r: { ok: boolean; texto: string }, canal: string) {
  const datos = JSON.stringify({ tipo: 'crm-conexion', canal, ok: r.ok, texto: r.texto }).replace(/</g, '\\u003c')
  const esc = (t: string) => t.replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!))
  res.status(200).type('html').set('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'").send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Conexión</title>
<style>body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;background:#f6f7f9;color:#1f2937}main{background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:28px 32px;max-width:420px;text-align:center}b{display:block;font-size:18px;margin-bottom:8px;color:${r.ok ? '#047857' : '#b91c1c'}}</style></head>
<body><main><b>${r.ok ? 'Conectado' : 'No se pudo conectar'}</b><p>${esc(r.texto)}</p></main>
<script>try{if(window.opener){window.opener.postMessage(${datos},'*');${r.ok ? 'setTimeout(function(){window.close()},1500)' : ''}}}catch(e){}</script></body></html>`)
}

export const regresoCrm = Router()
regresoCrm.get('/tiktok/regreso', asyncHandler(async (req: Request, res: Response) => {
  const r = await terminarTiktok(req.query as Json, urlApi(req))
  if (r.ok && r.espacioId) await enEspacio(r.espacioId, () => emitirConexionesDe(null)).catch(() => null)
  return paginaDeRegreso(res, r, 'tiktok')
}))
regresoCrm.get('/instagram/regreso', asyncHandler(async (req: Request, res: Response) => {
  return paginaDeRegreso(res, await terminarInstagram(req.query as Json, urlApi(req)), 'instagram')
}))
