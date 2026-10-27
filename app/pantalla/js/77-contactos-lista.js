/* ── Contactos paginados (maqueta aprobada «Contactos rediseñados», dirección C, 27-oct) ──
   Solo los contactos guardados a propósito; la lista, la búsqueda, los filtros, los conteos y el orden los hace el
   servidor (GET /crm/contactos/lista) y llegan de a 25, 50 o 100, así la página no se pone lenta con miles. Al tocar
   un contacto se abre su ficha a la derecha (etapa, miembro, canal, etiquetas, origen y últimos mensajes) con
   «Abrir chat» y «Llamar», sin salir de la lista. Reusa de 76-contactos.js las pastillas de filtro (data-ck-pill),
   el modal «Nuevo segmento» (data-ck-seg) y los menús flotantes, y de 10-nucleo.js importar, exportar, agregar
   contacto, «Columnas» y la búsqueda (#ct-q). Todo lo que se pinta va escapado con esc(). */
st.cl = {pag: 1, tam: 50, datos: null, cargando: false, clave: '', pedida: '', error: '', ficha: null, ultimos: {}, sel: new Map(), t: null};
const CL_TAMS = [25, 50, 100];

function clParams(){
  const ct = st.ct, f = ct.f || {}, u = new URLSearchParams();
  u.set('vista', ct.vista === 'sinagregar' ? 'todos' : ct.vista); if (ct.q.trim()) u.set('q', ct.q.trim());
  for (const k of ['etapa', 'asig', 'canal', 'tag', 'origen', 'producto']) if (f[k]) u.set(k, f[k]);
  u.set('orden', ct.orden.k === 'n' || ct.orden.k === 'agregado' ? ct.orden.k : 'ultimo'); u.set('dir', String(ct.orden.dir === -1 ? -1 : 1));
  u.set('pagina', String(st.cl.pag)); u.set('tam', String(st.cl.tam));
  u.set('etapas', [...etapasActivas(), ...etapasPerdidas()].join('|'));
  return u.toString() + '&s=' + encodeURIComponent(JSON.stringify((st.ct.propios || []).map(s => [s.id, s.reglas, s.modo])));
}
/** Pide la página si cambió algo (con una pausa corta mientras se escribe en la búsqueda). */
function clCargar(forzar){
  const clave = clParams();
  if (!forzar && (clave === st.cl.clave || clave === st.cl.pedida)) return;
  clearTimeout(st.cl.t);
  st.cl.t = setTimeout(() => {
    st.cl.pedida = clave; st.cl.cargando = true;
    crmApi('GET', '/crm/contactos/lista?' + clave.split('&s=')[0])
      .then(d => { if (st.cl.pedida !== clave) return; st.cl.datos = d; st.cl.clave = clave; st.cl.error = ''; if (d.pagina !== st.cl.pag) st.cl.pag = d.pagina; })
      .catch(err => { if (st.cl.pedida === clave) st.cl.error = err.message || 'No se pudo cargar la lista'; })
      .finally(() => { if (st.cl.pedida !== clave) return; st.cl.cargando = false; st.cl.pedida = ''; if (st.pagina === 'contactos') clRepintar(); });
  }, forzar ? 0 : 220);
}
/** Repinta conservando el foco y el cursor de la búsqueda. */
function clRepintar(){
  const q = document.getElementById('ct-q'), con = document.activeElement === q, pos = q ? q.selectionStart : 0;
  render();
  if (con) { const n = document.getElementById('ct-q'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } }
}
// Algo cambió en un contacto o una conversación (tiempo real): la página se vuelve a pedir, sin parpadeo.
document.addEventListener('crm:evento', e => { const d = e.detail || {}; if (st.pagina === 'contactos' && ['contacto', 'conv', 'conv-borrada'].includes(d.tipo)) { clearTimeout(st.cl.rt); st.cl.rt = setTimeout(() => clCargar(true), 600); } });

const clFila = k => k; // los contactos llegan con la forma de contactoAFront (+ convId, linea, ultimo, creado)
const clOrigen = k => k.pauta ? 'Anuncio' : /enlace de venta/i.test((k.ficha || {}).origen || '') ? 'Enlace de venta de un asesor' : /web/i.test((k.ficha || {}).origen || '') ? 'Chat de la web' : /Correo/.test((k.ficha || {}).origen || '') ? 'Correo' : 'Otro';
const clDias = iso => iso ? hcDias(iso) : null;
const clCuando = iso => iso ? ctFecha(clDias(iso)) : '—';

