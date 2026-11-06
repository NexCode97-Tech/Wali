/* ── Bandeja › selección múltiple (maqueta «Selección múltiple en la bandeja», opción B aprobada el 6-nov) ──
   «Seleccionar varias» junto a Filtrar y Ordenar (en el celular también dejando presionada una conversación). Cada foto
   se vuelve casilla; la cabecera de la lista se vuelve barra negra con: quitar (X roja), elegir todas, cuántas, y
   Transferir, Etapa, Etiqueta, Finalizar y Más (leídas, Favoritos, calientes, silenciar, exportar, spam).
   Cada acción hace a cada conversación lo mismo que su botón de siempre (cambia la conversación y crmSincronizar la
   guarda con su PATCH; spam y exportar usan sus rutas de una), así que los permisos y reglas son los mismos. ── */
(() => {
  const SL = {modo: false, sel: new Set(), menu: '', spamSeguro: false, presion: null, tragarClic: false};
  window.crmSeleccion = SL;
  const movil = () => window.matchMedia('(max-width: 760px)').matches;
  const lectura = () => typeof crmSoloLectura === 'function' && crmSoloLectura();
  const ICS = {
    sel: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><path d="m14.5 17 2 2 3.5-4"/></svg>',
    chk: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5.5 12.5 4.2 4.2 8.8-9.4"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    trans: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l5 5-5 5"/><path d="M20 10H9a5 5 0 0 0-5 5v4"/></svg>',
    etapa: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4" width="4.5" height="16" rx="1.5"/><rect x="9.75" y="4" width="4.5" height="11" rx="1.5"/><rect x="16" y="4" width="4.5" height="7" rx="1.5"/></svg>',
    tag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 12.2V4.5a1 1 0 0 1 1-1h7.7l8.3 8.3a1.4 1.4 0 0 1 0 2l-6.2 6.2a1.4 1.4 0 0 1-2 0z"/><circle cx="8" cy="8" r="1.4"/></svg>',
    fin: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="m8.3 12.3 2.6 2.6 4.9-5.4"/></svg>',
    mas: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5.5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18.5" cy="12" r="1.6"/></svg>',
    leida: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 12.5 4 4 7.5-8"/><path d="m11.5 16 1 1 7.5-8"/></svg>',
    fav: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.8 2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8z"/></svg>',
    fuego: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c1 3 4.5 4.8 4.5 9a4.5 4.5 0 0 1-9 0c0-1.7.7-3 1.8-4 .2 1.6 1 2.5 2.2 2.8C11 8.2 11 5.6 12 3Z"/></svg>',
    mute: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8a6 6 0 0 1 9.5-4.9M18 11v2c0 2.5 2 4 2 4H6"/><path d="M3 3l18 18"/></svg>',
    exp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
    spam: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 5 6v6c0 4 3 7 7 9 4-2 7-5 7-9V6z"/><path d="M9.5 9.5l5 5M14.5 9.5l-5 5"/></svg>',
  };

  document.head.insertAdjacentHTML('beforeend', `<style>
/* Una curva (ease-out-quint) y tres duraciones; toda presión responde (regla «motion en botones»). */
.sm-selb{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;color:var(--ink3);transition:background .18s cubic-bezier(.22,1,.36,1),color .18s,transform .16s cubic-bezier(.22,1,.36,1)}
.sm-selb svg,.sm-cab svg,.sm-menu svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
.sm-selb:hover{background:var(--hover)}.sm-selb:active,.sm-cab button:active,.sm-menu button:active{transform:scale(.94)}
.sm-selb[aria-pressed="true"]{background:#0b0b10;color:#fff}
.it .tj-foto{position:relative}
.sm-chk{position:absolute;inset:0;border-radius:50%;display:grid;place-items:center;background:#fff;border:2px solid #c7ccd4;opacity:0;transform:scale(.55) rotate(-8deg);transition:opacity .22s cubic-bezier(.22,1,.36,1),transform .32s cubic-bezier(.22,1,.36,1),background .2s,border-color .2s,box-shadow .2s;pointer-events:none;z-index:2}
.sm-chk svg{width:62%;height:62%;fill:none;stroke:#0b0b10;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:24;stroke-dashoffset:24;transition:stroke-dashoffset .26s cubic-bezier(.22,1,.36,1) .05s}
.sm-modo .it .sm-chk{opacity:1;transform:none}
.sm-modo .it{cursor:pointer}
.it.sm-sel .sm-chk{background:#FFD21F;border-color:#FFD21F;box-shadow:0 0 0 4px #FFF6CC}
.it.sm-sel .sm-chk svg{stroke-dashoffset:0}
.it.sm-sel{background:#fffbea!important;box-shadow:inset 0 0 0 1.5px #f2d24c}
.it.sm-brillo{animation:sm-brillo .76s cubic-bezier(.22,1,.36,1)}
@keyframes sm-brillo{0%{background:#fffbea}35%{background:#ffe27a}100%{background:#fff}}
.it.sm-sale{animation:sm-sale .38s cubic-bezier(.22,1,.36,1) forwards;pointer-events:none}
@keyframes sm-sale{to{opacity:0;transform:translateX(-32px) scale(.98)}}
@media (max-width:760px){.it{-webkit-touch-callout:none;-webkit-user-select:none;user-select:none}}
/* La cabecera de la lista se vuelve la barra de acciones */
.list-h{position:relative}
.sm-cab{position:absolute;left:0;right:0;top:0;z-index:30;height:60px;display:flex;align-items:center;gap:4px;padding:0 10px 0 8px;background:#0b0b10;color:#fff;border-radius:14px 14px 0 0;animation:sm-baja .26s cubic-bezier(.22,1,.36,1) both}
@keyframes sm-baja{from{opacity:0;transform:translateY(-10px)}}
.sm-cab button{width:36px;height:36px;border-radius:9px;display:grid;place-items:center;color:#fff;transition:background .16s,transform .16s cubic-bezier(.22,1,.36,1)}
.sm-cab button:hover{background:#22222c}.sm-cab button:disabled{opacity:.4;cursor:default}
.sm-cab .sm-x{color:#ff6b6b}.sm-cab .sm-x:hover{background:#2a1416}
.sm-cab .sm-on{background:#fff;color:#0b0b10}.sm-cab .sm-on:hover{background:#fff}.sm-cab .sm-fin{color:#FFD21F}
.sm-cb{width:18px;height:18px;border-radius:5px;border:2px solid #6b6f7b;display:grid;place-items:center;transition:background .2s,border-color .2s}
.sm-cb svg{width:12px!important;height:12px!important;stroke:#0b0b10!important;stroke-width:3.4!important;opacity:0;transition:opacity .2s}
.sm-todas .sm-cb{background:#FFD21F;border-color:#FFD21F}.sm-todas .sm-cb svg{opacity:1}
.sm-n{font-size:13.5px;font-weight:600;white-space:nowrap}.sm-n span{display:inline-block;min-width:1ch;color:#FFD21F;font-variant-numeric:tabular-nums;animation:sm-pop .3s cubic-bezier(.22,1,.36,1)}
@keyframes sm-pop{from{transform:scale(1.5);opacity:.4}}
.sm-esp{flex:1}
/* Menús: bajan de la barra (en el celular suben como hoja, con velo) */
.sm-velo{position:fixed;inset:0;z-index:58;background:transparent}
.sm-menu{position:absolute;z-index:61;left:12px;top:66px;min-width:230px;max-width:290px;max-height:420px;overflow:auto;padding:6px;border-radius:14px;background:#fff;color:var(--ink);box-shadow:0 0 0 1px var(--line),0 24px 48px -18px rgba(0,0,0,.35);display:grid;gap:1px;transform-origin:0 0;animation:sm-abre .2s cubic-bezier(.22,1,.36,1) both}
@keyframes sm-abre{from{opacity:0;transform:translateY(-6px) scale(.96)}}
.sm-mh{margin:4px 10px 6px;font-size:11.5px;font-weight:600;color:var(--ink3);letter-spacing:.03em;text-transform:uppercase}
.sm-menu button{display:flex;align-items:center;gap:10px;min-height:40px;padding:0 10px;border-radius:9px;font-size:13.5px;color:var(--ink);text-align:left;transition:background .14s,transform .16s cubic-bezier(.22,1,.36,1)}
.sm-menu button:hover{background:var(--hover)}.sm-menu hr{border:0;border-top:1px solid var(--line);margin:4px 6px}
.sm-menu .sm-rojo{color:#dc2626}.sm-menu .sm-rojo.sm-seguro{background:#fee2e2;font-weight:600}
.sm-dot{width:10px;height:10px;border-radius:50%;flex:none}
.sm-av{width:26px;height:26px;border-radius:50%;flex:none;color:#fff}.sm-av svg{width:100%!important;height:100%!important;display:block;stroke:none!important}.sm-av text{fill:currentColor;font:600 15px Inter,system-ui,sans-serif}
@media (max-width:760px){
  .sm-cab{border-radius:0;height:56px}
  .sm-velo{z-index:2147483000;background:rgba(11,11,16,.45);animation:sm-velo .24s cubic-bezier(.22,1,.36,1) both}
  .sm-menu{position:fixed;z-index:2147483001;left:0;right:0;bottom:0;top:auto;min-width:0;max-width:none;max-height:70dvh;border-radius:22px 22px 0 0;padding:10px 12px calc(26px + env(safe-area-inset-bottom,0px));animation:sm-hoja .3s cubic-bezier(.22,1,.36,1) both}
  .sm-menu::before{content:"";justify-self:center;width:40px;height:5px;border-radius:3px;background:#d7dae0;margin:2px 0 8px}
  .sm-menu button{min-height:50px;font-size:15px}
}
@keyframes sm-velo{from{opacity:0}}@keyframes sm-hoja{from{transform:translateY(100%)}}
/* Entre cada chat: aire y una línea suave en el medio, sin la raya punteada pegada (maqueta aprobada el 6-nov) */
.it .tj-pie{border-top:0}
.items .it{overflow:visible;position:relative}
.items .it .tj-pie{border-radius:0 0 12px 12px}
.items .it + .it{margin-top:13px}
.items .it + .it::before{content:"";position:absolute;left:14px;right:14px;top:-7px;height:1px;background:#eceef2;pointer-events:none}
.items .it.sm-sel::before,.items .it.sm-sel + .it::before{opacity:0}
@media (prefers-reduced-motion:reduce){.sm-cab,.sm-menu,.sm-velo,.sm-chk,.sm-chk svg,.it.sm-brillo,.it.sm-sale,.sm-n span{animation:none!important;transition:none!important}}
</style>`);

  // «Seleccionar varias» junto a Filtrar y Ordenar.
  const ic = document.querySelector('.list-h .t .ic');
  if (ic) ic.insertAdjacentHTML('afterbegin', `<button type="button" class="sm-selb" id="sm-selb" aria-label="Seleccionar varias" aria-pressed="false" data-tip="Seleccionar varias">${ICS.sel}</button>`);
  const listaH = document.querySelector('.list-h'), items = document.getElementById('items');

  const idsVisibles = () => [...items.querySelectorAll('.it[data-c]')].map(b => +b.dataset.c);
  const elegidas = () => CONV.filter(c => SL.sel.has(c.id));
  function decorar(){
    const lista = items.closest('.list') || items;
    lista.classList.toggle('sm-modo', SL.modo);
    const sb = document.getElementById('sm-selb'); if (sb) sb.setAttribute('aria-pressed', String(SL.modo));
    for (const b of items.querySelectorAll('.it[data-c]')) {
      const f = b.querySelector('.tj-foto'); if (f && !f.querySelector('.sm-chk')) f.insertAdjacentHTML('beforeend', `<span class="sm-chk" aria-hidden="true">${ICS.chk}</span>`);
      const on = SL.sel.has(+b.dataset.c); b.classList.toggle('sm-sel', on);
      if (SL.modo) b.setAttribute('aria-pressed', String(on)); else b.removeAttribute('aria-pressed');
    }
    pintarCab();
  }
  function pintarCab(){
    let cab = document.getElementById('sm-cab');
    if (!SL.modo) { if (cab) cab.remove(); cerrarMenu(); return; }
    const n = SL.sel.size, vis = idsVisibles(), todas = n > 0 && vis.every(id => SL.sel.has(id)), sin = n ? '' : 'disabled';
    const b = (k, ic, t, cls = '') => `<button type="button" class="${cls}${SL.menu === k ? ' sm-on' : ''}" data-sm-menu="${k}" aria-label="${t}" aria-expanded="${SL.menu === k}" data-tip="${t}" ${sin}>${ic}</button>`;
    const html = `<button type="button" class="sm-x" data-sm-salir="1" aria-label="Quitar la selección">${ICS.x}</button>
      <button type="button" class="${todas ? 'sm-todas' : ''}" data-sm-todas="1" aria-label="${todas ? 'Quitar todas' : 'Seleccionar todas'}" data-tip="${todas ? 'Quitar todas' : `Seleccionar las ${vis.length}`}"><span class="sm-cb">${ICS.chk}</span></button>
      <b class="sm-n" aria-live="polite"><span>${n}</span> ${n === 1 ? 'seleccionada' : 'seleccionadas'}</b><span class="sm-esp"></span>
      ${b('trans', ICS.trans, 'Transferir')}${b('etapa', ICS.etapa, 'Etapa')}${b('tag', ICS.tag, 'Etiqueta')}${b('fin', ICS.fin, 'Finalizar', 'sm-fin')}${b('mas', ICS.mas, 'Más')}`;
    if (!cab) { listaH.insertAdjacentHTML('afterbegin', `<div class="sm-cab" id="sm-cab" role="toolbar" aria-label="Acciones con la selección"></div>`); cab = document.getElementById('sm-cab'); }
    cab.replaceChildren(); cab.insertAdjacentHTML('beforeend', html);
  }
  function entrar(id){ if (lectura()) { toast('Modo de solo lectura: puedes ver todo, pero no hacer cambios.'); return; } SL.modo = true; SL.sel = new Set(id != null ? [id] : []); SL.menu = ''; decorar(); }
  function salir(){ SL.modo = false; SL.sel.clear(); SL.menu = ''; decorar(); }
  window.crmSalirSeleccion = salir;

  // Menús
  function cerrarMenu(){ SL.menu = ''; SL.spamSeguro = false; document.getElementById('sm-menu')?.remove(); document.getElementById('sm-velo')?.remove(); }
  const avatar = (n, color) => `<span class="sm-av" style="background:${color}"><svg viewBox="0 0 40 40" aria-hidden="true"><text x="20" y="20" dy="0.36em" text-anchor="middle">${esc(ini(n) || '·')}</text></svg></span>`;
  function abrirMenu(k){
    cerrarMenu(); SL.menu = k; pintarCab();
    const n = SL.sel.size;
    let h = '';
    if (k === 'trans') h = `<p class="sm-mh">Transferir a</p><button type="button" data-sm-a="${esc(yo)}">${avatar(yo, '#0b0b10')}Asignármelas</button>` + USUARIOS.filter(u => u.nombre && u.nombre !== yo).map(u => `<button type="button" data-sm-a="${esc(u.nombre)}">${avatar(u.nombre, colorPersona(u.nombre))}${esc(u.nombre)}</button>`).join('');
    if (k === 'etapa') h = '<p class="sm-mh">Cambiar etapa</p>' + nombresEtapas().map(e => `<button type="button" data-sm-e="${esc(e)}"><i class="sm-dot" style="background:${colorOk(COL[e])}"></i>${esc(e)}</button>`).join('');
    if (k === 'tag') h = '<p class="sm-mh">Poner etiqueta</p>' + Object.keys(ETIQ_COL).map(t => `<button type="button" data-sm-t="${esc(t)}"><i class="sm-dot" style="background:${colorOk(ETIQ_COL[t])}"></i>${esc(t)}</button>`).join('');
    if (k === 'fin') h = `<p class="sm-mh">Finalizar ${n} · elige el motivo</p>` + (typeof CVCFG !== 'undefined' && CVCFG.motivos ? CVCFG.motivos : []).map(m => `<button type="button" data-sm-f="${esc(m)}">${esc(m)}</button>`).join('') + (typeof CVCFG !== 'undefined' && CVCFG.motivo === false ? '<hr><button type="button" data-sm-f="">Finalizar sin motivo</button>' : '');
    if (k === 'mas') h = `<button type="button" data-sm-x="leidas">${ICS.leida}Marcar como leídas</button><button type="button" data-sm-x="fav">${ICS.fav}Agregar a Favoritos</button><button type="button" data-sm-x="fuego">${ICS.fuego}Marcar como calientes</button><button type="button" data-sm-x="mute">${ICS.mute}Silenciar</button><button type="button" data-sm-x="exp">${ICS.exp}Exportar los chats</button><hr><button type="button" class="sm-rojo" data-sm-x="spam">${ICS.spam}Marcar como spam</button>`;
    const enHoja = movil();
    document.body.insertAdjacentHTML('beforeend', '<div class="sm-velo" id="sm-velo"></div>');
    (enHoja ? document.body : listaH).insertAdjacentHTML('beforeend', `<div class="sm-menu" id="sm-menu" role="menu">${h}</div>`);
    document.getElementById('sm-menu').querySelector('button')?.focus({preventScroll: true});
  }

  // Aplicar: brillo en las tocadas, aviso y fin de la selección.
  function terminar(msg, ids){
    crmSincronizar();
    for (const id of ids) items.querySelector(`.it[data-c="${id}"]`)?.classList.add('sm-brillo');
    toast(msg);
    setTimeout(() => { salir(); render(); }, 760);
  }
  const cuantas = (n, una, varias) => n === 1 ? `1 ${una}` : `${n} ${varias}`;
  function aplicar(fn, msg){
    if (lectura()) { toast('Modo de solo lectura: puedes ver todo, pero no hacer cambios.'); return; }
    const L = elegidas(); if (!L.length) return;
    cerrarMenu(); for (const c of L) fn(c);
    terminar(msg(L.length), L.map(c => c.id));
  }
  function finalizar(motivo){
    if (lectura()) return;
    const L = elegidas(); if (!L.length) return;
    cerrarMenu();
    for (const c of L) items.querySelector(`.it[data-c="${c.id}"]`)?.classList.add('sm-sale');
    setTimeout(() => {
      for (const c of L) { c.est = 'finalizadas'; c.motivo = motivo || null; }
      if (L.some(c => c.id === st.sel)) { const pr = visibles().find(x => !SL.sel.has(x.id)); st.sel = pr ? pr.id : 0; }
      crmSincronizar(); salir(); render();
      toast(cuantas(L.length, 'conversación finalizada', 'conversaciones finalizadas') + (motivo ? ` · ${motivo}` : ''));
    }, 380);
  }
  async function exportar(){
    const L = elegidas(); if (!L.length) return;
    cerrarMenu(); toast(`Descargando ${cuantas(L.length, 'chat', 'chats')}…`);
    let hechos = 0;
    for (const c of L) {
      try {
        const r = await crmFetch('GET', `/crm/conversaciones/${c.id}/exportar?formato=pdf&notas=1&eventos=1&archivos=0`);
        if (!r.ok) await crmLeer(r);
        const cd = r.headers.get('Content-Disposition') || '', m = cd.match(/filename\*=UTF-8''([^;]+)/);
        const url = URL.createObjectURL(await r.blob()), a = document.createElement('a'); a.href = url; a.download = m ? decodeURIComponent(m[1]) : `chat ${c.n}.pdf`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
        hechos++;
      } catch (err) { toast(`${c.n}: ${err.message || 'no se pudo exportar'}`); }
    }
    if (hechos) terminar(`Se ${hechos === 1 ? 'descargó 1 chat' : `descargaron ${hechos} chats`}`, []);
  }
  async function spam(){
    if (!SL.spamSeguro) { SL.spamSeguro = true; const b = document.querySelector('#sm-menu [data-sm-x="spam"]'); if (b) { b.classList.add('sm-seguro'); b.lastChild.textContent = `Sí, marcar ${SL.sel.size} como spam`; } return; }
    const L = elegidas(); cerrarMenu();
    for (const c of L) items.querySelector(`.it[data-c="${c.id}"]`)?.classList.add('sm-sale');
    let ok = 0;
    for (const c of L) { try { await crmApi('POST', `/crm/conversaciones/${c.id}/spam`, {bloquear: false}); ok++; } catch (err) { toast(`${c.n}: ${err.message || 'no se pudo'}`); } }
    crmSincronizar(); salir(); render();
    if (ok) toast(`${cuantas(ok, 'conversación quedó', 'conversaciones quedaron')} en spam. Están en Contactos › Spam.`);
  }

  // Clics: la barra, los menús y las tarjetas (en modo selección no abren el chat).
  document.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('#sm-selb')) { SL.modo ? salir() : entrar(null); return; }
    if (t.closest('#sm-velo')) { cerrarMenu(); pintarCab(); return; }
    if (t.closest('[data-sm-salir]')) { salir(); return; }
    if (t.closest('[data-sm-todas]')) { const vis = idsVisibles(); SL.sel = vis.every(id => SL.sel.has(id)) ? new Set() : new Set(vis); cerrarMenu(); decorar(); return; }
    const mb = t.closest('[data-sm-menu]'); if (mb && !mb.disabled) { SL.menu === mb.dataset.smMenu ? (cerrarMenu(), pintarCab()) : abrirMenu(mb.dataset.smMenu); return; }
    const a = t.closest('[data-sm-a]'); if (a) { const quien = a.dataset.smA; aplicar(c => { if (c.asig === quien) return; c.msgs.push({ev: 'swap', t: quien === yo ? `${yo} la tomó · ahora` : `${yo} la transfirió a ${quien} · ahora`}); c.asig = quien; }, n => quien === yo ? `Te asignaste ${cuantas(n, 'conversación', 'conversaciones')}` : `Transferiste ${cuantas(n, 'conversación', 'conversaciones')} a ${quien}`); return; }
    const et = t.closest('[data-sm-e]'); if (et) { const e2 = et.dataset.smE; aplicar(c => { if ((c.etq || [])[0] === e2) return; c.etq = [e2]; c.msgs.push({ev: 'tag', t: `Etapa: ${e2} · ahora`}); }, n => `${cuantas(n, 'conversación pasó', 'conversaciones pasaron')} a ${e2}`); return; }
    const tg = t.closest('[data-sm-t]'); if (tg) { const t2 = tg.dataset.smT; aplicar(c => { if (!(c.tags || []).includes(t2)) c.tags = [...(c.tags || []), t2]; }, n => `Etiqueta «${t2}» en ${cuantas(n, 'conversación', 'conversaciones')}`); return; }
    const f = t.closest('[data-sm-f]'); if (f) { finalizar(f.dataset.smF); return; }
    const x = t.closest('[data-sm-x]'); if (x) {
      const k = x.dataset.smX;
      if (k === 'leidas') aplicar(c => { c.unread = 0; }, n => `${cuantas(n, 'conversación marcada', 'conversaciones marcadas')} como leída${n === 1 ? '' : 's'}`);
      if (k === 'fav') aplicar(c => { if (!(AJ.favoritos || []).includes(c.id)) AJ.favoritos = [...(AJ.favoritos || []), c.id]; }, n => `${cuantas(n, 'conversación quedó', 'conversaciones quedaron')} en Favoritos`);
      if (k === 'fuego') aplicar(c => { c.fuego = true; }, n => `${cuantas(n, 'conversación marcada', 'conversaciones marcadas')} como caliente${n === 1 ? '' : 's'}`);
      if (k === 'mute') aplicar(c => { const id = c.contactoId || c.id; if (!(AJ.silenciados || []).includes(id)) AJ.silenciados = [...(AJ.silenciados || []), id]; }, n => `Silenciaste ${cuantas(n, 'conversación', 'conversaciones')}`);
      if (k === 'exp') exportar();
      if (k === 'spam') spam();
      return;
    }
  });
  // En modo selección, tocar una tarjeta la elige (no abre el chat): va antes que el clic de siempre de la lista.
  items.addEventListener('click', e => {
    if (SL.tragarClic) { SL.tragarClic = false; e.stopPropagation(); e.preventDefault(); return; }
    if (!SL.modo) return;
    const b = e.target.closest('.it[data-c]'); if (!b) return;
    e.stopPropagation(); e.preventDefault();
    const id = +b.dataset.c; SL.sel.has(id) ? SL.sel.delete(id) : SL.sel.add(id);
    if (!SL.sel.size && movil()) { salir(); return; }
    cerrarMenu(); decorar();
  }, true);
  // Celular: dejar presionada una conversación empieza a elegir varias.
  items.addEventListener('pointerdown', e => {
    if (SL.modo || !movil() || e.pointerType === 'mouse') return;
    const b = e.target.closest('.it[data-c]'); if (!b) return;
    const x0 = e.clientX, y0 = e.clientY;
    clearTimeout(SL.presion);
    SL.presion = setTimeout(() => { SL.tragarClic = true; if (navigator.vibrate) try { navigator.vibrate(12); } catch { /* sin vibración */ } entrar(+b.dataset.c); }, 450);
    const cancelar = ev => { if (ev.type === 'pointermove' && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 8) return; clearTimeout(SL.presion); items.removeEventListener('pointermove', cancelar); };
    items.addEventListener('pointermove', cancelar); items.addEventListener('pointerup', cancelar, {once: true}); items.addEventListener('pointercancel', cancelar, {once: true});
  });
  items.addEventListener('contextmenu', e => { if (movil() && e.target.closest('.it[data-c]')) e.preventDefault(); });
  document.addEventListener('keydown', e => { if (e.key !== 'Escape' || !SL.modo) return; if (SL.menu) { cerrarMenu(); pintarCab(); } else salir(); });

  // Cada vez que la lista se pinta, se vuelven a poner las casillas; las que ya no se ven salen de la selección.
  const listaBase = lista;
  lista = function(){
    listaBase.apply(this, arguments);
    if (SL.modo) { const vis = new Set(idsVisibles()); for (const id of [...SL.sel]) if (!vis.has(id)) SL.sel.delete(id); }
    decorar();
  };
  // Al salir de la bandeja (otra página o abrir un chat en el celular) se termina la selección.
  const renderSel = render;
  render = function(){ if (SL.modo && st.pagina) salir(); return renderSel.apply(this, arguments); };
})();
