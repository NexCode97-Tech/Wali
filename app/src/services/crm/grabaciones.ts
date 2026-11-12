import { v2 as cloudinary } from 'cloudinary'
import { subir as subirAlBanco, enlaceTemporal, borrar as borrarDelBanco } from '../almacen'
import type { Prisma } from '@prisma/client'
import { prisma } from './bd'
import { leerAjuste } from './ajustes'
import { emitirMsg } from './tiempoReal'
import { logger } from '../../utils/logger'
import { NotFoundError } from '../../utils/errors'
import type { Alcance } from './alcance'

/**
 * Grabaciones de llamadas (maquetas aprobadas el 5-nov). Las nuevas quedan privadas en la Nube (type «authenticated»):
 * call.audio guarda «grab:<public_id>:<formato>» y para oírlas el servidor da una dirección que vence a los 10 minutos.
 * Las viejas siguen siendo una dirección https y se oyen igual hasta que venzan.
 * Cada 10 minutos (procesos.ts) se borran las que pasaron el plazo de «Guardar las grabaciones durante».
 */

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})
const CARPETA = 'crm/grabaciones'
const MINUTOS_ENLACE = 10
const LOTE = 20
const PRIMERA = 50
const MESES: Record<string, number> = { '6 meses': 6, '1 año': 12, '2 años': 24 }
const REF = /^grab:([\w/.-]{1,200}):([a-z0-9]{1,8})$/

let listo = false
function configurar() {
  if (listo) return
  cloudinary.config({ cloud_name: process.env.CLOUDINARY_CLOUD_NAME, api_key: process.env.CLOUDINARY_API_KEY, api_secret: process.env.CLOUDINARY_API_SECRET })
  listo = true
}

/** Grabaciones en el bucket de Railway (11-nov): `grabr:<clave>`, privadas. Las de antes (`grab:`) siguen en Cloudinary hasta migrarlas. */
const REF_BANCO = /^grabr:(privado\/[a-z0-9/._-]{3,300})$/
export const esRefGrabacion = (v: unknown) => typeof v === 'string' && (REF.test(v) || REF_BANCO.test(v))

export async function subirGrabacion(buffer: Buffer): Promise<string> {
  const { clave } = await subirAlBanco(buffer, { carpeta: 'crm/grabaciones', nombre: 'llamada.webm', mime: 'audio/webm', privado: true })
  return `grabr:${clave}`
}

/** La dirección para oír o descargar: la privada vence pronto; una vieja se devuelve tal cual. */
export async function direccionDe(audio: string, descargar: boolean): Promise<string> {
  const b = audio.match(REF_BANCO)
  if (b) return enlaceTemporal(b[1], MINUTOS_ENLACE * 60, descargar)
  const m = audio.match(REF)
  if (!m) return audio
  configurar()
  return cloudinary.utils.private_download_url(m[1], m[2], { resource_type: 'video', type: 'authenticated', expires_at: Math.floor(Date.now() / 1000) + MINUTOS_ENLACE * 60, attachment: descargar })
}

/** Lo que este alcance puede ver en la página: todo, o lo de los equipos que lidera. null: nada. */
function filtroPagina(a: Alcance): Prisma.CrmConversacionWhereInput | null {
  if (a.todo) return {}
  if (!a.lidera.length) return null
  return { OR: [{ equipo: { in: a.lidera } }, ...(a.lidera.includes('Ventas') ? [{ equipo: null }] : [])] }
}
export const puedeVerGrabaciones = (a: Alcance) => filtroPagina(a) !== null

export interface FiltrosGrabaciones { q?: string; miembro?: string; equipo?: string; dias?: number; antesDe?: string }

