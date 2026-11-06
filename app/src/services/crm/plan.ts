import crypto from 'crypto'
import { prisma } from '../../config/prisma'
import { logger } from '../../utils/logger'
import { AppError, ValidationError } from '../../utils/errors'
import { cuentaDe, espaciosDeCuenta, usuariosDeCuenta } from './espacio'

/**
 * El plan de cada espacio. El cobro lo hace Whop (ver «Pagar con Whop» más abajo); Creem queda solo para los cupones
 * viejos del panel de superadministrador (creem(), CREEM_PRODUCTOS) mientras se pasan a códigos de Whop.
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

/**
 * Lo que permite cada plan. Infinity = sin límite. Es de la cuenta (6-oct): usuarios y agentes se suman entre todos
 * sus espacios de trabajo, y `espacios` es cuántos espacios puede tener.
 */
export const LIMITES: Record<Plan, { usuarios: number; agentesIA: number; espacios: number }> = {
  starter: { usuarios: 5, agentesIA: 0, espacios: 1 },
  growth: { usuarios: 10, agentesIA: 2, espacios: 3 },
  business: { usuarios: Infinity, agentesIA: Infinity, espacios: 6 },
}

const API = () => (process.env.CREEM_API_URL || 'https://test-api.creem.io').replace(/\/+$/, '')
function productos(): Record<string, string> {
  try { return JSON.parse(process.env.CREEM_PRODUCTOS || '{}') as Record<string, string> } catch { return {} }
}

/** Productos de Creem de cada plan (sus dos periodos), según CREEM_PRODUCTOS. */
export function productosDePlan(plan: string): string[] {
  return Object.entries(productos()).filter(([k]) => k.startsWith(plan + '-')).map(([, id]) => id)
}

