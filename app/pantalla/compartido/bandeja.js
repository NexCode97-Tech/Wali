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
/* La X solo va en el cajón: en escritorio la regla general de los botones del título (.ptitle button, display:grid) la
   mostraba al lado de «Ocultar la ficha», que hace lo mismo (12-nov). Y siempre roja: el tema pinta gris los íconos del título. */
.ptitle button.wb-cerrar-cajon{display:none}
.ptitle button.wb-cerrar-cajon svg,#app .ptitle button.wb-cerrar-cajon svg{color:#dc2626}
@media (min-width:760px) and (max-width:1360px){
  .wb-cajon-abierto .wb-ficha{display:block!important;position:absolute;top:var(--wb-cajon-top,0);right:0;bottom:0;width:360px;max-width:calc(100% - 48px);z-index:61;margin:0;
    overflow-y:auto;background:#fff;border-left:0;box-shadow:-30px 0 60px -30px rgba(0,0,0,.45);animation:wb-cajon 420ms ${IOS} both}
  .wb-cajon-abierto .wb-ficha > *{animation:wb-fe 420ms ${SALIDA} both}
  .wb-cajon-abierto .wb-ficha > :nth-child(2){animation-delay:60ms}.wb-cajon-abierto .wb-ficha > :nth-child(3){animation-delay:120ms}
  .wb-cajon-abierto .wb-ficha > :nth-child(4){animation-delay:180ms}.wb-cajon-abierto .wb-ficha > :nth-child(n+5){animation-delay:240ms}
  .wb-cajon-abierto > .wb-velo{display:block;position:absolute;inset:var(--wb-cajon-top,0) 0 0 0;z-index:60;background:rgba(11,11,16,.42);animation:wb-velo 240ms ${SALIDA} both}
  .wb-cajon-abierto button.wb-cerrar-cajon,.wb-cajon-abierto .ptitle button.wb-cerrar-cajon{display:grid}
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
  /* La lista de la bandeja (maqueta aprobada el 12-nov, «Soporte igual a Mi bandeja»): cabecera con el filtro como ícono,
     buscador a todo el ancho, pestañas en barra y tarjetas (tj-*). Son las reglas de la bandeja del CRM, sacadas tal cual
     del navegador, bajo .wb-lista: la lista del CRM y la de Soporte llevan esa clase. Los colores van con respaldo y sin
     fijarlos aquí, para que el tema del CRM los siga cambiando. */
  const listaCss = `
.wb-lista .search{flex:1 1 0%;display:flex;align-items:center;gap:8px;border:1px solid var(--line,#e5e9f0);border-radius:8px;padding:0px 10px;height:34px;background:rgb(255, 255, 255)}
.wb-lista .search:focus-within{border-color:var(--blue,#0b0b10)}
.wb-lista .search input{border:0px;outline:0px;font-style:inherit;font-variant:inherit;font-weight:inherit;font-stretch:inherit;line-height:inherit;font-family:inherit;font-optical-sizing:inherit;font-size-adjust:inherit;font-kerning:inherit;font-feature-settings:inherit;font-variation-settings:inherit;font-language-override:inherit;font-size:13px;width:100%;min-width:0px;color:var(--ink,#1f2937);background:transparent}
.wb-lista .search svg{width:16px;height:16px;color:var(--ink4,#9ca3af)}
.wb-lista .lq{flex:0 0 auto;height:36px;background:var(--bg2,#f6f7f9)}
.wb-lista .lq:focus-within{background:rgb(255, 255, 255)}
.wb-lista .lq-x{width:22px;height:22px;display:grid;place-items:center;border-radius:6px;color:var(--ink4,#9ca3af);flex:0 0 auto}
.wb-lista .lq-x:hover{background:var(--hover,#f3f6fa);color:var(--ink,#1f2937)}
.wb-lista .lq-x svg{width:14px;height:14px}
.wb-lista .items .sin-res{padding:28px 16px;text-align:center;color:var(--ink3,#6b7280);font-size:13px}
.wb-lista .items .sin-res b{display:block;color:var(--ink,#1f2937);font-weight:600;margin-bottom:2px}
.wb-lista .list-h{padding:16px 16px 0px;display:grid;gap:12px}
.wb-lista .list-h .t{display:flex;align-items:center;gap:8px}
.wb-lista .list-h .t h2{margin:0px;font-size:16px;font-weight:600}
.wb-lista .list-h .t .ic{margin-left:auto;display:flex;gap:2px}
.wb-lista .list-h .t .ic > .dd > button{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;color:var(--ink3,#6b7280)}
.wb-lista .list-h .t .ic > .dd > button:hover{background:var(--hover,#f3f6fa)}
.wb-lista .tabs{display:flex;gap:20px;border-bottom:1px solid var(--line,#e5e9f0)}
.wb-lista .tabs button{padding:6px 0px 10px;font-size:13.5px;color:var(--ink3,#6b7280);border-bottom:2px solid transparent;margin-bottom:-1px;display:flex;align-items:center;gap:6px}
.wb-lista .tabs button[aria-pressed="true"]{color:var(--blue-ink,#0b0b10);border-bottom-color:var(--blue,#0b0b10);font-weight:500}
.wb-lista .tabs button .n{font-size:11.5px;background:var(--bg3,#f1f5f9);color:var(--ink3,#6b7280);border-radius:5px;padding:1px 6px;font-variant-numeric:tabular-nums}
.wb-lista .tabs button[aria-pressed="true"] .n{background:var(--blue-soft,#f2f4f6);color:var(--blue-ink,#0b0b10)}
.wb-lista .items{overflow-y:auto;flex:1 1 0%;padding:8px}
.wb-lista .it{display:grid;grid-template-columns:40px minmax(0px, 1fr);column-gap:12px;padding:12px;border-radius:12px;width:100%;text-align:left;align-items:start;line-height:normal}
.wb-lista .it + .it{margin-top:2px}
.wb-lista .it:hover{background:var(--hover,#f3f6fa)}
.wb-lista .it[aria-current="true"]{background:rgb(255, 253, 230)}
.wb-lista .it .tj-foto{position:relative;width:40px;height:40px}
.wb-lista .it .tj-av{width:40px;height:40px;font-size:13px;font-weight:600;color:rgb(255, 255, 255)}
.wb-lista .it .tj-canal{position:absolute;right:-3px;bottom:-3px;width:18px;height:18px;border-radius:50%;background:rgb(255, 255, 255);display:grid;place-items:center}
.wb-lista .it .tj-canal svg{width:13px;height:13px;color:rgb(107, 114, 128);stroke-width:2}
.wb-lista .it .tj-canal.wa svg{color:rgb(37, 211, 102)}
.wb-lista .it .tj-cu{min-width:0px}
.wb-lista .it .tj-l1{display:flex;align-items:baseline;gap:8px;min-width:0px}
.wb-lista .it .tj-l1 b{font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0px}
.wb-lista .it .tj-l1 time{margin-left:auto;font-size:12px;color:rgb(156, 163, 175);flex:0 0 auto;font-variant-numeric:tabular-nums}
.wb-lista .it.unread .tj-l1 b{font-weight:600}
.wb-lista .it.unread .tj-l1 time{color:rgb(11, 11, 16);font-weight:500}
.wb-lista .it .tj-l2{display:flex;align-items:center;gap:8px;margin-top:2px;min-width:0px}
.wb-lista .it .tj-msg{flex-grow:1;min-width:0px;font-size:13px;font-weight:400;color:rgb(107, 114, 128);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-lista .it.unread .tj-msg{color:rgb(75, 85, 99);font-weight:400}
.wb-lista .it .tj-cnt{min-width:18px;height:18px;border-radius:999px;background:rgb(11, 11, 16);color:rgb(255, 255, 255);font-size:11px;font-weight:600;display:grid;place-items:center;padding:0px 5px;flex:0 0 auto}
.wb-lista .it .tj-l3{display:flex;align-items:center;gap:6px;margin-top:8px;font-size:12px;color:rgb(107, 114, 128);min-width:0px}
.wb-lista .it .tj-eq{display:inline-flex;align-items:center;gap:5px;flex:0 0 auto}
.wb-lista .it .tj-eq i{width:8px;height:8px;border-radius:50%;display:inline-block}
.wb-lista .it .tj-pt{color:rgb(203, 213, 225);flex:0 0 auto}
.wb-lista .it .tj-as{display:inline-flex;align-items:center;gap:5px;min-width:0px}
.wb-lista .it .tj-as > span:last-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-lista .it .tj-mini{width:16px;height:16px;border-radius:50%;display:grid;place-items:center;color:rgb(255, 255, 255);font-size:7.5px;font-weight:600;flex:0 0 auto;overflow:hidden;line-height:1}
.wb-lista .it .tj-sin{border:1.5px dashed rgb(203, 213, 225);background:rgb(255, 255, 255);box-sizing:content-box;width:13px;height:13px}
.wb-lista .it .tj-esp{margin-left:auto;flex:0 0 auto;display:inline-flex;align-items:center;gap:4px;height:20px;padding:0px 8px;border-radius:999px;background:rgb(254, 226, 226);color:rgb(185, 28, 28);font-size:11.5px;font-weight:500}
.wb-lista .it .tj-esp svg{width:12px;height:12px}
.wb-lista .it .tj-l4{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.wb-lista .it{overflow:hidden}
.wb-lista .it .tj-pie{grid-column:1 / -1;margin:10px -12px -12px;padding:8px 12px;border-top:1px dashed rgb(229, 231, 235)}
.wb-lista .it .tj-pie .tj-as b{font-weight:600;color:rgb(17, 24, 39)}
.wb-lista .it .tj-pie .tj-mini{width:20px;height:20px;font-size:8.5px}
.wb-lista .it .tj-pie .tj-eq{margin-left:auto;height:20px;padding:0px 8px;border-radius:999px;background:rgb(241, 245, 249);font-size:11px;font-weight:600;color:rgb(75, 85, 99)}
.wb-lista .it .tj-pie .tj-eq:first-child{margin-left:0px}
.wb-lista .it .tj-pie .tj-esp + .tj-eq{margin-left:0px}
.wb-lista .it .tj-pie.libre{background:rgb(254, 243, 199);color:rgb(180, 83, 9)}
.wb-lista .it .tj-pie.libre .tj-as b{color:rgb(180, 83, 9)}
.wb-lista .it .tj-pie.libre .tj-sin{width:20px;height:20px;border:0px;background:rgb(245, 158, 11);color:rgb(255, 255, 255);font-size:10px;font-weight:700;box-sizing:border-box}
.wb-lista .it .tj-pie.libre .tj-eq{background:rgb(255, 255, 255)}
.wb-lista .it .tj-chip{display:inline-flex;align-items:center;gap:5px;height:22px;padding:0px 8px;border-radius:999px;background:rgb(241, 245, 249);font-size:11.5px;color:rgb(55, 65, 81);max-width:100%}
.wb-lista .it .tj-chip i{width:7px;height:7px;border-radius:50%;display:inline-block;flex:0 0 auto}
.wb-lista .it .tj-chip span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-lista .it .tj-chip svg{width:12px;height:12px;flex:0 0 auto;fill:none;stroke:currentcolor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}
.wb-lista .it .tj-chip.et{border-radius:7px;font-weight:600}
.wb-lista .it .tj-chip.tg{background:none;padding:0px 2px;color:rgb(75, 85, 99)}
.wb-lista .it .tj-chip.am{background:rgb(255, 248, 225);color:rgb(122, 90, 0)}
.wb-lista .it .tj-chip.rj{background:rgb(254, 226, 226);color:rgb(185, 28, 28)}
.wb-lista .tj-carga{min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding-bottom:60px}
.wb-lista .tj-carga > span{font-size:13px;font-weight:400;color:rgb(107, 114, 128)}
.wb-lista .tj-bu{display:flex;align-items:center;gap:6px;padding:14px 18px;border-radius:18px 18px 18px 6px;background:rgb(255, 253, 230);animation:2.4s ease-in-out 0s infinite normal none running tj-flotar}
.wb-lista .tj-bu i{width:8px;height:8px;border-radius:50%;background:rgb(11, 11, 16);display:block;animation:1.2s ease-in-out 0s infinite normal none running tj-saltar}
.wb-lista .tj-bu i:nth-child(2){animation-delay:0.15s}
.wb-lista .tj-bu i:nth-child(3){animation-delay:0.3s}
@media (prefers-reduced-motion:reduce){.wb-lista .tj-bu, .wb-lista .tj-bu i{animation:auto ease 0s 1 normal none running none}}
@media (prefers-reduced-motion:reduce){.wb-lista .tj-bu i{opacity:0.7}}
@media (max-width:1000px){.wb-lista .list-h{grid-template-columns:minmax(0px, 1fr)}}
@media (max-width:1000px){.wb-lista .list-h .t h2{min-width:0px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}}
@media (max-width:759.98px){.wb-lista .list-h .t h2{line-height:normal}}
@media (max-width:759.98px){.wb-lista .list-h .t #b-est{height:24px;gap:4px;padding:0px 8px;border-radius:8px;color:rgb(55, 65, 81)}}
@media (max-width:759.98px){.wb-lista .list-h .t .ic{gap:0px}}
@media (max-width:759.98px){.wb-lista .list-h .t .ic > .dd > button{color:rgb(55, 65, 81)}}
@media (max-width:759.98px){.wb-lista .list-h .t .ic > .dd > button svg{width:17px;height:17px}}
@media (max-width:759.98px){.wb-lista .list-h .lq{height:38px;background:rgb(246, 247, 249)}}
@media (max-width:759.98px){.wb-lista .list-h .lq:focus-within{background:rgb(255, 255, 255)}}
@media (max-width:759.98px){.wb-lista .list-h .t #b-est, .wb-lista .list-h .t .ic > .dd > button{position:relative}}
@media (max-width:759.98px){.wb-lista .list-h .t #b-est::after{content:"";position:absolute;inset:-8px -2px}}
@media (max-width:759.98px){.wb-lista .list-h .t .ic > .dd > button::after{content:"";position:absolute;inset:-5px 0px}}
@media (max-width:759.98px){.wb-lista .items .it[aria-current="true"]{background:none}}
@media (max-width:759.98px) and (hover:none){.wb-lista .items .it:hover{background:none}}
@media (max-width:379.98px){.wb-lista .list-h .t{gap:6px}}
.wb-lista .list-h .t h2{line-height:normal}
.wb-lista .list-h .t #b-est{height:24px;gap:4px;padding:0px 8px;border-radius:8px;color:rgb(55, 65, 81)}
.wb-lista .list-h .t .ic > .dd > button{color:rgb(55, 65, 81)}
.wb-lista .list-h .t .ic > .dd > button svg{width:17px;height:17px}
.wb-lista .list-h .lq{height:38px;background:rgb(246, 247, 249)}
.wb-lista .list-h .lq:focus-within{background:rgb(255, 255, 255)}
.wb-lista .app.vr-sin .list-h .t > .dd, .wb-lista .app.vr-sin .list-h .t > .ic, .wb-lista .app.vr-sin .list-h .lq{display:none}
.wb-lista .it .tj-et{display:inline-flex;align-items:center;gap:5px;min-width:0px}
.wb-lista .it .tj-et i{width:7px;height:7px;border-radius:50%;display:inline-block;flex:0 0 auto}
.wb-lista .it .tj-et > span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-lista .it .tj-fin{display:flex;align-items:center;gap:6px;margin-top:8px;font-size:12px;color:rgb(107, 114, 128);min-width:0px}
.wb-lista .it .tj-fin .fin-svg{width:13px;height:13px;color:rgb(22, 163, 74)}
.wb-lista .it .tj-fin > span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wb-lista .it .tj-l1{align-items:center}
.wb-lista .it .tj-l1 .mj-fav{width:13px;height:13px;color:rgb(245, 158, 11);fill:rgb(245, 158, 11);stroke:rgb(245, 158, 11);flex:0 0 auto}
.wb-lista .it .tj-l1 .mj-fu{font-size:13px;line-height:1;flex:0 0 auto}
.wb-lista .list-h{padding-bottom:12px;border-bottom:1px solid var(--line2,#eef1f5)}
.wb-lista .tabs{gap:4px;border-bottom:0px;background:rgb(246, 247, 249);border-radius:11px;padding:3px}
.wb-lista .tabs button{flex:1 1 0%;justify-content:center;height:30px;padding:0px 8px;font-size:12.5px;gap:6px;white-space:nowrap;margin:0px;border-bottom:0px;border-radius:9px;color:var(--ink2,#4b5563)}
.wb-lista .tabs button[aria-pressed="true"]{background:var(--nx-negro,#0b0b10);color:rgb(255, 255, 255)}
.wb-lista .tabs button[aria-pressed="true"] .n{background:rgba(255, 255, 255, 0.16);color:rgb(255, 255, 255)}
.wb-lista .search:focus-within{border-color:var(--nx-negro,#0b0b10)}
.wb-lista .it[aria-current="true"]{background:rgb(255, 253, 224);box-shadow:rgb(242, 232, 107) 0px 0px 0px 1px inset}
.wb-lista .it .tj-cnt{background:var(--nx-violeta,#7c3aed)}
.wb-lista .it.unread .tj-l1 time{color:var(--nx-violeta,#7c3aed)}
.wb-lista .rp-seg{display:flex;gap:6px;margin-top:10px}
.wb-lista .rp-seg[hidden]{display:none}
.wb-lista .rp-seg button{flex:1 1 0%;display:inline-flex;align-items:center;justify-content:center;gap:8px;height:32px;border-radius:9px;border:1px solid rgb(229, 233, 240);background:rgb(255, 255, 255);font-style:inherit;font-variant:inherit;font-stretch:inherit;line-height:inherit;font-family:inherit;font-optical-sizing:inherit;font-size-adjust:inherit;font-kerning:inherit;font-feature-settings:inherit;font-variation-settings:inherit;font-language-override:inherit;font-size:12.5px;font-weight:500;color:rgb(75, 85, 99);cursor:pointer;white-space:nowrap}
.wb-lista .rp-seg button[aria-pressed="true"]{border-color:rgb(11, 11, 16);color:rgb(11, 11, 16);box-shadow:rgb(11, 11, 16) 0px 0px 0px 1px inset}
.wb-lista .rp-seg button .n{min-width:20px;height:20px;border-radius:999px;display:inline-grid;place-items:center;font-size:11px;font-weight:600;padding:0px 6px;background:rgb(241, 245, 249);color:rgb(75, 85, 99)}
.wb-lista .rp-seg button[data-rp="por"] .n{background:rgb(255, 210, 31);color:rgb(11, 11, 16)}
.wb-lista .ck-bar .search{flex:1 1 200px;min-width:170px;max-width:340px;margin:0px}
.wb-lista .it .tj-foto{position:relative}
.wb-lista .sm-modo .it .sm-chk{opacity:1;transform:translate(-4px, -4px) scale(0.46)}
.wb-lista .sm-modo .it.sm-sel .sm-chk{transform:translate(-4px, -4px) scale(0.46);box-shadow:rgb(255, 255, 255) 0px 0px 0px 6px}
.wb-lista .sm-modo .it{cursor:pointer}
.wb-lista .it.sm-sel .sm-chk{background:rgb(255, 210, 31);border-color:rgb(255, 210, 31);box-shadow:rgb(255, 246, 204) 0px 0px 0px 4px}
.wb-lista .it.sm-sel .sm-chk svg{stroke-dashoffset:0}
.wb-lista .it.sm-sel{box-shadow:rgb(242, 210, 76) 0px 0px 0px 1.5px inset;background:rgb(255, 251, 234) !important}
.wb-lista .it.sm-brillo{animation:0.76s cubic-bezier(0.22, 1, 0.36, 1) 0s 1 normal none running sm-brillo}
.wb-lista .it.sm-sale{animation:0.38s cubic-bezier(0.22, 1, 0.36, 1) 0s 1 normal forwards running sm-sale;pointer-events:none}
@media (max-width:760px){.wb-lista .it{user-select:none}}
.wb-lista .list-h{position:relative}
.wb-lista .it .tj-pie{border-top:0px}
.wb-lista .items .it{overflow:visible;position:relative}
.wb-lista .items .it .tj-pie{border-radius:0px 0px 12px 12px}
.wb-lista .items .it + .it{margin-top:13px}
.wb-lista .items .it + .it::before{content:"";position:absolute;left:14px;right:14px;top:-7px;height:1px;background:rgb(236, 238, 242);pointer-events:none}
@media (prefers-reduced-motion:reduce){.wb-lista .sm-cab, .wb-lista .sm-menu, .wb-lista .sm-velo, .wb-lista .sm-chk, .wb-lista .sm-chk svg, .wb-lista .it.sm-brillo, .wb-lista .it.sm-sale, .wb-lista .sm-n span{animation:auto ease 0s 1 normal none running none !important;transition:none !important}}
.wb-lista .list-h button{background:none;border:0;cursor:pointer;color:inherit}
.wb-lista .it{font:inherit;text-align:left;width:100%;cursor:pointer}
.wb-lista .sx-lista{display:flex;flex-direction:column}
.wb-lista .items{flex:1;overflow:auto;padding:8px}
.wb-lista .list-h .t .ic > .dd > button svg,.wb-lista .list-h .t .ic > button svg{width:18px;height:18px}
.wb-lista .list-h .t .ic > button{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;color:var(--ink3,#6b7280);position:relative}
.wb-lista .list-h .t .ic > button:hover{background:var(--hover,#f3f6fa)}
.wb-lista .list-h .t .ic > button .fn{position:absolute;top:2px;right:2px;min-width:14px;height:14px;border-radius:7px;background:#0b0b10;color:#fff;font-size:9.5px;display:grid;place-items:center;padding:0 3px}
.wb-lista .tj-chip{display:inline-flex;align-items:center;height:22px;padding:0 8px;border-radius:6px;font-size:12px;font-weight:500}
.wb-lista .tj-chip.urg{background:#fee2e2;color:#b91c1c}
.wb-lista .tj-chip.tema{background:#f1f5f9;color:#475569}
.wb-lista .list-h .tabs{justify-self:stretch;width:auto}
`;
  document.head.insertAdjacentHTML('beforeend', '<style id="wb-css">' + css + listaCss + '</style>');

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
