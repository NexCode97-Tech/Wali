import { Router, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import { asyncHandler } from '../middleware/errorHandler'
import { EnlaceNoExiste, registrarClic } from '../services/crm/enlaces'

/**
 * El clic en un enlace de pauta del CRM (services/crm/enlaces.ts): público, sin sesión. La página
 * web lo pone en /w/<codigo> y manda aquí; pauta.js lo usa con los botones de WhatsApp de cualquier
 * página. Registra el clic y manda a WhatsApp con el mensaje escrito y su código.
 */
const router = Router()

const ipDe = (req: Request) => String(req.headers['x-real-ip'] ?? '').trim() || req.ip || 'anon'
// Más de 60 clics por minuto desde una IP no se cuentan (puede ser un robot), pero nadie se queda sin llegar a
// WhatsApp: detrás de la IP de un operador móvil hay mucha gente.
const limite = rateLimit({
  windowMs: 60_000, max: 60, keyGenerator: ipDe, standardHeaders: false, legacyHeaders: false,
  handler: (req, _res, next) => { (req as Request & { sinContar?: boolean }).sinContar = true; next() },
})

const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
function pagina(titulo: string, texto: string) {
  return `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titulo)}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#f4f7fb;color:#0f172a}div{max-width:360px;padding:28px;text-align:center}h1{font-size:18px;margin:0 0 8px}p{margin:0;color:#475569;font-size:14px;line-height:1.5}</style>
<div><h1>${esc(titulo)}</h1><p>${esc(texto)}</p></div></html>`
}

router.get('/:codigo', limite, asyncHandler(async (req: Request, res: Response) => {
  try {
    const url = await registrarClic(String(req.params.codigo), req.query as Record<string, unknown>, {
      ip: ipDe(req), ua: String(req.headers['user-agent'] ?? ''), referer: String(req.headers.referer ?? ''),
      contar: !(req as Request & { sinContar?: boolean }).sinContar,
    })
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Referrer-Policy', 'no-referrer')
    return res.redirect(302, url)
  } catch (e) {
    if (e instanceof EnlaceNoExiste) return res.status(404).type('html').send(pagina('Este enlace no existe', 'Puede que lo hayan borrado. Escríbele a la empresa por su WhatsApp o por su página.'))
    throw e
  }
}))

export default router
