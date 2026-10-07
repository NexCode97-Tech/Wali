/* ── Equipos y reparto (maqueta aprobada el 7-oct) ──
   La lista: una tarjeta por equipo con su ícono en un círculo de su color, cuántas personas están disponibles (las
   fotos con su punto, hasta 5 y «+N»), qué recibe y cómo se reparte, y abajo el interruptor «Guardar los leads cuando
   no haya nadie disponible» (EQ_CFG.cola; apagado, lo que llega sin nadie disponible queda sin asignar y el reparto
   ya no lo entrega solo: reparto.ts). La página del equipo: nombre, ícono (de la lista o un SVG subido) y color;
   personas como Líder o Miembro; subequipos; qué recibe; cómo se reparte; y el mismo interruptor.
   Usa los mismos data-* de 40-ajustes.js y 61-equipos-roles.js (agregar y quitar personas, rol, forma de repartir,
   subequipos, color, líneas, guardar y eliminar), así que lo que guardan sigue pasando por allá. Lo propio lleva q. */

for (const k of ['cola', 'iconos']) if (!EQ_CFG[k] || typeof EQ_CFG[k] !== 'object') EQ_CFG[k] = {};
// Todos los equipos tienen líderes y miembros: el rol de los integrantes ya no se escribe.
rolIntegrantesDe = () => 'Miembro';
const Q_ICONOS = ['users', 'cart', 'chat', 'star', 'flame', 'phone', 'shield-ok', 'bolt', 'megaphone', 'cap', 'mail', 'calendar'];
const Q_MET_IC = {turnos: 'swap', menos: 'users', lider: 'user'};
const Q_SVG_MAX = 30 * 1024;
const qIconoDe = eq => { const v = EQ_CFG.iconos[eq]; return typeof v === 'string' && v ? v : 'users'; };
const qIconoHTML = (ic, tam) => /^data:image\/svg\+xml;base64,/.test(ic) ? `<img src="${esc(ic)}" alt="" style="width:${tam}px;height:${tam}px">` : `<svg class="i" style="width:${tam}px;height:${tam}px"><use href="#i-${esc(ic)}"/></svg>`;
// Disponible: «En línea», con el CRM abierto y recibiendo reparto (lo mismo que mira el reparto automático).
const qDisponible = id => { const u = USUARIOS.find(x => x.id === id); return !!u && estadoDe(u) === 'En línea' && u.reparto !== false; };
// Conversaciones abiertas del equipo sin nadie asignado: las que esperan.
const qEsperando = eq => CONV.filter(c => !c.asig && c.est === 'abiertas' && (c.equipo || 'Ventas') === eq).length;
const qSw = (on, attr, label, off) => `<button type="button" class="q-sw" role="switch" aria-checked="${on}" ${attr} aria-label="${esc(label)}"${off ? ' disabled' : ''}></button>`;

