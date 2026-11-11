import { Router, type Request, type Response, type NextFunction } from 'express'
import multer from 'multer'
import rateLimit from 'express-rate-limit'
import { authenticate, requireRole } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import { configura } from '../utils/roles'
import { AppError, ForbiddenError, ValidationError } from '../utils/errors'
import { cambiarPedir, nuevaVersion, resumenTerminos } from '../services/crm/terminos'
import { enEspacio } from '../services/crm/espacio'
import { borrarGrabacion, direccionDe, grabacionPorId, listarGrabaciones, puedeVerGrabaciones, subirGrabacion } from '../services/crm/grabaciones'
import { convVisible, nombreArchivo, subirACloudinary } from '../controllers/crm/_comun'
import { logger } from '../utils/logger'
import { rutasWaCrm } from './crmWhatsapp'
import { rutasIaCrm } from './crmIa'
import { rutasEncuestaCrm } from './crmEncuesta'
import { rutasAyudaCrm } from './crmAyuda'
import * as conv from '../controllers/crm/conversaciones.controller'
import * as llamadas from '../controllers/crm/llamadas.controller'
import * as difusiones from '../controllers/crm/difusiones.controller'
import * as contactos from '../controllers/crm/contactos.controller'
import * as spam from '../controllers/crm/spam.controller'
import * as ajustes from '../controllers/crm/ajustes.controller'
import { catalogo } from '../controllers/crm/catalogo.controller'
import { informes } from '../controllers/crm/informes.controller'
import { menciones } from '../controllers/crm/menciones.controller'
import { conEspacio, usuariosDeEspacio } from '../services/crm/espacio'
import { accesoCrm, alcanceDe } from '../services/crm/alcance'
import { borrarEnlace, crearEnlace, editarEnlace, listarEnlaces } from '../services/crm/enlaces'
import { ApiResponse } from '../utils/response'
import { z } from 'zod'
import * as webhooks from '../services/crm/webhooks'
import { estadoPlan, historialPagos, pagarPlan, cobrarPlan, cotizarUsuarios, usuariosParaInvitar, medioDePago, prepararMedio, guardarMedio, confirmarMedio, cancelarPlan, reanudarPlan, aprobarUsuarios, bajarUsuarios, precioUsuarios, USUARIOS_MIN, USUARIOS_MAX, pagoDeEspacio, planesDelSitio, portalPagos, usoDeCuenta, PLANES, type Plan } from '../services/crm/plan'
import { nombreRecibo, reciboPdf } from '../services/crm/recibo'
import { crearEspacio, renombrarEspacio, eliminarEspacio, entrarAEspacio, listarEspacios } from '../services/crm/espacios'
import { leerAjuste } from '../services/crm/ajustes'
import { urlPublica } from './acceso'
import { prisma } from '../config/prisma'
import { crearClave, listarClaves, revocarClave } from '../services/crm/apiClaves'
import { auditLog } from '../utils/auditLogger'

/**
 * CRM propio. Todo lo de la bandeja: conversaciones,
 * mensajes, contactos, ajustes del equipo y preferencias. Las rutas de líneas
 * y plantillas de WhatsApp viven en `crmWhatsapp.ts`. Contrato en
 * docs/crm/CONTRATO-CRM.md; lo que va más allá, en docs/crm/api-core.md.
 */
const router = Router()
// Toda petición del CRM corre dentro del espacio de trabajo de quien la hace (services/crm/espacio.ts).
// Ventas entra por su rol; cualquier otra persona, si un líder la agregó a un equipo (alcance.ts).
router.use(authenticate, accesoCrm, conEspacio)

