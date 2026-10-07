/* ── Contactos (maqueta aprobada el 6-oct) ──
   Vistas a la izquierda (Contactos, Etapas, Segmentos con «+ Nuevo», Otros); filtros en pastillas y búsqueda en una
   sola fila con «Columnas»; tabla con avatar, etapa, asesor, canal, etiquetas y último mensaje; menú «⋯» flotante por
   fila; barra flotante abajo al elegir contactos; y el modal «Nuevo segmento» con las condiciones como mapa (igual que
   Reglas automáticas): «Todas a la vez / Al menos una», el «+» del mapa abre los tipos de condición y a la derecha la
   vista previa en vivo. Usa los mismos data-ct-* de 10-nucleo.js, así que asignar, cambiar etapa, exportar,
   importar, abrir la conversación y demás siguen pasando por allá. */

// Campos de las condiciones de un segmento: clave, nombre, ícono y sus valores [valor, texto].
const CK_CAMPOS = [
  ['etapa', 'Etapa', 'flow', () => [...etapasActivas(), ...etapasPerdidas()].map(e => [e, e])],
  ['asig', 'Asesor', 'user', () => [['Sin asignar', 'Sin asignar'], ...ASESORES.map(a => [a, a])]],
  ['canal', 'Canal', 'chat', () => Object.keys(CANALES).map(k => [k, CANALES[k].n])],
  ['tag', 'Etiqueta', 'tag', () => ETIQS.map(([n]) => [n, n])],
  ['origen', 'Origen', 'ad', () => ['Anuncio', 'Enlace de venta de un asesor', 'Chat de la web', 'Correo', 'Otro'].map(v => [v, v])],
  ['producto', 'Producto', 'cart', () => [...CATALOGO.map(x => x.p), ...FALTANTES].map(p => [p, p])],
  ['ultimo', 'Último mensaje', 'clock', () => [['menos7', 'hace menos de 7 días'], ['mas30', 'hace más de 30 días']]],
];
const ckCampo = k => CK_CAMPOS.find(x => x[0] === k) || CK_CAMPOS[0];
const ckTexto = (k, v) => ((ckCampo(k)[3]().find(o => o[0] === v) || [])[1]) || v;
const CK_PILLS = ['etapa', 'asig', 'canal', 'tag', 'origen'];
const CK_ICONOS = ['star', 'flame', 'users', 'tag', 'cart', 'ad', 'bolt', 'clock'];
const CK_COLORES = ['#FFD21F', '#0b0b10', '#3b82f6', '#22c55e', '#f97316', '#a855f7'];
const CK_COLS = [['etapa', 'Etapa'], ['asig', 'Asesor'], ['canal', 'Canal'], ['tags', 'Etiquetas'], ['ultimo', 'Último mensaje'], ['producto', 'Producto'], ['empresa', 'Empresa'], ['ciudad', 'Ciudad'], ['origen', 'Origen'], ['agregado', 'Agregado']];
st.ct.cols = new Set(['etapa', 'asig', 'canal', 'tags', 'ultimo']);
st.ckPill = null; st.ckBulk = null; st.ckSeg = null;

function ckCumple(c, [k, op, v]){
  let si;
  if (k === 'etapa') si = c.etapa === v;
  else if (k === 'asig') si = v === 'Sin asignar' ? !c.asig : c.asig === v;
  else if (k === 'canal') si = c.canal === v;
  else if (k === 'tag') si = (c.tags || []).includes(v);
  else if (k === 'origen') si = origenDe(c) === v;
  else if (k === 'producto') si = c.producto === v;
  else if (k === 'ultimo') si = v === 'menos7' ? c.ultimoDias <= 7 : c.ultimoDias > 30;
  else si = true;
  return op === 'no es' ? !si : si;
}
const ckPasa = (c, s) => !s.reglas.length || (s.modo === 'alguna' ? s.reglas.some(r => ckCumple(c, r)) : s.reglas.every(r => ckCumple(c, r)));
// Los segmentos con condiciones llevan su función (no se guarda: no es enumerable), así ctVisibles y las difusiones
// los filtran igual que los de fábrica.
function ckSegFunciones(){
  (st.ct.propios || []).forEach(s => { if (Array.isArray(s.reglas) && !Object.prototype.hasOwnProperty.call(s, 'f')) Object.defineProperty(s, 'f', {value: c => ckPasa(c, s), enumerable: false, configurable: true}); });
}
const ckRenderBase = render;
render = function(){ ckSegFunciones(); return ckRenderBase.apply(this, arguments); };

const ckCerrarFlotantes = () => document.querySelectorAll('.ck-flmenu').forEach(m => m.remove());

