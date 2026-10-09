import crypto from 'crypto'
import { Prisma, type CrmContacto, type CrmEnlace } from '@prisma/client'
import { prisma, prismaGlobal } from './bd'
import { enEspacio } from './espacio'
import { NotFoundError, ValidationError } from '../../utils/errors'
import { logger } from '../../utils/logger'

/**
 * Enlaces de pauta.
 *
 * Meta dice solo de qué anuncio llega cada persona (entrantes.ts, `referral`). Google, TikTok y el
 * resto no: para ellos, un enlace del CRM que registra cada clic con lo que la plataforma pone sola
 * en la dirección (campaña, grupo, anuncio, gclid, ttclid…) y lleva a WhatsApp con el mensaje
 * escrito y un código corto de ese clic. Cuando la persona escribe, `pautaPorCodigo` encuentra el
 * clic y deja la pauta en el contacto. El de la página web (plataforma `web`, pauta.js) hace lo
 * mismo con los botones de WhatsApp de cualquier página, respetando su número y su texto.
 * Guía: docs/crm/enlaces-pauta.md.
 */

type Json = Record<string, any>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})
const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const json = (v: unknown) => v as Prisma.InputJsonValue

export const PLATAFORMAS = ['google', 'tiktok', 'meta', 'otro'] as const
const NOMBRE: Record<string, string> = { google: 'Google', tiktok: 'TikTok', meta: 'Meta', otro: 'Otro', web: 'Página web' }

/** Sin I, O, 0 ni 1: el código se lee en un mensaje y a veces se copia a mano. */
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function azar(n: number, alfabeto = LETRAS) {
  const b = crypto.randomBytes(n)
  return Array.from(b, x => alfabeto[x % alfabeto.length]).join('')
}
const nuevoCodigoEnlace = () => azar(7, 'abcdefghjkmnpqrstuvwxyz23456789')
const nuevaRef = () => azar(5)

/** El código del clic en el mensaje: «(código K7Q2P)». También si la persona lo escribe en minúsculas o sin tilde. */
const REF_EN_TEXTO = /c[oó]digo[\s:#-]*([a-hj-np-z2-9]{5})\b/i
export const refDeTexto = (texto: string): string | null => {
  const m = REF_EN_TEXTO.exec(texto || '')
  return m ? m[1].toUpperCase() : null
}
export const mensajeConRef = (mensaje: string, ref: string) => `${mensaje.trim()} (código ${ref})`

/** Lo que las plataformas ponen en la dirección. Si una plataforma no reemplazó su parámetro, no sirve. */
const CLAVE_PARAM = /^[a-z0-9_]{1,40}$/
const SIN_REEMPLAZAR = /^(\{+[^}]*\}+|__[A-Z_]+__)$/
const DE_PAGO = ['gclid', 'gbraid', 'wbraid', 'ttclid', 'fbclid', 'msclkid']
const QUITAR = new Set(['to', 'text'])
export function paramsDe(query: Json): Json {
  const p: Json = {}
  for (const [k, v] of Object.entries(query)) {
    const c = k.toLowerCase()
    if (QUITAR.has(c) || !CLAVE_PARAM.test(c) || Object.keys(p).length >= 25) continue
    const valor = txt(Array.isArray(v) ? v[0] : v).slice(0, 300)
    if (valor && !SIN_REEMPLAZAR.test(valor)) p[c] = valor
  }
  return p
}
/** ¿Trae algo de una campaña? En el botón de la página web, sin esto no es pauta: es una visita. */
export const vieneDeCampana = (p: Json) => DE_PAGO.some(k => p[k]) || !!p.utm_source || !!p.utm_campaign

/** La plataforma de un clic de la página web: la que dejó su marca en la dirección. */
function plataformaDeParams(p: Json): string {
  if (p.gclid || p.gbraid || p.wbraid || p.gad_source) return 'Google'
  if (p.ttclid) return 'TikTok'
  if (p.fbclid) return 'Meta'
  if (p.msclkid) return 'Microsoft'
  const s = txt(p.utm_source).toLowerCase()
  if (/google|adwords|youtube/.test(s)) return 'Google'
  if (/tiktok/.test(s)) return 'TikTok'
  if (/facebook|instagram|meta|\bfb\b|\big\b/.test(s)) return 'Meta'
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Página web'
}

