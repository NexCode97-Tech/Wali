import { prisma } from '../../config/prisma'

/**
 * Panel de superadministrador (maqueta B aprobada el 31-oct): las empresas de Wali vistas por el operador de la
 * plataforma. Solo datos de uso (plan, miembros, líneas, conteos y cobros): nunca contactos ni mensajes (Ley 1581).
 *
 * Una empresa es una cuenta: el espacio que tiene el plan (cuentaId null) más los espacios que comparten su plan.
 * Las cifras de la lista suman todos los espacios de la cuenta.
 */

const DIA = 86_400_000

export interface EmpresaFila {
  id: string
  nombre: string
  logo: string | null
  plan: string
  periodo: string | null
  estado: string
  pruebaHasta: Date | null
  renuevaEl: Date | null
  cancelaAlFinal: boolean
  espacios: number
  usuarios: number
  lineas: number
  caidas: number
  conv30: number
  ultimoUso: Date | null
  alta: Date
  correo: string | null
}

const masReciente = (a: Date | null, b: Date | null) => (!a ? b : !b ? a : a > b ? a : b)

/** Todas las empresas con sus cifras. Unas pocas consultas agrupadas, sin importar cuántas empresas haya. */
export async function listaEmpresas(): Promise<EmpresaFila[]> {
  const desde = new Date(Date.now() - 30 * DIA)
  const [espacios, miembros, lineas, conv, uso] = await Promise.all([
    prisma.crmEspacio.findMany({ select: { id: true, nombre: true, logo: true, plan: true, periodo: true, estadoPlan: true, pruebaHasta: true, renuevaEl: true, cancelaAlFinal: true, cuentaId: true, createdAt: true } }),
    prisma.crmMiembro.findMany({ select: { espacioId: true, userId: true } }),
    prisma.crmLinea.groupBy({ by: ['espacioId', 'estado'], _count: { _all: true } }),
    prisma.crmConversacion.groupBy({ by: ['espacioId'], where: { ultimoMensajeAt: { gte: desde } }, _count: { _all: true } }),
    prisma.crmConversacion.groupBy({ by: ['espacioId'], _max: { ultimoMensajeAt: true } }),
  ])

  const usuarios = new Map((await prisma.user.findMany({ where: { id: { in: [...new Set(miembros.map(m => m.userId))] } }, select: { id: true, email: true, role: true, ultimoIngreso: true } })).map(u => [u.id, u]))
  const cuentaDe = new Map(espacios.map(e => [e.id, e.cuentaId ?? e.id]))
  const filas = new Map<string, EmpresaFila & { _usuarios: Set<string> }>()
  for (const e of espacios) {
    if (e.cuentaId) continue
    filas.set(e.id, {
      id: e.id, nombre: e.nombre, logo: e.logo, plan: e.plan, periodo: e.periodo, estado: e.estadoPlan,
      pruebaHasta: e.pruebaHasta, renuevaEl: e.renuevaEl, cancelaAlFinal: e.cancelaAlFinal,
      espacios: 0, usuarios: 0, lineas: 0, caidas: 0, conv30: 0, ultimoUso: null, alta: e.createdAt, correo: null, _usuarios: new Set(),
    })
  }
  const de = (espacioId: string) => filas.get(cuentaDe.get(espacioId) ?? espacioId)

  for (const e of espacios) { const f = de(e.id); if (f) f.espacios++ }
  for (const m of miembros) {
    const f = de(m.espacioId), u = usuarios.get(m.userId); if (!f || !u) continue
    f._usuarios.add(u.id)
    f.ultimoUso = masReciente(f.ultimoUso, u.ultimoIngreso)
    // El correo de contacto es el del primer administrador del espacio que paga.
    if (!f.correo && m.espacioId === f.id && u.role === 'ADMIN') f.correo = u.email
  }
  for (const l of lineas) {
    const f = de(l.espacioId); if (!f) continue
    f.lineas += l._count._all
    if (l.estado !== 'conectada') f.caidas += l._count._all
  }
  for (const c of conv) { const f = de(c.espacioId); if (f) f.conv30 += c._count._all }
  for (const u of uso) { const f = de(u.espacioId); if (f) f.ultimoUso = masReciente(f.ultimoUso, u._max.ultimoMensajeAt) }

  return [...filas.values()]
    .map(({ _usuarios, ...f }) => ({ ...f, usuarios: _usuarios.size }))
    .sort((a, b) => (b.ultimoUso?.getTime() ?? 0) - (a.ultimoUso?.getTime() ?? 0))
}

