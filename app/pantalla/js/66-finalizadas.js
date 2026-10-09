/* ── Finalizadas y reglas al finalizar ──
   · Tablero FinLista: «Finalizadas» en el menú, debajo de Conversaciones (al integrante, debajo de Menciones), con su
     cuenta. Abre la lista de finalizadas con el título «Finalizadas» y las pestañas Mías y Todas. La tarjeta de una
     finalizada lleva el equipo y la etapa, y debajo «Finalizada hoy, 9:40 a. m. por …». En el chat, el evento de la regla
     va como la pastilla gris: «Pasó a ● Conversación cerrada al finalizar».
   · Tableros FinReglas y FinReglaNueva: en Reglas automáticas, el disparador «La persona vuelve a escribir después de
     finalizar», la condición «Equipo es…» y la acción «Volver a la etapa que tenía al finalizar» (las entiende
     services/crm/reglas.ts). */
(() => {
  const SVG = d => `<svg viewBox="0 0 24 24" class="fin-svg" aria-hidden="true">${d}</svg>`;
  const VISTO = '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>';
  document.head.insertAdjacentHTML('beforeend', `<style>
.fin-svg{fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round;flex:none}
#principal .fin-svg{width:18px;height:18px}
.it .tj-et{display:inline-flex;align-items:center;gap:5px;min-width:0}
.it .tj-et i{width:7px;height:7px;border-radius:50%;display:inline-block;flex:none}
.it .tj-et > span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.it .tj-fin{display:flex;align-items:center;gap:6px;margin-top:8px;font-size:12px;color:#6b7280;min-width:0}
.it .tj-fin .fin-svg{width:13px;height:13px;color:#16a34a}
.it .tj-fin > span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.fin-ev{align-self:center;font-size:12px;color:var(--ink3);background:var(--bg3);border-radius:999px;padding:4px 12px;max-width:94%;text-align:center}
.fin-ev i{width:7px;height:7px;border-radius:50%;display:inline-block;margin:0 4px 1px 2px;vertical-align:middle}
.fin-ev b{font-weight:600;color:var(--ink2)}
</style>`);

  /* ── Reglas automáticas ── */
  const VUELVE = 'La persona vuelve a escribir después de finalizar';
  if (!R_CUANDO.includes(VUELVE)) R_CUANDO.push(VUELVE);
  const tiposBase = reglaTipos;
  reglaTipos = function(q){
    const t = tiposBase.apply(this, arguments);
    if (q === 'si') t.splice(2, 0, ['Equipo es', EQUIPOS.map(e => e.n), x => `Equipo es ${x}`]);
    else t.push(['Volver a la etapa que tenía al finalizar']);
    return t;
  };

  /* ── Menú: «Finalizadas» ── */
  const finalizadas = () => CONV.filter(c => okRol(c) && c.est === 'finalizadas').length;
  const navBase = nav;
  nav = function(){
    // Las cuentas del menú (Mi bandeja, Sin asignar…) siguen siendo las de las abiertas, como en la maqueta.
    const fin = !!st.finVista && st.est === 'finalizadas';
    if (fin) st.est = 'abiertas';
    try { navBase.apply(this, arguments); } finally { if (fin) st.est = 'finalizadas'; }
    const ul = document.getElementById('principal'), lider = esLiderCrm();
    const despues = ul.querySelector(lider ? '[data-nav="sin"]' : '[data-nav="menciones"]');
    // Al líder le sale con Menciones y Sin asignar, cuando Conversaciones está desplegado.
    if (despues && despues.closest('li')) {
      const n = finalizadas();
      despues.closest('li').insertAdjacentHTML('afterend', `<li${lider ? ' class="sub"' : ''}><button type="button" aria-current="${!st.pagina && !!st.finVista}" data-nav="finalizadas">${SVG(VISTO).replace('fin-svg', `i fin-svg${lider ? '' : ' vr-ic'}`)}Finalizadas<span class="n">${n || ''}</span></button></li>`);
    }
    if (st.finVista && !st.pagina) {
      ul.querySelectorAll('[data-nav]:not([data-nav="finalizadas"])').forEach(b => b.setAttribute('aria-current', 'false'));
      // Pestañas Mías y Todas, con las cuentas de las finalizadas: sin asignar no aplica a lo que ya se finalizó.
      const conVista = v => { const g = st.vista; st.vista = v; const n = visibles().length; st.vista = g; return n; };
      document.getElementById('tabs').innerHTML = [['mias', 'Mías'], ['todas', 'Todas']].map(([k, n]) => `<button type="button" data-v="${k}" aria-pressed="${st.vista === k}">${n}<span class="n">${conVista(k)}</span></button>`).join('');
    }
  };
  const irABase = irA;
  irA = function(k){
    if (k === 'finalizadas') {
      st.pagina = ''; st.menciones = false; st.dif = null; st.tplNueva = null;
      st.carpeta = st.equipo = st.etq = st.linea = st.canal = st.tag = '';
      st.finVista = true; st.est = 'finalizadas'; if (esLiderCrm()) st.vista = 'todas';
      document.getElementById('est-l').textContent = 'Finalizadas';
      const pr = visibles()[0]; st.sel = pr ? pr.id : st.sel;
      render(); return;
    }
    if (st.finVista && ['inbox', 'todas', 'sin', 'menciones'].includes(k)) { st.finVista = false; st.est = 'abiertas'; document.getElementById('est-l').textContent = 'Abiertas'; }
    return irABase.apply(this, arguments);
  };
  // Cualquier otro camino que cambie el estado de la lista (el desplegable, abrir un contacto) sale de Finalizadas.
  const renderBase = render;
  render = function(){
    if (st.finVista && st.est !== 'finalizadas') st.finVista = false;
    if (st.finVista && st.vista === 'sin') st.vista = 'todas';
    return renderBase.apply(this, arguments);
  };

  /* ── Lista: título y tarjetas de las finalizadas ── */
  const BOG = new Intl.DateTimeFormat('en-CA', {timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'});
  const MESES = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.'];
  const partes = d => Object.fromEntries(BOG.formatToParts(d).map(p => [p.type, p.value]));
  function cuandoFin(iso){
    const d = iso ? new Date(iso) : null; if (!d || isNaN(d)) return '';
    const p = partes(d), hoy = partes(new Date()), ayer = partes(new Date(Date.now() - 86_400_000));
    const h = +p.hour, hora = `${((h + 11) % 12) + 1}:${p.minute} ${h < 12 ? 'a. m.' : 'p. m.'}`;
    const dia = p.year + p.month + p.day;
    const fecha = dia === hoy.year + hoy.month + hoy.day ? 'hoy' : dia === ayer.year + ayer.month + ayer.day ? 'ayer' : `${+p.day} ${MESES[+p.month - 1]}${p.year !== hoy.year ? ' ' + p.year : ''}`;
    return `${fecha}, ${hora}`;
  }
  const listaBase = lista;
  lista = function(){
    listaBase.apply(this, arguments);
    if (st.finVista && !st.menciones) {
      document.getElementById('lt').textContent = 'Finalizadas';
      const b = document.getElementById('b-est'); if (b) b.hidden = true;
      const vacio = document.querySelector('#items .nothing > span');
      if (vacio && /activas en esta vista/.test(vacio.textContent)) vacio.textContent = 'Todavía no hay conversaciones finalizadas en esta vista.';
    } else { const b = document.getElementById('b-est'); if (b) b.hidden = false; }
    document.querySelectorAll('#items .it[data-c]').forEach(card => {
      const c = CONV.find(x => x.id === +card.dataset.c);
      if (!c || c.est !== 'finalizadas') return;
      // Línea 3: equipo · etapa (en vez del asesor y la espera).
      const l3 = card.querySelector('.tj-l3'), et = (c.etq || [])[0];
      if (l3) {
        const eq = l3.querySelector('.tj-eq');
        l3.innerHTML = (eq ? eq.outerHTML : '') + (et ? `<span class="tj-pt">·</span><span class="tj-et"><i style="background:${colorOk(COL[et])}"></i><span>${esc(et)}</span></span>` : '');
      }
      // Línea 4: cuándo y quién la finalizó.
      const cuando = cuandoFin(c._t && c._t.finalizada), quien = typeof c.finPor === 'string' ? c.finPor.trim() : '';
      const l4 = card.querySelector('.tj-l4'); if (l4) l4.remove();
      if (cuando) card.querySelector('.tj-cu').insertAdjacentHTML('beforeend', `<span class="tj-fin">${SVG(VISTO)}<span>Finalizada ${esc(cuando)}${quien ? ` por ${esc(quien)}` : ''}</span></span>`);
    });
  };

  /* ── Chat: «Pasó a ● Conversación cerrada al finalizar» ── */
  const chSueltoBase = chSuelto;
  chSuelto = function(m){
    if (m && m.ev && 'etapaFin' in m) {
      const et = m.etapaFin, punto = et ? `<i style="background:${colorOk(COL[et])}"></i><b>${esc(et)}</b>` : '';
      const texto = m.alFinalizar ? (et ? `Pasó a ${punto} al finalizar` : 'Quedó sin etapa al finalizar') : (et ? `Volvió a ${punto}, la etapa que tenía al finalizar` : esc(m.t || ''));
      return `<div class="fin-ev">${texto}</div>`;
    }
    return chSueltoBase.apply(this, arguments);
  };
})();
