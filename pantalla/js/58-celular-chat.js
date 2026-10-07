/* ── Celular: encabezado del chat (3B), ficha del cliente y panel del contacto a pantalla completa (maqueta aprobada «CRM · menú en celular», 29-sep, tableros 3, 3.1 y 3.2). ── */
// Todo esto vale solo por debajo de 760 px (CELULAR en puenteCrm.ts: ahí el marco no se escala). En escritorio el
// encabezado, la ficha y el panel quedan como estaban: las envolturas de chat(), panel() y pintarFicha() solo actúan
// en celular, y las reglas de estilo nuevas van dentro de la misma consulta de ancho. Va dentro de una función para
// no dejar nombres sueltos en el ámbito que comparten todos los archivos del CRM.
(() => {
  const app = document.getElementById('app');
  const CEL = window.matchMedia('(max-width: 759.98px)');
  const esCel = () => CEL.matches;

  // Íconos tal como los dibuja la maqueta (algunos cambian un trazo frente a los del sprite).
  const svg = (d, cls = 'i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const ICO = {
    volver: '<path d="m15 6-6 6 6 6"/>',
    reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    ajustes: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    campana: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    persona: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    carrito: '<circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M3 4h2l2.4 11h10.2L20 7H6.2"/>',
    brujula: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>',
    historial: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 8v4l3 2"/>',
    globo: '<path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.4A8.5 8.5 0 1 1 21 12Z"/>',
    mas: '<path d="M12 5v14M5 12h14"/>',
  };
  // Fechas cortas de la maqueta: «2 sep» (con el año si no es este) y «12 ago 2026».
  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const fechaCorta = (t, conAnio) => { const p = hcPartes(t); return `${p.d} ${MES[p.m]}${conAnio || p.y !== hcPartes(Date.now()).y ? ' ' + p.y : ''}`; };

  document.head.insertAdjacentHTML('beforeend', `<style>
.cch-zona{display:contents}
.cch-tk,.cch-esp{display:none}
.cch-sr{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media (max-width:759.98px){
  /* 3 · Encabezado en una sola fila: ‹, foto, nombre con el número del ticket, la línea y el teléfono; ✓ y ⋯ de 32 px. */
  #app .chat-h{flex-wrap:nowrap;height:auto;min-height:0;gap:8px;row-gap:0;padding:10px 12px 10px 10px;border-bottom:1px solid #e5e9f0;line-height:normal}
  #app .chat-h .back{width:30px;height:30px;margin-left:-6px;color:#374151}
  #app .chat-h .back svg{width:18px;height:18px}
  #app .chat-h .cch-zona{display:flex;align-items:center;gap:8px;flex:1 1 0%;min-width:0;cursor:pointer;border-radius:10px}
  #app .chat-h .av{width:36px;height:36px;font-size:12.5px}
  #app .chat-h .who{flex:1 1 auto;width:0;min-width:0;gap:2px}
  #app .chat-h .r1{align-items:baseline;gap:6px}
  #app .chat-h .r1 b{font-size:15px;font-weight:600}
  #app .chat-h .cch-tk{display:block;flex:none;font-size:12.5px;font-weight:400;color:#6b7280;font-variant-numeric:tabular-nums}
  #app .chat-h #sla{display:none}
  #app .chat-h .r2{display:flex;align-items:baseline;font-variant-numeric:normal}
  #app .chat-h .r2 .cch-l{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  #app .chat-h .r2 .cch-l.fijo{flex:none}
  #app .chat-h .r2 .cch-t{flex:none;white-space:pre}
  #app .chat-h .r2 .cch-t.otro{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}
  #app .chat-h .acts{gap:8px;margin-left:0}
  #app .chat-h .acts .btn{width:32px;height:32px;padding:0;border-radius:9px;justify-content:center}
  #app .chat-h #cerrar{font-size:0;gap:0}
  #app .chat-h #cerrar svg.cv{display:none}
  /* Pestañas con la espera a la derecha, como en la tarjeta de la lista. */
  #app .subtabs{gap:20px;padding:0 16px;align-items:center;line-height:normal}
  #app .subtabs button{flex:none;padding:10px 0;font-size:13.5px;color:#6b7280;border-bottom:0;margin-bottom:0;white-space:nowrap}
  #app .subtabs button[aria-pressed="true"]{color:#1976d2;border-bottom:2px solid #1f93ff;margin-bottom:-1px;font-weight:500}
  #app .subtabs .cch-esp{display:inline-flex;margin-left:auto;flex:none;align-items:center;gap:4px;height:22px;padding:0 8px;border-radius:999px;background:#fee2e2;color:#b91c1c;font-size:12px;font-weight:500;white-space:nowrap}
  #app .subtabs .cch-esp.ok{background:#e8f8ee;color:#15803d}
  #app .subtabs .cch-esp svg{width:13px;height:13px}
  /* Si en un celular angosto no caben (360 px), se acercan; y si ni así, la fila se desliza de lado. */
  #app .subtabs.cch-justo{gap:12px}
  #app .subtabs.cch-justo2{gap:12px;padding:0 12px}
  #app .subtabs.cch-justo3{gap:12px;padding:0 12px;overflow-x:auto;scrollbar-width:none}
  #app .subtabs.cch-justo3::-webkit-scrollbar{display:none}
  /* 3.1 · Ficha del cliente: tarjetas en una columna con filas de etiqueta y dato; se desliza con el dedo. */
  #app .ficha{flex:1 1 auto;min-height:0;flex-direction:column;gap:12px;padding:14px 16px 16px;background:#f8fafc;line-height:normal;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
  /* Solo con la pestaña de la ficha: #app pesa más que «.app:not(.verficha) .ficha», y en Mensajes le quitaba el alto al chat. */
  #app.verficha .ficha{display:flex}
  #app .ficha .fcard{flex:none;display:flex;flex-direction:column;gap:10px;padding:14px 16px;border:1px solid #e5e9f0;border-radius:12px;background:#fff}
  #app .ficha .fcard h4{margin:0;font-size:13px;font-weight:600;gap:6px;color:#1f2937}
  #app .ficha .fcard h4 svg{width:15px;height:15px;color:#6b7280}
  #app .ficha .kv,#app .panel .kv{display:grid;grid-template-columns:104px minmax(0,1fr);gap:8px 10px;margin:0;font-size:13px}
  #app .ficha .kv dt,#app .panel .kv dt{color:#6b7280;font-weight:400}
  #app .ficha .kv dd,#app .panel .kv dd{margin:0;color:#1f2937;font-weight:400;min-width:0;overflow-wrap:anywhere;text-align:left}
  #app .ficha .fcard p.muted{margin:0;font-size:12.5px;color:#6b7280;line-height:1.45}
  #app .ficha .hist{display:flex;flex-direction:column;gap:8px;margin-top:0!important;font-size:13px}
  #app .ficha .hist > div,#app .ficha .hist > .cch-hl{display:flex;justify-content:space-between;gap:10px;color:#374151;font-size:13px;font-weight:400;text-align:left;width:100%}
  #app .ficha .hist > * > span:first-child{min-width:0;overflow-wrap:anywhere}
  #app .ficha .hist > * > span:last-child{flex:none;color:#6b7280;white-space:nowrap}
  #app .ficha .hist > .cch-hl:hover > span:first-child{color:#1976d2}
  /* 3.2 · Panel del contacto a pantalla completa: ocupa el lugar del chat mientras está abierto. */
  #app.cch-ct:not(.pg):not(.sinchat) > .chat{display:none}
  #app.cch-ct:not(.pg):not(.sinchat) > .panel{display:block;position:static;width:auto;min-width:0;min-height:0;border-left:0;box-shadow:none;background:#fff;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;line-height:normal}
  #app .panel .ptitle,#app .popen{display:none}
  #app .panel .cch-ct-h{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:8px;padding:12px 12px 12px 10px;border-bottom:1px solid #e5e9f0;background:#fff}
  #app .panel .cch-volver{width:30px;height:30px;display:grid;place-items:center;flex:none;margin-left:-6px;color:#374151;border-radius:8px}
  #app .panel .cch-volver svg{width:18px;height:18px}
  #app .panel .cch-ct-h h2{margin:0;min-width:0;font-size:15px;font-weight:600;color:#1f2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  #app .panel .cch-ct-h .cch-tk2{flex:none;font-size:12.5px;color:#6b7280;font-variant-numeric:tabular-nums}
  #app .panel .contact{padding:20px 16px 18px}
  #app .panel .sec{border-bottom:1px solid #eef1f5}
  #app .panel .sec > button{height:auto;padding:12px 16px;gap:8px;font-size:13.5px;font-weight:600;color:#1f2937;line-height:normal}
  #app .panel .sec > button > svg{width:16px;height:16px;color:#6b7280}
  #app .panel .sec > button .src{margin-left:auto;font-size:12px;font-weight:400;color:#6b7280}
  #app .panel .sec > button > svg.chev{width:15px;height:15px;color:#9ca3af}
  #app .panel .sec .body,#app .panel .sec[data-id="acc"] .body{padding:0 16px 12px;gap:10px}
  #app .panel .pc-pr{grid-template-columns:78px minmax(0,1fr);column-gap:10px;min-height:36px;align-items:center}
  #app .panel .pc-pr > span,#app .panel .pc-pr.top > span{font-size:13px;color:#6b7280;padding-top:0}
  #app .panel .pc-ps{height:36px;padding:0 10px;gap:8px;border:1px solid #e5e9f0;border-radius:9px;background:#fff;font-size:13px;font-weight:400;color:#1f2937}
  #app .panel .pc-ps:hover{background:#f8fafc}
  #app .panel .pc-ps[aria-expanded="true"]{border-color:var(--blue);box-shadow:0 0 0 3px var(--blue-soft);background:#fff}
  #app .panel .pc-ps .mini{width:20px;height:20px;font-size:8.5px}
  #app .panel .pc-ps .pc-sq{width:9px;height:9px;border-radius:50%}
  #app .panel .pc-ps .pc-dot{width:9px;height:9px}
  #app .panel .pc-ps > svg.cv{width:14px;height:14px;color:#9ca3af}
  #app .panel .pc-pr .tagsel{padding:0;gap:6px;align-items:flex-start}
  #app .panel .pc-pr .tagsel .tagx{height:26px;padding:0 4px 0 8px;gap:5px;border:0;border-radius:999px;background:#f1f5f9;font-size:12px;color:#374151}
  #app .panel .pc-pr .tagsel .tagx i{width:7px;height:7px}
  #app .panel .pc-pr .tagsel .tg-add{height:26px;padding:0 10px;gap:4px;border:1px dashed #cbd5e1;border-radius:999px;background:#fff;font-size:12px;font-weight:400;color:#6b7280;box-sizing:content-box}
  #app .panel .pc-pr .tagsel .tg-add svg{width:12px;height:12px;stroke-width:1.75}
  #app .panel .recs{gap:8px}
  #app .panel .rec{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1px solid #fde68a;border-radius:10px;background:#fffbeb;font-size:13px}
  #app .panel .rec > svg.cch-rec-ic{width:16px;height:16px;margin-top:1px;color:#a16207;flex:none}
  #app .panel .rec > span{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px;color:#1f2937}
  #app .panel .rec b{font-weight:400;color:#1f2937}
  #app .panel .rec small,#app .panel .rec small.hoy{font-size:12px;font-weight:400;color:#92400e}
  #app .panel .rec small.vence{color:#b91c1c}
  /* Marcar hecho y borrar (la maqueta no los dibuja y se conservan) van a la derecha, separados 20 px: cada uno tiene un
     área de 40 px que no pisa la del otro, así un toque junto al ✓ no borra el recordatorio. El borde del ✓ en #a16207
     (4,9:1 sobre blanco) para que el cuadro se distinga del fondo amarillo. */
  #app .panel .rec .ck{flex:none;position:relative;border-color:#a16207;background:#fff}
  #app .panel .rec .ck::after{content:"";position:absolute;inset:-12.5px}
  #app .panel .rec.hecho .ck{background:var(--green);border-color:var(--green)}
  #app .panel .rec .x{flex:none;position:relative;margin:-2px -4px -2px 10px;color:#a16207}
  #app .panel .rec .x::after{content:"";position:absolute;inset:-9px}
  #app .panel .btn.cch-lnk{align-self:flex-start;height:auto;padding:0;gap:4px;border:0;background:none;font-size:13px;font-weight:500;color:#1976d2}
  #app .panel .btn.cch-lnk:hover{background:none;color:#1976d2;text-decoration:underline}
  #app .panel .btn.cch-lnk svg{width:14px;height:14px}
  /* Los mensajes con el fondo y el margen de 16 px de la maqueta (tablero 3). Un aviso de error con una palabra larga (una
     dirección, un enlace) se parte en vez de salirse por la izquierda y quedar cortado. */
  #app #msgs.msgs{padding:16px;background:#f8fafc}
  #app #msgs .ch-meta.mal > span{overflow-wrap:anywhere}
  /* Las burbujas del tablero 3: sin la foto al lado, texto de 13,5 px, radio 14 con la esquina de la cola en 4, hasta
     260 px de ancho y 8 px entre mensajes; «Hoy» sin rayas; y con pocos mensajes todo queda abajo, junto al cuadro de
     escribir (margin-top:auto en el primero, así se sigue deslizando cuando son muchos). Debajo de cada grupo sigue la
     línea de quién, la hora y el estado, o por qué no se entregó con «Reintentar»: la maqueta no la dibuja y hoy existe. */
  #app #msgs.msgs{gap:8px}
  #app #msgs > :first-child{margin-top:auto}
  #app #msgs .ch-av{display:none}
  #app #msgs .ch-fila{gap:0}
  #app #msgs .ch-col{max-width:100%}
  #app #msgs .ch-b{max-width:260px;padding:9px 13px;border-radius:14px;font-size:13.5px;line-height:1.45}
  #app #msgs .ch-b.in{box-shadow:none}
  #app #msgs .ch-b.in.ult{border-bottom-left-radius:4px}
  #app #msgs .ch-b.out.ult,#app #msgs .ch-b.ia.ult{border-bottom-right-radius:4px}
  #app #msgs .ch-dia{align-self:center}
  #app #msgs .ch-dia::before,#app #msgs .ch-dia::after{display:none}
  /* El cuadro de escribir con las medidas del tablero 3: márgenes de 16, el texto de 13,5 en una caja de 64, herramientas
     de 30 con el ícono de 17 y «Enviar» con radio 9 y el ícono de 15. Lo que la maqueta no dibuja (la línea de la ventana
     de 24 horas debajo, las herramientas de más) se conserva. */
  #app .comp{padding:0 16px 14px}
  #app .comp .mode{margin-top:10px}
  #app .box textarea{min-height:64px;font-size:13.5px}
  #app .box .bar{padding:6px 6px 6px 8px}
  #app .box .bar button.t{width:30px;height:30px}
  #app .box .bar button.t svg{width:17px;height:17px}
  #app .box .bar .send{padding:0 12px;border:0;border-radius:9px;gap:6px}
  #app .box .bar .send svg{width:15px;height:15px}
  /* Finalizar (el ✓ del encabezado): el diálogo cabe en la pantalla. Sin esto, a 390 px la X y el botón de finalizar
     quedaban cortados a la derecha y a 360 también el interruptor y el motivo. El motivo baja debajo de su rótulo. */
  #ov-res .res{grid-template-columns:minmax(0,1fr)}
  #ov-res .res .opt{flex-wrap:wrap}
  #ov-res .res .opt > div:first-child{flex:1 1 160px;min-width:0}
  #ov-res .res .opt > .dsel{flex:1 1 100%;min-width:0!important}
  #ov-res .res .ft{flex-wrap:wrap}
  /* Si en escritorio se ocultó el panel del contacto (panel-min) y la ventana pasa a celular, va igual una sola columna:
     la regla de panel-min (dos clases) le ganaba a la de una columna y el chat quedaba de 236 px. */
  #app.panel-min{grid-template-columns:minmax(0,1fr)}
  /* Los toques más usados miden como la maqueta (‹ 30, ✓ y ⋯ 32, herramientas 30, «Agregar recordatorio» de 20 de
     alto, la × de cada etiqueta 18); el área que se puede tocar es más grande sin cambiar el dibujo y sin pisar la de al
     lado: ‹ de 44, ✓ y ⋯ de 40, herramientas de 32 x 40, el enlace de 40 de alto y la × de 26. El ::after se mide desde
     dentro del borde: en ✓ y ⋯ (borde de 1 px) va 5 px afuera para llegar a 40. */
  #app .chat-h .back,#app .chat-h .acts .btn,#app .panel .cch-volver,#app .box .bar button.t,#app .panel .btn.cch-lnk,#app .panel .pc-pr .tagsel .tagx button{position:relative}
  #app .chat-h .back::after,#app .panel .cch-volver::after{content:"";position:absolute;inset:-7px}
  #app .chat-h .acts .btn::after{content:"";position:absolute;inset:-5px}
  #app .box .bar button.t::after{content:"";position:absolute;inset:-5px -1px}
  #app .panel .btn.cch-lnk::after{content:"";position:absolute;inset:-10px -4px}
  #app .panel .pc-pr .tagsel .tagx button::after{content:"";position:absolute;inset:-4px}
}
</style>`);

  /* ── Encabezado: la foto y el nombre quedan en una sola zona que abre el panel del contacto ── */
  const cab = document.querySelector('.chat-h'), av = document.getElementById('c-av'), quien = cab.querySelector('.who');
  const zona = document.createElement('div'); zona.className = 'cch-zona';
  av.before(zona); zona.append(av, quien);
  const tk = document.createElement('span'); tk.className = 'cch-tk';
  document.getElementById('c-name').after(tk);
  const esp = document.createElement('span'); esp.className = 'cch-esp';
  const pestanas = document.querySelector('.subtabs'); pestanas.append(esp);
  document.getElementById('cerrar').setAttribute('aria-label', 'Finalizar');
  // El ‹ solo se ve en celular: se anuncia como en la maqueta (tableros 3 y 3.1).
  document.getElementById('back').setAttribute('aria-label', 'Volver a la lista');

  // Si la fila de las pestañas no cabe con las medidas de la maqueta (celular de 360 px), se va apretando por pasos.
  // Cabe si la espera termina antes del margen derecho: el desborde se come primero ese margen y scrollWidth no lo ve.
  function ajustarPestanas(){
    const N = ['cch-justo', 'cch-justo2', 'cch-justo3'];
    pestanas.classList.remove(...N);
    if (!esCel() || !pestanas.clientWidth) return;
    const cabe = () => { const r = pestanas.getBoundingClientRect(), pd = parseFloat(getComputedStyle(pestanas).paddingRight) || 0;
      return esp.getBoundingClientRect().right <= r.right - pd + 0.5 && pestanas.scrollWidth <= pestanas.clientWidth; };
    for (const n of N) { if (cabe()) return; pestanas.classList.remove(...N); pestanas.classList.add(n); }
  }
  if (window.ResizeObserver) new ResizeObserver(() => ajustarPestanas()).observe(pestanas);

  function pintarCabecera(c){
    tk.textContent = c ? '#' + c.id : '';
    if (!c) return;
    // La espera pasa a la fila de las pestañas: reloj y tiempo en rojo, o «Al día» en verde.
    esp.className = 'cch-esp' + (c.espera ? '' : ' ok');
    esp.innerHTML = svg(ICO.reloj) + (c.espera ? `<span class="cch-sr">Espera </span>${esc(c.espera)}` : 'Al día');
    if (esCel()) {
      // Segunda fila sin el número del ticket (que ya va junto al nombre): el canal o la línea y el teléfono.
      // Si no cabe, se recorta el nombre de la línea y el teléfono queda completo. Si en vez de teléfono hay un correo
      // o un usuario (Instagram, Messenger), el nombre del canal va completo y se recorta ese dato.
      const l = LINEAS.find(x => x.id === c.linea), canal = CANALES[c.canal] || {n: ''};
      const nombre = c.canal === 'wa' && st.rol === 'l' && l ? l.n : canal.n, tel = String(c.tel || '');
      // Sin ningún dato al lado, el nombre de la línea se recorta con puntos como cuando va con teléfono.
      const esTel = /^\+?[\d\s().-]+$/.test(tel), fijo = !!tel && !esTel;
      document.getElementById('c-sub').innerHTML = `<span class="cch-l${fijo ? ' fijo' : ''}">${icCanal(c.canal, c.canal === 'wa' ? 'i wa' : 'i')}${esc(nombre)}</span>${tel ? `<span class="cch-t${esTel ? '' : ' otro'}"> · ${esc(tel)}</span>` : ''}`;
      zona.setAttribute('role', 'button'); zona.tabIndex = 0; zona.setAttribute('aria-label', `Ver el contacto de ${c.n}`);
    } else {
      zona.removeAttribute('role'); zona.removeAttribute('tabindex'); zona.removeAttribute('aria-label');
    }
    ajustarPestanas();
  }

  /* ── Panel del contacto a pantalla completa (3.2) ── */
  let abierto = null;   // id de la conversación cuyo panel está abierto en celular
  const pnl = document.getElementById('panel');
  function abrirContacto(){
    const c = CONV.find(x => x.id === st.sel);
    if (!c || !esCel() || st.pagina || app.classList.contains('sinchat')) return;
    abierto = c.id; app.classList.add('cch-ct');
    panel(c); pnl.scrollTop = 0;
    const v = pnl.querySelector('.cch-volver'); if (v) v.focus({preventScroll: true});
  }
  function cerrarContacto(devolverFoco){
    if (abierto == null) return;
    abierto = null; app.classList.remove('cch-ct');
    cerrarMenusPanel(); const tm = document.getElementById('tag-m'); if (tm) tm.hidden = true;
    if (devolverFoco && esCel()) zona.focus({preventScroll: true});
  }
  zona.addEventListener('click', () => { if (esCel()) abrirContacto(); });
  zona.addEventListener('keydown', e => { if (!esCel() || e.target !== zona || (e.key !== 'Enter' && e.key !== ' ')) return; e.preventDefault(); abrirContacto(); });
  pnl.addEventListener('click', e => { if (e.target.closest('.cch-volver')) cerrarContacto(true); });
  // Escape: primero cierra el diálogo o el menú que esté abierto (el menú devuelve el foco a su botón); si no hay ninguno, el panel.
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || abierto == null || !esCel()) return;
    if (['ov-x', 'ov-res', 'ov'].some(id => { const o = document.getElementById(id); return o && !o.hidden; })) return;
    const m = pnl.querySelector('.menu:not([hidden])');
    if (m) {
      e.preventDefault(); m.hidden = true;
      const b = m.closest('.dd') && m.closest('.dd').querySelector(':scope > button');
      if (b) { if (b.hasAttribute('aria-expanded')) b.setAttribute('aria-expanded', 'false'); b.focus({preventScroll: true}); }
      return;
    }
    e.preventDefault(); cerrarContacto(true);
  }, true);
  // Lo que se abre hacia abajo (el menú de un campo, el formulario de un recordatorio) quedaba bajo el borde de la
  // pantalla y parecía que el botón no hacía nada: el panel baja lo justo para mostrarlo entero, sin esconder su fila
  // bajo la cabecera.
  function mostrarEnPanel(el){
    if (!el || abierto == null || !el.getClientRects().length) return;
    const p = pnl.getBoundingClientRect(), r = el.getBoundingClientRect(), h = pnl.querySelector('.cch-ct-h');
    const fila = (el.closest('.pc-pr') || el.closest('.dd') || el).getBoundingClientRect();
    const falta = r.bottom - (p.bottom - 12), sobra = Math.min(fila.top, r.top) - (p.top + (h ? h.offsetHeight : 0) + 8);
    if (falta > 0 && sobra > 0) pnl.scrollTop += Math.min(falta, sobra);
  }
  // En captura: los manejadores de equipo y etiquetas frenan el clic en la captura del panel y en burbuja no se vería.
  pnl.addEventListener('click', e => {
    if (abierto == null || !esCel()) return;
    const rec = !!e.target.closest('[data-rec-nuevo]');
    requestAnimationFrame(() => mostrarEnPanel(pnl.querySelector('.menu:not([hidden])') || (rec ? pnl.querySelector('.rnew') : null)));
  }, true);
  // Se cierra solo si la vista cambia por debajo: vuelve a la lista, abre una página o se queda sin conversación.
  let teniaOpen = app.classList.contains('open');
  new MutationObserver(() => {
    const a = app.classList, open = a.contains('open');
    if (abierto != null && ((teniaOpen && !open) || a.contains('pg') || a.contains('sinchat'))) cerrarContacto(false);
    teniaOpen = open;
  }).observe(app, {attributes: true, attributeFilter: ['class']});

  // El foco no se pierde cuando el panel se repinta (llega un mensaje, otro asesor cambia algo): vuelve al mismo control.
  function claveFoco(){
    const a = document.activeElement; if (!a || a === pnl || !pnl.contains(a)) return null;
    if (a.id) return '#' + CSS.escape(a.id);
    for (const n of a.getAttributeNames()) if (n.startsWith('data-')) return `[${n}="${CSS.escape(a.getAttribute(n))}"]`;
    return a.classList.contains('cch-volver') ? '.cch-volver' : null;
  }
  // Resumen a la derecha del título de una sección (el producto, el interés): se crea, se cambia o se quita.
  function resumen(s, t){
    const b = s && s.querySelector(':scope > button'); if (!b) return;
    let r = b.querySelector('.src');
    if (!t) { if (r) r.remove(); return; }
    if (!r) { r = document.createElement('span'); r.className = 'src'; b.querySelector('svg.chev').before(r); }
    r.textContent = t;
  }
  function formaPanel(c){
    pnl.insertAdjacentHTML('afterbegin', `<div class="cch-ct-h"><button type="button" class="cch-volver" aria-label="Volver al chat">${svg(ICO.volver)}</button><h2>${esc(c.n)}</h2><span class="cch-tk2">#${c.id}</span></div>`);
    const sec = id => pnl.querySelector(`.sec[data-id="${id}"]`);
    // Orden del tablero 3.2: debajo de la cabecera, lo que dibuja la maqueta, en su orden. Lo que el panel tiene y la
    // maqueta no dibuja se conserva con su estilo: el anuncio de origen antes de «Lo que busca», como en escritorio, y la
    // tarjeta del contacto (Agregar o Ver, Editar, Silenciar, Llamar, sus datos y la autorización de datos) al final, para
    // que la primera pantalla sea la de la maqueta.
    let ancla = pnl.querySelector('.cch-ct-h');
    for (const id of ['acc', 'rec', 'campos', 'compra', 'pauta', 'guia', 'prev']) { const s = sec(id); if (s) { ancla.after(s); ancla = s; } }
    const tarjeta = pnl.querySelector('.contact'); if (tarjeta) ancla.after(tarjeta);
    // Filas de «Conversación»: Equipo, Asesor, Etapa, Etiquetas y Prioridad.
    const cuerpo = sec('acc') && sec('acc').querySelector('.body');
    if (cuerpo) for (const id of ['dd-eq', 'dd-asig', 'dd-etq', 'dd-tag', 'dd-pri']) { const d = pnl.querySelector('#' + id), f = d && d.closest('.pc-pr'); if (f) cuerpo.append(f); }
    for (const [id, d] of [['acc', ICO.ajustes], ['rec', ICO.campana], ['campos', ICO.persona], ['compra', ICO.carrito], ['guia', ICO.brujula], ['prev', ICO.historial]]) {
      const s0 = sec(id) && sec(id).querySelector(':scope > button > svg:first-child'); if (s0) s0.outerHTML = svg(d);
    }
    // Resúmenes de las plegadas: el producto comprado y lo que busca.
    const est = c.contactoId ? crmFichaExterna(c.contactoId) : null, cp = (est && est.datos && est.datos.compras) || c.ficha.compras;
    if (cp && cp.p) resumen(sec('compra'), cp.p);
    resumen(sec('guia'), c.ficha.interes || '');
    // «Conversación» y «Recordatorios de seguimiento» abiertas; lo que la persona abra o cierre se sigue recordando.
    const r = sec('rec');
    if (r && !('rec' in SEC_CERRADA)) { r.removeAttribute('data-closed'); r.querySelector(':scope > button').setAttribute('aria-expanded', 'true'); }
    // Cada recordatorio con la campana de la maqueta y la hora como «Hoy · 4:00 p. m.»; marcar hecho y borrar siguen ahí, a la derecha.
    pnl.querySelectorAll('.recs .rec').forEach(x => {
      x.insertAdjacentHTML('afterbegin', svg(ICO.campana, 'i cch-rec-ic'));
      const ck = x.querySelector(':scope > .ck'), tx = x.querySelector(':scope > span'); if (ck && tx) tx.after(ck);
      const sm = x.querySelector('small'); if (sm) sm.textContent = sm.textContent.replace(/, (?=\d{1,2}:\d{2} [ap]\. m\.$)/, ' · ');
    });
    const nuevo = pnl.querySelector('[data-rec-nuevo]');
    if (nuevo) { nuevo.classList.add('cch-lnk'); nuevo.innerHTML = svg(ICO.mas) + 'Agregar recordatorio'; }
  }
  const panelAntes = panel;
  panel = function(c){
    const foco = esCel() ? claveFoco() : null;
    panelAntes(c);
    if (!esCel() || !c) return;
    formaPanel(c);
    if (foco) { const el = pnl.querySelector(foco); if (el && el !== document.activeElement) el.focus({preventScroll: true}); }
  };

  /* ── Ficha del cliente (3.1) ── */
  function formaFicha(){
    const c = CONV.find(x => x.id === st.sel), f = document.getElementById('ficha'); if (!c || !f) return;
    const ICONOS = {'Datos': ICO.persona, 'Lo que busca': ICO.brujula, 'En la plataforma': ICO.persona, 'Compras': ICO.carrito, 'Conversaciones anteriores': ICO.globo};
    for (const card of f.querySelectorAll('.fcard')) {
      const h = card.querySelector('h4'); if (!h) continue;
      const t = h.textContent.trim(), s0 = h.querySelector('svg');
      if (ICONOS[t] && s0) s0.outerHTML = svg(ICONOS[t]);
      if (t === 'En la plataforma') {
        // Las fechas de los productos como en la maqueta: «12 ago 2026».
        const est = crmFichaExterna(c.contactoId), productos = (est && est.datos && est.datos.productos) || [];
        card.querySelectorAll('.hist > div').forEach((fila, i) => { const x = productos[i], sp = fila.lastElementChild; if (x && x.fecha && sp) sp.textContent = fechaCorta(x.fecha, true); });
      }
      if (t === 'Compras') {
        // La próxima cuota con su fecha, como en la maqueta («15 oct 2026»); sin fecha (pagado completo) queda el texto.
        const est = crmFichaExterna(c.contactoId), cp = (est && est.datos && est.datos.compras) || c.ficha.compras;
        const dt = [...card.querySelectorAll('.kv dt')].find(x => x.textContent === 'Próxima');
        if (cp && cp.proxFecha && dt && dt.nextElementSibling) dt.nextElementSibling.textContent = fechaCorta(cp.proxFecha, true);
      }
      if (t === 'Conversaciones anteriores') {
        // Una fila por conversación: «#812 · Ventas · finalizada» y la fecha a la derecha. Las del CRM se siguen abriendo al tocarlas.
        const l = card.querySelector('.pc-hist'); if (!l) continue;
        const filas = [...l.children].map(el => {
          if (el.dataset.prevConv) {
            const o = CONV.find(x => x.id === +el.dataset.prevConv); if (!o) return '';
            const t2 = (o._t && (o._t.finalizada || o._t.ultimo)) || Date.now();
            return `<button type="button" class="cch-hl" data-prev-conv="${o.id}" title="Ver la conversación"><span>#${o.id} · ${esc(equipoConv(o))} · finalizada</span><span>${esc(fechaCorta(t2))}</span></button>`;
          }
          const sp = el.querySelector(':scope > span'), sm = sp && sp.querySelector('small');
          const a = sp ? [...sp.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('') : el.textContent;
          // La fecha corta como en la maqueta: «27 sep» y no «27-sep» (así la guarda el API en el origen anterior).
          return `<div><span>${esc(a)}</span><span>${esc(sm ? sm.textContent.replace(/^(\d{1,2})-([a-zñ]{3})\b/i, '$1 $2') : '')}</span></div>`;
        });
        l.outerHTML = `<div class="hist">${filas.join('')}</div>`;
      }
    }
  }
  const fichaAntes = pintarFicha;
  pintarFicha = function(){ fichaAntes(); if (esCel()) formaFicha(); };

  /* ── Al finalizar la conversación abierta, o si otra persona la toma, se vuelve a la lista (30-sep) ── */
  // En celular, si la conversación que estaba en pantalla sale de la vista (se finalizó, se la asignaron a otra persona o
  // ya no la ve), se vuelve a la lista. Antes se abría sola la siguiente y quedaba leída sin que nadie la eligiera: por
  // eso se mira antes de pintar, porque render() y chat() dan por leída la que queda en pantalla. Cuenta solo con la misma
  // vista en que se abrió (un aviso de la campana que abre otra y cambia los filtros la sigue abriendo), y unir deja
  // abierta la que queda, como antes.
  let enPantalla = null, vistaDe = '', uniendo = false;
  const firmaVista = () => [st.vista, st.est, st.menciones, st.carpeta, st.equipo, st.etq, st.linea, st.canal, st.tag, st.q].join('|');
  // Vuelve a la lista; si el foco quedó en algo que ya no se ve, pasa al ☰ de la lista.
  function aLaLista(){
    app.classList.remove('open');
    const f = document.activeElement;
    if (!f || f === document.body || !f.getClientRects().length) { const h = [...document.querySelectorAll('.list-h .cj-abrir')].find(x => x.getClientRects().length); if (h) h.focus({preventScroll: true}); }
  }
  function volverSiSalio(){
    if (enPantalla == null || uniendo || !esCel() || st.pagina || !app.classList.contains('open')) return;
    const vis = st.menciones ? convsMencion() : visibles();
    if (firmaVista() === vistaDe && !vis.some(x => x.id === enPantalla)) aLaLista();
  }
  function anotar(){ const si = esCel() && !st.pagina && app.classList.contains('open') && !app.classList.contains('sinchat'); enPantalla = si ? st.sel : null; vistaDe = si ? firmaVista() : ''; }
  const renderAntes = render;
  render = function(){ volverSiSalio(); renderAntes.apply(this, arguments); anotar(); };
  const unirAntes = unir;
  unir = async function(){ uniendo = true; try { return await unirAntes.apply(this, arguments); } finally { uniendo = false; } };

  /* ── chat(): el encabezado de celular, y el panel se cierra si cambió la conversación ── */
  const chatAntes = chat;
  chat = function(){
    volverSiSalio();
    chatAntes();
    const sin = app.classList.contains('sinchat'), c = sin ? null : CONV.find(x => x.id === st.sel) || null;
    if (abierto != null && (!c || c.id !== abierto || !esCel())) cerrarContacto(false);
    // En celular, si la conversación abierta sale de la vista y la vista queda vacía (se finalizó o alguien la tomó), se
    // vuelve a la lista: sin esto quedaba «Elige una conversación de la lista» sin la lista, sin ‹ y sin ☰.
    if (sin && esCel() && app.classList.contains('open')) aLaLista();
    pintarCabecera(c);
    anotar();
  };

  // Con teclado o lector de pantalla, en celular el foco no se pierde al cambiar de vista (lo que tenía el foco se
  // esconde): al abrir una conversación desde la lista va al ‹ del chat, y al volver con ‹ va a la tarjeta de esa
  // conversación (o al ☰ de la lista si ya no está).
  document.getElementById('items').addEventListener('click', e => {
    if (!esCel() || !e.target.closest('[data-c]') || !app.classList.contains('open')) return;
    const bk = document.getElementById('back'); if (bk.getClientRects().length) bk.focus({preventScroll: true});
  });
  document.getElementById('back').addEventListener('click', () => {
    if (!esCel()) return;
    const t = [document.querySelector(`#items [data-c="${st.sel}"]`), ...document.querySelectorAll('.list-h .cj-abrir')].find(x => x && x.getClientRects().length);
    if (t) t.focus({preventScroll: true});
  });

  // Al pasar de celular a escritorio (o al revés) se repinta con la forma que toca.
  const alCambiar = () => { if (!esCel()) cerrarContacto(false); if (!st.pagina && CONV.length) chat(); else ajustarPestanas(); };
  if (CEL.addEventListener) CEL.addEventListener('change', alCambiar); else if (CEL.addListener) CEL.addListener(alCambiar);
})();
