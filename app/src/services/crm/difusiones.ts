import { Prisma, type CrmConversacion, type CrmLinea } from '@prisma/client'
import { prisma, llaveAjuste } from './bd'
import { espacioActual } from './espacio'
import { logger } from '../../utils/logger'
import { leerAjuste } from './ajustes'
import { emitirCrm, emitirConv } from './tiempoReal'
import { guardarMensaje } from './salientes'
import { telDigitos } from './formas'
import { idDeNombre, nombreDe } from './usuarios'
import { avisar } from '../notificaciones'
import { avisarLideres } from './avisosCrm'
import { waConfigurado } from './whatsapp'
import { buscarPlantilla, variablesDe, type PlantillaMeta } from './plantillas'

/**
 * Motor de difusiones del CRM (26-sep-2026). La pantalla guarda cada difusión
 * en el ajuste `difusiones` ({id, n, t (plantilla), contactoIds, linea, ritmo,
 * para (ISO), por…}); este proceso las manda de verdad por WhatsApp, cada
 * minuto, por lotes, y deja el progreso en otro ajuste, `difusionesEstado`,
 * que la pantalla solo lee (no se puede escribir por PUT /crm/ajustes).
 *
 * Reglas:
 * - Ley 2300 de 2023: solo lunes a viernes de 7:00 a 19:00 y sábados de 8:00 a
 *   15:00, hora de Colombia; nunca domingos ni festivos. Fuera de eso queda
 *   «pausada» y sigue sola en la siguiente franja.
 * - Ritmo: `ritmo` mensajes por hora → un lote de ceil(ritmo/60) por minuto.
 * - Nadie recibe la misma difusión dos veces: el estado se toma con un candado
 *   de fila (SELECT … FOR UPDATE) y, además, antes de mandar a un contacto se
 *   mira si ya tiene un mensaje con `datos.difusion` = id (por si dos
 *   servidores o una caída a mitad de lote).
 * - Sin teléfono, con «No contactar» o en el Registro de Números Excluidos sin
 *   autorización (si `pd.rneOn`, prendido por defecto como en la pantalla) no
 *   reciben. Tampoco quien ya recibió esa misma plantilla en los últimos 7 días
 *   (lo promete el paso 1 de «Nueva difusión»). La línea de Alma nunca.
 */

type Json = Record<string, any>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})
const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const marcado = (v: unknown) => v !== null && v !== undefined && v !== false && v !== ''
const primerNombre = (n?: string | null) => String(n ?? '').trim().split(/\s+/)[0] || ''

export const CLAVE_ESTADO = 'difusionesEstado'
const DIA_MS = 86_400_000
/** Cifras (entregados, leídos, respondieron) que se recalculan: las difusiones de los últimos 14 días. */
const DIAS_CIFRAS = 14
/** Una difusión que nunca arrancó y cuya hora pasó hace más de esto no sale (no se manda algo viejo por sorpresa). */
const VENCE_COLA_MS = 72 * 3_600_000
/** Quien recibió la misma plantilla hace menos de esto no la vuelve a recibir en una difusión. */
const DIAS_MISMA_PLANTILLA = 7
/** Con dos servidores, un lote por minuto entre los dos: el que llega segundo espera. */
const ENTRE_LOTES_MS = 55_000
export const MOTIVO_CREADA = 'Creada por una difusión'
/** Las variables que la difusión llena sola por cada contacto (igual que whatsapp.ts). */
const VARIABLES_OK = new Set(['nombre', 'asesor', 'producto'])

export type EstadoNombre = 'cola' | 'enviando' | 'pausada' | 'terminada' | 'error'
export interface EstadoDifusion {
  estado: EstadoNombre
  /** Por qué está pausada o en error, para leerse después de «Pausada: » o «Error: ». */
  motivo?: string
  /** Pausada por horario: cuándo vuelve a abrir la franja permitida (ISO). */
  reanuda?: string
  /** Contactos que van a recibirla (sin los excluidos). */
  total: number
  enviados: number
  fallidos: number
  entregados: number
  leidos: number
  respondieron: number
  /** Quitados: sin teléfono, «No contactar», registro de excluidos sin autorizar, ya recibió la plantilla en 7 días o contacto borrado. */
  excluidos: number
  pendientes: number[]
  iniciada?: string
  terminada?: string
  /** Hora del último lote (para no duplicar el ritmo con dos servidores). */
  ultimoLote?: string
  /** Envíos que fallaron antes de quedar como mensaje; se suman a `fallidos`. */
  errores?: number
}
type Estados = Record<string, EstadoDifusion>

