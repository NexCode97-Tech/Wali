import { prisma } from './bd'
import { logger } from '../../utils/logger'
import { enEspacio, espacioActual, usuariosDeEspacio } from './espacio'

/**
 * Las personas del CRM: los miembros del espacio de trabajo (espacio.ts) que no están suspendidos.
 * La pantalla asigna por NOMBRE (`c.asig = 'Ana Pérez'`), así que aquí se
 * resuelve nombre ↔ id. El nombre visible es el del usuario (el que cada
 * quien escribe en su perfil) o, si falta, el del asesor o el correo; si dos
 * personas se llamaran igual, la segunda lleva su correo entre paréntesis.
 *
 * Cuando alguien sale de la lista (lo suspenden, le cambian el rol fuera de
 * Ventas o lo borran), sus conversaciones abiertas o pendientes quedan sin
 * asignar, con un evento que lo dice, para que el reparto automático las tome
 * (`liberarDeInactivos`). Se revisa al arrancar y cada vez que la lista cambia.
 */
export interface UsuarioCrm { id: string; nombre: string; foto: string | null; rol: string }

const caches = new Map<string, { en: number; lista: UsuarioCrm[] }>()

export async function usuariosCrm(fresco = false): Promise<UsuarioCrm[]> {
  const espacio = espacioActual()
  const cache = caches.get(espacio)
  if (!fresco && cache && Date.now() - cache.en < 60_000) return cache.lista
  const filas = await prisma.user.findMany({
    where: { id: { in: await usuariosDeEspacio(espacio) }, suspendido: false },
    select: { id: true, nombre: true, email: true, image: true, role: true },
    orderBy: { createdAt: 'asc' },
  })
  const vistos = new Set<string>()
  const lista = filas.map(u => {
    let nombre = nombreVisible(u)
    if (vistos.has(nombre.toLowerCase())) nombre = `${nombre} (${u.email})`
    vistos.add(nombre.toLowerCase())
    return { id: u.id, nombre, foto: u.image, rol: u.role }
  })
  const antes = cache?.lista
  caches.set(espacio, { en: Date.now(), lista })
  // Al arrancar (sin lista previa) o si alguien salió de la lista.
  const ahora = new Set(lista.map(u => u.id))
  if (!antes || antes.some(u => !ahora.has(u.id))) programarLiberacion()
  return lista
}

function nombreVisible(u: { nombre: string | null; email: string }): string {
  return (u.nombre || u.email).trim()
}

export async function nombreDe(id: string | null | undefined): Promise<string | null> {
  if (!id) return null
  return (await usuariosCrm()).find(u => u.id === id)?.nombre ?? null
}

export async function idDeNombre(nombre: string | null | undefined): Promise<string | null> {
  if (!nombre) return null
  const n = nombre.trim().toLowerCase()
  return (await usuariosCrm()).find(u => u.nombre.toLowerCase() === n)?.id ?? null
}

// ─── Conversaciones de quien ya no está en el CRM ────────────────────────────

/** Una vuelta de liberación a la vez por espacio; si pide otra mientras corre, se hace al terminar. */
const liberando = new Map<string, Promise<number>>()
const otraVuelta = new Set<string>()

function programarLiberacion() {
  // Las pruebas locales sin procesos (SIN_JOBS=1) y los scripts no escriben por su cuenta.
  if (process.env.SIN_JOBS === '1') return
  const espacio = espacioActual()
  if (liberando.has(espacio)) { otraVuelta.add(espacio); return }
  liberando.set(espacio, enEspacio(espacio, () => liberarDeInactivos())
    .catch(e => { logger.error(`[CRM] liberar conversaciones de personas inactivas: ${(e as Error)?.message ?? e}`); return 0 })
    .finally(() => {
      liberando.delete(espacio)
      if (otraVuelta.delete(espacio)) enEspacio(espacio, programarLiberacion)
    }))
}

/**
 * Deja sin asignar las conversaciones abiertas o pendientes de quien ya no
 * tiene acceso al CRM (cuenta suspendida o borrada, o ya no es del espacio),
 * con un evento en la conversación. Las que esperan respuesta las toma el
 * reparto automático en su vuelta de cada minuto. Devuelve cuántas liberó.
 */
export async function liberarDeInactivos(): Promise<number> {
  const grupos = await prisma.crmConversacion.groupBy({
    by: ['asignadoId'],
    where: { asignadoId: { not: null }, estado: { in: ['abiertas', 'pendientes'] } },
  })
  const ids = grupos.map(g => g.asignadoId).filter((x): x is string => Boolean(x))
  if (!ids.length) return 0
  const personas = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, role: true, suspendido: true, nombre: true, email: true },
  })
  const porId = new Map(personas.map(u => [u.id, u]))
  const adentro = new Set(await usuariosDeEspacio(espacioActual()))
  const fuera = ids.filter(id => {
    const u = porId.get(id)
    return !u || u.suspendido || !adentro.has(id)
  })
  if (!fuera.length) return 0

  // Import tardío: tiempoReal → formas → usuarios.
  const { emitirConv, emitirMsg } = await import('./tiempoReal')
  let n = 0
  for (const id of fuera) {
    const u = porId.get(id)
    const quien = u ? nombreVisible(u) : 'la persona asignada'
    const convs = await prisma.crmConversacion.findMany({
      where: { asignadoId: id, estado: { in: ['abiertas', 'pendientes'] } },
      select: { id: true },
    })
    for (const c of convs) {
      // Solo si sigue asignada a esa persona (nadie la tomó mientras tanto).
      const r = await prisma.crmConversacion.updateMany({ where: { id: c.id, asignadoId: id }, data: { asignadoId: null } })
      if (!r.count) continue
      const m = await prisma.crmMensaje.create({
        data: { conversacionId: c.id, tipo: 'ev', datos: { ev: 'swap', t: `Quedó sin asignar porque ${quien} ya no tiene acceso al CRM` } },
      })
      emitirMsg(c.id, m, null)
      await emitirConv(c.id, null)
      n++
    }
  }
  if (n) logger.info(`[CRM] ${n} conversaciones quedaron sin asignar: sus asesores ya no tienen acceso al CRM`)
  return n
}
