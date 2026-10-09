/**
 * Le pone una contraseña nueva a una cuenta, para cuando nadie puede entrar y el correo de recuperación no está activo.
 *
 *   pnpm cambiar-clave --correo ana@acme.com [--clave "…"]
 *
 * Sin `--clave` se genera una de 16 caracteres y se muestra una sola vez. Corre dentro del servicio (railway ssh).
 */
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : undefined }

async function main() {
  const correo = (arg('correo') ?? '').trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(correo)) throw new Error('--correo: el correo de la cuenta')
  const clave = arg('clave') ?? crypto.randomBytes(12).toString('base64url')
  if (clave.length < 10) throw new Error('--clave: 10 caracteres o más')
  const u = await prisma.user.findFirst({ where: { email: { equals: correo, mode: 'insensitive' } }, select: { id: true } })
  if (!u) throw new Error(`no hay una cuenta con ${correo}`)
  await prisma.user.update({ where: { id: u.id }, data: { passwordHash: await bcrypt.hash(clave, 12) } })
  console.log(`Contraseña cambiada para ${correo}.${arg('clave') ? '' : `\nContraseña (se muestra solo esta vez): ${clave}`}`)
}

main().catch(e => { console.error(`No se pudo cambiar: ${(e as Error).message}`); process.exitCode = 1 }).finally(() => prisma.$disconnect())
