/* Sitio de Wali (maqueta aprobada el 23-nov): menú a la izquierda, selector de idioma y aviso de cookies.
   - Idioma: español, inglés, francés, portugués y alemán. La primera vez se toma el del navegador; si la persona elige
     otro, se guarda en este equipo. Los textos vienen de /i18n/<idioma>.json (la llave es el texto en español) y se
     traducen también los que cambian solos (el chat de muestra, las calculadoras y los avisos del formulario).
   - Cookies: «Rechazar» y «Aceptar todas» pesan igual. Las necesarias (sesión, idioma y seguridad) van siempre. La
     medición (Vercel Web Analytics, sin cookies ni datos personales) solo se carga si la persona la acepta.
   Los botones del menú y del idioma vienen en el HTML de cada página; aquí se arman el cajón, la lista de idiomas y el
   aviso. */
(() => {
  const IDIOMAS = [['es', 'Español', 'co'], ['en', 'English', 'us'], ['fr', 'Français', 'fr'], ['pt', 'Português', 'br'], ['de', 'Deutsch', 'de']];
  const CODIGOS = IDIOMAS.map(i => i[0]);
  const ATRIBUTOS = ['placeholder', 'aria-label', 'title', 'alt'];
  const guardado = k => { try { return localStorage.getItem(k); } catch { return null; } };
  const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento: vale para esta visita */ } };

  // ── Idioma ─────────────────────────────────────────────────────────────────────────────────────────────────────
  const delNavegador = () => { for (const l of navigator.languages || [navigator.language || 'es']) { const c = String(l).slice(0, 2).toLowerCase(); if (CODIGOS.includes(c)) return c; } return 'es'; };
  let LANG = CODIGOS.includes(guardado('wali-idioma')) ? guardado('wali-idioma') : delNavegador();
  let DIC = { t: {}, p: [] };
  const cache = {};
  const original = new WeakMap(), puesto = new WeakMap(), origAttr = new WeakMap(), puestoAttr = new WeakMap();
  const tituloEs = document.title, meta = document.querySelector('meta[name="description"]'), metaEs = meta ? meta.content : '';
  const saltar = e => !e || !!e.closest('script,style,noscript,[data-sin-traducir],.idi-n,#pt-paises');

  function traducirTexto(s) {
    const k = s.trim(); if (!k) return null;
    let t = DIC.t[k];
    if (t == null) for (const [re, rep] of DIC.p) { if (re.test(k)) { t = k.replace(re, rep); break; } }
    return t == null ? null : s.replace(k, t);
  }
  function nodo(n) {
    if (saltar(n.parentElement)) return;
    const v = n.nodeValue;
    if (puesto.get(n) !== v) original.set(n, v);
    const o = original.get(n), nv = LANG === 'es' ? o : (traducirTexto(o) ?? o);
    puesto.set(n, nv);
    if (nv !== v) n.nodeValue = nv;
  }
  function atributos(e) {
    if (saltar(e)) return;
    let o = origAttr.get(e), p = puestoAttr.get(e);
    if (!o) { o = {}; p = {}; origAttr.set(e, o); puestoAttr.set(e, p); }
    for (const a of ATRIBUTOS) {
      if (!e.hasAttribute(a)) continue;
      const v = e.getAttribute(a);
      if (p[a] !== v) o[a] = v;
      const nv = LANG === 'es' ? o[a] : (traducirTexto(o[a]) ?? o[a]);
      p[a] = nv;
      if (nv !== v) e.setAttribute(a, nv);
    }
  }
  function recorrer(raiz) {
    if (raiz.nodeType === 3) { nodo(raiz); return; }
    if (raiz.nodeType !== 1) return;
    atributos(raiz);
    const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n; while ((n = w.nextNode())) { if (n.nodeType === 3) nodo(n); else atributos(n); }
  }
  function aplicar() {
    recorrer(document.body);
    document.title = LANG === 'es' ? tituloEs : (DIC.t[tituloEs] || tituloEs);
    if (meta) meta.content = LANG === 'es' ? metaEs : (DIC.t[metaEs] || metaEs);
    document.documentElement.lang = LANG;
    const cod = document.getElementById('idi-cod'); if (cod) cod.textContent = LANG.toUpperCase();
    document.querySelectorAll('#idi-m [data-lang]').forEach(x => x.setAttribute('aria-checked', String(x.dataset.lang === LANG)));
  }
  async function diccionario(l) {
    if (l === 'es') return { t: {}, p: [] };
    if (!cache[l]) cache[l] = fetch('/i18n/' + l + '.json', { cache: 'force-cache' }).then(r => r.json()).then(j => ({ t: j.t || {}, p: (j.p || []).map(([re, rep]) => [new RegExp(re), rep]) }));
    return cache[l];
  }
  async function cambiarIdioma(l) {
    try { DIC = await diccionario(l); LANG = l; } catch { DIC = { t: {}, p: [] }; LANG = 'es'; }
    aplicar();
  }
  // Los textos que la página cambia sola (chat, calculadoras, avisos) se traducen al aparecer.
  new MutationObserver(rs => {
    if (LANG === 'es') return;
    for (const r of rs) {
      if (r.type === 'characterData') nodo(r.target);
      else if (r.type === 'attributes') atributos(r.target);
      else r.addedNodes.forEach(recorrer);
    }
  }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATRIBUTOS });

  // ── Íconos ─────────────────────────────────────────────────────────────────────────────────────────────────────
  const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const CHULO = svg('<path d="m5 12 5 5L20 7"/>');
  // Ícono «cookie» de Lucide (lucide-react 1.17.0, licencia ISC), tal cual.
  const GALLETA = svg('<path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M8.5 8.5v.01"/><path d="M16 15.5v.01"/><path d="M12 12v.01"/><path d="M11 17v.01"/><path d="M7 14v.01"/>');
  const bandera = c => `<span class="fl"><img src="https://flagcdn.com/w40/${c}.png" srcset="https://flagcdn.com/w80/${c}.png 2x" alt="" width="26" height="19"></span>`;

  // ── Lista de idiomas, cajón del menú y aviso de cookies ───────────────────────────────────────────────────────
  document.body.insertAdjacentHTML('beforeend', `<div class="idi-m" id="idi-m" role="menu" aria-label="Idioma" hidden>${IDIOMAS.map(([k, n, c]) => `<button type="button" role="menuitemradio" aria-checked="${k === LANG}" data-lang="${k}">${bandera(c)}<span class="idi-n" lang="${k}">${n}</span><span class="ok">${CHULO}</span></button>`).join('')}</div>`);
  const enlaces = [...document.querySelectorAll('.barra .pild a')].map(a => `<a href="${a.getAttribute('href')}"${a.classList.contains('on') ? ' class="on" aria-current="page"' : ''}>${a.querySelector('svg') ? a.querySelector('svg').outerHTML : ''}<span>${a.textContent.trim()}</span></a>`).join('');
  const logo = document.querySelector('.barra .logo');
  document.body.insertAdjacentHTML('beforeend', `<div class="nav-o" id="nav-o" hidden></div><nav class="nav-m" id="nav-m" aria-label="Principal" hidden><div class="nav-cab">${logo ? logo.outerHTML : ''}<button type="button" class="nav-x" id="nav-x" aria-label="Cerrar menú"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div><div class="nav-l">${enlaces}</div><a class="btn pri nav-cta" href="/crm/entrar?registro=1">Probar 10 días gratis</a></nav>`);
  document.querySelectorAll('#nav-m .nav-l a').forEach((a, j) => a.style.setProperty('--i', j));
  document.body.insertAdjacentHTML('beforeend', `<section class="ck" id="ck" role="dialog" aria-labelledby="ck-t" hidden>
    <div class="ck-cab"><span class="ck-ic">${GALLETA}</span><h2 id="ck-t">Cookies en Wali</h2></div>
    <p class="ck-tx"><span>Usamos las necesarias para que el sitio y tu ingreso funcionen. Si nos dejas, también medimos las visitas sin datos personales para mejorar Wali.</span> <a href="/cookies">Política de cookies</a></p>
    <div class="ck-op"><div class="ck-in">
      <div class="ck-f"><span><b>Necesarias</b><small>Sesión, idioma y seguridad. Siempre activas.</small></span><span class="ck-sw on fijo" aria-hidden="true"><i></i></span></div>
      <label class="ck-f"><span><b>Medición</b><small>Visitas y páginas más vistas, sin datos personales.</small></span><input type="checkbox" id="ck-med" class="ck-chk"><span class="ck-sw"><i></i></span></label>
    </div></div>
    <div class="ck-acc"><button type="button" class="ck-el" data-ck="elegir">Elegir</button><button type="button" class="btn pri" data-ck="rechazar">Rechazar</button><button type="button" class="btn pri" data-ck="todas">Aceptar todas</button></div>
    <div class="ck-acc ck-acc2"><button type="button" class="btn pri" data-ck="guardar">Guardar mi elección</button></div>
  </section>`);

  // ── Cookies ────────────────────────────────────────────────────────────────────────────────────────────────────
  const ck = document.getElementById('ck'), med = document.getElementById('ck-med');
  let eleccion = null;
  try { eleccion = JSON.parse(guardado('wali-cookies') || 'null'); } catch { eleccion = null; }
  function medir() {
    if (window.va || document.getElementById('va-script')) return;
    window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
    const s = document.createElement('script'); s.id = 'va-script'; s.defer = true; s.src = '/_vercel/insights/script.js';
    document.head.appendChild(s);
  }
  function abrirAviso() {
    med.checked = !!(eleccion && eleccion.medicion);
    ck.classList.remove('sale', 'abierto'); ck.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => ck.classList.add('ve')));
  }
  function decidir(medicion) {
    eleccion = { medicion, fecha: new Date().toISOString(), version: 1 };
    guardar('wali-cookies', JSON.stringify(eleccion));
    if (medicion) medir();
    ck.classList.remove('ve'); ck.classList.add('sale');
    setTimeout(() => { ck.hidden = true; ck.classList.remove('sale', 'abierto'); }, 320);
  }
  if (eleccion) { if (eleccion.medicion) medir(); } else abrirAviso();

  // ── Clics ──────────────────────────────────────────────────────────────────────────────────────────────────────
  const menu = document.getElementById('idi-m'), bIdioma = document.getElementById('idi-b');
  const nv = document.getElementById('nav-m'), nb = document.getElementById('nav-b'), no = document.getElementById('nav-o');
  const cerrarIdiomas = () => { menu.hidden = true; if (bIdioma) bIdioma.setAttribute('aria-expanded', 'false'); };
  function ponerIdiomas() { const r = bIdioma.getBoundingClientRect(); menu.style.top = (r.bottom + 8) + 'px'; menu.style.left = Math.max(12, Math.min(innerWidth - 232, r.right - 220)) + 'px'; }
  function abrirMenu() { nv.hidden = false; no.hidden = false; if (nb) nb.setAttribute('aria-expanded', 'true'); cerrarIdiomas(); document.documentElement.style.overflow = 'hidden'; requestAnimationFrame(() => requestAnimationFrame(() => { nv.classList.add('ve'); no.classList.add('ve'); })); }
  function cerrarMenu() { nv.classList.remove('ve'); no.classList.remove('ve'); if (nb) nb.setAttribute('aria-expanded', 'false'); document.documentElement.style.overflow = ''; setTimeout(() => { nv.hidden = true; no.hidden = true; }, 340); }
  document.addEventListener('click', e => {
    const t = e.target instanceof Element ? e.target : null; if (!t) return;
    if (t.closest('#nav-b')) { abrirMenu(); return; }
    if (t.closest('#nav-x') || t.closest('#nav-o') || t.closest('#nav-m a')) { cerrarMenu(); if (!t.closest('#nav-m a')) return; }
    if (t.closest('#idi-b')) {
      const abrir = menu.hidden; menu.hidden = !abrir; bIdioma.setAttribute('aria-expanded', String(abrir));
      if (abrir) { ponerIdiomas(); menu.classList.remove('ve'); requestAnimationFrame(() => menu.classList.add('ve')); }
      return;
    }
    const l = t.closest('[data-lang]');
    if (l) {
      const nuevo = l.dataset.lang; cerrarIdiomas(); if (nuevo === LANG) return;
      guardar('wali-idioma', nuevo);
      document.body.classList.add('idi-cambia');
      Promise.all([cambiarIdioma(nuevo), new Promise(r => setTimeout(r, 170))]).then(() => document.body.classList.remove('idi-cambia'));
      return;
    }
    if (!t.closest('#idi-m') && !menu.hidden) cerrarIdiomas();
    if (t.closest('[data-ck-abrir]')) { e.preventDefault(); abrirAviso(); return; }
    const c = t.closest('[data-ck]'); if (!c) return;
    const k = c.dataset.ck;
    if (k === 'elegir') ck.classList.add('abierto');
    else if (k === 'rechazar') decidir(false);
    else if (k === 'todas') decidir(true);
    else if (k === 'guardar') decidir(med.checked);
  });
  document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (!nv.hidden) cerrarMenu(); if (!menu.hidden) cerrarIdiomas(); });
  addEventListener('resize', () => { if (!menu.hidden) ponerIdiomas(); });

  // Arranque: si el idioma no es español, la página espera a tener sus textos (máximo 1,5 s).
  if (LANG !== 'es') {
    document.documentElement.classList.add('idi-pend');
    const listo = () => document.documentElement.classList.remove('idi-pend');
    setTimeout(listo, 1500);
    cambiarIdioma(LANG).then(listo);
  } else aplicar();
  window.waliAbrirCookies = abrirAviso;
})();
