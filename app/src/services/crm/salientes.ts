import type { CrmMensaje, Prisma } from '@prisma/client'
import { prisma } from './bd'
import { logger } from '../../utils/logger'
import { ValidationError, NotFoundError } from '../../utils/errors'
import { avisar } from '../notificaciones'
import { enviarPorWhatsapp } from './whatsapp'
import { emitirConv, emitirMsg } from './tiempoReal'
import { usuariosCrm, nombreDe } from './usuarios'
import { leerAjuste, leerPreferencias } from './ajustes'
import { nombreCanal, tieneSalida } from './formas'
import { leerEquipos } from './equipos'
import { alcanceDePersona, veConv } from './alcance'

/**
 * Guardar un mensaje del CRM tal como lo pinta `burbuja()` de la maqueta y,
 * si es de salida por WhatsApp, mandarlo. Lo usan la ruta de mensajes, la de
 * conversación nueva y el proceso de programados (docs/crm/api-core.md).
 */

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})

/**
 * La clave que decide el tipo. `prog` va primero porque un programado trae
 * también `out` (el texto que saldrá): si `out` ganara, saldría de inmediato.
 */
export const TIPOS_MSG = ['prog', 'out', 'note', 'ev', 'bot', 'ia', 'csat', 'call', 'sugT', 'recepcion', 'in'] as const
export type TipoMsg = (typeof TIPOS_MSG)[number]

/** Tipos que son contenido de la conversación: mueven la hora del último mensaje. */
const MUEVEN_HORA = new Set(['out', 'in', 'bot', 'ia', 'recepcion', 'call'])

/**
 * Los mensajes de una misma conversación salen a Meta de a uno, en el orden en que se guardaron: una
 * respuesta rápida manda el texto y luego cada archivo, y un video pesado (se baja de la Nube y se sube
 * a Meta) no debe llegar después de la imagen que se mandó detrás de él. También la usa el aviso de fuera
 * de horario (entrantes.ts), para no quedar en medio del texto de una respuesta rápida y sus archivos.
 */
const colaEnvio = new Map<number, Promise<void>>()
export function enviarEnOrden(convId: number, msgId: string, tras?: string | null): Promise<void> {
  const p = (colaEnvio.get(convId) ?? Promise.resolve()).catch(() => {}).then(() => tras ? enviarTras(msgId, tras) : enviarPorWhatsapp(msgId))
  colaEnvio.set(convId, p)
  p.finally(() => { if (colaEnvio.get(convId) === p) colaEnvio.delete(convId) }).catch(() => {})
  return p
}

/** Por qué no sale un archivo cuyo texto no salió: el mismo que muestra la pantalla (80-datos.js). */
export const TEXTO_NO_SALIO = 'el texto que lo acompaña no salió'
/** ¿El texto que va delante de un archivo quedó sin salir? (en la cola ya terminó: salió o falló). */
async function textoNoSalio(tras: string): Promise<boolean> {
  const t = await prisma.crmMensaje.findUnique({ where: { id: tras }, select: { estado: true } })
  return !t || t.estado === 'fallido'
}
/**
 * Un archivo de una respuesta rápida sale solo si salió el texto que lo presenta (como desde el chat,
 * 56-compositor.js): si el texto falló, el archivo queda fallido y no le llega suelto al cliente.
 */
async function enviarTras(msgId: string, tras: string): Promise<void> {
  if (!(await textoNoSalio(tras))) return enviarPorWhatsapp(msgId)
  const r = await prisma.crmMensaje.updateMany({ where: { id: msgId, estado: 'enviando', waId: null }, data: { estado: 'fallido', error: TEXTO_NO_SALIO } })
  if (!r.count) return
  const f = await prisma.crmMensaje.findUnique({ where: { id: msgId } })
  if (f) emitirMsg(f.conversacionId, f, null)
}

// ─── Archivos de una respuesta rápida ────────────────────────────────────────

/** Un archivo de una respuesta rápida, como lo guardan Ajustes del CRM y Mis ajustes (56-compositor.js). */
export interface ArchivoRapida { n: string; url: string; mime?: string; peso?: number }
/** Hasta cuántos archivos lleva un mensaje programado. */
const MAX_ARCHIVOS = 30

/** Los archivos que se pueden mandar ({n, url, mime, peso}); el que no trae un enlace https se salta. */
export function archivosDe(v: unknown): ArchivoRapida[] {
  if (!Array.isArray(v)) return []
  const out: ArchivoRapida[] = []
  for (const x of v) {
    const a = obj(x)
    const url = typeof a.url === 'string' ? a.url.trim() : ''
    try { if (new URL(url).protocol !== 'https:') continue } catch { continue }
    const n = typeof a.n === 'string' && a.n.trim() ? a.n.trim().slice(0, 255) : 'archivo'
    const mime = typeof a.mime === 'string' && a.mime.trim() ? a.mime.trim().slice(0, 100) : ''
    const peso = typeof a.peso === 'number' && Number.isFinite(a.peso) && a.peso > 0 ? Math.round(a.peso) : 0
    out.push({ n, url, ...(mime ? { mime } : {}), ...(peso ? { peso } : {}) })
  }
  return out
}

