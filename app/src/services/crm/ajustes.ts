import { Prisma } from '@prisma/client'
import { prisma, llaveAjuste, llavePreferencia } from './bd'

/**
 * Ajustes del equipo del CRM por clave (cfg, cvcfg, equipos, etapas…). Cada
 * valor es el objeto de la maqueta tal cual (docs/crm/CONTRATO-CRM.md, §4).
 * `null` = nunca se guardó: el servidor usa entonces sus propios valores por
 * defecto, igual que la pantalla.
 */
export async function leerAjuste<T = Record<string, unknown>>(clave: string): Promise<T | null> {
  const f = await prisma.crmAjuste.findUnique({ where: llaveAjuste(clave) })
  return (f?.valor as T) ?? null
}

export async function guardarAjuste(clave: string, valor: unknown, por: string | null) {
  return prisma.crmAjuste.upsert({
    where: llaveAjuste(clave),
    create: { clave, valor: valor as Prisma.InputJsonValue, actualizadoPorId: por },
    update: { valor: valor as Prisma.InputJsonValue, actualizadoPorId: por },
  })
}

export async function leerPreferencias(userId: string): Promise<Record<string, unknown>> {
  const f = await prisma.crmPreferencia.findUnique({ where: llavePreferencia(userId) })
  return (f?.valor as Record<string, unknown>) ?? {}
}
