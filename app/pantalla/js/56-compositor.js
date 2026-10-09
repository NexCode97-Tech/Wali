/* ── Menús del chat y respuestas rápidas con archivos (maqueta aprobada «CRM · menús del chat y respuestas con archivos», 29-sep):
   cada menú se abre junto a su botón, y las respuestas rápidas pueden llevar imágenes, PDF, videos y audios. ── */

/* Íconos de la maqueta (línea de 1,75), en SVG dentro de cada menú. */
const cmSvg = d => `<svg viewBox="0 0 24 24" class="cm-svg" aria-hidden="true">${d}</svg>`;
const CM_SVG = {
  buscar: cmSvg('<circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path>'),
  imagen: cmSvg('<rect x="3" y="4" width="18" height="16" rx="2"></rect><circle cx="9" cy="10" r="2"></circle><path d="m21 16-5-5-9 9"></path>'),
  doc: cmSvg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"></path><path d="M14 3v5h5"></path>'),
  play: cmSvg('<path d="m8 5 11 7-11 7Z"></path>'),
  mic: cmSvg('<rect x="9" y="3" width="6" height="11" rx="3"></rect><path d="M5 11a7 7 0 0 0 14 0"></path><path d="M12 18v3"></path>'),
  subir: cmSvg('<path d="M12 16V4"></path><path d="m7 9 5-5 5 5"></path><path d="M5 20h14"></path>'),
  x: cmSvg('<path d="M6 6l12 12"></path><path d="M18 6L6 18"></path>'),
  check: cmSvg('<path d="M5 12l5 5L20 7"></path>'),
};
// Cada tipo de archivo con su miniatura: fondo, color del ícono, nombre y cómo se cuenta cuando es uno solo.
const CM_TIPO = {
  imagen: {n:'Imagen', uno:'imagen', bg:'#fffde6', co:'#0b0b10', ic:CM_SVG.imagen},
  pdf: {n:'PDF', uno:'PDF', bg:'#fee2e2', co:'#b91c1c', ic:CM_SVG.doc},
  video: {n:'Video', uno:'video', bg:'#1f2937', co:'#ffffff', ic:CM_SVG.play},
  audio: {n:'Audio', uno:'audio', bg:'#f3e8ff', co:'#7e22ce', ic:CM_SVG.mic},
  otro: {n:'Archivo', uno:'archivo', bg:'#eef1f5', co:'#4b5563', ic:CM_SVG.doc},
};
function cmTipo(a){
  const m = String((a && a.mime) || '').toLowerCase(), n = String((a && a.n) || '').toLowerCase();
  if (/^image\//.test(m) || /\.(png|jpe?g|gif|webp)$/.test(n)) return 'imagen';
  if (/pdf/.test(m) || /\.pdf$/.test(n)) return 'pdf';
  if (/^video\//.test(m) || /\.(mp4|mov|3gp)$/.test(n)) return 'video';
  if (/^audio\//.test(m) || /\.(mp3|ogg|opus|m4a|aac|amr|wav)$/.test(n)) return 'audio';
  return 'otro';
}
// Los audios muestran su duración («Audio · 0:42», maqueta): se lee una vez de sus metadatos y se guarda en chDur
// (50-agentes.js, la misma de las notas de voz). Mientras llega, se ve el tamaño.
function cmDuracion(url){
  const d = chDur.get(url);
  if (d == null && !chDur.has(url)) {
    chDur.set(url, null); const a = new Audio(); a.preload = 'metadata'; a.src = url;
    a.addEventListener('loadedmetadata', () => { if (!isFinite(a.duration)) return; chDur.set(url, a.duration); document.querySelectorAll('small[data-cm-dur]').forEach(s => { if (s.dataset.cmDur === url) s.textContent = CM_TIPO.audio.n + ' · ' + chFmt(a.duration); }); });
  }
  return typeof d === 'number' ? d : null;
}
// «Imagen · 320 KB»: el peso en bytes si lo hay; si no, el tamaño que ya traía el material («Imagen · 320 KB»).
function cmEtiqueta(a){
  const k = cmTipo(a), dur = k === 'audio' && a.url ? cmDuracion(a.url) : null;
  if (dur != null) return CM_TIPO.audio.n + ' · ' + chFmt(dur);
  const tam = a.peso ? tamano(a.peso) : String(a.t || '').split(' · ').slice(1).join(' · ');
  return CM_TIPO[k].n + (tam ? ' · ' + tam : '');
}
// La línea «Tipo · tamaño» de cada fila; la de un audio se cambia por su duración cuando se conoce.
const cmEtiquetaHtml = a => `<small${cmTipo(a) === 'audio' && a.url ? ` data-cm-dur="${esc(a.url)}"` : ''}>${esc(cmEtiqueta(a))}</small>`;
// Lote 7 (tablero 6): el audio de una respuesta rápida sale como nota de voz.
const cmNotaDeVoz = a => cmTipo(a) === 'audio' && !a.subiendo ? `<span class="mj-etq">${I('mic')}Sale como nota de voz</span>` : '';
// Miniatura de un archivo: el ícono de su tipo sobre su color, como en la maqueta (también las imágenes).
function cmThumb(a, cls){
  const T = CM_TIPO[cmTipo(a)];
  return `<span class="${cls}" style="background:${T.bg};color:${T.co}">${T.ic}</span>`;
}
// Archivos de una respuesta rápida en su fila: miniaturas apiladas y «2 archivos» (o «1 video», «1 imagen»…).
function cmAdjuntos(A){
  A = Array.isArray(A) ? A.filter(a => a && a.url) : [];
  if (!A.length) return '';
  return `<span class="cm-ad"><span class="cm-mts">${A.slice(0, 3).map(a => cmThumb(a, 'cm-mt')).join('')}</span><small>${A.length === 1 ? '1 ' + CM_TIPO[cmTipo(A[0])].uno : A.length + ' archivos'}</small></span>`;
}

/* ── Cada menú junto a su botón: el borde de abajo 8 px encima de la barra, alineado con el botón y con la muesca que lo señala ── */
const CM_MENUS = [['qr', 'b-qr', 460, 'Respuestas rápidas'], ['matp', 'b-clip', 440, 'Material del equipo'], ['tplp', 'b-tpl', 440, 'Plantillas aprobadas'], ['lk', 'b-link', 460, 'Mis enlaces de pago'], ['progp', 'b-prog', 300, 'Enviar más tarde']];
const CM_ALTO = 440;
const cmCar = document.createElement('span'); cmCar.className = 'cm-car'; cmCar.hidden = true; cmCar.setAttribute('aria-hidden', 'true');
document.getElementById('comp').appendChild(cmCar);
function cmPosicionar(p){
  const m = CM_MENUS.find(x => x[0] === p.id); if (!m || p.hidden) return;
  const comp = document.getElementById('comp'), bar = document.querySelector('#box .bar'), b = document.getElementById(m[1]);
  const cR = comp.getBoundingClientRect(), rR = bar.getBoundingClientRect(), borde = p.classList.contains('cm-nuevo') ? 2 : 0;
  const hay = b && !b.hidden && b.offsetParent, tR = hay ? b.getBoundingClientRect() : rR;
  const w = Math.min(m[2], cR.width - 16 - borde), izq = Math.max(8, Math.min(tR.left - cR.left - 8, cR.width - w - borde - 8));
  const abajo = cR.bottom - rR.top + 8, techo = document.getElementById('msgs').getBoundingClientRect().top;
  Object.assign(p.style, {left: izq + 'px', right: 'auto', top: 'auto', width: w + 'px', bottom: abajo + 'px', maxHeight: Math.max(180, Math.min(CM_ALTO, rR.top - 16 - techo)) + 'px'});
  cmCar.hidden = !hay;
  if (hay) { cmCar.style.left = (tR.left + tR.width / 2 - cR.left - 6) + 'px'; cmCar.style.bottom = (abajo - 6) + 'px'; }
}
// El emoji también sale junto a su botón (su panel vive en el body, con posición fija).
function cmEmojiJunto(p, boton){
  const cR = document.getElementById('comp').getBoundingClientRect(), rR = document.querySelector('#box .bar').getBoundingClientRect(), tR = boton.getBoundingClientRect();
  const izq = Math.max(cR.left + 8, Math.min(tR.left - 8, cR.right - p.offsetWidth - 8));
  p.style.left = izq + 'px'; p.style.top = Math.max(8, rR.top - 8 - p.offsetHeight) + 'px';
  let car = p.querySelector('.cm-car'); if (!car) { car = document.createElement('span'); car.className = 'cm-car cm-car-e'; car.setAttribute('aria-hidden', 'true'); p.appendChild(car); }
  car.style.left = (tR.left + tR.width / 2 - izq - 1 - 6) + 'px';
}
const cmEmoBtn = () => document.querySelector('.box .bar [data-emo-abrir]');
const cmEmoAbierto = () => { const p = document.getElementById('emop'); return !!p && !p.hidden && p._campo === ta; };
// El botón del menú abierto queda marcado (fondo azul claro) y con aria-expanded. Mientras su menú está abierto, su
// ayuda (data-tip) descansa para no taparlo; al cerrarlo vuelve.
function cmMarcarBoton(b, on){
  b.classList.toggle('cm-on', on); b.setAttribute('aria-expanded', String(on));
  if (on && b.dataset.tip) { b.dataset.tipMenu = b.dataset.tip; b.removeAttribute('data-tip'); const t = document.querySelector('.tip'); if (t) t.hidden = true; }
  else if (!on && b.dataset.tipMenu) { b.dataset.tip = b.dataset.tipMenu; b.removeAttribute('data-tip-menu'); }
}
function cmMarcar(){
  for (const [id, bid] of CM_MENUS) cmMarcarBoton(document.getElementById(bid), !document.getElementById(id).hidden);
  const be = cmEmoBtn(); if (be) cmMarcarBoton(be, cmEmoAbierto());
  if (!CM_MENUS.some(([id]) => !document.getElementById(id).hidden)) cmCar.hidden = true;
}
// Uno abierto a la vez: el que se abre cierra los demás. Los menús se abren desde muchos lados (botones, «/», atajos,
// el panel), así que se mira el atributo hidden de cada uno en vez de tocar cada manejador.
const cmObs = new MutationObserver(recs => {
  let nuevo = null;
  for (const r of recs) if (!r.target.hidden) nuevo = r.target;
  if (nuevo) {
    for (const [id] of CM_MENUS) { const p = document.getElementById(id); if (p !== nuevo && !p.hidden) p.hidden = true; }
    const emo = document.getElementById('emop'); if (emo && emo !== nuevo && cmEmoAbierto()) emo.hidden = true;
    if (nuevo.id !== 'emop') cmPosicionar(nuevo);
  }
  cmMarcar();
});
for (const [id, bid, , nombre] of CM_MENUS) {
  const p = document.getElementById(id), b = document.getElementById(bid);
  // Los tres de la maqueta cambian de forma entera; enlaces de pago y programar conservan su contenido.
  if (['qr', 'matp', 'tplp'].includes(id)) p.className = 'cm-pop cm-nuevo'; else p.classList.add('cm-pop');
  p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', nombre);
  b.setAttribute('aria-haspopup', 'dialog'); b.setAttribute('aria-controls', id); b.setAttribute('aria-expanded', 'false');
  cmObs.observe(p, {attributes: true, attributeFilter: ['hidden']});
}
{ const be = cmEmoBtn(); if (be) { be.setAttribute('aria-haspopup', 'dialog'); be.setAttribute('aria-expanded', 'false'); } }
const abrirEmojisCm = abrirEmojis;
abrirEmojis = function(boton, campo){
  abrirEmojisCm(boton, campo);
  const p = document.getElementById('emop'); if (!p) return;
  if (!p._cmObs) { p._cmObs = true; cmObs.observe(p, {attributes: true, attributeFilter: ['hidden']}); }
  const junto = campo === ta && !p.hidden; p.classList.toggle('cm-junto', junto);
  // La primera vez el observador todavía no miraba el emoji: los demás menús se cierran aquí.
  if (junto) { for (const [id] of CM_MENUS) document.getElementById(id).hidden = true; p._cmBoton = boton; cmEmojiJunto(p, boton); }
  cmMarcar();
};
// Se cierran con Escape (y con clic afuera, como ya hacían); si el foco estaba en el menú, vuelve al mensaje.
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const abiertos = CM_MENUS.map(([id]) => document.getElementById(id)).filter(p => !p.hidden), emo = cmEmoAbierto();
  if (!abiertos.length && !emo) return;
  const dentro = abiertos.some(p => p.contains(document.activeElement));
  abiertos.forEach(p => { p.hidden = true; }); if (emo) document.getElementById('emop').hidden = true;
  if (dentro) ta.focus();
});
// Tocar otro botón de la barra cierra el menú abierto aunque ese botón no abra nada (programar sin texto, nota de
// voz): cada botón frena su clic y el «clic afuera» de cada menú no alcanza a verlo.
document.addEventListener('click', e => {
  const b = e.target.closest('#box .bar button'); if (!b) return;
  for (const [id, bid] of CM_MENUS) { const p = document.getElementById(id); if (!p.hidden && bid !== b.id) p.hidden = true; }
  if (cmEmoAbierto() && !b.matches('[data-emo-abrir]')) document.getElementById('emop').hidden = true;
}, true);
addEventListener('resize', () => {
  const p = CM_MENUS.map(([id]) => document.getElementById(id)).find(x => !x.hidden); if (p) cmPosicionar(p);
  if (cmEmoAbierto()) { const emo = document.getElementById('emop'); if (emo._cmBoton) cmEmojiJunto(emo, emo._cmBoton); }
});
// Flechas y Enter dentro del buscador de cada menú.
function cmMoverSel(p, d){
  const L = [...p.querySelectorAll('.cm-it')]; if (!L.length) return;
  const i = L.findIndex(x => x.classList.contains('cm-sel')), n = Math.max(0, Math.min(L.length - 1, i + d));
  L.forEach((x, k) => x.classList.toggle('cm-sel', k === n)); L[n].scrollIntoView({block: 'nearest'});
}
for (const id of ['qr', 'matp', 'tplp']) document.getElementById(id).addEventListener('keydown', e => {
  if (e.target.tagName !== 'INPUT' || e.isComposing) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); cmMoverSel(e.currentTarget, e.key === 'ArrowDown' ? 1 : -1); }
  else if (e.key === 'Enter') { e.preventDefault(); const b = e.currentTarget.querySelector('.cm-it.cm-sel'); if (b) b.click(); }
});
// El mouse también mueve la fila elegida: siempre queda una sola marcada, la misma que elige Enter.
for (const id of ['qr', 'matp', 'tplp']) document.getElementById(id).addEventListener('mousemove', e => {
  const it = e.target.closest('.cm-it'); if (!it || it.classList.contains('cm-sel')) return;
  e.currentTarget.querySelectorAll('.cm-it.cm-sel').forEach(x => x.classList.remove('cm-sel')); it.classList.add('cm-sel');
});
const cmVacio = t => `<p class="cm-vacio">${t}</p>`;
const cmBuscador = (id, ph, v, cls = '') => `<label class="cm-q${cls}">${CM_SVG.buscar}<input id="${id}" value="${esc(v || '')}" placeholder="${ph}" aria-label="${ph}" autocomplete="off"></label>`;

