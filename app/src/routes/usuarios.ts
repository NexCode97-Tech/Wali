import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma'
import { asyncHandler } from '../middleware/errorHandler'
import { authenticate } from '../middleware/auth'
import { ApiResponse } from '../utils/response'
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../utils/errors'
import { auditLog } from '../utils/auditLogger'
import { cerrarDe } from '../utils/sseManager'
import { TODOS } from '../utils/roles'
import { cuentaDe, enEspacio, espacioDeUsuario, usuariosDeCuenta, usuariosDeEspacio } from '../services/crm/espacio'
import { usuariosCrm } from '../services/crm/usuarios'
import { limiteUsuarios } from '../services/crm/plan'
import { cifrarClave, claveValida } from './auth'

/**
 * Las cuentas del espacio de trabajo: crear, cambiar el rol, suspender y poner una contraseña nueva. Solo el
 * administrador, y solo sobre la gente de su propio espacio. Una cuenta no se borra, se suspende: sus
 * conversaciones y mensajes quedan con su nombre, y lo que tenía abierto vuelve al reparto (services/crm/usuarios.ts).
 */
const router = Router()
router.use(authenticate)

/** El espacio de quien pide, si es su administrador (la cuenta de solo lectura no administra). */
async function espacioAdmin(req: Request): Promise<string> {
  if (req.userRole !== 'ADMIN') throw new ForbiddenError('Solo el administrador gestiona las cuentas')
  const espacio = await espacioDeUsuario(req.userId!)
  if (!espacio) throw new ForbiddenError('Tu cuenta no pertenece a ningún espacio de trabajo')
  return espacio
}

const rol = z.enum(TODOS as [string, ...string[]])
const publica = { id: true, email: true, nombre: true, telefono: true, image: true, role: true, suspendido: true, ultimoIngreso: true, createdAt: true } as const

router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const espacio = await espacioAdmin(req)
  const filas = await prisma.user.findMany({ where: { id: { in: await usuariosDeEspacio(espacio) } }, select: publica, orderBy: [{ suspendido: 'asc' }, { nombre: 'asc' }] })
  return ApiResponse.success(res, filas)
}))

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  if (req.soloLectura) throw new ForbiddenError('Modo de solo lectura: puedes ver todo, pero no hacer cambios.')
  const espacio = await espacioAdmin(req)
  const d = z.object({
    nombre: z.string().trim().min(2, 'Escribe el nombre').max(80),
    email: z.string().trim().toLowerCase().email('Ese correo no parece completo').max(200),
    role: rol.default('AGENTE'),
    password: claveValida,
  }).parse(req.body)
  if (await prisma.user.findFirst({ where: { email: { equals: d.email, mode: 'insensitive' } }, select: { id: true } })) throw new ConflictError('Ya hay una cuenta con ese correo')
  const tope = await limiteUsuarios(espacio)
  if ((await usuariosDeCuenta(await cuentaDe(espacio))).length >= tope) throw new ForbiddenError(`Tu plan incluye ${tope} usuarios y ya están en uso. Sube de plan en Ajustes → Plan y pagos para agregar más.`)
  const u = await prisma.$transaction(async tx => {
    const nuevo = await tx.user.create({ data: { nombre: d.nombre, email: d.email, role: d.role as never, passwordHash: await cifrarClave(d.password) }, select: publica })
    await tx.crmMiembro.create({ data: { espacioId: espacio, userId: nuevo.id } })
    return nuevo
  })
  await enEspacio(espacio, () => usuariosCrm(true))
  auditLog(req, 'CREATE', 'usuario', u.id)
  return ApiResponse.created(res, u)
}))

router.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
  if (req.soloLectura) throw new ForbiddenError('Modo de solo lectura: puedes ver todo, pero no hacer cambios.')
  const espacio = await espacioAdmin(req)
  const id = String(req.params.id)
  if (!(await usuariosDeEspacio(espacio)).includes(id)) throw new NotFoundError('Esa cuenta no existe')
  const d = z.object({ role: rol.optional(), suspendido: z.boolean().optional(), password: claveValida.optional() }).parse(req.body)
  const yo = id === req.userId
  if (yo && (d.suspendido || (d.role && d.role !== 'ADMIN'))) throw new ValidationError('No puedes suspenderte ni quitarte el rol de administrador. Pídeselo a otro administrador.')
  // Siempre queda al menos un administrador activo en el espacio.
  if (d.suspendido || (d.role && d.role !== 'ADMIN')) {
    const otros = await prisma.user.count({ where: { id: { in: (await usuariosDeEspacio(espacio)).filter(x => x !== id) }, role: 'ADMIN', suspendido: false } })
    const era = await prisma.user.findUnique({ where: { id }, select: { role: true } })
    if (era?.role === 'ADMIN' && !otros) throw new ValidationError('El espacio no puede quedar sin un administrador activo')
  }
  const u = await prisma.user.update({
    where: { id },
    data: { ...(d.role ? { role: d.role as never } : {}), ...(d.suspendido !== undefined ? { suspendido: d.suspendido } : {}), ...(d.password ? { passwordHash: await cifrarClave(d.password), sesionesDesde: new Date() } : {}) },
    select: publica,
  })
  // Con otro rol o suspendida, su conexión en vivo se corta: la pestaña vuelve a pedir permiso con los datos de hoy.
  if (d.role || d.suspendido !== undefined) cerrarDe(id)
  await enEspacio(espacio, () => usuariosCrm(true))
  auditLog(req, 'UPDATE', 'usuario', id, { cambios: Object.keys(d) })
  return ApiResponse.success(res, u)
}))

export default router
