import { AsyncLocalStorage } from 'async_hooks'
import Anthropic from '@anthropic-ai/sdk'
import type { CrmContacto, CrmConversacion, CrmLinea, CrmMensaje, Prisma } from '@prisma/client'
import { prisma } from './bd'
import { enEspacio, espacioActual, ESPACIO_POR_DEFECTO } from './espacio'
import { logger } from '../../utils/logger'
import { usuariosConectados } from '../../utils/sseManager'
import { avisar } from '../notificaciones'
import { leerAjuste, guardarAjuste, leerPreferencias } from './ajustes'
import { usuariosCrm, nombreDe, type UsuarioCrm } from './usuarios'
import { emitirConv, emitirCrm, emitirMsg } from './tiempoReal'
import { archivosDe, guardarMensaje, mensajeDeArchivo } from './salientes'
import { configReparto, miembrosDe, repartirA } from './reparto'
import { equipoDeConv, leerEquipos } from './equipos'
import { alcanceDePersona } from './alcance'
import { fichaDeContacto } from './fichaExterna'
import { buscarPlantilla, variablesDe } from './plantillas'
import { waConfigurado } from './whatsapp'
import { agenteIniciar } from './agenteIA'
import type { CtxEntrante } from './automatizaciones'
import { CANALES_CONEXION, nombreCanal, tieneSalida } from './formas'
import { motorIA, SIN_MOTOR } from './motorIA'

/**
 * Reglas automáticas del CRM (página «Reglas automáticas» de la maqueta,
 * ajuste `reglas`): «cuando pasa esto, si se cumple esto, haz esto otro».
 *
 * - Cada regla es `{n, on, cuando, si[], ent[], origen?}` con los textos que
 *   arma el editor de la pantalla (R_CUANDO, R_SI, R_ENT y «Línea es …»).
 *   Si el ajuste nunca se guardó, valen las tres reglas que la pantalla
 *   muestra encendidas por defecto (REGLAS de 10-nucleo.js).
 * - Una condición que no se entiende deja la regla quieta; una acción que no
 *   se entiende no se inventa. Las dos cosas dejan un evento con el porqué.
 * - Cada regla que hace algo deja `{ev:'flow', t:'Regla «n»: …'}`. Lo que no
 *   pudo hacer (Ley 2300, plantilla sin aprobar, sin agente…) va en un
 *   `{ev:'bell'}` con el motivo, una sola vez cada 12 horas por conversación.
 * - Cadena: lo que hace una regla puede disparar otros eventos (cambiar la
 *   etapa dispara «Cambia la etapa», asignar dispara «Se asigna…»), pero la
 *   misma regla no vuelve a correr sobre la misma conversación en la misma
 *   cadena. La cadena viaja con AsyncLocalStorage, así que también la
 *   respetan los disparadores que el integrador ponga en reparto.ts o en el
 *   PATCH si se llaman desde dentro de una regla. Más de 6 eslabones seguidos
 *   se cortan y dejan un aviso.
 * - Lo que le llega al cliente: nunca una variable sin llenar («{{fecha}}»),
 *   nunca la misma respuesta automática dos veces seguidas, nunca encima de
 *   un flujo o del agente que ya están contestando ese mensaje, y ninguna
 *   plantilla a un contacto con «No contactar».
 */

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})
const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const lista = (v: unknown): string[] => (Array.isArray(v) ? v.map(x => txt(x)).filter(Boolean) : [])
/** Para comparar: minúsculas, sin tildes y con los espacios normalizados. */
const plano = (t: unknown) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()
const limpio = (t: unknown) => String(t ?? '').normalize('NFC').replace(/\s+/g, ' ').trim()
const sinComillas = (t: string) => t.trim().replace(/^[«"'“/]+|[»"'”.]+$/g, '').trim()
const marcado = (v: unknown) => v !== null && v !== undefined && v !== false && v !== ''
const primerNombre = (n?: string | null) => String(n ?? '').trim().split(/\s+/)[0] || ''
/** Un texto de la regla dentro de un aviso: sin pasar de `max` caracteres. */
const corto = (t: string, max = 200) => (t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t)
const json = (v: unknown) => v as Prisma.InputJsonValue

// ─── Qué dispara cada regla ──────────────────────────────────────────────────

export type EventoRegla = 'mensaje' | 'asignada' | 'etapa' | 'pago' | 'sinRespuesta' | 'finalizada' | 'vuelve'

/** R_CUANDO de la pantalla → evento. */
const CUANDO: Record<string, EventoRegla> = {
  'llega un mensaje nuevo': 'mensaje',
  'se asigna una conversacion': 'asignada',
  'cambia la etapa': 'etapa',
  'se confirma un pago': 'pago',
  // Nombre anterior del disparador: las reglas guardadas antes del 28-sep lo traen así.
  'hotmart confirma un pago': 'pago',
  'pasan 48 horas sin respuesta del cliente': 'sinRespuesta',
  'se finaliza la conversacion': 'finalizada',
  // Lote 6b (1-oct): escribe a una conversación finalizada, ya sea que se reabra o que empiece otra.
  'la persona vuelve a escribir despues de finalizar': 'vuelve',
}
export const eventoDeCuando = (cuando: unknown): EventoRegla | null => CUANDO[plano(cuando).replace(/[.;:]+$/, '').trim()] ?? null

export interface Regla { n: string; on: boolean; cuando: string; si: string[]; ent: string[]; origen?: string }

/** Las mismas que la pantalla muestra encendidas cuando el ajuste `reglas` nunca se guardó. */
export const REGLAS_DEFECTO: Regla[] = [
  { n: 'El agente IA responde de noche', on: false, cuando: 'Llega un mensaje nuevo', si: ['Fuera del horario de atención'], ent: ['Responde el agente IA', 'Dejar resumen en nota privada'] },
  { n: 'Pago confirmado', on: true, cuando: 'Se confirma un pago', si: [], ent: ['Cambiar etapa a Pagado', 'Pasar al equipo Recuperación de ventas si es a cuotas'] },
  { n: 'Sin respuesta 48 horas', on: true, cuando: 'Pasan 48 horas sin respuesta del cliente', si: ['Etapa es Contactado o En seguimiento'], ent: ['Cambiar etapa a Sin respuesta', 'Crear recordatorio para el asesor'] },
]

export async function reglasGuardadas(): Promise<Regla[]> {
  const v = await leerAjuste<unknown>('reglas')
  const filas = v === null ? REGLAS_DEFECTO : Array.isArray(v) ? v : []
  // Una condición o una acción guardada como texto suelto (no como lista) vale igual: ignorarla haría la regla más amplia.
  const textos = (x: unknown) => (typeof x === 'string' ? lista([x]) : lista(x))
  return filas.map(obj).map(r => ({
    n: txt(r.n) || 'Sin nombre', on: r.on === true, cuando: txt(r.cuando), si: textos(r.si), ent: textos(r.ent),
    ...(txt(r.origen) ? { origen: txt(r.origen) } : {}),
  }))
}

// ─── Hora de Colombia, festivos, Ley 2300 y horario de atención ─────────────

const FMT_BOGOTA = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Bogota', year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: 'numeric', weekday: 'short', hour12: false,
})
const SEMANA_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.']

/** Año, mes (1 a 12), día, hora, minuto y día de la semana (0 = domingo) en Bogotá. */
function partesBogota(d: Date) {
  const p = Object.fromEntries(FMT_BOGOTA.formatToParts(d).map(x => [x.type, x.value]))
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour % 24, mi: +p.minute, wd: SEMANA_EN.indexOf(p.weekday) }
}
/**
 * El calendario que miran la Ley 2300 y el horario de atención. Solo las
 * pruebas lo cambian (fijarReloj); los plazos de 24 y 48 horas siempre usan la hora real.
 */
let relojPruebas: (() => Date) | null = null
const ahoraCalendario = () => relojPruebas?.() ?? new Date()
/** Solo para pruebas: fija el día y la hora de Colombia que ven las reglas. null vuelve al reloj real. */
export function fijarReloj(f: (() => Date) | null) { relojPruebas = f }

/** Colombia es UTC−5 todo el año. */
const deBogota = (y: number, m: number, d: number, minutos: number) => new Date(Date.UTC(y, m - 1, d, 0, minutos) + 5 * 3_600_000)
const isoDia = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

const festivosAño = new Map<number, string[]>()
/** Festivos de Colombia (Ley 51 de 1983), igual que `festivosCO` de 30-legal.js. AAAA-MM-DD. */
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
  const fechas = [
    dia(1, 1), dia(5, 1), dia(7, 20), dia(8, 7), dia(12, 8), dia(12, 25),
    ...[[1, 6], [3, 19], [6, 29], [8, 15], [10, 12], [11, 1], [11, 11]].map(([mes, dd]) => alLunes(dia(mes, dd))),
    pascua(-3), pascua(-2), alLunes(pascua(39)), alLunes(pascua(60)), alLunes(pascua(68)),
  ].map(x => x.toISOString().slice(0, 10)).sort()
  festivosAño.set(y, fechas)
  return fechas
}
const esFestivo = (y: number, m: number, d: number) => festivosCO(y).includes(isoDia(y, m, d))

/** Franja de la Ley 2300 ese día, en minutos [desde, hasta), o null (domingo o festivo). */
function franjaLegal(y: number, m: number, d: number): [number, number] | null {
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay()
  if (wd === 0 || esFestivo(y, m, d)) return null
  return wd === 6 ? [8 * 60, 15 * 60] : [7 * 60, 19 * 60]
}
const horaTexto = (min: number) => `${((Math.floor(min / 60) + 11) % 12) + 1}${min % 60 ? ':' + String(min % 60).padStart(2, '0') : ''} ${min < 720 ? 'a. m.' : 'p. m.'}`

export type Legal = { ok: true } | { ok: false; motivo: string; abre: Date | null; sigue: string }

/**
 * Ley 2300 de 2023: el contacto comercial que inicia la empresa solo va de
 * lunes a viernes de 7 a. m. a 7 p. m. y los sábados de 8 a. m. a 3 p. m.,
 * nunca domingos ni festivos. Si ahora no se puede, dice por qué y cuándo abre.
 */
