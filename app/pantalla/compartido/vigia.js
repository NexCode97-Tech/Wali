/* ── Vigilante de las pantallas (13-nov, aprobado). Un solo archivo para el CRM, el superadmin, el inicio de sesión y
   el sitio walicrm.com: atrapa los errores de JavaScript, las promesas que fallan sin que nadie las atienda y las
   peticiones al servidor que se caen (502, 503, 504 o sin conexión), y los manda a Sentry por el túnel del servidor
   (routes/vigia.ts). El 500 no se manda desde aquí: ese ya lo avisa el servidor.
   Sin datos de clientes: nada de lo que se escribe, ni la consola, ni las direcciones con sus parámetros; los correos
   y teléfonos que aparezcan en un error se tapan. Sin grabación de la sesión.
   Se empaqueta con Sentry al construir (scripts/armar-vigia.mjs → dist/vigia.js). ── */
import * as Sentry from '@sentry/browser';

// El servidor cambia __BASE__ y __RELEASE__ al servir el archivo; dentro de JSON.parse para que el empaquetador no los
// dé por fijos (con su largo y todo) al reducir el código.
const CONF = JSON.parse('{"base":"__BASE__","release":"__RELEASE__"}');
const BASE = CONF.base;
const TUNEL = BASE + '/api/vigia';

const ruta = location.pathname;
const dentro = BASE ? ruta === BASE || ruta.startsWith(BASE + '/') : true;
const propia = dentro ? ruta.slice(BASE.length) || '/' : ruta;
const pantalla = !dentro ? 'sitio'
  : propia.startsWith('/app') ? 'crm'
  : propia.startsWith('/admin') ? 'superadmin'
  : propia.startsWith('/entrar') ? 'entrar'
  : propia.startsWith('/usuarios') ? 'usuarios'
  : propia.startsWith('/docs') ? 'docs'
  : 'marco';

const limpiar = t => String(t)
  .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '<correo>')
  .replace(/\+?\d[\d\s-]{7,}\d/g, '<número>');
// La dirección sin parámetros (algunas llevan tokens) y con los números como :n, para agrupar.
const sinQuery = u => { try { const x = new URL(u, location.href); return x.origin + x.pathname; } catch { return ''; } };
const plantilla = p => p.replace(/\/[a-z0-9]{20,}(?=\/|$)/gi, '/:id').replace(/\/\d+(?=\/|$)/g, '/:n');

Sentry.init({
  // El DSN de verdad lo pone el servidor al reenviar: este solo le da forma al aviso.
  dsn: 'https://vigia@vigia.invalid/1',
  tunnel: TUNEL,
  release: /^[0-9a-f]{6,}$/.test(CONF.release) ? CONF.release : undefined,
  environment: 'production',
  sendDefaultPii: false,
  tracesSampleRate: 0,
  integrations: def => def
    .filter(i => i.name !== 'BrowserSession' && i.name !== 'Breadcrumbs')
    .concat(Sentry.breadcrumbsIntegration({ console: false, dom: true, fetch: true, xhr: true, history: true })),
  ignoreErrors: [
    /ResizeObserver loop/,
    /^Script error\.?$/,
    /Non-Error promise rejection captured/,
    /AbortError/,
    /The (user|operation) aborted/,
  ],
  denyUrls: [/extensions\//i, /^chrome(-extension)?:\/\//i, /^moz-extension:\/\//i, /^safari(-web)?-extension:\/\//i],
  beforeSend(ev) {
    ev.tags = Object.assign({}, ev.tags, { lado: 'navegador', pantalla });
    const ini = window.CRM_INICIO || window.MARCO || null;
    if (ini && ini.espacio && ini.espacio.id) ev.tags.espacio = String(ini.espacio.id);
    if (ini && ini.yo && ini.yo.rol) ev.tags.rol = String(ini.yo.rol);
    delete ev.user;
    if (ev.request) { ev.request.url = sinQuery(ev.request.url || location.href); delete ev.request.headers; delete ev.request.cookies; delete ev.request.query_string; }
    if (ev.message) ev.message = limpiar(ev.message);
    for (const v of (ev.exception && ev.exception.values) || []) if (v.value) v.value = limpiar(v.value);
    return ev;
  },
  beforeBreadcrumb(b) {
    if (b.category === 'console') return null;
    if (b.data) {
      if (b.data.url) b.data.url = sinQuery(b.data.url);
      if (b.data.from) b.data.from = sinQuery(b.data.from);
      if (b.data.to) b.data.to = sinQuery(b.data.to);
    }
    if (b.message) b.message = limpiar(b.message);
    return b;
  },
});

// Peticiones al propio servidor que se caen: la persona ve que «no carga» y aquí queda con qué dirección y cuándo.
const fetchOriginal = window.fetch;
if (typeof fetchOriginal === 'function') {
  window.fetch = function (entrada, op) {
    const p = fetchOriginal.apply(this, arguments);
    try {
      const url = typeof entrada === 'string' ? entrada : entrada && entrada.url || String(entrada);
      const x = new URL(url, location.href);
      if (x.origin === location.origin && !x.pathname.endsWith('/api/vigia')) {
        const metodo = String(op && op.method || entrada && entrada.method || 'GET').toUpperCase();
        const donde = plantilla(x.pathname);
        p.then(r => {
          if (r.status >= 502 && r.status <= 504) {
            Sentry.captureMessage(`El servidor no respondió (${r.status}) en ${metodo} ${donde}`, { level: 'error', tags: { origen: 'peticion', estado: String(r.status) }, fingerprint: ['peticion', String(r.status), metodo, donde] });
          }
        }, e => {
          if (e && e.name === 'AbortError') return;
          if (!navigator.onLine || document.visibilityState !== 'visible') return;
          Sentry.captureMessage(`Sin conexión con el servidor en ${metodo} ${donde}`, { level: 'warning', tags: { origen: 'peticion', estado: 'red' }, fingerprint: ['peticion', 'red', metodo, donde] });
        });
      }
    } catch { /* el vigilante nunca rompe una petición */ }
    return p;
  };
}

window.WaliVigia = { avisar: (texto, extra) => Sentry.captureMessage(limpiar(texto), { level: 'error', extra }) };
