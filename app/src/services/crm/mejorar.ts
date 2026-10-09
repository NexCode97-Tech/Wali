import { prisma } from './bd'
import { espacioActual } from './espacio'
import { leerAjuste } from './ajustes'
import type { Prisma } from '@prisma/client'

/**
 * «Mejorar» del agente IA (28-sep-2026, como el de Trengo): las preguntas que el agente no encontró en su
 * base de conocimiento y por las que pasó la conversación. El líder las ve en la pestaña Mejorar, escribe la
 * respuesta (queda como fragmento en la base del agente y la usa desde el siguiente mensaje) o las descarta.
 *
 * Van en el ajuste interno `_sinRespuesta` del espacio: la pantalla no lo guarda (no está en su lista de
 * ajustes), así que no hay choque con lo que escribe el navegador.
 */
const CLAVE = '_sinRespuesta'
const MAX = 300

export interface SinRespuesta {
  id: string
  /** Última vez que la preguntaron (ISO). */
  t: string
  /** Cuántas veces la preguntaron. */
  n: number
  ag: string
  agente: string
  pregunta: string
  /** La última conversación en que salió. */
  conv: number
}

const plano = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9ñ ]+/g, ' ').replace(/\s+/g, ' ').trim()
const llave = (espacio: string) => ({ espacioId_clave: { espacioId: espacio, clave: CLAVE } })

async function leer(): Promise<SinRespuesta[]> {
  const v = await leerAjuste<unknown>(CLAVE)
  return Array.isArray(v) ? (v as SinRespuesta[]).filter(x => x && typeof x.id === 'string') : []
}

/** Anota una pregunta sin respuesta. La misma pregunta del mismo agente suma una vez más en vez de repetirse. */
export async function anotarSinRespuesta(p: { ag: string; agente: string; pregunta: string; conv: number }): Promise<void> {
  const pregunta = p.pregunta.replace(/\s+/g, ' ').trim().slice(0, 300)
  if (!pregunta) return
  const espacio = espacioActual()
  await prisma.$transaction(async tx => {
    // Dos turnos a la vez no se pisan la lista: la fila queda bloqueada mientras se lee y se escribe.
    await tx.$queryRaw`SELECT 1 FROM crm_ajustes WHERE espacio_id = ${espacio} AND clave = ${CLAVE} FOR UPDATE`
    const fila = await tx.crmAjuste.findUnique({ where: llave(espacio) })
    const lista = Array.isArray(fila?.valor) ? (fila!.valor as unknown as SinRespuesta[]) : []
    const igual = lista.find(x => x.ag === p.ag && plano(x.pregunta) === plano(pregunta))
    const ahora = new Date().toISOString()
    if (igual) Object.assign(igual, { t: ahora, n: (igual.n || 1) + 1, conv: p.conv })
    else lista.push({ id: 'sr' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), t: ahora, n: 1, ag: p.ag, agente: p.agente, pregunta, conv: p.conv })
    const valor = lista.slice(-MAX) as unknown as Prisma.InputJsonValue
    await tx.crmAjuste.upsert({
      where: llave(espacio),
      create: { espacioId: espacio, clave: CLAVE, valor, actualizadoPorId: null },
      update: { valor },
    })
  })
}

/** Las de un agente (o todas), la más reciente primero. */
export async function listarSinRespuesta(ag?: string): Promise<SinRespuesta[]> {
  return (await leer()).filter(x => !ag || x.ag === ag).sort((a, b) => b.t.localeCompare(a.t))
}

/** Quita una (ya se respondió en la base o se descartó). false si no estaba. */
export async function quitarSinRespuesta(id: string): Promise<boolean> {
  const espacio = espacioActual()
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT 1 FROM crm_ajustes WHERE espacio_id = ${espacio} AND clave = ${CLAVE} FOR UPDATE`
    const fila = await tx.crmAjuste.findUnique({ where: llave(espacio) })
    const lista = Array.isArray(fila?.valor) ? (fila!.valor as unknown as SinRespuesta[]) : []
    const resto = lista.filter(x => x.id !== id)
    if (resto.length === lista.length) return false
    await tx.crmAjuste.update({ where: llave(espacio), data: { valor: resto as unknown as Prisma.InputJsonValue } })
    return true
  })
}
