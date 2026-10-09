import { Router, type Request, type Response, type NextFunction } from 'express'
import rateLimit from 'express-rate-limit'
import { asyncHandler } from '../middleware/errorHandler'
import { ApiResponse } from '../utils/response'
import { UnauthorizedError } from '../utils/errors'
import { abrirSesionWeb, configWeb, leerToken, mensajeWeb, mensajesWeb, type TokenWeb } from '../services/crm/chatWeb'
import { enEspacio, ESPACIO_POR_DEFECTO } from '../services/crm/espacio'
import { prismaGlobal } from '../services/crm/bd'

/**
 * Chat de la página web del CRM (services/crm/chatWeb.ts). Rutas públicas, sin sesión de la
 * plataforma: las usa la burbuja `chat.js` desde cualquier página. CORS abierto (index.ts) y
 * límites propios por IP y por navegador, aparte de los globales.
 */
const router = Router()

// La misma IP que el límite global (index.ts, ipCliente): la cabecera que pone el proxy de Railway.
const ipDe = (req: Request) => String(req.headers['x-real-ip'] ?? '').trim() || req.ip || 'anon'
const limite = (max: number, ventanaMin: number, clave: (req: Request) => string, mensaje: string) => rateLimit({
  windowMs: ventanaMin * 60_000, max, keyGenerator: clave, standardHeaders: true, legacyHeaders: false,
  message: { success: false, error: mensaje },
})

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express { interface Request { visitanteWeb?: TokenWeb } }
}

/**
 * Cada burbuja es de un espacio de trabajo: el código que se pega en la página lo dice
 * (`data-espacio`, que llega como `?e=`), y el token del visitante lo lleva firmado. Sin
 * espacio, es el espacio por defecto (CRM_ESPACIO).
 */
const ESPACIO_VALIDO = /^[a-z0-9-]{2,40}$/
function conEspacioPublico(req: Request, _res: Response, next: NextFunction) {
  const e = typeof req.query.e === 'string' && req.query.e ? req.query.e : ESPACIO_POR_DEFECTO
  if (!ESPACIO_VALIDO.test(e)) return next(new UnauthorizedError('Ese chat no existe.'))
  prismaGlobal.crmEspacio.findUnique({ where: { id: e }, select: { id: true } }).then(x => {
    if (!x) return next(new UnauthorizedError('Ese chat no existe.'))
    enEspacio(e, () => next())
  }, next)
}

function conToken(req: Request, _res: Response, next: NextFunction) {
  const d = leerToken(String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, ''))
  if (!d) return next(new UnauthorizedError('El chat se reinició. Vuelve a abrirlo.'))
  req.visitanteWeb = d
  enEspacio(d.e ?? ESPACIO_POR_DEFECTO, () => next())
}

router.get('/config', conEspacioPublico, asyncHandler(async (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'public, max-age=60')
  return ApiResponse.success(res, await configWeb())
}))

router.post('/sesion', conEspacioPublico, limite(12, 10, ipDe, 'Abriste el chat muchas veces seguidas. Espera unos minutos.'),
  asyncHandler(async (req: Request, res: Response) => ApiResponse.success(res, await abrirSesionWeb(req.body ?? {}))))

router.post('/mensajes', conToken,
  limite(20, 1, req => req.visitanteWeb!.v, 'Vas muy rápido. Espera un momento y vuelve a escribir.'),
  limite(60, 1, ipDe, 'Hay demasiados mensajes desde esta conexión. Espera un momento.'),
  asyncHandler(async (req: Request, res: Response) => ApiResponse.success(res, await mensajeWeb(req.visitanteWeb!, req.body ?? {}))))

router.get('/mensajes', conToken, limite(40, 1, req => req.visitanteWeb!.v, 'Espera un momento.'),
  asyncHandler(async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store')
    return ApiResponse.success(res, await mensajesWeb(req.visitanteWeb!, typeof req.query.desde === 'string' ? req.query.desde : undefined, req.query.visto === '1'))
  }))

export default router
