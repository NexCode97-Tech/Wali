import { prisma } from './bd'
import { AppError } from '../../utils/errors'
import { descifrar } from './cifrado'

/**
 * Con qué se habla con Meta en cada caso (26-sep-2026): el token de la conexión
 * de WhatsApp que el propio espacio hizo desde el CRM (conexiones.ts). Nada sale
 * de variables del servidor. El token solo vive aquí, descifrado en memoria el
 * rato que dura la llamada.
 */
export interface CredMeta { token: string }

const SIN_CONEXION = 'Esta línea no tiene conexión con Meta: vuelve a conectarla en Ajustes del CRM, Canales, WhatsApp'

export async function credDeConexion(conexionId: string | null | undefined): Promise<CredMeta> {
  if (!conexionId) throw new AppError(SIN_CONEXION, 409)
  const c = await prisma.crmConexion.findUnique({ where: { id: conexionId }, select: { secretos: true, estado: true } })
  if (!c) throw new AppError(SIN_CONEXION, 409)
  if (c.estado === 'desconectada') throw new AppError('La conexión de WhatsApp de esta línea está desconectada: vuelve a conectarla en Ajustes del CRM, Canales', 409)
  const s = descifrar<{ token?: string }>(c.secretos)
  if (!s.token) throw new AppError(SIN_CONEXION, 409)
  return { token: s.token }
}

export async function credDeLinea(linea: { conexionId: string | null } | null | undefined): Promise<CredMeta> {
  return credDeConexion(linea?.conexionId)
}

/** La credencial de una cuenta de WhatsApp (WABA): la de la conexión de alguna de sus líneas o la que la trajo. */
export async function credDeWaba(waba: string): Promise<CredMeta> {
  const l = await prisma.crmLinea.findFirst({ where: { wabaId: waba, conexionId: { not: null } }, select: { conexionId: true } })
  if (l) return credDeConexion(l.conexionId)
  const c = await prisma.crmConexion.findFirst({ where: { tipo: 'whatsapp', datos: { path: ['wabas'], array_contains: [waba] } }, select: { id: true } })
  return credDeConexion(c?.id)
}

/** ¿El espacio tiene alguna conexión de WhatsApp activa? */
export async function hayWhatsapp(): Promise<boolean> {
  return (await prisma.crmConexion.count({ where: { tipo: 'whatsapp', estado: { in: ['conectada', 'pendiente'] } } })) > 0
}
