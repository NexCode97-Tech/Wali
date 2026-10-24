import type { CrmLinea, Prisma } from '@prisma/client'
import { prisma } from './bd'
import { credDeLinea } from './credenciales'
import { destinoWa, graph, VEINTICUATRO_H } from './whatsapp'
import { espacioActual } from './espacio'
import { emitirAPersona, emitirConv, emitirCrm, emitirMsg } from './tiempoReal'
import { guardarMensaje } from './salientes'
import { nombreDe } from './usuarios'
import { logger } from '../../utils/logger'
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors'

/**
 * Llamadas por WhatsApp en vivo (Calling API de Meta, maquetas aprobadas «Llamadas», 24-oct). El audio va directo
 * entre el navegador de quien atiende y WhatsApp por WebRTC; el servidor solo pasa las ofertas y respuestas SDP:
 *  - Entrante: el aviso `calls` connect trae la oferta del cliente → suena en la ficha de quienes ven la conversación →
 *    quien contesta manda su respuesta → pre_accept y accept con la misma (Meta la exige igual) → los demás dejan de ver la tarjeta.
 *  - Saliente: con el permiso del cliente, el navegador arma la oferta → connect → el aviso connect trae la respuesta.
 *  - Al terminar (aviso terminate) queda la llamada en el chat con su duración; la grabación y la nota las sube el
 *    navegador de quien atendió (Meta no graba) y se juntan con el registro, lleguen en el orden que lleguen.
 * El estado de las llamadas en curso vive en memoria: una llamada dura minutos y el servidor es uno.
 */

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})
const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

interface Viva {
  id: string
  espacio: string
  lineaId: string
  convId: number
  dir: 'in' | 'out'
  /** Oferta del cliente (entrante), para quien la conteste. */
  oferta?: string
  /** Quien la contestó (entrante) o la hizo (saliente). */
  userId: string | null
  empezo: number
  contestada: number | null
  /** Lo que manda el navegador al colgar (grabación y nota), por si llega antes que el aviso de Meta. */
  cierre?: { audio?: string; nota?: string; sinGrabar?: string }
  /** El registro ya quedó en el chat. */
  msgId?: string
}

const vivas = new Map<string, Viva>()
/** Llamadas terminadas hace poco: el cierre del navegador puede llegar después del aviso de Meta. */
const recientes = new Map<string, Viva>()
const recordar = (v: Viva) => { recientes.set(v.id, v); setTimeout(() => { if (recientes.get(v.id) === v) recientes.delete(v.id) }, 10 * 60_000).unref?.() }

function deEspacio(id: string): Viva {
  const v = vivas.get(id) ?? recientes.get(id)
  if (!v || v.espacio !== espacioActual()) throw new NotFoundError('Esa llamada ya terminó')
  return v
}

async function lineaDe(v: { lineaId: string }): Promise<CrmLinea> {
  const l = await prisma.crmLinea.findUnique({ where: { id: v.lineaId } })
  if (!l) throw new NotFoundError('La línea de esa llamada ya no está en el CRM')
  return l
}

/** POST /<PHONE_NUMBER_ID>/calls con la acción dada. */
async function accion(l: CrmLinea, cuerpo: Json): Promise<Json> {
  return graph<Json>(`/${l.phoneNumberId}/calls`, { cred: await credDeLinea(l), method: 'POST', body: { messaging_product: 'whatsapp', ...cuerpo } })
}

/** Lo que la pantalla necesita de una llamada en curso. */
const aFront = (v: Viva) => ({ id: v.id, convId: v.convId, dir: v.dir, linea: v.lineaId, por: v.userId, empezo: v.empezo, contestada: v.contestada })

/** Las llamadas en curso del espacio (al abrir el CRM con una sonando). */
export function llamadasEnCurso(): Json[] {
  const e = espacioActual()
  return [...vivas.values()].filter(v => v.espacio === e).map(v => ({ ...aFront(v), ...(v.dir === 'in' && !v.userId ? { oferta: v.oferta } : {}) }))
}

// ─── Avisos de Meta (webhook `calls`) ────────────────────────────────────────

/** El cliente llama: suena en la ficha de quienes ven la conversación. */
export function entrante(l: CrmLinea, callId: string, convId: number, oferta: string, cuando: Date) {
  if (vivas.has(callId)) return
  const v: Viva = { id: callId, espacio: espacioActual(), lineaId: l.id, convId, dir: 'in', oferta, userId: null, empezo: cuando.getTime(), contestada: null }
  vivas.set(callId, v)
  emitirCrm({ tipo: 'llamada', convId: v.convId, fase: 'suena', llamada: { ...aFront(v), oferta } })
}

/** Respuesta del cliente a una llamada nuestra: el SDP va solo a quien llamó. */
export function respuesta(callId: string, sdp: string) {
  const v = vivas.get(callId)
  if (!v || !v.userId) return
  emitirAPersona(v.userId, { tipo: 'llamada', fase: 'respuesta', llamada: aFront(v), sdp })
}

