/* ManyChat (8-oct, maqueta aprobada): Ajustes del CRM › Integraciones. Los leads que captura un flujo de ManyChat
   entran solos a Contactos por una «Solicitud externa» (POST /api/crm/manychat/:ruta con Authorization: Bearer).
   Conectar crea la clave (se ve una sola vez) y elige el equipo y la etapa con que entran; volver a conectar
   conserva la dirección y cambia la clave. El servidor está en src/services/crm/manychat.ts. */
INTEG_UI.manychat = {
  logo:'<svg viewBox="0 0 120 120"><rect width="120" height="120" rx="26" fill="#000"/><g transform="translate(15 28)"><path fill="#fff" d="M0.0 35.0L0.0 6.0L23.8 6.0C42.0 6.0 47.7 6.1 48.0 6.3C48.2 6.5 48.2 9.1 48.2 16.2C48.2 21.4 48.3 25.7 48.4 25.7C48.7 25.7 49.9 23.7 50.1 22.9C50.4 21.8 52.5 17.7 53.5 16.2C53.8 15.8 54.0 15.5 54.0 15.4C54.0 15.2 55.3 13.2 55.5 13.0C55.6 12.9 56.1 12.2 56.6 11.4C57.9 9.4 62.7 4.6 64.6 3.4C66.4 2.2 68.9 1.0 69.5 1.0C69.7 1.0 70.2 0.8 70.6 0.5C71.2 0.0 71.6 0.0 75.8 0.0C79.5 0.0 80.5 0.1 80.7 0.3C80.8 0.5 81.4 0.9 82.1 1.2C85.2 2.6 88.5 8.2 89.1 13.2C89.2 14.0 89.5 14.9 89.6 15.0C90.2 15.5 90.2 35.0 89.6 37.0C89.4 37.8 89.1 39.8 89.0 41.5C88.9 43.2 88.6 45.9 88.4 47.5C88.2 49.1 87.9 51.3 87.8 52.4C87.6 53.5 87.4 55.2 87.3 56.2C87.1 57.3 86.8 59.4 86.6 61.1L86.1 64.0L72.6 64.0C63.2 64.0 59.0 63.9 59.0 63.7C59.0 63.6 59.2 63.1 59.5 62.5C60.3 60.9 61.8 57.7 62.1 56.8C62.3 56.3 62.8 55.1 63.2 54.2C63.6 53.3 64.0 52.4 64.0 52.2C64.0 52.0 64.1 51.7 64.2 51.6C64.4 51.6 64.6 51.1 64.8 50.6C64.9 50.0 65.3 49.2 65.5 48.6C65.8 48.1 66.2 47.0 66.5 46.1C66.8 45.3 67.2 44.3 67.4 43.9C67.6 43.6 67.9 42.7 68.1 42.1C68.3 41.4 68.8 40.1 69.1 39.1C69.5 38.2 69.9 37.0 70.0 36.5C70.1 36.0 70.3 35.4 70.4 35.1C70.6 34.9 70.8 34.0 71.0 33.1C71.2 32.3 71.4 31.4 71.5 31.2C72.0 30.3 72.5 25.4 72.2 23.9C72.1 23.1 71.9 22.3 71.9 22.2C71.6 21.8 69.7 21.5 68.9 21.7C67.7 22.1 65.8 23.7 64.6 25.4C64.1 26.2 63.6 26.9 63.5 27.0C63.2 27.2 62.0 29.6 62.0 29.8C62.0 30.0 61.8 30.4 61.5 30.8C61.2 31.1 61.0 31.5 61.0 31.8C61.0 32.0 60.8 32.4 60.5 32.8C60.2 33.1 60.0 33.5 60.0 33.7C60.0 33.9 59.8 34.5 59.5 35.1C58.7 36.8 58.0 38.7 56.6 42.8C55.4 46.1 55.2 46.7 55.0 47.5C54.9 48.0 54.7 48.7 54.6 49.0C54.2 49.8 53.1 53.7 52.9 54.8C52.8 55.2 52.6 55.7 52.5 55.9C52.4 56.0 52.2 56.8 52.0 57.6C51.9 58.4 51.6 59.6 51.4 60.1C51.2 60.7 50.9 61.8 50.8 62.6L50.5 64.0L40.1 64.0L29.8 64.0L29.8 45.1C29.8 28.3 29.7 26.2 29.4 25.9C28.8 25.3 20.2 25.3 19.6 25.9C19.3 26.2 19.2 28.3 19.2 45.1L19.2 64.0L9.6 64.0L0.0 64.0L0.0 35.0Z"/></g></svg>',
  cat:'Bots de Instagram, Messenger y WhatsApp', ayuda:'Se conecta desde tu flujo',
  res:'Cada lead que capture un flujo de ManyChat entra solo como contacto al CRM, con su nombre, teléfono, correo, Instagram y etiquetas. Si ya existe, se actualiza.',
  para:'Los leads de tus flujos llegan solos a Contactos',
};
document.head.insertAdjacentHTML('beforeend', `<style>
.mc-copia{display:flex;align-items:center;gap:8px;height:42px;border:1px solid #e5e9f0;border-radius:10px;padding:0 6px 0 12px;font-family:ui-monospace,monospace;font-size:12.5px;font-weight:400;background:#fafafa;color:var(--ink)}
.mc-copia span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mc-copia button{height:30px;padding:0 10px;border-radius:7px;font:inherit;font-family:Inter,system-ui,sans-serif;font-size:12px;flex:none}
.mc-cuerpo{margin:0;background:#17140F;color:#f5efe0;border-radius:10px;padding:12px 14px;font-size:12px;line-height:1.55;overflow:auto;font-family:ui-monospace,monospace;font-weight:400}
.mc-cuerpo b{color:#FFD21F;font-weight:500}
.mc-sel{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.mc-campo{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600;color:#374151;min-width:0}
.mc-dd .sel{width:100%;height:42px;display:flex;align-items:center;gap:8px;border:1px solid #e5e9f0;border-radius:10px;background:#fff;padding:0 12px;font:inherit;font-size:14px;font-weight:500;color:var(--ink);cursor:pointer}
.mc-dd .sel svg{width:16px;height:16px;color:#6b7280}
.mc-dd:has(.menu:not([hidden])) .sel{border-color:#0b0b10;box-shadow:0 0 0 3px #0b0b1014}
.mc-dd .menu{left:0;right:0;width:100%;top:48px;max-height:260px;overflow-y:auto;padding:6px;border-radius:12px}
.mc-dd .menu button{display:flex;align-items:center;gap:10px;font-size:13.5px}
.mc-dd .menu button[aria-selected="true"]{background:#fffbe0;font-weight:600}
.mc-dd .menu button svg{margin-left:auto;width:15px;height:15px}
.mc-pt{width:8px;height:8px;border-radius:50%;flex:none}
@media (max-width:560px){.mc-sel{grid-template-columns:1fr}}
</style>`);
const MC_CUERPO = '{\n  "nombre": "{{full_name}}",\n  "telefono": "{{phone}}",\n  "correo": "{{email}}",\n  "instagram": "{{ig_username}}",\n  "etiquetas": "{{tags}}"\n}';
/* Los desplegables del CRM (8-oct, maqueta aprobada): el botón con el punto de color y la lista con el chulito. */
const MC = {eq:'', et:''};
const mcPunto = c => `<span class="mc-pt" style="background:${c}"></span>`;
const mcColorEq = n => (typeof colorEquipo === 'function' ? colorEquipo(n) : '#3b82f6');
function mcDd(id, ops, sel){
  const act = ops.find(o => o[0] === sel) || ops[0] || ['', 'Sin opciones', '#cbd5e1'];
  return `<div class="dd dsel mc-dd" style="position:relative"><button type="button" class="sel" data-dsel-open="1">${mcPunto(act[2])}<span style="flex:1;text-align:left">${esc(act[1])}</span>${I('chev')}</button><div class="menu" hidden>${ops.map(([v, l, c]) => `<button type="button" data-mc-${id}="${esc(v)}" aria-selected="${v === act[0]}">${mcPunto(c)}${esc(l)}${v === act[0] ? I('check') : ''}</button>`).join('')}</div></div>`;
}
function mcSelects(){
  const eqs = EQUIPOS.map(q => q.n);
  if (!eqs.includes(MC.eq)) MC.eq = eqs[0] || '';
  const ets = etapasDe(MC.eq);
  if (!ets.some(e => e[0] === MC.et)) MC.et = (ets[0] || [''])[0];
  return `<div class="mc-sel ig-f" id="mc-sels"><div class="mc-campo"><span>Equipo que recibe los leads</span>${mcDd('eq', eqs.map(n => [n, n, mcColorEq(n)]), MC.eq)}</div><div class="mc-campo"><span>Etapa del embudo</span>${mcDd('et', ets.map(e => [e[0], e[0], e[1] || '#cbd5e1']), MC.et)}</div></div>`;
}
function mcDialogo(res){
  const s = (INTEG.lista || []).find(x => x.id === 'manychat') || {}, u = INTEG_UI.manychat;
  const pasos = ['En ManyChat abre el flujo donde capturas al lead y, al final, agrega la acción <b>Solicitud externa</b> (External Request).', 'Método <b>POST</b>, pega la dirección de abajo y en Encabezados agrega <b>Authorization</b> con la clave.', 'En Cuerpo elige JSON y pega el ejemplo. ManyChat cambia lo que va entre llaves por los datos de cada persona.', 'Dale «Probar la solicitud» en ManyChat: el lead aparece en Contactos.'];
  const copia = (id, v) => `<div class="mc-copia"><span id="${id}">${esc(v)}</span><button type="button" class="btn" data-mc-copiar="${id}">Copiar</button></div>`;
  const cuerpo = esc(MC_CUERPO).replace(/\{\{(\w+)\}\}/g, '<b>{{$1}}</b>');
  abrirDialogo(`<div class="ig-dcab"><span class="ig-logo">${integLogo('manychat')}</span><div><h3>Conectar ManyChat</h3><span>${esc(u.para)}</span></div></div>
    <div class="ig-pasos">${pasos.map((p, i) => `<span class="ig-paso"><i>${i + 1}</i><span>${p}</span></span>`).join('')}</div>
    ${res ? `<div class="ig-f"><label>Dirección${copia('mc-url', res.url)}</label><label>Clave (Authorization)${copia('mc-clave', 'Bearer ' + res.clave)}</label><label>Cuerpo de ejemplo<pre class="mc-cuerpo" id="mc-cuerpo">${cuerpo}</pre></label></div>
      <p class="ig-nota">${I('lock')}Copia la clave ahora: por seguridad no se vuelve a mostrar. Si la pierdes, vuelve a conectar y se crea otra.</p>
      <div class="ft2"><button type="button" class="btn" data-mc-copiar="mc-cuerpo">Copiar el cuerpo</button><button type="button" class="btn pri" data-cerrar-dlg="1">${I('check')}Listo</button></div>`
    : `${mcSelects()}<p class="ig-nota">Si el teléfono o el correo ya existen en Contactos, se actualiza ese contacto en vez de crear otro. Las etiquetas de ManyChat se suman a las del contacto.${s.conectado ? ' Volver a conectar crea una clave nueva: cámbiala también en tu flujo.' : ''}</p>
      <div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" data-mc-guardar="1">${I('link')}${s.conectado ? 'Crear una clave nueva' : 'Guardar y ver la dirección'}</button></div>`}`, 'dlg-per dlg-ig');
}
document.getElementById('page').addEventListener('click', e => {
  if (st.pagina !== 'cfg-integraciones') return;
  if (!e.target.closest('[data-integ-conectar="manychat"]')) return;
  e.stopImmediatePropagation();
  mcDialogo(null);
}, true);
document.getElementById('ov-x').addEventListener('click', e => {
  const b = e.target.closest('[data-mc-eq], [data-mc-et]'); if (!b) return;
  if (b.dataset.mcEq !== undefined) { MC.eq = b.dataset.mcEq; MC.et = ''; } else MC.et = b.dataset.mcEt;
  const caja = document.getElementById('mc-sels'); if (!caja) return;
  caja.insertAdjacentHTML('beforebegin', mcSelects()); caja.remove();
});
document.getElementById('ov-x').addEventListener('click', e => {
  const cp = e.target.closest('[data-mc-copiar]');
  if (cp) { const x = document.getElementById(cp.dataset.mcCopiar); if (x) navigator.clipboard.writeText(cp.dataset.mcCopiar === 'mc-cuerpo' ? MC_CUERPO : x.textContent).then(() => toast('Copiado'), () => toast('No se pudo copiar')); return; }
  const g = e.target.closest('[data-mc-guardar]'); if (!g) return;
  g.disabled = true; g.textContent = 'Conectando…';
  crmApi('POST', '/crm/integraciones/manychat', {equipo: MC.eq, etapa: MC.et})
    .then(r => { INTEG.lista = Array.isArray(r.integraciones) ? r.integraciones : INTEG.lista; mcDialogo(r); render(); toast('ManyChat quedó conectado'); })
    .catch(err => { g.disabled = false; g.textContent = 'Guardar y ver la dirección'; toast(err.message); });
});
/* Con ManyChat conectado, su tarjeta suma «Nueva clave» junto a Desconectar. */
const mcRenderBase = render;
render = function(){
  mcRenderBase.apply(this, arguments);
  if (st.pagina !== 'cfg-integraciones') return;
  const s = (INTEG.lista || []).find(x => x.id === 'manychat');
  const q = s && s.conectado && document.querySelector('#page [data-integ-quitar="manychat"]');
  if (q && !q.parentElement.querySelector('[data-integ-conectar="manychat"]')) q.insertAdjacentHTML('beforebegin', `<button type="button" class="btn" data-integ-conectar="manychat">${I('link')}Nueva clave</button>`);
};
