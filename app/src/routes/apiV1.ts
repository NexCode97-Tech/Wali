import { Router, type Request, type Response, type NextFunction } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { asyncHandler } from '../middleware/errorHandler'
import { conClaveApi } from '../services/crm/apiClaves'
import { prisma } from '../services/crm/bd'
import { leerAjuste } from '../services/crm/ajustes'
import { usuariosCrm } from '../services/crm/usuarios'
import { leerEquipos, equipoRespaldo } from '../services/crm/equipos'
import { auditLog } from '../utils/auditLogger'
import { ConflictError, NotFoundError, ValidationError } from '../utils/errors'
import { FLUJOS_DEFECTO } from '../services/crm/flujos'
import { CONSULTAS } from '../services/crm/integraciones'
import { dentroDeHorario } from '../services/crm/entrantes'
import * as ajustes from '../controllers/crm/ajustes.controller'
import * as conv from '../controllers/crm/conversaciones.controller'
import * as contactos from '../controllers/crm/contactos.controller'

/**
 * API pública de Wali, versión 1 (11-nov). Base: https://walicrm.com/crm/api/v1. Va con
 * `Authorization: Bearer wali_live_…` (la clave de Ajustes del CRM › API). Todo dentro del espacio de la clave.
 *
 * Lectura: conversaciones (con filtros y sus mensajes), contactos, equipos, miembros, etapas, etiquetas, líneas, flujos, agentes
 * y el horario de atención (turnos, festivos y mensaje fuera de horario), que también se cambia (12-nov).
 * Acciones (clave de lectura y acciones): asignar (también en lote, hasta 100), cambiar la etapa, poner o quitar
 * etiquetas, finalizar o reabrir, y crear o editar contactos. Desde el 24-nov también se crean, editan y borran flujos,
 * agentes de IA, reglas automáticas, etiquetas y etapas (lo mismo que se arma en la pantalla). Las acciones pasan por los mismos controladores que la
 * pantalla: mismos permisos, validaciones, avisos en vivo y registro. Respuestas: { data, siguiente? } o { error }.
 */
const router = Router()

router.use(conClaveApi)
// El equipo de respaldo del espacio, leído al empezar (las respuestas lo usan para las conversaciones sin equipo).
router.use((_req: Request, _res: Response, next: NextFunction) => { leerEquipos().then(() => next(), next) })
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
  id: c.id, estado: c.estado, canal: c.canal, asignadoId: c.asignadoId, equipo: c.equipo || equipoRespaldo(), prioridad: c.prioridad, lineaId: c.lineaId,
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
/** Las etapas del embudo, cada una con su equipo (sin equipo es del equipo inicial). Las de fábrica si nunca se cambiaron. */
const ETAPAS_FABRICA: [string, string][] = [['Nuevo lead', '#EC87C0'], ['Contactado', '#5D9CEC'], ['Caliente', '#FC6E51'], ['En seguimiento', '#AC92EC'], ['No interesado/perdido', '#434A54'], ['Pagado', '#A0D468'], ['Link errado', '#AAB2BD'], ['Sin respuesta', '#C9CED6']]
async function etapasGuardadas() {
  const fila = await filaAjuste('etapas')
  const lista = Array.isArray(fila?.valor) ? (fila!.valor as unknown[]).filter(Array.isArray) as unknown[][] : ETAPAS_FABRICA.map(x => [...x])
  return { lista, base: fila?.updatedAt ?? null }
}
const etapaDe = (x: unknown[]) => ({ nombre: String(x[0] ?? ''), color: x[1] ? String(x[1]) : null, equipo: x[2] ? String(x[2]) : equipoRespaldo() })
router.get('/etapas', asyncHandler(async (_req: Request, res: Response) => {
  res.json({ data: (await etapasGuardadas()).lista.map(etapaDe).filter(e => e.nombre) })
}))

/**
 * POST /etapas (19-nov): crea una etapa del embudo en un equipo, al final de las de ese equipo, como «Nueva etapa» en
 * Ajustes › Etapas del embudo. Se guarda por el mismo camino de la pantalla (validación y aviso en vivo a quien tenga
 * el CRM abierto). Sin color, uno de la paleta de la pantalla; sin equipo, Ventas.
 */
const etapaSchema = z.object({
  nombre: z.string({ required_error: 'Falta «nombre» con el nombre de la etapa.' }).trim().min(1, 'El nombre de la etapa no puede ir vacío.').max(60, 'El nombre de la etapa puede tener máximo 60 caracteres.'),
  color: z.string().regex(/^#[0-9a-f]{6}$/i, '«color» debe ser un color como #2563eb.').optional(),
  equipo: z.string().trim().min(1).max(60).optional(),
}).strict()
const PALETA_ETAPAS = ['#EC87C0', '#5D9CEC', '#FC6E51', '#AC92EC', '#48CFAD', '#FFCE54', '#A0D468', '#ED5565', '#4FC1E9', '#AAB2BD']
router.post('/etapas', asyncHandler(async (req: Request, res: Response) => {
  const d = etapaSchema.parse(req.body)
  const equipos = Object.keys((await leerEquipos()).miembros)
  const equipo = d.equipo ?? equipoRespaldo()
  if (!equipos.includes(equipo)) throw new ValidationError(`«${equipo}» no es un equipo de este espacio. Los equipos son: ${equipos.join(', ') || 'ninguno'} (GET /equipos).`)
  const { lista, base } = await etapasGuardadas()
  const delEquipo = (x: unknown[]) => (x[2] ? String(x[2]) : equipoRespaldo()) === equipo
  if (lista.some(x => delEquipo(x) && String(x[0]).trim().toLowerCase() === d.nombre.toLowerCase())) throw new ConflictError(`${equipo} ya tiene una etapa «${d.nombre}».`)
  const color = d.color ?? PALETA_ETAPAS[lista.filter(delEquipo).length % PALETA_ETAPAS.length]
  // Al final de las de su equipo (el embudo de cada equipo va en el orden de la lista).
  const ultima = lista.map(delEquipo).lastIndexOf(true)
  const nueva = [d.nombre, color, equipo]
  const nuevaLista = [...lista]
  nuevaLista.splice(ultima >= 0 ? ultima + 1 : nuevaLista.length, 0, nueva)
  await guardarComoPantalla(req, 'etapas', nuevaLista, base)
  auditLog(req, 'CREATE', 'api_etapa', d.nombre, { clave: req.apiClave?.id, equipo })
  res.status(201).json({ data: etapaDe(nueva) })
}))
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

// ── Flujos, agentes de IA, reglas automáticas, etiquetas y etapas (24-nov, pedido del usuario: «todo lo que se arma en
// la pantalla se puede crear por la API»). Cada cambio se valida aquí con la misma forma y las mismas opciones del
// editor de la pantalla (un flujo o una regla mal armados no llegan a los clientes) y se guarda por el controlador de
// Ajustes (permisos, aviso en vivo a quien tenga el CRM abierto) sin pisar lo que alguien guardó al mismo tiempo (409).
const encenderSchema = z.object({ encendido: z.boolean() })

/** Guarda un ajuste con el controlador de la pantalla, a partir de la versión que se leyó. */
async function guardarComoPantalla(req: Request, clave: 'flujos' | 'agentes' | 'cfg' | 'etapas' | 'etiquetas' | 'reglas', valor: unknown, base: Date | null) {
  const r = Object.assign(Object.create(Object.getPrototypeOf(req)), req, { params: { clave }, body: { valor, base: base ? base.toISOString() : null }, query: {} }) as Request
  let estado = 200
  const res = { statusCode: 200, status(c: number) { estado = c; return this }, json() { return this }, send() { return this }, setHeader() { return this } }
  await ajustes.guardarAjusteRuta(r, res as unknown as Response)
  if (estado === 409) throw new ConflictError('Alguien cambió esto en el CRM al mismo tiempo. Vuelve a intentarlo.')
}
const filaAjuste = (clave: string) => prisma.crmAjuste.findFirst({ where: { clave }, select: { valor: true, updatedAt: true } })
const idNuevo = (pre: string) => `${pre}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`
const textoApi = (que: string, max: number) => z.string({ required_error: `Falta «${que}».`, invalid_type_error: `«${que}» debe ser un texto.` }).trim().min(1, `«${que}» no puede ir vacío.`).max(max, `«${que}» puede tener máximo ${max} caracteres.`).refine(t => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(t), `«${que}» tiene caracteres que no se pueden guardar.`)
const CANALES_API = ['wa', 'ig', 'fb', 'tg', 'tt', 'web', 'mail'] as const
const NOMBRE_CANAL: Record<string, string> = { wa: 'WhatsApp', ig: 'Instagram', fb: 'Messenger', tg: 'Telegram', tt: 'TikTok', web: 'Chat de la web', mail: 'Correo' }
const invertir = (m: Record<string, string>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k]))