paginaContactos = function(){
  ckSegFunciones(); ckCerrarFlotantes();
  const el = document.getElementById('page'), ct = st.ct;
  const todos = ctTodos(), L = ctVisibles();
  const cuentaV = f => todos.filter(c => !c.spam && f(c)).length;
  const base = c => c.guardado !== false && !c.noContactar;
  const v = (id, ic, t, n, extra = '', borrar = '') => `<div class="ck-vw"><button type="button" class="ck-v" aria-current="${ct.vista === id}" data-ctv="${esc(id)}">${extra || I(ic)}<span class="t">${esc(t)}</span><span class="n">${n}</span></button>${borrar}</div>`;
  const nuevos = SEGMENTOS.find(s => s.id === 'nuevos');
  const vistas = `<nav class="ck-vistas" aria-label="Vistas de contactos">
    <h5>Contactos</h5>${v('todos', 'users', 'Todos', cuentaV(base))}${v('sinagregar', 'user-plus', 'Sin agregar', cuentaV(c => c.guardado === false))}${nuevos ? v('seg:nuevos', 'clock', nuevos.n, cuentaV(c => base(c) && nuevos.f(c))) : ''}
    <h5>Etapas</h5>${[...etapasActivas(), ...etapasPerdidas()].map(e => v('etapa:' + e, '', e, cuentaV(c => c.etapa === e && !c.noContactar), `<span class="dot" style="background:${COL[e]}"></span>`)).join('')}
    <h5>Segmentos <button type="button" data-ck-seg="1">${I('plus')}Nuevo</button></h5>
    ${SEGMENTOS.filter(s => s.id !== 'nuevos').map(s => v('seg:' + s.id, 'filter', s.n, cuentaV(c => base(c) && s.f(c)))).join('')}
    ${ct.propios.map(s => v('seg:' + s.id, s.ic || 'star', s.n, cuentaV(c => base(c) && (s.f ? s.f(c) : pasaFiltros(c, s.filtros || {}))), s.col ? `<span class="ck-sic" style="background:${esc(s.col)};color:${s.col === '#0b0b10' ? '#fff' : '#0b0b10'}">${I(s.ic || 'star')}</span>` : '', `<button type="button" class="ck-vx" data-ct-segdel="${esc(s.id)}" aria-label="Borrar el segmento ${esc(s.n)}">${I('x')}</button>`)).join('')}
    <h5>Otros</h5>${v('nocontactar', 'block', 'No contactar', cuentaV(c => c.noContactar))}${v('spam', 'shield-x', 'Spam', todos.filter(c => c.spam).length)}</nav>`;
  const titulo = ct.vista === 'todos' ? 'Todos los contactos' : ct.vista === 'sinagregar' ? 'Leads sin agregar' : ct.vista === 'nocontactar' ? 'No contactar' : ct.vista === 'spam' ? 'Spam' : ct.vista.startsWith('etapa:') ? ct.vista.slice(6) : (segDe(ct.vista.slice(4)) || {n: 'Contactos'}).n;
  const sinAsesor = L.filter(c => !c.asig).length;
  const pills = CK_PILLS.map(k => { const val = ct.f[k], n = ckCampo(k)[1];
    return val ? `<span class="ck-pill on"><button type="button" data-ck-pill="${k}">${esc(n)}: <b>${esc(etiquetaFiltro(k, val))}</b></button><button type="button" class="q" data-ct-quitar="${k}" aria-label="Quitar el filtro ${esc(n)}">${I('x')}</button></span>`
      : `<button type="button" class="ck-pill" data-ck-pill="${k}" aria-haspopup="menu" aria-expanded="${st.ckPill === k}">${esc(n)}${I('chev')}</button>`; }).join('');
  const col = k => ct.cols.has(k);
  const flecha = k => ct.orden.k === k ? `<span class="ord">${ct.orden.dir === 1 ? '▲' : '▼'}</span>` : '';
  const todosSel = L.length > 0 && L.every(c => ct.sel.has(c.id));
  const nSel = [...ct.sel].filter(id => todos.some(c => c.id === id)).length;
  const gris = '<span class="ck-gris">—</span>';
  const filas = L.map(c => { const sel = ct.sel.has(c.id), can = CANALES[c.canal] || {n: c.canal, ic: 'chat'};
    return `<tr data-ct-fila="${c.id}" class="${sel ? 'ck-on' : ''}"><td class="cb"><input type="checkbox" class="ck-chk" data-ct-sel="${c.id}" ${sel ? 'checked' : ''} aria-label="Elegir a ${esc(c.n)}"></td>
      <td><div class="ck-per"><span class="av" style="background:${colorPersona(c.n)}">${esc(ini(c.n))}</span><span><b>${esc(c.n)}</b><small>${esc(c.tel || c.correo || '')}${c.guardado === false ? ' · sin agregar' : ''}</small></span></div></td>
      ${col('etapa') ? `<td><span class="ck-et"><i style="background:${COL[c.etapa] || '#9ca3af'}"></i>${esc(c.etapa || '')}</span></td>` : ''}
      ${col('asig') ? `<td>${c.asig ? `<span class="ck-as"><span class="av" style="background:${colorPersona(c.asig)}">${esc(ini(c.asig))}</span>${esc(c.asig)}</span>` : '<span class="ck-as sin">Sin asignar</span>'}</td>` : ''}
      ${col('canal') ? `<td class="ck-can" title="${esc(can.n)}">${I(can.ic, 'i ' + c.canal)}</td>` : ''}
      ${col('tags') ? `<td><div class="ck-tags">${(c.tags || []).map(t => `<span class="ck-tag"><i style="background:${ETIQ_COL[t] || '#9ca3af'}"></i>${esc(t)}</span>`).join('') || gris}</div></td>` : ''}
      ${col('ultimo') ? `<td class="ck-ult">${esc(ctFecha(c.ultimoDias))}</td>` : ''}
      ${col('producto') ? `<td>${c.producto ? esc(c.producto) : gris}</td>` : ''}
      ${col('empresa') ? `<td>${c.empresa ? esc(c.empresa) : gris}</td>` : ''}
      ${col('ciudad') ? `<td>${c.ciudad ? esc(c.ciudad) : gris}</td>` : ''}
      ${col('origen') ? `<td>${esc(origenDe(c))}</td>` : ''}
      ${col('agregado') ? `<td class="ck-ult">${esc(ctFecha(c.agregadoDias))}</td>` : ''}
      <td class="ac"><button type="button" class="ck-mas" data-ck-menu="${c.id}" aria-label="Más opciones de ${esc(c.n)}" aria-haspopup="menu">${I('more')}</button></td></tr>`; }).join('');
  const nf = Object.values(ct.f).filter(Boolean).length;
  const vacio = `<tr><td colspan="14" class="ck-vacio"><b>Nadie coincide</b><span>${nf || ct.q.trim() ? 'Prueba quitando algún filtro o cambiando la búsqueda.' : 'Todavía no hay personas en esta lista.'}</span>${nf ? '<button type="button" class="btn" data-ct-quitar="todo">Quitar filtros</button>' : ''}</td></tr>`;
  const orden = {n: 'nombre', ultimo: 'último mensaje', agregado: 'fecha en que se agregó'}[ct.orden.k] || 'último mensaje';
  const bulkMenu = k => st.ckBulk !== k ? '' : `<div class="ck-fmenu" role="menu">${(k === 'asig' ? ASESORES.map(a => [`data-ctb-asig="${esc(a)}"`, a]) : k === 'etapa' ? [...etapasActivas(), ...etapasPerdidas()].map(e => [`data-ctb-etapa="${esc(e)}"`, e]) : ETIQS.map(([n]) => [`data-ctb-tag="${esc(n)}"`, n])).map(([a, t]) => `<button type="button" role="menuitem" ${a}>${esc(t)}</button>`).join('') || '<p>No hay opciones.</p>'}</div>`;
  el.replaceChildren();
  el.insertAdjacentHTML('beforeend', `<div class="ck">${vistas}<div class="ck-main">
    <div class="ck-top"><div class="t"><h2>${esc(titulo)}</h2><p>${L.length} ${L.length === 1 ? 'persona' : 'personas'}${sinAsesor ? ` · ${sinAsesor} sin asesor` : ''}</p></div>
      <div class="acc">${puedeConfigurarCrm() ? `<button type="button" class="btn" data-ct-acc="importar">${I('file')}Importar</button>` : ''}<button type="button" class="btn" data-ct-acc="exportar">${I('share')}Exportar</button><button type="button" class="btn pri" id="ct-nuevo">${I('plus')}Agregar contacto</button><div id="ct-mas" hidden></div></div></div>
    <div class="ck-caja"><div class="ck-bar"><label class="search">${I('search')}<input id="ct-q" type="search" placeholder="Buscar por nombre, teléfono, correo o ciudad" value="${esc(ct.q)}" autocomplete="off"></label>${pills}<span class="ck-sp"></span>
      <div class="dd" style="position:relative"><button type="button" class="btn" id="ct-cols-b" aria-haspopup="menu">${I('kanban')}Columnas</button>
        <div class="menu" id="ct-cols" hidden><div class="hd">Columnas que se ven</div>${CK_COLS.map(([k, n]) => `<button type="button" data-ct-col="${k}" role="menuitemcheckbox" aria-checked="${col(k)}"><span class="chk ${col(k) ? 'on' : ''}">${col(k) ? I('check') : ''}</span>${n}</button>`).join('')}</div></div></div>
      <div class="ck-tw"><table class="ck-tb"><thead><tr><th class="cb"><input type="checkbox" class="ck-chk" data-ct-todos="1" ${todosSel ? 'checked' : ''} aria-label="Elegir todos"></th>
        <th><button type="button" data-ct-ord="n">Contacto ${flecha('n')}</button></th>${col('etapa') ? '<th>Etapa</th>' : ''}${col('asig') ? '<th>Asesor</th>' : ''}${col('canal') ? '<th>Canal</th>' : ''}${col('tags') ? '<th>Etiquetas</th>' : ''}${col('ultimo') ? `<th><button type="button" data-ct-ord="ultimo">Último mensaje ${flecha('ultimo')}</button></th>` : ''}${col('producto') ? '<th>Producto</th>' : ''}${col('empresa') ? '<th>Empresa</th>' : ''}${col('ciudad') ? '<th>Ciudad</th>' : ''}${col('origen') ? '<th>Origen</th>' : ''}${col('agregado') ? `<th><button type="button" data-ct-ord="agregado">Agregado ${flecha('agregado')}</button></th>` : ''}<th class="ac"></th></tr></thead>
        <tbody>${filas || vacio}</tbody></table></div>
      <div class="ck-pie"><span>${L.length} ${L.length === 1 ? 'contacto' : 'contactos'}</span><span>Ordenado por ${orden}</span></div></div>
  </div></div>
  ${nSel ? `<div class="ck-flota" role="toolbar" aria-label="Acciones con la selección"><b>${nSel} ${nSel === 1 ? 'seleccionado' : 'seleccionados'}</b>
    <span class="ck-fw"><button type="button" data-ck-bulk="asig" aria-expanded="${st.ckBulk === 'asig'}">${I('user')}Asignar</button>${bulkMenu('asig')}</span>
    <span class="ck-fw"><button type="button" data-ck-bulk="etapa" aria-expanded="${st.ckBulk === 'etapa'}">${I('flow')}Cambiar etapa</button>${bulkMenu('etapa')}</span>
    <span class="ck-fw"><button type="button" data-ck-bulk="tag" aria-expanded="${st.ckBulk === 'tag'}">${I('tag')}Etiqueta</button>${bulkMenu('tag')}</span>
    <button type="button" data-ct-acc="difusion">${I('megaphone')}Difusión</button><button type="button" data-ct-acc="exportar-sel">${I('share')}Exportar</button>
    <button type="button" class="x" data-ct-acc="limpiar-sel" aria-label="Quitar la selección">${I('x')}</button></div>` : ''}`);
};

