import * as Sentry from '@sentry/node'
import { redactarUrl } from './utils/redactar'

/**
 * Sentry (8-oct): avisa de los errores inesperados del servidor. Va importado antes que todo en index.ts.
 * Sin SENTRY_DSN no hace nada. No manda datos personales: ni cuerpos de las peticiones (mensajes, contactos),
 * ni cookies, ni cabeceras; la URL va redactada (algunas llevan tokens).
 */
const dsn = (process.env.SENTRY_DSN ?? '').trim()
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
      return event
    },
  })
}

export const sentryActivo = !!dsn
export { Sentry }
