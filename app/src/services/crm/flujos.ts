import type { CrmContacto, CrmConversacion, CrmMensaje, Prisma } from '@prisma/client'
import { prisma } from './bd'
import { espacioActual } from './espacio'
import { logger } from '../../utils/logger'
import { avisar } from '../notificaciones'
import type { CtxEntrante } from './automatizaciones'
import { leerAjuste, leerPreferencias } from './ajustes'
import { guardarMensaje } from './salientes'
import { enviarPorWhatsapp, idDeOpcion, recortar } from './whatsapp'
import { repartir } from './reparto'
import { fichaDeContacto } from './fichaExterna'
import { emitirConv } from './tiempoReal'
import { idDeNombre, nombreDe } from './usuarios'
import { esFestivo } from './difusiones'
import { tieneSalida } from './formas'

/**
 * Motor de flujos del CRM (26-sep-2026): corre de verdad en WhatsApp los
 * flujos encendidos de Ajustes del CRM > Flujos (ajuste `flujos`, la forma de
 * FLUJOS en la pantalla). Lo llama el despachador (automatizaciones.ts) con
 * cada mensaje que entra, y el proceso de cada minuto (flujosVencidos).
 *
 * - flujoIniciar: primer contacto (conversación nueva, o reabierta sin
 *   asesor). Si el agente IA no la tomó, arranca el primer flujo encendido del
 *   canal cuyo «Cuándo» se cumple. «Saltar si ya es un contacto conocido»:
 *   con conversaciones anteriores, dueño o cliente de la plataforma no
 *   corre (salvo el cliente cuando el flujo tiene la ramificación con el
 *   atajo de clientes, que tiene su propio saludo y va directo a la lista).
 * - flujoContinuar: la conversación está en un flujo y el cliente respondió.
 * - flujosVencidos: el cliente no respondió en «espera» minutos: el flujo
 *   termina y la conversación pasa al reparto.
 *
 * El estado va en conversacion.extra._flujo (id del flujo, ruta del paso, qué
 * espera, reintentos, desde cuándo y una versión para que dos procesos no lo
 * pisen). Cada mensaje del flujo se guarda como {bot: …} (con botones o lista)
 * y sale por WhatsApp. Al terminar queda {ev:'flow', t:'Flujo X terminado: …'}.
 * Todo lo que manda un flujo es respuesta a lo que el cliente acaba de
 * escribir: nunca inicia un contacto (Ley 2300), y siempre termina en una
 * persona (reparto, un asesor o el líder).
 */

type Json = Record<string, any>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})
const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const dormir = (ms: number) => new Promise(r => setTimeout(r, ms))

// ─── Textos fijos de la pantalla ─────────────────────────────────────────────

export const TXT_REPETIR = 'Para poder ayudarte, elige una de las opciones, por favor.'
const TXT_REINTENTO = 'No te entendí, ¿me lo repites?'
const TXT_ELIGE = 'Elige una opción, por favor.'
const CUANDO_PRIMER = 'Llega el primer mensaje de un número nuevo'
const ESPERA_DEFECTO = 10

// ─── Formas de la pantalla (10-nucleo.js: FLUJOS, TIPOS_PASO, paso «ramas») ─

interface Paso {
  t: string
  txt?: string
  guardar?: string
  validar?: string
  reintento?: string
  ops?: unknown[]
  boton?: string
  tag?: string
  a?: string
  soloNuevos?: boolean
  // Paso «ramas» (la Bienvenida aprobada)
  ventas?: Paso[]
  saludoConocido?: string
  lista?: { txt?: string; boton?: string; ops?: { t: string; d?: string; eq?: string }[] }
  despues?: Record<string, Paso[]>
}
interface Flujo {
  id: string
  n: string
  on: boolean
  cuando?: string
  canales?: string[]
  saltarConocidos?: boolean
  espera?: number | string
  pasos: Paso[]
  atajos?: { anuncio?: boolean; registrado?: boolean; intentos?: number | string }
}

// Los mismos valores por defecto que la pantalla: si el ajuste `flujos` nunca
// se guardó, la pantalla muestra la Bienvenida encendida y aquí corre esa.
export const FLUJOS_DEFECTO: Flujo[] = [
  {
    id: 'bienvenida', n: 'Bienvenida', on: true, cuando: CUANDO_PRIMER, canales: ['wa', 'ig', 'fb', 'tg', 'tt', 'web'], saltarConocidos: true, espera: 10,
    pasos: [
      { t: 'mensaje', txt: '¡Hola! Gracias por escribirnos.' },
      { t: 'pregunta', txt: 'Para una mejor atención, ¿nos regalas tu nombre y apellido?', guardar: 'Nombre del contacto', validar: 'Nombre y apellido', reintento: '¿Me regalas también tu apellido? Así el asesor te atiende por tu nombre.' },
      {
        t: 'ramas',
        txt: '¡Gracias, {{nombre}}! ¿Ya eres cliente?',
        ops: [{ op: 'Quiero información', va: 'ventas' }, { op: 'Ya soy cliente', va: 'lista' }],
        ventas: [
          { t: 'mensaje', txt: '¡Con gusto! Un asesor te escribe en unos minutos para ayudarte.' },
        ],
        saludoConocido: '¡Hola, {{nombre}}! Qué bueno leerte.',
        lista: {
          txt: 'Por favor, toca «Ver opciones» y elige en qué te podemos ayudar.', boton: 'Ver opciones', ops: [
            { t: 'Pagos y cuotas', d: 'Pagar una cuota o un pago que no pasó', eq: 'Soporte de ventas' },
            { t: 'Reembolsos y cambios', d: 'Devolución o cambio de una compra', eq: 'Soporte de ventas' },
            { t: 'No me llegó mi compra', d: 'Compraste y todavía no la recibes', eq: 'Soporte de ventas' },
            { t: 'Ayuda con mi compra', d: 'Dudas de uso o algo que no funciona', eq: 'Soporte' },
            { t: 'Otra consulta', d: 'Cualquier otra cosa en que te podamos ayudar', eq: 'Soporte' },
            { t: 'Comprar otra vez', d: 'Conocer otros productos y precios', eq: 'Ventas' },
          ],
        },
        despues: {
          'Ventas': [{ t: 'mensaje', txt: '¡Con gusto! Un asesor te escribe en unos minutos.' }],
          'Soporte de ventas': [
            { t: 'pregunta', txt: 'Para buscar tu compra, ¿con qué correo la hiciste?', validar: 'Correo', reintento: 'Ese correo no parece completo, ¿me lo escribes de nuevo?', soloNuevos: true },
            { t: 'mensaje', txt: 'Gracias. Ya pasamos tu caso a soporte de ventas y te escriben en unos minutos.' },
          ],
          'Soporte': [
            { t: 'mensaje', txt: 'Perfecto. Alguien de soporte te escribe en unos minutos.' },
          ],
        },
      } as Paso,
    ],
    atajos: { anuncio: true, registrado: true, intentos: 1 },
  },
  {
    id: 'interes', n: 'Interés por producto', on: false, cuando: CUANDO_PRIMER, canales: ['wa'], saltarConocidos: true, espera: 10,
    pasos: [
      { t: 'mensaje', txt: '¡Hola! Gracias por escribirnos.' },
      { t: 'botones', txt: '¿Qué te interesa?', ops: ['Producto A', 'Producto B', 'Otro'], guardar: 'Etiqueta' },
      { t: 'asignar', a: 'Reparto automático · equipo Ventas' },
    ],
  },
]

/** Los campos personalizados por defecto de la pantalla (CAMPOS): nombre visible → clave. */
const CAMPOS_DEFECTO = [
  { k: 'producto', n: 'Producto' }, { k: 'empresa', n: 'Empresa' },
  { k: 'representante', n: 'Representante legal' }, { k: 'telRepresentante', n: 'Teléfono del representante legal' }, { k: 'numCliente', n: 'Número de cliente' },
]

