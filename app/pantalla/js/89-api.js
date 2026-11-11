/* ── Ajustes del CRM › API (maqueta «API de Wali · crear una clave», aprobada el 11-nov) ──
   Solo administradores. Nueva clave abre el modal del CRM (el de «Nueva respuesta rápida»): nombre, qué puede hacer
   (solo lectura, o lectura y acciones) y cuándo vence (90 días, 1 año o nunca). Crear clave la muestra una sola vez,
   con Copiar; Ya la guardé la deja en la lista resaltada. Revocar pide confirmación y la quita con animación.
   La clave completa nunca se guarda en la pantalla después de cerrar el modal. ── */
(() => {
  const API = {lista: null, cargando: false, perm: 'escritura', vence: '365', nombre: '', clave: null, copiada: false, nueva: null, saliendo: null, creando: false};
  const svg = d => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const IC = {
    llave: svg('<circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 8.7-8.7M16 7l3 3M18.5 4.5l2 2"/>'),
    mas: svg('<path d="M12 5v14M5 12h14"/>'), chulo: svg('<path d="m5 12 5 5L20 7"/>'),
    copia: svg('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>'),
    escudo: svg('<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z"/><path d="m9 12 2 2 4-4"/>'),
    libro: svg('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>'),
    ojo: svg('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
    lapiz: svg('<path d="M4 20h4L19 9l-4-4L4 16Z"/>'),
  };
  // El selector dibujado por coordenadas: el punto queda en el centro exacto (regla del 11-nov).
  const RADIO = '<svg class="ak-r" viewBox="0 0 20 20" aria-hidden="true"><circle class="aro" cx="10" cy="10" r="8.25"/><circle class="pto" cx="10" cy="10" r="4"/></svg>';
  const VENCE = [['90', '90 días'], ['365', '1 año'], ['nunca', 'Nunca']];
  const PERMISO = {lectura: 'Solo lectura', escritura: 'Lectura y acciones'};

  document.head.insertAdjacentHTML('beforeend', `<style>
.ak-tt{display:flex;align-items:center;justify-content:space-between;gap:12px}.ak-tt h2{margin:0}
.ak-nueva svg.i{width:16px;height:16px}
.ak-box{border:1px solid var(--line2,#eef0f3);border-radius:14px;padding:16px;margin-bottom:14px;background:#fff}
.ak-bh b{font-size:14.5px}.ak-bh small,.ak-doc small{display:block;font-size:12.5px;color:var(--ink3);margin-top:3px}
.ak-l{display:grid;gap:8px;margin-top:14px}
.ak-f{display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--line2,#eef0f3);border-radius:12px;transition:background .5s,border-color .5s}
.ak-f.nueva{animation:ak-entra .5s cubic-bezier(.32,.72,0,1) both;background:#fffbea;border-color:#f2d24c}
.ak-f.sale{animation:ak-sale .38s cubic-bezier(.32,.72,0,1) both;overflow:hidden}
@keyframes ak-entra{from{opacity:0;transform:translateY(-8px) scale(.98)}}@keyframes ak-sale{to{opacity:0;transform:translateX(16px);height:0;padding-top:0;padding-bottom:0;margin:0;border-width:0}}
.ak-ic{width:38px;height:38px;border-radius:10px;background:#fffde6;display:grid;place-items:center;flex:none}.ak-ic svg.i{width:18px;height:18px}
.ak-t{display:grid;gap:4px;min-width:0;flex:1}.ak-t b{font-size:14px}
.ak-m{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:12.5px;color:var(--ink3)}
.ak-code{font-family:ui-monospace,"JetBrains Mono",Menlo,monospace;font-size:12px;background:#f4f5f7;border-radius:6px;padding:2px 6px;color:#374151}
.ak-chip{font-size:11.5px;border-radius:6px;padding:2px 7px;font-weight:500}.ak-chip.lectura{background:#eef2ff;color:#4338ca}.ak-chip.escritura{background:#fff4d6;color:#92400e}.ak-chip.vencida{background:#fef2f2;color:#b91c1c}
.ak-rev{color:#dc2626;font-size:13px;font-weight:500;padding:7px 10px;border-radius:8px;transition:background .16s,transform .14s}.ak-rev:hover{background:#fef2f2}.ak-rev:active{transform:scale(.95)}
.ak-vacio{margin:14px 0 0;font-size:13px;color:var(--ink3)}
.ak-doc{display:flex;align-items:center;gap:14px}.ak-doc>div{flex:1}.ak-doc .ak-ic{background:#f4f5f7}
.dlg .ak-sec{display:grid;gap:7px;font-size:13px;font-weight:600}.dlg .ak-sec small{font-weight:400;color:var(--ink3);font-size:12px}
.dlg .ak-op{display:flex;gap:12px;text-align:left;padding:12px;border:1px solid var(--line);border-radius:12px;font-weight:400;width:100%;background:#fff;transition:border-color .16s,background .16s,transform .14s}.dlg .ak-op:active{transform:scale(.99)}
.dlg .ak-op b{display:block;font-size:13.5px;font-weight:600}.dlg .ak-op small{display:block;margin-top:2px}
.ak-r{width:20px;height:20px;flex:none}.ak-r .aro{fill:#fff;stroke:#b6c0d0;stroke-width:1.5;transition:stroke .16s}.ak-r .pto{fill:#0b0b10;transform-box:fill-box;transform-origin:center;transform:scale(0);transition:transform .2s cubic-bezier(.23,1,.32,1)}
.dlg .ak-op[aria-checked="true"]{border-color:#0b0b10;background:#fafafa}.ak-op[aria-checked="true"] .ak-r .aro{stroke:#0b0b10}.ak-op[aria-checked="true"] .ak-r .pto{transform:scale(1)}
.dlg .ak-vcs{display:flex;gap:6px}.dlg .ak-vc{height:34px;padding:0 14px;border-radius:9px;border:1px solid var(--line);font-size:13px;font-weight:500;background:#fff;transition:background .16s,color .16s,transform .14s}.dlg .ak-vc:active{transform:scale(.96)}.dlg .ak-vc[aria-checked="true"]{background:#0b0b10;border-color:#0b0b10;color:#fff}
.ak-rueda{width:15px;height:15px;border-radius:50%;border:2px solid rgba(11,11,16,.25);border-top-color:#0b0b10;animation:ak-gira .7s linear infinite}@keyframes ak-gira{to{transform:rotate(360deg)}}
.dlg.ak-copia .dlg-cerrar{display:none}
.ak-okic{width:44px;height:44px;border-radius:12px;background:#ecfdf5;color:#059669;display:grid;place-items:center;margin-bottom:10px}.ak-okic svg.i{width:22px;height:22px}
.ak-clave{display:flex;align-items:center;gap:10px;padding:10px 10px 10px 14px;border:1px dashed #d1d5db;border-radius:12px;background:#fafafa}
.ak-clave code{flex:1;font-family:ui-monospace,"JetBrains Mono",Menlo,monospace;font-size:13px;word-break:break-all;color:#0b0b10}
.ak-cp{position:relative;height:36px;min-width:104px;border-radius:9px;background:#0b0b10;color:#fff;font-size:13px;font-weight:600;overflow:hidden;transition:background .2s,transform .14s}.ak-cp:active{transform:scale(.96)}
.ak-cp>span{display:flex;align-items:center;justify-content:center;gap:6px;transition:transform .3s cubic-bezier(.32,.72,0,1),opacity .2s}.ak-cp svg.i{width:15px;height:15px}
.ak-cp-b{position:absolute;inset:0;transform:translateY(100%);opacity:0}.ak-cp.ok{background:#059669}.ak-cp.ok .ak-cp-a{transform:translateY(-100%);opacity:0}.ak-cp.ok .ak-cp-b{transform:none;opacity:1}
.ak-pts{list-style:none;margin:0;padding:0;display:grid;gap:8px;font-size:12.5px;color:var(--ink2)}.ak-pts li{display:flex;gap:9px;align-items:flex-start}.ak-pts svg.i{width:16px;height:16px;color:var(--ink3);margin-top:1px;flex:none}
@media (max-width:759.98px){
  .ak-nueva{width:40px;height:40px;padding:0;justify-content:center}.ak-nueva .ak-nt{display:none}.ak-nueva svg.i{width:20px;height:20px}
  .ak-f{flex-wrap:wrap}.ak-rev{margin-left:50px}.ak-doc{flex-wrap:wrap}.ak-doc .btn{width:100%;justify-content:center}
  .ak-clave{flex-direction:column;align-items:stretch}.ak-cp{width:100%}
}
@media (prefers-reduced-motion:reduce){.ak-f,.ak-r .pto,.ak-cp>span{animation:none!important;transition:none!important}}
</style>`);

  const hace = iso => {
    if (!iso) return 'Todavía no se ha usado';
    const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    return m < 2 ? 'Usada hace un momento' : m < 60 ? `Usada hace ${m} min` : m < 1440 ? `Usada hace ${Math.round(m / 60)} h` : `Usada hace ${Math.round(m / 1440)} días`;
  };
  const vence = iso => { if (!iso) return ''; const d = new Date(iso); return d.getTime() < Date.now() ? '' : ` · vence el ${d.toLocaleDateString('es-CO', {day: 'numeric', month: 'short', year: 'numeric'})}`; };

  function filas(){
    if (!API.lista) return '<p class="ak-vacio">Cargando…</p>';
    if (!API.lista.length) return '<p class="ak-vacio">Todavía no hay claves. Crea la primera con «Nueva clave».</p>';
    return `<div class="ak-l">${API.lista.map(k => `<div class="ak-f${API.nueva === k.id ? ' nueva' : ''}${API.saliendo === k.id ? ' sale' : ''}" data-ak-fila="${esc(k.id)}"><span class="ak-ic">${IC.llave}</span>
      <span class="ak-t"><b>${esc(k.nombre)}</b><span class="ak-m"><span class="ak-code">${esc(k.prefijo)}…</span><span class="ak-chip ${k.permiso === 'escritura' ? 'escritura' : 'lectura'}">${PERMISO[k.permiso] || k.permiso}</span>${k.vencida ? '<span class="ak-chip vencida">Vencida</span>' : ''}<span>${esc(hace(k.ultimoUso) + vence(k.venceEn))}</span></span></span>
      <button type="button" class="ak-rev" data-ak-revocar="${esc(k.id)}">Revocar</button></div>`).join('')}</div>`;
  }
  function paginaApi(){
    if (!API.lista && !API.cargando) cargar();
    return `<div class="ajw ancho"><button type="button" class="volver" data-ir="ajustes-crm">${I('back')}Ajustes del CRM</button>
      <div class="ak-tt"><h2>API</h2><button type="button" class="btn pri ak-nueva" data-ak-nueva="1" aria-label="Nueva clave">${IC.mas}<span class="ak-nt">Nueva clave</span></button></div>
      <p class="sub">Claves para que tus otros sistemas lean la información del CRM y hagan acciones, como asignar conversaciones en lote.</p>
      <div class="ak-box"><div class="ak-bh"><b>Claves de API</b><small>Cada clave ve solo este espacio de trabajo y nunca toca pagos ni tu cuenta.</small></div><div id="ak-filas">${filas()}</div></div>
      <div class="ak-box ak-doc"><span class="ak-ic">${IC.libro}</span><div><b>Cómo se usa</b><small>Va en cada llamada como <span class="ak-code">Authorization: Bearer</span> + la clave. Hasta 120 llamadas por minuto por clave. Dirección: <span class="ak-code">${esc(location.origin)}__BASE__/api/v1</span></small></div>
        <a class="btn" href="__BASE__/docs/api" target="_blank" rel="noopener">Ver la documentación</a></div></div>`;
  }
  const pintarFilas = () => { const f = document.getElementById('ak-filas'); if (f) { f.replaceChildren(); f.insertAdjacentHTML('beforeend', filas()); } };
  async function cargar(){
    API.cargando = true;
    try { API.lista = await crmApi('GET', '/crm/api-claves'); } catch (e) { API.lista = []; toast(e.message || 'No se pudieron cargar las claves'); }
    API.cargando = false; pintarFilas();
  }

  function dlgNueva(){
    abrirDialogo(`<div class="qd-cab"><h3>Nueva clave de API</h3><span>Para conectar Wali con otro de tus sistemas</span></div>
      <label class="qd-lab">Nombre<input id="ak-nombre" value="${esc(API.nombre)}" placeholder="Sistema de facturación" maxlength="60" autocomplete="off"><small style="font-weight:400;color:var(--ink3);font-size:12px">Para reconocerla en la lista. Ejemplo: el nombre del sistema que la va a usar.</small></label>
      <div class="ak-sec" role="radiogroup" aria-label="Qué puede hacer"><span>Qué puede hacer</span>
        ${[['lectura', 'Solo lectura', 'Lee conversaciones con sus mensajes, contactos, equipos, miembros, etapas, etiquetas, flujos y agentes de IA.'], ['escritura', 'Lectura y acciones', 'Además asigna conversaciones, también en lote, cambia la etapa, pone etiquetas, finaliza, crea contactos y enciende o apaga flujos y agentes de IA.']]
          .map(([k, t, d]) => `<button type="button" class="ak-op" role="radio" aria-checked="${API.perm === k}" data-ak-perm="${k}">${RADIO}<span><b>${t}</b><small>${d}</small></span></button>`).join('')}</div>
      <div class="ak-sec"><span>Vence</span><div class="ak-vcs" role="radiogroup" aria-label="Vence">${VENCE.map(([k, t]) => `<button type="button" class="ak-vc" role="radio" aria-checked="${API.vence === k}" data-ak-vence="${k}">${t}</button>`).join('')}</div></div>
      <div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" data-ak-crear="1" id="ak-crear">${API.creando ? '<span class="ak-rueda"></span>Creando…' : IC.chulo + 'Crear clave'}</button></div>`, 'dlg-qr');
    setTimeout(() => { const t = document.getElementById('ak-nombre'); if (t) t.focus(); }, 30);
  }
  function dlgCopia(k){
    abrirDialogo(`<div class="qd-cab"><span class="ak-okic">${IC.escudo}</span><h3>Copia tu clave ahora</h3><span>Por seguridad solo la vas a ver esta vez. Guárdala en un lugar seguro. Si la pierdes, revócala y crea otra.</span></div>
      <div class="ak-clave"><code id="ak-c">${esc(API.clave)}</code><button type="button" class="ak-cp" data-ak-copiar="1"><span class="ak-cp-a">${IC.copia}Copiar</span><span class="ak-cp-b">${IC.chulo}Copiada</span></button></div>
      <ul class="ak-pts"><li>${IC.lapiz}<span><b>${esc(k.nombre)}</b> · ${(PERMISO[k.permiso] || '').toLowerCase()}${k.venceEn ? ' · vence el ' + new Date(k.venceEn).toLocaleDateString('es-CO', {day: 'numeric', month: 'short', year: 'numeric'}) : ' · no vence'}</span></li><li>${IC.ojo}<span>No la compartas por chat ni correo. Pégala directo en el sistema que la va a usar.</span></li></ul>
      <div class="ft2"><button type="button" class="btn pri" data-ak-listo="1">${IC.chulo}Ya la guardé</button></div>`, 'ak-copia');
  }
  function dlgRevocar(k){
    abrirDialogo(`<div class="qd-cab"><h3>¿Revocar «${esc(k.nombre)}»?</h3><span>Deja de funcionar en este momento y el sistema que la usa ya no podrá entrar. No se puede deshacer.</span></div>
      <div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" style="background:#dc2626;border-color:#dc2626;color:#fff" data-ak-revocar-si="${esc(k.id)}">Revocar</button></div>`);
  }

  document.addEventListener('click', async e => {
    const t = e.target instanceof Element ? e.target : null; if (!t) return;
    if (t.closest('[data-ak-nueva]')) { API.nombre = ''; API.perm = 'escritura'; API.vence = '365'; dlgNueva(); return; }
    const p = t.closest('[data-ak-perm]'); if (p) { API.perm = p.dataset.akPerm; document.querySelectorAll('[data-ak-perm]').forEach(b => b.setAttribute('aria-checked', String(b === p))); return; }
    const v = t.closest('[data-ak-vence]'); if (v) { API.vence = v.dataset.akVence; document.querySelectorAll('[data-ak-vence]').forEach(b => b.setAttribute('aria-checked', String(b === v))); return; }
    if (t.closest('[data-ak-crear]')) {
      if (API.creando) return;
      const nombre = (document.getElementById('ak-nombre') || {}).value || '';
      if (nombre.trim().length < 2) { toast('Ponle un nombre a la clave'); return; }
      API.nombre = nombre; API.creando = true;
      const b = document.getElementById('ak-crear'); if (b) { b.replaceChildren(); b.insertAdjacentHTML('beforeend', '<span class="ak-rueda"></span>Creando…'); }
      try {
        const k = await crmApi('POST', '/crm/api-claves', {nombre: nombre.trim(), permiso: API.perm, vence: API.vence});
        API.clave = k.clave; API.copiada = false; API.nueva = k.id; API.creando = false; dlgCopia(k);
      } catch (err) { API.creando = false; dlgNueva(); toast(err.message || 'No se pudo crear la clave'); }
      return;
    }
    const cp = t.closest('[data-ak-copiar]');
    if (cp) { try { await navigator.clipboard.writeText(API.clave || ''); cp.classList.add('ok'); API.copiada = true; } catch { toast('No se pudo copiar. Selecciónala y cópiala a mano.'); } return; }
    if (t.closest('[data-ak-listo]')) { API.clave = null; cerrarDialogo(); await cargar(); setTimeout(() => { API.nueva = null; }, 1800); return; }
    const r = t.closest('[data-ak-revocar]'); if (r) { const k = (API.lista || []).find(x => x.id === r.dataset.akRevocar); if (k) dlgRevocar(k); return; }
    const si = t.closest('[data-ak-revocar-si]');
    if (si) {
      const id = si.dataset.akRevocarSi; cerrarDialogo();
      try {
        await crmApi('DELETE', '/crm/api-claves/' + encodeURIComponent(id));
        API.saliendo = id; pintarFilas();
        setTimeout(() => { API.saliendo = null; API.lista = (API.lista || []).filter(x => x.id !== id); pintarFilas(); toast('Clave revocada'); }, 380);
      } catch (err) { toast(err.message || 'No se pudo revocar'); }
    }
  });
  // Al cerrar el modal de copia sin «Ya la guardé» (Escape o fuera), la clave también se olvida.
  new MutationObserver(() => { if (document.getElementById('ov-x').hidden && API.clave) { API.clave = null; cargar(); } }).observe(document.getElementById('ov-x'), {attributes: true, attributeFilter: ['hidden']});

  const paginaCfgApi = paginaCfg;
  paginaCfg = function(k){ return k === 'api' ? (puedeConfigurarCrm() ? paginaApi() : '<div class="ajw"><p class="sub">Solo un administrador puede manejar las claves de la API.</p></div>') : paginaCfgApi.apply(this, arguments); };
})();
