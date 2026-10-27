/* ── Difusiones rediseñadas (maqueta aprobada «Difusiones · A · Tabla con resultados», 27-oct) ──
 * Lista: resumen de los últimos 30 días, pestañas por estado y una barra por difusión con cuántos la recibieron, la
 * leyeron y respondieron; menú por fila con Duplicar, Pausar o Reanudar y Ver quién respondió.
 * Nueva difusión: una sola página con tres partes (a quién, qué mensaje, cuándo y por dónde); lo listo queda cerrado
 * con su resumen y la vista del celular, las personas y el costo van siempre a la derecha.
 * Reemplaza `difusion()` de 10-nucleo.js y su capa de 30-legal.js (las horas de la Ley 2300 siguen saliendo de
 * diasPermitidos y horarioLegal). Pausar escribe `pausa` en la difusión del ajuste; el motor (difusiones.ts) la respeta.
 */
const DF_IC_COPIA = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
const dfNum = x => (x || 0).toLocaleString('es-CO');
const dfUsd = x => x.toLocaleString('es-CO', {style: 'currency', currency: 'USD'});
const dfTarifa = nombre => ((TPL.find(t => t.n === nombre) || {}).c === 'Utilidad' ? 0.0008 : 0.0125);
const dfPinta = (el, html) => el.replaceChildren(document.createRange().createContextualFragment(html));

/** Estado de una difusión como lo muestra la lista: el del motor, más «Programada» y «Pausada por …» de la pantalla. */
function dfEstado(d){
  const v = difVista(d);
  if (d.pausa && v.est !== 'ok' && v.est !== 'b') return {...v, est: 'g', e: 'Pausada por ' + d.pausa, grupo: 'curso'};
  if (v.e === 'En cola' && d.para && Date.parse(d.para) > Date.now() + 60000) return {...v, est: 'p', e: 'Programada', grupo: 'prog'};
  return {...v, grupo: v.est === 'ok' ? 'ok' : v.est === 'b' ? 'error' : 'curso'};
}
const DF_TABS = [['todas', 'Todas'], ['prog', 'Programadas'], ['curso', 'Enviando'], ['ok', 'Enviadas'], ['error', 'Con error']];

function dfBarra(v){
  if (!v.env) return '<span class="df-nada">Aún no sale</span>';
  const tot = Math.max(v.total, v.env, 1), p = x => (Math.max(0, x) / tot * 100).toFixed(2) + '%';
  return `<div class="df-res"><div class="df-bar"><b style="width:${p(v.resp)};background:#0b0b10"></b><b style="width:${p(v.le - v.resp)};background:#FFD21F;animation-delay:.1s"></b><b style="width:${p(v.ent - v.le)};background:#fde68a;animation-delay:.2s"></b><b style="width:${p(v.env - v.ent)};background:#e5e7eb;animation-delay:.3s"></b></div>
    <div class="df-cif"><span><b>${dfNum(v.resp)}</b> respondieron</span><span><b>${v.ent ? Math.round(v.le / v.ent * 100) : 0} %</b> leyeron</span><span>${dfNum(v.ent)} recibidos</span></div></div>`;
}

