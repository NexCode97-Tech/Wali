import type { Role } from '@prisma/client'

/**
 * Los roles de una cuenta, en un solo sitio.
 *
 * - ADMIN: administra el espacio. Sin equipo ve todo; cambia la configuración general.
 * - LIDER: cambia la configuración general, pero ve solo lo de sus equipos.
 * - AGENTE: atiende. Ve lo que tiene asignado y lo de los equipos que lidera.
 * - LECTOR: solo lectura. Ve todo como un administrador y no puede cambiar nada.
 *
 * Lo que cada quien ve dentro del espacio lo deciden además sus equipos (services/crm/alcance.ts).
 */
export const TODOS: Role[] = ['ADMIN', 'LIDER', 'AGENTE', 'LECTOR']

/** Cambian la configuración general del espacio. */
export const CONFIGURAN: Role[] = ['ADMIN', 'LIDER']

export const esAdmin = (r?: string | null): boolean => r === 'ADMIN'
export const configura = (r?: string | null): boolean => CONFIGURAN.includes(r as Role)
