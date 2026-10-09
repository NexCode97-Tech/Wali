/* ── Carpetas (maqueta aprobada el 6-oct, «Carpetas»): Ajustes del CRM › Carpetas. Las del CRM se esconden de la
   barra con su interruptor; las propias se arman con un nombre, un ícono, condiciones («Etapa es Caliente y Canal es
   WhatsApp») y el equipo que la ve. Se guardan en el ajuste del equipo `carpetas` = {ocultas:[ids], propias:[…]},
   que 80-datos.js sincroniza como los demás. La barra (CARPETAS de 10-nucleo.js) se arma de nuevo en cada nav(). ── */
const CARP = {ocultas: [], propias: []};
const CARPETAS_BASE = CARPETAS.slice();
const CARP_DESC = {seguir:'Tienen un seguimiento para hoy', recordatorio:'Tienen un recordatorio pendiente', esperan:'El cliente escribió y nadie ha contestado', favoritos:'Las que marcaste con estrella', calientes:'Marcadas con el fuego o en la etapa Caliente', pauta:'Llegaron desde un anuncio'};
const CARP_ICONOS = ['folder', 'estrella', 'flame', 'bell', 'clock', 'calendar', 'cart', 'ad', 'users', 'chat', 'bolt', 'tag'];
const CARP_ESPERA = {'más de 1 hora': 60, 'más de 4 horas': 240, 'más de 1 día': 1440};
const CARP_CAMPOS = {
  'Etapa': () => nombresEtapas(), 'Etiqueta': () => ETIQS.map(e => e[0]), 'Canal': () => Object.values(CANALES).map(v => v.n),
  'Equipo': () => EQUIPOS.map(e => e.n), 'Asesor': () => ['Sin asignar', ...ASESORES], 'Esperan respuesta hace': () => Object.keys(CARP_ESPERA), 'Vienen de un anuncio': () => ['sí', 'no'],
};
/** Si una conversación cumple una condición [campo, 'es', valor]. */
function carpCumple(c, [campo, , v]){
  if (campo === 'Etapa') return c.etq.includes(v);
  if (campo === 'Etiqueta') return c.tags.includes(v);
  if (campo === 'Canal') return (CANALES[c.canal] || {}).n === v;
  if (campo === 'Equipo') return equipoConv(c) === v;
  if (campo === 'Asesor') return v === 'Sin asignar' ? !c.asig : c.asig === v;
  if (campo === 'Esperan respuesta hace') return (c.esperaMin || 0) > (CARP_ESPERA[v] || 0);
  if (campo === 'Vienen de un anuncio') return v === 'sí' ? !!c.pauta : !c.pauta;
  return false;
}
const carpRegla = r => `${r[0]} ${r[1]} ${r[2]}`;
const carpVeo = k => !k.eq || k.eq === 'Todos los equipos' || !ALCANCE.on || ALCANCE.todo || (ALCANCE.equipos || []).includes(k.eq);
/** La barra: las del CRM que no están escondidas y las propias que le tocan a esta persona. */
function carpRehacer(){
  const propias = (CARP.propias || []).filter(carpVeo).map(k => ({id: k.id, ic: k.ic || 'folder', n: k.n, f: c => (k.reglas || []).every(r => carpCumple(c, r))}));
  CARPETAS.splice(0, CARPETAS.length, ...CARPETAS_BASE.filter(k => !(CARP.ocultas || []).includes(k.id)), ...propias);
  if (st.carpeta && !CARPETAS.some(k => k.id === st.carpeta)) st.carpeta = '';
}
const navSinCarp = nav;
nav = function(){ carpRehacer(); return navSinCarp.apply(this, arguments); };

