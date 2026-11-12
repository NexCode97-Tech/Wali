/* ── Recordatorios de seguimiento con calendario propio (maqueta aprobada «Recordatorios con Google Calendar», 12-nov,
   versión 310). Sin atajos: el día abre un calendario y, al elegirlo, pasa solo a la hora (por franjas, de a 30 min).
   El recordatorio vencido trae un solo botón «Posponer» que abre lo mismo. La X del formulario va en la esquina.
   «Agendar en Google Calendar» es un interruptor; sin Google conectado abre «Primero conecta Google Calendar», que
   abre Google en una ventana aparte (api acceso.ts, /auth/google/calendario) y espera su respuesta (parte 2, 12-nov).
   Cada recordatorio agendado dice cómo va con Google; el servidor crea, mueve y borra el evento (googleCalendario.ts). El calendario y la hora van en portal a document.body: en escritorio junto al
   campo que los abrió; en el celular, como hoja desde abajo. ── */
(() => {
  const RCP_FR = {manana:['Mañana', 6, 12], tarde:['Tarde', 12, 18], noche:['Noche', 18, 22]};
  const RCP_DS = ['lu', 'ma', 'mi', 'ju', 'vi', 'sá', 'do'];
  const AVISOS = [['10', '10 min'], ['30', '30 min'], ['60', '1 hora']];
  const gcalConectado = () => !!(window.CRM_YO && CRM_YO.gcal);
  const AV_TX = {'10':'10 minutos antes', '30':'30 minutos antes', '60':'1 hora antes'};
  // Cómo va el recordatorio en Google: agendando (mientras el servidor responde), en el calendario, hecho allá o sin agendar.
  function gcEstado(r){
    if (!r.gcal) return '';
    let cls = '', tx;
    if (r.gerr) { cls = 'mal'; tx = r.gerr === 'sin-conexion' ? 'No quedó en Google. Conecta tu calendario' : 'Google no lo agendó. Muévelo para intentar otra vez'; }
    else if (!r.gev) { if (r.hecho) return ''; cls = 'sync'; tx = 'Agendando en Google…'; }
    else tx = r.hecho ? 'Marcado hecho en tu calendario' : `En tu Google Calendar · ${AV_TX[String(r.aviso)] || AV_TX['10']}`;
    return `<span class="rcp-rgc ${cls}"><span class="rcp-rueda"></span>${I('calendar')}${esc(tx)}</span>`;
  }
  const nuevoId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const hoyP = () => hcPartes(Date.now());
  const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
  function diaCorto(v){
    const [y, m, d] = String(v).split('-').map(Number); if (!y) return 'Elige el día';
    const h = hoyP(), dif = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(h.y, h.m, h.d)) / 864e5);
    const w = hcPartes(hcFecha(y, m - 1, d, 12)).w;
    return `${dif === 0 ? 'Hoy' : dif === 1 ? 'Mañana' : cap(HC_DIA[w].slice(0, 3))} ${d} ${HC_MES[m - 1].replace('.', '')}`;
  }
  const horaTx = min => hcHora(hcFecha(2026, 0, 1, Math.floor(+min / 60), +min % 60));
  const franjaDe = min => +min < 12 * 60 ? 'manana' : +min < 18 * 60 ? 'tarde' : 'noche';

  // Estado del formulario: el de 10-nucleo más el calendario, la hora, Google y el aviso.
  function estado(c){
    const n = st.recNuevo && st.recNuevo.id === c.id ? st.recNuevo : null;
    if (n && n.rcp) return n;
    const base = recPorDefecto(), h = hoyP();
    st.recNuevo = Object.assign({id:c.id, abierto:false, texto:''}, n || {}, base, {rcp:true, pick:'', mes:{y:h.y, m:h.m}, franja:franjaDe(base.hora), agendar:false, aviso:'10', pos:null});
    return st.recNuevo;
  }
  const guardarTexto = () => { const t = document.getElementById('rec-t'); if (t && st.recNuevo) st.recNuevo.texto = t.value; };

  recHtml = function(c){
    const n = estado(c), sg = sugerenciaRec(c);
    const lista = (c.recs || []).map((r, i) => {
      const e = recEst(r), f = recFechaDe(r), cuando = f ? hcCuando(f) : r.cuando, vencido = !r.hecho && e === 'vencido';
      const chip = r.hecho ? '<span class="rcd-cu">Hecho</span>' : `<span class="rcd-cu ${vencido ? 'vence' : e === 'hoy' ? 'hoy' : ''}">${I('clock')}${vencido ? 'Venció ' + esc(String(cuando).replace(/^./, x => x.toLowerCase())) : esc(cuando)}</span>`;
      const pos = vencido ? `<button type="button" class="rcp-pos${n.pick && n.pos === i ? ' on' : ''}" data-rcp-pos="${i}" aria-haspopup="dialog">${I('calendar')}Posponer${I('chev', 'i chev')}</button>` : '';
      return `<div class="rcd-it${r.hecho ? ' hecho' : ''}${vencido ? ' vencido' : ''}"><button type="button" class="rcd-ck" data-rec-done="${i}" aria-label="${r.hecho ? 'Marcar pendiente' : 'Marcar hecho'}">${r.hecho ? I('check') : ''}</button><div class="rcd-tx"><b>${esc(r.t)}</b>${chip}${gcEstado(r)}${pos}</div>${r.hecho ? '' : `<button type="button" class="rcd-del" data-rec-del="${i}" aria-label="Quitar recordatorio">${I('x')}</button>`}</div>`;
    }).join('');
    const sug = sg && !n.abierto ? `<div class="rcd-sug"><p>Dijo «${esc(sg.frase)}». ¿Te lo recuerdo?</p><button type="button" data-rec-sug="1">${I('bell')}${esc(sg.cuando.split(',')[0])} a las 10 a. m.</button></div>` : '';
    const vacio = !lista && !sg && !n.abierto ? '<p class="rcd-vacio">El día que programes, esta conversación sale de primera en tu bandeja.</p>' : '';
    const gc = gcalConectado(), on = gc && n.agendar;
    const cuentaGc = gc ? `<div class="rcp-gcon">${I('calendar')}<span><b>Google Calendar</b> · ${esc(String(CRM_YO.gcal))}</span></div>` : '';
    const form = n.abierto ? `<div class="rcd-fm rcp-fm"><button type="button" class="rcp-x" data-rec-cancel="1" aria-label="Cancelar" title="Cancelar">${I('x')}</button>
      <label class="rcd-lbl" for="rec-t">¿Qué hay que hacer?</label><textarea id="rec-t" rows="2" placeholder="Ej. Confirmar el pago">${esc(n.texto)}</textarea>
      <span class="rcd-lbl">¿Cuándo?</span>
      <div class="rcp-campos"><button type="button" class="rcp-campo${n.pick === 'dia' && n.pos == null ? ' on' : ''}" data-rcp-abrir="dia" aria-haspopup="dialog">${I('calendar')}<span>${esc(diaCorto(n.dia))}</span>${I('chev', 'i chev')}</button>
      <button type="button" class="rcp-campo${n.pick === 'hora' && n.pos == null ? ' on' : ''}" data-rcp-abrir="hora" aria-haspopup="dialog">${I('clock')}<span>${esc(horaTx(n.hora))}</span>${I('chev', 'i chev')}</button></div>
      <div class="rcp-gc${on ? ' on' : ''}"><button type="button" class="rcp-sw" role="switch" aria-checked="${on}" aria-label="Agendar en Google Calendar" data-rcp-gc="1"><i></i></button><div><b>Agendar en Google Calendar</b>${on ? `<small>Google te avisa ${({'10':'10 minutos', '30':'30 minutos', '60':'1 hora'})[n.aviso]} antes</small>` : ''}</div></div>
      ${on ? `<div class="rcp-avr"><span class="rcd-lbl">Google te avisa</span><div class="rcp-seg">${AVISOS.map(([k, t]) => `<button type="button" data-rcp-aviso="${k}" aria-pressed="${n.aviso === k}">${t}</button>`).join('')}</div></div>` : ''}
      <button type="button" class="rcd-prog rcp-prog" data-rec-add="1">${I('bell')}Programar</button></div>` : '';
    return `${cuentaGc}${sug}${vacio}${lista ? `<div class="rcd-lista">${lista}</div>` : ''}${form}${n.abierto ? '' : `<button type="button" class="rcd-nuevo" data-rec-nuevo="1">${I('plus')}Nuevo recordatorio</button>`}`;
  };

  // ── Calendario y hora, en portal ────────────────────────────────────────────
  let capa = null, ancla = null;
  const cel = () => window.matchMedia('(max-width: 759.98px)').matches;
  function cerrarPick(repintar = true){
    if (capa) { capa.remove(); capa = null; }
    ancla = null;
    const n = st.recNuevo; if (n) { n.pick = ''; n.pos = null; }
    if (repintar) { const c = conv(); if (c) panel(c); }
  }
  function htmlDia(n, c){
    const {y, m} = n.mes, h = hoyP(), w0 = (hcPartes(hcFecha(y, m, 1, 12)).w + 6) % 7, dias = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const conRec = new Set((c.recs || []).filter(r => !r.hecho && recFechaDe(r)).map(r => { const p = hcPartes(recFechaDe(r)); return iso(p.y, p.m, p.d); }));
    const celdas = [];
    for (let i = 0; i < w0; i++) celdas.push('<span class="rcp-d vacia"></span>');
    for (let d = 1; d <= dias; d++) {
      const k = iso(y, m, d), pasado = Date.UTC(y, m, d) < Date.UTC(h.y, h.m, h.d), w = (w0 + d - 1) % 7;
      const cls = ['rcp-d', pasado ? 'pasado' : '', k === iso(h.y, h.m, h.d) ? 'hoy' : '', k === n.dia ? 'sel' : '', conRec.has(k) ? 'con' : '', w > 4 ? 'finde' : ''].filter(Boolean).join(' ');
      celdas.push(`<button type="button" class="${cls}" data-rcp-dia="${k}"${pasado ? ' disabled' : ''} aria-label="${esc(recDiaLargo(k))}"${k === n.dia ? ' aria-pressed="true"' : ''}><span>${d}</span><i></i></button>`);
    }
    const esteMes = y === h.y && m === h.m;
    return `<div class="rcp-h"><b>${cap(HC_MES_L[m])} ${y}</b><span class="rcp-nav"><button type="button" data-rcp-mes="-1" aria-label="Mes anterior"${esteMes ? ' disabled' : ''}>${I('back')}</button><button type="button" data-rcp-mes="1" aria-label="Mes siguiente">${I('back', 'i rcp-sig')}</button></span></div>
      <div class="rcp-sem">${RCP_DS.map(d => `<span>${d}</span>`).join('')}</div><div class="rcp-grid ${n.dirMes || ''}">${celdas.join('')}</div>
      <div class="rcp-pie"><span class="rcp-ley"><i></i>Con recordatorio</span><span class="rcp-hoy"><i></i>Hoy</span></div>`;
  }
  function htmlHora(n){
    const [, , a, b] = [0, 0, RCP_FR[n.franja][1], RCP_FR[n.franja][2]], h = hoyP(), esHoy = n.dia === iso(h.y, h.m, h.d), ahora = h.h * 60 + h.mi;
    const slots = [];
    for (let mi = a * 60; mi < b * 60; mi += 30) {
      const pasado = esHoy && mi <= ahora, t = horaTx(mi), [num, am] = [t.replace(/ [ap]\. m\.$/, ''), t.slice(-5)];
      slots.push(`<button type="button" class="rcp-s${pasado ? ' pasado' : ''}${String(mi) === String(n.hora) ? ' sel' : ''}" data-rcp-hora="${mi}"${pasado ? ' disabled' : ''} aria-label="${esc(t)}"><b>${num}</b><small>${am}</small></button>`);
    }
    return `<div class="rcp-hh"><button type="button" class="rcp-vdia" data-rcp-volver="1">${I('calendar')}${esc(recDiaLargo(n.dia))}</button>
      <div class="rcp-seg rcp-fr">${Object.keys(RCP_FR).map(k => `<button type="button" data-rcp-fr="${k}" aria-pressed="${n.franja === k}">${RCP_FR[k][0]}</button>`).join('')}</div></div><div class="rcp-slots">${slots.join('')}</div>`;
  }
  function pintarPick(){
    const n = st.recNuevo, c = conv(); if (!n || !n.pick || !c) { cerrarPick(false); return; }
    if (!capa) { capa = document.createElement('div'); capa.className = 'rcp-capa'; document.body.append(capa); }
    capa.classList.toggle('cel', cel());
    capa.replaceChildren();
    capa.insertAdjacentHTML('beforeend', `${cel() ? '<div class="rcp-velo" data-rcp-cerrar="1"></div>' : ''}<div class="rcp-pop ${n.pick}" role="dialog" aria-label="${n.pick === 'dia' ? 'Elegir el día' : 'Elegir la hora'}">${cel() ? '<span class="rcp-asa"></span>' : ''}${n.pick === 'dia' ? htmlDia(n, c) : htmlHora(n)}</div>`);
    n.dirMes = '';
    ubicar();
  }
  function ubicar(){
    if (!capa || cel() || !ancla) return;
    const pop = capa.querySelector('.rcp-pop'); if (!pop) return;
    if (!document.body.contains(ancla)) { const sel = st.recNuevo && st.recNuevo.pos != null ? `[data-rcp-pos="${st.recNuevo.pos}"]` : `[data-rcp-abrir="${st.recNuevo && st.recNuevo.pick}"]`; ancla = document.querySelector('#panel ' + sel) || ancla; }
    const r = ancla.getBoundingClientRect(), w = Math.max(280, Math.min(320, window.innerWidth - 24));
    let left = Math.min(Math.max(12, r.left), window.innerWidth - w - 12), top = r.bottom + 6;
    const alto = pop.offsetHeight;
    if (top + alto > window.innerHeight - 12 && r.top - alto - 6 > 12) top = r.top - alto - 6;
    pop.style.cssText = `width:${w}px;left:${left}px;top:${top}px;transform-origin:${Math.round(r.left + r.width / 2 - left)}px ${top < r.top ? '100%' : '0'}`;
  }
  addEventListener('resize', ubicar);
  document.addEventListener('scroll', ubicar, true);

  const posponer = (c, i, para) => {
    const r = c.recs[i]; if (!r) return;
    if (para.getTime() <= Date.now()) { toast('Esa hora ya pasó. Elige una más adelante.'); return; }
    const cuando = hcCuando(para);
    Object.assign(r, {fecha: para.toISOString(), cuando, avisado:false}); delete r.para;
    c.msgs.push({ev:'bell', t:`${yo} pospuso un recordatorio: ${r.t} · ${cuando}`});
    cerrarPick(false); render(); toast(`Recordatorio pospuesto para ${cuando.split(',')[0].toLowerCase()}`);
  };

  function dlgConectarGoogle(){
    abrirDialogo(`<div class="rcp-dlg-ic">${I('calendar')}</div><h3>Primero conecta Google Calendar</h3><p>Para agendar este recordatorio en tu calendario, conecta tu cuenta de Google. Es una sola vez.</p>
      <ul class="rcp-pts"><li>${I('bell')}<span>Cada recordatorio que programes queda en tu calendario. Si lo mueves, lo marcas hecho o lo borras en Wali, allá también cambia.</span></li><li>${I('lock')}<span>Wali no lee ni cambia tus otros eventos.</span></li><li>${I('user')}<span>Es solo tu calendario. Cada persona del equipo conecta el suyo.</span></li></ul>
      <div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri rcp-ir" data-rcp-google="1">${botonGoogle(false)}</button></div>`, 'rcp-dlg');
  }
  const botonGoogle = espera => espera ? '<span class="rcp-rueda"></span>Esperando a Google…' : `Continuar con Google${I('ext')}`;

  // Conectar: Google se abre en una ventana aparte (no se deja abrir dentro del marco del CRM). Al terminar, esa
  // ventana avisa por BroadcastChannel y se cierra; si la cierran antes, el botón vuelve a quedar libre.
  let ventana = null, vigia = null;
  function esperando(si){
    const b = document.querySelector('#ov-x [data-rcp-google]'); if (!b) return;
    b.disabled = si; b.replaceChildren(); b.insertAdjacentHTML('beforeend', botonGoogle(si));
  }
  function soltar(){ clearInterval(vigia); vigia = null; ventana = null; esperando(false); }
  async function conectado(){
    let correo = '';
    try { const r = await crmApi('GET', '/auth/me/google-calendario'); if (!r || !r.conectado) throw 0; correo = r.correo || 'tu cuenta de Google'; }
    catch { soltar(); toast('No se pudo confirmar la conexión con Google. Intenta de nuevo.'); return; }
    CRM_YO.gcal = correo; clearInterval(vigia); vigia = null; ventana = null;
    cerrarDialogo();
    const c = conv(); if (c && st.recNuevo && st.recNuevo.id === c.id) st.recNuevo.agendar = true;
    if (c) panel(c);
    toast('Google Calendar conectado');
  }
  const RESPUESTAS = {'sin-permiso':'Falta el permiso del calendario. En Google deja marcada la casilla del calendario.', cancelado:'No se conectó Google Calendar.', sesion:'Tu sesión se cerró. Vuelve a entrar e inténtalo otra vez.', error:'No se pudo conectar Google Calendar. Intenta de nuevo.'};
  try {
    new BroadcastChannel('wali-gcal').onmessage = e => {
      if (e.data === 'ok') { conectado(); return; }
      if (vigia || ventana) { soltar(); toast(RESPUESTAS[e.data] || RESPUESTAS.error); }
    };
  } catch {}
  document.getElementById('ov-x').addEventListener('click', e => {
    const b = e.target.closest('[data-rcp-google]'); if (!b || b.disabled) return;
    const base = String((window.CRM_INICIO && CRM_INICIO.api) || '').replace(/\/+$/, '');
    const w = 520, h = 680, x = Math.max(0, (screen.availWidth - w) / 2), y = Math.max(0, (screen.availHeight - h) / 2);
    ventana = window.open(base + '/auth/google/calendario', 'wali-gcal', `popup=yes,width=${w},height=${h},left=${x},top=${y}`);
    if (!ventana) { toast('Tu navegador bloqueó la ventana de Google. Permite las ventanas emergentes de Wali e inténtalo otra vez.'); return; }
    esperando(true);
    clearInterval(vigia);
    // La cerraron sin terminar: se espera un momento por si el aviso de la ventana viene en camino.
    vigia = setInterval(() => { if (ventana && ventana.closed) { clearInterval(vigia); vigia = null; setTimeout(() => { if (ventana && !gcalConectado()) soltar(); }, 1200); } }, 500);
  });

  // Clics del bloque (antes que los de 10-nucleo, que siguen manejando nuevo, hecho, quitar y la sugerencia).
  document.getElementById('panel').addEventListener('click', e => {
    const c = conv(); if (!c) return;
    const ab = e.target.closest('[data-rcp-abrir]');
    if (ab) { e.stopPropagation(); guardarTexto(); const n = estado(c), k = ab.dataset.rcpAbrir; const abrir = !(n.pick === k && n.pos == null);
      cerrarPick(false); if (abrir) { n.pick = k; n.pos = null; if (k === 'dia') { const [y, m] = n.dia.split('-').map(Number); n.mes = {y, m: m - 1}; } else n.franja = franjaDe(n.hora); }
      panel(c); if (abrir) { ancla = document.querySelector(`#panel [data-rcp-abrir="${k}"]`); pintarPick(); } return; }
    const ps = e.target.closest('[data-rcp-pos]');
    if (ps) { e.stopPropagation(); guardarTexto(); const n = estado(c), i = +ps.dataset.rcpPos, abrir = !(n.pick && n.pos === i);
      cerrarPick(false); if (abrir) { const h = hoyP(); Object.assign(n, {pick:'dia', pos:i, mes:{y:h.y, m:h.m}}); const man = recPorDefecto(); n.dia = man.dia; n.hora = man.hora; }
      panel(c); if (abrir) { ancla = document.querySelector(`#panel [data-rcp-pos="${i}"]`); pintarPick(); } return; }
    // La sugerencia («el viernes pago») abre el formulario ya lleno, para revisarlo antes de programar (maqueta).
    if (e.target.closest('[data-rec-sug]')) { e.stopPropagation(); const sg = sugerenciaRec(c); if (!sg) return; const n = estado(c), p = hcPartes(sg.para);
      Object.assign(n, {abierto:true, texto: /pag/i.test(sg.frase) ? 'Confirmar el pago' : 'Retomar la conversación', dia: iso(p.y, p.m, p.d), hora: String(p.h * 60 + p.mi), pick:'', pos:null});
      cerrarPick(false); panel(c); const t = document.getElementById('rec-t'); if (t) t.focus(); return; }
    if (e.target.closest('[data-rcp-gc]')) { e.stopPropagation(); guardarTexto(); if (!gcalConectado()) { dlgConectarGoogle(); return; } const n = estado(c); n.agendar = !n.agendar; panel(c); return; }
    const av = e.target.closest('[data-rcp-aviso]'); if (av) { e.stopPropagation(); guardarTexto(); estado(c).aviso = av.dataset.rcpAviso; panel(c); return; }
    if (e.target.closest('[data-rec-cancel]')) { cerrarPick(false); return; }
    const del = e.target.closest('[data-rec-del]'), rd = del && c.recs[+del.dataset.recDel];
    if (rd && rd.gev) { e.stopPropagation(); cerrarPick(false); c.recs.splice(+del.dataset.recDel, 1); render(); toast('Recordatorio borrado, también de tu Google Calendar'); return; }
    if (e.target.closest('[data-rec-nuevo]')) { cerrarPick(false); return; }
    if (e.target.closest('[data-rec-add]')) {
      e.stopPropagation();
      const t = document.getElementById('rec-t').value.trim(); if (!t) { toast('Escribe qué hay que hacer'); document.getElementById('rec-t').focus(); return; }
      const n = estado(c); n.texto = t;
      if (!n.dia || n.hora === '' || n.hora == null) { toast('Elige el día y la hora'); return; }
      const para = hcDeOpciones(n.dia, n.hora);
      if (!para || para.getTime() <= Date.now()) { toast('Esa hora ya pasó. Elige una más adelante.'); return; }
      const cuando = hcCuando(para), ag = gcalConectado() && n.agendar;
      c.recs = [...(c.recs || []), Object.assign({id: nuevoId(), t, cuando, fecha: para.toISOString(), hecho:false, por: yo}, ag ? {gcal:true, aviso:+n.aviso} : {})];
      c.msgs.push({ev:'bell', t:`${yo} programó un recordatorio: ${t} · ${cuando}`});
      cerrarPick(false); st.recNuevo = null; render();
      toast(ag ? 'Recordatorio programado y agendado en Google Calendar' : `Recordatorio para ${cuando.split(',')[0].toLowerCase().replace(/\.$/, '')}. Ese día la conversación sale de primera en tu bandeja.`);
    }
  }, true);

  // Clics dentro del calendario y la hora (en el portal).
  document.addEventListener('click', e => {
    if (!capa) return;
    const dentro = capa.contains(e.target);
    if (!dentro) { if (!e.target.closest('[data-rcp-abrir], [data-rcp-pos]')) cerrarPick(); return; }
    const c = conv(), n = st.recNuevo; if (!c || !n) return;
    if (e.target.closest('[data-rcp-cerrar]')) { cerrarPick(); return; }
    const mb = e.target.closest('[data-rcp-mes]'); if (mb && !mb.disabled) { const d = +mb.dataset.rcpMes; let {y, m} = n.mes; m += d; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } n.mes = {y, m}; n.dirMes = d > 0 ? 'ade' : 'atr'; pintarPick(); return; }
    const db = e.target.closest('[data-rcp-dia]'); if (db && !db.disabled) { n.dia = db.dataset.rcpDia; n.pick = 'hora'; n.franja = franjaDe(n.hora); panel(c); pintarPick(); return; }
    if (e.target.closest('[data-rcp-volver]')) { const [y, m] = n.dia.split('-').map(Number); n.mes = {y, m: m - 1}; n.pick = 'dia'; pintarPick(); return; }
    const fr = e.target.closest('[data-rcp-fr]'); if (fr) { n.franja = fr.dataset.rcpFr; pintarPick(); return; }
    const hb = e.target.closest('[data-rcp-hora]'); if (hb && !hb.disabled) {
      n.hora = hb.dataset.rcpHora;
      if (n.pos != null) { posponer(c, n.pos, hcDeOpciones(n.dia, n.hora)); return; }
      cerrarPick(); return;
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && capa) { e.stopPropagation(); cerrarPick(); } }, true);

  document.head.insertAdjacentHTML('beforeend', `<style>
.rcp-fm{position:relative}
.rcp-x{position:absolute;top:8px;right:8px;width:28px;height:28px;border-radius:8px;display:grid;place-items:center;color:#dc2626;transition:background .16s,transform .14s cubic-bezier(.23,1,.32,1)}
.rcp-x:hover{background:#fef2f2}.rcp-x:active{transform:scale(.9)}.rcp-x svg{width:16px;height:16px}
.rcp-campos{display:grid;gap:8px}
.rcp-campo{height:44px;border:1px solid var(--line);border-radius:11px;background:#fff;display:flex;align-items:center;gap:8px;padding:0 10px 0 12px;font-size:13.5px;font-weight:600;color:var(--ink);text-align:left;transition:border-color .16s,box-shadow .2s cubic-bezier(.23,1,.32,1),transform .12s cubic-bezier(.23,1,.32,1)}
.rcp-campo span{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rcp-campo svg{width:16px;height:16px;color:var(--ink3);flex:none}.rcp-campo svg.chev{width:15px;height:15px;color:var(--ink4);transition:transform .3s cubic-bezier(.32,.72,0,1)}
.rcp-campo:hover{border-color:#cfd5de}.rcp-campo:active{transform:scale(.98)}
.rcp-campo.on{border-color:#0b0b10;box-shadow:0 0 0 3px rgba(11,11,16,.08)}.rcp-campo.on svg.chev{transform:rotate(180deg)}.rcp-campo.on svg:first-child{color:#0b0b10}
.rcp-gc{display:flex;gap:11px;align-items:center;padding:11px 12px;border-radius:12px;background:#f8fafc;border:1px solid var(--line2);transition:background .25s,border-color .25s}
.rcp-gc.on{background:#f6f8ff;border-color:#dfe6fb;align-items:flex-start}
.rcp-gc b{display:block;font-size:13px;font-weight:600}.rcp-gc small{display:block;font-size:12px;color:var(--ink2);margin-top:2px}
.rcp-sw{position:relative;width:40px;height:24px;border-radius:99px;background:#cfd5de;flex:none;transition:background .22s cubic-bezier(.23,1,.32,1)}
.rcp-sw i{position:absolute;left:3px;top:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .26s cubic-bezier(.32,.72,0,1)}
.rcp-gc.on .rcp-sw{background:#1d4ed8}.rcp-gc.on .rcp-sw i{transform:translateX(16px)}
.rcp-avr{display:grid;gap:6px}
.rcp-seg{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;padding:3px;border-radius:10px;background:#f2f4f6}
.rcp-seg button{height:30px;border-radius:8px;font-size:12.5px;font-weight:500;color:var(--ink2);white-space:nowrap;transition:background .16s,color .16s}
.rcp-seg button[aria-pressed="true"]{background:#fff;color:var(--ink);font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.08)}
.rcp-prog{width:100%;justify-content:center;box-shadow:0 1px 2px rgba(11,11,16,.12),0 4px 12px -4px rgba(230,217,0,.6);transition:transform .14s cubic-bezier(.23,1,.32,1),filter .16s}.rcp-prog:active{transform:scale(.97)}
.rcd-it.vencido{border-color:#f6d5d5;background:#fef7f7}
.rcp-pos{display:inline-flex;align-items:center;gap:6px;height:32px;margin-top:6px;padding:0 10px 0 11px;border-radius:99px;border:1px solid #f1c9c9;background:#fff;font-size:12.5px;font-weight:600;color:#7f1d1d;transition:background .16s,transform .14s cubic-bezier(.23,1,.32,1),box-shadow .2s}
.rcp-pos svg{width:14px;height:14px}.rcp-pos svg.chev{width:13px;height:13px;transition:transform .3s cubic-bezier(.32,.72,0,1)}
.rcp-pos:hover{background:#fff5f5}.rcp-pos:active{transform:scale(.96)}.rcp-pos.on{border-color:#b91c1c;box-shadow:0 0 0 3px rgba(185,28,28,.1)}.rcp-pos.on svg.chev{transform:rotate(180deg)}
.rcp-capa{position:fixed;inset:0;z-index:2147483000;pointer-events:none}
.rcp-pop{position:fixed;pointer-events:auto;background:#fff;border:1px solid #e5e8ec;border-radius:18px;box-shadow:0 1px 2px rgba(15,23,42,.06),0 24px 60px -18px rgba(15,23,42,.35);padding:14px;font:14px/1.5 Inter,system-ui,sans-serif;color:#1f2937;animation:rcp-pop .32s cubic-bezier(.32,.72,0,1) both}
@keyframes rcp-pop{from{opacity:0;transform:translateY(-6px) scale(.96)}}
.rcp-pop button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}
.rcp-h{display:flex;align-items:center;justify-content:space-between;padding:2px 2px 10px}.rcp-h b{font-size:15px;letter-spacing:-.01em}
.rcp-nav{display:flex;gap:4px}.rcp-nav button{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;transition:background .16s,transform .12s}.rcp-nav button:hover{background:#f2f4f6}.rcp-nav button:active{transform:scale(.9)}.rcp-nav button:disabled{color:#d1d5db;cursor:default;background:none}
.rcp-nav svg{width:17px;height:17px}.rcp-nav .rcp-sig{transform:scaleX(-1)}
.rcp-sem,.rcp-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
.rcp-sem span{height:24px;display:grid;place-items:center;font-size:11.5px;font-weight:600;color:#9ca3af}
.rcp-grid.ade{animation:rcp-a .34s cubic-bezier(.32,.72,0,1) both}.rcp-grid.atr{animation:rcp-b .34s cubic-bezier(.32,.72,0,1) both}
@keyframes rcp-a{from{opacity:0;transform:translateX(14px)}}@keyframes rcp-b{from{opacity:0;transform:translateX(-14px)}}
.rcp-d{position:relative;height:38px;border-radius:12px;display:grid;place-items:center;font-size:13.5px;font-weight:500;font-variant-numeric:tabular-nums;transition:background .16s,transform .12s}
.rcp-d span{position:relative;z-index:1}.rcp-d i{position:absolute;left:50%;bottom:5px;width:4px;height:4px;margin-left:-2px;border-radius:50%;z-index:1}
.rcp-d:hover{background:#f4f5f7}.rcp-d:active{transform:scale(.9)}
.rcp-d.finde{color:#6b7280}.rcp-d.con i{background:#f59e0b}.rcp-d.hoy{box-shadow:inset 0 0 0 1.5px #0b0b10;font-weight:700}
.rcp-d.pasado{color:#d1d5db;cursor:default;background:none}.rcp-d.vacia{pointer-events:none}
.rcp-d.sel{color:#0b0b10;font-weight:700}.rcp-d.sel::before{content:"";position:absolute;inset:2px;border-radius:11px;background:#FFD21F;box-shadow:0 4px 12px -4px rgba(230,190,0,.7);animation:rcp-sel .38s cubic-bezier(.34,1.4,.64,1) both}.rcp-d.sel.con i{background:#0b0b10}
@keyframes rcp-sel{from{transform:scale(.55);opacity:0}}
.rcp-pie{display:flex;gap:14px;padding:10px 4px 0;margin-top:8px;border-top:1px solid #f1f3f5;font-size:11.5px;color:#6b7280}.rcp-pie span{display:inline-flex;align-items:center;gap:6px}
.rcp-ley i{width:6px;height:6px;border-radius:50%;background:#f59e0b}.rcp-hoy i{width:12px;height:12px;border-radius:4px;box-shadow:inset 0 0 0 1.5px #0b0b10}
.rcp-hh{display:grid;gap:10px;padding-bottom:12px}
.rcp-vdia{justify-self:start;display:inline-flex;align-items:center;gap:7px;height:30px;padding:0 10px;margin-left:-4px;border-radius:9px;font-size:13.5px;font-weight:700;transition:background .16s}.rcp-vdia:hover{background:#f4f5f7}.rcp-vdia svg{width:15px;height:15px;color:#6b7280}
.rcp-slots{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;animation:rcp-fade .3s cubic-bezier(.23,1,.32,1) both}@keyframes rcp-fade{from{opacity:0;transform:translateY(3px)}}
.rcp-s{position:relative;height:50px;border-radius:12px;border:1px solid #e5e7eb!important;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;transition:border-color .16s,background .16s,transform .12s}
.rcp-s b{font-size:15px;font-weight:650;letter-spacing:-.01em;font-variant-numeric:tabular-nums}.rcp-s small{font-size:10.5px;color:#6b7280}
.rcp-s:hover{border-color:#cfd5de!important}.rcp-s:active{transform:scale(.95)}.rcp-s.pasado{opacity:.35;cursor:default}
.rcp-s.sel{border-color:#FFD21F!important;background:#FFD21F}.rcp-s.sel small{color:#3b3000}
.rcp-capa.cel{pointer-events:auto}
.rcp-velo{position:absolute;inset:0;background:rgba(11,11,16,.36);animation:rcp-velo .24s cubic-bezier(.23,1,.32,1) both}@keyframes rcp-velo{from{opacity:0}}
.rcp-capa.cel .rcp-pop{left:0!important;right:0;top:auto!important;bottom:0;width:auto!important;border:0;border-radius:22px 22px 0 0;padding:8px 16px calc(env(safe-area-inset-bottom, 0px) + 22px);max-height:88dvh;overflow:auto;animation:rcp-hoja .42s cubic-bezier(.32,.72,0,1) both}
@keyframes rcp-hoja{from{transform:translateY(100%)}}
.rcp-asa{display:block;width:38px;height:5px;border-radius:3px;background:#d1d5db;margin:0 auto 12px}
.rcp-capa.cel .rcp-d{height:44px}.rcp-capa.cel .rcp-s{height:54px}
.dlg.rcp-dlg .rcp-dlg-ic{width:44px;height:44px;border-radius:12px;background:#eef3ff;color:#1d4ed8;display:grid;place-items:center;margin-bottom:10px}.dlg.rcp-dlg .rcp-dlg-ic svg{width:22px;height:22px}
.rcp-pts{list-style:none;margin:6px 0 4px;padding:0;display:grid;gap:10px;font-size:13px;color:#374151;line-height:1.45}.rcp-pts li{display:flex;gap:10px;align-items:flex-start}.rcp-pts svg{width:17px;height:17px;color:#6b7280;margin-top:1px;flex:none}
.rcp-gcon{display:flex;align-items:center;gap:8px;font-size:12px;color:#4b5563;padding:8px 11px;border-radius:10px;background:#f6f7f9;margin-bottom:10px;animation:rcp-fade .45s cubic-bezier(.32,.72,0,1) both}
.rcp-gcon svg{width:15px;height:15px;color:#1d4ed8;flex:none}.rcp-gcon b{font-weight:600;color:#0b0b10}.rcp-gcon span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rcp-rgc{display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:500;color:#1d4ed8;min-height:18px;margin-top:2px;animation:rcp-fade .35s cubic-bezier(.23,1,.32,1) both}
.rcp-rgc svg{width:13px;height:13px;flex:none}.rcp-rgc .rcp-rueda{display:none}
.rcp-rgc.sync{color:#6b7280}.rcp-rgc.sync .rcp-rueda{display:block}.rcp-rgc.sync svg{display:none}.rcp-rgc.mal{color:#b91c1c}
.rcp-rueda{width:13px;height:13px;border-radius:50%;border:2px solid rgba(29,78,216,.25);border-top-color:#1d4ed8;animation:rcp-gira .7s linear infinite;flex:none}
@keyframes rcp-gira{to{transform:rotate(360deg)}}
.rcp-ir{display:inline-flex;align-items:center;justify-content:center;gap:8px}.rcp-ir svg{width:15px;height:15px}
.rcp-ir .rcp-rueda{width:15px;height:15px;border-color:rgba(11,11,16,.25);border-top-color:#0b0b10}.rcp-ir:disabled{opacity:1;cursor:progress}
@media (prefers-reduced-motion:reduce){.rcp-gcon,.rcp-rgc{animation:none!important}.rcp-rueda{animation-duration:1.6s!important}}
@media (prefers-reduced-motion:reduce){.rcp-pop,.rcp-grid,.rcp-slots,.rcp-d.sel::before,.rcp-velo{animation:none!important}.rcp-campo,.rcp-sw i,.rcp-pos,.rcp-campo svg.chev{transition:none!important}}
</style>`);
})();
