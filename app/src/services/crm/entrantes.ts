import { v2 as cloudinary } from 'cloudinary'
import { Prisma, type CrmConexion, type CrmLinea, type CrmContacto } from '@prisma/client'
import { prisma, prismaGlobal } from './bd'
import { enEspacio } from './espacio'
import { credDeLinea, type CredMeta } from './credenciales'
import { pautaPorCodigo } from './enlaces'
import { logger } from '../../utils/logger'
import { avisarLideres, primeraVez } from './avisosCrm'
import { telDigitos, telVisible, lineaAFront } from './formas'
import { leerAjuste } from './ajustes'
import { emitirCrm, emitirConv, emitirMsg } from './tiempoReal'
import { repartir } from './reparto'
import { alEntrarMensaje } from './automatizaciones'
import { autorizacionPorRespuesta } from './autorizacion'
import { festivosCO } from './reglas'
import { enviarEnOrden, guardarMensaje, restaurarEsperaSiFallo } from './salientes'
import { olvidarPlantillas } from './plantillas'
import { baseGraph, descargarMedia, explicarErrorMeta, graph, calidadTexto, limiteTexto } from './whatsapp'
import { perfilDe, tokenDePagina } from './paginas'
import { bajarDeTelegram, contestarBoton } from './telegram'
import { bajarDeTiktok } from './tiktok'
import { encuestaNoLlego, respuestaFormulario } from './encuesta'

/**
 * Lo que llega por el webhook de WhatsApp Cloud API del CRM (26-sep-2026):
 * mensajes de los clientes, estados de lo que se envió y cambios de las
 * plantillas. Formas de los mensajes en docs/crm/CONTRATO-CRM.md §3.
 */

type Json = Record<string, any>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})
const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
/** Lo que escribió el cliente (o el título del botón o la fila que tocó), para flujos, agentes y reglas. */
function textoDe(d: Json): string {
  if (typeof d.in === 'string') return d.in
  const o = obj(d.in)
  return txt(o.cap) || txt(o.trans) || ''
}
const json = (v: unknown) => v as Prisma.InputJsonValue

interface WaMedia { id?: string; mime_type?: string; caption?: string; filename?: string; voice?: boolean }
export interface WaMensaje {
  id: string; from: string; timestamp?: string; type: string
  text?: { body?: string }
  image?: WaMedia; audio?: WaMedia; video?: WaMedia; document?: WaMedia; sticker?: WaMedia
  location?: { latitude?: number; longitude?: number; name?: string; address?: string }
  button?: { text?: string; payload?: string }
  interactive?: {
    type?: string; button_reply?: { id?: string; title?: string }; list_reply?: { id?: string; title?: string }
    /** Respuesta de un formulario de WhatsApp (Flows): `response_json` trae el flow_token y lo que llenó (encuesta.ts). */
    nfm_reply?: { name?: string; body?: string; response_json?: string }
  }
  /** El mensaje al que responde (en un nfm_reply, el que abrió el formulario). */
  context?: { from?: string; id?: string }
  contacts?: { name?: { formatted_name?: string; first_name?: string }; phones?: { phone?: string; wa_id?: string }[] }[]
  referral?: { source_url?: string; source_id?: string; source_type?: string; headline?: string; body?: string; media_type?: string; ctwa_clid?: string }
}
export interface WaContacto { wa_id?: string; profile?: { name?: string } }

// ─── Fila por contacto ───────────────────────────────────────────────────────
// Los mensajes de una misma persona se procesan en orden y de a uno: así no
// se crean dos conversaciones si Meta manda dos webhooks casi al mismo tiempo.
const colas = new Map<string, Promise<unknown>>()
function enFila<T>(clave: string, fn: () => Promise<T>): Promise<T> {
  const antes = colas.get(clave) ?? Promise.resolve()
  const p = antes.catch(() => undefined).then(fn)
  const fin = p.catch(() => undefined)
  colas.set(clave, fin)
  void fin.then(() => { if (colas.get(clave) === fin) colas.delete(clave) })
  return p
}

// ─── Archivos: de Meta a Cloudinary ──────────────────────────────────────────

function subir(buffer: Buffer, opciones: Record<string, unknown>): Promise<string> {
  if (!cloudinary.config().cloud_name) {
    cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET })
  }
  return new Promise((resolve, reject) => {
    const st = cloudinary.uploader.upload_stream(opciones, (err, r) => (err || !r ? reject(err ?? new Error('Cloudinary no respondió')) : resolve(r.secure_url)))
    st.end(buffer)
  })
}

const EXT: Record<string, string> = {
  'application/pdf': 'pdf', 'application/msword': 'doc', 'application/vnd.ms-excel': 'xls', 'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt', 'text/csv': 'csv', 'application/zip': 'zip',
}

type ClaseMedia = 'image' | 'audio' | 'video' | 'document' | 'sticker'

/** Baja el archivo de Meta y lo guarda en Cloudinary (carpeta CLOUDINARY_CARPETA). */
async function guardarMedia(media: WaMedia, clase: ClaseMedia, cred: CredMeta) {
  if (!media.id) throw new Error('El mensaje no trae el archivo')
  const { buffer, mime } = await descargarMedia(media.id, cred)
  const sello = String(media.id).replace(/\W/g, '').slice(-12) || Date.now().toString(36)
  return { url: await subirMedia(buffer, mime, clase, `wa-${sello}`, txt(media.filename)), mime, buffer }
}

/** Guarda en Cloudinary un archivo que mandó el cliente. PDF como raw sin extensión: la cuenta bloquea los .pdf. */
async function subirMedia(buffer: Buffer, mime: string, clase: ClaseMedia, id: string, nombre: string): Promise<string> {
  const folder = process.env.CLOUDINARY_CARPETA || 'crm'
  let url: string
  if (clase === 'image' || clase === 'sticker' || (clase === 'document' && mime.startsWith('image/'))) {
    url = await subir(buffer, { folder, resource_type: 'image', public_id: id })
  } else if (clase === 'audio' || clase === 'video') {
    url = await subir(buffer, { folder, resource_type: 'video', public_id: id })
  } else {
    const base = nombre.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 40) || 'documento'
    const ext = (nombre.match(/\.([a-z0-9]{1,5})$/i)?.[1] ?? EXT[mime] ?? '').toLowerCase()
    const esPdf = mime === 'application/pdf' || ext === 'pdf'
    url = await subir(buffer, { folder, resource_type: 'raw', public_id: `${base}-${id.slice(-12)}${esPdf || !ext ? '' : '.' + ext}` })
  }
  return url
}

const NOMBRE_MEDIA: Record<string, string> = { image: 'una imagen', audio: 'una nota de voz', video: 'un video', document: 'un documento', sticker: 'un sticker' }

/** El mensaje del cliente con la forma de la maqueta (contrato §3). */
async function armarDatos(m: WaMensaje, linea: CrmLinea): Promise<Json> {
  const t = m.type
  if (t === 'text') return { in: m.text?.body ?? '' }
  if (t === 'image' || t === 'audio' || t === 'video' || t === 'document' || t === 'sticker') {
    const media: WaMedia = m[t] ?? {}
    const cap = txt(media.caption)
    try {
      const g = await guardarMedia(media, t, await credDeLinea(linea))
      if (t === 'image') return { in: { img: g.url, ...(cap ? { cap } : {}) } }
      if (t === 'sticker') return { in: { img: g.url, sticker: true } }
      if (t === 'video') return { in: { video: g.url, ...(cap ? { cap } : {}) } }
      if (t === 'document') return { in: { doc: g.url, n: txt(media.filename) || 'Documento', ...(cap ? { cap } : {}) } }
      // La transcripción ya no es automática: se saca cuando alguien la pide o el agente IA la necesita (transcripciones.ts).
      return { in: { audio: '', url: g.url } }
    } catch (e) {
      // Se guarda igual, con el id de Meta para reintentar (Meta lo conserva 30 días).
      logger.warn(`[CRM WA] no se pudo guardar ${t} ${media.id ?? ''}: ${(e as Error).message}`)
      return { in: `Llegó ${NOMBRE_MEDIA[t]} que no se pudo guardar: ${(e as Error).message}${cap ? `\n${cap}` : ''}`, mediaId: media.id ?? null, mediaTipo: t }
    }
  }
  if (t === 'location') {
    const l = m.location ?? {}
    const partes = [txt(l.name), txt(l.address), `https://maps.google.com/?q=${l.latitude},${l.longitude}`].filter(Boolean)
    return { in: `📍 ${partes.join(' ')}` }
  }
  if (t === 'button') return { in: txt(m.button?.text) || txt(m.button?.payload), resp: { id: m.button?.payload ?? null } }
  if (t === 'interactive') {
    const r = m.interactive?.button_reply ?? m.interactive?.list_reply
    if (r) return { in: txt(r.title), resp: { id: r.id ?? null } }
  }
  if (t === 'contacts') {
    const lineas = (m.contacts ?? []).map(c => {
      const tel = c.phones?.[0]?.wa_id || c.phones?.[0]?.phone
      const n = txt(c.name?.formatted_name) || txt(c.name?.first_name) || 'Sin nombre'
      return `Contacto: ${n}${tel ? ' ' + (telVisible(telDigitos(tel)) || tel) : ''}`
    })
    if (lineas.length) return { in: lineas.join('\n') }
  }
  return { in: t === 'unsupported' ? NO_LLEGA : 'Mensaje de un tipo que el CRM todavía no muestra', tipoWa: t }
}

/**
 * Lo que WhatsApp no le pasa a ningún sistema (6-oct): fotos y videos de «ver una vez», encuestas, ubicación en vivo y
 * tipos nuevos. Meta solo avisa que llegó algo («unsupported»): el chat dice qué pudo ser y qué pedirle a la persona.
 */
export const NO_LLEGA = 'La persona mandó algo que WhatsApp solo deja ver en el celular: una foto o un video de «ver una vez», una encuesta, su ubicación en tiempo real o un mensaje de un tipo nuevo. Pídele que lo mande de otra forma: la foto o el video normal, la ubicación fija o la respuesta escrita.'

// ─── Contacto y conversación ─────────────────────────────────────────────────

const fechaCorta = (d: Date) => {
  const b = new Date(d.getTime() - 5 * 3600_000)
  return `${b.getUTCDate()}-${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][b.getUTCMonth()]}`
}

function pautaDe(r: NonNullable<WaMensaje['referral']>) {
  return {
    plataforma: 'Meta', anuncio: txt(r.headline) || txt(r.body) || 'Anuncio sin título', como: 'Clic en anuncio', url: txt(r.source_url) || null,
    tipo: r.source_type === 'post' ? 'Publicación' : 'Anuncio', idAnuncio: r.source_id ?? null, formato: r.media_type ?? null,
    texto: txt(r.body) || null, ctwa: r.ctwa_clid ?? null,
  }
}

