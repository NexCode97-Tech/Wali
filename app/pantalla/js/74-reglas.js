/* ── Reglas automáticas (maqueta aprobada el 6-oct, «Reglas automáticas»): cada regla se ve como un flujo
   Cuando → Si → Entonces, y crear o editar abre el mapa de la automatización (los pasos en vertical, unidos con
   líneas, y el panel para editar el paso elegido). Sin reglas salen ideas para empezar. Las reglas siguen en REGLAS
   con su forma de siempre ({n, on, cuando, si:[texto], ent:[texto]}): el texto es el que entiende services/crm/reglas.ts
   y 80-datos.js lo guarda como antes. ── */
const RG = {filtro: 'todas', mapa: null};
const RG_IC = {'Llega un mensaje nuevo':'chat', 'Se asigna una conversación':'users', 'Cambia la etapa':'flow', 'Se confirma un pago':'cart', 'Pasan 48 horas sin respuesta del cliente':'clock', 'Se finaliza la conversación':'check'};
const RG_IDEAS = [
  {ic:'cart', n:'Pago confirmado', d:'Cuando se confirma un pago, cambia la etapa a Pagado y avisa al líder.', r:{cuando:'Se confirma un pago', si:[], ent:[['Avisar al líder', '']]}},
  {ic:'clock', n:'Retomar a quien no responde', d:'A las 48 horas sin respuesta, crea un recordatorio para el asesor.', r:{cuando:'Pasan 48 horas sin respuesta del cliente', si:[], ent:[['Crear recordatorio para el asesor', '']]}},
  {ic:'bot', n:'El agente IA atiende de noche', d:'Fuera del horario de atención, responde el agente IA y deja un resumen.', r:{cuando:'Llega un mensaje nuevo', si:[['Fuera del horario de atención', '']], ent:[['El agente IA responde', ''], ['Dejar resumen en nota privada', '']]}},
];
const RG_FLECHA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>';
document.head.insertAdjacentHTML('beforeend', `<style>
.mr-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin:4px 0 16px}
#app .mr-bar .tabs{display:inline-flex;gap:4px;margin:0}
#app .mr-bar .tabs button{flex:none;white-space:nowrap;height:34px;padding:0 14px;gap:8px;display:inline-flex;align-items:center;font-size:13px}
.mr-lista{display:flex;flex-direction:column;gap:12px}
.mr-c{background:#fff;border:1px solid #e5e9f0;border-radius:16px;padding:16px 18px;display:flex;flex-direction:column;gap:14px}
.mr-c.off{background:#fafbfc}
.mr-cab{display:flex;align-items:center;gap:10px}
.mr-cab > .mr-ic{width:34px;height:34px;border-radius:10px;background:#f2f4f6;display:grid;place-items:center;flex:none}
.mr-cab > .mr-ic svg{width:18px;height:18px}
.mr-cab b{font-size:15px;font-weight:600;flex:1;min-width:0}
.mr-est{font-size:12px;font-weight:500;padding:3px 10px;border-radius:999px;white-space:nowrap}
.mr-est.on{color:#166534;background:#dcfce7}
.mr-est.off{color:#4b5563;background:#f1f5f9}
.mr-flujo{display:grid;grid-template-columns:minmax(0,1fr) 28px minmax(0,1fr) 28px minmax(0,1.2fr);align-items:stretch}
.mr-paso{display:flex;flex-direction:column;gap:8px;padding:12px 14px;border-radius:12px;background:#f8fafc;border:1px solid #eef1f5;min-width:0}
.mr-paso .k{display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#6b7280}
.mr-paso .k svg{width:14px;height:14px}
.mr-paso .v{font-size:13.5px;line-height:1.4;color:var(--ink)}
.mr-paso .mr-nada{font-size:13px;color:#9ca3af}
.mr-paso ol{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px}
.mr-paso li{display:flex;gap:8px;font-size:13.5px;line-height:1.4}
.mr-paso li i{width:18px;height:18px;border-radius:50%;background:#0b0b10;color:#fff;font-style:normal;font-size:11px;font-weight:600;display:grid;place-items:center;flex:none;margin-top:1px}
.mr-flecha{display:grid;place-items:center;color:#9ca3af}
.mr-flecha svg{width:16px;height:16px}
.mr-c.off .mr-paso{opacity:.65}
.mr-ideas{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.mr-idea{display:flex;flex-direction:column;gap:10px;padding:16px;border:1px solid #e5e9f0;border-radius:14px;background:#fff;text-align:left;font:inherit;cursor:pointer}
.mr-idea:hover{border-color:#cbd5e1}
.mr-idea .mr-ic{width:36px;height:36px;border-radius:10px;background:#f2f4f6;display:grid;place-items:center}
.mr-idea .mr-ic svg{width:18px;height:18px}
.mr-idea b{font-size:14px;font-weight:600}
.mr-idea span.d{font-size:13px;line-height:1.45;color:#4b5563}
.mr-vacio{display:flex;flex-direction:column;align-items:center;gap:6px;padding:28px 16px;border:1px dashed #dbe2ea;border-radius:16px;text-align:center;background:#fff}
.mr-vacio svg{width:22px;height:22px}
.mr-vacio b{font-size:15px}
.mr-vacio span{font-size:13px;color:#6b7280}
.mr-cuandos{display:grid;gap:8px}
.mr-cuandos .cx-op{align-items:center;gap:8px;padding:10px 12px}
.mr-cuandos .cx-op svg{width:17px;height:17px;flex:none}
.mr-cuandos .cx-op span{font-size:13px;line-height:1.3}
.mm{display:flex;flex-direction:column;min-height:calc(100vh - 60px)}
.mm-top{display:flex;flex-wrap:wrap;align-items:center;gap:12px;padding-bottom:14px;border-bottom:1px solid #eef1f5}
.mm-top .volver{margin:0}
.mm-top input{flex:1 1 260px;height:40px;border:1px solid transparent;border-radius:10px;padding:0 10px;font:inherit;font-size:18px;font-weight:600;background:transparent;color:var(--ink)}
.mm-top input:hover,.mm-top input:focus{border-color:#e5e9f0;background:#fff;outline:none}
.mm-top .sp{flex:1}
.mm-cuerpo{display:flex;flex-wrap:wrap;flex:1;min-height:640px}
.mm-lienzo{flex:999 1 520px;min-width:0;padding:32px 16px 48px;background-color:#f6f7f9;background-image:radial-gradient(#d7dce3 1px,transparent 1px);background-size:18px 18px;border-radius:0 0 0 16px;display:flex;flex-direction:column;align-items:center}
.mm-panel{flex:1 1 320px;max-width:380px;background:#fff;border-left:1px solid #eef1f5;padding:20px;display:flex;flex-direction:column;gap:14px}
.mm-panel h4{margin:0;font-size:15px;font-weight:600}
.mm-panel p{margin:0;font-size:13px;line-height:1.5;color:#6b7280}
.mm-panel .lab{font-size:13px;font-weight:600;color:#374151;display:flex;flex-direction:column;gap:6px}
.mm-panel .dsel{min-width:0 !important}
.mm-nodo{width:100%;max-width:420px;display:flex;align-items:flex-start;gap:12px;padding:14px 16px;border-radius:14px;background:#fff;border:1.5px solid #e5e9f0;box-shadow:0 1px 2px rgba(15,23,42,.04);text-align:left;font:inherit;cursor:pointer;position:relative}
.mm-nodo:hover{border-color:#cbd5e1}
.mm-nodo[aria-pressed="true"]{border-color:#0b0b10;box-shadow:0 0 0 3px rgba(255,210,31,.45)}
.mm-ic{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;flex:none}
.mm-ic svg{width:19px;height:19px}
.mm-ic.cuando{background:#FFD21F;color:#0b0b10}
.mm-ic.si{background:#eef2ff;color:#3730a3}
.mm-ic.ent{background:#0b0b10;color:#fff}
.mm-tx{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}
.mm-tx small{font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#6b7280}
.mm-tx b{font-size:14px;font-weight:600;line-height:1.35}
.mm-tx span{font-size:13px;color:#4b5563}
.mm-tx span.falta{color:#b45309}
.mm-num{position:absolute;top:-9px;right:12px;font-size:11px;font-weight:600;padding:1px 8px;border-radius:999px;background:#0b0b10;color:#fff}
.mm-linea{width:2px;height:22px;background:#cbd5e1}
.mm-mas{width:28px;height:28px;border-radius:50%;border:1.5px solid #cbd5e1;background:#fff;display:grid;place-items:center;cursor:pointer;color:#6b7280}
.mm-mas:hover{border-color:#0b0b10;color:#0b0b10}
.mm-mas svg{width:15px;height:15px}
.mm-rama{font-size:11.5px;font-weight:600;color:#6b7280;background:#fff;border:1px solid #e5e9f0;border-radius:999px;padding:2px 10px}
.mm-fin{display:flex;align-items:center;gap:8px;font-size:12.5px;color:#6b7280;padding:8px 14px;border-radius:999px;background:#fff;border:1px dashed #cbd5e1}
.mm-fin svg{width:14px;height:14px}
.mm-frase{padding:12px 14px;border-radius:12px;background:#fffbea;border:1px solid #fde68a;font-size:13px;line-height:1.5;color:#3f3a1a}
.mm-quitar{align-self:flex-start;display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 12px;border-radius:9px;border:1px solid #fecaca;background:#fff;color:#b91c1c;font:inherit;font-size:13px;cursor:pointer}
.mm-quitar svg{width:15px;height:15px}
@media (max-width:760px){.mr-flujo{grid-template-columns:1fr}.mr-flecha{transform:rotate(90deg);height:24px}.mr-ideas{grid-template-columns:1fr}}
@media (max-width:900px){.mm-panel{max-width:none;border-left:0;border-top:1px solid #eef1f5}}
</style>`);

