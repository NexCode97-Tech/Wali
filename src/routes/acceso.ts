import crypto from 'crypto'
import { Router, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import jwt from 'jsonwebtoken'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '../config/prisma'
import { asyncHandler } from '../middleware/errorHandler'
import { secreto } from '../middleware/auth'
import { ApiResponse } from '../utils/response'
import { AppError, ConflictError, ForbiddenError, ValidationError } from '../utils/errors'
import { logger, logSecurityEvent } from '../utils/logger'
import { BASE } from '../utils/base'
import { abrirSesion, cifrarClave, claveValida, RUTA_COOKIE } from './auth'
import { correoMarca, escaparHtml } from '../utils/correoMarca'

/**
 * Las puertas de entrada que no piden sesión: crear una cuenta (con su espacio), recuperar la contraseña por
 * correo y entrar o registrarse con Google.
 *
 * - CRM_URL: la dirección pública del CRM (p. ej. https://www.nexcode97.com/crm). Va en los enlaces de los correos
 *   y en el regreso de Google; nunca se arma con la cabecera Host, que la puede falsear cualquiera.
 * - CRM_REGISTRO=cerrado: solo el administrador crea cuentas (por defecto el registro está abierto).
 * - RESEND_API_KEY (y CRM_CORREO_DE): el correo de recuperación.
 * - GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET: el botón de Google. Regreso autorizado: <CRM_URL>/api/auth/google/regreso.
 */
const router = Router()

const enProduccion = () => process.env.NODE_ENV === 'production'
const limite = (max: number, minutos: number) => rateLimit({
  windowMs: minutos * 60_000, max, standardHeaders: true, legacyHeaders: false,
  message: { success: false, error: 'Demasiados intentos. Espera unos minutos y vuelve a intentar.' },
})
const limiteRegistro = limite(10, 60)
const limiteRecuperar = limite(6, 15)
const limiteEnlace = limite(30, 15)

export function urlPublica(): string | null {
  const v = (process.env.CRM_URL ?? '').trim().replace(/\/+$/, '')
  return /^https?:\/\/[^\s"'<>?#]+$/.test(v) ? v : null
}
/** La versión de los documentos legales vigentes (fecha de nexcode97.com/privacidad y /terminos). Se cambia al publicar otra. */
export const VERSION_DOCUMENTOS = process.env.CRM_VERSION_DOCUMENTOS || '2026-10-03'
const registroAbierto = () => process.env.CRM_REGISTRO !== 'cerrado'
const correoListo = () => !!(process.env.RESEND_API_KEY && urlPublica())
const googleListo = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && urlPublica())
const cookieCorta = (minutos: number) => ({ httpOnly: true, sameSite: 'lax' as const, secure: enProduccion(), path: RUTA_COOKIE, maxAge: minutos * 60_000 })
const buscarPorCorreo = (email: string) => prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } })

/** Lo que la pantalla necesita saber antes de mostrar los botones. */
router.get('/opciones', (_req: Request, res: Response) => ApiResponse.success(res, { registro: registroAbierto(), google: googleListo(), recuperar: correoListo() }))

// ─── Crear cuenta ────────────────────────────────────────────────────────────

/** El identificador del espacio sale del nombre de la empresa: minúsculas, sin tildes; si ya existe, con un sufijo. */
async function idDeEspacio(empresa: string): Promise<string> {
  let base = empresa.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24).replace(/-+$/, '')
  if (base.length < 2) base = 'empresa'
  for (let i = 0; i < 12; i++) {
    const id = i ? `${base}-${crypto.randomBytes(2).toString('hex')}` : base
    if (!(await prisma.crmEspacio.findUnique({ where: { id }, select: { id: true } }))) return id
  }
  throw new AppError('No se pudo crear el espacio. Intenta de nuevo.', 500)
}