/** La pauta que queda en el contacto (la misma forma que la de Meta, más lo del clic). */
export function pautaDeClic(e: Pick<CrmEnlace, 'nombre' | 'plataforma'>, ref: string, p: Json) {
  const plataforma = e.plataforma === 'web' || e.plataforma === 'otro' ? plataformaDeParams(p) : NOMBRE[e.plataforma] ?? 'Pauta'
  return {
    plataforma: plataforma === 'Página web' && e.plataforma === 'otro' ? 'Otro' : plataforma,
    campana: txt(p.utm_campaign) || txt(p.campaign_name) || txt(p.campaign) || txt(p.campaign_id) || txt(p.gad_campaignid) || e.nombre,
    conjunto: txt(p.adgroup) || txt(p.adset) || txt(p.adgroup_name) || txt(p.adgroup_id) || null,
    anuncio: txt(p.utm_content) || txt(p.ad) || txt(p.ad_name) || txt(p.ad_id) || txt(p.creative) || null,
    termino: txt(p.utm_term) || txt(p.keyword) || null,
    formato: null,
    como: e.plataforma === 'web' ? 'Botón de WhatsApp de la página web' : `Enlace de pauta «${e.nombre}»`,
    enlace: e.nombre,
    idClic: ref,
    ...(p.gclid ? { gclid: p.gclid } : {}), ...(p.ttclid ? { ttclid: p.ttclid } : {}), ...(p.fbclid ? { fbclid: p.fbclid } : {}),
  }
}

// ─── Lo que ve y maneja el líder ────────────────────────────────────────────

const DIAS_RESUMEN = 30

/** El enlace de la página web del espacio: uno solo, se crea la primera vez que se pide. */
export async function enlaceWeb(): Promise<CrmEnlace> {
  const ya = await prisma.crmEnlace.findFirst({ where: { plataforma: 'web' } })
  if (ya) return ya
  for (let i = 0; i < 5; i++) {
    try {
      return await prisma.crmEnlace.create({ data: { codigo: nuevoCodigoEnlace(), nombre: 'Página web', plataforma: 'web', mensaje: '' } })
    } catch (e) {
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e
    }
  }
  throw new Error('No se pudo crear el enlace de la página web')
}

/** Los enlaces del espacio con sus clics y sus conversaciones de los últimos 30 días. */
export async function listarEnlaces() {
  const web = await enlaceWeb()
  const enlaces = await prisma.crmEnlace.findMany({ orderBy: { createdAt: 'desc' } })
  const desde = new Date(Date.now() - DIAS_RESUMEN * 86_400_000)
  const [clics, atribuidos] = await Promise.all([
    prisma.crmClic.groupBy({ by: ['enlaceId'], where: { createdAt: { gte: desde } }, _count: { _all: true } }),
    prisma.crmClic.groupBy({ by: ['enlaceId'], where: { createdAt: { gte: desde }, contactoId: { not: null } }, _count: { _all: true } }),
  ])
  const n = (lista: { enlaceId: string; _count: { _all: number } }[], id: string) => lista.find(x => x.enlaceId === id)?._count._all ?? 0
  const aFront = (e: CrmEnlace) => ({
    id: e.id, codigo: e.codigo, nombre: e.nombre, plataforma: e.plataforma, lineaId: e.lineaId, mensaje: e.mensaje,
    creado: e.createdAt, clics: n(clics, e.id), conversaciones: n(atribuidos, e.id),
  })
  return { enlaces: enlaces.filter(e => e.plataforma !== 'web').map(aFront), web: aFront(web), dias: DIAS_RESUMEN }
}

