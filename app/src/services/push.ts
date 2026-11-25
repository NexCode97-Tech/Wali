/**
 * Notificaciones push de Wali (25-nov: «que lleguen las notificaciones de Wali en todos los dispositivos»).
 *
 * Cada navegador o app donde la persona activó los avisos queda guardado (PushDispositivo) y recibe cada aviso aunque
 * Wali esté minimizado o cerrado: computador (Chrome, Edge, Firefox, Safari), Android y iPhone con Wali en la pantalla
 * de inicio (Apple solo permite push a las apps instaladas). Suena y vibra con el sonido del sistema.
 *
 * Qué se manda:
 * - Todo aviso de la campana (notificaciones.ts → avisar): menciones, asignaciones, recordatorios, reglas, canales
 *   caídos, difusiones…
 * - Los mensajes nuevos de los clientes (que no van a la campana): a quien tiene la conversación asignada o, si está
 *   sin asignar, a quien la ve. Lo registra crm/pushMensajes.ts.
 * Respeta Mis ajustes de cada persona en ese espacio: «Avisos del navegador» (navegador) apaga todos los push; las
 * menciones siguen además «mencion», las asignaciones «asignada»; las conversaciones silenciadas no suenan.
 *
 * Las claves VAPID (VAPID_PUBLICA y VAPID_PRIVADA) identifican al servidor ante Google, Apple y Mozilla. Sin ellas no
 * se manda nada (se avisa una vez en el registro).
 */
import webpush from 'web-push'
import { prisma } from '../config/prisma'
import { logger } from '../utils/logger'
import { BASE } from '../utils/base'

let listo: boolean | null = null
function configurar(): boolean {
  if (listo !== null) return listo
  const pub = (process.env.VAPID_PUBLICA ?? '').trim(), priv = (process.env.VAPID_PRIVADA ?? '').trim()
  if (!pub || !priv) { listo = false; logger.warn('[push] faltan VAPID_PUBLICA o VAPID_PRIVADA: no se mandan notificaciones push'); return false }
  try {
    // El «asunto» identifica al que manda ante los servicios de push: el sitio de Wali, sin datos personales.
    webpush.setVapidDetails('https://walicrm.com', pub, priv)
    listo = true
  } catch (e) {
    listo = false
    logger.error(`[push] las claves VAPID no sirven: ${(e as Error).message}`)
  }
  return listo
}

/** La clave pública que necesita el navegador para suscribirse; null si el push no está configurado. */
export function clavePublicaPush(): string | null {
  return configurar() ? (process.env.VAPID_PUBLICA ?? '').trim() : null
}

export interface SuscripcionPush { endpoint: string; keys: { p256dh: string; auth: string } }

/** Guarda (o actualiza) el dispositivo de la persona. El mismo navegador siempre trae el mismo endpoint. */
export async function guardarDispositivo(userId: string, s: SuscripcionPush, agente: string | null): Promise<void> {
  await prisma.pushDispositivo.upsert({
    where: { endpoint: s.endpoint },
    create: { userId, endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth, agente },
    // Si el navegador cambió de persona (otra sesión en el mismo equipo), pasa a la nueva.
    update: { userId, p256dh: s.keys.p256dh, auth: s.keys.auth, agente, usadoAt: new Date() },
  })
}

/** Quita el dispositivo, solo si es de esa persona. */
export async function quitarDispositivo(userId: string, endpoint: string): Promise<void> {
  await prisma.pushDispositivo.deleteMany({ where: { userId, endpoint } })
}

export interface AvisoPush {
  /** Título de la notificación. */
  t: string
  /** Texto. */
  b: string
  /** A dónde lleva al tocarla, relativo al CRM («/?conv=12»). */
  url: string
  /** Avisos con la misma etiqueta se reemplazan (una conversación, una sola notificación que se actualiza). */
  tag?: string
}

const recortar = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s)

/** Manda el aviso a todos los dispositivos de esas personas. Nunca lanza: un push que falla no tumba nada. */
export async function enviarPush(userIds: string[], a: AvisoPush): Promise<void> {
  const ids = [...new Set(userIds.filter(Boolean))]
  if (!ids.length || !configurar()) return
  let ds: { id: string; endpoint: string; p256dh: string; auth: string }[]
  try {
    ds = await prisma.pushDispositivo.findMany({ where: { userId: { in: ids } }, select: { id: true, endpoint: true, p256dh: true, auth: true } })
  } catch (e) {
    logger.warn(`[push] no se pudieron leer los dispositivos: ${(e as Error).message}`)
    return
  }
  if (!ds.length) return
  const carga = JSON.stringify({ t: recortar(a.t, 80), b: recortar(a.b, 180), url: BASE + (a.url.startsWith('/') ? a.url : '/' + a.url), tag: a.tag ?? null })
  await Promise.all(ds.map(async d => {
    try {
      // TTL de 1 hora: un aviso de hace más ya no sirve. Urgencia alta: Android lo entrega aunque el teléfono ahorre batería.
      await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, carga, { TTL: 3600, urgency: 'high' })
    } catch (e) {
      const st = (e as { statusCode?: number }).statusCode
      // 404 y 410: el navegador ya no tiene esa suscripción (se desinstaló, se borraron los datos). Se olvida.
      if (st === 404 || st === 410) { await prisma.pushDispositivo.delete({ where: { id: d.id } }).catch(() => {}); return }
      logger.warn(`[push] no salió un aviso (${st ?? 'sin respuesta'}): ${(e as Error).message}`)
    }
  }))
}
