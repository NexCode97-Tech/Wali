import { Router, type Request, type Response, type NextFunction } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { asyncHandler } from '../middleware/errorHandler'
import { conClaveApi } from '../services/crm/apiClaves'
import { prisma } from '../services/crm/bd'
import { leerAjuste } from '../services/crm/ajustes'
import { usuariosCrm } from '../services/crm/usuarios'
import { leerEquipos } from '../services/crm/equipos'
import { auditLog } from '../utils/auditLogger'
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors'
import { FLUJOS_DEFECTO } from '../services/crm/flujos'
import * as ajustes from '../controllers/crm/ajustes.controller'
import * as conv from '../controllers/crm/conversaciones.controller'
import * as contactos from '../controllers/crm/contactos.controller'

/**
 * API pública de Wali, versión 1 (11-nov). Base: https://walicrm.com/crm/api/v1. Va con
 * `Authorization: Bearer wali_live_…` (la clave de Ajustes del CRM › API). Todo dentro del espacio de la clave.
 *
 * Lectura: conversaciones (con filtros y sus mensajes), contactos, equipos, miembros, etapas, etiquetas, líneas, flujos y agentes.
 * Acciones (clave de lectura y acciones): asignar (también en lote, hasta 100), cambiar la etapa, poner o quitar
 * etiquetas, finalizar o reabrir, y crear o editar contactos. Las acciones pasan por los mismos controladores que la
 * pantalla: mismos permisos, validaciones, avisos en vivo y registro. Respuestas: { data, siguiente? } o { error }.
 */
const router = Router()

router.use(conClaveApi)
// 120 llamadas por minuto por clave (como Trengo), con las cabeceras estándar de límite.
router.use(rateLimit({
  windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req: Request) => req.apiClave?.id ?? req.ip ?? 'anon',
  message: { error: 'Pasaste el límite de 120 llamadas por minuto de esta clave. Espera un momento.' },
}))

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})
const fechaOk = (v: unknown) => { const d = new Date(String(v)); return Number.isNaN(d.getTime()) ? undefined : d }
const limiteDe = (v: unknown) => Math.min(100, Math.max(1, Number(v) || 50))

/** Corre un controlador de la pantalla con otra entrada y devuelve lo que habría respondido. */
async function llamar(ctrl: (req: Request, res: Response) => Promise<unknown>, req: Request, params: Json, body: Json): Promise<unknown> {
  const r = Object.assign(Object.create(Object.getPrototypeOf(req)), req, { params, body, query: {} }) as Request
  let salida: unknown = null
  const res = { statusCode: 200, status(c: number) { this.statusCode = c; return this }, json(b: unknown) { salida = b; return this }, send(b: unknown) { salida = b; return this }, setHeader() { return this } }
  await ctrl(r, res as unknown as Response)
  return obj(salida).data ?? salida
}

const nombres = async (clave: string) => {
  const v = await leerAjuste<unknown>(clave)
  return Array.isArray(v) ? v.map(x => (Array.isArray(x) ? { nombre: String(x[0] ?? ''), color: x[1] ?? null } : { nombre: String(obj(x).n ?? ''), color: obj(x).c ?? null })).filter(x => x.nombre) : []
}

const conversacionDe = (c: { id: number; estado: string; canal: string; asignadoId: string | null; equipo: string | null; prioridad: string | null; motivoFin: string | null; lineaId: string | null; noLeidos: number; ultimoMensajeAt: Date | null; finalizadaAt: Date | null; createdAt: Date; contacto?: { id: number; nombre: string | null; telefono: string | null; correo: string | null; etapa: string | null; tags: string[] } | null }) => ({
  id: c.id, estado: c.estado, canal: c.canal, asignadoId: c.asignadoId, equipo: c.equipo || 'Ventas', prioridad: c.prioridad, lineaId: c.lineaId,
  noLeidos: c.noLeidos, motivoFin: c.motivoFin, ultimoMensaje: c.ultimoMensajeAt, finalizada: c.finalizadaAt, creada: c.createdAt,
  contacto: c.contacto ? { id: c.contacto.id, nombre: c.contacto.nombre, telefono: c.contacto.telefono, correo: c.contacto.correo, etapa: c.contacto.etapa, etiquetas: c.contacto.tags } : null,
})
const conContacto = { contacto: { select: { id: true, nombre: true, telefono: true, correo: true, etapa: true, tags: true } } } as const

