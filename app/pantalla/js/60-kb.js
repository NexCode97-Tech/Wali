
/* ── Base de conocimiento y panel de control de los agentes IA (25-sep, como Trengo).
   Desde el 26-sep cada agente tiene la suya y se llena dentro de su editor: fragmentos, sitios web y
   documentos (PDF, TXT, CSV). Por dentro sigue siendo una colección de la clave `kb` (la primera de `a.kb`),
   que el motor (agenteIA.ts) lee igual que antes; la pantalla ya no habla de colecciones. ── */
document.head.insertAdjacentHTML('beforeend', `<style>
.kb-n{display:inline-grid;place-items:center;min-width:20px;height:20px;border-radius:999px;background:var(--bg3);font-size:11px;font-weight:600;color:var(--ink3);padding:0 6px;margin-left:4px}
.kb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:14px}
.kb-card{display:flex;align-items:center;gap:12px;width:100%;text-align:left;border:1px solid var(--line);border-radius:12px;background:#fff;padding:16px}
.kb-card:hover{border-color:#bcdcff;background:#fafcff}
.kb-card > span:nth-child(2){flex:1;min-width:0}
.kb-card b{display:block;font-size:14.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kb-card small{display:block;font-size:12.5px;color:var(--ink3)}
.kb-ic{width:42px;height:42px;border-radius:10px;border:1px solid var(--line);display:grid;place-items:center;flex:none;color:var(--ink2)}
.kb-ic svg{width:20px;height:20px}
.kb-card .ch{color:var(--ink4);transform:rotate(-90deg)}
.kb-top{display:flex;align-items:center;gap:12px;margin:4px 0 18px;flex-wrap:wrap}
.kb-top h2{margin:0;display:flex;align-items:center;gap:8px}
.kb-top .sp{flex:1}
.kb-sec{border:1px solid var(--line);border-radius:12px;background:#fff;padding:16px;margin-bottom:14px;display:grid;grid-template-columns:minmax(0,1fr);gap:10px;min-width:0}
.kb-sec > .hd{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.kb-sec > .hd b{font-size:15px;font-weight:600;flex:1;display:flex;align-items:center;gap:6px;min-width:120px}
.kb-sec > .hd .kb-ico{width:34px;height:34px;border-radius:9px;background:var(--bg3);color:var(--ink2);display:grid;place-items:center;flex:none}
.kb-sec > .hd .kb-ico svg{width:18px;height:18px}
.kb-sec > .hd .btn.ic{width:32px;height:32px;padding:0}
.kb-sec .sub2{margin:0;font-size:12.5px;color:var(--ink3);line-height:1.55}
.kb-par{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:14px;align-items:start;margin-bottom:14px}
.kb-par .kb-sec{margin-bottom:0}
.kb-cab{display:grid;gap:4px;margin:2px 2px 14px}
.kb-cab h3{margin:0;font-size:17px;font-weight:600}
.kb-cab p{margin:0;font-size:12.5px;color:var(--ink3);line-height:1.55}
.kb-tope{margin:0 0 14px;padding:8px 10px;border-radius:8px;background:#fff7ed;color:#9a3412;font-size:13px}
.kb-nada{display:flex;align-items:center;gap:12px;border:1px dashed var(--line);border-radius:10px;padding:14px 16px;background:var(--bg2)}
.kb-nada svg{width:22px;height:22px;color:var(--ink3);flex:none}
.kb-nada b{display:block;font-size:13.5px;font-weight:600;color:var(--ink2)}
.kb-nada span{display:block;font-size:12.5px;color:var(--ink3)}
.cn-tabs button .kb-n{margin-left:6px}
.cn-tabs button[aria-selected="true"] .kb-n{background:var(--blue-soft);color:var(--blue-ink)}
.kb-row{display:flex;align-items:center;gap:10px;border:1px solid var(--line2);border-radius:10px;padding:10px 12px;background:var(--bg2)}
.kb-row > span.tx{flex:1;min-width:0}
.kb-row b{display:block;font-size:13.5px;font-weight:400;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kb-row small{display:block;font-size:12px;color:var(--ink3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.kb-row .btn.ic{width:30px;height:30px;padding:0}
.kb-row svg.lead{width:18px;height:18px;color:var(--ink3);flex:none}
.kb-drop{border:1.5px dashed #cbd5e1;border-radius:12px;background:var(--bg2);padding:22px;display:grid;justify-items:center;gap:8px;text-align:center;transition:background .15s,border-color .15s}
.kb-drop.fino{padding:12px;border-radius:10px}
.kb-drop svg{width:26px;height:26px;color:var(--ink3)}
.kb-drop b{font-size:14px;font-weight:600;color:var(--ink2)}
.kb-drop.sobre{background:var(--blue-soft);border-color:var(--blue)}
.kb-drop p{margin:0;font-size:12.5px;color:var(--ink3)}
.kb-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.kb-bar .cn-q{margin:0;min-width:200px;flex:1}
.kb-bar .dsel{min-width:170px!important}
.kb-row input[type="checkbox"]{width:16px;height:16px;accent-color:var(--blue)}
.kb-st{font-size:11.5px;font-weight:600;border-radius:999px;padding:1px 8px}
.kb-st.pr{background:var(--amber-soft);color:var(--amber-ink)}
.kb-st.ok{background:var(--green-soft);color:var(--green-ink)}
.kb-menu{position:relative}
.kb-menu .menu{right:0;left:auto;min-width:170px}
.pc-f{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px}
.pc-f .dsel{min-width:200px!important}
.pc-k{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:14px}
.pc-k div{border:1px solid var(--line);border-radius:12px;background:#fff;padding:14px 16px}
.pc-k span{display:block;font-size:12.5px;font-weight:600;color:var(--ink3)}
.pc-k b{display:block;font-size:24px;font-weight:600;margin-top:4px;font-variant-numeric:tabular-nums}
.pc-k small{display:block;font-size:12px;color:var(--ink3);margin-top:2px}
.pc-g{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,1fr);gap:14px}
@media (max-width:1100px){.pc-g{grid-template-columns:1fr}}
.pc-c{border:1px solid var(--line);border-radius:12px;background:#fff;padding:16px}
.pc-c h4{margin:0 0 10px;font-size:14px;font-weight:600}
.pc-c svg text{font-family:inherit}
.pc-t{display:grid;gap:8px}
.pc-t .r{display:grid;grid-template-columns:1fr 60px;gap:10px;align-items:center;font-size:13px}
.pc-t .b{height:8px;border-radius:4px;background:var(--bg3);overflow:hidden;margin-top:4px}
.pc-t .b i{display:block;height:100%;background:var(--blue);border-radius:4px}
.pc-t .r span:last-child{text-align:right;font-variant-numeric:tabular-nums}
</style>`);

