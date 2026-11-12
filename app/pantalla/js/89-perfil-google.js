/* ── Google Calendar en Mi perfil (maqueta aprobada, versión 316, 12-nov): con la cuenta conectada dice con qué correo y
   trae Desconectar (pide confirmar; los eventos que ya están en el calendario se quedan); sin conectar, «Conectar Google
   Calendar» usa el mismo flujo del diálogo de recordatorios (crmConectarGoogle, 89-recordatorios.js). ── */
(() => {
  const conectado = () => typeof CRM_YO === 'object' && CRM_YO && CRM_YO.gcal;
  function bloque(){
    const correo = conectado();
    const cuenta = correo
      ? `<div class="gcp-cu"><span class="gcp-cta"><i></i><span>Conectado con <b>${esc(String(correo))}</b></span></span><button type="button" class="btn gcp-des" data-gcp-des>${I('x', 'i ix')}Desconectar</button></div>`
      : `<div class="gcp-cu"><span class="gcp-cta off"><i></i><span>Sin conectar. Tus recordatorios quedan solo en Wali.</span></span><button type="button" class="btn pri rcp-ir" data-gcp-con>Conectar Google Calendar${I('ext')}</button></div>`;
    return `<div class="gcp" id="gcp"><div class="gcp-h"><span class="gcp-ic">${I('calendar')}</span><div class="gcp-tx"><b>Google Calendar</b><span>Los recordatorios de seguimiento que agendes quedan en tu calendario y Google te avisa antes.</span></div></div>${cuenta}</div>`;
  }
  // Va al final de Mi perfil (10-nucleo, sección «perfil» de Mis ajustes), cada vez que esa página se pinta.
  function poner(){
    const pg = document.getElementById('page'); if (!pg) return;
    const h2 = pg.querySelector('.ajw h2'), acb = pg.querySelector('.ajw .acb');
    if (!h2 || h2.textContent.trim() !== 'Mi perfil' || !acb) return;
    const viejo = acb.querySelector('#gcp'), v = String(!!conectado());
    if (viejo) { if (viejo.dataset.v === v) return; viejo.remove(); }
    acb.insertAdjacentHTML('beforeend', bloque()); acb.querySelector('#gcp').dataset.v = v;
  }
  new MutationObserver(poner).observe(document.getElementById('page'), {childList: true, subtree: true});
  document.addEventListener('crm:gcal', poner);
  document.addEventListener('click', e => {
    if (e.target.closest('[data-gcp-des]')) {
      abrirDialogo(`<h3>¿Desconectar Google Calendar?</h3><p>Wali deja de agendar tus recordatorios en tu calendario. Los eventos que ya están allá se quedan.</p><div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn rojo" data-gcp-si>Desconectar</button></div>`, 'mj-dlg');
      return;
    }
    const si = e.target.closest('[data-gcp-si]');
    if (si && !si.disabled) {
      si.disabled = true;
      crmApi('DELETE', '/auth/me/google-calendario').then(() => { CRM_YO.gcal = null; cerrarDialogo(); poner(); toast('Google Calendar desconectado'); }, err => { si.disabled = false; toast(err.message || 'No se pudo desconectar'); });
      return;
    }
    const con = e.target.closest('[data-gcp-con]');
    if (con && typeof window.crmConectarGoogle === 'function') window.crmConectarGoogle(con);
  });
  document.head.insertAdjacentHTML('beforeend', `<style>
.gcp{display:grid;gap:12px;margin-top:6px;padding-top:18px;border-top:1px solid #eef1f5}
.gcp-h{display:flex;gap:12px;align-items:flex-start}
.gcp-ic{width:40px;height:40px;border-radius:11px;background:#eef3ff;color:#1d4ed8;display:grid;place-items:center;flex:none}.gcp-ic svg{width:20px;height:20px}
.gcp-tx b{display:block;font-size:14px;font-weight:600;color:#0b0b10}.gcp-tx span{display:block;font-size:13px;color:#6b7280;line-height:1.45;margin-top:2px}
.gcp-cu{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 14px;border:1px solid #e5e9f0;border-radius:12px;background:#f8fafc;animation:gcp-entra .4s cubic-bezier(.32,.72,0,1) both}
@keyframes gcp-entra{from{opacity:0;transform:translateY(6px)}}
.gcp-cta{flex:1 1 220px;min-width:0;display:flex;align-items:center;gap:9px;font-size:13px;color:#374151}
.gcp-cta i{width:8px;height:8px;border-radius:50%;background:#16a34a;flex:none;box-shadow:0 0 0 3px rgba(22,163,74,.15)}
.gcp-cta.off i{background:#9ca3af;box-shadow:0 0 0 3px rgba(156,163,175,.18)}
.gcp-cta b{font-weight:600;color:#0b0b10;overflow-wrap:anywhere}
.gcp-des svg.ix{color:#dc2626}
.gcp .rcp-ir{display:inline-flex;align-items:center;gap:8px}
@media (prefers-reduced-motion:reduce){.gcp-cu{animation:none}}
</style>`);
})();
