import { Router, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import { asyncHandler } from '../middleware/errorHandler'
import { ApiResponse } from '../utils/response'
import { ValidationError } from '../utils/errors'
import { convVisible, exigirEscritura, idNum, obj } from '../controllers/crm/_comun'
import { alcanceDe } from '../services/crm/alcance'
import { emitirMiIa } from '../services/crm/iaMiIa'
import { logger } from '../utils/logger'
import { MAX_EVITAR, pedirSugerencia, registrarResultado, type AccionResultado, type OrigenSugerencia } from '../services/crm/iaSugerencias'

/**
 * Sugerencia de respuesta de la IA de cada persona (lote 5, tablero 10). Va dentro del router del CRM (sesión,
 * acceso y espacio) por `rutasIaCrm` (crmIa.ts).
 *
 * - POST /api/crm/ia/sugerencia {convId, origen: 'mensaje'|'boton', otra?, evitar?} → {sugerencia: {id, texto} | null}.
 *   Quien puede escribir y ve la conversación (alcance del lote 4). Nunca envía ni guarda mensajes.
 * - POST /api/crm/ia/sugerencia/resultado {id, accion: 'mostrada'|'usada'|'descartada'|'enviada', sinCambios?} → {ok: true}.
 *   Solo cuenta para una sugerencia entregada a quien llama; «usada» y «enviada» sin cambios le mandan en vivo a esa
 *   persona «Esta semana» de Mi IA (ia-mi).
 */
export const rutasIaSugerencias = Router()

const POR_MINUTO = 20
const limite = rateLimit({
  windowMs: 60 * 1000,
  max: POR_MINUTO,
  keyGenerator: req => `crm-ia-sugerencia:${req.userId ?? 'anon'}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Vas muy rápido: espera un momento y vuelve a pedir la sugerencia.' },
})

const MAX_LARGO_EVITAR = 1_000

rutasIaSugerencias.post('/ia/sugerencia', limite, asyncHandler(async (req: Request, res: Response) => {
  exigirEscritura(req)
  const b = obj(req.body)
  const convId = idNum(b.convId)
  if (b.origen !== 'mensaje' && b.origen !== 'boton') throw new ValidationError('Falta de dónde se pide la sugerencia (mensaje o botón).')
  const origen = b.origen as OrigenSugerencia
  if (b.evitar !== undefined && !Array.isArray(b.evitar)) throw new ValidationError('Las sugerencias que se quieren evitar van en una lista.')
  const evitar = (Array.isArray(b.evitar) ? b.evitar : []).filter((t): t is string => typeof t === 'string')
    .map(t => t.trim().slice(0, MAX_LARGO_EVITAR)).filter(Boolean).slice(-MAX_EVITAR)
  const c = await convVisible(req, convId)
  const sugerencia = await pedirSugerencia({ userId: req.userId!, c, origen, otra: b.otra === true, evitar })
  return ApiResponse.success(res, { sugerencia })
}))

const ACCIONES = new Set<AccionResultado>(['mostrada', 'usada', 'descartada', 'enviada'])

// Cada sugerencia deja a lo sumo cuatro resultados (mostrada, usada, enviada o descartada): 80 por minuto sobra.
const limiteResultados = rateLimit({
  windowMs: 60 * 1000,
  max: POR_MINUTO * 4,
  keyGenerator: req => `crm-ia-resultado:${req.userId ?? 'anon'}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Vas muy rápido: espera un momento.' },
})

rutasIaSugerencias.post('/ia/sugerencia/resultado', limiteResultados, asyncHandler(async (req: Request, res: Response) => {
  exigirEscritura(req)
  const b = obj(req.body)
  const id = typeof b.id === 'string' ? b.id.trim() : ''
  if (!/^sg_[a-z0-9]{6,40}$/i.test(id)) throw new ValidationError('Esa sugerencia no es válida.')
  if (!ACCIONES.has(b.accion as AccionResultado)) throw new ValidationError('Falta qué se hizo con la sugerencia (mostrada, usada, descartada o enviada).')
  const sumo = await registrarResultado(req.userId!, id, b.accion as AccionResultado, b.sinCambios === true)
  // «Esta semana» de Mi IA (usadas y sin cambios) se ve en vivo en todas las pestañas de esa persona, y solo en las suyas.
  if (sumo === 'usadas' || sumo === 'sinCambios') {
    try { await emitirMiIa(req.userId!, req.userRole, req.userId!, (await alcanceDe(req)).equipos) } catch (e) {
      logger.warn(`[CRM IA] sugerencia: no se pudo avisar «Esta semana» (${e instanceof Error ? e.message.slice(0, 120) : 'error'})`)
    }
  }
  return ApiResponse.success(res, { ok: true })
}))
