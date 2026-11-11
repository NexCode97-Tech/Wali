import { createHmac, randomBytes, randomUUID } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import type { CrmMensaje } from '@prisma/client'
import { prismaGlobal, alCrearContacto } from './bd'
import { espacioOpcional } from './espacio'
import { alEmitirConv, alEmitirMsg } from './tiempoReal'
import { cifrar, descifrar } from './cifrado'
import { NotFoundError, ValidationError } from '../../utils/errors'
import { logger } from '../../utils/logger'

/**
 * Webhooks de la API de Wali (11-nov): Wali le avisa a otro sistema del cliente cuando pasa algo en su espacio.
 *
 * - Eventos: mensaje.recibido, conversacion.asignada, conversacion.finalizada, conversacion.etapa y contacto.creado.
 *   La API no envía mensajes (decisión del usuario, 11-nov).
 * - Cada aviso va por POST con JSON y firmado: `Wali-Firma: t=<segundos>,v1=<HMAC-SHA256 de "t.cuerpo" con el
 *   secreto>`. El secreto (`whsec_…`) se muestra completo una sola vez y en la base va cifrado.
 * - Los avisos van a una cola (crm_api_envios): si el sistema no responde con 2xx se reintenta a 1, 5, 30, 120 y 360
 *   minutos. Tras 20 fallas seguidas el webhook se pausa solo hasta que un administrador lo reactive.
 * - Solo direcciones https públicas: nada de localhost, redes privadas ni direcciones internas (también se revisa al
 *   enviar, con la IP a la que resuelve el nombre), sin seguir redirecciones.
 */

export const EVENTOS = ['mensaje.recibido', 'conversacion.asignada', 'conversacion.finalizada', 'conversacion.etapa', 'contacto.creado'] as const
type Evento = typeof EVENTOS[number] | 'prueba'
type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})

const MAX_WEBHOOKS = 10
const REINTENTOS_MIN = [1, 5, 30, 120, 360]
const TOPE_FALLAS = 20

// ─── Direcciones permitidas ──────────────────────────────────────────────────

function ipPrivada(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number)
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  }
  const x = ip.toLowerCase()
  if (x.startsWith('::ffff:')) return ipPrivada(x.slice(7))
  return x === '::1' || x === '::' || x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe80')
}

/** Revisa la forma de la dirección (al crear el webhook). */
function urlValida(crudo: string): URL {
  let u: URL
  try { u = new URL(crudo.trim()) } catch { throw new ValidationError('Escribe una dirección completa, por ejemplo https://tu-sistema.com/wali') }
  if (u.protocol !== 'https:') throw new ValidationError('La dirección debe empezar por https://')
  if (u.username || u.password) throw new ValidationError('La dirección no puede llevar usuario ni contraseña.')
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || (isIP(h) && ipPrivada(h))) throw new ValidationError('Esa dirección no es pública. Usa la de tu sistema en internet.')
  if (u.toString().length > 500) throw new ValidationError('La dirección es demasiado larga.')
  return u
}

/** Al enviar: el nombre tiene que resolver solo a IP públicas. */
async function destinoPublico(u: URL): Promise<boolean> {
  const h = u.hostname.replace(/^\[|\]$/g, '')
  if (isIP(h)) return !ipPrivada(h)
  try { const ips = await lookup(h, { all: true }); return ips.length > 0 && ips.every(i => !ipPrivada(i.address)) } catch { return false }
}

// ─── Quién escucha cada evento (en memoria un minuto) ────────────────────────

type Activo = { id: string; eventos: string[] }
const cache = new Map<string, { en: number; l: Activo[] }>()
async function activos(espacioId: string): Promise<Activo[]> {
  const c = cache.get(espacioId)
  if (c && Date.now() - c.en < 60_000) return c.l
  const l = await prismaGlobal.crmApiWebhook.findMany({ where: { espacioId, borradoEn: null, pausadoEn: null }, select: { id: true, eventos: true } })
  cache.set(espacioId, { en: Date.now(), l })
  return l
}
const olvidar = (espacioId: string) => cache.delete(espacioId)

