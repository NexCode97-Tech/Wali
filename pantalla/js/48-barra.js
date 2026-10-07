/* ── Barra lateral por equipo y fotos de perfil (maqueta aprobada «CRM · barra lateral por equipo y fotos de perfil», 29-sep):
   etapas y etiquetas agrupadas por equipo, «Mi perfil» con cambiar la foto, y fotos del equipo en el chat. ── */

/* 1 · Barra lateral: quien ve más de un equipo ve las etapas y las etiquetas agrupadas por equipo, con un encabezado
   que se pliega (cuadro con el color del equipo, nombre, cuántas tiene y flecha). Las etiquetas sin equipo van primero,
   en «Todos los equipos». Solo salen los equipos que tienen etapas o etiquetas. Quien ve un solo equipo sigue
   con la lista plana de nav() (10-nucleo.js). Lo plegado se recuerda en este navegador. */
const BARRA_PLEGADOS = (() => { try { return new Set(JSON.parse(localStorage.getItem('crm-barra-plegados') || '[]')); } catch { return new Set(); } })();
function barraGuardarPlegados(){ try { localStorage.setItem('crm-barra-plegados', JSON.stringify([...BARRA_PLEGADOS])); } catch { /* sin almacenamiento */ } }
const barraFlecha = abierto => `<svg class="bl-fl" viewBox="0 0 24 24" aria-hidden="true"><path d="${abierto ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'}"/></svg>`;
// Encabezado del grupo y, si está abierto, sus elementos con sangría.
function barraGrupo(clave, nombre, color, items, primero){
  const abierto = !BARRA_PLEGADOS.has(clave);
  return `<li class="bl-g${primero ? '' : ' mas'}"><button type="button" class="bl-gr" data-bl-grupo="${esc(clave)}" aria-expanded="${abierto}"><i style="background:${colorOk(color)}"></i>${esc(nombre)}<span class="n">${items.length}</span>${barraFlecha(abierto)}</button></li>${abierto ? items.join('') : ''}`;
}
// Un elemento filtra como en la lista plana (data-e / data-tg, 10-nucleo.js). Si el mismo nombre está en otro
// grupo, lleva el suyo (data-bl-*, con data-bl-eq vacío en «Todos los equipos») y lo maneja barraClic: el de
// un equipo filtra también por ese equipo; el de «Todos los equipos», sin equipo.
st.blEq = '';   // el filtro de equipo que puso la barra por un nombre repetido (no el que se eligió en Equipos)
const barraPusoEquipo = () => !!st.blEq && st.equipo === st.blEq;
function barraItem(tipo, n, col, eq, repetido){
  const a = tipo === 'etq' ? 'e' : 'tg', eqId = repetido && eq ? (EQUIPOS.find(x => x.n === eq) || {}).id || '' : '';
  const cur = st[tipo] === n && (!repetido || (eqId ? st.equipo === eqId : !barraPusoEquipo()));
  return `<li class="bl-sub"><button type="button" ${repetido ? `data-bl-${a}="${esc(n)}" data-bl-eq="${esc(eq)}"` : `data-${a}="${esc(n)}"`} aria-current="${cur}"><span class="dot" style="background:${colorOk(col)}"></span>${esc(n)}</button></li>`;
}
// Cuántos grupos tienen cada nombre.
const barraVeces = grupos => { const m = new Map(); for (const [, xs] of grupos) for (const e of xs) m.set(e[0], (m.get(e[0]) || 0) + 1); return m; };
function barraPorEquipo(){
  const eqs = equiposQueVeo();
  if (eqs.length < 2) return;
  // Etapas: un grupo por equipo, en el orden de los equipos.
  const gEt = eqs.map(eq => [eq, [...new Map(etapasDe(eq).map(e => [e[0], e])).values()]]).filter(([, xs]) => xs.length);
  const vEt = barraVeces(gEt);
  document.getElementById('etiquetas').innerHTML = gEt.map(([eq, xs], i) => barraGrupo('etapas:' + eq, eq, colorEquipo(eq), xs.map(e => barraItem('etq', e[0], e[1], eq, vEt.get(e[0]) > 1)), i === 0)).join('');
  // Etiquetas: primero las de todos (con las de equipos que ya no existen, como en Ajustes › Etiquetas), luego las de cada equipo.
  const todas = ETIQS.filter(e => !eqDeEtiq(e) || !EQUIPOS.some(x => x.n === eqDeEtiq(e)));
  const gTg = [['', todas], ...eqs.map(eq => [eq, ETIQS.filter(e => eqDeEtiq(e) === eq)])].filter(([, xs]) => xs.length);
  const vTg = barraVeces(gTg);
  document.getElementById('tags').innerHTML = gTg.map(([eq, xs], i) => barraGrupo('etiquetas:' + eq, eq || 'Todos los equipos', eq ? colorEquipo(eq) : '#9ca3af', xs.map(e => barraItem('tag', e[0], e[1], eq, vTg.get(e[0]) > 1)), i === 0)).join('');
}
function barraClic(e){
  const g = e.target.closest('[data-bl-grupo]');
  if (g) {
    const k = g.dataset.blGrupo; if (BARRA_PLEGADOS.has(k)) BARRA_PLEGADOS.delete(k); else BARRA_PLEGADOS.add(k); barraGuardarPlegados(); nav();
    // nav() rehace la lista: con el teclado (Enter o Espacio, detail 0), el foco vuelve al mismo encabezado.
    if (e.detail === 0) { const otra = document.querySelector(`[data-bl-grupo="${CSS.escape(k)}"]`); if (otra) otra.focus(); }
    return;
  }
  const b = e.target.closest('[data-bl-e], [data-bl-tg]'); if (!b) return;
  const campo = b.dataset.blE != null ? 'etq' : 'tag', valor = campo === 'etq' ? b.dataset.blE : b.dataset.blTg;
  const eq = b.dataset.blEq ? EQUIPOS.find(x => x.n === b.dataset.blEq) : null, id = eq ? eq.id : '', puso = barraPusoEquipo();
  // Tocar otra vez el mismo (nombre y equipo) quita sus filtros, como cualquier elemento de la barra.
  if (st[campo] === valor && (id ? st.equipo === id : !puso)) { if (id) st.equipo = ''; st.blEq = ''; }
  else {
    // El equipo que había puesto otro nombre repetido se va; el de este, si es de un equipo, queda en su lugar.
    if (puso) st.equipo = '';
    st[campo] = ''; st.blEq = id; if (id) st.equipo = id;
  }
  filtrar(campo, valor);
}
document.getElementById('etiquetas').addEventListener('click', barraClic);
document.getElementById('tags').addEventListener('click', barraClic);
// Un elemento sin repetir no filtra por equipo: el equipo que había puesto un nombre repetido se quita antes de que
// filtre 10-nucleo.js (en la captura), así no queda escondiendo las conversaciones de los demás equipos.
function barraSoltarEquipo(e){
  if (!e.target.closest('[data-e], [data-tg]')) return;
  if (barraPusoEquipo()) st.equipo = '';
  st.blEq = '';
}
document.getElementById('etiquetas').addEventListener('click', barraSoltarEquipo, true);
document.getElementById('tags').addEventListener('click', barraSoltarEquipo, true);
// El equipo que la persona elige en Equipos es suyo: la barra ya no lo quita.
document.getElementById('equipos').addEventListener('click', () => { st.blEq = ''; }, true);
const navSinGrupos = nav;
// Fuera de Mi perfil se olvida lo que quedó escrito sin guardar (sección 2).
nav = function(){ navSinGrupos(); barraPorEquipo(); if (st.pagina !== 'ajustes' || st.ajSec !== 'perfil') st.pfBorrador = null; };