export function horarioLegal(ahora = ahoraCalendario()): Legal {
  const t = partesBogota(ahora)
  const v = franjaLegal(t.y, t.m, t.d), min = t.h * 60 + t.mi
  if (v && min >= v[0] && min < v[1]) return { ok: true }
  const motivo = esFestivo(t.y, t.m, t.d) ? 'hoy es festivo' : t.wd === 0 ? 'hoy es domingo'
    : v && min < v[0] ? 'todavía no empieza el horario permitido' : 'ya pasó el horario permitido de hoy'
  if (v && min < v[0]) return { ok: false, motivo, abre: deBogota(t.y, t.m, t.d, v[0]), sigue: `hoy a las ${horaTexto(v[0])}` }
  for (let i = 1; i <= 15; i++) {
    const f = new Date(Date.UTC(t.y, t.m - 1, t.d + i))
    const y = f.getUTCFullYear(), m = f.getUTCMonth() + 1, d = f.getUTCDate()
    const w = franjaLegal(y, m, d)
    if (!w) continue
    const cuando = i === 1 ? 'mañana' : `el ${DIAS[f.getUTCDay()]} ${d} de ${MESES[m - 1]}`
    return { ok: false, motivo, abre: deBogota(y, m, d, w[0]), sigue: `${cuando} a las ${horaTexto(w[0])}` }
  }
  return { ok: false, motivo, abre: null, sigue: 'el próximo día hábil' }
}

/** El horario de atención que muestra la pantalla si `cfg.horario` nunca se guardó (de lunes a domingo). */
const HORARIO_DEFECTO = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(d => [d, '7:00', '22:00', true])

/** '7:00', '22:00', '7 a. m.', '10:30 p. m.' → minutos del día (null si no se entiende). */
function aMinutos(t: unknown): number | null {
  const m = String(t ?? '').toLowerCase().match(/^\s*(\d{1,2})(?:[:.](\d{2}))?\s*(a|p)?\.?\s*(?:m\.?)?\s*$/)
  if (!m) return null
  let h = Number(m[1]); const mm = Number(m[2] ?? 0)
  if (m[3] === 'p' && h < 12) h += 12
  if (m[3] === 'a' && h === 12) h = 0
  if (h > 24 || mm > 59) return null
  return h * 60 + mm
}

/**
 * ¿Ese instante cae fuera del horario de atención (Ajustes del CRM, Horario)?
 * Igual que `fueraDeHorario` de la pantalla: filas de lunes a domingo
 * `[día, desde, hasta, abierto]`, y con «Festivos como domingo» prendido un
 * festivo usa la fila del domingo. Una franja que pasa la medianoche también vale.
 */
export function fueraDeHorario(cfg: Json, d = ahoraCalendario()): boolean {
  const H = Array.isArray(cfg.horario) && cfg.horario.length ? cfg.horario : HORARIO_DEFECTO
  const t = partesBogota(d)
  const festivo = cfg.festivos !== false && esFestivo(t.y, t.m, t.d)
  const fila = H[festivo ? 6 : (t.wd + 6) % 7]
  if (!Array.isArray(fila) || !fila[3]) return true
  const de = aMinutos(fila[1]), a = aMinutos(fila[2])
  if (de === null || a === null) return false
  const min = t.h * 60 + t.mi
  return de <= a ? min < de || min >= a : min < de && min >= a
}

/** «Hoy, 4:00 p. m.», «Mañana, 7:00 a. m.» o «Lunes 29 de sep., 7:00 a. m.», como `hcCuando` de la pantalla. */
function cuandoTexto(f: Date): string {
  const p = partesBogota(f), hoy = partesBogota(ahoraCalendario())
  const dias = Math.round((Date.UTC(p.y, p.m - 1, p.d) - Date.UTC(hoy.y, hoy.m - 1, hoy.d)) / 86_400_000)
  const dia = dias === 0 ? 'Hoy' : dias === 1 ? 'Mañana' : `${DIAS[p.wd][0].toUpperCase()}${DIAS[p.wd].slice(1)} ${p.d} de ${MESES[p.m - 1]}`
  return `${dia}, ${horaTexto(p.h * 60 + p.mi)}`
}

// ─── Cadena de reglas (para que no se disparen en bucle) ────────────────────

interface Cadena {
  corridas: Set<string>; inicio: number; nivel: number
  /** Lo que devuelve el llamado que empezó la cadena: ahí se suma lo que corrió en los eventos que desató. */
  raiz: ResultadoReglas
}
const cadena = new AsyncLocalStorage<Cadena>()
/** Una cadena dura lo que dura el evento que la empezó; algo que se dispare mucho después empieza otra. */
const VIDA_CADENA = 2 * 60_000
const MAX_NIVEL = 6

export interface ResultadoReglas {
  /** Nombres de las reglas que corrieron (condiciones cumplidas), en orden. El primer llamado de una cadena suma también las de los eventos que desató. */
  corridas: string[]
  /** El agente IA tomó la conversación por una regla («Responde el agente IA»). */
  agente: boolean
}

// ─── Conversación con todo lo que miran las reglas ──────────────────────────

type Conv = CrmConversacion & { contacto: CrmContacto; linea: CrmLinea | null }
const cargar = (convId: number) => prisma.crmConversacion.findUnique({ where: { id: convId }, include: { contacto: true, linea: true } }) as Promise<Conv | null>

interface Ctx {
  r: Regla; evento: EventoRegla; convId: number; datos: Json; res: ResultadoReglas
  /**
   * Eventos que causó la regla (asignó, cambió la etapa). Corren cuando la
   * regla termina todas sus acciones, en la misma cadena: así el chat se lee
   * en orden (primero lo que hizo esta regla, después lo que eso desató).
   */
  despues: [EventoRegla, Json][]
  /** La etapa en que dejó al contacto «Cambiar etapa a» o «Volver a la etapa…» (para el evento «Pasó a … al finalizar»). */
  etapaPuesta?: string
}
interface Resultado { hecho?: string; aviso?: string }

/** Evento en el chat. Con `unaVezHoras`, no se repite el mismo texto en esa conversación dentro de ese lapso. */
async function dejarEvento(convId: number, ev: 'flow' | 'bell', t: string, regla: string, unaVezHoras = 0, mas: Json = {}): Promise<CrmMensaje | null> {
  if (unaVezHoras > 0) {
    const ya = await prisma.crmMensaje.findFirst({
      where: { conversacionId: convId, tipo: 'ev', createdAt: { gte: new Date(Date.now() - unaVezHoras * 3_600_000) }, datos: { path: ['t'], equals: t } },
      select: { id: true },
    })
    if (ya) return null
  }
  const m = await prisma.crmMensaje.create({ data: { conversacionId: convId, tipo: 'ev', datos: json({ ev, t, regla, ...mas }) } })
  emitirMsg(convId, m, null)
  return m
}

/** Un cambio del contacto se ve en todas sus conversaciones. */
async function emitirContacto(contactoId: number) {
  const convs = await prisma.crmConversacion.findMany({ where: { contactoId }, select: { id: true }, orderBy: { createdAt: 'desc' }, take: 20 })
  for (const c of convs) await emitirConv(c.id, null)
}

// ─── Condiciones («Si se cumple») ────────────────────────────────────────────

const CANALES: Record<string, string> = {
  whatsapp: 'wa', instagram: 'ig', messenger: 'fb', facebook: 'fb', 'facebook messenger': 'fb',
  web: 'web', 'chat de la web': 'web', 'chat web': 'web', 'sitio web': 'web', correo: 'mail', email: 'mail', 'correo electronico': 'mail',
}
const partes = (t: string) => t.split(/\s*,\s*|\s+o\s+/i).map(sinComillas).filter(Boolean)

/** ¿La compra del contacto es a cuotas? Lo que diga Hotmart en el evento y, si no, la plataforma. null = no se sabe. */
async function esACuotas(c: Conv, datos: Json): Promise<boolean | null> {
  if (typeof datos.enPartes === 'boolean') return datos.enPartes
  const n = Number(datos.cuotas ?? datos.cuotasTotal)
  if (Number.isFinite(n) && n > 0) return n > 1
  const f = await fichaDeContacto(c.contactoId).catch(e => { logger.warn(`[CRM reglas] ficha del contacto ${c.contactoId}: ${(e as Error).message}`); return null })
  if (f?.cambio) await emitirContacto(c.contactoId)
  if (!f || !f.ficha.externoId) return null
  return !!f.ficha.compras && f.ficha.compras.total > 1
}

/** true o false; null si el texto no se entiende, o el motivo si se entiende pero no se puede revisar (la regla no corre). */
async function cumple(crudo: string, c: Conv, datos: Json): Promise<boolean | null | string> {
  const s = limpio(crudo).replace(/[.;]+$/, '')
  let m: RegExpMatchArray | null
  if ((m = s.match(/^(?:el\s+)?canal\s+(no\s+)?es\s+(.+)$/i))) {
    const codigos = partes(m[2]).map(x => CANALES[plano(x)] ?? null)
    if (codigos.some(x => !x)) return null
    return codigos.includes(c.canal) !== !!m[1]
  }
  if ((m = s.match(/^(?:la\s+)?etapa\s+(no\s+)?es\s+(.+)$/i))) {
    const etapas = await nombresDe('etapas', ETAPAS_DEFECTO)
    const conocidas = new Set(etapas.map(plano))
    const entera = plano(sinComillas(m[2]))
    const opciones = conocidas.has(entera) ? [entera] : partes(m[2]).map(plano)
    // Una etapa que ya no está en el embudo (la renombraron o la borraron) nunca se cumpliría: mejor decirlo.
    const faltan = partes(m[2]).filter(x => !conocidas.has(entera) && !conocidas.has(plano(x)))
    if (faltan.length) return `${faltan.map(x => `«${x}»`).join(' y ')} no ${faltan.length > 1 ? 'son etapas' : 'es una etapa'} del embudo (Ajustes del CRM, Etapas)`
    // Quien acaba de escribir por primera vez no tiene etapa: está en la primera del embudo («Nuevo lead»).
    const actual = plano(c.contacto.etapa) || plano(etapas[0])
    return opciones.includes(actual) !== !!m[1]
  }
  if (/^fuera\s+del\s+horario(?:\s+de\s+atenci[oó]n)?$/i.test(s)) return fueraDeHorario({ festivos: true, ...obj(await leerAjuste('cfg')) })
  if (/^(?:dentro\s+del|en)\s+horario(?:\s+de\s+atenci[oó]n)?$/i.test(s)) return !fueraDeHorario({ festivos: true, ...obj(await leerAjuste('cfg')) })
  if ((m = s.match(/^(no\s+)?viene\s+de\s+un\s+anuncio$/i))) {
    const pauta = obj(c.contacto.pauta)
    const deAnuncio = Object.keys(pauta).length > 0 || /anuncio/i.test(txt(obj(c.contacto.ficha).origen))
    return deAnuncio !== !!m[1]
  }
  if ((m = s.match(/^(no\s+)?tiene\s+la\s+etiqueta\s+(.+)$/i))) {
    const buscada = plano(sinComillas(m[2]))
    return (c.contacto.tags ?? []).some(t => plano(t) === buscada) !== !!m[1]
  }
  if ((m = s.match(/^(?:la\s+)?l[ií]nea\s+(no\s+)?es\s+(.+)$/i))) {
    const buscada = plano(sinComillas(m[2]))
    const digitos = sinComillas(m[2]).replace(/\D/g, '')
    const l = c.linea
    const coincide = !!l && (plano(l.nombre) === buscada || (digitos.length >= 7 && l.telefono.replace(/\D/g, '').endsWith(digitos)))
    return coincide !== !!m[1]
  }
  if ((m = s.match(/^(no\s+)?es\s+a\s+cuotas$/i))) {
    const cuotas = await esACuotas(c, datos)
    return (cuotas === true) !== !!m[1]
  }
  if ((m = s.match(/^(?:el\s+)?equipo\s+(no\s+)?es\s+(.+)$/i))) {
    // Sin equipo es Ventas, como en el resto del CRM.
    const pedidos = partes(m[2])
    const validos = await Promise.all(pedidos.map(equipoValido))
    const faltan = pedidos.filter((_, i) => !validos[i])
    if (faltan.length) return `${faltan.map(x => `«${x}»`).join(' y ')} no ${faltan.length > 1 ? 'son equipos' : 'es un equipo'} del CRM (Ajustes del CRM, Equipos)`
    const actual = plano(c.equipo || 'Ventas')
    return validos.some(e => plano(e) === actual) !== !!m[1]
  }
  if (/^(?:no\s+tiene\s+asesor|sin\s+asesor|sin\s+asignar)$/i.test(s)) return !c.asignadoId
  if (/^tiene\s+asesor$/i.test(s)) return !!c.asignadoId
  return null
}

