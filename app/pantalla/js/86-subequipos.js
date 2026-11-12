/* ── Equipos y subequipos (maquetas aprobadas «Equipos y subequipos», 1-nov) ──
   · Un subequipo puede tener gente que no es del equipo: recibe solo lo que se pase a ese subequipo. Se maneja desde
     el «Editar» de cada subequipo, con un buscador de toda la empresa (gente del equipo primero).
   · Cada X quita solo de donde se toca y antes pregunta en un modal; si la persona tiene conversaciones abiertas de
     ahí, pregunta si se reparten con la regla del equipo o del subequipo o se le dejan (POST /crm/equipos/repartir,
     después de guardar los equipos).
   · «Agregar persona», «Invitar por correo» y «Editar a…» en dos columnas: a la izquierda la persona y sus datos; a la
     derecha cada equipo con su rol (Líder o Miembro, en un desplegable) y sus subequipos colgando como un árbol. Se
     pueden marcar subequipos sin marcar el equipo. Abajo dice dónde queda antes de guardar.
   · Selectores de círculo y punto en todo el CRM; el máximo de conversaciones abiertas vacío es ilimitado. */

/* Lo que se eligió repartir al sacar a alguien: se manda después de guardar los equipos. */
const SUB_REPARTIR = [];
function subRepartirPendientes(){
  if (!SUB_REPARTIR.length) return;
  const lista = SUB_REPARTIR.splice(0);
  crmDatos.guardarYa(['equipos']).then(r => {
    if (!(r || []).every(x => x !== false)) { toast('No se repartieron sus conversaciones: los equipos no se guardaron'); return; }
    return Promise.all(lista.map(p => crmApi('POST', '/crm/equipos/repartir', p))).then(rs => {
      const n = rs.reduce((a, b) => a + ((b && b.repartidas) || 0), 0);
      if (n) toast(n === 1 ? 'Una conversación se reparte de nuevo' : `${n} conversaciones se reparten de nuevo`);
    });
  }).catch(err => toast(err.message || 'No se pudieron repartir sus conversaciones'));
}
/** Conversaciones abiertas de esa persona en ese equipo (las que no son de un subequipo donde sigue) o en ese subequipo. */
function subCuenta(id, eq, subId, sigue){
  return CONV.filter(c => c.asigId === id && c.est !== 'finalizadas' && equipoConv(c) === eq
    && (subId ? c.subequipo === subId : !(c.subequipo && sigue && sigue.has(c.subequipo)))).length;
}
/** Hasta 3 fotos y «+N» (el número centrado en SVG, como las tarjetas de equipos). */
function subPila(gente){
  const mas = gente.length - 3;
  const n = mas > 0 ? (() => { const w = mas < 10 ? 34 : mas < 100 ? 38 : 44; return `<svg class="sub-mas" width="${w}" height="28" viewBox="0 0 ${w} 28" role="img" aria-label="${mas} personas más"><rect width="${w}" height="28" rx="14" fill="#FFD21F"/><text x="${w / 2}" y="14" text-anchor="middle" dominant-baseline="central" font-family="Inter,system-ui,sans-serif" font-size="11.5" font-weight="700" fill="#0b0b10">+${mas}</text></svg>`; })() : '';
  return `<span class="sub-pila">${gente.slice(0, 3).map(p => `<span class="q-p">${avPer(p)}</span>`).join('')}${n}</span>`;
}