/** Lo que dijo Google de una persona sin cuenta, firmado y por 15 minutos, mientras escribe el nombre de su empresa. */
const COOKIE_GOOGLE = 'crm_google'
interface DeGoogle { email: string; nombre: string; foto: string | null }
function deGoogle(req: Request): DeGoogle | null {
  const v = (req.cookies as Record<string, string> | undefined)?.[COOKIE_GOOGLE]
  if (!v) return null
  try {
    const p = jwt.verify(v, secreto()) as DeGoogle & { tipo?: string }
    return p.tipo === 'google-registro' && p.email ? { email: p.email, nombre: p.nombre, foto: p.foto } : null
  } catch { return null }
}

router.post('/registro', limiteRegistro, asyncHandler(async (req: Request, res: Response) => {
  if (!registroAbierto()) throw new ForbiddenError('El registro está cerrado. Pide una cuenta al administrador de tu empresa.')
  const d = z.object({
    nombre: z.string().trim().min(3, 'Escribe tu nombre y apellido').max(80),
    empresa: z.string().trim().min(2, 'Escribe el nombre de tu empresa').max(80),
    email: z.string().trim().toLowerCase().email('Escribe un correo válido').max(200).optional(),
    password: claveValida.optional(),
    google: z.boolean().optional(),
  }).parse(req.body)
  let email: string, foto: string | null = null, clave: string
  if (d.google) {
    const g = deGoogle(req)
    if (!g) throw new ValidationError('El acceso con Google venció. Vuelve a tocar «Registrarme con Google».')
    email = g.email; foto = g.foto
    clave = crypto.randomBytes(32).toString('base64url') // entra con Google; si quiere contraseña, la recupera
  } else {
    if (!d.email) throw new ValidationError('Escribe un correo válido')
    if (!d.password) throw new ValidationError('La contraseña debe tener 10 caracteres o más')
    email = d.email; clave = d.password
  }
  if (await buscarPorCorreo(email)) throw new ConflictError('Ya hay una cuenta con ese correo. Inicia sesión o recupera tu contraseña.')
  const espacioId = await idDeEspacio(d.empresa)
  const passwordHash = await cifrarClave(clave)
  let user
  try {
    user = await prisma.$transaction(async tx => {
      await tx.crmEspacio.create({ data: { id: espacioId, nombre: d.empresa } })
      const u = await tx.user.create({ data: { email, nombre: d.nombre, image: foto, role: 'ADMIN', passwordHash } })
      await tx.crmMiembro.create({ data: { espacioId, userId: u.id } })
      // Al crear la cuenta aceptó los términos, el uso aceptable y la política de datos: queda la prueba.
      await tx.consentimiento.create({ data: { userId: u.id, email, tipo: d.google ? 'registro-google' : 'registro', version: VERSION_DOCUMENTOS, ip: req.ip ?? null, userAgent: String(req.headers['user-agent'] ?? '').slice(0, 300) || null } })
      return u
    })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictError('Ya hay una cuenta con ese correo. Inicia sesión o recupera tu contraseña.')
    throw e
  }
  res.clearCookie(COOKIE_GOOGLE, { path: RUTA_COOKIE })
  logger.info({ evento: 'REGISTRO', espacioId, userId: user.id, google: !!d.google })
  await abrirSesion(req, res, user)
  return ApiResponse.created(res, { ok: true })
}))

// ─── Recuperar la contraseña ─────────────────────────────────────────────────

const MINUTOS_ENLACE = 30
const hash = (token: string) => crypto.createHash('sha256').update(token).digest('hex')

