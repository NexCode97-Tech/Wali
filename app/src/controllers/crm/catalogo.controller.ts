import type { Request, Response } from 'express'
import { ApiResponse } from '../../utils/response'

/**
 * GET /crm/catalogo: productos, medios de pago y el enlace de pago de quien pide, para el botón «Enlace de pago»
 * del cuadro de escribir. Forma: { catalogo: [{ p, c, id, pagos: [{ m, d, pr, url? }] }], faltantes, fuente, asesor }.
 *
 * Es un punto de extensión: de fábrica no hay catálogo conectado y la lista sale vacía (el botón no ofrece nada).
 * Para conectarlo, se arma aquí la lista desde la pasarela o la tienda de la empresa.
 */
export async function catalogo(_req: Request, res: Response) {
  ApiResponse.success(res, { catalogo: [], faltantes: [], fuente: 'sin-hoja', asesor: null, actualizado: new Date().toISOString() })
}