/** Lo que la pantalla guarda de cada difusión (10-nucleo.js y 30-legal.js). */
interface Difusion {
  id: string; n?: string; t?: string; contactoIds?: unknown; linea?: string | null
  ritmo?: unknown; para?: string; por?: string; total?: unknown
}

const TERMINAL = new Set<EstadoNombre>(['terminada', 'error'])

// ─── Hora de Colombia, Ley 2300 y festivos ───────────────────────────────────

const FMT_BOGOTA = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Bogota', year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: 'numeric', weekday: 'short', hour12: false,
})
const SEMANA_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sept.', 'oct.', 'nov.', 'dic.']

/** Año, mes (1-12), día, hora, minuto y día de la semana (0 = domingo) en Bogotá. */
export function partesBogota(d: Date) {
  const p = Object.fromEntries(FMT_BOGOTA.formatToParts(d).map(x => [x.type, x.value]))
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, wd: SEMANA_EN.indexOf(p.weekday) }
}

/** Un momento de Bogotá (UTC−5 todo el año, sin horario de verano) como Date. */
const deBogota = (y: number, m: number, d: number, minutos: number) => new Date(Date.UTC(y, m - 1, d, 0, minutos) + 5 * 3_600_000)
const isoDia = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

const festivosAño = new Map<number, string[]>()
/**
 * Festivos de Colombia de cualquier año (Ley 51 de 1983), igual que
 * `festivosCO` de 30-legal.js: los fijos, los que pasan al lunes siguiente
 * (Ley Emiliani) y los que dependen de la Pascua (Jueves y Viernes Santo
 * fijos; Ascensión, Corpus Christi y Sagrado Corazón al lunes). AAAA-MM-DD.
 */
export function festivosCO(y: number): string[] {
  const hechos = festivosAño.get(y)
  if (hechos) return hechos
  const dia = (mes: number, d: number) => new Date(Date.UTC(y, mes - 1, d))
  const alLunes = (f: Date) => { f.setUTCDate(f.getUTCDate() + (8 - f.getUTCDay()) % 7); return f }
  // Domingo de Pascua, calendario gregoriano (algoritmo anónimo de Meeus).
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, n = Math.floor((a + 11 * h + 22 * l) / 451)
  const mesP = Math.floor((h + l - 7 * n + 114) / 31), diaP = ((h + l - 7 * n + 114) % 31) + 1
  const pascua = (x: number) => dia(mesP, diaP + x)
  const lista = [
    dia(1, 1), dia(5, 1), dia(7, 20), dia(8, 7), dia(12, 8), dia(12, 25),
    ...[[1, 6], [3, 19], [6, 29], [8, 15], [10, 12], [11, 1], [11, 11]].map(([mes, dd]) => alLunes(dia(mes, dd))),
    pascua(-3), pascua(-2), alLunes(pascua(39)), alLunes(pascua(60)), alLunes(pascua(68)),
  ].map(x => x.toISOString().slice(0, 10)).sort()
  festivosAño.set(y, lista)
  return lista
}
export const esFestivo = (y: number, m: number, d: number) => festivosCO(y).includes(isoDia(y, m, d))

/** Franja permitida ese día en minutos [desde, hasta), o null (domingo o festivo). */
export function franjaLegal(y: number, m: number, d: number): [number, number] | null {
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  if (wd === 0 || esFestivo(y, m, d)) return null
  return wd === 6 ? [8 * 60, 15 * 60] : [7 * 60, 19 * 60]
}

const fmtMin = (m: number) => `${((Math.floor(m / 60) + 11) % 12) + 1}${m % 60 ? ':' + String(m % 60).padStart(2, '0') : ''} ${m < 720 ? 'a. m.' : 'p. m.'}`

export type Horario = { ok: true } | { ok: false; motivo: string; reanuda: Date | null; sigue: string }

