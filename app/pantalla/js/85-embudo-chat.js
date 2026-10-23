/* ── Chat desde el embudo (maqueta aprobada «chat desde el embudo», 14-oct) ──
   Tocar una tarjeta del embudo ya no lleva a la bandeja: abre la conversación en un panel a la derecha, sin salir del
   embudo. Se cambia la etapa desde arriba y se cierra con la X roja, Esc o tocando fuera.
   El compositor es EL MISMO de la bandeja (#comp): mientras el panel está abierto se mueve adentro y la conversación
   queda seleccionada (st.sel), así funcionan igual Responder y Nota privada, respuestas rápidas, emojis, material, nota
   de voz, plantillas, enlace de pago y programar. Al cerrar, el compositor vuelve a su sitio. ── */
(() => {
  let abierta = 0, menuEtapa = false, selAntes = 0, compCasa = null;
  const conv2 = () => CONV.find(x => x.id === abierta);
  const colorEtq = n => { const e = (typeof ETQ !== 'undefined' ? ETQ : []).find(x => x[0] === n); return e ? colorOk(e[1]) : '#9ca3af'; };
  const canalN = k => ({wa:'WhatsApp', ig:'Instagram', fb:'Messenger', tg:'Telegram', tt:'TikTok', mail:'Correo', web:'Chat de la web'})[k] || 'WhatsApp';
  const frag = h => document.createRange().createContextualFragment(h);

  document.head.insertAdjacentHTML('beforeend', `<style>
#ec-velo{position:fixed;inset:0;z-index:70;background:rgba(11,11,16,.18);opacity:0;pointer-events:none;transition:opacity .2s}
#ec-velo.on{opacity:1;pointer-events:auto}
#ec-cajon{position:fixed;top:0;right:0;bottom:0;z-index:71;width:min(520px,100vw);background:#fff;box-shadow:-24px 0 48px -24px rgba(11,11,16,.45);display:flex;flex-direction:column;transform:translateX(102%);transition:transform .28s cubic-bezier(.22,1,.36,1)}
#ec-cajon.on{transform:none}
.ec-cab{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid #eef1f5;position:relative;flex:none}
.ec-cab .av{width:36px;height:36px;font-size:12px;flex:none}
.ec-nm{min-width:0;flex:1}
.ec-nm b{display:block;font-size:14.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ec-nm small{display:block;font-size:12px;color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ec-et{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 10px;border-radius:999px;border:1px solid #e5e9f0;background:#fff;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap;flex:none}
.ec-et i{width:8px;height:8px;border-radius:50%}
.ec-et svg{width:13px;height:13px;color:#9ca3af}
.ec-menu{position:absolute;right:56px;top:52px;z-index:3;min-width:200px;background:#fff;border:1px solid #e5e9f0;border-radius:12px;box-shadow:0 18px 40px -12px rgba(15,23,42,.3);padding:6px;display:grid;gap:2px}
.ec-menu button{display:flex;align-items:center;gap:8px;padding:8px 10px;border:0;background:none;border-radius:8px;font:inherit;font-size:13.5px;text-align:left;cursor:pointer;color:var(--ink)}
.ec-menu button:hover,.ec-menu button[aria-selected="true"]{background:#f2f4f6}
.ec-menu i{width:8px;height:8px;border-radius:50%;flex:none}
.ec-x{width:32px;height:32px;border:0;border-radius:9px;background:none;color:#dc2626;display:grid;place-items:center;cursor:pointer;flex:none}
.ec-x:hover{background:#fef2f2}
.ec-x svg{width:18px;height:18px}
.ec-msgs{flex:1;min-height:0;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;background-color:#f3f4f6;background-image:url('__BASE__/img/fondo-chat.png?v=gris');background-size:288px auto}
.ec-msgs .ch-col{max-width:min(380px,82%)}
.ec-carga{margin:auto;font-size:13px;color:#6b7280}
#ec-slot{flex:none;position:relative}
#ec-slot > .comp{position:relative;display:block!important;border-top:1px solid #eef1f5;padding:10px 12px 8px;margin:0;background:#fff}
#ec-slot .tplp,#ec-slot .qr,#ec-slot .lk{bottom:calc(100% + 6px)}
#ec-slot .mode{margin-top:0}
.ec-abrir{display:flex;align-items:center;justify-content:center;gap:6px;padding:10px;font:inherit;font-size:12.5px;font-weight:600;color:#374151;border:0;border-top:1px solid #eef1f5;background:none;cursor:pointer;flex:none}
.ec-abrir:hover{background:#f9fafb}
.ec-abrir svg{width:14px;height:14px}
.kc.ec-on{border-color:#0b0b10!important;box-shadow:inset 0 0 0 1px #0b0b10}
</style>`);
  document.body.insertAdjacentHTML('beforeend', '<div id="ec-velo"></div><aside id="ec-cajon" aria-label="Conversación" aria-hidden="true"><div id="ec-cab"></div><div class="ec-msgs" id="ec-msgs"></div><div id="ec-slot"></div><button type="button" class="ec-abrir" data-ec-bandeja="1"></button></aside>');
  const velo = document.getElementById('ec-velo'), caja = document.getElementById('ec-cajon');
  caja.querySelector('.ec-abrir').replaceChildren(frag(`${I('share')}Abrir en la bandeja con todo el detalle`));

  function pintarCab(){
    const c = conv2(); if (!c) return;
    const et = (c.etq || [])[0] || 'Sin etapa', etapas = [...etapasActivas(), ...etapasPerdidas()];
    const det = [canalN(c.canal), equipoConv(c), c.asig || 'Sin asignar'].join(' · ');
    document.getElementById('ec-cab').replaceChildren(frag(`<div class="ec-cab"><span class="av" style="background:${AVC[c.id % AVC.length]}">${esc(ini(trNombreConv(c)))}</span><div class="ec-nm"><b>${esc(trNombreConv(c))}</b><small>${esc(det)}</small></div>
      <button type="button" class="ec-et" data-ec-etapa="1" aria-haspopup="listbox" aria-expanded="${menuEtapa}"><i style="background:${colorEtq(et)}"></i>${esc(et)}${I('chev')}</button>
      <button type="button" class="ec-x" data-ec-cerrar="1" aria-label="Cerrar">${I('x')}</button>
      ${menuEtapa ? `<div class="ec-menu" role="listbox">${etapas.map(n => `<button type="button" role="option" aria-selected="${n === et}" data-ec-pon="${esc(n)}"><i style="background:${colorEtq(n)}"></i>${esc(n)}</button>`).join('')}</div>` : ''}</div>`));
  }
  function pintarMsgs(){
    const c = conv2(), m = document.getElementById('ec-msgs'); if (!c || !m) return;
    const abajo = m.scrollHeight - m.scrollTop - m.clientHeight < 60;
    m.replaceChildren(frag(!c._cargada && (!c.msgs || !c.msgs.length) ? '<p class="ec-carga">Cargando la conversación…</p>' : pintarChat(c)));
    if (abajo || !m.dataset.visto) { m.scrollTop = m.scrollHeight; m.dataset.visto = '1'; }
  }
  function marcarTarjeta(){
    document.querySelectorAll('.kc.ec-on').forEach(x => x.classList.remove('ec-on'));
    const k = abierta && document.querySelector(`.kc[data-kc="${abierta}"]`); if (k) k.classList.add('ec-on');
  }
  function abrir(id){
    const c = CONV.find(x => x.id === id); if (!c) return;
    if (!abierta) selAntes = st.sel;
    abierta = id; menuEtapa = false; st.sel = id;
    if (!c._cargada && crmDatos && crmDatos.cargarMensajes) crmDatos.cargarMensajes(c);
    // El compositor de la bandeja entra al panel (con sus listeners: todo funciona igual).
    const comp = document.getElementById('comp');
    if (comp && comp.parentNode !== document.getElementById('ec-slot')) { compCasa = {padre: comp.parentNode, sig: comp.nextSibling}; document.getElementById('ec-slot').appendChild(comp); }
    document.getElementById('ec-msgs').dataset.visto = '';
    pintarCab(); pintarMsgs(); if (typeof chat === 'function') chat();
    velo.classList.add('on'); caja.classList.add('on'); caja.setAttribute('aria-hidden', 'false'); marcarTarjeta();
    setTimeout(() => { const t = document.getElementById('ta'); if (t) t.focus(); }, 280);
  }
  function cerrar(){
    if (!abierta) return;
    abierta = 0; menuEtapa = false; velo.classList.remove('on'); caja.classList.remove('on'); caja.setAttribute('aria-hidden', 'true');
    const comp = document.getElementById('comp');
    if (comp && compCasa) { compCasa.padre.insertBefore(comp, compCasa.sig && compCasa.sig.parentNode === compCasa.padre ? compCasa.sig : null); compCasa = null; }
    if (selAntes && CONV.some(x => x.id === selAntes)) st.sel = selAntes;
    marcarTarjeta();
  }

  // La tarjeta del embudo abre el panel (antes se iba a la bandeja). En fase de captura, antes que el manejador general.
  document.addEventListener('click', e => {
    if (st.pagina !== 'embudo') return;
    const k = e.target.closest('.kc[data-open]'); if (!k) return;
    e.stopPropagation(); e.preventDefault(); abrir(+k.dataset.open);
  }, true);
  velo.addEventListener('click', cerrar);
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !abierta) return;
    if (document.querySelector('#ec-slot .tplp:not([hidden]),#ec-slot .qr:not([hidden]),#ec-slot .lk:not([hidden]),#emop:not([hidden])')) return;
    if (menuEtapa) { menuEtapa = false; pintarCab(); } else cerrar();
  });
  caja.addEventListener('click', e => {
    const c = conv2(); if (!c) return;
    if (e.target.closest('[data-ec-cerrar]')) { cerrar(); return; }
    if (e.target.closest('[data-ec-etapa]')) { menuEtapa = !menuEtapa; pintarCab(); return; }
    const pon = e.target.closest('[data-ec-pon]');
    if (pon) { const n = pon.dataset.ecPon; menuEtapa = false; if ((c.etq || [])[0] !== n) { c.etq = [n]; c.msgs.push({ev:'tag', t:`Etapa: ${n} · ahora`}); render(); toast(`${trNombreConv(c)}: ${n}`); } pintarCab(); return; }
    if (menuEtapa && !e.target.closest('.ec-menu')) { menuEtapa = false; pintarCab(); }
    if (e.target.closest('[data-ec-bandeja]')) { const id = c.id; cerrar(); st.sel = id; st.pagina = ''; st.vista = 'todas'; st.carpeta = st.equipo = st.etq = st.linea = st.q = ''; st.menciones = false; render(); }
  });
  // Lo que pinta la bandeja (enviar, llegar un mensaje, cargar la conversación) también repinta el panel.
  const renderAntes = render;
  render = function(...a){ const r = renderAntes.apply(this, a); if (abierta) { if (st.pagina !== 'embudo') cerrar(); else { st.sel = abierta; pintarCab(); pintarMsgs(); marcarTarjeta(); } } return r; };
  // Al mover un lead de etapa (o con cualquier repintado) el embudo se vuelve a dibujar: se conserva dónde iba el scroll
  // horizontal y el de cada columna, para no volver al inicio.
  const renderSinScroll = render;
  render = function(...a){
    const kb = document.querySelector('#page .kb'), x = kb ? kb.scrollLeft : 0;
    const cols = kb ? [...kb.querySelectorAll('.kcol[data-col]')].map(c => [c.dataset.col, c.scrollTop]) : [];
    const r = renderSinScroll.apply(this, a);
    const kb2 = document.querySelector('#page .kb');
    if (kb && kb2 && kb2 !== kb) {
      kb2.scrollLeft = x;
      for (const [k, t] of cols) { const c = kb2.querySelector(`.kcol[data-col="${CSS.escape(k)}"]`); if (c && t) c.scrollTop = t; }
    }
    return r;
  };
  const chatAntes = chat;
  chat = function(...a){ const r = chatAntes.apply(this, a); if (abierta) pintarMsgs(); return r; };
})();
