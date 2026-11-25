/* ── Motion en toda la plataforma (pedido del 24-nov: «cualquier botón debe tener motion, debe ser totalmente
   dinámica, nada simple») ──
   Una sola capa, sin tocar cada pantalla:
   1. Todo botón responde al tocarlo: se hunde (escala .97, 120 ms) y vuelve con un resorte corto. Las tarjetas
      tocables (opciones, filas de elección) se levantan un poco al pasar el cursor.
   2. Las ventanas (#ov-x, #ov y cualquier .ov) entran subiendo desde abajo con el fondo que se oscurece, y salen
      bajando más rápido. La salida se ve aunque el código las cierre de golpe con `hidden = true`.
   3. Dentro de una ventana, cuando cambia de pantalla (otro título o pasa de paso), la ventana cambia de alto con
      suavidad y lo nuevo entra deslizándose. Los pasos: el número que se completa se vuelve chulito con un pop y la
      línea se llena.
   4. Los menús y desplegables flotantes se abren desde su borde con escala .96 → 1.
   5. Al cambiar de página, el contenido entra subiendo y las filas de las listas en cascada (máx. 10, 30 ms).
   6. El aviso de abajo (toast) entra con resorte.
   Solo transform y opacity (y el alto de la ventana cuando cambia de pantalla). Con movimiento reducido todo queda
   como fundido corto, sin desplazamientos. */
