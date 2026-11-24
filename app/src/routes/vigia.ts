import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Request, Response } from 'express'
import { BASE } from '../utils/base'
import { logger } from '../utils/logger'
import { registrarError } from '../utils/registroErrores'

/**
 * Vigilante de las pantallas (13-nov, aprobado): los errores del navegador (CRM, superadmin, inicio de sesión y el
 * sitio walicrm.com) llegan a Sentry pasando por aquí.
 *
 * - GET /vigia.js: Sentry para el navegador con su configuración (pantalla/compartido/vigia.js, empaquetado al
 *   construir en dist/vigia.js con scripts/armar-vigia.mjs).
 * - POST /api/vigia: el «túnel» de Sentry. El navegador manda cada aviso aquí, al mismo sitio (no lo bloquean los
 *   bloqueadores de anuncios ni la CSP), y el servidor lo reenvía con el DSN real, que nunca sale al navegador.
 *   Solo pasan avisos de error (event) y los reportes del propio SDK (client_report); nada de grabaciones ni adjuntos.
 */

let guion: string | null = null
export function servirVigia(_req: Request, res: Response) {
  if (guion === null) {
    try {
      guion = readFileSync(join(process.cwd(), 'dist', 'vigia.js'), 'utf8')
        .replace(/__BASE__/g, BASE)
        .replace(/__RELEASE__/g, (process.env.RAILWAY_GIT_COMMIT_SHA ?? '').slice(0, 12))
    } catch {
      guion = '/* vigilante sin construir (pnpm build) */'
    }
  }
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=600')
  res.send(guion)
}

const destino = (() => {
  const dsn = (process.env.SENTRY_DSN ?? '').trim()
  const m = dsn.match(/^https:\/\/([^@/]+)@([^/]+)\/(\d+)$/)
  return m ? { dsn, url: `https://${m[2]}/api/${m[3]}/envelope/?sentry_version=7&sentry_key=${m[1]}` } : null
})()
const PERMITIDOS = new Set(['event', 'client_report'])

/** Los errores de las pantallas también quedan en el registro interno (utils/registroErrores.ts), con o sin Sentry. */
function anotarDePantalla(cuerpo: string) {
  try {
    const salto = String.fromCharCode(10), lineas = cuerpo.split(salto)
    for (let i = 1; i + 1 < lineas.length; i += 2) {
      if (String((JSON.parse(lineas[i]) as { type?: unknown }).type ?? '') !== 'event') continue
      const ev = JSON.parse(lineas[i + 1]) as { exception?: { values?: { type?: string; value?: string; stacktrace?: { frames?: { filename?: string; function?: string; lineno?: number }[] } }[] }; message?: string | { formatted?: string }; request?: { url?: string }; tags?: Record<string, unknown>; level?: string }
      const x = ev.exception?.values?.[0]
      const msg = x ? `${x.type ?? 'Error'}: ${x.value ?? ''}` : typeof ev.message === 'string' ? ev.message : ev.message?.formatted ?? '(sin texto)'
      const marcos = (x?.stacktrace?.frames ?? []).slice(-6).reverse().map(f => `${f.function ?? '?'} (${String(f.filename ?? '').split('/').pop()}:${f.lineno ?? ''})`)
      const donde = String(ev.request?.url ?? '').replace(/^https?:\/\/[^/]+/, '').split('?')[0]
      registrarError({ nivel: ev.level === 'warning' ? 'aviso' : 'error', area: 'pantalla', mensaje: msg, detalle: { pagina: donde, pila: marcos.join(salto), ...(ev.tags ?? {}) } })
    }
  } catch { /* un aviso mal formado no se anota */ }
}

export async function tunelVigia(req: Request, res: Response) {
  const cuerpo = typeof req.body === 'string' ? req.body : ''
  if (cuerpo) anotarDePantalla(cuerpo)
  if (!destino || !cuerpo) { res.status(204).end(); return }
  try {
    const lineas = cuerpo.split('\n')
    const cabecera = JSON.parse(lineas[0]) as Record<string, unknown>
    // Después de la cabecera van parejas: la cabecera de cada parte (con su tipo) y su contenido.
    const partes: string[] = []
    for (let i = 1; i + 1 < lineas.length; i += 2) {
      const tipo = String((JSON.parse(lineas[i]) as { type?: unknown }).type ?? '')
      if (PERMITIDOS.has(tipo)) partes.push(lineas[i], lineas[i + 1])
    }
    if (!partes.length) { res.status(204).end(); return }
    const sobre = [JSON.stringify({ ...cabecera, dsn: destino.dsn }), ...partes].join('\n')
    const r = await fetch(destino.url, { method: 'POST', body: sobre, headers: { 'Content-Type': 'application/x-sentry-envelope' }, signal: AbortSignal.timeout(10_000) })
    res.status(r.ok ? 200 : 204).end()
  } catch (e) {
    logger.warn(`[vigia] aviso del navegador no reenviado: ${(e as Error).message}`)
    res.status(204).end()
  }
}
