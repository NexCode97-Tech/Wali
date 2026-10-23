import { Router, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import { asyncHandler } from '../middleware/errorHandler'
import { ApiResponse } from '../utils/response'
import { ValidationError } from '../utils/errors'
import { leerAjuste, guardarAjuste } from '../services/crm/ajustes'
import { logger } from '../utils/logger'

/**
 * Ayuda de Wali (maqueta aprobada «AyudaWali»): el asistente propio, sin IA, responde en el navegador con sus guías
 * (pantalla/js/89-ayuda*.js). Aquí solo se guarda lo que sirve para escribir guías nuevas: las preguntas que no entendió
 * y los «¿Te sirvió?». Va en el ajuste `_ayuda` del espacio, con tope, para el futuro panel de superadministrador.
 *
 * - POST /api/crm/ayuda/sin-respuesta {q}   → la pregunta que no encontró guía
 * - POST /api/crm/ayuda/util {guia, util}    → «Sí» o «No» en una guía
 */
export const rutasAyudaCrm = Router()

const CLAVE = '_ayuda'
const MAX_PREGUNTAS = 300
const limite = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false })

type Ayuda = { sinRespuesta: { q: string; en: string }[]; util: Record<string, { si: number; no: number }> }
async function leer(): Promise<Ayuda> {
  const v = await leerAjuste<Partial<Ayuda>>(CLAVE)
  return { sinRespuesta: Array.isArray(v?.sinRespuesta) ? v!.sinRespuesta : [], util: v?.util && typeof v.util === 'object' ? v.util : {} }
}
const limpio = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '')

rutasAyudaCrm.post('/ayuda/sin-respuesta', limite, asyncHandler(async (req: Request, res: Response) => {
  const q = limpio(req.body?.q, 200)
  if (q.length < 2) throw new ValidationError('Falta la pregunta')
  const a = await leer()
  a.sinRespuesta = [{ q, en: new Date().toISOString() }, ...a.sinRespuesta].slice(0, MAX_PREGUNTAS)
  await guardarAjuste(CLAVE, a, req.userId ?? null)
  logger.info(`[CRM ayuda] sin respuesta: ${q}`)
  return ApiResponse.success(res, { ok: true })
}))

rutasAyudaCrm.post('/ayuda/util', limite, asyncHandler(async (req: Request, res: Response) => {
  const guia = limpio(req.body?.guia, 60)
  if (!/^[a-z0-9-]{2,60}$/.test(guia)) throw new ValidationError('Esa guía no existe')
  const a = await leer()
  const c = a.util[guia] ?? { si: 0, no: 0 }
  if (req.body?.util === true) c.si++; else c.no++
  a.util[guia] = c
  await guardarAjuste(CLAVE, a, req.userId ?? null)
  return ApiResponse.success(res, { ok: true })
}))