/** ¿Se puede enviar ahora según la Ley 2300? Si no, por qué y cuándo vuelve a abrir. */
export function horarioLegal(ahora = new Date()): Horario {
  const t = partesBogota(ahora)
  const v = franjaLegal(t.y, t.m, t.d), min = t.h * 60 + t.mi
  if (v && min >= v[0] && min < v[1]) return { ok: true }
  const motivo = esFestivo(t.y, t.m, t.d) ? 'hoy es festivo' : t.wd === 0 ? 'hoy es domingo'
    : v && min < v[0] ? 'todavía no empieza el horario permitido' : 'ya pasó el horario permitido de hoy'
  if (v && min < v[0]) return { ok: false, motivo, reanuda: deBogota(t.y, t.m, t.d, v[0]), sigue: `hoy a las ${fmtMin(v[0])}` }
  for (let i = 1; i <= 15; i++) {
    const f = new Date(Date.UTC(t.y, t.m - 1, t.d + i))
    const y = f.getUTCFullYear(), m = f.getUTCMonth() + 1, d = f.getUTCDate()
    const w = franjaLegal(y, m, d)
    if (!w) continue
    const cuando = i === 1 ? 'mañana' : `el ${DIAS[f.getUTCDay()]} ${d} de ${MESES[m - 1]}`
    return { ok: false, motivo, reanuda: deBogota(y, m, d, w[0]), sigue: `${cuando} a las ${fmtMin(w[0])}` }
  }
  return { ok: false, motivo, reanuda: null, sigue: 'el próximo día hábil' }
}

// ─── Estado compartido con candado ───────────────────────────────────────────

/**
 * Lee `difusionesEstado` con candado de fila, deja que `fn` lo cambie y lo
 * guarda en la misma transacción. Un segundo servidor espera el candado y ve
 * lo que dejó el primero. Emite el ajuste solo si cambió.
 */
async function conEstado<T>(fn: (todo: Estados) => Promise<T>): Promise<T> {
  await prisma.$executeRaw`INSERT INTO crm_ajustes (espacio_id, clave, valor, "updatedAt") VALUES (${espacioActual()}, ${CLAVE_ESTADO}, '{}'::jsonb, NOW()) ON CONFLICT (espacio_id, clave) DO NOTHING`
  let nuevo: Estados | null = null
  const r = await prisma.$transaction(async tx => {
    const filas = await tx.$queryRaw<{ valor: unknown }[]>`SELECT valor FROM crm_ajustes WHERE espacio_id = ${espacioActual()} AND clave = ${CLAVE_ESTADO} FOR UPDATE`
    const todo = { ...obj(filas[0]?.valor) } as Estados
    const antes = JSON.stringify(todo)
    const res = await fn(todo)
    if (JSON.stringify(todo) !== antes) {
      await tx.crmAjuste.update({ where: llaveAjuste(CLAVE_ESTADO), data: { valor: todo as unknown as Prisma.InputJsonValue, actualizadoPorId: null } })
      nuevo = todo
    }
    return res
  }, { maxWait: 30_000, timeout: 5 * 60_000 })
  if (nuevo) emitirCrm({ tipo: 'ajuste', clave: CLAVE_ESTADO, valor: nuevo }, null)
  return r
}

// ─── Plantilla ───────────────────────────────────────────────────────────────

type InfoPlantilla = { ok: true; texto: string } | { ok: false; estado: 'error' | 'pausada'; motivo: string }

const ESTADO_PLANTILLA: Record<string, string> = {
  PENDING: 'sigue en revisión', IN_APPEAL: 'está en apelación', REJECTED: 'fue rechazada', DISABLED: 'fue deshabilitada',
  LIMIT_EXCEEDED: 'se pasó el límite de Meta', PENDING_DELETION: 'se está borrando', DELETED: 'fue borrada', ARCHIVED: 'está archivada',
}

