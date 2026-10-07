import type { Prisma } from '@prisma/client'
import { dispararReglas } from './reglas'
import { prisma } from './bd'
import { espacioActual } from './espacio'
import { logger } from '../../utils/logger'
import { usuariosConectados } from '../../utils/sseManager'
import { avisar } from '../notificaciones'
import { leerAjuste, guardarAjuste, leerPreferencias } from './ajustes'
import { usuariosCrm, type UsuarioCrm } from './usuarios'
import { emitirConv, emitirMsg } from './tiempoReal'
import { leerEquipos, metodoValido, subequipoDe, type EquiposNorm, type Subequipo } from './equipos'

/**
 * Reparto automático de conversaciones (página «Equipos y reparto» de la
 * maqueta, `CFG.reparto`). Reglas en docs/crm/api-core.md:
 *
 * - Candidatos: integrantes del equipo de la conversación (ajuste `equipos`;
 *   si Ventas no está definido, todos los VENDEDOR) que reciben reparto, están
 *   «En línea», tienen el CRM abierto (si «No asignar a quien está ausente»
 *   está prendido) y no llegaron al tope de conversaciones abiertas.
 * - «Cliente conocido vuelve a su asesor»: el dueño del contacto, o el asesor
 *   del cliente en la plataforma, si está disponible.
 * - «Familiares al mismo asesor»: si el número es el de un representante legal, va con
 *   quien atiende al cliente.
 * - Método «Por turnos», «Al que tenga menos» o «Manual» (nadie la recibe sola).
 *   Desde el 28-sep cada equipo elige el suyo (ajuste `equipos`, `metodos`); sin elegir, el general.
 *   El máximo de conversaciones abiertas también puede ser por persona (`topes`).
 * - Subequipos (29-sep): la conversación que se pasó a un subequipo (`extra.subequipo`) se reparte
 *   solo entre su gente y con su propia forma de repartir; lo que llega sin subequipo, entre toda la
 *   gente del equipo (los líderes incluidos). «Todos ven y cualquiera la toma» salió de las opciones:
 *   un `todos` guardado reparte por turnos.
 */

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})

export interface CfgReparto { metodo: string; tope: number; minutos: number; ausente: boolean; familiares: boolean; conocido: boolean }

/** Los mismos valores por defecto que muestra la pantalla si nunca se guardó. */
const POR_DEFECTO: CfgReparto = { metodo: 'Por turnos', tope: 25, minutos: 15, ausente: true, familiares: true, conocido: true }
const CLAVE_TURNO = '_repartoTurno'

export async function configReparto(): Promise<CfgReparto> {
  const r = obj(obj(await leerAjuste('cfg')).reparto)
  const num = (v: unknown, d: number) => { const n = Number(String(v ?? '').replace(/\D/g, '')); return Number.isFinite(n) && n > 0 ? n : d }
  return {
    metodo: typeof r.metodo === 'string' ? r.metodo : POR_DEFECTO.metodo,
    tope: num(r.tope, POR_DEFECTO.tope),
    minutos: num(r.minutos, POR_DEFECTO.minutos),
    ausente: r.ausente !== false,
    familiares: r.familiares !== false,
    conocido: r.conocido !== false,
  }
}

/** Formas de repartir de cada equipo y subequipo (Equipos y reparto): la clave guardada y el nombre del método general. */
const METODOS: Record<string, string> = { turnos: 'Por turnos', menos: 'Al que tenga menos', lider: 'Manual' }
/** La forma de repartir de un equipo: la suya o, si nunca se eligió, la general. Un `todos` guardado (ya no existe) es «Por turnos». */
export async function metodoDe(equipo: string, cfg?: CfgReparto): Promise<string> {
  const m = metodoValido(obj(obj(await leerAjuste('equipos')).metodos)[equipo])
  return m ? METODOS[m] : (cfg ?? await configReparto()).metodo
}
/** ¿Esta forma de repartir entrega sola la conversación a alguien? */
const automatico = (metodo: string) => !/manual/i.test(metodo)

/** La gente de un subequipo que sigue en su equipo, en el orden del subequipo (el de sus turnos). */
async function genteDeSubequipo(eqs: EquiposNorm, equipo: string, sub: Subequipo): Promise<UsuarioCrm[]> {
  const usuarios = await usuariosCrm()
  const delEquipo = new Set(eqs.ids[equipo] ?? [])
  return sub.ids.filter(id => delEquipo.has(id)).map(id => usuarios.find(u => u.id === id)).filter((u): u is UsuarioCrm => Boolean(u))
}

