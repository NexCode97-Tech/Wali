import { Router, Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { asyncHandler } from '../middleware/errorHandler'
import { authenticate } from '../middleware/auth'
import { ApiResponse } from '../utils/response'

/** La campana: los avisos guardados de quien pide (services/notificaciones.ts). */
const router = Router()
router.use(authenticate)

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const [avisos, sinLeer] = await Promise.all([
    prisma.notificacion.findMany({ where: { userId: req.userId! }, orderBy: { createdAt: 'desc' }, take: 40, select: { id: true, tipo: true, titulo: true, texto: true, url: true, leidaEn: true, createdAt: true } }),
    prisma.notificacion.count({ where: { userId: req.userId!, leidaEn: null } }),
  ])
  return ApiResponse.success(res, { avisos, sinLeer })
}))

/** Marca como leídos: uno (`id`) o todos. La cuenta de solo lectura también puede: son sus propios avisos. */
router.post('/leidas', asyncHandler(async (req: Request, res: Response) => {
  const id = typeof req.body?.id === 'string' ? req.body.id.slice(0, 40) : null
  await prisma.notificacion.updateMany({ where: { userId: req.userId!, leidaEn: null, ...(id ? { id } : {}) }, data: { leidaEn: new Date() } })
  return ApiResponse.success(res, { ok: true })
}))

export default router
