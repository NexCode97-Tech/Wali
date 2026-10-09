/* ── Kit del celular (maqueta aprobada «Contactos Wali móvil», 9-oct) ──
   Las piezas que se repiten en las páginas del celular, para armar cada una sin empezar de cero:
   · mvHoja(html)            hoja que sube desde abajo sobre un velo (filtros, acciones del ⋯, listas para elegir).
   · mvOpciones({...})       hoja con una lista para elegir uno o varios (con buscador si son muchos).
   · mvElegirPais(iso, fn)   hoja de países: buscador, los más usados y todos de la A a la Z con bandera.
   · mvPantalla(html)        pantalla completa encima de la página (ficha, editar).
   · mvPresionLarga(sel, fn) mantener oprimido (para empezar a elegir varios); mvFueLarga() evita el clic que le sigue.
   · mvIc(nombre)            íconos que no están en el sprite (subir, bajar, copiar, filtros, atrás, lápiz, chulo, x).
   Reglas de diseño: botones de solo ícono, lo principal en amarillo, toda X en rojo, hojas en vez de menús flotantes,
   filas de 48 px o más. Las clases van con «mv-» y solo aplican con 760 px o menos (MV). */
const MV = window.matchMedia('(max-width:760px)');
const MV_P = {
  subir: 'M12 15V4m0 0L8 8m4-4 4 4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3',
  bajar: 'M12 4v11m0 0-4-4m4 4 4-4M5 15v3a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3',
  copiar: 'M9 9h11v11H9zM5 15V5a1 1 0 0 1 1-1h9',
  filtros: 'M4 7h16M7 12h10M10 17h4',
  atras: 'm15 5-7 7 7 7',
  lapiz: 'M4 20h4L19 9l-4-4L4 16z',
  ok: 'm5 12.5 4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6 6 18',
  mas: 'M12 5v14M5 12h14',
  orden: 'M7 4v16m0 0-3-3m3 3 3-3M17 20V4m0 0-3 3m3-3 3 3',
  gente: 'M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20c.8-3.4 3.5-5 6.5-5s5.7 1.6 6.5 5M16 4.5a3.5 3.5 0 0 1 0 7M18 15c1.8.6 3 2.3 3.5 5',
};
const mvIc = (n, cls = 'mv-i') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${MV_P[n] || ''}"/></svg>`;

/* ── Hojas desde abajo ── */
const MV_HOJAS = [];
function mvCerrarHojas(){ while (MV_HOJAS.length) MV_HOJAS[MV_HOJAS.length - 1](); }
function mvHoja(html, {clase = '', alCerrar = null, etiqueta = ''} = {}){
  mvCerrarHojas();
  const velo = document.createElement('div'); velo.className = 'mv-velo';
  const h = document.createElement('div'); h.className = ('mv-hoja ' + clase).trim();
  h.setAttribute('role', 'dialog'); h.setAttribute('aria-modal', 'true'); if (etiqueta) h.setAttribute('aria-label', etiqueta);
  h.insertAdjacentHTML('beforeend', html);
  document.body.append(velo, h);
  const cerrar = () => { const i = MV_HOJAS.indexOf(cerrar); if (i < 0) return; MV_HOJAS.splice(i, 1); velo.remove(); h.remove(); if (alCerrar) alCerrar(); };
  velo.addEventListener('click', cerrar);
  h.addEventListener('click', e => { if (e.target instanceof Element && e.target.closest('[data-mvh-cerrar]')) cerrar(); });
  MV_HOJAS.push(cerrar);
  // Repintar sin perder el scroll de la lista.
  const pintar = html2 => { const c = h.querySelector('.mv-hcuerpo'), y = c ? c.scrollTop : 0; h.replaceChildren(); h.insertAdjacentHTML('beforeend', html2); const c2 = h.querySelector('.mv-hcuerpo'); if (c2) c2.scrollTop = y; };
  return {el: h, cerrar, pintar};
}
const mvCabHoja = (titulo, extra = '') => `<div class="mv-hcab"><span class="mv-asa"></span><div class="mv-ht"><b>${esc(titulo)}</b>${extra}</div></div>`;

