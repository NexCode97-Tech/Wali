/* ── IA de cada persona (lote 5, maquetas aprobadas el 30-sep «Mejoras de la bandeja», tableros 10 y 11) ──
   · Tablero 10: encima de la caja de escribir, «Sugerencia de tu IA · en tu forma de escribir» con Usar (la deja en la
     caja para editarla: NUNCA la envía), Otra, la X y «Tab para usar»; y el botón de destellos en la barra. Se pide sola
     cuando llega un mensaje del cliente en la conversación que la persona tiene en pantalla (si su IA está «Cuando llega
     un mensaje»), o con el botón. El API (POST /crm/ia/sugerencia) usa solo los mensajes de la conversación (nunca las
     notas privadas) y el perfil de esa persona; la sugerencia vuelve en la respuesta y no se guarda en ningún lado.
   · Tablero 11: Mis ajustes › Cómo trabajo › «Mi IA»: lo que aprendió de cómo escribe (solo lo ve su dueño), cuándo
     sugiere, la base de conocimiento, «Esta semana» y «Borrar lo que aprendió». Llega en vivo con el evento ia-mi.
   Sin clave de Claude o con el tope del día alcanzado el API responde null: no sale caja ni aviso. Va dentro de una
   función para no dejar nombres sueltos en el ámbito que comparten todos los archivos del CRM; el CSS lleva «ias-». */
