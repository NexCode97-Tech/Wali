import type { Request, Response } from 'express'
import { ApiResponse } from '../../utils/response'
import { ValidationError } from '../../utils/errors'
import { msgAFront } from '../../services/crm/formas'
import { cierre, colgar, contestar, llamadasEnCurso, llamar, pedirPermiso, permiso, rechazar } from '../../services/crm/llamadasVivo'
import { convVisible, exigirEscritura, idNum } from './_comun'

/**
 * Llamadas por WhatsApp desde la bandeja (llamadasVivo.ts). La oferta o respuesta SDP la arma el navegador de quien
 * atiende; aquí solo se valida y se pasa a Meta. Llamar, contestar y pedir permiso exigen ver la conversación y escribir en ella.
 */

/** Un SDP del navegador: texto que empieza por «v=0», con tope (los reales pesan 2 a 6 KB). */
function sdpDe(v: unknown): string {
  const s = typeof v === 'string' ? v : ''
  if (!s.startsWith('v=0') || s.length > 20_000) throw new ValidationError('La conexión de audio del navegador no es válida. Recarga la página e intenta de nuevo')
  return s
}
const idLlamada = (v: unknown) => {
  const s = String(v ?? '')
  if (!/^[\w.:=-]{4,200}$/.test(s)) throw new ValidationError('Esa llamada no existe')
  return s
}

/** GET /crm/llamadas: las que están en curso (al abrir el CRM con una sonando), solo de conversaciones que ve. */
export async function enCurso(req: Request, res: Response) {
  const out = []
  for (const l of llamadasEnCurso()) {
    try { await convVisible(req, Number(l.convId)); out.push(l) } catch { /* no la ve */ }
  }
  return ApiResponse.success(res, out)
}

/** POST /crm/llamadas/:id/contestar {sdp} */
export async function contestarLlamada(req: Request, res: Response) {
  exigirEscritura(req)
  await contestar(idLlamada(req.params.id), req.userId!, sdpDe(req.body?.sdp))
  return ApiResponse.success(res, { ok: true })
}

/** POST /crm/llamadas/:id/rechazar */
export async function rechazarLlamada(req: Request, res: Response) {
  exigirEscritura(req)
  await rechazar(idLlamada(req.params.id))
  return ApiResponse.success(res, { ok: true })
}

/** POST /crm/llamadas/:id/colgar */
export async function colgarLlamada(req: Request, res: Response) {
  await colgar(idLlamada(req.params.id))
  return ApiResponse.success(res, { ok: true })
}

/** POST /crm/llamadas/:id/cierre {audio?, nota?, sinGrabar?}: la grabación (ya subida) y la nota de quien atendió. */
export async function cierreLlamada(req: Request, res: Response) {
  const b = req.body ?? {}
  const audio = typeof b.audio === 'string' && /^https:\/\/\S{8,1900}$/.test(b.audio) ? b.audio : undefined
  const nota = typeof b.nota === 'string' && b.nota.trim() ? b.nota.trim().slice(0, 2000) : undefined
  const sinGrabar = typeof b.sinGrabar === 'string' && b.sinGrabar.trim() ? b.sinGrabar.trim().slice(0, 200) : undefined
  await cierre(idLlamada(req.params.id), req.userId!, { audio, nota, sinGrabar })
  return ApiResponse.success(res, { ok: true })
}

/** POST /crm/conversaciones/:id/llamar {sdp} */
export async function llamarCliente(req: Request, res: Response) {
  exigirEscritura(req)
  const convId = idNum(req.params.id)
  await convVisible(req, convId)
  return ApiResponse.success(res, await llamar(convId, req.userId!, sdpDe(req.body?.sdp)))
}

/** GET /crm/conversaciones/:id/permiso-llamada: si el cliente dio permiso y si se le puede pedir. */
export async function permisoLlamada(req: Request, res: Response) {
  const convId = idNum(req.params.id)
  await convVisible(req, convId)
  return ApiResponse.success(res, await permiso(convId))
}

/** POST /crm/conversaciones/:id/permiso-llamada {texto}: la solicitud de permiso, que sale por WhatsApp. */
export async function pedirPermisoLlamada(req: Request, res: Response) {
  exigirEscritura(req)
  const convId = idNum(req.params.id)
  await convVisible(req, convId)
  const texto = typeof req.body?.texto === 'string' ? req.body.texto.trim() : ''
  if (texto.length > 1024) throw new ValidationError('El mensaje de la solicitud pasa de 1.024 caracteres')
  const p = await permiso(convId)
  if (p.estado === 'permanent') throw new ValidationError('Ya te dio permiso para llamarle siempre: no hace falta pedirlo otra vez')
  // Sin plantillas (24-oct): fuera de la ventana de 24 h WhatsApp no deja mandar la solicitud libre; sale cuando vuelva a escribir.
  if (!p.ventana) throw new ValidationError('Pasaron más de 24 horas desde su último mensaje: la solicitud solo sale cuando te vuelva a escribir')
  if (!p.puedePedir) throw new ValidationError('WhatsApp deja mandar 1 solicitud al día y 2 por semana a cada persona. Ya se mandaron: intenta más adelante')
  return ApiResponse.success(res, msgAFront(await pedirPermiso(convId, req.userId!, texto)))
}