async function contactoDe(tel: string, nombre: string, referral: WaMensaje['referral']): Promise<CrmContacto> {
  const pauta = referral ? pautaDe(referral) : null
  let k = await prisma.crmContacto.findFirst({ where: { telefono: tel } })
  if (!k) {
    try {
      return await prisma.crmContacto.create({
        data: {
          nombre: nombre || null, telefono: tel, canal: 'wa',
          ficha: json({ origen: pauta ? 'Anuncio de Meta' : 'WhatsApp' }),
          ...(pauta ? { pauta: json(pauta) } : {}),
        },
      })
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e
      k = await prisma.crmContacto.findFirst({ where: { telefono: tel } })
      if (!k) throw e
    }
  }
  const cambios: Prisma.CrmContactoUpdateInput = {}
  if (!k.nombre && nombre) cambios.nombre = nombre
  if (pauta) {
    // Volvió por un anuncio: queda la pauta nueva y el origen anterior pasa a «previas».
    const ficha = obj(k.ficha)
    const previas = Array.isArray(ficha.previas) ? [...ficha.previas] : []
    if (ficha.origen && ficha.origen !== 'Anuncio de Meta') previas.push([ficha.origen, fechaCorta(k.createdAt)])
    cambios.pauta = json(pauta)
    cambios.ficha = json({ ...ficha, origen: 'Anuncio de Meta', previas })
  }
  if (Object.keys(cambios).length) k = await prisma.crmContacto.update({ where: { id: k.id }, data: cambios })
  return k
}

const CVCFG_DEFECTO = { mismo: true, diasMismo: '30' }

/** Conversaciones del chat de la web que abrió un navegador (`extra.webVisitante`, chatWeb.ts). */
export const deVisitante = (visitante: string): Prisma.CrmConversacionWhereInput => ({ canal: 'web', extra: { path: ['webVisitante'], equals: visitante } })

/** Por dónde entra: una línea de WhatsApp, el navegador del chat de la web o una página de Facebook (Messenger o Instagram). */
type Lugar = { linea: CrmLinea } | { visitante: string } | { pagina: CrmConexion; canal: 'fb' | 'ig' | 'tg' | 'tt' | 'mail' }

/** La clave de cada canal por conexión en los ajustes del CRM (cfg.telegram, cfg.tiktok, cfg.correo). */
const CLAVE_CFG: Record<string, string> = { tg: 'telegram', tt: 'tiktok', mail: 'correo' }

/** «Equipo que los atiende» de cada canal por conexión (Ajustes del CRM, página de cada canal). */
export function equipoDeCanal(cfg: Json, canal: string): string {
  if (canal === 'fb' || canal === 'ig') return txt(obj(cfg.meta)[`${canal}Eq`]) || 'Ventas'
  return txt(obj(cfg[CLAVE_CFG[canal] ?? canal]).eq) || 'Ventas'
}
/** «Recibir sus mensajes» de cada canal por conexión: encendido si no se apagó. */
export function canalEncendido(cfg: Json, canal: string): boolean {
  if (canal === 'fb' || canal === 'ig') return obj(cfg.meta)[canal] !== false
  return obj(cfg[CLAVE_CFG[canal] ?? canal]).on !== false
}
const dondeDe = (l: Lugar): Prisma.CrmConversacionWhereInput =>
  'linea' in l ? { lineaId: l.linea.id } : 'pagina' in l ? { conexionId: l.pagina.id, canal: l.canal } : deVisitante(l.visitante)

/** La conversación del contacto en esa línea, en ese navegador del chat de la web o en esa página. */
async function conversacionPara(k: CrmContacto, lugar: Lugar, cuando: Date) {
  const donde = dondeDe(lugar)
  const ultima = await prisma.crmConversacion.findFirst({ where: { contactoId: k.id, ...donde }, orderBy: { createdAt: 'desc' } })
  if (ultima && ultima.estado !== 'finalizadas') return { conv: ultima, nueva: false, reabierta: null, vuelveDe: null as number | null }
  // Lote 6b: escribe a una conversación finalizada (se reabra o empiece otra): «La persona vuelve a escribir después de finalizar».
  const vuelveDe = ultima ? ultima.id : null
  if (ultima) {
    const cv = { ...CVCFG_DEFECTO, ...obj(await leerAjuste('cvcfg')) }
    const dias = Number(String(cv.diasMismo ?? '').replace(/\D/g, '')) || 0
    const fin = ultima.finalizadaAt?.getTime() ?? 0
    if (cv.mismo && dias > 0 && fin && cuando.getTime() - fin < dias * 86_400_000) {
      const conv = await prisma.crmConversacion.update({ where: { id: ultima.id }, data: { estado: 'abiertas', finalizadaAt: null, motivoFin: null } })
      const ev = await prisma.crmMensaje.create({
        data: { conversacionId: conv.id, tipo: 'ev', datos: json({ ev: 'swap', t: 'Se reabrió porque el cliente volvió a escribir' }), createdAt: new Date(cuando.getTime() - 1) },
      })
      return { conv, nueva: false, reabierta: ev, vuelveDe }
    }
  }
  const cfg = obj(await leerAjuste('cfg'))
  if ('visitante' in lugar) {
    const conv = await prisma.crmConversacion.create({
      data: { contactoId: k.id, canal: 'web', lineaId: null, equipo: txt(obj(cfg.web).eq) || 'Ventas', estado: 'abiertas', extra: json({ webVisitante: lugar.visitante }) },
    })
    return { conv, nueva: true, reabierta: null, vuelveDe }
  }
  if ('pagina' in lugar) {
    // «Equipo que los atiende» en la página de ajustes de cada canal.
    const conv = await prisma.crmConversacion.create({
      data: { contactoId: k.id, canal: lugar.canal, conexionId: lugar.pagina.id, equipo: equipoDeCanal(cfg, lugar.canal), estado: 'abiertas' },
    })
    return { conv, nueva: true, reabierta: null, vuelveDe }
  }
  const linea = lugar.linea
  const eq = (Array.isArray(cfg.lineas) ? cfg.lineas : []).find((l: Json) => l?.id === linea.id)?.eq
  const conv = await prisma.crmConversacion.create({
    data: { contactoId: k.id, canal: 'wa', lineaId: linea.id, equipo: txt(eq) || txt(obj(linea.ajustes).equipo) || 'Ventas', estado: 'abiertas' },
  })
  return { conv, nueva: true, reabierta: null, vuelveDe }
}

// ─── Fuera de horario ────────────────────────────────────────────────────────

const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado']
const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Colombia no cambia de hora: UTC-5 fijo. */
function ahoraBogota(d = new Date()) {
  const b = new Date(d.getTime() - 5 * 3600_000)
  return {
    dia: b.getUTCDay(),
    min: b.getUTCHours() * 60 + b.getUTCMinutes(),
    inicioDia: new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate(), 5)),
  }
}

/** '7:00', '22:00', '7 a. m.', '10:30 p. m.' → minutos del día (null si no se entiende). */
function minutos(t: unknown): number | null {
  const m = String(t ?? '').toLowerCase().match(/(\d{1,2})(?:[:.](\d{2}))?\s*(a|p)?\.?\s*(?:m\.?)?/)
  if (!m) return null
  let h = Number(m[1]); const mm = Number(m[2] ?? 0)
  if (m[3] === 'p' && h < 12) h += 12
  if (m[3] === 'a' && h === 12) h = 0
  if (h > 24 || mm > 59) return null
  return h * 60 + mm
}

/** ¿Está dentro del horario de atención? Si el horario no se entiende, se da por dentro (no se manda nada). */
export function dentroDeHorario(horario: unknown[], d = new Date(), festivosComoDomingo = false): boolean {
  const a = ahoraBogota(d)
  // «Festivos de Colombia como domingo» (Ajustes, Horario): un festivo usa la fila del domingo.
  const hoy = new Date(d.getTime() - 5 * 3600_000).toISOString().slice(0, 10)
  const dia = festivosComoDomingo && festivosCO(Number(hoy.slice(0, 4))).includes(hoy) ? 0 : a.dia
  const filas = horario.filter(Array.isArray) as unknown[][]
  const fila = filas.find(f => sinTildes(String(f[0] ?? '')).startsWith(DIAS[dia])) ?? filas[(dia + 6) % 7]
  if (!fila) return true
  if (fila[3] === false) return false
  const desde = minutos(fila[1]), hasta = minutos(fila[2])
  if (desde === null || hasta === null) return true
  return desde <= hasta ? a.min >= desde && a.min < hasta : a.min >= desde || a.min < hasta
}

/** Fuera de horario: una sola vez por conversación y por día, el mensaje de cfg.fuera. */
async function avisoFueraDeHorario(convId: number) {
  const cfg = await leerAjuste<Json>('cfg')
  const texto = txt(cfg?.fuera)
  if (!cfg || !texto || !Array.isArray(cfg.horario) || dentroDeHorario(cfg.horario, new Date(), cfg.festivos !== false)) return
  const ya = await prisma.crmMensaje.findFirst({
    where: { conversacionId: convId, tipo: 'bot', createdAt: { gte: ahoraBogota().inicioDia }, datos: { path: ['fuera'], equals: true } },
    select: { id: true },
  })
  if (ya) return
  const m = await prisma.crmMensaje.create({ data: { conversacionId: convId, tipo: 'bot', datos: json({ bot: texto, fuera: true }), estado: 'enviando' } })
  await prisma.crmConversacion.update({ where: { id: convId }, data: { ultimoMensajeAt: m.createdAt } })
  emitirMsg(convId, m)
  // Por la cola de la conversación (salientes.ts), sin esperarla: si una regla acaba de mandar una respuesta rápida con
  // archivos, el aviso sale después de ellos y no en medio del texto y sus archivos (29-sep).
  enviarEnOrden(convId, m.id).catch(e => logger.error(`[CRM] aviso fuera de horario ${m.id}: ${(e as Error)?.message ?? e}`))
  await emitirConv(convId)
}

// ─── Encuesta de satisfacción ────────────────────────────────────────────────
// La encuesta pide la atención (1 a 5) y la recomendación (0 a 10). Si en los 3
// días siguientes el cliente responde algo corto con esos números, se guarda
// como {csat} y la conversación no se reabre. Si escribe otra cosa, sigue como
// un mensaje normal.

const TRES_DIAS = 3 * 86_400_000