function paginaDifusiones(el){
  const tab = st.difTab || 'todas', hace30 = Date.now() - 30 * 864e5;
  const filas = DIFUSIONES.map(d => ({d, v: dfEstado(d)}));
  const cuenta = g => g === 'todas' ? filas.length : filas.filter(f => f.v.grupo === g).length;
  const mes = filas.filter(f => f.v.env && Date.parse(f.d.para || 0) >= hace30);
  const s = mes.reduce((a, {d, v}) => ({env: a.env + v.env, ent: a.ent + v.ent, le: a.le + v.le, resp: a.resp + v.resp, usd: a.usd + v.env * dfTarifa(d.t)}), {env: 0, ent: 0, le: 0, resp: 0, usd: 0});
  const ver = filas.filter(f => tab === 'todas' || f.v.grupo === tab);
  dfPinta(el, `<div class="pg-h"><div><h2>Difusiones</h2><p class="sub">Mensajes a muchos clientes a la vez con plantillas aprobadas por Meta.</p></div><button type="button" class="btn pri" id="b-dif">${I('plus')}Nueva difusión</button></div>
    ${s.env ? `<div class="df-mes"><span class="t">Últimos 30 días</span><span><b>${dfNum(s.env)}</b> enviados</span><span><b>${s.ent ? Math.round(s.le / s.ent * 100) : 0} %</b> leyeron</span><span><b>${s.ent ? Math.round(s.resp / s.ent * 100) : 0} %</b> respondieron</span><span><b>${dfUsd(s.usd)}</b> estimados en Meta</span></div>` : ''}
    <div class="df-tabs" role="tablist">${DF_TABS.map(([k, t]) => `<button type="button" role="tab" data-df-tab="${k}" aria-selected="${tab === k}">${t}<em>${cuenta(k)}</em></button>`).join('')}</div>
    <table class="df-tb"><thead><tr><th>Difusión</th><th>Estado</th><th>Resultado</th><th>Fecha</th><th><span class="sr">Acciones</span></th></tr></thead><tbody>
    ${ver.length ? ver.map(({d, v}, i) => `<tr style="animation-delay:${Math.min(i, 12) * 50}ms"><td><b>${esc(d.n)}</b><small>${esc([d.t, d.a].filter(Boolean).join(' · '))}</small></td>
      <td><span class="est ${v.est}"${v.motivo ? ` title="${esc(v.motivo)}"` : ''}>${esc(v.curso && v.est === 'w' && v.total ? `Enviando · ${dfNum(v.env)} de ${dfNum(v.total)}` : v.e)}</span>${v.fal ? `<small class="df-fal">${dfNum(v.fal)} no llegaron</small>` : ''}</td>
      <td>${dfBarra(v)}</td><td class="df-f">${esc(d.f || '—')}</td>
      <td><button type="button" class="btn ic df-mas" data-df-menu="${esc(d.id)}" aria-label="Más opciones de ${esc(d.n)}" aria-haspopup="menu">${I('more')}</button></td></tr>`).join('')
      : `<tr class="df-vacia"><td colspan="5">${DIFUSIONES.length ? 'No hay difusiones en esta pestaña.' : 'Todavía no hay difusiones. Crea la primera con «Nueva difusión».'}</td></tr>`}
    </tbody></table>`);
}

/* ── Menú de cada fila y panel de quién respondió ── */
const dfMenu = document.createElement('div');
dfMenu.className = 'df-menu'; dfMenu.setAttribute('role', 'menu'); dfMenu.hidden = true;
document.body.appendChild(dfMenu);
let dfMenuDe = null;
function dfCerrarMenu(){ if (dfMenu.hidden) return; dfMenu.hidden = true; const b = document.querySelector(`[data-df-menu][aria-expanded="true"]`); if (b) b.setAttribute('aria-expanded', 'false'); dfMenuDe = null; }
function dfAbrirMenu(b){
  const d = DIFUSIONES.find(x => x.id === b.dataset.dfMenu); if (!d) return;
  dfCerrarMenu(); dfMenuDe = d.id; b.setAttribute('aria-expanded', 'true');
  const v = dfEstado(d), sigue = v.grupo === 'prog' || v.grupo === 'curso';
  dfPinta(dfMenu, `<button type="button" role="menuitem" data-df-dup>${DF_IC_COPIA}Duplicar</button>
    ${sigue ? (d.pausa ? `<button type="button" role="menuitem" data-df-pausa="0">${I('play')}Reanudar envío</button>` : `<button type="button" role="menuitem" data-df-pausa="1">${I('pause')}Pausar envío</button>`) : ''}
    ${v.resp ? `<button type="button" role="menuitem" data-df-resp>${I('users')}Ver quién respondió</button>` : ''}`);
  dfMenu.hidden = false;
  const r = b.getBoundingClientRect(), w = dfMenu.offsetWidth, h = dfMenu.offsetHeight;
  dfMenu.style.left = Math.max(8, r.right - w) + 'px';
  dfMenu.style.top = (r.bottom + 6 + h > innerHeight - 8 ? r.top - h - 6 : r.bottom + 6) + 'px';
}

