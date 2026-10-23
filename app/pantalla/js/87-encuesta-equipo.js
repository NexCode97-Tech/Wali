/* ── Encuesta por equipo (maqueta aprobada «EncuestaEquipo») ──
   Ajustes del CRM › Encuesta al finalizar: una tarjeta por equipo (si está activa, qué pregunta, cómo le va en los
   últimos 30 días y el menú de tres puntos) y, por dentro, la encuesta de un equipo: los interruptores, el mensaje de
   invitación con su botón y el título del formulario, hasta 8 preguntas que se agregan y se arrastran, el gracias y, a
   la derecha, los tres momentos en el iPhone (Invitación, Formulario, Gracias). Se guarda en cfg.encuestas[equipo]; el
   API (services/crm/encuesta.ts) normaliza igual y, sin la del equipo, usa una copia de la de antes (cfg.encuesta).
   Envuelve paginaCfg después de 65-encuesta.js. Lo propio lleva «ee-». */
(() => {
  const DEF = {
    on: true, dias: 30, aviso: true,
    msg: '¡Gracias por escribirnos, {{nombre}}! ¿Nos ayudas con unas preguntas sobre tu atención? Toma menos de un minuto.',
    p1: '¿Cómo te atendió {{asesor}}?',
    p2: 'Del 0 al 10, ¿qué tan probable es que recomiendes {{empresa}} a un amigo?',
    gracias: '¡Gracias por responder, {{nombre}}! Nos ayuda a mejorar.',
    boton: 'Responder encuesta', titulo: 'Encuesta de atención',
  };
  const TOPE = {msg: 600, gracias: 300, boton: 20, titulo: 80, pregunta: 200, opcion: 30};
  const MAX = 8, MAX_OPS = 20;
  const TIPOS = {
    estrellas: ['Calificación de 1 a 5', '<path d="m12 3 2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7Z"/>'],
    nps: ['Recomendación de 0 a 10', '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'],
    opcion: ['Opción única', '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3" fill="currentColor"/>'],
    sino: ['Sí o no', '<path d="m5 12 4 4L19 6"/>'],
    libre: ['Respuesta libre', '<path d="M4 6h16M4 12h16M4 18h10"/>'],
  };
  const SV = d => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const ASA = SV('<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>');
  const COPIA = SV('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>');
  const FORM = SV('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>');
  const ESTRELLAS = ['⭐⭐⭐⭐⭐ Excelente', '⭐⭐⭐⭐ Buena', '⭐⭐⭐ Regular', '⭐⭐ Mala', '⭐ Muy mala'];

  const limpiar = (v, max) => typeof v !== 'string' ? '' : v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, max).trim();
  function preguntasDe(v){
    const out = [];
    for (const p of Array.isArray(v) ? v : []) {
      if (!p || !TIPOS[p.t]) continue;
      const txt = limpiar(p.txt, TOPE.pregunta); if (!txt) continue;
      const ops = p.t === 'opcion' ? [...new Set((Array.isArray(p.ops) ? p.ops : []).map(o => limpiar(o, TOPE.opcion)).filter(Boolean))].slice(0, MAX_OPS) : [];
      if (p.t === 'opcion' && ops.length < 2) continue;
      out.push({t: p.t, txt, oblig: p.oblig !== false, ops});
      if (out.length === MAX) break;
    }
    return out;
  }
  // La misma normalización del API (normalizarEncuesta).
  function norm(v){
    const e = v && typeof v === 'object' ? v : {};
    const d = Number(e.dias), txt = k => limpiar(e[k], TOPE[k] || 600) || DEF[k];
    const ps = preguntasDe(e.preguntas);
    return {
      on: e.on !== false, dias: Number.isInteger(d) && d >= 1 && d <= 365 ? d : DEF.dias, aviso: e.aviso !== false,
      msg: txt('msg'), boton: txt('boton'), titulo: txt('titulo'),
      gracias: e.gracias === undefined || e.gracias === null ? DEF.gracias : limpiar(e.gracias, TOPE.gracias),
      preguntas: ps.length ? ps : [
        {t: 'estrellas', txt: limpiar(e.p1, 30) || DEF.p1, oblig: true, ops: []},
        {t: 'nps', txt: limpiar(e.p2, 200) || DEF.p2, oblig: true, ops: []},
        ...(e.comentario !== false ? [{t: 'libre', txt: '¿Quieres contarnos algo más?', oblig: false, ops: []}] : []),
      ],
      borrada: e.borrada === true,
    };
  }
  const por = () => { if (!CFG.encuestas || typeof CFG.encuestas !== 'object') CFG.encuestas = {}; return CFG.encuestas; };
  const deEquipo = eq => norm(por()[eq] || CFG.encuesta);
  const rellenar = (t, v) => { let s = String(t || ''); for (const [k, x] of Object.entries(v)) s = x ? s.split(`{{${k}}}`).join(x) : s.replace(new RegExp(`\\s*,?\\s*\\{\\{${k}\\}\\}`, 'g'), ''); return s.replace(/[ \t]{2,}/g, ' ').trim(); };
  const ejemplo = () => ({nombre: 'Camila', asesor: String((typeof yo === 'string' && yo) || 'Sara').split(' ')[0], empresa: String(ESPACIO.nombre || 'tu empresa').trim()});
  const eqCara = (eq, cls = '') => `<span class="ee-eqa${cls}" style="background:${colorEquipo(eq)}">${typeof qIconoHTML === 'function' ? qIconoHTML(typeof qIconoDe === 'function' ? qIconoDe(eq) : 'users', cls ? 19 : 15) : I('users')}</span>`;

  st.encEq = st.encEq ?? null; st.encMenu = null; st.encVista = st.encVista || 2;
  // Las cifras de cada equipo en 30 días (GET /crm/encuestas, kpis); se piden una vez por visita a la página.
  const STATS = {};
  function pedirStats(eq){
    if (STATS[eq]) return;
    STATS[eq] = {cargando: true};
    crmApi('GET', `/crm/encuestas?dias=30&equipo=${encodeURIComponent(eq)}`).then(d => { STATS[eq] = (d && d.kpis) || {}; if (st.pagina === 'cfg-encuesta' && st.encEq === null) render(); }, () => { STATS[eq] = {}; });
  }
  const numCO = n => String(n).replace('.', ',');

  function lista(){
    const fila = e => {
      const c = deEquipo(e.n), ab = st.encMenu === e.n, k = STATS[e.n] || {}; pedirStats(e.n);
      if (c.borrada) return `<div class="ee-card"><span class="ee-cara">${eqCara(e.n)}</span><div class="ee-tx"><b>${esc(e.n)} no tiene encuesta</b><small>No se le envía nada al finalizar sus conversaciones.</small></div><button type="button" class="btn" data-ee-crear="${esc(e.n)}">${I('plus')}Crear encuesta</button></div>`;
      const stats = k.respondidas ? `<b>${k.atencion != null ? numCO(k.atencion) : '—'}</b><span>atención</span><b>${k.nps != null ? k.nps : '—'}</b><span>recomendación</span><b>${k.respondidas}</b><span>respuestas en 30 días</span>` : `<span>${k.cargando ? 'Cargando…' : 'Sin respuestas todavía'}</span>`;
      return `<div class="ee-card">${eqCara(e.n)}<div class="ee-tx"><b style="cursor:pointer" data-ee-abrir="${esc(e.n)}">Encuesta de ${esc(e.n)}</b><small>${esc(c.preguntas[0] ? c.preguntas[0].txt : '')} · No se repite en ${c.dias} ${c.dias === 1 ? 'día' : 'días'} · Aviso al líder: ${c.aviso ? 'sí' : 'no'}</small></div>
        <div class="ee-st">${stats}</div>
        <span class="ee-ech${c.on ? ' ok' : ''}"><i></i>${c.on ? 'Activa' : 'Apagada'}</span>
        <button type="button" class="tg" role="switch" data-ee-on="${esc(e.n)}" aria-checked="${c.on}" aria-label="Enviar la encuesta de ${esc(e.n)}"></button>
        <div class="tp-acc"><button type="button" class="tp-mas" data-ee-menu="${esc(e.n)}" aria-haspopup="menu" aria-expanded="${ab}" aria-label="Más acciones de la encuesta de ${esc(e.n)}">${I('more')}</button>
          <div class="tp-menu" role="menu" ${ab ? '' : 'hidden'}><button type="button" role="menuitem" data-ee-abrir="${esc(e.n)}">${TP_IC.editar}Editar</button><button type="button" role="menuitem" class="tp-peligro" data-ee-borrar="${esc(e.n)}">${TP_IC.borrar}Eliminar</button></div></div></div>`;
    };
    return `<div class="ajw ancho"><button type="button" class="volver" data-ir="ajustes-crm">${I('back')}Ajustes del CRM</button>
      <div class="pg-h"><div><h2>Encuesta al finalizar</h2><p class="sub">Le llega al cliente al finalizar la conversación, dentro de las 24 horas de WhatsApp, así no cuesta nada. Cada equipo tiene la suya y sale la del equipo que tiene la conversación.</p></div></div>
      <div class="ee-lista">${EQUIPOS.map(fila).join('')}</div></div>`;
  }

  /* ── Por dentro ── */
  const tipoChip = t => `<span class="ee-qt">${SV(TIPOS[t][1])}${TIPOS[t][0]}</span>`;
  function preguntaHTML(p, i){
    const extra = p.t === 'estrellas' ? `<div class="ee-qprev">${ESTRELLAS.join(' · ')}</div>`
      : p.t === 'nps' ? '<div class="ee-qprev">Desplegable de 0 (nada probable) a 10 (muy probable)</div>'
      : p.t === 'sino' ? '<div class="ee-qprev">Dos opciones: Sí · No</div>'
      : p.t === 'libre' ? '<div class="ee-qprev">Campo de texto · hasta 600 letras</div>'
      : `<div class="ee-qops">${p.ops.map((o, j) => `<span class="ee-qop"><i></i><input data-ee-op="${i}|${j}" value="${esc(o)}" maxlength="${TOPE.opcion}" aria-label="Opción ${j + 1}"><button type="button" class="ee-qopx" data-ee-opx="${i}|${j}" aria-label="Quitar opción" ${p.ops.length <= 2 ? 'disabled' : ''}>${I('x')}</button></span>`).join('')}${p.ops.length < MAX_OPS ? `<button type="button" class="ee-qadd" data-ee-opadd="${i}">+ Opción</button>` : ''}</div>`;
    const ab = st.encQMenu === i;
    return `<div class="ee-qc" data-ee-q="${i}"><span class="ee-qasa" data-ee-asa="${i}" title="Arrastra para cambiar el orden">${ASA}</span><span class="ee-qn">${i + 1}</span>
      <div class="ee-qcu"><div class="ee-qtop">${tipoChip(p.t)}<span class="ee-qob">Obligatoria<button type="button" class="tg" role="switch" data-ee-oblig="${i}" aria-checked="${p.oblig}" aria-label="Obligatoria"></button></span>
        <div class="tp-acc"><button type="button" class="tp-mas" data-ee-qmenu="${i}" aria-haspopup="menu" aria-expanded="${ab}" aria-label="Más acciones de la pregunta ${i + 1}">${I('more')}</button>
          <div class="tp-menu" role="menu" ${ab ? '' : 'hidden'}><button type="button" role="menuitem" data-ee-qdup="${i}" ${st.encDraft.preguntas.length >= MAX ? 'disabled' : ''}>${COPIA}Duplicar</button><button type="button" role="menuitem" class="tp-peligro" data-ee-qdel="${i}" ${st.encDraft.preguntas.length <= 1 ? 'disabled' : ''}>${TP_IC.borrar}Eliminar</button></div></div></div>
        <input class="ee-qin" data-ee-qtxt="${i}" value="${esc(p.txt)}" maxlength="${TOPE.pregunta}" aria-label="Texto de la pregunta ${i + 1}">${extra}</div></div>`;
  }
  // Los tres momentos en el iPhone de plantillas (tn-*), con los textos de ejemplo.
  function iphone(cuerpo, chat = true){
    const marca = (ESPACIO.nombre || 'Tu empresa').trim(), ini = marca.charAt(0).toUpperCase();
    return `<div class="tn-tel ee-tel"><div class="tn-pant"><span class="tn-isla"></span>
      <div class="tn-estado"><span>9:41</span><span class="der"><svg viewBox="0 0 18 12" aria-hidden="true"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg><svg viewBox="0 0 16 12" aria-hidden="true"><path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0Z"/><path d="M3.4 6.8a6.5 6.5 0 0 1 9.2 0l-1.2 1.2a4.8 4.8 0 0 0-6.8 0Z"/><path d="M1.1 4.5a9.8 9.8 0 0 1 13.8 0l-1.2 1.2a8.1 8.1 0 0 0-11.4 0Z"/></svg><svg viewBox="0 0 27 12" aria-hidden="true"><rect x=".5" y=".5" width="22" height="11" rx="3.5" fill="none" stroke="#000" stroke-opacity=".4"/><rect x="2" y="2" width="17" height="8" rx="2"/><path d="M24.5 4v4a2 2 0 0 0 0-4Z" fill-opacity=".4"/></svg></span></div>
      <div class="tn-wcab"><span class="atras">${I('back')}</span><span class="ava">${esc(ini)}</span><span class="q"><b>${esc(marca)}<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#25D366" d="M12 1.5 14.6 4l3.5-.4.9 3.4 3.1 1.7-1.3 3.3 1.3 3.3-3.1 1.7-.9 3.4-3.5-.4L12 22.5 9.4 20l-3.5.4-.9-3.4-3.1-1.7L3.2 12 1.9 8.7 5 7l.9-3.4 3.5.4Z"/><path d="m8 12 3 3 5-6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></b><small>Cuenta de empresa</small></span><span class="ic">${TP_IC.video}${TP_IC.llamar}</span></div>
      ${cuerpo}
      ${chat ? `<div class="tn-escribir">${I('plus')}<span class="campo2"></span><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4Z"/><circle cx="12" cy="13" r="3.5"/></svg>${I('mic')}</div>` : ''}
      <span class="tn-barrita"></span></div></div>`;
  }
  function vistas(c){
    const v = ejemplo(), inv = esc(rellenar(c.msg, v)), boton = esc(c.boton);
    const invita = `<div class="ee-wb">${inv}<span>4:52 p. m.</span><div class="ee-wbt">${FORM}${boton}</div></div>`;
    const f1 = `<div class="tn-fondo ee-fondo"><div class="ee-wb yo">Listo, muchas gracias por la ayuda 🙌<span>4:51 p. m.</span></div>${invita}</div>`;
    const campo = p => p.t === 'estrellas' ? ESTRELLAS.map((o, k) => `<div class="ee-frb"><span class="ee-fr${k ? '' : ' on'}"></span>${o}</div>`).join('')
      : p.t === 'nps' ? `<div class="ee-fdd"><span>10 · Muy probable</span>${I('chev')}</div>`
      : p.t === 'sino' ? ['Sí', 'No'].map((o, k) => `<div class="ee-frb"><span class="ee-fr${k ? '' : ' on'}"></span>${o}</div>`).join('')
      : p.t === 'opcion' ? p.ops.map((o, k) => `<div class="ee-frb"><span class="ee-fr${k ? '' : ' on'}"></span>${esc(o)}</div>`).join('')
      : '<div class="ee-fta">Todo muy rápido, gracias</div>';
    const f2 = `<div class="tn-fondo ee-fondo"></div><div class="ee-fsh"><div class="ee-fsh-h"><span>✕</span><b>${esc(rellenar(c.titulo, v))}</b><span>⋮</span></div>
      <div class="ee-fsh-c">${c.preguntas.map(p => `<p class="ee-fq">${esc(rellenar(p.txt, v))}${p.oblig ? '' : ' <small>Opcional</small>'}</p>${campo(p)}`).join('')}</div>
      <div class="ee-fsh-f"><span>Enviar</span><small>Administrado por la empresa. Más información</small></div></div>`;
    const gr = rellenar(c.gracias, v);
    const f3 = `<div class="tn-fondo ee-fondo">${invita}<div class="ee-wb yo"><b class="ee-wr">${FORM}Respuesta enviada</b><span>4:53 p. m.</span></div>${gr ? `<div class="ee-wb">${esc(gr)}<span>4:53 p. m.</span></div>` : ''}</div>`;
    const n = st.encVista, tab = (k, t) => `<button type="button" role="tab" data-ee-vista="${k}" aria-selected="${n === k}">${t}</button>`;
    const desc = {1: 'Lo que le llega al finalizar la conversación.', 2: 'Lo que ve al tocar «' + c.boton + '».', 3: 'Lo que ve al enviar sus respuestas.'}[n];
    return `<div class="ee-celes"><div class="ee-tabs" role="tablist">${tab(1, '1 · Invitación')}${tab(2, '2 · Formulario')}${tab(3, '3 · Gracias')}</div><p class="ee-evd">${esc(desc)}</p>
      ${iphone(n === 1 ? f1 : n === 2 ? f2 : f3, n !== 2)}</div>`;
  }
  function editor(eq){
    const c = st.encDraft, dias = [7, 15, 30, 60, 90]; if (!dias.includes(c.dias)) dias.push(c.dias); dias.sort((a, b) => a - b);
    const otros = EQUIPOS.filter(e => e.n !== eq && !deEquipo(e.n).borrada);
    return `<div class="ajw ancho ee"><button type="button" class="volver" data-ee-lista="1">${I('back')}Encuestas</button>
      <div class="ee-cab"><div class="ee-cab-t">${eqCara(eq, ' big')}<div><h2>Encuesta de ${esc(eq)}</h2><p class="sub">Sale al finalizar las conversaciones de ${esc(eq)}.</p></div></div>
        <div class="ee-cab-acc">${otros.length ? `<div class="tp-acc"><button type="button" class="btn" data-ee-copiarmenu="1" aria-haspopup="menu" aria-expanded="${!!st.encCopiar}">${COPIA}Copiar de otro equipo</button><div class="tp-menu" role="menu" ${st.encCopiar ? '' : 'hidden'}>${otros.map(e => `<button type="button" role="menuitem" data-ee-copiar="${esc(e.n)}">${eqCara(e.n)}Encuesta de ${esc(e.n)}</button>`).join('')}</div></div>` : ''}<button type="button" class="btn pri" data-ee-guardar="1">${I('check')}Guardar</button></div></div>
      <div class="ee-grid"><div class="ee-col">
        <section class="box2 ee-sec">
          <div class="row2"><span><b>Enviar la encuesta de ${esc(eq)} al finalizar</b></span><button type="button" class="tg" role="switch" data-ee-sw="on" aria-checked="${c.on}"></button></div>
          <div class="row2"><span><b>No volver a enviarla a la misma persona en</b><small>Cuenta desde la última encuesta que se le envió, en cualquier conversación</small></span>${ddSel('data-ee-dias', dias.map(n => [String(n), n === 1 ? '1 día' : `${n} días`]), String(c.dias))}</div>
          <div class="row2"><span><b>Avisar al líder de ${esc(eq)} si califica con 2 o menos</b><small>Le llega en la campana con el enlace a la conversación</small></span><button type="button" class="tg" role="switch" data-ee-sw="aviso" aria-checked="${c.aviso}"></button></div>
        </section>
        <section class="box2 ee-sec"><h3 class="ee-n"><span class="n on">1</span>Mensaje de invitación</h3>
          <textarea class="ee-area" data-ee-in="msg" maxlength="${TOPE.msg}" rows="3" aria-label="Mensaje de invitación">${esc(c.msg)}</textarea>
          <div class="ee-dos"><label class="fld">Texto del botón<input data-ee-in="boton" value="${esc(c.boton)}" maxlength="${TOPE.boton}"></label><label class="fld">Título del formulario<input data-ee-in="titulo" value="${esc(c.titulo)}" maxlength="${TOPE.titulo}"></label></div>
        </section>
        <section class="box2 ee-sec"><h3 class="ee-n"><span class="n on">2</span>Preguntas <em class="ee-qcount">${c.preguntas.length} de ${MAX}</em></h3>
          <p class="ee-ayuda">Arrastra desde los seis puntos para cambiar el orden. Las preguntas de calificación y recomendación alimentan Informes.</p>
          <div class="ee-ql" id="ee-ql">${c.preguntas.map(preguntaHTML).join('')}</div>
          ${c.preguntas.length < MAX ? `<div class="ee-qaddw tp-acc"><button type="button" class="btn" data-ee-qnueva="1" aria-haspopup="menu" aria-expanded="${!!st.encTipos}">${I('plus')}Agregar pregunta</button>
            <div class="tp-menu ee-qmenu" role="menu" ${st.encTipos ? '' : 'hidden'}>${Object.entries(TIPOS).map(([k, [n, d]]) => `<button type="button" role="menuitem" data-ee-tipo="${k}">${SV(d)}${n}</button>`).join('')}</div></div>` : '<p class="ee-ayuda">Ya tienes las 8 preguntas que caben en el formulario de WhatsApp.</p>'}
        </section>
        <section class="box2 ee-sec"><h3 class="ee-n"><span class="n on">3</span>Mensaje de gracias</h3>
          <textarea class="ee-area" data-ee-in="gracias" maxlength="${TOPE.gracias}" rows="2" aria-label="Mensaje de gracias">${esc(c.gracias)}</textarea>
          <span class="ee-ayuda">Déjalo vacío si no quieres mandar nada al terminar.</span>
        </section>
      </div>${vistas(c)}</div></div>`;
  }

  const paginaCfgAntes = paginaCfg;
  paginaCfg = function(k){
    if (k !== 'encuesta') return paginaCfgAntes.apply(this, arguments);
    if (st.encEq && !EQUIPOS.some(e => e.n === st.encEq)) st.encEq = null;
    if (!st.encEq) return lista();
    if (!st.encDraft || st.encDraftDe !== st.encEq) { st.encDraft = JSON.parse(JSON.stringify(deEquipo(st.encEq))); st.encDraftDe = st.encEq; }
    return editor(st.encEq);
  };

  // La vista del iPhone cambia mientras se escribe (sin rearmar el formulario: no se pierde el cursor).
  const repintarVista = () => { const v = document.querySelector('.ee-celes'); if (v && st.encDraft) v.outerHTML = vistas(st.encDraft); };
  const pg = document.getElementById('page');
  pg.addEventListener('input', e => {
    if (st.pagina !== 'cfg-encuesta' || !st.encEq || !st.encDraft) return;
    const t = e.target, c = st.encDraft;
    if (t.dataset.eeIn) { c[t.dataset.eeIn] = t.value; repintarVista(); return; }
    if (t.dataset.eeQtxt !== undefined) { c.preguntas[+t.dataset.eeQtxt].txt = t.value; repintarVista(); return; }
    if (t.dataset.eeOp) { const [i, j] = t.dataset.eeOp.split('|').map(Number); c.preguntas[i].ops[j] = t.value; repintarVista(); }
  });
  pg.addEventListener('click', e => {
    if (st.pagina !== 'cfg-encuesta') return;
    const t = e.target instanceof Element ? e.target : null; if (!t) return;
    const g = (attr, fn) => { const b = t.closest(`[${attr}]`); if (!b) return false; e.stopImmediatePropagation(); fn(b.getAttribute(attr), b); return true; };
    // La lista
    if (g('data-ee-menu', v => { st.encMenu = st.encMenu === v ? null : v; render(); })) return;
    if (g('data-ee-abrir', v => { st.encEq = v; st.encMenu = null; st.encDraft = null; st.encVista = 2; render(); window.scrollTo && window.scrollTo(0, 0); })) return;
    if (g('data-ee-on', v => { const c = deEquipo(v); c.on = !c.on; delete c.borrada; por()[v] = c; crmSincronizar(); render(); toast(`Encuesta de ${v}: ${c.on ? 'activa' : 'apagada'}`); })) return;
    if (g('data-ee-borrar', v => {
      st.encMenu = null;
      abrirDialogo(`<h3>Eliminar la encuesta de ${esc(v)}</h3><p>Sus clientes dejan de recibir encuesta al finalizar. Las respuestas que ya llegaron siguen en Informes. Puedes crearla otra vez cuando quieras.</p><div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" style="background:#dc2626;border-color:#dc2626;color:#fff" data-ee-borrarok="${esc(v)}">${TP_IC.borrar}Eliminar</button></div>`);
    })) return;
    if (g('data-ee-crear', v => {
      // Un equipo sin encuesta arranca con una copia de la del primer equipo que tenga la suya.
      const base = EQUIPOS.map(x => x.n).find(n => n !== v && !deEquipo(n).borrada);
      const c = base ? deEquipo(base) : norm({}); c.on = true; delete c.borrada; por()[v] = c;
      crmSincronizar(); st.encEq = v; st.encDraft = null; render(); toast(`Encuesta de ${v} creada${base ? ` con una copia de la de ${base}` : ''}`);
    })) return;
    if (st.encMenu && !t.closest('.tp-menu')) { st.encMenu = null; render(); }
    if (!st.encEq || !st.encDraft) return;
    const c = st.encDraft;
    // Por dentro
    if (g('data-ee-lista', () => { st.encEq = null; st.encDraft = null; render(); })) return;
    if (g('data-ee-vista', v => { st.encVista = +v; repintarVista(); })) return;
    if (g('data-ee-sw', v => { c[v] = !c[v]; render(); })) return;
    if (g('data-ee-dias', v => { c.dias = +v; render(); })) return;
    if (g('data-ee-oblig', v => { const p = c.preguntas[+v]; p.oblig = !p.oblig; render(); })) return;
    if (g('data-ee-qmenu', v => { st.encQMenu = st.encQMenu === +v ? null : +v; render(); })) return;
    if (g('data-ee-qdup', v => { if (c.preguntas.length < MAX) c.preguntas.splice(+v + 1, 0, JSON.parse(JSON.stringify(c.preguntas[+v]))); st.encQMenu = null; render(); })) return;
    if (g('data-ee-qdel', v => { if (c.preguntas.length > 1) c.preguntas.splice(+v, 1); st.encQMenu = null; render(); })) return;
    if (g('data-ee-opadd', v => { const p = c.preguntas[+v]; if (p.ops.length < MAX_OPS) p.ops.push(`Opción ${p.ops.length + 1}`); render(); })) return;
    if (g('data-ee-opx', v => { const [i, j] = v.split('|').map(Number); if (c.preguntas[i].ops.length > 2) c.preguntas[i].ops.splice(j, 1); render(); })) return;
    if (g('data-ee-qnueva', () => { st.encTipos = !st.encTipos; render(); })) return;
    if (g('data-ee-tipo', v => {
      const txt = {estrellas: '¿Cómo te atendió {{asesor}}?', nps: DEF.p2, opcion: '¿Por dónde nos conociste?', sino: '¿Volverías a escribirnos?', libre: '¿Quieres contarnos algo más?'}[v];
      if (c.preguntas.length < MAX) c.preguntas.push({t: v, txt, oblig: v !== 'libre', ops: v === 'opcion' ? ['Facebook o Instagram', 'Google', 'Me recomendaron', 'Otro'] : []});
      st.encTipos = false; render();
      const ins = pg.querySelectorAll('.ee-qin'); if (ins.length) ins[ins.length - 1].focus();
    })) return;
    if (g('data-ee-copiarmenu', () => { st.encCopiar = !st.encCopiar; render(); })) return;
    if (g('data-ee-copiar', v => { const o = deEquipo(v); Object.assign(c, JSON.parse(JSON.stringify({msg: o.msg, boton: o.boton, titulo: o.titulo, preguntas: o.preguntas, gracias: o.gracias, dias: o.dias}))); st.encCopiar = false; render(); toast(`Se copiaron los textos y las preguntas de la encuesta de ${v}. Dale Guardar para quedarte con ellos.`); })) return;
    if (g('data-ee-guardar', () => {
      const n = norm(c);
      if (n.preguntas.length !== c.preguntas.length) { toast('Cada pregunta necesita su texto, y la de opción única al menos 2 opciones'); return; }
      por()[st.encEq] = {on: n.on, dias: n.dias, aviso: n.aviso, msg: n.msg, boton: n.boton, titulo: n.titulo, preguntas: n.preguntas, gracias: n.gracias};
      st.encDraft = JSON.parse(JSON.stringify(n)); crmSincronizar(); render(); toast(`Encuesta de ${st.encEq} guardada`);
    })) return;
    if ((st.encTipos || st.encCopiar || st.encQMenu != null) && !t.closest('.tp-menu')) { st.encTipos = false; st.encCopiar = false; st.encQMenu = null; render(); }
  }, true);
  document.addEventListener('click', e => {
    const ok = e.target instanceof Element && e.target.closest('[data-ee-borrarok]'); if (!ok) return;
    const v = ok.dataset.eeBorrarok, c = deEquipo(v); c.on = false; c.borrada = true; por()[v] = c;
    cerrarDialogo(); crmSincronizar(); render(); toast(`Encuesta de ${v} eliminada`);
  });
  // Arrastrar las preguntas desde los seis puntos.
  pg.addEventListener('pointerdown', e => { const a = e.target instanceof Element && e.target.closest('[data-ee-asa]'); if (a) a.closest('.ee-qc').draggable = true; });
  pg.addEventListener('dragstart', e => { const q = e.target instanceof Element && e.target.closest('.ee-qc'); if (!q || st.pagina !== 'cfg-encuesta') return; st.encArr = +q.dataset.eeQ; q.classList.add('arrastrando'); e.dataTransfer.effectAllowed = 'move'; });
  pg.addEventListener('dragover', e => {
    if (st.encArr == null) return; const q = e.target instanceof Element && e.target.closest('.ee-qc'); if (!q) return;
    e.preventDefault(); pg.querySelectorAll('.ee-qc.sobre').forEach(x => x.classList.remove('sobre')); q.classList.add('sobre');
  });
  pg.addEventListener('drop', e => {
    if (st.encArr == null || !st.encDraft) return; const q = e.target instanceof Element && e.target.closest('.ee-qc'); if (!q) return;
    e.preventDefault(); const de = st.encArr, a = +q.dataset.eeQ, ps = st.encDraft.preguntas;
    const [x] = ps.splice(de, 1); ps.splice(a, 0, x); st.encArr = null; render();
  });
  pg.addEventListener('dragend', () => { st.encArr = null; pg.querySelectorAll('.ee-qc').forEach(x => { x.draggable = false; x.classList.remove('arrastrando', 'sobre'); }); });
  // Al volver a la página se piden otra vez las cifras.
  document.addEventListener('crm:evento', e => { const d = e.detail; if (d && d.tipo === 'encuestas') for (const k of Object.keys(STATS)) delete STATS[k]; });

  document.head.insertAdjacentHTML('beforeend', `<style>
.ee-lista{display:grid;gap:10px}
.ee-card{display:flex;align-items:center;gap:14px;padding:14px 16px;border:1px solid var(--line);border-radius:12px;background:#fff}
.ee-eqa{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;flex:none;color:#fff}
.ee-eqa svg,.ee-eqa img{width:15px;height:15px}
.ee-eqa.big{width:40px;height:40px}
.ee-eqa.big svg,.ee-eqa.big img{width:19px;height:19px}
.ee-tx{flex:1;min-width:0}
.ee-tx b{display:block;font-size:14px;font-weight:600}
.ee-tx small{display:block;font-size:12.5px;color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ee-st{display:flex;align-items:baseline;gap:5px;font-size:12px;color:var(--ink3);white-space:nowrap}
.ee-st b{font-size:15px;font-weight:700;color:var(--ink);margin-left:8px}
.ee-st b:first-child{margin-left:0}
.ee-ech{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--ink3);white-space:nowrap}
.ee-ech i{width:7px;height:7px;border-radius:50%;background:currentColor}
.ee-ech.ok{color:var(--green-ink,#15803d)}
.ee-cab{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:10px 0 18px}
.ee-cab-t{display:flex;align-items:center;gap:12px}
.ee-cab-t h2{margin:0}
.ee-cab-acc{display:flex;gap:8px;flex:none}
.ee-cab-acc .tp-menu button{gap:10px}
.ee-cab-acc .tp-menu .ee-eqa{width:22px;height:22px}
.ee-cab-acc .tp-menu .ee-eqa svg{width:12px;height:12px;color:#fff}
.ee-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);gap:24px;align-items:start}
.ee-col{display:grid;gap:14px;align-content:start}
.ee-sec{display:grid;gap:12px}
.ee-n{display:flex;align-items:center;gap:10px;margin:0;font-size:15px;font-weight:650}
.ee-n .n{width:24px;height:24px;border-radius:50%;background:#FFD21F;color:#0b0b10;display:grid;place-items:center;font-size:11px;font-weight:600;line-height:1;text-box:trim-both cap alphabetic;flex:none}
.ee-qcount{margin-left:auto;font-style:normal;font-size:12px;font-weight:600;color:var(--ink3)}
.ee-area{border:1px solid var(--line);border-radius:10px;padding:10px 12px;font:inherit;font-size:13.5px;width:100%;resize:vertical;background:#fff}
.ee-area:focus,.ee-qin:focus{outline:0;border-color:#0b0b10;box-shadow:0 0 0 3px rgba(11,11,16,.08)}
.ee-dos{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.ee-ayuda{font-size:12.5px;color:var(--ink3);margin:0}
.ee-ql{display:grid;gap:8px}
.ee-qc{display:flex;gap:10px;align-items:flex-start;padding:12px;border:1px solid var(--line);border-radius:12px;background:#fff;transition:transform .2s cubic-bezier(.22,1,.36,1),box-shadow .2s}
.ee-qc.arrastrando{border-color:#0b0b10;box-shadow:0 18px 30px -18px rgba(15,23,42,.45)}
.ee-qc.sobre{border:2px dashed #FFD21F;background:#fffbe6}
.ee-qasa{color:var(--ink4);padding-top:4px;cursor:grab;touch-action:none}
.ee-qasa svg{width:16px;height:16px;fill:currentColor;stroke:none}
.ee-qn{width:24px;height:24px;border-radius:50%;border:2px solid var(--line);display:grid;place-items:center;font-size:11px;font-weight:600;color:var(--ink3);line-height:1;text-box:trim-both cap alphabetic;flex:none}
.ee-qcu{flex:1;min-width:0;display:grid;gap:8px}
.ee-qtop{display:flex;align-items:center;gap:10px}
.ee-qt{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 9px;border:1px solid var(--line);border-radius:8px;font-size:12px;font-weight:500;color:var(--ink2);background:var(--bg2)}
.ee-qt svg{width:13px;height:13px}
.ee-qob{margin-left:auto;display:inline-flex;align-items:center;gap:8px;font-size:12px;color:var(--ink3)}
.ee-qob .tg{transform:scale(.85)}
.ee-qin{border:1px solid var(--line);border-radius:9px;padding:8px 11px;font:inherit;font-size:13.5px;color:var(--ink);width:100%;background:#fff}
.ee-qprev{font-size:12px;color:var(--ink3)}
.ee-qops{display:flex;flex-wrap:wrap;gap:6px}
.ee-qop{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 4px 0 10px;border:1px solid var(--line);border-radius:8px;font-size:12.5px;color:var(--ink2)}
.ee-qop i{width:12px;height:12px;border-radius:50%;border:2px solid var(--ink4);flex:none}
.ee-qop input{border:0;outline:0;font:inherit;font-size:12.5px;width:9em;background:none;padding:0}
.ee-qopx{width:22px;height:22px;border:0;background:none;border-radius:6px;display:grid;place-items:center;color:#dc2626;cursor:pointer}
.ee-qopx:disabled{opacity:.35;cursor:default}
.ee-qopx svg{width:12px;height:12px}
.ee-qadd{height:30px;padding:0 10px;border:1.5px dashed #cbd5e1;border-radius:8px;background:#fff;font:inherit;font-size:12.5px;font-weight:500;color:var(--ink2);cursor:pointer}
.ee-qaddw{display:flex;justify-content:flex-start}
.ee-qaddw .tp-menu{left:0;right:auto}
.ee-qmenu svg{width:15px;height:15px}
.ee-celes{display:grid;gap:12px;justify-items:center;align-content:start;position:sticky;top:12px}
.ee-tabs{display:inline-flex;height:36px;border:1px solid var(--line);border-radius:10px;background:#fff;padding:3px;gap:2px;align-items:center}
.ee-tabs button{height:28px;padding:0 12px;border:0;border-radius:7px;background:none;font:inherit;font-size:13px;color:var(--ink3);cursor:pointer;white-space:nowrap}
.ee-tabs button[aria-selected="true"]{background:var(--bg3);color:var(--ink);font-weight:600}
.ee-evd{font-size:12.5px;color:var(--ink3);margin:0}
.ee-tel{position:relative;top:auto}
.ee-fondo{justify-content:flex-end}
.ee-wb{align-self:flex-start;max-width:86%;background:#fff;border-radius:10px;padding:7px 9px 5px;font-size:15.5px;line-height:1.35;color:#111b21;box-shadow:0 1px .5px rgba(11,20,26,.13);white-space:pre-wrap}
.ee-wb > span{display:block;text-align:right;font-size:11px;color:#8696a0;margin-top:2px}
.ee-wb.yo{align-self:flex-end;background:#d9fdd3}
.ee-wbt{display:flex;align-items:center;justify-content:center;gap:6px;margin:8px -9px -5px;padding:10px;border-top:1px solid #e9edef;color:#027eb5;font-weight:600;font-size:15px;white-space:normal}
.ee-wbt svg,.ee-wr svg{width:17px;height:17px}
.ee-wr{display:flex;align-items:center;gap:5px;font-weight:600}
.ee-fsh{position:absolute;inset:118px 0 0;z-index:4;background:#fff;border-radius:14px 14px 0 0;display:flex;flex-direction:column;box-shadow:0 -6px 20px rgba(0,0,0,.18)}
.ee-fsh-h{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid #eee;font-size:16px;color:#54656f}
.ee-fsh-h b{flex:1;text-align:center;color:#111b21}
.ee-fsh-c{flex:1;overflow-y:auto;padding:12px 16px;display:grid;gap:9px;align-content:start}
.ee-fq{font-size:15px;font-weight:700;color:#111b21;margin:6px 0 0}
.ee-fq small{font-weight:400;color:#8696a0}
.ee-frb{display:flex;align-items:center;gap:10px;font-size:14.5px;color:#111b21}
.ee-fr{width:18px;height:18px;border-radius:50%;border:1.5px solid #8696a0;flex:none;box-sizing:border-box}
.ee-fr.on{border:5px solid #00a884}
.ee-fdd{display:flex;align-items:center;justify-content:space-between;border:1px solid #c9d0d4;border-radius:8px;padding:10px 12px;font-size:14.5px}
.ee-fdd svg{width:12px;height:12px}
.ee-fta{border:1px solid #c9d0d4;border-radius:8px;padding:10px 12px;font-size:14.5px;min-height:48px}
.ee-fsh-f{padding:10px 16px 34px;display:grid;gap:8px;text-align:center}
.ee-fsh-f span{background:#00a884;color:#fff;border-radius:24px;padding:12px;font-size:16px;font-weight:600}
.ee-fsh-f small{font-size:12px;color:#8696a0}
@media (max-width:1180px){.ee-grid{grid-template-columns:1fr}.ee-celes{position:relative;top:auto}}
@media (max-width:760px){.ee-card{flex-wrap:wrap}.ee-st{order:5;width:100%}.ee-cab{flex-wrap:wrap}.ee-dos{grid-template-columns:1fr}.ee-tel{transform:scale(.8);transform-origin:top center;margin-bottom:-180px}}
</style>`);
})();
