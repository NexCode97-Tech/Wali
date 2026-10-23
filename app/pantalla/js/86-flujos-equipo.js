/* ── Flujos por equipo (maqueta aprobada «FlujosEquipo») ──
   La lista: cada flujo dice sus equipos, cuándo corre y por dónde (cada línea y cuenta con el logo de su canal), con
   el filtro «Equipo» y el menú de tres puntos (Editar, Eliminar). Por dentro es el editor de 10-nucleo.js con
   «Equipos donde corre», «Por dónde corre» (cada número y cada cuenta por separado, con su equipo) y la prueba en el
   iPhone. En el servidor (flujos.ts) un flujo corre solo en conversaciones de sus equipos (`equipos`; sin el campo,
   todos) y de sus líneas o cuentas (`vias`; sin el campo, los canales de antes). */

st.flEq = st.flEq || '';
st.flMenu = null;
const FL_CANAL_N = {wa: 'WhatsApp', ig: 'Instagram', fb: 'Messenger', tg: 'Telegram', tt: 'TikTok', web: 'Chat de la web'};
const FL_LOGO = {wa: () => LOGO.wa, ig: () => LOGO.ig, fb: () => LOGO.msg, tg: () => LOGO.tg, tt: () => LOGO.tt, web: () => I('chat')};
const flLogo = (k, cls = 'mc') => `<span class="${cls} ${k}">${FL_LOGO[k] ? FL_LOGO[k]() : ''}</span>`;
// El equipo que atiende cada canal por conexión (Ajustes del CRM, página de cada canal); el mismo que usa el servidor.
const flEqCanal = k => (k === 'ig' || k === 'fb' ? (CFG.meta || {})[k + 'Eq'] : ((CFG[{tg: 'telegram', tt: 'tiktok'}[k] || k] || {}).eq)) || 'Ventas';
/* Cada número y cada cuenta conectada: {id, canal, n, det, eq}. El id es el que guarda el flujo en `vias`. */
function flVias(){
  const out = LINEAS.map(l => ({id: 'wa:' + l.id, canal: 'wa', n: l.n, det: l.tel || '', eq: tpEquipo(l.id) || 'Ventas'}));
  for (const c of CX_CANALES) if (['ig', 'fb', 'tg', 'tt'].includes(c.canal)) out.push({id: 'cx:' + c.id, canal: c.canal, n: c.nombre, det: {ig: 'Cuenta profesional', fb: 'Página de Facebook', tg: 'Bot de Telegram', tt: 'Cuenta de TikTok'}[c.canal], eq: flEqCanal(c.canal)});
  if (canalConectado('web')) out.push({id: 'web', canal: 'web', n: 'Burbuja de tu sitio web', det: 'Chat de la web', eq: ((CFG.web || {}).eq) || 'Ventas'});
  return out;
}
// Por dónde corre: lo guardado o, en los flujos de antes, todas las líneas y cuentas de sus canales.
const flViasDe = f => { const t = flVias(); return Array.isArray(f.vias) ? t.filter(v => f.vias.includes(v.id)) : t.filter(v => (f.canales || ['wa']).includes(v.canal)); };
const flEquiposDe = f => Array.isArray(f.equipos) && f.equipos.length ? f.equipos.filter(n => EQUIPOS.some(e => e.n === n)) : [];
const flChipEq = n => `<span class="eqc"><i style="background:${colorEquipo(n)}"></i>${esc(n)}</span>`;

