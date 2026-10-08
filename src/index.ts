import './setTz'
import crypto from 'crypto'
import express, { Request, Response, NextFunction } from 'express'
import helmet from 'helmet'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import { prisma } from './config/prisma'
import { logger } from './utils/logger'
import { redactarUrl } from './utils/redactar'
import { errorHandler } from './middleware/errorHandler'
import authRoutes from './routes/auth'
import accesoRoutes from './routes/acceso'
import pagosRoutes from './routes/pagos'
import usuariosRoutes from './routes/usuarios'
import notificacionesRoutes from './routes/notificaciones'
import uploadRoutes from './routes/upload'
import eventosRoutes from './routes/eventos'
import crmRoutes from './routes/crm'
import crmWebRoutes from './routes/crmWeb'
import crmPautaRoutes from './routes/crmPauta'
import { regresoCrm, webhookCrmManychat, webhookCrmMeta, webhookCrmTelegram, webhookCrmTiktok, webhookCrmWa } from './routes/crmWhatsapp'
import paginas from './paginas'

/**
 * El servidor del CRM: el API (/api), las pantallas (/, /entrar, /app, /usuarios) y la burbuja del chat web
 * (/chat.js), todo en un solo servicio. Necesita PostgreSQL (DATABASE_URL) y AUTH_SECRET; lo demás es opcional
 * y está descrito en .env.example.
 */
const app = express()
const PORT = process.env.PORT || 3000

// Detrás de un proxy inverso: la IP real y el HTTPS llegan en las cabeceras X-Forwarded-*. TRUST_PROXY dice cuántos
// proxies hay delante: 1 con Railway solo; 2 si además el sitio de la empresa reenvía /crm (Vercel → Railway), para
// que el límite de peticiones cuente por visitante y no por la IP del proxy.
app.set('trust proxy', Math.max(1, Number(process.env.TRUST_PROXY) || 1))
app.disable('x-powered-by')

// Un id por petición, para seguirla en los registros.
app.use((req: Request, _res: Response, next: NextFunction) => {
  (req as Request & { reqId: string }).reqId = crypto.randomUUID()
  next()
})

// Tiempo máximo por petición. Los agentes IA encadenan consultas y una llamada al modelo: ellos tienen 3 minutos.
app.use((req: Request, res: Response, next: NextFunction) => {
  const limite = /^\/api\/crm\/(ia|agentes|kb|conversaciones\/\d+\/exportar)/.test(req.path) ? 180_000 : 30_000
  res.setTimeout(limite, () => { if (!res.headersSent) res.status(503).json({ success: false, error: 'Tiempo de espera agotado.' }) })
  next()
})

// Cabeceras de seguridad. La pantalla del CRM es una sola página con su CSS y su código dentro (por eso
// 'unsafe-inline'); las imágenes y los audios de las conversaciones vienen de la nube de archivos y de los canales.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'self'"],
      scriptSrc:      ["'self'", "'unsafe-inline'", 'https://connect.facebook.net'],
      styleSrc:       ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc:        ["'self'", 'data:', 'https://fonts.gstatic.com'],
      imgSrc:         ["'self'", 'data:', 'blob:', 'https:'],
      mediaSrc:       ["'self'", 'blob:', 'https:'],
      connectSrc:     ["'self'", 'https:'],
      frameSrc:       ["'self'", 'https://www.facebook.com', 'https://web.facebook.com'],
      frameAncestors: ["'self'"],
      objectSrc:      ["'none'"],
      ...(process.env.NODE_ENV === 'production' ? { upgradeInsecureRequests: [] } : { upgradeInsecureRequests: null }),
    },
  },
  crossOriginEmbedderPolicy: false,
  hsts: process.env.NODE_ENV === 'production' ? { maxAge: 31536000, includeSubDomains: true } : false,
}))

// El chat de la página web vive en cualquier sitio de la empresa, sin cookies ni sesión: CORS abierto solo para
// esas rutas; las protege el token del visitante. El resto del API es del mismo origen que las pantallas.
app.use('/api/crm/web', (req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Max-Age', '600')
  if (req.method === 'OPTIONS') { res.sendStatus(204); return }
  next()
})

// Los avisos de los canales van ANTES del lector de JSON: Meta y TikTok firman el cuerpo y hay que verificar
// la firma sobre los bytes exactos.
app.use('/api/crm/whatsapp/webhook', express.raw({ type: '*/*', limit: '5mb' }))
app.use('/api/crm/meta/webhook', express.raw({ type: '*/*', limit: '5mb' }))
app.use('/api/crm/tiktok/webhook', express.raw({ type: '*/*', limit: '5mb' }))
app.use('/api/pagos/creem', express.raw({ type: '*/*', limit: '1mb' }))