paginaEquipos = function(){
  const volver = `<button type="button" class="volver" data-ir="ajustes-crm">${I('back')}Ajustes del CRM</button>`;
  if (st.eqVer !== null && st.eqDraft) return editorEquipo();
  if (st.repTab === 'reglas' && !ALCANCE.config) st.repTab = 'equipos';
  const adm = equiposAdministrables();
  const cab = `${volver}<h2>Equipos y reparto</h2><p class="sub">Quién atiende las conversaciones y cómo se reparten entre las personas de cada equipo.</p>`;
  if (st.repTab === 'personas') return `<div class="ajw ancho">${cab}${eqrTabs(adm)}${tabPersonas()}</div>`;
  if (st.repTab === 'reglas') return `<div class="ajw ancho">${cab}${eqrTabs(adm)}${tabReglas()}</div>`;
  const q = norm(st.repQ || '');
  const lista = EQUIPOS.map((e, i) => ({e, i})).filter(({e}) => adm.includes(e.n) && (!q || norm(e.n).includes(q) || idsDe(e.n).some(id => norm((personaDe(id) || {}).nombre || '').includes(q))));
  const tarjetas = lista.map(({e, i}) => {
    const n = e.n, ps = idsDe(n).map(personaDe).filter(Boolean), con = ps.filter(p => qDisponible(p.id)).length;
    const cola = EQ_CFG.cola[n] !== false, esp = qEsperando(n), puede = puedeAdministrarEquipo(n);
    const estado = !ps.length ? `<span class="q-est mal">${svgAviso}Sin personas</span>` : con ? `<span class="q-est ok"><i></i>${con} de ${ps.length} disponibles</span>` : '<span class="q-est off"><i></i>Nadie disponible ahora</span>';
    const orden = [...ps].sort((a, b) => qDisponible(b.id) - qDisponible(a.id));
    const gente = ps.length ? `<div class="q-av">${orden.slice(0, 5).map(p => `<span class="q-p" title="${esc(p.nombre)}">${avPer(p)}<i class="${qDisponible(p.id) ? 'on' : ''}"></i></span>`).join('')}${ps.length > 5 ? `<span class="q-mas" title="${esc(orden.slice(5).map(p => p.nombre).join(', '))}">+${ps.length - 5}</span>` : ''}</div>`
      : `<button type="button" class="q-add" data-eq-abrir="${esc(n)}">${I('plus')}Agregar personas</button>`;
    const nota = cola ? (esp ? `<span class="q-cnt">${esp} esperando</span>` : '') : (esp && !con ? `<span class="q-cnt mal">${esp} sin asignar</span>` : '');
    return `<article class="q-card">
      <header><span class="q-sq" style="background:${colorOk(colorDe(n, i))}">${qIconoHTML(qIconoDe(n), 22)}</span><div class="q-t"><h3>${esc(n)}</h3>${estado}</div><button type="button" class="btn" data-eq-abrir="${esc(n)}">Editar</button></header>
      <div class="q-cols"><div><small>Personas</small>${gente}</div><div><small>Recibe</small><p>${recibeHTML(n)}</p></div><div><small>Se reparte</small><p><span class="q-met">${esc(eqrMetodo(eqrMetodoDe(n))[1])}</span></p></div></div>
      <footer class="${cola ? 'act' : ''}"><span class="q-ic">${I('clock')}</span><span class="q-tx"><b>Guardar los leads cuando no haya nadie disponible</b><small>${cola ? 'Esperan en fila y se reparten en orden apenas alguien del equipo vuelva a estar disponible.' : 'Apagado: lo que llegue sin nadie disponible queda sin asignar hasta que alguien lo tome.'}</small></span>${nota}${qSw(cola, `data-q-cola="${esc(n)}"`, `Guardar los leads de ${n} cuando no haya nadie disponible`, !puede)}</footer>
    </article>`;
  }).join('');
  return `<div class="ajw ancho">${cab}${eqrTabs(adm)}
    <div class="rq-bar"><label class="cn-q">${I('search')}<input id="rep-q" value="${esc(st.repQ || '')}" placeholder="Buscar un equipo o una persona" autocomplete="off" aria-label="Buscar un equipo o una persona"></label><span class="sp"></span>${ALCANCE.todo ? `<button type="button" class="btn pri" data-eq-abrir="">${I('plus')}Crear equipo</button>` : ''}</div>
    <div class="q-lista">${tarjetas || `<p class="muted" style="margin:0;padding:16px 4px">${q ? 'Nada coincide con la búsqueda.' : 'Todavía no tienes equipos a tu cargo.'}</p>`}</div></div>`;
};