export function leerEncuesta(texto: string): { aten: number | null; nps: number | null; com: string } | null {
  // Solo respuestas cortas y sin preguntas: «quiero pagar la cuota 2 de 3…» no es una encuesta.
  const t = texto.trim()
  if (!t || t.length > 120 || t.includes('?')) return null
  // Sin los números de la lista («1. 4», «2) 9»): solo cuentan las respuestas.
  const sinLista = t.split(/\n/).map(l => l.replace(/^\s*[12]\s*[.)-]\s+/, '')).join(' ')
  const NUM = /(?<!\d|\d[.,])(10|\d)(?!\d|[.,]\d)/g
  const nums = [...sinLista.matchAll(NUM)].map(x => Number(x[1]))
  if (!nums.length || nums.length > 3) return null
  let aten: number | null = null, nps: number | null = null
  if (nums.length >= 2) { aten = nums[0] >= 1 && nums[0] <= 5 ? nums[0] : null; nps = nums[1] }
  else if (nums[0] >= 1 && nums[0] <= 5) aten = nums[0]
  else nps = nums[0]
  if (aten === null && nps === null) return null
  const com = sinLista.replace(NUM, ' ').replace(/^[\s.,;:-]*(y\s+)?|[\s.,;:-]+$/gi, '').replace(/\s+/g, ' ').trim()
  return { aten, nps, com: /[a-záéíóúñ]{3,}/i.test(com) ? com.slice(0, 280) : '' }
}

async function respuestaEncuesta(contactoId: number, donde: Prisma.CrmConversacionWhereInput, waId: string | null, datos: Json, cuando: Date): Promise<boolean> {
  if (typeof datos.in !== 'string') return false
  const conv = await prisma.crmConversacion.findFirst({ where: { contactoId, ...donde }, orderBy: { createdAt: 'desc' } })
  const enc = obj(obj(conv?.extra)._encuesta)
  if (!conv || !enc.en || enc.respondida) return false
  if (cuando.getTime() - new Date(String(enc.en)).getTime() > TRES_DIAS) return false
  const r = leerEncuesta(datos.in)
  if (!r) return false
  let entrada
  try {
    entrada = await prisma.crmMensaje.create({ data: { conversacionId: conv.id, tipo: 'in', datos: json(datos), waId, createdAt: cuando } })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return true
    throw e
  }
  const csat = await prisma.crmMensaje.create({
    data: { conversacionId: conv.id, tipo: 'csat', datos: json({ csat: { asesor: enc.asesor ?? null, aten: r.aten, nps: r.nps, com: r.com } }), createdAt: new Date(cuando.getTime() + 1) },
  })
  await prisma.crmConversacion.update({
    where: { id: conv.id },
    data: { encuestada: true, ultimoEntranteAt: cuando, extra: json({ ...obj(conv.extra), _encuesta: { ...enc, respondida: cuando.toISOString() } }) },
  })
  emitirMsg(conv.id, entrada)
  emitirMsg(conv.id, csat)
  await emitirConv(conv.id)
  return true
}

// ─── Mensaje entrante ────────────────────────────────────────────────────────

export async function procesarEntrante(linea: CrmLinea, m: WaMensaje, perfiles: WaContacto[] = []): Promise<void> {
  if (!m?.id || !m.from || m.type === 'reaction') return
  const tel = telDigitos(m.from)
  if (!tel) return
  await enFila(`${linea.id}:${tel}`, async () => {
    if (await prisma.crmMensaje.findUnique({ where: { waId: m.id }, select: { id: true } })) return // repetido: Meta reintenta
    const cuando = m.timestamp && Number(m.timestamp) > 0 ? new Date(Number(m.timestamp) * 1000) : new Date()
    // La respuesta del formulario de la encuesta al finalizar (lote 6): tarjeta en su conversación, sin reabrirla.
    if (m.type === 'interactive' && m.interactive?.type === 'nfm_reply' && await respuestaFormulario(linea, m, tel, cuando)) return
    const nombre = txt(perfiles.find(p => telDigitos(p.wa_id) === tel)?.profile?.name) || txt(perfiles[0]?.profile?.name)
    const datos = await armarDatos(m, linea)
    const k = await contactoDe(tel, nombre, m.referral)
    await entrar(k, { linea }, [datos], m.id, cuando, `WA ${linea.nombre}`)
  })
}

async function vozPendiente(convId: number): Promise<void> {
  const c = await prisma.crmConversacion.findUnique({ where: { id: convId }, select: { extra: true } })
  const v = obj(obj(c?.extra)._vozAlResponder)
  if (!txt(v.url)) return
  // Se quita antes de enviar: si llegan dos mensajes seguidos, sale una sola vez.
  const quitada = await prisma.$executeRaw`UPDATE crm_conversaciones SET extra = extra - '_vozAlResponder' WHERE id = ${convId} AND extra ? '_vozAlResponder'`
  if (!quitada) return
  await guardarMensaje(convId, { out: '', audio: { url: txt(v.url), ...(txt(v.mime) ? { mime: txt(v.mime) } : {}) }, ...(txt(v.by) ? { by: txt(v.by) } : {}), alResponder: true }, { autorId: txt(v.por) || null, por: null })
}

