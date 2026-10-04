/* ── Capa de datos del CRM (26-sep-2026) ──
   Todo lo que la pantalla muestra viene del API (docs/crm/CONTRATO-CRM.md) y todo lo
   que la persona cambia vuelve al API. La maqueta sigue trabajando igual: muta CONV,
   CT_EXTRA, CFG y los demás objetos en su lugar; aquí se compara cada cosa con lo
   último que se sabe que está en el servidor y se manda solo la diferencia. Lo que
   llega en tiempo real se aplica en su lugar y actualiza esa foto, para no reenviarlo.

   Para los módulos (20 a 60): crmApi, crmSubir, USUARIOS, crmListo (10-nucleo.js)
   y el evento DOM «crm:evento» después de aplicar cada evento del servidor. */

const crmSoloLectura = () => !!(window.CRM_INICIO && window.CRM_INICIO.yo && window.CRM_INICIO.yo.soloLectura);
const crmErrorSoloLectura = () => Object.assign(new Error('Tu usuario es de solo lectura: puedes ver todo, pero no hacer cambios.'), {status:403});

// Token de la plataforma (GET /api/auth/token, mismo origen): se guarda 50 min y no se pide en cada llamada.
function crmToken(nuevo){
  const s = crmToken;
  if (!nuevo && s.v && Date.now() - s.en < 50 * 60e3) return Promise.resolve(s.v);
  if (s.p) return s.p;
  s.p = fetch('__BASE__/api/auth/token', {credentials:'same-origin', cache:'no-store'})
    .then(async r => {
      if (!r.ok) throw Object.assign(new Error(r.status === 401 ? 'Tu sesión se cerró. Recarga la página para volver a entrar.' : 'No se pudo validar tu sesión. Recarga la página.'), {status:r.status});
      const j = await r.json(); if (!j || !j.token) throw new Error('No se pudo validar tu sesión. Recarga la página.');
      s.v = j.token; s.en = Date.now(); return s.v;
    })
    .finally(() => { s.p = null; });
  return s.p;
}
// Llamada al API con el token; ante un 401 pide otro token y reintenta una vez.
async function crmFetch(metodo, ruta, cuerpo, form){
  const base = String((window.CRM_INICIO && window.CRM_INICIO.api) || '').replace(/\/+$/, '');
  for (let intento = 0; ; intento++) {
    const tok = await crmToken(intento > 0);
    let r;
    try {
      r = await fetch(base + ruta, {method:metodo, cache:'no-store', headers:{Authorization:'Bearer ' + tok, ...(cuerpo !== undefined && !form ? {'Content-Type':'application/json'} : {})}, body: form || (cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined)});
    } catch { throw Object.assign(new Error('Sin conexión con el servidor. Revisa el internet e intenta de nuevo.'), {status:0}); }
    if (r.status === 401 && intento === 0) continue;
    return r;
  }
}
async function crmLeer(r){
  let j = null; try { j = await r.json(); } catch { /* sin cuerpo */ }
  if (!r.ok || (j && j.success === false)) {
    const msg = j && (typeof j.error === 'string' ? j.error : (j.error && j.error.message) || j.message);
    throw Object.assign(new Error(msg || (r.status === 404 ? 'Esa función del CRM todavía no está disponible en el servidor.' : `El servidor respondió con un error (${r.status}). Intenta de nuevo.`)), {status:r.status, campos:(j && Array.isArray(j.errors) ? j.errors : []).map(e => e && e.field).filter(Boolean)});
  }
  return j && typeof j === 'object' && 'data' in j ? j.data : j;
}
// crmApi(metodo, ruta, cuerpo?) → el `data` de {success, data}. La ruta es relativa a CRM_INICIO.api, p. ej. '/crm/lineas'.
async function crmApi(metodo, ruta, cuerpo){
  if (metodo !== 'GET' && crmSoloLectura() && !/^\/eventos\/ticket/.test(ruta)) throw crmErrorSoloLectura();
  return crmLeer(await crmFetch(metodo, ruta, cuerpo));
}
// crmSubir(file, ruta, extra) → subida multipart con el campo «archivo» (y los campos de `extra`).
async function crmSubir(file, ruta = '/crm/archivos', extra = {}){
  if (crmSoloLectura()) throw crmErrorSoloLectura();
  const fd = new FormData(); fd.append('archivo', file, file.name || 'archivo');
  for (const [k, v] of Object.entries(extra || {})) fd.append(k, typeof v === 'string' ? v : JSON.stringify(v));
  return crmLeer(await crmFetch('POST', ruta, undefined, fd));
}
// Momento del último mensaje de una conversación (para ordenar).
function crmT(c){ return Date.parse(c && c._t && (c._t.ultimo || c._t.creado)) || 0; }
// Menciones: notas de los últimos 30 días que me nombran (GET /crm/menciones).
let MENCIONES = [];
function crmMenciones(){
  return crmApi('GET', '/crm/menciones').then(l => { MENCIONES = Array.isArray(l) ? l : []; render(); }, () => {});
}
// Productos con enlaces de pago: estado de la carga para el selector de enlaces.
const crmCatalogoInfo = {cargando:false, aviso:'', error:''};