/* ── Página del equipo ── */
const qBorradorBase = eqrBorrador;
eqrBorrador = function(nombre){
  const x = qBorradorBase(nombre);
  x.ic = nombre ? qIconoDe(nombre) : 'users'; x.cola = nombre ? EQ_CFG.cola[nombre] !== false : true;
  return x;
};
editorEquipo = function(){
  const x = st.eqDraft, nuevo = !x.orig, todo = !!ALCANCE.todo;
  const lid = new Set(x.lideres.filter(id => x.ids.includes(id)));
  const personas = [...x.ids.filter(id => lid.has(id)), ...x.ids.filter(id => !lid.has(id))].map(personaDe).filter(Boolean);
  const con = personas.filter(p => qDisponible(p.id)).length, color = colorOk(x.color);
  const per = personas.length ? personas.map(p => { const esL = lid.has(p.id), d = qDisponible(p.id), subs = x.subs.filter(s => s.ids.includes(p.id)).map(s => s.n);
    return `<div class="qe-per"><span class="q-p">${avPer(p)}<i class="${d ? 'on' : ''}"></i></span><span class="qe-nm"><b>${esc(p.nombre)}</b><small>${d ? 'Disponible' : 'No disponible'} · ${esL ? 've todo el equipo' : subs.length ? `${esc(subs.join(' · '))} · ve lo que le asignen` : 've lo que le asignen'}</small></span>
      <span class="qe-rol${esL ? ' lid' : ''}" role="group" aria-label="Rol de ${esc(p.nombre)}"><button type="button" aria-pressed="${esL}" data-eqr-rolop="${esc(p.id)}" data-v="lider">Líder</button><button type="button" aria-pressed="${!esL}" data-eqr-rolop="${esc(p.id)}" data-v="integrante">Miembro</button></span>
      <button type="button" class="qe-x" data-eqr-quitar="${esc(p.id)}" aria-label="Quitar a ${esc(p.nombre)}">${I('x')}</button></div>`; }).join('')
    : `<div class="qe-vacio">${svgAviso}<span><b>${esc(eqrNom(x) || 'Este equipo')} no tiene personas</b><small>Lo que le llegue no lo atiende nadie hasta que agregues a alguien.</small></span></div>`;
  const B = st.eqBusca || {q: '', res: []};
  const res = B.q.trim() ? (B.cargando && !B.res.length ? '<p class="muted" style="margin:0;padding:10px 12px">Buscando…</p>'
      : B.error ? `<p class="muted" style="margin:0;padding:10px 12px">${esc(B.error)}</p>`
      : B.res.length ? B.res.map(p => { const ya = x.ids.includes(p.id), adm = !ya && !todo && eqrEsAdmin(p); return `<div class="rq-op">${avPer(p)}<span class="tx">${esc(p.nombre)}<small>${esc(adm ? EQR_SOLO_ADMIN : p.cargo ? p.cargo + ', según el organigrama' : (p.enCrm ? 'Ya está en el CRM' : 'Todavía no entra al CRM'))}</small></span><span class="rq-rol">${esc(p.rolNombre || ROL_NOMBRE[p.rol] || p.rol)}</span><button type="button" class="btn" data-eq-add="${esc(p.id)}" ${ya || adm ? 'disabled' : ''}>${ya ? 'Ya está' : `${I('plus')}Agregar`}</button></div>`; }).join('')
      : '<p class="muted" style="margin:0;padding:10px 12px">Nadie coincide. Los colaboradores no aparecen: no pueden entrar al CRM.</p>') : '';
  const subs = x.subs.length ? x.subs.map(s => { const g = s.ids.filter(id => x.ids.includes(id)).map(personaDe).filter(Boolean);
    return `<div class="qe-sub"><span class="qe-pt" style="background:${color}"></span><b>${esc(s.n)}</b><span class="qe-c">${esc(eqrMetodo(s.metodo)[1])}</span><span class="sp"></span><span class="q-av">${g.slice(0, 4).map(p => `<span class="q-p">${avPer(p)}</span>`).join('')}${g.length > 4 ? `<span class="q-mas">+${g.length - 4}</span>` : ''}</span><button type="button" class="btn" data-eqr-subeditar="${esc(s.id)}">Editar</button></div>`; }).join('')
    : '<p class="qe-ay">Grupos dentro del equipo con su propia forma de repartir. Todavía no hay.</p>';
  let recibe;
  if (todo) {
    const ocupada = id => { const l = CFG.lineas.find(y => y.id === id); return l && l.eq && l.eq !== x.orig ? l.eq : null; };
    recibe = (LINEAS.length ? LINEAS.map(l => { const otro = ocupada(l.id); return `<label class="qe-chk"><input type="checkbox" data-eq-linea="${esc(l.id)}" ${x.lineas.includes(l.id) ? 'checked' : ''}><span><b>${esc(l.n)}</b><small>${esc(l.tel)}${otro && !x.lineas.includes(l.id) ? ` · hoy la atiende ${esc(otro)}` : ''}</small></span></label>`; }).join('')
      : '<p class="qe-ay" style="padding-bottom:10px">Todavía no hay líneas de WhatsApp conectadas. Cuando conectes una, la eliges aquí.</p>')
      + `<label class="qe-chk"><input type="checkbox" data-eq-transf="1" ${x.transferible ? 'checked' : ''}><span><b>Transferidas por otros equipos</b><small>Cuando alguien le pasa una conversación</small></span></label>`;
  } else {
    const ls = lineasDe(x.orig), partes = ls.map(l => [l.n, l.tel]);
    if (x.orig === 'Ventas' && !partes.length) partes.push(['Las que llegan sin un equipo propio', '']);
    if (x.transferible) partes.push(['Transferidas por otros equipos', 'Cuando alguien le pasa una conversación']);
    recibe = partes.length ? partes.map(([b, s]) => `<div class="qe-chk"><span><b>${esc(b)}</b>${s ? `<small>${esc(s)}</small>` : ''}</span></div>`).join('') : '<p class="qe-ay">Ninguna todavía.</p>';
  }
  const m = eqrMetodo(x.metodo)[0];
  const icAct = x.ic || 'users', esSvg = /^data:/.test(icAct);
  return `<div class="ajw ancho qe">
    <button type="button" class="volver" data-eq-cerrar="1">${I('back')}Equipos y reparto</button>
    <div class="qe-cab"><span class="q-sq qe-logo" style="background:${color}">${qIconoHTML(icAct, 28)}</span><div class="qe-t">
      ${todo ? `<input class="qe-nom" id="eq-nombre" value="${esc(x.n)}" placeholder="Nombre del equipo" maxlength="80" autocomplete="off" aria-label="Nombre del equipo">` : `<h1 class="qe-nom-t">${esc(x.orig)}</h1>`}
      <div class="qe-look"><div class="qe-icos" role="group" aria-label="Ícono del equipo">${Q_ICONOS.map(ic => `<button type="button" data-q-ic="${ic}" aria-pressed="${!esSvg && icAct === ic}" aria-label="Ícono ${ic}">${I(ic)}</button>`).join('')}<label class="qe-svg${esSvg ? ' on' : ''}" title="Sube un ícono en SVG de máximo 30 KB"><input type="file" accept=".svg,image/svg+xml" hidden data-q-svg="1">${I('download')}${esSvg ? 'SVG subido' : 'Subir SVG'}</label></div>
        <div class="qe-sw" role="group" aria-label="Color del equipo">${COLORES_EQ.map(([c, cn]) => `<button type="button" style="background:${c}" data-eq-color="${c}" aria-pressed="${x.color === c}" aria-label="${cn}"></button>`).join('')}</div></div></div></div>
    <div class="qe-grid">
      <div class="qe-col">
        <section class="qe-s" aria-label="Personas del equipo"><div class="qe-h"><h3>Personas</h3><span class="qe-c">${personas.length ? `${con} de ${personas.length} disponibles` : ''}</span></div>${per}
          <label class="qe-busca">${I('search')}<input id="eq-busca" value="${esc(B.q)}" placeholder="Agregar persona: escribe un nombre o un correo" autocomplete="off" aria-label="Agregar persona"></label>
          ${res ? `<div class="rq-res" id="eq-res">${res}</div>` : ''}
          <p class="qe-ay" style="margin-top:10px">El líder ve todas las conversaciones del equipo, las reasigna y administra sus subequipos. Cada miembro ve solo lo que le asignen.</p></section>
        <section class="qe-s" aria-label="Subequipos"><div class="qe-h"><h3>Subequipos</h3><button type="button" class="btn" data-eqr-subnuevo="1">${I('plus')}Nuevo subequipo</button></div>${subs}</section>
      </div>
      <div class="qe-col">
        <section class="qe-s" aria-label="Qué recibe"><div class="qe-h"><h3>Qué recibe</h3></div>${recibe}</section>
        <section class="qe-s" aria-label="Cómo se reparte"><div class="qe-h"><h3>Cómo se reparte</h3></div>
          <div class="qe-met" role="radiogroup" aria-label="Cómo se reparte">${METODOS_EQ.map(([k, n, d]) => `<button type="button" role="radio" aria-checked="${m === k}" data-eqr-metodo="${k}"><span class="qe-ic">${I(Q_MET_IC[k] || 'users')}</span><span><b>${esc(n)}</b><small>${esc(d)}</small></span></button>`).join('')}</div>
          <p class="qe-ay" style="margin-top:10px">Lo que llega sin subequipo se reparte entre toda la gente del equipo. Cada subequipo tiene su propia forma de repartir.</p></section>
        <section class="qe-s qe-cola${x.cola ? ' act' : ''}" aria-label="Cuando no hay nadie disponible"><div class="qe-h"><span class="q-ic">${I('clock')}</span><h3>Cuando no hay nadie disponible</h3>${qSw(x.cola, 'data-q-cola-d="1"', 'Guardar los leads cuando no haya nadie disponible')}</div>
          <p class="qe-ay">${x.cola ? '<b>Los leads esperan en fila.</b> Apenas alguien del equipo vuelva a estar disponible se le reparten en el orden en que llegaron.' : '<b>Apagado.</b> Lo que llegue sin nadie disponible queda sin asignar hasta que alguien lo tome.'}</p>
          ${x.cola && x.orig && qEsperando(x.orig) ? `<span class="q-cnt">${qEsperando(x.orig)} esperando ahora</span>` : ''}</section>
      </div>
    </div>
    <div class="qe-pie">${todo && !nuevo && x.orig !== 'Ventas' ? `<button type="button" class="btn qe-borrar" data-eq-borrar="1">Eliminar equipo</button>` : ''}<span class="sp"></span><button type="button" class="btn" data-eq-cerrar="1">Cancelar</button><button type="button" class="btn pri" data-eq-guardar2="1">${I('check')}${nuevo ? 'Crear equipo' : 'Guardar cambios'}</button></div>
  </div>`;
};
// Al guardar, el ícono y «Guardar los leads» van con lo demás del equipo.
const qGuardarBase = guardarEquipo;
guardarEquipo = function(){
  const x = st.eqDraft; if (!x) return qGuardarBase.apply(this, arguments);
  const nm = document.getElementById('eq-nombre'), n = (ALCANCE.todo ? String(nm ? nm.value : x.n || '') : x.orig).trim();
  const r = qGuardarBase.apply(this, arguments);
  if (st.eqDraft === x || !n || !EQUIPOS.some(q => q.n === n)) return r;
  if (x.orig && x.orig !== n) { delete EQ_CFG.cola[x.orig]; delete EQ_CFG.iconos[x.orig]; }
  EQ_CFG.iconos[n] = x.ic || 'users'; EQ_CFG.cola[n] = x.cola !== false;
  render();
  return r;
};