/* ── Lista para elegir uno o varios ── */
// opciones: [{v, t, pre (html antes: punto de color, bandera), n (número a la derecha)}]
function mvOpciones({titulo, opciones, actual = null, multiple = false, alElegir, buscar = opciones.length > 8, vacio = 'No hay opciones todavía.'}){
  let sel = multiple ? new Set(actual || []) : actual, q = '';
  const fila = o => { const on = multiple ? sel.has(o.v) : sel === o.v;
    return `<button type="button" class="mv-op${on ? ' on' : ''}" role="option" aria-selected="${on}" data-mv-op="${esc(o.v)}">${o.pre || ''}<span class="t">${esc(o.t)}</span>${o.n != null ? `<span class="n">${esc(String(o.n))}</span>` : ''}${on ? mvIc('ok', 'mv-i ok') : ''}</button>`; };
  const lista = () => { const L = q ? opciones.filter(o => norm(o.t).includes(norm(q))) : opciones;
    return L.length ? L.map(fila).join('') : `<p class="mv-nada">${esc(q ? 'No hay resultados con esa búsqueda.' : vacio)}</p>`; };
  const html = () => `${mvCabHoja(titulo, `<button type="button" class="mv-cerrar" data-mvh-cerrar aria-label="Cerrar">${mvIc('x')}</button>`)}
    ${buscar ? `<div class="mv-hbus"><label class="mv-bus">${I('search')}<input id="mv-op-q" type="search" placeholder="Buscar" autocomplete="off" value="${esc(q)}"></label></div>` : ''}
    <div class="mv-hcuerpo" role="listbox"${multiple ? ' aria-multiselectable="true"' : ''}>${lista()}</div>
    ${multiple ? `<div class="mv-hpie"><button type="button" class="mv-btn negro" data-mv-listo>Listo</button></div>` : ''}`;
  const h = mvHoja(html(), {clase: 'alta', etiqueta: titulo});
  h.el.addEventListener('input', e => { if (e.target.id !== 'mv-op-q') return; q = e.target.value; const c = h.el.querySelector('.mv-hcuerpo'); c.replaceChildren(); c.insertAdjacentHTML('beforeend', lista()); });
  h.el.addEventListener('click', e => {
    const t = e.target instanceof Element ? e.target : null; if (!t) return;
    if (t.closest('[data-mv-listo]')) { h.cerrar(); alElegir([...sel]); return; }
    const b = t.closest('[data-mv-op]'); if (!b) return;
    const o = opciones.find(x => String(x.v) === b.dataset.mvOp); if (!o) return;
    if (!multiple) { h.cerrar(); alElegir(o.v); return; }
    sel.has(o.v) ? sel.delete(o.v) : sel.add(o.v);
    const c = h.el.querySelector('.mv-hcuerpo'), y = c.scrollTop; c.replaceChildren(); c.insertAdjacentHTML('beforeend', lista()); c.scrollTop = y;
  });
  return h;
}

/* ── Países (el teléfono con su indicativo) ── */
const MV_PAISES_USADOS = ['CO', 'MX', 'US', 'ES', 'PE', 'EC'];
function mvElegirPais(isoActual, alElegir){
  let q = '';
  const fila = p => { const on = p.iso === isoActual;
    return `<button type="button" class="mv-op pais${on ? ' on' : ''}" role="option" aria-selected="${on}" data-mv-pais="${esc(p.iso)}">${banderaTel(p.iso)}<span class="t">${esc(p.nombre)}</span><span class="n">+${esc(p.indicativo)}</span>${on ? mvIc('ok', 'mv-i ok') : ''}</button>`; };
  const lista = () => {
    const nq = norm(q.trim()).replace(/^\+/, '');
    if (nq) { const r = PAISES_TEL.filter(p => norm(p.nombre).includes(nq) || p.indicativo.startsWith(nq)); return r.length ? r.map(fila).join('') : '<p class="mv-nada">No encontramos ese país ni ese código.</p>'; }
    const usados = MV_PAISES_USADOS.map(iso => PAISES_TEL.find(p => p.iso === iso)).filter(Boolean);
    let letra = '', out = usados.length ? `<h5 class="mv-hsec">Más usados</h5>${usados.map(fila).join('')}` : '';
    for (const p of [...PAISES_TEL].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))) {
      const l = norm(p.nombre)[0].toUpperCase(); if (l !== letra) { letra = l; out += `<h5 class="mv-hsec">${esc(l)}</h5>`; }
      out += fila(p);
    }
    return out;
  };
  const h = mvHoja(`${mvCabHoja('País del celular', `<button type="button" class="mv-cerrar" data-mvh-cerrar aria-label="Cerrar">${mvIc('x')}</button>`)}
    <div class="mv-hbus"><label class="mv-bus">${I('search')}<input id="mv-pais-q" type="search" placeholder="Buscar país o código" autocomplete="off"></label></div>
    <div class="mv-hcuerpo" role="listbox">${lista()}</div>`, {clase: 'alta', etiqueta: 'País del celular'});
  h.el.addEventListener('input', e => { if (e.target.id !== 'mv-pais-q') return; q = e.target.value; const c = h.el.querySelector('.mv-hcuerpo'); c.replaceChildren(); c.insertAdjacentHTML('beforeend', lista()); c.scrollTop = 0; });
  h.el.addEventListener('click', e => { const b = e.target instanceof Element && e.target.closest('[data-mv-pais]'); if (!b) return; const p = PAISES_TEL.find(x => x.iso === b.dataset.mvPais); h.cerrar(); if (p) alElegir(p); });
  return h;
}