document.head.insertAdjacentHTML('beforeend', `<style>
/* Selectores de círculo y punto en todo el CRM (los mismos de Llamadas y Plantillas). */
.eq-caja,.eqr-caja,.chk,.ht-ck,.bq-sel{width:18px!important;height:18px!important;border-radius:50%!important;border:2px solid #9ca3af!important;background:#fff!important;box-shadow:none!important;box-sizing:border-box;display:inline-grid;place-items:center;flex:none;padding:0}
.eq-caja svg,.eqr-caja svg,.chk svg,.ht-ck svg{display:none!important}
.eq-op[aria-checked="true"] .eq-caja,.eqr-caja.on,.chk.on,.ht-ck.on,.bq-sel.on,[aria-checked="true"] > .bq-sel{border-color:#0b0b10!important;background:#0b0b10!important;box-shadow:inset 0 0 0 3px #fff!important}
input[type="checkbox"]{appearance:none;-webkit-appearance:none;width:18px;height:18px;margin:0;border-radius:50%;border:2px solid #9ca3af;background:#fff;flex:none;cursor:pointer;vertical-align:middle;box-sizing:border-box}
input[type="checkbox"]:checked{border-color:#0b0b10;background:#0b0b10;box-shadow:inset 0 0 0 3px #fff}
input[type="checkbox"]:indeterminate{border-color:#0b0b10;background:linear-gradient(#0b0b10,#0b0b10) center/8px 2px no-repeat #fff}
input[type="checkbox"]:disabled{opacity:.5;cursor:default}
input[type="checkbox"]:focus-visible{outline:2px solid #0b0b10;outline-offset:2px}
/* Página del equipo: el rol en un desplegable y la gente de cada subequipo. */
.qe-x,.qe-x svg,.eqr-sqx,.eqr-sqx svg,.dlg-cerrar,.dlg-cerrar svg{color:#dc2626!important}
.rq-num[data-per-tope]{width:104px}
.qe-nm small{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.qe-dd{position:relative;flex:none}
.qe-ddb{display:inline-flex;align-items:center;justify-content:space-between;gap:8px;min-width:118px;height:34px;padding:0 10px 0 12px;border:1px solid #d6dbe3;border-radius:10px;background:#fff;font:inherit;font-size:13px;font-weight:600;color:#111827;cursor:pointer}
.qe-ddb svg{width:14px;height:14px;color:#6b7280;transition:transform .2s cubic-bezier(.2,0,0,1)}
.qe-ddb.lid{background:#FFF6CC;border-color:#F2D65C}
.qe-ddb.abierto{border-color:#0b0b10;box-shadow:0 0 0 3px rgba(11,11,16,.08)}.qe-ddb.abierto svg{transform:rotate(180deg)}
.qe-menu{right:0;top:calc(100% + 6px);width:270px}
.qe-menu .eqr-op b{display:block;font-size:13.5px;font-weight:600}.qe-menu .eqr-op small{display:block;font-size:12px;color:#6b7280;margin-top:2px}
.qe-menu .eqr-op > svg{width:15px;height:15px;margin-left:auto;align-self:center;flex:none}
.qe-per.sale{animation:sub-sale .32s cubic-bezier(.4,0,1,1) forwards}
@keyframes sub-sale{to{opacity:0;transform:translateX(12px)}}
.qe-subn{flex:1;min-width:0}.qe-subn b{display:block;font-size:14px}.qe-subn small{display:block;font-size:12.5px;color:#6b7280;line-height:1.35}
.sub-pila{display:flex;align-items:center;gap:4px;flex:none}.sub-pila .q-p .av{width:28px;height:28px}.sub-mas{display:block;flex:none}
/* Modales de quitar y avisos. */
.dlg.sub-dlg{width:min(460px,100%)}
.sub-dlg .sub-ic{width:52px;height:52px;border-radius:15px;display:grid;place-items:center;background:#FFF4C2;color:#7a5a00}
.sub-dlg .sub-ic svg{width:24px;height:24px}
.sub-dlg .sub-av .av{width:52px;height:52px;font-size:16px}
.sub-dlg h3{font-size:19px;font-weight:700;letter-spacing:-.015em}
.sub-dlg p{font-size:14px;line-height:1.55;color:#4b5563}
.sub-ops{display:grid;gap:8px}.sub-ops > small{font-size:12.5px;font-weight:700;color:#6b7280}
.sub-op{display:flex;align-items:flex-start;gap:12px;width:100%;padding:12px 14px;border:1px solid #e5e9f0;border-radius:12px;background:#fff;text-align:left;font:inherit;cursor:pointer}
.sub-op[aria-checked="true"]{border-color:#0b0b10;box-shadow:inset 0 0 0 1px #0b0b10}
.sub-op b{display:block;font-size:13.5px;font-weight:600;color:#111827}.sub-op em{display:block;font-style:normal;font-size:12.5px;color:#6b7280;margin-top:2px}
.sub-op .bq-sel{margin-top:1px}
.btn.sub-rojo{background:#dc2626;border-color:#dc2626;color:#fff}.btn.sub-rojo svg{color:#fff}
/* Editor del subequipo: gente de toda la empresa. */
.sub-bus{display:flex;align-items:center;gap:8px;height:42px;padding:0 12px;border:1px solid #d6dbe3;border-radius:11px;background:#fff}
.sub-bus svg{width:16px;height:16px;color:#9ca3af}.sub-bus input{border:0;outline:0;flex:1;font:inherit;font-size:14px;background:none;min-width:0}
.sub-bus:focus-within{border-color:#0b0b10}
.sub-lista{display:grid;gap:4px;max-height:300px;overflow-y:auto;overscroll-behavior:contain;padding:6px;border:1px solid #e5e9f0;border-radius:12px;scrollbar-width:thin}
.sub-g{font-size:12.5px;font-weight:700;color:#6b7280;padding:6px 6px 2px}
.sub-lista .eqr-chk{border:0;border-radius:9px;padding:8px}.sub-lista .eqr-chk[aria-checked="true"]{background:#f5f8ff}
.sub-lista .eqr-chk .av{width:30px;height:30px;font-size:11px}
.sub-pn{flex:1;min-width:0;text-align:left}.sub-pn b{display:block;font-size:13.5px;font-weight:600}.sub-pn small{display:block;font-size:12px;color:#6b7280}
.sub-vacio{padding:10px 8px;font-size:13px;color:#6b7280}
/* Agregar persona, Invitar y Editar a…: dos columnas con el árbol de equipos. */
.dlg:has(> .bq-cols){width:min(940px,100%);padding:0!important;gap:0;overflow:hidden}
.bq-h{padding:22px 24px 16px;border-bottom:1px solid #eef1f5}.bq-h h3{font-size:19px;font-weight:700}.bq-h p{margin-top:4px}
.bq-cols{display:grid;grid-template-columns:320px minmax(0,1fr)}
.bq-izq{padding:20px 22px;border-right:1px solid #eef1f5;background:#fbfbfc;display:flex;flex-direction:column;gap:14px;min-width:0}
.bq-der{padding:20px 22px;display:flex;flex-direction:column;gap:10px;min-width:0;max-height:min(62vh,560px);overflow-y:auto}
.bq-yo{display:flex;flex-direction:column;align-items:center;text-align:center;gap:6px}.bq-yo .av{width:64px;height:64px;font-size:20px}
.bq-yo b{font-size:16px}.bq-yo small{font-size:12.5px;color:#6b7280}
.bq-izq label,.bq-izq .fld{display:flex;flex-direction:column;gap:6px;font-size:12.5px;font-weight:600;color:#374151}
.bq-izq input:not([type="checkbox"]){height:40px;border:1px solid #d6dbe3;border-radius:10px;padding:0 12px;font:inherit;font-size:13.5px;font-weight:400;background:#fff}
.bq-izq small.muted{font-weight:400}
.bq-st{display:flex;align-items:center;font-size:12.5px;font-weight:700;color:#6b7280}.bq-st span{margin-left:auto;font-size:12px;font-weight:500;letter-spacing:0;text-transform:none;color:#9ca3af}
.bq-eq{border:1px solid #e5e9f0;border-radius:14px;background:#fff}
.bq-eq.on{border-color:#0b0b10;box-shadow:inset 0 0 0 1px #0b0b10}
.bq-eq.parcial{border-color:#c7d2fe;background:#fafbff}
.bq-cab{display:flex;align-items:center;gap:10px;padding:12px 14px}
.bq-chk{display:flex;align-items:center;gap:10px;flex:1;min-width:0;border:0;background:none;padding:0;text-align:left;font:inherit;cursor:pointer}
.bq-chk i{width:10px;height:10px;border-radius:50%;flex:none}
.bq-n{min-width:0}.bq-n b{display:block;font-size:14px;font-weight:650;color:#111827}.bq-n small{display:block;font-size:12.5px;color:#6b7280}
.bq-ramas{padding:0 14px 12px 24px;display:flex;flex-direction:column;gap:2px}
.bq-sub{position:relative;display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px 8px 26px;border:0;border-radius:9px;background:none;text-align:left;font:inherit;font-size:13.5px;color:#111827;cursor:pointer}
.bq-sub::before{content:"";position:absolute;left:8px;top:-4px;bottom:50%;width:12px;border-left:1.5px solid #dfe3ea;border-bottom:1.5px solid #dfe3ea;border-bottom-left-radius:6px}
.bq-sub[aria-checked="true"]{background:#f5f8ff}.bq-sub > span:not(.bq-sel){flex:1}.bq-sub small{font-size:12px;color:#9ca3af}
.bq-sub:disabled{opacity:.5;cursor:default}
.bq-dd{position:relative;flex:none}
.bq-ay{display:flex;gap:7px;font-size:12.5px;color:#6b7280;line-height:1.45}.bq-ay svg{width:15px;height:15px;flex:none;color:#9ca3af;margin-top:1px}
.bq-pie{display:flex;align-items:center;gap:12px;padding:14px 24px;border-top:1px solid #eef1f5;background:#fafbfc}
.bq-res{flex:1;min-width:0;display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12.5px;color:#6b7280}
.bq-tag{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border-radius:999px;background:#fff;border:1px solid #e5e9f0;font-size:12.5px;font-weight:500;color:#111827}
.bq-tag i{width:8px;height:8px;border-radius:50%}
.dlg:has(> .bq-cols) > .dlg-cerrar{top:18px;right:18px}
.dlg > .bq-pie:last-child{margin-bottom:0}
@media (max-width:760px){.bq-cols{grid-template-columns:1fr}.bq-izq{border-right:0;border-bottom:1px solid #eef1f5}.bq-der{max-height:none}.bq-pie{flex-wrap:wrap}}
@media (prefers-reduced-motion:reduce){.qe-per.sale{animation:none}}
</style>`);