function validar(entrada: Json, parcial: boolean) {
  const d: Json = {}
  if (!parcial || entrada.nombre !== undefined) {
    const nombre = txt(entrada.nombre)
    if (nombre.length < 2 || nombre.length > 80) throw new ValidationError('Ponle un nombre al enlace (entre 2 y 80 letras), por ejemplo «TikTok octubre».')
    d.nombre = nombre
  }
  if (!parcial || entrada.plataforma !== undefined) {
    if (!PLATAFORMAS.includes(entrada.plataforma)) throw new ValidationError('Elige dónde lo vas a usar: Google Ads, TikTok Ads, Meta Ads u otro lugar.')
    d.plataforma = entrada.plataforma
  }
  if (!parcial || entrada.mensaje !== undefined) {
    const mensaje = txt(entrada.mensaje) || 'Hola, quiero más información'
    if (mensaje.length > 300) throw new ValidationError('El mensaje que llega escrito puede tener hasta 300 letras.')
    d.mensaje = mensaje
  }
  if (!parcial || entrada.lineaId !== undefined) d.lineaId = txt(entrada.lineaId) || null
  return d
}

async function exigirLinea(lineaId: string | null) {
  if (!lineaId) throw new ValidationError('Elige la línea de WhatsApp a la que lleva el enlace.')
  const l = await prisma.crmLinea.findUnique({ where: { id: lineaId }, select: { id: true } })
  if (!l) throw new ValidationError('Esa línea de WhatsApp ya no está conectada: elige otra.')
}

export async function crearEnlace(entrada: Json, por: string | null) {
  const d = validar(entrada, false)
  await exigirLinea(d.lineaId)
  for (let i = 0; i < 5; i++) {
    try {
      const e = await prisma.crmEnlace.create({ data: { codigo: nuevoCodigoEnlace(), nombre: d.nombre, plataforma: d.plataforma, lineaId: d.lineaId, mensaje: d.mensaje, creadoPor: por } })
      return { id: e.id, codigo: e.codigo }
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err
    }
  }
  throw new Error('No se pudo crear el enlace')
}

export async function editarEnlace(id: string, entrada: Json) {
  const e = await prisma.crmEnlace.findUnique({ where: { id } })
  if (!e || e.plataforma === 'web') throw new NotFoundError('Ese enlace ya no existe')
  const d = validar(entrada, true)
  if (d.lineaId !== undefined) await exigirLinea(d.lineaId)
  await prisma.crmEnlace.update({ where: { id }, data: d })
}

/** Borrar un enlace deja de registrar sus clics; las personas ya atribuidas conservan su pauta. */
export async function borrarEnlace(id: string) {
  const e = await prisma.crmEnlace.findUnique({ where: { id } })
  if (!e || e.plataforma === 'web') throw new NotFoundError('Ese enlace ya no existe')
  await prisma.crmEnlace.delete({ where: { id } })
}

// ─── El clic (público) ──────────────────────────────────────────────────────

/** Los que revisan anuncios y los que arman vistas previas no son personas: van a WhatsApp sin contar. */
const BOT = /bot\b|crawler|spider|facebookexternalhit|facebot|adsbot|mediapartners|apis-google|google-adwords|bytespider|tiktok.*(ads|spider)|whatsapp|telegram|slack|discord|linkedin|twitter|headless|preview|curl|wget|python-requests/i
const TREINTA_MIN = 30 * 60_000
const telDe = (t: string) => t.replace(/\D/g, '')

export class EnlaceNoExiste extends Error {}

/**
 * Un clic en /w/<codigo>: queda registrado (si viene de una persona) y devuelve la dirección de
 * WhatsApp a la que se manda, con el mensaje y el código del clic. Dos toques seguidos de la misma
 * persona en 30 minutos son el mismo clic.
 */
