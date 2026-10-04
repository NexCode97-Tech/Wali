import crypto from 'crypto'
import { prisma } from '../../config/prisma'
import { logger } from '../../utils/logger'
import { AppError, ValidationError } from '../../utils/errors'

/**
 * El plan de cada espacio y el cobro con Creem (Merchant of Record: cobra, factura y declara impuestos).
 *
 * - CREEM_API_KEY: llave de la API (creem_test_… en pruebas). CREEM_API_URL: https://test-api.creem.io o https://api.creem.io.
 * - CREEM_WEBHOOK_SECRET: firma de los avisos (POST /api/pagos/creem).
 * - CREEM_PRODUCTOS: JSON con el id de producto de cada plan y periodo, p. ej. {"growth-mensual":"prod_…", …}.
 *
 * WhatsApp y la IA no se cobran aquí: cada empresa los paga directo a su proveedor.
 */
export type Plan = 'starter' | 'growth' | 'business'
export type Periodo = 'mensual' | 'anual'
export const PLANES: Plan[] = ['starter', 'growth', 'business']
export const DIAS_PRUEBA = 10

/** Lo que permite cada plan. Infinity = sin límite. */
export const LIMITES: Record<Plan, { usuarios: number; agentesIA: number }> = {
  starter: { usuarios: 10, agentesIA: 0 },
  growth: { usuarios: 20, agentesIA: 2 },
  business: { usuarios: Infinity, agentesIA: Infinity },
}

const API = () => (process.env.CREEM_API_URL || 'https://test-api.creem.io').replace(/\/+$/, '')
function productos(): Record<string, string> {
  try { return JSON.parse(process.env.CREEM_PRODUCTOS || '{}') as Record<string, string> } catch { return {} }
}
export const pagosListos = () => !!(process.env.CREEM_API_KEY && Object.keys(productos()).length)