async function guardarDeSpam(k: CrmContacto, lugar: Lugar, lista: Json[], waId: string, cuando: Date): Promise<void> {
  const donde = dondeDe(lugar)
  let conv = await prisma.crmConversacion.findFirst({ where: { contactoId: k.id, ...donde }, orderBy: { createdAt: 'desc' } })
  if (!conv) {
    conv = await prisma.crmConversacion.create({
      data: {
        contactoId: k.id, canal: 'linea' in lugar ? 'wa' : 'pagina' in lugar ? lugar.canal : 'web', lineaId: 'linea' in lugar ? lugar.linea.id : null,
        conexionId: 'pagina' in lugar ? lugar.pagina.id : null, equipo: 'Ventas', estado: 'finalizadas', finalizadaAt: cuando, motivoFin: 'Spam',
        ...('visitante' in lugar ? { extra: json({ webVisitante: lugar.visitante }) } : {}),
      },
    })
  }
  try {
    for (const [i, d] of lista.entries()) {
      const m = await prisma.crmMensaje.create({ data: { conversacionId: conv.id, tipo: 'in', datos: json(d), waId: i ? `${waId}#${i + 1}` : waId, createdAt: new Date(cuando.getTime() + i) } })
      emitirMsg(conv.id, m)
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return
    throw e
  }
}

/**
 * Lo que le pasa a un mensaje del cliente una vez se sabe quién es y qué mandó (WhatsApp,
 * Messenger e Instagram): encuesta, conversación, código de pauta, flujos, agente IA, reglas,
 * reparto y aviso de fuera de horario. `lista` trae un mensaje o varios (Messenger manda varias
 * fotos en un solo mensaje): el primero lleva el `waId` y es el que ven los flujos y el agente.
 */
async function entrar(k: CrmContacto, lugar: Lugar, lista: Json[], waId: string, cuando: Date, etq: string, extraConv?: Json): Promise<void> {
  const datos = lista[0]
  // ¿Es la respuesta a la encuesta de satisfacción? Se guarda como csat sin reabrir la conversación.
  if (await respuestaEncuesta(k.id, dondeDe(lugar), waId, datos, cuando)) return
  // Contacto en spam (lote 7): el mensaje se guarda en su última conversación sin reabrirla, sin no leídos, y sin
  // flujos, agente, reglas, reparto ni avisos. Se ve en Contactos › Spam; al sacarlo de spam vuelve a entrar normal.
  if (obj(k.extra).spam) { await guardarDeSpam(k, lugar, lista, waId, cuando); return }
  const { conv, nueva, reabierta, vuelveDe } = await conversacionPara(k, lugar, cuando)
  // Lo que el canal necesita para responder (TikTok: su id de conversación).
  if (extraConv && Object.entries(extraConv).some(([c, v]) => obj(conv.extra)[c] !== v)) {
    await prisma.crmConversacion.update({ where: { id: conv.id }, data: { extra: json({ ...obj(conv.extra), ...extraConv }) } })
  }
  // El mensaje trae el código de un clic de un enlace de pauta (enlaces.ts): queda la pauta del contacto.
  k = await pautaPorCodigo(k, textoDe(datos), conv.id).catch(e => { logger.warn(`[CRM ${etq}] código de pauta: ${(e as Error).message}`); return k })

  const msgs = []
  try {
    for (const [i, d] of lista.entries()) {
      msgs.push(await prisma.crmMensaje.create({ data: { conversacionId: conv.id, tipo: 'in', datos: json(d), waId: i ? `${waId}#${i + 1}` : waId, createdAt: new Date(cuando.getTime() + i) } }))
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && !msgs.length) return // otro proceso ya lo guardó
    throw e
  }
  const msg = msgs[0]
  const masTarde = (a: Date | null) => (!a || cuando > a ? cuando : a)
  await prisma.crmConversacion.update({
    where: { id: conv.id },
    data: {
      noLeidos: { increment: msgs.length },
      ultimoMensajeAt: masTarde(conv.ultimoMensajeAt),
      ultimoEntranteAt: masTarde(conv.ultimoEntranteAt),
      esperaDesde: conv.esperaDesde ?? cuando,
    },
  })
  // Primero se ve lo que escribió el cliente; después, lo que conteste un flujo o un agente.
  if (reabierta) emitirMsg(conv.id, reabierta)
  for (const x of msgs) emitirMsg(conv.id, x)
  // La nota de voz que quedó pendiente con una plantilla (lote 7): sale apenas la persona responde, una sola vez.
  await vozPendiente(conv.id).catch(e => logger.error(`[CRM ${etq}] nota de voz al responder ${conv.id}: ${(e as Error).message}`))
  // «Autorizo» a una solicitud de autorización de datos: queda marcada sola (autorizacion.ts).
  await autorizacionPorRespuesta(conv.id, k, textoDe(datos), cuando)
  // Flujos, agente IA y reglas (automatizaciones.ts). Si un flujo o un agente toma la conversación,
  // el reparto lo hace él al terminar. Si no: nueva, o reabierta sin asesor, se reparte de una.
  const { tomado } = await alEntrarMensaje({
    convId: conv.id, msgId: msg.id, linea: 'linea' in lugar ? lugar.linea : null, nueva, reabierta: !!reabierta, vuelveDe, contactoNuevo: k.createdAt.getTime() >= cuando.getTime() - 5_000,
    texto: textoDe(datos), respuestaId: txt(obj(datos.resp).id) || null,
  })
  if (!tomado && (nueva || (reabierta && !conv.asignadoId))) {
    logger.info(`[CRM ${etq}] conversación ${nueva ? 'nueva' : 'reabierta sin asesor'} ${conv.id}: se reparte`)
    await repartir(conv.id).catch(e => logger.error(`[CRM ${etq}] repartir ${conv.id}: ${(e as Error).message}`))
  }
  await emitirConv(conv.id)
  // Si un flujo o un agente está contestando, el aviso de fuera de horario sobra.
  if (!tomado) await avisoFueraDeHorario(conv.id).catch(e => logger.error(`[CRM ${etq}] aviso fuera de horario ${conv.id}: ${(e as Error).message}`))
}

/**
 * Un mensaje del chat de la página web (chatWeb.ts): el mismo camino que uno de WhatsApp
 * (encuesta, conversación, código de pauta, flujos, agente IA, reglas, reparto y aviso de
 * fuera de horario), sin línea. La conversación es la de ese navegador, no la de todo el
 * contacto. `cid` evita guardarlo dos veces si la burbuja reintenta. Devuelve el id guardado.
 */
export async function procesarEntranteWeb(k: CrmContacto, visitante: string, texto: string, cid: string | null, respuestaId: string | null = null): Promise<string | null> {
  return enFila(`web:${visitante}`, async () => {
    if (cid) {
      const ya = await prisma.crmMensaje.findFirst({ where: { tipo: 'in', datos: { path: ['cid'], equals: cid }, conversacion: { contactoId: k.id, ...deVisitante(visitante) } }, select: { id: true } })
      if (ya) return ya.id
    }
    const cuando = new Date()
    const datos: Json = { in: texto, ...(cid ? { cid } : {}), ...(respuestaId ? { resp: { id: respuestaId } } : {}) }
    if (await respuestaEncuesta(k.id, deVisitante(visitante), null, datos, cuando)) return null
    const { conv, nueva, reabierta, vuelveDe } = await conversacionPara(k, { visitante }, cuando)
    k = await pautaPorCodigo(k, texto, conv.id).catch(e => { logger.warn(`[CRM web] código de pauta: ${(e as Error).message}`); return k })
    if (nueva) {
      // El WhatsApp que se escribe en la burbuja nadie lo verificó: quien atiende lo ve antes de dar datos.
      if (k.telefono) {
        const ev = await prisma.crmMensaje.create({ data: { conversacionId: conv.id, tipo: 'ev', datos: json({ ev: 'user', t: 'Escribió desde el chat de la página web. El WhatsApp que dio no está verificado: confirma que es la persona antes de dar datos de su compra.' }), createdAt: new Date(cuando.getTime() - 1) } })
        emitirMsg(conv.id, ev)
      }
    }
    const msg = await prisma.crmMensaje.create({ data: { conversacionId: conv.id, tipo: 'in', datos: json(datos), createdAt: cuando } })
    await prisma.crmConversacion.update({
      where: { id: conv.id },
      data: { noLeidos: { increment: 1 }, ultimoMensajeAt: cuando, ultimoEntranteAt: cuando, esperaDesde: conv.esperaDesde ?? cuando },
    })
    if (reabierta) emitirMsg(conv.id, reabierta)
    emitirMsg(conv.id, msg)
    const { tomado } = await alEntrarMensaje({
      convId: conv.id, msgId: msg.id, linea: null, nueva, reabierta: !!reabierta, vuelveDe, contactoNuevo: k.createdAt.getTime() >= cuando.getTime() - 60_000,
      texto, respuestaId,
    })
    if (!tomado && (nueva || (reabierta && !conv.asignadoId))) {
      await repartir(conv.id).catch(e => logger.error(`[CRM web] repartir ${conv.id}: ${(e as Error).message}`))
    }
    await emitirConv(conv.id)
    if (!tomado) await avisoFueraDeHorario(conv.id).catch(e => logger.error(`[CRM web] aviso fuera de horario ${conv.id}: ${(e as Error).message}`))
    return msg.id
  })
}

// ─── Instagram y Messenger ───────────────────────────────────────────────────
// Los avisos de Meta de los objetos `page` (Messenger) e `instagram`: `entry.id` es la página o
// la cuenta de Instagram, y cada `messaging` trae un mensaje, un botón tocado, una entrega o una
// lectura. Las marcas de tiempo vienen en milisegundos. Guía: docs/crm/api-instagram-messenger.md.

interface AdjuntoPagina { type?: string; payload?: { url?: string; title?: string; sticker_id?: number | string } }
interface MensajePagina {
  mid?: string; text?: string; is_echo?: boolean; is_deleted?: boolean; app_id?: number | string
  attachments?: AdjuntoPagina[]; quick_reply?: { payload?: string }
  reply_to?: { mid?: string; story?: { url?: string; id?: string } }; referral?: Json
}
interface EventoPagina {
  sender?: { id?: string }; recipient?: { id?: string }; timestamp?: number
  message?: MensajePagina
  postback?: { mid?: string; title?: string; payload?: string; referral?: Json }
  delivery?: { mids?: string[]; watermark?: number }
  read?: { watermark?: number; mid?: string }
  referral?: Json
}

const nombreCanalPagina = (canal: 'fb' | 'ig') => (canal === 'ig' ? 'Instagram' : 'Messenger')
const HOSTS_META = /(^|\.)(facebook\.com|fbsbx\.com|fbcdn\.net|cdninstagram\.com|instagram\.com)$/i

/** Los archivos de Messenger e Instagram llegan con un enlace de Meta: solo se bajan de sus dominios (o del Meta simulado de las pruebas). */
function urlDeMeta(url: string): boolean {
  try {
    const u = new URL(url)
    if (u.host === new URL(baseGraph()).host) return true
    return u.protocol === 'https:' && HOSTS_META.test(u.hostname)
  } catch { return false }
}

async function bajarDeMeta(url: string): Promise<{ buffer: Buffer; mime: string }> {
  if (!urlDeMeta(url)) throw new Error('el enlace del archivo no es de Meta')
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  if (!res.ok) throw new Error(`Meta no entregó el archivo (HTTP ${res.status})`)
  return { buffer: Buffer.from(await res.arrayBuffer()), mime: (res.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim() }
}

/** El nombre de un documento, sacado de su enlace (Messenger no lo manda aparte). */
function nombreDeUrl(url: string): string {
  try { return decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '').slice(0, 120) } catch { return '' }
}

const QUE_ES: Record<string, string> = {
  share: 'Compartió una publicación', story_mention: 'Te mencionó en su historia', ig_reel: 'Compartió un reel', reel: 'Compartió un reel',
  fallback: 'Compartió un enlace', location: 'Compartió una ubicación', template: 'Mandó una tarjeta',
}

/** Un adjunto de Messenger o Instagram con la forma de la maqueta: los archivos quedan en la Nube del CRM. */
async function datosDeAdjunto(a: AdjuntoPagina, canal: 'fb' | 'ig', id: string, cap: string): Promise<Json> {
  const tipo = txt(a.type), url = txt(a.payload?.url), conCap = cap ? { cap } : {}
  const clase: ClaseMedia | null = tipo === 'image' ? (a.payload?.sticker_id ? 'sticker' : 'image') : tipo === 'video' ? 'video' : tipo === 'audio' ? 'audio' : tipo === 'file' ? 'document' : null
  if (clase && url) {
    try {
      const { buffer, mime } = await bajarDeMeta(url)
      const nombre = clase === 'document' ? nombreDeUrl(url) : ''
      const guardada = await subirMedia(buffer, mime, clase, `${canal}-${id.replace(/\W/g, '').slice(-12)}`, nombre)
      if (clase === 'sticker') return { in: { img: guardada, sticker: true } }
      if (clase === 'image') return { in: { img: guardada, ...conCap } }
      if (clase === 'video') return { in: { video: guardada, ...conCap } }
      if (clase === 'document') return { in: { doc: guardada, n: nombre || 'Documento', ...conCap } }
      return { in: { audio: '', url: guardada, ...conCap } }
    } catch (e) {
      logger.warn(`[CRM ${canal}] no se pudo guardar ${tipo} ${id}: ${(e as Error).message}`)
      return { in: `Llegó ${NOMBRE_MEDIA[clase]} que no se pudo guardar: ${(e as Error).message}${cap ? `\n${cap}` : ''}`, mediaUrl: url, mediaTipo: tipo }
    }
  }
  const titulo = txt(a.payload?.title)
  return { in: [`${QUE_ES[tipo] ?? 'Mandó algo que el CRM todavía no muestra'}${titulo ? `: ${titulo}` : ''}`, url, cap].filter(Boolean).join('\n'), tipoMeta: tipo || null }
}

/** El mensaje (o los mensajes, si trae varias fotos) con la forma de la maqueta. */
async function armarDatosPagina(msg: MensajePagina, canal: 'fb' | 'ig', mid: string): Promise<Json[]> {
  const historia = txt(msg.reply_to?.story?.url)
  const texto = [historia ? `Respondió a tu historia: ${historia}` : '', txt(msg.text)].filter(Boolean).join('\n')
  const resp = txt(msg.quick_reply?.payload) ? { resp: { id: txt(msg.quick_reply?.payload) } } : {}
  const adjuntos = Array.isArray(msg.attachments) ? msg.attachments : []
  if (!adjuntos.length) return [{ in: texto || 'Mensaje sin texto', ...resp }]
  const lista: Json[] = []
  for (const [i, a] of adjuntos.entries()) lista.push(await datosDeAdjunto(a, canal, `${mid}${i}`, i ? '' : texto))
  lista[0] = { ...lista[0], ...resp }
  return lista
}

/** El anuncio por el que llegó (clic en un anuncio que abre Messenger o Instagram). */
function pautaDeReferencia(r: Json | null | undefined) {
  const x = obj(r)
  if (!x.ad_id && x.source !== 'ADS') return null
  const ctx = obj(x.ads_context_data)
  return {
    plataforma: 'Meta', anuncio: txt(ctx.ad_title) || 'Anuncio sin título', como: 'Clic en anuncio', url: null,
    tipo: 'Anuncio', idAnuncio: x.ad_id ? String(x.ad_id) : null, formato: null, texto: null, ref: txt(x.ref) || null,
  }
}

async function contactoPagina(canal: 'fb' | 'ig', persona: string, cx: CrmConexion, referencia: Json | null | undefined): Promise<CrmContacto> {
  const donde = canal === 'ig' ? { igId: persona } : { fbId: persona }
  const pauta = pautaDeReferencia(referencia)
  let k = await prisma.crmContacto.findFirst({ where: donde })
  if (!k) {
    const perfil = await perfilDe(canal, persona, tokenDePagina(cx))
    try {
      return await prisma.crmContacto.create({
        data: {
          ...donde, nombre: perfil.nombre || null, canal,
          ficha: json({ origen: pauta ? 'Anuncio de Meta' : nombreCanalPagina(canal), ...(perfil.usuario ? { usuario: perfil.usuario } : {}) }),
          ...(pauta ? { pauta: json(pauta) } : {}),
        },
      })
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e
      k = await prisma.crmContacto.findFirst({ where: donde })
      if (!k) throw e
    }
  }
  if (pauta) {
    // Volvió por un anuncio: queda la pauta nueva y el origen anterior pasa a «previas».
    const ficha = obj(k.ficha)
    const previas = Array.isArray(ficha.previas) ? [...ficha.previas] : []
    if (ficha.origen && ficha.origen !== 'Anuncio de Meta') previas.push([ficha.origen, fechaCorta(k.createdAt)])
    k = await prisma.crmContacto.update({ where: { id: k.id }, data: { pauta: json(pauta), ficha: json({ ...ficha, origen: 'Anuncio de Meta', previas }) } })
  }
  return k
}

/** Un mensaje (o un botón tocado) de una persona por Messenger o Instagram. */
async function procesarEntrantePagina(cx: CrmConexion, canal: 'fb' | 'ig', ev: EventoPagina): Promise<void> {
  const persona = txt(ev.sender?.id)
  const msg: MensajePagina | null = ev.message
    ?? (ev.postback ? { mid: ev.postback.mid, text: ev.postback.title, quick_reply: { payload: ev.postback.payload } } : null)
  if (!persona || !msg) return
  if (msg.is_deleted) { logger.info(`[CRM ${canal}] ${persona} borró un mensaje (${msg.mid ?? '?'})`); return }
  const mid = txt(msg.mid) || `${canal}-boton-${persona}-${ev.timestamp ?? Date.now()}`
  await enFila(`${cx.id}:${persona}`, async () => {
    if (await prisma.crmMensaje.findUnique({ where: { waId: mid }, select: { id: true } })) return // repetido: Meta reintenta
    const cuando = ev.timestamp && Number(ev.timestamp) > 0 ? new Date(Number(ev.timestamp)) : new Date()
    const lista = await armarDatosPagina(msg, canal, mid)
    const k = await contactoPagina(canal, persona, cx, ev.referral ?? msg.referral ?? ev.postback?.referral)
    await entrar(k, { pagina: cx, canal }, lista, mid, cuando, canal)
  })
}

/** Una lista de la maqueta de entrada ({in}) como lo que se envió ({out}): para lo que se respondió desde la app de Meta. */
function comoSalida(d: Json, canal: 'fb' | 'ig'): Json {
  const por = `Desde ${nombreCanalPagina(canal)}`
  if (typeof d.in === 'string') return { out: d.in, by: por }
  const x = obj(d.in)
  if (x.audio !== undefined && x.url) return { out: '', audio: { url: x.url }, by: por }
  const archivo = x.img ? { n: 'Imagen', url: x.img, mime: 'image/jpeg' } : x.video ? { n: 'Video', url: x.video, mime: 'video/mp4', ic: 'play' } : x.doc ? { n: x.n || 'Documento', url: x.doc } : null
  return { out: txt(x.cap), ...(archivo ? { file: archivo } : {}), by: por }
}

/**
 * El eco de un mensaje que salió de la página. Si lo mandó el CRM, ya está (se reconoce por su id,
 * o por la app en Messenger). Si alguien respondió desde la app de Instagram, Messenger o Meta
 * Business Suite, queda en la conversación como enviado «Desde Instagram».
 */
async function procesarEcoPagina(cx: CrmConexion, canal: 'fb' | 'ig', ev: EventoPagina): Promise<void> {
  const msg = ev.message
  const mid = txt(msg?.mid), persona = txt(ev.recipient?.id)
  if (!msg || !mid || !persona) return
  const delCrm = async () => !!(await prisma.crmMensaje.findFirst({ where: { OR: [{ waId: mid }, { datos: { path: ['_mids'], array_contains: [mid] } }] }, select: { id: true } }))
  if (await delCrm()) return
  if (msg.app_id && String(msg.app_id) === txt(obj(cx.datos).appId)) return // lo mandó el CRM: la otra parte de un envío
  // El eco puede llegar antes de que el CRM guarde el id que le devolvió Meta.
  for (let i = 0; i < 3; i++) { await espera(1500); if (await delCrm()) return }
  await enFila(`${cx.id}:${persona}`, async () => {
    if (await delCrm()) return
    const k = await prisma.crmContacto.findFirst({ where: canal === 'ig' ? { igId: persona } : { fbId: persona } })
    const conv = k ? await prisma.crmConversacion.findFirst({ where: { contactoId: k.id, conexionId: cx.id, canal }, orderBy: { createdAt: 'desc' } }) : null
    if (!conv) return // a alguien que nunca escribió al CRM: no hay conversación donde ponerlo
    const cuando = ev.timestamp && Number(ev.timestamp) > 0 ? new Date(Number(ev.timestamp)) : new Date()
    const lista = await armarDatosPagina(msg, canal, mid)
    const creados = []
    try {
      for (const [i, d] of lista.entries()) {
        creados.push(await prisma.crmMensaje.create({ data: { conversacionId: conv.id, tipo: 'out', datos: json(comoSalida(d, canal)), waId: i ? `${mid}#${i + 1}` : mid, estado: 'enviado', createdAt: new Date(cuando.getTime() + i) } }))
      }
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && !creados.length) return
      throw e
    }
    // Ya le respondieron: deja de contar como espera.
    await prisma.crmConversacion.update({ where: { id: conv.id }, data: { ultimoMensajeAt: cuando > (conv.ultimoMensajeAt ?? new Date(0)) ? cuando : conv.ultimoMensajeAt, esperaDesde: null } })
    for (const x of creados) emitirMsg(conv.id, x)
    await emitirConv(conv.id)
  })
}