/** RINGING, ACCEPTED o REJECTED de una llamada nuestra. */
export function estadoSaliente(callId: string, estado: string) {
  const v = vivas.get(callId)
  if (!v) return
  if (estado === 'ACCEPTED' && !v.contestada) v.contestada = Date.now()
  emitirCrm({ tipo: 'llamada', convId: v.convId, fase: estado === 'RINGING' ? 'timbra' : estado === 'ACCEPTED' ? 'contesto' : 'rechazo', llamada: aFront(v) })
}

/** La llamada terminó (colgó cualquiera, no contestó o falló): queda el registro en el chat. */
export async function terminada(callId: string, datos: { duracion: number | null; error: string | null }) {
  const v = vivas.get(callId)
  if (!v) return
  vivas.delete(callId)
  recordar(v)
  emitirCrm({ tipo: 'llamada', convId: v.convId, fase: 'fin', llamada: aFront(v), error: datos.error })
  const dur = datos.duracion ?? 0
  const estado = dur > 0 ? 'ok' : v.dir === 'in' ? 'perdida' : 'nocontesto'
  const call: Json = { id: v.id, dir: v.dir, estado, dur, linea: v.lineaId, ...cierreDatos(v) }
  if (datos.error && !dur) call.error = datos.error.slice(0, 200)
  try {
    const m = await guardarMensaje(v.convId, { call }, { autorId: estado === 'ok' ? v.userId : null, por: null })
    v.msgId = m.id
  } catch (e) {
    logger.error(`[CRM llamadas] no se pudo guardar el registro de ${callId}: ${(e as Error).message}`)
  }
}

const cierreDatos = (v: Viva): Json => {
  const c = v.cierre ?? {}
  return { ...(c.audio ? { audio: c.audio } : {}), ...(c.nota ? { nota: c.nota } : {}), ...(c.sinGrabar ? { sinGrabar: c.sinGrabar } : {}) }
}

// ─── Lo que hace quien atiende ───────────────────────────────────────────────

/** Contestar una entrante con la respuesta SDP del navegador. La primera persona que contesta se la queda. */
export async function contestar(callId: string, userId: string, sdp: string) {
  const v = deEspacio(callId)
  if (!vivas.has(callId)) throw new NotFoundError('Esa llamada ya terminó')
  if (v.dir !== 'in') throw new ValidationError('Esa llamada no es entrante')
  if (v.userId && v.userId !== userId) throw new ConflictError(`${(await nombreDe(v.userId)) ?? 'Otra persona'} ya contestó esta llamada`)
  v.userId = userId
  const l = await lineaDe(v)
  try {
    // pre_accept deja que el audio empiece a conectar; accept con la misma respuesta (Meta las compara).
    await accion(l, { call_id: callId, action: 'pre_accept', session: { sdp_type: 'answer', sdp } })
    await accion(l, { call_id: callId, action: 'accept', session: { sdp_type: 'answer', sdp } })
  } catch (e) {
    v.userId = null
    throw e
  }
  v.contestada = Date.now()
  emitirCrm({ tipo: 'llamada', convId: v.convId, fase: 'contestada', llamada: aFront(v) })
}

export async function rechazar(callId: string) {
  const v = deEspacio(callId)
  await accion(await lineaDe(v), { call_id: callId, action: 'reject' })
}

/** Colgar (o cancelar la que está timbrando). Meta pide terminate aunque el audio ya se haya cortado. */
export async function colgar(callId: string) {
  const v = deEspacio(callId)
  if (!vivas.has(callId)) return
  await accion(await lineaDe(v), { call_id: callId, action: 'terminate' })
}

/** Lo que manda el navegador de quien atendió al colgar: la grabación (ya en la Nube) y la nota. */
export async function cierre(callId: string, userId: string, c: { audio?: string; nota?: string; sinGrabar?: string }) {
  const v = deEspacio(callId)
  if (v.userId !== userId) throw new ValidationError('Esa llamada la atendió otra persona')
  v.cierre = c
  if (!v.msgId) return // el aviso de Meta todavía no llega: se junta al guardar el registro
  const m = await prisma.crmMensaje.findUnique({ where: { id: v.msgId } })
  if (!m) return
  const datos = obj(m.datos)
  const f = await prisma.crmMensaje.update({ where: { id: m.id }, data: { datos: { ...datos, call: { ...obj(datos.call), ...cierreDatos(v) } } as Prisma.InputJsonValue } })
  emitirMsg(f.conversacionId, f)
}