/** Lo que existe en el espacio, para validar nombres de equipos, miembros, etiquetas y etapas. */
async function catalogo() {
  const [eq, miembros, etiq, et] = await Promise.all([leerEquipos(), usuariosCrm(), leerAjuste<unknown>('etiquetas'), etapasGuardadas()])
  const etiquetas = (Array.isArray(etiq) ? etiq : []).map(x => (Array.isArray(x) ? String(x[0] ?? '') : String(obj(x).n ?? ''))).filter(Boolean)
  return { equipos: Object.keys(eq.miembros), miembros: miembros.map(u => ({ id: u.id, nombre: u.nombre })), etiquetas, etapas: [...new Set(et.lista.map(x => String(x[0] ?? '')).filter(Boolean))] }
}
type Catalogo = Awaited<ReturnType<typeof catalogo>>
const exigirEquipo = (c: Catalogo, e: string) => { if (!c.equipos.includes(e)) throw new ValidationError(`«${e}» no es un equipo de este espacio. Los equipos son: ${c.equipos.join(', ') || 'ninguno'} (GET /equipos).`) }
const exigirEtiqueta = (c: Catalogo, e: string) => { if (!c.etiquetas.includes(e)) throw new ValidationError(`«${e}» no es una etiqueta de este espacio. Créala antes con POST /etiquetas o revisa GET /etiquetas.`) }
const exigirEtapa = (c: Catalogo, e: string) => { if (!c.etapas.includes(e)) throw new ValidationError(`«${e}» no es una etapa de este espacio. Créala antes con POST /etapas o revisa GET /etapas.`) }
const nombreMiembro = (c: Catalogo, id: string) => { const m = c.miembros.find(x => x.id === id); if (!m) throw new ValidationError(`«${id}» no es un miembro de este espacio (GET /miembros).`); return m.nombre }

// ─ Flujos ─
const CUANDO_FLUJO: Record<string, string> = { 'primer-mensaje': 'Llega el primer mensaje de un número nuevo', 'fuera-de-horario': 'Llega un mensaje fuera de horario', 'anuncio': 'Llega desde un anuncio' }
const GUARDAR_EN: Record<string, string> = { nombre: 'Nombre del contacto', correo: 'Correo', ciudad: 'Ciudad', producto: 'Producto' }
const VALIDAR: Record<string, string> = { 'nombre-y-apellido': 'Nombre y apellido', 'texto-libre': 'Texto libre', correo: 'Correo', numero: 'Número' }
const pasoSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('mensaje'), texto: textoApi('texto', 1000) }).strict(),
  z.object({ tipo: z.literal('pregunta'), texto: textoApi('texto', 1000), guardarEn: z.enum(['nombre', 'correo', 'ciudad', 'producto']), validar: z.enum(['nombre-y-apellido', 'texto-libre', 'correo', 'numero']), reintento: textoApi('reintento', 500).optional() }).strict(),
  z.object({ tipo: z.literal('botones'), texto: textoApi('texto', 1000), opciones: z.array(textoApi('opción', 24)).min(1, 'Un paso de botones necesita al menos una opción.').max(6, 'Un paso de botones puede tener máximo 6 opciones.'), ponerEtiqueta: z.boolean().optional() }).strict(),
  z.object({ tipo: z.literal('etiqueta'), etiqueta: textoApi('etiqueta', 60) }).strict(),
  z.object({ tipo: z.literal('asignar'), equipo: textoApi('equipo', 80).optional(), miembroId: z.string().min(1).max(60).optional() }).strict(),
  z.object({ tipo: z.literal('avanzado'), datos: z.record(z.unknown()) }).strict(),
])
const flujoCampos = {
  nombre: textoApi('nombre', 60),
  encendido: z.boolean(),
  cuando: z.enum(['primer-mensaje', 'fuera-de-horario', 'anuncio']),
  canales: z.array(z.enum(CANALES_API)).min(1, 'Elige al menos un canal.').max(7),
  equipos: z.array(textoApi('equipo', 80)).max(30).nullable(),
  saltarConocidos: z.boolean(),
  esperaMinutos: z.number().int().min(1).max(1440),
  pasos: z.array(pasoSchema).min(1, 'Un flujo necesita al menos un paso.').max(30, 'Un flujo puede tener máximo 30 pasos.'),
}
const flujoNuevoSchema = z.object({ ...flujoCampos, encendido: flujoCampos.encendido.optional(), cuando: flujoCampos.cuando.optional(), canales: flujoCampos.canales.optional(), equipos: flujoCampos.equipos.optional(), saltarConocidos: flujoCampos.saltarConocidos.optional(), esperaMinutos: flujoCampos.esperaMinutos.optional() }).strict()
const flujoCambioSchema = z.object(Object.fromEntries(Object.entries(flujoCampos).map(([k, v]) => [k, (v as z.ZodTypeAny).optional()])) as { [K in keyof typeof flujoCampos]: z.ZodOptional<(typeof flujoCampos)[K]> }).strict()

