/* ── El CRM en varios idiomas (maqueta aprobada el 23-nov) ──
   Mis ajustes › Mi cuenta › Idioma: español, inglés, francés, portugués y alemán. Cada persona elige el suyo; se guarda en
   sus preferencias (PUT /crm/preferencias, clave «idioma») y la sigue en cualquier equipo. La primera vez se toma el del
   navegador (cuando termine la traducción; mientras tanto, español). Cambian los menús, botones y avisos; los mensajes con clientes (.m) y los nombres que pone la empresa
   (equipos, etapas, etiquetas, contactos) se quedan tal cual: el diccionario solo tiene textos de la interfaz.
   Los textos vienen de __BASE__/i18n/<idioma>.json (la llave es el texto en español) y se traducen también los que cambian
   solos (avisos, contadores). Se traduce por tandas: lo que aún no está en el diccionario se ve en español. ── */
(() => {
  const IDI = [['es', 'Español', 'co'], ['en', 'English', 'us'], ['fr', 'Français', 'fr'], ['pt', 'Português', 'br'], ['de', 'Deutsch', 'de']];
  const COD = IDI.map(i => i[0]);
  const NOMBRE = {
    es: ['Español', 'Inglés', 'Francés', 'Portugués', 'Alemán'], en: ['Spanish', 'English', 'French', 'Portuguese', 'German'],
    fr: ['Espagnol', 'Anglais', 'Français', 'Portugais', 'Allemand'], pt: ['Espanhol', 'Inglês', 'Francês', 'Português', 'Alemão'],
    de: ['Spanisch', 'Englisch', 'Französisch', 'Portugiesisch', 'Deutsch']};
  const ATR = ['placeholder', 'aria-label', 'title'];
  const leer = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const anotar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
  const delNavegador = () => { for (const l of navigator.languages || [navigator.language || 'es']) { const c = String(l).slice(0, 2).toLowerCase(); if (COD.includes(c)) return c; } return 'es'; };
  // Mientras llegan las preferencias del servidor se usa lo último que se vio en este equipo.
  // Mientras la traducción esté por tandas, el español es el de entrada; el del navegador se usará al terminarla.
  const AUTO = false;
  let LANG = COD.includes(leer('crm-idioma')) ? leer('crm-idioma') : AUTO ? delNavegador() : 'es';
  let DIC = {t: {}, p: []};
  const cache = {};
  const orig = new WeakMap(), puesto = new WeakMap(), origA = new WeakMap(), puestoA = new WeakMap();
  const saltar = e => !e || !!e.closest('script,style,textarea,[contenteditable="true"],.m,.idi-n,[data-sin-traducir]');
  // En los atributos (placeholder, aria-label, title) sí entran los campos de texto: su texto de ayuda es de la interfaz.
  const saltarA = e => !e || !!e.closest('script,style,.m,.idi-n,[data-sin-traducir]');

  function tr(s) {
    const k = s.trim(); if (!k) return null;
    let t = DIC.t[k];
    if (t == null) for (const [re, rep] of DIC.p) { if (re.test(k)) { t = k.replace(re, rep); break; } }
    return t == null ? null : s.replace(k, t);
  }
  function nodo(n) {
    if (saltar(n.parentElement)) return;
    const v = n.nodeValue;
    if (puesto.get(n) !== v) orig.set(n, v);
    const o = orig.get(n), nv = LANG === 'es' ? o : (tr(o) ?? o);
    puesto.set(n, nv); if (nv !== v) n.nodeValue = nv;
  }
  function atrs(e) {
    if (saltarA(e)) return;
    let o = origA.get(e), p = puestoA.get(e);
    if (!o) { o = {}; p = {}; origA.set(e, o); puestoA.set(e, p); }
    for (const a of ATR) {
      if (!e.hasAttribute(a)) continue;
      const v = e.getAttribute(a); if (p[a] !== v) o[a] = v;
      const nv = LANG === 'es' ? o[a] : (tr(o[a]) ?? o[a]);
      p[a] = nv; if (nv !== v) e.setAttribute(a, nv);
    }
  }
  function recorrer(r) {
    if (r.nodeType === 3) { nodo(r); return; }
    if (r.nodeType !== 1) return;
    atrs(r);
    const w = document.createTreeWalker(r, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT); let n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) nodo(n); else atrs(n); }
  }
  async function dic(l) {
    if (l === 'es') return {t: {}, p: []};
    if (!cache[l]) cache[l] = fetch('__BASE__/i18n/' + l + '.json', {cache: 'force-cache'}).then(r => { if (!r.ok) throw new Error('idioma'); return r.json(); })
      .then(j => ({t: j.t || {}, p: (j.p || []).map(([re, rep]) => [new RegExp(re), rep])}));
    return cache[l];
  }
  async function usar(l) {
    try { DIC = await dic(l); LANG = l; } catch (e) { DIC = {t: {}, p: []}; LANG = 'es'; console.warn('[CRM] idioma', e); }
    anotar('crm-idioma', LANG);
    recorrer(document.body);
    document.documentElement.lang = LANG;
  }
  new MutationObserver(rs => {
    if (LANG === 'es') return;
    for (const r of rs) {
      if (r.type === 'characterData') nodo(r.target);
      else if (r.type === 'attributes') atrs(r.target);
      else r.addedNodes.forEach(recorrer);
    }
  }).observe(document.body, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATR});

  // ── La sección «Idioma» en Mis ajustes ──
  const GLOBO = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9s-1.2 6.4-3.8 9c-2.6-2.6-3.8-5.6-3.8-9s1.2-6.4 3.8-9Z"/></svg>';
  const bandera = c => `<img src="https://flagcdn.com/w40/${c}.png" srcset="https://flagcdn.com/w80/${c}.png 2x" alt="" width="34" height="25">`;
  const nativo = () => IDI.find(x => x[0] === LANG)[1];
  function pintar() {
    if (st.pagina !== 'ajustes' || st.ajTab === 'crm') return;
    const pg = document.getElementById('page'); if (!pg) return;
    if (st.ajSec === 'idioma') {
      const nm = NOMBRE[LANG];
      pg.replaceChildren();
      pg.insertAdjacentHTML('beforeend', `<div class="ajw ancho idi-pg"><button type="button" class="volver" data-aj-ver="">${I('back')}Mis ajustes</button><h2>Idioma</h2><p class="sub">El idioma de los menús, botones y avisos del CRM. Solo cambia para ti.</p>
        <div class="idi-l" role="radiogroup" aria-label="Idioma">${IDI.map(([k, n, c], j) => `<button type="button" class="idi-o" role="radio" aria-checked="${k === LANG}" data-idioma="${k}"><span class="idi-c">${bandera(c)}</span><span class="idi-t"><b class="idi-n" lang="${k}">${n}</b><small class="idi-n">${nm[j]}</small></span><svg class="idi-r" viewBox="0 0 20 20" aria-hidden="true"><circle class="aro" cx="10" cy="10" r="8.25"/><circle class="pto" cx="10" cy="10" r="4"/></svg></button>`).join('')}</div>
        <div class="idi-nota">${GLOBO}<p><span>Los mensajes con tus clientes no se traducen, ni los nombres que pone la empresa (equipos, etapas y etiquetas).</span> <span>Algunas pantallas todavía están en español mientras terminamos de traducirlas.</span></p></div></div>`);
      return;
    }
    const g = pg.querySelector('.ajg section .grid3');
    if (g && !g.querySelector('[data-aj-ver="idioma"]')) g.insertAdjacentHTML('beforeend', `<button type="button" data-aj-ver="idioma">${GLOBO}<span><b>Idioma</b><small><span class="idi-n">${nativo()}</span> · <span>solo cambia para ti</span></small></span></button>`);
  }
  const r0 = render;
  render = function () {
    const v = r0.apply(this, arguments);
    try {
      // Las preferencias del servidor mandan: si traen otro idioma, se cambia.
      if (COD.includes(AJ.idioma) && AJ.idioma !== LANG) { usar(AJ.idioma); }
      pintar();
      if (LANG !== 'es') recorrer(document.getElementById('page') || document.body);
    } catch (e) { console.warn('[CRM] idioma', e); }
    return v;
  };
  document.addEventListener('click', e => {
    const b = e.target instanceof Element && e.target.closest('[data-idioma]'); if (!b) return;
    const nuevo = b.dataset.idioma; if (nuevo === LANG) return;
    document.querySelectorAll('[data-idioma]').forEach(x => x.setAttribute('aria-checked', String(x === b)));
    document.body.classList.add('idi-cambia');
    Promise.all([usar(nuevo), new Promise(r => setTimeout(r, 160))]).then(() => {
      AJ.idioma = LANG; render(); document.body.classList.remove('idi-cambia');
      const msg = DIC.t['Listo, el CRM quedó en Español'] || 'Listo, el CRM quedó en Español';
      toast(msg);
    });
  });
  document.head.insertAdjacentHTML('beforeend', `<style>
#page{transition:opacity .16s cubic-bezier(.23,1,.32,1),filter .16s}
body.idi-cambia #page{opacity:.35;filter:blur(1.5px)}
.idi-l{display:grid;gap:8px;max-width:560px;margin-top:6px}
.idi-o{display:flex;align-items:center;gap:14px;width:100%;text-align:left;padding:12px 14px;border:1px solid #e5e9f0;border-radius:14px;background:#fff;transition:border-color .16s cubic-bezier(.23,1,.32,1),box-shadow .16s cubic-bezier(.23,1,.32,1),transform .12s cubic-bezier(.23,1,.32,1)}
.idi-o:hover{border-color:#cfd5df}.idi-o:active{transform:scale(.985)}
.idi-o[aria-checked="true"]{border-color:#0b0b10;box-shadow:0 0 0 1px #0b0b10}
.idi-c{width:40px;height:40px;display:grid;place-items:center;flex:none}.idi-c img{width:34px;height:25px;border-radius:5px;object-fit:cover;box-shadow:0 0 0 1px rgba(11,11,16,.08)}
.idi-t{flex:1;min-width:0;display:grid;gap:1px}.idi-t b{font-size:14.5px;font-weight:600;color:#111827}.idi-t small{font-size:12.5px;color:var(--ink3)}
.idi-r{width:20px;height:20px;flex:none}.idi-r .aro{fill:#fff;stroke:#b6c0d0;stroke-width:1.5;transition:stroke .16s}.idi-r .pto{fill:#0b0b10;transform-box:fill-box;transform-origin:center;transform:scale(0);transition:transform .2s cubic-bezier(.23,1,.32,1)}
.idi-o[aria-checked="true"] .idi-r .aro{stroke:#0b0b10}.idi-o[aria-checked="true"] .idi-r .pto{transform:scale(1)}
.idi-nota{display:flex;gap:10px;align-items:flex-start;max-width:560px;margin-top:14px;padding:12px 14px;border-radius:12px;background:#f7f8fa;color:var(--ink2);font-size:12.5px;line-height:1.45}.idi-nota svg.i{width:16px;height:16px;flex:none;margin-top:1px;color:var(--ink3)}.idi-nota p{margin:0}
@media (prefers-reduced-motion:reduce){#page,.idi-o,.idi-r .pto{transition-duration:0s!important}}
</style>`);
  if (LANG !== 'es') usar(LANG); else document.documentElement.lang = 'es';
})();
