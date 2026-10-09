import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import type { Role } from '@prisma/client'
import { prisma } from '../config/prisma'
import { UnauthorizedError, ForbiddenError } from '../utils/errors'
import { logSecurityEvent } from '../utils/logger'
import { redactarUrl } from '../utils/redactar'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?:   string
      userRole?: Role
      /** Cuenta de solo lectura: se autoriza como ADMIN pero no puede cambiar nada. */
      soloLectura?: boolean
      userName?: string
      /** Operador de la plataforma: configura lo que es común a todos los espacios (las apps de Meta, Instagram y TikTok). */
      operador?: boolean
    }
  }
}

export interface JwtPayload {
  sub: string   // id del usuario
  email: string
  role: Role
}

/** La cookie de la sesión (httpOnly). El token del API se pide con ella en GET /api/auth/token. */
export const COOKIE_SESION = 'crm_sesion'

export function secreto(): string {
  const s = process.env.AUTH_SECRET
  if (!s || s.length < 32) throw new UnauthorizedError('Configuración de auth inválida: falta AUTH_SECRET (32 caracteres o más)')
  return s
}

export const firmar = (p: JwtPayload, expiresIn: jwt.SignOptions['expiresIn']) => jwt.sign(p, secreto(), { expiresIn })

/** El usuario del token, si el token vale y la cuenta sigue activa. */
export async function usuarioDeToken(token: string) {
  const payload = jwt.verify(token, secreto()) as JwtPayload & { iat?: number }
  const user = await prisma.user.findUnique({ where: { id: payload.sub } })
  if (!user) throw new ForbiddenError('USUARIO_NO_REGISTRADO')
  // Se valida aquí, y no solo al entrar, para que la suspensión aplique de inmediato aunque haya una sesión abierta.
  if (user.suspendido) throw new ForbiddenError('CUENTA_SUSPENDIDA')
  // Una sesión de antes del último cambio de contraseña ya no vale (iat va en segundos).
  if (user.sesionesDesde && (payload.iat ?? 0) < Math.floor(user.sesionesDesde.getTime() / 1000)) throw new UnauthorizedError('SESION_CERRADA')
  return user
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  try {
    if (!token) throw new UnauthorizedError('Token requerido')
    const user = await usuarioDeToken(token)

    // Solo lectura: para autorización cuenta como ADMIN (ve todo), pero cualquier escritura se corta aquí.
    if (user.role === 'LECTOR') {
      const escritura = !['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase())
      const permitido = /^\/api\/(auth\/logout|eventos\/ticket|notificaciones\/leidas)(\/|$)/.test(req.originalUrl.split('?')[0])
      if (escritura && !permitido) return next(new ForbiddenError('Modo de solo lectura: puedes ver todo, pero no hacer cambios.'))
      req.soloLectura = true
    }

    req.userId   = user.id
    req.userRole = user.role === 'LECTOR' ? 'ADMIN' : user.role
    req.userName = user.nombre ?? user.email
    req.operador = user.operador && user.role === 'ADMIN'
    next()
  } catch (error) {
    const crudo = token ? jwt.decode(token) as JwtPayload | null : null
    logSecurityEvent('AUTH_FAILURE', {
      email:     crudo?.email ?? 'desconocido',
      userId:    crudo?.sub   ?? 'desconocido',
      ip:        req.ip,
      userAgent: req.headers['user-agent'],
      url:       redactarUrl(req.originalUrl),
      method:    req.method,
      reason:    error instanceof Error ? error.message : 'token_invalid',
    })
    if (error instanceof ForbiddenError || error instanceof UnauthorizedError) return next(error)
    next(new UnauthorizedError('Token inválido o vencido'))
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.userRole || !roles.includes(req.userRole)) return next(new ForbiddenError('No tienes permiso para esto'))
    next()
  }
}
