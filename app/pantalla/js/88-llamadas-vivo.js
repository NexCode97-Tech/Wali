/* ── Llamadas por WhatsApp en vivo (maquetas aprobadas «Llamadas», 24-oct): la tarjeta va en la ficha del contacto,
   debajo de Agregar, Editar, Transferir y Llamar. Suena en verde suave; en llamada es blanca con Silenciar, Nota y
   Colgar; al colgar se encoge y en el chat queda la llamada con su duración, la grabación y la nota. Para llamar al
   cliente hace falta su permiso: diálogo con la vista de cómo le llega, la solicitud en el chat y el aviso cuando acepta.
   El audio va directo entre este navegador y WhatsApp (WebRTC); el servidor solo pasa la oferta y la respuesta
   (llamadasVivo.ts). La grabación la hace el navegador, porque Meta no graba, y se sube a la Nube al colgar.
   Todo lo que se pinta va escapado con esc(); los fragmentos se arman con createContextualFragment. ── */
const lvFrag = h => document.createRange().createContextualFragment(h);
const LV_SV = (p, c = 'i') => `<svg class="${c}" viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
const LV_TELP = '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>';
const LV_IC = {
  tel: LV_SV(LV_TELP), colgar: LV_SV(LV_TELP, 'i colgar'),
  mic: LV_SV('<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4"/><path d="M3 3l18 18"/>'),
  rec: LV_SV('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5" fill="currentColor"/>'),
  nota: LV_SV('<path d="M4 20h4L19 9l-4-4L4 16v4Z"/>'),
  ent: LV_SV('<path d="M17 7 7 17M17 17H7V7"/>'), sal: LV_SV('<path d="M7 17 17 7M7 7h10v10"/>'),
  play: LV_SV('<path d="M7 5v14l11-7z" fill="currentColor"/>'), pausa: LV_SV('<path d="M8 5v14M16 5v14"/>'),
  ok: LV_SV('<path d="m5 12 5 5L20 7"/>'), reloj: LV_SV('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  info: LV_SV('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'), no: LV_SV('<path d="M18 6 6 18M6 6l12 12"/>'),
};
const lvOnda = n => '<span class="lcd-onda">' + Array.from({length:n}, (_, i) => `<i style="--d:${(i * 37) % 9 / 10}s;--h:${6 + (i * 53) % 14}px"></i>`).join('') + '</span>';

/** La llamada de este navegador (una a la vez) y las entrantes que suenan en el espacio. */
let LV = null;
const LV_SUENAN = new Map();
/** Llamadas que acaban de terminar: su registro entra al chat con motion. */
const LV_FIN = new Set();
const lvYo = () => (typeof CRM_YO === 'object' && CRM_YO && CRM_YO.id) || '';
const lvConv = id => CONV.find(c => c.id === id);
const lvAvatar = c => `<span class="lcd-av" style="background:${AVC[(c ? c.id : 0) % AVC.length]}">${esc(ini(c ? c.n : '?'))}</span>`;
const lvMmss = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
function lvBuzon(lineaId){
  const m = ((lineaDe(lineaId) || {}).ajustes || {}).llamadasMeta || {};
  return m.buzon ? `${m.timbre ?? 20} s para contestar, si no va al buzón` : 'Contesta en menos de 30 segundos';
}

/** La tarjeta de la ficha para la conversación abierta, si hay una llamada de ella. */
function lvTarjeta(c){
  if (LV && LV.convId === c.id) {
    if (LV.fase === 'llamando') return `<div class="lcd sale">
      <div class="lcd-f">${lvAvatar(c)}<div class="lcd-tx"><small>Llamada saliente</small><b>${LV.timbra ? 'Timbrando…' : 'Llamando…'}</b></div><span class="lcd-dots"><i></i><i></i><i></i></span></div>
      <div class="lcd-bt uno"><button type="button" class="lcd-b rojo" data-lv-colgar>${LV_IC.colgar}Cancelar</button></div>
      <small class="lcd-pie">Si no contesta, queda como llamada no contestada. 4 seguidas le quitan el permiso.</small></div>`;
    if (LV.fase === 'conectando') return `<div class="lcd sale"><div class="lcd-f">${lvAvatar(c)}<div class="lcd-tx"><small>Llamada de WhatsApp</small><b>Conectando…</b></div><span class="lcd-dots"><i></i><i></i><i></i></span></div></div>`;
    return `<div class="lcd en${LV.silencio ? ' silencio' : ''}${LV.entra ? ' entra' : ''}">
      <div class="lcd-f">${lvAvatar(c)}<div class="lcd-tx"><small>${LV.rec ? `<span class="lcd-rec">${LV_IC.rec}</span>Grabando` : 'En llamada'}</small><b class="lcd-t" data-lv-reloj>${lvMmss(Date.now() - (LV.desde || Date.now()))}</b></div>${lvOnda(11)}</div>
      <div class="lcd-ctl"><button type="button" class="${LV.silencio ? 'osc' : ''}" data-lv-silencio aria-pressed="${!!LV.silencio}">${LV_IC.mic}<span>${LV.silencio ? 'Silenciado' : 'Silenciar'}</span></button><button type="button" class="${LV.notaAbierta ? 'on' : ''}" data-lv-nota aria-expanded="${!!LV.notaAbierta}">${LV_IC.nota}<span>Nota</span></button><button type="button" class="rojo" data-lv-colgar>${LV_IC.colgar}<span>Colgar</span></button></div>
      <div class="lcd-nota-w${LV.notaAbierta ? '' : ' cerrada'}"><div class="lcd-nota-in"><textarea class="lcd-nota" data-lv-texto rows="2" maxlength="2000" placeholder="Escribe la nota de la llamada…" aria-label="Nota de la llamada">${esc(LV.nota || '')}</textarea></div></div></div>`;
  }
  const s = [...LV_SUENAN.values()].find(x => x.convId === c.id);
  if (s && !(LV && LV.id === s.id)) return `<div class="lcd suena">
    <div class="lcd-f">${lvAvatar(c)}<div class="lcd-tx"><small>Llamada de WhatsApp</small><b>Te está llamando</b></div></div>
    <div class="lcd-bt"><button type="button" class="lcd-b rojo" data-lv-rechazar="${esc(s.id)}">${LV_IC.colgar}Rechazar</button><button type="button" class="lcd-b verde" data-lv-contestar="${esc(s.id)}" ${LV ? 'disabled title="Ya estás en otra llamada"' : ''}>${LV_IC.tel}Contestar</button></div>
    <small class="lcd-pie">${esc(lvBuzon(s.linea))}</small></div>`;
  return '';
}
/** Pone (o quita) la tarjeta en la ficha. `salida`: la tarjeta se encoge antes de irse (motion de Colgar). */
function lvPintar(salida){
  const pn = document.getElementById('panel'), acts = pn && pn.querySelector('.contact .pc-acts');
  const c = lvConv(st.sel);
  const w = pn && pn.querySelector('.lcd-w');
  const html = c && acts ? lvTarjeta(c) : '';
  if (!html) {
    if (w && salida && !w.classList.contains('sale')) { w.classList.add('sale'); setTimeout(() => w.remove(), 420); }
    else if (w && !salida) w.remove();
  } else if (w) { w.classList.remove('sale'); w.firstElementChild.replaceChildren(lvFrag(html)); }
  else acts.insertAdjacentElement('afterend', Object.assign(document.createElement('div'), {className: 'lcd-w'})).append(Object.assign(document.createElement('div'), {className: 'lcd-in'}));
  if (html && !w) pn.querySelector('.lcd-w .lcd-in').replaceChildren(lvFrag(html));
  // Botón Llamar en verde cuando el cliente ya dio permiso (maqueta «Aceptó»).
  const b = document.getElementById('b-call');
  if (b && c) b.classList.toggle('pr-llamar', lvConPermiso(c));
  if (LV) LV.entra = false;
}
const lvConPermiso = c => { const p = c && c.permisoLlamadas; return !!(p && p.acepta && (p.permanente || !p.vence || new Date(p.vence) > new Date())); };
const lvPanelSin = panel;
panel = function(c){ const r = lvPanelSin.apply(this, arguments); lvPintar(); return r; };
setInterval(() => { if (!LV || !LV.desde) return; const r = document.querySelector('[data-lv-reloj]'); if (r) r.textContent = lvMmss(Date.now() - LV.desde); }, 500);

/* Timbre: dos tonos cortos cada 2 s mientras suena una entrante. */
let lvTimbre = null;
function lvSonar(on){
  if (!on) { if (lvTimbre) { clearInterval(lvTimbre.t); lvTimbre.ctx.close().catch(() => {}); lvTimbre = null; } return; }
  if (lvTimbre) return;
  try {
    const ctx = new AudioContext(), tono = (f, en) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f; g.gain.setValueAtTime(0.0001, ctx.currentTime + en); g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + en + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + en + 0.35); o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + en); o.stop(ctx.currentTime + en + 0.4); };
    const sonar = () => { tono(880, 0); tono(660, 0.45); };
    sonar(); lvTimbre = {ctx, t: setInterval(sonar, 2000)};
  } catch { /* sin audio en este navegador */ }
}

/* ── Audio: micrófono, conexión con WhatsApp y grabación ── */
async function lvMicrofono(){
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Este navegador no deja usar el micrófono');
  try { return await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true}}); }
  catch (e) { throw new Error(e && e.name === 'NotAllowedError' ? 'Permite el micrófono en el navegador para hablar por WhatsApp' : 'No se pudo abrir el micrófono'); }
}
function lvConexion(mic){
  const pc = new RTCPeerConnection({iceServers: [{urls: 'stun:stun.l.google.com:19302'}]});
  for (const t of mic.getTracks()) pc.addTrack(t, mic);
  const audio = new Audio(); audio.autoplay = true;
  pc.ontrack = e => { audio.srcObject = e.streams[0] || new MediaStream([e.track]); if (LV && LV.pc === pc) { LV.remoto = audio.srcObject; lvGrabar(); } };
  pc.onconnectionstatechange = () => { if (pc.connectionState === 'failed' && LV && LV.pc === pc) { toast('Se perdió el audio de la llamada'); lvColgar(); } };
  return {pc, audio};
}
/** Espera a que el navegador junte sus rutas de red: Meta recibe el SDP completo, sin candidatos sueltos. */
function lvRutas(pc){
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise(ok => { const fin = () => { pc.removeEventListener('icegatheringstatechange', ver); ok(); }; const ver = () => { if (pc.iceGatheringState === 'complete') fin(); }; pc.addEventListener('icegatheringstatechange', ver); setTimeout(fin, 2500); });
}
/** Graba las dos voces juntas, si la línea graba (Ajustes, Líneas de WhatsApp). */
function lvGrabar(){
  if (!LV || LV.grabador || !LV.remoto || !LV.desde || !window.MediaRecorder) return;
  if ((LLAM.lineas[LV.linea] || {}).grabar === false) { LV.sinGrabar = 'la línea no graba las llamadas'; return; }
  try {
    const ctx = new AudioContext(), dest = ctx.createMediaStreamDestination();
    ctx.createMediaStreamSource(LV.mic).connect(dest); ctx.createMediaStreamSource(LV.remoto).connect(dest);
    const tipo = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => MediaRecorder.isTypeSupported(t)) || '';
    const r = new MediaRecorder(dest.stream, tipo ? {mimeType: tipo} : undefined), trozos = [];
    r.ondataavailable = e => { if (e.data && e.data.size) trozos.push(e.data); };
    r.start(1000);
    LV.grabador = {r, trozos, ctx, tipo: r.mimeType || tipo || 'audio/webm'}; LV.rec = true; lvPintar();
  } catch (e) { LV.sinGrabar = 'el navegador no pudo grabar'; }
}
function lvSoltar(x){
  try { x.pc && x.pc.close(); } catch {}
  try { x.mic && x.mic.getTracks().forEach(t => t.stop()); } catch {}
  try { if (x.audio) x.audio.srcObject = null; } catch {}
}
/** Al terminar: la grabación sube a la Nube y, con la nota, va al registro de la llamada en el chat. */
async function lvCerrar(x){
  lvSoltar(x);
  let audio = '', sinGrabar = x.sinGrabar || '';
  if (x.grabador) {
    const g = x.grabador;
    await new Promise(ok => { g.r.onstop = ok; try { if (g.r.state !== 'inactive') g.r.stop(); else ok(); } catch { ok(); } });
    g.ctx.close().catch(() => {});
    if (g.trozos.length) {
      try {
        const ext = /mp4/.test(g.tipo) ? 'm4a' : 'webm';
        const r = await crmSubir(new File(g.trozos, `llamada-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-')}.${ext}`, {type: g.tipo.split(';')[0]}));
        audio = r.url || '';
      } catch (e) { sinGrabar = 'no se pudo subir la grabación'; toast(`La grabación no se pudo guardar: ${e.message}`); }
    }
  }
  if (x.id && (x.desde || x.nota)) crmApi('POST', `/crm/llamadas/${encodeURIComponent(x.id)}/cierre`, {audio, nota: (x.nota || '').trim(), sinGrabar}).catch(() => {});
}