/** La plantilla en Meta: que exista, esté aprobada y solo pida variables que la difusión sabe llenar. */
async function revisarPlantilla(linea: CrmLinea, nombre: string): Promise<InfoPlantilla> {
  if (!nombre) return { ok: false, estado: 'error', motivo: 'la difusión no tiene plantilla' }
  let p: PlantillaMeta | null
  try {
    p = await buscarPlantilla(linea.wabaId, nombre)
  } catch (e) {
    return { ok: false, estado: 'pausada', motivo: `no se pudo consultar la plantilla en Meta (${(e as Error).message}). Se reintenta sola cada minuto` }
  }
  if (!p) return { ok: false, estado: 'error', motivo: `la plantilla «${nombre}» ya no existe en Meta para la línea ${linea.nombre}` }
  if (p.status === 'PAUSED') return { ok: false, estado: 'pausada', motivo: `Meta pausó la plantilla «${nombre}» por baja calidad. Sigue sola cuando Meta la reactive` }
  if (p.status !== 'APPROVED') return { ok: false, estado: 'error', motivo: `la plantilla «${nombre}» no está aprobada en Meta: ${ESTADO_PLANTILLA[p.status] ?? p.status}` }
  const faltan = new Set<string>()
  let cabecera = '', cuerpo = ''
  for (const comp of p.components ?? []) {
    const tipo = String(comp.type ?? '').toUpperCase()
    if (tipo === 'HEADER') {
      const formato = String(comp.format ?? 'TEXT').toUpperCase()
      if (formato === 'TEXT') {
        cabecera = String(comp.text ?? '').trim()
        for (const v of variablesDe(cabecera)) if (!VARIABLES_OK.has(v)) faltan.add(`«${v}»`)
      } else if (['IMAGE', 'VIDEO', 'DOCUMENT'].includes(formato)) {
        faltan.add(formato === 'IMAGE' ? 'una imagen de encabezado' : formato === 'VIDEO' ? 'un video de encabezado' : 'un documento de encabezado')
      }
    } else if (tipo === 'BODY') {
      cuerpo = String(comp.text ?? '')
      for (const v of variablesDe(cuerpo)) if (!VARIABLES_OK.has(v)) faltan.add(`«${v}»`)
    } else if (tipo === 'BUTTONS') {
      for (const b of (comp.buttons ?? []) as Json[]) {
        if (String(b.type).toUpperCase() === 'URL' && String(b.url ?? '').includes('{{')) faltan.add(`el enlace del botón «${b.text ?? ''}»`)
      }
    }
  }
  if (faltan.size) {
    return { ok: false, estado: 'error', motivo: `la plantilla «${nombre}» necesita ${[...faltan].join(', ')} y la difusión solo llena {{nombre}}, {{asesor}} y {{producto}} por cada contacto. Usa otra plantilla` }
  }
  return { ok: true, texto: [cabecera, cuerpo].filter(Boolean).join('\n') }
}

const rellenar = (texto: string, valores: Record<string, string>) =>
  texto.replace(/\{\{\s*([^{}\s]+)\s*\}\}/g, (todo, v: string) => valores[v] || todo)

// ─── Audiencia ───────────────────────────────────────────────────────────────

const SEL_CONTACTO = { id: true, nombre: true, telefono: true, noContactar: true, rne: true, autorizacion: true, campos: true } as const
type ContactoDif = Prisma.CrmContactoGetPayload<{ select: typeof SEL_CONTACTO }>

function puedeRecibir(k: ContactoDif, rneOn: boolean): boolean {
  const tel = telDigitos(k.telefono)
  if (!tel || tel.length < 8) return false
  if (marcado(k.noContactar)) return false
  if (rneOn && marcado(k.rne) && !marcado(k.autorizacion)) return false
  return true
}

async function contactos(ids: number[]): Promise<ContactoDif[]> {
  const out: ContactoDif[] = []
  for (let i = 0; i < ids.length; i += 5000) {
    out.push(...await prisma.crmContacto.findMany({ where: { id: { in: ids.slice(i, i + 5000) } }, select: SEL_CONTACTO }))
  }
  return out
}

/** De estos contactos, quiénes ya recibieron la misma plantilla (sin fallar) en los últimos 7 días, fuera de esta difusión. */
async function recibieronPlantilla(ids: number[], d: Difusion, ahora: Date): Promise<Set<number>> {
  const plantilla = txt(d.t)
  if (!ids.length || !plantilla) return new Set()
  const desde = new Date(ahora.getTime() - DIAS_MISMA_PLANTILLA * DIA_MS)
  const out = new Set<number>()
  for (let i = 0; i < ids.length; i += 5000) {
    const filas = await prisma.$queryRaw<{ id: number }[]>`
      SELECT DISTINCT c.contacto_id AS id FROM crm_mensajes m JOIN crm_conversaciones c ON c.id = m.conversacion_id
      WHERE c.contacto_id IN (${Prisma.join(ids.slice(i, i + 5000))}) AND m.tipo = 'out' AND m.datos->>'plantilla' = ${plantilla}
        AND COALESCE(m.estado, '') <> 'fallido' AND m."createdAt" >= ${desde} AND m."createdAt" <= ${ahora}
        AND COALESCE(m.datos->>'difusion', '') <> ${d.id}`
    for (const f of filas) out.add(Number(f.id))
  }
  return out
}

