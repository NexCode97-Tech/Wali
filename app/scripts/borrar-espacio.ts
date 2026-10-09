/**
 * Borra un espacio con todo lo suyo y las cuentas que solo pertenecían a él. No se puede deshacer.
 *
 *   pnpm borrar-espacio --id acme --confirmar acme
 *
 * `--confirmar` repite el id, para no borrar uno por error. No borra el espacio por defecto (CRM_ESPACIO).
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined }

async function main() {
  const id = (arg('id') ?? '').trim()
  if (!id || arg('confirmar') !== id) throw new Error('--id y --confirmar deben ser el mismo id del espacio')
  if (id === (process.env.CRM_ESPACIO || 'principal')) throw new Error('ese es el espacio por defecto: no se borra')
  const e = await prisma.crmEspacio.findUnique({ where: { id }, select: { nombre: true } })
  if (!e) throw new Error(`no existe el espacio «${id}»`)
  const miembros = (await prisma.crmMiembro.findMany({ where: { espacioId: id }, select: { userId: true } })).map(m => m.userId)
  const enOtros = new Set((await prisma.crmMiembro.findMany({ where: { userId: { in: miembros }, espacioId: { not: id } }, select: { userId: true } })).map(m => m.userId))
  const solos = miembros.filter(u => !enOtros.has(u))
  await prisma.$transaction([
    prisma.crmEspacio.delete({ where: { id } }), // las tablas crm_* del espacio se borran en cascada
    prisma.notificacion.deleteMany({ where: { userId: { in: solos } } }),
    prisma.recuperacionClave.deleteMany({ where: { userId: { in: solos } } }),
    prisma.user.deleteMany({ where: { id: { in: solos } } }),
  ])
  console.log(`Espacio «${e.nombre}» (${id}) borrado, con ${solos.length} cuenta(s).`)
}

main().catch(e => { console.error(`No se pudo borrar: ${(e as Error).message}`); process.exitCode = 1 }).finally(() => prisma.$disconnect())