/** Entregado (Messenger): la lista de ids que ya llegaron. */
async function entregadosPagina(mids: string[]) {
  for (const mid of mids) {
    // Sin esperas: Messenger también avisa las entregas de lo que se mandó por fuera del CRM.
    const m = await prisma.crmMensaje.findUnique({ where: { waId: mid }, select: { id: true, estado: true } })
    if (!m || !['enviando', 'enviado'].includes(m.estado ?? '')) continue
    const x = await prisma.crmMensaje.update({ where: { id: m.id }, data: { estado: 'entregado', error: null } })
    emitirMsg(x.conversacionId, x)
  }
}

/**
 * Leído: Messenger dice «todo lo enviado hasta esta hora»; Instagram, el id del último que vio.
 * Pasan a leídos los mensajes que salieron por esa página a esa persona hasta ese momento.
 */
async function leidosPagina(cx: CrmConexion, canal: 'fb' | 'ig', ev: EventoPagina) {
  const persona = txt(ev.sender?.id)
  const k = persona ? await prisma.crmContacto.findFirst({ where: canal === 'ig' ? { igId: persona } : { fbId: persona }, select: { id: true } }) : null
  if (!k) return
  let hasta = Number(ev.read?.watermark ?? 0)
  if (!hasta && ev.read?.mid) {
    const m = await prisma.crmMensaje.findUnique({ where: { waId: String(ev.read.mid) }, select: { createdAt: true } })
    hasta = m?.createdAt.getTime() ?? 0
  }
  if (!hasta) return
  const filas = await prisma.crmMensaje.findMany({
    where: { tipo: { in: ['out', 'bot', 'ia', 'recepcion'] }, estado: { in: ['enviado', 'entregado'] }, createdAt: { lte: new Date(hasta) }, conversacion: { contactoId: k.id, conexionId: cx.id, canal } },
    select: { id: true },
  })
  for (const f of filas) {
    const x = await prisma.crmMensaje.update({ where: { id: f.id }, data: { estado: 'leido', error: null } })
    emitirMsg(x.conversacionId, x)
  }
}

/**
 * Procesa un aviso de Meta de los objetos `page` o `instagram`. La conexión es la página dueña de
 * `entry.id`, siempre que sea la conexión por cuya dirección llegó (app conectada a mano) o, si
 * llegó a la dirección general, una conectada con el botón de Meta. Lanza al final si algo falló,
 * como el de WhatsApp, para que el aviso se reintente.
 */
export async function procesarWebhookPaginas(cuerpo: Json, conexionId: string | null = null): Promise<void> {
  const canal: 'fb' | 'ig' = cuerpo?.object === 'instagram' ? 'ig' : 'fb'
  const fallas: string[] = []
  for (const entrada of Array.isArray(cuerpo?.entry) ? cuerpo.entry : []) {
    const cuenta = String(entrada?.id ?? '')
    if (!cuenta) continue
    const cx = await prismaGlobal.crmConexion.findFirst({
      // Instagram entra por su propia conexión (instagram.ts); Messenger, por la de la página.
      where: { tipo: canal === 'ig' ? 'instagram' : 'pagina', ...(conexionId ? { id: conexionId } : { modo: 'meta' }), datos: { path: [canal === 'ig' ? 'igId' : 'pageId'], equals: cuenta } },
    })
    if (!cx) { logger.info(`[CRM ${canal}] aviso de la cuenta ${cuenta} fuera del CRM`); continue }
    await enEspacio(cx.espacioId, async () => {
      // «Recibir sus mensajes» apagado en los ajustes del canal: no entran.
      const encendido = canalEncendido(obj(await leerAjuste('cfg')), canal)
      for (const ev of (Array.isArray(entrada?.messaging) ? entrada.messaging : []) as EventoPagina[]) {
        try {
          if (ev.message?.is_echo) await procesarEcoPagina(cx, canal, ev)
          else if (ev.message || ev.postback) {
            if (encendido) await procesarEntrantePagina(cx, canal, ev)
            else logger.info(`[CRM ${canal}] mensaje sin recibir: ${nombreCanalPagina(canal)} está apagado en Ajustes del CRM`)
          } else if (ev.delivery) await entregadosPagina((ev.delivery.mids ?? []).map(String))
          else if (ev.read) await leidosPagina(cx, canal, ev)
        } catch (e) {
          fallas.push(`${canal} ${ev.message?.mid ?? ev.postback?.mid ?? '?'}: ${(e as Error).message}`)
        }
      }
    })
  }
  if (fallas.length) {
    for (const f of fallas) logger.error(`[CRM páginas] webhook ${f}`)
    throw new Error(fallas.join(' · ').slice(0, 900))
  }
}

// ─── Telegram ────────────────────────────────────────────────────────────────
// Los avisos del bot (services/crm/telegram.ts): mensajes privados y botones tocados. Los grupos y
// los canales no entran. Guía: docs/crm/api-telegram.md.

interface ArchivoTg { file_id?: string; file_name?: string; mime_type?: string; file_size?: number }
interface MensajeTg {
  message_id?: number; date?: number; text?: string; caption?: string
  from?: { id?: number; is_bot?: boolean; first_name?: string; last_name?: string; username?: string }
  chat?: { id?: number; type?: string }
  photo?: ArchivoTg[]; voice?: ArchivoTg; audio?: ArchivoTg; video?: ArchivoTg; video_note?: ArchivoTg; document?: ArchivoTg; sticker?: ArchivoTg & { is_animated?: boolean; is_video?: boolean; emoji?: string }
  location?: { latitude?: number; longitude?: number }; contact?: { phone_number?: string; first_name?: string; last_name?: string }
  reply_markup?: { inline_keyboard?: { text?: string; callback_data?: string }[][] }
}

