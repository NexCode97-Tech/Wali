import { Router, Request, Response, NextFunction } from 'express'
import { prisma } from '../config/prisma'
import { addClient, removeClient, alCambiarPresenciaCrm, conexionesAbiertas, cerrarConexiones } from '../utils/sseManager'
import { authenticate } from '../middleware/auth'
import { asyncHandler } from '../middleware/errorHandler'
import { ApiResponse } from '../utils/response'
import { emitirTicket, consumirTicket } from '../utils/ticketsSSE'
import { emitirCrm } from '../services/crm/tiempoReal'
import { enEspacio, espacioDeUsuario } from '../services/crm/espacio'
import { logger } from '../utils/logger'

const router = Router()

/**
 * Pedir un ticket no cambia nada: el visitante de solo lectura también abre el
 * tiempo real. `authenticate` corta cualquier POST del visitante, así que para
 * esta ruta la petición se le presenta como una lectura (el resto de las
 * revisiones, cuenta suspendida o sesión cerrada, se aplican igual).
 */
function autenticarSinEscritura(req: Request, res: Response, next: NextFunction) {
  const metodo = req.method
  req.method = 'GET'
  void authenticate(req, res, (err?: unknown) => {
    req.method = metodo
    next(err)
  })
}

/** ¿Está en algún equipo del CRM (crm_miembros)? Quien no es de Ventas entra al CRM solo así. */
async function esMiembroCrm(userId: string): Promise<boolean> {
  return (await prisma.crmMiembro.count({ where: { userId } })) > 0
}

/**
 * POST /api/eventos/ticket   cuerpo opcional: { origen: 'crm' }
 *
 * Canjea la sesión (que viaja en la cabecera Authorization, donde nadie la
 * registra) por un ticket de un solo uso y 30 segundos de vida. Ese ticket es lo
 * único que después va en la URL del SSE. Con `origen: 'crm'` la conexión cuenta
 * como «tiene el CRM abierto» (GET /crm/inicio `conectado`, reparto y el evento
 * `pref` con `conectado`); el visitante de solo lectura no cuenta. Desde el 29-sep
 * también cuenta quien entra al CRM por un equipo (crm_miembros: auditores,
 * colaboradores): sin eso el reparto por turnos de Moderación no les llegaba.
 */
router.post('/ticket', autenticarSinEscritura, asyncHandler(async (req: Request, res: Response) => {
  const cuerpo = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {}
  const crm = cuerpo.origen === 'crm' && !req.soloLectura && await esMiembroCrm(req.userId!)
  const { ticket, vidaMs } = emitirTicket({
    userId: req.userId!,
    role: req.userRole!,
    nombre: req.userName,
    sid: null,
    crm,
  })
  return ApiResponse.success(res, { ticket, vidaMs })
}))

/**
 * GET /api/eventos?ticket=xxx
 *
 * `EventSource` no admite cabeceras custom, así que la credencial tiene que ir
 * en la URL. Va un ticket de un solo uso en vez del JWT de sesión: si queda
 * registrado en algún intermediario que no controlamos, ya no sirve. (La rama
 * de transición con `?token=` se quitó el 26-sep: aceptaba un JWT sin mirar si
 * la cuenta seguía activa, y el bundle con tickets está desde el 05-ago.)
 */