function flLista(){
  if (st.flEq && !EQUIPOS.some(e => e.n === st.flEq)) st.flEq = '';
  const lista = FLUJOS.filter(f => !st.flEq || !flEquiposDe(f).length || flEquiposDe(f).includes(st.flEq));
  const fila = x => {
    const eqs = flEquiposDe(x), vs = flViasDe(x), ab = st.flMenu === x.id;
    return `<div class="flujo"><div class="rh">${I('flow')}<b style="cursor:pointer" data-fl-abrir="${esc(x.id)}">${esc(x.n)}</b><span class="pill">${x.pasos.length} ${x.pasos.length === 1 ? 'paso' : 'pasos'}</span>
      <button type="button" class="tg" role="switch" data-fl-on="${esc(x.id)}" aria-checked="${x.on}" aria-label="Activar ${esc(x.n)}"></button>
      <div class="tp-acc"><button type="button" class="tp-mas" data-fl-menu="${esc(x.id)}" aria-haspopup="menu" aria-expanded="${ab}" aria-label="Más acciones de ${esc(x.n)}">${I('more')}</button>
        <div class="tp-menu" role="menu" ${ab ? '' : 'hidden'}><button type="button" role="menuitem" data-fl-abrir="${esc(x.id)}">${TP_IC.editar}Editar</button><button type="button" role="menuitem" class="tp-peligro" data-fl-borrar="${esc(x.id)}">${TP_IC.borrar}Eliminar</button></div></div></div>
      <div class="rs"><span class="k">Equipos</span>${eqs.length ? eqs.map(flChipEq).join('') : '<span class="v">Todos</span>'}<span class="k">Cuándo</span><span class="v">${esc(x.cuando)}</span>
        <span class="k">Por dónde</span>${vs.length ? vs.map(v => `<span class="cv">${flLogo(v.canal)}${esc(v.n)}</span>`).join('') : '<span class="v">Ninguna línea ni cuenta</span>'}</div></div>`;
  };
  return `<div class="ajw ancho"><button type="button" class="volver" data-ir="ajustes-crm">${I('back')}Ajustes del CRM</button>
    <div class="pg-h"><div><h2>Flujos</h2><p class="sub">Lo que pasa antes de que el lead llegue al asesor: saludar, preguntar su nombre, mostrar opciones y pasarlo al reparto. Así el asesor lo recibe ya con su nombre.</p></div>
      <div class="fl-cab-acc">${EQUIPOS.length > 1 ? ddSel('data-fl-eq', [['', 'Equipo: Todos'], ...EQUIPOS.map(e => [e.n, 'Equipo: ' + e.n])], st.flEq).replace('class="dd dsel"', 'class="dd dsel fl-eqf"') : ''}<button type="button" class="btn pri" data-fl-nuevo="1">${I('plus')}Nuevo flujo</button></div></div>
    <div style="display:grid;gap:10px">${lista.map(fila).join('') || '<p class="muted">Ningún flujo de este equipo todavía.</p>'}</div>
    <p class="muted" style="margin-top:12px">En cada equipo corre uno a la vez: si hay dos activos con el mismo «Cuándo» para el mismo equipo, gana el de arriba.</p></div>`;
}

