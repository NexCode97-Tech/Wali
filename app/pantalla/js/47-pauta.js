/* ── Enlaces de pauta ──
   Meta lo dice solo. Para Google, TikTok y el resto: un enlace por campaña que registra cada clic con lo que la
   plataforma pone sola en la dirección (campaña, grupo, anuncio) y lleva a WhatsApp con un código corto; y un código
   para la página web que hace lo mismo con los botones de WhatsApp de la página. API: GET/POST/PATCH/DELETE
   /crm/enlaces (services/crm/enlaces.ts). Guía: docs/crm/enlaces-pauta.md. */

LOGO.gads = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#34A853" d="M3.9998 22.9291C1.7908 22.9291 0 21.1383 0 18.9293s1.7908-3.9998 3.9998-3.9998 3.9998 1.7908 3.9998 3.9998-1.7908 3.9998-3.9998 3.9998z"/><path fill="#4285F4" d="M23.4641 16.9287L15.4632 3.072C14.3586 1.1587 11.9121.5028 9.9988 1.6074S7.4295 5.1585 8.5341 7.0718l8.0009 13.8567c1.1046 1.9133 3.5511 2.5679 5.4644 1.4646 1.9134-1.1046 2.568-3.5511 1.4647-5.4644z"/><path fill="#FBBC04" d="M7.5137 4.8438L1.5645 15.1484A4.5 4.5 0 0 1 4 14.4297c2.5597-.0075 4.6248 2.1585 4.4941 4.7148l3.2168-5.5723-3.6094-6.25c-.4499-.7793-.6322-1.6394-.5878-2.4784z"/></svg>';
LOGO.meta = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#0081FB" d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z"/></svg>';

document.head.insertAdjacentHTML('beforeend', `<style>
.marca.gads,.marca.meta{background:#fff;border:1px solid var(--line)}
.pa-auto{display:flex;align-items:center;gap:14px}
.pa-auto p{margin:2px 0 0;font-size:12.5px;color:var(--ink3);line-height:1.5}
.pa-auto b{font-size:14px;font-weight:600}
.pa-t{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.pa-hd{display:flex;align-items:center;gap:10px;justify-content:space-between}
.pa-hd h4{margin:0}
.pa-tb{min-width:760px}
.pa-tb td{vertical-align:middle}
.pa-tb .n{display:flex;align-items:center;gap:10px;min-width:0}
.pa-tb .n b{display:block;font-weight:600}
.pa-tb .n small{display:block;color:var(--ink3);font-size:12px;overflow-wrap:anywhere}
.pa-tb .num{text-align:right}
.pa-tb th.num{text-align:right}
.pa-tb .acc{display:flex;gap:6px;justify-content:flex-end}
.pa-pegar{display:grid;gap:10px}
.pa-pegar code{display:block;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.5;color:var(--ink);background:var(--bg2);border:1px solid var(--line);border-radius:9px;padding:10px 12px}
.pa-pasos{margin:0;padding-left:18px;display:grid;gap:6px;font-size:13px;color:var(--ink2);line-height:1.5}
.pa-cifras{display:flex;gap:18px;flex-wrap:wrap;font-size:12.5px;color:var(--ink3)}
.pa-cifras b{color:var(--ink);font-weight:600}
.pa-nota{font-size:12px;color:var(--ink3);margin:0;line-height:1.5}
.pa-scroll{overflow-x:auto}
</style>`);