document.head.insertAdjacentHTML('beforeend', `<style>
.mc-sec{display:flex;flex-direction:column;gap:10px;margin-top:22px}
.mc-sec > h4{margin:0;display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:#6b7280}
.mc-sec > p{margin:0;font-size:13px;color:#6b7280}
.mc-fila{display:flex;align-items:center;gap:12px;padding:12px 16px;border-top:1px solid #eef1f5}
.mc-fila:first-child{border-top:0}
.mc-ic{width:36px;height:36px;border-radius:10px;background:#f2f4f6;display:grid;place-items:center;flex:none}
.mc-ic svg{width:18px;height:18px}
.mc-tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.mc-tx b{font-size:14px;font-weight:600}
.mc-tx small{font-size:12.5px;color:#6b7280;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mc-n{font-size:12.5px;color:#6b7280;white-space:nowrap}
.mc-caja{background:#fff;border:1px solid #e5e9f0;border-radius:14px;overflow:hidden}
.mc-vacio{margin:0;padding:22px;text-align:center;color:#6b7280;font-size:13px}
.mc-icos{display:grid;grid-template-columns:repeat(12,minmax(0,1fr));gap:6px}
.mc-icos button{aspect-ratio:1;border-radius:10px;border:1px solid #e5e9f0;background:#fff;display:grid;place-items:center;cursor:pointer}
.mc-icos button svg{width:17px;height:17px}
.mc-icos button[aria-pressed="true"]{background:#0b0b10;border-color:#0b0b10;color:#fff}
.mc-regla{display:grid;grid-template-columns:minmax(0,1.1fr) 70px minmax(0,1.2fr) 34px;gap:8px;align-items:center}
.mc-regla .dsel{min-width:0 !important}
.mc-regla .mc-es{font-size:13px;color:#6b7280;text-align:center}
.mc-regla .mc-x{width:34px;height:34px;border-radius:9px;border:1px solid #e5e9f0;background:#fff;display:grid;place-items:center;cursor:pointer;color:#6b7280}
.mc-regla .mc-x svg{width:15px;height:15px}
.mc-y{font-size:12px;font-weight:600;color:#6b7280;margin:2px 0}
.mc-mas{align-self:flex-start;display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 12px;border-radius:9px;border:1px dashed #cbd5e1;background:#fff;font:inherit;font-size:13px;color:var(--ink2);cursor:pointer}
.mc-mas svg{width:15px;height:15px}
.mc-prev{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:#f8fafc;border:1px solid #eef1f5;font-size:13px;color:#374151}
.mc-prev b{font-weight:600}
@media (max-width:560px){.mc-icos{grid-template-columns:repeat(6,minmax(0,1fr))}.mc-regla{grid-template-columns:minmax(0,1fr) minmax(0,1fr) 34px}.mc-regla .mc-es{display:none}}
</style>`);

const carpAbiertas = reglas => CONV.filter(c => okRol(c) && (c.est || 'abiertas') === 'abiertas' && (reglas || []).every(r => carpCumple(c, r))).length;
function paginaCarpetas(){
  const volver = `<button type="button" class="volver" data-ir="ajustes-crm">${I('back')}Ajustes del CRM</button>`;
  const filaDel = k => { const on = !(CARP.ocultas || []).includes(k.id);
    return `<div class="mc-fila"><span class="mc-ic">${I(k.ic)}</span><span class="mc-tx"><b>${esc(k.n)}</b><small>${esc(CARP_DESC[k.id] || '')}</small></span><span class="mc-n">${on ? 'En la barra' : 'Escondida'}</span><button type="button" class="tg" role="switch" aria-checked="${on}" aria-label="Mostrar ${esc(k.n)} en la barra" data-mc-on="${esc(k.id)}"></button></div>`; };
  const filaPropia = k => `<div class="mc-fila"><span class="mc-ic">${I(k.ic || 'folder')}</span><span class="mc-tx"><b>${esc(k.n)}</b><small>${esc((k.reglas || []).map(carpRegla).join(' y '))} · ${esc(k.eq || 'Todos los equipos')}</small></span><span class="mc-n">${carpAbiertas(k.reglas)} abiertas</span><button type="button" class="btn" data-mc-editar="${esc(k.id)}">${I('pen')}Editar</button></div>`;
  const propias = CARP.propias || [];
  return `<div class="ajw ancho">${volver}
    <div class="et-top"><div class="t"><h2>Carpetas</h2><p class="sub et-desc">Atajos de la barra lateral que juntan conversaciones con algo en común. Las del CRM se pueden esconder; las tuyas las armas con las condiciones que quieras.</p></div>
      <button type="button" class="btn pri" data-mc-nueva="1">${I('plus')}Nueva carpeta</button></div>
    <section class="mc-sec"><h4>Tus carpetas <span class="ig-n">${propias.length}</span></h4><div class="mc-caja">${propias.length ? propias.map(filaPropia).join('') : '<p class="mc-vacio">Todavía no tienes carpetas propias.</p>'}</div></section>
    <section class="mc-sec"><h4>Del CRM <span class="ig-n">${CARPETAS_BASE.length}</span></h4><p>Vienen con el CRM. Apaga las que tu equipo no usa y dejan de salir en la barra.</p><div class="mc-caja">${CARPETAS_BASE.map(filaDel).join('')}</div></section></div>`;
}
const paginaCfgCarp = paginaCfg;
paginaCfg = function(k){ return k === 'carpetas' ? paginaCarpetas() : paginaCfgCarp(k); };