/** Los contactoIds de la pantalla, sin repetidos y sin quien no puede recibir, en el mismo orden. */
async function prepararAudiencia(d: Difusion, rneOn: boolean, ahora: Date): Promise<{ ids: number[]; excluidos: number } | { error: string }> {
  if (!Array.isArray(d.contactoIds)) return { error: 'la difusión no trae la lista de contactos (se creó antes del envío real). Créala de nuevo' }
  const ids = [...new Set(d.contactoIds.map(Number).filter(n => Number.isInteger(n) && n > 0))]
  const validos = new Set((await contactos(ids)).filter(k => puedeRecibir(k, rneOn)).map(k => k.id))
  const yaLaTienen = await recibieronPlantilla([...validos], d, ahora)
  const lista = ids.filter(id => validos.has(id) && !yaLaTienen.has(id))
  return { ids: lista, excluidos: ids.length - lista.length }
}

// ─── Envío ───────────────────────────────────────────────────────────────────

interface Contexto {
  ahora: Date
  horario: Horario
  lineas: CrmLinea[]
  rneOn: boolean
  cvcfg: { mismo: boolean; dias: number }
  cfg: Json
  plantillas: Map<string, InfoPlantilla>
}

const equipoDe = (linea: CrmLinea, cfg: Json) =>
  txt((Array.isArray(cfg.lineas) ? cfg.lineas : []).find((l: Json) => l?.id === linea.id)?.eq) || txt(obj(linea.ajustes).equipo) || 'Ventas'

/**
 * La conversación donde queda el mensaje: la última del contacto en esa
 * línea. Si está finalizada y ya no se reabriría cuando el cliente responda
 * (cvcfg: `mismo` y `diasMismo`, con margen para responder), se crea una nueva
 * finalizada, para que la respuesta caiga junto a la plantilla. Sin ninguna,
 * se crea finalizada: la difusión no llena la bandeja y entrantes.ts la
 * reabre cuando el cliente escribe.
 */
async function conversacionPara(contactoId: number, linea: CrmLinea, ctx: Contexto): Promise<CrmConversacion> {
  const ultima = await prisma.crmConversacion.findFirst({ where: { contactoId, lineaId: linea.id }, orderBy: { createdAt: 'desc' } })
  if (ultima) {
    if (ultima.estado !== 'finalizadas') return ultima
    const fin = ultima.finalizadaAt?.getTime() ?? 0
    const { mismo, dias } = ctx.cvcfg
    // Margen para que alcance a responder: una semana, o la mitad de la ventana si es más corta.
    const margen = Math.min(7, dias / 2)
    if (!mismo || dias <= 0 || (fin && fin + (dias - margen) * DIA_MS > Date.now())) return ultima
  }
  return prisma.crmConversacion.create({
    data: { contactoId, canal: 'wa', lineaId: linea.id, equipo: equipoDe(linea, ctx.cfg), estado: 'finalizadas', finalizadaAt: new Date(), motivoFin: MOTIVO_CREADA },
  })
}

async function enviarA(k: ContactoDif, d: Difusion, linea: CrmLinea, texto: string, autorId: string | null, ctx: Contexto) {
  const conv = await conversacionPara(k.id, linea, ctx)
  const asesor = primerNombre(await nombreDe(conv.asignadoId ?? autorId))
  const out = rellenar(texto, { nombre: primerNombre(k.nombre), asesor, producto: txt(obj(k.campos).producto) })
  await guardarMensaje(conv.id, { out, plantilla: txt(d.t), difusion: d.id, by: txt(d.por) || null }, { autorId, por: null })
  // Una difusión no es la respuesta del asesor: si el cliente esperaba respuesta, sigue esperando.
  if (conv.esperaDesde || conv.noLeidos) {
    await prisma.crmConversacion.update({ where: { id: conv.id }, data: { esperaDesde: conv.esperaDesde, noLeidos: conv.noLeidos } })
    await emitirConv(conv.id, null)
  }
}