paginaContactos = function(){
  // Los menús flotantes no se cierran al repintar (llegan datos o avisos en tiempo real): se cierran al tocar afuera.
  const el = document.getElementById('page'), ct = st.ct, C = st.cl, D = C.datos;
  if (ct.vista === 'sinagregar' || (ct.vista.startsWith('etapa:'))) { if (ct.vista.startsWith('etapa:')) ct.f.etapa = ct.vista.slice(6); ct.vista = 'todos'; }
  clCargar();
  const conteo = D ? D.conteos : null, filas = D ? D.filas : [];
  const segs = [...SEGMENTOS.filter(s => s.id !== 'nuevos'), ...(ct.propios || [])];
  const vistaN = ct.vista === 'todos' ? 'Todos' : ct.vista === 'nuevos' ? 'Nuevos esta semana' : ct.vista === 'mios' ? 'Mis contactos' : ct.vista === 'nocontactar' ? 'No contactar' : ct.vista === 'spam' ? 'Spam' : ct.vista.startsWith('seg:') ? ((segDe(ct.vista.slice(4)) || {}).n || 'Segmento') : 'Todos';
  const pills = CK_PILLS.map(k => { const val = ct.f[k], n = ckCampo(k)[1];
    return val ? `<span class="ck-pill on"><button type="button" data-ck-pill="${k}">${esc(n)}: <b>${esc(etiquetaFiltro(k, val))}</b></button><button type="button" class="q" data-ct-quitar="${k}" aria-label="Quitar el filtro ${esc(n)}">${I('x')}</button></span>`
      : `<button type="button" class="ck-pill" data-ck-pill="${k}" aria-haspopup="menu">${esc(n)}${I('chev')}</button>`; }).join('');
  const ficha = C.ficha && filas.find(k => k.contactoId === C.ficha);
  if (C.ficha && D && !ficha) C.ficha = null;
  const col = k => !ficha && ct.cols.has(k);
  const gris = '<span class="ck-gris">—</span>';
  const flecha = k => ct.orden.k === k ? `<span class="ord">${ct.orden.dir === 1 ? '▲' : '▼'}</span>` : '';
  const todosSel = filas.length > 0 && filas.every(k => C.sel.has(k.contactoId));
  const filasHTML = filas.map(k => { const sel = C.sel.has(k.contactoId), can = CANALES[k.canal] || {n: k.canal, ic: 'chat'}, etapa = k.etapa || '';
    return `<tr data-cl-fila="${k.contactoId}" class="${sel ? 'ck-on' : ''}${ficha && ficha.contactoId === k.contactoId ? ' cl-abierta' : ''}"><td class="cb"><input type="checkbox" class="ck-chk" data-cl-sel="${k.contactoId}" ${sel ? 'checked' : ''} aria-label="Elegir a ${esc(k.n)}"></td>
      <td><div class="ck-per"><span class="av" style="background:${colorPersona(k.n)}">${esc(ini(k.n))}</span><span><b>${esc(k.n)}</b><small>${esc(k.tel || k.correo || '')}</small></span></div></td>
      ${col('etapa') ? `<td><span class="ck-et"><i style="background:${COL[etapa] || '#9ca3af'}"></i>${esc(etapa || '—')}</span></td>` : ''}
      ${col('asig') ? `<td>${k.asig ? `<span class="ck-as"><span class="av" style="background:${colorPersona(k.asig)}">${esc(ini(k.asig))}</span>${esc(k.asig)}</span>` : '<span class="ck-as sin">Sin asignar</span>'}</td>` : ''}
      ${col('canal') ? `<td class="ck-can" title="${esc(can.n)}">${I(can.ic, 'i ' + k.canal)}</td>` : ''}
      ${col('tags') ? `<td><div class="ck-tags">${(k.tags || []).map(t => `<span class="ck-tag"><i style="background:${ETIQ_COL[t] || '#9ca3af'}"></i>${esc(t)}</span>`).join('') || gris}</div></td>` : ''}
      ${!ficha || ct.cols.has('ultimo') ? `<td class="ck-ult">${esc(clCuando(k.ultimo))}</td>` : ''}
      ${col('producto') ? `<td>${(k.campos || {}).producto ? esc(k.campos.producto) : gris}</td>` : ''}
      ${col('empresa') ? `<td>${(k.campos || {}).empresa ? esc(k.campos.empresa) : gris}</td>` : ''}
      ${col('ciudad') ? `<td>${(k.ficha || {}).ciudad ? esc(k.ficha.ciudad) : gris}</td>` : ''}
      ${col('origen') ? `<td>${esc(clOrigen(k))}</td>` : ''}
      ${col('agregado') ? `<td class="ck-ult">${esc(clCuando(k.creado))}</td>` : ''}
      <td class="ac"><button type="button" class="ck-mas" data-cl-menu="${k.contactoId}" aria-label="Más opciones de ${esc(k.n)}" aria-haspopup="menu">${I('more')}</button></td></tr>`; }).join('');
  const nf = Object.values(ct.f).filter(Boolean).length;
  const vacio = !D ? `<tr><td colspan="14" class="ck-vacio"><span>${C.error ? esc(C.error) : 'Cargando los contactos…'}</span>${C.error ? '<button type="button" class="btn" data-cl-reintentar="1">Volver a intentar</button>' : ''}</td></tr>`
    : `<tr><td colspan="14" class="ck-vacio"><b>Nadie coincide</b><span>${nf || ct.q.trim() ? 'Prueba quitando algún filtro o cambiando la búsqueda.' : 'Todavía no hay contactos guardados. Se guardan con «Agregar» desde una conversación o con «Agregar contacto».'}</span>${nf ? '<button type="button" class="btn" data-ct-quitar="todo">Quitar filtros</button>' : ''}</td></tr>`;
  // Paginación: «Mostrando 1–50 de 1.284», filas por página y las páginas (con «…» cuando son muchas).
  const tot = D ? D.total : 0, pag = D ? D.pagina : 1, pags = D ? D.paginas : 1, ini0 = tot ? (pag - 1) * C.tam + 1 : 0, fin0 = Math.min(tot, pag * C.tam);
  const nums = []; for (let i = 1; i <= pags; i++) if (i === 1 || i === pags || Math.abs(i - pag) <= 1) nums.push(i); else if (nums[nums.length - 1] !== '…') nums.push('…');
  const pie = `<div class="cl-pag"><span class="cl-pt">Mostrando <b>${ini0.toLocaleString('es-CO')}–${fin0.toLocaleString('es-CO')}</b> de <b>${tot.toLocaleString('es-CO')}</b> ${tot === 1 ? 'contacto' : 'contactos'}${C.cargando && D ? ' <i class="cl-gira" aria-label="Cargando"></i>' : ''}</span>
    <span class="cl-pp">Filas por página <button type="button" data-cl-tams aria-haspopup="menu">${C.tam}${I('chev')}</button></span>
    <nav class="cl-pn" aria-label="Páginas"><button type="button" class="fl" data-cl-pag="${pag - 1}" ${pag <= 1 ? 'disabled' : ''} aria-label="Página anterior">${I('back')}</button>${nums.map(n => n === '…' ? '<span>…</span>' : `<button type="button" class="${n === pag ? 'on' : ''}" data-cl-pag="${n}" ${n === pag ? 'aria-current="page"' : ''}>${n}</button>`).join('')}<button type="button" class="fl sig" data-cl-pag="${pag + 1}" ${pag >= pags ? 'disabled' : ''} aria-label="Página siguiente">${I('back')}</button></nav></div>`;
  const titulo = ct.vista === 'todos' ? 'Contactos' : vistaN;
  const sub = !conteo ? '' : ct.vista === 'todos' ? `${conteo.todos.toLocaleString('es-CO')} guardados` : `${tot.toLocaleString('es-CO')} ${tot === 1 ? 'contacto' : 'contactos'}`;
  const nSel = C.sel.size;
  const bulkMenu = k => st.ckBulk !== k ? '' : `<div class="ck-fmenu" role="menu">${(k === 'asig' ? ASESORES.map(a => [`data-clb-asig="${esc(a)}"`, a]) : k === 'etapa' ? [...etapasActivas(), ...etapasPerdidas()].map(e => [`data-clb-etapa="${esc(e)}"`, e]) : ETIQS.map(([n]) => [`data-clb-tag="${esc(n)}"`, n])).map(([a, t]) => `<button type="button" role="menuitem" ${a}>${esc(t)}</button>`).join('') || '<p>No hay opciones.</p>'}</div>`;
  el.replaceChildren();
  el.insertAdjacentHTML('beforeend', `<div class="cl">
    <div class="cl-top"><div><h2>${esc(titulo)}</h2><p>${sub}</p></div>
      <div class="acc">${puedeConfigurarCrm() ? `<button type="button" class="btn" data-ct-acc="importar">${I('file')}Importar</button>` : ''}<button type="button" class="btn" data-ct-acc="exportar">${I('share')}Exportar</button><button type="button" class="btn pri" id="ct-nuevo">${I('plus')}Agregar contacto</button><div id="ct-mas" hidden></div></div></div>
    <div class="cl-split${ficha ? ' con-ficha' : ''}"><div class="cl-caja">
      <div class="ck-bar cl-bar"><button type="button" class="ck-pill cl-vista" data-cl-vistas aria-haspopup="menu">${I('users')}${esc(vistaN)}${conteo ? `<em>${(ct.vista === 'todos' ? conteo.todos : tot).toLocaleString('es-CO')}</em>` : ''}${I('chev')}</button>
        <label class="search cl-q">${I('search')}<input id="ct-q" type="search" placeholder="Buscar por nombre, teléfono, correo o ciudad" value="${esc(ct.q)}" autocomplete="off"></label>${pills}<span class="ck-sp"></span>
        ${ficha ? '' : `<div class="dd" style="position:relative"><button type="button" class="btn" id="ct-cols-b" aria-haspopup="menu">${I('kanban')}Columnas</button>
          <div class="menu" id="ct-cols" hidden><div class="hd">Columnas que se ven</div>${CK_COLS.map(([k, n]) => `<button type="button" data-ct-col="${k}" role="menuitemcheckbox" aria-checked="${ct.cols.has(k)}"><span class="chk ${ct.cols.has(k) ? 'on' : ''}">${ct.cols.has(k) ? I('check') : ''}</span>${n}</button>`).join('')}</div></div>`}</div>
      <div class="ck-tw cl-tw"><table class="ck-tb"><thead><tr><th class="cb"><input type="checkbox" class="ck-chk" data-cl-todos="1" ${todosSel ? 'checked' : ''} aria-label="Elegir los de esta página"></th>
        <th><button type="button" data-ct-ord="n">Contacto ${flecha('n')}</button></th>${col('etapa') ? '<th>Etapa</th>' : ''}${col('asig') ? '<th>Miembro</th>' : ''}${col('canal') ? '<th>Canal</th>' : ''}${col('tags') ? '<th>Etiquetas</th>' : ''}${!ficha || ct.cols.has('ultimo') ? `<th><button type="button" data-ct-ord="ultimo">Último mensaje ${flecha('ultimo')}</button></th>` : ''}${col('producto') ? '<th>Producto</th>' : ''}${col('empresa') ? '<th>Empresa</th>' : ''}${col('ciudad') ? '<th>Ciudad</th>' : ''}${col('origen') ? '<th>Origen</th>' : ''}${col('agregado') ? `<th><button type="button" data-ct-ord="agregado">Agregado ${flecha('agregado')}</button></th>` : ''}<th class="ac"></th></tr></thead>
        <tbody>${filasHTML || vacio}</tbody></table></div>${pie}</div>
      ${ficha ? clFicha(ficha) : ''}</div>
    ${nSel ? `<div class="ck-flota" role="toolbar" aria-label="Acciones con la selección"><b>${nSel} ${nSel === 1 ? 'seleccionado' : 'seleccionados'}</b>
      <span class="ck-fw"><button type="button" data-ck-bulk="asig" aria-expanded="${st.ckBulk === 'asig'}">${I('user')}Asignar</button>${bulkMenu('asig')}</span>
      <span class="ck-fw"><button type="button" data-ck-bulk="etapa" aria-expanded="${st.ckBulk === 'etapa'}">${I('flow')}Cambiar etapa</button>${bulkMenu('etapa')}</span>
      <span class="ck-fw"><button type="button" data-ck-bulk="tag" aria-expanded="${st.ckBulk === 'tag'}">${I('tag')}Etiqueta</button>${bulkMenu('tag')}</span>
      <button type="button" data-cl-dif>${I('megaphone')}Difusión</button><button type="button" data-cl-exp>${I('share')}Exportar</button>
      <button type="button" class="x" data-cl-limpiar aria-label="Quitar la selección">${I('x')}</button></div>` : ''}
  </div>`);
};