// ── Lectura ──
router.get('/yo', asyncHandler(async (req: Request, res: Response) => {
  res.json({ data: { espacio: req.espacioId, clave: req.apiClave?.nombre, permiso: req.apiClave?.permiso } })
}))

router.get('/conversaciones', asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, string | undefined>
  const where: Json = {}
  if (q.estado) { if (!['abiertas', 'pendientes', 'finalizadas'].includes(q.estado)) throw new ValidationError('estado debe ser abiertas, pendientes o finalizadas.'); where.estado = q.estado }
  if (q.asignado) where.asignadoId = q.asignado === 'nadie' ? null : q.asignado
  if (q.equipo) where.equipo = q.equipo
  if (q.etapa) where.contacto = { etapa: q.etapa }
  const desde = fechaOk(q.desde), hasta = fechaOk(q.hasta)
  if (desde || hasta) where.updatedAt = { ...(desde ? { gte: desde } : {}), ...(hasta ? { lte: hasta } : {}) }
  const cursor = Number(q.cursor) || 0, limite = limiteDe(q.limite)
  if (cursor) where.id = { lt: cursor }
  const l = await prisma.crmConversacion.findMany({ where, orderBy: { id: 'desc' }, take: limite + 1, include: conContacto })
  const pagina = l.slice(0, limite)
  res.json({ data: pagina.map(conversacionDe), siguiente: l.length > limite ? pagina[pagina.length - 1].id : null })
}))

router.get('/conversaciones/:id', asyncHandler(async (req: Request, res: Response) => {
  const c = await prisma.crmConversacion.findFirst({ where: { id: Number(req.params.id) || 0 }, include: conContacto })
  if (!c) throw new NotFoundError('Esa conversación no existe en este espacio.')
  res.json({ data: conversacionDe(c) })
}))

router.get('/conversaciones/:id/mensajes', asyncHandler(async (req: Request, res: Response) => {
  const id = Number(req.params.id) || 0
  if (!(await prisma.crmConversacion.count({ where: { id } }))) throw new NotFoundError('Esa conversación no existe en este espacio.')
  const q = req.query as Record<string, string | undefined>, limite = limiteDe(q.limite)
  const l = await prisma.crmMensaje.findMany({ where: { conversacionId: id, ...(q.cursor ? { createdAt: { lt: fechaOk(q.cursor) ?? new Date() } } : {}) }, orderBy: { createdAt: 'desc' }, take: limite + 1 })
  const pagina = l.slice(0, limite)
  res.json({
    data: pagina.map(m => {
      const d = obj(m.datos), cuerpo = d.in ?? d.out ?? d.note ?? d.t
      const texto = typeof cuerpo === 'string' ? cuerpo : typeof obj(cuerpo).txt === 'string' ? obj(cuerpo).txt : typeof obj(cuerpo).trans === 'string' ? obj(cuerpo).trans : null
      const archivo = obj(cuerpo).url ?? obj(d.file).url ?? null
      return { id: m.id, tipo: m.tipo, texto, archivo, autorId: m.autorId, estado: m.estado, en: m.createdAt }
    }),
    siguiente: l.length > limite ? pagina[pagina.length - 1].createdAt : null,
  })
}))

router.get('/contactos', asyncHandler(async (req: Request, res: Response) => {
  const q = req.query as Record<string, string | undefined>, limite = limiteDe(q.limite), cursor = Number(q.cursor) || 0
  const where: Json = {}
  if (q.q) { const t = String(q.q).slice(0, 80); where.OR = [{ nombre: { contains: t, mode: 'insensitive' } }, { telefono: { contains: t } }, { correo: { contains: t, mode: 'insensitive' } }] }
  if (q.etapa) where.etapa = q.etapa
  if (q.etiqueta) where.tags = { has: q.etiqueta }
  if (cursor) where.id = { lt: cursor }
  const l = await prisma.crmContacto.findMany({ where, orderBy: { id: 'desc' }, take: limite + 1, select: { id: true, nombre: true, telefono: true, correo: true, canal: true, etapa: true, tags: true, asignadoId: true, campos: true, createdAt: true } })
  const pagina = l.slice(0, limite)
  res.json({ data: pagina.map(k => ({ id: k.id, nombre: k.nombre, telefono: k.telefono, correo: k.correo, canal: k.canal, etapa: k.etapa, etiquetas: k.tags, asignadoId: k.asignadoId, campos: k.campos, creado: k.createdAt })), siguiente: l.length > limite ? pagina[pagina.length - 1].id : null })
}))