/* ── Contestar, rechazar, colgar y llamar ── */
async function lvContestar(id){
  const s = LV_SUENAN.get(id); if (!s || LV) return;
  lvSonar(false);
  LV = {id, convId: s.convId, linea: s.linea, dir: 'in', fase: 'conectando', nota: '', notaAbierta: true};
  lvPintar();
  try {
    LV.mic = await lvMicrofono();
    const {pc, audio} = lvConexion(LV.mic); LV.pc = pc; LV.audio = audio;
    await pc.setRemoteDescription({type: 'offer', sdp: s.oferta});
    await pc.setLocalDescription(await pc.createAnswer());
    await lvRutas(pc);
    await crmApi('POST', `/crm/llamadas/${encodeURIComponent(id)}/contestar`, {sdp: pc.localDescription.sdp});
    LV_SUENAN.delete(id);
    LV.fase = 'en'; LV.desde = Date.now(); LV.entra = true; lvGrabar(); lvPintar();
  } catch (e) {
    const x = LV; LV = null; if (x) lvSoltar(x); lvPintar(); toast(e.message || 'No se pudo contestar');
  }
}
function lvRechazar(id){
  lvSonar(false); LV_SUENAN.delete(id); lvPintar(true);
  crmApi('POST', `/crm/llamadas/${encodeURIComponent(id)}/rechazar`).catch(e => toast(e.message));
}
function lvColgar(){
  if (!LV) return;
  const x = LV; LV = null; lvPintar(true); lvCerrar(x);
  if (x.id) crmApi('POST', `/crm/llamadas/${encodeURIComponent(x.id)}/colgar`).catch(() => {});
}
/** Llamar al cliente (ya con permiso). */
async function lvIniciar(c){
  if (LV) { toast('Ya estás en una llamada'); return; }
  LV = {convId: c.id, linea: c.linea, dir: 'out', fase: 'llamando', nota: '', notaAbierta: true};
  lvPintar();
  try {
    LV.mic = await lvMicrofono();
    const {pc, audio} = lvConexion(LV.mic); LV.pc = pc; LV.audio = audio;
    await pc.setLocalDescription(await pc.createOffer({offerToReceiveAudio: true}));
    await lvRutas(pc);
    if (!LV || LV.pc !== pc) return; // canceló mientras conectaba
    const r = await crmApi('POST', `/crm/conversaciones/${c.id}/llamar`, {sdp: pc.localDescription.sdp});
    if (!LV || LV.pc !== pc) { crmApi('POST', `/crm/llamadas/${encodeURIComponent(r.id)}/colgar`).catch(() => {}); return; }
    LV.id = r.id;
  } catch (e) {
    const x = LV; LV = null; if (x) lvSoltar(x); lvPintar(); toast(e.message || 'No se pudo llamar');
  }
}

