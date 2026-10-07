/* ── Espacios de trabajo (maqueta aprobada el 6-oct, «Espacios de trabajo»): el selector debajo de «Conversación
   nueva», la página Ajustes del CRM › Espacios de trabajo y el diálogo para crear uno. Cada espacio es una empresa con
   su CRM aparte; el plan es de la cuenta (Starter 1, Growth 3, Business 6). API: GET/POST /crm/espacios y
   POST /crm/espacios/:id/entrar (services/crm/espacios.ts). ── */
const ESP = {lista:null, limite:null, puedeCrear:false, cargando:false, error:'', filtro:'todos', q:'', plan:'prueba', yo:true};
const ESP_EST = {interno:['Interno', 'mt-int'], activo:['Activo', 'on'], prueba:['Prueba', 'mt-pru'], 'pago-pendiente':['Pago pendiente', 'mt-mal'], cancelado:['Cancelado', 'mt-mal'], vencido:['Vencido', 'mt-mal']};
const espIni = n => String(n || '').trim().split(/\s+/).slice(0, 2).map(p => p[0] || '').join('').toUpperCase() || 'E';
const espFecha = iso => { try { return 'Creado el ' + fechaCorta(iso); } catch { return ''; } };
document.head.insertAdjacentHTML('beforeend', `<style>
.ig-est.mt-int{color:#3730a3;background:#eef2ff}
.ig-est.mt-pru{color:#92400e;background:#fef3c7}
.ig-est.mt-mal{color:#991b1b;background:#fee2e2}
.me-logo{width:48px;height:48px;border-radius:12px;display:grid;place-items:center;font-weight:700;font-size:14px;flex:none;background:#FFD21F;color:#0b0b10}
.me-num{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0}
.me-num div{display:flex;flex-direction:column;gap:2px}
.me-num dt{font-size:12px;color:#6b7280}
.me-num dd{margin:0;font-size:15px;font-weight:600;color:var(--ink);font-variant-numeric:tabular-nums}
.me-aviso{margin:0;padding:9px 12px;border-radius:10px;background:#fffbeb;border:1px solid #fde68a;color:#92400e;font-size:12.5px;line-height:1.45}
.me-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:18px}
#app .me-bar .tabs{display:inline-flex;gap:4px}
#app .me-bar .tabs button{flex:none;white-space:nowrap;height:34px;padding:0 14px;gap:8px;display:inline-flex;align-items:center}
#app .me-bar .tabs button .n{margin-left:0}
.me-bar .cn-q{flex:1 1 260px;max-width:360px;margin:0}
.me-plan{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.me-plan .cx-op{align-items:flex-start}
.me-plan .cx-op small{display:block}
.me-chk{display:flex;align-items:center;gap:10px;font-size:13px;color:#374151;font-weight:400 !important;flex-direction:row !important}
.me-chk input{width:18px !important;height:18px !important;accent-color:#0b0b10}
.me-wrap{position:relative;margin:2px 0 4px}
#app .nav .me-sw{display:flex;align-items:center;gap:10px;width:100%;height:44px;padding:0 10px;border-radius:12px;border:1px solid var(--nx-negro-3);background:var(--nx-negro-2);color:#fff;font:inherit;text-align:left;cursor:pointer}
#app .nav .me-sw:hover{border-color:#3a3a46}
#app .nav .me-sw[aria-expanded="true"]{border-color:var(--nx-amarillo);box-shadow:0 0 0 3px rgba(255,210,31,.25)}
.me-mini{width:26px;height:26px;border-radius:7px;display:grid;place-items:center;font-size:10.5px;font-weight:700;flex:none;background:#FFD21F;color:#0b0b10}
.me-sw .me-tx{display:flex;flex-direction:column;flex:1;min-width:0;line-height:1.2}
.me-sw .me-tx small{font-size:11px;color:var(--nx-mut)}
.me-sw .me-tx b{font-size:13.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.me-sw > svg{width:15px;height:15px;color:var(--nx-mut);flex:none}
.me-wrap .me-menu{top:calc(100% + 6px);left:0;right:0;min-width:0}
.me-menu button{white-space:nowrap;display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;border:0;background:none;border-radius:8px;font:inherit;font-size:13.5px;color:var(--ink);text-align:left;cursor:pointer}
.me-menu button:hover{background:#f3f4f6}
.me-menu .me-mini{width:24px;height:24px;font-size:10px}
.me-menu hr{border:0;border-top:1px solid var(--line);margin:4px 0}
</style>`);

