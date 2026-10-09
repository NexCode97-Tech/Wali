import type Anthropic from '@anthropic-ai/sdk'
import type { CrmContacto, CrmConversacion, CrmMensaje } from '@prisma/client'
import { prisma, prismaGlobal } from './bd'
import { espacioActual } from './espacio'
import { leerAjuste } from './ajustes'
import { equipoDeConv, leerEquipos, planoNombre } from './equipos'
import { emitirConv, emitirCrm } from './tiempoReal'
import { guardarMensaje } from './salientes'
import { nombreDe } from './usuarios'
import { dispararReglas, type PagoHotmart } from './reglas'
import {
  MODELO_HAIKU, PERSONA_SIN_ASIGNAR, REGLA_CONVERSACION, bloqueConversacion, cambiarAjusteBloqueado, diaColombia,
  iaDisponible, jsonDe, lineasParaIA, llamarIA, metricasDeHoy, sinGuiones, sumarMetrica,
} from './iaComun'
import { ConflictError, NotFoundError } from '../../utils/errors'
import { logger } from '../../utils/logger'

/**
 * Embudo automático.
 *
 * Un agente con Haiku 4.5 lee la conversación cuando avanza y la pasa a la etapa que va según el criterio escrito
 * para cada etapa en cada equipo (Ajustes del CRM › Conversaciones › Embudo automático). Reglas fijas:
 * - Solo mueve si el criterio se cumple por lo escrito; si no está segura, no la mueve («Si no está segura»).
 * - «Solo avanzar» (prendido por defecto): nunca la devuelve a una etapa anterior.
 * - Nunca entra ni sale de la etapa de pago (la primera del equipo que contiene «pagad»): esa la pone Hotmart.
 * - Cada movimiento deja un evento en la conversación con «Deshacer» (`ev: 'ia'`) y la tarjeta del Embudo dice
 *   «La IA la movió» mientras siga en esa etapa. Deshacer la devuelve, pausa la IA en esa conversación hasta que el
 *   cliente vuelva a escribir y la IA ya no la pasa nunca más a esa etapa.
 * - Hotmart confirma el pago → la conversación pasa a la etapa de pago SIN IA (pasarAPagoPorHotmart, lo llama
 *   reglas.ts justo antes de las reglas «Se confirma un pago»): funciona sin clave, con el tope y con la IA apagada.
 *
 * Dónde se guarda (sin tocar schema.prisma):
 * - crm_ajustes `_iaEmbudo` = {equipos: {[equipo]: {on, soloAvanzar, seguro, criterios: {[etapa]: texto}}}, v: 1}.
 * - crm_conversaciones.extra `_iaEmbudo` {hasta, en, pausa, noA}, `_iaEtapa` {de, a, razon, confianza, en, msgId,
 *   deshecha} y `_pagoHotmart` {en, de, etapa, transaccion, producto}. Se escriben con jsonb_set y filas bloqueadas,
 *   nunca con el PATCH de la pantalla (que ignora las claves con «_»).
 *
 * Al modelo solo le llegan los mensajes de la conversación (in, out, ia, bot y recepcion, sin nombres de quien atiende;
 * nunca notas privadas: lo filtra `lineasParaIA`). Ningún texto ni instrucción nombra a la empresa.
 */

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})
const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export interface CfgEquipoEmbudo { on: boolean; soloAvanzar: boolean; seguro: boolean; criterios: Record<string, string> }
export interface HoyEquipo { movidas: number; deshechas: number; pagos: number }

/** La etapa de pago: la pone el sistema de pagos, nunca la IA (igual que agenteIA.ts). */
export const ES_PAGO = /pagad/i
/** Largo máximo del criterio de una etapa. */
export const MAX_CRITERIO = 300
/** Largo máximo de la razón que queda en el evento. */
const MAX_RAZON = 90
const CLAVE_CFG = '_iaEmbudo'
const ETAPAS_DEFECTO = ['Nuevo lead', 'Contactado', 'Caliente', 'En seguimiento', 'No interesado/perdido', 'Pagado', 'Link errado', 'Sin respuesta']
/** Los criterios iniciales del tablero 8, por nombre de etapa (sin tildes ni mayúsculas). Las demás etapas, vacías. */
const CRITERIOS_DEFECTO: Record<string, string> = {
  'nuevo lead': 'Escribe por primera vez.',
  contactado: 'Alguien del equipo ya le respondió.',
  caliente: 'Pregunta precio, fechas o formas de pago, o pide el enlace para pagar.',
  'en seguimiento': 'Dice que lo va a pensar, que consulta con alguien o que paga después.',
  'no interesado/perdido': 'Dice que no le interesa o que ya compró en otro lado.',
}
/** Conversaciones con mensajes en las últimas horas: las viejas no se tocan hasta que vuelvan a moverse. */
const HORAS_RECIENTES = 6
/** Calma después del último mensaje antes de analizar (el cliente suele mandar varios seguidos). */
const CALMA_MS = 90_000
/** En un chat que no para, se analiza igual cada tanto. */
const CADA_MS = 10 * 60_000
const MAX_POR_VUELTA = 20
/**
 * Análisis con IA de una misma conversación en un día de Colombia. Una conversación normal no llega (cada análisis
 * pide 90 s de calma después de una tanda de mensajes); el límite evita que un cliente que escribe sin parar todo el
 * día se gaste solo el tope de USD 5 de todo el servidor.
 */