/* La ficha al lado: datos, «Abrir chat», «Llamar» y los últimos mensajes. */
function clFicha(k){
  const U = st.cl.ultimos[k.contactoId];
  if (U === undefined) { st.cl.ultimos[k.contactoId] = null; crmApi('GET', `/crm/contactos/${k.contactoId}/ultimos`).then(r => { st.cl.ultimos[k.contactoId] = r || []; }).catch(() => { st.cl.ultimos[k.contactoId] = []; }).finally(() => { if (st.pagina === 'contactos' && st.cl.ficha === k.contactoId) clRepintar(); }); }
  const can = CANALES[k.canal] || {n: k.canal}, linea = k.linea ? lineaDe(k.linea).n : '';
  const dato = (t, v) => `<div><dt>${t}</dt><dd>${v}</dd></div>`;
  return `<aside class="cl-fi" aria-label="Ficha de ${esc(k.n)}"><div class="cl-fi-h"><span class="av" style="background:${colorPersona(k.n)}">${esc(ini(k.n))}</span><div><b>${esc(k.n)}</b><small>${esc(k.tel || k.correo || '')}</small></div><button type="button" class="cl-x" data-cl-cerrar aria-label="Cerrar la ficha">${I('x')}</button></div>
    <div class="cl-fi-acc"><button type="button" class="pri" data-cl-chat="${k.contactoId}">${I('chat')}Abrir chat</button>${k.canal === 'wa' ? `<button type="button" data-cl-llamar="${k.contactoId}">${I('phone')}Llamar</button>` : ''}</div>
    <dl>${dato('Etapa', k.etapa ? `<span class="ck-et"><i style="background:${COL[k.etapa] || '#9ca3af'}"></i>${esc(k.etapa)}</span>` : '—')}${dato('Miembro', esc(k.asig || 'Sin asignar'))}${dato('Canal', esc(can.n + (linea ? ' · ' + linea : '')))}${dato('Etiquetas', (k.tags || []).map(t => `<span class="ck-tag"><i style="background:${ETIQ_COL[t] || '#9ca3af'}"></i>${esc(t)}</span>`).join(' ') || '—')}${dato('Origen', esc(clOrigen(k)))}${dato('Agregado', esc(clCuando(k.creado)))}</dl>
    <h6>Últimos mensajes</h6><div class="cl-msj">${U === null || U === undefined ? '<p class="cl-nada">Cargando…</p>' : U.length ? U.map(m => `<p class="${m.lado === 'in' ? 'in' : 'out'}">${esc(m.texto)}</p>`).join('') : '<p class="cl-nada">Todavía no hay mensajes con este contacto.</p>'}</div></aside>`;
}