// Plan y pagos (Whop). Van antes de la guarda: con el plan vencido hay que poder ver el plan y pagar.
router.get('/plan', asyncHandler(async (req: Request, res: Response) => {
  // El uso es de la cuenta: personas y agentes sumados entre todos sus espacios de trabajo (6-oct).
  const [estado, historial, catalogo, uso, medio] = await Promise.all([
    estadoPlan(req.espacioId!), historialPagos(req.espacioId!), planesDelSitio(), usoDeCuenta(req.espacioId!), medioDePago(req.espacioId!).catch(() => null),
  ])
  // Cobro por usuarios (10-nov): el precio de cada plan de la página de precios, para los usuarios de esta cuenta
  // (el mínimo del plan o los que ya están, lo que sea mayor). La pantalla muestra lo que se cobra, con la misma fórmula.
  const MIN: Record<Plan, number> = { starter: 3, growth: 6, business: 11 }
  // Un plan que no cubre las personas que ya tiene la cuenta sale con su precio real y bloqueado (maqueta «Plan que no
  // alcanza», aprobada el 11-nov). Antes salía con el precio de esas personas, que es el de otro plan.
  const MAX: Partial<Record<Plan, number>> = { starter: 5, growth: 10 }
  const conPrecio = (catalogo as Array<Record<string, unknown>>).map(p => {
    const id = String(p.id) as Plan
    if (!PLANES.includes(id)) return p
    const max = MAX[id]
    if (max && uso.usuarios > max) return { ...p, bloqueado: true, maximo: max, enUso: uso.usuarios }
    const n = Math.max(MIN[id], uso.usuarios, USUARIOS_MIN)
    const anual = precioUsuarios(n, 'anual')
    return { ...p, usuarios: n, mensual: precioUsuarios(n, 'mensual'), anual: anual.toLocaleString('es-CO'), equivaleMes: `USD ${Math.round(anual / 12)}` }
  })
  return ApiResponse.success(res, {
    ...estado, historial, catalogo: conPrecio, uso, medio,
    administra: req.userRole === 'ADMIN' && !req.soloLectura,
  })
}))
// Espacios de trabajo (6-oct): listar, crear y cambiar de espacio. Antes de la guarda: con el plan vencido se puede cambiar.
router.get('/espacios', asyncHandler(async (req: Request, res: Response) => ApiResponse.success(res, await listarEspacios(req.userId!, req.espacioId!))))
router.post('/espacios', asyncHandler(async (req: Request, res: Response) => {
  if (req.soloLectura) throw new ForbiddenError('Modo de solo lectura: puedes ver todo, pero no hacer cambios.')
  const d = z.object({ nombre: z.string().max(80), adminNombre: z.string().max(80).optional(), adminCorreo: z.string().max(200).optional(), yo: z.boolean().default(true) }).parse(req.body)
  return ApiResponse.created(res, { id: await crearEspacio(req.userId!, req.espacioId!, d) })
}))
router.patch('/espacios/:id', asyncHandler(async (req: Request, res: Response) => {
  if (req.soloLectura) throw new ForbiddenError('Modo de solo lectura: puedes ver todo, pero no hacer cambios.')
  const d = z.object({ nombre: z.string().max(80), logo: z.string().max(200_000).nullable().optional() }).parse(req.body)
  await renombrarEspacio(req.userId!, req.espacioId!, String(req.params.id), d.nombre, d.logo)
  return ApiResponse.success(res, { ok: true })
}))
router.delete('/espacios/:id', asyncHandler(async (req: Request, res: Response) => {
  if (req.soloLectura) throw new ForbiddenError('Modo de solo lectura: puedes ver todo, pero no hacer cambios.')
  const d = z.object({ confirmacion: z.string().max(80) }).parse(req.body ?? {})
  await eliminarEspacio(req.userId!, req.espacioId!, String(req.params.id), d.confirmacion)
  return ApiResponse.success(res, { ok: true })
}))
router.post('/espacios/:id/entrar', asyncHandler(async (req: Request, res: Response) => {
  await entrarAEspacio(req.userId!, String(req.params.id))
  return ApiResponse.success(res, { ok: true })
}))
router.get('/plan/recibo/:numero', asyncHandler(async (req: Request, res: Response) => {
  if (req.userRole !== 'ADMIN') throw new ForbiddenError('Solo el administrador del espacio puede descargar los recibos.')
  const p = await pagoDeEspacio(req.espacioId!, Number(req.params.numero) || 0)
  const [e, u] = await Promise.all([
    prisma.crmEspacio.findUnique({ where: { id: req.espacioId! }, select: { nombre: true } }),
    prisma.user.findUnique({ where: { id: req.userId }, select: { email: true } }),
  ])
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${nombreRecibo(p)}"`)
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition')
  res.setHeader('Cache-Control', 'private, no-store')
  res.send(reciboPdf(p, e?.nombre ?? 'Tu empresa', u?.email ?? ''))
}))
router.post('/plan/pagar', asyncHandler(async (req: Request, res: Response) => {
  if (req.userRole !== 'ADMIN' || req.soloLectura) throw new ForbiddenError('Solo el administrador del espacio puede cambiar el plan.')
  // Cobro por usuarios (10-nov): se paga por cuántos usuarios; quien llega desde /precios con un plan, desde el mínimo de ese plan.
  const d = z.object({ usuarios: z.number().int().min(USUARIOS_MIN).max(USUARIOS_MAX).optional(), plan: z.enum(PLANES as [Plan, ...Plan[]]).optional(), periodo: z.enum(['mensual', 'anual']), cupon: z.string().regex(/^[A-Za-z0-9]{3,30}$/).optional() }).parse(req.body)
  const usuarios = d.usuarios ?? ({ starter: 3, growth: 6, business: 11 } as Record<Plan, number>)[d.plan ?? 'starter']
  const u = await prisma.user.findUnique({ where: { id: req.userId }, select: { email: true } })
  return ApiResponse.success(res, await pagarPlan(req.espacioId!, usuarios, d.periodo, u?.email ?? ''))
}))
// El formulario de pago de Whop arma un token en el navegador; aquí se cobra (maqueta «Checkout», aprobada el 6-nov).
router.post('/plan/cobrar', asyncHandler(async (req: Request, res: Response) => {
  if (req.userRole !== 'ADMIN' || req.soloLectura) throw new ForbiddenError('Solo el administrador del espacio puede cambiar el plan.')
  const d = z.object({
    usuarios: z.number().int().min(USUARIOS_MIN).max(USUARIOS_MAX), periodo: z.enum(['mensual', 'anual']),
    variante: z.string().regex(/^plan_[A-Za-z0-9]{6,40}$/), token: z.string().regex(/^ctok_[A-Za-z0-9_]{6,300}$/),
    regreso: z.string().url().max(500).refine(u => { try { const x = new URL(u); return x.protocol === 'https:' && ['walicrm.com', 'www.walicrm.com', 'www.nexcode97.com', 'nexcode97.com'].includes(x.hostname) } catch { return false } }, 'Dirección de regreso no válida'),
    cupon: z.string().regex(/^[A-Za-z0-9]{3,30}$/).optional(),
  }).parse(req.body)
  const u = await prisma.user.findUnique({ where: { id: req.userId }, select: { email: true } })
  return ApiResponse.success(res, await cobrarPlan(req.espacioId!, d, u?.email ?? ''))
}))
// Subir o bajar de usuarios con el plan pagado (10-nov). Cotizar solo calcula; aprobar es el botón «Aprobar pago de USD X»:
// sin esa aprobación no se cobra nada. Bajar no cobra: el precio baja desde la renovación.
router.post('/plan/usuarios/cotizar', asyncHandler(async (req: Request, res: Response) => {
  if (req.userRole !== 'ADMIN' || req.soloLectura) throw new ForbiddenError('Solo el administrador del espacio puede cambiar los usuarios del plan.')
  const d = z.object({ usuarios: z.number().int().min(USUARIOS_MIN).max(USUARIOS_MAX) }).parse(req.body)
  return ApiResponse.success(res, await cotizarUsuarios(req.espacioId!, d.usuarios))
}))
// Antes de invitar: si la persona ocupa un usuario más de los pagados, la cotización para aprobarla en el modal de invitar.
router.post('/plan/usuarios/para-invitar', asyncHandler(async (req: Request, res: Response) => {
  if (req.userRole !== 'ADMIN' || req.soloLectura) throw new ForbiddenError('Solo el administrador del espacio puede aprobar pagos.')
  const d = z.object({ email: z.string().trim().toLowerCase().email().max(200) }).parse(req.body)
  return ApiResponse.success(res, await usuariosParaInvitar(req.espacioId!, d.email))
}))
router.post('/plan/usuarios/aprobar', asyncHandler(async (req: Request, res: Response) => {
  if (req.userRole !== 'ADMIN' || req.soloLectura) throw new ForbiddenError('Solo el administrador del espacio puede aprobar pagos.')
  const d = z.object({ usuarios: z.number().int().min(USUARIOS_MIN).max(USUARIOS_MAX), hoy: z.number().int().min(0), regreso: z.string().url().max(500).refine(u => { try { const x = new URL(u); return x.protocol === 'https:' && ['walicrm.com', 'www.walicrm.com', 'www.nexcode97.com', 'nexcode97.com'].includes(x.hostname) } catch { return false } }, 'Dirección de regreso no válida') }).parse(req.body)
  return ApiResponse.success(res, await aprobarUsuarios(req.espacioId!, d.usuarios, d.hoy, d.regreso))
}))
router.post('/plan/usuarios/bajar', asyncHandler(async (req: Request, res: Response) => {
  if (req.userRole !== 'ADMIN' || req.soloLectura) throw new ForbiddenError('Solo el administrador del espacio puede cambiar los usuarios del plan.')
  const d = z.object({ usuarios: z.number().int().min(USUARIOS_MIN).max(USUARIOS_MAX) }).parse(req.body)
  return ApiResponse.success(res, await bajarUsuarios(req.espacioId!, d.usuarios))
}))
// Medio de pago y cancelar, dentro de Wali (maqueta aprobada el 10-nov). Cambiar el medio no cobra.
router.post('/plan/medio/preparar', asyncHandler(async (req: Request, res: Response) => {
  if (req.userRole !== 'ADMIN' || req.soloLectura) throw new ForbiddenError('Solo el administrador del espacio puede cambiar el plan y sus pagos.')
  return ApiResponse.success(res, await prepararMedio(req.espacioId!))
}))
router.post('/plan/medio/guardar', asyncHandler(async (req: Request, res: Response) => {
  if (req.userRole !== 'ADMIN' || req.soloLectura) throw new ForbiddenError('Solo el administrador del espacio puede cambiar el plan y sus pagos.')
  const d = z.object({ token: z.string().regex(/^ctok_[A-Za-z0-9_]{6,300}$/), regreso: z.string().url().max(500).refine(u => { try { const x = new URL(u); return x.protocol === 'https:' && ['walicrm.com', 'www.walicrm.com', 'www.nexcode97.com', 'nexcode97.com'].includes(x.hostname) } catch { return false } }, 'Dirección de regreso no válida') }).parse(req.body)
  return ApiResponse.success(res, await guardarMedio(req.espacioId!, d.token, d.regreso))
}))
router.post('/plan/medio/confirmar', asyncHandler(async (req: Request, res: Response) => {
  if (req.userRole !== 'ADMIN' || req.soloLectura) throw new ForbiddenError('Solo el administrador del espacio puede cambiar el plan y sus pagos.')
  const d = z.object({ setup: z.string().regex(/^sint_[A-Za-z0-9_]{4,80}$/) }).parse(req.body)
  return ApiResponse.success(res, await confirmarMedio(req.espacioId!, d.setup))
}))
router.post('/plan/cancelar', asyncHandler(async (req: Request, res: Response) => {
  if (req.userRole !== 'ADMIN' || req.soloLectura) throw new ForbiddenError('Solo el administrador del espacio puede cambiar el plan y sus pagos.')
  await cancelarPlan(req.espacioId!)
  return ApiResponse.success(res, { ok: true })
}))
router.post('/plan/reanudar', asyncHandler(async (req: Request, res: Response) => {
  if (req.userRole !== 'ADMIN' || req.soloLectura) throw new ForbiddenError('Solo el administrador del espacio puede cambiar el plan y sus pagos.')
  await reanudarPlan(req.espacioId!)
  return ApiResponse.success(res, { ok: true })
}))
router.post('/plan/portal', asyncHandler(async (req: Request, res: Response) => {
  if (req.userRole !== 'ADMIN' || req.soloLectura) throw new ForbiddenError('Solo el administrador del espacio puede ver los pagos.')
  return ApiResponse.success(res, await portalPagos(req.espacioId!))
}))