const dfPanel = document.createElement('aside');
dfPanel.className = 'df-panel'; dfPanel.hidden = true; dfPanel.setAttribute('aria-label', 'Quién respondió');
document.body.appendChild(dfPanel);
async function dfVerRespuestas(d){
  const pinta = cuerpo => dfPinta(dfPanel, `<div class="df-ph"><div><b>Respondieron</b><small>${esc(d.n)} · se abren en la bandeja con su asesor</small></div><button type="button" class="btn ic df-x" data-df-cerrar aria-label="Cerrar">${I('x')}</button></div><div class="df-pl">${cuerpo}</div>`);
  pinta('<p class="df-nada">Cargando…</p>');
  dfPanel.hidden = false; requestAnimationFrame(() => dfPanel.classList.add('in'));
  try {
    const L = await crmApi('GET', `/crm/difusiones/${encodeURIComponent(d.id)}/respondieron`);
    pinta(L.length ? L.map((r, i) => `<button type="button" class="df-r" data-df-conv="${r.convId}" style="animation-delay:${Math.min(i, 15) * 35}ms"><span class="av" style="background:${AVC[r.convId % AVC.length]}">${esc(ini(r.nombre || '?'))}</span><span class="df-rt"><b>${esc(r.nombre || 'Sin nombre')}</b><small>${esc(r.texto ? '«' + r.texto + '»' : 'Mensaje sin texto')}</small></span><time>${esc(hcCuando(Date.parse(r.en)))}</time></button>`).join('')
      : '<p class="df-nada">Las respuestas de esta difusión son de conversaciones que no ves.</p>');
  } catch (err) { pinta(`<p class="df-nada">${esc(err.message)}</p>`); }
}
function dfCerrarPanel(){ if (dfPanel.hidden) return; dfPanel.classList.remove('in'); setTimeout(() => { if (!dfPanel.classList.contains('in')) dfPanel.hidden = true; }, 260); }

/** Duplicar: abre «Nueva difusión» con el mismo público, plantilla y línea. */
function dfDuplicar(d){
  const etapas = Array.isArray(d.etapas) ? d.etapas : [];
  const publico = d.publico === 'sel' ? 'etapas' : d.publico || 'etapas';
  st.dif = {abierta: 3, aud: new Set(etapas), publico, tpl: TPL.some(t => t.n === d.t) ? d.t : (TPL[0] || {}).n || '', linea: LINEAS.some(l => l.id === d.linea) ? d.linea : (LINEAS[0] || {}).id || null, cuando: 'ahora', ritmo: d.ritmo || 200};
  if (d.publico === 'sel') { st.dif.abierta = 1; toast('Esa difusión fue a contactos elegidos a mano: elige de nuevo a quién le llega'); }
  render();
}

/* ── Nueva difusión ── */
function dfPartes(d){
  const {segD, ids} = difPublico(d), total = ids.length;
  const tpl = TPL.find(t => t.n === d.tpl && tplEnLinea(t, d.linea)) || null;
  return {segD, total, tpl, costo: total * (tpl && tpl.c === 'Utilidad' ? 0.0008 : 0.0125)};
}
/** El texto de la plantilla con las variables de ejemplo resaltadas, como lo verá el cliente. */
function dfVistaTexto(x){
  const ej = {nombre: 'Valentina', asesor: yo || 'tu asesor', producto: 'el producto que le interesa'};
  return esc(x || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => `<span class="df-v">${esc(ej[k] || k)}</span>`);
}

