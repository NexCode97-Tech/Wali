import crypto from 'crypto'
import { prisma } from '../../config/prisma'
import { logger } from '../../utils/logger'
import { AppError, ForbiddenError, ValidationError } from '../../utils/errors'
import { cuentaDe, espaciosDeCuenta, usuariosDeCuenta } from './espacio'

/**
 * El plan de cada espacio. El cobro, las suscripciones y los cupones los hace Whop (ver «Pagar con Whop» más abajo).
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
  /** Cobro por usuarios: los que cubre lo pagado, el precio de hoy y la bajada programada (si la hay). */
  usuarios: { pagados: number | null; precio: number | null; prox: number | null; proxDesde: string | null }
}

const esPlan = (v: string): v is Plan => (PLANES as string[]).includes(v)

/**
 * Lo que permite una cuenta hoy (6-oct): en la prueba de 10 días, todo lo de Business (agentes IA, espacios, usuarios);
 * la prueba es de la cuenta y no se reinicia al crear espacios de trabajo. Después, lo de su plan.
 */
export function limitesDe(e: { plan: string; estadoPlan: string; pruebaHasta?: Date | null; usuarios?: number | null; usuariosProx?: number | null; usuariosProxDesde?: Date | null }): { usuarios: number; agentesIA: number; espacios: number } {
  const enPrueba = e.estadoPlan === 'prueba' && !!e.pruebaHasta && e.pruebaHasta.getTime() > Date.now()
  const base = LIMITES[enPrueba ? 'business' : planEfectivo(e)]
  // Cobro por usuarios (10-nov): con un pago que dice cuántos usuarios cubre, ese es el tope (no el del plan).
  if (!enPrueba && e.usuarios != null) return { ...base, usuarios: usuariosPagados(e) }
  return base
}

export async function estadoPlan(espacioDado: string): Promise<EstadoPlan> {
  // El plan es de la cuenta: un espacio de trabajo usa el de la cuenta a la que pertenece.
  const espacioId = await cuentaDe(espacioDado)
  const e = await prisma.crmEspacio.findUnique({ where: { id: espacioId } })
  if (!e) throw new ValidationError('Espacio no encontrado')
  const ahora = Date.now()
  const plan: Plan = planEfectivo(e, ahora)
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
    usuarios: (() => {
      if (e.estadoPlan === 'interno' || enPrueba || e.usuarios == null) return { pagados: null, precio: null, prox: null, proxDesde: null }
      const n = usuariosPagados(e, ahora), per: Periodo = e.periodo === 'anual' ? 'anual' : 'mensual'
      const prox = e.usuariosProx != null && e.usuariosProxDesde && e.usuariosProxDesde.getTime() > ahora ? e.usuariosProx : null
      return { pagados: n, precio: precioUsuarios(n, per), prox, proxDesde: prox != null ? e.usuariosProxDesde!.toISOString() : null }
    })(),
  }
}

/** El mismo aviso en todos los lugares que agregan a alguien (invitar, crear usuario, agregar a un equipo, espacio nuevo). */
export const topeUsuariosTexto = (tope: number) => `Tu plan cubre ${tope} ${tope === 1 ? "usuario" : "usuarios"} y ya están en uso. Agrega usuarios en Ajustes, Plan y pagos, y vuelve a intentarlo.`

