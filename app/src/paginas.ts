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
import { pdfPublico } from './services/crm/terminos'
import { esOperador, operadorDeSesion, operadorRecien, paseValido } from './services/crm/panelAcceso'

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
 * - /admin: el panel de superadministrador, solo para el operador de la plataforma.
 * - /chat.js: la burbuja del chat para las páginas web de la empresa (pública).
 */
const PANTALLA = join(process.cwd(), 'pantalla')
const SCRIPTS = ['10-nucleo', '20-llamadas', '30-legal', '40-ajustes', '45-canales', '46-correo', '47-pauta', '48-barra', '49-plantillas', '50-agentes', '56-compositor', '57-celular-menu', '58-celular-chat', '59-celular-ajustes', '61-equipos-roles', '62-vistas-rol', '63-ia-sugerencias', '64-ia-embudo', '65-encuesta', '66-finalizadas', '67-mejoras', '60-kb', '68-marco', '69-tema', '70-plan', '70-usuarios', '71-pestana', '72-espacios', '73-carpetas', '74-reglas', '75-respondidas', '76-contactos', '77-contactos-lista', '77-equipos', '78-difusiones', '78-horarios', '79-manychat', '80-datos', '81-movil', '82-contactos-movil', '83-wa-caido', '84-rutas', '85-embudo-chat', '86-subequipos', '87-grabaciones', '86-flujos-equipo', '87-encuesta-equipo', '88-primeros-pasos', '88-responder', '88-burbujas', '88-llamadas-vivo', '88-llamadas-ajustes', '89-ayuda-guias', '89-ayuda', '89-movimiento', '89-seleccion', '89-barra-plegable', '89-api', '89-ficha-cajon', '89-recordatorios', '89-chat-whatsapp', '89-chat-por-partes', '89-mi-bandeja', '89-perfil-google', '90-arranque']

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

/** Lo que comparten la bandeja del CRM y Soporte del superadmin (11-nov): un solo archivo para las dos pantallas. */
const BANDEJA = () => readFileSync(join(PANTALLA, 'compartido', 'bandeja.js'), 'utf8')