difusion = function(){
  const d = st.dif, el = document.getElementById('page');
  if (!d.aud) d.aud = new Set();
  if (!d.publico) d.publico = 'etapas';
  const {segD, total, tpl, costo} = dfPartes(d);
  const AUD = audiencia(), SEGS = [...SEGMENTOS, ...st.ct.propios];
  if (!d.abierta) d.abierta = !total ? 1 : !tpl ? 2 : 3;
  // Cuándo: ahora (si la ley lo permite) o un día y una hora permitidos (30-legal.js).
  const hl = horarioLegal(); if (d.cuando === 'ahora' && !hl.ok) d.cuando = 'prog';
  const dias = diasPermitidos(); if (!dias.find(x => x[0] === d.dia)) d.dia = dias[0][0];
  const dia = dias.find(x => x[0] === d.dia), horas = []; for (let m = dia[2]; m <= dia[3] - 30; m += 30) horas.push([String(m), fmtMin(m)]);
  if (!horas.find(x => x[0] === d.hora)) d.hora = horas[0][0];
  const cuandoTxt = d.cuando === 'ahora' ? 'Ahora' : `${dia[1]} · ${fmtMin(+d.hora)}`;
  const linea = LINEAS.find(l => l.id === d.linea), ritmo = d.ritmo || 200;
  const resumen = [
    !total ? 'Elige a quién le llega' : `${d.publico === 'sel' ? `Los ${d.seleccion} contactos elegidos` : segD ? 'Segmento: ' + segD.n : [...d.aud].join(' y ')} · ${dfNum(total)} ${total === 1 ? 'persona' : 'personas'}`,
    tpl ? `${tpl.n} · ${tpl.c || 'Marketing'}` : TPL.length ? 'Elige una plantilla aprobada' : 'Todavía no hay plantillas aprobadas por Meta',
    linea ? `${linea.n} · ${cuandoTxt}` : 'Elige la línea de salida'];
  const listo = [total > 0, !!tpl, !!linea];
  const parte = (n, titulo, cuerpo) => { const ab = d.abierta === n, ok = listo[n - 1] && !ab;
    return `<section class="df-sec${ab ? ' ab' : ''}" style="animation-delay:${(n - 1) * 60}ms"><div class="df-sh"><span class="df-n${ok ? ' ok' : ''}">${ok ? I('check') : n}</span><div><b>${titulo}</b><small>${esc(resumen[n - 1])}</small></div>${ab ? '' : `<button type="button" class="btn" data-df-abrir="${n}">${I('pen')}Cambiar</button>`}</div>${ab ? `<div class="df-sb">${cuerpo()}</div>` : ''}</section>`; };
  const quien = () => `<div class="df-seg">${[['etapas', 'Etapas del embudo'], ['seg', 'Un segmento'], ...(d.seleccion ? [['sel', 'Elegidos en Contactos']] : [])].map(([k, t]) => `<button type="button" data-df-pub="${k}" aria-pressed="${k === 'seg' ? d.publico.startsWith('seg:') || d.publico === 'seg' : d.publico === k}">${t}</button>`).join('')}</div>
    ${d.publico === 'etapas' ? `<div class="df-chips">${AUD.map(([n, c]) => `<button type="button" data-df-aud="${esc(n)}" aria-pressed="${d.aud.has(n)}">${esc(n)} <b>${dfNum(c)}</b></button>`).join('')}</div>`
      : d.publico === 'sel' ? `<p class="df-nota" style="margin-top:0">Los ${d.seleccion} contactos que elegiste en Contactos.</p>`
      : SEGS.length ? `<div class="df-chips">${SEGS.map(x => `<button type="button" data-df-pub="seg:${esc(x.id)}" aria-pressed="${d.publico === 'seg:' + x.id}">${esc(x.n)}</button>`).join('')}</div>` : '<p class="df-nota" style="margin-top:0">Todavía no hay segmentos. Créalos en Contactos.</p>'}
    <p class="df-nota">No se cuentan los que pidieron no recibir mensajes, los del Registro de Números Excluidos que no han autorizado a la empresa ni los que ya recibieron esta plantilla en los últimos 7 días.</p>`;
  const usables = TPL.filter(t => tplEnLinea(t, d.linea));
  const mensaje = () => usables.length ? `<div class="df-tpls">${usables.map(t => `<button type="button" data-df-tpl="${esc(t.n)}" aria-pressed="${tpl && tpl.n === t.n}"><span><b>${esc(t.n)}</b><em class="est ${t.c === 'Utilidad' ? 'g' : 'p'}">${esc(t.c || 'Marketing')}</em></span><small>${esc(t.x)}</small></button>`).join('')}</div>
    <p class="df-nota">La difusión llena sola {{nombre}}, {{asesor}} y {{producto}} con los datos de cada contacto.</p>`
    : `<p class="df-nota" style="margin-top:0">${TPL.length ? 'Ninguna plantilla aprobada es del equipo de esta línea. Cambia la línea o crea una en Plantillas.' : 'Todavía no hay plantillas aprobadas por Meta. Créalas en Plantillas.'}</p>`;
  const envio = () => `<div class="df-dos"><div class="fld">Línea de salida${ddSel('data-df-lin', LINEAS.map(l => [l.id, `${l.n} · ${l.tel}`]), d.linea)}</div><div class="fld">Cuándo${ddSel('data-df-cu', [['ahora', hl.ok ? 'Ahora' : 'Ahora no: fuera del horario permitido'], ['prog', 'Programar']], d.cuando)}</div></div>
    ${d.cuando === 'prog' ? `<div class="df-dos"><div class="fld">Día${ddSel('data-df-dia', dias.map(x => [x[0], x[1]]), d.dia)}</div><div class="fld">Hora${ddSel('data-df-hora', horas, d.hora)}</div></div>` : ''}
    <p class="df-nota">Solo se ofrecen las horas que permite la Ley 2300. Sale a <span class="df-rit">${[200, 500].map(r => `<button type="button" data-df-rit="${r}" aria-pressed="${ritmo === r}">${r} por hora</button>`).join('')}</span>: tarda unas ${Math.max(1, Math.ceil(total / ritmo))} h.</p>
    ${tpl ? difVia(tpl, d.linea) : ''}`;
  const puede = total > 0 && !!tpl && !!linea;
  dfPinta(el, `<div class="pg-h"><div class="df-tit"><button type="button" class="btn ic" id="d-x" aria-label="Volver a difusiones">${I('back')}</button><div><h2>Nueva difusión</h2><p class="sub">Todo en una página: revisa cada parte y envía.</p></div></div></div>
    <div class="df-nueva"><div>${parte(1, 'A quién', quien)}${parte(2, 'Qué mensaje', mensaje)}${parte(3, 'Cuándo y por dónde', envio)}</div>
    <aside class="df-lado"><div class="df-cel"><div class="df-cel-sc"><div class="df-cel-top"><i>${esc(ini(linea ? linea.n : 'W'))}</i><div>${esc(linea ? linea.n : 'Tu empresa')}<small>Cuenta de empresa</small></div></div>
      ${tpl ? `<div class="df-cel-b" data-k="${esc(tpl.n)}">${dfVistaTexto(tpl.x)}<small>${hcHora(Date.now())}</small></div>${tpl.boton ? `<div class="df-cel-cta">${esc(tpl.boton)}</div>` : ''}` : '<p class="df-cel-v">Aquí verás el mensaje como le llega al cliente.</p>'}</div></div>
      <div class="df-tot"><div><span>Personas</span><b>${dfNum(total)}</b></div><div><span>Costo estimado en Meta</span><b>${dfUsd(costo)}</b></div></div>
      <button type="button" class="btn pri df-go" id="df-go"${puede ? '' : ` disabled title="${esc(!total ? 'Elige a quién le llega' : !tpl ? 'Falta una plantilla aprobada' : 'Elige la línea de salida')}"`}>${I('send')}${d.cuando === 'ahora' ? 'Enviar a' : 'Programar para'} ${dfNum(total)} ${total === 1 ? 'persona' : 'personas'}</button>
      <p class="df-nota">Cuando alguien responda, la conversación se abre en la bandeja y el reparto se la entrega a su asesor o al siguiente del turno.</p></aside></div>`);
};

