import type { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { COOKIE_SESION, secreto, usuarioDeToken } from '../../middleware/auth'
import { BASE } from '../../utils/base'

/**
 * Acceso al panel de superadministrador (maqueta B «pantalla dividida» aprobada el 31-oct): el panel no abre con un
 * enlace. Solo se entra desde la pantalla que sale al iniciar sesión con una cuenta de operador, y elegir «Panel» deja
 * un pase de 12 horas (cookie httpOnly). Sin pase, /admin lleva al inicio de sesión y el API del panel responde 404.
 */
export const COOKIE_PANEL = 'wali_panel'
const HORAS_PANEL = 12
/** Cuánto vale una sesión para elegir el panel: solo justo después de iniciarla. */
const MINUTOS_FRESCA = 15

export const esOperador = (u: { operador: boolean; role: string } | null | undefined) => !!u && u.operador && u.role === 'ADMIN'

const cookiePanel = () => ({ httpOnly: true, sameSite: 'strict' as const, secure: process.env.NODE_ENV === 'production', path: BASE || '/', maxAge: HORAS_PANEL * 3_600_000 })

/** La persona de la sesión si la abrió hace menos de 15 minutos y es operadora; si no, null. */
export async function operadorRecien(req: Request) {
  const cookie = (req.cookies as Record<string, string> | undefined)?.[COOKIE_SESION]
  if (!cookie) return null
  try {
    const p = jwt.verify(cookie, secreto()) as { iat?: number }
    if (!p.iat || Date.now() / 1000 - p.iat > MINUTOS_FRESCA * 60) return null
    const u = await usuarioDeToken(cookie)
    return esOperador(u) ? u : null
  } catch { return null }
}

export function darPase(res: Response, userId: string) {
  res.cookie(COOKIE_PANEL, jwt.sign({ sub: userId, tipo: 'panel' }, secreto(), { expiresIn: `${HORAS_PANEL}h` }), cookiePanel())
}
export function quitarPase(res: Response) { res.clearCookie(COOKIE_PANEL, { path: BASE || '/' }) }

/** Si el pase del panel vale para esa persona. */
export function paseValido(req: Request, userId: string | undefined): boolean {
  const c = (req.cookies as Record<string, string> | undefined)?.[COOKIE_PANEL]
  if (!c || !userId) return false
  try { const p = jwt.verify(c, secreto()) as { sub?: string; tipo?: string }; return p.tipo === 'panel' && p.sub === userId } catch { return false }
}