/* 2 · Mi perfil: la foto se cambia desde el CRM (JPG, PNG o WebP de hasta 5 MB, a Cloudinary por /upload/imagen) o
   se vuelve a la de Google. Los compañeros la ven sin recargar en el chat, la lista y Personas (evento `usuario-foto`,
   80-datos.js). «Usar la de Google» sale solo si hay foto de Google y no es la que está puesta. */
const PF = {google: undefined, pidiendo: false, subiendo: false};
const PF_SVG_SUBIR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/></svg>';
function perfilFotoHtml(){
  if (PF.google === undefined) pfCargarGoogle();
  const google = PF.google && PF.google !== AJ.foto, off = PF.subiendo ? ' disabled' : '';
  return `<div class="pf-foto"><span class="av pf-av" role="img" aria-label="Tu foto" style="background:${colorDeUsuario(CRM_YO.id, AJ.nombre)}">${fotoAv(AJ.foto, AJ.nombre)}</span>
    <div class="pf-tx"><b>Foto de perfil</b><span>La ven tus compañeros en el chat, en la lista de conversaciones y en Personas.</span>
    <div class="pf-bts"><button type="button" class="btn pri" data-pf-cambiar="1"${off}>${PF_SVG_SUBIR}${PF.subiendo === 'archivo' ? 'Subiendo…' : 'Cambiar foto'}</button>${google ? `<button type="button" class="btn lnk" data-pf-google="1"${off}>Usar la de Google</button>` : ''}<span class="pf-nota">JPG o PNG, hasta 5 MB</span></div></div></div>`;
}
// Solo se repinta el bloque de la foto. Lo escrito sin guardar en «Nombre completo» y «Cómo te ven los clientes»
// queda en st.pfBorrador y 10-nucleo.js lo vuelve a poner: el evento en vivo de la foto repinta la página entera.
function pfRepintar(){ const el = document.querySelector('#page .pf-foto'); if (el) el.outerHTML = perfilFotoHtml(); }
st.pfBorrador = null;
document.getElementById('page').addEventListener('input', e => {
  if (e.target.id !== 'aj-nombre' && e.target.id !== 'aj-corto') return;
  const n = document.getElementById('aj-nombre'), c = document.getElementById('aj-corto');
  st.pfBorrador = {nombre: n ? n.value : AJ.nombre, corto: c ? c.value : AJ.corto};
});
function pfCargarGoogle(){
  if (PF.pidiendo) return;
  if (!CRM_YO.id) { PF.google = null; return; }
  PF.pidiendo = true;
  crmApi('GET', `/auth/usuarios/${encodeURIComponent(CRM_YO.id)}/foto-google`)
    .then(r => { PF.google = (r && typeof r.picture === 'string' && r.picture) || null; }, () => { PF.google = null; })
    .finally(() => { PF.pidiendo = false; pfRepintar(); });
}
// Una foto nueva (la mía, o la de alguien del equipo por el evento en vivo): USUARIOS la lleva al chat, la lista y
// Personas en el siguiente pintado; la mía, además, a la barra y a Mi perfil.
function fotoDePersona(userId, foto){
  if (!userId) return;
  const f = typeof foto === 'string' && foto ? foto : null;
  const u = USUARIOS.find(x => x.id === userId); if (u) u.foto = f;
  if (PERSONAS_EXTRA[userId]) PERSONAS_EXTRA[userId].foto = f;
  if (userId === CRM_YO.id) { AJ.foto = f; pintarYo(); pfRepintar(); }
}
async function pfSubir(file){
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { toast('Elige una foto JPG o PNG'); return; }
  if (file.size > 5 * 1024 * 1024) { toast('La foto pesa más de 5 MB. Elige una más liviana.'); return; }
  if (crmSoloLectura()) { toast(crmErrorSoloLectura().message); return; }
  PF.subiendo = 'archivo'; pfRepintar();
  try {
    const fd = new FormData(); fd.append('file', file, file.name || 'foto');
    const sub = await crmLeer(await crmFetch('POST', '/upload/imagen', undefined, fd));
    if (!sub || typeof sub.url !== 'string') throw new Error('No se pudo subir la foto. Intenta de nuevo.');
    const r = await crmApi('PATCH', `/auth/usuarios/${encodeURIComponent(CRM_YO.id)}/foto`, {image: sub.url});
    fotoDePersona(CRM_YO.id, (r && r.image) || sub.url);
    toast('Foto de perfil actualizada');
  } catch (err) { toast(err.message || 'No se pudo cambiar la foto'); }
  finally { PF.subiendo = false; pfRepintar(); }
}
async function pfUsarGoogle(){
  PF.subiendo = 'google'; pfRepintar();
  try {
    const r = await crmApi('POST', `/auth/usuarios/${encodeURIComponent(CRM_YO.id)}/foto-google`);
    fotoDePersona(CRM_YO.id, r && r.image);
    toast('Foto de perfil actualizada');
  } catch (err) { toast(err.message || 'No se pudo cambiar la foto'); }
  finally { PF.subiendo = false; pfRepintar(); }
}
// El selector de archivos vive fuera de #page: un repintado mientras está abierto no lo borra.
function pfElegir(){
  let i = document.getElementById('pf-archivo');
  if (!i) {
    i = document.createElement('input'); i.type = 'file'; i.id = 'pf-archivo'; i.accept = 'image/jpeg,image/png,image/webp'; i.hidden = true;
    i.addEventListener('change', () => { const f = i.files && i.files[0]; i.value = ''; pfSubir(f); });
    document.body.appendChild(i);
  }
  i.click();
}
document.getElementById('page').addEventListener('click', e => {
  const cambiar = e.target.closest('[data-pf-cambiar]'), google = e.target.closest('[data-pf-google]');
  if ((!cambiar && !google) || PF.subiendo) return;
  if (cambiar) pfElegir(); else pfUsarGoogle();
});