/** Integrantes de un equipo según el ajuste `equipos` ({miembros: {equipo: [nombres]}}). */
export async function miembrosDe(equipo: string): Promise<UsuarioCrm[]> {
  const usuarios = await usuariosCrm()
  const aj = obj(await leerAjuste('equipos'))
  // Por id si el ajuste los trae (así un cambio de nombre no saca a nadie del reparto); si no, por nombre.
  const ids = obj(aj.ids)[equipo]
  if (Array.isArray(ids)) {
    const orden = ids.map(String)
    return orden.map(id => usuarios.find(u => u.id === id)).filter((u): u is UsuarioCrm => Boolean(u))
  }
  const miembros = obj(aj.miembros)
  const nombres = miembros[equipo]
  if (Array.isArray(nombres)) {
    const set = new Set(nombres.map(n => String(n).trim().toLowerCase()))
    return usuarios.filter(u => set.has(u.nombre.toLowerCase()))
  }
  return equipo === 'Ventas' ? usuarios.filter(u => u.rol === 'AGENTE') : []
}

/** El equipo que atiende: el de la conversación, el de su línea, o Ventas. */
async function equipoDe(c: { equipo: string | null; lineaId: string | null; linea: { ajustes: unknown } | null }): Promise<string> {
  if (c.equipo) return c.equipo
  const aj = obj(c.linea?.ajustes)
  if (typeof aj.equipo === 'string' && aj.equipo) return aj.equipo
  if (typeof aj.eq === 'string' && aj.eq) return aj.eq
  if (c.lineaId) {
    const lineas = obj(await leerAjuste('cfg')).lineas
    const l = Array.isArray(lineas) ? lineas.map(obj).find(x => x.id === c.lineaId) : null
    if (l && typeof l.eq === 'string' && l.eq) return l.eq
  }
  return 'Ventas'
}

async function abiertasPor(ids: string[]): Promise<Map<string, number>> {
  if (!ids.length) return new Map()
  const filas = await prisma.crmConversacion.groupBy({ by: ['asignadoId'], where: { asignadoId: { in: ids }, estado: 'abiertas' }, _count: { _all: true } })
  return new Map(filas.map(f => [f.asignadoId as string, f._count._all]))
}

/** ¿Puede recibir una conversación ya mismo? */
async function disponibles(personas: UsuarioCrm[], cfg: CfgReparto, excluir: Set<string>) {
  const conectados = usuariosConectados()
  const carga = await abiertasPor(personas.map(p => p.id))
  // El máximo de cada persona (pestaña Personas); si no tiene uno propio, el general.
  const topes = obj(obj(await leerAjuste('equipos')).topes)
  const out: { u: UsuarioCrm; abiertas: number }[] = []
  for (const u of personas) {
    if (excluir.has(u.id)) continue
    const pref = await leerPreferencias(u.id)
    if (pref.reparto === false) continue
    if ((typeof pref.estado === 'string' ? pref.estado : 'En línea') !== 'En línea') continue
    if (cfg.ausente && !conectados.has(u.id)) continue
    const abiertas = carga.get(u.id) ?? 0
    const tope = Number(topes[u.id]) > 0 ? Number(topes[u.id]) : cfg.tope
    if (abiertas >= tope) continue
    out.push({ u, abiertas })
  }
  return out
}

const ultimos10 = (t: string | null | undefined) => (t ?? '').replace(/\D/g, '').slice(-10)

/** El asesor que ya conoce a este contacto: su dueño, el de su compra o el de su familia. */
async function duenoConocido(contacto: { id: number; asignadoId: string | null; telefono: string | null; externoId: string | null }, cfg: CfgReparto): Promise<string[]> {
  const ids: string[] = []
  if (cfg.conocido) {
    if (contacto.asignadoId) ids.push(contacto.asignadoId)
  }
  const tel = ultimos10(contacto.telefono)
  if (cfg.familiares && tel.length === 10) {
    // El número es el del representante legal guardado en otro contacto del CRM.
    const otros = await prisma.$queryRaw<{ asignado_id: string }[]>`
      SELECT asignado_id FROM crm_contactos
      WHERE espacio_id = ${espacioActual()} AND id <> ${contacto.id} AND asignado_id IS NOT NULL
        AND right(regexp_replace(coalesce(campos->>'telRepresentante', ''), '\\D', '', 'g'), 10) = ${tel}
      LIMIT 3`
    ids.push(...otros.map(o => o.asignado_id))
  }
  return [...new Set(ids)]
}

/** `clave`: el equipo, o `equipo#idDelSubequipo` (cada subequipo lleva su propio turno). */
async function siguienteTurno(clave: string, orden: UsuarioCrm[], libres: Set<string>): Promise<string | null> {
  const turnos = obj(await leerAjuste(CLAVE_TURNO))
  const ultimo = typeof turnos[clave] === 'string' ? turnos[clave] as string : null
  const i = ultimo ? orden.findIndex(u => u.id === ultimo) : -1
  for (let k = 1; k <= orden.length; k++) {
    const u = orden[(i + k + orden.length) % orden.length]
    if (libres.has(u.id)) return u.id
  }
  return null
}

