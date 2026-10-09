import { avisar, type TipoNotificacion } from '../notificaciones'
import { espacioActual } from './espacio'
import { usuariosCrm } from './usuarios'

/**
 * Avisos del CRM a la campana de la plataforma. Lo que ya avisaba por su cuenta (menciones, asignaciones, recordatorios, reglas y el resumen
 * del día) sigue igual; esto es para lo del sistema que no le avisaba a nadie: difusiones que terminan o fallan,
 * plantillas que Meta aprueba o rechaza, canales que se caen y mensajes programados que no salen.
 *
 * Los mensajes nuevos de los clientes no van a la campana a propósito: serían cientos al día. Esos suenan y
 * salen como notificación del navegador desde el CRM (Mis ajustes).
 */

interface AvisoCrm { tipo: TipoNotificacion; titulo: string; texto: string; url: string }

/** A los líderes de Ventas y administradores del CRM. */
export async function avisarLideres(a: AvisoCrm): Promise<void> {
  const lideres = (await usuariosCrm()).filter(u => u.rol === 'ADMIN' || u.rol === 'LIDER')
  for (const u of lideres) await avisar({ userId: u.id, ...a })
}

const recientes = new Map<string, number>()
/**
 * true la primera vez que llega esta clave en `ms` (por empresa). Meta reintenta sus avisos y un canal
 * caído se revisa cada minuto: el mismo aviso no se repite en la campana.
 */
export function primeraVez(clave: string, ms: number): boolean {
  const k = `${espacioActual()}|${clave}`
  const ahora = Date.now()
  if (ahora - (recientes.get(k) ?? 0) < ms) return false
  recientes.set(k, ahora)
  if (recientes.size > 2000) for (const [x, en] of recientes) if (ahora - en > ms) recientes.delete(x)
  return true
}
