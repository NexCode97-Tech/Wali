/* ── Horario de atención con turnos (maqueta aprobada el 7-oct) ──
   Cada turno tiene sus días y horas y las personas que lo trabajan (selección múltiple, por equipo; una persona puede
   estar en varios). Ya no hay horario general: el de la empresa es la suma de los turnos (CFG.horario se arma solo, de
   la primera hora a la última de cada día) y de ahí salen el agente IA, el chat de la web y el aviso fuera de horario.
   El reparto (reparto.ts) solo le entrega conversaciones a quien está en su turno; quien no tiene turno recibe a
   cualquier hora. Los turnos van en CFG.turnos: [{id, n, col, dias: [[díaDeLaSemana 0-6, '7:00', '15:00']], ids}]. */
if (!Array.isArray(CFG.turnos)) CFG.turnos = [];
const HT = {dlg: null};
const HT_DIAS = [[1, 'Lun', 'Lunes'], [2, 'Mar', 'Martes'], [3, 'Mié', 'Miércoles'], [4, 'Jue', 'Jueves'], [5, 'Vie', 'Viernes'], [6, 'Sáb', 'Sábado'], [0, 'Dom', 'Domingo']];
const htResumenNoUsado = t => { const g = {}; t.dias.forEach(([d, a, b]) => { (g[a + '–' + b] = g[a + '–' + b] || []).push(d); });
  return Object.entries(g).map(([h, ds]) => `<span class="ht-fr"><b>${ds.map(d => HT_DIAS.find(x => x[0] === d)[1]).join(', ')}</b> ${h.replace('–', ' a ')}</span>`).join(''); };
const htSin = () => personasCrm().filter(p => !CFG.turnos.some(t => t.ids.includes(p.id)));
const htEquipoDe = id => EQUIPOS.map(e => e.n).find(eq => idsDe(eq).includes(id)) || 'Sin equipo';
const htMin = s => { const m = String(s || '').match(/^(\d{1,2})(?::(\d{2}))?$/); return m && +m[1] <= 24 && +(m[2] || 0) < 60 ? +m[1] * 60 + +(m[2] || 0) : null; };
const htEntre = (min, a, c) => a !== null && c !== null && (a <= c ? min >= a && min < c : min >= a || min < c);
// Estado del turno ahora (hora de Colombia): 'turno', 'almuerzo' o '' (fuera de turno).
const htEstado = t => { const b = new Date(Date.now() - 5 * 3600e3), dia = b.getUTCDay(), min = b.getUTCHours() * 60 + b.getUTCMinutes(); const x = (t.dias || []).find(z => z[0] === dia); if (!x || !htEntre(min, htMin(x[1]), htMin(x[2]))) return ''; return htEntre(min, htMin(x[3]), htMin(x[4])) ? 'almuerzo' : 'turno'; };
const htAhora = t => htEstado(t) === 'turno';
// El horario de la empresa, armado de los turnos: cada día de la primera hora a la última (sin turnos ese día, cerrado).
function htDerivar(){ if (!CFG.turnos.length) return; const nombres = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  CFG.horario = nombres.map((n, i) => { const dia = (i + 1) % 7, fr = CFG.turnos.flatMap(t => (t.dias || []).filter(z => z[0] === dia)).filter(z => htMin(z[1]) !== null && htMin(z[2]) !== null);
    if (!fr.length) return [n, '7:00', '22:00', false]; const de = fr.reduce((a, z) => htMin(z[1]) < htMin(a) ? z[1] : a, fr[0][1]), a = fr.reduce((x, z) => htMin(z[2]) > htMin(x) ? z[2] : x, fr[0][2]); return [n, de, a, true]; }); }
