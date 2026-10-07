/* ── Embudo automático (lote 5, maquetas aprobadas el 30-sep «Mejoras de la bandeja», tableros 1, 8 y 9) ──
   · Tablero 8, Ajustes del CRM › Conversaciones › «Embudo automático» (cfg-embudo-auto): el criterio de cada etapa por
     equipo, la etapa de pago fija (la pone Hotmart), «Mover las conversaciones con IA», «Solo avanzar», «Si no está
     segura, no la mueve» y «Hoy en {equipo}». La ven la configuración general y los líderes de cada equipo (solo los
     suyos). GET y PUT /crm/ia/embudo; en vivo con el evento ia-embudo.
   · Tablero 1, en el chat: el evento de la IA (ev 'ia' con iaEtapa) es la pastilla morada «La IA la pasó a ● Etapa: razón»
     con «Deshacer» (POST /crm/ia/embudo/deshacer/:id) mientras siga en esa etapa. Los eventos de Hotmart y de Deshacer
     salen como cualquier otro evento.
   · Tablero 9, en el Embudo: la tarjeta que movió la IA lleva «La IA la movió» y la que pasó a la etapa de pago por
     Hotmart dice «· Hotmart». La animación del tablero 9 es de otro lote.
   Envuelve chSuelto, pagina y paginaCfg (después de 62 y 63). Va dentro de una función para no dejar nombres sueltos en el
   ámbito que comparten todos los archivos del CRM; el CSS lleva «iae-». */