// El tiempo real (/api/eventos) no se comprime: gzip retiene cada escritura y el navegador no recibiría nada.
// Se mira `originalUrl` porque la compresión decide al enviar las cabeceras, ya dentro del router.
app.use(compression({
  filter: (req, res) => (req.originalUrl.startsWith('/api/eventos') ? false : compression.filter(req, res)),
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(cookieParser())

// Registro de cada petición, con la dirección redactada: algunos endpoints reciben su token en la dirección
// (el tiempo real no admite cabeceras) y ese secreto no debe quedar guardado.
app.use((req: Request & { reqId?: string }, res: Response, next: NextFunction) => {
  const inicio = Date.now()
  res.on('finish', () => {
    if (req.path === '/health') return
    logger.info({ reqId: req.reqId, method: req.method, url: redactarUrl(req.originalUrl), status: res.statusCode, ms: Date.now() - inicio })
  })
  next()
})

// Límites de solicitudes. Los avisos de los canales no pasan por ellos: Meta manda ráfagas desde pocas IP y un
// 429 la hace reintentar. Tampoco el clic de un enlace de pauta (/api/crm/w), que tiene su propio límite.
const ipCliente = (req: Request) => String(req.headers['x-real-ip'] ?? '').trim() || req.ip || 'anon'
const esAvisoDeCanal = (req: Request) => /^\/api\/crm\/((whatsapp|meta|telegram|tiktok)\/webhook|w\/)/.test(req.originalUrl)
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000, max: 3000, skip: esAvisoDeCanal, keyGenerator: ipCliente,
  standardHeaders: true, legacyHeaders: false,
  message: { success: false, error: 'Demasiadas solicitudes, intenta más tarde.' },
}))
app.use('/api', rateLimit({
  windowMs: 60 * 1000, max: 240, skip: esAvisoDeCanal,
  keyGenerator: req => req.headers.authorization?.slice(-20) || ipCliente(req),
  standardHeaders: true, legacyHeaders: false,
  message: { success: false, error: 'Límite por minuto alcanzado.' },
}))

// Revisa también la base de datos: si no responde, el servicio no está sano.
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', db: 'ok', timestamp: new Date().toISOString() })
  } catch {
    res.status(503).json({ status: 'error', db: 'unreachable', timestamp: new Date().toISOString() })
  }
})

// ─── API ─────────────────────────────────────────────────────────────────────
app.use('/api/auth',           authRoutes)
app.use('/api/auth',           accesoRoutes)
app.use('/api/pagos/creem',     pagosRoutes) // avisos de Creem (firmados) // registro, recuperar la contraseña y Google (sin sesión)
app.use('/api/usuarios',       usuariosRoutes)
app.use('/api/notificaciones', notificacionesRoutes)
app.use('/api/upload',         uploadRoutes)
app.use('/api/eventos',        eventosRoutes)
// Los avisos de los canales van antes: el router del CRM pide sesión.
app.use('/api/crm/whatsapp', webhookCrmWa)
app.use('/api/crm/meta',     webhookCrmMeta)
app.use('/api/crm/telegram', webhookCrmTelegram)
app.use('/api/crm/manychat', webhookCrmManychat)
app.use('/api/crm/tiktok',   webhookCrmTiktok)
app.use('/api/crm',          regresoCrm) // regreso de las ventanas de autorización de TikTok e Instagram (público)
app.use('/api/crm/web',      crmWebRoutes)
app.use('/api/crm/w',        crmPautaRoutes) // clic en un enlace de pauta (público)
app.use('/api/crm',          crmRoutes)
app.use('/api', (_req: Request, res: Response) => { res.status(404).json({ success: false, error: 'Ruta no encontrada' }) })

// ─── Pantallas ───────────────────────────────────────────────────────────────
app.use(paginas)

app.use(errorHandler)

app.listen(PORT, () => {
  logger.info(`CRM en el puerto ${PORT}`)
  // Pruebas locales (SIN_JOBS=1): solo las rutas, sin los procesos programados.
  if (process.env.SIN_JOBS === '1') return
  void import('./services/crm/procesos').then(m => m.iniciarProcesosCrm()).catch(e => logger.error(`[CRM procesos] no arrancaron: ${e?.message}`))
})