async function guardarTurno(clave: string, userId: string) {
  const turnos = obj(await leerAjuste(CLAVE_TURNO))
  await guardarAjuste(CLAVE_TURNO, { ...turnos, [clave]: userId }, null)
}

/**
 * Elige a quién le toca y la asigna. `excluir` son personas que ya la
 * tuvieron y no respondieron a tiempo (se usa al pasarla al siguiente).
 * Devuelve el userId asignado, o null si nadie estaba disponible.
 */
// Un reparto a la vez: si dos corren juntos, los dos ven la misma carga y el mismo turno,
// y la conversación se asigna dos veces o se pasa el tope (hay una sola instancia del API).
let colaReparto: Promise<unknown> = Promise.resolve()
export function repartirA(convId: number, excluir: string[] = [], desdeFila = false): Promise<string | null> {
  const turno = colaReparto.then(() => repartirAhora(convId, excluir, desdeFila))
  colaReparto = turno.catch(() => undefined)
  // Las reglas de «Se asigna una conversación» corren fuera de la fila: una regla que vuelve a
  // repartir esperaría a esta misma vuelta y nunca terminaría.
  return turno.then(elegido => {
    if (elegido) void dispararReglas('asignada', convId, { asignadoId: elegido, porReparto: true }).catch(() => {})
    return elegido
  })
}

/** `desdeFila`: la vuelta periódica a las que esperan asesor. Con «Guardar los leads» apagado en su equipo, no se tocan. */
async function repartirAhora(convId: number, excluir: string[] = [], desdeFila = false): Promise<string | null> {
  const c = await prisma.crmConversacion.findUnique({ where: { id: convId }, include: { contacto: true, linea: { select: { ajustes: true } } } })
  if (!c || c.estado === 'finalizadas') return null
  const cfg = await configReparto()
  const sacar = new Set(excluir)
  const equipo = await equipoDe(c)
  const eqs = await leerEquipos()
  // Pasada a un subequipo de su equipo: se reparte solo entre su gente y con su forma de repartir.
  const sub = subequipoDe(eqs, equipo, c.extra)
  const guardaLeads = eqs.cola[equipo] !== false
  if (desdeFila && !guardaLeads) return null
  const metodo = sub ? METODOS[sub.metodo] ?? METODOS.turnos : await metodoDe(equipo, cfg)
  if (!automatico(metodo)) {
    // «Solo un líder la asigna»: nadie la recibe sola, pero queda en su equipo (así la ven sus líderes).
    if (!c.equipo) {
      await prisma.crmConversacion.updateMany({ where: { id: convId, equipo: null }, data: { equipo } })
      await emitirConv(convId, null)
    }
    return null
  }
  const extra = obj(c.extra)
  const previo = obj(extra._reparto)

  let elegido: string | null = null
  let porQue = 'por reparto automático'

  // 1. Cliente conocido o familiar: con quien ya lo atiende, si está disponible.
  // Una conversación «solo líder» solo se reparte entre los líderes de su equipo.
  // Solo personas del equipo de la conversación, o de su subequipo,
  // también para el cliente conocido.
  const lideres = new Set(eqs.lideres[equipo] ?? [])
  const puede = (u: UsuarioCrm) => !c.soloLider || lideres.has(u.id)
  const orden = (sub ? await genteDeSubequipo(eqs, equipo, sub) : await miembrosDe(equipo)).filter(puede)
  const claveTurno = sub ? `${equipo}#${sub.id}` : equipo
  const conocidos = (await duenoConocido(c.contacto, cfg)).filter(id => !sacar.has(id))
  if (conocidos.length) {
    const libres = await disponibles(orden.filter(u => conocidos.includes(u.id)), cfg, sacar)
    const hit = conocidos.find(id => libres.some(l => l.u.id === id))
    if (hit) { elegido = hit; porQue = 'por reparto automático (ya la conocía)' }
  }

  // 2. El equipo, por turnos o al que tenga menos.
  if (!elegido) {
    const libres = await disponibles(orden, cfg, sacar)
    if (libres.length) {
      if (/menos/i.test(metodo)) {
        const min = Math.min(...libres.map(l => l.abiertas))
        const empatados = new Set(libres.filter(l => l.abiertas === min).map(l => l.u.id))
        elegido = await siguienteTurno(claveTurno, orden, empatados)
      } else {
        elegido = await siguienteTurno(claveTurno, orden, new Set(libres.map(l => l.u.id)))
      }
      if (elegido) await guardarTurno(claveTurno, elegido)
    }
  }

  if (!elegido) {
    // Nadie disponible: queda sin asignar. Se deja constancia una sola vez.
    if (!previo.sinCandidatos && !c.asignadoId) {
      await prisma.crmConversacion.update({ where: { id: convId }, data: { extra: { ...extra, _reparto: { ...previo, sinCandidatos: true } } as Prisma.InputJsonValue } })
      const m = await prisma.crmMensaje.create({ data: { conversacionId: convId, tipo: 'ev', datos: { ev: 'clock', t: guardaLeads ? `En espera. Nadie de ${sub ? sub.n : equipo} está disponible; se le entrega, en orden de llegada, a la primera persona que vuelva a estar disponible.` : `Sin asignar. Nadie de ${sub ? sub.n : equipo} está disponible; queda para que alguien del equipo la tome.` } } })
      emitirMsg(convId, m, null)
      await emitirConv(convId, null)
    }
    return null
  }

  const nombre = (await usuariosCrm()).find(u => u.id === elegido)?.nombre ?? 'un asesor'
  const probados = [...new Set([...(Array.isArray(previo.probados) ? previo.probados.map(String) : []), ...excluir, elegido])]
  const hecho = await prisma.crmConversacion.updateMany({
    where: { id: convId, asignadoId: c.asignadoId, estado: { not: 'finalizadas' } },
    data: {
      asignadoId: elegido,
      equipo: c.equipo ?? equipo,
      extra: { ...extra, _reparto: { a: elegido, en: new Date().toISOString(), probados } } as Prisma.InputJsonValue,
    },
  })
  // Alguien la asignó (o la finalizó) mientras se elegía: se respeta lo que hizo.
  if (!hecho.count) return null
  if (!c.contacto.asignadoId) await prisma.crmContacto.update({ where: { id: c.contactoId }, data: { asignadoId: elegido } })
  const m = await prisma.crmMensaje.create({ data: { conversacionId: convId, tipo: 'ev', datos: { ev: 'swap', t: `Asignada a ${nombre} ${porQue}` } } })
  emitirMsg(convId, m, null)
  await emitirConv(convId, null)

  const pref = await leerPreferencias(elegido)
  if (pref.asignada !== false) {
    await avisar({
      userId: elegido, tipo: 'TAREA_ASIGNADA', titulo: 'Conversación nueva en el CRM',
      texto: `Te llegó la conversación con ${c.contacto.nombre || c.contacto.telefono || 'un contacto'} por reparto automático.`,
      url: `/?conv=${convId}`,
    })
  }
  return elegido
}

