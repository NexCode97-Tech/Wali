import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { AppError, ValidationError } from '../utils/errors'
import { logger } from '../utils/logger'
import { redactarUrl } from '../utils/redactar'
import { Sentry, sentryActivo } from '../instrument'

type ReqWithId = Request & { reqId?: string }

export function errorHandler(err: Error, req: ReqWithId, res: Response, _next: NextFunction) {
  const reqId = req.reqId

  // Errores de validación Zod → 400 (son errores del cliente)
  if (err instanceof ZodError) {
    const messages = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
    return res.status(400).json({
      success: false,
      error: `Datos inválidos: ${messages}`,
      errors: err.errors,
    })
  }

  if (err instanceof ValidationError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      ...(err.errors && { errors: err.errors }),
    })
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
    })
  }

  // La API de Anthropic sin saldo o saturada no es un fallo del código: se le
  // dice a la persona qué pasa en vez de "Error interno del servidor".
  const msg = String(err.message || '')
  if (/credit balance is too low/i.test(msg)) {
    logger.error({ reqId, error: 'Anthropic sin saldo', url: redactarUrl(req.originalUrl || req.url) })
    return res.status(503).json({ success: false, error: 'El agente está fuera de servicio un momento: la cuenta de IA se quedó sin saldo y ya se pidió recargarla.' })
  }
  if (/overloaded_error|\b529\b/i.test(msg)) {
    return res.status(503).json({ success: false, error: 'La IA está saturada en este momento. Intenta de nuevo en un minuto.' })
  }

  // Error inesperado: se registra con su reqId. La URL va redactada, porque algunos endpoints reciben un
  // token por query string y no debe quedar en los registros.
  const urlSegura = redactarUrl(req.originalUrl || req.url)
  logger.error({ reqId, error: err.message, stack: err.stack, url: urlSegura, method: req.method })
  if (sentryActivo) Sentry.captureException(err, { tags: { reqId: reqId ?? '', metodo: req.method }, extra: { url: urlSegura } })

  return res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : err.message,
  })
}

export const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
