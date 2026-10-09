/* ── Conectores de canales (26-sep, CRM independiente: «todos los canales deben quedar funcionables para configurar
   dentro del CRM», y «la conexión a cada canal debe ser de forma individual») ──
   Cada canal tiene su asistente y su página de ajustes, con el logo real de su marca:
   - Instagram: la cuenta profesional, con su propio inicio de sesión (POST /crm/conexiones/instagram o …/instagram/empezar).
   - Messenger: la página de Facebook (POST /crm/conexiones/pagina o …/pagina/meta).
   - Telegram: el bot de @BotFather (POST /crm/conexiones/telegram).
   - TikTok: la cuenta de empresa, autorizada en la ventana de TikTok (POST /crm/conexiones/tiktok).
   Guías: docs/crm/api-instagram-messenger.md, api-telegram.md, api-tiktok.md. */

const dlgAbierto = () => !document.getElementById('ov-x').hidden;
const TIPO_CANAL = {ig:'instagram', fb:'pagina', tg:'telegram', tt:'tiktok'};
const INFO_CANAL = {
  ig:{n:'Instagram', marca:'ig', logo:() => LOGO.ig, pagina:'cfg-instagram', cfg:'meta', sw:'meta-ig', eqK:'igEq'},
  fb:{n:'Messenger', marca:'fbm', logo:() => LOGO.msg, pagina:'cfg-messenger', cfg:'meta', sw:'meta-fb', eqK:'fbEq'},
  tg:{n:'Telegram', marca:'tg', logo:() => LOGO.tg, pagina:'cfg-telegram', cfg:'telegram', sw:'tg-on', eqK:'eq'},
  tt:{n:'TikTok', marca:'tt', logo:() => LOGO.tt, pagina:'cfg-tiktok', cfg:'tiktok', sw:'tt-on', eqK:'eq'},
};
const conexionesDe = k => CONEXIONES.filter(c => c.tipo === TIPO_CANAL[k]);
const nombreCx = c => c.tipo === 'pagina' ? (c.pagina || {}).nombre || c.nombre
  : c.tipo === 'instagram' ? ((c.instagram || {}).usuario ? '@' + String(c.instagram.usuario).replace(/^@/, '') : c.nombre)
  : c.tipo === 'telegram' ? ((c.bot || {}).usuario ? '@' + c.bot.usuario : c.nombre)
  : c.tipo === 'tiktok' ? ((c.tiktok || {}).usuario ? '@' + String(c.tiktok.usuario).replace(/^@/, '') : 'Cuenta de TikTok') : c.nombre;
const encendidoCanal = k => { const I2 = INFO_CANAL[k], c = CFG[I2.cfg] || {}; return I2.cfg === 'meta' ? c[k] !== false : c.on !== false; };
const equipoCanal = k => { const I2 = INFO_CANAL[k], c = CFG[I2.cfg] || {}; return c[I2.eqK] || 'Ventas'; };
// La conexión cambió: se vuelve a pedir la lista (las ventanas de TikTok e Instagram terminan en el API).
function refrescarConexiones(){ return crmApi('GET', '/crm/conexiones').then(cs => { if (Array.isArray(cs)) CONEXIONES.splice(0, CONEXIONES.length, ...cs); }).catch(() => {}); }

/* Ventana de autorización (TikTok e Instagram): se abre vacía en el clic (así el navegador no la bloquea) y luego se
   le pone el enlace. La página de regreso del API avisa con postMessage {tipo:'crm-conexion'} y se cierra. */
function abrirVentana(){ return window.open('', 'crm-conexion', 'width=560,height=760'); }
window.addEventListener('message', ev => {
  const d = ev.data; if (!d || d.tipo !== 'crm-conexion') return;
  const x = st.cc; if (!x || !x.esperando) return;
  x.esperando = false; x.resultado = {ok:!!d.ok, texto:String(d.texto || '')};
  refrescarConexiones().then(() => { x.paso = x.pasos.length; if (st.cc === x && dlgAbierto()) pintarCanal(); if (st.pagina && st.pagina.startsWith('cfg-')) render(); });
});

