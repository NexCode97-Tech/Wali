/* ── Encuesta al finalizar con el formulario de WhatsApp ──
   · Tablero 3, al finalizar: primero el motivo (40-ajustes.js) y después «Enviar la encuesta» con su interruptor; si no
     puede salir, el «why» ámbar con la razón (las mismas reglas del API, en el mismo orden); a la derecha, «Así le llega
     por WhatsApp» con el mensaje real y la fila «Responder encuesta», o «Esta vez no se envía encuesta». Al finalizar va
     el evento «Encuesta enviada por WhatsApp» con encuesta:true por la cola de mensajes de la conversación (después de
     «Finalizada por…»): el API lo atiende (routes/crmEncuesta.ts), manda el formulario y escribe el texto final.
   · Tablero 4, la respuesta en la conversación: la tarjeta «Respondió la encuesta» (envuelve chSuelto), con
     «Calificación baja» y el borde rojo si la atención es de 2 o menos y «Se avisó a…» si se avisó al líder.
   · Tablero 5, Informes: las pestañas «Conversaciones» (la página de siempre) y «Encuestas» (GET /crm/encuestas) con sus
     filtros, los indicadores, «Por asesor», «Atención por estrellas» y todas las respuestas. En vivo con el evento
     encuestas.
   · Tablero 7, Ajustes del CRM › Encuesta al finalizar: los interruptores, los días sin repetir por persona, los textos y
     la vista previa que cambia mientras se escribe. Se guarda en el ajuste cfg (clave encuesta) como el resto.
   El tablero 1 (el formulario dentro de WhatsApp) lo arma el API (services/crm/encuesta.ts) y el 6 (la campana) vive en
   la plataforma (NotificacionesButton.tsx). Envuelve paginaCfg, cfgTg, paginaInformes y chSuelto (después de 64). Va
   dentro de una función para no dejar nombres sueltos en el ámbito que comparten todos los archivos del CRM; el CSS
   lleva «enc-». */