/* ── Modal de quitar (y de aviso), con la pregunta de repartir ── */
const SUB_AVISO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l9.5 17h-19z"/><path d="M12 10v4M12 17.5v.01"/></svg>';
function subModal(o){
  st.subQ = {repartir: true, ...o};
  subPintarModal();
}
function subPintarModal(){
  const q = st.subQ; if (!q) return;
  const cab = q.persona ? `<span class="sub-av">${avPer(q.persona)}</span>` : `<span class="sub-ic">${SUB_AVISO}</span>`;
  const op = (v, b, s) => `<button type="button" class="sub-op" role="radio" aria-checked="${q.repartir === v}" data-subq-op="${v ? 1 : 0}"><span class="bq-sel"></span><span><b>${b}</b><em>${s}</em></span></button>`;
  const rep = q.cuenta ? `<div class="sub-ops" role="radiogroup" aria-label="Sus conversaciones abiertas"><small>Tiene ${q.cuenta} ${q.cuenta === 1 ? 'conversación abierta' : 'conversaciones abiertas'} de ${esc(q.lugar)}</small>
    ${op(true, q.repTitulo || `Repartirlas en ${esc(q.lugar)}`, q.repSub || `Con la regla de ${esc(q.lugar)}: ${esc(q.regla)}`)}${op(false, 'Dejárselas', 'Las sigue atendiendo hasta cerrarlas')}</div>` : '';
  const pie = q.boton
    ? `<button type="button" class="btn" data-subq-no="1">Cancelar</button><button type="button" class="btn sub-rojo" data-subq-ok="1">${I('x')}${esc(q.boton)}</button>`
    : `<button type="button" class="btn pri" data-subq-no="1">${esc(q.volver || 'Volver')}</button>`;
  abrirDialogo(`${cab}<h3>${esc(q.titulo)}</h3><p>${esc(q.texto)}</p>${rep}<div class="ft2">${pie}</div>`, 'sub-dlg');
  const b = document.querySelector('#dlg-x [data-subq-ok], #dlg-x [data-subq-no]'); if (b) b.focus({preventScroll: true});
}
document.getElementById('ov-x').addEventListener('click', e => {
  const q = st.subQ; if (!q) return;
  const o = e.target.closest('[data-subq-op]'); if (o) { q.repartir = o.dataset.subqOp === '1'; subPintarModal(); return; }
  if (e.target.closest('[data-subq-ok]')) { st.subQ = null; q.alSi(q.cuenta ? q.repartir : false); return; }
  // Cancelar, la X o tocar fuera: vuelve a donde estaba (el editor del subequipo o el diálogo de la persona).
  if (e.target.closest('[data-subq-no], [data-cerrar-dlg]') || e.target.id === 'ov-x') {
    st.subQ = null;
    if (q.alNo) { e.stopImmediatePropagation(); setTimeout(q.alNo, 0); } else cerrarDialogo();
  }
}, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && st.subQ) { const q = st.subQ; st.subQ = null; if (q.alNo) setTimeout(q.alNo, 0); } }, true);

/* ── Página del equipo: la X saca solo del equipo, con el modal ── */
function subQuitarDelEquipo(x, id){
  const p = personaDe(id); if (!p) return;
  const eq = eqrNom(x) || 'el equipo', subs = x.subs.filter(s => s.ids.includes(id));
  const cuenta = x.orig ? subCuenta(id, x.orig, null, new Set(subs.map(s => s.id))) : 0;
  subModal({
    persona: p, titulo: `¿Quitar a ${p.nombre} de ${eq}?`,
    texto: subs.length ? `Deja de recibir lo que llega a ${eq} sin subequipo. Sigue en ${unirNombres(subs.map(s => s.n))}, con sus conversaciones de ahí.` : `Deja de recibir lo que llega a ${eq}.`,
    cuenta, lugar: eq, regla: eqrMetodo(x.metodo)[1].toLowerCase(), boton: `Quitar de ${eq}`,
    alSi: repartir => {
      cerrarDialogo();
      if (repartir) (x.repartir = x.repartir || []).push({userId: id, equipo: x.orig, subequipo: null});
      const fila = document.querySelector(`#page [data-eqr-quitar="${CSS.escape(id)}"]`);
      const hecho = () => { if (st.eqDraft !== x) return; eqrQuitar(x, id); render(); };
      const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (fila && !quieto) { fila.closest('.qe-per').classList.add('sale'); setTimeout(hecho, 320); } else hecho();
    },
  });
}
// Al guardar el equipo, lo que se eligió repartir pasa a la cola (con el nombre que quedó).
const subGuardarEquipoBase = guardarEquipo;
guardarEquipo = function(){
  const x = st.eqDraft, pend = x && x.repartir ? x.repartir : [];
  const r = subGuardarEquipoBase.apply(this, arguments);
  if (pend.length && st.eqDraft !== x) {
    const n = (ALCANCE.todo ? String(x.n || '') : x.orig).trim() || x.orig;
    SUB_REPARTIR.push(...pend.map(p => ({...p, equipo: p.equipo === x.orig ? n : p.equipo})));
    subRepartirPendientes();
  }
  return r;
};

