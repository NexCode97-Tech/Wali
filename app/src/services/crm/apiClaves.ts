import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Request, Response, NextFunction } from 'express'
import { prisma } from './bd'
import { prismaGlobal } from './bd'
import { enEspacio } from './espacio'
import { estadoPlan } from './plan'
import { configura } from '../../utils/roles'
import { ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from '../../utils/errors'
import { logSecurityEvent } from '../../utils/logger'

/**
 * API pública de Wali · claves (11-nov). Las crea un administrador en Ajustes del CRM › API.
 *
 * - La clave es `wali_live_` + 32 caracteres al azar (192 bits). Se muestra completa una sola vez; en la base queda su
 *   huella SHA-256 (una clave al azar de ese tamaño no necesita un hash lento como una contraseña).
 * - Cada llamada actúa en nombre de quien creó la clave, dentro del espacio de la clave: pasa por los mismos permisos,
 *   alcance y validaciones que la pantalla. Si esa persona ya no es administradora, está suspendida o salió del
 *   espacio, la clave deja de servir.
 * - Permiso `lectura`: solo GET. `escritura`: lectura y acciones. Nada de pagos, cuenta ni ajustes: esas rutas no
 *   existen en la API.
 */

export type Permiso = 'lectura' | 'escritura'
const PREFIJO = 'wali_live_'
const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const FORMA = /^wali_live_[A-Za-z0-9]{32}$/

const huellaDe = (clave: string) => createHash('sha256').update(clave, 'utf8').digest('hex')

function claveNueva(): string {
  // Sin sesgo: se descartan los bytes que no caben parejos en el alfabeto de 62.
  let s = ''
  while (s.length < 32) for (const b of randomBytes(48)) { if (b < 248 && s.length < 32) s += ALFABETO[b % 62] }
  return PREFIJO + s
}

const DIAS: Record<string, number | null> = { '90': 90, '365': 365, nunca: null }

/** Las claves del espacio (sin las revocadas), para la pantalla. */
export async function listarClaves() {
  const l = await prisma.crmApiClave.findMany({ where: { revocadaEn: null }, orderBy: { createdAt: 'asc' } })
  return l.map(k => ({ id: k.id, nombre: k.nombre, prefijo: k.prefijo, permiso: k.permiso, venceEn: k.venceEn, ultimoUso: k.ultimoUso, creada: k.createdAt, vencida: !!k.venceEn && k.venceEn.getTime() < Date.now() }))
}

/** Crea una clave y devuelve la clave completa. Es la única vez que sale del servidor. */
export async function crearClave(datos: { nombre: string; permiso: Permiso; vence: string }, userId: string) {
  const nombre = datos.nombre.trim().slice(0, 60)
  if (nombre.length < 2) throw new ValidationError('Ponle un nombre a la clave para reconocerla en la lista.')
  if (!(datos.vence in DIAS)) throw new ValidationError('Elige cuándo vence la clave.')
  if ((await prisma.crmApiClave.count({ where: { revocadaEn: null } })) >= 20) throw new ValidationError('Este espacio ya tiene 20 claves. Revoca alguna que no uses antes de crear otra.')
  const clave = claveNueva(), dias = DIAS[datos.vence]
  const k = await prisma.crmApiClave.create({
    data: { nombre, permiso: datos.permiso, huella: huellaDe(clave), prefijo: clave.slice(0, PREFIJO.length + 4), creadaPor: userId, venceEn: dias ? new Date(Date.now() + dias * 86_400_000) : null } as never,
  })
  return { id: k.id, clave, nombre: k.nombre, prefijo: k.prefijo, permiso: k.permiso, venceEn: k.venceEn }
}

/** Revoca una clave del espacio: deja de funcionar en ese mismo momento. */
export async function revocarClave(id: string, userId: string) {
  const k = await prisma.crmApiClave.findFirst({ where: { id, revocadaEn: null } })
  if (!k) throw new NotFoundError('Esa clave ya no existe o ya estaba revocada.')
  await prisma.crmApiClave.update({ where: { id }, data: { revocadaEn: new Date(), revocadaPor: userId } })
  return { id, nombre: k.nombre }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** La clave de la API con que entró la petición (solo en /api/v1). */
      apiClave?: { id: string; nombre: string; permiso: Permiso }
    }
  }
}

const sinPermiso = (req: Request, motivo: string) => {
  logSecurityEvent('ACCESS_DENIED', { ip: req.ip, url: req.originalUrl.split('?')[0], method: req.method, motivo: 'api: ' + motivo })
  return new UnauthorizedError('La clave de la API no es válida, venció o fue revocada.')
}

/**
 * La puerta de /api/v1: valida la clave, arma la petición como si la hiciera quien la creó (dentro del espacio de la
 * clave) y corta lo que el permiso o el plan no dejan. Toda respuesta de error es la misma, para no dar pistas.
 */
export function conClaveApi(req: Request, _res: Response, next: NextFunction) {
  const auth = String(req.headers.authorization ?? '')
  const clave = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!FORMA.test(clave)) return next(sinPermiso(req, 'sin clave o con otra forma'))
  const huella = huellaDe(clave)
  ;(async () => {
    const k = await prismaGlobal.crmApiClave.findUnique({ where: { huella } })
    // La comparación final en tiempo constante (la búsqueda ya fue por la huella exacta).
    if (!k || !timingSafeEqual(Buffer.from(k.huella, 'hex'), Buffer.from(huella, 'hex'))) throw sinPermiso(req, 'clave desconocida')
    if (k.revocadaEn) throw sinPermiso(req, 'clave revocada')
    if (k.venceEn && k.venceEn.getTime() < Date.now()) throw sinPermiso(req, 'clave vencida')
    const [u, miembro] = await Promise.all([
      prismaGlobal.user.findUnique({ where: { id: k.creadaPor }, select: { id: true, role: true, nombre: true, email: true, suspendido: true } }),
      prismaGlobal.crmMiembro.findFirst({ where: { espacioId: k.espacioId, userId: k.creadaPor }, select: { userId: true } }),
    ])
    if (!u || u.suspendido || !miembro || !configura(u.role)) throw sinPermiso(req, 'quien creó la clave ya no es administrador del espacio')
    const lectura = ['GET', 'HEAD', 'OPTIONS'].includes(req.method.toUpperCase())
    if (k.permiso !== 'escritura' && !lectura) throw new ForbiddenError('Esta clave es de solo lectura. Crea una de lectura y acciones para hacer cambios.')
    req.userId = u.id
    req.userRole = u.role === 'LECTOR' ? 'ADMIN' : u.role
    req.userName = `${u.nombre ?? u.email} (API · ${k.nombre})`
    req.espacioId = k.espacioId
    req.apiClave = { id: k.id, nombre: k.nombre, permiso: k.permiso as Permiso }
    if (!lectura) {
      const p = await estadoPlan(k.espacioId)
      if (!p.vigente) throw new ForbiddenError('El plan de este espacio no está activo: la API queda en solo lectura hasta renovarlo.')
    }
    // La última vez que se usó, sin escribir en cada llamada (una vez por minuto).
    if (!k.ultimoUso || Date.now() - k.ultimoUso.getTime() > 60_000) prismaGlobal.crmApiClave.update({ where: { id: k.id }, data: { ultimoUso: new Date() } }).catch(() => {})
    return k.espacioId
  })().then(e => enEspacio(e, () => next()), next)
}
