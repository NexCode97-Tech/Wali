/* ── WhatsApp caído (maqueta aprobada «Aviso WhatsApp caído», 13-oct) ──
   Mientras una conexión de WhatsApp con Meta esté caída (api caidas.ts: revisión diaria o un envío rechazado por el
   token), arriba de todo sale una franja roja que no se puede cerrar y se quita sola cuando la conexión vuelve:
   · quien configura el CRM ve «Cómo arreglarlo» (los pasos del token que nunca vence) y «Reconectar» (Líneas de WhatsApp);
   · el asesor ve el aviso sin botón y a quién ya se le avisó;
   · en la conversación abierta de esa línea se marca desde cuándo no entran mensajes;
   · el engranaje de Ajustes lleva un punto rojo.
   Los datos llegan en /crm/inicio (waCaido) y en vivo con el evento «wa-caido». */
const WA_CAIDO = {caidas: [], admins: []};
(() => {
  const app = document.getElementById('app');
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const MESES_L = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const bog = ms => { const d = new Date(ms - 5 * 3600e3); return {d: d.getUTCDate(), m: d.getUTCMonth(), h: d.getUTCHours(), mi: d.getUTCMinutes()}; };
  const fechaLarga = ms => { const p = bog(ms); return `${p.d} de ${MESES_L[p.m]}`; };
  const fechaCorta = ms => { const p = bog(ms), h12 = p.h % 12 || 12; return `${p.d} ${MESES[p.m]}, ${h12}:${String(p.mi).padStart(2, '0')} ${p.h < 12 ? 'a. m.' : 'p. m.'}`; };
  const P_WA_X = '<path d="M4 20l1.3-3.8A8 8 0 1 1 8 19z"/><path d="m9.5 9.5 5 5m0-5-5 5"/>';
  const P_RE = '<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16m0 4v-4h-4"/>';
  const ic = d => `<svg class="wac-i" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const lista = xs => xs.length < 2 ? (xs[0] || '') : `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}`;

  window.crmWaCaido = d => { if (!d || typeof d !== 'object') return; WA_CAIDO.caidas = Array.isArray(d.caidas) ? d.caidas : []; WA_CAIDO.admins = Array.isArray(d.admins) ? d.admins : []; };
  document.addEventListener('crm:evento', e => { const d = e.detail || {}; if (d.tipo !== 'wa-caido') return; window.crmWaCaido(d); pintar(); });

  // Cuándo dejó de servir: cuándo venció el token si se sabe; si no, cuándo lo detectó el CRM.
  const cuando = c => c.vence || c.desde;
  function textos(){
    const cs = WA_CAIDO.caidas, lineas = cs.flatMap(c => c.lineas || []), primera = Math.min(...cs.map(cuando));
    const cuales = lineas.length === 1 ? `la línea «${lineas[0]}»` : `las líneas ${lista(lineas.map(l => `«${l}»`))}`;
    const porToken = cs.every(c => c.vence);
    const detalle = porToken ? `El token de Meta de ${cuales} venció el ${fechaLarga(primera)}.` : `La conexión de ${cuales} con Meta se cayó el ${fechaLarga(primera)}.`;
    const admins = WA_CAIDO.admins.filter(n => n !== YO_NOMBRE());
    const quien = admins.length === 1 ? `a ${admins[0]}, el administrador,` : admins.length ? `a ${lista(admins)}, los administradores,` : 'al administrador';
    return {detalle, quien, primera, plural: lineas.length > 1};
  }
  const YO_NOMBRE = () => { try { return typeof yo === 'string' ? yo : (AJ && AJ.nombre) || ''; } catch { return ''; } };

  function franjaHtml(){
    const t = textos(), admin = puedeConfigurarCrm();
    if (admin) return `<span class="wac-ic">${ic(P_WA_X)}</span>
      <div class="wac-tx"><b>Tu WhatsApp está desconectado<span class="wac-largo">: los mensajes nuevos no están llegando</span></b><span><span class="wac-corto">Los mensajes nuevos no están llegando. </span>${esc(t.detalle)}<span class="wac-largo"> Reconéct${t.plural ? 'alas' : 'ala'} para volver a recibir y enviar.</span></span></div>
      <button type="button" class="wac-ver" data-wac="como">Cómo arreglarlo</button>
      <button type="button" class="wac-bt" data-wac="reconectar">${ic(P_RE)}Reconectar</button>`;
    return `<span class="wac-ic">${ic(P_WA_X)}</span>
      <div class="wac-tx"><b>WhatsApp está desconectado</b><span>Los mensajes nuevos no están llegando. Ya le avisamos ${esc(t.quien)} para que lo reconecte.</span></div>`;
  }

  function pintar(){
    const hay = WA_CAIDO.caidas.length > 0;
    app.classList.toggle('wac-on', hay);
    let f = document.getElementById('wa-caido');
    if (!hay) { if (f) f.remove(); marcarAjustes(false); quitarCorte(); return; }
    if (!f) { f = document.createElement('div'); f.id = 'wa-caido'; f.className = 'wac'; f.setAttribute('role', 'alert'); app.prepend(f); }
    const html = franjaHtml();
    if (f.dataset.html !== html) { f.replaceChildren(); f.insertAdjacentHTML('beforeend', html); f.dataset.html = html; }
    f.classList.toggle('admin', puedeConfigurarCrm());
    app.style.setProperty('--wac-h', f.offsetHeight + 'px');
    marcarAjustes(puedeConfigurarCrm());
    corte();
  }
  function marcarAjustes(si){ const b = document.getElementById('b-ajustes'); if (b) b.classList.toggle('wac-punto', !!si); }

  // En la conversación abierta, si su línea está caída: desde cuándo no entran mensajes.
  function quitarCorte(){ const x = document.querySelector('#msgs .wac-corte'); if (x) x.remove(); }
  function corte(){
    quitarCorte();
    if (st.pagina || st.sel == null) return;
    const c = CONV.find(x => x.id === st.sel); if (!c) return;
    const l = LINEAS.find(x => x.id === c.linea); if (!l) return;
    const caida = WA_CAIDO.caidas.find(k => k.id === l.conexionId || (k.lineas || []).includes(l.n)); if (!caida) return;
    const msgs = document.getElementById('msgs'); if (!msgs) return;
    msgs.insertAdjacentHTML('beforeend', `<div class="wac-corte">${ic(P_WA_X)}Desde el ${esc(fechaCorta(cuando(caida)))} no entran mensajes nuevos</div>`);
  }

  window.addEventListener('resize', () => { const f = document.getElementById('wa-caido'); if (f) app.style.setProperty('--wac-h', f.offsetHeight + 'px'); });
  const renderAntes = render;
  render = function(){ const r = renderAntes.apply(this, arguments); pintar(); return r; };

  document.addEventListener('click', e => {
    const b = e.target instanceof Element && e.target.closest('[data-wac]'); if (!b) return;
    if (b.dataset.wac === 'reconectar') { st.pagina = 'cfg-lineas'; render(); return; }
    if (b.dataset.wac === 'como') abrirDialogo(`<h3>Cómo volver a conectar WhatsApp</h3>
      <p>El token de Meta con que se conectó la línea ya no sirve, así que Meta dejó de mandarle los mensajes al CRM. Se arregla con un token que nunca vence:</p>
      <ol class="wac-pasos">
        <li>Entra a <b>business.facebook.com</b> › Configuración del negocio › <b>Usuarios › Usuarios del sistema</b>. Crea uno de tipo Administrador o usa el que ya tienes.</li>
        <li>Toca <b>Agregar activos</b> y dale <b>control total</b> de la app de Meta y de la cuenta de WhatsApp.</li>
        <li>Toca <b>Generar nuevo token</b>: elige la app, vencimiento <b>«Nunca»</b> y marca <b>whatsapp_business_messaging</b> y <b>whatsapp_business_management</b>.</li>
        <li>En el CRM, en Líneas de WhatsApp, vuelve a conectar la app con su App ID, su clave secreta y el token nuevo. La línea y sus conversaciones se quedan como están.</li>
      </ol>
      <div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cerrar</button><button type="button" class="btn pri" data-wac="reconectar" data-cerrar-dlg="1">Reconectar</button></div>`);
  });

  document.head.insertAdjacentHTML('beforeend', `<style>
.wac{position:relative;z-index:2;display:flex;align-items:center;gap:12px;padding:10px 12px 10px 14px;border-radius:12px;background:#fdecec;border:1px solid #f7c9c9;color:#991b1b;font-family:inherit}
.wac-i{width:16px;height:16px;flex:none;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.wac-ic{width:30px;height:30px;border-radius:50%;background:#dc2626;color:#fff;display:grid;place-items:center;flex:none}
.wac-ic .wac-i{stroke-width:2.2}
.wac-tx{flex:1;min-width:0;font-size:13.5px;line-height:1.4}
.wac-tx b{display:block;font-weight:600;color:#7f1d1d}
.wac-corto{display:none}
.wac-ver{flex:none;border:0;background:none;font:inherit;font-size:13px;font-weight:500;color:#991b1b;text-decoration:underline;cursor:pointer;padding:0 4px}
.wac-bt{flex:none;height:36px;padding:0 14px;border-radius:9px;border:0;background:#FFD21F;color:#0b0b10;font:inherit;font-size:13.5px;font-weight:600;display:inline-flex;align-items:center;gap:7px;cursor:pointer}
.wac-bt .wac-i{width:15px;height:15px}
.wac-ver:focus-visible,.wac-bt:focus-visible{outline:2px solid #0b0b10;outline-offset:2px}
/* La franja va arriba, sobre las columnas (la barra lateral sigue a todo lo alto). */
@media (min-width:1001px){
  #app.wac-on{grid-template-rows:auto minmax(0,1fr)}
  #app.wac-on > *{grid-row:2}
  #app.wac-on > .nav{grid-row:1 / -1}
  #app.wac-on > .wac{grid-row:1;grid-column:2 / -1;margin:14px 18px 0 18px}
}
/* Con 1000 px o menos las columnas se turnan (lista, chat, página): la franja va fija arriba y el CRM baja su alto. */
@media (max-width:1000px){
  #app.wac-on{box-sizing:border-box;padding-top:calc(var(--wac-h,72px) + 10px)}
  #app.wac-on > .wac{position:fixed;top:calc(10px + env(safe-area-inset-top,0px));left:clamp(12px,3.5vw,20px);right:clamp(12px,3.5vw,20px);z-index:40}
}
@media (max-width:760px){
  .wac{flex-wrap:wrap;gap:10px;padding:12px}
  .wac-tx{flex:1 1 calc(100% - 44px)}
  .wac-largo,.wac-ver{display:none}
  .wac-corto{display:inline}
  .wac-bt{flex:1 1 100%;justify-content:center;height:42px}
}
.wac-corte{align-self:center;margin:10px auto 4px;width:fit-content;max-width:100%;font-size:12px;color:#991b1b;background:#fdecec;border:1px solid #f7c9c9;padding:5px 12px;border-radius:999px;display:flex;align-items:center;gap:6px;text-align:center}
.wac-corte .wac-i{width:13px;height:13px}
#b-ajustes.wac-punto{position:relative}
#b-ajustes.wac-punto::after{content:"";position:absolute;top:5px;right:5px;width:8px;height:8px;border-radius:50%;background:#dc2626;box-shadow:0 0 0 2px var(--nx-negro,#0b0b10)}
.wac-pasos{margin:0 0 16px;padding-left:20px;display:flex;flex-direction:column;gap:8px;font-size:13.5px;line-height:1.5;color:#374151}
</style>`);
})();