/* ── Asistente ── */
function abrirConexionCanal(k){
  st.cx = null;
  const pasos = k === 'fb' ? ['Cuenta', 'Página', 'Listo'] : k === 'tt' ? ['Cuenta', 'Autorizar', 'Listo'] : k === 'tg' ? ['Bot', 'Listo'] : ['Cuenta', 'Listo'];
  const x = st.cc = {canal:k, pasos, paso:1, manual:k === 'tg', f:{}, enviando:false, error:'', prov:null, fbCargando:false, esperando:false, resultado:null, paginas:[], elegida:null, hechas:[], url:''};
  if (k === 'fb') crmApi('GET', '/crm/conexiones/proveedor').then(p => { x.prov = {listo:!!p.listoPaginas, appId:p.appId, configId:p.configPaginas}; }).catch(() => { x.prov = {listo:false}; }).finally(repintarCanal(x));
  if (k === 'ig' || k === 'tt') crmApi('GET', '/crm/conexiones/proveedores').then(p => { x.prov = (k === 'ig' ? p.instagram : p.tiktok) || {listo:false}; }).catch(() => { x.prov = {listo:false}; }).finally(repintarCanal(x));
  pintarCanal();
}
const repintarCanal = x => () => { if (st.cc === x && dlgAbierto()) pintarCanal(); };
// Al abrir el asistente de WhatsApp, este deja de escuchar el diálogo.
const abrirConexionBaseCc = abrirConexion;
abrirConexion = function(...a){ st.cc = null; return abrirConexionBaseCc(...a); };

// Las claves van con autocomplete="new-password": con «off» el navegador igual las llenaba con una contraseña guardada.
const campo = (id, etq, v, extra = '', ayuda = '') => `<label>${etq}<input id="${id}" value="${esc(v || '')}" autocomplete="${/type="password"/.test(extra) ? 'new-password' : 'off'}" ${extra}>${ayuda ? `<small>${ayuda}</small>` : ''}</label>`;
const opcionBoton = (x, logo, marca, titulo, txtListo, txtNo) => { const p = x.prov, listo = p && p.listo;
  return `<button type="button" class="opc" data-cc-boton="1" ${listo && !x.fbCargando && !x.esperando ? '' : 'disabled'}><span class="marca ${marca}">${logo}</span><span class="tx"><b>${x.fbCargando ? 'Abriendo…' : titulo}${listo ? '<span class="etq-rec">Recomendado</span>' : p == null ? '' : '<span class="etq-pronto">No disponible todavía</span>'}</b><small>${p == null ? 'Revisando…' : listo ? txtListo : txtNo}</small></span>${listo ? I('chev', 'i ch') : ''}</button>`; };
const opcionManual = (titulo, detalle) => `<button type="button" class="opc" data-cc-manual="1"><span class="marca neutra">${LOGO.llave}</span><span class="tx"><b>${titulo}</b><small>${detalle}</small></span>${I('chev', 'i ch')}</button>`;
const ayudaCx = pasos => `<details class="cx-ayuda"><summary>Cómo conseguir estos datos</summary><ol>${pasos.map(p => `<li>${p}</li>`).join('')}</ol></details>`;
const nota = t => t ? `<div class="ll-nota">${esc(t)}</div>` : '';

