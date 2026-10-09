import type { Request } from 'express'
import type { Prisma } from '@prisma/client'
import { v2 as cloudinary } from 'cloudinary'
import { prisma } from '../../services/crm/bd'
import { ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors'
import { configura } from '../../utils/roles'
import { alcanceDe, equipoDeConv, equiposDeReq, genteQueLidera, lideraConv, reservadaPara, veConv, veContactoEn, type Alcance } from '../../services/crm/alcance'

/** Piezas que comparten los controladores del CRM (docs/crm/api-core.md). */

export type Json = Record<string, unknown>
export const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})
export const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/**
 * La configuración general del CRM (ajustes que no son `equipos`, agentes, líneas, canales, plantillas,
 * difusiones, enlaces de pauta, integraciones, importar contactos): rol ADMIN o LIDER_VENTAS de la plataforma,
 * como siempre. Qué conversaciones ve cada quien ya no sale de aquí sino de su rol en los equipos (alcance.ts).
 */
export const esLider = (req: Request) => configura(req.userRole)

/** Visitante de solo lectura: el middleware ya lo frena, esto es la segunda red. */
export function exigirEscritura(req: Request) {
  if (req.soloLectura) throw new ForbiddenError('Modo de solo lectura: puedes ver todo, pero no hacer cambios.')
}

export function exigirLider(req: Request, que: string) {
  if (!esLider(req)) throw new ForbiddenError(`Solo los administradores y líderes pueden ${que}. Pídeselo a tu líder.`)
}

export function idNum(v: unknown, que = 'la conversación'): number {
  const n = Number(v)
  if (!Number.isInteger(n) || n <= 0) throw new ValidationError(`El número de ${que} no es válido.`)
  return n
}

/** Las conversaciones finalizadas hace más de esto no viajan en /inicio: su contacto sale como contacto suelto. */
export const DIAS_FINALIZADAS = 60
/** Lo que /inicio considera conversación vigente (no finalizada, o finalizada hace menos de DIAS_FINALIZADAS). */
export const convVigente = (): Prisma.CrmConversacionWhereInput => ({
  OR: [{ estado: { not: 'finalizadas' } }, { finalizadaAt: { gte: new Date(Date.now() - DIAS_FINALIZADAS * 86_400_000) } }],
})

/** Un contacto con una conversación «solo líder» de un equipo que la persona no lidera. */
export const mensajeReservado = (equipo: string) => `Este contacto tiene una conversación reservada para los líderes de ${equipo}. Pídele a tu líder que lo haga.`

/** Por qué no ve una conversación (alcance.ts, veConv). */
export function motivoNoVe(a: Alcance, c: { equipo: string | null; asignadoId: string | null; soloLider?: boolean }): string {
  const equipo = equipoDeConv(c)
  if (c.soloLider && (c.asignadoId === a.userId || a.equipos.includes(equipo))) return `Esta conversación es solo para los líderes de ${equipo}.`
  if (a.equipos.includes(equipo)) return 'Esta conversación no está asignada a ti. Pídele a tu líder que te la pase.'
  return 'Esta conversación es de otro equipo.'
}

/** 403 si no la ve (con la fila leída en ese instante, por ejemplo bloqueada dentro de una transacción). */
export function exigirVerConv(a: Alcance, c: { equipo: string | null; asignadoId: string | null; soloLider?: boolean }) {
  if (!veConv(a, c)) throw new ForbiddenError(motivoNoVe(a, c))
}

/**
 * La conversación, si existe y la persona puede verla (alcance.ts): el administrador sin equipo, todas; el
 * líder, las de su equipo; los demás, solo las que tienen asignadas (y no «solo líder»).
 */
export async function convVisible(req: Request, id: number) {
  const c = await prisma.crmConversacion.findUnique({ where: { id }, include: { contacto: true } })
  if (!c) throw new NotFoundError('Esa conversación ya no existe. Recarga la bandeja.')
  exigirVerConv(await alcanceDe(req), c)
  return c
}

/**
 * El contacto, si existe y la persona puede tocarlo: no, si tiene una conversación «solo líder» de un equipo que
 * no lidera; sí, si es su dueño, si ve alguna de sus conversaciones o si el dueño es gente de un equipo que
 * lidera (alcance.ts, veContacto). En /inicio tampoco le llega.
 */
export async function contactoVisible(req: Request, id: number) {
  const fila = await prisma.crmContacto.findUnique({ where: { id }, include: { conversaciones: { select: { equipo: true, asignadoId: true, soloLider: true } } } })
  if (!fila) throw new NotFoundError('Ese contacto ya no existe. Recarga Contactos.')
  const { conversaciones, ...k } = fila
  const a = await alcanceDe(req)
  if (a.todo) return k
  const reservada = conversaciones.find(c => reservadaPara(a, c))
  if (reservada) throw new ForbiddenError(mensajeReservado(equipoDeConv(reservada)))
  if (!veContactoEn(a, k, conversaciones, genteQueLidera(a, await equiposDeReq(req)))) throw new ForbiddenError('Este contacto es de otro equipo.')
  return k
}

