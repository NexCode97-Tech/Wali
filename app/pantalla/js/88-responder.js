/* ── Responder y reaccionar (maqueta aprobada, 23-oct) ──
   Cada mensaje con su ⋯ (al pasar el mouse, o mantener presionado en el celular): las reacciones de WhatsApp y
   Responder, Copiar y Reenviar. Responder deja la cita arriba de donde se escribe (X roja para quitarla) y el
   mensaje sale citado (datos.cita: whatsapp.ts manda el context de Meta). La reacción sale como la de WhatsApp
   (POST …/reaccion) y queda en el mensaje: datos.reac.yo la nuestra, datos.reac.cli la del cliente (entrantes.ts). */
const RR_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const RR_MAS_EMOJIS = ['🙌', '👏', '🔥', '🎉', '😍', '🤔', '😅', '👌', '✅', '💯', '🥳', '😡'];
const rrSvg = p => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
const RR_IC = {
  mas: '<svg class="i rr-pts" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
  resp: rrSvg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v4"/>'),
  copia: rrSvg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'),
  reenv: rrSvg('<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0-6 6v4"/>'),
  x: rrSvg('<path d="M6 6l12 12M18 6 6 18"/>'),
  sumar: rrSvg('<path d="M12 5v14M5 12h14"/>'),
};
let rrCita = null; // {conv, id}: el mensaje que se está respondiendo

const rrConv = () => CONV.find(x => x.id === st.sel);
const rrMsg = (c, id) => c && id ? c.msgs.find(m => m._id === id) : null;
/** Lo que dice un mensaje, en una línea: el texto, o qué es si es un archivo. */
function rrTexto(m){
  if (!m) return '';
  const x = m.in != null ? m.in : m.out;
  if (x && typeof x === 'object') return x.cap || (x.sticker ? 'Sticker' : x.img ? '📷 Foto' : x.video ? '🎥 Video' : x.doc ? '📄 ' + (x.n || 'Documento') : '🎤 Nota de voz');
  const t = String(x || '').trim();
  if (t) return t;
  return m.file ? '📄 ' + (m.file.n || 'Archivo') : m.audio ? '🎤 Nota de voz' : m.link ? '🔗 ' + (m.link.p || 'Enlace') : '';
}
const rrQuien = (c, m) => m.in != null ? (c.n || 'Cliente') : (m.by || yo) === yo ? 'Tú' : m.by;
const rrColor = (c, m) => m.in != null ? AVC[c.id % AVC.length] : '#8a6d00';
/** WhatsApp con el mensaje ya entregado a Meta: lo único que deja reaccionar. */
const rrReacciona = (c, m) => c.canal === 'wa' && m._id && m._estado !== 'fallido' && !(m.prog);

function rrCitaHTML(c, m){
  if (!m.cita) return '';
  const o = rrMsg(c, m.cita);
  const quien = o ? rrQuien(c, o) : 'Mensaje', t = o ? rrTexto(o) : 'Mensaje anterior';
  return `<button type="button" class="rr-cita" data-rr-ir="${esc(m.cita)}" style="--rr-c:${o ? rrColor(c, o) : '#94a3b8'}"><b>${esc(quien)}</b><span>${esc(t)}</span></button>`;
}
function rrReacHTML(c, m){
  const r = m.reac && typeof m.reac === 'object' ? m.reac : null; if (!r) return '';
  const pills = [];
  if (r.cli && r.cli === r.yo) pills.push(`<button type="button" class="rr-reac mia" data-rr-quitar="${esc(m._id)}" aria-label="Quitar tu reacción">${esc(r.yo)}<em>2</em></button>`);
  else {
    if (r.cli) pills.push(`<span class="rr-reac" title="${esc(c.n || 'El cliente')} reaccionó">${esc(r.cli)}</span>`);
    if (r.yo) pills.push(`<button type="button" class="rr-reac mia" data-rr-quitar="${esc(m._id)}" aria-label="Quitar tu reacción">${esc(r.yo)}</button>`);
  }
  return pills.length ? `<div class="rr-reacs">${pills.join('')}</div>` : '';
}
/**
 * Envuelve lo que pinta un mensaje: la cita adentro de la burbuja, la barra flotante y las reacciones debajo a la
 * izquierda. Barra flotante (maqueta aprobada «Mensajes rediseñados», dirección B, 24-oct): al pasar el mouse sale
 * encima del mensaje con 5 reacciones, Responder y Más (el menú de siempre); se reacciona con un clic.
 */
