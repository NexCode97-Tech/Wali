import { prismaGlobal } from './bd'
import { leerAjuste, guardarAjuste } from './ajustes'
import { enEspacio } from './espacio'
import { logger } from '../../utils/logger'

/**
 * Cuando una persona sale del CRM (17-nov, caso nacarbe): la suspenden o le cancelan la invitación.
 *
 * - quitarDeEquipos: sale de los equipos guardados (integrantes, líderes, subequipos y su máximo de conversaciones).
 *   Antes quedaba guardada en el equipo: seguía apareciendo en Personas y su ficha decía «no encontrada».
 * - avisarGente: la lista de personas viaja en vivo a todas las pantallas abiertas del espacio ({tipo:'usuarios'});
 *   antes solo cambiaba al recargar.
 */

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})

/** La saca de los equipos del espacio en que se corre. Devuelve si cambió algo. */
export async function quitarDeEquipos(userId: string, por: string | null): Promise<boolean> {
  const crudo = await leerAjuste<Json>('equipos')
  const v = obj(crudo)
  const miembros = obj(v.miembros), ids = obj(v.ids), lideres = obj(v.lideres), subequipos = obj(v.subequipos), topes = obj(v.topes)
  let cambio = false
  for (const eq of Object.keys(miembros)) {
    const lista = ids[eq]
    if (Array.isArray(lista)) {
      const i = lista.indexOf(userId)
      if (i >= 0) {
        // Los nombres van alineados con los ids: sale el de la misma posición.
        const nombres = miembros[eq]
        if (Array.isArray(nombres) && nombres.length === lista.length) miembros[eq] = nombres.filter((_, k) => k !== i)
        ids[eq] = lista.filter(x => x !== userId)
        cambio = true
      }
    }
    const lid = lideres[eq]
    if (Array.isArray(lid) && lid.includes(userId)) { lideres[eq] = lid.filter(x => x !== userId); cambio = true }
    const subs = subequipos[eq]
    if (Array.isArray(subs)) {
      subequipos[eq] = subs.map(s => {
        const o = obj(s), l = o.ids
        if (Array.isArray(l) && l.includes(userId)) { cambio = true; return { ...o, ids: l.filter(x => x !== userId) } }
        return s
      })
    }
  }
  if (userId in topes) { delete topes[userId]; cambio = true }
  if (!cambio) return false
  const valor = { ...v, miembros, ids, lideres, subequipos, topes }
  const f = await guardarAjuste('equipos', valor, por)
  const { emitirCrm, olvidarGenteCrm } = await import('./tiempoReal')
  olvidarGenteCrm()
  emitirCrm({ tipo: 'ajuste', clave: 'equipos', valor, updatedAt: f.updatedAt.toISOString() }, por)
  return true
}

/** La lista de personas del espacio en que se corre, a todas sus pantallas abiertas. */
export async function avisarGente(por: string | null): Promise<void> {
  const { usuariosCrm } = await import('./usuarios')
  const lista = await usuariosCrm(true)
  const { emitirCrm, olvidarGenteCrm } = await import('./tiempoReal')
  olvidarGenteCrm()
  emitirCrm({ tipo: 'usuarios', usuarios: lista.map(u => ({ id: u.id, nombre: u.nombre, foto: u.foto, rol: u.rol, pendiente: u.pendiente })) }, por)
}

/** Salió del CRM en todos sus espacios (la suspensión es de la cuenta): fuera de los equipos y la lista al día. */
export async function salioDelCrm(userId: string, por: string | null): Promise<void> {
  const espacios = (await prismaGlobal.crmMiembro.findMany({ where: { userId }, select: { espacioId: true } })).map(m => m.espacioId)
  for (const e of espacios) {
    await enEspacio(e, async () => {
      await quitarDeEquipos(userId, por)
      await avisarGente(por)
    }).catch(err => logger.warn(`[CRM personas] ${e}: no se pudo sacar a ${userId} de los equipos: ${(err as Error).message}`))
  }
}

/**
 * Para los procesos (cada 10 minutos, por espacio): quien quedó suspendido y sigue en algún equipo (de antes de este
 * arreglo) sale de ahí. Solo los suspendidos: alguien recién agregado que aún no es miembro no se toca.
 */
export async function limpiarSuspendidosDeEquipos(): Promise<number> {
  const v = obj(await leerAjuste<Json>('equipos'))
  const enEquipos = new Set<string>()
  for (const l of Object.values(obj(v.ids))) if (Array.isArray(l)) l.forEach(x => enEquipos.add(String(x)))
  for (const l of Object.values(obj(v.lideres))) if (Array.isArray(l)) l.forEach(x => enEquipos.add(String(x)))
  for (const subs of Object.values(obj(v.subequipos))) if (Array.isArray(subs)) subs.forEach(s => { const l = obj(s).ids; if (Array.isArray(l)) l.forEach(x => enEquipos.add(String(x))) })
  if (!enEquipos.size) return 0
  const suspendidos = await prismaGlobal.user.findMany({ where: { id: { in: [...enEquipos] }, suspendido: true }, select: { id: true } })
  let n = 0
  for (const u of suspendidos) if (await quitarDeEquipos(u.id, null)) n++
  if (n) await avisarGente(null)
  return n
}