export const MAX_ANALISIS_DIA = 24
/** Largo máximo de cada mensaje en el pedido del embudo (para decidir la etapa basta el comienzo). */
const MAX_CAR_EMBUDO = 300
/** Mensajes que se leen para quedarse con los últimos 30 útiles (las notas y los eventos se descartan). */
const LEER_MENSAJES = 150
const TIPOS_CONVERSACION = ['in', 'out', 'ia', 'bot', 'recepcion']
const DIAS_VIGENTE = 60

// ─── Etapas y configuración ──────────────────────────────────────────────────

/** Las etapas de un equipo en el orden del ajuste `etapas` ([nombre, color, equipo?]; sin equipo = Ventas). */
export async function etapasDelEquipo(equipo: string): Promise<string[]> {
  const v = await leerAjuste<unknown>('etapas')
  if (!Array.isArray(v)) return equipo === 'Ventas' ? [...ETAPAS_DEFECTO] : []
  const salida: string[] = []
  for (const x of v) {
    const n = Array.isArray(x) ? txt(x[0]) : txt(obj(x).n)
    const eq = (Array.isArray(x) ? txt(x[2]) : txt(obj(x).equipo ?? obj(x).eq)) || 'Ventas'
    if (n && eq === equipo && !salida.includes(n)) salida.push(n)
  }
  return salida
}

/** Todas las etapas por equipo, leyendo el ajuste una sola vez. */
async function etapasPorEquipo(equipos: string[]): Promise<Record<string, string[]>> {
  const v = await leerAjuste<unknown>('etapas')
  const out: Record<string, string[]> = Object.fromEntries(equipos.map(eq => [eq, [] as string[]]))
  if (!Array.isArray(v)) { if (out.Ventas) out.Ventas = [...ETAPAS_DEFECTO]; return out }
  for (const x of v) {
    const n = Array.isArray(x) ? txt(x[0]) : txt(obj(x).n)
    const eq = (Array.isArray(x) ? txt(x[2]) : txt(obj(x).equipo ?? obj(x).eq)) || 'Ventas'
    if (n && out[eq] && !out[eq].includes(n)) out[eq].push(n)
  }
  return out
}

/** Los equipos del CRM en el orden del ajuste `equipos` (si nunca se guardó, Ventas). */
async function nombresEquipos(): Promise<string[]> {
  const eqs = Object.keys((await leerEquipos()).miembros)
  return eqs.length ? eqs : ['Ventas']
}

/** Sin espacios de más: el criterio se guarda en una sola línea. */
export const criterioLimpio = (t: unknown) => (typeof t === 'string' ? t.replace(/\s+/g, ' ').trim() : '')

function normalizarEquipo(equipo: string, guardado: unknown, etapas: string[]): CfgEquipoEmbudo {
  const g = obj(guardado)
  const crit = obj(g.criterios)
  const criterios: Record<string, string> = {}
  for (const e of etapas) {
    if (ES_PAGO.test(e)) continue
    // Lo guardado manda (también un criterio borrado); una etapa que nunca se guardó toma el del tablero 8 si se llama igual.
    const t = Object.prototype.hasOwnProperty.call(crit, e) ? criterioLimpio(crit[e]) : (CRITERIOS_DEFECTO[planoNombre(e)] ?? '')
    criterios[e] = t.slice(0, MAX_CRITERIO)
  }
  return {
    // Empieza apagado: las conversaciones no van a la IA hasta que la empresa lo prenda.
    on: typeof g.on === 'boolean' ? g.on : false,
    soloAvanzar: typeof g.soloAvanzar === 'boolean' ? g.soloAvanzar : true,
    seguro: typeof g.seguro === 'boolean' ? g.seguro : true,
    criterios,
  }
}

function normalizarTodo(valor: unknown, equipos: string[], etapas: Record<string, string[]>): Record<string, CfgEquipoEmbudo> {
  const guardados = obj(obj(valor).equipos)
  return Object.fromEntries(equipos.map(eq => [eq, normalizarEquipo(eq, guardados[eq], etapas[eq] ?? [])]))
}

/** La configuración del embudo automático de cada equipo, con los valores iniciales del tablero 8. */
export async function leerCfgEmbudo(): Promise<Record<string, CfgEquipoEmbudo>> {
  const equipos = await nombresEquipos()
  const [valor, etapas] = await Promise.all([leerAjuste<unknown>(CLAVE_CFG), etapasPorEquipo(equipos)])
  return normalizarTodo(valor, equipos, etapas)
}