// Igual que cmTipo y cmEtiqueta de 56-compositor.js: el tipo sale del mime o de la extensión.
function tipoArchivo(a: ArchivoRapida): 'imagen' | 'pdf' | 'video' | 'audio' | 'otro' {
  const m = String(a.mime ?? '').toLowerCase(), n = a.n.toLowerCase()
  if (/^image\//.test(m) || /\.(png|jpe?g|gif|webp)$/.test(n)) return 'imagen'
  if (/pdf/.test(m) || /\.pdf$/.test(n)) return 'pdf'
  if (/^video\//.test(m) || /\.(mp4|mov|3gp)$/.test(n)) return 'video'
  if (/^audio\//.test(m) || /\.(mp3|ogg|opus|m4a|aac|amr|wav)$/.test(n)) return 'audio'
  return 'otro'
}
const NOMBRE_TIPO = { imagen: 'Imagen', pdf: 'PDF', video: 'Video', audio: 'Audio', otro: 'Archivo' } as const
const tamano = (b: number) => b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`

/** El mensaje de un archivo tal como lo arma el chat (cmEnviarArchivos): sin texto, «Imagen · 320 KB» y su ícono. */
export function mensajeDeArchivo(a: ArchivoRapida): Json {
  const k = tipoArchivo(a)
  // Lote 7: el audio de una respuesta rápida sale como nota de voz (como una grabada en el chat), no como archivo.
  if (k === 'audio') return { out: '', audio: sinNulos({ url: a.url, mime: a.mime || null }) }
  return { out: '', file: sinNulos({ n: a.n, t: NOMBRE_TIPO[k] + (a.peso ? ` · ${tamano(a.peso)}` : ''), ic: k === 'video' ? 'play' : 'file', url: a.url, mime: a.mime || null }) }
}

export const SIN_LINEA = 'Esta conversación no tiene una línea de WhatsApp conectada. Elige una línea en la conversación o conecta una en Ajustes del CRM > Líneas de WhatsApp y vuelve a enviarlo.'
export const CANAL_SIN_ENVIO = 'Por ahora el CRM no envía por este canal. Responde a este contacto desde su canal o escríbele por WhatsApp.'
export const SIN_PAGINA = 'La página de Facebook de esta conversación ya no está conectada al CRM. Vuelve a conectarla en Ajustes del CRM > Canales y vuelve a enviarlo.'
/** Por qué no sale un mensaje de una conversación sin salida (formas.ts, tieneSalida). */
export const sinSalida = (canal: string) => canal === 'wa' ? SIN_LINEA : canal === 'fb' ? SIN_PAGINA
  : ['ig', 'tg', 'tt'].includes(canal) ? `La cuenta de ${nombreCanal(canal)} de esta conversación ya no está conectada al CRM. Vuelve a conectarla en Ajustes del CRM > Canales y vuelve a enviarlo.`
  : canal === 'mail' ? 'El correo de esta conversación ya no está conectado al CRM. Vuelve a conectarlo en Ajustes del CRM > Canales y vuelve a enviarlo.'
  : CANAL_SIN_ENVIO

export function tipoDe(datos: Json): TipoMsg | null {
  const t = TIPOS_MSG.find(k => datos[k] !== undefined && datos[k] !== null && datos[k] !== '')
  if (t) return t
  // Archivo, nota de voz, enlace o plantilla sin texto: `out` llega vacío pero es un envío.
  if (datos.out === '' && (datos.file || datos.audio || datos.link || datos.plantilla)) return 'out'
  return null
}

// ─── Lo que la pantalla puede crear por la ruta ──────────────────────────────

/**
 * Tipos que una persona crea desde la bandeja (POST /conversaciones/:id/mensajes
 * y POST /conversaciones). Los demás (`in`, `csat`, `bot`, `ia`, `recepcion`,
 * `sugT`) solo los crea el servidor: entrantes, flujos, agentes y encuestas.
 */
export const TIPOS_PANTALLA = new Set<TipoMsg>(['out', 'note', 'prog', 'ev', 'call'])
/** Íconos de los eventos que deja la pantalla (existen en el sprite de crm.html). */
export const ICONOS_EV = new Set(['tag', 'swap', 'bell', 'check', 'star', 'lock', 'block', 'user', 'users', 'note', 'clock', 'phone', 'flow', 'pen', 'link', 'cart', 'flame', 'pause', 'play'])
const ICONOS_ARCHIVO = new Set(['file', 'play', 'mic', 'link', 'note'])
const ESTADOS_LLAMADA = new Set(['ok', 'perdida', 'nocontesto', 'buzon'])

const malo = (que: string) => new ValidationError(`El mensaje no es válido: ${que}.`)
function texto(v: unknown, que: string, max: number, vacio = true): string {
  if (typeof v !== 'string') throw malo(`«${que}» debe ser texto`)
  const t = v.trim()
  if (!vacio && !t) throw malo(`«${que}» está vacío`)
  if (t.length > max) throw malo(`«${que}» pasa de ${max.toLocaleString('es-CO')} caracteres`)
  return v.length > max ? t : v
}
function textoOpc(v: unknown, que: string, max: number): string | null {
  if (v === undefined || v === null || v === '') return v === '' ? '' : null
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return texto(v, que, max)
}
/** Un número queda número (duración, precio); si no, texto con tope. */
function numOTexto(v: unknown, que: string, max: number): number | string | null {
  if (typeof v === 'number') { if (!Number.isFinite(v) || Math.abs(v) > 1e12) throw malo(`«${que}» no es un número válido`); return v }
  return textoOpc(v, que, max)
}
function urlHttps(v: unknown, que: string, obligatoria: boolean): string | null {
  if (v === undefined || v === null || v === '') { if (obligatoria) throw malo(`falta el enlace de «${que}»`); return v === '' ? '' : null }
  const s = texto(v, que, 2000).trim()
  let u: URL
  try { u = new URL(s) } catch { throw malo(`el enlace de «${que}» no es una dirección web`) }
  if (u.protocol !== 'https:') throw malo(`el enlace de «${que}» debe empezar por https://`)
  return s
}
function objeto(v: unknown, que: string): Json {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw malo(`«${que}» debe ser un objeto`)
  return v as Json
}
/** Quita las claves vacías (null) que dejan los opcionales. */
const sinNulos = (o: Json): Json => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined))

