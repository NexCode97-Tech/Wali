import { Router, type NextFunction, type Request, type Response } from 'express'
import { asyncHandler } from '../middleware/errorHandler'
import { ApiResponse } from '../utils/response'
import { ValidationError } from '../utils/errors'
import { logger } from '../utils/logger'
import { convVisible, exigirEscritura, idNum, obj, txt } from '../controllers/crm/_comun'
import { alcanceDe, equiposDeReq } from '../services/crm/alcance'
import { msgAFront } from '../services/crm/formas'
import { cfgEncuesta, contarEncuestaDeTexto, enviarEncuesta, formulariosPorLinea, informeEncuestas, migrarUltimas, prepararFormulariosEn, type FiltrosInforme } from '../services/crm/encuesta'

/**
 * Encuesta al finalizar (lote 6), dentro del router del CRM (sesión, acceso y espacio): crm.ts hace
 * `router.use(rutasEncuestaCrm)` antes de las rutas de la bandeja. Servicio en services/crm/encuesta.ts y contrato en
 * docs/crm/api-core.md («Encuesta al finalizar (lote 6)»).
 *
 * - GET /api/crm/encuesta → {cfg, formularios: {[lineaId]: {estado, error, reintento}}}. Cualquier persona del CRM.
 * - GET /api/crm/encuestas?dias=7|30|90&equipo=&asesor=&respuestas=todas|bajas|comentario&limite=20..500 → Informes ›
 *   Encuestas, según el alcance de quien pregunta.
 * - POST /api/crm/conversaciones/:id/mensajes con `datos.ev === 'star' && datos.encuesta === true` → 201 con el evento
 *   de la encuesta (lo pide la pantalla al finalizar, por la cola de mensajes de la conversación). Lo demás pasa de
 *   largo a la ruta de siempre. Nunca responde 4xx por un motivo de negocio: el evento dice por qué no salió.
 * - PUT /api/crm/ajustes/cfg → pasa de largo; si se guardó bien y la encuesta está prendida, prepara los formularios.
 * - GET /api/crm/inicio → pasa de largo después de la migración única de las encuestas de antes, así la pantalla ya trae
 *   `_encuestaUltima` de cada contacto desde la primera carga.
 */
export const rutasEncuestaCrm = Router()

rutasEncuestaCrm.get('/inicio', (_req: Request, _res: Response, next: NextFunction) => {
  migrarUltimas()
    .catch(e => logger.warn(`[CRM encuesta] migración de encuestas de antes: ${(e as Error)?.message ?? e}`))
    .finally(() => next())
})

rutasEncuestaCrm.get('/encuesta', asyncHandler(async (_req: Request, res: Response) => {
  await migrarUltimas().catch(e => logger.warn(`[CRM encuesta] migración de encuestas de antes: ${(e as Error)?.message ?? e}`))
  const [cfg, formularios] = await Promise.all([cfgEncuesta(), formulariosPorLinea()])
  return ApiResponse.success(res, { cfg, formularios })
}))

const DIAS_INFORME = [7, 30, 90]
const RESPUESTAS = ['todas', 'bajas', 'comentario'] as const

rutasEncuestaCrm.get('/encuestas', asyncHandler(async (req: Request, res: Response) => {
  const q = req.query
  const dias = q.dias === undefined || q.dias === '' ? 30 : Number(q.dias)
  if (!DIAS_INFORME.includes(dias)) throw new ValidationError('El periodo puede ser de 7, 30 o 90 días.')
  const respuestas = (txt(q.respuestas) || 'todas') as FiltrosInforme['respuestas']
  if (!RESPUESTAS.includes(respuestas)) throw new ValidationError('«respuestas» puede ser todas, bajas o comentario.')
  const limiteCrudo = q.limite === undefined || q.limite === '' ? 20 : Number(q.limite)
  if (!Number.isFinite(limiteCrudo)) throw new ValidationError('«limite» va como número, de 20 a 500.')
  const limite = Math.min(500, Math.max(20, Math.round(limiteCrudo)))
  const filtros: FiltrosInforme = { dias, equipo: txt(q.equipo).slice(0, 80), asesor: txt(q.asesor).slice(0, 80), respuestas, limite }
  const a = await alcanceDe(req)
  return ApiResponse.success(res, await informeEncuestas(a, await equiposDeReq(req), filtros))
}))

rutasEncuestaCrm.post('/conversaciones/:id/mensajes', asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const datos = obj(obj(req.body).datos)
  if (datos.ev === 'star' && datos.encuesta !== true) {
    // La encuesta de texto de antes (una pestaña sin recargar o un canal que no es WhatsApp): sigue por la ruta de siempre
    // y, si quedó guardada, cuenta para los días sin repetir de la persona.
    const espacio = req.espacioId, convId = Number(req.params.id)
    if (espacio && Number.isInteger(convId)) {
      res.on('finish', () => {
        if (res.statusCode >= 300) return
        contarEncuestaDeTexto(espacio, convId).catch(e => logger.warn(`[CRM encuesta] encuesta de texto de la conversación ${convId}: ${(e as Error)?.message ?? e}`))
      })
    }
    return next()
  }
  if (datos.ev !== 'star' || datos.encuesta !== true) return next()
  exigirEscritura(req)
  const id = idNum(req.params.id)
  await convVisible(req, id)
  const cid = typeof datos.cid === 'string' && /^[\w-]{1,64}$/.test(datos.cid) ? datos.cid : null
  // El texto lo escribe el servidor: el que mande la pantalla se ignora.
  const ev = await enviarEncuesta(id, req.userId!, cid)
  return ApiResponse.created(res, msgAFront(ev))
}))

rutasEncuestaCrm.put('/ajustes/cfg', (req: Request, res: Response, next: NextFunction) => {
  const espacio = req.espacioId
  if (espacio) {
    res.on('finish', () => {
      if (res.statusCode >= 300) return
      prepararFormulariosEn(espacio, { forzar: true }).catch(e => logger.warn(`[CRM encuesta] preparar formularios al guardar Ajustes: ${(e as Error)?.message ?? e}`))
    })
  }
  next()
})
