import type { Prisma, Role } from '@prisma/client'
import type { Request, Response, NextFunction } from 'express'
import { prisma as base } from '../../config/prisma'
import { prisma } from './bd'
import { espacioActual } from './espacio'
import { ForbiddenError } from '../../utils/errors'
import { configura } from '../../utils/roles'
import { equipoDeConv, genteDe, leerEquipos, type EquiposNorm } from './equipos'

export { equipoDeConv }

/**
 * Quién ve qué en el CRM. El rol de la plataforma ya no da alcance en el CRM, salvo
 * el del administrador que no está en ningún equipo:
 *
 * - Administrador sin equipo (el visitante cuenta como administrador): ve y administra todo el CRM.
 * - Líder de un equipo (ajuste `equipos`, `lideres`): ve todas las conversaciones de su equipo (asignadas, sin
 *   asignar, las de su gente y las «solo líder») y nada de otros equipos, salvo lo que tenga asignado.
 * - Integrante de un equipo: solo las conversaciones que tiene asignadas. Lo sin asignar solo lo ven los líderes
 *   de ese equipo y los administradores sin equipo.
 * - Un administrador que está en un equipo queda limitado a ese equipo según su rol en él.
 * - Quien no está en ningún equipo y no es administrador: solo lo que tenga asignado.
 *
 * Una conversación sin equipo es de Ventas (igual que en la pantalla). La entrada al CRM (`accesoCrm`) no cambia:
 * Ventas entra por su rol y cualquier otra persona si un líder la agrega a un equipo.
 */

/** Nadie entra por su rol: al CRM entra quien es miembro de un espacio (`crm_miembros`). */
export const entraPorRol = (_rol?: string | null) => false

export interface Alcance {
  userId: string
  /** Rol ADMIN (el visitante cuenta como ADMIN) y en ningún equipo: ve y administra todo el CRM. */
  todo: boolean
  /** Equipos que lidera, en el orden del ajuste. */
  lidera: string[]
  /** Equipos donde está sin ser líder. */
  integra: string[]
  /** lidera ∪ integra, en el orden del ajuste. */
  equipos: string[]
  /** Rol ADMIN o LIDER_VENTAS de la plataforma: la configuración general del CRM, como siempre. */
  config: boolean
}

const rolEfectivo = (rol?: string | null) => (rol === 'LECTOR' ? 'ADMIN' : String(rol ?? ''))

/** El alcance de una persona con su rol de plataforma y los equipos ya normalizados. */
export function alcanceDePersona(userId: string, rolPlataforma: string | null | undefined, eqs: EquiposNorm): Alcance {
  const orden = Object.keys(eqs.miembros)
  const lidera = orden.filter(eq => (eqs.lideres[eq] ?? []).includes(userId))
  const integra = orden.filter(eq => !lidera.includes(eq) && (eqs.ids[eq] ?? []).includes(userId))
  const equipos = orden.filter(eq => lidera.includes(eq) || integra.includes(eq))
  const rol = rolEfectivo(rolPlataforma)
  return { userId, todo: rol === 'ADMIN' && equipos.length === 0, lidera, integra, equipos, config: configura(rol) }
}

/** El alcance de quien hace la petición (se calcula una vez por petición). */
export async function alcanceDe(req: Request): Promise<Alcance> {
  if (req.alcanceCrm && req.equiposCrm && req.alcanceCrm.userId === req.userId) return req.alcanceCrm
  const eqs = await leerEquipos()
  const a = alcanceDePersona(req.userId!, req.userRole, eqs)
  req.alcanceCrm = a
  req.equiposCrm = eqs
  return a
}

/** Los equipos normalizados con que se calculó el alcance de esta petición. */
export async function equiposDeReq(req: Request): Promise<EquiposNorm> {
  if (!req.equiposCrm || req.alcanceCrm?.userId !== req.userId) await alcanceDe(req)
  return req.equiposCrm!
}