router.get('/', async (req: Request, res: Response) => {
  const datos = consumirTicket(req.query.ticket as string | undefined)
  if (!datos) {
    // Un ticket gastado o vencido no es necesariamente un ataque: es lo que
    // pasa cuando EventSource reintenta solo con la misma URL.
    res.status(401).json({ error: 'Ticket requerido, inválido, vencido o ya usado' })
    return
  }
  const identidad = { userId: datos.userId, role: datos.role, crm: Boolean(datos.crm), sid: datos.sid ?? null }

  // Cabeceras SSE
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // Nginx/Railway: deshabilita buffering
  res.flushHeaders()

  // Desactivar timeout del socket para SSE (conexión larga por diseño)
  req.socket.setTimeout(0)
  req.socket.setNoDelay(true)
  req.socket.setKeepAlive(true, 10_000)

  // Relleno para forzar el vaciado del búfer del edge de Railway: con `X-Accel-Buffering: no` puesto, el proxy (server:
  // railway-hikari) igual retenía la respuesta 45+ s sin soltar ni siquiera
  // este primer evento — probado con curl -sS -N contra producción, mismo
  // código en local sí transmitía al instante. Un comentario SSE (línea que
  // empieza con `:`, que EventSource ignora) de over 2 KB parece bastarle al
  // búfer del edge para soltar la respuesta de una vez.
  res.write(':' + ' '.repeat(2049) + '\n\n')

  // Confirmación de conexión
  res.write('event: conectado\ndata: {}\n\n')

  addClient(res, identidad)
  logger.info({ type: 'sse_conectado', userId: identidad.userId, crm: identidad.crm }, 'cliente SSE conectado')
  revisionPeriodica()

  // Ping cada 20s para mantener la conexión viva en Railway (timeout 300s)
  const ping = setInterval(() => {
    try { res.write(':ping\n\n') } catch { /* cliente desconectado */ }
  }, 20_000)

  const fin = () => {
    clearInterval(ping)
    removeClient(res)
  }
  req.on('close', fin)
  res.on('close', fin)
})

// ─── Presencia en el CRM ─────────────────────────────────────────────────────

// Al abrir la primera pestaña del CRM o cerrar la última, el equipo lo ve en vivo.
alCambiarPresenciaCrm((userId, conectado) => {
  void espacioDeUsuario(userId).then(e => { if (e) enEspacio(e, () => emitirCrm({ tipo: 'pref', userId, conectado }, userId)) })
    .catch(err => logger.warn(`[CRM] presencia de ${userId}: ${(err as Error)?.message ?? err}`))
})

// ─── Revisión de las conexiones abiertas ─────────────────────────────────────
//
// El rol queda fijo al abrir la conexión. Cada 30 s se vuelve a mirar la base:
// si la cuenta ya no existe, está suspendida, es colaboradora (salvo que esté en
// un equipo del CRM), le cambiaron el rol o le cerraron la sesión, la conexión se
// corta. La pestaña pide otro ticket y ahí `authenticate` decide con los datos de hoy.

const REVISION_MS = 30_000
let temporizador: NodeJS.Timeout | null = null
let revisando = false

export async function revisarConexiones(): Promise<number> {
  if (revisando) return 0
  const abiertas = conexionesAbiertas()
  if (!abiertas.length) return 0
  revisando = true
  try {
    const ids = [...new Set(abiertas.map(q => q.userId).filter(Boolean))]
    const usuarios = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, role: true, suspendido: true } })
    // El rol con el que autoriza `authenticate` hoy (solo lectura = ADMIN que no escribe).
    const rolHoy = new Map(usuarios.filter(u => !u.suspendido).map(u => [u.id, u.role === 'LECTOR' ? 'ADMIN' : u.role as string]))
    const n = cerrarConexiones(q => !q.userId || rolHoy.get(q.userId) !== q.role)
    if (n) logger.info({ type: 'sse_cortadas', n }, 'conexiones SSE cortadas: la cuenta, el rol o la sesión cambiaron')
    return n
  } catch (e) {
    // Si la base no responde, no se corta a nadie: se vuelve a intentar en la siguiente vuelta.
    logger.warn(`[SSE] no se pudieron revisar las conexiones: ${(e as Error)?.message ?? e}`)
    return 0
  } finally {
    revisando = false
  }
}

function revisionPeriodica() {
  if (temporizador) return
  temporizador = setInterval(() => { void revisarConexiones() }, REVISION_MS)
  temporizador.unref?.()
}

export default router