function rrEnvolver(m, html, lado){
  const c = rrConv(); if (!c || !m || !m._id) return html;
  const cita = rrCitaHTML(c, m);
  if (cita) html = /<div class="ch-b [^"]*">/.test(html) ? html.replace(/(<div class="ch-b [^"]*">)/, `$1${cita}`) : cita + html;
  const yoR = m.reac && m.reac.yo, id = esc(m._id);
  const emos = rrReacciona(c, m) ? ['👍', '❤️', '😂', '😮', '🙏'].map((e, i) => `<button type="button" class="rr-be${e === yoR ? ' on' : ''}" style="--i:${i}" data-rr-rapido="${e}" aria-label="Reaccionar ${e}">${e}</button>`).join('') + '<i class="rr-bsep"></i>' : '';
  const barra = `<div class="rr-bf" role="toolbar" aria-label="Acciones del mensaje">${emos}<button type="button" class="rr-be ic" style="--i:5" data-rr-resprapido aria-label="Responder">${RR_IC.resp}</button><button type="button" class="rr-be ic" style="--i:6" data-rr-menu="${id}" aria-label="Más opciones del mensaje" aria-haspopup="menu">${RR_IC.mas}</button></div>`;
  return `<div class="rr-m ${lado}" data-rr="${id}">${html}${barra}${rrReacHTML(c, m)}</div>`;
}
const rrInSin = chBloqueIn, rrOutSin = chBloqueOut;
chBloqueIn = function(c, m, ult){ return rrEnvolver(m, rrInSin.apply(this, arguments), 'in'); };
chBloqueOut = function(m, ult){ return rrEnvolver(m, rrOutSin.apply(this, arguments), 'out'); };

/* ── El menú del ⋯ ── */
const rrMenu = document.createElement('div');
rrMenu.className = 'rr-menu'; rrMenu.setAttribute('role', 'menu'); rrMenu.hidden = true;
document.body.appendChild(rrMenu);
let rrMenuDe = null, rrMenuBoton = null;
function rrCerrarMenu(){ if (rrMenu.hidden) return; rrMenu.hidden = true; rrMenu.classList.remove('mas'); if (rrMenuBoton) rrMenuBoton.setAttribute('aria-expanded', 'false'); rrMenuDe = rrMenuBoton = null; }
function rrAbrirMenu(boton, id, teclado){
  const c = rrConv(), m = rrMsg(c, id); if (!m) return;
  rrCerrarMenu();
  rrMenuDe = id; rrMenuBoton = boton; boton.setAttribute('aria-expanded', 'true');
  const yoR = m.reac && m.reac.yo, texto = rrTexto(m);
  const emo = rrReacciona(c, m) ? `<div class="rr-emo">${RR_EMOJIS.map(e => `<button type="button" role="menuitem" data-rr-emoji="${e}" class="${e === yoR ? 'on' : ''}" aria-label="Reaccionar ${e}">${e}</button>`).join('')}<button type="button" class="rr-emo-mas" data-rr-masemo aria-label="Más reacciones">${RR_IC.sumar}</button></div>
    <div class="rr-emo2">${RR_MAS_EMOJIS.map(e => `<button type="button" role="menuitem" data-rr-emoji="${e}" class="${e === yoR ? 'on' : ''}" aria-label="Reaccionar ${e}">${e}</button>`).join('')}</div>` : '';
  rrMenu.replaceChildren();
  rrMenu.insertAdjacentHTML('beforeend', `${emo}<button type="button" role="menuitem" data-rr-resp>${RR_IC.resp}Responder</button>${texto ? `<button type="button" role="menuitem" data-rr-copiar>${RR_IC.copia}Copiar</button>` : ''}${texto && typeof nmAbrir === 'function' ? `<button type="button" role="menuitem" data-rr-reenv>${RR_IC.reenv}Reenviar</button>` : ''}`);
  rrMenu.hidden = false;
  const r = boton.getBoundingClientRect(), w = rrMenu.offsetWidth, h = rrMenu.offsetHeight;
  const izq = boton.closest('.rr-m.out') ? r.left - w - 8 : r.right + 8;
  rrMenu.style.left = Math.max(8, Math.min(innerWidth - w - 8, izq)) + 'px';
  rrMenu.style.top = Math.max(8, Math.min(innerHeight - h - 8, r.top - 8)) + 'px';
  // Con teclado, el foco entra al menú; con el mouse no se marca nada.
  if (teclado) { const primero = rrMenu.querySelector('button'); if (primero) primero.focus({preventScroll: true}); }
}
function rrReaccionar(id, emoji){
  const c = rrConv(), m = rrMsg(c, id); if (!m) return;
  const antes = m.reac ? {...m.reac} : null;
  const nuevo = antes && antes.yo === emoji ? '' : emoji; // tocar la misma la quita
  m.reac = {...(antes || {})}; if (nuevo) m.reac.yo = nuevo; else delete m.reac.yo;
  chat();
  crmApi('POST', `/crm/conversaciones/${c.id}/mensajes/${encodeURIComponent(id)}/reaccion`, {emoji: nuevo})
    .then(r => { if (r && r.reac !== undefined) m.reac = r.reac; })
    .catch(err => { m.reac = antes; toast(err.message || 'No se pudo reaccionar'); })
    .finally(() => { if (st.sel === c.id) chat(); });
}