router.get('/contactos/:id', asyncHandler(async (req: Request, res: Response) => {
  const k = await prisma.crmContacto.findFirst({ where: { id: Number(req.params.id) || 0 }, select: { id: true, nombre: true, telefono: true, correo: true, canal: true, etapa: true, tags: true, asignadoId: true, campos: true, createdAt: true } })
  if (!k) throw new NotFoundError('Ese contacto no existe en este espacio.')
  res.json({ data: { id: k.id, nombre: k.nombre, telefono: k.telefono, correo: k.correo, canal: k.canal, etapa: k.etapa, etiquetas: k.tags, asignadoId: k.asignadoId, campos: k.campos, creado: k.createdAt } })
}))

router.get('/miembros', asyncHandler(async (_req: Request, res: Response) => {
  res.json({ data: (await usuariosCrm()).map(u => ({ id: u.id, nombre: u.nombre })) })
}))
router.get('/equipos', asyncHandler(async (_req: Request, res: Response) => {
  const e = await leerEquipos()
  res.json({ data: Object.keys(e.ids).map(n => ({ nombre: n, miembros: e.ids[n] })) })
}))
router.get('/etapas', asyncHandler(async (_req: Request, res: Response) => { res.json({ data: await nombres('etapas') }) }))
router.get('/etiquetas', asyncHandler(async (_req: Request, res: Response) => { res.json({ data: await nombres('etiquetas') }) }))
router.get('/lineas', asyncHandler(async (_req: Request, res: Response) => {
  res.json({ data: (await prisma.crmLinea.findMany({ select: { id: true, nombre: true, telefono: true } })) })
}))

// ── Acciones (clave de lectura y acciones; conClaveApi ya cortó las de solo lectura) ──
const asignarSchema = z.object({
  conversaciones: z.array(z.number().int().positive()).min(1).max(100),
  miembroId: z.string().min(1).max(60).nullable().optional(),
  equipo: z.string().min(1).max(60).optional(),
}).refine(d => d.miembroId !== undefined || d.equipo !== undefined, { message: 'Di a quién: miembroId (o null para dejarla sin asignar) o equipo.' })

/** Asignar en lote: hasta 100 conversaciones por llamada. Cada una pasa por las mismas reglas que en la pantalla. */
router.post('/conversaciones/asignar', asyncHandler(async (req: Request, res: Response) => {
  const d = asignarSchema.parse(req.body)
  const cambios: Json = {}
  if (d.equipo !== undefined) cambios.equipo = d.equipo
  if (d.miembroId !== undefined) cambios.asigId = d.miembroId
  const hechas: number[] = [], errores: { id: number; error: string }[] = []
  for (const id of [...new Set(d.conversaciones)]) {
    try { await llamar(conv.editarConversacion, req, { id: String(id) }, { cambios }); hechas.push(id) }
    catch (e) { errores.push({ id, error: (e as Error).message }) }
  }
  auditLog(req, 'UPDATE', 'api_asignar', undefined, { clave: req.apiClave?.id, hechas: hechas.length, errores: errores.length })
  res.json({ data: { asignadas: hechas, errores } })
}))

const editarSchema = z.object({
  etapa: z.string().min(1).max(80).optional(),
  etiquetas: z.object({ agregar: z.array(z.string().min(1).max(60)).max(30).optional(), quitar: z.array(z.string().min(1).max(60)).max(30).optional() }).optional(),
  estado: z.enum(['abiertas', 'pendientes', 'finalizadas']).optional(),
  motivo: z.string().max(200).optional(),
  miembroId: z.string().min(1).max(60).nullable().optional(),
  equipo: z.string().min(1).max(60).optional(),
}).strict()

