/* Service worker de Wali (25-nov). Hace dos cosas:
   1. Recibe las notificaciones push del servidor (services/push.ts) y las muestra con el sonido y la vibración del
      sistema, aunque Wali esté minimizado o cerrado: computador, Android y iPhone con Wali en la pantalla de inicio.
      Si Wali está a la vista en ese dispositivo, no repite el aviso (la bandeja ya sonó), salvo en iPhone, donde
      Apple exige mostrar cada push.
   2. Hace instalable a Wali como aplicación (PWA) en el computador, Android y iPhone, junto con el manifiesto.
   Al tocar la notificación abre Wali en esa conversación (o lo trae al frente si ya está abierto).
   No guarda páginas ni datos en caché: el CRM siempre carga lo último del servidor. */
const BASE = '__BASE__';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// Chrome y Edge piden un manejador de «fetch» para ofrecer la instalación en algunos sistemas: deja pasar todo tal cual.
self.addEventListener('fetch', () => {});

const esIOS = /iPhone|iPad|iPod/.test(self.navigator.userAgent) || (self.navigator.platform === 'MacIntel' && self.navigator.maxTouchPoints > 1);

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { t: 'Wali', b: e.data ? e.data.text() : '' }; }
  e.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const aLaVista = ventanas.some(c => c.visibilityState === 'visible' && c.focused);
    if (aLaVista && !esIOS) return;
    await self.registration.showNotification(d.t || 'Wali', {
      body: d.b || '',
      icon: BASE + '/img/wali-192.png',
      badge: BASE + '/img/wali-badge-96.png',
      tag: d.tag || undefined,
      // Con la misma etiqueta (otro mensaje de la misma conversación) vuelve a sonar.
      renotify: !!d.tag,
      vibrate: [120, 60, 120],
      timestamp: Date.now(),
      data: { url: d.url || BASE + '/' },
    });
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || BASE + '/';
  e.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const propia = ventanas.find(c => new URL(c.url).pathname.startsWith(BASE + '/') || new URL(c.url).pathname === BASE);
    if (propia) {
      try { await propia.focus(); } catch { /* el sistema no dejó traerla al frente */ }
      propia.postMessage({ tipo: 'crm-push-abrir', url });
      return;
    }
    await self.clients.openWindow(url);
  })());
});

// El navegador renovó la suscripción por su cuenta: se registra la nueva para no dejar de recibir avisos.
self.addEventListener('pushsubscriptionchange', e => {
  e.waitUntil((async () => {
    try {
      // La API pide el token de la sesión; se saca con la cookie, como la pantalla (crmToken de 80-datos.js).
      const t = await fetch(BASE + '/api/auth/token', { credentials: 'same-origin', cache: 'no-store' });
      if (!t.ok) return;
      const tok = (await t.json()).token; if (!tok) return;
      const aut = { Authorization: 'Bearer ' + tok };
      const r = await fetch(BASE + '/api/crm/push/clave', { headers: aut });
      const clave = (await r.json()).data.clave;
      if (!clave) return;
      const relleno = '='.repeat((4 - clave.length % 4) % 4);
      const bin = atob((clave + relleno).replace(/-/g, '+').replace(/_/g, '/'));
      const llave = Uint8Array.from(bin, c => c.charCodeAt(0));
      const s = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: llave });
      await fetch(BASE + '/api/crm/push/dispositivo', { method: 'POST', headers: { ...aut, 'Content-Type': 'application/json' }, body: JSON.stringify(s.toJSON()) });
    } catch { /* se vuelve a registrar la próxima vez que la persona abra Wali */ }
  })());
});
