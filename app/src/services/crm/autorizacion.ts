/**
 * Autorización de datos por respuesta: cuando el CRM le pidió la autorización a alguien
 * por WhatsApp y la persona responde «Autorizo», queda marcada sola, con la fecha, el texto que se autorizó
 * y la respuesta como constancia (Ley 1581: autorización previa, expresa e informada; el silencio no cuenta).
 *
 * - Al cliente se le pide con un mensaje que termina en «responde «Autorizo» a este mensaje» (30-legal.js).
 * - Al representante legal, con la plantilla «Autorización del representante legal» en una conversación aparte: su «Autorizo»
 *   se marca en la ficha del menor que tiene ese número como teléfono del representante legal.
 * Solo cuenta si la solicitud salió en esa misma conversación en los últimos 30 días. Nunca lanza.
 */
import type { CrmContacto, CrmMensaje, Prisma } from '@prisma/client'
import { prisma } from './bd'
import { leerAjuste } from './ajustes'
import { emitirConv, emitirMsg } from './tiempoReal'
import { logger } from '../../utils/logger'

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})
const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const ultimos10 = (t: string | null | undefined) => (t ?? '').replace(/\D/g, '').slice(-10)
const sinTildes = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** La plantilla con que se le pide al representante legal (TPL_REP en 30-legal.js). */
export const PLANTILLA_REPRESENTANTE = 'Autorización del representante legal'
/** El mismo texto por defecto de la pantalla (PD en 30-legal.js), si el equipo no lo cambió. */
const TEXTO_PD = 'Autorizo a tratar mis datos personales para contactarme por WhatsApp, llamadas y correo con información de sus productos y servicios, y a grabar las llamadas para mejorar la atención, según su política de tratamiento de datos.'
const DIAS = 30

/** «Autorizo», «Sí, autorizo», «Yo autorizo.»; nunca «No autorizo». */
export function esAutorizo(texto: string): boolean {
  const t = sinTildes(texto)
  return /\bautorizo\b/.test(t) && !/\bno\s+(lo\s+|la\s+)?autorizo\b/.test(t)
}

const esPedidoCliente = (d: Json) => /responde «autorizo»/i.test(txt(d.out))
const esPedidoRepresentante = (d: Json) => txt(d.plantilla) === PLANTILLA_REPRESENTANTE

async function evento(convId: number, t: string) {
  const m: CrmMensaje = await prisma.crmMensaje.create({ data: { conversacionId: convId, tipo: 'ev', datos: { ev: 'lock', t } } })
  emitirMsg(convId, m, null)
}

/** Las conversaciones abiertas de un contacto se repintan (su ficha cambió). */
async function repintar(contactoId: number) {
  const convs = await prisma.crmConversacion.findMany({ where: { contactoId, estado: { not: 'finalizadas' } }, select: { id: true } })
  for (const c of convs) await emitirConv(c.id, null)
}

export async function autorizacionPorRespuesta(convId: number, k: CrmContacto, texto: string, cuando: Date): Promise<boolean> {
  try {
    if (!texto || !esAutorizo(texto)) return false
    const pedidos = await prisma.crmMensaje.findMany({
      where: { conversacionId: convId, tipo: 'out', createdAt: { gte: new Date(cuando.getTime() - DIAS * 86_400_000) } },
      orderBy: { createdAt: 'desc' }, take: 40, select: { datos: true },
    })
    const pedido = pedidos.map(m => obj(m.datos)).find(d => esPedidoCliente(d) || esPedidoRepresentante(d))
    if (!pedido) return false
    const reg = {
      via: 'Respondió por WhatsApp', fecha: cuando.toISOString(),
      texto: txt(obj(await leerAjuste('pd')).texto) || TEXTO_PD,
      respuesta: texto.trim().slice(0, 200), por: 'Automático al responder',
    }

    if (esPedidoCliente(pedido)) {
      if (k.autorizacion) return false
      await prisma.crmContacto.update({ where: { id: k.id }, data: { autorizacion: reg as Prisma.InputJsonValue } })
      await evento(convId, `Respondió «${reg.respuesta}»: la autorización de datos quedó marcada · Respondió por WhatsApp`)
      await repintar(k.id)
      logger.info(`[CRM autorización] contacto ${k.id} autorizó al responder (conversación ${convId})`)
      return true
    }

    // Representante: el menor es quien tiene este número como teléfono del representante legal.
    const tel = ultimos10(k.telefono)
    if (tel.length !== 10) return false
    const candidatos = await prisma.crmContacto.findMany({ where: { campos: { path: ['telRepresentante'], string_contains: tel.slice(-4) } }, take: 50 })
    const menores = candidatos.filter(m => m.id !== k.id && ultimos10(txt(obj(m.campos).telRepresentante)) === tel && !m.representante)
    for (const m of menores) {
      await prisma.crmContacto.update({ where: { id: m.id }, data: { representante: reg as Prisma.InputJsonValue, ...(m.autorizacion ? {} : { autorizacion: reg as Prisma.InputJsonValue }) } })
      const suya = await prisma.crmConversacion.findFirst({ where: { contactoId: m.id }, orderBy: { ultimoMensajeAt: { sort: 'desc', nulls: 'last' } }, select: { id: true } })
      if (suya) await evento(suya.id, `Su representante legal respondió «${reg.respuesta}»: la autorización del representante legal quedó marcada · Respondió por WhatsApp`)
      await repintar(m.id)
      logger.info(`[CRM autorización] representante de ${m.id} autorizó al responder (conversación ${convId})`)
    }
    if (menores.length) await evento(convId, `Respondió «${reg.respuesta}»: la autorización quedó marcada en la ficha de ${menores.map(m => m.nombre || 'su acudido').join(', ')}`)
    return menores.length > 0
  } catch (e) {
    logger.error(`[CRM autorización] conversación ${convId}: ${(e as Error)?.message ?? e}`)
    return false
  }
}