(() => {
  /* ── Configuración: la misma normalización del API (cfgEncuesta) ── */
  const DEF = {
    on: true, dias: 30, aviso: true,
    msg: '¡Gracias por escribirnos, {{nombre}}! ¿Nos ayudas con dos preguntas sobre tu atención? Toma menos de un minuto.',
    p1: '¿Cómo te atendió {{asesor}}?',
    p2: 'Del 0 al 10, ¿qué tan probable es que recomiendes {{empresa}} a un amigo?',
    comentario: true,
    gracias: '¡Gracias por responder, {{nombre}}! Nos ayuda a mejorar.',
  };
  const TOPE = {msg: 600, p1: 30, p2: 200, gracias: 300};
  // Sin caracteres de control (menos los saltos de línea), con los saltos normalizados y sin espacios a los lados.
  const limpiar = (v, max) => typeof v !== 'string' ? '' : v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, max).trim();
  function encCfg(){
    const e = (typeof CFG === 'object' && CFG && CFG.encuesta && typeof CFG.encuesta === 'object') ? CFG.encuesta : {};
    const txt = k => limpiar(e[k], TOPE[k]) || DEF[k];
    const p2 = txt('p2');
    const d = Number(e.dias);
    return {
      on: e.on !== false, dias: Number.isInteger(d) && d >= 1 && d <= 365 ? d : DEF.dias, aviso: e.aviso !== false,
      msg: txt('msg'), p1: txt('p1'), p2, comentario: e.comentario !== false,
      // Sin valor guardado, el de defecto; vacío a propósito, no se manda gracias.
      gracias: e.gracias === undefined || e.gracias === null ? DEF.gracias : limpiar(e.gracias, TOPE.gracias),
    };
  }
  // Las variables de los textos. Una variable vacía se quita junto con la coma y los espacios de antes:
  // «¡Gracias por escribirnos, {{nombre}}!» sin nombre queda «¡Gracias por escribirnos!».
  function rellenar(t, vars){
    let s = String(t ?? '');
    for (const [k, v] of Object.entries(vars || {})) {
      const val = String(v ?? '').trim();
      s = val ? s.split(`{{${k}}}`).join(val) : s.replace(new RegExp(`\\s*,?\\s*\\{\\{${k}\\}\\}`, 'g'), '');
    }
    return s.replace(/[ \t]{2,}/g, ' ').trim();
  }
  const empresa = () => String((typeof ESPACIO === 'object' && ESPACIO && ESPACIO.nombre) || '').trim() || 'la empresa';
  // La primera palabra de un nombre, si tiene alguna letra (un número o un correo no es un nombre), como primeraPalabra
  // del API.
  const primera = s => { const p = String(s ?? '').trim().split(/\s+/)[0] || ''; return /\p{L}/u.test(p) && !p.includes('@') ? p : ''; };
  // El nombre del contacto: sin nombre, la pantalla muestra el teléfono o «Sin nombre», que no cuentan.
  const nombreDe = c => { const n = String((c && c.n) || '').trim(); return n === 'Sin nombre' ? '' : primera(n); };
  const marcado = v => v !== null && v !== undefined && v !== false && v !== '';
  const conY = l => l.length > 1 ? `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}` : (l[0] || '');
  const coma = v => String(Math.round(v * 10) / 10).replace('.', ',');
  const lectura = () => typeof crmSoloLectura === 'function' && crmSoloLectura();

  /* ── Íconos y CSS (los trazos de la maqueta) ── */
  const SVG = (d, cls = '') => `<svg viewBox="0 0 24 24" class="enc-svg${cls ? ' ' + cls : ''}" aria-hidden="true">${d}</svg>`;
  const ESTRELLA = '<path d="M12 3.2l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.5l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>';
  const VISTO_CIRCULO = '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>';
  const PORTAPAPELES = '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M8.5 10h7M8.5 14h7M8.5 18h4"/>';
  const CAMPANA = '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>';
  const SALIR = '<path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>';
  const estrellasEnc = n => `<span class="stars" aria-label="${n} de 5">${[1, 2, 3, 4, 5].map(i => `<svg viewBox="0 0 24 24" class="${i <= n ? 'on' : ''}" aria-hidden="true">${ESTRELLA}</svg>`).join('')}</span>`;
  // El globo de WhatsApp lleva Roboto, como en la maqueta (el resto del CRM va en Inter).
  if (!document.querySelector('link[data-enc-roboto]')) document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" data-enc-roboto="1" href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&display=swap">');
  document.head.insertAdjacentHTML('beforeend', `<style>
.enc-svg{fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round;flex:none}
/* El globo de WhatsApp (tableros 3 y 7) */
.enc-bi{align-self:flex-start;max-width:100%;background:#fff;border-radius:8px;border-top-left-radius:0;box-shadow:0 1px .5px rgba(11,20,26,.13);font:13px/1.42 Roboto,system-ui,sans-serif;color:#111b21}
.enc-tx{padding:6px 9px 5px}
.enc-t{white-space:pre-wrap;overflow-wrap:anywhere}
.enc-hr{display:flex;justify-content:flex-end;align-items:center;gap:3px;font-size:10.5px;color:#667781;margin-top:1px}
.enc-cta{display:flex;align-items:center;justify-content:center;gap:7px;height:38px;border-top:1px solid #e9edef;color:#027eb5;font-size:14px;font-weight:500}
.enc-cta svg{width:17px;height:17px}
/* Tablero 3: el diálogo de finalizar */
#ov-res .res .sw{margin-top:2px}
#ov-res .res > .phone.enc-pv .hd{font-size:11.5px;color:var(--ink3);text-align:center;margin:0}
#ov-res .enc-nada{margin:auto 0;text-align:center;font-size:12.5px;color:var(--ink3)}
@media (min-width:760.02px){
  #ov-res .res > .phone.enc-pv{background:#efeae2;padding:18px 14px;display:flex;flex-direction:column;gap:10px}
  #ov-res .res .opt > .dsel{min-width:210px!important}
}
/* Tablero 4: la tarjeta de la respuesta (a todo el ancho del chat, como la maqueta) y los eventos de finalizar y de la
   encuesta como la pastilla gris del tablero */
.csat.enc-csat{width:100%}
.enc-ev{align-self:center;display:flex;align-items:center;gap:7px;font-size:12px;color:var(--ink3);background:var(--bg3);border-radius:999px;padding:4px 12px;max-width:94%;text-align:center}
.enc-ev svg{width:14px;height:14px}
.csat.enc-csat .t svg{width:15px;height:15px;color:#d97706}
.csat.enc-csat .t small{margin-left:auto;font-weight:400;font-size:11.5px;color:var(--ink4)}
.csat.enc-csat .r{align-items:center}
.csat.enc-csat .r > span:last-child{display:inline-flex;align-items:center;gap:6px}
.csat.enc-csat .r b{font-weight:600}
.csat.enc-csat q{quotes:"«" "»"}
.csat.enc-csat.baja{border-color:#fecaca}
.enc-chip{display:inline-flex;align-items:center;height:20px;padding:0 8px;border-radius:999px;background:var(--red-soft);color:var(--red-ink);font-size:11.5px;font-weight:500}
.enc-avl{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--ink3);border-top:1px solid var(--line2);padding-top:8px}
.enc-avl svg{width:14px;height:14px;color:var(--red-ink)}
/* Tablero 5: Informes */
.enc-tabs{display:flex;gap:20px;border-bottom:1px solid var(--line);margin:8px 0 16px}
.enc-tabs button{padding:6px 0 10px;font-size:13.5px;color:var(--ink3);border-bottom:2px solid transparent;margin-bottom:-1px;border-radius:0}
.enc-tabs button[aria-selected="true"]{color:var(--blue-ink);border-bottom-color:var(--blue);font-weight:500}
.enc-filtros{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:16px}
.enc-filtros .dsel{min-width:0!important}
.enc-filtros .sel{width:auto;color:var(--ink);white-space:nowrap}
.enc-filtros .dsel .menu{width:auto!important;min-width:100%;white-space:nowrap}
.enc-inf .kpis{margin-bottom:16px}
.enc-inf .kpi small{color:var(--ink3)}
.enc-inf .kpi small.ok{color:var(--green-ink)}
.enc-inf .kpi small.mal{color:var(--red-ink)}
.enc-inf .card{padding:16px 18px}
.enc-inf .card h3{margin:0 0 8px;font-size:14px;font-weight:600;display:flex;align-items:center;gap:8px}
.enc-inf .card h3 small{margin-left:auto;font-size:12.5px;font-weight:400;color:var(--ink3)}
.enc-dos{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(0,1fr);gap:12px;margin-bottom:16px}
.enc-tb th{font-weight:600;color:var(--ink2);white-space:nowrap}
.enc-tb td{font-weight:400;vertical-align:middle;white-space:nowrap}
.enc-tb tr:last-child td{border-bottom:0}
.enc-tb .num{text-align:right}
.enc-tb td.com{white-space:normal;color:var(--ink2);min-width:260px}
.enc-tb .muted{color:var(--ink4)}
.enc-tb .coma{margin-left:6px}
.enc-tb td.vacia{color:var(--ink3);white-space:normal}
.enc-ver{display:inline-flex;align-items:center;gap:5px;color:var(--blue-ink);font-size:12.5px;font-weight:500;white-space:nowrap}
.enc-ver svg{width:14px;height:14px}
.enc-barras{display:grid;gap:12px;margin-top:6px}
.enc-barras > div{display:grid;grid-template-columns:78px minmax(0,1fr) 24px;gap:12px;align-items:center;font-size:12.5px;color:var(--ink2)}
.enc-barras .fondo{height:8px;border-radius:4px;background:var(--bg3);display:block;overflow:hidden}
.enc-barras .fondo i{display:block;height:8px;border-radius:4px;background:#f59e0b}
.enc-barras em{font-style:normal;text-align:right;font-variant-numeric:tabular-nums;color:var(--ink)}
.enc-mas{display:flex;justify-content:center;margin-top:12px}
/* Tablero 7: Ajustes del CRM › Encuesta al finalizar */
.ajw.ancho.enc-aj{max-width:1064px}
.enc-aj2{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:16px;align-items:start}
.enc-aj .box2{gap:12px}
.enc-aj .row2 b{font-weight:600;display:block}
.enc-aj .row2 > .dsel{min-width:140px!important}
.enc-aj .fld{font-weight:600}
.enc-aj .fld :is(input,textarea){line-height:1.45}
.enc-aj .fld textarea{min-height:62px;resize:vertical}
.enc-ph2{border:1px solid var(--line);border-radius:22px;padding:16px 12px;background:#efeae2;display:flex;flex-direction:column;gap:10px}
.enc-ph2 .hd{font-size:11.5px;color:var(--ink3);text-align:center}
@media (max-width:759.98px){
  .enc-filtros{flex-direction:column}
  .enc-filtros .dsel{width:100%}
  .enc-filtros .sel{width:100%}
  .enc-dos{grid-template-columns:minmax(0,1fr)}
  .enc-dos > *,.enc-inf > .card{min-width:0}
  .enc-aj2{grid-template-columns:minmax(0,1fr)}
  .enc-aj2 > *{min-width:0}
}
</style>`);
  const globo = t => `<div class="enc-bi"><div class="enc-tx"><span class="enc-t">${esc(t)}</span><span class="enc-hr">ahora</span></div><div class="enc-cta">${SVG(PORTAPAPELES)}Responder encuesta</div></div>`;

  /* ── El formulario de cada línea (GET /crm/encuesta y el evento encuesta-formularios) ── */
  const FORM = {};   // {[lineaId]: {estado: 'listo' | 'preparando' | 'error' | 'pendiente', error, reintento}}
  function ponerFormularios(f){ if (f && typeof f === 'object' && !Array.isArray(f)) for (const [id, v] of Object.entries(f)) if (v && typeof v === 'object') FORM[id] = v; }
  // ¿El API ya tiene la encuesta con el formulario? Hasta que GET /crm/encuesta responda, finalizar sigue como antes
  // (10-nucleo.js, la encuesta de texto): si la página se publica antes que el API, la encuesta no se pierde.
  let ENC_API = false;
  function cargarFormularios(){ crmApi('GET', '/crm/encuesta').then(d => { ENC_API = true; ponerFormularios(d && d.formularios); recalcular(); }, () => { /* sin respuesta, la encuesta de texto de antes */ }); }
  crmListo.then(cargarFormularios);

  /* ── ¿Puede salir? Las reglas del API (enviarEncuesta), en el mismo orden; la primera que falla es la razón ── */
  function whyDias(ult, dias){
    const n = Math.max(0, hcDias(ult)), p = hcPartes(ult + dias * 864e5);
    const fecha = `${p.d} de ${HC_MES_L[p.m]}${p.y !== hcPartes(Date.now()).y ? ' de ' + p.y : ''}`;
    return `Ya se le envió una encuesta ${n === 0 ? 'hoy' : n === 1 ? 'hace 1 día' : `hace ${n} días`}. Para no cansarla, la próxima puede salir desde el ${fecha}.`;
  }
  function encPuede(c){
    const e = encCfg(), no = why => ({puede: false, why});
    if (!e.on) return no('La encuesta está apagada en Ajustes del CRM.');
    if ((c.canal || 'wa') !== 'wa') return no('La encuesta sale solo por WhatsApp.');
    if (!c.linea || !LINEAS.some(l => l.id === c.linea)) return no('La conversación no tiene una línea de WhatsApp conectada.');
    if (String(c.tel || '').replace(/\D/g, '').length < 7) return no('El contacto no tiene número de WhatsApp.');
    if (marcado(c.noContactar)) return no('Pidió no ser contactado: no se le manda la encuesta.');
    if (!c.asig && !c.asigId) return no('La conversación no tiene asesor asignado: no hay a quién calificar.');
    if (/cerrada/i.test(c.ventana || '')) return no('No se puede enviar: pasaron más de 24 horas desde su último mensaje. La encuesta sale solo con la conversación abierta, así no cuesta nada.');
    const ult = Date.parse(c._encuestaUltima || '');
    // Días de calendario en Colombia, como el texto («desde el 17 de octubre») y el API (bloqueanDias).
    if (ult && Math.max(0, hcDias(ult)) < e.dias) return no(whyDias(ult, e.dias));
    const f = FORM[c.linea];
    if (f && f.estado === 'error' && Date.parse(f.reintento || '') > Date.now()) return no(`La encuesta todavía no está lista en WhatsApp para esta línea: ${String(f.error || 'Meta no aceptó el formulario').trim().replace(/\.+$/, '')}.`);
    return {puede: true, why: ''};
  }
  const textoMsg = c => rellenar(encCfg().msg, {nombre: nombreDe(c), asesor: primera(c.asig), empresa: empresa()});

  /* ── Tablero 3: el diálogo de finalizar ── */
  const ovRes = document.getElementById('ov-res');
  // El panel de la derecha tal como viene en crm.html: el diálogo de texto de antes (otros canales) lo necesita así.
  const PHONE_ORIG = (ovRes.querySelector('.res > .phone') || {}).innerHTML || '';
  function restaurarPrevia(){
    const ph = ovRes.querySelector('.res > .phone'); if (!ph || !ph.classList.contains('enc-pv')) return;
    const html = (document.getElementById('res-prev') || {}).innerHTML || '';   // lo que acaba de poner abrirFinalizar
    ph.classList.remove('enc-pv'); ph.innerHTML = PHONE_ORIG;
    const p = document.getElementById('res-prev'); if (p) p.innerHTML = html;
  }
  const okTxt = () => I('check') + (st.resEnc ? 'Finalizar y enviar encuesta' : 'Finalizar');
  function opcionEncuesta(c){
    const r = encPuede(c), on = r.puede && !!st.resEnc;
    return `<div class="opt" id="enc-res-opt"><div><b>Enviar la encuesta</b><span>Le llega por WhatsApp: cómo la atendió ${esc(primera(c.asig) || 'su asesor')} y si recomendaría ${esc(empresa())}.</span></div><button type="button" class="sw" id="res-sw" role="switch" aria-checked="${on}" ${r.puede ? '' : 'disabled'} aria-label="Enviar la encuesta"></button></div>`
      + (r.puede ? '' : `<div class="why" id="enc-res-why">${esc(r.why)}</div>`);
  }
  // El panel de la derecha: lo que de verdad le llega, o que esta vez no sale. #res-prev se queda (10-nucleo.js lo llena
  // al abrir), escondido.
  function pintarPrevia(c){
    const ph = ovRes.querySelector('.res > .phone'); if (!ph) return;
    ph.classList.add('enc-pv');
    const sale = encPuede(c).puede && !!st.resEnc;
    ph.innerHTML = `<div class="hd">Así le llega por WhatsApp</div>${sale ? globo(textoMsg(c)) : '<p class="enc-nada">Esta vez no se envía encuesta</p>'}<div id="res-prev" hidden></div>`;
  }
  // La encuesta de texto de siempre en los otros canales: el diálogo de 10-nucleo.js decía «por WhatsApp» y la empresa
  // fija aunque la conversación fuera de Instagram o del correo. Dice el canal de verdad y el nombre del espacio.
  const CANAL_TXT = {web: 'el chat de la web', mail: 'correo'};
  function textoOtroCanal(c){
    const sw = document.getElementById('res-sw'), span = sw && sw.closest('.opt') && sw.closest('.opt').querySelector('div > span'); if (!span) return;
    const canal = CANAL_TXT[c.canal] || (CANALES[c.canal] || {}).n || 'su canal';
    span.textContent = `Dos preguntas por ${canal}: cómo lo atendió ${primera(c.asig) || 'su asesor'} y si recomendaría a ${empresa()}. La respuesta queda en la conversación y en Informes.`;
  }
  // Después de abrirFinalizar (10-nucleo.js) y del motivo (40-ajustes.js): el diálogo se rearma en el orden del tablero.
  document.getElementById('cerrar').addEventListener('click', () => {
    const c = conv(), b = document.getElementById('res-b'); if (!c || !b || ovRes.hidden) return;
    st.encDlg = null; st.encPedida = null;
    // Los canales que no son WhatsApp no tienen formulario: siguen con la encuesta de texto de siempre (10-nucleo.js).
    // Lo mismo si el API todavía no tiene la encuesta nueva (se vuelve a preguntar para la próxima vez).
    if ((c.canal || 'wa') !== 'wa') { restaurarPrevia(); textoOtroCanal(c); return; }
    if (!ENC_API) { restaurarPrevia(); cargarFormularios(); return; }
    st.encDlg = c.id; st.encApagada = false;
    st.resEnc = encPuede(c).puede;
    b.innerHTML = `<div class="res-cab"><h3>Finalizar la conversación</h3><p>Con ${esc(c.n)}</p><button type="button" class="dlg-cerrar" id="res-x" aria-label="Cerrar">${I('x')}</button></div>
      <div class="opt">Motivo del cierre</div>${opcionEncuesta(c)}
      <div class="ft"><button type="button" class="btn" id="res-x">Cancelar</button><button type="button" class="btn pri" id="res-ok">${okTxt()}</button></div>`;
    if (typeof pintarMotivo === 'function') pintarMotivo();
    pintarPrevia(c);
  });
  // Llegó algo mientras el diálogo está abierto (la conversación, el formulario de la línea, la configuración): se
  // recalculan el interruptor, el «why» y el panel, sin prender lo que la persona apagó.
  function recalcular(){
    if (ovRes.hidden || st.encDlg == null || st.sel !== st.encDlg) return;
    const c = CONV.find(x => x.id === st.encDlg), op = document.getElementById('enc-res-opt'); if (!c || !op) return;
    st.resEnc = encPuede(c).puede && !st.encApagada;
    const why = document.getElementById('enc-res-why'); if (why) why.remove();
    op.insertAdjacentHTML('beforebegin', opcionEncuesta(c)); op.remove();
    const ok = document.getElementById('res-ok'); if (ok) ok.innerHTML = okTxt();
    pintarPrevia(c);
  }
  // Captura (después de la de 40-ajustes.js, que frena si falta el motivo): se decide si sale y se apaga st.resEnc para que
  // 10-nucleo.js no meta la encuesta de texto de antes.
  ovRes.addEventListener('click', e => {
    if (!e.target.closest('#res-ok')) return;
    if (typeof CVCFG === 'object' && CVCFG && CVCFG.motivo && !st.resMot) return;
    const c = conv(); if (!c || st.encDlg !== c.id) return;
    st.encPedida = st.resEnc && encPuede(c).puede ? c.id : null;
    st.resEnc = false;
  }, true);
  // Burbuja (después de los de 10-nucleo.js, que ya metieron «Finalizada por…»): el evento de la encuesta va detrás, por
  // la misma cola, y el PATCH de finalizar sale cuando terminan los dos (80-datos.js).
  ovRes.addEventListener('click', e => {
    if (e.target.closest('#res-sw')) { const c = CONV.find(x => x.id === st.encDlg); if (c) { st.encApagada = !st.resEnc; pintarPrevia(c); } return; }
    if (!e.target.closest('#res-ok') || st.encPedida == null) return;
    const c = CONV.find(x => x.id === st.encPedida); st.encPedida = null; st.encDlg = null; if (!c) return;
    c.msgs.push({ev: 'star', t: 'Encuesta enviada por WhatsApp', encuesta: true});
    if (st.sel === c.id) chat();
    toast('Conversación finalizada. La encuesta sale por WhatsApp.');
    crmSincronizar();
  });

  /* ── Tablero 4: la tarjeta de la respuesta en la conversación ── */
  // Las respuestas de texto de antes pueden traer un solo número («9»): el dato que falta no se pinta (no es un 0).
  const nota = (v, max) => { if (v === null || v === undefined || v === '') return null; const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : null; };
  function tarjeta(m){
    const x = m.csat || {}, aten = nota(x.aten, 5), nps = nota(x.nps, 10), baja = aten != null && aten > 0 && aten <= 2;
    const av = Array.isArray(x.avisados) ? x.avisados.filter(s => typeof s === 'string' && s.trim()).map(s => s.trim()) : [];
    const varios = av.length > 1, eq = typeof x.avisoEquipo === 'string' && x.avisoEquipo.trim() ? x.avisoEquipo.trim() : '';
    const aviso = av.length ? `Se avisó a ${conY(av)}, ${eq ? `${varios ? 'líderes' : 'líder'} de ${eq}` : `${varios ? 'administradores' : 'administrador'} del CRM`}` : '';
    const com = typeof x.com === 'string' ? x.com.trim() : '';
    return `<div class="csat enc-csat${baja ? ' baja' : ''}"><div class="t">${SVG(ESTRELLA)}Respondió la encuesta${baja ? '<span class="enc-chip">Calificación baja</span>' : ''}${m._id && m.h ? `<small>${esc(m.h)}</small>` : ''}</div>`
      + (aten != null ? `<div class="r"><span>Atención de ${esc(primera(x.asesor) || 'su asesor')}</span><span>${estrellasEnc(aten)}<b>${aten} de 5</b></span></div>` : '')
      + (nps != null ? `<div class="r"><span>Recomendaría ${esc(empresa())}</span><span><span class="nps ${npsCls(nps)}">${nps}</span></span></div>` : '')
      + `${com ? `<q>${esc(com)}</q>` : ''}${aviso ? `<div class="enc-avl">${SVG(CAMPANA)}<span>${esc(aviso)}</span></div>` : ''}</div>`;
  }
  // Los eventos del tablero 4 («Finalizada por…» y el de la encuesta) van como la pastilla gris de la maqueta.
  const evEnc = m => !!(m && m.ev && ((m.ev === 'star' && (m.encuesta || /^(Encuesta enviada por WhatsApp|La encuesta no salió|Encuesta de satisfacción enviada)/.test(m.t || ''))) || (m.ev === 'check' && /^Finalizada por /.test(m.t || ''))));
  const chSueltoEnc = chSuelto;
  chSuelto = function(m){
    if (m && m.csat && typeof m.csat === 'object') return tarjeta(m);
    if (evEnc(m)) return `<div class="enc-ev">${SVG(m.ev === 'check' ? VISTO_CIRCULO : ESTRELLA)}<span>${esc(m.t)}</span></div>`;
    return chSueltoEnc.apply(this, arguments);
  };
  // El diálogo de conversaciones anteriores (data-prev-conv, 10-nucleo.js) pinta con burbuja: la misma tarjeta.
  const burbujaEnc = burbuja;
  burbuja = function(m){ return m && m.csat && typeof m.csat === 'object' ? tarjeta(m) : burbujaEnc.apply(this, arguments); };
  // La encuesta de texto de antes (canales que no son WhatsApp), el mismo texto de 10-nucleo.js, pero con las preguntas
  // normalizadas (encCfg: si cfg.encuesta no trae p1 o p2, el defecto, y antes el diálogo de finalizar no abría) y con
  // {{nombre}}, {{asesor}} y {{empresa}} llenos: nunca sale una variable sin llenar.
  encuestaTexto = function(c){
    const e = encCfg(), v = {nombre: nombreDe(c), asesor: primera(c && c.asig) || 'tu asesor', empresa: empresa()};
    return `¡Gracias por escribirnos! ¿Nos ayudas con dos preguntas? Toma menos de un minuto.\n\n1. ${rellenar(e.p1, v)} Responde con un número del 1 al 5.\n2. ${rellenar(e.p2, v)} Responde con un número del 0 al 10.\n\nSi quieres, cuéntanos algo más en otro mensaje.`;
  };

  /* ── Tablero 5: Informes › Encuestas ── */
  st.infTab = st.infTab || 'conv';
  const INF = {dias: '30', equipo: '', asesor: '', resp: 'todas', limite: 20, datos: null, clave: '', en: 0, pidiendo: false, otra: false, falla: 0, timer: null};
  const claveInf = () => [INF.dias, INF.equipo, INF.asesor, INF.resp, INF.limite].join('|');
  const enEncuestas = () => st.pagina === 'informes' && st.infTab === 'enc';
  // Repinta la pestaña sin cerrarle a la persona un desplegable abierto (espera a que lo cierre).
  function repintarInf(){
    if (!enEncuestas()) return;
    if (document.querySelector('#page .menu:not([hidden])')) { clearTimeout(INF.espera); INF.espera = setTimeout(repintarInf, 500); return; }
    render();
  }
  function pedirInf(){
    if (INF.pidiendo) { INF.otra = true; return; }
    INF.pidiendo = true; INF.otra = false;
    const clave = claveInf(), q = new URLSearchParams({dias: INF.dias, equipo: INF.equipo, asesor: INF.asesor, respuestas: INF.resp, limite: String(INF.limite)});
    crmApi('GET', '/crm/encuestas?' + q.toString())
      .then(d => { if (clave === claveInf()) { INF.datos = d && typeof d === 'object' ? d : null; INF.clave = clave; INF.en = Date.now(); } },
        err => { INF.falla = Date.now(); if (enEncuestas()) toast(err.message); })
      .finally(() => { INF.pidiendo = false; if (INF.otra || clave !== claveInf()) { pedirInf(); return; } repintarInf(); });
  }
  // Una encuesta se envió, se respondió o no llegó: con la pestaña abierta se vuelve a pedir con los mismos filtros.
  function infEnVivo(){
    INF.en = 0;
    if (!enEncuestas()) return;
    clearTimeout(INF.timer); INF.timer = setTimeout(pedirInf, 800);
  }
  const pestanas = enc => `<div class="enc-tabs" role="tablist"><button type="button" role="tab" aria-selected="${!enc}" data-enc-tab="conv">Conversaciones</button><button type="button" role="tab" aria-selected="${enc}" data-enc-tab="enc">Encuestas</button></div>`;
  function fechaInf(t){
    const d = hcDias(t), p = hcPartes(t), h = hcHora(t);
    if (d === 0) return `Hoy, ${h}`;
    if (d === 1) return `Ayer, ${h}`;
    return `${p.d} ${HC_MES[p.m].replace('.', '')}${p.y !== hcPartes(Date.now()).y ? ' ' + p.y : ''}, ${h}`;
  }
  const signo = n => `${n > 0 ? '+' : ''}${Math.round(n)}`;
  const npsAsesorCls = n => n >= 50 ? 'p' : n >= 30 ? 'n' : 'd';
  function paginaEncuestas(el){
    const d = INF.datos || {}, k = d.kpis || {}, op = d.opciones || {};
    if (!INF.pidiendo && (INF.clave !== claveInf() || !INF.datos || Date.now() - INF.en > 60e3) && Date.now() - INF.falla > 30e3) pedirInf();
    const num = v => Number(v) || 0;
    const eqs = (Array.isArray(op.equipos) ? op.equipos : []).filter(x => typeof x === 'string');
    const ases = (Array.isArray(op.asesores) ? op.asesores : []).filter(x => x && x.id);
    const filtros = `<div class="enc-filtros">${ddSel('data-enc-dias', [['7', 'Últimos 7 días'], ['30', 'Últimos 30 días'], ['90', 'Últimos 90 días']], INF.dias)}`
      + `${ddSel('data-enc-eq', [['', 'Todos los equipos'], ...eqs.map(n => [n, n])], INF.equipo, 'Todos los equipos')}`
      + `${ddSel('data-enc-ase', [['', 'Todos los asesores'], ...ases.map(a => [String(a.id), String(a.nombre || '')])], INF.asesor, 'Todos los asesores')}`
      + `${ddSel('data-enc-resp', [['todas', 'Todas las respuestas'], ['bajas', 'Calificaciones bajas'], ['comentario', 'Con comentario']], INF.resp)}</div>`;
    const env = num(k.enviadas), resp = num(k.respondidas), nAt = num(k.nAtencion), bajas = num(k.bajas), hay = !!INF.datos;
    const kpis = `<div class="kpis"><div class="kpi"><span>Respondieron</span><b>${env ? Math.min(100, num(k.pctRespondieron)) + ' %' : '—'}</b><small>${resp.toLocaleString('es-CO')} de ${env.toLocaleString('es-CO')} encuestas</small></div>`
      + `<div class="kpi"><span>Atención de los asesores</span><b>${nAt && k.atencion != null ? coma(k.atencion) + ' de 5' : '—'}</b><small>${nAt ? `promedio de ${nAt.toLocaleString('es-CO')} ${nAt === 1 ? 'respuesta' : 'respuestas'}` : 'sin respuestas todavía'}</small></div>`
      + `<div class="kpi"><span>NPS de ${esc(empresa())}</span><b>${resp && k.nps != null ? signo(k.nps) : '—'}</b>${resp && k.nps != null ? `<small class="ok">${Math.round(num(k.promotores))} % promotores · ${Math.round(num(k.detractores))} % detractores</small>` : '<small>sin respuestas todavía</small>'}</div>`
      + `<div class="kpi"><span>Calificaciones bajas</span><b>${bajas.toLocaleString('es-CO')}</b><small class="${bajas ? 'mal' : ''}">2 de 5 o menos${bajas && num(k.bajasLider) >= bajas ? ' · se avisó al líder' : ''}</small></div></div>`;
    const filas = (Array.isArray(d.porAsesor) ? d.porAsesor : []).filter(r => r && num(r.enviadas));
    const porAsesor = `<div class="card"><h3>Por asesor</h3><table class="tb3 enc-tb"><thead><tr><th>Asesor</th><th class="num">Enviadas</th><th class="num">Respondieron</th><th>Atención</th><th>NPS</th><th class="num">Bajas</th></tr></thead><tbody>`
      + (filas.length ? filas.map(r => `<tr><td>${esc(r.nombre || '')}</td><td class="num">${num(r.enviadas)}</td><td class="num">${num(r.respondidas)}</td><td>${r.atencion != null && num(r.respondidas) ? `${estrellasEnc(Math.round(r.atencion))}<span class="coma">${coma(r.atencion)}</span>` : '—'}</td><td>${r.nps != null && num(r.respondidas) ? `<span class="nps ${npsAsesorCls(r.nps)}">${signo(r.nps)}</span>` : '—'}</td><td class="num">${num(r.bajas)}</td></tr>`).join('')
        : `<tr><td colspan="6" class="vacia">${hay ? 'Todavía no hay encuestas respondidas.' : 'Cargando…'}</td></tr>`)
      + '</tbody></table></div>';
    const pe = d.porEstrellas || {}, max = Math.max(1, ...[1, 2, 3, 4, 5].map(i => num(pe[i])));
    const barras = `<div class="card"><h3>Atención por estrellas</h3><div class="enc-barras">${[5, 4, 3, 2, 1].map(i => `<div><span>${i} ${i === 1 ? 'estrella' : 'estrellas'}</span><span class="fondo"><i style="width:${Math.round(num(pe[i]) / max * 100)}%"></i></span><em>${num(pe[i])}</em></div>`).join('')}</div></div>`;
    const lista = Array.isArray(d.respuestas) ? d.respuestas : [], total = Math.max(num(d.totalRespuestas), lista.length), faltan = Math.max(0, total - lista.length);
    const filtrada = INF.equipo || INF.asesor || INF.resp !== 'todas';
    const respuestas = `<div class="card"><h3>Respuestas<small>${total.toLocaleString('es-CO')} ${total === 1 ? 'respuesta' : 'respuestas'}</small></h3><table class="tb3 enc-tb"><thead><tr><th>Fecha</th><th>Cliente</th><th>Asesor</th><th>Atención</th><th>Recomienda</th><th>Comentario</th><th></th></tr></thead><tbody>`
      + (lista.length ? lista.map(r => { const com = typeof r.com === 'string' ? r.com.trim() : '', n = Math.round(num(r.nps));
          return `<tr><td>${esc(r.t ? fechaInf(r.t) : '')}</td><td>${esc(r.cliente || '')}</td><td>${esc(r.asesor || '')}</td><td>${r.aten != null ? estrellasEnc(Math.round(num(r.aten))) : '—'}</td><td>${r.nps != null ? `<span class="nps ${npsCls(n)}">${n}</span>` : '—'}</td>`
            + `<td class="com">${com ? `«${esc(com)}»` : '<span class="muted">Sin comentario</span>'}</td><td>${r.convId != null ? `<button type="button" class="enc-ver" data-enc-ver="${esc(r.convId)}">Ver conversación${SVG(SALIR)}</button>` : ''}</td></tr>`; }).join('')
        : `<tr><td colspan="7" class="vacia">${!hay ? 'Cargando…' : filtrada ? 'Ninguna respuesta con estos filtros.' : 'Todavía no hay encuestas respondidas.'}</td></tr>`)
      + `</tbody></table>${faltan ? `<div class="enc-mas"><button type="button" class="btn" data-enc-mas="1">Mostrar ${Math.min(20, faltan)} más</button></div>` : ''}</div>`;
    el.innerHTML = `<div class="enc-inf"><h2>Informes</h2>${pestanas(true)}${filtros}${kpis}<div class="enc-dos">${porAsesor}${barras}</div>${respuestas}</div>`;
  }
  const paginaInformesEnc = paginaInformes;
  paginaInformes = function(el){
    if (st.infTab === 'enc') { paginaEncuestas(el); return; }
    paginaInformesEnc.apply(this, arguments);
    // «Conversaciones» es la página de siempre, con las pestañas debajo del título. El nombre de la empresa sale del espacio.
    const h = el.querySelector(':scope > h2'); if (h) h.insertAdjacentHTML('afterend', pestanas(false));
  };

  /* ── Tablero 7: Ajustes del CRM › Encuesta al finalizar ── */
  const previaAjustes = msg => rellenar(msg, {nombre: 'Camila', asesor: primera(AJ.corto || yo), empresa: empresa()});
  function paginaEncuesta(){
    const e = encCfg(), dias = [7, 15, 30, 60, 90]; if (!dias.includes(e.dias)) dias.push(e.dias); dias.sort((a, b) => a - b);
    return `<div class="ajw ancho enc-aj"><button type="button" class="volver" data-ir="ajustes-crm">${I('back')}Ajustes del CRM</button><h2>Encuesta al finalizar</h2><p class="sub">Le llega al cliente al finalizar la conversación, dentro de las 24 horas de WhatsApp, así no cuesta nada.</p>
      <div class="enc-aj2"><div class="cfg"><div class="box2">
        ${fila('<b>Enviar la encuesta al finalizar</b>', '', sw('enc-on', e.on))}
        ${fila('<b>No volver a enviarla a la misma persona en</b>', 'Cuenta desde la última encuesta que se le envió, en cualquier conversación', ddSel('data-enc-diasaj', dias.map(n => [String(n), n === 1 ? '1 día' : `${n} días`]), String(e.dias)))}
        ${fila('<b>Avisar al líder del equipo si califica con 2 o menos</b>', 'Le llega en la campana con el enlace a la conversación', sw('enc-aviso', e.aviso))}</div>
        <div class="box2"><h4>Lo que le llega</h4>
        <label class="fld">Mensaje con el botón<textarea data-cfg-in="encuesta.msg" maxlength="${TOPE.msg}" rows="2">${esc(e.msg)}</textarea></label>
        <label class="fld">Pregunta sobre el asesor, de 1 a 5<input data-cfg-in="encuesta.p1" maxlength="${TOPE.p1}" value="${esc(e.p1)}"></label>
        <label class="fld">Pregunta de recomendación, de 0 a 10<input data-cfg-in="encuesta.p2" maxlength="${TOPE.p2}" value="${esc(e.p2)}"></label>
        ${fila('<b>Pedir un comentario</b>', 'El cliente puede dejarlo en blanco', sw('enc-comentario', e.comentario))}
        <label class="fld">Mensaje de gracias<input data-cfg-in="encuesta.gracias" maxlength="${TOPE.gracias}" value="${esc(e.gracias)}"></label></div></div>
      <div class="enc-ph2"><div class="hd">Así le llega por WhatsApp</div>${globo(previaAjustes(e.msg))}</div></div></div>`;
  }
  const paginaCfgEnc = paginaCfg;
  paginaCfg = function(k){ return k === 'encuesta' ? paginaEncuesta() : paginaCfgEnc.apply(this, arguments); };
  // Los interruptores: sin valor guardado cuentan como prendidos (encCfg), así que se cambian desde lo que se ve.
  const TG = {'enc-on': 'on', 'enc-aviso': 'aviso', 'enc-comentario': 'comentario'};
  const cfgTgEnc = cfgTg;
  cfgTg = function(k){
    if (!TG[k]) return cfgTgEnc.apply(this, arguments);
    if (!CFG.encuesta || typeof CFG.encuesta !== 'object') CFG.encuesta = {};
    const v = !encCfg()[TG[k]]; CFG.encuesta[TG[k]] = v; return v;
  };
  const pg = document.getElementById('page');
  // El mensaje, las preguntas y el gracias se guardan al salir del campo (10-nucleo.js, data-cfg-in). Vacíos, el mensaje y
  // las preguntas vuelven al texto por defecto (el gracias vacío no se manda).
  pg.addEventListener('change', e => {
    const t = e.target; if (st.pagina !== 'cfg-encuesta' || !t.matches || !t.matches('[data-cfg-in^="encuesta."]')) return;
    const k = t.dataset.cfgIn.split('.')[1];
    if (['msg', 'p1', 'p2'].includes(k) && !t.value.trim()) t.value = DEF[k];
  }, true);
  // La vista previa cambia mientras se escribe (solo el globo).
  pg.addEventListener('input', e => {
    const t = e.target; if (st.pagina !== 'cfg-encuesta' || !t.matches || !t.matches('[data-cfg-in="encuesta.msg"]')) return;
    const g = pg.querySelector('.enc-ph2 .enc-t'); if (g) g.textContent = previaAjustes(t.value.trim() || DEF.msg);
  });
  pg.addEventListener('click', e => {
    const t = e.target instanceof Element ? e.target : null; if (!t) return;
    // Ajustes: los días sin repetir.
    const da = t.closest('[data-enc-diasaj]');
    if (da && st.pagina === 'cfg-encuesta') { if (!CFG.encuesta || typeof CFG.encuesta !== 'object') CFG.encuesta = {}; CFG.encuesta.dias = +da.dataset.encDiasaj; render(); toast('Guardado'); return; }
    if (st.pagina !== 'informes') return;
    // Informes: las pestañas, los filtros, «Mostrar más» y «Ver conversación».
    const tab = t.closest('[data-enc-tab]');
    if (tab) { st.infTab = tab.dataset.encTab === 'enc' ? 'enc' : 'conv'; render(); return; }
    if (!enEncuestas()) return;
    const f = t.closest('[data-enc-dias], [data-enc-eq], [data-enc-ase], [data-enc-resp]');
    if (f) {
      const ds = f.dataset;
      if ('encDias' in ds) INF.dias = ds.encDias; else if ('encEq' in ds) INF.equipo = ds.encEq; else if ('encAse' in ds) INF.asesor = ds.encAse; else INF.resp = ds.encResp;
      INF.limite = 20; render(); pedirInf(); return;
    }
    if (t.closest('[data-enc-mas]')) { INF.limite += 20; pedirInf(); return; }
    const ver = t.closest('[data-enc-ver]');
    if (ver && typeof abrirDesdeAviso === 'function' && abrirDesdeAviso(new URLSearchParams('conv=' + encodeURIComponent(ver.dataset.encVer)), true)) { document.getElementById('app').classList.add('open'); render(); }
  });

  /* ── En vivo (80-datos.js despacha crm:evento con cada evento del servidor, ya aplicado) ── */
  document.addEventListener('crm:evento', e => {
    const d = e.detail; if (!d) return;
    if (d.tipo === 'encuestas') { infEnVivo(); return; }
    if (d.tipo === 'encuesta-formularios') { ponerFormularios(d.formularios); recalcular(); return; }
    if (d.tipo === 'conv' && d.conv && d.conv.id != null) {
      // La última encuesta de la persona se borra del contacto si no llegó (encuestaNoLlego): mezclarConv no quita claves.
      if (!('_encuestaUltima' in d.conv)) { const c = CONV.find(x => x.id === d.conv.id); if (c && '_encuestaUltima' in c) delete c._encuestaUltima; }
      if (d.conv.id === st.encDlg) recalcular();
      return;
    }
    if (d.tipo === 'ajuste' && d.clave === 'cfg') recalcular();
  });
})();
