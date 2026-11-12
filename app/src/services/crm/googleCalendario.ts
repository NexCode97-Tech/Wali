import crypto from 'node:crypto'
import { prisma } from '../../config/prisma'
import { cifrar, descifrar } from './cifrado'
import { logger } from '../../utils/logger'

/**
 * Google Calendar de cada persona (12-nov, maqueta aprobada «Recordatorios con Google Calendar»).
 *
 * Cada quien conecta su propia cuenta de Google con el mismo cliente OAuth del botón «Entrar con Google»
 * (GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET) y el mismo regreso autorizado (/api/auth/google/regreso). El único
 * permiso es `calendar.events`: crear, mover y borrar los eventos que Wali agenda; nunca se leen los demás.
 * El refresh token va cifrado (cifrado.ts) en crm_google_calendario y nunca sale del servidor.
 *
 * Cada recordatorio con `gcal: true` guarda su evento (`gev`), la persona dueña del calendario (`gu`) y, si Google
 * no lo dejó agendar, `gerr`. Programar crea el evento; posponer o cambiar el texto lo mueve; marcarlo hecho lo deja
 * en el calendario como hecho y sin aviso; volverlo pendiente le devuelve el aviso; borrarlo lo borra.
 */

export const ALCANCE_CALENDARIO = 'https://www.googleapis.com/auth/calendar.events'
const TOKEN = 'https://oauth2.googleapis.com/token'
const EVENTOS = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const TIEMPO = 10_000
const DURACION_MIN = 30
const AVISOS = new Set([10, 30, 60])

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})
const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export const calendarioListo = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)