// Colecciones de la base de conocimiento (clave `kb`): {id, n, frag:[{t, x}], webs:[{u, pag, f, texto}], docs:[{n, s, f, url, texto, paginas, estado}]}.
const KB = [];
st.agSec = 'agentes'; st.kbId = null; st.kbQ = ''; st.kbOrden = 'Más reciente'; st.kbSel = new Set(); st.pcPer = 'Últimos 7 días'; st.pcAg = 'todos';
st.kbSubiendo = []; st.kbLeyendo = new Set();
const kbRec = k => k.frag.length + k.webs.length + k.docs.length;
const kbUsos = k => AGENTES.filter(a => (a.kb || []).includes(k.id)).length;
const kbDesc = k => [k.frag.length ? `${k.frag.length} fragmento${k.frag.length === 1 ? '' : 's'}` : '', k.webs.length ? `${k.webs.length} sitio${k.webs.length === 1 ? '' : 's'} web` : '', k.docs.length ? `${k.docs.length} documento${k.docs.length === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ') || 'Vacía';
// Fecha guardada (ISO) como se lee en la lista: hoy, ayer o el día.
const cuandoKB = f => { if (!f || isNaN(Date.parse(f))) return String(f || ''); const d = diaColombia(f); if (d === diaColombia(Date.now())) return 'hoy'; if (d === diaColombia(Date.now() - 864e5)) return 'ayer'; const [y, m, dd] = d.split('-').map(Number); return `${dd} ${MESES_C[m - 1]}${y !== ahoraCO().y ? ' ' + y : ''}`; };
const paginasTxt = n => n ? ` · ${n} ${n === 1 ? 'página' : 'páginas'}` : '';

// Salir de una colección: vuelve al editor del agente desde donde se abrió (o a la lista de agentes).
function kbVolverAlAgente(){
  st.kbId = null; st.agSec = 'agentes';
  if (AGENTES.some(x => x.id === st.kbDesde)) { st.agId = st.kbDesde; st.agV = 'editor'; } else st.agV = 'lista';
}

// Lo que el agente alcanza a leer (api/src/services/crm/agentes.ts, MAX_KB): el texto de todas sus colecciones.
const KB_TOPE = 200000;
const kbTotal = a => (a.kb || []).map(id => KB.find(k => k.id === id)).filter(Boolean)
  .reduce((n, k) => n + k.frag.reduce((m, f) => m + (f.x || '').length, 0) + k.webs.reduce((m, w) => m + (w.texto || '').length, 0) + k.docs.reduce((m, d) => m + (d.texto || '').length, 0), 0);
/* La base de conocimiento propia de un agente: la primera colección de `a.kb`. Se crea al agregarle algo. */
const kbPropia = a => KB.find(k => k.id === (a.kb || [])[0]) || null;
function kbAsegurar(a){
  let k = kbPropia(a);
  if (!k) { k = {id:'kb-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), n:a.nombre, frag:[], webs:[], docs:[]}; KB.push(k); a.kb = [k.id, ...(a.kb || []).filter(id => KB.some(x => x.id === id))]; }
  return k;
}

/* Pestaña Conocimiento del editor del agente: su base de conocimiento en
   tarjetas separadas, Documentos, Sitios web y Fragmentos, para llenarla ahí mismo. */
const kbCuenta = a => { const k = kbPropia(a); return k ? kbRec(k) : 0; };
function conocimientoHTML(a){
  const k = kbPropia(a) || {id:'', n:a.nombre, frag:[], webs:[], docs:[]};
  st.kbId = k.id || null;
  const otras = (a.kb || []).slice(1).map(id => KB.find(x => x.id === id)).filter(Boolean);
  return `<div class="kb-cab"><h3>Lo que sabe el agente</h3><p>El agente responde con lo que haya aquí y sigue las instrucciones que traigan tus documentos. Si algo no está, no lo inventa: pasa la conversación a un asesor.</p></div>
    ${kbTotal(a) > KB_TOPE ? `<p class="kb-tope">Tus documentos suman ${kbTotal(a).toLocaleString('es-CO')} caracteres y el agente lee hasta ${KB_TOPE.toLocaleString('es-CO')}: lo que pasa de ahí no lo ve. Quita lo que no necesite o divide los documentos largos.</p>` : ''}
    ${kbCuerpo(k)}
    ${otras.length ? `<section class="kb-sec"><div class="hd"><span class="kb-ico">${I('folder')}</span><b>También aprende de</b></div>${otras.map(x => `<div class="kb-row">${I('folder', 'i lead')}<span class="tx"><b>${esc(x.n)}</b><small>${esc(kbDesc(x))}</small></span><button type="button" class="btn ic" data-kb-desc="${x.id}" aria-label="Quitar ${esc(x.n)}">${I('x')}</button></div>`).join('')}</section>` : ''}`;
}
/* Páginas del módulo: pestañas Panel de control (los agentes) y Resultados. */
const paginaAgentesKB = paginaAgentes;
paginaAgentes = function(){
  // Fuera del editor del agente no hay base de conocimiento abierta (el editor la fija al pintarse).
  if (st.agV !== 'editor' && !(st.agSec === 'kb' && st.kbId)) st.kbId = null;
  if (st.agV === 'editor' || st.agV === 'plantillas') return paginaAgentesKB();
  const sec = st.agSec;
  const tabs = `<div class="cn-bar"><div class="cn-tabs" role="tablist">${[['agentes', 'Panel de control'], ['panel', 'Resultados']].map(([k, n]) => `<button type="button" role="tab" aria-selected="${sec === k}" data-ag-sec="${k}">${n}</button>`).join('')}</div></div>`;
  if (sec === 'agentes') return paginaAgentesKB().replace('<div class="cfg">', tabs + '<div class="cfg">');
  const cab = (btn) => `<div class="pg-h"><div><h2>Agentes IA</h2><p class="sub">Atienden a tus clientes al principio, en lenguaje natural, y los pasan al asesor correcto con todo listo.</p></div>${btn || ''}</div>${tabs}`;
  // La base de conocimiento se maneja desde cada agente: la colección se abre desde su editor.
  if (sec === 'kb' && st.kbId) { const k = KB.find(x => x.id === st.kbId); if (k) return `<div class="ajw ancho ag-w">${coleccionHTML(k)}</div>`; st.kbId = null; }
  if (sec === 'kb') { st.agSec = 'agentes'; return paginaAgentes(); }
  return `<div class="ajw ancho ag-w">${cab()}${panelHTML()}</div>`;
};

function coleccionHTML(k){
  const desde = AGENTES.find(x => x.id === st.kbDesde);
  return `<button type="button" class="volver" data-kb-volver="1">${I('back')}${desde ? esc(desde.nombre) : 'Agentes IA'}</button>
    <div class="kb-top"><span class="kb-ic">${I('folder')}</span><h2>${esc(k.n)}<span class="kb-n">${kbRec(k)}</span></h2><span class="sp"></span><small class="muted">Usada en ${kbUsos(k)} agente${kbUsos(k) === 1 ? '' : 's'}</small><button type="button" class="btn" data-kb-renombrar="1">${I('pen')}Editar colección</button></div>
    ${kbCuerpo(k)}`;
}

/* Documentos, sitios web y fragmentos de una base de conocimiento, cada uno en su tarjeta: lo mismo en la pestaña
   Conocimiento del agente y en la página de la colección. */
const kbCon = n => n ? `<span class="kb-n">${n}</span>` : '';
function kbCuerpo(k){
  const q = norm(st.kbQ.trim());
  let docs = k.docs.map((d, i) => ({...d, i})).filter(d => !q || norm(d.n).includes(q));
  docs.sort((x, y) => st.kbOrden === 'Nombre' ? x.n.localeCompare(y.n) : String(y.f || '').localeCompare(String(x.f || '')));
  const sel = [...st.kbSel].filter(i => k.docs[i]);
  const subiendo = st.kbSubiendo.filter(p => p.kb === k.id && (!q || norm(p.n).includes(q)));
  const hayDocs = k.docs.length || st.kbSubiendo.some(p => p.kb === k.id);
  const websNuevas = [...st.kbLeyendo].filter(c => c.startsWith(k.id + '|')).map(c => c.slice(k.id.length + 1)).filter(u => !k.webs.some(w => w.u === u));
  const documentos = `<section class="kb-sec kb-docs" aria-label="Documentos"><div class="hd"><span class="kb-ico">${I('file')}</span><b>Documentos${kbCon(k.docs.length)}</b>
        <button type="button" class="btn" data-kb-nube="1">${I('folder')}Elegir de Archivos del CRM</button><button type="button" class="btn" data-kb-subir="1">${I('file')}Subir documentos</button></div>
      <p class="sub2">Catálogos, guiones e instrucciones de venta. PDF, Word, Excel, TXT o CSV, hasta 20 MB por archivo. Revisa el texto que leyó el agente con «Ver y corregir el texto».</p>
      ${hayDocs ? `<div class="kb-bar"><label class="cn-q">${I('search')}<input id="kb-q" value="${esc(st.kbQ)}" placeholder="Buscar documentos" autocomplete="off" aria-label="Buscar documentos"></label>${ddSel('data-kb-orden', [['Más reciente', 'Más reciente'], ['Nombre', 'Por nombre']], st.kbOrden)}${sel.length ? `<button type="button" class="btn" data-kb-quitarsel="1">${I('x')}Quitar ${sel.length} seleccionado${sel.length === 1 ? '' : 's'}</button>` : ''}</div>
      ${subiendo.map(p => `<div class="kb-row"><input type="checkbox" disabled aria-label="Procesando ${esc(p.n)}">${I('file', 'i lead')}<span class="tx"><b>${esc(p.n)}</b><small>${p.s ? esc(p.s) + ' · ' : ''}subiendo y leyendo el texto</small></span><span class="kb-st pr">Procesando…</span></div>`).join('')}
      ${docs.length ? docs.map(d => `<div class="kb-row"><input type="checkbox" data-kb-check="${d.i}" ${st.kbSel.has(d.i) ? 'checked' : ''} aria-label="Elegir ${esc(d.n)}">${I('file', 'i lead')}<span class="tx"><b>${esc(d.n)}</b><small>${esc(d.s)}${paginasTxt(d.paginas)} · ${esc(cuandoKB(d.f))}</small></span>${d.estado && d.estado !== 'Listo' ? `<span class="kb-st pr">${esc(d.estado)}</span>` : '<span class="kb-st ok">Listo</span>'}
          <div class="dd dsel kb-menu" style="position:relative"><button type="button" class="btn ic" data-dsel-open="1" aria-label="Más opciones de ${esc(d.n)}">${I('more')}</button><div class="menu" hidden><button type="button" data-kb-doc="bajar|${d.i}">${I('share')}Descargar</button><button type="button" data-kb-doc="texto|${d.i}">${I('file')}Ver y corregir el texto</button><button type="button" data-kb-doc="nombre|${d.i}">${I('pen')}Cambiar nombre</button><button type="button" data-kb-doc="quitar|${d.i}">${I('x')}Quitar</button></div></div></div>`).join('')
        : subiendo.length ? '' : `<p class="muted" style="margin:0">Ningún documento coincide con «${esc(st.kbQ.trim())}».</p>`}
      <div class="kb-drop fino" id="kb-drop"><p>Arrastra archivos aquí para subirlos</p></div>`
      : `<div class="kb-drop" id="kb-drop">${I('file')}<b>Todavía no hay documentos</b><p>Arrástralos aquí o usa «Subir documentos». También puedes elegirlos de Archivos del CRM.</p></div>`}
      <input type="file" id="kb-file" accept=".pdf,.docx,.xlsx,.xls,.txt,.csv" multiple hidden></section>`;
  const sitios = `<section class="kb-sec" aria-label="Sitios web"><div class="hd"><span class="kb-ico">${I('web')}</span><b>Sitios web${kbCon(k.webs.length)}</b><button type="button" class="btn" data-kb-web="1" aria-label="Añadir sitio web">${I('plus')}Añadir</button></div>
      <p class="sub2">El agente lee el contenido público del sitio. Úsalo como complemento de los documentos y fragmentos.</p>
      ${k.webs.map((w, i) => { const ley = st.kbLeyendo.has(k.id + '|' + w.u); return `<div class="kb-row">${I('web', 'i lead')}<span class="tx"><b>${esc(w.u)}</b><small>${ley ? 'Leyendo el sitio…' : `${w.pag} ${w.pag === 1 ? 'página leída' : 'páginas leídas'} · ${esc(cuandoKB(w.f))}`}</small></span>${ley ? '<span class="kb-st pr">Leyendo</span>' : `<button type="button" class="btn ic" data-kb-webre="${i}" aria-label="Volver a leer ${esc(w.u)}" title="Volver a leer">${I('swap')}</button>`}<button type="button" class="btn ic" data-kb-webdel="${i}" aria-label="Quitar ${esc(w.u)}" ${ley ? 'disabled' : ''}>${I('x')}</button></div>`; }).join('')}
      ${websNuevas.map(u => `<div class="kb-row">${I('web', 'i lead')}<span class="tx"><b>${esc(u)}</b><small>Leyendo el sitio…</small></span><span class="kb-st pr">Leyendo</span></div>`).join('')}
      ${k.webs.length || websNuevas.length ? '' : `<div class="kb-nada">${I('web')}<div><b>Sin sitios web aún</b><span>Por ejemplo, la página de tu empresa o la de un producto.</span></div></div>`}</section>`;
  const fragmentos = `<section class="kb-sec" aria-label="Fragmentos"><div class="hd"><span class="kb-ico">${I('note')}</span><b>Fragmentos${kbCon(k.frag.length)}</b><button type="button" class="btn" data-kb-frag="nuevo" aria-label="Añadir fragmento">${I('plus')}Añadir</button></div>
      <p class="sub2">Textos cortos que el agente usa tal cual para responder siempre igual: qué incluye un producto, formas de pago, horarios.</p>
      ${k.frag.length ? k.frag.map((f, i) => `<div class="kb-row">${I('note', 'i lead')}<span class="tx"><b>${esc(f.t)}</b><small>${esc(f.x)}</small></span><button type="button" class="btn ic" data-kb-frag="${i}" aria-label="Editar ${esc(f.t)}">${I('pen')}</button><button type="button" class="btn ic" data-kb-fragdel="${i}" aria-label="Borrar ${esc(f.t)}">${I('x')}</button></div>`).join('')
        : `<div class="kb-nada">${I('note')}<div><b>Sin fragmentos aún</b><span>Por ejemplo, «Formas de pago» con los medios y las cuotas que aceptan.</span></div></div>`}</section>`;
  return `${documentos}<div class="kb-par">${sitios}${fragmentos}</div>`;
}

/* Resultados: cómo le va a cada agente, con las conversaciones que ya están en el CRM */
const DIAS_CORTOS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const FMT_HORA_CO = new Intl.DateTimeFormat('en-US', {timeZone:'America/Bogota', hour:'numeric', minute:'numeric', hourCycle:'h23', weekday:'short'});
// ¿Ese instante cae fuera del horario de atención del CRM (Ajustes, Horario de atención)?
function fueraDeHorario(ms){
  const p = Object.fromEntries(FMT_HORA_CO.formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  const wd = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(p.weekday), min = (+p.hour % 24) * 60 + +p.minute;
  const [y, m, d] = diaColombia(ms).split('-').map(Number);
  const H = CFG.horario || [], franja = H[(CFG.festivos && esFestivo(y, m, d)) ? 6 : (wd + 6) % 7];
  if (!franja || !franja[3]) return true;
  const aMin = s => { const x = String(s || '').match(/^(\d{1,2}):(\d{2})$/); return x ? +x[1] * 60 + +x[2] : null; };
  const de = aMin(franja[1]), a = aMin(franja[2]);
  return de == null || a == null ? false : min < de || min >= a;
}
const durTxt = ms => { const s = Math.max(0, Math.round(ms / 1000)); return s < 60 ? `${s} s` : s < 3600 ? `${Math.floor(s / 60)} min${s % 60 ? ' ' + (s % 60) + ' s' : ''}` : `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`; };
const pctTxt = (n, t) => t ? `${Math.round(n / t * 100)} %` : '—';
function panelHTML(){
  const ag = st.pcAg === 'todos' ? null : AGENTES.find(a => a.id === st.pcAg);
  const filtros = `<div class="pc-f">${ddSel('data-pc-per', ['Hoy', 'Últimos 7 días', 'Últimos 30 días'], st.pcPer)}${ddSel('data-pc-ag', [['todos', 'Todos los agentes'], ...AGENTES.map(a => [a.id, a.nombre])], st.pcAg)}</div>`;
  const nDias = st.pcPer === 'Hoy' ? 1 : st.pcPer === 'Últimos 30 días' ? 30 : 7, desde = inicioDiaColombia(nDias - 1);
  const convs = convsAgente(ag, desde);
  // Sin datos, solo el aviso: configurar, entrenar y el tono ya están dentro de cada agente.
  if (!convs.length) return `${filtros}<div class="pc-c"><div class="vacio">${I('chart')}<b>Aún no hay resultados</b><p>${!AGENTES.length ? 'Cuando crees un agente en Panel de control y empiece a atender, aquí vas a ver cómo le va.'
    : `Cuando ${ag ? esc(ag.nombre) : 'tus agentes'} ${ag ? 'atienda' : 'atiendan'} conversaciones en ${st.pcPer === 'Hoy' ? 'el día' : 'este período'}, aquí vas a ver cuántas, cuántas pasaron a un asesor y en cuánto tiempo.`}</p></div></div>`;
  const ia = c => (c.msgs || []).filter(m => m.ia && deAgente(m, ag) && tMsg(m) >= desde);
  const primera = c => Math.min(...ia(c).map(tMsg));
  const entrantes = c => (c.msgs || []).filter(m => m.in && tMsg(m) >= desde).map(m => norm(typeof m.in === 'string' ? m.in : m.in.cap || m.in.trans || ''));
  const pasadas = convs.filter(pasadaAsesor).length;
  const tiempos = convs.map(c => { const t0 = primera(c), r = (c.msgs || []).find(m => m.out && tMsg(m) > t0); return r ? tMsg(r) - t0 : null; }).filter(x => x != null).sort((a, b) => a - b);
  const mediana = tiempos.length ? tiempos[Math.floor((tiempos.length - 1) / 2)] : null;
  const sugs = convs.flatMap(c => (c.msgs || []).filter(m => m.sugT && tMsg(m) >= desde).map(m => [c, m]));
  const aceptadas = sugs.filter(([c, m]) => (c.msgs || []).some(x => x.ev === 'swap' && /la transfirió/.test(x.t || '') && (x.sugTDe ? x.sugTDe === m._id : tMsg(x) >= tMsg(m)))).length;
  const persona = convs.filter(c => entrantes(c).some(t => /\b(persona|humano|humana|asesora?)\b|alguien real/.test(t))).length;
  const robot = convs.filter(c => entrantes(c).some(t => /\b(robot|bot|maquina)\b|inteligencia artificial|eres una? ia\b/.test(t))).length;
  const fuera = convs.filter(c => fueraDeHorario(primera(c))).length;
  const conNombre = convs.filter(c => nombrePila(c)).length;
  // Barras: por día (7 días), por semana (30 días) o el total de hoy, según el primer mensaje del agente.
  const dias = nDias === 1 ? [['Hoy', convs.length]]
    : nDias === 7 ? Array.from({length:7}, (_, i) => { const ini = inicioDiaColombia(6 - i), fin = ini + 864e5; return [DIAS_CORTOS[new Date(ini).getUTCDay()], convs.filter(c => { const t = primera(c); return t >= ini && t < fin; }).length]; })
    : Array.from({length:4}, (_, i) => [`Sem. ${i + 1}`, convs.filter(c => Math.min(3, Math.floor((primera(c) - desde) / (30 * 864e5 / 4))) === i).length]);
  const max = Math.max(1, ...dias.map(d => d[1])), W = 520, H = 190, bw = Math.min(48, (W - 40) / dias.length - 14);
  const svg = `<svg viewBox="0 0 ${W} ${H + 30}" width="100%" role="img" aria-label="Conversaciones atendidas por período">
    ${[0, 0.5, 1].filter(t => t !== 0.5 || max >= 2).map(t => `<line x1="30" x2="${W}" y1="${H - t * (H - 20)}" y2="${H - t * (H - 20)}" stroke="#eef1f5"/><text x="24" y="${H - t * (H - 20) + 4}" font-size="10" text-anchor="end" fill="#9ca3af">${Math.round(max * t)}</text>`).join('')}
    ${dias.map(([d, v], i) => { const x = 40 + i * ((W - 40) / dias.length) + ((W - 40) / dias.length - bw) / 2, h = v / max * (H - 20); return `<rect x="${x}" y="${H - h}" width="${bw}" height="${h}" rx="4" fill="#0b0b10"><title>${d}: ${v} conversaciones</title></rect><text x="${x + bw / 2}" y="${H - h - 6}" font-size="11" text-anchor="middle" fill="#4b5563">${v}</text><text x="${x + bw / 2}" y="${H + 18}" font-size="11" text-anchor="middle" fill="#6b7280">${d}</text>`; }).join('')}</svg>`;
  const porEquipo = {}; convs.forEach(c => { const k = c.equipo || 'Sin equipo'; porEquipo[k] = (porEquipo[k] || 0) + 1; });
  const temas = Object.entries(porEquipo).sort((a, b) => b[1] - a[1]).map(([t, n]) => [t, Math.round(n / convs.length * 100)]);
  return `${filtros}<div class="pc-k">
      <div><span>Conversaciones atendidas</span><b>${convs.length.toLocaleString('es-CO')}</b><small>Por el agente, antes del asesor</small></div>
      <div><span>Pasadas a un asesor</span><b>${pctTxt(pasadas, convs.length)}</b><small>El resto no ha pasado a un asesor</small></div>
      <div><span>Tiempo hasta el asesor</span><b>${mediana == null ? '—' : durTxt(mediana)}</b><small>La mitad de las conversaciones</small></div>
      <div><span>Datos completos</span><b>${pctTxt(conNombre, convs.length)}</b><small>Con el nombre guardado</small></div></div>
    <div class="pc-k">
      <div><span>Sugerencias de transferir a soporte</span><b>${sugs.length}</b><small>${sugs.length ? `Ventas aceptó el ${pctTxt(aceptadas, sugs.length)}` : 'Ninguna en este período'}</small></div>
      <div><span>Pidieron hablar con una persona</span><b>${persona}</b><small>Lo escribieron en la conversación</small></div>
      <div><span>Preguntaron si es un robot</span><b>${robot}</b><small>Respondió que es la asistente virtual</small></div>
      <div><span>Fuera del horario de atención</span><b>${fuera}</b><small>Según el horario de atención del CRM</small></div></div>
    <div class="pc-g"><div class="pc-c"><h4>Conversaciones atendidas</h4>${svg}</div>
      <div class="pc-c"><h4>A qué equipo fueron</h4><div class="pc-t">${temas.map(([t, p]) => `<div class="r"><span>${esc(t)}<div class="b"><i style="width:${p}%"></i></div></span><span>${p} %</span></div>`).join('')}</div></div></div>`;
}

/* Eventos */
function kbDialogoFragmento(i){
  const k = KB.find(x => x.id === st.kbId), f = i === 'nuevo' ? {t:'', x:''} : k.frag[+i];
  abrirDialogo(`<h3>${i === 'nuevo' ? 'Añadir fragmento' : 'Editar fragmento'}</h3><div class="cx-f"><label>Título<input id="kbf-t" value="${esc(f.t)}" placeholder="Ej. Qué incluye el plan anual"></label><label>Contenido<textarea id="kbf-x" rows="6" style="border:1px solid var(--line);border-radius:9px;padding:8px 10px;font:inherit;font-size:13px" placeholder="Escribe la información tal como quieres que el agente la use.">${esc(f.x)}</textarea></label></div>
    <div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" data-kbf-guardar="${i}">${I('check')}Guardar</button></div>`);
}
// Subir un documento a la colección: el servidor lo guarda y saca su texto (POST /crm/kb/documento). Mientras, «Procesando…».
const kbRepintar = id => { if (st.pagina === 'agentes' && st.kbId === id) render(); };
function kbDialogoTexto(i){
  const k = KB.find(x => x.id === st.kbId), d = k && k.docs[+i]; if (!d) return;
  abrirDialogo(`<h3>Texto que lee el agente</h3><p class="muted" style="margin:0 0 10px;font-size:12.5px">De «${esc(d.n)}». Las tablas quedan una fila por línea. Corrige lo que haya salido mal o borra lo que el agente no debe usar.</p><div class="cx-f"><label>Texto<textarea id="kbt-x" rows="14" style="font-size:12.5px;line-height:1.5">${esc(d.texto || '')}</textarea></label></div>
    <div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cerrar</button><button type="button" class="btn pri" data-kbt-guardar="${i}">${I('check')}Guardar</button></div>`);
}
function kbProcesar(kbId, f, verTexto){
  const p = {kb:kbId, n:f.name, s:tamano(f.size)}; st.kbSubiendo.push(p);
  return crmSubir(f, '/crm/kb/documento')
    .then(r => {
      const k = KB.find(x => x.id === kbId); if (!k) { toast(`${f.name}: la base de conocimiento ya no está`); return; }
      const n = r.n || f.name;
      k.docs.push({n, s:tamano(f.size), f:new Date().toISOString(), url:r.url || '', texto:r.texto || '', paginas:r.paginas || 0, estado:'Listo'});
      crmGuardarYa('kb');
      if (verTexto && st.pagina === 'agentes' && st.kbId === kbId) setTimeout(() => kbDialogoTexto(k.docs.length - 1), 0);
      toast(r.recortado ? `${n} es muy largo: el agente solo lee los primeros 200.000 caracteres. Divídelo en varios documentos.` : `Documento listo: ${n}`);
    })
    .catch(err => toast(`${f.name}: no se pudo procesar. ${err.message}`))
    .finally(() => { st.kbSubiendo = st.kbSubiendo.filter(x => x !== p); kbRepintar(kbId); });
}
function kbSubir(files){
  const k = KB.find(x => x.id === st.kbId); if (!k) return;
  let n = 0;
  const uno = files.length === 1;
  for (const f of files) {
    if (!/\.(pdf|docx|xlsx|xls|txt|csv)$/i.test(f.name)) { toast(`${f.name}: solo se aceptan PDF, Word, Excel, TXT o CSV`); continue; }
    if (f.size > 20 * 1024 * 1024) { toast(`${f.name}: pasa de 20 MB`); continue; }
    kbProcesar(k.id, f, uno); n++;
  }
  if (n) { st.kbSel = new Set(); render(); }
}
// Leer un sitio web desde el servidor (POST /crm/kb/leer-web) y guardar su texto; sirve para añadirlo y para «Volver a leer».
function kbLeerWeb(kbId, u){
  const clave = kbId + '|' + u; if (st.kbLeyendo.has(clave)) return;
  st.kbLeyendo.add(clave); kbRepintar(kbId);
  crmApi('POST', '/crm/kb/leer-web', {url:'https://' + u})
    .then(r => {
      const k = KB.find(x => x.id === kbId); if (!k) return;
      const dat = {u, pag:(r && r.pag) || 0, f:new Date().toISOString(), texto:(r && r.texto) || '', titulo:(r && r.titulo) || ''};
      const w = k.webs.find(x => x.u === u); if (w) Object.assign(w, dat); else k.webs.push(dat);
      crmGuardarYa('kb');
      toast(r && r.recortado ? `Sitio leído, pero es muy largo: el agente solo lee los primeros 100.000 caracteres` : `Sitio leído: ${dat.pag} ${dat.pag === 1 ? 'página' : 'páginas'}`);
    })
    .catch(err => toast(`No se pudo leer ${u}: ${err.message}`))
    .finally(() => { st.kbLeyendo.delete(clave); kbRepintar(kbId); });
}
document.getElementById('page').addEventListener('click', e => {
  if (st.pagina !== 'agentes') return; const t = e.target;
  const sc = t.closest('[data-ag-sec]'); if (sc) { st.agSec = sc.dataset.agSec; st.kbId = null; render(); return; }
  if (t.closest('[data-kb-volver]')) { kbVolverAlAgente(); render(); return; }
  // editor del agente
  const ir = t.closest('[data-kb-ir]'); if (ir) { st.kbDesde = st.agId; st.agV = 'lista'; st.agSec = 'kb'; st.kbId = ir.dataset.kbIr; render(); return; }
  const a = AGENTES.find(x => x.id === st.agId);
  // En el editor del agente, su base de conocimiento se crea al agregarle lo primero.
  if (st.agV === 'editor' && a && t.closest('[data-kb-frag],[data-kb-web],[data-kb-subir],[data-kb-nube]')) st.kbId = kbAsegurar(a).id;
  const ds = t.closest('[data-kb-desc]'); if (ds && a) { a.kb = (a.kb || []).filter(x => x !== ds.dataset.kbDesc); render(); toast('Colección desconectada'); return; }
  if (t.closest('[data-kb-conectar]') && a) { const libres = KB.filter(k => !(a.kb || []).includes(k.id));
    abrirDialogo(`<h3>Conectar colección</h3><p>El agente aprende de todo lo que haya en las colecciones conectadas.</p><div class="cx-list">${libres.map(k => `<button type="button" class="cx-op" data-kbc="${k.id}"><span><b>${esc(k.n)}</b><small>${esc(kbDesc(k))} · usada en ${kbUsos(k)} agente${kbUsos(k) === 1 ? '' : 's'}</small></span></button>`).join('') || '<p class="muted">Ya están conectadas todas las colecciones.</p>'}
      <button type="button" class="cx-op" data-kbc="nueva"><span><b>Crear una colección nueva</b><small>Y subirle documentos y fragmentos</small></span></button></div><div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button></div>`); return; }
  // colección
  const k = KB.find(x => x.id === st.kbId); if (!k) {
    const pp = t.closest('[data-pc-per]'); if (pp) { st.pcPer = pp.dataset.pcPer; render(); }
    const pa = t.closest('[data-pc-ag]'); if (pa) { st.pcAg = pa.dataset.pcAg; render(); }
    return; }
  if (t.closest('[data-kb-renombrar]')) { abrirDialogo(`<h3>Editar colección</h3><div class="cx-f"><label>Nombre<input id="kbn-n" value="${esc(k.n)}"></label></div><div class="ft2"><button type="button" class="btn" data-kbn-borrar="1" style="margin-right:auto;color:var(--red-ink)">${I('x')}Borrar colección</button><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" data-kbn-guardar="1">${I('check')}Guardar</button></div>`); return; }
  const fr = t.closest('[data-kb-frag]'); if (fr) { kbDialogoFragmento(fr.dataset.kbFrag); return; }
  const fd = t.closest('[data-kb-fragdel]'); if (fd) { const [x] = k.frag.splice(+fd.dataset.kbFragdel, 1); render(); toast(`Fragmento borrado: ${x.t}`); return; }
  if (t.closest('[data-kb-web]')) { abrirDialogo(`<h3>Añadir sitio web</h3><div class="cx-f"><label>Dirección del sitio<input id="kbw-u" placeholder="Ej. tuempresa.com/productos"></label></div><p class="muted">El agente usa solo lo que se ve públicamente en el sitio. Si el sitio cambia, toca «Volver a leer».</p><div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" data-kbw-add="1">${I('plus')}Añadir</button></div>`); return; }
  const wr = t.closest('[data-kb-webre]'); if (wr) { const w = k.webs[+wr.dataset.kbWebre]; if (w) kbLeerWeb(k.id, w.u); return; }
  const wd = t.closest('[data-kb-webdel]'); if (wd && !wd.disabled) { const [x] = k.webs.splice(+wd.dataset.kbWebdel, 1); render(); toast(`Sitio quitado: ${x.u}`); return; }
  if (t.closest('[data-kb-subir]')) { document.getElementById('kb-file').click(); return; }
  if (t.closest('[data-kb-nube]')) { const L = MATERIAL.map((m, i) => [m, i]).filter(([m]) => m.url && (/\.(pdf|docx|xlsx|xls|txt|csv)$/i.test(m.n) || /pdf|text\/(plain|csv)|wordprocessingml|spreadsheetml|ms-excel/.test(m.mime || '')) && !k.docs.some(d => d.n === m.n));
    abrirDialogo(`<h3>Elegir de Archivos del CRM</h3><p>Documentos PDF, TXT o CSV del material del CRM (Ajustes, Archivos).</p><div class="cx-list">${L.map(([m, i]) => `<button type="button" class="cx-op" data-kbnube="${i}"><span><b>${esc(m.n)}</b><small>${esc(m.t)}</small></span></button>`).join('') || '<p class="muted">No hay documentos PDF, TXT o CSV en Archivos del CRM que no estén ya en esta colección.</p>'}</div><div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button></div>`); return; }
  const ck = t.closest('[data-kb-check]'); if (ck) { const i = +ck.dataset.kbCheck; st.kbSel.has(i) ? st.kbSel.delete(i) : st.kbSel.add(i); render(); return; }
  if (t.closest('[data-kb-quitarsel]')) { const n = st.kbSel.size; [...st.kbSel].sort((x, y) => y - x).forEach(i => k.docs.splice(i, 1)); st.kbSel = new Set(); render(); toast(`${n} documento${n === 1 ? '' : 's'} quitado${n === 1 ? '' : 's'}`); return; }
  const or = t.closest('[data-kb-orden]'); if (or) { st.kbOrden = or.dataset.kbOrden; render(); return; }
  const dc = t.closest('[data-kb-doc]'); if (dc) { const [acc, i] = dc.dataset.kbDoc.split('|'), d = k.docs[+i]; if (!d) return;
    if (acc === 'bajar') { if (d.url) window.open(d.url, '_blank', 'noopener'); else toast(`${d.n} no tiene archivo guardado para descargar`); }
    if (acc === 'texto') kbDialogoTexto(i);
    if (acc === 'quitar') { k.docs.splice(+i, 1); st.kbSel = new Set(); render(); toast(`Quitado: ${d.n}`); }
    if (acc === 'nombre') abrirDialogo(`<h3>Cambiar nombre</h3><div class="cx-f"><label>Nombre del documento<input id="kbd-n" value="${esc(d.n)}"></label></div><div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" data-kbd-guardar="${i}">${I('check')}Guardar</button></div>`);
    return; }
});
document.getElementById('page').addEventListener('change', e => { if (e.target.id === 'kb-file') { kbSubir([...e.target.files]); e.target.value = ''; } });
document.getElementById('page').addEventListener('input', e => { if (e.target.id !== 'kb-q') return; st.kbQ = e.target.value; const pos = e.target.selectionStart; render(); const x = document.getElementById('kb-q'); if (x) { x.focus(); x.setSelectionRange(pos, pos); } });
['dragover', 'dragleave', 'drop'].forEach(tipo => document.getElementById('page').addEventListener(tipo, e => {
  const sec = e.target.closest && e.target.closest('.kb-docs'); if (!sec) return;
  e.preventDefault(); const z = sec.querySelector('#kb-drop'); if (z) z.classList.toggle('sobre', tipo === 'dragover');
  if (tipo === 'drop') { const a = st.agV === 'editor' && AGENTES.find(x => x.id === st.agId); if (a) st.kbId = kbAsegurar(a).id; kbSubir([...e.dataTransfer.files]); }
}));
document.getElementById('ov-x').addEventListener('click', e => {
  if (st.pagina !== 'agentes') return; const t = e.target, k = KB.find(x => x.id === st.kbId), a = AGENTES.find(x => x.id === st.agId);
  if (t.closest('[data-kbn-crear]')) { const n = document.getElementById('kbn-n').value.trim(); if (!n) { toast('Escribe el nombre de la colección'); return; }
    const c = {id:'kb-' + Date.now(), n, frag:[], webs:[], docs:[]}; KB.push(c); st.kbDesde = st.kbConectarA || st.agId; if (st.kbConectarA) { const ag = AGENTES.find(x => x.id === st.kbConectarA); if (ag) (ag.kb = ag.kb || []).push(c.id); st.kbConectarA = null; }
    cerrarDialogo(); st.agV = 'lista'; st.agSec = 'kb'; st.kbId = c.id; render(); toast(`Colección creada: ${n}`); return; }
  const kc = t.closest('[data-kbc]'); if (kc && a) { if (kc.dataset.kbc === 'nueva') { st.kbConectarA = a.id; abrirDialogo(`<h3>Crear colección</h3><div class="cx-f"><label>Nombre de la colección<input id="kbn-n" placeholder="Ej. Precios y cuotas"></label></div><div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" data-kbn-crear="1">${I('check')}Crear y conectar</button></div>`); return; }
    (a.kb = a.kb || []).push(kc.dataset.kbc); cerrarDialogo(); render(); toast('Colección conectada'); return; }
  if (!k) return;
  const fg = t.closest('[data-kbf-guardar]'); if (fg) { const tt = document.getElementById('kbf-t').value.trim(), x = document.getElementById('kbf-x').value.trim(); if (!tt || !x) { toast('Escribe el título y el contenido'); return; }
    if (fg.dataset.kbfGuardar === 'nuevo') k.frag.push({t:tt, x}); else k.frag[+fg.dataset.kbfGuardar] = {t:tt, x}; cerrarDialogo(); render(); toast('Fragmento guardado'); return; }
  if (t.closest('[data-kbw-add]')) { let u = document.getElementById('kbw-u').value.trim().replace(/^https?:\/\//, '').replace(/\/$/, ''); if (!/^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(u)) { toast('Escribe una dirección válida, por ejemplo tuempresa.com'); return; }
    if (k.webs.some(w => w.u === u)) { toast('Ese sitio ya está en la base de conocimiento'); return; }
    cerrarDialogo(); kbLeerWeb(k.id, u); return; }
  // De Archivos del CRM: se descarga el archivo guardado y se procesa igual que uno subido desde el computador.
  const kn = t.closest('[data-kbnube]'); if (kn) { const m = MATERIAL[+kn.dataset.kbnube]; if (!m || !m.url) return; cerrarDialogo();
    const p = {kb:k.id, n:m.n, s:''}; st.kbSubiendo.push(p); render();
    fetch(m.url).then(r => { if (!r.ok) throw new Error(`no se pudo traer el archivo (${r.status})`); return r.blob(); })
      .then(b => { st.kbSubiendo = st.kbSubiendo.filter(x => x !== p); return kbProcesar(k.id, new File([b], m.n, {type:m.mime || b.type})); })
      .catch(err => { st.kbSubiendo = st.kbSubiendo.filter(x => x !== p); toast(`${m.n}: ${err.message}`); kbRepintar(k.id); });
    return; }
  const dt = t.closest('[data-kbt-guardar]'); if (dt) { const d = k.docs[+dt.dataset.kbtGuardar]; if (!d) return; d.texto = document.getElementById('kbt-x').value.trim(); crmGuardarYa('kb'); cerrarDialogo(); render(); toast(`Texto guardado: ${d.n}`); return; }
  const dg = t.closest('[data-kbd-guardar]'); if (dg) { const v = document.getElementById('kbd-n').value.trim(); if (!v) { toast('Escribe el nombre'); return; } k.docs[+dg.dataset.kbdGuardar].n = v; cerrarDialogo(); render(); toast('Nombre cambiado'); return; }
  if (t.closest('[data-kbn-guardar]')) { const v = document.getElementById('kbn-n').value.trim(); if (!v) { toast('Escribe el nombre'); return; } k.n = v; cerrarDialogo(); render(); toast('Colección guardada'); return; }
  if (t.closest('[data-kbn-borrar]')) { KB.splice(KB.indexOf(k), 1); AGENTES.forEach(x => x.kb = (x.kb || []).filter(id => id !== k.id)); kbVolverAlAgente(); cerrarDialogo(); render(); toast(`Colección borrada: ${k.n}`); }
});
