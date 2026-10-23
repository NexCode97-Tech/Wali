/* ── Mis primeros pasos (maqueta aprobada «PrimerosPasos») ──
   1 · La bienvenida, la primera vez que entra quien configura el CRM: la promesa, cuánto tarda y un solo botón.
   2 · La página «Primeros pasos» (cfg-primeros), primera en el menú hasta terminar: 6 pasos que se marcan solos con lo
       que ya hay en el CRM; el actual se abre con lo necesario para hacerlo ahí mismo.
   3 · «Recibe tu primer mensaje»: el código QR que abre WhatsApp con un mensaje listo (GET /crm/primeros-pasos/qr) y la
       espera en vivo hasta que llega.
   4 · La bandeja vacía dice qué sigue, y la barra lateral muestra el avance en todas las pantallas.
   5 · Al terminar: la celebración (una vez) y la página se va del menú.
   6 · Quien atiende (no configura) tiene sus 3 pasos.
   Se puede ocultar (cfg.pp.oculto) y vuelve desde Ajustes del CRM. Lo propio lleva «pp-». */
(() => {
  const SV = d => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const IC = {
    msg: SV('<path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.4A8.5 8.5 0 1 1 21 12Z"/>'),
    team: SV('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.8 3 2.6 3.5 5.2"/>'),
    rep: SV('<path d="M16 3h5v5M21 3l-7 7M8 21H3v-5M3 21l7-7"/>'),
    tpl: SV('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>'),
    flow: SV('<circle cx="6" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M6 8.5V12a3 3 0 0 0 3 3h6.5"/>'),
    reloj: SV('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    chk: SV('<path d="m5 12 5 5L20 7"/>'),
    chev: SV('<path d="m9 6 6 6-6 6"/>'),
    flag: SV('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'),
  };
  IC.wa = typeof LOGO === 'object' && LOGO.wa ? LOGO.wa : IC.msg;
  const ISO = '<img class="pp-iso" src="img/wali-512.png" alt="wali">';
  const puedeConfigurar = () => typeof puedeConfigurarCrm === 'function' ? puedeConfigurarCrm() : st.rol === 'l';
  const yoId = () => (typeof CRM_YO === 'object' && CRM_YO && CRM_YO.id) || '';
  const primerNombre = () => String((typeof yo === 'string' && yo) || '').trim().split(/\s+/)[0] || '';
  const ls = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch { return null; } return null; };
  const cfgPP = () => { if (!CFG.pp || typeof CFG.pp !== 'object') CFG.pp = {}; return CFG.pp; };

  /* ── Los pasos y si ya están hechos (con lo que ya hay en el CRM) ── */
  const flujoBienvenida = () => FLUJOS.find(f => /primer mensaje/i.test(f.cuando || '')) || FLUJOS[0];
  const PASOS_EMPRESA = [
    {k: 'wa', t: 'Conecta tu WhatsApp', d: 'Tu número de WhatsApp Business entra a Wali. Con Facebook, en unos 3 minutos.', min: 3, hecho: () => LINEAS.length > 0, sig: 'conecta tu WhatsApp'},
    {k: 'msg', t: 'Recibe tu primer mensaje', d: 'Escríbele a tu línea desde tu celular y mira cómo llega a la bandeja.', min: 1, hecho: () => CONV.length > 0, sig: 'recibe tu primer mensaje'},
    {k: 'team', t: 'Invita a tu equipo', d: 'Agrega a tus asesores con su correo. Entran con Google, sin contraseñas.', min: 2, hecho: () => USUARIOS.length > 1, sig: 'invita a tu equipo'},
    {k: 'rep', t: 'Arma tus equipos y el reparto', d: 'Quién atiende cada línea y cómo se reparten las conversaciones.', min: 2, hecho: () => EQUIPOS.some(e => typeof idsDe === 'function' && idsDe(e.n).length > 0) && !!cfgPP().reparto, sig: 'arma tus equipos y el reparto'},
    {k: 'tpl', t: 'Crea tu primera plantilla', d: 'Para escribirle primero a un cliente o retomar uno que se enfrió.', min: 2, hecho: () => PLANTILLAS.some(p => !p.borrador), sig: 'crea tu primera plantilla'},
    {k: 'flow', t: 'Activa la bienvenida automática', d: 'Saluda, pregunta el nombre y pasa el lead al asesor, sin que nadie mueva un dedo.', min: 1, hecho: () => FLUJOS.some(f => f.on), sig: 'activa la bienvenida automática'},
  ];
  const yoUsuario = () => USUARIOS.find(u => u.id === yoId()) || {};
  const PASOS_ASESOR = [
    {k: 'team', t: 'Pon tu foto y tu nombre', d: 'Así te ven tus compañeros y tus clientes.', min: 1, hecho: () => !!(yoUsuario().foto), sig: 'pon tu foto y tu nombre'},
    {k: 'msg', t: 'Conoce tu bandeja', d: 'Un recorrido de 30 segundos por lo importante.', min: 1, hecho: () => ls('pp-bandeja:' + yoId()) === '1', sig: 'conoce tu bandeja'},
    {k: 'tpl', t: 'Responde tu primera conversación', d: 'Cuando te asignen una, contesta desde aquí.', min: 0, hecho: () => CONV.some(c => c.asigId === yoId() && !c.espera && c.est !== 'pendientes'), sig: 'responde tu primera conversación'},
  ];
  const pasos = () => puedeConfigurar() ? PASOS_EMPRESA : PASOS_ASESOR;
  const estado = () => { const ps = pasos(), h = ps.map(p => { try { return !!p.hecho(); } catch { return false; } }); const i = h.indexOf(false); return {ps, h, n: h.filter(Boolean).length, actual: i, total: ps.length}; };
  const terminado = () => estado().actual < 0;
  const visible = () => !cfgPP().oculto && !(terminado() && ls('pp-fin:' + (ESPACIO.id || '') + ':' + yoId()) === '1');

  /* ── 2 · El modal (maqueta aprobada «PrimerosPasosModal»): a la izquierda los pasos con su avance, a la derecha el
     elegido para hacerlo ahí mismo. Se abre desde la tarjeta de la barra, «Primeros pasos» del menú o la bandeja vacía. */
  const DESC = {
    wa: 'Tu número de WhatsApp Business entra a Wali con Facebook. Eliges si queda solo en Wali o también en tu celular.',
    msg: 'Escanea el código con la cámara del celular: se abre WhatsApp con un mensaje listo para tu línea. Solo dale enviar.',
    team: 'Tus asesores entran con su cuenta de Google, sin contraseñas, y empiezan a recibir conversaciones de su equipo.',
    rep: 'Elige quién atiende cada línea y cómo se reparten las conversaciones: por turnos, a quien tenga menos o que las asigne un líder.',
    tpl: 'Con una plantilla le escribes primero a un cliente o lo retomas cuando ya pasaron 24 horas. Meta la revisa en minutos.',
    flow: 'Se enciende la bienvenida: saluda, pregunta el nombre y pasa el lead al asesor, sin que nadie mueva un dedo.',
  };
  const DESC_ASESOR = {team: 'Sube tu foto y revisa tu nombre: así te ven tus compañeros y tus clientes.', msg: 'Un recorrido corto por la bandeja: dónde llegan tus conversaciones y cómo responder.', tpl: 'Cuando te asignen una conversación, contéstala desde aquí. Se marca solo.'};
  const IDEAS = [['Bienvenida', 'Hola, {{nombre}}. Gracias por escribirnos, un asesor te atiende en un momento.'], ['Recaptura', 'Hola, {{nombre}}. ¿Seguimos con tu pedido? Aquí estamos para ayudarte.']];
  const anillo = (n, t) => { const c = 2 * Math.PI * 22; return `<svg class="ppm-anillo" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="22" class="pista"/><circle cx="26" cy="26" r="22" class="lleno" style="stroke-dasharray:${c.toFixed(1)};stroke-dashoffset:${(c * (1 - n / t)).toFixed(1)};--c:${c.toFixed(1)}"/></svg>`; };
  function cuerpoPaso(p, i, e){
    const desc = (puedeConfigurar() ? DESC : DESC_ASESOR)[p.k] || p.d;
    const cab = `<div class="ppm-dc"><span class="ppm-dic ${p.k}">${IC[p.k]}</span><span class="ppm-chip">Paso ${i + 1} de ${e.total}${p.min ? ` · ${p.min} min` : ''}</span>${e.h[i] ? `<span class="ppm-chip ok">${IC.chk}Listo</span>` : ''}</div>
      <h3>${esc(p.t)}</h3><p class="ppm-d">${esc(desc)}</p>`;
    if (!puedeConfigurar()) {
      const ir = {team: ['Ir a Mi perfil', 'team'], msg: ['Ir a mi bandeja', 'msg'], tpl: ['Ir a mi bandeja', 'msg']}[p.k];
      return cab + (ir && !e.h[i] ? `<div><button type="button" class="btn pri" data-pp-ir="${ir[1]}">${ir[0]}${IC.chev}</button></div>` : '');
    }
    if (p.k === 'msg') {
      const l = LINEAS[0] || {}, q = st.ppQr;
      if (l.id && (!q || q.linea !== l.id)) pedirQr(l.id);
      if (!l.id) return cab + `<div><button type="button" class="btn pri" data-pp-sel="0">Primero conecta tu WhatsApp${IC.chev}</button></div>`;
      return cab + `<div class="ppm-qrbox"><div class="pp-qr">${q && q.svg ? `<img src="data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(q.svg)))}" alt="Código QR para escribirle a tu línea">` : '<span class="pp-qr-c"></span>'}<span class="pp-qr-wa">${IC.wa}</span></div>
        <div class="ppm-qrt"><b>${esc(l.n || 'Tu línea')}</b><small>${esc(l.tel || '')}</small>${e.h[i] ? `<div class="pp-ok">${IC.chk}Ya llegó tu primer mensaje</div>` : '<div class="pp-esperando"><span class="pp-pulso"></span>Esperando tu mensaje…</div>'}
          ${q && q.enlace ? `<a class="pp-mas" href="${esc(q.enlace)}" target="_blank" rel="noopener noreferrer">¿Estás en el celular? Abre WhatsApp aquí</a>` : ''}</div></div>`;
    }
    if (p.k === 'team') {
      const inv = st.ppInv || (st.ppInv = {nombre: '', email: '', eq: (EQUIPOS[0] || {}).n || ''});
      const otros = USUARIOS.filter(u => u.id !== yoId()).slice(0, 4);
      return cab + `<div class="ppm-frm"><div class="ppm-f2"><label class="ppm-cmp"><span>Nombre</span><input id="pp-inv-n" value="${esc(inv.nombre)}" placeholder="Sara Gómez" autocomplete="off"></label><label class="ppm-cmp"><span>Correo</span><input id="pp-inv-e" value="${esc(inv.email)}" placeholder="sara@tuempresa.com" autocomplete="off" inputmode="email"></label></div>
        <div class="ppm-f2"><div class="ppm-cmp"><span>Equipo</span>${ddSel('data-pp-inveq', EQUIPOS.map(x => [x.n, x.n]), inv.eq)}</div><div class="ppm-cmp ppm-cb"><button type="button" class="btn pri" data-pp-invitar="1" ${inv.enviando ? 'disabled' : ''}>${inv.enviando ? 'Invitando…' : 'Enviar invitación'}</button></div></div>
        ${inv.ok ? `<span class="pp-ok">${IC.chk}Le enviamos la invitación a ${esc(inv.ok)}. Puedes invitar a otro.</span>` : ''}</div>
        ${otros.length ? `<div class="ppm-inv"><small>Tu equipo</small>${otros.map(u => `<div class="ppm-invl"><span class="ppm-av" style="background:${colorEquipo((EQUIPOS.find(x => (typeof idsDe === 'function' ? idsDe(x.n) : []).includes(u.id)) || {}).n || '')}">${esc(String(u.nombre || '?').split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase())}</span><div><b>${esc(u.nombre || '')}</b><small>${esc(u.correo || u.email || '')}</small></div><span class="ppm-chip ok">${IC.chk}En Wali</span></div>`).join('')}</div>` : ''}`;
    }
    if (p.k === 'tpl') return cab + `<div class="ppm-ideas"><small>Empieza con una de estas</small>${IDEAS.map(([n, b], k) => `<button type="button" class="ppm-idea" data-pp-idea="${k}"><b>${n}</b><span>${esc(b)}</span>${IC.chev}</button>`).join('')}<button type="button" class="ppm-idea vacia" data-pp-idea="-1"><b>Desde cero</b><span>Escribe tu propio mensaje</span>${IC.chev}</button></div>`;
    const ir = {wa: ['Conectar WhatsApp', 'wa'], rep: ['Ir a Equipos y reparto', 'rep'], flow: ['Activar la bienvenida', 'flow']}[p.k];
    return cab + (ir && !e.h[i] ? `<div><button type="button" class="btn pri" data-pp-ir="${ir[1]}">${ir[0]}${IC.chev}</button></div>` : '');
  }
  function modalHTML(){
    const e = estado(), falta = e.ps.reduce((s, p, i) => s + (e.h[i] ? 0 : p.min), 0);
    let sel = st.ppSel ?? (e.actual < 0 ? 0 : e.actual); if (sel >= e.total) sel = 0;
    const est = e.n === e.total ? '¡Todo listo!' : e.n * 2 >= e.total ? 'Vas a la mitad' : e.n ? 'Vas muy bien' : 'Empecemos';
    const items = e.ps.map((p, i) => `<button type="button" class="ppm-it${i === sel ? ' sel' : ''}${e.h[i] ? ' hecho' : ''}" data-pp-sel="${i}" style="--i:${i}">${e.h[i] ? `<span class="ppm-st hecho">${IC.chk}</span>` : `<span class="ppm-st${i === e.actual ? ' on' : ''}">${i + 1}</span>`}<span class="ppm-itx"><b>${esc(p.t)}</b><small>${e.h[i] ? 'Listo' : p.min ? p.min + ' min' : ''}</small></span>${i === sel ? IC.chev : ''}</button>`).join('');
    return `<div class="ppm-md" role="dialog" aria-modal="true" aria-label="Tus primeros pasos">
      <header class="ppm-h"><div class="ppm-ht"><span class="ppm-hic">${IC.flag}</span><div><h2>Tus primeros pasos</h2><p>${puedeConfigurar() ? 'Tu CRM queda funcionando en unos 10 minutos' : 'Tres pasos para empezar a atender'}</p></div></div>
        <div class="ppm-p"><div class="ppm-prog">${anillo(e.n, e.total)}<b>${e.n}/${e.total}</b></div><div class="ppm-pt"><b>${est}</b><small>${falta ? `Faltan unos ${falta} ${falta === 1 ? 'minuto' : 'minutos'}` : 'Ya terminaste'}</small></div></div>
        <div class="tp-acc"><button type="button" class="ppm-ic" data-pp-menu="1" aria-haspopup="menu" aria-expanded="${!!st.ppMenu}" aria-label="Más opciones">${I('more')}</button><div class="tp-menu" role="menu" ${st.ppMenu ? '' : 'hidden'}><button type="button" role="menuitem" class="tp-peligro" data-pp-ocultar="1">${I('x')}Ocultar primeros pasos</button></div></div>
        <button type="button" class="ppm-ic ppm-x" data-pp-cerrar="1" aria-label="Cerrar">${I('x')}</button></header>
      <div class="ppm-b"><nav class="ppm-l">${items}<div class="ppm-pie"><span class="pp-bar ppm-bar"><i style="width:${Math.round(e.n / e.total * 100)}%"></i></span><small>Se marcan solos cuando los haces</small></div></nav>
        <section class="ppm-r" aria-live="polite">${cuerpoPaso(e.ps[sel], sel, e)}</section></div></div>`;
  }
  const modalAbierto = () => !!document.getElementById('ppm-ov');
  function abrirModal(sel){
    st.ppSel = sel ?? null; st.ppMenu = false;
    if (cfgPP().oculto) { cfgPP().oculto = false; crmSincronizar(); }
    let ov = document.getElementById('ppm-ov');
    if (!ov) { document.body.insertAdjacentHTML('beforeend', '<div class="ppm-ov" id="ppm-ov"></div>'); ov = document.getElementById('ppm-ov'); }
    pintarModal(true);
  }
  function pintarModal(entrar){
    const ov = document.getElementById('ppm-ov'); if (!ov) return;
    const foco = document.activeElement && document.activeElement.id, val = foco && document.getElementById(foco) ? document.getElementById(foco).value : null;
    ov.replaceChildren(); ov.insertAdjacentHTML('beforeend', modalHTML());
    ov.classList.toggle('entra', !!entrar);
    if (foco && document.getElementById(foco)) { const x = document.getElementById(foco); if (val != null) x.value = val; x.focus(); }
  }
  const cerrarModal = () => { const ov = document.getElementById('ppm-ov'); if (ov) ov.remove(); st.ppMenu = false; };
  function pedirQr(linea){
    if (!linea || (st.ppQr && st.ppQr.pidiendo === linea)) return;
    st.ppQr = {linea, pidiendo: linea};
    crmApi('GET', `/crm/primeros-pasos/qr?linea=${encodeURIComponent(linea)}`).then(d => { st.ppQr = {linea, svg: d.svg, enlace: d.enlace}; pintarModal(); }, () => { st.ppQr = {linea, error: true}; });
  }

  // La página de antes (Ajustes del CRM › Primeros pasos) ahora abre el modal sobre la bandeja.
  const paginaCfgAntes = paginaCfg;
  paginaCfg = function(k){
    if (k !== 'primeros') return paginaCfgAntes.apply(this, arguments);
    setTimeout(() => { irA('inbox'); abrirModal(); }, 0);
    return '';
  };

  /* ── 4 · La barra lateral y la bandeja vacía ── */
  function barra(){
    const nav = document.querySelector('.nav'); if (!nav) return;
    let caja = document.getElementById('pp-barra');
    if (!visible() || terminado()) { if (caja) caja.remove(); const it = document.getElementById('pp-item'); if (it) it.remove(); return; }
    const e = estado(), p = e.ps[e.actual];
    const html = `<button type="button" class="pp-sb" data-pp-nav="1"><span class="pp-sbh"><b>Primeros pasos</b><span>${e.n} de ${e.total}</span></span><span class="pp-bar"><i style="width:${Math.round(e.n / e.total * 100)}%"></i></span><small>Siguiente: ${esc(p.sig)}</small></button>`;
    if (!caja) { caja = document.createElement('div'); caja.id = 'pp-barra'; const top = nav.querySelector('.topbar'); (top || nav.firstElementChild).after(caja); }
    if (caja.dataset.html !== html) { caja.dataset.html = html; caja.replaceChildren(); caja.insertAdjacentHTML('beforeend', html); }
    // Una sola entrada: la tarjeta de progreso bajo el espacio de trabajo (23-oct). Ya no va también como ítem del menú.
    const it = document.getElementById('pp-item'); if (it) it.remove();
  }
  function bandejaVacia(){
    if (st.pagina || !visible() || terminado() || CONV.length) return;
    const items = document.getElementById('items'); if (!items || items.querySelector('.pp-vac')) return;
    const e = estado(), p = e.ps[e.actual];
    items.insertAdjacentHTML('beforeend', `<div class="pp-vac"><span class="pp-pic grande msg">${IC.msg}</span><b>Aquí van a llegar tus conversaciones</b><span>Todavía no hay ninguna. Termina de configurar Wali y tus clientes empiezan a llegar aquí.</span>
      <div class="pp-sig"><span class="pp-n on">${e.actual + 1}</span><div><b>Siguiente paso: ${esc(p.sig)}</b><small>${p.min ? p.min + ' minutos' : ''}</small></div><button type="button" class="btn pri" data-pp-nav="1">Hacerlo ahora${IC.chev}</button></div></div>`);
  }

  // La lista y el menú se vuelven a dibujar por su cuenta (búsquedas, eventos en vivo): se vuelven a poner al cambiar.
  const vigilar = id => { const el = document.getElementById(id); if (!el || el.dataset.ppVigila) return; el.dataset.ppVigila = '1';
    new MutationObserver(() => { try { if (id === 'items') bandejaVacia(); else barra(); } catch { /* nada */ } }).observe(el, {childList: true}); };

  /* ── 1 · La bienvenida y 5 · la celebración ── */
  function bienvenida(){
    if (!puedeConfigurar() || !visible() || estado().n > 0 || ls('pp-bienvenida:' + yoId()) === '1' || document.getElementById('pp-ov')) return;
    const ps = PASOS_EMPRESA;
    document.body.insertAdjacentHTML('beforeend', `<div class="pp-ov" id="pp-ov" role="dialog" aria-modal="true" aria-label="Bienvenida"><div class="pp-bien">
      <span class="pp-iso-big">${ISO}</span>
      <h2>¡Bienvenido a Wali${primerNombre() ? ', ' + esc(primerNombre()) : ''}!</h2>
      <p>En 10 minutos dejas tu CRM atendiendo de verdad: tu WhatsApp conectado, tu equipo adentro y la bienvenida automática encendida.</p>
      <div class="pp-bp">${ps.slice(0, 3).map(p => `<div><span class="pp-pic ${p.k}">${IC[p.k]}</span><b>${esc(p.t)}</b></div>`).join('')}<div class="pp-mas3">+${ps.length - 3} pasos más</div></div>
      <button type="button" class="btn pri pp-grande" data-pp-empezar="1">Empezar ahora${IC.chev}</button>
      <button type="button" class="pp-luego" data-pp-luego="1">Prefiero explorar primero</button></div></div>`);
  }
  function celebrar(){
    const k = 'pp-fin:' + (ESPACIO.id || '') + ':' + yoId();
    if (!terminado() || ls(k) === '1' || cfgPP().oculto || document.getElementById('pp-ov')) return;
    ls(k, '1');
    const colores = ['#FFD21F', '#25D366', '#2563eb', '#f97316', '#a855f7', '#FF4D1A'];
    const confeti = Array.from({length: 44}, (_, n) => `<i style="--x:${(n * 37) % 100}%;--dx:${((n * 53) % 120) - 60}px;--r:${(n * 97) % 720 - 360}deg;--d:${(n % 7) * .06}s;--t:${(1.6 + (n % 5) * .18).toFixed(2)}s;background:${colores[n % 6]};width:${6 + n % 3 * 2}px;height:${10 + n % 4 * 2}px"></i>`).join('');
    const res = puedeConfigurar() ? [[LINEAS.length, LINEAS.length === 1 ? 'línea' : 'líneas'], [USUARIOS.length, USUARIOS.length === 1 ? 'persona' : 'personas'], [PLANTILLAS.filter(p => !p.borrador).length, 'plantillas'], [FLUJOS.filter(f => f.on).length, 'flujo activo']] : [];
    document.body.insertAdjacentHTML('beforeend', `<div class="pp-ov" id="pp-ov" role="dialog" aria-modal="true" aria-label="Todo listo"><div class="pp-bien pp-fin">
      <div class="pp-confeti" aria-hidden="true">${confeti}</div>
      <span class="pp-n hecho big pp-chk"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path class="pp-trazo" d="m5 12 5 5L20 7"/></svg></span>
      <h2>${puedeConfigurar() ? '¡Tu CRM está funcionando!' : '¡Listo para atender!'}</h2>
      <p>${puedeConfigurar() ? 'WhatsApp conectado, tu equipo adentro y la bienvenida automática encendida. Desde ya, cada cliente que escriba se atiende en Wali.' : 'Ya tienes todo para atender a tus clientes desde Wali.'}</p>
      ${res.length ? `<div class="pp-res">${res.map(([n, t], i) => `<div style="--i:${i}"><b>${n}</b><small>${t}</small></div>`).join('')}</div>` : ''}
      <button type="button" class="btn pri pp-grande" data-pp-fin="1">Ir a mi bandeja${IC.chev}</button></div></div>`);
  }
  const cerrarOv = () => { const o = document.getElementById('pp-ov'); if (o) o.remove(); };

  /* ── Después de cada render ── */
  const renderAntes = render;
  render = function(){
    const r = renderAntes.apply(this, arguments);
    try {
      barra(); bandejaVacia(); vigilar('principal'); vigilar('items');
      if (!st.pagina && !puedeConfigurar() && yoId()) ls('pp-bandeja:' + yoId(), '1');
      if (typeof crmCargado === 'undefined' || crmCargado) { bienvenida(); celebrar(); }
    } catch (e) { console.warn('[primeros pasos]', e); }
    return r;
  };

  /* ── Clics ── */
  document.addEventListener('click', e => {
    const t = e.target instanceof Element ? e.target : null; if (!t) return;
    if (t.closest('[data-pp-nav]')) { e.stopPropagation(); abrirModal(); return; }
    if (t.closest('[data-pp-empezar]')) { ls('pp-bienvenida:' + yoId(), '1'); cerrarOv(); abrirModal(); return; }
    if (t.closest('[data-pp-luego]')) { ls('pp-bienvenida:' + yoId(), '1'); cerrarOv(); return; }
    if (t.closest('[data-pp-fin]')) { cerrarOv(); irA('inbox'); return; }
    if (!t.closest('#ppm-ov')) return;
    if (t.id === 'ppm-ov') { cerrarModal(); return; }
    const g = (attr, fn) => { const b = t.closest(`[${attr}]`); if (!b) return false; e.stopPropagation(); fn(b.getAttribute(attr)); return true; };
    if (g('data-pp-cerrar', () => cerrarModal())) return;
    if (g('data-pp-menu', () => { st.ppMenu = !st.ppMenu; pintarModal(); })) return;
    if (g('data-pp-ocultar', () => { cfgPP().oculto = true; crmSincronizar(); cerrarModal(); render(); toast('Primeros pasos ocultos. Vuelven desde Ajustes del CRM.'); })) return;
    if (st.ppMenu && !t.closest('.tp-menu')) { st.ppMenu = false; pintarModal(); }
    if (g('data-pp-sel', v => { st.ppSel = +v; pintarModal(); })) return;
    if (g('data-pp-inveq', v => { st.ppInv.eq = v; pintarModal(); })) return;
    if (g('data-pp-idea', v => { cerrarModal(); irA('plantillas'); if (typeof tnNueva === 'function') { const n = tnNueva(); const idea = IDEAS[+v]; if (idea) Object.assign(n, {nombre: idea[0], body: idea[1]}); st.tplNueva = n; render(); } })) return;
    if (g('data-pp-invitar', () => {
      const inv = st.ppInv, nombre = (document.getElementById('pp-inv-n') || {}).value || '', email = ((document.getElementById('pp-inv-e') || {}).value || '').trim().toLowerCase();
      inv.nombre = nombre; inv.email = email;
      if (nombre.trim().length < 2) { toast('Escribe el nombre de la persona'); return; }
      if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) { toast('Ese correo no parece completo'); return; }
      if (!inv.eq) { toast('Elige su equipo'); return; }
      inv.enviando = true; pintarModal();
      crmApi('POST', '/crm/personas/invitar', {nombre: nombre.trim(), email, telefono: ''})
        .then(p => { if (typeof PERSONAS_EXTRA === 'object') PERSONAS_EXTRA[p.id] = {...(PERSONAS_EXTRA[p.id] || {}), nombre: p.nombre, rol: p.rol, foto: p.foto || null}; if (typeof eqrMembresias === 'function') eqrMembresias(p.id, [inv.eq]); st.ppInv = {nombre: '', email: '', eq: inv.eq, ok: p.nombre || nombre}; pintarModal(); render(); })
        .catch(err => { inv.enviando = false; pintarModal(); toast(err.message || 'No se pudo invitar'); });
    })) return;
    if (g('data-pp-ir', k => {
      cerrarModal();
      if (k === 'wa') { irA('cfg-lineas'); if (typeof abrirConexion === 'function') setTimeout(() => abrirConexion((EQUIPOS[0] || {}).n || 'Ventas'), 50); return; }
      if (k === 'rep') { cfgPP().reparto = true; crmSincronizar(); irA('cfg-reparto'); return; }
      if (k === 'tpl') { irA('plantillas'); if (typeof tnNueva === 'function') { st.tplNueva = tnNueva(); render(); } return; }
      if (k === 'flow') { const f = flujoBienvenida(); if (f) { f.on = true; crmSincronizar(); render(); toast(`«${f.n}» activa`); abrirModal(); } else irA('flujos'); return; }
      if (k === 'team') { irA('ajustes'); return; }
      if (k === 'msg') { irA('inbox'); return; }
    })) return;
  }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && modalAbierto()) cerrarModal(); });
  document.addEventListener('input', e => { if (e.target && (e.target.id === 'pp-inv-n' || e.target.id === 'pp-inv-e') && st.ppInv) st.ppInv[e.target.id === 'pp-inv-n' ? 'nombre' : 'email'] = e.target.value; });
  // Llegó el primer mensaje (u otro cambio): la página y la barra se ponen al día solas.
  document.addEventListener('crm:evento', e => { const d = e.detail; if (!d) return; try { barra(); if (modalAbierto() && ['conv', 'msg', 'lineas', 'linea', 'usuarios', 'plantillas', 'ajuste'].includes(d.tipo)) pintarModal(); } catch { /* nada */ } });

  document.head.insertAdjacentHTML('beforeend', `<style>
.pp-iso{width:40px;height:40px;display:block}
.pp-iso-big .pp-iso{width:84px;height:84px}
.pp-pic{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex:none;background:#FFD21F;color:#0b0b10}
.pp-pic svg{width:18px;height:18px;display:block}
.pp-pic.wa{background:#25D366;color:#fff}
.pp-pic.wa svg{fill:#fff}
.pp-pic.grande{width:56px;height:56px;border-radius:16px}
.pp-pic.grande svg{width:28px;height:28px}
.pp-n{width:28px;height:28px;border-radius:50%;border:2px solid var(--line);background:#fff;color:var(--ink3);display:grid;place-items:center;line-height:1;text-box:trim-both cap alphabetic;font-size:12px;font-weight:600;flex:none;box-sizing:border-box}
.pp-n.on{background:#FFD21F;border-color:#FFD21F;color:#0b0b10}
.pp-n.hecho{background:#0b0b10;border-color:#0b0b10;color:#fff}
.pp-n.hecho svg{width:14px;height:14px;stroke-width:3}
.pp-n.big{width:64px;height:64px}
.pp-n.big svg{width:30px;height:30px}
.pp-cab{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:20px}
.pp-cab h2{margin:0}
.pp-prog{display:flex;align-items:center;gap:12px;flex:none}
.pp-prog > div > b{display:block;font-size:14px}
.pp-prog small{display:block;font-size:12px;color:var(--ink3)}
.pp-anillo{width:56px;height:56px;border-radius:50%;background:conic-gradient(#FFD21F calc(var(--p)*1%),#eef1f5 0);display:grid;place-items:center;position:relative;flex:none}
.pp-anillo::before{content:"";position:absolute;inset:6px;border-radius:50%;background:#fff}
.pp-anillo b{position:relative;font-size:13px;font-weight:800;line-height:1;text-box:trim-both cap alphabetic}
.pp-lista{display:grid;gap:8px;max-width:860px}
.pp-f{border:1px solid var(--line);border-radius:14px;background:#fff;overflow:hidden}
.pp-f.abierto{border-color:#0b0b10;box-shadow:inset 0 0 0 1px #0b0b10}
.pp-f.hecha .pp-ft b{color:var(--ink3);text-decoration:line-through;text-decoration-color:#cbd5e1}
.pp-fh{display:flex;align-items:center;gap:12px;padding:12px 14px}
.pp-ft{flex:1;min-width:0}
.pp-ft b{display:block;font-size:14px;font-weight:600}
.pp-ft small{display:block;font-size:12.5px;color:var(--ink3)}
.pp-min{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--ink3);white-space:nowrap}
.pp-min svg{width:14px;height:14px}
.pp-fh .btn svg,.pp-dx .btn svg,.pp-sig .btn svg,.pp-bien .btn svg{width:16px;height:16px}
.pp-dx{padding:4px 14px 16px 54px;display:flex;gap:18px;align-items:center}
.pp-dt{display:grid;gap:10px;font-size:13px;color:var(--ink2)}
.pp-dt > b{color:var(--ink);font-size:13px}
.pp-dt p{margin:0}
.pp-dt ol{margin:0;padding-left:18px;display:grid;gap:4px}
.pp-in{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.pp-in input{height:38px;border:1px solid var(--line);border-radius:10px;padding:0 12px;font:inherit;font-size:13.5px;min-width:150px;background:#fff}
.pp-in input:focus{outline:0;border-color:#0b0b10;box-shadow:0 0 0 3px rgba(11,11,16,.08)}
.pp-in .dd{min-width:130px}
.pp-ok{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:#15803d}
.pp-ok svg{width:14px;height:14px;stroke-width:2.6}
.pp-mas{font-size:12.5px;font-weight:600;color:var(--ink2);text-decoration:underline;text-underline-offset:2px}
.pp-qr{position:relative;width:150px;height:150px;padding:10px;border:1px solid var(--line);border-radius:14px;flex:none;background:#fff;box-sizing:border-box}
.pp-qr img{width:100%;height:100%;display:block;image-rendering:pixelated}
.pp-qr-c{display:block;width:100%;height:100%;border-radius:6px;background:#f1f5f9}
.pp-qr-wa{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:34px;height:34px;border-radius:9px;background:#25D366;border:3px solid #fff;display:grid;place-items:center;color:#fff}
.pp-qr-wa svg{width:18px;height:18px;fill:#fff}
.pp-esperando{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--ink)}
.pp-pulso{width:10px;height:10px;border-radius:50%;background:#25D366;box-shadow:0 0 0 0 rgba(37,211,102,.5);animation:pp-pulso 1.6s cubic-bezier(.16,1,.3,1) infinite}
@keyframes pp-pulso{0%{box-shadow:0 0 0 0 rgba(37,211,102,.5)}80%,100%{box-shadow:0 0 0 10px rgba(37,211,102,0)}}
#pp-barra{padding:0 2px}
.pp-sb{width:100%;text-align:left;border-radius:12px;background:#1b1b10;border:1px solid #3a3410;padding:11px 12px;display:grid;gap:7px;cursor:pointer;font:inherit;color:inherit}
.pp-sbh{display:flex;justify-content:space-between;align-items:center}
.pp-sbh b{font-size:13px;color:#fff}
.pp-sbh span{font-size:12px;font-weight:700;color:#FFD21F}
.pp-sb small{font-size:11.5px;color:#cbd5e1}
.pp-bar{display:block;height:6px;border-radius:999px;background:#2b2b30;overflow:hidden}
.pp-bar i{display:block;height:100%;background:#FFD21F;border-radius:999px;transition:width .6s cubic-bezier(.16,1,.3,1)}
.pp-vac{display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;padding:32px 16px}
.pp-vac > b{font-size:16px}
.pp-vac > span{font-size:13px;color:var(--ink3);max-width:40ch}
.pp-sig{margin-top:10px;display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--line);border-radius:14px;text-align:left;width:100%;max-width:480px;background:#fff}
.pp-sig > div{flex:1;min-width:0}
.pp-sig b{display:block;font-size:13.5px}
.pp-sig small{font-size:12px;color:var(--ink3)}
#items:has(.pp-vac) > .nothing{display:none}
#items .pp-sig{flex-wrap:wrap}
#items .pp-sig .btn{width:100%;justify-content:center}
.pp-ov{position:fixed;inset:0;z-index:300;background:rgba(10,10,14,.55);display:flex;align-items:center;justify-content:center;padding:16px}
.pp-bien{width:min(560px,100%);background:#fff;border-radius:22px;padding:34px 36px 26px;text-align:center;display:grid;gap:14px;justify-items:center;position:relative;overflow:hidden;animation:pp-entrar .6s cubic-bezier(.16,1,.3,1) both}
@keyframes pp-entrar{from{opacity:0;transform:translateY(18px) scale(.96)}to{opacity:1;transform:none}}
.pp-bien h2{margin:0;font-size:26px;font-weight:800;letter-spacing:-.02em}
.pp-bien > p{margin:0;font-size:14.5px;color:var(--ink2);max-width:46ch}
.pp-bp{display:grid;gap:8px;width:100%;margin:6px 0}
.pp-bp > div{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;text-align:left;font-size:14px}
.pp-bp .pp-mas3{justify-content:center;color:var(--ink3);font-size:13px;border-style:dashed}
.pp-grande{height:46px!important;padding:0 24px!important;font-size:15px!important;width:100%;justify-content:center}
.pp-luego{border:0;background:none;font:inherit;font-size:13px;color:var(--ink3);text-decoration:underline;text-underline-offset:2px;cursor:pointer}
.pp-confeti{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.pp-confeti i{position:absolute;left:var(--x);top:-24px;border-radius:2px;opacity:0;animation:pp-caer var(--t) cubic-bezier(.22,1,.36,1) var(--d) 2 both}
@keyframes pp-caer{0%{opacity:0;transform:translate3d(0,0,0) rotate(0)}8%{opacity:1}75%{opacity:1}100%{opacity:0;transform:translate3d(var(--dx),460px,0) rotate(var(--r))}}
.pp-chk{animation:pp-pop .7s cubic-bezier(.16,1,.3,1) .1s both}
@keyframes pp-pop{from{transform:scale(.4);opacity:0}to{transform:scale(1);opacity:1}}
.pp-trazo{stroke-dasharray:24;stroke-dashoffset:24;animation:pp-dibujar .6s cubic-bezier(.65,0,.35,1) .45s forwards}
@keyframes pp-dibujar{to{stroke-dashoffset:0}}
.pp-res{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;width:100%;margin:6px 0}
.pp-res div{border:1px solid var(--line);border-radius:12px;padding:10px 6px;opacity:0;animation:pp-subir .6s cubic-bezier(.16,1,.3,1) both;animation-delay:calc(.7s + var(--i) * .08s)}
@keyframes pp-subir{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
.pp-res b{display:block;font-size:20px;font-weight:800}
.pp-res small{font-size:12px;color:var(--ink3)}
.ppm-ov{position:fixed;inset:0;z-index:290;background:rgba(10,10,14,.5);display:flex;align-items:center;justify-content:center;padding:24px;backdrop-filter:blur(2px)}
.ppm-md{width:min(920px,100%);max-height:min(640px,100%);background:#fff;border-radius:20px;box-shadow:0 40px 80px -24px rgba(10,10,14,.5);display:flex;flex-direction:column;overflow:hidden}
.ppm-ov.entra .ppm-md{animation:ppm-in .6s cubic-bezier(.16,1,.3,1) both}
@keyframes ppm-in{from{opacity:0;transform:translateY(14px) scale(.97)}to{opacity:1;transform:none}}
.ppm-h{display:flex;align-items:center;gap:14px;padding:18px 20px;border-bottom:1px solid var(--line)}
.ppm-ht{display:flex;align-items:center;gap:12px;flex:1;min-width:0}
.ppm-hic{width:40px;height:40px;border-radius:12px;background:#FFD21F;display:grid;place-items:center;color:#0b0b10;flex:none}.ppm-hic svg{width:20px;height:20px}
.ppm-h h2{margin:0;font-size:18px;font-weight:700;letter-spacing:-.01em}.ppm-ht p{margin:2px 0 0;font-size:13px;color:var(--ink3)}
.ppm-p{display:flex;align-items:center;gap:10px;padding:5px 14px 5px 5px;border:1px solid var(--line);border-radius:999px;flex:none}
.ppm-prog{position:relative;width:44px;height:44px;display:grid;place-items:center}
.ppm-prog b{position:absolute;font-size:12px;font-weight:800;line-height:1;text-box:trim-both cap alphabetic}
.ppm-anillo{width:44px;height:44px;transform:rotate(-90deg)}
.ppm-anillo circle{fill:none;stroke-width:5}.ppm-anillo .pista{stroke:#eef1f5}.ppm-anillo .lleno{stroke:#FFD21F;stroke-linecap:round;transition:stroke-dashoffset .8s cubic-bezier(.16,1,.3,1)}
.ppm-ov.entra .ppm-anillo .lleno{animation:ppm-llenar 1.1s cubic-bezier(.16,1,.3,1) .15s both}
@keyframes ppm-llenar{from{stroke-dashoffset:var(--c)}}
.ppm-pt b{display:block;font-size:13px}.ppm-pt small{font-size:12px;color:var(--ink3)}
.ppm-ic{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;color:var(--ink3);flex:none;border:0;background:none;cursor:pointer}
.ppm-ic:hover{background:var(--bg3)}.ppm-ic svg{width:18px;height:18px}.ppm-x{color:#dc2626}.ppm-x:hover{background:#fee2e2}
.ppm-b{display:grid;grid-template-columns:290px 1fr;min-height:0;flex:1}
.ppm-l{border-right:1px solid var(--line);padding:12px;display:flex;flex-direction:column;gap:4px;background:#fbfbfc;overflow-y:auto}
.ppm-it{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;text-align:left;width:100%;border:0;background:none;font:inherit;color:inherit;cursor:pointer}
.ppm-ov.entra .ppm-it{animation:ppm-subir .5s cubic-bezier(.16,1,.3,1) both;animation-delay:calc(.12s + var(--i) * .05s)}
@keyframes ppm-subir{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.ppm-it:hover{background:#fff}
.ppm-it.sel{background:#fff;box-shadow:0 0 0 1px var(--line),0 6px 16px -10px rgba(15,23,42,.25)}
.ppm-it > svg{width:16px;height:16px;color:var(--ink4);margin-left:auto}
.ppm-st{width:26px;height:26px;border-radius:50%;border:2px solid var(--line);display:grid;place-items:center;font-size:11.5px;font-weight:700;color:var(--ink3);line-height:1;text-box:trim-both cap alphabetic;flex:none;background:#fff;box-sizing:border-box}
.ppm-st.on{background:#FFD21F;border-color:#FFD21F;color:#0b0b10}.ppm-st.hecho{background:#0b0b10;border-color:#0b0b10;color:#fff}.ppm-st.hecho svg{width:13px;height:13px;stroke-width:3}
.ppm-itx{display:grid;min-width:0}.ppm-itx b{font-size:13.5px;font-weight:600}.ppm-itx small{font-size:12px;color:var(--ink3)}
.ppm-it.hecho .ppm-itx b{color:var(--ink3)}
.ppm-pie{margin-top:auto;padding:12px 10px 4px;display:grid;gap:8px}.ppm-pie small{font-size:12px;color:var(--ink3)}
.ppm-bar{background:#eef1f5}
.ppm-r{padding:26px 30px;display:flex;flex-direction:column;gap:14px;overflow-y:auto;animation:ppm-subir .45s cubic-bezier(.16,1,.3,1) both}
.ppm-dc{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.ppm-dic{width:48px;height:48px;border-radius:14px;background:#FFD21F;display:grid;place-items:center;color:#0b0b10;flex:none}.ppm-dic svg{width:24px;height:24px}
.ppm-dic.wa{background:#25D366;color:#fff}.ppm-dic.wa svg{fill:#fff}
.ppm-chip{display:inline-flex;align-items:center;gap:5px;height:26px;padding:0 10px;border-radius:999px;font-size:12px;font-weight:600;color:var(--ink3);background:#f1f5f9}
.ppm-chip svg{width:13px;height:13px;stroke-width:2.6}.ppm-chip.ok{background:#dcfce7;color:#15803d}
.ppm-r h3{margin:0;font-size:22px;font-weight:700;letter-spacing:-.02em}.ppm-d{margin:0;font-size:14px;color:var(--ink2);max-width:52ch}
.ppm-r .btn svg{width:16px;height:16px}
.ppm-frm{display:grid;gap:12px;padding:16px;border:1px solid var(--line);border-radius:14px}
.ppm-f2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.ppm-cmp{display:grid;gap:6px;align-content:end}.ppm-cmp > span:first-child{font-size:12.5px;font-weight:600;color:var(--ink2)}
.ppm-cmp input{height:40px;border:1px solid var(--line);border-radius:10px;padding:0 12px;font:inherit;font-size:14px;background:#fff}
.ppm-cmp input:focus{outline:0;border-color:#0b0b10;box-shadow:0 0 0 3px rgba(11,11,16,.08)}
.ppm-cb .btn{height:40px;width:100%;justify-content:center}
.ppm-inv{display:grid;gap:4px}.ppm-inv > small,.ppm-ideas > small{font-size:11.5px;font-weight:600;color:var(--ink3);text-transform:uppercase;letter-spacing:.04em}
.ppm-invl{display:flex;align-items:center;gap:10px;padding:8px 0}.ppm-invl > div{flex:1;min-width:0}.ppm-invl b{display:block;font-size:13.5px}.ppm-invl small{font-size:12px;color:var(--ink3)}
.ppm-av{width:32px;height:32px;border-radius:50%;color:#fff;display:grid;place-items:center;font-size:11.5px;font-weight:700;flex:none;background:#9ca3af}
.ppm-qrbox{display:flex;gap:20px;align-items:center;padding:18px;border:1px solid var(--line);border-radius:14px}
.ppm-qrt{display:grid;gap:4px}.ppm-qrt b{font-size:15px}.ppm-qrt small{font-size:13px;color:var(--ink3)}.ppm-qrt .pp-esperando,.ppm-qrt .pp-ok{margin-top:8px}
.ppm-ideas{display:grid;gap:8px}
.ppm-idea{display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;text-align:left;background:#fff;font:inherit;color:inherit;cursor:pointer}
.ppm-idea:hover{border-color:#0b0b10}
.ppm-idea b{font-size:13.5px}.ppm-idea span{grid-column:1;font-size:12.5px;color:var(--ink3)}.ppm-idea svg{grid-row:1/3;grid-column:2;align-self:center;width:16px;height:16px;color:var(--ink4)}
.ppm-idea.vacia{border-style:dashed}
@media (max-width:760px){.ppm-ov{padding:0;align-items:flex-end}.ppm-md{max-height:92vh;border-radius:20px 20px 0 0}.ppm-b{grid-template-columns:1fr}.ppm-l{flex-direction:row;overflow-x:auto;border-right:0;border-bottom:1px solid var(--line)}.ppm-it{flex:none;width:auto}.ppm-itx small,.ppm-pie{display:none}.ppm-pt{display:none}.ppm-f2{grid-template-columns:1fr}.ppm-r{padding:20px}.ppm-qrbox{flex-direction:column;align-items:flex-start}}
@media (prefers-reduced-motion:reduce){.ppm-ov.entra .ppm-md,.ppm-ov.entra .ppm-it,.ppm-r,.ppm-ov.entra .ppm-anillo .lleno{animation:none}.ppm-anillo .lleno{transition:none}}
@media (prefers-reduced-motion:reduce){.pp-bien,.pp-confeti i,.pp-chk,.pp-trazo,.pp-res div,.pp-pulso,.pp-bar i{animation:none;opacity:1;stroke-dashoffset:0;transition:none}.pp-confeti{display:none}}
@media (max-width:760px){.pp-cab{flex-direction:column;align-items:flex-start}.pp-dx{padding-left:14px;flex-wrap:wrap}.pp-bien{padding:26px 20px 20px}.pp-res{grid-template-columns:repeat(2,1fr)}}
</style>`);
})();