/* ── Pantalla completa ── */
function mvPantalla(html, clase = ''){
  let p = document.getElementById('mv-pant');
  const y = p && p.dataset.clase === clase && p.querySelector('.mv-pcuerpo') ? p.querySelector('.mv-pcuerpo').scrollTop : 0;
  if (!p) { p = document.createElement('div'); p.id = 'mv-pant'; p.setAttribute('role', 'dialog'); p.setAttribute('aria-modal', 'true'); document.body.append(p); }
  p.className = ('mv-pant ' + clase).trim(); p.dataset.clase = clase;
  p.replaceChildren(); p.insertAdjacentHTML('beforeend', html);
  const c = p.querySelector('.mv-pcuerpo'); if (c) c.scrollTop = y;
  return p;
}
function mvCerrarPantalla(){ const p = document.getElementById('mv-pant'); if (p) p.remove(); }

/* ── Mantener oprimido ── */
const MV_LARGA = {hasta: 0};
const mvFueLarga = () => Date.now() < MV_LARGA.hasta;
function mvPresionLarga(selector, alPresionar, ms = 450){
  let t = null, x0 = 0, y0 = 0;
  const parar = () => { clearTimeout(t); t = null; };
  document.addEventListener('pointerdown', e => {
    if (!MV.matches || !(e.target instanceof Element)) return;
    const f = e.target.closest(selector); if (!f || e.target.closest('button:not(' + selector + '), a, input')) return;
    x0 = e.clientX; y0 = e.clientY; parar();
    t = setTimeout(() => { t = null; MV_LARGA.hasta = Date.now() + 700; if (navigator.vibrate) navigator.vibrate(15); alPresionar(f); }, ms);
  });
  document.addEventListener('pointermove', e => { if (t && Math.hypot(e.clientX - x0, e.clientY - y0) > 10) parar(); });
  ['pointerup', 'pointercancel', 'scroll'].forEach(ev => document.addEventListener(ev, parar, true));
  document.addEventListener('contextmenu', e => { if (MV.matches && e.target instanceof Element && e.target.closest(selector)) e.preventDefault(); });
}

document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (MV_HOJAS.length) { e.stopPropagation(); MV_HOJAS[MV_HOJAS.length - 1](); } }, true);
// Al pasar a escritorio no queda nada del celular encima.
const mvAlCambiar = () => { if (!MV.matches) { mvCerrarHojas(); mvCerrarPantalla(); } };
if (MV.addEventListener) MV.addEventListener('change', mvAlCambiar); else MV.addListener(mvAlCambiar);