document.getElementById('page').addEventListener('click', e => {
  if (st.pagina !== 'cfg-reparto') return;
  const t = e.target;
  const c = t.closest('[data-q-cola]');
  if (c) {
    const n = c.dataset.qCola; if (!puedeAdministrarEquipo(n)) { toast(`Solo el líder de ${n} o un administrador cambia este equipo`); return; }
    EQ_CFG.cola[n] = EQ_CFG.cola[n] === false; render();
    toast(EQ_CFG.cola[n] ? `${n}: los leads esperan en fila cuando no haya nadie disponible` : `${n}: lo que llegue sin nadie disponible queda sin asignar`);
    return;
  }
  const x = st.eqDraft; if (!x) return;
  if (t.closest('[data-q-cola-d]')) { x.cola = !x.cola; render(); return; }
  const ic = t.closest('[data-q-ic]'); if (ic) { x.ic = ic.dataset.qIc; render(); }
});
document.getElementById('page').addEventListener('change', e => {
  if (st.pagina !== 'cfg-reparto' || !e.target.matches || !e.target.matches('[data-q-svg]')) return;
  const x = st.eqDraft, f = e.target.files && e.target.files[0]; if (!x || !f) return;
  if (f.size > Q_SVG_MAX) { toast('El SVG puede pesar máximo 30 KB'); return; }
  if (!/svg/i.test(f.type) && !/\.svg$/i.test(f.name)) { toast('Sube un archivo SVG'); return; }
  f.text().then(txt => {
    if (!/<svg[\s>]/i.test(txt) || /<script|on[a-z]+\s*=|javascript:|<foreignObject/i.test(txt)) { toast('Ese SVG no se puede usar: debe ser un ícono sin scripts'); return; }
    const rd = new FileReader();
    rd.onload = () => { const v = String(rd.result || '').replace(/^data:[^;,]*;base64,/, 'data:image/svg+xml;base64,'); if (st.eqDraft === x) { x.ic = v; render(); } };
    rd.readAsDataURL(f);
  }).catch(() => toast('No se pudo leer el archivo'));
});

