/* ── Bandeja compartida: lo que es igual en la bandeja del CRM (crm.html) y en Soporte del superadmin (admin.html) ──
   Un solo código para las dos pantallas (regla del 11-nov: «son lo mismo, deja de crear dos por separado»).
   src/paginas.ts lo pone antes de los scripts del CRM y lo mete en admin.html en el marcador BANDEJA_COMPARTIDA (un comentario de bloque).
   Cada pantalla solo le pone las clases wb-* a su DOM:
   · wb-ficha            la columna de la ficha de la derecha
   · wb-ficha-oculta     en el contenedor de la grilla, cuando la ficha está oculta (solo computador, > 1360 px)
   · wb-ocultar          el botón dentro del título de la ficha (WB.botonOcultar)
   · wb-mostrar          el botón en la cabecera del chat, visible solo con la ficha oculta (WB.botonMostrar)
   Medida de la ficha (11-nov): la del CRM, 297 px visibles. ── */
(() => {
  if (window.WB) return;
  const IOS = 'cubic-bezier(.32,.72,0,1)', SALIDA = 'cubic-bezier(.23,1,.32,1)';
  const css = `
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
}`;
  document.head.insertAdjacentHTML('beforeend', '<style id="wb-css">' + css + '</style>');

  // El panel a la derecha: con la columna rellena es «ocultar», con la columna vacía es «mostrar».
  const PANEL = '<svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path class="pr" d="M15 4h2a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-2Z"/><path d="M15 4v16"/></svg>';
  const CLAVE = 'wali-ficha-oculta';
  const leer = () => { try { return localStorage.getItem(CLAVE) === '1'; } catch (e) { return false; } };
  const guardar = v => { try { localStorage.setItem(CLAVE, v ? '1' : '0'); } catch (e) { /* sin almacenamiento: solo por esta vez */ } };

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
    botonMostrar: (attrs = '', clase = '') => `<button type="button" class="wb-mostrar ${clase}" ${attrs} aria-label="Mostrar la ficha" title="Mostrar la ficha">${PANEL}</button>`,
  };
})();
