import type { Prisma } from '@prisma/client'
import { prisma, prismaGlobal } from './bd'
import { espacioActual } from './espacio'
import { descifrar } from './cifrado'
import { ErrorMeta, revisarToken } from './whatsapp'
import { usuariosCrm } from './usuarios'
import { avisar } from '../notificaciones'
import { configura } from '../../utils/roles'
import { correoMarca, escaparHtml } from '../../utils/correoMarca'
import { logger } from '../../utils/logger'

/**
 * WhatsApp caído (maqueta aprobada «Aviso WhatsApp caído», 13-oct). El 6 y 7 de octubre las dos conexiones del CRM se
 * hicieron con el token temporal de la app de Meta (24 horas) y dejaron de recibir mensajes sin que nadie se enterara.
 * Desde entonces:
 * - una vez al día se le pregunta a Meta si el token de cada conexión de WhatsApp sigue sirviendo;
 * - si se cae (en esa revisión o al fallar un envío por el token), la conexión pasa a «error», queda anotado desde
 *   cuándo (`datos.caidaDesde`) y los administradores del espacio reciben, una sola vez, un aviso en la campana y un
 *   correo (`datos.caidaAvisada`);
 * - mientras siga caída, el CRM muestra la franja roja a todos (whatsappCaido, en /crm/inicio y por tiempo real);
 * - al volver (se reconecta o el token vuelve a servir) se borran las dos marcas y la franja se quita sola.
 */

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})
const UN_DIA = 864e5

/** Los administradores del espacio actual (quienes pueden reconectar): id, nombre y correo. */
async function administradores() {
  const ids = (await usuariosCrm(true)).filter(u => configura(u.rol)).map(u => u.id)
  if (!ids.length) return []
  return prismaGlobal.user.findMany({ where: { id: { in: ids }, suspendido: false }, select: { id: true, nombre: true, email: true } })
}