/* ── Material del equipo (tablero 1): elegir envía el material y «Subir desde el computador» sigue igual (manejador de #matp en 10-nucleo.js) ── */
function cmMatLista(f){
  const q = norm(f || ''), L = MATERIAL.map((m, i) => [m, i]).filter(([m]) => !q || norm(m.n).includes(q));
  if (!L.length) return cmVacio(MATERIAL.length ? 'Nada coincide.' : 'Todavía no hay material del equipo. El líder lo agrega en Ajustes del CRM, Archivos.');
  return `<div class="cm-lst">${L.map(([m, i], k) => { const a = {n: m.n, url: m.url, mime: m.mime, peso: m.bytes, t: m.t};
    return `<button type="button" class="cm-it cm-mi${k ? '' : ' cm-sel'}" data-mat="${i}">${cmThumb(a, 'cm-th')}<span class="cm-tx"><span>${esc(m.n)}</span>${cmEtiquetaHtml(a)}</span></button>`; }).join('')}</div>`;
}
document.getElementById('b-clip').addEventListener('click', () => {
  const p = document.getElementById('matp'); if (p.hidden) return;
  p.innerHTML = `<div class="cm-ph"><b>Material del equipo</b></div>${cmBuscador('cm-mat-q', 'Buscar material')}<div class="cm-scroll" id="cm-mat-l">${cmMatLista('')}</div>
    <div class="cm-pf"><button type="button" class="cm-up" data-mat="pc">${CM_SVG.subir}Subir desde el computador</button><small>Imágenes, PDF, videos y audios</small></div>`;
  document.getElementById('cm-mat-q').focus();
});
document.getElementById('matp').addEventListener('input', e => { if (e.target.id === 'cm-mat-q') document.getElementById('cm-mat-l').innerHTML = cmMatLista(e.target.value); });