/** Lo que puede llevar un envío (también el que va programado). */
function partesDeEnvio(d: Json, out: Json) {
  if (d.plantilla !== undefined && d.plantilla !== null && d.plantilla !== '') out.plantilla = texto(d.plantilla, 'plantilla', 512, false)
  else if (d.plantilla === null) out.plantilla = null
  if (d.idioma !== undefined && d.idioma !== null && d.idioma !== '') out.idioma = texto(d.idioma, 'idioma', 20, false)
  if (d.vars !== undefined && d.vars !== null) {
    const v = objeto(d.vars, 'vars'), vars: Json = {}
    const claves = Object.keys(v)
    if (claves.length > 30) throw malo('la plantilla trae más de 30 variables')
    for (const k of claves) {
      if (!/^[\w.-]{1,40}$/.test(k)) throw malo(`la variable «${k.slice(0, 40)}» tiene un nombre inválido`)
      const x = textoOpc(v[k], `vars.${k}`, 1000)
      if (x !== null) vars[k] = x
    }
    out.vars = vars
  }
  if (d.link !== undefined && d.link !== null) {
    const l = objeto(d.link, 'link')
    out.link = sinNulos({ p: textoOpc(l.p, 'link.p', 200), m: textoOpc(l.m, 'link.m', 200), pr: numOTexto(l.pr, 'link.pr', 60), d: textoOpc(l.d, 'link.d', 500), url: urlHttps(l.url, 'link', false) })
  }
  if (d.file !== undefined && d.file !== null) {
    const f = objeto(d.file, 'file')
    const ic = textoOpc(f.ic, 'file.ic', 20)
    if (ic && !ICONOS_ARCHIVO.has(ic)) throw malo(`el ícono «${ic}» no existe`)
    out.file = sinNulos({ n: texto(f.n ?? 'archivo', 'file.n', 255, false), t: textoOpc(f.t, 'file.t', 200), ic, url: urlHttps(f.url, 'archivo', true), mime: textoOpc(f.mime, 'file.mime', 100) })
  }
  if (d.audio !== undefined && d.audio !== null) {
    const a = objeto(d.audio, 'audio')
    out.audio = sinNulos({ url: urlHttps(a.url, 'nota de voz', true), dur: numOTexto(a.dur, 'audio.dur', 20), mime: textoOpc(a.mime, 'audio.mime', 100) })
  }
  // El atajo de la respuesta rápida de la que salió (lote 7): el chat lo muestra junto a la hora.
  if (d.rq !== undefined && d.rq !== null) { const rq = textoOpc(d.rq, 'rq', 60); if (rq) out.rq = rq }
}

/**
 * Lista blanca de lo que una persona manda desde la pantalla: solo los tipos
 * de TIPOS_PANTALLA, cada uno con sus claves conocidas y validadas (enlaces
 * https, íconos de la lista, textos con tope). Lo demás se descarta: así nadie
 * mete desde la bandeja una encuesta, un mensaje «del cliente» o menciones.
 * `by` y `quien` los pone el servidor con el nombre del usuario.
 */
