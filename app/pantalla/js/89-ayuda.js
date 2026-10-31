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
    chev: SV('<path d="m9 6 6 6-6 6"/>'), basura: SV('<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/>'), reloj: SV('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'), mas: SV('<path d="M12 5v14M5 12h14"/>'), flecha: SV('<path d="M7 17 17 7M9 7h8v8"/>'), atras: SV('<path d="m15 6-6 6 6 6"/>'),
    si: SV('<path d="M7 11v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h3Zm0 0 4-7a2 2 0 0 1 2 2v4h5a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 16.8 20H7"/>'),
    no: SV('<path d="M17 13V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-3Zm0 0-4 7a2 2 0 0 1-2-2v-4H6a2 2 0 0 1-2-2.3l1.2-6A2 2 0 0 1 7.2 4H17"/>'),
    clip: SV('<path d="m21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7"/>'), escudo: SV('<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z"/>'), avion: SV('<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>'), chulo: SV('<path d="m5 12 5 5L20 7"/>'),
    persona: SV('<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-3.5 3.8-5.5 7-5.5s6 2 7 5.5"/>'), correo: SV('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
    libro: SV('<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15Z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/>'), rep: SV('<path d="M16 3h5v5M21 3l-7 7M8 21H3v-5M3 21l7-7"/>'),
  };
  // La cara del astronauta del inicio de sesión, plana y con su parpadeo (maqueta aprobada «astronauta, volver e historial»).
  const GLOBO = '<svg class="ay-globo" viewBox="0 0 64 60" aria-hidden="true"><path d="M30 2h4c15.5 0 28 12.5 28 28 0 6.7-2.3 12.8-6.2 17.6L62 58l-14.3-4.1A27.8 27.8 0 0 1 34 58h-4C14.5 58 2 45.5 2 30S14.5 2 30 2Z"/></svg>';
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
    // «agregar», «añadir» y «crear» algo nuevo son lo mismo (23-oct: «cómo agrego una plantilla» caía en instalar la app).
    'crear agregar añadir anadir adicionar generar',
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
  const A = {abierto: false, items: [], vista: 'inicio', tema: null, escribiendo: false, hist: null, conv: null, htab: 'conv', sol: null, sinVer: 0, aviso: null};
  /* Cada parte: {y: pregunta} | {g: guía, e: entendió, o: [otras]} | {c: charla (se vuelve a contestar igual)} |
     {n: pregunta sin respuesta, o: [opciones]} | {s: soporte}. Así se guardan en el historial sin HTML. */
  function parteHTML(p){
    if (p.y !== undefined) return yoBurbuja(p.y);
    if (p.g) { const g = guia(p.g); return g ? tarjeta(g, !!p.e, (p.o || []).map(guia).filter(Boolean)) : ''; }
    if (p.c !== undefined) { const r = conversar(p.c); return r && r !== 'SOPORTE' ? r : ''; }
    if (p.n !== undefined) return noEntendio(p.n, {lista: (p.o || []).map(guia).filter(Boolean).map(g => ({g}))});
    if (p.s !== undefined) return `<div class="ay-msj bot"><span class="ay-iso pq">${ISO}</span><div class="ay-msj-c">${soporteHTML(p.s)}</div></div>`;
    if (p.f) return formSoporte(p.f);
    if (p.r) return tarjetaSolicitud(p);
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
  /* Soporte (maqueta aprobada «Soporte en el CRM», 31-oct): «Escribirle a soporte» abre el formulario aquí mismo y la
     solicitud llega al panel de superadministrador; la respuesta vuelve a esta conversación y por correo. */
  function soporteHTML(q){
    const asunto = encodeURIComponent('Ayuda con Wali'), cuerpo = encodeURIComponent(q ? `Hola, necesito ayuda con esto: ${q}` : 'Hola, necesito ayuda con Wali.');
    return `<div class="ay-soporte"><div class="ay-sop-t"><span class="ay-pic">${IC.persona}</span><div><b>Habla con una persona</b><small>El equipo de Wali te responde aquí y por correo, en horario hábil.</small></div></div>
      <button type="button" class="btn pri ay-sop-ir" data-ay-sop="${esc(q || '')}">${IC.avion}Escribirle a soporte</button>
      <span class="ay-sop-o">o por <a href="mailto:${SOPORTE.correo}?subject=${asunto}&body=${cuerpo}">correo</a></span></div>`;
  }
  const TEMAS_SOP = [['mensajes', 'No llegan mensajes'], ['cobros', 'Cobros y plan'], ['como', 'Cómo se hace algo'], ['otra', 'Otra cosa']];
  const temaDe = t => { const n = norm(t); return /(cobr|pago|pagar|factur|plan|tarjeta|cancel|suscrip|reembols)/.test(n) ? 'cobros' : /(mensaj|llega|whatsapp|wasap|linea|conect|desconect|instagram|messenger)/.test(n) ? 'mensajes' : /(como|donde|puedo|se hace|configur)/.test(n) ? 'como' : 'otra'; };
  // Lo que la persona escribió antes en esta conversación (sin la frase en que pide hablar con alguien).
  const PIDE_PERSONA = /(hablar|comunicar|contactar|escribir|pasar).*(persona|humano|asesor|alguien|soporte|agente)|(quiero|necesito) (un|una|a|el|al) ?(persona|humano|asesor|soporte|alguien)|atencion humana|servicio al cliente|alguien real|soporte tecnico/;
  function formSoporte(f){
    return `<div class="ay-msj bot"><span class="ay-iso pq">${ISO}</span><div class="ay-msj-c"><p>${f.texto ? 'Claro, te paso con el equipo de Wali. Ya dejé escrito lo que me contaste; revísalo y envíalo.' : 'Cuéntame qué pasa y se lo paso al equipo.'}</p>
      <form class="ay-sform" id="ay-sform" novalidate><div class="ay-schips" role="group" aria-label="Sobre qué es">${TEMAS_SOP.map(([k, t]) => `<button type="button" data-ay-stema="${k}" aria-pressed="${f.tema === k}">${t}</button>`).join('')}</div>
        <label class="ay-sl" for="ay-stexto">Qué pasa</label><textarea id="ay-stexto" maxlength="4000" rows="4" placeholder="Cuéntanos con tus palabras">${esc(f.texto || '')}</textarea>
        <label class="ay-sadj">${IC.clip}<span>${f.adjunto ? esc(f.adjuntoNombre || 'Captura adjunta') : f.subiendo ? 'Subiendo captura…' : '<u>Adjuntar captura</u> <em>· opcional</em>'}</span><input type="file" id="ay-sfile" accept="image/png,image/jpeg,image/webp" hidden></label>
        <p class="ay-spriv">${IC.escudo}<span>Con tu mensaje va el nombre de tu empresa, la pantalla en la que estás y lo que buscaste aquí. <b>Nunca tus conversaciones ni tus contactos.</b></span></p>
        ${f.error ? `<p class="ay-serr" role="alert">${esc(f.error)}</p>` : ''}
        <button type="submit" class="btn pri ay-sop-ir"${f.enviando || f.subiendo ? ' disabled' : ''}>${IC.avion}${f.enviando ? 'Enviando…' : 'Enviar a soporte'}</button></form></div></div>`;
  }
  const solDe = numero => (A.sol || []).find(s => s.numero === numero);
  const ESTADO_SOL = s => !s ? ['Recibida', 'ok'] : s.estado === 'resuelta' ? ['Resuelta', 'ok'] : s.mensajes.length && s.mensajes[s.mensajes.length - 1].autor === 'soporte' ? ['Respondida', 'w'] : ['Recibida', 'ok'];
  const horaCorta = iso => new Date(iso).toLocaleTimeString('es-CO', {hour: 'numeric', minute: '2-digit'});
  function tarjetaSolicitud(p){
    const s = solDe(p.r), [et, ek] = ESTADO_SOL(s), tema = (TEMAS_SOP.find(x => x[0] === p.t) || [, 'Solicitud'])[1];
    const respuestas = s ? s.mensajes.slice(1) : [];
    const hilo = respuestas.map(m => m.autor === 'soporte'
      ? `<div class="ay-sep">${esc(horaCorta(m.en))}</div><div class="ay-msj bot ay-equipo"><span class="ay-av">${esc(String(m.nombre || 'S').slice(0, 2).toUpperCase())}</span><div class="ay-msj-c"><small class="ay-quien"><b>${esc(m.nombre)}</b> · Soporte de Wali</small><div class="ay-resp">${esc(m.texto)}</div></div></div>`
      : yoBurbuja(m.texto)).join('');
    const ultimo = respuestas[respuestas.length - 1];
    const acciones = s && s.estado !== 'resuelta' && ultimo && ultimo.autor === 'soporte'
      ? `<div class="ay-sacc"><button type="button" data-ay-sresp="${esc(p.r)}|resuelta">${IC.chulo}Ya quedó</button><button type="button" data-ay-sresp="${esc(p.r)}|abierta">Sigo con el problema</button></div>` : '';
    return `<div class="ay-scard"><div class="ay-scab"><small>Solicitud #${esc(p.r)}</small><span class="ay-sest ${ek}">${ek === 'ok' && et !== 'Resuelta' ? IC.chulo : ''}${et}</span></div><b>${esc(tema)}</b><span>${esc(p.x)}</span></div>
      <div class="ay-msj bot"><span class="ay-iso pq">${ISO}</span><div class="ay-msj-c"><p>${s && s.estado === 'resuelta' ? 'Esta solicitud quedó resuelta. Si vuelve a pasar, escríbeme.' : 'Listo, ya la tiene el equipo. Te aviso aquí y por correo apenas te respondan.'}</p></div></div>${hilo}${acciones}`;
  }
  function abrirFormSoporte(previo){
    const antes = A.items.filter(p => p.y !== undefined).map(p => p.y).filter(t => !PIDE_PERSONA.test(norm(t)));
    const texto = previo || antes.slice(-3).join('\n');
    A.items = A.items.filter(p => !p.f);
    A.items.push({f: {tema: temaDe(texto), texto, busco: antes.slice(-5)}}); A.vista = 'chat'; pintar();
    setTimeout(() => { const t = document.getElementById('ay-stexto'); if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); } }, 60);
  }
  const formActual = () => { const p = A.items.find(x => x.f); return p ? p.f : null; };
  function leerForm(){ const f = formActual(), t = document.getElementById('ay-stexto'); if (f && t) f.texto = t.value; return f; }
  async function enviarSoporte(){
    const f = leerForm(); if (!f || f.enviando) return;
    if ((f.texto || '').trim().length < 3) { f.error = 'Cuéntanos qué pasa.'; pintar(); return; }
    f.enviando = true; f.error = ''; pintar();
    try {
      const r = await crmApi('POST', '/crm/ayuda/soporte', {tema: f.tema, texto: f.texto.trim(), pantalla: NOMBRE_PAG[paginaActual()] || paginaActual(), busco: f.busco || [], adjunto: f.adjunto || null});
      A.items = A.items.filter(p => !p.f);
      A.items.push({r: r.numero, t: f.tema, x: f.texto.trim().slice(0, 200)});
      await cargarSol(); guardarConv(); pintar();
    } catch (err) { f.enviando = false; f.error = err.message || 'No se pudo enviar. Intenta de nuevo.'; pintar(); }
  }
  async function subirCaptura(file){
    const f = leerForm(); if (!f || !file) return;
    if (file.size > 5 * 1024 * 1024) { f.error = 'La captura pesa más de 5 MB.'; pintar(); return; }
    f.subiendo = true; f.error = ''; pintar();
    try { const r = await crmSubir(file, '/crm/ayuda/soporte/captura'); f.adjunto = r.url; f.adjuntoNombre = `${r.nombre} · ${Math.max(1, Math.round(r.peso / 1024))} KB`; }
    catch (err) { f.error = err.message; }
    f.subiendo = false; pintar();
  }
  /* Las solicitudes de la persona y las respuestas del equipo (GET /crm/ayuda/soporte). Con respuestas sin ver, el
     botón de ayuda muestra el globito rojo y, con el chat cerrado, el aviso «Soporte te respondió». */
  async function cargarSol(){
    try {
      const d = await crmApi('GET', '/crm/ayuda/soporte');
      A.sol = Array.isArray(d && d.solicitudes) ? d.solicitudes : []; A.sinVer = +(d && d.sinVer) || 0;
      const nueva = A.sol.find(s => !s.vista);
      A.aviso = nueva && !A.abierto ? nueva : null;
    } catch { A.sol = A.sol || []; }
    if (A.abierto) { if (A.vista === 'chat' || A.vista === 'historial') pintar(); else pintarFab(); } else pintarFab();
  }
  function verVistas(){ if (!A.sinVer) return; A.sinVer = 0; A.aviso = null; (A.sol || []).forEach(s => { s.vista = true; }); crmApi('POST', '/crm/ayuda/soporte/vistas').catch(() => { /* se marca la próxima vez */ }); pintarFab(); }
  function abrirSolicitud(numero){
    const s = solDe(numero); if (!s) return;
    A.conv = null; A.items = [{y: s.asunto}, {r: s.numero, t: s.tema, x: s.mensajes[0] ? s.mensajes[0].texto.slice(0, 200) : s.asunto}]; A.vista = 'chat'; verVistas(); pintar();
  }
  async function cambiarSol(numero, accion){
    const s = solDe(numero); if (!s) return;
    try {
      await crmApi('POST', `/crm/ayuda/soporte/${s.id}/estado`, {accion});
      await cargarSol();
      if (accion === 'resuelta') A.items.push({c: 'gracias'}); guardarConv(); pintar();
      toast(accion === 'resuelta' ? '¡Qué bien! Cerramos la solicitud.' : 'Le avisamos al equipo que sigues con el problema.');
    } catch (err) { toast(err.message); }
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
    A.conv.items = A.items.filter(p => !p.f).slice(-40); A.conv.t = titulo(A.items).slice(0, 80); A.conv.en = new Date().toISOString();
    const lista = (A.hist || []).filter(c => c.id !== A.conv.id); lista.unshift({...A.conv}); A.hist = lista.slice(0, 20);
    clearTimeout(guardarT); guardarT = setTimeout(() => crmApi('PUT', '/crm/ayuda/historial', {convs: A.hist}).catch(() => { /* se reintenta con el próximo mensaje */ }), 800);
  }
  const cuandoHist = iso => { const d = new Date(iso), h = d.toLocaleTimeString('es-CO', {hour: 'numeric', minute: '2-digit'}), dias = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 864e5);
    return dias <= 0 ? ['Hoy', h] : dias === 1 ? ['Ayer', h] : dias < 7 ? ['Esta semana', d.toLocaleDateString('es-CO', {weekday: 'long'})] : ['Antes', d.toLocaleDateString('es-CO', {day: 'numeric', month: 'short'})]; };
  // Borrar del historial: la fila sale con movimiento (89-movimiento.js) y queda Deshacer 5 segundos.
  function guardarHistYa(){ clearTimeout(guardarT); return crmApi('PUT', '/crm/ayuda/historial', {convs: A.hist || []}).catch(() => toast('No se pudo guardar el cambio del historial')); }
  const repintarMov = () => (typeof crmConMovimiento === 'function' ? crmConMovimiento(pintar) : pintar());
  let deshacer = null;
  function avisoPanel(html){
    const p = document.getElementById('ay-panel'); if (!p) return;
    const v = p.querySelector('.ay-toast'); if (v) v.remove();
    p.insertAdjacentHTML('beforeend', `<div class="ay-toast" role="status">${html}</div>`);
  }
  function quitarAviso(){ const v = document.querySelector('#ay-panel .ay-toast'); if (!v) return; v.classList.add('sale'); setTimeout(() => v.remove(), 220); }
  const OK = '<svg class="ay-ok" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg>';
  function borrarConv(id){
    const i = (A.hist || []).findIndex(c => c.id === id); if (i < 0) return;
    const [c] = A.hist.splice(i, 1);
    if (A.conv && A.conv.id === id) { A.conv = null; A.items = []; }
    A.hBorrar = null; repintarMov(); guardarHistYa();
    clearTimeout(deshacer && deshacer.t);
    deshacer = {c, i, t: setTimeout(() => { deshacer = null; quitarAviso(); }, 5000)};
    avisoPanel(`${OK}Conversación borrada<button type="button" data-ay-deshacer="1">Deshacer</button>`);
  }
  function deshacerBorrado(){
    if (!deshacer) return; clearTimeout(deshacer.t);
    const {c, i} = deshacer; deshacer = null;
    A.hist.splice(Math.min(i, A.hist.length), 0, c); pintar(); guardarHistYa(); quitarAviso();
    const fila = document.querySelector(`#ay-panel [data-ay-hk="${CSS.escape(c.id)}"]`);
    if (fila && fila.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) fila.animate([{opacity: 0, transform: 'translateY(-6px) scale(.98)'}, {opacity: 1, transform: 'none'}], {duration: 360, easing: 'cubic-bezier(.16,1,.3,1)'});
  }
  function borrarTodo(){
    A.hist = []; A.hTodo = false; A.conv = null; A.items = [];
    clearTimeout(deshacer && deshacer.t); deshacer = null;
    repintarMov(); guardarHistYa();
    avisoPanel(`${OK}Historial borrado`);
    setTimeout(quitarAviso, 3000);
  }
  function historial(){
    if (!A.hist) { cargarHist().then(() => { if (A.vista === 'historial') pintar(); }); return '<p class="ay-cargando">Cargando…</p>'; }
    const grupos = new Map();
    for (const c of A.hist) { const [g, h] = cuandoHist(c.en); if (!grupos.has(g)) grupos.set(g, []); grupos.get(g).push([c, h]); }
    const n = c => (c.items || []).filter(p => p.y !== undefined).length;
    const tabs = `<div class="ay-htabs" role="tablist"><button type="button" role="tab" data-ay-htab="conv" aria-selected="${A.htab === 'conv'}">Conversaciones</button><button type="button" role="tab" data-ay-htab="sol" aria-selected="${A.htab === 'sol'}">Solicitudes${A.sinVer ? ` <i>· ${A.sinVer}</i>` : ''}</button></div>`;
    if (A.htab === 'sol') return tabs + solicitudesHTML();
    return tabs + `<div class="ay-sec"><div class="ay-hcab"><h4 class="ay-h">Tus conversaciones</h4><button type="button" class="ay-hnueva" data-ay-nueva="1">${IC.mas}Nueva</button></div>
      ${A.hist.length ? [...grupos].map(([g, cs]) => `<small>${g}</small><div class="ay-hl">${cs.map(([c, h]) => `${A.hBorrar === c.id
        ? `<div class="ay-hi ay-hconf" data-ay-hk="${esc(c.id)}"><span>¿Borrar «${esc(c.t)}»?</span><button type="button" class="ay-hbb" data-ay-hborrarok="${esc(c.id)}">${IC.basura}Borrar</button><button type="button" class="ay-hbx" data-ay-hcancelar="1" aria-label="Cancelar">${IC.x}</button></div>`
        : `<div class="ay-hi-w" data-ay-hk="${esc(c.id)}"><button type="button" class="ay-hi${A.conv && A.conv.id === c.id ? ' on' : ''}" data-ay-conv="${esc(c.id)}"><i>${IC.reloj}</i><em>${esc(c.t)}<small>${esc(h)} · ${n(c)} ${n(c) === 1 ? 'pregunta' : 'preguntas'}</small></em>${IC.chev}</button><button type="button" class="ay-hbt" data-ay-hborrar="${esc(c.id)}" aria-label="Borrar «${esc(c.t)}»">${IC.basura}</button></div>`}`).join('')}</div>`).join('') : '<p class="ay-vacio">Todavía no tienes conversaciones. Pregúntame algo y queda aquí.</p>'}</div>
      <p class="ay-hnota">Se guardan en tu cuenta las últimas 20, también en el celular.</p>
      ${A.hist.length ? (A.hTodo ? `<div class="ay-htconf"><b>¿Borrar ${A.hist.length === 1 ? 'la conversación' : `las ${A.hist.length} conversaciones`}?</b><span>No se puede deshacer.</span><div><button type="button" class="ay-hbb" data-ay-htodook="1">${IC.basura}Borrar todo</button><button type="button" class="ay-hbx" data-ay-hcancelar="1" aria-label="Cancelar">${IC.x}</button></div></div>` : '<button type="button" class="ay-htodo" data-ay-htodo="1">Borrar todo el historial</button>') : ''}`;
  }
  function solicitudesHTML(){
    if (!A.sol) { cargarSol(); return '<p class="ay-cargando">Cargando…</p>'; }
    if (!A.sol.length) return '<p class="ay-vacio">Todavía no le has escrito a soporte. Si algo no te funciona, pregúntame y te paso con el equipo.</p>';
    const tema = s => (TEMAS_SOP.find(x => x[0] === s.tema) || [, s.asunto])[1];
    return `<div class="ay-sl-lista">${A.sol.map(s => { const [et, ek] = ESTADO_SOL(s), [g, h] = cuandoHist(s.creada);
      return `<button type="button" class="ay-sfila" data-ay-sol="${esc(s.numero)}"><em><b>${esc(s.asunto || tema(s))}</b><small>#${esc(s.numero)} · ${g === 'Hoy' ? 'hoy, ' + esc(h) : esc(h)}</small></em><span class="ay-sest ${ek === 'ok' && et === 'Resuelta' ? 'ok' : et === 'Respondida' ? 'w' : 'g'}">${et}</span></button>`; }).join('')}</div>`;
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
    f.replaceChildren(); f.insertAdjacentHTML('beforeend', A.abierto ? IC.x : `${GLOBO}${ASTRO}${A.sinVer ? `<span class="ay-fab-n" aria-label="${A.sinVer} ${A.sinVer === 1 ? 'respuesta nueva' : 'respuestas nuevas'} de soporte">${A.sinVer}</span>` : '<span class="ay-fab-hola" aria-hidden="true">¿Te ayudo?</span>'}`);
    let av = document.getElementById('ay-aviso');
    const s = !A.abierto && A.aviso;
    if (!s) { if (av) { av.classList.add('sale'); setTimeout(() => av.remove(), 200); } return; }
    const m = [...s.mensajes].reverse().find(x => x.autor === 'soporte');
    if (!av) { document.body.insertAdjacentHTML('beforeend', '<div class="ay-aviso" id="ay-aviso" role="status"></div>'); av = document.getElementById('ay-aviso'); }
    av.replaceChildren();
    av.insertAdjacentHTML('beforeend', `<div class="ay-av-c"><span class="ay-av">${esc(String(m ? m.nombre : 'S').slice(0, 2).toUpperCase())}</span><div><b>Soporte te respondió</b><small>${esc(m ? m.texto : '')}</small></div><button type="button" class="ay-av-x" data-ay-avisox="1" aria-label="Cerrar aviso">${IC.x}</button></div><button type="button" class="btn pri" data-ay-versol="${esc(s.numero)}">Ver respuesta</button>`);
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
    if (PIDE_PERSONA.test(t)) return 'SOPORTE';
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
      if (charla === 'SOPORTE') { guardarConv(); abrirFormSoporte(); return; }
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
    if (t.closest('[data-ay-fab]')) { A.abierto = !A.abierto; A.aviso = null; if (A.abierto && A.sinVer) { A.vista = 'historial'; A.htab = 'sol'; verVistas(); } pintar(); if (A.abierto && !A.hist) cargarHist().then(() => { if (A.abierto && A.vista === 'inicio') pintar(); }); return; }
    if (t.closest('[data-ay-avisox]')) { A.aviso = null; pintarFab(); return; }
    const vs = t.closest('[data-ay-versol]'); if (vs) { A.abierto = true; A.aviso = null; abrirSolicitud(vs.dataset.ayVersol); return; }
    if (!t.closest('#ay-panel')) return;
    const g = (attr, fn) => { const b = t.closest(`[${attr}]`); if (!b) return false; fn(b.getAttribute(attr)); return true; };
    if (g('data-ay-cerrar', () => { A.abierto = false; pintar(); })) return;
    if (g('data-ay-sop', v => abrirFormSoporte(v))) return;
    if (g('data-ay-stema', v => { const f = leerForm(); if (f) { f.tema = v; pintar(); } })) return;
    if (g('data-ay-htab', v => { A.htab = v; if (v === 'sol') { verVistas(); if (!A.sol) cargarSol(); } pintar(); })) return;
    if (g('data-ay-sol', v => abrirSolicitud(v))) return;
    if (g('data-ay-sresp', v => { const [n, a] = v.split('|'); cambiarSol(n, a); })) return;
    if (g('data-ay-guia', id => abrirGuia(id))) return;
    if (g('data-ay-todas', () => { A.vista = 'todas'; A.tema = null; pintar(); })) return;
    if (g('data-ay-tema', v => { A.vista = 'todas'; A.tema = v || null; pintar(); })) return;
    if (g('data-ay-inicio', () => { A.vista = A.vista === 'todas' && A.items.length ? 'chat' : 'inicio'; if (A.vista === 'inicio') { A.items = []; A.conv = null; } pintar(); })) return;
    if (g('data-ay-nueva', () => { A.items = []; A.conv = null; A.vista = 'inicio'; pintar(); const i = document.getElementById('ay-q'); if (i) i.focus(); })) return;
    if (g('data-ay-hist', () => { A.vista = A.vista === 'historial' ? (A.items.length ? 'chat' : 'inicio') : 'historial'; pintar(); })) return;
    if (g('data-ay-hborrar', id => { A.hBorrar = id; A.hTodo = false; pintar(); const b = document.querySelector('[data-ay-hborrarok]'); if (b) b.focus(); })) return;
    if (g('data-ay-hcancelar', () => { A.hBorrar = null; A.hTodo = false; pintar(); })) return;
    if (g('data-ay-hborrarok', id => borrarConv(id))) return;
    if (g('data-ay-htodo', () => { A.hTodo = true; A.hBorrar = null; pintar(); const b = document.querySelector('[data-ay-htodook]'); if (b) b.focus(); })) return;
    if (g('data-ay-htodook', () => borrarTodo())) return;
    if (g('data-ay-deshacer', () => deshacerBorrado())) return;
    if (g('data-ay-conv', id => { const c = (A.hist || []).find(x => x.id === id); if (!c) return; A.conv = {id: c.id, en: c.en}; A.items = (c.items || []).slice(); A.vista = 'chat'; pintar(); })) return;
    if (g('data-ay-ir', id => { const x = guia(id); if (x) llevar(x); })) return;
    if (g('data-ay-util', v => {
      const [id, si] = v.split('|'), caja = t.closest('[data-ay-utilde]');
      crmApi('POST', '/crm/ayuda/util', {guia: id, util: si === '1'}).catch(() => { /* no importa */ });
      if (caja) { caja.replaceChildren(); caja.insertAdjacentHTML('beforeend', si === '1' ? '<span class="ay-gracias">¡Qué bien! Gracias por contarnos.</span>' : '<span class="ay-gracias">Gracias. Vamos a mejorar esta guía.</span>'); }
      if (si !== '1') { A.items.push({s: guia(id) ? guia(id).t : ''}); guardarConv(); pintar(); }
    })) return;
  });
  document.addEventListener('change', e => { if (e.target.id === 'ay-sfile') subirCaptura(e.target.files && e.target.files[0]); });
  document.addEventListener('submit', e => {
    if (e.target.id === 'ay-sform') { e.preventDefault(); enviarSoporte(); return; }
    if (e.target.id !== 'ay-form') return;
    e.preventDefault(); const i = document.getElementById('ay-q'); const v = i.value; i.value = ''; preguntar(v);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (document.getElementById('ay-foco')) quitarFoco(); else if (A.abierto && (A.hBorrar || A.hTodo)) { A.hBorrar = null; A.hTodo = false; pintar(); } else if (A.abierto) { A.abierto = false; pintar(); } } });
  addEventListener('resize', quitarFoco);
  // La burbuja aparece cuando el CRM ya cargó.
  // El correo de una respuesta trae ?ayuda=solicitudes: se lee ya, porque el CRM limpia la dirección al cargar.
  const DESDE_CORREO = (() => { try { return new URLSearchParams(window.top.location.search).get('ayuda') === 'solicitudes'; } catch { return false; } })();
  const arrancar = () => {
    if (!document.body) { setTimeout(arrancar, 200); return; }
    pintarFab(); cargarSol();
    if (DESDE_CORREO) { A.abierto = true; A.vista = 'historial'; A.htab = 'sol'; pintar(); verVistas(); }
  };
  // La respuesta del equipo llega en vivo (80-datos.js reenvía el evento) y, por si se pierde, se pregunta cada 2 minutos.
  addEventListener('wali-soporte', cargarSol);
  setInterval(() => { if (document.visibilityState === 'visible') cargarSol(); }, 120_000);
  setTimeout(arrancar, 400);
  // Para la prueba de guías (y para quien la quiera usar desde la consola).
  window.ayudaDecidir = (q, sem) => { const d = decidir(buscar(q), sem); return {nivel: d.nivel, top: d.orden.slice(0, 3).map(g => g.id)}; };
  window.ayudaBuscar = q => { const r = buscar(q); return {entendio: !!entendio(r) || !!probable(r), seguro: !!entendio(r), todo: r.lista.slice(0, 12).map(x => [x.g.id, +x.s.toFixed(2)]), top: r.lista.slice(0, 3).map(x => [x.g.id, +x.s.toFixed(2), +x.cubre.toFixed(2)])}; };

  document.head.insertAdjacentHTML('beforeend', `<style>
.ay-fab{position:fixed;right:22px;bottom:22px;width:56px;height:56px;border-radius:50%;background:#FFD21F;color:#0b0b10;display:grid;place-items:center;box-shadow:0 8px 24px -6px rgba(11,11,16,.35);z-index:240;border:0;cursor:pointer;transition:transform .25s cubic-bezier(.16,1,.3,1)}
.ay-fab.abierta:hover{transform:scale(1.05)}
.ay-fab svg{width:26px;height:26px;display:block;stroke-width:1.9}
.ay-fab:not(.abierta){width:64px;height:60px;border-radius:0;background:none;box-shadow:none;overflow:visible;filter:drop-shadow(0 10px 16px rgba(11,11,16,.22)) drop-shadow(0 2px 3px rgba(11,11,16,.12));animation:ay-flota 3.2s cubic-bezier(.45,0,.55,1) infinite;transition:opacity .2s cubic-bezier(.16,1,.3,1),transform .3s cubic-bezier(.16,1,.3,1),filter .3s cubic-bezier(.16,1,.3,1)}
.ay-fab .ay-globo{position:absolute;inset:0;width:64px;height:60px}
.ay-fab .ay-globo path{fill:#FFD21F;stroke:#e6b800;stroke-width:1}
.ay-fab:not(.abierta) .ay-astro{position:absolute;left:8px;top:2px;width:48px;height:48px;transition:transform .3s cubic-bezier(.16,1,.3,1)}
.ay-fab-hola{position:absolute;right:calc(100% + 12px);bottom:30px;background:#0b0b10;color:#fff;font-size:13px;font-weight:600;padding:7px 12px;border-radius:999px;white-space:nowrap;box-shadow:0 8px 20px -8px rgba(11,11,16,.5);opacity:0;transform:translateX(8px);pointer-events:none;transition:opacity .2s cubic-bezier(.16,1,.3,1),transform .3s cubic-bezier(.16,1,.3,1)}
@media (hover:hover){.ay-fab:not(.abierta):hover{animation:none;transform:translateY(-3px);filter:drop-shadow(0 14px 22px rgba(11,11,16,.28)) drop-shadow(0 2px 3px rgba(11,11,16,.12))}
.ay-fab:not(.abierta):hover .ay-astro{transform:rotate(-6deg)}
.ay-fab:not(.abierta):hover .ay-fab-hola{opacity:1;transform:none}}
/* Con el panel del embudo abierto, el globo se aparta: si no, tapa el botón Enviar. */
.ay-fab{transition:opacity .2s cubic-bezier(.16,1,.3,1),transform .3s cubic-bezier(.16,1,.3,1),filter .3s cubic-bezier(.16,1,.3,1)}
body:has(#ec-cajon.on) .ay-fab:not(.abierta){opacity:0;pointer-events:none;transform:translateY(12px)}
@keyframes ay-flota{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
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
.ay-hl{grid-template-columns:minmax(0,1fr)}
.ay-hi-w{position:relative;min-width:0}
.ay-hi.ay-hconf{min-width:0;max-width:100%}
.ay-hi-w .ay-hi{padding-right:50px}
.ay-hbt{position:absolute;right:9px;top:50%;width:32px;height:32px;margin-top:-16px;border:0;border-radius:9px;background:var(--bg3);color:var(--ink3);display:grid;place-items:center;cursor:pointer;opacity:0;transform:scale(.85);transition:opacity .18s cubic-bezier(.16,1,.3,1),transform .25s cubic-bezier(.16,1,.3,1),background .15s,color .15s}
.ay-hbt svg{width:16px;height:16px}
.ay-hi-w:hover .ay-hbt,.ay-hbt:focus-visible{opacity:1;transform:none}
.ay-hi-w:hover .ay-hi > svg:last-child{opacity:0}
.ay-hbt:hover,.ay-hbt:focus-visible{background:#fee2e2;color:#dc2626}
@media (hover:none){.ay-hbt{opacity:1;transform:none}.ay-hi-w .ay-hi > svg:last-child{display:none}}
.ay-hi.ay-hconf{border-color:#fecaca;background:#fff5f5;gap:8px;min-height:54px;cursor:default;animation:ay-conf .28s cubic-bezier(.16,1,.3,1)}
.ay-hconf > span{flex:1;min-width:0;font-size:13.5px;font-weight:600;color:#7f1d1d;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
@keyframes ay-conf{from{opacity:.4;transform:scale(.98)}to{opacity:1;transform:none}}
.ay-hbb{display:inline-flex;align-items:center;gap:6px;height:34px;padding:0 12px;border:0;border-radius:9px;background:#dc2626;color:#fff;font:inherit;font-size:13px;font-weight:600;cursor:pointer;flex:none;transition:background .15s,transform .15s}
.ay-hbb:hover{background:#b91c1c}.ay-hbb:active{transform:scale(.97)}
.ay-hbb svg{width:15px;height:15px}
.ay-hbx{width:34px;height:34px;border:1px solid #fecaca;border-radius:9px;background:#fff;color:#dc2626;display:grid;place-items:center;cursor:pointer;flex:none}
.ay-hbx svg{width:15px;height:15px}
.ay-htodo{align-self:flex-start;margin-top:4px;border:0;background:none;padding:6px 2px;font:inherit;font-size:13px;font-weight:600;color:#b91c1c;cursor:pointer}
.ay-htodo:hover{text-decoration:underline}
.ay-htconf{margin-top:8px;padding:12px 14px;border:1px solid #fecaca;border-radius:12px;background:#fff5f5;display:grid;gap:2px;animation:ay-conf .28s cubic-bezier(.16,1,.3,1)}
.ay-htconf b{font-size:13.5px;color:#7f1d1d}.ay-htconf > span{font-size:12.5px;color:#991b1b}
.ay-htconf div{display:flex;gap:8px;margin-top:8px}
.ay-toast{position:absolute;left:50%;bottom:86px;transform:translateX(-50%);display:flex;align-items:center;gap:10px;padding:9px 10px 9px 14px;border-radius:12px;background:#0b0b10;color:#fff;font-size:13px;white-space:nowrap;box-shadow:0 12px 30px -10px rgba(11,11,16,.5);z-index:5;animation:ay-toast .42s cubic-bezier(.16,1,.3,1)}
.ay-toast.sale{animation:ay-toast-sale .22s cubic-bezier(.23,1,.32,1) forwards}
.ay-toast button{border:0;background:none;color:#FFD21F;font:inherit;font-weight:600;padding:2px 6px;cursor:pointer;border-radius:6px}
.ay-toast button:hover{background:rgba(255,210,31,.12)}
.ay-ok{width:16px;height:16px;fill:none;stroke:#4ade80;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:24;stroke-dashoffset:24;animation:ay-check .45s cubic-bezier(.16,1,.3,1) .12s forwards}
@keyframes ay-toast{from{opacity:0;transform:translate(-50%,14px) scale(.96)}to{opacity:1;transform:translate(-50%,0)}}
@keyframes ay-toast-sale{to{opacity:0;transform:translate(-50%,8px) scale(.98)}}
@keyframes ay-check{to{stroke-dashoffset:0}}
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
.ay-sop-ir{display:flex;align-items:center;justify-content:center;gap:7px;height:40px;width:100%;border-radius:10px}
.ay-sop-ir svg{width:16px;height:16px}
.ay-sop-o{text-align:center;font-size:12px;color:var(--ink3)}.ay-sop-o a{color:inherit}
.ay-sform{display:grid;gap:10px;padding:12px;border:1px solid var(--line);border-radius:14px;background:#fff;animation:ay-sube .24s cubic-bezier(.05,.7,.1,1)}
.ay-schips{display:flex;flex-wrap:wrap;gap:6px}
.ay-schips button{height:30px;padding:0 11px;border-radius:9px;border:1px solid var(--line);background:#fff;font:inherit;font-size:12.5px;font-weight:500;cursor:pointer}
.ay-schips button[aria-pressed="true"]{background:#0b0b10;border-color:#0b0b10;color:#fff}
.ay-sl{font-size:12.5px;font-weight:600}
.ay-sform textarea{border:1.5px solid #0b0b10;border-radius:10px;padding:9px 11px;font:inherit;font-size:13.5px;line-height:1.45;resize:vertical;min-height:84px;outline:0}
.ay-sadj{display:flex;align-items:center;gap:7px;font-size:12.5px;color:#374151;cursor:pointer}.ay-sadj em{font-style:normal;color:var(--ink4)}.ay-sadj svg{width:15px;height:15px;flex:none}
.ay-spriv{display:flex;gap:8px;margin:0;padding:9px 10px;border-radius:10px;background:#f6f7f9;font-size:12px;color:var(--ink2)}.ay-spriv svg{width:15px;height:15px;flex:none;margin-top:1px}.ay-spriv b{color:#1f2937}
.ay-serr{margin:0;color:#b91c1c;font-size:12.5px}
.ay-scard{align-self:flex-end;margin-left:auto;width:84%;display:grid;gap:2px;padding:12px;border:1px solid var(--line);border-radius:14px;background:#fafafa;animation:ay-entra-der .3s cubic-bezier(.05,.7,.1,1)}
.ay-scab{display:flex;justify-content:space-between;align-items:center}.ay-scab small{font-size:11.5px;color:var(--ink3)}
.ay-scard b{font-size:13.5px}.ay-scard > span{font-size:13px;color:var(--ink2);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.ay-sest{display:inline-flex;align-items:center;justify-content:center;gap:4px;line-height:1;height:20px;padding:0 7px;border-radius:6px;font-size:11px;font-weight:600;flex:none}
.ay-sest svg{width:12px;height:12px}
.ay-sest.ok{background:#e8f8ee;color:#15803d}.ay-sest.w{background:#fff8e1;color:#7a5a00}.ay-sest.g{background:#f1f5f9;color:#4b5563}
.ay-sep{display:flex;align-items:center;gap:8px;font-size:11.5px;color:var(--ink4)}.ay-sep::before,.ay-sep::after{content:"";flex:1;height:1px;background:var(--line)}
.ay-av{width:28px;height:28px;border-radius:50%;background:#0b0b10;color:#FFD21F;display:flex;align-items:center;justify-content:center;line-height:1;font-size:11px;font-weight:700;flex:none}
.ay-quien{font-size:12px;color:var(--ink3)}.ay-quien b{color:#1f2937}
.ay-resp{border-radius:4px 14px 14px 14px;background:#fff8d6;border:1px solid #fde68a;padding:10px 12px;font-size:14px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}
.ay-equipo{animation:ay-sube .3s cubic-bezier(.05,.7,.1,1)}
.ay-sacc{display:flex;gap:6px;margin-left:37px;flex-wrap:wrap}
.ay-sacc button{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 11px;border-radius:10px;border:1px solid #e5e7eb;background:#fff;font:inherit;font-size:12.5px;font-weight:500;cursor:pointer}.ay-sacc svg{width:14px;height:14px}
.ay-htabs{display:flex;gap:4px;padding:3px;border-radius:10px;background:#f4f5f7;margin-bottom:12px}
.ay-htabs button{flex:1;padding:6px;border:0;border-radius:8px;background:none;font:inherit;font-size:12.5px;color:var(--ink3);cursor:pointer}
.ay-htabs button[aria-selected="true"]{background:#fff;font-weight:600;color:#0b0b10;box-shadow:0 1px 2px rgba(0,0,0,.08)}.ay-htabs i{font-style:normal;color:#dc2626}
.ay-sl-lista{display:grid}
.ay-sfila{display:flex;gap:10px;align-items:flex-start;padding:11px 4px;border:0;border-top:1px solid #f1f2f4;background:none;font:inherit;text-align:left;cursor:pointer}
.ay-sfila:first-child{border-top:0}.ay-sfila em{flex:1;min-width:0;font-style:normal}.ay-sfila b{display:block;font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ay-sfila small{font-size:12px;color:var(--ink3)}
.ay-fab-n{position:absolute;top:-2px;right:-2px;min-width:22px;height:22px;padding:0 6px;border-radius:99px;background:#e34948;color:#fff;font-size:11.5px;font-weight:700;line-height:1;display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px #fff;animation:ay-pop .3s cubic-bezier(.05,.7,.1,1)}
.ay-aviso{position:fixed;right:24px;bottom:96px;width:260px;background:#fff;border-radius:14px;box-shadow:0 18px 40px -18px rgba(15,23,42,.45),0 0 0 1px #e9ebef;padding:12px 14px;z-index:239;display:grid;gap:10px;animation:ay-sube .3s cubic-bezier(.05,.7,.1,1)}
.ay-aviso.sale{opacity:0;transform:translateY(6px);transition:opacity .2s cubic-bezier(.3,0,1,1),transform .2s cubic-bezier(.3,0,1,1)}
.ay-av-c{display:flex;gap:10px;align-items:flex-start}.ay-av-c > div{flex:1;min-width:0}.ay-av-c b{display:block;font-size:13px}.ay-av-c small{display:block;font-size:12px;color:var(--ink2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ay-av-x{width:26px;height:26px;border:0;border-radius:7px;background:none;color:#dc2626;display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none}.ay-av-x svg{width:14px;height:14px}
.ay-aviso .btn{justify-self:end;height:32px;padding:0 12px;font-size:12.5px}
@keyframes ay-sube{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes ay-entra-der{from{opacity:0;transform:translateX(12px)}to{opacity:1;transform:none}}
@keyframes ay-pop{from{transform:scale(.4)}to{transform:none}}
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
@media (prefers-reduced-motion:reduce){.ay-sform,.ay-scard,.ay-equipo,.ay-fab-n,.ay-aviso,.ay-fab:not(.abierta),.ay-fab-hola,.ay-toast,.ay-hconf,.ay-htconf,.ay-hbt,.ay-ok,.ay-escr i,.ay-hueco,.ay-astro .ojos,.ay-astro .antena{animation:none}.ay-ok{stroke-dashoffset:0}}
@media (max-width:760px){.ay-fab{right:16px;bottom:84px}.ay{right:16px;bottom:150px;height:min(560px,calc(100vh - 180px))}}
</style>`);
})();