/** Con la prueba o el pago vencidos el espacio queda en solo lectura: se ve todo, nada se borra, pero no se escribe. */
router.use((req: Request, _res: Response, next: NextFunction) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase())) return next()
  estadoPlan(req.espacioId!).then(p => (p.vigente ? next()
    : next(new ForbiddenError(p.estado === 'prueba' ? 'Tu prueba gratis terminó. Elige un plan en Ajustes → Plan y pagos para seguir atendiendo.' : 'Tu plan no está activo. Renuévalo en Ajustes → Plan y pagos para seguir atendiendo.'))), next)
})
router.use(rutasWaCrm)
// La IA del CRM (lote 5): Mi IA, sugerencias de respuesta y embudo automático (crmIa.ts).
router.use(rutasIaCrm)
// Encuesta al finalizar con el formulario de WhatsApp (lote 6, crmEncuesta.ts): antes de la bandeja, porque atiende el
// evento de la encuesta que llega por POST /conversaciones/:id/mensajes y el guardado de Ajustes (PUT /ajustes/cfg).
router.use(rutasEncuestaCrm)
router.use(rutasAyudaCrm)

// Claves de la API pública (11-nov, Ajustes del CRM › API): solo administradores. La clave completa sale una sola vez.
const soloAdminApi = (req: Request) => { if (!configura(req.userRole) || req.soloLectura) throw new ForbiddenError('Solo un administrador puede ver y manejar las claves de la API.') }
router.get('/api-claves', asyncHandler(async (req: Request, res: Response) => {
  soloAdminApi(req)
  return ApiResponse.success(res, await listarClaves())
}))
router.post('/api-claves', asyncHandler(async (req: Request, res: Response) => {
  soloAdminApi(req)
  const d = z.object({ nombre: z.string().trim().min(2).max(60), permiso: z.enum(['lectura', 'escritura']), vence: z.enum(['90', '365', 'nunca']) }).parse(req.body)
  const k = await crearClave(d, req.userId!)
  auditLog(req, 'CREATE', 'crm_api_clave', k.id, { nombre: k.nombre, permiso: k.permiso })
  return ApiResponse.success(res, k)
}))
router.delete('/api-claves/:id', asyncHandler(async (req: Request, res: Response) => {
  soloAdminApi(req)
  const id = String(req.params.id)
  if (!/^[\w-]{1,40}$/.test(id)) throw new ValidationError('Esa clave no existe.')
  const k = await revocarClave(id, req.userId!)
  auditLog(req, 'DELETE', 'crm_api_clave', id, { nombre: k.nombre })
  return ApiResponse.success(res, k)
}))
// Webhooks de la API (11-nov): solo administradores. El secreto de la firma sale una sola vez, al crearlo.
const idWebhook = (v: unknown) => { const id = String(v); if (!/^[\w-]{1,40}$/.test(id)) throw new ValidationError('Ese webhook no existe.'); return id }
router.get('/api-webhooks', asyncHandler(async (req: Request, res: Response) => {
  soloAdminApi(req)
  return ApiResponse.success(res, { webhooks: await webhooks.listarWebhooks(req.espacioId!), eventos: webhooks.EVENTOS })
}))
router.post('/api-webhooks', asyncHandler(async (req: Request, res: Response) => {
  soloAdminApi(req)
  const d = z.object({ nombre: z.string().trim().min(2).max(60), url: z.string().trim().min(8).max(500), eventos: z.array(z.string().max(40)).min(1).max(10) }).parse(req.body)
  const w = await webhooks.crearWebhook(req.espacioId!, d, req.userId!)
  auditLog(req, 'CREATE', 'crm_api_webhook', w.id, { nombre: w.nombre, eventos: w.eventos })
  return ApiResponse.success(res, w)
}))
router.delete('/api-webhooks/:id', asyncHandler(async (req: Request, res: Response) => {
  soloAdminApi(req)
  const w = await webhooks.borrarWebhook(req.espacioId!, idWebhook(req.params.id))
  auditLog(req, 'DELETE', 'crm_api_webhook', w.id, { nombre: w.nombre })
  return ApiResponse.success(res, w)
}))
router.post('/api-webhooks/:id/reactivar', asyncHandler(async (req: Request, res: Response) => {
  soloAdminApi(req)
  const w = await webhooks.reactivarWebhook(req.espacioId!, idWebhook(req.params.id))
  auditLog(req, 'UPDATE', 'crm_api_webhook', w.id, { reactivado: true })
  return ApiResponse.success(res, w)
}))
router.post('/api-webhooks/:id/probar', asyncHandler(async (req: Request, res: Response) => {
  soloAdminApi(req)
  return ApiResponse.success(res, await webhooks.probarWebhook(req.espacioId!, idWebhook(req.params.id)))
}))

