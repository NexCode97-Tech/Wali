/* ── Barra lateral plegable del CRM (maqueta «Barra del CRM plegable», opción B aprobada el 11-nov) ──
   El botón, la animación, el globito con el nombre y el recuerdo vienen de compartido/bandeja.js (lo mismo que la barra
   del superadmin). Aquí solo se le ponen las clases wb-* a la barra del CRM y se acomoda la franja de 76 px:
   logo, botón para abrirla (siempre visible), campana, espacio de trabajo, Primeros pasos como anillo, los módulos con
   su contador en amarillo, las secciones como íconos y puntos separados por líneas finas, y la foto con su estado.
   Solo en computador (> 1000 px): en tablet y celular la barra sigue en el menú. ── */
(() => {
  const app = document.getElementById('app'), nav = app && app.querySelector('.nav');
  if (!nav || !window.WB) return;
  nav.classList.add('wb-barra');
  const IOS = 'cubic-bezier(.32,.72,0,1)';
  document.head.insertAdjacentHTML('beforeend', `<style>
#app.app::before{transition:left 380ms ${IOS}}
#app.wb-anima > .nav{transition:padding 380ms ${IOS}}
.nav-anillo{display:none}
/* Con el botón nuevo en la fila del logo, «wali» no se parte ni se encoge */
#app .nav .brand .w-logo{flex:none}#app .nav .brand .w-txt{white-space:nowrap}
@media (min-width:1001px){
  #app.app.nav-plegada{grid-template-columns:76px calc(var(--wb-lista,357px) + 23px) minmax(0,1fr) calc(var(--wb-ficha,297px) + 23px);--navw:76px}
  #app.app.nav-plegada.panel-min{grid-template-columns:76px calc(var(--wb-lista,357px) + 23px) minmax(0,1fr) 0}
  #app .nav.wb-plegada{padding:16px 10px;gap:12px;overflow-x:hidden}
  #app .nav.wb-plegada .wb-txt{position:absolute}
  /* Logo arriba, debajo el botón para abrirla y la campana */
  #app .nav.wb-plegada .brand{padding-left:7px}
  #app .nav.wb-plegada .wb-plegar{order:1}#app .nav.wb-plegada .mc-campana{order:2;margin-left:0}
  /* Espacio de trabajo: solo su foto */
  #app .nav.wb-plegada .me-sw{padding:6px 0 6px 13px;background:transparent;border-color:transparent}
  /* Primeros pasos: el anillo con el avance */
  #app .nav.wb-plegada .pp-sb{padding:4px 0 4px 11px;background:transparent;border-color:transparent}
  #app .nav.wb-plegada .nav-anillo{display:grid}
  /* Módulos y secciones: el ícono centrado; el contador de los módulos en amarillo sobre el ícono */
  #app .nav.wb-plegada li button{padding:8px 0 8px 19px;gap:0}
  #app .nav.wb-plegada li button .tw{display:none}
  #app .nav.wb-plegada li button .n{position:absolute;opacity:0}
  #app .nav.wb-plegada #principal li button .n:not(:empty){opacity:1;top:2px;left:33px;min-width:16px;height:16px;border-radius:8px;background:#FFD21F;color:#0b0b10;font-size:10px;font-weight:700;display:grid;place-items:center;padding:0 4px;line-height:normal;box-sizing:border-box;margin:0}
  #app .nav.wb-plegada .sec{display:none}
  #app .nav.wb-plegada div:has(> .sec){border-top:1px solid var(--nx-negro-3,#22222b);padding-top:8px}
  /* Tu tarjeta: solo la foto, con el punto de su estado */
  #app .nav.wb-plegada .me{padding:10px 0 4px 11px}
  #app .nav.wb-plegada .me .av{position:relative}
  #app .nav.wb-plegada .me .av::after{content:"";position:absolute;right:-1px;bottom:-1px;width:10px;height:10px;border-radius:50%;background:var(--nav-est,#22c55e);border:2px solid var(--nx-negro,#0b0b10)}
}
@media (prefers-reduced-motion:reduce){#app.app::before,#app.wb-anima > .nav{transition:none}}
</style>`);

  const marca = nav.querySelector('.brand');
  if (marca) {
    marca.classList.add('wb-marca');
    const iso = marca.querySelector('.w-logo svg'); if (iso) iso.classList.add('wb-logo');
    const tx = marca.querySelector('.w-txt'); if (tx) tx.classList.add('wb-txt');
    marca.insertAdjacentHTML('beforeend', WB.botonPlegar('id="nav-plegar"'));
  }

  // Cada texto suelto de la barra va en un <span class="wb-txt"> (se apaga al plegar) y su botón lleva el nombre para el
  // globito. La barra se vuelve a dibujar sola (nav(), espacios, primeros pasos), así que se repasa con cada cambio.
  const envolver = () => {
    nav.querySelectorAll('li > button').forEach(b => {
      let t = '';
      [...b.childNodes].forEach(n => {
        if (n.nodeType !== 3 || !n.textContent.trim()) return;
        const s = document.createElement('span'); s.className = 'wb-txt'; s.textContent = n.textContent; t += n.textContent.trim(); n.replaceWith(s);
      });
      if (!t) t = [...b.querySelectorAll(':scope > .wb-txt')].map(x => x.textContent.trim()).join(' ');
      if (t && b.getAttribute('data-wb-t') !== t) b.setAttribute('data-wb-t', t);
    });
    const sw = nav.querySelector('.me-sw');
    if (sw) {
      const tx = sw.querySelector('.me-tx'); if (tx && !tx.classList.contains('wb-txt')) tx.classList.add('wb-txt');
      const fl = sw.querySelector(':scope > svg'); if (fl && !fl.classList.contains('wb-txt')) fl.classList.add('wb-txt');
      const n = sw.querySelector('.me-tx b'); if (n && sw.getAttribute('data-wb-t') !== n.textContent) sw.setAttribute('data-wb-t', n.textContent);
    }
    const pp = nav.querySelector('#pp-barra .pp-sb');
    if (pp && !pp.querySelector('.nav-anillo')) {
      pp.querySelectorAll(':scope > span, :scope > small').forEach(x => x.classList.add('wb-txt'));
      const ancho = parseFloat(((pp.querySelector('.pp-bar i') || {}).style || {}).width) || 0;
      const cuenta = (pp.querySelector('.pp-sbh span') || {}).textContent || '';
      const L = 2 * Math.PI * 15;
      pp.insertAdjacentHTML('afterbegin', `<span class="nav-anillo" aria-hidden="true" style="position:relative;width:34px;height:34px;place-items:center;flex:none"><svg viewBox="0 0 36 36" style="position:absolute;inset:0;width:34px;height:34px;transform:rotate(-90deg)"><circle cx="18" cy="18" r="15" fill="none" stroke="#3b3112" stroke-width="3.5"/><circle cx="18" cy="18" r="15" fill="none" stroke="#FFD21F" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="${L.toFixed(1)}" stroke-dashoffset="${(L * (1 - ancho / 100)).toFixed(1)}"/></svg><b style="position:relative;font-size:11px;color:#FFD21F;line-height:normal">${esc(cuenta.split(' ')[0] || '')}</b></span>`);
      pp.setAttribute('data-wb-t', 'Primeros pasos · ' + cuenta);
    }
    const me = nav.querySelector('.me');
    if (me) {
      me.querySelectorAll('.cu-nom, .cu-fila > svg, .cu-ctl').forEach(x => x.classList.add('wb-txt'));
      const fila = me.querySelector('.cu-fila'), nom = me.querySelector('.cu-nom'), est = me.querySelector('#me-e');
      if (fila && nom) { const t = nom.textContent + (est && est.textContent.trim() ? ' · ' + est.textContent.trim() : ''); if (fila.getAttribute('data-wb-t') !== t) fila.setAttribute('data-wb-t', t); }
      const dot = me.querySelector('.est-dot'); if (dot && fila) fila.style.setProperty('--nav-est', getComputedStyle(dot).backgroundColor);
    }
  };
  let pendiente = false;
  new MutationObserver(() => { if (pendiente) return; pendiente = true; requestAnimationFrame(() => { pendiente = false; envolver(); }); })
    .observe(nav, {childList: true, subtree: true, characterData: true});
  envolver();

  const plegar = (v, recordar = true) => {
    if (recordar) WB.animar(app);
    app.classList.toggle('nav-plegada', v);
    WB.plegarBarra(nav, v, recordar);
  };
  nav.addEventListener('click', e => { if (e.target.closest('#nav-plegar')) plegar(!nav.classList.contains('wb-plegada')); });
  if (WB.barraPlegada()) plegar(true, false);
})();
