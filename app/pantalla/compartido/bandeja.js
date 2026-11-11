/* ── Bandeja compartida: lo que es igual en la bandeja del CRM (crm.html) y en Soporte del superadmin (admin.html) ──
   Un solo código para las dos pantallas (regla del 11-nov: «son lo mismo, deja de crear dos por separado»).
   src/paginas.ts lo pone antes de los scripts del CRM y lo mete en admin.html en el marcador BANDEJA_COMPARTIDA (un comentario de bloque).
   Cada pantalla solo le pone las clases wb-* a su DOM:
   · wb-ficha            la columna de la ficha de la derecha
   · wb-ficha-oculta     en el contenedor de la grilla, cuando la ficha está oculta (solo computador, > 1360 px)
   · wb-ocultar          el botón dentro del título de la ficha (WB.botonOcultar)
   · wb-mostrar          el botón en la cabecera del chat, visible solo con la ficha oculta (WB.botonMostrar)
   Barra lateral plegable (maqueta del 11-nov): la barra lleva wb-barra; plegada, wb-plegada. Adentro: wb-marca (logo y
   botón), wb-logo, wb-txt (lo que se apaga), data-wb-t (el nombre que sale en el globito) y WB.botonPlegar().
   Medidas (11-nov): las del CRM. Lista 357 px visibles (317 entre 1001 y 1360 px, 320 en tablet) y ficha 297 px. ── */