/** Botón Llamar con todo en regla (20-llamadas.js): si el cliente no ha dado permiso, se le pide. */
async function lvLlamar(c){
  let p;
  try { p = await crmApi('GET', `/crm/conversaciones/${c.id}/permiso-llamada`); }
  catch (e) { toast(e.message || 'No se pudo consultar el permiso en Meta'); return; }
  if (p.puedeLlamar || p.estado === 'temporary' || p.estado === 'permanent') { lvIniciar(c); return; }
  lvDialogoPermiso(c, p);
}

/* ── Pedir permiso (maqueta «Pedir permiso para llamar») ── */
function lvDialogoPermiso(c, p){
  const pila = nombrePila(c), empresa = ((typeof espActual === 'function' && espActual()) || {}).n || 'Tu empresa';
  const texto = `Hola${pila ? ' ' + pila : ''}, ¿te podemos llamar por WhatsApp para atenderte mejor?`;
  const bloqueo = !p.ventana ? 'Pasaron más de 24 horas desde su último mensaje. Cuando te vuelva a escribir, le puedes mandar la solicitud.'
    : !p.puedePedir ? 'WhatsApp deja mandar 1 solicitud al día y 2 por semana a cada persona, y ya se mandaron. Intenta más adelante.' : '';
  abrirDialogo(`<div class="pm"><div class="pm-h"><span class="pm-ic">${LV_IC.tel}</span><div><h3>Pedir permiso para llamar a ${esc(pila || c.n)}</h3><p>WhatsApp solo deja llamar a quien lo autoriza. Le llega este mensaje y elige.</p></div></div>
    <div class="pm-b"><div class="pm-izq"><label class="pm-lb">Mensaje<textarea id="pm-t" maxlength="1024">${esc(texto)}</textarea></label><small class="pm-cnt" id="pm-n">${texto.length} / 1024</small>
      <ul class="pm-info"><li>${LV_IC.ok}<span>Si acepta, le puedes llamar <b>7 días</b>, o siempre si lo elige.</span></li>
        <li>${LV_IC.reloj}<span>Máximo <b>1 solicitud al día</b> y <b>2 por semana</b>. Se reinicia con cualquier llamada contestada.</span></li>
        <li>${LV_IC.info}<span>Sale gratis. WhatsApp solo deja mandarla si te escribió en las <b>últimas 24 horas</b>.</span></li></ul>
      ${bloqueo ? `<div class="ll-nota" style="margin-top:12px">${esc(bloqueo)}</div>` : ''}</div>
      <div class="pm-tel"><small>Así le llega</small><div class="pm-wa"><div class="pm-bur"><span id="pm-v">${esc(texto)}</span><span class="pm-h1">${esc(new Date().toLocaleTimeString('es-CO', {hour: 'numeric', minute: '2-digit'}))}</span></div>
        <div class="pm-perm"><span class="pm-pic">${LV_IC.tel}</span><b>${esc(empresa)} quiere llamarte</b><small>Puedes cambiarlo cuando quieras</small><span class="pm-op">Permitir llamadas</span><span class="pm-op">Ahora no</span></div></div></div></div>
    <div class="pm-f"><button type="button" class="pm-cancel" data-cerrar-dlg="1">Cancelar</button><button type="button" class="pm-send" data-lv-pedir="${c.id}" ${bloqueo ? 'disabled' : ''}>${LV_IC.tel}Enviar solicitud</button></div></div>`, 'pm-dlg');
}
document.getElementById('ov-x').addEventListener('input', e => {
  if (e.target.id !== 'pm-t') return;
  const v = document.getElementById('pm-v'), n = document.getElementById('pm-n');
  if (v) v.textContent = e.target.value;
  if (n) n.textContent = `${e.target.value.length} / 1024`;
});
document.getElementById('ov-x').addEventListener('click', e => {
  const b = e.target.closest('[data-lv-pedir]'); if (!b || b.disabled) return;
  const t = (document.getElementById('pm-t') || {}).value || '';
  b.disabled = true;
  crmApi('POST', `/crm/conversaciones/${b.dataset.lvPedir}/permiso-llamada`, {texto: t.trim()})
    .then(() => { cerrarDialogo(); toast('Solicitud enviada'); })
    .catch(err => { b.disabled = false; toast(err.message || 'No se pudo enviar la solicitud'); });
});