/* Texto ↔ paso: «Canal es WhatsApp» ↔ ['Canal es', 'WhatsApp']. Lo que no se reconoce se conserva tal cual. */
function rgPartir(q, s){
  for (const t of reglaTipos(q)) {
    if (!t[1]) { if (s === t[0]) return [t[0], '']; continue; }
    const v = t[1].find(x => t[2](x) === s); if (v !== undefined) return [t[0], v];
    if (s.startsWith(t[0] + ' ')) return [t[0], s.slice(t[0].length + 1)];
  }
  return [s, '', true];
}
function rgTexto(q, x){ const t = reglaTipos(q).find(y => y[0] === x[0]); return !t || x[2] ? x[0] : t[1] ? t[2](x[1]) : t[0]; }
const rgFalta = (q, x) => { const t = reglaTipos(q).find(y => y[0] === x[0]); return !!(t && t[1] && !x[1] && !x[2]); };
function rgFrase(m){
  const si = m.si.filter(x => !rgFalta('si', x)).map(x => rgTexto('si', x).toLowerCase());
  const ent = m.ent.filter(x => !rgFalta('ent', x)).map(x => rgTexto('ent', x).toLowerCase());
  return `<b>Cuando</b> ${esc(m.cuando.toLowerCase())}${si.length ? `, <b>si</b> ${esc(si.join(' y '))}` : ''}, <b>entonces</b> ${esc(ent.join(', luego ') || '…')}.`;
}

