
/* ── Ajustes estilo respond.io (25-sep): catálogo de canales, llamadas, conversaciones y archivos ── */
document.head.insertAdjacentHTML('beforeend', `<style>
.cn-bar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;border-bottom:1px solid var(--line);margin:4px 0 18px}
.cn-tabs{display:flex;gap:4px;flex-wrap:wrap}
.cn-tabs button{padding:10px 12px;font-size:13.5px;font-weight:500;color:var(--ink3);border-bottom:2px solid transparent;margin-bottom:-1px}
.cn-tabs button[aria-selected="true"]{color:var(--blue-ink);border-bottom-color:var(--blue)}
.cn-q{display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:10px;padding:0 10px;height:36px;min-width:240px;margin-bottom:8px;background:#fff}
.cn-q svg{width:16px;height:16px;color:var(--ink4)}
.cn-q input{border:0;outline:none;font:inherit;font-size:13px;flex:1;min-width:0}
.cn-sec{margin-bottom:22px}
.cn-sec > h3{font-size:13px;font-weight:600;color:var(--ink2);margin:0 0 10px}
.cn-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
.cc{position:relative;border:1px solid var(--line);border-radius:12px;background:linear-gradient(135deg,#fff 55%,var(--tint));display:flex;flex-direction:column;min-height:170px}
.cc-b{position:absolute;top:-9px;left:10px;font-size:11px;font-weight:600;border-radius:6px;padding:1px 8px}
.cc-b.pop{background:var(--green-soft);color:var(--green-ink)}
.cc-b.beta{background:var(--blue-soft);color:var(--blue-ink)}
.cc-b.new{background:var(--amber-soft);color:var(--amber-ink)}
.cc-b.ok{background:var(--green-soft);color:var(--green-ink)}
.cc-h{display:flex;gap:12px;justify-content:space-between;padding:18px 16px 12px;flex:1}
.cc-h b{display:block;font-size:14.5px;font-weight:600;margin-bottom:4px}
.cc-h p{margin:0;font-size:12.5px;color:var(--ink3);line-height:1.5}
.cc-lg{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;flex:none;color:#fff}
.cc-lg svg{width:22px;height:22px}
.cc-lg.full{background:#fff}
.cc-lg.full svg{width:100%;height:100%}
.cc-lg.g{background:#fff;border:1px solid var(--line)}
.cc-f{display:flex;align-items:center;justify-content:space-between;gap:8px;border-top:1px solid var(--line2);padding:10px 12px 10px 16px}
.cc-f small{font-size:12px;color:var(--ink3)}
.cc-f .bts{display:flex;gap:6px;margin-left:auto}
.cc-f .btn{height:30px;font-size:12.5px}
.vacio{display:grid;justify-items:center;gap:8px;text-align:center;padding:60px 16px}
.vacio svg{width:44px;height:44px;color:var(--ink4)}
.vacio b{font-size:15px;font-weight:600}
.vacio p{margin:0;font-size:13px;color:var(--ink3)}
.cv-grid{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:18px;align-items:start}
@media (max-width:1100px){.cv-grid{grid-template-columns:1fr}}
.cv-info{display:grid;gap:14px;font-size:12.5px;color:var(--ink2);line-height:1.5}
.cv-info div{display:flex;gap:10px}
.cv-info svg{width:18px;height:18px;color:var(--blue);flex:none;margin-top:1px}
.cv-inl{display:flex;align-items:center;gap:8px}
.cv-inl input{width:70px;border:1px solid var(--line);border-radius:9px;padding:7px 10px;font:inherit;font-size:13px}
.cv-inl .dsel{min-width:120px!important}
.mt-chips{display:flex;flex-wrap:wrap;gap:6px}
.mt-chips span{display:inline-flex;align-items:center;gap:4px;font-size:12.5px;background:var(--bg3);border-radius:8px;padding:3px 6px 3px 10px}
.mt-chips button{color:var(--ink4);display:grid;place-items:center}
.mt-chips button svg{width:13px;height:13px}
.cv-av summary{cursor:pointer;font-size:13.5px;font-weight:600;color:var(--ink2);padding:6px 0}
.ar-tb{width:100%;border-collapse:collapse;font-size:13px}
.ar-tb th{text-align:left;font-weight:600;color:var(--ink2);font-size:12px;padding:8px 10px;border-bottom:1px solid var(--line)}
.ar-tb td{padding:10px;border-bottom:1px solid var(--line2);vertical-align:middle}
.ar-tb td.n{display:flex;align-items:center;gap:10px}
.ar-tb td.n svg{width:18px;height:18px;color:var(--blue-ink)}
.ar-tb .btn.ic{width:30px;height:30px;padding:0}
.ll-row{display:flex;align-items:center;gap:10px;border-top:1px solid var(--line2);padding-top:10px}
.ll-row:first-of-type{border-top:0;padding-top:0}
.ll-row > span{flex:1;min-width:0}
.ll-row small{display:block;font-size:12px;color:var(--ink3)}
</style>`);

/* Catálogo de canales. Cada uno se conecta desde aquí (45-canales.js), con el logo real de su marca; los que esperan
   su integración quedan con «Conectar» apagado y «Disponible pronto». */
const CN = {telegram:null, twilio:false, smtp:[]};
const lineasConLlamadas = () => LINEAS.filter(l => llamadasActivas(l.id)).length;
// Los buzones de correo conectados de cada proveedor (46-correo.js).
const buzonesDe = prov => CONEXIONES.filter(c => c.tipo === 'correo' && (c.correo || {}).proveedor === prov);
const CANALES_CAT = [
  {id:'wa', cat:'msg', t:'WhatsApp (API oficial de Meta)', d:'Conecta los números de WhatsApp Business de tu empresa por la API oficial de Meta. Se atiende, se envían difusiones y se puede llamar.', bg:'#25D366', tint:'#e9f9ef', ic:'wa', badge:['Popular', 'pop'], ok:() => LINEAS.length > 0, est:() => `${LINEAS.length} ${LINEAS.length === 1 ? 'línea conectada' : 'líneas conectadas'}`, admin:'cfg-lineas', con:'wa'},
  {id:'ig', cat:'msg', t:'Instagram', d:'Los mensajes directos de tu cuenta profesional de Instagram llegan a la bandeja como cualquier conversación.', bg:'radial-gradient(circle at 30% 107%,#fdf497 0%,#fdf497 5%,#fd5949 45%,#d6249f 60%,#285AEB 90%)', tint:'#fdeef6', svg:LOGO.ig, badge:['Popular', 'pop'], ok:() => cxDe('ig').length > 0, est:() => cxDe('ig').map(x => x.nombre).join(' · '), admin:'cfg-instagram', con:'ig'},
  {id:'fb', cat:'msg', t:'Facebook Messenger', d:'Los mensajes de tu página de Facebook llegan a la bandeja.', bg:'radial-gradient(circle at 20% 100%,#0099FF,#A033FF 60%,#FF5280 90%,#FF7061)', tint:'#eaf2ff', svg:LOGO.msg, ok:() => cxDe('fb').length > 0, est:() => cxDe('fb').map(x => x.nombre).join(' · '), admin:'cfg-messenger', con:'fb'},
  {id:'tiktok', cat:'msg', t:'TikTok', d:'Los mensajes directos de tu cuenta de empresa de TikTok. Necesita una app de TikTok con acceso a mensajes.', bg:'#000', tint:'#f1f1f3', svg:LOGO.tt, badge:['Beta', 'beta'], ok:() => cxDe('tt').length > 0, est:() => cxDe('tt').map(x => x.nombre).join(' · '), admin:'cfg-tiktok', con:'tt'},
  {id:'telegram', cat:'msg', t:'Telegram', d:'Un bot de Telegram para atender también por ese canal. No cobra por mensaje.', bg:'#fff', full:true, tint:'#e8f5fc', svg:LOGO.tg, ok:() => cxDe('tg').length > 0, est:() => cxDe('tg').map(x => x.nombre).join(' · '), admin:'cfg-telegram', con:'tg'},
  {id:'llamadas', cat:'call', t:'Llamadas de WhatsApp', d:'Tus clientes llaman desde WhatsApp y tu equipo contesta y llama desde el navegador. Si el cliente llama, es gratis.', bg:'#25D366', tint:'#e9f9ef', ic:'phone', badge:['Nuevo', 'new'], ok:() => lineasConLlamadas() > 0, est:() => `Activas en ${lineasConLlamadas()} de ${LINEAS.length} líneas`, admin:'cfg-llamadas', con:'llamadas'},
  {id:'twilio', cat:'call', t:'Teléfono normal', d:'Llamadas a celulares y fijos con un número local, también para quien no tiene WhatsApp.', bg:'#fff', full:true, tint:'#fdecee', svg:LOGO.tw, por:'Por Twilio', ok:() => false, pronto:true},
  {id:'google', cat:'mail', t:'Gmail o Google Workspace', d:'Los correos de una bandeja de Gmail o Google Workspace entran como conversación y se responden desde la bandeja, en el mismo hilo.', G:true, tint:'#fff7e6', badge:['Popular', 'pop'], ok:() => buzonesDe('google').length > 0, est:() => buzonesDe('google').map(x => x.nombre).join(' · '), admin:'cfg-correo', con:'mail-google'},
  {id:'smtp', cat:'mail', t:'Otro correo', d:'Cualquier otra bandeja de correo por IMAP y SMTP: Zoho, Yahoo, el correo de tu hosting.', bg:'#60a5fa', tint:'#eef5ff', ic:'mail', ok:() => buzonesDe('otro').length > 0, est:() => buzonesDe('otro').map(x => x.nombre).join(' · '), admin:'cfg-correo', con:'mail-otro'},
  {id:'web', cat:'web', t:'Chat de la página web', d:'Una burbuja de chat para tu página web y tus landings. Lo que escriben llega a la bandeja.', bg:'#0b2a4a', tint:'#eef1f6', ic:'chat', ok:() => !!(CFG.web && CFG.web.on), est:() => 'Activo en las páginas donde se pegó el código', admin:'cfg-web', con:'web'},
];
const CATS_CN = [['todos', 'Todos'], ['msg', 'Mensajería'], ['call', 'Llamadas'], ['mail', 'Correo'], ['web', 'Chat de la web']];
st.cnTab = 'todos'; st.cnQ = '';
function tarjetaCanal(x){
  const ok = x.ok(), lg = x.G ? `<span class="cc-lg g">${LOGO.g}</span>` : `<span class="cc-lg${x.full ? ' full' : ''}" style="background:${x.bg}">${x.svg || I(x.ic)}</span>`;
  const bts = ok
    ? (x.admin ? `<button type="button" class="btn" data-cn-admin="${x.admin}">Administrar</button>` : `<button type="button" class="btn" data-cn-con="${x.con}">Administrar</button>`)
    : x.pronto ? `<button type="button" class="btn" disabled title="Disponible pronto" aria-label="Conectar ${esc(x.t)}: disponible pronto">Conectar</button>`
    : `<button type="button" class="btn" data-cn-con="${x.con}">Conectar</button>`;
  return `<div class="cc" style="--tint:${x.tint}">${ok ? '<span class="cc-b ok">Conectado</span>' : x.badge ? `<span class="cc-b ${x.badge[1]}">${x.badge[0]}</span>` : ''}
    <div class="cc-h"><div><b>${esc(x.t)}</b><p>${esc(x.d)}</p></div>${lg}</div>
    <div class="cc-f"><small>${esc((ok && x.est && x.est()) || x.por || '')}</small><div class="bts">${bts}</div></div></div>`;
}
function paginaCanales(){
  const volver = `<button type="button" class="volver" data-ir="ajustes-crm">${I('back')}Ajustes del CRM</button>`;
  const q = norm(st.cnQ.trim());
  const L = CANALES_CAT.filter(x => (st.cnTab === 'todos' || x.cat === st.cnTab) && (!q || norm(x.t + ' ' + x.d).includes(q)));
  const secs = CATS_CN.slice(1).map(([k, n]) => [n, L.filter(x => x.cat === k)]).filter(([, xs]) => xs.length);
  return `<div class="ajw ancho">${volver}<h2>Canales</h2><p class="sub">Conecta y administra los canales por donde te escriben y te llaman tus clientes.</p>
    <div class="cn-bar"><div class="cn-tabs" role="tablist">${CATS_CN.map(([k, n]) => `<button type="button" role="tab" aria-selected="${st.cnTab === k}" data-cn-tab="${k}">${n}</button>`).join('')}</div>
      <label class="cn-q">${I('search')}<input id="cn-q" value="${esc(st.cnQ)}" placeholder="Buscar canal" autocomplete="off" aria-label="Buscar canal"></label></div>
    ${secs.length ? secs.map(([n, xs]) => `<section class="cn-sec"><h3>${n}</h3><div class="cn-grid">${xs.map(tarjetaCanal).join('')}</div></section>`).join('') : `<p class="muted">Ningún canal coincide con «${esc(st.cnQ.trim())}».</p>`}</div>`;
}
function conectarCanal(k){
  if (k === 'wa') { abrirConexion('Ventas'); return; }
  if (['ig', 'fb', 'tg', 'tt'].includes(k)) { abrirConexionCanal(k); return; }
  if (k === 'llamadas') { st.volverCanales = true; st.pagina = 'cfg-lineas'; render(); return; }
  if (k === 'web') { st.volverCanales = true; st.pagina = 'cfg-web'; render(); return; }
}

/* Página «Llamadas» */
const LLCFG = {guardar:'1 año'};
function paginaLlamadas(){
  const volver = `<button type="button" class="volver" data-ir="ajustes-crm">${I('back')}Ajustes del CRM</button>`;
  const cab = `${volver}<h2>Llamadas</h2><p class="sub">Los canales de llamadas conectados, las grabaciones y el horario para llamar.</p>`;
  const lineas = LINEAS.filter(l => llamadasActivas(l.id));
  if (!lineas.length) return `<div class="ajw ancho">${cab}<div class="vacio">${I('phone')}<b>Ningún canal de llamadas conectado</b><p>Conecta las llamadas de WhatsApp o un teléfono normal desde Canales.</p><button type="button" class="btn" data-cn-irtab="call">Conectar</button></div></div>`;
  const llamadas = CONV.flatMap(c => (c.msgs || []).filter(m => m.call).map(m => ({c, m}))).sort((a, b) => String(b.m._t || '').localeCompare(String(a.m._t || ''))).slice(0, 5);
  return `<div class="ajw ancho">${cab}<div class="two3" style="align-items:start"><div class="cfg">
    <div class="box2"><h4>${I('phone')}Canales de llamadas</h4>
      ${lineas.map(l => `<div class="ll-row"><span><b>${esc(l.n)} · ${esc(l.tel)}</b><small>Llamadas de WhatsApp · contesta ${esc(LLAM.lineas[l.id].eq)}</small></span><span class="ok2">Activas</span><button type="button" class="btn" data-ir="cfg-lineas">Configurar</button></div>`).join('')}
      <div><button type="button" class="btn" data-cn-irtab="call">${I('plus')}Conectar otro canal</button></div></div>
    <div class="box2"><h4>${I('mic')}Grabaciones</h4>
      <label class="fld">Propósito de la grabación<textarea data-ll-in="proposito" rows="2" maxlength="250">${esc(LLAM.proposito)}</textarea><small class="muted" id="ll-prop-c">${LLAM.proposito.length}/250</small></label>
      <p class="muted" style="margin:0">Antes de grabar, WhatsApp dice en voz alta a las dos personas: «El audio de esta llamada se grabará con el siguiente propósito: ${esc(LLAM.proposito)}».</p>
      ${fila('Guardar las grabaciones durante', 'Meta las borra a los 7 días; el CRM guarda la copia', ddSel('data-ll-guardar', ['6 meses', '1 año', '2 años'], LLCFG.guardar))}
      ${fila('Solo con autorización de datos', 'Si es menor de edad, la da su representante legal. Sin autorización la llamada sigue, pero no se graba', `<button type="button" class="btn" data-ir="cfg-datos">Ver</button>`)}</div>
    </div><div class="cfg">
    <div class="box2"><h4>${I('clock')}Horario</h4>
      ${fila('Para recibir llamadas', 'El horario de atención del CRM', `<button type="button" class="btn" data-ir="cfg-horario">Cambiar</button>`)}
      ${fila('Para llamar a clientes', 'Lunes a viernes de 7 a. m. a 7 p. m. y sábados de 8 a. m. a 3 p. m. Lo fija la Ley 2300', `<span class="ll-ok">${I('lock')}Fijo por ley</span>`)}</div>
    <div class="box2"><h4>${I('moon')}Buzón de voz</h4><label class="fld">Saludo<textarea data-ll-in="saludo" rows="3">${esc(LLAM.saludo)}</textarea></label></div>
    <div class="box2"><h4>${I('play')}Últimas llamadas</h4>${llamadas.length ? llamadas.map(({c, m}) => fila(esc(c.n), `${m.call.dir === 'in' ? 'Entrante' : 'Saliente'} · ${m.call.estado === 'ok' ? mmss(m.call.dur || 0) : m.call.estado === 'buzon' ? 'buzón de voz' : 'sin contestar'}${m.h ? ' · ' + m.h : ''}`, m.call.audio ? '<span class="ll-ok">Grabada</span>' : '<span class="muted">Sin grabación</span>')).join('') : '<p class="muted" style="margin:0">Todavía no hay llamadas.</p>'}</div>
    </div></div></div>`;
}