function formularioCanal(x){
  const k = x.canal, f = x.f;
  if (k === 'tg') return `<div class="cx-f">${campo('cc-token', 'Token del bot', f.token, 'type="password" placeholder="123456789:AAH…"', 'Se guarda cifrado y no se vuelve a mostrar.')}</div>
    ${ayudaCx(['En Telegram, abre <b>@BotFather</b> y escribe <b>/newbot</b>.', 'Ponle el nombre que verán tus clientes y un usuario que termine en «bot» (por ejemplo, TuEmpresaBot).', 'BotFather te responde con el token del bot: cópialo y pégalo aquí. El CRM configura el resto solo.', 'Comparte el enlace t.me/usuario_del_bot en tu página y tus redes: quien le escriba al bot llega a la bandeja.'])}${nota(x.error)}`;
  if (k === 'fb') return `<div class="cx-f">${campo('cc-app', 'Identificador de la app (App ID)', f.appId, 'inputmode="numeric" placeholder="Ej. 1234567890123456"')}${campo('cc-sec', 'Clave secreta de la app', f.appSecret, 'type="password" placeholder="32 letras y números"')}${campo('cc-token', 'Token de acceso', f.token, 'type="password" placeholder="Empieza por EAA…"', 'El de un usuario del sistema con la página asignada, o el de la página. Se guarda cifrado y no se vuelve a mostrar.')}</div>
    ${ayudaCx(['En developers.facebook.com crea una app de tipo Negocio (o usa la que ya tienes) y agrégale Messenger.', 'En Configuración de la app, Básica, copia el identificador de la app y la clave secreta.', 'En la configuración de tu negocio en Meta, Usuarios del sistema: crea uno con rol de administrador, asígnale la app y la página con control total, y genera un token sin vencimiento con los permisos pages_show_list, pages_messaging y pages_manage_metadata.', 'Pega los tres datos aquí. El CRM configura el resto solo.'])}${nota(x.error)}`;
  if (k === 'ig') return `<div class="cx-f">${campo('cc-app', 'Identificador de la app (App ID)', f.appId, 'inputmode="numeric" placeholder="Ej. 1234567890123456"')}${campo('cc-sec', 'Clave secreta de la app', f.appSecret, 'type="password" placeholder="32 letras y números"')}${campo('cc-token', 'Token de la cuenta de Instagram', f.token, 'type="password" placeholder="Empieza por IG…"', 'Se guarda cifrado y no se vuelve a mostrar. El CRM lo renueva solo antes de que venza.')}</div>
    ${ayudaCx(['La cuenta de Instagram debe ser profesional (empresa o creador). No necesita una página de Facebook.', 'En developers.facebook.com crea una app de tipo Negocio (o usa la que ya tienes) y agrégale Instagram.', 'En Configuración de la app, Básica, copia el identificador de la app y la clave secreta.', 'En Instagram, Configuración de la API con inicio de sesión de Instagram: agrega la cuenta y toca «Generar token». Copia el token.', 'En la app de Instagram de la cuenta: Configuración, Mensajes y respuestas a historias, Controles de mensajes, Herramientas conectadas, y activa «Permitir acceso a los mensajes».', 'Pega los tres datos aquí. El CRM configura el resto solo.'])}${nota(x.error)}`;
  // TikTok
  const regreso = (x.prov && x.prov.regreso) || '';
  return `<div class="cx-f">${campo('cc-app', 'App ID', f.appId, 'inputmode="numeric" placeholder="Ej. 7123456789012345678"')}${campo('cc-sec', 'Secret', f.appSecret, 'type="password" placeholder="El Secret de la app"')}${campo('cc-url', 'Enlace de autorización', f.urlAutorizacion, 'placeholder="https://www.tiktok.com/v2/auth/authorize?…"', 'El «TikTok account holder authorization URL» de tu app.')}</div>
    ${regreso ? `<p class="muted" style="margin:0">En tu app, pon esta dirección en «TikTok account holder redirect URL»:</p>${datoCopiable('Dirección de regreso', regreso)}` : ''}
    ${ayudaCx(['Necesitas una app en TikTok API for Business (business-api.tiktok.com) con acceso a Business Messaging: TikTok lo da después de su revisión de seguridad y privacidad. No funciona para cuentas del Espacio Económico Europeo, Suiza ni el Reino Unido.', 'En My Apps, App Detail, Basic Information: copia el App ID, el Secret y el «TikTok account holder authorization URL», y marca el permiso Business Messaging.', 'Pon la dirección de regreso de arriba en «TikTok account holder redirect URL».', 'En la app de TikTok de la cuenta de empresa, deja que cualquiera le pueda escribir mensajes directos.', 'Pega los tres datos aquí y autoriza la cuenta en la ventana de TikTok.'])}${nota(x.error)}`;
}
const listoForm = x => { const f = x.f, t = String(f.token || '').trim(), app = /^\d{5,30}$/.test(String(f.appId || '').trim()), sec = String(f.appSecret || '').trim();
  return x.canal === 'tg' ? /^\d{5,15}:[\w-]{30,60}$/.test(t)
    : x.canal === 'tt' ? app && sec.length >= 20 && /^https:\/\//.test(String(f.urlAutorizacion || '').trim())
    : app && sec.length >= 32 && t.length >= 40; };

function resultadoCanal(c){
  const ok = t => `<div class="ok">${I('check')}${t}</div>`, no = t => `<div class="mal">${I('x')}${t}</div>`, k = Object.keys(TIPO_CANAL).find(kk => TIPO_CANAL[kk] === c.tipo);
  const pendiente = c.modo === 'manual' && c.webhookUrl && c.webhookApp === 'otro';
  const objeto = c.tipo === 'instagram' ? '«Instagram»' : '«Page»';
  return `<div class="ll-sec"><div class="cx-fila"><b>${esc(nombreCx(c))}</b>${c.estado === 'conectada' ? `<span class="ll-ok">${I('check')}Conectada</span>` : `<span class="ll-no">${I('x')}Con un problema</span>`}</div>
    <div class="cx-prog">${c.estado === 'conectada' ? ok(`Sus mensajes de ${INFO_CANAL[k].n} llegan a la bandeja`) : no('Todavía no llegan sus mensajes')}</div>${nota(c.error)}
    ${pendiente ? `<p class="muted" style="margin:6px 0 0">En tu app de Meta, Webhooks, ${objeto}: pega esta dirección y este código, y suscríbete a «messages».</p>${datoCopiable('Dirección', c.webhookUrl)}${datoCopiable('Código de verificación', c.verifyToken || '')}` : ''}</div>`;
}