const PLAT_PA = {
  google:{n:'Google Ads', marca:'gads', logo:() => LOGO.gads},
  tiktok:{n:'TikTok Ads', marca:'tt', logo:() => LOGO.tt},
  meta:{n:'Meta Ads', marca:'meta', logo:() => LOGO.meta},
  otro:{n:'Otro lugar', marca:'neutra', logo:() => I('link')},
  web:{n:'Página web', marca:'neutra', logo:() => I('web')},
};
// Lo que cada plataforma cambia sola en cada clic (TikTok: __…__; Meta: {{…}}). Google no deja abrir WhatsApp desde el
// anuncio: va a la página y el código de la página toma el gclid.
const MACROS_PA = {
  tiktok:'utm_source=tiktok&utm_campaign=__CAMPAIGN_NAME__&adgroup=__AID_NAME__&utm_content=__CID_NAME__&campaign_id=__CAMPAIGN_ID__&ad_id=__CID__',
  meta:'utm_source=facebook&utm_campaign={{campaign.name}}&adgroup={{adset.name}}&utm_content={{ad.name}}&campaign_id={{campaign.id}}&ad_id={{ad.id}}',
};
const SUFIJO_GOOGLE = 'utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&adgroup={adgroupid}&utm_content={creative}&utm_term={keyword}';
const baseEnlace = e => `${location.origin}/w/${e.codigo}`;
const enlaceParaPegar = e => MACROS_PA[e.plataforma] ? `${baseEnlace(e)}?${MACROS_PA[e.plataforma]}` : baseEnlace(e);
const codigoPagina = w => `<script src="${location.origin}/pauta.js" data-enlace="${w.codigo}" async><\/script>`;
const pctPa = (a, b) => b ? `${Math.round(a / b * 100)} %` : '—';

st.pa = null; st.paCargando = false;
function cargarEnlaces(){
  if (st.paCargando) return; st.paCargando = true;
  crmApi('GET', '/crm/enlaces')
    .then(d => { st.pa = d; }).catch(err => { st.pa = {error:err.message}; })
    .finally(() => { st.paCargando = false; if (st.pagina === 'cfg-pauta') render(); });
}

