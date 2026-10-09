import type { CrmMensaje } from '@prisma/client'
import { prisma } from './bd'
import { logger } from '../../utils/logger'
import { broadcastUsuarios } from '../../utils/sseManager'
import { prisma as base } from '../../config/prisma'
import { alcanceDePersona, genteQueLidera, veConv, veContactoEn, type Alcance } from './alcance'
import { leerEquipos } from './equipos'
import { cargarConv, msgAFront } from './formas'
import { enEspacio, espacioOpcional, usuariosDeEspacio } from './espacio'

/**
 * Tiempo real del CRM: un solo evento `crm` con `{tipo, …, por}` (docs/crm/CONTRATO-CRM.md, sección 2). `por` es
 * quien causó el cambio, o null si vino de afuera (WhatsApp, un proceso).
 *
 * Desde el 29-sep (roles dentro de los equipos) cada evento sale según el alcance de cada persona del espacio
 * (alcance.ts), no por su rol de plataforma: a Ventas ya no le llega todo.
 * - `{tipo:'conv', conv}`: a quien ve la conversación; a los demás, `{tipo:'conv-borrada', id}` (así se le va a
 *   quien se la quitaron, la pasaron a otro equipo o se volvió «solo líder»).
 * - Cualquier evento con `convId` (`msg`, `msg-borrado`…): a quien ve esa conversación; si ya no existe, a nadie.
 * - `{tipo:'contacto'}`: a quien ve ese contacto (su dueño, sus conversaciones y la gente de sus líderes).
 * - `ajuste`: la base de conocimiento (`kb`) solo a quien tiene la configuración general; las claves internas
 *   (`_…`) a nadie; `difusionesEstado` a la configuración general, a los líderes y a los administradores sin
 *   equipo; lo demás (también `equipos`) a todos.
 * - `conexiones` e `integraciones`: solo a la configuración general. El resto (`conv-borrada`, `pref`, `linea`…):
 *   a todos.
 * - `{tipo:'alcance', alcance}` (emitirAlcance): directo a quien le cambió el rol en un equipo o salió del CRM.
 *
 * Los eventos salen en el orden en que se emitieron (una sola cola), aunque algunos tengan que consultar la base
 * antes de salir.
 */

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})

let cola: Promise<void> = Promise.resolve()
function enOrden(tarea: () => Promise<void> | void) {
  cola = cola.then(tarea).catch(e => logger.warn(`[CRM tiempo real] ${(e as Error)?.message ?? e}`))
}

/**
 * Cada evento sale solo para la gente del espacio de trabajo donde pasó. La lista se
 * guarda 30 s por espacio para no ir a la base en cada mensaje.
 */
const genteDe = new Map<string, { en: number; ids: Set<string> }>()
/**
 * Sube cada vez que se olvida lo guardado (olvidarGenteCrm). Una lectura que empezó antes y termina después no se guarda:
 * sería la de antes del cambio y quedaría 30 s (la gente) o 15 s (los alcances).
 */
let generacion = 0
async function genteDelEspacio(espacio: string): Promise<Set<string>> {
  const c = genteDe.get(espacio)
  if (c && Date.now() - c.en < 30_000) return c.ids
  const gen = generacion
  const ids = new Set(await usuariosDeEspacio(espacio))
  if (gen === generacion) genteDe.set(espacio, { en: Date.now(), ids })
  return ids
}

/** Cada persona del espacio con su alcance y la gente de los equipos que lidera (para los contactos). */
interface Persona { a: Alcance; gente: string[] }