function dlgCarpeta(){
  const d = st.mcDlg;
  const reglas = d.reglas.map((r, i) => `${i ? '<span class="mc-y">y</span>' : ''}<div class="mc-regla">${ddSel('data-mc-campo', Object.keys(CARP_CAMPOS).map(k => [i + '|' + k, k]), i + '|' + r[0])}<span class="mc-es">es</span>${ddSel('data-mc-valor', CARP_CAMPOS[r[0]]().map(v => [i + '|' + v, v]), i + '|' + r[2])}<button type="button" class="mc-x" data-mc-quitar="${i}" aria-label="Quitar la condición">${I('x')}</button></div>`).join('');
  const n = carpAbiertas(d.reglas);
  return `<div class="et-dcab"><h3>${d.id ? 'Editar carpeta' : 'Nueva carpeta'}</h3></div>
    <label class="et-lab">Nombre<input id="mc-n" value="${esc(d.n)}" placeholder="Ej. Calientes por WhatsApp" maxlength="40" autocomplete="off"></label>
    <div class="et-lab">Ícono<div class="mc-icos">${CARP_ICONOS.map(ic => `<button type="button" data-mc-ic="${ic}" aria-pressed="${d.ic === ic}" aria-label="Ícono ${ic}">${I(ic)}</button>`).join('')}</div></div>
    <div class="et-lab">Junta las conversaciones que cumplan todo esto<div style="display:flex;flex-direction:column;gap:8px;margin-top:4px">${reglas}<button type="button" class="mc-mas" data-mc-mas="1">${I('plus')}Agregar condición</button></div></div>
    <div class="et-lab">Quién la ve${ddSel('data-mc-eq', ['Todos los equipos', ...EQUIPOS.map(e => e.n)], d.eq)}<small>Sale en la barra de las personas de ese equipo.</small></div>
    <div class="mc-prev">${I('folder')}<span>Hoy la cumplen <b>${n} ${n === 1 ? 'conversación abierta' : 'conversaciones abiertas'}</b>.</span></div>
    <div class="ft2${d.id ? ' entre' : ''}">${d.id ? `<button type="button" class="btn et-borrar" data-mc-borrar="1">${I('x')}Borrar</button><span style="display:flex;gap:8px">` : ''}<button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" data-mc-crear="1">${I('check')}${d.id ? 'Guardar' : 'Crear carpeta'}</button>${d.id ? '</span>' : ''}</div>`;
}
const carpDlg = () => { const x = document.getElementById('mc-n'); if (x && st.mcDlg) st.mcDlg.n = x.value; abrirDialogo(dlgCarpeta(), 'dlg-per dlg-et'); };
function carpGuardar(){ render(); }   // 80-datos.js nota el cambio en CARP y lo guarda