/**
 * Cambia la configuración de un equipo con la fila del ajuste bloqueada (dos líderes a la vez no se pisan) y la
 * manda en vivo (`ia-embudo`). Los criterios se mezclan por etapa sobre lo que había. El primer guardado deja
 * escritos los valores iniciales de ese equipo.
 */
export async function guardarCfgEquipo(equipo: string, cambios: Partial<CfgEquipoEmbudo>, por: string): Promise<Record<string, CfgEquipoEmbudo>> {
  const equipos = await nombresEquipos()
  const etapas = await etapasPorEquipo(equipos)
  await cambiarAjusteBloqueado<Json>(CLAVE_CFG, { equipos: {}, v: 1 }, valor => {
    const guardados = { ...obj(obj(valor).equipos) }
    const actual = normalizarEquipo(equipo, guardados[equipo], etapas[equipo] ?? [])
    const nuevo: CfgEquipoEmbudo = {
      on: typeof cambios.on === 'boolean' ? cambios.on : actual.on,
      soloAvanzar: typeof cambios.soloAvanzar === 'boolean' ? cambios.soloAvanzar : actual.soloAvanzar,
      seguro: typeof cambios.seguro === 'boolean' ? cambios.seguro : actual.seguro,
      criterios: { ...obj(obj(guardados[equipo]).criterios) as Record<string, string>, ...actual.criterios },
    }
    for (const [e, t] of Object.entries(cambios.criterios ?? {})) nuevo.criterios[e] = criterioLimpio(t).slice(0, MAX_CRITERIO)
    guardados[equipo] = nuevo
    return { equipos: guardados, v: 1 }
  })
  const cfg = await leerCfgEmbudo()
  emitirCrm({ tipo: 'ia-embudo', equipos: cfg }, por)
  return cfg
}

/** Lo de hoy (día de Colombia) por equipo: movidas por la IA, deshechas por el equipo y pagos de Hotmart. */
export async function hoyPorEquipo(): Promise<Record<string, HoyEquipo>> {
  const [f, equipos] = await Promise.all([metricasDeHoy(), nombresEquipos()])
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
  return Object.fromEntries(equipos.map(eq => {
    const x = f.equipos[eq] ?? {}
    return [eq, { movidas: n(x.movidas), deshechas: n(x.deshechas), pagos: n(x.pagos) }]
  }))
}

async function emitirHoy(por: string | null) {
  try { emitirCrm({ tipo: 'ia-embudo', hoy: await hoyPorEquipo() }, por) } catch (e) {
    logger.warn(`[CRM IA] embudo: no se pudo mandar lo de hoy (${(e as Error)?.message ?? e})`)
  }
}

/** La conversación cambiada y las demás vigentes del mismo contacto (la etapa es del contacto). */
async function emitirDelContacto(contactoId: number, por: string | null) {
  const convs = await prisma.crmConversacion.findMany({
    where: { contactoId, OR: [{ estado: { not: 'finalizadas' } }, { finalizadaAt: { gte: new Date(Date.now() - DIAS_VIGENTE * 86_400_000) } }] },
    select: { id: true }, orderBy: { createdAt: 'desc' }, take: 20,
  })
  for (const c of convs) await emitirConv(c.id, por)
}

// ─── Estado en la conversación ───────────────────────────────────────────────

/** La más tardía de dos horas, en ISO (null si no hay ninguna). */
function maxIso(a: string | Date | null | undefined, b: string | Date | null | undefined): string | null {
  const t = Math.max(a ? new Date(a).getTime() || 0 : 0, b ? new Date(b).getTime() || 0 : 0)
  return t ? new Date(t).toISOString() : null
}

/** `dia` y `n`: cuántos análisis con IA lleva la conversación ese día de Colombia (MAX_ANALISIS_DIA). */
interface EstadoEmbudo { hasta: string | null; en: string | null; pausa: string | null; noA: string[]; dia: string | null; n: number }

function estadoDe(extra: unknown): EstadoEmbudo {
  const e = obj(obj(extra)._iaEmbudo)
  const iso = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null)
  return {
    hasta: iso(e.hasta), en: iso(e.en), pausa: iso(e.pausa),
    noA: Array.isArray(e.noA) ? e.noA.filter((x): x is string => typeof x === 'string') : [],
    dia: typeof e.dia === 'string' ? e.dia : null,
    n: typeof e.n === 'number' && Number.isFinite(e.n) ? e.n : 0,
  }
}

