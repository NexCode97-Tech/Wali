/* ── Mi bandeja con su desplegable y el asistente en el menú (maqueta aprobada, versión 316, 12-nov):
   · «Mi bandeja» se despliega (como antes «Conversaciones») con Menciones y Finalizadas. Salen del menú «Conversaciones» y
     «Sin asignar»: las pestañas Mías, Sin asignar y Todas siguen en la lista, que se llama Mi bandeja. Envuelve nav()
     después de 66-finalizadas (que pone Finalizadas) y de 75-respondidas.
   · En tablet y celular el asistente va en el menú lateral, encima de la cuenta, y sale el globo flotante (tapaba Enviar).
     Usa el mismo robot y el mismo clic del globo de 89-ayuda. ── */
(() => {
  st.mbAbierto = st.mbAbierto !== false;
  const navAntes = nav;
  nav = function(){
    // Menciones y Finalizadas se pintan solo con «Conversaciones» abierto: se pintan siempre y aquí se deciden.
    const g = st.convAbierto; st.convAbierto = true;
    try { navAntes.apply(this, arguments); } finally { st.convAbierto = g; }
    const ul = document.getElementById('principal'); if (!ul) return;
    const li = k => { const b = ul.querySelector(`[data-nav="${k}"]`); return b ? b.closest('li') : null; };
    const bandeja = li('inbox'); if (!bandeja) return;
    for (const k of ['todas', 'sin']) { const x = li(k); if (x) x.remove(); }
    const b = bandeja.querySelector('button');
    b.setAttribute('aria-expanded', String(st.mbAbierto));
    if (!b.querySelector('.tw')) b.insertAdjacentHTML('beforeend', I('chev', 'i tw'));
    b.setAttribute('aria-current', String(!st.pagina && !st.menciones && !st.finVista && !st.carpeta && !st.equipo && !st.etq && !st.canal && !st.tag && !st.linea));
    let tras = bandeja;
    for (const k of ['menciones', 'finalizadas']) {
      const x = li(k); if (!x) continue;
      if (!st.mbAbierto) { x.remove(); continue; }
      x.className = 'sub mb-sub'; tras.after(x); tras = x;
    }
  };
  // El título de la lista: con «Conversaciones» y «Sin asignar» dentro de Mi bandeja, la lista se llama Mi bandeja.
  const renderAntes = render;
  render = function(){
    const r = renderAntes.apply(this, arguments);
    const lt = document.getElementById('lt');
    if (lt && !st.menciones && !st.finVista && /^(Conversaciones|Sin asignar)$/.test(lt.textContent)) lt.textContent = 'Mi bandeja';
    return r;
  };
  document.getElementById('principal').addEventListener('click', e => {
    const b = e.target.closest('[data-nav="inbox"]'); if (!b) return;
    // La flecha abre y cierra; el nombre lleva a la bandeja y la despliega.
    if (e.target.closest('.tw')) { e.stopPropagation(); st.mbAbierto = !st.mbAbierto; nav(); return; }
    st.mbAbierto = true;
  }, true);

  // El asistente en el menú lateral (solo con 1000 px o menos; el CSS lo esconde en escritorio).
  function ponerAyNav(){
    const barra = document.querySelector('#app > .nav'), fab = document.getElementById('ay-fab'), me = barra && barra.querySelector(':scope > .me');
    if (!barra || !fab || !me) return;
    let b = barra.querySelector(':scope > .nav-ay');
    if (!b) { b = document.createElement('button'); b.type = 'button'; b.className = 'nav-ay'; b.setAttribute('aria-label', 'Abrir el asistente de Wali'); me.before(b); }
    const astro = fab.querySelector('.ay-astro'), n = fab.querySelector('.ay-fab-n');
    const firma = (astro ? 1 : 0) + '|' + (n ? n.textContent : '');
    if (b.dataset.f === firma) return;
    b.dataset.f = firma; b.replaceChildren();
    const av = document.createElement('span'); av.className = 'nav-ay-av'; if (astro) av.append(astro.cloneNode(true)); b.append(av);
    b.insertAdjacentHTML('beforeend', `<span class="nav-ay-tx"><b>Asistente de Wali</b><small>Pregúntale cómo usar el CRM</small></span>${n ? `<span class="nav-ay-n">${esc(n.textContent)}</span>` : ''}`);
  }
  setInterval(ponerAyNav, 1000); ponerAyNav();
  document.addEventListener('click', e => {
    if (!e.target.closest('.nav-ay')) return;
    const x = document.querySelector('.cj-cerrar'); if (x && document.getElementById('app').classList.contains('cj-abierto')) x.click();
    const fab = document.getElementById('ay-fab'); if (fab) fab.click();
  });

  document.head.insertAdjacentHTML('beforeend', `<style>
#principal li.sub.mb-sub{animation:mb-sub .32s cubic-bezier(.32,.72,0,1) both}
#principal li.sub.mb-sub + li.sub.mb-sub{animation-delay:.04s}
@keyframes mb-sub{from{opacity:0;transform:translateY(-4px)}}
.nav-ay{display:none}
@media (max-width:1000px){
  .ay-fab{display:none!important}
  .ay{bottom:16px!important;height:min(620px,calc(100dvh - 32px))!important}
  .nav-ay{display:flex;align-items:center;gap:12px;flex:none;width:100%;padding:10px 12px;border:1px solid rgba(255,210,31,.35);border-radius:12px;background:rgba(255,210,31,.08);color:inherit;font:inherit;text-align:left;cursor:pointer;transition:background .16s,transform .14s cubic-bezier(.23,1,.32,1)}
  .nav-ay:hover{background:rgba(255,210,31,.14)}.nav-ay:active{transform:scale(.98)}
  .nav-ay-av{position:relative;width:38px;height:38px;border-radius:50%;background:#FFD21F;display:grid;place-items:center;flex:none;overflow:hidden}
  .nav-ay-av svg{width:34px;height:34px;margin-top:4px}
  .nav-ay-tx{flex:1;min-width:0}.nav-ay b{display:block;font-size:13.5px;font-weight:600}.nav-ay small{display:block;font-size:12px;opacity:.7}
  .nav-ay-n{min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:#dc2626;color:#fff;font-size:11px;font-weight:700;display:grid;place-items:center}
}
@media (prefers-reduced-motion:reduce){#principal li.sub.mb-sub{animation:none}.nav-ay{transition:none}}
</style>`);
})();
