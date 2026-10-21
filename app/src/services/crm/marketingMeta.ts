import type { Prisma } from '@prisma/client'
import { prisma, prismaGlobal } from './bd'
import { enEspacio } from './espacio'
import { credDeConexion } from './credenciales'
import { ErrorMeta, graph } from './whatsapp'
import { emitirCrm } from './tiempoReal'
import { lineaAFront } from './formas'
import { logger } from '../../utils/logger'

/**
 * Marketing optimizado de Meta (API de Mensajes de marketing, maqueta aprobada 21-oct). Las plantillas de marketing
 * salen siempre por `/marketing_messages` (whatsapp.ts); Meta solo las optimiza si el portafolio de la empresa aceptó
 * los términos. Aquí se averigua y se guarda ese estado en cada línea (`ajustes.mm`, con la hora en `ajustes.mmEn`):
 * - al conectar una línea, una vez al día (caidas.ts) y con «Revisar» en Líneas de WhatsApp;
 * - y al instante con el aviso `account_update` MM_LITE_TERMS_SIGNED de Meta (entrantes.ts).
 */

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})

export type EstadoMarketing = 'activo' | 'pendiente' | 'no_elegible'
/** Llaves de `ajustes` que solo escribe el servidor (PATCH /lineas/:id las ignora). */
export const LLAVES_MARKETING = ['mm', 'mmEn'] as const

/** Lo que Meta dice de una cuenta: `marketing_messages_onboarding_status` y el estado de términos de su portafolio. */
function estadoDe(d: Json): EstadoMarketing | null {
  const cuenta = String(d.marketing_messages_onboarding_status ?? '').toUpperCase()
  const portafolio = String(obj(obj(d.owner_business_info).marketing_messages_onboarding_status).status ?? '').toUpperCase()
  if (cuenta === 'ONBOARDED' || portafolio === 'TERM_OF_SERVICE_SIGNED') return 'activo'
  if (/INELIGIBLE|NOT_ELIGIBLE/.test(cuenta)) return 'no_elegible'
  if (cuenta || portafolio) return 'pendiente'
  return null
}

async function preguntarAMeta(wabaId: string, token: string): Promise<EstadoMarketing | null> {
  const cred = { token }
  try {
    return estadoDe(await graph<Json>(`/${wabaId}`, { cred, query: { fields: 'marketing_messages_onboarding_status,owner_business_info' } }))
  } catch (e) {
    // Una versión de la API sin el campo de la cuenta: se pregunta solo por el portafolio.
    if (!(e instanceof ErrorMeta && e.codigo === 100)) throw e
    return estadoDe(await graph<Json>(`/${wabaId}`, { cred, query: { fields: 'owner_business_info' } }))
  }
}

/** Guarda el estado en las líneas de esa cuenta del espacio actual y las manda a las pantallas. */
async function guardarEnEspacio(wabaId: string, estado: EstadoMarketing): Promise<void> {
  for (const l of await prisma.crmLinea.findMany({ where: { wabaId } })) {
    const ajustes = { ...obj(l.ajustes), mm: estado, mmEn: Date.now() }
    const nueva = await prisma.crmLinea.update({ where: { id: l.id }, data: { ajustes: ajustes as Prisma.InputJsonValue } })
    if (obj(l.ajustes).mm !== estado) logger.info(`[CRM WA] marketing optimizado de ${l.telefono}: ${estado}`)
    emitirCrm({ tipo: 'linea', linea: lineaAFront(nueva) })
  }
}

/** Revisa en Meta las cuentas de las líneas de una conexión (en el espacio actual). Nunca lanza. */
export async function revisarMarketingDeConexion(conexionId: string): Promise<void> {
  try {
    const lineas = await prisma.crmLinea.findMany({ where: { conexionId }, select: { wabaId: true } })
    if (!lineas.length) return
    const { token } = await credDeConexion(conexionId)
    for (const waba of new Set(lineas.map(l => l.wabaId))) {
      const estado = await preguntarAMeta(waba, token).catch(e => { logger.warn(`[CRM WA] marketing optimizado de la cuenta ${waba}: ${(e as Error)?.message ?? e}`); return null })
      if (estado) await guardarEnEspacio(waba, estado)
    }
  } catch (e) {
    logger.warn(`[CRM WA] marketing optimizado de la conexión ${conexionId}: ${(e as Error)?.message ?? e}`)
  }
}

/** Revisa todas las conexiones de WhatsApp del espacio actual. */
export async function revisarMarketingDelEspacio(): Promise<void> {
  const cs = await prisma.crmConexion.findMany({ where: { tipo: 'whatsapp', estado: { in: ['conectada', 'error'] } }, select: { id: true } })
  for (const c of cs) await revisarMarketingDeConexion(c.id)
}

/** Aviso de Meta: el portafolio de esa cuenta aceptó los términos. Vale para las líneas de esa cuenta en cualquier espacio. */
export async function marketingAceptado(wabaId: string): Promise<void> {
  const espacios = await prismaGlobal.crmLinea.findMany({ where: { wabaId }, select: { espacioId: true }, distinct: ['espacioId'] })
  for (const { espacioId } of espacios) await enEspacio(espacioId, () => guardarEnEspacio(wabaId, 'activo'))
}

/** El estado de cada empresa con WhatsApp conectado. Para el panel de superadministrador (fuera del CRM), cuando exista. */
export async function marketingPorEmpresa(): Promise<{ espacioId: string; empresa: string; estado: EstadoMarketing | 'revisando'; wabaId: string }[]> {
  const lineas = await prismaGlobal.crmLinea.findMany({ where: { conexionId: { not: null } }, select: { espacioId: true, wabaId: true, ajustes: true } })
  const nombres = new Map((await prismaGlobal.crmEspacio.findMany({ where: { id: { in: [...new Set(lineas.map(l => l.espacioId))] } }, select: { id: true, nombre: true } })).map(e => [e.id, e.nombre]))
  const peor = { pendiente: 3, revisando: 2, no_elegible: 1, activo: 0 } as const
  const porEmpresa = new Map<string, { espacioId: string; empresa: string; estado: EstadoMarketing | 'revisando'; wabaId: string }>()
  for (const l of lineas) {
    const estado = (obj(l.ajustes).mm as EstadoMarketing | undefined) ?? 'revisando'
    const ya = porEmpresa.get(l.espacioId)
    if (!ya || peor[estado] > peor[ya.estado]) porEmpresa.set(l.espacioId, { espacioId: l.espacioId, empresa: nombres.get(l.espacioId) ?? 'Empresa', estado, wabaId: l.wabaId })
  }
  return [...porEmpresa.values()].sort((a, b) => a.empresa.localeCompare(b.empresa, 'es'))
}

/** Revisa todas las empresas, cada una en su espacio. Para el panel de superadministrador, cuando exista. */
export async function revisarMarketingDeTodas(): Promise<void> {
  const espacios = await prismaGlobal.crmLinea.findMany({ where: { conexionId: { not: null } }, select: { espacioId: true }, distinct: ['espacioId'] })
  for (const { espacioId } of espacios) await enEspacio(espacioId, () => revisarMarketingDelEspacio())
}
