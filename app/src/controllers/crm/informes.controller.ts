import type { Request, Response } from 'express'
import type { Prisma } from '@prisma/client'
import { prisma } from '../../services/crm/bd'
import { ApiResponse } from '../../utils/response'
import { ValidationError } from '../../utils/errors'
import { usuariosCrm } from '../../services/crm/usuarios'
import { MOTIVO_CREADA } from '../../services/crm/difusiones'
import { obj, txt } from './_comun'
import { alcanceDe, equiposDeReq, filtroConvs, genteQueLidera } from '../../services/crm/alcance'

/**
 * GET /crm/informes?desde&hasta: las cifras de la página Informes (y la
 * satisfacción de Equipo en vivo), calculadas desde crm_conversaciones y
 * crm_mensajes, según lo que ve cada quien (alcance.ts, 29-sep): el administrador sin equipo, todo; el líder, su
 * equipo (`alcance: 'equipo'`); los demás, solo lo suyo (`alcance: 'propio'`). Forma en docs/crm/api-core.md.
 */

const HORA_CO = -5 // Colombia no tiene horario de verano
const horaColombia = (d: Date) => (d.getUTCHours() + 24 + HORA_CO) % 24
const FRANJAS: [string, (h: number) => boolean][] = [
  ['6 a 12', h => h >= 6 && h < 12], ['12 a 18', h => h >= 12 && h < 18], ['18 a 22', h => h >= 18 && h < 22], ['22 a 6', h => h >= 22 || h < 6],
]
const inicioDiaCo = () => { const co = new Date(Date.now() + HORA_CO * 3_600_000); co.setUTCHours(0, 0, 0, 0); return new Date(co.getTime() - HORA_CO * 3_600_000) }

function fechaParam(v: unknown, def: Date, nombre: string): Date {
  if (v === undefined || v === '') return def
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) throw new ValidationError(`La fecha «${nombre}» no es válida. Usa el formato 2026-09-01 o una fecha ISO completa.`)
  return d
}

const contar = <T>(lista: T[], clave: (x: T) => string | null) => {
  const m = new Map<string, number>()
  for (const x of lista) { const k = clave(x); if (k) m.set(k, (m.get(k) ?? 0) + 1) }
  return [...m.entries()].map(([n, v]) => ({ n, v })).sort((a, b) => b.v - a.v)
}
const promedio = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null)
/** NPS = % promotores (9-10) − % detractores (0-6). */
const nps = (xs: number[]) => (xs.length ? Math.round((xs.filter(x => x >= 9).length - xs.filter(x => x <= 6).length) / xs.length * 100) : null)

// Deja por fuera las que crea una difusión sin respuesta. Con NOT { motivoFin } se perdían también las que no
// tienen motivo (todas las abiertas): en SQL, NULL = 'x' no es falso sino desconocido, y NOT de eso tampoco pasa.
const NO_DIFUSION: Prisma.CrmConversacionWhereInput = { OR: [{ motivoFin: null }, { motivoFin: { not: MOTIVO_CREADA } }] }