function espCargar(){
  if (ESP.cargando) return; ESP.cargando = true;
  crmApi('GET', '/crm/espacios')
    .then(r => { ESP.lista = Array.isArray(r && r.espacios) ? r.espacios : []; ESP.limite = r ? r.limite : null; ESP.puedeCrear = !!(r && r.puedeCrear); ESP.error = ''; })
    .catch(err => { ESP.error = err.message || 'el servidor no contestó'; })
    .finally(() => { ESP.cargando = false; espSelector(); if (st.pagina === 'cfg-espacios') render(); });
}
const espActual = () => (ESP.lista || []).find(e => e.actual) || {n: ESPACIO.nombre || 'CRM'};
function espAviso(e){
  if (e.estado === 'pago-pendiente') return 'El último cobro no pasó. Creem lo reintenta en unos días.';
  if (!e.lineas) return 'Todavía no conecta su línea de WhatsApp.';
  return '';
}
function espTarjeta(e){
  const [t, c] = ESP_EST[e.estado] || [e.estado, 'off'], aviso = espAviso(e);
  return `<article class="ig-c"><div class="ig-cab"><span class="me-logo">${esc(espIni(e.n))}</span><span class="ig-nom"><b>${esc(e.n)}</b><small>${esc([e.admin, e.correo].filter(Boolean).join(' · ') || 'Sin administrador')}</small></span><span class="ig-est ${c}">${esc(t)}${e.dias ? ' · ' + e.dias + ' días' : ''}</span></div>
    <dl class="me-num"><div><dt>Plan</dt><dd>${esc(PL_NOMBRE[e.plan] || e.plan)}</dd></div><div><dt>Personas</dt><dd>${e.personas}</dd></div><div><dt>Líneas</dt><dd>${e.lineas}</dd></div><div><dt>Chats</dt><dd>${e.chats}</dd></div></dl>
    ${aviso ? `<p class="me-aviso">${esc(aviso)}</p>` : ''}
    <div class="ig-pie"><span class="sp">${esc(e.principal ? 'Espacio principal' : espFecha(e.desde))}</span>${e.actual ? '<span class="ig-est on">Estás aquí</span>' : `<button type="button" class="btn" data-me-ajustes="${esc(e.id)}">${I('cog')}Ajustes</button><button type="button" class="btn pri" data-me-entrar="${esc(e.id)}">Entrar</button>`}</div></article>`;
}
function paginaEspacios(){
  if (!ESP.lista && !ESP.cargando && !ESP.error) setTimeout(espCargar);
  const volver = `<button type="button" class="volver" data-ir="ajustes-crm">${I('back')}Ajustes del CRM</button>`;
  const cab = `<div class="pg-h"><div><h2>Espacios de trabajo</h2><p class="sub ig-sub">Cada empresa tiene su propio CRM: sus líneas de WhatsApp, equipos, conversaciones, motor de IA y plan. Nada se mezcla entre espacios.</p></div>${ESP.puedeCrear ? `<button type="button" class="btn pri" data-me-crear="1">${I('plus')}Crear espacio de trabajo</button>` : ''}</div>`;
  if (!ESP.lista) return `<div class="ajw ancho">${volver}${cab}<p class="muted">${ESP.error ? `No se pudo cargar: ${esc(ESP.error)}` : 'Cargando…'}</p></div>`;
  const grupo = e => e.estado === 'interno' ? 'activo' : ['pago-pendiente', 'cancelado', 'vencido'].includes(e.estado) ? 'pendiente' : e.estado;
  const q = ESP.q.trim().toLowerCase();
  const cumple = (e, k) => (k === 'todos' || grupo(e) === k) && (!q || [e.n, e.admin, e.correo].some(v => String(v || '').toLowerCase().includes(q)));
  const tabs = [['todos', 'Todos'], ['activo', 'Activos'], ['prueba', 'En prueba'], ['pendiente', 'Con problemas']];
  const lista = ESP.lista.filter(e => cumple(e, ESP.filtro));
  return `<div class="ajw ancho">${volver}${cab}
    <div class="me-bar"><label class="cn-q">${I('search')}<input id="me-q" value="${esc(ESP.q)}" placeholder="Buscar empresa o administrador" aria-label="Buscar espacio" autocomplete="off"></label>
      <div class="tabs" style="margin:0">${tabs.map(([k, t]) => `<button type="button" data-me-filtro="${k}" aria-pressed="${ESP.filtro === k}">${t}<span class="n">${ESP.lista.filter(e => cumple(e, k)).length}</span></button>`).join('')}</div></div>
    <section class="ig-sec"><h4>Empresas <span class="ig-n">${lista.length}</span></h4><div class="ig-lista">${lista.map(espTarjeta).join('')}</div></section></div>`;
}
const paginaCfgEsp = paginaCfg;
paginaCfg = function(k){ return k === 'espacios' ? paginaEspacios() : paginaCfgEsp(k); };