(() => {
  if (typeof document === 'undefined' || typeof Element.prototype.animate !== 'function') return;
  const reducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SALE = 'cubic-bezier(.23,1,.32,1)', ENTRA = 'cubic-bezier(.16,1,.3,1)', CAE = 'cubic-bezier(.4,0,1,1)', RESORTE = 'cubic-bezier(.34,1.56,.64,1)';

  /* 1 · Presión de botones y tarjetas (CSS: `scale` no choca con los `transform` que ya tienen algunos botones). */
  const css = document.createElement('style');
  css.id = 'motion-global';
  css.textContent = `
:where(button,.btn,[role="button"],a.btn,summary,label.sw,.chip){transition:scale .22s ${RESORTE},background-color .15s ease-out,border-color .15s ease-out,color .15s ease-out,box-shadow .2s ease-out}
:where(button,.btn,[role="button"],a.btn,summary,.chip):not(:disabled):active{scale:.97;transition:scale .12s ${SALE},background-color .1s,border-color .1s,color .1s,box-shadow .1s}
:where(.opc,.cx-op,.ll-sec[data-ir],.flujo,.it):not(:disabled){transition:scale .22s ${RESORTE},translate .2s ${SALE},border-color .15s,box-shadow .2s,background-color .15s}
@media (hover:hover) and (pointer:fine){:where(.opc,.cx-op):not(:disabled):hover{translate:0 -1px}}
:where(.opc,.cx-op):not(:disabled):active{scale:.985;translate:0 0}
.opc .marca{transition:scale .3s ${RESORTE}}
@media (hover:hover) and (pointer:fine){.opc:not(:disabled):hover .marca{scale:1.06}}
.opc.mt-espera .marca{position:relative}
.opc.mt-espera .marca::after{content:"";position:absolute;inset:-4px;border-radius:inherit;border:2px solid #FFD21F;opacity:0;animation:mt-pulso 1.6s ${SALE} infinite}
@keyframes mt-pulso{0%{opacity:.9;scale:.92}100%{opacity:0;scale:1.18}}
.opc small.mt-esp{display:flex;align-items:center;gap:7px;color:var(--ink2)}
.opc small.mt-esp i{width:12px;height:12px;border-radius:50%;border:2px solid var(--line);border-top-color:var(--ink2);animation:mt-gira .8s linear infinite;flex:none}
@keyframes mt-gira{to{rotate:360deg}}
#toast.on{animation:mt-toast .36s ${ENTRA}}
@keyframes mt-toast{from{opacity:0;translate:0 14px;scale:.96}}
@media (prefers-reduced-motion: reduce){
  :where(button,.btn,[role="button"],a.btn,summary,.chip,.opc,.cx-op):active{scale:none!important}
  @media (hover:hover){:where(.opc,.cx-op):hover{translate:none!important}}
  .opc.mt-espera .marca::after,.opc small.mt-esp i{animation-duration:3s}
  #toast.on{animation:mt-fade .2s ease-out}
  @keyframes mt-fade{from{opacity:0}}
}`;
  document.head.appendChild(css);

  /* 2 · Ventanas: entrada y salida. Se reemplaza `hidden` solo en cada .ov: el código que lee `hidden` sigue viendo
     el valor nuevo al instante; lo que tarda es lo que se ve. */
  const nativo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'hidden');
  const cajaDe = ov => ov.querySelector(':scope > .dlg, :scope > .hoja, :scope > *');
  function entrar(ov){
    const caja = cajaDe(ov);
    if (reducido()) { ov.animate([{opacity:0}, {opacity:1}], {duration:160, easing:'ease-out'}); return; }
    ov.animate([{opacity:0}, {opacity:1}], {duration:220, easing:'ease-out'});
    if (caja) {
      caja.animate([{opacity:0, transform:'translateY(18px) scale(.97)'}, {opacity:1, transform:'none'}], {duration:340, easing:ENTRA});
      escalonar(caja.querySelectorAll(':scope > .dlg-cab, :scope > .pasos2, :scope > p, :scope > .cx-list > *, :scope > .ft2'), 70, 35, 8);
    }
    ov._mtFirma = firma(ov);
    requestAnimationFrame(() => anotarAlto(ov));
  }
  function salir(ov, fin){
    const caja = cajaDe(ov);
    ov.style.pointerEvents = 'none';
    const dur = reducido() ? 140 : 200;
    const a = ov.animate([{opacity:1}, {opacity:0}], {duration:dur, easing:CAE, fill:'forwards'});
    if (caja && !reducido()) caja.animate([{opacity:1, transform:'none'}, {opacity:0, transform:'translateY(12px) scale(.98)'}], {duration:dur, easing:CAE, fill:'forwards'});
    ov._mtSalida = a;
    a.onfinish = () => { ov._mtSalida = null; ov.style.pointerEvents = ''; ov.getAnimations({subtree:true}).forEach(x => x.cancel()); fin(); };
  }
  function vigilarOv(ov){
    if (ov._mtListo) return; ov._mtListo = true;
    let quiere = nativo.get.call(ov);
    Object.defineProperty(ov, 'hidden', {
      configurable: true,
      get(){ return quiere; },
      set(v){
        v = !!v; if (v === quiere) return; quiere = v;
        if (ov._mtSalida) { ov._mtSalida.onfinish = null; ov._mtSalida.cancel(); ov._mtSalida = null; ov.style.pointerEvents = ''; ov.getAnimations({subtree:true}).forEach(x => x.cancel()); }
        if (v) salir(ov, () => { if (quiere) nativo.set.call(ov, true); });
        else { nativo.set.call(ov, false); entrar(ov); }
      },
    });
  }
  document.querySelectorAll('.ov').forEach(vigilarOv);

  /* 3 · Cambio de pantalla dentro de una ventana abierta: el alto viaja y lo nuevo entra deslizándose. */
  const firma = ov => { const c = cajaDe(ov); if (!c) return ''; const h = c.querySelector('.dlg-cab h3, h3, h2'); const p = c.querySelector('.pasos2 [aria-current]'); const m = c.querySelector('.cx-f'); return [h && h.textContent, p && p.textContent, !!m].join('|'); };
  // El alto de cada ventana se anota después de cada cambio: así el siguiente cambio sabe de qué alto parte.
  const altoAntes = new WeakMap();
  const anotarAlto = ov => { const c = cajaDe(ov); if (c) altoAntes.set(ov, c.getBoundingClientRect().height); };
  const pasosAntes = new WeakMap();
  const obsDlg = new MutationObserver(regs => {
    const vistas = new Set();
    for (const r of regs) { const ov = r.target.closest && r.target.closest('.ov'); if (ov && !nativo.get.call(ov) && !ov._mtSalida) vistas.add(ov); }
    vistas.forEach(ov => {
      const f = firma(ov), caja = cajaDe(ov); if (!caja) return;
      if (ov._mtFirma === f) return;
      const antes = ov._mtFirma; ov._mtFirma = f;
      if (antes == null || reducido()) { if (antes != null) caja.animate([{opacity:.4}, {opacity:1}], {duration:160}); return; }
      const h0 = altoAntes.get(ov), h1 = caja.getBoundingClientRect().height;
      if (h0 && Math.abs(h0 - h1) > 2) caja.animate([{height:h0 + 'px', overflow:'hidden'}, {height:h1 + 'px', overflow:'hidden'}], {duration:300, easing:SALE}).onfinish = () => anotarAlto(ov);
      const hijos = [...caja.children].filter(e => !e.classList.contains('dlg-cerrar') && !e.classList.contains('pasos2'));
      escalonar(hijos, 0, 30, 6, 'translateX(14px)');
      animarPasos(caja, pasosAntes.get(caja));
    });
    document.querySelectorAll('.ov .pasos2').forEach(p => { const c = p.closest('.dlg'); if (c) pasosAntes.set(c, p.querySelectorAll('.hecho').length); });
    vistas.forEach(ov => requestAnimationFrame(() => { const c = cajaDe(ov); if (c && !c.getAnimations().some(x => x.effect && x.effect.getKeyframes().some(k => k.height))) anotarAlto(ov); }));
  });
  function animarPasos(caja, hechosAntes){
    const p = caja.querySelector('.pasos2'); if (!p) return;
    const hechos = p.querySelectorAll(':scope > .hecho');
    if (hechosAntes == null || hechos.length <= hechosAntes) return;
    [...hechos].slice(hechosAntes).forEach((d, i) => {
      const ic = d.querySelector('i');
      if (ic) ic.animate([{transform:'scale(.6)'}, {transform:'scale(1.12)', offset:.6}, {transform:'scale(1)'}], {duration:380, delay:i * 60, easing:SALE});
      const sv = ic && ic.querySelector('svg'); if (sv) sv.animate([{clipPath:'inset(0 100% 0 0)'}, {clipPath:'inset(0 0 0 0)'}], {duration:260, delay:120 + i * 60, easing:SALE, fill:'backwards'});
    });
    const on = p.querySelector(':scope > .on, :scope > div:last-child.hecho');
    if (on) on.animate([{opacity:.4}, {opacity:1}], {duration:240, delay:140});
  }
  document.querySelectorAll('.ov').forEach(ov => obsDlg.observe(ov, {childList:true, subtree:true, characterData:true}));

  /* 4 · Menús y desplegables flotantes. */
  const MENU = '.menu.dd-flota, .tp-menu, .dd-lista, [role="menu"], [role="listbox"]';
  const abrirMenu = el => {
    if (el._mtVisto || el.hidden || el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return;
    el._mtVisto = true; setTimeout(() => { el._mtVisto = false; }, 400);
    if (reducido()) { el.animate([{opacity:0}, {opacity:1}], {duration:120}); return; }
    const arriba = el.getBoundingClientRect().top < (el._mtAncla || 0);
    el.animate([{opacity:0, transform:`translateY(${arriba ? 6 : -6}px) scale(.96)`}, {opacity:1, transform:'none'}], {duration:190, easing:SALE});
    escalonar(el.querySelectorAll(':scope > button, :scope > a, :scope > [role="option"]'), 30, 18, 8, 'translateY(-4px)');
  };
  new MutationObserver(regs => {
    for (const r of regs) {
      if (r.type === 'attributes') { if (r.target.matches && r.target.matches(MENU) && !r.target.hidden) abrirMenu(r.target); continue; }
      r.addedNodes.forEach(n => { if (n.nodeType !== 1) return; if (n.matches(MENU)) abrirMenu(n); else n.querySelectorAll && n.querySelectorAll(MENU).forEach(abrirMenu); if (n.classList && n.classList.contains('ov')) { vigilarOv(n); obsDlg.observe(n, {childList:true, subtree:true, characterData:true}); } });
    }
  }).observe(document.body, {childList:true, subtree:true, attributes:true, attributeFilter:['hidden']});

  /* 5 · Cambio de página: el contenido sube y las filas entran en cascada. */
  function escalonar(lista, base, paso, max, desde = 'translateY(8px)'){
    if (reducido()) return;
    [...lista].slice(0, max).forEach((el, i) => el.animate([{opacity:0, transform:desde}, {opacity:1, transform:'none'}], {duration:300, delay:base + i * paso, easing:SALE, fill:'backwards'}));
  }
  const FILAS = '.cn-grid > *, .ll-sec, .cx-list > *, .items > .it, .flujo, .cfg-g > *, .lista > *, .tbl tbody tr, .cards > *, .ajw > .grupo > *';
  if (typeof render === 'function') {
    const renderSin = render;
    let pagAntes = null;
    render = function(...a){
      const r = renderSin.apply(this, a);
      // La página cambia si cambia la sección, si se abre un flujo o si se elige otra pestaña de la página.
      const tab = document.querySelector('#page [role="tab"][aria-selected="true"], #page .seg [aria-pressed="true"]');
      const pag = typeof st === 'object' ? [st.pagina, st.flujo ? 'f' : '', tab ? tab.textContent.trim() : ''].join('|') : null;
      if (pag !== pagAntes) {
        const cambio = pagAntes !== null, soloTab = cambio && pag.split('|').slice(0, 2).join('|') === pagAntes.split('|').slice(0, 2).join('|'); pagAntes = pag;
        const page = document.getElementById('page');
        if (cambio && page && page.firstElementChild) {
          if (reducido()) page.firstElementChild.animate([{opacity:.3}, {opacity:1}], {duration:160});
          else if (soloTab) escalonar(page.querySelectorAll(FILAS), 0, 30, 10);
          else { page.firstElementChild.animate([{opacity:0, transform:'translateY(10px)'}, {opacity:1, transform:'none'}], {duration:320, easing:ENTRA}); escalonar(page.querySelectorAll(FILAS), 60, 30, 10); }
        }
      }
      return r;
    };
  }
})();