function flPorDonde(f){
  const todas = flVias(), elegidas = new Set(flViasDe(f).map(v => v.id)), eqs = flEquiposDe(f);
  const grupos = ['wa', 'ig', 'fb', 'tg', 'tt', 'web'].map(k => [k, todas.filter(v => v.canal === k)]).filter(([, l]) => l.length);
  const tarjeta = v => `<button type="button" class="pd" role="checkbox" aria-checked="${elegidas.has(v.id)}" data-fl-via="${esc(v.id)}">${flLogo(v.canal, 'mcb')}<span class="pdt"><b>${esc(v.n)}</b><small>${esc(v.det)}</small></span><span class="pde"><i style="background:${colorEquipo(v.eq)}"></i>${esc(v.eq)}</span><span class="pdc">${I('check')}</span></button>`;
  const grupo = ([k, l]) => { const n = l.filter(v => elegidas.has(v.id)).length; return `<div class="pdg"><div class="pdh">${flLogo(k)}<b>${FL_CANAL_N[k]}</b><span>${n} de ${l.length}</span><button type="button" class="pdtodas" data-fl-todas="${k}">${n === l.length ? 'Quitar todas' : 'Elegir todas'}</button></div><div class="pdl">${l.map(tarjeta).join('')}</div></div>`; };
  const quien = eqs.length ? eqs.join(', ') : 'cualquier equipo';
  return `<div class="fld fl-eqs">Equipos donde corre<div class="chips2">${EQUIPOS.map(e => `<button type="button" data-fl-equipo="${esc(e.n)}" aria-pressed="${eqs.includes(e.n)}"><i style="background:${colorEquipo(e.n)}"></i>${esc(e.n)}</button>`).join('')}</div>
      <span class="fl-ayuda">Las conversaciones nuevas llegan al equipo de su línea o de su canal. ${eqs.length ? `Este flujo solo corre en las de ${esc(quien)}.` : 'Sin ninguno elegido, corre en todos los equipos.'}</span></div>
    <div class="fld pdw"><div class="pdtop"><span>Por dónde corre</span><em>${elegidas.size} de ${todas.length} ${todas.length === 1 ? 'elegida' : 'elegidas'}</em></div>
      ${grupos.length ? grupos.map(grupo).join('') : '<span class="fl-ayuda">Todavía no hay líneas ni cuentas conectadas. Conéctalas en Ajustes del CRM.</span>'}
      <span class="fl-ayuda">Cada número y cada cuenta conectada en Ajustes del CRM sale aquí con su equipo. Si eliges una de otro equipo, el flujo corre allá cuando la conversación sea de ${esc(quien)}.</span></div>`;
}
// El teléfono de la prueba: el mismo iPhone del formulario de plantillas.
function flIphone(chat){
  const marca = (ESPACIO.nombre || 'Tu empresa').trim(), ini = marca.charAt(0).toUpperCase();
  return `<div class="tn-tel fl-tel" aria-label="Así lo vive el cliente"><div class="tn-pant"><span class="tn-isla"></span>
    <div class="tn-estado"><span>9:41</span><span class="der"><svg viewBox="0 0 18 12" aria-hidden="true"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg><svg viewBox="0 0 16 12" aria-hidden="true"><path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0Z"/><path d="M3.4 6.8a6.5 6.5 0 0 1 9.2 0l-1.2 1.2a4.8 4.8 0 0 0-6.8 0Z"/><path d="M1.1 4.5a9.8 9.8 0 0 1 13.8 0l-1.2 1.2a8.1 8.1 0 0 0-11.4 0Z"/></svg><svg viewBox="0 0 27 12" aria-hidden="true"><rect x=".5" y=".5" width="22" height="11" rx="3.5" fill="none" stroke="#000" stroke-opacity=".4"/><rect x="2" y="2" width="17" height="8" rx="2"/><path d="M24.5 4v4a2 2 0 0 0 0-4Z" fill-opacity=".4"/></svg></span></div>
    <div class="tn-wcab"><span class="atras">${I('back')}</span><span class="ava">${esc(ini)}</span><span class="q"><b>${esc(marca)}<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#25D366" d="M12 1.5 14.6 4l3.5-.4.9 3.4 3.1 1.7-1.3 3.3 1.3 3.3-3.1 1.7-.9 3.4-3.5-.4L12 22.5 9.4 20l-3.5.4-.9-3.4-3.1-1.7L3.2 12 1.9 8.7 5 7l.9-3.4 3.5.4Z"/><path d="m8 12 3 3 5-6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></b><small>Cuenta de empresa</small></span><span class="ic">${TP_IC.video}${TP_IC.llamar}</span></div>
    <div class="tn-fondo fl-fondo"><div class="chatp" id="fl-chat">${chat}</div></div>
    <div class="tn-escribir">${I('plus')}<span class="campo2"></span><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4Z"/><circle cx="12" cy="13" r="3.5"/></svg>${I('mic')}</div>
    <span class="tn-barrita"></span></div></div>`;
}

