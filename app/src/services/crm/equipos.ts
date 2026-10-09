import { leerAjuste } from './ajustes'
import { usuariosCrm, type UsuarioCrm } from './usuarios'
import { ValidationError } from '../../utils/errors'

/**
 * Equipos del CRM con sus roles: el ajuste `equipos` (tabla crm_ajustes) ya
 * normalizado, igual para el API y para la pantalla. Lo que cambió con los roles:
 *
 * - `lideres: {equipo: [userId]}`: quiénes lideran cada equipo (varios se permiten, siempre dentro de `ids`).
 *   Su rol es «Líder de <Equipo>», sale solo del nombre del equipo y no se guarda.
 * - `roles: {equipo: texto}`: cómo se llama la gente del equipo que no es líder (Ventas «Asesor», Moderación
 *   «Auditor»). Lo escribe a mano el líder o el administrador; si no hay, «Integrante».
 * - `subequipos: {equipo: [{id, n, ids, metodo}]}`: grupos dentro de un equipo con su propia forma de repartir.
 *   La conversación que se pasa a uno guarda su id en `extra.subequipo`.
 * - «Todos ven y cualquiera la toma» ya no existe: un `todos` guardado pasa a `turnos`.
 *
 * Valores iniciales (regla 3, para que nadie pierda acceso al subir): si un equipo no tiene `lideres` guardados
 * (la clave no está), son líderes sus personas con rol de plataforma LIDER_VENTAS o ADMIN. Una lista guardada,
 * aunque esté vacía, manda. `normalizarEquipos` es pura y se aplica en cada lectura (`leerEquipos`) y en cada
 * guardado: el primer guardado después de subir deja escritos los valores iniciales.
 *
 * Este archivo no importa tiempoReal (tiempoReal lo usa a él).
 */

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})

export interface Subequipo {
  /** Estable: `sq-` y de 4 a 24 letras o números. Único en todo el ajuste. */
  id: string
  /** Nombre, de 1 a 60 caracteres; no se repite dentro de su equipo (sin tildes ni mayúsculas). */
  n: string
  /** Personas del subequipo, todas del equipo. El orden es el de sus turnos. */
  ids: string[]
  /** turnos | menos | lider */
  metodo: string
}

export interface EquiposNorm {
  /** Nombres de cada equipo en el orden de `ids` (los pone el API). Los equipos son sus claves, en ese orden. */
  miembros: Record<string, string[]>
  /** Personas de cada equipo por id; el orden es el de los turnos. */
  ids: Record<string, string[]>
  porNombre: Record<string, string>
  colores: Record<string, string>
  /** turnos | menos | lider. Sin clave: la forma general (cfg.reparto.metodo). */
  metodos: Record<string, string>
  transferibles: Record<string, boolean>
  /** «Guardar los leads cuando no haya nadie disponible» (7-oct): false = quedan sin asignar hasta que alguien los tome. Sin clave: encendido. */
  cola: Record<string, boolean>
  /** Ícono del equipo: un nombre de la lista de íconos o un SVG subido (data:image/svg+xml;base64). */
  iconos: Record<string, string>
  /** Máximo de conversaciones abiertas por persona, de 1 a 500. */
  topes: Record<string, number>
  lideres: Record<string, string[]>
  roles: Record<string, string>
  subequipos: Record<string, Subequipo[]>
}

export const METODOS_VALIDOS = ['turnos', 'menos', 'lider'] as const
/** Rol inicial de los integrantes por equipo. */
// Desde el 7-oct todos los equipos tienen líderes y miembros: el rol de los integrantes ya no se escribe.
export const ROL_INICIAL: Record<string, string> = {}
export const ROL_POR_DEFECTO = 'Miembro'
export const MAX_SUBEQUIPOS = 30
export const MAX_ROL = 40
export const MAX_NOMBRE_SUBEQUIPO = 60
/** El rol del líder: automático, no se guarda ni se edita. */
export const nombreLider = (equipo: string) => `Líder de ${equipo}`

/** Sin tildes, sin mayúsculas y con un solo espacio: para comparar nombres. */
export const planoNombre = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