export async function informes(req: Request, res: Response) {
  const hasta = fechaParam(req.query.hasta, new Date(), 'hasta')
  const desde = fechaParam(req.query.desde, new Date(hasta.getTime() - 30 * 86_400_000), 'desde')
  if (desde > hasta) throw new ValidationError('«desde» es posterior a «hasta». Revisa el rango de fechas.')
  const alcance = await alcanceDe(req)
  const yo = req.userId!
  // Ve el equipo: el administrador sin equipo (todo) o quien lidera alguno (sus equipos). Los demás, lo suyo.
  const equipoVista = alcance.todo || alcance.lidera.length > 0
  const mias: Prisma.CrmConversacionWhereInput = filtroConvs(alcance)

  const [usuarios, nuevasFilas, finalizadasFilas, abiertasFilas, lineas] = await Promise.all([
    usuariosCrm(),
    // Las que crea una difusión y nadie ha respondido no son conversaciones nuevas ni finalizadas del equipo.
    prisma.crmConversacion.findMany({ where: { ...mias, createdAt: { gte: desde, lte: hasta }, AND: [NO_DIFUSION] }, select: { id: true, asignadoId: true, createdAt: true, contacto: { select: { pauta: true, ficha: true } } } }),
    prisma.crmConversacion.findMany({ where: { ...mias, finalizadaAt: { gte: desde, lte: hasta }, AND: [NO_DIFUSION] }, select: { id: true, asignadoId: true, motivoFin: true, finalizadaAt: true } }),
    prisma.crmConversacion.findMany({ where: { ...mias, estado: 'abiertas' }, select: { id: true, asignadoId: true, esperaDesde: true, lineaId: true, contacto: { select: { etapa: true } } } }),
    prisma.crmLinea.findMany({ select: { id: true, nombre: true } }),
  ])

  // Primera respuesta: del primer mensaje del cliente a la primera respuesta de una persona.
  const ids = nuevasFilas.map(c => c.id)
  const tiempos = ids.length ? await prisma.$queryRaw<{ id: number; asignado: string | null; minutos: number | null }[]>`
    SELECT c.id, c.asignado_id AS asignado,
      EXTRACT(EPOCH FROM (
        (SELECT min(o."createdAt") FROM crm_mensajes o WHERE o.conversacion_id = c.id AND o.tipo = 'out' AND o.autor_id IS NOT NULL
           AND o.estado IS DISTINCT FROM 'fallido'
           AND o."createdAt" > (SELECT min(i."createdAt") FROM crm_mensajes i WHERE i.conversacion_id = c.id AND i.tipo = 'in'))
        - (SELECT min(i."createdAt") FROM crm_mensajes i WHERE i.conversacion_id = c.id AND i.tipo = 'in')
      )) / 60 AS minutos
    FROM crm_conversaciones c WHERE c.id = ANY(${ids}::int[])` : []
  const respondidas = tiempos.filter(t => t.minutos != null).map(t => ({ ...t, minutos: Number(t.minutos) }))

  // Atendidas por IA: conversaciones del rango con mensajes del agente (ia) o de la atención de noche (recepcion).
  const conIa = ids.length ? await prisma.crmMensaje.groupBy({ by: ['conversacionId'], where: { conversacionId: { in: ids }, tipo: { in: ['ia', 'recepcion'] } } }) : []

  // Encuestas: enviadas = evento «star»; respondidas = mensajes csat. Un csat solo cuenta si lo
  // guardó el servidor con la respuesta del cliente (autorId null): la ruta de mensajes no deja crearlos.
  // Cada respuesta es de la asesora que nombra la encuesta (la que atendía cuando se envió); si ese
  // nombre ya no es de nadie del equipo, de la asignada a la conversación.
  const nombreDe = new Map(usuarios.map(u => [u.id, u.nombre]))
  const idDe = new Map(usuarios.map(u => [u.nombre.toLowerCase(), u.id]))
  const miNombre = nombreDe.get(yo) ?? null
  const filtroConv: Prisma.CrmMensajeWhereInput = alcance.todo ? {} : { conversacion: mias }
  // Las de las conversaciones que ve y, además, las que lo nombran a él (la encuesta es de quien atendía).
  const filtroCsat: Prisma.CrmMensajeWhereInput = alcance.todo ? {} : {
    OR: [{ conversacion: mias }, ...(miNombre ? [{ conversacion: { soloLider: false }, datos: { path: ['csat', 'asesor'], equals: miNombre } }] : [])],
  }
  const [enviadas, csats] = await Promise.all([
    // Las encuestas que no salieron (lote 6: «La encuesta no salió: …», estado fallido) no cuentan como enviadas.
    prisma.crmMensaje.count({ where: { ...filtroConv, tipo: 'ev', createdAt: { gte: desde, lte: hasta }, datos: { path: ['ev'], equals: 'star' }, AND: [{ OR: [{ estado: null }, { estado: { not: 'fallido' } }] }] } }),
    prisma.crmMensaje.findMany({ where: { ...filtroCsat, tipo: 'csat', autorId: null, createdAt: { gte: desde, lte: hasta } }, select: { datos: true, createdAt: true, conversacion: { select: { asignadoId: true, contacto: { select: { nombre: true, telefono: true } } } } }, orderBy: { createdAt: 'desc' } }),
  ])
  const nota = (v: unknown, min: number, max: number) => {
    if (v === null || v === undefined || v === '') return null
    const x = Number(v)
    return Number.isFinite(x) && x >= min && x <= max ? x : null
  }
  const encuestas = csats.map(m => {
    const c = obj(obj(m.datos).csat)
    const porNombre = txt(c.asesor) ? idDe.get(txt(c.asesor).toLowerCase()) ?? null : null
    const asesorId = porNombre ?? m.conversacion.asignadoId
    return {
      n: m.conversacion.contacto.nombre || m.conversacion.contacto.telefono || 'Sin nombre',
      asesor: txt(c.asesor) || (asesorId ? nombreDe.get(asesorId) ?? null : null),
      asesorId,
      aten: nota(c.aten, 1, 5), nps: nota(c.nps, 0, 10),
      com: txt(c.com) || null, cuando: m.createdAt.toISOString(),
    }
  }).filter(e => equipoVista || e.asesorId === yo)
  const notasNps = encuestas.map(e => e.nps).filter((x): x is number => x != null)
  const notasAten = encuestas.map(e => e.aten).filter((x): x is number => x != null)

  // Por asesor.
  const hoy = inicioDiaCo()
  const finalizadasHoy = await prisma.crmConversacion.groupBy({ by: ['asignadoId'], where: { ...mias, finalizadaAt: { gte: hoy } }, _count: { _all: true } })
  const hoyDe = new Map(finalizadasHoy.map(f => [f.asignadoId, f._count._all]))
  // Por asesor: el administrador sin equipo, todas las personas; el líder, su gente y él; los demás, solo él.
  const gente = alcance.todo ? null : new Set([...genteQueLidera(alcance, await equiposDeReq(req)), yo])
  const personas = gente ? usuarios.filter(u => gente.has(u.id)) : usuarios
  const ahora = Date.now()
  const porAsesor = personas.map(u => {
    const abiertas = abiertasFilas.filter(c => c.asignadoId === u.id)
    const esperando = abiertas.filter(c => c.esperaDesde)
    const suyas = encuestas.filter(e => e.asesorId === u.id)
    const suyasNps = suyas.map(e => e.nps).filter((x): x is number => x != null)
    return {
      id: u.id, nombre: u.nombre,
      abiertas: abiertas.length,
      sinResponder: esperando.length,
      esperaMasLargaMin: esperando.length ? Math.round(Math.max(...esperando.map(c => ahora - c.esperaDesde!.getTime())) / 60_000) : null,
      finalizadas: finalizadasFilas.filter(c => c.asignadoId === u.id).length,
      finalizadasHoy: hoyDe.get(u.id) ?? 0,
      primeraRespuestaMin: promedio(respondidas.filter(t => t.asignado === u.id).map(t => t.minutos)),
      encuestas: suyas.length,
      atencion: promedio(suyas.map(e => e.aten).filter((x): x is number => x != null)),
      nps: nps(suyasNps),
      detractores: suyasNps.filter(x => x <= 6).length,
    }
  })

  const origenDe = (c: (typeof nuevasFilas)[number]) => {
    const pauta = obj(c.contacto.pauta)
    if (txt(pauta.plataforma)) return txt(pauta.plataforma)
    return txt(obj(c.contacto.ficha).origen) || 'Orgánico o sin dato'
  }
  const horas = Array.from({ length: 24 }, () => 0)
  for (const c of nuevasFilas) horas[horaColombia(c.createdAt)]++
  const nombreLinea = new Map(lineas.map(l => [l.id, l.nombre]))

  return ApiResponse.success(res, {
    desde: desde.toISOString(), hasta: hasta.toISOString(), alcance: equipoVista ? 'equipo' : 'propio',
    nuevas: nuevasFilas.length,
    finalizadas: finalizadasFilas.length,
    abiertas: abiertasFilas.length,
    sinAsignar: equipoVista ? abiertasFilas.filter(c => !c.asignadoId).length : 0,
    sinRespuesta: abiertasFilas.filter(c => c.esperaDesde).length,
    primeraRespuestaMin: promedio(respondidas.map(t => t.minutos)),
    atendidasIa: conIa.length,
    porAsesor,
    porHora: FRANJAS.map(([h, f]) => ({ h, n: horas.filter((_, i) => f(i)).reduce((s, x) => s + x, 0) })),
    porHora24: horas,
    porOrigen: contar(nuevasFilas, origenDe),
    porCampana: contar(nuevasFilas, c => txt(obj(c.contacto.pauta).campana) || null),
    porEtapa: contar(abiertasFilas, c => c.contacto.etapa || 'Sin etapa'),
    porLinea: contar(abiertasFilas, c => (c.lineaId ? nombreLinea.get(c.lineaId) ?? 'Línea borrada' : 'Sin línea')),
    motivos: contar(finalizadasFilas, c => c.motivoFin || 'Sin motivo'),
    encuestas: {
      enviadas,
      respondidas: encuestas.length,
      atencion: promedio(notasAten),
      nps: nps(notasNps),
      promotores: notasNps.length ? Math.round(notasNps.filter(x => x >= 9).length / notasNps.length * 100) : null,
      detractores: notasNps.length ? Math.round(notasNps.filter(x => x <= 6).length / notasNps.length * 100) : null,
      bajas: notasAten.filter(x => x <= 2).length,
      comentarios: encuestas.slice(0, 10).map(({ asesorId: _a, ...e }) => e),
    },
  })
}