/* ── La cita arriba de donde se escribe ── */
const rrBarra = document.createElement('div');
rrBarra.className = 'rr-barra'; rrBarra.hidden = true;
document.getElementById('box').insertBefore(rrBarra, document.getElementById('ta'));
function rrPintarBarra(){
  const c = rrConv(), m = rrCita && c && rrCita.conv === c.id ? rrMsg(c, rrCita.id) : null;
  rrBarra.hidden = !m;
  if (!m) return;
  rrBarra.style.setProperty('--rr-c', rrColor(c, m));
  rrBarra.replaceChildren();
  rrBarra.insertAdjacentHTML('beforeend', `${RR_IC.resp}<div><b>Respondiendo a ${esc(rrQuien(c, m) === 'Tú' ? 'tu mensaje' : rrQuien(c, m))}</b><span>${esc(rrTexto(m))}</span></div><button type="button" class="rr-x" data-rr-quitarcita aria-label="Quitar la cita">${RR_IC.x}</button>`);
}
function rrResponder(id){
  const c = rrConv(); if (!c) return;
  rrCita = {conv: c.id, id}; rrPintarBarra();
  if (typeof setModo === 'function' && st.modo === 'n') setModo('r');
  ta.focus();
}
// Al enviar, el mensaje que acaba de entrar a la conversación lleva la cita (80-datos.js lo manda después).
let rrAntes = null;
document.getElementById('enviar').addEventListener('click', () => { const c = rrConv(); rrAntes = c && rrCita && rrCita.conv === c.id ? {c, n: c.msgs.length, id: rrCita.id} : null; }, true);
document.getElementById('enviar').addEventListener('click', () => {
  const a = rrAntes; rrAntes = null; if (!a) return;
  const nuevo = a.c.msgs.slice(a.n).find(m => m.out != null && !m._id);
  if (!nuevo) return;
  nuevo.cita = a.id; rrCita = null; rrPintarBarra(); chat();
});
// La barra sigue a la conversación abierta: se ve solo en la que se estaba respondiendo.
const rrChatSin = chat;
chat = function(){ const r = rrChatSin.apply(this, arguments); rrPintarBarra(); return r; };