async function creem<T>(ruta: string, cuerpo?: unknown): Promise<T> {
  const r = await fetch(`${API()}/v1${ruta}`, {
    method: cuerpo === undefined ? 'GET' : 'POST',
    headers: { 'x-api-key': process.env.CREEM_API_KEY ?? '', ...(cuerpo === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(15_000),
  })
  const texto = await r.text()
  if (!r.ok) {
    logger.error({ evento: 'CREEM_ERROR', ruta, status: r.status, cuerpo: texto.slice(0, 300) })
    throw new AppError('No se pudo conectar con la pasarela de pagos. Intenta de nuevo en un momento.', 502)
  }
  return JSON.parse(texto) as T
}

// ─── Los planes de la página de precios ─────────────────────────────────────

/**
 * Lo que trae cada plan, tal como lo dice nexcode97.com/precios (web/lib/precios-crm.ts, servido en
 * /api/planes-crm). Una sola fuente: si cambia la página de precios, cambia la pantalla del CRM. Se guarda una
 * hora; si el sitio no responde, se usa lo último que se trajo y, sin nada, la pantalla muestra solo nombre y precio.
 */
const SITIO = () => (process.env.SITIO_URL || 'https://www.nexcode97.com').replace(/\/+$/, '')
let planesCache: { en: number; planes: unknown[] } | null = null
export async function planesDelSitio(): Promise<unknown[]> {
  if (planesCache && Date.now() - planesCache.en < 3_600_000) return planesCache.planes
  try {
    const r = await fetch(`${SITIO()}/api/planes-crm`, { signal: AbortSignal.timeout(5_000) })
    const j = (await r.json()) as { planes?: unknown }
    if (r.ok && Array.isArray(j.planes)) planesCache = { en: Date.now(), planes: j.planes }
  } catch (e) {
    logger.warn({ evento: 'PLANES_SITIO_FALLO', err: (e as Error).message })
  }
  return planesCache?.planes ?? []
}

// ─── Estado del plan ────────────────────────────────────────────────────────

export interface EstadoPlan {
  plan: Plan
  estado: string
  periodo: string | null
  pruebaHasta: string | null
  diasPrueba: number | null
  /** Cuántos días dura la prueba gratis (DIAS_PRUEBA). */
  duracionPrueba: number
  renuevaEl: string | null
  cancelaAlFinal: boolean
  /** Si el espacio puede trabajar normal. Si no, queda en solo lectura hasta pagar. */
  vigente: boolean
  limites: { usuarios: number | null; agentesIA: number | null }
  pagos: boolean
  /** Ya pagó alguna vez: tiene portal de Creem (facturas, tarjeta y cancelación). */
  portal: boolean
}

const esPlan = (v: string): v is Plan => (PLANES as string[]).includes(v)

export async function estadoPlan(espacioId: string): Promise<EstadoPlan> {
  const e = await prisma.crmEspacio.findUnique({ where: { id: espacioId } })
  if (!e) throw new ValidationError('Espacio no encontrado')
  const plan: Plan = esPlan(e.plan) ? e.plan : 'starter'
  const ahora = Date.now()
  const enPrueba = e.estadoPlan === 'prueba' && !!e.pruebaHasta && e.pruebaHasta.getTime() > ahora
  const pagado = e.estadoPlan === 'activo' || e.estadoPlan === 'pago-pendiente'
    || (e.estadoPlan === 'cancelado' && !!e.renuevaEl && e.renuevaEl.getTime() > ahora)
  const vigente = e.estadoPlan === 'interno' || enPrueba || pagado
  const lim = LIMITES[plan]
  return {
    plan, estado: e.estadoPlan, periodo: e.periodo,
    pruebaHasta: e.pruebaHasta?.toISOString() ?? null,
    diasPrueba: e.pruebaHasta ? Math.max(0, Math.ceil((e.pruebaHasta.getTime() - ahora) / 864e5)) : null,
    duracionPrueba: DIAS_PRUEBA,
    renuevaEl: e.renuevaEl?.toISOString() ?? null,
    cancelaAlFinal: e.cancelaAlFinal,
    vigente,
    limites: { usuarios: Number.isFinite(lim.usuarios) ? lim.usuarios : null, agentesIA: Number.isFinite(lim.agentesIA) ? lim.agentesIA : null },
    pagos: pagosListos(),
    portal: !!e.creemCliente,
  }
}

/** Cuántos usuarios permite el plan del espacio (Infinity si no hay límite o es interno). */
export async function limiteUsuarios(espacioId: string): Promise<number> {
  const e = await prisma.crmEspacio.findUnique({ where: { id: espacioId }, select: { plan: true, estadoPlan: true } })
  if (!e || e.estadoPlan === 'interno') return Infinity
  return LIMITES[esPlan(e.plan) ? e.plan : 'starter'].usuarios
}

// ─── Pagar, cambiar de plan y portal ────────────────────────────────────────

/**
 * Lleva al pago de un plan. Si el espacio ya tiene una suscripción, la cambia de plan (con prorrateo) en vez de
 * abrir otro pago. Devuelve la dirección a la que hay que enviar a la persona, o null si el cambio ya quedó hecho.
 */
export async function pagarPlan(espacioId: string, plan: Plan, periodo: Periodo, email: string, volverA: string): Promise<{ url: string | null }> {
  if (!pagosListos()) throw new AppError('Los pagos todavía no están activos. Escríbenos y te activamos el plan.', 503)
  const producto = productos()[`${plan}-${periodo}`]
  if (!producto) throw new ValidationError('Ese plan no está disponible.')
  const e = await prisma.crmEspacio.findUnique({ where: { id: espacioId }, select: { creemSuscripcion: true, estadoPlan: true } })
  if (e?.creemSuscripcion && ['activo', 'pago-pendiente'].includes(e.estadoPlan)) {
    await creem(`/subscriptions/${encodeURIComponent(e.creemSuscripcion)}/upgrade`, { product_id: producto, update_behavior: 'proration-charge-immediately' })
    logger.info({ evento: 'PLAN_CAMBIO', espacioId, plan, periodo })
    return { url: null }
  }
  const r = await creem<{ checkout_url: string }>('/checkouts', {
    product_id: producto,
    request_id: `${espacioId}-${crypto.randomBytes(6).toString('hex')}`,
    customer: { email },
    success_url: volverA,
    metadata: { espacio: espacioId, plan, periodo },
  })
  return { url: r.checkout_url }
}

/** El portal del cliente en Creem: facturas, tarjeta y cancelación. */
export async function portalPagos(espacioId: string): Promise<{ url: string }> {
  const e = await prisma.crmEspacio.findUnique({ where: { id: espacioId }, select: { creemCliente: true } })
  if (!e?.creemCliente) throw new ValidationError('Todavía no tienes pagos registrados.')
  const r = await creem<{ customer_portal_link: string }>('/customers/billing', { customer_id: e.creemCliente })
  return { url: r.customer_portal_link }
}

// ─── Avisos de Creem ────────────────────────────────────────────────────────

/** Verifica la firma del aviso: HMAC-SHA256 del cuerpo exacto con CREEM_WEBHOOK_SECRET, en hexadecimal. */
export function firmaValida(cuerpo: Buffer, firma: string | undefined): boolean {
  const secreto = process.env.CREEM_WEBHOOK_SECRET
  if (!secreto || !firma) return false
  const esperada = crypto.createHmac('sha256', secreto).update(cuerpo).digest('hex')
  return esperada.length === firma.length && crypto.timingSafeEqual(Buffer.from(esperada), Buffer.from(firma))
}

type Obj = Record<string, unknown>
const txt = (v: unknown) => (typeof v === 'string' ? v : '')
const idDe = (v: unknown) => (typeof v === 'string' ? v : v && typeof v === 'object' ? txt((v as Obj).id) : '')

/** El plan y el periodo de un producto de Creem, según CREEM_PRODUCTOS. */
function planDeProducto(productoId: string): { plan: Plan; periodo: Periodo } | null {
  const clave = Object.entries(productos()).find(([, id]) => id === productoId)?.[0]
  const [plan, periodo] = (clave ?? '').split('-')
  return esPlan(plan) && (periodo === 'mensual' || periodo === 'anual') ? { plan, periodo } : null
}

const ESTADOS: Record<string, string> = {
  'subscription.active': 'activo', 'subscription.paid': 'activo', 'subscription.update': '',
  'subscription.past_due': 'pago-pendiente', 'subscription.unpaid': 'vencido',
  'subscription.canceled': 'cancelado', 'subscription.expired': 'vencido', 'subscription.scheduled_cancel': '',
}

const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {})
const entero = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null)
/** Creem manda fechas como texto ISO o como milisegundos. */
function fechaDe(v: unknown): Date | null {
  const d = typeof v === 'number' ? new Date(v) : typeof v === 'string' && v ? new Date(v) : null
  return d && !Number.isNaN(d.getTime()) ? d : null
}

