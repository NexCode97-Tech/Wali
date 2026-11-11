import { prisma as base } from '../../config/prisma'
import { espacioActual } from './espacio'

/**
 * La base del CRM, acotada al espacio de trabajo en que se corre (espacio.ts).
 * Toda consulta a una tabla del CRM lleva el espacio en su filtro, y todo lo que
 * se crea queda en él: ningún archivo del CRM tiene que acordarse. Sin espacio
 * fijado, la consulta falla antes de llegar a la base.
 *
 * Fuera de este filtro quedan: las consultas SQL a mano ($queryRaw y
 * $executeRaw), que llevan su propio `espacio_id` cuando recorren tablas
 * enteras; `crm_webhook_eventos`, que se guarda antes de saber de qué espacio es
 * el aviso; y `crm_espacios` y `crm_miembros`, que son justo los que dicen quién
 * entra a dónde. Las otras tablas de la plataforma (clientes, usuarios…) no
 * se tocan.
 */
const CON_FILTRO = new Set([
  'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany',
  'count', 'aggregate', 'groupBy', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert',
])

type Operacion = { operation: string; args: unknown; query: (args: unknown) => Promise<unknown> }
type Obj = Record<string, unknown>

function acotar({ operation, args, query }: Operacion) {
  const espacioId = espacioActual()
  const a = { ...((args ?? {}) as Obj) }
  if (CON_FILTRO.has(operation)) a.where = { ...((a.where ?? {}) as Obj), espacioId }
  if (operation === 'create') a.data = { ...((a.data ?? {}) as Obj), espacioId }
  if (operation === 'createMany' || operation === 'createManyAndReturn') {
    a.data = (Array.isArray(a.data) ? a.data : [a.data]).map(d => ({ ...(d as Obj), espacioId }))
  }
  if (operation === 'upsert') a.create = { ...((a.create ?? {}) as Obj), espacioId }
  return query(a)
}

const acotado = { $allOperations: acotar } as never

/**
 * Lo que se hace después de crear un contacto en cualquier parte del CRM (webhooks de la API, 11-nov). Se registra
 * desde afuera (webhooks.ts) para no importar ese archivo aquí, que todos importan.
 */
export const alCrearContacto: ((k: Obj) => void)[] = []
const contactos = {
  $allOperations: async (op: Operacion) => {
    const r = await acotar(op)
    if (op.operation === 'create' && r && typeof r === 'object') for (const f of alCrearContacto) { try { f(r as Obj) } catch { /* un aviso nunca tumba la creación */ } }
    return r
  },
} as never

export const prisma = base.$extends({
  name: 'crm-espacio',
  query: {
    crmContacto: contactos,
    crmLinea: acotado,
    crmConversacion: acotado,
    crmMensaje: acotado,
    crmAjuste: acotado,
    crmPreferencia: acotado,
    crmConexion: acotado,
    crmEnlace: acotado,
    crmClic: acotado,
    crmApiClave: acotado,
  },
})

/** La base sin filtro, para lo que va por encima de los espacios (avisos de los canales antes de saber de quién son). */
export { base as prismaGlobal }

/** La llave única de un ajuste del espacio (crm_ajustes es por espacio y clave). */
export const llaveAjuste = (clave: string) => ({ espacioId_clave: { espacioId: espacioActual(), clave } })

/** La llave única de las preferencias de una persona en el espacio. */
export const llavePreferencia = (userId: string) => ({ espacioId_userId: { espacioId: espacioActual(), userId } })

/** El cliente que reciben las transacciones de la base acotada. */
export type TxCrm = Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>
