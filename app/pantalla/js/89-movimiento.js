/* ── Movimiento al borrar (pedido del 23-oct: «que todo se vea súper profesional») ──
   Cualquier cosa que se borre, elimine o quite en el CRM sale con movimiento, sin tocar cada pantalla:
   1. Un clic en un control de borrar (data-*del, data-*borrar, data-*quitar, «Eliminar»…) o un DELETE que sale bien
      deja la marca de que lo próximo que se pinte es un borrado.
   2. render() toma una foto de las filas (posición y contenido) antes de pintar. Lo que desapareció sale como un
      fantasma en su sitio: se tiñe de rojo un instante y se desvanece hacia la izquierda; lo que quedó abajo sube
      suave a su nuevo puesto (FLIP). Todo con transform y opacity, nada de layout.
   3. El aviso del borrado entra con una papelera que cierra la tapa.
   Con movimiento reducido no se anima nada. Lo usan también pantallas propias: crmConMovimiento(() => pintar()). */
(() => {
  const reducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ANIMA = typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';
  const SALIDA = 'cubic-bezier(.23,1,.32,1)', SUBIDA = 'cubic-bezier(.16,1,.3,1)';
  let marca = 0;
  const marcar = () => { marca = Date.now(); };
  const activa = () => marca && Date.now() - marca < 5000;

  // ¿El clic es en un control de borrar? Por sus data-* o por su texto. «Borrador» no cuenta.
  const CLAVE = /(del|borrar|borrarok|quitar|quitarok|quitarsel|eliminar|eliminarok)$/i;
  const TEXTO = /^(sí, )?(eliminar|borrar|quitar|desconectar)\b/i;
  document.addEventListener('click', e => {
    const b = e.target.closest('button, [role="button"], a'); if (!b || b.disabled) return;
    if (Object.keys(b.dataset).some(k => CLAVE.test(k)) || TEXTO.test((b.textContent || '').trim())) marcar();
  }, true);
  if (typeof crmApi === 'function') {
    const apiSin = crmApi;
    crmApi = function(metodo, ...resto){
      const p = apiSin.call(this, metodo, ...resto);
      if (String(metodo).toUpperCase() === 'DELETE' && p && typeof p.then === 'function') p.then(marcar, () => {});
      return p;
    };
  }

  /* ── La foto de las filas antes de pintar ── */
  const FILAS = 'tbody > tr, ul > li, ol > li, .ay-hi, .ch-fila, .rr-m, [class*="fila"], [class*="item"], [class*="card"], [class*="tarjeta"]';
  const ZONAS = ['#page', '#panel', '#ficha', '#lista', '#list', '.ay-cuerpo', '.dlg', '#ov-x'];
  const clave = el => `${el.tagName}|${el.className}|${(el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160)}`;
  function foto(){
    const filas = [], vistos = new Set();
    for (const z of ZONAS) for (const raiz of document.querySelectorAll(z)) {
      for (const el of raiz.querySelectorAll(FILAS)) {
        if (vistos.has(el) || filas.length > 500) continue;
        const r = el.getBoundingClientRect();
        if (r.height < 16 || r.height > 260 || r.width < 40 || r.bottom < 0 || r.top > innerHeight) continue;
        // Solo la fila más externa: lo de adentro se mueve con ella.
        if (el.parentElement && el.parentElement.closest(FILAS) && vistos.has(el.parentElement.closest(FILAS))) continue;
        vistos.add(el); filas.push({el, k: clave(el), r});
      }
    }
    return filas;
  }
  function animar(antes){
    if (!antes.length) return;
    const ahora = new Map();
    for (const z of ZONAS) for (const raiz of document.querySelectorAll(z)) for (const el of raiz.querySelectorAll(FILAS)) {
      const k = clave(el); if (!ahora.has(k)) ahora.set(k, []); ahora.get(k).push(el);
    }
    const usados = new Set(), salen = [];
    for (const a of antes) {
      const lista = ahora.get(a.k), el = lista && lista.find(x => !usados.has(x));
      if (!el) { if (document.contains(a.el) && a.el.isConnected) continue; salen.push(a); continue; }
      usados.add(el);
      const r = el.getBoundingClientRect(), dy = a.r.top - r.top, dx = a.r.left - r.left;
      if (Math.abs(dy) < 1 && Math.abs(dx) < 1) continue;
      if (Math.abs(dy) > 600) continue;
      el.animate([{transform: `translate(${dx}px, ${dy}px)`}, {transform: 'none'}], {duration: 380, delay: 90, easing: SUBIDA, fill: 'backwards'});
    }
    // Si «desaparece» media pantalla no es un borrado sino otra vista: no se anima.
    if (salen.length > 6) return;
    for (const a of salen) fantasma(a);
  }
  function fantasma({el, r}){
    const g = el.cloneNode(true);
    g.removeAttribute('id'); g.querySelectorAll('[id]').forEach(x => x.removeAttribute('id'));
    g.setAttribute('aria-hidden', 'true'); g.classList.add('mv-fantasma');
    const cs = getComputedStyle(el);
    Object.assign(g.style, {position: 'fixed', left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', margin: '0',
      boxSizing: 'border-box', pointerEvents: 'none', zIndex: '70', background: cs.backgroundColor === 'rgba(0, 0, 0, 0)' ? '#fff' : cs.backgroundColor, borderRadius: cs.borderRadius, display: cs.display === 'table-row' ? 'flex' : cs.display, alignItems: 'center', overflow: 'hidden'});
    document.body.appendChild(g);
    g.animate([
      {opacity: 1, transform: 'none', boxShadow: 'inset 0 0 0 999px rgba(254,226,226,0)'},
      {opacity: 1, transform: 'none', boxShadow: 'inset 0 0 0 999px rgba(254,226,226,.85)', offset: .25},
      {opacity: 0, transform: 'translateX(-18px) scale(.97)', boxShadow: 'inset 0 0 0 999px rgba(254,226,226,.85)'},
    ], {duration: 420, easing: SALIDA, fill: 'forwards'}).finished.then(() => g.remove(), () => g.remove());
  }

  /** Pinta con movimiento de borrado: lo usan pantallas que no pasan por render() (la ayuda, por ejemplo). */
  window.crmConMovimiento = fn => {
    marca = 0;
    if (reducido() || !ANIMA) return fn();
    let antes = []; try { antes = foto(); } catch (e) { /* sin foto, sin movimiento */ }
    const r = fn(); try { animar(antes); } catch (e) { /* nunca rompe */ } return r;
  };
  const renderSin = render;
  render = function(){
    if (!activa() || reducido() || !ANIMA) return renderSin.apply(this, arguments);
    marca = 0;
    let antes = []; try { antes = foto(); } catch (e) { /* sin foto, sin movimiento */ }
    const r = renderSin.apply(this, arguments);
    try { animar(antes); } catch (e) { /* el movimiento nunca rompe la pantalla */ }
    return r;
  };

  /* ── El aviso del borrado, con la papelera que cierra la tapa ── */
  const PAPELERA = '<svg class="mv-pap" viewBox="0 0 24 24" aria-hidden="true"><g class="tapa"><path d="M4 7h16"/><path d="M9 7V4h6v3"/></g><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M10 11v6M14 11v6"/></svg>';
  const BORRADO = /(borrad|eliminad|quitad|se borró|se quitó|desconectad)/i;
  const toastSin = toast;
  toast = function(t){
    const r = toastSin.apply(this, arguments);
    const el = document.getElementById('toast');
    if (el) {
      const es = BORRADO.test(String(t || ''));
      el.classList.toggle('mv-borrado', es);
      if (es) { el.insertAdjacentHTML('afterbegin', PAPELERA); if (!reducido() && ANIMA) el.animate([{transform: 'translate(-50%, 18px) scale(.96)', opacity: 0}, {transform: 'translate(-50%, 0) scale(1)', opacity: 1}], {duration: 420, easing: SUBIDA}); }
    }
    return r;
  };

  document.head.insertAdjacentHTML('beforeend', `<style>
.toast.mv-borrado{display:flex;align-items:center;gap:9px;padding-left:12px}
.mv-pap{width:17px;height:17px;flex:none;fill:none;stroke:#fca5a5;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round;overflow:visible}
.mv-pap .tapa{transform-box:fill-box;transform-origin:0% 100%;animation:mv-tapa .62s cubic-bezier(.16,1,.3,1) .08s both}
@keyframes mv-tapa{0%{transform:translateY(-3px) rotate(-28deg)}55%{transform:translateY(-1px) rotate(-8deg)}100%{transform:none}}
.mv-fantasma *{pointer-events:none}
@media (prefers-reduced-motion:reduce){.mv-pap .tapa{animation:none}}
</style>`);
})();