function paginaPauta(){
  const volver = `<button type="button" class="volver" data-ir="ajustes-crm">${I('back')}Ajustes del CRM</button>`;
  const cab = `${volver}<h2>Enlaces de pauta</h2><p class="sub">Para saber de qué anuncio llega cada persona sin preguntarle. Cada clic queda registrado con su campaña y su anuncio, y cuando la persona escribe el CRM la une a ese clic.</p>`;
  if (!st.pa) { cargarEnlaces(); return `<div class="ajw ancho">${cab}<p class="muted">Cargando los enlaces…</p></div>`; }
  if (st.pa.error) return `<div class="ajw ancho">${cab}<div class="vacio">${I('ad')}<b>No se pudieron cargar los enlaces</b><p>${esc(st.pa.error)}</p><button type="button" class="btn" data-pa-recargar="1">Intentar de nuevo</button></div></div>`;
  const {enlaces, web, dias} = st.pa, lider = st.rol === 'l' && !crmSoloLectura();
  const linea = id => LINEAS.find(l => l.id === id);
  const filas = enlaces.map(e => { const P = PLAT_PA[e.plataforma] || PLAT_PA.otro, l = linea(e.lineaId);
    return `<tr><td><div class="n"><span class="marca mini ${P.marca}">${P.logo()}</span><span style="min-width:0"><b>${esc(e.nombre)}</b><small>${esc(P.n)} · ${esc(baseEnlace(e).replace(/^https?:\/\//, ''))}</small></span></div></td>
      <td>${l ? `${esc(l.n)}<br><small class="muted">${esc(l.tel)}</small>` : '<span class="pill">Sin línea</span>'}</td>
      <td class="num">${e.clics.toLocaleString('es-CO')}</td><td class="num">${e.conversaciones.toLocaleString('es-CO')}</td><td class="num">${pctPa(e.conversaciones, e.clics)}</td>
      <td><div class="acc"><button type="button" class="btn" data-pa-usar="${e.id}">${I('link')}Cómo usarlo</button>${lider ? `<div class="dd dsel" style="position:relative"><button type="button" class="btn ic" data-dsel-open="1" aria-label="Más opciones de ${esc(e.nombre)}">${I('more')}</button><div class="menu" hidden><button type="button" data-pa-editar="${e.id}">${I('pen')}Editar</button><button type="button" data-pa-borrar="${e.id}">${I('x')}Borrar</button></div></div>` : ''}</div></td></tr>`; }).join('');
  const tabla = enlaces.length ? `<div class="pa-scroll"><table class="tb3 pa-tb"><thead><tr><th>Enlace</th><th>Lleva a</th><th class="num">Clics</th><th class="num">Conversaciones</th><th class="num">Conversión</th><th></th></tr></thead><tbody>${filas}</tbody></table></div><p class="pa-nota">Últimos ${dias} días. Una conversación cuenta cuando la persona escribe con el código de su clic.</p>`
    : `<div class="vacio">${I('ad')}<b>Todavía no hay enlaces</b><p>Crea uno por campaña o por plataforma: TikTok Ads, Meta Ads o cualquier lugar donde compartas tu WhatsApp, como la bio o un código QR.</p>${lider ? `<button type="button" class="btn pri" data-pa-crear="1">${I('plus')}Crear enlace</button>` : ''}</div>`;
  return `<div class="ajw ancho">${cab}<div class="cfg">
    <div class="box2"><div class="pa-auto"><span class="marca meta">${LOGO.meta}</span><div style="flex:1;min-width:0"><div class="pa-t"><b>Meta lo hace solo</b><span class="ok2">Automático</span></div><p>Los anuncios de Facebook e Instagram que abren WhatsApp, Messenger o Instagram ya dicen de qué campaña y anuncio llega cada persona. No hay que crear nada.</p></div></div></div>
    <div class="box2"><div class="pa-hd"><h4>${I('link')}Enlaces</h4>${lider && enlaces.length ? `<button type="button" class="btn pri" data-pa-crear="1">${I('plus')}Crear enlace</button>` : ''}</div>${tabla}</div>
    <div class="box2"><h4>${I('web')}Tu página web</h4>
      <p class="pa-nota" style="font-size:13px;color:var(--ink2)">Si tus anuncios llevan a tu página (así funciona Google Ads), pega este código una vez. Guarda de qué anuncio llegó cada visitante y se lo pasa a los botones de WhatsApp de la página, que siguen yendo al mismo número con el mismo texto.</p>
      <code>${esc(codigoPagina(web))}</code>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><button type="button" class="btn" data-pa-copiar="${esc(codigoPagina(web))}" data-pa-copiado="Código copiado">${I('link')}Copiar código</button><span class="pa-cifras"><span>Últimos ${dias} días: <b>${web.clics.toLocaleString('es-CO')}</b> clics desde anuncios</span><span><b>${web.conversaciones.toLocaleString('es-CO')}</b> conversaciones</span></span></div>
      <p class="pa-nota">Va antes de &lt;/body&gt;. Para ver en Google también la campaña y la palabra clave, en Google Ads: Configuración de la cuenta, Seguimiento, «Sufijo de URL final», pega esto:</p>
      <code>${esc(SUFIJO_GOOGLE)}</code>
      <div><button type="button" class="btn" data-pa-copiar="${esc(SUFIJO_GOOGLE)}" data-pa-copiado="Sufijo copiado">${I('link')}Copiar sufijo</button></div></div>
  </div></div>`;
}