export function validarDesdePantalla(crudo: unknown): Json {
  const d = objeto(crudo, 'datos')
  const tipo = tipoDe(d)
  if (!tipo) throw new ValidationError('El mensaje no trae contenido. Escribe un texto, adjunta un archivo o elige una plantilla.')
  if (!TIPOS_PANTALLA.has(tipo)) throw new ValidationError('Desde la bandeja solo se pueden enviar mensajes, notas, mensajes programados y eventos. Lo del cliente, las encuestas y la IA los guarda el servidor.')
  const out: Json = {}
  if (d.cid !== undefined && d.cid !== null && d.cid !== '') {
    const cid = texto(d.cid, 'cid', 64, false)
    if (!/^[\w-]+$/.test(cid)) throw malo('«cid» tiene caracteres inválidos')
    out.cid = cid
  }
  switch (tipo) {
    case 'out':
      out.out = d.out === undefined || d.out === null ? '' : texto(d.out, 'texto', 4096)
      partesDeEnvio(d, out)
      if (d.encuesta !== undefined && d.encuesta !== null) out.encuesta = { asesor: textoOpc(objeto(d.encuesta, 'encuesta').asesor, 'encuesta.asesor', 120) }
      if (!String(out.out).trim() && !out.file && !out.audio && !out.link && !out.plantilla) throw new ValidationError('El mensaje está vacío. Escribe el texto que debe salir.')
      break
    case 'prog':
      out.prog = texto(d.prog, 'prog', 120, false)
      out.out = d.out === undefined || d.out === null ? '' : texto(d.out, 'texto', 4096)
      out.para = texto(d.para, 'para', 40, false)
      if (d.pid !== undefined && d.pid !== null) out.pid = texto(d.pid, 'pid', 40, false)
      partesDeEnvio(d, out)
      // Los archivos de la respuesta rápida que estaban en el cuadro: a la hora salen detrás del texto (soltarProgramado).
      if (d.archivos !== undefined && d.archivos !== null) {
        if (!Array.isArray(d.archivos)) throw malo('«archivos» debe ser una lista')
        if (d.archivos.length > MAX_ARCHIVOS) throw malo(`lleva más de ${MAX_ARCHIVOS} archivos`)
        const archivos = d.archivos.map((x, i) => {
          const a = objeto(x, `archivos.${i + 1}`)
          const peso = typeof a.peso === 'number' && Number.isFinite(a.peso) && a.peso > 0 && a.peso < 1e11 ? Math.round(a.peso) : null
          return sinNulos({ n: texto(a.n ?? 'archivo', 'archivos.n', 255, false), url: urlHttps(a.url, 'archivo', true), mime: textoOpc(a.mime, 'archivos.mime', 100) || null, peso })
        })
        if (archivos.length) out.archivos = archivos
      }
      break
    case 'note':
      out.note = texto(d.note, 'nota', 4000, false)
      break
    case 'ev': {
      const ev = texto(d.ev, 'ev', 20, false)
      if (!ICONOS_EV.has(ev)) throw malo(`el evento «${ev}» no existe`)
      out.ev = ev
      out.t = texto(d.t, 'texto del evento', 500, false)
      if (d.sugTDe !== undefined) out.sugTDe = d.sugTDe === null ? null : texto(d.sugTDe, 'sugTDe', 64, false)
      break
    }
    case 'call': {
      const k = objeto(d.call, 'llamada')
      const estado = texto(k.estado, 'call.estado', 20, false)
      if (!ESTADOS_LLAMADA.has(estado)) throw malo(`el estado de llamada «${estado}» no existe`)
      const dir = k.dir === 'in' ? 'in' : 'out'
      const dur = k.dur === undefined || k.dur === null ? 0 : Number(k.dur)
      if (!Number.isFinite(dur) || dur < 0 || dur > 86_400) throw malo('la duración de la llamada no es válida')
      let trans: [string, string][] | undefined
      if (k.trans !== undefined && k.trans !== null) {
        if (!Array.isArray(k.trans) || k.trans.length > 400) throw malo('la transcripción de la llamada no es válida')
        trans = k.trans.map((x, i) => {
          if (!Array.isArray(x) || x.length !== 2) throw malo(`la línea ${i + 1} de la transcripción no es válida`)
          return [textoOpc(x[0], 'call.trans', 60) ?? '', texto(x[1], 'call.trans', 2000)] as [string, string]
        })
      }
      out.call = sinNulos({ dir, estado, dur: Math.round(dur), linea: textoOpc(k.linea, 'call.linea', 64), audio: urlHttps(k.audio, 'grabación', false) || null, sinGrabar: textoOpc(k.sinGrabar, 'call.sinGrabar', 200), trans })
      break
    }
  }
  return out
}

/** Sin `h` (la hora visible la calcula la pantalla), sin separadores `d` y sin campos del sistema (`_…`). */
export function limpiarDatos(datos: Json): Json {
  const out: Json = {}
  for (const [k, v] of Object.entries(datos)) {
    if (k === 'h' || k === 'd' || k.startsWith('_')) continue
    out[k] = v
  }
  return out
}

const plano = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * Personas del CRM mencionadas con @ en una nota: por nombre completo
 * (`@Sara Duarte`) o por el primer nombre cuando solo una persona se llama así.
 */
async function mencionados(texto: string, autorId: string | null) {
  const usuarios = await usuariosCrm()
  const t = plano(texto)
  const hallados = new Map<string, { id: string; nombre: string }>()
  for (const u of usuarios) if (t.includes('@' + plano(u.nombre))) hallados.set(u.id, u)
  for (const m of t.matchAll(/@([\p{L}]+)/gu)) {
    const primero = m[1]
    const iguales = usuarios.filter(u => plano(u.nombre).split(/\s+/)[0] === primero)
    if (iguales.length === 1) hallados.set(iguales[0].id, iguales[0])
  }
  if (autorId) hallados.delete(autorId)
  return [...hallados.values()]
}

async function avisarMenciones(convId: number, texto: string, autorId: string | null, personas: { id: string; nombre: string }[]) {
  if (!personas.length) return
  const [autor, conv, eqs, usuarios] = await Promise.all([
    nombreDe(autorId),
    prisma.crmConversacion.findUnique({ where: { id: convId }, select: { equipo: true, asignadoId: true, soloLider: true, contacto: { select: { nombre: true, telefono: true } } } }),
    leerEquipos(),
    usuariosCrm(),
  ])
  if (!conv) return
  const quien = conv.contacto.nombre || conv.contacto.telefono || 'un contacto'
  const rolDe = new Map(usuarios.map(u => [u.id, u.rol]))
  for (const p of personas) {
    // Una mención no da acceso (29-sep): la campana solo le suena a quien puede ver la conversación. La nota
    // guarda la mención igual.
    if (!veConv(alcanceDePersona(p.id, rolDe.get(p.id), eqs), conv)) continue
    const pref = await leerPreferencias(p.id)
    if (pref.mencion === false) continue
    await avisar({
      userId: p.id,
      autorId,
      tipo: 'ETIQUETADO',
      titulo: 'Te mencionaron en el CRM',
      texto: `${autor ?? 'Alguien del equipo'} te mencionó en una nota sobre ${quien}: «${texto.slice(0, 140)}${texto.length > 140 ? '…' : ''}»`,
      url: `/?conv=${convId}`,
    })
  }
}