function dlgCrearEspacio(){
  const lleno = ESP.limite !== null && (ESP.lista || []).length >= ESP.limite;
  return `<h3>Crear espacio de trabajo</h3><p>La empresa arranca con su CRM vacío, sin etapas, etiquetas ni reglas de ejemplo. Su administrador recibe un correo para crear su contraseña y entrar.</p>
    ${lleno ? `<div class="mt-aviso">${I('lock')}<span>Tu plan incluye ${ESP.limite} ${ESP.limite === 1 ? 'espacio' : 'espacios'} de trabajo y ya están en uso. Sube de plan para crear más.</span><button type="button" class="btn" data-ir="cfg-plan" data-cerrar-dlg="1">Ver planes</button></div>` : ''}
    <div class="cx-f"><label>Nombre de la empresa<input id="me-n" placeholder="Ej. Clínica Sonrisa" autocomplete="off"></label></div>
    <div class="fld">Administrador de la empresa<div class="cx-f" style="margin:6px 0 0"><label>Nombre completo<input id="me-an" placeholder="Nombre y apellido" autocomplete="off"></label><label>Correo<input id="me-ac" type="email" placeholder="nombre@empresa.com" autocomplete="off"><small>Le llega la invitación a este correo.</small></label></div></div>
    <label class="me-chk"><input type="checkbox" ${ESP.yo ? 'checked' : ''} id="me-yo">Quedar yo también como administrador, para darle soporte</label>
    <div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" data-me-ok="1"${lleno ? ' disabled' : ''}>${I('check')}Crear y enviar invitación</button></div>`;
}

/* El selector, debajo de «Conversación nueva». */
function espSelector(){
  const top = document.querySelector('#app .nav .topbar'); if (!top) return;
  const e0 = espActual(), viejo = document.querySelector('.me-wrap'), abierto = viejo && !viejo.querySelector('.me-menu').hidden;
  const menu = `${(ESP.lista || []).map(e => `<button type="button" data-me-entrar="${esc(e.id)}"><span class="me-mini">${esc(espIni(e.n))}</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">${esc(e.n)}</span>${e.actual ? I('check', 'i') : ''}</button>`).join('')}<hr><button type="button" data-me-todos="1">${I('cog')}Todos los espacios</button>${ESP.puedeCrear ? `<button type="button" data-me-crear="1">${I('plus')}Crear espacio</button>` : ''}`;
  const html = `<div class="me-wrap"><button type="button" class="me-sw" aria-haspopup="menu" aria-expanded="${!!abierto}" aria-label="Cambiar de espacio de trabajo"><span class="me-mini">${esc(espIni(e0.n))}</span><span class="me-tx"><small>Espacio de trabajo</small><b>${esc(e0.n)}</b></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/></svg></button><div class="menu me-menu"${abierto ? '' : ' hidden'}>${menu}</div></div>`;
  if (viejo) viejo.remove();
  top.insertAdjacentHTML('afterend', html);
}
const navSinEsp = nav;
nav = function(){ navSinEsp.apply(this, arguments); if (!document.querySelector('.me-wrap')) espSelector(); if (!ESP.lista && !ESP.cargando && !ESP.error) setTimeout(espCargar); };