/* Crear y editar */
function dialogoEnlace(e){
  const nuevo = !e, d = st.paForm = {id:e ? e.id : null, nombre:e ? e.nombre : '', plataforma:e ? e.plataforma : 'tiktok', lineaId:e ? e.lineaId : (LINEAS[0] || {}).id || '', mensaje:e ? e.mensaje : 'Hola, quiero más información'};
  pintarDialogoEnlace(nuevo);
}
function pintarDialogoEnlace(nuevo){
  const d = st.paForm;
  if (!LINEAS.length) { abrirDialogo(`${dlgCab('neutra', I('ad'), 'Crear enlace de pauta', 'El enlace lleva a una línea de WhatsApp.')}<p>Primero conecta una línea de WhatsApp en Canales. Después vuelve aquí y crea el enlace.</p><div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cerrar</button><button type="button" class="btn pri" data-pa-canales="1">Ir a Canales</button></div>`); return; }
  const P = PLAT_PA[d.plataforma];
  const notaGoogle = d.plataforma === 'google' ? `<p class="pa-nota">Google no deja que el anuncio abra WhatsApp: lleva a tu página. Pon este enlace en el botón de WhatsApp de la página, o mejor, pega el código de la página web (abajo en Enlaces de pauta) y deja los botones como están.</p>` : '';
  abrirDialogo(`${dlgCab(P.marca, P.logo(), nuevo ? 'Crear enlace de pauta' : 'Editar enlace', 'Cada clic queda registrado y la persona llega a WhatsApp con el mensaje escrito.')}
    <div class="cx-f">
      <label>Nombre<input id="pa-nombre" value="${esc(d.nombre)}" maxlength="80" placeholder="Ej. TikTok · campaña de octubre"></label>
      <div class="fld">Dónde lo vas a usar${ddSel('data-pa-plat', Object.entries(PLAT_PA).filter(([k]) => k !== 'web').map(([k, x]) => [k, x.n]), d.plataforma)}</div>
      ${notaGoogle}
      <div class="fld">Línea de WhatsApp${ddSel('data-pa-linea', LINEAS.map(l => [l.id, `${l.n} · ${l.tel}`]), d.lineaId)}</div>
      <label>Mensaje que le llega escrito<input id="pa-mensaje" value="${esc(d.mensaje)}" maxlength="300"></label>
      <p class="pa-nota">Al final del mensaje va un código corto, por ejemplo «(código K7Q2P)». Con él el CRM sabe de qué clic viene la persona.</p>
    </div>
    <div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" data-pa-guardar="1">${I('check')}${nuevo ? 'Crear enlace' : 'Guardar'}</button></div>`);
}
function leerFormEnlace(){
  const d = st.paForm, n = document.getElementById('pa-nombre'), m = document.getElementById('pa-mensaje');
  if (n) d.nombre = n.value; if (m) d.mensaje = m.value;
  return d;
}

/* Cómo usarlo: el enlace listo para pegar y los pasos de la plataforma */
function dialogoUsar(e){
  const P = PLAT_PA[e.plataforma] || PLAT_PA.otro, pegar = enlaceParaPegar(e);
  const pasos = {
    tiktok:['En TikTok Ads Manager, al crear o editar el anuncio: Destino, «Sitio web».', 'Pega el enlace en «URL». TikTok cambia solo lo que va entre __ por la campaña, el grupo y el anuncio de cada clic.', 'Si en Seguimiento tienes activo el parámetro ttclid, el clic también lo trae.'],
    meta:['Úsalo en anuncios que llevan a un sitio web o a un enlace. Los que abren WhatsApp, Messenger o Instagram no lo necesitan: Meta ya lo dice.', 'En el anuncio, en «URL del sitio web», pega el enlace. Meta cambia solo lo que va entre {{ }} por la campaña, el conjunto y el anuncio.'],
    google:['Google no deja que el anuncio abra WhatsApp: el anuncio lleva a tu página.', 'En tu página, pon este enlace en el botón de WhatsApp. Con el código de la página web pegado, el clic trae también el gclid y la campaña.'],
    otro:['Pégalo donde quieras que te escriban: la bio de Instagram, un correo, un código QR, otra red.', 'Si quieres separar de dónde llega cada persona, crea un enlace para cada lugar.'],
  }[e.plataforma] || [];
  abrirDialogo(`${dlgCab(P.marca, P.logo(), esc(e.nombre), `${esc(P.n)} · lleva a WhatsApp`)}
    <div class="pa-pegar"><b style="font-size:13px">Enlace para pegar</b><code>${esc(pegar)}</code>
      <ol class="pa-pasos">${pasos.map(p => `<li>${esc(p)}</li>`).join('')}</ol></div>
    <div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cerrar</button><button type="button" class="btn pri" data-pa-copiar="${esc(pegar)}" data-pa-copiado="Enlace copiado">${I('link')}Copiar enlace</button></div>`);
}

