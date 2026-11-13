import crypto from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { prismaGlobal } from './bd'
import { cifrar } from './cifrado'
import { logger } from '../../utils/logger'
import { proveedorBase } from './conexiones'
import { proveedorInstagram } from './instagram'

/**
 * Las dos direcciones que Meta pide en la app de Wali (13-nov, aprobado):
 *
 * - Desautorizar: la persona quitó a Wali de su Facebook o Instagram. Sus conexiones se vuelven a revisar ya (no en la
 *   revisión diaria), así la empresa ve de una que hay que volver a conectar, si el acceso dejó de servir.
 * - Eliminación de datos: la persona le pidió a Meta borrar lo que Wali tiene de ella. Lo que Wali guarda de esa
 *   persona es su identificador de Meta en la conexión que hizo, y en Instagram el acceso a su cuenta. Se borra eso;
 *   las conversaciones con los clientes de la empresa no (son de la empresa, no de quien conectó la cuenta).
 *   Responde el código de seguimiento y la página pública donde se ve el estado (/meta/borrado?codigo=…).
 *
 * Meta firma cada aviso (signed_request) con la clave de la app: la de Facebook o la de Instagram, según de cuál venga.
 */

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})
const PREFIJO = 'META_BORRADO:'

const b64url = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64')

/** El contenido del aviso si la firma es de una de las apps de Wali; null si no. */
export async function leerAvisoFirmado(firmado: unknown): Promise<{ usuario: string; desde: 'facebook' | 'instagram' } | null> {
  return verificarFirma(firmado, [
    [(await proveedorBase().catch(() => null))?.appSecret, 'facebook'],
    [(await proveedorInstagram().catch(() => null))?.appSecret, 'instagram'],
  ])
}

/** La firma de Meta (HMAC-SHA256 del cuerpo con la clave de la app) contra cada app; sin base de datos, se prueba sola. */
export function verificarFirma(firmado: unknown, apps: [string | undefined, 'facebook' | 'instagram'][]): { usuario: string; desde: 'facebook' | 'instagram' } | null {
  if (typeof firmado !== 'string' || firmado.length > 4000) return null
  const [firma, cuerpo] = firmado.split('.')
  if (!firma || !cuerpo) return null
  let datos: Json
  try { datos = JSON.parse(b64url(cuerpo).toString('utf8')) as Json } catch { return null }
  if (String(datos.algorithm ?? '').toUpperCase() !== 'HMAC-SHA256') return null
  const usuario = String(datos.user_id ?? '')
  if (!/^\d{3,40}$/.test(usuario)) return null
  const dada = b64url(firma)
  for (const [secreto, desde] of apps) {
    if (!secreto) continue
    const esperada = crypto.createHmac('sha256', secreto).update(cuerpo).digest()
    if (esperada.length === dada.length && crypto.timingSafeEqual(esperada, dada)) return { usuario, desde }
  }
  return null
}

/** Las conexiones que hizo esa persona: por su id de Facebook guardado al conectar, o la cuenta de Instagram misma. */
function conexionesDe(usuario: string, desde: 'facebook' | 'instagram') {
  return prismaGlobal.crmConexion.findMany({
    where: desde === 'instagram'
      ? { tipo: 'instagram', datos: { path: ['igId'], equals: usuario } }
      : { datos: { path: ['metaUsuario'], equals: usuario } },
  })
}

export async function desautorizar(usuario: string, desde: 'facebook' | 'instagram'): Promise<number> {
  const filas = await conexionesDe(usuario, desde)
  const { enEspacio } = await import('./espacio')
  for (const c of filas) {
    try {
      if (c.tipo === 'whatsapp') {
        // La revisión de WhatsApp (caidas.ts, cada 10 minutos) la toma en la próxima vuelta.
        await prismaGlobal.crmConexion.update({ where: { id: c.id }, data: { datos: { ...obj(c.datos), revisadoEn: 0 } as Prisma.InputJsonValue } })
      } else if (c.tipo === 'pagina') {
        await enEspacio(c.espacioId, async () => (await import('./paginas')).revisarPagina(c.id, null))
      } else if (c.tipo === 'instagram') {
        await enEspacio(c.espacioId, async () => (await import('./instagram')).revisarInstagram(c.id, null))
      }
    } catch (e) {
      logger.warn(`[CRM Meta privacidad] no se pudo revisar la conexión ${c.id} tras desautorizar: ${(e as Error).message}`)
    }
  }
  logger.info(`[CRM Meta privacidad] ${desde}: se quitó el permiso de Wali; ${filas.length} conexiones por revisar`)
  return filas.length
}

export interface SolicitudBorrado { codigo: string; recibida: string; terminada: string | null; desde: string }

export async function eliminarDatos(usuario: string, desde: 'facebook' | 'instagram'): Promise<SolicitudBorrado> {
  const codigo = crypto.randomBytes(6).toString('hex').toUpperCase()
  const recibida = new Date().toISOString()
  await prismaGlobal.configApp.create({ data: { clave: PREFIJO + codigo, valor: JSON.stringify({ recibida, terminada: null, desde }) } })
  const filas = await conexionesDe(usuario, desde)
  for (const c of filas) {
    const { metaUsuario: _fuera, ...resto } = obj(c.datos)
    if (c.tipo === 'instagram') {
      // La cuenta de Instagram es la persona misma: sin su acceso, la conexión queda desconectada.
      await prismaGlobal.crmConexion.update({ where: { id: c.id }, data: {
        secretos: cifrar({}), estado: 'desconectada', error: 'La cuenta pidió a Meta borrar sus datos en Wali: se quitó su acceso. Para volver a usarla, conéctala de nuevo.',
        datos: { ...resto, tokenDesde: null } as Prisma.InputJsonValue,
      } })
    } else {
      // WhatsApp y páginas son de la empresa: solo se quita quién de Facebook las conectó.
      await prismaGlobal.crmConexion.update({ where: { id: c.id }, data: { datos: resto as Prisma.InputJsonValue } })
    }
  }
  const terminada = new Date().toISOString()
  await prismaGlobal.configApp.update({ where: { clave: PREFIJO + codigo }, data: { valor: JSON.stringify({ recibida, terminada, desde }) } })
  logger.info(`[CRM Meta privacidad] ${desde}: solicitud de borrado ${codigo}, ${filas.length} conexiones`)
  return { codigo, recibida, terminada, desde }
}

/** El estado de una solicitud para la página pública. null si el código no existe. */
export async function solicitudBorrado(codigo: string): Promise<SolicitudBorrado | null> {
  if (!/^[0-9A-F]{12}$/.test(codigo)) return null
  const f = await prismaGlobal.configApp.findUnique({ where: { clave: PREFIJO + codigo } })
  if (!f) return null
  try { const v = JSON.parse(f.valor) as Json; return { codigo, recibida: String(v.recibida), terminada: v.terminada ? String(v.terminada) : null, desde: String(v.desde ?? '') } } catch { return null }
}