/**
 * Las menciones que no sonaron porque quien las recibió todavía no veía la conversación (una mención no da acceso) y
 * ahora se la asignan: las notas de quien se la asigna, de los últimos 2 minutos. Es el caso de «Transferir» a una
 * persona, que guarda la nota con la mención antes de la asignación (30-sep).
 */
export async function avisarMencionesAlRecibir(convId: number, userId: string, autorId: string) {
  const notas = await prisma.crmMensaje.findMany({
    where: { conversacionId: convId, tipo: 'note', autorId, createdAt: { gte: new Date(Date.now() - 2 * 60_000) } },
    orderBy: { createdAt: 'asc' },
  })
  for (const m of notas) {
    const texto = String(obj(m.datos).note ?? '')
    const p = (await mencionados(texto, autorId)).find(x => x.id === userId)
    if (p) await avisarMenciones(convId, texto, autorId, [p])
  }
}

interface OpcionesGuardar {
  /** Quién lo escribió (userId), o null si lo generó el sistema. */
  autorId: string | null
  /** Quién causó el evento de tiempo real (por defecto, el autor). */
  por?: string | null
  /** Id del texto que presenta este archivo (respuesta rápida): si el texto no sale, este tampoco. */
  tras?: string | null
}

/**
 * Guarda un mensaje en la conversación, lo emite y, si es `out` de WhatsApp,
 * lo envía sin bloquear. Devuelve la fila guardada.
 */
export async function guardarMensaje(convId: number, crudo: Json, op: OpcionesGuardar): Promise<CrmMensaje> {
  const conv = await prisma.crmConversacion.findUnique({ where: { id: convId }, select: { id: true, canal: true, lineaId: true, conexionId: true, contacto: { select: { nombre: true, noContactar: true } } } })
  if (!conv) throw new NotFoundError('Esa conversación ya no existe. Recarga la bandeja.')
  const datosEntrada = obj(crudo)
  const tipo = tipoDe(datosEntrada)
  if (!tipo) throw new ValidationError(`El mensaje no trae contenido. Manda una de estas claves: ${TIPOS_MSG.join(', ')}.`)
  const datos = limpiarDatos(datosEntrada)
  const por = op.por === undefined ? op.autorId : op.por

  // Con «No contactar» no salen plantillas: retomar el contacto es justo lo que pidió no recibir. Responderle sí se puede.
  if (tipo === 'out' && datos.plantilla) {
    const nc = motivoNoContactar(conv.contacto.noContactar)
    if (nc !== null) throw new ValidationError(`${conv.contacto.nombre || 'Este contacto'} pidió no ser contactado${nc ? ` (${nc})` : ''}: no se le pueden enviar plantillas. Si vuelve a escribir, respóndele desde la conversación; si ya lo autorizó, quita «No contactar» en su ficha.`)
  }

  // La firma visible de lo que escribe una persona sale de su usuario, no de lo que mande la pantalla.
  if (op.autorId && (tipo === 'out' || tipo === 'note' || tipo === 'prog')) {
    datos.by = (await nombreDe(op.autorId)) ?? datos.by ?? null
  }
  // Una llamada atendida la atendió quien la registra.
  if (op.autorId && tipo === 'call' && obj(datos.call).estado === 'ok') {
    datos.call = { ...obj(datos.call), quien: (await nombreDe(op.autorId)) ?? obj(datos.call).quien ?? null }
  }

  if (tipo === 'prog') {
    // Programar es contacto que sale después: con «No contactar» no se deja (Ley 1581 y Ley 2300).
    const nc = motivoNoContactar(conv.contacto.noContactar)
    if (nc !== null) throw new ValidationError(`${conv.contacto.nombre || 'Este contacto'} pidió no ser contactado${nc ? ` (${nc})` : ''}: no se le pueden programar mensajes. Si ya lo autorizó, quita «No contactar» en su ficha.`)
    const para = new Date(String(datos.para ?? ''))
    if (!datos.para || Number.isNaN(para.getTime())) throw new ValidationError('Falta la fecha del mensaje programado. Manda «para» con la fecha y hora en formato ISO.')
    if (para.getTime() <= Date.now()) throw new ValidationError('La fecha para programar ya pasó. Elige una fecha y hora futuras.')
    if (!String(datos.out ?? '').trim() && !obj(datos.file).url && !obj(datos.audio).url && !datos.plantilla && !archivosDe(datos.archivos).length) throw new ValidationError('El mensaje programado está vacío. Escribe el texto que debe salir.')
    const m = await prisma.crmMensaje.create({
      data: { conversacionId: convId, tipo, datos: datos as Prisma.InputJsonValue, autorId: op.autorId, programadoPara: para },
    })
    emitirMsg(convId, m, por)
    return m
  }

  let estado: string | null = null
  let error: string | null = null
  if (tipo === 'out') {
    if (!tieneSalida(conv)) { estado = 'fallido'; error = sinSalida(conv.canal) }
    else if (op.tras && await textoNoSalio(op.tras)) { estado = 'fallido'; error = TEXTO_NO_SALIO }
    else estado = 'enviando'
  }

  let personas: { id: string; nombre: string }[] = []
  if (tipo === 'note') {
    personas = await mencionados(String(datos.note ?? ''), op.autorId)
    if (personas.length) datos.menciones = personas.map(p => p.nombre)
  }

  const ahora = new Date()
  const m = await prisma.crmMensaje.create({
    data: { conversacionId: convId, tipo, datos: datos as Prisma.InputJsonValue, autorId: op.autorId, estado, error },
  })

  // La encuesta de satisfacción queda pendiente en la conversación: la respuesta del cliente
  // (dos números) se guarda como csat en entrantes.ts, sin reabrirla.
  if (tipo === 'out' && datos.encuesta && estado !== 'fallido') {
    await prisma.$executeRaw`UPDATE crm_conversaciones SET extra = jsonb_set(COALESCE(extra, '{}'::jsonb), '{_encuesta}', ${JSON.stringify({ en: ahora.toISOString(), asesor: obj(datos.encuesta).asesor ?? null, msgId: m.id })}::jsonb) WHERE id = ${convId}`
  }

  if (tipo === 'out') {
    // Solo lo que de verdad sale deja de contar como espera: un mensaje que nace fallido
    // (sin línea, otro canal) no le respondió nada al cliente. Quien escribe ya leyó lo pendiente.
    await prisma.crmConversacion.update({ where: { id: convId }, data: { ultimoMensajeAt: ahora, noLeidos: 0, ...(estado === 'enviando' ? { esperaDesde: null } : {}) } })
  } else if (MUEVEN_HORA.has(tipo)) {
    await prisma.crmConversacion.update({ where: { id: convId }, data: { ultimoMensajeAt: ahora } })
  }

  emitirMsg(convId, m, por)
  await emitirConv(convId, por)
  if (estado === 'enviando') {
    // Si Meta lo rechaza al instante (ventana de 24 h, plantilla no aprobada…), vuelve a esperar respuesta.
    enviarEnOrden(convId, m.id, op.tras)
      .then(() => restaurarEsperaSiFallo(m.id))
      .catch(e => logger.error(`[CRM] envío ${m.id}: ${(e as Error)?.message ?? e}`))
  }
  if (personas.length) avisarMenciones(convId, String(datos.note ?? ''), op.autorId, personas).catch(e => logger.warn(`[CRM] aviso de mención: ${(e as Error)?.message}`))
  return m
}

