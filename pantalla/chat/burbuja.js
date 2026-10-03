/* Chat de la página web del CRM (26-sep-2026).
   Se pega en cualquier página con <script src="https://<tu-crm>/chat.js" data-espacio="…" async></script>.
   `data-espacio` dice de qué espacio de trabajo (empresa) es; sin él, el servidor usa su espacio por defecto.
   Habla con el API del CRM en /crm/web (api/src/routes/crmWeb.ts). Apagado en Ajustes del CRM, no se pinta.
   El token del navegador queda en localStorage: al volver, la conversación sigue. */
(function () {
  'use strict';
  if (window.__crmChat) return;
  window.__crmChat = true;
  var API = '__API__';
  var yo = document.currentScript || document.querySelector('script[src*="/chat.js"]');
  var ESPACIO = (yo && yo.getAttribute('data-espacio') || '').replace(/[^a-z0-9-]/g, '');
  var sufijo = ESPACIO ? '-' + ESPACIO : '';
  var CLAVE = 'crm-chat-token' + sufijo, CLAVE_VISTO = 'crm-chat-visto' + sufijo;
  var cfg = null, token = leer(CLAVE), mensajes = [], ids = {}, abierto = false, enviando = false, error = '', timer = null, visto = +leer(CLAVE_VISTO) || 0;

  function leer(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } }
  function guardar(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ } }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); }
  function hora(t) { var d = new Date(t); return isNaN(d) ? '' : d.toLocaleTimeString('es-CO', {hour: 'numeric', minute: '2-digit'}); }
  function pedir(metodo, ruta, cuerpo) {
    var h = {'Content-Type': 'application/json'};
    if (token) h.Authorization = 'Bearer ' + token;
    return fetch(API + ruta, {method: metodo, headers: h, body: cuerpo ? JSON.stringify(cuerpo) : undefined, cache: 'no-store'}).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401 && token) { token = ''; guardar(CLAVE, ''); mensajes = []; ids = {}; }
        if (!r.ok || j.success === false) throw new Error((j && (typeof j.error === 'string' ? j.error : j.message)) || 'No se pudo conectar. Intenta de nuevo.');
        return j.data;
      });
    });
  }

  /* ── Estilos y estructura ── */
  var host = document.createElement('div');
  host.setAttribute('data-crm-chat', '');
  var raiz = host.attachShadow ? host.attachShadow({mode: 'open'}) : host;

  function css(c) {
    return ':host{all:initial}*{box-sizing:border-box;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}' +
      '.fab{position:fixed;right:20px;bottom:20px;width:58px;height:58px;border-radius:50%;border:0;background:' + c + ';color:#fff;cursor:pointer;box-shadow:0 8px 24px rgba(15,23,42,.22);display:grid;place-items:center;z-index:2147483000}' +
      '.fab:focus-visible,button:focus-visible,textarea:focus-visible,input:focus-visible{outline:2px solid ' + c + ';outline-offset:2px}' +
      '.fab svg{width:26px;height:26px}.badge{position:absolute;top:-2px;right:-2px;min-width:20px;height:20px;border-radius:10px;background:#dc2626;color:#fff;font-size:11.5px;font-weight:600;display:grid;place-items:center;padding:0 5px}' +
      '.panel{position:fixed;right:20px;bottom:90px;width:370px;height:560px;max-height:calc(100vh - 110px);background:#fff;border-radius:16px;box-shadow:0 18px 50px rgba(15,23,42,.28);display:flex;flex-direction:column;overflow:hidden;z-index:2147483000;color:#1f2937;font-size:14px;line-height:1.45}' +
      '.hd{background:' + c + ';color:#fff;padding:14px 16px;display:flex;align-items:center;gap:10px}.hd b{font-size:15px;font-weight:600;flex:1}.hd small{display:block;font-size:12px;opacity:.9;font-weight:400}' +
      '.x{background:transparent;border:0;color:#fff;cursor:pointer;width:32px;height:32px;border-radius:8px;display:grid;place-items:center}.x:hover{background:rgba(255,255,255,.15)}' +
      '.cuerpo{flex:1;overflow-y:auto;padding:14px;background:#f8fafc;display:flex;flex-direction:column;gap:8px}' +
      '.m{max-width:82%;padding:8px 11px;border-radius:12px;white-space:pre-wrap;word-wrap:break-word;overflow-wrap:anywhere}' +
      '.m.yo{align-self:flex-end;background:' + c + ';color:#fff;border-bottom-right-radius:4px}.m.el{align-self:flex-start;background:#fff;border:1px solid #e5e9f0;border-bottom-left-radius:4px}' +
      '.m .por{display:block;font-size:11.5px;font-weight:600;color:#4b5563;margin-bottom:2px}.m .h{display:block;font-size:10.5px;opacity:.7;margin-top:3px;text-align:right}' +
      '.m a{color:inherit}.m.el a.btn{display:inline-block;margin-top:6px;padding:6px 12px;border-radius:8px;background:' + c + ';color:#fff;text-decoration:none;font-weight:500}' +
      '.m audio{width:220px;margin-top:6px}.ops{display:flex;flex-direction:column;gap:6px;align-self:flex-start;max-width:82%}' +
      '.op{border:1px solid ' + c + ';color:' + c + ';background:#fff;border-radius:10px;padding:7px 12px;cursor:pointer;text-align:left;font-size:13.5px}.op small{display:block;color:#6b7280;font-size:12px}.op:hover{background:#f1f5f9}' +
      '.pie{border-top:1px solid #e5e9f0;padding:10px;display:flex;gap:8px;align-items:flex-end;background:#fff}' +
      'textarea{flex:1;resize:none;border:1px solid #e5e9f0;border-radius:10px;padding:9px 11px;font-size:14px;max-height:110px;min-height:40px;color:#1f2937}' +
      '.env{width:40px;height:40px;border-radius:10px;border:0;background:' + c + ';color:#fff;cursor:pointer;display:grid;place-items:center;flex:none}.env:disabled{opacity:.5;cursor:default}.env svg{width:18px;height:18px}' +
      '.form{padding:16px;display:flex;flex-direction:column;gap:10px;overflow-y:auto;flex:1}.form p{margin:0;color:#4b5563}' +
      '.form label{display:flex;flex-direction:column;gap:4px;font-size:13px;font-weight:500;color:#374151}' +
      '.form input,.form textarea{border:1px solid #e5e9f0;border-radius:10px;padding:9px 11px;font-size:14px;font-weight:400;color:#1f2937;width:100%}' +
      '.pri{border:0;border-radius:10px;background:' + c + ';color:#fff;padding:10px 14px;font-size:14px;font-weight:600;cursor:pointer}.pri:disabled{opacity:.6;cursor:default}' +
      '.err{color:#b91c1c;font-size:13px}.nota{font-size:12px;color:#6b7280}.nota a{color:inherit;text-decoration:underline}.saludo{align-self:flex-start;background:#fff;border:1px solid #e5e9f0;border-radius:12px;padding:8px 11px;max-width:82%}' +
      '@media (max-width:480px){.panel{right:0;bottom:0;width:100vw;height:100%;max-height:none;border-radius:0}.fab{right:14px;bottom:14px}}' +
      '@media (prefers-reduced-motion:no-preference){.panel{animation:sube .18s ease-out}@keyframes sube{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}}';
  }
  var SVG_CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-5A8 8 0 1 1 21 12z"/></svg>';
  var SVG_X = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  var SVG_ENV = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/></svg>';

  function noLeidos() { return mensajes.filter(function (m) { return m.de !== 'yo' && Date.parse(m.t) > visto; }).length; }

  function pintar() {
    var n = abierto ? 0 : noLeidos();
    var html = '<style>' + css(cfg.color) + '</style>';
    html += '<button type="button" class="fab" aria-label="' + (abierto ? 'Cerrar el chat' : 'Abrir el chat') + '" data-a="fab">' + (abierto ? SVG_X : SVG_CHAT) + (n ? '<span class="badge">' + n + '</span>' : '') + '</button>';
    if (abierto) {
      html += '<div class="panel" role="dialog" aria-label="Chat"><div class="hd"><b>' + esc(cfg.nombre) + '<small>' + (cfg.soloFormulario ? 'Déjanos tu mensaje' : 'Te respondemos por aquí') + '</small></b><button type="button" class="x" data-a="cerrar" aria-label="Cerrar el chat">' + SVG_X + '</button></div>';
      html += token || !cfg.pedir && !cfg.soloFormulario ? vistaChat() : vistaFormulario();
      html += '</div>';
    }
    raiz.innerHTML = html;
    var cu = raiz.querySelector('.cuerpo'); if (cu) cu.scrollTop = cu.scrollHeight;
  }

  function vistaFormulario() {
    var h = '<form class="form" data-f="1" novalidate><p>' + esc(cfg.soloFormulario ? cfg.fuera : cfg.saludo) + '</p>';
    if (cfg.pedir || cfg.soloFormulario) {
      h += '<label>Nombre y apellido<input name="nombre" autocomplete="name" required maxlength="80"></label>';
      h += '<label>Tu WhatsApp<input name="tel" type="tel" inputmode="tel" autocomplete="tel" required maxlength="30" placeholder="Ej. 300 123 4567"></label>';
    }
    h += '<label>' + (cfg.soloFormulario ? 'Tu mensaje' : '¿En qué te ayudamos?') + '<textarea name="texto" rows="3" maxlength="2000" required></textarea></label>';
    if (error) h += '<div class="err" role="alert">' + esc(error) + '</div>';
    h += '<button type="submit" class="pri"' + (enviando ? ' disabled' : '') + '>' + (enviando ? 'Enviando…' : cfg.soloFormulario ? 'Dejar mensaje' : 'Empezar el chat') + '</button>';
    h += '<span class="nota">Al escribirnos autorizas a ' + esc(cfg.nombre || 'la empresa') + ' a usar estos datos para responderte' + (cfg.privacidad ? ', según su <a href="' + esc(cfg.privacidad) + '" target="_blank" rel="noopener noreferrer">política de datos</a>' : '') + '.</span></form>';
    return h;
  }

  function burbuja(m, ultimo) {
    if (m.de === 'yo') return '<div class="m yo">' + esc(m.texto) + '<span class="h">' + (m.pendiente ? 'Enviando…' : esc(hora(m.t))) + '</span></div>';
    var por = m.de === 'equipo' ? (m.por ? m.por + (cfg.nombre ? ' · ' + cfg.nombre : '') : (cfg.nombre || 'Equipo')) : (m.por ? m.por + ' · asistente virtual' : 'Asistente virtual');
    var h = '<div class="m el"><span class="por">' + esc(por) + '</span>' + esc(m.texto);
    if (m.enlace) h += '<br><a class="btn" href="' + esc(m.enlace.url) + '" target="_blank" rel="noopener">' + esc(m.enlace.t) + '</a>';
    if (m.archivo) h += '<br><a href="' + esc(m.archivo.url) + '" target="_blank" rel="noopener">' + esc(m.archivo.n) + '</a>';
    if (m.audio) h += '<br><audio controls preload="none" src="' + esc(m.audio) + '"></audio>';
    h += '<span class="h">' + esc(hora(m.t)) + '</span></div>';
    // Las opciones de un flujo solo se pueden tocar en su último mensaje.
    if (ultimo && m.botones) h += '<div class="ops">' + m.botones.map(function (b) { return '<button type="button" class="op" data-op="' + esc(b.id) + '" data-t="' + esc(b.t) + '">' + esc(b.t) + '</button>'; }).join('') + '</div>';
    if (ultimo && m.lista) h += '<div class="ops">' + m.lista.ops.map(function (o) { return '<button type="button" class="op" data-op="' + esc(o.id) + '" data-t="' + esc(o.t) + '">' + esc(o.t) + (o.d ? '<small>' + esc(o.d) + '</small>' : '') + '</button>'; }).join('') + '</div>';
    return h;
  }

  function vistaChat() {
    var h = '<div class="cuerpo" aria-live="polite"><div class="saludo">' + esc(cfg.saludo) + '</div>';
    h += mensajes.map(function (m, i) { return burbuja(m, i === mensajes.length - 1); }).join('');
    h += '</div>';
    if (error) h += '<div class="err" role="alert" style="padding:6px 12px">' + esc(error) + '</div>';
    h += '<div class="pie"><textarea rows="1" data-ta="1" maxlength="2000" placeholder="Escribe tu mensaje" aria-label="Escribe tu mensaje"></textarea><button type="button" class="env" data-a="enviar" aria-label="Enviar"' + (enviando ? ' disabled' : '') + '>' + SVG_ENV + '</button></div>';
    return h;
  }

  /* ── Datos ── */
  function traer() {
    if (!token) return Promise.resolve();
    var ult = mensajes.filter(function (m) { return !m.pendiente; }).slice(-1)[0];
    // Un minuto hacia atrás: un mensaje que se guardó un instante antes que otro ya traído no se pierde.
    var desde = ult ? new Date(Date.parse(ult.t) - 60000).toISOString() : '';
    var mira = abierto && document.visibilityState === 'visible';
    return pedir('GET', '/crm/web/mensajes?' + (desde ? 'desde=' + encodeURIComponent(desde) + '&' : '') + (mira ? 'visto=1' : '')).then(function (d) {
      var hubo = false;
      (d.mensajes || []).forEach(function (m) {
        if (ids[m.id]) return;
        ids[m.id] = 1; hubo = true;
        // El mensaje propio ya está en pantalla con el id que devolvió el envío: se reemplaza, no se repite.
        var i = mensajes.findIndex(function (x) { return x.id === m.id; });
        if (i >= 0) mensajes[i] = m; else mensajes.push(m);
      });
      if (hubo) {
        mensajes.sort(function (a, b) { return Date.parse(a.t) - Date.parse(b.t); });
        if (mira) marcarVisto();
        pintarSinPerderTexto();
      }
    }, function () { if (!token) pintar(); });
  }
  function marcarVisto() { var u = mensajes.slice(-1)[0]; if (u) { visto = Date.parse(u.t) || Date.now(); guardar(CLAVE_VISTO, String(visto)); } }
  function pintarSinPerderTexto() {
    var ta = raiz.querySelector('[data-ta]'), v = ta ? ta.value : '', foco = ta && raiz.activeElement === ta;
    pintar();
    var nt = raiz.querySelector('[data-ta]'); if (nt) { nt.value = v; if (foco) nt.focus(); }
  }
  function programar() {
    clearTimeout(timer);
    if (!token) return;
    timer = setTimeout(function () { traer().then(programar, programar); }, abierto && document.visibilityState === 'visible' ? 3000 : 25000);
  }

  function enviar(texto, respuestaId) {
    texto = String(texto || '').trim();
    if (!texto || enviando) return;
    var cid = 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    var local = {id: cid, de: 'yo', texto: texto, t: new Date().toISOString(), pendiente: true};
    mensajes.push(local); error = ''; enviando = true; pintar();
    var listo = token ? Promise.resolve() : pedir('POST', '/crm/web/sesion?e=' + ESPACIO, {pagina: location.href}).then(function (d) { token = d.token; guardar(CLAVE, token); });
    listo.then(function () { return pedir('POST', '/crm/web/mensajes', {texto: texto, cid: cid, respuestaId: respuestaId || undefined}); })
      .then(function (d) { if (d && d.id) { local.id = d.id; if (ids[d.id]) mensajes.splice(mensajes.indexOf(local), 1); } local.pendiente = false; })
      .catch(function (e) { mensajes.splice(mensajes.indexOf(local), 1); error = e.message; })
      .then(function () { enviando = false; pintar(); var ta = raiz.querySelector('[data-ta]'); if (ta && error) ta.value = texto; traer().then(programar, programar); });
  }

  function empezar(form) {
    var f = new FormData(form), texto = String(f.get('texto') || '').trim();
    if (!texto) { error = 'Escribe tu mensaje.'; pintar(); return; }
    enviando = true; error = ''; pintar();
    pedir('POST', '/crm/web/sesion?e=' + ESPACIO, {nombre: f.get('nombre') || '', tel: f.get('tel') || '', pagina: location.href})
      .then(function (d) { token = d.token; guardar(CLAVE, token); enviando = false; enviar(texto); })
      .catch(function (e) { enviando = false; error = e.message; pintar(); var nf = raiz.querySelector('[data-f]'); if (nf) { ['nombre', 'tel', 'texto'].forEach(function (k) { var el = nf.elements[k]; if (el) el.value = f.get(k) || ''; }); } });
  }

  /* ── Eventos ── */
  raiz.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-a],[data-op]') : null; if (!b) return;
    var a = b.getAttribute('data-a');
    if (a === 'fab' || a === 'cerrar') { abierto = a === 'fab' ? !abierto : false; error = ''; if (abierto) marcarVisto(); pintar(); if (abierto) { var t = raiz.querySelector('[data-ta],input,textarea'); if (t) t.focus(); traer().then(programar, programar); } return; }
    if (a === 'enviar') { var ta = raiz.querySelector('[data-ta]'); var v = ta.value; ta.value = ''; enviar(v); return; }
    if (b.hasAttribute('data-op')) enviar(b.getAttribute('data-t'), b.getAttribute('data-op'));
  });
  raiz.addEventListener('submit', function (e) { e.preventDefault(); empezar(e.target); });
  raiz.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && abierto) { abierto = false; pintar(); return; }
    if (e.key === 'Enter' && !e.shiftKey && e.target.getAttribute && e.target.getAttribute('data-ta')) { e.preventDefault(); var v = e.target.value; e.target.value = ''; enviar(v); }
  });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') traer().then(programar, programar); });

  function arrancar() {
    pedir('GET', '/crm/web/config?e=' + ESPACIO).then(function (c) {
      if (!c || !c.on) return;
      cfg = c;
      document.body.appendChild(host);
      pintar();
      traer().then(programar, programar);
    }, function () { /* sin chat: la página sigue igual */ });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arrancar); else arrancar();
})();