function htTarjeta(t){
  const ps = t.ids.map(personaDe).filter(Boolean), es = htEstado(t), on = es === 'turno';
  return `<article class="ht-card"><header><span class="ht-pt" style="background:${t.col}"></span><div class="ht-t"><h3>${esc(t.n)}</h3><span class="ht-est${on ? ' on' : es ? ' alm' : ''}"><i></i>${on ? 'Trabajando ahora' : es ? 'En almuerzo ahora' : 'Fuera de turno ahora'}</span></div><button type="button" class="btn" data-ht-ed="${t.id}">Editar</button></header>
    <div class="ht-sem">${HT_DIAS.map(([d, c]) => { const x = t.dias.find(z => z[0] === d); return `<span class="ht-d${x ? ' on' : ''}"><b>${c}</b>${x ? `<small>${esc(x[1])}<br>${esc(x[2])}</small>${x[3] ? `<em title="Almuerzo ${esc(x[3])} a ${esc(x[4])}">${I('clock')}${esc(x[3])}</em>` : ''}` : '<small>—</small>'}</span>`; }).join('')}</div>
    <div class="ht-gente"><small>${ps.length} ${ps.length === 1 ? 'persona' : 'personas'}</small><div class="q-av">${ps.slice(0, 6).map(p => `<span class="q-p" title="${esc(p.nombre)} · ${esc(htEquipoDe(p.id))}">${avPer(p)}</span>`).join('')}${ps.length > 6 ? `<span class="q-mas">+${ps.length - 6}</span>` : ''}</div></div></article>`;
}
const htPagBase = paginaCfg;
paginaCfg = function(k){
  if (k !== 'horario') return htPagBase(k);
  const sin = CFG.turnos.length ? htSin() : [], abierto = CFG.turnos.some(htAhora);
  return `<div class="ajw ancho"><button type="button" class="volver" data-ir="ajustes-crm">${I('back')}Ajustes del CRM</button><h2>Horario de atención</h2><p class="sub">Los turnos de cada persona. El horario de la empresa es la suma de los turnos: fuera de ellos responde el agente IA y el chat de la web muestra un formulario.</p>
    <div class="ht-top">${CFG.turnos.length ? `<span class="ht-abierto${abierto ? ' on' : ''}"><i></i>${abierto ? 'Abierto ahora: hay gente en turno' : 'Cerrado ahora: nadie está en turno'}</span>` : ''}<span class="sp"></span><button type="button" class="btn pri" data-ht-ed="">${I('plus')}Crear turno</button></div>
    <div class="ht-cols"><div class="ht-lista">${CFG.turnos.length ? CFG.turnos.map(htTarjeta).join('') : `<div class="ht-vacio">${I('clock')}<b>Todavía no hay turnos</b><span>Crea el primero: sus días, sus horas y quiénes lo trabajan. Mientras no haya turnos se usa el horario de siempre.</span><button type="button" class="btn pri" data-ht-ed="">${I('plus')}Crear turno</button></div>`}</div>
      <aside class="ht-aj"><h4>${I('clock')}Fuera de horario</h4>
        <div class="ht-fila"><span><b>Festivos de Colombia como domingo</b><small>Ese día trabaja solo quien tiene turno el domingo</small></span><button type="button" class="q-sw ht-sw" role="switch" data-ht-fest="1" aria-checked="${CFG.festivos !== false}" aria-label="Festivos como domingo"></button></div>
        <label class="ht-lab" style="margin-top:6px">Mensaje fuera de horario<textarea rows="4" id="ht-fuera">${esc(CFG.fuera || '')}</textarea></label>
        <div><button type="button" class="btn" data-ht-guardar="1">${I('check')}Guardar</button></div>
        ${sin.length ? `<div class="ht-sin">${I('users')}<span><b>${sin.length} ${sin.length === 1 ? 'persona no tiene turno' : 'personas no tienen turno'}</b><small>Reciben a cualquier hora: ${esc(sin.map(p => p.nombre).join(', '))}</small></span></div>` : ''}</aside></div></div>`;
};
function htDialogo(){
  const d = HT.dlg, q = norm(d.q || '');
  const grupos = [...EQUIPOS.map(e => e.n), 'Sin equipo'].map(eq => [eq, personasCrm().filter(p => htEquipoDe(p.id) === eq && (!q || norm(p.nombre).includes(q)))]).filter(([, ps]) => ps.length);
  const otros = id => CFG.turnos.filter(t => t.id !== d.id && t.ids.includes(id)).map(t => t.n);
  return `<div class="ht-dlg"><h3>${d.id ? 'Editar turno' : 'Crear turno'}</h3>
    <div class="ht-dc"><div class="ht-izq">
      <label class="ht-lab">Nombre del turno<input id="ht-n" value="${esc(d.n)}" placeholder="Ej. Mañana" maxlength="40" autocomplete="off"></label>
      <span class="ht-lab">Color</span><div class="qe-sw">${['#FFD21F', '#a855f7', '#22c55e', '#3b82f6', '#f97316', '#ec4899'].map(c => `<button type="button" style="background:${c}" aria-pressed="${d.col === c}" data-ht-col="${c}" aria-label="Color"></button>`).join('')}</div>
      <span class="ht-lab">Días y horas</span>
      <div class="ht-dias">${HT_DIAS.map(([n, c, l]) => { const x = d.dias.find(z => z[0] === n); return `<div class="ht-dr${x ? ' on' : ''}"><button type="button" class="q-sw" role="switch" aria-checked="${!!x}" data-ht-dia="${n}" aria-label="${l}"></button><span class="ht-dn">${l}</span>${x ? `<input class="inl" value="${esc(x[1])}" data-ht-h="${n}|1" inputmode="numeric" maxlength="5" aria-label="${l} desde"><span>a</span><input class="inl" value="${esc(x[2])}" data-ht-h="${n}|2" inputmode="numeric" maxlength="5" aria-label="${l} hasta">${x[3] !== undefined ? '' : `<button type="button" class="ht-alm-b" data-ht-alm="${n}">${I('plus')}Almuerzo</button>`}` : '<span class="muted">No trabaja</span>'}</div>${x && x[3] !== undefined ? `<div class="ht-alm"><span>Almuerzo</span><input class="inl" value="${esc(x[3])}" data-ht-h="${n}|3" inputmode="numeric" maxlength="5" aria-label="${l}, almuerzo desde"><span>a</span><input class="inl" value="${esc(x[4])}" data-ht-h="${n}|4" inputmode="numeric" maxlength="5" aria-label="${l}, almuerzo hasta"><button type="button" class="ht-alm-x" data-ht-almx="${n}" aria-label="Quitar el almuerzo del ${l.toLowerCase()}">${I('x')}</button></div>` : ''}`; }).join('')}</div>
      <p class="ht-ay">${I('clock')}En el almuerzo la persona pasa sola a Ausente y no recibe conversaciones; al terminar vuelve a En línea.</p>
    </div><div class="ht-der">
      <div class="ht-ph"><span class="ht-lab" style="margin:0">Quiénes trabajan este turno</span><span class="ht-cnt">${d.ids.length} ${d.ids.length === 1 ? 'elegida' : 'elegidas'}</span></div>
      <label class="qe-busca" style="margin:0 0 8px">${I('search')}<input id="ht-q" value="${esc(d.q || '')}" placeholder="Buscar una persona" autocomplete="off"></label>
      <div class="ht-ps">${grupos.map(([eq, ps]) => { const todos = ps.every(p => d.ids.includes(p.id)); return `<div class="ht-g"><div class="ht-gh"><b>${esc(eq)}</b><button type="button" data-ht-todos="${esc(eq)}">${todos ? 'Quitar todos' : 'Elegir todos'}</button></div>${ps.map(p => { const on = d.ids.includes(p.id), o = otros(p.id); return `<button type="button" class="ht-p${on ? ' on' : ''}" role="checkbox" aria-checked="${on}" data-ht-p="${p.id}"><span class="ht-ck">${on ? I('check') : ''}</span>${avPer(p)}<span class="ht-pn"><b>${esc(p.nombre)}</b>${o.length ? `<small>También en: ${esc(o.join(', '))}</small>` : ''}</span></button>`; }).join('')}</div>`; }).join('')}</div>
    </div></div>
    <div class="ft2">${d.id ? '<button type="button" class="btn" data-ht-del="1" style="color:#b91c1c;border-color:#fecaca;margin-right:auto">Eliminar turno</button>' : ''}<button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" data-ht-ok="1">${I('check')}${d.id ? 'Guardar turno' : 'Crear turno'}</button></div></div>`;
}
const htAbrir = () => { const z = document.querySelector('.ht-ps'), y = z ? z.scrollTop : 0; abrirDialogo(htDialogo(), 'dlg-ht'); const z2 = document.querySelector('.ht-ps'); if (z2) z2.scrollTop = y; };
const htPintar = () => render();
const htGuardar = msg => { htDerivar(); if (typeof crmSincronizar === 'function') crmSincronizar(); render(); if (msg) toast(msg); };
document.addEventListener('click', e => {
  const t = e.target, h = s => t.closest(s); let b;
    if (st.pagina !== 'cfg-horario' && !h('.dlg-ht')) return;
  if (h('[data-ht-fest]')) { CFG.festivos = CFG.festivos === false; htGuardar(CFG.festivos ? 'Los festivos cuentan como domingo' : 'Los festivos cuentan como un día normal'); return; }
  if (h('[data-ht-guardar]')) { const x = document.getElementById('ht-fuera'); if (x) CFG.fuera = x.value.trim(); htGuardar('Mensaje fuera de horario guardado'); return; }
  if (b = h('[data-ht-ed]')) { const x = CFG.turnos.find(z => z.id === b.dataset.htEd); HT.dlg = x ? JSON.parse(JSON.stringify(x)) : {id: '', n: '', col: '#3b82f6', dias: [[1, '8:00', '17:00'], [2, '8:00', '17:00'], [3, '8:00', '17:00'], [4, '8:00', '17:00'], [5, '8:00', '17:00']], ids: []}; htAbrir(); return; }
  const d = HT.dlg; if (!d || !h('.dlg-ht')) return;
  const n = document.getElementById('ht-n'); if (n) d.n = n.value;
  if (b = h('[data-ht-col]')) { d.col = b.dataset.htCol; }
  else if (b = h('[data-ht-dia]')) { const k = +b.dataset.htDia; d.dias = d.dias.some(z => z[0] === k) ? d.dias.filter(z => z[0] !== k) : [...d.dias, [k, '8:00', '17:00']]; }
  else if (b = h('[data-ht-alm]')) { const x = d.dias.find(z => z[0] === +b.dataset.htAlm); if (x) { x[3] = '12:00'; x[4] = '13:00'; } }
  else if (b = h('[data-ht-almx]')) { const x = d.dias.find(z => z[0] === +b.dataset.htAlmx); if (x) x.length = 3; }
  else if (b = h('[data-ht-p]')) { const id = b.dataset.htP; d.ids = d.ids.includes(id) ? d.ids.filter(x => x !== id) : [...d.ids, id]; }
  else if (b = h('[data-ht-todos]')) { const ps = personasCrm().filter(p => htEquipoDe(p.id) === b.dataset.htTodos).map(p => p.id), todos = ps.every(id => d.ids.includes(id)); d.ids = todos ? d.ids.filter(id => !ps.includes(id)) : [...new Set([...d.ids, ...ps])]; }
  else if (h('[data-ht-del]')) { CFG.turnos = CFG.turnos.filter(z => z.id !== d.id); HT.dlg = null; cerrarDialogo(); htGuardar(`Turno eliminado: ${d.n}`); return; }
  else if (h('[data-ht-ok]')) {
    const n2 = String(d.n || '').trim(); if (!n2) { toast('Ponle un nombre al turno'); return; }
    if (!d.dias.length) { toast('Elige al menos un día'); return; }
    const mal = d.dias.find(z => htMin(z[1]) === null || htMin(z[2]) === null || (z.length > 3 && (htMin(z[3]) === null || htMin(z[4]) === null))); if (mal) { toast('Revisa las horas: van como 7:00 o 22:30'); return; }
    if (!d.ids.length) { toast('Elige quiénes trabajan este turno'); return; }
    const limpio = {id: d.id || 't' + Date.now(), n: n2.slice(0, 40), col: d.col, dias: d.dias.map(z => z.length > 3 ? [z[0], z[1], z[2], z[3], z[4]] : [z[0], z[1], z[2]]), ids: [...d.ids]};
    const i = CFG.turnos.findIndex(z => z.id === d.id); if (i >= 0) CFG.turnos[i] = limpio; else CFG.turnos.push(limpio);
    HT.dlg = null; cerrarDialogo(); htGuardar(`Turno guardado: ${limpio.n}`); return; }
  else return;
  e.stopImmediatePropagation(); htAbrir();
}, true);
document.addEventListener('input', e => { const hh = e.target.closest && e.target.closest('[data-ht-h]'); if (hh && HT.dlg) { const [dia, k] = hh.dataset.htH.split('|'); const x = HT.dlg.dias.find(z => z[0] === +dia); if (x) x[+k] = hh.value.trim(); return; }
  if (e.target.id === 'ht-q' && HT.dlg) { HT.dlg.q = e.target.value; const p = e.target.selectionStart; htAbrir(); const x = document.getElementById('ht-q'); x.focus(); x.setSelectionRange(p, p); } });
