/* ── Celular: menú ☰ y cajón con la barra lateral (maqueta aprobada «CRM · menú en celular», 29-sep, tableros 1 y 2). ── */
/* ── Tu cuenta abajo de la barra: foto y nombre en un renglón; debajo el estado y el engranaje de Ajustes (maqueta
   aprobada «CRM · tu cuenta y el estado de conexión», 29-sep). Vale en escritorio y en el cajón del celular. ── */
// Con 1000 px o menos la barra no cabe: se esconde (crm.html) y sale el ☰ a la izquierda del título de la lista y de
// cada página, que abre la misma barra como cajón de 300 px sobre un velo. En celular (menos de 760 px) va además una
// sola columna. Entre 760 y 1000 px solo pasa con /crm/app abierto suelto: en la plataforma el marco se escala a 1085 px
// o más. Va dentro de una función para no dejar nombres sueltos en el ámbito que comparten todos los archivos del CRM.
(() => {
  const ANGOSTO = window.matchMedia('(max-width:1000px)');
  const app = document.getElementById('app'), nav = app.querySelector('.nav'), marca = nav.querySelector('.brand'), me = nav.querySelector('.me');
  const svg = d => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const P_ABAJO = 'm6 9 6 6 6-6', P_ARRIBA = 'm6 15 6-6 6 6';

  document.head.insertAdjacentHTML('beforeend', `<style>
.cj-abrir,.cj-cerrar,.cj-ic{display:none}
.cj-medio,.cj-pgh{display:contents}
@media (max-width:1000px){
  /* ☰ de 34 px, sin borde, a la izquierda del título; resaltado mientras el cajón está abierto (tableros 1, 2 y 4). */
  .cj-abrir{display:grid;place-items:center;flex:none;width:34px;height:34px;margin-left:-6px;padding:0;border:0;border-radius:8px;background:none;color:#1f2937}
  .cj-abrir svg{width:20px;height:20px}
  .cj-abrir[aria-expanded="true"]{background:#fffde6;color:#1565c0}
  /* El título se recorta con puntos si no cabe (una carpeta o una etapa de nombre largo). La cabecera es una rejilla de
     columna automática que crecía con la fila: sin minmax(0,1fr) la fila se salía de la pantalla con Filtrar y Ordenar. */
  .list-h{grid-template-columns:minmax(0,1fr)}
  .list-h .t h2{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  /* El ☰ y la X miden 34 px como en la maqueta; el área que se puede tocar llega a 40 sin cambiar el dibujo. */
  .cj-abrir,.cj-cerrar{position:relative}
  .cj-abrir::after,.cj-cerrar::after{content:"";position:absolute;inset:-3px}
  /* Sin la columna de la barra, las páginas ocupan todo el ancho. */
  .page{grid-column:1 / -1}
  .page .cj-pgh{display:flex;align-items:center;gap:8px;min-width:0}
  .page .cj-pgh > h2{margin:0;min-width:0}
  .page .cj-pgh.solo{margin:0 0 8px}
  /* Cajón: la misma barra, de 300 px, con esquinas derechas de 16 px y sombra, sobre el velo. La marca con la X queda
     arriba y tu cuenta abajo; lo del medio se desliza si no cabe. Con line-height normal, como la maqueta: cada opción
     mide 36 px y no 36,25. */
  .app.cj-abierto > .nav{display:flex;position:fixed;top:0;bottom:0;left:0;z-index:62;width:300px;padding:14px 12px;gap:16px;overflow:hidden;border-right:0;border-radius:0 16px 16px 0;background:#fff;box-shadow:12px 0 40px -16px rgba(15,23,42,.45);line-height:normal;animation:cj-entra .2s ease-out}
  .app.cj-abierto > .nav > .brand{flex:none;padding:2px 4px 2px 8px}
  .app.cj-abierto .cj-medio{display:flex;flex-direction:column;gap:16px;flex:1 1 auto;min-height:0;margin:0 -12px;padding:0 12px;overflow-y:auto;overscroll-behavior:contain}
  .app.cj-abierto > .nav > .me{flex:none;margin-top:0}
  .app.cj-abierto .cj-cerrar{display:grid;place-items:center;flex:none;width:34px;height:34px;margin-left:auto;padding:0;border:0;border-radius:8px;background:none;color:#6b7280}
  .app.cj-abierto .cj-cerrar svg{width:18px;height:18px}
  /* «Conversación nueva» de 36 px con el lápiz de 16, y los títulos de sección sin la raya de abajo (tablero 2). Los
     títulos y los números de cada opción en #6b7280, para que se lean (30-sep). */
  .app.cj-abierto .nueva-conv{height:36px}
  .app.cj-abierto .nueva-conv svg{width:16px;height:16px}
  .app.cj-abierto > .nav .sec{border-bottom:0;color:#6b7280}
  .app.cj-abierto > .nav li button .n{color:#6b7280}
  /* Los encabezados de grupo (el equipo en Etapas y Etiquetas) conservan su gris #4b5563, como en la maqueta. */
  .app.cj-abierto > .nav li button:not(.bl-gr){color:#374151}
  .app.cj-abierto > .nav li button > svg.i:is(:first-child,.cj-ic):not(.wa){color:#6b7280}
  /* La opción elegida, sobre #fffde6, con su ícono y su número en #1565c0, para que se lean (30-sep). En la barra por
     roles (62-vistas-rol.js) la de #principal pesa más por el id: se repite con #app. */
  .app.cj-abierto > .nav li button[aria-current="true"],.app.cj-abierto > .nav li button[aria-current="true"] > svg.i:is(:first-child,.cj-ic):not(.wa){color:#1565c0}
  .app.cj-abierto > .nav li button[aria-current="true"] > .n,#app.cj-abierto > .nav #principal button[aria-current="true"],#app.cj-abierto > .nav #principal button[aria-current="true"] > svg.vr-ic{color:#1565c0}
  /* En el cajón, los íconos de la maqueta (tablero 2); en escritorio la barra sigue con los suyos. */
  #principal button:has(> .cj-ic) > svg.i:first-child,#nuevo > svg.i:first-child{display:none}
  #principal button > .cj-ic,#nuevo > .cj-ic{display:block}
  .app.cj-abierto > .nav li.bl-sub button{padding:7px 10px 7px 28px}
  .app.cj-abierto > .nav li.bl-sub button:not([aria-current="true"]){color:#374151}
  .cj-velo{position:fixed;inset:0;z-index:61;background:rgba(15,23,42,.28);touch-action:none;animation:cj-aparece .2s ease-out}
  html.cj-bloqueo,html.cj-bloqueo body{overflow:hidden}
  html.cj-bloqueo .toast{z-index:64}
}
@keyframes cj-entra{from{transform:translateX(-100%)}}
@keyframes cj-aparece{from{opacity:0}}
@media (prefers-reduced-motion:reduce){.app.cj-abierto > .nav,.cj-velo{animation:none}}
/* Celular: la app ocupa todo el marco, como el teléfono de las maquetas (sin el margen gris ni el borde de escritorio). */
@media (max-width:759.98px){
  body{padding:0}
  .app{height:100vh;height:100dvh;border:0;border-radius:0}
  /* Sin chat al lado, la lista no lleva la raya de la derecha: en el teléfono quedaba una línea gris en el borde. */
  .list{border-right:0}
  /* Tablero 1, la cabecera de la lista: «Conversaciones» con line-height normal (25 px, como la maqueta; con el 1.5 de la
     página medía 24 y el texto quedaba medio píxel arriba), «Abiertas» de 24 px, filtrar y ordenar de 30 px pegados con
     el ícono de 17 y el buscador de 38 px. */
  .list-h .t h2{line-height:normal}
  .list-h .t #b-est{height:24px;gap:4px;padding:0 8px;border-radius:8px;color:#374151}
  .list-h .t .ic{gap:0}
  .list-h .t .ic > .dd > button{color:#374151}
  .list-h .t .ic > .dd > button svg{width:17px;height:17px}
  .list-h .lq{height:38px;background:#f6f7f9}
  .list-h .lq:focus-within{background:#fff}
  /* «Abiertas» (24 px de alto) y Filtrar y Ordenar (30 px, pegados como en la maqueta): el área que se puede tocar llega
     a 40 px de alto sin cambiar el dibujo ni pisar la de al lado. */
  .list-h .t #b-est,.list-h .t .ic > .dd > button{position:relative}
  .list-h .t #b-est::after{content:"";position:absolute;inset:-8px -2px}
  .list-h .t .ic > .dd > button::after{content:"";position:absolute;inset:-5px 0}
  /* Con una sola columna no hay chat al lado: ninguna tarjeta sale resaltada como la abierta. */
  .items .it[aria-current="true"]{background:none}
  /* Tu estado: el elegido va sobre #fffde6; su descripción en #4b5563 y el ✓ en #1565c0, para que se lean (30-sep). */
  .cu-op[aria-selected="true"] small{color:#4b5563}
  .cu-op[aria-selected="true"] > svg{color:#1565c0}
}
@media (max-width:759.98px) and (hover:none){.items .it:hover{background:none}}
/* En un celular de 360 px «Conversaciones» no cabía entero con 8 px entre el ☰, el título, Abiertas y los íconos:
   por debajo de 380 px van 6 (la maqueta está dibujada a 390). */
@media (max-width:379.98px){.list-h .t{gap:6px}}
/* Tu cuenta: foto y nombre en un renglón (con puntos si no cabe); debajo el estado y el engranaje, de 34 px. */
.nav .me{flex-direction:column;align-items:stretch;gap:10px;padding:12px 4px 2px;border-top:1px solid #eef1f5;line-height:normal}
.nav .me .cu-fila{display:flex;align-items:center;gap:10px;min-width:0}
.nav .me .av{width:32px;height:32px;font-size:11px;font-weight:600;color:#fff;overflow:hidden}
.nav .me .cu-nom{min-width:0;font-size:13px;font-weight:500;color:#1f2937;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nav .me .cu-ctl{display:flex;align-items:center;gap:8px}
.nav .me .cu-est{flex-grow:1;min-width:0;display:flex;align-items:center;gap:8px;height:34px;padding:0 10px;border:1px solid #e5e9f0;border-radius:9px;background:#fff;font-size:13px;color:#1f2937;text-align:left}
.nav .me .cu-est:hover{border-color:#cbd5e1}
.nav .me .cu-est[aria-expanded="true"]{border-color:#0b0b10;box-shadow:0 0 0 3px #fffde6}
.nav .me #me-e{flex-grow:1;min-width:0;display:flex;align-items:center;gap:8px;font-size:13px;color:#1f2937;white-space:nowrap;overflow:hidden}
.nav .me #me-e .est-dot{flex:none;width:8px;height:8px;margin:0;vertical-align:0}
.nav .me .cu-est > svg{width:14px;height:14px;color:#9ca3af;stroke-width:1.8}
.nav .me #b-ajustes{flex:none;width:34px;height:34px;border-radius:9px;color:#374151}
.nav .me #b-ajustes svg{width:17px;height:17px;stroke-width:1.8}
/* El menú del estado abre hacia arriba, de 296 px, y puede salir por encima de la lista. */
.cu-menu{position:fixed;z-index:63;width:296px;display:flex;flex-direction:column;gap:2px;padding:6px;border:1px solid #e5e9f0;border-radius:12px;background:#fff;box-shadow:0 14px 30px -12px rgba(21,32,58,.35);line-height:normal}
.cu-op{display:flex;align-items:flex-start;gap:10px;width:100%;padding:9px 10px;border-radius:9px;text-align:left;color:#1f2937}
.cu-op:hover{background:#f3f6fa}
.cu-op[aria-selected="true"]{background:#fffde6}
.cu-op > i{flex:none;width:8px;height:8px;margin-top:6px;border-radius:50%}
.cu-op > span{flex-grow:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.cu-op b{font-size:13.5px;font-weight:400;color:#1f2937}
.cu-op small{font-size:12px;line-height:1.35;color:#6b7280}
.cu-op > svg{width:16px;height:16px;margin-top:2px;color:#0b0b10;stroke-width:1.8}
</style>`);

  /* ── 1 · El cajón. Es la misma barra (con sus grupos por equipo, 48-barra.js): se le agrega la X y lo del medio va en una
     envoltura que en escritorio no cuenta para el diseño (display:contents), para que en el cajón la marca quede arriba y
     tu cuenta abajo mientras lo demás se desliza. ── */
  nav.id = nav.id || 'cj-nav';
  nav.setAttribute('aria-label', 'Menú del CRM');
  const medio = document.createElement('div'); medio.className = 'cj-medio';
  [...nav.children].filter(x => x !== marca && x !== me).forEach(x => medio.append(x));
  marca.after(medio);
  const cerrarX = document.createElement('button');
  cerrarX.type = 'button'; cerrarX.className = 'cj-cerrar'; cerrarX.setAttribute('aria-label', 'Cerrar el menú');
  cerrarX.innerHTML = svg('<path d="M6 6l12 12M18 6 6 18"/>');
  marca.append(cerrarX);
  const velo = document.createElement('div'); velo.className = 'cj-velo'; velo.hidden = true; velo.setAttribute('aria-hidden', 'true');
  app.after(velo);
  // Los íconos del tablero 2 (Mi bandeja, Conversaciones, Contactos, Embudo, Difusiones, Plantillas, Informes, Equipo en
  // vivo y el lápiz de «Conversación nueva»): cada botón lleva los dos y el CSS muestra el de la maqueta solo en el cajón.
  // nav() rehace la lista con cada repintado: se vuelven a poner después de cada nav().
  const IC_CAJON = {
    inbox: '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5 5h14l2 8v6H3v-6l2-8Z"/>',
    todas: '<path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.4A8.5 8.5 0 1 1 21 12Z"/>',
    contactos: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    embudo: '<rect x="4" y="5" width="4" height="14" rx="1"/><rect x="10" y="9" width="4" height="10" rx="1"/><rect x="16" y="12" width="4" height="7" rx="1"/>',
    difusiones: '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z"/><path d="M15 9a3 3 0 0 1 0 6"/>',
    plantillas: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    informes: '<path d="M4 20h16M7 16v-5M12 16V6M17 16v-8"/>',
    vivo: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.8 3 2.6 3.5 5.2"/>',
  };
  const icCajon = (el, d) => { const i = el && el.querySelector(':scope > svg.i:not(.cj-ic)'); if (i && !el.querySelector(':scope > .cj-ic')) i.insertAdjacentHTML('afterend', svg(d).replace('class="i"', 'class="i cj-ic"')); };
  const iconosCajon = () => { for (const [k, d] of Object.entries(IC_CAJON)) icCajon(nav.querySelector(`#principal [data-nav="${k}"]`), d); };
  icCajon(document.getElementById('nuevo'), '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>');
  // Aquí `nav` es la barra; la función que la pinta es la global (10-nucleo.js, envuelta en 40-ajustes.js y 48-barra.js).
  const navSinIconos = window.nav;
  window.nav = function(){ navSinIconos.apply(this, arguments); iconosCajon(); };
  iconosCajon();

  let abierto = false, quien = null;   // quien: el ☰ que lo abrió, para devolverle el foco al cerrar
  function boton(){
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'cj-abrir'; b.setAttribute('aria-label', 'Abrir el menú');
    b.setAttribute('aria-controls', nav.id); b.setAttribute('aria-expanded', String(abierto));
    b.innerHTML = svg('<path d="M4 7h16M4 12h16M4 17h16"/>');
    return b;
  }
  document.getElementById('lt').before(boton());

  // El menú de «Abiertas» (180 px, alineado con la píldora) se salía por la derecha en un celular de 360 px: al abrirse,
  // si no cabe, se corre a la izquierda lo justo para quedar a 16 px del borde de la lista. Con 1000 px o más no se toca.
  const mEst = document.getElementById('m-est');
  new MutationObserver(() => {
    if (mEst.hidden) return;
    mEst.style.left = '0px';
    if (!ANGOSTO.matches) return;
    const lim = document.querySelector('section.list').getBoundingClientRect().right - 16, r = mEst.getBoundingClientRect();
    if (r.right > lim) mEst.style.left = Math.round(lim - r.right) + 'px';
  }).observe(mEst, {attributes: true, attributeFilter: ['hidden']});

  // ☰ en las páginas, a la izquierda de su título (tablero 4: ☰ y «Mis ajustes»), para cualquier página que se pinte,
  // también las que vengan después: el título es el primer h2 de #page que se ve (en Contactos, el «Contactos» de su
  // columna izquierda, que va arriba a la izquierda como en las demás), y se envuelve con el ☰ en un div.cj-pgh que toma
  // sus márgenes, así la página no se corre. Las subpáginas con «‹ Volver» encima del título, como una sección abierta
  // (tablero 6, Mi perfil), se quedan sin ☰: se sale por el «‹». Una página sin título ni «‹» lleva el ☰ solo, arriba:
  // en celular nadie se queda sin cómo volver al menú.
  function enPagina(){
    if (!ANGOSTO.matches) return;
    const pg = document.getElementById('page');
    const ya = pg.querySelector('.cj-abrir, button[aria-label="Abrir el menú"]');
    if (ya) { if (!ya.classList.contains('cj-abrir')) { ya.classList.add('cj-abrir'); ya.setAttribute('aria-controls', nav.id); ya.setAttribute('aria-expanded', String(abierto)); } return; }
    const ts = [...pg.querySelectorAll('h2, .cts-h > b')], h = ts.find(x => x.getClientRects().length) || ts[0];
    const v = pg.querySelector('.volver');
    if (v && (!h || v.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING)) return;
    const w = document.createElement('div'); w.className = 'cj-pgh';
    if (!h) { w.classList.add('solo'); w.append(boton()); pg.prepend(w); return; }
    const cs = getComputedStyle(h);
    w.style.margin = [cs.marginTop, cs.marginRight, cs.marginBottom, cs.marginLeft].join(' ');
    h.before(w); w.append(boton(), h);
  }
  new MutationObserver(enPagina).observe(document.getElementById('page'), {childList: true, subtree: true});

  const marcar = () => document.querySelectorAll('.cj-abrir').forEach(b => b.setAttribute('aria-expanded', String(abierto)));
  const enfocables = () => [...nav.querySelectorAll('button, [href], input, select, textarea, [tabindex]')].filter(x => x.tabIndex >= 0 && !x.disabled && x.getClientRects().length);
  // Mientras el cajón está abierto, lo de atrás (lista, chat, panel y páginas) queda inerte: ni el foco ni el lector de
  // pantalla llegan ahí.
  let inertes = [];
  function abrir(b){
    if (abierto || !ANGOSTO.matches) return;
    abierto = true; quien = b || null;
    app.classList.add('cj-abierto'); document.documentElement.classList.add('cj-bloqueo'); velo.hidden = false;
    nav.setAttribute('role', 'dialog'); nav.setAttribute('aria-modal', 'true');
    inertes = [...app.children].filter(x => x !== nav && !x.inert); inertes.forEach(x => { x.inert = true; });
    medio.scrollTop = 0; marcar(); cerrarX.focus();
  }
  function cerrar(foco = true){
    if (!abierto) return;
    cuCerrar(false);
    abierto = false;
    app.classList.remove('cj-abierto'); document.documentElement.classList.remove('cj-bloqueo'); velo.hidden = true;
    nav.removeAttribute('role'); nav.removeAttribute('aria-modal');
    inertes.forEach(x => { x.inert = false; }); inertes = [];
    marcar();
    // El foco vuelve al ☰; si ese ya no se ve (se eligió otra página), al ☰ de lo que quedó en pantalla. Si la opción
    // ya lo llevó a otra parte (un diálogo que se abrió), se queda allá.
    const a = document.activeElement;
    const alHam = q => { const b = q && q.isConnected && q.getClientRects().length ? q : [...document.querySelectorAll('.cj-abrir')].find(x => x.getClientRects().length); if (b) b.focus(); };
    // Si la opción abrió un diálogo (Conversación nueva, que toma el foco un momento después), el foco se deja para él;
    // al cerrarlo, si el foco no quedó en ninguna parte, vuelve al ☰ (antes quedaba en la página y el Tab salía del CRM).
    const ov = [...document.querySelectorAll('.ov')].find(x => !x.hidden && x.getClientRects().length);
    if (foco && ov) {
      const q = quien;
      const mo = new MutationObserver(() => {
        if (!ov.hidden) return;
        mo.disconnect();
        // El foco quedó en un campo del diálogo ya escondido (o en la página): cuenta como perdido.
        requestAnimationFrame(() => { const f = document.activeElement; if (!f || f === document.body || !f.getClientRects().length) alHam(q); });
      });
      mo.observe(ov, {attributes: true, attributeFilter: ['hidden']});
    } else if (foco && (!a || a === document.body || nav.contains(a))) {
      enPagina();
      alHam(quien);
    }
    quien = null;
  }
  // En la captura: ningún otro manejador del clic alcanza a estorbarle al ☰.
  document.addEventListener('click', e => { const b = e.target.closest('.cj-abrir'); if (b) abrir(b); }, true);
  velo.addEventListener('click', () => cerrar());
  cerrarX.addEventListener('click', () => cerrar());
  // Elegir cualquier opción lo cierra, después de que la opción hizo lo suyo. Plegar un grupo o tocar tu estado, no.
  // Si la opción lleva a la bandeja, en celular se ve la lista (no el chat que estuviera abierto).
  // «Conversaciones» lleva a Todas y además despliega Menciones y Sin asignar: si con el toque se desplegó, el cajón
  // sigue abierto para que se vean (detrás ya está Todas); si se plegó, se cierra como cualquier opción.
  nav.addEventListener('click', e => {
    if (!abierto) return;
    const b = e.target.closest('button');
    if (!b || b === cerrarX || b.closest('.cu-est, .cu-menu') || b.matches('[data-bl-grupo]')) return;
    if (!st.pagina) app.classList.remove('open');
    if (b.matches('[data-nav="todas"]') && st.convAbierto) return;
    cerrar();
  });
  // Al pasar a escritorio se cierra solo.
  const alCambiarAncho = () => { cuCerrar(false); if (ANGOSTO.matches) enPagina(); else cerrar(false); };
  if (ANGOSTO.addEventListener) ANGOSTO.addEventListener('change', alCambiarAncho); else ANGOSTO.addListener(alCambiarAncho);

  // Mientras está abierto el foco se queda adentro. Si la barra se repinta (llega algo en vivo) y el foco estaba en una
  // opción que se rehízo, vuelve a la misma opción.
  const clave = x => x.id ? '#' + CSS.escape(x.id) : [...x.attributes].filter(a => a.name.startsWith('data-')).map(a => `[${a.name}="${CSS.escape(a.value)}"]`).join('') || null;
  const renderSinCajon = render;
  render = function(){
    const k = abierto && nav.contains(document.activeElement) && document.activeElement !== nav ? clave(document.activeElement) : null;
    renderSinCajon();
    if (abierto && !nav.contains(document.activeElement)) (k && nav.querySelector(k) || cerrarX).focus();
  };
  document.addEventListener('focusin', e => { if (abierto && !nav.contains(e.target) && !e.target.closest('.ov')) (enfocables()[0] || cerrarX).focus(); });

  /* ── 2 · Tu cuenta. Se arma una vez con las mismas piezas (la foto, #me-n, #me-e y el engranaje #b-ajustes con su
     clic), así pintarYo() sigue pintando nombre, foto y estado. ── */
  const meAv = me.querySelector('.av'), meAj = document.getElementById('b-ajustes');
  me.textContent = '';
  me.insertAdjacentHTML('beforeend', `<div class="cu-fila"></div><div class="cu-ctl"><button type="button" class="cu-est" id="cu-est" aria-haspopup="listbox" aria-expanded="false" aria-controls="cu-menu"><span id="me-e"></span>${svg(`<path d="${P_ABAJO}"/>`)}</button></div>`);
  me.querySelector('.cu-fila').append(meAv);
  me.querySelector('.cu-fila').insertAdjacentHTML('beforeend', '<span class="cu-nom" id="me-n"></span>');
  me.querySelector('.cu-ctl').append(meAj);
  const cuBtn = document.getElementById('cu-est');
  // El menú va dentro de la barra (el foco del cajón no sale de ahí) pero fijo en la pantalla: la barra no lo recorta.
  const cuMenu = document.createElement('div');
  cuMenu.className = 'cu-menu'; cuMenu.id = 'cu-menu'; cuMenu.hidden = true;
  cuMenu.setAttribute('role', 'listbox'); cuMenu.setAttribute('aria-label', 'Tu estado');
  nav.append(cuMenu);

  const ESTADOS = [['En línea', 'Te llegan conversaciones nuevas'], ['Ocupada', 'No te llegan nuevas por ahora'], ['Ausente', 'Las nuevas pasan a otra persona']];
  const cuAbierto = () => !cuMenu.hidden;
  function cuOpciones(){
    cuMenu.innerHTML = ESTADOS.map(([n, d]) => {
      const sel = AJ.estado === n;
      return `<button type="button" class="cu-op" role="option" tabindex="-1" aria-selected="${sel}" data-cu-est="${esc(n)}"><i style="background:${EST_COL[n]}"></i><span><b>${esc(n)}</b><small>${esc(d)}</small></span>${sel ? svg('<path d="M5 12l5 5 9-10"/>') : ''}</button>`;
    }).join('');
  }
  // Hacia arriba, 10 px sobre el botón y alineado con la cuenta; si arriba no cabe, hacia abajo.
  function cuPosicion(){
    const r = cuBtn.getBoundingClientRect(), H = document.documentElement.clientHeight, W = document.documentElement.clientWidth;
    cuMenu.style.left = Math.max(8, Math.min(r.left - 4, W - cuMenu.offsetWidth - 8)) + 'px';
    cuMenu.style.top = ''; cuMenu.style.bottom = (H - r.top + 10) + 'px';
    if (cuMenu.getBoundingClientRect().top < 8) { cuMenu.style.bottom = ''; cuMenu.style.top = (r.bottom + 10) + 'px'; }
  }
  const cuFlecha = () => cuBtn.querySelector('path').setAttribute('d', cuAbierto() ? P_ARRIBA : P_ABAJO);
  function cuAbrir(teclado){
    if (cuAbierto()) return;
    // Un solo menú abierto a la vez. Con un toque, los demás del CRM se cierran solos con el mismo clic, que les llega
    // de afuera; con las flechas no hay clic, así que se les manda uno en blanco (cada menú se cierra con un clic fuera
    // de él), y los desplegables .menu que queden se esconden.
    if (teclado) document.body.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true}));
    document.querySelectorAll('.menu:not([hidden])').forEach(m => { m.hidden = true; });
    cuOpciones(); cuMenu.hidden = false; cuPosicion();
    cuBtn.setAttribute('aria-expanded', 'true'); cuFlecha();
    (cuMenu.querySelector('[aria-selected="true"]') || cuMenu.querySelector('.cu-op')).focus();
  }
  function cuCerrar(foco){
    if (!cuAbierto()) return;
    cuMenu.hidden = true; cuBtn.setAttribute('aria-expanded', 'false'); cuFlecha();
    if (foco) cuBtn.focus();
  }
  cuBtn.addEventListener('click', () => { if (cuAbierto()) cuCerrar(true); else cuAbrir(); });
  cuBtn.addEventListener('keydown', e => { if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !cuAbierto()) { e.preventDefault(); cuAbrir(true); } });
  cuMenu.addEventListener('keydown', e => {
    const ops = [...cuMenu.querySelectorAll('.cu-op')], i = ops.indexOf(document.activeElement);
    const j = e.key === 'ArrowDown' ? Math.min(ops.length - 1, i + 1) : e.key === 'ArrowUp' ? Math.max(0, i - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? ops.length - 1 : null;
    if (j != null) { e.preventDefault(); ops[j].focus(); }
  });
  // Elegir hace lo mismo que Mis ajustes › Mi disponibilidad (ponerEstado, 10-nucleo.js), y se guarda igual.
  cuMenu.addEventListener('click', e => { const b = e.target.closest('[data-cu-est]'); if (!b) return; cuCerrar(true); ponerEstado(b.dataset.cuEst); });
  // Se cierra tocando afuera (antes que cualquier otro menú se abra con ese mismo toque).
  document.addEventListener('click', e => { if (cuAbierto() && !cuMenu.contains(e.target) && !cuBtn.contains(e.target)) cuCerrar(false); }, true);
  window.addEventListener('resize', () => { if (cuAbierto()) cuPosicion(); });
  document.addEventListener('scroll', () => { if (cuAbierto()) cuPosicion(); }, true);

  // El estado que llega de otra sesión o de Mis ajustes también se ve aquí (y en el menú, si está abierto).
  const pintarYoSinCuenta = pintarYo;
  pintarYo = function(){
    pintarYoSinCuenta();
    cuBtn.setAttribute('aria-label', `Tu estado: ${AJ.estado}`);
    if (!cuAbierto()) return;
    const f = cuMenu.contains(document.activeElement) ? document.activeElement.dataset.cuEst : null;
    cuOpciones();
    if (f) { const x = cuMenu.querySelector(`[data-cu-est="${CSS.escape(f)}"]`); if (x) x.focus(); }
  };

  /* ── 3 · Teclado: Escape cierra el menú del estado y luego el cajón; Tab no sale del cajón; los atajos de la bandeja no
     actúan detrás del cajón. ── */
  document.addEventListener('keydown', e => {
    if (cuAbierto()) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cuCerrar(true); return; }
      if (e.key === 'Tab' && cuMenu.contains(document.activeElement)) cuCerrar(true);   // el Tab sigue desde el botón del estado
    }
    if (!abierto) return;
    if (e.key === 'Escape') { if (document.querySelector('.ov:not([hidden])')) return; e.preventDefault(); e.stopPropagation(); cerrar(); return; }
    if (e.key === 'Tab') {
      const f = enfocables(), i = f.indexOf(document.activeElement);
      if (f.length && (e.shiftKey ? i <= 0 : i < 0 || i === f.length - 1)) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); }
      return;
    }
    if (e.altKey || e.ctrlKey || e.metaKey) e.stopPropagation();
  }, true);
})();
