import { Router, Request, Response } from 'express'
import { asyncHandler } from '../middleware/errorHandler'
import { BASE } from '../utils/base'
import { leerAvisoFirmado, desautorizar, eliminarDatos } from '../services/crm/metaPrivacidad'

/**
 * Las direcciones que se ponen en la app de Meta (13-nov, services/crm/metaPrivacidad.ts):
 * - POST /api/meta/desautorizar («Deauthorize callback URL», en Facebook y en el inicio de sesión de Instagram).
 * - POST /api/meta/eliminar-datos («Data deletion request URL»): responde { url, confirmation_code }, como pide Meta.
 * Meta manda `signed_request` en un formulario; sin una firma válida de una de las apps de Wali no se hace nada.
 */
const r = Router()

/** La dirección pública del CRM (walicrm.com/crm), para la página del estado de la solicitud. */
const publica = (req: Request) => (process.env.API_PUBLIC_URL ?? '').trim().replace(/\/+$/, '') || `https://${req.get('host')}${BASE}`

r.post('/desautorizar', asyncHandler(async (req: Request, res: Response) => {
  const aviso = await leerAvisoFirmado(req.body?.signed_request)
  if (!aviso) { res.status(400).json({ error: 'Firma no válida' }); return }
  await desautorizar(aviso.usuario, aviso.desde)
  res.json({ ok: true })
}))

r.post('/eliminar-datos', asyncHandler(async (req: Request, res: Response) => {
  const aviso = await leerAvisoFirmado(req.body?.signed_request)
  if (!aviso) { res.status(400).json({ error: 'Firma no válida' }); return }
  const s = await eliminarDatos(aviso.usuario, aviso.desde)
  res.json({ url: `${publica(req)}/meta/borrado?codigo=${s.codigo}`, confirmation_code: s.codigo })
}))

export default r