/**
 * Convierte un programado vencido en un mensaje de salida y lo manda. La hora
 * del mensaje pasa a ser la de salida, para que quede en su lugar del chat.
 * Si lleva los archivos de una respuesta rápida (`archivos`), cada uno sale
 * detrás del texto como su propio mensaje, en orden, y solo si el texto salió.
 */
export async function soltarProgramado(msgId: string): Promise<void> {
  // Se reclama con una actualización condicional: si otro proceso ya lo tomó, no se manda dos veces.
  const m = await prisma.crmMensaje.findUnique({
    where: { id: msgId },
    include: { conversacion: { select: { canal: true, lineaId: true, conexionId: true, esperaDesde: true, ultimoEntranteAt: true, contacto: { select: { nombre: true, noContactar: true, rne: true, autorizacion: true } } } } },
  })
  if (!m || m.tipo !== 'prog') return
  const original = obj(m.datos)
  const datos = { ...original }
  delete datos.prog
  delete datos.para
  delete datos.pid
  const archivos = archivosDe(datos.archivos)
  delete datos.archivos
  if (!String(datos.out ?? '').trim() && !obj(datos.file).url && !obj(datos.audio).url && !datos.plantilla) {
    // Sin texto, el primer archivo va adelante y los demás detrás de él.
    if (archivos.length) Object.assign(datos, mensajeDeArchivo(archivos.shift()!))
    else datos.out = '(mensaje programado vacío)'
  }
  const c = m.conversacion
  const k = c.contacto
  let estado: 'enviando' | 'fallido' = 'enviando'
  let error: string | null = null
  const nc = motivoNoContactar(k.noContactar)
  if (nc !== null) {
    // Se marcó «No contactar» después de programarlo: no sale.
    estado = 'fallido'
    error = `No salió: ${k.nombre || 'el contacto'} pidió no ser contactado${nc ? ` (${nc})` : ''}. Si ya lo autorizó, quita «No contactar» en su ficha y vuelve a enviarlo.`
  } else if (!tieneSalida(c)) {
    estado = 'fallido'
    error = sinSalida(c.canal)
  } else if (!clienteEsperando(c)) {
    // No responde a algo que el cliente acaba de escribir: es contacto que inicia la empresa (Ley 2300 y RNE).
    const pd = obj(await leerAjuste('pd'))
    if (pd.rneOn !== false && marcado(k.rne) && !marcado(k.autorizacion)) {
      estado = 'fallido'
      error = 'No salió: el número está en el Registro de Números Excluidos y no hay autorización del titular para escribirle.'
    } else {
      const { horarioLegal } = await import('./reglas')
      const legal = horarioLegal()
      if (!legal.ok) {
        // Fuera de la franja legal: se corre a la próxima apertura y lo vuelve a tomar procesarProgramados.
        const abre = legal.abre ?? new Date(Date.now() + 86_400_000)
        const r = await prisma.crmMensaje.updateMany({
          where: { id: msgId, tipo: 'prog' },
          data: { programadoPara: abre, datos: { ...original, para: abre.toISOString() } as Prisma.InputJsonValue },
        })
        if (!r.count) return
        const f = await prisma.crmMensaje.findUnique({ where: { id: msgId } })
        if (f) emitirMsg(m.conversacionId, f, null)
        const ev = await prisma.crmMensaje.create({
          data: { conversacionId: m.conversacionId, tipo: 'ev', datos: { ev: 'clock', t: `El mensaje programado sale ${legal.sigue}: la Ley 2300 no deja escribirle ahora por iniciativa de la empresa (${legal.motivo})` } },
        })
        emitirMsg(m.conversacionId, ev, null)
        return
      }
    }
  }
  // Nunca antes que lo último de la conversación: si otro programado de la misma hora acaba de soltar
  // sus archivos (un milisegundo cada uno), este queda después de ellos también en el chat.
  const ultimo = await prisma.crmMensaje.findFirst({ where: { conversacionId: m.conversacionId, tipo: { not: 'prog' } }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } })
  const ahora = new Date(Math.max(Date.now(), (ultimo?.createdAt.getTime() ?? 0) + 1))
  // El texto pasa a out y sus archivos se crean en una sola transacción: si la base falla a medias, el programado
  // sigue siendo prog con todos sus archivos y el proceso del minuto siguiente lo vuelve a intentar.
  const detras = await prisma.$transaction(async tx => {
    const r = await tx.crmMensaje.updateMany({
      where: { id: msgId, tipo: 'prog' },
      data: { tipo: 'out', datos: { ...datos, programado: true } as Prisma.InputJsonValue, estado, error, programadoPara: null, createdAt: ahora },
    })
    if (!r.count) return null
    // Detrás del texto, sus archivos, un milisegundo después cada uno para que el chat los ordene igual.
    // Si el texto ya no sale (No contactar, sin línea, RNE), ellos tampoco.
    const creados: CrmMensaje[] = []
    for (const [i, a] of archivos.entries()) {
      creados.push(await tx.crmMensaje.create({
        data: {
          conversacionId: m.conversacionId, tipo: 'out', autorId: m.autorId, createdAt: new Date(ahora.getTime() + i + 1),
          datos: { ...mensajeDeArchivo(a), ...(datos.by ? { by: datos.by } : {}), programado: true } as Prisma.InputJsonValue,
          estado, error: estado === 'fallido' ? TEXTO_NO_SALIO : null,
        },
      }))
    }
    // Como en guardarMensaje: solo lo que de verdad sale deja de contar como espera.
    await tx.crmConversacion.update({ where: { id: m.conversacionId }, data: { ultimoMensajeAt: ahora, ...(estado === 'enviando' ? { esperaDesde: null } : {}) } })
    return creados
  })
  if (!detras) return
  const f = await prisma.crmMensaje.findUnique({ where: { id: msgId } })
  if (f) emitirMsg(m.conversacionId, f, null)
  for (const x of detras) emitirMsg(m.conversacionId, x, null)
  await emitirConv(m.conversacionId, null)
  const envioArchivos: Promise<unknown>[] = []
  if (estado === 'enviando') {
    const envio = enviarEnOrden(m.conversacionId, msgId)
    // Los archivos entran a la cola de la conversación ya, detrás del texto: el programado siguiente
    // (procesarProgramados va en orden) sale después de ellos aunque no se esperen aquí.
    for (const x of detras) {
      envioArchivos.push(enviarEnOrden(m.conversacionId, x.id, msgId)
        .then(() => restaurarEsperaSiFallo(x.id))
        .catch(e => logger.error(`[CRM] envío ${x.id} del programado ${msgId}: ${(e as Error)?.message ?? e}`)))
    }
    await envio
    await restaurarEsperaSiFallo(msgId)
  }
  // Quien lo programó no está mirando la conversación: si no salió, se entera en la campana.
  const fin = await prisma.crmMensaje.findUnique({ where: { id: msgId }, select: { estado: true, error: true, autorId: true } })
  if (fin?.estado === 'fallido' && fin.autorId) {
    await avisar({
      userId: fin.autorId, tipo: 'CAMBIOS_PEDIDOS', titulo: 'Un mensaje programado no salió',
      texto: `El mensaje programado para ${k.nombre || 'un contacto'} no salió: ${String(fin.error || 'sin detalle').replace(/^(no sali[oó]|no se pudo enviar):\s*/i, '').replace(/[.\s]+$/, '')}.`,
      url: `/?conv=${m.conversacionId}`,
    }).catch(e => logger.warn(`[CRM] aviso de programado ${msgId}: ${(e as Error)?.message ?? e}`))
  } else if (fin && fin.autorId && envioArchivos.length) {
    // El texto salió: si después falla alguno de sus archivos (Meta no lo recibe, la Nube no lo entrega), también
    // se entera en la campana. Se espera sin frenar el proceso de cada minuto, que no sube los archivos.
    const autorId = fin.autorId
    void Promise.allSettled(envioArchivos).then(async () => {
      const malos = await prisma.crmMensaje.findMany({ where: { id: { in: detras.map(x => x.id) }, estado: 'fallido' }, select: { datos: true, error: true }, orderBy: { createdAt: 'asc' } })
      if (!malos.length) return
      const nombre = String(obj(obj(malos[0].datos).file).n || 'archivo')
      const motivo = String(malos[0].error || 'sin detalle').replace(/^(no sali[oó]|no se pudo enviar):\s*/i, '').replace(/[.\s]+$/, '')
      await avisar({
        userId: autorId, tipo: 'CAMBIOS_PEDIDOS', titulo: malos.length === 1 ? 'Un archivo del mensaje programado no salió' : 'Archivos del mensaje programado no salieron',
        texto: `El mensaje programado para ${k.nombre || 'un contacto'} salió, pero ${malos.length === 1 ? `el archivo «${nombre}» no salió` : `${malos.length} de sus archivos no salieron («${nombre}» y ${malos.length - 1 === 1 ? 'otro' : `${malos.length - 1} más`})`}: ${motivo}.`,
        url: `/?conv=${m.conversacionId}`,
      })
    }).catch(e => logger.warn(`[CRM] aviso de archivos del programado ${msgId}: ${(e as Error)?.message ?? e}`))
  }
}

