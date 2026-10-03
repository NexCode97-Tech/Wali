import { Router, Request, Response } from 'express'
import type { User } from '@prisma/client'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { prisma } from '../config/prisma'
import { asyncHandler } from '../middleware/errorHandler'
import { authenticate, COOKIE_SESION, firmar, secreto, usuarioDeToken, type JwtPayload } from '../middleware/auth'
import { ApiResponse } from '../utils/response'
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../utils/errors'
import { auditLog } from '../utils/auditLogger'
import { logger, logSecurityEvent } from '../utils/logger'
import { enEspacio, espacioDeUsuario } from '../services/crm/espacio'
import { usuariosCrm } from '../services/crm/usuarios'
import { emitirCrm } from '../services/crm/tiempoReal'
import { BASE } from '../utils/base'

/**
 * La cuenta de cada persona: entrar, salir, el token del API y su perfil.
 *
 * La sesión es una cookie httpOnly con un JWT de 30 días. La pantalla nunca la lee: pide con ella un token corto
 * (GET /auth/token, 1 hora) y llama al API con `Authorization: Bearer`. Así un script de la página no puede
 * robarse la sesión larga y el API no depende de cookies (los webhooks y el tiempo real tampoco las usan).
 */
const router = Router()

const DIAS_SESION = 30
/** La cookie solo viaja a las direcciones del CRM: si vive en /crm de otro sitio, el resto del sitio no la recibe. */
export const RUTA_COOKIE = BASE || '/'
const cookieOpts = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: RUTA_COOKIE,
  maxAge: DIAS_SESION * 864e5,
})

/** Contraseñas: 10 caracteres o más. Sin reglas de símbolos: la longitud es lo que protege. */
export const claveValida = z.string().min(10, 'La contraseña debe tener 10 caracteres o más').max(200)
export const cifrarClave = (clave: string) => bcrypt.hash(clave, 12)

const limiteEntrar = rateLimit({
  windowMs: 15 * 60_000, max: 20, standardHeaders: true, legacyHeaders: false,
  message: { success: false, error: 'Demasiados intentos. Espera unos minutos y vuelve a intentar.' },
})

// ─── Entrar y salir ──────────────────────────────────────────────────────────

router.post('/login', limiteEntrar, asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = z.object({ email: z.string().trim().toLowerCase().email().max(200), password: z.string().min(1).max(200) }).parse(req.body)
  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } })
  // El mismo mensaje para «no existe» y «clave errada»: no se le dice a nadie qué correos tienen cuenta.
  const ok = !!user && await bcrypt.compare(password, user.passwordHash)
  if (!user || !ok) {
    logSecurityEvent('LOGIN_FALLIDO', { email, ip: req.ip })
    throw new UnauthorizedError('El correo o la contraseña no coinciden')
  }
  await abrirSesion(req, res, user)
  return ApiResponse.success(res, { ok: true })
}))

/** Abre la sesión de una cuenta (contraseña, Google, registro o contraseña nueva): revisa que pueda entrar y deja la cookie. */
export async function abrirSesion(req: Request, res: Response, user: User) {
  if (user.suspendido) throw new ForbiddenError('Esta cuenta está suspendida. Habla con el administrador.')
  if (!(await espacioDeUsuario(user.id))) throw new ForbiddenError('Tu cuenta no pertenece a ningún espacio de trabajo. Habla con el administrador.')
  await prisma.user.update({ where: { id: user.id }, data: { ultimoIngreso: new Date() } })
  res.cookie(COOKIE_SESION, firmar({ sub: user.id, email: user.email, role: user.role }, `${DIAS_SESION}d`), cookieOpts())
  req.userId = user.id; req.userRole = user.role
  auditLog(req, 'LOGIN', 'sesion', user.id)
}

router.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie(COOKIE_SESION, { path: RUTA_COOKIE })
  return ApiResponse.success(res, { ok: true })
})

/** El token corto del API, a cambio de la cookie de la sesión. */
router.get('/token', asyncHandler(async (req: Request, res: Response) => {
  const cookie = (req.cookies as Record<string, string> | undefined)?.[COOKIE_SESION]
  if (!cookie) throw new UnauthorizedError('Inicia sesión')
  let user
  try { user = await usuarioDeToken(cookie) } catch (e) {
    res.clearCookie(COOKIE_SESION, { path: RUTA_COOKIE })
    if (e instanceof ForbiddenError) throw e
    throw new UnauthorizedError('Tu sesión venció. Vuelve a entrar.')
  }
  res.setHeader('Cache-Control', 'no-store')
  return res.json({ token: firmar({ sub: user.id, email: user.email, role: user.role }, '1h') })
}))

/** La sesión de una petición de página (la cookie), o null. La usan las pantallas, no el API. */
export async function sesionDePagina(req: Request) {
  const cookie = (req.cookies as Record<string, string> | undefined)?.[COOKIE_SESION]
  if (!cookie) return null
  try {
    jwt.verify(cookie, secreto()) as JwtPayload
    return await usuarioDeToken(cookie)
  } catch { return null }
}

// ─── Mi perfil ───────────────────────────────────────────────────────────────

router.get('/me', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const u = await prisma.user.findUnique({ where: { id: req.userId }, select: { id: true, email: true, nombre: true, telefono: true, image: true, role: true, operador: true } })
  if (!u) throw new NotFoundError('Usuario no encontrado')
  return ApiResponse.success(res, u)
}))

