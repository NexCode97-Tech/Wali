import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Router, Request, Response } from 'express'
import { asyncHandler } from './middleware/errorHandler'
import { sesionDePagina } from './routes/auth'
import { prisma } from './config/prisma'
import { espacioDeUsuario } from './services/crm/espacio'
import { configura } from './utils/roles'
import { PAISES } from './data/paises'
import { BASE } from './utils/base'

/**
 * Las pantallas. Todas son HTML con su CSS y su código dentro, servidas por aquí (y no como archivos sueltos)
 * para que pidan sesión: quien no ha entrado va a /entrar.
 *
 * - /entrar: el inicio de sesión.
 * - /: el marco, con la barra de arriba (marca, campana y cuenta) y el CRM dentro de un iframe.
 * - /app: el CRM. Su fuente vive en `pantalla/`: el HTML con su CSS y los scripts de `js/`, que se pegan en
 *   orden en un solo <script> (comparten el ámbito global). Antes del código va `CRM_INICIO` con la persona de
 *   la sesión; los datos los pide la página al API con su token.
 * - /usuarios: las cuentas del espacio, para el administrador.
 * - /chat.js: la burbuja del chat para las páginas web de la empresa (pública).
 */
const PANTALLA = join(process.cwd(), 'pantalla')
const SCRIPTS = ['10-nucleo', '20-llamadas', '30-legal', '40-ajustes', '45-canales', '46-correo', '47-pauta', '48-barra', '50-agentes', '56-compositor', '57-celular-menu', '58-celular-chat', '59-celular-ajustes', '61-equipos-roles', '62-vistas-rol', '63-ia-sugerencias', '64-ia-embudo', '65-encuesta', '66-finalizadas', '67-mejoras', '60-kb', '68-marco', '69-tema', '70-plan', '72-espacios', '73-carpetas', '80-datos', '90-arranque']

/** El nombre del producto que se ve en la pestaña, el inicio de sesión y la barra. */
const MARCA = () => (process.env.CRM_NOMBRE || 'CRM').slice(0, 40)
const enProduccion = () => process.env.NODE_ENV === 'production'

const cache = new Map<string, string>()
function leer(ruta: string, armar?: (texto: string) => string): string {
  const guardado = cache.get(ruta)
  if (guardado && enProduccion()) return guardado
  const crudo = readFileSync(join(PANTALLA, ruta), 'utf8')
  // `__BASE__` marca en las pantallas las direcciones propias (/api, /entrar…): lleva el prefijo de CRM_BASE.
  const texto = (armar ? armar(crudo) : crudo).replace(/__BASE__/g, BASE)
  cache.set(ruta, texto)
  return texto
}

/** El logo de la empresa en la barra lateral (CRM_LOGO: una dirección https o una ruta del mismo sitio). Sin él, el
 *  ícono de fábrica. */
const LOGO = (() => {
  const v = (process.env.CRM_LOGO ?? '').trim()
  return /^(https:\/\/|\/)[^\s"'<>]+$/.test(v) ? v : ''
})()

const armarCrm = () => leer('crm.html', html => {
  const js = SCRIPTS.map(n => readFileSync(join(PANTALLA, 'js', n + '.js'), 'utf8')).join('\n')
  const conLogo = LOGO
    ? html.replace(/<span class="brand-ic" aria-hidden="true">[\s\S]*?<\/span>/, () => `<span class="brand-ic logo" aria-hidden="true"><img src="${escapar(LOGO)}" alt=""></span>`)
    : html
  return conLogo.replace('/*CRM_SCRIPTS*/', () => '/*CRM_INICIO*/\n' + js)
})

/** JSON para poner dentro de un <script>: `<` escapado, así un nombre con "</script>" no cierra la etiqueta. */
const enScript = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c')
const escapar = (t: string) => t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

function html(res: Response, cuerpo: string) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'private, no-store')
  res.send(cuerpo)
}

const router = Router()

