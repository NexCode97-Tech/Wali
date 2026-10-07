import { prisma as base } from '../../config/prisma'
import { cuentaDe, espaciosDeCuenta } from './espacio'
import { estadoPlan } from './plan'
import { invitar } from './invitaciones'
import { ajustesIniciales } from './inicial'
import { cifrarClave } from '../../routes/auth'
import { idDeEspacio } from '../../routes/acceso'
import { logger } from '../../utils/logger'
import { ForbiddenError, ValidationError } from '../../utils/errors'
import crypto from 'node:crypto'

/**
 * Espacios de trabajo (6-oct): una cuenta con plan maneja varias empresas, cada una con su CRM aparte (líneas,
 * equipos, conversaciones, agentes y motor de IA propios). El plan es de la cuenta: Starter 1 espacio, Growth 3 y
 * Business 6; usuarios y agentes se suman entre todos. Cada persona trabaja en un espacio a la vez y cambia con el
 * selector de la barra (`usuarios.espacio_activo`).
 */

export interface EspacioFront {
  id: string; n: string; actual: boolean; principal: boolean
  estado: string; plan: string; dias: number | null
  personas: number; lineas: number; chats: number; desde: string
  /** Su administrador (el primero que entró con rol de administrador). */
  admin: string | null; correo: string | null
}

/** Los espacios de la cuenta del espacio actual a los que entra esta persona, con lo que usa cada uno. */
export async function listarEspacios(userId: string, actual: string): Promise<{ espacios: EspacioFront[]; limite: number | null; puedeCrear: boolean }> {
  const cuenta = await cuentaDe(actual)
  const [todos, mios, plan, yo] = await Promise.all([
    espaciosDeCuenta(cuenta),
    base.crmMiembro.findMany({ where: { userId }, select: { espacioId: true } }),
    estadoPlan(cuenta),
    base.user.findUnique({ where: { id: userId }, select: { role: true } }),
  ])
  const ids = todos.filter(id => mios.some(m => m.espacioId === id))
  const [filas, personas, lineas, chats] = await Promise.all([
    base.crmEspacio.findMany({ where: { id: { in: ids } }, select: { id: true, nombre: true, createdAt: true } }),
    base.crmMiembro.groupBy({ by: ['espacioId'], where: { espacioId: { in: ids } }, _count: true }),
    base.crmLinea.groupBy({ by: ['espacioId'], where: { espacioId: { in: ids } }, _count: true }),
    base.crmConversacion.groupBy({ by: ['espacioId'], where: { espacioId: { in: ids }, estado: 'abiertas' }, _count: true }),
  ])
  const n = (l: { espacioId: string; _count: number }[], id: string) => l.find(x => x.espacioId === id)?._count ?? 0
  const miembros = await base.crmMiembro.findMany({ where: { espacioId: { in: ids } }, orderBy: { createdAt: 'asc' }, select: { espacioId: true, userId: true } })
  const gente = await base.user.findMany({ where: { id: { in: [...new Set(miembros.map(m => m.userId))] }, role: 'ADMIN', suspendido: false }, select: { id: true, nombre: true, email: true } })
  const adminDe = (id: string) => { const m = miembros.find(x => x.espacioId === id && gente.some(g => g.id === x.userId)); return m ? gente.find(g => g.id === m.userId)! : null }
  const espacios = ids.map(id => {
    const f = filas.find(x => x.id === id)!
    return {
      id, n: f.nombre, actual: id === actual, principal: id === cuenta,
      estado: plan.estado, plan: plan.plan, dias: plan.estado === 'prueba' ? plan.diasPrueba : null,
      personas: n(personas, id), lineas: n(lineas, id), chats: n(chats, id), desde: f.createdAt.toISOString(),
      admin: adminDe(id)?.nombre ?? null, correo: adminDe(id)?.email ?? null,
    }
  })
  return { espacios, limite: plan.limites.espacios, puedeCrear: yo?.role === 'ADMIN' && mios.some(m => m.espacioId === cuenta) }
}

/** Cambia el espacio en que trabaja la persona (debe entrar a él). */
export async function entrarAEspacio(userId: string, espacioId: string): Promise<void> {
  const m = await base.crmMiembro.findUnique({ where: { espacioId_userId: { espacioId, userId } }, select: { userId: true } })
  if (!m) throw new ForbiddenError('No tienes acceso a ese espacio de trabajo.')
  await base.user.update({ where: { id: userId }, data: { espacioActivo: espacioId } })
}

/**
 * Crea un espacio de trabajo en la cuenta del espacio actual: vacío (sin etapas, etiquetas ni reglas de ejemplo), con
 * quien lo crea como miembro si así lo pide y, si se da, su administrador invitado por correo.
 */
