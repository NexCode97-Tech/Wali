import type { CrmLinea } from '@prisma/client'
import { logger } from '../../utils/logger'
import { flujoContinuar, flujoIniciar } from './flujos'
import { agenteContinuar, agenteIniciar } from './agenteIA'
import { dispararReglas } from './reglas'

/**
 * Qué pasa con cada mensaje que entra por WhatsApp o por el chat de la web, en un solo lugar
 * (26-sep-2026). Orden:
 *  1. Si la conversación está en medio de un flujo (bienvenida…), el flujo sigue.
 *  2. Si la está atendiendo un agente IA, el agente sigue.
 *  3. Si es el primer contacto, lo toma el agente IA (si «Quién atiende el
 *     primer contacto» es el agente y hay uno encendido para ese canal) o el
 *     flujo encendido que corresponda. Si ninguno, se reparte de una.
 *  4. Las reglas automáticas de «Llega un mensaje nuevo» corren siempre.
 * Devuelve `tomado`: si un flujo o un agente se hizo cargo, el reparto lo hace
 * él al terminar (paso «Pasar al asesor»), no quien llama.
 */
export interface CtxEntrante {
  convId: number
  msgId: string
  /** La línea de WhatsApp; null en el chat de la página web. */
  linea: CrmLinea | null
  /** Conversación recién creada. */
  nueva: boolean
  /** Conversación finalizada que se reabrió con este mensaje. */
  reabierta: boolean
  /** Lote 6b: la conversación finalizada a la que la persona vuelve a escribir (la misma si se reabrió); null si no venía de una. */
  vuelveDe?: number | null
  /** El contacto se creó con este mensaje (nunca había escrito). */
  contactoNuevo: boolean
  /** Texto del mensaje (o título del botón o fila elegidos). */
  texto: string
  /** Respuesta a un botón o a una lista: id de la opción. */
  respuestaId: string | null
}

export async function alEntrarMensaje(ctx: CtxEntrante): Promise<{ tomado: boolean; atiendeBot: boolean }> {
  let tomado = false
  // Primero «La persona vuelve a escribir después de finalizar» (lote 6b): si una regla le devuelve la etapa, los
  // flujos, el agente y las reglas de «Llega un mensaje nuevo» ya la ven en esa etapa.
  if (ctx.vuelveDe) await dispararReglas('vuelve', ctx.convId, { previa: ctx.vuelveDe, texto: ctx.texto, msgId: ctx.msgId }).catch(e => { logger.error(`[CRM reglas] vuelve ${ctx.convId}: ${(e as Error)?.message ?? e}`) })
  try {
    tomado = (await flujoContinuar(ctx)) || (await agenteContinuar(ctx))
    // agenteIniciar solo toma una conversación que no es nueva si un agente responde siempre en ese canal.
    if (!tomado) tomado = (await agenteIniciar(ctx)) || ((ctx.nueva || ctx.reabierta) && (await flujoIniciar(ctx)))
  } catch (e) {
    logger.error(`[CRM automatizaciones] conversación ${ctx.convId}: ${(e as Error)?.message ?? e}`)
  }
  // Las reglas corren siempre; si una pone al agente IA a contestar (la de noche), cuenta como tomada.
  const r = await dispararReglas('mensaje', ctx.convId, { texto: ctx.texto, msgId: ctx.msgId, tomado }).catch(e => { logger.error(`[CRM reglas] mensaje ${ctx.convId}: ${(e as Error)?.message ?? e}`); return null })
  if (r?.agente) tomado = true
  return { tomado, atiendeBot: tomado }
}