export async function registrarClic(codigo: string, query: Json, visita: { ip: string; ua: string; referer: string; contar?: boolean }): Promise<string> {
  if (!/^[a-z2-9]{7}$/.test(codigo)) throw new EnlaceNoExiste()
  const e = await prismaGlobal.crmEnlace.findUnique({ where: { codigo } })
  if (!e) throw new EnlaceNoExiste()
  return enEspacio(e.espacioId, async () => {
    // A dónde: la línea del enlace; el de la página web, al número y con el texto del botón de la página.
    const aLinea = async () => {
      const l = e.lineaId ? await prisma.crmLinea.findUnique({ where: { id: e.lineaId }, select: { telefono: true } }) : null
      return telDe(l?.telefono ?? '') || telDe((await prisma.crmLinea.findFirst({ orderBy: { createdAt: 'asc' }, select: { telefono: true } }))?.telefono ?? '')
    }
    const pedido = telDe(txt(query.to))
    const tel = e.plataforma === 'web' && pedido.length >= 7 && pedido.length <= 15 ? pedido : await aLinea()
    if (!tel) throw new EnlaceNoExiste()
    const mensaje = (e.plataforma === 'web' ? txt(query.text).slice(0, 500) : '') || e.mensaje || 'Hola, quiero más información'
    const wa = (texto: string) => `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`

    const p = paramsDe(query)
    if (visita.contar === false || BOT.test(visita.ua) || !visita.ua) return wa(mensaje)
    if (e.plataforma === 'web' && !vieneDeCampana(p)) return wa(mensaje) // una visita de la página, no un anuncio

    const huella = crypto.createHash('sha256').update(`${visita.ip}|${visita.ua}|${e.id}`).digest('hex').slice(0, 32)
    const reciente = await prisma.crmClic.findFirst({ where: { enlaceId: e.id, huella, contactoId: null, createdAt: { gte: new Date(Date.now() - TREINTA_MIN) } }, orderBy: { createdAt: 'desc' } })
    if (reciente) return wa(mensajeConRef(mensaje, reciente.ref))
    for (let i = 0; i < 5; i++) {
      const ref = nuevaRef()
      try {
        await prisma.crmClic.create({ data: { enlaceId: e.id, ref, params: json(p), huella, referer: visita.referer.slice(0, 300) || null } })
        return wa(mensajeConRef(mensaje, ref))
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err
      }
    }
    logger.warn(`[CRM pauta] no se pudo registrar un clic de ${e.codigo}`)
    return wa(mensaje)
  })
}

// ─── Cuando la persona escribe ──────────────────────────────────────────────

const fechaCorta = (d: Date) => {
  const b = new Date(d.getTime() - 5 * 3600_000)
  return `${b.getUTCDate()}-${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][b.getUTCMonth()]}`
}

/**
 * Si el mensaje trae el código de un clic de este espacio, la persona queda atribuida a ese clic:
 * su pauta (plataforma, campaña, grupo, anuncio) y su origen. Si ya venía de otro lado, lo anterior
 * pasa a «previas», como con los anuncios de Meta. Devuelve el contacto como quedó.
 */
export async function pautaPorCodigo(k: CrmContacto, texto: string, conversacionId: number | null): Promise<CrmContacto> {
  const ref = refDeTexto(texto)
  if (!ref) return k
  const clic = await prisma.crmClic.findUnique({ where: { ref }, include: { enlace: { select: { nombre: true, plataforma: true } } } })
  if (!clic) return k
  if (obj(k.pauta).idClic === ref) return k
  const pauta = pautaDeClic(clic.enlace, ref, obj(clic.params))
  const ficha = obj(k.ficha)
  const previas = Array.isArray(ficha.previas) ? [...ficha.previas] : []
  const origen = `Anuncio de ${pauta.plataforma}`
  if (ficha.origen && ficha.origen !== origen) previas.push([ficha.origen, fechaCorta(k.createdAt)])
  const nuevo = await prisma.crmContacto.update({ where: { id: k.id }, data: { pauta: json(pauta), ficha: json({ ...ficha, origen, previas }) } })
  // El clic queda de la primera persona que escribió con él (un mensaje reenviado no se lo quita).
  if (!clic.contactoId) {
    await prisma.crmClic.update({ where: { id: clic.id }, data: { contactoId: k.id, conversacionId, atribuidoEn: new Date() } })
  }
  return nuevo
}
