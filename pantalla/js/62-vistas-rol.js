/* ── Vistas por rol ──
   Lo que cada persona ve del CRM sale de su rol en cada equipo, que manda el API en `alcance` (GET /crm/inicio y el
   evento `alcance`; lo guarda 80-datos.js en ALCANCE): el administrador que no está en ningún equipo ve todo; el líder de
   un equipo, todo su equipo; el integrante, solo lo que le asignen. El API ya manda solo eso; aquí se arma la pantalla.
   El rol de la plataforma ya no decide la vista: solo da la configuración general del CRM (ALCANCE.config: ADMIN o
   LIDER_VENTAS), como hoy.
   · Integrante (tablero 3): la barra con Mi bandeja, Menciones, Contactos, Embudo, Plantillas e Informes, con los íconos
     de la maqueta, y la lista «Mi bandeja» sin pestañas. Fuera de Ventas (el auditor) la barra es la de la maqueta: sin
     Conversación nueva, Carpetas, Equipos ni Canales. En Ventas el asesor los conserva, porque
     los usa para vender y la maqueta no dibuja su barra.
   · Líder o administrador sin equipo (tablero 4): la barra y las pestañas Mías, Sin asignar y Todas de hoy, con lo de su
     equipo; «Agentes IA» solo con la configuración general.
   · Embudo (28-sep): en un equipo con subequipos, la tarjeta dice «Subequipo · Persona». El selector de equipo ya sale
     solo a quien ve más de un equipo; «Etapas del embudo», solo con la configuración general.
   · Panel: en el desplegable Equipo, los subequipos van debajo de su equipo y se elige uno ahí; el botón dice
     «Equipo · Subequipo».
   · Equipo en vivo: el líder ve y pasa conversaciones solo entre la gente de sus equipos.
   · Ajustes del CRM: el líder sin la configuración general ve solo «Equipos y reparto».
   · Sin acceso al CRM (lo sacaron de su equipo): el bloque del error de carga con el mensaje del API.
   Reemplaza, reasignándolas, render, nav, lista, pagina, paginaContactos, panel, opcionesEquipo y dlgReasignar, y le quita
   a 40-ajustes.js el envoltorio que escondía el Embudo, las Plantillas y lo demás a quien entraba por un equipo. Usa las
   funciones compartidas de 61-equipos-roles.js. Lo propio lleva vr. */

/* ── 1 · Quién es en el CRM ── */
/** Lidera algún equipo o es administrador sin equipo: ve su equipo (o todo) con Mías, Sin asignar y Todas. */
function esLiderCrm(){ return !!(ALCANCE.todo || (ALCANCE.lidera || []).length); }
/** La configuración general del CRM (rol ADMIN o LIDER_VENTAS de la plataforma), igual que antes del lote 4. */
function puedeConfigurarCrm(){ return !!ALCANCE.config; }
// Ajustes del CRM: con la configuración general o para administrar sus equipos (solo «Equipos y reparto»).
const vrAjustesCrm = () => puedeConfigurarCrm() || equiposAdministrables().length > 0;
// La gente de Equipo en vivo: el administrador sin equipo, todas las personas; el líder, las de los equipos que lidera.
function vrGente(){
  if (ALCANCE.todo) return USUARIOS.slice();
  const ids = new Set((ALCANCE.lidera || []).flatMap(eq => idsDe(eq)));
  return USUARIOS.filter(u => ids.has(u.id));
}
// Mientras corre fn, st.rol (o un arreglo) queda como lo necesita el código de antes, que decide con él; luego vuelve.
function vrConRol(r, fn){ const g = st.rol; st.rol = r; try { return fn(); } finally { st.rol = g; } }
function vrConArreglo(a, f, fn){ const todo = a.slice(); a.splice(0, a.length, ...todo.filter(f)); try { return fn(); } finally { a.splice(0, a.length, ...todo); } }

