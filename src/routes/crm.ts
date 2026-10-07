import { Router, type Request, type Response, type NextFunction } from 'express'
import multer from 'multer'
import rateLimit from 'express-rate-limit'
import { authenticate, requireRole } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import { configura } from '../utils/roles'
import { ForbiddenError } from '../utils/errors'
import { rutasWaCrm } from './crmWhatsapp'
import { rutasIaCrm } from './crmIa'
import { rutasEncuestaCrm } from './crmEncuesta'
import * as conv from '../controllers/crm/conversaciones.controller'
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
import { estadoPlan, historialPagos, pagarPlan, pagoDeEspacio, planesDelSitio, portalPagos, usoDeCuenta, PLANES, type Plan } from '../services/crm/plan'
import { nombreRecibo, reciboPdf } from '../services/crm/recibo'
import { crearEspacio, renombrarEspacio, eliminarEspacio, entrarAEspacio, listarEspacios } from '../services/crm/espacios'
import { leerAjuste } from '../services/crm/ajustes'
import { urlPublica } from './acceso'
import { prisma } from '../config/prisma'

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

// Plan y pagos (Creem). Van antes de la guarda: con el plan vencido hay que poder ver el plan y pagar.
router.get('/plan', asyncHandler(async (req: Request, res: Response) => {
  // El uso es de la cuenta: personas y agentes sumados entre todos sus espacios de trabajo (6-oct).
  const [estado, historial, catalogo, uso] = await Promise.all([
    estadoPlan(req.espacioId!), historialPagos(req.espacioId!), planesDelSitio(), usoDeCuenta(req.espacioId!),
  ])
  return ApiResponse.success(res, {
    ...estado, historial, catalogo, uso,
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
  const d = z.object({ nombre: z.string().max(80) }).parse(req.body)
  await renombrarEspacio(req.userId!, req.espacioId!, String(req.params.id), d.nombre)
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
  const d = z.object({ plan: z.enum(PLANES as [Plan, ...Plan[]]), periodo: z.enum(['mensual', 'anual']) }).parse(req.body)
  const u = await prisma.user.findUnique({ where: { id: req.userId }, select: { email: true } })
  const volver = `${urlPublica() ?? ''}/?ir=cfg-plan&pago=ok`
  return ApiResponse.success(res, await pagarPlan(req.espacioId!, d.plan, d.periodo, u?.email ?? '', volver))
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
    configura(req.userRole) ? next() : next(new ForbiddenError(`Solo los administradores y líderes pueden ${que}. Pídeselo a tu líder.`))
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
router.get('/menciones', asyncHandler(menciones))
router.post('/conversaciones', asyncHandler(conv.nuevaConversacion))
router.get('/conversaciones/:id/mensajes', asyncHandler(conv.listarMensajes))
router.post('/conversaciones/:id/mensajes', asyncHandler(conv.enviarMensaje))
router.delete('/conversaciones/:id/mensajes/:msgId', asyncHandler(conv.borrarMensaje))
router.post('/conversaciones/:id/mensajes/:msgId/transcripcion', asyncHandler(conv.transcribirNota))
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
router.get('/contactos/:contactoId/ficha-externa', asyncHandler(contactos.fichaExternaDeContacto))
router.post('/contactos', asyncHandler(contactos.crearContacto))
router.patch('/contactos/:id', asyncHandler(contactos.editarContacto))
router.delete('/contactos/:id', asyncHandler(contactos.borrarContacto))

// Ajustes del equipo y preferencias propias
router.get('/ajustes/versiones', asyncHandler(ajustes.versionesAjustes))
router.get('/personas', adminEquipos('agregar personas a los equipos'), asyncHandler(ajustes.buscarPersonas))
router.post('/personas/invitar', adminEquipos('invitar personas al CRM'), asyncHandler(ajustes.invitarPersona))
router.get('/personas/:id', adminEquipos('ver los datos de las personas'), asyncHandler(ajustes.verPersona))
router.put('/ajustes/:clave', asyncHandler(ajustes.guardarAjusteRuta))
router.put('/preferencias', asyncHandler(ajustes.guardarPreferencias))

// Archivos, catálogo de enlaces de pago e informes
router.post('/archivos', unArchivo(25), asyncHandler(ajustes.subirArchivo))
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