/** El detalle de una empresa: sus espacios, miembros, líneas y cobros. null si no existe o no es una cuenta. */
export async function detalleEmpresa(id: string) {
  const cuenta = await prisma.crmEspacio.findUnique({
    where: { id },
    select: { id: true, nombre: true, logo: true, plan: true, periodo: true, estadoPlan: true, pruebaHasta: true, renuevaEl: true, cancelaAlFinal: true, cuentaId: true, createdAt: true },
  })
  if (!cuenta || cuenta.cuentaId) return null
  const espacios = await prisma.crmEspacio.findMany({ where: { OR: [{ id }, { cuentaId: id }] }, select: { id: true, nombre: true, createdAt: true }, orderBy: { createdAt: 'asc' } })
  const ids = espacios.map(e => e.id)
  const desde = new Date(Date.now() - 30 * DIA)
  const [miembros, lineas, conv30, pagos] = await Promise.all([
    prisma.crmMiembro.findMany({ where: { espacioId: { in: ids } }, select: { espacioId: true, userId: true } }),
    prisma.crmLinea.findMany({ where: { espacioId: { in: ids } }, select: { id: true, espacioId: true, nombre: true, telefono: true, estado: true, calidad: true, limite: true }, orderBy: { createdAt: 'asc' } }),
    prisma.crmConversacion.count({ where: { espacioId: { in: ids }, ultimoMensajeAt: { gte: desde } } }),
    prisma.crmPago.findMany({ where: { espacioId: { in: ids } }, select: { numero: true, plan: true, periodo: true, estado: true, total: true, moneda: true, fecha: true }, orderBy: { fecha: 'desc' }, take: 24 }),
  ])

  // Una persona puede estar en varios espacios de la cuenta: va una vez, con los espacios donde está.
  const nombreEsp = new Map(espacios.map(e => [e.id, e.nombre]))
  const usuarios = new Map((await prisma.user.findMany({ where: { id: { in: [...new Set(miembros.map(m => m.userId))] } }, select: { id: true, nombre: true, email: true, role: true, suspendido: true, ultimoIngreso: true } })).map(u => [u.id, u]))
  const gente = new Map<string, { id: string; nombre: string; correo: string; rol: string; suspendido: boolean; ultimoIngreso: Date | null; espacios: string[] }>()
  for (const m of miembros) {
    const u = usuarios.get(m.userId); if (!u) continue
    const p = gente.get(u.id) ?? { id: u.id, nombre: u.nombre ?? u.email, correo: u.email, rol: u.role, suspendido: u.suspendido, ultimoIngreso: u.ultimoIngreso, espacios: [] }
    p.espacios.push(nombreEsp.get(m.espacioId) ?? '')
    gente.set(u.id, p)
  }

  return {
    id: cuenta.id, nombre: cuenta.nombre, logo: cuenta.logo, plan: cuenta.plan, periodo: cuenta.periodo, estado: cuenta.estadoPlan,
    pruebaHasta: cuenta.pruebaHasta, renuevaEl: cuenta.renuevaEl, cancelaAlFinal: cuenta.cancelaAlFinal, alta: cuenta.createdAt, conv30,
    espacios: espacios.map(e => ({ id: e.id, nombre: e.nombre, alta: e.createdAt })),
    miembros: [...gente.values()].sort((a, b) => (b.ultimoIngreso?.getTime() ?? 0) - (a.ultimoIngreso?.getTime() ?? 0)),
    lineas: lineas.map(l => ({ ...l, espacio: nombreEsp.get(l.espacioId) ?? '' })),
    pagos,
  }
}