async function datosDeTelegram(cx: CrmConexion, m: MensajeTg, id: string): Promise<Json> {
  const cap = txt(m.caption)
  const conCap = cap ? { cap } : {}
  const sello = `tg-${id.replace(/\W/g, '').slice(-12)}`
  const guardar = async (a: ArchivoTg, clase: ClaseMedia) => {
    const { buffer, mime, ruta } = await bajarDeTelegram(cx, String(a.file_id))
    const tipo = txt(a.mime_type) || mime
    const nombre = txt(a.file_name) || ruta.split('/').pop() || ''
    return { url: await subirMedia(buffer, tipo, clase, sello, nombre), buffer, mime: tipo, nombre }
  }
  try {
    if (m.photo?.length) { const g = await guardar(m.photo[m.photo.length - 1], 'image'); return { in: { img: g.url, ...conCap } } }
    if (m.sticker?.file_id && !m.sticker.is_animated && !m.sticker.is_video) { const g = await guardar(m.sticker, 'sticker'); return { in: { img: g.url, sticker: true } } }
    if (m.sticker) return { in: txt(m.sticker.emoji) || 'Mandó un sticker' }
    if (m.video?.file_id || m.video_note?.file_id) { const g = await guardar((m.video ?? m.video_note)!, 'video'); return { in: { video: g.url, ...conCap } } }
    if (m.voice?.file_id || m.audio?.file_id) {
      const g = await guardar((m.voice ?? m.audio)!, 'audio')
      return { in: { audio: '', url: g.url, ...conCap } }
    }
    if (m.document?.file_id) { const g = await guardar(m.document, 'document'); return { in: { doc: g.url, n: g.nombre || 'Documento', ...conCap } } }
  } catch (e) {
    logger.warn(`[CRM tg] no se pudo guardar el archivo de ${id}: ${(e as Error).message}`)
    return { in: `Llegó un archivo que no se pudo guardar: ${(e as Error).message}${cap ? `\n${cap}` : ''}` }
  }
  if (m.location) return { in: `📍 https://maps.google.com/?q=${m.location.latitude},${m.location.longitude}` }
  if (m.contact) return { in: `Contacto: ${[txt(m.contact.first_name), txt(m.contact.last_name)].filter(Boolean).join(' ') || 'Sin nombre'} ${txt(m.contact.phone_number)}`.trim() }
  return { in: txt(m.text) || 'Mensaje de un tipo que el CRM todavía no muestra' }
}

/** Un mensaje (o un botón tocado) de una persona al bot. */
async function procesarEntranteTelegram(cx: CrmConexion, m: MensajeTg, boton: { id: string; data: string } | null): Promise<void> {
  if (m.chat?.type && m.chat.type !== 'private') return // grupos y canales: no
  const de = boton ? null : m.from
  const persona = String((boton ? m.chat?.id : de?.id) ?? '')
  if (!persona || de?.is_bot) return
  const botId = txt(obj(cx.datos).botId)
  const mid = boton ? `tg:${botId}:${persona}:b${boton.id}` : `tg:${botId}:${persona}:${m.message_id}`
  await enFila(`${cx.id}:${persona}`, async () => {
    if (await prisma.crmMensaje.findUnique({ where: { waId: mid }, select: { id: true } })) return
    const cuando = boton ? new Date() : m.date ? new Date(m.date * 1000) : new Date()
    let datos: Json
    if (boton) {
      // Telegram solo dice qué botón: su texto sale del teclado del mensaje.
      const b = (m.reply_markup?.inline_keyboard ?? []).flat().find(x => x.callback_data === boton.data)
      datos = { in: txt(b?.text) || boton.data, resp: { id: boton.data } }
      await contestarBoton(cx, boton.id)
    } else datos = await datosDeTelegram(cx, m, mid)
    let k = await prisma.crmContacto.findFirst({ where: { tgId: persona } })
    if (!k) {
      const nombre = [txt(de?.first_name), txt(de?.last_name)].filter(Boolean).join(' ')
      try {
        k = await prisma.crmContacto.create({ data: { tgId: persona, nombre: nombre || null, canal: 'tg', ficha: json({ origen: 'Telegram', ...(de?.username ? { usuario: `@${de.username}` } : {}) }) } })
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e
        k = await prisma.crmContacto.findFirst({ where: { tgId: persona } })
        if (!k) throw e
      }
    }
    await entrar(k, { pagina: cx, canal: 'tg' }, [datos], mid, cuando, 'tg')
  })
}

/** Procesa un aviso del bot (`update`). Lanza si algo falló, para que se reintente. */
export async function procesarWebhookTelegram(update: Json, conexionId: string | null): Promise<void> {
  if (!conexionId) return
  const cx = await prismaGlobal.crmConexion.findUnique({ where: { id: conexionId } })
  if (!cx || cx.tipo !== 'telegram') return
  await enEspacio(cx.espacioId, async () => {
    if (!canalEncendido(obj(await leerAjuste('cfg')), 'tg')) { logger.info('[CRM tg] mensaje sin recibir: Telegram está apagado en Ajustes del CRM'); return }
    const cb = obj(update.callback_query)
    if (cb.id) return procesarEntranteTelegram(cx, obj(cb.message) as MensajeTg, { id: String(cb.id), data: txt(cb.data) })
    const m = obj(update.message ?? update.edited_message) as MensajeTg
    if (m.message_id) return procesarEntranteTelegram(cx, m, null)
  })
}

// ─── TikTok ──────────────────────────────────────────────────────────────────
// Los avisos de la Business Messaging API (services/crm/tiktok.ts): el cuerpo trae `event`,
// `user_openid` (la cuenta de empresa) y `content`, un JSON en texto. Guía: docs/crm/api-tiktok.md.

interface ContenidoTiktok {
  from?: string; to?: string; unique_identifier?: string
  from_user?: { id?: string; role?: string }; to_user?: { id?: string; role?: string }
  conversation_id?: string; message_id?: string; timestamp?: number; type?: string
  text?: { body?: string }; image?: { media_id?: string }; video?: { media_id?: string }
  share_post?: { embed_url?: string }; sticker?: { url?: string }; emoji?: { url?: string }
  template?: Json; message_tag?: { source?: string }; auto_message_type?: string
  referral?: { source?: string; ad?: { ad_id?: string; ad_name?: string; embed_url?: string }; short_link?: { ref?: string } }
  read?: { last_read_timestamp?: number }
}

async function datosDeTiktok(cx: CrmConexion, c: ContenidoTiktok): Promise<Json> {
  const t = txt(c.type)
  if (t === 'text') return { in: txt(c.text?.body) }
  if ((t === 'image' && c.image?.media_id) || (t === 'video' && c.video?.media_id)) {
    try {
      const { buffer, mime } = await bajarDeTiktok(cx, String(c.conversation_id), String(c.message_id), String((c.image ?? c.video)?.media_id), t === 'image' ? 'IMAGE' : 'VIDEO')
      const url = await subirMedia(buffer, mime, t === 'image' ? 'image' : 'video', `tt-${String(c.message_id).replace(/\W/g, '').slice(-12)}`, '')
      return { in: t === 'image' ? { img: url } : { video: url } }
    } catch (e) {
      logger.warn(`[CRM tt] no se pudo guardar ${t} ${c.message_id}: ${(e as Error).message}`)
      return { in: `Llegó ${t === 'image' ? 'una imagen' : 'un video'} que no se pudo guardar: ${(e as Error).message}` }
    }
  }
  if (t === 'share_post') return { in: `Compartió una publicación\n${txt(c.share_post?.embed_url)}`.trim() }
  if (t === 'sticker' || t === 'emoji') { const u = txt((c.sticker ?? c.emoji)?.url); return u ? { in: { img: u, sticker: true } } : { in: 'Mandó un sticker' } }
  return { in: 'Mensaje de un tipo que el CRM todavía no muestra', tipoTiktok: t || null }
}

async function contactoTiktok(persona: string, usuario: string, pauta: Json | null): Promise<CrmContacto> {
  let k = await prisma.crmContacto.findFirst({ where: { ttId: persona } })
  if (!k) {
    try {
      return await prisma.crmContacto.create({
        data: { ttId: persona, canal: 'tt', ficha: json({ origen: pauta ? 'Anuncio de TikTok' : 'TikTok', ...(usuario ? { usuario: `@${usuario}` } : {}) }), ...(pauta ? { pauta: json(pauta) } : {}) },
      })
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e
      k = await prisma.crmContacto.findFirst({ where: { ttId: persona } })
      if (!k) throw e
    }
  }
  if (pauta && !k.pauta) k = await prisma.crmContacto.update({ where: { id: k.id }, data: { pauta: json(pauta), ficha: json({ ...obj(k.ficha), origen: 'Anuncio de TikTok' }) } })
  return k
}