export async function creem<T>(ruta: string, cuerpo?: unknown, metodo?: 'GET' | 'POST' | 'DELETE'): Promise<T> {
  const r = await fetch(`${API()}/v1${ruta}`, {
    method: metodo ?? (cuerpo === undefined ? 'GET' : 'POST'),
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
  limites: { usuarios: number | null; agentesIA: number | null; espacios: number | null }
  pagos: boolean
  /** Ya pagó alguna vez: puede gestionar su suscripción en Whop (tarjeta, facturas y cancelación). */
  portal: boolean
}

const esPlan = (v: string): v is Plan => (PLANES as string[]).includes(v)

/**
 * Lo que permite una cuenta hoy (6-oct): en la prueba de 10 días, todo lo de Business (agentes IA, espacios, usuarios);
 * la prueba es de la cuenta y no se reinicia al crear espacios de trabajo. Después, lo de su plan.
 */
export function limitesDe(e: { plan: string; estadoPlan: string; pruebaHasta?: Date | null }): { usuarios: number; agentesIA: number; espacios: number } {
  const enPrueba = e.estadoPlan === 'prueba' && !!e.pruebaHasta && e.pruebaHasta.getTime() > Date.now()
  return LIMITES[enPrueba ? 'business' : esPlan(e.plan) ? e.plan : 'starter']
}

export async function estadoPlan(espacioDado: string): Promise<EstadoPlan> {
  // El plan es de la cuenta: un espacio de trabajo usa el de la cuenta a la que pertenece.
  const espacioId = await cuentaDe(espacioDado)
  const e = await prisma.crmEspacio.findUnique({ where: { id: espacioId } })
  if (!e) throw new ValidationError('Espacio no encontrado')
  const plan: Plan = esPlan(e.plan) ? e.plan : 'starter'
  const ahora = Date.now()
  const enPrueba = e.estadoPlan === 'prueba' && !!e.pruebaHasta && e.pruebaHasta.getTime() > ahora
  const pagado = e.estadoPlan === 'activo' || e.estadoPlan === 'pago-pendiente'
    || (e.estadoPlan === 'cancelado' && !!e.renuevaEl && e.renuevaEl.getTime() > ahora)
  const vigente = e.estadoPlan === 'interno' || enPrueba || pagado
  const lim = limitesDe(e)
  return {
    plan, estado: e.estadoPlan, periodo: e.periodo,
    pruebaHasta: e.pruebaHasta?.toISOString() ?? null,
    diasPrueba: e.pruebaHasta ? Math.max(0, Math.ceil((e.pruebaHasta.getTime() - ahora) / 864e5)) : null,
    duracionPrueba: DIAS_PRUEBA,
    renuevaEl: e.renuevaEl?.toISOString() ?? null,
    cancelaAlFinal: e.cancelaAlFinal,
    vigente,
    limites: { usuarios: Number.isFinite(lim.usuarios) ? lim.usuarios : null, agentesIA: Number.isFinite(lim.agentesIA) ? lim.agentesIA : null, espacios: e.estadoPlan === 'interno' ? null : lim.espacios },
    pagos: pagosListos(),
    portal: !!e.creemCliente,
  }
}

/** Cuántos usuarios permite el plan del espacio (Infinity si no hay límite o es interno). */
export async function limiteUsuarios(espacioDado: string): Promise<number> {
  const espacioId = await cuentaDe(espacioDado)
  const e = await prisma.crmEspacio.findUnique({ where: { id: espacioId }, select: { plan: true, estadoPlan: true, pruebaHasta: true } })
  if (!e || e.estadoPlan === 'interno') return Infinity
  return limitesDe(e).usuarios
}

type Obj = Record<string, unknown>
const txt = (v: unknown) => (typeof v === 'string' ? v : '')
const idDe = (v: unknown) => (typeof v === 'string' ? v : v && typeof v === 'object' ? txt((v as Obj).id) : '')
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? v as Obj : {})
function fechaDe(v: unknown): Date | null {
  const d = typeof v === 'number' ? new Date(v < 1e12 ? v * 1000 : v) : typeof v === 'string' && v ? new Date(v) : null
  return d && !Number.isNaN(d.getTime()) ? d : null
}

// ─── Pagar con Whop (5-nov) ──────────────────────────────────────────────────

/**
 * Whop cobra los planes (reemplaza a Creem). La empresa paga dentro de Wali con el checkout incrustado de Whop:
 * el servidor crea la configuración del pago y la pantalla la monta con `checkoutConfiguration`.
 *
 * - WHOP_API_KEY: clave de la empresa WaliCRM en Whop (permisos: checkout_configuration:create, plan:create,
 *   plan:basic:read, payment:basic:read, member:basic:read, member:email:read, membership:cancel, membership:update).
 * - WHOP_WEBHOOK_SECRET: el secreto ws_… de los avisos (POST /api/pagos/whop).
 *
 * El primer cobro espera a que termine la prueba gratis, o el periodo que ya está pagado si cambia de plan: el plan de
 * esa compra lleva esos días de prueba en Whop. Al activarse una suscripción nueva, la anterior se cancela.
 * En la base, los campos creem_* guardan lo de Whop: creemSuscripcion = la membresía (mem_), creemCliente = el
 * miembro (mber_) y crm_pagos.creem_id = el pago (pay_).
 */
const WHOP_API = 'https://api.whop.com/api/v1'
const WHOP_VERSION = '2026-11-05-1'
const WHOP_CUENTA = () => process.env.WHOP_CUENTA || 'biz_QCxhCFgBRJnw7V'
const WHOP_PRODUCTO = () => process.env.WHOP_PRODUCTO || 'prod_jhPZ6ykLDThWs'
/** Los planes de Wali en Whop (ocultos, renovables, precio inicial 0: el primer cobro es el de la renovación). */
const VARIANTES: Record<string, string> = {
  'starter-mensual': 'plan_7lAfeZkgFJepz', 'starter-anual': 'plan_72eLZ2Ejynk5p',
  'growth-mensual': 'plan_t0djqeyHgmKGn', 'growth-anual': 'plan_VZQYof0XPyN3K',
  'business-mensual': 'plan_EebIGQK97fZne', 'business-anual': 'plan_SgjfYh73trzEw',
}
/** Precio en USD de cada plan y periodo (el mismo de la página de precios y de Whop). */
export const PRECIOS: Record<Plan, Record<Periodo, number>> = {
  starter: { mensual: 59, anual: 566 }, growth: { mensual: 139, anual: 1334 }, business: { mensual: 259, anual: 2486 },
}
const NOMBRE: Record<Plan, string> = { starter: 'Starter', growth: 'Growth', business: 'Business' }

export const pagosListos = () => !!process.env.WHOP_API_KEY

export async function whop<T>(ruta: string, cuerpo?: unknown, metodo?: 'GET' | 'POST' | 'PATCH'): Promise<T> {
  const r = await fetch(`${WHOP_API}${ruta}`, {
    method: metodo ?? (cuerpo === undefined ? 'GET' : 'POST'),
    headers: { Authorization: `Bearer ${process.env.WHOP_API_KEY ?? ''}`, 'Api-Version-Date': WHOP_VERSION, ...(cuerpo === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    signal: AbortSignal.timeout(15_000),
  })
  const texto = await r.text()
  if (!r.ok) {
    logger.error({ evento: 'WHOP_ERROR', ruta, status: r.status, cuerpo: texto.slice(0, 300) })
    throw new AppError('No se pudo conectar con la pasarela de pagos. Intenta de nuevo en un momento.', 502)
  }
  return JSON.parse(texto) as T
}

const DIA = 864e5

/**
 * Prepara el pago de un plan y devuelve la configuración que monta el checkout de la pantalla.
 * Si todavía hay días cubiertos (la prueba o el periodo ya pagado), el primer cobro espera a que terminen.
 */
export async function pagarPlan(espacioDado: string, plan: Plan, periodo: Periodo, email: string): Promise<{ checkout: string; plan: Plan; periodo: Periodo; total: number; primerCobro: string; email: string }> {
  if (!pagosListos()) throw new AppError('Los pagos todavía no están activos. Escríbenos y te activamos el plan.', 503)
  const espacioId = await cuentaDe(espacioDado)
  const variante = VARIANTES[`${plan}-${periodo}`]
  if (!variante) throw new ValidationError('Ese plan no está disponible.')
  const e = await prisma.crmEspacio.findUnique({ where: { id: espacioId }, select: { creemSuscripcion: true, estadoPlan: true, plan: true, periodo: true, pruebaHasta: true, renuevaEl: true, cancelaAlFinal: true } })
  if (!e) throw new ValidationError('Espacio no encontrado')
  const ahora = Date.now()
  const pagado = ['activo', 'pago-pendiente', 'cancelado'].includes(e.estadoPlan) && !!e.renuevaEl && e.renuevaEl.getTime() > ahora
  if (pagado && e.estadoPlan !== 'cancelado' && !e.cancelaAlFinal && e.plan === plan && (e.periodo ?? 'mensual') === periodo) throw new ValidationError(`Ya tienes el plan ${NOMBRE[plan]} ${periodo}.`)
  // Días ya cubiertos: los de la prueba, o los del periodo pagado si cambia de plan o lo renueva antes de que venza.
  const hasta = e.estadoPlan === 'prueba' && e.pruebaHasta && e.pruebaHasta.getTime() > ahora ? e.pruebaHasta : pagado ? e.renuevaEl! : null
  const dias = hasta ? Math.min(365, Math.max(1, Math.ceil((hasta.getTime() - ahora) / DIA))) : 0
  const anterior = pagado && e.estadoPlan !== 'cancelado' && e.creemSuscripcion ? e.creemSuscripcion : ''
  const precio = PRECIOS[plan][periodo]
  const cuerpo = {
    account_id: WHOP_CUENTA(),
    metadata: { espacio: espacioId, plan, periodo, ...(anterior ? { anterior } : {}) },
    // ACH es transferencia de bancos de Estados Unidos: no les sirve a los clientes de Wali. PayPal siempre visible.
    payment_method_configuration: { disabled: ['us_bank_account'], enabled: ['paypal'], include_platform_defaults: true },
    ...(dias
      ? { variant: { product_id: WHOP_PRODUCTO(), title: `${NOMBRE[plan]} ${periodo}`, billing_type: 'renewal', initial_price: 0, renewal_price: precio, billing_period: periodo === 'anual' ? 365 : 30, currency: 'usd', trial_period_days: dias, visibility: 'hidden', unlimited_stock: true, metadata: { plan, periodo } } }
      : { variant_id: variante }),
  }
  const ch = await whop<{ id: string }>('/checkout_configurations', cuerpo)
  logger.info({ evento: 'PAGO_PREPARADO', espacioId, plan, periodo, dias })
  return { checkout: ch.id, plan, periodo, total: precio * 100, primerCobro: new Date(ahora + dias * DIA).toISOString(), email }
}

/** Dónde gestiona la empresa su suscripción en Whop (tarjeta, facturas y cancelación). */
export async function portalPagos(espacioDado: string): Promise<{ url: string }> {
  const espacioId = await cuentaDe(espacioDado)
  const e = await prisma.crmEspacio.findUnique({ where: { id: espacioId }, select: { creemSuscripcion: true } })
  if (!e?.creemSuscripcion) throw new ValidationError('Todavía no tienes pagos registrados.')
  const m = await whop<{ manage_url?: string | null }>(`/memberships/${encodeURIComponent(e.creemSuscripcion)}`)
  return { url: m.manage_url || 'https://whop.com/@me/settings/memberships/' }
}

// ─── Avisos de Whop ─────────────────────────────────────────────────────────

/**
 * Verifica la firma (Standard Webhooks, como el SDK de Whop): HMAC-SHA256 de «id.timestamp.cuerpo» con los bytes del
 * secreto ws_… tal cual, en base64; el encabezado trae «v1,firma» (una o varias). Avisos de más de 5 minutos, fuera.
 */
export function firmaWhopValida(cuerpo: Buffer, id: string | undefined, marca: string | undefined, firmas: string | undefined): boolean {
  const secreto = process.env.WHOP_WEBHOOK_SECRET
  if (!secreto || !id || !marca || !firmas) return false
  const t = Number(marca)
  if (!Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > 300) return false
  const esperada = crypto.createHmac('sha256', Buffer.from(secreto, 'utf8')).update(`${id}.${marca}.`).update(cuerpo).digest()
  return firmas.split(' ').some(f => {
    const [v, b64] = f.split(',')
    if (v !== 'v1' || !b64) return false
    const dada = Buffer.from(b64, 'base64')
    return dada.length === esperada.length && crypto.timingSafeEqual(dada, esperada)
  })
}

/** Whop manda los montos en dólares (59 o "59.00"): aquí se guardan en centavos. */
const centavos = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN
  return Number.isFinite(n) ? Math.round(n * 100) : null
}

/** Plan y periodo: la metadata del pago o, si no viene, la del plan de Whop o su id. */
function planDeAviso(meta: Obj, varianteId: string): { plan: Plan; periodo: Periodo } | null {
  const plan = txt(meta.plan), periodo = txt(meta.periodo)
  if (esPlan(plan) && (periodo === 'mensual' || periodo === 'anual')) return { plan, periodo }
  const clave = Object.entries(VARIANTES).find(([, id]) => id === varianteId)?.[0] ?? ''
  const [p, q] = clave.split('-')
  return esPlan(p) && (q === 'mensual' || q === 'anual') ? { plan: p, periodo: q } : null
}

async function espacioDeMembresia(meta: Obj, membresia: string): Promise<string> {
  const espacio = txt(meta.espacio)
  if (espacio || !membresia) return espacio
  return (await prisma.crmEspacio.findFirst({ where: { creemSuscripcion: membresia }, select: { id: true } }))?.id ?? ''
}

/** Una membresía cambió: activa, en prueba (el primer cobro espera), con cobro pendiente, cancelada o vencida. */
async function avisoMembresia(m: Obj) {
  const id = txt(m.id), estado = txt(m.status), meta = obj(m.metadata)
  const espacio = await espacioDeMembresia(meta, id)
  if (!espacio) { logger.warn({ evento: 'WHOP_MEMBRESIA_SIN_ESPACIO', id, estado }); return }
  const e = await prisma.crmEspacio.findUnique({ where: { id: espacio }, select: { creemSuscripcion: true, estadoPlan: true } })
  if (!e || e.estadoPlan === 'interno') return
  const viva = ['active', 'trialing', 'canceling', 'past_due'].includes(estado)
  // El aviso de una membresía vieja (la que se reemplazó al cambiar de plan) no toca el plan de hoy.
  if (e.creemSuscripcion && e.creemSuscripcion !== id && !viva) { logger.info({ evento: 'WHOP_MEMBRESIA_VIEJA', espacio, id, estado }); return }
  const producto = planDeAviso(meta, txt(m.variant_id) || idDe(m.variant))
  const fin = fechaDe(m.current_period_end) ?? fechaDe(m.expires_at)
  const data: Record<string, unknown> = { creemSuscripcion: id }
  if (txt(m.member_id)) data.creemCliente = txt(m.member_id)
  if (producto) { data.plan = producto.plan; data.periodo = producto.periodo }
  if (fin) data.renuevaEl = fin
  data.cancelaAlFinal = m.cancel_at_period_end === true || estado === 'canceling'
  if (estado === 'active' || estado === 'trialing' || estado === 'canceling') data.estadoPlan = 'activo'
  else if (estado === 'past_due') data.estadoPlan = 'pago-pendiente'
  else if (['canceled', 'expired', 'completed'].includes(estado)) data.estadoPlan = fin && fin.getTime() > Date.now() ? 'cancelado' : 'vencido'
  else { logger.info({ evento: 'WHOP_MEMBRESIA_IGNORADA', espacio, id, estado }); return }
  await prisma.crmEspacio.updateMany({ where: { id: espacio, NOT: { estadoPlan: 'interno' } }, data })
  // Al cambiar de plan, la suscripción anterior se cancela ya: la nueva arranca a cobrar cuando vencía la vieja.
  const anterior = txt(meta.anterior)
  if (viva && anterior && anterior !== id) {
    await whop(`/memberships/${encodeURIComponent(anterior)}/cancel`, { cancel_at_period_end: false, reason: 'Cambió de plan en Wali' })
      .catch(err => logger.warn({ evento: 'WHOP_ANTERIOR_NO_CANCELADA', espacio, anterior, err: (err as Error).message }))
  }
  logger.info({ evento: 'WHOP_MEMBRESIA', espacio, id, estado, plan: producto?.plan })
}

/** Un cobro: pagado o rechazado. Idempotente por el id del pago. Los de 0 (la tarjeta guardada para después) no van. */
async function avisoPago(p: Obj, estado: 'pagado' | 'rechazado') {
  const id = txt(p.id), meta = obj(p.metadata), membresia = txt(p.membership_id)
  const total = centavos(p.total) ?? 0
  if (!id || (estado === 'pagado' && total <= 0)) return
  const espacio = await espacioDeMembresia(meta, membresia)
  if (!espacio) { logger.warn({ evento: 'WHOP_PAGO_SIN_ESPACIO', id }); return }
  const e = await prisma.crmEspacio.findUnique({ where: { id: espacio }, select: { plan: true, periodo: true } })
  const producto = planDeAviso(meta, txt(p.variant_id)) ?? { plan: (esPlan(e?.plan ?? '') ? e!.plan : 'starter') as Plan, periodo: (e?.periodo === 'anual' ? 'anual' : 'mensual') as Periodo }
  // El periodo que cubre el cobro sale de la membresía; si Whop no responde, el recibo va sin periodo.
  const m = estado === 'pagado' && membresia ? await whop<Obj>(`/memberships/${encodeURIComponent(membresia)}`).catch(() => null) : null
  const impuestos = centavos(p.tax_amount) ?? 0
  const datos = {
    plan: producto.plan, periodo: producto.periodo, estado, total, impuestos,
    subtotal: centavos(p.subtotal) ?? Math.max(0, total - impuestos),
    moneda: (txt(p.currency) || 'usd').toUpperCase(),
    desde: m ? fechaDe(m.current_period_start) : null, hasta: m ? fechaDe(m.current_period_end) : null,
    fecha: fechaDe(p.paid_at) ?? fechaDe(p.created_at) ?? new Date(),
  }
  const creemId = estado === 'pagado' ? id : `${id}:rechazado`
  await prisma.crmPago.upsert({ where: { creemId }, create: { espacioId: espacio, creemId, ...datos }, update: datos })
  logger.info({ evento: 'WHOP_PAGO', espacio, id, estado, total })
}

/** Aplica un aviso de Whop. Idempotente: guarda estados, no suma ni resta nada. */
export async function procesarAvisoWhop(evento: Obj): Promise<void> {
  const tipo = txt(evento.type), d = obj(evento.data)
  if (tipo === 'membership.activated' || tipo === 'membership.updated') { await avisoMembresia(d); return }
  if (tipo === 'payment.succeeded') { await avisoPago(d, 'pagado'); return }
  if (tipo === 'payment.failed') { await avisoPago(d, 'rechazado'); return }
  logger.info({ evento: 'WHOP_AVISO_IGNORADO', tipo })
}

// ─── Historial y recibos ────────────────────────────────────────────────────

export interface PagoHistorial {
  numero: number; fecha: string; plan: string; periodo: string; estado: string
  desde: string | null; hasta: string | null; subtotal: number; impuestos: number; total: number; reembolso: number; moneda: string
}

/**
 * Lo que usa la cuenta, sumado entre todos sus espacios de trabajo: personas (sin repetir), agentes de IA y espacios.
 * Cada agente trabaja solo en el espacio donde se creó; aquí solo se cuentan.
 */
export async function usoDeCuenta(espacioDado: string): Promise<{ usuarios: number; agentesIA: number; espacios: number }> {
  const cuenta = await cuentaDe(espacioDado)
  const ids = await espaciosDeCuenta(cuenta)
  const [personas, ajustes] = await Promise.all([
    usuariosDeCuenta(cuenta),
    prisma.crmAjuste.findMany({ where: { espacioId: { in: ids }, clave: 'agentes' }, select: { valor: true } }),
  ])
  return { usuarios: personas.length, agentesIA: ajustes.reduce((n, a) => n + (Array.isArray(a.valor) ? a.valor.length : 0), 0), espacios: ids.length }
}

/** Los cobros del espacio, del más reciente al más viejo. */
export async function historialPagos(espacioDado: string, limite = 24): Promise<PagoHistorial[]> {
  const espacioId = await cuentaDe(espacioDado)
  const filas = await prisma.crmPago.findMany({ where: { espacioId }, orderBy: { fecha: 'desc' }, take: limite })
  return filas.map(p => ({
    numero: p.numero, fecha: p.fecha.toISOString(), plan: p.plan, periodo: p.periodo, estado: p.estado,
    desde: p.desde?.toISOString() ?? null, hasta: p.hasta?.toISOString() ?? null, subtotal: p.subtotal, impuestos: p.impuestos, total: p.total, reembolso: p.reembolso, moneda: p.moneda,
  }))
}

/** Un cobro del espacio para su recibo. Solo los pagados o reembolsados tienen recibo. */
export async function pagoDeEspacio(espacioDado: string, numero: number) {
  const espacioId = await cuentaDe(espacioDado)
  const p = await prisma.crmPago.findFirst({ where: { espacioId, numero, estado: { in: ['pagado', 'reembolsado'] } } })
  if (!p) throw new ValidationError('Ese recibo no existe.')
  return p
}
