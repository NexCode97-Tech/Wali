/* ── Correo ──
   Un buzón por IMAP y SMTP: el CRM revisa la bandeja de entrada cada minuto y responde en el mismo hilo.
   Google (Gmail y Workspace) con clave de aplicación; cualquier otro proveedor con sus servidores. Outlook y
   Microsoft 365 piden el inicio de sesión de Microsoft: todavía no. API: POST /crm/conexiones/correo,
   …/:id/revisar (services/crm/correo.ts). Guía: docs/crm/api-correo.md. */

document.head.insertAdjacentHTML('beforeend', `<style>
.marca.mail{background:linear-gradient(180deg,#3b82f6,#2563eb)}
.marca.mail svg{width:24px;height:24px;color:#fff}
.marca.gm{background:#fff;border:1px solid var(--line)}
.opc[disabled] .tx small{color:var(--ink4)}
</style>`);

TIPO_CANAL.mail = 'correo';
INFO_CANAL.mail = {n:'Correo', marca:'mail', logo:() => I('mail'), pagina:'cfg-correo', cfg:'correo', sw:'correo-on', eqK:'eq'};
PAGINA_A_CANAL['cfg-correo'] = 'mail';
DESC_CANAL.mail = 'Los correos que llegan a tus buzones entran a la bandeja como conversación y se responden desde ahí, en el mismo hilo. El CRM revisa cada buzón cada minuto.';

/* ── Asistente ── */
const PASOS_CORREO = ['Proveedor', 'Buzón', 'Listo'];
function abrirCorreo(prov){
  st.cc = null;
  st.cm = {paso:prov ? 2 : 1, prov:prov || null, f:{puertoImap:'993', puertoSmtp:'465'}, enviando:false, error:'', hecha:null};
  pintarCorreo();
}
const abrirConexionCanalCorreo = abrirConexionCanal;
abrirConexionCanal = function(k, ...r){ return k === 'mail' ? abrirCorreo() : abrirConexionCanalCorreo(k, ...r); };
const conectarCanalCorreo = conectarCanal;
conectarCanal = function(k){ return k === 'mail-google' ? abrirCorreo('google') : k === 'mail-otro' ? abrirCorreo('otro') : conectarCanalCorreo(k); };