document.addEventListener('click', e => {
  if (st.pagina !== 'cfg-carpetas' && !st.mcDlg) return;
  const t = e.target;
  const on = t.closest('[data-mc-on]'); if (on) { const id = on.dataset.mcOn, l = CARP.ocultas || []; CARP.ocultas = l.includes(id) ? l.filter(x => x !== id) : [...l, id]; carpGuardar(); return; }
  if (t.closest('[data-mc-nueva]')) { st.mcDlg = {id: null, n: '', ic: 'folder', reglas: [['Etapa', 'es', nombresEtapas()[0] || '']], eq: 'Todos los equipos'}; carpDlg(); setTimeout(() => { const x = document.getElementById('mc-n'); if (x) x.focus(); }, 30); return; }
  const ed = t.closest('[data-mc-editar]'); if (ed) { const k = (CARP.propias || []).find(x => x.id === ed.dataset.mcEditar); if (!k) return; st.mcDlg = {id: k.id, n: k.n, ic: k.ic || 'folder', reglas: (k.reglas || []).map(r => r.slice()), eq: k.eq || 'Todos los equipos'}; carpDlg(); return; }
  if (!st.mcDlg) return;
  const ic = t.closest('[data-mc-ic]'); if (ic) { st.mcDlg.ic = ic.dataset.mcIc; carpDlg(); return; }
  const q = t.closest('[data-mc-quitar]'); if (q) { st.mcDlg.reglas.splice(+q.dataset.mcQuitar, 1); carpDlg(); return; }
  if (t.closest('[data-mc-mas]')) { st.mcDlg.reglas.push(['Etiqueta', 'es', ETIQS[0] ? ETIQS[0][0] : '']); carpDlg(); return; }
  const c = t.closest('[data-mc-campo]'); if (c) { const [i, k] = c.dataset.mcCampo.split('|'); st.mcDlg.reglas[+i] = [k, 'es', CARP_CAMPOS[k]()[0] || '']; carpDlg(); return; }
  const v = t.closest('[data-mc-valor]'); if (v) { const p = v.dataset.mcValor.indexOf('|'); st.mcDlg.reglas[+v.dataset.mcValor.slice(0, p)][2] = v.dataset.mcValor.slice(p + 1); carpDlg(); return; }
  const eq = t.closest('[data-mc-eq]'); if (eq) { st.mcDlg.eq = eq.dataset.mcEq; carpDlg(); return; }
  if (t.closest('[data-mc-borrar]')) { CARP.propias = (CARP.propias || []).filter(x => x.id !== st.mcDlg.id); st.mcDlg = null; cerrarDialogo(); carpGuardar(); toast('Carpeta borrada'); return; }
  if (t.closest('[data-mc-crear]')) {
    const d = st.mcDlg, n = ((document.getElementById('mc-n') || {}).value || '').trim();
    if (n.length < 2) { toast('Escribe el nombre de la carpeta'); return; }
    if (!d.reglas.length || d.reglas.some(r => !r[2])) { toast('Agrega al menos una condición completa'); return; }
    const k = {id: d.id || 'c-' + Date.now().toString(36), n, ic: d.ic, reglas: d.reglas, eq: d.eq};
    CARP.propias = d.id ? (CARP.propias || []).map(x => x.id === d.id ? k : x) : [...(CARP.propias || []), k];
    st.mcDlg = null; cerrarDialogo(); carpGuardar(); toast(d.id ? 'Carpeta guardada' : 'Carpeta creada. Ya sale en la barra.');
    return;
  }
}, true);
// Al cerrar el diálogo con la X o Cancelar se olvida el borrador.
document.getElementById('ov-x').addEventListener('click', e => { if (e.target.closest('[data-cerrar-dlg]')) st.mcDlg = null; });