/** El alcance de la gente del espacio: roles de la plataforma y equipos normalizados, guardado 15 s por espacio. */
const alcancesDe = new Map<string, { en: number; lista: Persona[] }>()
async function alcancesDelEspacio(espacio: string, gente: Set<string>): Promise<Persona[]> {
  const c = alcancesDe.get(espacio)
  if (c && Date.now() - c.en < 15_000) return c.lista
  const gen = generacion
  const [usuarios, eqs] = await Promise.all([
    gente.size ? base.user.findMany({ where: { id: { in: [...gente] } }, select: { id: true, role: true } }) : Promise.resolve([] as { id: string; role: string }[]),
    leerEquipos(),
  ])
  const lista = usuarios.map(u => { const a = alcanceDePersona(u.id, u.role, eqs); return { a, gente: genteQueLidera(a, eqs) } })
  if (gen === generacion) alcancesDe.set(espacio, { en: Date.now(), lista })
  return lista
}
/**
 * Al guardar los equipos (antes y después de escribirlos): la gente del espacio y su alcance se vuelven a leer en el
 * siguiente evento, y lo que se estaba leyendo en ese momento no queda guardado.
 */
export function olvidarGenteCrm() { generacion++; genteDe.clear(); alcancesDe.clear() }

/** Ajustes que solo usa la configuración general del CRM (Agentes > Base de conocimiento). */
const AJUSTES_DE_CONFIG = new Set(['kb'])
/** Eventos de la configuración general: las cuentas conectadas y los sistemas aprobados. */
const SOLO_CONFIG = new Set(['conexiones', 'integraciones'])

const conjunto = (ids: string[]) => new Set(ids)

async function repartir(evento: Json, espacio: string): Promise<void> {
  const gente = await genteDelEspacio(espacio)
  if (!gente.size) return
  const personas = await alcancesDelEspacio(espacio, gente)
  const tipo = String(evento.tipo ?? '')
  const conConfig = () => personas.filter(p => p.a.config).map(p => p.a.userId)
  const conTodo = () => personas.filter(p => p.a.todo).map(p => p.a.userId)

  if (SOLO_CONFIG.has(tipo)) { broadcastUsuarios(conjunto(conConfig()), 'crm', evento); return }

  // Embudo automático (lote 5): la configuración y «Hoy» de cada equipo solo a quien lo administra, igual que
  // GET /crm/ia/embudo (la configuración general y quien ve todo, todos los equipos; el líder, los suyos; nadie más).
  if (tipo === 'ia-embudo') {
    for (const p of personas) {
      const todos = p.a.config || p.a.todo
      if (!todos && !p.a.lidera.length) continue
      const recortar = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v)
        ? Object.fromEntries(Object.entries(v as Json).filter(([eq]) => todos || p.a.lidera.includes(eq)))
        : undefined)
      const ev: Json = { ...evento }
      if (evento.equipos !== undefined) ev.equipos = recortar(evento.equipos)
      if (evento.hoy !== undefined) ev.hoy = recortar(evento.hoy)
      broadcastUsuarios(new Set([p.a.userId]), 'crm', ev)
    }
    return
  }

  if (tipo === 'ajuste') {
    const clave = String(evento.clave ?? '')
    if (clave.startsWith('_')) return
    if (AJUSTES_DE_CONFIG.has(clave)) { broadcastUsuarios(conjunto(conConfig()), 'crm', evento); return }
    if (clave === 'difusionesEstado') { broadcastUsuarios(conjunto(personas.filter(p => p.a.config || p.a.todo || p.a.lidera.length).map(p => p.a.userId)), 'crm', evento); return }
    broadcastUsuarios(gente, 'crm', evento)
    return
  }

  if (tipo === 'conv' && evento.conv && typeof evento.conv === 'object') {
    const conv = obj(evento.conv)
    const fila = { equipo: typeof conv.equipo === 'string' && conv.equipo ? conv.equipo : null, asignadoId: typeof conv.asigId === 'string' ? conv.asigId : null, soloLider: conv.soloLider === true }
    const si = new Set(personas.filter(p => veConv(p.a, fila)).map(p => p.a.userId))
    broadcastUsuarios(si, 'crm', evento)
    // A quien ya no la puede ver (se la quitaron, pasó a otro equipo o se volvió «solo líder»), se le quita de la bandeja.
    broadcastUsuarios(conjunto([...gente].filter(id => !si.has(id))), 'crm', { tipo: 'conv-borrada', id: Number(conv.id), por: evento.por ?? null })
    return
  }

  if (tipo === 'contacto' && evento.contacto && typeof evento.contacto === 'object') {
    const contactoId = Number(obj(evento.contacto).contactoId)
    if (!Number.isInteger(contactoId)) return
    const k = await prisma.crmContacto.findUnique({ where: { id: contactoId }, select: { asignadoId: true, conversaciones: { select: { equipo: true, asignadoId: true, soloLider: true } } } })
      .catch(e => { logger.warn(`[CRM tiempo real] no se pudo leer el contacto ${contactoId}: ${(e as Error)?.message ?? e}`); return undefined })
    // Si la base falla o el contacto ya no está, solo a quien lo ve todo.
    if (!k) { broadcastUsuarios(conjunto(conTodo()), 'crm', evento); return }
    broadcastUsuarios(conjunto(personas.filter(p => veContactoEn(p.a, k, k.conversaciones, p.gente)).map(p => p.a.userId)), 'crm', evento)
    return
  }

  if (typeof evento.convId === 'number') {
    let c: { equipo: string | null; asignadoId: string | null; soloLider: boolean } | null
    try {
      c = await prisma.crmConversacion.findUnique({ where: { id: evento.convId }, select: { equipo: true, asignadoId: true, soloLider: true } })
    } catch (e) {
      logger.warn(`[CRM tiempo real] no se pudo leer la conversación ${evento.convId}: ${(e as Error)?.message ?? e}`)
      broadcastUsuarios(conjunto(conTodo()), 'crm', evento)
      return
    }
    if (!c) return
    broadcastUsuarios(conjunto(personas.filter(p => veConv(p.a, c!)).map(p => p.a.userId)), 'crm', evento)
    return
  }

  broadcastUsuarios(gente, 'crm', evento)
}