function pintarCanal(){
  const x = st.cc; if (!x) return;
  const k = x.canal, info = INFO_CANAL[k], ultimo = x.pasos.length;
  const pasos = pasosHTML(x.pasos, x.paso === ultimo ? ultimo + 1 : x.paso);
  const cab = (t, s) => dlgCab(info.marca, info.logo(), t, s);
  let h = '';
  if (x.paso === 1) {
    const cuerpo = !x.manual ? ({
      fb: `<p>Conecta la página de Facebook de tu empresa: los mensajes que le escriben por Messenger llegan a la bandeja.</p><div class="cx-list">${opcionBoton(x, LOGO.fb, 'fb', 'Continuar con Facebook', 'Inicias sesión con Facebook, eliges tus páginas y listo.', 'Se activa cuando Meta apruebe este CRM. Mientras tanto, usa los datos de tu app.')}${opcionManual('Con los datos de tu app de Meta', 'Si ya tienes una app en developers.facebook.com: pegas su identificador, su clave secreta y un token.')}</div>`,
      ig: `<p>Conecta la cuenta profesional de Instagram de tu empresa. No necesita una página de Facebook.</p><div class="cx-list">${opcionBoton(x, LOGO.ig, 'ig', 'Continuar con Instagram', 'Inicias sesión con Instagram, aceptas los permisos y listo.', 'Se activa cuando Meta apruebe este CRM. Mientras tanto, usa los datos de tu app.')}${opcionManual('Con los datos de tu app de Meta', 'Si ya tienes una app en developers.facebook.com: pegas su identificador, su clave secreta y el token de la cuenta.')}</div>`,
      tt: `<p>Conecta la cuenta de empresa de TikTok: los mensajes directos llegan a la bandeja y se responden dentro de las 48 horas.</p><div class="cx-list">${opcionBoton(x, LOGO.tt, 'tt', 'Continuar con TikTok', 'Autorizas la cuenta en la ventana de TikTok y listo.', 'Se activa cuando TikTok apruebe este CRM. Mientras tanto, usa los datos de tu app.')}${opcionManual('Con los datos de tu app de TikTok', 'Si tienes una app en TikTok API for Business con acceso a mensajes: pegas su App ID, su Secret y su enlace de autorización.')}</div>`,
    })[k] + nota(x.error) : formularioCanal(x);
    const volver = x.manual && k !== 'tg' ? `<button type="button" class="btn atras" data-cc-atras="1">Atrás</button>` : '';
    const accion = x.manual ? `<button type="button" class="btn pri" data-cc-enviar="1" ${listoForm(x) && !x.enviando ? '' : 'disabled'}>${x.enviando ? 'Conectando…' : k === 'tt' ? `${I('chev')}Siguiente` : `${I('check')}Conectar`}</button>` : '';
    const titulo = {fb:'Conectar Messenger', ig:'Conectar Instagram', tg:'Conectar Telegram', tt:'Conectar TikTok'}[k];
    const sub = x.manual ? {fb:'Pega los datos de tu app de Meta: el CRM configura el resto', ig:'Pega los datos de tu app de Meta: el CRM configura el resto', tg:'Crea el bot en Telegram y pega su token', tt:'Pega los datos de tu app de TikTok'}[k]
      : {fb:'Por la página de Facebook de tu empresa', ig:'Tu cuenta profesional de Instagram', tt:'Tu cuenta de empresa de TikTok'}[k];
    h = `${cab(titulo, sub)}${pasos}${cuerpo}<div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button>${volver}${accion}</div>`;
  } else if (k === 'fb' && x.paso === 2) {
    h = `${cab('Elige la página', 'El token llega a varias páginas de Facebook')}${pasos}
      <div class="cx-list">${x.paginas.map(p => `<button type="button" class="cx-op" role="radio" aria-checked="${x.elegida === p.id}" data-cc-sel="${esc(p.id)}"><span class="rd"></span><span><b>${esc(p.nombre)}</b><small>Página ${esc(p.id)}</small></span></button>`).join('')}</div>${nota(x.error)}
      <div class="ft2"><button type="button" class="btn atras" data-cc-volver="1">Atrás</button><button type="button" class="btn pri" data-cc-enviar="1" ${x.elegida && !x.enviando ? '' : 'disabled'}>${x.enviando ? 'Conectando…' : `${I('check')}Conectar`}</button></div>`;
  } else if (k === 'tt' && x.paso === 2) {
    h = `${cab('Autoriza la cuenta en TikTok', 'Se abre una ventana de TikTok: inicia sesión con la cuenta de empresa y acepta los permisos de mensajes')}${pasos}
      <div class="cx-prog">${x.esperando ? `<div>${I('clock')}Esperando a que termines en la ventana de TikTok…</div>` : `<div>${I('lock')}Hay que aceptar: enviar mensajes, leer y administrar los mensajes directos y ver el tipo de cuenta</div>`}</div>${nota(x.error)}
      <div class="ft2"><button type="button" class="btn atras" data-cc-volver="1">Atrás</button><button type="button" class="btn pri" data-cc-autorizar="1" ${x.url ? '' : 'disabled'}>${I('share')}${x.esperando ? 'Abrir la ventana otra vez' : 'Abrir TikTok'}</button></div>`;
  } else {
    // Último paso: lo que quedó.
    const hechas = x.hechas.length ? x.hechas : conexionesDe(k).slice(-1);
    const bien = x.resultado ? x.resultado.ok : hechas.length > 0 && hechas.every(c => c.estado === 'conectada');
    h = `${cab(bien ? 'Listo' : 'Falta un paso', bien ? `Los mensajes de ${info.n} ya llegan a la bandeja` : 'La conexión no terminó del todo')}${pasos}
      ${x.resultado && !x.resultado.ok ? nota(x.resultado.texto) : hechas.map(resultadoCanal).join('')}
      <div class="ft2">${x.resultado && !x.resultado.ok ? `<button type="button" class="btn" data-cc-volver="1">Volver a intentar</button>` : ''}<button type="button" class="btn pri" data-cerrar-dlg="1">Listo</button></div>`;
  }
  abrirDialogo(h, 'ancho');
}