/* ── Clics ── */
document.addEventListener('click', e => {
  const t = e.target;
  const ab = t.closest('[data-rr-menu]');
  if (ab) { e.preventDefault(); if (rrMenuDe === ab.dataset.rrMenu) rrCerrarMenu(); else rrAbrirMenu(ab, ab.dataset.rrMenu, e.detail === 0); return; }
  if (t.closest('.rr-menu')) {
    const id = rrMenuDe, c = rrConv(), m = rrMsg(c, id);
    if (t.closest('[data-rr-masemo]')) { rrMenu.classList.toggle('mas'); return; }
    const em = t.closest('[data-rr-emoji]');
    rrCerrarMenu();
    if (!m) return;
    if (em) rrReaccionar(id, em.dataset.rrEmoji);
    else if (t.closest('[data-rr-resp]')) rrResponder(id);
    else if (t.closest('[data-rr-copiar]')) navigator.clipboard.writeText(rrTexto(m)).then(() => toast('Mensaje copiado'), () => toast('No se pudo copiar'));
    else if (t.closest('[data-rr-reenv]')) { nmAbrir(); const x = document.getElementById('nm-txt'); if (x) x.value = rrTexto(m); toast('Elige a quién reenviarlo'); }
    return;
  }
  const rp = t.closest('[data-rr-rapido]');
  if (rp) { const w = rp.closest('.rr-m'); if (w) { rp.classList.add('elegido'); rrReaccionar(w.dataset.rr, rp.dataset.rrRapido); } return; }
  const rs = t.closest('[data-rr-resprapido]');
  if (rs) { const w = rs.closest('.rr-m'); if (w) rrResponder(w.dataset.rr); return; }
  const q = t.closest('[data-rr-quitar]');
  if (q) { const c = rrConv(), m = rrMsg(c, q.dataset.rrQuitar); if (m && m.reac && m.reac.yo) rrReaccionar(m._id, m.reac.yo); return; }
  if (t.closest('[data-rr-quitarcita]')) { rrCita = null; rrPintarBarra(); ta.focus(); return; }
  const ir = t.closest('[data-rr-ir]');
  if (ir) {
    // Si el chat está abierto en el panel del embudo, el mensaje que se busca es el de ahí.
    const sel = `.rr-m[data-rr="${CSS.escape(ir.dataset.rrIr)}"]`, el = ir.closest('#ec-msgs, #msgs') ? ir.closest('#ec-msgs, #msgs').querySelector(sel) : document.querySelector(sel);
    if (!el) { toast('Ese mensaje ya no está en lo que se ve del chat'); return; }
    el.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center'});
    el.classList.remove('rr-brilla'); void el.offsetWidth; el.classList.add('rr-brilla');
    return;
  }
  rrCerrarMenu();
});
// Mantener presionado en el celular (o clic derecho) abre el mismo menú.
['msgs', 'ec-msgs'].map(id => document.getElementById(id)).filter(Boolean).forEach(caja => caja.addEventListener('contextmenu', e => {
  const w = e.target.closest('.rr-m'); if (!w || e.target.closest('a,video,audio')) return;
  e.preventDefault(); rrAbrirMenu(w.querySelector('[data-rr-menu]'), w.dataset.rr);
}));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !rrMenu.hidden) { const b = rrMenuBoton; rrCerrarMenu(); if (b) b.focus(); e.stopPropagation(); }
  else if (e.key === 'Escape' && rrCita && document.activeElement === ta) { rrCita = null; rrPintarBarra(); }
}, true);
// Se cierra cuando la persona mueve el chat (rueda, dedo o la barra), no con el scroll que hace el CRM al repintar: cada
// aviso en tiempo real repinta el chat y devuelve la posición, y eso cerraba el menú apenas se abría (24-oct).
['msgs', 'ec-msgs'].map(id => document.getElementById(id)).filter(Boolean).forEach(caja => ['wheel', 'touchmove', 'pointerdown'].forEach(ev => caja.addEventListener(ev, e => { if (ev !== 'pointerdown' || e.target === caja) rrCerrarMenu(); }, {passive: true})));
// Si el chat se repinta con el menú abierto, el ⋯ nuevo de ese mensaje queda como el dueño del menú.
const rrChatMenu = chat;
chat = function(){ const r = rrChatMenu.apply(this, arguments); if (rrMenuDe) { const b = document.querySelector(`[data-rr-menu="${CSS.escape(rrMenuDe)}"]`); if (b) { rrMenuBoton = b; b.setAttribute('aria-expanded', 'true'); } } return r; };
addEventListener('resize', rrCerrarMenu);