/** Deja el aviso en la cola de cada webhook del espacio que escucha ese evento. Nunca lanza. */
async function encolar(espacioId: string | null, evento: Evento, data: Json, soloWebhook?: string): Promise<void> {
  if (!espacioId) return
  try {
    const l = soloWebhook ? [{ id: soloWebhook, eventos: [evento] }] : (await activos(espacioId)).filter(w => w.eventos.includes(evento))
    if (!l.length) return
    const creado = new Date().toISOString()
    await prismaGlobal.crmApiEnvio.createMany({
      data: l.map(w => { const id = randomUUID(); return { id, webhookId: w.id, evento, cuerpo: { id, evento, creado, espacio: espacioId, data } as never } }),
    })
    setImmediate(() => { void entregarPendientes() })
  } catch (e) { logger.warn(`[API webhooks] no se pudo encolar ${evento}: ${(e as Error).message}`) }
}

// ─── Los eventos ─────────────────────────────────────────────────────────────

alCrearContacto.push(k => {
  void encolar(String(k.espacioId ?? '') || espacioOpcional(), 'contacto.creado', {
    contacto: { id: k.id, nombre: k.nombre ?? null, telefono: k.telefono ?? null, correo: k.correo ?? null, canal: k.canal ?? null, creado: k.createdAt ?? null },
  })
})

alEmitirMsg.push((convId: number, m: CrmMensaje) => {
  if (m.tipo !== 'in') return
  const d = obj(m.datos), cuerpo = d.in
  const texto = typeof cuerpo === 'string' ? cuerpo : typeof obj(cuerpo).txt === 'string' ? obj(cuerpo).txt : null
  const archivo = obj(cuerpo).url ?? obj(d.file).url ?? null
  void encolar(espacioOpcional(), 'mensaje.recibido', { conversacionId: convId, mensaje: { id: m.id, tipo: m.tipo, texto, archivo, en: m.createdAt } })
})

/**
 * Los cambios de una conversación se sacan comparando con la última foto que se guardó (en `extra._wh`). Solo se
 * mira si el espacio tiene algún webhook de conversaciones; sin foto previa solo se guarda la foto.
 */
alEmitirConv.push(conv => { void cambiosDeConversacion(conv) })
async function cambiosDeConversacion(conv: Json) {
  const espacioId = espacioOpcional()
  if (!espacioId) return
  try {
    const l = await activos(espacioId)
    if (!l.some(w => w.eventos.some(e => e.startsWith('conversacion.')))) return
    const id = Number(conv.id), etapa = Array.isArray(conv.etq) ? (conv.etq[0] ?? null) : null
    const ahora = { a: (conv.asigId as string | null) ?? null, e: String(conv.est ?? ''), t: etapa as string | null, q: (conv.equipo as string | null) ?? null }
    const fila = await prismaGlobal.crmConversacion.findUnique({ where: { id }, select: { extra: true, espacioId: true } })
    if (!fila || fila.espacioId !== espacioId) return
    const antes = obj(obj(fila.extra)._wh)
    if (antes.a === ahora.a && antes.e === ahora.e && antes.t === ahora.t && antes.q === ahora.q) return
    await prismaGlobal.$executeRaw`UPDATE crm_conversaciones SET extra = COALESCE(extra, '{}'::jsonb) || ${JSON.stringify({ _wh: ahora })}::jsonb WHERE id = ${id}`
    if (!('e' in antes)) return
    const conversacion = { id, asignadoId: ahora.a, equipo: ahora.q || 'Ventas', estado: ahora.e, etapa: ahora.t, contactoId: conv.contactoId ?? null }
    if (antes.a !== ahora.a || antes.q !== ahora.q) await encolar(espacioId, 'conversacion.asignada', { conversacion, antes: { asignadoId: antes.a ?? null, equipo: antes.q ?? null } })
    if (antes.e !== ahora.e && ahora.e === 'finalizadas') await encolar(espacioId, 'conversacion.finalizada', { conversacion })
    if (antes.t !== ahora.t) await encolar(espacioId, 'conversacion.etapa', { conversacion, antes: { etapa: antes.t ?? null } })
  } catch (e) { logger.warn(`[API webhooks] cambios de la conversación: ${(e as Error).message}`) }
}