/* ── Botones de la tarjeta ── */
document.addEventListener('click', e => {
  const t = e.target;
  const ct = t.closest('[data-lv-contestar]'); if (ct && !ct.disabled) { lvContestar(ct.dataset.lvContestar); return; }
  const rc = t.closest('[data-lv-rechazar]'); if (rc) { lvRechazar(rc.dataset.lvRechazar); return; }
  if (t.closest('[data-lv-colgar]')) { if (LV && LV.fase === 'llamando' && !LV.id) { const x = LV; LV = null; lvSoltar(x); lvPintar(true); return; } lvColgar(); return; }
  const sb = t.closest('[data-lv-silencio]');
  if (sb && LV && LV.mic) {
    LV.silencio = !LV.silencio; LV.mic.getAudioTracks().forEach(x => { x.enabled = !LV.silencio; });
    const card = document.querySelector('.lcd.en'); if (card) card.classList.toggle('silencio', LV.silencio);
    sb.classList.toggle('osc', LV.silencio); sb.setAttribute('aria-pressed', String(LV.silencio)); sb.querySelector('span').textContent = LV.silencio ? 'Silenciado' : 'Silenciar';
    return;
  }
  const nb = t.closest('[data-lv-nota]');
  if (nb && LV) {
    LV.notaAbierta = !LV.notaAbierta;
    const w = document.querySelector('.lcd-nota-w'); if (w) w.classList.toggle('cerrada', !LV.notaAbierta);
    nb.classList.toggle('on', LV.notaAbierta); nb.setAttribute('aria-expanded', String(LV.notaAbierta));
    if (LV.notaAbierta) setTimeout(() => { const x = document.querySelector('[data-lv-texto]'); if (x) x.focus(); }, 60);
  }
});
document.addEventListener('input', e => { if (e.target.matches && e.target.matches('[data-lv-texto]') && LV) LV.nota = e.target.value; });