/** Procesa un aviso de TikTok. `conexionId`: la conexión por cuya dirección llegó (app de la empresa) o null (app de la plataforma). */
export async function procesarWebhookTiktok(cuerpo: Json, conexionId: string | null): Promise<void> {
  const openId = txt(cuerpo.user_openid)
  const evento = txt(cuerpo.event)
  let c: ContenidoTiktok
  try { c = typeof cuerpo.content === 'string' ? JSON.parse(cuerpo.content) : obj(cuerpo.content) } catch { logger.warn('[CRM tt] aviso con contenido que no es JSON'); return }
  if (!openId) return
  // La cuenta de empresa del aviso, en la conexión por la que llegó (o en una conectada con la app de la plataforma).
  const via = conexionId ? await prismaGlobal.crmConexion.findUnique({ where: { id: conexionId } }) : null
  const cx = await prismaGlobal.crmConexion.findFirst({
    where: { tipo: 'tiktok', datos: { path: ['openId'], equals: openId }, ...(via ? { espacioId: via.espacioId, modo: 'manual' } : { modo: 'plataforma' }) },
  })
  if (!cx || (via && obj(cx.datos).appId !== obj(via.datos).appId)) { logger.info(`[CRM tt] aviso de la cuenta ${openId} fuera del CRM`); return }
  await enEspacio(cx.espacioId, async () => {
    const persona = txt(c.from_user?.role === 'personal_account' ? c.from_user?.id : c.to_user?.id) || txt(c.unique_identifier)
    if (!persona) return
    if (evento === 'im_receive_msg') {
      if (!canalEncendido(obj(await leerAjuste('cfg')), 'tt')) { logger.info('[CRM tt] mensaje sin recibir: TikTok está apagado en Ajustes del CRM'); return }
      const mid = `tt:${txt(c.message_id)}`
      if (c.type === 'reaction' || !c.message_id) return
      await enFila(`${cx.id}:${persona}`, async () => {
        if (await prisma.crmMensaje.findUnique({ where: { waId: mid }, select: { id: true } })) return
        const datos = await datosDeTiktok(cx, c)
        const k = await contactoTiktok(persona, txt(c.from), null)
        await entrar(k, { pagina: cx, canal: 'tt' }, [datos], mid, c.timestamp ? new Date(Number(c.timestamp)) : new Date(), 'tt', { ttConversacion: txt(c.conversation_id) })
      })
    } else if (evento === 'im_send_msg') {
      // Lo que mandó el CRM ya está; lo mandado desde la app de TikTok (o un mensaje automático de TikTok) queda como enviado.
      const mid = `tt:${txt(c.message_id)}`
      if (c.message_tag?.source === 'API' || !c.message_id) return
      await espera(1500)
      if (await prisma.crmMensaje.findFirst({ where: { OR: [{ waId: mid }, { waId: txt(c.message_id) }] }, select: { id: true } })) return
      const k = await prisma.crmContacto.findFirst({ where: { ttId: persona } })
      const conv = k ? await prisma.crmConversacion.findFirst({ where: { contactoId: k.id, conexionId: cx.id, canal: 'tt' }, orderBy: { createdAt: 'desc' } }) : null
      if (!conv) return
      const d = await datosDeTiktok(cx, c)
      const salida = comoSalida(d, 'fb')
      salida.by = c.auto_message_type ? 'Mensaje automático de TikTok' : 'Desde TikTok'
      const cuando = c.timestamp ? new Date(Number(c.timestamp)) : new Date()
      try {
        const m = await prisma.crmMensaje.create({ data: { conversacionId: conv.id, tipo: 'out', datos: json(salida), waId: mid, estado: 'enviado', createdAt: cuando } })
        await prisma.crmConversacion.update({ where: { id: conv.id }, data: { ultimoMensajeAt: cuando, ...(c.auto_message_type ? {} : { esperaDesde: null }) } })
        emitirMsg(conv.id, m)
        await emitirConv(conv.id)
      } catch (e) { if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e }
    } else if (evento === 'im_referral_msg' && c.referral?.source === 'ad') {
      const ad = c.referral.ad ?? {}
      await contactoTiktok(persona, txt(c.from), { plataforma: 'TikTok', anuncio: txt(ad.ad_name) || 'Anuncio sin título', como: 'Clic en anuncio', url: txt(ad.embed_url) || null, tipo: 'Anuncio', idAnuncio: ad.ad_id ?? null })
    } else if (evento === 'im_mark_read_msg') {
      const hasta = Number(c.read?.last_read_timestamp ?? c.timestamp ?? 0)
      const k = await prisma.crmContacto.findFirst({ where: { ttId: persona }, select: { id: true } })
      if (!k || !hasta) return
      const filas = await prisma.crmMensaje.findMany({ where: { tipo: { in: ['out', 'bot', 'ia', 'recepcion'] }, estado: { in: ['enviado', 'entregado'] }, createdAt: { lte: new Date(hasta) }, conversacion: { contactoId: k.id, conexionId: cx.id, canal: 'tt' } }, select: { id: true } })
      for (const f of filas) { const x = await prisma.crmMensaje.update({ where: { id: f.id }, data: { estado: 'leido' } }); emitirMsg(x.conversacionId, x) }
    }
  })
}

// ─── Estados de lo que se envió ──────────────────────────────────────────────

const ESTADO: Record<string, string> = { sent: 'enviado', delivered: 'entregado', read: 'leido', failed: 'fallido' }
const RANGO: Record<string, number> = { enviando: 0, enviado: 1, entregado: 2, leido: 3 }
const espera = (ms: number) => new Promise(r => setTimeout(r, ms))

interface WaEstado { id?: string; status?: string; recipient_id?: string; errors?: Json[] }

export async function procesarEstado(s: WaEstado): Promise<void> {
  const nuevo = ESTADO[String(s.status)]
  if (!nuevo || !s.id) return
  // El «sent» puede llegar antes de que se guarde el wamid de la respuesta de Meta.
  let m = await prisma.crmMensaje.findUnique({ where: { waId: s.id } })
  for (let i = 0; !m && i < 3; i++) { await espera(1500); m = await prisma.crmMensaje.findUnique({ where: { waId: s.id } }) }
  if (!m) { logger.info(`[CRM WA] estado ${s.status} de un mensaje que no está en el CRM (${s.id})`); return }
  const actual = m.estado ?? 'enviando'
  if (nuevo === 'fallido') {
    if ((RANGO[actual] ?? 0) > 1) return // ya entregado o leído: no se baja
  } else if (actual === 'fallido' || (RANGO[nuevo] ?? 0) <= (RANGO[actual] ?? 0)) return
  const f = await prisma.crmMensaje.update({
    where: { id: m.id },
    data: { estado: nuevo, error: nuevo === 'fallido' ? explicarErrorMeta(s.errors?.[0]).slice(0, 1000) : null },
  })
  emitirMsg(f.conversacionId, f)
  // Una respuesta que Meta no entregó no cuenta como atendida: la conversación vuelve a esperar.
  if (nuevo === 'fallido') await restaurarEsperaSiFallo(f.id).catch(e => logger.warn(`[CRM WA] espera tras fallo ${f.id}: ${(e as Error)?.message}`))
  // La encuesta al finalizar que Meta no entregó (lote 6): el evento dice que no salió y no gasta los días.
  if (nuevo === 'fallido' && f.tipo === 'ev') await encuestaNoLlego(f).catch(e => logger.warn(`[CRM WA] encuesta que no llegó ${f.id}: ${(e as Error)?.message}`))
}

// ─── Calidad y límite de la línea ────────────────────────────────────────────

/** Lo que Meta decide de una plantilla (aprobada, rechazada, pausada…), a la campana de los líderes. */
const AVISO_PLANTILLA: Record<string, [string, 'TAREA_PUBLICADA' | 'CAMBIOS_PEDIDOS', string]> = {
  APPROVED: ['Plantilla aprobada', 'TAREA_PUBLICADA', 'Meta aprobó la plantilla «{n}»: ya se puede usar.'],
  REINSTATED: ['Plantilla reactivada', 'TAREA_PUBLICADA', 'Meta reactivó la plantilla «{n}»: ya se puede usar de nuevo.'],
  REJECTED: ['Plantilla rechazada', 'CAMBIOS_PEDIDOS', 'Meta rechazó la plantilla «{n}»{r}.'],
  PAUSED: ['Plantilla pausada', 'CAMBIOS_PEDIDOS', 'Meta pausó la plantilla «{n}» por cómo reaccionan los clientes{r}.'],
  DISABLED: ['Plantilla deshabilitada', 'CAMBIOS_PEDIDOS', 'Meta deshabilitó la plantilla «{n}»{r}.'],
  FLAGGED: ['Plantilla con baja calidad', 'CAMBIOS_PEDIDOS', 'Meta marcó la plantilla «{n}» por baja calidad: si no mejora, la pausa{r}.'],
}
async function avisarPlantilla(v: Json) {
  const ev = String(v.event ?? '').toUpperCase()
  const def = AVISO_PLANTILLA[ev]
  const n = String(v.message_template_name ?? '').trim()
  if (!def || !n || !primeraVez(`plantilla|${n}|${v.message_template_language ?? ''}|${ev}`, 6 * 3_600_000)) return
  const razon = String(v.reason ?? '').trim()
  const r = razon && !/^none$/i.test(razon) ? ` (motivo de Meta: ${razon.replace(/_/g, ' ').toLowerCase()})` : ''
  await avisarLideres({ tipo: def[1], titulo: def[0], texto: def[2].replace('{n}', n).replace('{r}', r), url: '/?ir=plantillas' })
}

async function actualizarCalidad(v: Json) {
  const digitos = String(v.display_phone_number ?? '').replace(/\D/g, '')
  if (!digitos) return
  const linea = (await prisma.crmLinea.findMany()).find(l => l.telefono.replace(/\D/g, '') === digitos)
  if (!linea) return
  const d = await credDeLinea(linea).then(cred => graph<Json>(`/${linea.phoneNumberId}`, { cred, query: { fields: 'quality_rating,messaging_limit_tier' } })).catch(() => ({} as Json))
  const l = await prisma.crmLinea.update({
    where: { id: linea.id },
    data: {
      calidad: d.quality_rating ? calidadTexto(d.quality_rating) : linea.calidad,
      limite: limiteTexto(d.messaging_limit_tier ?? v.current_limit) ?? linea.limite,
    },
  })
  emitirCrm({ tipo: 'linea', linea: lineaAFront(l) })
  // Si la calidad baja (o vuelve a alta), los líderes se enteran en la campana: con calidad baja Meta limita los envíos.
  if (l.calidad && l.calidad !== linea.calidad && ['Alta', 'Media', 'Baja'].includes(l.calidad) && primeraVez(`calidad|${linea.id}|${l.calidad}`, 6 * 3_600_000)) {
    const baja = l.calidad !== 'Alta'
    await avisarLideres({
      tipo: baja ? 'CAMBIOS_PEDIDOS' : 'TAREA_PUBLICADA',
      titulo: baja ? 'Bajó la calidad de una línea' : 'Una línea volvió a calidad alta',
      texto: baja ? `La línea ${linea.nombre} bajó su calidad en Meta: ahora es ${l.calidad.toLowerCase()}. Si llega a baja, Meta limita cuántos mensajes puede enviar.` : `La línea ${linea.nombre} volvió a calidad alta en Meta.`,
      url: '/?ir=cfg-canales',
    }).catch(e => logger.warn(`[CRM WA] aviso de calidad: ${(e as Error)?.message ?? e}`))
  }
}

// ─── Webhook completo ────────────────────────────────────────────────────────

/** Procesa el cuerpo (ya verificado) de un POST del webhook. Nunca lanza. */
/**
 * Procesa un aviso de Meta. Si alguna parte falla, lanza al final (después de
 * intentar todas): el aviso queda pendiente y el proceso de cada minuto lo
 * reintenta. Repetirlo no duplica nada: los mensajes se reconocen por su wamid
 * y los estados nunca bajan.
 */
/**
 * El espacio de trabajo de un aviso de Meta: el de la cuenta de WhatsApp (`entry.id`) o el de
 * alguno de sus números, siempre que esa línea sea de la conexión por la que llegó el aviso (la
 * dirección de una app conectada a mano) o, si llegó a la dirección general, de una conexión hecha
 * con el botón de Meta. Así nadie mete avisos en la cuenta de otra empresa con su propia app.
 * null si no hay línea que calce (un número que ya no está en el CRM, o la línea de Alma).
 */