const MB = 1024 * 1024
/** multer en memoria con su tope; el error sale como 400 con un texto que dice qué hacer. */
function unArchivo(maxMb: number) {
  const m = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxMb * MB, files: 1 } }).single('archivo')
  return (req: Request, res: Response, next: NextFunction) => m(req, res, (err: unknown) => {
    if (!err) return next()
    const e = err as { code?: string; message?: string }
    const texto = e.code === 'LIMIT_FILE_SIZE' ? `El archivo pesa más de ${maxMb} MB. Comprímelo o súbelo en partes.`
      : e.code === 'LIMIT_UNEXPECTED_FILE' ? 'El archivo debe ir en el campo «archivo» y de a uno.'
      : `No se pudo recibir el archivo: ${e.message ?? 'error desconocido'}`
    return res.status(400).json({ success: false, error: texto })
  })
}

/** Antes de recibir un archivo o gastar en IA: la ruta es solo de líderes (el controlador lo vuelve a mirar). */
function soloLideres(que: string) {
  return (req: Request, _res: Response, next: NextFunction) =>
    configura(req.userRole) ? next() : next(new ForbiddenError(`Solo los administradores pueden ${que}. Pídeselo a tu administrador.`))
}

/**
 * Buscar y ver personas para los equipos (29-sep): la configuración general, el administrador sin equipo o quien
 * lidera algún equipo (alcance.ts). El controlador lo vuelve a mirar.
 */