/* ── Avisos del servidor ── */
document.addEventListener('crm:evento', e => {
  const d = e.detail || {}; if (d.tipo !== 'llamada' || !d.llamada) return;
  const k = d.llamada, yo = lvYo();
  if (d.fase === 'suena') {
    LV_SUENAN.set(k.id, k);
    lvSonar(true); lvPintar();
    const c = lvConv(k.convId);
    if (st.sel !== k.convId) toast(`${c ? c.n : 'Un cliente'} te está llamando por WhatsApp`);
    return;
  }
  if (d.fase === 'contestada') {
    if (k.por !== yo) { LV_SUENAN.delete(k.id); if (!LV_SUENAN.size) lvSonar(false); lvPintar(true); }
    return;
  }
  if (d.fase === 'llamando' && LV && !LV.id && k.por === yo && k.convId === LV.convId) { LV.id = k.id; return; }
  if (d.fase === 'timbra' && LV && LV.id === k.id) { LV.timbra = true; lvPintar(); return; }
  if (d.fase === 'respuesta' && LV && LV.id === k.id && LV.pc && d.sdp) {
    LV.pc.setRemoteDescription({type: 'answer', sdp: d.sdp}).catch(() => { toast('No se pudo conectar el audio'); lvColgar(); });
    return;
  }
  if (d.fase === 'contesto' && LV && LV.id === k.id && LV.fase !== 'en') { LV.fase = 'en'; LV.desde = Date.now(); LV.entra = true; lvGrabar(); lvPintar(); return; }
  if (d.fase === 'rechazo' && LV && LV.id === k.id) { toast('No contestó'); return; }
  if (d.fase === 'fin') {
    LV_SUENAN.delete(k.id); if (!LV_SUENAN.size) lvSonar(false);
    if (LV && LV.id === k.id) { const x = LV; LV = null; lvCerrar(x); if (d.error && !x.desde) toast(d.error); }
    LV_FIN.add(k.id); lvPintar(true);
  }
});
/** Al entrar con una llamada sonando: que también suene aquí. */
setTimeout(() => crmApi('GET', '/crm/llamadas').then(l => { for (const k of l || []) if (k.dir === 'in' && !k.por && k.oferta) LV_SUENAN.set(k.id, k); if (LV_SUENAN.size) { lvSonar(true); lvPintar(); } }).catch(() => {}), 1500);
window.addEventListener('beforeunload', e => { if (LV) { e.preventDefault(); e.returnValue = ''; } });