/* 3 · Fotos en el chat: «Asignada a X…» y «X la tomó al responder» llevan la foto de X (o sus iniciales), del mismo
   color que su avatar en los mensajes (chAvatarPersona, 50-agentes.js). El contacto sigue con iniciales: WhatsApp
   no entrega su foto. */
const CH_SIN_PERSONA = new Set(['un asesor', 'Alguien del equipo']);   // lo que dice el API cuando no sabe el nombre
function chQuienEvento(m){
  if (!m || m.ev !== 'swap' || typeof m.t !== 'string') return null;
  const t = m.t, pre = 'Asignada a ';
  // Primero las personas del CRM, el nombre más largo primero («Ana María Pérez» antes que «Ana María»).
  for (const u of USUARIOS.filter(x => x.nombre).sort((a, b) => b.nombre.length - a.nombre.length)) {
    if (t.startsWith(pre + u.nombre) && /^(?:$| )/.test(t.slice(pre.length + u.nombre.length))) return u.nombre;
    if (t === `${u.nombre} la tomó al responder`) return u.nombre;
  }
  const x = /^Asignada a (.+?)(?= por | · |$)/.exec(t) || /^(.+) la tomó al responder$/.exec(t);
  return x && !CH_SIN_PERSONA.has(x[1]) ? x[1] : null;
}
function chFotoEvento(m){
  const n = chQuienEvento(m); if (!n) return '';
  const u = USUARIOS.find(x => x.nombre === n);
  return `<span class="av ch-mini" aria-hidden="true" style="background:${colorPersona(n)}">${fotoAv(u && u.foto, n)}</span>`;
}

