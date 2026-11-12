/* ── El chat se dibuja por partes (pedido del usuario, 12-nov): al abrir, los últimos 20 mensajes; al subir con el
   scroll, 20 más, sin que la vista salte. Los datos siguen completos en c.msgs (fijados, destacados, citas, ventana de
   24 horas y encuesta los necesitan): solo se dibuja menos. Vale en la bandeja (#msgs), en el cajón del embudo
   (#ec-msgs) y en el celular, porque envuelve pintarChat por fuera de todos (después de 89-chat-whatsapp).
   · El primer mensaje dibujado queda guardado por conversación (el objeto y su _id): los nuevos se suman abajo sin
     mover lo que se está leyendo. Cuando la conversación termina de cargar, vuelve a los últimos 20.
   · Las búsquedas dentro del pintado (citas, reacciones) miran la conversación completa: la parte que se dibuja
     responde find, some, filter, findIndex e indexOf con la lista entera.
   · Ir a un mensaje que no está dibujado (fijados, destacados, citas) primero lo dibuja: chppMostrar(id).
   Lo propio lleva «chpp-». ── */
(() => {
  const PASO = 20;
  const clave = m => m && (m._id || m.cid) || null;
  const real = m => m && !m.d;   // los separadores de día no cuentan como mensaje
  // El índice desde el que se dibujan `n` mensajes antes de `hasta`, con su separador de día si lo tiene encima.
  function atras(ms, hasta, n){
    let i = hasta, k = 0;
    while (i > 0 && k < n) { i--; if (real(ms[i])) k++; }
    while (i > 0 && ms[i - 1] && ms[i - 1].d) i--;
    return i;
  }
  function inicio(c){
    const ms = c.msgs || [];
    let v = c._chpp;
    if (!v || v.carg !== !!c._cargada) v = c._chpp = {carg: !!c._cargada, obj: null, id: null};
    let i = v.obj ? ms.indexOf(v.obj) : -1;
    if (i < 0 && v.id) i = ms.findIndex(m => clave(m) === v.id);
    if (i < 0) i = atras(ms, ms.length, PASO);
    v.obj = ms[i] || null; v.id = clave(ms[i]);
    return i;
  }
  function fijar(c, i){ const ms = c.msgs || []; c._chpp.obj = ms[i] || null; c._chpp.id = clave(ms[i]); }

  const pintarEntero = pintarChat;
  pintarChat = function(c){
    if (!c || !Array.isArray(c.msgs)) return pintarEntero.apply(this, arguments);
    const todos = c.msgs, desde = inicio(c);
    if (desde <= 0) return pintarEntero.apply(this, arguments);
    const parte = todos.slice(desde);
    for (const f of ['find', 'some', 'filter', 'findIndex', 'indexOf']) parte[f] = todos[f].bind(todos);
    let html;
    c.msgs = parte;
    try { html = pintarEntero.apply(this, arguments); } finally { c.msgs = todos; }
    // «Reintentar» lleva la posición del mensaje: dentro de la parte, hay que sumarle desde dónde empieza.
    html = html.replace(/data-ch-reintentar="(\d+)"/g, (_, n) => `data-ch-reintentar="${+n + desde}"`);
    return `<div class="chpp-mas" data-chpp="${c.id}" aria-hidden="true"></div>` + html;
  };

  const convDe = box => { const s = box.querySelector(':scope > .chpp-mas'); return s ? CONV.find(x => x.id === +s.dataset.chpp) : null; };
  function repintar(box, c){
    if (box.id === 'msgs') { chat(); return; }
    box.replaceChildren(document.createRange().createContextualFragment(pintarChat(c)));
  }
  let ocupado = false;
  // Cerca del borde de arriba (o sin barra para subir): 20 más, con la vista quieta donde estaba.
  function revisar(box){
    if (ocupado || !box || !box.isConnected) return;
    const c = convDe(box); if (!c) return;
    const sinBarra = box.scrollHeight <= box.clientHeight + 4;
    if (box.scrollTop > 120 && !sinBarra) return;
    const desde = inicio(c); if (desde <= 0) return;
    ocupado = true;
    try {
      const abajo = box.scrollHeight - box.scrollTop;
      fijar(c, atras(c.msgs, desde, PASO));
      repintar(box, c);
      box.scrollTop = Math.max(0, box.scrollHeight - abajo);
    } finally { ocupado = false; }
    if (box.scrollHeight <= box.clientHeight + 4) requestAnimationFrame(() => revisar(box));
  }
  const cajaDe = t => t && t.nodeType === 1 && (t.id === 'msgs' || t.id === 'ec-msgs') ? t : null;
  document.addEventListener('scroll', e => { const b = cajaDe(e.target); if (b) revisar(b); }, {capture: true, passive: true});
  // Sin barra para subir no hay scroll: la rueda o el dedo hacia arriba también piden más.
  document.addEventListener('wheel', e => { if (e.deltaY < 0) { const b = e.target.closest && e.target.closest('#msgs, #ec-msgs'); if (b) revisar(b); } }, {passive: true});
  let y0 = 0;
  document.addEventListener('touchstart', e => { y0 = e.touches[0] ? e.touches[0].clientY : 0; }, {passive: true});
  document.addEventListener('touchmove', e => { const t = e.touches[0]; if (t && t.clientY > y0 + 10) { const b = e.target.closest && e.target.closest('#msgs, #ec-msgs'); if (b) revisar(b); } }, {passive: true});

  // Ir a un mensaje que todavía no se dibujó: se dibuja desde un poco antes de él y luego se va.
  window.chppMostrar = function(id, box){
    box = box || document.getElementById('msgs');
    const c = box && (convDe(box) || CONV.find(x => x.id === st.sel)); if (!c || !id) return false;
    const i = (c.msgs || []).findIndex(m => m && m._id === id), desde = inicio(c);
    if (i < 0 || i >= desde) return false;
    fijar(c, atras(c.msgs, i, 3));
    repintar(box, c);
    return true;
  };

  // Si los 20 caben sin barra (mensajes cortos o pantalla alta), se suman más hasta que haya para subir.
  const chatSolo = chat;
  chat = function(){ const r = chatSolo.apply(this, arguments); if (!ocupado) requestAnimationFrame(() => { const b = document.getElementById('msgs'); if (b && b.scrollHeight <= b.clientHeight + 4) revisar(b); }); return r; };

  document.head.insertAdjacentHTML('beforeend', '<style>.chpp-mas{height:1px;flex:none}</style>');
})();