// st.rol lo siguen usando 10-nucleo.js y los módulos: 'l' = líder (pestañas, líneas, Equipo en vivo, informes del equipo),
// 'a' = integrante. El integrante siempre está en su bandeja. La primera vez, el líder empieza en Todas, como hoy.
st.vrSinAcceso = null;
let vrPrimera = true;
function vrAplicarRol(){
  const lider = esLiderCrm();
  st.rol = lider ? 'l' : 'a';
  if (!lider) st.vista = 'mias';
  else if (vrPrimera) st.vista = 'todas';
  vrPrimera = false;
  document.getElementById('app').classList.toggle('vr-int', !lider);
}
// Llega con /crm/inicio (al cargar y al resincronizar) y cuando le cambian el rol o el equipo (80-datos.js).
document.addEventListener('crm:alcance', () => {
  vrAplicarRol();
  // Si le devolvieron el acceso, la pantalla de sin acceso se quita: el API ya le manda lo que ve.
  st.vrSinAcceso = null;
  // Perdió Ajustes del CRM estando ahí: vuelve a la bandeja (y la próxima vez Ajustes abre en Mi cuenta).
  if (st.ajTab === 'crm' && !vrAjustesCrm()) { if (st.pagina === 'ajustes') vrABandeja(); st.ajTab = 'cuenta'; }
});
crmListo.then(vrAplicarRol);

/* ── 2 · Cada pintado: el integrante en su bandeja y nadie en una página que ya no puede ver ── */
const VR_PAGINAS = {
  vivo: () => esLiderCrm(),
  difusiones: () => esLiderCrm() || puedeConfigurarCrm(),
  agentes: () => puedeConfigurarCrm(),
  'cfg-reparto': () => !!ALCANCE.todo || equiposAdministrables().length > 0,
};
const VR_CONFIG = new Set(['reglas', 'flujos', 'campos', 'importar', 'etiquetas']);
function vrPuedeVer(p){
  if (!p) return true;
  if (VR_PAGINAS[p]) return VR_PAGINAS[p]();
  if (p.startsWith('cfg-') || VR_CONFIG.has(p)) return puedeConfigurarCrm();
  return true;
}
function vrABandeja(){ st.pagina = ''; st.dif = null; st.tplNueva = null; st.menciones = false; if (!esLiderCrm()) st.vista = 'mias'; }
const vrRenderBase = render;
render = function(){
  document.getElementById('app').classList.toggle('vr-sin', st.vrSinAcceso != null);
  if (st.vrSinAcceso != null) { vrPintarSinAcceso(); return; }
  if (!esLiderCrm()) st.vista = 'mias';
  if (st.pagina === 'ajustes' && st.ajTab === 'crm' && !vrAjustesCrm()) st.ajTab = 'cuenta';
  if (st.pagina && !vrPuedeVer(st.pagina)) vrABandeja();
  return vrRenderBase.apply(this, arguments);
};