// ─── Acciones («Entonces») ───────────────────────────────────────────────────

type Accion =
  | { t: 'turnos'; equipo: string | null }
  | { t: 'asesor'; nombre: string | null }
  | { t: 'etapa'; etapa: string }
  | { t: 'volverEtapa' }
  | { t: 'etiqueta'; etiqueta: string; quitar: boolean }
  | { t: 'plantilla'; nombre: string }
  | { t: 'rapida'; atajo: string }
  | { t: 'recordatorio'; texto: string | null }
  | { t: 'lider' }
  | { t: 'equipo'; equipo: string }
  | { t: 'resumen' }
  | { t: 'agente' }

type Entendida = { a: Accion; cuotas: boolean | null } | { desconocida: string }

/** El texto de la acción → qué hacer. `desconocida` lleva el porqué, si se sabe. */
export function entenderAccion(crudo: string): Entendida {
  let s = limpio(crudo).replace(/[.;]+$/, '')
  let cuotas: boolean | null = null
  const suf = s.match(/^(.*?)\s+si\s+(no\s+)?es\s+a\s+cuotas$/i)
  if (suf) { s = suf[1]; cuotas = !suf[2] }
  const con = (a: Accion): Entendida => ({ a, cuotas })
  let m: RegExpMatchArray | null
  if ((m = s.match(/^asignar\s+por\s+turnos(?:\s+(?:al|en\s+el)\s+equipo\s+(.+))?$/i))) return con({ t: 'turnos', equipo: m[1] ? sinComillas(m[1]) : null })
  if ((m = s.match(/^asignar\s+a\s+(?:un|una|el|la)\s+asesora?(?:(?:\s*[:·,]\s*|\s+)(.+))?$/i))) return con({ t: 'asesor', nombre: m[1] ? sinComillas(m[1]) : null })
  if ((m = s.match(/^asignar\s+a\s+(.+)$/i)) && !/^(?:un|una|el|la|los|las)\s+/i.test(m[1])) return con({ t: 'asesor', nombre: sinComillas(m[1]) })
  if ((m = s.match(/^cambiar\s+(?:la\s+)?etapa(?:\s+a\s+(.+))?$/i))) {
    return m[1] ? con({ t: 'etapa', etapa: sinComillas(m[1]) }) : { desconocida: 'no dice a qué etapa pasarla' }
  }
  if (/^volver\s+a\s+la\s+etapa\s+que\s+ten[ií]a(?:\s+al\s+finalizar)?$/i.test(s)) return con({ t: 'volverEtapa' })
  if ((m = s.match(/^(agregar|añadir|poner|quitar)\s+(?:la\s+)?etiqueta(?:\s+(.+))?$/i))) {
    return m[2] ? con({ t: 'etiqueta', etiqueta: sinComillas(m[2]), quitar: /^quitar$/i.test(m[1]) }) : { desconocida: 'no dice qué etiqueta' }
  }
  if ((m = s.match(/^enviar\s+(?:la\s+)?plantilla(?:\s+(.+))?$/i))) {
    return m[1] ? con({ t: 'plantilla', nombre: sinComillas(m[1]) }) : { desconocida: 'no dice qué plantilla enviar' }
  }
  if ((m = s.match(/^enviar\s+(?:la\s+)?respuesta\s+r[aá]pida(?:\s+(.+))?$/i))) {
    return m[1] ? con({ t: 'rapida', atajo: sinComillas(m[1]) }) : { desconocida: 'no dice qué respuesta rápida enviar' }
  }
  if ((m = s.match(/^crear\s+(?:un\s+)?recordatorio(?:\s+para\s+(?:el|la)\s+asesora?)?(?:\s*[:·]\s*(.+))?$/i))) return con({ t: 'recordatorio', texto: m[1] ? sinComillas(m[1]) : null })
  if (/^avisar\s+(?:al|a\s+la|a\s+los|a\s+las)\s+l[ií]der(?:es)?$/i.test(s)) return con({ t: 'lider' })
  if ((m = s.match(/^(?:pasar|transferir)\s+al\s+equipo\s+(.+)$/i))) return con({ t: 'equipo', equipo: sinComillas(m[1]) })
  if (/^dejar\s+(?:un\s+)?resumen\s+en\s+(?:una\s+)?nota\s+privada$/i.test(s)) return con({ t: 'resumen' })
  if (/^(?:que\s+)?respond[ae]\s+el\s+agente\s+(?:de\s+)?ia$/i.test(s) || /^el\s+agente\s+ia\s+responde$/i.test(s)) return con({ t: 'agente' })
  return { desconocida: '' }
}

// ─── Asignar ─────────────────────────────────────────────────────────────────

const CLAVE_TURNO = '_repartoTurno'

/**
 * Elige dentro de un equipo, con las mismas reglas de disponibilidad del
 * reparto (reciben reparto, «En línea», con el CRM abierto si «No asignar a
 * quien está ausente» está prendido y por debajo del tope). `menos` = al que
 * tenga menos abiertas (empate por turno); si no, por turnos. El turno se
 * guarda en el mismo ajuste interno que usa reparto.ts.
 */
async function elegirEnEquipo(equipo: string, menos: boolean): Promise<{ id: string | null; motivo?: string }> {
  const orden = await miembrosDe(equipo)
  if (!orden.length) return { id: null, motivo: `el equipo ${equipo} no tiene integrantes (Ajustes del CRM, Equipos y reparto)` }
  const cfg = await configReparto()
  const conectados = usuariosConectados()
  const filas = await prisma.crmConversacion.groupBy({ by: ['asignadoId'], where: { asignadoId: { in: orden.map(u => u.id) }, estado: 'abiertas' }, _count: { _all: true } })
  const carga = new Map(filas.map(f => [f.asignadoId as string, f._count._all]))
  const libres: { u: UsuarioCrm; abiertas: number }[] = []
  for (const u of orden) {
    const pref = await leerPreferencias(u.id)
    if (pref.reparto === false) continue
    if ((typeof pref.estado === 'string' ? pref.estado : 'En línea') !== 'En línea') continue
    if (cfg.ausente && !conectados.has(u.id)) continue
    const abiertas = carga.get(u.id) ?? 0
    if (abiertas >= cfg.tope) continue
    libres.push({ u, abiertas })
  }
  if (!libres.length) return { id: null, motivo: `nadie de ${equipo} está disponible ahora (en línea, con el CRM abierto y por debajo del tope)` }
  const min = Math.min(...libres.map(l => l.abiertas))
  const candidatos = new Set(libres.filter(l => !menos || l.abiertas === min).map(l => l.u.id))
  const turnos = obj(await leerAjuste(CLAVE_TURNO))
  const ultimo = typeof turnos[equipo] === 'string' ? turnos[equipo] as string : null
  const i = ultimo ? orden.findIndex(u => u.id === ultimo) : -1
  let elegido: string | null = null
  for (let k = 1; k <= orden.length && !elegido; k++) {
    const u = orden[(i + k + orden.length) % orden.length]
    if (candidatos.has(u.id)) elegido = u.id
  }
  if (elegido) await guardarAjuste(CLAVE_TURNO, { ...turnos, [equipo]: elegido }, null)
  return { id: elegido }
}

/**
 * Deja la conversación con esa persona: dueña del contacto si no tenía, aviso
 * `TAREA_ASIGNADA` (salvo que lo haya apagado) y, por ser una asignación,
 * las reglas de «Se asigna una conversación» en la misma cadena.
 * `deReparto` la marca como entregada por reparto: si no responde a tiempo,
 * el proceso de cada minuto la pasa al siguiente, igual que el reparto.
 */
async function asignarA(ctx: Ctx, c: Conv, userId: string, como: string, op: { equipo?: string; deReparto?: boolean } = {}): Promise<string> {
  const nombre = (await nombreDe(userId)) ?? 'un asesor'
  await prisma.crmConversacion.update({ where: { id: c.id }, data: { asignadoId: userId, ...(op.equipo ? { equipo: op.equipo } : {}) } })
  if (op.deReparto) {
    // Solo la clave `_reparto`: reescribir todo `extra` con una copia vieja borraría lo que otro motor
    // haya guardado mientras tanto (el estado del flujo en `_flujo`, por ejemplo).
    const rep = JSON.stringify({ a: userId, en: new Date().toISOString(), probados: [userId] })
    await prisma.$executeRaw`UPDATE crm_conversaciones SET extra = jsonb_set(coalesce(extra, '{}'::jsonb), '{_reparto}', ${rep}::jsonb) WHERE id = ${c.id}`
  }
  if (!c.contacto.asignadoId) await prisma.crmContacto.update({ where: { id: c.contactoId }, data: { asignadoId: userId } })
  await emitirConv(c.id, null)
  const pref = await leerPreferencias(userId)
  if (pref.asignada !== false) {
    await avisar({
      userId, tipo: 'TAREA_ASIGNADA', titulo: 'Conversación nueva en el CRM',
      texto: `Te llegó la conversación con ${c.contacto.nombre || c.contacto.telefono || 'un contacto'} ${como}.`,
      url: `/?conv=${c.id}`,
    })
  }
  ctx.despues.push(['asignada', { asignadoId: userId, antes: c.asignadoId, porRegla: ctx.r.n }])
  return nombre
}