/** Reclama el análisis: solo si nadie lo cambió desde que se leyó (dos procesos no analizan la misma). */
async function reclamar(convId: number, enLeido: string | null, ahora: string): Promise<boolean> {
  const n = await prismaGlobal.$executeRaw`
    UPDATE crm_conversaciones SET extra = jsonb_set(coalesce(extra, '{}'::jsonb), '{_iaEmbudo}',
      (CASE WHEN jsonb_typeof(extra->'_iaEmbudo') = 'object' THEN extra->'_iaEmbudo' ELSE '{}'::jsonb END) || jsonb_build_object('en', ${ahora}::text))
    WHERE id = ${convId} AND espacio_id = ${espacioActual()} AND coalesce(extra->'_iaEmbudo'->>'en', '') = ${enLeido ?? ''}`
  return n > 0
}

/** Deja `hasta` (último mensaje leído) y `en` (último análisis), y el conteo del día si se llamó a la IA; nunca toca pausa ni noA. */
async function marcarLeido(convId: number, hasta: string | null, en: string, conteo?: { dia: string; n: number } | null) {
  const cambios = { ...(hasta ? { hasta, en } : { en }), ...(conteo ?? {}) }
  await prismaGlobal.$executeRaw`
    UPDATE crm_conversaciones SET extra = jsonb_set(coalesce(extra, '{}'::jsonb), '{_iaEmbudo}',
      (CASE WHEN jsonb_typeof(extra->'_iaEmbudo') = 'object' THEN extra->'_iaEmbudo' ELSE '{}'::jsonb END) || ${JSON.stringify(cambios)}::jsonb)
    WHERE id = ${convId} AND espacio_id = ${espacioActual()}`
}

// ─── Cuándo analiza ──────────────────────────────────────────────────────────

/**
 * Proceso de cada minuto (procesos.ts, en su propio intervalo y en cada espacio): hasta 20 conversaciones no
 * finalizadas, con mensajes en las últimas 6 horas que la IA no ha leído, sin agente IA atendiendo, con 90 s de calma
 * después del último mensaje o 10 min desde el último análisis (`sinEspera` lo salta). De la más reciente a la más
 * vieja. Sin clave de Claude o con el tope del día no hace nada. Devuelve cuántas movió.
 */
export async function embudoPendientes(op: { sinEspera?: boolean; max?: number } = {}): Promise<number> {
  if (!(await iaDisponible())) return 0
  const ahora = Date.now()
  const [candidatas, cfgTodos] = await Promise.all([
    prisma.crmConversacion.findMany({
      where: { estado: { not: 'finalizadas' }, ultimoMensajeAt: { gte: new Date(ahora - HORAS_RECIENTES * 3_600_000) } },
      select: { id: true, ultimoMensajeAt: true, extra: true, equipo: true },
      orderBy: { ultimoMensajeAt: 'desc' },
      take: 300,
    }),
    leerCfgEmbudo(),
  ])
  // Un equipo con la IA apagada o sin criterios no ocupa el cupo de la vuelta ni lee mensajes: sus conversaciones
  // solo quedan leídas (una sola escritura para todas), como antes, así al prenderla no se analiza lo viejo.
  const activo = (eq: string) => { const x = cfgTodos[eq]; return !x || (x.on && Object.values(x.criterios).some(t => t.trim())) }
  const max = Math.max(1, Math.min(op.max ?? MAX_POR_VUELTA, 100))
  const elegidas: number[] = []
  const apagadas: { id: number; hasta: string }[] = []
  for (const c of candidatas) {
    const x = obj(c.extra)
    if (x._agente) continue
    const ult = c.ultimoMensajeAt?.getTime() ?? 0
    const e = estadoDe(x)
    if (e.hasta && ult <= Date.parse(e.hasta)) continue
    if (!activo(equipoDeConv(c))) { if (c.ultimoMensajeAt) apagadas.push({ id: c.id, hasta: c.ultimoMensajeAt.toISOString() }); continue }
    if (elegidas.length >= max) continue
    const calma = ult <= ahora - CALMA_MS
    const tarde = !!e.en && Date.parse(e.en) <= ahora - CADA_MS
    if (!op.sinEspera && !calma && !tarde) continue
    elegidas.push(c.id)
  }
  if (apagadas.length) {
    try {
      await prismaGlobal.$executeRaw`
        UPDATE crm_conversaciones c SET extra = jsonb_set(coalesce(c.extra, '{}'::jsonb), '{_iaEmbudo}',
          (CASE WHEN jsonb_typeof(c.extra->'_iaEmbudo') = 'object' THEN c.extra->'_iaEmbudo' ELSE '{}'::jsonb END) || jsonb_build_object('hasta', v.hasta))
        FROM (SELECT unnest(${apagadas.map(a => a.id)}::int[]) AS id, unnest(${apagadas.map(a => a.hasta)}::text[]) AS hasta) v
        WHERE c.id = v.id AND c.espacio_id = ${espacioActual()}`
    } catch (e) {
      logger.warn(`[CRM IA] embudo: no se pudieron marcar las conversaciones de equipos sin IA (${(e as Error)?.message ?? e})`)
    }
  }
  let movidas = 0
  for (const id of elegidas) {
    try {
      const r = await analizarConversacion(id)
      if (r === 'movida') movidas++
      if (r === 'sin-ia' && !(await iaDisponible())) break
    } catch (e) {
      logger.warn(`[CRM IA] embudo: falló el análisis de la conversación ${id} (${(e as Error)?.message ?? e})`)
    }
  }
  return movidas
}