/* ── 3 · Barra (tablero 3 para el integrante; la de hoy para el líder) ── */
// Íconos de la maqueta RolesAuditor (trazo 1,8). En el cajón del celular salen los mismos.
const VR_IC = {
  inbox: '<path d="M3 13h5l1.5 3h5L16 13h5"/><path d="M5 5h14l2 8v6H3v-6l2-8Z"/>',
  menciones: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>',
  contactos: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  embudo: '<rect x="4" y="5" width="4" height="14" rx="1"/><rect x="10" y="9" width="4" height="10" rx="1"/><rect x="16" y="12" width="4" height="7" rx="1"/>',
  plantillas: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  informes: '<path d="M4 20h16M7 16v-5M12 16V6M17 16v-8"/>',
};
const vrIc = d => `<svg class="i vr-ic" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
// Es el último envoltorio de nav (después de 40-ajustes.js, 48-barra.js y 57-celular-menu.js).
const vrNavBase = nav;
nav = function(){
  vrNavBase.apply(this, arguments);
  const lider = esLiderCrm();
  document.getElementById('app').classList.toggle('vr-int', !lider);
  // El integrante que no es de Ventas (el auditor de la maqueta) no ve Conversación nueva, Carpetas, Equipos ni Canales.
  document.getElementById('app').classList.toggle('vr-aud', !lider && !(ALCANCE.equipos || []).includes('Ventas'));
  document.getElementById('tabs').hidden = !lider;
  if (lider) {
    if (!puedeConfigurarCrm()) { const b = document.querySelector('#principal [data-nav="agentes"]'); if (b && b.closest('li')) b.closest('li').remove(); }
    // Líneas de WhatsApp: el líder ve solo las de sus equipos (nada de otros equipos, 30-sep); el administrador sin equipo, todas.
    if (!ALCANCE.todo) {
      const suyas = new Set((ALCANCE.equipos || []).flatMap(eq => lineasDe(eq).map(l => l.id)));
      document.querySelectorAll('#lineas [data-l]').forEach(b => { if (!suyas.has(b.dataset.l) && b.closest('li')) b.closest('li').remove(); });
      if (!document.querySelector('#lineas [data-l]')) document.getElementById('sec-lineas').hidden = true;
    }
    return;
  }
  // Mismos data-nav que la barra de hoy (irA sigue igual). Menciones va arriba, con las nuevas; Mi bandeja, con las suyas.
  const cur = k => st.pagina ? st.pagina === k : k === 'menciones' ? !!st.menciones : k === 'inbox' && !st.menciones;
  document.getElementById('principal').innerHTML = [
    ['inbox', 'Mi bandeja', cuenta(esMia)],
    ['menciones', 'Menciones', st.menciones ? 0 : mencionesNuevas()],
    ['contactos', 'Contactos', null],
    ['embudo', 'Embudo', null],
    ['plantillas', 'Plantillas', null],
    ['informes', 'Informes', null],
    // Con la configuración general (ADMIN o LIDER_VENTAS sin equipo que liderar), Difusiones y Agentes IA siguen siendo
    // suyas, como antes del lote 4 (la maqueta del auditor no las dibuja porque el auditor no las tiene).
    ...(puedeConfigurarCrm() ? [['difusiones', 'Difusiones', null], ['agentes', 'Agentes IA', null]] : []),
  ].map(([k, n, c]) => `<li><button type="button" aria-current="${cur(k)}" data-nav="${k}">${VR_IC[k] ? vrIc(VR_IC[k]) : I(VR_IC_HOY[k], 'i vr-ic')}${n}${c != null ? `<span class="n">${c || ''}</span>` : ''}</button></li>`).join('');
};
// Los íconos de hoy (10-nucleo.js) para lo que la maqueta del auditor no dibuja.
const VR_IC_HOY = {difusiones: 'megaphone', agentes: 'bot'};

/* ── 4 · Lista: el integrante ve «Mi bandeja» sin pestañas ni «Ver las de todo el equipo» (su bandeja es todo lo suyo) ── */
const vrListaBase = lista;
lista = function(){
  // Sin acceso al CRM, el buscador y el orden (que llaman lista() sin pasar por render) tampoco pintan lo de antes.
  if (st.vrSinAcceso != null) { vrPintarSinAcceso(); return; }
  vrListaBase.apply(this, arguments);
  if (esLiderCrm()) return;
  document.querySelectorAll('#items [data-ver-todas]').forEach(b => b.remove());
  const s = [...document.querySelectorAll('#items .nothing > span')].find(x => x.textContent === 'Buscaste solo en esta vista.');
  if (s && !filtroActivo().length) s.textContent = 'Revisa el nombre o prueba con el número.';
};

/* ── 5 · Páginas: Embudo, Contactos, Equipo en vivo, Ajustes y las de configuración ── */
const vrPaginaBase = pagina;
pagina = function(){
  const p = st.pagina || '', base = () => vrPaginaBase.apply(this, arguments);
  // Ajustes: la pestaña «CRM del equipo» es de quien tiene la configuración general o administra algún equipo.
  if (p === 'ajustes') { vrConRol(vrAjustesCrm() ? 'l' : 'a', base); vrAjustes(); return; }
  // Las páginas de la configuración general (solo con ALCANCE.config) deciden «puede cambiar» con st.rol (47-pauta.js).
  if (p.startsWith('cfg-') && p !== 'cfg-reparto') { vrConRol('l', base); return; }
  // Equipo en vivo: el líder ve solo a la gente de sus equipos.
  if (p === 'vivo' && !ALCANCE.todo) { const ids = new Set(vrGente().map(u => u.id)); vrConArreglo(USUARIOS, u => ids.has(u.id), base); return; }
  base();
  if (p === 'embudo') vrEmbudo();
};
function vrAjustes(){
  if (st.ajTab !== 'crm' || !vrAjustesCrm()) return;
  const pg = document.getElementById('page');
  const quitar = b => { const s = b.closest('section'); b.remove(); if (s && !s.querySelector('.grid3 > button')) s.remove(); };
  if (!puedeConfigurarCrm()) pg.querySelectorAll('.ajg .grid3 > button[data-ir]').forEach(b => { if (b.dataset.ir !== 'cfg-reparto') quitar(b); });
  else if (!equiposAdministrables().length) { const b = pg.querySelector('.ajg .grid3 > button[data-ir="cfg-reparto"]'); if (b) quitar(b); }
}
// «Subequipo · Persona» (maqueta Embudo del 28-sep): el primer nombre de quien la tiene.
const vrPrimerNombre = n => String(n || '').trim().split(/\s+/)[0] || '';
function vrEmbudo(){
  const pg = document.getElementById('page'), eq = st.embEq, cfg = puedeConfigurarCrm();
  const der = pg.querySelector('.pg-h > div:last-child'), et = pg.querySelector('.pg-h [data-ir="cfg-etapas"]');
  // Sin el botón «Etapas del embudo» en el Embudo (6-oct): las etapas se cambian en Ajustes del CRM.
  if (et) et.remove();
  const vacio = [...pg.querySelectorAll('p.muted')].find(x => / todavía no tiene etapas\./.test(x.textContent));
  if (vacio) vacio.textContent = `${eq} todavía no tiene etapas. ${cfg ? 'Créalas en Etapas del embudo.' : esLiderCrm() ? 'Las crea un administrador.' : 'Las crea su líder.'}`;
  if (!subequiposDe(eq).length) return;
  pg.querySelectorAll('.kc[data-kc]').forEach(k => {
    const c = CONV.find(x => x.id === +k.dataset.kc), p = k.querySelector(':scope > p'); if (!c || !p) return;
    const s = subequipoDeConv(c);
    p.textContent = `${s ? s.n : 'Sin subequipo'} · ${c.asig ? vrPrimerNombre(c.asig) : 'Sin asignar'}`;
  });
}
// Contactos: «Importar desde Excel» es de la configuración general (el API lo exige).
const vrContactosBase = paginaContactos;
paginaContactos = function(){
  const r = vrContactosBase.apply(this, arguments);
  const m = document.getElementById('ct-mas');
  if (m) {
    const imp = m.querySelector('[data-ct-acc="importar"]');
    if (!puedeConfigurarCrm() && imp) imp.remove();
    if (puedeConfigurarCrm() && !imp) m.insertAdjacentHTML('afterbegin', `<button type="button" data-ct-acc="importar">${I('file')}Importar desde Excel</button>`);
  }
  return r;
};
// Difusiones: crearlas es de la configuración general; sin ella, el aviso de hoy. Con ella y sin liderar un equipo
// (st.rol 'a'), 10-nucleo.js daría ese aviso: aquí se abre la difusión como lo hace allá para el líder.
document.addEventListener('click', e => {
  const t = e.target instanceof Element ? e.target : null; if (!t) return;
  const b = t.closest('#page #b-dif, #page [data-ct-acc="difusion"]'); if (!b) return;
  if (!puedeConfigurarCrm()) { e.stopPropagation(); toast('Las difusiones las envía el líder de Ventas'); return; }
  if (st.rol === 'l') return;
  e.stopPropagation();
  const base = {paso: 1, tpl: (TPL[0] || {}).n || '', linea: (LINEAS[0] || {}).id || null, cuando: 'ahora'};
  if (b.id === 'b-dif') { st.dif = {...base, aud: new Set(['En seguimiento', 'Sin respuesta'])}; render(); return; }
  const ct = st.ct, n = ct.sel.size, ids = ctTodos().filter(c => ct.sel.has(c.id)).map(c => c.contactoId).filter(Boolean);
  ct.sel.clear(); st.pagina = 'difusiones'; st.dif = {...base, aud: new Set(), seleccion: n, ids, publico: 'sel', n: `Difusión a ${n} contactos elegidos`}; render();
}, true);
// Llamar (20-llamadas.js): la nota de «Ajustes del CRM, Líneas de WhatsApp» solo a quien puede entrar ahí.
document.addEventListener('click', e => {
  if (!(e.target instanceof Element) || !e.target.closest('#b-call') || document.getElementById('ov-x').hidden) return;
  const d = document.getElementById('dlg-x'), h = [...d.querySelectorAll('p.muted')].find(x => /Líneas de WhatsApp/.test(x.textContent));
  const llamar = /^Llamar a /.test((d.querySelector('h3') || {}).textContent || ''), ft = d.querySelector('.ft2');
  if (h && !puedeConfigurarCrm()) h.remove();
  else if (!h && llamar && ft && puedeConfigurarCrm()) ft.insertAdjacentHTML('beforebegin', '<p class="muted">Las llamadas de cada línea se ven en Ajustes del CRM, Líneas de WhatsApp.</p>');
}, true);

/* ── 6 · Equipo en vivo: «Pasar sus conversaciones» solo a la gente de sus equipos ── */
const vrDlgReasignarBase = dlgReasignar;
dlgReasignar = function(){
  if (ALCANCE.todo) return vrDlgReasignarBase.apply(this, arguments);
  const g = new Set(vrGente().map(u => u.nombre));
  return vrConArreglo(ASESORES, a => g.has(a), () => vrDlgReasignarBase.apply(this, arguments));
};
// El reparto automático de «Pasar» entre los conectados de sus equipos (10-nucleo.js lo haría entre todos los del CRM).
document.getElementById('ov-x').addEventListener('click', e => {
  if (ALCANCE.todo || !st.rs || !(e.target instanceof Element) || !e.target.closest('#rs-ok')) return;
  e.stopPropagation();
  const r = st.rs; if (!r.a) { toast('Elige a quién se las pasas'); return; }
  const lista2 = CONV.filter(x => x.asig === r.de && (x.est || 'abiertas') === 'abiertas' && (!r.solo || x.espera));
  const enLinea = vrGente().filter(u => u.nombre !== r.de && estadoDe(u) === 'En línea' && u.reparto !== false).map(u => u.nombre);
  if (r.a === 'Reparto automático' && !enLinea.length) { toast('No hay nadie más en línea para repartirlas'); return; }
  lista2.forEach((x, i) => { x.asig = r.a === 'Reparto automático' ? enLinea[i % enLinea.length] : r.a; x.msgs.push({ev:'swap', t:`El líder la pasó de ${r.de} a ${x.asig} · ahora`}); });
  cerrarDialogo(); render(); toast(`${lista2.length ? 'Conversaciones pasadas' : 'Listo'} de ${r.de} a ${r.a === 'Reparto automático' ? 'quienes están en línea' : r.a}`);
}, true);

/* ── 7 · Panel: pasar la conversación a un subequipo desde el desplegable Equipo ── */
// Debajo de cada equipo, sus subequipos (sangría y el cuadro del color al 60 %). Elegido va el subequipo, no su equipo.
opcionesEquipo = function(c, q){
  const n = norm(q), actual = c ? equipoConv(c) : '', sub = c ? subequipoDeConv(c) : null;
  const L = EQUIPOS.filter(t => !n || norm(t.n).includes(n) || subequiposDe(t.n).some(s => norm(s.n).includes(n)));
  return L.map(t => {
    const selEq = t.n === actual && !sub, subs = subequiposDe(t.n).filter(s => !n || norm(t.n).includes(n) || norm(s.n).includes(n));
    return `<button type="button" role="option" data-eq="${esc(t.n)}" aria-selected="${selEq}"><i class="pc-sq" style="background:${colorEquipo(t.n)}"></i>${esc(t.n)}${selEq ? I('check','i ck') : ''}</button>`
      + subs.map(s => { const sel = t.n === actual && !!sub && sub.id === s.id;
        return `<button type="button" role="option" class="vr-sub" data-vr-sub="${esc(t.n)}|${esc(s.id)}" aria-selected="${sel}"><i class="pc-sq" style="background:${colorEquipo(t.n)}"></i>${esc(s.n)}${sel ? I('check','i ck') : ''}</button>`; }).join('');
  }).join('') || '<p class="muted" style="padding:8px 10px;margin:0">Ningún equipo coincide.</p>';
};
// Antes que el manejador del panel (10-nucleo.js, en la captura de #panel): el subequipo, y quitarlo eligiendo su equipo.
// Otro equipo lo sigue haciendo 10-nucleo.js; aquí solo se suelta el subequipo que tenía (el API también lo suelta).
document.addEventListener('click', e => {
  const t = e.target instanceof Element ? e.target : null; if (!t || !t.closest('#panel #eq-m')) return;
  const sb = t.closest('[data-vr-sub]'), q = sb ? null : t.closest('[data-eq]'); if (!sb && !q) return;
  const c = CONV.find(x => x.id === st.sel); if (!c) return;
  const antes = subequipoDeConv(c);
  if (sb) {
    e.stopPropagation(); cerrarMenusPanel();
    const [eq, id] = sb.dataset.vrSub.split('|'), s = subequiposDe(eq).find(x => x.id === id);
    if (!s || (equipoConv(c) === eq && antes && antes.id === id)) return;
    c.equipo = eq; c.subequipo = id;
    c.msgs.push({ev:'swap', t:`Pasó al subequipo ${s.n} · ahora`}); render(); toast(`Pasó al subequipo ${s.n}`);
    return;
  }
  if (q.dataset.eq === equipoConv(c)) {
    if (!antes) return;
    e.stopPropagation(); cerrarMenusPanel();
    c.subequipo = null;
    c.msgs.push({ev:'swap', t:`Pasó al equipo ${q.dataset.eq} · ahora`}); render(); toast(`Pasó al equipo ${q.dataset.eq}`);
    return;
  }
  if (c.subequipo) c.subequipo = null;
}, true);
// El botón dice «Equipo · Subequipo» (después del envoltorio del celular, 58-celular-chat.js).
const vrPanelBase = panel;
panel = function(c){
  const r = vrPanelBase.apply(this, arguments);
  const s = c ? subequipoDeConv(c) : null, t = document.querySelector('#panel #eq-b .t');
  if (s && t) t.textContent = `${equipoConv(c)} · ${s.n}`;
  return r;
};

/* ── 8 · Sin acceso al CRM: lo sacaron de su equipo (evento `alcance` sin alcance o 403 al resincronizar) ── */
// El mismo bloque del error de carga de hoy (80-datos.js), sin conversaciones, chat ni página. Los datos que había no se
// tocan (así la revisión de 80-datos.js no cree que se borraron); solo dejan de pintarse.
function crmSinAcceso(mensaje){
  st.vrSinAcceso = String(mensaje || 'No tienes acceso al CRM. Pídele a un líder que te agregue a un equipo.');
  st.pagina = ''; st.sel = 0; st.menciones = false; st.dif = null; st.tplNueva = null;
  for (const id of ['ov', 'ov-x', 'ov-res']) { const o = document.getElementById(id); if (o) o.hidden = true; }
  vrPintarSinAcceso();
}
function vrPintarSinAcceso(){
  const app = document.getElementById('app');
  app.classList.remove('pg', 'open'); app.classList.add('sinchat', 'vr-sin');
  for (const id of ['principal', 'carpetas', 'equipos', 'etiquetas', 'canales', 'tags', 'lineas']) { const el = document.getElementById(id); if (el) el.innerHTML = ''; }
  document.getElementById('sec-lineas').hidden = true; document.getElementById('tabs').hidden = true; document.getElementById('fchips').hidden = true;
  document.getElementById('lt').textContent = 'Mi bandeja';
  document.getElementById('page').innerHTML = '';
  const it = document.getElementById('items'), m = it.querySelector('#crm-reintentar') && it.querySelector('.nothing > span');
  if (m && m.textContent === st.vrSinAcceso) return;
  it.innerHTML = `<div class="nothing"><b>No se pudo cargar el CRM</b><span>${esc(st.vrSinAcceso)}</span><button type="button" class="btn" id="crm-reintentar">Intentar de nuevo</button></div>`;
  // Ya cargado, se vuelve a abrir el CRM desde cero: lo que tenía en memoria es de cuando veía otro equipo.
  it.querySelector('#crm-reintentar').addEventListener('click', () => { if (crmCargado) { location.reload(); return; } st.vrSinAcceso = null; crmArrancar(); }, {once: true});
}

/* ── 9 · Estilos (solo modo claro) ── */
document.head.insertAdjacentHTML('beforeend', `<style>
/* Encabezado de la lista como las maquetas RolesAuditor y RolesLider (29-sep), para el integrante y para el líder: el
   título con su alto de línea normal, «Abiertas» de 24 px, filtrar y ordenar con el ícono de 17 en #374151, el buscador
   de 38 px en #f6f7f9 y las pestañas de 38. En celular 57-celular-menu.js ya lo pone igual. */