async function enviarCorreo(para: string, asunto: string, html: string, texto: string) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.CRM_CORREO_DE || process.env.RESEND_FROM_EMAIL || 'NexCode97 <hola@nexcode97.com>', reply_to: process.env.CRM_CORREO_AYUDA || 'nexcode97@gmail.com', to: [para], subject: asunto, html, text: texto }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 200)}`)
}

async function enviarRecuperacion(user: { id: string; email: string; nombre: string | null }) {
  const token = crypto.randomBytes(32).toString('base64url')
  // Solo vale el último enlace: pedir otro anula los anteriores.
  await prisma.recuperacionClave.updateMany({ where: { userId: user.id, usado: null }, data: { usado: new Date() } })
  await prisma.recuperacionClave.create({ data: { userId: user.id, tokenHash: hash(token), expira: new Date(Date.now() + MINUTOS_ENLACE * 60_000) } })
  const enlace = `${urlPublica()}/entrar?clave=${token}`
  const nombre = user.nombre ? user.nombre.split(/s+/)[0] : ''
  const hola = nombre ? `Hola, ${nombre}` : 'Hola'
  await enviarCorreo(user.email, 'Crea tu contraseña nueva',
    correoMarca({
      preencabezado: `Tu enlace para crear una contraseña nueva vence en ${MINUTOS_ENLACE} minutos.`,
      titulo: hola,
      parrafos: [
        `Recibimos una solicitud para crear una contraseña nueva para tu cuenta del CRM <strong style="color:#0a0a0d">${escaparHtml(user.email)}</strong>.`,
        'Toca el botón para elegirla. Al guardarla entras de una vez a tu bandeja.',
      ],
      boton: { texto: 'Crear contraseña nueva', url: enlace },
      aviso: `<strong style="color:#0a0a0d">El enlace vence en ${MINUTOS_ENLACE} minutos</strong> y sirve una sola vez. Si pides otro, este deja de funcionar.`,
      nota: 'Si no pediste este cambio, ignora este correo: tu contraseña sigue igual y nadie puede cambiarla sin este enlace.',
    }),
    `${hola}.

Recibimos una solicitud para crear una contraseña nueva para tu cuenta del CRM (${user.email}).

Ábrela aquí (vence en ${MINUTOS_ENLACE} minutos y sirve una sola vez):
${enlace}

Si no pediste este cambio, ignora este correo: tu contraseña sigue igual.

NexCode97 · ${process.env.CRM_CORREO_AYUDA || 'nexcode97@gmail.com'}`)
}

router.post('/recuperar', limiteRecuperar, asyncHandler(async (req: Request, res: Response) => {
  if (!correoListo()) throw new AppError('La recuperación por correo todavía no está activa. Pide al administrador que te cambie la contraseña.', 503)
  const { email } = z.object({ email: z.string().trim().toLowerCase().email('Escribe el correo de tu cuenta').max(200) }).parse(req.body)
  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' }, suspendido: false }, select: { id: true, email: true, nombre: true } })
  // La misma respuesta exista o no la cuenta, y sin esperar el envío: ni el mensaje ni el tiempo delatan qué correos tienen cuenta.
  if (user) void enviarRecuperacion(user).catch(e => logger.error({ evento: 'RECUPERAR_FALLO', userId: user.id, err: (e as Error).message }))
  logSecurityEvent('RECUPERAR_PEDIDO', { email, ip: req.ip, existe: !!user })
  return ApiResponse.success(res, { ok: true })
}))

async function enlaceValido(token: string) {
  const r = await prisma.recuperacionClave.findUnique({ where: { tokenHash: hash(token) } })
  if (!r || r.usado || r.expira < new Date()) throw new ValidationError('El enlace venció o ya se usó. Pide uno nuevo.')
  return r
}
const conToken = z.object({ token: z.string().min(20).max(200) })

/** Antes de mostrar el formulario: el enlace sirve y para qué correo es. */
router.post('/recuperar/revisar', limiteEnlace, asyncHandler(async (req: Request, res: Response) => {
  const r = await enlaceValido(conToken.parse(req.body).token)
  const u = await prisma.user.findUnique({ where: { id: r.userId }, select: { email: true } })
  return ApiResponse.success(res, { email: u?.email ?? '' })
}))

router.post('/nueva-clave', limiteEnlace, asyncHandler(async (req: Request, res: Response) => {
  const d = conToken.extend({ password: claveValida }).parse(req.body)
  const r = await enlaceValido(d.token)
  const passwordHash = await cifrarClave(d.password)
  const user = await prisma.$transaction(async tx => {
    // Gana una sola petición aunque lleguen dos con el mismo enlace.
    const { count } = await tx.recuperacionClave.updateMany({ where: { id: r.id, usado: null }, data: { usado: new Date() } })
    if (!count) throw new ValidationError('El enlace venció o ya se usó. Pide uno nuevo.')
    return tx.user.update({ where: { id: r.userId }, data: { passwordHash } })
  })
  logSecurityEvent('CLAVE_RECUPERADA', { userId: user.id, ip: req.ip })
  await abrirSesion(req, res, user)
  return ApiResponse.success(res, { ok: true })
}))

// ─── Google ──────────────────────────────────────────────────────────────────

const COOKIE_ESTADO = 'crm_google_estado'
const regresoGoogle = () => `${urlPublica()}/api/auth/google/regreso`

router.get('/google', (_req: Request, res: Response) => {
  if (!googleListo()) return res.redirect(`${BASE}/entrar?error=google-inactivo`)
  const estado = crypto.randomBytes(24).toString('base64url')
  res.cookie(COOKIE_ESTADO, estado, cookieCorta(10))
  const q = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: regresoGoogle(), response_type: 'code', scope: 'openid email profile', state: estado, prompt: 'select_account' })
  return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${q}`)
})

