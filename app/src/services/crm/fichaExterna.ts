/**
 * Ficha externa del contacto: lo que otro sistema de la empresa (su ERP, su tienda, su plataforma académica) sabe
 * de la persona: qué compró, cómo va con sus pagos y quién la atiende. La pantalla la muestra en la pestaña de la
 * ficha y la bandeja la usa en los filtros de compras y cuotas.
 *
 * Es un punto de extensión: de fábrica no hay ningún sistema conectado y `fichaDeContacto` devuelve null. Para
 * conectar uno, busca a la persona por `telefono` o `correo`, arma la ficha con esta forma y guarda
 * `contacto.externoId` (el id de la persona en ese sistema) y `ficha.compras`. Contrato en docs/crm/api-core.md.
 */

export interface Compras { p: string; medio: string; pagadas: number; total: number; prox: string; proxFecha: string | null; estado: 'Al día' | 'Atrasada' }
export interface FichaExterna {
  externoId: string | null
  nombre: string | null
  via: 'telefono' | 'correo' | 'representante' | null
  productos: { p: string; fecha: string; precio: number | null; historico: boolean }[]
  compras: Compras | null
  asesor: string | null
  recuperacion: { tipo: string; estado: string; producto: string; fecha: string; asesor: string | null; valor: number | null }[]
}

/** ¿Hay un sistema externo conectado? En true, el agente IA recibe la herramienta para buscar a la persona en él. */
export const FICHA_EXTERNA = false

export async function fichaDeContacto(_contactoId: number): Promise<{ ficha: FichaExterna; cambio: boolean } | null> {
  return null
}