/* Menús flotantes: las opciones de una pastilla de filtro y el «⋯» de cada fila (van en el body para no quedar tapados). */
function ckFlotante(boton, html){
  ckCerrarFlotantes();
  const r = boton.getBoundingClientRect();
  document.body.insertAdjacentHTML('beforeend', `<div class="ck-flmenu" role="menu">${html}</div>`);
  const m = document.querySelector('.ck-flmenu'), h = m.offsetHeight, w = m.offsetWidth;
  m.style.left = Math.max(8, Math.min(innerWidth - w - 8, boton.dataset.ckMenu ? r.right - w : r.left)) + 'px';
  m.style.top = (r.bottom + 6 + h > innerHeight ? Math.max(8, r.top - h - 6) : r.bottom + 6) + 'px';
}
document.addEventListener('click', e => {
  if (st.pagina !== 'contactos') return;
  const t = e.target instanceof Element ? e.target : null; if (!t) return;
  const ct = st.ct, dentro = t.closest('.ck-flmenu');
  if (!dentro && !t.closest('[data-ck-pill],[data-ck-menu]')) ckCerrarFlotantes();
  if (st.ckBulk && !t.closest('.ck-fw')) { st.ckBulk = null; if (!t.closest('[data-ct-sel],[data-ct-todos],[data-ct-acc]')) { e.stopPropagation(); render(); return; } }
  const pi = t.closest('[data-ck-pill]');
  if (pi) {
    e.stopPropagation();
    const k = pi.dataset.ckPill; if (st.ckPill === k && document.querySelector('.ck-flmenu')) { st.ckPill = null; ckCerrarFlotantes(); return; }
    st.ckPill = k;
    ckFlotante(pi, `<small>${esc(ckCampo(k)[1])}</small>${(CT_FILTROS.find(x => x[0] === k) || [0, 0, () => []])[2]().map(val => `<button type="button" role="menuitemradio" aria-checked="${ct.f[k] === val}" data-ck-f="${esc(k)}::${esc(val)}">${esc(etiquetaFiltro(k, val))}${ct.f[k] === val ? I('check') : ''}</button>`).join('') || '<p>No hay opciones todavía.</p>'}`);
    return;
  }
  const mb = t.closest('[data-ck-menu]');
  if (mb) {
    e.stopPropagation();
    const id = +mb.dataset.ckMenu, c = ctTodos().find(x => x.id === id); if (!c) return;
    ckFlotante(mb, `${c.conv ? `<button type="button" data-ck-acc="abrir" data-id="${id}">${I('chat')}Abrir conversación</button>` : `<button type="button" data-ck-acc="escribir" data-id="${id}">${I('wa')}Escribir por WhatsApp</button>`}
      <button type="button" data-ck-acc="ficha" data-id="${id}">${I('user')}Ver ficha</button>
      ${c.guardado === false ? `<button type="button" data-ck-acc="agregar" data-id="${id}">${I('user-plus')}Agregar a contactos</button>` : ''}<hr>
      ${c.spam ? `<button type="button" data-ck-acc="nospam" data-id="${id}">${I('shield-x')}Sacar de spam</button>` : `<button type="button" class="${c.noContactar ? '' : 'peligro'}" data-ck-acc="nocont" data-id="${id}">${I('block')}${c.noContactar ? 'Quitar de no contactar' : 'Marcar no contactar'}</button>`}`);
    return;
  }
  const f = t.closest('[data-ck-f]');
  if (f) { const [k, val] = f.dataset.ckF.split('::'); ct.f[k] = val; ct.sel.clear(); st.ckPill = null; ckCerrarFlotantes(); render(); return; }
  const a = t.closest('[data-ck-acc]');
  if (a) {
    const id = +a.dataset.id; ckCerrarFlotantes();
    if (a.dataset.ckAcc === 'abrir') ctAbrirConv(id);
    else if (a.dataset.ckAcc === 'escribir') ctEscribir(id);
    else if (a.dataset.ckAcc === 'ficha') ctFicha(id);
    else if (a.dataset.ckAcc === 'agregar') { ctCambiar(id, x => { x.guardado = true; }); render(); toast('Agregado a contactos'); }
    else if (a.dataset.ckAcc === 'nospam') mjSacarDeSpam(id);
    else if (a.dataset.ckAcc === 'nocont') { let ahora; ctCambiar(id, x => { x.noContactar = !x.noContactar; ahora = x.noContactar; }); render(); toast(ahora ? 'Marcado como no contactar: no le llegan difusiones ni recordatorios' : 'Ya se le puede volver a escribir'); }
    return;
  }
  const bk = t.closest('[data-ck-bulk]');
  if (bk) { e.stopPropagation(); st.ckBulk = st.ckBulk === bk.dataset.ckBulk ? null : bk.dataset.ckBulk; render(); return; }
  if (t.closest('[data-ctb-asig],[data-ctb-etapa],[data-ctb-tag]')) st.ckBulk = null;
  if (t.closest('[data-ck-seg]')) { e.stopPropagation(); ckSegNuevo(); return; }
}, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.querySelector('.ck-flmenu')) { ckCerrarFlotantes(); st.ckPill = null; } });
window.addEventListener('resize', ckCerrarFlotantes);
document.addEventListener('scroll', e => { if (document.querySelector('.ck-flmenu') && !(e.target instanceof Element && e.target.closest('.ck-flmenu'))) ckCerrarFlotantes(); }, true);