/* ── Editor del subequipo: gente de toda la empresa, con buscador ── */
const subDlgBase = eqrDlgSub;
eqrDlgSub = function(){
  const S = st.eqrSq, x = st.eqDraft, nom = eqrNom(x) || 'este equipo';
  const html = subDlgBase.apply(this, arguments);
  const i = html.indexOf('<div class="eqr-sqp"'), j = html.indexOf('<div class="eqr-lab"><span id="eqr-sq-mt">');
  if (i < 0 || j < 0) return html;
  const fila = (id, det) => {
    const p = personaDe(id); if (!p) return '';
    const on = S.ids.includes(id), bloq = !ALCANCE.todo && eqrEsAdmin(p) && !on;
    return `<button type="button" class="eqr-chk" role="checkbox" aria-checked="${on}" data-eqr-sq-per="${esc(id)}" data-q="${esc(norm(p.nombre))}"${bloq ? ` disabled title="${esc(EQR_SOLO_ADMIN)}"` : ''}><span class="eqr-caja${on ? ' on' : ''}"></span>${avPer(p)}<span class="sub-pn"><b>${esc(p.nombre)}</b><small>${esc(bloq ? EQR_SOLO_ADMIN : det)}</small></span></button>`;
  };
  const otrosDe = id => { const e = equiposDePersona(id); return e.length ? `De ${unirNombres(e)}` : 'Sin equipo'; };
  const delEquipo = x.ids.map(id => fila(id, `${x.lideres.includes(id) ? 'Líder' : 'Miembro'} de ${nom}`)).join('');
  const vistos = new Set(x.ids);
  const otros = [...S.ids, ...USUARIOS.map(u => u.id), ...(S.extra || [])].filter(id => !vistos.has(id) && (vistos.add(id), true)).map(id => fila(id, otrosDe(id))).join('');
  const personas = `<div class="eqr-sqp sub-per" role="group" aria-labelledby="eqr-sq-pt"><span id="eqr-sq-pt">Personas</span>
    <label class="sub-bus">${I('search')}<input id="eqr-sq-q" value="${esc(S.q || '')}" placeholder="Buscar a cualquiera de la empresa" autocomplete="off" aria-label="Buscar a cualquiera de la empresa"></label>
    <div class="sub-lista" id="sub-lista">${delEquipo ? `<span class="sub-g">De ${esc(nom)}</span>${delEquipo}` : ''}<span class="sub-g">De otros equipos o sin equipo</span>${otros || '<span class="sub-vacio">Busca a alguien por su nombre o su correo.</span>'}</div>
    <small>Quien no es de ${esc(nom)} recibe solo lo que se pase a este subequipo, no lo general del equipo.</small></div>`;
  return html.slice(0, i) + personas + html.slice(j);
};
// El buscador filtra la lista sin volver a pintar el diálogo; lo que no está en el CRM lo trae GET /crm/personas.
let subBusT = null;
const subFiltrar = n => document.querySelectorAll('#sub-lista [data-q]').forEach(b => { b.hidden = !!n && !b.dataset.q.includes(n); });
document.getElementById('ov-x').addEventListener('input', e => {
  if (e.target.id !== 'eqr-sq-q' || !st.eqrSq) return;
  const S = st.eqrSq, q = S.q = e.target.value, n = norm(q.trim());
  subFiltrar(n);
  clearTimeout(subBusT);
  if (n.length < 2) return;
  subBusT = setTimeout(() => crmApi('GET', `/crm/personas?q=${encodeURIComponent(q.trim())}`).then(lista => {
    if (st.eqrSq !== S || S.q !== q) return;
    for (const p of lista || []) if (p && p.id && !USUARIOS.some(u => u.id === p.id)) PERSONAS_EXTRA[p.id] = {...(PERSONAS_EXTRA[p.id] || {}), nombre: p.nombre, rol: p.rol, foto: p.foto || null};
    const extra = (lista || []).map(p => p.id).filter(id => id && !(S.extra || []).includes(id) && !USUARIOS.some(u => u.id === id));
    if (!extra.length) return;
    S.extra = [...(S.extra || []), ...extra];
    const nm = document.getElementById('eqr-sq-n'); if (nm) S.n = nm.value;
    eqrPintarSub(); subFiltrar(n);
    const b = document.getElementById('eqr-sq-q'); if (b) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); }
  }).catch(() => {}), 300);
});

// Guardar: sin nadie marcado, un aviso; si se desmarcó a alguien, el modal de quitar (con repartir).
eqrGuardarSub = function(){
  const S = st.eqrSq, x = st.eqDraft; if (!S || !x) return;
  const nm = document.getElementById('eqr-sq-n'); if (nm) S.n = nm.value;
  const n = S.n.trim().replace(/\s+/g, ' '), nom = eqrNom(x) || 'este equipo';
  if (!n) { toast('Escribe el nombre del subequipo'); if (nm) nm.focus(); return; }
  if (x.subs.some(s => s.id !== S.id && norm(s.n) === norm(n))) { toast(`${nom} ya tiene un subequipo «${n}».`); if (nm) nm.focus(); return; }
  const ids = [...new Set(S.ids)];
  const volver = () => { if (st.eqrSq === S) eqrPintarSub(); };
  if (!ids.length) {
    subModal({titulo: 'Elige al menos una persona', texto: `Para ${S.id ? 'guardar' : 'crear'} «${n}» marca quién va en el subequipo. Puede ser gente de ${nom} o de cualquier otro lugar de la empresa.`, volver: 'Volver a elegir', alNo: volver});
    return;
  }
  const s = S.id ? x.subs.find(y => y.id === S.id) : null;
  const aplicar = (repartir, quitados) => {
    if (s) Object.assign(s, {n, ids, metodo: S.metodo}); else x.subs.push({id: eqrIdSub(), n, ids, metodo: S.metodo});
    if (repartir && s && x.orig) for (const id of quitados) if (subCuenta(id, x.orig, s.id)) (x.repartir = x.repartir || []).push({userId: id, equipo: x.orig, subequipo: s.id});
    st.eqrSq = null; cerrarDialogo(); render();
  };
  const quitados = s ? s.ids.filter(id => !ids.includes(id)) : [];
  if (!quitados.length) { aplicar(false, []); return; }
  const cuenta = x.orig ? quitados.reduce((a, id) => a + subCuenta(id, x.orig, s.id), 0) : 0;
  const regla = eqrMetodo(S.metodo)[1].toLowerCase();
  if (quitados.length === 1) {
    const id = quitados[0], p = personaDe(id) || {id, nombre: 'Esta persona'};
    const otras = x.subs.filter(y => y.id !== s.id && y.ids.includes(id)).map(y => y.n);
    const enEquipo = x.ids.includes(id);
    const texto = !enEquipo && !otras.length
      ? `${s.n} es lo único que tiene en ${nom}: al quitarla, sale de ${nom} por completo.`
      : `Sigue en ${unirNombres([...(enEquipo ? [nom] : []), ...otras])}. Lo que se pase a ${s.n} ya no le llega.`;
    subModal({persona: p, titulo: `¿Quitar a ${p.nombre} de ${s.n}?`, texto, cuenta, lugar: s.n, regla, boton: `Quitar de ${s.n}`, alSi: r => aplicar(r, quitados), alNo: volver});
  } else {
    const nombres = quitados.map(id => (personaDe(id) || {}).nombre).filter(Boolean);
    subModal({titulo: `¿Quitar a ${quitados.length} personas de ${s.n}?`, texto: `Salen de ${s.n}: ${unirNombres(nombres)}. Lo que se pase a ${s.n} ya no les llega.`, cuenta, lugar: s.n, regla, boton: `Quitar de ${s.n}`, alSi: r => aplicar(r, quitados), alNo: volver});
  }
};