const campoCm = (id, etq, v, extra = '', ayuda = '') => `<label>${etq}<input id="${id}" value="${esc(v || '')}" autocomplete="off" ${extra}>${ayuda ? `<small>${ayuda}</small>` : ''}</label>`;
const CORREO_OK = v => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(String(v || '').trim());
function listoCorreo(x){
  const f = x.f;
  if (!CORREO_OK(f.correo) || !String(f.clave || '').trim()) return false;
  if (x.prov === 'google') return String(f.clave).replace(/\s+/g, '').length >= 16;
  return /\S+\.\S+/.test(f.imapHost || '') && /\S+\.\S+/.test(f.smtpHost || '') && /^\d{2,5}$/.test(f.puertoImap || '') && /^\d{2,5}$/.test(f.puertoSmtp || '');
}
function pintarCorreo(){
  const x = st.cm; if (!x) return;
  const pasos = pasosHTML(PASOS_CORREO, x.paso === 3 ? 4 : x.paso);
  const cab = (t, s, marca = 'mail', logo = I('mail')) => dlgCab(marca, logo, t, s);
  let h;
  if (x.paso === 1) {
    h = `${cab('Conectar un correo', 'Los correos que lleguen al buzón entran a la bandeja')}${pasos}
      <p>¿Dónde está el correo de tu empresa?</p>
      <div class="cx-list">
        <button type="button" class="opc" data-cm-prov="google"><span class="marca gm">${LOGO.g}</span><span class="tx"><b>Gmail o Google Workspace<span class="etq-rec">Recomendado</span></b><small>Con una clave de aplicación de la cuenta. Tarda un par de minutos.</small></span>${I('chev', 'i ch')}</button>
        <button type="button" class="opc" data-cm-prov="otro"><span class="marca neutra">${I('mail')}</span><span class="tx"><b>Otro proveedor</b><small>Zoho, Yahoo, el correo de tu hosting o cualquiera con IMAP y SMTP.</small></span>${I('chev', 'i ch')}</button>
        <button type="button" class="opc" disabled><span class="marca neutra">${I('mail')}</span><span class="tx"><b>Outlook o Microsoft 365<span class="etq-pronto">No disponible todavía</span></b><small>Microsoft ya no deja entrar con clave: pide su propio inicio de sesión, que todavía no está en el CRM.</small></span></button>
      </div>
      <div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button></div>`;
  } else if (x.paso === 2) {
    const f = x.f, g = x.prov === 'google';
    const campos = g
      ? `${campoCm('cm-correo', 'Correo', f.correo, 'type="email" placeholder="ventas@tuempresa.com"')}
         ${campoCm('cm-clave', 'Clave de aplicación', f.clave, 'type="password" placeholder="16 letras, como abcd efgh ijkl mnop"', 'No es la clave normal de la cuenta. Se guarda cifrada.')}
         ${campoCm('cm-remitente', 'Nombre que ven tus clientes', f.remitente, `placeholder="${esc(ESPACIO.nombre || 'El nombre de tu empresa')}"`, 'Opcional. Así aparece quien envía.')}`
      : `${campoCm('cm-correo', 'Correo', f.correo, 'type="email" placeholder="ventas@tuempresa.com"')}
         ${campoCm('cm-clave', 'Clave', f.clave, 'type="password"', 'Si el correo tiene verificación en dos pasos, usa una clave de aplicación. Se guarda cifrada.')}
         ${campoCm('cm-usuario', 'Usuario', f.usuario, 'placeholder="Solo si es distinto del correo"')}
         <div class="two3" style="grid-template-columns:1fr 110px">${campoCm('cm-imap', 'Servidor de entrada (IMAP)', f.imapHost, 'placeholder="imap.tuempresa.com"')}${campoCm('cm-pimap', 'Puerto', f.puertoImap, 'inputmode="numeric"')}</div>
         <div class="two3" style="grid-template-columns:1fr 110px">${campoCm('cm-smtp', 'Servidor de salida (SMTP)', f.smtpHost, 'placeholder="smtp.tuempresa.com"')}${campoCm('cm-psmtp', 'Puerto', f.puertoSmtp, 'inputmode="numeric"')}</div>
         ${campoCm('cm-remitente', 'Nombre que ven tus clientes', f.remitente, `placeholder="${esc(ESPACIO.nombre || 'El nombre de tu empresa')}"`, 'Opcional. Así aparece quien envía.')}`;
    const ayuda = g
      ? ayudaCx(['La cuenta necesita la verificación en dos pasos activa (myaccount.google.com, Seguridad).', 'Entra a <b>myaccount.google.com/apppasswords</b>, ponle un nombre (por ejemplo, CRM) y crea la clave.', 'Google muestra 16 letras: cópialas y pégalas aquí. Los espacios no importan.', 'En Google Workspace, si no aparece la opción, el administrador debe permitir las claves de aplicación.'])
      : ayudaCx(['Los datos los da tu proveedor en su ayuda para «configurar el correo en otro programa» (Outlook, Thunderbird).', 'Suelen ser imap.tudominio.com con el puerto 993 y smtp.tudominio.com con el puerto 465 (o 587).', 'El CRM solo entra cifrado: no usa servidores sin TLS.']);
    h = `${cab(g ? 'Conectar Gmail o Google Workspace' : 'Conectar otro correo', g ? 'Con una clave de aplicación de la cuenta' : 'Con los servidores IMAP y SMTP de tu proveedor', g ? 'gm' : 'mail', g ? LOGO.g : I('mail'))}${pasos}
      <div class="cx-f">${campos}</div>${ayuda}
      <p class="muted" style="margin:0">Entran los correos que lleguen desde ahora; los de antes no se traen. El CRM no marca nada como leído en tu buzón.</p>${nota(x.error)}
      <div class="ft2"><button type="button" class="btn atras" data-cm-atras="1">Atrás</button><button type="button" class="btn pri" data-cm-enviar="1" ${listoCorreo(x) && !x.enviando ? '' : 'disabled'}>${x.enviando ? 'Probando la conexión…' : `${I('check')}Conectar`}</button></div>`;
  } else {
    const c = x.hecha || {}, dir = (c.correo || {}).direccion || c.nombre || '';
    h = `${cab('Listo', `Los correos de ${esc(dir)} ya llegan a la bandeja`)}${pasos}
      <div class="ll-sec"><div class="cx-fila"><b>${esc(dir)}</b><span class="ll-ok">${I('check')}Conectado</span></div>
        <div class="cx-prog"><div class="ok">${I('check')}El CRM entró al buzón y probó que puede enviar</div><div class="ok">${I('check')}Revisa la bandeja de entrada cada minuto</div><div class="ok">${I('check')}Las respuestas salen en el mismo hilo${(CFG.correo || {}).firma ? ', con la firma' : ''}</div></div></div>
      <p class="muted" style="margin:0">La firma, el equipo que atiende los correos y los buzones se manejan en Ajustes del CRM, Correo.</p>
      <div class="ft2"><button type="button" class="btn pri" data-cerrar-dlg="1">Listo</button></div>`;
  }
  abrirDialogo(h, 'ancho');
}
function enviarCorreo(x){
  const f = x.f, t = v => String(v || '').trim();
  x.enviando = true; x.error = ''; pintarCorreo();
  const cuerpo = x.prov === 'google'
    ? {proveedor:'google', correo:t(f.correo), clave:t(f.clave), remitente:t(f.remitente)}
    : {proveedor:'otro', correo:t(f.correo), clave:String(f.clave || ''), usuario:t(f.usuario), imapHost:t(f.imapHost), imapPuerto:+t(f.puertoImap), smtpHost:t(f.smtpHost), smtpPuerto:+t(f.puertoSmtp), remitente:t(f.remitente)};
  crmApi('POST', '/crm/conexiones/correo', cuerpo)
    .then(c => { mezclarConexion(c); x.hecha = c; x.paso = 3; x.f = {};
      if (!CX_CANALES.some(p => p.id === c.id)) CX_CANALES.push({id:c.id, canal:'mail', nombre:c.nombre, estado:c.estado});
      toast(`Correo conectado: ${c.nombre}`); if (st.pagina && st.pagina.startsWith('cfg-')) render(); })
    .catch(err => { x.error = err.message || 'No respondió'; })
    .finally(() => { x.enviando = false; if (st.cm === x && dlgAbierto()) pintarCorreo(); });
}
document.getElementById('ov-x').addEventListener('click', e => {
  const x = st.cm; if (!x || !dlgAbierto()) return; const t = e.target;
  const pv = t.closest('[data-cm-prov]'); if (pv) { x.prov = pv.dataset.cmProv; x.paso = 2; x.error = ''; pintarCorreo(); return; }
  if (t.closest('[data-cm-atras]')) { x.paso = 1; x.error = ''; pintarCorreo(); return; }
  const en = t.closest('[data-cm-enviar]'); if (en && !en.disabled && !x.enviando) { enviarCorreo(x); return; }
});
document.getElementById('ov-x').addEventListener('input', e => {
  const x = st.cm; if (!x || x.paso !== 2) return;
  const mapa = {'cm-correo':'correo', 'cm-clave':'clave', 'cm-usuario':'usuario', 'cm-imap':'imapHost', 'cm-pimap':'puertoImap', 'cm-smtp':'smtpHost', 'cm-psmtp':'puertoSmtp', 'cm-remitente':'remitente'};
  const k = mapa[e.target.id]; if (!k) return;
  if (k === 'puertoImap' || k === 'puertoSmtp') e.target.value = e.target.value.replace(/\D/g, '');
  x.f[k] = e.target.value;
  const b = document.querySelector('[data-cm-enviar]'); if (b) b.disabled = x.enviando || !listoCorreo(x);
});
// Abrir otro asistente (WhatsApp o un canal) deja de escuchar este.
const abrirConexionCanalSinCorreo = abrirConexionCanal;
abrirConexionCanal = function(k, ...r){ if (k !== 'mail') st.cm = null; return abrirConexionCanalSinCorreo(k, ...r); };