function terminarCanal(x, hechas){
  hechas.forEach(mezclarConexion);
  x.hechas = hechas; x.paso = x.pasos.length; x.f = {};
  toast(`${INFO_CANAL[x.canal].n} conectado: ${hechas.map(nombreCx).join(', ')}`);
  if (st.pagina && st.pagina.startsWith('cfg-')) render();
}
function enviarCanal(x){
  const k = x.canal, f = x.f, t = v => String(v || '').trim();
  x.enviando = true; x.error = ''; pintarCanal();
  let peticion;
  if (k === 'tg') peticion = crmApi('POST', '/crm/conexiones/telegram', {token:t(f.token)}).then(c => terminarCanal(x, [c]));
  else if (k === 'ig') peticion = crmApi('POST', '/crm/conexiones/instagram', {appId:t(f.appId), appSecret:t(f.appSecret), token:t(f.token)}).then(c => terminarCanal(x, [c]));
  else if (k === 'fb') peticion = crmApi('POST', '/crm/conexiones/pagina', {appId:t(f.appId), appSecret:t(f.appSecret), token:t(f.token), ...(x.elegida ? {pageId:x.elegida} : {})})
    .then(r => { if (r && r.paginas) { x.paginas = r.paginas; x.elegida = null; x.paso = 2; return; } terminarCanal(x, [r.conexion]); });
  else peticion = crmApi('POST', '/crm/conexiones/tiktok', {modo:'manual', appId:t(f.appId), appSecret:t(f.appSecret), urlAutorizacion:t(f.urlAutorizacion)})
    .then(r => { x.url = r.url; mezclarConexion(r.conexion); x.paso = 2; });
  peticion.catch(err => { x.error = err.message || 'No respondió'; }).finally(() => { x.enviando = false; repintarCanal(x)(); });
}
/* Los botones de la plataforma: Facebook (SDK de Meta), Instagram y TikTok (ventana con su enlace). */
function botonCanal(x){
  const k = x.canal, p = x.prov; if (!p || !p.listo) return;
  x.error = '';
  if (k === 'fb') {
    x.fbCargando = true; pintarCanal();
    cargarSdkFacebook(p.appId).then(() => new Promise(ok => FB.login(r => ok(r), {config_id:p.configId, response_type:'code', override_default_response_type:true})))
      .then(r => { const code = r && r.authResponse && r.authResponse.code; if (!code) throw new Error('No se terminó la conexión con Meta.'); return crmApi('POST', '/crm/conexiones/pagina/meta', {code}); })
      .then(hechas => terminarCanal(x, Array.isArray(hechas) ? hechas : []))
      .catch(err => { x.error = err.message || 'No se pudo conectar con Meta'; })
      .finally(() => { x.fbCargando = false; repintarCanal(x)(); });
    return;
  }
  const w = abrirVentana();
  x.esperando = true; if (k === 'tt') x.paso = 2; pintarCanal();
  (k === 'ig' ? crmApi('POST', '/crm/conexiones/instagram/empezar') : crmApi('POST', '/crm/conexiones/tiktok', {modo:'plataforma'}))
    .then(r => { x.url = r.url; if (w) w.location.href = r.url; else { x.esperando = false; x.error = 'El navegador bloqueó la ventana: permite las ventanas emergentes de esta página y vuelve a intentarlo.'; } })
    .catch(err => { if (w) w.close(); x.esperando = false; x.error = err.message || 'No se pudo empezar la conexión'; })
    .finally(repintarCanal(x));
}
document.getElementById('ov-x').addEventListener('click', e => {
  const x = st.cc; if (!x) return; const t = e.target;
  const cp = t.closest('[data-cx-copiar]'); if (cp) { copiar(cp.dataset.cxCopiar, 'Copiado'); return; }
  if (t.closest('[data-cc-manual]')) { x.manual = true; x.error = ''; pintarCanal(); return; }
  if (t.closest('[data-cc-atras]')) { x.manual = false; x.error = ''; pintarCanal(); return; }
  if (t.closest('[data-cc-volver]')) { x.paso = 1; x.elegida = null; x.error = ''; x.resultado = null; x.esperando = false; pintarCanal(); return; }
  const b = t.closest('[data-cc-boton]'); if (b && !b.disabled) { botonCanal(x); return; }
  const s = t.closest('[data-cc-sel]'); if (s) { x.elegida = s.dataset.ccSel; pintarCanal(); return; }
  const en = t.closest('[data-cc-enviar]'); if (en && !en.disabled && !x.enviando) { enviarCanal(x); return; }
  const au = t.closest('[data-cc-autorizar]'); if (au && !au.disabled && x.url) { const w = abrirVentana(); if (w) { w.location.href = x.url; x.esperando = true; x.error = ''; } else x.error = 'El navegador bloqueó la ventana: permite las ventanas emergentes de esta página y vuelve a intentarlo.'; pintarCanal(); return; }
});
document.getElementById('ov-x').addEventListener('input', e => {
  const x = st.cc; if (!x || x.paso !== 1) return;
  const mapa = {'cc-app':'appId', 'cc-sec':'appSecret', 'cc-token':'token', 'cc-url':'urlAutorizacion'};
  const k = mapa[e.target.id]; if (!k) return;
  if (k === 'appId') e.target.value = e.target.value.replace(/\D/g, '');
  x.f[k] = e.target.value;
  const b = document.querySelector('[data-cc-enviar]'); if (b) b.disabled = x.enviando || !listoForm(x);
});