function rgTarjeta(r, i){
  return `<article class="mr-c${r.on ? '' : ' off'}"><div class="mr-cab"><span class="mr-ic">${I('flow')}</span><b>${esc(r.n)}</b>${r.origen ? `<span class="pill">${esc(r.origen)}</span>` : ''}<span class="mr-est ${r.on ? 'on' : 'off'}">${r.on ? 'Activa' : 'Apagada'}</span><button type="button" class="tg" role="switch" aria-checked="${r.on}" aria-label="Activar ${esc(r.n)}" data-rg-on="${i}"></button><button type="button" class="btn" data-rg-editar="${i}">${I('pen')}Editar</button><button type="button" class="btn ic" aria-label="Borrar regla" data-rg-borrar="${i}">${I('x')}</button></div>
    <div class="mr-flujo"><div class="mr-paso"><span class="k">${I(RG_IC[r.cuando] || 'bolt')}Cuando</span><span class="v">${esc(r.cuando)}</span></div><span class="mr-flecha">${RG_FLECHA}</span>
      <div class="mr-paso"><span class="k">${I('filter')}Si</span>${r.si.length ? `<span class="v">${r.si.map(esc).join(' y ')}</span>` : '<span class="mr-nada">Siempre</span>'}</div><span class="mr-flecha">${RG_FLECHA}</span>
      <div class="mr-paso"><span class="k">${I('bolt')}Entonces</span><ol>${r.ent.map((x, j) => `<li><i>${j + 1}</i>${esc(x)}</li>`).join('')}</ol></div></div></article>`;
}
function paginaReglasNueva(){
  const volver = `<button type="button" class="volver" data-ir="ajustes-crm">${I('back')}Ajustes del CRM</button>`;
  const on = REGLAS.filter(r => r.on).length;
  const ver = REGLAS.map((r, i) => [r, i]).filter(([r]) => RG.filtro === 'todas' || (RG.filtro === 'on') === !!r.on);
  const ideas = `<section class="ig-sec"><h4>Ideas para empezar</h4><div class="mr-ideas">${RG_IDEAS.map((x, i) => `<button type="button" class="mr-idea" data-rg-idea="${i}"><span class="mr-ic">${I(x.ic)}</span><b>${esc(x.n)}</b><span class="d">${esc(x.d)}</span></button>`).join('')}</div></section>`;
  return `<div class="ajw ancho">${volver}
    <div class="et-top"><div class="t"><h2>Reglas automáticas</h2><p class="sub et-desc">Cuando pasa algo en una conversación, el CRM hace lo que le digas, solo y al instante. Solo los líderes las ven y las cambian.</p></div>
      <button type="button" class="btn pri" data-rg-nueva="1">${I('plus')}Nueva regla</button></div>
    ${REGLAS.length ? `<div class="mr-bar"><div class="tabs">${[['todas', 'Todas', REGLAS.length], ['on', 'Activas', on], ['off', 'Apagadas', REGLAS.length - on]].map(([k, t, n]) => `<button type="button" data-rg-filtro="${k}" aria-pressed="${RG.filtro === k}">${t}<span class="n">${n}</span></button>`).join('')}</div></div>
      <div class="mr-lista">${ver.map(([r, i]) => rgTarjeta(r, i)).join('')}</div>`
      : `<div class="mr-vacio">${I('flow')}<b>Todavía no tienes reglas</b><span>Crea la primera o empieza con una de estas ideas.</span></div>${ideas}`}
  </div>`;
}

