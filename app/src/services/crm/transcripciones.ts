import type { CrmMensaje, Prisma } from '@prisma/client'
import { prisma } from './bd'
import { transcribirAudio } from '../transcriptor'
import { logger } from '../../utils/logger'

/**
 * Transcripción de notas de voz a pedido. Antes cada nota de voz que llegaba se transcribía sola; ahora se transcribe cuando alguien
 * toca «Ver transcripción» o cuando el agente IA tiene que contestarla. El texto queda guardado en el mensaje.
 */

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})
const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/** ¿Es una nota de voz del cliente guardada con su archivo? */
export const esAudioIn = (datos: unknown) => { const x = obj(obj(datos).in); return (x.audio !== undefined || !!x.url) && !!txt(x.url) && !x.img && !x.video && !x.doc }

/** La transcripción de una nota de voz: la guardada o, si no hay, la que se saca ahora y se guarda. */
export async function transcribirMensaje(m: Pick<CrmMensaje, 'id' | 'datos'>): Promise<string> {
  const d = obj(m.datos), x = obj(d.in)
  if (txt(x.trans)) return txt(x.trans)
  const url = txt(x.url)
  if (!url || !/^https:\/\//.test(url)) throw new Error('Esta nota de voz no tiene el archivo guardado')
  const r = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!r.ok) throw new Error(`No se pudo bajar la nota de voz (${r.status})`)
  const buffer = Buffer.from(await r.arrayBuffer())
  const mime = (r.headers.get('content-type') ?? '').split(';')[0].trim() || 'audio/ogg'
  const trans = (await transcribirAudio(buffer, /^audio\//.test(mime) ? mime : 'audio/ogg')).trim()
  if (!trans) throw new Error('La nota de voz no tiene palabras que transcribir')
  const datos = { ...d, in: { ...x, trans } }
  await prisma.crmMensaje.update({ where: { id: m.id }, data: { datos: datos as Prisma.InputJsonValue } })
  m.datos = datos as Prisma.JsonValue
  return trans
}

/** Para el agente IA: transcribe las notas de voz del cliente que todavía no tienen texto. Nunca lanza. */
export async function transcribirPendientes(msgs: CrmMensaje[]): Promise<void> {
  for (const m of msgs) {
    if (m.tipo !== 'in' || !esAudioIn(m.datos) || txt(obj(obj(m.datos).in).trans)) continue
    try { await transcribirMensaje(m) } catch (e) { logger.info(`[CRM] nota de voz ${m.id} sin transcripción: ${(e as Error).message}`) }
  }
}