const paginaCfgPauta = paginaCfg;
paginaCfg = function(k){ return k === 'pauta' ? paginaPauta() : paginaCfgPauta(k); };

function clicPauta(e){
  const t = e.target;
  const cp = t.closest('[data-pa-copiar]'); if (cp) { copiar(cp.dataset.paCopiar, cp.dataset.paCopiado || 'Copiado'); return true; }
  if (t.closest('[data-pa-recargar]')) { st.pa = null; render(); return true; }
  if (t.closest('[data-pa-crear]')) { dialogoEnlace(null); return true; }
  const us = t.closest('[data-pa-usar]'); if (us) { const x = st.pa.enlaces.find(y => y.id === us.dataset.paUsar); if (x) dialogoUsar(x); return true; }
  const ed = t.closest('[data-pa-editar]'); if (ed) { const x = st.pa.enlaces.find(y => y.id === ed.dataset.paEditar); if (x) dialogoEnlace(x); return true; }
  const bo = t.closest('[data-pa-borrar]'); if (bo) { const x = st.pa.enlaces.find(y => y.id === bo.dataset.paBorrar); if (x) abrirDialogo(`<h3>Borrar «${esc(x.nombre)}»</h3><p>El enlace deja de funcionar donde esté pegado y ya no registra clics. Las personas que ya llegaron por él conservan su campaña.</p><div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" data-pa-borrarok="${x.id}" style="background:var(--red-ink);border-color:var(--red-ink)">Borrar enlace</button></div>`); return true; }
  return false;
}
document.getElementById('page').addEventListener('click', e => { if (st.pagina === 'cfg-pauta') clicPauta(e); });
document.getElementById('ov-x').addEventListener('click', e => {
  if (st.pagina !== 'cfg-pauta') return; const t = e.target;
  if (clicPauta(e)) return;
  if (t.closest('[data-pa-canales]')) { cerrarDialogo(); st.pagina = 'cfg-canales'; render(); return; }
  const pl = t.closest('[data-pa-plat]'); if (pl && st.paForm) { leerFormEnlace(); st.paForm.plataforma = pl.dataset.paPlat; pintarDialogoEnlace(!st.paForm.id); return; }
  const li = t.closest('[data-pa-linea]'); if (li && st.paForm) { leerFormEnlace(); st.paForm.lineaId = li.dataset.paLinea; pintarDialogoEnlace(!st.paForm.id); return; }
  const g = t.closest('[data-pa-guardar]'); if (g && st.paForm && !g.disabled) {
    const d = leerFormEnlace(), cuerpo = {nombre:d.nombre.trim(), plataforma:d.plataforma, lineaId:d.lineaId, mensaje:d.mensaje.trim()};
    g.disabled = true;
    (d.id ? crmApi('PATCH', `/crm/enlaces/${d.id}`, cuerpo) : crmApi('POST', '/crm/enlaces', cuerpo))
      .then(r => crmApi('GET', '/crm/enlaces').then(x => { st.pa = x; render();
        if (d.id) { cerrarDialogo(); toast('Enlace guardado'); return; }
        const creado = x.enlaces.find(y => y.id === r.id); if (creado) dialogoUsar(creado); else cerrarDialogo(); toast('Enlace creado'); }))
      .catch(err => { g.disabled = false; toast(err.message); });
    return; }
  const bk = t.closest('[data-pa-borrarok]'); if (bk && !bk.disabled) { bk.disabled = true;
    crmApi('DELETE', `/crm/enlaces/${bk.dataset.paBorrarok}`).then(() => crmApi('GET', '/crm/enlaces')).then(x => { st.pa = x; cerrarDialogo(); render(); toast('Enlace borrado'); })
      .catch(err => { bk.disabled = false; toast(err.message); }); return; }
});