/* El mapa de la automatización (crear y editar). */
function rgNodo(sel, clase, ic, etq, titulo, sub, num){
  return `<button type="button" class="mm-nodo" data-mm-sel="${sel}" aria-pressed="${RG.mapa.sel === sel}">${num ? `<span class="mm-num">${num}</span>` : ''}<span class="mm-ic ${clase}">${I(ic)}</span><span class="mm-tx"><small>${etq}</small><b>${esc(titulo)}</b>${sub ? `<span class="${sub.falta ? 'falta' : ''}">${esc(sub.t)}</span>` : ''}</span></button>`;
}
const rgMas = (q, i) => `<div class="mm-linea"></div><button type="button" class="mm-mas" data-mm-mas="${q}:${i}" aria-label="${q === 'si' ? 'Agregar una condición aquí' : 'Agregar una acción aquí'}">${I('plus')}</button><div class="mm-linea"></div>`;
function paginaMapa(){
  const m = RG.mapa;
  const sis = m.si.map((x, i) => `${i ? '<div class="mm-linea"></div><span class="mm-rama">y</span><div class="mm-linea"></div>' : ''}${rgNodo('si:' + i, 'si', 'filter', 'Si', x[2] ? x[0] : x[1] ? rgTexto('si', x) : x[0], rgFalta('si', x) ? {t: 'Elige cuál', falta: true} : null)}`).join('');
  const ents = m.ent.map((x, i) => `${i ? rgMas('ent', i) : ''}${rgNodo('ent:' + i, 'ent', 'bolt', 'Entonces', x[2] ? x[0] : x[1] ? rgTexto('ent', x) : x[0], rgFalta('ent', x) ? {t: 'Elige cuál', falta: true} : null, m.ent.length > 1 ? i + 1 : 0)}`).join('');
  const lienzo = `${rgNodo('cuando', 'cuando', RG_IC[m.cuando] || 'bolt', 'Cuando', m.cuando, {t: 'Lo que dispara la regla'})}
    ${rgMas('si', m.si.length)}
    ${m.si.length ? sis : '<span class="mm-rama">Siempre · sin condiciones</span>'}
    ${rgMas('ent', 0)}
    ${ents || '<span class="mm-rama">Agrega una acción con el +</span>'}
    <div class="mm-linea"></div><span class="mm-fin">${I('check')}Fin de la regla</span>`;
  return `<div class="ajw ancho mm"><div class="mm-top"><button type="button" class="volver" data-mm-salir="1">${I('back')}Reglas automáticas</button>
      <input value="${esc(m.n)}" placeholder="Nombre de la regla" aria-label="Nombre de la regla" id="mm-n" maxlength="80"><span class="sp"></span>
      <span class="mr-est ${m.on ? 'on' : 'off'}">${m.on ? 'Activa' : 'Apagada'}</span><button type="button" class="tg" role="switch" aria-checked="${m.on}" aria-label="Activar la regla" data-mm-on="1"></button>
      <button type="button" class="btn" data-mm-salir="1">Cancelar</button><button type="button" class="btn pri" data-mm-ok="1">${I('check')}${m.i === null ? 'Crear regla' : 'Guardar'}</button></div>
    <div class="mm-cuerpo"><div class="mm-lienzo">${lienzo}</div><aside class="mm-panel">${rgPanel()}</aside></div></div>`;
}
function rgPanel(){
  const m = RG.mapa, [q, i] = m.sel.split(':');
  const frase = `<p class="mm-frase">${rgFrase(m)}</p>`;
  if (q === 'cuando') return `<h4>Cuando</h4><p>Lo que pone a andar la regla.</p><div class="mr-cuandos">${R_CUANDO.map(c => `<button type="button" class="cx-op" role="radio" aria-checked="${m.cuando === c}" data-mm-cuando="${esc(c)}">${I(RG_IC[c] || 'bolt')}<span>${esc(c)}</span></button>`).join('')}</div>${frase}`;
  const x = m[q][+i]; if (!x) { m.sel = 'cuando'; return rgPanel(); }
  const tipos = reglaTipos(q), t = tipos.find(y => y[0] === x[0]);
  return `<h4>${q === 'si' ? 'Condición' : `Acción ${m.ent.length > 1 ? +i + 1 : ''}`}</h4><p>${q === 'si' ? 'La regla sigue solo si esto se cumple.' : 'Lo que hace el CRM, en este orden.'}</p>
    ${x[2] ? `<p>${esc(x[0])}</p>` : `<div class="lab">${q === 'si' ? 'Qué revisar' : 'Qué hacer'}${ddSel('data-mm-tipo', tipos.map(y => [y[0], y[0]]), x[0])}</div>
    ${t && t[1] ? `<div class="lab">Cuál${t[1].length ? ddSel('data-mm-val', t[1].map(v => [v, v]), x[1], 'Elige cuál') : '<span class="muted" style="font-weight:400">No hay opciones todavía</span>'}</div>` : ''}`}
    <button type="button" class="mm-quitar" data-mm-quitar="1">${I('x')}Quitar ${q === 'si' ? 'condición' : 'acción'}</button>${frase}`;
}
function rgAbrir(i, idea){
  const r = i === null ? null : REGLAS[i];
  RG.mapa = r ? {i, n: r.n, on: !!r.on, cuando: r.cuando, si: r.si.map(s => rgPartir('si', s)), ent: r.ent.map(s => rgPartir('ent', s)), sel: 'cuando'}
    : idea ? {i: null, n: idea.n, on: true, cuando: idea.r.cuando, si: idea.r.si.map(x => x.slice()), ent: idea.r.ent.map(x => x.slice()), sel: 'cuando'}
    : {i: null, n: '', on: true, cuando: R_CUANDO[0], si: [], ent: [['Pasar al equipo', '']], sel: 'ent:0'};
  render();
}
const renderSinReglas = render;
render = function(){
  renderSinReglas.apply(this, arguments);
  if (st.pagina !== 'reglas') { RG.mapa = null; return; }
  // Sin la configuración general queda lo que pinta 62-vistas-rol.js (sin acceso).
  if (typeof puedeConfigurarCrm === 'function' && !puedeConfigurarCrm()) return;
  const pg = document.getElementById('page'); pg.replaceChildren();
  pg.insertAdjacentHTML('beforeend', RG.mapa ? paginaMapa() : paginaReglasNueva());
};
document.getElementById('page').addEventListener('click', e => {
  if (st.pagina !== 'reglas') return; const t = e.target;
  const guardarNombre = () => { const n = document.getElementById('mm-n'); if (n && RG.mapa) RG.mapa.n = n.value; };
  const f = t.closest('[data-rg-filtro]'); if (f) { e.stopImmediatePropagation(); RG.filtro = f.dataset.rgFiltro; render(); return; }
  const on = t.closest('[data-rg-on]'); if (on) { e.stopImmediatePropagation(); const r = REGLAS[+on.dataset.rgOn]; r.on = !r.on; render(); toast(`${r.n}: ${r.on ? 'activa' : 'apagada'}`); return; }
  const bo = t.closest('[data-rg-borrar]'); if (bo) { e.stopImmediatePropagation(); const i = +bo.dataset.rgBorrar, r = REGLAS[i];
    abrirDialogo(`<h3>Borrar la regla «${esc(r.n)}»</h3><p>Deja de funcionar de inmediato. Esto no se puede deshacer.</p><div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" style="background:#dc2626;border-color:#dc2626" data-rg-borrar-ok="${i}">${I('x')}Borrar</button></div>`); return; }
  const ed = t.closest('[data-rg-editar]'); if (ed) { e.stopImmediatePropagation(); rgAbrir(+ed.dataset.rgEditar); return; }
  if (t.closest('[data-rg-nueva]')) { e.stopImmediatePropagation(); rgAbrir(null); return; }
  const id = t.closest('[data-rg-idea]'); if (id) { e.stopImmediatePropagation(); rgAbrir(null, RG_IDEAS[+id.dataset.rgIdea]); return; }
  if (!RG.mapa) return;
  const s = t.closest('[data-mm-sel]'); if (s) { e.stopImmediatePropagation(); guardarNombre(); RG.mapa.sel = s.dataset.mmSel; render(); return; }
  const c = t.closest('[data-mm-cuando]'); if (c) { e.stopImmediatePropagation(); guardarNombre(); RG.mapa.cuando = c.dataset.mmCuando; render(); return; }
  const mas = t.closest('[data-mm-mas]'); if (mas) { e.stopImmediatePropagation(); guardarNombre(); const [q, i] = mas.dataset.mmMas.split(':'); RG.mapa[q].splice(+i, 0, q === 'si' ? [reglaTipos('si')[0][0], ''] : [reglaTipos('ent')[0][0], '']); RG.mapa.sel = q + ':' + i; render(); return; }
  const tp = t.closest('[data-mm-tipo]'); if (tp) { e.stopImmediatePropagation(); guardarNombre(); const [q, i] = RG.mapa.sel.split(':'); RG.mapa[q][+i] = [tp.dataset.mmTipo, '']; render(); return; }
  const v = t.closest('[data-mm-val]'); if (v) { e.stopImmediatePropagation(); guardarNombre(); const [q, i] = RG.mapa.sel.split(':'); RG.mapa[q][+i][1] = v.dataset.mmVal; render(); return; }
  if (t.closest('[data-mm-quitar]')) { e.stopImmediatePropagation(); guardarNombre(); const [q, i] = RG.mapa.sel.split(':'); RG.mapa[q].splice(+i, 1); RG.mapa.sel = 'cuando'; render(); return; }
  if (t.closest('[data-mm-on]')) { e.stopImmediatePropagation(); guardarNombre(); RG.mapa.on = !RG.mapa.on; render(); return; }
  if (t.closest('[data-mm-salir]')) { e.stopImmediatePropagation(); RG.mapa = null; render(); return; }
  if (t.closest('[data-mm-ok]')) {
    e.stopImmediatePropagation(); guardarNombre();
    const m = RG.mapa, n = m.n.trim();
    if (!n) { toast('Ponle nombre a la regla'); document.getElementById('mm-n').focus(); return; }
    if (!m.ent.length) { toast('Agrega al menos una acción en «Entonces»'); return; }
    if ([...m.si.map(x => ['si', x]), ...m.ent.map(x => ['ent', x])].some(([q, x]) => rgFalta(q, x))) { toast('Elige cuál en los pasos marcados'); return; }
    const regla = {n, on: m.on, cuando: m.cuando, si: m.si.map(x => rgTexto('si', x)), ent: m.ent.map(x => rgTexto('ent', x))};
    if (m.i === null) REGLAS.push(regla); else REGLAS[m.i] = {...REGLAS[m.i], ...regla};
    RG.mapa = null; render(); toast(m.i === null ? `Regla creada${regla.on ? ' y activa' : ''}` : 'Regla guardada');
  }
}, true);
document.getElementById('ov-x').addEventListener('click', e => {
  const b = e.target.closest('[data-rg-borrar-ok]'); if (!b) return;
  const r = REGLAS.splice(+b.dataset.rgBorrarOk, 1)[0]; cerrarDialogo(); render(); if (r) toast(`Regla borrada: ${r.n}`);
});
// El nombre se guarda mientras se escribe: un render por un mensaje que llega no lo borra.
document.getElementById('page').addEventListener('input', e => { if (e.target.id === 'mm-n' && RG.mapa) RG.mapa.n = e.target.value; });
