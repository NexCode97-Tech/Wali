/**
 * Mensajes nuevos de los clientes como notificación push (25-nov). No pasan por la campana (serían cientos al día),
 * pero sí deben sonar en todos los dispositivos de quien atiende, aunque Wali esté cerrado: el mismo criterio del
 * sonido de la bandeja (80-datos.js, avisarEntrante): a quien tiene la conversación asignada o, sin asignar, a quien
 * la ve. Respeta Mis ajustes del espacio: «Avisos del navegador» y las conversaciones silenciadas.
 * Una notificación por conversación: los mensajes seguidos de la misma persona la actualizan (misma etiqueta).
 */
import type { CrmMensaje } from '@prisma/client'
import { prisma } from './bd'
import { alEmitirMsg, quienesVen } from './tiempoReal'
import { leerPreferencias } from './ajustes'
import { enviarPush } from '../push'

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})

/** El texto del mensaje como lo resume la bandeja (resumenIn de 10-nucleo.js). */
function resumen(v: unknown): string {
  if (typeof v === 'string') return v
  const x = obj(v)
  if (x.sticker) return 'Sticker'
  if (x.img) return '📷 ' + (typeof x.cap === 'string' && x.cap ? x.cap : 'Imagen')
  if (x.video) return '🎬 ' + (typeof x.cap === 'string' && x.cap ? x.cap : 'Video')
  if (x.doc) return '📄 ' + (typeof x.n === 'string' && x.n ? x.n : 'Documento')
  return '🎤 Nota de voz'
}

async function avisarMensaje(convId: number, m: CrmMensaje): Promise<void> {
  const c = await prisma.crmConversacion.findUnique({
    where: { id: convId },
    select: { equipo: true, asignadoId: true, soloLider: true, contactoId: true, contacto: { select: { nombre: true, telefono: true } } },
  })
  if (!c) return
  const ven = await quienesVen({ equipo: c.equipo, asignadoId: c.asignadoId, soloLider: c.soloLider })
  const para = c.asignadoId ? ven.filter(id => id === c.asignadoId) : ven
  if (!para.length) return
  const destino: string[] = []
  for (const id of para) {
    const p = await leerPreferencias(id).catch(() => ({} as Json))
    if (p.navegador === false) continue
    if (Array.isArray(p.silenciados) && p.silenciados.some(x => x === c.contactoId || x === convId)) continue
    destino.push(id)
  }
  if (!destino.length) return
  const quien = c.contacto?.nombre || (c.contacto?.telefono ? '+' + c.contacto.telefono : 'Cliente')
  await enviarPush(destino, { t: quien, b: resumen(obj(m.datos).in), url: `/?conv=${convId}`, tag: `conv-${convId}` })
}

alEmitirMsg.push((convId: number, m: CrmMensaje) => {
  if (m.tipo !== 'in') return
  void avisarMensaje(convId, m).catch(() => { /* un push que falla no tumba el mensaje */ })
})
