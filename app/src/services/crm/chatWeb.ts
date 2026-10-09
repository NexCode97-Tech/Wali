import crypto from 'crypto'
import { Prisma, type CrmContacto } from '@prisma/client'
import { prisma } from './bd'
import { ForbiddenError, ValidationError } from '../../utils/errors'
import { leerAjuste } from './ajustes'
import { dentroDeHorario, deVisitante, procesarEntranteWeb } from './entrantes'
import { telDigitos } from './formas'
import { emitirMsg } from './tiempoReal'
import { idDeOpcion } from './whatsapp'
import { espacioActual } from './espacio'
import { prismaGlobal } from './bd'

/**
 * Chat de la página web (26-sep-2026). La burbuja `chat.js` (web/src/app/chat.js) vive en
 * cualquier página de la empresa y habla con estas funciones por /api/crm/web, sin sesión de
 * la plataforma:
 *  - La persona recibe un token firmado con un id de navegador al azar (`v`) y lo que haya
 *    escrito en el formulario (nombre, WhatsApp, correo). No se guarda nada hasta que escribe.
 *  - Con el primer mensaje se busca el contacto por su WhatsApp (o se crea) y la conversación
 *    queda marcada con ese navegador (`extra.webVisitante`). El token solo lee las
 *    conversaciones de su navegador, nunca las de todo el contacto: quien escriba el número de
 *    otra persona no ve lo que esa persona habló.
 *  - Lo que el equipo, un flujo o el agente IA le contestan queda «enviado» al guardarse
 *    (whatsapp.ts) y la burbuja lo trae al preguntar; al traerlo pasa a entregado o leído.
 * El canal se prende en Ajustes del CRM, Chat de la página web (`cfg.web.on`).
 */

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})
const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

const VIDA_TOKEN = 180 * 86_400_000
const secreto = () => process.env.CRM_WEB_SECRET || crypto.createHash('sha256').update(`${process.env.AUTH_SECRET ?? ''}:crm-web`).digest('hex')

export interface TokenWeb {
  /** Id del navegador, al azar. */
  v: string
  /** Espacio de trabajo del chat. Si el token no lo trae, es el espacio por defecto. */
  e?: string
  /** Lo que escribió en el formulario de la burbuja. */
  n?: string; tel?: string; c?: string
  /** Página desde donde abrió el chat. */
  p?: string
  /** Cuándo se emitió (ms). */
  t: number
  /** Cuándo aceptó el aviso de datos al enviar el formulario (ms) y qué política tenía enlazada la empresa. */
  a?: number; pol?: string
}

const firma = (cuerpo: string) => crypto.createHmac('sha256', secreto()).update(cuerpo).digest('base64url')

function firmarToken(d: TokenWeb): string {
  const cuerpo = Buffer.from(JSON.stringify(d)).toString('base64url')
  return `${cuerpo}.${firma(cuerpo)}`
}

export function leerToken(token: string | undefined): TokenWeb | null {
  const [cuerpo, f] = String(token ?? '').split('.')
  if (!cuerpo || !f) return null
  const esperada = Buffer.from(firma(cuerpo)), dada = Buffer.from(f)
  if (esperada.length !== dada.length || !crypto.timingSafeEqual(esperada, dada)) return null
  try {
    const d = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8')) as TokenWeb
    if (!/^[a-f0-9]{32}$/.test(String(d.v)) || typeof d.t !== 'number' || Date.now() - d.t > VIDA_TOKEN) return null
    return d
  } catch {
    return null
  }
}

async function cfgWeb() {
  const cfg = obj(await leerAjuste('cfg'))
  const w = obj(cfg.web)
  const abierto = Array.isArray(cfg.horario) ? dentroDeHorario(cfg.horario, new Date(), cfg.festivos !== false) : true
  return { cfg, w, abierto }
}

/** Lo que la burbuja necesita para pintarse. Apagado, solo `{on:false}`. */
export async function configWeb() {
  const { cfg, w, abierto } = await cfgWeb()
  if (w.on !== true) return { on: false }
  return {
    on: true,
    nombre: await nombreDelEspacio(),
    color: /^#[0-9a-f]{3,8}$/i.test(txt(w.color)) ? txt(w.color) : '#1f93ff',
    saludo: txt(w.saludo) || '¡Hola! ¿En qué te ayudamos?',
    pedir: w.pedir !== false,
    // «Mostrar solo en horario de atención»: fuera de horario la burbuja es un formulario para dejar el mensaje.
    soloFormulario: w.horario === true && !abierto,
    fuera: txt(cfg.fuera) || 'Estamos fuera de horario. Te respondemos apenas abramos.',
    privacidad: politicaWeb(w),
  }
}

