import { Router, Request, Response, NextFunction } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import { logSecurityEvent } from '../utils/logger'
import { listaEmpresas, detalleEmpresa } from '../services/crm/superadmin'
import { resumenPanel, finanzasPanel, cobrosRecientes, atencion, type Rango } from '../services/crm/superadminFinanzas'

/**
 * API del panel de superadministrador (/api/admin). Solo lectura y solo para el operador de la plataforma.
 * A cualquier otra persona le responde 404, como si la ruta no existiera.
 */
const router = Router()

router.use(rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false, keyGenerator: req => req.headers.authorization?.slice(-20) || req.ip || 'anon' }))
router.use(authenticate)
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

export default router