(() => {
  // Las dos estrellas de la maqueta: símbolo #i-ia del sprite (también lo usa 64-ia-embudo.js para los eventos de la IA).
  const ESTRELLAS = '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>';
  const sprite = (document.querySelector('svg > symbol[id^="i-"]') || {}).parentNode;
  if (sprite && !sprite.querySelector('#i-ia')) sprite.insertAdjacentHTML('beforeend', `<symbol id="i-ia" viewBox="0 0 24 24">${ESTRELLAS}</symbol>`);
  const SVG = d => `<svg viewBox="0 0 24 24" class="ias-svg" aria-hidden="true">${d}</svg>`;
  const VISTO = '<path d="M5 12.5l4.5 4.5L19 7.5"/>', EQUIS = '<path d="M6 6l12 12M18 6L6 18"/>';

  /* ── Estado ── */
  let MIA = null, cargadaEn = 0;      // Mi IA de quien entra (GET /crm/ia/mi-ia y el evento ia-mi)
  const SUG = new Map();              // conversación → {id, texto}: la sugerencia a la vista
  const VISTAS = new Map();           // conversación → textos ya mostrados desde el último mensaje (para «Otra»)
  const USADA = new Map();            // conversación → {id, texto}: la que se puso en la caja con «Usar»
  const PIDIENDO = new Set(), REPETIR = new Set(), ESPERA = new Map();
  const MOSTRADAS = new Set();        // sugerencias ya contadas como mostradas (se cuentan cuando de verdad se ven)
  const GEN = new Map();              // conversación → vuelta: cambia con cada mensaje nuevo (una respuesta vieja no se pinta)
  const VISTOS = new Set(), FOTO = new Map();   // mensajes ya conocidos (para no confundir un cambio de estado con uno nuevo)

  const lectura = () => typeof crmSoloLectura === 'function' && crmSoloLectura();
  const encendida = () => !!(MIA && MIA.on) && !lectura();
  const sinChat = () => document.getElementById('app').classList.contains('sinchat');
  const enPantalla = c => !!c && c.id === st.sel && !st.pagina && !sinChat();
  // Con la ventana cerrada no se puede escribir texto libre (solo plantillas): ni botón ni sugerencia.
  const cerrada = c => !!c && /cerrada/i.test(c.ventana || '');

  /* ── La caja de la sugerencia (antes del cuadro de escribir) y el botón de la IA (antes de «Enviar») ── */
  const box = document.getElementById('box'), enviar = document.getElementById('enviar'), msgs = document.getElementById('msgs');
  const caja = document.createElement('div');
  caja.id = 'ias-sug'; caja.className = 'ias-sug'; caja.hidden = true; caja.setAttribute('role', 'region'); caja.setAttribute('aria-label', 'Sugerencia de tu IA');
  box.before(caja);
  const boton = document.createElement('button');
  boton.type = 'button'; boton.className = 't'; boton.id = 'b-ia'; boton.hidden = true;
  boton.setAttribute('aria-label', 'Pedir una sugerencia a tu IA'); boton.dataset.tip = 'Sugerencia de tu IA'; boton.innerHTML = I('ia');
  enviar.before(boton);

  const htmlCaja = (s, ocupada) => { const d = ocupada ? ' disabled' : '';
    return `<span class="ias-cab">${SVG(ESTRELLAS)}Sugerencia de tu IA<small>· en tu forma de escribir</small></span><p>${esc(s.texto)}</p>`
      + `<span class="ias-acc"><button type="button" class="ias-b ias-usar" data-ias="usar"${d}>${SVG(VISTO)}Usar</button><button type="button" class="ias-b" data-ias="otra"${d}>${SVG(ESTRELLAS)}Otra</button>`
      + `<button type="button" class="ias-b ias-x" data-ias="x" aria-label="Descartar"${d}>${SVG(EQUIS)}</button><kbd>Tab para usar</kbd></span>`; };
  // Lo que pasó con cada sugerencia (mostrada, usada, descartada, enviada): solo cuenta para las métricas de la prueba.
  const resultado = (id, accion, extra) => crmApi('POST', '/crm/ia/sugerencia/resultado', {id, accion, ...(extra || {})}).catch(() => {});
  // Si el chat estaba abajo del todo, sigue abajo cuando la caja aparece o cambia de alto.
  const pegadoAbajo = () => msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 48;
  function pintar(){
    const c = conv(), on = encendida() && st.modo !== 'n' && !cerrada(c);
    boton.hidden = !on;
    boton.classList.toggle('cm-on', !!c && PIDIENDO.has(c.id));
    if (c && enPantalla(c)) FOTO.set(c.id, new Set((c.msgs || []).map(m => m && m._id).filter(Boolean)));
    const s = on && enPantalla(c) ? SUG.get(c.id) : null;
    if (!s) { caja.hidden = true; caja._firma = ''; return; }
    const firma = `${c.id}|${s.id}|${PIDIENDO.has(c.id)}`;
    if (!caja.hidden && caja._firma === firma) return;
    const abajo = pegadoAbajo();
    caja.innerHTML = htmlCaja(s, PIDIENDO.has(c.id)); caja._firma = firma; caja.hidden = false;
    if (abajo) msgs.scrollTop = msgs.scrollHeight;
    if (!MOSTRADAS.has(s.id)) { MOSTRADAS.add(s.id); if (MOSTRADAS.size > 2000) MOSTRADAS.clear(); resultado(s.id, 'mostrada'); }
  }

  /* ── Pedir una sugerencia: sola al llegar un mensaje, con el botón o con «Otra» ── */
  async function pedir(c, origen, otraVez){
    if (!c || !encendida()) return;
    if (PIDIENDO.has(c.id)) { if (origen === 'mensaje') REPETIR.add(c.id); return; }
    const vistas = VISTAS.get(c.id) || [], otra = !!otraVez || (origen === 'boton' && vistas.length > 0), g = GEN.get(c.id) || 0;
    PIDIENDO.add(c.id); pintar();
    try {
      const r = await crmApi('POST', '/crm/ia/sugerencia', {convId: c.id, origen, ...(otra ? {otra: true, evitar: vistas.slice(-5)} : {})});
      const s = r && r.sugerencia;
      if (s && s.id && s.texto && encendida() && (GEN.get(c.id) || 0) === g) {
        SUG.set(c.id, {id: s.id, texto: s.texto});
        if (!vistas.includes(s.texto)) VISTAS.set(c.id, [...vistas, s.texto].slice(-5));
      }
    } catch (err) { if (origen === 'boton') toast(err.message); }   // lo automático no avisa nada
    finally {
      PIDIENDO.delete(c.id); pintar();
      if (REPETIR.delete(c.id)) automatica(c.id);
    }
  }
  // Lo automático: solo en la conversación en pantalla, abierta, con la ventana abierta, suya o sin asignar, sin agente IA
  // ni flujo atendiendo, y con su IA «Cuando llega un mensaje».
  const puedeSola = c => encendida() && MIA.cuando === 'mensaje' && enPantalla(c) && laVeo() && (c.est || 'abiertas') === 'abiertas'
    && !cerrada(c) && (!c.asigId || c.asigId === CRM_YO.id) && !c._agente && !c._flujo;
  function automatica(id){ const c = CONV.find(x => x.id === id); if (c && puedeSola(c)) pedir(c, 'mensaje', false); }
  // Espera 4 s sin mensajes nuevos por si el cliente manda varios seguidos: se pide una sola (cada pedido cuesta).
  function alEntrar(id){ clearTimeout(ESPERA.get(id)); ESPERA.set(id, setTimeout(() => { ESPERA.delete(id); automatica(id); }, 4000)); }
  // Salió un mensaje del equipo: la sugerencia que había ya no sirve. Si escribió el cliente, la que está a la vista se
  // queda hasta que llegue la nueva (con el tope alcanzado o «Solo cuando la pido» no llega otra y sigue igual).
  function otroMensaje(id){ GEN.set(id, (GEN.get(id) || 0) + 1); SUG.delete(id); VISTAS.delete(id); }
  function escribioCliente(id){ GEN.set(id, (GEN.get(id) || 0) + 1); const s = SUG.get(id); VISTAS.set(id, s ? [s.texto] : []); }

  /* ── Lo que se hace con la sugerencia ── */
  function usar(){
    const c = conv(), s = c && SUG.get(c.id); if (!s || PIDIENDO.has(c.id)) return;
    ta.value = s.texto; ta.dispatchEvent(new Event('input', {bubbles: true}));
    ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
    SUG.delete(c.id);
    // «Enviada» sale después de que el API ya contó «usada» (sin ella no cuenta).
    USADA.set(c.id, {id: s.id, texto: s.texto, p: resultado(s.id, 'usada')}); pintar();
  }
  function descartar(){ const c = conv(), s = c && SUG.get(c.id); if (!s) return; SUG.delete(c.id); resultado(s.id, 'descartada'); pintar(); }
  caja.addEventListener('click', e => {
    const b = e.target.closest('[data-ias]'); if (!b || b.disabled) return;
    const k = b.dataset.ias, c = conv();
    if (k === 'usar') usar(); else if (k === 'x') descartar(); else if (k === 'otra' && c) pedir(c, 'boton', true);
  });
  boton.addEventListener('click', () => { const c = conv(); if (c && !PIDIENDO.has(c.id)) pedir(c, 'boton', SUG.has(c.id)); });
  // Tab la usa con el foco en el mensaje, sin el menú de respuestas rápidas abierto y sin teclas de más.
  ta.addEventListener('keydown', e => {
    if (e.key !== 'Tab' || e.shiftKey || e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return;
    const c = conv();
    if (caja.hidden || !qr.hidden || !c || !SUG.has(c.id) || PIDIENDO.has(c.id)) return;
    e.preventDefault(); usar();
  });
  // Al enviar (en la captura, antes del envío de 10-nucleo.js, como 56-compositor.js): si salió el mensaje y la persona
  // había usado la sugerencia, se cuenta si salió tal cual. Salga lo que salga, la sugerencia de esa conversación se va.
  let envio = null;
  box.addEventListener('click', e => {
    if (!e.target.closest('#enviar')) return;
    const c = conv(); envio = c && st.modo !== 'n' ? {c, n: c.msgs.length, texto: ta.value.trim()} : null;
  }, true);
  enviar.addEventListener('click', () => {
    const x = envio; envio = null; if (!x || x.c.msgs.length <= x.n) return;
    const u = USADA.get(x.c.id);
    if (u) { USADA.delete(x.c.id); const sinCambios = x.texto === String(u.texto).trim(); Promise.resolve(u.p).then(() => resultado(u.id, 'enviada', {sinCambios})); }
    otroMensaje(x.c.id); pintar();
  });
  // Responder ↔ Nota privada (la clase nt del cuadro): en nota privada no se ve ni la caja ni el botón.
  new MutationObserver(() => pintar()).observe(box, {attributes: true, attributeFilter: ['class']});
  const chatIas = chat;
  chat = function(){ const r = chatIas.apply(this, arguments); pintar(); return r; };

  /* ── En vivo: un mensaje del cliente pide la sugerencia; uno del equipo la quita; ia-mi trae Mi IA ── */
  // Un aviso de estado (entregado, leído) vuelve a mandar el mismo mensaje: solo cuenta el que no se conocía.
  function esNuevo(id, m){
    const k = m && m._id; if (!k || VISTOS.has(k)) return false;
    VISTOS.add(k); if (VISTOS.size > 3000) VISTOS.clear();
    const f = FOTO.get(id); if (f && f.has(k)) return false;
    const t = Date.parse(m._t); return !t || Date.now() - t < 10 * 60e3;
  }
  document.addEventListener('crm:evento', e => {
    const d = e.detail || {};
    if (d.tipo === 'ia-mi') { if (d.miIa && typeof d.miIa === 'object') { MIA = d.miIa; if (!MIA.on) { SUG.clear(); VISTAS.clear(); } pintar(); } return; }
    if (d.tipo !== 'msg' || !d.msg || d.convId == null) return;
    const m = d.msg, id = d.convId;
    const entrante = m.in !== undefined && m.in !== null && d.por == null, saliente = m.out !== undefined && !m.prog && !m._prog;
    if (!entrante && !saliente) return;
    if (!esNuevo(id, m)) return;
    if (entrante) { escribioCliente(id); alEntrar(id); } else { otroMensaje(id); pintar(); }
  });

  /* ── Mi IA: se carga al entrar y se refresca al volver a la pestaña ── */
  function cargar(){
    cargadaEn = Date.now();
    return crmApi('GET', '/crm/ia/mi-ia').then(m => { if (m && typeof m === 'object') { MIA = m; pintar(); if (st.pagina === 'ajustes') render(); } }, () => {});
  }
  crmListo.then(cargar);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - cargadaEn > 5 * 60e3) cargar(); });

  /* ── Tablero 11: Mis ajustes › Mi IA ── */
  const CUANDO = [['mensaje', 'Cuando llega un mensaje'], ['pedir', 'Solo cuando la pido']];
  const num = n => Number(n || 0).toLocaleString('es-CO');
  const unir = L => L.length > 1 ? L.slice(0, -1).join(', ') + ' y ' + L[L.length - 1] : L[0] || '';
  // «Aprendió de 1 mensaje tuyo…» / «…de 1.284 mensajes tuyos…»; sin mensajes en los últimos 90 días, solo «Se actualiza cada noche.».
  const aprendioDe = n => { n = Number(n) || 0; return n > 0 ? `Aprendió de ${num(n)} ${n === 1 ? 'mensaje tuyo' : 'mensajes tuyos'} de los últimos 90 días. ` : ''; };
  function paginaMiIa(){
    const m = MIA, rasgos = Array.isArray(m.rasgos) ? m.rasgos : [], temas = (Array.isArray(m.temas) ? m.temas : []).slice(0, 3);
    const eqs = Array.isArray(m.equipos) ? m.equipos.filter(Boolean) : [], sem = m.semana || {};
    const sw = (k, t, d) => `<div class="row2"><span><b>${t}</b><small>${d}</small></span><button type="button" class="tg" role="switch" data-ias-tg="${k}" aria-checked="${!!m[k]}" aria-label="${esc(t)}"></button></div>`;
    return `<div class="ajw ancho ias-pag"><button type="button" class="volver" data-aj-ver="">${I('back')}Mis ajustes</button><h2>Mi IA</h2><p class="sub">Aprende de cómo escribes tú para sugerirte respuestas en el chat. Lo que aprende es solo tuyo: nadie más lo ve ni lo usa.</p>
      <div class="ias-mia"><div class="ias-col">
        <div class="box2"><h4>Lo que ha aprendido de ti</h4>${rasgos.length
          ? `<ul class="ias-apr">${rasgos.map(r => `<li>${I('ia')}<span>${esc(r)}</span></li>`).join('')}</ul><small class="ias-nota">${aprendioDe(m.mensajes90)}Se actualiza cada noche.</small>`
          : '<small class="ias-nota">Todavía no ha aprendido de tus mensajes. Aprende cada noche.</small>'}</div>
        ${temas.length ? `<div class="box2"><h4>Lo que más respondes</h4>${temas.map(x => `<div class="ias-frase"><span>${esc(x.t)}</span><small>${num(x.n)} ${Number(x.n) === 1 ? 'vez' : 'veces'}</small></div>`).join('')}</div>` : ''}
      </div><div class="ias-col">
        <div class="box2">${sw('on', 'Sugerirme respuestas', 'Salen encima de la caja de escribir')}<div class="fld">Cuándo${ddSel('data-ias-cuando', CUANDO, m.cuando === 'pedir' ? 'pedir' : 'mensaje')}</div>${sw('kb', 'Usar también la base de conocimiento', `Precios, horarios y datos de ${eqs.length ? esc(unir(eqs)) : 'tu equipo'}`)}</div>
        <div class="box2"><h4>Esta semana</h4><div class="row2"><span>Sugerencias usadas</span><b>${num(sem.usadas)}</b></div><div class="row2"><span>Usadas sin cambios</span><b>${num(sem.sinCambiosPct)} %</b></div></div>
        <button type="button" class="ias-borrar" data-ias-borrar="1">Borrar lo que aprendió</button>
      </div></div></div>`;
  }
  // La tarjeta al final de «Cómo trabajo» y, abierta (st.ajSec 'mia'), la sección con el marco de las demás: «‹ Mis
  // ajustes», título y subtítulo (59-celular-ajustes.js la reconoce así como sección abierta).
  function ajustes(){
    const pg = document.getElementById('page'), firma = pg.querySelector('.ajg [data-aj-ver="firma"]');
    if (!firma || !MIA) return;
    if (st.ajSec === 'mia') { pg.innerHTML = paginaMiIa(); return; }
    const g = firma.closest('.grid3'); if (!g || g.querySelector('[data-aj-ver="mia"]')) return;
    g.insertAdjacentHTML('beforeend', `<button type="button" data-aj-ver="mia">${I('ia')}<span><b>Mi IA</b><small>${MIA.on ? 'Sugerencias en tu forma de escribir' : 'Sugerencias apagadas'}</small></span></button>`);
  }
  const paginaIas = pagina;
  pagina = function(){
    const r = paginaIas.apply(this, arguments);
    if (st.pagina === 'ajustes') { try { ajustes(); } catch (err) { console.warn('[CRM] Mi IA', err); } }
    return r;
  };
  // Cada cambio se guarda con PUT /crm/ia/mi-ia; si no se puede, vuelve como estaba.
  function cambiar(cambios, aviso){
    if (lectura()) { toast(crmErrorSoloLectura().message); render(); return; }
    const antes = {...MIA};
    Object.assign(MIA, cambios); if (!MIA.on) { SUG.clear(); VISTAS.clear(); }
    render(); pintar(); toast(aviso);
    crmApi('PUT', '/crm/ia/mi-ia', cambios).then(m => { if (m && typeof m === 'object') { MIA = m; render(); pintar(); } },
      err => { MIA = antes; render(); pintar(); toast(err.message); });
  }
  document.getElementById('page').addEventListener('click', e => {
    const t = e.target instanceof Element ? e.target : null; if (!t || !MIA || st.pagina !== 'ajustes') return;
    const tg = t.closest('[data-ias-tg]');
    if (tg) { const k = tg.dataset.iasTg, v = !MIA[k]; cambiar({[k]: v}, `${tg.getAttribute('aria-label')}: ${v ? 'activado' : 'apagado'}`); return; }
    const cu = t.closest('[data-ias-cuando]');
    if (cu) { if (cu.dataset.iasCuando !== MIA.cuando) cambiar({cuando: cu.dataset.iasCuando}, 'Guardado'); else render(); return; }
    if (t.closest('[data-ias-borrar]')) {
      abrirDialogo(`<h3>Borrar lo que aprendió</h3><p>Tu IA olvida lo que aprendió de cómo escribes y vuelve a aprender desde esta noche.</p><div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" style="background:#dc2626;border-color:#dc2626" data-ias-borrar-ok="1">Borrar</button></div>`);
    }
  });
  document.getElementById('ov-x').addEventListener('click', e => {
    const b = e.target instanceof Element ? e.target.closest('[data-ias-borrar-ok]') : null; if (!b || b.disabled) return;
    if (lectura()) { cerrarDialogo(); toast(crmErrorSoloLectura().message); return; }
    b.disabled = true;
    crmApi('DELETE', '/crm/ia/mi-ia/aprendido').then(m => { if (m && typeof m === 'object') MIA = m; cerrarDialogo(); render(); toast('Se borró lo que aprendió'); },
      err => { b.disabled = false; toast(err.message); });
  });

  document.head.insertAdjacentHTML('beforeend', `<style>
.ias-svg{fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round;flex:none}
/* Tablero 10: la sugerencia encima de la caja de escribir */
.ias-sug{border:1px solid #e4defc;background:#f8f6ff;border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:8px;margin-top:10px;line-height:1.5}
.ias-cab{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#5b3fd6}
.ias-cab .ias-svg{width:14px;height:14px}
.ias-cab small{font-weight:400;color:#6b7280;font-size:11.5px}
.ias-sug p{margin:0;font-size:13.5px;line-height:1.5;color:#1f2937;white-space:pre-line;overflow-wrap:anywhere;max-height:30vh;overflow-y:auto}
.ias-acc{display:flex;align-items:center;gap:8px}
.ias-b{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:30px;padding:0 10px;border-radius:8px;border:1px solid #e5e9f0;background:#fff;font-size:12.5px;font-weight:500;color:#4b5563;white-space:nowrap}
.ias-b .ias-svg{width:16px;height:16px}
.ias-b:hover{background:#f3f6fa}
.ias-b.ias-usar{background:#6d4fc2;border-color:#6d4fc2;color:#fff}
.ias-b.ias-usar:hover{background:#5f43b3;border-color:#5f43b3}
.ias-b.ias-x{width:30px;padding:0}
.ias-b:disabled{opacity:.55;cursor:default}
.ias-acc kbd{margin-left:auto;font:500 11px Inter,sans-serif;color:#6b7280;border:1px solid #e5e9f0;border-bottom-width:2px;border-radius:5px;padding:1px 6px;background:#fff}
.box .bar button.t#b-ia,.box .bar button.t#b-ia:hover{color:#6d4fc2}
.box .bar button.t#b-ia.cm-on{background:#f5f3ff;color:#6d4fc2}
/* Tablero 11: Mis ajustes › Mi IA */
.ias-pag > .volver{margin-bottom:10px}
.ias-pag > .sub{margin-bottom:18px}
.ias-mia{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:16px;align-items:start;max-width:942px}
.ias-col{display:flex;flex-direction:column;gap:12px;min-width:0}
.ias-mia .box2{gap:12px}
.ias-mia .box2 h4{font-size:14px;font-weight:600}
.ias-mia .row2 b{font-weight:600;display:block}
.ias-mia .row2 small{font-size:12px;color:#6b7280}
.ias-mia .fld{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:600;color:#4b5563}
.ias-mia .fld .dsel{min-width:0!important}
.ias-mia .fld .sel{padding:8px 10px;border-radius:8px;font-weight:400;color:#1f2937}
.ias-mia .fld .sel svg{width:15px;height:15px}
.ias-apr{margin:0;padding:0;list-style:none;display:grid;gap:8px}
.ias-apr li{display:flex;align-items:flex-start;gap:8px;font-size:13.5px;line-height:1.45}
.ias-apr li svg.i{width:15px;height:15px;color:#6d4fc2;margin-top:3px}
.ias-nota{font-size:12px;color:#6b7280}
.ias-frase{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 12px;border:1px solid #eef1f5;border-radius:10px;font-size:13px}
.ias-frase small{color:#6b7280;font-size:12px;white-space:nowrap}
.ias-borrar{align-self:flex-start;display:inline-flex;align-items:center;justify-content:center;height:36px;padding:0 12px;border-radius:8px;border:1px solid #e5e9f0;background:#fff;font-size:13px;font-weight:500;color:#b91c1c;white-space:nowrap}
.ias-borrar:hover{background:#fef2f2}
/* Celular: sin teclado no hay «Tab para usar»; Mi IA en una sola columna */
@media (max-width:759.98px){
  .ias-acc kbd{display:none}
  #page .ias-mia{grid-template-columns:minmax(0,1fr);max-width:none}
}
</style>`);
})();