/** El espacio de un aviso: la metadata del pago o, si no viene, la suscripción que ya conocemos. */
async function espacioDeAviso(meta: Obj, suscripcion: string): Promise<string> {
  const espacio = txt(meta.espacio)
  if (espacio || !suscripcion) return espacio
  return (await prisma.crmEspacio.findFirst({ where: { creemSuscripcion: suscripcion }, select: { id: true } }))?.id ?? ''
}

/** La transacción de Creem con sus montos e impuestos. Si la API no responde, null: el cobro se guarda con el precio. */
async function transaccion(id: string): Promise<Obj | null> {
  if (!id) return null
  try {
    const r = await creem<Obj>(`/transactions?transaction_id=${encodeURIComponent(id)}`)
    return Array.isArray(r.items) ? obj(r.items[0]) : r
  } catch { return null }
}

/**
 * Guarda en el historial el cobro de una suscripción: pagado (subscription.paid, con su transacción) o rechazado
 * (subscription.past_due). Idempotente por la transacción: si Creem repite el aviso, no se duplica.
 */
async function registrarCobro(espacioId: string, sub: Obj, estado: 'pagado' | 'rechazado', producto: { plan: Plan; periodo: Periodo } | null) {
  const e = producto ? null : await prisma.crmEspacio.findUnique({ where: { id: espacioId }, select: { plan: true, periodo: true } })
  const plan = producto?.plan ?? e?.plan ?? 'starter', periodo = producto?.periodo ?? e?.periodo ?? 'mensual'
  const prod = obj(sub.product), precio = entero(prod.price) ?? 0
  const tr = estado === 'pagado' ? await transaccion(txt(sub.last_transaction_id)) : null
  const subtotal = entero(tr?.amount) ?? precio
  const total = entero(tr?.amount_paid) ?? subtotal
  const creemId = estado === 'pagado'
    ? txt(sub.last_transaction_id) || `${txt(sub.id)}:${txt(sub.current_period_start_date)}`
    : `${txt(sub.id)}:${txt(sub.next_transaction_date) || txt(sub.current_period_end_date)}:rechazado`
  const datos = {
    plan, periodo, estado, subtotal, total,
    impuestos: entero(tr?.tax_amount) ?? Math.max(0, total - subtotal),
    moneda: (txt(tr?.currency) || txt(prod.currency) || 'USD').toUpperCase(),
    desde: estado === 'pagado' ? fechaDe(tr?.period_start) ?? fechaDe(sub.current_period_start_date) : null,
    hasta: estado === 'pagado' ? fechaDe(tr?.period_end) ?? fechaDe(sub.current_period_end_date) : null,
    fecha: fechaDe(tr?.created_at) ?? fechaDe(sub.last_transaction_date) ?? new Date(),
  }
  if (estado === 'rechazado') datos.fecha = new Date()
  await prisma.crmPago.upsert({ where: { creemId }, create: { espacioId, creemId, ...datos }, update: datos })
}

