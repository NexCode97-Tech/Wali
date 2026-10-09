/**
 * Crea un espacio de trabajo (una empresa) con su primer administrador.
 *
 *   pnpm crear-espacio --id acme --nombre "Acme S. A." --correo ana@acme.com --admin "Ana Pérez" [--clave "…"] [--operador]
 *
 * - `--id`: letras minúsculas, números y guiones; es el identificador del espacio (va en la burbuja del chat web).
 * - `--clave`: la contraseña del administrador (10 caracteres o más). Si falta, se genera una y se muestra una vez.
 * - `--operador`: esa cuenta también configura lo común a todos los espacios (las apps de Meta, Instagram y TikTok).
 * Si el espacio ya existe, solo se agrega el administrador. Una cuenta entra a un solo espacio.
 */
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function arg(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

async function main() {
  const id = (arg('id') ?? '').trim()
  const nombre = (arg('nombre') ?? '').trim()
  const correo = (arg('correo') ?? '').trim().toLowerCase()
  const admin = (arg('admin') ?? '').trim()
  const operador = process.argv.includes('--operador')
  if (!/^[a-z0-9][a-z0-9-]{1,30}$/.test(id)) throw new Error('--id: de 2 a 31 caracteres, solo minúsculas, números y guiones')
  if (!nombre) throw new Error('--nombre: el nombre de la empresa')
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(correo)) throw new Error('--correo: el correo del administrador')
  let clave = arg('clave')
  const generada = !clave
  if (!clave) clave = crypto.randomBytes(12).toString('base64url')
  if (clave.length < 10) throw new Error('--clave: 10 caracteres o más')

  await prisma.crmEspacio.upsert({ where: { id }, create: { id, nombre }, update: { nombre } })
  const ya = await prisma.user.findFirst({ where: { email: { equals: correo, mode: 'insensitive' } } })
  if (ya) {
    const otro = await prisma.crmMiembro.findFirst({ where: { userId: ya.id, espacioId: { not: id } } })
    if (otro) throw new Error(`la cuenta ${correo} ya pertenece al espacio «${otro.espacioId}». Una cuenta entra a un solo espacio: usa otro correo.`)
  }
  const user = ya ?? await prisma.user.create({ data: { email: correo, nombre: admin || correo, role: 'ADMIN', operador, passwordHash: await bcrypt.hash(clave, 12) } })
  if (ya && operador && !ya.operador) await prisma.user.update({ where: { id: ya.id }, data: { operador: true } })
  await prisma.crmMiembro.upsert({ where: { espacioId_userId: { espacioId: id, userId: user.id } }, create: { espacioId: id, userId: user.id }, update: {} })

  console.log(`Espacio «${nombre}» (${id}) listo.`)
  if (ya) console.log(`La cuenta ${correo} ya existía: quedó agregada al espacio con la contraseña que tenía.`)
  else console.log(`Administrador: ${correo}${generada ? `\nContraseña (se muestra solo esta vez): ${clave}` : ''}`)
}

main().catch(e => { console.error(`No se pudo crear el espacio: ${(e as Error).message}`); process.exitCode = 1 }).finally(() => prisma.$disconnect())