async function espacioDeEntrada(entrada: Json, conexionId: string | null): Promise<string | null> {
  const waba = String(entrada?.id ?? '')
  const numeros = (Array.isArray(entrada?.changes) ? entrada.changes : [])
    .map((c: Json) => String(obj(c?.value).metadata?.phone_number_id ?? '')).filter(Boolean)
  if (!waba && !numeros.length) return null
  const l = await prismaGlobal.crmLinea.findFirst({
    where: {
      OR: [...(waba ? [{ wabaId: waba }] : []), ...(numeros.length ? [{ phoneNumberId: { in: numeros } }] : [])],
      conexion: conexionId ? { id: conexionId } : { modo: 'meta' },
    },
    select: { espacioId: true },
  })
  return l?.espacioId ?? null
}

/**
 * Coexistencia («Con tu app de WhatsApp Business»): lo que se respondió desde la app del celular llega como eco
 * (`smb_message_echoes`) y queda en la conversación como enviado «Desde la app de WhatsApp Business». Solo en
 * conversaciones que ya existen en el CRM con esa persona y esa línea.
 */
async function procesarEcoWhatsapp(linea: { id: string }, e: Json): Promise<void> {
  const mid = txt(e?.id), para = txt(e?.to).replace(/\D/g, '')
  if (!mid || para.length < 7) return
  if (await prisma.crmMensaje.findUnique({ where: { waId: mid }, select: { id: true } })) return
  const k = await prisma.crmContacto.findFirst({ where: { telefono: { endsWith: para.slice(-10) } }, select: { id: true } })
  const conv = k ? await prisma.crmConversacion.findFirst({ where: { contactoId: k.id, lineaId: linea.id }, orderBy: { createdAt: 'desc' } }) : null
  if (!conv) return
  const tipo = txt(e.type)
  const textos: Record<string, string> = { image: 'Imagen', video: 'Video', audio: 'Nota de voz', document: 'Documento', sticker: 'Sticker', location: 'Ubicación', contacts: 'Contacto' }
  const cuerpoTxt = tipo === 'text' ? txt(obj(e.text).body) : txt(obj(e[tipo]).caption) || `${textos[tipo] ?? 'Mensaje'} enviado desde el celular`
  const cuando = Number(e.timestamp) > 0 ? new Date(Number(e.timestamp) * 1000) : new Date()
  try {
    const m = await prisma.crmMensaje.create({ data: { conversacionId: conv.id, tipo: 'out', datos: json({ out: cuerpoTxt, by: 'Desde la app de WhatsApp Business' }), waId: mid, estado: 'enviado', createdAt: cuando } })
    await prisma.crmConversacion.update({ where: { id: conv.id }, data: { ultimoMensajeAt: cuando > (conv.ultimoMensajeAt ?? new Date(0)) ? cuando : conv.ultimoMensajeAt, esperaDesde: null } })
    emitirMsg(conv.id, m)
    await emitirConv(conv.id)
  } catch (err) { if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err }
}

export async function procesarWebhookCrm(cuerpo: Json, conexionId: string | null = null): Promise<void> {
  const fallas: string[] = []
  for (const entrada of Array.isArray(cuerpo?.entry) ? cuerpo.entry : []) {
    const espacio = await espacioDeEntrada(entrada, conexionId)
    if (!espacio) {
      // Cuenta o número que no es de ningún espacio del CRM (o la línea de Alma): solo queda en el registro.
      logger.info(`[CRM WA] aviso de la cuenta ${String(entrada?.id ?? '?')} fuera del CRM`)
      continue
    }
    await enEspacio(espacio, async () => {
      for (const cambio of Array.isArray(entrada?.changes) ? entrada.changes : []) {
        const v = obj(cambio?.value)
        try {
          if (cambio?.field === 'messages') {
            const pnid = String(v.metadata?.phone_number_id ?? '')
            const linea = pnid ? await prisma.crmLinea.findUnique({ where: { phoneNumberId: pnid } }) : null
            if (!linea) {
              // Número que no es del CRM (o la línea de Alma): solo queda en el registro.
              for (const s of v.statuses ?? []) logger.info(`[CRM WA] ${pnid} fuera del CRM: estado ${s.status} (${s.id})`)
              for (const m of v.messages ?? []) logger.info(`[CRM WA] ${pnid} fuera del CRM: mensaje ${m.type} de ${m.from}`)
              continue
            }
            for (const s of v.statuses ?? []) await procesarEstado(s).catch(e => { fallas.push(`estado ${s?.id}: ${(e as Error).message}`) })
            for (const m of v.messages ?? []) await procesarEntrante(linea, m, v.contacts ?? []).catch(e => { fallas.push(`mensaje ${m?.id}: ${(e as Error).message}`) })
          } else if (['message_template_status_update', 'message_template_quality_update', 'template_category_update'].includes(cambio?.field)) {
            olvidarPlantillas()
            emitirCrm({ tipo: 'plantillas' })
            if (cambio.field === 'message_template_status_update') await avisarPlantilla(v).catch(e => logger.warn(`[CRM WA] aviso de plantilla: ${(e as Error)?.message ?? e}`))
          } else if (cambio?.field === 'smb_message_echoes') {
            const pnid = String(v.metadata?.phone_number_id ?? '')
            const linea = pnid ? await prisma.crmLinea.findUnique({ where: { phoneNumberId: pnid }, select: { id: true } }) : null
            if (linea) for (const e of v.message_echoes ?? []) await procesarEcoWhatsapp(linea, e).catch(err => { fallas.push(`eco ${e?.id}: ${(err as Error).message}`) })
          } else if (cambio?.field === 'phone_number_quality_update') {
            await actualizarCalidad(v)
          } else {
            logger.info(`[CRM WA] aviso de Meta sin uso en el CRM: ${cambio?.field}`)
          }
        } catch (e) {
          fallas.push(`${cambio?.field}: ${(e as Error).message}`)
        }
      }
    })
  }
  if (fallas.length) {
    for (const f of fallas) logger.error(`[CRM WA] webhook ${f}`)
    throw new Error(fallas.join(' · ').slice(0, 900))
  }
}

// ─── Avisos guardados y reintentos ───────────────────────────────────────────

const MAX_INTENTOS = 5

/** Procesa un aviso guardado y deja su resultado en la fila. Nunca lanza. */
export async function procesarEventoGuardado(id: string): Promise<void> {
  const ev = await prisma.crmWebhookEvento.findUnique({ where: { id } })
  if (!ev || ev.estado === 'hecho') return
  try {
    const cuerpo = obj(ev.cuerpo)
    // Messenger e Instagram (objetos page e instagram), Telegram (update_id), TikTok (event) o WhatsApp.
    if (cuerpo.object === 'page' || cuerpo.object === 'instagram') await procesarWebhookPaginas(cuerpo, ev.conexionId)
    else if (cuerpo.update_id !== undefined) await procesarWebhookTelegram(cuerpo, ev.conexionId)
    else if (typeof cuerpo.event === 'string' && cuerpo.user_openid !== undefined) await procesarWebhookTiktok(cuerpo, ev.conexionId)
    else await procesarWebhookCrm(cuerpo, ev.conexionId)
    await prisma.crmWebhookEvento.update({ where: { id }, data: { estado: 'hecho', intentos: { increment: 1 }, error: null } })
  } catch (e) {
    const intentos = ev.intentos + 1
    await prisma.crmWebhookEvento.update({
      where: { id },
      data: { estado: intentos >= MAX_INTENTOS ? 'fallido' : 'pendiente', intentos, error: (e as Error).message.slice(0, 1000) },
    }).catch(e2 => logger.error(`[CRM WA] no se pudo anotar el fallo del aviso ${id}: ${(e2 as Error).message}`))
    if (intentos >= MAX_INTENTOS) logger.error(`[CRM WA] aviso ${id} no se pudo procesar después de ${MAX_INTENTOS} intentos: ${(e as Error).message}`)
  }
}

let reintentando = false
/** Cada minuto: los avisos pendientes de hace más de un minuto se vuelven a procesar. Los hechos se borran a los 7 días. */
export async function reintentarWebhooks(): Promise<number> {
  if (reintentando) return 0
  reintentando = true
  try {
    const pendientes = await prisma.crmWebhookEvento.findMany({
      where: { estado: 'pendiente', createdAt: { lt: new Date(Date.now() - 60_000) } },
      select: { id: true }, orderBy: { createdAt: 'asc' }, take: 50,
    })
    for (const p of pendientes) await procesarEventoGuardado(p.id)
    await prisma.crmWebhookEvento.deleteMany({ where: { estado: 'hecho', createdAt: { lt: new Date(Date.now() - 7 * 86_400_000) } } })
    return pendientes.length
  } finally {
    reintentando = false
  }
}

// ─── Correo (correo.ts) ──────────────────────────────────────────────────────

/**
 * Un correo que llegó al buzón conectado: el contacto por su dirección (o uno nuevo), la conversación
 * de ese buzón y el mismo camino que un WhatsApp (flujos, agente IA, reglas, reparto). El texto va
 * sin el correo anterior citado; los adjuntos quedan en la Nube. Las respuestas automáticas, los
 * boletines, los rebotes y lo que manda el propio buzón no abren conversación. Devuelve si entró.
 */
export async function procesarCorreoEntrante(cx: CrmConexion, c: import('./correo').CorreoEntrante): Promise<boolean> {
  if (c.propio || c.automatico || !c.de) return false
  const waId = `mail:${c.mid}`
  if (await prisma.crmMensaje.findFirst({ where: { waId }, select: { id: true } })) return false
  let k = await prisma.crmContacto.findFirst({ where: { correo: c.de }, orderBy: { createdAt: 'asc' } })
  if (!k) k = await prisma.crmContacto.create({ data: { nombre: c.nombre || null, correo: c.de, canal: 'mail', ficha: json({ origen: 'Correo' }) } })
  else if (!k.nombre && c.nombre) k = await prisma.crmContacto.update({ where: { id: k.id }, data: { nombre: c.nombre } })
  const lista: Json[] = [{ in: c.texto || '(Correo sin texto)', asunto: c.asunto }]
  for (const [i, a] of c.adjuntos.entries()) {
    const clase: ClaseMedia = a.mime.startsWith('image/') ? 'image' : 'document'
    try {
      const url = await subirMedia(a.buffer, a.mime, clase, `mail-${c.mid.replace(/\W/g, '').slice(-10)}-${i}`, a.nombre)
      lista.push(clase === 'image' ? { in: { img: url, cap: a.nombre } } : { in: { doc: url, n: a.nombre } })
    } catch (e) {
      lista.push({ in: `Llegó el adjunto «${a.nombre}», pero no se pudo guardar: ${(e as Error).message}` })
    }
  }
  const refs = [...c.refs, c.mid].filter(Boolean).slice(-10)
  await entrar(k, { pagina: cx, canal: 'mail' }, lista, waId, c.fecha, `correo ${cx.nombre}`, { asunto: c.asunto, mailMid: c.mid, mailRefs: refs })
  return true
}