// ─── Entrega ─────────────────────────────────────────────────────────────────

async function enviar(url: string, secreto: string, cuerpo: Json, evento: string, id: string): Promise<{ ok: boolean; estado: number | null; error: string | null }> {
  const u = new URL(url)
  if (!(await destinoPublico(u))) return { ok: false, estado: null, error: 'La dirección no resuelve a una IP pública.' }
  const texto = JSON.stringify(cuerpo), t = Math.floor(Date.now() / 1000)
  const firma = createHmac('sha256', secreto).update(`${t}.${texto}`).digest('hex')
  try {
    const r = await fetch(u, {
      method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(10_000), body: texto,
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Wali-Webhooks/1', 'Wali-Evento': evento, 'Wali-Entrega': id, 'Wali-Firma': `t=${t},v1=${firma}` },
    })
    void r.body?.cancel().catch(() => {})
    return r.status >= 200 && r.status < 300 ? { ok: true, estado: r.status, error: null } : { ok: false, estado: r.status, error: `Respondió ${r.status}` }
  } catch (e) {
    const m = (e as Error).name === 'TimeoutError' ? 'No respondió en 10 segundos.' : 'No se pudo conectar con la dirección.'
    return { ok: false, estado: null, error: m }
  }
}

let entregando = false
/** Manda los avisos que tocan. No se solapa consigo misma y reclama cada envío para que dos servidores no lo dupliquen. */
export async function entregarPendientes(): Promise<number> {
  if (entregando) return 0
  entregando = true
  let n = 0
  try {
    const l = await prismaGlobal.crmApiEnvio.findMany({ where: { estado: 'pendiente', proximo: { lte: new Date() } }, orderBy: { proximo: 'asc' }, take: 50, include: { webhook: true } })
    for (const e of l) {
      const tomado = await prismaGlobal.crmApiEnvio.updateMany({ where: { id: e.id, estado: 'pendiente', intentos: e.intentos }, data: { intentos: e.intentos + 1, proximo: new Date(Date.now() + 5 * 60_000) } })
      if (!tomado.count) continue
      const w = e.webhook
      if (w.borradoEn || (w.pausadoEn && e.evento !== 'prueba')) { await prismaGlobal.crmApiEnvio.update({ where: { id: e.id }, data: { estado: 'fallido', error: w.borradoEn ? 'El webhook se borró.' : 'El webhook está pausado.' } }); continue }
      let secreto = ''
      try { secreto = String(descifrar<{ s?: string }>(w.secreto).s ?? '') } catch { /* sin secreto no se manda */ }
      const r = secreto ? await enviar(w.url, secreto, obj(e.cuerpo), e.evento, e.id) : { ok: false, estado: null, error: 'No se pudo leer el secreto.' }
      n++
      if (r.ok) {
        await prismaGlobal.crmApiEnvio.update({ where: { id: e.id }, data: { estado: 'hecho', error: null } })
        await prismaGlobal.crmApiWebhook.update({ where: { id: w.id }, data: { fallas: 0, ultimoEnvio: new Date(), ultimoEstado: r.estado, ultimoError: null } })
        continue
      }
      const intentos = e.intentos + 1, espera = REINTENTOS_MIN[intentos - 1]
      await prismaGlobal.crmApiEnvio.update({ where: { id: e.id }, data: espera ? { proximo: new Date(Date.now() + espera * 60_000), error: r.error } : { estado: 'fallido', error: r.error } })
      const fallas = w.fallas + 1, pausar = fallas >= TOPE_FALLAS && !w.pausadoEn
      await prismaGlobal.crmApiWebhook.update({ where: { id: w.id }, data: { fallas, ultimoEnvio: new Date(), ultimoEstado: r.estado, ultimoError: r.error, ...(pausar ? { pausadoEn: new Date() } : {}) } })
      if (pausar) { olvidar(w.espacioId); logger.warn(`[API webhooks] ${w.id} pausado tras ${fallas} fallas seguidas`) }
    }
    // Limpieza: lo entregado se guarda 7 días y lo fallido 30.
    if (Math.random() < 0.05) {
      await prismaGlobal.crmApiEnvio.deleteMany({ where: { OR: [{ estado: 'hecho', createdAt: { lt: new Date(Date.now() - 7 * 864e5) } }, { estado: 'fallido', createdAt: { lt: new Date(Date.now() - 30 * 864e5) } }] } })
    }
  } finally { entregando = false }
  return n
}