/* Abrir el chat: la conversación que ya está en la bandeja o, si no, un mensaje nuevo para esa persona. */
function clAbrirChat(k, llamar){
  const conv = k.convId && CONV.find(c => c.id === k.convId);
  if (conv) { ctAbrirConv(conv.id); if (llamar) setTimeout(() => { const b = document.getElementById('b-call'); if (b) b.click(); }, 350); return; }
  if (llamar) toast('Primero escríbele: la llamada sale desde su conversación');
  nmAbrir(); nmElegir({n: k.n, tel: k.tel, correo: k.correo, contactoId: k.contactoId, canal: k.canal});
}
/** Un cambio a los contactos elegidos (Asignar, Cambiar etapa, Etiqueta), por el mismo PATCH de siempre. */
async function clEnGrupo(cambio, ok){
  const L = [...st.cl.sel.values()], n = L.length; st.ckBulk = null;
  let fallos = 0;
  for (let i = 0; i < L.length; i += 8) await Promise.all(L.slice(i, i + 8).map(k => crmApi('PATCH', `/crm/contactos/${k.contactoId}`, {cambios: cambio(k)}).catch(() => { fallos++; })));
  st.cl.sel.clear(); clCargar(true);
  toast(fallos ? `${n - fallos} de ${n} listos; ${fallos} no se pudieron cambiar` : ok(n));
}