const igual = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))

router.get('/google/regreso', limiteEnlace, asyncHandler(async (req: Request, res: Response) => {
  const volver = (q: string) => res.redirect(`${BASE}/entrar?${q}`)
  const estado = String((req.cookies as Record<string, string> | undefined)?.[COOKIE_ESTADO] ?? '')
  res.clearCookie(COOKIE_ESTADO, { path: RUTA_COOKIE })
  if (!googleListo()) return volver('error=google-inactivo')
  if (!estado || typeof req.query.state !== 'string' || !igual(req.query.state, estado)) return volver('error=google')
  if (req.query.error || typeof req.query.code !== 'string') return volver('error=google-cancelado')
  let p: { email?: string; email_verified?: boolean; name?: string; picture?: string }
  try {
    const t = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(15_000),
      body: new URLSearchParams({ code: req.query.code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: regresoGoogle(), grant_type: 'authorization_code' }),
    })
    if (!t.ok) throw new Error(`token ${t.status}`)
    const { access_token } = await t.json() as { access_token: string }
    const i = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${access_token}` }, signal: AbortSignal.timeout(15_000) })
    if (!i.ok) throw new Error(`userinfo ${i.status}`)
    p = await i.json() as typeof p
  } catch (e) {
    logger.warn({ evento: 'GOOGLE_FALLO', err: (e as Error).message })
    return volver('error=google')
  }
  if (!p.email || p.email_verified !== true) return volver('error=google-correo')
  const email = p.email.toLowerCase()
  const user = await buscarPorCorreo(email)
  if (user) {
    try { await abrirSesion(req, res, user) } catch (e) {
      if (e instanceof ForbiddenError) return volver(user.suspendido ? 'error=suspendida' : 'error=sin-espacio')
      throw e
    }
    return res.redirect(BASE + '/')
  }
  if (!registroAbierto()) return volver('error=google-sin-cuenta')
  const foto = p.picture && /^https:\/\/[^\s"'<>]+$/.test(p.picture) ? p.picture.slice(0, 500) : null
  res.cookie(COOKIE_GOOGLE, jwt.sign({ tipo: 'google-registro', email, nombre: (p.name ?? '').slice(0, 80), foto }, secreto(), { expiresIn: '15m' }), cookieCorta(15))
  return volver('google=nuevo')
}))

/** La persona que viene de Google sin cuenta: la pantalla le muestra su correo y le pide la empresa. */
router.get('/google/pendiente', (req: Request, res: Response) => {
  const g = deGoogle(req)
  res.setHeader('Cache-Control', 'no-store')
  return ApiResponse.success(res, g ? { email: g.email, nombre: g.nombre } : null)
})

export default router