document.head.insertAdjacentHTML('beforeend', `<style>
.rr-m{position:relative;display:flex;flex-direction:column;gap:3px;max-width:100%;min-width:0}
.rr-m.in{align-items:flex-start;align-self:flex-start}
.rr-m.out{align-items:flex-end;align-self:flex-end}
/* Barra flotante encima del mensaje (dirección B): aparece al pasar el mouse, los botones entran uno tras otro. */
.rr-bf{position:absolute;bottom:calc(100% + 6px);z-index:3;display:flex;align-items:center;gap:2px;padding:4px;border-radius:999px;background:#fff;border:1px solid #e5e9f0;box-shadow:0 12px 28px -14px rgba(15,23,42,.4);opacity:0;visibility:hidden;pointer-events:none;transform:translateY(6px) scale(.96);transition:opacity .2s cubic-bezier(.16,1,.3,1) .2s,transform .25s cubic-bezier(.16,1,.3,1) .2s,visibility 0s linear .45s}
.rr-m.in .rr-bf{left:0;transform-origin:bottom left}
.rr-m.out .rr-bf{right:0;transform-origin:bottom right}
/* Puente invisible entre el mensaje y la barra: al subir el cursor no se pierde el «encima». */
.rr-m::after{content:"";position:absolute;left:0;right:0;bottom:100%;height:8px}
.rr-m:hover .rr-bf,.rr-bf:focus-within,.rr-m:has([data-rr-menu][aria-expanded="true"]) .rr-bf{opacity:1;visibility:visible;pointer-events:auto;transform:none;transition-delay:0s}
.rr-be{width:30px;height:30px;border:0;border-radius:50%;background:none;display:grid;place-items:center;font-size:18px;line-height:1;padding:0;cursor:pointer;color:#4b5563;opacity:0;transform:translateY(5px) scale(.8);transition:opacity .2s cubic-bezier(.16,1,.3,1),transform .25s cubic-bezier(.16,1,.3,1),background .15s}
.rr-m:hover .rr-be,.rr-bf:focus-within .rr-be,.rr-m:has([data-rr-menu][aria-expanded="true"]) .rr-be{opacity:1;transform:none;transition-delay:calc(var(--i) * 35ms)}
.rr-be:hover{background:#f1f5f9;transform:scale(1.2) translateY(-2px)!important}
.rr-be.ic:hover{transform:none!important;color:#0b0b10}
.rr-be.on{background:#fff3b0}
.rr-be.elegido{transform:scale(.85)!important}
.rr-be svg{width:16px;height:16px}
.rr-be .rr-pts{fill:currentColor;stroke:none}
.rr-bsep{width:1px;height:18px;background:#e5e9f0;margin:0 2px}
.rr-cita{all:unset;box-sizing:border-box;display:grid;gap:1px;position:relative;margin-bottom:6px;padding:7px 10px 7px 14px;border-radius:10px;background:rgba(11,11,16,.06);font-size:13px;line-height:1.35;cursor:pointer;max-width:100%;min-width:0;white-space:normal}
.rr-cita::before{content:"";position:absolute;left:5px;top:7px;bottom:7px;width:3px;border-radius:2px;background:var(--rr-c)}
.rr-cita b{font-size:12.5px;font-weight:600;color:var(--rr-c)}
.rr-cita span{color:#4b5563;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rr-cita:hover{background:rgba(11,11,16,.09)}
.rr-cita:focus-visible{outline:2px solid #0b0b10;outline-offset:2px}
.ch-b.out .rr-cita{background:rgba(11,11,16,.07)}
.rr-reacs{display:flex;gap:4px;margin-top:-9px;padding:0 10px;z-index:1;align-self:flex-start}
.rr-reac{display:inline-flex;align-items:center;gap:3px;height:26px;padding:0 8px;border-radius:999px;background:#fff;border:1px solid #e5e9f0;font:inherit;font-size:14px;line-height:1;box-shadow:0 1px 3px rgba(15,23,42,.1);animation:rr-pop .32s cubic-bezier(.16,1,.3,1)}
button.rr-reac{cursor:pointer}
.rr-reac.mia{border-color:#FFD21F;background:#fffbe6}
.rr-reac em{font-style:normal;font-size:11.5px;color:#4b5563}
@keyframes rr-pop{from{transform:scale(.4);opacity:0}to{transform:none;opacity:1}}
.rr-m.rr-brilla > .ch-b,.rr-m.rr-brilla > .ch-img,.rr-m.rr-brilla > .ch-file{animation:rr-brilla 1.4s cubic-bezier(.16,1,.3,1)}
@keyframes rr-brilla{0%,35%{box-shadow:0 0 0 3px #FFD21F}100%{box-shadow:0 0 0 3px rgba(255,210,31,0)}}
.rr-menu{position:fixed;z-index:79;width:250px;background:#fff;border:1px solid #e5e9f0;border-radius:14px;padding:6px;box-shadow:0 18px 40px -16px rgba(15,23,42,.35);display:grid;gap:2px;animation:rr-entra .18s cubic-bezier(.16,1,.3,1);transform-origin:top center}
.rr-menu[hidden]{display:none}
@keyframes rr-entra{from{opacity:0;transform:translateY(-4px) scale(.97)}to{opacity:1;transform:none}}
.rr-emo,.rr-emo2{display:flex;align-items:center;justify-content:space-between;padding:4px 4px 8px;border-bottom:1px solid #eef1f5;margin-bottom:4px}
.rr-emo2{display:none;flex-wrap:wrap;justify-content:flex-start;gap:2px}
.rr-menu.mas .rr-emo2{display:flex}
.rr-emo button,.rr-emo2 button{width:32px;height:32px;border:0;border-radius:50%;background:none;font-size:19px;display:grid;place-items:center;cursor:pointer;padding:0;transition:transform .2s cubic-bezier(.16,1,.3,1),background .15s}
.rr-emo button:hover,.rr-emo2 button:hover{transform:scale(1.25)}
.rr-emo button.on,.rr-emo2 button.on{background:#fff3b0}
.rr-emo .rr-emo-mas{background:#f1f5f9;color:#4b5563}
.rr-emo-mas svg{width:15px;height:15px}
.rr-menu.mas .rr-emo-mas{background:#0b0b10;color:#fff}
.rr-menu > button{display:flex;align-items:center;gap:10px;padding:8px 10px;border:0;border-radius:8px;background:none;font:inherit;font-size:13.5px;color:#1f2937;text-align:left;cursor:pointer}
.rr-menu > button:hover,.rr-menu > button:focus-visible{background:#f6f7f9;outline:none}
.rr-menu > button svg{width:16px;height:16px;color:#6b7280}
.rr-barra{display:flex;align-items:center;gap:10px;position:relative;margin:8px 8px 0;padding:8px 10px 8px 16px;border-radius:10px;background:#f6f7f9;animation:rr-entra .2s cubic-bezier(.16,1,.3,1)}
.rr-barra[hidden]{display:none}
.rr-barra::before{content:"";position:absolute;left:6px;top:8px;bottom:8px;width:3px;border-radius:2px;background:var(--rr-c)}
.rr-barra > svg{width:16px;height:16px;color:#6b7280;flex:none}
.rr-barra div{flex:1;min-width:0;display:grid}
.rr-barra b{font-size:12.5px;font-weight:600;color:var(--rr-c)}
.rr-barra span{font-size:13px;color:#4b5563;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rr-x{width:28px;height:28px;border:0;border-radius:8px;background:none;display:grid;place-items:center;color:#dc2626;cursor:pointer;padding:0;flex:none}
.rr-x:hover{background:#fee2e2}
.rr-x svg{width:15px;height:15px}
@media (hover:none){.rr-bf{display:none}}
@media (prefers-reduced-motion:reduce){.rr-reac,.rr-menu,.rr-barra{animation:none}.rr-bf,.rr-be,.rr-emo button,.rr-emo2 button{transition:none}}
</style>`);