document.addEventListener('click', e => {
  if (st.pagina !== 'contactos') return;
  const t = e.target instanceof Element ? e.target : null; if (!t) return;
  const C = st.cl, filas = C.datos ? C.datos.filas : [], deId = id => filas.find(k => k.contactoId === +id);
  const vs = t.closest('[data-cl-vistas]');
  if (vs) { e.stopPropagation(); const c = C.datos ? C.datos.conteos : null, n = v => c ? `<em>${Number(v).toLocaleString('es-CO')}</em>` : '';
    const op = (v, ic, txt, num) => `<button type="button" role="menuitemradio" aria-checked="${st.ct.vista === v}" data-cl-v="${esc(v)}">${I(ic)}<span>${esc(txt)}</span>${n(num)}</button>`;
    const segs = [...SEGMENTOS.filter(s => s.id !== 'nuevos'), ...(st.ct.propios || [])];
    ckFlotante(vs, `${op('todos', 'users', 'Todos', c && c.todos)}${op('nuevos', 'clock', 'Nuevos esta semana', c && c.nuevos)}${op('mios', 'user', 'Mis contactos', c && c.mios)}
      <small>Segmentos</small>${segs.map(s => op('seg:' + s.id, 'filter', s.n, c && c.segmentos[s.id])).join('')}<button type="button" data-ck-seg="1">${I('plus')}<span>Nuevo segmento</span></button>
      <small>Otros</small>${op('nocontactar', 'block', 'No contactar', c && c.nocontactar)}${op('spam', 'shield-x', 'Spam', c && c.spam)}`);
    return; }
  const v = t.closest('[data-cl-v]'); if (v) { st.ct.vista = v.dataset.clV; C.pag = 1; C.sel.clear(); C.ficha = null; ckCerrarFlotantes(); render(); return; }
  const tm = t.closest('[data-cl-tams]'); if (tm) { e.stopPropagation(); ckFlotante(tm, CL_TAMS.map(n => `<button type="button" role="menuitemradio" aria-checked="${C.tam === n}" data-cl-tam="${n}">${n} por página</button>`).join('')); return; }
  const tn = t.closest('[data-cl-tam]'); if (tn) { C.tam = +tn.dataset.clTam; C.pag = 1; ckCerrarFlotantes(); render(); return; }
  const pg = t.closest('[data-cl-pag]'); if (pg && !pg.disabled) { C.pag = +pg.dataset.clPag; render(); const tw = document.querySelector('.cl-tw'); if (tw) tw.scrollTop = 0; return; }
  if (t.closest('[data-cl-reintentar]')) { clCargar(true); return; }
  const sl = t.closest('[data-cl-sel]'); if (sl) { const k = deId(sl.dataset.clSel); if (k) { if (C.sel.has(k.contactoId)) C.sel.delete(k.contactoId); else C.sel.set(k.contactoId, k); } render(); return; }
  if (t.closest('[data-cl-todos]')) { const todos = filas.every(k => C.sel.has(k.contactoId)); filas.forEach(k => { if (todos) C.sel.delete(k.contactoId); else C.sel.set(k.contactoId, k); }); render(); return; }
  if (t.closest('[data-cl-limpiar]')) { C.sel.clear(); render(); return; }
  if (t.closest('[data-cl-cerrar]')) { C.ficha = null; render(); return; }
  const ch = t.closest('[data-cl-chat]'); if (ch) { const k = deId(ch.dataset.clChat); if (k) clAbrirChat(k, false); return; }
  const ll = t.closest('[data-cl-llamar]'); if (ll) { const k = deId(ll.dataset.clLlamar); if (k) clAbrirChat(k, true); return; }
  const mn = t.closest('[data-cl-menu]');
  if (mn) { e.stopPropagation(); const k = deId(mn.dataset.clMenu); if (!k) return;
    mn.dataset.ckMenu = '1';
    ckFlotante(mn, `<button type="button" data-cl-chat="${k.contactoId}">${I('chat')}Abrir chat</button><button type="button" data-cl-quitar="${k.contactoId}">${I('user-plus')}Quitar de contactos</button><hr>
      ${k.spam ? `<button type="button" data-cl-nospam="${k.contactoId}">${I('shield-x')}Sacar de spam</button>` : `<button type="button" class="${k.noContactar ? '' : 'peligro'}" data-cl-nocont="${k.contactoId}">${I('block')}${k.noContactar ? 'Quitar de no contactar' : 'Marcar no contactar'}</button>`}`);
    return; }
  const qu = t.closest('[data-cl-quitar]'); if (qu) { ckCerrarFlotantes(); crmApi('PATCH', `/crm/contactos/${+qu.dataset.clQuitar}`, {cambios: {guardado: false}}).then(() => { toast('Quitado de contactos: su conversación sigue en la bandeja'); clCargar(true); }).catch(err => toast(err.message)); return; }
  const nc = t.closest('[data-cl-nocont]'); if (nc) { ckCerrarFlotantes(); const k = deId(nc.dataset.clNocont); if (!k) return; const poner = !k.noContactar;
    crmApi('PATCH', `/crm/contactos/${k.contactoId}`, {cambios: {noContactar: poner ? `marcado desde Contactos · ${(p => `${p.d} ${HC_MES[p.m]}`)(hcPartes(Date.now()))}` : false}}).then(() => { toast(poner ? 'Marcado como no contactar: no le llegan difusiones ni recordatorios' : 'Ya se le puede volver a escribir'); clCargar(true); }).catch(err => toast(err.message)); return; }
  const ns = t.closest('[data-cl-nospam]'); if (ns) { ckCerrarFlotantes(); crmApi('PATCH', `/crm/contactos/${+ns.dataset.clNospam}`, {cambios: {spam: null}}).then(() => { toast('Sacado de spam'); clCargar(true); }).catch(err => toast(err.message)); return; }
  const ba = t.closest('[data-clb-asig]'); if (ba) { const a = ba.dataset.clbAsig; clEnGrupo(() => ({asig: a}), n => `${n} ${n === 1 ? 'contacto asignado' : 'contactos asignados'} a ${a}`); return; }
  const be = t.closest('[data-clb-etapa]'); if (be) { const et = be.dataset.clbEtapa; clEnGrupo(() => ({etapa: et}), n => `${n} ${n === 1 ? 'contacto pasó' : 'contactos pasaron'} a «${et}»`); return; }
  const bt = t.closest('[data-clb-tag]'); if (bt) { const tg = bt.dataset.clbTag; clEnGrupo(k => ({tags: [...new Set([...(k.tags || []), tg])]}), n => `Etiqueta «${tg}» agregada a ${n} ${n === 1 ? 'contacto' : 'contactos'}`); return; }
  if (t.closest('[data-cl-dif]')) { if (st.rol !== 'l') { toast('Las difusiones las envía el líder de Ventas'); return; } const ids = [...C.sel.keys()], n = ids.length; C.sel.clear(); st.pagina = 'difusiones'; st.dif = {paso: 1, aud: new Set(), tpl: (TPL[0] || {}).n || '', linea: (LINEAS[0] || {}).id || null, cuando: 'ahora', seleccion: n, ids, publico: 'sel', n: `Difusión a ${n} contactos elegidos`}; render(); return; }
  if (t.closest('[data-cl-exp]')) { const L = [...C.sel.values()], q = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const csv = ['Nombre,Teléfono,Correo,Etapa,Miembro,Etiquetas,Origen', ...L.map(k => [k.n, k.tel, k.correo, k.etapa, k.asig, (k.tags || []).join(' · '), clOrigen(k)].map(q).join(','))].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], {type: 'text/csv'})); a.download = `contactos-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(a.href); toast(`${L.length} ${L.length === 1 ? 'contacto exportado' : 'contactos exportados'}`); return; }
  // Tocar la fila (fuera de la casilla y del «⋯») abre o cierra la ficha al lado.
  const fi = t.closest('[data-cl-fila]'); if (fi && !t.closest('input,button,a')) { const id = +fi.dataset.clFila; C.ficha = C.ficha === id ? null : id; render(); return; }
}, true);
// Los filtros y el orden cambian la lista desde la página 1.
document.addEventListener('click', e => { if (st.pagina === 'contactos' && e.target instanceof Element && e.target.closest('[data-ck-f],[data-ct-quitar],[data-ct-ord]')) { st.cl.pag = 1; st.cl.ficha = null; } }, true);
document.getElementById('page').addEventListener('input', e => { if (st.pagina === 'contactos' && e.target.id === 'ct-q') st.cl.pag = 1; }, true);

document.head.insertAdjacentHTML('beforeend', `<style>
.cl{display:flex;flex-direction:column;gap:14px;height:100%;min-height:0}
.cl-top{display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap}.cl-top > div:first-child{flex:1;min-width:200px}
.cl-top h2{margin:0;font-size:24px;letter-spacing:-.02em}.cl-top p{margin:2px 0 0;color:var(--ink3);font-variant-numeric:tabular-nums}
.cl-top .acc{display:flex;gap:8px;flex-wrap:wrap}
.cl-split{flex:1;min-height:0;display:flex;gap:14px}
.cl-caja{flex:1;min-width:0;display:flex;flex-direction:column;border:1px solid var(--line);border-radius:14px;background:#fff;overflow:hidden}
.cl-bar{flex-wrap:wrap}
.cl-vista{font-weight:600;color:var(--ink)}.cl-vista em{font-style:normal;font-weight:500;font-size:12px;color:var(--ink3);font-variant-numeric:tabular-nums}
/* La búsqueda en una sola línea: si no cabe, el texto se corta con «…» */
.cl-q{flex:1 1 220px;min-width:180px;max-width:340px}
.cl-q input{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cl-q input::placeholder{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cl-tw{flex:1;min-height:0;overflow:auto}
.cl-tw thead th{position:sticky;top:0;z-index:1}
.cl-tw tr[data-cl-fila]{cursor:pointer}
.cl-tw tr.cl-abierta td{background:#fffbe6}
.cl-pag{display:flex;align-items:center;gap:18px;padding:10px 14px;border-top:1px solid var(--line);background:#fbfbfc;font-size:13px;color:var(--ink2);flex-wrap:wrap}
.cl-pt{flex:1;min-width:180px}.cl-pt b{color:var(--ink);font-variant-numeric:tabular-nums}
.cl-pp{display:inline-flex;align-items:center;gap:8px}.cl-pp button{display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 9px;border:1px solid var(--line);border-radius:8px;background:#fff;font:inherit;font-size:13px;cursor:pointer}
.cl-pp svg{width:13px;height:13px}
.cl-pn{display:flex;align-items:center;gap:4px}
.cl-pn button{min-width:32px;height:32px;padding:0 6px;border:1px solid transparent;border-radius:8px;background:none;font:inherit;font-size:13px;font-variant-numeric:tabular-nums;display:grid;place-items:center;cursor:pointer;color:var(--ink)}
.cl-pn button:hover:not(:disabled){background:#f1f5f9}.cl-pn button.on{background:#0b0b10;color:#fff;font-weight:600}
.cl-pn .fl{border-color:var(--line);background:#fff}.cl-pn .fl:disabled{opacity:.4;cursor:default}.cl-pn .fl svg{width:14px;height:14px}.cl-pn .fl.sig svg{transform:rotate(180deg)}
.cl-pn span{padding:0 4px;color:var(--ink3)}
.cl-gira{display:inline-block;width:12px;height:12px;margin-left:6px;border:2px solid #e5e9f0;border-top-color:#0b0b10;border-radius:50%;vertical-align:-2px;animation:lc-gira .8s linear infinite}
.cl-fi{width:340px;flex:none;border:1px solid var(--line);border-radius:14px;background:#fff;padding:18px;display:flex;flex-direction:column;gap:14px;overflow:auto;animation:cl-entra .35s cubic-bezier(.16,1,.3,1)}
@keyframes cl-entra{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:none}}
.cl-fi-h{display:flex;align-items:center;gap:12px}.cl-fi-h > div{flex:1;min-width:0}.cl-fi-h b{display:block;font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cl-fi-h small{color:var(--ink3);font-variant-numeric:tabular-nums}
.cl-fi-h .av{width:46px;height:46px;font-size:15px}
.cl-x{width:30px;height:30px;border:0;border-radius:8px;background:none;color:#dc2626;display:grid;place-items:center;cursor:pointer}.cl-x:hover{background:#fee2e2}.cl-x svg{width:16px;height:16px}
.cl-fi-acc{display:grid;grid-template-columns:1fr 1fr;gap:8px}.cl-fi-acc button{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:38px;border:1px solid var(--line);border-radius:10px;background:#fff;font:inherit;font-size:13px;font-weight:600;cursor:pointer}
.cl-fi-acc button.pri{background:#FFD21F;border-color:#FFD21F}.cl-fi-acc button:only-child{grid-column:1 / -1}.cl-fi-acc svg{width:16px;height:16px}
.cl-fi dl{margin:0;border:1px solid var(--line2);border-radius:10px;overflow:hidden}
.cl-fi dl div{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 12px;border-top:1px solid var(--line2)}.cl-fi dl div:first-child{border-top:0}
.cl-fi dt{color:var(--ink3);font-size:12.5px;flex:none}.cl-fi dd{margin:0;font-size:13px;text-align:right;display:flex;flex-wrap:wrap;justify-content:flex-end;gap:4px}
.cl-fi h6{margin:2px 0 0;font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--ink3)}
.cl-msj{display:grid;gap:6px}.cl-msj p{margin:0;padding:8px 11px;border-radius:12px;font-size:13px;max-width:85%;overflow-wrap:anywhere}
.cl-msj .in{background:#f3f4f6;justify-self:start}.cl-msj .out{background:#FFEC9E;justify-self:end}.cl-msj .cl-nada{background:none;padding:0;color:var(--ink3);max-width:none}
.ck-flmenu [data-cl-v],.ck-flmenu [data-ck-seg]{display:flex;align-items:center;gap:9px}.ck-flmenu [data-cl-v] span,.ck-flmenu [data-ck-seg] span{flex:1;text-align:left}.ck-flmenu [data-cl-v] em{font-style:normal;font-size:12px;color:var(--ink3);font-variant-numeric:tabular-nums}
.ck-flmenu [data-cl-v][aria-checked="true"]{background:#fff7cc;font-weight:600}
@media (max-width:1100px){.cl-split.con-ficha{flex-direction:column}.cl-fi{width:auto}}
@media (prefers-reduced-motion:reduce){.cl-fi,.cl-gira{animation:none}}
</style>`);