/** Manda un lote. Devuelve cuántos mensajes quedaron guardados (y en camino a Meta). */
async function enviarLote(d: Difusion, e: EstadoDifusion, lote: number[], linea: CrmLinea, texto: string, ctx: Contexto): Promise<number> {
  if (!lote.length) return 0
  const mapa = new Map((await contactos(lote)).map(k => [k.id, k]))
  // Quien ya la recibió (otro servidor o un lote que se cortó a la mitad) no la recibe otra vez.
  const ya = await prisma.$queryRaw<{ id: number }[]>`
    SELECT DISTINCT c.contacto_id AS id FROM crm_mensajes m JOIN crm_conversaciones c ON c.id = m.conversacion_id
    WHERE c.contacto_id IN (${Prisma.join(lote)}) AND m.datos->>'difusion' = ${d.id}`
  const recibida = new Set(ya.map(x => Number(x.id)))
  const plantillaReciente = await recibieronPlantilla(lote, d, ctx.ahora)
  const autorId = await idDeNombre(txt(d.por) || null)
  let n = 0
  for (const id of lote) {
    if (recibida.has(id)) continue
    const k = mapa.get(id)
    // Cambió desde que se armó la difusión (lo borraron, pidió no contactar, le llegó la plantilla por otro lado…): se quita.
    if (!k || !puedeRecibir(k, ctx.rneOn) || plantillaReciente.has(id)) { e.excluidos++; e.total = Math.max(0, e.total - 1); continue }
    try {
      await enviarA(k, d, linea, texto, autorId, ctx)
      n++
    } catch (err) {
      e.errores = (e.errores ?? 0) + 1
      logger.error(`[CRM difusiones] ${d.id}, contacto ${id}: ${(err as Error)?.message ?? err}`)
    }
  }
  return n
}

// ─── Una difusión, un minuto ─────────────────────────────────────────────────

const paraDe = (d: Difusion, ahora: Date) => {
  const p = Date.parse(txt(d.para))
  return Number.isFinite(p) ? p : ahora.getTime()
}
const loteDe = (ritmo: unknown) => Math.ceil(Math.min(Math.max(Number(ritmo) || 200, 1), 3000) / 60)

function fallar(e: EstadoDifusion, motivo: string, ahora: Date) {
  e.estado = 'error'
  e.motivo = motivo
  delete e.reanuda
  e.terminada = ahora.toISOString()
}
function pausar(e: EstadoDifusion, motivo: string, reanuda: Date | null) {
  e.estado = 'pausada'
  e.motivo = motivo
  if (reanuda) e.reanuda = reanuda.toISOString()
  else delete e.reanuda
}
const nuevo = (d: Difusion): EstadoDifusion => ({
  estado: 'cola', total: Number(d.total) || 0, enviados: 0, fallidos: 0, entregados: 0, leidos: 0, respondieron: 0, excluidos: 0, pendientes: [],
})

async function avanzar(d: Difusion, todo: Estados, ctx: Contexto): Promise<number> {
  const { ahora } = ctx
  let e = todo[d.id]
  if (e && TERMINAL.has(e.estado)) return 0
  if (!e) e = todo[d.id] = nuevo(d)
  const para = paraDe(d, ahora)
  if (para > ahora.getTime()) { e.estado = 'cola'; return 0 }

  if (e.estado === 'cola') {
    if (ahora.getTime() - para > VENCE_COLA_MS) {
      const b = partesBogota(new Date(para))
      fallar(e, `no salió a tiempo: estaba para el ${b.d} de ${MESES[b.m - 1]} y nunca arrancó. Créala de nuevo si todavía aplica`, ahora)
      return 0
    }
    const r = await prepararAudiencia(d, ctx.rneOn, ahora)
    if ('error' in r) { fallar(e, r.error, ahora); return 0 }
    e.pendientes = r.ids
    e.total = r.ids.length
    e.excluidos = r.excluidos
    if (!e.total) {
      fallar(e, 'ningún contacto de la difusión se puede contactar: no tienen teléfono, pidieron no recibir mensajes, están en el registro de excluidos sin autorizar o ya recibieron esta plantilla en los últimos 7 días', ahora)
      return 0
    }
    e.estado = 'enviando'
  }

  if (!d.linea) { fallar(e, 'la difusión no tiene línea de salida', ahora); return 0 }
  const linea = ctx.lineas.find(l => l.id === d.linea)
  if (!linea) { fallar(e, 'la línea de salida ya no está conectada en el CRM. Crea la difusión de nuevo con otra línea', ahora); return 0 }
  if (!(await waConfigurado())) { fallar(e, 'WhatsApp no está conectado en el CRM (Ajustes, Canales)', ahora); return 0 }

  const h = ctx.horario
  if (!h.ok) {
    pausar(e, `fuera del horario permitido por la Ley 2300 (${h.motivo}). Sigue sola ${h.sigue}`, h.reanuda)
    return 0
  }
  const p = ctx.plantillas.get(d.id)
  if (!p) { pausar(e, 'no se alcanzó a revisar la plantilla. Se reintenta sola en un minuto', null); return 0 }
  if (!p.ok) {
    if (p.estado === 'error') fallar(e, p.motivo, ahora)
    else pausar(e, p.motivo, null)
    return 0
  }

  if (e.ultimoLote && ahora.getTime() - Date.parse(e.ultimoLote) < ENTRE_LOTES_MS) {
    // Otro servidor ya mandó el lote de este minuto.
    e.estado = 'enviando'
    delete e.motivo
    delete e.reanuda
    return 0
  }
  const lote = e.pendientes.slice(0, loteDe(d.ritmo))
  const enviados = await enviarLote(d, e, lote, linea, p.texto, ctx)
  e.pendientes = e.pendientes.slice(lote.length)
  e.ultimoLote = ahora.toISOString()
  if (!e.iniciada) e.iniciada = ahora.toISOString()
  delete e.motivo
  delete e.reanuda
  if (e.pendientes.length) e.estado = 'enviando'
  else { e.estado = 'terminada'; e.terminada = ahora.toISOString() }
  return enviados
}