document.head.insertAdjacentHTML('beforeend', `<style>
.ht-nota{font-size:13px;color:#6b7280;margin:0 0 14px}
.ht-top{display:flex;align-items:center;gap:10px;margin:4px 0 16px}.ht-top .sp{flex:1}
.ht-abierto{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;background:#f3f4f6;font-size:13px;font-weight:600;color:#4b5563}.ht-abierto i{width:8px;height:8px;border-radius:50%;background:#9ca3af}.ht-abierto.on{background:#dcfce7;color:#15803d}.ht-abierto.on i{background:#16a34a}
.ht-cols{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:18px;align-items:start}
.ht-lista{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.ht-aj{border:1px solid #e5e9f0;border-radius:16px;background:#fff;padding:18px;display:flex;flex-direction:column;gap:12px;position:sticky;top:0}
.ht-aj h4{display:flex;align-items:center;gap:8px;margin:0;font-size:15px}.ht-aj h4 svg{width:17px;height:17px}
.ht-fila{display:flex;align-items:center;gap:12px}.ht-fila span{flex:1;min-width:0}.ht-fila b{display:block;font-size:13.5px;font-weight:600}.ht-fila small{font-size:12.5px;color:#6b7280}
.ht-aj textarea{border:1px solid #e5e9f0;border-radius:10px;padding:10px 12px;font:inherit;font-size:13.5px;text-transform:none;letter-spacing:0;color:#0b0b10;font-weight:400;resize:vertical}
.ht-sw{display:block;flex:none;width:44px;height:24px;border:0;padding:0;border-radius:999px;background:#cbd5e1;position:relative;cursor:pointer}
.ht-sw::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;transition:left .2s}
.ht-sw[aria-checked="true"]{background:#FFD21F}.ht-sw[aria-checked="true"]::after{left:23px;background:#0b0b10}
@media (max-width:1180px){.ht-cols{grid-template-columns:1fr}.ht-aj{position:static}}
.ht-card{border:1px solid #e5e9f0;border-radius:16px;background:#fff;padding:16px 18px;display:flex;flex-direction:column;gap:14px}
.ht-card header{display:flex;align-items:center;gap:12px}
.ht-pt{width:14px;height:14px;border-radius:50%;flex:none;box-shadow:0 0 0 3px #fff,0 0 0 4px #e5e9f0}
.ht-t{flex:1;min-width:0}.ht-t h3{margin:0;font-size:16px;font-weight:650}
.ht-est{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:#6b7280}.ht-est i{width:8px;height:8px;border-radius:50%;background:#9ca3af}.ht-est.on i{background:#16a34a}.ht-est.on{color:#15803d}
.ht-sem{display:grid;grid-template-columns:repeat(7,1fr);gap:6px}
.ht-d{display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 2px;border-radius:10px;background:#f6f7f9;color:#9ca3af}
.ht-d b{font-size:11.5px;font-weight:650;text-transform:uppercase;letter-spacing:.04em}.ht-d small{font-size:11.5px;line-height:1.3;text-align:center;font-variant-numeric:tabular-nums}
.ht-d.on{background:#fffde6;color:#0b0b10;box-shadow:inset 0 0 0 1px #f3e97a}
.ht-gente{display:flex;align-items:center;justify-content:space-between;gap:10px}.ht-gente small{font-size:12.5px;color:#6b7280}
.ht-vacio{grid-column:1/-1;display:flex;flex-direction:column;align-items:center;gap:8px;padding:40px 20px;border:1.5px dashed #d1d5db;border-radius:16px;text-align:center;color:#6b7280}.ht-vacio > svg{width:28px;height:28px}.ht-vacio b{font-size:15px;color:#0b0b10}.ht-vacio span{max-width:420px;font-size:13px}
.ht-sin{display:flex;align-items:center;gap:12px;margin-top:4px;padding:12px 16px;border-radius:14px;background:#f8f9fb;border:1px dashed #d1d5db}
.ht-sin > svg{width:18px;height:18px;color:#6b7280;flex:none}.ht-sin span{flex:1;min-width:0}.ht-sin b{display:block;font-size:13.5px}.ht-sin small{font-size:12.5px;color:#6b7280}
.dlg.dlg-ht{width:min(920px,calc(100vw - 32px))}
.ht-dlg h3{margin:0 0 14px}
.ht-dc{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:22px}
.ht-lab{display:flex;flex-direction:column;gap:6px;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#6b7280;margin:0 0 6px}
.ht-lab input{height:42px;border:1px solid #e5e9f0;border-radius:10px;padding:0 12px;font:inherit;font-size:14.5px;text-transform:none;letter-spacing:0;color:#0b0b10;font-weight:500}
.ht-izq .qe-sw{margin-bottom:14px}
.ht-dias{display:flex;flex-direction:column;gap:6px}
.ht-dr{display:flex;align-items:center;gap:10px;padding:6px 8px;border-radius:10px}.ht-dr.on{background:#fffde6}
.ht-dn{width:84px;font-size:13.5px;font-weight:550}.ht-dr .inl{width:72px;height:32px;text-align:center;border:1px solid #e5e9f0;border-radius:8px;background:#fff;font:inherit;font-size:13.5px;font-variant-numeric:tabular-nums}.ht-dr > span:not(.ht-dn){font-size:13px;color:#6b7280}
.ht-dr{flex-wrap:nowrap;gap:8px}
.ht-alm-b{display:inline-flex;align-items:center;gap:3px;margin-left:auto;border:1px dashed #cbd5e1;background:#fff;border-radius:999px;padding:3px 8px;white-space:nowrap;flex:none;font:inherit;font-size:12px;font-weight:600;cursor:pointer}.ht-alm-b:hover{border-color:#0b0b10}.ht-alm-b svg{width:12px;height:12px}
.ht-alm{display:flex;align-items:center;gap:10px;margin:-2px 0 4px 56px;padding:6px 8px;border-radius:10px;background:#f6f7f9;font-size:13px;color:#4b5563}.ht-alm > span:first-child{width:72px;font-weight:600}
.ht-alm .inl{width:72px;height:30px;text-align:center;border:1px solid #e5e9f0;border-radius:8px;background:#fff;font:inherit;font-size:13px}
.ht-alm-x{width:26px;height:26px;border:0;background:none;border-radius:7px;display:grid;place-items:center;color:#9ca3af;cursor:pointer}.ht-alm-x:hover{background:#fee2e2;color:#b91c1c}.ht-alm-x svg{width:13px;height:13px}
.ht-ay{display:flex;align-items:center;gap:8px;margin:10px 0 0;font-size:12.5px;color:#6b7280}.ht-ay svg{width:15px;height:15px;flex:none}
.ht-d em{display:inline-flex;align-items:center;gap:3px;font-style:normal;font-size:10.5px;color:#6b7280;margin-top:2px}.ht-d em svg{width:10px;height:10px}
.ht-est.alm i{background:#f59e0b}.ht-est.alm{color:#b45309}
.ht-dr .q-sw{display:block;flex:none;width:38px;height:22px;border:0;padding:0;border-radius:999px;background:#cbd5e1;position:relative;cursor:pointer}
.ht-dr .q-sw::after{content:"";position:absolute;top:3px;left:3px;width:16px;height:16px;border-radius:50%;background:#fff;transition:left .2s cubic-bezier(.22,1,.36,1)}
.ht-dr .q-sw[aria-checked="true"]{background:#FFD21F}.ht-dr .q-sw[aria-checked="true"]::after{left:19px;background:#0b0b10}
.ht-ph{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
.ht-cnt{font-size:12px;font-weight:650;padding:2px 10px;border-radius:999px;background:#FFD21F}
.ht-ps{max-height:360px;overflow-y:auto;border:1px solid #e5e9f0;border-radius:12px;padding:4px}
.ht-g{padding:4px 0}.ht-gh{display:flex;align-items:center;justify-content:space-between;padding:6px 10px 4px}.ht-gh b{font-size:12px;font-weight:650;text-transform:uppercase;letter-spacing:.04em;color:#6b7280}
.ht-gh button{border:0;background:none;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;padding:2px 6px;border-radius:6px}.ht-gh button:hover{background:#FFD21F}
.ht-p{display:flex;align-items:center;gap:10px;width:100%;padding:7px 10px;border:0;background:none;border-radius:9px;font:inherit;text-align:left;cursor:pointer}
.ht-p:hover{background:#f6f7f9}.ht-p.on{background:#fffde6}
.ht-ck{width:18px;height:18px;border-radius:5px;border:1.5px solid #cbd5e1;display:grid;place-items:center;flex:none}.ht-p.on .ht-ck{background:#0b0b10;border-color:#0b0b10;color:#FFD21F}.ht-ck svg{width:12px;height:12px}
.ht-p .av{width:30px;height:30px}.ht-pn{flex:1;min-width:0;display:flex;flex-direction:column}.ht-pn b{font-size:13.5px;font-weight:550}.ht-pn small{font-size:12px;color:#6b7280}
@media (max-width:1400px){.ht-lista{grid-template-columns:1fr}}
@media (max-width:860px){.ht-dc{grid-template-columns:1fr}}
</style>`);

