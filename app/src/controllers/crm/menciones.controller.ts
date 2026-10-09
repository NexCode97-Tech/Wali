import type { Request, Response } from 'express'
import { prisma } from '../../services/crm/bd'
import { ApiResponse } from '../../utils/response'
import { nombreDe, usuariosCrm } from '../../services/crm/usuarios'
import { obj } from './_comun'
import { alcanceDe, filtroConvs } from '../../services/crm/alcance'

/**
 * GET /crm/menciones → [{ convId, msgId, t (ISO), por (nombre), texto }]
 *
 * Las notas de los últimos 30 días que mencionan a quien pregunta (la nota
 * guarda `menciones: [nombres]`, services/crm/salientes.ts), de la más nueva a
 * la más vieja. Solo las de conversaciones que ve (alcance.ts): una mención no da acceso.
 * Para la vista «Menciones» de la bandeja y su contador.
 */
const DIAS = 30
const MAXIMO = 300

export async function menciones(req: Request, res: Response) {
  const yo = await nombreDe(req.userId)
  if (!yo) return ApiResponse.success(res, [])
  const desde = new Date(Date.now() - DIAS * 864e5)
  const alcance = await alcanceDe(req)
  const filas = await prisma.crmMensaje.findMany({
    where: {
      tipo: 'note',
      createdAt: { gte: desde },
      datos: { path: ['menciones'], array_contains: [yo] },
      ...(alcance.todo ? {} : { conversacion: filtroConvs(alcance) }),
    },
    orderBy: { createdAt: 'desc' },
    take: MAXIMO,
    select: { id: true, conversacionId: true, createdAt: true, autorId: true, datos: true },
  })
  const nombres = new Map((await usuariosCrm()).map(u => [u.id, u.nombre]))
  return ApiResponse.success(res, filas.map(m => {
    const d = obj(m.datos)
    return {
      convId: m.conversacionId,
      msgId: m.id,
      t: m.createdAt.toISOString(),
      por: (m.autorId && nombres.get(m.autorId)) || (typeof d.by === 'string' ? d.by : null),
      texto: typeof d.note === 'string' ? d.note : '',
    }
  }))
}
