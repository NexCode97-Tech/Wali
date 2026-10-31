import { prisma } from '../../config/prisma'
import { logger } from '../../utils/logger'
import { ValidationError } from '../../utils/errors'
import { creem, productosDePlan, pagosListos, planesDelSitio } from './plan'

/**
 * Cupones de descuento del panel de superadministrador (maqueta B aprobada el 31-oct). El descuento se crea y se
 * borra en Creem (POST /v1/discounts, DELETE /v1/discounts/:id/delete); aquí se guarda para listarlo y para contar lo
 * que trajo: cada cobro pagado con cupón queda con su código (crm_pagos.cupon, desde la metadata del pago).
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

type Descuento = { id?: string; status?: string; redeem_count?: number }

// Los usos los lleva Creem: se preguntan una vez por minuto como mucho.
let usosCache: { en: number; usos: Map<string, { usos: number; estado: string }> } | null = null
async function usosEnCreem(ids: string[]): Promise<Map<string, { usos: number; estado: string }>> {
  if (usosCache && Date.now() - usosCache.en < 60_000 && ids.every(id => usosCache!.usos.has(id))) return usosCache.usos
  const usos = new Map<string, { usos: number; estado: string }>()
  await Promise.all(ids.map(async id => {
    try {
      const d = await creem<Descuento>(`/discounts?discount_id=${encodeURIComponent(id)}`)
      usos.set(id, { usos: typeof d.redeem_count === 'number' ? d.redeem_count : 0, estado: d.status ?? '' })
    } catch { /* si Creem no responde, el cupón se muestra sin usos */ }
  }))
  usosCache = { en: Date.now(), usos }
  return usos
}

/** El estado que se muestra: Creem manda (vencido, agotado, eliminado) y si no responde, se deduce de las fechas. */
function estadoDe(c: { estado: string; vence: Date | null; maxUsos: number | null }, usos: number, creemEstado: string) {
  if (c.estado === 'eliminado' || creemEstado === 'deleted') return 'eliminado'
  if (c.maxUsos != null && usos >= c.maxUsos) return 'agotado'
  if (creemEstado === 'expired' || (c.vence && c.vence.getTime() < Date.now())) return 'vencido'
  if (creemEstado === 'scheduled') return 'programado'
  return 'activo'
}

const inicioMes = () => { const d = new Date(Date.now() - 5 * 3_600_000); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) + 5 * 3_600_000) }

/** Los cupones con sus usos, lo que trajeron y lo que descontaron, más las cifras de arriba. */
export async function listaCupones() {
  const cupones = await prisma.crmCupon.findMany({ orderBy: { createdAt: 'desc' } })
  const vivos = cupones.filter(c => c.estado !== 'eliminado').map(c => c.id)
  const [usos, porCupon, delMes, precios] = await Promise.all([
    vivos.length ? usosEnCreem(vivos) : Promise.resolve(new Map<string, { usos: number; estado: string }>()),
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

/** Crea el cupón en Creem y lo guarda. El código va en mayúsculas, solo letras y números. */
export async function crearCupon(d: NuevoCupon, quien: string) {
  const codigo = d.codigo.trim().toUpperCase()
  if (!/^[A-Z0-9]{3,30}$/.test(codigo)) throw new ValidationError('El código lleva de 3 a 30 letras o números, sin espacios.')
  if (await prisma.crmCupon.findUnique({ where: { codigo } })) throw new ValidationError('Ya existe un cupón con ese código.')
  const productos = [...new Set(d.planes.flatMap(productosDePlan))]
  if (!productos.length) throw new ValidationError('Los productos de Creem de esos planes no están configurados.')
  const r = await creem<{ id: string }>('/discounts', {
    name: codigo, code: codigo,
    type: d.tipo === 'porcentaje' ? 'percentage' : 'fixed',
    ...(d.tipo === 'porcentaje' ? { percentage: d.valor } : { amount: d.valor, currency: 'USD' }),
    duration: d.duracion, ...(d.duracion === 'repeating' ? { duration_in_months: d.meses } : {}),
    applies_to_products: productos,
    ...(d.vence ? { expiry_date: new Date(d.vence).toISOString() } : {}),
    ...(d.maxUsos ? { max_redemptions: d.maxUsos } : {}),
  })
  const cupon = await prisma.crmCupon.create({ data: {
    id: r.id, codigo, tipo: d.tipo, valor: d.valor, duracion: d.duracion, meses: d.duracion === 'repeating' ? d.meses ?? null : null,
    planes: d.planes, vence: d.vence ? new Date(d.vence) : null, maxUsos: d.maxUsos ?? null, creadoPor: quien,
  } })
  usosCache = null
  logger.info({ evento: 'CUPON_CREADO', codigo, por: quien })
  return cupon
}

/** Elimina el cupón en Creem (no se puede deshacer) y lo marca como eliminado; su historial de cobros se queda. */
export async function eliminarCupon(id: string, quien: string) {
  const c = await prisma.crmCupon.findUnique({ where: { id } })
  if (!c || c.estado === 'eliminado') throw new ValidationError('Ese cupón no existe.')
  await creem(`/discounts/${encodeURIComponent(id)}/delete`, undefined, 'DELETE')
  await prisma.crmCupon.update({ where: { id }, data: { estado: 'eliminado' } })
  usosCache = null
  logger.info({ evento: 'CUPON_ELIMINADO', codigo: c.codigo, por: quien })
}