document.head.insertAdjacentHTML('beforeend', `<style>
.q-lista{display:flex;flex-direction:column;gap:14px}
.q-card{border:1px solid #e5e9f0;border-radius:16px;background:#fff;overflow:hidden}
.q-card header{display:flex;align-items:center;gap:14px;padding:16px 18px 6px}
.q-sq{width:38px;height:38px;border-radius:50%;flex:none;display:grid;place-items:center;color:#fff}
.q-sq img{filter:brightness(0) invert(1)}
.q-t{flex:1;min-width:0}.q-t h3{margin:0;font-size:16px;font-weight:650}
.q-est{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:#4b5563;margin-top:2px}
.q-est i{width:8px;height:8px;border-radius:50%;background:#16a34a}.q-est.off i{background:#9ca3af}
.q-est.mal{color:#b45309}.q-est svg{width:14px;height:14px}
.q-cols{display:grid;grid-template-columns:1.1fr 1.4fr .8fr;gap:24px;padding:12px 18px 16px 70px}
.q-cols small{display:block;font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#6b7280;margin-bottom:8px}
.q-cols p{margin:0;font-size:13.5px;line-height:1.5;color:#1f2937}
.q-met{display:inline-block;padding:3px 10px;border-radius:999px;background:#f3f4f6;font-weight:550}
.q-av{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.q-p{position:relative;display:inline-flex}.q-p .av{width:32px;height:32px}
.q-p i{position:absolute;right:-1px;bottom:-1px;width:10px;height:10px;border-radius:50%;background:#cbd5e1;border:2px solid #fff}.q-p i.on{background:#16a34a}
.q-mas{height:32px;min-width:32px;padding:0 8px;border-radius:999px;background:#FFF200;color:#0b0b10;font-size:12.5px;font-weight:650;display:grid;place-items:center}
.q-add{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border:1.5px dashed #d1d5db;border-radius:999px;background:none;font:inherit;font-size:13px;cursor:pointer}
.q-add svg{width:14px;height:14px}
.q-card footer{display:flex;align-items:center;gap:12px;padding:12px 18px;border-top:1px solid #eef0f4;background:#fafafa}
.q-card footer.act{background:#fffde6}
.q-ic{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;background:#fff;border:1px solid #e5e9f0;flex:none}.q-ic svg{width:15px;height:15px}
.q-card footer.act .q-ic,.qe-cola.act .q-ic{background:#FFF200;border-color:#FFF200}
.q-tx{flex:1;min-width:0}.q-tx b{display:block;font-size:13.5px;font-weight:600}.q-tx small{font-size:12.5px;color:#6b7280}
.q-cnt{font-size:12px;font-weight:650;padding:3px 10px;border-radius:999px;background:#FFF200;color:#0b0b10;white-space:nowrap}.q-cnt.mal{background:#fee2e2;color:#b91c1c}
.q-sw{display:block;flex:none;width:44px;height:24px;border:0;padding:0;border-radius:999px;background:#cbd5e1;position:relative;cursor:pointer}
.q-sw::after{content:"";position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.2);transition:left .2s cubic-bezier(.22,1,.36,1)}
.q-sw[aria-checked="true"]{background:#FFF200}.q-sw[aria-checked="true"]::after{left:23px;background:#0b0b10}
.q-sw:disabled{opacity:.5;cursor:not-allowed}
.q-sw:focus-visible{outline:2px solid #0b0b10;outline-offset:2px}
.qe{padding-bottom:20px}
.qe-cab{display:flex;align-items:center;gap:16px;margin:10px 0 22px}
.qe-logo{width:60px;height:60px}
.qe-t{flex:1;min-width:0}
.qe-nom{font:inherit;font-size:24px;font-weight:650;border:1.5px solid transparent;border-radius:9px;padding:2px 8px;margin-left:-9px;background:none;width:100%;max-width:420px;color:inherit}
.qe-nom:hover{border-color:#e5e9f0}.qe-nom:focus{outline:0;border-color:#0b0b10;background:#fff}
.qe-nom-t{margin:0;font-size:24px;font-weight:650}
.qe-look{display:flex;flex-direction:column;gap:8px;margin-top:6px}
.qe-icos{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.qe-icos button{width:32px;height:32px;border-radius:50%;border:1px solid #e5e9f0;background:#fff;display:grid;place-items:center;cursor:pointer;color:#0b0b10}
.qe-icos button svg{width:15px;height:15px}
.qe-icos button[aria-pressed="true"],.qe-svg.on{background:#FFF200;border-color:#FFF200;color:#0b0b10}
.qe-svg{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border-radius:999px;border:1.5px dashed #cbd5e1;font-size:12.5px;font-weight:600;cursor:pointer}
.qe-svg:hover{border-color:#0b0b10}.qe-svg svg{width:14px;height:14px;transform:rotate(180deg)}
.qe-sw{display:flex;gap:6px;flex-wrap:wrap}.qe-sw button{width:22px;height:22px;border-radius:50%;border:0;cursor:pointer;outline-offset:2px}.qe-sw button[aria-pressed="true"]{outline:2px solid #0b0b10}
.qe-grid{display:grid;grid-template-columns:1.25fr 1fr;gap:18px;align-items:start}
.qe-col{display:flex;flex-direction:column;gap:18px;min-width:0}
.qe-s{border:1px solid #e5e9f0;border-radius:16px;background:#fff;padding:18px}
.qe-h{display:flex;align-items:center;gap:10px;margin-bottom:12px}.qe-h h3{margin:0;font-size:15px;font-weight:650;flex:1}
.qe-c{font-size:12.5px;color:#6b7280}
.qe-per{display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid #f1f3f6}.qe-h+.qe-per{border-top:0}
.qe-per .av{width:36px;height:36px}.qe-nm{flex:1;min-width:0}.qe-nm b{display:block;font-size:14px;font-weight:600}.qe-nm small{font-size:12.5px;color:#6b7280}
.qe-rol{display:inline-flex;padding:3px;border-radius:10px;background:#f3f4f6;flex:none}
.qe-rol button{border:0;background:none;font:inherit;font-size:12.5px;font-weight:600;padding:5px 11px;border-radius:7px;color:#6b7280;cursor:pointer}
.qe-rol button[aria-pressed="true"]{background:#fff;color:#0b0b10;box-shadow:0 1px 2px rgba(15,23,42,.12)}
.qe-rol.lid button[aria-pressed="true"]{background:#FFF200;color:#0b0b10}
.qe-x{width:30px;height:30px;border:0;background:none;border-radius:8px;display:grid;place-items:center;color:#9ca3af;cursor:pointer;flex:none}.qe-x:hover{background:#fee2e2;color:#b91c1c}.qe-x svg{width:15px;height:15px}
.qe-busca{display:flex;align-items:center;gap:8px;margin-top:10px;padding:10px 12px;border:1.5px dashed #d1d5db;border-radius:11px}.qe-busca svg{width:16px;height:16px;color:#9ca3af}.qe-busca input{border:0;outline:0;font:inherit;font-size:13.5px;flex:1;background:none;min-width:0}
.qe-busca:focus-within{border-color:#0b0b10;border-style:solid}
.qe-vacio{display:flex;gap:12px;padding:14px;border-radius:12px;background:#fff7ed;color:#9a3412}.qe-vacio svg{width:18px;height:18px;flex:none}.qe-vacio b{display:block;font-size:13.5px}.qe-vacio small{font-size:12.5px}
.qe-sub{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:#f8f9fb;margin-top:8px}.qe-h+.qe-sub{margin-top:0}.qe-sub .sp{flex:1}.qe-sub .av{width:28px;height:28px}.qe-sub .q-mas{height:28px;min-width:28px}
.qe-pt{width:12px;height:12px;border-radius:50%;flex:none}
.qe-ay{margin:0;font-size:13px;color:#4b5563;line-height:1.5}
.qe-chk{display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-top:1px solid #f1f3f6;cursor:pointer}.qe-h+.qe-chk{border-top:0}.qe-chk input{margin-top:3px;accent-color:#0b0b10;width:16px;height:16px;flex:none}
.qe-chk b{display:block;font-size:13.5px;font-weight:600}.qe-chk small{font-size:12.5px;color:#6b7280}
.qe-met{display:flex;flex-direction:column;gap:8px}
.qe-met button{display:flex;gap:12px;align-items:center;text-align:left;padding:11px 12px;border:1.5px solid #e5e9f0;border-radius:12px;background:#fff;font:inherit;cursor:pointer;color:inherit}
.qe-met button:hover{border-color:#cbd5e1}.qe-met button[aria-checked="true"]{border-color:#0b0b10;background:#fffde6}
.qe-met b{display:block;font-size:13.5px;font-weight:600}.qe-met small{font-size:12.5px;color:#6b7280}
.qe-ic{width:32px;height:32px;border-radius:50%;background:#f3f4f6;display:grid;place-items:center;flex:none}.qe-ic svg{width:16px;height:16px}
.qe-met button[aria-checked="true"] .qe-ic{background:#FFF200}
.qe-cola.act{background:#fffde6;border-color:#f3e97a}
.qe-cola .q-cnt{display:inline-block;margin-top:10px}
.qe-pie{position:sticky;bottom:0;display:flex;gap:8px;align-items:center;margin-top:18px;padding:12px 0;background:linear-gradient(transparent,#fff 30%);z-index:2}.qe-pie .sp{flex:1}
.qe-borrar{color:#b91c1c;border-color:#fecaca}
@media (max-width:900px){.qe-grid{grid-template-columns:1fr}.q-cols{grid-template-columns:1fr;padding-left:18px;gap:14px}}
@media (max-width:560px){.qe-per{flex-wrap:wrap}.qe-rol{margin-left:48px}.q-card footer{flex-wrap:wrap}}
</style>`);
