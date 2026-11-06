import { Router, Request, Response } from 'express'
import { firmaWhopValida, procesarAvisoWhop } from '../services/crm/plan'
import { logger, logSecurityEvent } from '../utils/logger'

/**
 * Avisos de Whop (POST /api/pagos/whop): membresías (activa, en prueba, cobro pendiente, cancelada) y cobros. El cuerpo
 * llega crudo (index.ts) porque la firma se verifica sobre los bytes exactos. Sin firma válida no se toca nada.
 * Whop reintenta si no se responde 2xx en menos de 5 segundos; los avisos repetidos no duplican nada.
 */
const router = Router()

router.post('/', async (req: Request, res: Response) => {
  const cuerpo = Buffer.isBuffer(req.body) ? req.body : Buffer.from('')
  if (!firmaWhopValida(cuerpo, req.header('webhook-id'), req.header('webhook-timestamp'), req.header('webhook-signature'))) {
    logSecurityEvent('WHOP_FIRMA_INVALIDA', { ip: req.ip })
    res.status(401).json({ ok: false })
    return
  }
  try {
    await procesarAvisoWhop(JSON.parse(cuerpo.toString('utf8')))
    res.json({ ok: true })
  } catch (e) {
    // 500 para que Whop reintente el aviso.
    logger.error({ evento: 'WHOP_AVISO_FALLO', err: (e as Error).message })
    res.status(500).json({ ok: false })
  }
})

export default router