/* ── Página de ajustes de cada canal ── */
const DESC_CANAL = {
  ig:'Los mensajes directos de tu cuenta profesional de Instagram llegan a la bandeja. Se responden dentro de las 24 horas desde el último mensaje de la persona.',
  fb:'Los mensajes de tu página de Facebook llegan a la bandeja. Se responden dentro de las 24 horas desde el último mensaje de la persona.',
  tg:'Lo que le escriben a tu bot de Telegram llega a la bandeja. Telegram no cobra por mensaje ni tiene ventana de 24 horas.',
  tt:'Los mensajes directos de tu cuenta de empresa de TikTok llegan a la bandeja. Se responden dentro de las 48 horas desde el último mensaje de la persona.',
};
function paginaCanal(k){
  const info = INFO_CANAL[k], cxs = conexionesDe(k), hay = cxDe(k).length > 0, on = encendidoCanal(k);
  const volver = `<button type="button" class="volver" data-ir="ajustes-crm">${I('back')}Ajustes del CRM</button>`;
  const est = !hay ? '<span class="muted" style="margin-left:auto">Sin conectar</span>' : on ? '<span class="ok2" style="margin-left:auto">Conectado</span>' : '<span class="pill" style="margin-left:auto">Apagado</span>';
  const tarjeta = c => { const avisos = c.ultimoAviso ? `El último llegó ${cuandoKB(c.ultimoAviso)}` : (c.verificado || c.modo !== 'manual' || c.tipo === 'telegram') ? 'Todavía no ha llegado ninguno' : 'Meta todavía no ha verificado la dirección de los avisos';
    const manualPendiente = c.modo === 'manual' && c.webhookUrl && (c.tipo === 'pagina' || c.tipo === 'instagram') && (c.estado === 'error' || (!c.verificado && !c.ultimoAviso));
    const estado = c.estado === 'conectada' ? `<span class="ll-ok">${I('check')}Conectada</span>` : c.estado === 'error' ? `<span class="ll-no">${I('x')}Con un problema</span>` : '<span class="muted">Sin terminar</span>';
    const como = c.tipo === 'telegram' ? 'Con el token del bot' : c.modo === 'manual' ? `Con los datos de la app ${esc(c.appId || '')}`.trim() : {pagina:'Con el botón de Facebook', instagram:'Con el botón de Instagram', tiktok:'Con el botón de TikTok'}[c.tipo] || '';
    return `<div class="ll-sec"><div class="cx-fila"><b>${esc(nombreCx(c))}</b>${estado}</div>
      ${fila('Cómo se conectó', '', `<span class="muted">${como}</span>`)}
      ${c.tipo === 'telegram' && c.bot && c.bot.usuario ? fila('Enlace para escribirle', 'Compártelo en tu página y tus redes', `<a href="https://t.me/${esc(c.bot.usuario)}" target="_blank" rel="noopener">t.me/${esc(c.bot.usuario)}</a>`) : ''}
      ${fila('Avisos de mensajes', avisos, '')}${nota(c.error)}
      ${manualPendiente ? `<p class="muted" style="margin:6px 0 0">Si Meta no los manda solo, en tu app de Meta ve a Webhooks, ${c.tipo === 'instagram' ? '«Instagram»' : '«Page»'}: pega esta dirección y este código, y suscríbete a «messages».</p>${datoCopiable('Dirección', c.webhookUrl)}${datoCopiable('Código de verificación', c.verifyToken || '')}` : ''}
      <div class="cx-acc">${c.tipo === 'tiktok' && !(c.tiktok || {}).autorizada ? `<button type="button" class="btn" data-ccm-conectar="1">${I('share')}Terminar la autorización</button>` : `<button type="button" class="btn" data-ccm-revisar="${c.id}">${I('swap')}Revisar</button>`}<button type="button" class="btn" data-ccm-quitar="${c.id}">${I('x')}Desconectar</button></div></div>`; };
  const eqSel = info.cfg === 'meta' ? ddSel('data-cfg-metaeq', EQUIPOS.map(e => [`${k}|${e.n}`, e.n]), `${k}|${equipoCanal(k)}`) : ddSel('data-cc-eq', EQUIPOS.map(e => [`${k}|${e.n}`, e.n]), `${k}|${equipoCanal(k)}`);
  return `<div class="ajw ancho">${volver}<h2>${info.n}</h2><p class="sub">${DESC_CANAL[k]}</p>
    <div class="cfg"><div class="box2"><h4><span class="marca mini ${info.marca}">${info.logo()}</span>${info.n}${est}</h4>
      ${fila('Recibir sus mensajes', hay ? (on ? 'Llegan a la bandeja' : 'Apagado: sus mensajes no entran al CRM') : 'Se activa al conectar la cuenta', sw(info.sw, on, `aria-label="Recibir los mensajes de ${info.n}" ${hay ? '' : 'disabled'}`))}
      ${fila('Equipo que los atiende', 'Recibe las conversaciones nuevas de este canal', eqSel)}</div>
      ${cxs.length ? `<div class="box2"><h4>${I('lock')}${k === 'fb' ? 'Páginas conectadas' : k === 'tg' ? 'Bots conectados' : 'Cuentas conectadas'}</h4>${cxs.map(tarjeta).join('')}</div>` : ''}
      <div><button type="button" class="btn${cxs.length ? '' : ' pri'}" data-ccm-conectar="1">${I('plus')}${cxs.length ? ({fb:'Conectar otra página', tg:'Conectar otro bot'}[k] || 'Conectar otra cuenta') : ({fb:'Conectar una página', tg:'Conectar un bot'}[k] || 'Conectar la cuenta')}</button></div>
      ${cajaProveedorCanal(k)}</div></div>`;
}