/* ── En el chat: la llamada (maqueta «Al colgar»), la solicitud de permiso y el aviso cuando acepta ── */
const lvBurbujaSin = burbuja;
burbuja = function(m){
  if (!m.call) return lvBurbujaSin(m);
  const k = m.call, ok = k.estado === 'ok', entra = k.id && LV_FIN.has(k.id);
  if (entra) LV_FIN.delete(k.id);
  const titulo = ok ? `${k.dir === 'in' ? 'Llamada entrante' : 'Llamada saliente'} · ${mmss(k.dur || 0)}`
    : k.estado === 'buzon' ? 'Llamada perdida · dejó un mensaje de voz' : k.estado === 'perdida' ? 'Llamada perdida' : 'Llamada saliente · no contestó';
  const sub = ok ? `${k.dir === 'in' ? 'Contestó' : 'Llamó'} ${esc(k.quien || 'el equipo')}${m.h ? ' · ' + esc(m.h) : ''}` : `${esc(lineaDe(k.linea).n)}${m.h ? ' · ' + esc(m.h) : ''}${k.error ? ' · ' + esc(k.error) : ''}`;
  const audio = k.audio && /^https:\/\//.test(k.audio) ? `<button type="button" class="lc-ply" data-lv-oir="${esc(k.audio)}">${LV_IC.play}Grabación</button>` : '';
  return `<div class="lc-log${entra ? ' entra' : ''}"><div class="lc-ll${ok ? '' : ' mal'}">${k.dir === 'in' ? LV_IC.ent : LV_IC.sal}<div><b>${titulo}</b><small>${sub}</small></div>${audio}</div>
    ${k.nota ? `<div class="lc-nl">${LV_IC.nota}<span><b>Nota de la llamada:</b> ${esc(k.nota)}</span></div>` : ''}
    ${ok && !audio && k.sinGrabar ? `<small class="lc-sg">No se grabó: ${esc(k.sinGrabar)}</small>` : ''}</div>`;
};
let lvOyendo = null;
const lvBotonOir = (b, sonando) => b.replaceChildren(lvFrag(sonando ? `${LV_IC.pausa}Pausar` : `${LV_IC.play}Grabación`));
document.addEventListener('click', e => {
  const b = e.target.closest('[data-lv-oir]'); if (!b) return;
  if (lvOyendo && lvOyendo.b === b) { lvOyendo.a.pause(); lvBotonOir(b, false); lvOyendo = null; return; }
  if (lvOyendo) { lvOyendo.a.pause(); lvBotonOir(lvOyendo.b, false); }
  const a = new Audio(b.dataset.lvOir); lvOyendo = {a, b};
  a.onended = () => { lvBotonOir(b, false); lvOyendo = null; };
  a.play().then(() => lvBotonOir(b, true)).catch(() => toast('No se pudo reproducir la grabación'));
});
const lvSueltoSin = chSuelto;
chSuelto = function(m){
  if (m.ev && m.permiso === 'ok') { const [a, ...r] = String(m.t || '').split(' · '); return `<div class="ch-ev pr-ok">${LV_IC.ok}<span><b>${esc(a)}</b>${r.length ? ' · ' + esc(r.join(' · ')) : ''}</span></div>`; }
  return lvSueltoSin.apply(this, arguments);
};
const lvOutSin = chBloqueOut;
chBloqueOut = function(m, ult){
  if (!m.permisoLlamada || m._estado === 'fallido') return lvOutSin.apply(this, arguments);
  const vencida = !m.permisoResp && m._t && Date.now() - new Date(m._t).getTime() > 7 * 86400e3;
  const est = m.permisoResp === 'acepto' ? `${LV_IC.ok}Aceptó` : m.permisoResp === 'rechazo' ? `${LV_IC.no}No aceptó` : vencida ? `${LV_IC.reloj}Venció sin respuesta` : `${LV_IC.reloj}Esperando respuesta · vence en 7 días`;
  // Los botones que le pone WhatsApp, como en las plantillas; el que eligió queda marcado.
  const boton = (t, ic, k) => `<span class="${m.permisoResp ? (m.permisoResp === k ? `elegido ${k}` : 'otro') : ''}">${m.permisoResp === k ? LV_IC.ok : ic}${t}</span>`;
  return `<div class="ch-b out pr${ult ? ' ult' : ''}"><span class="pr-cab">${LV_IC.tel}Solicitud para llamar</span>${esc(m.out || '')}<div class="ch-tb pr-bts">${boton('Permitir llamadas', LV_IC.tel, 'acepto')}${boton('Ahora no', '', 'rechazo')}</div><span class="pr-est">${est}</span></div>`;
};

