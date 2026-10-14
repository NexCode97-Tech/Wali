/* ── Chat desde el embudo (maqueta aprobada «chat desde el embudo», 14-oct) ──
   Tocar una tarjeta del embudo ya no lleva a la bandeja: abre la conversación en un panel a la derecha, sin salir del
   embudo. Se lee y se responde ahí (texto, emojis y archivos), se cambia la etapa desde arriba y se cierra con la X roja,
   Esc o tocando fuera. «Abrir en la bandeja» lleva a la conversación con todo el detalle. Lo que se escribe aquí sale
   igual que desde la bandeja: se suma a c.msgs y el guardado de 80-datos.js lo envía. ── */
(() => {
  let abierta = 0, menuEtapa = false;
  const conv2 = () => CONV.find(x => x.id === abierta);
  const colorEtq = n => { const e = (typeof ETQ !== 'undefined' ? ETQ : []).find(x => x[0] === n); return e ? colorOk(e[1]) : '#9ca3af'; };
  const canalN = k => ({wa:'WhatsApp', ig:'Instagram', fb:'Messenger', tg:'Telegram', tt:'TikTok', mail:'Correo', web:'Chat de la web'})[k] || 'WhatsApp';

  document.head.insertAdjacentHTML('beforeend', `<style>
#ec-velo{position:fixed;inset:0;z-index:70;background:rgba(11,11,16,.18);opacity:0;pointer-events:none;transition:opacity .2s}
#ec-velo.on{opacity:1;pointer-events:auto}
#ec-cajon{position:fixed;top:0;right:0;bottom:0;z-index:71;width:min(460px,100vw);background:#fff;box-shadow:-24px 0 48px -24px rgba(11,11,16,.45);display:flex;flex-direction:column;transform:translateX(102%);transition:transform .28s cubic-bezier(.22,1,.36,1)}
#ec-cajon.on{transform:none}
.ec-cab{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid #eef1f5;position:relative}
.ec-cab .av{width:36px;height:36px;font-size:12px;flex:none}
.ec-nm{min-width:0;flex:1}
.ec-nm b{display:block;font-size:14.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ec-nm small{display:block;font-size:12px;color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ec-et{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 10px;border-radius:999px;border:1px solid #e5e9f0;background:#fff;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap;flex:none}
.ec-et i{width:8px;height:8px;border-radius:50%}
.ec-et svg{width:13px;height:13px;color:#9ca3af}
.ec-menu{position:absolute;right:56px;top:52px;z-index:2;min-width:200px;background:#fff;border:1px solid #e5e9f0;border-radius:12px;box-shadow:0 18px 40px -12px rgba(15,23,42,.3);padding:6px;display:grid;gap:2px}
.ec-menu button{display:flex;align-items:center;gap:8px;padding:8px 10px;border:0;background:none;border-radius:8px;font:inherit;font-size:13.5px;text-align:left;cursor:pointer;color:var(--ink)}
.ec-menu button:hover,.ec-menu button[aria-selected="true"]{background:#f2f4f6}
.ec-menu i{width:8px;height:8px;border-radius:50%;flex:none}
.ec-x{width:32px;height:32px;border:0;border-radius:9px;background:none;color:#dc2626;display:grid;place-items:center;cursor:pointer;flex:none}
.ec-x:hover{background:#fef2f2}
.ec-x svg{width:18px;height:18px}
.ec-msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;background-color:#f3f4f6;background-image:url('__BASE__/img/fondo-chat.png?v=gris');background-size:288px auto}
.ec-msgs .ch-col{max-width:min(340px,82%)}
.ec-carga{margin:auto;font-size:13px;color:#6b7280}
.ec-comp{margin:10px 12px;border:1px solid #e5e9f0;border-radius:14px;background:#fff}
.ec-comp:focus-within{border-color:#0b0b10;box-shadow:0 0 0 3px rgba(11,11,16,.08)}
.ec-comp textarea{display:block;width:100%;box-sizing:border-box;border:0;outline:none;resize:none;min-height:44px;max-height:140px;padding:12px 14px 6px;font:inherit;font-size:13.5px;line-height:1.45;color:var(--ink);background:none}
.ec-bar{display:flex;align-items:center;gap:2px;padding:6px 8px 8px}
.ec-ic{width:34px;height:34px;border:0;border-radius:8px;background:none;display:grid;place-items:center;color:#4b5563;cursor:pointer}
.ec-ic:hover{background:#f2f4f6}
.ec-ic svg{width:18px;height:18px}
.ec-env{margin-left:auto;height:36px;padding:0 16px;border-radius:10px;border:0;background:#FFD21F;font:inherit;font-weight:700;font-size:13.5px;display:inline-flex;align-items:center;gap:7px;cursor:pointer;color:#0b0b10}
.ec-env:hover{background:#f5c800}
.ec-env svg{width:15px;height:15px}
.ec-aviso{margin:0 12px 6px;font-size:12px;color:#92400e}
.ec-abrir{display:flex;align-items:center;justify-content:center;gap:6px;padding:11px;font:inherit;font-size:12.5px;font-weight:600;color:#374151;border:0;border-top:1px solid #eef1f5;background:none;cursor:pointer}
.ec-abrir:hover{background:#f9fafb}
.ec-abrir svg{width:14px;height:14px}
.kc.ec-on{border-color:#0b0b10!important;box-shadow:inset 0 0 0 1px #0b0b10}
</style>`);
  document.body.insertAdjacentHTML('beforeend', '<div id="ec-velo"></div><aside id="ec-cajon" aria-label="Conversación" aria-hidden="true"></aside>');
  const velo = document.getElementById('ec-velo'), caja = document.getElementById('ec-cajon');

  function pintar(){
    const c = conv2(); if (!c) { cerrar(); return; }
    const borrador = (document.getElementById('ec-t') || {}).value || '';
    const et = (c.etq || [])[0] || 'Sin etapa', cerrada = /cerrada/i.test(c.ventana || '');
    const etapas = [...etapasActivas(), ...etapasPerdidas()];
    const det = [canalN(c.canal), equipoConv(c), c.asig || 'Sin asignar'].join(' · ');
    const cuerpo = !c._cargada && (!c.msgs || !c.msgs.length) ? '<p class="ec-carga">Cargando la conversación…</p>' : pintarChat(c);
    caja.replaceChildren(document.createRange().createContextualFragment(`
      <div class="ec-cab"><span class="av" style="background:${AVC[c.id % AVC.length]}">${esc(ini(trNombreConv(c)))}</span><div class="ec-nm"><b>${esc(trNombreConv(c))}</b><small>${esc(det)}</small></div>
        <button type="button" class="ec-et" data-ec-etapa="1" aria-haspopup="listbox" aria-expanded="${menuEtapa}"><i style="background:${colorEtq(et)}"></i>${esc(et)}${I('chev')}</button>
        <button type="button" class="ec-x" data-ec-cerrar="1" aria-label="Cerrar">${I('x')}</button>
        ${menuEtapa ? `<div class="ec-menu" role="listbox">${etapas.map(n => `<button type="button" role="option" aria-selected="${n === et}" data-ec-pon="${esc(n)}"><i style="background:${colorEtq(n)}"></i>${esc(n)}</button>`).join('')}</div>` : ''}</div>
      <div class="ec-msgs" id="ec-msgs">${cuerpo}</div>
      ${cerrada ? '<p class="ec-aviso">Pasaron más de 24 horas desde su último mensaje: para escribirle hay que usar una plantilla desde la bandeja.</p>' : ''}
      <div class="ec-comp"><textarea id="ec-t" rows="1" placeholder="Escribe un mensaje…" aria-label="Escribe un mensaje">${esc(borrador)}</textarea>
        <div class="ec-bar"><button type="button" class="ec-ic" data-ec-emo="1" aria-label="Emojis">${I('smile')}</button><button type="button" class="ec-ic" data-ec-adj="1" aria-label="Adjuntar un archivo">${I('clip')}</button>
          <button type="button" class="ec-env" data-ec-enviar="1">${I('send')}Enviar</button></div></div>
      <button type="button" class="ec-abrir" data-ec-bandeja="1">${I('share')}Abrir en la bandeja con todo el detalle</button>`));
    const m = document.getElementById('ec-msgs'); if (m) m.scrollTop = m.scrollHeight;
    document.querySelectorAll('.kc.ec-on').forEach(x => x.classList.remove('ec-on'));
    const k = document.querySelector(`.kc[data-kc="${c.id}"]`); if (k) k.classList.add('ec-on');
  }
  function abrir(id){
    abierta = id; menuEtapa = false;
    const c = conv2(); if (!c) return;
    if (!c._cargada && crmDatos && crmDatos.cargarMensajes) crmDatos.cargarMensajes(c);
    pintar(); velo.classList.add('on'); caja.classList.add('on'); caja.setAttribute('aria-hidden', 'false');
    setTimeout(() => { const t = document.getElementById('ec-t'); if (t) t.focus(); }, 280);
  }
  function cerrar(){
    abierta = 0; menuEtapa = false; velo.classList.remove('on'); caja.classList.remove('on'); caja.setAttribute('aria-hidden', 'true');
    document.querySelectorAll('.kc.ec-on').forEach(x => x.classList.remove('ec-on'));
  }
  function enviar(){
    const c = conv2(), t = document.getElementById('ec-t'); if (!c || !t) return;
    const txt = t.value.trim(); if (!txt) { t.focus(); return; }
    if (/cerrada/i.test(c.ventana || '')) { toast('La ventana de 24 h está cerrada: retoma con una plantilla desde la bandeja'); return; }
    c.unread = 0; c.msgs.push({out: txt, by: yo, h: 'ahora'}); t.value = '';
    pintar(); render(); if (crmDatos && crmDatos.programarRevision) crmDatos.programarRevision(0);
  }

  // La tarjeta del embudo abre el panel (antes se iba a la bandeja). En fase de captura, antes que el manejador general.
  document.addEventListener('click', e => {
    if (st.pagina !== 'embudo') return;
    const k = e.target.closest('.kc[data-open]'); if (!k) return;
    e.stopPropagation(); e.preventDefault(); abrir(+k.dataset.open);
  }, true);
  velo.addEventListener('click', cerrar);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && abierta) { if (menuEtapa) { menuEtapa = false; pintar(); } else cerrar(); } });
  caja.addEventListener('click', e => {
    const c = conv2(); if (!c) return;
    if (e.target.closest('[data-ec-cerrar]')) { cerrar(); return; }
    if (e.target.closest('[data-ec-etapa]')) { menuEtapa = !menuEtapa; pintar(); return; }
    const pon = e.target.closest('[data-ec-pon]');
    if (pon) { const n = pon.dataset.ecPon; menuEtapa = false; if ((c.etq || [])[0] !== n) { c.etq = [n]; c.msgs.push({ev:'tag', t:`Etapa: ${n} · ahora`}); render(); toast(`${trNombreConv(c)}: ${n}`); } pintar(); return; }
    if (menuEtapa && !e.target.closest('.ec-menu')) { menuEtapa = false; pintar(); }
    if (e.target.closest('[data-ec-enviar]')) { enviar(); return; }
    const em = e.target.closest('[data-ec-emo]'); if (em) { e.stopPropagation(); abrirEmojis(em, document.getElementById('ec-t')); return; }
    if (e.target.closest('[data-ec-adj]')) { enviarArchivoPc(c); return; }
    if (e.target.closest('[data-ec-bandeja]')) { const id = c.id; cerrar(); st.sel = id; st.pagina = ''; st.vista = 'todas'; st.carpeta = st.equipo = st.etq = st.linea = st.q = ''; st.menciones = false; render(); }
  });
  caja.addEventListener('keydown', e => { if (e.target.id === 'ec-t' && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } });
  // Si cambian los datos (llega un mensaje, se cargó la conversación), el panel se repinta; si se sale del embudo, se cierra.
  const renderAntes = render;
  render = function(...a){ const r = renderAntes.apply(this, a); if (abierta) { if (st.pagina !== 'embudo') cerrar(); else if (!document.activeElement || document.activeElement.id !== 'ec-t') pintar(); else { const k = document.querySelector(`.kc[data-kc="${abierta}"]`); if (k) k.classList.add('ec-on'); } } return r; };
})();
