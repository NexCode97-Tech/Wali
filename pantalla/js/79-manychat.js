/* ManyChat (8-oct, maqueta aprobada): Ajustes del CRM › Integraciones. Los leads que captura un flujo de ManyChat
   entran solos a Contactos por una «Solicitud externa» (POST /api/crm/manychat/:ruta con Authorization: Bearer).
   Conectar crea la clave (se ve una sola vez) y elige el equipo y la etapa con que entran; volver a conectar
   conserva la dirección y cambia la clave. El servidor está en src/services/crm/manychat.ts. */
INTEG_UI.manychat = {
  logo:'<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#0b0b10"/><path d="M8 21V11l4 5 4-5 4 5 4-5v10" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
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
@media (max-width:560px){.mc-sel{grid-template-columns:1fr}}
</style>`);
const MC_CUERPO = '{\n  "nombre": "{{full_name}}",\n  "telefono": "{{phone}}",\n  "correo": "{{email}}",\n  "instagram": "{{ig_username}}",\n  "etiquetas": "{{tags}}"\n}';
function mcSelects(){
  const eqs = EQUIPOS.map(q => q.n), eq0 = eqs[0] || '';
  const ops = eq => etapasDe(eq).map(e => `<option>${esc(e[0])}</option>`).join('');
  return `<div class="mc-sel ig-f"><label>Equipo que recibe los leads<select id="mc-eq">${eqs.map(n => `<option>${esc(n)}</option>`).join('')}</select></label><label>Etapa del embudo<select id="mc-et">${ops(eq0)}</select></label></div>`;
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
document.getElementById('ov-x').addEventListener('change', e => {
  if (e.target.id !== 'mc-eq') return;
  const et = document.getElementById('mc-et'); et.replaceChildren(); et.insertAdjacentHTML('beforeend', etapasDe(e.target.value).map(x => `<option>${esc(x[0])}</option>`).join(''));
});
document.getElementById('ov-x').addEventListener('click', e => {
  const cp = e.target.closest('[data-mc-copiar]');
  if (cp) { const x = document.getElementById(cp.dataset.mcCopiar); if (x) navigator.clipboard.writeText(cp.dataset.mcCopiar === 'mc-cuerpo' ? MC_CUERPO : x.textContent).then(() => toast('Copiado'), () => toast('No se pudo copiar')); return; }
  const g = e.target.closest('[data-mc-guardar]'); if (!g) return;
  const v = id => ((document.getElementById(id) || {}).value || '').trim();
  g.disabled = true; g.textContent = 'Conectando…';
  crmApi('POST', '/crm/integraciones/manychat', {equipo: v('mc-eq'), etapa: v('mc-et')})
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