/* Página «Conversaciones» */
const CVCFG = {auto:true, n:'3', u:'días', motivo:true, resumen:false, motivos:['Compró', 'Soporte atendido', 'Duda atendida', 'No le interesa', 'Ya es cliente', 'Número equivocado', 'No volvió a responder'], mismo:true, diasMismo:'30', sinAsesor:false};
function paginaConversaciones(){
  const volver = `<button type="button" class="volver" data-ir="ajustes-crm">${I('back')}Ajustes del CRM</button>`;
  const tg = (k, on, lab) => `<button type="button" class="tg" role="switch" data-cv-tg="${k}" aria-checked="${on}" aria-label="${lab}"></button>`;
  return `<div class="ajw ancho">${volver}<h2>Conversaciones</h2><p class="sub">Cómo se finalizan y se organizan las conversaciones.</p>
    <div class="cv-grid"><div class="cfg">
      <div class="box2">${fila('<b>Finalizar automáticamente las conversaciones</b>', 'Se finalizan solas después de un tiempo sin mensajes. Si el cliente vuelve a escribir, se reabre.', tg('auto', CVCFG.auto, 'Finalizar automáticamente'))}
        ${CVCFG.auto ? `<div class="cv-inl"><span class="muted">Finalizar después de</span><input data-cv-n="1" value="${esc(CVCFG.n)}" inputmode="numeric" aria-label="Cantidad">${ddSel('data-cv-u', ['horas', 'días'], CVCFG.u)}</div>` : ''}</div>
      <div class="box2">${fila('<b>Pedir el motivo al finalizar</b>', 'El asesor elige un motivo de la lista. Así Informes muestra por qué se cierra cada conversación.', tg('motivo', CVCFG.motivo, 'Pedir el motivo'))}
        <div class="fld">Motivos de finalización<div class="mt-chips">${CVCFG.motivos.map((m, i) => `<span>${esc(m)}<button type="button" data-cv-mdel="${i}" aria-label="Quitar ${esc(m)}">${I('x')}</button></span>`).join('')}</div></div>
        <div class="cv-inl"><input id="cv-mn" placeholder="Motivo nuevo, ej. Pidió que lo llamen" style="width:280px"><button type="button" class="btn" data-cv-madd="1">${I('plus')}Agregar</button></div></div>
      <div class="box2">${fila('<b>Resumen automático al finalizar</b>', 'Al finalizar, la IA deja en nota privada un resumen corto para quien la retome.', tg('resumen', CVCFG.resumen, 'Resumen automático'))}</div>
      <details class="cv-av"><summary>Configuración avanzada</summary><div class="box2">
        ${fila('Si vuelve a escribir, vuelve al mismo asesor', `Durante ${esc(CVCFG.diasMismo)} días después de finalizar`, tg('mismo', CVCFG.mismo, 'Vuelve al mismo asesor'))}
        ${fila('Finalizar también las que no tienen asesor', 'Por ejemplo, las que quedaron en el flujo sin responder', tg('sinAsesor', CVCFG.sinAsesor, 'Finalizar sin asesor'))}</div></details>
    </div>
    <div class="box2 cv-info">
      <div>${I('chat')}<span>Una conversación se abre cuando el cliente escribe o cuando el asesor le escribe.</span></div>
      <div>${I('check')}<span>Se finaliza cuando ya se atendió lo que necesitaba o cuando no hay más mensajes.</span></div>
      <div>${I('chart')}<span>Las conversaciones finalizadas y sus motivos alimentan los informes.</span></div></div></div></div>`;
}

