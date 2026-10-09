/**
 * El prefijo con que se publica el CRM cuando vive dentro de otro sitio (CRM_BASE=/crm, por ejemplo
 * `https://empresa.com/crm`). El proxy de enfrente lo quita antes de llegar aquí, así que las rutas del servidor no
 * cambian: solo lo llevan las direcciones que se le entregan al navegador (redirecciones, enlaces y llamadas de las
 * pantallas, la cookie de la sesión). Vacío: el CRM vive en la raíz de su dominio.
 */
function leerBase(): string {
  const crudo = (process.env.CRM_BASE ?? '').trim().replace(/\/+$/, '')
  if (!crudo) return ''
  const base = crudo.startsWith('/') ? crudo : '/' + crudo
  // Va dentro del HTML y del código de las pantallas: solo segmentos simples.
  if (!/^(\/[a-z0-9-]+)+$/i.test(base)) throw new Error(`CRM_BASE inválido: "${crudo}". Usa algo como /crm`)
  return base
}

export const BASE = leerBase()