document.head.insertAdjacentHTML('beforeend', `<style>
:root{--mv-tinta:#0b0b10;--mv-t2:#374151;--mv-t3:#6b7280;--mv-t4:#9ca3af;--mv-linea:#e5e9f0;--mv-linea2:#eef1f5;--mv-fondo:#f6f7f9;--mv-amarillo:#FFD21F;--mv-amarillo-s:#fffbe6;--mv-rojo:#dc2626;--mv-rojo-s:#fdecec}
/* La página usa todo el ancho del celular, sea cual sea: márgenes que crecen con la pantalla (12 a 20 px) en vez de
   los 28 px de escritorio. Vale para todas las páginas en celular. */
@media (max-width:760px){
  #app .page{padding:12px clamp(12px,3.5vw,20px) calc(20px + env(safe-area-inset-bottom,0px))}
}
.mv-i{width:18px;height:18px;flex:none;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
/* Fila de herramientas: buscador y botones de solo ícono. */
.mv-barra{display:flex;gap:clamp(4px,1.5vw,8px);align-items:center}
.mv-bus{display:flex;align-items:center;gap:8px;flex:1;min-width:96px;height:44px;padding:0 10px 0 12px;margin:0;border-radius:12px;border:1px solid var(--mv-linea);background:#fff;color:var(--mv-t4)}
.mv-bus:focus-within{border-color:var(--mv-tinta);box-shadow:0 0 0 3px rgba(255,210,31,.45)}
.mv-bus svg{width:16px;height:16px;flex:none}
.mv-bus input{flex:1;min-width:0;border:0!important;outline:none;background:none!important;box-shadow:none!important;padding:0!important;height:auto!important;font:inherit;font-size:15px;color:var(--mv-tinta)}
.mv-ic{position:relative;flex:none;width:clamp(38px,11.5vw,46px);height:44px;border-radius:12px;border:1px solid var(--mv-linea);background:#fff;display:grid;place-items:center;color:var(--mv-tinta);cursor:pointer;padding:0}
.mv-ic.on{border-color:var(--mv-tinta)}
.mv-ic.pri{background:var(--mv-amarillo);border-color:var(--mv-amarillo)}
.mv-ic.pri .mv-i{width:20px;height:20px;stroke-width:2.2}
.mv-cnt{position:absolute;top:-7px;right:-7px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;border:2px solid var(--mv-fondo);background:var(--mv-amarillo);color:var(--mv-tinta);font-size:11px;font-weight:700;line-height:18px;text-align:center;box-sizing:content-box}
/* Lista de tarjetas. */
.mv-caja{background:#fff;border:1px solid var(--mv-linea);border-radius:16px;overflow:hidden}
.mv-cbar{display:flex;align-items:center;gap:10px;min-height:42px;padding:0 14px;border-bottom:1px solid var(--mv-linea2);font-size:12.5px;color:var(--mv-t3)}
.mv-cbar button{border:0;background:none;padding:6px 0;font:inherit;font-weight:500;color:var(--mv-t2);cursor:pointer;display:inline-flex;align-items:center;gap:5px}
.mv-cbar .mv-ord{margin-left:auto}
.mv-cbar .mv-ord .mv-i{width:14px;height:14px}
.mv-fila{display:grid;grid-template-columns:40px minmax(0,1fr) 30px;gap:0 12px;align-items:center;padding:12px 6px 12px 14px;border-bottom:1px solid var(--mv-linea2);cursor:pointer;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}
.mv-fila:last-child{border-bottom:0}
.mv-fila:active{background:#fafbfc}
.mv-fila.on{background:#fffde6}
.mv-av{position:relative;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;color:#fff;font-size:13px;font-weight:600;flex:none}
.mv-fila.on .mv-av{background:var(--mv-tinta)!important;font-size:0}
.mv-fila.on .mv-av::after{content:"";position:absolute;left:15px;top:10px;width:7px;height:14px;border:solid var(--mv-amarillo);border-width:0 2.5px 2.5px 0;transform:rotate(45deg)}
.mv-dat{min-width:0}
.mv-l1{display:flex;align-items:baseline;gap:8px}
.mv-l1 b{flex:1;min-width:0;font-size:14.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mv-hora{flex:none;font-size:11.5px;color:var(--mv-t4);white-space:nowrap}
.mv-dat small{display:block;margin-top:1px;font-size:12.5px;color:var(--mv-t3);font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mv-met{display:flex;align-items:center;gap:8px;margin-top:7px;min-width:0;overflow:hidden}
.mv-pill{display:inline-flex;align-items:center;gap:5px;padding:2px 8px;border-radius:999px;background:#f4f5f7;font-size:11.5px;font-weight:500;white-space:nowrap;flex:none;color:var(--mv-tinta)}
.mv-pill i{width:7px;height:7px;border-radius:50%}
.mv-ase{display:inline-flex;align-items:center;gap:5px;font-size:11.5px;color:var(--mv-t2);white-space:nowrap;min-width:0;overflow:hidden;text-overflow:ellipsis}
.mv-ase .m{width:18px;height:18px;border-radius:50%;display:grid;place-items:center;color:#fff;font-size:8px;font-weight:600;flex:none}
.mv-ase.sin{color:var(--mv-t4)}
.mv-can{margin-left:auto;flex:none;display:grid}
.mv-can svg{width:15px;height:15px}
.mv-mas{width:30px;height:34px;border:0;background:none;border-radius:8px;display:grid;place-items:center;color:var(--mv-t3);cursor:pointer;padding:0}
.mv-mas svg{width:17px;height:17px}
.mv-vacio{padding:44px 20px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:6px}
.mv-vacio .ic{width:52px;height:52px;border-radius:50%;background:#f4f5f7;display:grid;place-items:center;color:var(--mv-t3);margin-bottom:6px}
.mv-vacio .ic .mv-i{width:22px;height:22px}
.mv-vacio b{font-size:15px}
.mv-vacio span{font-size:13.5px;color:var(--mv-t3);max-width:250px;line-height:1.45}
.mv-vacio .mv-btn{margin-top:10px}
/* Barra negra de la selección. */
.mv-flota{position:fixed;left:12px;right:12px;bottom:calc(16px + env(safe-area-inset-bottom,0px));z-index:45;display:flex;align-items:center;gap:6px;padding:8px;border-radius:14px;background:var(--mv-tinta);color:#fff;box-shadow:0 14px 30px rgba(0,0,0,.25)}
.mv-flota b{font-size:13px;padding:0 6px;white-space:nowrap}
.mv-flota button{flex:1;height:38px;border-radius:9px;border:1px solid #2b2b35;background:#15151c;color:#fff;display:grid;place-items:center;cursor:pointer;padding:0}
.mv-flota button svg{width:17px;height:17px}
.mv-flota button.x{color:#f87171}
/* Botones de texto. */
.mv-btn{height:46px;padding:0 18px;border-radius:12px;border:1px solid var(--mv-linea);background:#fff;font:inherit;font-size:15px;font-weight:600;color:var(--mv-tinta);display:inline-flex;align-items:center;justify-content:center;gap:8px;cursor:pointer}
.mv-btn.negro{width:100%;height:50px;border:0;background:var(--mv-tinta);color:#fff}
.mv-btn.pri{background:var(--mv-amarillo);border-color:var(--mv-amarillo)}
/* Hoja desde abajo. */
.mv-velo{position:fixed;inset:0;z-index:95;background:rgba(15,23,42,.35);animation:mv-aparece .2s ease-out}
.mv-hoja{position:fixed;left:0;right:0;bottom:0;z-index:96;max-height:88vh;max-height:88dvh;display:flex;flex-direction:column;background:#fff;border-radius:22px 22px 0 0;box-shadow:0 -10px 30px rgba(0,0,0,.18);padding-bottom:env(safe-area-inset-bottom,0px);animation:mv-sube .32s cubic-bezier(.22,1,.36,1);color:var(--mv-tinta)}
.mv-hoja.alta{height:82vh;height:82dvh}
.mv-hoja > *{flex:none}
@keyframes mv-sube{from{transform:translateY(100%)}}
@keyframes mv-aparece{from{opacity:0}}
@media (prefers-reduced-motion:reduce){.mv-hoja,.mv-velo{animation:none}}
.mv-hcab{padding:10px 18px 10px;display:flex;flex-direction:column;gap:12px}
.mv-asa{width:38px;height:5px;border-radius:3px;background:#d4d8e0;margin:0 auto}
.mv-ht{display:flex;align-items:center;gap:8px;min-height:34px}
.mv-ht > b{font-size:17px}
.mv-ht .mv-tag{font-size:12px;font-weight:600;background:var(--mv-amarillo);padding:2px 8px;border-radius:999px}
.mv-ht .mv-limpiar{margin-left:auto;border:0;background:none;font:inherit;font-size:13.5px;font-weight:500;color:var(--mv-t3);text-decoration:underline;cursor:pointer;padding:6px 0}
.mv-cerrar{margin-left:auto;width:34px;height:34px;border-radius:9px;border:0;background:var(--mv-rojo-s);color:var(--mv-rojo);display:grid;place-items:center;cursor:pointer;padding:0}
.mv-cerrar .mv-i{width:17px;height:17px;stroke-width:2.2}
.mv-hbus{padding:0 18px 10px}
.mv-hcuerpo{flex:1 1 auto!important;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:4px 10px 16px;border-top:1px solid var(--mv-linea2)}
.mv-hpie{padding:10px 18px 14px;border-top:1px solid var(--mv-linea2);background:#fff}
.mv-hsec{margin:14px 8px 6px;font-size:11.5px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--mv-t4)}
.mv-op{width:100%;display:flex;align-items:center;gap:12px;min-height:50px;padding:0 10px;border:0;border-radius:11px;background:none;font:inherit;font-size:15px;color:var(--mv-tinta);text-align:left;cursor:pointer}
.mv-op:active{background:var(--mv-fondo)}
.mv-op .t{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mv-op .n{flex:none;color:var(--mv-t3);font-size:14px;font-variant-numeric:tabular-nums}
.mv-op .ok{color:var(--mv-tinta);stroke-width:2.4}
.mv-op.on{background:var(--mv-amarillo-s);font-weight:600}
.mv-op i.dot{width:9px;height:9px;border-radius:50%;flex:none}
.mv-op .tel-f{width:28px;height:19px;border-radius:4px}
.mv-nada{margin:30px 0;text-align:center;color:var(--mv-t3);font-size:14px}
/* Acciones del ⋯. */
.mv-quien{display:flex;align-items:center;gap:12px}
.mv-quien .mv-av{width:42px;height:42px;font-size:14px}
.mv-quien b{display:block;font-size:16px}
.mv-quien small{display:block;margin-top:1px;font-size:13px;color:var(--mv-t3);font-variant-numeric:tabular-nums}
.mv-acc{display:flex;flex-direction:column;padding:6px 10px 16px;overflow-y:auto;border-top:1px solid var(--mv-linea2)}
.mv-acc button{display:flex;align-items:center;gap:14px;min-height:50px;padding:0 12px;border:0;border-radius:11px;background:none;font:inherit;font-size:15px;color:var(--mv-tinta);text-align:left;cursor:pointer}
.mv-acc button:active{background:var(--mv-fondo)}
.mv-acc button svg{width:19px;height:19px;color:var(--mv-t3)}
.mv-acc button.pel,.mv-acc button.pel svg{color:var(--mv-rojo)}
.mv-acc hr{border:0;border-top:1px solid var(--mv-linea2);margin:6px 12px;width:auto}
/* Desplegables dentro de una hoja. */
.mv-dds{display:flex;flex-direction:column;gap:12px;padding:12px 8px 4px}
.mv-lab{display:block;font-size:12px;font-weight:600;color:var(--mv-t3);margin:0 0 6px 2px}
.mv-campo{display:flex;align-items:center;min-height:46px;border-radius:11px;border:1px solid var(--mv-linea);background:#fff}
.mv-campo-b{flex:1;min-width:0;display:flex;align-items:center;gap:8px;min-height:44px;padding:0 12px 0 14px;border:0;background:none;font:inherit;font-size:15px;color:var(--mv-tinta);text-align:left;cursor:pointer}
.mv-campo-b .v{flex:1;min-width:0;display:flex;align-items:center;gap:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mv-campo-b .v.gris{color:var(--mv-t4)}
.mv-campo-b .n{color:var(--mv-t4);font-size:13px}
.mv-campo-b > svg{width:15px;height:15px;color:var(--mv-t4);transition:transform .2s}
.mv-campo i.dot{width:8px;height:8px;border-radius:50%;flex:none}
.mv-qx{width:34px;height:34px;margin-right:4px;border-radius:8px;border:0;background:none;color:var(--mv-rojo);display:grid;place-items:center;cursor:pointer;padding:0}
.mv-qx .mv-i{width:15px;height:15px;stroke-width:2.2}
.mv-dd.puesto .mv-campo{border-color:var(--mv-amarillo);background:var(--mv-amarillo-s)}
.mv-dd.abierto .mv-campo{border-color:var(--mv-tinta);box-shadow:0 0 0 3px rgba(11,11,16,.06)}
.mv-dd.abierto .mv-campo-b > svg{transform:rotate(180deg);color:var(--mv-tinta)}
.mv-dlist{margin-top:6px;border:1px solid var(--mv-linea);border-radius:11px;background:#fff;box-shadow:0 10px 24px rgba(15,23,42,.1);padding:4px;max-height:260px;overflow-y:auto}
.mv-dlist .mv-op{min-height:42px;font-size:14px}
/* Pantalla completa (ficha, editar). */
.mv-pant{position:fixed;inset:0;z-index:90;display:flex;flex-direction:column;background:var(--mv-fondo);color:var(--mv-tinta);padding-top:env(safe-area-inset-top,0px);animation:mv-entra .24s cubic-bezier(.22,1,.36,1)}
@keyframes mv-entra{from{transform:translateX(24px);opacity:0}}
@media (prefers-reduced-motion:reduce){.mv-pant{animation:none}}
.mv-ptop{flex:none;display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:52px;padding:0 10px}
.mv-ptop.linea{border-bottom:1px solid var(--mv-linea2);padding:0 14px;background:#fff}
.mv-ptop > b{font-size:16px}
.mv-pb{width:40px;height:40px;border:0;background:none;border-radius:10px;display:grid;place-items:center;color:var(--mv-tinta);cursor:pointer;padding:0}
.mv-pb .mv-i{width:21px;height:21px}
.mv-pb.rojo{width:38px;height:38px;background:var(--mv-rojo-s);color:var(--mv-rojo)}
.mv-pb.si{width:38px;height:38px;background:var(--mv-amarillo)}
.mv-pb.rojo .mv-i,.mv-pb.si .mv-i{width:19px;height:19px;stroke-width:2.2}
.mv-pcuerpo{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:6px 16px calc(28px + env(safe-area-inset-bottom,0px));display:flex;flex-direction:column;gap:18px}
.mv-pcuerpo > *{flex:none}
.mv-sec h4{margin:0 0 8px 4px;font-size:12px;font-weight:600;color:var(--mv-t3)}
.mv-filas{background:#fff;border:1px solid var(--mv-linea);border-radius:14px;overflow:hidden}
.mv-f{width:100%;display:flex;align-items:center;gap:10px;min-height:48px;padding:10px 12px 10px 14px;border:0;border-bottom:1px solid var(--mv-linea2);background:none;font:inherit;font-size:14px;color:var(--mv-tinta);text-align:left}
button.mv-f{cursor:pointer}
.mv-f:last-child{border-bottom:0}
.mv-f > span:first-child{flex:none;width:100px;font-size:13px;color:var(--mv-t3)}
.mv-f > b{flex:1;min-width:0;font-weight:500;display:flex;align-items:center;justify-content:flex-end;gap:6px;flex-wrap:wrap;text-align:right;overflow-wrap:anywhere}
.mv-f > b.gris{color:var(--mv-t4);font-weight:400}
.mv-f > svg{width:15px;height:15px;color:var(--mv-t4);transform:rotate(-90deg)}
.mv-tag2{display:inline-flex;align-items:center;gap:5px;padding:2px 8px;border-radius:7px;border:1px solid var(--mv-linea);font-size:12px;font-weight:500;white-space:nowrap}
.mv-tag2 i{width:7px;height:7px;border-radius:50%}
/* Formularios del celular. */
.mv-form{display:flex;flex-direction:column;gap:12px}
.mv-form h4{margin:0 0 -4px 2px;font-size:12px;font-weight:600;color:var(--mv-t3)}
.mv-c label,.mv-c .mv-lab2{display:block;font-size:12.5px;font-weight:500;color:var(--mv-t2);margin-bottom:6px}
.mv-in{display:flex;align-items:center;gap:8px;min-height:46px;border-radius:11px;border:1px solid var(--mv-linea);background:#fff;overflow:hidden}
.mv-in:focus-within{border-color:var(--mv-tinta);box-shadow:0 0 0 3px rgba(255,210,31,.45)}
.mv-in input{flex:1;min-width:0;height:44px!important;border:0!important;outline:none;background:none!important;box-shadow:none!important;padding:0 14px!important;font:inherit;font-size:15px!important;color:var(--mv-tinta)}
.mv-in .mv-campo-b{min-height:44px}
.mv-pais{flex:none;display:flex;align-items:center;gap:6px;align-self:stretch;padding:0 10px 0 12px;border:0;border-right:1px solid var(--mv-linea);background:none;font:inherit;font-size:15px;font-weight:500;color:var(--mv-tinta);cursor:pointer}
.mv-pais .tel-f{width:24px;height:16px}
.mv-pais > svg{width:13px;height:13px;color:var(--mv-t4)}
.mv-dos{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.mv-dos > *{min-width:0}
</style>`);