router.patch('/conversaciones/:id', asyncHandler(async (req: Request, res: Response) => {
  const d = editarSchema.parse(req.body)
  const id = Number(req.params.id) || 0
  const c = await prisma.crmConversacion.findFirst({ where: { id }, include: { contacto: { select: { tags: true } } } })
  if (!c) throw new NotFoundError('Esa conversación no existe en este espacio.')
  const cambios: Json = {}
  if (d.etapa !== undefined) cambios.etq = [d.etapa]
  if (d.etiquetas) {
    const quitar = new Set(d.etiquetas.quitar ?? [])
    cambios.tags = [...new Set([...(c.contacto?.tags ?? []).filter(t => !quitar.has(t)), ...(d.etiquetas.agregar ?? [])])]
  }
  if (d.estado !== undefined) { cambios.est = d.estado; if (d.motivo) cambios.motivo = d.motivo }
  if (d.miembroId !== undefined) cambios.asigId = d.miembroId
  if (d.equipo !== undefined) cambios.equipo = d.equipo
  if (!Object.keys(cambios).length) throw new ValidationError('No mandaste ningún cambio.')
  await llamar(conv.editarConversacion, req, { id: String(id) }, { cambios })
  const nueva = await prisma.crmConversacion.findFirst({ where: { id }, include: conContacto })
  res.json({ data: nueva ? conversacionDe(nueva) : null })
}))

const contactoSchema = z.object({
  nombre: z.string().min(1).max(120).optional(), telefono: z.string().min(5).max(25).optional(), correo: z.string().email().max(160).optional(),
  etapa: z.string().min(1).max(80).optional(), etiquetas: z.array(z.string().min(1).max(60)).max(30).optional(),
}).strict()
const aPantalla = (d: z.infer<typeof contactoSchema>) => {
  const c: Json = {}
  if (d.nombre !== undefined) c.n = d.nombre
  if (d.telefono !== undefined) c.tel = d.telefono
  if (d.correo !== undefined) c.correo = d.correo
  if (d.etapa !== undefined) c.etq = [d.etapa]
  if (d.etiquetas !== undefined) c.tags = d.etiquetas
  return c
}

router.post('/contactos', asyncHandler(async (req: Request, res: Response) => {
  const d = contactoSchema.parse(req.body)
  if (!d.telefono && !d.correo) throw new ValidationError('Un contacto necesita teléfono o correo.')
  const k = await llamar(contactos.crearContacto, req, {}, { contacto: aPantalla(d) })
  res.status(201).json({ data: { id: obj(k).id ?? obj(k).contactoId ?? null } })
}))

router.patch('/contactos/:id', asyncHandler(async (req: Request, res: Response) => {
  const d = contactoSchema.parse(req.body)
  if (!Object.keys(d).length) throw new ValidationError('No mandaste ningún cambio.')
  await llamar(contactos.editarContacto, req, { id: String(Number(req.params.id) || 0) }, { cambios: aPantalla(d) })
  res.json({ data: { id: Number(req.params.id) } })
}))

// ── Flujos y agentes de IA (11-nov): leerlos y encenderlos o apagarlos. Crearlos o editarlos sigue siendo solo en la
// pantalla, para que un error de otro sistema no deje respondiendo mal a todos los clientes. El guardado pasa por el
// mismo controlador de Ajustes (permisos, forma, aviso en vivo) y no pisa lo que alguien guardó al mismo tiempo.
const encenderSchema = z.object({ encendido: z.boolean() })

/** Guarda un ajuste con el controlador de la pantalla, a partir de la versión que se leyó. */
async function guardarComoPantalla(req: Request, clave: 'flujos' | 'agentes', valor: unknown, base: Date | null) {
  const r = Object.assign(Object.create(Object.getPrototypeOf(req)), req, { params: { clave }, body: { valor, base: base ? base.toISOString() : null }, query: {} }) as Request
  let estado = 200
  const res = { statusCode: 200, status(c: number) { estado = c; return this }, json() { return this }, send() { return this }, setHeader() { return this } }
  await ajustes.guardarAjusteRuta(r, res as unknown as Response)
  if (estado === 409) throw new ConflictError('Alguien cambió esto en el CRM al mismo tiempo. Vuelve a intentarlo.')
}
const filaAjuste = (clave: string) => prisma.crmAjuste.findFirst({ where: { clave }, select: { valor: true, updatedAt: true } })