.list-h .t h2{line-height:normal}
.list-h .t #b-est{height:24px;gap:4px;padding:0 8px;border-radius:8px;color:#374151}
.list-h .t .ic > .dd > button{color:#374151}
.list-h .t .ic > .dd > button svg{width:17px;height:17px}
.list-h .lq{height:38px;background:#f6f7f9}
.list-h .lq:focus-within{background:#fff}
#tabs > button{line-height:normal}
/* La barra del integrante como la maqueta RolesAuditor: alto de línea normal (opciones de 36 px), 16 px entre secciones,
   títulos de sección sin raya, texto #374151, íconos de 18 en #6b7280 (azules en la actual) y puntos de 8. */
.app.vr-int > .nav{gap:16px;line-height:normal}
/* En celular 57-celular-menu.js mete lo de la barra en .cj-medio: por eso no va con «>». */
#app.vr-aud .nav .topbar,#app.vr-aud .nav div:has(> #carpetas),#app.vr-aud .nav div:has(> #equipos),#app.vr-aud .nav div:has(> #canales){display:none}
.app.vr-int > .nav .sec{margin:2px 0 6px;border-bottom:0}
.app.vr-int > .nav li button:not(.bl-gr){color:#374151}
.app.vr-int > .nav #principal button > svg.vr-ic{width:18px;height:18px;color:#6b7280;stroke-width:1.8}
.app.vr-int > .nav #principal button[aria-current="true"],.app.vr-int > .nav #principal button[aria-current="true"] > svg.vr-ic{color:#0b0b10}
.app.vr-int > .nav #etiquetas .dot,.app.vr-int > .nav #tags .dot{width:8px;height:8px}
/* Sin acceso al CRM: sin buscador, filtrar, ordenar ni el estado de la lista (no hay nada que buscar). */
.app.vr-sin .list-h .t > .dd,.app.vr-sin .list-h .t > .ic,.app.vr-sin .list-h .lq{display:none}
.pc-pr .menu button.vr-sub{padding-left:28px}
.pc-pr .menu button.vr-sub > .pc-sq{opacity:.6}
</style>`);
