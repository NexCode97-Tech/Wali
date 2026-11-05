/* ── Grabaciones (maquetas aprobadas el 5-nov): pestaña de Ajustes › Llamadas, con buscador, filtros y modal para escuchar.
   Las ven administradores y líderes (los líderes, las de sus equipos). Eliminar es solo del administrador y descargar
   no es para la cuenta de solo lectura. El audio se pide al abrir: la dirección vence (grabaciones.ts). ── */
document.head.insertAdjacentHTML('beforeend', `<style>
.grb-tabs{display:flex;gap:4px;margin-top:16px;border-bottom:1px solid var(--line)}.grb-tabs button{flex:none;min-height:44px;padding:0 14px;font-size:13.5px;font-weight:600;color:var(--ink3);border-bottom:2px solid transparent;margin-bottom:-1px}.grb-tabs button[aria-selected="true"]{color:var(--ink);border-bottom-color:var(--ink)}
.grb-bus{display:flex;gap:8px;margin-top:18px;align-items:center}.grb-cam{flex:1;min-width:0;display:flex;align-items:center;gap:9px;min-height:44px;padding:0 13px;border:1px solid var(--line);border-radius:11px}.grb-cam input{flex:1;min-width:0;border:0;outline:0;background:none;font:inherit}.grb-fil{flex:none;min-height:44px;max-width:170px;padding:0 10px;border:1px solid var(--line);border-radius:11px;background:var(--bg,#fff);font:inherit;font-size:13.5px;font-weight:600}
.grb-lista{margin-top:16px;border:1px solid var(--line);border-radius:16px;overflow:hidden}.grb-cab,.grb-f{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,.9fr) 150px 70px 140px;align-items:center;gap:14px;padding:0 16px}.grb-cab{min-height:42px;background:var(--bg2,#f6f7f9);font-size:12.5px;font-weight:600;color:var(--ink3)}.grb-f{min-height:70px;border-top:1px solid var(--line);transition:opacity .22s cubic-bezier(.3,0,1,1),transform .22s cubic-bezier(.3,0,1,1),max-height .26s cubic-bezier(.2,0,0,1) .1s,min-height .26s cubic-bezier(.2,0,0,1) .1s;max-height:140px;overflow:hidden}.grb-f.sale{opacity:0;transform:translateX(16px);max-height:0;min-height:0}
.grb-cli{display:flex;align-items:center;gap:10px;min-width:0}.grb-cli b{display:block;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.grb-cli small{display:none;font-size:12.5px;color:var(--ink3)}.grb-dur{font-size:12.5px;color:var(--ink3);font-variant-numeric:tabular-nums}
.grb-acc{display:flex;justify-content:flex-end}.grb-acc button{width:44px;height:44px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:var(--ink2)}.grb-acc button:hover{background:var(--bg2,#f6f7f9)}.grb-acc .rojo{color:#dc2626}.grb-acc [data-grb-oir] svg{fill:currentColor}.dlg > .grb-dp:last-child{margin-bottom:0}.grb-dd{flex:none}.grb-dd .dd{min-width:136px!important}.grb-pie{margin:12px 0 0;font-size:13px;color:var(--ink3)}.grb-mas{height:1px}
@media (max-width:960px){.grb-cab{display:none}.grb-f{grid-template-columns:minmax(0,1.3fr) 140px 50px 140px;padding:10px 14px}.grb-mi{display:none}.grb-cli small{display:block}}
@media (max-width:640px){.grb-bus{flex-wrap:wrap}.grb-cam{flex:1 1 100%}.grb-fil2{flex:1 1 30%;min-width:0}.grb-fil2 .dd{min-width:0!important;width:100%}.grb-f{grid-template-columns:minmax(0,1fr) auto;gap:2px 8px;padding:10px 8px 12px 14px}.grb-cli{grid-column:1;grid-row:1}.grb-acc{grid-column:2;grid-row:1}.grb-fe{grid-column:1;grid-row:2;padding-left:46px;font-size:12.5px;color:var(--ink3)}.grb-dur{grid-column:2;grid-row:2;text-align:right;padding-right:14px}}
.dlg.grb-dlg{width:min(520px,calc(100vw - 32px));padding:0;overflow:hidden}.grb-dh{display:flex;align-items:center;gap:12px;padding:22px 60px 16px 24px}.grb-dh h3{margin:0;font-size:18px}.grb-dh p{margin:2px 0 0;font-size:13.5px;color:var(--ink3)}.grb-dlg audio{display:block;width:calc(100% - 48px);margin:0 24px}.grb-dat{margin:14px 24px 0;display:grid;gap:8px;font-size:13.5px}.grb-dat div{display:flex;justify-content:space-between;gap:12px}.grb-dat span:first-child{color:var(--ink3)}.grb-dat span:last-child{font-weight:500;text-align:right}.grb-dp{display:flex;justify-content:flex-end;padding:16px 24px;margin-top:16px;background:var(--bg2,#f8f9fb)}
</style>`);
const GRB = {filas: null, mas: false, cargando: false, q: '', miembro: '', equipo: '', dias: 0, error: ''};
const grbVe = () => typeof ALCANCE === 'undefined' || !ALCANCE.on || ALCANCE.todo || (ALCANCE.lidera || []).length > 0;
const grbPestanas = () => grbVe() ? `<div class="grb-tabs" role="tablist"><button type="button" role="tab" data-grb-tab="" aria-selected="${st.llTab !== 'grab'}">Ajustes</button><button type="button" role="tab" data-grb-tab="grab" aria-selected="${st.llTab === 'grab'}">Grabaciones</button></div>` : '';
function grbAvatar(n, id){
  const ini = String(n || '').trim().split(/\s+/).slice(0, 2).map(p => p[0] || '').join('').toUpperCase() || '·', col = ['#2563eb', '#7c3aed', '#0d9488', '#db2777', '#ea580c'][Math.abs(Number(id) || 0) % 5];
  return `<svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true" style="flex:none;display:block"><circle cx="18" cy="18" r="18" fill="${col}"/><text x="18" y="18" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="700" fill="#fff" font-family="Inter,system-ui,sans-serif">${esc(ini)}</text></svg>`;
}
const grbFecha = f => new Date(f).toLocaleString('es-CO', {day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/Bogota'});
function grbCargar(mas){
  if (GRB.cargando) return; GRB.cargando = true;
  const q = new URLSearchParams(); if (GRB.q) q.set('q', GRB.q); if (GRB.miembro) q.set('miembro', GRB.miembro); if (GRB.equipo) q.set('equipo', GRB.equipo); if (GRB.dias) q.set('dias', GRB.dias);
  if (mas && GRB.filas && GRB.filas.length) q.set('antesDe', GRB.filas[GRB.filas.length - 1].fecha);
  crmApi('GET', `/crm/grabaciones?${q}`).then(d => { GRB.filas = mas ? [...(GRB.filas || []), ...d.filas] : d.filas; GRB.mas = d.mas; GRB.error = ''; })
    .catch(err => { GRB.error = err.message; if (!mas) GRB.filas = []; })
    .finally(() => { GRB.cargando = false; if (st.pagina === 'cfg-llamadas' && st.llTab === 'grab') { const foco = document.activeElement && document.activeElement.id; render(); grbObservar(); if (foco === 'grb-q') { const i = document.getElementById('grb-q'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } } } });
}
function grbObservar(){
  const s = document.querySelector('.grb-mas'); if (!s || !('IntersectionObserver' in window)) return;
  const ob = new IntersectionObserver(es => { if (es.some(x => x.isIntersecting)) { ob.disconnect(); grbCargar(true); } }); ob.observe(s);
}
function grbPagina(){
  if (GRB.filas === null) { setTimeout(() => grbCargar(false)); return `<p class="muted" style="margin-top:18px">Cargando las grabaciones…</p>`; }
  const adm = (typeof CRM_YO !== 'undefined' && CRM_YO.rol === 'ADMIN') && !crmSoloLectura(), baja = !crmSoloLectura();
  const filas = GRB.filas.map(g => `<div class="grb-f" data-grb-f="${g.id}"><div class="grb-cli">${grbAvatar(g.cliente, g.convId)}<div style="min-width:0"><b>${esc(g.cliente)}</b><small>${esc(g.miembro)}</small></div></div><span class="grb-mi">${esc(g.miembro)}</span><span class="grb-fe">${esc(grbFecha(g.fecha))}</span><span class="grb-dur">${esc(mmss(g.dur || 0))}</span>
    <div class="grb-acc"><button type="button" data-grb-oir="${g.id}" aria-label="Escuchar la grabación de ${esc(g.cliente)}" title="Escuchar">${I('play')}</button>${baja ? `<button type="button" data-grb-bajar="${g.id}" aria-label="Descargar" title="Descargar">${I('download')}</button>` : ''}${adm ? `<button type="button" class="rojo" data-grb-x="${g.id}" aria-label="Eliminar" title="Eliminar">${I('x')}</button>` : ''}</div></div>`).join('');
  const meses = (typeof LLCFG !== 'undefined' && LLCFG.guardar) || '6 meses';
  return `<div class="grb-bus"><label class="grb-cam">${I('search')}<input id="grb-q" value="${esc(GRB.q)}" placeholder="Buscar por cliente o teléfono" aria-label="Buscar por cliente o teléfono" autocomplete="off"></label>
    <span class="grb-dd grb-fil2">${ddSel('data-grb-miembro', [['', 'Miembro'], ...USUARIOS.map(u => [u.id, u.nombre])], GRB.miembro)}</span><span class="grb-dd grb-fil2">${ddSel('data-grb-equipo', [['', 'Equipo'], ...EQUIPOS.map(e => [e.n, e.n])], GRB.equipo)}</span><span class="grb-dd grb-fil2">${ddSel('data-grb-dias', [['0', 'Fecha'], ['7', 'Últimos 7 días'], ['30', 'Últimos 30 días'], ['90', 'Últimos 90 días']], String(GRB.dias))}</span></div>
    ${GRB.error ? `<div class="ll-nota" style="margin-top:14px">${esc(GRB.error)}</div>` : ''}
    ${GRB.filas.length ? `<div class="grb-lista"><div class="grb-cab"><span>Cliente</span><span>Miembro</span><span>Fecha</span><span>Duración</span><span></span></div>${filas}</div>${GRB.mas ? '<div class="grb-mas"></div>' : ''}` : `<div class="vacio" style="margin-top:16px">${I('mic')}<b>No hay grabaciones</b><p>Aquí quedan las llamadas de quienes autorizaron.</p></div>`}
    <p class="grb-pie">Solo se guardan las llamadas de quienes autorizaron. Se borran solas al cumplir ${esc(meses)}, como está configurado en Ajustes.</p>`;
}
let grbTecleo = null;
document.getElementById('page').addEventListener('input', e => { if (e.target.id !== 'grb-q') return; GRB.q = e.target.value; clearTimeout(grbTecleo); grbTecleo = setTimeout(() => grbCargar(false), 300); });
document.getElementById('page').addEventListener('click', e => {
  const fm = e.target.closest('[data-grb-miembro]'), fe = e.target.closest('[data-grb-equipo]'), fd = e.target.closest('[data-grb-dias]');
  if (fm) { GRB.miembro = fm.dataset.grbMiembro; grbCargar(false); return; }
  if (fe) { GRB.equipo = fe.dataset.grbEquipo; grbCargar(false); return; }
  if (fd) { GRB.dias = Number(fd.dataset.grbDias); grbCargar(false); return; }
  const t = e.target.closest('[data-grb-tab]'); if (t) { st.llTab = t.dataset.grbTab; render(); if (st.llTab === 'grab') grbObservar(); return; }
  const oir = e.target.closest('[data-grb-oir]');
  if (oir) {
    const g = (GRB.filas || []).find(x => String(x.id) === oir.dataset.grbOir); if (!g) return;
    abrirDialogo(`<div class="grb-dh">${grbAvatar(g.cliente, g.convId)}<div><h3>${esc(g.cliente)}</h3><p>Grabación de la llamada</p></div></div><audio id="grb-a" controls preload="none"></audio>
      <div class="grb-dat"><div><span>Miembro</span><span>${esc(g.miembro || 'Sin dato')}</span></div><div><span>Fecha</span><span>${esc(grbFecha(g.fecha))}</span></div><div><span>Llamada</span><span>${g.dir === 'in' ? 'Entrante' : 'Saliente'}</span></div></div>
      ${crmSoloLectura() ? '<div style="height:20px"></div>' : `<div class="grb-dp"><button type="button" class="btn" data-grb-bajar="${g.id}">${I('download')}Descargar</button></div>`}`, 'grb-dlg');
    crmApi('GET', `/crm/grabaciones/${g.id}/url`).then(d => { const a = document.getElementById('grb-a'); if (a) { a.src = d.url; a.play().catch(() => {}); } }).catch(err => toast(err.message));
    return;
  }
  const x = e.target.closest('[data-grb-x]');
  if (x) {
    const id = x.dataset.grbX, g = (GRB.filas || []).find(z => String(z.id) === id); if (!g) return;
    abrirDialogo(`<h3>¿Eliminar esta grabación?</h3><p>Se borra para siempre la grabación de ${esc(g.cliente)}. El registro de la llamada sigue en el chat.</p><div class="row" style="justify-content:flex-end;gap:8px;margin-top:14px"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" data-grb-ok="${esc(id)}">Eliminar</button></div>`);
  }
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-grb-bajar]');
  if (b) { crmApi('GET', `/crm/grabaciones/${b.dataset.grbBajar}/url?descargar=1`).then(d => { location.href = d.url; }).catch(err => toast(err.message)); return; }
  const ok = e.target.closest('[data-grb-ok]'); if (!ok) return;
  const id = ok.dataset.grbOk; ok.disabled = true;
  crmApi('DELETE', `/crm/grabaciones/${id}`).then(() => {
    cerrarDialogo();
    const f = document.querySelector(`[data-grb-f="${id}"]`); if (f) f.classList.add('sale');
    setTimeout(() => { GRB.filas = (GRB.filas || []).filter(z => String(z.id) !== id); if (st.pagina === 'cfg-llamadas') render(); toast('Grabación eliminada'); }, 380);
  }).catch(err => { ok.disabled = false; toast(err.message); });
});
