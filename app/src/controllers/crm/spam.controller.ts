import type { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../../services/crm/bd'
import { ApiResponse } from '../../utils/response'
import { logger } from '../../utils/logger'
import { convVisible, exigirEscritura, idNum, obj, txt, type Json } from './_comun'
import { emitirContacto } from './_contacto'
import { emitirMsg } from '../../services/crm/tiempoReal'
import { nombreDe } from '../../services/crm/usuarios'
import { credDeLinea } from '../../services/crm/credenciales'
import { ErrorMeta, graph } from '../../services/crm/whatsapp'

/**
 * Marcar como spam (lote 7, tablero 4). El contacto queda con `extra.spam = {por, en, bloqueado}`; sus
 * conversaciones abiertas se finalizan con el motivo «Spam» (sin reglas ni encuesta) y sus mensajes nuevos se
 * guardan sin reabrir, sin no leídos, sin reparto y sin reglas (entrantes.ts). Se saca de spam desde Contactos
 * (PATCH /crm/contactos/:id con `spam: null`). «Bloquear también el número en WhatsApp» usa el bloqueo de la
 * API en la nube; si Meta no lo acepta (solo deja bloquear a quien escribió en las últimas 24 horas), el
 * contacto queda en spam igual y la respuesta dice por qué no se bloqueó.
 */
const spamSchema = z.object({ bloquear: z.boolean().optional() })

export async function marcarSpam(req: Request, res: Response) {
  exigirEscritura(req)
  const id = idNum(req.params.id)
  const c = await convVisible(req, id)
  const { bloquear } = spamSchema.parse(req.body ?? {})
  const quien = (await nombreDe(req.userId!)) || 'Alguien'

  let bloqueado = false
  let aviso: string | null = null
  if (bloquear) {
    const linea = c.lineaId ? await prisma.crmLinea.findUnique({ where: { id: c.lineaId } }) : null
    const tel = txt(c.contacto.telefono).replace(/\D/g, '')
    if (c.canal !== 'wa' || !linea || !tel) aviso = 'No se bloqueó en WhatsApp: la conversación no es de una línea de WhatsApp.'
    else {
      try {
        await graph(`/${linea.phoneNumberId}/block_users`, { cred: await credDeLinea(linea), method: 'POST', body: { messaging_product: 'whatsapp', block_users: [{ user: tel }] } })
        bloqueado = true
      } catch (e) {
        const m = e instanceof ErrorMeta ? e.message : (e as Error)?.message ?? 'Meta no respondió'
        logger.warn(`[CRM spam] bloquear ${id}: ${m}`)
        aviso = `Quedó en spam, pero WhatsApp no lo bloqueó: ${m}`
      }
    }
  }

  const spam: Json = { por: quien, en: new Date().toISOString(), bloqueado, ...(bloqueado && c.lineaId ? { linea: c.lineaId } : {}) }
  await prisma.$executeRaw`UPDATE crm_contactos SET extra = COALESCE(extra, '{}'::jsonb) || ${JSON.stringify({ spam })}::jsonb WHERE id = ${c.contactoId}`
  const abiertas = await prisma.crmConversacion.findMany({ where: { contactoId: c.contactoId, estado: { not: 'finalizadas' } }, select: { id: true } })
  for (const a of abiertas) {
    await prisma.crmConversacion.update({ where: { id: a.id }, data: { estado: 'finalizadas', finalizadaAt: new Date(), motivoFin: 'Spam', esperaDesde: null, noLeidos: 0 } })
    await prisma.$executeRaw`UPDATE crm_conversaciones SET extra = COALESCE(extra, '{}'::jsonb) || ${JSON.stringify({ finPor: quien })}::jsonb WHERE id = ${a.id}`
  }
  const ev = await prisma.crmMensaje.create({ data: { conversacionId: id, tipo: 'ev', autorId: req.userId!, datos: { ev: 'block', t: `${quien} la marcó como spam${bloqueado ? ' y bloqueó el número en WhatsApp' : ''}` } } })
  emitirMsg(id, ev, null)
  await emitirContacto(c.contactoId, null)
  return ApiResponse.success(res, { spam, aviso })
}

/** Quitar el bloqueo en WhatsApp al sacar de spam (lo llama contactos al recibir `spam: null`). Nunca lanza. */
export async function desbloquearEnWhatsapp(contactoId: number): Promise<void> {
  try {
    const k = await prisma.crmContacto.findUnique({ where: { id: contactoId }, select: { telefono: true, extra: true } })
    const s = obj(obj(k?.extra).spam)
    const tel = txt(k?.telefono).replace(/\D/g, '')
    if (!s.bloqueado || !txt(s.linea) || !tel) return
    const linea = await prisma.crmLinea.findUnique({ where: { id: txt(s.linea) } })
    if (!linea) return
    await graph(`/${linea.phoneNumberId}/block_users`, { cred: await credDeLinea(linea), method: 'DELETE', body: { messaging_product: 'whatsapp', block_users: [{ user: tel }] } })
  } catch (e) {
    logger.warn(`[CRM spam] desbloquear ${contactoId}: ${(e as Error)?.message ?? e}`)
  }
}