function dfEnviar(){
  const d = st.dif, {total, tpl} = dfPartes(d);
  if (!total || !tpl) return;
  if (!d.n) d.n = `${tpl.n} · ${(p => `${p.d} de ${HC_MES_L[p.m]}`)(hcPartes(Date.now()))}`;
  d.tpl = tpl.n;
  if (d.cuando === 'ahora') {
    if (!horarioLegal().ok) { toast(`Ahora no se puede enviar: ${horarioLegal().motivo} Prográmala.`); return; }
    DIFUSIONES.unshift(difNueva(d)); st.dif = null; render(); toast(`Difusión en cola para ${dfNum(total)} personas`); return;
  }
  const dia = diasPermitidos().find(x => x[0] === d.dia), min = +d.hora, cuando = `${dia[1]} · ${fmtMin(min)}`;
  const para = `${dia[0]}T${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}:00-05:00`;
  DIFUSIONES.unshift(difNueva(d, {f: cuando, e: 'Programada', para}));
  st.dif = null; render(); toast(`Difusión programada: ${cuando.toLowerCase()}`);
}

document.addEventListener('click', e => {
  const t = e.target instanceof Element ? e.target : null; if (!t) return;
  if (!t.closest('.df-menu') && !t.closest('[data-df-menu]')) dfCerrarMenu();
  if (!dfPanel.hidden && !t.closest('.df-panel') && !t.closest('[data-df-resp]')) dfCerrarPanel();
  if (st.pagina !== 'difusiones') return;
  const mb = t.closest('[data-df-menu]'); if (mb) { dfMenuDe === mb.dataset.dfMenu ? dfCerrarMenu() : dfAbrirMenu(mb); return; }
  if (t.closest('#b-dif')) {
    // El líder (st.rol 'l'); a quien configura sin liderar lo atiende 62-vistas-rol.js antes que esto.
    if (st.rol !== 'l') { toast('Las difusiones las envía el líder de Ventas'); return; }
    st.dif = {aud: new Set(['En seguimiento', 'Sin respuesta']), tpl: (TPL[0] || {}).n || '', linea: (LINEAS[0] || {}).id || null, cuando: 'ahora'}; render(); return;
  }
  const tb = t.closest('[data-df-tab]'); if (tb) { st.difTab = tb.dataset.dfTab; render(); return; }
  const dm = dfMenuDe && DIFUSIONES.find(x => x.id === dfMenuDe);
  if (dm && t.closest('[data-df-dup]')) { dfCerrarMenu(); dfDuplicar(dm); return; }
  const pa = t.closest('[data-df-pausa]'); if (dm && pa) {
    dfCerrarMenu();
    if (pa.dataset.dfPausa === '1') { dm.pausa = yo || 'alguien del equipo'; toast('Difusión pausada: no sale nada más hasta que la reanudes'); }
    else { delete dm.pausa; toast('Difusión reanudada: sigue en el siguiente minuto permitido'); }
    render(); return;
  }
  if (dm && t.closest('[data-df-resp]')) { dfCerrarMenu(); dfVerRespuestas(dm); return; }
  const d = st.dif; if (!d) return;
  if (t.closest('#d-x')) { st.dif = null; render(); return; }
  const ab = t.closest('[data-df-abrir]'); if (ab) { d.abierta = +ab.dataset.dfAbrir; render(); return; }
  const pu = t.closest('[data-df-pub]'); if (pu) { const k = pu.dataset.dfPub; d.publico = k === 'seg' ? 'seg:' + (([...SEGMENTOS, ...st.ct.propios][0] || {}).id || '') : k; render(); return; }
  const au = t.closest('[data-df-aud]'); if (au) { const n = au.dataset.dfAud; d.aud.has(n) ? d.aud.delete(n) : d.aud.add(n); render(); return; }
  const tp = t.closest('[data-df-tpl]'); if (tp) { d.tpl = tp.dataset.dfTpl; d.abierta = 3; render(); return; }
  const li = t.closest('[data-df-lin]'); if (li) { d.linea = li.dataset.dfLin; render(); return; }
  const cu = t.closest('[data-df-cu]'); if (cu) { if (cu.dataset.dfCu === 'ahora' && !horarioLegal().ok) { toast(`Ahora no se puede enviar: ${horarioLegal().motivo} Prográmala.`); return; } d.cuando = cu.dataset.dfCu; render(); return; }
  const di = t.closest('[data-df-dia]'); if (di) { d.dia = di.dataset.dfDia; d.hora = null; render(); return; }
  const ho = t.closest('[data-df-hora]'); if (ho) { d.hora = ho.dataset.dfHora; render(); return; }
  const ri = t.closest('[data-df-rit]'); if (ri) { d.ritmo = +ri.dataset.dfRit; render(); return; }
  if (t.closest('#df-go')) dfEnviar();
});
dfPanel.addEventListener('click', e => {
  const t = e.target instanceof Element ? e.target : null; if (!t) return;
  if (t.closest('[data-df-cerrar]')) { dfCerrarPanel(); return; }
  const r = t.closest('[data-df-conv]'); if (!r) return;
  const id = +r.dataset.dfConv;
  if (!CONV.some(c => c.id === id)) { toast('Esa conversación ya está cerrada: búscala en Contactos'); return; }
  dfCerrarPanel(); ctAbrirConv(id);
});
document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (!dfMenu.hidden) dfCerrarMenu(); else dfCerrarPanel(); });
addEventListener('scroll', dfCerrarMenu, true);
addEventListener('resize', dfCerrarMenu);