function espEntrar(id, luego){
  const e = (ESP.lista || []).find(x => x.id === id); if (!e || e.actual) return;
  toast(`Entrando a ${e.n}…`);
  crmApi('POST', `/crm/espacios/${encodeURIComponent(id)}/entrar`)
    .then(() => { try { if (luego) sessionStorage.setItem('crm-tras-entrar', luego); } catch { /* sin almacenamiento */ } location.reload(); })
    .catch(err => toast(err.message || 'No se pudo cambiar de espacio'));
}
// Después de «Ajustes» en la tarjeta de otro espacio: al recargar, se abren los Ajustes del CRM de ese espacio.
try { if (sessionStorage.getItem('crm-tras-entrar') === 'ajustes') { sessionStorage.removeItem('crm-tras-entrar'); setTimeout(() => { st.pagina = 'ajustes'; st.ajTab = 'crm'; render(); }, 1500); } } catch { /* sin almacenamiento */ }

document.addEventListener('click', e => {
  const t = e.target;
  const sw = t.closest('.me-sw'); if (sw) { const m = sw.nextElementSibling; m.hidden = !m.hidden; sw.setAttribute('aria-expanded', String(!m.hidden)); return; }
  if (!t.closest('.me-menu')) document.querySelectorAll('.me-menu').forEach(m => { m.hidden = true; const b = m.previousElementSibling; if (b) b.setAttribute('aria-expanded', 'false'); });
  const f = t.closest('[data-me-filtro]'); if (f) { ESP.filtro = f.dataset.meFiltro; render(); return; }
  if (t.closest('[data-me-crear]')) { document.querySelectorAll('.me-menu').forEach(m => { m.hidden = true; }); abrirDialogo(dlgCrearEspacio(), 'dlg-per'); setTimeout(() => { const x = document.getElementById('me-n'); if (x) x.focus(); }, 30); return; }
  if (t.closest('[data-me-todos]')) { document.querySelectorAll('.me-menu').forEach(m => { m.hidden = true; }); st.pagina = 'cfg-espacios'; render(); document.getElementById('app').classList.remove('open'); return; }
  const en = t.closest('[data-me-entrar]'); if (en) { espEntrar(en.dataset.meEntrar); return; }
  const aj = t.closest('[data-me-ajustes]'); if (aj) { espEntrar(aj.dataset.meAjustes, 'ajustes'); return; }
  const ok = t.closest('[data-me-ok]'); if (ok && !ok.disabled) {
    const v = id => ((document.getElementById(id) || {}).value || '').trim();
    const yoMarca = !!(document.getElementById('me-yo') || {}).checked;
    if (v('me-n').length < 2) { toast('Escribe el nombre de la empresa'); return; }
    if (!v('me-ac') && !yoMarca) { toast('Invita a su administrador o quédate tú como administrador'); return; }
    ok.disabled = true; ok.textContent = 'Creando…';
    crmApi('POST', '/crm/espacios', {nombre: v('me-n'), adminNombre: v('me-an'), adminCorreo: v('me-ac'), yo: yoMarca})
      .then(() => { cerrarDialogo(); toast(v('me-ac') ? 'Espacio creado. Le enviamos la invitación al administrador.' : 'Espacio creado.'); ESP.lista = null; espCargar(); })
      .catch(err => { ok.disabled = false; ok.textContent = ''; ok.insertAdjacentHTML('beforeend', `${I('check')}Crear y enviar invitación`); toast(err.message || 'No se pudo crear el espacio'); });
    return;
  }
}, true);
document.addEventListener('input', e => { if (e.target.id === 'me-q') { ESP.q = e.target.value; const pos = e.target.selectionStart; render(); const q = document.getElementById('me-q'); if (q) { q.focus(); q.setSelectionRange(pos, pos); } } });
