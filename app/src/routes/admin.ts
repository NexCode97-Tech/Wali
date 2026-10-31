import { Router, Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { authenticate } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import { logSecurityEvent } from '../utils/logger'
import { listaEmpresas, detalleEmpresa } from '../services/crm/superadmin'
import { resumenPanel, finanzasPanel, cobrosRecientes, atencion, type Rango } from '../services/crm/superadminFinanzas'
import { listaCupones, crearCupon, eliminarCupon } from '../services/crm/cupones'
import { listaSoporte, detalleSoporte, responderSoporte, cambiarEstadoSoporte, sinEntender } from '../services/crm/soporte'

/**
 * API del panel de superadministrador (/api/admin), solo para el operador de la plataforma. Todo es de lectura salvo los
 * cupones (crear y eliminar en Creem) y las respuestas de soporte. A cualquier otra persona, con o sin sesión, le responde 404, como si no existiera.
 */
const router = Router()

router.use(rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, keyGenerator: req => req.headers.authorization?.slice(-20) || req.ip || 'anon' }))
// Sin sesión válida también es 404: el panel no se deja ver ni por el código de error.
router.use((req: Request, res: Response, next: NextFunction) => {
  authenticate(req, res, err => err ? res.status(404).json({ success: false, error: 'Ruta no encontrada' }) : next())
})
router.use((req: Request, res: Response, next: NextFunction) => {
  if (req.operador) return next()
  logSecurityEvent('ACCESS_DENIED', { userId: req.userId, url: req.originalUrl, method: req.method, motivo: 'panel de superadministrador' })
  res.status(404).json({ success: false, error: 'Ruta no encontrada' })
})

router.get('/empresas', asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await listaEmpresas() })
}))

router.get('/empresas/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id)
  const e = /^[\w-]{1,60}$/.test(id) ? await detalleEmpresa(id) : null
  if (!e) return res.status(404).json({ success: false, error: 'Esa empresa no existe' })
  res.json({ success: true, data: e })
}))

const RANGOS: Rango[] = ['7d', '30d', '12m', 'todo']

router.get('/resumen', asyncHandler(async (req: Request, res: Response) => {
  const rango = (RANGOS as string[]).includes(String(req.query.rango)) ? req.query.rango as Rango : '12m'
  const [resumen, cobros, pendientes] = await Promise.all([resumenPanel(rango), cobrosRecientes(8), atencion()])
  res.json({ success: true, data: { ...resumen, cobros, atencion: pendientes } })
}))

router.get('/finanzas', asyncHandler(async (req: Request, res: Response) => {
  const mes = typeof req.query.mes === 'string' && /^\d{4}-\d{2}$/.test(req.query.mes) ? req.query.mes : undefined
  res.json({ success: true, data: await finanzasPanel(mes) })
}))

router.get('/cobros', asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await cobrosRecientes(200) })
}))

router.get('/cupones', asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await listaCupones() })
}))

const nuevoCupon = z.object({
  codigo: z.string().trim().min(3).max(30),
  tipo: z.enum(['porcentaje', 'fijo']),
  valor: z.number().int().positive().max(1_000_000),
  duracion: z.enum(['once', 'forever', 'repeating']),
  meses: z.number().int().min(1).max(36).optional(),
  planes: z.array(z.enum(['starter', 'growth', 'business'])).min(1).max(3),
  vence: z.string().datetime().optional(),
  maxUsos: z.number().int().positive().max(100_000).optional(),
}).refine(d => d.tipo !== 'porcentaje' || d.valor <= 100, { message: 'El porcentaje va de 1 a 100.' })
  .refine(d => d.duracion !== 'repeating' || !!d.meses, { message: 'Di cuántos meses dura el descuento.' })
  .refine(d => !d.vence || new Date(d.vence).getTime() > Date.now(), { message: 'La fecha de vencimiento ya pasó.' })

router.post('/cupones', asyncHandler(async (req: Request, res: Response) => {
  const d = nuevoCupon.parse(req.body)
  res.json({ success: true, data: await crearCupon(d, req.userName ?? req.userId ?? '') })
}))

router.delete('/cupones/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id)
  if (!/^[\w-]{1,80}$/.test(id)) return res.status(404).json({ success: false, error: 'Ese cupón no existe' })
  await eliminarCupon(id, req.userName ?? req.userId ?? '')
  res.json({ success: true })
}))

router.get('/soporte', asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await listaSoporte() })
}))
router.get('/soporte/sin-entender', asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await sinEntender() })
}))
const idSoporte = (req: Request) => { const id = Number(req.params.id); return Number.isInteger(id) && id > 0 ? id : 0 }
router.get('/soporte/:id', asyncHandler(async (req: Request, res: Response) => {
  const s = idSoporte(req) ? await detalleSoporte(idSoporte(req)) : null
  if (!s) return res.status(404).json({ success: false, error: 'Esa solicitud no existe' })
  res.json({ success: true, data: s })
}))
router.post('/soporte/:id/responder', asyncHandler(async (req: Request, res: Response) => {
  const d = z.object({ texto: z.string().trim().min(2).max(4000) }).parse(req.body)
  await responderSoporte(idSoporte(req), d.texto, req.userName ?? '')
  res.json({ success: true })
}))
router.post('/soporte/:id/estado', asyncHandler(async (req: Request, res: Response) => {
  const d = z.object({ estado: z.enum(['abierta', 'en_curso', 'resuelta']) }).parse(req.body)
  await cambiarEstadoSoporte(idSoporte(req), d.estado)
  res.json({ success: true })
}))

export default router
