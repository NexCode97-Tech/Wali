import { Router, type Request, type Response } from 'express'
import { asyncHandler } from '../middleware/errorHandler'
import { ApiResponse } from '../utils/response'
import { ForbiddenError, ValidationError } from '../utils/errors'
import { exigirEscritura, obj } from '../controllers/crm/_comun'
import { alcanceDe } from '../services/crm/alcance'
import { borrarAprendido, emitirMiIa, guardarMiIa, miIaParaPantalla, aprenderNoche, type MiIa } from '../services/crm/iaMiIa'
import { MODELO_HAIKU, MODELO_SUGERENCIAS, fijarRelojIA, llamarIA, textoDe } from '../services/crm/iaComun'
import { reglasPorPago } from '../services/crm/reglas'
import { rutasIaSugerencias } from './crmIaSugerencias'
import { rutasIaEmbudo } from './crmIaEmbudo'
import { analizarConversacion, embudoPendientes } from '../services/crm/iaEmbudo'

/**
 * La IA del CRM (lote 5), dentro del router del CRM (sesión, acceso y espacio): crm.ts hace
 * `router.use(rutasIaCrm)`. Monta también las rutas de las sugerencias (crmIaSugerencias.ts) y del embudo
 * automático (crmIaEmbudo.ts).
 *
 * Mi IA es privada: estas rutas usan siempre a quien hace la petición (req.userId) y no reciben el id de nadie;
 * ni el líder ni el administrador tienen cómo ver lo que aprendió la IA de otra persona.
 * - GET /api/crm/ia/mi-ia → MiIaPantalla.
 * - PUT /api/crm/ia/mi-ia {on?, cuando?: 'mensaje'|'pedir', kb?} → MiIaPantalla; emite `ia-mi` solo a esa persona.
 * - DELETE /api/crm/ia/mi-ia/aprendido → borra rasgos, temas y conteos (conserva los interruptores); emite `ia-mi`.
 * - POST /api/crm/ia/pruebas/correr: solo existe con CRM_IA_PRUEBAS=1 (entorno local de pruebas).
 */
export const rutasIaCrm = Router()

async function pantallaDe(req: Request) {
  const a = await alcanceDe(req)
  return miIaParaPantalla(req.userId!, a.equipos)
}

rutasIaCrm.get('/ia/mi-ia', asyncHandler(async (req: Request, res: Response) => {
  return ApiResponse.success(res, await pantallaDe(req))
}))

rutasIaCrm.put('/ia/mi-ia', asyncHandler(async (req: Request, res: Response) => {
  exigirEscritura(req)
  const b = obj(req.body)
  const cambios: Partial<Pick<MiIa, 'on' | 'cuando' | 'kb'>> = {}
  if (b.on !== undefined) {
    if (typeof b.on !== 'boolean') throw new ValidationError('«Sugerirme respuestas» va como verdadero o falso.')
    cambios.on = b.on
  }
  if (b.cuando !== undefined) {
    if (b.cuando !== 'mensaje' && b.cuando !== 'pedir') throw new ValidationError('«Cuándo» puede ser «mensaje» (cuando llega un mensaje) o «pedir» (solo cuando la pido).')
    cambios.cuando = b.cuando
  }
  if (b.kb !== undefined) {
    if (typeof b.kb !== 'boolean') throw new ValidationError('«Usar también la base de conocimiento» va como verdadero o falso.')
    cambios.kb = b.kb
  }
  if (!Object.keys(cambios).length) throw new ValidationError('No llegó ningún cambio. Manda on, cuando o kb.')
  await guardarMiIa(req.userId!, cambios)
  const a = await alcanceDe(req)
  return ApiResponse.success(res, await emitirMiIa(req.userId!, req.userRole, req.userId!, a.equipos))
}))

rutasIaCrm.delete('/ia/mi-ia/aprendido', asyncHandler(async (req: Request, res: Response) => {
  exigirEscritura(req)
  await borrarAprendido(req.userId!)
  const a = await alcanceDe(req)
  return ApiResponse.success(res, await emitirMiIa(req.userId!, req.userRole, req.userId!, a.equipos))
}))

/**
 * Solo pruebas locales (CRM_IA_PRUEBAS=1, nunca en producción): corre dentro del API lo que en producción corre
 * por su cuenta, para que los eventos en vivo lleguen al navegador. Solo la configuración general.
 * {que: 'embudo', convId?, sinEspera?} | {que: 'noche'} | {que: 'pago', pago} | {que: 'llamar', modelo?} |
 * {que: 'reloj', iso: string | null} (fija la hora que ve la IA, para probar el cambio de día del tope).
 */
if (process.env.CRM_IA_PRUEBAS === '1') {
  rutasIaCrm.post('/ia/pruebas/correr', asyncHandler(async (req: Request, res: Response) => {
    exigirEscritura(req)
    if (!(await alcanceDe(req)).config) throw new ForbiddenError('Solo la configuración general puede correr las pruebas de la IA.')
    const b = obj(req.body)
    let resultado: unknown
    switch (b.que) {
      case 'embudo': {
        const convId = Number(b.convId)
        resultado = Number.isInteger(convId) && convId > 0
          ? await analizarConversacion(convId, { forzar: true })
          : await embudoPendientes({ sinEspera: b.sinEspera === true })
        break
      }
      case 'noche':
        resultado = await aprenderNoche({ forzar: true })
        break
      case 'pago': {
        const p = obj(b.pago)
        const t = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
        resultado = await reglasPorPago({ telefono: t(p.telefono), correo: t(p.correo), transaccion: t(p.transaccion), producto: t(p.producto), externoId: t(p.externoId) })
        break
      }
      case 'llamar': {
        const r = await llamarIA({
          model: b.modelo === 'sonnet' ? MODELO_SUGERENCIAS : MODELO_HAIKU,
          max_tokens: 50,
          messages: [{ role: 'user', content: 'Prueba del tope diario.' }],
        }, { tipo: 'sugerencia', persona: req.userId ?? null })
        resultado = r ? textoDe(r) : null
        break
      }
      case 'reloj': {
        const iso = typeof b.iso === 'string' ? new Date(b.iso) : null
        if (iso && Number.isNaN(iso.getTime())) throw new ValidationError('La hora no es válida.')
        fijarRelojIA(iso ? () => new Date(iso.getTime()) : null)
        resultado = iso ? iso.toISOString() : null
        break
      }
      default:
        throw new ValidationError('Falta qué correr: embudo, noche, pago, llamar o reloj.')
    }
    return ApiResponse.success(res, { resultado })
  }))
}

rutasIaCrm.use(rutasIaSugerencias)
rutasIaCrm.use(rutasIaEmbudo)
