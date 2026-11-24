import crypto from 'node:crypto'

/**
 * Registro interno de errores (24-nov): TODO lo que falla en la plataforma queda en la tabla `registro_errores`, para
 * leerlo desde las herramientas internas (no hay pantalla). Antes solo `logger.error` llegaba a Sentry y los avisos
 * (`logger.warn`: Meta que rechaza un token, un mensaje que no salió, un webhook que no se procesó) quedaban sueltos en
 * Railway: así pasó lo de Instagram de Nacarbe sin que nadie lo viera.
 *
 * - Entra: todo `logger.warn`, `logger.error` y `logger.fatal` (utils/logger.ts), los errores de las pantallas que
 *   llegan por el vigilante (routes/vigia.ts) y las promesas o excepciones que nadie atrapó.
 * - Se agrupa por huella (área + nivel + el texto sin números, ids ni datos): el mismo error repetido es una sola fila
 *   con cuántas veces pasó, la primera y la última vez, y las empresas donde pasó.
 * - Se tachan tokens, códigos, correos y teléfonos antes de guardar. Nada de cuerpos de mensajes ni datos de clientes.
 * - Se escribe en tandas cada 15 s (nunca una consulta por cada error) y se borra lo que no se repite en 90 días.
 * - Un error marcado como resuelto que vuelve a pasar queda «reabierto».
 * - Nunca rompe nada: si la base de datos falla, se dice por la consola y se sigue.
 */

type Nivel = 'aviso' | 'error' | 'fatal'
interface Pendiente { nivel: Nivel; area: string; mensaje: string; ejemplo: Record<string, unknown>; espacios: Set<string>; veces: number; primera: Date; ultima: Date }

const pendientes = new Map<string, Pendiente>()
const TOPE = 800
let reloj: NodeJS.Timeout | null = null
let ultimoBorrado = 0
let escribiendo = false

/** Quita lo que no debe guardarse: credenciales, códigos de OAuth, correos, teléfonos y números de documento. */
export function tachar(t: string): string {
  return String(t)
    .replace(/(access_token|code|state|token|client_secret|secret|password|clave|hub\.verify_token|sig|signature)=([^&\s"']+)/gi, '$1=…')
    .replace(/Bearer\s+[A-Za-z0-9._\-~+/=]+/g, 'Bearer …')
    .replace(/\b(EAA|IGQ|IGA)[A-Za-z0-9]{20,}/g, '[token]')
    .replace(/\beyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/g, '[jwt]')
    .replace(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g, '[correo]')
    .replace(/\+?\b(57)?3\d{9}\b/g, '[teléfono]')
    .replace(/\+\d{10,14}\b/g, '[teléfono]')
}

/** El texto sin lo que cambia entre repeticiones del mismo error (números, ids, fechas), para agruparlo. */
function normalizar(t: string): string {
  return t
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '#')
    .replace(/\bc[a-z0-9]{20,30}\b/g, '#')
    .replace(/\b[0-9a-f]{16,}\b/gi, '#')
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/g, '#')
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300)
}

function programar() {
  if (reloj) return
  reloj = setTimeout(() => { reloj = null; void escribir() }, 15_000)
  reloj.unref?.()
}

/** Anota un error o aviso. `espacioId` es la empresa donde pasó, si se sabe. */
export function registrarError(o: { nivel: Nivel; area: string; mensaje: string; detalle?: Record<string, unknown>; espacioId?: string | null }) {
  try {
    const mensaje = tachar(o.mensaje || '(sin texto)').slice(0, 1500)
    const area = String(o.area || 'general').toLowerCase().slice(0, 40)
    const huella = crypto.createHash('sha1').update(`${area}|${o.nivel}|${normalizar(mensaje)}`).digest('hex')
    const ahora = new Date()
    const p = pendientes.get(huella)
    if (p) {
      p.veces++; p.ultima = ahora
      if (o.espacioId) p.espacios.add(o.espacioId)
    } else {
      if (pendientes.size >= TOPE) return
      const detalle = o.detalle ? JSON.parse(tachar(JSON.stringify(o.detalle)).slice(0, 4000) || '{}') : {}
      pendientes.set(huella, { nivel: o.nivel, area, mensaje, ejemplo: { ...detalle, cuando: ahora.toISOString() }, espacios: new Set(o.espacioId ? [o.espacioId] : []), veces: 1, primera: ahora, ultima: ahora })
    }
    programar()
  } catch { /* el registro nunca rompe nada */ }
}

async function escribir() {
  if (escribiendo || !pendientes.size) return
  escribiendo = true
  const lote = [...pendientes.entries()]
  pendientes.clear()
  try {
    // Se carga aquí y no arriba: bd.ts usa el logger, y el logger usa este archivo.
    const { prismaGlobal } = await import('../services/crm/bd')
    for (const [huella, p] of lote) {
      await prismaGlobal.$executeRaw`
        INSERT INTO "registro_errores" ("huella", "nivel", "area", "mensaje", "ejemplo", "espacios", "veces", "primera", "ultima", "estado")
        VALUES (${huella}, ${p.nivel}, ${p.area}, ${p.mensaje}, ${JSON.stringify(p.ejemplo)}::jsonb, ${[...p.espacios]}::text[], ${p.veces}, ${p.primera}, ${p.ultima}, 'nuevo')
        ON CONFLICT ("huella") DO UPDATE SET
          "veces" = "registro_errores"."veces" + EXCLUDED."veces",
          "ultima" = EXCLUDED."ultima",
          "mensaje" = EXCLUDED."mensaje",
          "ejemplo" = EXCLUDED."ejemplo",
          "espacios" = ARRAY(SELECT DISTINCT unnest("registro_errores"."espacios" || EXCLUDED."espacios")),
          "estado" = CASE WHEN "registro_errores"."estado" = 'resuelto' THEN 'reabierto' ELSE "registro_errores"."estado" END`
    }
    if (Date.now() - ultimoBorrado > 6 * 3_600_000) {
      ultimoBorrado = Date.now()
      await prismaGlobal.$executeRaw`DELETE FROM "registro_errores" WHERE "ultima" < NOW() - INTERVAL '90 days'`
    }
  } catch (e) {
    // Por la consola y no por el logger: si no, un fallo de la base de datos se registraría a sí mismo sin fin.
    console.error(`[registro de errores] no se pudo guardar el lote de ${lote.length}: ${(e as Error)?.message ?? e}`)
  } finally {
    escribiendo = false
    if (pendientes.size) programar()
  }
}

/** Al apagar el servidor (cada despliegue), lo pendiente se escribe antes de salir. */
export async function vaciarRegistro() { if (reloj) { clearTimeout(reloj); reloj = null } await escribir() }

/** Lo que nadie atrapó también queda (antes solo llegaba a Sentry, si llegaba). */
export function vigilarProceso() {
  process.on('unhandledRejection', r => registrarError({ nivel: 'error', area: 'proceso', mensaje: `Promesa sin atrapar: ${(r as Error)?.message ?? String(r)}`, detalle: { pila: String((r as Error)?.stack ?? '').split('\n').slice(0, 8).join('\n') } }))
  process.on('uncaughtExceptionMonitor', e => registrarError({ nivel: 'fatal', area: 'proceso', mensaje: `Excepción sin atrapar: ${e.message}`, detalle: { pila: String(e.stack ?? '').split('\n').slice(0, 8).join('\n') } }))
  for (const s of ['SIGTERM', 'SIGINT'] as const) process.once(s, () => { void vaciarRegistro() })
}