/* Botones de la plataforma para Instagram y TikTok: solo los configura el operador de la plataforma. */
st.provCanales = null;
function cajaProveedorCanal(k){
  if ((k !== 'ig' && k !== 'tt') || !CRM_YO.operador) return '';
  const P = st.provCanales;
  if (!P) { crmApi('GET', '/crm/conexiones/proveedores').then(d => { st.provCanales = d; if (st.pagina === INFO_CANAL[k].pagina) render(); }).catch(() => {}); return ''; }
  const p = (k === 'ig' ? P.instagram : P.tiktok) || {};
  const estado = `<span class="${p.listo ? 'll-ok' : 'muted'}">${p.listo ? `${I('check')}Activo` : 'Sin configurar'}</span>`;
  if (k === 'ig') return `<div class="box2"><h4>${I('lock')}Botón «Continuar con Instagram» de la plataforma</h4>
    <p class="muted" style="margin:0 0 8px">Lo ven todas las empresas al conectar Instagram. Usa la app de Meta de la plataforma, con el inicio de sesión para empresas de Instagram aprobado por Meta. Los avisos llegan a la dirección de páginas del botón de Meta (Líneas de WhatsApp), firmados con la clave de esa app.</p>
    <div class="cx-f">${campo('pv-ig-app', 'Identificador de la app de Instagram', p.appId, 'inputmode="numeric"')}${campo('pv-ig-sec', 'Clave secreta de la app de Instagram', '', `type="password" placeholder="${p.listo ? 'Guardada: déjala vacía para no cambiarla' : '32 letras y números'}"`)}</div>
    ${p.regreso ? `<p class="muted" style="margin:0">En la app, «URL de redireccionamiento de OAuth»:</p>${datoCopiable('Dirección de regreso', p.regreso)}` : ''}
    <div class="cx-acc">${estado}<button type="button" class="btn pri" data-pv-canal="ig">${I('check')}Guardar</button></div></div>`;
  return `<div class="box2"><h4>${I('lock')}Botón «Continuar con TikTok» de la plataforma</h4>
    <p class="muted" style="margin:0 0 8px">Lo ven todas las empresas al conectar TikTok. Usa la app de TikTok API for Business de la plataforma con acceso a Business Messaging. Al guardar, el CRM apunta los avisos de la app a su dirección.</p>
    <div class="cx-f">${campo('pv-tt-app', 'App ID', p.appId, 'inputmode="numeric"')}${campo('pv-tt-sec', 'Secret', '', `type="password" placeholder="${p.listo ? 'Guardado: déjalo vacío para no cambiarlo' : 'El Secret de la app'}"`)}${campo('pv-tt-url', 'Enlace de autorización', p.urlAutorizacion)}</div>
    ${p.regreso ? `<p class="muted" style="margin:0">En la app, «TikTok account holder redirect URL»:</p>${datoCopiable('Dirección de regreso', p.regreso)}` : ''}
    <div class="cx-acc">${estado}<button type="button" class="btn pri" data-pv-canal="tt">${I('check')}Guardar</button></div></div>`;
}

