import { prisma } from '../../config/prisma'

/**
 * Las cifras de dinero del panel de superadministrador (maqueta B aprobada el 31-oct): MRR, su historia, cómo se
 * movió en el mes, ingresos, cobros fallidos y planes. Todo sale de los cobros que Creem avisó (crm_pagos) y del plan
 * de cada cuenta (crm_espacios). Las cuentas internas (NexCode97) no cuentan.
 *
 * MRR de una cuenta en una fecha: lo que pagó en el cobro cuyo periodo cubre esa fecha, sin impuestos, llevado a un
 * mes (el anual se divide entre 12). Así el MRR de cualquier día del pasado se puede reconstruir.
 * Las fechas se cortan en hora de Colombia (UTC−5, sin horario de verano).
 */

const DIA = 86_400_000
const BOGOTA = 5 * 3_600_000

type Pago = { espacioId: string; plan: string; periodo: string; estado: string; subtotal: number; impuestos: number; total: number; reembolso: number; desde: Date | null; hasta: Date | null; fecha: Date; numero: number }
type Cuenta = { id: string; nombre: string; plan: string; periodo: string | null; estadoPlan: string; pruebaHasta: Date | null; renuevaEl: Date | null; cancelaAlFinal: boolean; createdAt: Date }

/** Primer instante del mes (hora de Colombia) que contiene `t`, desplazado `delta` meses. */
function inicioMes(t: number, delta = 0): number {
  const d = new Date(t - BOGOTA)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, 1) + BOGOTA
}
const claveMes = (t: number) => { const d = new Date(t - BOGOTA); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}` }

async function cargar() {
  const [cuentas, pagos] = await Promise.all([
    prisma.crmEspacio.findMany({ where: { cuentaId: null, NOT: { estadoPlan: 'interno' } }, select: { id: true, nombre: true, plan: true, periodo: true, estadoPlan: true, pruebaHasta: true, renuevaEl: true, cancelaAlFinal: true, createdAt: true } }),
    prisma.crmPago.findMany({ select: { espacioId: true, plan: true, periodo: true, estado: true, subtotal: true, impuestos: true, total: true, reembolso: true, desde: true, hasta: true, fecha: true, numero: true }, orderBy: { fecha: 'asc' } }),
  ])
  const ids = new Set(cuentas.map(c => c.id))
  const deCuenta = new Map<string, Pago[]>()
  for (const p of pagos) {
    if (!ids.has(p.espacioId)) continue
    const l = deCuenta.get(p.espacioId) ?? []; l.push(p); deCuenta.set(p.espacioId, l)
  }
  return { cuentas: cuentas as Cuenta[], pagos: pagos.filter(p => ids.has(p.espacioId)) as Pago[], deCuenta }
}

/** Lo que una cuenta aporta al mes en `t` (centavos) y con qué plan, según el cobro pagado que cubre esa fecha. */
function aporte(lista: Pago[] | undefined, t: number): { mrr: number; plan: string; periodo: string } | null {
  if (!lista) return null
  for (let i = lista.length - 1; i >= 0; i--) {
    const p = lista[i]
    if (p.estado !== 'pagado' || !p.desde || !p.hasta) continue
    if (p.desde.getTime() <= t && t < p.hasta.getTime()) {
      const neto = Math.max(0, p.total - p.impuestos)
      return { mrr: Math.round(p.periodo === 'anual' ? neto / 12 : neto), plan: p.plan, periodo: p.periodo }
    }
  }
  return null
}

function foto(datos: Awaited<ReturnType<typeof cargar>>, t: number) {
  const porCuenta = new Map<string, { mrr: number; plan: string; periodo: string }>()
  for (const c of datos.cuentas) { const a = aporte(datos.deCuenta.get(c.id), t); if (a && a.mrr > 0) porCuenta.set(c.id, a) }
  let mrr = 0; for (const a of porCuenta.values()) mrr += a.mrr
  return { mrr, porCuenta }
}

/** Cómo cambió el MRR entre dos fechas: nuevas, suben de plan, bajan de plan y cancelan. */
function movimiento(datos: Awaited<ReturnType<typeof cargar>>, a: number, b: number) {
  const ini = foto(datos, a), fin = foto(datos, b)
  const m = { inicio: ini.mrr, nuevas: 0, suben: 0, bajan: 0, cancelan: 0, cierre: fin.mrr, cuentasNuevas: 0, cuentasCancelan: 0 }
  const ids = new Set([...ini.porCuenta.keys(), ...fin.porCuenta.keys()])
  for (const id of ids) {
    const x = ini.porCuenta.get(id)?.mrr ?? 0, y = fin.porCuenta.get(id)?.mrr ?? 0
    if (!x && y) { m.nuevas += y; m.cuentasNuevas++ }
    else if (x && !y) { m.cancelan += x; m.cuentasCancelan++ }
    else if (y > x) m.suben += y - x
    else if (y < x) m.bajan += x - y
  }
  return m
}

const PLANES = ['growth', 'starter', 'business']

export type Rango = '7d' | '30d' | '12m' | 'todo'

/** El Resumen: MRR y su curva en el rango, cifras con su cambio, planes más vendidos y lo que necesita atención. */
export async function resumenPanel(rango: Rango) {
  const datos = await cargar()
  const ahora = Date.now()
  const primero = datos.pagos.find(p => p.estado === 'pagado')?.fecha.getTime() ?? ahora
  // Los puntos de la curva: días en 7d y 30d, meses en 12m y todo.
  const puntos: { t: number; etiqueta: string }[] = []
  if (rango === '7d' || rango === '30d') {
    const n = rango === '7d' ? 7 : 30
    for (let i = n; i >= 0; i--) puntos.push({ t: ahora - i * DIA, etiqueta: '' })
  } else {
    const meses = rango === '12m' ? 11 : Math.max(1, Math.round((inicioMes(ahora) - inicioMes(primero)) / (30.44 * DIA)))
    for (let i = meses; i >= 1; i--) puntos.push({ t: inicioMes(ahora, -i + 1) - 1, etiqueta: '' })
    puntos.push({ t: ahora, etiqueta: '' })
  }
  const serie = puntos.map(p => ({ t: new Date(p.t).toISOString(), mrr: foto(datos, p.t).mrr }))
  const desde = puntos[0].t
  const hoy = foto(datos, ahora), antes = foto(datos, desde)
  const mov = movimiento(datos, desde, ahora)

  // Pruebas que terminaron en los últimos 90 días y cuántas pasaron a pagar.
  const hace90 = ahora - 90 * DIA
  const pruebas = datos.cuentas.filter(c => c.pruebaHasta && c.pruebaHasta.getTime() >= hace90 && c.pruebaHasta.getTime() <= ahora)
  const convertidas = pruebas.filter(c => (datos.deCuenta.get(c.id) ?? []).some(p => p.estado === 'pagado'))
  const pruebasAntes = datos.cuentas.filter(c => c.pruebaHasta && c.pruebaHasta.getTime() >= hace90 - 90 * DIA && c.pruebaHasta.getTime() < hace90)
  const convAntes = pruebasAntes.filter(c => (datos.deCuenta.get(c.id) ?? []).some(p => p.estado === 'pagado' && p.fecha.getTime() < hace90))

  // Cancelación del mes en curso contra el anterior.
  const mesIni = inicioMes(ahora), mesAnt = inicioMes(ahora, -1)
  const movMes = movimiento(datos, mesIni - 1, ahora), movAnt = movimiento(datos, mesAnt - 1, mesIni - 1)
  const pagabanMes = foto(datos, mesIni - 1).porCuenta.size, pagabanAnt = foto(datos, mesAnt - 1).porCuenta.size

  const planes = PLANES.map(plan => {
    const cuentas = [...hoy.porCuenta.values()].filter(a => a.plan === plan)
    return { plan, empresas: cuentas.length, mrr: cuentas.reduce((s, a) => s + a.mrr, 0) }
  }).sort((a, b) => b.empresas - a.empresas || b.mrr - a.mrr)
  const anuales = [...hoy.porCuenta.values()].filter(a => a.periodo === 'anual')
  const anualTop = PLANES.map(plan => ({ plan, n: anuales.filter(a => a.plan === plan).length })).sort((a, b) => b.n - a.n)[0]

  return {
    rango, serie,
    mrr: hoy.mrr, mrrAntes: antes.mrr,
    pagan: hoy.porCuenta.size, paganAntes: antes.porCuenta.size,
    nuevasEnRango: mov.cuentasNuevas, mrrNuevo: mov.nuevas + mov.suben,
    conversion: pruebas.length ? convertidas.length / pruebas.length : null,
    conversionAntes: pruebasAntes.length ? convAntes.length / pruebasAntes.length : null,
    cancelacion: pagabanMes ? movMes.cuentasCancelan / pagabanMes : null,
    cancelacionAntes: pagabanAnt ? movAnt.cuentasCancelan / pagabanAnt : null,
    planes, anuales: anuales.length, anualTop: anualTop?.n ? anualTop.plan : null,
  }
}

/** Finanzas de un mes (AAAA-MM): ingresos, neto, fallidos, ingreso por plan de 12 meses y el movimiento del MRR. */
export async function finanzasPanel(mes?: string) {
  const datos = await cargar()
  const ahora = Date.now()
  let ini = inicioMes(ahora)
  if (mes && /^\d{4}-\d{2}$/.test(mes)) { const [y, m] = mes.split('-').map(Number); ini = Date.UTC(y, m - 1, 1) + BOGOTA }
  const fin = Math.min(inicioMes(ini + 2 * DIA, 1), ahora)
  const iniAnt = inicioMes(ini + 2 * DIA, -1)

  const delMes = (a: number, b: number) => {
    const ps = datos.pagos.filter(p => p.fecha.getTime() >= a && p.fecha.getTime() < b)
    const pagados = ps.filter(p => p.estado === 'pagado' || p.estado === 'reembolsado')
    const bruto = pagados.reduce((s, p) => s + p.total, 0)
    const impuestos = pagados.reduce((s, p) => s + p.impuestos, 0)
    const reembolsos = ps.filter(p => p.estado === 'reembolsado').reduce((s, p) => s + p.reembolso, 0)
    const fallidos = ps.filter(p => p.estado === 'rechazado')
    return { bruto, impuestos, reembolsos, neto: bruto - impuestos - reembolsos, fallidos: fallidos.length, fallidosMonto: fallidos.reduce((s, p) => s + p.total, 0) }
  }
  const este = delMes(ini, fin), antes = delMes(iniAnt, ini)
  const fotoFin = foto(datos, fin - 1), fotoAnt = foto(datos, ini - 1)
  const arpa = fotoFin.porCuenta.size ? Math.round(fotoFin.mrr / fotoFin.porCuenta.size) : 0
  const arpaAntes = fotoAnt.porCuenta.size ? Math.round(fotoAnt.mrr / fotoAnt.porCuenta.size) : 0

  // MRR por plan al cierre de cada uno de los 12 meses que terminan en el mes elegido.
  const porPlan: { mes: string; planes: Record<string, number> }[] = []
  for (let i = 11; i >= 0; i--) {
    const corte = Math.min(inicioMes(ini + 2 * DIA, -i + 1), ahora) - 1
    const f = foto(datos, corte), planes: Record<string, number> = { starter: 0, growth: 0, business: 0 }
    for (const a of f.porCuenta.values()) planes[a.plan] = (planes[a.plan] ?? 0) + a.mrr
    porPlan.push({ mes: claveMes(corte), planes })
  }

  const mov = movimiento(datos, ini - 1, fin - 1)
  const cancelMes = fotoAnt.porCuenta.size ? mov.cuentasCancelan / fotoAnt.porCuenta.size : 0
  const mrrPorPlan = PLANES.map(plan => ({ plan, mrr: [...fotoFin.porCuenta.values()].filter(a => a.plan === plan).reduce((s, a) => s + a.mrr, 0) }))

  return {
    mes: claveMes(ini), este, antes, arpa, arpaAntes, porPlan, movimiento: mov, mrr: fotoFin.mrr, mrrPorPlan,
    // Valor de vida: ingreso promedio por empresa dividido entre la cancelación del mes. Sin cancelaciones no se calcula.
    ltv: cancelMes > 0 ? Math.round(arpa / cancelMes) : null,
    mesesPromedio: cancelMes > 0 ? 1 / cancelMes : null,
    anuales: [...fotoFin.porCuenta.values()].filter(a => a.periodo === 'anual').length, pagan: fotoFin.porCuenta.size,
    meses: Array.from({ length: 12 }, (_, i) => claveMes(inicioMes(ahora, -i))),
  }
}

/** Los cobros más recientes de todas las cuentas, con el nombre de la empresa. */
export async function cobrosRecientes(limite = 8) {
  const pagos = await prisma.crmPago.findMany({ orderBy: { fecha: 'desc' }, take: limite, select: { numero: true, plan: true, periodo: true, estado: true, total: true, moneda: true, fecha: true, espacio: { select: { id: true, nombre: true } } } })
  return pagos.map(p => ({ numero: p.numero, plan: p.plan, periodo: p.periodo, estado: p.estado, total: p.total, moneda: p.moneda, fecha: p.fecha, empresa: p.espacio.nombre, empresaId: p.espacio.id }))
}

/** Lo que necesita atención: pruebas por vencer, cobros fallidos, cancelaciones al final del periodo y líneas caídas. */
export async function atencion() {
  const ahora = Date.now()
  const [cuentas, caidas] = await Promise.all([
    prisma.crmEspacio.findMany({ where: { cuentaId: null, OR: [
      { estadoPlan: 'prueba', pruebaHasta: { gte: new Date(ahora), lte: new Date(ahora + 3 * DIA) } },
      { estadoPlan: 'pago-pendiente' }, { cancelaAlFinal: true, estadoPlan: { in: ['activo', 'cancelado'] } },
    ] }, select: { id: true, nombre: true, logo: true, estadoPlan: true, pruebaHasta: true, renuevaEl: true, cancelaAlFinal: true } }),
    prisma.crmLinea.findMany({ where: { estado: { not: 'conectada' } }, select: { nombre: true, updatedAt: true, espacio: { select: { id: true, nombre: true, logo: true, cuentaId: true } } }, take: 20 }),
  ])
  const filas: { empresaId: string; empresa: string; logo: string | null; que: string; detalle: string; nivel: 'urgente' | 'revisar'; en: number }[] = []
  for (const c of cuentas) {
    if (c.estadoPlan === 'pago-pendiente') filas.push({ empresaId: c.id, empresa: c.nombre, logo: c.logo, que: 'Cobro rechazado', detalle: 'Creem reintenta el cobro', nivel: 'urgente', en: 0 })
    else if (c.estadoPlan === 'prueba' && c.pruebaHasta) filas.push({ empresaId: c.id, empresa: c.nombre, logo: c.logo, que: 'Prueba por vencer', detalle: c.pruebaHasta.toISOString(), nivel: 'revisar', en: 1 })
    else if (c.cancelaAlFinal) filas.push({ empresaId: c.id, empresa: c.nombre, logo: c.logo, que: 'Cancela al final del periodo', detalle: c.renuevaEl?.toISOString() ?? '', nivel: 'revisar', en: 2 })
  }
  for (const l of caidas) filas.push({ empresaId: l.espacio.cuentaId ?? l.espacio.id, empresa: l.espacio.nombre, logo: l.espacio.logo, que: `Línea ${l.nombre} sin conexión`, detalle: l.updatedAt.toISOString(), nivel: 'urgente', en: 0 })
  return filas.sort((a, b) => a.en - b.en).slice(0, 8)
}