// ─── Envíos que fallan ───────────────────────────────────────────────────────

const VEINTICUATRO_H = 24 * 3_600_000
const marcado = (v: unknown) => v !== null && v !== undefined && v !== false && v !== ''

/** null si el contacto se puede contactar; si no, el motivo guardado ('' si no hay). */
export function motivoNoContactar(v: unknown): string | null {
  if (!marcado(v)) return null
  return typeof v === 'string' ? v : typeof obj(v).motivo === 'string' ? String(obj(v).motivo) : ''
}

/** ¿El cliente escribió hace menos de 24 h y espera respuesta? (igual que esRespuesta de reglas.ts). */
function clienteEsperando(c: { esperaDesde: Date | null; ultimoEntranteAt: Date | null }): boolean {
  const ent = c.ultimoEntranteAt?.getTime() ?? 0
  return !!c.esperaDesde && ent > 0 && Date.now() - ent < VEINTICUATRO_H
}

/**
 * Un mensaje de una persona que no llegó al cliente no es una respuesta: si
 * quedó `fallido`, la conversación vuelve a esperar desde el primer mensaje
 * del cliente que nadie contestó (el que no cuenta es este, ni otros fallidos,
 * ni los de una difusión). No hace nada si alguien respondió bien después o si
 * la conversación está finalizada. Lo llaman guardarMensaje y soltarProgramado
 * cuando el envío falla al instante; entrantes.ts debe llamarlo cuando Meta
 * avisa `failed`, y marcarEnviosColgados cuando un envío se queda a medias.
 */