// ─── El análisis ─────────────────────────────────────────────────────────────

/** Instrucciones fijas (iguales para todas las empresas: sin nombre de empresa). */
export const INSTRUCCIONES_EMBUDO = `Revisas conversaciones de atención por chat entre un cliente y el equipo de una empresa y decides en qué etapa del embudo debe quedar cada una.
Reglas:
- Lees toda la conversación, pero decides por lo más reciente.
- Solo eliges una etapa de la lista del equipo, con su nombre exacto, y solo si su criterio se cumple con lo que está escrito en la conversación. Si ninguna se cumple con claridad, eliges «ninguna».
- «confianza» es «alta» solo si el criterio se cumple de forma explícita; «media» si es probable pero no lo dice claro; «baja» si es una suposición.
- «razon» explica en una frase corta por qué, en pasado y en tercera persona, empezando en minúscula y sin nombres propios, por ejemplo: preguntó el precio y la fecha de inicio. Máximo 90 caracteres, sin guiones ni comillas.
- Los pagos no los decides tú: los confirma el sistema de pagos.
- ${REGLA_CONVERSACION}`

const NINGUNA = 'ninguna'
type Confianza = 'alta' | 'media' | 'baja'
interface Decision { etapa: string; confianza: Confianza; razon: string }

/** La razón que queda en el evento: corta, en minúscula, sin punto final ni guiones. */
export function limpiarRazon(t: unknown): string {
  let s = sinGuiones(String(t ?? '')).replace(/\s+/g, ' ').trim()
  s = s.replace(/^["'«»“”]+|["'«»“”]+$/g, '').replace(/[.。]+$/, '').trim()
  if (s.length > MAX_RAZON) {
    const corte = s.slice(0, MAX_RAZON + 1)
    const i = corte.lastIndexOf(' ')
    s = (i > 40 ? corte.slice(0, i) : s.slice(0, MAX_RAZON)).replace(/[,;:]+$/, '').trim()
  }
  return s ? s[0].toLocaleLowerCase('es') + s.slice(1) : ''
}

type ConvCompleta = CrmConversacion & { contacto: CrmContacto }

/**
 * Lee la conversación y la mueve de etapa si va. 'movida': la movió; 'igual': la IA respondió y no se mueve;
 * 'omitida': no había nada que analizar (equipo apagado o sin criterios, etapa de pago, nada nuevo, pausa, agente
 * IA atendiendo o la tomó otro proceso); 'sin-ia': no hay clave, se llegó al tope o Claude falló. Siempre deja
 * `hasta` y `en` al día, se mueva o no. `forzar` (pruebas) la analiza aunque esté finalizada.
 */
export async function analizarConversacion(convId: number, op: { forzar?: boolean } = {}): Promise<'movida' | 'igual' | 'omitida' | 'sin-ia'> {
  const c = await prisma.crmConversacion.findUnique({ where: { id: convId }, include: { contacto: true } }) as ConvCompleta | null
  if (!c) return 'omitida'
  if ((c.estado === 'finalizadas' && !op.forzar) || obj(c.extra)._agente) return 'omitida'
  const est = estadoDe(c.extra)
  const ahora = new Date().toISOString()
  if (!(await reclamar(convId, est.en, ahora))) return 'omitida'

  const equipo = equipoDeConv(c)
  const [cfgTodos, etapas] = await Promise.all([leerCfgEmbudo(), etapasDelEquipo(equipo)])
  const cfg = cfgTodos[equipo] ?? normalizarEquipo(equipo, null, etapas)
  const conCriterio = etapas.filter(e => !ES_PAGO.test(e) && (cfg.criterios[e] ?? '').trim())

  // Hasta dónde se leyó: lo último leído o la hora de la conversación (y, si se leen los mensajes, el último de ellos).
  let hasta = maxIso(est.hasta, c.ultimoMensajeAt)
  let conteo: { dia: string; n: number } | null = null
  const terminar = async <T>(r: T): Promise<T> => { await marcarLeido(convId, hasta, ahora, conteo); return r }

  if (!cfg.on || !conCriterio.length) return terminar('omitida' as const)
  // La etapa es del contacto: si está en la de otro equipo (o en una que ya no existe), la IA de este equipo no la toca.
  if (c.contacto.etapa && !etapas.includes(c.contacto.etapa)) return terminar('omitida' as const)
  const actual = c.contacto.etapa || etapas[0] || null
  if (actual && ES_PAGO.test(actual)) return terminar('omitida' as const)
  // Solo las etapas a las que de verdad puede pasar: con criterio, distintas de la actual, fuera de las que se
  // deshicieron y, con «Solo avanzar», más adelante. Sin ninguna no se llama a la IA.
  const idxActual = actual ? etapas.indexOf(actual) : -1
  const posibles = conCriterio.filter(e => e !== actual && !est.noA.includes(e) && (!cfg.soloAvanzar || etapas.indexOf(e) > idxActual))
  if (!posibles.length) return terminar('omitida' as const)

  const msgs = (await prisma.crmMensaje.findMany({ where: { conversacionId: convId }, orderBy: { createdAt: 'desc' }, take: LEER_MENSAJES })).reverse()
  if (msgs.length) hasta = maxIso(hasta, msgs[msgs.length - 1].createdAt)

  const desde = est.hasta ? Date.parse(est.hasta) : 0
  const nuevos = msgs.filter(m => TIPOS_CONVERSACION.includes(m.tipo) && m.createdAt.getTime() > desde)
  if (!nuevos.length) return terminar('omitida' as const)
  // Después de un «Deshacer» la IA espera a que el cliente vuelva a escribir.
  if (est.pausa) {
    const pausa = Date.parse(est.pausa)
    if (!nuevos.some(m => m.tipo === 'in' && m.createdAt.getTime() > pausa)) return terminar('omitida' as const)
    await prismaGlobal.$executeRaw`
      UPDATE crm_conversaciones SET extra = jsonb_set(extra, '{_iaEmbudo,pausa}', 'null'::jsonb)
      WHERE id = ${convId} AND espacio_id = ${espacioActual()} AND extra->'_iaEmbudo'->>'pausa' = ${est.pausa}`
  }
  if (!(await iaDisponible())) return terminar('sin-ia' as const)

  const lineas = lineasParaIA(msgs as CrmMensaje[], { max: 30, maxCar: MAX_CAR_EMBUDO, equipoSinNombre: true })
  if (!lineas.length) return terminar('omitida' as const)
  const hoy = diaColombia()
  const llevaHoy = est.dia === hoy ? est.n : 0
  if (llevaHoy >= MAX_ANALISIS_DIA) return terminar('omitida' as const)
  conteo = { dia: hoy, n: llevaHoy + 1 }
  const lista = posibles.map((e, i) => `${i + 1}. ${e}: ${cfg.criterios[e]}`).join('\n')
  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model: MODELO_HAIKU,
    max_tokens: 300,
    system: [
      { type: 'text', text: INSTRUCCIONES_EMBUDO, cache_control: { type: 'ephemeral' } },
      { type: 'text', text: `Etapas del equipo ${equipo}, en orden:\n${lista}`, cache_control: { type: 'ephemeral' } },
    ],
    messages: [{ role: 'user', content: `Etapa actual: ${actual ?? 'sin etapa'}\n\nConversación, de la más antigua a la más reciente:\n${bloqueConversacion(lineas)}` }],
    output_config: {
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            etapa: { type: 'string', enum: [...posibles, NINGUNA] },
            confianza: { type: 'string', enum: ['alta', 'media', 'baja'] },
            razon: { type: 'string' },
          },
          required: ['etapa', 'confianza', 'razon'],
          additionalProperties: false,
        },
      },
    },
  }
  const r = await llamarIA(params, { tipo: 'embudo', persona: c.asignadoId ?? PERSONA_SIN_ASIGNAR, equipo }, { timeout: 20_000 })
  if (!r) return terminar('sin-ia' as const)
  if (r.stop_reason === 'max_tokens') return terminar('igual' as const)
  const d = jsonDe<Decision>(r)
  if (!d || typeof d.etapa !== 'string') { logger.warn(`[CRM IA] embudo: la respuesta de la conversación ${convId} no trajo el formato esperado`); return terminar('igual' as const) }

  // La decisión es del servidor: el modelo solo propone (y solo vale una de las posibles).
  const destino = posibles.find(e => e === d.etapa.trim())
  if (!destino || destino === actual || ES_PAGO.test(destino) || est.noA.includes(destino)) return terminar('igual' as const)
  if (cfg.soloAvanzar && etapas.indexOf(destino) <= idxActual) return terminar('igual' as const)
  const permitidas: Confianza[] = cfg.seguro ? ['alta'] : ['alta', 'media']
  if (!permitidas.includes(d.confianza)) return terminar('igual' as const)

  await marcarLeido(convId, hasta, ahora, conteo)
  const movio = await mover(c, equipo, c.contacto.etapa ?? null, destino, limpiarRazon(d.razon), d.confianza)
  return movio ? 'movida' : 'igual'
}