/* ── Modal «Nuevo segmento» ── */
function ckSegNuevo(){
  st.ckSeg = {n: '', ic: 'star', col: '#FFD21F', modo: 'todas', reglas: [['etapa', 'es', (etapasActivas()[0] || '')]], mas: false};
  ckSegPintar();
}
function ckSegDialogo(){
  const d = st.ckSeg, oscuro = d.col === '#0b0b10';
  const nodo = (r, i) => `<div class="sgm-nodo"><span class="mm-ic si">${I(ckCampo(r[0])[2])}</span><div class="cpos">${ddSel('data-sg-campo', CK_CAMPOS.map(([k, n]) => [i + '|' + k, n]), i + '|' + r[0])}${ddSel('data-sg-op', [[i + '|es', 'es'], [i + '|no es', 'no es']], i + '|' + r[1])}${ddSel('data-sg-val', ckCampo(r[0])[3]().map(([v, t]) => [i + '|' + v, t]), i + '|' + r[2], 'Elige')}</div><button type="button" class="x" data-sg-quitar="${i}" aria-label="Quitar la condición">${I('x')}</button></div>`;
  const une = d.modo === 'todas' ? 'Y' : 'O';
  const entran = ctTodos().filter(c => !c.spam && c.guardado !== false && !c.noContactar && ckPasa(c, d));
  const mapa = `<div class="sgm"><div class="sgm-ini"><span class="mm-ic cuando">${I('users')}</span><span><small>Empieza con</small><b>Todos los contactos</b></span></div>
    ${d.reglas.map((r, i) => `<div class="mm-linea"></div>${i ? `<span class="sgm-une">${une}</span><div class="mm-linea"></div>` : ''}${nodo(r, i)}`).join('')}
    <div class="mm-linea"></div><div class="sgm-mas-w"><button type="button" class="mm-mas" data-sg-abrir="1" aria-label="Agregar una condición" aria-expanded="${!!d.mas}">${I('plus')}</button>${d.mas ? `<div class="sgm-menu" role="menu"><small>Agregar condición</small>${CK_CAMPOS.map(([k, n, ic]) => `<button type="button" role="menuitem" data-sg-atajo="${k}">${I(ic)}${esc(n)}</button>`).join('')}</div>` : ''}</div><div class="mm-linea"></div>
    <div class="sgm-fin"><span class="mm-ic ent">${I(d.ic)}</span><span><small>Entran al segmento</small><b>${entran.length} ${entran.length === 1 ? 'contacto' : 'contactos'} hoy</b></span></div></div>`;
  const frase = d.reglas.filter(r => r[2]).map(r => `${ckCampo(r[0])[1].toLowerCase()} ${r[1]} <b>${esc(ckTexto(r[0], r[2]))}</b>`).join(d.modo === 'todas' ? ' y ' : ' o ');
  const muestra = entran.slice(0, 5);
  return `<div class="sg2"><div class="sg2-izq">
      <div class="sg2-cab"><span class="sg2-logo" style="background:${d.col};color:${oscuro ? '#fff' : '#0b0b10'}">${I(d.ic)}</span><div><h3>Nuevo segmento</h3><p>Una lista de contactos que se actualiza sola.</p></div></div>
      <div><span class="sg2-lab">Nombre</span><div class="sg2-nom"><input id="sg-n" value="${esc(d.n)}" placeholder="Ej. Calientes por WhatsApp" maxlength="40" autocomplete="off"></div></div>
      <div><span class="sg2-lab">Ícono y color</span><div class="sg2-look"><div class="sg2-icos">${CK_ICONOS.map(ic => `<button type="button" data-sg-ic="${ic}" aria-pressed="${d.ic === ic}" aria-label="Ícono ${ic}">${I(ic)}</button>`).join('')}</div><div class="sg2-cols">${CK_COLORES.map(c => `<button type="button" data-sg-col="${c}" aria-pressed="${d.col === c}" style="background:${c}" aria-label="Color ${c}"></button>`).join('')}</div></div></div>
      <div><span class="sg2-lab">Condiciones</span>
        <div class="sg2-modo" style="margin-bottom:10px">Las condiciones se cumplen<span class="seg"><button type="button" data-sg-modo="todas" aria-pressed="${d.modo === 'todas'}">Todas a la vez</button><button type="button" data-sg-modo="alguna" aria-pressed="${d.modo === 'alguna'}">Al menos una</button></span></div>
        ${mapa}<p class="sgm-ayuda">${d.modo === 'todas' ? 'Entra quien cumple <b>todas</b> las condiciones al mismo tiempo.' : 'Entra quien cumple <b>al menos una</b> de las condiciones.'}</p></div>
    </div>
    <aside class="sg2-der" aria-label="Vista previa">
      <span class="sg2-lab" style="margin:0">Vista previa en vivo</span>
      <div class="sg2-num"><b>${entran.length}</b><span>${entran.length === 1 ? 'contacto entra' : 'contactos entran'} hoy</span></div>
      <p class="sg2-frase">${frase ? `Contactos con ${frase}.` : 'Todos los contactos.'}</p>
      ${muestra.length ? `<div class="sg2-lista">${muestra.map(c => `<div><span class="av" style="background:${colorPersona(c.n)}">${esc(ini(c.n))}</span><b>${esc(c.n)}</b><span class="ck-et"><i style="background:${COL[c.etapa] || '#9ca3af'}"></i>${esc(c.etapa || '')}</span></div>`).join('')}</div>` : '<p class="sg2-frase">Hoy nadie cumple estas condiciones. El segmento se llena solo cuando alguien las cumpla.</p>'}
      ${entran.length > 5 ? `<span class="sg2-mas">y ${entran.length - 5} más</span>` : ''}
      <div class="sg2-usos"><span>${I('check')}Sale en Contactos, en Segmentos</span><span>${I('check')}Lo puedes elegir como público de una difusión</span><span>${I('check')}Se actualiza solo, sin hacer nada</span></div>
    </aside></div>
    <div class="sg2-pie"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" data-sg-ok="1">${I('check')}Guardar segmento</button></div>`;
}
// Se pinta de nuevo sin perder lo escrito ni dónde iba el scroll del modal.
function ckSegPintar(){
  const x = document.getElementById('sg-n'); if (x && st.ckSeg) st.ckSeg.n = x.value;
  const z = document.querySelector('.sg2-izq'), y = z ? z.scrollTop : 0;
  abrirDialogo(ckSegDialogo(), 'dlg-sg');
  const z2 = document.querySelector('.sg2-izq'); if (z2) z2.scrollTop = y;
}
document.addEventListener('click', e => {
  const d = st.ckSeg; if (!d) return;
  const t = e.target instanceof Element ? e.target : null; if (!t || !t.closest('.dlg-sg')) return;
  const hit = s => t.closest(s), para = () => { e.stopImmediatePropagation(); e.preventDefault(); };
  let b;
  if (b = hit('[data-sg-ic]')) { para(); d.ic = b.dataset.sgIc; }
  else if (b = hit('[data-sg-col]')) { para(); d.col = b.dataset.sgCol; }
  else if (b = hit('[data-sg-modo]')) { para(); d.modo = b.dataset.sgModo; }
  else if (hit('[data-sg-abrir]')) { para(); d.mas = !d.mas; }
  else if (b = hit('[data-sg-atajo]')) { para(); const k = b.dataset.sgAtajo; d.reglas.push([k, 'es', (ckCampo(k)[3]()[0] || [''])[0]]); d.mas = false; }
  else if (b = hit('[data-sg-campo]')) { para(); const [i, k] = b.dataset.sgCampo.split('|'); d.reglas[+i] = [k, 'es', (ckCampo(k)[3]()[0] || [''])[0]]; }
  else if (b = hit('[data-sg-op]')) { para(); const [i, o] = b.dataset.sgOp.split('|'); d.reglas[+i][1] = o; }
  else if (b = hit('[data-sg-val]')) { para(); const s = b.dataset.sgVal, p = s.indexOf('|'); d.reglas[+s.slice(0, p)][2] = s.slice(p + 1); }
  else if (b = hit('[data-sg-quitar]')) { para(); d.reglas.splice(+b.dataset.sgQuitar, 1); }
  else if (hit('[data-sg-ok]')) {
    para();
    const inp = document.getElementById('sg-n'), n = inp ? inp.value.trim() : '';
    if (!n) { toast('Ponle un nombre al segmento'); if (inp) inp.focus(); return; }
    const reglas = d.reglas.filter(r => r[2]); if (!reglas.length) { toast('Agrega al menos una condición'); return; }
    const id = 'p' + Date.now();
    st.ct.propios = [...st.ct.propios, {id, n: n.slice(0, 80), ic: d.ic, col: d.col, modo: d.modo, reglas, filtros: {}, q: ''}];
    st.ckSeg = null; st.ct.vista = 'seg:' + id; st.ct.sel.clear(); cerrarDialogo(); render(); toast(`Segmento «${n}» guardado`); return;
  }
  else { if (hit('[data-cerrar-dlg]')) st.ckSeg = null; return; }
  ckSegPintar();
}, true);