/** Horario por defecto de la pantalla (CFG.horario): todos los días de 7 a. m. a 10 p. m. */
const HORARIO_DEFECTO = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(d => [d, '7:00', '22:00', true])

async function leerFlujos(): Promise<Flujo[]> {
  const v = await leerAjuste<unknown>('flujos')
  if (!Array.isArray(v)) return FLUJOS_DEFECTO
  return v.map(obj).filter(f => txt(f.id) && Array.isArray(f.pasos)) as Flujo[]
}

const minutosDeEspera = (f: Flujo | null | undefined) => {
  const n = typeof f?.espera === 'number' ? f.espera : parseFloat(String(f?.espera ?? '').replace(',', '.').replace(/[^\d.]/g, ''))
  return Number.isFinite(n) && n > 0 ? Math.min(Math.max(n, 1), 24 * 60) : ESPERA_DEFECTO
}
const intentosDe = (f: Flujo) => {
  const n = Number(f.atajos?.intentos ?? 1)
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 5) : 1
}
/** Título de una opción: texto suelto u objetos {t} / {op}. */
const tituloDe = (o: unknown) => (typeof o === 'string' ? o.trim() : txt(obj(o).t) || txt(obj(o).op) || txt(obj(o).title))
/** Las opciones con título, en el mismo orden con el que salen por WhatsApp (de ahí sale el id de cada una). */
const conTitulo = <T>(ops: T[] | undefined): T[] => (Array.isArray(ops) ? ops : []).filter(o => tituloDe(o))
const titulosDe = (ops: unknown[] | undefined) => conTitulo(ops).map(tituloDe)

// ─── Horario (cfg.horario, con festivos como domingo) ───────────────────────

/** ¿Estamos fuera del horario de atención? `soloGuardado`: sin cfg guardado con `fuera`, nunca (como entrantes.ts). */
async function fueraDeHorario(soloGuardado: boolean): Promise<{ fuera: boolean; texto: string }> {
  const cfg = await leerAjuste<Json>('cfg')
  const texto = txt(cfg?.fuera)
  if (soloGuardado && (!cfg || !texto || !Array.isArray(cfg.horario))) return { fuera: false, texto }
  const horario = Array.isArray(cfg?.horario) ? cfg!.horario : HORARIO_DEFECTO
  // Import perezoso: entrantes.ts importa el despachador, que importa este archivo.
  const { dentroDeHorario } = await import('./entrantes')
  let cuando = new Date()
  const b = new Date(cuando.getTime() - 5 * 3_600_000) // Bogotá, UTC−5 todo el año
  if (cfg?.festivos !== false && esFestivo(b.getUTCFullYear(), b.getUTCMonth() + 1, b.getUTCDate())) {
    // «Festivos de Colombia como domingo»: la misma hora del domingo anterior.
    cuando = new Date(cuando.getTime() - b.getUTCDay() * 86_400_000)
  }
  return { fuera: !dentroDeHorario(horario, cuando), texto }
}

// ─── Validar y guardar respuestas ────────────────────────────────────────────

/** Un correo dentro de una frase: «es Maria@Gmail.com gracias». */
const RE_CORREO_EN = /[^\s@<>()"',;:¡!¿?]+@[^\s@<>()"',;:¡!¿?]+\.[a-z]{2,}/i
const correoDe = (v: string) => (v.match(RE_CORREO_EN)?.[0] ?? '').replace(/^[.\-_]+/, '')

// Palabras con las que empieza un saludo o una presentación («Buenas tardes, soy…», «mi nombre es…»).
const RELLENO_INICIO = new Set(['hola', 'ola', 'holi', 'buenas', 'buenos', 'buena', 'buen', 'dia', 'dias', 'tarde', 'tardes', 'noche', 'noches', 'saludos', 'que', 'tal',
  'me', 'llamo', 'mi', 'nombre', 'es', 'soy', 'yo', 'habla', 'le', 'con', 'mucho', 'gusto', 'claro', 'si', 'ok', 'listo', 'bueno', 'contacto',
  'dr', 'dra', 'sr', 'sra', 'srta', 'senor', 'senora', 'don', 'dona', 'profe', 'profesor', 'profesora'])
const RELLENO_FIN = new Set(['gracias', 'muchas', 'porfa', 'porfavor', 'please', 'ok', 'saludos', 'bendiciones'])
// Palabras que no van en un nombre: si aparecen, lo que escribió es una pregunta o un pedido, no su nombre.
const NO_NOMBRE = new Set(['quiero', 'quisiera', 'queria', 'info', 'informacion', 'informes', 'precio', 'precios', 'valor', 'costo', 'cuanto', 'cuantos',
  'interesa', 'interesado', 'interesada', 'necesito', 'ayuda', 'gracias', 'favor', 'porfa',
  'si', 'no', 'ok', 'okey', 'listo', 'bien', 'claro', 'estoy', 'tengo', 'hijo', 'hija', 'mama', 'papa',
  'pago', 'pagos', 'cuota', 'cuotas', 'pedido', 'compra',
  'comprar', 'saber', 'pregunta', 'preguntar', 'duda', 'dudas', 'hola', 'buenas', 'buenos', 'dias', 'tardes', 'noches',
  'que', 'como', 'donde', 'cuando', 'cual', 'para', 'sobre', 'por', 'un', 'una', 'unos', 'mas', 'asesor', 'asesora', 'whatsapp', 'anuncio',
  'ver', 'vi', 'sticker', 'imagen', 'audio', 'video', 'mensaje', 'llego', 'puedo', 'puede', 'quien', 'porque', 'pero', 'tambien', 'aqui', 'hay',
  'esta', 'este', 'esto', 'eso', 'ese', 'perfecto', 'nada', 'gratis', 'descuento', 'promo', 'promocion', 'horario', 'horarios', 'plataforma',
  'link', 'enlace', 'correo', 'numero', 'celular', 'telefono', 'contacto', 'grupo'])
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'da', 'di', 'van', 'von'])

/**
 * «Buenas tardes, soy VALENTINA RUIZ 😊» → «Valentina Ruiz». Toma el primer
 * trozo de la frase que queda después de quitar saludos y presentaciones, sin
 * emojis ni números, con mayúscula inicial. Puede quedar vacío.
 */