// ─── Cifras reales ───────────────────────────────────────────────────────────

interface Cifras { id: string; enviados: number; fallidos: number; entregados: number; leidos: number; respondieron: number }

/**
 * Enviados (sin los fallidos), fallidos, entregados (entregado o leído),
 * leídos y respondieron: contactos que escribieron en esa línea después de
 * recibirla (aunque la respuesta haya abierto otra conversación).
 */
async function actualizarCifras(todo: Estados, difs: Difusion[], ahora: Date) {
  const limite = ahora.getTime() - DIAS_CIFRAS * DIA_MS
  const ids = difs.map(d => d.id).filter(id => {
    const e = todo[id]
    if (!e || !e.iniciada) return false
    return !TERMINAL.has(e.estado) || Date.parse(e.iniciada) >= limite
  })
  if (!ids.length) return
  const filas = await prisma.$queryRaw<Cifras[]>`
    SELECT x.id,
      COUNT(*) FILTER (WHERE COALESCE(x.estado, '') <> 'fallido')::int AS enviados,
      COUNT(*) FILTER (WHERE x.estado = 'fallido')::int AS fallidos,
      COUNT(*) FILTER (WHERE x.estado IN ('entregado', 'leido'))::int AS entregados,
      COUNT(*) FILTER (WHERE x.estado = 'leido')::int AS leidos,
      COUNT(DISTINCT x.contacto_id) FILTER (WHERE x.respondio AND COALESCE(x.estado, '') <> 'fallido')::int AS respondieron
    FROM (
      SELECT m.datos->>'difusion' AS id, m.estado, c.contacto_id,
        EXISTS (
          SELECT 1 FROM crm_mensajes r JOIN crm_conversaciones rc ON rc.id = r.conversacion_id
          WHERE rc.contacto_id = c.contacto_id AND rc.linea_id IS NOT DISTINCT FROM c.linea_id
            AND r.tipo = 'in' AND r."createdAt" > m."createdAt"
        ) AS respondio
      FROM crm_mensajes m JOIN crm_conversaciones c ON c.id = m.conversacion_id
      WHERE m.espacio_id = ${espacioActual()} AND m.tipo = 'out' AND m.datos->>'difusion' IN (${Prisma.join(ids)})
    ) x
    GROUP BY x.id`
  const mapa = new Map(filas.map(f => [f.id, f]))
  for (const id of ids) {
    const e = todo[id]
    const f = mapa.get(id)
    e.enviados = Number(f?.enviados ?? 0)
    e.fallidos = Number(f?.fallidos ?? 0) + (e.errores ?? 0)
    e.entregados = Number(f?.entregados ?? 0)
    e.leidos = Number(f?.leidos ?? 0)
    e.respondieron = Number(f?.respondieron ?? 0)
  }
}

// ─── Ciclo ───────────────────────────────────────────────────────────────────

/**
 * Un minuto del motor, sin la bandera en memoria (las pruebas lo llaman dos
 * veces a la vez para simular dos servidores). `ahora` se puede fijar.
 * Devuelve cuántos mensajes salieron.
 */