document.head.insertAdjacentHTML('beforeend', `<style>
.ck{display:flex;gap:18px;align-items:flex-start;max-width:1320px;margin:0 auto;padding-bottom:70px}
.ck-vistas{flex:none;width:215px;display:flex;flex-direction:column;gap:2px;position:sticky;top:0}
.ck-vistas h5{margin:14px 8px 6px;font-size:11.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#6b7280;display:flex;align-items:center;justify-content:space-between}
.ck-vistas h5:first-child{margin-top:0}
.ck-vistas h5 button{display:inline-flex;align-items:center;gap:4px;border:0;background:none;padding:3px 6px;border-radius:7px;font:inherit;font-size:12px;font-weight:600;letter-spacing:0;text-transform:none;color:#0b0b10;cursor:pointer}
.ck-vistas h5 button:hover{background:#FFD21F}
.ck-vistas h5 button svg{width:13px;height:13px}
.ck-vw{position:relative}
.ck-v{display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;border:0;border-radius:9px;background:none;font:inherit;font-size:13.5px;color:#374151;text-align:left;cursor:pointer}
.ck-v:hover{background:#eef1f5}
.ck-v[aria-current="true"]{background:#FFD21F;color:#0b0b10;font-weight:600}
.ck-v[aria-current="true"] .n{color:#0b0b10}
.ck-v svg{width:16px;height:16px;flex:none}
.ck-v .dot{width:9px;height:9px;border-radius:50%;flex:none;margin:0 3.5px}
.ck-v .t{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ck-v .n{font-size:12px;color:#9ca3af;font-variant-numeric:tabular-nums}
.ck-sic{width:18px;height:18px;border-radius:50%;display:grid;place-items:center;flex:none;margin:0 -1px}
.ck-sic svg{width:11px;height:11px}
.ck-vx{position:absolute;right:4px;top:50%;transform:translateY(-50%);width:24px;height:24px;border:0;border-radius:6px;background:#fff;display:none;place-items:center;cursor:pointer;color:#9ca3af}
.ck-vw:hover .ck-vx,.ck-vx:focus-visible{display:grid}
.ck-vx:hover{background:#fee2e2;color:#b91c1c}
.ck-vx svg{width:13px;height:13px}
.ck-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:14px}
.ck-top{display:flex;flex-wrap:wrap;align-items:flex-end;gap:12px}
.ck-top .t{flex:1;min-width:240px}
.ck-top h2{margin:0;font-size:22px}
.ck-top p{margin:4px 0 0;font-size:13.5px;color:#6b7280}
.ck-top .acc{display:flex;gap:8px;flex-wrap:wrap}
.ck-caja{background:#fff;border:1px solid #e5e9f0;border-radius:16px}
.ck-bar{display:flex;flex-wrap:nowrap;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid #eef1f5}
.ck-bar > *{flex-shrink:0}
.ck-bar .search{flex:1 1 200px;min-width:170px;max-width:340px;margin:0}
.ck-pill{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 12px;border-radius:8px;border:1px solid #e5e9f0;background:#fff;font:inherit;font-size:13px;color:#374151;cursor:pointer;white-space:nowrap}
.ck-pill:hover{border-color:#cbd5e1}
.ck-pill svg{width:14px;height:14px;color:#9ca3af}
.ck-pill.on{border-color:#FFD21F;background:#FFD21F;color:#0b0b10;padding:0 4px 0 12px;gap:2px}
.ck-pill.on button{border:0;background:none;color:inherit;font:inherit;cursor:pointer;padding:0;display:inline-flex;align-items:center;gap:4px}
.ck-pill.on .q{width:26px;height:26px;border-radius:6px;justify-content:center}
.ck-pill.on .q:hover{background:rgba(11,11,16,.1)}
.ck-pill.on svg{color:#0b0b10}
.ck-pill b{font-weight:600}
.ck-sp{flex:1}
.ck-tw{overflow-x:auto}
.ck-tb{width:100%;border-collapse:collapse;font-size:13.5px}
.ck-tb th{text-align:left;font-size:12px;font-weight:600;color:#6b7280;padding:10px 12px;border-bottom:1px solid #eef1f5;white-space:nowrap;background:#fafbfc}
.ck-tb th button{border:0;background:none;font:inherit;color:inherit;cursor:pointer;padding:0}
.ck-tb th .ord{font-size:9px;margin-left:2px}
.ck-tb td{padding:10px;border-bottom:1px solid #f1f3f6;vertical-align:middle}
.ck-tb tr:last-child td{border-bottom:0}
.ck-tb tbody tr[data-ct-fila]{cursor:pointer}
.ck-tb tbody tr:hover{background:#fafbfc}
.ck-tb tr.ck-on,.ck-tb tr.ck-on:hover{background:#fffde6}
.ck-tb .cb{width:36px}.ck-tb th.ac{background:#fafbfc}.ck-tb .ac{width:44px;border:0;border-bottom:1px solid #f1f3f6;border-radius:0;background:none}.ck-tb tr:last-child .ac{border-bottom:0}
.ck-chk{width:18px;height:18px;accent-color:#0b0b10;cursor:pointer}
.ck-per{display:flex;align-items:center;gap:10px;min-width:0}
.ck-per .av{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;color:#fff;font-size:12px;font-weight:600;flex:none}
.ck-per b{display:block;font-weight:600;white-space:nowrap}
.ck-per small{display:block;font-size:12.5px;color:#6b7280;font-variant-numeric:tabular-nums;white-space:nowrap}
.ck-et{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:999px;font-size:12.5px;font-weight:500;background:#f4f5f7;white-space:nowrap}
.ck-et i{width:8px;height:8px;border-radius:50%}
.ck-as{display:flex;align-items:center;gap:8px;white-space:nowrap}
.ck-as .av{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;color:#fff;font-size:9.5px;font-weight:600}
.ck-as.sin,.ck-gris{color:#9ca3af}
.ck-can svg{width:18px;height:18px}
.ck-tags{display:flex;gap:4px;flex-wrap:wrap}
.ck-tag{display:inline-flex;align-items:center;gap:5px;padding:2px 8px;border-radius:7px;border:1px solid #e5e9f0;font-size:12px;color:#374151;white-space:nowrap}
.ck-tag i{width:7px;height:7px;border-radius:50%}
.ck-ult{color:#6b7280;white-space:nowrap}
.ck-mas{width:32px;height:32px;border-radius:8px;border:0;background:none;display:grid;place-items:center;cursor:pointer;color:#6b7280}
.ck-mas:hover{background:#eef1f5}
.ck-mas svg{width:16px;height:16px}
.ck-vacio{text-align:center;padding:40px 16px !important;cursor:default}
.ck-vacio b{display:block;font-size:15px;margin-bottom:4px}
.ck-vacio span{display:block;color:#6b7280;margin-bottom:12px}
.ck-pie{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;font-size:12.5px;color:#6b7280;border-top:1px solid #eef1f5}
.ck-flota{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);display:flex;align-items:center;gap:8px;padding:8px 8px 8px 16px;border-radius:14px;background:#0b0b10;color:#fff;box-shadow:0 18px 40px rgba(0,0,0,.25);z-index:40;white-space:nowrap;max-width:calc(100vw - 32px)}
.ck-flota b{font-size:13.5px;margin-right:6px}
.ck-flota button{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 12px;border-radius:9px;border:1px solid #2b2b35;background:#15151c;color:#fff;font:inherit;font-size:13px;cursor:pointer}
.ck-flota button:hover{background:#22222c}
.ck-flota button[aria-expanded="true"]{background:#FFD21F;border-color:#FFD21F;color:#0b0b10}
.ck-flota button svg{width:15px;height:15px}
.ck-flota .x{border:0;background:none;width:34px;padding:0;justify-content:center}
.ck-fw{position:relative}
.ck-fmenu{position:absolute;bottom:calc(100% + 10px);left:0;min-width:220px;max-height:300px;overflow-y:auto;background:#fff;color:var(--ink);border:1px solid #e5e9f0;border-radius:12px;box-shadow:0 18px 40px -12px rgba(15,23,42,.35);padding:6px;display:grid;gap:2px}
.ck-flota .ck-fmenu button{height:auto;border:0;background:none;color:var(--ink);padding:8px 10px;border-radius:8px;text-align:left;justify-content:flex-start}
.ck-flota .ck-fmenu button:hover{background:#f3f4f6}
.ck-fmenu p{margin:0;padding:8px 10px;font-size:13px;color:#6b7280}
.ck-flmenu{position:fixed;z-index:60;min-width:220px;max-height:320px;overflow-y:auto;background:#fff;border:1px solid #e5e9f0;border-radius:12px;box-shadow:0 18px 40px -12px rgba(15,23,42,.3);padding:6px;display:grid;gap:2px}
.ck-flmenu small{font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#6b7280;padding:6px 10px 4px}
.ck-flmenu p{margin:0;padding:8px 10px;font-size:13px;color:#6b7280}
.ck-flmenu button{display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;border:0;background:none;border-radius:8px;font:inherit;font-size:13.5px;color:var(--ink);text-align:left;cursor:pointer}
.ck-flmenu button:hover{background:#f3f4f6}
.ck-flmenu button svg{width:16px;height:16px;color:#6b7280}
.ck-flmenu button[aria-checked] svg{margin-left:auto;color:#0b0b10}
.ck-flmenu button.peligro{color:#b91c1c}.ck-flmenu button.peligro svg{color:#b91c1c}
.ck-flmenu hr{border:0;border-top:1px solid #eef1f5;margin:4px 0}
.dlg.dlg-sg{width:min(900px,calc(100vw - 32px));padding:0;gap:0;overflow:hidden}
.dlg.dlg-sg .dlg-cerrar{top:18px;right:18px}
.sg2{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr)}
.sg2-izq{padding:24px 26px;display:flex;flex-direction:column;gap:18px;max-height:min(680px,calc(100vh - 140px));overflow-y:auto}
.sg2-der{background:#f8fafc;border-left:1px solid #eef1f5;padding:24px 22px;display:flex;flex-direction:column;gap:14px}
.sg2-cab{display:flex;align-items:center;gap:14px}
.sg2-logo{width:52px;height:52px;border-radius:50%;display:grid;place-items:center;flex:none}
.sg2-logo svg{width:24px;height:24px}
.sg2-cab h3{margin:0;font-size:20px}
.sg2-cab p{margin:2px 0 0;font-size:13px;color:#6b7280}
.sg2-lab{font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#6b7280;margin-bottom:8px;display:block}
.sg2-nom{display:flex;gap:10px;align-items:center}
.sg2-nom input{flex:1;height:44px;border:1px solid #e5e9f0;border-radius:11px;padding:0 14px;font:inherit;font-size:15px}
.sg2-nom input:focus{outline:none;border-color:#0b0b10;box-shadow:0 0 0 3px rgba(255,210,31,.45)}
.sg2-look{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
.sg2-icos,.sg2-cols{display:flex;gap:6px;flex-wrap:wrap}
.sg2-icos button{width:34px;height:34px;border-radius:9px;border:1px solid #e5e9f0;background:#fff;display:grid;place-items:center;cursor:pointer}
.sg2-icos button svg{width:16px;height:16px}
.sg2-icos button[aria-pressed="true"]{border-color:#FFD21F;background:#FFD21F;color:#0b0b10}
.sg2-cols button{width:26px;height:26px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px #e5e9f0;cursor:pointer}
.sg2-cols button[aria-pressed="true"]{box-shadow:0 0 0 2px #0b0b10}
.sg2-modo{display:flex;align-items:center;gap:8px;font-size:14px;color:#374151;flex-wrap:wrap}
.sg2-modo .seg{display:inline-flex;padding:3px;border-radius:10px;background:#eef1f5}
.sg2-modo .seg button{height:28px;padding:0 12px;border:0;border-radius:8px;background:none;font:inherit;font-size:13px;font-weight:500;color:#4b5563;cursor:pointer}
.sg2-modo .seg button[aria-pressed="true"]{background:#FFD21F;color:#0b0b10;font-weight:600}
.sg2-num{display:flex;align-items:baseline;gap:8px}
.sg2-num b{font-size:40px;line-height:1;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.sg2-num span{font-size:14px;color:#6b7280}
.sg2-frase{margin:0;font-size:13px;line-height:1.5;color:#374151;padding:10px 12px;border-radius:10px;background:#fff;border:1px solid #eef1f5}
.sg2-frase b{font-weight:600}
.sg2-lista{display:flex;flex-direction:column;background:#fff;border:1px solid #eef1f5;border-radius:12px;overflow:hidden}
.sg2-lista div{display:flex;align-items:center;gap:10px;padding:9px 12px;border-top:1px solid #f1f3f6}
.sg2-lista div:first-child{border-top:0}
.sg2-lista .av{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;color:#fff;font-size:10.5px;font-weight:600;flex:none}
.sg2-lista b{flex:1;min-width:0;font-size:13.5px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sg2-mas{font-size:12.5px;color:#6b7280;text-align:center}
.sg2-usos{margin-top:auto;display:flex;flex-direction:column;gap:6px;font-size:12.5px;color:#4b5563}
.sg2-usos span{display:flex;align-items:center;gap:8px}
.sg2-usos svg{width:14px;height:14px;color:#16a34a}
.sg2-pie{display:flex;justify-content:flex-end;gap:8px;padding:14px 26px;border-top:1px solid #eef1f5;background:#fff}
.sgm{display:flex;flex-direction:column;align-items:center;padding:18px 12px;border-radius:14px;background-color:#f6f7f9;background-image:radial-gradient(#d7dce3 1px,transparent 1px);background-size:16px 16px}
.sgm-ini,.sgm-fin{display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:12px;background:#fff;border:1.5px solid #e5e9f0;min-width:240px}
.sgm-ini small,.sgm-fin small{display:block;font-size:10.5px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#6b7280}
.sgm-ini b,.sgm-fin b{display:block;font-size:13.5px;font-weight:600}
.sgm .mm-ic{width:32px;height:32px;border-radius:50%}
.sgm .mm-ic svg{width:16px;height:16px}
.sgm-nodo{width:100%;display:flex;align-items:center;gap:10px;padding:10px 10px 10px 12px;border-radius:13px;background:#fff;border:1.5px solid #e5e9f0;box-shadow:0 1px 2px rgba(15,23,42,.04)}
.sgm-nodo .cpos{flex:1;min-width:0;display:grid;grid-template-columns:minmax(0,1fr) 88px minmax(0,1.3fr);gap:8px}
.sgm-nodo .dsel{min-width:0 !important}
.sgm-nodo .dsel .sel{white-space:nowrap}
.sgm-nodo .dsel .sel span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.sgm-nodo .x{width:30px;height:30px;border-radius:8px;border:0;background:none;display:grid;place-items:center;cursor:pointer;color:#9ca3af;flex:none}
.sgm-nodo .x:hover{background:#fee2e2;color:#b91c1c}
.sgm-nodo .x svg{width:15px;height:15px}
.sgm-une{font-size:11.5px;font-weight:700;padding:2px 10px;border-radius:999px;background:#FFD21F;color:#0b0b10}
.sgm-ayuda{margin:8px 0 0;font-size:12.5px;color:#6b7280}
.sgm-ayuda b{color:#0b0b10}
.sgm-mas-w{position:relative;display:flex;flex-direction:column;align-items:center}
.sgm-menu{position:absolute;top:calc(100% + 6px);left:50%;transform:translateX(-50%);z-index:5;min-width:210px;background:#fff;border:1px solid #e5e9f0;border-radius:12px;box-shadow:0 16px 36px -12px rgba(15,23,42,.3);padding:6px;display:grid;gap:2px}
.sgm-menu small{font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#6b7280;padding:6px 10px 4px}
.sgm-menu button{display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;border:0;background:none;border-radius:8px;font:inherit;font-size:13.5px;text-align:left;cursor:pointer}
.sgm-menu button:hover{background:#f3f4f6}
.sgm-menu button svg{width:16px;height:16px;color:#6b7280}
@media (max-width:980px){.ck{flex-direction:column}.ck-vistas{position:static;width:100%}.ck-bar{flex-wrap:wrap}}
@media (max-width:780px){.sg2{grid-template-columns:1fr}.sg2-der{border-left:0;border-top:1px solid #eef1f5}.sgm-nodo .cpos{grid-template-columns:1fr}.ck-flota{left:16px;right:16px;transform:none;overflow-x:auto}}
</style>`);
