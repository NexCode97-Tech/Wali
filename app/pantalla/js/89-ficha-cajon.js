/* ── Ficha del contacto en tablet (maqueta «Ficha en el iPad», opción A, aprobada el 11-nov) ──
   Entre 760 y 1360 px la columna de la ficha no cabe: tocar la foto o el nombre en la cabecera del chat la abre como
   un cajón de arriba abajo, pegado al borde derecho, sobre un velo. La X roja, el velo o Escape la cierran. El cajón es
   el de la bandeja compartida (WB.cajon), el mismo de Soporte del superadmin. En celular sigue el panel a pantalla
   completa de 58-celular-chat.js. */
(() => {
  const app = document.getElementById('app');
  if (!app || !window.WB) return;
  document.head.insertAdjacentHTML('beforeend', '<style>#app{position:relative}</style>');
  const quien = document.querySelector('.chat-h .who');
  if (quien) { quien.setAttribute('data-wb-cajon', '1'); }
  const abrir = () => { if (!WB.esCajon() || !st.sel || app.classList.contains('sinchat')) return; WB.cajon(app, true); };
  const cerrar = () => WB.cajon(app, false);
  document.addEventListener('click', e => {
    const t = e.target instanceof Element ? e.target : null; if (!t) return;
    if (t.closest('[data-wb-cerrar]')) { cerrar(); return; }
    if (t.closest('.chat-h .who, .chat-h #c-av')) { abrir(); return; }
    // Al cambiar de conversación o de página, el cajón se cierra.
    if (app.classList.contains('wb-cajon-abierto') && t.closest('.list [data-c], .nav, [data-ir]')) cerrar();
  });
  // Si la pantalla pasa a computador o a celular, el cajón no queda abierto por debajo.
  window.matchMedia('(min-width:760px) and (max-width:1360px)').addEventListener('change', ev => { if (!ev.matches) app.classList.remove('wb-cajon-abierto', 'wb-cajon-sale'); });
})();