/** Mueve la etapa del contacto con las filas bloqueadas, si sigue en la que se leyó, y deja el evento con Deshacer. */
async function mover(c: ConvCompleta, equipo: string, de: string | null, a: string, razon: string, confianza: Confianza): Promise<boolean> {
  const espacio = espacioActual()
  const en = new Date().toISOString()
  const ok = await prismaGlobal.$transaction(async tx => {
    // Mismo orden que el PATCH de la conversación: primero la conversación y después el contacto.
    const cv = await tx.$queryRaw<{ extra: unknown }[]>`SELECT extra FROM crm_conversaciones WHERE id = ${c.id} AND espacio_id = ${espacio} FOR UPDATE`
    const k = await tx.$queryRaw<{ etapa: string | null }[]>`SELECT etapa FROM crm_contactos WHERE id = ${c.contactoId} AND espacio_id = ${espacio} FOR UPDATE`
    if (!cv[0] || !k[0] || (k[0].etapa ?? null) !== de) return false
    const x = obj(cv[0].extra)
    if (x._agente || estadoDe(x).noA.includes(a)) return false
    const ie = { de, a, razon, confianza, en, msgId: null, deshecha: null }
    await tx.$executeRaw`UPDATE crm_contactos SET etapa = ${a}, "updatedAt" = now() WHERE id = ${c.contactoId} AND espacio_id = ${espacio}`
    await tx.$executeRaw`UPDATE crm_conversaciones SET extra = jsonb_set(coalesce(extra, '{}'::jsonb), '{_iaEtapa}', ${JSON.stringify(ie)}::jsonb) WHERE id = ${c.id} AND espacio_id = ${espacio}`
    return true
  }, { maxWait: 15_000, timeout: 15_000 })
  if (!ok) return false

  const t = razon ? `La IA la pasó a ${a}: ${razon}` : `La IA la pasó a ${a}.`
  try {
    const m = await guardarMensaje(c.id, { ev: 'ia', t, iaEtapa: { de, a, razon } }, { autorId: null, por: null })
    await prismaGlobal.$executeRaw`
      UPDATE crm_conversaciones SET extra = jsonb_set(extra, '{_iaEtapa,msgId}', to_jsonb(${m.id}::text))
      WHERE id = ${c.id} AND espacio_id = ${espacio} AND extra->'_iaEtapa'->>'en' = ${en}`
  } catch (e) {
    logger.warn(`[CRM IA] embudo: no se pudo dejar el evento en la conversación ${c.id} (${(e as Error)?.message ?? e})`)
  }
  await emitirDelContacto(c.contactoId, null)
  try { await sumarMetrica({ contador: 'movidas', persona: c.asignadoId ?? PERSONA_SIN_ASIGNAR, equipo }) } catch (e) {
    logger.warn(`[CRM IA] embudo: no se pudo contar el movimiento (${(e as Error)?.message ?? e})`)
  }
  await emitirHoy(null)
  logger.info(`[CRM IA] embudo: conversación ${c.id} de ${de ?? 'sin etapa'} a ${a} (${confianza})`)
  void dispararReglas('etapa', c.id, { antes: de, etapa: a, porIA: true }).catch(() => {})
  return true
}

