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

  /* ── 2 · La página ── */
  const circulo = (i, est) => est === 'hecho' ? `<span class="pp-n hecho">${IC.chk}</span>` : `<span class="pp-n${est === 'on' ? ' on' : ''}">${i}</span>`;
  function detalle(p){
    if (p.k === 'wa') return `<div class="pp-dx"><div class="pp-dt"><b>Así se hace</b><ol><li>Toca <b>Conectar WhatsApp</b> y elige cómo: solo en Wali, o en tu celular y en Wali.</li><li>Entra con Facebook y elige tu número.</li><li>Ponle nombre y el equipo que lo atiende. Listo.</li></ol>
      <div><button type="button" class="btn pri" data-pp-ir="wa">Conectar WhatsApp${IC.chev}</button></div></div></div>`;
    if (p.k === 'msg' && puedeConfigurar()) {
      const l = LINEAS[0] || {}, q = st.ppQr;
      if (!q || q.linea !== l.id) pedirQr(l.id);
      return `<div class="pp-dx pp-qrw"><div class="pp-qr">${q && q.svg ? `<img src="data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(q.svg)))}" alt="Código QR para escribirle a tu línea">` : '<span class="pp-qr-c"></span>'}<span class="pp-qr-wa">${IC.wa}</span></div>
        <div class="pp-dt"><b>Escanea con la cámara de tu celular</b><p>Se abre WhatsApp con un mensaje listo para tu línea <b>${esc(l.n || 'de WhatsApp')}${l.tel ? ' · ' + esc(l.tel) : ''}</b>. Solo dale enviar.</p>
          <div class="pp-esperando"><span class="pp-pulso"></span>Esperando tu mensaje…</div>
          ${q && q.enlace ? `<a class="pp-mas" href="${esc(q.enlace)}" target="_blank" rel="noopener noreferrer">¿Estás en el celular? Abre WhatsApp aquí</a>` : ''}</div></div>`;
    }
    if (p.k === 'team' && puedeConfigurar()) {
      const inv = st.ppInv || (st.ppInv = {nombre: '', email: '', eq: (EQUIPOS[0] || {}).n || ''});
      return `<div class="pp-dx"><div class="pp-dt"><b>Así se hace</b>
        <ol><li>Escribe el nombre y el correo de cada asesor.</li><li>Elige su equipo: ${esc(EQUIPOS.slice(0, 2).map(e => e.n).join(', ') || 'Ventas')} o el que armes.</li><li>Le llega un correo; entra con su cuenta de Google y ya aparece en el reparto.</li></ol>
        <div class="pp-in"><input id="pp-inv-n" value="${esc(inv.nombre)}" placeholder="Nombre" autocomplete="off" aria-label="Nombre"><input id="pp-inv-e" value="${esc(inv.email)}" placeholder="sara@tuempresa.com" autocomplete="off" inputmode="email" aria-label="Correo">${ddSel('data-pp-inveq', EQUIPOS.map(e => [e.n, e.n]), inv.eq)}<button type="button" class="btn pri" data-pp-invitar="1" ${inv.enviando ? 'disabled' : ''}>${inv.enviando ? 'Invitando…' : 'Invitar'}</button></div>
        ${inv.ok ? `<span class="pp-ok">${IC.chk}Le enviamos la invitación a ${esc(inv.ok)}. Puedes invitar a otro.</span>` : ''}</div></div>`;
    }
    const ir = {rep: ['Ir a Equipos y reparto', 'Elige quién atiende cada línea y cómo se reparten. Cuando entres, se marca.'], tpl: ['Crear plantilla', 'Escribe el mensaje, elige sus equipos y mándalo a Meta. Casi siempre la aprueba en minutos.'], flow: ['Activar la bienvenida', 'Se enciende la bienvenida de fábrica: saluda, pregunta el nombre y pasa el lead al reparto. Después la ajustas en Flujos.'],
      team: ['Ir a Mi perfil', 'Sube tu foto y revisa cómo se ve tu nombre.'], msg: ['Ir a mi bandeja', 'Ahí llegan las conversaciones que te asignan, con su historial.']}[p.k];
    return ir ? `<div class="pp-dx"><div class="pp-dt"><p>${ir[1]}</p><div><button type="button" class="btn pri" data-pp-ir="${p.k}">${ir[0]}${IC.chev}</button></div></div></div>` : '';
  }
  function fila(p, i, e){
    const est = e.h[i] ? 'hecho' : i === e.actual ? 'on' : '', abierto = i === (st.ppAbierto ?? e.actual) && !e.h[i];
    const accion = e.h[i] ? '' : `<button type="button" class="btn ${est === 'on' ? 'pri' : ''}" data-pp-abrir="${i}">${est === 'on' ? 'Empezar' : 'Hacerlo'}${IC.chev}</button>`;
    return `<div class="pp-f${e.h[i] ? ' hecha' : ''}${abierto ? ' abierto' : ''}"><div class="pp-fh">${circulo(i + 1, est)}<span class="pp-pic ${p.k}">${IC[p.k]}</span><div class="pp-ft"><b>${esc(p.t)}</b><small>${esc(p.d)}</small></div>
      <span class="pp-min">${e.h[i] ? 'Listo' : p.min ? IC.reloj + p.min + ' min' : ''}</span>${abierto ? '' : accion}</div>${abierto ? detalle(p) : ''}</div>`;
  }
  function pagina(){
    const e = estado(), falta = e.ps.reduce((s, p, i) => s + (e.h[i] ? 0 : p.min), 0), pct = Math.round(e.n / e.total * 100);
    const menu = st.ppMenu;
    return `<div class="ajw ancho pp"><div class="pp-cab"><div><h2>Tus primeros pasos</h2><p class="sub">${puedeConfigurar() ? `Termina estos ${e.total} pasos y tu CRM queda funcionando.` : 'Tres pasos para empezar a atender.'}${e.n ? ' Vas muy bien.' : ''}</p></div>
      <div class="pp-prog"><div class="pp-anillo" style="--p:${pct}"><b>${e.n}/${e.total}</b></div><div><b>${falta ? `Te faltan unos ${falta} ${falta === 1 ? 'minuto' : 'minutos'}` : '¡Ya casi!'}</b><small>Los pasos se marcan solos cuando los haces</small></div>
        <div class="tp-acc"><button type="button" class="tp-mas" data-pp-menu="1" aria-haspopup="menu" aria-expanded="${!!menu}" aria-label="Más acciones">${I('more')}</button><div class="tp-menu" role="menu" ${menu ? '' : 'hidden'}><button type="button" role="menuitem" data-pp-ocultar="1">${I('x')}Ocultar primeros pasos</button></div></div></div></div>
      <div class="pp-lista">${e.ps.map((p, i) => fila(p, i, e)).join('')}</div>
      ${puedeConfigurar() ? '' : '<p class="muted" style="margin-top:14px">Los demás ajustes del CRM los hace quien lo configura.</p>'}</div>`;
  }
  function pedirQr(linea){
    if (!linea || (st.ppQr && st.ppQr.pidiendo === linea)) return;
    st.ppQr = {linea, pidiendo: linea};
    crmApi('GET', `/crm/primeros-pasos/qr?linea=${encodeURIComponent(linea)}`).then(d => { st.ppQr = {linea, svg: d.svg, enlace: d.enlace}; if (st.pagina === 'cfg-primeros') render(); }, () => { st.ppQr = {linea, error: true}; });
  }

  const paginaCfgAntes = paginaCfg;
  paginaCfg = function(k){
    if (k !== 'primeros') return paginaCfgAntes.apply(this, arguments);
    // Entrar desde Ajustes del CRM los vuelve a mostrar.
    if (cfgPP().oculto) { cfgPP().oculto = false; crmSincronizar(); }
    return pagina();
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
    const ul = document.getElementById('principal');
    if (ul && !document.getElementById('pp-item')) ul.insertAdjacentHTML('afterbegin', `<li id="pp-item"><button type="button" data-nav="cfg-primeros" aria-current="${st.pagina === 'cfg-primeros'}">${IC.flag}<span class="t">Primeros pasos</span></button></li>`);
    const it = document.querySelector('#pp-item button'); if (it) it.setAttribute('aria-current', String(st.pagina === 'cfg-primeros'));
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
    if (t.closest('[data-pp-nav]')) { e.stopPropagation(); st.ppAbierto = null; irA('cfg-primeros'); return; }
    if (t.closest('[data-pp-empezar]')) { ls('pp-bienvenida:' + yoId(), '1'); cerrarOv(); irA('cfg-primeros'); return; }
    if (t.closest('[data-pp-luego]')) { ls('pp-bienvenida:' + yoId(), '1'); cerrarOv(); return; }
    if (t.closest('[data-pp-fin]')) { cerrarOv(); irA('inbox'); return; }
    if (st.pagina !== 'cfg-primeros') return;
    const g = (attr, fn) => { const b = t.closest(`[${attr}]`); if (!b) return false; e.stopPropagation(); fn(b.getAttribute(attr)); return true; };
    if (g('data-pp-menu', () => { st.ppMenu = !st.ppMenu; render(); })) return;
    if (g('data-pp-ocultar', () => { cfgPP().oculto = true; st.ppMenu = false; crmSincronizar(); irA('inbox'); toast('Primeros pasos ocultos. Vuelven desde Ajustes del CRM.'); })) return;
    if (g('data-pp-abrir', v => { st.ppAbierto = +v; render(); })) return;
    if (g('data-pp-inveq', v => { st.ppInv.eq = v; render(); })) return;
    if (g('data-pp-invitar', () => {
      const inv = st.ppInv, nombre = (document.getElementById('pp-inv-n') || {}).value || '', email = ((document.getElementById('pp-inv-e') || {}).value || '').trim().toLowerCase();
      inv.nombre = nombre; inv.email = email;
      if (nombre.trim().length < 2) { toast('Escribe el nombre de la persona'); return; }
      if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) { toast('Ese correo no parece completo'); return; }
      if (!inv.eq) { toast('Elige su equipo'); return; }
      inv.enviando = true; render();
      crmApi('POST', '/crm/personas/invitar', {nombre: nombre.trim(), email, telefono: ''})
        .then(p => { if (typeof PERSONAS_EXTRA === 'object') PERSONAS_EXTRA[p.id] = {...(PERSONAS_EXTRA[p.id] || {}), nombre: p.nombre, rol: p.rol, foto: p.foto || null}; if (typeof eqrMembresias === 'function') eqrMembresias(p.id, [inv.eq]); st.ppInv = {nombre: '', email: '', eq: inv.eq, ok: p.nombre || nombre}; render(); })
        .catch(err => { inv.enviando = false; render(); toast(err.message || 'No se pudo invitar'); });
    })) return;
    if (g('data-pp-ir', k => {
      if (k === 'wa') { irA('cfg-lineas'); if (typeof abrirConexion === 'function') setTimeout(() => abrirConexion((EQUIPOS[0] || {}).n || 'Ventas'), 50); return; }
      if (k === 'rep') { cfgPP().reparto = true; crmSincronizar(); irA('cfg-reparto'); return; }
      if (k === 'tpl') { irA('plantillas'); if (typeof tnNueva === 'function') { st.tplNueva = tnNueva(); render(); } return; }
      if (k === 'flow') { const f = flujoBienvenida(); if (f) { f.on = true; crmSincronizar(); render(); toast(`«${f.n}» activa`); } else irA('flujos'); return; }
      if (k === 'team') { irA('ajustes'); return; }
      if (k === 'msg') { irA('inbox'); return; }
    })) return;
  }, true);
  document.addEventListener('input', e => { if (e.target && (e.target.id === 'pp-inv-n' || e.target.id === 'pp-inv-e') && st.ppInv) st.ppInv[e.target.id === 'pp-inv-n' ? 'nombre' : 'email'] = e.target.value; });
  // Llegó el primer mensaje (u otro cambio): la página y la barra se ponen al día solas.
  document.addEventListener('crm:evento', e => { const d = e.detail; if (!d) return; if (st.pagina === 'cfg-primeros' && ['conv', 'msg', 'lineas', 'linea', 'usuarios', 'plantillas', 'ajuste'].includes(d.tipo)) render(); else { try { barra(); } catch { /* nada */ } } });

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
@media (prefers-reduced-motion:reduce){.pp-bien,.pp-confeti i,.pp-chk,.pp-trazo,.pp-res div,.pp-pulso,.pp-bar i{animation:none;opacity:1;stroke-dashoffset:0;transition:none}.pp-confeti{display:none}}
@media (max-width:760px){.pp-cab{flex-direction:column;align-items:flex-start}.pp-dx{padding-left:14px;flex-wrap:wrap}.pp-bien{padding:26px 20px 20px}.pp-res{grid-template-columns:repeat(2,1fr)}}
</style>`);
})();