/* Almuerzo: mientras corre, quien tiene el CRM abierto pasa sola a Ausente; al terminar vuelve a En línea (solo si
   el Ausente lo puso el almuerzo, no si la persona lo eligió). */
function htRevisarAlmuerzo(){
  const yo = CRM_YO && CRM_YO.id; if (!yo || !Array.isArray(CFG.turnos)) return;
  const almuerza = CFG.turnos.some(t => (t.ids || []).includes(yo) && htEstado(t) === 'almuerzo') && !CFG.turnos.some(t => (t.ids || []).includes(yo) && htEstado(t) === 'turno');
  let puesto = false; try { puesto = sessionStorage.getItem('crm-almuerzo') === '1'; } catch (e) {}
  if (almuerza && AJ.estado === 'En línea') { try { sessionStorage.setItem('crm-almuerzo', '1'); } catch (e) {} ponerEstado('Ausente'); toast('Hora de almuerzo: quedaste Ausente'); }
  else if (!almuerza && puesto) { try { sessionStorage.removeItem('crm-almuerzo'); } catch (e) {} if (AJ.estado === 'Ausente') { ponerEstado('En línea'); toast('Terminó el almuerzo: quedaste En línea'); } }
}
setInterval(htRevisarAlmuerzo, 60e3);
setTimeout(htRevisarAlmuerzo, 5e3);
