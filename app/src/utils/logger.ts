import pino from 'pino'
import { avisarRegistro } from '../instrument'

/**
 * Todo logger.error (y fatal) llega también a Sentry (vigilante, 13-nov): muchos errores se atrapan y solo se anotan
 * (correo que no entra, webhook que no se pudo procesar, IA sin saldo) y nadie se enteraba. El área sale del prefijo
 * «[CRM correo]». Lo que ya se manda a Sentry por su lado lleva `sentry: false` y no se repite.
 */
function alVigilante(args: unknown[]) {
  const [a, b] = args
  const o = a && typeof a === 'object' ? a as Record<string, unknown> : null
  if (o?.sentry === false) return
  const partes = [typeof a === 'string' ? a : '', typeof b === 'string' ? b : '']
  if (o) for (const k of ['msg', 'error', 'evento', 'err']) { const v = o[k]; if (typeof v === 'string') partes.push(v); else if (v instanceof Error) partes.push(v.message) }
  const texto = partes.filter(Boolean).join(' · ')
  const area = (texto.match(/^\[([^\]]{1,40})\]/)?.[1] ?? 'general').toLowerCase()
  avisarRegistro(texto, area)
}

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  hooks: {
    logMethod(args, metodo, nivel) {
      if (nivel >= 50) { try { alVigilante(args) } catch { /* el vigilante nunca rompe el registro */ } }
      return metodo.apply(this, args)
    },
  },
  // Segunda red, por si alguien vuelve a loguear un objeto con credenciales
  // dentro. La primera es redactarUrl() en los puntos que registran la URL.
  redact: {
    paths: [
      'token', '*.token', 'accessToken', '*.accessToken',
      'secreto', '*.secreto', 'secret', '*.secret',
      'password', '*.password', 'clave', '*.clave',
      'authorization', '*.authorization', 'headers.authorization',
      'privateKey', '*.privateKey', 'GOOGLE_SHEETS_SA_PRIVATE_KEY',
    ],
    censor: '***',
  },
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
})

export function logSecurityEvent(event: string, details: Record<string, unknown>) {
  logger.warn({ type: 'security', event, ...details, timestamp: new Date().toISOString() })
}