document.head.insertAdjacentHTML('beforeend', `<style>
.df-mes{display:flex;flex-wrap:wrap;gap:8px 28px;padding:14px 18px;border:1px solid var(--line2);border-radius:12px;margin-bottom:18px;font-size:13px;color:var(--ink2)}
.df-mes .t{font-weight:600;color:var(--ink)}.df-mes b{color:var(--ink)}
.df-tabs{display:flex;flex-wrap:wrap;gap:4px;border-bottom:1px solid var(--line2);margin-bottom:6px}
.df-tabs button{padding:8px 12px;font-size:13px;font-weight:500;color:var(--ink3);border-bottom:2px solid transparent;margin-bottom:-1px;white-space:nowrap;transition:color .15s}
.df-tabs button:hover{color:var(--ink)}
.df-tabs button[aria-selected="true"]{color:#0b0b10;border-color:#0b0b10}
.df-tabs em{font-style:normal;margin-left:6px;font-size:11.5px;color:var(--ink4)}
.df-tb{width:100%;border-collapse:collapse;font-size:13.5px}
.df-tb th{text-align:left;font-size:12px;font-weight:500;color:var(--ink3);padding:8px 10px}
.df-tb td{padding:14px 10px;border-top:1px solid var(--line2);vertical-align:middle}
.df-tb td:last-child{text-align:right;width:52px}
.df-tb tbody tr{animation:df-entra .45s cubic-bezier(.16,1,.3,1) both}
.df-tb td b{font-weight:600}.df-tb td small{display:block;font-size:12.5px;color:var(--ink3)}
.df-tb small.df-fal{color:var(--red-ink);font-size:12px;margin-top:4px}
.df-tb .df-f{color:var(--ink3);white-space:nowrap}
.df-tb .df-vacia td{color:var(--ink3);padding:22px 10px}
.df-tb .est.p{background:#eef2ff;color:#4338ca}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.df-nada{font-size:12.5px;color:var(--ink3)}
.df-res{display:grid;gap:5px;min-width:240px}
.df-bar{height:6px;border-radius:99px;background:var(--bg3);overflow:hidden;display:flex}
.df-bar b{display:block;height:100%;transform-origin:left;animation:df-llena .9s cubic-bezier(.16,1,.3,1) both .15s}
.df-cif{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12px;color:var(--ink2)}.df-cif b{color:var(--ink)}
.df-menu{position:fixed;z-index:60;min-width:210px;background:#fff;border:1px solid var(--line);border-radius:12px;box-shadow:0 20px 40px -18px rgba(15,23,42,.35);padding:6px;animation:df-sube .22s cubic-bezier(.16,1,.3,1)}
.df-menu button{display:flex;width:100%;gap:9px;align-items:center;padding:8px 10px;border-radius:8px;font-size:13px;color:var(--ink)}
.df-menu button:hover,.df-menu button:focus-visible{background:var(--hover)}
.df-panel{position:fixed;z-index:61;top:12px;right:12px;bottom:12px;width:min(380px,calc(100vw - 24px));background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:0 30px 60px -24px rgba(15,23,42,.4);display:flex;flex-direction:column;transform:translateX(24px);opacity:0;transition:transform .3s cubic-bezier(.16,1,.3,1),opacity .2s}
.df-panel.in{transform:none;opacity:1}
.df-ph{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;padding:16px 16px 12px;border-bottom:1px solid var(--line2)}
.df-ph b{font-size:15px}.df-ph small{display:block;font-size:12.5px;color:var(--ink3)}
.df-x{color:var(--red-ink)}
.df-pl{overflow-y:auto;padding:6px 8px 12px}.df-pl .df-nada{padding:10px}
.df-r{display:flex;width:100%;gap:10px;align-items:center;text-align:left;padding:9px 8px;border-radius:10px;animation:df-entra .4s cubic-bezier(.16,1,.3,1) both}
.df-r:hover{background:var(--hover)}
.df-r .av{width:30px;height:30px;font-size:11px;flex:none}
.df-rt{flex:1;min-width:0}.df-rt b{display:block;font-size:13px;font-weight:600}.df-rt small{display:block;font-size:12px;color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.df-r time{font-size:11.5px;color:var(--ink4);white-space:nowrap}
.df-tit{display:flex;gap:12px;align-items:center}
.df-nueva{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:24px;align-items:start}
.df-sec{border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin-bottom:12px;animation:df-entra .45s cubic-bezier(.16,1,.3,1) both;transition:border-color .2s}
.df-sec.ab{border-color:#0b0b10}
.df-sh{display:flex;align-items:center;gap:12px}.df-sh>div{flex:1;min-width:0}
.df-sh .btn{height:30px;padding:0 10px;font-size:12.5px;flex:none}.df-sh .btn svg{width:14px;height:14px}
.df-sh b{font-size:14.5px}.df-sh small{display:block;font-size:12.5px;color:var(--ink3)}
.df-n{width:26px;height:26px;flex:none;border-radius:50%;display:grid;place-items:center;font-size:12.5px;font-weight:700;background:#FFD21F;color:#0b0b10}
.df-n.ok{background:#0b0b10;color:#FFD21F}.df-n svg{width:14px;height:14px}
.df-sb{margin-top:14px;display:grid;gap:10px;animation:df-sube .35s cubic-bezier(.16,1,.3,1)}
.df-seg,.df-chips{display:flex;flex-wrap:wrap;gap:6px}
.df-seg button,.df-chips button,.df-rit button{height:30px;padding:0 11px;border-radius:9px;border:1px solid var(--line);font-size:12.5px;font-weight:500;transition:background .15s,color .15s,border-color .15s}
.df-chips button b{font-weight:600;opacity:.7;margin-left:2px}
:is(.df-seg,.df-chips,.df-rit) button[aria-pressed="true"]{background:#0b0b10;border-color:#0b0b10;color:#fff}
.df-rit{display:inline-flex;gap:4px;vertical-align:middle}.df-rit button{height:24px;padding:0 8px;font-size:12px}
.df-nota{margin:0;font-size:12px;color:var(--ink3)}
.df-tpls{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.df-tpls button{display:grid;gap:4px;text-align:left;border:1px solid var(--line);border-radius:12px;padding:11px 13px;transition:border-color .15s,box-shadow .15s}
.df-tpls button[aria-pressed="true"]{border-color:#0b0b10;box-shadow:0 0 0 3px #fff3b0}
.df-tpls span{display:flex;justify-content:space-between;gap:8px;align-items:center}.df-tpls b{font-size:13.5px}
.df-tpls em{font-style:normal;height:22px;font-size:11.5px}
.df-tpls small{font-size:12.5px;color:var(--ink3);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.df-dos{display:grid;grid-template-columns:1fr 1fr;gap:10px}.df-dos .dsel{min-width:0!important}
.df-lado{position:sticky;top:0;display:grid;gap:12px}
.df-cel{width:280px;justify-self:center;border-radius:30px;background:#0b0b10;padding:10px}
.df-cel-sc{border-radius:22px;background:#efe7dc;height:400px;overflow:hidden}
.df-cel-top{background:#f6f6f6;padding:12px 14px;display:flex;gap:9px;align-items:center;font-size:13px;font-weight:600}
.df-cel-top i{width:28px;height:28px;border-radius:50%;background:#FFD21F;display:grid;place-items:center;font-style:normal;font-size:11px}
.df-cel-top small{display:block;font-size:11px;font-weight:400;color:var(--ink3)}
.df-cel-b{margin:14px 12px 0;background:#fff;border-radius:4px 12px 12px 12px;padding:9px 11px 6px;font-size:13px;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere;box-shadow:0 1px 1px rgba(0,0,0,.06);animation:df-sube .5s cubic-bezier(.16,1,.3,1)}
.df-cel-b small{display:block;text-align:right;font-size:10.5px;color:#8696a0;margin-top:2px}
.df-cel-cta{margin:0 12px;background:#fff;border-top:1px solid var(--line2);border-radius:0 0 12px 12px;text-align:center;padding:8px;color:#0b84d8;font-size:13px;font-weight:500}
.df-cel-v{margin:30px 22px;text-align:center;font-size:12.5px;color:#6b7280}
.df-v{background:#fff3b0;border-radius:4px;padding:0 2px}
.df-tot{border:1px solid var(--line2);border-radius:12px;padding:12px 14px;font-size:13px;display:grid;gap:6px}
.df-tot div{display:flex;justify-content:space-between}.df-tot span{color:var(--ink3)}
.df-go{width:100%;justify-content:center;height:42px}
@keyframes df-entra{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@keyframes df-sube{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes df-llena{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@media (max-width:960px){.df-nueva{grid-template-columns:1fr}.df-lado{position:static}}
@media (max-width:560px){.df-tpls,.df-dos{grid-template-columns:1fr}.df-res{min-width:160px}}
@media (prefers-reduced-motion:reduce){.df-tb tbody tr,.df-bar b,.df-menu,.df-sec,.df-sb,.df-cel-b,.df-r{animation:none}.df-panel{transition:none}}
</style>`);