const armarCrm = () => leer('crm.html', html => {
  const js = BANDEJA() + '\n' + SCRIPTS.map(n => readFileSync(join(PANTALLA, 'js', n + '.js'), 'utf8')).join('\n')
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
  // La cuenta de operador recién entrada (Google) elige entre el CRM y el panel, y también al abrir /entrar sin nada más
  // con la sesión ya abierta (botón «Ingresar» del sitio). Quien viene del panel sin pase vuelve a iniciar sesión aunque
  // tenga la del CRM abierta (panelAcceso.ts).
  const elegir = (req.query.elegir === '1' && !!(await operadorRecien(req))) || (Object.keys(req.query).length === 0 && !!(await operadorDeSesion(req)))
  const alPanel = req.query.ir === 'panel'
  // Volvió de Google con la sesión recién abierta: la intro de bienvenida antes del CRM.
  const conIntro = req.query.intro === '1' && !!(await sesionDePagina(req))
  // Con sesión ya abierta se va al CRM; si viene de la página de precios con un plan, el plan sigue en la dirección.
  if (!elegir && !alPanel && !conIntro && await sesionDePagina(req)) {
    const plan = typeof req.query.pagar === 'string' && /^(starter|growth|business)$/.test(req.query.pagar) ? req.query.pagar : ''
    // El cupón de un enlace del panel sigue hasta el CRM, que lo guarda para el pago.
    const cupon = typeof req.query.cupon === 'string' && /^[A-Za-z0-9]{3,30}$/.test(req.query.cupon) ? req.query.cupon.toUpperCase() : ''
    const q = new URLSearchParams()
    if (plan) { q.set('pagar', plan); q.set('periodo', req.query.periodo === 'anual' ? 'anual' : 'mensual') }
    if (cupon) q.set('cupon', cupon)
    return res.redirect(BASE + '/' + (q.toString() ? '?' + q : ''))
  }
  const logo = LOGO ? `<img src="${escapar(LOGO)}" alt="">` : ''
  html(res, leer('paginas/entrar.html').replace('__LOGO__', () => logo).replace(/__MARCA__/g, escapar(MARCA())).replace('/*ENTRAR_INICIO*/', () => `window.ENTRAR = ${enScript({ elegir, intro: conIntro || req.query.elegir === '1' })};`))
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
    // gcal: el correo de su Google Calendar conectado (recordatorios), o null.
    yo: { ...yoDe(s.u), gcal: (await prisma.crmGoogleCalendario.findUnique({ where: { userId: s.u.id }, select: { correo: true } }))?.correo ?? null },
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

/** El panel de superadministrador (maqueta A aprobada el 27-oct). Sin sesión de operador responde 404, como si no
 *  existiera: ni siquiera se insinúa que hay un panel. */
router.get('/admin', asyncHandler(async (req: Request, res: Response) => {
  const u = await sesionDePagina(req)
  if (!u || !esOperador(u)) { res.status(404).type('text/plain').send('No encontrado'); return }
  // Sin el pase que da elegir «Panel» al iniciar sesión, se vuelve a iniciar sesión.
  if (!paseValido(req, u.id)) { res.redirect(BASE + '/entrar?ir=panel'); return }
  const inicio = { yo: { nombre: u.nombre ?? u.email } }
  html(res, leer('paginas/admin.html', h => h.replace('/*BANDEJA_COMPARTIDA*/', () => BANDEJA())).replace('/*ADMIN_INICIO*/', () => `window.INICIO = ${enScript(inicio)};`))
}))

/** El estado de una solicitud de borrado de datos que llegó desde Meta (13-nov, metaPrivacidad.ts). Pública: la abre la
 *  persona desde el aviso de Facebook o Instagram, con su código. */
router.get('/meta/borrado', asyncHandler(async (req: Request, res: Response) => {
  const { solicitudBorrado } = await import('./services/crm/metaPrivacidad')
  const s = typeof req.query.codigo === 'string' ? await solicitudBorrado(req.query.codigo.trim().toUpperCase()) : null
  res.setHeader('X-Robots-Tag', 'noindex')
  html(res, leer('paginas/borrado.html').replace('/*BORRADO_INICIO*/', () => `window.BORRADO = ${enScript(s)};`))
}))

/** El enlace público de los términos y condiciones de una empresa: siempre abre la última versión. */
/** La documentación pública de la API (11-nov): walicrm.com/crm/docs/api. */
router.get('/docs/api', (_req: Request, res: Response) => { html(res, leer('paginas/api-docs.html')) })

router.get('/t/:espacio', asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.espacio)
  const url = /^[a-z0-9][a-z0-9-]{0,80}$/.test(id) ? await pdfPublico(id) : null
  if (!url) { res.status(404).type('text/plain').send('Esta empresa no tiene términos y condiciones publicados.'); return }
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Robots-Tag', 'noindex')
  res.redirect(302, url)
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

/** El favicon de Wali (maqueta aprobada el 8-oct): 32 px para la pestaña, 180 para iPhone y el .ico de respaldo. */
router.get(/^\/img\/wali-(32|180|512|w)\.png$/, (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'public, max-age=604800')
  res.sendFile(join(PANTALLA, 'img', `wali-${req.params[0]}.png`))
})
router.get('/favicon.ico', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'public, max-age=604800')
  res.sendFile(join(PANTALLA, 'img', 'wali.ico'))
})

/** El logo de la cabecera de los correos (CRM_CORREO_LOGO): lo cargan Gmail, Outlook y Apple Mail desde otro sitio. */
router.get('/img/wali-correo.png', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'public, max-age=604800')
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
  res.sendFile(join(PANTALLA, 'img', 'wali-correo.png'))
})

/** El fondo del chat de prueba de Agentes IA (como el de WhatsApp). */
router.get('/img/wa-fondo.jpg', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'public, max-age=604800')
  res.sendFile(join(PANTALLA, 'img', 'wa-fondo.jpg'))
})

// Fondo del chat (maqueta aprobada «chat con archivos, notas de voz y emojis», 14-oct): trazos dorados muy suaves.
router.get('/img/fondo-chat.png', (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'public, max-age=604800')
  res.sendFile(join(PANTALLA, 'img', 'fondo-chat.png'))
})

// Selector de emojis completo (emoji-picker-element) y sus datos en español, servidos desde el CRM: sin otros sitios.
const EMOJI_JS: Record<string, string> = {
  'picker.js': require.resolve('emoji-picker-element/picker.js'),
  'database.js': require.resolve('emoji-picker-element/database.js'),
  'es.js': require.resolve('emoji-picker-element/i18n/es.js'),
}
router.get('/vendor/emoji/:archivo', (req: Request, res: Response) => {
  const archivo = String(req.params.archivo)
  const ruta = archivo === 'es.json' ? require.resolve('emoji-picker-element-data/es/cldr/data.json') : EMOJI_JS[archivo]
  if (!ruta) { res.status(404).end(); return }
  res.setHeader('Cache-Control', 'public, max-age=604800')
  res.type(archivo.endsWith('.json') ? 'application/json' : 'text/javascript')
  res.sendFile(ruta)
})

export default router
