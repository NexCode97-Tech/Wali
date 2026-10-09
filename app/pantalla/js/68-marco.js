/* ── Dentro de la plataforma (el marco de /) no hay barra arriba: la campana de avisos va en la barra lateral, junto al
   nombre, y tu cuenta (abajo) abre el menú con Usuarios, la contraseña y Cerrar sesión. Los avisos, la sesión y sus
   ventanas los maneja el marco (window.parent.CRM_MARCO); aquí solo van los botones. Con /app abierto suelto, sin
   marco, no se ponen. Va dentro de una función para no dejar nombres sueltos en el ámbito compartido. ── */
(() => {
  let M = null;
  try { M = window.parent !== window ? window.parent.CRM_MARCO || null : null; } catch { M = null; }
  if (!M) return;
  const nav = document.querySelector('#app .nav'), marca = nav.querySelector('.brand'), fila = nav.querySelector('.me .cu-fila');

  document.head.insertAdjacentHTML('beforeend', `<style>
.brand .mc-campana{position:relative;margin-left:auto;flex:none;width:34px;height:34px;padding:0;border:0;border-radius:9px;background:none;color:#374151;display:grid;place-items:center;cursor:pointer}
.brand .mc-campana:hover,.brand .mc-campana[aria-expanded="true"]{background:#f1f4f9}
.brand .mc-campana svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}
.brand .mc-campana .n{position:absolute;top:2px;right:1px;min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:#dc2626;color:#fff;font-size:10.5px;font-weight:600;line-height:16px;text-align:center}
.brand .mc-campana .n[hidden]{display:none}
.app.cj-abierto .brand .mc-campana + .cj-cerrar{margin-left:0}
.nav .me .cu-fila.mc-cuenta{margin:-4px;padding:4px;border-radius:9px;cursor:pointer}
.nav .me .cu-fila.mc-cuenta:hover,.nav .me .cu-fila.mc-cuenta[aria-expanded="true"]{background:#f1f4f9}
.nav .me .cu-fila.mc-cuenta:focus-visible{outline:2px solid #0b0b10;outline-offset:1px}
.nav .me .cu-fila .mc-flecha{margin-left:auto;flex:none;width:16px;height:16px;fill:none;stroke:#9ca3af;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
</style>`);

  /* ── Campana, a la derecha del nombre (antes de la X del cajón en celular) ── */
  const campana = document.createElement('button');
  campana.type = 'button'; campana.className = 'mc-campana';
  campana.setAttribute('aria-label', 'Avisos'); campana.setAttribute('aria-haspopup', 'true'); campana.setAttribute('aria-expanded', 'false');
  campana.insertAdjacentHTML('beforeend', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10 20a2 2 0 0 0 4 0"/></svg><span class="n" hidden></span>');
  marca.insertBefore(campana, marca.querySelector('.cj-cerrar'));
  campana.addEventListener('click', e => { e.stopPropagation(); M.campana(campana.getBoundingClientRect()); });

  /* ── Tu cuenta: la foto y el nombre abren el menú ── */
  fila.classList.add('mc-cuenta');
  fila.setAttribute('role', 'button'); fila.setAttribute('tabindex', '0');
  fila.setAttribute('aria-label', 'Tu cuenta'); fila.setAttribute('aria-haspopup', 'menu'); fila.setAttribute('aria-expanded', 'false');
  fila.insertAdjacentHTML('beforeend', '<svg class="mc-flecha" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 15 6-6 6 6"/></svg>');
  const abrirCuenta = e => { e.stopPropagation(); M.cuenta(fila.getBoundingClientRect()); };
  fila.addEventListener('click', abrirCuenta);
  fila.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirCuenta(e); } });

  /* ── El marco avisa qué está abierto y cuántos avisos hay sin leer ── */
  window.crmMarcoAbierto = cual => {
    campana.setAttribute('aria-expanded', String(cual === 'campana'));
    fila.setAttribute('aria-expanded', String(cual === 'cuenta'));
  };
  window.crmGloboAvisos = n => {
    const g = campana.querySelector('.n');
    g.hidden = !n; g.textContent = n > 99 ? '99+' : String(n || '');
    campana.setAttribute('aria-label', n ? `Avisos, ${n} sin leer` : 'Avisos');
  };
  window.crmGloboAvisos(M.sinLeer());

  // Un clic o Escape dentro del CRM cierra lo que el marco tenga abierto.
  document.addEventListener('click', () => M.cerrar());
  document.addEventListener('keydown', e => { if (e.key === 'Escape') M.cerrar(); });
})();