const G_INV = invertir(GUARDAR_EN), V_INV = invertir(VALIDAR), C_INV = invertir(CUANDO_FLUJO)
function pasoDe(p: Json): Json {
  const t = String(p.t ?? '')
  if (t === 'mensaje') return { tipo: 'mensaje', texto: String(p.txt ?? '') }
  if (t === 'pregunta') return { tipo: 'pregunta', texto: String(p.txt ?? ''), guardarEn: G_INV[String(p.guardar)] ?? null, validar: V_INV[String(p.validar)] ?? 'texto-libre', ...(p.reintento ? { reintento: String(p.reintento) } : {}) }
  if (t === 'botones') return { tipo: 'botones', texto: String(p.txt ?? ''), opciones: (Array.isArray(p.ops) ? p.ops : []).map(String), ponerEtiqueta: String(p.guardar ?? '').toLowerCase() === 'etiqueta' }
  if (t === 'etiqueta') return { tipo: 'etiqueta', etiqueta: String(p.tag ?? '') }
  if (t === 'asignar') { const a = String(p.a ?? ''), m = a.match(/equipo\s+(.+)$/i); return { tipo: 'asignar', ...(m ? { equipo: m[1].trim() } : { miembro: a }) } }
  return { tipo: 'avanzado', datos: p }
}
async function pasoAInterno(p: z.infer<typeof pasoSchema>, c: Catalogo): Promise<Json> {
  if (p.tipo === 'mensaje') return { t: 'mensaje', txt: p.texto }
  if (p.tipo === 'pregunta') return { t: 'pregunta', txt: p.texto, guardar: GUARDAR_EN[p.guardarEn], validar: VALIDAR[p.validar], ...(p.reintento ? { reintento: p.reintento } : {}) }
  if (p.tipo === 'botones') {
    if (new Set(p.opciones.map((o: string) => o.toLowerCase())).size !== p.opciones.length) throw new ValidationError('Las opciones de un paso de botones no se pueden repetir.')
    // Hasta 3 opciones van como botones de WhatsApp (20 caracteres); de 4 a 6 salen como lista (24 caracteres).
    const largo = p.opciones.length <= 3 ? 20 : 24, pasada = p.opciones.find((o: string) => o.length > largo)
    if (pasada) throw new ValidationError(`La opción «${pasada}» es muy larga: con ${p.opciones.length <= 3 ? '3 opciones o menos' : '4 a 6 opciones'} cada una puede tener máximo ${largo} caracteres.`)
    return { t: 'botones', txt: p.texto, ops: p.opciones, ...(p.ponerEtiqueta ? { guardar: 'Etiqueta' } : {}) }
  }
  if (p.tipo === 'etiqueta') { exigirEtiqueta(c, p.etiqueta); return { t: 'etiqueta', tag: p.etiqueta } }
  if (p.tipo === 'asignar') {
    if (!p.equipo === !p.miembroId) throw new ValidationError('El paso «asignar» lleva «equipo» (reparto automático en ese equipo) o «miembroId», uno de los dos.')
    if (p.equipo) { exigirEquipo(c, p.equipo); return { t: 'asignar', a: `Reparto automático · equipo ${p.equipo}` } }
    return { t: 'asignar', a: nombreMiembro(c, p.miembroId!) }
  }
  // «avanzado»: los pasos que la API no arma (la pregunta que reparte por área), tal como se leyeron con GET.
  if (p.datos.t !== 'ramas') throw new ValidationError('Un paso «avanzado» solo puede ser el que devolvió GET /flujos/:id, sin cambios.')
  return p.datos
}
const flujoDe = (f: Json) => ({ id: String(f.id), nombre: String(f.n ?? ''), encendido: f.on === true, cuando: C_INV[String(f.cuando)] ?? 'primer-mensaje', canales: Array.isArray(f.canales) ? f.canales : ['wa'], equipos: Array.isArray(f.equipos) && f.equipos.length ? f.equipos : null })
const flujoCompleto = (f: Json) => ({ ...flujoDe(f), saltarConocidos: f.saltarConocidos !== false, esperaMinutos: Number(f.espera) || 10, pasos: (Array.isArray(f.pasos) ? f.pasos : []).map(x => pasoDe(obj(x))) })
async function flujosGuardados() {
  const fila = await filaAjuste('flujos')
  const lista = Array.isArray(fila?.valor) ? (fila!.valor as unknown[]).map(obj) : (FLUJOS_DEFECTO as unknown as Json[])
  return { lista: lista.filter(f => f.id), base: fila?.updatedAt ?? null }
}
/** Aplica a un flujo lo que llegó por la API (los campos que no se mandan quedan como estaban). */
async function aplicarFlujo(f: Json, d: Partial<z.infer<typeof flujoNuevoSchema>>, lista: Json[]): Promise<Json> {
  const c = await catalogo()
  const n: Json = { ...f }
  if (d.nombre !== undefined) {
    if (lista.some(x => x !== f && String(x.n ?? '').trim().toLowerCase() === d.nombre!.toLowerCase())) throw new ConflictError(`Ya hay un flujo llamado «${d.nombre}».`)
    n.n = d.nombre
  }
  if (d.encendido !== undefined) n.on = d.encendido
  if (d.cuando !== undefined) n.cuando = CUANDO_FLUJO[d.cuando]
  if (d.canales !== undefined) { n.canales = [...new Set(d.canales)]; delete n.vias }
  if (d.equipos !== undefined) { if (d.equipos) d.equipos.forEach(e => exigirEquipo(c, e)); if (d.equipos && d.equipos.length) n.equipos = [...new Set(d.equipos)]; else delete n.equipos }
  if (d.saltarConocidos !== undefined) n.saltarConocidos = d.saltarConocidos
  if (d.esperaMinutos !== undefined) n.espera = d.esperaMinutos
  if (d.pasos !== undefined) {
    const i = d.pasos.findIndex(p => p.tipo === 'asignar')
    if (i >= 0 && i !== d.pasos.length - 1) throw new ValidationError('El paso «asignar» termina el flujo: va de último.')
    n.pasos = []
    for (const p of d.pasos) (n.pasos as Json[]).push(await pasoAInterno(p, c))
  }
  return n
}
router.get('/flujos', asyncHandler(async (_req: Request, res: Response) => {
  res.json({ data: (await flujosGuardados()).lista.map(flujoDe) })
}))
router.get('/flujos/:id', asyncHandler(async (req: Request, res: Response) => {
  const f = (await flujosGuardados()).lista.find(x => String(x.id) === String(req.params.id))
  if (!f) throw new NotFoundError('Ese flujo no existe en este espacio.')
  res.json({ data: flujoCompleto(f) })
}))
router.post('/flujos', asyncHandler(async (req: Request, res: Response) => {
  const d = flujoNuevoSchema.parse(req.body)
  const { lista, base } = await flujosGuardados()
  if (lista.length >= 50) throw new ValidationError('Caben máximo 50 flujos por espacio.')
  const base0: Json = { id: idNuevo('f'), n: d.nombre, on: false, cuando: CUANDO_FLUJO['primer-mensaje'], canales: ['wa'], saltarConocidos: true, espera: 10, pasos: [] }
  const nuevo = await aplicarFlujo(base0, d, lista)
  await guardarComoPantalla(req, 'flujos', [...lista, nuevo], base)
  auditLog(req, 'CREATE', 'api_flujo', String(nuevo.id), { clave: req.apiClave?.id })
  res.status(201).json({ data: flujoCompleto(nuevo) })
}))
async function cambiarFlujo(req: Request, res: Response, d: Partial<z.infer<typeof flujoNuevoSchema>>) {
  const { lista, base } = await flujosGuardados()
  const f = lista.find(x => String(x.id) === String(req.params.id))
  if (!f) throw new NotFoundError('Ese flujo no existe en este espacio.')
  if (!Object.keys(d).length) throw new ValidationError('No mandaste ningún cambio.')
  const nuevo = await aplicarFlujo(f, d, lista)
  await guardarComoPantalla(req, 'flujos', lista.map(x => (x === f ? nuevo : x)), base)
  auditLog(req, 'UPDATE', 'api_flujo', String(f.id), { clave: req.apiClave?.id, campos: Object.keys(d) })
  res.json({ data: flujoCompleto(nuevo) })
}
// PATCH cambia solo lo que se manda (también sirve para encender o apagar, como antes); PUT reemplaza el flujo entero.
router.patch('/flujos/:id', asyncHandler(async (req: Request, res: Response) => { await cambiarFlujo(req, res, flujoCambioSchema.parse(req.body)) }))
router.put('/flujos/:id', asyncHandler(async (req: Request, res: Response) => { await cambiarFlujo(req, res, flujoNuevoSchema.parse(req.body)) }))
router.delete('/flujos/:id', asyncHandler(async (req: Request, res: Response) => {
  const { lista, base } = await flujosGuardados()
  const f = lista.find(x => String(x.id) === String(req.params.id))
  if (!f) throw new NotFoundError('Ese flujo no existe en este espacio.')
  await guardarComoPantalla(req, 'flujos', lista.filter(x => x !== f), base)
  auditLog(req, 'DELETE', 'api_flujo', String(f.id), { clave: req.apiClave?.id })
  res.json({ data: { id: String(f.id), borrado: true } })
}))

