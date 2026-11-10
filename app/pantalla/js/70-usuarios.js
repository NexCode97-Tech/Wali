/* ── Cobro por usuarios (maqueta «Cobro por usuarios», opción A, aprobada el 10-nov) ──
   · Un solo bloque de permiso para todo cobro de usuarios (plPermisoHTML) y un solo botón de aprobar (plBotonAprobar):
     lo usan el modal «Cambiar los usuarios del plan» (aquí) y el de invitar de Personas (86-subequipos.js).
   · NADA se cobra sin el botón «Aprobar pago de USD X»: primero el servidor cotiza (POST /crm/plan/usuarios/cotizar)
     y solo al aprobar cobra la parte proporcional con la tarjeta guardada (POST /crm/plan/usuarios/aprobar). Si el banco
     pide un paso más (3D Secure), Whop lo muestra con el mismo formulario seguro del pago del plan.
   · Bajar no cobra: el precio baja desde la renovación (POST /crm/plan/usuarios/bajar).
   Va dentro de una función para no dejar nombres sueltos; lo que usan otros archivos queda en window. */
(() => {
  const MENOS = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>';
  const INFO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.01"/></svg>';
  const CHULO = '<svg class="pu-chulo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
  document.head.insertAdjacentHTML('beforeend', `<style>
/* Una curva (ease-out-quint) y tres duraciones, como Plan y pagos. */
.pu-perm{border-radius:16px;background:#FFF6CC;padding:18px 18px 16px;display:grid;gap:12px;animation:pu-sube .32s cubic-bezier(.22,1,.36,1) both}
.pu-perm.gris{background:#f5f6f8}
.pu-perm-t{display:flex;gap:10px;align-items:flex-start}
.pu-ic{width:34px;height:34px;border-radius:10px;background:#FFD21F;color:#0b0b10;display:grid;place-items:center;flex:none}.pu-ic svg{width:17px;height:17px}
.pu-perm.gris .pu-ic{background:#fff;box-shadow:inset 0 0 0 1px var(--line)}
.pu-perm-t b{display:block;font-size:14.5px;color:var(--ink)}.pu-perm-t span span{color:var(--ink2);font-size:13px}
.pu-lin{display:grid;grid-template-columns:auto minmax(16px,1fr) auto;align-items:center;gap:12px;min-height:34px;font-size:13.5px;color:var(--ink2)}
.pu-lin b{color:var(--ink);font-variant-numeric:tabular-nums}.pu-lin i{border-bottom:1.5px dotted #b8bcc4;height:1px;opacity:.8}
.pu-lin.tot{color:var(--ink);font-weight:600}.pu-lin.tot b{font-size:16px}
.pu-tarj{display:inline-flex;align-items:center;gap:8px}.pu-tarj em{font-style:normal;font-size:11px;font-weight:700;padding:2px 6px;border-radius:4px;background:#1a1f71;color:#fff;text-transform:capitalize}
.pu-extra{margin:0;display:flex;gap:8px;font-size:13px;color:var(--ink)}.pu-extra svg{width:16px;height:16px;color:var(--green-ink);flex:none;margin-top:1px}
.pu-letra{margin:0;color:var(--ink2);font-size:12.5px}
@keyframes pu-sube{from{opacity:0;transform:translateY(8px)}}
/* Aprobar: cobrando (rueda) y aprobado (chulo que se dibuja). */
.btn.pu-apr{background:#FFD21F;border-color:#FFD21F;color:#0b0b10;font-weight:600;min-height:44px;padding:0 18px;gap:8px;min-width:230px;justify-content:center;transition:transform .16s cubic-bezier(.22,1,.36,1),background .2s}
.btn.pu-apr:hover{background:#f5c800;border-color:#f5c800}.btn.pu-apr:active{transform:scale(.97)}
.btn.pu-apr.listo{background:var(--green-ink);border-color:var(--green-ink);color:#fff}
.btn.pu-apr[disabled]{cursor:default}
.pu-rueda{width:16px;height:16px;border-radius:50%;border:2px solid rgba(11,11,16,.25);border-top-color:#0b0b10;animation:pu-gira .7s linear infinite}
@keyframes pu-gira{to{transform:rotate(360deg)}}
.pu-chulo{width:17px;height:17px}.pu-chulo path{stroke-dasharray:24;stroke-dashoffset:24;animation:pu-traza .36s cubic-bezier(.22,1,.36,1) both}
@keyframes pu-traza{to{stroke-dashoffset:0}}
/* Selector − N + */
.pu-paso{display:inline-flex;align-items:center;border:1px solid var(--line);border-radius:12px;background:#fff;height:44px;flex:none}
.pu-paso button{width:44px;height:42px;display:grid;place-items:center;border:0;background:none;border-radius:11px;color:var(--ink);cursor:pointer;transition:background .16s,transform .16s cubic-bezier(.22,1,.36,1)}
.pu-paso button:hover{background:var(--bg2)}.pu-paso button:active{transform:scale(.94)}
.pu-paso button[disabled]{opacity:.35;cursor:default;background:none;transform:none}
.pu-paso svg{width:18px;height:18px}
.pu-paso b{min-width:40px;text-align:center;font-size:16px;font-variant-numeric:tabular-nums}
/* Modal «Cambiar los usuarios del plan»: el mismo marco del de invitar (encabezado, cuerpo y pie). */
.dlg.dlg-usu{width:min(620px,100%);padding:0!important;gap:0;overflow:hidden}
.dlg-usu .bq-h{padding:22px 60px 16px 24px}
.dlg-usu .pu-cuerpo{padding:20px 24px 4px;display:grid;gap:12px}
.dlg-usu .pu-fila{display:flex;align-items:center;justify-content:space-between;gap:16px}
.dlg-usu .pu-fila b{display:block;font-size:15px}.dlg-usu .pu-fila small{color:var(--ink3);font-size:13px}
.dlg-usu .pu-perm{margin:16px 24px}
.dlg .bq-pie .btn{white-space:nowrap}
/* En el modal de invitar: el permiso entre las columnas y el pie; en el celular, los datos se resumen en un renglón. */
.pu-en-inv{padding:0 24px}.pu-en-inv .pu-perm{margin:16px 0}
.pu-quien{display:none;align-items:center;gap:12px;margin:14px 18px 0;padding:12px 14px;border:1px solid var(--line);border-radius:14px}
.pu-quien-av{width:34px;height:34px;border-radius:50%;background:#0b0b10;color:#fff;display:grid;place-items:center;font:600 12.5px/1 Inter,system-ui,sans-serif;flex:none}
.pu-quien b{display:block;font-size:14px}.pu-quien small{color:var(--ink3);font-size:12.5px}
@media (max-width:760px){.bq-cols.pu-oculta{display:none}.pu-quien{display:flex}.pu-en-inv{padding:0 18px}}
/* En Plan y pagos: el encabezado de Usuarios con Invitar persona y el selector. */
.pu-h{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;margin-top:34px}
.pu-h h3{margin:0;font-size:17px;font-weight:700;color:var(--ink)}.pu-h p{margin:4px 0 0;color:var(--ink3);font-size:13.5px;max-width:58ch}
.pu-c{display:flex;align-items:center;gap:10px}
.pu-inv{border-color:transparent;background:none;color:var(--ink2)}
.pu-tope{margin:10px 0 0;display:flex;gap:8px;align-items:center;color:var(--ink3);font-size:12.5px}.pu-tope svg{width:14px;height:14px;flex:none}
.pla-prox{margin:8px 0 0;display:flex;gap:8px;align-items:center;font-size:13px;color:#92400e}.pla-prox svg{width:15px;height:15px}
.pla-silla.nueva-ok{background:#FFD21F;color:#0b0b10}
@media (max-width:640px){
  .pu-c{width:100%;justify-content:space-between}
  .dlg-usu .bq-pie{flex-wrap:wrap}.dlg-usu .bq-pie .btn{flex:1}.dlg-usu .bq-pie .bq-res{display:none}.btn.pu-apr{min-width:0;flex-basis:100%}
  .pu-lin{font-size:13px}
}
@media (prefers-reduced-motion:reduce){.pu-perm,.pu-chulo path,.pu-rueda{animation:none!important}.pu-chulo path{stroke-dashoffset:0}}
</style>`);

  const dinero = c => `USD ${(c / 100).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  const NOM = {starter: 'Starter', growth: 'Growth', business: 'Business'};
  const EXTRA = {growth: 'Pasas a Growth, con 3 espacios de trabajo y 2 agentes de IA.', business: 'Pasas a Business, con 6 espacios de trabajo y agentes de IA ilimitados.'};
  const usuTxt = n => n === 1 ? '1 usuario' : `${n} usuarios`;
  const fecha = iso => (typeof plFecha === 'function' ? plFecha(iso, true).replace(/ de \d{4}$/, '') : '');

  /** El bloque de permiso de un cobro de usuarios. q: la cotización del servidor; titulo y sub: arriba del bloque. */
  function plPermisoHTML(q, titulo, sub){
    const por = q.periodo === 'anual' ? 'al año' : 'al mes', planAntes = (typeof PLAN === 'object' && PLAN && PLAN.plan) || '';
    const t = q.tarjeta ? `<span class="pu-tarj"><em>${esc(q.tarjeta.marca)}</em><b>•••• ${esc(q.tarjeta.ultimos)}</b></span>` : '<b>Tu tarjeta guardada</b>';
    return `<div class="pu-perm" role="region" aria-label="Aprobar el pago">
      <div class="pu-perm-t"><span class="pu-ic">${I('card')}</span><span><b>${esc(titulo)}</b><span>${esc(sub)}</span></span></div>
      <div><div class="pu-lin"><span>Tu plan desde el ${esc(fecha(q.renuevaEl))}</span><i></i><b>USD ${esc(String(q.precio))} ${por}</b></div>
        <div class="pu-lin"><span>Se cobra a</span><i></i>${t}</div>
        <div class="pu-lin tot"><span>Hoy, por ${q.dias === 1 ? 'el día que queda' : `los ${q.dias} días que quedan`}</span><i></i><b>${esc(dinero(q.hoy))}</b></div></div>
      ${q.plan !== planAntes && EXTRA[q.plan] ? `<p class="pu-extra">${I('check')}${esc(EXTRA[q.plan])}</p>` : ''}
    </div>`;
  }
  /** El botón de aprobar con sus tres estados: listo para aprobar, cobrando y aprobado. */
  function plBotonAprobar(texto, fase, attr){
    if (fase === 'cobrando') return `<button type="button" class="btn pu-apr" disabled><span class="pu-rueda" aria-hidden="true"></span>Cobrando a tu tarjeta…</button>`;
    if (fase === 'listo') return `<button type="button" class="btn pu-apr listo" disabled>${CHULO}Pago aprobado</button>`;
    return `<button type="button" class="btn pu-apr" ${attr}>${esc(texto)}</button>`;
  }
  const regreso = () => `${location.origin}__BASE__/?ir=cfg-plan&pago=whop`;
  /** Cobra lo aprobado. Devuelve true si quedó pagado; lanza el error del banco o del servidor si no. */
  async function plAprobarUsuarios(q){
    const r = await crmApi('POST', '/crm/plan/usuarios/aprobar', {usuarios: q.usuarios, hoy: q.hoy, regreso: regreso()});
    if (['paid', 'succeeded', 'trialing', 'active'].includes(r.status)) return true;
    if (r.client_secret) {
      // El banco pide un paso más (3D Secure): Whop lo muestra con su formulario seguro, el mismo del pago del plan.
      await ppCargarScript();
      const w = window.WhopElements({locale: 'es'});
      const res = await w.payments.handleNextAction({clientSecret: r.client_secret, returnUrl: regreso()});
      if (res && res.redirected) return false;
      if (res && (res.status === 'succeeded' || res.status === 'processing')) return true;
      throw new Error((res && res.lastPaymentError && res.lastPaymentError.message) || 'Tu banco no aprobó el cobro. No te cobramos nada.');
    }
    if (['failed', 'canceled', 'declined'].includes(r.status)) throw new Error('Tu banco no aprobó el cobro. No te cobramos nada. Revisa tu tarjeta en Facturas y tarjeta.');
    return true;
  }
  // Después de cobrar, el plan se vuelve a traer hasta ver los usuarios nuevos (el aviso de Whop tarda unos segundos).
  function plEsperarUsuarios(n, intento = 0){
    return cargarPlan().then(P => {
      if (st.pagina === 'cfg-plan') render();
      const listo = P.usuarios && P.usuarios.pagados >= n;
      if (!listo && intento < 10) return new Promise(r => setTimeout(r, 2500)).then(() => plEsperarUsuarios(n, intento + 1));
      return listo;
    });
  }
  window.plPermisoHTML = plPermisoHTML; window.plBotonAprobar = plBotonAprobar; window.plAprobarUsuarios = plAprobarUsuarios; window.plEsperarUsuarios = plEsperarUsuarios;

  /* ── Modal «Cambiar los usuarios del plan» ── */
  const U = {n: 0, q: null, fase: '', cargando: false, pide: 0};
  const pagados = () => (PLAN && PLAN.usuarios && PLAN.usuarios.pagados) || 0;
  const base = () => (PLAN && PLAN.usuarios && PLAN.usuarios.prox != null ? PLAN.usuarios.prox : pagados());
  const enUso = () => (PLAN && PLAN.uso && PLAN.uso.usuarios) || 0;
  const minimo = () => Math.max(3, enUso());
  function dlgUsuarios(){
    const n = U.n, sube = n > pagados(), baja = n !== base() && n <= pagados(), q = U.q && U.q.usuarios === n ? U.q : null;
    const paso = `<div class="pu-paso" role="group" aria-label="Usuarios del plan"><button type="button" aria-label="Quitar un usuario" data-pu-n="${n - 1}" ${n <= minimo() || U.fase ? 'disabled' : ''}>${MENOS}</button><b aria-live="polite">${n}</b><button type="button" aria-label="Agregar un usuario" data-pu-n="${n + 1}" ${n >= 200 || U.fase ? 'disabled' : ''}>${I('plus')}</button></div>`;
    const tope = n <= minimo() && n === enUso() ? `<p class="bq-ay">${INFO}<span>Para pagar menos, primero quita a alguien del equipo en Usuarios.</span></p>` : '';
    const precioN = q ? q.precio : null, por = PLAN.periodo === 'anual' ? 'al año' : 'al mes';
    let bloque = '', boton = `<button type="button" class="btn pri" disabled>Guardar cambio</button>`;
    if (sube) {
      const mas = n - pagados();
      bloque = q ? plPermisoHTML(q, `${usuTxt(n)} · ${NOM[q.plan]}`, `${mas === 1 ? '1 usuario más' : `${mas} usuarios más`} de los que tienes hoy. Si cancelas, nada cambia.`)
        : `<div class="pu-perm"><div class="pu-perm-t"><span class="pu-ic">${I('card')}</span><span><b>${usuTxt(n)}</b><span>Calculando el valor…</span></span></div></div>`;
      boton = q ? plBotonAprobar(`Aprobar pago de ${dinero(q.hoy)}`, U.fase, 'data-pu-aprobar="1"') : `<button type="button" class="btn pu-apr" disabled>Calculando…</button>`;
    } else if (baja) {
      const vuelve = n === pagados();
      const precio = q ? q.precio : '';
      const txt = vuelve ? `Sigues con ${usuTxt(n)}${precio ? ` y USD ${precio} ${por}` : ''}. No se cobra nada.`
        : `Desde el ${fecha(PLAN.renuevaEl)} pagas ${precio ? `USD ${precio} ${por}` : 'menos'}. Hoy no se cobra nada y los ${pagados()} usuarios que ya pagaste siguen disponibles hasta esa fecha.`;
      bloque = `<div class="pu-perm gris" role="region" aria-label="Bajar de usuarios"><div class="pu-perm-t"><span class="pu-ic">${MENOS}</span><span><b>${usuTxt(n)}${q ? ` · ${NOM[q.plan]}` : ''}</b><span>${esc(txt)}</span></span></div></div>`;
      boton = `<button type="button" class="btn pri" data-pu-bajar="1" ${U.fase ? 'disabled' : ''}>${U.fase === 'guardando' ? 'Guardando…' : 'Guardar cambio'}</button>`;
    }
    return `<div class="bq-h"><h3>Cambiar los usuarios del plan</h3><p>Pagas por cada persona que entra al CRM. El plan sale solo según cuántos son.</p></div>
      <div class="pu-cuerpo"><div class="pu-fila"><span><b>Usuarios del plan</b><small>Hoy tienes ${enUso()} de ${pagados()} en uso.</small></span>${paso}</div>${tope}</div>
      ${bloque}<div class="bq-pie"><span class="bq-res"></span><button type="button" class="btn" data-pu-cerrar="1" ${U.fase === 'cobrando' ? 'disabled' : ''}>Cancelar</button>${boton}</div>`;
  }
  function pintar(){ if (document.getElementById('ov-x').hidden || !document.querySelector('#dlg-x.dlg-usu')) return; abrirDialogo(dlgUsuarios(), 'dlg-usu'); }
  // Cada número pide su valor al servidor (el mismo cálculo con el que se cobra); si cambian rápido, vale el último.
  function cotizar(){
    const n = U.n, pide = ++U.pide; U.q = null;
    if (n === base() && !(n <= pagados() && n !== base())) { pintar(); return; }
    crmApi('POST', '/crm/plan/usuarios/cotizar', {usuarios: n}).then(q => { if (pide !== U.pide) return; U.q = q; pintar(); })
      .catch(err => { if (pide !== U.pide) return; toast(err.message || 'No se pudo calcular el valor'); U.n = base(); pintar(); });
    pintar();
  }
  function abrirUsuarios(n){
    if (!PLAN || !PLAN.usuarios || PLAN.usuarios.pagados == null) return;
    U.n = Math.max(minimo(), Math.min(200, n)); U.q = null; U.fase = '';
    abrirDialogo(dlgUsuarios(), 'dlg-usu'); cotizar();
  }
  window.plAbrirUsuarios = abrirUsuarios;

  document.getElementById('ov-x').addEventListener('click', async e => {
    if (!document.querySelector('#dlg-x.dlg-usu')) return;
    const t = e.target;
    if (t.closest('[data-pu-cerrar]')) { if (U.fase !== 'cobrando') cerrarDialogo(); return; }
    const pn = t.closest('[data-pu-n]'); if (pn && !pn.disabled) { U.n = Math.max(minimo(), Math.min(200, +pn.dataset.puN)); cotizar(); return; }
    if (t.closest('[data-pu-aprobar]') && U.q && !U.fase) {
      const q = U.q; U.fase = 'cobrando'; pintar();
      try {
        const ok = await plAprobarUsuarios(q);
        if (!ok) return;
        U.fase = 'listo'; pintar();
        await plEsperarUsuarios(q.usuarios);
        setTimeout(() => { U.fase = ''; cerrarDialogo(); toast(`Pago aprobado. Ya tienes ${usuTxt(q.usuarios)}.`); if (st.pagina === 'cfg-plan') render(); }, 900);
      } catch (err) { U.fase = ''; toast(err.message || 'No se pudo hacer el cobro. No te cobramos nada.'); cotizar(); }
      return;
    }
    if (t.closest('[data-pu-bajar]') && !U.fase) {
      const n = U.n, vuelve = n === pagados(); U.fase = 'guardando'; pintar();
      try {
        await crmApi('POST', '/crm/plan/usuarios/bajar', {usuarios: n});
        await cargarPlan(); U.fase = ''; cerrarDialogo(); if (st.pagina === 'cfg-plan') render();
        toast(vuelve ? `Listo. Sigues con ${usuTxt(n)}.` : `Listo. Desde el ${fecha(PLAN.renuevaEl)} pagas por ${usuTxt(n)}.`);
      } catch (err) { U.fase = ''; pintar(); toast(err.message || 'No se pudo guardar el cambio'); }
    }
  });
  // Ni Escape ni un clic afuera cierran mientras se cobra (aquí o en el modal de invitar).
  const cobrando = () => U.fase === 'cobrando' || !!(st.pa && st.pa.inv && st.pa.inv.fase === 'cobrando');
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && cobrando()) e.stopImmediatePropagation(); }, true);
  document.getElementById('ov-x').addEventListener('click', e => { if (cobrando() && (e.target.id === 'ov-x' || e.target.closest('[data-cerrar-dlg]'))) e.stopImmediatePropagation(); }, true);
})();