router.get('/entrar', asyncHandler(async (req: Request, res: Response) => {
  // Con sesión ya abierta se va al CRM; si viene de la página de precios con un plan, el plan sigue en la dirección.
  if (await sesionDePagina(req)) {
    const plan = typeof req.query.pagar === 'string' && /^(starter|growth|business)$/.test(req.query.pagar) ? req.query.pagar : ''
    return res.redirect(BASE + '/' + (plan ? `?pagar=${plan}&periodo=${req.query.periodo === 'anual' ? 'anual' : 'mensual'}` : ''))
  }
  const logo = LOGO ? `<img src="${escapar(LOGO)}" alt="">` : ''
  html(res, leer('paginas/entrar.html').replace('__LOGO__', () => logo).replace(/__MARCA__/g, escapar(MARCA())))
}))

/** La persona de la sesión con su espacio, o la redirección al inicio de sesión. */
async function sesion(req: Request, res: Response) {
  const u = await sesionDePagina(req)
  if (!u) { res.redirect(BASE + '/entrar'); return null }
  const espacioId = await espacioDeUsuario(u.id)
  if (!espacioId) { res.status(403).send('Tu cuenta no pertenece a ningún espacio de trabajo. Habla con el administrador.'); return null }
  const espacio = await prisma.crmEspacio.findUnique({ where: { id: espacioId }, select: { id: true, nombre: true } })
  return { u, espacio: espacio ?? { id: espacioId, nombre: '' } }
}

const yoDe = (u: { id: string; nombre: string | null; email: string; role: string; image: string | null; operador: boolean }) => ({
  id: u.id, nombre: u.nombre ?? u.email, correo: u.email, rol: u.role === 'LECTOR' ? 'ADMIN' : u.role,
  esLider: configura(u.role === 'LECTOR' ? 'ADMIN' : u.role), foto: u.image ?? null, soloLectura: u.role === 'LECTOR',
  operador: u.operador && u.role === 'ADMIN',
})

router.get(['/', '/crm'], asyncHandler(async (req: Request, res: Response) => {
  // Los avisos viejos apuntan a /crm?conv=…: el marco vive en la raíz.
  if (req.path === '/crm') return res.redirect(BASE + '/' + (req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : ''))
  const s = await sesion(req, res); if (!s) return
  const inicio = { marca: MARCA(), espacio: s.espacio, yo: { ...yoDe(s.u), admin: s.u.role === 'ADMIN' } }
  html(res, leer('paginas/marco.html').replace(/__MARCA__/g, escapar(MARCA())).replace('/*MARCO_INICIO*/', () => `window.MARCO = ${enScript(inicio)};`))
}))

router.get('/app', asyncHandler(async (req: Request, res: Response) => {
  const s = await sesion(req, res); if (!s) return
  const inicio = {
    api: BASE + '/api',
    yo: yoDe(s.u),
    espacio: s.espacio,
    // Los países con su indicativo, para los teléfonos con bandera.
    paises: PAISES.map(p => [p.iso, p.nombre, p.indicativo]),
  }
  html(res, armarCrm().replace('/*CRM_INICIO*/', () => `window.CRM_INICIO = ${enScript(inicio)};`))
}))

router.get('/usuarios', asyncHandler(async (req: Request, res: Response) => {
  const s = await sesion(req, res); if (!s) return
  if (s.u.role !== 'ADMIN') return res.redirect(BASE + '/')
  const inicio = { marca: MARCA(), espacio: s.espacio, yo: { id: s.u.id, nombre: s.u.nombre ?? s.u.email } }
  html(res, leer('paginas/usuarios.html').replace(/__MARCA__/g, escapar(MARCA())).replace('/*USUARIOS_INICIO*/', () => `window.INICIO = ${enScript(inicio)};`))
}))

/** La burbuja del chat web: pública y cargable desde otro dominio. La dirección del API es la de este servidor. */
router.get('/chat.js', (req: Request, res: Response) => {
  const propia = (process.env.API_PUBLIC_URL ?? '').trim().replace(/\/+$/, '') || `${req.protocol}://${req.get('host')}${BASE}`
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=300')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
  res.send(leer('chat/burbuja.js').replace("'__API__'", () => JSON.stringify(`${propia}/api`)))
})

export default router