/* ── Agregar persona, Invitar y Editar a…: dos columnas con el árbol de equipos ── */
const BQ_INFO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/></svg>';
/** Dueño del bloque: «pa» (agregar), «pa-inv» (invitar) o «pe» (editar a…). */
const bqDueno = k => k === 'pe' ? st.peDlg : k === 'pa-inv' ? (st.pa && st.pa.inv) : st.pa;
const bqLista = k => k === 'pe' ? 'sel' : 'eqs';
function bqSubsDe(id){ const o = {}; for (const eq of equiposAdministrables()) { const l = subequiposDe(eq).filter(s => (s.ids || []).includes(id)).map(s => s.id); if (l.length) o[eq] = l; } return o; }
function bqRolesDe(id){ const o = {}; for (const eq of equiposAdministrables()) if (rolEnEquipo(id, eq) === 'lider') o[eq] = 'lider'; return o; }
/** Deja a la persona en los subequipos marcados de los equipos que esta persona administra (y la saca de los demás). */
function subAplicar(id, subs){
  for (const eq of equiposAdministrables()) {
    const lista = EQ_CFG.subequipos && EQ_CFG.subequipos[eq]; if (!Array.isArray(lista)) continue;
    const quiero = (subs && subs[eq]) || [];
    EQ_CFG.subequipos[eq] = lista.map(s => { const tiene = (s.ids || []).includes(id), va = quiero.includes(s.id); return tiene === va ? s : {...s, ids: va ? [...(s.ids || []), id] : (s.ids || []).filter(y => y !== id)}; });
  }
}
function bqHTML(k){
  const d = bqDueno(k) || {}, on = d[bqLista(k)] || [], roles = d.roles || {}, subs = d.subs || {};
  const adm = equiposAdministrables();
  const eqs = adm.map(eq => {
    const esta = on.includes(eq), marcados = subs[eq] || [], ss = subequiposDe(eq), parcial = !esta && marcados.length > 0, lid = roles[eq] === 'lider';
    const ab = st.bqAb === `${k}|${eq}`;
    const comoAdm = !!d.comoAdmin, puedeAdm = k !== 'pe' && CRM_YO.rol === 'ADMIN';
    const opc = (v, b, sm) => { const sel = comoAdm ? v === 'admin' : v !== 'admin' && (v === 'lider') === lid; return `<button type="button" class="eqr-op${sel ? ' sel' : ''}" role="option" aria-selected="${sel}" data-bq-rol="${esc(`${k}|${eq}|${v}`)}"><span><b>${b}</b><small>${sm}</small></span>${sel ? I('check') : ''}</button>`; };
    const rol = esta ? `<span class="bq-dd"><button type="button" class="qe-ddb${lid ? ' lid' : ''}${ab ? ' abierto' : ''}" data-bq-ab="${esc(`${k}|${eq}`)}" aria-haspopup="listbox" aria-expanded="${ab}" ${comoAdm ? 'style="background:#EDE9FE;border-color:#C4B5FD" ' : ''}aria-label="Rol en ${esc(eq)}: ${comoAdm ? 'Administrador' : lid ? 'Líder' : 'Miembro'}">${comoAdm ? 'Administrador' : lid ? 'Líder' : 'Miembro'}${I('chev')}</button>${ab ? `<div class="eqr-menu qe-menu" role="listbox" aria-label="Rol en ${esc(eq)}">${puedeAdm ? opc('admin', 'Administrador', 'Ve todo el CRM y cambia la configuración') : ''}${opc('lider', 'Líder', 'Ve y administra todo el equipo')}${opc('integrante', 'Miembro', 'Ve lo que le asignen')}</div>` : ''}</span>` : '';
    const ramas = ss.length ? `<div class="bq-ramas">${ss.map(s => { const m = marcados.includes(s.id); return `<button type="button" class="bq-sub" role="checkbox" aria-checked="${m}" data-bq-sub="${esc(`${k}|${eq}|${s.id}`)}"><span class="bq-sel"></span><span>${esc(s.n)}</span><small>${esc(eqrMetodo(s.metodo)[1])}</small></button>`; }).join('')}</div>` : '';
    const n = idsDe(eq).length;
    return `<div class="bq-eq${esta ? ' on' : ''}${parcial ? ' parcial' : ''}"><div class="bq-cab"><button type="button" class="bq-chk" role="checkbox" aria-checked="${esta}" data-bq-eq="${esc(`${k}|${eq}`)}"><span class="bq-sel"></span><i style="background:${colorEquipo(eq)}"></i><span class="bq-n"><b>${esc(eq)}</b><small>${parcial ? 'No es del equipo · solo en los subequipos marcados' : `${n} ${n === 1 ? 'persona' : 'personas'}`}</small></span></button>${rol}</div>${ramas}</div>`;
  }).join('');
  const nEq = on.filter(eq => adm.includes(eq)).length, nSub = adm.reduce((a, eq) => a + (subs[eq] || []).length, 0);
  const cuenta = [nEq ? `${nEq} ${nEq === 1 ? 'equipo' : 'equipos'}` : '', nSub ? `${nSub} ${nSub === 1 ? 'subequipo' : 'subequipos'}` : ''].filter(Boolean).join(' · ');
  const avisoAdm = d.comoAdmin ? '<p class="bq-ay" style="background:#f5f3ff;color:#4c1d95;padding:11px 13px;border-radius:12px"><span>Como Administrador ve todo el CRM y todos los equipos, sin importar cuál marques.</span></p>' : '';
  return `<div class="bq-st">Equipos, rol y subequipos<span>${cuenta}</span></div>${avisoAdm}${eqs || '<p class="muted" style="margin:0">Todavía no administras ningún equipo.</p>'}
    <p class="bq-ay">${BQ_INFO}<span>Marca el equipo para que reciba lo del equipo, y los subequipos para que reciba lo de cada uno. Puede estar en subequipos sin estar en el equipo.</span></p>`;
}
function bqResumen(k){
  const d = bqDueno(k) || {}, on = d[bqLista(k)] || [], subs = d.subs || {}, roles = d.roles || {};
  if (d.comoAdmin) return '<span>Queda como Administrador</span>';
  const tags = equiposAdministrables().map(eq => {
    const ss = (subs[eq] || []).map(id => (subequiposDe(eq).find(s => s.id === id) || {}).n).filter(Boolean);
    const t = on.includes(eq) ? `${eq}${roles[eq] === 'lider' ? ' · líder' : ''}${ss.length ? ` · ${ss.join(', ')}` : ''}` : ss.length ? `Solo ${unirNombres(ss)} de ${eq}` : '';
    return t ? `<span class="bq-tag"><i style="background:${colorEquipo(eq)}"></i>${esc(t)}</span>` : '';
  }).join('');
  return tags ? `<span>Queda en</span>${tags}` : '<span>Todavía no queda en ningún equipo</span>';
}
const bqTope = (id, valor) => `<label>Máximo de conversaciones abiertas<input id="${id}" inputmode="numeric" maxlength="3" value="${esc(valor)}" placeholder="Ilimitado" autocomplete="off"><small class="muted" style="font-weight:400">Vacío es ilimitado. Si escribes un número, al llegar a él deja de recibir nuevas.</small></label>`;
const bqMarco = (titulo, sub, izq, k, pie) => `<div class="bq-h"><h3>${titulo}</h3><p>${sub}</p></div><div class="bq-cols"><div class="bq-izq">${izq}</div><div class="bq-der">${bqHTML(k)}</div></div><div class="bq-pie"><span class="bq-res">${bqResumen(k)}</span>${pie}</div>`;