export async function listarGrabaciones(a: Alcance, f: FiltrosGrabaciones) {
  const conv = filtroPagina(a)
  if (!conv) return { filas: [], mas: false }
  const q = (f.q ?? '').trim().slice(0, 80)
  const tope = f.antesDe ? LOTE : PRIMERA
  const antes = f.antesDe ? new Date(f.antesDe) : null
  const where: Prisma.CrmMensajeWhereInput = {
    tipo: 'call',
    NOT: { OR: [{ datos: { path: ['call', 'audio'], equals: '' } }] },
    datos: { path: ['call', 'audio'], string_contains: ':' },
    ...(f.miembro ? { autorId: f.miembro } : {}),
    createdAt: { ...(antes && !isNaN(+antes) ? { lt: antes } : {}), ...(f.dias ? { gte: new Date(Date.now() - f.dias * 86_400_000) } : {}) },
    conversacion: {
      AND: [conv, ...(f.equipo ? [{ equipo: f.equipo }] : []), ...(q ? [{ contacto: { OR: [{ nombre: { contains: q, mode: 'insensitive' as const } }, { telefono: { contains: q.replace(/\D/g, '') || q } }] } }] : [])],
    },
  }
  const filas = await prisma.crmMensaje.findMany({
    where, orderBy: { createdAt: 'desc' }, take: tope + 1,
    select: { id: true, datos: true, createdAt: true, conversacion: { select: { id: true, equipo: true, contacto: { select: { nombre: true, telefono: true } } } } },
  })
  return {
    mas: filas.length > tope,
    filas: filas.slice(0, tope).map(m => {
      const c = obj(obj(m.datos).call)
      return { id: m.id, convId: m.conversacion.id, cliente: m.conversacion.contacto.nombre || m.conversacion.contacto.telefono || 'Cliente', telefono: m.conversacion.contacto.telefono ?? '', miembro: String(c.quien ?? ''), equipo: m.conversacion.equipo ?? 'Ventas', fecha: m.createdAt.toISOString(), dur: Number(c.dur ?? 0), dir: c.dir === 'in' ? 'in' : 'out' }
    }),
  }
}

export async function grabacionPorId(id: string) {
  const m = await prisma.crmMensaje.findUnique({ where: { id }, select: { id: true, datos: true, conversacionId: true } })
  const audio = String(obj(obj(m?.datos).call).audio ?? '')
  if (!m || !audio) throw new NotFoundError('Esa grabación ya no existe')
  return { id: m.id, convId: m.conversacionId, audio }
}

/** Borra el archivo de la Nube. Una vieja se reconoce por su dirección. */
async function borrarArchivo(audio: string) {
  const b = audio.match(REF_BANCO)
  if (b) { await borrarDelBanco(b[1]); return }
  configurar()
  const r = audio.match(REF)
  if (r) { await cloudinary.uploader.destroy(r[1], { resource_type: 'video', type: 'authenticated', invalidate: true }); return }
  const v = audio.match(/res\.cloudinary\.com\/[^/]+\/(video|raw|image)\/upload\/(?:v\d+\/)?(.+)$/)
  if (v) await cloudinary.uploader.destroy(v[1] === 'raw' ? v[2] : v[2].replace(/\.[^.]+$/, ''), { resource_type: v[1], invalidate: true })
}

/** Borra la grabación: el registro de la llamada sigue en el chat, sin el audio. */
export async function borrarGrabacion(id: string, motivo: string) {
  const m = await prisma.crmMensaje.findUnique({ where: { id } })
  const datos = obj(m?.datos), call = obj(datos.call)
  if (!m || !call.audio) throw new NotFoundError('Esa grabación ya no existe')
  await borrarArchivo(String(call.audio))
  const { audio: _fuera, ...resto } = call
  const f = await prisma.crmMensaje.update({ where: { id }, data: { datos: { ...datos, call: { ...resto, sinGrabar: motivo } } as Prisma.InputJsonValue } })
  emitirMsg(f.conversacionId, f)
}

/** Las que pasaron el plazo configurado en Ajustes › Llamadas. */
export async function borrarVencidas(): Promise<number> {
  const meses = MESES[String(obj(await leerAjuste('llcfg')).guardar)] ?? 6
  const limite = new Date(); limite.setMonth(limite.getMonth() - meses)
  const viejas = await prisma.crmMensaje.findMany({ where: { tipo: 'call', createdAt: { lt: limite }, datos: { path: ['call', 'audio'], string_contains: ':' } }, select: { id: true }, take: 100 })
  let n = 0
  for (const m of viejas) {
    await borrarGrabacion(m.id, 'se borró al cumplir el plazo de guardado').then(() => { n++ }).catch(e => logger.warn(`[CRM grabaciones] no se pudo borrar ${m.id}: ${(e as Error)?.message ?? e}`))
  }
  return n
}