/* ── Plantillas aprobadas (tablero 3): al elegir una pasa lo mismo que antes (manejador de #tplp en 10-nucleo.js) ── */
function cmTplLista(f){
  const ok = PLANTILLAS.filter(x => x.e === 'ok'), q = norm(f || ''), L = ok.filter(x => !q || norm(`${x.n} ${x.c || ''} ${x.b || ''}`).includes(q));
  if (!L.length) return cmVacio(ok.length ? 'Nada coincide.' : 'Todavía no hay plantillas aprobadas por Meta.');
  const med = {imagen: CM_SVG.imagen, video: CM_SVG.play, documento: CM_SVG.doc};
  return `<div class="cm-lst">${L.map((x, k) => `<button type="button" class="cm-it cm-tpi${k ? '' : ' cm-sel'}" data-usar-tpl="${esc(x.n)}"><span class="r1"><b>${esc(x.n)}</b>${x.c ? `<span class="cat">${esc(x.c)}</span>` : ''}</span><span class="pv">${esc(x.b || '')}</span>${med[x.media] ? `<span class="med">${med[x.media]}Con ${x.media}</span>` : ''}</button>`).join('')}</div>`;
}
document.getElementById('b-tpl').addEventListener('click', () => {
  const p = document.getElementById('tplp'); if (p.hidden) return;
  p.innerHTML = `<div class="cm-ph"><b>Plantillas aprobadas</b></div>${cmBuscador('cm-tpl-q', 'Buscar plantilla')}<div class="cm-scroll" id="cm-tpl-l">${cmTplLista('')}</div>`;
  document.getElementById('cm-tpl-q').focus();
});
document.getElementById('tplp').addEventListener('input', e => { if (e.target.id === 'cm-tpl-q') document.getElementById('cm-tpl-l').innerHTML = cmTplLista(e.target.value); });

