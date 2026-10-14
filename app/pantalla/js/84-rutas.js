/* ── Cada módulo con su dirección (14-oct) ──
   La pantalla vivía solo en memoria: al recargar volvía a la bandeja y se perdía dónde estaba la persona. Ahora la
   dirección dice qué se ve, después de un «#»:
   · #/bandeja/<mias|todas|sin|menciones>/<conversación>?carpeta=…&equipo=…&etq=…&linea=…&est=…
   · #/ajustes/<cuenta|crm>, #/ajustes/<sección> (las páginas cfg-…) y #/<página> para lo demás (contactos, embudo…).
   Recargar abre lo mismo, el enlace se puede compartir y «atrás» del navegador vuelve al módulo anterior. Cambiar de
   módulo suma un paso al historial; cambiar de conversación o de filtro dentro del mismo módulo solo reescribe la dirección.
   Si el CRM está dentro del marco de la plataforma, la dirección que cambia es la de la pestaña (window.top). ── */
(() => {
  let W = window;
  try { if (window.top !== window && window.top.location.href) W = window.top; } catch { W = window; }
  const FILTROS = [['carpeta', 'carpeta'], ['equipo', 'equipo'], ['etq', 'etq'], ['linea', 'linea']];
  const VISTAS = ['mias', 'todas', 'sin'];

  function rutaDeEstado(){
    if (st.pagina) {
      if (st.pagina === 'ajustes') return `ajustes/${st.ajTab === 'crm' ? 'crm' : 'cuenta'}`;
      return st.pagina.startsWith('cfg-') ? `ajustes/${st.pagina.slice(4)}` : st.pagina;
    }
    const partes = ['bandeja', st.menciones ? 'menciones' : (VISTAS.includes(st.vista) ? st.vista : 'mias')];
    if (st.sel) partes.push(String(st.sel));
    const q = new URLSearchParams();
    for (const [k, p] of FILTROS) if (st[k]) q.set(p, st[k]);
    if (st.est && st.est !== 'abiertas') q.set('est', st.est);
    const qs = q.toString();
    return partes.join('/') + (qs ? `?${qs}` : '');
  }
  const leerRuta = () => { try { return decodeURIComponent(String(W.location.hash || '').replace(/^#\/?/, '')); } catch { return ''; } };
  // El módulo de una ruta (sin la conversación ni los filtros): cambiarlo suma un paso al historial.
  const modulo = r => { const p = String(r).split('?')[0].split('/'); return p[0] === 'bandeja' ? `bandeja/${p[1] || ''}` : p.slice(0, 2).join('/'); };

  /** Pone en `st` lo que dice la dirección. false si no dice nada que se pueda abrir. */
  function aplicar(ruta){
    if (!ruta) return false;
    const [camino, qs] = ruta.split('?'), p = camino.split('/').filter(Boolean), q = new URLSearchParams(qs || '');
    if (!p.length || p.some(x => !/^[a-z0-9-]{1,40}$/.test(x))) return false;
    if (p[0] === 'bandeja') {
      st.pagina = ''; st.menciones = p[1] === 'menciones';
      if (VISTAS.includes(p[1])) st.vista = p[1];
      for (const [k, n] of FILTROS) st[k] = q.get(n) || '';
      st.est = q.get('est') || 'abiertas';
      const id = +p[2]; if (id > 0) st.sel = id;
      return true;
    }
    if (p[0] === 'ajustes') {
      if (!p[1] || p[1] === 'cuenta' || p[1] === 'crm') { st.pagina = 'ajustes'; st.ajTab = p[1] === 'crm' ? 'crm' : 'cuenta'; }
      else st.pagina = `cfg-${p[1]}`;
      return true;
    }
    st.pagina = p[0];
    return true;
  }

  let lista = false, aplicando = false;
  function sincronizar(){
    if (!lista || aplicando) return;
    const nueva = rutaDeEstado(), vieja = leerRuta();
    if (nueva === vieja) return;
    const url = `${W.location.pathname}${W.location.search}#/${nueva}`;
    try { W.history[modulo(nueva) !== modulo(vieja) ? 'pushState' : 'replaceState'](W.history.state, '', url); } catch { /* sin historial: queda como antes */ }
  }

  // Lo que pida la dirección se aplica antes de que lleguen los datos: el primer pintado ya abre ese módulo.
  aplicar(leerRuta());
  const renderBase = render;
  render = function(...a){ const r = renderBase.apply(this, a); sincronizar(); return r; };
  crmListo.then(() => { lista = true; sincronizar(); });

  // «Atrás» y «adelante» del navegador, o una dirección pegada en la misma pestaña.
  const alCambiar = () => {
    if (!lista || leerRuta() === rutaDeEstado()) return;
    aplicando = true;
    try { if (aplicar(leerRuta())) renderBase(); } finally { aplicando = false; }
  };
  W.addEventListener('popstate', alCambiar);
  W.addEventListener('hashchange', alCambiar);
})();
