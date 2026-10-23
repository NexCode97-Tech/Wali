import { Router, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import { asyncHandler } from '../middleware/errorHandler'
import { ApiResponse } from '../utils/response'
import { ValidationError } from '../utils/errors'
import { leerAjuste, guardarAjuste } from '../services/crm/ajustes'
import { logger } from '../utils/logger'
import { buscarPorSignificado } from '../services/crm/ayudaSemantica'

/**
 * Ayuda de Wali (maqueta aprobada «AyudaWali»): el asistente propio, sin IA, responde en el navegador con sus guías
 * (pantalla/js/89-ayuda*.js). Aquí solo se guarda lo que sirve para escribir guías nuevas: las preguntas que no entendió
 * y los «¿Te sirvió?». Va en el ajuste `_ayuda` del espacio, con tope, para el futuro panel de superadministrador.
 *
 * - POST /api/crm/ayuda/sin-respuesta {q}   → la pregunta que no encontró guía
 * - POST /api/crm/ayuda/util {guia, util}    → «Sí» o «No» en una guía
 * - POST /api/crm/ayuda/semantica {q}       → las guías más parecidas en significado (ayudaSemantica.ts)
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

const limiteBusqueda = rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false })
rutasAyudaCrm.post('/ayuda/semantica', limiteBusqueda, asyncHandler(async (req: Request, res: Response) => {
  const q = limpio(req.body?.q, 200)
  if (q.length < 2) throw new ValidationError('Falta la pregunta')
  return ApiResponse.success(res, { guias: await buscarPorSignificado(q) })
}))

/* Historial de cada persona (maqueta aprobada «astronauta, volver e historial»): sus últimas 20 conversaciones con la
   ayuda, en el ajuste `_ayudaHist:<persona>`. Solo partes conocidas y con tope: nada de HTML. */
const ID_GUIA = /^[a-z0-9-]{2,60}$/
type Parte = Record<string, unknown>
function parteLimpia(p: unknown): Parte | null {
  if (!p || typeof p !== 'object') return null
  const x = p as Record<string, unknown>
  const ids = (v: unknown) => (Array.isArray(v) ? v.filter(i => typeof i === 'string' && ID_GUIA.test(i)).slice(0, 3) : [])
  if (typeof x.y === 'string') return { y: limpio(x.y, 200) }
  if (typeof x.g === 'string' && ID_GUIA.test(x.g)) return { g: x.g, ...(x.e ? { e: 1 } : {}), ...(Array.isArray(x.o) ? { o: ids(x.o) } : {}) }
  if (typeof x.c === 'string') return { c: limpio(x.c, 200) }
  if (typeof x.n === 'string') return { n: limpio(x.n, 200), o: ids(x.o) }
  if (typeof x.s === 'string') return { s: limpio(x.s, 200) }
  return null
}
const claveHist = (req: Request) => `_ayudaHist:${req.userId ?? ''}`
rutasAyudaCrm.get('/ayuda/historial', asyncHandler(async (req: Request, res: Response) => {
  const v = await leerAjuste<{ convs?: unknown[] }>(claveHist(req))
  return ApiResponse.success(res, { convs: Array.isArray(v?.convs) ? v!.convs : [] })
}))
rutasAyudaCrm.put('/ayuda/historial', limite, asyncHandler(async (req: Request, res: Response) => {
  if (!req.userId) throw new ValidationError('Falta la sesión')
  const entrada = Array.isArray(req.body?.convs) ? req.body.convs.slice(0, 20) : []
  const convs = entrada.map((c: Record<string, unknown>) => ({
    id: limpio(c?.id, 40), t: limpio(c?.t, 80), en: typeof c?.en === 'string' && !Number.isNaN(Date.parse(c.en)) ? c.en : new Date().toISOString(),
    items: (Array.isArray(c?.items) ? c.items : []).slice(-40).map(parteLimpia).filter(Boolean),
  })).filter((c: { id: string; items: unknown[] }) => c.id && c.items.length)
  await guardarAjuste(claveHist(req), { convs }, req.userId)
  return ApiResponse.success(res, { ok: true })
}))