const bqAgregarBase = dlgAgregarPersona;
dlgAgregarPersona = function(){
  const A = st.pa;
  if (A.inv) {
    const v = A.inv;
    const izq = `<label>Nombre completo<input id="pa-inv-n" value="${esc(v.nombre || '')}" autocomplete="off"></label>
      <label>Correo<input id="pa-inv-c" type="email" value="${esc(v.email || '')}" autocomplete="off" placeholder="nombre@empresa.com"></label>
      <div class="fld">Teléfono (opcional)${campoTel('pa-inv-t', v.telefono || '', {placeholder: '300 123 4567'})}</div>
      <small class="muted" style="font-weight:400">Le llega un correo con el enlace para crear su contraseña y entrar.</small>`;
    // Cobro por usuarios (maqueta aprobada el 10-nov): si ocupa un usuario más de los pagados, el permiso del pago va entre
    // las columnas y el pie (el mismo bloque de «Cambiar los usuarios del plan», 70-usuarios.js) y el pie pide aprobarlo.
    if (v.permiso) {
      const q = v.permiso, nom = (v.nombre || '').trim().split(/\s+/)[0] || 'Esta persona';
      const dinero = c => `USD ${(c / 100).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
      const quien = `<div class="pu-quien"><span class="pu-quien-av">${esc(ini(v.nombre || v.email || '') || '·')}</span><span><b>${esc(v.nombre || '')}</b><small>${esc(v.email || '')}</small></span></div>`;
      return `<div class="bq-h"><h3>Invitar por correo</h3><p>Escribe sus datos y elige en qué equipos queda, con qué rol y en qué subequipos.</p></div>`
        + `<div class="bq-cols pu-oculta"><div class="bq-izq">${izq}</div><div class="bq-der">${bqHTML('pa-inv')}</div></div>${quien}`
        + `<div class="pu-en-inv">${plPermisoHTML(q, `${nom} necesita un usuario más`, `Tienes ${q.enUso} de ${q.actual} usuarios en uso. Si cancelas, no se invita y nada cambia.`)}</div>`
        + `<div class="bq-pie"><span class="bq-res">${bqResumen('pa-inv')}</span><button type="button" class="btn" data-pa-perm-cancelar="1"${v.fase === 'cobrando' ? ' disabled' : ''}>Cancelar</button>${plBotonAprobar(`Aprobar ${dinero(q.hoy)} e invitar`, v.fase, 'data-pa-aprobar="1"')}</div>`;
    }
    return bqMarco('Invitar por correo', 'Escribe sus datos y elige en qué equipos queda, con qué rol y en qué subequipos.', izq, 'pa-inv',
      `<button type="button" class="btn" data-pa-inv-cerrar="1">Cancelar</button><button type="button" class="btn pri" data-pa-invitar="1"${v.enviando ? ' disabled' : ''}>${I('send')}${v.enviando ? 'Enviando…' : 'Enviar invitación'}</button>`);
  }
  if (!A.sel) return bqAgregarBase.apply(this, arguments);
  const p = A.sel, d = A.datos, f = A.form || {};
  if (A.subsDe !== p.id) { A.subs = bqSubsDe(p.id); A.subsDe = p.id; }
  const off = !d || !d.editable ? 'disabled' : '';
  const datos = A.cargandoDatos ? '<p class="muted" style="margin:0">Cargando sus datos…</p>' : !d ? `<p class="muted" style="margin:0">${esc(A.errorDatos || 'No se pudieron cargar sus datos.')}</p>` : `
    <label>Nombre<input id="pa-n" value="${esc(f.nombre ?? d.nombre)}" ${off} autocomplete="off"></label>
    <label>Correo<input id="pa-c" type="email" value="${esc(f.email ?? d.email)}" ${off} autocomplete="off"></label>
    <div class="fld">Teléfono${campoTel('pa-t', f.telefono ?? (d.telefono || ''), {deshabilitado: !d.editable || !d.conTelefono, placeholder: d.conTelefono ? '300 123 4567' : 'No tiene ficha de asesor ni de marketing'})}</div>
    ${d.editable ? '' : '<small class="muted" style="font-weight:400">Solo un administrador puede cambiar los datos de esta persona.</small>'}`;
  const izq = `<div class="bq-yo">${avPer(p)}<b>${esc(p.nombre)}</b><small>${esc([p.rolNombre || ROL_NOMBRE[p.rol] || p.rol, p.enCrm ? 'ya está en el CRM' : 'ya está en la plataforma'].filter(Boolean).join(' · '))}</small><button type="button" class="btn" data-pa-cambiar="1">Cambiar persona</button></div>
    ${datos}${bqTope('pa-tope', f.tope ?? (EQ_CFG.topes[p.id] || ''))}`;
  return bqMarco('Agregar persona', 'Elige en qué equipos queda, con qué rol y en qué subequipos.', izq, 'pa',
    `<button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" data-pa-guardar="1" ${A.guardando ? 'disabled' : ''}>${I('plus')}${A.guardando ? 'Agregando…' : 'Agregar'}</button>`);
};
dlgPersona = function(){
  const D = st.peDlg, p = personaDe(D.id) || {nombre: '', rol: ''}, d = D.datos, f = D.form || {};
  if (!D.roles) D.roles = bqRolesDe(D.id);
  if (!D.subs) D.subs = bqSubsDe(D.id);
  const off = !d || !d.editable ? 'disabled' : '';
  const datos = D.cargando ? '<p class="muted" style="margin:0">Cargando sus datos…</p>' : D.error ? `<p class="muted" style="margin:0">No se pudieron cargar sus datos: ${esc(D.error)}</p>` : `
    <label>Nombre<input id="pe-n" value="${esc(f.nombre ?? d.nombre)}" ${off} autocomplete="off"></label>
    <label>Correo<input id="pe-c" type="email" value="${esc(f.email ?? d.email)}" ${off} autocomplete="off"></label>
    <div class="fld">Teléfono${campoTel('pe-t', f.telefono ?? (d.telefono || ''), {deshabilitado: !d.editable || !d.conTelefono, placeholder: d.conTelefono ? '300 123 4567' : 'No tiene ficha de asesor ni de marketing'})}</div>
    ${d.editable ? '' : '<small class="muted" style="font-weight:400">Solo un administrador puede cambiar los datos de esta persona.</small>'}`;
  const nom = p.nombre || (d && d.nombre) || '';
  const izq = `<div class="bq-yo">${avPer({...p, id: D.id})}<b class="per-n">${esc(nom)}</b><small>${esc(ROL_NOMBRE[p.rol] || p.rol || '')} · ${porRol(p.rol) ? 'entra al CRM por su rol' : 'entra al CRM por sus equipos'}</small></div>
    ${datos}${bqTope('pe-tope', f.tope ?? (D.tope !== undefined ? D.tope : (EQ_CFG.topes[D.id] || '')))}`;
  return bqMarco(`Editar a ${esc(nom || 'esta persona')}`, 'Sus datos, en qué equipos queda, con qué rol y en qué subequipos.', izq, 'pe',
    `<button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" data-pe-guardar="1" ${D.guardando ? 'disabled' : ''}>${I('check')}${D.guardando ? 'Guardando…' : 'Guardar'}</button>`);
};
/** Lee lo escrito antes de volver a pintar. */
function bqLeer(k){
  if (k === 'pa') { leerPa(); return; }
  const v = id => { const el = document.getElementById(id); return el ? el.value : undefined; };
  if (k === 'pa-inv' && st.pa && st.pa.inv) { const i = st.pa.inv; if (v('pa-inv-n') !== undefined) i.nombre = v('pa-inv-n'); if (v('pa-inv-c') !== undefined) i.email = v('pa-inv-c'); if (document.getElementById('pa-inv-t')) i.telefono = valorTel('pa-inv-t'); return; }
  if (k === 'pe' && st.peDlg) { const D = st.peDlg, f = D.form = D.form || {}; for (const [c, id] of [['nombre', 'pe-n'], ['email', 'pe-c'], ['tope', 'pe-tope']]) if (v(id) !== undefined) f[c] = v(id); if (document.getElementById('pe-t')) f.telefono = valorTel('pe-t'); }
}
function bqPintar(k){
  const der = document.querySelector('#dlg-x .bq-der'), y = der ? der.scrollTop : 0;
  bqLeer(k);
  abrirDialogo(k === 'pe' ? dlgPersona() : dlgAgregarPersona(), 'dlg-per');
  const n = document.querySelector('#dlg-x .bq-der'); if (n) n.scrollTop = y;
}
document.getElementById('ov-x').addEventListener('click', e => {
  if (!document.querySelector('#dlg-x .bq-cols')) return;
  const t = e.target;
  const ab = t.closest('[data-bq-ab]');
  if (ab) { const k = ab.dataset.bqAb; st.bqAb = st.bqAb === k ? null : k; bqPintar(k.split('|')[0]); return; }
  const ro = t.closest('[data-bq-rol]');
  if (ro) { const [k, eq, r] = ro.dataset.bqRol.split('|'), d = bqDueno(k); if (!d) return; if (r === 'admin') d.comoAdmin = true; else { d.comoAdmin = false; d.roles = {...(d.roles || {}), [eq]: r}; } st.bqAb = null; bqPintar(k); return; }
  if (st.bqAb && !t.closest('.eqr-menu')) { const k = st.bqAb.split('|')[0]; st.bqAb = null; bqPintar(k); return; }
  const qe = t.closest('[data-bq-eq]');
  if (qe) { const [k, eq] = qe.dataset.bqEq.split('|'), d = bqDueno(k); if (!d) return; const l = d[bqLista(k)] || []; d[bqLista(k)] = l.includes(eq) ? l.filter(y => y !== eq) : [...l, eq]; bqPintar(k); return; }
  const qs = t.closest('[data-bq-sub]');
  if (qs) { const [k, eq, id] = qs.dataset.bqSub.split('|'), d = bqDueno(k); if (!d) return; const s = d.subs = {...(d.subs || {})}, l = s[eq] || []; s[eq] = l.includes(id) ? l.filter(y => y !== id) : [...l, id]; bqPintar(k); }
});
// El máximo solo acepta números (vacío es ilimitado), en los diálogos y en la tabla de Personas.
document.addEventListener('input', e => {
  const el = e.target; if (!el.matches || !el.matches('#pa-tope, #pe-tope, input[data-per-tope]')) return;
  const limpio = el.value.replace(/\D/g, '').slice(0, 3); if (limpio !== el.value) el.value = limpio;
});

/** Lo que pierde la persona (equipos y subequipos que esta persona administra) al guardar lo marcado. */
function bqQuitados(id, eqsQueda, subsQueda){
  const items = [];
  for (const eq of equiposAdministrables()) {
    const sigue = new Set((subsQueda && subsQueda[eq]) || []);
    if (idsDe(eq).includes(id) && !eqsQueda.includes(eq)) items.push({eq, sub: null, n: eq, cuenta: subCuenta(id, eq, null, sigue)});
    for (const s of subequiposDe(eq)) if ((s.ids || []).includes(id) && !sigue.has(s.id)) items.push({eq, sub: s.id, n: s.n, cuenta: subCuenta(id, eq, s.id)});
  }
  return items;
}
/** El modal de quitar para los diálogos de Personas: uno solo con todo lo que deja. */
function bqConfirmar(p, items, alSi, alNo){
  const cuenta = items.reduce((a, x) => a + x.cuenta, 0);
  const uno = items.length === 1 ? items[0] : null;
  const regla = uno ? (uno.sub ? eqrMetodo((subequiposDe(uno.eq).find(s => s.id === uno.sub) || {}).metodo)[1] : eqrMetodo(eqrMetodoDe(uno.eq))[1]).toLowerCase() : '';
  subModal({
    persona: p, titulo: uno ? `¿Quitar a ${p.nombre} de ${uno.n}?` : `¿Quitar a ${p.nombre} de ${items.length} lugares?`,
    texto: uno ? (uno.sub ? `Lo que se pase a ${uno.n} ya no le llega.` : `Deja de recibir lo que llega a ${uno.n} sin subequipo.`) : `Sale de ${unirNombres(items.map(x => x.sub ? `${x.n} (${x.eq})` : x.n))}.`,
    cuenta, lugar: uno ? uno.n : 'esos lugares', regla,
    repTitulo: uno ? '' : 'Repartirlas donde estaban', repSub: uno ? '' : 'Cada una con la regla de su equipo o subequipo',
    boton: uno ? `Quitar de ${uno.n}` : 'Quitar y guardar',
    alSi: r => alSi(r ? items.filter(x => x.cuenta).map(x => ({userId: p.id, equipo: x.eq, subequipo: x.sub})) : []),
    alNo,
  });
}

// Agregar persona: con equipos o solo con subequipos; si deja lugares (alguien que ya estaba), pregunta antes.
guardarAgregar = async function(confirmado){
  const A = st.pa; if (!A || !A.sel || A.guardando) return; leerPa();
  // Como Administrador no queda en equipos: así ve todo el CRM.
  if (A.comoAdmin && bqQuitados(A.sel.id, [], {}).length) { toast('Primero sácala de sus equipos: como Administrador no va en ninguno.'); return; }
  if (A.comoAdmin) { A.guardando = true; crmApi('PATCH', `/usuarios/${encodeURIComponent(A.sel.id)}`, {role: 'ADMIN'}).then(() => { const n = A.sel.nombre; st.pa = null; cerrarDialogo(); render(); toast(`${n} ahora es Administrador`); }).catch(err => { A.guardando = false; toast(err.message); }); return; }
  const p = A.sel, d = A.datos, f = A.form || {}, cambios = {}, elegidos = (A.eqs || []).filter(puedeAdministrarEquipo), subs = A.subs || {};
  if (!elegidos.length && !Object.values(subs).some(l => l.length)) { toast('Elige al menos un equipo o un subequipo'); return; }
  const subsLimpio = o => JSON.stringify(Object.fromEntries(Object.entries(o).filter(([, l]) => l.length).map(([k, l]) => [k, [...l].sort()]).sort()));
  if (!ALCANCE.todo && eqrEsAdmin(p) && (equiposAdministrables().some(eq => idsDe(eq).includes(p.id) !== elegidos.includes(eq)) || subsLimpio(bqSubsDe(p.id)) !== subsLimpio(subs))) { toast(EQR_SOLO_ADMIN); return; }
  const tope = String(f.tope || '').trim();
  if (tope && !(Math.round(+tope) >= 1 && Math.round(+tope) <= 500)) { toast('El máximo va de 1 a 500'); return; }
  if (d && d.editable) {
    const n = String(f.nombre ?? d.nombre).trim(), c = String(f.email ?? d.email).trim().toLowerCase(), t = String(f.telefono ?? d.telefono ?? '').trim();
    if (n.length < 2) { toast('Escribe el nombre completo'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(c)) { toast('Ese correo no parece completo'); return; }
    if (d.conTelefono && t && t.replace(/\D/g, '').length < 7) { toast('El teléfono está incompleto'); return; }
    if (n !== d.nombre) cambios.nombre = n;
    if (c !== String(d.email).toLowerCase()) cambios.email = c;
    if (d.conTelefono && t && t !== normalTel(d.telefono)) cambios.telefono = t;
  }
  let repartos = Array.isArray(confirmado) ? confirmado : null;
  if (!repartos) {
    const items = bqQuitados(p.id, elegidos, subs);
    if (items.length) { bqConfirmar(p, items, r => { pintarPa(); guardarAgregar(r); }, () => pintarPa()); return; }
    repartos = [];
  }
  if (Object.keys(cambios).length) {
    A.guardando = true; pintarPa();
    try { await crmApi('PATCH', `/auth/usuarios/${encodeURIComponent(p.id)}/perfil`, cambios); }
    catch (err) { A.guardando = false; pintarPa(); toast(err.message || 'No se pudieron guardar sus datos'); return; }
    if (cambios.nombre) { renombrarPersona(p.id, p.nombre, cambios.nombre); p.nombre = cambios.nombre; }
  }
  PERSONAS_EXTRA[p.id] = {...(PERSONAS_EXTRA[p.id] || {}), nombre: p.nombre, rol: p.rol, foto: p.foto || null};
  eqrMembresias(p.id, elegidos);
  paAplicarRoles(p.id, elegidos, A.roles || {});
  subAplicar(p.id, subs);
  if (tope) EQ_CFG.topes[p.id] = Math.round(+tope); else delete EQ_CFG.topes[p.id];
  st.pa = null; cerrarDialogo(); render();
  const donde = [...elegidos, ...equiposAdministrables().flatMap(eq => (subs[eq] || []).map(id => (subequiposDe(eq).find(s => s.id === id) || {}).n)).filter(Boolean)];
  toast(`${p.nombre} quedó en ${unirNombres([...new Set(donde)])}`);
  SUB_REPARTIR.push(...repartos); subRepartirPendientes();
};
// Editar a…: lo mismo; los datos y el máximo los guarda la función de antes.
const bqGuardarPersonaBase = guardarPersona;
guardarPersona = async function(confirmado){
  const D = st.peDlg; if (!D || D.guardando) return;
  bqLeer('pe');
  const adm = equiposAdministrables(), elegidos = (D.sel || []).filter(eq => adm.includes(eq)), subs = D.subs || {};
  let repartos = Array.isArray(confirmado) ? confirmado : null;
  if (!repartos) {
    const items = bqQuitados(D.id, elegidos, subs);
    if (items.length) { bqConfirmar(personaDe(D.id) || {id: D.id, nombre: 'esta persona'}, items, r => { abrirDialogo(dlgPersona(), 'dlg-per'); guardarPersona(r); }, () => abrirDialogo(dlgPersona(), 'dlg-per')); return; }
    repartos = [];
  }
  const rolesAntes = JSON.stringify(bqRolesDe(D.id)), subsAntes = JSON.stringify(bqSubsDe(D.id));
  await bqGuardarPersonaBase.call(this);
  if (st.peDlg === D) return;   // no se guardó (lo dijo un aviso)
  paAplicarRoles(D.id, elegidos, D.roles || {});
  subAplicar(D.id, subs);
  if (JSON.stringify(bqRolesDe(D.id)) !== rolesAntes || JSON.stringify(bqSubsDe(D.id)) !== subsAntes) { render(); toast('Cambios guardados'); }
  SUB_REPARTIR.push(...repartos); subRepartirPendientes();
};
