import type { Prisma } from '@prisma/client'
import { flujosVencidos, retenidaPorFlujo } from './flujos'
import { agentesVencidos } from './agenteIA'
import { dispararReglas, revisarSinRespuesta } from './reglas'
import { prisma } from './bd'
import { logger } from '../../utils/logger'
import { avisar } from '../notificaciones'
import { leerAjuste, leerPreferencias } from './ajustes'
import { idDeNombre, usuariosCrm } from './usuarios'
import { emitirConv, emitirMsg } from './tiempoReal'
import { marcarEnviosColgados, soltarProgramado } from './salientes'
import { barrerEncuestasColgadas } from './encuesta'
import { configReparto, repartir, repartirA } from './reparto'
import { partesBogota, procesarDifusiones } from './difusiones'
import { reintentarWebhooks } from './entrantes'
import { enEspacio, espacios, espacioActual } from './espacio'

/**
 * Lo que el CRM hace solo, sin que nadie toque la pantalla:
 * - cada minuto: mensajes programados vencidos, recordatorios vencidos,
 *   conversaciones sin asignar que esperan reparto y las que el asesor no
 *   respondió a tiempo (pasan al siguiente, `CFG.reparto.minutos`);
 * - cada 10 minutos: cierre automático por inactividad (`CVCFG`).
 * - cada minuto, aparte (con su propia bandera): el motor de difusiones
 *   (difusiones.ts), para que un envío largo no atrase lo demás.
 * Cada paso va con su propio try/catch: si uno falla, los demás siguen.
 */

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})

let corriendoMinuto = false
let corriendoDiez = false

/**
 * Mensajes programados cuya hora ya llegó: salen como mensaje normal. Los de la misma hora
 * salen en el orden en que se programaron (cada uno con sus archivos detrás, soltarProgramado).
 */
export async function procesarProgramados(): Promise<number> {
  const vencidos = await prisma.crmMensaje.findMany({
    where: { tipo: 'prog', programadoPara: { lte: new Date() } },
    select: { id: true }, orderBy: [{ programadoPara: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }], take: 50,
  })
  for (const m of vencidos) {
    try { await soltarProgramado(m.id) } catch (e) { logger.error(`[CRM procesos] programado ${m.id}: ${(e as Error)?.message}`) }
  }
  return vencidos.length
}

