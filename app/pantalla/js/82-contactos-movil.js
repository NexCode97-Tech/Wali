/* ── Contactos en el celular (maqueta aprobada «Contactos Wali móvil», 9-oct) ──
   Con 760 px o menos la página cambia entera: título y conteo; una fila con el buscador y botones de solo ícono
   (Filtros con el número puesto, Importar, Exportar y Agregar en amarillo); la lista en tarjetas. Las vistas y los
   filtros van en la hoja de Filtros, cada uno en su desplegable. Mantener oprimido empieza a elegir varios (la foto se
   vuelve chulo y abajo sale la barra negra); tocar abre la ficha a pantalla completa, con el lápiz para editar. El ⋯
   abre las acciones en una hoja. Usa el kit de 81-movil.js y los mismos datos y guardados de 10-nucleo.js y 80-datos.js
   (st.ct, ctVisibles, ctCambiar, CT_EXTRA). En escritorio sigue la página de 76-contactos.js. */
(() => {
  const ct = () => st.ct;
  const ctm = st.ctm = {ficha: null, edit: null, filtroAbierto: null, hojaFiltros: null};
  const etapas = () => [...etapasActivas(), ...etapasPerdidas()];
  const FILTROS_MV = [['etapa', 'Etapa', 'Todas las etapas'], ['asig', 'Asesor', 'Todos los asesores'], ['tag', 'Etiqueta', 'Todas las etiquetas'], ['origen', 'Origen', 'Todos los orígenes']];
  const opsFiltro = k => ((CT_FILTROS.find(x => x[0] === k) || [0, 0, () => []])[2])();
  const dot = col => `<i class="dot" style="background:${esc(colorOk(col || '#9ca3af'))}"></i>`;
  const preFiltro = (k, v) => k === 'etapa' ? dot(COL[v]) : k === 'tag' ? dot(ETIQ_COL[v]) : '';
  const busca = id => ctTodos().find(x => x.id === id);
  const conteo = n => `${n} ${n === 1 ? 'contacto' : 'contactos'}`;
  const titulo = () => { const v = ct().vista; return v === 'todos' ? 'Todos los contactos' : v === 'sinagregar' ? 'Leads sin agregar' : v === 'nocontactar' ? 'No contactar' : v === 'spam' ? 'Spam' : v.startsWith('etapa:') ? v.slice(6) : (segDe(v.slice(4)) || {n: 'Contactos'}).n; };
  const asesorHtml = a => a ? `<span class="mv-ase"><span class="m" style="background:${colorPersona(a)}">${esc(ini(a))}</span>${esc(a)}</span>` : '<span class="mv-ase sin">Sin asignar</span>';
  const etapaHtml = e => e ? `<span class="mv-pill"><i style="background:${esc(colorOk(COL[e] || '#9ca3af'))}"></i>${esc(e)}</span>` : '';

  /* Las vistas, con su conteo: Todos, Sin agregar, los segmentos, No contactar y Spam. */
  function vistas(){
    const todos = ctTodos(), cuentaV = f => todos.filter(c => !c.spam && f(c)).length, base = c => c.guardado !== false && !c.noContactar;
    const L = [['todos', 'Todos', cuentaV(base)], ['sinagregar', 'Sin agregar', cuentaV(c => c.guardado === false)],
      ...SEGMENTOS.map(s => ['seg:' + s.id, s.n, cuentaV(c => base(c) && s.f(c))]),
      ...(ct().propios || []).map(s => ['seg:' + s.id, s.n, cuentaV(c => base(c) && (s.f ? s.f(c) : pasaFiltros(c, s.filtros || {})))]),
      ['nocontactar', 'No contactar', cuentaV(c => c.noContactar)], ['spam', 'Spam', todos.filter(c => c.spam).length]];
    const v = ct().vista; if (!L.some(x => x[0] === v)) L.splice(1, 0, [v, titulo(), ctVisibles().length]);
    return L;
  }

  /* ── La lista ── */
  function pagina(){
    const el = document.getElementById('page'), c0 = ct(), L = ctVisibles(), todos = ctTodos();
    const nf = Object.values(c0.f).filter(Boolean).length, sinAsesor = L.filter(c => !c.asig).length;
    const nSel = [...c0.sel].filter(id => todos.some(c => c.id === id)).length, eligiendo = nSel > 0;
    const todosSel = L.length > 0 && L.every(c => c0.sel.has(c.id));
    const orden = {n: 'Nombre', ultimo: 'Último mensaje', agregado: 'Agregado'}[c0.orden.k] || 'Último mensaje';
    const filas = L.map(c => { const sel = c0.sel.has(c.id), can = CANALES[c.canal] || {n: c.canal, ic: 'chat'};
      return `<div class="mv-fila${sel ? ' on' : ''}" data-ctm-fila="${c.id}" role="button" tabindex="0" aria-pressed="${sel}">
        <span class="mv-av" style="background:${colorPersona(c.n)}">${esc(ini(c.n))}</span>
        <div class="mv-dat"><div class="mv-l1"><b>${esc(c.n)}</b><span class="mv-hora">${esc(ctFecha(c.ultimoDias))}</span></div>
          <small>${esc(c.tel || c.correo || '')}${c.guardado === false ? ' · sin agregar' : ''}</small>
          <div class="mv-met">${etapaHtml(c.etapa)}${asesorHtml(c.asig)}<span class="mv-can" title="${esc(can.n)}">${I(can.ic, 'i ' + c.canal)}</span></div></div>
        <button type="button" class="mv-mas" data-ctm-mas="${c.id}" aria-label="Más opciones de ${esc(c.n)}">${I('more')}</button></div>`; }).join('');
    const sinNada = !nf && !c0.q.trim() && c0.vista === 'todos';
    const vacio = sinNada
      ? `<div class="mv-vacio"><span class="ic">${mvIc('gente')}</span><b>Todavía no hay contactos</b><span>Agrégalos uno por uno${puedeConfigurarCrm() ? ' o importa tu lista desde Excel' : ''}.</span>${puedeConfigurarCrm() ? `<button type="button" class="mv-btn" data-ct-acc="importar">${mvIc('subir')}Importar desde Excel</button>` : ''}</div>`
      : `<div class="mv-vacio"><span class="ic">${I('search')}</span><b>Nadie coincide</b><span>${nf || c0.q.trim() ? 'Prueba quitando algún filtro o cambiando la búsqueda.' : 'Todavía no hay personas en esta lista.'}</span>${nf ? '<button type="button" class="mv-btn" data-ct-quitar="todo">Quitar filtros</button>' : ''}</div>`;
    el.replaceChildren();
    el.insertAdjacentHTML('beforeend', `<div class="ctm">
      <div class="ctm-cab"><h2>${esc(titulo())}</h2><p>${L.length} ${L.length === 1 ? 'persona' : 'personas'}${sinAsesor ? ` · ${sinAsesor} sin asesor` : ''}</p></div>
      <div class="mv-barra"><label class="mv-bus">${I('search')}<input id="ct-q" type="search" placeholder="Buscar…" value="${esc(c0.q)}" autocomplete="off" aria-label="Buscar por nombre, teléfono, correo o ciudad"></label>
        <button type="button" class="mv-ic${nf ? ' on' : ''}" data-ctm="filtros" aria-label="Filtros${nf ? ` (${nf} puestos)` : ''}">${mvIc('filtros')}${nf ? `<span class="mv-cnt">${nf}</span>` : ''}</button>
        ${puedeConfigurarCrm() ? `<button type="button" class="mv-ic" data-ct-acc="importar" aria-label="Importar desde Excel">${mvIc('subir')}</button>` : ''}
        <button type="button" class="mv-ic" data-ct-acc="exportar" aria-label="Exportar a Excel">${mvIc('bajar')}</button>
        <button type="button" class="mv-ic pri" data-ctm="nuevo" aria-label="Agregar contacto">${mvIc('mas')}</button><div id="ct-mas" hidden></div></div>
      <div class="mv-caja">
        ${L.length ? `<div class="mv-cbar">${eligiendo ? `<button type="button" data-ct-todos="1">${todosSel ? 'Quitar todos' : 'Elegir todos'}</button>` : `<span>${conteo(L.length)}</span>`}<button type="button" class="mv-ord" data-ctm="orden">${mvIc('orden')}${orden}</button></div>` : ''}
        ${filas || vacio}</div>
      ${eligiendo ? '<div class="ctm-hueco"></div>' : ''}
    </div>
    ${eligiendo ? `<div class="mv-flota" role="toolbar" aria-label="Acciones con la selección"><b>${nSel} ${nSel === 1 ? 'elegido' : 'elegidos'}</b>
      <button type="button" data-ctm-bulk="asig" aria-label="Asignar asesor">${I('user')}</button>
      <button type="button" data-ctm-bulk="etapa" aria-label="Cambiar etapa">${I('flow')}</button>
      <button type="button" data-ctm-bulk="tag" aria-label="Agregar etiqueta">${I('tag')}</button>
      <button type="button" class="x" data-ct-acc="limpiar-sel" aria-label="Quitar la selección">${mvIc('x')}</button></div>` : ''}`);
  }

  const base = paginaContactos;
  paginaContactos = function(){
    if (!MV.matches) return base.apply(this, arguments);
    pagina();
    // Si llega algo en vivo mientras edita, la pantalla de editar no se repinta (perdería lo escrito).
    if (ctm.ficha != null && !ctm.edit) pintarFicha();
    if (ctm.hojaFiltros) pintarFiltros();
  };
  const renderAntes = render;
  render = function(){
    const r = renderAntes.apply(this, arguments);
    // Fuera de Contactos (abrió la conversación) o en escritorio no queda nada de esta página encima.
    if (st.pagina !== 'contactos' || !MV.matches) { if (ctm.ficha != null || ctm.edit) { ctm.ficha = null; ctm.edit = null; mvCerrarPantalla(); } if (ctm.hojaFiltros) ctm.hojaFiltros.cerrar(); }
    return r;
  };
  const alCambiar = () => { if (st.pagina === 'contactos') render(); };
  if (MV.addEventListener) MV.addEventListener('change', alCambiar); else MV.addListener(alCambiar);

  /* ── Guardar cambios de un contacto: con conversación van por ella (80-datos.js manda el PATCH), sin ella por CT_EXTRA. ── */
  function aplicar(id, cambios){
    const cv = CONV.find(x => x.id === id);
    if (cv) {
      if ('etapa' in cambios || 'asig' in cambios || 'tags' in cambios) ctCambiar(id, o => { for (const k of ['etapa', 'asig', 'tags']) if (k in cambios) o[k] = cambios[k]; });
      if ('n' in cambios) cv.n = cambios.n;
      if ('tel' in cambios) cv.tel = cambios.tel;
      if ('correo' in cambios || 'ciudad' in cambios) cv.ficha = {...(cv.ficha || {}), ...('correo' in cambios ? {correo: cambios.correo} : {}), ...('ciudad' in cambios ? {ciudad: cambios.ciudad} : {})};
      if ('producto' in cambios || 'empresa' in cambios) cv.campos = {...(cv.campos || {}), ...('producto' in cambios ? {producto: cambios.producto} : {}), ...('empresa' in cambios ? {empresa: cambios.empresa} : {})};
      if ('noContactar' in cambios) ctCambiar(id, o => { o.noContactar = cambios.noContactar; });
      if ('guardado' in cambios) ctCambiar(id, o => { o.guardado = cambios.guardado; });
    } else { const x = CT_EXTRA.find(y => y.id === id); if (x) Object.assign(x, cambios); }
    render();
  }

  /* ── Elegir etapa, asesor, etiquetas o producto (para uno o para la selección) ── */
  const opsEtapa = () => etapas().map(e => ({v: e, t: e, pre: dot(COL[e])}));
  const opsAsesor = () => [{v: '', t: 'Sin asignar'}, ...ASESORES.map(a => ({v: a, t: a, pre: `<span class="mv-ase"><span class="m" style="background:${colorPersona(a)}">${esc(ini(a))}</span></span>`}))];
  const opsTag = () => ETIQS.map(([n]) => ({v: n, t: n, pre: dot(ETIQ_COL[n])}));
  const opsProducto = () => [{v: '', t: 'Sin producto'}, ...[...CATALOGO.map(x => x.p), ...FALTANTES].map(p => ({v: p, t: p}))];
  function elegir(campo, actual, alElegir){
    if (campo === 'etapa') mvOpciones({titulo: 'Etapa', opciones: opsEtapa(), actual, alElegir});
    else if (campo === 'asig') mvOpciones({titulo: 'Asesor', opciones: opsAsesor(), actual: actual || '', alElegir: v => alElegir(v || null)});
    else if (campo === 'tags') mvOpciones({titulo: 'Etiquetas', opciones: opsTag(), actual: actual || [], multiple: true, alElegir, vacio: 'Crea etiquetas en Ajustes › Etiquetas.'});
    else if (campo === 'producto') mvOpciones({titulo: 'Producto de interés', opciones: opsProducto(), actual: actual || '', alElegir});
  }

  /* ── Hoja de Filtros: un desplegable por cada uno; lo elegido y «Limpiar todo» van adentro ── */
  function filtrosHtml(){
    const c0 = ct(), nf = Object.values(c0.f).filter(Boolean).length, ab = ctm.filtroAbierto, V = vistas();
    const vAct = V.find(x => x[0] === c0.vista) || V[0];
    const dd = (k, lab, valorHtml, puesto, lista) => `<div class="mv-dd${puesto ? ' puesto' : ''}${ab === k ? ' abierto' : ''}"><span class="mv-lab">${esc(lab)}</span>
      <div class="mv-campo"><button type="button" class="mv-campo-b" data-ctf-abrir="${k}" aria-expanded="${ab === k}">${valorHtml}${I('chev')}</button>${puesto && k !== 'vista' ? `<button type="button" class="mv-qx" data-ctf-quitar="${k}" aria-label="Quitar el filtro ${esc(lab)}">${mvIc('x')}</button>` : ''}</div>
      ${ab === k ? `<div class="mv-dlist" role="listbox">${lista}</div>` : ''}</div>`;
    const op = (attr, on, pre, t, n) => `<button type="button" class="mv-op${on ? ' on' : ''}" role="option" aria-selected="${on}" ${attr}>${pre}<span class="t">${esc(t)}</span>${n != null ? `<span class="n">${n}</span>` : ''}${on ? mvIc('ok', 'mv-i ok') : ''}</button>`;
    const vista = dd('vista', 'Vista', `<span class="v">${esc(vAct[1])}</span><span class="n">${vAct[2]}</span>`, c0.vista !== 'todos',
      V.map(([v, t, n]) => op(`data-ctf-vista="${esc(v)}"`, c0.vista === v, '', t, n)).join(''));
    const resto = FILTROS_MV.map(([k, lab, todos]) => { const val = c0.f[k], ops = opsFiltro(k);
      return dd(k, lab, val ? `<span class="v">${preFiltro(k, val)}${esc(etiquetaFiltro(k, val))}</span>` : `<span class="v gris">${esc(todos)}</span>`, !!val,
        op(`data-ctf-val="${k}::"`, !val, '', todos) + (ops.length ? ops.map(v => op(`data-ctf-val="${esc(k)}::${esc(v)}"`, val === v, preFiltro(k, v), etiquetaFiltro(k, v))).join('') : '<p class="mv-nada">No hay opciones todavía.</p>')); }).join('');
    const n = ctVisibles().length, hay = nf || c0.vista !== 'todos';
    return `${mvCabHoja('Filtros', `${nf ? `<span class="mv-tag">${nf} ${nf === 1 ? 'puesto' : 'puestos'}</span>` : ''}${hay ? '<button type="button" class="mv-limpiar" data-ctf-limpiar>Limpiar todo</button>' : ''}`)}
      <div class="mv-hcuerpo"><div class="mv-dds">${vista}${resto}</div></div>
      <div class="mv-hpie"><button type="button" class="mv-btn negro" data-mvh-cerrar>Ver ${conteo(n)}</button></div>`;
  }
  function pintarFiltros(){ if (ctm.hojaFiltros) ctm.hojaFiltros.pintar(filtrosHtml()); }
  function abrirFiltros(){
    ctm.filtroAbierto = null;
    ctm.hojaFiltros = mvHoja(filtrosHtml(), {etiqueta: 'Filtros', alCerrar: () => { ctm.hojaFiltros = null; }});
    ctm.hojaFiltros.el.addEventListener('click', e => {
      const t = e.target instanceof Element ? e.target : null; if (!t) return;
      const c0 = ct(); let b;
      if (b = t.closest('[data-ctf-abrir]')) { const k = b.dataset.ctfAbrir; ctm.filtroAbierto = ctm.filtroAbierto === k ? null : k; pintarFiltros(); return; }
      if (b = t.closest('[data-ctf-vista]')) { c0.vista = b.dataset.ctfVista; c0.sel.clear(); ctm.filtroAbierto = null; render(); return; }
      if (b = t.closest('[data-ctf-val]')) { const s = b.dataset.ctfVal, i = s.indexOf('::'), k = s.slice(0, i), v = s.slice(i + 2); if (v) c0.f[k] = v; else delete c0.f[k]; c0.sel.clear(); ctm.filtroAbierto = null; render(); return; }
      if (b = t.closest('[data-ctf-quitar]')) { delete c0.f[b.dataset.ctfQuitar]; c0.sel.clear(); render(); return; }
      if (t.closest('[data-ctf-limpiar]')) { c0.f = {}; c0.vista = 'todos'; c0.sel.clear(); ctm.filtroAbierto = null; render(); }
    });
  }

  /* ── Acciones del ⋯ ── */
  function acciones(id){
    const c = busca(id); if (!c) return;
    const h = mvHoja(`<div class="mv-hcab"><span class="mv-asa"></span><div class="mv-quien"><span class="mv-av" style="background:${colorPersona(c.n)}">${esc(ini(c.n))}</span><span><b>${esc(c.n)}</b><small>${esc(c.tel || c.correo || '')}</small></span></div></div>
      <div class="mv-acc">
        ${c.conv ? `<button type="button" data-ctma="abrir">${I('chat')}Abrir conversación</button>` : `<button type="button" data-ctma="escribir">${I('wa')}Escribir por WhatsApp</button>`}
        <button type="button" data-ctma="ficha">${I('user')}Ver ficha</button>
        <button type="button" data-ctma="editar">${mvIc('lapiz')}Editar contacto</button>
        <button type="button" data-ctma="etapa">${I('flow')}Cambiar etapa</button>
        <button type="button" data-ctma="asig">${I('user')}Asignar asesor</button>
        <button type="button" data-ctma="tags">${I('tag')}Agregar etiqueta</button>
        ${c.guardado === false ? `<button type="button" data-ctma="agregar">${I('user-plus')}Agregar a contactos</button>` : ''}
        <hr>
        <button type="button" class="${c.noContactar ? '' : 'pel'}" data-ctma="nocont">${I('block')}${c.noContactar ? 'Quitar de no contactar' : 'Marcar no contactar'}</button>
        ${c.spam ? `<button type="button" data-ctma="nospam">${I('shield-x')}Sacar de spam</button>` : c.conv ? `<button type="button" class="pel" data-ctma="spam">${mvIc('x')}Mover a spam</button>` : ''}
      </div>`, {etiqueta: 'Opciones de ' + c.n});
    h.el.addEventListener('click', e => { const b = e.target instanceof Element && e.target.closest('[data-ctma]'); if (!b) return; h.cerrar(); accion(id, b.dataset.ctma); });
  }
  function accion(id, a){
    const c = busca(id); if (!c) return;
    if (a === 'abrir') { cerrarTodo(); ctAbrirConv(id); }
    else if (a === 'escribir') { cerrarTodo(); ctEscribir(id); }
    else if (a === 'ficha') abrirFicha(id);
    else if (a === 'editar') abrirEditar(id);
    else if (a === 'etapa') elegir('etapa', c.etapa, v => { aplicar(id, {etapa: v}); toast(`${c.n} pasó a «${v}»`); });
    else if (a === 'asig') elegir('asig', c.asig, v => { aplicar(id, {asig: v}); toast(v ? `${c.n} quedó con ${v}` : `${c.n} quedó sin asesor`); });
    else if (a === 'tags') elegir('tags', c.tags, v => { aplicar(id, {tags: v}); toast('Etiquetas guardadas'); });
    else if (a === 'producto') elegir('producto', c.producto, v => { aplicar(id, {producto: v}); toast('Producto guardado'); });
    else if (a === 'agregar') { aplicar(id, {guardado: true}); toast('Agregado a contactos'); }
    else if (a === 'nocont') { const ahora = !c.noContactar; aplicar(id, {noContactar: ahora}); toast(ahora ? 'Marcado como no contactar: no le llegan difusiones ni recordatorios' : 'Ya se le puede volver a escribir'); }
    else if (a === 'nospam') mjSacarDeSpam(id);
    else if (a === 'spam') { const cv = CONV.find(x => x.id === id); if (cv && window.mjDlgSpam) { cerrarTodo(); window.mjDlgSpam(cv); } }
  }
  function cerrarTodo(){ mvCerrarHojas(); ctm.ficha = null; ctm.edit = null; mvCerrarPantalla(); }

  /* ── Ficha a pantalla completa ── */
  function abrirFicha(id){ ctm.ficha = id; ctm.edit = null; pintarFicha(); }
  function pintarFicha(){
    const c = busca(ctm.ficha); if (!c) { ctm.ficha = null; mvCerrarPantalla(); return; }
    const flecha = I('chev'), gris = t => `<b class="gris">${esc(t)}</b>`;
    const fila = (lab, valor, accion2) => accion2 ? `<button type="button" class="mv-f" data-ctma="${accion2}"><span>${esc(lab)}</span>${valor}${flecha}</button>` : `<div class="mv-f"><span>${esc(lab)}</span>${valor}</div>`;
    const tags = (c.tags || []).length ? `<b>${c.tags.map(t => `<span class="mv-tag2"><i style="background:${esc(colorOk(ETIQ_COL[t] || '#9ca3af'))}"></i>${esc(t)}</span>`).join('')}</b>` : gris('Sin etiquetas');
    const cuotas = c.cuotas ? (c.cuotas[0] < c.cuotas[1] ? `${c.cuotas[0]} de ${c.cuotas[1]} pagadas` : 'Al día') : '';
    mvPantalla(`<div class="mv-ptop"><button type="button" class="mv-pb" data-ctmf="volver" aria-label="Volver a contactos">${mvIc('atras')}</button><button type="button" class="mv-pb" data-ctma="editar" aria-label="Editar contacto">${mvIc('lapiz')}</button></div>
      <div class="mv-pcuerpo">
        <div class="ctm-fcab"><span class="mv-av" style="background:${colorPersona(c.n)}">${esc(ini(c.n))}</span><h3>${esc(c.n)}</h3>
          ${c.tel ? `<span class="ctm-tel">${esc(c.tel)}<button type="button" data-ctmf="copiar" aria-label="Copiar número">${mvIc('copiar')}</button></span>` : ''}
          ${c.etapa ? etapaHtml(c.etapa) : ''}${c.guardado === false ? '<span class="ctm-nota">Todavía no está en contactos</span>' : ''}</div>
        <div class="ctm-facc${c.conv ? '' : ' uno'}">${c.conv ? `<button type="button" class="pri" data-ctma="abrir">${I('chat')}Conversación</button>` : ''}<button type="button" data-ctma="escribir">${I('wa', 'i wa')}WhatsApp</button></div>
        <div class="mv-sec"><h4>Venta</h4><div class="mv-filas">
          ${fila('Etapa', c.etapa ? `<b>${etapaHtml(c.etapa)}</b>` : gris('Sin etapa'), 'etapa')}
          ${fila('Asesor', `<b>${asesorHtml(c.asig)}</b>`, 'asig')}
          ${fila('Etiquetas', tags, 'tags')}
          ${fila('Producto', c.producto ? `<b>${esc(c.producto)}</b>` : gris('Sin producto'), 'producto')}
          ${fila('Cuotas', cuotas ? `<b>${esc(cuotas)}</b>` : gris('Sin compras'))}
        </div></div>
        <div class="mv-sec"><h4>Datos</h4><div class="mv-filas">
          ${fila('Correo', c.correo ? `<b>${esc(c.correo)}</b>` : gris('Sin correo'))}
          ${fila('Empresa', c.empresa ? `<b>${esc(c.empresa)}</b>` : gris('Sin empresa'))}
          ${fila('Ciudad', c.ciudad ? `<b>${esc(c.ciudad)}</b>` : gris('Sin ciudad'))}
          ${fila('Origen', `<b>${esc(c.origen || origenDe(c))}</b>`)}
          ${fila('Último mensaje', `<b>${esc(ctFecha(c.ultimoDias))}</b>`)}
          ${fila('Agregado', `<b>${esc(ctFecha(c.agregadoDias))}</b>`)}
        </div></div>
        <div class="mv-acc ctm-peligro">
          <button type="button" class="${c.noContactar ? '' : 'pel'}" data-ctma="nocont">${I('block')}${c.noContactar ? 'Quitar de no contactar' : 'Marcar no contactar'}</button>
          ${c.spam ? `<button type="button" data-ctma="nospam">${I('shield-x')}Sacar de spam</button>` : c.conv ? `<button type="button" class="pel" data-ctma="spam">${mvIc('x')}Mover a spam</button>` : ''}
        </div>
      </div>`, 'ctm-ficha');
  }

  /* ── Editar (o agregar) a pantalla completa ── */
  function abrirEditar(id){
    const c = id != null ? busca(id) : null;
    const p = partirTel(c ? c.tel : '');
    ctm.edit = {id: c ? c.id : null, n: c ? c.n : '', pais: p.pais.iso, num: c ? (c.tel && !String(c.tel).startsWith('+') ? String(c.tel).trim() : p.numero) : '', correo: c ? c.correo || '' : '',
      empresa: c ? c.empresa || '' : '', ciudad: c ? c.ciudad || '' : '', etapa: c ? c.etapa || '' : (etapasActivas()[0] || ''), asig: c ? c.asig || '' : '', tags: c ? [...(c.tags || [])] : [], producto: c ? c.producto || '' : ''};
    pintarEditar();
  }
  const leerEditar = () => { const d = ctm.edit; if (!d) return; for (const [k, idc] of [['n', 'ctme-n'], ['num', 'ctme-tel'], ['correo', 'ctme-correo'], ['empresa', 'ctme-empresa'], ['ciudad', 'ctme-ciudad']]) { const el = document.getElementById(idc); if (el) d[k] = el.value; } };
  function pintarEditar(){
    const d = ctm.edit, pais = PAISES_TEL.find(x => x.iso === d.pais) || PAISES_TEL[0];
    const sel = (campo, lab, valor) => `<div class="mv-c"><span class="mv-lab2">${esc(lab)}</span><div class="mv-in"><button type="button" class="mv-campo-b" data-ctme="${campo}">${valor}${I('chev')}</button></div></div>`;
    const inp = (idc, lab, val, extra = '') => `<div class="mv-c"><label for="${idc}">${esc(lab)}</label><div class="mv-in"><input id="${idc}" value="${esc(val)}" autocomplete="off" ${extra}></div></div>`;
    const tags = d.tags.length ? `<span class="v">${d.tags.map(t => `<span class="mv-tag2"><i style="background:${esc(colorOk(ETIQ_COL[t] || '#9ca3af'))}"></i>${esc(t)}</span>`).join('')}</span>` : '<span class="v gris">Sin etiquetas</span>';
    mvPantalla(`<div class="mv-ptop linea"><button type="button" class="mv-pb rojo" data-ctme="cancelar" aria-label="Cancelar">${mvIc('x')}</button><b>${d.id != null ? 'Editar contacto' : 'Agregar contacto'}</b><button type="button" class="mv-pb si" data-ctme="guardar" aria-label="Guardar">${mvIc('ok')}</button></div>
      <div class="mv-pcuerpo" style="padding-top:16px">
        ${d.id != null ? `<div class="ctm-efoto"><span class="mv-av" style="background:${colorPersona(d.n || '?')}">${esc(ini(d.n || '?'))}</span></div>` : ''}
        <div class="mv-form"><h4>Contacto</h4>
          ${inp('ctme-n', 'Nombre y apellido', d.n, 'placeholder="Ej. Valentina Ruiz" autocapitalize="words"')}
          <div class="mv-c"><label for="ctme-tel">Celular</label><div class="mv-in"><button type="button" class="mv-pais" data-ctme="pais" aria-label="País: ${esc(pais.nombre)}">${banderaTel(pais.iso)}<span>+${esc(pais.indicativo)}</span>${I('chev')}</button><input id="ctme-tel" inputmode="tel" value="${esc(d.num)}" placeholder="300 123 4567" autocomplete="off"></div></div>
          ${inp('ctme-correo', 'Correo', d.correo, 'type="email" inputmode="email" placeholder="correo@ejemplo.com"')}
          <div class="mv-dos">${inp('ctme-empresa', 'Empresa', d.empresa, 'placeholder="Opcional"')}${inp('ctme-ciudad', 'Ciudad', d.ciudad, 'placeholder="Ej. Bucaramanga"')}</div>
        </div>
        <div class="mv-form"><h4>Venta</h4>
          ${sel('etapa', 'Etapa', d.etapa ? `<span class="v">${dot(COL[d.etapa])}${esc(d.etapa)}</span>` : '<span class="v gris">Elige una etapa</span>')}
          ${sel('asig', 'Asesor', d.asig ? `<span class="v">${asesorHtml(d.asig)}</span>` : '<span class="v gris">Sin asignar</span>')}
          ${sel('tags', 'Etiquetas', tags)}
          ${sel('producto', 'Producto de interés', d.producto ? `<span class="v">${esc(d.producto)}</span>` : '<span class="v gris">Elige un producto</span>')}
        </div>
      </div>`, 'ctm-editar');
  }
  function guardarEditar(){
    leerEditar(); const d = ctm.edit, pais = PAISES_TEL.find(x => x.iso === d.pais) || PAISES_TEL[0];
    const n = d.n.trim().replace(/\s+/g, ' '), dig = d.num.replace(/\D/g, '');
    if (!n) { toast('Escribe el nombre'); document.getElementById('ctme-n').focus(); return; }
    if (d.id == null && n.split(' ').length < 2) { toast('Escribe nombre y apellido'); document.getElementById('ctme-n').focus(); return; }
    if (dig.length < 7) { toast('Escribe el celular completo'); document.getElementById('ctme-tel').focus(); return; }
    const correo = d.correo.trim();
    if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) { toast('Ese correo no se ve bien'); document.getElementById('ctme-correo').focus(); return; }
    const tel = unirTel(pais, d.num.trim()), d10 = dig.slice(-10);
    const ya = ctTodos().find(x => x.id !== d.id && String(x.tel || '').replace(/\D/g, '').slice(-10) === d10);
    if (ya) { toast(`Ese celular ya está en contactos: ${ya.n}`); document.getElementById('ctme-tel').focus(); return; }
    const datos = {n, tel, correo, empresa: d.empresa.trim(), ciudad: d.ciudad.trim(), etapa: d.etapa, asig: d.asig || null, tags: d.tags, producto: d.producto};
    if (d.id == null) {
      CT_EXTRA.unshift({id: -Date.now(), ...datos, canal: 'wa', origen: 'Agregado a mano', cuotas: null, ultimoDias: 0, agregadoDias: 0, recien: Date.now()});
      ctm.edit = null; mvCerrarPantalla(); ct().vista = 'todos'; ct().orden = {k: 'agregado', dir: 1}; render(); toast(`${n} quedó en contactos`); return;
    }
    const c = busca(d.id); if (!c) { ctm.edit = null; mvCerrarPantalla(); return; }
    const cambios = {};
    for (const k of ['n', 'tel', 'correo', 'empresa', 'ciudad', 'etapa', 'asig', 'producto']) if ((c[k] || '') !== (datos[k] || '')) cambios[k] = datos[k];
    if (JSON.stringify(c.tags || []) !== JSON.stringify(datos.tags)) cambios.tags = datos.tags;
    const id = d.id; ctm.edit = null;
    if (Object.keys(cambios).length) { aplicar(id, cambios); toast('Cambios guardados'); }
    if (ctm.ficha === id) pintarFicha(); else mvCerrarPantalla();
  }

  /* ── Clics ── */
  mvPresionLarga('[data-ctm-fila]', f => { if (st.pagina !== 'contactos') return; ct().sel.add(+f.dataset.ctmFila); render(); });
  document.addEventListener('click', e => {
    if (st.pagina !== 'contactos' || !MV.matches) return;
    const t = e.target instanceof Element ? e.target : null; if (!t) return;
    const c0 = ct(); let b;
    // Pantalla completa (ficha o editar).
    if (t.closest('#mv-pant')) {
      if (b = t.closest('[data-ctmf]')) {
        const a = b.dataset.ctmf;
        if (a === 'volver') { ctm.ficha = null; mvCerrarPantalla(); }
        else if (a === 'copiar') { const c = busca(ctm.ficha); if (c && c.tel) navigator.clipboard.writeText(c.tel).then(() => toast('Número copiado'), () => toast(c.tel)); }
        return;
      }
      if (b = t.closest('[data-ctme]')) {
        const a = b.dataset.ctme, d = ctm.edit; if (!d) return;
        if (a === 'cancelar') { ctm.edit = null; if (ctm.ficha != null) pintarFicha(); else mvCerrarPantalla(); return; }
        if (a === 'guardar') { guardarEditar(); return; }
        leerEditar();
        if (a === 'pais') mvElegirPais(d.pais, p => { d.pais = p.iso; pintarEditar(); const i = document.getElementById('ctme-tel'); if (i) i.focus(); });
        else elegir(a, d[a], v => { d[a] = a === 'asig' ? (v || '') : v; pintarEditar(); });
        return;
      }
      if (b = t.closest('[data-ctma]')) { if (ctm.ficha != null) accion(ctm.ficha, b.dataset.ctma); }
      return;
    }
    if (!t.closest('#page')) return;
    if (b = t.closest('[data-ctm]')) {
      const a = b.dataset.ctm;
      if (a === 'filtros') abrirFiltros();
      else if (a === 'nuevo') abrirEditar(null);
      else if (a === 'orden') mvOpciones({titulo: 'Ordenar por', opciones: [{v: 'ultimo', t: 'Último mensaje'}, {v: 'n', t: 'Nombre'}, {v: 'agregado', t: 'Fecha en que se agregó'}], actual: c0.orden.k, buscar: false, alElegir: k => { c0.orden = {k, dir: 1}; render(); }});
      return;
    }
    if (b = t.closest('[data-ctm-mas]')) { e.stopPropagation(); acciones(+b.dataset.ctmMas); return; }
    if (b = t.closest('[data-ctm-bulk]')) {
      const k = b.dataset.ctmBulk, ids = [...c0.sel], n = ids.length;
      const fin = msg => { c0.sel.clear(); render(); toast(msg); };
      if (k === 'asig') elegir('asig', null, a => { ids.forEach(id => ctCambiar(id, x => { x.asig = a; })); fin(a ? `${n} ${n === 1 ? 'contacto asignado' : 'contactos asignados'} a ${a}` : `${n} ${n === 1 ? 'contacto quedó' : 'contactos quedaron'} sin asesor`); });
      else if (k === 'etapa') elegir('etapa', null, et => { ids.forEach(id => ctCambiar(id, x => { x.etapa = et; })); fin(`${n} ${n === 1 ? 'contacto pasó' : 'contactos pasaron'} a «${et}»`); });
      else if (k === 'tag') mvOpciones({titulo: 'Agregar etiqueta', opciones: opsTag(), alElegir: tg => { ids.forEach(id => ctCambiar(id, x => { if (!(x.tags || []).includes(tg)) x.tags = [...(x.tags || []), tg]; })); fin(`Etiqueta «${tg}» agregada a ${n} ${n === 1 ? 'contacto' : 'contactos'}`); }, vacio: 'Crea etiquetas en Ajustes › Etiquetas.'});
      return;
    }
    if (b = t.closest('[data-ctm-fila]')) {
      if (mvFueLarga()) return;
      const id = +b.dataset.ctmFila;
      if (c0.sel.size) { c0.sel.has(id) ? c0.sel.delete(id) : c0.sel.add(id); render(); return; }
      abrirFicha(id);
    }
  });
  document.addEventListener('keydown', e => {
    if (st.pagina !== 'contactos' || !MV.matches || !(e.target instanceof Element)) return;
    const f = e.target.closest('[data-ctm-fila]'); if (f && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); f.click(); }
    if (e.key === 'Escape' && !MV_HOJAS.length && document.getElementById('mv-pant')) { if (ctm.edit) { ctm.edit = null; if (ctm.ficha != null) { pintarFicha(); return; } } ctm.ficha = null; mvCerrarPantalla(); }
  });

  document.head.insertAdjacentHTML('beforeend', `<style>
.ctm{display:flex;flex-direction:column;gap:clamp(10px,3vw,14px);width:100%;max-width:640px;margin:0 auto}
.ctm-cab h2{margin:0;font-size:clamp(18px,5.4vw,22px);font-weight:700;letter-spacing:-.01em}
.ctm-cab p{margin:2px 0 0;font-size:13px;color:var(--mv-t3)}
.ctm-cab .cj-pgh + p{margin-left:36px}
.ctm-hueco{height:64px}
.ctm-fcab{display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center;padding:4px 0 2px}
.ctm-fcab .mv-av{width:72px;height:72px;font-size:24px;margin-bottom:8px}
.ctm-fcab h3{margin:0;font-size:20px;font-weight:700;overflow-wrap:anywhere}
.ctm-tel{display:inline-flex;align-items:center;gap:4px;margin-right:-34px;font-size:14px;color:var(--mv-t3);font-variant-numeric:tabular-nums}
.ctm-tel button{width:34px;height:34px;border:0;background:none;border-radius:8px;display:grid;place-items:center;color:var(--mv-t3);cursor:pointer;padding:0}
.ctm-tel button .mv-i{width:16px;height:16px}
.ctm-fcab .mv-pill{margin-top:6px;font-size:12.5px;padding:4px 10px}
.ctm-nota{margin-top:4px;font-size:12.5px;color:var(--mv-t3)}
.ctm-facc{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ctm-facc.uno{grid-template-columns:1fr}
.ctm-facc button{height:62px;border-radius:13px;border:1px solid var(--mv-linea);background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;font:inherit;font-size:12.5px;font-weight:500;color:var(--mv-tinta);cursor:pointer}
.ctm-facc button svg{width:19px;height:19px}
.ctm-facc button.pri{background:var(--mv-amarillo);border-color:var(--mv-amarillo);font-weight:600}
.ctm-peligro{background:#fff;border:1px solid var(--mv-linea);border-radius:14px;padding:4px 6px}
.ctm-efoto{display:flex;justify-content:center}
.ctm-efoto .mv-av{width:64px;height:64px;font-size:21px}
</style>`);
})();
