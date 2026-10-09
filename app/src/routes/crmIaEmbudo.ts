import { Router, type Request, type Response } from 'express'
import { asyncHandler } from '../middleware/errorHandler'
import { ApiResponse } from '../utils/response'
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors'
import { convVisible, exigirEscritura, idNum, obj } from '../controllers/crm/_comun'
import { alcanceDe, puedeAdministrar, type Alcance } from '../services/crm/alcance'
import { cargarConv } from '../services/crm/formas'
import {
  ES_PAGO, MAX_CRITERIO, criterioLimpio, deshacerMovimiento, etapasDelEquipo, guardarCfgEquipo, hoyPorEquipo, leerCfgEmbudo,
  type CfgEquipoEmbudo,
} from '../services/crm/iaEmbudo'

/**
 * Embudo automático (lote 5, tablero 8). Va dentro del router del CRM (sesión, acceso y espacio) por `rutasIaCrm`
 * (crmIa.ts).
 *
 * - GET /api/crm/ia/embudo → {equipos: {[equipo]: {on, soloAvanzar, seguro, criterios}}, hoy: {[equipo]: {movidas,
 *   deshechas, pagos}}}, solo con los equipos que la persona administra: la configuración general (ADMIN o
 *   LIDER_VENTAS) y el administrador sin equipo, todos; el líder, los que lidera. Sin ninguno, 403.
 * - PUT /api/crm/ia/embudo/:equipo {on?, soloAvanzar?, seguro?, criterios?: {[etapa]: texto}} → igual que el GET;
 *   emite `ia-embudo` con la configuración.
 * - POST /api/crm/ia/embudo/deshacer/:convId → la conversación (forma de la bandeja). Quien la ve y puede escribir.
 *   409 si la etapa ya cambió después del cambio de la IA o si ya se deshizo; 404 si no hay cambio de la IA.
 */
export const rutasIaEmbudo = Router()

const SIN_PERMISO = 'Solo los líderes de cada equipo y los administradores pueden ver el embudo automático.'

function administrables(a: Alcance, todos: string[]): string[] {
  return a.config || a.todo ? todos : todos.filter(eq => a.lidera.includes(eq))
}

async function vista(equipos: string[], cfg: Record<string, CfgEquipoEmbudo>) {
  const hoy = await hoyPorEquipo()
  return {
    equipos: Object.fromEntries(equipos.map(eq => [eq, cfg[eq]])),
    hoy: Object.fromEntries(equipos.map(eq => [eq, hoy[eq] ?? { movidas: 0, deshechas: 0, pagos: 0 }])),
  }
}

rutasIaEmbudo.get('/ia/embudo', asyncHandler(async (req: Request, res: Response) => {
  const a = await alcanceDe(req)
  const cfg = await leerCfgEmbudo()
  const eqs = administrables(a, Object.keys(cfg))
  if (!eqs.length) throw new ForbiddenError(SIN_PERMISO)
  return ApiResponse.success(res, await vista(eqs, cfg))
}))

rutasIaEmbudo.put('/ia/embudo/:equipo', asyncHandler(async (req: Request, res: Response) => {
  exigirEscritura(req)
  const equipo = String(req.params.equipo ?? '').trim()
  const a = await alcanceDe(req)
  if (!a.config && !puedeAdministrar(a, equipo)) throw new ForbiddenError(`Solo el líder de ${equipo || 'ese equipo'} o un administrador puede cambiar su embudo automático.`)
  const antes = await leerCfgEmbudo()
  if (!antes[equipo]) throw new NotFoundError(`El equipo «${equipo}» ya no existe. Recarga la página.`)

  const b = obj(req.body)
  const cambios: Partial<CfgEquipoEmbudo> = {}
  const interruptores: [keyof CfgEquipoEmbudo, string][] = [['on', 'Mover las conversaciones con IA'], ['soloAvanzar', 'Solo avanzar'], ['seguro', 'Si no está segura, no la mueve']]
  for (const [k, rotulo] of interruptores) {
    if (b[k] === undefined) continue
    if (typeof b[k] !== 'boolean') throw new ValidationError(`«${rotulo}» va como verdadero o falso.`)
    ;(cambios as Record<string, unknown>)[k] = b[k]
  }
  if (b.criterios !== undefined) {
    if (!b.criterios || typeof b.criterios !== 'object' || Array.isArray(b.criterios)) throw new ValidationError('Los criterios van como {etapa: texto}.')
    const etapas = (await etapasDelEquipo(equipo)).filter(e => !ES_PAGO.test(e))
    const criterios: Record<string, string> = {}
    for (const [etapa, t] of Object.entries(obj(b.criterios))) {
      if (!etapas.includes(etapa)) throw new ValidationError(ES_PAGO.test(etapa) ? `${etapa} no lleva criterio: la pone Hotmart cuando confirma el pago.` : `«${etapa}» no es una etapa de ${equipo}. Recarga la página.`)
      if (t !== null && typeof t !== 'string') throw new ValidationError(`El criterio de ${etapa} va como texto.`)
      const limpio = criterioLimpio(t)
      if (limpio.length > MAX_CRITERIO) throw new ValidationError(`El criterio de ${etapa} puede tener máximo ${MAX_CRITERIO} caracteres.`)
      criterios[etapa] = limpio
    }
    cambios.criterios = criterios
  }
  if (!Object.keys(cambios).length) throw new ValidationError('No llegó ningún cambio. Manda on, soloAvanzar, seguro o criterios.')

  const cfg = await guardarCfgEquipo(equipo, cambios, req.userId!)
  return ApiResponse.success(res, await vista(administrables(a, Object.keys(cfg)), cfg))
}))

rutasIaEmbudo.post('/ia/embudo/deshacer/:convId', asyncHandler(async (req: Request, res: Response) => {
  exigirEscritura(req)
  const id = idNum(req.params.convId)
  await convVisible(req, id)
  await deshacerMovimiento(id, req.userId!)
  return ApiResponse.success(res, await cargarConv(id))
}))
