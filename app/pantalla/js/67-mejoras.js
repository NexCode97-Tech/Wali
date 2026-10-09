/* ── Mejoras de la bandeja ──
   · Tablero 1, la bandeja: la estrella de favorito y el 🔥 en el encabezado del chat y en la tarjeta; las carpetas «Con
     recordatorio» y «Favoritos» (10-nucleo.js, CARPETAS); «Personas de <equipo>» en la barra del líder, con sus
     conversaciones abiertas y las que esperan respuesta; las notas privadas arriba en el panel del contacto; el
     recordatorio con día y hora (10-nucleo.js, recHtml).
   · Tableros 2, 3 y 4: «Exportar el chat» y «Marcar como spam» en el menú de más opciones, con sus diálogos
     (GET /crm/conversaciones/:id/exportar y POST /crm/conversaciones/:id/spam); Contactos › Spam (10-nucleo.js).
   · Tablero 9: la animación al mover una tarjeta del Embudo.
   Los favoritos son de cada persona (preferencia `favoritos`); el 🔥 es de la conversación (`fuego`, lo ve todo el
   equipo) y la mete en la carpeta «Calientes». */
(() => {
  const SVG = (d, cls = '') => `<svg viewBox="0 0 24 24" class="mj-svg${cls ? ' ' + cls : ''}" aria-hidden="true">${d}</svg>`;
  const ESTRELLA = '<path d="M12 3.2l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.5l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>';
  const CANDADO = '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>';
  const lectura = () => typeof crmSoloLectura === 'function' && crmSoloLectura();
  document.head.insertAdjacentHTML('beforeend', `<style>
.mj-svg{fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round;flex:none}
/* Encabezado del chat: favorito y 🔥 */
.chat-h .acts .btn.mj-estrella[aria-pressed="true"]{background:#fff8e1;border-color:#fcd34d;color:#b45309}
.chat-h .acts .btn.mj-estrella[aria-pressed="true"] svg{fill:#f59e0b;stroke:#f59e0b}
.chat-h .acts .btn.mj-fuego{font-size:16px;line-height:1}
/* 8-oct, maqueta aprobada: sin el botón de «Caliente» en el encabezado (sigue en el menú ⋯). */
.chat-h .acts .btn.mj-fuego{display:none!important}
.chat-h.mj-angosto .acts .btn:is(.mj-estrella,.mj-fuego){display:none}
.menu .mj-mfu{width:18px;flex:none;text-align:center;font-size:14px;line-height:1}
.chat-h .acts .btn.mj-fuego.off span{filter:grayscale(1);opacity:.5}
.chat-h .acts .btn.mj-fuego.on{background:#fff4ed;border-color:#fdba74}
/* Tarjeta: las marcas van junto al nombre */
.it .tj-l1{align-items:center}
.it .tj-l1 .mj-fav{width:13px;height:13px;color:#f59e0b;fill:#f59e0b;stroke:#f59e0b;flex:none}
.it .tj-l1 .mj-fu{font-size:13px;line-height:1;flex:none}
/* Barra: personas del equipo, debajo de cada equipo con su flecha */
#equipos li.mj-eq{position:relative}
#app #equipos li.mj-eq > button[data-t2]{padding-right:38px}
#app #equipos li .mj-tw{position:absolute;right:4px;top:50%;transform:translateY(-50%);width:28px;height:28px;padding:0;border-radius:7px;display:grid;place-items:center;color:var(--nx-mut)}
#app #equipos li .mj-tw:hover{color:#fff}
#equipos .mj-tw svg{width:14px;height:14px;transition:transform .15s}
#equipos .mj-tw[aria-expanded="true"] svg{transform:rotate(180deg)}
#equipos .mj-per{display:flex;align-items:center;gap:9px;width:100%;text-align:left}
#equipos .mj-mini{width:20px;height:20px;border-radius:50%;display:grid;place-items:center;color:#fff;font-size:8.5px;font-weight:600;flex:none;position:relative;overflow:hidden;line-height:1}
#equipos .mj-mini.sin{background:transparent;border:1.5px dashed #6b6b78;width:16px;height:16px;margin:0 2px;box-sizing:content-box}
#equipos .mj-nom{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#equipos .mj-per .n{margin-left:auto;font-size:12px;font-variant-numeric:tabular-nums}
#equipos .mj-r + .n{margin-left:0}
#equipos .mj-r{margin-left:auto;min-width:18px;height:18px;border-radius:999px;background:#fee2e2;color:#b91c1c;font-size:11px;font-weight:600;display:grid;place-items:center;padding:0 5px;flex:none}
/* Panel: notas privadas arriba */
.mj-notas{display:flex;flex-direction:column;gap:6px;padding:12px 14px;border:1px solid #fde68a;border-radius:12px;background:#fffbeb;margin-top:12px}
.mj-notas .cab{display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:#92400e}
.mj-notas .cab svg{width:14px;height:14px}
.mj-notas .cab button{margin-left:auto;font-weight:500;color:var(--blue-ink);font-size:12px}
.mj-notas p{margin:0;font-size:13px;line-height:1.45;color:var(--ink);white-space:pre-wrap;overflow-wrap:anywhere}
.mj-notas small{font-size:11.5px;color:#92400e;opacity:.85}
.mj-notas .otra{border-top:1px solid #fcecb3;padding-top:6px;display:flex;flex-direction:column;gap:6px}
.mj-notas .otra p{color:#4b5563}
/* Respuesta rápida: el audio sale como nota de voz (tablero 6) */
.mj-etq{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0 8px;border-radius:999px;background:#ecfdf3;color:#15803d;font-size:11.5px;font-weight:500;white-space:nowrap;flex:none}
.mj-etq svg{width:12px;height:12px}
/* Plantilla con video (tablero 7) */
.mj-arch{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--line);border-radius:12px}
.mj-arch .ic{width:36px;height:36px;border-radius:10px;background:var(--blue-soft);color:var(--blue-ink);display:grid;place-items:center;flex:none}
.mj-arch .ic svg{width:18px;height:18px}
.mj-arch b{display:block;font-size:13.5px;font-weight:400;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mj-arch small{display:block;font-size:12px;color:var(--ink3)}
.mj-x2{margin-left:auto;width:30px;height:30px;border:1px solid var(--line);border-radius:8px;display:grid;place-items:center;color:var(--ink3);flex:none}
.mj-x2 svg{width:13px;height:13px}
.mj-vid{height:150px;background:#1f2937;display:grid;place-items:center;color:#fff;border-radius:8px 8px 0 0}
.mj-vid span{width:46px;height:46px;border-radius:50%;background:rgba(255,255,255,.2);display:grid;place-items:center}
.mj-vid svg{width:18px;height:18px;fill:#fff;stroke:none}
.bub .mj-vid{margin:-8px -10px 8px;border-radius:10px 10px 0 0}
.mj-wa{background:#efeae2;border-radius:14px;padding:14px}
.mj-wab{background:#fff;border-radius:10px;overflow:hidden;max-width:330px;box-shadow:0 1px .5px rgba(11,20,26,.13)}
.mj-wab .mj-vid{border-radius:0}
.mj-wab .tx{padding:8px 10px;font-size:13px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}
.mj-row2{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:13px;border:1px solid var(--line);border-radius:12px;padding:12px 14px}
.mj-row2 b{font-weight:600;display:block}
.mj-row2 small{display:block;font-size:12px;color:var(--ink3)}
.mj-sw{flex:none;width:36px;height:20px;border-radius:999px;background:#cbd5e1;position:relative}
.mj-sw::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:.15s}
.mj-sw[aria-checked="true"]{background:var(--blue)}
.mj-sw[aria-checked="true"]::after{left:18px}
.mj-tpl .dsel{min-width:0!important}
/* Recordatorio: día y hora en dos columnas */
.rnew .rdos{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:8px}
/* El formulario queda al final del panel: los menús abren hacia arriba para no quedar cortados. */
.rnew .rdos .dsel .menu{top:auto!important;bottom:calc(100% + 4px);max-height:260px}
.rnew .rdos .sel{gap:8px}
.rnew .rdos .sel .mj-ri{width:15px;height:15px;color:#6b7280;flex:none}
/* Menú de más opciones */
#m-mas hr{border:0;border-top:1px solid var(--line2);margin:4px 6px}
#m-mas button.peligro,#m-mas button.peligro svg{color:#b91c1c}
/* Diálogos de exportar y de spam */
.mj-dlg h3{margin:0;font-size:18px;font-weight:600}
.mj-dlg .sub{margin:2px 0 0;font-size:13px;color:var(--ink3)}
.mj-dlg .mj-cu{display:flex;flex-direction:column;gap:14px}
.mj-dlg .mj-fld{font-size:12px;font-weight:600;color:var(--ink2)}
.mj-opc{display:flex;align-items:flex-start;gap:12px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;width:100%;text-align:left}
.mj-opc[aria-checked="true"]{border-color:var(--blue);background:#f5faff}
.mj-opc .rd{width:18px;height:18px;border-radius:50%;border:2px solid #9ca3af;flex:none;margin-top:2px}
.mj-opc[aria-checked="true"] .rd{border-color:var(--blue);background:radial-gradient(circle,var(--blue) 0 4px,#fff 5px)}
.mj-opc b{display:block;font-size:13.5px;font-weight:600}
.mj-opc small{display:block;font-size:12.5px;color:var(--ink3)}
.mj-chk{display:flex;align-items:center;gap:10px;font-size:13.5px;text-align:left}
.mj-chk .cj{width:18px;height:18px;border-radius:5px;border:2px solid #9ca3af;display:grid;place-items:center;flex:none;color:transparent}
.mj-chk[aria-checked="true"] .cj{background:var(--blue);border-color:var(--blue);color:#fff}
.mj-chk .cj svg{width:11px;height:11px;stroke-width:3}
.mj-dlg .btn.rojo{background:#dc2626;border-color:#dc2626;color:#fff}
/* Embudo: la tarjeta que se acaba de mover */
@keyframes mj-caer{0%{transform:translateY(-10px) rotate(-2deg) scale(1.03);box-shadow:0 18px 36px -14px rgba(15,23,42,.45)}60%{transform:translateY(0) rotate(1deg) scale(1.02);box-shadow:0 18px 36px -14px rgba(15,23,42,.35)}100%{transform:none;box-shadow:0 1px 2px rgba(15,23,42,.06)}}
@keyframes mj-resaltar{0%{background:#fffde6}100%{background:transparent}}
.kc.mj-llega{animation:mj-caer .5s cubic-bezier(.4,0,.2,1)}
.kcol.mj-recibe{animation:mj-resaltar 1.1s ease-out}
.kc.drag{transform:rotate(-2deg) scale(1.03);box-shadow:0 18px 36px -14px rgba(15,23,42,.45)}
.kcol.over{outline:2px dashed #93c5fd;outline-offset:-2px;background:rgba(232,243,255,.6)}
@media (prefers-reduced-motion:reduce){.kc.mj-llega,.kcol.mj-recibe{animation:none}}
</style>`);

  /* ── Favoritos y 🔥 ── */
  const esFav = c => (AJ.favoritos || []).includes(c.id);
  function alternarFav(c){
    if (lectura()) return;
    const ya = esFav(c);
    AJ.favoritos = ya ? (AJ.favoritos || []).filter(x => x !== c.id) : [...(AJ.favoritos || []), c.id];
    render(); toast(ya ? 'Quitada de favoritos' : 'Quedó en Favoritos');
  }
  function alternarFuego(c){
    if (lectura()) return;
    c.fuego = !c.fuego;
    render(); toast(c.fuego ? 'Marcada como caliente: quedó en Calientes' : 'Ya no está marcada como caliente');
  }
  document.getElementById('b-fav').addEventListener('click', () => { const c = conv(); if (c) alternarFav(c); });
  document.getElementById('b-fuego').addEventListener('click', () => { const c = conv(); if (c) alternarFuego(c); });
  // Encabezado angosto (celular o columna estrecha): los dos botones pasan al menú ⋯ para no quitarle el espacio al nombre.
  const cab = document.querySelector('.chat-h');
  if (window.ResizeObserver) new ResizeObserver(() => { const w = cab.clientWidth; if (w) cab.classList.toggle('mj-angosto', w < 560); }).observe(cab);
  document.getElementById('b-mas').addEventListener('click', () => {
    const c = conv(), m = document.getElementById('m-mas');
    if (!c || m.hidden || !cab.classList.contains('mj-angosto')) return;
    m.insertAdjacentHTML('afterbegin', `<button type="button" data-mj-mas="fav">${I('estrella')}${esFav(c) ? 'Quitar de favoritos' : 'Agregar a favoritos'}</button><button type="button" data-mj-mas="fuego"><span class="mj-mfu">🔥</span>${c.fuego ? 'Quitar la marca de caliente' : 'Marcar como caliente'}</button><hr>`);
  });
  document.getElementById('m-mas').addEventListener('click', e => {
    const b = e.target.closest('[data-mj-mas]'), c = conv(); if (!b || !c) return;
    if (b.dataset.mjMas === 'fav') alternarFav(c); else alternarFuego(c);
  });
  const chatBase = chat;
  chat = function(){
    chatBase.apply(this, arguments);
    const c = CONV.find(x => x.id === st.sel); if (!c) return;
    const f = document.getElementById('b-fav'), g = document.getElementById('b-fuego');
    f.setAttribute('aria-pressed', String(esFav(c))); f.dataset.tip = esFav(c) ? 'Quitar de favoritos' : 'Favorito';
    g.setAttribute('aria-pressed', String(!!c.fuego)); g.classList.toggle('on', !!c.fuego); g.classList.toggle('off', !c.fuego); g.dataset.tip = c.fuego ? 'Quitar la marca de caliente' : 'Caliente';
  };
  const listaBase = lista;
  lista = function(){
    listaBase.apply(this, arguments);
    document.querySelectorAll('#items .it[data-c]').forEach(card => {
      const c = CONV.find(x => x.id === +card.dataset.c); if (!c) return;
      const b = card.querySelector('.tj-l1 b'); if (!b) return;
      b.insertAdjacentHTML('afterend', (esFav(c) ? SVG(ESTRELLA, 'mj-fav') : '') + (c.fuego ? '<span class="mj-fu" aria-label="Caliente">🔥</span>' : ''));
    });
  };

  /* ── Personas del equipo, dentro de Equipos (5-oct) ──
     Cada equipo que la persona lidera (o todos, para el administrador sin equipo) lleva una flecha a la derecha que
     despliega a sus integrantes con las conversaciones abiertas de cada uno, más las sin asignar. Al integrante no le
     sale: el API solo le manda lo suyo y los números de los demás saldrían en cero. */
  const equiposConPersonas = () => {
    if (typeof esLiderCrm !== 'function' || !esLiderCrm()) return [];
    const todos = typeof MIEMBROS === 'object' && MIEMBROS ? Object.keys(MIEMBROS) : [];
    return ALCANCE.todo ? todos : (ALCANCE.lidera || []);
  };
  const abiertasDe = eq => CONV.filter(c => okRol(c) && (c.est || 'abiertas') === 'abiertas' && equipoConv(c) === eq);
  const eqAbierto = new Set();
  const personasHtml = eq => {
    const L = abiertasDe(eq), act = st.persona && st.persona.eq === eq ? st.persona.id : null;
    const filas = idsDe(eq).map(id => { const u = USUARIOS.find(x => x.id === id); if (!u) return null; const suyas = L.filter(c => c.asigId === id); return {id, n:u.nombre, foto:u.foto || null, total:suyas.length, esperan:suyas.filter(c => !!c.espera).length}; })
      .filter(Boolean).sort((a, b) => b.total - a.total || a.n.localeCompare(b.n, 'es'));
    const sin = L.filter(c => !c.asig).length;
    return filas.map(p => `<li class="sub"><button type="button" class="mj-per" data-mj-per="${esc(eq)}|${esc(p.id)}" aria-current="${act === p.id}"><span class="mj-mini" style="background:${colorPersona(p.n)}">${fotoAv(p.foto, p.n)}</span><span class="mj-nom">${esc(p.n)}</span>${p.esperan ? `<span class="mj-r" title="Esperan respuesta">${p.esperan}</span>` : ''}<span class="n">${p.total || ''}</span></button></li>`).join('')
      + `<li class="sub"><button type="button" class="mj-per" data-mj-per="${esc(eq)}|" aria-current="${act === ''}"><span class="mj-mini sin"></span><span class="mj-nom">Sin asignar</span><span class="n">${sin || ''}</span></button></li>`;
  };
  const navBase = nav;
  nav = function(){
    navBase.apply(this, arguments);
    const eqs = equiposConPersonas();
    // Si se filtra por una persona, su equipo queda abierto para que se vea quién está elegido.
    if (st.persona) eqAbierto.add(st.persona.eq);
    document.querySelectorAll('#equipos [data-t2]').forEach(b => {
      const eq = (EQUIPOS.find(x => x.id === b.dataset.t2) || {}).n, li = b.closest('li');
      if (!eq || !li || !eqs.includes(eq)) return;
      const abierto = eqAbierto.has(eq);
      li.classList.add('mj-eq');
      li.insertAdjacentHTML('beforeend', `<button type="button" class="mj-tw" data-mj-abrir="${esc(eq)}" aria-expanded="${abierto}" aria-label="${abierto ? 'Ocultar' : 'Ver'} los integrantes de ${esc(eq)}">${I('chev')}</button>`);
      if (abierto) li.insertAdjacentHTML('afterend', personasHtml(eq));
    });
  };
  document.getElementById('equipos').addEventListener('click', e => {
    const ab = e.target.closest('[data-mj-abrir]');
    if (ab) { const eq = ab.dataset.mjAbrir; eqAbierto.has(eq) ? eqAbierto.delete(eq) : eqAbierto.add(eq); nav(); return; }
    const b = e.target.closest('[data-mj-per]'); if (!b) return;
    const i = b.dataset.mjPer.lastIndexOf('|'), eq = b.dataset.mjPer.slice(0, i), id = b.dataset.mjPer.slice(i + 1);
    const misma = st.persona && st.persona.eq === eq && st.persona.id === id;
    st.pagina = ''; st.menciones = false; st.dif = null; st.tplNueva = null;
    st.carpeta = st.equipo = st.etq = st.linea = st.canal = st.tag = '';
    st.persona = misma ? null : {eq, id}; st.vista = 'todas'; st.est = 'abiertas';
    document.getElementById('est-l').textContent = 'Abiertas';
    const pr = visibles()[0]; if (pr) st.sel = pr.id;
    render();
    document.getElementById('app').classList.remove('open');
  });
  // Elegir el equipo entero suelta a la persona.
  document.getElementById('equipos').addEventListener('click', e => { if (e.target.closest('[data-t2]')) st.persona = null; }, true);
  const visiblesBase = visibles;
  visibles = function(){
    const L = visiblesBase.apply(this, arguments), p = st.persona;
    return p ? L.filter(c => equipoConv(c) === p.eq && (p.id ? c.asigId === p.id : !c.asig)) : L;
  };
  const nombrePersona = p => p.id ? ((USUARIOS.find(u => u.id === p.id) || {}).nombre || 'Persona') : `Sin asignar de ${p.eq}`;
  const filtroBase = filtroActivo;
  filtroActivo = function(){
    const f = filtroBase.apply(this, arguments);
    if (st.persona) f.push({tipo:'persona', ic:'user', n:nombrePersona(st.persona)});
    return f;
  };
  // «Quitar» en la pastilla del filtro (antes del manejador de 10-nucleo.js, que no conoce este filtro).
  document.addEventListener('click', e => {
    const q = e.target.closest('[data-quitar]'); if (!q) return;
    if (q.dataset.quitar === 'persona') { e.stopPropagation(); st.persona = null; render(); }
    else if (q.dataset.quitar === 'todo') st.persona = null;
  }, true);
  const irABase = irA;
  irA = function(){ st.persona = null; return irABase.apply(this, arguments); };

  /* ── Notas privadas arriba en el panel del contacto ── */
  const cuandoNota = m => { if (!m._t) return m.h || ''; const d = hcDias(m._t); return d === 0 ? `hoy, ${hcHora(m._t)}` : d === 1 ? 'ayer' : hcCuando(m._t).toLowerCase(); };
  const panelBase = panel;
  panel = function(c){
    panelBase.apply(this, arguments);
    // Recordatorio (tablero 5): el calendario y el reloj dentro de cada desplegable.
    document.querySelectorAll('#panel .rnew .rdos .dsel > .sel').forEach((b, i) => { if (!b.querySelector('.mj-ri')) b.insertAdjacentHTML('afterbegin', I(i ? 'clock' : 'calendar', 'i mj-ri')); });
    const acts = document.querySelector('#panel .pc-acts'); if (!acts || !c) return;
    const notas = c.msgs.filter(m => m.note != null && String(m.note).trim()).reverse();
    if (!notas.length) return;
    const todas = st.mjNotasTodas === c.id, ver = todas ? notas : notas.slice(0, 2);
    const una = (m, i) => `${i ? '<div class="otra">' : ''}<p>${esc(m.note)}</p><small>${esc(m.by || 'Equipo')}${cuandoNota(m) ? ' · ' + esc(cuandoNota(m)) : ''}</small>${i ? '</div>' : ''}`;
    acts.insertAdjacentHTML('afterend', `<div class="mj-notas"><span class="cab">${SVG(CANDADO)}Notas privadas · ${notas.length}${notas.length > 2 ? `<button type="button" data-mj-notas="1">${todas ? 'Ver menos' : 'Ver todas'}</button>` : ''}</span>${ver.map(una).join('')}</div>`);
  };
  document.getElementById('panel').addEventListener('click', e => {
    if (!e.target.closest('[data-mj-notas]')) return;
    const c = conv(); if (!c) return;
    st.mjNotasTodas = st.mjNotasTodas === c.id ? null : c.id; panel(c);
  });

  /* ── Exportar el chat (tablero 3) ── */
  const CHECK = '<path d="M5 12.5l4.5 4.5L19 7.5"/>';
  const chk = (k, on, t) => `<button type="button" class="mj-chk" role="checkbox" aria-checked="${on}" data-mj-chk="${k}"><span class="cj">${SVG(CHECK)}</span>${t}</button>`;
  window.mjDlgExportar = function(c){
    const x = st.mjExp = {id:c.id, formato:'pdf', notas:true, eventos:true, archivos:false, bajando:false};
    pintarExportar();
    void x;
  };
  function pintarExportar(){
    const x = st.mjExp, c = CONV.find(k => k.id === x.id); if (!c) return;
    const n = c.msgs.filter(m => m.in != null || m.out != null).length, desde = c._t && c._t.creado ? `${hcPartes(c._t.creado).d} de ${HC_MES_L[hcPartes(c._t.creado).m]}` : '';
    abrirDialogo(`<div class="mj-cu"><div><h3>Exportar el chat</h3><p class="sub">Con ${esc(c.n)}${c._cargada ? ` · ${n} ${n === 1 ? 'mensaje' : 'mensajes'}` : ''}${desde ? ` desde el ${esc(desde)}` : ''}</p></div>
      <div class="mj-fld">Formato</div>
      <button type="button" class="mj-opc" role="radio" aria-checked="${x.formato === 'pdf'}" data-mj-formato="pdf"><span class="rd"></span><span><b>PDF</b><small>Para leerlo o mandarlo. Se ve como el chat, con fechas y quién escribió.</small></span></button>
      <button type="button" class="mj-opc" role="radio" aria-checked="${x.formato === 'txt'}" data-mj-formato="txt"><span class="rd"></span><span><b>Texto</b><small>Un archivo .txt, como el que exporta WhatsApp.</small></span></button>
      <div class="mj-fld" style="margin-top:4px">Qué incluye</div>
      ${chk('notas', x.notas, 'Notas privadas')}${chk('eventos', x.eventos, 'Eventos (asignaciones, etapas, finalizadas)')}${chk('archivos', x.archivos, 'Archivos, fotos y audios en un .zip')}</div>
      <div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" data-mj-descargar="1" ${x.bajando ? 'disabled' : ''}>${I('download')}${x.bajando ? 'Preparando…' : 'Descargar'}</button></div>`, 'mj-dlg');
  }
  async function descargarChat(){
    const x = st.mjExp; if (!x || x.bajando) return;
    x.bajando = true; pintarExportar();
    try {
      const q = new URLSearchParams({formato:x.formato, notas:x.notas ? '1' : '0', eventos:x.eventos ? '1' : '0', archivos:x.archivos ? '1' : '0'});
      const r = await crmFetch('GET', `/crm/conversaciones/${x.id}/exportar?${q}`);
      if (!r.ok) await crmLeer(r);
      const cd = r.headers.get('Content-Disposition') || '', m = cd.match(/filename\*=UTF-8''([^;]+)/);
      const nombre = m ? decodeURIComponent(m[1]) : `chat.${x.archivos ? 'zip' : x.formato}`;
      const url = URL.createObjectURL(await r.blob()), a = document.createElement('a'); a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
      cerrarDialogo(); toast('Se descargó el chat');
    } catch (err) { x.bajando = false; pintarExportar(); toast(err && err.message ? err.message : 'No se pudo exportar el chat'); }
  }

  /* ── Marcar como spam (tablero 4) ── */
  window.mjDlgSpam = function(c){
    st.mjSpam = {id:c.id, bloquear:(c.canal || 'wa') === 'wa', enviando:false};
    pintarSpam();
  };
  function pintarSpam(){
    const x = st.mjSpam, c = CONV.find(k => k.id === x.id); if (!c) return;
    abrirDialogo(`<div class="mj-cu"><div><h3>Marcar como spam</h3><p class="sub">${esc([c.tel, c.n].filter(Boolean).join(' · '))}</p></div>
      <p style="margin:0;font-size:13.5px;line-height:1.55;color:#374151">La conversación se finaliza y sus mensajes nuevos no entran a la bandeja ni al reparto. Quedan guardados en Contactos › Spam, donde la puedes sacar de spam.</p>
      ${(c.canal || 'wa') === 'wa' ? chk('bloquear', x.bloquear, 'Bloquear también el número en WhatsApp') : ''}</div>
      <div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn rojo" data-mj-spam="1" ${x.enviando ? 'disabled' : ''}>${I('shield-x')}${x.enviando ? 'Marcando…' : 'Marcar como spam'}</button></div>`, 'mj-dlg');
  }
  async function marcarSpam(){
    const x = st.mjSpam; if (!x || x.enviando) return;
    if (lectura()) { cerrarDialogo(); return; }
    x.enviando = true; pintarSpam();
    try {
      const r = await crmApi('POST', `/crm/conversaciones/${x.id}/spam`, {bloquear:x.bloquear});
      cerrarDialogo(); toast(r && r.aviso ? r.aviso : 'Quedó en spam. Está en Contactos › Spam.');
      if (typeof crmSincronizar === 'function') crmSincronizar();
    } catch (err) { x.enviando = false; pintarSpam(); toast(err && err.message ? err.message : 'No se pudo marcar como spam'); }
  }
  // Contactos › Spam: sacar de spam (PATCH del contacto con spam: null; el API desbloquea en WhatsApp si estaba bloqueado).
  window.mjSacarDeSpam = async function(id){
    if (lectura()) return;
    const k = ctTodos().find(c => c.id === id); if (!k || !k.contactoId) return;
    try {
      await crmApi('PATCH', `/crm/contactos/${k.contactoId}`, {cambios:{spam:null}});
      for (const c of CONV) if (c.contactoId === k.contactoId) c.spam = null;
      for (const c of CT_EXTRA) if (c.contactoId === k.contactoId) c.spam = null;
      render(); toast(`${k.n} salió de spam: sus mensajes vuelven a entrar a la bandeja`);
    } catch (err) { toast(err && err.message ? err.message : 'No se pudo sacar de spam'); }
  };
  document.getElementById('ov-x').addEventListener('click', e => {
    const f = e.target.closest('[data-mj-formato]'); if (f && st.mjExp) { st.mjExp.formato = f.dataset.mjFormato; pintarExportar(); return; }
    const k = e.target.closest('[data-mj-chk]');
    if (k) { const o = k.dataset.mjChk === 'bloquear' ? st.mjSpam : st.mjExp; if (!o) return; o[k.dataset.mjChk] = !o[k.dataset.mjChk]; if (o === st.mjSpam) pintarSpam(); else pintarExportar(); return; }
    if (e.target.closest('[data-mj-descargar]')) { descargarChat(); return; }
    if (e.target.closest('[data-mj-spam]')) marcarSpam();
  });

  /* ── Enviar con plantilla de video, con la nota de voz para cuando responda (tablero 7) ── */
  const MIC = '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>';
  const conVideo = () => PLANTILLAS.filter(p => p.e === 'ok' && p.media === 'video');
  function abrirEnviarPlantilla(c, x){
    st.mjTpl = {conv:c.id, n:x.n, vars:{}, voz:false, audio:null, video:null, enviando:false};
    pintarEnviarPlantilla();
  }
  function pintarEnviarPlantilla(){
    const d = st.mjTpl, c = CONV.find(k => k.id === d.conv), x = conVideo().find(p => p.n === d.n); if (!c || !x) { cerrarDialogo(); return; }
    const auto = {nombre:c.n.split(' ')[0], asesor:(c.asig || yo).split(' ')[0], producto:(c.campos && c.campos.producto) || ''};
    const faltan = varsDe(x.b).filter(v => !auto[v]), vars = {...auto, ...d.vars};
    const video = x.mediaUrl ? {n:x.mediaN || 'Video'} : d.video;
    abrirDialogo(`<div class="mj-cu"><div><h3>Enviar con plantilla</h3><p class="sub">${/cerrada/i.test(c.ventana) ? `${esc(c.n)} no escribe hace más de 24 horas` : `Para ${esc(c.n)}`}</p></div>
      <div class="fld">Plantilla${ddSel('data-mj-tpl', conVideo().map(p => p.n), x.n)}</div>
      <div class="mj-wa"><div class="mj-wab"><div class="mj-vid"><span>${I('play')}</span></div><div class="tx">${esc(llenarVars(x.b, vars))}</div></div></div>
      ${faltan.map(v => `<label class="fld">${esc(/^\d+$/.test(v) ? 'Dato ' + v : v.charAt(0).toUpperCase() + v.slice(1))}<input data-mj-var="${esc(v)}" value="${esc(d.vars[v] || '')}" autocomplete="off"></label>`).join('')}
      ${x.mediaUrl ? '' : (video ? `<div class="mj-arch"><span class="ic">${I('video')}</span><span style="flex-grow:1;min-width:0"><b>${esc(video.n)}</b><small>${video.subiendo ? 'Subiendo…' : 'Video del encabezado'}</small></span><button type="button" class="mj-x2" data-mj-vquitar="1" aria-label="Quitar el video">${I('x')}</button></div>` : `<div><button type="button" class="btn" data-mj-vadd="1">${I('clip')}Agregar el video</button> <span class="muted" style="font-size:12px">MP4 de hasta 16 MB</span></div>`)}
      <div class="mj-row2"><span><b>Cuando responda, mandar una nota de voz</b><small>Sale apenas conteste, porque WhatsApp no deja notas de voz en plantillas</small></span><button type="button" class="mj-sw" role="switch" aria-checked="${d.voz}" data-mj-voz="1" aria-label="Cuando responda, mandar una nota de voz"></button></div>
      ${d.voz ? (d.audio ? `<div class="mj-arch"><span class="ic">${SVG(MIC)}</span><span style="flex-grow:1;min-width:0"><b>${esc(d.audio.n)}</b><small>${d.audio.subiendo ? 'Subiendo…' : 'Audio'}</small></span>${d.audio.subiendo ? '' : `<span class="mj-etq">${I('mic')}Sale como nota de voz</span>`}<button type="button" class="mj-x2" data-mj-aquitar="1" aria-label="Quitar el audio">${I('x')}</button></div>` : `<div><button type="button" class="btn" data-mj-aadd="1">${I('clip')}Agregar el audio</button></div>`) : ''}</div>
      <div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" data-mj-tplok="1" ${d.enviando ? 'disabled' : ''}>${I('send')}Enviar plantilla</button></div>`, 'mj-dlg mj-tpl');
  }
  function elegir(accept, cb){
    const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.hidden = true; document.body.appendChild(i);
    i.addEventListener('cancel', () => i.remove());
    i.addEventListener('change', () => { const f = (i.files || [])[0]; i.remove(); if (f) cb(f); });
    i.click();
  }
  function subirA(d, clave, f){
    const a = d[clave] = {n:f.name, mime:f.type, peso:f.size, subiendo:true}; pintarEnviarPlantilla();
    crmSubir(f).then(r => { Object.assign(a, {n:r.n || f.name, url:r.url, mime:r.mime || f.type, peso:r.bytes || f.size}); delete a.subiendo; }, err => { if (d[clave] === a) d[clave] = null; toast(`${f.name}: no se pudo subir. ${err.message}`); })
      .finally(() => { if (st.mjTpl === d && !document.getElementById('ov-x').hidden) pintarEnviarPlantilla(); });
  }
  // Antes que los menús de plantillas del chat: una plantilla con video abre este diálogo en vez de llenar el cuadro.
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-usar-tpl]'); if (!b) return;
    const c = CONV.find(k => k.id === st.sel), x = conVideo().find(p => p.n === b.dataset.usarTpl); if (!c || !x) return;
    e.stopPropagation(); e.preventDefault();
    const tp = document.getElementById('tplp'); if (tp) tp.hidden = true;
    const q = document.getElementById('qr'); if (q) q.hidden = true;
    abrirEnviarPlantilla(c, x);
  }, true);
  document.getElementById('ov-x').addEventListener('input', e => { const i = e.target.closest('[data-mj-var]'); if (i && st.mjTpl) { st.mjTpl.vars[i.dataset.mjVar] = i.value; const tx = document.querySelector('#dlg-x .mj-wab .tx'), c = CONV.find(k => k.id === st.mjTpl.conv), x = conVideo().find(p => p.n === st.mjTpl.n); if (tx && c && x) tx.textContent = llenarVars(x.b, {nombre:c.n.split(' ')[0], asesor:(c.asig || yo).split(' ')[0], producto:(c.campos && c.campos.producto) || '', ...st.mjTpl.vars}); } });
  document.getElementById('ov-x').addEventListener('click', e => {
    const d = st.mjTpl; if (!d || !document.querySelector('#dlg-x.mj-tpl')) return;
    const t = e.target.closest('[data-mj-tpl]'); if (t) { d.n = t.dataset.mjTpl; d.vars = {}; pintarEnviarPlantilla(); return; }
    if (e.target.closest('[data-mj-voz]')) { d.voz = !d.voz; pintarEnviarPlantilla(); return; }
    if (e.target.closest('[data-mj-aadd]')) { elegir('audio/*', f => { if (!/^audio\//.test(f.type || '')) { toast('Elige un archivo de audio'); return; } if (f.size > 16 * 1024 * 1024) { toast('El audio pasa de 16 MB'); return; } subirA(d, 'audio', f); }); return; }
    if (e.target.closest('[data-mj-aquitar]')) { d.audio = null; pintarEnviarPlantilla(); return; }
    if (e.target.closest('[data-mj-vadd]')) { elegir('video/mp4', f => { if (f.size > 16 * 1024 * 1024) { toast('El video pasa de 16 MB, el máximo de WhatsApp'); return; } subirA(d, 'video', f); }); return; }
    if (e.target.closest('[data-mj-vquitar]')) { d.video = null; pintarEnviarPlantilla(); return; }
    if (!e.target.closest('[data-mj-tplok]')) return;
    const c = CONV.find(k => k.id === d.conv), x = conVideo().find(p => p.n === d.n); if (!c || !x) return;
    if (lectura()) { cerrarDialogo(); return; }
    const auto = {nombre:c.n.split(' ')[0], asesor:(c.asig || yo).split(' ')[0], producto:(c.campos && c.campos.producto) || ''}, vars = {...auto};
    for (const [k, v] of Object.entries(d.vars)) if (String(v).trim()) vars[k] = String(v).trim();
    const falta = varsDe(x.b).find(v => !vars[v]); if (falta) { toast('Completa todos los datos de la plantilla'); const i = document.querySelector(`[data-mj-var="${CSS.escape(falta)}"]`); if (i) i.focus(); return; }
    const video = x.mediaUrl ? {url:x.mediaUrl, n:x.mediaN || 'Video'} : d.video;
    if (!video || !video.url) { toast(video ? 'Espera a que termine de subir el video' : 'Agrega el video de la plantilla'); return; }
    if (d.voz && (!d.audio || !d.audio.url)) { toast(d.audio ? 'Espera a que termine de subir el audio' : 'Agrega el audio de la nota de voz, o apaga esa opción'); return; }
    c.msgs.push({out:llenarVars(x.b, vars), by:yo, h:'ahora', plantilla:x.n, vars, file:{n:video.n, t:'Video', ic:'play', url:video.url, mime:'video/mp4'}, ...(d.voz ? {vozAlResponder:{url:d.audio.url, mime:d.audio.mime || '', n:d.audio.n}} : {})});
    st.mjTpl = null; cerrarDialogo(); chat(); lista();
    toast(d.voz ? 'Plantilla enviada. La nota de voz sale cuando responda.' : 'Plantilla enviada');
    if (typeof crmSincronizar === 'function') crmSincronizar();
  });

  /* ── Embudo: animación al mover una tarjeta (tablero 9) ── */
  const kanbanBase = kanban;
  kanban = function(){
    kanbanBase.apply(this, arguments);
    const el = document.getElementById('page');
    // La tarjeta que cambió de columna desde la última vez que se pintó el embudo cae en su sitio.
    const antes = st.mjEmbudo || {}, ahora = {};
    el.querySelectorAll('.kc[data-kc]').forEach(k => {
      const col = k.closest('.kcol'), id = k.dataset.kc; if (!col) return;
      ahora[id] = col.dataset.col;
      if (id in antes && antes[id] !== col.dataset.col) { k.classList.add('mj-llega'); col.classList.add('mj-recibe'); }
      const c = CONV.find(x => x.id === +id), nom = k.querySelector('.t b');
      if (c && c.fuego && nom) nom.insertAdjacentHTML('afterend', '<span class="mj-fu" aria-label="Caliente" style="font-size:13px;line-height:1">🔥</span>');
    });
    st.mjEmbudo = ahora;
  };
  const irAEmbudo = irA;
  irA = function(k){ if (k === 'embudo') st.mjEmbudo = null; return irAEmbudo.apply(this, arguments); };
})();
