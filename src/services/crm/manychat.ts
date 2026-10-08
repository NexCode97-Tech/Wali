import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma, prismaGlobal } from './bd'
import { enEspacio, espacioActual } from './espacio'
import { miembrosDe } from './reparto'
import { emitirContacto } from '../../controllers/crm/_contacto'
import { avisarIntegraciones, escribirIntegracion, estadoIntegraciones, integracionGuardada, type EstadoSistema } from './integraciones'
import { logger } from '../../utils/logger'
import { ValidationError } from '../../utils/errors'

/**
 * ManyChat (8-oct, maqueta aprobada): cada lead que captura un flujo entra solo a Contactos. En ManyChat se pone
 * la acción «Solicitud externa» (POST) a /api/crm/manychat/:ruta con «Authorization: Bearer <clave>».
 * En `_integraciones.manychat` quedan la ruta (para hallar la empresa), el hash de la clave (la clave se muestra
 * una sola vez, al conectar), el equipo y la etapa con que entran los leads, y cuántos han llegado.
 * Si el teléfono o el correo ya existen se actualiza ese contacto; las etiquetas se suman.
 */

type Json = Record<string, unknown>
const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')
const hash = (s: string) => createHash('sha256').update(s).digest('hex')

export async function conectarManychat(entrada: { equipo?: unknown; etapa?: unknown }, por: string | null, baseApi: string):
  Promise<{ integraciones: EstadoSistema[]; url: string; clave: string }> {
  const equipo = txt(entrada.equipo).slice(0, 80), etapa = txt(entrada.etapa).slice(0, 80)
  const previa = await integracionGuardada('manychat')
  // Volver a conectar conserva la dirección (el flujo de ManyChat sigue funcionando) y cambia la clave.
  const ruta = txt(previa.ruta) || randomBytes(10).toString('hex')
  const clave = `mc_${randomBytes(24).toString('hex')}`
  await escribirIntegracion('manychat', { secretos: hash(clave), ruta, equipo, etapa, recibidos: Number(previa.recibidos) || 0, ultimo: txt(previa.ultimo) || null, desde: new Date().toISOString(), por }, por)
  await avisarIntegraciones(por)
  return { integraciones: await estadoIntegraciones(), url: urlManychat(baseApi, ruta), clave }
}

export const urlManychat = (baseApi: string, ruta: string) => `${baseApi}/api/crm/manychat/${ruta}`

/** Cambiar el equipo o la etapa sin tocar la clave. */
export async function ajustarManychat(entrada: { equipo?: unknown; etapa?: unknown }, por: string | null): Promise<EstadoSistema[]> {
  const g = await integracionGuardada('manychat')
  if (!txt(g.secretos)) throw new ValidationError('ManyChat no está conectado.')
  await escribirIntegracion('manychat', { ...g, equipo: txt(entrada.equipo).slice(0, 80), etapa: txt(entrada.etapa).slice(0, 80) }, por)
  await avisarIntegraciones(por)
  return estadoIntegraciones()
}

const etiquetasDe = (v: unknown): string[] =>
  (Array.isArray(v) ? v.map(txt) : txt(v).split(/[,;]/)).map(t => t.trim()).filter(t => t && !/^\{\{.*\}\}$/.test(t)).map(t => t.slice(0, 40)).slice(0, 20)
/** ManyChat deja «{{phone}}» tal cual cuando el suscriptor no tiene ese dato. */
const dato = (v: unknown) => { const t = txt(v); return /^\{\{.*\}\}$/.test(t) ? '' : t }

/** Un lead de ManyChat. Devuelve el código HTTP: 404 si la ruta no existe, 401 sin la clave, 400 sin datos. */
export async function recibirManychat(ruta: string, autorizacion: string, cuerpo: Json): Promise<{ codigo: number; contactoId?: number }> {
  if (!/^[0-9a-f]{20}$/.test(ruta)) return { codigo: 404 }
  const filas = await prismaGlobal.$queryRaw<{ espacio_id: string }[]>`
    SELECT espacio_id FROM crm_ajustes WHERE clave = '_integraciones' AND valor->'manychat'->>'ruta' = ${ruta} LIMIT 1`
  const espacio = filas[0]?.espacio_id
  if (!espacio) return { codigo: 404 }
  return enEspacio(espacio, async () => {
    const g = await integracionGuardada('manychat')
    const dada = hash(autorizacion.replace(/^Bearer\s+/i, '').trim()), guardada = txt(g.secretos)
    if (!guardada || guardada.length !== dada.length || !timingSafeEqual(Buffer.from(dada), Buffer.from(guardada))) return { codigo: 401 }

    const nombre = dato(cuerpo.nombre ?? cuerpo.full_name).slice(0, 120)
    const digitos = dato(cuerpo.telefono ?? cuerpo.phone).replace(/\D/g, '')
    const tel = digitos.length >= 8 && digitos.length <= 15 ? digitos : ''
    const correoCrudo = dato(cuerpo.correo ?? cuerpo.email).toLowerCase()
    const correo = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(correoCrudo) ? correoCrudo.slice(0, 160) : ''
    const instagram = dato(cuerpo.instagram ?? cuerpo.ig_username).replace(/^@/, '').slice(0, 60)
    const etiquetas = etiquetasDe(cuerpo.etiquetas ?? cuerpo.tags)
    if (!tel && !correo) return { codigo: 400 }

    const existente = (tel ? await prisma.crmContacto.findFirst({ where: { telefono: tel } }) : null)
      ?? (correo ? await prisma.crmContacto.findFirst({ where: { correo }, orderBy: { id: 'desc' } }) : null)
    const fichaNueva: Json = { ...(instagram ? { instagram: `@${instagram}` } : {}) }
    let id: number
    if (existente) {
      const k = await prisma.crmContacto.update({
        where: { id: existente.id },
        data: {
          ...(nombre && !existente.nombre ? { nombre } : {}),
          ...(tel && !existente.telefono ? { telefono: tel } : {}),
          ...(correo && !existente.correo ? { correo } : {}),
          tags: [...new Set([...existente.tags, ...etiquetas])],
          ficha: { ...(existente.ficha as Json), ...fichaNueva } as Prisma.InputJsonValue,
          guardado: true,
        },
      })
      id = k.id
    } else {
      const equipo = txt(g.equipo)
      const gente = equipo ? await miembrosDe(equipo).catch(() => []) : []
      const asignado = gente.length ? gente[Math.floor(Math.random() * gente.length)].id : null
      const k = await prisma.crmContacto.create({
        data: {
          nombre: nombre || null, telefono: tel || null, correo: correo || null, canal: tel ? 'wa' : 'mail',
          etapa: txt(g.etapa) || null, tags: etiquetas, asignadoId: asignado, guardado: true,
          ficha: { origen: 'ManyChat', ...(equipo ? { equipo } : {}), ...fichaNueva } as Prisma.InputJsonValue,
        },
      })
      id = k.id
    }
    await escribirIntegracion('manychat', { ...g, recibidos: (Number(g.recibidos) || 0) + 1, ultimo: new Date().toISOString() }, null)
    await emitirContacto(id, null).catch(() => null)
    await avisarIntegraciones(null).catch(() => null)
    logger.info(`[CRM ManyChat] ${espacioActual()}: lead ${existente ? 'actualizado' : 'nuevo'} (contacto ${id})`)
    return { codigo: existente ? 200 : 201, contactoId: id }
  })
}