/* ── Página de ajustes del correo ── */
const hace = iso => { if (!iso) return 'todavía no'; const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000)); return s < 60 ? 'hace un momento' : s < 3600 ? `hace ${Math.round(s / 60)} min` : s < 86400 ? `hace ${Math.round(s / 3600)} h` : `hace ${Math.round(s / 86400)} días`; };
function paginaCorreo(){
  const info = INFO_CANAL.mail, cxs = conexionesDe('mail'), hay = cxs.length > 0, on = (CFG.correo || {}).on !== false;
  const volver = `<button type="button" class="volver" data-ir="ajustes-crm">${I('back')}Ajustes del CRM</button>`;
  const est = !hay ? '<span class="muted" style="margin-left:auto">Sin conectar</span>' : on ? '<span class="ok2" style="margin-left:auto">Conectado</span>' : '<span class="pill" style="margin-left:auto">Apagado</span>';
  const tarjeta = c => { const d = c.correo || {};
    const estado = c.estado === 'conectada' ? `<span class="ll-ok">${I('check')}Conectado</span>` : c.estado === 'error' ? `<span class="ll-no">${I('x')}Con un problema</span>` : '<span class="muted">Sin terminar</span>';
    const como = d.proveedor === 'google' ? 'Google, con clave de aplicación' : `Por IMAP y SMTP (${esc(d.servidor || '')})`;
    return `<div class="ll-sec"><div class="cx-fila"><b>${esc(d.direccion || c.nombre)}</b>${estado}</div>
      ${fila('Cómo se conectó', '', `<span class="muted">${como}</span>`)}
      ${d.remitente ? fila('Nombre que ven tus clientes', '', `<span class="muted">${esc(d.remitente)}</span>`) : ''}
      ${fila('Última revisión del buzón', c.estado === 'error' ? 'Se vuelve a intentar sola cada 15 minutos' : 'Se revisa sola cada minuto', `<span class="muted">${hace(d.revisado)}</span>`)}${nota(c.error)}
      <div class="cx-acc"><button type="button" class="btn" data-ccm-revisar="${c.id}">${I('swap')}Revisar ahora</button><button type="button" class="btn" data-ccm-quitar="${c.id}">${I('x')}Desconectar</button></div></div>`; };
  const eqSel = ddSel('data-cc-eq', EQUIPOS.map(e => [`mail|${e.n}`, e.n]), `mail|${equipoCanal('mail')}`);
  return `<div class="ajw ancho">${volver}<h2>Correo</h2><p class="sub">${DESC_CANAL.mail}</p>
    <div class="cfg"><div class="box2"><h4><span class="marca mini mail">${I('mail')}</span>Correo${est}</h4>
      ${fila('Recibir los correos', hay ? (on ? 'Llegan a la bandeja' : 'Apagado: los correos no entran al CRM') : 'Se activa al conectar un buzón', sw('correo-on', on, `aria-label="Recibir los correos" ${hay ? '' : 'disabled'}`))}
      ${fila('Equipo que los atiende', 'Recibe las conversaciones nuevas por correo', eqSel)}
      <label class="fld">Firma de las respuestas<textarea data-cfg-in="correo.firma" rows="3" placeholder="Ej. Equipo de ventas\n${esc(ESPACIO.nombre || 'Tu empresa')}">${esc((CFG.correo || {}).firma || '')}</textarea><small class="muted">Va al final de cada correo que sale desde la bandeja.</small></label></div>
      ${hay ? `<div class="box2"><h4>${I('lock')}Buzones conectados</h4>${cxs.map(tarjeta).join('')}</div>` : ''}
      <div><button type="button" class="btn${hay ? '' : ' pri'}" data-ccm-conectar="1">${I('plus')}${hay ? 'Conectar otro correo' : 'Conectar un correo'}</button></div></div></div>`;
}
const paginaCanalCorreo = paginaCanal;
paginaCanal = function(k){ return k === 'mail' ? paginaCorreo() : paginaCanalCorreo(k); };