const PAGINA_A_CANAL = {'cfg-instagram':'ig', 'cfg-messenger':'fb', 'cfg-telegram':'tg', 'cfg-tiktok':'tt', 'cfg-meta':'fb'};
const paginaCfgCanales = paginaCfg;
paginaCfg = function(k){ const c = PAGINA_A_CANAL['cfg-' + k]; return c ? paginaCanal(c) : paginaCfgCanales(k); };

document.getElementById('page').addEventListener('click', e => {
  const k = PAGINA_A_CANAL[st.pagina]; if (!k) return; const t = e.target;
  if (t.closest('[data-ccm-conectar]')) { abrirConexionCanal(k); return; }
  const cpy = t.closest('[data-cx-copiar]'); if (cpy) { copiar(cpy.dataset.cxCopiar, 'Copiado'); return; }
  const eq = t.closest('[data-cc-eq]'); if (eq) { const [kk, n] = eq.dataset.ccEq.split('|'); const c = CFG[INFO_CANAL[kk].cfg] || (CFG[INFO_CANAL[kk].cfg] = {on:true}); c.eq = n; render(); toast(`Las conversaciones nuevas de ${INFO_CANAL[kk].n} van a ${n}`); return; }
  const rv = t.closest('[data-ccm-revisar]'); if (rv && !rv.disabled) { rv.disabled = true;
    crmApi('POST', `/crm/conexiones/${rv.dataset.ccmRevisar}/revisar`).then(c => { mezclarConexion(c); toast(c.estado === 'conectada' ? 'Está bien' : 'Tiene un problema: mira el detalle'); render(); })
      .catch(err => { toast(err.message || 'No se pudo revisar'); rv.disabled = false; }); return; }
  const qt = t.closest('[data-ccm-quitar]'); if (qt) { const c = CONEXIONES.find(x => x.id === qt.dataset.ccmQuitar); if (!c) return; st.cc = null; const info = INFO_CANAL[k];
    abrirDialogo(`${dlgCab(info.marca, info.logo(), `Desconectar ${esc(nombreCx(c))}`, `Dejan de llegar sus mensajes de ${info.n}`)}<p>Las conversaciones que ya hay se quedan en la bandeja, pero no se pueden responder hasta volver a conectarla.</p><div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" data-ccm-quitarok="${c.id}">${I('x')}Desconectar</button></div>`); return; }
  const pv = t.closest('[data-pv-canal]'); if (pv) { const v = id => ((document.getElementById(id) || {}).value || '').trim(), c = pv.dataset.pvCanal;
    const cuerpo = c === 'ig' ? {appId:v('pv-ig-app'), appSecret:v('pv-ig-sec')} : {appId:v('pv-tt-app'), appSecret:v('pv-tt-sec'), urlAutorizacion:v('pv-tt-url')};
    crmApi('PUT', `/crm/conexiones/proveedores/${c === 'ig' ? 'instagram' : 'tiktok'}`, cuerpo)
      .then(p => { st.provCanales = {...(st.provCanales || {}), [c === 'ig' ? 'instagram' : 'tiktok']: p}; render(); toast(p.errorAvisos ? `Guardado, pero TikTok no aceptó la dirección de avisos: ${p.errorAvisos}` : 'Botón guardado'); })
      .catch(err => toast(err.message || 'No se pudo guardar')); return; }
});
document.getElementById('ov-x').addEventListener('click', e => {
  const b = e.target.closest('[data-ccm-quitarok]'); if (!b || b.disabled) return; b.disabled = true;
  crmApi('DELETE', `/crm/conexiones/${b.dataset.ccmQuitarok}`)
    .then(() => { const i = CONEXIONES.findIndex(c => c.id === b.dataset.ccmQuitarok); if (i >= 0) CONEXIONES.splice(i, 1); const j = CX_CANALES.findIndex(p => p.id === b.dataset.ccmQuitarok); if (j >= 0) CX_CANALES.splice(j, 1); cerrarDialogo(); render(); toast('Desconectado'); })
    .catch(err => { b.disabled = false; toast(err.message || 'No se pudo desconectar'); });
});