export async function cicloDifusiones(ahora = new Date()): Promise<number> {
  const config = await leerAjuste<unknown>('difusiones')
  const difs = (Array.isArray(config) ? config : []).map(obj).filter(d => txt(d.id)) as Difusion[]
  if (!difs.length) return 0
  const previo = obj(await leerAjuste(CLAVE_ESTADO)) as Estados
  const limite = ahora.getTime() - DIAS_CIFRAS * DIA_MS
  const hayTrabajo = difs.some(d => {
    const e = previo[d.id]
    return !e || !TERMINAL.has(e.estado) || (e.iniciada && Date.parse(e.iniciada) >= limite)
  })
  if (!hayTrabajo) return 0

  const [lineas, pd, cv, cfg] = await Promise.all([prisma.crmLinea.findMany(), leerAjuste('pd'), leerAjuste('cvcfg'), leerAjuste('cfg')])
  const cvcfg = { mismo: true, diasMismo: '30', ...obj(cv) }
  const ctx: Contexto = {
    ahora,
    horario: horarioLegal(ahora),
    lineas,
    rneOn: obj(pd).rneOn !== false,
    cvcfg: { mismo: cvcfg.mismo !== false, dias: Number(String(cvcfg.diasMismo ?? '').replace(/\D/g, '')) || 0 },
    cfg: obj(cfg),
    plantillas: new Map(),
  }

  // Las plantillas se consultan en Meta antes de tomar el candado (solo las que pueden salir ya).
  if (ctx.horario.ok && await waConfigurado()) {
    const porLinea = new Map<string, InfoPlantilla>()
    for (const d of difs) {
      const e = previo[d.id]
      if ((e && TERMINAL.has(e.estado)) || paraDe(d, ahora) > ahora.getTime()) continue
      const linea = lineas.find(l => l.id === d.linea)
      if (!linea) continue
      const clave = `${linea.wabaId}|${txt(d.t)}`
      if (!porLinea.has(clave)) porLinea.set(clave, await revisarPlantilla(linea, txt(d.t)))
      ctx.plantillas.set(d.id, porLinea.get(clave)!)
    }
  }

  // Las que terminan o fallan en esta vuelta: se avisa a quien la creó cuando el estado ya quedó guardado.
  const cerradas: Difusion[] = []
  let final: Estados = {}
  const enviados = await conEstado(async todo => {
    let n = 0
    for (const d of difs) {
      const antes = todo[d.id]?.estado
      try {
        n += await avanzar(d, todo, ctx)
      } catch (e) {
        logger.error(`[CRM difusiones] ${d.id}: ${(e as Error)?.message ?? e}`)
      }
      const despues = todo[d.id]?.estado
      if (despues && TERMINAL.has(despues) && !(antes && TERMINAL.has(antes))) cerradas.push(d)
    }
    await actualizarCifras(todo, difs, ahora)
    final = todo
    return n
  })
  for (const d of cerradas) await avisarDifusion(d, final[d.id]).catch(e => logger.warn(`[CRM difusiones] aviso de ${d.id}: ${(e as Error)?.message ?? e}`))
  return enviados
}

/** A la campana de quien creó la difusión (o de los líderes, si ya no está en el CRM). */
async function avisarDifusion(d: Difusion, e: EstadoDifusion | undefined) {
  if (!e) return
  const nombre = txt(d.n) || 'sin nombre'
  const aviso = e.estado === 'terminada'
    ? { tipo: 'TAREA_PUBLICADA' as const, titulo: 'Difusión terminada', texto: `La difusión «${nombre}» terminó: ${e.enviados} ${e.enviados === 1 ? 'enviado' : 'enviados'}${e.fallidos ? ` y ${e.fallidos} ${e.fallidos === 1 ? 'fallido' : 'fallidos'}` : ''}.` }
    : { tipo: 'CAMBIOS_PEDIDOS' as const, titulo: 'Una difusión se detuvo', texto: `La difusión «${nombre}» se detuvo: ${txt(e.motivo) || 'sin detalle'}.` }
  const userId = await idDeNombre(txt(d.por))
  if (userId) await avisar({ userId, ...aviso, url: '/?ir=difusiones' })
  else await avisarLideres({ ...aviso, url: '/?ir=difusiones' })
}

let corriendo = false

/** Lo llama procesos.ts cada minuto; no se solapa consigo mismo en este servidor. */
export async function procesarDifusiones(ahora = new Date()): Promise<number> {
  if (corriendo) return 0
  corriendo = true
  try {
    return await cicloDifusiones(ahora)
  } finally {
    corriendo = false
  }
}