/** Fecha de un recordatorio: la pantalla la guarda como `fecha` (chat) o `para` (llamadas). */
export const fechaRec = (r: unknown): Date | null => {
  const x = obj(r)
  const d = new Date(String(x.fecha ?? x.para ?? ''))
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Recordatorios vencidos: aviso al asesor asignado, una sola vez (`avisado: true`).
 * Cada conversación se marca con su fila bloqueada y leída en ese instante, para no
 * pisar un recordatorio que alguien agregue o marque como hecho al mismo tiempo.
 */
export async function procesarRecordatorios(): Promise<number> {
  const convs = await prisma.crmConversacion.findMany({
    where: { NOT: { recs: { equals: [] } }, estado: { not: 'finalizadas' } },
    select: { id: true }, orderBy: { id: 'asc' },
  })
  const ahora = Date.now()
  let avisados = 0
  for (const { id } of convs) {
    const r = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM crm_conversaciones WHERE id = ${id} FOR UPDATE`
      const c = await tx.crmConversacion.findUnique({ where: { id }, select: { recs: true, asignadoId: true, contacto: { select: { nombre: true, telefono: true } } } })
      if (!c || !Array.isArray(c.recs)) return null
      const nuevos: Json[] = []
      const recs = (c.recs as unknown[]).map(r0 => {
        const x = obj(r0)
        const fecha = fechaRec(x)
        if (x.hecho || x.avisado || !fecha || fecha.getTime() > ahora) return x
        const marcado = { ...x, avisado: true }
        nuevos.push(marcado)
        return marcado
      })
      if (!nuevos.length) return null
      await tx.crmConversacion.update({ where: { id }, data: { recs: recs as Prisma.InputJsonValue } })
      return { c, nuevos }
    })
    if (!r) continue
    await emitirConv(id, null)
    // Sin asignado, el aviso va a quien creó el recordatorio (`por`, su nombre).
    for (const rec of r.nuevos) {
      const destino = r.c.asignadoId ?? await idDeNombre(typeof rec.por === 'string' ? rec.por : null)
      if (!destino) continue
      await avisar({
        userId: destino, tipo: 'TAREA_ASIGNADA', titulo: 'Recordatorio del CRM',
        texto: `Seguimiento con ${r.c.contacto.nombre || r.c.contacto.telefono || 'un contacto'}: ${String(rec.t ?? 'recordatorio').slice(0, 160)}`,
        url: `/?conv=${id}`,
      })
      avisados++
    }
  }
  return avisados
}

/** Conversaciones que esperan asesor: se reparten cuando alguien queda disponible. */
export async function procesarSinAsignar(): Promise<number> {
  // La forma de repartir es de cada equipo (reparto.ts, metodoDe): repartir decide si le toca a alguien.
  const desde = new Date(Date.now() - 7 * 86_400_000)
  const convs = await prisma.crmConversacion.findMany({
    where: { asignadoId: null, estado: 'abiertas', soloLider: false, esperaDesde: { not: null }, ultimoMensajeAt: { gte: desde } },
    select: { id: true, extra: true }, orderBy: { esperaDesde: 'asc' }, take: 30,
  })
  // Lo que un flujo dejó «para el líder» no lo toma el reparto automático.
  // Con «Guardar los leads cuando no haya nadie disponible» apagado en su equipo, repartir no las toca (quedan para tomarlas).
  for (const c of convs) if (!retenidaPorFlujo(c.extra)) await repartir(c.id, true)
  return convs.length
}

/**
 * «Si no responde en estos minutos, pasa al siguiente»: solo para las que
 * entregó el reparto automático y siguen esperando respuesta de esa persona.
 */
export async function procesarSinRespuesta(): Promise<number> {
  // Solo toca las que entregó el reparto automático (`_reparto`); en los equipos sin reparto automático no hay.
  const cfg = await configReparto()
  const limite = Date.now() - cfg.minutos * 60_000
  const convs = await prisma.crmConversacion.findMany({
    where: { estado: 'abiertas', asignadoId: { not: null }, esperaDesde: { not: null, lte: new Date(limite) } },
    select: { id: true, asignadoId: true, extra: true, esperaDesde: true },
    // Las que más llevan esperando primero: con un tope sin orden, siempre quedaban por fuera las mismas.
    orderBy: { esperaDesde: 'asc' }, take: 200,
  })
  let pasadas = 0
  for (const c of convs) {
    const rep = obj(obj(c.extra)._reparto)
    if (rep.a !== c.asignadoId || typeof rep.en !== 'string') continue
    const en = new Date(rep.en).getTime()
    if (Number.isNaN(en) || en > limite) continue
    // ¿Respondió algo esa persona después de recibirla?
    const respondio = await prisma.crmMensaje.count({ where: { conversacionId: c.id, tipo: 'out', autorId: c.asignadoId, createdAt: { gte: new Date(en) } } })
    if (respondio) continue
    const probados = Array.isArray(rep.probados) ? rep.probados.map(String) : [c.asignadoId as string]
    const nuevo = await repartirA(c.id, probados)
    if (nuevo) pasadas++
  }
  return pasadas
}

/** Cierre automático por inactividad según `CVCFG` ({auto, n, u, sinAsesor}). */
/**
 * Conversaciones abiertas de alguien que ya no está en Ventas (suspendido o con
 * otro rol): quedan sin asignar, con un evento que lo diga, y se reparten.
 * Antes se quedaban con esa persona para siempre.
 */
export async function procesarAsesoresFuera(): Promise<number> {
  const activos = new Set((await usuariosCrm(true)).map(u => u.id))
  const convs = await prisma.crmConversacion.findMany({
    where: { estado: { in: ['abiertas', 'pendientes'] }, asignadoId: { not: null } },
    select: { id: true, asignadoId: true },
  })
  const fuera = convs.filter(c => !activos.has(c.asignadoId!))
  for (const c of fuera) {
    const antes = await prisma.user.findUnique({ where: { id: c.asignadoId! }, select: { nombre: true, email: true } })
    await prisma.crmConversacion.update({ where: { id: c.id }, data: { asignadoId: null } })
    const m = await prisma.crmMensaje.create({ data: { conversacionId: c.id, tipo: 'ev', datos: { ev: 'swap', t: `Quedó sin asignar: ${antes?.nombre || antes?.email || 'la persona asignada'} ya no está en el equipo de Ventas` } } })
    emitirMsg(c.id, m)
    await repartir(c.id)
    await emitirConv(c.id)
  }
  return fuera.length
}

export async function procesarCierreAutomatico(): Promise<number> {
  const cv = { auto: true, n: '3', u: 'días', sinAsesor: false, ...obj(await leerAjuste('cvcfg')) }
  if (cv.auto === false) return 0
  const n = Number(String(cv.n ?? '').replace(/\D/g, ''))
  if (!Number.isFinite(n) || n <= 0) return 0
  const horas = /hora/i.test(String(cv.u)) ? n : n * 24
  const limite = new Date(Date.now() - horas * 3_600_000)
  const convs = await prisma.crmConversacion.findMany({
    where: {
      estado: { in: ['abiertas', 'pendientes'] },
      OR: [{ ultimoMensajeAt: { lt: limite } }, { ultimoMensajeAt: null, createdAt: { lt: limite } }],
      ...(cv.sinAsesor === true ? {} : { asignadoId: { not: null } }),
    },
    select: { id: true, recs: true, extra: true }, orderBy: { ultimoMensajeAt: 'asc' }, take: 500,
  })
  const cuanto = `${n} ${/hora/i.test(String(cv.u)) ? (n === 1 ? 'hora' : 'horas') : (n === 1 ? 'día' : 'días')}`
  let cerradas = 0
  for (const c of convs) {
    // Con un recordatorio sin hacer, alguien piensa volver: no se cierra (y el recordatorio avisa).
    if (Array.isArray(c.recs) && (c.recs as unknown[]).some(r => !obj(r).hecho)) continue
    // Un flujo o un agente que la está atendiendo tienen su propio vencimiento.
    const ex = obj(c.extra)
    if (ex._flujo || ex._agente) continue
    try {
      // La condición de inactividad se vuelve a mirar al cerrar: si entró un mensaje en el camino, no se cierra.
      const r = await prisma.crmConversacion.updateMany({
        where: { id: c.id, estado: { in: ['abiertas', 'pendientes'] }, OR: [{ ultimoMensajeAt: { lt: limite } }, { ultimoMensajeAt: null, createdAt: { lt: limite } }] },
        data: { estado: 'finalizadas', finalizadaAt: new Date(), motivoFin: 'Finalizada por inactividad', esperaDesde: null },
      })
      if (!r.count) continue
      cerradas++
      const m = await prisma.crmMensaje.create({ data: { conversacionId: c.id, tipo: 'ev', datos: { ev: 'check', t: `Finalizada por inactividad: ${cuanto} sin mensajes` } } })
      emitirMsg(c.id, m, null)
      await emitirConv(c.id, null)
      await dispararReglas('finalizada', c.id, { motivo: 'Finalizada por inactividad' }).catch(() => {})
    } catch (e) { logger.error(`[CRM procesos] cierre de ${c.id}: ${(e as Error)?.message}`) }
  }
  return cerradas
}

/** Un paso para todo el CRM a la vez (los avisos guardados de los canales, que aún no tienen espacio). */
async function paso(nombre: string, fn: () => Promise<number>) {
  try {
    const n = await fn()
    if (n) logger.info(`[CRM procesos] ${nombre}: ${n}`)
  } catch (e) {
    logger.error(`[CRM procesos] ${nombre}: ${(e as Error)?.message ?? e}`)
  }
}

/** Un paso en cada espacio de trabajo, uno tras otro: si falla en uno, los demás siguen. */
async function pasoPorEspacio(nombre: string, fn: () => Promise<number>) {
  let lista: string[]
  try { lista = await espacios() } catch (e) { logger.error(`[CRM procesos] ${nombre}: no se pudieron leer los espacios: ${(e as Error)?.message ?? e}`); return }
  for (const e of lista) await enEspacio(e, () => paso(`${nombre} (${e})`, fn))
}

/**
 * «Resumen diario de pendientes a las 7 a. m.» (Mi cuenta, preferencia `resumen`): un aviso de la
 * plataforma con las conversaciones que esperan respuesta y las cuotas que vencen hoy. Sale una vez
 * al día entre las 7 a. m. y el mediodía: el ajuste `_resumenDiario` guarda la fecha y se reclama con
 * un UPSERT condicional, así dos instancias del servidor no lo mandan dos veces.
 */
export async function procesarResumenDiario(): Promise<number> {
  const t = partesBogota(new Date())
  if (t.h < 7 || t.h >= 12) return 0
  const hoy = `${t.y}-${String(t.m).padStart(2, '0')}-${String(t.d).padStart(2, '0')}`
  const reclamado = await prisma.$executeRaw`
    INSERT INTO crm_ajustes (espacio_id, clave, valor, "updatedAt") VALUES (${espacioActual()}, '_resumenDiario', ${JSON.stringify(hoy)}::jsonb, now())
    ON CONFLICT (espacio_id, clave) DO UPDATE SET valor = EXCLUDED.valor, "updatedAt" = now()
    WHERE crm_ajustes.valor IS DISTINCT FROM EXCLUDED.valor`
  if (!reclamado) return 0
  let n = 0
  for (const u of await usuariosCrm(true)) {
    if ((await leerPreferencias(u.id)).resumen !== true) continue
    const esperan = await prisma.crmConversacion.count({ where: { asignadoId: u.id, estado: { not: 'finalizadas' }, esperaDesde: { not: null } } })
    if (!esperan) continue
    const texto = `${esperan} ${esperan === 1 ? 'conversación espera' : 'conversaciones esperan'} tu respuesta.`
    await avisar({ userId: u.id, autorId: null, tipo: 'CRM_RESUMEN', titulo: 'Tus pendientes de hoy', texto, url: '/' })
    n++
  }
  return n
}

export async function cadaMinuto() {
  if (corriendoMinuto) return
  corriendoMinuto = true
  try {
    await paso('avisos de WhatsApp pendientes', reintentarWebhooks)
    await pasoPorEspacio('programados', procesarProgramados)
    await pasoPorEspacio('envíos colgados', () => marcarEnviosColgados())
    // Encuesta al finalizar (lote 6): la que quedó «enviando» o con los días reservados porque el API se reinició.
    await pasoPorEspacio('encuestas colgadas', () => barrerEncuestasColgadas())
    await pasoPorEspacio('recordatorios', procesarRecordatorios)
    await pasoPorEspacio('sin asignar', procesarSinAsignar)
    await pasoPorEspacio('sin respuesta', procesarSinRespuesta)
    await pasoPorEspacio('flujos vencidos', async () => { await flujosVencidos(); return 0 })
    await pasoPorEspacio('agentes vencidos', async () => { await agentesVencidos(); return 0 })
  } finally { corriendoMinuto = false }
}

export async function cadaDiezMinutos() {
  if (corriendoDiez) return
  corriendoDiez = true
  try {
    await pasoPorEspacio('asesores fuera de Ventas', procesarAsesoresFuera)
    await pasoPorEspacio('cierre automático', procesarCierreAutomatico)
    await pasoPorEspacio('regla de 48 horas sin respuesta', revisarSinRespuesta)
    await pasoPorEspacio('resumen diario de pendientes', procesarResumenDiario)
    // Los tokens de Instagram duran 60 días: los que tienen más de 30 se renuevan (renovarTokensInstagram mira la fecha de cada uno).
    await paso('tokens de Instagram', () => import('./instagram').then(m => m.renovarTokensInstagram()))
  } finally { corriendoDiez = false }
}

// ─── IA del CRM (lote 5) ─────────────────────────────────────────────────────
let corriendoEmbudoIA = false
let corriendoNocheIA = false

/**
 * Embudo automático: cada minuto, aparte de cadaMinuto (así un análisis lento no atrasa el reparto), sin solaparse
 * consigo mismo. embudoPendientes (iaEmbudo.ts) elige en cada espacio las conversaciones que avanzaron.
 */
async function embudoAutomatico() {
  if (corriendoEmbudoIA) return
  corriendoEmbudoIA = true
  try { await pasoPorEspacio('embudo automático', () => import('./iaEmbudo').then(m => m.embudoPendientes())) } finally { corriendoEmbudoIA = false }
}

/**
 * Aprendizaje de Mi IA: cada 10 minutos, en cada espacio, aprenderNoche mira si es de noche en Colombia (2 a 6 a. m.)
 * y si la noche ya se reclamó; con eso corre una sola vez por noche aunque haya dos instancias del servidor.
 */
async function aprendizajeMiIa() {
  if (corriendoNocheIA) return
  corriendoNocheIA = true
  try { await pasoPorEspacio('aprendizaje de Mi IA', () => import('./iaMiIa').then(m => m.aprenderNoche())) } finally { corriendoNocheIA = false }
}

/** Se llama una vez al arrancar el servidor (index.ts, después de SIN_JOBS). */
export function iniciarProcesosCrm() {
  setTimeout(() => { void cadaMinuto() }, 30_000)
  setInterval(() => { void cadaMinuto() }, 60_000)
  setTimeout(() => { void cadaDiezMinutos() }, 90_000)
  setInterval(() => { void cadaDiezMinutos() }, 10 * 60_000)
  // Difusiones: procesarDifusiones no se solapa consigo misma (bandera en memoria) y reclama los lotes con candado.
  setTimeout(() => { void pasoPorEspacio('difusiones', () => procesarDifusiones()) }, 45_000)
  setInterval(() => { void pasoPorEspacio('difusiones', () => procesarDifusiones()) }, 60_000)
  // Correo: cada buzón conectado se revisa cada minuto (cada uno en su espacio; correo.ts no se solapa consigo mismo).
  setTimeout(() => { void paso('correos', () => import('./correo').then(m => m.leerCorreos())) }, 50_000)
  setInterval(() => { void paso('correos', () => import('./correo').then(m => m.leerCorreos())) }, 60_000)
  // IA del CRM (lote 5): embudo automático cada minuto (el primero a los 75 s) y aprendizaje de Mi IA de cada noche.
  setTimeout(() => { void embudoAutomatico() }, 75_000)
  setInterval(() => { void embudoAutomatico() }, 60_000)
  setTimeout(() => { void aprendizajeMiIa() }, 120_000)
  setInterval(() => { void aprendizajeMiIa() }, 10 * 60_000)
  logger.info('[CRM procesos] programados, recordatorios, reparto, cierre automático y difusiones en marcha')
}