async function accionTurnos(ctx: Ctx, c: Conv, equipoPedido: string | null): Promise<Resultado> {
  if (c.asignadoId) return {}
  // Igual que el reparto automático: una conversación finalizada no se le entrega a nadie.
  if (c.estado === 'finalizadas') return { aviso: 'no asignó por turnos: la conversación está finalizada (se reparte sola si el cliente vuelve a escribir)' }
  const equipo = equipoPedido ? await equipoValido(equipoPedido) : c.equipo || 'Ventas'
  if (!equipo) return { aviso: `no asignó: el equipo «${equipoPedido}» no existe en Ajustes del CRM, Equipos y reparto` }
  const { id, motivo } = await elegirEnEquipo(equipo, false)
  if (!id) return { aviso: `no asignó por turnos: ${motivo}. La conversación queda sin asignar.` }
  const nombre = await asignarA(ctx, c, id, `por turnos del equipo ${equipo} (regla «${ctx.r.n}»)`, { equipo, deReparto: true })
  return { hecho: `asignada por turnos a ${nombre} (${equipo})` }
}

async function accionAsesor(ctx: Ctx, c: Conv, nombrePedido: string | null): Promise<Resultado> {
  if (nombrePedido) {
    const usuarios = await usuariosCrm()
    const buscado = plano(nombrePedido)
    let u = usuarios.find(x => plano(x.nombre) === buscado)
    if (!u) {
      const iguales = usuarios.filter(x => plano(x.nombre).split(' ')[0] === buscado)
      if (iguales.length === 1) u = iguales[0]
    }
    if (!u) return { aviso: `no asignó: «${nombrePedido}» no es una persona de Ventas en el CRM` }
    if (c.asignadoId === u.id) return {}
    const nombre = await asignarA(ctx, c, u.id, `por la regla «${ctx.r.n}»`)
    return { hecho: `asignada a ${nombre}` }
  }
  if (c.asignadoId) return {}
  // Sin nombre: el reparto automático del equipo, con cliente conocido y familiares.
  const id = await repartirA(c.id)
  if (!id) {
    const cfg = await configReparto()
    return { aviso: /manual/i.test(cfg.metodo) ? 'no asignó: el reparto está en «Manual» (Ajustes del CRM, Equipos y reparto)' : 'no asignó: nadie del equipo está disponible ahora' }
  }
  return { hecho: `asignada a ${(await nombreDe(id)) ?? 'un asesor'} por reparto automático` }
}

// ─── Etapa, etiquetas y equipo ───────────────────────────────────────────────

const ETAPAS_DEFECTO = ['Nuevo lead', 'Contactado', 'Caliente', 'En seguimiento', 'No interesado/perdido', 'Pagado', 'Link errado', 'Sin respuesta']
const EQUIPOS_DEFECTO = ['Ventas', 'Recuperación de ventas', 'Soporte de ventas', 'Soporte']

async function nombresDe(clave: string, defecto: string[]): Promise<string[]> {
  const v = await leerAjuste<unknown>(clave)
  if (!Array.isArray(v)) return defecto
  // Guardada vacía es «ninguna» (las empresas nuevas empiezan sin etapas, 6-oct): no vuelven las de ejemplo.
  return v.map(x => (Array.isArray(x) ? txt(x[0]) : txt(obj(x).n))).filter(Boolean)
}

async function equipoValido(nombre: string): Promise<string | null> {
  const miembros = obj(obj(await leerAjuste('equipos')).miembros)
  const equipos = Object.keys(miembros).length ? Object.keys(miembros) : EQUIPOS_DEFECTO
  return equipos.find(e => plano(e) === plano(nombre)) ?? null
}

async function accionEtapa(ctx: Ctx, c: Conv, pedida: string): Promise<Resultado> {
  const etapa = (await nombresDe('etapas', ETAPAS_DEFECTO)).find(e => plano(e) === plano(pedida))
  if (!etapa) return { aviso: `no cambió la etapa: «${pedida}» no es una etapa del embudo (Ajustes del CRM, Etapas)` }
  if (c.contacto.etapa === etapa) return {}
  await prisma.crmContacto.update({ where: { id: c.contactoId }, data: { etapa } })
  await emitirContacto(c.contactoId)
  ctx.despues.push(['etapa', { antes: c.contacto.etapa, etapa, porRegla: ctx.r.n }])
  ctx.etapaPuesta = etapa
  return { hecho: `etapa ${etapa}` }
}

/**
 * «Volver a la etapa que tenía al finalizar» (lote 6b): la que quedó guardada en la conversación finalizada
 * (`extra.etapaAlFinalizar`, la escribe guardarAlFinalizar antes de las reglas). Con el disparador «La persona
 * vuelve a escribir», `datos.previa` es esa conversación (la misma si se reabrió, otra si empezó una nueva).
 * Si no hay nada guardado (una difusión, o finalizada antes del 6b), no hace nada y no avisa.
 */
async function accionVolverEtapa(ctx: Ctx, c: Conv): Promise<Resultado> {
  const previaId = Number(ctx.datos.previa) || 0
  const previa = previaId && previaId !== c.id ? await prisma.crmConversacion.findUnique({ where: { id: previaId }, select: { extra: true } }) : c
  const guardada = obj(previa?.extra)
  if (!('etapaAlFinalizar' in guardada)) return {}
  const pedida = txt(guardada.etapaAlFinalizar)
  if (!pedida) {
    if (!c.contacto.etapa) return {}
    await prisma.crmContacto.update({ where: { id: c.contactoId }, data: { etapa: null } })
    await emitirContacto(c.contactoId)
    ctx.despues.push(['etapa', { antes: c.contacto.etapa, etapa: null, porRegla: ctx.r.n }])
    ctx.etapaPuesta = ''
    return { hecho: 'sin etapa, como estaba al finalizar' }
  }
  const etapa = (await nombresDe('etapas', ETAPAS_DEFECTO)).find(e => plano(e) === plano(pedida))
  if (!etapa) return { aviso: `no volvió a «${pedida}»: ya no es una etapa del embudo (Ajustes del CRM, Etapas)` }
  if (c.contacto.etapa === etapa) return {}
  await prisma.crmContacto.update({ where: { id: c.contactoId }, data: { etapa } })
  await emitirContacto(c.contactoId)
  ctx.despues.push(['etapa', { antes: c.contacto.etapa, etapa, porRegla: ctx.r.n }])
  ctx.etapaPuesta = etapa
  return { hecho: `volvió a la etapa ${etapa}` }
}

async function accionEtiqueta(c: Conv, pedida: string, quitar: boolean): Promise<Resultado> {
  const conocida = (await nombresDe('etiquetas', [])).find(e => plano(e) === plano(pedida)) ?? pedida
  const tags = c.contacto.tags ?? []
  const tiene = tags.some(t => plano(t) === plano(conocida))
  if (quitar ? !tiene : tiene) return {}
  const nuevas = quitar ? tags.filter(t => plano(t) !== plano(conocida)) : [...tags, conocida]
  await prisma.crmContacto.update({ where: { id: c.contactoId }, data: { tags: nuevas } })
  await emitirContacto(c.contactoId)
  return { hecho: quitar ? `quitó la etiqueta ${conocida}` : `etiqueta ${conocida}` }
}

async function accionEquipo(ctx: Ctx, c: Conv, pedido: string, cuotas: boolean | null): Promise<Resultado> {
  const equipo = await equipoValido(pedido)
  if (!equipo) return { aviso: `no pasó la conversación: el equipo «${pedido}» no existe en Ajustes del CRM, Equipos y reparto` }
  if (cuotas !== null) {
    const es = await esACuotas(c, ctx.datos)
    if (es === null) return { aviso: `no pasó la conversación a ${equipo}: no se encontró la compra en la plataforma para saber si es a cuotas` }
    if (es !== cuotas) return {}
  }
  const miembros = await miembrosDe(equipo)
  const sigue = !!c.asignadoId && miembros.some(u => u.id === c.asignadoId)
  if (c.equipo === equipo && (sigue || !c.asignadoId)) return {}
  await prisma.crmConversacion.update({ where: { id: c.id }, data: { equipo, ...(sigue ? {} : { asignadoId: null }) } })
  await emitirConv(c.id, null)
  if (sigue) return { hecho: `pasó al equipo ${equipo}` }
  // Finalizada: queda en el equipo nuevo sin asesor; si el cliente vuelve a escribir, el reparto la entrega en ese equipo.
  if (c.estado === 'finalizadas') return { hecho: `pasó al equipo ${equipo}, sin asignar porque la conversación está finalizada (se reparte en ese equipo si el cliente vuelve a escribir)` }
  // Se reparte dentro del equipo nuevo (no con el «cliente conocido» de Ventas).
  const cfg = await configReparto()
  if (/manual/i.test(cfg.metodo)) return { hecho: `pasó al equipo ${equipo}, sin asignar (el reparto está en «Manual»)` }
  const { id, motivo } = await elegirEnEquipo(equipo, /menos/i.test(cfg.metodo))
  if (!id) return { hecho: `pasó al equipo ${equipo}, sin asignar: ${motivo}` }
  const actual = await cargar(c.id)
  if (!actual) return { hecho: `pasó al equipo ${equipo}` }
  const nombre = await asignarA(ctx, actual, id, `al pasar al equipo ${equipo} (regla «${ctx.r.n}»)`, { deReparto: true })
  return { hecho: `pasó al equipo ${equipo} y quedó con ${nombre}` }
}

// ─── Mensajes que salen por WhatsApp ─────────────────────────────────────────

const VEINTICUATRO_H = 24 * 3_600_000

/**
 * ¿Es respuesta a lo que el cliente acaba de escribir? Un mensaje nuevo lo es;
 * en los demás eventos, solo si el cliente está esperando respuesta y escribió
 * hace menos de 24 horas. Lo demás es contacto que inicia la empresa.
 */
function esRespuesta(evento: EventoRegla, c: Conv): boolean {
  if (evento === 'mensaje' || evento === 'vuelve') return true
  const ent = c.ultimoEntranteAt?.getTime() ?? 0
  return !!c.esperaDesde && ent > 0 && Date.now() - ent < VEINTICUATRO_H
}

/** «el contacto tiene «No contactar» (motivo)». */
function textoNoContactar(k: CrmContacto): string {
  const motivo = typeof k.noContactar === 'string' ? k.noContactar : txt(obj(k.noContactar).motivo)
  return `el contacto tiene «No contactar»${motivo ? ` (${motivo})` : ''}`
}

/** Si la empresa no puede iniciar el contacto ahora, el motivo. */
async function motivoParaNoIniciar(c: Conv): Promise<string | null> {
  const k = c.contacto
  if (marcado(k.noContactar)) return textoNoContactar(k)
  const pd = obj(await leerAjuste('pd'))
  if (pd.rneOn !== false && marcado(k.rne) && !marcado(k.autorizacion)) return 'el número está en el Registro de Números Excluidos y no hay autorización del titular'
  const legal = horarioLegal()
  if (!legal.ok) return `la Ley 2300 no deja escribirle por iniciativa de la empresa en este momento (${legal.motivo}); el próximo horario permitido es ${legal.sigue}`
  return null
}