/** Cuántos usuarios permite el plan del espacio (Infinity si no hay límite o es interno). */
export async function limiteUsuarios(espacioDado: string): Promise<number> {
  const espacioId = await cuentaDe(espacioDado)
  const e = await prisma.crmEspacio.findUnique({ where: { id: espacioId }, select: { plan: true, estadoPlan: true, pruebaHasta: true, usuarios: true, usuariosProx: true, usuariosProxDesde: true } })
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
 * - WHOP_API_KEY: clave de la empresa WaliCRM en Whop (permisos: checkout_configuration:create, plan:create, plan:basic:read, payment:create,
 *   plan:basic:read, payment:basic:read, member:basic:read, member:email:read, membership:cancel, membership:update, promo_code:create,
 *   promo_code:basic:read, promo_code:delete).
 * - WHOP_WEBHOOK_SECRET: el secreto ws_… de los avisos (POST /api/pagos/whop).
 *
 * El primer cobro espera a que termine la prueba gratis, o el periodo que ya está pagado si cambia de plan: el plan de
 * esa compra lleva esos días de prueba en Whop. Al activarse una suscripción nueva, la anterior se cancela.
 * En la base, los campos creem_* guardan lo de Whop: creemSuscripcion = la membresía (mem_), creemCliente = el
 * miembro (mber_) y crm_pagos.creem_id = el pago (pay_).
 */
const WHOP_API = 'https://api.whop.com/api/v1'
const WHOP_VERSION = '2026-11-05-1'
export const WHOP_CUENTA = () => process.env.WHOP_CUENTA || 'biz_QCxhCFgBRJnw7V'
export const WHOP_PRODUCTO = () => process.env.WHOP_PRODUCTO || 'prod_jhPZ6ykLDThWs'
/** Los planes de Wali en Whop (ocultos, renovables, precio inicial 0: el primer cobro es el de la renovación). */
export const VARIANTES: Record<string, string> = {
  'starter-mensual': 'plan_7lAfeZkgFJepz', 'starter-anual': 'plan_72eLZ2Ejynk5p',
  'growth-mensual': 'plan_t0djqeyHgmKGn', 'growth-anual': 'plan_VZQYof0XPyN3K',
  'business-mensual': 'plan_EebIGQK97fZne', 'business-anual': 'plan_SgjfYh73trzEw',
}
/** Precio en USD de cada plan y periodo (el mismo de la página de precios y de Whop). */
export const PRECIOS: Record<Plan, Record<Periodo, number>> = {
  starter: { mensual: 59, anual: 566 }, growth: { mensual: 139, anual: 1334 }, business: { mensual: 259, anual: 2486 },
}
const NOMBRE: Record<Plan, string> = { starter: 'Starter', growth: 'Growth', business: 'Business' }

// ─── Cobro por usuarios (10-nov, maqueta «Cobro por usuarios» opción A) ──────────────────────────────────────────
// La misma fórmula de la página de precios (web/lib/precios-crm.ts, precioPorUsuarios): Starter 59 + 20 por usuario
// desde 3; Growth 139 + 10 desde 6; Business 259 + 10 desde 11 hasta 15, y USD 20 por cada usuario desde el 16.
// El anual es 12 meses con 20 % de descuento, redondeado como en la página (566, 1.334, 2.486…).
export const USUARIOS_MIN = 3
export const USUARIOS_MAX = 200
export function precioMensual(n: number): number {
  if (n <= 5) return 59 + 20 * (n - 3)
  if (n <= 10) return 139 + 10 * (n - 6)
  if (n <= 15) return 259 + 10 * (n - 11)
  return 299 + 20 * (n - 15)
}
export const precioUsuarios = (n: number, periodo: Periodo): number => periodo === 'anual' ? Math.round(precioMensual(n) * 12 * 0.8) : precioMensual(n)
export const planDeUsuarios = (n: number): Plan => (n <= 5 ? 'starter' : n <= 10 ? 'growth' : 'business')
/** El tope de usuarios de un plan sin cobro por usuarios (los pagos de antes del 10-nov). */
const TOPE_PLAN: Record<Plan, number> = { starter: 5, growth: 10, business: 15 }

type ConUsuarios = { plan: string; usuarios?: number | null; usuariosProx?: number | null; usuariosProxDesde?: Date | null }
/** Cuántos usuarios cubre lo pagado hoy: la bajada programada cuenta desde su fecha; sin dato, el tope de su plan. */
export function usuariosPagados(e: ConUsuarios, ahora = Date.now()): number {
  if (e.usuariosProx != null && e.usuariosProxDesde && e.usuariosProxDesde.getTime() <= ahora) return e.usuariosProx
  if (e.usuarios != null) return e.usuarios
  return TOPE_PLAN[esPlan(e.plan) ? e.plan : 'starter']
}
/** El plan de hoy: con una bajada que ya llegó a su fecha, el de esos usuarios. */
export function planEfectivo(e: ConUsuarios, ahora = Date.now()): Plan {
  if (e.usuariosProx != null && e.usuariosProxDesde && e.usuariosProxDesde.getTime() <= ahora) return planDeUsuarios(e.usuariosProx)
  return esPlan(e.plan) ? e.plan : 'starter'
}

export const pagosListos = () => !!process.env.WHOP_API_KEY

export async function whop<T>(ruta: string, cuerpo?: unknown, metodo?: 'GET' | 'POST' | 'PATCH' | 'DELETE'): Promise<T> {
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
 * Prepara el pago y devuelve lo que monta el checkout de la pantalla. Cobro por usuarios (10-nov): se paga por cuántos
 * usuarios (mínimo 3 y nunca menos de los que ya están en la cuenta); el plan sale solo de ese número. Cada pago lleva su
 * propio plan oculto en Whop con el precio de esos usuarios; si quedan días cubiertos (la prueba o el periodo pagado),
 * el primer cobro espera a que terminen.
 */
export async function pagarPlan(espacioDado: string, usuarios: number, periodo: Periodo, email: string): Promise<{ variante: string; cuenta: string; plan: Plan; periodo: Periodo; usuarios: number; total: number; primerCobro: string; email: string }> {
  if (!pagosListos()) throw new AppError('Los pagos todavía no están activos. Escríbenos y te activamos el plan.', 503)
  const espacioId = await cuentaDe(espacioDado)
  const c = await condicionesDePago(espacioId, usuarios, periodo)
  const variante = (await whop<{ id: string }>('/plans', {
    account_id: WHOP_CUENTA(), product_id: WHOP_PRODUCTO(), title: `${NOMBRE[c.plan]} ${periodo} · ${c.usuarios} usuarios`, billing_type: 'renewal',
    initial_price: 0, renewal_price: c.precio, billing_period: periodo === 'anual' ? 365 : 30, currency: 'usd',
    ...(c.dias ? { trial_period_days: c.dias } : {}), visibility: 'hidden', unlimited_stock: true,
    metadata: { plan: c.plan, periodo, espacio: espacioId, usuarios: String(c.usuarios) }, payment_method_configuration: METODOS,
  })).id
  logger.info({ evento: 'PAGO_PREPARADO', espacioId, plan: c.plan, periodo, usuarios: c.usuarios, dias: c.dias })
  return { variante, cuenta: WHOP_CUENTA(), plan: c.plan, periodo, usuarios: c.usuarios, total: c.precio * 100, primerCobro: new Date(Date.now() + c.dias * DIA).toISOString(), email }
}

// ACH es transferencia de bancos de Estados Unidos: no les sirve a los clientes de Wali. PayPal siempre que Whop lo apruebe.
const METODOS = { disabled: ['us_bank_account'], enabled: ['paypal'], include_platform_defaults: true }

async function condicionesDePago(espacioId: string, pedidos: number, periodo: Periodo) {
  const e = await prisma.crmEspacio.findUnique({ where: { id: espacioId }, select: { creemSuscripcion: true, estadoPlan: true, plan: true, periodo: true, pruebaHasta: true, renuevaEl: true, cancelaAlFinal: true, usuarios: true, usuariosProx: true, usuariosProxDesde: true } })
  if (!e) throw new ValidationError('Espacio no encontrado')
  const enUso = (await usuariosDeCuenta(espacioId)).length
  if (!Number.isInteger(pedidos) || pedidos > USUARIOS_MAX) throw new ValidationError('Ese número de usuarios no es válido.')
  const usuarios = Math.max(USUARIOS_MIN, enUso, pedidos)
  const plan = planDeUsuarios(usuarios)
  const ahora = Date.now()
  const pagado = ['activo', 'pago-pendiente', 'cancelado'].includes(e.estadoPlan) && !!e.renuevaEl && e.renuevaEl.getTime() > ahora
  if (pagado && e.estadoPlan !== 'cancelado' && !e.cancelaAlFinal && e.usuarios != null && usuariosPagados(e) === usuarios && (e.periodo ?? 'mensual') === periodo) throw new ValidationError(`Ya tienes ${usuarios} usuarios en ${NOMBRE[plan]} ${periodo}.`)
  // Días ya cubiertos: los de la prueba, o los del periodo pagado si cambia o lo renueva antes de que venza.
  const hasta = e.estadoPlan === 'prueba' && e.pruebaHasta && e.pruebaHasta.getTime() > ahora ? e.pruebaHasta : pagado ? e.renuevaEl! : null
  const dias = hasta ? Math.min(365, Math.max(1, Math.ceil((hasta.getTime() - ahora) / DIA))) : 0
  const anterior = pagado && e.estadoPlan !== 'cancelado' && e.creemSuscripcion ? e.creemSuscripcion : ''
  return { plan, usuarios, dias, anterior, precio: precioUsuarios(usuarios, periodo) }
}

/**
 * Cobra con el token que armó el formulario de pago de Whop en el navegador (tarjeta, Google Pay, Apple Pay o PayPal).
 * Solo acepta el plan oculto que Wali creó para este espacio con el precio de esos usuarios: el navegador no puede
 * cambiar lo que se cobra. La membresía queda enlazada al espacio de una vez.
 */
export async function cobrarPlan(espacioDado: string, d: { usuarios: number; periodo: Periodo; variante: string; token: string; regreso: string; cupon?: string }, email: string): Promise<{ id: string; status: string; client_secret: string | null }> {
  if (!pagosListos()) throw new AppError('Los pagos todavía no están activos. Escríbenos y te activamos el plan.', 503)
  const espacioId = await cuentaDe(espacioDado)
  const c = await condicionesDePago(espacioId, d.usuarios, d.periodo)
  const v = await whop<Obj>(`/plans/${encodeURIComponent(d.variante)}`).catch(() => null)
  const meta = obj(v?.metadata), producto = idDe(v?.product)
  const ok = !!v && producto === WHOP_PRODUCTO() && txt(meta.espacio) === espacioId && txt(meta.plan) === c.plan && txt(meta.periodo) === d.periodo
    && txt(meta.usuarios) === String(c.usuarios) && centavos(v.renewal_price) === c.precio * 100 && (centavos(v.initial_price) ?? 0) === 0
  if (!ok) throw new ValidationError('Ese pago ya no es válido. Vuelve a abrir el pago del plan.')
  const metadata = { espacio: espacioId, plan: c.plan, periodo: d.periodo, usuarios: String(c.usuarios), concepto: 'plan', ...(c.anterior ? { anterior: c.anterior } : {}) }
  const pago = await whop<Obj>('/payments', {
    account_id: WHOP_CUENTA(), variant_id: d.variante, confirmation_token: d.token, email, return_url: d.regreso, metadata,
    ...(d.cupon ? { promo_code: d.cupon } : {}),
  })
  logger.info({ evento: 'PAGO_COBRADO', espacioId, plan: c.plan, periodo: d.periodo, usuarios: c.usuarios, id: txt(pago.id), estado: txt(pago.status) })
  const membresia = txt(pago.membership_id)
  if (membresia) await enlazarMembresia(membresia, metadata).catch(err => logger.warn({ evento: 'WHOP_ENLACE_FALLO', espacioId, err: (err as Error).message }))
  return { id: txt(pago.id), status: txt(pago.status), client_secret: txt(pago.client_secret) || null }
}

/** La membresía de un pago se trata como si su aviso trajera el espacio (los pagos llevan la metadata; la membresía no). */
async function enlazarMembresia(membresia: string, meta: Obj) {
  const m = await whop<Obj>(`/memberships/${encodeURIComponent(membresia)}`)
  await avisoMembresia({ ...m, metadata: { ...obj(m.metadata), ...meta } })
}

export async function portalPagos(espacioDado: string): Promise<{ url: string }> {
  const espacioId = await cuentaDe(espacioDado)
  const e = await prisma.crmEspacio.findUnique({ where: { id: espacioId }, select: { creemSuscripcion: true } })
  if (!e?.creemSuscripcion) throw new ValidationError('Todavía no tienes pagos registrados.')
  const m = await whop<{ manage_url?: string | null }>(`/memberships/${encodeURIComponent(e.creemSuscripcion)}`)
  return { url: m.manage_url || 'https://whop.com/@me/settings/memberships/' }
}

// ─── Subir o bajar de usuarios con el plan pagado (10-nov) ──────────────────────────────────────────────────────
// Whop no deja cambiar el precio de una membresía viva: cada cambio es una membresía nueva con un plan oculto propio
// (precio de los usuarios nuevos, días de prueba = lo que queda del periodo, así renueva el mismo día) y la vieja se
// cancela con el aviso de la nueva («anterior», como al cambiar de plan). Subir cobra hoy la parte proporcional como
// precio inicial de ese plan; bajar no cobra nada. NADA se cobra sin que el administrador lo apruebe en la pantalla:
// cotizar solo calcula; aprobar es el botón «Aprobar pago de USD X».

export interface CotizacionUsuarios {
  actual: number; usuarios: number; plan: Plan; periodo: Periodo; precio: number
  /** Lo que se cobra hoy, en centavos (0 al bajar). */
  hoy: number; dias: number; renuevaEl: string
  tarjeta: { marca: string; ultimos: string } | null
  enUso: number
}

async function cambioDeUsuarios(espacioId: string, pedidos: number) {
  const e = await prisma.crmEspacio.findUnique({ where: { id: espacioId }, select: { estadoPlan: true, plan: true, periodo: true, renuevaEl: true, cancelaAlFinal: true, creemSuscripcion: true, creemCliente: true, usuarios: true, usuariosProx: true, usuariosProxDesde: true, pruebaHasta: true } })
  if (!e) throw new ValidationError('Espacio no encontrado')
  const ahora = Date.now()
  if (e.estadoPlan !== 'activo' || e.cancelaAlFinal || !e.renuevaEl || e.renuevaEl.getTime() <= ahora || !e.creemSuscripcion || !e.creemCliente)
    throw new ValidationError('Para cambiar los usuarios, tu plan tiene que estar activo y con renovación. Revisa Plan y pagos.')
  if (!Number.isInteger(pedidos) || pedidos < USUARIOS_MIN || pedidos > USUARIOS_MAX) throw new ValidationError('Ese número de usuarios no es válido.')
  const enUso = (await usuariosDeCuenta(espacioId)).length
  if (pedidos < enUso) throw new ValidationError(`Hoy hay ${enUso} usuarios en uso. Para pagar menos, primero quita a alguien del equipo en Usuarios.`)
  const periodo: Periodo = e.periodo === 'anual' ? 'anual' : 'mensual'
  const actual = usuariosPagados(e, ahora)
  const largo = (periodo === 'anual' ? 365 : 30) * DIA
  const resta = e.renuevaEl.getTime() - ahora
  const dias = Math.min(365, Math.max(1, Math.ceil(resta / DIA)))
  const dif = precioUsuarios(pedidos, periodo) - precioUsuarios(actual, periodo)
  // La parte proporcional de lo que falta del periodo, en centavos; menos de 50 centavos no se cobra.
  let hoy = pedidos > actual ? Math.round(dif * 100 * Math.min(1, resta / largo)) : 0
  if (hoy > 0 && hoy < 50) hoy = 0
  return { e, enUso, actual, periodo, dias, hoy, plan: planDeUsuarios(pedidos), precio: precioUsuarios(pedidos, periodo) }
}

/** La tarjeta guardada del miembro en Whop (la más reciente). */
async function tarjetaGuardada(miembro: string): Promise<{ id: string; marca: string; ultimos: string } | null> {
  const r = await whop<{ data?: Obj[] }>(`/payment_methods?member_id=${encodeURIComponent(miembro)}`).catch(() => null)
  // La membresía no dice con qué medio cobra: es el más reciente del miembro (el que se guardó al cambiarlo).
  const l = (r?.data ?? []).filter(x => txt(x.id)).sort((a, b) => (txt(b.created_at) > txt(a.created_at) ? 1 : -1))
  if (!l.length) return null
  const m = l[0], card = obj(m.card)
  return { id: txt(m.id), marca: nombreMedio(txt(card.brand) || txt(m.payment_method_type) || txt(m.type)), ultimos: txt(card.last4) || txt(m.last4) }
}
const MEDIOS: Record<string, string> = { visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex', american_express: 'Amex', discover: 'Discover', diners: 'Diners', jcb: 'JCB', paypal: 'PayPal', google_pay: 'Google Pay', apple_pay: 'Apple Pay', card: 'Tarjeta' }
const nombreMedio = (v: string) => MEDIOS[v.toLowerCase()] ?? (v ? v[0].toUpperCase() + v.slice(1) : 'Tarjeta')

// ─── Medio de pago y cancelar, dentro de Wali (maqueta aprobada el 10-nov) ─────────────────────────────────────
// Cambiar el medio no cobra: el formulario seguro de Whop en modo setup arma un token, el servidor lo guarda con un
// setup intent y la suscripción queda cobrando a ese medio (si había un cobro vencido, Whop lo reintenta con él).

async function membresiaActiva(espacioId: string) {
  const e = await prisma.crmEspacio.findUnique({ where: { id: espacioId }, select: { creemSuscripcion: true, creemCliente: true, estadoPlan: true, renuevaEl: true, cancelaAlFinal: true } })
  if (!e?.creemSuscripcion || !e.creemCliente) throw new ValidationError('Todavía no tienes un plan pagado.')
  return e as typeof e & { creemSuscripcion: string; creemCliente: string }
}

/** El medio con que se cobra hoy, para el renglón de Pagos. */
export async function medioDePago(espacioDado: string): Promise<{ marca: string; ultimos: string } | null> {
  const e = await prisma.crmEspacio.findUnique({ where: { id: await cuentaDe(espacioDado) }, select: { creemCliente: true } })
  if (!e?.creemCliente || !pagosListos()) return null
  const t = await tarjetaGuardada(e.creemCliente)
  return t ? { marca: t.marca, ultimos: t.ultimos } : null
}

/** Lo que necesita el formulario en modo setup: la cuenta de Whop y el correo del miembro (el medio queda a su nombre). */
export async function prepararMedio(espacioDado: string): Promise<{ cuenta: string; email: string }> {
  const e = await membresiaActiva(await cuentaDe(espacioDado))
  const m = await whop<Obj>(`/members/${encodeURIComponent(e.creemCliente)}`)
  return { cuenta: WHOP_CUENTA(), email: txt(m.email) || txt(obj(m.user).email) }
}

async function asignarMedio(espacioId: string, membresia: string, medio: string) {
  await whop(`/memberships/${encodeURIComponent(membresia)}`, { payment_method_id: medio }, 'PATCH')
  logger.info({ evento: 'MEDIO_CAMBIADO', espacioId, membresia })
}

/** Guarda el medio nuevo (sin cobrar) y lo deja para la suscripción. Si el banco pide un paso más, devuelve su secreto. */
export async function guardarMedio(espacioDado: string, token: string, regreso: string): Promise<{ status: string; id: string; client_secret: string | null }> {
  const espacioId = await cuentaDe(espacioDado)
  const e = await membresiaActiva(espacioId)
  const { email } = await prepararMedio(espacioId)
  const s = await whop<Obj>('/setup_intents', { account_id: WHOP_CUENTA(), confirmation_token: token, ...(email ? { email } : {}), return_url: regreso, metadata: { espacio: espacioId } })
  const estado = txt(s.status), medio = txt(s.payment_method_id)
  if (estado === 'succeeded' && medio) await asignarMedio(espacioId, e.creemSuscripcion, medio)
  return { status: estado, id: txt(s.id), client_secret: txt(s.client_secret) || null }
}

/** Después del paso del banco: si el setup quedó bien y es de este espacio, el medio pasa a la suscripción. */
export async function confirmarMedio(espacioDado: string, setupId: string): Promise<{ ok: boolean }> {
  const espacioId = await cuentaDe(espacioDado)
  const e = await membresiaActiva(espacioId)
  const s = await whop<Obj>(`/setup_intents/${encodeURIComponent(setupId)}`)
  if (txt(obj(s.metadata).espacio) !== espacioId) throw new ValidationError('Ese medio de pago no es de este espacio.')
  if (txt(s.status) !== 'succeeded' || !txt(s.payment_method_id)) return { ok: false }
  await asignarMedio(espacioId, e.creemSuscripcion, txt(s.payment_method_id))
  return { ok: true }
}

/** «Cancelar plan»: sigue activo hasta el fin del periodo y no se renueva. «Renovar» lo deshace (reanudarPlan). */
export async function cancelarPlan(espacioDado: string): Promise<void> {
  const espacioId = await cuentaDe(espacioDado)
  const e = await membresiaActiva(espacioId)
  await whop(`/memberships/${encodeURIComponent(e.creemSuscripcion)}/cancel`, { cancel_at_period_end: true, reason: 'Canceló desde Plan y pagos' })
  await prisma.crmEspacio.update({ where: { id: espacioId }, data: { cancelaAlFinal: true } })
  logger.info({ evento: 'PLAN_CANCELADO', espacioId })
}
export async function reanudarPlan(espacioDado: string): Promise<void> {
  const espacioId = await cuentaDe(espacioDado)
  const e = await membresiaActiva(espacioId)
  if (!e.renuevaEl || e.renuevaEl.getTime() <= Date.now()) throw new ValidationError('Tu plan ya terminó. Elige un plan para volver.')
  await whop(`/memberships/${encodeURIComponent(e.creemSuscripcion)}`, { cancel_at_period_end: false }, 'PATCH')
  await prisma.crmEspacio.update({ where: { id: espacioId }, data: { cancelaAlFinal: false } })
  logger.info({ evento: 'PLAN_REANUDADO', espacioId })
}

export async function cotizarUsuarios(espacioDado: string, pedidos: number): Promise<CotizacionUsuarios> {
  const espacioId = await cuentaDe(espacioDado)
  const c = await cambioDeUsuarios(espacioId, pedidos)
  const t = c.hoy > 0 ? await tarjetaGuardada(c.e.creemCliente!) : null
  return { actual: c.actual, usuarios: pedidos, plan: c.plan, periodo: c.periodo, precio: c.precio, hoy: c.hoy, dias: c.dias, renuevaEl: c.e.renuevaEl!.toISOString(), tarjeta: t ? { marca: t.marca, ultimos: t.ultimos } : null, enUso: c.enUso }
}

/**
 * Antes de invitar a alguien: ¿ocupa un usuario más de los pagados? Si ya está en la cuenta o quedan usuarios libres,
 * no; si no quedan y el plan se paga por usuarios, devuelve la cotización de uno más para que el administrador la apruebe.
 */
export async function usuariosParaInvitar(espacioDado: string, email: string): Promise<{ necesita: false } | ({ necesita: true } & CotizacionUsuarios)> {
  const espacioId = await cuentaDe(espacioDado)
  const [tope, enCuenta, existe] = await Promise.all([
    limiteUsuarios(espacioId), usuariosDeCuenta(espacioId),
    email ? prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } }) : Promise.resolve(null),
  ])
  if ((existe && enCuenta.includes(existe.id)) || enCuenta.length < tope) return { necesita: false }
  const e = await prisma.crmEspacio.findUnique({ where: { id: espacioId }, select: { usuarios: true } })
  if (e?.usuarios == null) throw new ForbiddenError(topeUsuariosTexto(tope))
  return { necesita: true, ...(await cotizarUsuarios(espacioId, enCuenta.length + 1)) }
}