// ─ Agentes de IA ─
/** Dónde atiende el agente: los canales marcados en su editor (sin ninguno, no contesta). */
const canalesAgente = (a: Json) => (Array.isArray(a.canales) ? a.canales.map(String) : Object.entries(obj(a.canales)).filter(([, v]) => v === true).map(([k]) => k))
const agenteDe = (a: Json) => ({ id: String(a.id), nombre: String(a.nombre ?? ''), encendido: a.estado === 'activo', estado: String(a.estado ?? 'borrador'), canales: canalesAgente(a) })
const PLANTILLAS_AGENTE: Record<string, { n: string; que: string[]; etapa: boolean }> = {
  recep: { n: 'Recepcionista', que: ['Saluda y pregunta el nombre de forma natural, sin menús ni botones.', 'Revisa si el número ya es de un cliente y entiende en una frase qué necesita.', 'Pasa la conversación de una a Ventas con una nota: quién es, qué necesita y si parece de soporte.'], etapa: false },
  ventas: { n: 'Agente de ventas', que: ['Descubre qué busca el lead y qué producto le interesa.', 'Recomienda el producto que le sirve según la base de conocimiento.', 'Pasa al asesor cuando la persona pide el enlace de pago, para que la venta quede a su nombre.'], etapa: true },
  soporte: { n: 'Agente de soporte', que: ['Resuelve dudas frecuentes de uso, entregas, horarios y acceso.', 'Si no puede resolverlo, pasa a Soporte de ventas o a Soporte con el caso resumido.'], etapa: false },
  cero: { n: 'Agente nuevo', que: ['Escribe aquí qué hace tu agente.'], etapa: false },
}
const CUANDO_AGENTE: Record<string, string> = { siempre: 'Siempre', 'fuera-de-horario': 'Solo fuera del horario de atención', 'en-horario': 'Solo en el horario de atención' }
const LARGO: Record<string, string> = { cortas: 'Cortas, de 1 a 3 líneas', medianas: 'Medianas, hasta 5 líneas' }
const IDIOMAS = ['Español', 'Inglés', 'Portugués', 'Francés'] as const
const agenteCampos = {
  nombre: textoApi('nombre', 60),
  presentacion: z.string().trim().max(300),
  queHace: textoApi('queHace', 4000),
  tono: textoApi('tono', 200),
  largoRespuestas: z.enum(['cortas', 'medianas']),
  emojis: z.boolean(),
  idioma: z.enum(IDIOMAS),
  contexto: z.string().trim().max(8000),
  criterios: z.string().trim().max(4000),
  adicionales: z.string().trim().max(4000),
  cuandoAtiende: z.enum(['siempre', 'fuera-de-horario', 'en-horario']),
  canales: z.array(z.enum(CANALES_API)).max(7),
  pasaSiempreA: textoApi('pasaSiempreA', 80),
  temas: z.array(z.object({ tema: textoApi('tema', 300), equipo: textoApi('equipo', 80) }).strict()).max(20),
  acciones: z.object({ datos: z.boolean(), equipo: z.boolean(), etapa: z.boolean(), nota: z.boolean(), inactivas: z.boolean(), finalizar: z.boolean() }).partial().strict(),
  pasaAPersona: z.object({ listo: z.boolean(), persona: z.boolean(), molesto: z.boolean(), mensajes: z.boolean(), enlace: z.boolean() }).partial().strict(),
  mensajesAntesDePasar: z.number().int().min(2).max(50),
  recopilar: z.array(z.string().regex(/^[\w]{1,40}$/, 'Cada dato de «recopilar» va como nombre, correo o la clave de un campo.')).max(20),
  silencioso: z.boolean(),
  consultas: z.array(z.string().min(1).max(60)).max(10),
}
const opcional = <T extends Record<string, z.ZodTypeAny>>(o: T) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v.optional()])) as { [K in keyof T]: z.ZodOptional<T[K]> }
const agenteNuevoSchema = z.object({ plantilla: z.enum(['recep', 'ventas', 'soporte', 'cero']), encendido: z.boolean().optional(), ...opcional(agenteCampos) }).strict()
const agenteCambioSchema = z.object({ encendido: z.boolean().optional(), ...opcional(agenteCampos) }).strict()
const C_AG_INV = invertir(CUANDO_AGENTE), L_INV = invertir(LARGO)
const agenteCompleto = (a: Json) => ({
  ...agenteDe(a), plantilla: String(a.tpl ?? 'cero'), presentacion: String(a.presenta ?? ''), queHace: String(a.que ?? ''), tono: String(a.tono ?? ''),
  largoRespuestas: L_INV[String(a.largo)] ?? 'cortas', emojis: a.emojis !== false, idioma: String(a.idioma ?? 'Español'), contexto: String(a.contexto ?? ''),
  criterios: String(a.criterios ?? ''), adicionales: String(a.adicionales ?? ''), cuandoAtiende: C_AG_INV[String(a.cuando)] ?? 'siempre',
  pasaSiempreA: String(a.destino ?? equipoRespaldo()), temas: (Array.isArray(a.temas) ? a.temas : []).filter(Array.isArray).map(t => ({ tema: String((t as unknown[])[0] ?? ''), equipo: String((t as unknown[])[1] ?? '') })),
  acciones: obj(a.acc), pasaAPersona: obj(a.pasa), mensajesAntesDePasar: Number(a.nMsj) || 6, recopilar: Array.isArray(a.recopilar) ? a.recopilar : ['nombre'],
  silencioso: a.silencioso === true, consultas: Array.isArray(a.consultas) ? a.consultas : [],
  conocimiento: (Array.isArray(a.kb) ? a.kb : []).length,
})
async function aplicarAgente(a: Json, d: Partial<z.infer<typeof agenteCambioSchema>>): Promise<Json> {
  const c = await catalogo()
  const n: Json = { ...a }
  if (d.nombre !== undefined) n.nombre = d.nombre
  if (d.presentacion !== undefined) n.presenta = d.presentacion
  if (d.queHace !== undefined) n.que = d.queHace
  if (d.tono !== undefined) n.tono = d.tono
  if (d.largoRespuestas !== undefined) n.largo = LARGO[d.largoRespuestas]
  if (d.emojis !== undefined) n.emojis = d.emojis
  if (d.idioma !== undefined) n.idioma = d.idioma
  if (d.contexto !== undefined) n.contexto = d.contexto
  if (d.criterios !== undefined) n.criterios = d.criterios
  if (d.adicionales !== undefined) n.adicionales = d.adicionales
  if (d.cuandoAtiende !== undefined) n.cuando = CUANDO_AGENTE[d.cuandoAtiende]
  if (d.canales !== undefined) n.canales = Object.fromEntries([...new Set(d.canales)].map(k => [k, true]))
  if (d.pasaSiempreA !== undefined) { exigirEquipo(c, d.pasaSiempreA); n.destino = d.pasaSiempreA }
  if (d.temas !== undefined) { d.temas.forEach(t => exigirEquipo(c, t.equipo)); n.temas = d.temas.map(t => [t.tema, t.equipo]) }
  if (d.acciones !== undefined) n.acc = { ...obj(a.acc), ...d.acciones }
  if (d.pasaAPersona !== undefined) n.pasa = { ...obj(a.pasa), ...d.pasaAPersona }
  if (d.mensajesAntesDePasar !== undefined) n.nMsj = String(d.mensajesAntesDePasar)
  if (d.recopilar !== undefined) n.recopilar = [...new Set(d.recopilar)]
  if (d.silencioso !== undefined) n.silencioso = d.silencioso
  if (d.consultas !== undefined) {
    const malas = d.consultas.filter(id => !CONSULTAS.some(x => x.id === id))
    if (malas.length) throw new ValidationError(`Estas consultas no existen: ${malas.join(', ')}. Las que hay son: ${CONSULTAS.map(x => x.id).join(', ')}.`)
    n.consultas = [...new Set(d.consultas)]
  }
  if (d.encendido !== undefined) {
    if (d.encendido) {
      // Las mismas condiciones que el botón de encendido de la pantalla.
      const conectados = (await prisma.crmLinea.count({ where: { estado: 'conectada' } })) + (await prisma.crmConexion.count({ where: { estado: 'conectada', tipo: { not: 'whatsapp' } } }))
      if (!conectados) throw new ValidationError('Conecta un canal al CRM (Ajustes del CRM, Canales) para encender el agente.')
      if (!canalesAgente(n).length) throw new ValidationError(`Marca un canal en «canales» de ${String(n.nombre ?? 'el agente')} para encenderlo.`)
    }
    n.estado = d.encendido ? 'activo' : (a.estado === 'borrador' ? 'borrador' : 'pausado')
  }
  return n
}
async function agentesGuardados() {
  const fila = await filaAjuste('agentes')
  return { lista: (Array.isArray(fila?.valor) ? (fila!.valor as unknown[]).map(obj) : []).filter(a => a.id), base: fila?.updatedAt ?? null }
}
router.get('/agentes', asyncHandler(async (_req: Request, res: Response) => {
  res.json({ data: (await agentesGuardados()).lista.map(agenteDe) })
}))
router.get('/agentes/:id', asyncHandler(async (req: Request, res: Response) => {
  const a = (await agentesGuardados()).lista.find(x => String(x.id) === String(req.params.id))
  if (!a) throw new NotFoundError('Ese agente no existe en este espacio.')
  res.json({ data: agenteCompleto(a) })
}))
router.post('/agentes', asyncHandler(async (req: Request, res: Response) => {
  const d = agenteNuevoSchema.parse(req.body)
  const { lista, base } = await agentesGuardados()
  if (lista.length >= 30) throw new ValidationError('Caben máximo 30 agentes por espacio.')
  const t = PLANTILLAS_AGENTE[d.plantilla], destino = equipoRespaldo()
  // Lo mismo que «Usar esta plantilla» en Agentes IA (nuevoAgente de 50-agentes.js).
  const base0: Json = {
    id: idNuevo('ag'), tpl: d.plantilla, nombre: t.n, presenta: '', estado: 'borrador', que: t.que.join('\n'),
    acc: { datos: true, equipo: true, etapa: t.etapa, nota: true, inactivas: t.etapa, finalizar: false }, destino,
    tono: 'Cercano y cálido, tutea a la persona', largo: LARGO.cortas, emojis: true,
    pasa: { listo: true, persona: true, molesto: true, mensajes: true, enlace: true }, nMsj: '6', temas: [],
    canales: { wa: true, web: true }, cuando: 'Siempre', kb: [], contexto: '', idioma: 'Español', criterios: '', adicionales: '', recopilar: ['nombre'], silencioso: false,
  }
  const { plantilla: _p, ...resto } = d
  const nuevo = await aplicarAgente(base0, resto)
  await guardarComoPantalla(req, 'agentes', [...lista, nuevo], base)
  auditLog(req, 'CREATE', 'api_agente', String(nuevo.id), { clave: req.apiClave?.id, plantilla: d.plantilla })
  res.status(201).json({ data: agenteCompleto(nuevo) })
}))
router.patch('/agentes/:id', asyncHandler(async (req: Request, res: Response) => {
  const d = agenteCambioSchema.parse(req.body)
  if (!Object.keys(d).length) throw new ValidationError('No mandaste ningún cambio.')
  const { lista, base } = await agentesGuardados()
  const a = lista.find(x => String(x.id) === String(req.params.id))
  if (!a) throw new NotFoundError('Ese agente no existe en este espacio.')
  const nuevo = await aplicarAgente(a, d)
  await guardarComoPantalla(req, 'agentes', lista.map(x => (x === a ? nuevo : x)), base)
  auditLog(req, 'UPDATE', 'api_agente', String(a.id), { clave: req.apiClave?.id, campos: Object.keys(d) })
  res.json({ data: agenteCompleto(nuevo) })
}))
router.delete('/agentes/:id', asyncHandler(async (req: Request, res: Response) => {
  const { lista, base } = await agentesGuardados()
  const a = lista.find(x => String(x.id) === String(req.params.id))
  if (!a) throw new NotFoundError('Ese agente no existe en este espacio.')
  await guardarComoPantalla(req, 'agentes', lista.filter(x => x !== a), base)
  auditLog(req, 'DELETE', 'api_agente', String(a.id), { clave: req.apiClave?.id })
  res.json({ data: { id: String(a.id), borrado: true } })
}))