/**
 * Con «Llega un mensaje nuevo»: ¿un flujo o el agente IA ya está contestando
 * este mensaje? Entonces la regla no le habla encima al cliente (serían dos
 * mensajes automáticos distintos a la misma pregunta).
 */
async function otroContesta(ctx: Ctx, c: Conv): Promise<boolean> {
  if (ctx.evento !== 'mensaje') return false
  if (ctx.datos.tomado === true || txt(obj(obj(c.extra)._flujo).id) || txt(obj(obj(c.extra)._agente).id)) return true
  const ultimoIn = await prisma.crmMensaje.findFirst({ where: { conversacionId: c.id, tipo: 'in' }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } })
  if (!ultimoIn) return false
  return (await prisma.crmMensaje.count({ where: { conversacionId: c.id, tipo: { in: ['bot', 'ia', 'recepcion'] }, createdAt: { gte: ultimoIn.createdAt } } })) > 0
}

/** Lo que tienen en común la plantilla y la respuesta rápida antes de salir. */
async function puedeSalir(ctx: Ctx, c: Conv, que: string, plantilla: boolean): Promise<string | null> {
  if (c.canal === 'web' || CANALES_CONEXION.includes(c.canal)) {
    const n = nombreCanal(c.canal)
    if (plantilla) return `no envió ${que}: ${n} no usa plantillas de WhatsApp`
    if (c.canal !== 'web' && !c.conexionId) return `no envió ${que}: la conversación ya no tiene su cuenta de ${n} conectada`
  } else {
    if (c.canal !== 'wa') return `no envió ${que}: el CRM no envía por el canal de esta conversación`
    if (!c.lineaId || !c.linea) return `no envió ${que}: la conversación no tiene una línea de WhatsApp conectada`
    if (!(await waConfigurado())) return `no envió ${que}: WhatsApp no está conectado en el CRM`
  }
  // «No contactar»: la pantalla promete que no recibe difusiones ni plantillas, ni siquiera como respuesta.
  if (plantilla && marcado(c.contacto.noContactar)) return `no envió ${que}: ${textoNoContactar(c.contacto)} y no recibe plantillas`
  if (await otroContesta(ctx, c)) return `no envió ${que}: un flujo o el agente IA ya está contestando este mensaje`
  if (!esRespuesta(ctx.evento, c)) {
    const motivo = await motivoParaNoIniciar(c)
    if (motivo) return `no envió ${que}: ${motivo}`
  }
  return null
}

/**
 * ¿Esta regla ya le dijo esto mismo al cliente desde la última vez que habló
 * alguien más? Así, si escribe dos veces seguidas, no le llegan dos veces las
 * mismas respuestas automáticas; si alguien (el asesor, un flujo, el agente,
 * otra regla) habló en medio, sí. Los archivos que la propia regla mandó
 * detrás del texto de una respuesta rápida no cuentan: si la respuesta trae
 * muchos, el texto quedaría fuera de los últimos 20 y la regla lo volvería a
 * mandar todo, así que se sigue leyendo de a 20 hasta dar con él.
 */
async function yaLoDijo(ctx: Ctx, c: Conv, datos: Json): Promise<boolean> {
  let textos = 0
  for (let salto = 0; salto < 1000; salto += 20) {
    const ultimos = await prisma.crmMensaje.findMany({
      where: { conversacionId: c.id, tipo: { in: ['out', 'bot', 'ia', 'recepcion'] }, OR: [{ estado: null }, { estado: { not: 'fallido' } }] },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], select: { datos: true }, take: 20, skip: salto,
    })
    for (const u of ultimos) {
      const d = obj(u.datos)
      if (d.regla !== ctx.r.n) return false
      if (obj(d.file).url && !txt(d.out)) continue
      if (datos.plantilla ? d.plantilla === datos.plantilla : !d.plantilla && txt(d.out) === txt(datos.out)) return true
      if (++textos >= 20) return false
    }
    if (ultimos.length < 20) return false
  }
  return false
}

/**
 * Guarda y envía un mensaje de la regla. Sale como `out` (firmado con la
 * regla), pero si el cliente estaba esperando a una persona, lo sigue
 * esperando: la conversación no se da por respondida con un mensaje automático.
 * `tras`: el texto que presenta este archivo; si ese texto no sale, el archivo tampoco.
 */
async function enviar(ctx: Ctx, c: Conv, datos: Json, tras?: string): Promise<CrmMensaje> {
  const m = await guardarMensaje(c.id, { ...datos, by: `Regla «${ctx.r.n}»`, regla: ctx.r.n }, { autorId: null, por: null, tras })
  if (c.esperaDesde || c.noLeidos) {
    await prisma.crmConversacion.update({ where: { id: c.id }, data: { esperaDesde: c.esperaDesde, noLeidos: c.noLeidos } })
    await emitirConv(c.id, null)
  }
  return m
}

async function valoresDe(ctx: Ctx, c: Conv): Promise<Record<string, string>> {
  const v: Record<string, string> = {}
  const nombre = primerNombre(c.contacto.nombre)
  const asesor = primerNombre(await nombreDe(c.asignadoId))
  const producto = txt(ctx.datos.producto) || txt(obj(c.contacto.campos).producto)
  const enlace = txt(ctx.datos.enlace)
  if (nombre) v.nombre = nombre
  if (asesor) v.asesor = asesor
  if (producto) v.producto = producto
  if (enlace) v.enlace = enlace
  return v
}
const rellenar = (texto: string, valores: Record<string, string>) => texto.replace(/\{\{\s*([^{}\s]+)\s*\}\}/g, (todo, k: string) => valores[k] || todo)

async function accionPlantilla(ctx: Ctx, c: Conv, nombre: string): Promise<Resultado> {
  const que = `la plantilla «${nombre}»`
  const no = await puedeSalir(ctx, c, que, true)
  if (no) return { aviso: no }
  let p
  try { p = await buscarPlantilla(c.linea!.wabaId, nombre) } catch (e) { return { aviso: `no envió ${que}: Meta no respondió al buscarla (${(e as Error).message})` } }
  if (!p) return { aviso: `no envió ${que}: no existe en Meta para la línea ${c.linea!.nombre}` }
  if (p.status !== 'APPROVED') return { aviso: `no envió ${que}: Meta todavía no la aprueba (estado ${p.status.toLowerCase().replace(/_/g, ' ')})` }
  const valores = await valoresDe(ctx, c)
  const faltan = new Set<string>()
  let cuerpo = ''
  for (const comp of p.components ?? []) {
    const tipo = String(comp.type ?? '').toUpperCase()
    const formato = String(comp.format ?? 'TEXT').toUpperCase()
    if (tipo === 'HEADER' && ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(formato)) faltan.add(formato === 'IMAGE' ? 'la imagen del encabezado' : formato === 'VIDEO' ? 'el video del encabezado' : 'el documento del encabezado')
    if ((tipo === 'HEADER' || tipo === 'BODY') && comp.text) for (const v of variablesDe(comp.text)) if (!valores[v]) faltan.add(`{{${v}}}`)
    if (tipo === 'BODY' && comp.text) cuerpo = String(comp.text)
    if (tipo === 'BUTTONS') {
      for (const b of Array.isArray(comp.buttons) ? comp.buttons : []) {
        const url = String(b.url ?? '')
        if (String(b.type).toUpperCase() !== 'URL' || !url.includes('{{')) continue
        // Meta solo deja variable la parte final del enlace: el de la regla tiene que empezar igual que el del botón.
        const prefijo = url.split('{{')[0]
        const enlace = valores.enlace ?? ''
        if (!enlace.startsWith(prefijo) || enlace.length <= prefijo.length) faltan.add(`el enlace del botón «${b.text ?? ''}» (que empiece por ${prefijo})`)
      }
    }
  }
  if (faltan.size) return { aviso: `no envió ${que}: necesita ${[...faltan].join(', ')} y la regla no tiene ese dato para este contacto (una regla llena {{nombre}}, {{asesor}}, {{producto}} y, si el evento lo trae, {{enlace}})` }
  const datos: Json = { out: rellenar(cuerpo, valores) || nombre, plantilla: nombre, vars: valores, ...(valores.enlace ? { link: { url: valores.enlace } } : {}) }
  if (await yaLoDijo(ctx, c, datos)) return {}
  await enviar(ctx, c, datos)
  return { hecho: `envió la plantilla «${nombre}»` }
}

/** Variables {{…}} que quedaron sin llenar en un texto. */
const sinLlenar = (texto: string) => [...new Set([...texto.matchAll(/\{\{\s*([^{}\s]+)\s*\}\}/g)].map(m => `{{${m[1]}}}`))]
/** Lo máximo que WhatsApp deja en un mensaje de texto. */
const MAX_TEXTO_WA = 4096