document.head.insertAdjacentHTML('beforeend', `<style>
.nav li button.bl-gr{height:30px;padding:0 10px;gap:8px;border-radius:8px;font-size:12.5px;font-weight:500;color:#4b5563}
.nav li button.bl-gr i{width:9px;height:9px;border-radius:50%;flex:none}
.nav li button.bl-gr .n{font-weight:400;color:#9ca3af}
.nav li button.bl-gr .bl-fl{width:14px;height:14px;flex:none;color:#9ca3af;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}
.nav ul:has(> li.bl-g){gap:0}
.nav li.bl-g.mas{margin-top:6px}
.nav li.bl-sub button{min-height:32px;padding:6px 10px 6px 28px;font-size:13.5px;border-radius:9px}
.nav li.bl-sub button:not([aria-current="true"]){color:#1f2937}
.nav li.bl-sub .dot{width:8px;height:8px}
.pf-foto{display:flex;align-items:center;gap:18px;padding-bottom:18px;border-bottom:1px solid #eef1f5}
.pf-foto .pf-av{width:76px;height:76px;font-size:26px;overflow:hidden}
.pf-tx{display:flex;flex-direction:column;gap:8px;min-width:0}
.pf-tx > b{font-size:14px;font-weight:600;color:var(--ink)}
.pf-tx > span{font-size:13px;color:#4b5563}
.pf-bts{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.pf-nota{font-size:12px;color:#6b7280}
.ajw:has(.pf-foto) > .volver{font-size:14px;gap:4px;margin-bottom:16px}
.ajw:has(.pf-foto) > h2{font-size:21px;margin:0 0 6px}
.ajw:has(.pf-foto) > .sub{font-size:14px;color:#4b5563;margin:0 0 22px}
.box2:has(> .acb > .pf-foto){max-width:912px!important;border-radius:14px;padding:22px}
.box2 > .acb:has(> .pf-foto){padding:0!important;gap:18px}
.acb:has(> .pf-foto) .two2{gap:16px}
.acb:has(> .pf-foto) .fl{gap:6px;font-size:13px;font-weight:600;color:#374151}
.acb:has(> .pf-foto) > .fl{gap:4px}
.acb:has(> .pf-foto) input{height:42px;border-radius:10px;padding:0 12px;font-size:14px}
.acb:has(> .pf-foto) .hint{font-size:13px}
.acb:has(> .pf-foto) .ft2{margin-top:0}
.acb:has(> .pf-foto) .btn{height:38px;padding:0 14px;border-radius:10px;font-size:13.5px;gap:6px;color:#1f2937}
.acb:has(> .pf-foto) .btn.pri{color:#fff}
.acb:has(> .pf-foto) .btn.lnk{border-color:transparent;color:#1976d2;padding:0 8px}
.acb:has(> .pf-foto) .btn:disabled{opacity:.6;cursor:default}
.acb:has(> .pf-foto) .btn svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}
.ch-mini{width:18px;height:18px;font-size:8px;flex:none;overflow:hidden}
</style>`);