// ─── Administrar (Ajustes del CRM › API, solo administradores) ──────────────

const aFront = (w: { id: string; nombre: string; url: string; eventos: string[]; fallas: number; pausadoEn: Date | null; ultimoEnvio: Date | null; ultimoEstado: number | null; ultimoError: string | null; createdAt: Date }) => ({
  id: w.id, nombre: w.nombre, url: w.url, eventos: w.eventos, pausado: !!w.pausadoEn, fallas: w.fallas,
  ultimoEnvio: w.ultimoEnvio, ultimoEstado: w.ultimoEstado, ultimoError: w.ultimoError, creado: w.createdAt,
})

export async function listarWebhooks(espacioId: string) {
  return (await prismaGlobal.crmApiWebhook.findMany({ where: { espacioId, borradoEn: null }, orderBy: { createdAt: 'asc' } })).map(aFront)
}

/** Crea el webhook y devuelve el secreto completo: es la única vez que sale del servidor. */
export async function crearWebhook(espacioId: string, d: { nombre: string; url: string; eventos: string[] }, userId: string) {
  const nombre = d.nombre.trim().slice(0, 60)
  if (nombre.length < 2) throw new ValidationError('Ponle un nombre al webhook para reconocerlo en la lista.')
  const u = urlValida(d.url)
  const eventos = [...new Set(d.eventos)].filter(e => (EVENTOS as readonly string[]).includes(e))
  if (!eventos.length) throw new ValidationError('Elige al menos un evento.')
  if ((await prismaGlobal.crmApiWebhook.count({ where: { espacioId, borradoEn: null } })) >= MAX_WEBHOOKS) throw new ValidationError(`Este espacio ya tiene ${MAX_WEBHOOKS} webhooks. Borra alguno que no uses antes de crear otro.`)
  const secreto = 'whsec_' + randomBytes(24).toString('base64url')
  const w = await prismaGlobal.crmApiWebhook.create({ data: { espacioId, nombre, url: u.toString(), eventos, secreto: cifrar({ s: secreto }), creadoPor: userId } })
  olvidar(espacioId)
  return { ...aFront(w), secreto }
}

const delEspacio = async (espacioId: string, id: string) => {
  const w = await prismaGlobal.crmApiWebhook.findFirst({ where: { id, espacioId, borradoEn: null } })
  if (!w) throw new NotFoundError('Ese webhook ya no existe.')
  return w
}

export async function borrarWebhook(espacioId: string, id: string) {
  const w = await delEspacio(espacioId, id)
  await prismaGlobal.crmApiWebhook.update({ where: { id }, data: { borradoEn: new Date() } })
  olvidar(espacioId)
  return { id, nombre: w.nombre }
}

export async function reactivarWebhook(espacioId: string, id: string) {
  await delEspacio(espacioId, id)
  const w = await prismaGlobal.crmApiWebhook.update({ where: { id }, data: { pausadoEn: null, fallas: 0 } })
  olvidar(espacioId)
  return aFront(w)
}

/** Manda un aviso de prueba en el momento y dice qué respondió el sistema. */
export async function probarWebhook(espacioId: string, id: string) {
  const w = await delEspacio(espacioId, id)
  let secreto = ''
  try { secreto = String(descifrar<{ s?: string }>(w.secreto).s ?? '') } catch { /* abajo */ }
  if (!secreto) throw new ValidationError('No se pudo leer el secreto de este webhook. Bórralo y créalo de nuevo.')
  const envio = randomUUID()
  const r = await enviar(w.url, secreto, { id: envio, evento: 'prueba', creado: new Date().toISOString(), espacio: espacioId, data: { mensaje: 'Aviso de prueba de Wali' } }, 'prueba', envio)
  await prismaGlobal.crmApiWebhook.update({ where: { id }, data: { ultimoEnvio: new Date(), ultimoEstado: r.estado, ultimoError: r.error, ...(r.ok ? { fallas: 0 } : {}) } })
  return r
}
