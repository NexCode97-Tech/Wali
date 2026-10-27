import type { Request, Response } from 'express'
import { ApiResponse } from '../../utils/response'
import { ValidationError } from '../../utils/errors'
import { prisma } from '../../services/crm/bd'
import { alcanceDe, veConv } from '../../services/crm/alcance'
import { respondieronDifusion } from '../../services/crm/difusiones'
import { exigirLider, obj, txt } from './_comun'

/** Difusiones (maqueta A del 27-oct). Crear, pausar y duplicar viven en el ajuste `difusiones`; aquí, lo que se consulta. */

/** Lo que escribió el cliente, en corto (igual que ultimosDeContacto). */
function texto(d: Record<string, unknown>): string {
  const x = d.in
  if (typeof x === 'string') return x.slice(0, 200)
  const o = obj(x)
  return txt(o.cap) || (o.img ? '📷 Foto' : o.video ? '🎥 Video' : o.doc ? '📄 Documento' : o.url ? '🎤 Nota de voz' : obj(d.file).n ? `📄 ${txt(obj(d.file).n)}` : obj(d.audio).url ? '🎤 Nota de voz' : '')
}

/** GET /crm/difusiones/:id/respondieron: quién respondió, solo de las conversaciones que la persona ve. */
export async function respondieron(req: Request, res: Response) {
  exigirLider(req, 'ver las respuestas de una difusión')
  const id = String(req.params.id ?? '')
  if (!/^[\w-]{1,60}$/.test(id)) throw new ValidationError('Esa difusión no existe')
  const filas = await respondieronDifusion(id)
  const convs = await prisma.crmConversacion.findMany({ where: { id: { in: filas.map(f => f.convId) } }, select: { id: true, equipo: true, asignadoId: true, soloLider: true } })
  const a = await alcanceDe(req)
  const ve = new Set(convs.filter(c => veConv(a, c)).map(c => c.id))
  return ApiResponse.success(res, filas.filter(f => ve.has(f.convId)).map(f => ({ convId: f.convId, nombre: f.nombre, texto: texto(obj(f.datos)), en: new Date(f.en).toISOString() })))
}
