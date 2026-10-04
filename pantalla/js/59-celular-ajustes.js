/* ── Celular: Ajustes y sus secciones, como Mi perfil (maqueta aprobada «CRM · menú en celular», 29-sep, tableros 4, 5 y 6). ── */
// Solo por debajo de 760 px (el marco del CRM deja de escalarse ahí, puenteCrm.ts): en escritorio no cambia nada.
// La página la arma 10-nucleo.js (st.pagina === 'ajustes'); el ☰ junto al título lo pone 57-celular-menu.js.
//  · Tableros 4 y 5, Mis ajustes y Ajustes del CRM: las tarjetas pasan a filas de ancho completo, una debajo de otra, con
//    la flecha › a la derecha. «Atajos de teclado» no sale (no hay teclado físico) y su grupo se llama «Avisos».
//  · Tablero 6, una sección abierta (Mi perfil): «‹ Mis ajustes», título, subtítulo y la caja en una sola columna; la foto
//    con su texto al lado y los botones debajo. Las demás secciones de Mis ajustes llevan el mismo marco.
//  · Subpáginas de Ajustes del CRM (Canales, Horario, Plantillas…): no se rediseñan, solo se arregla lo que se salía a lo
//    ancho a 360, 390 y 430 px.
// #page lleva data-cel-aj (lista, sec o sub) para que estas reglas no toquen las demás páginas. Va dentro de una función
// para no dejar nombres sueltos en el ámbito que comparten todos los archivos del CRM.
(() => {
  const pg = document.getElementById('page');
  // Subpáginas de Ajustes del CRM que no empiezan por cfg- (Plantillas también se abre desde la barra: es la misma página).
  const SUBPAGINAS = new Set(['etiquetas', 'campos', 'plantillas', 'flujos', 'reglas', 'importar']);
  const FLECHA = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239ca3af' stroke-width='1.75' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m9 6 6 6-6 6'/%3E%3C/svg%3E")`;
  // Los íconos de las opciones, con el trazo de la maqueta (tableros 4 y 5). Van junto al del escritorio y el CSS muestra
  // uno u otro según el ancho; una opción que no esté aquí conserva el suyo.
  const IC = {
    persona: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
    reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    lapiz: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4"/>',
    rayo: '<path d="M13 3 5 13h6l-1 8 8-10h-6l1-8Z"/>',
    enlace: '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
    campana: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    chat: '<path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.4A8.5 8.5 0 1 1 21 12Z"/>',
    tel: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    enchufe: '<path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0V8ZM12 17v5"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
    equipo: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.8 3 2.6 3.5 5.2"/>',
    kanban: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="10" rx="1"/><rect x="17" y="4" width="4" height="13" rx="1"/>',
    etiqueta: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
    doc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    estrella: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/>',
    luna: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z"/>',
    flujo: '<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/><path d="M6 9v3a3 3 0 0 0 3 3h6"/>',
    megafono: '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z"/><path d="M15 9a3 3 0 0 1 0 6"/>',
    candado: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    carpeta: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/>',
    tarjeta: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/>',
  };
  // Mis ajustes por data-aj-ver y Ajustes del CRM por data-ir.
  const IC_DE = {
    perfil: IC.persona, disp: IC.reloj, firma: IC.lapiz, qr: IC.rayo, enl: IC.enlace, notif: IC.campana,
    'cfg-canales': IC.chat, 'cfg-llamadas': IC.tel, 'cfg-integraciones': IC.enchufe, 'cfg-conversaciones': IC.check, 'cfg-reparto': IC.equipo,
    'cfg-etapas': IC.kanban, etiquetas: IC.etiqueta, campos: IC.persona, 'cfg-horario': IC.reloj, 'cfg-qr': IC.rayo, plantillas: IC.doc,
    'cfg-encuesta': IC.estrella, 'cfg-recepcion': IC.luna, flujos: IC.flujo, reglas: IC.flujo, 'cfg-pauta': IC.megafono, 'cfg-datos': IC.candado, 'cfg-archivos': IC.carpeta, 'cfg-plan': IC.tarjeta,
  };

  document.head.insertAdjacentHTML('beforeend', `<style>
/* El ícono de la maqueta solo se ve en celular. */
#page .cel-aj-ic{display:none}
@media (max-width:759.98px){
  /* ── Tableros 4 y 5: la lista. Arriba 14 px (la fila del ☰ mide 34), 16 a los lados y abajo. ── */
  #page[data-cel-aj="lista"]{padding:14px 16px 16px}
  #page[data-cel-aj="lista"] .ajw > .sub{margin:0 0 14px}
  #page[data-cel-aj="lista"] .ajt{margin:0 0 14px}
  #page[data-cel-aj="lista"] .ajt button{padding:6px 14px;color:#374151;line-height:normal}
  #page[data-cel-aj="lista"] .ajt button[aria-pressed="true"]{color:#1f2937}
  #page[data-cel-aj="lista"] .ajg{gap:14px}
  #page[data-cel-aj="lista"] .ajg h4{margin:0 0 8px;line-height:normal}
  #page[data-cel-aj="lista"] .ajg .grid3{grid-template-columns:minmax(0,1fr);gap:8px}
  /* Cada opción: borde, radio 12, ícono de 18, título 14 (500), descripción 12,5 gris y la flecha › de 16 a la derecha. */
  #page[data-cel-aj="lista"] .ajg .grid3 button{align-items:center;min-height:0;padding:12px 12px 12px 14px;line-height:normal}
  #page[data-cel-aj="lista"] .ajg .grid3 button svg.i{margin-top:0}
  #page[data-cel-aj="lista"] .ajg .grid3 button:has(> .cel-aj-ic) > svg.i:not(.cel-aj-ic){display:none}
  #page[data-cel-aj="lista"] .ajg .grid3 button > .cel-aj-ic{display:block}
  #page[data-cel-aj="lista"] .ajg .grid3 button > span{flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:2px}
  #page[data-cel-aj="lista"] .ajg .grid3 small{display:block;line-height:1.4}
  #page[data-cel-aj="lista"] .ajg .grid3 button::after{content:"";flex:none;width:16px;height:16px;background:${FLECHA} center / 16px 16px no-repeat}
  /* Sin teclado físico no hay atajos: el grupo queda «Avisos», con Notificaciones sola (tablero 4). */
  #page[data-cel-aj="lista"] .ajg [data-aj-ver="atajos"],#page[data-cel-aj="lista"] .cel-aj-y{display:none}

  /* ── Tablero 6: una sección abierta. «‹ Mis ajustes» a 16 px de arriba; entre bloques 14 px. ── */
  #page[data-cel-aj="sec"]{padding:16px}
  #page[data-cel-aj="sec"] .ajw > .volver{font-size:13px;gap:6px;margin:0 0 14px;line-height:normal}
  #page[data-cel-aj="sec"] .ajw > .volver svg{width:15px;height:15px}
  #page[data-cel-aj="sec"] .ajw > h2{font-size:18px;margin:0 0 4px;line-height:normal}
  #page[data-cel-aj="sec"] .ajw > .sub{font-size:13px;color:#6b7280;margin:0 0 14px;line-height:1.5}
  #page[data-cel-aj="sec"] .ajw > .box2{padding:16px;border-radius:12px}
  /* La caja en una sola columna, 16 px entre bloques; nada la ensancha (Mis respuestas rápidas se salía). */
  #page[data-cel-aj="sec"] .box2 > .acb{padding:0!important;gap:16px;grid-template-columns:minmax(0,1fr)}
  #page[data-cel-aj="sec"] .box2 > .acb > *,#page[data-cel-aj="sec"] .acb .qd-l > *{min-width:0}
  #page[data-cel-aj="sec"] .acb .qd-l{grid-template-columns:minmax(0,1fr)}
  #page[data-cel-aj="sec"] .acb .two2{grid-template-columns:minmax(0,1fr);gap:16px}
  /* Campos: rótulo 13 en negrilla y el dato en peso normal; cajas de 42 px con radio 9. */
  #page[data-cel-aj="sec"] .acb .fl{gap:6px;font-size:13px;font-weight:600;color:#1f2937;line-height:normal}
  #page[data-cel-aj="sec"] .acb .fl .sel{font-weight:400}
  #page[data-cel-aj="sec"] .acb input{height:42px;border-radius:9px;padding:0 12px;font-size:14px}
  #page[data-cel-aj="sec"] .acb .hint{font-size:12.5px;color:#6b7280;line-height:1.5}
  #page[data-cel-aj="sec"] .acb .ft2 .btn{padding:0 12px}
  /* La foto de 64 px con «Foto de perfil» y su descripción al lado; debajo, en una fila, «Cambiar foto», «Usar la de
     Google» y la nota (si no cabe, la nota baja entera). */
  #page[data-cel-aj="sec"] .pf-foto{display:grid;grid-template-columns:64px minmax(0,1fr);gap:0 14px;align-items:center;padding-bottom:16px}
  #page[data-cel-aj="sec"] .pf-foto .pf-av{grid-row:1 / span 2;width:64px;height:64px;font-size:22px}
  #page[data-cel-aj="sec"] .pf-tx{display:contents}
  #page[data-cel-aj="sec"] .pf-tx > b{grid-column:2;align-self:end;line-height:normal}
  #page[data-cel-aj="sec"] .pf-tx > span{grid-column:2;align-self:start;margin-top:6px;font-size:12.5px;line-height:1.45;color:#6b7280}
  #page[data-cel-aj="sec"] .pf-bts{grid-column:1 / -1;margin-top:14px;gap:8px 12px}
  #page[data-cel-aj="sec"] .pf-bts .btn{height:32px;padding:0 10px;border-radius:9px;font-size:13px;gap:6px}
  #page[data-cel-aj="sec"] .pf-bts .btn svg{width:15px;height:15px}
  #page[data-cel-aj="sec"] .pf-bts .btn.lnk{padding:0;border:0;background:none}
  #page[data-cel-aj="sec"] .pf-nota{color:#6b7280;white-space:nowrap;line-height:normal}

  /* ── Subpáginas de Ajustes del CRM: solo que nada se salga a lo ancho. ── */
  /* Lo que va en rejilla puede angostarse hasta su columna (antes el contenido más ancho estiraba la columna). */
  #page[data-cel-aj="sub"] :is(.cfg,.box2,.two3,.cv-grid,.rq-ed,.rq-card,.flw,.fprev,.rp-cols,.rama,.ll-sec,[style*="display:grid"]) > *,#page[data-cel-aj="sub"] .rule{min-width:0}
  /* Un desplegable o un botón al lado del rótulo baja a su propio renglón cuando no cabe. */
  #page[data-cel-aj="sub"] .row2:is(:has(> .dsel),:has(> .btn),:has(> span > .btn)){flex-wrap:wrap}
  #page[data-cel-aj="sub"] .row2 > .dsel{flex:1 1 200px;min-width:0!important}
  /* Conversaciones: «Finalizar después de» arriba de su número, y el motivo nuevo se angosta junto a «Agregar». */
  #page[data-cel-aj="sub"] .cv-inl{flex-wrap:wrap}
  #page[data-cel-aj="sub"] .cv-inl > .muted{flex:1 1 100%}
  #page[data-cel-aj="sub"] #cv-mn{width:auto!important;flex:1 1 0;min-width:0}
  /* Campos personalizados: el campo nuevo arriba; el tipo y «Agregar» debajo. */
  #page[data-cel-aj="sub"] .frm:has(#cf-add){grid-template-columns:minmax(0,1fr) auto!important}
  #page[data-cel-aj="sub"] .frm:has(#cf-add) > label{grid-column:1 / -1}
  #page[data-cel-aj="sub"] .frm:has(#cf-add) .dsel{min-width:0!important}
  /* Horario de atención: el día sin ancho fijo y las horas más angostas, en el mismo renglón. */
  #page[data-cel-aj="sub"] .row2:has(input[data-cfg-hora]) > span:first-child{width:auto!important}
  #page[data-cel-aj="sub"] input.inl[data-cfg-hora]{width:64px}
  /* Flujos: si no cabe, «Editar» baja al renglón de abajo. */
  #page[data-cel-aj="sub"] .rule .rh{flex-wrap:wrap}
  /* Encabezado con botón (Plantillas, Flujos): el botón baja debajo del título y su texto, como ya pedía la regla de 700 px
     de crm.html (con flex:1 nunca bajaba y el título quedaba en una columna de 140 px). */
  #page[data-cel-aj="sub"] .pg-h{flex-wrap:wrap}
  #page[data-cel-aj="sub"] .pg-h > div{flex-basis:100%}
  /* Tablas (Plantillas): se deslizan dentro de su caja, la página no; el texto de la plantilla con un ancho que se lea. */
  #page[data-cel-aj="sub"] table.tb2{display:block;overflow-x:auto}
  #page[data-cel-aj="sub"] table.tb2 td:last-child{min-width:240px}
  /* Equipos y reparto: las tablas de equipos y de personas también se deslizan dentro de su caja (se cortaban y «Editar»
     quedaba fuera de alcance), sin que la columna del nombre se encoja a cero. */
  #page[data-cel-aj="sub"] .rq-t{overflow-x:auto}
  #page[data-cel-aj="sub"] .rq-t > .rq-f.eqs{min-width:1040px}
  #page[data-cel-aj="sub"] .rq-t > .rq-f.pers{min-width:1046px}
  /* Etapas del embudo: con varios equipos, sus pestañas se deslizan dentro de su fila (antes empujaban la página de lado). */
  /* La raya de abajo va por dentro (sombra) para que el subrayado de 2 px de la elegida no quede recortado. */
  #page[data-cel-aj="sub"] .e2-tabs{overflow-x:auto;overflow-y:hidden;scrollbar-width:none;border-bottom:0;box-shadow:inset 0 -1px 0 var(--line)}
  #page[data-cel-aj="sub"] .e2-tabs::-webkit-scrollbar{display:none}
  #page[data-cel-aj="sub"] .e2-tab{flex:none;white-space:nowrap;margin-bottom:0}
  /* Integraciones: las tarjetas en una columna (pedían 320 px de mínimo). */
  #page[data-cel-aj="sub"] .ig-lista{grid-template-columns:minmax(0,1fr)}
  /* Canales › cuenta conectada: el nombre largo y su estado se acomodan dentro de la tarjeta. */
  #page[data-cel-aj="sub"] .cx-fila{flex-wrap:wrap}
  #page[data-cel-aj="sub"] .cx-fila > b{min-width:0;overflow-wrap:anywhere}
  /* Flujos › Probar: la caja para responder se angosta y deja ver el botón de enviar. */
  #page[data-cel-aj="sub"] .fprev .resp input{min-width:0}
  /* Formularios de dos columnas (editor de Flujos): un campo debajo del otro. */
  #page[data-cel-aj="sub"] .two3{grid-template-columns:minmax(0,1fr)!important}
  #page[data-cel-aj="sub"] .fld > .dsel{min-width:0!important}
  /* Los diálogos que se abren desde estas páginas no se estiran más que la pantalla (a 360 px se salían). */
  body:has(#page[data-cel-aj]) .ov,body:has(#page[data-cel-aj]) .dlg,body:has(#page[data-cel-aj]) .dlg .cx-list{grid-template-columns:minmax(0,1fr)}
  body:has(#page[data-cel-aj]) .dlg .et-sws{flex-wrap:wrap;height:auto;min-height:34px;row-gap:10px}
  /* «‹ Mis ajustes» y «‹ Ajustes del CRM» son la única salida de una sección o subpágina (ahí no hay ☰): el texto mide
     20 px de alto y el área que se puede tocar llega a 40 sin mover nada. */
  #page[data-cel-aj] .volver{position:relative}
  #page[data-cel-aj] .volver::after{content:"";position:absolute;inset:-10px -6px}

  /* ── Páginas sin maqueta de celular (Contactos, Embudo, Difusiones, Informes, Equipo en vivo, Agentes IA): no se
     rediseñan; solo se evita que la página entera se deslice de lado, porque el ☰ se iba con ella. El encabezado baja
     de renglón (el botón debajo del título), las tablas se deslizan dentro de su caja, las dos columnas de Informes van
     una debajo de la otra, y en Contactos la columna de la lista se desliza dentro de sí misma. ── */
  #page:not([data-cel-aj]) .pg-h{flex-wrap:wrap}
  #page:not([data-cel-aj]) .pg-h > div{flex-basis:100%}
  #page:not([data-cel-aj]) :is(table.tb2,table.tb3,table.ag-tb){display:block;overflow-x:auto}
  #page:not([data-cel-aj]) .two{grid-template-columns:minmax(0,1fr)}
  #page:not([data-cel-aj]) .two > *{min-width:0}
  /* Los indicadores (Informes, Equipo en vivo) van de dos en dos: en cuatro columnas de 64 px las etiquetas («Calificaciones
     bajas») se montaban sobre la de al lado y se salían de la pantalla. */
  #page:not([data-cel-aj]) .kpis{grid-template-columns:repeat(2,minmax(0,1fr))}
  #page:not([data-cel-aj]) :is(.cfg,.box2) > *{min-width:0}
  #page:not([data-cel-aj]) .ctm{overflow-x:auto}
}
</style>`);

  // La página que se ve: la lista de ajustes, una sección de Mis ajustes abierta o una subpágina de Ajustes del CRM.
  function marcar(topAntes){
    const k = st.pagina || '';
    const v = k === 'ajustes' ? (pg.querySelector(':scope > .ajw > .volver[data-aj-ver]') ? 'sec' : 'lista') : k.startsWith('cfg-') || SUBPAGINAS.has(k) ? 'sub' : '';
    if (v) pg.dataset.celAj = v; else delete pg.dataset.celAj;
    if (v === 'lista') { avisos(); iconos(); integraciones(); }
    desplazar(v, topAntes);
  }
  // Tablero 5: en celular la opción Integraciones dice lo conectado por su nombre, «Hotmart conectado». Sin ninguna
  // conectada (la plataforma de la empresa viene incluida y la maqueta no la nombra) queda la descripción de escritorio.
  // Se vuelve a poner al cambiar de ancho, sin repintar la página.
  function integraciones(){
    const s = pg.querySelector('.ajg [data-ir="cfg-integraciones"] small'); if (!s) return;
    if (s.dataset.escritorio == null) s.dataset.escritorio = s.textContent;
    const n = CEL.matches && typeof integConectadas === 'function' ? integConectadas().map(x => x.n).filter(Boolean) : [];
    s.textContent = n.length ? `${n.length > 1 ? n.slice(0, -1).join(', ') + ' y ' + n[n.length - 1] : n[0]} ${n.length > 1 ? 'conectados' : 'conectado'}` : s.dataset.escritorio;
  }
  // En celular la lista de Ajustes del CRM es alta y la página conservaba su desplazamiento: una opción de abajo abría su
  // sección o subpágina a media altura, sin su título ni «‹». Lo que se abre empieza arriba; al volver a la lista, se
  // vuelve adonde se estaba. Los repintados en vivo de la misma página no la mueven.
  const CEL = window.matchMedia('(max-width:759.98px)');
  let dondeAntes = '', vistaAntes = '', topLista = 0, filaAbierta = '';
  // El foco tampoco se pierde (la opción que lo tenía se repinta): al abrir una sección o subpágina va a su «‹», y al
  // volver a la lista, a la opción que se había abierto. Solo si quedó en ninguna parte (con el cajón, lo lleva 57).
  function desplazar(v, topAntes){
    const tab = st.rol === 'l' ? st.ajTab : 'cuenta';
    const donde = v ? [st.pagina, v === 'sub' ? '' : tab, v === 'sec' ? st.ajSec : ''].join('|') : '';
    if (v && donde !== dondeAntes && CEL.matches) {
      if (vistaAntes === 'lista') topLista = topAntes;
      const volviendo = v === 'lista' && (vistaAntes === 'sec' || vistaAntes === 'sub');
      pg.scrollTop = volviendo ? topLista : 0;
      const a = document.activeElement, sinFoco = !a || a === document.body;
      if (v === 'sec' || v === 'sub') {
        filaAbierta = v === 'sec' ? `[data-aj-ver="${CSS.escape(st.ajSec || '')}"]` : `[data-ir="${CSS.escape(st.pagina)}"]`;
        const vo = pg.querySelector('.volver'); if (sinFoco && vo) vo.focus({preventScroll: true});
      } else if (volviendo && sinFoco && filaAbierta) {
        const f = pg.querySelector(`.ajg ${filaAbierta}`); if (f) f.focus({preventScroll: true});
      }
    }
    dondeAntes = donde; vistaAntes = v;
  }
  const alCambiarAncho = () => { if (pg.dataset.celAj === 'lista') integraciones(); };
  if (CEL.addEventListener) CEL.addEventListener('change', alCambiarAncho); else if (CEL.addListener) CEL.addListener(alCambiarAncho);
  function iconos(){
    for (const b of pg.querySelectorAll('.ajg .grid3 button')) {
      const d = IC_DE[b.dataset.ajVer || b.dataset.ir], i = b.querySelector(':scope > svg.i');
      if (!d || !i || b.querySelector(':scope > .cel-aj-ic')) continue;
      i.insertAdjacentHTML('afterend', `<svg class="i cel-aj-ic" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`);
    }
  }
  // «Avisos y atajos» → «Avisos» en celular: « y atajos» va en un span que solo se esconde por debajo de 760 px.
  function avisos(){
    const b = pg.querySelector('.ajg [data-aj-ver="atajos"]'), h = b && b.closest('section') && b.closest('section').querySelector('h4');
    if (!h || h.querySelector('.cel-aj-y')) return;
    const m = h.textContent.match(/^(.+?)( y atajos)$/);
    if (!m) return;
    const y = document.createElement('span'); y.className = 'cel-aj-y'; y.textContent = m[2];
    h.textContent = m[1]; h.append(y);
  }
  // Si la misma página se repinta con el foco adentro (una subpágina que termina de cargar, algo que llega en vivo), el
  // foco vuelve al mismo control: al repintarse, el que lo tenía desaparece y el foco quedaba en ninguna parte.
  const claveFoco = a => a.id ? '#' + CSS.escape(a.id) : [...a.attributes].filter(x => x.name.startsWith('data-')).map(x => `[${x.name}="${CSS.escape(x.value)}"]`).join('') || (a.classList.contains('volver') ? '.volver' : null);
  const renderSinAjCel = render;
  render = function(){
    const top = pg.scrollTop, a = document.activeElement, k = CEL.matches && a && a !== pg && pg.contains(a) ? claveFoco(a) : null;
    renderSinAjCel.apply(this, arguments); marcar(top);
    const f = document.activeElement;
    if (k && (!f || f === document.body || !f.getClientRects().length)) { const n = pg.querySelector(k); if (n) n.focus({preventScroll: true}); }
  };
})();