/** La dirección de Google para dar el permiso del calendario. */
export function urlPermiso(regreso: string, estado: string, correo: string | null): string {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: regreso, response_type: 'code',
    scope: `openid email ${ALCANCE_CALENDARIO}`, state: estado,
    // offline + consent: Google entrega el refresh token aunque la persona ya haya entrado con Google antes.
    access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true',
    ...(correo ? { login_hint: correo } : {}),
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`
}

/** El correo que viene dentro del id_token (llega directo de Google por TLS, en la respuesta del token). */
function correoDeIdToken(idToken: string): string {
  try { return txt(obj(JSON.parse(Buffer.from(idToken.split('.')[1] ?? '', 'base64url').toString('utf8'))).email).toLowerCase() } catch { return '' }
}

export type ResultadoConexion = 'ok' | 'sin-permiso' | 'error'

/** Cambia el código de Google por el permiso y lo guarda cifrado para esa persona. */
export async function guardarConexion(userId: string, code: string, regreso: string): Promise<ResultadoConexion> {
  let j: Json
  try {
    const r = await fetch(TOKEN, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(15_000),
      body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: regreso, grant_type: 'authorization_code' }),
    })
    j = obj(await r.json().catch(() => ({})))
    if (!r.ok) { logger.warn({ evento: 'GCAL_TOKEN_FALLO', userId, estado: r.status, error: txt(j.error) }); return 'error' }
  } catch (e) { logger.warn({ evento: 'GCAL_TOKEN_FALLO', userId, err: (e as Error).message }); return 'error' }
  // En la pantalla de Google la persona puede desmarcar el permiso del calendario.
  if (!txt(j.scope).split(/\s+/).includes(ALCANCE_CALENDARIO)) return 'sin-permiso'
  const refresh = txt(j.refresh_token)
  if (!refresh) { logger.warn({ evento: 'GCAL_SIN_REFRESH', userId }); return 'error' }
  const correo = correoDeIdToken(txt(j.id_token)) || 'tu cuenta de Google'
  // Si ya tenía otra cuenta conectada, el permiso viejo se le devuelve a Google.
  const previo = await prisma.crmGoogleCalendario.findUnique({ where: { userId } })
  const secreto = cifrar({ refresh })
  await prisma.crmGoogleCalendario.upsert({ where: { userId }, create: { userId, correo, secreto }, update: { correo, secreto, conectadoAt: new Date() } })
  accesos.delete(userId)
  if (previo) void revocar(previo.secreto)
  logger.info({ evento: 'GCAL_CONECTADO', userId })
  return 'ok'
}

async function revocar(secreto: string) {
  try {
    const { refresh } = descifrar<{ refresh?: string }>(secreto)
    if (refresh) await fetch('https://oauth2.googleapis.com/revoke', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: refresh }), signal: AbortSignal.timeout(TIEMPO) })
  } catch { /* si Google no responde, igual queda desconectado aquí */ }
}

/** Quita la conexión: Wali deja de agendar y le devuelve el permiso a Google. Los eventos ya creados se quedan. */
export async function desconectar(userId: string): Promise<void> {
  const fila = await prisma.crmGoogleCalendario.findUnique({ where: { userId } })
  if (!fila) return
  await prisma.crmGoogleCalendario.delete({ where: { userId } }).catch(() => null)
  accesos.delete(userId)
  await revocar(fila.secreto)
  logger.info({ evento: 'GCAL_DESCONECTADO', userId })
}

export async function estadoConexion(userId: string): Promise<{ conectado: boolean; correo: string | null }> {
  const fila = await prisma.crmGoogleCalendario.findUnique({ where: { userId }, select: { correo: true } })
  return { conectado: !!fila, correo: fila?.correo ?? null }
}

// ─── Acceso a la API de Google ──────────────────────────────────────────────

const accesos = new Map<string, { token: string; hasta: number }>()

class SinConexion extends Error {}

async function tokenDe(userId: string): Promise<string> {
  const a = accesos.get(userId)
  if (a && Date.now() < a.hasta - 60_000) return a.token
  const fila = await prisma.crmGoogleCalendario.findUnique({ where: { userId } })
  if (!fila || !calendarioListo()) throw new SinConexion()
  let refresh = ''
  try { refresh = txt(descifrar<{ refresh?: string }>(fila.secreto).refresh) } catch { refresh = '' }
  if (!refresh) throw new SinConexion()
  const r = await fetch(TOKEN, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(TIEMPO),
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, refresh_token: refresh, grant_type: 'refresh_token' }),
  })
  const j = obj(await r.json().catch(() => ({})))
  if (!r.ok || !txt(j.access_token)) {
    // La persona quitó el permiso desde su cuenta de Google (o venció): queda desconectada.
    if (txt(j.error) === 'invalid_grant') { await prisma.crmGoogleCalendario.delete({ where: { userId } }).catch(() => null); logger.info({ evento: 'GCAL_PERMISO_RETIRADO', userId }); throw new SinConexion() }
    throw new Error(`token ${r.status} ${txt(j.error)}`)
  }
  accesos.set(userId, { token: txt(j.access_token), hasta: Date.now() + (Number(j.expires_in) || 3600) * 1000 })
  return txt(j.access_token)
}

async function google(userId: string, metodo: 'POST' | 'PATCH' | 'DELETE', ruta: string, cuerpo?: Json): Promise<Json> {
  const token = await tokenDe(userId)
  const r = await fetch(EVENTOS + ruta, {
    method: metodo, signal: AbortSignal.timeout(TIEMPO),
    headers: { Authorization: `Bearer ${token}`, ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
  })
  if (r.status === 401) accesos.delete(userId)
  // Ya no existe en Google (la persona lo borró allá): para borrar está bien; para mover se vuelve a crear.
  if ((r.status === 404 || r.status === 410) && metodo === 'DELETE') return {}
  if (!r.ok) { const e = new Error(`Google ${r.status}`) as Error & { estado?: number }; e.estado = r.status; throw e }
  return metodo === 'DELETE' ? {} : obj(await r.json().catch(() => ({})))
}

// ─── Recordatorios ↔ eventos ────────────────────────────────────────────────

export interface Contexto { convId: number; contacto: string; urlConv: string | null }

const fechaDe = (r: Json): Date | null => { const d = new Date(String(r.fecha ?? r.para ?? '')); return Number.isNaN(d.getTime()) ? null : d }
const avisoDe = (r: Json) => (AVISOS.has(Number(r.aviso)) ? Number(r.aviso) : 10)

function evento(r: Json, ctx: Contexto): Json {
  const ini = fechaDe(r)!
  const fin = new Date(ini.getTime() + DURACION_MIN * 60_000)
  const hecho = !!r.hecho
  return {
    summary: `${hecho ? '✓ ' : ''}${txt(r.t).slice(0, 200)} · ${ctx.contacto}`.slice(0, 300),
    description: `Recordatorio de seguimiento de Wali.${ctx.urlConv ? `\nAbrir la conversación: ${ctx.urlConv}` : ''}`,
    start: { dateTime: ini.toISOString(), timeZone: 'America/Bogota' },
    end: { dateTime: fin.toISOString(), timeZone: 'America/Bogota' },
    // Hecho: queda en el calendario, pero ya no avisa.
    reminders: { useDefault: false, overrides: hecho ? [] : [{ method: 'popup', minutes: avisoDe(r) }] },
    transparency: 'transparent',
    source: ctx.urlConv ? { title: 'Wali', url: ctx.urlConv } : undefined,
    extendedProperties: { private: { wali: '1', conv: String(ctx.convId) } },
  }
}

/** Le da id a los recordatorios que no tienen y conserva lo de Google que la pantalla todavía no conocía. */
export function unirRecs(guardados: unknown, nuevos: unknown[]): Json[] {
  const antes = new Map((Array.isArray(guardados) ? guardados : []).map(obj).filter(r => txt(r.id)).map(r => [txt(r.id), r]))
  return nuevos.map(obj).map(r => {
    const id = txt(r.id) || crypto.randomBytes(6).toString('base64url')
    const g = antes.get(id)
    const out: Json = { ...r, id }
    if (g) for (const k of ['gev', 'gu', 'gerr'] as const) { if (out[k] === undefined && g[k] !== undefined) out[k] = g[k] }
    // Lo de Google lo pone solo el servidor: un recordatorio nuevo no puede traer el evento de otro.
    if (!g) { delete out.gev; delete out.gu; delete out.gerr }
    return out
  })
}

const mismo = (a: Json, b: Json, k: string) => JSON.stringify(a[k] ?? null) === JSON.stringify(b[k] ?? null)

/**
 * Lleva a Google lo que cambió entre la lista guardada y la nueva. Devuelve, por id, los campos de Google que
 * cambiaron (para guardarlos), o null si no hubo nada que hacer. Nunca lanza: un fallo de Google queda en `gerr`.
 */
export async function sincronizar(antesCrudo: unknown, despues: Json[], editor: string, ctx: Contexto): Promise<Map<string, Json> | null> {
  const antes = new Map((Array.isArray(antesCrudo) ? antesCrudo : []).map(obj).filter(r => txt(r.id)).map(r => [txt(r.id), r]))
  const ids = new Set(despues.map(r => txt(r.id)))
  const cambios = new Map<string, Json>()
  const ahora = Date.now()

  for (const r of despues) {
    if (!r.gcal) continue
    const id = txt(r.id), a = antes.get(id), fecha = fechaDe(r)
    if (!fecha) continue
    try {
      if (!txt(r.gev)) {
        // Se agenda al programarlo, o al volver a intentarlo cuando cambia (si antes falló).
        const nuevo = !a || !mismo(a, r, 'fecha') || !mismo(a, r, 't') || !!a.hecho !== !!r.hecho || !a.gcal
        if (!nuevo || r.hecho || fecha.getTime() <= ahora) continue
        const dueno = txt(r.gu) || editor
        const e = await google(dueno, 'POST', '', evento(r, ctx))
        if (txt(e.id)) cambios.set(id, { gev: txt(e.id), gu: dueno, gerr: undefined })
        continue
      }
      if (!a) continue
      const cambio = !mismo(a, r, 'fecha') || !mismo(a, r, 't') || !!a.hecho !== !!r.hecho || !mismo(a, r, 'aviso')
      if (!cambio) continue
      const dueno = txt(r.gu) || editor
      try {
        await google(dueno, 'PATCH', `/${encodeURIComponent(txt(r.gev))}`, evento(r, ctx))
        if (r.gerr) cambios.set(id, { gerr: undefined })
      } catch (e) {
        // Lo borraron en Google: si sigue pendiente, se vuelve a crear.
        if ([404, 410].includes((e as { estado?: number }).estado ?? 0) && !r.hecho && fecha.getTime() > ahora) {
          const n = await google(dueno, 'POST', '', evento(r, ctx))
          cambios.set(id, { gev: txt(n.id) || undefined, gu: dueno, gerr: undefined })
        } else if ([404, 410].includes((e as { estado?: number }).estado ?? 0)) cambios.set(id, { gev: undefined })
        else throw e
      }
    } catch (e) {
      const sin = e instanceof SinConexion
      if (!sin) logger.warn({ evento: 'GCAL_SYNC_FALLO', convId: ctx.convId, err: (e as Error).message })
      cambios.set(id, { gerr: sin ? 'sin-conexion' : 'google' })
    }
  }

  // Borrados en Wali: también de Google.
  for (const [id, a] of antes) {
    if (ids.has(id) || !txt(a.gev) || !txt(a.gu)) continue
    try { await google(txt(a.gu), 'DELETE', `/${encodeURIComponent(txt(a.gev))}`) } catch (e) {
      if (!(e instanceof SinConexion)) logger.warn({ evento: 'GCAL_BORRAR_FALLO', convId: ctx.convId, err: (e as Error).message })
    }
  }
  return cambios.size ? cambios : null
}

/** Aplica a una lista los campos de Google que devolvió `sincronizar` (undefined = quitarlo). */
export function aplicarCambios(recs: unknown, cambios: Map<string, Json>): Json[] {
  return (Array.isArray(recs) ? recs : []).map(obj).map(r => {
    const c = cambios.get(txt(r.id)); if (!c) return r
    const out = { ...r }
    for (const [k, v] of Object.entries(c)) { if (v === undefined) delete out[k]; else out[k] = v }
    return out
  })
}