/** La política de datos de la empresa (Ley 1581), si la configuró: solo una dirección https. */
function politicaWeb(w: Json): string {
  try { const u = new URL(txt(w.privacidad)); return u.protocol === 'https:' ? u.href.slice(0, 300) : '' } catch { return '' }
}

/** El nombre que ve la persona arriba de la burbuja: el de la empresa dueña del espacio. */
async function nombreDelEspacio() {
  const e = await prismaGlobal.crmEspacio.findUnique({ where: { id: espacioActual() }, select: { nombre: true } })
  return e?.nombre ?? ''
}

const recortar = (s: unknown, n: number) => txt(s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').slice(0, n)
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** POST /crm/web/sesion: valida el formulario y devuelve el token. No guarda nada todavía. */
export async function abrirSesionWeb(entrada: Json): Promise<{ token: string }> {
  const { w } = await cfgWeb()
  if (w.on !== true) throw new ForbiddenError('El chat de la página web está apagado.')
  const nombre = recortar(entrada.nombre, 80)
  const telCrudo = recortar(entrada.tel, 30)
  const tel = telDigitos(telCrudo)
  const correo = recortar(entrada.correo, 120).toLowerCase()
  if (w.pedir !== false) {
    if (nombre.split(' ').filter(Boolean).length < 2) throw new ValidationError('Escribe tu nombre y tu apellido.')
    if (!tel || tel.length < 10) throw new ValidationError('Escribe tu número de WhatsApp completo.')
  }
  if (telCrudo && (!tel || tel.length < 10 || tel.length > 15)) throw new ValidationError('Ese número de WhatsApp no está completo.')
  if (correo && !CORREO.test(correo)) throw new ValidationError('Ese correo no parece completo.')
  let pagina = ''
  try { const u = new URL(txt(entrada.pagina)); if (/^https?:$/.test(u.protocol)) pagina = `${u.origin}${u.pathname}`.slice(0, 300) } catch { /* sin página */ }
  const d: TokenWeb = { v: crypto.randomBytes(16).toString('hex'), e: espacioActual(), t: Date.now(), ...(nombre ? { n: nombre } : {}), ...(tel ? { tel } : {}), ...(correo ? { c: correo } : {}), ...(pagina ? { p: pagina } : {}), a: Date.now(), ...(politicaWeb(w) ? { pol: politicaWeb(w) } : {}) }
  return { token: firmarToken(d) }
}

/** El contacto de este navegador: el de su conversación, el de su WhatsApp o uno nuevo. */
async function contactoWeb(d: TokenWeb): Promise<CrmContacto> {
  const conv = await prisma.crmConversacion.findFirst({ where: deVisitante(d.v), orderBy: { createdAt: 'desc' }, include: { contacto: true } })
  if (conv) return conv.contacto
  // Prueba de la autorización (Ley 1581): enviar el formulario con el aviso a la vista es una conducta inequívoca.
  const autorizacion = d.a ? { fecha: new Date(d.a).toISOString(), medio: 'Chat de la web', ...(d.p ? { pagina: d.p } : {}), ...(d.pol ? { politica: d.pol } : {}) } : null
  const ficha = { origen: 'Chat de la web', ...(d.p ? { pagina: d.p } : {}), ...(d.c ? { correo: d.c } : {}), ...(autorizacion ? { autorizacion } : {}) }
  if (d.tel) {
    const k = await prisma.crmContacto.findFirst({ where: { telefono: d.tel } })
    if (k) {
      // Ya existía: solo se completa lo que falte; nunca se pisa lo que el equipo guardó.
      const cambios: Prisma.CrmContactoUpdateInput = {}
      if (!k.nombre && d.n) cambios.nombre = d.n
      if (!k.correo && d.c) cambios.correo = d.c
      const fk = (k.ficha && typeof k.ficha === 'object' && !Array.isArray(k.ficha) ? k.ficha : {}) as Record<string, unknown>
      if (autorizacion && !fk.autorizacion) cambios.ficha = { ...fk, autorizacion } as Prisma.InputJsonValue
      return Object.keys(cambios).length ? prisma.crmContacto.update({ where: { id: k.id }, data: cambios }) : k
    }
  }
  try {
    return await prisma.crmContacto.create({
      data: { nombre: d.n || null, telefono: d.tel || null, correo: d.c || null, canal: 'web', ficha: ficha as Prisma.InputJsonValue },
    })
  } catch (e) {
    if (d.tel && e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      const k = await prisma.crmContacto.findFirst({ where: { telefono: d.tel } })
      if (k) return k
    }
    throw e
  }
}

/** POST /crm/web/mensajes: lo que escribe la persona en la burbuja. */
export async function mensajeWeb(d: TokenWeb, entrada: Json): Promise<{ id: string | null }> {
  const { w } = await cfgWeb()
  if (w.on !== true) throw new ForbiddenError('El chat de la página web está apagado.')
  const texto = txt(entrada.texto).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').slice(0, 2000)
  if (!texto) throw new ValidationError('Escribe el mensaje antes de enviarlo.')
  const cid = /^[\w-]{1,64}$/.test(txt(entrada.cid)) ? txt(entrada.cid) : null
  const respuestaId = /^[\w.-]{1,200}$/.test(txt(entrada.respuestaId)) ? txt(entrada.respuestaId) : null
  const k = await contactoWeb(d)
  return { id: await procesarEntranteWeb(k, d.v, texto, cid, respuestaId) }
}

const VISIBLES = ['in', 'out', 'bot', 'ia', 'recepcion'] as const
const primerNombre = (s: unknown) => txt(s).split(/\s+/)[0] || ''
const httpsOk = (u: unknown) => (/^https:\/\//i.test(txt(u)) ? txt(u) : '')

/** Un mensaje como lo ve la persona en la burbuja; lo interno (notas, eventos, programados) no sale. */
function paraVisitante(m: { id: string; tipo: string; datos: unknown; createdAt: Date; estado: string | null }) {
  const d = obj(m.datos)
  const base = { id: m.id, t: m.createdAt.toISOString() }
  if (m.tipo === 'in') return { ...base, de: 'yo', texto: typeof d.in === 'string' ? d.in : '' }
  if (m.tipo === 'out') {
    if (m.estado === 'fallido') return null
    const link = obj(d.link), file = obj(d.file), audio = obj(d.audio)
    return {
      ...base, de: 'equipo', por: primerNombre(d.by), texto: txt(d.out),
      ...(httpsOk(link.url) ? { enlace: { url: httpsOk(link.url), t: txt(link.p) || 'Abrir enlace' } } : {}),
      ...(httpsOk(file.url) ? { archivo: { url: httpsOk(file.url), n: txt(file.n) || 'Archivo', mime: txt(file.mime) } } : {}),
      ...(httpsOk(audio.url) ? { audio: httpsOk(audio.url) } : {}),
    }
  }
  if (m.tipo === 'bot') {
    const botones = (Array.isArray(d.botones) ? d.botones : []).map((b, i) => {
      const t = typeof b === 'string' ? b : txt(obj(b).t)
      return t ? { t, id: idDeOpcion(i, t) } : null
    }).filter(Boolean)
    const lista = obj(d.lista)
    const filas = (Array.isArray(lista.ops) ? lista.ops : []).map((o, i) => {
      const t = typeof o === 'string' ? o : txt(obj(o).t)
      return t ? { t, d: typeof o === 'string' ? '' : txt(obj(o).d), id: (typeof o === 'string' ? '' : txt(obj(o).id)) || idDeOpcion(i, t) } : null
    }).filter(Boolean)
    return { ...base, de: 'bot', texto: txt(d.bot), ...(botones.length ? { botones } : {}), ...(filas.length ? { lista: { boton: txt(lista.boton) || 'Ver opciones', ops: filas } } : {}) }
  }
  return { ...base, de: 'bot', por: m.tipo === 'ia' ? txt(d.agente) : '', texto: txt(d.ia) || txt(d.recepcion) }
}

/**
 * GET /crm/web/mensajes: lo de las conversaciones de este navegador, desde `desde` (ISO).
 * Lo que el equipo mandó y la burbuja ya trajo pasa a entregado; con `visto`, a leído.
 */
export async function mensajesWeb(d: TokenWeb, desde: string | undefined, visto: boolean) {
  const t = desde ? new Date(desde) : null
  const filas = await prisma.crmMensaje.findMany({
    where: { conversacion: deVisitante(d.v), tipo: { in: [...VISIBLES] }, ...(t && !Number.isNaN(t.getTime()) ? { createdAt: { gt: t } } : {}) },
    orderBy: { createdAt: 'asc' },
    take: 200,
    select: { id: true, tipo: true, datos: true, createdAt: true, estado: true, conversacionId: true },
  })
  const nuevoEstado = visto ? 'leido' : 'entregado'
  const pendientes = await prisma.crmMensaje.findMany({
    where: { conversacion: deVisitante(d.v), tipo: { in: ['out', 'bot', 'ia', 'recepcion'] }, estado: { in: visto ? ['enviado', 'entregado'] : ['enviado'] } },
    select: { id: true },
  })
  if (pendientes.length) {
    await prisma.crmMensaje.updateMany({ where: { id: { in: pendientes.map(p => p.id) } }, data: { estado: nuevoEstado } })
    const cambiados = await prisma.crmMensaje.findMany({ where: { id: { in: pendientes.map(p => p.id) } } })
    for (const m of cambiados) emitirMsg(m.conversacionId, m)
  }
  return {
    mensajes: filas.map(paraVisitante).filter(Boolean),
    ahora: new Date().toISOString(),
    nombre: d.n ? primerNombre(d.n) : '',
  }
}