export function emitirCrm(data: Record<string, unknown>, por: string | null = null) {
  const evento = { ...data, por }
  const espacio = espacioOpcional()
  // Sin espacio no se sabe a quién mandarlo: es preferible perderlo que mostrárselo a otra empresa.
  if (!espacio) { logger.warn(`[CRM tiempo real] evento ${String(data.tipo)} sin espacio de trabajo: no se envía`); return }
  enOrden(() => enEspacio(espacio, () => repartir(evento, espacio)))
}

/**
 * El alcance nuevo de una persona (forma de GET /crm/inicio `alcance`), o null si perdió el acceso al CRM: va
 * directo a ella aunque ya no sea del espacio, en la misma cola (después del `ajuste` de los equipos). La pantalla
 * vuelve a pedir /crm/inicio: le aparecen las conversaciones que ahora ve y se le van las que ya no.
 */
export function emitirAlcance(userId: string, alcance: object | null, por: string | null = null) {
  enOrden(() => { broadcastUsuarios(new Set([userId]), 'crm', { tipo: 'alcance', alcance, por }) })
}

/**
 * Un evento que es solo de una persona (lote 5: `ia-mi`, lo que su IA aprendió): va directo a ella, en la misma cola,
 * sin pasar por `repartir`. Nadie más lo recibe, ni su líder ni la configuración general.
 */
export function emitirAPersona(userId: string, evento: Record<string, unknown>, por: string | null = null) {
  enOrden(() => { broadcastUsuarios(new Set([userId]), 'crm', { ...evento, por }) })
}

export async function emitirConv(id: number, por: string | null = null) {
  const conv = await cargarConv(id)
  if (conv) emitirCrm({ tipo: 'conv', conv }, por)
  return conv
}

export function emitirMsg(convId: number, m: CrmMensaje, por: string | null = null) {
  emitirCrm({ tipo: 'msg', convId, msg: msgAFront(m) }, por)
}

/** Espera a que salgan los eventos ya emitidos (para pruebas y para cerrar el servidor en orden). */
export function eventosAlDia(): Promise<void> {
  return cola
}