/** Un reembolso (refund.created): el cobro queda reembolsado con lo devuelto. Si no estaba en el historial, se crea. */
async function registrarReembolso(o: Obj) {
  const tr = obj(o.transaction), sub = obj(o.subscription), creemId = txt(tr.id)
  if (!creemId) return
  const devuelto = entero(tr.refunded_amount) ?? entero(o.refund_amount) ?? 0
  const ya = await prisma.crmPago.findUnique({ where: { creemId } })
  if (ya) { await prisma.crmPago.update({ where: { creemId }, data: { estado: 'reembolsado', reembolso: devuelto } }); return }
  const espacioId = await espacioDeAviso(obj(sub.metadata), txt(sub.id))
  if (!espacioId) { logger.warn({ evento: 'CREEM_REEMBOLSO_SIN_ESPACIO', creemId }); return }
  const producto = planDeProducto(idDe(sub.product)), subtotal = entero(tr.amount) ?? 0, total = entero(tr.amount_paid) ?? subtotal
  await prisma.crmPago.create({ data: {
    espacioId, creemId, plan: producto?.plan ?? 'starter', periodo: producto?.periodo ?? 'mensual', estado: 'reembolsado',
    subtotal, total, impuestos: entero(tr.tax_amount) ?? 0, reembolso: devuelto, moneda: (txt(tr.currency) || 'USD').toUpperCase(),
    desde: fechaDe(tr.period_start), hasta: fechaDe(tr.period_end), fecha: fechaDe(tr.created_at) ?? new Date(),
  } })
}

/** Aplica un aviso de Creem al espacio. Idempotente: guarda el estado, no suma ni resta nada. */
export async function procesarAvisoCreem(evento: Obj): Promise<void> {
  const tipo = txt(evento.eventType)
  const o = (evento.object ?? {}) as Obj
  const meta = (o.metadata ?? {}) as Obj
  if (tipo === 'refund.created') { await registrarReembolso(o); return }
  if (tipo === 'checkout.completed') {
    // La suscripción llega en sus propios avisos; aquí solo se anota el cliente de Creem.
    const espacio = txt(meta.espacio), cliente = idDe(o.customer)
    if (espacio && cliente) await prisma.crmEspacio.updateMany({ where: { id: espacio }, data: { creemCliente: cliente } })
    return
  }
  if (!(tipo in ESTADOS)) { logger.info({ evento: 'CREEM_AVISO_IGNORADO', tipo }); return }
  const suscripcion = txt(o.id)
  const espacio = await espacioDeAviso(meta, suscripcion)
  if (!espacio) { logger.warn({ evento: 'CREEM_AVISO_SIN_ESPACIO', tipo, suscripcion }); return }
  const producto = planDeProducto(idDe(o.product))
  const fin = txt(o.current_period_end_date)
  const data: Record<string, unknown> = { creemSuscripcion: suscripcion || undefined }
  if (idDe(o.customer)) data.creemCliente = idDe(o.customer)
  if (producto) { data.plan = producto.plan; data.periodo = producto.periodo }
  if (fin && !Number.isNaN(Date.parse(fin))) data.renuevaEl = new Date(fin)
  const estado = ESTADOS[tipo]
  if (estado) data.estadoPlan = estado
  if (tipo === 'subscription.scheduled_cancel') data.cancelaAlFinal = true
  if (tipo === 'subscription.active' || tipo === 'subscription.paid') data.cancelaAlFinal = false
  const { count } = await prisma.crmEspacio.updateMany({ where: { id: espacio, NOT: { estadoPlan: 'interno' } }, data })
  if (count && tipo === 'subscription.paid') await registrarCobro(espacio, o, 'pagado', producto)
  if (count && tipo === 'subscription.past_due') await registrarCobro(espacio, o, 'rechazado', producto)
  logger.info({ evento: 'CREEM_AVISO', tipo, espacio, plan: producto?.plan, estado })
}

// ─── Historial y recibos ────────────────────────────────────────────────────

export interface PagoHistorial {
  numero: number; fecha: string; plan: string; periodo: string; estado: string
  desde: string | null; hasta: string | null; subtotal: number; impuestos: number; total: number; reembolso: number; moneda: string
}

/** Los cobros del espacio, del más reciente al más viejo. */
export async function historialPagos(espacioId: string, limite = 24): Promise<PagoHistorial[]> {
  const filas = await prisma.crmPago.findMany({ where: { espacioId }, orderBy: { fecha: 'desc' }, take: limite })
  return filas.map(p => ({
    numero: p.numero, fecha: p.fecha.toISOString(), plan: p.plan, periodo: p.periodo, estado: p.estado,
    desde: p.desde?.toISOString() ?? null, hasta: p.hasta?.toISOString() ?? null, subtotal: p.subtotal, impuestos: p.impuestos, total: p.total, reembolso: p.reembolso, moneda: p.moneda,
  }))
}

/** Un cobro del espacio para su recibo. Solo los pagados o reembolsados tienen recibo. */
export async function pagoDeEspacio(espacioId: string, numero: number) {
  const p = await prisma.crmPago.findFirst({ where: { espacioId, numero, estado: { in: ['pagado', 'reembolsado'] } } })
  if (!p) throw new ValidationError('Ese recibo no existe.')
  return p
}