/** Lo que la pantalla recibe (GET /crm/inicio y el evento `alcance`). `administra`: los equipos que puede cambiar. */
export function alcanceParaFront(a: Alcance, eqs: EquiposNorm) {
  return { todo: a.todo, lidera: a.lidera, integra: a.integra, equipos: a.equipos, administra: a.todo ? Object.keys(eqs.miembros) : a.lidera, config: a.config }
}

/** ¿Lidera el equipo de la conversación (o lo ve todo)? Marcar «solo líder», cancelar programados de otros. */
export const lideraConv = (a: Alcance, c: { equipo: string | null }) => a.todo || a.lidera.includes(equipoDeConv(c))

/** ¿Puede cambiar este equipo (personas, roles, subequipos, reparto)? */
export const puedeAdministrar = (a: Alcance, equipo: string) => a.todo || a.lidera.includes(equipo)

/** Las personas de los equipos que lidera. */
export const genteQueLidera = (a: Alcance, eqs: EquiposNorm) => genteDe(eqs, a.lidera)

type ConvAlcance = { equipo: string | null; asignadoId: string | null; soloLider?: boolean }

export function veConv(a: Alcance, c: ConvAlcance): boolean {
  if (a.todo) return true
  if (a.lidera.includes(equipoDeConv(c))) return true
  return c.asignadoId === a.userId && !c.soloLider
}

/** Las conversaciones que ve, como filtro de Prisma ({} si ve todo). */
export function filtroConvs(a: Alcance): Prisma.CrmConversacionWhereInput {
  if (a.todo) return {}
  const o: Prisma.CrmConversacionWhereInput[] = [{ asignadoId: a.userId, soloLider: false }]
  if (a.lidera.length) o.push({ equipo: { in: a.lidera } })
  if (a.lidera.includes('Ventas')) o.push({ equipo: null })
  return { OR: o }
}

/**
 * Conversaciones de un equipo que NO lidera. Ojo con `equipo` NULL (= Ventas): en SQL `NULL NOT IN (…)` no es
 * verdadero, así que si no lidera Ventas se pregunta aparte por las que no tienen equipo.
 */
export function fueraDeLidera(a: Alcance): Prisma.CrmConversacionWhereInput {
  if (!a.lidera.length) return {}
  if (a.lidera.includes('Ventas')) return { equipo: { notIn: a.lidera } }
  return { OR: [{ equipo: null }, { equipo: { notIn: a.lidera } }] }
}

/** Una conversación «solo líder» de un equipo que no lidera. */
export const reservadaPara = (a: Alcance, c: { equipo: string | null; soloLider?: boolean }) => Boolean(c.soloLider) && !lideraConv(a, c)

/** El equipo de la primera conversación «solo líder» del contacto que esta persona no lidera, o null. */
export async function reservaDeContacto(a: Alcance, contactoId: number): Promise<string | null> {
  if (a.todo) return null
  const c = await prisma.crmConversacion.findFirst({ where: { contactoId, soloLider: true, ...fueraDeLidera(a) }, select: { equipo: true } })
  return c ? equipoDeConv(c) : null
}

/** ¿El contacto tiene una conversación reservada para los líderes de un equipo que no lidera? */
export async function contactoReservadoPara(a: Alcance, contactoId: number): Promise<boolean> {
  return (await reservaDeContacto(a, contactoId)) !== null
}

/**
 * ¿Ve este contacto? (en memoria, con su dueño y todas sus conversaciones). No, si tiene una conversación «solo
 * líder» de un equipo que no lidera. Sí, si es su dueño, si ve alguna de sus conversaciones (de cualquier estado o
 * fecha) o si el dueño es gente de un equipo que lidera y el contacto no tiene conversaciones de otros equipos (30-sep:
 * alguien que también está en otro equipo, o que el líder mete en el suyo, no le abre los contactos de allá).
 */