async function accionRapida(ctx: Ctx, c: Conv, atajo: string): Promise<Resultado> {
  const buscada = plano(atajo.replace(/^\//, ''))
  const qr = (await leerAjuste<unknown>('respuestas'))
  const r = (Array.isArray(qr) ? qr : []).map(obj).find(x => plano(txt(x.t).replace(/^\//, '')) === buscada || plano(x.n) === buscada)
  if (!r || !txt(r.x)) return { aviso: `no envió la respuesta rápida «${atajo}»: no está entre las respuestas rápidas del equipo (Ajustes del CRM)` }
  const que = `la respuesta rápida /${txt(r.t) || atajo}`
  const ent = c.ultimoEntranteAt?.getTime() ?? 0
  if (!ent || Date.now() - ent > VEINTICUATRO_H) return { aviso: `no envió ${que}: pasaron más de 24 horas desde el último mensaje del cliente y WhatsApp solo deja enviar una plantilla aprobada` }
  const texto = rellenar(txt(r.x), await valoresDe(ctx, c))
  // Nada de «{{fecha}}» literal en el WhatsApp del cliente: si la regla no tiene el dato, no sale.
  const faltan = sinLlenar(texto)
  if (faltan.length) return { aviso: `no envió ${que}: usa ${faltan.join(', ')} y la regla no tiene ese dato para este contacto` }
  if (texto.length > MAX_TEXTO_WA) return { aviso: `no envió ${que}: pasa de 4.096 caracteres, el máximo de WhatsApp` }
  const no = await puedeSalir(ctx, c, que, false)
  if (no) return { aviso: no }
  const datos: Json = { out: texto, rapida: txt(r.t) || atajo }
  if (await yaLoDijo(ctx, c, datos)) return {}
  const m = await enviar(ctx, c, datos)
  // Detrás del texto, cada archivo de la respuesta como su propio mensaje y en orden, como desde el chat
  // (56-compositor.js). Salen por la misma cola de la conversación y solo si el texto salió.
  for (const a of archivosDe(r.archivos)) await enviar(ctx, c, mensajeDeArchivo(a), m.id)
  return { hecho: `envió ${que}` }
}

// ─── Recordatorio y aviso al líder ───────────────────────────────────────────

function textoRecordatorio(ctx: Ctx): string {
  switch (ctx.evento) {
    case 'sinRespuesta': return 'Hacer seguimiento: lleva 48 horas sin responder'
    case 'pago': return `Revisar el pago confirmado${txt(ctx.datos.producto) ? ` (${txt(ctx.datos.producto)})` : ''}`
    case 'finalizada': return 'Revisar la conversación finalizada'
    default: return `Seguimiento que pidió la regla «${ctx.r.n}»`
  }
}

async function accionRecordatorio(ctx: Ctx, c: Conv, pedido: string | null): Promise<Resultado> {
  const t = pedido || textoRecordatorio(ctx)
  const recs = (Array.isArray(c.recs) ? c.recs : []).map(obj)
  if (recs.some(r => !r.hecho && r.regla === ctx.r.n && r.t === t)) return {}
  // Para el asesor, en un momento en que pueda escribirle al cliente: ya, o cuando abra la franja de la Ley 2300.
  const legal = horarioLegal()
  const fecha = legal.ok || !legal.abre ? ahoraCalendario() : legal.abre
  const cuando = cuandoTexto(fecha)
  await prisma.crmConversacion.update({ where: { id: c.id }, data: { recs: json([...recs, { t, cuando, fecha: fecha.toISOString(), hecho: false, por: `Regla «${ctx.r.n}»`, regla: ctx.r.n }]) } })
  await emitirConv(c.id, null)
  return { hecho: `recordatorio «${t}» para ${cuando.replace(/^(\p{Lu})/u, x => x.toLowerCase())}${c.asignadoId ? '' : ' (sin asesor asignado: nadie recibe el aviso)'}` }
}

const avisosRecientes = new Map<string, number>()
const PAUSA_AVISO_MENSAJE = 10 * 60_000

function queHizo(ctx: Ctx, quien: string, c: Conv): string {
  switch (ctx.evento) {
    case 'mensaje': return `llegó un mensaje de ${quien}`
    case 'asignada': return `se asignó la conversación con ${quien}`
    case 'etapa': return `${quien} pasó a la etapa ${c.contacto.etapa ?? 'sin etapa'}`
    case 'pago': return `Se confirmó un pago de ${quien}${txt(ctx.datos.producto) ? ` (${txt(ctx.datos.producto)})` : ''}`
    case 'sinRespuesta': return `${quien} lleva 48 horas sin responder`
    case 'finalizada': return `se finalizó la conversación con ${quien}`
    case 'vuelve': return `${quien} volvió a escribir después de finalizar`
  }
}

async function accionLider(ctx: Ctx, c: Conv): Promise<Resultado> {
  // Con «Llega un mensaje nuevo», un aviso cada 10 minutos por conversación: no una campana por cada mensaje.
  const clave = `${ctx.r.n}|${c.id}`
  if (ctx.evento === 'mensaje' && Date.now() - (avisosRecientes.get(clave) ?? 0) < PAUSA_AVISO_MENSAJE) return {}
  // Los líderes del equipo de la conversación y los administradores que no están en ningún equipo (29-sep): no
  // todos los ADMIN y LIDER_VENTAS de la plataforma, que ya no ven los otros equipos.
  const eqs = await leerEquipos()
  const equipo = equipoDeConv(c)
  const deEquipo = new Set(eqs.lideres[equipo] ?? [])
  const lideres = (await usuariosCrm()).filter(u => deEquipo.has(u.id) || (u.rol === 'ADMIN' && alcanceDePersona(u.id, u.rol, eqs).todo))
  if (!lideres.length) return { aviso: `no avisó: ${equipo} no tiene líderes ni hay administradores sin equipo` }
  const quien = c.contacto.nombre || c.contacto.telefono || 'un contacto'
  const texto = `Regla «${ctx.r.n}»: ${queHizo(ctx, quien, c)}.`
  for (const u of lideres) await avisar({ userId: u.id, tipo: 'TAREA_ASIGNADA', titulo: 'Aviso de una regla del CRM', texto, url: `/?conv=${c.id}` })
  avisosRecientes.set(clave, Date.now())
  if (avisosRecientes.size > 5000) for (const [k, en] of avisosRecientes) if (Date.now() - en > PAUSA_AVISO_MENSAJE) avisosRecientes.delete(k)
  return { hecho: `avisó a ${lideres.length === 1 ? lideres[0].nombre : `${lideres.length} líderes`}` }
}

// ─── Resumen con Claude ──────────────────────────────────────────────────────

/** El resumen solo condensa: Haiku alcanza (misma decisión que la memoria de los agentes, 21-sep). */
const MODELO_RESUMEN = 'claude-haiku-4-5'
let clienteIA: Pick<Anthropic, 'messages'> | null = null
/** Solo para pruebas: un cliente de Anthropic falso. null vuelve al real. */
export function fijarClienteIA(c: Pick<Anthropic, 'messages'> | null) { clienteIA = c }

function textoDeMensaje(m: CrmMensaje): string {
  const d = obj(m.datos)
  if (m.tipo === 'in') {
    if (typeof d.in === 'string') return d.in
    const x = obj(d.in)
    return txt(x.trans) ? `(nota de voz) ${txt(x.trans)}` : txt(x.cap) || (x.img ? '(imagen)' : x.video ? '(video)' : x.doc ? `(documento ${txt(x.n)})` : x.audio !== undefined ? '(nota de voz)' : '')
  }
  const t = txt(d[m.tipo])
  if (m.tipo === 'out') return t || (d.file ? `(archivo ${txt(obj(d.file).n)})` : d.audio ? '(nota de voz)' : '')
  return t
}

async function accionResumen(origen: string, c: Conv): Promise<Resultado> {
  const ia = clienteIA ?? (await motorIA())?.cliente
  if (!ia) return { aviso: `no dejó el resumen en nota privada: ${SIN_MOTOR}` }
  const [msgs, previo] = await Promise.all([
    prisma.crmMensaje.findMany({ where: { conversacionId: c.id, tipo: { in: ['in', 'out', 'bot', 'ia', 'recepcion', 'note'] } }, orderBy: { createdAt: 'desc' }, take: 60 }),
    prisma.crmMensaje.findFirst({ where: { conversacionId: c.id, tipo: 'note', datos: { path: ['resumen'], equals: true } }, orderBy: { createdAt: 'desc' } }),
  ])
  const ultimoIn = msgs.find(m => m.tipo === 'in')
  if (!ultimoIn) return {}
  if (previo && previo.createdAt >= ultimoIn.createdAt) return {} // nada nuevo desde el último resumen
  const nombres = new Map((await usuariosCrm()).map(u => [u.id, u.nombre]))
  const quien = c.contacto.nombre || 'Cliente'
  const lineas = msgs.filter(m => !(m.tipo === 'note' && obj(m.datos).resumen === true)).reverse().map(m => {
    const t = textoDeMensaje(m).slice(0, 1500)
    if (!t) return ''
    const d = obj(m.datos)
    const de = m.tipo === 'in' ? quien
      : m.tipo === 'out' ? (m.autorId ? `Asesor ${nombres.get(m.autorId) ?? ''}`.trim() : txt(d.by) || 'Mensaje automático')
      : m.tipo === 'note' ? 'Nota interna del equipo'
      : m.tipo === 'bot' ? 'Mensaje automático' : 'Asistente virtual'
    return `${de}: ${t}`
  }).filter(Boolean)
  let r: Anthropic.Message
  try {
    r = await ia.messages.create({
      model: MODELO_RESUMEN,
      max_tokens: 400,
      system: 'Resumes conversaciones de una empresa con sus clientes, para el asesor que las va a retomar. '
        + 'Escribe en español de Colombia de dos a cuatro frases cortas: quién es la persona si se sabe, qué necesita o pregunta, qué se le respondió y qué queda pendiente. '
        + 'Solo con lo que está en la conversación, sin inventar datos ni precios. Sin saludos, sin listas, sin markdown y sin guiones como puntuación.',
      messages: [{ role: 'user', content: `Conversación (de la más antigua a la más reciente):\n\n${lineas.join('\n')}` }],
    }, { timeout: 30_000, maxRetries: 1 })
  } catch (e) {
    const detalle = e instanceof Anthropic.APIError ? `el proveedor de IA respondió ${e.status ?? 'con error'}` : (e as Error).message
    logger.warn(`[CRM reglas] resumen de ${c.id}: ${detalle}`)
    return { aviso: `no dejó el resumen en nota privada: ${detalle}` }
  }
  if (r.stop_reason === 'refusal') return { aviso: 'no dejó el resumen en nota privada: el modelo no quiso resumir esta conversación' }
  let texto = r.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map(b => b.text).join('').trim()
  if (r.stop_reason === 'max_tokens') {
    // Se cortó por largo: queda hasta la última frase completa, no una frase a medias.
    const fin = Math.max(-1, ...[...texto.matchAll(/[.!?](?=\s|$)/g)].map(m => m.index ?? -1))
    texto = fin > 0 ? texto.slice(0, fin + 1) : texto ? `${texto}…` : ''
  }
  if (!texto) return { aviso: 'no dejó el resumen en nota privada: el modelo respondió vacío' }
  // Un solo resumen vigente: el de hace menos de 12 horas se reemplaza por el nuevo, abajo del chat.
  if (previo && Date.now() - previo.createdAt.getTime() < 12 * 3_600_000) {
    const borrado = await prisma.crmMensaje.deleteMany({ where: { id: previo.id } })
    if (borrado.count) emitirCrm({ tipo: 'msg-borrado', convId: c.id, msgId: previo.id }, null)
  }
  await guardarMensaje(c.id, { note: texto, by: 'Resumen automático', resumen: true, regla: origen }, { autorId: null, por: null })
  return { hecho: previo ? 'actualizó el resumen en nota privada' : 'dejó un resumen en nota privada' }
}

// ─── Agente IA ───────────────────────────────────────────────────────────────

/** Contexto de noche para el motor del agente: lo que pide agenteIniciar más de dónde viene. */
export type CtxAgenteRegla = CtxEntrante & { noche: true; regla: string }

async function accionAgente(ctx: Ctx, c: Conv): Promise<Resultado> {
  if (await otroContesta(ctx, c)) return {} // un flujo o el agente ya está contestando este mensaje
  const agentes = await leerAjuste<unknown>('agentes')
  // Encendido y con el canal marcado (en la pantalla, un canal sin marcar sale apagado).
  const encendidos = (Array.isArray(agentes) ? agentes : []).map(obj).filter(a => a.estado === 'activo' && obj(a.canales)[c.canal] === true)
  if (!encendidos.length) return { aviso: 'no respondió el agente IA: no hay un agente encendido para este canal (Agentes IA)' }
  if (!tieneSalida(c)) return { aviso: `no respondió el agente IA: ${CANALES_CONEXION.includes(c.canal) ? `la conversación ya no tiene su cuenta de ${nombreCanal(c.canal)} conectada` : 'la conversación no tiene una línea de WhatsApp conectada'}` }
  const ultimoIn = await prisma.crmMensaje.findFirst({ where: { conversacionId: c.id, tipo: 'in' }, orderBy: { createdAt: 'desc' } })
  if (!ultimoIn) return {}
  // Fuera de «Llega un mensaje nuevo» el agente estaría escribiendo por iniciativa de la empresa:
  // solo dentro de la ventana de 24 horas de WhatsApp y con la Ley 2300, «No contactar» y el RNE.
  if (!esRespuesta(ctx.evento, c)) {
    const ent = c.ultimoEntranteAt?.getTime() ?? 0
    if (c.canal === 'wa' && (!ent || Date.now() - ent > VEINTICUATRO_H)) return { aviso: 'no respondió el agente IA: pasaron más de 24 horas desde el último mensaje del cliente y WhatsApp solo deja enviar una plantilla aprobada' }
    if ((c.canal === 'fb' || c.canal === 'ig') && (!ent || Date.now() - ent > VEINTICUATRO_H)) return { aviso: `no respondió el agente IA: pasaron más de 24 horas desde el último mensaje del cliente y ${nombreCanal(c.canal)} no deja escribirle` }
    if (c.canal === 'tt' && (!ent || Date.now() - ent > 2 * VEINTICUATRO_H)) return { aviso: 'no respondió el agente IA: pasaron más de 48 horas desde el último mensaje del cliente y TikTok no deja escribirle' }
    const motivo = await motivoParaNoIniciar(c)
    if (motivo) return { aviso: `no respondió el agente IA: ${motivo}` }
  }
  const yaContesto = await prisma.crmMensaje.count({ where: { conversacionId: c.id, tipo: { in: ['ia', 'bot', 'recepcion'] }, createdAt: { gte: ultimoIn.createdAt } } })
  if (yaContesto) return {}
  const msgId = txt(ctx.datos.msgId) || ultimoIn.id
  const datosIn = obj(ultimoIn.datos)
  const texto = typeof ctx.datos.texto === 'string' ? ctx.datos.texto : textoDeMensaje(ultimoIn)
  const agenteCtx: CtxAgenteRegla = {
    convId: c.id, msgId, linea: c.linea, nueva: false, reabierta: false, contactoNuevo: false,
    texto, respuestaId: txt(obj(datosIn.resp).id) || null, noche: true, regla: ctx.r.n,
  }
  const tomo = await agenteIniciar(agenteCtx)
  if (!tomo) return { aviso: 'no respondió el agente IA: el agente no tomó la conversación (revisa en Agentes IA que esté encendido para esta línea y este horario)' }
  ctx.res.agente = true
  const raiz = cadena.getStore()?.raiz
  if (raiz) raiz.agente = true
  return { hecho: 'respondió el agente IA' }
}

// ─── Correr ──────────────────────────────────────────────────────────────────

async function ejecutar(ctx: Ctx, e: Extract<Entendida, { a: Accion }>): Promise<Resultado> {
  const c = await cargar(ctx.convId)
  if (!c) return {}
  const a = e.a
  // «… si es a cuotas» en cualquier acción (en «Pasar al equipo» lo resuelve la acción misma).
  if (e.cuotas !== null && a.t !== 'equipo') {
    const es = await esACuotas(c, ctx.datos)
    if (es === null) return { aviso: 'no hizo una acción que depende de si la compra es a cuotas: no se encontró la compra en la plataforma' }
    if (es !== e.cuotas) return {}
  }
  // Mientras un flujo o el agente IA atienden la conversación, las reglas no la asignan ni la
  // cambian de equipo: el flujo o el agente la entregan ellos al terminar.
  const ex = obj(c.extra)
  if ((a.t === 'turnos' || a.t === 'asesor' || a.t === 'equipo') && (txt(obj(ex._flujo).id) || txt(obj(ex._agente).id))) return {}
  switch (a.t) {
    case 'turnos': return accionTurnos(ctx, c, a.equipo)
    case 'asesor': return accionAsesor(ctx, c, a.nombre)
    case 'etapa': return accionEtapa(ctx, c, a.etapa)
    case 'volverEtapa': return accionVolverEtapa(ctx, c)
    case 'etiqueta': return accionEtiqueta(c, a.etiqueta, a.quitar)
    case 'plantilla': return accionPlantilla(ctx, c, a.nombre)
    case 'rapida': return accionRapida(ctx, c, a.atajo)
    case 'recordatorio': return accionRecordatorio(ctx, c, a.texto)
    case 'lider': return accionLider(ctx, c)
    case 'equipo': return accionEquipo(ctx, c, a.equipo, e.cuotas)
    case 'resumen': return accionResumen(ctx.r.n, c)
    case 'agente': return accionAgente(ctx, c)
  }
}

/** Los avisos de lo que no se pudo hacer: una vez cada 12 horas por conversación y texto. */
const HORAS_AVISO = 12

async function correrRegla(r: Regla, evento: EventoRegla, convId: number, datos: Json, res: ResultadoReglas, cad: Cadena, clave: string) {
  const c = await cargar(convId)
  if (!c) return
  for (const s of r.si) {
    const v = await cumple(s, c, datos)
    if (v === null || typeof v === 'string') {
      const porque = typeof v === 'string' ? `tiene una condición que no se puede revisar: «${corto(s)}», porque ${v}` : `tiene una condición que el CRM no sabe revisar: «${corto(s)}»`
      await dejarEvento(convId, 'bell', `La regla «${corto(r.n, 120)}» ${porque}. Mientras no se corrija, no corre.`, r.n, HORAS_AVISO)
      await emitirConv(convId, null)
      return
    }
    if (!v) return
  }
  cad.corridas.add(clave)
  res.corridas.push(r.n)
  if (cad.raiz !== res) cad.raiz.corridas.push(r.n)
  const ctx: Ctx = { r, evento, convId, datos, res, despues: [] }
  const hechos: string[] = []
  for (const texto of r.ent) {
    const e = entenderAccion(texto)
    if ('desconocida' in e) {
      await dejarEvento(convId, 'bell', `La regla «${corto(r.n, 120)}» tiene una acción que el CRM no sabe hacer: «${corto(texto)}»${e.desconocida ? `, ${e.desconocida}` : ''}. Corrígela en Reglas automáticas.`, r.n, HORAS_AVISO)
      continue
    }
    try {
      const x = await ejecutar(ctx, e)
      if (x.hecho) hechos.push(x.hecho)
      if (x.aviso) await dejarEvento(convId, 'bell', `Regla «${r.n}»: ${x.aviso}`, r.n, HORAS_AVISO)
    } catch (err) {
      logger.error(`[CRM reglas] «${r.n}» en ${convId}, acción «${texto}»: ${(err as Error)?.message ?? err}`)
      await dejarEvento(convId, 'bell', `Regla «${r.n}»: falló «${corto(texto)}» (${corto((err as Error)?.message ?? 'error inesperado', 300)})`, r.n, HORAS_AVISO)
    }
  }
  // Al finalizar o al volver a escribir, si la regla solo movió la etapa, el chat lo dice como la maqueta del 6b:
  // «Pasó a ● Conversación cerrada al finalizar» (la pantalla pinta la etapa con su color).
  if (hechos.length === 1 && ctx.etapaPuesta !== undefined && (evento === 'finalizada' || evento === 'vuelve')) {
    const t = evento === 'finalizada' ? `Pasó a ${ctx.etapaPuesta || 'sin etapa'} al finalizar` : ctx.etapaPuesta ? `Volvió a ${ctx.etapaPuesta}, la etapa que tenía al finalizar` : 'Volvió a quedar sin etapa, como estaba al finalizar'
    await dejarEvento(convId, 'flow', t, r.n, 0, { etapaFin: ctx.etapaPuesta || null, alFinalizar: evento === 'finalizada' })
  } else if (hechos.length) await dejarEvento(convId, 'flow', `Regla «${r.n}»: ${hechos.join(', ')}`, r.n)
  await emitirConv(convId, null)
  // Lo que desató esta regla sigue en la misma cadena aunque haya tardado (Meta o Claude lentos):
  // si la cadena caducara aquí, dos reglas que se devuelven la etapa podrían correr sin fin.
  for (const [ev, d] of ctx.despues) await disparar(ev, convId, d, true)
}

async function correrEvento(evento: EventoRegla, convId: number, datos: Json, res: ResultadoReglas) {
  const reglas = (await reglasGuardadas()).filter(r => r.on && eventoDeCuando(r.cuando) === evento)
  if (!reglas.length) return
  const cad = cadena.getStore()!
  for (const r of reglas) {
    // Por el contenido completo de la regla: dos reglas distintas con el mismo nombre corren las dos.
    const clave = `${JSON.stringify([plano(r.n), plano(r.cuando), r.si.map(plano), r.ent.map(plano)])}|${convId}`
    if (cad.corridas.has(clave)) continue
    try { await correrRegla(r, evento, convId, datos, res, cad, clave) } catch (e) {
      logger.error(`[CRM reglas] «${r.n}» en ${convId}: ${(e as Error)?.message ?? e}`)
    }
  }
}

/**
 * Corre las reglas encendidas de ese evento sobre la conversación. Nunca lanza.
 * `datos` según el evento (ver docs del integrador al final del reporte):
 * mensaje {texto, msgId?, tomado?}; asignada {asignadoId, antes?};
 * etapa {antes, etapa}; pago {producto?, enPartes?, cuotas?, transaccion?};
 * sinRespuesta {desde, msgId}; finalizada {motivo?}.
 */
export function dispararReglas(eventoRegla: EventoRegla, convId: number, datos: Record<string, unknown> = {}): Promise<ResultadoReglas> {
  // Antes de las reglas de «Se finaliza»: la etapa que tenía y quién la finalizó (lote 6b).
  const p = eventoRegla === 'finalizada' ? guardarAlFinalizar(convId, datos).then(() => disparar(eventoRegla, convId, datos, false)) : disparar(eventoRegla, convId, datos, false)
  // El resumen al finalizar va después de las reglas: si una regla ya lo dejó, no se repite.
  if (eventoRegla === 'finalizada') void p.then(() => resumenAlFinalizar(convId)).catch(e => logger.warn(`[CRM reglas] resumen al finalizar ${convId}: ${(e as Error)?.message ?? e}`))
  return p
}

/**
 * Lote 6b: al finalizar se guardan en la conversación la etapa del contacto en ese momento (`etapaAlFinalizar`,
 * la que usa «Volver a la etapa que tenía al finalizar») y quién la finalizó (`finPor`, la tarjeta de Finalizadas).
 * Se mezcla sobre `extra` en la base, sin pisar lo que otro haya escrito. Nunca lanza.
 */
async function guardarAlFinalizar(convId: number, datos: Record<string, unknown>): Promise<void> {
  try {
    const c = await prisma.crmConversacion.findUnique({ where: { id: convId }, select: { contacto: { select: { etapa: true } } } })
    if (!c) return
    const motivo = txt(datos.motivo)
    const finPor = txt(datos.por) || (txt(datos.porAgente) ? `el agente IA «${txt(datos.porAgente)}»` : /inactividad/i.test(motivo) ? 'inactividad' : '')
    const mas = { etapaAlFinalizar: c.contacto.etapa ?? null, ...(finPor ? { finPor } : {}) }
    await prisma.$executeRaw`UPDATE crm_conversaciones SET extra = COALESCE(extra, '{}'::jsonb) || ${JSON.stringify(mas)}::jsonb WHERE id = ${convId}`
  } catch (e) {
    logger.warn(`[CRM reglas] guardar al finalizar ${convId}: ${(e as Error)?.message ?? e}`)
  }
}

/**
 * «Resumen automático al finalizar» (Ajustes del CRM, Conversaciones: cvcfg.resumen, apagado si no se
 * prende). La misma nota privada que la acción «Dejar resumen en nota privada».
 */
async function resumenAlFinalizar(convId: number): Promise<void> {
  if (obj(await leerAjuste<unknown>('cvcfg')).resumen !== true) return
  const c = await cargar(convId)
  if (!c) return
  const r = await accionResumen('Resumen al finalizar', c)
  if (r.aviso) logger.warn(`[CRM reglas] resumen al finalizar ${convId}: ${r.aviso}`)
}

/**
 * `seguir`: lo llama la propia cadena (lo que desató una regla) y la continúa
 * siempre. Desde afuera, una cadena heredada de hace más de 2 minutos (una
 * tarea en segundo plano que la arrastró) no cuenta: empieza otra.
 */
async function disparar(eventoRegla: EventoRegla, convId: number, datos: Record<string, unknown>, seguir: boolean): Promise<ResultadoReglas> {
  const res: ResultadoReglas = { corridas: [], agente: false }
  try {
    const previa = cadena.getStore()
    const viva = previa && (seguir || Date.now() - previa.inicio < VIDA_CADENA) ? previa : null
    if (viva && viva.nivel >= MAX_NIVEL) {
      logger.warn(`[CRM reglas] cadena demasiado larga en la conversación ${convId} (${eventoRegla}): se corta`)
      await dejarEvento(convId, 'bell', `Las reglas automáticas se encadenaron más de ${MAX_NIVEL} veces seguidas en esta conversación y se detuvieron para no dar vueltas sin fin. Revisa en Reglas automáticas las que cambian la etapa, asignan o pasan de equipo.`, '', HORAS_AVISO)
      return res
    }
    const actual: Cadena = viva ? { ...viva, nivel: viva.nivel + 1 } : { corridas: new Set(), inicio: Date.now(), nivel: 1, raiz: res }
    await cadena.run(actual, () => correrEvento(eventoRegla, convId, obj(datos), res))
  } catch (e) {
    logger.error(`[CRM reglas] ${eventoRegla} en ${convId}: ${(e as Error)?.message ?? e}`)
  }
  return res
}

// ─── Pagos de Hotmart ────────────────────────────────────────────────────────

export interface PagoHotmart {
  correo?: string | null; telefono?: string | null; externoId?: string | null
  producto?: string | null; valor?: number | null; transaccion?: string | null
  /** payment_mode MULTIPLE_PAYMENTS: el producto se vendió a cuotas. */
  enPartes?: boolean; cuotas?: number | null; cuotaNumero?: number | null
}

/**
 * «Se confirma un pago» (hoy, los pagos de Hotmart de la plataforma): busca los contactos del CRM del comprador (por
 * cliente vinculado, por los últimos 10 dígitos del celular o por correo)
 * y corre las reglas sobre la conversación más reciente de cada uno (la
 * abierta, si hay). Una misma transacción no corre dos veces en la misma
 * conversación. Devuelve en cuántas conversaciones corrió. Nunca lanza.
 */
export async function reglasPorPago(p: PagoHotmart, espacioId: string = ESPACIO_POR_DEFECTO): Promise<number> {
  // Punto de extensión: lo llama la integración de pagos de la empresa cuando confirma un pago.
  return enEspacio(espacioId, () => reglasPorPagoEnEspacio(p))
}

async function reglasPorPagoEnEspacio(p: PagoHotmart): Promise<number> {
  try {
    const tel = String(p.telefono ?? '').replace(/\D/g, '').slice(-10)
    const correo = txt(p.correo).toLowerCase()
    const ids = new Set<number>()
    if (p.externoId) for (const k of await prisma.crmContacto.findMany({ where: { externoId: p.externoId }, select: { id: true } })) ids.add(k.id)
    if (tel.length === 10) {
      const filas = await prisma.$queryRaw<{ id: number }[]>`SELECT id FROM crm_contactos WHERE espacio_id = ${espacioActual()} AND telefono IS NOT NULL AND right(regexp_replace(telefono, '\\D', '', 'g'), 10) = ${tel} LIMIT 5`
      for (const f of filas) ids.add(Number(f.id))
    }
    if (correo.includes('@')) for (const k of await prisma.crmContacto.findMany({ where: { correo: { equals: correo, mode: 'insensitive' } }, select: { id: true }, take: 5 })) ids.add(k.id)
    let n = 0
    for (const contactoId of ids) {
      const convs = await prisma.crmConversacion.findMany({ where: { contactoId }, orderBy: { createdAt: 'desc' }, take: 10, select: { id: true, estado: true, extra: true } })
      const c = convs.find(x => x.estado !== 'finalizadas') ?? convs[0]
      if (!c) continue
      const trans = txt(p.transaccion)
      if (trans) {
        // Se reclama con una actualización condicional y solo sobre `_pagos`: si Hotmart manda el mismo
        // pago dos veces al mismo tiempo, las reglas corren una sola vez, y no se pisa el resto de `extra`.
        const reclamada = await prisma.$executeRaw`
          UPDATE crm_conversaciones SET extra = jsonb_set(coalesce(extra, '{}'::jsonb), '{_pagos}',
            (CASE WHEN jsonb_typeof(extra->'_pagos') = 'array' THEN extra->'_pagos' ELSE '[]'::jsonb END) || to_jsonb(${trans}::text))
          WHERE id = ${c.id} AND NOT ((CASE WHEN jsonb_typeof(extra->'_pagos') = 'array' THEN extra->'_pagos' ELSE '[]'::jsonb END) @> to_jsonb(ARRAY[${trans}::text]))`
        if (!reclamada) continue
        await prisma.$executeRaw`
          UPDATE crm_conversaciones SET extra = jsonb_set(extra, '{_pagos}',
            (SELECT jsonb_agg(e ORDER BY i) FROM jsonb_array_elements(extra->'_pagos') WITH ORDINALITY t(e, i) WHERE i > jsonb_array_length(extra->'_pagos') - 20))
          WHERE id = ${c.id} AND jsonb_array_length(extra->'_pagos') > 20`
      }
      // Embudo automático (lote 5): Hotmart confirmó el pago → la etapa de pago del equipo, sin IA y antes de las
      // reglas de pago (así «Cambiar etapa a Pagado» no deja otro cambio). Import dinámico: iaEmbudo importa este archivo.
      await import('./iaEmbudo').then(m => m.pasarAPagoPorHotmart(c.id, p))
        .catch(e => logger.warn(`[CRM reglas] etapa de pago por Hotmart en ${c.id}: ${(e as Error)?.message ?? e}`))
      await dispararReglas('pago', c.id, { ...p })
      n++
    }
    return n
  } catch (e) {
    logger.error(`[CRM reglas] pago de Hotmart ${p.transaccion ?? ''}: ${(e as Error)?.message ?? e}`)
    return 0
  }
}

// ─── 48 horas sin respuesta ──────────────────────────────────────────────────

const HORAS_SIN_RESPUESTA = 48
/** Solo las que se quedaron sin respuesta hace poco: al encender la regla no se despiertan conversaciones viejas. */
const DIAS_MAXIMO = 7

/**
 * Proceso periódico: conversaciones abiertas o pendientes cuyo último mensaje
 * de una persona fue del asesor (un `out` con autor que no falló) hace 48
 * horas o más, sin respuesta del cliente después. Los mensajes automáticos
 * (reglas, flujos, agente) no cuentan, así que una plantilla de seguimiento
 * no reinicia el reloj. Una sola vez por conversación y por período: el
 * período es ese mensaje del asesor (`extra._sinRespuesta`); si el asesor
 * vuelve a escribir, empieza otro. Devuelve cuántas disparó.
 */
export async function revisarSinRespuesta(): Promise<number> {
  const reglas = (await reglasGuardadas()).filter(r => r.on && eventoDeCuando(r.cuando) === 'sinRespuesta')
  if (!reglas.length) return 0
  const limite = new Date(Date.now() - HORAS_SIN_RESPUESTA * 3_600_000)
  const desde = new Date(Date.now() - (HORAS_SIN_RESPUESTA * 3_600_000 + DIAS_MAXIMO * 86_400_000))
  const filas = await prisma.$queryRaw<{ id: number; msg_id: string; en: Date }[]>`
    SELECT c.id, u.id AS msg_id, u."createdAt" AS en
    FROM crm_conversaciones c
    JOIN LATERAL (
      SELECT m.id, m.tipo, m."createdAt" FROM crm_mensajes m
      WHERE m.conversacion_id = c.id
        AND (m.tipo = 'in' OR (m.tipo = 'out' AND m.autor_id IS NOT NULL AND coalesce(m.estado, '') <> 'fallido'))
      ORDER BY m."createdAt" DESC LIMIT 1
    ) u ON true
    WHERE c.espacio_id = ${espacioActual()} AND c.estado IN ('abiertas', 'pendientes')
      AND u.tipo = 'out' AND u."createdAt" <= ${limite} AND u."createdAt" >= ${desde}
      AND coalesce(c.extra->>'_sinRespuesta', '') <> u.id
    ORDER BY u."createdAt" ASC
    LIMIT 200`
  let n = 0
  for (const f of filas) {
    // Se reclama con una actualización condicional: dos procesos no la disparan dos veces.
    const reclamada = await prisma.$executeRaw`
      UPDATE crm_conversaciones SET extra = jsonb_set(coalesce(extra, '{}'::jsonb), '{_sinRespuesta}', to_jsonb(${f.msg_id}::text))
      WHERE id = ${f.id} AND coalesce(extra->>'_sinRespuesta', '') <> ${f.msg_id}`
    if (!reclamada) continue
    await dispararReglas('sinRespuesta', Number(f.id), { desde: new Date(f.en).toISOString(), msgId: f.msg_id })
    n++
  }
  return n
}