// ─── Deshacer ────────────────────────────────────────────────────────────────

/**
 * Devuelve la conversación a la etapa de antes del cambio de la IA, solo si sigue en la que puso la IA. La IA no la
 * vuelve a mover hasta que el cliente escriba otra vez y nunca más a esa etapa. Deja un evento con el nombre de
 * quien lo hizo. No usa IA: funciona sin clave y con el tope alcanzado.
 */
export async function deshacerMovimiento(convId: number, userId: string): Promise<void> {
  const espacio = espacioActual()
  const ahora = new Date().toISOString()
  const r = await prismaGlobal.$transaction(async tx => {
    const cv = await tx.$queryRaw<{ contacto_id: number; extra: unknown; equipo: string | null }[]>`
      SELECT contacto_id, extra, equipo FROM crm_conversaciones WHERE id = ${convId} AND espacio_id = ${espacio} FOR UPDATE`
    if (!cv[0]) throw new NotFoundError('Esa conversación ya no existe. Recarga la bandeja.')
    const x = obj(cv[0].extra)
    const ie = obj(x._iaEtapa)
    const a = txt(ie.a)
    if (!a) throw new NotFoundError('Esta conversación no tiene un cambio de etapa de la IA para deshacer.')
    if (ie.deshecha) throw new ConflictError('Ese cambio ya se deshizo.')
    const k = await tx.$queryRaw<{ etapa: string | null }[]>`SELECT etapa FROM crm_contactos WHERE id = ${cv[0].contacto_id} AND espacio_id = ${espacio} FOR UPDATE`
    if ((k[0]?.etapa ?? null) !== a) throw new ConflictError('La etapa ya cambió después del cambio de la IA. Muévela a mano desde el embudo.')
    const de = txt(ie.de) || null
    const emb = estadoDe(x)
    const nuevoIe = { ...ie, deshecha: { en: ahora, por: userId } }
    const nuevoEmb = { ...obj(x._iaEmbudo), pausa: ahora, noA: [...new Set([...emb.noA, a])] }
    await tx.$executeRaw`UPDATE crm_contactos SET etapa = ${de}, "updatedAt" = now() WHERE id = ${cv[0].contacto_id} AND espacio_id = ${espacio}`
    await tx.$executeRaw`
      UPDATE crm_conversaciones SET extra = jsonb_set(jsonb_set(coalesce(extra, '{}'::jsonb), '{_iaEtapa}', ${JSON.stringify(nuevoIe)}::jsonb), '{_iaEmbudo}', ${JSON.stringify(nuevoEmb)}::jsonb)
      WHERE id = ${convId} AND espacio_id = ${espacio}`
    return { de, a, contactoId: Number(cv[0].contacto_id), equipo: equipoDeConv({ equipo: cv[0].equipo }) }
  }, { maxWait: 15_000, timeout: 15_000 })

  const nombre = (await nombreDe(userId)) ?? 'Alguien del equipo'
  const t = `${nombre} deshizo el cambio de la IA. ${r.de ? `Volvió a ${r.de}.` : 'Quedó sin etapa.'}`
  await guardarMensaje(convId, { ev: 'swap', t, iaDeshacer: { de: r.a, a: r.de } }, { autorId: userId, por: userId })
  await emitirDelContacto(r.contactoId, userId)
  try { await sumarMetrica({ contador: 'deshechas', persona: userId, equipo: r.equipo }) } catch (e) {
    logger.warn(`[CRM IA] embudo: no se pudo contar el deshacer (${(e as Error)?.message ?? e})`)
  }
  await emitirHoy(userId)
  void dispararReglas('etapa', convId, { antes: r.a, etapa: r.de, deshacerIA: true }).catch(() => {})
}