const urlCrm = () => { const v = (process.env.CRM_URL ?? '').trim().replace(/\/+$/, ''); return /^https?:\/\/[^\s"'<>?#]+$/.test(v) ? v : null }

async function enviarCorreo(para: string, asunto: string, html: string, texto: string) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.CRM_CORREO_DE || process.env.RESEND_FROM_EMAIL || 'NexCode97 <hola@nexcode97.com>', reply_to: process.env.CRM_CORREO_AYUDA || 'nexcode97@gmail.com', to: [para], subject: asunto, html, text: texto }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 200)}`)
}

/** Campana y correo a cada administrador: los mensajes de esas líneas no están llegando. */
async function avisarCaida(lineas: string[]) {
  const admins = await administradores()
  const cuales = lineas.length ? lineas.map(l => `«${l}»`).join(', ') : 'tu línea de WhatsApp'
  for (const a of admins) {
    await avisar({ userId: a.id, autorId: null, tipo: 'CRM_WHATSAPP_CAIDO', titulo: 'Tu WhatsApp está desconectado', texto: `Los mensajes nuevos de ${cuales} no están llegando. Reconéctala en Ajustes › Canales.`, url: '/' })
  }
  const base = urlCrm()
  if (!process.env.RESEND_API_KEY || !base) { logger.warn({ evento: 'WHATSAPP_CAIDO_SIN_CORREO', admins: admins.length }); return }
  const empresa = (await prismaGlobal.crmEspacio.findUnique({ where: { id: espacioActual() }, select: { nombre: true } }))?.nombre ?? 'tu empresa'
  for (const a of admins) {
    if (!a.email) continue
    const hola = a.nombre ? `Hola, ${a.nombre.split(' ')[0]}` : 'Hola'
    const pasos = 'En business.facebook.com, Configuración del negocio › Usuarios del sistema: asigna la app y la cuenta de WhatsApp con control total, toca «Generar nuevo token», elige vencimiento «Nunca» y marca whatsapp_business_messaging y whatsapp_business_management. Después pégalo en el CRM, en Ajustes › Canales.'
    const html = correoMarca({
      preencabezado: `Los mensajes de WhatsApp de ${empresa} no están llegando al CRM.`,
      titulo: hola,
      parrafos: [
        `Los mensajes nuevos de <strong style="color:#0a0a0d">${escaparHtml(cuales)}</strong> no están llegando al CRM de <strong style="color:#0a0a0d">${escaparHtml(empresa)}</strong>: Meta ya no acepta el token de la conexión.`,
        'Mientras no la reconectes, tus clientes escriben y nadie ve sus mensajes en el CRM.',
      ],
      boton: { texto: 'Reconectar WhatsApp', url: `${base}/` },
      aviso: escaparHtml(`Cómo arreglarlo: ${pasos}`),
    })
    const texto = `${hola}.\n\nLos mensajes nuevos de ${cuales} no están llegando al CRM de ${empresa}: Meta ya no acepta el token de la conexión.\n\nCómo arreglarlo: ${pasos}\n\nEntra al CRM: ${base}/`
    try { await enviarCorreo(a.email, 'Tu WhatsApp está desconectado del CRM', html, texto) } catch (e) { logger.warn(`[CRM caídas] correo a ${a.id}: ${(e as Error).message}`) }
  }
}

/**
 * La conexión dejó de servir. La primera vez anota desde cuándo y avisa a los administradores; las siguientes solo
 * actualizan el motivo. `desde` es cuándo dejó de servir de verdad, si se sabe (cuándo venció el token).
 */
export async function marcarCaida(id: string, error: string, desde?: number) {
  const c = await prisma.crmConexion.findUnique({ where: { id }, include: { lineas: { select: { nombre: true } } } })
  if (!c) return
  const d = obj(c.datos)
  const nueva = !d.caidaAvisada
  const datos = { ...d, caidaDesde: d.caidaDesde ?? desde ?? Date.now(), caidaAvisada: true }
  await prisma.crmConexion.update({ where: { id }, data: { estado: 'error', error: error.slice(0, 500), datos: datos as Prisma.InputJsonValue } })
  if (nueva && c.tipo === 'whatsapp') {
    logger.warn(`[CRM caídas] WhatsApp caído en ${espacioActual()}: ${c.nombre} · ${error}`)
    await avisarCaida(c.lineas.map(l => l.nombre))
  }
  if (nueva) await (await import('./conexiones')).emitirConexiones(null)
}

/** La conexión volvió a servir: fuera las marcas de caída (la franja se quita sola). */
export async function marcarViva(id: string) {
  const c = await prisma.crmConexion.findUnique({ where: { id } })
  if (!c) return
  const d = obj(c.datos)
  if (c.estado === 'conectada' && !d.caidaDesde && !d.caidaAvisada) return
  const { caidaDesde: _a, caidaAvisada: _b, ...resto } = d
  await prisma.crmConexion.update({ where: { id }, data: { estado: 'conectada', error: null, datos: resto as Prisma.InputJsonValue } })
  await (await import('./conexiones')).emitirConexiones(null)
}

/**
 * Para la franja roja (todos la ven): las conexiones de WhatsApp caídas con sus líneas, desde cuándo y cuándo venció
 * el token, y quiénes pueden reconectar. Sin secretos.
 */
export async function whatsappCaido() {
  const filas = await prisma.crmConexion.findMany({ where: { tipo: 'whatsapp', estado: 'error' }, include: { lineas: { select: { nombre: true } } }, orderBy: { createdAt: 'asc' } })
  const caidas = filas.filter(c => c.lineas.length).map(c => {
    const d = obj(c.datos)
    const desde = Number(d.caidaDesde) || c.updatedAt.getTime()
    const vence = Number(d.vence) ? Number(d.vence) * 1000 : null
    return { id: c.id, lineas: c.lineas.map(l => l.nombre), desde, vence: vence && vence <= desde ? vence : null }
  })
  const admins = caidas.length ? (await usuariosCrm()).filter(u => configura(u.rol)).map(u => u.nombre) : []
  return { caidas, admins }
}

/**
 * El token de la conexión todavía sirve pero vence en menos de 7 días (13-oct: el botón de Meta entrega tokens de 60
 * días cuando Meta no da el de empresa sin vencimiento). Un aviso en la campana a cada administrador, una sola vez por
 * fecha de vencimiento (`datos.porVencerAvisado`), para que reconecten antes de que dejen de llegar los mensajes.
 */
async function avisarPorVencer(id: string, vence: number) {
  if (vence - Date.now() > 7 * UN_DIA) return
  const c = await prisma.crmConexion.findUnique({ where: { id }, include: { lineas: { select: { nombre: true } } } })
  if (!c || obj(c.datos).porVencerAvisado === vence) return
  await prisma.crmConexion.update({ where: { id }, data: { datos: { ...obj(c.datos), porVencerAvisado: vence } as Prisma.InputJsonValue } })
  const f = new Date(vence).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', timeZone: 'America/Bogota' })
  const cuales = c.lineas.length ? c.lineas.map(l => `«${l.nombre}»`).join(', ') : 'tu línea de WhatsApp'
  for (const a of await administradores()) {
    await avisar({ userId: a.id, autorId: null, tipo: 'CRM_WHATSAPP_POR_VENCER', titulo: 'Tu WhatsApp se desconecta pronto', texto: `La conexión de ${cuales} vence el ${f}. Reconéctala antes en Ajustes › Líneas de WhatsApp para que los mensajes sigan llegando.`, url: '/' })
  }
  logger.info(`[CRM caídas] Aviso de vencimiento: ${c.nombre} vence el ${f}`)
}

/**
 * Revisión diaria (procesos.ts, cada 10 minutos, pero cada conexión a lo sumo una vez por día): ¿Meta sigue aceptando
 * el token? Solo cuenta lo que Meta responde; si no se pudo hablar con Meta (la red), se deja para la próxima.
 */
export async function revisarConexionesWhatsapp(): Promise<number> {
  const filas = await prisma.crmConexion.findMany({ where: { tipo: 'whatsapp', estado: { in: ['conectada', 'error'] } } })
  let revisadas = 0
  for (const c of filas) {
    const d = obj(c.datos)
    if (Date.now() - (Number(d.revisadoEn) || 0) < UN_DIA) continue
    revisadas++
    const s = descifrar<{ token?: string; appSecret?: string }>(c.secretos)
    let llave = ''
    if (c.modo === 'manual') llave = s.appSecret && d.appId ? `${d.appId}|${s.appSecret}` : ''
    else { const p = await (await import('./conexiones')).proveedorMeta(); llave = p ? `${p.appId}|${p.appSecret}` : '' }
    if (!s.token || !llave) continue
    try {
      const info = await revisarToken(s.token, llave)
      await prisma.crmConexion.update({ where: { id: c.id }, data: { datos: { ...obj((await prisma.crmConexion.findUnique({ where: { id: c.id }, select: { datos: true } }))?.datos), revisadoEn: Date.now() } as Prisma.InputJsonValue } })
      if (info.valido) {
        await marcarViva(c.id)
        if (info.vence) await avisarPorVencer(c.id, info.vence * 1000)
        // De paso, si el portafolio ya aceptó el marketing optimizado de Meta (marketingMeta.ts).
        await (await import('./marketingMeta')).revisarMarketingDeConexion(c.id)
      }
      else await marcarCaida(c.id, 'El token de Meta venció o no es válido. Genera uno que nunca venza para el usuario del sistema y vuelve a conectar WhatsApp en Ajustes › Canales', info.vence ? info.vence * 1000 : undefined)
    } catch (e) {
      if (!(e instanceof ErrorMeta)) { logger.info(`[CRM caídas] ${c.id}: no se pudo revisar (${(e as Error).message})`); continue }
      await prisma.crmConexion.update({ where: { id: c.id }, data: { datos: { ...obj((await prisma.crmConexion.findUnique({ where: { id: c.id }, select: { datos: true } }))?.datos), revisadoEn: Date.now() } as Prisma.InputJsonValue } })
      await marcarCaida(c.id, `Meta no acepta la conexión: ${e.message}`)
    }
  }
  return revisadas
}