// ─ Reglas automáticas («cuando pasa esto, si se cumple esto, haz esto»). Se guardan con los mismos textos que arma el
// editor de la pantalla (reglaTipos de 10-nucleo.js), que son los que entiende services/crm/reglas.ts. Se identifican
// por su nombre, que no se repite.
const CUANDO_REGLA: Record<string, string> = {
  'mensaje-nuevo': 'Llega un mensaje nuevo', 'se-asigna': 'Se asigna una conversación', 'cambia-etapa': 'Cambia la etapa',
  'pago-confirmado': 'Se confirma un pago', '48-horas-sin-respuesta': 'Pasan 48 horas sin respuesta del cliente', 'se-finaliza': 'Se finaliza la conversación',
}
const SI_FIJAS: Record<string, string> = { 'fuera-de-horario': 'Fuera del horario de atención', anuncio: 'Viene de un anuncio', 'a-cuotas': 'Es a cuotas', 'sin-asesor': 'Sin asesor' }
const ENT_FIJAS: Record<string, string> = { 'crear-recordatorio': 'Crear recordatorio para el asesor', 'avisar-al-lider': 'Avisar al líder', 'dejar-resumen': 'Dejar resumen en nota privada', 'agente-ia-responde': 'El agente IA responde' }
const SI_CON: Record<string, string> = { canal: 'Canal es ', linea: 'Línea es ', etapa: 'Etapa es ', etiqueta: 'Tiene la etiqueta ' }
const ENT_CON: Record<string, string> = {
  'asignar-por-turnos': 'Asignar por turnos al equipo ', 'asignar-a': 'Asignar a ', 'pasar-al-equipo': 'Pasar al equipo ', 'cambiar-etapa': 'Cambiar etapa a ',
  'agregar-etiqueta': 'Agregar etiqueta ', 'quitar-etiqueta': 'Quitar etiqueta ', 'enviar-plantilla': 'Enviar plantilla ', 'enviar-respuesta-rapida': 'Enviar respuesta rápida ',
}
const pieza = z.object({ tipo: z.string().min(1).max(40), valor: z.string().trim().min(1).max(120).optional() }).strict()
const reglaCampos = {
  nombre: textoApi('nombre', 80),
  encendida: z.boolean(),
  cuando: z.enum(Object.keys(CUANDO_REGLA) as [string, ...string[]]),
  condiciones: z.array(pieza).max(10),
  acciones: z.array(pieza).min(1, 'Una regla necesita al menos una acción.').max(10),
}
const reglaNuevaSchema = z.object({ ...reglaCampos, encendida: reglaCampos.encendida.optional(), condiciones: reglaCampos.condiciones.optional() }).strict()
const reglaCambioSchema = z.object(opcional(reglaCampos)).strict()
async function piezaATexto(q: 'si' | 'ent', p: z.infer<typeof pieza>, c: Catalogo): Promise<string> {
  const fijas = q === 'si' ? SI_FIJAS : ENT_FIJAS, con = q === 'si' ? SI_CON : ENT_CON
  if (fijas[p.tipo]) return fijas[p.tipo]
  if (!con[p.tipo]) throw new ValidationError(`«${p.tipo}» no es ${q === 'si' ? 'una condición' : 'una acción'} de las reglas. Las que hay son: ${[...Object.keys(con), ...Object.keys(fijas)].join(', ')}.`)
  if (!p.valor) throw new ValidationError(`${q === 'si' ? 'La condición' : 'La acción'} «${p.tipo}» necesita «valor».`)
  let v = p.valor
  if (p.tipo === 'canal') { if (!NOMBRE_CANAL[v]) throw new ValidationError(`«${v}» no es un canal. Los canales son: ${CANALES_API.join(', ')}.`); v = NOMBRE_CANAL[v] }
  if (p.tipo === 'linea') { const l = await prisma.crmLinea.findFirst({ where: { id: v }, select: { nombre: true } }); if (!l) throw new ValidationError(`«${v}» no es una línea de este espacio (GET /lineas).`); v = l.nombre }
  if (p.tipo === 'etapa' || p.tipo === 'cambiar-etapa') exigirEtapa(c, v)
  if (p.tipo === 'etiqueta' || p.tipo === 'agregar-etiqueta' || p.tipo === 'quitar-etiqueta') exigirEtiqueta(c, v)
  if (p.tipo === 'asignar-por-turnos' || p.tipo === 'pasar-al-equipo') exigirEquipo(c, v)
  if (p.tipo === 'asignar-a') v = nombreMiembro(c, v)
  return con[p.tipo] + v
}
function textoAPieza(q: 'si' | 'ent', t: string): Json {
  const fijas = invertir(q === 'si' ? SI_FIJAS : ENT_FIJAS), con = q === 'si' ? SI_CON : ENT_CON
  if (fijas[t]) return { tipo: fijas[t] }
  // Primero los prefijos largos («Asignar por turnos al equipo» antes que «Asignar a»).
  for (const [k, pre] of Object.entries(con).sort((a, b) => b[1].length - a[1].length)) {
    if (t.startsWith(pre)) { const v = t.slice(pre.length); return { tipo: k, valor: k === 'canal' ? (invertir(NOMBRE_CANAL)[v] ?? v) : v } }
  }
  return { tipo: 'texto', valor: t }
}
const reglaDe = (r: Json) => ({
  nombre: String(r.n ?? ''), encendida: r.on === true, cuando: invertir(CUANDO_REGLA)[String(r.cuando)] ?? String(r.cuando ?? ''),
  condiciones: (Array.isArray(r.si) ? r.si : []).map(x => textoAPieza('si', String(x))), acciones: (Array.isArray(r.ent) ? r.ent : []).map(x => textoAPieza('ent', String(x))),
})
async function reglasGuardadas() {
  const fila = await filaAjuste('reglas')
  return { lista: Array.isArray(fila?.valor) ? (fila!.valor as unknown[]).map(obj) : null, base: fila?.updatedAt ?? null }
}
/** Las reglas de fábrica (REGLAS de 10-nucleo.js) si el espacio nunca las guardó. */
const REGLAS_FABRICA: Json[] = [
  { n: 'El agente IA responde de noche', on: false, cuando: 'Llega un mensaje nuevo', si: ['Fuera del horario de atención'], ent: ['Responde el agente IA', 'Dejar resumen en nota privada'] },
  { n: 'Pago confirmado', on: true, cuando: 'Se confirma un pago', si: [], ent: ['Cambiar etapa a Pagado', 'Pasar al equipo Recuperación de ventas si es a cuotas'] },
  { n: 'Sin respuesta 48 horas', on: true, cuando: 'Pasan 48 horas sin respuesta del cliente', si: ['Etapa es Contactado o En seguimiento'], ent: ['Cambiar etapa a Sin respuesta', 'Crear recordatorio para el asesor'] },
]
const buscarRegla = (lista: Json[], nombre: string) => lista.find(r => String(r.n ?? '').trim().toLowerCase() === nombre.trim().toLowerCase())
async function aplicarRegla(r: Json, d: Partial<z.infer<typeof reglaNuevaSchema>>, lista: Json[]): Promise<Json> {
  const c = await catalogo()
  const n: Json = { ...r }
  if (d.nombre !== undefined) { const otra = buscarRegla(lista, d.nombre); if (otra && otra !== r) throw new ConflictError(`Ya hay una regla llamada «${d.nombre}».`); n.n = d.nombre }
  if (d.encendida !== undefined) n.on = d.encendida
  if (d.cuando !== undefined) n.cuando = CUANDO_REGLA[d.cuando]
  if (d.condiciones !== undefined) { n.si = []; for (const p of d.condiciones) (n.si as string[]).push(await piezaATexto('si', p, c)) }
  if (d.acciones !== undefined) { n.ent = []; for (const p of d.acciones) (n.ent as string[]).push(await piezaATexto('ent', p, c)) }
  return n
}
router.get('/reglas', asyncHandler(async (_req: Request, res: Response) => {
  res.json({ data: ((await reglasGuardadas()).lista ?? REGLAS_FABRICA).map(reglaDe) })
}))
router.post('/reglas', asyncHandler(async (req: Request, res: Response) => {
  const d = reglaNuevaSchema.parse(req.body)
  const g = await reglasGuardadas(), lista = g.lista ?? REGLAS_FABRICA.map(x => ({ ...x }))
  if (lista.length >= 100) throw new ValidationError('Caben máximo 100 reglas por espacio.')
  if (buscarRegla(lista, d.nombre)) throw new ConflictError(`Ya hay una regla llamada «${d.nombre}».`)
  const nueva = await aplicarRegla({ n: d.nombre, on: false, cuando: CUANDO_REGLA[d.cuando], si: [], ent: [] }, d, lista)
  await guardarComoPantalla(req, 'reglas', [...lista, nueva], g.base)
  auditLog(req, 'CREATE', 'api_regla', d.nombre, { clave: req.apiClave?.id })
  res.status(201).json({ data: reglaDe(nueva) })
}))
router.patch('/reglas/:nombre', asyncHandler(async (req: Request, res: Response) => {
  const d = reglaCambioSchema.parse(req.body)
  if (!Object.keys(d).length) throw new ValidationError('No mandaste ningún cambio.')
  const g = await reglasGuardadas(), lista = g.lista ?? REGLAS_FABRICA.map(x => ({ ...x }))
  const r = buscarRegla(lista, String(req.params.nombre))
  if (!r) throw new NotFoundError('Esa regla no existe en este espacio (se busca por su nombre).')
  const nueva = await aplicarRegla(r, d, lista)
  await guardarComoPantalla(req, 'reglas', lista.map(x => (x === r ? nueva : x)), g.base)
  auditLog(req, 'UPDATE', 'api_regla', String(r.n), { clave: req.apiClave?.id, campos: Object.keys(d) })
  res.json({ data: reglaDe(nueva) })
}))
router.delete('/reglas/:nombre', asyncHandler(async (req: Request, res: Response) => {
  const g = await reglasGuardadas(), lista = g.lista ?? REGLAS_FABRICA.map(x => ({ ...x }))
  const r = buscarRegla(lista, String(req.params.nombre))
  if (!r) throw new NotFoundError('Esa regla no existe en este espacio (se busca por su nombre).')
  await guardarComoPantalla(req, 'reglas', lista.filter(x => x !== r), g.base)
  auditLog(req, 'DELETE', 'api_regla', String(r.n), { clave: req.apiClave?.id })
  res.json({ data: { nombre: String(r.n), borrada: true } })
}))

