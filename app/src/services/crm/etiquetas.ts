import { Prisma } from '@prisma/client'
import { prisma } from './bd'
import { espacioActual } from './espacio'
import { emitirCrm } from './tiempoReal'
import { logger } from '../../utils/logger'

/**
 * Lista de etiquetas del espacio (ajuste `etiquetas`: [nombre, color, equipo?]). La barra lateral, los filtros y
 * Ajustes › Etiquetas salen de esa lista. Antes del 26-nov, una etiqueta que no creaba una persona en pantalla (la
 * respuesta a un botón de un flujo, una regla, ManyChat, la API o un archivo importado) quedaba en el contacto pero
 * no en la lista: el lead estaba etiquetado y en la barra no había por dónde encontrarlo (CRECER, flujo RETO MAX).
 * Ahora cada etiqueta nueva se agrega a la lista en el momento, con el mismo orden de colores de la pantalla.
 */
const CLAVE = 'etiquetas'
const PALETA = ['#0891b2', '#db2777', '#ca8a04', '#059669', '#7c3aed', '#dc2626', '#2563eb', '#ea580c', '#475569']
const plano = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

/** Agrega a la lista las que falten (sin distinguir mayúsculas ni tildes). `equipo` null = para todos los equipos. */
export async function registrarEtiquetas(nombres: readonly string[], equipo: string | null = null): Promise<void> {
  const limpias = [...new Set(nombres.map(n => String(n ?? '').trim()).filter(n => n && n.length <= 60))]
  if (!limpias.length) return
  const espacio = espacioActual()
  const r = await prisma.$transaction(async tx => {
    // Dos flujos a la vez no se pisan la lista: la fila queda bloqueada mientras se lee y se escribe.
    await tx.$queryRaw`SELECT 1 FROM crm_ajustes WHERE espacio_id = ${espacio} AND clave = ${CLAVE} FOR UPDATE`
    const fila = await tx.crmAjuste.findUnique({ where: { espacioId_clave: { espacioId: espacio, clave: CLAVE } } })
    const lista = Array.isArray(fila?.valor) ? [...(fila!.valor as unknown[])] : []
    const conocidas = new Set(lista.map(e => plano(String(Array.isArray(e) ? e[0] : ''))))
    const nuevas = limpias.filter(n => !conocidas.has(plano(n)))
    if (!nuevas.length) return null
    for (const n of nuevas) lista.push(equipo ? [n, PALETA[lista.length % PALETA.length], equipo] : [n, PALETA[lista.length % PALETA.length]])
    const valor = lista as Prisma.InputJsonValue
    const f = await tx.crmAjuste.upsert({
      where: { espacioId_clave: { espacioId: espacio, clave: CLAVE } },
      create: { espacioId: espacio, clave: CLAVE, valor, actualizadoPorId: null },
      update: { valor },
      select: { updatedAt: true },
    })
    return { valor: lista, updatedAt: f.updatedAt.toISOString(), nuevas }
  })
  if (!r) return
  // Las pantallas abiertas la ven de una vez en la barra (80-datos.js, ajusteDeAfuera).
  emitirCrm({ tipo: 'ajuste', clave: CLAVE, valor: r.valor, updatedAt: r.updatedAt }, null)
  logger.info(`[CRM etiquetas] ${espacio}: agregadas a la lista ${r.nuevas.map(n => `«${n}»`).join(', ')}`)
}

/** Igual que registrarEtiquetas, sin frenar ni tumbar a quien la llama si falla. */
export function registrarEtiquetasLuego(nombres: readonly string[], equipo: string | null = null): Promise<void> {
  return registrarEtiquetas(nombres, equipo).catch(e => logger.warn(`[CRM etiquetas] no se pudo agregar a la lista: ${(e as Error)?.message ?? e}`))
}

/**
 * Las etiquetas que ya están en contactos y no en la lista (las que quedaron sueltas antes del 26-nov) entran a la
 * lista. Se corre al arrancar el servidor, en cada espacio; si no falta ninguna, no escribe nada.
 */
export async function completarEtiquetasSueltas(): Promise<void> {
  const espacio = espacioActual()
  const filas = await prisma.$queryRaw<{ t: string }[]>`SELECT DISTINCT unnest(tags) AS t FROM crm_contactos WHERE espacio_id = ${espacio}`
  if (filas.length) await registrarEtiquetas(filas.map(f => f.t))
}
