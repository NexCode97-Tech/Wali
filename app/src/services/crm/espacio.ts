import { AsyncLocalStorage } from 'node:async_hooks'
import type { Request, Response, NextFunction } from 'express'
import { prisma as base } from '../../config/prisma'
import { ForbiddenError } from '../../utils/errors'

/**
 * Espacio de trabajo del CRM: cada empresa que usa el CRM
 * es un espacio y nada se ve de uno a otro. Quien atiende una petición, un aviso
 * de un canal o un proceso programado corre dentro de un espacio, y `bd.ts`
 * filtra por él cada consulta a las tablas `crm_*`. Sin espacio, la consulta
 * falla: es preferible un error a mezclar datos de dos empresas.
 */
/** El espacio al que llegan los avisos públicos que no dicen de cuál son (el chat web sin `e`). Se fija con CRM_ESPACIO. */
export const ESPACIO_POR_DEFECTO = process.env.CRM_ESPACIO || 'principal'

const contexto = new AsyncLocalStorage<{ espacioId: string }>()

/** Corre `fn` dentro del espacio: todo lo que haga (esperas incluidas) consulta solo ese espacio. */
export function enEspacio<T>(espacioId: string, fn: () => T): T {
  return contexto.run({ espacioId }, fn)
}

/** El espacio en que se está corriendo, o un error si nadie lo fijó. */
export function espacioActual(): string {
  const e = contexto.getStore()?.espacioId
  if (!e) throw new Error('CRM: consulta sin espacio de trabajo')
  return e
}

export const espacioOpcional = (): string | null => contexto.getStore()?.espacioId ?? null

/**
 * El espacio de una persona: el que eligió en el selector (`espacioActivo`) si todavía entra a él; si no, el primero al
 * que entró (su fila más vieja en `crm_miembros`). null si no entra a ninguno.
 */
export async function espacioDeUsuario(userId: string, _rol?: string | null): Promise<string | null> {
  const [u, ms] = await Promise.all([
    base.user.findUnique({ where: { id: userId }, select: { espacioActivo: true } }),
    base.crmMiembro.findMany({ where: { userId }, orderBy: { createdAt: 'asc' }, select: { espacioId: true } }),
  ])
  if (u?.espacioActivo && ms.some(m => m.espacioId === u.espacioActivo)) return u.espacioActivo
  return ms[0]?.espacioId ?? null
}

/** La cuenta (el espacio que tiene el plan) de un espacio de trabajo: él mismo si no depende de otro. */
export async function cuentaDe(espacioId: string): Promise<string> {
  const e = await base.crmEspacio.findUnique({ where: { id: espacioId }, select: { cuentaId: true } })
  return e?.cuentaId || espacioId
}

/** Todos los espacios de una cuenta (la cuenta primero). */
export async function espaciosDeCuenta(cuentaId: string): Promise<string[]> {
  const l = await base.crmEspacio.findMany({ where: { OR: [{ id: cuentaId }, { cuentaId }] }, orderBy: { createdAt: 'asc' }, select: { id: true } })
  return l.map(e => e.id).sort((a, b) => (a === cuentaId ? -1 : b === cuentaId ? 1 : 0))
}

/** Las personas de toda la cuenta, sin repetir (el límite de usuarios del plan se suma entre sus espacios). */
export async function usuariosDeCuenta(cuentaId: string): Promise<string[]> {
  const ids = await espaciosDeCuenta(cuentaId)
  return [...new Set((await base.crmMiembro.findMany({ where: { espacioId: { in: ids } }, select: { userId: true } })).map(m => m.userId))]
}

/** Quiénes entran a un espacio (para el tiempo real y las listas de usuarios). */
export async function usuariosDeEspacio(espacioId: string): Promise<string[]> {
  return (await base.crmMiembro.findMany({ where: { espacioId }, select: { userId: true } })).map(m => m.userId)
}

/** Los espacios con algo que procesar, para los procesos programados. */
export async function espacios(): Promise<string[]> {
  return (await base.crmEspacio.findMany({ select: { id: true }, orderBy: { createdAt: 'asc' } })).map(e => e.id)
}

/** Middleware de las rutas del CRM: la petición corre dentro del espacio de quien la hace. */
export function conEspacio(req: Request, _res: Response, next: NextFunction) {
  if (!req.userId) return next(new ForbiddenError('Inicia sesión para entrar al CRM'))
  espacioDeUsuario(req.userId, req.userRole).then(e => {
    if (!e) return next(new ForbiddenError('Tu usuario no pertenece a ningún espacio del CRM'))
    req.espacioId = e
    enEspacio(e, () => next())
  }, next)
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Espacio de trabajo del CRM en que corre la petición (solo en las rutas del CRM). */
      espacioId?: string
    }
  }
}
