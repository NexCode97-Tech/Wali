import type { Prisma } from '@prisma/client'

/**
 * Lo que guarda una empresa nueva desde el primer momento (6-oct): todo vacío, para que no herede los ejemplos de
 * NexCode97 (etapas, etiquetas, reglas, el flujo de bienvenida ni los equipos de ejemplo). Si una clave no existe, la
 * pantalla manda la suya de ejemplo; por eso se crean todas aquí. Equipos: solo «Ventas», vacío (el CRM lo usa por
 * defecto) y sin meter al administrador, que sin equipo ve y administra todo.
 */
export function ajustesIniciales(espacioId: string): Prisma.CrmAjusteCreateManyInput[] {
  const vacias = ['etapas', 'etiquetas', 'reglas', 'flujos'].map(clave => ({ espacioId, clave, valor: [] as Prisma.InputJsonValue }))
  return [...vacias, { espacioId, clave: 'equipos', valor: { miembros: { Ventas: [] }, ids: { Ventas: [] } } }]
}
