import { prisma } from '../../config/prisma'
import { logger } from '../../utils/logger'
import { ValidationError } from '../../utils/errors'
import { whop, pagosListos, planesDelSitio, PLANES, VARIANTES, WHOP_CUENTA, WHOP_PRODUCTO } from './plan'

/**
 * Cupones de descuento del panel de superadministrador (maqueta B aprobada el 31-oct). El descuento es un código
 * promocional de Whop (POST /promo_codes, DELETE /promo_codes/:id; id = promo_…) que el cliente escribe en el checkout;
 * aquí se guarda para listarlo y para contar lo que trajo: cada cobro con cupón queda con su código (crm_pagos.cupon,
 * desde el promo_code_id del pago).
 *
 * En Whop: amount_off es el porcentaje (25) o dólares; promo_duration_months 0 = siempre, 1 = una vez, N = N meses.
 * Un cupón de todos los planes vale para el producto entero (también los planes con días de prueba que crea el
 * checkout); uno de planes sueltos vale solo para esos planes, así que no aplica mientras quedan días de prueba.
 */

export interface NuevoCupon {
  codigo: string
  tipo: 'porcentaje' | 'fijo'
  /** Porcentaje (1–100) o monto en centavos de dólar. */
  valor: number
  duracion: 'once' | 'forever' | 'repeating'
  meses?: number
  planes: string[]
  vence?: string
  maxUsos?: number
}

type Descuento = { id?: string; status?: string; uses?: number }

// Los usos los lleva Whop: se preguntan una vez por minuto como mucho.
let usosCache: { en: number; usos: Map<string, { usos: number; estado: string }> } | null = null
async function usosEnWhop(ids: string[]): Promise<Map<string, { usos: number; estado: string }>> {
  if (usosCache && Date.now() - usosCache.en < 60_000 && ids.every(id => usosCache!.usos.has(id))) return usosCache.usos
  const usos = new Map<string, { usos: number; estado: string }>()
  await Promise.all(ids.map(async id => {
    try {
      const d = await whop<Descuento>(`/promo_codes/${encodeURIComponent(id)}`)
      usos.set(id, { usos: typeof d.uses === 'number' ? d.uses : 0, estado: d.status ?? '' })
    } catch { /* si Whop no responde, el cupón se muestra sin usos */ }
  }))
  usosCache = { en: Date.now(), usos }
  return usos
}

/** El estado que se muestra: Whop manda (archivado o inactivo) y si no responde, se deduce de las fechas y los usos. */
function estadoDe(c: { estado: string; vence: Date | null; maxUsos: number | null }, usos: number, whopEstado: string) {
  if (c.estado === 'eliminado' || whopEstado === 'archived') return 'eliminado'
  if (c.maxUsos != null && usos >= c.maxUsos) return 'agotado'
  if (whopEstado === 'inactive' || (c.vence && c.vence.getTime() < Date.now())) return 'vencido'
  return 'activo'
}

const inicioMes = () => { const d = new Date(Date.now() - 5 * 3_600_000); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) + 5 * 3_600_000) }

/** Los cupones con sus usos, lo que trajeron y lo que descontaron, más las cifras de arriba. */
export async function listaCupones() {
  const cupones = await prisma.crmCupon.findMany({ orderBy: { createdAt: 'desc' } })
  const vivos = cupones.filter(c => c.estado !== 'eliminado').map(c => c.id)
  const [usos, porCupon, delMes, precios] = await Promise.all([
    vivos.length ? usosEnWhop(vivos) : Promise.resolve(new Map<string, { usos: number; estado: string }>()),
    prisma.crmPago.groupBy({ by: ['cupon'], where: { cupon: { not: null }, estado: { in: ['pagado', 'reembolsado'] } }, _sum: { total: true, descuento: true }, _count: { _all: true } }),
    prisma.crmPago.count({ where: { cupon: { not: null }, estado: 'pagado', fecha: { gte: inicioMes() } } }),
    preciosMensuales(),
  ])
  const pagos = new Map(porCupon.map(p => [p.cupon as string, p]))
  const filas = cupones.map(c => {
    const u = usos.get(c.id), p = pagos.get(c.codigo)
    const n = u?.usos ?? p?._count._all ?? 0
    return {
      id: c.id, codigo: c.codigo, tipo: c.tipo, valor: c.valor, duracion: c.duracion, meses: c.meses, planes: c.planes,
      vence: c.vence, maxUsos: c.maxUsos, creado: c.createdAt, usos: n,
      ingreso: p?._sum.total ?? 0, descuento: p?._sum.descuento ?? 0,
      estado: estadoDe(c, n, u?.estado ?? ''),
    }
  })
  return {
    cupones: filas, precios,
    activos: filas.filter(c => c.estado === 'activo').length, creados: filas.length,
    usosMes: delMes,
    ingreso: filas.reduce((s, c) => s + c.ingreso, 0), descuento: filas.reduce((s, c) => s + c.descuento, 0),
    pagosListos: pagosListos(),
  }
}