export async function restaurarEsperaSiFallo(msgId: string): Promise<boolean> {
  const m = await prisma.crmMensaje.findUnique({ where: { id: msgId }, select: { conversacionId: true, tipo: true, estado: true, autorId: true, createdAt: true, datos: true } })
  // Solo lo que escribió una persona: lo automático y las difusiones nunca contaron como respuesta.
  if (!m || m.tipo !== 'out' || m.estado !== 'fallido' || !m.autorId || obj(m.datos).difusion) return false
  const convId = m.conversacionId
  const [fila] = await prisma.$queryRaw<{ desde: Date | null; despues: number }[]>`
    SELECT
      (SELECT min(i."createdAt") FROM crm_mensajes i
        WHERE i.conversacion_id = ${convId} AND i.tipo = 'in'
          AND i."createdAt" > COALESCE((
            SELECT max(o."createdAt") FROM crm_mensajes o
             WHERE o.conversacion_id = ${convId} AND o.tipo = 'out' AND o.autor_id IS NOT NULL
               AND o.estado IS DISTINCT FROM 'fallido' AND NOT (o.datos ? 'difusion')
               AND o."createdAt" < ${m.createdAt}), 'epoch'::timestamp)) AS desde,
      (SELECT count(*)::int FROM crm_mensajes o
        WHERE o.conversacion_id = ${convId} AND o.tipo = 'out' AND o.autor_id IS NOT NULL
          AND o.estado IS DISTINCT FROM 'fallido' AND NOT (o.datos ? 'difusion')
          AND o."createdAt" > ${m.createdAt}) AS despues`
  if (!fila?.desde || fila.despues > 0) return false
  const desde = new Date(fila.desde)
  // Se deja la espera más antigua (si mientras tanto el cliente volvió a escribir, cuenta desde antes).
  const r = await prisma.crmConversacion.updateMany({
    where: { id: convId, estado: { not: 'finalizadas' }, OR: [{ esperaDesde: null }, { esperaDesde: { gt: desde } }] },
    data: { esperaDesde: desde },
  })
  if (!r.count) return false
  await emitirConv(convId, null)
  return true
}

export const ENVIO_COLGADO = 'No se confirmó el envío: el servidor se reinició mientras salía. Revisa la conversación y vuelve a enviarlo si hace falta.'

/**
 * Mensajes que quedaron en `enviando` sin id de WhatsApp (el servidor se
 * reinició a mitad del envío): pasan a `fallido` con el porqué. No se
 * reintentan solos porque no se sabe si Meta alcanzó a recibirlos.
 * Debe correr cada minuto (procesos.ts, cadaMinuto).
 */
export async function marcarEnviosColgados(minutos = 5): Promise<number> {
  const limite = new Date(Date.now() - minutos * 60_000)
  const colgados = await prisma.crmMensaje.findMany({
    where: { tipo: 'out', estado: 'enviando', waId: null, createdAt: { lt: limite } },
    select: { id: true, conversacionId: true }, orderBy: { createdAt: 'asc' }, take: 200,
  })
  let n = 0
  for (const x of colgados) {
    const r = await prisma.crmMensaje.updateMany({ where: { id: x.id, estado: 'enviando', waId: null }, data: { estado: 'fallido', error: ENVIO_COLGADO } })
    if (!r.count) continue
    n++
    const f = await prisma.crmMensaje.findUnique({ where: { id: x.id } })
    if (f) emitirMsg(x.conversacionId, f, null)
    await restaurarEsperaSiFallo(x.id)
  }
  return n
}