// ─ Etiquetas ─
const etiquetaSchema = z.object({ nombre: textoApi('nombre', 60), color: z.string().regex(/^#[0-9a-f]{6}$/i, '«color» debe ser un color como #2563eb.').optional(), equipo: textoApi('equipo', 60).optional() }).strict()
const PALETA_ETIQ = ['#0891b2', '#db2777', '#ca8a04', '#059669', '#7c3aed', '#dc2626', '#2563eb', '#ea580c', '#475569']
router.post('/etiquetas', asyncHandler(async (req: Request, res: Response) => {
  const d = etiquetaSchema.parse(req.body)
  const fila = await filaAjuste('etiquetas')
  const lista = Array.isArray(fila?.valor) ? (fila!.valor as unknown[]).filter(Array.isArray) as unknown[][] : []
  if (d.equipo) exigirEquipo(await catalogo(), d.equipo)
  if (lista.some(x => String(x[0]).trim().toLowerCase() === d.nombre.toLowerCase() && (x[2] ? String(x[2]) : '') === (d.equipo ?? ''))) throw new ConflictError(`Ya hay una etiqueta «${d.nombre}».`)
  if (lista.length >= 200) throw new ValidationError('Caben máximo 200 etiquetas.')
  const nueva = [d.nombre, d.color ?? PALETA_ETIQ[lista.length % PALETA_ETIQ.length], ...(d.equipo ? [d.equipo] : [])]
  await guardarComoPantalla(req, 'etiquetas', [...lista, nueva], fila?.updatedAt ?? null)
  auditLog(req, 'CREATE', 'api_etiqueta', d.nombre, { clave: req.apiClave?.id })
  res.status(201).json({ data: { nombre: d.nombre, color: nueva[1], equipo: d.equipo ?? null } })
}))
router.delete('/etiquetas/:nombre', asyncHandler(async (req: Request, res: Response) => {
  const nombre = String(req.params.nombre).trim()
  const fila = await filaAjuste('etiquetas')
  const lista = Array.isArray(fila?.valor) ? (fila!.valor as unknown[]).filter(Array.isArray) as unknown[][] : []
  const quedan = lista.filter(x => String(x[0]).trim().toLowerCase() !== nombre.toLowerCase())
  if (quedan.length === lista.length) throw new NotFoundError('Esa etiqueta no existe en este espacio.')
  await guardarComoPantalla(req, 'etiquetas', quedan, fila?.updatedAt ?? null)
  auditLog(req, 'DELETE', 'api_etiqueta', nombre, { clave: req.apiClave?.id })
  res.json({ data: { nombre, borrada: true } })
}))

// ─ Etapas: cambiar el color y borrar (crear está arriba). Borrar solo si ningún contacto está en esa etapa. ─
const etapaCambioSchema = z.object({ color: z.string().regex(/^#[0-9a-f]{6}$/i, '«color» debe ser un color como #2563eb.'), equipo: textoApi('equipo', 60).optional() }).strict()
router.patch('/etapas/:nombre', asyncHandler(async (req: Request, res: Response) => {
  const d = etapaCambioSchema.parse(req.body), nombre = String(req.params.nombre).trim(), equipo = d.equipo ?? equipoRespaldo()
  const { lista, base } = await etapasGuardadas()
  const i = lista.findIndex(x => String(x[0]).trim().toLowerCase() === nombre.toLowerCase() && (x[2] ? String(x[2]) : equipoRespaldo()) === equipo)
  if (i < 0) throw new NotFoundError(`${equipo} no tiene una etapa «${nombre}».`)
  const nueva = lista.map((x, k) => (k === i ? [x[0], d.color, ...(x[2] ? [x[2]] : [])] : x))
  await guardarComoPantalla(req, 'etapas', nueva, base)
  auditLog(req, 'UPDATE', 'api_etapa', nombre, { clave: req.apiClave?.id, equipo })
  res.json({ data: etapaDe(nueva[i]) })
}))
router.delete('/etapas/:nombre', asyncHandler(async (req: Request, res: Response) => {
  const nombre = String(req.params.nombre).trim(), equipo = String((req.query as Json).equipo ?? '') || equipoRespaldo()
  const { lista, base } = await etapasGuardadas()
  const i = lista.findIndex(x => String(x[0]).trim().toLowerCase() === nombre.toLowerCase() && (x[2] ? String(x[2]) : equipoRespaldo()) === equipo)
  if (i < 0) throw new NotFoundError(`${equipo} no tiene una etapa «${nombre}».`)
  const enUso = await prisma.crmContacto.count({ where: { etapa: String(lista[i][0]) } })
  if (enUso) throw new ConflictError(`No se puede borrar: ${enUso} ${enUso === 1 ? 'contacto está' : 'contactos están'} en «${nombre}». Muévelos primero.`)
  await guardarComoPantalla(req, 'etapas', lista.filter((_, k) => k !== i), base)
  auditLog(req, 'DELETE', 'api_etapa', nombre, { clave: req.apiClave?.id, equipo })
  res.json({ data: { nombre, equipo, borrada: true } })
}))

// ── Horario de atención (12-nov, pedido del usuario): leerlo y cambiarlo. Es el mismo de Ajustes del CRM › Horario de
// atención (78-horarios.js): los turnos (días, horas, almuerzo y quiénes lo trabajan), «Festivos de Colombia como domingo»
// y el mensaje fuera de horario. El horario de la empresa sale de los turnos (la primera hora y la última de cada día), igual
// que en la pantalla, y de él viven el aviso fuera de horario, el agente IA y el chat de la web. Se guarda con el controlador
// de Ajustes (solo administradores, aviso en vivo) y no pisa lo que alguien guardó al mismo tiempo.
const DIAS_API = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'] as const
const NOMBRES_DIA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const minHora = (v: unknown) => { const m = String(v ?? '').match(/^(\d{1,2})(?::(\d{2}))?$/); return m && +m[1] <= 24 && +(m[2] ?? 0) < 60 ? +m[1] * 60 + +(m[2] ?? 0) : null }
const hora = z.string().regex(/^([01]?\d|2[0-4])(:[0-5]\d)?$/, 'La hora va como 7:00 o 18:30 (de 0:00 a 24:00)')
const turnoSchema = z.object({
  id: z.string().min(1).max(60).optional(),
  nombre: z.string().trim().min(1).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  dias: z.array(z.object({
    dia: z.enum(DIAS_API), desde: hora, hasta: hora,
    almuerzo: z.object({ desde: hora, hasta: hora }).optional(),
  })).min(1).max(7),
  personas: z.array(z.string().min(1).max(60)).max(500),
}).refine(t => new Set(t.dias.map(d => d.dia)).size === t.dias.length, { message: 'Cada día va una sola vez en el turno.' })
const horarioSchema = z.object({
  turnos: z.array(turnoSchema).max(50).optional(),
  festivosComoDomingo: z.boolean().optional(),
  mensajeFueraDeHorario: z.string().max(1000).optional(),
}).strict()

/** El horario de la empresa a partir de los turnos (htDerivar de 78-horarios.js): sin turnos ese día, cerrado. */
function horarioDeTurnos(turnos: Json[]): unknown[][] {
  return [1, 2, 3, 4, 5, 6, 0].map(dia => {
    const fr = turnos.flatMap(t => (Array.isArray(t.dias) ? t.dias as unknown[][] : []).filter(z => z[0] === dia)).filter(z => minHora(z[1]) !== null && minHora(z[2]) !== null)
    if (!fr.length) return [NOMBRES_DIA[dia], '7:00', '22:00', false]
    const de = fr.reduce((a, z) => (minHora(z[1])! < minHora(a)! ? z[1] : a), fr[0][1])
    const a = fr.reduce((x, z) => (minHora(z[2])! > minHora(x)! ? z[2] : x), fr[0][2])
    return [NOMBRES_DIA[dia], de, a, true]
  })
}
const turnoDe = (t: Json) => ({
  id: String(t.id ?? ''), nombre: String(t.n ?? ''), color: t.col ?? null,
  dias: (Array.isArray(t.dias) ? t.dias as unknown[][] : []).map(z => ({ dia: DIAS_API[Number(z[0])] ?? null, desde: z[1], hasta: z[2], ...(z[3] && z[4] ? { almuerzo: { desde: z[3], hasta: z[4] } } : {}) })),
  personas: Array.isArray(t.ids) ? t.ids.map(String) : [],
})
function horarioDe(cfg: Json) {
  const turnos = Array.isArray(cfg.turnos) ? (cfg.turnos as unknown[]).map(obj) : []
  const horario = Array.isArray(cfg.horario) ? cfg.horario as unknown[][] : []
  const festivos = cfg.festivos !== false
  return {
    turnos: turnos.map(turnoDe),
    horarioEmpresa: horario.filter(Array.isArray).map(f => ({ dia: String(f[0] ?? ''), abierto: f[3] !== false, desde: f[1] ?? null, hasta: f[2] ?? null })),
    festivosComoDomingo: festivos,
    mensajeFueraDeHorario: typeof cfg.fuera === 'string' ? cfg.fuera : '',
    dentroDeHorarioAhora: horario.length ? dentroDeHorario(horario, new Date(), festivos) : true,
  }
}
router.get('/horario', asyncHandler(async (_req: Request, res: Response) => {
  res.json({ data: horarioDe(obj((await filaAjuste('cfg'))?.valor)) })
}))
router.patch('/horario', asyncHandler(async (req: Request, res: Response) => {
  const d = horarioSchema.parse(req.body)
  const fila = await filaAjuste('cfg')
  const cfg = { ...obj(fila?.valor) }
  if (d.turnos) {
    const ids = new Set((await usuariosCrm()).map(u => u.id))
    const extranos = [...new Set(d.turnos.flatMap(t => t.personas))].filter(id => !ids.has(id))
    if (extranos.length) throw new ValidationError(`Estas personas no son miembros del espacio: ${extranos.join(', ')}. Revisa GET /miembros.`)
    const previos = Array.isArray(cfg.turnos) ? (cfg.turnos as unknown[]).map(obj) : []
    const COLORES = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6']
    cfg.turnos = d.turnos.map((t, i) => {
      const previo = t.id ? previos.find(x => String(x.id) === t.id) : undefined
      return {
        id: t.id || `t${Date.now().toString(36)}${i}`, n: t.nombre, col: t.color ?? previo?.col ?? COLORES[i % COLORES.length],
        dias: t.dias.map(z => [DIAS_API.indexOf(z.dia), z.desde, z.hasta, ...(z.almuerzo ? [z.almuerzo.desde, z.almuerzo.hasta] : [])]),
        ids: [...new Set(t.personas)],
      }
    })
    if ((cfg.turnos as unknown[]).length) cfg.horario = horarioDeTurnos(cfg.turnos as Json[])
  }
  if (d.festivosComoDomingo !== undefined) cfg.festivos = d.festivosComoDomingo
  if (d.mensajeFueraDeHorario !== undefined) cfg.fuera = d.mensajeFueraDeHorario.trim()
  await guardarComoPantalla(req, 'cfg', cfg, fila?.updatedAt ?? null)
  auditLog(req, 'UPDATE', 'api_horario', undefined, { clave: req.apiClave?.id, campos: Object.keys(d) })
  res.json({ data: horarioDe(cfg) })
}))

router.use((_req: Request, res: Response) => { res.status(404).json({ error: 'Esa ruta no existe en la API v1. Revisa la documentación.' }) })
// Errores en el mismo formato { error } que el resto de la API.
router.use((err: Error & { statusCode?: number; errors?: unknown }, _req: Request, res: Response, _next: NextFunction) => {
  const zod = (err as { name?: string }).name === 'ZodError'
  const status = zod ? 400 : err.statusCode && err.statusCode < 500 ? err.statusCode : 500
  res.status(status).json({ error: zod ? 'Datos inválidos: revisa los campos que mandaste.' : status === 500 ? 'Error interno. Intenta de nuevo.' : err.message, ...(zod ? { detalle: (err as unknown as { errors: unknown }).errors } : {}) })
})

export default router
