import * as Sentry from '@sentry/node'
import { redactarUrl } from './utils/redactar'

/**
 * Sentry (8-oct): avisa de los errores inesperados del servidor. Va importado antes que todo en index.ts.
 * Sin SENTRY_DSN no hace nada. No manda datos personales: ni cuerpos de las peticiones (mensajes, contactos),
 * ni cookies, ni cabeceras; la URL va redactada (algunas llevan tokens).
 *
 * Vigilante (13-nov, aprobado): también llegan los errores que antes solo quedaban en el registro (logger.error, ver
 * utils/logger.ts), los envíos que fallan en cualquier canal (avisarFalla) y los errores de las pantallas en el
 * navegador (routes/vigia.ts). Correos y números de teléfono se tapan antes de salir.
 */
const dsn = (process.env.SENTRY_DSN ?? '').trim()

/** Tapa correos y números largos (teléfonos) en un texto que va a Sentry. */
export const limpiarTexto = (t: string) => t
  .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '<correo>')
  .replace(/\+?\d[\d\s-]{7,}\d/g, '<número>')

/** Lo que cambia de una vez a otra (ids, números, correos) fuera, para que el mismo problema quede en un solo aviso. */
const huella = (t: string) => limpiarTexto(t)
  .replace(/\b[a-z0-9]{20,}\b/gi, '<id>')
  .replace(/\d+/g, '#')
  .slice(0, 200)

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.RAILWAY_GIT_COMMIT_SHA?.slice(0, 12),
    tracesSampleRate: 0,
    beforeSend(event) {
      if (event.request) {
        delete event.request.data
        delete event.request.cookies
        delete event.request.headers
        delete event.request.query_string
        if (event.request.url) event.request.url = redactarUrl(event.request.url)
      }
      delete event.user
      if (event.message) event.message = limpiarTexto(event.message)
      for (const v of event.exception?.values ?? []) if (v.value) v.value = limpiarTexto(v.value)
      return event
    },
  })
}

export const sentryActivo = !!dsn

/** Un error que solo quedaba en el registro (logger.error): llega a Sentry agrupado por su texto. */
export function avisarRegistro(texto: string, area: string) {
  if (!sentryActivo || !texto) return
  Sentry.captureMessage(limpiarTexto(texto).slice(0, 2000), { level: 'error', tags: { lado: 'servidor', origen: 'registro', area }, fingerprint: ['registro', area, huella(texto)] })
}

/**
 * Un envío que no salió (WhatsApp, Instagram, Messenger, Telegram, TikTok o correo). Va como advertencia, agrupado por
 * canal y motivo (o código de Meta): muchos son del día a día (ventana de 24 horas, número sin WhatsApp) y así no
 * tapan lo que de verdad está roto, pero se ve cuántas veces pasa y desde cuándo.
 */
export function avisarFalla(canal: string, motivo: string, codigo?: number) {
  if (!sentryActivo) return
  Sentry.captureMessage(`Envío por ${canal} falló: ${limpiarTexto(motivo).slice(0, 500)}`, {
    level: 'warning',
    tags: { lado: 'servidor', origen: 'envio', canal, ...(codigo ? { codigo_meta: String(codigo) } : {}) },
    fingerprint: ['envio', canal, codigo ? String(codigo) : huella(motivo)],
  })
}

export { Sentry }