function adminEquipos(que: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    alcanceDe(req).then(a => (a.config || a.todo || a.lidera.length
      ? next()
      : next(new ForbiddenError(`Solo los líderes de cada equipo y los administradores pueden ${que}. Pídeselo a tu líder.`))), next)
  }
}

/** Chat de prueba de los agentes: cada mensaje es una llamada pagada al modelo. Además del tope diario (en el controlador). */
const PRUEBAS_POR_MINUTO = 10
const limitePruebas = rateLimit({
  windowMs: 60 * 1000,
  max: PRUEBAS_POR_MINUTO,
  keyGenerator: req => `crm-probar:${req.userId ?? 'anon'}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: `Vas muy rápido: caben ${PRUEBAS_POR_MINUTO} mensajes de prueba por minuto. Espera un momento y sigue probando.` },
})

// Bandeja
router.get('/inicio', asyncHandler(conv.inicio))
router.get('/finalizadas', asyncHandler(conv.finalizadasAparte))
router.get('/menciones', asyncHandler(menciones))
router.post('/conversaciones', asyncHandler(conv.nuevaConversacion))
router.get('/conversaciones/:id/mensajes', asyncHandler(conv.listarMensajes))
router.post('/conversaciones/:id/mensajes', asyncHandler(conv.enviarMensaje))
router.delete('/conversaciones/:id/mensajes/:msgId', asyncHandler(conv.borrarMensaje))
router.post('/conversaciones/:id/mensajes/:msgId/transcripcion', asyncHandler(conv.transcribirNota))
router.post('/conversaciones/:id/mensajes/:msgId/reaccion', asyncHandler(conv.reaccionar))
// Llamadas por WhatsApp en vivo (llamadasVivo.ts).
router.get('/difusiones/:id/respondieron', asyncHandler(difusiones.respondieron))
router.get('/llamadas', asyncHandler(llamadas.enCurso))
router.post('/llamadas/:id/contestar', asyncHandler(llamadas.contestarLlamada))
router.post('/llamadas/:id/rechazar', asyncHandler(llamadas.rechazarLlamada))
router.post('/llamadas/:id/colgar', asyncHandler(llamadas.colgarLlamada))
router.post('/llamadas/:id/cierre', asyncHandler(llamadas.cierreLlamada))
router.post('/conversaciones/:id/llamar', asyncHandler(llamadas.llamarCliente))
router.get('/conversaciones/:id/permiso-llamada', asyncHandler(llamadas.permisoLlamada))
router.post('/conversaciones/:id/permiso-llamada', asyncHandler(llamadas.pedirPermisoLlamada))
router.patch('/conversaciones/:id', asyncHandler(conv.editarConversacion))
router.post('/conversaciones/:id/leer', asyncHandler(conv.marcarLeida))
router.post('/conversaciones/:id/spam', asyncHandler(spam.marcarSpam))
router.get('/conversaciones/:id/exportar', asyncHandler(conv.exportarChat))
router.get('/conversaciones/:id/unibles', asyncHandler(conv.unibles))
router.post('/conversaciones/:id/unir', asyncHandler(conv.unirConversaciones))
router.delete('/conversaciones/:id', asyncHandler(conv.borrarConversacion))

// Contactos (importar y exportar antes de /:id)
router.post('/contactos/importar', unArchivo(10), asyncHandler(contactos.importarContactos))
router.get('/contactos/exportar', asyncHandler(contactos.exportarContactos))
router.get('/contactos/lista', asyncHandler(contactos.listarContactos))
router.get('/contactos/:id/ultimos', asyncHandler(contactos.ultimosDeContacto))
router.get('/contactos/:contactoId/ficha-externa', asyncHandler(contactos.fichaExternaDeContacto))
router.post('/contactos', asyncHandler(contactos.crearContacto))
router.patch('/contactos/:id', asyncHandler(contactos.editarContacto))
router.delete('/contactos/:id', asyncHandler(contactos.borrarContacto))

// Ajustes del equipo y preferencias propias
router.get('/ajustes/versiones', asyncHandler(ajustes.versionesAjustes))
router.get('/personas', adminEquipos('agregar personas a los equipos'), asyncHandler(ajustes.buscarPersonas))
router.post('/equipos/repartir', adminEquipos('repartir las conversaciones de quien sale de un equipo'), asyncHandler(ajustes.repartirAlSalirDe))
router.post('/personas/invitar', adminEquipos('invitar personas al CRM'), asyncHandler(ajustes.invitarPersona))
router.post('/personas/:id/reenviar', adminEquipos('reenviar invitaciones'), asyncHandler(ajustes.reenviarInvitacion))
router.delete('/personas/:id/invitacion', adminEquipos('cancelar invitaciones'), asyncHandler(ajustes.cancelarInvitacion))
router.get('/personas/:id', adminEquipos('ver los datos de las personas'), asyncHandler(ajustes.verPersona))
router.put('/ajustes/:clave', asyncHandler(ajustes.guardarAjusteRuta))
router.put('/preferencias', asyncHandler(ajustes.guardarPreferencias))

// Archivos, catálogo de enlaces de pago e informes
router.post('/archivos', unArchivo(25), asyncHandler(ajustes.subirArchivo))
// Grabaciones de llamadas: privadas, solo con una dirección que vence (grabaciones.ts).
router.post('/grabaciones/subir', unArchivo(60), asyncHandler(async (req: Request, res: Response) => {
  if (req.soloLectura) throw new ForbiddenError('Tu cuenta es de solo lectura')
  if (!req.file) throw new ValidationError('Falta el archivo. Súbelo en el campo «archivo».')
  if (!/^(audio|video)\//.test(req.file.mimetype)) throw new ValidationError('La grabación tiene que ser un audio')
  try { return ApiResponse.created(res, { ref: await subirGrabacion(req.file.buffer) }) } catch (e) {
    logger.error(`[CRM grabaciones] Cloudinary: ${(e as Error)?.message ?? e}`)
    throw new AppError('No se pudo guardar la grabación.', 502)
  }
}))
router.get('/grabaciones', asyncHandler(async (req: Request, res: Response) => {
  const a = await alcanceDe(req)
  if (!puedeVerGrabaciones(a)) throw new ForbiddenError('Las grabaciones las ven los administradores y los líderes.')
  const t = (v: unknown) => (typeof v === 'string' ? v : '')
  return ApiResponse.success(res, await listarGrabaciones(a, { q: t(req.query.q), miembro: t(req.query.miembro), equipo: t(req.query.equipo), dias: Number(req.query.dias) || 0, antesDe: t(req.query.antesDe) }))
}))
router.get('/grabaciones/:id/url', asyncHandler(async (req: Request, res: Response) => {
  const g = await grabacionPorId(String(req.params.id))
  await convVisible(req, g.convId)
  const descargar = req.query.descargar === '1'
  if (descargar && (req.soloLectura || !puedeVerGrabaciones(await alcanceDe(req)))) throw new ForbiddenError('Tu cuenta no puede descargar grabaciones.')
  res.setHeader('Cache-Control', 'no-store')
  return ApiResponse.success(res, { url: direccionDe(g.audio, descargar) })
}))
router.delete('/grabaciones/:id', asyncHandler(async (req: Request, res: Response) => {
  if (req.soloLectura || req.userRole !== 'ADMIN') throw new ForbiddenError('Solo un administrador puede eliminar grabaciones.')
  await borrarGrabacion(String(req.params.id), 'la eliminó un administrador')
  return ApiResponse.success(res, { ok: true })
}))
// Términos y condiciones de la empresa (Protección de datos).
router.get('/terminos', asyncHandler(async (_req: Request, res: Response) => ApiResponse.success(res, await resumenTerminos(urlPublica()))))
router.post('/terminos', soloLideres('subir los términos y condiciones'), unArchivo(10), asyncHandler(async (req: Request, res: Response) => {
  if (req.soloLectura) throw new ForbiddenError('Tu cuenta es de solo lectura')
  const f = req.file
  if (!f) throw new ValidationError('Falta el archivo. Súbelo en el campo «archivo».')
  if (f.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') throw new ValidationError('Los términos tienen que ser un archivo PDF')
  const n = nombreArchivo(f)
  let url: string
  try { url = await subirACloudinary(f.buffer, n, 'application/pdf', 'crm/terminos') } catch (e) {
    logger.error(`[CRM términos] Cloudinary: ${(e as Error)?.message ?? e}`)
    throw new AppError('No se pudo guardar el PDF. Intenta de nuevo en un momento.', 502)
  }
  // multer corre fuera del contexto de la petición: la empresa se vuelve a fijar antes de guardar.
  return ApiResponse.created(res, await enEspacio(req.espacioId!, () => nuevaVersion(url, n, req.userId ?? null, urlPublica())))
}))
router.put('/terminos', soloLideres('cambiar los términos y condiciones'), asyncHandler(async (req: Request, res: Response) => {
  if (req.soloLectura) throw new ForbiddenError('Tu cuenta es de solo lectura')
  return ApiResponse.success(res, await cambiarPedir(req.body?.pedir !== false, req.userId ?? null, urlPublica()))
}))
router.get('/catalogo', asyncHandler(catalogo))
router.get('/informes', asyncHandler(informes))

// Enlaces de pauta (services/crm/enlaces.ts): los ve el equipo; los crean, cambian y borran los líderes.
router.get('/enlaces', asyncHandler(async (_req: Request, res: Response) => ApiResponse.success(res, await listarEnlaces())))
router.post('/enlaces', soloLideres('crear enlaces de pauta'), asyncHandler(async (req: Request, res: Response) => ApiResponse.created(res, await crearEnlace(req.body ?? {}, req.userId ?? null))))
router.patch('/enlaces/:id', soloLideres('cambiar enlaces de pauta'), asyncHandler(async (req: Request, res: Response) => { await editarEnlace(req.params.id, req.body ?? {}); return ApiResponse.success(res, { ok: true }) }))
router.delete('/enlaces/:id', soloLideres('borrar enlaces de pauta'), asyncHandler(async (req: Request, res: Response) => { await borrarEnlace(req.params.id); return ApiResponse.success(res, { ok: true }) }))

// Agentes IA y base de conocimiento
router.post('/agentes/probar', soloLideres('probar los agentes IA'), limitePruebas, asyncHandler(ajustes.probarAgenteRuta))
router.get('/agentes/mejorar', soloLideres('ver lo que el agente no supo responder'), asyncHandler(ajustes.mejorarLista))
router.delete('/agentes/mejorar/:id', soloLideres('quitar preguntas de Mejorar'), asyncHandler(ajustes.mejorarQuitar))
// Capacidades (versión cerrada): conexión de la empresa con los sistemas aprobados; el agente solo consulta.
router.get('/integraciones', soloLideres('ver las conexiones con otros sistemas'), asyncHandler(ajustes.integracionesLista))
router.post('/integraciones/manychat', soloLideres('conectar ManyChat'), asyncHandler(ajustes.integracionManychat))
router.post('/integraciones/hotmart', soloLideres('conectar Hotmart'), asyncHandler(ajustes.integracionHotmart))
router.post('/integraciones/shopify', soloLideres('conectar Shopify'), asyncHandler(ajustes.integracionShopify))
router.post('/integraciones/gcal', soloLideres('conectar Google Calendar'), asyncHandler(ajustes.integracionCalendario))
router.delete('/integraciones/:sistema', soloLideres('desconectar otros sistemas'), asyncHandler(ajustes.integracionQuitar))
router.get('/motor-ia', soloLideres('ver el motor de IA'), asyncHandler(ajustes.motorLista))
router.post('/motor-ia/:proveedor', soloLideres('conectar el motor de IA'), asyncHandler(ajustes.motorConectar))
router.post('/motor-ia/:proveedor/usar', soloLideres('cambiar el motor de IA'), asyncHandler(ajustes.motorUsar))
router.delete('/motor-ia/:proveedor', soloLideres('desconectar el motor de IA'), asyncHandler(ajustes.motorQuitar))
router.post('/kb/leer-web', soloLideres('cargar la base de conocimiento'), asyncHandler(ajustes.leerSitio))
router.post('/kb/documento', soloLideres('cargar la base de conocimiento'), unArchivo(20), asyncHandler(ajustes.subirDocumento))

export default router
