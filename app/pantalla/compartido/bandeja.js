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
  /* La ficha se cierra como un cajón hacia la derecha y el chat gana el espacio */
  .wb-ficha{overflow-x:hidden;transition:opacity 240ms ${SALIDA},transform 420ms ${IOS},filter 240ms ${SALIDA},margin 420ms ${IOS},visibility 0s}
  .wb-ficha > *{min-width:295px}
  .wb-ficha-oculta .wb-ficha{opacity:0;transform:translateX(28px);filter:blur(3px);pointer-events:none;visibility:hidden;
    transition:opacity 180ms ${SALIDA},transform 420ms ${IOS},filter 180ms ${SALIDA},margin 420ms ${IOS},visibility 0s 420ms}
  .wb-ficha-oculta .wb-mostrar{display:inline-flex;animation:wb-entra 280ms ${SALIDA} 140ms both}
}
/* La grilla anima solo mientras dura el cambio (ficha o barra), así no se mueve con otras cosas */
.wb-anima{transition:grid-template-columns 420ms ${IOS},column-gap 420ms ${IOS}}
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
/* Tablet (760 a 1360 px, maqueta «Ficha en el iPad» opción A, aprobada el 11-nov): tocar el nombre abre la ficha como
   un cajón de arriba abajo, pegado al borde derecho del contenedor (que va con position:relative), sobre un velo. El
   contenido entra escalonado. La X roja (WB.botonCerrarCajon) o tocar el velo la cierran. */
.wb-velo,.wb-cerrar-cajon{display:none}
@media (min-width:760px) and (max-width:1360px){
  .wb-cajon-abierto .wb-ficha{display:block!important;position:absolute;top:var(--wb-cajon-top,0);right:0;bottom:0;width:360px;max-width:calc(100% - 48px);z-index:61;margin:0;
    overflow-y:auto;background:#fff;border-left:0;box-shadow:-30px 0 60px -30px rgba(0,0,0,.45);animation:wb-cajon 420ms ${IOS} both}
  .wb-cajon-abierto .wb-ficha > *{animation:wb-fe 420ms ${SALIDA} both}
  .wb-cajon-abierto .wb-ficha > :nth-child(2){animation-delay:60ms}.wb-cajon-abierto .wb-ficha > :nth-child(3){animation-delay:120ms}
  .wb-cajon-abierto .wb-ficha > :nth-child(4){animation-delay:180ms}.wb-cajon-abierto .wb-ficha > :nth-child(n+5){animation-delay:240ms}
  .wb-cajon-abierto > .wb-velo{display:block;position:absolute;inset:var(--wb-cajon-top,0) 0 0 0;z-index:60;background:rgba(11,11,16,.42);animation:wb-velo 240ms ${SALIDA} both}
  .wb-cajon-abierto button.wb-cerrar-cajon{display:grid}
  .wb-cajon-sale .wb-ficha{animation:wb-cajon-sale 260ms ${IOS} both!important}.wb-cajon-sale > .wb-velo{animation:wb-velo-sale 260ms ${SALIDA} both}
  [data-wb-cajon]{cursor:pointer;border-radius:10px;transition:background 160ms ${SALIDA},transform 140ms ${SALIDA}}
  [data-wb-cajon]:hover{background:#f3f6fa}[data-wb-cajon]:active{transform:scale(.98)}
}
button.wb-cerrar-cajon{margin-left:auto;width:32px;height:32px;border-radius:9px;place-items:center;color:#dc2626;flex:none;border:0;background:none;padding:0;cursor:pointer;
  transition:background 160ms ${SALIDA},transform 140ms ${SALIDA}}
button.wb-cerrar-cajon:hover{background:#fef2f2}button.wb-cerrar-cajon:active{transform:scale(.92)}.wb-cerrar-cajon svg{width:18px;height:18px}
@keyframes wb-cajon{from{transform:translateX(100%)}}@keyframes wb-cajon-sale{to{transform:translateX(100%)}}
@keyframes wb-fe{from{opacity:0;transform:translateX(14px)}}
@keyframes wb-velo{from{opacity:0}}@keyframes wb-velo-sale{to{opacity:0}}
@media (prefers-reduced-motion:reduce){
  .wb-cajon-abierto .wb-ficha,.wb-cajon-abierto .wb-ficha > *,.wb-cajon-abierto > .wb-velo,.wb-cajon-sale .wb-ficha,.wb-cajon-sale > .wb-velo{animation:none!important}
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
    /** La grilla `contenedor` anima sus columnas solo durante el próximo cambio. */
    animar(contenedor) {
      if (!contenedor) return;
      contenedor.classList.add('wb-anima');
      clearTimeout(contenedor._wbT);
      contenedor._wbT = setTimeout(() => contenedor.classList.remove('wb-anima'), 460);
    },
    /** Oculta o muestra la ficha con su animación. `contenedor` es la grilla que tiene la columna de la ficha. */
    ocultarFicha(contenedor, oculta, recordar = true) {
      if (!contenedor) return;
      this.animar(contenedor);
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
    /** ¿La pantalla es de tablet, donde la ficha va como cajón? */
    esCajon: () => window.matchMedia('(min-width:760px) and (max-width:1360px)').matches,
    /** Abre o cierra la ficha como cajón en `contenedor` (el que tiene la ficha; va con position:relative). */
    cajon(contenedor, abierto, alCerrar) {
      if (!contenedor) return;
      let velo = contenedor.querySelector(':scope > .wb-velo');
      if (!velo) { velo = document.createElement('div'); velo.className = 'wb-velo'; velo.setAttribute('aria-hidden', 'true'); contenedor.appendChild(velo); }
      velo.onclick = () => { this.cajon(contenedor, false); if (alCerrar) alCerrar(); };
      contenedor._wbCerrar = alCerrar || contenedor._wbCerrar;
      clearTimeout(contenedor._wbCajonT);
      if (abierto) { contenedor.classList.remove('wb-cajon-sale'); contenedor.classList.add('wb-cajon-abierto'); return; }
      if (!contenedor.classList.contains('wb-cajon-abierto')) return;
      const quieto = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
      contenedor.classList.add('wb-cajon-sale');
      contenedor._wbCajonT = setTimeout(() => contenedor.classList.remove('wb-cajon-abierto', 'wb-cajon-sale'), quieto ? 0 : 260);
    },
    botonCerrarCajon: (attrs = '') => `<button type="button" class="wb-cerrar-cajon" ${attrs} aria-label="Cerrar la ficha" title="Cerrar la ficha"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`,
  };
  // Escape cierra el cajón abierto.
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const c = document.querySelector('.wb-cajon-abierto:not(.wb-cajon-sale)'); if (!c) return;
    window.WB.cajon(c, false); if (c._wbCerrar) c._wbCerrar();
  });
})();