/** Crea la membresía nueva con el precio de esos usuarios. Al subir, cobra hoy `hoy` centavos con la tarjeta guardada. */
async function nuevaMembresiaUsuarios(espacioId: string, pedidos: number, regreso: string, baja: boolean, hoyEsperado?: number) {
  const c = await cambioDeUsuarios(espacioId, pedidos)
  if (!baja && pedidos <= c.actual) throw new ValidationError('Ese cambio no sube los usuarios.')
  // Lo aprobado en pantalla es lo que se cobra: si el valor cambió (pasó un día, otra persona cambió algo), se vuelve a mostrar.
  if (!baja && hoyEsperado !== undefined && hoyEsperado !== c.hoy) throw new ValidationError('El valor cambió desde que lo viste. Revisa el nuevo valor y apruébalo otra vez.')
  const t = await tarjetaGuardada(c.e.creemCliente!)
  if (!t) throw new ValidationError('No encontramos tu tarjeta guardada. Actualízala en Facturas y tarjeta y vuelve a intentarlo.')
  const meta = { plan: c.plan, periodo: c.periodo, espacio: espacioId, usuarios: String(pedidos), ...(baja ? { baja: '1' } : {}) }
  const variante = (await whop<{ id: string }>('/plans', {
    account_id: WHOP_CUENTA(), product_id: WHOP_PRODUCTO(), title: `${NOMBRE[c.plan]} ${c.periodo} · ${pedidos} usuarios`, billing_type: 'renewal',
    initial_price: c.hoy / 100, renewal_price: c.precio, billing_period: c.periodo === 'anual' ? 365 : 30, currency: 'usd',
    trial_period_days: c.dias, visibility: 'hidden', unlimited_stock: true, metadata: meta, payment_method_configuration: METODOS,
  })).id
  const metadata = { ...meta, concepto: baja ? 'plan' : 'usuarios', anterior: c.e.creemSuscripcion! }
  // El administrador está en la pantalla y lo aprobó: cobro con el cliente presente (si el banco pide 3D Secure, se le muestra).
  const pago = await whop<Obj>('/payments', {
    account_id: WHOP_CUENTA(), variant_id: variante, member_id: c.e.creemCliente, payment_method_id: t.id,
    off_session: baja, ...(baja ? {} : { return_url: regreso }), metadata,
  })
  logger.info({ evento: baja ? 'USUARIOS_BAJA' : 'USUARIOS_COBRO', espacioId, de: c.actual, a: pedidos, hoy: c.hoy, id: txt(pago.id), estado: txt(pago.status) })
  const membresia = txt(pago.membership_id)
  if (membresia) await enlazarMembresia(membresia, metadata).catch(err => logger.warn({ evento: 'WHOP_ENLACE_FALLO', espacioId, err: (err as Error).message }))
  return { id: txt(pago.id), status: txt(pago.status), client_secret: txt(pago.client_secret) || null, usuarios: pedidos }
}