/** Llamar al cliente con la oferta SDP del navegador. Devuelve el id de la llamada. */
export async function llamar(convId: number, userId: string, sdp: string): Promise<Json> {
  const conv = await prisma.crmConversacion.findUnique({ where: { id: convId }, include: { contacto: true, linea: true } })
  if (!conv) throw new NotFoundError('Esa conversación ya no existe')
  if (conv.canal !== 'wa' || !conv.linea) throw new ValidationError('Las llamadas van por WhatsApp: esta conversación no tiene una línea de WhatsApp')
  const r = await accion(conv.linea, { ...destinoWa(conv.contacto), action: 'connect', session: { sdp_type: 'offer', sdp } })
  const id = txt(obj((r.calls as Json[] | undefined)?.[0]).id)
  if (!id) throw new ValidationError('Meta no devolvió el id de la llamada')
  const v: Viva = { id, espacio: espacioActual(), lineaId: conv.linea.id, convId, dir: 'out', userId, empezo: Date.now(), contestada: null }
  vivas.set(id, v)
  emitirCrm({ tipo: 'llamada', convId: v.convId, fase: 'llamando', llamada: aFront(v) })
  return aFront(v)
}

// ─── Permiso del cliente para llamarlo ───────────────────────────────────────

/** Estado del permiso en Meta (GET /<PHONE_NUMBER_ID>/call_permissions) y si se puede pedir o llamar ya. */
export async function permiso(convId: number): Promise<Json> {
  const conv = await prisma.crmConversacion.findUnique({ where: { id: convId }, include: { contacto: true, linea: true } })
  if (!conv || conv.canal !== 'wa' || !conv.linea) throw new ValidationError('Las llamadas van por WhatsApp: esta conversación no tiene una línea de WhatsApp')
  const k = conv.contacto
  const r = await graph<Json>(`/${conv.linea.phoneNumberId}/call_permissions`, { cred: await credDeLinea(conv.linea), query: k.telefono ? { user_wa_id: k.telefono } : { recipient: k.waUid ?? '' } })
  const p = obj(r.permission)
  const acciones = Array.isArray(r.actions) ? r.actions as Json[] : []
  const puede = (n: string) => acciones.find(a => a.action_name === n)?.can_perform_action === true
  const vence = Number(p.expiration_time ?? p.expiration ?? 0) || null
  // La ventana de 24 h decide si la solicitud sale gratis como mensaje o como plantilla.
  const otra = await prisma.crmConversacion.aggregate({ where: { contactoId: conv.contactoId, lineaId: conv.lineaId }, _max: { ultimoEntranteAt: true } })
  const entrante = Math.max(conv.ultimoEntranteAt?.getTime() ?? 0, otra._max.ultimoEntranteAt?.getTime() ?? 0)
  return {
    estado: txt(p.status) || 'no_permission',
    vence: vence ? new Date(vence * 1000).toISOString() : null,
    puedePedir: puede('send_call_permission_request'),
    puedeLlamar: puede('start_call'),
    ventana: !!entrante && Date.now() - entrante <= VEINTICUATRO_H,
  }
}

/** Manda la solicitud de permiso para llamar: queda en el chat como «Solicitud para llamar» y sale por WhatsApp. */
export async function pedirPermiso(convId: number, userId: string, texto: string) {
  return guardarMensaje(convId, { out: texto, permisoLlamada: true }, { autorId: userId })
}

/**
 * La respuesta del cliente a la solicitud (mensaje interactive call_permission_reply): queda en el contacto, en el
 * chat como aviso y la solicitud cambia su estado. `de` es el wamid de la solicitud (context.id).
 */
export async function respuestaPermiso(convId: number, contactoId: number, nombre: string, r: { acepta: boolean; permanente: boolean; vence: number | null; de: string | null; waId: string }, cuando: Date) {
  const k = await prisma.crmContacto.findUnique({ where: { id: contactoId } })
  // Meta reintenta el aviso: la misma respuesta no se anota dos veces.
  if (!k || obj(obj(k.extra).permisoLlamadas).waId === r.waId) return
  const permisoLlamadas = { acepta: r.acepta, permanente: r.permanente, vence: r.vence ? new Date(r.vence * 1000).toISOString() : null, cuando: cuando.toISOString(), waId: r.waId }
  await prisma.crmContacto.update({ where: { id: k.id }, data: { extra: { ...obj(k.extra), permisoLlamadas } as Prisma.InputJsonValue } })
  if (r.de) {
    const sol = await prisma.crmMensaje.findFirst({ where: { waId: r.de, conversacionId: convId } })
    if (sol) {
      const f = await prisma.crmMensaje.update({ where: { id: sol.id }, data: { datos: { ...obj(sol.datos), permisoResp: r.acepta ? 'acepto' : 'rechazo' } as Prisma.InputJsonValue } })
      emitirMsg(convId, f)
    }
  }
  const quien = nombre || 'El cliente'
  const fecha = r.vence ? new Date(r.vence * 1000).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' }) : ''
  const t = !r.acepta ? `${quien} no aceptó las llamadas por ahora`
    : r.permanente ? `${quien} aceptó tus llamadas · puedes llamarle cuando quieras`
    : `${quien} aceptó tus llamadas${fecha ? ` · puedes llamarle hasta el ${fecha}` : ''}`
  await guardarMensaje(convId, { ev: r.acepta ? 'check' : 'block', t, permiso: r.acepta ? 'ok' : 'no' }, { autorId: null })
  await emitirConv(convId)
}