export async function crearEspacio(userId: string, actual: string, d: { nombre: string; adminNombre?: string; adminCorreo?: string; yo: boolean }): Promise<string> {
  const cuenta = await cuentaDe(actual)
  const [yo, plan, ya] = await Promise.all([
    base.user.findUnique({ where: { id: userId }, select: { role: true, nombre: true, email: true } }),
    estadoPlan(cuenta),
    espaciosDeCuenta(cuenta),
  ])
  const miembroCuenta = await base.crmMiembro.findUnique({ where: { espacioId_userId: { espacioId: cuenta, userId } } })
  if (yo?.role !== 'ADMIN' || !miembroCuenta) throw new ForbiddenError('Solo el administrador de la cuenta crea espacios de trabajo.')
  const limite = plan.limites.espacios
  if (limite !== null && ya.length >= limite) throw new ForbiddenError(`Tu plan incluye ${limite} ${limite === 1 ? 'espacio' : 'espacios'} de trabajo. Sube de plan en Ajustes, Plan y pagos, para crear más.`)
  const nombre = d.nombre.trim()
  if (nombre.length < 2 || nombre.length > 80) throw new ValidationError('Escribe el nombre de la empresa.')
  const correo = (d.adminCorreo ?? '').trim().toLowerCase()
  if (correo && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(correo)) throw new ValidationError('El correo del administrador no parece completo.')
  if (!correo && !d.yo) throw new ValidationError('Invita a su administrador o quédate tú como administrador del espacio.')
  const id = await idDeEspacio(nombre)
  let invitado: string | null = null
  await base.$transaction(async tx => {
    await tx.crmEspacio.create({ data: { id, nombre, cuentaId: cuenta, plan: plan.plan, estadoPlan: plan.estado === 'interno' ? 'interno' : 'activo' } })
    // Empieza desde cero, como una empresa nueva.
    await tx.crmAjuste.createMany({ data: ajustesIniciales(id), skipDuplicates: true })
    if (d.yo) await tx.crmMiembro.create({ data: { espacioId: id, userId } })
    if (correo) {
      const existe = await tx.user.findFirst({ where: { email: { equals: correo, mode: 'insensitive' } }, select: { id: true } })
      const u = existe ?? await tx.user.create({ data: { email: correo, nombre: (d.adminNombre ?? '').trim() || null, role: 'ADMIN', passwordHash: await cifrarClave(crypto.randomBytes(32).toString('base64url')) }, select: { id: true } })
      if (u.id !== userId) { await tx.crmMiembro.create({ data: { espacioId: id, userId: u.id } }); invitado = u.id }
    }
  })
  if (invitado) void invitar(invitado, [], nombre, (yo.nombre || yo.email).trim()).catch(e => logger.error({ evento: 'INVITACION_FALLO', userId: invitado, err: (e as Error).message }))
  logger.info({ evento: 'ESPACIO_CREADO', cuenta, espacio: id, por: userId })
  return id
}

/** Solo el administrador de la cuenta cambia o borra espacios, y solo los de su cuenta. */
async function exigirAdminCuenta(userId: string, actual: string, espacioId: string): Promise<string> {
  const cuenta = await cuentaDe(actual)
  const [yo, miembro, todos] = await Promise.all([
    base.user.findUnique({ where: { id: userId }, select: { role: true } }),
    base.crmMiembro.findUnique({ where: { espacioId_userId: { espacioId: cuenta, userId } } }),
    espaciosDeCuenta(cuenta),
  ])
  if (yo?.role !== 'ADMIN' || !miembro) throw new ForbiddenError('Solo el administrador de la cuenta cambia los espacios de trabajo.')
  if (!todos.includes(espacioId)) throw new ForbiddenError('Ese espacio de trabajo no es de tu cuenta.')
  return cuenta
}

/** Cambia el nombre de un espacio de trabajo (7-oct). */
export async function renombrarEspacio(userId: string, actual: string, espacioId: string, nombre: string): Promise<void> {
  await exigirAdminCuenta(userId, actual, espacioId)
  const n = nombre.trim().replace(/\s+/g, ' ')
  if (n.length < 2 || n.length > 80) throw new ValidationError('Escribe el nombre de la empresa (de 2 a 80 caracteres).')
  await base.crmEspacio.update({ where: { id: espacioId }, data: { nombre: n } })
  logger.info({ evento: 'ESPACIO_RENOMBRADO', espacio: espacioId, por: userId })
}

/**
 * Elimina un espacio de trabajo y todo lo suyo (líneas, conversaciones, contactos, ajustes: en cascada) (7-oct). El
 * principal no (tiene el plan de la cuenta) ni el espacio en que se está trabajando. Quien lo tenía abierto vuelve al
 * principal. La confirmación es escribir su nombre exacto.
 */
export async function eliminarEspacio(userId: string, actual: string, espacioId: string, confirmacion: string): Promise<void> {
  const cuenta = await exigirAdminCuenta(userId, actual, espacioId)
  if (espacioId === cuenta) throw new ForbiddenError('El espacio principal tiene el plan de la cuenta: no se puede eliminar.')
  if (espacioId === actual) throw new ForbiddenError('Estás trabajando en ese espacio. Entra a otro y elimínalo desde allá.')
  const e = await base.crmEspacio.findUnique({ where: { id: espacioId }, select: { nombre: true } })
  if (!e) throw new ValidationError('Ese espacio de trabajo ya no existe.')
  if (confirmacion.trim() !== e.nombre.trim()) throw new ValidationError('Escribe el nombre exacto del espacio para confirmar.')
  await base.$transaction([
    base.user.updateMany({ where: { espacioActivo: espacioId }, data: { espacioActivo: cuenta } }),
    base.crmEspacio.delete({ where: { id: espacioId } }),
  ])
  logger.info({ evento: 'ESPACIO_ELIMINADO', cuenta, espacio: espacioId, nombre: e.nombre, por: userId })
}