// ─── Hotmart → etapa de pago (sin IA) ────────────────────────────────────────

/**
 * Hotmart confirmó el pago (reglas.ts, reglasPorPagoEnEspacio, después de reclamar la transacción y antes de las
 * reglas «Se confirma un pago»): la conversación pasa a la etapa de pago de su equipo. No usa IA ni depende del
 * interruptor del equipo, del tope ni de la clave. Suma el pago a «Hoy» del equipo. Devuelve si cambió la etapa.
 */
export async function pasarAPagoPorHotmart(convId: number, p: PagoHotmart): Promise<boolean> {
  const c = await prisma.crmConversacion.findUnique({ where: { id: convId }, select: { id: true, contactoId: true, equipo: true, contacto: { select: { etapa: true } } } })
  if (!c) return false
  const equipo = equipoDeConv(c)
  const etapaPago = (await etapasDelEquipo(equipo)).find(e => ES_PAGO.test(e))
  if (!etapaPago) return false
  try { await sumarMetrica({ contador: 'pagos', equipo }) } catch (e) {
    logger.warn(`[CRM IA] embudo: no se pudo contar el pago de Hotmart (${(e as Error)?.message ?? e})`)
  }
  if (c.contacto.etapa === etapaPago) { await emitirHoy(null); return false }

  const espacio = espacioActual()
  const producto = txt(p.producto) || null
  const r = await prismaGlobal.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM crm_conversaciones WHERE id = ${convId} AND espacio_id = ${espacio} FOR UPDATE`
    const k = await tx.$queryRaw<{ etapa: string | null }[]>`SELECT etapa FROM crm_contactos WHERE id = ${c.contactoId} AND espacio_id = ${espacio} FOR UPDATE`
    if (!k[0]) return null
    const de = k[0].etapa ?? null
    if (de === etapaPago) return null
    const pago = { en: new Date().toISOString(), de, etapa: etapaPago, transaccion: txt(p.transaccion) || null, producto }
    await tx.$executeRaw`UPDATE crm_contactos SET etapa = ${etapaPago}, "updatedAt" = now() WHERE id = ${c.contactoId} AND espacio_id = ${espacio}`
    await tx.$executeRaw`UPDATE crm_conversaciones SET extra = jsonb_set(coalesce(extra, '{}'::jsonb), '{_pagoHotmart}', ${JSON.stringify(pago)}::jsonb) WHERE id = ${convId} AND espacio_id = ${espacio}`
    return { de }
  }, { maxWait: 15_000, timeout: 15_000 })
  if (!r) { await emitirHoy(null); return false }

  const t = producto ? `Hotmart confirmó el pago de ${producto}. Pasó a ${etapaPago}.` : `Hotmart confirmó el pago. Pasó a ${etapaPago}.`
  try {
    await guardarMensaje(convId, { ev: 'cart', t, pagoHotmart: { producto, de: r.de, a: etapaPago } }, { autorId: null, por: null })
  } catch (e) {
    logger.warn(`[CRM IA] embudo: no se pudo dejar el evento del pago en la conversación ${convId} (${(e as Error)?.message ?? e})`)
  }
  await emitirDelContacto(c.contactoId, null)
  await emitirHoy(null)
  // Las reglas de «Cambia la etapa» primero y después las de «Se confirma un pago» (las corre reglas.ts).
  await dispararReglas('etapa', convId, { antes: r.de, etapa: etapaPago, porHotmart: true })
  return true
}
