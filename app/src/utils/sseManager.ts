import { Response } from 'express'

/**
 * Clientes SSE conectados (una entrada por pestaña abierta). Se guarda quién es
 * cada uno para emitir solo a ciertos roles: los mensajes del CRM son de
 * clientes y no deben viajar al navegador de marketing (26-sep).
 */
export interface Conexion {
  userId: string
  /** El rol con el que se autorizó (el visitante de solo lectura cuenta como ADMIN). */
  role: string
  /** Abierta desde el CRM (ticket pedido con `{origen:'crm'}`): cuenta como «tiene el CRM abierto». */
  crm?: boolean
  /** La sesión (SesionActiva.sid) con la que se pidió el ticket, para cortar la conexión si la cierran. */
  sid?: string | null
}

const clients = new Map<Response, Conexion>()

/**
 * Al cerrar la última pestaña del CRM se espera un momento antes de dar a la
 * persona por desconectada: recargar la página o una reconexión del SSE (5 s)
 * no deben mostrarla fuera ni sacarla del reparto.
 */
const GRACIA_CRM_MS = 12_000
const graciaCrm = new Map<string, NodeJS.Timeout>()
let avisoPresencia: ((userId: string, conectado: boolean) => void) | null = null

/** Quien quiera enterarse cuando alguien abre o cierra el CRM (lo usa routes/eventos.ts para emitir `pref`). */
export function alCambiarPresenciaCrm(fn: (userId: string, conectado: boolean) => void) {
  avisoPresencia = fn
}

function avisar(userId: string, conectado: boolean) {
  try { avisoPresencia?.(userId, conectado) } catch { /* el aviso nunca tumba una conexión */ }
}

function tieneCrmAbierto(userId: string): boolean {
  for (const q of clients.values()) if (q.crm && q.userId === userId) return true
  return false
}

export function addClient(res: Response, quien: Conexion = { userId: '', role: '' }) {
  const esCrm = Boolean(quien.crm && quien.userId)
  const estaba = esCrm && (tieneCrmAbierto(quien.userId) || graciaCrm.has(quien.userId))
  if (esCrm) {
    const t = graciaCrm.get(quien.userId)
    if (t) { clearTimeout(t); graciaCrm.delete(quien.userId) }
  }
  clients.set(res, quien)
  if (esCrm && !estaba) avisar(quien.userId, true)
}

/** Quita la conexión. `inmediato`: sin esperar la gracia (cuenta suspendida, sesión cerrada). */
export function removeClient(res: Response, inmediato = false) {
  const q = clients.get(res)
  if (!q) return
  clients.delete(res)
  if (!q.crm || !q.userId || tieneCrmAbierto(q.userId)) return
  if (inmediato) {
    const t = graciaCrm.get(q.userId)
    if (t) { clearTimeout(t); graciaCrm.delete(q.userId) }
    avisar(q.userId, false)
    return
  }
  if (graciaCrm.has(q.userId)) return
  const t = setTimeout(() => {
    graciaCrm.delete(q.userId)
    if (!tieneCrmAbierto(q.userId)) avisar(q.userId, false)
  }, GRACIA_CRM_MS)
  t.unref?.()
  graciaCrm.set(q.userId, t)
}

function escribir(res: Response, payload: string) {
  try {
    res.write(payload)
  } catch {
    removeClient(res)
  }
}

export function broadcast(event: string, data: object) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  clients.forEach((_q, client) => escribir(client, payload))
}

/** Emite solo a las conexiones de estos roles. */
export function broadcastRoles(roles: readonly string[], event: string, data: object, soloA?: ReadonlySet<string>) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  clients.forEach((q, client) => { if (roles.includes(q.role) && (!soloA || soloA.has(q.userId))) escribir(client, payload) })
}

/** Solo a estas personas, sin importar su rol (el CRM se lo manda a quien entra por un equipo). */
export function broadcastUsuarios(ids: ReadonlySet<string>, event: string, data: object) {
  if (!ids.size) return
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  clients.forEach((q, client) => { if (ids.has(q.userId)) escribir(client, payload) })
}

/** Copia de las conexiones abiertas (para revisarlas contra la base). */
export function conexionesAbiertas(): Conexion[] {
  return [...clients.values()].map(q => ({ ...q }))
}

/**
 * Corta las conexiones que cumplan la condición. La pestaña se reconecta sola
 * pidiendo un ticket nuevo, y ahí `authenticate` aplica lo que diga la base
 * (suspendida, sin sesión, otro rol). Devuelve cuántas cortó.
 */
export function cerrarConexiones(debeCerrar: (q: Conexion) => boolean): number {
  let n = 0
  for (const [res, q] of [...clients.entries()]) {
    if (!debeCerrar(q)) continue
    removeClient(res, true)
    try { res.end() } catch { /* ya estaba cerrada */ }
    n++
  }
  return n
}

/** Corta todas las conexiones de una persona (al suspenderla, cambiarle el rol o cerrarle las sesiones). */
export function cerrarDe(userId: string): number {
  return cerrarConexiones(q => q.userId === userId)
}

/**
 * Quiénes tienen el CRM abierto ahora: al menos una conexión pedida con
 * `{origen:'crm'}`, o la cerraron hace menos de la gracia (están recargando).
 */
export function usuariosEnCrm(): Set<string> {
  const out = new Set<string>(graciaCrm.keys())
  for (const q of clients.values()) if (q.crm && q.userId) out.add(q.userId)
  return out
}

/**
 * «En línea» para el CRM (GET /crm/inicio, reparto y reglas): lo mismo que
 * `usuariosEnCrm`. Tener abierta otra página de la plataforma no cuenta.
 */
export function usuariosConectados(): Set<string> {
  return usuariosEnCrm()
}