(() => {
  if (window.WB) return;
  const IOS = 'cubic-bezier(.32,.72,0,1)', SALIDA = 'cubic-bezier(.23,1,.32,1)';
  const css = `
/* Medidas visibles de la lista y de la ficha (las del CRM, 11-nov). El CRM le suma 23 px de márgenes a cada columna. */
:root{--wb-lista:357px;--wb-ficha:297px}
@media (max-width:1360px){:root{--wb-lista:317px}}
@media (max-width:1000px){:root{--wb-lista:320px}}
@media (min-width:1361px){
  /* La ficha se cierra como un cajón hacia la derecha y el chat gana el espacio (la grilla anima solo mientras dura) */
  .wb-anima{transition:grid-template-columns 420ms ${IOS},column-gap 420ms ${IOS}}
  .wb-ficha{overflow-x:hidden;transition:opacity 240ms ${SALIDA},transform 420ms ${IOS},filter 240ms ${SALIDA},margin 420ms ${IOS},visibility 0s}
  .wb-ficha > *{min-width:295px}
  .wb-ficha-oculta .wb-ficha{opacity:0;transform:translateX(28px);filter:blur(3px);pointer-events:none;visibility:hidden;
    transition:opacity 180ms ${SALIDA},transform 420ms ${IOS},filter 180ms ${SALIDA},margin 420ms ${IOS},visibility 0s 420ms}
  .wb-ficha-oculta .wb-mostrar{display:inline-flex;animation:wb-entra 280ms ${SALIDA} 140ms both}
}
@keyframes wb-entra{from{opacity:0;transform:scale(.9)}}
/* Barra lateral plegable: queda una franja de íconos; los nombres se apagan y salen en un globito al pasar el mouse.
   Plegada, el botón para abrirla queda siempre visible debajo del logo, con la flecha hacia afuera (11-nov: escondido
   detrás del logo confundía). Solo en computador (> 1000 px). */
button.wb-plegar{margin-left:auto;width:32px;height:32px;border-radius:9px;display:grid;place-items:center;color:#8b8d97;flex:none;border:0;background:none;padding:0;cursor:pointer;
  transition:background 160ms ${SALIDA},color 160ms ${SALIDA},transform 140ms ${SALIDA},opacity 200ms ${SALIDA}}
button.wb-plegar:hover{background:#1b1b22;color:#fff}button.wb-plegar:active{transform:scale(.92)}
.wb-plegar svg{width:18px;height:18px}.wb-plegar .fl{transition:transform 380ms ${IOS};transform-origin:14.5px 12px}
@media (min-width:1001px){
  .wb-barra{transition:width 380ms ${IOS},padding 380ms ${IOS}}
  .wb-barra .wb-txt{transition:opacity 200ms ${SALIDA} 120ms}
  .wb-barra .wb-logo{transition:opacity 200ms ${SALIDA}}
  .wb-barra.wb-plegada{overflow-x:hidden}
  .wb-barra.wb-plegada .wb-txt{opacity:0;pointer-events:none;transition:opacity 120ms ${SALIDA}}
  .wb-barra.wb-plegada .wb-marca{flex-direction:column;align-items:flex-start;gap:10px}
  .wb-barra.wb-plegada .wb-plegar{margin:0;width:34px;height:34px;background:#1b1b22;color:#fff}
  .wb-barra.wb-plegada .wb-plegar .fl{transform:rotate(180deg)}
}
@media (max-width:1000px){button.wb-plegar{display:none!important}}
/* El nombre de cada ícono con la barra plegada: va en el body, encima de todo, para que el scroll de la barra no lo recorte */
.wb-globo{position:fixed;z-index:400;left:0;top:0;white-space:nowrap;background:#0b0b10;color:#fff;font:500 12.5px/1.2 Inter,system-ui,sans-serif;padding:6px 10px;border-radius:8px;
  box-shadow:0 8px 24px -8px rgba(0,0,0,.45);opacity:0;pointer-events:none;transform:translate(-4px,-50%);transition:opacity 140ms ${SALIDA},transform 140ms ${SALIDA}}
.wb-globo.ver{opacity:1;transform:translate(0,-50%)}
@media (prefers-reduced-motion:reduce){.wb-globo{transition:opacity 120ms linear;transform:translate(0,-50%)}}
button.wb-ocultar{margin-left:auto;width:30px;height:30px;border-radius:8px;display:grid;place-items:center;color:#4b5563;flex:none;border:0;background:none;padding:0;cursor:pointer;
  transition:background 160ms ${SALIDA},color 160ms ${SALIDA},transform 140ms ${SALIDA}}
button.wb-ocultar:hover{background:#f3f6fa;color:#0b0b10}button.wb-ocultar:active{transform:scale(.92)}
.wb-ocultar svg{width:17px;height:17px}.wb-ocultar .pr{fill:currentColor}
.wb-mostrar{display:none}.wb-mostrar .pr{fill:none}
@media (max-width:1360px){button.wb-ocultar,.wb-mostrar{display:none!important}}
@media (prefers-reduced-motion:reduce){
  .wb-anima{transition:none}
  .wb-ficha,.wb-ficha-oculta .wb-ficha{transition:opacity 160ms linear,visibility 0s!important;transform:none!important;filter:none!important}
  .wb-ficha-oculta .wb-mostrar{animation:none}
  .wb-barra,.wb-barra .wb-txt,.wb-plegar .fl{transition:none!important}
}`;
  document.head.insertAdjacentHTML('beforeend', '<style id="wb-css">' + css + '</style>');

  // El globito con el nombre: uno solo en el body; sale al pasar el mouse (o con el teclado) por un ícono de la barra plegada.
  const globo = document.createElement('div'); globo.className = 'wb-globo'; globo.setAttribute('role', 'tooltip'); document.body.appendChild(globo);
  const blanco = e => (e.target instanceof Element ? e.target.closest('.wb-plegada [data-wb-t]') : null);
  const ver = t => { globo.textContent = t.getAttribute('data-wb-t'); const r = t.getBoundingClientRect(); globo.style.left = (r.right + 12) + 'px'; globo.style.top = (r.top + r.height / 2) + 'px'; globo.classList.add('ver'); };
  const quitar = () => globo.classList.remove('ver');
  document.addEventListener('mouseover', e => { const t = blanco(e); if (t) ver(t); else quitar(); });
  document.addEventListener('focusin', e => { const t = blanco(e); if (t && t.matches(':focus-visible')) ver(t); else quitar(); });
  document.addEventListener('focusout', quitar);
  document.addEventListener('scroll', quitar, true);
  document.addEventListener('mousedown', quitar);

  // El panel a la derecha: con la columna rellena es «ocultar», con la columna vacía es «mostrar».
  const PANEL = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path class="pr" d="M15 4h2a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-2Z"/><path d="M15 4v16"/></svg>';
  // Panel a la izquierda con la flecha (se gira cuando la barra está plegada).
  const BARRA = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="15" rx="3"/><path d="M9.5 4.5v15"/><path class="fl" d="m15.5 10-2 2 2 2"/></svg>';
  const CLAVE = 'wali-ficha-oculta', CLAVE_BARRA = 'wali-barra-plegada';
  const leer = () => { try { return localStorage.getItem(CLAVE) === '1'; } catch (e) { return false; } };
  const guardar = (v, k = CLAVE) => { try { localStorage.setItem(k, v ? '1' : '0'); } catch (e) { /* sin almacenamiento: solo por esta vez */ } };

  window.WB = {
    PANEL,
    /** ¿La persona dejó la ficha oculta la última vez? Vale para el CRM y para Soporte. */
    fichaOculta: leer,
    /** Oculta o muestra la ficha con su animación. `contenedor` es la grilla que tiene la columna de la ficha. */
    ocultarFicha(contenedor, oculta, recordar = true) {
      if (!contenedor) return;
      contenedor.classList.add('wb-anima');
      clearTimeout(contenedor._wbT);
      contenedor._wbT = setTimeout(() => contenedor.classList.remove('wb-anima'), 460);
      contenedor.classList.toggle('wb-ficha-oculta', !!oculta);
      if (recordar) guardar(!!oculta);
    },
    botonOcultar: (attrs = '') => `<button type="button" class="wb-ocultar" ${attrs} aria-label="Ocultar la ficha" title="Ocultar la ficha">${PANEL}</button>`,
    /** ¿La persona dejó la barra lateral plegada? Vale para el CRM y para el superadmin. */
    barraPlegada: () => { try { return localStorage.getItem(CLAVE_BARRA) === '1'; } catch (e) { return false; } },
    /** Pliega o despliega la barra lateral (`barra` lleva wb-barra) y actualiza su botón. */
    plegarBarra(barra, plegada, recordar = true) {
      if (!barra) return;
      barra.classList.toggle('wb-plegada', !!plegada);
      const b = barra.querySelector('.wb-plegar'), tx = plegada ? 'Mostrar el menú' : 'Ocultar el menú';
      if (b) { b.setAttribute('aria-label', tx); b.title = tx; b.setAttribute('aria-expanded', String(!plegada)); }
      if (recordar) guardar(!!plegada, CLAVE_BARRA);
    },
    botonPlegar: (attrs = '') => `<button type="button" class="wb-plegar" ${attrs} aria-label="Ocultar el menú" title="Ocultar el menú" aria-expanded="true">${BARRA}</button>`,
    botonMostrar: (attrs = '', clase = '') => `<button type="button" class="wb-mostrar ${clase}" ${attrs} aria-label="Mostrar la ficha" title="Mostrar la ficha">${PANEL}</button>`,
  };
})();