const ROLES_LIDER_INICIAL = new Set(['ADMIN', 'LIDER'])
const ROL_INICIAL_PLANO = new Map(Object.entries(ROL_INICIAL).map(([eq, r]) => [planoNombre(eq), r]))
const ID_SUBEQUIPO = /^sq-[a-z0-9]{4,24}$/
const COLOR = /^#[0-9a-f]{6}$/i
const ICONO = /^[a-z][a-z0-9-]{0,24}$/
const ICONO_SVG = /^data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+$/
export const MAX_ICONO_SVG = 40_000
/** Un ícono válido: nombre de la lista o un SVG subido sin scripts ni enlaces (se pinta como <img>, igual se revisa). */
export function iconoValido(v: unknown): string | null {
  if (typeof v !== 'string') return null
  if (ICONO.test(v)) return v
  if (v.length > MAX_ICONO_SVG || !ICONO_SVG.test(v)) return null
  const svg = Buffer.from(v.slice(v.indexOf(',') + 1), 'base64').toString('utf8')
  if (!/<svg[\s>]/i.test(svg) || /<script|on[a-z]+\s*=|javascript:|<foreignObject|xlink:href\s*=\s*["'](?!#)|href\s*=\s*["'](?!#)/i.test(svg)) return null
  return v
}
const sinControl = (t: string) => !/[\u0000-\u001f\u007f]/.test(t)
const unicos = (xs: string[]) => [...new Set(xs)]
const limpio = (v: unknown) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : '')

/** El rol de los integrantes cuando no hay uno escrito. */
export const rolInicial = (equipo: string) => ROL_INICIAL_PLANO.get(planoNombre(equipo)) ?? ROL_POR_DEFECTO

/** 'todos' (ya no existe) pasa a 'turnos'; lo que no es una forma válida, null. */
export function metodoValido(m: unknown): string | null {
  if (m === 'todos') return 'turnos'
  return typeof m === 'string' && (METODOS_VALIDOS as readonly string[]).includes(m) ? m : null
}

/** Id nuevo para un subequipo que llegó sin id, con uno inválido o repetido: sale del equipo y el nombre, así una
 *  lectura repetida da el mismo. Si choca con uno usado, se prueba con otra semilla. */
function idNuevo(equipo: string, n: string, usados: Set<string>): string {
  for (let k = 0; ; k++) {
    let h = 0x811c9dc5
    for (const ch of `${equipo}|${n}|${k}`) { h ^= ch.codePointAt(0)!; h = Math.imul(h, 0x01000193) >>> 0 }
    const id = `sq-${h.toString(36).padStart(7, '0')}`
    if (!usados.has(id)) return id
  }
}

export interface OpcionesNormalizar {
  /** Al guardar: un rol o un subequipo con forma inválida responde 400 en vez de descartarse. */
  estricto?: boolean
}

/**
 * El ajuste `equipos` con la forma completa y los valores iniciales. Pura: `usuarios` (las personas del CRM con
 * su rol de plataforma) solo sirve para los líderes iniciales y para encontrar por nombre a la gente de un equipo
 * guardado sin `ids` (pantallas de antes del 28-sep), como `miembrosDe` pero sin el respaldo de los VENDEDOR.
 */
export function normalizarEquipos(valor: unknown, usuarios: UsuarioCrm[], op: OpcionesNormalizar = {}): EquiposNorm {
  const v = obj(valor)
  const miembrosIn = obj(v.miembros)
  const idsIn = obj(v.ids)
  const lideresIn = obj(v.lideres)
  const rolesIn = obj(v.roles)
  const subIn = obj(v.subequipos)
  const coloresIn = obj(v.colores)
  const metodosIn = obj(v.metodos)
  const transfIn = obj(v.transferibles)
  const colaIn = obj(v.cola)
  const iconosIn = obj(v.iconos)
  const rolDe = new Map(usuarios.map(u => [u.id, u.rol]))
  const nombreDe = new Map(usuarios.map(u => [u.id, u.nombre]))
  const idPorNombre = new Map(usuarios.map(u => [u.nombre.trim().toLowerCase(), u.id]))
  const out: EquiposNorm = { miembros: {}, ids: {}, porNombre: {}, colores: {}, metodos: {}, transferibles: {}, cola: {}, iconos: {}, topes: {}, lideres: {}, roles: {}, subequipos: {} }
  const error = (texto: string) => { if (op.estricto) throw new ValidationError(texto) }

  const equipos = Object.keys(miembrosIn)
  const usados = new Set<string>()
  const sinId: { eq: string; s: Subequipo }[] = []
  for (const eq of equipos) {
    const nombres = Array.isArray(miembrosIn[eq]) ? (miembrosIn[eq] as unknown[]).map(x => (typeof x === 'string' ? x : '')) : []
    const explicitos = Array.isArray(idsIn[eq])
    const ids = explicitos
      ? unicos((idsIn[eq] as unknown[]).filter((x): x is string => typeof x === 'string' && x.length > 0))
      : unicos(nombres.map(n => idPorNombre.get(n.trim().toLowerCase())).filter((x): x is string => Boolean(x)))
    out.ids[eq] = ids
    // Los nombres van alineados con los ids (la pantalla los usa para quien aún no está en su lista de personas).
    out.miembros[eq] = explicitos && nombres.length === ids.length ? nombres : ids.map((id, i) => nombreDe.get(id) ?? nombres[i] ?? '')

    const dentro = new Set(ids)
    const lid = lideresIn[eq]
    out.lideres[eq] = Array.isArray(lid)
      ? ids.filter(id => (lid as unknown[]).map(String).includes(id))
      : ids.filter(id => ROLES_LIDER_INICIAL.has(rolDe.get(id) ?? ''))

    void rolesIn
    out.roles[eq] = ROL_POR_DEFECTO

    if (typeof coloresIn[eq] === 'string' && COLOR.test(coloresIn[eq] as string)) out.colores[eq] = coloresIn[eq] as string
    const m = metodoValido(metodosIn[eq])
    if (m) out.metodos[eq] = m
    if (typeof transfIn[eq] === 'boolean') out.transferibles[eq] = transfIn[eq] as boolean
    if (typeof colaIn[eq] === 'boolean') out.cola[eq] = colaIn[eq] as boolean
    if (iconosIn[eq] !== undefined && iconosIn[eq] !== null) {
      const ic = iconoValido(iconosIn[eq])
      if (ic) out.iconos[eq] = ic
      else error(`El ícono de ${eq} no es válido: elige uno de la lista o sube un SVG sin scripts de máximo 30 KB.`)
    }

    const lista = Array.isArray(subIn[eq]) ? subIn[eq] as unknown[] : []
    if (lista.length > MAX_SUBEQUIPOS) error(`${eq} puede tener máximo ${MAX_SUBEQUIPOS} subequipos.`)
    const vistos = new Set<string>()
    const subs: Subequipo[] = []
    for (const crudo of lista.slice(0, MAX_SUBEQUIPOS)) {
      const s = obj(crudo)
      const n = limpio(s.n)
      if (!n) { error(`Falta el nombre de un subequipo de ${eq}.`); continue }
      if (n.length > MAX_NOMBRE_SUBEQUIPO) { error(`El nombre del subequipo «${n.slice(0, 30)}…» puede tener máximo ${MAX_NOMBRE_SUBEQUIPO} caracteres.`); continue }
      if (!sinControl(n)) { error(`El nombre del subequipo «${n}» tiene caracteres que no se pueden guardar.`); continue }
      const clave = planoNombre(n)
      if (vistos.has(clave)) { error(`${eq} ya tiene un subequipo «${n}».`); continue }
      vistos.add(clave)
      // Solo personas del equipo, sin repetir; quien no es del equipo se descarta.
      const idsSub = unicos((Array.isArray(s.ids) ? s.ids as unknown[] : []).filter((x): x is string => typeof x === 'string')).filter(id => dentro.has(id))
      const sub: Subequipo = { id: '', n, ids: idsSub, metodo: metodoValido(s.metodo) ?? 'turnos' }
      if (typeof s.id === 'string' && ID_SUBEQUIPO.test(s.id) && !usados.has(s.id)) { sub.id = s.id; usados.add(s.id) } else sinId.push({ eq, s: sub })
      subs.push(sub)
    }
    out.subequipos[eq] = subs
  }
  // Los ids nuevos, después de apartar todos los que llegaron bien (así uno nuevo nunca le quita el suyo a otro).
  for (const { eq, s } of sinId) { s.id = idNuevo(eq, s.n, usados); usados.add(s.id) }

  for (const [id, t] of Object.entries(obj(v.topes))) if (Number.isInteger(t) && (t as number) >= 1 && (t as number) <= 500) out.topes[id] = t as number
  for (const [n, id] of Object.entries(obj(v.porNombre))) if (typeof id === 'string' && id) out.porNombre[n] = id
  return out
}

/** El ajuste `equipos` del espacio actual, normalizado (vacío si nunca se guardó). */
export async function leerEquipos(): Promise<EquiposNorm> {
  return normalizarEquipos(await leerAjuste('equipos'), await usuariosCrm())
}

/** El equipo de una conversación para saber quién la ve: sin equipo es de Ventas, igual que en la pantalla. */
export const equipoDeConv = (c: { equipo: string | null }) => c.equipo || 'Ventas'

/** El subequipo de una conversación (`extra.subequipo`), solo si es de ese equipo; si no, se ignora. */
export function subequipoDe(eqs: EquiposNorm, equipo: string, extra: unknown): Subequipo | null {
  const id = obj(extra).subequipo
  if (typeof id !== 'string' || !id) return null
  return (eqs.subequipos[equipo] ?? []).find(s => s.id === id) ?? null
}

/** Las personas de estos equipos, sin repetir. */
export function genteDe(eqs: EquiposNorm, equipos: string[]): string[] {
  return unicos(equipos.flatMap(eq => eqs.ids[eq] ?? []))
}
