/* ── Ayuda de Wali (maqueta aprobada «AyudaWali») ──
   Un asistente propio, sin IA y sin costo por pregunta: busca en las guías (89-ayuda-guias.js) en el navegador.
   · La burbuja amarilla abajo a la derecha, en todas las pantallas. Al abrirla: preguntas de la pantalla en la que estás
     y lo más buscado.
   · Entiende errores de escritura y palabras de la calle: normaliza tildes y mayúsculas, cambia sinónimos («wasap» →
     whatsapp) y compara cada palabra con las de las guías por distancia de edición; las palabras raras pesan más que las
     comunes (idf). Responde con los pasos, «Llevarme ahí», «¿Te sirvió?» y guías relacionadas.
   · Si no entiende: las 3 más parecidas y soporte (correo). La pregunta queda guardada para escribir guías nuevas
     (POST /crm/ayuda/sin-respuesta).
   · «Llevarme ahí» abre la pantalla, oscurece el resto y señala dónde tocar.
   Lo propio lleva «ay-». */
(() => {
  const SOPORTE = {correo: 'nexcode97@gmail.com', whatsapp: ''};
  const SV = d => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const IC = {
    ayuda: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-2.9 2.6-2.9 4"/><path d="M12 17.5h.01" stroke-width="2.6"/></svg>',
    x: SV('<path d="M6 6l12 12M18 6 6 18"/>'), buscar: SV('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'), enviar: SV('<path d="M4 12h15M13 6l6 6-6 6"/>'),
    chev: SV('<path d="m9 6 6 6-6 6"/>'), reloj: SV('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'), mas: SV('<path d="M12 5v14M5 12h14"/>'), flecha: SV('<path d="M7 17 17 7M9 7h8v8"/>'), atras: SV('<path d="m15 6-6 6 6 6"/>'),
    si: SV('<path d="M7 11v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3Zm0 0 4-7a2 2 0 0 1 2 2v4h5a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 16.8 20H7"/>'),
    no: SV('<path d="M17 13V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-3Zm0 0-4 7a2 2 0 0 1-2-2v-4H6a2 2 0 0 1-2-2.3l1.2-6A2 2 0 0 1 7.2 4H17"/>'),
    persona: SV('<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-3.5 3.8-5.5 7-5.5s6 2 7 5.5"/>'), correo: SV('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
    libro: SV('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>'), rep: SV('<path d="M16 3h5v5M21 3l-7 7M8 21H3v-5M3 21l7-7"/>'),
  };
  // La cara del astronauta del inicio de sesión, plana y con su parpadeo (maqueta aprobada «astronauta, volver e historial»).
  const ASTRO = '<svg class="ay-astro" viewBox="92 4 216 216" aria-hidden="true"><g stroke="#14142a" stroke-width="8" stroke-linejoin="round"><path d="M238 52 L256 24" fill="none" stroke-linecap="round"/><circle class="antena" cx="258" cy="21" r="10" fill="#FFD21F"/><circle cx="116" cy="132" r="16" fill="#7c3aed"/><circle cx="284" cy="132" r="16" fill="#7c3aed"/><circle cx="200" cy="128" r="84" fill="#fff"/><rect x="134" y="88" width="132" height="90" rx="42" fill="#1e1b4b"/><g class="ojos" stroke="none"><rect x="170" y="119" width="16" height="26" rx="8" fill="#FFD21F"/><rect x="214" y="119" width="16" height="26" rx="8" fill="#FFD21F"/></g><path d="M150 112 Q166 97 190 94" fill="none" stroke="#FFD21F" stroke-width="7" stroke-linecap="round"/></g></svg>';
  const ISO = `<span class="ay-ast">${ASTRO}</span>`;

  /* ── El motor ── */
  const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9ñ\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const SINONIMOS = {
    wasap: 'whatsapp', guasap: 'whatsapp', whatsap: 'whatsapp', watsap: 'whatsapp', wpp: 'whatsapp', wsp: 'whatsapp', wa: 'whatsapp', whats: 'whatsapp', wasa: 'whatsapp', zap: 'whatsapp',
    chat: 'conversacion', chats: 'conversacion', conversaciones: 'conversacion', conversa: 'conversacion', convers: 'conversacion',
    mensjes: 'mensaje', mensages: 'mensaje', msj: 'mensaje', msjs: 'mensaje', mensajes: 'mensaje', sms: 'mensaje',
    clientes: 'cliente', lead: 'cliente', leads: 'cliente', prospecto: 'cliente', contactos: 'contacto',
    asesores: 'asesor', vendedor: 'asesor', vendedores: 'asesor', empleado: 'persona', empleados: 'persona', usuario: 'persona', usuarios: 'persona', compañero: 'persona',
    numero: 'linea', numeros: 'linea', lineas: 'linea', telefono: 'linea', cel: 'celular',
    template: 'plantilla', templates: 'plantilla', plantillas: 'plantilla',
    bot: 'flujo', chatbot: 'flujo', automatico: 'flujo', automatica: 'flujo', flujos: 'flujo',
    ia: 'agente', inteligencia: 'agente', chatgpt: 'agente', gpt: 'agente',
    masivo: 'difusion', masiva: 'difusion', campaña: 'difusion', broadcast: 'difusion', difusiones: 'difusion',
    borrar: 'eliminar', quitar: 'eliminar', suprimir: 'eliminar', cerrar: 'finalizar', terminar: 'finalizar',
    llegan: 'llegar', llega: 'llegar', llego: 'llegar', entra: 'llegar', entran: 'llegar',
    pagar: 'pago', pagos: 'pago', cobro: 'pago', facturas: 'factura', recibo: 'factura', recibos: 'factura', precio: 'cuesta', valor: 'cuesta', costo: 'cuesta',
    // Verbos conjugados a su forma base (lo que más se pregunta).
    creo: 'crear', crea: 'crear', cree: 'crear', creamos: 'crear', creando: 'crear', hacer: 'crear', armo: 'crear', armar: 'crear',
    agrego: 'agregar', agregue: 'agregar', añado: 'agregar', añadir: 'agregar', meto: 'agregar', meter: 'agregar', anado: 'agregar', anadir: 'agregar',
    pongo: 'poner', ponga: 'poner', pone: 'poner', mando: 'enviar', mandar: 'enviar', mande: 'enviar', envio: 'enviar', envia: 'enviar', mandan: 'enviar',
    cambio: 'cambiar', cambie: 'cambiar', modifico: 'cambiar', modificar: 'cambiar', edito: 'cambiar', editar: 'cambiar',
    paso: 'pasar', pase: 'pasar', paso: 'pasar', conecto: 'conectar', conecte: 'conectar', vinculo: 'conectar', vincular: 'conectar',
    elimino: 'eliminar', borro: 'eliminar', quito: 'eliminar', subo: 'subir', cargo: 'subir', cargar: 'subir', importo: 'subir',
    activo: 'activar', prendo: 'activar', prender: 'activar', encender: 'activar', apago: 'apagar',
    llamo: 'llamar', llamada: 'llamar', llamadas: 'llamar', llame: 'llamar', llamando: 'llamar', llamen: 'llamar',
    reparten: 'reparto', repartir: 'reparto', reparte: 'reparto', asignacion: 'reparto',
    excel: 'excel', xlsx: 'excel', csv: 'excel', instagram: 'instagram', insta: 'instagram', ig: 'instagram', face: 'facebook', fb: 'facebook',
  };
  const VACIAS = new Set('a al como con cual cuales de del donde el en es esta este esto eso hace hacer hago la las le lo los me mi mis o para pero por porque puedo pueda puede que quiero quisiera necesito se si sin su sus te tengo tu tus un una uno unos y ya hay ver hola gracias favor ayuda ayudame alguien algo cosa forma manera debo deberia quien funciona funcionar sirve servir hacen tiene tienen veo encuentro encontrar esta estan'.split(' '));
  const raiz = w => w.length > 5 && /es$/.test(w) ? w.slice(0, -2) : w.length > 4 && /s$/.test(w) ? w.slice(0, -1) : w;
  /* Grupos de palabras que en el CRM significan lo mismo: la primera de cada grupo es la que se usa para buscar. Así
     «enlazar», «meter» o «vincular» encuentran las guías que dicen «conectar». */
  const GRUPOS = [
    'conectar enlazar enlazo enlace vincular vinculo integrar integro sincronizar conecto conecte conectarlo',
    'desconectado desconecto desconectada caido caida cayo cae caer tumbo',
    'varios segundo otra otro adicional dos 2 mas',
    'difusion masivo masiva campaña promocion promo oferta ofertas todos muchos 500 1000 base',
    'rechazo rechazada rechazaron rechazar aprueban aprobaron revision paso negaron',
    'variable variables personalizar personalizado nombre',
    'automatico automatica solo sola automaticamente auto',
    'desactivar apagar apago quitar pausar detener',
    'asesor asesora vendedora vendedor agente_humano persona compañera compañero empleada',
    'entrar ingresar acceder iniciar login loguear',
    'equipo area departamento',
    'agendar agenda cita citas reserva reservas calendario',
    'informe informes estadistica estadisticas reporte reportes metrica metricas cuantas numeros',
    'exportar bajar descargar sacar',
    'importar subir cargar lista',
    'nota_voz audio audios voz grabar',
    'cancelar baja darme retirarme',
    'notificacion notificaciones alerta alertas aviso avisos sonido suena',
    'empezar arranco arrancar empiezo empezar comienzo comenzar inicio',
    'factura facturas recibo recibos comprobante',
    'equivocado equivocada mal incorrecto incorrecta error',
  ].map(g => g.split(' '));
  const GRUPO = new Map(); for (const g of GRUPOS) for (const w of g) GRUPO.set(w, g[0]);
  const palabras = t => norm(t).split(' ').filter(Boolean).map(w => SINONIMOS[w] || w).map(w => GRUPO.get(w) || w).filter(w => !VACIAS.has(w)).map(raiz);
  // Distancia de edición (con transposición), cortando apenas pasa el máximo.
  function distancia(a, b, max){
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let ant2 = null, ant = Array.from({length: b.length + 1}, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const fila = [i]; let menor = i;
      for (let j = 1; j <= b.length; j++) {
        let v = Math.min(ant[j] + 1, fila[j - 1] + 1, ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (ant2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, ant2[j - 2] + 1);
        fila.push(v); if (v < menor) menor = v;
      }
      if (menor > max) return max + 1;
      ant2 = ant; ant = fila;
    }
    return ant[b.length];
  }
  const tolerancia = n => n <= 3 ? 0 : n <= 7 ? 1 : 2;
  let INDICE = null;
  function indice(){
    if (INDICE) return INDICE;
    const docs = AYUDA_GUIAS.map(g => {
      const pesos = new Map(), suma = (txt, w) => palabras(txt).forEach(p => pesos.set(p, Math.max(pesos.get(p) || 0, w)));
      suma(g.t, 3); (g.q || []).forEach(q => suma(q, 2.5)); suma(g.a, 1); (g.p || []).forEach(p => suma(p.replace(/\*\*/g, ''), 1));
      // Las frases completas (el título y cada forma de preguntar): pesan cuando la pregunta se parece a una entera.
      const frases = [g.t, ...(g.q || [])].map(f => [...new Set(palabras(f))]).filter(f => f.length);
      return {g, pesos, frases};
    });
    const df = new Map(); docs.forEach(d => d.pesos.forEach((_, p) => df.set(p, (df.get(p) || 0) + 1)));
    const idf = new Map([...df].map(([p, n]) => [p, Math.log(1 + docs.length / n)]));
    INDICE = {docs, idf, vocab: [...df.keys()]};
    return INDICE;
  }
  // Cada palabra de la pregunta con las del vocabulario que se le parecen (exacta 1, prefijo .8, parecida .7).
  function parecidas(w, ix){
    const out = [], tol = tolerancia(w.length);
    for (const v of ix.vocab) {
      if (v === w) out.push([v, 1]);
      else if (w.length >= 4 && v.startsWith(w)) out.push([v, .8]);
      else if (tol && distancia(w, v, tol) <= tol) out.push([v, .7]);
    }
    return out;
  }
  const puedeConfig = () => typeof puedeConfigurarCrm === 'function' ? puedeConfigurarCrm() : st.rol === 'l';
  const permitida = g => g.rol !== 'admin' || puedeConfig();
  function buscar(texto){
    const ix = indice(), qs = [...new Set(palabras(texto))];
    if (!qs.length) return {lista: [], cubre: 0};
    const conjuntos = qs.map(w => parecidas(w, ix));
    const pag = paginaActual();
    const parecidaA = conjuntos.map(c => new Map(c));
    const lista = ix.docs.filter(d => permitida(d.g)).map(d => {
      let s = 0, cubiertas = 0;
      conjuntos.forEach(c => { let mejor = 0; for (const [v, sim] of c) { const w = d.pesos.get(v); if (w) mejor = Math.max(mejor, w * sim * ix.idf.get(v)); } if (mejor) { s += mejor; cubiertas++; } });
      // La frase más parecida: cuántas palabras de la pregunta están en ella y cuántas de ella en la pregunta (F1).
      let frase = 0;
      for (const f of d.frases) {
        let dentro = 0; parecidaA.forEach(m => { if (f.some(w => m.has(w))) dentro++; });
        const enF = f.filter(w => parecidaA.some(m => m.has(w))).length;
        if (dentro && enF) frase = Math.max(frase, 2 * (dentro / qs.length) * (enF / f.length) / ((dentro / qs.length) + (enF / f.length)));
      }
      s += frase * frase * 14;
      if ((d.g.pag || []).includes(pag) || d.g.ir === pag) s *= 1.15;
      // Seguimiento («¿y cómo lo borro?»): una pregunta corta se lee con el tema de la guía anterior.
      if (A.ultima && qs.length <= 3 && d.g.a === A.ultima.a) s *= 1.3;
      return {g: d.g, s, cubre: cubiertas / qs.length};
    }).filter(x => x.s > 0).sort((a, b) => b.s - a.s);
    return {lista, cubre: lista[0] ? lista[0].cubre : 0};
  }
  const entendio = r => r.lista.length && r.lista[0].s >= 4 && r.cubre >= .6 && (!r.lista[1] || r.lista[0].s >= r.lista[1].s * 1.08 || r.lista[0].cubre === 1);
  // Confianza media: responde la más probable y ofrece las otras dos («¿O buscabas…?»), sin quedarse dudando.
  const probable = r => !entendio(r) && r.lista.length && r.lista[0].s >= 6 && r.cubre >= .5;

  /* ── Dónde está la persona: sugerencias de esa pantalla ── */
  const NOMBRE_PAG = {inbox: 'Mi bandeja', todas: 'Conversaciones', contactos: 'Contactos', embudo: 'Embudo', difusiones: 'Difusiones', plantillas: 'Plantillas', informes: 'Informes', agentes: 'Agentes IA', vivo: 'Equipo en vivo', flujos: 'Flujos', reglas: 'Reglas automáticas', ajustes: 'Ajustes', 'cfg-lineas': 'Líneas de WhatsApp', 'cfg-reparto': 'Equipos y reparto', 'cfg-encuesta': 'la encuesta', 'cfg-canales': 'Canales', 'cfg-plan': 'Plan y pagos', 'cfg-primeros': 'Primeros pasos'};
  const SUG = {
    inbox: ['ventana-24', 'enviar-plantilla-chat', 'transferir'], todas: ['filtrar', 'finalizar', 'ventana-24'], contactos: ['importar', 'segmento', 'unir'], embudo: ['mover-etapa', 'etapas', 'caliente'],
    difusiones: ['crear-difusion', 'costo-whatsapp', 'limites-meta'], plantillas: ['crear-plantilla', 'plantilla-rechazada', 'encabezado'], informes: ['satisfaccion', 'por-asesor', 'exportar-informe'],
    agentes: ['crear-agente', 'ensenar-agente', 'agente-humano'], flujos: ['bienvenida', 'probar-flujo', 'flujos-equipo'], 'cfg-lineas': ['conectar-wa', 'coexistencia', 'calidad'],
    'cfg-reparto': ['invitar', 'reparto', 'nadie-disponible'], 'cfg-encuesta': ['encuesta-preguntas', 'encuesta-cuando', 'encuesta-equipo'], 'cfg-plan': ['planes', 'cambiar-plan', 'historial-pagos'],
  };
  const paginaActual = () => st.pagina || (st.vista === 'todas' ? 'todas' : 'inbox');
  const guia = id => AYUDA_GUIAS.find(g => g.id === id);

  /* ── La conversación del panel ── */
  const A = {abierto: false, items: [], vista: 'inicio', tema: null, escribiendo: false, hist: null, conv: null};
  /* Cada parte: {y: pregunta} | {g: guía, e: entendió, o: [otras]} | {c: charla (se vuelve a contestar igual)} |
     {n: pregunta sin respuesta, o: [opciones]} | {s: soporte}. Así se guardan en el historial sin HTML. */
  function parteHTML(p){
    if (p.y !== undefined) return yoBurbuja(p.y);
    if (p.g) { const g = guia(p.g); return g ? tarjeta(g, !!p.e, (p.o || []).map(guia).filter(Boolean)) : ''; }
    if (p.c !== undefined) return conversar(p.c) || '';
    if (p.n !== undefined) return noEntendio(p.n, {lista: (p.o || []).map(guia).filter(Boolean).map(g => ({g}))});
    if (p.s !== undefined) return `<div class="ay-msj bot"><span class="ay-iso pq">${ISO}</span><div class="ay-msj-c">${soporteHTML(p.s)}</div></div>`;
    return '';
  }
  const pasosHTML = p => p.map(x => `<li>${esc(x).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</li>`).join('');
  function relacionadas(g){
    const r = buscar(`${g.t} ${(g.q || []).join(' ')}`).lista.filter(x => x.g.id !== g.id && x.g.a === g.a).slice(0, 2);
    return r.length ? `<div class="ay-rel"><small>También te puede servir</small>${r.map(x => `<button type="button" data-ay-guia="${x.g.id}">${esc(x.g.t)}${IC.chev}</button>`).join('')}</div>` : '';
  }
  // Una persona no responde con la guía a secas: abre con una frase corta. Se elige por la guía, así no cambia al repintar.
  const unaDe = (lista, semilla) => { let h = 0; for (const ch of String(semilla)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return lista[h % lista.length]; };
  const ABRE_SEGURO = ['Claro, así se hace:', 'Te cuento cómo:', 'Fácil, mira:', 'Va, son estos pasos:', 'Así lo haces:', 'Listo, te explico:'];
  const ABRE_DUDA = ['Creo que te refieres a esto:', 'Si te entendí bien, es esto:', 'Me parece que buscas esto:'];
  function tarjeta(g, entendido, otras){
    A.ultima = g;
    return `<div class="ay-msj bot"><span class="ay-iso pq">${ISO}</span><div class="ay-msj-c"><p>${unaDe(entendido ? ABRE_SEGURO : ABRE_DUDA, g.id)}</p>
      <div class="ay-guia"><b>${esc(g.t)}</b><ol>${pasosHTML(g.p)}</ol>${g.ir ? `<button type="button" class="btn pri" data-ay-ir="${g.id}">Llevarme ahí${IC.flecha}</button>` : ''}</div>
      <div class="ay-util" data-ay-utilde="${g.id}"><span>¿Te sirvió?</span><button type="button" data-ay-util="${g.id}|1">${IC.si}Sí</button><button type="button" data-ay-util="${g.id}|0">${IC.no}No</button></div>
      ${otras && otras.length ? `<div class="ay-rel"><small>¿O buscabas…?</small>${otras.map(o => `<button type="button" data-ay-guia="${o.id}">${esc(o.t)}${IC.chev}</button>`).join('')}</div>` : relacionadas(g)}</div></div>`;
  }
  function soporteHTML(q){
    const asunto = encodeURIComponent('Ayuda con Wali'), cuerpo = encodeURIComponent(q ? `Hola, necesito ayuda con esto: ${q}` : 'Hola, necesito ayuda con Wali.');
    return `<div class="ay-soporte"><div class="ay-sop-t"><span class="ay-pic">${IC.persona}</span><div><b>¿Ninguna es?</b><small>Escríbele al equipo de soporte de Wali. Te responde en horario hábil.</small></div></div>
      <div class="ay-sop-b"><a class="btn" href="mailto:${SOPORTE.correo}?subject=${asunto}&body=${cuerpo}">${IC.correo}Correo</a>${SOPORTE.whatsapp ? `<a class="btn ay-wa" href="https://wa.me/${SOPORTE.whatsapp}?text=${cuerpo}" target="_blank" rel="noopener noreferrer">${LOGO.wa}WhatsApp</a>` : ''}</div></div>`;
  }
  function noEntendio(q, r){
    const ops = r.lista.slice(0, 3);
    return `<div class="ay-msj bot"><span class="ay-iso pq">${ISO}</span><div class="ay-msj-c"><p>${ops.length ? unaDe(['Mmm, no estoy seguro de haberte entendido. ¿Es alguna de estas?', 'No sé si te entendí bien. ¿Buscabas alguna de estas?'], q) : unaDe(['Uy, de eso todavía no tengo una guía.', 'Mmm, eso no lo tengo en mis guías todavía.'], q)}</p>
      ${ops.length ? `<div class="ay-sug">${ops.map(x => `<button type="button" data-ay-guia="${x.g.id}">${esc(x.g.t)}${IC.chev}</button>`).join('')}</div>` : ''}${soporteHTML(q)}</div></div>`;
  }
  function inicio(){
    const pag = paginaActual(), sug = (SUG[pag] || ['primeros-pasos', 'conectar-wa', 'invitar']).map(guia).filter(g => g && permitida(g));
    const temas = [['conectar-wa', LOGO.wa, 'Conectar WhatsApp'], ['invitar', IC.persona, 'Invitar a mi equipo'], ['reparto', IC.rep, 'Reparto de chats']].filter(([id]) => permitida(guia(id)));
    const nombre = String((typeof yo === 'string' && yo) || '').trim().split(/\s+/)[0];
    return `<div class="ay-hola"><h3>Hola${nombre ? ', ' + esc(nombre) : ''} 👋</h3><p>Pregúntame cómo hacer cualquier cosa en Wali.</p></div>
      ${sug.length ? `<div class="ay-sec"><small>${NOMBRE_PAG[pag] ? 'Estás en ' + esc(NOMBRE_PAG[pag]) : 'Para empezar'}</small><div class="ay-sug">${sug.map(g => `<button type="button" data-ay-guia="${g.id}">${esc(g.t)}${IC.chev}</button>`).join('')}</div></div>` : ''}
      ${(A.hist || []).length && !A.items.length ? (() => { const c = A.hist[0], [g, h] = cuandoHist(c.en); return `<div class="ay-sec"><small>Sigue donde ibas</small><div class="ay-sug"><button type="button" class="ay-sigue" data-ay-conv="${esc(c.id)}">${IC.reloj}<em>${esc(c.t)}<small>${g}, ${esc(h)}</small></em>${IC.chev}</button></div></div>`; })() : ''}
      <div class="ay-sec"><small>Lo más buscado</small><div class="ay-temas">${temas.map(([id, ic, t]) => `<button type="button" data-ay-guia="${id}"><i class="ay-pic${id === 'conectar-wa' ? ' wa' : ''}">${ic}</i>${t}</button>`).join('')}<button type="button" data-ay-todas="1"><i class="ay-pic">${IC.libro}</i>Todas las guías</button></div></div>`;
  }
  function todas(){
    const visibles = AYUDA_GUIAS.filter(permitida), temas = [...new Set(visibles.map(g => g.a))];
    if (A.tema) return `<button type="button" class="ay-volver" data-ay-tema="">${IC.atras}Todos los temas</button><h4 class="ay-h">${esc(A.tema)}</h4><div class="ay-sug">${visibles.filter(g => g.a === A.tema).map(g => `<button type="button" data-ay-guia="${g.id}">${esc(g.t)}${IC.chev}</button>`).join('')}</div>`;
    return `<button type="button" class="ay-volver" data-ay-inicio="1">${IC.atras}Inicio</button><h4 class="ay-h">Todas las guías</h4><div class="ay-sug">${temas.map(t => `<button type="button" data-ay-tema="${esc(t)}">${esc(t)}<em>${visibles.filter(g => g.a === t).length}</em>${IC.chev}</button>`).join('')}</div>`;
  }
  function cuerpo(){
    if (A.vista === 'todas') return todas();
    if (A.vista === 'historial') return historial();
    if (!A.items.length || A.vista === 'inicio') return inicio();
    return A.items.map(parteHTML).join('') + (A.escribiendo ? `<div class="ay-msj bot ay-escribe"><span class="ay-iso pq">${ISO}</span><div class="ay-escr"><i></i><i></i><i></i></div></div>` : '');
  }
  /* ── Historial: las últimas 20 conversaciones de la persona, guardadas en su cuenta (GET/PUT /crm/ayuda/historial) ── */
  const titulo = items => { const y = items.find(p => p.y !== undefined); return y ? y.y : 'Conversación'; };
  function cargarHist(){
    if (A.hist) return Promise.resolve(A.hist);
    return crmApi('GET', '/crm/ayuda/historial').then(d => (A.hist = Array.isArray(d && d.convs) ? d.convs : []), () => (A.hist = []));
  }
  let guardarT = null;
  function guardarConv(){
    if (!A.items.length) return;
    if (!A.conv) A.conv = {id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), en: new Date().toISOString()};
    A.conv.items = A.items.slice(-40); A.conv.t = titulo(A.items).slice(0, 80); A.conv.en = new Date().toISOString();
    const lista = (A.hist || []).filter(c => c.id !== A.conv.id); lista.unshift({...A.conv}); A.hist = lista.slice(0, 20);
    clearTimeout(guardarT); guardarT = setTimeout(() => crmApi('PUT', '/crm/ayuda/historial', {convs: A.hist}).catch(() => { /* se reintenta con el próximo mensaje */ }), 800);
  }
  const cuandoHist = iso => { const d = new Date(iso), h = d.toLocaleTimeString('es-CO', {hour: 'numeric', minute: '2-digit'}), dias = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 864e5);
    return dias <= 0 ? ['Hoy', h] : dias === 1 ? ['Ayer', h] : dias < 7 ? ['Esta semana', d.toLocaleDateString('es-CO', {weekday: 'long'})] : ['Antes', d.toLocaleDateString('es-CO', {day: 'numeric', month: 'short'})]; };
  function historial(){
    if (!A.hist) { cargarHist().then(() => { if (A.vista === 'historial') pintar(); }); return '<p class="ay-cargando">Cargando…</p>'; }
    const grupos = new Map();
    for (const c of A.hist) { const [g, h] = cuandoHist(c.en); if (!grupos.has(g)) grupos.set(g, []); grupos.get(g).push([c, h]); }
    const n = c => (c.items || []).filter(p => p.y !== undefined).length;
    return `<div class="ay-sec"><div class="ay-hcab"><h4 class="ay-h">Tus conversaciones</h4><button type="button" class="ay-hnueva" data-ay-nueva="1">${IC.mas}Nueva</button></div>
      ${A.hist.length ? [...grupos].map(([g, cs]) => `<small>${g}</small><div class="ay-hl">${cs.map(([c, h]) => `<button type="button" class="ay-hi${A.conv && A.conv.id === c.id ? ' on' : ''}" data-ay-conv="${esc(c.id)}"><i>${IC.reloj}</i><em>${esc(c.t)}<small>${esc(h)} · ${n(c)} ${n(c) === 1 ? 'pregunta' : 'preguntas'}</small></em>${IC.chev}</button>`).join('')}</div>`).join('') : '<p class="ay-vacio">Todavía no tienes conversaciones. Pregúntame algo y queda aquí.</p>'}</div>
      <p class="ay-hnota">Se guardan en tu cuenta las últimas 20, también en el celular.</p>`;
  }
  function pintar(){
    let p = document.getElementById('ay-panel');
    if (!A.abierto) { if (p) p.remove(); pintarFab(); return; }
    if (!p) {
      document.body.insertAdjacentHTML('beforeend', `<div class="ay" id="ay-panel" role="dialog" aria-label="Ayuda de Wali">
        <div class="ay-cab"><button type="button" class="ay-ic" id="ay-atras" data-ay-inicio="1" aria-label="Volver al inicio" hidden>${IC.atras}</button><span class="ay-iso">${ISO}</span><div><b>Ayuda de Wali</b><small><span class="ay-vivo"></span>Responde al instante</small></div>
          <button type="button" class="ay-ic" id="ay-hbtn" data-ay-hist="1" aria-label="Historial" aria-pressed="false">${IC.reloj}</button><button type="button" class="ay-ic" data-ay-nueva="1" aria-label="Conversación nueva">${IC.mas}</button><button type="button" class="ay-x" data-ay-cerrar="1" aria-label="Cerrar">${IC.x}</button></div>
        <div class="ay-cuerpo" id="ay-cuerpo"></div>
        <form class="ay-in" id="ay-form"><label class="ay-campo">${IC.buscar}<input id="ay-q" placeholder="¿En qué te ayudo?" autocomplete="off" maxlength="200" aria-label="Escribe tu pregunta"></label><button type="submit" class="ay-env" aria-label="Enviar">${IC.enviar}</button></form></div>`);
      p = document.getElementById('ay-panel');
      setTimeout(() => { const i = document.getElementById('ay-q'); if (i) i.focus(); }, 60);
    }
    const c = document.getElementById('ay-cuerpo'); c.replaceChildren(); c.insertAdjacentHTML('beforeend', cuerpo());
    // En la conversación, la última pregunta queda arriba y su respuesta debajo.
    const ult = A.vista === 'chat' ? [...c.querySelectorAll('.ay-msj.yo')].pop() : null;
    c.scrollTop = ult ? Math.max(0, ult.offsetTop - 12) : 0;
    const q = document.getElementById('ay-q'); if (q) q.placeholder = A.vista === 'chat' && A.items.length ? 'Escribe otra pregunta' : '¿En qué te ayudo?';
    const at = document.getElementById('ay-atras'); if (at) at.hidden = A.vista === 'inicio';
    const hb = document.getElementById('ay-hbtn'); if (hb) hb.setAttribute('aria-pressed', String(A.vista === 'historial'));
    pintarFab();
  }
  function pintarFab(){
    let f = document.getElementById('ay-fab');
    if (!f) { document.body.insertAdjacentHTML('beforeend', `<button type="button" class="ay-fab" id="ay-fab" data-ay-fab="1" aria-label="Ayuda de Wali" aria-expanded="false"></button>`); f = document.getElementById('ay-fab'); }
    f.classList.toggle('abierta', A.abierto); f.setAttribute('aria-expanded', String(A.abierto));
    f.replaceChildren(); f.insertAdjacentHTML('beforeend', A.abierto ? IC.x : ASTRO);
  }
  const yoBurbuja = t => `<div class="ay-msj yo"><p>${esc(t)}</p></div>`;
  /* Charla: saludos, gracias, quién es y despedidas no son preguntas de guías; se contestan como persona. Una pregunta
     sin ninguna palabra útil («ayuda», «tengo una duda») pide más detalle con sugerencias, sin decir «no encontré». */
  const SALUDO = /^(hola+|holi|buen[oa]s?( dias| tardes| noches)?|hey|ey|que (mas|tal|hubo)|q hubo|saludos|alo|epa|buenas)(?![a-z])/;
  const GRACIAS = /^(gracias|muchas gracias|mil gracias|ok gracias|listo gracias|perfecto|genial|excelente|super|vale|ok|listo|dale|bueno)(?![a-z])/;
  const QUIEN = /(quien eres|que eres|eres (un )?(bot|robot|persona|humano|ia)|como te llamas|con quien hablo)/;
  const ADIOS = /^(chao|adios|hasta luego|nos vemos|bye)(?![a-z])/;
  function conversar(q){
    const t = norm(q), nombre = String((typeof yo === 'string' && yo) || '').trim().split(/\s+/)[0];
    const bot = (txt, extra = '') => { if (Array.isArray(txt)) txt = unaDe(txt, t + A.items.length); return `<div class="ay-msj bot"><span class="ay-iso pq">${ISO}</span><div class="ay-msj-c"><p>${txt}</p>${extra}</div></div>`; };
    const sugs = () => { const pag = paginaActual(), ids = (SUG[pag] || ['primeros-pasos', 'conectar-wa', 'invitar']); const gs = ids.map(guia).filter(g => g && permitida(g)); return gs.length ? `<div class="ay-sug">${gs.map(g => `<button type="button" data-ay-guia="${g.id}">${esc(g.t)}${IC.chev}</button>`).join('')}</div>` : ''; };
    const resto = t.replace(SALUDO, '').replace(/^\s*(como (estas|vas|va todo)|que tal)\s*/, '').trim();
    if (SALUDO.test(t) && !palabras(resto).length) return bot(`¡Hola${nombre ? ', ' + esc(nombre) : ''}! 👋 Cuéntame qué quieres hacer en Wali y te digo cómo. Por ejemplo:`, sugs());
    if (GRACIAS.test(t) && palabras(t.replace(GRACIAS, '')).length === 0) return bot(['¡Con gusto! Aquí estoy si necesitas algo más.', '¡De nada! Cualquier cosa me escribes.', 'Con mucho gusto 😊 ¿Algo más?']);
    if (QUIEN.test(t)) return bot('Soy el asistente de Wali. Te explico cómo hacer las cosas en el CRM y te llevo a la pantalla. No soy una persona, pero si algo se me escapa te paso con el equipo de soporte.');
    if (ADIOS.test(t)) return bot(['¡Hasta luego! Aquí estaré cuando me necesites.', '¡Chao! Que te vaya muy bien.', '¡Nos vemos! Cualquier cosa, toca la burbuja amarilla.']);
    // Más charla: lo que la gente escribe y no es una guía.
    // Anuncia una pregunta sin decirla todavía («tengo otra duda», «una pregunta»): se le pide que la cuente.
    if (/^(hola )?(tengo|tendria|me (surgio|quedo)|quiero hacer(te)?|te (hago|tengo)|una|otra|ultima) ?(otra|una|mas de una|varias|unas|la ultima)? ?(duda|dudas|pregunta|preguntas|consulta|consultas|inquietud|cosa|cosita)( mas)?( para ti)?$|^(puedo|te puedo|quiero) (hacer(te)?|preguntar(te)?)( una| otra)?( pregunta| cosa| algo)?$|^(necesito|quiero) (ayuda|preguntar(te)? algo|saber algo)$|^otra cosa$/.test(t)) return bot(['¡Claro! Cuéntame, ¿qué necesitas?', 'Dale, dime tu duda.', '¡Claro que sí! ¿Qué quieres saber?']);
    if (/^(si|no|ok|okey|okay|vale|dale|listo|bueno|bien|perfecto|entendido|ya|aja|claro|de una|super|genial)( gracias)?$/.test(t)) return bot(['¡Listo! ¿Te ayudo con algo más?', 'Perfecto. ¿Algo más?', 'Bien 👍 Si te queda otra duda, me dices.']);
    if (/(que (puedes|sabes) hacer|en que (me )?(ayudas|puedes ayudar)|para que sirves|que temas)/.test(t)) return bot('Te ayudo con casi todo en Wali: conectar WhatsApp, plantillas, difusiones, equipos, el reparto de chats, flujos, agentes IA, informes y pagos. Y si quieres, te llevo a la pantalla y te muestro dónde tocar. Por ejemplo:', sugs());
    if (/(hablar|comunicar|contactar|escribir).*(persona|humano|asesor|alguien|soporte|agente real)|quiero (un|una) (persona|humano)|atencion humana|servicio al cliente/.test(t)) return bot('Claro. Escríbele al equipo de soporte y te atiende una persona en horario hábil:', soporteHTML(''));
    if (/(estoy perdid|no entiendo nada|no se (nada|como|que hacer)|me perdi|esto es dificil|que es esto|ayuda+$|socorro|auxilio)/.test(t)) return bot(['Tranqui, vamos paso a paso. Empieza por aquí:', 'No te preocupes, lo vemos juntos. Arranca por aquí:'], sugs());
    if (/(urgente|emergencia|ya mismo|rapido por favor|se cayo todo|no funciona nada)/.test(t)) return bot('Entiendo, vamos rápido. Mira si arriba sale una franja roja de WhatsApp desconectado; si no es eso, escríbele a soporte contando qué pasa y lo revisamos de una.', soporteHTML(q));
    if (/(tonto|estupido|inutil|no sirves|no sirve para nada|malo|pesimo|basura)/.test(t)) return bot('Perdón, no te ayudé bien. ¿Me lo dices con otras palabras? O, si prefieres, escríbele a una persona de soporte:', soporteHTML(q));
    if (/(clima|futbol|partido|chiste|receta|noticias|horoscopo|bitcoin|dolar)/.test(t)) return bot(['Jaja, eso se me escapa: yo solo sé de Wali. ¿Te ayudo con algo del CRM?', 'De eso no sé, lo mío es Wali 😅 ¿Qué necesitas del CRM?'], sugs());
    if (/(te quiero|eres (lo maximo|genial|el mejor|la mejor)|me encantas|buen trabajo)/.test(t)) return bot(['¡Ay, gracias! 💛 Aquí sigo para lo que necesites.', '¡Qué bien leer eso! 💛 ¿Te ayudo con algo más?']);
    if (/(como estas|como te va|que tal estas)/.test(t)) return bot(['¡Muy bien, gracias por preguntar! ¿Y tú? ¿En qué te ayudo?', '¡Todo bien por acá! ¿Qué necesitas hoy?'], sugs());
    if (/(quien te (hizo|creo|programo)|de donde eres)/.test(t)) return bot('Me hizo el equipo de Wali, para que le saques todo el jugo al CRM.');
    if (!palabras(resto || t).length) return bot('Claro, te ayudo. Cuéntame con tus palabras qué quieres hacer, por ejemplo «conectar WhatsApp» o «crear una plantilla».', sugs());
    return null;
  }
  /* Fusión de los dos buscadores por su puesto (RRF, k = 5): cada guía suma 1/(5 + puesto) en cada uno. El de
     significado no decide solo si es una pregunta de Wali (a todo le da puntajes parecidos); lo hace cuando está muy
     seguro (0,90 o más y con ventaja), y si no, deciden las palabras. */
  function decidir(r, sem){
    const permitidas = (sem || []).filter(([id]) => { const g = guia(id); return g && permitida(g); });
    const puntos = new Map(), suma = (id, i) => puntos.set(id, (puntos.get(id) || 0) + 1 / (5 + i + 1));
    r.lista.slice(0, 12).forEach((x, i) => suma(x.g.id, i));
    permitidas.forEach(([id], i) => suma(id, i));
    const orden = [...puntos].sort((a, b) => b[1] - a[1]).map(([id]) => guia(id)).filter(Boolean);
    const s0 = permitidas[0], s1 = permitidas[1];
    const semSeguro = s0 && s0[1] >= .9 && (!s1 || s0[1] - s1[1] >= .03);
    if (!orden.length) return {nivel: 'baja', orden};
    if (entendio(r) && orden[0].id === r.lista[0].g.id) return {nivel: 'alta', orden};
    if (semSeguro && orden[0].id === s0[0]) return {nivel: entendio(r) || probable(r) ? 'alta' : 'media', orden};
    if (entendio(r) || probable(r) || (r.cubre >= .5 && r.lista.slice(0, 3).some(x => x.g.id === orden[0].id))) return {nivel: 'media', orden};
    return {nivel: 'baja', orden};
  }
  function preguntar(texto){
    const q = texto.trim(); if (!q) return;
    A.vista = 'chat'; A.items.push({y: q}); A.escribiendo = true; pintar();
    const charla = conversar(q);
    // Mientras se ven los puntos, el servidor busca por significado (ayudaSemantica.ts); si tarda o falla, sigue con
    // el buscador de palabras.
    const sem = charla ? Promise.resolve(null) : Promise.race([
      crmApi('POST', '/crm/ayuda/semantica', {q}).then(d => (d && Array.isArray(d.guias) ? d.guias : null), () => null),
      new Promise(ok => setTimeout(() => ok(null), 1800)),
    ]);
    Promise.all([sem, new Promise(ok => setTimeout(ok, 380))]).then(([s]) => {
      A.escribiendo = false;
      if (charla) { A.items.push({c: q}); guardarConv(); pintar(); return; }
      const d = decidir(buscar(q), s);
      if (d.nivel === 'alta') A.items.push({g: d.orden[0].id, e: 1});
      else if (d.nivel === 'media') A.items.push({g: d.orden[0].id, e: 1, o: d.orden.slice(1, 3).map(g => g.id)});
      else { A.items.push({n: q, o: d.orden.slice(0, 3).map(g => g.id)}); crmApi('POST', '/crm/ayuda/sin-respuesta', {q}).catch(() => { /* no importa si no se guarda */ }); }
      guardarConv(); pintar();
    });
  }
  function abrirGuia(id){ const g = guia(id); if (!g) return; A.vista = 'chat'; A.items.push({y: g.t}, {g: g.id}); guardarConv(); pintar(); }

  /* ── «Llevarme ahí»: abre la pantalla y señala dónde tocar ── */
  function llevar(g){
    A.abierto = false; pintar();
    if (typeof g.ir === 'function') g.ir(); else if (g.ir) irA(g.ir);
    if (!g.foco) { toast(`Listo, estás en ${NOMBRE_PAG[g.ir] || 'la pantalla'}. ${g.p[0].replace(/\*\*/g, '')}`); return; }
    let intentos = 0;
    const buscarFoco = () => {
      const el = document.querySelector(g.foco);
      if (!el || !el.getClientRects().length) { if (++intentos < 12) return setTimeout(buscarFoco, 120); toast(g.p[0].replace(/\*\*/g, '')); return; }
      el.scrollIntoView({block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'});
      setTimeout(() => foco(el, g), 260);
    };
    setTimeout(buscarFoco, 80);
  }
  function foco(el, g){
    quitarFoco();
    const r = el.getBoundingClientRect(), m = 8, abajo = r.bottom + 180 < innerHeight;
    const tipX = Math.min(Math.max(12, r.right - 270), innerWidth - 282);
    document.body.insertAdjacentHTML('beforeend', `<div class="ay-foco" id="ay-foco" data-ay-foco-cerrar="1"><span class="ay-hueco" style="left:${r.left - m}px;top:${r.top - m}px;width:${r.width + m * 2}px;height:${r.height + m * 2}px"></span>
      <div class="ay-tip${abajo ? '' : ' arriba'}" style="left:${tipX}px;${abajo ? `top:${r.bottom + 16}px` : `bottom:${innerHeight - r.top + 16}px`}"><b>Toca aquí</b><small>${esc(g.p.find(x => /toca|elige|abre|escribe|ve a/i.test(x)) || g.p[0]).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')}</small></div></div>`);
    setTimeout(quitarFoco, 6000);
  }
  const quitarFoco = () => { const f = document.getElementById('ay-foco'); if (f) f.remove(); };

  /* ── Eventos ── */
  document.addEventListener('click', e => {
    const t = e.target instanceof Element ? e.target : null; if (!t) return;
    if (t.closest('#ay-foco')) { quitarFoco(); return; }
    if (t.closest('[data-ay-fab]')) { A.abierto = !A.abierto; pintar(); if (A.abierto && !A.hist) cargarHist().then(() => { if (A.abierto && A.vista === 'inicio') pintar(); }); return; }
    if (!t.closest('#ay-panel')) return;
    const g = (attr, fn) => { const b = t.closest(`[${attr}]`); if (!b) return false; fn(b.getAttribute(attr)); return true; };
    if (g('data-ay-cerrar', () => { A.abierto = false; pintar(); })) return;
    if (g('data-ay-guia', id => abrirGuia(id))) return;
    if (g('data-ay-todas', () => { A.vista = 'todas'; A.tema = null; pintar(); })) return;
    if (g('data-ay-tema', v => { A.vista = 'todas'; A.tema = v || null; pintar(); })) return;
    if (g('data-ay-inicio', () => { A.vista = A.vista === 'todas' && A.items.length ? 'chat' : 'inicio'; if (A.vista === 'inicio') { A.items = []; A.conv = null; } pintar(); })) return;
    if (g('data-ay-nueva', () => { A.items = []; A.conv = null; A.vista = 'inicio'; pintar(); const i = document.getElementById('ay-q'); if (i) i.focus(); })) return;
    if (g('data-ay-hist', () => { A.vista = A.vista === 'historial' ? (A.items.length ? 'chat' : 'inicio') : 'historial'; pintar(); })) return;
    if (g('data-ay-conv', id => { const c = (A.hist || []).find(x => x.id === id); if (!c) return; A.conv = {id: c.id, en: c.en}; A.items = (c.items || []).slice(); A.vista = 'chat'; pintar(); })) return;
    if (g('data-ay-ir', id => { const x = guia(id); if (x) llevar(x); })) return;
    if (g('data-ay-util', v => {
      const [id, si] = v.split('|'), caja = t.closest('[data-ay-utilde]');
      crmApi('POST', '/crm/ayuda/util', {guia: id, util: si === '1'}).catch(() => { /* no importa */ });
      if (caja) { caja.replaceChildren(); caja.insertAdjacentHTML('beforeend', si === '1' ? '<span class="ay-gracias">¡Qué bien! Gracias por contarnos.</span>' : '<span class="ay-gracias">Gracias. Vamos a mejorar esta guía.</span>'); }
      if (si !== '1') { A.items.push({s: guia(id) ? guia(id).t : ''}); guardarConv(); pintar(); }
    })) return;
  });
  document.addEventListener('submit', e => {
    if (e.target.id !== 'ay-form') return;
    e.preventDefault(); const i = document.getElementById('ay-q'); const v = i.value; i.value = ''; preguntar(v);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (document.getElementById('ay-foco')) quitarFoco(); else if (A.abierto) { A.abierto = false; pintar(); } } });
  addEventListener('resize', quitarFoco);
  // La burbuja aparece cuando el CRM ya cargó.
  const arrancar = () => { if (document.body) pintarFab(); else setTimeout(arrancar, 200); };
  setTimeout(arrancar, 400);
  // Para la prueba de guías (y para quien la quiera usar desde la consola).
  window.ayudaDecidir = (q, sem) => { const d = decidir(buscar(q), sem); return {nivel: d.nivel, top: d.orden.slice(0, 3).map(g => g.id)}; };
  window.ayudaBuscar = q => { const r = buscar(q); return {entendio: !!entendio(r) || !!probable(r), seguro: !!entendio(r), todo: r.lista.slice(0, 12).map(x => [x.g.id, +x.s.toFixed(2)]), top: r.lista.slice(0, 3).map(x => [x.g.id, +x.s.toFixed(2), +x.cubre.toFixed(2)])}; };

  document.head.insertAdjacentHTML('beforeend', `<style>
.ay-fab{position:fixed;right:22px;bottom:22px;width:56px;height:56px;border-radius:50%;background:#FFD21F;color:#0b0b10;display:grid;place-items:center;box-shadow:0 8px 24px -6px rgba(11,11,16,.35);z-index:240;border:0;cursor:pointer;transition:transform .25s cubic-bezier(.16,1,.3,1)}
.ay-fab:hover{transform:scale(1.05)}
.ay-fab svg{width:26px;height:26px;display:block;stroke-width:1.9}
.ay-fab:not(.abierta){overflow:hidden}
.ay-fab:not(.abierta) .ay-astro{width:44px;height:44px;margin-top:3px}
.ay-fab.abierta{background:#fff;color:#dc2626;border:1px solid var(--line)}
.ay-fab.abierta svg{width:22px;height:22px}
.ay{position:fixed;right:22px;bottom:90px;z-index:241;width:380px;max-width:calc(100vw - 32px);height:min(620px,calc(100vh - 120px));background:#fff;border-radius:20px;border:1px solid var(--line);box-shadow:0 24px 60px -18px rgba(11,11,16,.35);display:flex;flex-direction:column;overflow:hidden;animation:ay-abrir .45s cubic-bezier(.16,1,.3,1) both;transform-origin:bottom right}
@keyframes ay-abrir{from{opacity:0;transform:translateY(12px) scale(.97)}to{opacity:1;transform:none}}
.ay-cab{display:flex;align-items:center;gap:10px;padding:14px 14px 14px 16px;border-bottom:1px solid var(--line2,#eef1f5)}
.ay-cab > div{flex:1}
.ay-cab b{display:block;font-size:14.5px}
.ay-cab small{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--ink3)}
.ay-vivo{width:7px;height:7px;border-radius:50%;background:#22c55e}
.ay-ast{width:34px;height:34px;border-radius:50%;background:#FFD21F;display:grid;place-items:center;overflow:hidden;flex:none}
.ay-ast .ay-astro{width:30px;height:30px;margin-top:2px}
.ay-iso.pq .ay-ast{width:28px;height:28px}.ay-iso.pq .ay-astro{width:24px;height:24px}
.ay-astro .ojos{transform-box:fill-box;transform-origin:center;animation:ay-parpadeo 5s cubic-bezier(.22,1,.36,1) infinite}
@keyframes ay-parpadeo{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.12)}}
.ay-astro .antena{animation:ay-antena 2.4s ease-in-out infinite}
@keyframes ay-antena{0%,100%{opacity:1}50%{opacity:.55}}
.ay-ic{width:32px;height:32px;border-radius:9px;display:grid;place-items:center;color:var(--ink2);flex:none;border:0;background:none;cursor:pointer}
.ay-ic:hover,.ay-ic[aria-pressed="true"]{background:var(--bg3);color:var(--ink)}
.ay-ic[hidden]{display:none}
.ay-ic svg{width:18px;height:18px}
.ay-hcab{display:flex;align-items:center;justify-content:space-between}
.ay-hnueva{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 12px;border:1px solid var(--line);border-radius:9px;background:#fff;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer}
.ay-hnueva svg{width:15px;height:15px}
.ay-hl{display:grid;gap:6px}
.ay-hi,.ay-sigue{display:flex!important;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:#fff;font:inherit;font-size:13.5px;font-weight:500;color:var(--ink);text-align:left;cursor:pointer;width:100%}
.ay-hi:hover,.ay-sigue:hover{border-color:#0b0b10}
.ay-hi.on{border-color:#0b0b10;box-shadow:inset 0 0 0 1px #0b0b10}
.ay-hi i{width:28px;height:28px;border-radius:8px;background:var(--bg3);display:grid;place-items:center;color:var(--ink2);flex:none}
.ay-hi i svg{width:15px;height:15px}
.ay-hi em,.ay-sigue em{flex:1;min-width:0;font-style:normal;display:grid}
.ay-hi em small,.ay-sigue em small{font-size:11.5px;color:var(--ink3);font-weight:400;text-transform:none;letter-spacing:0}
.ay-sigue > svg:first-child{width:16px;height:16px;color:var(--ink3)}
.ay-hi > svg,.ay-sigue > svg:last-child{width:15px;height:15px;color:var(--ink4)}
.ay-hnota,.ay-vacio,.ay-cargando{font-size:12px;color:var(--ink3);margin:0}
.ay-iso.pq{flex:none;align-self:flex-start}
.ay-x{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;color:#dc2626;border:0;background:none;cursor:pointer}
.ay-x:hover{background:#fee2e2}
.ay-x svg{width:18px;height:18px}
.ay-cuerpo{position:relative;flex:1;padding:16px;display:flex;flex-direction:column;gap:16px;overflow-y:auto;background:#fbfbfc}
.ay-hola h3{margin:0;font-size:20px;font-weight:800;letter-spacing:-.02em}
.ay-hola p{margin:2px 0 0;font-size:13.5px;color:var(--ink3)}
.ay-sec{display:grid;gap:8px}
.ay-sec > small,.ay-rel small{font-size:11.5px;font-weight:600;color:var(--ink3);text-transform:uppercase;letter-spacing:.04em}
.ay-sug,.ay-rel{display:grid;gap:6px}
.ay-sug button,.ay-rel button{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:#fff;font:inherit;font-size:13.5px;font-weight:500;text-align:left;color:var(--ink);cursor:pointer}
.ay-sug button:hover,.ay-rel button:hover{border-color:#0b0b10}
.ay-sug svg,.ay-rel svg{width:15px;height:15px;color:var(--ink4);flex:none}
.ay-sug em{margin-left:auto;font-style:normal;font-size:12px;color:var(--ink3)}
.ay-temas{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.ay-temas button{display:flex;flex-direction:column;align-items:flex-start;gap:8px;padding:12px;border:1px solid var(--line);border-radius:12px;background:#fff;font:inherit;font-size:13px;font-weight:600;color:var(--ink);cursor:pointer;text-align:left}
.ay-temas button:hover{border-color:#0b0b10}
.ay-pic{width:30px;height:30px;border-radius:9px;background:#FFD21F;color:#0b0b10;display:grid;place-items:center;flex:none}
.ay-pic svg{width:16px;height:16px}
.ay-pic.wa svg{fill:#0b0b10}
.ay-in{display:flex;gap:8px;padding:12px;border-top:1px solid var(--line2,#eef1f5);background:#fff;margin:0}
.ay-campo{flex:1;display:flex;align-items:center;gap:8px;height:42px;padding:0 12px;border:1px solid var(--line);border-radius:12px}
.ay-campo:focus-within{border-color:#0b0b10;box-shadow:0 0 0 3px rgba(11,11,16,.08)}
.ay-campo svg{width:16px;height:16px;color:var(--ink4);flex:none}
.ay-campo input{border:0;outline:0;font:inherit;font-size:13.5px;flex:1;min-width:0;background:none}
.ay-env{width:42px;height:42px;border-radius:12px;background:#FFD21F;color:#0b0b10;display:grid;place-items:center;flex:none;border:0;cursor:pointer}
.ay-env svg{width:18px;height:18px}
.ay-msj{display:flex;gap:8px}
.ay-msj.yo{justify-content:flex-end}
.ay-msj.yo p{margin:0;background:#0b0b10;color:#fff;padding:9px 12px;border-radius:14px 14px 4px 14px;font-size:13.5px;max-width:80%}
.ay-msj-c{display:grid;gap:10px;min-width:0;flex:1}
.ay-msj-c > p{margin:0;font-size:13.5px;color:var(--ink2)}
.ay-entiendo{font-size:12.5px!important;color:var(--ink3)!important}
.ay-guia{display:grid;gap:10px;padding:14px;border:1px solid var(--line);border-radius:14px;background:#fff;font-size:13px;color:var(--ink2)}
.ay-guia > b{color:var(--ink);font-size:14px}
.ay-guia ol{margin:0;padding-left:18px;display:grid;gap:5px}
.ay-guia b{color:var(--ink)}
.ay-guia .btn{justify-self:start}
.ay-guia .btn svg{width:15px;height:15px}
.ay-util{display:flex;align-items:center;gap:6px;font-size:12.5px;color:var(--ink3)}
.ay-util span{margin-right:4px}
.ay-util button{display:inline-flex;align-items:center;gap:5px;height:30px;padding:0 10px;border:1px solid var(--line);border-radius:9px;background:#fff;font:inherit;font-size:12.5px;color:var(--ink2);cursor:pointer}
.ay-util svg{width:14px;height:14px}
.ay-gracias{font-size:12.5px;color:#15803d;font-weight:600}
.ay-soporte{display:grid;gap:10px;padding:12px;border:1px solid var(--line);border-radius:14px;background:#fff}
.ay-sop-t{display:flex;align-items:center;gap:10px}
.ay-sop-t > div{flex:1;min-width:0}
.ay-sop-t b{display:block;font-size:13px}
.ay-sop-t small{display:block;font-size:12px;color:var(--ink3)}
.ay-sop-b{display:grid;grid-template-columns:repeat(auto-fit,minmax(0,1fr));gap:8px}
.ay-sop-b .btn{justify-content:center;text-decoration:none}
.ay-sop-b svg{width:16px;height:16px}
.ay-sop-b .ay-wa svg{fill:#25D366}
.ay-escr{display:flex;gap:4px;padding:12px 14px;border:1px solid var(--line);border-radius:14px 14px 14px 4px;background:#fff;align-self:flex-start}
.ay-escr i{width:7px;height:7px;border-radius:50%;background:#9ca3af;animation:ay-punto 1.2s cubic-bezier(.16,1,.3,1) infinite}
.ay-escr i:nth-child(2){animation-delay:.15s}
.ay-escr i:nth-child(3){animation-delay:.3s}
@keyframes ay-punto{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-4px);opacity:1}}
.ay-volver{display:inline-flex;align-items:center;gap:6px;border:0;background:none;padding:0;font:inherit;font-size:13px;color:var(--ink);cursor:pointer;align-self:flex-start}
.ay-volver svg{width:15px;height:15px}
.ay-h{margin:0;font-size:16px;font-weight:700}
.ay-foco{position:fixed;inset:0;z-index:260;cursor:pointer}
.ay-hueco{position:fixed;border-radius:14px;box-shadow:0 0 0 9999px rgba(10,10,14,.55),0 0 0 4px #FFD21F;animation:ay-latir 1.8s cubic-bezier(.16,1,.3,1) infinite;pointer-events:none}
@keyframes ay-latir{0%{box-shadow:0 0 0 9999px rgba(10,10,14,.55),0 0 0 4px #FFD21F}70%{box-shadow:0 0 0 9999px rgba(10,10,14,.55),0 0 0 14px rgba(255,210,31,0)}100%{box-shadow:0 0 0 9999px rgba(10,10,14,.55),0 0 0 4px #FFD21F}}
.ay-tip{position:fixed;width:260px;padding:14px;border-radius:14px;background:#fff;box-shadow:0 18px 40px -12px rgba(11,11,16,.4);display:grid;gap:4px}
.ay-tip b{font-size:14px}
.ay-tip small{font-size:12.5px;color:var(--ink3)}
@media (prefers-reduced-motion:reduce){.ay,.ay-escr i,.ay-hueco,.ay-astro .ojos,.ay-astro .antena{animation:none}}
@media (max-width:760px){.ay-fab{right:16px;bottom:84px}.ay{right:16px;bottom:150px;height:min(560px,calc(100vh - 180px))}}
</style>`);
})();