router.patch('/me', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { nombre, telefono } = z.object({ nombre: z.string().trim().min(2).max(80).optional(), telefono: z.string().trim().max(30).optional() }).parse(req.body)
  await prisma.user.update({ where: { id: req.userId }, data: { ...(nombre ? { nombre } : {}), ...(telefono !== undefined ? { telefono: telefono || null } : {}) } })
  await refrescarGente(req.userId!)
  auditLog(req, 'UPDATE', 'mi_perfil', req.userId)
  return ApiResponse.success(res, { ok: true })
}))

router.patch('/me/clave', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { actual, nueva } = z.object({ actual: z.string().min(1).max(200), nueva: claveValida }).parse(req.body)
  const u = await prisma.user.findUnique({ where: { id: req.userId } })
  if (!u || !(await bcrypt.compare(actual, u.passwordHash))) throw new ValidationError('La contraseña actual no coincide')
  await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await cifrarClave(nueva) } })
  auditLog(req, 'UPDATE', 'mi_clave', u.id)
  return ApiResponse.success(res, { ok: true })
}))

// ─── Perfil y foto de la gente del espacio ───────────────────────────────────

/** ¿Están en el mismo espacio? Nadie ve ni cambia cuentas de otra empresa. */
export async function mismoEspacio(a: string, b: string): Promise<string | null> {
  const [ea, eb] = await Promise.all([espacioDeUsuario(a), espacioDeUsuario(b)])
  return ea && ea === eb ? ea : null
}

/** El administrador edita a cualquiera de su espacio; el líder, solo a los agentes. */
async function puedeGestionar(req: Request, id: string): Promise<boolean> {
  if (!(await mismoEspacio(req.userId!, id))) return false
  if (req.userRole === 'ADMIN') return true
  if (req.userRole !== 'LIDER') return false
  return (await prisma.user.findUnique({ where: { id }, select: { role: true } }))?.role === 'AGENTE'
}

/** La lista de personas del CRM se guarda un minuto: tras un cambio de nombre o foto se vuelve a leer. */
async function refrescarGente(userId: string) {
  try {
    const espacio = await espacioDeUsuario(userId)
    if (espacio) await enEspacio(espacio, () => usuariosCrm(true))
  } catch (e) { logger.warn(`[CRM] refrescar la gente tras cambiar a ${userId}: ${(e as Error)?.message ?? e}`) }
}

router.patch('/usuarios/:id/perfil', authenticate, asyncHandler(async (req: Request, res: Response) => {
  const { nombre, email, telefono } = z.object({
    nombre: z.string().trim().min(2).max(80).optional(),
    email: z.string().trim().toLowerCase().email().max(200).optional(),
    telefono: z.string().trim().max(30).optional(),
  }).parse(req.body)
  if (!(await puedeGestionar(req, req.params.id))) throw new ForbiddenError('No puedes editar esa cuenta')
  if (email) {
    const ocupado = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' }, id: { not: req.params.id } }, select: { id: true } })
    if (ocupado) throw new ConflictError('Ese correo ya está en uso')
  }
  await prisma.user.update({ where: { id: req.params.id }, data: { ...(nombre ? { nombre } : {}), ...(email ? { email } : {}), ...(telefono !== undefined ? { telefono: telefono || null } : {}) } })
  await refrescarGente(req.params.id)
  auditLog(req, 'UPDATE', 'perfil_usuario', req.params.id)
  return ApiResponse.success(res, { ok: true })
}))

/** Solo fotos subidas a la nube de archivos del CRM: nadie pone como foto una dirección cualquiera. */
function fotoPermitida(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  if (!s || s.length > 1000) return null
  let u: URL
  try { u = new URL(s) } catch { return null }
  if (u.protocol !== 'https:') return null
  const nube = process.env.CLOUDINARY_CLOUD_NAME
  return u.hostname === 'res.cloudinary.com' && !!nube && u.pathname.startsWith(`/${nube}/`) ? s : null
}

router.patch('/usuarios/:id/foto', authenticate, asyncHandler(async (req: Request, res: Response) => {
  if (req.userId !== req.params.id && !(await puedeGestionar(req, req.params.id))) throw new ForbiddenError('No autorizado')
  const image = fotoPermitida(req.body?.image)
  if (!image) throw new ValidationError('La foto debe ser una imagen subida desde el CRM. Vuelve a subirla.')
  const user = await prisma.user.update({ where: { id: req.params.id }, data: { image } })
  auditLog(req, 'UPDATE', 'usuario_foto', req.params.id)
  // La foto nueva llega en vivo a quien tenga el CRM abierto (evento `usuario-foto`).
  try {
    const espacio = await espacioDeUsuario(user.id)
    if (espacio) await enEspacio(espacio, async () => { await usuariosCrm(true); emitirCrm({ tipo: 'usuario-foto', userId: user.id, foto: user.image }, req.userId ?? null) })
  } catch (e) { logger.warn(`[CRM] foto de ${user.id}: ${(e as Error)?.message ?? e}`) }
  return ApiResponse.success(res, { image: user.image })
}))

// No hay ingreso con Google: la pantalla pregunta por la foto de Google y se le dice que no hay.
router.get('/usuarios/:id/foto-google', authenticate, (_req: Request, res: Response) => ApiResponse.success(res, { picture: null }))
router.post('/usuarios/:id/foto-google', authenticate, () => { throw new NotFoundError('Esta cuenta no tiene foto de Google. Sube una foto desde tu equipo.') })

export default router