/** «Aprobar pago de USD X»: sube a `pedidos` usuarios y cobra hoy la parte proporcional que el administrador vio. */
export function aprobarUsuarios(espacioDado: string, pedidos: number, hoy: number, regreso: string) {
  return cuentaDe(espacioDado).then(id => nuevaMembresiaUsuarios(id, pedidos, regreso, false, hoy))
}

/** «Guardar cambio»: desde la renovación se pagan `pedidos` usuarios (o se deshace una bajada). Hoy no se cobra nada. */
export async function bajarUsuarios(espacioDado: string, pedidos: number) {
  const espacioId = await cuentaDe(espacioDado)
  const e = await prisma.crmEspacio.findUnique({ where: { id: espacioId }, select: { usuarios: true, usuariosProx: true, usuariosProxDesde: true, plan: true } })
  const pagados = e?.usuarios ?? null
  if (pagados == null) throw new ValidationError('Tu plan es de antes del cobro por usuarios. Escríbenos y lo ajustamos.')
  if (pedidos > pagados) throw new ValidationError('Para subir de usuarios hay que aprobar el pago.')
  return nuevaMembresiaUsuarios(espacioId, pedidos, '', true)
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

/** Whop manda los montos en dólares (59, "59.00" o { amount: "59.00", currency }): aquí se guardan en centavos. */
const centavos = (v: unknown): number | null => {
  if (v && typeof v === 'object' && 'amount' in v) v = (v as { amount: unknown }).amount
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
  // Cobro por usuarios: al subir, los usuarios valen desde hoy; al bajar, desde la renovación (hasta entonces sigue
  // el plan y los usuarios que ya pagó, por eso no se toca `plan`).
  const nUsu = Number(txt(meta.usuarios)), baja = txt(meta.baja) === '1'
  const conUsuarios = viva && Number.isInteger(nUsu) && nUsu >= USUARIOS_MIN
  if (producto && !(conUsuarios && baja)) { data.plan = producto.plan; data.periodo = producto.periodo }
  if (conUsuarios && !baja) { data.usuarios = nUsu; data.usuariosProx = null; data.usuariosProxDesde = null }
  if (conUsuarios && baja) {
    const antes = await prisma.crmEspacio.findUnique({ where: { id: espacio }, select: { usuarios: true, renuevaEl: true } })
    const desde = antes?.renuevaEl ?? fin
    if (antes?.usuarios === nUsu) { data.usuariosProx = null; data.usuariosProxDesde = null } else { data.usuariosProx = nUsu; data.usuariosProxDesde = desde }
  }
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
  if (!id) return
  const espacio = await espacioDeMembresia(meta, membresia)
  if (!espacio) { logger.warn({ evento: 'WHOP_PAGO_SIN_ESPACIO', id }); return }
  // Un pago enlaza su membresía si el espacio todavía no la tiene (llegó antes que el aviso de la membresía).
  if (estado === 'pagado' && membresia && txt(meta.espacio)) {
    const ya = await prisma.crmEspacio.findUnique({ where: { id: espacio }, select: { creemSuscripcion: true } })
    if (ya?.creemSuscripcion !== membresia) await enlazarMembresia(membresia, meta).catch(err => logger.warn({ evento: 'WHOP_ENLACE_FALLO', espacio, err: (err as Error).message }))
  }
  if (estado === 'pagado' && total <= 0) return
  const e = await prisma.crmEspacio.findUnique({ where: { id: espacio }, select: { plan: true, periodo: true, usuarios: true, usuariosProx: true, usuariosProxDesde: true } })
  const producto = planDeAviso(meta, txt(p.variant_id)) ?? { plan: (esPlan(e?.plan ?? '') ? e!.plan : 'starter') as Plan, periodo: (e?.periodo === 'anual' ? 'anual' : 'mensual') as Periodo }
  // El periodo que cubre el cobro sale de la membresía; si Whop no responde, el recibo va sin periodo.
  const m = estado === 'pagado' && membresia ? await whop<Obj>(`/memberships/${encodeURIComponent(membresia)}`).catch(() => null) : null
  const impuestos = centavos(p.tax_amount) ?? 0
  const subtotal = centavos(p.subtotal) ?? Math.max(0, total - impuestos)
  // El cupón: Whop manda el id del código (promo_); el panel lo cuenta por su código.
  const promo = txt(p.promo_code_id)
  const cupon = promo ? (await prisma.crmCupon.findUnique({ where: { id: promo }, select: { codigo: true } }))?.codigo ?? null : null
  const datos = {
    plan: producto.plan, periodo: producto.periodo, estado, total, impuestos, subtotal,
    cupon, descuento: cupon ? Math.max(0, subtotal - (total - impuestos)) : 0,
    moneda: (txt(p.currency) || 'usd').toUpperCase(),
    desde: m ? fechaDe(m.current_period_start) : null, hasta: m ? fechaDe(m.current_period_end) : null,
    fecha: fechaDe(p.paid_at) ?? fechaDe(p.created_at) ?? new Date(),
    // Cobro por usuarios: cuántos cubre (la renovación no trae la metadata: los que tiene pagados) y de qué es.
    usuarios: Number(txt(meta.usuarios)) || (e && e.usuarios != null ? usuariosPagados(e) : null),
    concepto: txt(meta.concepto) === 'usuarios' ? 'usuarios' : 'plan',
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
  usuarios: number | null; concepto: string
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
    usuarios: p.usuarios, concepto: p.concepto || 'plan',
  }))
}

/** Un cobro del espacio para su recibo. Solo los pagados o reembolsados tienen recibo. */
export async function pagoDeEspacio(espacioDado: string, numero: number) {
  const espacioId = await cuentaDe(espacioDado)
  const p = await prisma.crmPago.findFirst({ where: { espacioId, numero, estado: { in: ['pagado', 'reembolsado'] } } })
  if (!p) throw new ValidationError('Ese recibo no existe.')
  return p
}