/**
 * Borrar el contacto o sus datos (Ley 1581) se lleva todas sus conversaciones: solo quien las ve todas.
 */
export async function exigirContactoCompleto(req: Request, contactoId: number) {
  const a = await alcanceDe(req)
  if (a.todo) return
  const convs = await prisma.crmConversacion.findMany({ where: { contactoId }, select: { equipo: true, asignadoId: true, soloLider: true } })
  if (convs.some(c => !veConv(a, c))) throw new ForbiddenError('Este contacto tiene conversaciones de otro equipo. Pídele a un administrador que borre sus datos.')
}

/** Lo que solo hace el líder del equipo de la conversación o un administrador sin equipo. */
export async function exigirLiderDeConv(req: Request, c: { equipo: string | null }, que: string) {
  if (!lideraConv(await alcanceDe(req), c)) throw new ForbiddenError(`Solo el líder de ${equipoDeConv(c)} o un administrador puede ${que}.`)
}

/**
 * Administrar equipos (buscar y ver personas para agregarlas): la configuración general, el administrador sin
 * equipo o quien lidera algún equipo.
 */
export async function exigirAdminEquipos(req: Request, que: string) {
  const a = await alcanceDe(req)
  if (!a.config && !a.todo && !a.lidera.length) throw new ForbiddenError(`Solo los líderes de cada equipo y los administradores pueden ${que}. Pídeselo a tu líder.`)
}

const esObjeto = (v: unknown): v is Json => !!v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date)
const PROHIBIDAS = new Set(['__proto__', 'constructor', 'prototype'])

/**
 * Mezcla `cambios` sobre lo guardado, subclave por subclave y hacia adentro:
 * un objeto se mezcla con el que ya había, `null` borra esa subclave y lo
 * demás (textos, números, listas) reemplaza. Así dos personas que cambian
 * subclaves distintas de `ficha` o `campos` no se pisan.
 * `nulosBorran: false` guarda los null del primer nivel (en `extra`, un null
 * es un valor que las otras pantallas tienen que recibir para limpiar el suyo).
 */
export function mezclaProfunda(base: unknown, cambios: unknown, nulosBorran = true, nivel = 0): Json {
  const out: Json = { ...obj(base) }
  for (const [k, v] of Object.entries(obj(cambios))) {
    if (PROHIBIDAS.has(k)) continue
    if (v === undefined) continue
    if (v === null) { if (nulosBorran || nivel > 0) delete out[k]; else out[k] = null; continue }
    const antes = out[k]
    out[k] = esObjeto(v) && esObjeto(antes) && nivel < 6 ? mezclaProfunda(antes, v, true, nivel + 1) : v
  }
  return out
}

/** 2.516.582 → «2,4 MB»; 245.000 → «239 KB». */
export function tamanoLegible(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

/** Carpeta de la nube de archivos donde quedan los adjuntos del CRM. */
export const CARPETA_ARCHIVOS = process.env.CLOUDINARY_CARPETA || 'crm'

let cloudinaryListo = false
function configurarCloudinary() {
  if (cloudinaryListo) return
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })
  cloudinaryListo = true
}

/**
 * Qué opciones de Cloudinary lleva cada archivo. Cloudinary puede responder 401 a
 * un public_id que termine en .pdf: los PDF van como `raw` con un nombre propio SIN extensión.
 */
export function opcionesCloudinary(nombre: string, mime: string, carpeta = CARPETA_ARCHIVOS): Record<string, unknown> {
  const base = nombre.replace(/\.[^.]+$/, '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase().slice(0, 50) || 'archivo'
  const ext = (nombre.match(/\.([^.]+)$/)?.[1] ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
  const sello = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  if (mime.startsWith('image/')) return { folder: carpeta, resource_type: 'image', public_id: `${base}-${sello}` }
  if (mime.startsWith('audio/') || mime.startsWith('video/')) return { folder: carpeta, resource_type: 'video', public_id: `${base}-${sello}` }
  const esPdf = mime === 'application/pdf' || ext === 'pdf'
  return { folder: carpeta, resource_type: 'raw', public_id: esPdf || !ext ? `${base}-${sello}` : `${base}-${sello}.${ext}` }
}

export function subirACloudinary(buffer: Buffer, nombre: string, mime: string, carpeta = CARPETA_ARCHIVOS): Promise<string> {
  configurarCloudinary()
  const opciones = opcionesCloudinary(nombre, mime, carpeta)
  return new Promise((resolve, reject) => {
    const st = cloudinary.uploader.upload_stream(opciones, (err, r) => (err || !r ? reject(err ?? new Error('Cloudinary no respondió')) : resolve(r.secure_url)))
    st.end(buffer)
  })
}

/** multer entrega el nombre en latin1: se pasa a UTF-8 para no dañar tildes y eñes. */
export const nombreArchivo = (f: Express.Multer.File) => Buffer.from(f.originalname, 'latin1').toString('utf8')
