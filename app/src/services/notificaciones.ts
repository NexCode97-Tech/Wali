/**
 * Los avisos que quedan guardados en la campana del CRM: menciones, asignaciones, recordatorios, reglas,
 * difusiones que terminan, canales que se caen. Cada aviso se guarda y, además, sube el globito de la campana
 * de esa persona en vivo. Los mensajes nuevos de los clientes no pasan por aquí: esos suenan desde la bandeja.
 */
import { prisma } from '../config/prisma'
import { broadcastUsuarios } from '../utils/sseManager'
import { enviarPush } from './push'

export type TipoNotificacion = string

interface Aviso {
  /** A quién le llega. */
  userId: string
  /** Quién lo provocó. Se ignora si es la misma persona: nadie se avisa a sí mismo. */
  autorId?: string | null
  tipo: TipoNotificacion
  /** Lo que se lee en la campana, ya redactado. */
  texto: string
  titulo: string
  url: string
  contenidoId?: string | null
}

export async function avisar(a: Aviso) {
  if (a.autorId && a.autorId === a.userId) return
  try {
    await prisma.notificacion.create({
      data: { userId: a.userId, autorId: a.autorId ?? null, tipo: a.tipo, titulo: a.titulo, texto: a.texto, url: a.url, contenidoId: a.contenidoId ?? null },
    })
    broadcastUsuarios(new Set([a.userId]), 'notificacion-nueva', { userId: a.userId })
  } catch {
    // Un aviso que no se puede guardar no debe tumbar la acción que lo provocó.
  }
  void pushDeAviso(a)
}

/**
 * El mismo aviso como notificación push en todos los dispositivos de la persona (push.ts), según sus Mis ajustes del
 * espacio: «Avisos del navegador» apagado no manda nada; menciones y asignaciones siguen además su propio interruptor.
 */
async function pushDeAviso(a: Aviso): Promise<void> {
  try {
    const { leerPreferencias } = await import('./crm/ajustes')
    const p = await leerPreferencias(a.userId).catch(() => ({} as Record<string, unknown>))
    if (p.navegador === false) return
    if (a.tipo === 'ETIQUETADO' && p.mencion === false) return
    if (a.tipo === 'TAREA_ASIGNADA' && p.asignada === false) return
    await enviarPush([a.userId], { t: a.titulo, b: a.texto, url: a.url, tag: a.contenidoId ? `n-${a.contenidoId}` : undefined })
  } catch { /* un push que falla no tumba el aviso */ }
}
