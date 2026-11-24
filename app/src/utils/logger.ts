import pino from 'pino'
import { avisarRegistro } from '../instrument'
import { registrarError } from './registroErrores'

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

const SALTO = String.fromCharCode(10)

/** La empresa donde pasó, si el registro ocurre dentro de una petición de un espacio (se carga tarde: evita un ciclo). */
function espacioDelMomento(): string | null {
  try { return (require('../services/crm/espacio') as { espacioOpcional: () => string | null }).espacioOpcional() } catch { return null }
}

/** Todo aviso y error queda también en el registro interno (utils/registroErrores.ts), salvo los eventos de auditoría. */
function alRegistro(args: unknown[], nivel: number) {
  const [a, b] = args
  const o = a && typeof a === 'object' && !(a instanceof Error) ? a as Record<string, unknown> : null
  if (o?.type === 'security') return
  const err = a instanceof Error ? a : (o?.err instanceof Error ? o.err : o?.error instanceof Error ? o.error : null) as Error | null
  const partes = [typeof a === 'string' ? a : '', typeof b === 'string' ? b : '', err ? err.message : '']
  if (o) for (const k of ['msg', 'error', 'evento']) { const v = o[k]; if (typeof v === 'string') partes.push(v) }
  const texto = partes.filter(Boolean).join(' · ') || JSON.stringify(o ?? a).slice(0, 500)
  const area = (texto.match(/^\[([^\]]{1,40})\]/)?.[1] ?? (o?.evento ? String(o.evento) : 'general')).toLowerCase()
  const detalle: Record<string, unknown> = {}
  if (o) for (const [k, v] of Object.entries(o)) if (!['msg', 'err', 'error'].includes(k) && (typeof v !== 'object' || v === null)) detalle[k] = v
  if (err?.stack) detalle.pila = err.stack.split(SALTO).slice(0, 8).join(SALTO)
  registrarError({ nivel: nivel >= 60 ? 'fatal' : nivel >= 50 ? 'error' : 'aviso', area, mensaje: texto, detalle, espacioId: espacioDelMomento() })
}

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  hooks: {
    logMethod(args, metodo, nivel) {
      if (nivel >= 50) { try { alVigilante(args) } catch { /* el vigilante nunca rompe el registro */ } }
      if (nivel >= 40) { try { alRegistro(args, nivel) } catch { /* el registro interno tampoco */ } }
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