const flPaginaBase = paginaFlujos;
paginaFlujos = function(){
  const f = FLUJOS.find(x => x.id === st.flujo);
  if (!f) return flLista();
  let html = flPaginaBase();
  // «Canales» pasa a «Equipos donde corre» y «Por dónde corre».
  html = html.replace(/<div class="fld">Canales<div class="chips2">[\s\S]*?<\/div><\/div>/, () => flPorDonde(f));
  // La prueba va en el iPhone; el botón queda abajo, separado del teléfono.
  html = html.replace(/<div class="phone"><div class="hd">([^<]*)<\/div><div class="chatp" id="fl-chat">([\s\S]*?)<\/div><\/div>\s*<button type="button" class="btn ([^"]*)" data-fl-probar="1">/, (m, hd, chat, cls) =>
    `<span class="fl-asi">${hd}</span>${flIphone(chat)}<button type="button" class="btn ${cls} fl-probar" data-fl-probar="1">`);
  const eqs = flEquiposDe(f);
  html = html.replace(/(<p class="sub">)(Activo|Apagado)( · \d+ pasos)(<\/p>)/, (m, a, b, c, d) => `${a}${b}${c}${eqs.length ? ' · ' + esc(eqs.join(', ')) : ''}${d}`);
  return html;
};
document.getElementById('page').addEventListener('click', e => {
  if (st.pagina !== 'flujos') return;
  const t = e.target;
  const mn = t.closest('[data-fl-menu]'); if (mn) { e.stopImmediatePropagation(); st.flMenu = st.flMenu === mn.dataset.flMenu ? null : mn.dataset.flMenu; render(); return; }
  const fe = t.closest('[data-fl-eq]'); if (fe) { e.stopImmediatePropagation(); st.flEq = fe.dataset.flEq; render(); return; }
  const br = t.closest('[data-fl-borrar]');
  if (br) {
    e.stopImmediatePropagation(); st.flMenu = null;
    const x = FLUJOS.find(y => y.id === br.dataset.flBorrar); if (!x) return;
    abrirDialogo(`<h3>Eliminar «${esc(x.n)}»</h3><p>El flujo deja de correr y se borra con sus pasos. Las conversaciones que ya pasaron por él no cambian.</p><div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" style="background:#dc2626;border-color:#dc2626;color:#fff" data-fl-borrarok="${esc(x.id)}">${TP_IC.borrar}Eliminar</button></div>`);
    return;
  }
  if (st.flMenu && !t.closest('.tp-menu')) { st.flMenu = null; render(); }
  const f = FLUJOS.find(x => x.id === st.flujo); if (!f) return;
  const eq = t.closest('[data-fl-equipo]');
  if (eq) {
    e.stopImmediatePropagation();
    const n = eq.dataset.flEquipo, a = flEquiposDe(f);
    f.equipos = a.includes(n) ? a.filter(x => x !== n) : [...a, n];
    render(); return;
  }
  const v = t.closest('[data-fl-via]');
  if (v) { e.stopImmediatePropagation(); const s = new Set(flViasDe(f).map(x => x.id)), id = v.dataset.flVia; s.has(id) ? s.delete(id) : s.add(id); flGuardarVias(f, s); render(); return; }
  const td = t.closest('[data-fl-todas]');
  if (td) {
    e.stopImmediatePropagation();
    const k = td.dataset.flTodas, del = flVias().filter(x => x.canal === k), s = new Set(flViasDe(f).map(x => x.id));
    const todas = del.every(x => s.has(x.id)); del.forEach(x => todas ? s.delete(x.id) : s.add(x.id));
    flGuardarVias(f, s); render(); return;
  }
}, true);
// Al elegir por dónde corre, también se guardan sus canales: así un servidor de antes sigue entendiendo el flujo.
function flGuardarVias(f, s){ f.vias = [...s]; f.canales = [...new Set(flVias().filter(x => s.has(x.id)).map(x => x.canal))]; }
document.addEventListener('click', e => {
  const ok = e.target.closest('[data-fl-borrarok]'); if (!ok) return;
  const i = FLUJOS.findIndex(x => x.id === ok.dataset.flBorrarok); if (i < 0) return;
  const [x] = FLUJOS.splice(i, 1); if (st.flujo === x.id) st.flujo = null;
  cerrarDialogo(); crmSincronizar(); render(); toast(`Flujo eliminado: ${x.n}`);
});

