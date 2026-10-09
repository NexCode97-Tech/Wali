import { Router, Request, Response } from 'express'
import { firmaValida, procesarAvisoCreem } from '../services/crm/plan'
import { logger, logSecurityEvent } from '../utils/logger'

/**
 * Avisos de Creem (POST /api/pagos/creem): pagos, renovaciones, cobros fallidos y cancelaciones. El cuerpo llega
 * crudo (index.ts) porque la firma se verifica sobre los bytes exactos. Sin firma válida no se toca nada.
 */
const router = Router()

router.post('/', async (req: Request, res: Response) => {
  const cuerpo = Buffer.isBuffer(req.body) ? req.body : Buffer.from('')
  if (!firmaValida(cuerpo, req.header('creem-signature'))) {
    logSecurityEvent('CREEM_FIRMA_INVALIDA', { ip: req.ip })
    res.status(401).json({ ok: false })
    return
  }
  try {
    await procesarAvisoCreem(JSON.parse(cuerpo.toString('utf8')))
    res.json({ ok: true })
  } catch (e) {
    // 500 para que Creem reintente el aviso.
    logger.error({ evento: 'CREEM_AVISO_FALLO', err: (e as Error).message })
    res.status(500).json({ ok: false })
  }
})

export default router