/** El precio mensual de cada plan (centavos), según la página de precios, para mostrar cómo queda con el cupón. */
async function preciosMensuales(): Promise<Record<string, number>> {
  const planes = await planesDelSitio() as { id?: string; precioMensual?: number; mensual?: number; precio?: number }[]
  const precios: Record<string, number> = {}
  for (const p of planes) {
    const v = p.precioMensual ?? p.mensual ?? p.precio
    if (p.id && typeof v === 'number') precios[p.id] = Math.round(v * 100)
  }
  return precios
}

/** Crea el código en Whop y lo guarda. El código va en mayúsculas, solo letras y números. */
export async function crearCupon(d: NuevoCupon, quien: string) {
  const codigo = d.codigo.trim().toUpperCase()
  if (!/^[A-Z0-9]{3,30}$/.test(codigo)) throw new ValidationError('El código lleva de 3 a 30 letras o números, sin espacios.')
  if (await prisma.crmCupon.findUnique({ where: { codigo } })) throw new ValidationError('Ya existe un cupón con ese código.')
  const planes = [...new Set(d.planes)].filter(p => (PLANES as string[]).includes(p))
  if (!planes.length) throw new ValidationError('Elige al menos un plan.')
  const todos = PLANES.every(p => planes.includes(p))
  const r = await whop<{ id: string }>('/promo_codes', {
    account_id: WHOP_CUENTA(), code: codigo,
    promo_type: d.tipo === 'porcentaje' ? 'percentage' : 'flat_amount',
    amount_off: d.tipo === 'porcentaje' ? d.valor : d.valor / 100, base_currency: 'usd',
    promo_duration_months: d.duracion === 'forever' ? 0 : d.duracion === 'once' ? 1 : Math.max(1, d.meses ?? 1),
    new_users_only: false, one_per_customer: true,
    ...(todos ? { product_id: WHOP_PRODUCTO() } : { variant_ids: planes.flatMap(p => [VARIANTES[`${p}-mensual`], VARIANTES[`${p}-anual`]]) }),
    ...(d.vence ? { expires_at: new Date(d.vence).toISOString() } : {}),
    ...(d.maxUsos ? { stock: d.maxUsos, unlimited_stock: false } : { unlimited_stock: true }),
  })
  const cupon = await prisma.crmCupon.create({ data: {
    id: r.id, codigo, tipo: d.tipo, valor: d.valor, duracion: d.duracion, meses: d.duracion === 'repeating' ? d.meses ?? null : null,
    planes: d.planes, vence: d.vence ? new Date(d.vence) : null, maxUsos: d.maxUsos ?? null, creadoPor: quien,
  } })
  usosCache = null
  logger.info({ evento: 'CUPON_CREADO', codigo, por: quien })
  return cupon
}

/** Elimina el código en Whop (no se puede deshacer) y lo marca como eliminado; su historial de cobros se queda. */
export async function eliminarCupon(id: string, quien: string) {
  const c = await prisma.crmCupon.findUnique({ where: { id } })
  if (!c || c.estado === 'eliminado') throw new ValidationError('Ese cupón no existe.')
  await whop(`/promo_codes/${encodeURIComponent(id)}`, undefined, 'DELETE')
  await prisma.crmCupon.update({ where: { id }, data: { estado: 'eliminado' } })
  usosCache = null
  logger.info({ evento: 'CUPON_ELIMINADO', codigo: c.codigo, por: quien })
}