/* ── Respuestas rápidas (tablero 2): «Tuyas» (Mis ajustes) y «Del equipo»; el buscador trae lo escrito después de / ── */
function cmQrLista(f){
  const q = norm(f || '').trim(), si = r => !q || norm(`${r.t} ${r.x}`).includes(q);
  // Cada fila lleva su atajo (m: tuyas, e: del equipo): si la lista cambia en vivo con el menú abierto, igual entra la que se ve.
  const mias = (AJ.qr || []).filter(si).map(r => [r, 'm:' + r.t]), eq = QR.filter(si).map(r => [r, 'e:' + r.t]);
  if (!mias.length && !eq.length) return cmVacio((AJ.qr || []).length + QR.length ? 'Nada coincide.' : 'Todavía no hay respuestas rápidas. Crea las tuyas en Mis ajustes; las del equipo las crea el líder.');
  // Queda marcada la primera cuyo atajo empieza por lo escrito («/prec» marca /precio-g, como la maqueta); si ninguna, la primera.
  const todas = [...mias, ...eq], marcada = todas.find(([r]) => norm(r.t).startsWith(q)) || todas[0];
  const fila = x => `<button type="button" class="cm-it cm-qri${x === marcada ? ' cm-sel' : ''}" data-qrs="${esc(x[1])}"><span class="cm-tx"><b>/${esc(x[0].t)}</b><span>${esc(x[0].x)}</span></span>${cmAdjuntos(x[0].archivos)}</button>`;
  return (mias.length ? `<div class="cm-gr">Tuyas</div><div class="cm-lst">${mias.map(fila).join('')}</div>` : '') + (eq.length ? `<div class="cm-gr">Del equipo</div><div class="cm-lst">${eq.map(fila).join('')}</div>` : '');
}
abrirQR = function(f){
  qr.innerHTML = `<div class="cm-ph"><b>Respuestas rápidas</b></div>${cmBuscador('cm-qr-q', 'Buscar respuesta', f, ' q4')}<div class="cm-scroll" id="cm-qr-l">${cmQrLista(f)}</div>`;
  qr.hidden = false; cmPosicionar(qr);
};
// Abierto con el botón, se escribe en su buscador; abierto con /, el foco se queda en el mensaje.
document.getElementById('b-qr').addEventListener('click', () => { if (!qr.hidden) document.getElementById('cm-qr-q').focus(); });
qr.addEventListener('input', e => { if (e.target.id === 'cm-qr-q') document.getElementById('cm-qr-l').innerHTML = cmQrLista(e.target.value); });
qr.addEventListener('click', e => {
  const b = e.target.closest('[data-qrs]'); if (!b) return;
  const k = b.dataset.qrs, t = k.slice(2), r = (k[0] === 'm' ? AJ.qr || [] : QR).find(x => x.t === t); if (r) cmUsarQR(r);
});
// Mientras se escribe /atajo: flechas para moverse y Enter para elegir.
ta.addEventListener('keydown', e => {
  if (qr.hidden || e.isComposing || e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { if (!qr.querySelector('.cm-it')) return; e.preventDefault(); cmMoverSel(qr, e.key === 'ArrowDown' ? 1 : -1); }
  else if (e.key === 'Enter' && !e.shiftKey) { const b = qr.querySelector('.cm-it.cm-sel'); if (b) { e.preventDefault(); b.click(); } }
});
// El texto reemplaza el /atajo que se estaba escribiendo; los archivos quedan como tarjetas en el cuadro del mensaje.
function cmUsarQR(r){
  const m = ta.value.match(/(^|\s)\/[^\s]*$/), antes = m ? ta.value.slice(0, m.index + m[1].length) : ta.value;
  ta.value = antes + (antes && !/\s$/.test(antes) ? ' ' : '') + r.x;
  qr.hidden = true;
  if (Array.isArray(r.archivos)) cmAgregarArchivos(r.archivos.map(a => ({...a, rq: r.t})));
  ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
}

/* ── Archivos listos en el cuadro del mensaje (tablero 4): salen después del texto al tocar Enviar ── */
st.cmArch = null;   // {conv, archivos: [{n, url, mime, peso}]}: son de la conversación abierta
const cmArchEl = document.createElement('div'); cmArchEl.className = 'cm-arch'; cmArchEl.id = 'cm-arch'; cmArchEl.hidden = true; cmArchEl.setAttribute('aria-label', 'Archivos que se envían con el mensaje');
ta.before(cmArchEl);
const cmArchivos = () => st.cmArch && st.cmArch.conv === st.sel ? st.cmArch.archivos : [];
function cmAgregarArchivos(A){
  const c = conv(); if (!c) return;
  if (!st.cmArch || st.cmArch.conv !== c.id) st.cmArch = {conv: c.id, archivos: []};
  for (const a of A) if (a && a.url && !st.cmArch.archivos.some(x => x.url === a.url)) st.cmArch.archivos.push({n: a.n, url: a.url, mime: a.mime, peso: a.peso, ...(a.rq ? {rq: a.rq} : {})});
  cmPintarArch();
}
function cmPintarArch(){
  const A = cmArchivos(), firma = A.map(a => a.url).join('|');
  document.getElementById('box').classList.toggle('cm-con', !!A.length);
  cmArchEl.hidden = !A.length;
  if (cmArchEl._firma === firma) return; cmArchEl._firma = firma;
  cmArchEl.innerHTML = A.map((a, i) => `<span class="cm-fc">${cmThumb(a, 'cm-th')}<span class="cm-tx"><span>${esc(a.n)}</span>${cmEtiquetaHtml(a)}</span><button type="button" class="cm-x" data-cm-quitar="${i}" aria-label="Quitar ${esc(a.n)}">${CM_SVG.x}</button></span>`).join('');
}
cmArchEl.addEventListener('click', e => { const b = e.target.closest('[data-cm-quitar]'); if (!b || !st.cmArch) return; st.cmArch.archivos.splice(+b.dataset.cmQuitar, 1); cmPintarArch(); ta.focus(); });
// Al cambiar de conversación se quitan, como el enlace de pago.
const chatCm = chat;
chat = function(){ chatCm(); if (st.cmArch && st.cmArch.conv !== st.sel) st.cmArch = null; cmPintarArch(); };
// Con texto, cada archivo recuerda ese mensaje (_tras, no se guarda): si el texto no sale, los archivos tampoco (80-datos.js).
function cmEnviarArchivos(c, A, tras){
  for (const a of A) { const k = cmTipo(a);
    // Lote 7: un audio sale como nota de voz (igual que una grabada), con el atajo de la respuesta rápida si vino de una.
    if (k === 'audio') { c.msgs.push({out: '', audio: {url: a.url, ...(a.mime ? {mime: a.mime} : {})}, by: yo, h: 'ahora', ...(a.rq ? {rq: a.rq} : {}), ...(tras ? {_tras: tras} : {})}); continue; }
    c.msgs.push({out: '', file: {n: a.n, t: cmEtiqueta(a), ic: k === 'video' ? 'play' : k === 'audio' ? 'mic' : 'file', url: a.url, mime: a.mime}, by: yo, h: 'ahora', ...(tras ? {_tras: tras} : {})}); }
  st.cmArch = null; cmPintarArch(); chat(); lista();
}
// Antes del envío de 10-nucleo.js (en la captura, desde el cuadro): con la ventana cerrada los archivos no salen,
// y sin texto salen solos. En nota privada no se tocan: se quedan para cuando se responda.
let cmEnvio = null;
document.getElementById('box').addEventListener('click', e => {
  if (!e.target.closest('#enviar')) return;
  cmEnvio = null;
  const A = cmArchivos(), c = conv(); if (!A.length || !c || st.modo === 'n') return;
  if (/cerrada/i.test(c.ventana)) { e.stopImmediatePropagation(); toast(st.tplUsada || st.adj ? 'Con la ventana de 24 h cerrada los archivos no salen: quítalos para enviar el mensaje' : cerradaTxt(c)); return; }
  if (!ta.value.trim()) { e.stopImmediatePropagation(); cmEnviarArchivos(c, A); return; }
  cmEnvio = {c, n: c.msgs.length, A: [...A]};
}, true);
// Después: si el texto salió, siguen los archivos en orden.
document.getElementById('enviar').addEventListener('click', () => { const x = cmEnvio; cmEnvio = null; if (x && x.c.msgs.length > x.n) cmEnviarArchivos(x.c, x.A, x.c.msgs[x.n]); });
// «Enviar más tarde» (programar de 10-nucleo.js) con archivos en el cuadro: el programado los lleva (archivos) y a la hora
// el servidor manda el texto y luego cada uno, solo si el texto salió (soltarProgramado). Cancelarlo cancela todo junto.
const programarCm = programar;
programar = function(c, texto, para){
  const A = c && st.cmArch && st.cmArch.conv === c.id ? st.cmArch.archivos.map(a => ({n: a.n, url: a.url, mime: a.mime, peso: a.peso})) : [], n = c ? c.msgs.length : 0;
  const ok = programarCm(c, texto, para), m = ok && A.length ? c.msgs[n] : null;
  if (m && m.prog) { m.archivos = A; st.cmArch = null; cmPintarArch(); chat(); }
  return ok;
};
// En la burbuja del programado, sus archivos con las mismas tarjetas del cuadro del mensaje (tablero 4).
const burbujaCm = burbuja;
burbuja = function(m){
  const h = burbujaCm(m), A = m && m.prog && Array.isArray(m.archivos) ? m.archivos.filter(a => a && a.url) : [];
  const k = A.length ? h.lastIndexOf('<div class="ft">') : -1; if (k < 0) return h;
  return h.slice(0, k) + `<div class="cm-arch">${A.map(a => `<a class="cm-fc" href="${esc(a.url)}" target="_blank" rel="noopener">${cmThumb(a, 'cm-th')}<span class="cm-tx"><span>${esc(a.n)}</span>${cmEtiquetaHtml(a)}</span></a>`).join('')}</div>` + h.slice(k);
};

/* ── Respuesta rápida con archivos (tablero 5): nueva o editar, del equipo (Ajustes del CRM) o propia (Mis ajustes) ── */
function qdAbrir(donde, i){
  const L = donde === 'equipo' ? QR : (AJ.qr = AJ.qr || []), r = i == null ? null : L[i]; if (i != null && !r) return;
  st.qdDlg = {donde, orig: r, t0: r ? r.t : '', archivos: r && Array.isArray(r.archivos) ? r.archivos.filter(a => a && a.url).map(a => ({n: a.n, url: a.url, mime: a.mime, peso: a.peso})) : []};
  abrirDialogo(`<div class="qd-cab"><h3>${r ? 'Editar respuesta rápida' : 'Nueva respuesta rápida'}</h3><span>${donde === 'equipo' ? 'Del equipo · la usan todos escribiendo / en el chat' : 'Tuya · solo tú la usas escribiendo / en el chat'}</span></div>
    <label class="qd-lab">Atajo<span class="qd-pref"><span>/</span><input id="qd-t" value="${esc(r ? r.t : '')}" placeholder="precio-g" aria-label="Atajo" autocomplete="off" maxlength="40"></span></label>
    <label class="qd-lab">Texto<textarea id="qd-x">${esc(r ? r.x : '')}</textarea></label>
    <div class="qd-ar"><span class="qd-rot">Archivos</span><div class="qd-fl" id="qd-fl">${qdFilas()}</div>
      <button type="button" class="qd-drop" data-qd-agregar="1"><span class="ic">${CM_SVG.subir}</span><span><b>Agregar archivos</b><small>Imágenes, PDF, videos y audios. También puedes arrastrarlos aquí.</small></span></button></div>
    <div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" data-qd-guardar="1">${CM_SVG.check}Guardar</button></div>`, 'dlg-qr');
  setTimeout(() => { const t = document.getElementById('qd-t'); if (t) t.focus(); }, 30);
}
function qdFilas(){
  const d = st.qdDlg; if (!d) return '';
  return d.archivos.map((a, i) => `<div class="qd-fc">${cmThumb(a, 'cm-th')}<span class="cm-tx"><span>${esc(a.n)}</span>${a.subiendo ? '<small>Subiendo…</small>' : cmEtiquetaHtml(a)}</span>${cmNotaDeVoz(a)}<button type="button" class="qd-x" data-qd-quitar="${i}" aria-label="Quitar ${esc(a.n)}"${a.subiendo ? ' disabled' : ''}>${CM_SVG.x}</button></div>`).join('');
}
function qdPintar(){ const el = document.getElementById('qd-fl'); if (el && st.qdDlg) el.innerHTML = qdFilas(); }
// Se suben con el mismo POST /crm/archivos del clip y de Ajustes › Archivos (tope de 25 MB).
const qdAbierto = () => !!st.qdDlg && !document.getElementById('ov-x').hidden && !!document.querySelector('#dlg-x.dlg-qr');
function qdSubir(files){
  const d = st.qdDlg; if (!d || !qdAbierto()) return;
  for (const f of files) {
    if (!/^(image|video|audio)\//.test(f.type || '') && !/pdf/.test(f.type || '')) { toast(`${f.name}: solo se aceptan imágenes, PDF, videos y audios`); continue; }
    if (f.size > 25 * 1024 * 1024) { toast(`${f.name}: pasa de 25 MB`); continue; }
    const a = {n: f.name, mime: f.type, peso: f.size, subiendo: true}; d.archivos.push(a);
    crmSubir(f).then(r => { Object.assign(a, {n: r.n || f.name, url: r.url, mime: r.mime || f.type, peso: r.bytes || f.size}); delete a.subiendo; },
      err => { const k = d.archivos.indexOf(a); if (k >= 0) d.archivos.splice(k, 1); toast(`${f.name}: no se pudo subir. ${err.message}`); })
      .finally(() => { if (st.qdDlg === d) qdPintar(); });
  }
  qdPintar();
}
function cmElegirArchivos(cb){
  const i = document.createElement('input'); i.type = 'file'; i.multiple = true; i.accept = 'image/*,video/*,audio/*,application/pdf'; i.hidden = true; document.body.appendChild(i);
  i.addEventListener('change', () => { const fs = [...(i.files || [])]; i.remove(); if (fs.length) cb(fs); });
  i.addEventListener('cancel', () => i.remove());
  i.click();
}
// La lista donde vive la respuesta y su lugar en ella (si llegó un cambio de afuera, se busca por el atajo con que se abrió).
const qdLista = d => d.donde === 'equipo' ? QR : (AJ.qr = AJ.qr || []);
const qdIndice = d => { const L = qdLista(d); if (!d.orig) return -1; const k = L.indexOf(d.orig); return k >= 0 ? k : L.findIndex(y => y.t === d.t0); };
const cmOvx = document.getElementById('ov-x');
cmOvx.addEventListener('click', e => {
  const d = st.qdDlg; if (!d || !e.target.closest('.dlg-qr')) return;
  if (e.target.closest('[data-qd-agregar]')) { cmElegirArchivos(qdSubir); return; }
  const q = e.target.closest('[data-qd-quitar]'); if (q) { d.archivos.splice(+q.dataset.qdQuitar, 1); qdPintar(); return; }
  if (!e.target.closest('[data-qd-guardar]')) return;
  const t = document.getElementById('qd-t').value.trim().replace(/^\/+/, '').replace(/\s+/g, '-'), x = document.getElementById('qd-x').value.trim();
  if (!t || !x) { toast('Escribe el atajo y el texto'); document.getElementById(t ? 'qd-x' : 'qd-t').focus(); return; }
  if (d.archivos.some(a => a.subiendo)) { toast('Espera a que terminen de subir los archivos'); return; }
  const L = qdLista(d), k = qdIndice(d);
  if (L.some((y, j) => j !== k && String(y.t).toLowerCase() === t.toLowerCase())) { toast(`Ya hay una respuesta con /${t}`); document.getElementById('qd-t').focus(); return; }
  const r = {...(k >= 0 ? L[k] : {}), t, x}, archivos = d.archivos.map(a => ({n: a.n, url: a.url, mime: a.mime, peso: a.peso}));
  if (archivos.length) r.archivos = archivos; else delete r.archivos;
  if (k >= 0) L[k] = r; else if (d.donde === 'equipo') L.unshift(r); else L.push(r);
  st.qdDlg = null; cerrarDialogo(); render(); toast(k >= 0 ? `Guardada /${t}` : `Agregada /${t}`);
});
// Arrastrar archivos al diálogo (soltarlos en el fondo oscuro también vale: así el navegador no abre el archivo encima del CRM).
const qdZona = () => document.querySelector('#dlg-x.dlg-qr .qd-drop');
cmOvx.addEventListener('dragover', e => { if (!qdAbierto()) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; const z = qdZona(); if (z) z.classList.add('sobre'); });
cmOvx.addEventListener('dragleave', e => { if (!qdAbierto() || (e.relatedTarget && cmOvx.contains(e.relatedTarget))) return; const z = qdZona(); if (z) z.classList.remove('sobre'); });
cmOvx.addEventListener('drop', e => { if (!qdAbierto()) return; e.preventDefault(); const z = qdZona(); if (z) z.classList.remove('sobre'); const fs = [...((e.dataTransfer && e.dataTransfer.files) || [])]; if (fs.length) qdSubir(fs); });
document.getElementById('page').addEventListener('click', e => {
  const n = e.target.closest('[data-qd-nueva]'); if (n) { qdAbrir(n.dataset.qdNueva, null); return; }
  const ed = e.target.closest('[data-qd-editar]'); if (ed) { const [d, i] = ed.dataset.qdEditar.split(':'); qdAbrir(d, +i); }
});
// Mis ajustes › Mis respuestas rápidas (la sección la arma 10-nucleo.js): cada fila abre el diálogo para editarla.
function qrMisAjustes(){
  return `<div class="qd-l">${(AJ.qr || []).map((q, i) => `<div class="qd-row"><button type="button" class="qd-ed" data-qd-editar="mias:${i}"><b>/${esc(q.t)}</b><span class="qd-rx">${esc(q.x)}</span>${cmAdjuntos(q.archivos)}</button><button type="button" class="qd-del" data-aj-qr-del="${i}" aria-label="Borrar /${esc(q.t)}">${I('x')}</button></div>`).join('')}</div>
    <div><button type="button" class="btn" data-qd-nueva="mias">${I('plus')}Nueva respuesta rápida</button></div>`;
}
// Ajustes del CRM › Respuestas rápidas del equipo: igual que antes, con «Nueva» y cada fila abriendo el diálogo.
const paginaCfgCm = paginaCfg;
paginaCfg = function(k){ return k === 'qr' ? paginaQrEquipo() : paginaCfgCm(k); };
function paginaQrEquipo(){
  const q = norm(st.qrq || ''), L = QR.map((x, i) => [x, i]).filter(([x]) => !q || norm(x.t + ' ' + x.x).includes(q));
  return `<div class="ajw ancho"><button type="button" class="volver" data-ir="ajustes-crm">${I('back')}Ajustes del CRM</button><h2>Respuestas rápidas del equipo</h2><p class="sub">Las usa todo el equipo escribiendo / en el chat.</p>
    <div class="cfg"><div class="box2"><div style="display:flex;gap:8px"><input id="cfg-qrq" value="${esc(st.qrq || '')}" placeholder="Buscar por atajo o texto"><button type="button" class="btn pri" data-qd-nueva="equipo">${I('plus')}Nueva</button></div>
      ${L.map(([x, i]) => `<div class="row2" style="border-top:1px solid var(--line2);padding-top:8px"><button type="button" class="qd-ed2" data-qd-editar="equipo:${i}"><span class="t"><b style="font-weight:600">/${esc(x.t)}</b><small>${esc(x.x)}</small></span>${cmAdjuntos(x.archivos)}</button><button type="button" class="btn ic" data-cfg-qrdel="${i}" aria-label="Borrar /${esc(x.t)}">${I('x')}</button></div>`).join('') || `<p class="muted">${QR.length ? 'Nada coincide.' : 'Todavía no hay respuestas del equipo. Crea la primera con «Nueva».'}</p>`}</div></div></div>`;
}

document.head.insertAdjacentHTML('beforeend', `<style>
.cm-svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round;flex:none}
/* Menús junto a su botón (tableros 1, 2 y 3) */
.comp .cm-pop{position:absolute;right:auto;background:#fff;border:1px solid #e5e9f0;border-radius:14px;box-shadow:0 20px 44px -16px rgba(15,23,42,.35);z-index:30}
.comp .cm-pop.cm-nuevo{box-sizing:content-box;display:flex;flex-direction:column;overflow:hidden;padding:0;gap:0}
.cm-car{position:absolute;box-sizing:content-box;width:12px;height:12px;background:#fff;border-right:1px solid #e5e9f0;border-bottom:1px solid #e5e9f0;transform:rotate(45deg);z-index:31;pointer-events:none}
.emop .cm-car-e{bottom:-7px;z-index:1}
.emop.cm-junto{border-radius:14px;border-color:#e5e9f0;box-shadow:0 20px 44px -16px rgba(15,23,42,.35)}
.box .bar button.t.cm-on,.box .bar button.t.cm-on:hover{background:#fffde6;color:#0b0b10}
.cm-ph{display:flex;align-items:center;gap:10px;padding:12px 14px 8px;flex:none}
.cm-ph b{font-size:13px;font-weight:600;flex-grow:1;color:#1f2937}
.cm-q{display:flex;align-items:center;gap:8px;box-sizing:content-box;height:36px;margin:0 12px 6px;padding:0 10px;border:1px solid #e5e9f0;border-radius:9px;color:#9ca3af;flex:none;cursor:text}
.cm-q.q4{margin-bottom:4px}
.cm-q svg{width:15px;height:15px}
.cm-q input{border:0;outline:none;flex-grow:1;min-width:0;font:inherit;font-size:13px;color:#1f2937;background:transparent;padding:0}
.cm-scroll{flex:1 1 auto;min-height:0;overflow-y:auto}
.cm-gr{font-size:11.5px;font-weight:600;color:#6b7280;padding:8px 14px 4px}
.cm-lst{display:flex;flex-direction:column;gap:2px;padding:0 6px 6px}
.cm-it{display:flex;align-items:center;gap:12px;padding:8px;border:0;border-radius:10px;background:none;text-align:left;width:100%;font-weight:400}
.cm-it.cm-sel{background:#f3f6fa}
.cm-th{width:40px;height:40px;border-radius:8px;flex:none;display:grid;place-items:center}
.cm-th svg{width:18px;height:18px}
.cm-tx{display:flex;flex-direction:column;min-width:0;flex-grow:1}
.cm-tx span{font-size:13px;color:#1f2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cm-tx small{font-size:11.5px;color:#6b7280}
.cm-pf{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:10px 14px;border-top:1px solid #eef1f5;background:#f8fafc;flex:none}
.cm-up{height:34px;padding:0 12px;border:1px solid #e5e9f0;border-radius:9px;background:#fff;font-size:13px;font-weight:500;color:#1f2937;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;flex:none}
.cm-up svg{width:15px;height:15px}
/* La nota entra en la misma fila a 440 px como en la maqueta (se mete 8 px en el relleno); si el menú es más angosto, baja entera a otra fila */
.cm-pf small{font-size:11.5px;color:#6b7280;white-space:nowrap;margin-right:-8px}
.cm-vacio{margin:0;padding:6px 14px 14px;font-size:13px;color:#6b7280}
.cm-qri{padding:8px 10px}
.cm-qri .cm-tx b{font-size:13px;font-weight:500;color:#0b0b10}
.cm-qri .cm-tx span{font-size:12.5px;color:#4b5563}
.cm-ad{display:flex;align-items:center;gap:6px;flex:none}
.cm-mts{display:flex}
.cm-mt{box-sizing:content-box;width:26px;height:26px;border-radius:6px;display:grid;place-items:center;border:2px solid #fff;margin-left:-8px}
.cm-mt:first-child{margin-left:0}
.cm-mt svg{width:13px;height:13px}
.cm-ad small{font-size:11.5px;color:#6b7280;white-space:nowrap}
.cm-tpi{flex-direction:column;align-items:stretch;gap:3px;padding:9px 10px}
.cm-tpi .r1{display:flex;align-items:center;gap:8px}
.cm-tpi .r1 b{font-size:13px;font-weight:500;color:#1f2937;flex-grow:1}
.cm-tpi .cat{font-size:11px;font-weight:500;border-radius:999px;padding:1px 8px;background:#eef1f5;color:#4b5563}
.cm-tpi .pv{font-size:12.5px;color:#4b5563;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.cm-tpi .med{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;color:#6b7280}
.cm-tpi .med svg{width:13px;height:13px}
/* Archivos dentro del cuadro del mensaje (tablero 4) */
.box.cm-con:not(.nt){border-color:#0b0b10;box-shadow:0 0 0 3px #fffde6}
.box.cm-con textarea{padding-top:10px;line-height:1.45}
.cm-arch{display:flex;flex-wrap:wrap;gap:8px;padding:10px 12px 0}
.cm-fc{display:flex;align-items:center;gap:10px;padding:6px;border:1px solid #e5e9f0;border-radius:10px;background:#fff;width:230px;max-width:100%}
.cm-fc .cm-tx span{font-size:12.5px}
.cm-fc .cm-tx small{font-size:11px}
.cm-x{width:26px;height:26px;border:0;border-radius:7px;background:none;color:#6b7280;display:grid;place-items:center;flex:none;padding:0}
.cm-x:hover{background:#f3f6fa;color:#1f2937}
.cm-x svg,.qd-x svg{width:13px;height:13px;stroke-width:2.2}
/* Las mismas tarjetas dentro de la burbuja de un mensaje programado */
.m.prog .cm-arch{padding:8px 0 2px}
.m.prog .cm-fc{color:inherit;text-decoration:none;white-space:normal}
/* Diálogo «Nueva respuesta rápida» (tablero 5) */
.dlg.dlg-qr{width:560px;max-width:calc(100vw - 32px);padding:24px 24px 0;gap:16px;box-shadow:0 30px 60px -20px rgba(15,23,42,.45)}
.dlg.dlg-qr .dlg-cerrar{top:21px;right:21px}
.dlg.dlg-qr .dlg-cerrar svg{width:18px;height:18px}
.qd-cab{display:flex;flex-direction:column;gap:2px;padding-right:36px}
.dlg.dlg-qr .qd-cab h3{margin:0;font-size:20px;font-weight:600;letter-spacing:0;padding-right:0}
.qd-cab span{font-size:13px;color:#6b7280}
.qd-lab{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600;color:#374151}
.qd-pref{display:flex;align-items:center;box-sizing:content-box;height:42px;border:1px solid #e5e9f0;border-radius:10px;overflow:hidden}
.qd-pref:focus-within,.qd-lab textarea:focus{border-color:#0b0b10;box-shadow:0 0 0 3px #fffde6}
.qd-pref > span{padding:0 10px;height:100%;display:grid;place-items:center;background:#f8fafc;border-right:1px solid #e5e9f0;color:#6b7280;font-weight:500;font-size:14px}
.qd-pref input{border:0;outline:none;flex-grow:1;min-width:0;height:100%;padding:0 12px;font:inherit;font-size:14px;font-weight:400;color:#1f2937;background:#fff}
.qd-lab textarea{height:92px;border:1px solid #e5e9f0;border-radius:10px;padding:10px 12px;font:inherit;font-size:14px;font-weight:400;line-height:1.45;color:#1f2937;resize:none;outline:none;width:100%}
.qd-ar{display:flex;flex-direction:column;gap:8px}
.qd-rot{font-size:13px;font-weight:600;color:#374151}
.qd-fl{display:flex;flex-direction:column;gap:8px}
.qd-fl:empty{display:none}
.qd-fc{display:flex;align-items:center;gap:12px;padding:8px;border:1px solid #e5e9f0;border-radius:12px;background:#fff}
.qd-fc .cm-th{width:44px;height:44px;border-radius:9px}
.qd-fc .cm-th svg{width:20px;height:20px}
.qd-x{width:30px;height:30px;border:1px solid #e5e9f0;border-radius:8px;background:#fff;color:#6b7280;display:grid;place-items:center;flex:none;padding:0}
.qd-x:hover{color:#1f2937}
.qd-x:disabled{opacity:.5;cursor:default}
.qd-drop{display:flex;align-items:center;gap:12px;padding:14px;border:1.5px dashed #cbd5e1;border-radius:12px;background:#f8fafc;cursor:pointer;text-align:left;width:100%}
.qd-drop.sobre{border-color:#0b0b10;background:#fffde6}
.qd-drop .ic{box-sizing:content-box;width:40px;height:40px;border-radius:10px;background:#fff;border:1px solid #e5e9f0;display:grid;place-items:center;color:#0b0b10;flex:none}
.qd-drop .ic svg{width:18px;height:18px}
.qd-drop b{display:block;font-size:13px;font-weight:500;color:#1f2937}
.qd-drop small{display:block;font-size:12px;color:#6b7280}
.dlg.dlg-qr .ft2{margin:2px -24px 0;padding:14px 24px}
.dlg.dlg-qr .ft2 .btn{height:40px;padding:0 16px;gap:6px;border-radius:10px;font-size:13.5px;font-weight:500;color:#1f2937;box-shadow:none}
.dlg.dlg-qr .ft2 .btn.pri{color:#fff}
.dlg.dlg-qr .ft2 .btn svg{width:16px;height:16px}
/* Listas de respuestas rápidas en Mis ajustes y en Ajustes del CRM: cada fila se abre para editarla */
.qd-l{display:grid;gap:6px}
.qd-row{display:flex;align-items:center;gap:10px;border:1px solid var(--line2);border-radius:9px;padding:8px 10px;font-size:12.5px}
.qd-row:hover{background:#f8fafc}
.qd-ed{flex:1;min-width:0;display:flex;align-items:center;gap:10px;text-align:left}
.qd-ed b{font-weight:600;white-space:nowrap}
.qd-rx{flex:1;min-width:0;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qd-del{color:var(--ink4);width:26px;height:26px;border-radius:6px;display:grid;place-items:center;flex:none}
.qd-del:hover{background:var(--hover);color:var(--ink)}
.qd-ed2{flex:1;min-width:0;display:flex;align-items:center;gap:12px;text-align:left}
.qd-ed2 .t{flex:1;min-width:0}
</style>`);