const flujoDe = (f: Json) => ({ id: String(f.id), nombre: String(f.n ?? ''), encendido: f.on === true, cuando: f.cuando ?? null, equipos: Array.isArray(f.equipos) ? f.equipos : null })
async function flujosGuardados() {
  const fila = await filaAjuste('flujos')
  const lista = Array.isArray(fila?.valor) ? (fila!.valor as unknown[]).map(obj) : (FLUJOS_DEFECTO as unknown as Json[])
  return { lista: lista.filter(f => f.id), base: fila?.updatedAt ?? null }
}
router.get('/flujos', asyncHandler(async (_req: Request, res: Response) => {
  res.json({ data: (await flujosGuardados()).lista.map(flujoDe) })
}))
router.patch('/flujos/:id', asyncHandler(async (req: Request, res: Response) => {
  const d = encenderSchema.parse(req.body)
  const { lista, base } = await flujosGuardados()
  const f = lista.find(x => String(x.id) === String(req.params.id))
  if (!f) throw new NotFoundError('Ese flujo no existe en este espacio.')
  if ((f.on === true) !== d.encendido) await guardarComoPantalla(req, 'flujos', lista.map(x => (x === f ? { ...x, on: d.encendido } : x)), base)
  auditLog(req, 'UPDATE', 'api_flujo', String(f.id), { clave: req.apiClave?.id, encendido: d.encendido })
  res.json({ data: flujoDe({ ...f, on: d.encendido }) })
}))

/** Dónde atiende el agente: los canales marcados en su editor (sin ninguno, no contesta). */
const canalesAgente = (a: Json) => (Array.isArray(a.canales) ? a.canales.map(String) : Object.entries(obj(a.canales)).filter(([, v]) => v === true).map(([k]) => k))
const agenteDe = (a: Json) => ({ id: String(a.id), nombre: String(a.nombre ?? ''), encendido: a.estado === 'activo', estado: String(a.estado ?? 'borrador'), canales: canalesAgente(a) })
router.get('/agentes', asyncHandler(async (_req: Request, res: Response) => {
  const fila = await filaAjuste('agentes')
  res.json({ data: (Array.isArray(fila?.valor) ? (fila!.valor as unknown[]).map(obj) : []).filter(a => a.id).map(agenteDe) })
}))
router.patch('/agentes/:id', asyncHandler(async (req: Request, res: Response) => {
  const d = encenderSchema.parse(req.body)
  const fila = await filaAjuste('agentes')
  const lista = Array.isArray(fila?.valor) ? (fila!.valor as unknown[]).map(obj) : []
  const a = lista.find(x => String(x.id) === String(req.params.id))
  if (!a) throw new NotFoundError('Ese agente no existe en este espacio.')
  // Las mismas condiciones que el botón de encendido de la pantalla.
  if (d.encendido) {
    const conectados = (await prisma.crmLinea.count({ where: { estado: 'conectada' } })) + (await prisma.crmConexion.count({ where: { estado: 'conectada', tipo: { not: 'whatsapp' } } }))
    if (!conectados) throw new ValidationError('Conecta un canal al CRM (Ajustes del CRM, Canales) para encender el agente.')
    if (!canalesAgente(a).length) throw new ValidationError(`Marca un canal en «Dónde atiende» de ${String(a.nombre ?? 'el agente')} para encenderlo.`)
  }
  const estado = d.encendido ? 'activo' : 'pausado'
  if (a.estado !== estado) await guardarComoPantalla(req, 'agentes', lista.map(x => (x === a ? { ...x, estado } : x)), fila?.updatedAt ?? null)
  auditLog(req, 'UPDATE', 'api_agente', String(a.id), { clave: req.apiClave?.id, encendido: d.encendido })
  res.json({ data: agenteDe({ ...a, estado }) })
}))

router.use((_req: Request, res: Response) => { res.status(404).json({ error: 'Esa ruta no existe en la API v1. Revisa la documentación.' }) })
// Errores en el mismo formato { error } que el resto de la API.
router.use((err: Error & { statusCode?: number; errors?: unknown }, _req: Request, res: Response, _next: NextFunction) => {
  const zod = (err as { name?: string }).name === 'ZodError'
  const status = zod ? 400 : err.statusCode && err.statusCode < 500 ? err.statusCode : 500
  res.status(status).json({ error: zod ? 'Datos inválidos: revisa los campos que mandaste.' : status === 500 ? 'Error interno. Intenta de nuevo.' : err.message, ...(zod ? { detalle: (err as unknown as { errors: unknown }).errors } : {}) })
})

export default router
