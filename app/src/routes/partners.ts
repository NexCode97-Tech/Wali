import { Router, Request, Response } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { asyncHandler } from '../middleware/errorHandler'
import { ApiResponse } from '../utils/response'
import { ValidationError } from '../utils/errors'
import { logger } from '../utils/logger'
import { correoMarca, escaparHtml } from '../utils/correoMarca'

/**
 * Solicitudes del programa de partners (maqueta aprobada «Maquetas Wali», 13-oct): el formulario de
 * walicrm.com/partners llega aquí (mismo sitio, por /crm) y se reenvía por correo al equipo (CRM_CORREO_AYUDA).
 * Público y sin sesión: límite de 5 por hora por IP y un campo trampa para robots. No se guarda nada.
 */
const router = Router()

const ipCliente = (req: Request) => String(req.headers['x-real-ip'] ?? '').trim() || req.ip || 'anon'
const limite = rateLimit({
  windowMs: 60 * 60_000, max: 5, keyGenerator: ipCliente, standardHeaders: true, legacyHeaders: false,
  message: { success: false, error: 'Ya recibimos varias solicitudes desde aquí. Intenta de nuevo en una hora.' },
})

const TIPOS = ['Agencia de marketing', 'Consultor de ventas', 'Desarrollador o freelancer', 'Creador de contenido', 'Otro'] as const
const esquema = z.object({
  nombre: z.string().trim().min(3, 'Escribe tu nombre y apellido').max(80),
  correo: z.string().trim().email('Ese correo no se ve bien').max(120),
  whatsapp: z.string().trim().max(30).regex(/^[+\d\s()-]*$/, 'Escribe solo el número').optional().default(''),
  tipo: z.enum(TIPOS),
  como: z.string().trim().min(10, 'Cuéntanos un poco más de cómo recomendarías Wali').max(1000),
  // Campo trampa: las personas no lo ven; si viene lleno, es un robot.
  sitio: z.string().optional().default(''),
})

router.post('/solicitud', limite, asyncHandler(async (req: Request, res: Response) => {
  const r = esquema.safeParse(req.body ?? {})
  if (!r.success) throw new ValidationError(r.error.issues[0]?.message ?? 'Revisa los datos del formulario')
  const d = r.data
  if (d.sitio) { logger.info('[partners] solicitud descartada por el campo trampa'); return ApiResponse.success(res, { ok: true }) }

  const para = process.env.CRM_CORREO_AYUDA || 'nexcode97@gmail.com'
  if (!process.env.RESEND_API_KEY) { logger.warn({ evento: 'PARTNER_SIN_CORREO' }); return ApiResponse.success(res, { ok: true }) }
  const fila = (k: string, v: string) => `<strong style="color:#0a0a0d">${escaparHtml(k)}:</strong> ${escaparHtml(v || '—')}`
  const html = correoMarca({
    preencabezado: `${d.nombre} quiere ser partner de Wali.`,
    titulo: 'Nueva solicitud de partner',
    parrafos: [fila('Nombre', d.nombre), fila('Correo', d.correo), fila('WhatsApp', d.whatsapp), fila('Qué hace', d.tipo), fila('Cómo recomendaría Wali', d.como)],
    nota: 'Responde este correo para escribirle directamente.',
  })
  const texto = `Nueva solicitud de partner\n\nNombre: ${d.nombre}\nCorreo: ${d.correo}\nWhatsApp: ${d.whatsapp || '—'}\nQué hace: ${d.tipo}\nCómo recomendaría Wali: ${d.como}`
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.CRM_CORREO_DE || 'Wali <hola@walicrm.com>', reply_to: d.correo, to: [para], subject: `Partner: ${d.nombre} (${d.tipo})`, html, text: texto }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!resp.ok) { logger.error(`[partners] Resend ${resp.status}: ${(await resp.text()).slice(0, 200)}`); throw new ValidationError('No pudimos enviar tu solicitud. Escríbenos a ' + para) }
  logger.info('[partners] solicitud enviada')
  return ApiResponse.success(res, { ok: true })
}))

export default router