document.head.insertAdjacentHTML('beforeend', `<style>
.fl-cab-acc{display:flex;gap:10px;align-items:center;flex:none;margin-left:auto}
.fl-cab-acc .fl-eqf{min-width:170px!important}
.flujo{border:1px solid var(--line);border-radius:14px;background:#fff;padding:14px 16px;display:grid;gap:10px}
.flujo .rh{display:flex;align-items:center;gap:10px}
.flujo .rh > svg{width:18px;height:18px;color:var(--ink3)}
.flujo .rh b{font-size:14.5px;font-weight:600}
.flujo .rh .tg{margin-left:auto}
.flujo .rs{display:flex;flex-wrap:wrap;align-items:center;gap:6px;font-size:12.5px}
.flujo .rs .k{color:var(--ink3);font-weight:500}
.flujo .rs .k + *{margin-left:2px}
.flujo .rs .v + .k,.flujo .rs .eqc + .k,.flujo .rs .cv + .k{margin-left:10px}
.flujo .rs .v{color:var(--ink)}
.eqc{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 9px;border-radius:999px;background:var(--bg3);font-size:12px;font-weight:500;color:var(--ink2);white-space:nowrap}
.eqc i{width:7px;height:7px;border-radius:50%;flex:none}
.cv{display:inline-flex;align-items:center;gap:6px;padding:2px 8px 2px 3px;border-radius:999px;background:var(--bg3);color:var(--ink2);white-space:nowrap}
.mc{width:18px;height:18px;border-radius:5px;display:inline-flex;align-items:center;justify-content:center;flex:none;color:#fff;line-height:0}
.mc svg{width:12px;height:12px;display:block}
.mc.wa,.mcb.wa{background:#25D366}
.mc.wa svg{transform:translate(.3px,-.3px)}
.mc.ig,.mcb.ig{background:linear-gradient(135deg,#feda75,#fa7e1e 35%,#d62976 65%,#962fbf)}
.mc.fb,.mcb.fb{background:radial-gradient(circle at 20% 100%,#0099FF,#A033FF 60%,#FF5280 90%,#FF7061)}
.mc.tg,.mcb.tg{background:none}
.mc.tg svg{width:18px;height:18px}
.mc.tt,.mcb.tt{background:#000}
.mc.web,.mcb.web{background:#0b2a4a}
.fl-eqs .chips2 button{display:inline-flex;align-items:center;gap:7px;height:36px;border-radius:10px;padding:0 12px}
.fl-eqs .chips2 button i{width:8px;height:8px;border-radius:50%;flex:none}
.fl-ayuda{font-size:12.5px;color:var(--ink3);font-weight:400}
.pdw{display:grid;gap:10px}
.pdtop{display:flex;align-items:center;justify-content:space-between}
.pdtop em{font-style:normal;font-size:12px;font-weight:600;color:var(--ink3)}
.pdg{border:1px solid var(--line);border-radius:12px;background:var(--bg2);padding:10px;display:grid;gap:8px}
.pdh{display:flex;align-items:center;gap:8px;padding:0 4px;font-size:12.5px;color:var(--ink3)}
.pdh b{font-size:13px;font-weight:600;color:var(--ink)}
.pdh .pdtodas{margin-left:auto;border:0;background:none;padding:0;font:inherit;font-size:12px;font-weight:600;color:var(--ink2);text-decoration:underline;text-underline-offset:2px;cursor:pointer}
.pdl{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.pd{display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:#fff;text-align:left;min-width:0;font:inherit;color:inherit;cursor:pointer}
.pd[aria-checked="true"]{border-color:#0b0b10;box-shadow:inset 0 0 0 1px #0b0b10}
.mcb{width:32px;height:32px;border-radius:9px;display:inline-flex;align-items:center;justify-content:center;flex:none;color:#fff;line-height:0}
.mcb svg{width:18px;height:18px;display:block}
.mcb.tg svg{width:32px;height:32px}
.pdt{flex:1;min-width:0}
.pdt b{display:block;font-size:13px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pdt small{display:block;font-size:12px;color:var(--ink3);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pde{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;font-weight:500;color:var(--ink2);background:var(--bg3);border-radius:999px;padding:2px 8px;white-space:nowrap}
.pde i{width:7px;height:7px;border-radius:50%}
.pdc{width:20px;height:20px;border-radius:6px;border:2px solid var(--ink4);display:flex;align-items:center;justify-content:center;flex:none;color:transparent;box-sizing:border-box}
.pd[aria-checked="true"] .pdc{background:#0b0b10;border-color:#0b0b10;color:#fff}
.pdc svg{width:12px;height:12px;stroke-width:3}
.flw:has(.fl-tel){grid-template-columns:minmax(0,1fr) 430px}
.fprev:has(.fl-tel){justify-items:center;gap:10px}
.fprev .fl-asi{font-size:12.5px;color:var(--ink3);text-align:center}
.fl-tel{position:relative;top:auto}
.fl-fondo{padding:12px 10px}
.fl-fondo .chatp{max-height:none;overflow-y:auto;height:100%;padding:2px}
.fl-fondo .bb{font-size:15px;line-height:1.35;padding:7px 9px;border-radius:0 10px 10px 10px;color:#111b21;box-shadow:0 1px .5px rgba(11,20,26,.13)}
.fl-fondo .bb.yo{border-radius:10px 0 10px 10px}
.fl-fondo .bb.ev{font-size:12px;color:#54656f;background:#fff;border-radius:8px;box-shadow:0 1px .5px rgba(11,20,26,.13)}
.fl-fondo .opsb button{font-size:14px;color:#027eb5;border-radius:10px;padding:9px}
.paso .ph .acc [data-fl-del]{color:#dc2626}
.fprev .fl-probar{width:420px;justify-content:center;margin-top:18px}
@media (max-width:1180px){.flw:has(.fl-tel){grid-template-columns:1fr}}
@media (max-width:760px){.pdl{grid-template-columns:1fr}.fl-tel{transform:scale(.8);transform-origin:top center;margin-bottom:-180px}.fprev .fl-probar{width:100%}.fl-cab-acc{margin-left:0;flex-wrap:wrap}}
</style>`);