document.head.insertAdjacentHTML('beforeend', `<style>
/* Tarjeta de la llamada en la ficha */
.lcd-w{display:grid;grid-template-rows:1fr;transition:grid-template-rows .4s cubic-bezier(.16,1,.3,1),opacity .3s}
.lcd-w > .lcd-in{overflow:clip;overflow-clip-margin:24px;min-height:0}
.lcd-w.sale{grid-template-rows:0fr;opacity:0}
.lcd-w.sale .lcd{transform:scale(.96);transition:transform .3s cubic-bezier(.16,1,.3,1)}
.lcd{box-sizing:border-box;width:100%;margin:14px 0 4px;border-radius:16px;background:#fff;color:var(--ink);border:1px solid var(--line);padding:14px;display:grid;gap:12px;box-shadow:0 12px 28px -18px rgba(15,23,42,.35);animation:lcd-in .45s cubic-bezier(.16,1,.3,1);transition:background .35s,border-color .35s}
@keyframes lcd-in{from{opacity:0;transform:translateY(-8px) scale(.98)}to{opacity:1;transform:none}}
.lcd.en{animation:none}.lcd.en.entra{animation:lcd-in .45s cubic-bezier(.16,1,.3,1)}
.lcd .i{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
.lcd .colgar{transform:rotate(135deg)}
.lcd-f{display:flex;align-items:center;gap:12px}
.lcd-av{width:44px;height:44px;border-radius:50%;color:#fff;font-size:15px;font-weight:700;display:grid;place-items:center;flex:none}
.lcd.suena .lcd-av{animation:lcd-aro 1.6s cubic-bezier(.16,1,.3,1) infinite}
@keyframes lcd-aro{0%{box-shadow:0 0 0 0 rgba(219,39,119,.6)}100%{box-shadow:0 0 0 14px rgba(219,39,119,0)}}
.lcd-tx{flex:1;min-width:0;display:grid}.lcd-tx small{display:flex;white-space:nowrap;align-items:center;gap:6px;font-size:12px;color:var(--ink3)}.lcd-tx b{font-size:16px;font-weight:700}
.lcd-t{font-variant-numeric:tabular-nums;font-size:20px!important}
.lcd-rec{display:inline-flex;color:#dc2626}.lcd-rec .i{width:12px;height:12px;animation:lcd-parp 1.6s ease-in-out infinite}
@keyframes lcd-parp{50%{opacity:.3}}
.lcd-bt{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.lcd-bt.uno{grid-template-columns:1fr}
.lcd-b{display:flex;align-items:center;justify-content:center;gap:8px;height:42px;border:0;border-radius:11px;color:#fff;font:inherit;font-size:14px;font-weight:700;cursor:pointer;transition:transform .15s cubic-bezier(.16,1,.3,1)}
.lcd-b:active{transform:scale(.94)}
.lcd-b:disabled{opacity:.5;cursor:default}
.lcd-b.verde{background:#16a34a;animation:lcd-lat 1.4s cubic-bezier(.16,1,.3,1) infinite}.lcd-b.rojo{background:#dc2626}
@keyframes lcd-lat{0%{box-shadow:0 0 0 0 rgba(22,163,74,.55)}100%{box-shadow:0 0 0 10px rgba(22,163,74,0)}}
.lcd-pie{font-size:11.5px;color:var(--ink3);text-align:center}
.lcd-onda{display:flex;align-items:center;gap:2px;height:22px;transition:transform .35s cubic-bezier(.16,1,.3,1),filter .35s,opacity .35s}
.lcd-onda i{width:3px;height:var(--h);border-radius:2px;background:#16a34a;animation:lcd-onda 1s ease-in-out infinite;animation-delay:var(--d)}
@keyframes lcd-onda{0%,100%{transform:scaleY(.4)}50%{transform:scaleY(1)}}
.lcd.silencio .lcd-onda{transform:scaleY(.15);filter:grayscale(1);opacity:.45}
.lcd-ctl{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.lcd-ctl button{height:58px;min-width:0;align-content:center;gap:4px;font:inherit;font-size:12px;font-weight:600;border:0;border-radius:10px;background:#f1f5f9;color:#0b0b10;display:grid;place-items:center;cursor:pointer;transition:background .25s,color .25s,transform .15s cubic-bezier(.16,1,.3,1)}
.lcd-ctl button:hover{background:#e7ebf0}.lcd-ctl button:active{transform:scale(.94)}
.lcd-ctl button.on{background:#FFD21F;color:#0b0b10}.lcd-ctl button.osc{background:#0b0b10;color:#fff}.lcd-ctl button.rojo{background:#dc2626;color:#fff}
.lcd-nota-w{display:grid;grid-template-rows:1fr;margin-top:-12px;transition:grid-template-rows .4s cubic-bezier(.16,1,.3,1),opacity .3s}
.lcd-nota-w.cerrada{grid-template-rows:0fr;opacity:0}
.lcd-nota-in{overflow:hidden;min-height:0;padding-top:12px}
.lcd-nota{display:block;width:100%;box-sizing:border-box;resize:none;padding:9px 11px;border-radius:10px;background:#fffbe6;border:1px solid #fde68a;font:inherit;font-size:12.5px;line-height:1.45;color:#713f12}
.lcd-nota:focus{outline:2px solid #FFD21F;outline-offset:1px}
.lcd.suena{background:#f0fdf4;border-color:#bbf7d0}
.lcd.suena .lcd-tx small{color:#15803d}
.lcd-dots{display:flex;gap:4px}.lcd-dots i{width:6px;height:6px;border-radius:50%;background:#FFD21F;animation:pr-pt 1.2s infinite}.lcd-dots i:nth-child(2){animation-delay:.2s}.lcd-dots i:nth-child(3){animation-delay:.4s}
@keyframes pr-pt{0%,60%,100%{opacity:.3}30%{opacity:1}}
body:has(.lcd) .ay-fab:not(.abierta){opacity:0;pointer-events:none}
/* Botón Llamar cuando ya dio permiso */
#b-call.pr-llamar > svg:first-child{background:#16a34a!important;color:#fff!important;box-shadow:0 0 0 4px rgba(22,163,74,.18)}
/* Diálogo del permiso */
.dlg.pm-dlg{width:min(760px,calc(100vw - 32px));padding:0;overflow:hidden}
.pm .i{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
.pm-h{display:flex;gap:14px;align-items:flex-start;padding:22px 24px 16px}
.pm-ic{width:42px;height:42px;border-radius:12px;background:#dcfce7;color:#15803d;display:grid;place-items:center;flex:none}
.pm-h h3{margin:0;font-size:18px;font-weight:700;letter-spacing:-.01em}.pm-h p{margin:3px 0 0;font-size:13.5px;color:var(--ink3)}
.pm-b{display:grid;grid-template-columns:1fr 260px;gap:22px;padding:4px 24px 20px}
.pm-lb{display:grid;gap:6px;font-size:12.5px;font-weight:600;color:var(--ink2)}
.pm-lb textarea{min-height:92px;resize:vertical;border:1px solid var(--line);border-radius:12px;padding:10px 12px;font:inherit;font-size:14px;font-weight:400;color:var(--ink)}
.pm-cnt{display:block;text-align:right;font-size:11.5px;color:var(--ink4);margin-top:4px}
.pm-info{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:9px}
.pm-info li{display:flex;gap:9px;font-size:13px;color:var(--ink2)}.pm-info .i{width:16px;height:16px;margin-top:2px;color:var(--ink3)}
.pm-info li:first-child .i{color:#16a34a}
.pm-tel small{display:block;font-size:11.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--ink3);margin-bottom:8px}
.pm-wa{background:#efeae2;border-radius:14px;padding:12px;display:grid;gap:6px}
.pm-bur{position:relative;background:#fff;border-radius:0 10px 10px 10px;padding:8px 10px 18px;font-size:13px;line-height:1.4;color:#111b21;box-shadow:0 1px .5px rgba(11,20,26,.13);white-space:pre-wrap;overflow-wrap:anywhere}
.pm-h1{position:absolute;right:8px;bottom:4px;font-size:10.5px;color:#8696a0}
.pm-perm{background:#fff;border-radius:10px;padding:12px;display:grid;justify-items:center;gap:2px;text-align:center;box-shadow:0 1px .5px rgba(11,20,26,.13)}
.pm-pic{width:34px;height:34px;border-radius:50%;background:#e7f8ee;color:#15803d;display:grid;place-items:center;margin-bottom:4px}
.pm-perm b{font-size:13px}.pm-perm small{font-size:11.5px;color:#667781;margin-bottom:6px;text-transform:none;letter-spacing:0;font-weight:400}
.pm-op{width:100%;padding:8px 0;border-top:1px solid #e9edef;font-size:13px;color:#027eb5;font-weight:500}
.pm-f{display:flex;justify-content:flex-end;gap:8px;padding:14px 24px;border-top:1px solid var(--line);background:#fbfbfc}
.pm-cancel{height:40px;padding:0 16px;border:1px solid var(--line);border-radius:10px;background:#fff;font:inherit;font-weight:600;cursor:pointer}
.pm-send{display:inline-flex;align-items:center;gap:8px;height:40px;padding:0 18px;border:0;border-radius:10px;background:#FFD21F;font:inherit;font-weight:700;cursor:pointer}
.pm-send:disabled{opacity:.5;cursor:default}
@media (max-width:700px){.pm-b{grid-template-columns:1fr}}
/* La solicitud en el chat y el aviso cuando acepta */
.ch-b.pr{display:grid;gap:6px;max-width:340px}
.pr-cab{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:#15803d}.pr-cab .i{width:15px;height:15px}
.pr-est{display:flex;align-items:center;gap:6px;padding-top:7px;margin-top:2px;border-top:1px solid rgba(11,11,16,.12);font-size:12px;color:#5b5130}.pr-est .i{width:14px;height:14px}
.pr .i{stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.ch-tb.pr-bts{margin:4px -6px 0}
.ch-tb.pr-bts span.elegido.acepto{background:#ecfdf3;color:#15803d}
.ch-tb.pr-bts span.elegido.rechazo{background:#fff;color:#374151}
.ch-tb.pr-bts span.otro{opacity:.45}
.ch-ev.pr-ok{color:#15803d;background:#ecfdf3;border:1px solid #bbf7d0;border-radius:999px;padding:6px 12px}
.ch-ev.pr-ok .i{width:15px;height:15px;stroke:currentColor;fill:none;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.ch-ev.pr-ok b{font-weight:600}
/* La llamada en el chat */
.lc-log{display:grid;gap:8px;max-width:520px;align-self:center;width:100%}
.lc-log.entra{animation:lc-entra .5s cubic-bezier(.16,1,.3,1)}
@keyframes lc-entra{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.lc-log .i{stroke:currentColor;fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
.lc-ll{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;background:#fff;border:1px solid var(--line)}
.lc-ll > .i{width:17px;height:17px;color:#16a34a}
.lc-ll.mal > .i{color:#dc2626}
.lc-ll > div{flex:1;display:grid;min-width:0}
.lc-ll b{font-size:13px}
.lc-ll small{font-size:12px;color:var(--ink3)}
.lc-ply{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 10px;border:0;border-radius:999px;background:#f1f5f9;font:inherit;font-size:12px;font-weight:600;cursor:pointer;flex:none}
.lc-ply .i{width:12px;height:12px}
.lc-nl{display:flex;gap:8px;padding:10px 12px;border-radius:12px;background:#fffbe6;border:1px solid #fde68a;font-size:12.5px;color:#713f12}
.lc-nl .i{width:15px;height:15px;margin-top:2px}
.lc-sg{font-size:11.5px;color:var(--ink3);text-align:center}
@media (prefers-reduced-motion:reduce){.lcd,.lcd.suena .lcd-av,.lcd-b.verde,.lcd-onda i,.lcd-rec .i,.lc-log.entra{animation:none}.lcd-w,.lcd-nota-w,.lcd-onda{transition:none}}
</style>`);