export function veContactoEn(a: Alcance, k: { asignadoId: string | null }, convs: ConvAlcance[], gente: string[]): boolean {
  if (a.todo) return true
  if (convs.some(c => reservadaPara(a, { equipo: c.equipo, soloLider: c.soloLider }))) return false
  if (k.asignadoId === a.userId) return true
  if (convs.some(c => veConv(a, c))) return true
  return !!k.asignadoId && gente.includes(k.asignadoId) && convs.every(c => a.lidera.includes(equipoDeConv(c)))
}

/** Lo mismo leyendo el contacto. `gente`: las personas de los equipos que lidera (si no viene, se calcula). */
export async function veContacto(a: Alcance, contactoId: number, gente?: string[]): Promise<boolean> {
  if (a.todo) return true
  const k = await prisma.crmContacto.findUnique({ where: { id: contactoId }, select: { asignadoId: true, conversaciones: { select: { equipo: true, asignadoId: true, soloLider: true } } } })
  if (!k) return false
  return veContactoEn(a, k, k.conversaciones, gente ?? (a.lidera.length ? genteQueLidera(a, await leerEquipos()) : []))
}

/** Los contactos que ve, como filtro de Prisma ({} si ve todo). */
export function filtroContactos(a: Alcance, gente: string[]): Prisma.CrmContactoWhereInput {
  if (a.todo) return {}
  const ve: Prisma.CrmContactoWhereInput[] = [{ asignadoId: a.userId }, { conversaciones: { some: filtroConvs(a) } }]
  // La gente de sus equipos: sus contactos sin conversaciones de otros equipos (veContactoEn).
  if (gente.length && a.lidera.length) ve.push({ asignadoId: { in: gente }, conversaciones: { none: fueraDeLidera(a) } })
  return { AND: [{ conversaciones: { none: { soloLider: true, ...fueraDeLidera(a) } } }, { OR: ve }] }
}

/**
 * Puerta de las rutas del CRM: su rol es de Ventas o es miembro de algún espacio (lo agregaron a un equipo).
 * Reemplaza a `requireRole(...VENTAS)`; el espacio lo resuelve después `conEspacio`.
 */
export function accesoCrm(req: Request, _res: Response, next: NextFunction) {
  if (!req.userId) return next(new ForbiddenError('Inicia sesión para entrar al CRM'))
  if (entraPorRol(req.userRole)) return next()
  base.crmMiembro.count({ where: { userId: req.userId } })
    .then(n => (n ? next() : next(new ForbiddenError('No tienes acceso al CRM. Pídele a un líder que te agregue a un equipo.'))), next)
}

/**
 * Deja `crm_miembros` al día con los equipos guardados: quien está en algún equipo queda como miembro del
 * espacio. Los miembros son la base del espacio y no se quitan aquí: una cuenta se suspende, no se saca.
 */
export async function sincronizarMiembros(ids: Record<string, string[]>): Promise<{ agregados: string[]; quitados: string[] }> {
  const espacio = espacioActual()
  const enEquipos = [...new Set(Object.values(ids).flat().map(String))]
  const usuarios = enEquipos.length ? await base.user.findMany({ where: { id: { in: enEquipos }, suspendido: false }, select: { id: true, role: true } }) : []
  const porEquipo = usuarios.filter(u => !entraPorRol(u.role as Role)).map(u => u.id)
  const actuales = await base.crmMiembro.findMany({ where: { espacioId: espacio }, select: { userId: true } })
  const yaEstan = new Set(actuales.map(m => m.userId))
  const agregados = porEquipo.filter(id => !yaEstan.has(id))
  if (agregados.length) await base.crmMiembro.createMany({ data: agregados.map(userId => ({ espacioId: espacio, userId })), skipDuplicates: true })
  // Los miembros son la base del espacio: salir de un equipo no saca a nadie del CRM (eso es suspender la cuenta).
  const quitados: string[] = []
  return { agregados, quitados }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Alcance en el CRM de quien hace la petición (alcanceDe lo calcula una vez). */
      alcanceCrm?: Alcance
      /** Los equipos normalizados con que se calculó `alcanceCrm`. */
      equiposCrm?: EquiposNorm
    }
  }
}
