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
export const DIAS_PRUEBA = 14

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

async function creem<T>(ruta: string, cuerpo: unknown): Promise<T> {
  const r = await fetch(`${API()}/v1${ruta}`, {
    method: 'POST',
    headers: { 'x-api-key': process.env.CREEM_API_KEY ?? '', 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(15_000),
  })
  const texto = await r.text()
  if (!r.ok) {
    logger.error({ evento: 'CREEM_ERROR', ruta, status: r.status, cuerpo: texto.slice(0, 300) })
    throw new AppError('No se pudo conectar con la pasarela de pagos. Intenta de nuevo en un momento.', 502)
  }
  return JSON.parse(texto) as T
}

// ─── Estado del plan ────────────────────────────────────────────────────────

export interface EstadoPlan {
  plan: Plan
  estado: string
  periodo: string | null
  pruebaHasta: string | null
  diasPrueba: number | null
  renuevaEl: string | null
  cancelaAlFinal: boolean
  /** Si el espacio puede trabajar normal. Si no, queda en solo lectura hasta pagar. */
  vigente: boolean
  limites: { usuarios: number | null; agentesIA: number | null }
  pagos: boolean
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
    renuevaEl: e.renuevaEl?.toISOString() ?? null,
    cancelaAlFinal: e.cancelaAlFinal,
    vigente,
    limites: { usuarios: Number.isFinite(lim.usuarios) ? lim.usuarios : null, agentesIA: Number.isFinite(lim.agentesIA) ? lim.agentesIA : null },
    pagos: pagosListos(),
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

/** Aplica un aviso de Creem al espacio. Idempotente: guarda el estado, no suma ni resta nada. */
export async function procesarAvisoCreem(evento: Obj): Promise<void> {
  const tipo = txt(evento.eventType)
  const o = (evento.object ?? {}) as Obj
  const meta = (o.metadata ?? {}) as Obj
  if (tipo === 'checkout.completed') {
    // La suscripción llega en sus propios avisos; aquí solo se anota el cliente de Creem.
    const espacio = txt(meta.espacio), cliente = idDe(o.customer)
    if (espacio && cliente) await prisma.crmEspacio.updateMany({ where: { id: espacio }, data: { creemCliente: cliente } })
    return
  }
  if (!(tipo in ESTADOS)) { logger.info({ evento: 'CREEM_AVISO_IGNORADO', tipo }); return }
  const suscripcion = txt(o.id)
  // El espacio sale de la metadata del pago; si no viene, de la suscripción que ya conocemos.
  let espacio = txt(meta.espacio)
  if (!espacio && suscripcion) espacio = (await prisma.crmEspacio.findFirst({ where: { creemSuscripcion: suscripcion }, select: { id: true } }))?.id ?? ''
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
  await prisma.crmEspacio.updateMany({ where: { id: espacio, NOT: { estadoPlan: 'interno' } }, data })
  logger.info({ evento: 'CREEM_AVISO', tipo, espacio, plan: producto?.plan, estado })
}