/**
 * Quien le responde a una conversación sin asignar se la queda, si es del equipo de esa conversación, sea cual
 * sea la forma de repartir y tenga o no subequipo. Lo sin asignar solo lo ven (y responden) los líderes del
 * equipo y los administradores sin equipo: el líder se la queda; el administrador sin equipo responde sin
 * quedársela. El dueño del contacto no cambia (sigue siendo su asesor de ventas, si tiene). Nunca lanza.
 */
export async function tomarAlResponder(convId: number, userId: string): Promise<void> {
  try {
    const c = await prisma.crmConversacion.findUnique({ where: { id: convId }, include: { linea: { select: { ajustes: true } } } })
    if (!c || c.asignadoId || c.estado === 'finalizadas') return
    const equipo = await equipoDe(c)
    if (!(await miembrosDe(equipo)).some(u => u.id === userId)) return
    const hecho = await prisma.crmConversacion.updateMany({ where: { id: convId, asignadoId: null }, data: { asignadoId: userId, equipo: c.equipo ?? equipo } })
    if (!hecho.count) return
    const nombre = (await usuariosCrm()).find(u => u.id === userId)?.nombre ?? 'Alguien del equipo'
    const m = await prisma.crmMensaje.create({ data: { conversacionId: convId, tipo: 'ev', datos: { ev: 'swap', t: `${nombre} la tomó al responder` } } })
    emitirMsg(convId, m, null)
    await emitirConv(convId, null)
    void dispararReglas('asignada', convId, { asignadoId: userId }).catch(() => {})
  } catch (e) {
    logger.error(`[CRM reparto] tomar al responder ${convId}: ${(e as Error)?.message ?? e}`)
  }
}

/** Asigna una conversación nueva según las reglas de reparto del equipo. Nunca lanza. */
export async function repartir(convId: number, desdeFila = false): Promise<void> {
  try {
    const c = await prisma.crmConversacion.findUnique({ where: { id: convId }, select: { asignadoId: true, estado: true } })
    if (!c || c.asignadoId || c.estado === 'finalizadas') return
    await repartirA(convId, [], desdeFila)
  } catch (e) {
    logger.error(`[CRM reparto] conversación ${convId}: ${(e as Error)?.message ?? e}`)
  }
}