function limpiarNombre(v: string): string {
  let s = ''
  for (const trozo of String(v ?? '').split(/[.,;:!¡?¿\n()"«»]+/)) {
    const palabras = trozo.replace(/[^\p{L}\s'-]/gu, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
    while (palabras.length && RELLENO_INICIO.has(plano(palabras[0]))) palabras.shift()
    while (palabras.length && RELLENO_FIN.has(plano(palabras[palabras.length - 1]))) palabras.pop()
    if (palabras.length >= 2 && plano(palabras.slice(-2).join(' ')) === 'por favor') palabras.splice(-2)
    if (palabras.length) { s = palabras.join(' '); break }
  }
  if (!s) return ''
  if (s === s.toUpperCase() || s === s.toLowerCase()) s = s.toLowerCase()
  s = s.replace(/(^|[\s'-])(\p{L})/gu, (_m, a: string, b: string) => a + b.toUpperCase())
  s = s.replace(/ (De|Del|La|Las|Los|Y|E)(?= )/g, (m) => m.toLowerCase())
  return s.slice(0, 80).trim()
}

/** ¿Parece un nombre? Solo letras, sin palabras de pedidos o preguntas, entre `min` y 5 palabras (sin contar «de», «la»…). */
function esNombre(n: string, min: number): boolean {
  const palabras = n.split(' ').filter(Boolean)
  if (!palabras.length || !palabras.every(w => /^\p{L}[\p{L}'-]*$/u.test(w))) return false
  if (palabras.some(w => NO_NOMBRE.has(plano(w)))) return false
  const propias = palabras.filter(w => !PARTICULAS.has(plano(w)))
  return propias.length >= min && propias.length <= 5 && propias.every(w => w.length >= 2)
}

function valida(validar: string | undefined, v: string): boolean {
  const t = v.trim()
  if (!t) return false
  switch (plano(validar ?? '')) {
    case 'nombre y apellido': return esNombre(limpiarNombre(t), 2)
    case 'correo': return !!correoDe(t)
    case 'numero': return /^\d[\d\s.,]*$/.test(t)
    case 'telefono': { const d = t.replace(/[\s()+.-]/g, ''); return /^\d{7,15}$/.test(d) }
    default: return true
  }
}

// Palabras sueltas que no alcanzan para elegir una opción («de», «la»…).
const MUY_CORTAS = new Set(['de', 'la', 'el', 'y', 'a', 'o', 'en', 'que', 'con', 'por', 'los', 'las', 'un', 'una', 'mi', 'me', 'se', 'no', 'si', 'es', 'lo'])

/**
 * Elige una opción por el id del botón o fila, por el título, por lo que
 * escribió si nombra una sola opción («tengo un problema con pagos y
 * cuotas»), o si lo que escribió está dentro de una sola opción.
 */
function elegir(ctx: Pick<CtxEntrante, 'respuestaId'>, texto: string, titulos: string[], maxTitulo: number, _guardar?: string): number {
  if (ctx.respuestaId) {
    const i = titulos.findIndex((o, j) => idDeOpcion(j, o) === ctx.respuestaId)
    if (i >= 0) return i
  }
  const t = plano(texto ?? '')
  if (!t) return -1
  const exacta = titulos.findIndex(o => plano(o) === t || plano(recortar(o, maxTitulo, true)) === t)
  if (exacta >= 0) return exacta
  const conEspacios = (s: string) => ` ${s} `
  const unica = (js: number[]) => (js.length === 1 ? js[0] : -1)
  const planos = titulos.map(o => plano(o))
  const nombra = unica(planos.map((p, j) => (p.length >= 4 && conEspacios(t).includes(conEspacios(p)) ? j : -1)).filter(j => j >= 0))
  if (nombra >= 0) return nombra
  if (t.length >= 2 && !MUY_CORTAS.has(t)) {
    const dentro = unica(planos.map((p, j) => (conEspacios(p).includes(conEspacios(t)) ? j : -1)).filter(j => j >= 0))
    if (dentro >= 0) return dentro
  }
  return -1
}

/**
 * Lo que escribió el cliente, sin los textos que arma el CRM cuando el
 * mensaje no es texto: un archivo que no se pudo guardar, un tipo que no se
 * muestra, una ubicación o un contacto compartido no son una respuesta.
 */
async function textoDelCliente(ctx: CtxEntrante): Promise<string> {
  const m = await prisma.crmMensaje.findUnique({ where: { id: ctx.msgId }, select: { datos: true } }).catch(() => null)
  return m ? textoDeDatos(m.datos) : ctx.texto ?? ''
}
function textoDeDatos(datos: unknown): string {
  const d = obj(datos)
  if (d.mediaId !== undefined || d.tipoWa !== undefined) return ''
  if (typeof d.in === 'string') return /^(📍 |Contacto: )/u.test(d.in) ? '' : d.in
  const o = obj(d.in)
  return txt(o.cap) || txt(o.trans) || ''
}

/**
 * ¿Mandó dos veces seguidas lo mismo (en menos de 20 s) y el segundo llegó
 * como respuesta a la pregunta nueva? Es un reenvío, no un intento: si no, un
 * nombre enviado dos veces gastaría la única repetición de los botones.
 */
async function reenvio(convId: number, msgId: string, texto: string, preguntaDesde: string): Promise<boolean> {
  const actual = await prisma.crmMensaje.findUnique({ where: { id: msgId }, select: { createdAt: true } })
  if (!actual || !plano(texto)) return false
  const previo = await prisma.crmMensaje.findFirst({
    where: { conversacionId: convId, tipo: 'in', id: { not: msgId }, createdAt: { lte: actual.createdAt } },
    orderBy: { createdAt: 'desc' }, select: { datos: true, createdAt: true },
  })
  if (!previo || previo.createdAt.getTime() >= Date.parse(preguntaDesde)) return false
  if (actual.createdAt.getTime() - previo.createdAt.getTime() > 20_000) return false
  return plano(textoDeDatos(previo.datos)) === plano(texto)
}

// ─── Estado del flujo en conversacion.extra._flujo ───────────────────────────

type Espera = 'texto' | 'boton' | 'lista'
interface Estado {
  id: string
  n: string
  /** pasos.2 · pasos.2.ops · pasos.2.ventas.0 · pasos.2.lista · pasos.2.despues.Soporte de ventas.0 */
  ruta: string
  espera: Espera | null
  intentos: number
  desde: string
  inicio: string
  v: number
  registrado: boolean
  anuncio: boolean
  nombreRegistrado: string | null
  equipo: string | null
  resumen: string[]
  /** Lo que dio como nombre en el primer intento si le faltó el apellido («Valentina»): se junta con el reintento («Ruiz»). */
  previo: string | null
}
interface Cursor { i: number; rama?: 'ops' | 'lista' | 'ventas' | 'despues'; eq?: string; k?: number }

function aRuta(c: Cursor): string {
  if (!c.rama) return `pasos.${c.i}`
  if (c.rama === 'ops' || c.rama === 'lista') return `pasos.${c.i}.${c.rama}`
  if (c.rama === 'ventas') return `pasos.${c.i}.ventas.${c.k ?? 0}`
  return `pasos.${c.i}.despues.${c.eq}.${c.k ?? 0}`
}
function deRuta(r: string): Cursor | null {
  const m = String(r ?? '').match(/^pasos\.(\d+)(?:\.(ops|lista)|\.ventas\.(\d+)|\.despues\.(.+)\.(\d+))?$/)
  if (!m) return null
  const i = Number(m[1])
  if (m[2]) return { i, rama: m[2] as 'ops' | 'lista' }
  if (m[3] !== undefined) return { i, rama: 'ventas', k: Number(m[3]) }
  if (m[4] !== undefined) return { i, rama: 'despues', eq: m[4], k: Number(m[5]) }
  return { i }
}

function leerEstado(extra: unknown): Estado | null {
  const e = obj(obj(extra)._flujo)
  if (!txt(e.id) || typeof e.v !== 'number') return null
  return {
    id: e.id, n: txt(e.n) || 'Flujo', ruta: txt(e.ruta), espera: (['texto', 'boton', 'lista'].includes(e.espera) ? e.espera : null) as Espera | null,
    intentos: Number(e.intentos) || 0, desde: txt(e.desde) || new Date(0).toISOString(), inicio: txt(e.inicio) || new Date(0).toISOString(), v: e.v,
    registrado: !!e.registrado, anuncio: !!e.anuncio, nombreRegistrado: txt(e.nombreRegistrado) || null, equipo: txt(e.equipo) || null,
    resumen: Array.isArray(e.resumen) ? e.resumen.map(String) : [], previo: txt(e.previo) || null,
  }
}

/**
 * Para procesos.ts (procesarSinAsignar): la conversación está en un flujo, o
 * el flujo la dejó para que el líder la reparta. El reparto automático no la toca.
 */
export function retenidaPorFlujo(extra: unknown): boolean {
  const e = obj(extra)
  return !!txt(obj(e._flujo).id) || !!e._flujoLider
}

/** Otro proceso cambió el flujo mientras este lo corría: se deja de hacer. */
class CambioConcurrente extends Error {}

type Fin =
  | { tipo: 'equipo'; equipo: string }
  | { tipo: 'asignar'; a: string }
  | { tipo: 'fin' }
  | { tipo: 'lider' }
  | { tipo: 'vencido'; minutos: number }
  | { tipo: 'fallo'; error: string }
  | { tipo: 'apagado' }
  | { tipo: 'error'; error: string }
  | { tipo: 'tomada'; quien: string }

type ConvConContacto = CrmConversacion & { contacto: CrmContacto }

// ─── Una corrida del flujo sobre una conversación ────────────────────────────

class Corrida {
  /** Versión guardada en la base (null: todavía no se guardó). */
  private vBase: number | null
  private fallo: string | null = null

  constructor(private conv: ConvConContacto, private f: Flujo, public est: Estado, vBase: number | null) {
    this.vBase = vBase
  }

  private get id() { return this.conv.id }

  // ── Estado ──

  /** Guarda el estado con la versión siguiente. Mientras el flujo atiende, el cliente no está «esperando» a un asesor. */
  async guardar(): Promise<void> {
    const nuevo: Estado = { ...this.est, v: (this.vBase ?? 0) + 1 }
    const json = JSON.stringify(nuevo)
    const ahora = new Date()
    const n = this.vBase === null
      ? await prisma.$executeRaw`UPDATE crm_conversaciones SET extra = (extra - '_flujoLider') || jsonb_build_object('_flujo', ${json}::jsonb), espera_desde = NULL, "updatedAt" = ${ahora}
          WHERE id = ${this.id} AND extra->'_flujo' IS NULL`
      : await prisma.$executeRaw`UPDATE crm_conversaciones SET extra = jsonb_set(extra, '{_flujo}', ${json}::jsonb), espera_desde = NULL, "updatedAt" = ${ahora}
          WHERE id = ${this.id} AND (extra->'_flujo'->>'v')::int = ${this.vBase}::int`
    if (!n) throw new CambioConcurrente(`el flujo de la conversación ${this.id} cambió mientras corría`)
    this.vBase = nuevo.v
    this.est = nuevo
  }

  /** Quita el estado (y deja la marca para el líder si toca). false si otro proceso ya lo cambió. */
  private async quitarEstado(marcaLider: boolean): Promise<boolean> {
    if (this.vBase === null) return true
    const marca = JSON.stringify(marcaLider ? { _flujoLider: { flujo: this.est.id, en: new Date().toISOString() } } : {})
    const n = await prisma.$executeRaw`UPDATE crm_conversaciones SET extra = (extra - '_flujo') || ${marca}::jsonb, "updatedAt" = ${new Date()}
      WHERE id = ${this.id} AND (extra->'_flujo'->>'v')::int = ${this.vBase}::int`
    return n > 0
  }

  private async esperar(c: Cursor, espera: Espera) {
    this.est.ruta = aRuta(c)
    this.est.espera = espera
    this.est.intentos = 0
    this.est.previo = null
    this.est.desde = new Date().toISOString()
    await this.guardar()
  }

  // ── Mensajes ──

  /**
   * {{nombre}} con el primer nombre; sin un nombre que parezca nombre (el
   * perfil de WhatsApp puede ser «🙂» o «Mamá»), se quita con su coma.
   */
  private texto(t: string | undefined): string {
    const completo = this.est.registrado && this.est.nombreRegistrado ? this.est.nombreRegistrado : (this.conv.contacto.nombre ?? '')
    const p = limpiarNombre(completo).split(' ')[0] ?? ''
    const primero = esNombre(p, 1) ? p : ''
    const s = String(t ?? '')
    if (primero) return s.replace(/\{\{\s*nombre\s*\}\}/gi, primero).trim()
    // «{{nombre}}, ¿cómo vas?» → «¿Cómo vas?»; «¡Gracias, {{nombre}}!» → «¡Gracias!».
    const sin = s.replace(/^\s*\{\{\s*nombre\s*\}\}\s*[,:]?\s*/i, '').replace(/,?\s*\{\{\s*nombre\s*\}\}/gi, '').trim()
    return sin && sin !== s.trim() ? sin.replace(/^([¡¿]?)(\p{Ll})/u, (_m, a: string, b: string) => a + b.toUpperCase()) : sin
  }

  /** El texto de una pregunta; si quedó vacío en Ajustes, uno que sirva según lo que guarda. */
  private pregunta(p: Paso): string {
    const t = this.texto(p.txt)
    if (t) return t
    const g = plano(txt(p.guardar) || txt(p.validar))
    return ({
      'nombre del contacto': '¿Cómo te llamas? Escríbenos tu nombre y apellido.', 'nombre y apellido': '¿Cómo te llamas? Escríbenos tu nombre y apellido.',
      correo: '¿Cuál es tu correo?', ciudad: '¿En qué ciudad vives?', producto: '¿Qué producto te interesa?',
      telefono: '¿Cuál es tu número de teléfono?', numero: '¿Nos escribes el número, por favor?',
    } as Record<string, string>)[g] ?? '¿Nos cuentas un poco más, por favor?'
  }

  /** Guarda {bot…} en la conversación y lo manda por WhatsApp, en orden. false si WhatsApp no lo aceptó. */
  async decir(datos: Json): Promise<boolean> {
    // El nombre del flujo viaja con cada mensaje: la bandeja muestra qué flujo habló.
    const m = await guardarMensaje(this.id, { ...datos, flujo: this.f.n }, { autorId: null, por: null })
    const r = await salir(m)
    if (r.estado === 'fallido') { this.fallo = r.error || 'WhatsApp no aceptó el mensaje'; return false }
    return true
  }

  /** Manda y, si WhatsApp no lo aceptó, termina el flujo y pasa la conversación al reparto. */
  private async decirO(datos: Json): Promise<boolean> {
    if (await this.decir(datos)) return true
    await this.terminar({ tipo: 'fallo', error: this.fallo ?? '' })
    return false
  }

  /** {bot, lista}: los ids salen de la posición entre las opciones con texto, igual que titulosDe (así se reconoce la fila elegida). */
  private datosLista(texto: string, boton: string | undefined, ops: unknown[]): Json {
    const filas = (ops ?? []).map(o => ({
      t: typeof o === 'string' ? o.trim() : txt(obj(o).t) || txt(obj(o).op) || txt(obj(o).title),
      d: typeof o === 'string' ? '' : txt(obj(o).d),
    })).filter(o => o.t).map((o, j) => ({ t: o.t, ...(o.d ? { d: o.d } : {}), id: idDeOpcion(j, o.t) }))
    return { bot: texto || TXT_ELIGE, lista: { boton: txt(boton) || 'Ver opciones', ops: filas } }
  }

  // ── Contacto ──

  private async contacto(): Promise<CrmContacto> {
    const k = await prisma.crmContacto.findUnique({ where: { id: this.conv.contactoId } })
    if (k) this.conv.contacto = k
    return this.conv.contacto
  }

  private async cambiarContacto(data: Prisma.CrmContactoUpdateInput) {
    this.conv.contacto = await prisma.crmContacto.update({ where: { id: this.conv.contactoId }, data })
    await emitirConv(this.id, null)
  }

  private async ponerEtiqueta(tag: string) {
    const t = txt(tag)
    if (!t) return
    const k = await this.contacto()
    if (!k.tags.some(x => x.toLowerCase() === t.toLowerCase())) await this.cambiarContacto({ tags: [...k.tags, t] })
    this.est.resumen.push(`etiqueta «${t}»`)
  }

  /**
   * El nombre que se guarda, o null si lo que escribió no parece un nombre.
   * Si en el primer intento dio solo el nombre («Valentina») y en el
   * reintento solo el apellido («Ruiz»), se juntan. Si al final solo hay una
   * palabra y el nombre que ya tenía el contacto la incluye, queda ese.
   */
  private nombreDe(v: string, pideApellido: boolean): string | null {
    const limpio = limpiarNombre(v)
    const previo = this.est.previo
    if (previo && pideApellido) {
      const tiene = ` ${plano(limpio)} `.includes(` ${plano(previo.split(' ')[0])} `)
      const junto = tiene ? limpio : `${previo} ${limpio}`.trim()
      if (esNombre(junto, 2)) return junto
    }
    if (esNombre(limpio, pideApellido ? 2 : 1)) return limpio
    const uno = [limpio, previo ?? ''].find(x => x && esNombre(x, 1))
    if (!uno) return null
    const actual = limpiarNombre(this.conv.contacto.nombre ?? '')
    if (esNombre(actual, 2) && ` ${plano(actual)} `.includes(` ${plano(uno)} `)) return actual
    return uno
  }

  /** Guarda la respuesta donde dice el paso: nombre, correo, ficha, campos o etiqueta. */
  private async guardarRespuesta(p: Paso, valor: string, esValida: boolean) {
    // esValida: pasó la validación del paso. Un correo o un teléfono que no la pasa no se guarda; un nombre sí.
    const destino = destinoDe(p)
    const v = valor.trim()
    if (!destino || !v) return
    const d = plano(destino)
    if (d === 'nombre del contacto' || d === 'nombre') {
      const n = this.nombreDe(v, plano(p.validar ?? '') === 'nombre y apellido')
      if (!n) { this.est.resumen.push('no dio su nombre'); return }
      if (n !== this.conv.contacto.nombre) await this.cambiarContacto({ nombre: n })
      this.est.resumen.push(`nombre ${n}`)
      return
    }
    if (d === 'correo') {
      const correo = correoDe(v).toLowerCase()
      if (!correo) return
      await this.cambiarContacto({ correo })
      this.est.resumen.push(`correo ${correo}`)
      // Con el correo se vuelve a buscar la compra en la plataforma (para Soporte de ventas).
      if (!this.est.registrado) {
        const r = await fichaDeContacto(this.conv.contactoId).catch(() => null)
        if (r?.ficha.externoId) { this.est.resumen.push('su compra está en la plataforma'); await emitirConv(this.id, null) }
      }
      return
    }
    if (d === 'etiqueta') return this.ponerEtiqueta(v)
    const k = await this.contacto()
    if (d === 'ciudad' || d === 'interes' || d === 'interés') {
      const clave = d === 'ciudad' ? 'ciudad' : 'interes'
      await this.cambiarContacto({ ficha: { ...obj(k.ficha), [clave]: v.slice(0, 120) } as Prisma.InputJsonValue })
      this.est.resumen.push(`${destino.toLowerCase()} ${v.slice(0, 60)}`)
      return
    }
    if (d === 'producto' && plano(v) === 'otro') return
    if ((d.includes('telefono') || d.includes('numero')) && !esValida) return
    // Un campo personalizado (ajuste `campos`, forma de CAMPOS): por su nombre visible o su clave.
    const campos = await leerAjuste<unknown>('campos')
    const lista = (Array.isArray(campos) ? campos.map(obj) : CAMPOS_DEFECTO) as { k?: string; n?: string }[]
    const def = lista.find(c => plano(txt(c.n)) === d || plano(txt(c.k)) === d)
    const clave = txt(def?.k) || d.replace(/ (\w)/g, (_m, l: string) => l.toUpperCase())
    await this.cambiarContacto({ campos: { ...obj(k.campos), [clave]: v.slice(0, 200) } as Prisma.InputJsonValue })
    this.est.resumen.push(`${destino.toLowerCase()} ${v.slice(0, 60)}`)
  }

  // ── Pasos ──

  private paso(c: Cursor): Paso | null {
    const p = this.f.pasos[c.i]
    if (!p) return null
    if (c.rama === 'ventas') return (p.ventas ?? [])[c.k ?? 0] ?? null
    if (c.rama === 'despues') return this.secuencia(c)[c.k ?? 0] ?? null
    return p
  }
  private secuencia(c: Cursor): Paso[] {
    const p = this.f.pasos[c.i]
    if (c.rama === 'ventas') return p?.ventas ?? []
    if (c.rama === 'despues') { const seq = obj(p?.despues)[c.eq ?? '']; return Array.isArray(seq) ? seq as Paso[] : [] }
    return this.f.pasos
  }
  private siguiente(c: Cursor): Cursor {
    return c.rama === 'ventas' || c.rama === 'despues' ? { ...c, k: (c.k ?? 0) + 1 } : { i: c.i + 1 }
  }

  /** Corre desde `c` hasta un paso que espera respuesta o hasta el final. */
  async avanzar(c: Cursor): Promise<void> {
    for (let guardia = 0; guardia < 80; guardia++) {
      const enRama = c.rama === 'ventas' || c.rama === 'despues'
      if (enRama) {
        const seq = this.secuencia(c)
        if ((c.k ?? 0) >= seq.length) return this.terminar({ tipo: 'equipo', equipo: c.rama === 'ventas' ? 'Ventas' : (c.eq || 'Ventas') })
      } else if (c.i >= this.f.pasos.length) {
        return this.terminar({ tipo: 'fin' })
      }
      const p = this.paso(c)
      if (!p) { c = this.siguiente(c); continue }
      // Lo que solo se le pregunta a quien todavía no es cliente.
      if (enRama && p.soloNuevos && this.est.registrado) { c = this.siguiente(c); continue }
      switch (p.t) {
        case 'ramas':
          if (enRama) { c = this.siguiente(c); continue }
          return this.entrarRamas(c.i)
        case 'mensaje': {
          const t = this.texto(p.txt)
          if (t && !(await this.decirO({ bot: t }))) return
          c = this.siguiente(c)
          continue
        }
        case 'pregunta':
          // En el chat de la web el nombre y apellido ya vienen del formulario de la burbuja: no se vuelven a pedir.
          if (this.conv.canal === 'web' && ['nombre del contacto', 'nombre'].includes(plano(destinoDe(p))) && esNombre(txt(this.conv.contacto.nombre), 2)) {
            this.est.resumen.push(`nombre ${txt(this.conv.contacto.nombre)}`)
            c = this.siguiente(c); continue
          }
          if (!(await this.decirO({ bot: this.pregunta(p) }))) return
          return this.esperar(c, 'texto')
        case 'botones': {
          const ops = titulosDe(p.ops)
          if (!ops.length) { c = this.siguiente(c); continue }
          if (!(await this.decirO({ bot: this.texto(p.txt) || TXT_ELIGE, botones: ops }))) return
          return this.esperar(c, 'boton')
        }
        case 'lista': {
          if (!titulosDe(p.ops).length) { c = this.siguiente(c); continue }
          if (!(await this.decirO(this.datosLista(this.texto(p.txt), p.boton, p.ops ?? [])))) return
          return this.esperar(c, 'lista')
        }
        case 'etiqueta':
          await this.ponerEtiqueta(txt(p.tag))
          c = this.siguiente(c)
          continue
        case 'asignar':
          return this.terminar({ tipo: 'asignar', a: txt(p.a) })
        default:
          c = this.siguiente(c)
      }
    }
    return this.terminar({ tipo: 'error', error: 'el flujo tiene demasiados pasos seguidos sin pregunta' })
  }

  /** La Bienvenida aprobada: anuncio → Ventas; cliente → saludo y lista; si no, la pregunta con los dos botones. */
  private async entrarRamas(i: number): Promise<void> {
    const rp = this.f.pasos[i]
    const at = this.f.atajos ?? {}
    const L = rp.lista ?? {}
    if (this.est.registrado && at.registrado) {
      this.est.resumen.push(`cliente registrado${this.est.nombreRegistrado ? ` (${limpiarNombre(this.est.nombreRegistrado)})` : ''}`)
      return this.mostrarLista(i, `${this.texto(rp.saludoConocido)} ${this.texto(L.txt)}`.trim())
    }
    if (this.est.anuncio && at.anuncio) {
      this.est.resumen.push('llegó de un anuncio')
      const cierre = [...(rp.ventas ?? [])].reverse().find(s => s.t === 'mensaje' && txt(s.txt))
      if (cierre && !(await this.decirO({ bot: this.texto(cierre.txt) }))) return
      return this.terminar({ tipo: 'equipo', equipo: 'Ventas' })
    }
    const ops = titulosDe(rp.ops)
    if (!ops.length) return this.mostrarLista(i, this.texto(L.txt))
    if (!(await this.decirO({ bot: this.texto(rp.txt) || '¿Ya eres cliente?', botones: ops }))) return
    return this.esperar({ i, rama: 'ops' }, 'boton')
  }

  private async mostrarLista(i: number, texto: string): Promise<void> {
    const L = this.f.pasos[i].lista ?? {}
    if (!titulosDe(L.ops).length) return this.terminar({ tipo: 'equipo', equipo: 'Ventas' })
    if (!(await this.decirO(this.datosLista(texto, L.boton, L.ops ?? [])))) return
    return this.esperar({ i, rama: 'lista' }, 'lista')
  }

  /** Lo que mandó el cliente mientras el flujo esperaba. */
  async responder(ctx: CtxEntrante): Promise<void> {
    const espera = this.est.espera
    const c = deRuta(this.est.ruta)
    const intentos = this.est.intentos
    const desdeAntes = this.est.desde
    // Se reclama el turno (versión nueva): si el proceso de vencidos llega a la vez, uno de los dos se retira.
    this.est.espera = null
    this.est.desde = new Date().toISOString()
    await this.guardar()
    if (!c || !espera) return this.terminar({ tipo: 'error', error: 'el flujo quedó a medias' })
    const p = this.paso(c)
    if (!p) return this.terminar({ tipo: 'fin' })
    const texto = await textoDelCliente(ctx)
    // Tocó un botón o una fila de un mensaje anterior del flujo (doble toque, o subió en el chat):
    // no es respuesta a lo de ahora. Se sigue esperando sin gastar un intento ni repetir nada.
    const toqueViejo = !!ctx.respuestaId && /^op\d+_/.test(ctx.respuestaId)
    const seguirEsperando = async () => {
      this.est.espera = espera
      this.est.intentos = intentos
      this.est.desde = desdeAntes
      await this.guardar()
    }
    const reintentar = async (datos: Json) => {
      if (!(await this.decirO(datos))) return
      this.est.espera = espera
      this.est.intentos = intentos + 1
      this.est.desde = new Date().toISOString()
      await this.guardar()
    }

    if (espera === 'texto') {
      if (toqueViejo) return seguirEsperando()
      const ok = valida(p.validar, texto)
      if (!ok && intentos < 1) {
        // «Valentina» sin apellido: se guarda para juntarlo con lo que responda al reintento.
        if (plano(p.validar ?? '') === 'nombre y apellido') { const x = limpiarNombre(texto); if (esNombre(x, 1)) this.est.previo = x }
        return reintentar({ bot: this.texto(p.reintento) || TXT_REINTENTO })
      }
      await this.guardarRespuesta(p, texto, ok)
      return this.avanzar(this.siguiente(c))
    }

    // Botones o lista: la pregunta de las ramas, la lista de opciones o un paso con opciones.
    const rp = this.f.pasos[c.i]
    const opciones: unknown[] = c.rama === 'ops' ? conTitulo(rp.ops) : c.rama === 'lista' ? conTitulo(rp.lista?.ops) : conTitulo(p.ops)
    const titulos = opciones.map(tituloDe)
    const j = elegir(ctx, texto, titulos, espera === 'lista' || titulos.length > 3 ? 24 : 20, c.rama === 'ops' || c.rama === 'lista' ? undefined : p.guardar)
    if (j < 0) {
      if (toqueViejo) return seguirEsperando()
      if (intentos === 0 && await reenvio(this.id, ctx.msgId, texto, desdeAntes)) return seguirEsperando()
      const enRama = c.rama === 'ventas' || c.rama === 'despues'
      if (intentos < intentosDe(this.f)) {
        const repetir = c.rama === 'ops' ? { bot: TXT_REPETIR, botones: titulos }
          : c.rama === 'lista' ? this.datosLista(TXT_REPETIR, rp.lista?.boton, rp.lista?.ops ?? [])
          : p.t === 'botones' ? { bot: TXT_REPETIR, botones: titulos }
          : this.datosLista(TXT_REPETIR, p.boton, p.ops ?? [])
        return reintentar(repetir)
      }
      // Ya se sabe a qué equipo va: sigue sin guardar lo que escribió (no es una de las opciones).
      if (enRama) {
        this.est.resumen.push(texto ? `escribió «${recortar(texto, 60, true)}» en vez de elegir` : 'no eligió una opción')
        return this.avanzar(this.siguiente(c))
      }
      return this.terminar({ tipo: 'lider' })
    }

    if (c.rama === 'ops') {
      const o = obj(opciones[j])
      this.est.resumen.push(`eligió «${titulos[j]}»`)
      const va = txt(o.va)
      if (va === 'ventas') return this.avanzar({ i: c.i, rama: 'ventas', k: 0 })
      if (va === 'lista') return this.mostrarLista(c.i, this.texto(rp.lista?.txt))
      if (va && obj(rp.despues)[va]) { this.est.equipo = va; return this.avanzar({ i: c.i, rama: 'despues', eq: va, k: 0 }) }
      return this.terminar({ tipo: 'equipo', equipo: va || 'Ventas' })
    }
    if (c.rama === 'lista') {
      const eq = txt(obj(opciones[j]).eq) || 'Ventas'
      this.est.resumen.push(`eligió «${titulos[j]}»`)
      this.est.equipo = eq
      return this.avanzar({ i: c.i, rama: 'despues', eq, k: 0 })
    }
    if (plano(txt(p.guardar)) === 'etiqueta') await this.ponerEtiqueta(titulos[j])
    else if (txt(p.guardar)) await this.guardarRespuesta(p, titulos[j], true)
    else this.est.resumen.push(`eligió «${titulos[j]}»`)
    return this.avanzar(this.siguiente(c))
  }

  // ── Final ──

  /** Termina el flujo: deja el evento y pasa la conversación a quien corresponde. */
  async terminar(fin: Fin): Promise<void> {
    const n = this.f.n || this.est.n || 'Flujo'
    let equipo: string | null = null
    let asesor: { id: string; nombre: string } | null = null
    if (fin.tipo === 'asignar') {
      const m = fin.a.match(/equipo\s+(.+)$/i)
      if (m) equipo = m[1].trim()
      else {
        const id = await idDeNombre(fin.a)
        if (id) asesor = { id, nombre: fin.a }
        else equipo = this.est.equipo || this.conv.equipo || 'Ventas'
      }
    } else if (fin.tipo === 'equipo') equipo = fin.equipo
    else if (fin.tipo !== 'lider' && fin.tipo !== 'tomada') equipo = this.est.equipo || this.conv.equipo || 'Ventas'

    if (!(await this.quitarEstado(fin.tipo === 'lider'))) return

    // Cuando el flujo entrega la conversación de noche: el aviso de fuera de horario (una vez al día, como entrantes.ts).
    const entrega = fin.tipo === 'equipo' || fin.tipo === 'asignar' || fin.tipo === 'fin'
    if (entrega) await this.avisoFueraDeHorario().catch(e => logger.warn(`[CRM flujos] aviso fuera de horario ${this.id}: ${(e as Error).message}`))

    const actual = await prisma.crmConversacion.findUnique({ where: { id: this.id }, select: { esperaDesde: true, asignadoId: true } })
    const datos: Prisma.CrmConversacionUpdateInput = {}
    if (equipo) datos.equipo = equipo
    // Desde aquí el cliente espera a una persona.
    if (fin.tipo !== 'tomada' && !actual?.esperaDesde) datos.esperaDesde = new Date()
    if (Object.keys(datos).length) await prisma.crmConversacion.update({ where: { id: this.id }, data: datos })

    const piezas = this.est.resumen.filter(Boolean)
    const dice = piezas.length ? `: ${piezas.join(', ')}` : ''
    const destino = asesor ? `Pasa a ${asesor.nombre}.` : `Pasa al reparto de ${equipo}.`
    const t = {
      equipo: `Flujo ${n} terminado${dice}. ${destino}`,
      asignar: `Flujo ${n} terminado${dice}. ${destino}`,
      fin: `Flujo ${n} terminado${dice}. ${destino}`,
      lider: `Flujo ${n} terminado: escribió en vez de elegir una opción${piezas.length ? ` (${piezas.join(', ')})` : ''}. Queda sin asignar para que el líder la reparta.`,
      vencido: `Flujo ${n} terminado: no respondió en ${fin.tipo === 'vencido' ? fin.minutos : ESPERA_DEFECTO} minutos${piezas.length ? ` (${piezas.join(', ')})` : ''}. ${destino}`,
      fallo: `Flujo ${n} terminado: no se pudo enviar un mensaje por WhatsApp${fin.tipo === 'fallo' && fin.error ? ` (${fin.error.slice(0, 300)})` : ''}. ${destino}`,
      apagado: `Flujo ${n} terminado: el flujo se apagó o se borró mientras corría${piezas.length ? ` (${piezas.join(', ')})` : ''}. ${destino}`,
      error: `Flujo ${n} terminado por un error${fin.tipo === 'error' ? `: ${fin.error.slice(0, 200)}` : ''}. ${destino}`,
      tomada: `Flujo ${n} terminado: ${fin.tipo === 'tomada' ? fin.quien : 'una persona'} tomó la conversación.`,
    }[fin.tipo]
    await guardarMensaje(this.id, { ev: 'flow', t }, { autorId: null, por: null })

    if (asesor && !actual?.asignadoId) await this.asignarA(asesor.id, asesor.nombre)
    else if (equipo && fin.tipo !== 'lider') await repartir(this.id)
    await emitirConv(this.id, null)
  }

  /** «Pasar al asesor» con una persona elegida en el paso (no por reparto). */
  private async asignarA(userId: string, nombre: string) {
    const n = this.f.n || this.est.n
    await prisma.crmConversacion.update({ where: { id: this.id }, data: { asignadoId: userId } })
    const k = await this.contacto()
    if (!k.asignadoId) await prisma.crmContacto.update({ where: { id: k.id }, data: { asignadoId: userId } })
    await guardarMensaje(this.id, { ev: 'swap', t: `Asignada a ${nombre} por el flujo ${n}` }, { autorId: null, por: null })
    const pref = await leerPreferencias(userId)
    if (pref.asignada !== false) {
      await avisar({
        userId, tipo: 'TAREA_ASIGNADA', titulo: 'Conversación nueva en el CRM',
        texto: `Te llegó la conversación con ${k.nombre || k.telefono || 'un contacto'} por el flujo ${n}.`,
        url: `/?conv=${this.id}`,
      })
    }
  }

  private async avisoFueraDeHorario() {
    const h = await fueraDeHorario(true)
    if (!h.fuera || !h.texto) return
    const b = new Date(Date.now() - 5 * 3_600_000)
    const inicioDia = new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate(), 5))
    const ya = await prisma.crmMensaje.findFirst({
      where: { conversacionId: this.id, tipo: 'bot', createdAt: { gte: inicioDia }, datos: { path: ['fuera'], equals: true } },
      select: { id: true },
    })
    if (!ya) await this.decir({ bot: h.texto, fuera: true })
  }

  /** Un error inesperado: se quita el estado sin mirar la versión, queda constancia y se reparte. */
  async abortar(e: unknown): Promise<void> {
    try {
      await prisma.$executeRaw`UPDATE crm_conversaciones SET extra = extra - '_flujo', "updatedAt" = ${new Date()} WHERE id = ${this.id}`
      this.vBase = null
      const n = this.f.n || this.est.n
      await guardarMensaje(this.id, { ev: 'flow', t: `Flujo ${n} terminado por un error: ${String((e as Error)?.message ?? e).slice(0, 200)}. Pasa al reparto.` }, { autorId: null, por: null })
      const c = await prisma.crmConversacion.findUnique({ where: { id: this.id }, select: { esperaDesde: true } })
      if (c && !c.esperaDesde) await prisma.crmConversacion.update({ where: { id: this.id }, data: { esperaDesde: new Date() } })
      await repartir(this.id)
      await emitirConv(this.id, null)
    } catch (e2) {
      logger.error(`[CRM flujos] no se pudo cerrar el flujo de ${this.id}: ${(e2 as Error)?.message ?? e2}`)
    }
  }
}

/**
 * Manda por WhatsApp un {bot…} ya guardado y espera a que salga, para que los
 * mensajes del flujo lleguen en orden. guardarMensaje hoy solo manda los `out`;
 * si más adelante también manda los `bot`, aquí solo se espera.
 */
async function salir(m: CrmMensaje): Promise<{ estado: string | null; error: string | null }> {
  if (m.estado === null) {
    const r = await prisma.crmMensaje.updateMany({ where: { id: m.id, estado: null, waId: null }, data: { estado: 'enviando' } })
    if (r.count) await enviarPorWhatsapp(m.id)
  }
  const hasta = Date.now() + 20_000
  for (;;) {
    const f = await prisma.crmMensaje.findUnique({ where: { id: m.id }, select: { estado: true, error: true } })
    if (!f || f.estado !== 'enviando' || Date.now() > hasta) return { estado: f?.estado ?? null, error: f?.error ?? null }
    await dormir(200)
  }
}

/** ¿Una persona ya tomó la conversación (asignada, o un asesor le escribió) desde que empezó el flujo? */
/** Dónde guarda la respuesta una pregunta: lo que diga el paso o lo que se deduce de su validación. */
function destinoDe(p: Paso): string {
  return txt(p.guardar) || (plano(p.validar ?? '') === 'correo' ? 'Correo' : plano(p.validar ?? '') === 'nombre y apellido' ? 'Nombre del contacto' : '')
}

async function tomadaPor(conv: CrmConversacion, est: Estado): Promise<string | null> {
  if (conv.asignadoId) return (await nombreDe(conv.asignadoId)) ?? 'un asesor'
  const out = await prisma.crmMensaje.findFirst({
    where: { conversacionId: conv.id, tipo: 'out', autorId: { not: null }, createdAt: { gte: new Date(est.inicio) } },
    select: { autorId: true },
  })
  return out ? (await nombreDe(out.autorId)) ?? 'un asesor' : null
}

/**
 * El contacto ya estaba vinculado al cliente (fichaDeContacto no dice por
 * dónde): es el cliente si el número o el correo son los suyos; si no,
 * es alguien de su familia y no se le saluda con el nombre del cliente.
 */
async function viaDelVinculo(_k: CrmContacto, _externoId: string): Promise<'telefono' | 'correo' | 'representante'> {
  // La ficha externa debe decir por dónde halló a la persona; si no lo dice, se toma lo más prudente.
  return 'representante'
}

/** Qué flujo corre: los de un «Cuándo» específico que se cumple primero; si no, el del primer mensaje. En cada grupo, el de arriba. */
async function elegirFlujo(flujos: Flujo[], conv: ConvConContacto): Promise<Flujo | null> {
  const activos = flujos.filter(f => f.on === true && f.pasos.length && (Array.isArray(f.canales) ? f.canales.includes(conv.canal) : conv.canal === 'wa'))
  const tipo = (f: Flujo) => {
    const c = plano(f.cuando || CUANDO_PRIMER)
    if (c.includes('anuncio')) return 'anuncio'
    if (c.includes('fuera de horario')) return 'fuera'
    if (c.includes('primer mensaje')) return 'primer'
    return 'otro'
  }
  let fuera: boolean | null = null
  for (const f of activos) {
    const t = tipo(f)
    if (t === 'anuncio' && conv.contacto.pauta) return f
    if (t === 'fuera') {
      if (fuera === null) fuera = (await fueraDeHorario(false)).fuera
      if (fuera) return f
    }
  }
  return activos.find(f => tipo(f) === 'primer') ?? null
}

// ─── Lo que llama el despachador ─────────────────────────────────────────────

/** Si la conversación está en un flujo, procesa la respuesta. true = el flujo se hizo cargo. */
export async function flujoContinuar(ctx: CtxEntrante): Promise<boolean> {
  let corrida: Corrida | null = null
  try {
    const conv = await prisma.crmConversacion.findUnique({ where: { id: ctx.convId }, include: { contacto: true } })
    if (!conv) return false
    // Se reabrió una conversación que un flujo había dejado para el líder: esa marca ya no aplica
    // (si quedara, el reparto de cada minuto nunca la tomaría).
    if (ctx.reabierta && obj(conv.extra)._flujoLider) {
      await prisma.$executeRaw`UPDATE crm_conversaciones SET extra = extra - '_flujoLider' WHERE id = ${conv.id}`
    }
    const est = leerEstado(conv.extra)
    if (!est) return false
    const flujos = await leerFlujos()
    const f = flujos.find(x => x.id === est.id)
    corrida = new Corrida(conv, f ?? { id: est.id, n: est.n, on: false, pasos: [] }, est, est.v)
    // Un estado viejo de una conversación que se finalizó y volvió: no se sigue.
    if (ctx.nueva || ctx.reabierta || conv.estado === 'finalizadas') {
      await prisma.$executeRaw`UPDATE crm_conversaciones SET extra = extra - '_flujo' WHERE id = ${conv.id} AND (extra->'_flujo'->>'v')::int = ${est.v}::int`
      return false
    }
    const quien = await tomadaPor(conv, est)
    if (quien) { await corrida.terminar({ tipo: 'tomada', quien }); return false }
    if (!f || f.on !== true) { await corrida.terminar({ tipo: 'apagado' }); return true }
    await corrida.responder(ctx)
    return true
  } catch (e) {
    if (e instanceof CambioConcurrente) { logger.info(`[CRM flujos] ${e.message}`); return true }
    logger.error(`[CRM flujos] conversación ${ctx.convId}: ${(e as Error)?.message ?? e}`)
    if (corrida) { await corrida.abortar(e); return true }
    return false
  }
}

/** Primer contacto: arranca el flujo encendido que corresponda. true = arrancó (y reparte él al terminar). */
export async function flujoIniciar(ctx: CtxEntrante): Promise<boolean> {
  let corrida: Corrida | null = null
  let guardada = false
  try {
    if (!ctx.nueva && !ctx.reabierta) return false
    const conv = await prisma.crmConversacion.findUnique({ where: { id: ctx.convId }, include: { contacto: true } })
    // Por donde el CRM puede contestar: WhatsApp con línea, el chat de la web, o Instagram y Messenger con su página.
    if (!conv || conv.estado === 'finalizadas' || conv.asignadoId || !tieneSalida(conv)) return false
    if (leerEstado(conv.extra)) return true
    const f = await elegirFlujo(await leerFlujos(), conv)
    if (!f) return false

    // ¿Ya lo conocemos? Cliente registrado, conversaciones anteriores o dueño.
    const k = conv.contacto
    const ficha = (await fichaDeContacto(k.id).catch(e => { logger.warn(`[CRM flujos] ficha externa de ${k.id}: ${(e as Error).message}`); return null }))?.ficha ?? null
    const registrado = !!ficha?.externoId
    const previas = await prisma.crmConversacion.count({ where: { contactoId: k.id, id: { not: conv.id } } })
    const conocido = registrado || previas > 0 || ctx.reabierta || !!k.asignadoId
    const rp = f.pasos.find(p => p.t === 'ramas')
    const atajoRegistrado = !!(rp && f.atajos?.registrado && registrado)
    if (f.saltarConocidos !== false && conocido && !atajoRegistrado) {
      await guardarMensaje(conv.id, { ev: 'flow', t: `No corre el flujo ${f.n}: ${registrado ? 'el número es de un cliente registrado' : 'ya es un contacto conocido'}. Pasa al reparto.` }, { autorId: null, por: null })
      return false
    }

    // El nombre de la plataforma es más confiable que el del perfil de WhatsApp (no si el número es del representante legal).
    const via = registrado ? (ficha?.via ?? await viaDelVinculo(k, ficha!.externoId!)) : null
    const nombreRegistrado = registrado && via !== 'representante' ? txt(ficha?.nombre) || null : null
    if (nombreRegistrado && ctx.contactoNuevo) conv.contacto = await prisma.crmContacto.update({ where: { id: k.id }, data: { nombre: limpiarNombre(nombreRegistrado) } })

    const ahora = new Date().toISOString()
    const est: Estado = {
      id: f.id, n: f.n, ruta: 'pasos.0', espera: null, intentos: 0, desde: ahora, inicio: ahora, v: 0,
      registrado, anuncio: !!k.pauta, nombreRegistrado, equipo: null, resumen: [], previo: null,
    }
    corrida = new Corrida(conv, f, est, null)
    try { await corrida.guardar() } catch (e) { if (e instanceof CambioConcurrente) return true; throw e }
    guardada = true
    // El cliente conocido salta el saludo y el nombre: va directo a la ramificación.
    await corrida.avanzar(atajoRegistrado && rp ? { i: f.pasos.indexOf(rp) } : { i: 0 })
    return true
  } catch (e) {
    if (e instanceof CambioConcurrente) { logger.info(`[CRM flujos] ${e.message}`); return true }
    logger.error(`[CRM flujos] al iniciar en ${ctx.convId}: ${(e as Error)?.message ?? e}`)
    if (corrida && guardada) { await corrida.abortar(e); return true }
    return false
  }
}

/**
 * Proceso cada minuto: los flujos que esperan una respuesta más de «espera»
 * minutos (10 por defecto) terminan y la conversación pasa al reparto. No le
 * escribe nada al cliente. También limpia estados viejos. Nunca lanza.
 */
export async function flujosVencidos(): Promise<void> {
  try {
    // La marca «para el líder» sobra cuando alguien ya la tomó o se finalizó.
    await prisma.$executeRaw`UPDATE crm_conversaciones SET extra = extra - '_flujoLider'
      WHERE espacio_id = ${espacioActual()} AND extra->'_flujoLider' IS NOT NULL AND (asignado_id IS NOT NULL OR estado = 'finalizadas')`
    const filas = await prisma.$queryRaw<{ id: number }[]>`SELECT id FROM crm_conversaciones WHERE espacio_id = ${espacioActual()} AND extra->'_flujo' IS NOT NULL ORDER BY id LIMIT 500`
    if (!filas.length) return
    const flujos = await leerFlujos()
    for (const { id } of filas) {
      try {
        const conv = await prisma.crmConversacion.findUnique({ where: { id }, include: { contacto: true } })
        const est = conv ? leerEstado(conv.extra) : null
        if (!conv || !est) continue
        if (conv.estado === 'finalizadas') {
          await prisma.$executeRaw`UPDATE crm_conversaciones SET extra = extra - '_flujo' WHERE id = ${id} AND (extra->'_flujo'->>'v')::int = ${est.v}::int`
          continue
        }
        const f = flujos.find(x => x.id === est.id)
        const minutos = minutosDeEspera(f)
        if (Date.now() - Date.parse(est.desde) < minutos * 60_000) continue
        const corrida = new Corrida(conv, f ?? { id: est.id, n: est.n, on: false, pasos: [] }, est, est.v)
        const quien = await tomadaPor(conv, est)
        await corrida.terminar(quien ? { tipo: 'tomada', quien } : { tipo: 'vencido', minutos })
        logger.info(`[CRM flujos] conversación ${id}: el flujo ${est.n} venció (${minutos} min)`)
      } catch (e) {
        logger.error(`[CRM flujos] vencido ${id}: ${(e as Error)?.message ?? e}`)
      }
    }
  } catch (e) {
    logger.error(`[CRM flujos] vencidos: ${(e as Error)?.message ?? e}`)
  }
}