const crmDatos = (() => {
  const YO_ID = CRM_YO.id, SOLO_LECTURA = crmSoloLectura();
  const J = v => JSON.stringify(v === undefined ? null : v);
  let listo = false;
  // Quién guarda qué (lote 4, 29-sep): la configuración general, con ALCANCE.config (rol ADMIN o LIDER_VENTAS; antes de
  // cargar, el de la sesión); el ajuste `equipos`, el administrador sin equipo o quien lidera algún equipo (el API mezcla
  // por equipo y no deja tocar los ajenos); etiquetas y segmentos, cualquiera.
  const hayAlcance = () => typeof ALCANCE !== 'undefined';
  const puedeConfig = () => hayAlcance() && typeof ALCANCE.config === 'boolean' ? ALCANCE.config : !!CRM_YO.esLider;
  const puedeEquipos = () => hayAlcance() && !!(ALCANCE.todo || (Array.isArray(ALCANCE.administra) && ALCANCE.administra.length));
  const puedeGuardar = clave => DE_ASESORAS.has(clave) || (clave === 'equipos' ? puedeEquipos() : puedeConfig());
  /* El alcance propio que manda el API (GET /crm/inicio y el evento `alcance`): {todo, lidera, integra, equipos,
     administra, config}. Con el API de antes: null = ve todo; {equipos} = integrante de esos equipos. */
  function aplicarAlcance(a, equiposDelAjuste){
    if (!hayAlcance()) return;
    const lista = v => Array.isArray(v) ? v.filter(x => typeof x === 'string') : [];
    let x;
    if (!a || typeof a !== 'object') x = {todo: true, lidera: [], integra: [], equipos: [], config: !!CRM_YO.esLider};
    else if (typeof a.todo !== 'boolean') x = {todo: false, lidera: [], integra: lista(a.equipos), equipos: lista(a.equipos), config: !!CRM_YO.esLider};
    else x = {todo: a.todo, lidera: lista(a.lidera), integra: lista(a.integra), equipos: lista(a.equipos), config: !!a.config};
    x.administra = a && typeof a === 'object' && Array.isArray(a.administra) ? lista(a.administra) : x.todo ? (equiposDelAjuste || EQUIPOS.map(e => e.n)) : x.lidera;
    Object.assign(ALCANCE, x, {on: !x.todo});
  }
  const avisarAlcance = () => document.dispatchEvent(new CustomEvent('crm:alcance'));
  // Perdió el acceso al CRM (lo sacaron de su último equipo): ya no ve ningún equipo, aunque antes fuera líder.
  function sinAcceso(mensaje){
    if (hayAlcance()) Object.assign(ALCANCE, {todo: false, lidera: [], integra: [], equipos: [], administra: [], on: true});
    if (typeof crmSinAcceso === 'function') crmSinAcceso(mensaje);
  }

  /* ── Tiempos: textos de la maqueta calculados desde las marcas del API (hora de Colombia) ── */
  const durTxt = m => m < 60 ? `${m} min` : m < 48 * 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${Math.floor(m / 1440)} días`;
  function horaLista(t, ahora){
    const d = hcDias(t, ahora), p = hcPartes(t);
    if (d <= 0) return `${((p.h + 11) % 12) + 1}:${String(p.mi).padStart(2, '0')}`;
    if (d === 1) return 'Ayer';
    if (d < 7) return ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][p.w];
    return `${p.d} ${HC_MES[p.m].replace('.', '')}`;
  }
  // El texto sigue la maqueta: la ventana cerrada siempre dice «cerrada» (así la detecta la pantalla).
  function ventanaDe(c, ahora){
    const e = Date.parse((c._t || {}).entrante) || 0, resta = e ? e + 864e5 - ahora : -1;
    const q = resta >= 3600e3 ? `${Math.floor(resta / 3600e3)} h` : `${Math.max(1, Math.ceil(resta / 60e3))} min`;
    if (c.canal === 'web') return 'Chat de la web: la respuesta le aparece en la burbuja de la página';
    if (c.canal === 'mail') return 'Correo: no tiene ventana de 24 h';
    if (c.canal === 'ig') return resta > 0 ? `Instagram: quedan ${q} para responder (también tiene ventana de 24 h)` : 'Instagram: la ventana de 24 h está cerrada';
    if (c.canal === 'fb') return resta > 0 ? `Messenger: quedan ${q} para responder` : 'Messenger: la ventana de 24 h está cerrada';
    if (c.canal === 'tg') return 'Telegram: no tiene ventana de 24 h';
    if (c.canal === 'tt') { const r2 = e ? e + 2 * 864e5 - ahora : -1, q2 = r2 >= 3600e3 ? `${Math.floor(r2 / 3600e3)} h` : `${Math.max(1, Math.ceil(r2 / 60e3))} min`; return r2 > 0 ? `TikTok: quedan ${q2} para responder (ventana de 48 h)` : 'TikTok: la ventana de 48 h está cerrada'; }
    return resta > 0 ? `Quedan ${q} para responder sin plantilla` : 'Ventana cerrada. Para escribirle hay que usar una plantilla.';
  }
  function tiempos(){
    const ahora = Date.now();
    for (const c of CONV) {
      const t = c._t || {}, ult = Date.parse(t.ultimo || t.creado) || ahora, esp = Date.parse(t.espera) || 0;
      c.min = Math.max(0, Math.round((ahora - ult) / 60e3));
      c.hora = horaLista(ult, ahora);
      c.esperaMin = esp && c.est !== 'finalizadas' ? Math.max(1, Math.round((ahora - esp) / 60e3)) : 0;
      c.espera = c.esperaMin ? durTxt(c.esperaMin) : null;
      c.ventana = ventanaDe(c, ahora);
    }
    for (const x of CT_EXTRA) if (x._t) { x.ultimoDias = hcDias(x._t.ultimo || x._t.creado || ahora, ahora); x.agregadoDias = hcDias(x._t.creado || ahora, ahora); }
  }
  // Separadores de día: se arman aquí, no se guardan. Los programados van al final, como en la maqueta.
  function diaTxt(t){ const d = hcDias(t), p = hcPartes(t); if (d === 0) return 'Hoy'; if (d === 1) return 'Ayer'; if (d > 1 && d < 7) return hcMay(HC_DIA[p.w]); return `${p.d} de ${HC_MES_L[p.m]}${p.y !== hcPartes(Date.now()).y ? ' de ' + p.y : ''}`; }
  function separar(msgs){
    const out = [], prog = []; let dia = null;
    for (const m of msgs) {
      if (m.d) continue;
      if (m.prog) { prog.push(m); continue; }
      if (!m._t) m._t = new Date().toISOString();
      const p = hcPartes(m._t), k = `${p.y}-${p.m}-${p.d}`;
      if (k !== dia) { out.push({d: diaTxt(m._t)}); dia = k; }
      if (m._id) m.h = hcHora(m._t);
      out.push(m);
    }
    return [...out, ...prog];
  }
  const msgLocal = m => { if (!m || typeof m !== 'object') return m; m.h = m._t ? hcHora(m._t) : 'ahora'; if (m.prog && !m.para && m._prog) m.para = m._prog; return m; };
  function prepararMensajes(c){ if (c && Array.isArray(c.msgs)) c.msgs = separar(c.msgs); }

  /* ── Formas: del API a la maqueta ── */
  const FICHA0 = {origen:'', interes:'', ciudad:'', nota:'', correo:'', compras:null, previas:[]};
  function convLocal(r){
    r.msgs = Array.isArray(r.msgs) ? r.msgs.map(msgLocal) : [];
    r.canal = r.canal || 'wa'; r.etq = Array.isArray(r.etq) ? r.etq : []; r.tags = Array.isArray(r.tags) ? r.tags : [];
    r.recs = Array.isArray(r.recs) ? r.recs : []; r.campos = r.campos && typeof r.campos === 'object' ? r.campos : {};
    r.ficha = {...FICHA0, ...(r.ficha || {})}; if (!Array.isArray(r.ficha.previas)) r.ficha.previas = [];
    r.est = r.est || 'abiertas'; r.unread = r.unread || 0; r._t = r._t || {};
    return r;
  }
  function ctLocal(k){
    const f = k.ficha || {}, cp = k.campos || {}, com = f.compras;
    return {id: 1e9 + k.contactoId, contactoId: k.contactoId, n: k.n || k.tel || 'Sin nombre', tel: k.tel || '', correo: k.correo || '', canal: k.canal || 'wa', etapa: k.etapa || '', asig: k.asig || null,
      producto: cp.producto || '', empresa: cp.empresa || '', ciudad: f.ciudad || '', origen: k.pauta ? `Anuncio de ${k.pauta.plataforma}` : (f.origen || ''), anuncio: !!k.pauta,
      tags: Array.isArray(k.tags) ? k.tags : [], cuotas: com && com.total ? [com.pagadas, com.total] : com ? [1, 1] : null, noContactar: k.noContactar ?? null, guardado: k.guardado !== false,
      ultimoDias: 0, agregadoDias: 0, _t: k._t || {}, _k: k};
  }
  const lineaLocal = l => ({id: l.id, n: l.n, tel: l.tel, estado: l.estado, calidad: l.calidad, limite: l.limite, phoneNumberId: l.phoneNumberId, ajustes: l.ajustes || {}});

  /* ── Fotos de lo que está en el servidor ── */
  const SIN_FOTO = new Set(['msgs','hora','min','espera','esperaMin','ventana','unread','id','contactoId','asigId']);
  const omitir = k => k[0] === '_' || SIN_FOTO.has(k);
  const baseConv = new Map(), baseLeido = new Map(), baseProg = new Map(), baseCt = new Map(), baseAj = new Map();
  let basePref = null;
  function fijarConv(c){ const m = new Map(); for (const k of Object.keys(c)) if (!omitir(k)) m.set(k, J(c[k])); baseConv.set(c.id, m); baseLeido.set(c.id, c.unread || 0); if (!baseProg.has(c.id)) baseProg.set(c.id, new Set()); }
  const CT_CLAVES = ['n','tel','correo','canal','etapa','asig','producto','empresa','ciudad','origen','tags','noContactar','guardado'];
  function fijarCt(x){ if (!x.contactoId) return; baseCt.set(x.contactoId, new Map(CT_CLAVES.map(k => [k, J(x[k])]))); }
  function marcarBase(c, claves){ const b = baseConv.get(c.id); if (b) for (const k of claves) b.set(k, J(c[k])); }
  /* Cambio de nombre o borrado de un equipo (solo el administrador sin equipo, 30-sep): sus conversaciones las pasa el
     API en bloque al guardar `equipos` (con `renombres`), sin repartirlas ni quitarles su persona o su subequipo, y
     también las que ya no viajan en /crm/inicio. Aquí solo cambian en pantalla: nada de un PATCH por conversación. */
  const renombres = {};   // nombre guardado → nombre nuevo, hasta que el API lo guarda
  function renombrarEquipo(viejo, nuevo){
    const orig = Object.keys(renombres).find(k => renombres[k] === viejo) || viejo;
    if (nuevo == null || nuevo === orig) delete renombres[orig]; else renombres[orig] = nuevo;
    // Borrado: pasan a Ventas, igual que en el API.
    const a = nuevo == null ? 'Ventas' : nuevo;
    for (const c of CONV) if (c.equipo === viejo) { c.equipo = a; marcarBase(c, ['equipo']); }
  }

  /* ── Ajustes del equipo por clave (contrato §4) más «material» ── */
  // Objetos de los módulos (20 a 60): si alguno no existe, esa clave no se sincroniza.
  const MOD = {
    CVCFG: () => typeof CVCFG !== 'undefined' ? CVCFG : undefined, PD: () => typeof PD !== 'undefined' ? PD : undefined,
    LLAM: () => typeof LLAM !== 'undefined' ? LLAM : undefined, LLCFG: () => typeof LLCFG !== 'undefined' ? LLCFG : undefined,
    CN: () => typeof CN !== 'undefined' ? CN : undefined, MIEMBROS: () => typeof MIEMBROS !== 'undefined' ? MIEMBROS : undefined,
    AGENTES: () => typeof AGENTES !== 'undefined' ? AGENTES : undefined, AG: () => typeof AG !== 'undefined' ? AG : undefined,
    KB: () => typeof KB !== 'undefined' ? KB : undefined,
  };
  const def = n => MOD[n]();
  const AJUSTES = {
    etapas: () => ETQ, etiquetas: () => ETIQS, respuestas: () => QR, campos: () => CAMPOS, reglas: () => REGLAS, flujos: () => FLUJOS, cfg: () => CFG,
    cvcfg: () => def('CVCFG'), pd: () => def('PD'), llam: () => def('LLAM'), llcfg: () => def('LLCFG'), cn: () => def('CN'),
    // Equipos y reparto (40-ajustes.js y 61-equipos-roles.js): los ids mandan; colores, formas de repartir, transferencias,
    // máximos por persona y, desde el lote 4, los líderes, el rol de los integrantes y los subequipos de cada equipo.
    equipos: () => { const m = def('MIEMBROS'); if (!m) return undefined; const E = typeof EQ_CFG !== 'undefined' ? EQ_CFG : null;
      if (!E) return {miembros: m};
      const eqs = Object.keys(m), deEquipos = o => Object.fromEntries(eqs.filter(eq => o && o[eq] !== undefined).map(eq => [eq, o[eq]]));
      return {miembros: m, ids: Object.fromEntries(eqs.map(eq => [eq, idsDe(eq)])), colores: E.colores, metodos: E.metodos, transferibles: E.transferibles, topes: E.topes,
        lideres: deEquipos(E.lideres), roles: deEquipos(E.roles), subequipos: deEquipos(E.subequipos)}; },
    agentes: () => def('AGENTES'), ag: () => def('AG'), kb: () => def('KB'), difusiones: () => DIFUSIONES, segmentos: () => st.ct.propios, material: () => MATERIAL,
  };
  const DE_ASESORAS = new Set(['etiquetas', 'segmentos']);
  const serial = (clave, v) => clave === 'llam' && v ? J({...v, disponibles: undefined}) : J(v);
  function rehacerEquipos(){
    const M = def('MIEMBROS'); if (!M) return; const nombres = Object.keys(M); if (!nombres.length) return;
    for (let i = EQUIPOS.length - 1; i >= 0; i--) if (!nombres.includes(EQUIPOS[i].n)) EQUIPOS.splice(i, 1);
    for (const n of nombres) if (!EQUIPOS.some(q => q.n === n)) EQUIPOS.push({id: 'eq-' + norm(n).replace(/[^a-z0-9]+/g, '-'), n, f: c => c.equipo === n});
    EQUIPOS.sort((a, b) => nombres.indexOf(a.n) - nombres.indexOf(b.n));
  }
  function aplicarAjuste(clave, v){
    const obj = AJUSTES[clave] && AJUSTES[clave](); if (obj === undefined || v === null || v === undefined) return;
    if (clave === 'segmentos') { if (Array.isArray(v)) st.ct.propios = v; return; }
    if (clave === 'equipos') {
      const M = def('MIEMBROS'); if (!M || !v || !v.miembros || typeof v.miembros !== 'object') return;
      // Los integrantes se guardan también por id (ajustes.controller equiposConIds): si alguien cambió su nombre, sale el actual.
      const ids = v.ids && typeof v.ids === 'object' ? v.ids : null;
      const nombreDe = id => (USUARIOS.find(u => u.id === id) || {}).nombre;
      for (const k of Object.keys(M)) delete M[k];
      // El nombre del servidor viene en el mismo orden que los ids: sirve para quien aún no está en USUARIOS (lo acaban de agregar).
      for (const [eq, nombres] of Object.entries(v.miembros)) M[eq] = ids && Array.isArray(ids[eq]) ? ids[eq].map((id, i) => nombreDe(id) || (Array.isArray(nombres) ? nombres[i] : null)).filter(Boolean) : (Array.isArray(nombres) ? nombres : []);
      if (typeof EQ_CFG !== 'undefined') { EQ_CFG.ids = ids ? {...ids} : {}; for (const k of ['colores', 'metodos', 'transferibles', 'topes']) EQ_CFG[k] = v[k] && typeof v[k] === 'object' ? {...v[k]} : {};
        // Líderes, rol de los integrantes y subequipos (lote 4): copias, para que ningún borrador toque lo que llegó.
        const o = x => x && typeof x === 'object' && !Array.isArray(x) ? x : {};
        EQ_CFG.lideres = Object.fromEntries(Object.entries(o(v.lideres)).map(([eq, l]) => [eq, Array.isArray(l) ? l.map(String) : []]));
        EQ_CFG.roles = Object.fromEntries(Object.entries(o(v.roles)).filter(([, r]) => typeof r === 'string'));
        EQ_CFG.subequipos = Object.fromEntries(Object.entries(o(v.subequipos)).map(([eq, l]) => [eq, (Array.isArray(l) ? l : []).filter(s => s && typeof s === 'object').map(s => ({id: String(s.id || ''), n: String(s.n || ''), ids: Array.isArray(s.ids) ? s.ids.map(String) : [], metodo: String(s.metodo || '')}))]));
        if (ids && v.miembros) for (const [eq, l] of Object.entries(ids)) (Array.isArray(l) ? l : []).forEach((id, i) => { if (!USUARIOS.some(u => u.id === id) && Array.isArray(v.miembros[eq]) && v.miembros[eq][i]) PERSONAS_EXTRA[id] = {...(PERSONAS_EXTRA[id] || {}), nombre: v.miembros[eq][i]}; }); }
      rehacerEquipos(); return;
    }
    // «Número de cliente» ya no es un campo (lo pone el CRM): si venía guardado de antes, no se muestra.
    if (clave === 'campos' && Array.isArray(v)) v = v.filter(f => f && f.k !== 'numCliente');
    if (Array.isArray(obj)) { if (Array.isArray(v)) obj.splice(0, obj.length, ...v); }
    else if (obj && typeof obj === 'object' && typeof v === 'object' && !Array.isArray(v)) Object.assign(obj, clave === 'llam' ? {...v, disponibles: obj.disponibles} : v);
    if (clave === 'etapas') { for (const k of Object.keys(COL)) delete COL[k]; ETQ.forEach(([n, c]) => { COL[n] = colorOk(c); }); }
    if (clave === 'etiquetas') recolorEtiq();
    // El disparador de pagos se llamaba «Hotmart confirma un pago» (antes del 28-sep); la API acepta los dos nombres.
    if (clave === 'reglas') REGLAS.forEach(r => { if (r && /^hotmart confirma un pago\.?$/i.test(String(r.cuando || '').trim())) r.cuando = 'Se confirma un pago'; });
  }
  // Progreso de las difusiones (ajuste «difusionesEstado»): lo escribe solo el motor del API. Se reemplaza entero y no está
  // en AJUSTES, así que nunca se manda de vuelta con PUT.
  function difEstadoDe(v){ for (const k of Object.keys(DIF_ESTADO)) delete DIF_ESTADO[k]; if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(DIF_ESTADO, v); }
  // Cada línea conectada tiene su fila en Ajustes del CRM (equipo y agente de noche).
  // El equipo elegido al conectar viaja en línea.ajustes.equipo (lo guarda el API).
  function lineasEnCfg(){ for (const l of LINEAS) if (!CFG.lineas.some(x => x.id === l.id)) CFG.lineas.push({id: l.id, eq: (l.ajustes && (l.ajustes.equipo || l.ajustes.eq)) || 'Ventas', recepcion: !!(l.ajustes && l.ajustes.recepcion)}); }
  function fijarAjustes(){ for (const clave of Object.keys(AJUSTES)) { const o = AJUSTES[clave](); if (o !== undefined) baseAj.set(clave, serial(clave, o)); } }
  // Un ajuste que llega de afuera: si aquí no hay cambios sin guardar, se aplica; si los hay, gana lo de aquí y se manda después.
  function ajusteDeAfuera(clave, v){
    const o = AJUSTES[clave] && AJUSTES[clave](); if (o === undefined) return;
    const limpio = serial(clave, o) === baseAj.get(clave) && !pendAj.has(clave);
    if (limpio) { aplicarAjuste(clave, v); baseAj.set(clave, serial(clave, AJUSTES[clave]())); } else baseAj.set(clave, serial(clave, v));
  }

  /* ── Preferencias propias (PUT /crm/preferencias) ── */
  const CLAVES_PREF = ['estado','reparto','firma','sonido','navegador','asignada','mencion','resumen','qr','corto','silenciados','borradores','favoritos'];
  const prefDe = () => { const o = {}; for (const k of CLAVES_PREF) if (AJ[k] !== undefined) o[k] = AJ[k]; return o; };
  function aplicarPref(p){ for (const k of CLAVES_PREF) if (p && k in p && p[k] !== null && p[k] !== undefined) AJ[k] = p[k]; if (!['En línea','Ocupada','Ausente'].includes(AJ.estado)) AJ.estado = 'En línea'; basePref = J(prefDe()); }

  /* ── Conversaciones: aplicar lo que llega del servidor sin pisar lo que la persona acaba de cambiar ── */
  function quitarDeSueltos(contactoId){ if (!contactoId) return; for (let i = CT_EXTRA.length - 1; i >= 0; i--) if (CT_EXTRA[i].contactoId === contactoId) CT_EXTRA.splice(i, 1); baseCt.delete(contactoId); }
  function mezclarConv(r){
    if (!r || r.id == null) return null;
    const recargar = !!r._recargar; delete r._recargar;
    r = convLocal(r);
    const c = CONV.find(x => x.id === r.id);
    if (!c) { CONV.push(r); fijarConv(r); quitarDeSueltos(r.contactoId); return r; }
    // Le llegaron mensajes de otra (unir): los completos se vuelven a pedir.
    if (recargar) c._cargada = false;
    const b = baseConv.get(c.id) || new Map();
    for (const k of Object.keys(r)) {
      if (k === 'msgs' || k === '_parcial' || k === 'id') continue;
      if (k === 'unread') { c.unread = r.unread; baseLeido.set(c.id, r.unread || 0); continue; }
      if (omitir(k)) { c[k] = r[k]; continue; }
      const bas = b.get(k);
      if (bas === undefined || J(c[k]) === bas) c[k] = r[k];
      b.set(k, J(r[k]));
    }
    baseConv.set(c.id, b);
    // Sin los mensajes completos cargados, el último que manda el servidor sirve de vista previa.
    if (!c._cargada) c.msgs = [...r.msgs, ...c.msgs.filter(m => !m._id && !m.d)];
    quitarDeSueltos(c.contactoId);
    return c;
  }
  function quitarConv(id){
    const i = CONV.findIndex(x => x.id === id); if (i < 0) return;
    CONV.splice(i, 1); baseConv.delete(id); baseLeido.delete(id); baseProg.delete(id);
    if (st.sel === id) { const pr = visibles()[0]; st.sel = pr ? pr.id : 0; }
  }
  function mezclarCt(k){
    if (!k || !k.contactoId) return;
    if (CONV.some(c => c.contactoId === k.contactoId)) { quitarDeSueltos(k.contactoId); return; }
    const n = ctLocal(k), x = CT_EXTRA.find(y => y.contactoId === k.contactoId);
    if (!x) { CT_EXTRA.unshift(n); fijarCt(n); return; }
    const b = baseCt.get(k.contactoId) || new Map();
    for (const key of Object.keys(n)) {
      if (!CT_CLAVES.includes(key)) { x[key] = n[key]; continue; }
      const bas = b.get(key); if (bas === undefined || J(x[key]) === bas) x[key] = n[key];
      b.set(key, J(n[key]));
    }
    baseCt.set(k.contactoId, b);
  }
  function quitarCt(contactoId){ const i = CT_EXTRA.findIndex(x => x.contactoId === contactoId); if (i >= 0) CT_EXTRA.splice(i, 1); baseCt.delete(contactoId); }
  function mezclarLinea(l){
    if (!l || !l.id) return; const n = lineaLocal(l), x = LINEAS.find(y => y.id === l.id);
    if (x) Object.assign(x, n); else LINEAS.push(n);
    lineasEnCfg();   // la fila nueva no se marca como guardada: el líder la manda al servidor en la próxima revisión
  }
  // Un mensaje nuevo o actualizado (estado de envío, programado que salió).
  function ponerMsg(c, m, local){
    if (!m || !m._id) return;
    const bp = baseProg.get(c.id) || new Set(); baseProg.set(c.id, bp);
    if (m.prog) { if (c._cargada) bp.add(m._id); } else bp.delete(m._id);
    let i = local ? c.msgs.indexOf(local) : -1;
    if (i < 0) i = c.msgs.findIndex(x => (x._id && x._id === m._id) || (m.cid && x.cid === m.cid));
    if (i >= 0) { c.msgs[i] = m; return; }
    if (c._cargada) { c.msgs.push(m); return; }
    if (m.prog) return;
    c.msgs = [...c.msgs.filter(x => x._id && !x.prog).slice(-4), m, ...c.msgs.filter(x => !x._id && !x.d)];
  }

  /* ── Carga inicial y resincronización ── */
  function aplicarInicio(d, primera){
    if (d.espacio && d.espacio.id) Object.assign(ESPACIO, {id: d.espacio.id, nombre: d.espacio.nombre || ''});
    pintarMarca();
    if (Array.isArray(d.conexiones)) CONEXIONES.splice(0, CONEXIONES.length, ...d.conexiones);
    if (Array.isArray(d.canales)) CX_CANALES.splice(0, CX_CANALES.length, ...d.canales);
    // Qué ve y qué administra esta persona (api alcance.ts): lo decide su rol en cada equipo; sin equipo, solo el
    // administrador ve todo. ALCANCE.on = no ve todo (la pantalla le muestra solo lo de sus equipos).
    const eqsAj = d.ajustes && d.ajustes.equipos && d.ajustes.equipos.miembros && typeof d.ajustes.equipos.miembros === 'object' ? Object.keys(d.ajustes.equipos.miembros) : null;
    aplicarAlcance(d.alcance, eqsAj);
    USUARIOS.splice(0, USUARIOS.length, ...(d.usuarios || []).map(u => ({id: u.id, nombre: u.nombre, foto: u.foto || null, rol: u.rol, estado: u.estado || 'En línea', reparto: u.reparto !== false, conectado: !!u.conectado})));
    ASESORES.splice(0, ASESORES.length, ...USUARIOS.map(u => u.nombre));
    const mio = USUARIOS.find(u => u.id === YO_ID);
    if (mio && mio.nombre && mio.nombre !== yo) renombrarLocal(mio.nombre);
    // La foto de la base manda sobre la de la sesión: es la que ven los demás (Mi perfil, «Cambiar foto»). Si cambió
    // mientras no había conexión (resincronizar), la barra propia se repinta aquí: render() no la toca.
    if (mio && mio.foto && mio.foto !== AJ.foto) { AJ.foto = mio.foto; pintarYo(); }
    LINEAS.splice(0, LINEAS.length, ...(d.lineas || []).map(lineaLocal));
    const aj = d.ajustes || {};
    difEstadoDe(aj.difusionesEstado);
    if (primera) {
      for (const clave of Object.keys(AJUSTES)) if (aj[clave] !== null && aj[clave] !== undefined) aplicarAjuste(clave, aj[clave]);
      rehacerEquipos();   // los integrantes por defecto los pone 40-ajustes.js al resolverse crmListo
      lineasEnCfg();
      aplicarPref(d.pref || {});
      CONV.splice(0, CONV.length, ...(d.conversaciones || []).map(convLocal));
      CONV.forEach(fijarConv);
      const conConv = new Set(CONV.map(c => c.contactoId));
      CT_EXTRA.splice(0, CT_EXTRA.length, ...(d.contactos || []).filter(k => !conConv.has(k.contactoId)).map(ctLocal));
      CT_EXTRA.forEach(fijarCt);
      fijarAjustes();
      // Lo que nunca se guardó (o la fila de una línea que falta en cfg) lo manda quien tiene la configuración general
      // con los valores de la pantalla, para que el servidor reparta, cierre y responda con la misma configuración que se
      // ve aquí. `equipos`, solo si además puede guardarlo (el administrador sin equipo o un líder).
      const faltaLinea = LINEAS.some(l => !((aj.cfg && aj.cfg.lineas) || []).some(x => x && x.id === l.id));
      if (puedeConfig() && !SOLO_LECTURA) for (const clave of Object.keys(AJUSTES)) if ((clave !== 'equipos' || puedeEquipos()) && (aj[clave] === null || aj[clave] === undefined || (clave === 'cfg' && faltaLinea))) baseAj.delete(clave);
      avisarAlcance();
      return;
    }
    for (const clave of Object.keys(AJUSTES)) if (aj[clave] !== null && aj[clave] !== undefined) ajusteDeAfuera(clave, aj[clave]);
    lineasEnCfg();
    const ids = new Set((d.conversaciones || []).map(c => c.id));
    for (const c of [...CONV]) if (!ids.has(c.id)) quitarConv(c.id);
    (d.conversaciones || []).forEach(mezclarConv);
    const cts = new Set((d.contactos || []).map(k => k.contactoId));
    for (const x of [...CT_EXTRA]) if (x.contactoId && !cts.has(x.contactoId)) quitarCt(x.contactoId);
    (d.contactos || []).forEach(mezclarCt);
    avisarAlcance();
  }
  async function cargar(){
    const d = await crmApi('GET', '/crm/inicio');
    aplicarInicio(d, true);
    try { await crmPlantillas(); } catch { /* sin plantillas: se ve el estado vacío */ }
    cargarCatalogo();
    listo = true;
    conectar();
  }
  // Tras una reconexión pudo haberse perdido cualquier evento: los mensajes completos se vuelven a pedir.
  // Si ya no tiene acceso al CRM (lo sacaron de su equipo), la pantalla lo dice (crmSinAcceso, 62-vistas-rol.js).
  async function resincronizar(){ try { for (const c of CONV) c._cargada = false; aplicarInicio(await crmApi('GET', '/crm/inicio'), false); crmMenciones(); repintarPronto(); } catch (err) { if (err && err.status === 403) sinAcceso(err.message); /* si no, se vuelve a intentar en la próxima reconexión */ } }
  function cargarCatalogo(){
    crmCatalogoInfo.cargando = true;
    crmApi('GET', '/crm/catalogo').then(d => {
      const lista = Array.isArray(d) ? d : (d && (d.catalogo || d.productos)) || [];
      CATALOGO.splice(0, CATALOGO.length, ...lista.map(p => ({p: p.p, c: p.c || 'Otros', id: p.id, pagos: (p.pagos || []).map(x => ({m: x.m, d: x.d || '', pr: x.pr ?? null, url: x.url || ''}))})));
      FALTANTES.splice(0, FALTANTES.length, ...((d && d.faltantes) || []));
      crmCatalogoInfo.aviso = (d && d.aviso) || ''; crmCatalogoInfo.error = '';
    }, err => { crmCatalogoInfo.error = err.message; })
      .finally(() => { crmCatalogoInfo.cargando = false; });
  }

  /* ── Mensajes: carga completa al abrir y envío de los nuevos, uno por uno y en orden ── */
  const cargandoMsgs = new Set();
  function cargarMensajes(c){
    if (!c || c._cargada || cargandoMsgs.has(c.id)) return;
    cargandoMsgs.add(c.id);
    crmApi('GET', `/crm/conversaciones/${c.id}/mensajes`).then(lista => {
      const srv = (lista || []).map(msgLocal), cids = new Set(srv.map(m => m.cid).filter(Boolean));
      c.msgs = [...srv, ...c.msgs.filter(m => !m._id && !m.d && !(m.cid && cids.has(m.cid)))];
      c._cargada = true; c._parcial = false;
      baseProg.set(c.id, new Set(srv.filter(m => m.prog && m._id).map(m => m._id)));
      repintarPronto();
    }, err => toast(err.message)).finally(() => cargandoMsgs.delete(c.id));
  }
  async function mensajesDe(id){ const lista = await crmApi('GET', `/crm/conversaciones/${id}/mensajes`); return separar((lista || []).map(msgLocal).filter(m => !m.prog)); }
  // Sin la hora visible, sin separadores y sin campos del sistema; «· ahora» no se guarda en los eventos.
  const limpiarMsg = m => { if (m.ev && typeof m.t === 'string') m.t = m.t.replace(/ · ahora$/, ''); const o = {}; for (const [k, v] of Object.entries(m)) if (k !== 'h' && k !== 'd' && k[0] !== '_') o[k] = v; return o; };
  const pendiente = m => !m._id && !m.d && !m._enviado && !m._fallo;
  async function enviarPendientes(c){
    if (c._cola) return; c._cola = true;
    try {
      for (let m; (m = c.msgs.find(pendiente)) && CONV.includes(c); ) {
        m._enviado = true; if (!m._t) m._t = new Date().toISOString();
        // Un archivo de una respuesta rápida sale solo si salió el texto que lo presenta (_tras, 56-compositor.js): si
        // el texto falló, el archivo queda fallido también y no llega suelto ni antes que el texto al reintentarlo.
        if (m._tras && m._tras._fallo) { m._fallo = true; m._estado = 'fallido'; m._error = 'el texto que lo acompaña no salió'; continue; }
        if (!m.cid) m.cid = 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        if (m.out != null && !m.prog) m._estado = 'enviando';
        repintarPronto();
        try { ponerMsg(c, msgLocal(await crmApi('POST', `/crm/conversaciones/${c.id}/mensajes`, {datos: limpiarMsg(m)})), m); }
        catch (err) {
          m._fallo = true;
          if (m.prog) { c.msgs = c.msgs.filter(x => x !== m); toast(err.message); }
          else if (m.out != null) { m._estado = 'fallido'; m._error = err.message; }
          else toast(err.message);
        }
      }
    } finally { c._cola = false; programarRevision(0); repintarPronto(); }
  }

  /* ── Revisión: qué cambió aquí y todavía no está en el servidor ── */
  let avisoRed = 0, reintento = null;
  function sinRed(){ if (Date.now() - avisoRed > 60e3) { avisoRed = Date.now(); toast('Sin conexión con el servidor: los cambios se guardan cuando vuelva'); } clearTimeout(reintento); reintento = setTimeout(() => programarRevision(0), 10e3); }
  function difConv(c){
    const b = baseConv.get(c.id); if (!b) return null;
    const out = {}; let hay = false;
    for (const k of Object.keys(c)) { if (omitir(k)) continue; const j = J(c[k]); if (b.get(k) !== j) { out[k] = c[k] === undefined ? null : c[k]; hay = true; } }
    for (const k of b.keys()) if (!(k in c)) { out[k] = null; hay = true; }
    return hay ? out : null;
  }
  // Los PATCH de una misma conversación salen de a uno, en el orden en que se hicieron los cambios.
  const colaConv = new Map();
  function enColaConv(id, fn){
    const p = (colaConv.get(id) || Promise.resolve()).then(fn, fn);
    colaConv.set(id, p); p.finally(() => { if (colaConv.get(id) === p) colaConv.delete(id); }).catch(() => {});
    return p;
  }
  // ¿La sigue viendo según su alcance (api alcance.ts, veConv)? Todo, si ve todo el CRM; las de los equipos que lidera
  // (sin equipo = Ventas); las demás, solo si son suyas y no son «solo líder».
  function veConvAqui(r){
    if (typeof ALCANCE === 'undefined' || !ALCANCE.on || ALCANCE.todo) return true;
    if ((ALCANCE.lidera || []).includes(r.equipo || 'Ventas')) return true;
    return r.asigId === YO_ID && !r.soloLider;
  }
  function patchConv(c, cambios){
    const b = baseConv.get(c.id), prev = {};
    for (const k of Object.keys(cambios)) { prev[k] = b.get(k); if (k in c) b.set(k, J(cambios[k])); else b.delete(k); }
    if ('asig' in cambios) c.asigId = (USUARIOS.find(u => u.nombre === c.asig) || {}).id || null;
    enColaConv(c.id, () => crmApi('PATCH', `/crm/conversaciones/${c.id}`, {cambios})).then(r => {
      // Con su propio cambio (la pasó a otra persona o a otro equipo) pudo dejar de verla: el API ya le mandó
      // conv-borrada, que a veces llega antes que esta respuesta. Entonces no se vuelve a meter en la bandeja.
      if (r && r.id != null && !veConvAqui(r)) quitarConv(r.id); else mezclarConv(r);
      repintarPronto();
    }, err => {
      if (!CONV.includes(c)) return;
      if (err.status >= 400 && err.status < 500) {
        // El servidor no lo aceptó: vuelve lo que había y se dice por qué.
        for (const [k, pj] of Object.entries(prev)) {
          if (J(c[k]) !== J(cambios[k])) continue;
          if (pj === undefined) { delete c[k]; b.delete(k); } else { c[k] = JSON.parse(pj); b.set(k, pj); }
        }
        toast(err.message); repintarPronto();
      } else { for (const [k, pj] of Object.entries(prev)) { if (pj === undefined) b.delete(k); else b.set(k, pj); } sinRed(); }
    });
  }
  function revisarConv(c){
    if (c.msgs.some(pendiente)) enviarPendientes(c);
    // Programados que la persona canceló.
    const bp = baseProg.get(c.id);
    if (c._cargada && bp && bp.size) {
      const hay = new Set(c.msgs.filter(m => m.prog && m._id).map(m => m._id));
      for (const id of [...bp]) if (!hay.has(id)) { bp.delete(id); crmApi('DELETE', `/crm/conversaciones/${c.id}/mensajes/${encodeURIComponent(id)}`).catch(err => { toast(err.message); c._cargada = false; cargarMensajes(c); }); }
    }
    if (c._cola) return;   // primero salen los mensajes (la encuesta antes de finalizar)
    const d = difConv(c); if (d) patchConv(c, d);
    if (!c.unread && (baseLeido.get(c.id) || 0) > 0) { baseLeido.set(c.id, 0); crmApi('POST', `/crm/conversaciones/${c.id}/leer`).then(r => { mezclarConv(r); }).catch(() => {}); }
  }
  function ctAServidor(x, cambios){
    const k = x._k || {}, out = {};
    for (const [key, v] of Object.entries(cambios)) {
      if (key === 'producto' || key === 'empresa') out.campos = {...(out.campos || k.campos || {}), [key]: v};
      else if (key === 'ciudad' || key === 'origen') out.ficha = {...(out.ficha || k.ficha || {}), [key]: v};
      else out[key] = key === 'noContactar' && v === false ? null : v;
    }
    return out;
  }
  function revisarContactos(){
    for (const x of CT_EXTRA) {
      if (!x.contactoId) {
        if (x._creando) continue; x._creando = true;
        crmApi('POST', '/crm/contactos', {contacto: {n: x.n, tel: x.tel, correo: x.correo, canal: x.canal || 'wa', etapa: x.etapa || null, asig: x.asig || null, tags: x.tags || [], campos: {producto: x.producto || '', empresa: x.empresa || ''}, ficha: {ciudad: x.ciudad || '', origen: x.origen || ''}, guardado: true}})
          .then(k => { const n = ctLocal(k); if (CONV.some(c => c.contactoId === k.contactoId) || CT_EXTRA.some(y => y !== x && y.contactoId === k.contactoId)) { /* el evento del SSE llegó primero: esa fila ya está */ const i = CT_EXTRA.indexOf(x); if (i >= 0) CT_EXTRA.splice(i, 1); } else { const recien = x.recien; Object.assign(x, n, recien ? {recien} : {}); fijarCt(x); } delete x._creando; repintarPronto(); },
            err => { const i = CT_EXTRA.indexOf(x); if (i >= 0) CT_EXTRA.splice(i, 1); toast(err.message); repintarPronto(); });
        continue;
      }
      const b = baseCt.get(x.contactoId); if (!b) continue;
      const cambios = {}; let hay = false;
      for (const k of CT_CLAVES) { const j = J(x[k]); if (b.get(k) !== j) { cambios[k] = x[k] === undefined ? null : x[k]; hay = true; } }
      if (!hay) continue;
      const prev = {}; for (const k of Object.keys(cambios)) { prev[k] = b.get(k); b.set(k, J(cambios[k])); }
      crmApi('PATCH', `/crm/contactos/${x.contactoId}`, {cambios: ctAServidor(x, cambios)}).then(k => { x._k = k; mezclarCt(k); repintarPronto(); }, err => {
        if (err.status >= 400 && err.status < 500) { for (const [k, pj] of Object.entries(prev)) if (J(x[k]) === J(cambios[k])) { x[k] = JSON.parse(pj); b.set(k, pj); } toast(err.message); repintarPronto(); }
        else { for (const [k, pj] of Object.entries(prev)) b.set(k, pj); sinRed(); }
      });
    }
    // Contactos que se quitaron de la lista.
    for (const id of [...baseCt.keys()]) if (!CT_EXTRA.some(x => x.contactoId === id) && !CONV.some(c => c.contactoId === id)) { baseCt.delete(id); crmApi('DELETE', `/crm/contactos/${id}`).catch(err => toast(err.message)); }
  }
  const pendAj = new Map(), timersAj = new Map();
  function revisarAjustes(){
    for (const clave of Object.keys(AJUSTES)) {
      if (!puedeGuardar(clave)) continue;
      const o = AJUSTES[clave](); if (o === undefined) continue;
      const j = serial(clave, o); if (j === baseAj.get(clave) || j === pendAj.get(clave)) continue;
      pendAj.set(clave, j); clearTimeout(timersAj.get(clave)); timersAj.set(clave, setTimeout(() => guardarAjuste(clave), 600));
    }
  }
  // Un guardado por clave a la vez: si dos PUT de la misma clave viajaran juntos, el viejo podría llegar de último y pisar al nuevo.
  const colaAj = new Map();
  function guardarAjuste(clave){
    const p = (colaAj.get(clave) || Promise.resolve()).then(() => guardarAjusteYa(clave));
    colaAj.set(clave, p); p.finally(() => { if (colaAj.get(clave) === p) colaAj.delete(clave); });
    return p;
  }
  async function guardarAjusteYa(clave){
    pendAj.delete(clave);
    const j = serial(clave, AJUSTES[clave]()), prev = baseAj.get(clave); if (j === prev) return;
    baseAj.set(clave, j);
    // Los equipos llevan además los cambios de nombre que todavía no guardó el API (renombrarEquipo).
    const ren = clave === 'equipos' && Object.keys(renombres).length ? {...renombres} : null;
    try {
      await crmApi('PUT', `/crm/ajustes/${encodeURIComponent(clave)}`, {valor: ren ? {...JSON.parse(j), renombres: ren} : JSON.parse(j)});
      if (ren) for (const [k, v] of Object.entries(ren)) if (renombres[k] === v) delete renombres[k];
    }
    catch (err) {
      baseAj.set(clave, prev);
      if (err.status >= 400 && err.status < 500) {
        if (serial(clave, AJUSTES[clave]()) === j && prev) aplicarAjuste(clave, JSON.parse(prev));
        // No se guardó: el nombre vuelve a ser el de antes y las conversaciones vuelven a tener el suyo.
        if (ren) { for (const k of Object.keys(ren)) delete renombres[k]; resincronizar(); }
        toast(err.message); repintarPronto();
      }
      else sinRed();
    }
  }
  // Guarda ya lo pendiente de esas claves, sin esperar la revisión ni los 600 ms. Lo usa el chat de prueba del
  // agente (pregunta con la base de conocimiento que se ve en pantalla) y la subida de documentos (el agente
  // encendido los lee desde el siguiente mensaje).
  async function guardarYa(claves){
    if (SOLO_LECTURA || !listo) return;
    revisarAjustes();
    await Promise.all(claves.filter(k => AJUSTES[k]).map(k => {
      if (pendAj.has(k)) { clearTimeout(timersAj.get(k)); return guardarAjuste(k); }
      return colaAj.get(k) || Promise.resolve();
    }));
  }
  let timerPref = null;
  function revisarPref(){
    if (J(prefDe()) === basePref) return;
    clearTimeout(timerPref);
    timerPref = setTimeout(async () => {
      const v = prefDe(), j = J(v), prev = basePref; if (j === prev) return;
      basePref = j; const mio = USUARIOS.find(u => u.id === YO_ID); if (mio) mio.estado = AJ.estado;
      try { await crmApi('PUT', '/crm/preferencias', {valor: v}); }
      catch (err) { basePref = prev; if (err.status >= 400 && err.status < 500) { toast(err.message); } else sinRed(); }
    }, 600);
  }
  // Solo lectura: nada se escribe; lo que se intentó cambiar vuelve como estaba.
  function revertirTodo(){
    let hubo = false;
    for (const c of CONV) {
      const b = baseConv.get(c.id); if (!b) continue;
      for (const [k, j] of b) if (J(c[k]) !== j) { c[k] = JSON.parse(j); hubo = true; }
      for (const k of Object.keys(c)) if (!omitir(k) && !b.has(k)) { delete c[k]; hubo = true; }
      const n = c.msgs.length; c.msgs = c.msgs.filter(m => m._id || m.d); if (c.msgs.length !== n) hubo = true;
      const bp = baseProg.get(c.id); if (c._cargada && bp && [...bp].some(id => !c.msgs.some(m => m._id === id))) { c._cargada = false; cargarMensajes(c); hubo = true; }
      if (!c.unread && baseLeido.get(c.id)) baseLeido.set(c.id, 0);
    }
    for (let i = CT_EXTRA.length - 1; i >= 0; i--) { const x = CT_EXTRA[i]; if (!x.contactoId) { CT_EXTRA.splice(i, 1); hubo = true; continue; } const b = baseCt.get(x.contactoId); if (b) for (const [k, j] of b) if (J(x[k]) !== j) { x[k] = JSON.parse(j); hubo = true; } }
    for (const clave of Object.keys(AJUSTES)) { const o = AJUSTES[clave](); if (o !== undefined && serial(clave, o) !== baseAj.get(clave) && baseAj.get(clave)) { aplicarAjuste(clave, JSON.parse(baseAj.get(clave))); hubo = true; } }
    if (basePref && J(prefDe()) !== basePref) { aplicarPref(JSON.parse(basePref)); pintarYo(); hubo = true; }
    return hubo;
  }
  let avisoLectura = 0;
  function revisar(){
    if (!listo) return;
    try {
      // El aviso tapa cualquier «guardado» o «borrada» que la pantalla alcanzó a mostrar: nada de eso se hizo.
      if (SOLO_LECTURA) { if (revertirTodo()) { const MSG = crmErrorSoloLectura().message; if (Date.now() - avisoLectura > 4000 || document.getElementById('toast').textContent !== MSG) { avisoLectura = Date.now(); toast(MSG); } repintarPronto(); } return; }
      for (const c of [...CONV]) revisarConv(c);
      revisarContactos(); revisarAjustes(); revisarPref();
    } catch (err) { console.warn('[CRM] revisión', err); }
  }
  let timerRev = null;
  function programarRevision(ms = 150){ if (timerRev) return; timerRev = setTimeout(() => { timerRev = null; revisar(); }, ms); }
  // Después de cada acción de la persona se revisa; además, una revisión suave cada pocos segundos.
  const soloEscribe = e => (e.type === 'input' || e.type === 'keydown') && e.target && /^(ta|q|lk-q|nm-para|nm-txt|ct-q|tag-q)$/.test(e.target.id || '');
  ['click', 'change', 'input', 'keydown', 'drop', 'submit'].forEach(t => document.addEventListener(t, e => { if (!soloEscribe(e)) programarRevision(); }, true));
  setInterval(() => programarRevision(0), 8000);

  /* ── Repintar lo que llega de afuera sin estorbar a quien escribe ── */
  let timerPintar = null, pintarPendiente = false;
  function ocupado(){
    const a = document.activeElement;
    if (a && a !== document.body && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) && a.id !== 'ta' && a.id !== 'q' && a.closest('#page, #panel, #ov-x, #ov, #ov-res')) return true;
    return !!document.querySelector('#panel .menu:not([hidden]), #page .menu:not([hidden]), #page .eqr-menu');
  }
  function repintarPronto(){
    if (timerPintar || !listo) return;
    timerPintar = setTimeout(() => { timerPintar = null; if (ocupado()) { pintarPendiente = true; return; } pintarPendiente = false; render(); }, 120);
  }
  const pintarSiQuedo = () => setTimeout(() => { if (pintarPendiente && !ocupado()) { pintarPendiente = false; render(); } }, 60);
  document.addEventListener('focusout', pintarSiQuedo, true);
  document.addEventListener('click', pintarSiQuedo);
  // Los tiempos («hace 5 min», la ventana de 24 h, los recordatorios) se actualizan solos.
  setInterval(() => { if (!document.hidden) repintarPronto(); }, 30e3);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) repintarPronto(); });

  /* ── Tiempo real: ticket de un solo uso y EventSource; si se cae, otro ticket a los 5 s ── */
  let es = null, reconexion = null, yaConecto = false;
  async function conectar(){
    clearTimeout(reconexion); if (es) { es.close(); es = null; }
    try {
      const d = await crmApi('POST', '/eventos/ticket', SOLO_LECTURA ? undefined : {origen: 'crm'});
      const base = String((window.CRM_INICIO && window.CRM_INICIO.api) || '').replace(/\/+$/, '');
      const fuente = new EventSource(`${base}/eventos?ticket=${encodeURIComponent(d.ticket)}`); es = fuente;
      fuente.addEventListener('conectado', () => { if (yaConecto) resincronizar(); yaConecto = true; });
      fuente.addEventListener('crm', e => { let x; try { x = JSON.parse(e.data); } catch { return; } aplicarEvento(x); });
      fuente.onerror = () => { fuente.close(); if (es === fuente) es = null; clearTimeout(reconexion); reconexion = setTimeout(conectar, 5000); };
    } catch { clearTimeout(reconexion); reconexion = setTimeout(conectar, 5000); }
  }
  function aplicarEvento(d){
    try {
      switch (d && d.tipo) {
        case 'conv': {
          // Una que según su alcance ya no ve (un evento que salió con el alcance de antes de un cambio de rol) se quita.
          if (d.conv && d.conv.id != null && !veConvAqui(d.conv)) { quitarConv(d.conv.id); break; }
          const nueva = !!d.conv && !CONV.some(x => x.id === d.conv.id), c = mezclarConv(d.conv);
          // Se la acaban de pasar: la nota de «Transferir» que la menciona se guardó antes, así que sus Menciones cambian.
          if (nueva && c && c.asigId === YO_ID) crmMenciones();
          break;
        }
        case 'conv-borrada': quitarConv(d.id); break;
        case 'msg': { const c = CONV.find(x => x.id === d.convId); if (c && d.msg) { const m = msgLocal(d.msg); ponerMsg(c, m); if (m.in && d.por == null) avisarEntrante(c, m); if (m.note && Array.isArray(m.menciones) && m.menciones.includes(CRM_YO.nombre)) crmMenciones(); } break; }
        case 'msg-borrado': { const c = CONV.find(x => x.id === d.convId); if (c) { c.msgs = c.msgs.filter(m => m._id !== d.msgId); const bp = baseProg.get(c.id); if (bp) bp.delete(d.msgId); } break; }
        case 'contacto': mezclarCt(d.contacto); break;
        case 'contacto-borrado': quitarCt(d.id); break;
        case 'contactos-importados': resincronizar(); break;
        case 'ajuste': if (d.clave === 'difusionesEstado') difEstadoDe(d.valor); else ajusteDeAfuera(d.clave, d.valor); break;
        // Mi estado cambiado en otra sesión mía (otra pestaña, el celular): se ve aquí también, con el reparto que deja
        // ponerEstado (Ausente lo apaga, En línea lo prende). El API manda siempre por = quien cambió, así que no sirve para
        // saber si fue esta sesión; el eco del cambio propio llega con el mismo estado y no hace nada.
        case 'pref': { const u = USUARIOS.find(x => x.id === d.userId); if (u && d.estado) u.estado = d.estado; if (u && typeof d.conectado === 'boolean') u.conectado = d.conectado; if (d.userId === YO_ID && d.estado && d.estado !== AJ.estado && J(prefDe()) === basePref) { AJ.estado = d.estado; if (d.estado === 'Ausente') AJ.reparto = false; if (d.estado === 'En línea') AJ.reparto = true; basePref = J(prefDe()); pintarYo(); } break; }
        case 'usuario-foto': fotoDePersona(d.userId, d.foto); break;   // alguien cambió su foto (48-barra.js)
        case 'linea': mezclarLinea(d.linea); break;
        case 'linea-borrada': { const i = LINEAS.findIndex(l => l.id === d.id); if (i >= 0) LINEAS.splice(i, 1); break; }
        case 'conexiones': if (Array.isArray(d.conexiones)) CONEXIONES.splice(0, CONEXIONES.length, ...d.conexiones); break;
        case 'canales': if (Array.isArray(d.canales)) CX_CANALES.splice(0, CX_CANALES.length, ...d.canales); break;
        case 'integraciones': if (Array.isArray(d.integraciones)) INTEG.lista = d.integraciones; break;
        case 'plantillas': crmPlantillas().then(repintarPronto, () => {}); break;
        // Le cambió el rol en un equipo o el equipo (lote 4): se vuelve a pedir lo que ve. Sin acceso al CRM, la pantalla lo dice.
        case 'alcance':
          if (d.alcance && typeof d.alcance === 'object') { aplicarAlcance(d.alcance); avisarAlcance(); resincronizar(); }
          else sinAcceso('No tienes acceso al CRM. Pídele a un líder que te agregue a un equipo.');
          break;
      }
    } catch (err) { console.warn('[CRM] evento', d && d.tipo, err); }
    document.dispatchEvent(new CustomEvent('crm:evento', {detail: d}));
    repintarPronto();
  }
  // Sonido y aviso del navegador cuando escribe alguien de mi bandeja (o sin asignar), según Mis ajustes.
  function avisarEntrante(c, m){
    if (!(c.asig === yo || !c.asig) || (AJ.silenciados || []).includes(c.contactoId || c.id)) return;
    if (AJ.sonido) { try { const ctx = avisarEntrante.ctx || (avisarEntrante.ctx = new (window.AudioContext || window.webkitAudioContext)()); const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3); o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.32); } catch { /* sin audio */ } }
    if (AJ.navegador && document.hidden && window.Notification && Notification.permission === 'granted') { try { new Notification(c.n, {body: resumenIn(m.in), tag: 'crm-' + c.id}); } catch { /* sin avisos */ } }
  }
  document.addEventListener('click', e => { if (e.target.closest('[data-aj-tg="navegador"]') && !AJ.navegador && window.Notification && Notification.permission === 'default') Notification.requestPermission(); }, true);

  /* ── Informes y ficha del cliente ── */
  const inf = {en:0, datos:null, pidiendo:false, falla:0};
  function informes(){
    if (!inf.pidiendo && Date.now() - inf.en > 60e3 && Date.now() - inf.falla > 300e3) {
      inf.pidiendo = true; const hasta = new Date(), desde = new Date(Date.now() - 7 * 864e5);
      crmApi('GET', `/crm/informes?desde=${encodeURIComponent(desde.toISOString())}&hasta=${encodeURIComponent(hasta.toISOString())}`)
        .then(d => { inf.datos = d || null; inf.en = Date.now(); if (st.pagina === 'informes' || st.pagina === 'vivo') repintarPronto(); }, () => { inf.falla = Date.now(); })
        .finally(() => { inf.pidiendo = false; });
    }
    return inf.datos;
  }
  const fichas = new Map();
  function fichaExterna(id){
    if (!id) return {error: 'Este contacto todavía no está guardado en el CRM.'};
    let e = fichas.get(id);
    if (!e || (!e.pidiendo && Date.now() - e.en > 60e3)) {
      e = {...(e || {cargando: true}), pidiendo: true, en: Date.now()}; fichas.set(id, e);
      crmApi('GET', `/crm/contactos/${id}/ficha-externa`).then(d => fichas.set(id, {en: Date.now(), datos: d || {}}), err => fichas.set(id, {en: Date.now(), error: err.message}))
        .finally(() => { const c = CONV.find(x => x.id === st.sel); if (c && c.contactoId === id) { repintarPronto(); if (document.getElementById('app').classList.contains('verficha')) pintarFicha(); } });
    }
    return e;
  }

  /* ── Acciones que no son «un campo cambió» ── */
  async function conversacionNueva(cuerpo){ const r = await crmApi('POST', '/crm/conversaciones', cuerpo); const c = mezclarConv(r); c._cargada = false; return c; }
  async function unirConv(principal, otra){
    const r = await crmApi('POST', `/crm/conversaciones/${principal.id}/unir`, {otraId: otra.id});
    quitarConv(otra.id); const c = mezclarConv(r); if (c) { c._cargada = false; c.msgs = (r.msgs || []).map(msgLocal); } return c;
  }
  async function borrarDatos(c){
    await crmApi('DELETE', `/crm/conversaciones/${c.id}?datos=1`);
    for (const o of CONV.filter(x => x.id === c.id || (c.contactoId && x.contactoId === c.contactoId))) quitarConv(o.id);
    quitarCt(c.contactoId);
  }
  async function agregarContacto(c, d){
    const ficha = {...c.ficha, ciudad: d.ciudad || c.ficha.ciudad || '', correo: d.correo || c.ficha.correo || ''};
    await crmApi('PATCH', `/crm/contactos/${c.contactoId}`, {cambios: {n: d.n, tel: d.tel, ...(d.correo ? {correo: d.correo} : {}), ficha, guardado: true}});
    c.n = d.n; c.tel = d.tel; c.ficha = ficha; c.guardado = true; marcarBase(c, ['n', 'tel', 'ficha', 'guardado']);
  }
  async function exportarContactos(){
    const r = await crmFetch('GET', '/crm/contactos/exportar');
    if (!r.ok) await crmLeer(r);
    const nombre = ((r.headers.get('Content-Disposition') || '').match(/filename="?([^";]+)"?/) || [])[1] || 'contactos-crm.xlsx';
    const url = URL.createObjectURL(await r.blob()), a = document.createElement('a'); a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  // Nombre visible: el del usuario de la plataforma (PATCH /api/auth/me); las asignaciones a mi nombre se renombran aquí.
  function renombrarLocal(nuevo){
    const viejo = yo; if (!nuevo || nuevo === viejo) return;
    yo = nuevo; AJ.nombre = nuevo;
    for (const c of CONV) if (c.asig === viejo) { c.asig = nuevo; marcarBase(c, ['asig']); }
    for (const x of CT_EXTRA) if (x.asig === viejo) { x.asig = nuevo; const b = baseCt.get(x.contactoId); if (b) b.set('asig', J(nuevo)); }
    const u = USUARIOS.find(x => x.id === YO_ID); if (u) u.nombre = nuevo;
    const i = ASESORES.indexOf(viejo); if (i >= 0) ASESORES[i] = nuevo;
  }
  async function cambiarNombre(nuevo){
    await crmApi('PATCH', '/auth/me', {nombre: nuevo});
    const viejo = yo; renombrarLocal(nuevo);
    const M = def('MIEMBROS'); if (M) for (const k of Object.keys(M)) M[k] = M[k].map(a => a === viejo ? nuevo : a);
  }

  /* ── render y chat: tiempos al día y mensajes con su hora; la conversación abierta carga sus mensajes ── */
  const renderBase = render;
  render = function(){
    if (!listo) return;
    tiempos();
    const c = !st.pagina ? CONV.find(x => x.id === st.sel) : null; if (c) prepararMensajes(c);
    const box = document.getElementById('msgs'), antes = {sel: st.sel, top: box.scrollTop, abajo: box.scrollHeight - box.scrollTop - box.clientHeight < 60};
    renderBase();
    if (!st.pagina && st.sel === antes.sel && !antes.abajo && antes.top) box.scrollTop = antes.top;
    const s = !st.pagina ? CONV.find(x => x.id === st.sel) : null; if (s && !s._cargada) cargarMensajes(s);
    programarRevision();
  };
  const chatBase = chat;
  chat = function(){ if (!listo) return; tiempos(); const c = CONV.find(x => x.id === st.sel); if (c) prepararMensajes(c); chatBase(); const s = CONV.find(x => x.id === st.sel); if (s && !s._cargada) cargarMensajes(s); };

  return {cargar, revisar, programarRevision, guardarYa, informes, fichaExterna, mensajesDe, conversacionNueva, unirConv, borrarDatos, agregarContacto, exportarContactos, cambiarNombre, cargarMensajes, renombrarEquipo};
})();

// Lo que usan 10-nucleo.js y los módulos.
function crmSincronizar(){ crmDatos.programarRevision(0); }
function crmRenombrarEquipo(viejo, nuevo){ crmDatos.renombrarEquipo(viejo, nuevo); }
function crmGuardarYa(...claves){ return crmDatos.guardarYa(claves).catch(() => {}); }
function crmInformes(){ return crmDatos.informes(); }
function crmFichaExterna(contactoId){ return crmDatos.fichaExterna(contactoId); }
function crmMensajesDe(id){ return crmDatos.mensajesDe(id); }
function crmConversacionNueva(cuerpo){ return crmDatos.conversacionNueva(cuerpo); }
function crmUnir(principal, otra){ return crmDatos.unirConv(principal, otra); }
// De esas conversaciones, cuáles no se pueden unir con la abierta y por qué: {motivos: {id: 'Otro número de WhatsApp'}}.
function crmUnibles(id, ids){ return crmApi('GET', `/crm/conversaciones/${id}/unibles?ids=${ids.filter(x => Number.isInteger(x) && x > 0).join(',')}`); }
function crmBorrarDatos(c){ return crmDatos.borrarDatos(c); }
function crmAgregarContacto(c, datos){ return crmDatos.agregarContacto(c, datos); }
function crmExportarContactos(){ return crmDatos.exportarContactos(); }
function crmCambiarNombre(nombre){ return crmDatos.cambiarNombre(nombre); }
// Plantillas de Meta (GET /crm/plantillas) más los borradores propios; TPL son las aprobadas.
async function crmPlantillas(){
  const d = await crmApi('GET', '/crm/plantillas');
  const lista = Array.isArray(d) ? d : (d && d.plantillas) || [];
  PLANTILLAS.splice(0, PLANTILLAS.length, ...lista, ...(AJ.borradores || []).filter(b => !lista.some(p => p.n === b.n)));
  TPL.splice(0, TPL.length, ...lista.filter(p => p.e === 'ok').map(p => ({n: p.n, x: p.b || p.x || '', c: p.c, boton: p.btnTxt || p.boton || ''})));
}
/* Avisos de la campana de la plataforma (services/notificaciones.ts): ?conv=<id> abre la conversación y ?ir=<página>
   una página del CRM. Al cargar se lee la dirección; con el CRM ya abierto, la página de la plataforma (crm/page.tsx)
   lo manda por postMessage, porque tocar el aviso cambia la dirección sin recargar el marco. */
const IR_AVISO = ['difusiones', 'plantillas', 'cfg-canales', 'cfg-plan'];
let crmCargado = false;
function abrirDesdeAviso(q, avisarSiNo){
  const id = +q.get('conv'), ir = q.get('ir') || '';
  if (id) {
    const c = CONV.find(x => x.id === id);
    if (!c) { if (avisarSiNo) toast('Esa conversación ya no está en tu bandeja'); return false; }
    st.pagina = ''; st.menciones = false; st.carpeta = st.equipo = st.etq = st.linea = st.canal = st.tag = '';
    st.sel = c.id; st.vista = 'todas'; st.est = c.est || 'abiertas';
    document.getElementById('est-l').textContent = {abiertas:'Abiertas', pendientes:'Pendientes', finalizadas:'Finalizadas'}[st.est] || 'Abiertas';
    return true;
  }
  // Al volver de pagar en Creem: /?ir=cfg-plan&pago=ok (70-plan.js espera a que el plan quede activo).
  if (ir === 'cfg-plan' && q.get('pago') === 'ok') st.pagoOk = true;
  if (IR_AVISO.includes(ir)) { st.pagina = ir; st.sel = null; return true; }
  return false;
}
window.addEventListener('message', e => {
  if (e.origin !== location.origin || e.source !== window.parent || !e.data || e.data.tipo !== 'crm-aviso' || !crmCargado) return;
  if (abrirDesdeAviso(new URLSearchParams(String(e.data.q || '')), true)) render();
});

// Arranque: primero los datos reales, después la pantalla. Mientras tanto, la bandeja muestra la burbuja escribiendo
// de la maqueta aprobada «CRM · animación de carga de conversaciones» (opción 2, 29-sep; estilos en crm.html).
function crmArrancar(){
  pintarYo();
  document.getElementById('app').classList.add('sinchat');
  document.getElementById('lt').textContent = st.vista === 'mias' ? 'Mi bandeja' : 'Conversaciones';
  const colLista = document.querySelector('section.list'); colLista.setAttribute('aria-busy', 'true');
  document.getElementById('items').innerHTML = '<div class="tj-carga" role="status"><div class="tj-bu" aria-hidden="true"><i></i><i></i><i></i></div><span>Cargando conversaciones</span></div>';
  // Las pestañas ya se ven mientras carga, sin sus números, como en la maqueta; hasta que lleguen los datos no se tocan.
  document.getElementById('tabs').innerHTML = [['mias', 'Mías'], ['sin', 'Sin asignar'], ['todas', 'Todas']].map(([k, n]) => `<button type="button" data-v="${k}" aria-pressed="${st.vista === k}" disabled>${n}</button>`).join('');
  crmDatos.cargar().then(() => {
    // Los avisos de la campana abren /crm?conv=<id> (esa conversación) o /crm?ir=<página>. Leído el aviso, la
    // dirección vuelve a /crm: así el mismo aviso se puede volver a tocar y recargar no lo repite.
    try { const top = window.top; if (abrirDesdeAviso(new URLSearchParams(top.location.search), false) || top.location.search) top.history.replaceState(top.history.state, '', top.location.pathname); } catch { /* sin acceso al marco */ }
    crmCargado = true; colLista.removeAttribute('aria-busy');
    pintarYo(); render(); crmListoOk(); crmMenciones();
  }, err => {
    colLista.removeAttribute('aria-busy');
    document.getElementById('items').innerHTML = `<div class="nothing"><b>No se pudo cargar el CRM</b><span>${esc(err.message)}</span><button type="button" class="btn" id="crm-reintentar">Intentar de nuevo</button></div>`;
    document.getElementById('crm-reintentar').addEventListener('click', crmArrancar, {once: true});
  });
}
