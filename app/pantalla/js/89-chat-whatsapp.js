/* ── El chat como WhatsApp (maqueta aprobada, versión 316, 12-nov; armada sobre el CRM real):
   1 · La encuesta al finalizar sale como el mensaje que le llegó al cliente: su texto, hora y chulitos, y el botón
       «Responder encuesta». El texto y el botón los guarda el API al enviarla (encuesta.ts, encuesta.cuerpo y .boton);
       en las de antes, el de la configuración del equipo.
   2 · La hora y los chulitos hacia adentro (cliente a la izquierda, tuyos a la derecha); el chulito sin el relleno de
       .est; en mensajes seguidos la hora queda dentro de su burbuja (antes quedaba debajo: 88-burbujas buscaba la burbuja
       justo antes y ahí estaba el envoltorio de las reacciones, .rr-m).
   3 · Sin la etiqueta de espera en el chat (ya sale en la tarjeta) ni avatares al lado de las burbujas.
   4 · Opciones del mensaje: en escritorio, al pasar el cursor, una flechita dentro de la burbuja (Responder, Copiar,
       Seleccionar; el menú de siempre de 88-responder, sin Reenviar) y el botón de emoji aparte (6 reacciones y el +, que
       abre el mismo selector completo del compositor). En tablet y celular, mantener presionado levanta el mensaje:
       reacciones arriba y opciones abajo, por separado.
   5 · Seleccionar: casilla a la izquierda de cada mensaje, la fila elegida resaltada y, en lugar del compositor, la barra
       con la X roja, cuántos van, Copiar y Destacar.
   6 · Fijar (de la conversación, lo ve todo el equipo, hasta 3) y Destacar (de cada persona): PATCH …/mensajes/:id/marcas.
       Los fijados salen en una franja arriba del chat (tocarla lleva al mensaje y pasa al siguiente); los destacados llevan
       una estrella junto a la hora y se ven en el ⋯ del chat, «Mensajes destacados». ── */