/* Página «Archivos»: el material del equipo que usa el clip del chat («Enviar material»). Se sube al servidor (POST /crm/archivos). */
st.arQ = ''; st.arSubiendo = [];
const tamano = b => b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
// También audios: el menú Material del chat los muestra con su duración (maqueta «menús del chat», 29-sep).
const MATERIAL_OK = /^(application\/pdf|image\/|video\/|audio\/)/;
const icMaterial = mime => /^video\//.test(mime || '') ? 'play' : /^audio\//.test(mime || '') ? 'mic' : 'file';
const tipoMaterial = (mime, bytes) => { const k = /pdf/.test(mime || '') ? 'PDF' : /^image\//.test(mime || '') ? 'Imagen' : /^video\//.test(mime || '') ? 'Video' : /^audio\//.test(mime || '') ? 'Audio' : 'Archivo'; return bytes ? `${k} · ${tamano(bytes)}` : k; };
function subirMaterial(files){
  for (const f of files) {
    if (!MATERIAL_OK.test(f.type || '')) { toast(`${f.name}: solo se aceptan PDF, imágenes, videos o audios`); continue; }
    if (f.size > 25 * 1024 * 1024) { toast(`${f.name}: pasa de 25 MB`); continue; }
    const p = {n:f.name, t:tipoMaterial(f.type, f.size)}; st.arSubiendo.push(p);
    crmSubir(f)
      .then(r => { const mime = r.mime || f.type; MATERIAL.push({n:r.n || f.name, t:tipoMaterial(mime, r.bytes || f.size), ic:icMaterial(mime), url:r.url, mime}); toast(`Subido: ${r.n || f.name}`); })
      .catch(err => toast(`${f.name}: no se pudo subir. ${err.message}`))
      .finally(() => { st.arSubiendo = st.arSubiendo.filter(x => x !== p); if (st.pagina === 'cfg-archivos') render(); });
  }
  if (st.pagina === 'cfg-archivos') render();
}
function paginaArchivos(){
  const volver = `<button type="button" class="volver" data-ir="ajustes-crm">${I('back')}Ajustes del CRM</button>`;
  const q = norm(st.arQ.trim()), L = MATERIAL.map((m, i) => [m, i]).filter(([m]) => !q || norm(m.n).includes(q)), S = st.arSubiendo;
  return `<div class="ajw ancho">${volver}
    <div class="pg-h"><div><h2>Archivos</h2><p class="sub">Material para enviar en mensajes, difusiones y flujos. Lo que se sube aquí aparece en el clip del chat.</p></div><button type="button" class="btn pri" data-ar-add="1">${I('plus')}Añadir archivo</button></div>
    <input type="file" id="ar-file" accept="application/pdf,image/*,video/*,audio/*" multiple hidden>
    <div class="cfg"><div class="box2"><label class="cn-q" style="margin:0">${I('search')}<input id="ar-q" value="${esc(st.arQ)}" placeholder="Buscar archivos" autocomplete="off" aria-label="Buscar archivos"></label>
      ${L.length || S.length ? `<table class="ar-tb"><thead><tr><th>Archivo</th><th>Tipo</th><th></th></tr></thead><tbody>${S.map(p => `<tr><td class="n">${I('file')}${esc(p.n)}</td><td>${esc(p.t)}</td><td style="text-align:right"><span class="kb-st pr">Subiendo…</span></td></tr>`).join('')}${L.map(([m, i]) => `<tr><td class="n">${I(m.ic || 'file')}${esc(m.n)}</td><td>${esc(m.t)}</td><td style="text-align:right;white-space:nowrap"><button type="button" class="btn" data-ar-link="${i}">${I('link')}Copiar enlace</button> <button type="button" class="btn ic" data-ar-del="${i}" aria-label="Quitar ${esc(m.n)}">${I('x')}</button></td></tr>`).join('')}</tbody></table>`
        : q ? `<p class="muted">Ningún archivo coincide con «${esc(st.arQ.trim())}».</p>` : `<div class="vacio">${I('folder')}<b>Añade tu primer archivo</b><p>Lo que subas se puede enviar desde el chat y en las difusiones.</p></div>`}</div></div></div>`;
}

const paginaCfgAj = paginaCfg;
paginaCfg = function(k){ return k === 'canales' ? paginaCanales() : k === 'llamadas' ? paginaLlamadas() : k === 'conversaciones' ? paginaConversaciones() : k === 'archivos' ? paginaArchivos() : paginaCfgAj(k); };

document.getElementById('page').addEventListener('click', e => {
  const t = e.target, p = st.pagina;
  const irt = t.closest('[data-cn-irtab]'); if (irt) { st.cnTab = irt.dataset.cnIrtab; st.pagina = 'cfg-canales'; render(); return; }
  if (p === 'cfg-canales') {
    const tb = t.closest('[data-cn-tab]'); if (tb) { st.cnTab = tb.dataset.cnTab; render(); return; }
    const ad = t.closest('[data-cn-admin]'); if (ad) { st.volverCanales = true; st.pagina = ad.dataset.cnAdmin; render(); return; }
    const cn = t.closest('[data-cn-con]'); if (cn) { conectarCanal(cn.dataset.cnCon); return; }
  }
  if (p === 'cfg-llamadas') { const g = t.closest('[data-ll-guardar]'); if (g) { LLCFG.guardar = g.dataset.llGuardar; render(); toast(`Las grabaciones se guardan ${LLCFG.guardar}`); return; } }
  if (p === 'cfg-conversaciones') {
    const tg = t.closest('[data-cv-tg]'); if (tg) { CVCFG[tg.dataset.cvTg] = !CVCFG[tg.dataset.cvTg]; render(); toast(CVCFG[tg.dataset.cvTg] ? 'Activado' : 'Apagado'); return; }
    const u = t.closest('[data-cv-u]'); if (u) { CVCFG.u = u.dataset.cvU; render(); return; }
    const md = t.closest('[data-cv-mdel]'); if (md) { if (CVCFG.motivos.length <= 1) { toast('Deja al menos un motivo'); return; } const [x] = CVCFG.motivos.splice(+md.dataset.cvMdel, 1); render(); toast(`Motivo quitado: ${x}`); return; }
    if (t.closest('[data-cv-madd]')) { const v = document.getElementById('cv-mn').value.trim(); if (!v) { toast('Escribe el motivo'); return; } if (CVCFG.motivos.includes(v)) { toast('Ese motivo ya está'); return; } CVCFG.motivos.push(v); render(); toast(`Motivo agregado: ${v}`); return; }
  }
  if (p === 'cfg-archivos') {
    if (t.closest('[data-ar-add]')) { abrirDialogo(`<h3>Añadir archivo</h3><p>Sube un archivo desde el computador.</p><div class="cx-list"><button type="button" class="cx-op" data-ar-pc="1"><span><b>Subir desde el computador</b><small>PDF, imágenes, videos y audios de hasta 25 MB</small></span></button></div><div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button></div>`); return; }
    const l = t.closest('[data-ar-link]'); if (l) { const m = MATERIAL[+l.dataset.arLink];
      if (!m || !m.url) { toast('Este archivo no tiene enlace'); return; }
      (navigator.clipboard ? navigator.clipboard.writeText(m.url) : Promise.reject(new Error('sin portapapeles'))).then(() => toast(`Enlace copiado: ${m.n}`), () => toast('No se pudo copiar el enlace')); return; }
    const d = t.closest('[data-ar-del]'); if (d) { const [x] = MATERIAL.splice(+d.dataset.arDel, 1); render(); toast(`Quitado del material: ${x.n}`); return; }
  }
});
document.getElementById('ov-x').addEventListener('click', e => {
  if (e.target.closest('[data-ar-pc]')) { cerrarDialogo(); const f = document.getElementById('ar-file'); if (f) f.click(); }
});
document.getElementById('page').addEventListener('change', e => { if (e.target.id === 'ar-file') { subirMaterial([...e.target.files]); e.target.value = ''; } });
document.getElementById('page').addEventListener('input', e => {
  const id = e.target.id; if (id !== 'cn-q' && id !== 'ar-q' && !e.target.dataset.cvN) return;
  if (e.target.dataset.cvN) { CVCFG.n = e.target.value.replace(/\D/g, '').slice(0, 3); e.target.value = CVCFG.n; return; }
  const pos = e.target.selectionStart; if (id === 'cn-q') st.cnQ = e.target.value; else st.arQ = e.target.value;
  render(); const x = document.getElementById(id); if (x) { x.focus(); x.setSelectionRange(pos, pos); }
});

/* Volver a «Canales» cuando se entró desde el catálogo */
const renderAj = render;
render = function(){
  if (['ajustes', 'cfg-canales'].includes(st.pagina)) st.volverCanales = false;
  renderAj();
  if (st.volverCanales && ['cfg-lineas', 'cfg-instagram', 'cfg-messenger', 'cfg-telegram', 'cfg-tiktok', 'cfg-web', 'cfg-correo', 'cfg-llamadas'].includes(st.pagina)) {
    const v = document.querySelector('#page .volver[data-ir="ajustes-crm"]'); if (v) { v.dataset.ir = 'cfg-canales'; v.innerHTML = `${I('back')}Canales`; }
  }
};

/* Motivo obligatorio al finalizar una conversación */
function motivoSugerido(c){ return c.etq.includes('Pagado') ? 'Compró' : c.etq.includes('No interesado/perdido') ? 'No le interesa' : ''; }
function pintarMotivo(){
  const b = document.getElementById('res-b'); if (!b) return; const c = CONV.find(x => x.id === st.sel);
  const op = [...b.querySelectorAll('.opt')].find(o => /Motivo del cierre/.test(o.textContent)); if (!op) return;
  if (!CVCFG.motivo) { op.remove(); return; }
  op.outerHTML = `<div class="opt" id="res-mot"><div><b>Motivo</b><span>${st.resMot ? 'Sale en Informes.' : 'Obligatorio. Elige por qué se finaliza.'}</span></div>${ddSel('data-res-mot', CVCFG.motivos, st.resMot || '', 'Elige un motivo')}</div>`;
}
document.getElementById('cerrar').addEventListener('click', () => { const c = CONV.find(x => x.id === st.sel); st.resMot = c ? motivoSugerido(c) : ''; pintarMotivo(); });
document.getElementById('ov-res').addEventListener('click', e => {
  const m = e.target.closest('[data-res-mot]'); if (m) { e.stopPropagation(); st.resMot = m.dataset.resMot; document.getElementById('res-mot').outerHTML = '<div class="opt">Motivo del cierre</div>'; pintarMotivo(); return; }
  if (!e.target.closest('#res-ok')) return;
  if (CVCFG.motivo && !st.resMot) { e.stopPropagation(); toast('Elige el motivo antes de finalizar'); return; }
  const c = CONV.find(x => x.id === st.sel), mot = st.resMot; if (!c) return;
  if (mot) c.motivo = mot;
  // «Finalizada por X · Motivo: Y», como el tablero 4 de la maqueta de la encuesta (1-oct): sin el «· ahora» del evento local,
  // que 80-datos.js solo quita cuando va al final y, con el motivo detrás, quedaba guardado para siempre.
  setTimeout(() => { const ev = [...c.msgs].reverse().find(x => x.ev === 'check' && /^Finalizada por/.test(x.t)); if (ev && mot && !/Motivo/.test(ev.t)) { ev.t = ev.t.replace(/ · ahora$/, '') + ` · Motivo: ${mot}`; if (st.sel === c.id) chat(); } }, 0);
}, true);

/* Editar los equipos (Equipos y reparto): nombre e integrantes, que son personas reales del CRM (USUARIOS) */
const MIEMBROS = {'Ventas':[], 'Recuperación de ventas':[], 'Soporte de ventas':[], 'Soporte':[]};
// Los equipos creados en el CRM viven en MIEMBROS (clave `equipos`): se agregan a EQUIPOS al cargar y cuando otro líder los cambia.
function sincronizarEquipos(){
  let n = 0;
  Object.keys(MIEMBROS).forEach(nom => { if (!EQUIPOS.some(q => q.n === nom)) { EQUIPOS.push({id:'eq-' + norm(nom).replace(/[^a-z0-9]+/g, '-'), n:nom, f:c => c.equipo === nom}); n++; } });
  return n;
}
Promise.resolve().then(() => crmListo).then(() => {
  let cambio = sincronizarEquipos();
  // Si los equipos nunca se configuraron, Ventas arranca con todas las personas de rol VENDEDOR.
  if (st.rol === 'l' && !Object.values(MIEMBROS).some(v => v && v.length) && USUARIOS.some(u => u.rol === 'VENDEDOR')) { MIEMBROS['Ventas'] = USUARIOS.filter(u => u.rol === 'VENDEDOR').map(u => u.nombre); cambio++; }
  if (cambio) render();
}).catch(() => {});
document.addEventListener('crm:evento', e => { const d = e.detail || {}; if (d.tipo === 'ajuste' && d.clave === 'equipos') setTimeout(() => { if (sincronizarEquipos()) render(); }); });
/* ── Teléfono con país y bandera, igual que CampoTelefono de la plataforma (web/src/components/ui/CampoTelefono.tsx):
   la bandera es imagen de flagcdn (Windows no pinta banderas en emoji), el país se elige en un desplegable propio con
   buscador y el número se guarda completo, «+57 3001234567». Los números viejos sin «+» se leen como colombianos. ── */
const PAISES_TEL = ((window.CRM_INICIO && window.CRM_INICIO.paises) || [['CO', 'Colombia', '57']]).map(([iso, nombre, indicativo]) => ({iso, nombre, indicativo}));
const TEL_PAIS = {};
function partirTel(v){
  const t = String(v || '').trim(), co = PAISES_TEL[0];
  if (!t.startsWith('+')) return {pais:co, numero:t};
  const d = t.slice(1).replace(/\D/g, ''); let mejor = null;
  for (const p of PAISES_TEL) if (d.startsWith(p.indicativo) && (!mejor || p.indicativo.length > mejor.indicativo.length)) mejor = p;
  return mejor ? {pais:mejor, numero:d.slice(mejor.indicativo.length)} : {pais:co, numero:t.replace(/^\+/, '')};
}
const unirTel = (pais, numero) => { const n = String(numero || '').trim(); return n ? `+${pais.indicativo} ${n}` : ''; };
const banderaTel = iso => `<span class="tel-f" aria-hidden="true">${esc(iso)}<img src="https://flagcdn.com/w40/${esc(iso.toLowerCase())}.png" srcset="https://flagcdn.com/w80/${esc(iso.toLowerCase())}.png 2x" alt="" loading="lazy"></span>`;
/** El campo: `id` es el del input del número; el país elegido se recuerda aunque el diálogo se vuelva a pintar. */
function campoTel(id, valor, {deshabilitado = false, placeholder = '300 123 4567'} = {}){
  const partido = partirTel(valor), pais = PAISES_TEL.find(p => p.iso === TEL_PAIS[id]) || partido.pais; TEL_PAIS[id] = pais.iso;
  return `<div class="tel-c${deshabilitado ? ' off' : ''}"><div class="tel-p"><button type="button" class="tel-b" data-tel-abrir="${esc(id)}" aria-haspopup="listbox" aria-label="País del teléfono: ${esc(pais.nombre)}" ${deshabilitado ? 'disabled' : ''}>${banderaTel(pais.iso)}<span>+${esc(pais.indicativo)}</span>${I('chev')}</button>
    <div class="tel-m" data-tel-menu="${esc(id)}" hidden><div class="tel-q">${I('search')}<input data-tel-q="${esc(id)}" placeholder="Buscar país o indicativo" autocomplete="off" aria-label="Buscar país o indicativo"></div>
    <div class="tel-l" role="listbox">${PAISES_TEL.map(p => `<button type="button" role="option" aria-selected="${p.iso === pais.iso}" data-tel-pais="${esc(id)}|${esc(p.iso)}" data-q="${esc(norm(p.nombre + ' ' + p.indicativo))}">${banderaTel(p.iso)}<span class="n">${esc(p.nombre)}</span><span class="i">+${esc(p.indicativo)}</span>${p.iso === pais.iso ? I('check') : ''}</button>`).join('')}</div></div></div>
    <input id="${esc(id)}" inputmode="tel" value="${esc(valor && !String(valor).startsWith('+') ? String(valor).trim() : partido.numero)}" placeholder="${esc(placeholder)}" ${deshabilitado ? 'disabled' : ''} autocomplete="off"></div>`;
}
/** El número completo del campo, como se guarda. */
const valorTel = id => { const el = document.getElementById(id); return el ? unirTel(PAISES_TEL.find(p => p.iso === TEL_PAIS[id]) || PAISES_TEL[0], el.value) : ''; };
/** El valor guardado, en la misma forma que devuelve valorTel (para saber si cambió). */
const normalTel = v => { const x = partirTel(v); return unirTel(x.pais, x.numero); };
document.head.insertAdjacentHTML('beforeend', `<style>
.tel-c{display:flex;align-items:stretch;border:1px solid var(--line);border-radius:9px;background:#fff;height:40px}
.tel-c:focus-within{border-color:var(--blue);box-shadow:0 0 0 3px var(--blue-soft)}
.tel-c.off{background:var(--bg2)}
.tel-c > input{border:0!important;outline:none;flex:1;min-width:0;height:auto!important;align-self:stretch;padding:0 12px;font:inherit;font-size:13.5px;font-weight:400;color:var(--ink);background:transparent;box-shadow:none!important}
.tel-p{position:relative;display:flex}
.tel-b{display:flex;align-items:center;gap:6px;padding:0 10px;border:0;border-right:1px solid var(--line);background:none;font:inherit;font-size:13px;font-weight:400;color:var(--ink2);cursor:pointer;border-radius:9px 0 0 9px}
.tel-b:hover:not(:disabled){background:var(--bg2)}
.tel-b svg{width:12px;height:12px;opacity:.6}
.tel-f{position:relative;display:inline-grid;place-items:center;width:21px;height:15px;border-radius:3px;overflow:hidden;background:var(--bg3);font-size:9px;font-weight:600;color:var(--ink3);box-shadow:0 0 0 1px rgba(0,0,0,.08);flex:none}
.tel-f img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.tel-m{position:absolute;top:calc(100% + 6px);left:0;z-index:80;width:290px;background:#fff;border:1px solid var(--line);border-radius:10px;box-shadow:0 14px 30px -12px rgba(15,23,42,.3);overflow:hidden}
.tel-q{display:flex;flex-direction:row;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--line)}
.tel-q svg{width:14px;height:14px;color:var(--ink3)}
.tel-q input{border:0!important;outline:none;flex:1;min-width:0;width:auto!important;font:inherit;font-size:13px;padding:0!important;height:auto!important;box-shadow:none!important;background:transparent}
.tel-l{max-height:min(300px,45vh);overflow-y:auto;padding:4px}
.tel-l button{display:flex;align-items:center;gap:10px;width:100%;padding:7px 8px;border:0;border-radius:7px;background:none;font:inherit;font-size:13px;text-align:left;cursor:pointer;color:var(--ink)}
.tel-l button:hover,.tel-l button[aria-selected="true"]{background:var(--bg2)}
.tel-l .n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tel-l .i{font-size:12px;color:var(--ink3)}
.tel-l button svg{width:14px;height:14px;color:var(--blue)}
</style>`);
document.addEventListener('click', e => {
  const ab = e.target.closest('[data-tel-abrir]');
  const abiertos = [...document.querySelectorAll('.tel-m:not([hidden])')];
  if (ab) { const m = document.querySelector(`[data-tel-menu="${CSS.escape(ab.dataset.telAbrir)}"]`); const abrir = m && m.hidden; abiertos.forEach(x => { x.hidden = true; }); if (m && abrir) { m.hidden = false; const q = m.querySelector('[data-tel-q]'); if (q) { q.value = ''; m.querySelectorAll('[data-tel-pais]').forEach(b => { b.hidden = false; }); q.focus(); } const s2 = m.querySelector('[aria-selected="true"]'); if (s2) s2.scrollIntoView({block:'nearest'}); } return; }
  const op = e.target.closest('[data-tel-pais]');
  if (op) { const [id, iso] = op.dataset.telPais.split('|'); const p = PAISES_TEL.find(x => x.iso === iso); if (!p) return; TEL_PAIS[id] = iso;
    const b = document.querySelector(`[data-tel-abrir="${CSS.escape(id)}"]`); if (b) { b.innerHTML = `${banderaTel(p.iso)}<span>+${esc(p.indicativo)}</span>${I('chev')}`; b.setAttribute('aria-label', `País del teléfono: ${p.nombre}`); }
    const m = op.closest('.tel-m'); if (m) { m.hidden = true; m.querySelectorAll('[data-tel-pais]').forEach(x => { const sel = x === op; x.setAttribute('aria-selected', String(sel)); const c = x.querySelector('svg'); if (c && !sel) c.remove(); if (sel && !c) x.insertAdjacentHTML('beforeend', I('check')); }); }
    const inp = document.getElementById(id); if (inp) inp.focus(); return; }
  if (!e.target.closest('.tel-m')) abiertos.forEach(x => { x.hidden = true; });
}, true);
document.addEventListener('input', e => {
  const q = e.target.closest && e.target.closest('[data-tel-q]'); if (!q) return;
  const t = norm(q.value.trim().replace(/^\+/, ''));
  q.closest('.tel-m').querySelectorAll('[data-tel-pais]').forEach(b => { b.hidden = !!t && !b.dataset.q.includes(t); });
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.tel-m:not([hidden])').forEach(x => { x.hidden = true; }); });

/* ── Equipos y reparto ──
   Pestañas Equipos, Personas y Reglas del reparto, y el editor de cada equipo. Un equipo puede sumar a cualquier persona
   de la plataforma (GET /crm/personas): quien no es de Ventas entra al CRM solo para sus equipos (api alcance.ts).
   Lo que se guarda (ajuste `equipos`): miembros por nombre, ids, colores, metodos, transferibles y topes por persona. */
const EQ_CFG = {ids:{}, colores:{}, metodos:{}, transferibles:{}, topes:{}};
const ALCANCE = {on:false, equipos:[]};
const PERSONAS_EXTRA = {};
const ROL_NOMBRE = {ADMIN:'Administrador', LIDER_VENTAS:'Líder de ventas', VENDEDOR:'Asesor de ventas', MARKETING:'Marketing', EDITOR:'Editor de video', COMMUNITY:'Community manager', LIDER_EDICION:'Líder de edición', LIDER_CREADORES:'Líder de creadores', SOCIAL_MEDIA:'Social media', LIDER_DISENO:'Líder de diseño', DISENADOR:'Diseñador', AUDITOR:'Auditor', VISITANTE:'Visitante', COLABORADOR:'Colaborador'};
const METODOS_EQ = [['turnos', 'Por turnos', 'Una conversación para cada persona conectada del equipo, en orden.'], ['menos', 'A quien tenga menos conversaciones', 'Le llega a la persona conectada con menos conversaciones abiertas.'], ['todos', 'Todos ven y cualquiera la toma', 'La conversación les aparece a todas las personas del equipo. La primera que responde se la queda.'], ['lider', 'Solo un líder la asigna', 'Nadie la recibe sola: queda sin asignar hasta que un líder o administrador la entrega.']];
// Sin color elegido, cada equipo toma uno por su posición: Ventas azul, Soporte morado, Soporte de ventas cian, Recuperación naranja.
const COLORES_EQ = [['#1f93ff', 'Azul'], ['#7c3aed', 'Morado'], ['#0891b2', 'Cian'], ['#ea580c', 'Naranja'], ['#db2777', 'Rosado'], ['#0d9488', 'Verde azulado']];
document.head.insertAdjacentHTML('beforeend', `<style>
.rq-bar{display:flex;align-items:center;gap:10px;margin:0 0 14px;flex-wrap:wrap}
.rq-bar .cn-q{margin:0;width:340px;max-width:100%}
.rq-bar .sp{flex:1}
.rq-t{border:1px solid var(--line);border-radius:12px;overflow:hidden;background:#fff}
.rq-f{display:grid;gap:16px;align-items:center;padding:13px 18px;border-top:1px solid var(--line2)}
.rq-f.eqs{grid-template-columns:220px 240px minmax(0,1fr) 200px 80px}
.rq-f.pers{grid-template-columns:minmax(0,1fr) 160px 200px 220px 110px 40px}
.rq-f.hd{border-top:0;background:var(--bg2);padding-top:10px;padding-bottom:10px;font-size:12px;font-weight:600;color:var(--ink2)}
.rq-eq{display:flex;align-items:center;gap:10px;font-size:14px;min-width:0}
.rq-dot{width:10px;height:10px;border-radius:50%;flex:none}
.rq-d{font-size:13px;line-height:1.45;min-width:0}
.rq-sub{display:block;font-size:12px;color:var(--ink3)}
.rq-stack{display:flex;align-items:center}
.rq-stack .av{width:30px;height:30px;font-size:11px;border:2px solid #fff}
.rq-stack .av + .av{margin-left:-8px}
.rq-stack .av.mas{background:var(--bg3);color:var(--ink2);font-size:11px;font-weight:600}
.rq-warn{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:500;color:#9a3412;background:#fff7ed;border:1px solid #fed7aa;border-radius:999px;padding:3px 10px;white-space:nowrap}
.rq-warn svg{width:13px;height:13px}
.rq-lnk{color:var(--blue-ink);font-size:12.5px;font-weight:500;background:none;border:0;padding:0;cursor:pointer}
.rq-per{display:flex;align-items:center;gap:10px;font-size:13.5px;min-width:0}
.rq-per .av{width:32px;height:32px;font-size:11px;flex:none}
.rq-chip{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;border:1px solid var(--line);border-radius:999px;padding:3px 10px;background:#fff;margin:2px 4px 2px 0}
.rq-chip i{width:8px;height:8px;border-radius:50%;display:inline-block}
.rq-rol{font-size:11.5px;font-weight:500;color:var(--ink2);background:var(--bg3);border-radius:999px;padding:2px 9px;white-space:nowrap}
.rq-num{width:64px;height:32px;border:1px solid var(--line);border-radius:8px;padding:0 10px;font:inherit;font-size:13px}
.rq-ed{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:18px;align-items:start}
@media (max-width:1100px){.rq-ed{grid-template-columns:1fr}}
.rq-card{border:1px solid var(--line);border-radius:12px;background:#fff;padding:18px;display:grid;gap:12px;margin-bottom:18px}
.rq-card h4{margin:0;font-size:15px;font-weight:600;display:flex;align-items:center;gap:8px}
.rq-card h4 svg{width:18px;height:18px;color:var(--ink3)}
.rq-ayuda{margin:0;font-size:12.5px;color:var(--ink3);line-height:1.5}
.rq-m{display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--line2);border-radius:10px;background:var(--bg2)}
.rq-m .av{width:36px;height:36px;font-size:12px;flex:none}
.rq-m .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;font-size:13.5px}
.rq-m .tx small{font-size:12px;color:var(--ink3)}
.rq-m .btn.ic{width:32px;height:32px;padding:0}
.rq-res{border:1px solid var(--line);border-radius:10px;overflow:hidden;box-shadow:0 10px 24px -12px rgba(15,23,42,.25)}
.rq-op{display:flex;align-items:center;gap:12px;padding:10px 12px;border-top:1px solid var(--line2);background:#fff}
.rq-op:first-child{border-top:0}
.rq-op .av{width:32px;height:32px;font-size:11px;flex:none}
.rq-op .tx{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;font-size:13.5px}
.rq-op .tx small{font-size:12px;color:var(--ink3)}
.rq-sw{display:flex;gap:10px}
.rq-sw button{width:28px;height:28px;border-radius:8px;border:2px solid #fff;box-shadow:0 0 0 1px var(--line);cursor:pointer}
.rq-sw button[aria-pressed="true"]{box-shadow:0 0 0 2px var(--ink)}
.rq-chk{display:flex;align-items:flex-start;gap:10px;font-size:13px;line-height:1.45}
.rq-chk input{width:16px;height:16px;margin-top:2px;accent-color:var(--blue)}
.rq-in{height:38px;border:1px solid var(--line);border-radius:9px;padding:0 12px;font:inherit;font-size:13px;width:100%;box-sizing:border-box}
.rq-card .dsel{min-width:0!important;width:100%}
.rq-forma{display:grid;gap:4px;padding:12px 0;border-top:1px solid var(--line2)}
.rq-forma:first-of-type{border-top:0}
.rq-forma b{font-size:13.5px;font-weight:600}
.rq-forma p{margin:0;font-size:12.5px;color:var(--ink2);line-height:1.5}
.rq-forma small{font-size:12px;color:var(--ink3)}
.rq-top{display:flex;align-items:flex-end;gap:12px;margin-bottom:18px;flex-wrap:wrap}
.rq-top .t{flex:1;display:grid;gap:6px}
.rq-top h2{margin:0;display:flex;align-items:center;gap:10px}
.rq-top .volver{margin:0}
.pa-op{display:flex;align-items:center;gap:12px;text-align:left}
/* Los nombres de los equipos en los diálogos de personas: dato de lista, peso normal. */
.cx-op .eq-nom{font-weight:400;font-size:14px;color:var(--ink)}
.rq-m .per-n{font-weight:600;font-size:14px}
/* Los diálogos de personas, del ancho de la maqueta (600 px), con la tarjeta gris de la persona y 16 px entre bloques. */
.dlg.dlg-per{width:600px;max-width:calc(100vw - 32px);gap:16px}
.dlg.dlg-per .rq-m{border-radius:12px;margin:0}
.dlg.dlg-per .fld,.dlg.dlg-per .cx-f,.dlg.dlg-per p,.dlg.dlg-per .cx-list{margin:0}
/* Casillas de equipos como en la maqueta: fila blanca y un cuadro azul con chulo al marcar. */
.cx-op.eq-op,.cx-op.eq-op[aria-checked="true"]{background:#fff;border-color:var(--line);box-shadow:none;display:flex;align-items:center;gap:12px}
.eq-caja{width:18px;height:18px;border-radius:5px;border:2px solid #9ca3af;display:grid;place-items:center;flex:none;box-sizing:border-box}
.eq-caja svg{width:12px;height:12px;color:#fff;stroke-width:3;visibility:hidden}
.eq-op[aria-checked="true"] .eq-caja{background:var(--blue);border-color:var(--blue)}
.eq-op[aria-checked="true"] .eq-caja svg{visibility:visible}
.rq-m .av img,.rq-op .av img,.pa-op .av img,.rq-per .av img,.rq-stack .av img{width:100%;height:100%;border-radius:50%;object-fit:cover}
.pa-op .av{width:32px;height:32px;font-size:11px;flex:none}
</style>`);

st.repTab = 'equipos'; st.eqVer = null; st.eqDraft = null; st.eqBusca = null; st.perQ = ''; st.perEq = '';
const svgAviso = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>';
const hashN = t => [...String(t || '')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0);
// La persona por id: de las del CRM o de las que se agregaron desde la plataforma en esta sesión.
function personaDe(id){ const u = USUARIOS.find(x => x.id === id); if (u) return {id, nombre:u.nombre, rol:u.rol, foto:u.foto || null}; const x = PERSONAS_EXTRA[id]; return x ? {id, nombre:x.nombre, rol:x.rol, foto:x.foto || null} : null; }
// Avatar con la foto de perfil de la plataforma o, si no tiene, sus iniciales.
const avPer = p => `<span class="av" style="background:${colorDeUsuario(p.id, p.nombre)}">${fotoAv(p.foto, p.nombre)}</span>`;
// Los ids de un equipo: los guardados o, en ajustes viejos, los de sus nombres.
function idsDe(eq){ if (Array.isArray(EQ_CFG.ids[eq])) return EQ_CFG.ids[eq]; return (MIEMBROS[eq] || []).map(n => (USUARIOS.find(u => u.nombre === n) || {}).id).filter(Boolean); }
const metodoGeneral = () => /menos/i.test(CFG.reparto.metodo) ? 'menos' : /manual/i.test(CFG.reparto.metodo) ? 'lider' : 'turnos';
const metodoDe = eq => EQ_CFG.metodos[eq] || metodoGeneral();
const colorDe = (eq, i) => EQ_CFG.colores[eq] || COLORES_EQ[Math.max(0, i) % COLORES_EQ.length][0];
const porRol = rol => ['ADMIN', 'LIDER_VENTAS', 'VENDEDOR'].includes(rol);
const equiposDePersona = id => EQUIPOS.filter(e => idsDe(e.n).includes(id)).map(e => e.n);
function lineasDe(eq){ return CFG.lineas.filter(x => x.eq === eq).map(x => LINEAS.find(l => l.id === x.id)).filter(Boolean); }
function recibeHTML(eq){
  const ls = lineasDe(eq);
  const partes = ls.map(l => `${esc(l.n)} · ${esc(l.tel)}`);
  if (eq === 'Ventas' && !partes.length) partes.push('Las que llegan sin un equipo propio');
  if (EQ_CFG.transferibles[eq] !== false) partes.push('Las que le transfieren otros equipos');
  return partes.length ? partes.join('<br>') : '<span class="rq-sub">Ninguna todavía</span>';
}
const tabsRep = () => `<div class="cn-bar"><div class="cn-tabs" role="tablist" aria-label="Equipos y reparto">${[['equipos', 'Equipos', EQUIPOS.length], ['personas', 'Personas', personasCrm().length], ['reglas', 'Reglas del reparto', null]].map(([k, n, c]) => `<button type="button" role="tab" aria-selected="${st.repTab === k}" data-rep-tab="${k}">${n}${c != null ? `<span class="kb-n">${c}</span>` : ''}</button>`).join('')}</div></div>`;
// Las personas del CRM: las de USUARIOS más las que entran por un equipo y todavía no están en la lista de esta sesión.
function personasCrm(){
  const vistos = new Set(USUARIOS.map(u => u.id));
  const extra = [...new Set(EQUIPOS.flatMap(e => idsDe(e.n)))].filter(id => !vistos.has(id)).map(personaDe).filter(Boolean);
  return [...USUARIOS.map(u => ({id:u.id, nombre:u.nombre, rol:u.rol, foto:u.foto || null})), ...extra];
}

function paginaEquipos(){
  const volver = `<button type="button" class="volver" data-ir="ajustes-crm">${I('back')}Ajustes del CRM</button>`;
  if (st.eqVer !== null && st.eqDraft) return editorEquipo();
  const cab = `${volver}<h2>Equipos y reparto</h2><p class="sub">Quién atiende las conversaciones y cómo se reparten entre las personas de cada equipo.</p>`;
  if (st.repTab === 'personas') return `<div class="ajw ancho">${cab}${tabsRep()}${tabPersonas()}</div>`;
  if (st.repTab === 'reglas') return `<div class="ajw ancho">${cab}${tabsRep()}${tabReglas()}</div>`;
  const q = norm(st.repQ || '');
  const lista = EQUIPOS.map((e, i) => ({e, i})).filter(({e}) => !q || norm(e.n).includes(q) || idsDe(e.n).some(id => norm((personaDe(id) || {}).nombre || '').includes(q)));
  const filas = lista.map(({e, i}) => {
    const ids = idsDe(e.n), ps = ids.map(personaDe).filter(Boolean);
    const personas = ps.length ? `<span style="display:flex;align-items:center;gap:10px"><span class="rq-stack">${ps.slice(0, 5).map(avPer).join('')}${ps.length > 5 ? `<span class="av mas" title="${ps.length - 5} más">+${ps.length - 5}</span>` : ''}</span><span class="rq-d">${ps.length} ${ps.length === 1 ? 'persona' : 'personas'}</span></span>`
      : `<span style="display:flex;flex-direction:column;align-items:flex-start;gap:4px"><span class="rq-warn">${svgAviso}Nadie lo atiende</span><button type="button" class="rq-lnk" data-eq-abrir="${esc(e.n)}">Agregar personas</button></span>`;
    return `<div class="rq-f eqs"><span class="rq-eq"><span class="rq-dot" style="background:${colorOk(colorDe(e.n, i))}"></span>${esc(e.n)}</span>${personas}<span class="rq-d">${recibeHTML(e.n)}</span><span class="rq-d">${esc(METODOS_EQ.find(m => m[0] === metodoDe(e.n))[1])}</span><button type="button" class="btn" data-eq-abrir="${esc(e.n)}">Editar</button></div>`;
  }).join('');
  return `<div class="ajw ancho">${cab}${tabsRep()}
    <div class="rq-bar"><label class="cn-q">${I('search')}<input id="rep-q" value="${esc(st.repQ || '')}" placeholder="Buscar un equipo o una persona" autocomplete="off" aria-label="Buscar un equipo o una persona"></label><span class="sp"></span><button type="button" class="btn pri" data-eq-abrir="">${I('plus')}Crear equipo</button></div>
    <div class="rq-t"><div class="rq-f eqs hd"><span>Equipo</span><span>Personas</span><span>Qué conversaciones recibe</span><span>Cómo se reparte</span><span></span></div>${filas || '<p class="muted" style="margin:0;padding:16px 18px">Nada coincide con la búsqueda.</p>'}</div></div>`;
}

function tabPersonas(){
  const q = norm(st.perQ || ''), tope = CFG.reparto.tope;
  const lista = personasCrm().filter(p => (!q || norm(p.nombre).includes(q)) && (!st.perEq || equiposDePersona(p.id).includes(st.perEq)));
  const filas = lista.map(p => {
    const eqs = equiposDePersona(p.id), ci = n => EQUIPOS.findIndex(e => e.n === n);
    const via = porRol(p.rol) ? 'Por su rol' : eqs.length ? `Por el equipo ${eqs.join(' y ')}` : 'Sin equipo: no entra';
    return `<div class="rq-f pers"><span class="rq-per">${avPer(p)}${esc(p.nombre)}</span><span class="rq-d">${esc(ROL_NOMBRE[p.rol] || p.rol || '')}</span>
      <span>${eqs.length ? eqs.map(n => `<span class="rq-chip"><i style="background:${colorOk(colorDe(n, ci(n)))}"></i>${esc(n)}</span>`).join('') : '<span class="rq-sub">Ninguno</span>'}</span>
      <span class="rq-d" style="color:${porRol(p.rol) ? 'var(--ink2)' : '#0f766e'}">${esc(via)}</span>
      <input class="rq-num" data-per-tope="${esc(p.id)}" value="${esc(EQ_CFG.topes[p.id] || '')}" placeholder="${tope}" inputmode="numeric" aria-label="Máximo de conversaciones abiertas de ${esc(p.nombre)}">
      <button type="button" class="btn ic" data-per-eq="${esc(p.id)}" aria-label="Editar a ${esc(p.nombre)}" title="Editar">${I('pen')}</button></div>`;
  }).join('');
  return `<div class="rq-bar"><label class="cn-q">${I('search')}<input id="per-q" value="${esc(st.perQ || '')}" placeholder="Buscar una persona" autocomplete="off" aria-label="Buscar una persona"></label>
      ${ddSel('data-per-filtro', [['', 'Todos los equipos'], ...EQUIPOS.map(e => [e.n, e.n])], st.perEq)}<span class="sp"></span><button type="button" class="btn pri" data-per-agregar="1">${I('plus')}Agregar persona</button></div>
    <div class="rq-t"><div class="rq-f pers hd"><span>Persona</span><span>Rol en la plataforma</span><span>Equipos</span><span>Cómo entra al CRM</span><span>Máximo abiertas</span><span></span></div>${filas || '<p class="muted" style="margin:0;padding:16px 18px">Nadie coincide con la búsqueda.</p>'}</div>
    <p class="rq-ayuda" style="margin-top:10px">Sin un máximo propio, cada persona usa el general de ${tope} (Reglas del reparto).</p>`;
}

function tabReglas(){
  const r = CFG.reparto;
  const usan = k => { const n = EQUIPOS.filter(e => metodoDe(e.n) === k).map(e => e.n); return n.length ? `La ${n.length === 1 ? 'usa' : 'usan'}: ${n.join(', ').replace(/, ([^,]*)$/, ' y $1')}` : 'Ningún equipo la usa'; };
  return `<div class="two3"><div class="cfg">
      <div class="box2"><h4>${I('users')}Límites</h4>
        ${fila('Máximo de conversaciones abiertas por persona', 'Al llegar al máximo deja de recibir nuevas; las que ya tiene siguen con ella. Se puede cambiar por persona en la pestaña Personas.', `<input class="inl" data-cfg-in="reparto.tope" value="${r.tope}">`)}
        ${fila('Si no responde a tiempo, pasa a otra persona', 'Minutos que espera la conversación antes de pasar a la siguiente persona del mismo equipo.', `<span style="display:flex;align-items:center;gap:6px"><input class="inl" data-cfg-in="reparto.minutos" value="${r.minutos}">min</span>`)}</div>
      <div class="box2"><h4>${I('flow')}Excepciones</h4>
        ${fila('No asignar a quien está ausente', 'Si la persona marcó «Ausente» en su estado, el reparto la salta.', sw('rep-ausente', r.ausente))}
        ${fila('Familiares con la misma persona', 'Mamá, papá o hermanos van con quien ya atiende al cliente.', sw('rep-familiares', r.familiares))}
        ${fila('El cliente conocido vuelve con quien lo atendió', 'Si ya compró o ya habló con alguien, le llega a esa persona.', sw('rep-conocido', r.conocido))}</div></div>
    <div class="cfg"><div class="box2"><h4>${I('swap')}Formas de repartir</h4><p class="muted" style="margin:0">Cada equipo elige la suya al editarlo.</p>
      ${METODOS_EQ.map(([k, n, d]) => `<div class="rq-forma"><b>${n}</b><p>${d}</p><small>${esc(usan(k))}</small></div>`).join('')}</div></div></div>`;
}

/* Editor de un equipo: borrador en st.eqDraft hasta «Guardar cambios». */
function abrirEditorEquipo(nombre){
  const eq = nombre ? EQUIPOS.find(e => e.n === nombre) : null, i = eq ? EQUIPOS.indexOf(eq) : EQUIPOS.length;
  st.eqVer = eq ? eq.n : '';
  st.eqDraft = {orig:eq ? eq.n : '', n:eq ? eq.n : '', color:colorDe(eq ? eq.n : '', i), ids:eq ? [...idsDe(eq.n)] : [], lineas:eq ? lineasDe(eq.n).map(l => l.id) : [], transferible:eq ? EQ_CFG.transferibles[eq.n] !== false : true, metodo:eq ? metodoDe(eq.n) : metodoGeneral()};
  st.eqBusca = {q:'', res:[], cargando:false};
  render(); window.scrollTo && window.scrollTo(0, 0);
}
function editorEquipo(){
  const x = st.eqDraft, nuevo = !x.orig;
  const detalle = p => ['ADMIN', 'LIDER_VENTAS'].includes(p.rol) ? 'Ve todo el CRM por su rol' : p.rol === 'VENDEDOR' ? 'Entra al CRM por su rol de ventas' : 'Entra al CRM por este equipo y solo ve las conversaciones de sus equipos';
  const miembros = x.ids.map(personaDe).filter(Boolean);
  const B = st.eqBusca || {q:'', res:[]};
  const res = B.q.trim() ? (B.cargando && !B.res.length ? '<p class="muted" style="margin:0;padding:10px 12px">Buscando…</p>'
      : B.error ? `<p class="muted" style="margin:0;padding:10px 12px">${esc(B.error)}</p>`
      : B.res.length ? B.res.map(p => { const ya = x.ids.includes(p.id); return `<div class="rq-op">${avPer(p)}<span class="tx">${esc(p.nombre)}<small>${esc(p.cargo ? p.cargo + ', según el organigrama' : (p.enCrm ? 'Ya está en el CRM' : 'Todavía no entra al CRM'))}</small></span><span class="rq-rol">${esc(p.rolNombre || ROL_NOMBRE[p.rol] || p.rol)}</span><button type="button" class="btn" data-eq-add="${esc(p.id)}" ${ya ? 'disabled' : ''}>${ya ? 'Ya está' : `${I('plus')}Agregar`}</button></div>`; }).join('')
      : '<p class="muted" style="margin:0;padding:10px 12px">Nadie coincide. Los colaboradores no aparecen: no pueden entrar al CRM.</p>') : '';
  const ocupadas = id => { const l = CFG.lineas.find(y => y.id === id); return l && l.eq && l.eq !== x.orig ? l.eq : null; };
  const lineas = LINEAS.length ? LINEAS.map(l => { const otro = ocupadas(l.id); return `<label class="rq-chk"><input type="checkbox" data-eq-linea="${esc(l.id)}" ${x.lineas.includes(l.id) ? 'checked' : ''}><span>${esc(l.n)} · ${esc(l.tel)}${otro && !x.lineas.includes(l.id) ? `<small class="rq-sub">Hoy la atiende ${esc(otro)}</small>` : ''}</span></label>`; }).join('')
    : '<p class="rq-ayuda">Todavía no hay líneas de WhatsApp conectadas. Cuando conectes una, la eliges aquí.</p>';
  return `<div class="ajw ancho"><div class="rq-top"><div class="t"><button type="button" class="volver" data-eq-cerrar="1">${I('back')}Equipos y reparto</button><h2><span class="rq-dot" style="width:12px;height:12px;background:${colorOk(x.color)}"></span>${esc(x.n || 'Equipo nuevo')}</h2></div>
      <button type="button" class="btn" data-eq-cerrar="1">Cancelar</button><button type="button" class="btn pri" data-eq-guardar2="1">${I('check')}${nuevo ? 'Crear equipo' : 'Guardar cambios'}</button></div>
    <div class="rq-ed"><div><section class="rq-card" aria-label="Personas del equipo"><h4>${I('users')}Personas del equipo<span class="kb-n">${miembros.length}</span></h4>
        <p class="rq-ayuda">Puedes agregar a cualquier persona de la plataforma. Si no es de Ventas ni administradora, entra al CRM solo para atender las conversaciones de sus equipos.</p>
        ${miembros.map(p => `<div class="rq-m">${avPer(p)}<span class="tx">${esc(p.nombre)}<small>${esc(detalle(p))}</small></span><span class="rq-rol">${esc(ROL_NOMBRE[p.rol] || p.rol || '')}</span><button type="button" class="btn ic" data-eq-quitar="${esc(p.id)}" aria-label="Quitar a ${esc(p.nombre)} del equipo">${I('x')}</button></div>`).join('') || '<p class="muted" style="margin:0">Todavía nadie. Búscalas abajo.</p>'}
        <div style="display:grid;gap:8px;margin-top:6px"><span class="lab" style="font-size:12.5px;font-weight:600;color:var(--ink2)">Agregar persona</span>
          <label class="cn-q" style="margin:0">${I('search')}<input id="eq-busca" value="${esc(B.q)}" placeholder="Escribe un nombre o un correo" autocomplete="off" aria-label="Buscar una persona de la plataforma"></label>
          ${res ? `<div class="rq-res" id="eq-res">${res}</div>` : ''}</div></section>
      ${nuevo || x.orig === 'Ventas' ? '' : `<div><button type="button" class="btn" data-eq-borrar="1" style="color:#b91c1c;border-color:#fecaca">${I('trash')}Eliminar equipo</button></div>`}</div>
      <div><section class="rq-card" aria-label="Nombre y color"><h4>Nombre y color</h4><input class="rq-in" id="eq-nombre" value="${esc(x.n)}" placeholder="Ej. Moderación" aria-label="Nombre del equipo">
          <div class="rq-sw" role="group" aria-label="Color del equipo">${COLORES_EQ.map(([c, n]) => `<button type="button" style="background:${c}" data-eq-color="${c}" aria-pressed="${x.color === c}" aria-label="${n}"></button>`).join('')}</div></section>
        <section class="rq-card" aria-label="Qué conversaciones recibe"><h4>Qué conversaciones recibe</h4>${lineas}
          <label class="rq-chk"><input type="checkbox" data-eq-transf="1" ${x.transferible ? 'checked' : ''}><span>Las que le transfieren otros equipos</span></label></section>
        <section class="rq-card" aria-label="Cómo se reparte"><h4>Cómo se reparte</h4>${ddSel('data-eq-metodo', METODOS_EQ.map(([k, n]) => [k, n]), x.metodo)}<p class="rq-ayuda">${esc(METODOS_EQ.find(m => m[0] === x.metodo)[2])}</p></section></div></div></div>`;
}
let buscaT = null;
function buscarPersonas(q){
  const B = st.eqBusca || (st.eqBusca = {q:'', res:[]}); B.q = q; B.error = '';
  clearTimeout(buscaT);
  if (!q.trim()) { B.res = []; pintarBusca(); return; }
  B.cargando = true;
  buscaT = setTimeout(() => crmApi('GET', `/crm/personas?q=${encodeURIComponent(q.trim())}`)
    .then(l => { if (st.eqBusca !== B || B.q !== q) return; B.res = Array.isArray(l) ? l : []; for (const p of B.res) PERSONAS_EXTRA[p.id] = {nombre:p.nombre, rol:p.rol, foto:p.foto || null}; })
    .catch(err => { if (st.eqBusca === B) B.error = err.message || 'No se pudo buscar'; })
    .finally(() => { if (st.eqBusca === B) { B.cargando = false; pintarBusca(); } }), 250);
  pintarBusca();
}
// Repinta solo los resultados, para no perder el foco ni lo que se está escribiendo.
function pintarBusca(){
  if (st.pagina !== 'cfg-reparto' || st.eqVer === null) return;
  const inp = document.getElementById('eq-busca'), pos = inp ? inp.selectionStart : null;
  render();
  const n = document.getElementById('eq-busca'); if (n && pos !== null) { n.focus(); n.setSelectionRange(pos, pos); }
}
function guardarEquipo(){
  const x = st.eqDraft; x.n = (document.getElementById('eq-nombre') || {}).value !== undefined ? document.getElementById('eq-nombre').value.trim() : x.n.trim();
  const n = x.n;
  if (!n) { toast('Escribe el nombre del equipo'); return; }
  if (n !== x.orig && EQUIPOS.some(q => q.n === n)) { toast('Ya hay un equipo con ese nombre'); return; }
  const viejo = x.orig;
  if (!viejo) EQUIPOS.push({id:'eq-' + norm(n).replace(/[^a-z0-9]+/g, '-'), n, f:c => c.equipo === n});
  else if (n !== viejo) {
    const q = EQUIPOS.find(e => e.n === viejo); q.n = n; if (q.id !== 'ventas' && q.id !== 'recuperacion') q.f = c => c.equipo === n;
    CONV.forEach(c => { if (c.equipo === viejo) c.equipo = n; });
    CFG.lineas.forEach(l => { if (l.eq === viejo) l.eq = n; }); Object.values(LLAM.lineas).forEach(l => { if (l.eq === viejo) l.eq = n; });
    for (const k of ['ids', 'colores', 'metodos', 'transferibles']) if (viejo in EQ_CFG[k]) { EQ_CFG[k][n] = EQ_CFG[k][viejo]; delete EQ_CFG[k][viejo]; }
    const M = {}; for (const [k, v] of Object.entries(MIEMBROS)) M[k === viejo ? n : k] = v; for (const k of Object.keys(MIEMBROS)) delete MIEMBROS[k]; Object.assign(MIEMBROS, M);
  }
  EQ_CFG.ids[n] = [...x.ids];
  MIEMBROS[n] = x.ids.map(id => (personaDe(id) || {}).nombre).filter(Boolean);
  EQ_CFG.colores[n] = x.color; EQ_CFG.metodos[n] = x.metodo; EQ_CFG.transferibles[n] = x.transferible;
  // Las líneas marcadas pasan a este equipo; las que se desmarcaron vuelven a Ventas.
  CFG.lineas.forEach(l => { if (x.lineas.includes(l.id)) l.eq = n; else if (l.eq === n) l.eq = 'Ventas'; });
  st.eqVer = null; st.eqDraft = null; st.eqBusca = null; render();
  toast(viejo ? `Equipo guardado: ${n}` : `Equipo creado: ${n}`);
}
/* Editar a una persona (Personas): sus datos de la plataforma (nombre, correo y teléfono, con los permisos de
   PATCH /auth/usuarios/:id/perfil: el administrador edita a cualquiera, el líder de ventas solo a asesores) y sus equipos. */
function dlgPersona(){
  const D = st.peDlg, p = personaDe(D.id) || {nombre:'', rol:''};
  const d = D.datos, off = !d || !d.editable ? 'disabled' : '';
  const cuerpo = D.cargando ? '<p class="muted">Cargando sus datos…</p>' : D.error ? `<p class="muted">No se pudieron cargar sus datos: ${esc(D.error)}</p>` : `
    <div class="cx-f"><label>Nombre<input id="pe-n" value="${esc(d.nombre)}" ${off} autocomplete="off"></label>
      <label>Correo<input id="pe-c" type="email" value="${esc(d.email)}" ${off} autocomplete="off"><small class="muted">Es el correo con el que entra a la plataforma.</small></label>
      <div class="fld">Teléfono de contacto${campoTel('pe-t', d.telefono || '', {deshabilitado: !d.editable || !d.conTelefono, placeholder: d.conTelefono ? '300 123 4567' : 'No tiene ficha de asesor ni de marketing'})}</div></div>
    ${d.editable ? '' : '<p class="muted" style="margin:0">Solo un administrador puede cambiar los datos de esta persona.</p>'}`;
  const tope = D.tope !== undefined ? D.tope : (EQ_CFG.topes[D.id] || '');
  return `<h3>Editar a ${esc(p.nombre || (d && d.nombre) || 'esta persona')}</h3>
    <div class="rq-m">${avPer({...p, id:D.id})}<span class="tx"><b class="per-n">${esc(p.nombre || (d && d.nombre) || '')}</b><small>${esc(ROL_NOMBRE[p.rol] || p.rol || '')} · ${porRol(p.rol) ? 'entra al CRM por su rol' : 'entra al CRM por sus equipos'}</small></span></div>
    ${cuerpo}
    <div class="fld">Equipos<div class="cx-list">${EQUIPOS.map(e => `<button type="button" class="cx-op eq-op" role="checkbox" aria-checked="${(D.sel || []).includes(e.n)}" data-pe-eq="${esc(e.n)}"><span class="eq-caja">${I('check')}</span><span class="eq-nom">${esc(e.n)}</span></button>`).join('')}</div></div>
    <div class="cx-f"><label>Máximo de conversaciones abiertas<input id="pe-tope" inputmode="numeric" value="${esc(tope)}" placeholder="${CFG.reparto.tope}, el general" autocomplete="off"></label></div>
    <div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" data-pe-guardar="1" ${D.guardando ? 'disabled' : ''}>${I('check')}${D.guardando ? 'Guardando…' : 'Guardar'}</button></div>`;
}
function abrirPersona(id){
  const D = st.peDlg = {id, cargando:true, datos:null, sel:[...equiposDePersona(id)]}; delete TEL_PAIS['pe-t'];
  abrirDialogo(dlgPersona(), 'dlg-per');
  crmApi('GET', `/crm/personas/${encodeURIComponent(id)}`)
    .then(d => { if (st.peDlg === D) { D.datos = d; D.cargando = false; } })
    .catch(err => { if (st.peDlg === D) { D.error = err.message || 'el servidor no contestó'; D.cargando = false; } })
    .finally(() => { if (st.peDlg === D && !document.getElementById('ov-x').hidden) { const t = document.getElementById('pe-tope'); if (t) D.tope = t.value; abrirDialogo(dlgPersona(), 'dlg-per'); } });
}
// Cambio de nombre de otra persona: lo que esta pantalla muestra por nombre queda al día (las conversaciones, al recargar).
function renombrarPersona(id, viejo, nuevo){
  const u = USUARIOS.find(x => x.id === id); if (u) u.nombre = nuevo;
  if (PERSONAS_EXTRA[id]) PERSONAS_EXTRA[id].nombre = nuevo;
  for (const k of Object.keys(MIEMBROS)) MIEMBROS[k] = MIEMBROS[k].map(a => a === viejo ? nuevo : a);
  const i = ASESORES.indexOf(viejo); if (i >= 0) ASESORES[i] = nuevo;
}
async function guardarPersona(){
  const D = st.peDlg; if (!D || D.guardando) return;
  const d = D.datos, cambios = {};
  if (d && d.editable) {
    const n = document.getElementById('pe-n').value.trim(), c = document.getElementById('pe-c').value.trim().toLowerCase(), t = valorTel('pe-t');
    if (n.length < 2) { toast('Escribe el nombre completo'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(c)) { toast('Ese correo no parece completo'); return; }
    if (d.conTelefono && t && t.replace(/\D/g, '').length < 7) { toast('El teléfono está incompleto'); return; }
    if (n !== d.nombre) cambios.nombre = n;
    if (c !== String(d.email).toLowerCase()) cambios.email = c;
    if (d.conTelefono && t && t !== normalTel(d.telefono)) cambios.telefono = t;
  }
  if (Object.keys(cambios).length) {
    D.guardando = true; abrirDialogo(dlgPersona(), 'dlg-per');
    try { await crmApi('PATCH', `/auth/usuarios/${encodeURIComponent(D.id)}/perfil`, cambios); }
    catch (err) { D.guardando = false; abrirDialogo(dlgPersona(), 'dlg-per'); toast(err.message || 'No se pudieron guardar los datos'); return; }
    if (cambios.nombre) renombrarPersona(D.id, (personaDe(D.id) || {}).nombre || d.nombre, cambios.nombre);
  }
  const topeTxt = ((document.getElementById('pe-tope') || {}).value || '').trim(), topeAntes = EQ_CFG.topes[D.id] || '';
  if (topeTxt && !(Math.round(+topeTxt) >= 1 && Math.round(+topeTxt) <= 500)) { toast('El máximo va de 1 a 500'); return; }
  const topeCambio = String(topeTxt ? Math.round(+topeTxt) : '') !== String(topeAntes);
  if (topeCambio) { if (topeTxt) EQ_CFG.topes[D.id] = Math.round(+topeTxt); else delete EQ_CFG.topes[D.id]; }
  // Equipos: los marcados quedan con esta persona; los demás, sin ella.
  const antes = equiposDePersona(D.id).slice().sort().join('|'), ahora = (D.sel || []).slice().sort().join('|');
  if (antes !== ahora) for (const e2 of EQUIPOS) { const ids = idsDe(e2.n).filter(y => y !== D.id); if ((D.sel || []).includes(e2.n)) ids.push(D.id); EQ_CFG.ids[e2.n] = ids; MIEMBROS[e2.n] = ids.map(y => (personaDe(y) || {}).nombre).filter(Boolean); }
  st.peDlg = null; cerrarDialogo(); render();
  toast(Object.keys(cambios).length || topeCambio || antes !== ahora ? 'Cambios guardados' : 'Sin cambios');
}
/* Agregar persona (Personas): la lista de la plataforma aparece de una (GET /crm/personas); al elegir a alguien salen
   sus datos (los mismos permisos que al editar), sus equipos y su máximo de conversaciones. */
function dlgAgregarPersona(){
  const A = st.pa, p = A.sel, d = A.datos, f = A.form || {};
  const lista = A.cargando && !A.res.length ? '<p class="muted" style="margin:0;padding:12px">Cargando…</p>'
    : A.error ? `<p class="muted" style="margin:0;padding:12px">${esc(A.error)}</p>`
    : A.res.length ? A.res.map(x => `<button type="button" class="cx-op pa-op" data-pa-sel="${esc(x.id)}">${avPer(x)}<span style="flex:1;min-width:0"><b>${esc(x.nombre)}</b><small>${esc([x.rolNombre || ROL_NOMBRE[x.rol] || x.rol, x.cargo || x.email].filter(Boolean).join(' · '))}</small></span>${x.enCrm ? '<span class="rq-rol">Ya está en el CRM</span>' : ''}</button>`).join('')
    : '<p class="muted" style="margin:0;padding:12px">Nadie coincide. Los colaboradores no aparecen: no pueden entrar al CRM.</p>';
  const off = !d || !d.editable ? 'disabled' : '';
  const datos = !p ? '' : A.cargandoDatos ? '<p class="muted" style="margin:0">Cargando sus datos…</p>' : !d ? `<p class="muted" style="margin:0">${esc(A.errorDatos || 'No se pudieron cargar sus datos.')}</p>` : `
    <div class="cx-f"><label>Nombre<input id="pa-n" value="${esc(f.nombre ?? d.nombre)}" ${off} autocomplete="off"></label>
      <label>Correo<input id="pa-c" type="email" value="${esc(f.email ?? d.email)}" ${off} autocomplete="off"><small class="muted">Es el correo con el que entra a la plataforma.</small></label>
      <div class="fld">Teléfono de contacto${campoTel('pa-t', f.telefono ?? (d.telefono || ''), {deshabilitado: !d.editable || !d.conTelefono, placeholder: d.conTelefono ? '300 123 4567' : 'No tiene ficha de asesor ni de marketing'})}</div></div>
    ${d.editable ? '' : '<p class="muted" style="margin:0">Solo un administrador puede cambiar los datos de esta persona.</p>'}`;
  const puede = p && (A.eqs || []).length && !A.guardando;
  return `<h3>Agregar persona</h3><p>Elige a alguien de la plataforma, revisa sus datos y elige sus equipos. Si no es de Ventas ni administradora, entra al CRM solo para esos equipos.</p>
    ${!p ? `<label class="cn-q" style="margin:0">${I('search')}<input id="pa-q" value="${esc(A.q)}" placeholder="Buscar por nombre o correo" autocomplete="off" aria-label="Buscar una persona de la plataforma"></label>
      <div class="cx-list" style="max-height:320px;overflow-y:auto">${lista}</div>`
    : `<div class="rq-m">${avPer(p)}<span class="tx"><b class="per-n">${esc(p.nombre)}</b><small>${esc([p.rolNombre || ROL_NOMBRE[p.rol] || p.rol, p.cargo].filter(Boolean).join(' · '))}</small></span><button type="button" class="btn" data-pa-cambiar="1">Cambiar</button></div>
      ${datos}
      <div class="fld">Equipos<div class="cx-list">${EQUIPOS.map(e => `<button type="button" class="cx-op eq-op" role="checkbox" aria-checked="${(A.eqs || []).includes(e.n)}" data-pa-eq="${esc(e.n)}"><span class="eq-caja">${I('check')}</span><span class="eq-nom">${esc(e.n)}</span></button>`).join('')}</div></div>
      <div class="cx-f"><label>Máximo de conversaciones abiertas<input id="pa-tope" inputmode="numeric" value="${esc(f.tope ?? (EQ_CFG.topes[p.id] || ''))}" placeholder="${CFG.reparto.tope}, el general" autocomplete="off"></label></div>`}
    <div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" data-pa-guardar="1" ${puede ? '' : 'disabled'}>${I('plus')}${A.guardando ? 'Agregando…' : 'Agregar'}</button></div>`;
}
// Lo que se escribió en el formulario sobrevive a volver a pintar el diálogo.
function leerPa(){ const A = st.pa; if (!A || !A.sel) return; A.form = A.form || {}; for (const [k, id] of [['nombre', 'pa-n'], ['email', 'pa-c'], ['tope', 'pa-tope']]) { const el = document.getElementById(id); if (el) A.form[k] = el.value; } if (document.getElementById('pa-t')) A.form.telefono = valorTel('pa-t'); }
function pintarPa(){ if (!st.pa || document.getElementById('ov-x').hidden) return; leerPa(); const q = document.getElementById('pa-q'), pos = q ? q.selectionStart : null; abrirDialogo(dlgAgregarPersona(), 'dlg-per'); const n = document.getElementById('pa-q'); if (n && pos !== null) { n.focus(); n.setSelectionRange(pos, pos); } }
let paT = null;
function cargarPa(q){
  const A = st.pa; A.q = q; A.cargando = true; A.error = ''; clearTimeout(paT);
  paT = setTimeout(() => crmApi('GET', `/crm/personas?q=${encodeURIComponent(q.trim())}`)
    .then(l => { if (st.pa !== A || A.q !== q) return; A.res = Array.isArray(l) ? l : []; for (const x of A.res) PERSONAS_EXTRA[x.id] = {...(PERSONAS_EXTRA[x.id] || {}), nombre:x.nombre, rol:x.rol, foto:x.foto || null}; })
    .catch(err => { if (st.pa === A) A.error = err.message || 'No se pudo buscar'; })
    .finally(() => { if (st.pa === A && A.q === q) { A.cargando = false; pintarPa(); } }), q ? 250 : 0);
}
function elegirPa(id){
  const A = st.pa, p = A.res.find(x => x.id === id); if (!p) return;
  A.sel = p; A.datos = null; A.form = {}; A.cargandoDatos = true; A.errorDatos = ''; A.eqs = [...equiposDePersona(id)]; delete TEL_PAIS['pa-t'];
  pintarPa();
  crmApi('GET', `/crm/personas/${encodeURIComponent(id)}`)
    .then(d => { if (st.pa === A && A.sel === p) A.datos = d; })
    .catch(err => { if (st.pa === A) A.errorDatos = err.message; })
    .finally(() => { if (st.pa === A && A.sel === p) { A.cargandoDatos = false; pintarPa(); } });
}
async function guardarAgregar(){
  const A = st.pa; if (!A || !A.sel || A.guardando) return; leerPa();
  const p = A.sel, d = A.datos, f = A.form || {}, cambios = {};
  if (!(A.eqs || []).length) { toast('Elige al menos un equipo'); return; }
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
  if (Object.keys(cambios).length) {
    A.guardando = true; pintarPa();
    try { await crmApi('PATCH', `/auth/usuarios/${encodeURIComponent(p.id)}/perfil`, cambios); }
    catch (err) { A.guardando = false; pintarPa(); toast(err.message || 'No se pudieron guardar sus datos'); return; }
    if (cambios.nombre) { renombrarPersona(p.id, p.nombre, cambios.nombre); p.nombre = cambios.nombre; }
  }
  PERSONAS_EXTRA[p.id] = {...(PERSONAS_EXTRA[p.id] || {}), nombre:p.nombre, rol:p.rol, foto:p.foto || null};
  for (const e2 of EQUIPOS) { const ids = idsDe(e2.n).filter(y => y !== p.id); if (A.eqs.includes(e2.n)) ids.push(p.id); EQ_CFG.ids[e2.n] = ids; MIEMBROS[e2.n] = ids.map(y => (personaDe(y) || {}).nombre).filter(Boolean); }
  if (tope) EQ_CFG.topes[p.id] = Math.round(+tope);
  st.pa = null; cerrarDialogo(); render();
  toast(`${p.nombre} quedó en ${A.eqs.join(' y ')}`);
}

// La página de Ajustes «Equipos y reparto» la pinta este módulo.
const paginaCfgEquipos = paginaCfg;
paginaCfg = function(k){ return k === 'reparto' ? paginaEquipos() : paginaCfgEquipos(k); };
// Quien no ve todo el CRM (ALCANCE.on) ve en la sección Equipos de la barra solo los suyos. Lo demás de la barra según el
// rol en el equipo (integrante, líder o administrador sin equipo) lo decide 62-vistas-rol.js (lote 4, 29-sep).
const navSinAlcance = nav;
nav = function(){
  navSinAlcance();
  if (!ALCANCE.on) return;
  document.querySelectorAll('#equipos [data-t2]').forEach(b => { const e = EQUIPOS.find(x => x.id === b.dataset.t2); if (e && !ALCANCE.equipos.includes(e.n)) b.closest('li').remove(); });
};

document.getElementById('page').addEventListener('click', e => {
  if (st.pagina !== 'cfg-reparto') return; const t = e.target;
  const tb = t.closest('[data-rep-tab]'); if (tb) { st.repTab = tb.dataset.repTab; render(); return; }
  const ab = t.closest('[data-eq-abrir]'); if (ab) { abrirEditorEquipo(ab.dataset.eqAbrir); return; }
  if (t.closest('[data-eq-cerrar]')) { st.eqVer = null; st.eqDraft = null; st.eqBusca = null; render(); return; }
  const x = st.eqDraft;
  if (x) {
    const nm = document.getElementById('eq-nombre'); if (nm) x.n = nm.value;
    const ad = t.closest('[data-eq-add]'); if (ad) { if (!x.ids.includes(ad.dataset.eqAdd)) x.ids.push(ad.dataset.eqAdd); st.eqBusca = {q:'', res:[]}; render(); const p = personaDe(ad.dataset.eqAdd); toast(`${p ? p.nombre : 'La persona'} queda en el equipo al guardar`); return; }
    const qu = t.closest('[data-eq-quitar]'); if (qu) { x.ids = x.ids.filter(id => id !== qu.dataset.eqQuitar); render(); return; }
    const co = t.closest('[data-eq-color]'); if (co) { x.color = co.dataset.eqColor; render(); return; }
    const me = t.closest('[data-eq-metodo]'); if (me) { x.metodo = me.dataset.eqMetodo; render(); return; }
    if (t.closest('[data-eq-guardar2]')) { guardarEquipo(); return; }
    if (t.closest('[data-eq-borrar]')) { abrirDialogo(`<h3>Eliminar el equipo ${esc(x.orig)}</h3><p>Sus líneas y sus conversaciones pasan a Ventas. Quien entraba al CRM solo por este equipo deja de entrar.</p><div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" style="background:#dc2626;border-color:#dc2626" data-eq-borrar-ok="1">${I('trash')}Eliminar</button></div>`); return; }
  }
  const pf = t.closest('[data-per-filtro]'); if (pf) { st.perEq = pf.dataset.perFiltro; render(); return; }
  const pe = t.closest('[data-per-eq]'); if (pe) { abrirPersona(pe.dataset.perEq); return; }
  if (t.closest('[data-per-agregar]')) { st.pa = {q:'', res:[], cargando:true, sel:null, eqs:[]}; abrirDialogo(dlgAgregarPersona(), 'dlg-per'); cargarPa(''); setTimeout(() => { const i = document.getElementById('pa-q'); if (i) i.focus(); }, 30); return; }
});
document.getElementById('page').addEventListener('change', e => {
  if (st.pagina !== 'cfg-reparto') return; const t = e.target, x = st.eqDraft;
  if (x && t.dataset.eqLinea) { const id = t.dataset.eqLinea; x.lineas = t.checked ? [...new Set([...x.lineas, id])] : x.lineas.filter(y => y !== id); return; }
  if (x && t.dataset.eqTransf) { x.transferible = t.checked; return; }
  if (t.dataset.perTope) { const n = Math.round(+t.value); if (!t.value.trim()) delete EQ_CFG.topes[t.dataset.perTope]; else if (n >= 1 && n <= 500) EQ_CFG.topes[t.dataset.perTope] = n; else { toast('El máximo va de 1 a 500'); t.value = EQ_CFG.topes[t.dataset.perTope] || ''; return; } render(); toast('Máximo guardado'); }
});
document.getElementById('page').addEventListener('input', e => {
  if (st.pagina !== 'cfg-reparto') return; const t = e.target;
  if (t.id === 'eq-busca') { buscarPersonas(t.value); return; }
  if (t.id === 'eq-nombre' && st.eqDraft) { st.eqDraft.n = t.value; return; }
  const pos = t.selectionStart;
  if (t.id === 'rep-q') { st.repQ = t.value; render(); const n = document.getElementById('rep-q'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } return; }
  if (t.id === 'per-q') { st.perQ = t.value; render(); const n = document.getElementById('per-q'); if (n) { n.focus(); n.setSelectionRange(pos, pos); } return; }
});
document.getElementById('ov-x').addEventListener('input', e => {
  if (e.target.id === 'pa-q' && st.pa) cargarPa(e.target.value);
});
document.getElementById('ov-x').addEventListener('click', e => {
  const t = e.target;
  if (t.closest('[data-eq-borrar-ok]') && st.eqDraft) {
    const n = st.eqDraft.orig, i = EQUIPOS.findIndex(q => q.n === n); if (i >= 0) EQUIPOS.splice(i, 1);
    delete MIEMBROS[n]; for (const k of ['ids', 'colores', 'metodos', 'transferibles', 'cola', 'iconos']) if (EQ_CFG[k]) delete EQ_CFG[k][n];
    CFG.lineas.forEach(l => { if (l.eq === n) l.eq = 'Ventas'; });
    st.eqVer = null; st.eqDraft = null; cerrarDialogo(); render(); toast(`Equipo eliminado: ${n}`); return;
  }
  const pq = t.closest('[data-pe-eq]'); if (pq && st.peDlg) { const n = pq.dataset.peEq, l = st.peDlg.sel || []; st.peDlg.sel = l.includes(n) ? l.filter(y => y !== n) : [...l, n]; pq.setAttribute('aria-checked', String(st.peDlg.sel.includes(n))); return; }
  if (t.closest('[data-pe-guardar]') && st.peDlg) { guardarPersona(); return; }
  if (st.pa) {
    const ps = t.closest('[data-pa-sel]'); if (ps) { elegirPa(ps.dataset.paSel); return; }
    if (t.closest('[data-pa-cambiar]')) { st.pa.sel = null; st.pa.datos = null; st.pa.form = {}; pintarPa(); setTimeout(() => { const i = document.getElementById('pa-q'); if (i) i.focus(); }, 30); return; }
    const pa = t.closest('[data-pa-eq]'); if (pa) { const n = pa.dataset.paEq, l = st.pa.eqs || []; st.pa.eqs = l.includes(n) ? l.filter(y => y !== n) : [...l, n]; pa.setAttribute('aria-checked', String(st.pa.eqs.includes(n))); const b = document.querySelector('#ov-x [data-pa-guardar]'); if (b) b.disabled = !st.pa.eqs.length; return; }
    if (t.closest('[data-pa-guardar]')) { guardarAgregar(); return; }
  }
});

/* ── Etiquetas por equipo (28-sep, maqueta aprobada «CRM · etiquetas por equipo»): una tarjeta por equipo más
   «Todos los equipos»; cada etiqueta es [nombre, color, equipo] (sin equipo, para todos). En la conversación
   salen las de su equipo y las de todos (10-nucleo.js, listaTags). ── */
const PALETA_ET = ['#0891b2','#db2777','#ca8a04','#059669','#7c3aed','#dc2626','#2563eb','#ea580c','#475569'];
const NOMBRE_COLOR_ET = {'#0891b2':'Azul verdoso','#db2777':'Rosado','#ca8a04':'Mostaza','#059669':'Verde','#7c3aed':'Morado','#dc2626':'Rojo','#2563eb':'Azul','#ea580c':'Naranja','#475569':'Gris'};
st.etDlg = null;
const icUsuarios = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6"/><path d="M17.5 14a5.5 5.5 0 0 1 3 5"/></svg>';
function paginaEtiquetas(){
  const volver = `<button type="button" class="volver" data-ir="ajustes-crm">${I('back')}Ajustes del CRM</button>`;
  const chip = e => `<button type="button" class="et-chip" data-et-editar="${esc(e[0])}"><i style="background:${colorOk(e[1])}"></i>${esc(e[0])}</button>`;
  const tarjeta = (eq, cab, sub) => { const xs = ETIQS.filter(e => eqDeEtiq(e) === eq);
    return `<section class="et-card"><div class="et-cab">${cab}<span class="et-n">${xs.length}</span><button type="button" class="et-add" data-et-nueva="${esc(eq)}">${I('plus')}Agregar</button></div>
      ${sub ? `<span class="et-sub">${sub}</span>` : ''}${xs.length ? `<div class="et-chips">${xs.map(chip).join('')}</div>` : '<span class="et-vacio">Todavía no tiene etiquetas propias.</span>'}</section>`; };
  // Etiquetas de un equipo que ya no existe: se muestran con las de todos para no perderlas de vista.
  const huerfanas = ETIQS.filter(e => eqDeEtiq(e) && !EQUIPOS.some(x => x.n === eqDeEtiq(e)));
  const todas = tarjeta('', `<span class="et-ic">${icUsuarios}</span><b>Todos los equipos</b>`, 'Salen en las conversaciones de cualquier equipo');
  return `<div class="ajw ancho">${volver}<div class="et-top"><div class="t"><h2>Etiquetas</h2><p class="sub et-desc">Cada equipo tiene sus etiquetas para marcar sus conversaciones, aparte de la etapa. En una conversación salen las de su equipo y las que son para todos. Los líderes las crean aquí; los asesores solo las ponen y las quitan.</p></div>
    <button type="button" class="btn pri" data-et-nueva="">${I('plus')}Nueva etiqueta</button></div>
    <div class="et-grid">${todas}${EQUIPOS.map((e, i) => tarjeta(e.n, `<span class="et-dot" style="background:${colorOk(colorDe(e.n, i))}"></span><b>${esc(e.n)}</b>`)).join('')}</div>
    ${huerfanas.length ? `<p class="muted" style="margin-top:14px">De equipos que ya no existen: ${huerfanas.map(e => esc(e[0])).join(', ')}. Ábrelas para pasarlas a otro equipo.</p><div class="et-chips">${huerfanas.map(chip).join('')}</div>` : ''}</div>`;
}
function dlgEtiqueta(){
  const d = st.etDlg, eqI = EQUIPOS.findIndex(x => x.n === d.eq);
  const dotEq = eq => eq ? `<span class="et-dot" style="background:${colorOk(colorDe(eq, EQUIPOS.findIndex(x => x.n === eq)))}"></span>` : `<span class="et-ic sm">${icUsuarios}</span>`;
  const usos = d.viejo ? CONV.filter(c => c.tags.includes(d.viejo)).length : 0;
  return `<div class="et-dcab"><h3>${d.viejo ? 'Editar etiqueta' : 'Nueva etiqueta'}</h3></div>
    <label class="et-lab">Nombre<input id="et-dn" value="${esc(d.n)}" placeholder="Ej. Queja de un pedido" maxlength="60" autocomplete="off"></label>
    <div class="et-lab">Equipo
      <div class="et-sel-w"><button type="button" class="et-sel" data-et-abrir="1" aria-haspopup="listbox" aria-expanded="${!!d.abierto}">${dotEq(d.eq)}<span class="t">${esc(d.eq || 'Todos los equipos')}</span>${I('chev')}</button>
      ${d.abierto ? `<div class="et-menu" role="listbox">${[['', 'Todos los equipos'], ...EQUIPOS.map(e => [e.n, e.n])].map(([v, n]) => `<button type="button" role="option" aria-selected="${v === d.eq}" data-et-eq="${esc(v)}">${dotEq(v)}<span>${esc(n)}</span>${v === d.eq ? I('check') : ''}</button>`).join('')}</div>` : ''}</div>
      <small>Solo sale en las conversaciones de este equipo. Elige «Todos los equipos» si la usan todos.</small></div>
    <div class="et-lab">Color<div class="et-sws">${PALETA_ET.map(c => `<button type="button" class="et-sw" data-et-col="${c}" aria-label="${NOMBRE_COLOR_ET[c]}" aria-pressed="${c === d.col}" style="background:${c}"></button>`).join('')}</div></div>
    <div class="et-prev"><span>Así se verá</span><span class="et-chip muestra"><i style="background:${colorOk(d.col)}"></i><span id="et-prev-n">${esc(d.n.trim() || 'Nombre de la etiqueta')}</span></span></div>
    <div class="ft2${d.viejo ? ' entre' : ''}">${d.viejo ? `<button type="button" class="btn et-borrar" data-et-borrar="1">${I('x')}Borrar${usos ? ` · está en ${usos} ${usos === 1 ? 'conversación' : 'conversaciones'}` : ''}</button><span style="display:flex;gap:8px">` : ''}<button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" data-et-guardar="1">${d.viejo ? `${I('check')}Guardar` : `${I('plus')}Crear`}</button>${d.viejo ? '</span>' : ''}</div>`;
}
const abrirDlgEtiqueta = () => { abrirDialogo(dlgEtiqueta(), 'dlg-per dlg-et'); };
document.getElementById('page').addEventListener('click', e => {
  if (st.pagina !== 'etiquetas') return;
  const nv = e.target.closest('[data-et-nueva]'); if (nv) { st.etDlg = {viejo:null, n:'', eq:nv.dataset.etNueva, col:PALETA_ET[ETIQS.length % PALETA_ET.length], abierto:false}; abrirDlgEtiqueta(); setTimeout(() => { const i = document.getElementById('et-dn'); if (i) i.focus(); }, 30); return; }
  const ed = e.target.closest('[data-et-editar]'); if (ed) { const x = ETIQS.find(y => y[0] === ed.dataset.etEditar); if (!x) return; st.etDlg = {viejo:x[0], n:x[0], eq:eqDeEtiq(x), col:x[1], abierto:false}; abrirDlgEtiqueta(); }
});
document.getElementById('ov-x').addEventListener('click', e => {
  const d = st.etDlg; if (!d || !e.target.closest('.dlg-et')) return;
  const nombre = document.getElementById('et-dn'); if (nombre) d.n = nombre.value;
  if (e.target.closest('[data-et-abrir]')) { d.abierto = !d.abierto; abrirDlgEtiqueta(); return; }
  const q = e.target.closest('[data-et-eq]'); if (q) { d.eq = q.dataset.etEq; d.abierto = false; abrirDlgEtiqueta(); return; }
  const c = e.target.closest('[data-et-col]'); if (c) { d.col = c.dataset.etCol; abrirDlgEtiqueta(); return; }
  if (d.abierto && !e.target.closest('.et-sel-w')) { d.abierto = false; abrirDlgEtiqueta(); return; }
  if (e.target.closest('[data-et-borrar]')) {
    const i = ETIQS.findIndex(x => x[0] === d.viejo); if (i < 0) return;
    ETIQS.splice(i, 1); CONV.forEach(cv => { cv.tags = cv.tags.filter(t => t !== d.viejo); }); if (st.tag === d.viejo) st.tag = '';
    recolorEtiq(); st.etDlg = null; cerrarDialogo(); render(); toast(`Etiqueta borrada: ${d.viejo}`); return;
  }
  if (!e.target.closest('[data-et-guardar]')) return;
  const n = d.n.trim(); if (!n) { toast('Escribe el nombre de la etiqueta'); return; }
  if (ETIQS.some(x => x[0].toLowerCase() === n.toLowerCase() && x[0] !== d.viejo)) { toast('Ya hay una etiqueta con ese nombre'); return; }
  const nueva = d.eq ? [n, d.col, d.eq] : [n, d.col];
  if (d.viejo) {
    const i = ETIQS.findIndex(x => x[0] === d.viejo); if (i < 0) return; ETIQS[i] = nueva;
    if (n !== d.viejo) { CONV.forEach(cv => { cv.tags = cv.tags.map(t => t === d.viejo ? n : t); }); if (st.tag === d.viejo) st.tag = n; }
  } else ETIQS.push(nueva);
  recolorEtiq(); st.etDlg = null; cerrarDialogo(); render(); toast(d.viejo ? `Etiqueta guardada: ${n}` : `Etiqueta creada: ${n}`);
});
document.getElementById('ov-x').addEventListener('input', e => { if (e.target.id !== 'et-dn' || !st.etDlg) return; st.etDlg.n = e.target.value; const p = document.getElementById('et-prev-n'); if (p) p.textContent = e.target.value.trim() || 'Nombre de la etiqueta'; });
document.head.insertAdjacentHTML('beforeend', `<style>
.et-top{display:flex;align-items:flex-end;gap:16px;margin-bottom:22px}
.et-top .t{flex:1;min-width:0}
.et-top h2{margin:0 0 6px;font-size:21px}
.page p.et-desc{margin:0;font-size:13.5px;line-height:1.5;color:#4b5563;max-width:none}
.et-top .btn{height:38px;padding:0 16px;border-radius:10px;font-size:13.5px}
.et-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
@media (max-width:900px){.et-grid{grid-template-columns:1fr}}
.et-card{border:1px solid #e5e9f0;border-radius:14px;background:#fff;padding:16px 18px;display:flex;flex-direction:column;gap:14px}
.et-cab{display:flex;align-items:center;gap:10px}
.et-cab b{font-size:14.5px;font-weight:600}
.et-dot{width:10px;height:10px;border-radius:50%;flex:none;display:inline-block}
.et-ic{display:inline-grid;place-items:center;color:#4b5563}
.et-ic svg{width:17px;height:17px}
.et-ic.sm svg{width:15px;height:15px}
.et-n{display:inline-grid;place-items:center;min-width:20px;height:20px;border-radius:999px;background:#f1f5f9;font-size:11px;font-weight:600;color:#4b5563;padding:0 6px;box-sizing:border-box}
.et-add{margin-left:auto;display:inline-flex;align-items:center;gap:4px;border:0;background:none;color:#0b0b10;font:inherit;font-size:13px;font-weight:500;cursor:pointer;padding:0}
.et-add svg{width:15px;height:15px}
.et-sub{font-size:12.5px;color:#6b7280;margin-top:-8px}
.et-chips{display:flex;flex-wrap:wrap;gap:8px}
.et-chip{display:inline-flex;align-items:center;gap:8px;height:32px;padding:0 12px;border:1px solid #e5e9f0;border-radius:999px;background:#fff;font:inherit;font-size:13px;font-weight:400;color:var(--ink);cursor:pointer}
.et-chip:hover{border-color:#cbd5e1}
.et-chip i{width:9px;height:9px;border-radius:50%;display:inline-block;flex:none}
.et-chip.muestra{height:30px;cursor:default}
.et-vacio{font-size:13px;color:#6b7280}
.dlg.dlg-et h3{font-size:20px}
.et-lab{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600;color:#374151}
.et-lab input{height:42px;border:1px solid #e5e9f0;border-radius:10px;padding:0 12px;font:inherit;font-size:14px;font-weight:400;color:var(--ink);box-sizing:border-box;width:100%}
.et-lab input:focus{outline:none;border-color:var(--blue);box-shadow:0 0 0 3px var(--blue-soft)}
.et-lab small{font-size:12px;font-weight:400;color:#6b7280}
.et-sel-w{position:relative}
.et-sel{display:flex;align-items:center;gap:10px;height:42px;width:100%;border:1px solid #e5e9f0;border-radius:10px;padding:0 12px;background:#fff;font:inherit;font-size:14px;font-weight:400;color:var(--ink);cursor:pointer;text-align:left;box-sizing:border-box}
.et-sel .t{flex:1}
.et-sel > svg{width:14px;height:14px;color:#6b7280}
.et-menu{position:absolute;top:calc(100% + 6px);left:0;right:0;z-index:5;background:#fff;border:1px solid #e5e9f0;border-radius:10px;box-shadow:0 14px 30px -12px rgba(15,23,42,.3);padding:4px;max-height:260px;overflow-y:auto}
.et-menu button{display:flex;align-items:center;gap:10px;width:100%;padding:8px 10px;border:0;border-radius:8px;background:none;font:inherit;font-size:13.5px;font-weight:400;color:var(--ink);cursor:pointer;text-align:left}
.et-menu button span{flex:1}
.et-menu button:hover,.et-menu button[aria-selected="true"]{background:var(--bg2)}
.et-menu button > svg{width:14px;height:14px;color:var(--blue)}
.et-sws{display:flex;gap:10px;align-items:center;height:34px}
.et-sw{width:26px;height:26px;border-radius:50%;border:0;padding:0;cursor:pointer}
.et-sw[aria-pressed="true"]{box-shadow:0 0 0 2px #fff,0 0 0 4px #1f2937}
.et-prev{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid #eef1f5;border-radius:12px;background:#f8fafc}
.et-prev > span:first-child{font-size:12.5px;font-weight:600;color:#6b7280}
.dlg.dlg-et .ft2 .btn{height:40px}
.dlg.dlg-et .ft2.entre{justify-content:space-between}
.et-borrar{color:#b91c1c}
.et-borrar svg{width:14px;height:14px}
/* Selector de etiquetas en la conversación (tablero 3 de la maqueta) */
.tagsel .tagx{height:28px;padding:0 6px 0 10px;gap:6px;font-size:12.5px;color:var(--ink);box-sizing:border-box}
.tagsel .tagx i{width:8px;height:8px}
.tagsel .tagx button svg{width:12px;height:12px}
.tg-add{display:inline-flex;align-items:center;gap:4px;height:28px;padding:0 10px;border:1px dashed #cbd5e1;border-radius:999px;background:#fff;font:inherit;font-size:12.5px;color:#0b0b10;cursor:pointer}
.tg-add svg{width:13px;height:13px}
.menu.tg-menu{right:0;left:auto;min-width:300px;padding:6px;border-radius:12px}
.tg-q{display:flex;align-items:center;gap:8px;height:38px;padding:0 10px;border:1px solid var(--blue);border-radius:9px;box-shadow:0 0 0 3px var(--blue-soft);color:#6b7280;margin-bottom:4px}
.tg-q svg{width:15px;height:15px;flex:none}
.tg-q input{border:0;outline:none;flex:1;min-width:0;font:inherit;font-size:13px;color:var(--ink);background:transparent;padding:0}
.tg-grp{display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;color:#6b7280;padding:8px 12px 4px}
.tg-sq{width:8px;height:8px;border-radius:50%;display:inline-block}
.tg-menu #tag-l button{padding:8px 12px;font-size:13px;font-weight:400}
.tg-menu #tag-l button .dot{width:9px;height:9px;border-radius:50%}
.tg-vacio{font-size:12.5px;color:#6b7280;padding:4px 12px 8px}
.tg-crear{border-top:1px solid #eef1f5;margin-top:2px;padding-top:4px}
.tg-menu #tag-l .tg-crear button{color:#0b0b10}
</style>`);

/* ── Etapas por equipo: igual a la maqueta aprobada «CRM · líderes, subequipos y etapas por equipo»,
   tablero «Etapas por equipo». Una pestaña por equipo, sus etapas en orden (se arrastran), agregar, borrar y copiar las de otro. ── */
const PALETA_ETAPAS = ['#5d9cec', '#ffce54', '#fc6e51', '#a0d468', '#ac92ec', '#48cfad', '#ec87c0', '#656d78', '#f6bb42', '#4fc1e9'];
const svgAsa = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" stroke="none" aria-hidden="true"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>';
const enEtapa = (n, eq) => CONV.filter(c => c.etq[0] === n && equipoConv(c) === eq).length;
function tabEtapas(){ const eqs = equiposQueVeo(); if (!eqs.includes(st.etTab)) st.etTab = eqs.includes('Ventas') ? 'Ventas' : eqs[0] || 'Ventas'; return st.etTab; }
function paginaEtapas(){
  const volver = `<button type="button" class="volver" data-ir="ajustes-crm">${I('back')}Ajustes del CRM</button>`;
  const eq = tabEtapas(), eqs = equiposQueVeo(), xs = etapasDe(eq), otros = eqs.filter(n => n !== eq && etapasDe(n).length);
  return `<div class="ajw ancho">${volver}<h2>Etapas del embudo</h2><p class="sub">Cada equipo tiene su propio embudo. Las conversaciones de un equipo solo usan sus etapas, en el embudo y en la conversación. Un líder de equipo solo ve y cambia las de su equipo.</p>
    <div class="e2-tabs" role="tablist" aria-label="Equipos">${eqs.map(n => `<button type="button" role="tab" class="e2-tab" data-e2-tab="${esc(n)}" aria-selected="${n === eq}"><i style="background:${colorEquipo(n)}"></i>${esc(n)}<span class="e2-n">${etapasDe(n).length}</span></button>`).join('')}</div>
    <div class="e2-lista" data-e2-eq="${esc(eq)}">${xs.map(e => { const i = ETQ.indexOf(e), k = enEtapa(e[0], eq);
      return `<div class="e2-r" data-e2-i="${i}"><button type="button" class="e2-asa" data-e2-asa="${i}" aria-label="Mover ${esc(e[0])}. Usa las flechas o arrástrala">${svgAsa}</button><span class="e2-dot" style="background:${colorOk(e[1])}"></span><input data-e2-nombre="${i}" value="${esc(e[0])}" aria-label="Nombre de la etapa"><small>${k} ${k === 1 ? 'conversación' : 'conversaciones'}</small><button type="button" class="e2-x" data-e2-borrar="${i}" aria-label="Borrar la etapa ${esc(e[0])}">${I('x')}</button></div>`; }).join('') || `<p class="muted" style="margin:4px 0">${esc(eq)} todavía no tiene etapas. Agrega la primera o copia las de otro equipo.</p>`}
      <div class="e2-bt"><button type="button" class="btn" data-e2-agregar="1">${I('plus')}Agregar etapa</button>${otros.length ? `<div class="dd" id="dd-e2c"><button type="button" class="btn" id="e2c-b" aria-haspopup="menu" aria-expanded="false">Copiar las etapas de otro equipo</button><div class="menu l" id="e2c-m" hidden>${otros.map(n => `<button type="button" data-e2-copiar="${esc(n)}"><i class="pc-sq" style="background:${colorEquipo(n)}"></i>${esc(n)}<small>${etapasDe(n).length} etapas</small></button>`).join('')}</div></div>` : ''}</div></div></div>`;
}
// Mueve la etapa i antes (o después) de la etapa j del mismo equipo, en el orden general de ETQ.
function moverEtapa(i, j, despues){
  if (i === j || !ETQ[i] || !ETQ[j]) return; const e = ETQ[i], dest = ETQ[j];
  ETQ.splice(i, 1); const k = ETQ.indexOf(dest); ETQ.splice(despues ? k + 1 : k, 0, e); render();
}
document.getElementById('page').addEventListener('click', e => {
  if (st.pagina === 'embudo') {
    if (e.target.closest('#emb-b')) { e.stopPropagation(); const m = document.getElementById('emb-m'); m.hidden = !m.hidden; document.getElementById('emb-b').setAttribute('aria-expanded', String(!m.hidden)); return; }
    const q = e.target.closest('[data-emb-eq]'); if (q) { st.embEq = q.dataset.embEq; render(); return; }
    return;
  }
  if (st.pagina !== 'cfg-etapas') return;
  const t = e.target;
  const tb = t.closest('[data-e2-tab]'); if (tb) { st.etTab = tb.dataset.e2Tab; render(); return; }
  if (t.closest('[data-e2-agregar]')) {
    const eq = tabEtapas(), ya = new Set(etapasDe(eq).map(x => x[0])); let n = 'Etapa nueva', k = 2; while (ya.has(n)) n = `Etapa nueva ${k++}`;
    const usados = new Set(etapasDe(eq).map(x => x[1].toLowerCase())), col = PALETA_ETAPAS.find(c => !usados.has(c)) || PALETA_ETAPAS[etapasDe(eq).length % PALETA_ETAPAS.length];
    ETQ.push([n, col, eq]); if (!COL[n]) COL[n] = col; render();
    const inp = document.querySelector(`[data-e2-nombre="${ETQ.length - 1}"]`); if (inp) { inp.focus(); inp.select(); } return;
  }
  const bo = t.closest('[data-e2-borrar]'); if (bo) { const i = +bo.dataset.e2Borrar, x = ETQ[i]; if (!x) return; const k = enEtapa(x[0], eqDeEtapa(x));
    if (k) { toast(`No se puede: hay ${k} ${k === 1 ? 'conversación' : 'conversaciones'} en «${x[0]}». Muévelas primero.`); return; }
    ETQ.splice(i, 1); render(); toast(`Etapa borrada: ${x[0]}`); return; }
  if (t.closest('#e2c-b')) { e.stopPropagation(); const m = document.getElementById('e2c-m'); m.hidden = !m.hidden; document.getElementById('e2c-b').setAttribute('aria-expanded', String(!m.hidden)); return; }
  const cp = t.closest('[data-e2-copiar]'); if (cp) { const eq = tabEtapas(), ya = new Set(etapasDe(eq).map(x => x[0])); let n = 0;
    for (const x of etapasDe(cp.dataset.e2Copiar)) if (!ya.has(x[0])) { ETQ.push([x[0], x[1], eq]); n++; }
    render(); toast(n ? `Se copiaron ${n} ${n === 1 ? 'etapa' : 'etapas'} de ${cp.dataset.e2Copiar}` : `${eq} ya tiene todas las etapas de ${cp.dataset.e2Copiar}`); return; }
});
document.addEventListener('click', e => {
  if (!e.target.closest('#dd-emb')) { const m = document.getElementById('emb-m'); if (m) m.hidden = true; }
  if (!e.target.closest('#dd-e2c')) { const m = document.getElementById('e2c-m'); if (m) m.hidden = true; }
});
document.getElementById('page').addEventListener('change', e => {
  if (st.pagina !== 'cfg-etapas') return;
  const inp = e.target.closest('[data-e2-nombre]'); if (!inp) return;
  const i = +inp.dataset.e2Nombre, x = ETQ[i]; if (!x) return; const viejo = x[0], nuevo = inp.value.trim(), eq = eqDeEtapa(x);
  if (!nuevo || nuevo === viejo) { inp.value = viejo; return; }
  if (etapasDe(eq).some(y => y !== x && y[0] === nuevo)) { toast(`${eq} ya tiene una etapa «${nuevo}»`); inp.value = viejo; return; }
  x[0] = nuevo; COL[nuevo] = colorOk(x[1]); CONV.forEach(c => { if (equipoConv(c) === eq) c.etq = c.etq.map(y => y === viejo ? nuevo : y); }); render(); toast(`Etapa renombrada: ${nuevo}`);
});
// Ordenar: arrastrando desde la asa, o con las flechas cuando la asa tiene el foco.
let e2Arr = null;
document.getElementById('page').addEventListener('pointerdown', e => { const a = e.target.closest('.e2-asa'); if (a) a.closest('.e2-r').draggable = true; });
document.getElementById('page').addEventListener('dragstart', e => { const r = e.target.closest && e.target.closest('.e2-r'); if (!r || st.pagina !== 'cfg-etapas') return; e2Arr = +r.dataset.e2I; r.classList.add('arrastrando'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(e2Arr)); } catch { /* sin datos */ } });
document.getElementById('page').addEventListener('dragover', e => { const r = e.target.closest && e.target.closest('.e2-r'); if (e2Arr === null || !r) return; e.preventDefault(); document.querySelectorAll('.e2-r.sobre').forEach(x => x !== r && x.classList.remove('sobre')); r.classList.add('sobre'); });
document.getElementById('page').addEventListener('drop', e => { const r = e.target.closest && e.target.closest('.e2-r'); if (e2Arr === null || !r) return; e.preventDefault(); const j = +r.dataset.e2I, b = r.getBoundingClientRect(); const i = e2Arr; e2Arr = null; moverEtapa(i, j, e.clientY > b.top + b.height / 2); });
document.getElementById('page').addEventListener('dragend', () => { e2Arr = null; document.querySelectorAll('.e2-r').forEach(x => { x.classList.remove('arrastrando', 'sobre'); x.draggable = false; }); });
document.getElementById('page').addEventListener('keydown', e => {
  const a = e.target.closest && e.target.closest('.e2-asa'); if (!a || !['ArrowUp', 'ArrowDown'].includes(e.key)) return; e.preventDefault();
  const i = +a.dataset.e2Asa, xs = etapasDe(eqDeEtapa(ETQ[i])), p = xs.indexOf(ETQ[i]), q = p + (e.key === 'ArrowUp' ? -1 : 1); if (q < 0 || q >= xs.length) return;
  const destino = xs[q]; moverEtapa(i, ETQ.indexOf(destino), e.key === 'ArrowDown');
  const n = document.querySelector(`[data-e2-asa="${ETQ.indexOf(xs[p])}"]`); if (n) n.focus();
});
document.head.insertAdjacentHTML('beforeend', `<style>
.e2-tabs{display:flex;gap:24px;border-bottom:1px solid var(--line);margin:18px 0 16px}
.e2-tab{border:0;background:none;padding:10px 2px;font-size:13.5px;font-weight:500;color:var(--ink3);border-bottom:2px solid transparent;display:inline-flex;gap:8px;align-items:center;margin-bottom:-1px}
.e2-tab[aria-selected="true"]{color:var(--blue-ink);border-bottom-color:var(--blue-ink)}
.e2-tab i{width:9px;height:9px;border-radius:50%;display:inline-block}
.e2-n{min-width:20px;height:20px;border-radius:999px;background:var(--bg3);font-size:11px;font-weight:600;color:var(--ink2);padding:0 6px;display:inline-grid;place-items:center;box-sizing:border-box}
.e2-lista{display:flex;flex-direction:column;gap:8px;max-width:760px}
.e2-r{display:flex;align-items:center;gap:12px;padding:10px 14px;border:1px solid var(--line);border-radius:12px;background:#fff}
.e2-r.arrastrando{opacity:.5}
.e2-r.sobre{border-color:var(--blue);box-shadow:0 0 0 3px var(--blue-soft)}
.e2-asa{color:var(--ink4);cursor:grab;display:grid;place-items:center;width:24px;height:24px;border-radius:6px;flex:none}
.e2-asa:hover,.e2-asa:focus-visible{background:var(--hover);color:var(--ink2)}
.e2-dot{width:12px;height:12px;border-radius:50%;flex:none}
.e2-r input{flex-grow:1;min-width:0;border:0;outline:none;font:inherit;font-size:14px;font-weight:400;color:var(--ink);background:transparent;padding:4px 0}
.e2-r input:focus{box-shadow:0 1px 0 var(--blue)}
.e2-r small{font-size:12.5px;color:var(--ink3);white-space:nowrap}
.e2-x{width:30px;height:30px;border:1px solid var(--line);border-radius:8px;background:#fff;color:var(--ink3);display:grid;place-items:center;flex:none}
.e2-x:hover{background:var(--hover);color:var(--ink)}
.e2-x svg{width:13px;height:13px}
.e2-bt{display:flex;gap:8px;margin-top:6px;flex-wrap:wrap}
#e2c-m button small{margin-left:auto}
.emb-sel{display:inline-flex;align-items:center;gap:8px;height:36px;padding:0 12px;border:1px solid var(--line);border-radius:10px;background:#fff;font-size:13.5px;font-weight:400;color:var(--ink)}
.emb-sel i{width:10px;height:10px;border-radius:50%;display:inline-block}
.emb-sel svg{width:14px;height:14px;color:var(--ink4)}
#emb-m{min-width:220px}
#emb-m button{font-weight:400}
#emb-m button > svg.ck{margin-left:auto;width:16px;height:16px;color:var(--blue);stroke-width:2}
</style>`);