(() => {
  // El símbolo #i-ia lo pone 63-ia-sugerencias.js; si no estuviera, va aquí (las dos estrellas de la maqueta).
  const ESTRELLAS = '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>';
  const sprite = (document.querySelector('svg > symbol[id^="i-"]') || {}).parentNode;
  if (sprite && !sprite.querySelector('#i-ia')) sprite.insertAdjacentHTML('beforeend', `<symbol id="i-ia" viewBox="0 0 24 24">${ESTRELLAS}</symbol>`);
  const SVG = (d, cls = '') => `<svg viewBox="0 0 24 24" class="iae-svg${cls ? ' ' + cls : ''}" aria-hidden="true">${d}</svg>`;
  const VISTO_CIRCULO = '<circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>';
  const CANDADO = '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>';
  const ES_PAGO = /pagad/i;
  const SUB = 'Un agente IA lee cada conversación y la pasa a la etapa que va según lo que se habla. El pago lo confirma Hotmart. En la conversación queda la razón de cada cambio y se puede deshacer.';

  /* ── Estado: la configuración de los equipos que administra y lo de hoy ── */
  const IAE = {equipos: {}, hoy: {}, cargado: false, pidiendo: false, error: '', falloEn: 0};
  const DESHACIENDO = new Set();
  const lectura = () => typeof crmSoloLectura === 'function' && crmSoloLectura();
  const hayAlcance = () => typeof ALCANCE !== 'undefined';
  const administraTodo = () => hayAlcance() && !!(ALCANCE.config || ALCANCE.todo);
  const administra = eq => administraTodo() || (typeof puedeAdministrarEquipo === 'function' && puedeAdministrarEquipo(eq));
  const puede = () => administraTodo() || (typeof equiposAdministrables === 'function' && equiposAdministrables().length > 0);
  // Los equipos de la página, en el orden de la pantalla (los que vengan del API y no estén en EQUIPOS, al final).
  const equiposPg = () => { const k = Object.keys(IAE.equipos), orden = EQUIPOS.map(e => e.n).filter(n => k.includes(n)); return [...orden, ...k.filter(n => !orden.includes(n))]; };
  const conY = l => l.length > 1 ? `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}` : (l[0] || '');

  function aplicar(d, completo){
    if (!d || typeof d !== 'object') return;
    const toma = (destino, fuente) => {
      if (!fuente || typeof fuente !== 'object') return;
      if (completo) for (const k of Object.keys(destino)) delete destino[k];
      for (const [eq, v] of Object.entries(fuente)) if ((completo || administra(eq)) && v && typeof v === 'object') destino[eq] = v;
    };
    toma(IAE.equipos, d.equipos); toma(IAE.hoy, d.hoy);
  }
  function cargar(forzar){
    if (!puede() || IAE.pidiendo || (IAE.cargado && !forzar)) return;
    // Si falló hace poco, no se vuelve a pedir en cada pintado (sí al abrir la página).
    if (!forzar && IAE.error && Date.now() - IAE.falloEn < 60e3) return;
    IAE.pidiendo = true;
    crmApi('GET', '/crm/ia/embudo')
      .then(d => { aplicar(d, true); IAE.cargado = true; IAE.error = ''; }, err => { IAE.error = err.message || 'No se pudo cargar el embudo automático.'; IAE.falloEn = Date.now(); })
      .finally(() => { IAE.pidiendo = false; repintar(); });
  }
  // Repinta la página sin quitarle a la persona el campo donde está escribiendo (ni lo que lleva escrito).
  function repintar(){
    if (!(st.pagina === 'cfg-embudo-auto' || (st.pagina === 'ajustes' && st.ajTab === 'crm'))) return;
    const a = document.activeElement, k = a && a.dataset ? a.dataset.iaeCrit : undefined;
    const sel = k != null ? [a.selectionStart, a.selectionEnd, a.value] : null;
    render();
    if (k == null) return;
    const n = [...document.querySelectorAll('#page [data-iae-crit]')].find(x => x.dataset.iaeCrit === k);
    if (n) { n.value = sel[2]; n.focus(); try { n.setSelectionRange(sel[0], sel[1]); } catch { /* sin selección */ } crecer(n); }
  }
  crmListo.then(() => cargar());
  // Cambió su rol en un equipo: lo que administra puede ser otro.
  document.addEventListener('crm:alcance', () => { IAE.cargado = false; for (const k of Object.keys(IAE.equipos)) delete IAE.equipos[k]; cargar(true); });
  document.addEventListener('crm:evento', e => {
    const d = e.detail;
    if (!d || d.tipo !== 'ia-embudo' || !puede()) return;
    if (!IAE.cargado) { cargar(); return; }
    aplicar(d, false);   // 80-datos.js repinta después (y espera si alguien está escribiendo en un campo)
  });
  // Solo la configuración general y los líderes entran a la página (62-vistas-rol.js revisa cada pintado).
  if (typeof VR_PAGINAS === 'object' && VR_PAGINAS) VR_PAGINAS['cfg-embudo-auto'] = puede;

  /* ── Tablero 1: el evento de la IA en el chat, con Deshacer ── */
  const iaDeConv = c => { const x = c && c._iaEtapa; return x && typeof x === 'object' && typeof x.a === 'string' && x.a ? x : null; };
  const chSueltoBase = chSuelto;
  chSuelto = function(m){
    const x = m && m.ev && m.iaEtapa && typeof m.iaEtapa === 'object' ? m.iaEtapa : null;
    if (!x || !x.a) return chSueltoBase.apply(this, arguments);
    const c = CONV.find(y => y.id === st.sel), ie = iaDeConv(c), a = String(x.a);
    const deshacer = !!(c && ie && m._id && ie.msgId === m._id && !ie.deshecha && (c.etq || [])[0] === a && !lectura());
    const razon = typeof x.razon === 'string' && x.razon.trim() ? `: ${esc(x.razon.trim())}` : '';
    return `<div class="iae-evia">${I('ia')}<span>La IA la pasó a <i style="background:${colorOk(COL[a])}"></i> <b>${esc(a)}</b>${razon}</span>`
      + `${deshacer ? `<button type="button" class="iae-desh" data-iae-deshacer="${esc(m._id)}"${DESHACIENDO.has(c.id) ? ' disabled' : ''}>Deshacer</button>` : ''}</div>`;
  };
  document.getElementById('msgs').addEventListener('click', e => {
    const b = e.target instanceof Element ? e.target.closest('[data-iae-deshacer]') : null; if (!b) return;
    e.preventDefault();
    const c = CONV.find(x => x.id === st.sel); if (!c || DESHACIENDO.has(c.id)) return;
    if (lectura()) { toast(crmErrorSoloLectura().message); return; }
    DESHACIENDO.add(c.id); b.disabled = true;
    // La etapa nueva llega por el evento conv (no se toca aquí: 80-datos.js la mandaría de vuelta como un cambio).
    crmApi('POST', `/crm/ia/embudo/deshacer/${c.id}`)
      .then(r => { if (r && r._iaEtapa) c._iaEtapa = r._iaEtapa; }, err => toast(err.message))
      .finally(() => { DESHACIENDO.delete(c.id); if (st.sel === c.id) render(); });
  });

  /* ── Tablero 9: las tarjetas del Embudo ── */
  // La etapa es del contacto: se mira lo último que hizo la IA (o Hotmart) en cualquiera de sus conversaciones.
  function ultimoDelContacto(c, clave){
    const otras = c.contactoId ? CONV.filter(x => x.contactoId === c.contactoId) : [c];
    let mejor = null;
    for (const x of otras) { const v = x[clave]; if (v && typeof v === 'object' && (!mejor || String(v.en || '') > String(mejor.en || ''))) mejor = v; }
    return mejor;
  }
  const laMovioLaIA = c => { const x = ultimoDelContacto(c, '_iaEtapa'); return !!(x && x.a && !x.deshecha && (c.etq || [])[0] === x.a); };
  const porHotmart = c => { const x = ultimoDelContacto(c, '_pagoHotmart'); return !!(x && x.etapa && (c.etq || [])[0] === x.etapa); };
  function marcarTarjetas(){
    document.querySelectorAll('#page .kc[data-kc]').forEach(k => {
      const c = CONV.find(x => x.id === +k.dataset.kc); if (!c) return;
      const p = k.querySelector(':scope > p');
      // «· Hotmart» en su propio trozo, que nunca se recorta: si no cabe, se recorta el interés o la ciudad.
      if (p && porHotmart(c) && !p.dataset.iaeHm) {
        p.innerHTML = `<span class="iae-pt">${esc(p.textContent)}</span><span class="iae-hm"> · Hotmart</span>`;
        p.dataset.iaeHm = '1'; p.classList.add('iae-p');
      }
      if (laMovioLaIA(c) && !k.querySelector('.iae-ia')) k.insertAdjacentHTML('beforeend', `<span class="iae-ia">${I('ia')}La IA la movió</span>`);
    });
  }

  /* ── Ajustes del CRM: la tarjeta «Embudo automático» después de «Etapas del embudo» ── */
  function resumen(){
    if (!IAE.cargado) return IAE.error ? 'No se pudo cargar' : '';
    const on = equiposPg().filter(eq => IAE.equipos[eq] && IAE.equipos[eq].on);
    return on.length ? `La IA mueve las conversaciones en ${conY(on)}` : 'Apagado';
  }
  function tarjetaAjustes(){
    if (st.ajTab !== 'crm' || !puede()) return;
    const pg = document.getElementById('page'); if (pg.querySelector('.ajg [data-ir="cfg-embudo-auto"]')) return;
    const ref = pg.querySelector('.ajg .grid3 > button[data-ir="cfg-etapas"]') || pg.querySelector('.ajg .grid3 > button[data-ir="cfg-reparto"]');
    if (!ref) return;
    ref.insertAdjacentHTML('afterend', `<button type="button" data-ir="cfg-embudo-auto">${I('ia')}<span><b>Embudo automático</b><small>${esc(resumen())}</small></span></button>`);
    cargar();
  }

  /* ── Tablero 8: la página ── */
  function equipoElegido(){
    const l = equiposPg(); if (!l.length) return '';
    if (!l.includes(st.iaeEq)) st.iaeEq = l.includes('Ventas') ? 'Ventas' : l[0];
    return st.iaeEq;
  }
  function paginaEmbudoAuto(){
    const cab = `<button type="button" class="volver" data-ir="ajustes-crm">${I('back')}Ajustes del CRM</button><h2>Embudo automático</h2><p class="sub">${SUB}</p>`;
    const eq = equipoElegido();
    if (!eq) return `<div class="ajw ancho iae-pg">${cab}<p class="muted">${esc(IAE.error || (IAE.cargado ? 'Todavía no hay equipos en el CRM.' : 'Cargando…'))}</p></div>`;
    const cfg = IAE.equipos[eq], hoy = IAE.hoy[eq] || {movidas: 0, deshechas: 0, pagos: 0}, eqs = equiposPg();
    const tabs = eqs.length > 1 ? `<div class="iae-tabs" role="tablist" aria-label="Equipos">${eqs.map(n => `<button type="button" role="tab" class="iae-tab" data-iae-eq="${esc(n)}" aria-selected="${n === eq}"><i style="background:${colorEquipo(n)}"></i>${esc(n)}</button>`).join('')}</div>` : '';
    const etapas = etapasDe(eq);
    // La que pone Hotmart es la primera etapa de pago del equipo (la misma que usa el API); otra etapa de pago no la
    // pone nadie solo: la IA nunca entra ni sale de las etapas de pago.
    const pagoHotmart = (etapas.find(([n]) => ES_PAGO.test(n)) || [])[0];
    const filas = etapas.map(([n, col]) => {
      const nm = `<span class="iae-nm"><i style="background:${colorOk(col)}"></i>${esc(n)}</span>`;
      if (n === pagoHotmart) return `<div class="iae-eta">${nm}<div class="iae-fijo">${SVG(VISTO_CIRCULO, 'ok')}<span>Cuando se confirma el pago de ese cliente</span>${SVG(CANDADO)}</div></div>`;
      if (ES_PAGO.test(n)) return `<div class="iae-eta">${nm}<p class="iae-sin">Sin criterio, la IA no la pasa a esta etapa</p></div>`;
      const t = (cfg.criterios || {})[n] || '';
      return `<div class="iae-eta">${nm}<textarea class="iae-in" rows="1" data-iae-crit="${esc(n)}" maxlength="300" aria-label="Cuándo pasa a ${esc(n)}" placeholder="Sin criterio, la IA no la pasa a esta etapa">${esc(t)}</textarea></div>`;
    }).join('');
    const sw = (k, t, d) => `<div class="row2"><span><b>${t}</b><small>${d}</small></span><button type="button" class="tg" role="switch" data-iae-tg="${k}" aria-checked="${!!cfg[k]}" aria-label="${esc(t)}"></button></div>`;
    const dato = (t, n) => `<div class="row2"><span>${t}</span><b>${Number(n) || 0}</b></div>`;
    return `<div class="ajw ancho iae-pg">${cab}<div class="iae-grid">
      <div class="box2 iae-izq">${tabs}<div class="iae-tit">Cuándo pasa a cada etapa</div>
        <div class="iae-etapas">${filas || `<p class="muted">${esc(eq)} todavía no tiene etapas.</p>`}</div></div>
      <div class="iae-der">
        <div class="box2">${sw('on', 'Mover las conversaciones con IA', `En ${esc(eq)}`)}${sw('soloAvanzar', 'Solo avanzar', 'Nunca la devuelve a una etapa anterior')}${sw('seguro', 'Si no está segura, no la mueve', 'Deja la etapa como está')}</div>
        <div class="box2"><h4>Hoy en ${esc(eq)}</h4>${dato('Movidas por la IA', hoy.movidas)}${dato('Deshechas por el equipo', hoy.deshechas)}${dato('Pagos de Hotmart', hoy.pagos)}</div>
      </div></div></div>`;
  }
  const paginaCfgIae = paginaCfg;
  paginaCfg = function(k){ return k === 'embudo-auto' ? paginaEmbudoAuto() : paginaCfgIae.apply(this, arguments); };

  // El campo crece con el texto (sin barra ni tirador).
  function crecer(t){ t.style.height = 'auto'; t.style.height = `${t.scrollHeight + 2}px`; }

  // Envuelve pagina (después de 62-vistas-rol.js): Embudo, Ajustes del CRM y la página propia.
  let paginaAbierta = '';
  const paginaIae = pagina;
  pagina = function(){
    const r = paginaIae.apply(this, arguments);
    const p = st.pagina || '';
    if (p === 'embudo') marcarTarjetas();
    else if (p === 'ajustes') tarjetaAjustes();
    else if (p === 'cfg-embudo-auto') {
      document.querySelectorAll('#page [data-iae-crit]').forEach(crecer);
      // Al abrir se vuelve a pedir (lo de hoy pudo cambiar mientras no estaba aquí).
      if (paginaAbierta !== p) cargar(true);
    }
    paginaAbierta = p;
    return r;
  };

  /* ── Acciones de la página ── */
  async function guardar(eq, cambios){
    const d = await crmApi('PUT', `/crm/ia/embudo/${encodeURIComponent(eq)}`, cambios);
    aplicar(d, true); IAE.cargado = true;
    return d;
  }
  const pg = document.getElementById('page');
  pg.addEventListener('click', e => {
    if (st.pagina !== 'cfg-embudo-auto' || !(e.target instanceof Element)) return;
    const tab = e.target.closest('[data-iae-eq]');
    if (tab) { st.iaeEq = tab.dataset.iaeEq; repintar(); return; }
    const tg = e.target.closest('[data-iae-tg]'); if (!tg) return;
    const eq = equipoElegido(), cfg = IAE.equipos[eq], k = tg.dataset.iaeTg; if (!cfg) return;
    if (lectura()) { toast(crmErrorSoloLectura().message); return; }
    const antes = !!cfg[k]; cfg[k] = !antes; repintar(); toast(cfg[k] ? 'Activado' : 'Apagado');
    guardar(eq, {[k]: !antes}).catch(err => { if (IAE.equipos[eq]) IAE.equipos[eq][k] = antes; repintar(); toast(err.message); }).then(() => repintar());
  });
  pg.addEventListener('input', e => { if (e.target instanceof HTMLTextAreaElement && e.target.dataset.iaeCrit != null) crecer(e.target); });
  // Guarda al salir del campo, solo si cambió.
  pg.addEventListener('change', e => {
    const t = e.target; if (st.pagina !== 'cfg-embudo-auto' || !(t instanceof HTMLTextAreaElement) || t.dataset.iaeCrit == null) return;
    const eq = equipoElegido(), cfg = IAE.equipos[eq], n = t.dataset.iaeCrit; if (!cfg) return;
    const nuevo = t.value.replace(/\s+/g, ' ').trim(), antes = (cfg.criterios || {})[n] || '';
    if (nuevo === antes) return;
    if (lectura()) { t.value = antes; crecer(t); toast(crmErrorSoloLectura().message); return; }
    cfg.criterios = {...(cfg.criterios || {}), [n]: nuevo};
    guardar(eq, {criterios: {[n]: nuevo}}).then(() => toast('Guardado'), err => { if (IAE.equipos[eq]) IAE.equipos[eq].criterios = {...(IAE.equipos[eq].criterios || {}), [n]: antes}; toast(err.message); }).then(() => repintar());
  });

  /* ── Estilos (solo modo claro) ── */
  document.head.insertAdjacentHTML('beforeend', `<style>
/* Tablero 1: el evento de la IA en el chat. */
.iae-evia{align-self:center;display:flex;align-items:center;gap:8px;max-width:92%;padding:6px 12px;border-radius:999px;background:#f5f3ff;border:1px solid #e4defc;font-size:12.5px;line-height:1.5;color:#4c3a99}
.iae-evia > svg.i{width:15px;height:15px;color:#6d4fc2;flex:none}
.iae-evia > span{min-width:0;overflow-wrap:anywhere}
.iae-evia > span > i{font-style:normal;width:8px;height:8px;border-radius:50%;display:inline-block}
.iae-evia > span > b{font-weight:600}
.iae-desh{flex:none;margin-left:4px;font-size:12.5px;font-weight:500;color:var(--blue-ink)}
.iae-desh:hover{text-decoration:underline}
.iae-desh:disabled{opacity:.5;cursor:default;text-decoration:none}
/* Tablero 9: la tarjeta que movió la IA. */
#page .kc .iae-ia{display:inline-flex;align-items:center;gap:4px;justify-self:start;align-self:start;height:20px;padding:0 7px;border-radius:999px;background:#f5f3ff;color:#6d4fc2;font-size:11px;font-weight:500;line-height:1;white-space:nowrap}
#page .kc .iae-ia svg.i{width:11px;height:11px}
#page .kc p.iae-p{display:flex;min-width:0}
#page .kc p.iae-p .iae-pt{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#page .kc p.iae-p .iae-hm{flex:none;white-space:pre}
/* Tablero 8: la página. */
.iae-pg .iae-grid{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px;align-items:start}
.iae-pg .box2{gap:12px}
.iae-pg .iae-der{display:flex;flex-direction:column;gap:12px;min-width:0}
.iae-pg .row2 b{font-weight:600;display:block}
.iae-pg .row2 > span{min-width:0}
.iae-tabs{display:flex;gap:22px;border-bottom:1px solid var(--line)}
.iae-tab{padding:8px 2px 10px;font-size:13.5px;color:var(--ink3);display:flex;align-items:center;gap:8px;border-bottom:2px solid transparent;margin-bottom:-1px;line-height:1.5}
.iae-tab i{width:9px;height:9px;border-radius:50%;display:inline-block;flex:none}
.iae-tab[aria-selected="true"]{color:var(--blue-ink);border-bottom-color:var(--blue);font-weight:500}
.iae-tit{font-size:13px;font-weight:600;color:var(--ink2);margin-top:2px}
.iae-eta{display:grid;grid-template-columns:190px minmax(0,1fr);gap:14px;align-items:start;padding:12px 0;border-top:1px solid var(--line2)}
.iae-eta:first-child{border-top:0}
.iae-nm{display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:600;padding-top:8px;min-width:0;overflow-wrap:anywhere}
.iae-nm i{width:11px;height:11px;border-radius:50%;display:inline-block;flex:none}
.iae-in{display:block;width:100%;min-height:0;border:1px solid var(--line);border-radius:10px;padding:9px 12px;font:inherit;font-size:13px;font-weight:400;line-height:1.45;color:var(--ink);background:#fff;resize:none;overflow:hidden}
.iae-in::placeholder{color:var(--ink4)}
.iae-fijo{display:flex;align-items:center;gap:8px;padding:9px 12px;border:1px solid var(--line2);border-radius:10px;background:#f8fafc;font-size:13px;color:var(--ink2);line-height:1.45}
.iae-fijo > span{min-width:0}
.iae-sin{margin:0;padding:9px 0;font-size:13px;line-height:1.45;color:var(--ink4)}
.iae-svg{width:15px;height:15px;flex:none;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round;color:var(--ink4);margin-left:auto}
.iae-svg.ok{color:#15803d;margin-left:0}
@media (max-width:759.98px){
  .iae-evia{border-radius:14px;align-items:flex-start}
  .iae-evia > svg.i{margin-top:2px}
  .iae-pg .iae-grid{grid-template-columns:minmax(0,1fr)}
  .iae-eta{grid-template-columns:minmax(0,1fr);gap:8px}
  .iae-nm{padding-top:0}
  .iae-tabs{overflow-x:auto;overflow-y:hidden;scrollbar-width:none}
  .iae-tabs::-webkit-scrollbar{display:none}
  .iae-tab{flex:none;white-space:nowrap}
}
</style>`);
})();
