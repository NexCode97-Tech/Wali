/* ── Configurar llamadas en la línea (maqueta aprobada «Configurar llamadas en la línea», 24-oct): en la tarjeta de cada
   línea de Líneas de WhatsApp. Si falta algo, la lista de requisitos con su estado real y «Activar llamadas»; activadas,
   todo lo que Meta deja configurar agrupado por momento. Cada ajuste se guarda en Meta (PUT /crm/lineas/:id/llamadas,
   llamadas.ts) y la tarjeta se actualiza sola si alguien lo cambia desde Meta (aviso account_settings_update).
   La grabación de las llamadas es del CRM (LLAM.lineas[id].grabar), porque Meta no graba. ── */
const LW_IC = {
  ok: '<svg viewBox="0 0 24 24"><path d="m5 12 5 5L20 7"/></svg>',
  reloj: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  ext: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  mic: '<svg viewBox="0 0 24 24"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 5v14l11-7z"/></svg>',
  pausa: '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>',
  sync: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3"/><path d="M4 4v4h4M20 20v-4h-4"/></svg>',
};
/** Lo leído de Meta por línea: {ajustes, cupo, cargando, error, guardando, desactivar, grabando}. */
const LW = {};
const lwTg = (on, l, attr) => `<button type="button" class="tg" role="switch" aria-checked="${!!on}" aria-label="${l}" ${attr}></button>`;
const lwGrupo = (t, filas) => `<div class="lw-g"><small class="lw-gt">${t}</small>${filas}</div>`;
const lwFila = (b, s, ctl) => `<div class="lw-f"><div class="lw-tx"><b>${b}</b><small>${s}</small></div><div class="lw-ctl">${ctl}</div></div>`;
const lwSeg = (attr, ops, v) => `<div class="lw-seg" role="radiogroup">${ops.map(([k, t]) => `<button type="button" role="radio" aria-checked="${k === v}" ${attr}="${k}">${t}</button>`).join('')}</div>`;
const lwHace = iso => { const m = Math.round((Date.now() - Date.parse(iso)) / 60000); return !iso || !Number.isFinite(m) ? '' : m < 1 ? 'hace un momento' : m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`; };

function lwCargar(id, forzar){
  const x = LW[id] || (LW[id] = {});
  if ((x.ajustes && !forzar) || x.cargando) return;
  x.cargando = true; x.error = '';
  crmApi('GET', `/crm/lineas/${id}/llamadas`)
    .then(r => { x.ajustes = r.ajustes; x.cupo = r.cupo; lwLineaNueva(r.linea); })
    .catch(err => { x.error = err.message || 'Meta no respondió'; })
    .finally(() => { x.cargando = false; if (st.pagina === 'cfg-lineas') render(); });
}
function lwLineaNueva(n){ const i = LINEAS.findIndex(l => l.id === n.id); if (i >= 0) LINEAS[i] = {...LINEAS[i], ...n}; }
function lwCambiar(id, cambios, ok){
  const x = LW[id] || (LW[id] = {});
  x.guardando = true; if (st.pagina === 'cfg-lineas') render();
  return crmApi('PUT', `/crm/lineas/${id}/llamadas`, {cambios})
    .then(r => { x.ajustes = r.ajustes; lwLineaNueva(r.linea); if (ok) toast(ok); })
    .catch(err => toast(err.message || 'Meta no guardó el cambio'))
    .finally(() => { x.guardando = false; if (st.pagina === 'cfg-lineas') render(); });
}

/** La fila «Llamadas por WhatsApp» de la tarjeta y, abierta, sus requisitos o sus ajustes. */
function lwLinea(l, lim, ab){
  const meta = metaLlamadas(l), x = LW[l.id] || {};
  const sm = meta ? 'Activadas · tus clientes ya pueden llamarte' : lim != null && lim >= 2000 ? 'Listas para activar' : 'Falta un requisito de Meta';
  const ctl = meta
    ? `<button type="button" class="ln-lnk" data-ln-abrir="${l.id}|aj" aria-expanded="${ab === 'aj'}">Ajustes${I('chev')}</button>${lwTg(true, `Llamadas por WhatsApp en ${esc(l.n)}`, `data-lw-apagar="${l.id}"`)}`
    : `<button type="button" class="ln-lnk" data-ln-abrir="${l.id}|req" aria-expanded="${ab === 'req'}">Ver requisitos${I('chev')}</button>${lwTg(false, `Llamadas por WhatsApp en ${esc(l.n)}`, `data-lw-encender="${l.id}" ${lim != null && lim >= 2000 && !x.guardando ? '' : 'disabled title="Falta un requisito de Meta"'}`)}`;
  const filaLl = `<div class="ln-f"><span class="fic">${I('phone')}</span><div class="ftx"><b>Llamadas por WhatsApp</b><small>${sm}</small></div><div class="ctl">${ctl}</div></div>`;
  if (!meta && ab === 'req') return filaLl + lwRequisitos(l, lim, x);
  if (meta && ab === 'aj') { lwCargar(l.id); return filaLl + lwAjustes(l, x); }
  return filaLl;
}

function lwRequisitos(l, lim, x){
  const limOk = lim != null && lim >= 2000;
  return `<div class="lw">
    <div class="lw-req"><div class="lw-reqh"><b>Para activar las llamadas</b><small>Meta las habilita cuando la línea cumple esto. Lo revisamos solos cada vez que Meta avisa un cambio.</small></div>
      <div class="lw-it ${limOk ? 'listo' : 'falta'}">${limOk ? LW_IC.ok : LW_IC.reloj}<span>Límite de 2.000 conversaciones al día</span><em>${lim == null ? 'Sin dato de Meta' : limOk ? `${fmtLimite(lim)} · listo` : `${fmtLimite(lim)} de 2.000`}</em></div>
      <div class="lw-it listo">${LW_IC.ok}<span>Número en la API oficial (no en la app del celular)</span><em>Listo</em></div>
      <div class="lw-it falta">${LW_IC.reloj}<span>Método de pago en la cuenta de WhatsApp</span><a href="https://business.facebook.com/wa/manage/home/?waba_id=${encodeURIComponent(l.wabaId || '')}" target="_blank" rel="noopener noreferrer">Agregar en Meta ${LW_IC.ext}</a></div>
      <div class="lw-pie"><span>Cuando todo esté listo, aquí mismo se activan con un toque.</span><button type="button" class="lw-btn" data-lw-activar="${l.id}" ${limOk && !x.guardando ? '' : 'disabled'}>${x.guardando ? 'Activando…' : 'Activar llamadas'}</button></div></div></div>`;
}

function lwAjustes(l, x){
  if (!x.ajustes) return `<div class="lw"><div class="lw-carga">${x.error ? `${esc(x.error)} <button type="button" class="ln-lnk" data-lw-releer="${l.id}">Volver a intentar</button>` : 'Leyendo los ajustes en Meta…'}</div></div>`;
  const a = x.ajustes, c = LLAM.lineas[l.id] || {grabar: true}, i = CFG.lineas.findIndex(y => y.id === l.id), eq = (CFG.lineas[i] || {}).eq || 'Ventas';
  const hor = (CFG.horario || []).map((f, d) => [d, f]).filter(([, f]) => Array.isArray(f) && f[3]);
  const dias = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  // Días seguidos con la misma franja van juntos («Lun a vie 8:00 a. m. – 6:00 p. m.»).
  const tramos = []; for (const [d, f] of hor) { const u = tramos[tramos.length - 1]; if (u && u.f[1] === f[1] && u.f[2] === f[2] && u.hasta === d - 1) u.hasta = d; else tramos.push({desde: d, hasta: d, f}); }
  const cupo = Math.min(100, x.cupo || 0);
  const saludo = a.saludoMediaId
    ? `<div class="lw-audio"><button type="button" class="lw-pl" data-lw-oir="${l.id}" ${a.saludoUrl ? '' : 'disabled'} aria-label="Oír el saludo">${x.oyendo ? LW_IC.pausa : LW_IC.play}</button><div><b>Saludo del buzón</b><small>${a.saludoSeg ? `Grabado · ${mmss(a.saludoSeg)}` : 'Grabado'}</small></div>${lwBotonesSaludo(l.id, x)}</div>`
    : `<div class="lw-audio sin"><div><b>Saludo del buzón</b><small>Todavía no hay saludo: grábalo o sube un audio de menos de 1 minuto</small></div>${lwBotonesSaludo(l.id, x)}</div>`;
  return `<div class="lw${x.guardando ? ' guardando' : ''}">
    <div class="lw-sync">${LW_IC.sync}<span>Activadas en Meta${a.sincronizado ? ` · sincronizado ${lwHace(a.sincronizado)}` : ''}</span><em>El botón de llamar puede tardar hasta 7 días en salir en todos los teléfonos.</em></div>
    ${(a.restricciones || []).length ? `<div class="ll-nota">Meta tiene restringidas las llamadas de esta línea${a.restricciones[0].vence ? ` hasta el ${new Date(a.restricciones[0].vence * 1000).toLocaleDateString('es-CO', {day: 'numeric', month: 'short'})}` : ''}: ${esc(a.restricciones[0].motivo || 'por baja tasa de llamadas contestadas')}.</div>` : ''}
    ${lwGrupo('Cuando un cliente llama', `
      ${lwFila('Quién contesta', 'Suena a las personas conectadas del equipo; la toma la primera que conteste', ddSel('data-cfg-lineq', EQUIPOS.map(e => [`${i}|${e.n}`, e.n]), `${i}|${eq}`))}
      ${lwFila('Cuánto timbra antes del buzón', 'Meta deja hasta 30 segundos', lwSeg(`data-lw-timbre="${l.id}" data-v`, [[15, '15 s'], [20, '20 s'], [30, '30 s']], a.timbre))}
      ${lwFila('Buzón de voz', 'Si nadie contesta o se rechaza, suena tu saludo y el cliente deja un mensaje que llega a su conversación. Necesita un saludo grabado (menos de 1 minuto)', lwTg(a.buzon, 'Buzón de voz', `data-lw-tg="${l.id}|buzon"`))}
      <div class="lw-sub">${saludo}</div>
      ${lwFila('Horario para recibir llamadas', 'Fuera de este horario el botón de llamar se oculta y el cliente ve cuándo puede llamar', lwSeg(`data-lw-horario="${l.id}" data-v`, [['atencion', 'Igual que la atención'], ['propio', 'Propio']], a.horario))}
      ${a.horario === 'propio' ? `<div class="lw-sub">${lwHorPropio(l.id, a)}</div>` : `<div class="lw-sub lw-hor">${tramos.length ? tramos.map(t => `<span><b>${t.desde === t.hasta ? dias[t.desde] : `${dias[t.desde]} a ${dias[t.hasta].toLowerCase()}`}</b> ${esc(horaCfg(t.f[1]))} – ${esc(horaCfg(t.f[2]))}</span>`).join('') : '<span>Sin horario de atención: se reciben llamadas a toda hora</span>'}<span><b>Festivos de Colombia</b> cerrado, se cargan solos</span></div>`}`)}
    ${lwGrupo('En el WhatsApp del cliente', `
      ${lwFila('Botón de llamar en el chat', 'El ícono de teléfono arriba en la conversación con tu empresa', lwTg(a.boton, 'Botón de llamar', `data-lw-tg="${l.id}|boton"`))}
      ${lwFila('Pedir permiso para devolver la llamada', 'Si llama y no le contestan, WhatsApp le pregunta si podemos llamarlo después', lwTg(a.devolver, 'Permiso para devolver la llamada', `data-lw-tg="${l.id}|devolver"`))}`)}
    ${lwGrupo('Cuando llamas a un cliente', `
      ${lwFila('Permiso del cliente', 'Hay que pedirlo por el chat; dura 7 días. Máximo 1 solicitud al día y 2 por semana', '<span class="lw-fijo">Lo pide el asesor</span>')}
      ${lwFila('Horario permitido', 'Lunes a viernes 7 a. m. – 7 p. m. y sábados 8 a. m. – 3 p. m.; nunca domingos ni festivos (Ley 2300)', '<span class="lw-fijo">Fijo por ley</span>')}
      ${lwFila('Llamadas contestadas por día', 'Meta deja 100 al día por número', `<span class="lw-cupo"><i style="width:${cupo}%"></i></span><span class="lw-n">${cupo} de 100</span>`)}`)}
    ${lwGrupo('Grabación', `
      ${lwFila('Grabar las llamadas', 'Se graban desde el navegador de quien atiende y la grabación queda en la conversación', lwTg(c.grabar !== false, 'Grabar las llamadas', `data-lw-grabar="${l.id}"`))}`)}
    <div class="lw-fin">${x.desactivar
      ? `<span class="lw-conf">Tus clientes ya no podrán llamarte.</span><button type="button" class="btn" data-lw-desno="${l.id}">Cancelar</button><button type="button" class="btn lw-rojo" data-lw-desok="${l.id}">Desactivar</button>`
      : `<button type="button" class="lw-desact" data-lw-des="${l.id}">Desactivar llamadas en esta línea</button>`}</div>
  </div>`;
}
/* Horario propio (maqueta «Horario propio de llamadas», dirección A): un día por fila con su interruptor y su franja. */
const lwFilasPropio = a => Array.isArray(a.horarioPropio) && a.horarioPropio.length === 7 ? a.horarioPropio.map(f => [...f]) : (CFG.horario || []).map(f => [...f]);
const LW_HORAS = Array.from({length: 48}, (_, i) => `${Math.floor(i / 2)}:${i % 2 ? '30' : '00'}`).concat('23:59');
function lwHora(id, d, k, v){
  const min = s => { const m = String(s).match(/^(\d{1,2}):(\d{2})$/); return m ? +m[1] * 60 + +m[2] : 0; };
  const ops = LW_HORAS.includes(v) ? LW_HORAS : [...LW_HORAS, v].sort((x, y) => min(x) - min(y));
  return `<label class="hp-h"><select data-lw-hora="${id}|${d}|${k}" aria-label="${k === 1 ? 'Desde' : 'Hasta'}">${ops.map(h => `<option value="${h}"${h === v ? ' selected' : ''}>${esc(horaCfg(h))}</option>`).join('')}</select><svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></label>`;
}
function lwHorPropio(id, a){
  return `<div class="hp">${lwFilasPropio(a).map(([d, de, ha, on], i) => `<div class="hp-fila${on ? '' : ' cerrado'}"><span class="hp-d">${esc(d)}</span>${lwTg(on, `Recibir llamadas el ${esc(d)}`, `data-lw-dia="${id}|${i}"`)}${on ? `<span class="hp-r">${lwHora(id, i, 1, de)}<i>a</i>${lwHora(id, i, 2, ha)}</span>` : '<span class="hp-c">No recibe llamadas</span>'}</div>`).join('')}
    <div class="hp-pie"><button type="button" class="hp-lnk" data-lw-copiarhor="${id}">Copiar el horario de atención</button><span><b>Festivos de Colombia</b> cerrado, se cargan solos</span></div></div>`;
}
function lwGuardarPropio(id, filas, ok){ return lwCambiar(id, {horario: 'propio', horarioPropio: filas}, ok); }
document.getElementById('page').addEventListener('change', e => {
  const s = e.target.closest && e.target.closest('[data-lw-hora]'); if (!s || st.pagina !== 'cfg-lineas') return;
  const [id, d, k] = s.dataset.lwHora.split('|'), x = LW[id]; if (!x || !x.ajustes) return;
  const filas = lwFilasPropio(x.ajustes); filas[+d][+k] = s.value;
  lwGuardarPropio(id, filas, 'Horario de llamadas guardado en Meta');
});
const lwBotonesSaludo = (id, x) => x.grabando
  ? `<button type="button" class="lw-mini rec" data-lw-parar="${id}">${LW_IC.mic}Detener · <span data-lw-seg>0:00</span></button>`
  : x.subiendo ? '<span class="lw-fijo">Subiendo el saludo…</span>'
  : `<button type="button" class="lw-mini" data-lw-grabarsaludo="${id}">${LW_IC.mic}${(LW[id] || {}).ajustes && LW[id].ajustes.saludoMediaId ? 'Grabar otro' : 'Grabar'}</button><button type="button" class="lw-mini" data-lw-subir="${id}">Subir audio</button>`;

/* Saludo del buzón: grabarlo aquí o subir un audio; la Nube lo convierte al formato de Meta (llamadas.ts). */
async function lwSaludo(id, file, seg){
  const x = LW[id] || (LW[id] = {});
  if (seg && seg >= 60) { toast('El saludo debe durar menos de 1 minuto'); return; }
  x.subiendo = true; render();
  try {
    const r = await crmSubir(file);
    const s = await crmApi('POST', `/crm/lineas/${id}/llamadas/saludo`, {url: r.url, seg: seg || null});
    x.ajustes = s.ajustes; lwLineaNueva(s.linea); toast('Saludo del buzón guardado en Meta');
  } catch (e) { toast(e.message || 'No se pudo guardar el saludo'); }
  finally { x.subiendo = false; render(); }
}
async function lwGrabarSaludo(id){
  const x = LW[id] || (LW[id] = {});
  let mic;
  try { mic = await navigator.mediaDevices.getUserMedia({audio: true}); }
  catch { toast('Permite el micrófono en el navegador para grabar el saludo'); return; }
  const tipo = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
  const r = new MediaRecorder(mic, tipo ? {mimeType: tipo} : undefined), trozos = [], inicio = Date.now();
  r.ondataavailable = e => { if (e.data && e.data.size) trozos.push(e.data); };
  r.onstop = () => {
    mic.getTracks().forEach(t => t.stop()); clearInterval(x.reloj); x.grabando = null;
    const seg = (Date.now() - inicio) / 1000, mime = (r.mimeType || 'audio/webm').split(';')[0];
    lwSaludo(id, new File(trozos, `saludo.${/mp4/.test(mime) ? 'm4a' : 'webm'}`, {type: mime}), seg);
  };
  r.start(250); x.grabando = r; render();
  x.reloj = setInterval(() => {
    const s = Math.floor((Date.now() - inicio) / 1000), el = document.querySelector('[data-lw-seg]'); if (el) el.textContent = mmss(s);
    if (s >= 58 && r.state === 'recording') r.stop(); // Meta: menos de 1 minuto
  }, 250);
}
let lwAudio = null;

document.getElementById('page').addEventListener('click', e => {
  if (st.pagina !== 'cfg-lineas') return; const t = e.target;
  const ac = t.closest('[data-lw-activar], [data-lw-encender]'); if (ac && !ac.disabled) { const id = ac.dataset.lwActivar || ac.dataset.lwEncender; lwCambiar(id, {activas: true}, 'Llamadas activadas en Meta').then(() => { if (metaLlamadas(lineaDe(id))) st.lnAbierto[id] = 'aj'; render(); }); return; }
  const rl = t.closest('[data-lw-releer]'); if (rl) { lwCargar(rl.dataset.lwReleer, true); render(); return; }
  const ap = t.closest('[data-lw-apagar]'); if (ap) { const id = ap.dataset.lwApagar; st.lnAbierto[id] = 'aj'; (LW[id] || (LW[id] = {})).desactivar = true; render(); setTimeout(() => { const f = document.querySelector('.lw-fin'); if (f) f.scrollIntoView({block: 'center', behavior: 'smooth'}); }, 50); return; }
  const de = t.closest('[data-lw-des]'); if (de) { (LW[de.dataset.lwDes] || (LW[de.dataset.lwDes] = {})).desactivar = true; render(); return; }
  const dn = t.closest('[data-lw-desno]'); if (dn) { LW[dn.dataset.lwDesno].desactivar = false; render(); return; }
  const dk = t.closest('[data-lw-desok]'); if (dk) { const id = dk.dataset.lwDesok; LW[id].desactivar = false; lwCambiar(id, {activas: false}, 'Llamadas desactivadas en la línea').then(() => { st.lnAbierto[id] = ''; render(); }); return; }
  const tg = t.closest('[data-lw-tg]'); if (tg) { const [id, k] = tg.dataset.lwTg.split('|'), a = (LW[id] || {}).ajustes || {}; lwCambiar(id, {[k]: !a[k]}, !a[k] ? 'Activado en Meta' : 'Apagado en Meta'); return; }
  const tm = t.closest('[data-lw-timbre]'); if (tm) { lwCambiar(tm.dataset.lwTimbre, {timbre: Number(tm.dataset.v)}, `Timbra ${tm.dataset.v} segundos antes del buzón`); return; }
  const ho = t.closest('[data-lw-horario]'); if (ho) { const id = ho.dataset.lwHorario, a = (LW[id] || {}).ajustes || {};
    if (ho.dataset.v === a.horario) return;
    if (ho.dataset.v === 'propio') lwGuardarPropio(id, lwFilasPropio(a), 'Horario propio: ajústalo día por día');
    else lwCambiar(id, {horario: 'atencion'}, 'Las llamadas siguen el horario de atención');
    return; }
  const dia = t.closest('[data-lw-dia]'); if (dia) { const [id, d] = dia.dataset.lwDia.split('|'), x = LW[id]; const filas = lwFilasPropio(x.ajustes); filas[+d][3] = !filas[+d][3]; lwGuardarPropio(id, filas, filas[+d][3] ? `${filas[+d][0]}: recibe llamadas` : `${filas[+d][0]}: no recibe llamadas`); return; }
  const cp = t.closest('[data-lw-copiarhor]'); if (cp) { lwGuardarPropio(cp.dataset.lwCopiarhor, (CFG.horario || []).map(f => [...f]), 'Se copió el horario de atención'); return; }
  const gr = t.closest('[data-lw-grabar]'); if (gr) { const id = gr.dataset.lwGrabar; ajLinea(id); LLAM.lineas[id].grabar = LLAM.lineas[id].grabar === false; render(); toast(LLAM.lineas[id].grabar ? 'Las llamadas se graban' : 'Las llamadas ya no se graban'); return; }
  const gs = t.closest('[data-lw-grabarsaludo]'); if (gs) { lwGrabarSaludo(gs.dataset.lwGrabarsaludo); return; }
  const pa = t.closest('[data-lw-parar]'); if (pa) { const r = (LW[pa.dataset.lwParar] || {}).grabando; if (r && r.state === 'recording') r.stop(); return; }
  const su = t.closest('[data-lw-subir]'); if (su) { const id = su.dataset.lwSubir;
    elegirArchivo('audio/*', f => { const a = new Audio(URL.createObjectURL(f)); a.onloadedmetadata = () => lwSaludo(id, f, a.duration); a.onerror = () => lwSaludo(id, f, null); }); return; }
  const oi = t.closest('[data-lw-oir]'); if (oi && !oi.disabled) { const id = oi.dataset.lwOir, x = LW[id];
    if (lwAudio) { lwAudio.pause(); const era = lwAudio.id; lwAudio = null; Object.values(LW).forEach(y => { y.oyendo = false; }); render(); if (era === id) return; }
    const a = new Audio(x.ajustes.saludoUrl); a.id = id; lwAudio = a; x.oyendo = true; a.onended = () => { x.oyendo = false; lwAudio = null; render(); };
    a.play().then(render).catch(() => { x.oyendo = false; lwAudio = null; toast('No se pudo reproducir el saludo'); }); return; }
});
/* Si alguien cambia las llamadas desde Meta (o desde otra pestaña), se vuelven a leer. */
document.addEventListener('crm:evento', e => { const d = e.detail || {}; if (d.tipo === 'linea' && d.linea && LW[d.linea.id] && LW[d.linea.id].ajustes && !LW[d.linea.id].guardando) { const m = (d.linea.ajustes || {}).llamadasMeta; if (m) { LW[d.linea.id].ajustes = m; if (st.pagina === 'cfg-lineas') render(); } } });

document.head.insertAdjacentHTML('beforeend', `<style>
.lw{padding:4px 16px 16px 58px;display:grid;gap:16px;animation:lw-in .4s cubic-bezier(.16,1,.3,1)}
@keyframes lw-in{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
.lw.guardando{opacity:.7;pointer-events:none;transition:opacity .2s}
.lw svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;flex:none}
.lw-carga{font-size:13px;color:var(--ink3);padding:6px 0}
.lw-req{border:1px solid var(--line);border-radius:12px;padding:14px 16px;display:grid;gap:10px;background:#fbfbfc}
.lw-reqh b{display:block;font-size:13.5px}.lw-reqh small{font-size:12.5px;color:var(--ink3)}
.lw-it{display:flex;align-items:center;gap:10px;font-size:13px;color:var(--ink2)}
.lw-it span{flex:1}.lw-it em{font-style:normal;font-size:12.5px;font-weight:600}
.lw-it.listo svg{color:#16a34a}.lw-it.listo em{color:#15803d}
.lw-it.falta svg{color:#d97706}.lw-it.falta em{color:#b45309}
.lw-it a{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;font-weight:600;color:var(--ink);text-decoration:underline;text-underline-offset:3px}
.lw-it a svg{width:13px;height:13px}
.lw-pie{display:flex;align-items:center;gap:12px;padding-top:10px;border-top:1px solid var(--line);font-size:12.5px;color:var(--ink3)}.lw-pie span{flex:1}
.lw-btn{height:36px;padding:0 14px;border:0;border-radius:10px;background:#FFD21F;font:inherit;font-size:13px;font-weight:700;cursor:pointer}
.lw-btn:disabled{background:#f1f5f9;color:var(--ink4);cursor:not-allowed}
.lw-sync{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12.5px;color:#15803d;font-weight:600}
.lw-sync em{font-style:normal;font-weight:400;color:var(--ink3);flex-basis:100%;padding-left:24px}
.lw-g{display:grid;gap:0;border:1px solid var(--line);border-radius:12px;overflow:hidden}
.lw-gt{display:block;padding:9px 14px;background:#fbfbfc;border-bottom:1px solid var(--line);font-size:11.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--ink3)}
.lw-f{display:flex;align-items:center;gap:14px;padding:11px 14px;border-top:1px solid var(--line)}
.lw-gt + .lw-f{border-top:0}
.lw-tx{flex:1;min-width:0;display:grid}.lw-tx b{font-size:13.5px;font-weight:600}.lw-tx small{font-size:12.5px;color:var(--ink3)}
.lw-ctl{display:flex;align-items:center;gap:8px;flex:none}
.lw-seg{display:inline-flex;padding:3px;border-radius:10px;background:#f1f5f9;gap:2px}
.lw-seg button{height:28px;padding:0 10px;border:0;border-radius:8px;background:none;font:inherit;font-size:12.5px;color:var(--ink3);cursor:pointer;white-space:nowrap}
.lw-seg button[aria-checked="true"]{background:#fff;color:var(--ink);font-weight:600;box-shadow:0 1px 2px rgba(15,23,42,.12)}
.lw-sub{padding:0 14px 12px}
.lw-audio{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:#f6f7f9}
.lw-audio > div{flex:1;min-width:0;display:grid}.lw-audio b{font-size:13px}.lw-audio small{font-size:12px;color:var(--ink3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.lw-audio.sin small{white-space:normal}
.lw-pl{width:32px;height:32px;border-radius:50%;border:0;background:#0b0b10;color:#fff;display:grid;place-items:center;flex:none;cursor:pointer}.lw-pl svg{width:13px;height:13px;fill:#fff;stroke:none}
.lw-pl:disabled{opacity:.4;cursor:default}
.lw-mini{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 10px;border:1px solid var(--line);border-radius:8px;background:#fff;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;white-space:nowrap}
.lw-mini svg{width:14px;height:14px}
.lw-mini.rec{border-color:#fecaca;color:#b91c1c;background:#fef2f2}
.lw-hor{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:12.5px;color:var(--ink2)}.lw-hor b{font-weight:600;color:var(--ink)}
.lw-fijo{font-size:12.5px;font-weight:600;color:var(--ink3);white-space:nowrap}
.lw-cupo{width:90px;height:6px;border-radius:3px;background:#eef1f5;overflow:hidden}.lw-cupo i{display:block;height:100%;background:#0b0b10;border-radius:3px}
.lw-n{font-size:12.5px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
.lw-fin{display:flex;align-items:center;justify-content:flex-start;gap:8px;flex-wrap:wrap}
.lw-conf{font-size:13px;color:var(--ink2);margin-right:4px}
.lw-desact{border:0;background:none;padding:4px 0;font:inherit;font-size:13px;font-weight:600;color:#b91c1c;cursor:pointer}
.lw-desact:hover{text-decoration:underline}
.btn.lw-rojo{background:#dc2626;border-color:#dc2626;color:#fff}
/* Horario propio, un día por fila */
.hp{display:grid;gap:0;border:1px solid var(--line);border-radius:10px;overflow:hidden;background:#fff;animation:lw-in .35s cubic-bezier(.16,1,.3,1)}
.hp svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.hp-fila{display:flex;align-items:center;gap:12px;padding:8px 12px;border-top:1px solid var(--line2)}
.hp-fila:first-child{border-top:0}
.hp-d{width:86px;font-size:13px;font-weight:600}
.hp-r{display:flex;align-items:center;gap:6px;margin-left:auto}.hp-r i{font-style:normal;font-size:12.5px;color:var(--ink3)}
.hp-h{position:relative;display:inline-flex;align-items:center;height:30px;border:1px solid var(--line);border-radius:8px;background:#fff;white-space:nowrap}
.hp-h select{appearance:none;-webkit-appearance:none;border:0;background:none;height:100%;padding:0 28px 0 10px;font:inherit;font-size:12.5px;font-variant-numeric:tabular-nums;color:var(--ink);cursor:pointer}
.hp-h select:focus-visible{outline:2px solid #FFD21F;outline-offset:1px;border-radius:7px}
.hp-h svg{position:absolute;right:8px;pointer-events:none;color:var(--ink3)}
.hp-c{margin-left:auto;font-size:12.5px;color:var(--ink3)}
.hp-fila.cerrado .hp-d{color:var(--ink3)}
.hp-pie{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:9px 12px;background:#fbfbfc;border-top:1px solid var(--line);font-size:12.5px;color:var(--ink2)}
.hp-pie b{font-weight:600;color:var(--ink)}
.hp-lnk{border:0;background:none;padding:0;font:inherit;font-size:12.5px;font-weight:600;color:var(--blue-ink);cursor:pointer}
@media (max-width:600px){.hp-fila{flex-wrap:wrap}.hp-r{margin-left:0;width:100%}}
@media (max-width:600px){.lw{padding-left:16px}.lw-f{flex-wrap:wrap}.lw-ctl{width:100%}}
@media (prefers-reduced-motion:reduce){.lw{animation:none}}
</style>`);