(() => {
  const SV = d => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const IC = {
    chev: SV('<path d="m6 9 6 6 6-6"/>'),
    smile: SV('<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4 4 0 0 0 7 0"/><path d="M9 9.5h.01M15 9.5h.01"/>'),
    mas: SV('<path d="M12 5v14M5 12h14"/>'),
    sel: SV('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8.5 12 2.5 2.5 4.5-5"/>'),
    ok: SV('<path d="m5 12 4.5 4.5L19 7"/>'),
    fijar: SV('<path d="M9 4h6l-1 6 3 3H7l3-3z"/><path d="M12 13v7"/>'),
    dest: SV('<path d="M12 3.2l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.5l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>'),
  };
  const MINI = d => `<svg class="mk" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const YO = () => (typeof CRM_YO === 'object' && CRM_YO && CRM_YO.id) || '';
  const fijado = m => !!(m && m.fijado);
  const destacado = m => !!(m && Array.isArray(m.dest) && m.dest.includes(YO()));
  const ESTRELLA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.5l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/></svg>';
  const angosto = () => matchMedia('(hover:none), (max-width:1000px)').matches;
  const primera = s => { const p = String(s ?? '').trim().split(/\s+/)[0] || ''; return /\p{L}/u.test(p) && !p.includes('@') ? p : ''; };

  /* ── 1 · La encuesta en el chat ── */
  const DEF_MSG = '¡Gracias por escribirnos, {{nombre}}! ¿Nos ayudas con dos preguntas sobre tu atención? Toma menos de un minuto.';
  const rellenar = (t, v) => { let s = String(t ?? ''); for (const [k, x] of Object.entries(v)) { const val = String(x ?? '').trim(); s = val ? s.split(`{{${k}}}`).join(val) : s.replace(new RegExp(`\\s*,?\\s*\\{\\{${k}\\}\\}`, 'g'), ''); } return s.replace(/[ \t]{2,}/g, ' ').trim(); };
  function textoEncuesta(c, m){
    const e = m && m.encuesta && typeof m.encuesta === 'object' ? m.encuesta : {};
    if (typeof e.cuerpo === 'string' && e.cuerpo.trim()) return e.cuerpo.trim();
    const eq = (c && c.equipo) || 'Ventas', por = CFG && CFG.encuestas && CFG.encuestas[eq] ? CFG.encuestas[eq] : (CFG && CFG.encuesta) || {};
    return rellenar(String(por.msg || '').trim() || DEF_MSG, {nombre: primera(c && c.n), asesor: primera(c && c.asig), empresa: (ESPACIO && ESPACIO.nombre) || 'la empresa'});
  }
  const esEncuestaEnviada = m => m && m.ev === 'star' && (m.encuesta || /^Encuesta enviada por WhatsApp/.test(m.t || '')) && m._estado !== 'fallido' && !/^La encuesta no salió/.test(m.t || '');
  const sueltoAntes = chSuelto;
  chSuelto = function(m){
    if (!esEncuestaEnviada(m)) return sueltoAntes.apply(this, arguments);
    const c = CONV.find(x => x.id === st.sel);
    const boton = (m.encuesta && typeof m.encuesta === 'object' && m.encuesta.boton) || 'Responder encuesta';
    return `<div class="ch-fila yo enc-fila"><div class="ch-col"><div class="ch-b out ult enc"><span class="wb-n">${ESTRELLA}Encuesta de satisfacción</span>${esc(textoEncuesta(c, m))}<span class="enc-bt">${I('template')}${esc(boton)}</span></div>${chPie(m, true)}</div>${chAvatarPersona((c && c.asig) || yo)}</div>`;
  };

  /* ── 2 y 4 · El pintado del chat: la hora dentro de su burbuja, la flechita y el emoji, y las casillas ── */
  const SEL = {on: false, ids: new Set()};
  const RAPIDAS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
  const chatAntes = pintarChat;
  pintarChat = function(){
    const doc = new DOMParser().parseFromString(`<body>${chatAntes.apply(this, arguments)}</body>`, 'text/html');
    const c = CONV.find(x => x.id === st.sel);
    for (const t of doc.body.querySelectorAll('.wb-t.suelto')) {
      const w = t.previousElementSibling, b = w && w.classList.contains('rr-m') ? w.querySelector(':scope > .ch-b') : null;
      if (b) { t.classList.remove('suelto'); b.append(t); }
    }
    for (const w of doc.body.querySelectorAll('.rr-m[data-rr]')) {
      const id = w.dataset.rr, bf = w.querySelector(':scope > .rr-bf'); if (bf) bf.remove();
      if (SEL.on) { const si = SEL.ids.has(id); if (si) w.classList.add('rr-sel'); w.insertAdjacentHTML('afterbegin', `<span class="rr-ck" role="checkbox" aria-checked="${si}" aria-label="Seleccionar mensaje">${si ? IC.ok : ''}</span>`); }
      const b = w.querySelector(':scope > .ch-b');
      if (b && !b.querySelector('.rr-chev')) b.insertAdjacentHTML('beforeend', `<button type="button" class="rr-chev" data-rr-menu="${esc(id)}" aria-label="Opciones del mensaje" aria-haspopup="menu">${IC.chev}</button>`);
      const m = c && rrMsg(c, id);
      if (m && rrReacciona(c, m)) w.insertAdjacentHTML('beforeend', `<button type="button" class="rr-emob" data-rr-pill="${esc(id)}" aria-label="Reaccionar">${IC.smile}</button>`);
      const t = b && b.querySelector('.wb-t');
      if (t && m && (fijado(m) || destacado(m))) t.insertAdjacentHTML('afterbegin', `${fijado(m) ? `<span class="mk-f" title="Fijado">${MINI('<path d="M9 4h6l-1 6 3 3H7l3-3z"/><path d="M12 13v7"/>')}</span>` : ''}${destacado(m) ? `<span class="mk-d" title="Destacado">${MINI('<path d="M12 3.2l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.5l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>')}</span>` : ''}`);
    }
    return doc.body.innerHTML;
  };
  const marcar = (id, si) => { document.querySelectorAll('.rr-m.rr-activo').forEach(x => x.classList.remove('rr-activo')); if (si && id) document.querySelectorAll(`.rr-m[data-rr="${CSS.escape(id)}"]`).forEach(x => x.classList.add('rr-activo')); };
  const masOp = m => `<hr><button type="button" role="menuitem" data-rr-fijar>${IC.fijar}${fijado(m) ? 'Desfijar' : 'Fijar'}</button><button type="button" role="menuitem" data-rr-dest>${IC.dest}${destacado(m) ? 'Quitar destacado' : 'Destacar'}</button><hr><button type="button" role="menuitem" data-rr-sel>${IC.sel}Seleccionar</button>`;
  // El menú de siempre (88-responder), sin Reenviar, se abra con la flecha o con clic derecho.
  const abrirMenuAntes = rrAbrirMenu;
  rrAbrirMenu = function(){ abrirMenuAntes.apply(this, arguments); rrMenu.querySelectorAll('[data-rr-reenv]').forEach(x => x.remove()); };
  let menuDe = null;
  document.addEventListener('click', e => { if (e.target.closest('.rr-menu')) menuDe = rrMenuDe; }, true);
  // La flecha abre solo las opciones: las reacciones van en el botón de emoji.
  document.addEventListener('click', e => {
    const ch = e.target.closest('.rr-chev');
    if (ch) { setTimeout(() => { if (rrMenu.hidden) { marcar(null, false); return; } rrMenu.classList.add('rr-solo-op'); if (!rrMenu.querySelector('[data-rr-sel]')) rrMenu.insertAdjacentHTML('beforeend', masOp(rrMsg(rrConv(), ch.dataset.rrMenu))); marcar(ch.dataset.rrMenu, true); }); return; }
    if (e.target.closest('[data-rr-menu]')) rrMenu.classList.remove('rr-solo-op');
    if (e.target.closest('.rr-menu [data-rr-sel]')) entrarSel(menuDe);
    else if (e.target.closest('.rr-menu [data-rr-fijar]')) alternarFijado(menuDe);
    else if (e.target.closest('.rr-menu [data-rr-dest]')) alternarDestacado([menuDe]);
  });

  /* ── 6 · Fijar y Destacar ── */
  const quitarCampo = (o, k, v) => { if (v === undefined) delete o[k]; else o[k] = v; };
  async function marcas(ids, cambios, ok){
    const c = rrConv(); if (!c) return;
    const ms = ids.map(id => rrMsg(c, id)).filter(Boolean); if (!ms.length) return;
    const antes = ms.map(m => ({m, fijado: m.fijado, dest: m.dest}));
    for (const m of ms) {
      if ('fijar' in cambios) quitarCampo(m, 'fijado', cambios.fijar ? {por: YO(), en: new Date().toISOString()} : undefined);
      if ('destacar' in cambios) { const d = new Set(Array.isArray(m.dest) ? m.dest : []); if (cambios.destacar) d.add(YO()); else d.delete(YO()); quitarCampo(m, 'dest', d.size ? [...d] : undefined); }
    }
    chat();
    try {
      for (const m of ms) {
        const r = await crmApi('PATCH', `/crm/conversaciones/${c.id}/mensajes/${encodeURIComponent(m._id)}/marcas`, cambios);
        if (r) { quitarCampo(m, 'fijado', r.fijado || undefined); quitarCampo(m, 'dest', Array.isArray(r.dest) ? r.dest : undefined); }
      }
      if (ok) toast(ok);
    } catch (err) {
      for (const a of antes) { quitarCampo(a.m, 'fijado', a.fijado); quitarCampo(a.m, 'dest', a.dest); }
      toast(err.message || 'No se pudo guardar');
    }
    if (st.sel === c.id) chat();
  }
  function alternarFijado(id){ const m = rrMsg(rrConv(), id); if (!m) return; const si = !fijado(m); marcas([id], {fijar: si}, si ? 'Mensaje fijado' : 'Mensaje desfijado'); }
  function alternarDestacado(ids){
    const c = rrConv(), ms = ids.map(id => rrMsg(c, id)).filter(Boolean); if (!ms.length) return;
    const si = !ms.every(destacado);
    marcas(ms.map(m => m._id), {destacar: si}, si ? (ms.length === 1 ? 'Mensaje destacado' : `${ms.length} mensajes destacados`) : (ms.length === 1 ? 'Destacado quitado' : 'Destacados quitados'));
  }
  // Ir a un mensaje: el chat baja hasta él y lo hace brillar (como al tocar una cita, 88-responder).
  function irAlMensaje(id){
    let el = document.querySelector(`#msgs .rr-m[data-rr="${CSS.escape(id)}"]`);
    // Si está más arriba de lo dibujado (89-chat-por-partes), primero se dibuja.
    if (!el && typeof chppMostrar === 'function' && chppMostrar(id)) el = document.querySelector(`#msgs .rr-m[data-rr="${CSS.escape(id)}"]`);
    if (!el) { toast('Ese mensaje ya no está en lo que se ve del chat'); return; }
    el.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center'});
    el.classList.remove('rr-brilla'); void el.offsetWidth; el.classList.add('rr-brilla');
  }
  // La franja de fijados arriba del chat: el más reciente primero; cada toque lleva a uno y pasa al siguiente.
  let fjI = 0, fjConv = null;
  function pintarFijados(){
    const caja = document.getElementById('msgs'); if (!caja) return;
    let bar = document.getElementById('fj-bar');
    const c = CONV.find(x => x.id === st.sel);
    const L = c ? c.msgs.filter(m => m && m._id && m.fijado).sort((a, b) => String(b.fijado.en || '').localeCompare(String(a.fijado.en || ''))) : [];
    if (!L.length) { if (bar) bar.remove(); return; }
    if (fjConv !== st.sel) { fjI = 0; fjConv = st.sel; }
    if (fjI >= L.length) fjI = 0;
    if (!bar) { bar = document.createElement('button'); bar.type = 'button'; bar.id = 'fj-bar'; bar.className = 'fj-bar'; caja.before(bar); }
    const m = L[fjI];
    bar.dataset.id = m._id; bar.setAttribute('aria-label', 'Ir al mensaje fijado');
    bar.replaceChildren();
    bar.insertAdjacentHTML('beforeend', `<span class="fj-ic">${IC.fijar}</span><span class="fj-tx"><b>Mensaje fijado${L.length > 1 ? ` · ${fjI + 1} de ${L.length}` : ''}</b><small>${esc(`${rrQuien(c, m)}: ${rrTexto(m)}`)}</small></span>`);
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('#fj-bar'); if (!b) return;
    irAlMensaje(b.dataset.id); fjI++; pintarFijados();
  });
  // ⋯ del chat: «Mensajes destacados» (los tuyos en esta conversación).
  document.getElementById('b-mas').addEventListener('click', () => {
    const m = document.getElementById('m-mas'); if (m.hidden || m.querySelector('[data-dst-ver]')) return;
    const hr = m.querySelector('hr');
    const html = `<button type="button" data-dst-ver>${IC.dest}Mensajes destacados</button>`;
    if (hr) hr.insertAdjacentHTML('beforebegin', html); else m.insertAdjacentHTML('beforeend', html);
  });
  document.getElementById('m-mas').addEventListener('click', e => {
    if (!e.target.closest('[data-dst-ver]')) return;
    const c = rrConv(); if (!c) return;
    const L = c.msgs.filter(m => m && m._id && destacado(m));
    const filas = L.map(m => `<button type="button" class="dst-it" data-dst-ir="${esc(m._id)}"><span class="dst-q"><b>${esc(rrQuien(c, m))}</b><small>${esc(m.h || '')}</small></span><span class="dst-t">${esc(rrTexto(m))}</span></button>`).join('');
    abrirDialogo(`<h3>Mensajes destacados</h3><p>${L.length ? 'Los que destacaste en esta conversación. Toca uno para ir a él.' : 'Todavía no destacaste mensajes en esta conversación. Abre las opciones de un mensaje y toca Destacar.'}</p>${L.length ? `<div class="dst-lista">${filas}</div>` : ''}<div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cerrar</button></div>`, 'dst-dlg');
  });
  document.getElementById('ov-x').addEventListener('click', e => {
    const b = e.target.closest('[data-dst-ir]'); if (!b) return;
    cerrarDialogo(); irAlMensaje(b.dataset.dstIr);
  });

  /* ── 5 · Seleccionar ── */
  const selCuenta = () => SEL.ids.size === 1 ? '1 seleccionado' : `${SEL.ids.size} seleccionados`;
  function pintarSel(){
    const comp = document.getElementById('comp'), app = document.getElementById('app'); if (!comp) return;
    app.classList.toggle('rr-sel-on', SEL.on); comp.classList.toggle('rr-sel-comp', SEL.on);
    let bar = document.getElementById('rr-selbar');
    if (!SEL.on) { if (bar) bar.remove(); return; }
    if (!bar) {
      comp.insertAdjacentHTML('afterbegin', `<div class="rr-selbar" id="rr-selbar" role="toolbar" aria-label="Mensajes seleccionados"><button type="button" class="rr-selx" data-sel-salir aria-label="Salir de la selección">${RR_IC.x}</button><b class="rr-seln"></b><span class="rr-selsp"></span><button type="button" class="btn" data-sel-copiar>${RR_IC.copia}Copiar</button><button type="button" class="btn" data-sel-dest>${IC.dest}Destacar</button></div>`);
      bar = document.getElementById('rr-selbar');
    }
    bar.querySelector('.rr-seln').textContent = selCuenta();
    bar.querySelectorAll('[data-sel-copiar],[data-sel-dest]').forEach(b => { b.disabled = !SEL.ids.size; });
  }
  function entrarSel(id){ cerrarTodo(); rrCerrarMenu(); SEL.on = true; SEL.ids = new Set(id ? [id] : []); chat(); pintarSel(); }
  function salirSel(){ SEL.on = false; SEL.ids.clear(); chat(); pintarSel(); }
  // Otra conversación: la selección no la sigue.
  let selConv = null;
  const chatSel = chat;
  chat = function(){ if (SEL.on && selConv !== null && selConv !== st.sel) { SEL.on = false; SEL.ids.clear(); } selConv = st.sel; const r = chatSel.apply(this, arguments); pintarSel(); pintarFijados(); alinearCasillas(); return r; };
  // Todas las casillas en una misma columna, a la izquierda del chat, cada una a la altura de su mensaje.
  function alinearCasillas(){
    if (!SEL.on) return;
    const caja = document.getElementById('msgs'); if (!caja) return;
    const x = caja.getBoundingClientRect().left + 14;
    caja.querySelectorAll('.rr-ck').forEach(ck => { ck.style.left = (x - ck.parentElement.getBoundingClientRect().left) + 'px'; });
  }
  addEventListener('resize', alinearCasillas);
  document.addEventListener('click', e => {
    if (!SEL.on) return;
    if (e.target.closest('[data-sel-salir]')) { salirSel(); return; }
    if (e.target.closest('[data-sel-copiar]')) {
      const c = rrConv(), lineas = c ? c.msgs.filter(m => m && m._id && SEL.ids.has(m._id)).map(m => `${rrQuien(c, m)}: ${rrTexto(m)}`) : [];
      navigator.clipboard.writeText(lineas.join('\n')).then(() => toast(lineas.length === 1 ? 'Mensaje copiado' : `${lineas.length} mensajes copiados`), () => toast('No se pudo copiar'));
      salirSel(); return;
    }
    if (e.target.closest('[data-sel-dest]')) { const ids = [...SEL.ids]; salirSel(); alternarDestacado(ids); return; }
    const w = e.target.closest('#msgs .rr-m'); if (!w) return;
    e.preventDefault(); e.stopPropagation();
    const id = w.dataset.rr; if (SEL.ids.has(id)) SEL.ids.delete(id); else SEL.ids.add(id);
    chat();
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && SEL.on) { salirSel(); e.stopPropagation(); } }, true);

  /* ── Reacciones: la barra de 6 y el +, que abre el mismo selector completo del compositor (emoji-picker) ── */
  let barra = null, selector = null;
  function cerrarReacciones(){ if (barra) barra.remove(); if (selector) selector.remove(); barra = selector = null; if (rrMenu.hidden) marcar(null, false); }
  function barraHTML(id){ const m = rrMsg(rrConv(), id), mia = m && m.reac && m.reac.yo; return RAPIDAS.map(e => `<button type="button" data-rr-r="${e}" class="${e === mia ? 'on' : ''}" aria-label="Reaccionar ${e}">${e}</button>`).join('') + `<button type="button" class="rr-mas" data-rr-todos aria-label="Todos los emojis">${IC.mas}</button>`; }
  function abrirBarra(boton, id){
    cerrarReacciones(); rrCerrarMenu();
    barra = document.createElement('div'); barra.className = 'rr-pill'; barra.setAttribute('role', 'toolbar'); barra.setAttribute('aria-label', 'Reaccionar'); barra.dataset.id = id;
    barra.insertAdjacentHTML('beforeend', barraHTML(id)); document.body.append(barra);
    const r = boton.getBoundingClientRect(), w = barra.offsetWidth, h = barra.offsetHeight;
    barra.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
    barra.style.top = Math.max(8, r.top - h - 8) + 'px';
    marcar(id, true);
  }
  // El selector toma el lugar de la barra: alineado con ella y hacia arriba; si arriba no cabe, hacia abajo.
  function ubicarSel(cont, r){ const w = cont.offsetWidth || 318, h = cont.offsetHeight || 336; cont.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left)) + 'px'; cont.style.top = (r.bottom - h > 8 ? r.bottom - h : Math.min(innerHeight - h - 8, r.top)) + 'px'; }
  function abrirSelector(r, id, hoja){
    if (selector) selector.remove();
    const cont = document.createElement('div');
    if (hoja) { cont.className = 'rr-hoja'; cont.insertAdjacentHTML('beforeend', '<span class="rr-asa"></span>'); }
    else cont.className = 'emop emop-full rr-reacc';
    selector = cont; document.body.append(cont);
    Promise.all([import('__BASE__/vendor/emoji/picker.js'), import('__BASE__/vendor/emoji/es.js')]).then(([, es]) => {
      if (selector !== cont) return;
      const ep = document.createElement('emoji-picker');
      ep.i18n = {...es.default, searchLabel: 'Buscar emoji'};
      ep.setAttribute('locale', 'es'); ep.setAttribute('data-source', '__BASE__/vendor/emoji/es.json'); if (!hoja) ep.className = 'emop-ep';
      ep.addEventListener('emoji-click', ev => { const u = ev.detail.unicode; cerrarTodo(); rrReaccionar(id, u); });
      cont.append(ep);
      if (!hoja) ubicarSel(cont, r);
    }).catch(() => {});
    if (!hoja) ubicarSel(cont, r);
  }

  /* ── Tablet y celular: mantener presionado levanta el mensaje, con las reacciones arriba y las opciones abajo ── */
  let capa = null, foco = null;
  function cerrarFoco(){ if (capa) capa.remove(); if (foco) foco.remove(); capa = foco = null; }
  function cerrarTodo(){ cerrarFoco(); cerrarReacciones(); }
  function abrirFoco(w){
    const id = w.dataset.rr, b = w.querySelector(':scope > .ch-b'); if (!b) return;
    cerrarTodo(); rrCerrarMenu();
    const r = b.getBoundingClientRect(), out = w.classList.contains('out'), c = rrConv(), m = rrMsg(c, id), texto = rrTexto(m);
    capa = document.createElement('div'); capa.className = 'rr-capa'; capa.addEventListener('click', cerrarTodo);
    foco = document.createElement('div'); foco.className = 'rr-foco ' + (out ? 'out' : 'in'); foco.dataset.id = id;
    const copia = b.cloneNode(true); copia.querySelectorAll('.rr-chev').forEach(x => x.remove());
    foco.insertAdjacentHTML('beforeend', m && rrReacciona(c, m) ? `<div class="rr-pill" role="toolbar" aria-label="Reaccionar">${barraHTML(id)}</div>` : '');
    foco.append(copia);
    foco.insertAdjacentHTML('beforeend', `<div class="rr-ops" role="menu" aria-label="Opciones del mensaje"><button type="button" role="menuitem" data-f-resp>${RR_IC.resp}Responder</button>${texto ? `<button type="button" role="menuitem" data-f-copiar>${RR_IC.copia}Copiar</button>` : ''}${masOp(m)}</div>`);
    document.body.append(capa, foco);
    const h = foco.offsetHeight, pill = foco.querySelector('.rr-pill'), arriba = pill ? pill.offsetHeight + 10 : 0;
    foco.style.top = Math.max(16, Math.min(innerHeight - h - 16, r.top - arriba)) + 'px';
    if (out) foco.style.right = Math.max(16, innerWidth - r.right) + 'px'; else foco.style.left = Math.max(16, r.left) + 'px';
  }
  document.addEventListener('contextmenu', e => {
    if (!angosto() || SEL.on) return;
    const w = e.target.closest('#msgs .rr-m, #ec-msgs .rr-m'); if (!w || e.target.closest('a,video,audio')) return;
    e.preventDefault(); e.stopPropagation(); abrirFoco(w);
  }, true);
  // Con el mouse en una pantalla angosta: mantener presionado medio segundo (en el celular lo da el contextmenu).
  let tiempo = null;
  document.addEventListener('pointerdown', e => {
    if (!angosto() || e.pointerType === 'touch' || SEL.on) return;
    const w = e.target.closest('#msgs .rr-m, #ec-msgs .rr-m'); if (!w) return;
    clearTimeout(tiempo); tiempo = setTimeout(() => abrirFoco(w), 450);
  });
  ['pointerup', 'pointercancel', 'pointermove'].forEach(ev => document.addEventListener(ev, e => { if (ev !== 'pointermove' || Math.abs(e.movementX) + Math.abs(e.movementY) > 6) clearTimeout(tiempo); }));

  document.addEventListener('click', e => {
    const t = e.target;
    const pb = t.closest('[data-rr-pill]'); if (pb) { e.stopPropagation(); if (barra && barra.dataset.id === pb.dataset.rrPill) cerrarReacciones(); else abrirBarra(pb, pb.dataset.rrPill); return; }
    const enBarra = t.closest('.rr-pill');
    if (enBarra) {
      e.stopPropagation();
      const id = enBarra.dataset.id || (foco && foco.dataset.id);
      const rb = t.closest('[data-rr-r]'); if (rb) { cerrarTodo(); rrReaccionar(id, rb.dataset.rrR); return; }
      if (t.closest('[data-rr-todos]')) { const hoja = !!foco, r = enBarra.getBoundingClientRect(); if (hoja) { foco.remove(); foco = null; } else cerrarFoco(); if (barra) { barra.remove(); barra = null; } abrirSelector(r, id, hoja); }
      return;
    }
    if (foco && t.closest('.rr-foco')) {
      e.stopPropagation();
      const id = foco.dataset.id, m = rrMsg(rrConv(), id);
      if (t.closest('[data-f-resp]')) { cerrarTodo(); rrResponder(id); }
      else if (t.closest('[data-f-copiar]')) { cerrarTodo(); navigator.clipboard.writeText(rrTexto(m)).then(() => toast('Mensaje copiado'), () => toast('No se pudo copiar')); }
      else if (t.closest('[data-rr-sel]')) { cerrarTodo(); entrarSel(id); }
      else if (t.closest('[data-rr-fijar]')) { cerrarTodo(); alternarFijado(id); }
      else if (t.closest('[data-rr-dest]')) { cerrarTodo(); alternarDestacado([id]); }
      return;
    }
    if (selector && (t.closest('.rr-reacc') || t.closest('.rr-hoja'))) return;
    if (barra || selector) cerrarReacciones();
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && (barra || selector || foco)) { cerrarTodo(); e.stopPropagation(); } }, true);
  ['msgs', 'ec-msgs'].map(x => document.getElementById(x)).filter(Boolean).forEach(cj => cj.addEventListener('wheel', cerrarReacciones, {passive: true}));
  addEventListener('resize', cerrarTodo);

  document.head.insertAdjacentHTML('beforeend', `<style>
.ch-b.in .wb-t{justify-content:flex-start}
.ch-fila:not(.yo) .wb-t.suelto{align-self:flex-start}
.wb-t .est{padding:0;border-radius:0;background:none;gap:0}
.ch-b.enc{display:flex;flex-direction:column}
.ch-b.enc .wb-n{display:flex;align-items:center;gap:5px;order:0}
.ch-b.enc .wb-n svg{width:13px;height:13px;fill:currentColor;stroke:none}
.ch-b.enc .wb-t{order:2}
.ch-b.enc .enc-bt{order:3;display:flex;align-items:center;justify-content:center;gap:7px;margin:9px -14px -9px;padding:10px 14px 11px;border-top:1px solid rgba(122,106,44,.2);font-size:14px;font-weight:600;line-height:1.3;color:#8a6d00;white-space:normal}
.ch-b.enc .enc-bt svg{width:16px;height:16px}
.enc-fila{animation:enc-entra .5s cubic-bezier(.32,.72,0,1) both}
@keyframes enc-entra{from{opacity:0;transform:translateY(8px) scale(.98)}}
#sla,#app .subtabs .cch-esp{display:none!important}
#msgs .ch-av,#ec-msgs .ch-av{display:none!important}
.rr-m .ch-b{position:relative}
.rr-chev{position:absolute;top:5px;right:5px;width:28px;height:22px;padding:0;border:0;border-radius:0 11px 0 12px;display:grid;place-items:center;color:#6b7280;cursor:pointer;background:linear-gradient(to left,#fff 62%,rgba(255,255,255,0));opacity:0;transform:translateY(-2px);transition:opacity .16s cubic-bezier(.23,1,.32,1),transform .2s cubic-bezier(.23,1,.32,1)}
.ch-b.out .rr-chev{background:linear-gradient(to left,#FFEC9E 62%,rgba(255,236,158,0));color:#7a6a2c}
.rr-chev svg{width:17px;height:17px}.rr-chev:hover{color:#0b0b10}
.rr-emob{position:absolute;top:50%;left:calc(100% + 8px);width:32px;height:32px;padding:0;border-radius:50%;background:#fff;border:1px solid #e5e9f0;box-shadow:0 2px 8px -3px rgba(15,23,42,.3);display:grid;place-items:center;color:#6b7280;cursor:pointer;opacity:0;transform:translateY(-50%) scale(.7);transition:opacity .18s cubic-bezier(.23,1,.32,1),transform .26s cubic-bezier(.34,1.4,.64,1)}
.rr-m.out .rr-emob{left:auto;right:calc(100% + 8px)}
.rr-emob svg{width:18px;height:18px}.rr-emob:hover{color:#0b0b10}
.rr-m:hover .rr-chev,.rr-m.rr-activo .rr-chev,.rr-chev:focus-visible{opacity:1;transform:none}
.rr-m:hover .rr-emob,.rr-m.rr-activo .rr-emob,.rr-emob:focus-visible{opacity:1;transform:translateY(-50%)}
.rr-menu.rr-solo-op .rr-emo,.rr-menu.rr-solo-op .rr-emo2{display:none}
.rr-menu > hr{border:0;border-top:1px solid #eef1f5;margin:4px 6px}
.rr-pill{position:fixed;z-index:80;display:flex;align-items:center;gap:2px;padding:6px 8px;border-radius:999px;background:#fff;border:1px solid #e5e9f0;box-shadow:0 14px 34px -14px rgba(15,23,42,.4);animation:rr-pill .3s cubic-bezier(.34,1.4,.64,1) both;transform-origin:bottom center}
@keyframes rr-pill{from{opacity:0;transform:translateY(6px) scale(.85)}}
.rr-pill button{width:38px;height:38px;padding:0;border:0;border-radius:50%;background:none;cursor:pointer;display:grid;place-items:center;font-size:23px;line-height:1;font-family:"Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif;transition:transform .2s cubic-bezier(.16,1,.3,1),background .15s;animation:rr-pop .32s cubic-bezier(.16,1,.3,1) both}
.rr-pill button:hover{transform:scale(1.22)}
.rr-pill button.on{background:#fff3b0}
.rr-pill .rr-mas{background:#f1f5f9;color:#4b5563;margin-left:4px}.rr-pill .rr-mas:hover{transform:none;background:#e5e9f0}
.rr-pill .rr-mas svg{width:18px;height:18px}
.emop.rr-reacc{z-index:81}
@media (hover:none),(max-width:1000px){.rr-chev,.rr-emob{display:none}}
.rr-capa{position:fixed;inset:0;z-index:90;background:rgba(15,23,42,.16);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);animation:rr-velo .22s ease-out both}
@keyframes rr-velo{from{opacity:0}}
.rr-foco{position:fixed;z-index:91;display:flex;flex-direction:column;gap:10px;max-width:calc(100vw - 32px)}
.rr-foco.out{align-items:flex-end}.rr-foco.in{align-items:flex-start}
.rr-foco .rr-pill{position:static}
.rr-foco .ch-b{max-width:min(82vw,520px);box-shadow:0 18px 40px -14px rgba(15,23,42,.35);animation:rr-alza .34s cubic-bezier(.34,1.3,.64,1) both;margin:0}
@keyframes rr-alza{from{transform:scale(.94)}}
.rr-foco .rr-ops{width:min(270px,calc(100vw - 32px));background:#fff;border-radius:18px;padding:6px;box-shadow:0 18px 40px -16px rgba(15,23,42,.35);display:grid;gap:1px;animation:rr-entra .28s cubic-bezier(.16,1,.3,1) .06s both}
.rr-foco .rr-ops button{display:flex;align-items:center;gap:12px;padding:11px 12px;border:0;border-radius:10px;background:none;font:inherit;font-size:15px;color:#1f2937;text-align:left;cursor:pointer}
.rr-foco .rr-ops button:hover{background:#f6f7f9}.rr-foco .rr-ops svg{width:19px;height:19px;color:#4b5563}
.rr-foco .rr-ops hr{border:0;border-top:1px solid #eef1f5;margin:4px 6px}
.rr-hoja{position:fixed;z-index:92;left:0;right:0;bottom:0;background:#fff;border-radius:22px 22px 0 0;padding:8px 0 calc(env(safe-area-inset-bottom, 0px) + 12px);box-shadow:0 -20px 50px -20px rgba(15,23,42,.35);animation:rr-hoja .4s cubic-bezier(.32,.72,0,1) both;max-height:70dvh;overflow:auto}
@keyframes rr-hoja{from{transform:translateY(100%)}}
.rr-asa{display:block;width:38px;height:5px;border-radius:3px;background:#d1d5db;margin:0 auto 6px}
.rr-hoja emoji-picker{width:100%;height:340px;--border-size:0;--num-columns:8;--emoji-size:1.5rem}
.rr-sel-on #msgs{overflow-x:hidden}
.rr-sel-on #msgs .ch-fila{position:relative;padding-left:36px;isolation:isolate}
.rr-sel-on #msgs .rr-m{cursor:pointer}
.rr-sel-on #msgs .rr-chev,.rr-sel-on #msgs .rr-emob{display:none}
.rr-ck{position:absolute;left:-30px;top:50%;margin-top:-10px;width:20px;height:20px;border-radius:6px;border:2px solid #9ca3af;background:#fff;display:grid;place-items:center;color:#0b0b10;transition:background .16s,border-color .16s}
.rr-ck svg{width:14px;height:14px;stroke-width:3}
.rr-m.rr-sel .rr-ck{background:#FFD21F;border-color:#FFD21F;animation:rr-ck .3s cubic-bezier(.34,1.4,.64,1)}
@keyframes rr-ck{from{transform:scale(.7)}}
.rr-sel-on #msgs .rr-m::before{content:"";position:absolute;left:-200vw;right:-200vw;top:-4px;bottom:-4px;z-index:-1;background:transparent;transition:background .18s}
.rr-sel-on #msgs .rr-m.rr-sel::before{background:rgba(255,210,31,.2)}
.comp.rr-sel-comp > :not(.rr-selbar){display:none!important}
.rr-selbar{display:flex;align-items:center;gap:10px;padding:14px 0 2px;animation:rr-entra .24s cubic-bezier(.16,1,.3,1)}
.rr-selbar b{font-size:14px;font-weight:600;color:#0b0b10;white-space:nowrap}.rr-selsp{flex:1}
.rr-selx{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;color:#dc2626;background:none;border:0;cursor:pointer}.rr-selx:hover{background:#fef2f2}.rr-selx svg{width:18px;height:18px}
.rr-selbar .btn{display:inline-flex;align-items:center;gap:7px}.rr-selbar .btn svg{width:16px;height:16px}
.wb-t .mk-f,.wb-t .mk-d{display:inline-flex}.wb-t .mk{width:12px;height:12px;stroke-width:2}
.wb-t .mk-d .mk{fill:currentColor;stroke:none;color:#b8860b}
.wb-t .mk-f .mk{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;color:#8a6d00}
.fj-bar{display:flex;align-items:center;gap:10px;width:100%;flex:none;padding:8px 16px;border:0;border-bottom:1px solid #eef1f5;background:#fff;font:inherit;text-align:left;cursor:pointer;animation:fj-entra .3s cubic-bezier(.32,.72,0,1) both;transition:background .15s}
.fj-bar:hover{background:#f8fafc}
@keyframes fj-entra{from{opacity:0;transform:translateY(-6px)}}
.fj-ic{width:30px;height:30px;border-radius:8px;background:#fff7d6;color:#8a6d00;display:grid;place-items:center;flex:none}.fj-ic svg{width:15px;height:15px}
.fj-tx{flex:1;min-width:0;display:grid}.fj-tx b{font-size:12.5px;font-weight:600;color:#8a6d00}.fj-tx small{font-size:13px;color:#374151;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dlg.dst-dlg .dst-lista{display:grid;gap:6px;max-height:min(420px,55dvh);overflow:auto;margin:4px 0}
.dst-it{display:grid;gap:3px;width:100%;padding:10px 12px;border:1px solid #eef1f5;border-radius:10px;background:#fff;font:inherit;text-align:left;cursor:pointer;transition:background .15s}
.dst-it:hover{background:#f8fafc}.dst-q{display:flex;justify-content:space-between;gap:10px}.dst-q b{font-size:12.5px;font-weight:600}.dst-q small{font-size:11.5px;color:#6b7280}
.dst-t{font-size:13.5px;color:#1f2937;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
@media (max-width:759.98px){.rr-sel-on #msgs .ch-fila{padding-left:32px}.rr-selbar .btn{padding:0 10px}}
@media (prefers-reduced-motion:reduce){.fj-bar,.enc-fila,.rr-pill,.rr-pill button,.rr-capa,.rr-foco .ch-b,.rr-foco .rr-ops,.rr-hoja,.rr-m.rr-sel .rr-ck,.rr-selbar{animation:none}.rr-chev,.rr-emob,.rr-ck{transition:none}}
</style>`);
})();
