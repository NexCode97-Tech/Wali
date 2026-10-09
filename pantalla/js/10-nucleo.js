// Sesión de la plataforma: route.ts la inyecta antes de este código (docs/crm/CONTRATO-CRM.md §1).
const CRM_YO = (window.CRM_INICIO && window.CRM_INICIO.yo) || {};
// Personas del CRM (usuarios de Ventas) y promesa de la carga inicial: las llena 80-datos.js.
const USUARIOS = [];
let crmListoOk = null;
const crmListo = new Promise(res => { crmListoOk = res; });
// Líneas de WhatsApp conectadas: llegan del API.
const LINEAS = [];
/** El espacio de trabajo (la empresa) en que corre el CRM; lo trae /crm/inicio. */
const ESPACIO = {id: ((window.CRM_INICIO || {}).espacio || {}).id || '', nombre: ((window.CRM_INICIO || {}).espacio || {}).nombre || ''};
/** El nombre de la empresa, arriba del menú. */
function pintarMarca(){ const el = document.getElementById('brand-n'); if (el) el.textContent = ESPACIO.nombre || 'CRM'; }
pintarMarca();
const ETQ = [['Nuevo lead','#EC87C0'],['Contactado','#5D9CEC'],['Caliente','#FC6E51'],['En seguimiento','#AC92EC'],['No interesado/perdido','#434A54'],['Pagado','#A0D468'],['Link errado','#AAB2BD'],['Sin respuesta','#C9CED6']];
// Un color solo se pinta si es un color de verdad (#rrggbb): lo demás podría romper el HTML.
const colorOk = c => /^#[0-9a-f]{3,8}$/i.test(String(c ?? '').trim()) ? String(c).trim() : '#9ca3af';
const COL = Object.fromEntries(ETQ.map(([n, c]) => [n, colorOk(c)]));
// Etapas por equipo: [nombre, color, equipo].
// Las que no traen equipo son de Ventas. En una conversación solo salen las de su equipo.
const eqDeEtapa = e => (e && typeof e[2] === 'string' && e[2]) || 'Ventas';
const etapasDe = eq => ETQ.filter(e => eqDeEtapa(e) === eq);
const nombresEtapas = () => [...new Set(ETQ.map(e => e[0]))];
const equiposQueVeo = () => typeof ALCANCE !== 'undefined' && ALCANCE.on ? ALCANCE.equipos : EQUIPOS.map(e => e.n);
function etapasQueVeo(){ const eqs = new Set(equiposQueVeo()), vistos = new Set(); return ETQ.filter(e => eqs.has(eqDeEtapa(e)) && !vistos.has(e[0]) && vistos.add(e[0])); }
// Nombres de las personas del CRM (el API asigna por nombre visible).
const ASESORES = [];
// Respuestas rápidas del equipo: se guardan en Ajustes del CRM.
const QR = [];
// Productos con los enlaces de pago de la persona (módulo Enlaces): GET /crm/catalogo.
const CATALOGO = [];
const FALTANTES = [];
const AVC = ['#1f93ff','#7c5cff','#f97316','#0d9488','#e11d48','#64748b','#ca8a04'];
// Array.from: un emoji (dos unidades de texto) sale entero y no partido.
const ini = n => String(n || '').split(' ').filter(Boolean).slice(0,2).map(w => Array.from(w)[0]).join('').toUpperCase();
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const I = (n, cls = 'i') => `<svg class="${esc(cls)}"><use href="#i-${esc(n)}"/></svg>`;
// Quien usa el CRM. Es `let`: si cambia su nombre en Mi cuenta, cambia aquí también.
let yo = CRM_YO.nombre || '';
// Foto de la cuenta de Google o, si no hay, las iniciales.
const fotoAv = (foto, n) => foto ? `<img src="${esc(foto)}" alt="" referrerpolicy="no-referrer" style="position:absolute;inset:0;width:100%;height:100%;border-radius:50%;object-fit:cover;display:block">` : esc(ini(n));

// Conversaciones: llegan del API (GET /crm/inicio) y en tiempo real.
const CONV = [];

/* Hora de Colombia: UTC-5 todo el año, sin horario de verano. */
const HC_OFF = 5 * 3600e3;
const HC_DIA = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const HC_MES = ['ene.','feb.','mar.','abr.','may.','jun.','jul.','ago.','sep.','oct.','nov.','dic.'];
const HC_MES_L = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
function hcPartes(t){ const x = new Date(+new Date(t) - HC_OFF); return {y:x.getUTCFullYear(), m:x.getUTCMonth(), d:x.getUTCDate(), h:x.getUTCHours(), mi:x.getUTCMinutes(), w:x.getUTCDay()}; }
function hcFecha(y, m, d, h = 0, mi = 0){ return new Date(Date.UTC(y, m, d, h, mi) + HC_OFF); }
// Días de calendario (en Colombia) que van de `t` a `ref`: 0 hoy, 1 ayer, -1 mañana.
function hcDias(t, ref = Date.now()){ const a = hcPartes(t), b = hcPartes(ref); return Math.round((Date.UTC(b.y, b.m, b.d) - Date.UTC(a.y, a.m, a.d)) / 864e5); }
function hcHora(t){ const p = hcPartes(t); return `${((p.h + 11) % 12) + 1}:${String(p.mi).padStart(2, '0')} ${p.h < 12 ? 'a. m.' : 'p. m.'}`; }
const hcMay = t => t.charAt(0).toUpperCase() + t.slice(1);
// «Hoy», «Mañana», «Ayer» o «Viernes 2 de oct.»
function hcDia(t){ const dd = hcDias(t), p = hcPartes(t); return dd === 0 ? 'Hoy' : dd === -1 ? 'Mañana' : dd === 1 ? 'Ayer' : `${hcMay(HC_DIA[p.w])} ${p.d} de ${HC_MES[p.m]}`; }
// «Hoy, 4:00 p. m.» o «Viernes 2 de oct., 10:00 a. m.»
const hcCuando = t => `${hcDia(t)}, ${hcHora(t)}`;
// Días para elegir en los desplegables de fecha (hoy y los siguientes) y horas cada 30 minutos.
function hcOpcionesDia(n = 60){ const p = hcPartes(Date.now()), out = []; for (let i = 0; i < n; i++) { const f = hcFecha(p.y, p.m, p.d + i, 12), q = hcPartes(f); out.push([`${q.y}-${String(q.m + 1).padStart(2, '0')}-${String(q.d).padStart(2, '0')}`, i === 0 ? `Hoy, ${HC_DIA[q.w]} ${q.d} de ${HC_MES[q.m]}` : i === 1 ? `Mañana, ${HC_DIA[q.w]} ${q.d} de ${HC_MES[q.m]}` : `${hcMay(HC_DIA[q.w])} ${q.d} de ${HC_MES[q.m]}`]); } return out; }
function hcOpcionesHora(desde = 6 * 60, hasta = 22 * 60){ const out = []; for (let m = desde; m < hasta; m += 30) out.push([String(m), hcHora(hcFecha(2026, 0, 1, Math.floor(m / 60), m % 60))]); return out; }
// De «2026-10-02» y minutos del día a la fecha real.
function hcDeOpciones(dia, min){ const [y, m, d] = String(dia).split('-').map(Number); return hcFecha(y, m - 1, d, Math.floor(+min / 60), +min % 60); }

// Recordatorios: {t, cuando, fecha (ISO), hecho, por}. El estado sale de la fecha; el API avisa cuando vence.
const recFechaDe = r => r.fecha || r.para || null;
function recEst(r){ if (!recFechaDe(r)) return r.estado || 'futuro'; const t = Date.parse(recFechaDe(r)); if (t <= Date.now()) return 'vencido'; return hcDias(t) === 0 ? 'hoy' : 'futuro'; }
const recPend = c => (c.recs || []).filter(r => !r.hecho && (recEst(r) === 'hoy' || recEst(r) === 'vencido'));
// Días del recordatorio con el rótulo corto de la maqueta («Jue 2 oct») y la hora que se propone al abrirlo.
function recDias(n = 60){ const p = hcPartes(Date.now()), out = []; for (let i = 0; i < n; i++) { const q = hcPartes(hcFecha(p.y, p.m, p.d + i, 12)), d = HC_DIA[q.w].slice(0, 3); out.push([`${q.y}-${String(q.m + 1).padStart(2, '0')}-${String(q.d).padStart(2, '0')}`, `${d[0].toUpperCase()}${d.slice(1)} ${q.d} ${HC_MES[q.m].slice(0, 3)}`]); } return out; }
function recPorDefecto(){ const p = hcPartes(Date.now()), dias = recDias(2); let min = Math.ceil((p.h * 60 + p.mi + 30) / 30) * 30, dia = dias[0][0]; if (min < 6 * 60) min = 9 * 60; if (min >= 22 * 60) { min = 9 * 60; dia = dias[1][0]; } return {dia, hora:String(min)}; }
function recOpciones(){ const p = hcPartes(Date.now()); return [['1h','En 1 hora'], ...(p.h < 15 ? [['tarde','Hoy en la tarde']] : []), ['manana','Mañana 9 a. m.'], ['lunes','El lunes'], ['otra','Elegir fecha']]; }
function recFecha(k){ const n = Date.now(), p = hcPartes(n); if (k === '1h') return new Date(n + 3600e3); if (k === 'tarde') return hcFecha(p.y, p.m, p.d, 16); if (k === 'manana') return hcFecha(p.y, p.m, p.d + 1, 9); if (k === 'lunes') return hcFecha(p.y, p.m, p.d + ((8 - p.w) % 7 || 7), 9); return null; }
// Si el cliente dijo un día («el viernes pago»), el CRM propone el recordatorio.
function sugerenciaRec(c){
  const ult = [...c.msgs].reverse().find(m => typeof m.in === 'string');
  if (!ult) return null;
  const t = norm(ult.in); const m = t.match(/\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo|manana)\b/);
  if (!m) return null;
  const p = hcPartes(Date.now()), w = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'].indexOf(m[1]);
  const para = hcFecha(p.y, p.m, p.d + (m[1] === 'manana' ? 1 : ((w - p.w + 7) % 7 || 7)), 10);
  if ((c.recs || []).some(r => !r.hecho && recFechaDe(r) && hcDias(recFechaDe(r), para) === 0)) return null;
  return {frase: ult.in, cuando: hcCuando(para), para: para.toISOString()};
}
// Ajustes personales: nombre, correo y foto de la cuenta de la plataforma; lo demás se guarda en PUT /crm/preferencias.
const AJ = {abierto:'perfil', nombre:yo, corto:yo.split(' ')[0], correo:CRM_YO.correo || '', foto:CRM_YO.foto || null, estado:'En línea', reparto:true, firma:false,
  sonido:true, navegador:true, asignada:true, mencion:true, resumen:false,
  qr:[], silenciados:[], favoritos:[], nuevaQr:false};
const EST_COL = {'En línea':'#22c55e', 'Ocupada':'#f59e0b', 'Ausente':'#9ca3af', 'Desconectado':'#d1d5db'};
// El estado que ven los demás: quien no tiene el CRM abierto sale «Desconectado», diga lo que diga su estado.
const estadoDe = u => u.id === CRM_YO.id ? AJ.estado : !u.conectado ? 'Desconectado' : (u.estado || 'En línea');
function pintarYo(){ document.getElementById('me-n').textContent = AJ.nombre; document.getElementById('me-e').innerHTML = `<i class="est-dot" style="background:${EST_COL[AJ.estado] || EST_COL['En línea']}"></i>${esc(AJ.estado)}`; const av = document.querySelector('.me .av'); if (av) av.style.background = colorDeUsuario(CRM_YO.id, AJ.nombre); if (av) av.innerHTML = fotoAv(AJ.foto, AJ.nombre); }
// Cambiar tu estado. Lo usan Mis ajustes › Mi disponibilidad y el botón del estado de tu cuenta en la barra
// (57-celular-menu.js): Ausente apaga «Recibir conversaciones nuevas» y En línea lo prende. Se guarda en tus preferencias (80-datos.js).
function ponerEstado(v){ AJ.estado = v; if (AJ.estado === 'Ausente') AJ.reparto = false; if (AJ.estado === 'En línea') AJ.reparto = true; pintarYo(); render(); toast(`Tu estado: ${AJ.estado}`); }
// Desplegable propio para elegir UNA opción.
// Cada opción lleva el mismo data-atributo que usaban las píldoras, así los manejadores no cambian.
const ddSel = (attr, opciones, sel, ph = 'Elige una opción') => { const o = opciones.map(x => Array.isArray(x) ? x : [x, x]); const act = o.find(([v]) => v === sel); return `<div class="dd dsel" style="position:relative;min-width:220px"><button type="button" class="sel" data-dsel-open="1"><span style="flex:1;text-align:left;${act ? '' : 'color:var(--ink4)'}">${esc(act ? act[1] : ph)}</span>${I('chev')}</button><div class="menu" style="left:0;right:auto;width:100%;max-height:260px;overflow-y:auto" hidden>${o.map(([v, l]) => `<button type="button" ${attr}="${esc(v)}" aria-selected="${v === sel}">${esc(l)}${v === sel ? I('check') : ''}</button>`).join('')}</div></div>`; };
document.addEventListener('click', e => {
  if (e.target.closest('.msearch')) return;
  const b = e.target.closest('[data-dsel-open]');
  document.querySelectorAll('.dsel .menu').forEach(m => { if (!b || m !== b.nextElementSibling) m.hidden = true; });
  if (b) { e.stopPropagation(); b.nextElementSibling.hidden = !b.nextElementSibling.hidden; }
}, true);
/* Origen del contacto (8-oct, maqueta aprobada): megáfono, el logo real de la plataforma y el nombre del anuncio;
   sin anuncio, el logo y el nombre del canal por el que llegó. */
const LOGOS_ORIGEN = {
  meta:'<svg viewBox="0 0 24 24"><path fill="#0866FF" d="M6.9 5C4.2 5 2 8.6 2 12.4 2 15.3 3.4 17 5.6 17c1.7 0 3-1.1 4.9-4.3l1.3-2.2c.2.4.4.8.7 1.2l.8 1.4c1.7 2.9 3.2 3.9 5 3.9 2.3 0 3.7-1.9 3.7-4.9C22 8.4 19.8 5 17.1 5c-1.5 0-2.8 1-4.4 3.3C11 6 9.1 5 6.9 5zm.2 2.3c1.3 0 2.4.9 3.5 2.6-1.8 3-2.8 4.6-4.1 4.6-1.1 0-1.9-1-1.9-2.8 0-2.3 1-4.4 2.5-4.4zm9.9 0c1.6 0 2.7 2.2 2.7 4.7 0 1.6-.6 2.4-1.5 2.4-1 0-1.8-.8-3.4-3.4l-1-1.6c1.1-1.6 2-2.1 3.2-2.1z"/></svg>',
  google:'<svg viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z"/><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z"/><path fill="#FBBC05" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1A10 10 0 0 0 2 12c0 1.6.4 3.1 1.1 4.6z"/><path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10C7.2 7.7 9.4 5.9 12 5.9z"/></svg>',
  tiktok:'<svg viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#000"/><path fill="#fff" d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-1.8-2.5V9.7a5.7 5.7 0 1 0 4.9 5.7V9a7.3 7.3 0 0 0 4.3 1.4V7.3a4.3 4.3 0 0 1-3.2-1.5z"/></svg>',
  whatsapp:'<svg viewBox="0 0 24 24"><path fill="#25D366" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z"/><path fill="#fff" d="M8.5 7.5c.2-.4.4-.4.7-.4h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2.1.4 0 .6l-.4.6-.3.4c.5 1 1.6 2.1 2.7 2.6l.5-.6c.2-.2.4-.3.6-.2l1.9.9c.3.1.4.2.4.4 0 .5-.2 1.1-.6 1.4-.5.4-1.4.6-2.5.2-2.2-.8-3.9-2.6-4.7-4.4-.5-1.3-.1-2.5.3-3z"/></svg>',
  instagram:'<svg viewBox="0 0 24 24"><defs><linearGradient id="lo-ig" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#FFD600"/><stop offset=".5" stop-color="#FF0169"/><stop offset="1" stop-color="#7638FA"/></linearGradient></defs><rect width="24" height="24" rx="6" fill="url(#lo-ig)"/><rect x="5.5" y="5.5" width="13" height="13" rx="4" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="12" cy="12" r="3.2" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="16.3" cy="7.7" r="1" fill="#fff"/></svg>',
  messenger:'<svg viewBox="0 0 24 24"><path fill="#0866FF" d="M12 2C6.4 2 2 6.1 2 11.7c0 2.9 1.2 5.5 3.2 7.3V22l3-1.6c.9.2 1.8.4 2.8.4 5.6 0 10-4.1 10-9.7S17.6 2 12 2z"/><path fill="#fff" d="m6 14.5 3-4.7 2.6 2 3.4-2-3 4.8-2.6-2.1z"/></svg>',
  manychat:'<svg viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#0b0b10"/><path d="M8 21V11l4 5 4-5 4 5 4-5v10" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};
const logoOrigen = t => { const n = norm(String(t || ''));
  return n.includes('meta') || n.includes('facebook') ? LOGOS_ORIGEN.meta : n.includes('google') ? LOGOS_ORIGEN.google : n.includes('tiktok') ? LOGOS_ORIGEN.tiktok
    : n.includes('whatsapp') ? LOGOS_ORIGEN.whatsapp : n.includes('instagram') ? LOGOS_ORIGEN.instagram : n.includes('messenger') ? LOGOS_ORIGEN.messenger : n.includes('manychat') ? LOGOS_ORIGEN.manychat : ''; };
function origenLinea(c, f){
  const p = c.pauta, txt = p ? (p.anuncio || p.campana || p.plataforma || 'Anuncio') : f.origen;
  if (!txt) return '';
  const logo = logoOrigen(p ? p.plataforma : f.origen);
  return `<span class="ln pc-origen">${I('megaphone')}<span class="pc-org">${logo ? `<span class="pc-org-l">${logo}</span>` : ''}<span title="${esc(txt)}">${esc(txt)}</span></span></span>`;
}
document.head.insertAdjacentHTML('beforeend', `<style>
.pc-org{display:flex;align-items:center;gap:8px;min-width:0}
.pc-org > span:last-child{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pc-org-l{width:20px;height:20px;border-radius:5px;display:grid;place-items:center;flex:none;background:#fff;border:1px solid #eef1f5}
.pc-org-l svg{width:14px;height:14px}
</style>`);
const CANALES = {wa:{n:'WhatsApp', ic:'wa'}, ig:{n:'Instagram', ic:'ig'}, fb:{n:'Messenger', ic:'fb'}, tg:{n:'Telegram', ic:'tg'}, tt:{n:'TikTok', ic:'tt'}, web:{n:'Chat de la web', ic:'web'}, mail:{n:'Correo', ic:'mail'}};
// Canales que se conectan con una cuenta (Messenger, Instagram, Telegram y TikTok, 45-canales.js): GET /crm/inicio
// `canales` y el evento `canales`, para todos, sin nada de la conexión.
const CX_CANALES = [];
const cxDe = k => CX_CANALES.filter(x => x.canal === k);
// Si un canal ya está conectado al CRM (el correo todavía no).
const canalConectado = k => k === 'wa' ? LINEAS.length > 0 : k === 'web' ? !!(CFG.web && CFG.web.on) : cxDe(k).length > 0;
// Solo cuentan los canales conectados: lo que no está conectado no se muestra ni se marca,
// ni en los agentes IA ni en la barra lateral.
const canalesConectados = () => Object.keys(CANALES).filter(canalConectado);
// Pasadas las 24 horas, WhatsApp se retoma con una plantilla; los demás canales no tienen plantillas (TikTok da 48 horas).
const sinPlantillas = c => !!c && ['ig', 'fb', 'tg', 'tt', 'mail'].includes(c.canal);
const cerradaTxt = c => sinPlantillas(c) ? `Pasaron más de ${c.canal === 'tt' ? 48 : 24} horas desde su último mensaje: ${CANALES[c.canal].n} no deja escribirle hasta que vuelva a escribir` : 'La ventana de 24 h está cerrada: primero hay que retomar con una plantilla';
const ETIQS = [['Cliente frecuente','#0891b2'],['Pide descuento','#ca8a04'],['Referido','#059669'],['Aliado','#7c3aed']];
const ETIQ_COL = Object.fromEntries(ETIQS.map(([n, c]) => [n, colorOk(c)]));
// Etiquetas por equipo (28-sep, maqueta «CRM · etiquetas por equipo»): [nombre, color, equipo]; sin equipo es para todos.
const eqDeEtiq = e => (e && typeof e[2] === 'string' && e[2]) || '';
// Las de la barra: las de todos (y las de un equipo que ya no existe) y las de los equipos que la persona ve, sin repetir
// el nombre. Quien entra solo por Moderación no ve las de Ventas (como etapasQueVeo).
function etiquetasQueVeo(){ const eqs = new Set(equiposQueVeo()), vistos = new Set(); return ETIQS.filter(e => { const q = eqDeEtiq(e); return (!q || eqs.has(q) || !EQUIPOS.some(x => x.n === q)) && !vistos.has(e[0]) && vistos.add(e[0]); }); }
const eqDeConv = c => (c && c.equipo) || 'Ventas';
// Material de ventas del equipo (Ajustes del CRM, Archivos): se guarda como ajuste «material».
const MATERIAL = [];
// Flujos: lo que pasa antes de que el lead llegue al asesor.
const TIPOS_PASO = [['mensaje','Mensaje'],['pregunta','Pregunta'],['botones','Pregunta con botones'],['etiqueta','Poner etiqueta'],['asignar','Pasar al asesor']];
const FLUJOS = [
  {id:'bienvenida', n:'Bienvenida', on:true, cuando:'Llega el primer mensaje de un número nuevo', canales:['wa','ig','fb','tg','tt','web'], saltarConocidos:true, espera:10,
   pasos:[
     {t:'mensaje', txt:'¡Hola! Gracias por escribirnos.'},
     {t:'pregunta', txt:'Para una mejor atención, ¿nos regalas tu nombre y apellido?', guardar:'Nombre del contacto', validar:'Nombre y apellido', reintento:'¿Me regalas también tu apellido? Así el asesor te atiende por tu nombre.'},
     {t:'mensaje', txt:'¡Gracias, {{nombre}}! Uno de nuestros asesores te responde en unos minutos.'},
     {t:'asignar', a:'Reparto automático · equipo Ventas'},
   ]},
  {id:'interes', n:'Interés por producto', on:false, cuando:'Llega el primer mensaje de un número nuevo', canales:['wa'], saltarConocidos:true, espera:10,
   pasos:[
     {t:'mensaje', txt:'¡Hola! Gracias por escribirnos.'},
     {t:'botones', txt:'¿Qué te interesa?', ops:['Producto A','Producto B','Otro'], guardar:'Etiqueta'},
     {t:'asignar', a:'Reparto automático · equipo Ventas'},
   ]},
];
const CAMPOS = [{k:'producto', n:'Producto', t:'Texto'}, {k:'empresa', n:'Empresa', t:'Texto'}, {k:'representante', n:'Representante legal', t:'Texto'}, {k:'telRepresentante', n:'Teléfono del representante legal', t:'Teléfono'}];
// «Número de cliente» no es un campo: lo pone el CRM a cada cliente que llega (crm_contactos.numero), único en todo el CRM.
const REGLAS = [
  {n:'El agente IA responde de noche', on:false, cuando:'Llega un mensaje nuevo', si:['Fuera del horario de atención'], ent:['Responde el agente IA', 'Dejar resumen en nota privada']},
  {n:'Pago confirmado', on:true, cuando:'Se confirma un pago', si:[], ent:['Cambiar etapa a Pagado', 'Pasar al equipo Recuperación de ventas si es a cuotas']},
  {n:'Sin respuesta 48 horas', on:true, cuando:'Pasan 48 horas sin respuesta del cliente', si:['Etapa es Contactado o En seguimiento'], ent:['Cambiar etapa a Sin respuesta', 'Crear recordatorio para el asesor']},
];
const R_CUANDO = ['Llega un mensaje nuevo','Se asigna una conversación','Cambia la etapa','Se confirma un pago','Pasan 48 horas sin respuesta del cliente','Se finaliza la conversación'];
// Condiciones y acciones de las reglas: [tipo, opciones, texto]. El texto es el que entiende services/crm/reglas.ts.
function reglaTipos(q){
  if (q === 'si') return [
    ['Canal es', Object.values(CANALES).map(c => c.n), x => `Canal es ${x}`],
    ['Línea es', LINEAS.map(l => l.n), x => `Línea es ${x}`],
    ['Etapa es', nombresEtapas(), x => `Etapa es ${x}`],
    ['Tiene la etiqueta', ETIQS.map(e => e[0]), x => `Tiene la etiqueta ${x}`],
    ['Fuera del horario de atención'], ['Viene de un anuncio'], ['Es a cuotas'], ['Sin asesor'],
  ];
  return [
    ['Asignar por turnos al equipo', EQUIPOS.map(e => e.n), x => `Asignar por turnos al equipo ${x}`],
    ['Asignar a un asesor', ASESORES.slice(), x => `Asignar a ${x}`],
    ['Pasar al equipo', EQUIPOS.map(e => e.n), x => `Pasar al equipo ${x}`],
    ['Cambiar etapa a', nombresEtapas(), x => `Cambiar etapa a ${x}`],
    ['Agregar etiqueta', ETIQS.map(e => e[0]), x => `Agregar etiqueta ${x}`],
    ['Quitar etiqueta', ETIQS.map(e => e[0]), x => `Quitar etiqueta ${x}`],
    ['Enviar plantilla', TPL.map(t => t.n), x => `Enviar plantilla ${x}`],
    ['Enviar respuesta rápida', QR.map(r => r.t), x => `Enviar respuesta rápida ${x}`],
    ['Crear recordatorio para el asesor'], ['Avisar al líder'], ['Dejar resumen en nota privada'], ['El agente IA responde'],
  ];
}
// Lo elegido (se quita con un clic) y la fila para agregar: tipo, luego cuál, luego «Agregar».
function armadorRegla(q, n){
  const tipos = reglaTipos(q), tipo = tipos.find(t => t[0] === n['t_' + q]), obj = n['o_' + q] || '';
  const hechas = n[q].length ? `<div class="chips2">${n[q].map((x, i) => `<button type="button" data-r-quitar="${q}:${i}" aria-pressed="true" title="Quitar">${esc(x)}${I('x')}</button>`).join('')}</div>` : '';
  const cual = tipo && tipo[1] ? (tipo[1].length ? ddSel('data-r-obj-' + q, tipo[1], obj, 'Elige cuál') : '<span class="muted">No hay opciones para elegir todavía</span>') : '';
  const listo = tipo && (!tipo[1] || obj);
  return `${hechas}<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:6px">${ddSel('data-r-tipo-' + q, tipos.map(t => t[0]), n['t_' + q] || '', q === 'si' ? 'Agregar una condición' : 'Agregar una acción')}${cual}<button type="button" class="btn" data-r-agregar="${q}" ${listo ? '' : 'disabled'}>${I('plus')}Agregar</button></div>`;
}
const st = {rol:CRM_YO.esLider ? 'l' : 'a', ajTab:'cuenta', convAbierto:false, vista:CRM_YO.esLider ? 'todas' : 'mias', linea:'', etq:'', sel:0, modo:'r', q:'', carpeta:'', equipo:'', pagina:'', orden:'reciente', menciones:false};
const CARPETAS = [
  {id:'seguir', ic:'bell', n:'Seguimientos de hoy', f:c => recPend(c).length > 0},
  {id:'recordatorio', ic:'calendar', n:'Con recordatorio', f:c => (c.recs || []).some(r => !r.hecho)},
  {id:'esperan', ic:'clock', n:'Esperan respuesta', f:c => !!c.espera},
  {id:'favoritos', ic:'estrella', n:'Favoritos', f:c => (AJ.favoritos || []).includes(c.id)},
  {id:'calientes', ic:'flame', n:'Calientes', f:c => !!c.fuego || c.etq.includes('Caliente')},
  {id:'pauta', ic:'ad', n:'Vienen de un anuncio', f:c => !!c.pauta},
];
const EQUIPOS = [
  {id:'ventas', n:'Ventas', f:c => !c.ficha.compras},
  {id:'recuperacion', n:'Recuperación de ventas', f:c => !!c.ficha.compras},
];

const okRol = c => st.rol === 'l' || !c.soloLider;
// «Mías»: por nombre (como la maqueta) o por id, que no cambia aunque la persona cambie su nombre.
const esMia = c => c.asig === yo || (!!c.asigId && c.asigId === CRM_YO.id);
function visibles(){
  limpiarFiltros();
  return CONV.filter(c => {
    if (!okRol(c)) return false;
    if ((c.est || 'abiertas') !== (st.est || 'abiertas')) return false;
    if (st.vista === 'mias' && !esMia(c)) return false;
    if (st.vista === 'sin' && c.asig) return false;
    if (st.linea && c.linea !== st.linea) return false;
    if (st.canal && c.canal !== st.canal) return false;
    if (st.tag && !c.tags.includes(st.tag)) return false;
    if (st.etq && !c.etq.includes(st.etq)) return false;
    if (st.carpeta && !CARPETAS.find(x => x.id === st.carpeta).f(c)) return false;
    if (st.equipo && !(EQUIPOS.find(x => x.id === st.equipo)?.f(c) ?? true)) return false;
    const q = st.q.trim().toLowerCase();
    // El número de cliente se busca exacto («1024», «n.º 1024» o «#1024»).
    const qNum = q.replace(/^(n\.?\s*º?\s*|#|cliente\s*)/, '').trim();
    if (q && /^\d+$/.test(qNum) && String(c.numero) === qNum) return true;
    if (q && !(c.n.toLowerCase().includes(q) || String(c.tel || '').replace(/\s/g,'').includes(q.replace(/\s/g,'')) || c.msgs.some(m => typeof m.in === 'string' && m.in.toLowerCase().includes(q) || m.out && m.out.toLowerCase().includes(q)))) return false;
    return true;
  });
}
// Menciones: las conversaciones con notas que me nombran, de la mención más nueva a la más vieja.
function convsMencion(){
  const orden = new Map();
  for (const m of MENCIONES) if (!orden.has(m.convId)) orden.set(m.convId, orden.size);
  return CONV.filter(c => orden.has(c.id) && okRol(c)).sort((a, b) => orden.get(a.id) - orden.get(b.id));
}
function mencionesNuevas(){
  let visto = 0; try { visto = +localStorage.getItem('crm-menciones-visto') || 0; } catch { /* sin almacenamiento */ }
  return new Set(MENCIONES.filter(m => Date.parse(m.t) > visto && CONV.some(c => c.id === m.convId && okRol(c))).map(m => m.convId)).size;
}
const cuenta = f => CONV.filter(c => okRol(c) && (c.est || 'abiertas') === (st.est || 'abiertas') && f(c)).length;
const opsDe = fd => fd.ops === 'catalogo' ? [...CATALOGO.map(x => [x.p, x.p]), ...FALTANTES.map(n => [n, n])] : fd.ops;

function nav(){
  const cur = k => (st.pagina ? st.pagina === k : (k === 'inbox' && st.vista === 'mias' && !st.menciones) || (k === 'todas' && st.vista === 'todas' && !st.menciones) || (k === 'menciones' && st.menciones) || (k === 'sin' && st.vista === 'sin'));
  // «Conversaciones» se despliega y se contrae con su flechita: debajo van Menciones y Sin asignar.
  document.getElementById('principal').innerHTML = [
    ['inbox','inbox','Mi bandeja', cuenta(esMia), false],
    ['todas','chat','Conversaciones', null, false, true],
    ['menciones','at','Menciones', st.menciones ? 0 : mencionesNuevas(), true],
    ['sin','users','Sin asignar', cuenta(c => !c.asig), true],
    ['contactos','user','Contactos', null, false],
    ['embudo','kanban','Embudo', null, false],
    ['difusiones','megaphone','Difusiones', null, false],
    ['plantillas','template','Plantillas', null, false],
    ['informes','chart','Informes', null, false],
    ['vivo','pulse','Equipo en vivo', null, false],
    ['agentes','bot','Agentes IA', null, false],
  ].filter(([k,,,,sub]) => (!sub || st.convAbierto) && ((k !== 'vivo' && k !== 'agentes') || st.rol === 'l')).map(([k,ic,n,c,sub,grupo]) => `<li class="${sub ? 'sub' : ''}"><button type="button" aria-current="${cur(k)}" data-nav="${k}"${grupo ? ` aria-expanded="${st.convAbierto}"` : ''}>${I(ic)}${n}${c != null ? `<span class="n">${c || ''}</span>` : ''}${grupo ? I('chev', 'i tw') : ''}</button></li>`).join('');
  document.getElementById('carpetas').innerHTML = CARPETAS.map(k => `<li><button type="button" data-k="${k.id}" aria-current="${st.carpeta === k.id}">${I(k.ic)}${k.n}<span class="n">${cuenta(k.f) || ''}</span></button></li>`).join('');
  document.getElementById('equipos').innerHTML = EQUIPOS.map(t => `<li><button type="button" data-t2="${esc(t.id)}" aria-current="${st.equipo === t.id}">${I('users')}${esc(t.n)}<span class="n">${cuenta(t.f) || ''}</span></button></li>`).join('');
  const canalesVis = Object.entries(CANALES).filter(([k]) => canalConectado(k));
  document.getElementById('canales').parentElement.hidden = !canalesVis.length;
  document.getElementById('canales').innerHTML = canalesVis.map(([k, v]) => `<li><button type="button" data-ch="${k}" aria-current="${st.canal === k}">${I(v.ic)}${v.n}<span class="n">${cuenta(c => c.canal === k) || ''}</span></button></li>`).join('');
  document.getElementById('tags').innerHTML = etiquetasQueVeo().map(([n, col]) => `<li><button type="button" data-tg="${esc(n)}" aria-current="${st.tag === n}"><span class="dot" style="background:${colorOk(col)}"></span>${esc(n)}<span class="n">${cuenta(c => c.tags.includes(n)) || ''}</span></button></li>`).join('');
  document.getElementById('sec-lineas').hidden = st.rol !== 'l' || !LINEAS.length;
  document.getElementById('lineas').innerHTML = LINEAS.map(l => `<li><button type="button" data-l="${l.id}" aria-current="${st.linea === l.id}">${I('wa','i wa')}${esc(l.n)}<span class="n">${cuenta(c => c.linea === l.id)}</span></button></li>`).join('');
  document.getElementById('etiquetas').innerHTML = etapasQueVeo().map(([n,c]) => `<li><button type="button" data-e="${esc(n)}" aria-current="${st.etq === n}"><span class="dot" style="background:${colorOk(c)}"></span>${esc(n)}<span class="n">${cuenta(x => x.etq.includes(n)) || ''}</span></button></li>`).join('');
  const conVista = v => { const g = st.vista; st.vista = v; const n = visibles().length; st.vista = g; return n; };
  const T = [['mias','Mías', conVista('mias')],['sin','Sin asignar', conVista('sin')],['todas','Todas', conVista('todas')]];
  document.getElementById('tabs').innerHTML = T.map(([k,n,c]) => `<button type="button" data-v="${k}" aria-pressed="${st.vista === k}">${n}<span class="n">${c}</span></button>`).join('');
}

function kanban(){
  const el = document.getElementById('page');
  let dragId = null;
  el.querySelectorAll('.kc').forEach(k => {
    k.addEventListener('dragstart', e => { dragId = +k.dataset.kc; k.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; });
    k.addEventListener('dragend', () => k.classList.remove('drag'));
  });
  el.querySelectorAll('.kcol').forEach(col => {
    col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('over'); });
    col.addEventListener('dragleave', () => col.classList.remove('over'));
    col.addEventListener('drop', e => { e.preventDefault(); col.classList.remove('over'); const c = CONV.find(x => x.id === dragId); if (!c) return; c.etq = [col.dataset.col]; c.msgs.push({ev:'tag', t:`Etapa: ${col.dataset.col} · ahora`}); render(); toast(`${c.n}: ${col.dataset.col}`); });
  });
  // En el celular (6-oct): mantener presionada la tarjeta y arrastrarla con el dedo hasta otra etapa. Al soltarla se
  // dispara el mismo «drop» de arriba, así todo lo que escucha el cambio de etapa funciona igual.
  let toque = null;
  const colBajo = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest('.kcol'); };
  el.querySelectorAll('.kc').forEach(k => {
    k.addEventListener('touchstart', e => {
      const t = e.touches[0];
      toque = {k, x:t.clientX, y:t.clientY, listo:false, fantasma:null, col:null, espera:setTimeout(() => {
        if (!toque) return; toque.listo = true; k.classList.add('drag');
        const r = k.getBoundingClientRect(), f = k.cloneNode(true);
        Object.assign(f.style, {position:'fixed', left:r.left + 'px', top:r.top + 'px', width:r.width + 'px', pointerEvents:'none', opacity:'.9', zIndex:'60', boxShadow:'0 12px 30px rgba(0,0,0,.2)', transform:'rotate(2deg)'});
        document.body.appendChild(f); toque.fantasma = f; toque.dx = toque.x - r.left; toque.dy = toque.y - r.top;
        if (navigator.vibrate) navigator.vibrate(15);
      }, 300)};
    }, {passive:true});
    k.addEventListener('touchmove', e => {
      if (!toque) return; const t = e.touches[0];
      if (!toque.listo) { if (Math.hypot(t.clientX - toque.x, t.clientY - toque.y) > 8) { clearTimeout(toque.espera); toque = null; } return; }
      e.preventDefault();
      toque.fantasma.style.left = (t.clientX - toque.dx) + 'px'; toque.fantasma.style.top = (t.clientY - toque.dy) + 'px';
      const c = colBajo(t.clientX, t.clientY);
      if (c !== toque.col) { if (toque.col) toque.col.classList.remove('over'); if (c) c.classList.add('over'); toque.col = c; }
    }, {passive:false});
    const soltar = () => {
      if (!toque) return; clearTimeout(toque.espera);
      const {listo, fantasma, col} = toque; toque = null; k.classList.remove('drag'); if (fantasma) fantasma.remove();
      if (!listo || !col) return;
      col.classList.remove('over'); dragId = +k.dataset.kc;
      col.dispatchEvent(new Event('drop', {bubbles:true, cancelable:true}));
    };
    k.addEventListener('touchend', soltar); k.addEventListener('touchcancel', soltar);
  });
}
// Público de una difusión por etapa: los contactos reales que se pueden contactar, por etapa del embudo.
const audiencia = () => { const t = ctTodos().filter(c => !c.noContactar); return nombresEtapas().map(n => [n, t.filter(c => c.etapa === n).length]); };
// Contactos reales (ids de CrmContacto) del público elegido, sin «No contactar» y sin repetidos: es la lista que manda el motor del API.
// Las conversaciones de CONV traen contactoId; los contactos sueltos de CT_EXTRA también (su id es 1e9 + contactoId).
function difPublico(d){
  const segD = d.publico && d.publico.startsWith('seg:') ? segDe(d.publico.slice(4)) : null;
  const T = ctTodos().filter(c => !c.noContactar), elegidos = new Set(d.ids || []);
  const L = d.publico === 'sel' ? T.filter(c => elegidos.has(c.contactoId))
    : segD ? T.filter(c => c.guardado !== false && (segD.f ? segD.f(c) : pasaFiltros(c, segD.filtros) && (!segD.q || norm(c.n + ' ' + c.tel + ' ' + c.correo).includes(norm(segD.q)))))
    : T.filter(c => d.aud.has(c.etapa));
  return {segD, ids: [...new Set(L.map(c => c.contactoId || (c.id >= 1e9 ? c.id - 1e9 : 0)).filter(x => x > 0))]};
}
// La difusión como se guarda en el ajuste «difusiones», igual para «Ahora» y para la programada (30-legal.js). La envía el API.
function difNueva(d, extra = {}){
  const {segD, ids} = difPublico(d), ahora = Date.now();
  return {id:'d' + ahora, n: d.n || (p => `Difusión del ${p.d} de ${HC_MES_L[p.m]}`)(hcPartes(ahora)), t: (TPL.find(t => t.n === d.tpl) || {}).n || '', a: d.publico === 'sel' ? `${d.seleccion} contactos elegidos` : segD ? 'Segmento: ' + segD.n : [...d.aud].join(' + '), env:0, ent:0, le:0, resp:0, f: hcCuando(ahora), est:'w', e:'En cola',
    publico: d.publico || 'etapas', etapas: [...d.aud], segmento: segD ? {id: segD.id, filtros: segD.filtros || null, q: segD.q || ''} : null, contactoIds: ids, linea: d.linea || null, ritmo: d.ritmo || 200, para: new Date(ahora).toISOString(), total: ids.length, por: yo, ...extra};
}
function difusion(){
  const d = st.dif, el = document.getElementById('page');
  const {segD, ids} = difPublico(d);
  const AUD = audiencia();
  const total = ids.length;
  const tpl = TPL.find(t => t.n === d.tpl) || {n:'', x:'', c:''}, esMk = tpl.c !== 'Utilidad';
  const costo = total * (esMk ? 0.0125 : 0.0008);
  const pasos = ['Audiencia', 'Plantilla', 'Envío'];
  el.innerHTML = `<div class="pg-h"><div><h2>Nueva difusión</h2><p class="sub">Tres pasos: a quién, qué plantilla y cuándo.</p></div><button type="button" class="btn" id="d-x">${I('back')}Volver a difusiones</button></div>
    <div class="steps">${pasos.map((p, i) => `<button type="button" data-paso="${i + 1}" aria-current="${d.paso === i + 1}"><i>${i + 1}</i>${p}</button>`).join('')}</div>
    <div class="wiz"><div class="frm">
      ${d.paso === 1 ? `<label>Nombre de la difusión<input id="d-n" value="${esc(d.n || '')}" placeholder="Ej. Retomar interesados de este mes"></label>
        <div class="fld">Público${ddSel('data-dpub', [['etapas', 'Por etapas del embudo'], ...(d.seleccion ? [['sel', `Los ${d.seleccion} contactos elegidos en Contactos`]] : []), ...[...SEGMENTOS, ...st.ct.propios].map(x => ['seg:' + x.id, 'Segmento: ' + x.n])], d.publico || 'etapas')}</div>
        ${!d.publico || d.publico === 'etapas' ? `<div class="fld">Etapas del embudo<div class="chips2">${AUD.map(a => `<button type="button" data-aud="${esc(a[0])}" aria-pressed="${d.aud.has(a[0])}">${esc(a[0])} · ${a[1]}</button>`).join('')}</div></div>` : ''}
        <div class="aud"><b>${total.toLocaleString('es-CO')} personas</b><span>Se descuentan las que pidieron no recibir mensajes y las que ya recibieron esta plantilla en los últimos 7 días.</span></div>`
      : d.paso === 2 ? `<div class="fld">Plantilla aprobada${TPL.length ? ddSel('data-tpl', TPL.map(t => [t.n, t.n]), d.tpl) : '<p class="muted" style="margin:0">Todavía no hay plantillas aprobadas por Meta. Créalas en Plantillas.</p>'}</div>
        <div class="fld">Variables<div class="vars">${['nombre → Nombre del contacto','producto → Último producto de interés','fecha → Fecha de la cuota'].map(v => `<span class="vb">{{${esc(v.split(' → ')[0])}}} = ${esc(v.split(' → ')[1])}</span>`).join('')}</div></div>
        <p class="muted">Solo se pueden enviar plantillas aprobadas por Meta. Para escribir texto libre, el cliente debe haber escrito en las últimas 24 horas.</p>`
      : `<div class="fld">Línea de salida${ddSel('data-lin', LINEAS.map(l => [l.id, `${esc(l.n)} · ${esc(l.tel)}`]), d.linea)}</div>
        <div class="fld">Cuándo<div class="chips2"><button type="button" data-cuando="ahora" aria-pressed="${d.cuando === 'ahora'}">Ahora</button><button type="button" data-cuando="prog" aria-pressed="${d.cuando === 'prog'}">Programar</button></div></div>
        ${d.cuando === 'prog' ? `<label>Fecha y hora<input type="datetime-local" value="2026-10-01T09:00"></label>` : ''}
        <div class="fld">Ritmo<div class="chips2"><button type="button" data-ritmo="200" aria-pressed="${(d.ritmo || 200) === 200}">200 por hora, recomendado</button><button type="button" data-ritmo="500" aria-pressed="${d.ritmo === 500}">500 por hora</button></div><p class="muted" style="margin:6px 0 0">Tarda unas ${Math.max(1, Math.ceil(total / (d.ritmo || 200)))} h en salir completa.</p><div hidden></div></div>
        <div class="cost"><div><span>Personas</span><b>${total.toLocaleString('es-CO')}</b></div><div><span>Costo estimado en Meta</span><b>${costo.toLocaleString('es-CO', {style:'currency', currency:'USD'})}</b></div></div>
        <p class="muted">Cuando alguien responda, la conversación se abre en la bandeja y el reparto se la entrega a su asesor o al siguiente del turno.</p>`}
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px">${d.paso > 1 ? `<button type="button" class="btn atras" data-paso="${d.paso - 1}">Atrás</button>` : ''}${d.paso < 3 ? `<button type="button" class="btn pri" data-paso="${d.paso + 1}">Siguiente</button>` : `<button type="button" class="btn pri" id="d-go">${I('send')}${d.cuando === 'ahora' ? 'Enviar a ' + total.toLocaleString('es-CO') + ' personas' : 'Programar difusión'}</button>`}</div>
    </div>
    <div class="phone"><div class="hd">Así lo ve el cliente</div><div class="bub">${esc(tpl.x)}<div class="tm">${hcHora(Date.now())}</div>${tpl.boton ? `<span class="btn2">${esc(tpl.boton)}</span>` : ''}</div></div></div>`;
  el.querySelectorAll('[data-paso]').forEach(b => b.addEventListener('click', () => { d.paso = +b.dataset.paso; render(); }));
  el.querySelectorAll('[data-aud]').forEach(b => b.addEventListener('click', () => { d.aud.has(b.dataset.aud) ? d.aud.delete(b.dataset.aud) : d.aud.add(b.dataset.aud); render(); }));
  el.querySelectorAll('[data-dpub]').forEach(b => b.addEventListener('click', () => { d.publico = b.dataset.dpub; render(); }));
  el.querySelectorAll('[data-tpl]').forEach(b => b.addEventListener('click', () => { d.tpl = b.dataset.tpl; render(); }));
  el.querySelectorAll('[data-lin]').forEach(b => b.addEventListener('click', () => { d.linea = b.dataset.lin; render(); }));
  el.querySelectorAll('[data-ritmo]').forEach(b => b.addEventListener('click', () => { d.ritmo = +b.dataset.ritmo; render(); }));
  el.querySelectorAll('[data-cuando]').forEach(b => b.addEventListener('click', () => { d.cuando = b.dataset.cuando; render(); }));
  const n = el.querySelector('#d-n'); if (n) n.addEventListener('input', () => { d.n = n.value; });
  el.querySelector('#d-x').addEventListener('click', () => { st.dif = null; render(); });
  const go = el.querySelector('#d-go'); if (go && (!total || !TPL.length)) { go.disabled = true; go.title = TPL.length ? 'Elige al menos una etapa' : 'Falta una plantilla aprobada'; } if (go) go.addEventListener('click', () => { if (!total || !TPL.some(t => t.n === d.tpl)) return;
    // Queda en la lista con todo lo necesario para enviarla: contactos, plantilla, línea y ritmo. Sale desde el servidor.
    DIFUSIONES.unshift(difNueva(d));
    st.dif = null; render(); toast(`Difusión en cola para ${total.toLocaleString('es-CO')} personas`); });
}
function plantillaNueva(){
  const t = st.tplNueva, el = document.getElementById('page');
  const cuerpo = t.body || ' ';
  el.innerHTML = `<div class="pg-h"><div><h2>Nueva plantilla</h2><p class="sub">Escribe el mensaje, mira cómo se ve y mándalo a Meta para aprobación.</p></div><button type="button" class="btn" id="t-x">${I('back')}Volver a plantillas</button></div>
    <div class="wiz"><div class="frm">
      <label>Nombre interno<input id="t-n" value="${esc(t.nombre)}" placeholder="Ej. Recordatorio de pago"></label>
      <div class="fld">Categoría${ddSel('data-cat', [['Marketing','Marketing · 0,0125 USD por envío'],['Utilidad','Utilidad · 0,0008 USD por envío']], t.cat)}</div>
      <div class="fld">Encabezado${ddSel('data-headtipo', [['texto','Texto'],['video','Video']], t.headTipo || 'texto')}</div>
      ${(t.headTipo || 'texto') === 'video'
        ? (t.video ? `<div class="mj-arch"><span class="ic">${I('video')}</span><span style="flex-grow:1;min-width:0"><b>${esc(t.video.n)}</b><small>${t.video.subiendo ? 'Subiendo…' : `Video${t.video.dur ? ' · ' + esc(t.video.dur) : ''} · ${esc(tamano(t.video.peso || 0))} (máximo 16 MB)`}</small></span><button type="button" class="mj-x2" id="t-vx" aria-label="Quitar el video">${I('x')}</button></div>`
          : `<div><button type="button" class="btn" id="t-vadd">${I('clip')}Agregar video</button> <span class="muted" style="font-size:12px">MP4 de hasta 16 MB</span></div>`)
        : `<label>Texto del encabezado, opcional<input id="t-h" value="${esc(t.head)}" placeholder="Ej. Te recordamos"></label>`}
      <label>Cuerpo<textarea id="t-b">${esc(t.body)}</textarea></label>
      <div class="vars"><span style="font-size:11.5px;color:var(--ink3);align-self:center">Insertar variable:</span>${['nombre','producto','fecha','asesor','enlace'].map(v => `<button type="button" data-var="${v}">{{${v}}}</button>`).join('')}</div>
      <label>Pie, opcional<input id="t-f" value="${esc(t.foot)}"></label>
      <div class="fld">Botón, opcional${ddSel('data-btn', [['','Sin botón'],['Respuesta rápida','Respuesta rápida'],['Enlace','Enlace'],['Llamar','Llamar']], t.btn)}</div>
      ${t.btn ? `<label>Texto del botón<input id="t-bt" value="${esc(t.btnTxt)}" placeholder="${t.btn === 'Enlace' ? 'Ver más' : t.btn === 'Llamar' ? 'Llamar a mi asesor' : 'Sí, quiero información'}"></label>` : ''}
      ${t.btn === 'Enlace' ? `<label>Enlace del botón<input id="t-bu" value="${esc(t.btnUrl || '')}" placeholder="https://www.tuempresa.com"></label>` : ''}
      ${t.btn === 'Llamar' ? `<label>Número a llamar<input id="t-bl" value="${esc(t.btnTel || '')}" placeholder="+57 300 123 4567" inputmode="tel"></label>` : ''}
      <p class="muted">Meta rechaza plantillas con promesas sin condiciones, mayúsculas sostenidas o variables sin ejemplo. Antes de enviarla se revisan esas reglas aquí.</p>
      <div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn" id="t-guardar">Guardar borrador</button><button type="button" class="btn pri" id="t-meta">${I('send')}Enviar a Meta</button></div>
    </div>
    <div class="phone"><div class="hd">Así lo ve el cliente</div><div class="bub">${t.headTipo === 'video' ? `<div class="mj-vid"><span>${I('play')}</span></div>` : ''}${t.head && t.headTipo !== 'video' ? `<div class="h">${esc(t.head)}</div>` : ''}${esc(cuerpo)}${t.foot ? `<div class="ft">${esc(t.foot)}</div>` : ''}<div class="tm">${hcHora(Date.now())}</div>${t.btn ? `<span class="btn2">${esc(t.btnTxt || (t.btn === 'Enlace' ? 'Ver más' : t.btn === 'Llamar' ? 'Llamar a mi asesor' : 'Sí, quiero información'))}</span>` : ''}</div></div></div>`;
  const bind = (id, k) => { const x = el.querySelector(id); if (x) x.addEventListener('input', () => { t[k] = x.value; if (k !== 'body' && k !== 'nombre' && k !== 'btnTxt') return; const pv = el.querySelector('.bub'); if (k === 'body') pv.childNodes[t.headTipo === 'video' || t.head ? 1 : 0].textContent = x.value; }); };
  bind('#t-n', 'nombre'); bind('#t-b', 'body'); bind('#t-bt', 'btnTxt'); bind('#t-bu', 'btnUrl'); bind('#t-bl', 'btnTel');
  const btx = el.querySelector('#t-bt'); if (btx) btx.addEventListener('input', () => { const b2 = el.querySelector('.bub .btn2'); if (b2) b2.textContent = btx.value || b2.textContent; });
  ['#t-h', '#t-f'].forEach((id, i) => { const x = el.querySelector(id); if (!x) return; x.addEventListener('input', () => { t[i ? 'foot' : 'head'] = x.value; const pv = el.querySelector('.bub'); const n = pv.querySelector(i ? '.ft' : '.h'); if (n) n.textContent = x.value; }); x.addEventListener('change', () => { t[i ? 'foot' : 'head'] = x.value; render(); }); });
  el.querySelectorAll('[data-cat]').forEach(b => b.addEventListener('click', () => { t.cat = b.dataset.cat; render(); }));
  // Encabezado con video (lote 7, tablero 7): un MP4 de hasta 16 MB que se sube a la Nube del CRM.
  el.querySelectorAll('[data-headtipo]').forEach(b => b.addEventListener('click', () => { t.headTipo = b.dataset.headtipo; render(); }));
  const vadd = el.querySelector('#t-vadd'); if (vadd) vadd.addEventListener('click', () => {
    const i = document.createElement('input'); i.type = 'file'; i.accept = 'video/mp4'; i.hidden = true; document.body.appendChild(i);
    i.addEventListener('cancel', () => i.remove());
    i.addEventListener('change', () => { const f = (i.files || [])[0]; i.remove(); if (!f) return;
      if (!/^video\/mp4$/.test(f.type || '') && !/\.mp4$/i.test(f.name)) { toast('El video debe ser MP4'); return; }
      if (f.size > 16 * 1024 * 1024) { toast('El video pasa de 16 MB, el máximo de WhatsApp'); return; }
      const v = t.video = {n: f.name, peso: f.size, subiendo: true}; render();
      crmSubir(f).then(r => { Object.assign(v, {n: r.n || f.name, url: r.url, mime: 'video/mp4', peso: r.bytes || f.size}); delete v.subiendo; }, err => { if (t.video === v) t.video = null; toast(`No se pudo subir el video. ${err.message}`); })
        .finally(() => { if (st.tplNueva === t) render(); }); });
    i.click(); });
  const vx = el.querySelector('#t-vx'); if (vx) vx.addEventListener('click', () => { t.video = null; render(); });
  el.querySelectorAll('[data-btn]').forEach(b => b.addEventListener('click', () => { t.btn = b.dataset.btn; render(); }));
  el.querySelectorAll('[data-var]').forEach(b => b.addEventListener('click', () => { const ta = el.querySelector('#t-b'); const p = ta.selectionStart ?? ta.value.length; ta.value = ta.value.slice(0, p) + '{{' + b.dataset.var + '}}' + ta.value.slice(p); t.body = ta.value; render(); }));
  el.querySelector('#t-x').addEventListener('click', () => { st.tplNueva = null; render(); });
  // Los borradores son de cada persona (quedan en sus preferencias); «Enviar a Meta» la crea en Meta para aprobación.
  el.querySelector('#t-guardar').addEventListener('click', () => { const b = {n: t.nombre.trim() || 'Plantilla sin nombre', c: t.cat, e:'g', x:'Borrador', u:0, b: t.body, head: t.head, foot: t.foot, btn: t.btn, btnTxt: t.btnTxt, borrador:true}; AJ.borradores = [b, ...(AJ.borradores || []).filter(x => x.n !== b.n)]; PLANTILLAS.unshift(b); st.tplNueva = null; render(); toast('Plantilla guardada como borrador'); });
  el.querySelector('#t-meta').addEventListener('click', async ev => { if (!t.nombre.trim() || !t.body.trim()) { toast('Ponle nombre y cuerpo a la plantilla'); return; }
    const conVideo = t.headTipo === 'video'; if (conVideo && (!t.video || !t.video.url)) { toast(t.video ? 'Espera a que termine de subir el video' : 'Agrega el video del encabezado'); return; }
    const bt = ev.currentTarget; bt.disabled = true;
    try { await crmApi('POST', '/crm/plantillas', {n: t.nombre.trim(), c: t.cat, b: t.body, head: conVideo ? '' : (t.head || ''), foot: t.foot || '', btn: t.btn || '', btnTxt: t.btnTxt || '', btnUrl: t.btnUrl || '', btnTel: t.btnTel || '', ...(conVideo ? {video: {url: t.video.url, n: t.video.n, peso: t.video.peso}} : {})}); AJ.borradores = (AJ.borradores || []).filter(x => x.n !== t.nombre.trim()); st.tplNueva = null; await crmPlantillas(); render(); toast('Plantilla enviada a Meta: queda «En revisión»'); }
    catch (err) { bt.disabled = false; toast(err.message); } });
}
// Un filtro que apunta a algo que ya no existe (otra persona borró la línea, el equipo, la etapa
// o la etiqueta) se quita solo: si no, la bandeja fallaba al pintarse.
function limpiarFiltros(){
  if (st.carpeta && !CARPETAS.some(x => x.id === st.carpeta)) st.carpeta = null;
  if (st.equipo && !EQUIPOS.some(x => x.id === st.equipo)) st.equipo = null;
  if (st.linea && !LINEAS.some(x => x.id === st.linea)) st.linea = null;
  if (st.canal && !CANALES[st.canal]) st.canal = null;
  if (st.etq && !(st.etq in COL)) st.etq = null;
  if (st.tag && !(st.tag in ETIQ_COL)) st.tag = null;
}
function filtroActivo(){
  limpiarFiltros();
  const f = [];
  if (st.carpeta) { const k = CARPETAS.find(x => x.id === st.carpeta); f.push({tipo:'carpeta', ic:k.ic, n:k.n}); }
  if (st.equipo) f.push({tipo:'equipo', ic:'users', n:'Equipo ' + EQUIPOS.find(x => x.id === st.equipo).n});
  if (st.etq) f.push({tipo:'etq', dot:COL[st.etq], n:st.etq});
  if (st.linea) f.push({tipo:'linea', ic:'wa', n:LINEAS.find(x => x.id === st.linea).n});
  if (st.canal) f.push({tipo:'canal', ic:CANALES[st.canal].ic, n:CANALES[st.canal].n});
  if (st.tag) f.push({tipo:'tag', dot:ETIQ_COL[st.tag], n:st.tag});
  return f;
}
// Íconos con el trazo de las maquetas de la tarjeta y del encabezado del chat (el sprite de crm.html tiene otros).
const ICONOS_MAQ = {
  campana: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/></svg>',
  megafono: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1Z"/><path d="M15 9a3 3 0 0 1 0 6"/></svg>',
  llama: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3c1 3 4.5 4.8 4.5 9a4.5 4.5 0 0 1-9 0c0-1.7.7-3 1.8-4 .2 1.6 1 2.5 2.2 2.8C11 8.2 11 5.6 12 3Z"/></svg>',
};
// El distintivo del canal en la tarjeta y en la segunda fila del encabezado: WhatsApp va con el globo de contorno de
// las maquetas (no con el logo relleno del sprite); los demás canales, que las maquetas no dibujan, con su ícono.
const icCanal = (canal, cls = 'i') => canal === 'wa' ? `<svg class="${esc(cls)}" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.4A8.5 8.5 0 1 1 21 12Z"/></svg>` : I(CANALES[canal].ic, cls);
function lista(){
  const qi = document.getElementById('q'); if (qi.value !== st.q) qi.value = st.q; document.getElementById('q-x').hidden = !st.q;
  const fa = filtroActivo();
  document.getElementById('lt').textContent = st.menciones ? 'Menciones' : fa.length ? fa[fa.length - 1].n.replace(/^Equipo /, '') : st.vista === 'mias' ? 'Mi bandeja' : st.vista === 'sin' ? 'Sin asignar' : 'Conversaciones';
  const fc = document.getElementById('fchips');
  fc.hidden = !fa.length;
  fc.innerHTML = fa.map(f => `<span class="fchip">${f.dot ? `<span class="dot" style="background:${colorOk(f.dot)}"></span>` : I(f.ic)}${esc(f.n)}<button type="button" data-quitar="${f.tipo}" aria-label="Quitar filtro ${esc(f.n)}">${I('x')}</button></span>`).join('') + (fa.length > 1 ? `<button type="button" class="fclear" data-quitar="todo">Quitar todos</button>` : '');
  let L = visibles();
  if (st.menciones) { const q = st.q.trim().toLowerCase(); L = convsMencion().filter(c => !q || c.n.toLowerCase().includes(q) || MENCIONES.some(m => m.convId === c.id && m.texto.toLowerCase().includes(q))); }
  if (st.orden === 'reciente') L = [...L].sort((a, b) => ((recPend(b).length ? 1 : 0) - (recPend(a).length ? 1 : 0)) || a.min - b.min);
  if (st.orden === 'antiguo') L = [...L].sort((a, b) => b.min - a.min);
  if (st.orden === 'espera') L = [...L].sort((a, b) => b.esperaMin - a.esperaMin);
  // Cada conversación es la tarjeta de la maqueta aprobada «CRM · tarjetas de la lista» (29-sep). El texto del contacto
  // (vista previa) va siempre en peso normal; sin leer cambia solo el nombre, la hora y el tono del texto.
  const chip = (cls, ico, t) => `<span class="tj-chip${cls ? ' ' + cls : ''}">${ico}<span>${esc(t)}</span></span>`;
  // La etapa se distingue de las etiquetas (maqueta «tarjetas de la bandeja», 3-oct): píldora de su color; las etiquetas, punto y texto.
  const tinte = (c, a) => { let x = colorOk(c).slice(1); if (x.length <= 4) x = x.split('').map(d => d + d).join(''); const n = parseInt(x.slice(0, 6), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
  const chipEtapa = e => `<span class="tj-chip et" style="background:${tinte(COL[e], .16)};color:color-mix(in srgb, ${colorOk(COL[e])} 70%, #000)"><span>${esc(e)}</span></span>`;
  document.getElementById('items').innerHTML = L.length ? L.map(c => {
    const ult = [...c.msgs].reverse().find(m => m.in || (m.out != null && !m.prog) || m.recepcion || m.ia);
    const txt = ult ? (ult.in ? resumenIn(ult.in) : ult.recepcion ? 'IA: ' + ult.recepcion : ult.ia ? 'IA: ' + ult.ia : 'Tú: ' + resumenOut(ult)) : '';
    const eq = equipoConv(c), recs = recPend(c), vencido = recs.some(r => recEst(r) === 'vencido');
    const anuncio = c.pauta ? c.pauta.campana || c.pauta.anuncio || c.pauta.plataforma || '' : '';
    // Línea 4: etapas, etiquetas, seguimiento, el anuncio del que llegó y «No contactar»; si no hay nada, no sale.
    const chips = [...c.etq.map(chipEtapa), ...c.tags.map(t => chip('tg', `<i style="background:${colorOk(ETIQ_COL[t])}"></i>`, t)),
      recs.length ? chip(vencido ? 'rj' : 'am', ICONOS_MAQ.campana, vencido ? 'Seguimiento vencido' : 'Seguimiento hoy') : '',
      anuncio ? chip('', ICONOS_MAQ.megafono, anuncio) : '', c.noContactar ? chip('rj', I('block'), 'No contactar') : ''].join('');
    return `<button type="button" class="it${c.unread ? ' unread' : ''}" data-c="${c.id}" aria-current="${st.sel === c.id}">
      <span class="tj-foto"><span class="av tj-av" style="background:${AVC[c.id % AVC.length]}">${esc(ini(c.n))}</span><span class="tj-canal${c.canal === 'wa' ? ' wa' : ''}">${icCanal(c.canal)}</span></span>
      <span class="tj-cu">
        <span class="tj-l1"><b>${esc(c.n)}</b><time>${esc(c.hora)}</time></span>
        <span class="tj-l2"><span class="tj-msg">${esc(txt)}</span>${c.unread ? `<span class="tj-cnt">${c.unread}</span>` : ''}</span>
        ${chips ? `<span class="tj-l4">${chips}</span>` : ''}
      </span>
      <span class="tj-l3 tj-pie${c.asig ? '' : ' libre'}">${c.asig
        ? `<span class="av tj-mini" style="background:${colorPersona(c.asig)}">${fotoAv(fotoDe(c.asig), c.asig)}</span><span class="tj-as"><span>Atiende <b>${esc(c.asig)}</b></span></span>`
        : '<span class="tj-mini tj-sin">?</span><span class="tj-as"><span><b>Sin asignar</b> · nadie la atiende</span></span>'}${c.espera ? `<span class="tj-esp">${I('clock')}${esc(c.espera)}</span>` : ''}<span class="tj-eq"><i style="background:${colorEquipo(eq)}"></i>${esc(eq)}</span></span>
    </button>`;
  }).join('') : (st.q.trim() ? `<div class="nothing"><b>Ningún lead con «${esc(st.q.trim())}»</b><span>${st.vista !== 'todas' || fa.length ? 'Buscaste solo en esta vista.' : 'Revisa el nombre o prueba con el número.'}</span>${st.vista !== 'todas' ? `<button type="button" class="btn" data-ver-todas="1">Buscar en todas las conversaciones</button>` : ''}</div>` : st.menciones ? `<div class="empty">${I('at')}<b>Sin menciones</b><span>Cuando un compañero te mencione en una nota privada, aparece aquí.</span></div>` : `<div class="nothing"><b>Nada por aquí</b><span>${fa.length ? 'Ninguna conversación ' + (st.vista === 'mias' ? 'tuya ' : st.vista === 'sin' ? 'sin asignar ' : '') + 'coincide con ' + esc(fa.map(f => f.n).join(' y ')) + '.' : 'No hay conversaciones activas en esta vista.'}</span>${fa.length ? `<button type="button" class="btn" data-quitar="todo">Quitar filtros</button>` : ''}${st.vista !== 'todas' && fa.length ? `<button type="button" class="btn" data-ver-todas="1">Ver las de todo el equipo</button>` : ''}</div>`);
}

const estrellas = n => `<span class="stars" aria-label="${n} de 5">${[1,2,3,4,5].map(i => `<svg class="${i <= n ? 'on' : ''}"><use href="#i-star"/></svg>`).join('')}</span>`;
const npsCls = n => n >= 9 ? 'p' : n >= 7 ? 'n' : 'd';
const resumenIn = x => typeof x === 'string' ? x : x.sticker ? 'Sticker' : x.img ? '📷 ' + (x.cap || 'Imagen') : x.video ? '🎬 ' + (x.cap || 'Video') : x.doc ? '📄 ' + (x.n || 'Documento') : '🎤 Nota de voz';
const resumenOut = m => m.out || (m.audio ? '🎤 Nota de voz' : m.file ? '📎 ' + m.file.n : m.link ? m.link.p : '');
const estadoEnvio = m => m._estado === 'enviando' ? `<span title="Enviando">${I('clock')}</span>` : m._estado === 'enviado' ? `<span title="Enviado">${I('check')}</span>` : m._estado === 'entregado' ? `<span title="Entregado">${I('check2')}</span>` : m._estado === 'leido' ? `<span class="leido" title="Leído">${I('check2')}</span>` : m._estado === 'fallido' ? '' : I('check2');
function burbuja(m){
  if (m.csat) return `<div class="csat"><div class="t">${I('star')}Respondió la encuesta</div><div class="r"><span>Atención de ${esc(m.csat.asesor)}</span><span>${estrellas(m.csat.aten)} <b>${esc(m.csat.aten)} de 5</b></span></div><div class="r"><span>Recomendaría a ${esc(ESPACIO.nombre || 'la empresa')}</span><span class="nps ${npsCls(m.csat.nps)}">${esc(m.csat.nps)}</span></div>${m.csat.com ? `<q>${esc(m.csat.com)}</q>` : ''}</div>`;
  if (m.d) return `<span class="day">${m.d}</span>`;
  if (m.ev) return `<span class="ev">${I(m.ev)}${esc(m.t)}</span>`;
  if (m.note) return `<div class="m note"><span class="by">${I('note')}Nota privada · ${esc(m.by)}</span>${esc(m.note)}<div class="ft">${esc(m.h || '')}</div></div>`;
  if (m.bot) {
    // Lo que manda un flujo: su nombre, el texto y las opciones que vio el cliente.
    const ops = Array.isArray(m.botones) ? m.botones.map(x => typeof x === 'string' ? x : x && x.t).filter(Boolean) : [];
    const filas = m.lista && Array.isArray(m.lista.ops) ? m.lista.ops.map(x => typeof x === 'string' ? x : x && x.t).filter(Boolean) : [];
    const extra = ops.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px">${ops.map(o => `<span style="border:1px solid #cfe4ff;border-radius:6px;padding:2px 8px;font-size:12px;color:var(--blue-ink);background:#fff">${esc(o)}</span>`).join('')}</div>`
      : filas.length ? `<div style="margin-top:6px;font-size:12px;color:var(--blue-ink)">${esc(m.lista.boton || 'Ver opciones')}: ${esc(filas.join(' · '))}</div>` : '';
    return `<div class="m recepcion" style="background:#eef6ff;border-color:#cfe4ff"><span class="by" style="color:var(--blue-ink)">${I('flow')}${esc(m.flujo ? 'Flujo · ' + m.flujo : 'Flujo')}</span>${esc(m.bot)}${extra}<div class="ft">${esc(m.h || '')}${estadoEnvio(m) || I('check2')}</div></div>`;
  }
  if (m.recepcion) return `<div class="m recepcion"><span class="by">${I('moon')}Recepcionista · IA · fuera de horario</span>${esc(m.recepcion)}<div class="ft">${esc(m.h || '')}${I('check2')}</div></div>`;
  if (m.in) {
    const x = m.in;
    if (typeof x === 'object') {
      const cap = x.cap ? `<div class="cap">${esc(x.cap)}</div>` : '';
      let cuerpo;
      if (x.img) cuerpo = `<a href="${esc(x.img)}" target="_blank" rel="noopener"><img class="media${x.sticker ? ' stk' : ''}" src="${esc(x.img)}" alt="${x.sticker ? 'Sticker' : 'Imagen'}" loading="lazy"></a>${cap}`;
      else if (x.video) cuerpo = `<video class="media" controls preload="metadata" src="${esc(x.video)}"></video>${cap}`;
      else if (x.doc) cuerpo = `<a class="filecard" href="${esc(x.doc)}" target="_blank" rel="noopener"><span class="lc">${I('file')}</span><span><b>${esc(x.n || 'Documento')}</b><span>Abrir el archivo</span></span></a>${cap}`;
      else cuerpo = `${x.url ? `<audio controls preload="none" src="${esc(x.url)}"></audio>` : `<span style="font-size:12px;color:var(--ink3)">${I('mic')} Nota de voz</span>`}${x.trans ? `<div class="trans">${esc(x.trans)}</div>` : ''}`;
      return `<div class="m in">${cuerpo}<div class="ft">${esc(m.h || '')}</div></div>`;
    }
    // Un correo lleva su asunto arriba (correo.ts).
    return `<div class="m in">${m.asunto ? `<span class="by">${I('mail')}${esc(m.asunto)}</span>` : ''}${esc(m.in)}<div class="ft">${esc(m.h || '')}</div></div>`;
  }
  if (m.prog) { const cuando = m.para || m._prog ? hcCuando(m.para || m._prog) : m.prog; return `<div class="m prog"><span class="by">${I('clock')}Programado · ${esc(cuando)}</span>${esc(m.out)}<div class="ft">Sale ${esc(cuando.toLowerCase())}<button type="button" class="x2" data-prog-cancel="${esc(m.pid || m._id)}">Cancelar</button></div></div>`; }
  if (m.out != null) {
    const fallo = m._estado === 'fallido';
    let texto = String(m.out || ''); if (m.link && m.link.url && texto.endsWith(m.link.url)) texto = texto.slice(0, -m.link.url.length).trim();
    const extra = m.file ? `<a class="filecard"${m.file.url ? ` href="${esc(m.file.url)}" target="_blank" rel="noopener"` : ''}><span class="lc">${I(m.file.ic || 'file')}</span><span><b>${esc(m.file.n)}</b><span>${esc(m.file.t || 'Abrir el archivo')}</span></span></a>`
      : m.audio ? `<audio controls preload="none" src="${esc(m.audio.url)}"></audio>`
      : m.link ? `<div class="linkcard"${m.link.url ? ` data-url="${esc(m.link.url)}" title="Copiar el enlace"` : ''}><span class="lc">${I('link')}</span><span><b>${esc(m.link.p)}</b><span>${esc(m.link.m)} · ${esc(m.link.pr)} · enlace de ${esc(m.by || yo)}</span></span></div>` : '';
    return `<div class="m out${fallo ? ' fallo' : ''}">${m.by && m.by !== yo ? `<span class="by">${esc(m.by)}</span>` : ''}${m.plantilla ? `<span class="by" style="opacity:.85">Plantilla «${esc(m.plantilla)}»</span>` : ''}${esc(texto)}${extra}${fallo ? `<div class="err">${esc(m._error || 'No se pudo enviar')}</div>` : ''}<div class="ft">${esc(m.h || '')}${estadoEnvio(m)}</div></div>`;
  }
  return '';
}

function chat(){
  const vis = st.menciones ? convsMencion() : visibles();
  let c = vis.find(x => x.id === st.sel) || vis[0];
  document.getElementById('app').classList.toggle('sinchat', !c);
  if (!c) return;
  st.sel = c.id;
  const av = document.getElementById('c-av'); av.style.background = AVC[c.id % AVC.length]; av.innerHTML = esc(ini(c.n));
  document.getElementById('c-name').textContent = c.n;
  const l = LINEAS.find(x => x.id === c.linea);
  // Encabezado de la maqueta aprobada (29-sep): la espera junto al nombre y la segunda fila en una sola línea.
  document.getElementById('c-sub').innerHTML = [`#${c.id}`, icCanal(c.canal, c.canal === 'wa' ? 'i wa' : 'i') + esc(c.canal === 'wa' && st.rol === 'l' && l ? l.n : CANALES[c.canal].n), esc(c.tel)].filter(Boolean).join(' · ');
  const sla = document.getElementById('sla'); sla.className = 'sla' + (c.espera ? '' : ' ok'); sla.innerHTML = ICONOS_MAQ.llama + (c.espera ? `Espera ${esc(c.espera)}` : 'Al día');
  // Chat con la forma de la maqueta aprobada «CRM · chat rediseñado» (28-sep): pintarChat, al final de 50-agentes.js.
  document.getElementById('msgs').innerHTML = pintarChat(c);
  const cerr = /cerrada/i.test(c.ventana);
  pintarAvisos(c);
  const w = document.getElementById('win'); w.className = 'win' + (cerr ? ' cerr' : ''); w.innerHTML = I(cerr ? 'lock' : 'clock') + esc(c.ventana);
  document.getElementById('ta').placeholder = cerr ? (sinPlantillas(c) ? 'Podrás responderle cuando vuelva a escribir' : 'Elige una plantilla aprobada para retomar la conversación') : 'Escribe un mensaje. Escribe / para usar una respuesta rápida';
  const bl = document.getElementById('b-link'); bl.hidden = !usaEnlacesPago(c) || !CATALOGO.length;   // sin catálogo conectado (GET /crm/catalogo vacío) el botón no sale if (bl.hidden) document.getElementById('lk').hidden = true;
  panel(c);
  const box = document.getElementById('msgs'); box.scrollTop = box.scrollHeight;
  // Leído al responder (6-oct): abrir el chat ya no lo marca como leído; responderle sí (más abajo, en Enviar).
}
// Solo cuenta como leída si de verdad se está viendo: pestaña visible y, en celular, el chat abierto.
function laVeo(){ return document.visibilityState === 'visible' && (innerWidth >= 760 || document.getElementById('app').classList.contains('open')); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && !st.pagina && st.sel) render(); });

// Las secciones del panel recuerdan si la persona las abrió o cerró: el panel se repinta con cada mensaje.
const SEC_CERRADA = {};
function sec(id, ic, t, body, src = '', closed = false){
  const cerrada = id in SEC_CERRADA ? SEC_CERRADA[id] : closed;
  return `<section class="sec" data-id="${id}" ${cerrada ? 'data-closed' : ''}><button type="button" data-sec="${id}" aria-expanded="${!cerrada}">${I(ic)}<span class="t">${t}</span>${src ? `<span class="src">${src}</span>` : ''}${I('chev','i chev')}</button><div class="body">${body}</div></section>`;
}
function recHtml(c){
  const sg = sugerenciaRec(c), ops = recOpciones();
  // Lote 7 (tablero 5): día y hora en dos desplegables; por defecto, la próxima media hora (o mañana a las 9 si ya es tarde).
  st.recNuevo = st.recNuevo && st.recNuevo.id === c.id ? st.recNuevo : {id:c.id, abierto:false, cuando:'otra', texto:'', ...recPorDefecto()};
  const n = st.recNuevo; n.cuando = 'otra';
  return `${sg ? `<div class="rsug"><span>Dijo «${esc(sg.frase)}». ¿Te lo recuerdo?</span><button type="button" class="btn" data-rec-sug="1">${I('bell')}Recordarme ${esc(sg.cuando.split(',')[0].toLowerCase())} a las 10 a. m.</button></div>` : ''}
    ${(c.recs || []).length ? `<div class="recs">${c.recs.map((r, i) => { const e = recEst(r); return `<div class="rec ${r.hecho ? 'hecho' : ''}"><button type="button" class="ck" data-rec-done="${i}" aria-label="${r.hecho ? 'Marcar pendiente' : 'Marcar hecho'}">${I('check')}</button><span><b>${esc(r.t)}</b><small class="${r.hecho ? '' : e === 'vencido' ? 'vence' : e === 'hoy' ? 'hoy' : ''}">${r.hecho ? 'Hecho' : (e === 'vencido' ? 'Venció · ' : '') + esc(recFechaDe(r) ? hcCuando(recFechaDe(r)) : r.cuando)}</small></span><button type="button" class="x" data-rec-del="${i}" aria-label="Borrar recordatorio">${I('x')}</button></div>`; }).join('')}</div>` : (sg ? '' : '<p class="muted">Sin recordatorios. El día que programes, la conversación sale de primera en tu bandeja.</p>')}
    ${n.abierto ? `<div class="rnew"><input id="rec-t" placeholder="¿Qué hay que hacer? Ej. confirmar el pago" value="${esc(n.texto)}"><div class="rdos">${ddSel('data-rec-dia', recDias(), n.dia, 'Elige el día')}${ddSel('data-rec-hora', hcOpcionesHora(), n.hora, 'Elige la hora')}</div><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn" data-rec-cancel="1">Cancelar</button><button type="button" class="btn pri" data-rec-add="1">${I('bell')}Programar</button></div></div>` : `<div><button type="button" class="btn" data-rec-nuevo="1">${I('plus')}Nuevo recordatorio</button></div>`}`;
}
function listaTags(c, q){
  const t = norm(q).trim(), eq = eqDeConv(c);
  const pasa = ([n]) => !c.tags.includes(n) && (!t || norm(n).includes(t));
  const delEq = ETIQS.filter(e => eqDeEtiq(e) === eq && pasa(e)), todos = ETIQS.filter(e => !eqDeEtiq(e) && pasa(e));
  const exacta = ETIQS.some(([n]) => norm(n) === t);
  const op = ([n, col]) => `<button type="button" data-tag-add="${esc(n)}"><span class="dot" style="background:${colorOk(col)}"></span>${esc(n)}</button>`;
  const vacio = t ? `Ninguna con «${esc(q.trim())}»` : 'Ninguna';
  const eqI = EQUIPOS.findIndex(x => x.n === eq), colEq = typeof colorDe === 'function' ? colorOk(colorDe(eq, eqI)) : '#9ca3af';
  return `<div class="tg-grp"><span class="tg-sq" style="background:${colEq}"></span>${esc(eq)}</div>${delEq.length ? delEq.map(op).join('') : `<div class="tg-vacio">${vacio}</div>`}
    <div class="tg-grp">Todos los equipos</div>${todos.length ? todos.map(op).join('') : `<div class="tg-vacio">${vacio}</div>`}
    ${t && !exacta ? `<div class="tg-crear"><button type="button" data-tag-crear="${esc(q.trim())}">${I('plus')}Crear «${esc(q.trim())}» en ${esc(eq)}</button></div>` : ''}`;
}
const prioridadDe = c => c.prioridad || (c.etq.includes('Caliente') ? 'Alta' : 'Normal');
// Prioridad con ícono de señal, un color por nivel: cuántas barras se llenan y de qué color.
const PRIORIDADES = [['Urgente', '#dc2626', 4], ['Alta', '#ea580c', 3], ['Normal', '#1f93ff', 2], ['Baja', '#9ca3af', 1]];
const senal = p => { const [, col, n] = PRIORIDADES.find(x => x[0] === p) || PRIORIDADES[2]; return `<svg class="pc-senal" viewBox="0 0 16 16" aria-hidden="true">${[0, 1, 2, 3].map(i => `<rect x="${1 + i * 4}" y="${11 - i * 3}" width="2.6" height="${4 + i * 3}" rx="1" fill="${i < n ? col : '#dfe4ec'}"/>`).join('')}</svg>`; };
const silenciado = c => (AJ.silenciados || []).includes(c.contactoId || c.id);
// Conversaciones finalizadas del mismo contacto, más las que el API trae en la ficha.
function historial(c){
  const antes = CONV.filter(o => o.id !== c.id && c.contactoId && o.contactoId === c.contactoId && o.est === 'finalizadas').sort((a, b) => crmT(b) - crmT(a));
  return [...antes.map(o => `<button type="button" class="pc-hi" data-prev-conv="${o.id}" title="Ver la conversación">${I((CANALES[o.canal] || {ic:'chat'}).ic)}<span>${esc((CANALES[o.canal] || {n:'Conversación'}).n)}${o.motivo ? ' · ' + esc(o.motivo) : ''}<small>Finalizada el ${esc(hcDia((o._t && (o._t.finalizada || o._t.ultimo)) || Date.now()))}</small></span></button>`),
    ...(c.ficha.previas || []).map(([a, b]) => `<div class="pc-hi">${I('chat')}<span>${esc(a)}<small>${esc(b)}</small></span></div>`)];
}
// Equipo de la conversación, su color y sus personas (Equipos y reparto, 40-ajustes.js).
const equipoConv = c => c.equipo || 'Ventas';
// Los enlaces de pago son de quien vende: solo en las conversaciones de Ventas y para quien es de Ventas.
const usaEnlacesPago = c => equipoConv(c) === 'Ventas';
const yoVendo = () => typeof ALCANCE === 'undefined' || !ALCANCE.on || ALCANCE.equipos.includes('Ventas');
const colorEquipo = eq => { const i = EQUIPOS.findIndex(q => q.n === eq); return typeof colorDe === 'function' ? colorOk(colorDe(eq, i)) : '#9ca3af'; };
function personasDeEquipo(eq){
  let ids = typeof idsDe === 'function' ? idsDe(eq) : [];
  if (!ids.length && eq === 'Ventas') ids = USUARIOS.filter(u => u.rol === 'VENDEDOR').map(u => u.id);
  return ids.map(id => USUARIOS.find(u => u.id === id)).filter(Boolean);
}
// Un solo color por persona en todo el CRM (bandeja, chat, panel, eventos, Personas y Mi perfil): sale de su id, no del orden de la lista.
const colorDeUsuario = (id, nombre) => AVC[Math.abs(hashN(id || nombre || '')) % AVC.length];
const colorPersona = nombre => colorDeUsuario((USUARIOS.find(u => u.nombre === nombre) || {}).id, nombre);
const fotoDe = nombre => (USUARIOS.find(u => u.nombre === nombre) || {}).foto || null;
// Menús del panel (equipo, asesor, prioridad y etapa): uno abierto a la vez, con el botón marcado mientras está abierto.
const MENUS_PANEL = ['eq', 'asig', 'pri', 'etq'];
function cerrarMenusPanel(solo){
  for (const k of MENUS_PANEL) { if (solo && k !== solo) continue; const m = document.getElementById(k + '-m'), b = document.getElementById(k + '-b'); if (m) m.hidden = true; if (b) b.setAttribute('aria-expanded', 'false'); }
}
function abrirMenuPanel(k){
  const m = document.getElementById(k + '-m'), abierto = m && !m.hidden;
  cerrarMenusPanel(); if (!m || abierto) return false;
  m.hidden = false; document.getElementById(k + '-b').setAttribute('aria-expanded', 'true'); return true;
}
// Líderes de cada equipo (Equipos y reparto): se marcan en la lista de personas.
const esLiderDe = (id, eq) => ((typeof EQ_CFG !== 'undefined' && EQ_CFG.lideres && EQ_CFG.lideres[eq]) || []).includes(id);
function opcionesAsesor(c, q){
  const eq = equipoConv(c), n = norm(q), abiertas = id => CONV.filter(x => x.asigId === id && x.est === 'abiertas').length;
  // Primero los conectados (en línea, ocupados, ausentes y al final los desconectados), luego por nombre (6-oct).
  const ORDEN_EST = {'En línea':0, 'Ocupada':1, 'Ausente':2, 'Desconectado':3};
  const gente = personasDeEquipo(eq).filter(u => !n || norm(u.nombre).includes(n))
    .sort((a, b) => (ORDEN_EST[estadoDe(a)] ?? 3) - (ORDEN_EST[estadoDe(b)] ?? 3) || a.nombre.localeCompare(b.nombre, 'es'));
  const sin = !n || norm('Sin asignar').includes(n) ? `<button type="button" role="option" class="pc-op" data-a="" aria-selected="${!c.asig}"><span class="av" style="background:#e5e9f0;color:#6b7280">–</span><span class="pc-tx"><span>Sin asignar</span><small>La toma el reparto del equipo</small></span>${!c.asig ? I('check','i ck') : ''}</button>` : '';
  const vacio = gente.length ? '' : `<p class="muted" style="padding:8px 10px;margin:0">${n ? 'Nadie coincide.' : esc(eq) + ' todavía no tiene personas. Agrégalas en Equipos y reparto.'}</p>`;
  return sin + gente.map(u => { const e = estadoDe(u), k = abiertas(u.id), sel = c.asig === u.nombre;
    return `<button type="button" role="option" class="pc-op" data-a="${esc(u.nombre)}" aria-selected="${sel}"><span class="av" style="background:${colorPersona(u.nombre)}">${fotoAv(u.foto, u.nombre)}</span><span class="pc-tx"><span>${esc(u.nombre)}${esLiderDe(u.id, eq) ? '<span class="pc-lid">Líder</span>' : ''}</span><small><i class="pc-st" style="background:${EST_COL[e] || '#d1d5db'}"></i>${esc(e)} · ${k} ${k === 1 ? 'abierta' : 'abiertas'}</small></span>${sel ? I('check','i ck') : ''}</button>`; }).join('') + vacio;
}
function opcionesEquipo(c, q){
  const n = norm(q), actual = c ? equipoConv(c) : '';
  const L = EQUIPOS.filter(t => !n || norm(t.n).includes(n));
  return L.map(t => `<button type="button" role="option" data-eq="${esc(t.n)}" aria-selected="${t.n === actual}"><i class="pc-sq" style="background:${colorEquipo(t.n)}"></i>${esc(t.n)}${t.n === actual ? I('check','i ck') : ''}</button>`).join('') || '<p class="muted" style="padding:8px 10px;margin:0">Ningún equipo coincide.</p>';
}
document.getElementById('panel').addEventListener('input', e => {
  const c = CONV.find(x => x.id === st.sel); if (!c) return;
  if (e.target.id === 'asig-q') document.getElementById('asig-l').innerHTML = opcionesAsesor(c, e.target.value);
  if (e.target.id === 'eq-q') document.getElementById('eq-l').innerHTML = opcionesEquipo(c, e.target.value);
});
function panel(c){
  const f = c.ficha, cv = I('chev','i cv'), eq = equipoConv(c), sil = silenciado(c);
  // Las compras salen de la plataforma (GET …/ficha-externa); mientras llega la respuesta no se afirma nada.
  const est = c.contactoId ? crmFichaExterna(c.contactoId) : null, cp = (est && est.datos && est.datos.compras) || f.compras;
  const buscando = est && !est.datos && !est.error;
  const compra = cp
    ? `<div class="pc-buy"><b>${esc(cp.p)}</b><span class="pc-fila">${esc(cp.medio || '')}<span class="pc-chip ${cp.estado === 'Al día' ? '' : 'bad'}">${esc(cp.estado)}</span></span>${cp.total ? `<span class="pc-barra"><i style="width:${Math.round(cp.pagadas / cp.total * 100)}%"></i></span><span class="pc-fila">${cp.pagadas} de ${cp.total} cuotas pagadas</span>` : ''}${cp.prox ? `<span class="pc-fila">${esc(cp.prox)}</span>` : ''}</div>`
    : buscando ? `<p class="muted">Buscando sus compras…</p>`
    : est && est.error ? `<p class="muted">No se pudieron consultar sus compras.</p>`
    : `<p class="muted">Todavía no ha comprado.</p>`;
  const esMail = String(c.tel || '').includes('@'), correo = f.correo || (esMail ? c.tel : '');
  const lineas = [
    c.tel && !esMail ? `<span class="ln">${I('phone')}<span class="pc-num">${esc(c.tel)}</span></span>` : '',
    correo ? `<span class="ln">${I('mail')}<span>${esc(correo)}</span></span>` : '',
    f.ciudad ? `<span class="ln">${I('compass')}<span>${esc(f.ciudad)}, Colombia</span></span>` : '',
    origenLinea(c, f),
  ].join('');
  const h = historial(c), recs = (c.recs || []).filter(r => !r.hecho).length;
  const pautaNombre = c.pauta ? (({Google:'Google Ads', TikTok:'TikTok Ads', Meta:'Meta Ads'})[c.pauta.plataforma] || c.pauta.plataforma || 'Pauta') : '';
  document.getElementById('panel').innerHTML = `
    <div class="ptitle">Contacto<button type="button" id="p-min" aria-label="Ocultar el panel">${I('back')}</button></div>
    <div class="contact">
      <div class="pc-who"><span class="av" style="background:${AVC[c.id % AVC.length]}">${esc(ini(c.n))}</span><span><b>${esc(c.n)}</b>${c.numero ? `<small>Ticket <strong>#${c.numero}</strong></small>` : ''}</span></div>
      <div class="pc-acts">${c.guardado ? `<button type="button" class="pc-act" aria-label="Ver contacto" title="Ver en Contactos">${I('user')}Ver</button>` : `<button type="button" class="pc-act pri" id="b-agregar" title="Agregar a contactos">${I('user-plus')}Agregar</button>`}<button type="button" class="pc-act" id="b-editar" title="Editar contacto">${I('pen')}Editar</button><button type="button" class="pc-act" id="b-transferir" title="Transferir con nota">${I('share')}Transferir</button>${c.canal === 'wa' ? `<button type="button" class="pc-act" id="b-call" title="Llamar por WhatsApp">${I('phone')}Llamar</button>` : ''}</div>
      ${lineas ? `<div class="pc-info">${lineas}</div>` : ''}
    </div>
    ${sec('acc','sliders','Conversación', `
      <div class="pc-pr"><span>Equipo</span><div class="dd" id="dd-eq"><button type="button" class="pc-ps" id="eq-b" aria-haspopup="listbox" aria-expanded="false"><i class="pc-sq" style="background:${colorEquipo(eq)}"></i><span class="t">${esc(eq)}</span>${cv}</button><div class="menu" id="eq-m" role="listbox" aria-label="Equipos" hidden></div></div></div>
      <div class="pc-pr"><span>Asesor</span><div class="dd" id="dd-asig"><button type="button" class="pc-ps" id="asig-b" aria-haspopup="listbox" aria-expanded="false">${c.asig ? `<span class="av mini" style="background:${colorPersona(c.asig)}">${fotoAv(fotoDe(c.asig), c.asig)}</span>` : '<span class="mini">–</span>'}<span class="t">${esc(c.asig || 'Sin asignar')}</span>${cv}</button><div class="menu" id="asig-m" role="listbox" aria-label="Personas del equipo" hidden></div></div></div>
      <div class="pc-pr"><span>Prioridad</span><div class="dd" id="dd-pri"><button type="button" class="pc-ps" id="pri-b" aria-haspopup="listbox" aria-expanded="false">${senal(prioridadDe(c))}<span class="t">${prioridadDe(c)}</span>${cv}</button><div class="menu" id="pri-m" role="listbox" hidden>${PRIORIDADES.map(([p]) => `<button type="button" role="option" data-pri="${p}" aria-selected="${prioridadDe(c) === p}">${senal(p)}${p}${prioridadDe(c) === p ? I('check','i ck') : ''}</button>`).join('')}</div></div></div>
      <div class="pc-pr"><span>Etapa</span><div class="dd" id="dd-etq"><button type="button" class="pc-ps" id="etq-b" aria-haspopup="listbox" aria-expanded="false"><i class="pc-dot" style="background:${COL[c.etq[0]] || '#cbd5e1'}"></i><span class="t">${esc(c.etq[0] || 'Sin etapa')}</span>${cv}</button><div class="menu" id="etq-m" role="listbox" hidden></div></div></div>
      <div class="pc-pr top"><span>Etiquetas</span><div class="tagsel">${c.tags.map(t => `<span class="tagx"><i style="background:${ETIQ_COL[t]}"></i>${esc(t)}<button type="button" data-tag-del="${esc(t)}" aria-label="Quitar ${esc(t)}">${I('x')}</button></span>`).join('')}<div class="dd" id="dd-tag"><button type="button" class="tg-add" id="tag-b">${I('plus')}Agregar</button><div class="menu tg-menu" id="tag-m" hidden><label class="tg-q">${I('search')}<input id="tag-q" placeholder="Buscar o crear etiqueta" autocomplete="off" aria-label="Buscar o crear etiqueta"></label><div id="tag-l">${listaTags(c, '')}</div></div></div></div></div>`)}
    ${c.pauta ? sec('pauta','megaphone','Anuncio de origen', `<dl class="kv">${[['Plataforma', c.pauta.plataforma], ['Campaña', c.pauta.campana], ['Conjunto', c.pauta.conjunto], ['Anuncio', c.pauta.anuncio], ['Palabra clave', c.pauta.termino], ['Formato', c.pauta.formato], ['Cómo se supo', c.pauta.como]].filter(([, v]) => v).map(([t, v]) => `<dt>${t}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`, esc(pautaNombre), true) : ''}
    ${!(f.interes || f.nota) ? '' : sec('guia','compass','Lo que busca', `<dl class="kv"><dt>Interés</dt><dd>${esc(f.interes || 'Sin dato')}</dd></dl>${f.nota ? `<p class="pc-nota">${esc(f.nota)}</p>` : ''}`, 'Formulario web', true)}
    ${sec('compra','cart','Compras', compra, cp ? '1' : buscando || (est && est.error) ? '' : 'Ninguna', true)}
    ${sec('campos','user','Datos del cliente', `<div class="frm">${CAMPOS.map(fd => fd.ops ? `<div class="fld">${esc(fd.n)}${ddSel('data-cop', opsDe(fd).map(([v, l]) => [fd.k + '::' + v, l]), fd.k + '::' + (c.campos[fd.k] || ''), fd.ph || 'Elige una opción')}</div>` : `<label>${esc(fd.n)}<input data-campo="${esc(fd.k)}" value="${esc(c.campos[fd.k] || '')}" placeholder="${fd.trengo ? 'Viene de Trengo' : 'Sin dato'}"></label>`).join('')}<div style="display:flex;justify-content:flex-end"><button type="button" class="btn" data-guardar-campos="1">${I('check')}Guardar</button></div></div>`, '', true)}
    ${sec('prev','history','Conversaciones anteriores', h.length ? `<div class="pc-hist">${h.join('')}</div>` : '<p class="muted">Es su primera conversación.</p>', h.length ? String(h.length) : 'Primera', true)}
    ${sec('rec','bell','Recordatorios de seguimiento', recHtml(c), recs ? recs + ' pendiente' + (recs > 1 ? 's' : '') : '', true)}`;
}

function render(){
  nav();
  document.getElementById('app').classList.toggle('pg', !!st.pagina);
  if (st.pagina) { pagina(); return; }
  lista(); chat();
}
function pagina(){
  const el = document.getElementById('page');
  if (st.pagina === 'contactos') {
    paginaContactos();
  } else if (st.pagina === 'informes') {
    paginaInformes(el);
  } else if (st.pagina === 'embudo') {
    // Cada equipo tiene su embudo (maqueta aprobada, tablero «Embudo de un equipo»); quien ve un solo equipo no ve el selector.
    const eqs = equiposQueVeo(); if (!eqs.includes(st.embEq)) st.embEq = eqs.includes('Ventas') ? 'Ventas' : eqs[0] || 'Ventas';
    const eq = st.embEq, COLS = etapasDe(eq).map(e => e[0]), tiene = n => COLS.includes(n);
    const vis = ultimasConv().filter(c => equipoConv(c) === eq);
    const sel = eqs.length > 1 ? `<div class="dd" id="dd-emb"><button type="button" class="emb-sel" id="emb-b" aria-haspopup="listbox" aria-expanded="false"><i style="background:${colorEquipo(eq)}"></i>${esc(eq)}${I('chev')}</button><div class="menu" id="emb-m" role="listbox" hidden>${eqs.map(n => `<button type="button" role="option" data-emb-eq="${esc(n)}" aria-selected="${n === eq}"><i class="pc-sq" style="background:${colorEquipo(n)}"></i>${esc(n)}${n === eq ? I('check','i ck') : ''}</button>`).join('')}</div></div>` : '';
    el.innerHTML = `<div class="pg-h"><div><h2>Embudo</h2><p class="sub emb-sub">Arrastra una conversación a otra columna para cambiarla de etapa.${tiene('Pagado') ? ' Pagado se marca solo cuando se confirma el pago.' : ''}</p></div><div style="display:flex;gap:8px;align-items:center;flex:none">${st.rol === 'l' ? `<button type="button" class="btn" data-ir="cfg-etapas">${I('kanban')}Etapas del embudo</button>` : ''}${sel}</div></div>
      <div class="ksum"><span><b>${vis.length}</b> en el embudo</span>${tiene('Caliente') ? `<span class="cal"><b>${vis.filter(c => c.etq[0] === 'Caliente').length}</b> calientes</span>` : ''}${tiene('Pagado') ? (() => { const pag = vis.filter(c => c.etq[0] === 'Pagado').length, t = vis.length ? Math.round(pag / vis.length * 100) : 0; return `<span class="pag"><b>${pag}</b> pagadas</span><span class="tasa"><svg viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="14" fill="none" stroke="#4a463f" stroke-width="5"/>${t ? `<circle cx="18" cy="18" r="14" fill="none" stroke="#FFD21F" stroke-width="5" stroke-dasharray="${(t * 0.88).toFixed(1)} 88" transform="rotate(-90 18 18)" stroke-linecap="round"/>` : ''}</svg>Tasa de cierre <b>${t} %</b></span>`; })() : ''}</div>
      ${COLS.length ? '' : `<p class="muted">${esc(eq)} todavía no tiene etapas. ${st.rol === 'l' ? 'Créalas en Etapas del embudo.' : 'Las crea su líder.'}</p>`}
      <div class="kb">${COLS.map(col => `<div class="kcol" data-col="${esc(col)}"><div class="kh"><span class="dot" style="background:${COL[col]}"></span>${esc(col)}<span class="n">${vis.filter(c => c.etq[0] === col).length}</span></div>
        ${vis.filter(c => c.etq[0] === col).map(c => `<div class="kc" draggable="true" data-kc="${c.id}" data-open="${c.id}" title="Abrir la conversación"><div class="t"><span class="av" style="background:${AVC[c.id % AVC.length]}">${esc(ini(c.n))}</span><b>${esc(c.n)}</b></div><p>${esc([c.ficha.interes, c.ficha.ciudad].filter(Boolean).join(' · ') || c.tel)}</p><div class="f"><span>${c.hora}${c.espera ? ' · espera ' + c.espera : ''}</span>${c.asig ? `<span class="mini av" title="${esc(c.asig)}" style="background:${colorPersona(c.asig)}">${fotoAv(fotoDe(c.asig), c.asig)}</span>` : '<span class="mini" title="Sin asignar">–</span>'}</div></div>`).join('')}
      </div>`).join('')}</div>`;
    kanban();
  } else if (st.pagina === 'difusiones') {

    if (st.dif) { difusion(); return; }
    el.innerHTML = `<div class="pg-h"><div><h2>Difusiones</h2><p class="sub">Envíos masivos por WhatsApp con plantillas aprobadas. Cada envío queda como conversación y se reparte a los asesores cuando el cliente responde.</p></div><button type="button" class="btn pri" id="b-dif">${I('plus')}Nueva difusión</button></div>
      <table class="tb2"><thead><tr><th>Difusión</th><th>Plantilla</th><th>Audiencia</th><th>Enviados</th><th>Entregados</th><th>Leídos</th><th>Respondieron</th><th>Fecha</th><th>Estado</th></tr></thead><tbody>
      ${DIFUSIONES.length ? '' : '<tr><td colspan="9" class="muted" style="padding:18px 10px">Todavía no hay difusiones. Crea la primera con «Nueva difusión».</td></tr>'}${DIFUSIONES.map(d => { const v = difVista(d), num = x => x.toLocaleString('es-CO'), pct = x => v.ent ? ' · ' + Math.round(x / v.ent * 100) + ' %' : '';
        return `<tr><td><b style="font-weight:500">${esc(d.n)}</b></td><td>${esc(d.t)}</td><td style="color:var(--ink3)">${esc(d.a)}</td><td>${v.env || v.curso ? num(v.env) + (v.curso && v.total ? ' de ' + num(v.total) : '') : '—'}${v.fal ? `<div class="muted" style="font-size:12px">${num(v.fal)} ${v.fal === 1 ? 'fallido' : 'fallidos'}</div>` : ''}</td><td>${v.ent ? num(v.ent) : '—'}</td><td>${v.le ? num(v.le) + pct(v.le) : '—'}</td><td>${v.resp ? num(v.resp) + pct(v.resp) : '—'}</td><td style="color:var(--ink3)">${esc(d.f || '—')}</td><td><span class="est ${v.est}"${v.motivo ? ` title="${esc(v.motivo)}"` : ''}>${esc(v.e)}</span></td></tr>`; }).join('')}
      </tbody></table>`;
    document.getElementById('b-dif').addEventListener('click', () => { if (st.rol !== 'l') { toast('Las difusiones las envía el líder de Ventas'); return; } st.dif = {paso:1, aud:new Set(['En seguimiento','Sin respuesta']), tpl:(TPL[0] || {}).n || '', linea:(LINEAS[0] || {}).id || null, cuando:'ahora'}; render(); });
  } else if (st.pagina === 'plantillas') {
    if (st.tplNueva) { plantillaNueva(); return; }

    el.innerHTML = `<div class="pg-h"><div><h2>Plantillas de WhatsApp</h2><p class="sub">Los mensajes que la empresa puede enviar primero. Meta las aprueba en minutos u horas; las de marketing cuestan 0,0125 USD y las de utilidad 0,0008 USD por envío en Colombia.</p></div><button type="button" class="btn pri" id="b-tpl-nueva">${I('plus')}Nueva plantilla</button></div>
      <table class="tb2"><thead><tr><th>Plantilla</th><th>Categoría</th><th>Estado</th><th>Envíos</th><th>Texto</th></tr></thead><tbody>
      ${PLANTILLAS.length ? '' : '<tr><td colspan="5" class="muted" style="padding:18px 10px">Todavía no hay plantillas. Las aprobadas en Meta aparecen aquí solas.</td></tr>'}${PLANTILLAS.map(p => `<tr><td><b style="font-weight:500">${esc(p.n)}</b></td><td>${esc(p.c)}</td><td><span class="est ${esc(p.e)}">${esc(p.x)}</span></td><td>${p.u ? p.u.toLocaleString('es-CO') : '—'}</td><td style="white-space:normal;color:var(--ink3);max-width:420px">${esc(p.b)}</td></tr>`).join('')}
      </tbody></table>`;
    document.getElementById('b-tpl-nueva').addEventListener('click', () => { st.tplNueva = {nombre:'', cat:'Marketing', head:'', body:'Hola, {{nombre}}. ', foot:ESPACIO.nombre || '', btn:'', btnTxt:''}; render(); });
  } else if (st.pagina.startsWith('cfg-')) {
    el.innerHTML = paginaCfg(st.pagina.slice(4));
  } else if (st.pagina === 'flujos') {
    el.innerHTML = paginaFlujos();
  } else if (st.pagina === 'vivo') {
    const inf = crmInformes(), atn = {};
    ((inf || {}).porAsesor || []).forEach(r => { if (r.atencion != null) atn[r.nombre || r.asesor] = r.atencion; });
    const filas = USUARIOS.map(u => {
      const a = u.nombre, mias = CONV.filter(c => c.asig === a && (c.est || 'abiertas') === 'abiertas');
      const esperan = mias.filter(c => c.espera).sort((p, q) => q.esperaMin - p.esperaMin);
      const res = CONV.filter(c => c.asig === a && c.est === 'finalizadas' && c._t && c._t.finalizada && hcDias(c._t.finalizada) === 0).length;
      return {a, est: estadoDe(u), abiertas: mias.length, sin: esperan.length, larga: esperan[0] ? esperan[0].espera : '—', largaMin: esperan[0] ? esperan[0].esperaMin : 0, res, sat: atn[a]};
    });
    const sinAsig = CONV.filter(c => !c.asig && (c.est || 'abiertas') === 'abiertas').length;
    const masLarga = filas.filter(f => f.largaMin).sort((p, q) => q.largaMin - p.largaMin)[0];
    el.innerHTML = `<div class="pg-h"><div><h2>Equipo en vivo</h2><p class="sub">Cómo va cada asesor ahora mismo. Se actualiza solo. Desde aquí se pasan conversaciones de un asesor a otro.</p></div></div>
      <div class="kpis"><div class="kpi"><span>Conectados</span><b>${filas.filter(f => f.est !== 'Desconectado').length} de ${filas.length}</b><small>${filas.filter(f => f.est === 'Ausente').length} ausente${filas.filter(f => f.est === 'Ausente').length === 1 ? '' : 's'}</small></div><div class="kpi"><span>Conversaciones abiertas</span><b>${filas.reduce((s, f) => s + f.abiertas, 0)}</b><small>${sinAsig} sin asignar</small></div><div class="kpi"><span>Esperando respuesta</span><b>${filas.reduce((s, f) => s + f.sin, 0)}</b><small>la más larga: ${esc(masLarga ? masLarga.larga : '—')}</small></div><div class="kpi"><span>Finalizadas hoy</span><b>${filas.reduce((s, f) => s + f.res, 0)}</b><small>todo el equipo</small></div></div>
      <table class="tb3 vivo"><thead><tr><th>Asesor</th><th>Estado</th><th>Abiertas</th><th>Sin responder</th><th>Espera más larga</th><th>Finalizadas hoy</th><th>Atención</th><th></th></tr></thead><tbody>
      ${filas.length ? '' : '<tr><td colspan="8" class="muted">Todavía no hay personas de Ventas en el CRM.</td></tr>'}${filas.map(f => `<tr><td>${esc(f.a)}</td><td><span class="est"><i class="est-dot" style="background:${EST_COL[f.est] || EST_COL['En línea']}"></i>${esc(f.est)}</span></td><td>${f.abiertas}</td><td style="${f.sin >= 4 ? 'color:var(--red-ink);font-weight:600' : ''}">${f.sin}</td><td>${esc(f.larga)}</td><td>${f.res}</td><td>${f.sat != null ? String(Math.round(f.sat * 10) / 10).replace('.', ',') + ' de 5' : '—'}</td><td style="text-align:right"><button type="button" class="btn" data-reasignar="${esc(f.a)}" ${f.abiertas ? '' : 'disabled'}>${I('share')}Pasar sus conversaciones</button></td></tr>`).join('')}
      </tbody></table>`;
  } else if (st.pagina === 'reglas') {
    const n = st.reglaNueva;
    el.innerHTML = `<div class="ajw"><div class="pg-h"><div><h2>Reglas automáticas</h2><p class="sub">Si pasa esto, el CRM hace esto otro. Solo los líderes las ven y las cambian.</p></div>${n ? '' : `<button type="button" class="btn pri" id="r-nueva">${I('plus')}Nueva regla</button>`}</div>
      ${n ? `<div class="rule" style="gap:14px"><div class="frm"><label>Nombre<input id="r-n" value="${esc(n.n)}" placeholder="Ej. Avisar al líder si un pago falla"></label>
        <div class="fld">Cuando${ddSel('data-r-cuando', R_CUANDO, n.cuando)}</div>
        <div class="fld">Si se cumple, opcional${armadorRegla('si', n)}</div>
        <div class="fld">Entonces${armadorRegla('ent', n)}</div>
        <div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn" id="r-cancel">Cancelar</button><button type="button" class="btn pri" id="r-ok">${I('check')}Guardar y activar</button></div></div></div>` : ''}
      <div style="display:grid;gap:10px;margin-top:14px">${REGLAS.map((r, i) => `<div class="rule"><div class="rh">${I('flow')}<b>${esc(r.n)}</b>${r.origen ? `<span class="pill">${esc(r.origen)}</span>` : ''}<button type="button" class="tg" role="switch" data-r-on="${i}" aria-checked="${r.on}" aria-label="Activar ${esc(r.n)}"></button><button type="button" class="btn ic" data-r-del="${i}" aria-label="Borrar regla">${I('x')}</button></div>
        <div class="rs"><span class="k">Cuando</span><span class="v">${esc(r.cuando)}</span>${r.si.length ? `<span class="k">Si</span>${r.si.map(x => `<span class="v">${esc(x)}</span>`).join('')}` : ''}<span class="k">Entonces</span>${r.ent.map(x => `<span class="v">${esc(x)}</span>`).join('')}</div></div>`).join('')}</div></div>`;
  } else if (st.pagina === 'etiquetas') {
    el.innerHTML = paginaEtiquetas();
  } else if (st.pagina === 'campos') {
    el.innerHTML = `<div class="ajw"><h2>Campos personalizados</h2><p class="sub">Los datos que se llenan en la ficha de cada cliente. El número de cliente lo pone el CRM solo, a cada cliente que llega: es único y nunca se repite.</p>
      <table class="tb3"><thead><tr><th>Campo</th><th>Tipo</th><th></th></tr></thead><tbody><tr><td>Número de cliente <span class="pill">Automático</span></td><td>Número</td><td></td></tr>${CAMPOS.map((f, i) => `<tr><td>${esc(f.n)}</td><td>${esc(f.t)}</td><td style="text-align:right"><button type="button" class="btn ic" data-campo-del="${i}" aria-label="Borrar campo">${I('x')}</button></td></tr>`).join('')}</tbody></table>
      <div class="frm" style="margin-top:14px;grid-template-columns:1fr auto auto;align-items:end;display:grid;gap:10px"><label>Campo nuevo<input id="cf-n" placeholder="Ej. Fecha de cumpleaños"></label><div class="fld">Tipo${ddSel('data-cf-t', ['Texto','Número','Fecha','Lista'], st.cfT || 'Texto')}</div><button type="button" class="btn pri" id="cf-add">${I('plus')}Agregar</button></div></div>`;
  } else if (st.pagina === 'importar') {
    const im = st.imp || {fase:'lista'};
    el.innerHTML = `<div class="ajw"><h2>Importar contactos</h2><p class="sub">Sube el archivo de contactos exportado del CRM que usabas antes (Trengo, HubSpot u otro), en Excel o CSV. Cada contacto llega con su etapa, etiquetas y asesor; si el número ya existe, se actualiza en vez de duplicarse.</p>
      <div class="rule" style="gap:12px">${im.res ? `<dl class="kv"><dt>Contactos nuevos</dt><dd>${im.res.nuevos.toLocaleString('es-CO')}</dd><dt>Contactos actualizados</dt><dd>${im.res.actualizados.toLocaleString('es-CO')}</dd><dt>Filas con errores</dt><dd>${(im.res.errores || []).length}</dd></dl>` : ''}
      ${im.fase === 'listo' ? '<div class="prog2"><i style="width:100%"></i></div>' : ''}<p class="muted" style="margin:0">${im.fase === 'lista' ? (im.error ? esc(im.error) : 'Se importa sin tocar Trengo: allá todo sigue igual hasta que se apague.') : im.fase === 'corriendo' ? `Importando ${esc(im.archivo || 'el archivo')}…` : `Listo: ${esc(im.archivo || 'el archivo')} quedó en Contactos.`}</p>
      ${im.res && (im.res.errores || []).length ? `<div class="hist">${im.res.errores.slice(0, 8).map(x => `<div><span>Fila ${x.fila}</span><span>${esc(x.motivo)}</span></div>`).join('')}</div>` : ''}
      <div style="display:flex;justify-content:flex-end"><button type="button" class="btn pri" id="imp-go" ${im.fase === 'corriendo' ? 'disabled' : ''}>${I('file')}${im.fase === 'corriendo' ? 'Importando…' : im.fase === 'listo' ? 'Importar otro archivo' : 'Elegir el archivo'}</button></div></div></div>`;
  } else if (st.pagina === 'ajustes') {
    // La asesora solo ve sus ajustes personales. El líder ve además la configuración del CRM.
    const lider = st.rol === 'l';
    const tab = lider ? st.ajTab : 'cuenta';
    const crmGrupos = [
      ['Canales e integraciones', [
        ['chat','Canales','WhatsApp, Instagram, Messenger, TikTok, correo y chat de la web: conectar y administrar','cfg-canales'],
        ['phone','Llamadas','Canales de llamadas, grabaciones y horario para llamar','cfg-llamadas'],
        ['plug','Integraciones',integResumen(),'cfg-integraciones']]],
      ['Conversaciones', [
        ['check','Conversaciones','Finalizar solas por inactividad, motivos y resumen al finalizar','cfg-conversaciones'],
        ['users','Equipos y reparto','Quién recibe cada conversación y con qué tope','cfg-reparto'],
        ['kanban','Etapas del embudo',`${ETQ.length} etapas`,'cfg-etapas'],
        ['tag','Etiquetas',`${ETIQS.length} etiquetas, además de la etapa`,'etiquetas'],
        ['user','Campos personalizados',`${CAMPOS.length} campos en la ficha del cliente`,'campos'],
        ['clock','Horario de atención',horarioTxt(),'cfg-horario']]],
      ['Mensajes', [
        ['bolt','Respuestas rápidas del equipo',`${QR.length} ${QR.length === 1 ? 'respuesta' : 'respuestas'} para todo el equipo`,'cfg-qr'],
        ['template','Plantillas de WhatsApp',`${PLANTILLAS.filter(p => p.e === 'ok').length} aprobadas por Meta`,'plantillas'],
        ['star','Encuesta al finalizar','Atención del asesor y recomendación de 0 a 10','cfg-encuesta'],
        ['moon','Atención de noche','El agente IA responde de 10 p. m. a 7 a. m. y deja resumen','cfg-recepcion']]],
      ['Automatización y datos', [
        ['flow','Flujos',`${FLUJOS.filter(f => f.on).length} activo · lo que pasa antes de que el lead llegue al asesor`,'flujos'],
        ['folder','Carpetas','Atajos de la barra: crea las tuyas y esconde las que no usas','cfg-carpetas'],
        ['flow','Reglas automáticas',`${REGLAS.filter(r => r.on).length} activas · «si pasa esto, haz esto»`,'reglas'],
        ['ad','Enlaces de pauta','De qué anuncio llega cada persona: Google, TikTok, Meta y tu página','cfg-pauta'],
        ['lock','Protección de datos','Autorizaciones, menores, horario legal y números excluidos','cfg-datos'],
        ['folder','Archivos','Material para enviar en mensajes, difusiones y flujos','cfg-archivos']]],
      ['Cuenta', [
        ['card','Plan y pagos','Tu plan del CRM, el historial de pagos y los recibos','cfg-plan'],
        ['users','Espacios de trabajo','Las empresas de tu cuenta, cada una con su CRM aparte','cfg-espacios']]],
    ];
    const tg = (k, t, d) => `<div class="tgr"><span>${t}${d ? `<small>${d}</small>` : ''}</span><button type="button" class="tg" role="switch" data-aj-tg="${k}" aria-checked="${!!AJ[k]}" aria-label="${esc(t)}"></button></div>`;
    const SECS = []; const ac = (id, ic, t, d, body) => { SECS.push({id, ic, t, d, body}); return ''; };
    const cuenta = `<div class="acs">
      ${ac('perfil','user','Mi perfil', `${esc(AJ.nombre)} · ${esc(AJ.correo)}`, `
        ${perfilFotoHtml()}
        <div class="two2"><label class="fl">Nombre completo<input id="aj-nombre" value="${esc(st.pfBorrador ? st.pfBorrador.nombre : AJ.nombre)}"></label><label class="fl">Cómo te ven los clientes<input id="aj-corto" value="${esc(st.pfBorrador ? st.pfBorrador.corto : AJ.corto)}"></label></div>
        <div class="fl">Correo<span style="font-size:14px;color:var(--ink);font-weight:400">${esc(AJ.correo || 'Sin correo')}</span></div>
        <p class="hint">Entras a la plataforma con tu cuenta de Google; el correo y la contraseña se manejan allá.</p>
        <div class="ft2"><button type="button" class="btn pri" data-aj="guardar-perfil">${I('check')}Guardar</button></div>`)}
      ${ac('disp','clock','Mi disponibilidad', `${AJ.estado}${AJ.reparto ? ' · recibes conversaciones nuevas' : ' · no recibes conversaciones nuevas'}`, `
        <div class="fl">Estado${ddSel('data-aj-est', ['En línea','Ocupada','Ausente'], AJ.estado)}</div>
        ${tg('reparto', 'Recibir conversaciones nuevas del reparto automático', 'Apágalo si estás en reunión o terminando tu turno.')}
        <p class="hint">Tu tope es de ${esc(String(CFG.reparto.tope))} conversaciones abiertas, lo define tu líder. Si te marcas como ausente, las conversaciones nuevas pasan al siguiente asesor disponible.</p>`)}
      ${ac('firma','pen','Firma en los mensajes', AJ.firma ? 'Tus mensajes terminan con tu nombre' : 'Sin firma', `
        ${tg('firma', 'Agregar mi nombre al final de cada mensaje', '')}
        <div class="prev"><div class="b">Así se ve el final de tus mensajes.${AJ.firma ? `<br><br><i>${esc(AJ.corto)}${ESPACIO.nombre ? ' · ' + esc(ESPACIO.nombre) : ''}</i>` : ''}</div></div>`)}
      ${ac('qr','bolt','Mis respuestas rápidas', `${AJ.qr.length} tuyas · las del equipo las administra tu líder`, `
        ${qrMisAjustes()}
        <p class="hint">Se usan escribiendo / en el chat, junto con las ${QR.length} del equipo.</p>`)}
      ${ac('notif','bell-off','Notificaciones', (l => l.length ? (l.length > 1 ? l.slice(0, -1).join(', ') + ' y ' + l[l.length - 1] : l[0]).replace(/^./, c => c.toUpperCase()) : 'Todas apagadas')([AJ.sonido && 'sonido', AJ.navegador && 'aviso del navegador', AJ.resumen && 'resumen diario'].filter(Boolean)), `
        ${tg('sonido', 'Sonido cuando llega un mensaje', '')}
        ${tg('navegador', 'Aviso del navegador', 'Aunque tengas la pestaña del CRM en segundo plano.')}
        ${tg('asignada', 'Cuando me asignan una conversación', '')}
        ${tg('mencion', 'Cuando me mencionan en una nota privada', '')}
        ${tg('resumen', 'Resumen diario de pendientes a las 7 a. m.', 'Las conversaciones que esperan tu respuesta.')}`)}
      ${ac('enl','link','Mis enlaces de pago', `${totalEnlaces()} enlaces en ${CATALOGO.length} productos${FALTANTES.length ? ` · te ${FALTANTES.length === 1 ? 'falta' : 'faltan'} ${FALTANTES.length}` : ''}`, `
        <p class="hint" style="font-size:13px;color:var(--ink2)">Son los que usas con el botón de enlace del chat, así la venta queda a tu nombre.${FALTANTES.length ? ` Te ${FALTANTES.length === 1 ? 'falta' : 'faltan'}: <b>${FALTANTES.map(esc).join(', ')}</b>.` : ''}</p>
`)}
      ${ac('atajos','chat','Atajos de teclado', 'Para responder más rápido', `
        <div class="keys"><span><kbd>/</kbd></span><span>Respuestas rápidas</span><span><kbd>Ctrl</kbd> + <kbd>Enter</kbd></span><span>Enviar el mensaje</span><span><kbd>Alt</kbd> + <kbd>N</kbd></span><span>Cambiar entre respuesta y nota privada</span>${yoVendo() ? '<span><kbd>Alt</kbd> + <kbd>E</kbd></span><span>Abrir mis enlaces de pago</span>' : ''}<span><kbd>Alt</kbd> + <kbd>R</kbd></span><span>Finalizar la conversación</span></div>`)}
    </div>`;
    const GRUPOS_CUENTA = [['Mi cuenta', ['perfil','disp']], ['Cómo trabajo', ['firma','qr', ...(yoVendo() && CATALOGO.length ? ['enl'] : [])]], ['Avisos y atajos', ['notif','atajos']]];
    const abierta = tab === 'cuenta' ? SECS.find(x => x.id === st.ajSec) : null;
    // Una sección abierta se ve como las demás subpáginas: «‹ Mis ajustes» arriba, su título y su contenido.
    if (abierta) { el.innerHTML = `<div class="ajw ancho"><button type="button" class="volver" data-aj-ver="">${I('back')}Mis ajustes</button><h2>${abierta.t}</h2><p class="sub">${abierta.d}</p><div class="box2" style="max-width:760px"><div class="acb" style="padding:4px 0 0">${abierta.body}</div></div></div>`; return; }
    const cuentaHtml = `<div class="ajg">${GRUPOS_CUENTA.map(([g, ids]) => `<section><h4>${g}</h4><div class="grid3">${ids.map(id => SECS.find(x => x.id === id)).map(x => `<button type="button" data-aj-ver="${x.id}">${I(x.ic)}<span><b>${x.t}</b><small>${x.d}</small></span></button>`).join('')}</div></section>`).join('')}</div>`;
    el.innerHTML = `<div class="ajw ancho"><h2>${tab === 'crm' ? 'Ajustes del CRM' : 'Mis ajustes'}</h2><p class="sub">${tab === 'crm' ? 'Configuración del CRM para todo el equipo. Solo los líderes la ven y la cambian.' : 'Tu perfil, tu disponibilidad y cómo te avisa el CRM. Solo te afectan a ti.'}</p>
      ${lider ? `<div class="seg ajt" role="group" aria-label="Ajustes"><button type="button" data-aj-tab="cuenta" aria-pressed="${tab === 'cuenta'}">Mi cuenta</button><button type="button" data-aj-tab="crm" aria-pressed="${tab === 'crm'}">CRM del equipo</button></div>` : ''}
      ${tab === 'crm' ? `<div class="ajg">${crmGrupos.map(([g, items]) => `<section><h4>${g}</h4><div class="grid3">${items.map(([ic, t, d, k]) => `<button type="button" data-ir="${k}">${I(ic)}<span><b>${t}</b><small>${d}</small></span></button>`).join('')}</div></section>`).join('')}</div>` : cuentaHtml}</div>`;
  }
}

/* eventos */
function irA(k){
  st.pagina = ''; st.menciones = false; st.dif = null; st.tplNueva = null;
  if (['inbox','todas','sin','menciones'].includes(k)) { st.carpeta = st.equipo = st.etq = st.linea = st.canal = st.tag = ''; }
  if (k === 'inbox') st.vista = 'mias';
  else if (k === 'todas') st.vista = 'todas';
  else if (k === 'sin') st.vista = 'sin';
  else if (k === 'menciones') { st.vista = 'todas'; st.menciones = true; try { localStorage.setItem('crm-menciones-visto', String(Date.now())); } catch { /* sin almacenamiento */ } crmMenciones(); }
  else st.pagina = k;
  render();
}
document.getElementById('principal').addEventListener('click', e => { const b = e.target.closest('[data-nav]'); if (!b) return; if (b.dataset.nav === 'todas') st.convAbierto = !st.convAbierto; irA(b.dataset.nav); });
document.getElementById('b-ajustes').addEventListener('click', () => { st.ajSec = null; irA('ajustes'); });
// Carpetas, equipos, líneas y etapas filtran la bandeja: si hay una página abierta
// (Embudo, Informes…) se cierra para que se vea el resultado, y la lista pasa a
// «Todas» para que coincida con el número que muestra la barra.
function filtrar(campo, valor){
  st[campo] = st[campo] === valor ? '' : valor;
  st.pagina = ''; st.menciones = false; st.dif = null; st.tplNueva = null;
  if (st[campo]) st.vista = 'todas';
  const primera = visibles()[0]; if (primera) st.sel = primera.id;
  render();
  document.getElementById('app').classList.remove('open');
}
document.getElementById('carpetas').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) filtrar('carpeta', b.dataset.k); });
document.getElementById('equipos').addEventListener('click', e => { const b = e.target.closest('[data-t2]'); if (b) filtrar('equipo', b.dataset.t2); });
document.getElementById('lineas').addEventListener('click', e => { const b = e.target.closest('[data-l]'); if (b) filtrar('linea', b.dataset.l); });
document.getElementById('etiquetas').addEventListener('click', e => { const b = e.target.closest('[data-e]'); if (b) filtrar('etq', b.dataset.e); });
document.querySelector('.list').addEventListener('click', e => {
  const q = e.target.closest('[data-quitar]');
  if (q) { const t = q.dataset.quitar; if (t === 'todo') { st.carpeta = st.equipo = st.etq = st.linea = st.canal = st.tag = ''; } else st[{carpeta:'carpeta', equipo:'equipo', etq:'etq', linea:'linea', canal:'canal', tag:'tag'}[t]] = ''; render(); return; }
  if (e.target.closest('[data-ver-todas]')) { st.vista = 'todas'; render(); }
});
document.getElementById('tabs').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; st.vista = b.dataset.v; render(); });
document.getElementById('items').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (!b) return; if (st.sel !== +b.dataset.c) { quitarAdjunto(); document.getElementById('lk').hidden = true; } st.sel = +b.dataset.c; document.getElementById('app').classList.add('open'); render(); });
document.getElementById('q').addEventListener('input', e => { st.q = e.target.value; document.getElementById('q-x').hidden = !st.q; lista(); });
document.getElementById('q-x').addEventListener('click', () => { const i = document.getElementById('q'); i.value = st.q = ''; document.getElementById('q-x').hidden = true; lista(); i.focus(); });
document.getElementById('q').addEventListener('keydown', e => { if (e.key === 'Escape' && st.q) { e.target.value = st.q = ''; document.getElementById('q-x').hidden = true; lista(); } });
document.getElementById('b-filtro').addEventListener('click', e => { e.stopPropagation(); const m = document.getElementById('m-filtro'); m.innerHTML = `<div class="hd">Filtrar por etapa</div>` + [['','Todas']].concat(etapasQueVeo().map(([n]) => [n,n])).map(([k,n]) => `<button type="button" data-fe="${esc(k)}" aria-selected="${st.etq === k}">${k ? `<span class="dot" style="background:${COL[k]}"></span>` : I('check')}${esc(n)}</button>`).join(''); m.hidden = !m.hidden; });
document.getElementById('m-filtro').addEventListener('click', e => { const b = e.target.closest('[data-fe]'); if (!b) return; st.etq = b.dataset.fe; if (st.etq) st.vista = 'todas'; document.getElementById('m-filtro').hidden = true; render(); });
document.getElementById('b-orden').addEventListener('click', e => { e.stopPropagation(); const m = document.getElementById('m-orden'); m.innerHTML = `<div class="hd">Ordenar por</div>` + [['reciente','Más reciente'],['antiguo','Más antigua'],['espera','Más tiempo esperando']].map(([k,n]) => `<button type="button" data-or="${k}" aria-selected="${st.orden === k}">${n}</button>`).join(''); m.hidden = !m.hidden; });
document.getElementById('m-orden').addEventListener('click', e => { const b = e.target.closest('[data-or]'); if (!b) return; st.orden = b.dataset.or; document.getElementById('m-orden').hidden = true; lista(); });
document.getElementById('page').addEventListener('click', e => {
  const t = e.target;
  const tab = t.closest('[data-aj-tab]'); if (tab) { st.ajTab = tab.dataset.ajTab; render(); return; }
  const ver = t.closest('[data-aj-ver]'); if (ver) { st.ajSec = ver.dataset.ajVer || null; render(); return; }
  const sec = t.closest('[data-aj-sec]'); if (sec) { AJ.abierto = AJ.abierto === sec.dataset.ajSec ? '' : sec.dataset.ajSec; render(); return; }
  const tgl = t.closest('[data-aj-tg]'); if (tgl) { const k = tgl.dataset.ajTg; AJ[k] = !AJ[k]; render(); toast(`${tgl.getAttribute('aria-label')}: ${AJ[k] ? 'activado' : 'apagado'}`); return; }
  const est = t.closest('[data-aj-est]'); if (est) { ponerEstado(est.dataset.ajEst); return; }
  const del = t.closest('[data-aj-qr-del]'); if (del) { const q = AJ.qr.splice(+del.dataset.ajQrDel, 1)[0]; render(); toast(`Borrada /${q.t}`); return; }
  const a = t.closest('[data-aj]'); if (a) {
    const k = a.dataset.aj;
    if (k === 'guardar-perfil') {
      if (crmSoloLectura()) { toast(crmErrorSoloLectura().message); return; }
      const nombre = document.getElementById('aj-nombre').value.trim() || AJ.nombre; AJ.corto = document.getElementById('aj-corto').value.trim() || AJ.corto;
      const listo = () => { st.pfBorrador = null; pintarYo(); render(); toast('Perfil guardado'); };
      if (nombre !== AJ.nombre) crmCambiarNombre(nombre).then(listo, err => toast(err.message)); else listo();
    }
    else if (k === 'qr-nueva') { AJ.nuevaQr = true; render(); document.getElementById('aj-qr-t').focus(); }
    else if (k === 'qr-cancel') { AJ.nuevaQr = false; render(); }
    else if (k === 'qr-add') { const at = document.getElementById('aj-qr-t').value.trim().replace(/^\//, '').replace(/\s+/g, '-'), tx = document.getElementById('aj-qr-x').value.trim(); if (!at || !tx) { toast('Escribe el atajo y el texto'); return; } AJ.qr.push({t:at, x:tx}); AJ.nuevaQr = false; render(); toast(`Agregada /${at}`); }
    return;
  }
  const r = e.target.closest('[data-open]'); if (r) { st.sel = +r.dataset.open; st.vista = 'todas'; st.pagina = ''; st.carpeta = st.equipo = st.etq = st.linea = st.q = ''; st.menciones = false; st.est = 'abiertas'; document.getElementById('q').value = ''; render(); return; } });
document.querySelector('.subtabs').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; document.querySelectorAll('.subtabs button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); document.getElementById('app').classList.toggle('verficha', b.textContent === 'Ficha del cliente'); if (b.textContent === 'Ficha del cliente') pintarFicha(); return; document.querySelectorAll('.subtabs button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); toast(b.textContent === 'Mensajes' ? 'Mensajes' : 'Ficha completa del cliente'); });
document.getElementById('back').addEventListener('click', () => document.getElementById('app').classList.remove('open'));

function toast(t){ const el = document.getElementById('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 1900); }

/* panel: secciones, asignar, etapa, enlaces */
document.getElementById('panel').addEventListener('click', e => {
  const s = e.target.closest('[data-sec]'); if (s) { const el = s.closest('.sec'), cerrar = !el.hasAttribute('data-closed'); cerrar ? el.setAttribute('data-closed','') : el.removeAttribute('data-closed'); s.setAttribute('aria-expanded', String(!cerrar)); SEC_CERRADA[s.dataset.sec] = cerrar; return; }
  const c = CONV.find(x => x.id === st.sel);
  if (e.target.closest('#asig-b')) { e.stopPropagation(); if (abrirMenuPanel('asig')) { const eq = equipoConv(c); document.getElementById('asig-m').innerHTML = `<div class="pc-mh"><i class="pc-sq" style="background:${colorEquipo(eq)}"></i>Personas de ${esc(eq)}</div><label class="pc-mq">${I('search')}<input id="asig-q" placeholder="Buscar persona" autocomplete="off" aria-label="Buscar persona"></label><div class="pc-ml" id="asig-l">${opcionesAsesor(c, '')}</div>`; document.getElementById('asig-q').focus(); } return; }
  const a = e.target.closest('[data-a]'); if (a) { const nuevo = a.dataset.a || null; cerrarMenusPanel(); if (nuevo === (c.asig || null)) return; c.asig = nuevo; c.msgs.push({ev:'swap', t: nuevo ? `Asignada a ${nuevo} · ahora` : 'Quedó sin asignar · ahora'}); render(); toast(nuevo ? `Asignada a ${nuevo}` : 'Quedó sin asignar'); return; }
  if (e.target.closest('#etq-b')) { e.stopPropagation(); if (abrirMenuPanel('etq')) document.getElementById('etq-m').innerHTML = etapasDe(equipoConv(c)).map(([n,col]) => `<button type="button" role="option" data-t="${esc(n)}" aria-selected="${c.etq.includes(n)}"><span class="pc-dot" style="background:${colorOk(col)}"></span>${esc(n)}${c.etq.includes(n) ? I('check','i ck') : ''}</button>`).join(''); return; }
  const t = e.target.closest('[data-t]'); if (t) { c.etq = [t.dataset.t]; render(); toast(`Etapa: ${t.dataset.t}`); return; }
  const rn = e.target.closest('[data-rec-nuevo]'); if (rn) { st.recNuevo.abierto = true; panel(c); document.getElementById('rec-t').focus(); return; }
  const rc = e.target.closest('[data-rec-cuando]'); if (rc) { st.recNuevo.texto = document.getElementById('rec-t').value; st.recNuevo.cuando = rc.dataset.recCuando; panel(c); return; }
  const rdia = e.target.closest('[data-rec-dia]'); if (rdia) { st.recNuevo.texto = document.getElementById('rec-t').value; st.recNuevo.dia = rdia.dataset.recDia; panel(c); return; }
  const rhora = e.target.closest('[data-rec-hora]'); if (rhora) { st.recNuevo.texto = document.getElementById('rec-t').value; st.recNuevo.hora = rhora.dataset.recHora; panel(c); return; }
  if (e.target.closest('[data-rec-cancel]')) { st.recNuevo.abierto = false; panel(c); return; }
  const agregarRec = (t, para) => { const cuando = hcCuando(para); c.recs = [...(c.recs || []), {t, cuando, fecha: para.toISOString(), hecho:false, por: yo}]; c.msgs.push({ev:'bell', t:`${yo} programó un recordatorio: ${t} · ${cuando}`}); st.recNuevo = null; render(); toast(`Recordatorio para ${cuando.split(',')[0].toLowerCase().replace(/\.$/, '')}. Ese día la conversación sale de primera en tu bandeja.`); };
  if (e.target.closest('[data-rec-add]')) {
    const t = document.getElementById('rec-t').value.trim(); if (!t) { toast('Escribe qué hay que hacer'); document.getElementById('rec-t').focus(); return; }
    const n = st.recNuevo; let para;
    if (n.cuando === 'otra') { if (!n.dia || !n.hora) { n.texto = t; toast('Elige el día y la hora'); return; } para = hcDeOpciones(n.dia, n.hora); } else para = recFecha(n.cuando);
    if (!para || para.getTime() <= Date.now()) { n.texto = t; toast('Esa hora ya pasó. Elige una más adelante.'); return; }
    agregarRec(t, para); return;
  }
  if (e.target.closest('[data-rec-sug]')) { const sg = sugerenciaRec(c); if (sg) agregarRec(/pag/i.test(sg.frase) ? 'Confirmar el pago' : 'Retomar la conversación', new Date(sg.para)); return; }
  const rd = e.target.closest('[data-rec-done]'); if (rd) { const r = c.recs[+rd.dataset.recDone]; if (!r) return; r.hecho = !r.hecho; render(); toast(r.hecho ? 'Recordatorio hecho' : 'Recordatorio pendiente otra vez'); return; }
  const rx = e.target.closest('[data-rec-del]'); if (rx) { c.recs.splice(+rx.dataset.recDel, 1); render(); toast('Recordatorio borrado'); return; }
  const pk = e.target.closest('[data-pick]'); if (pk) { const [pi, mi] = pk.dataset.pick.split('-').map(Number); elegirEnlace(pi, mi); return; }
  if (e.target.closest('[data-ver-enlaces]')) { e.stopPropagation(); abrirEnlaces(''); return; }
  if (e.target.closest('#pri-b')) { e.stopPropagation(); abrirMenuPanel('pri'); return; }
  const pr = e.target.closest('[data-pri]'); if (pr) { c.prioridad = pr.dataset.pri; render(); toast(`Prioridad: ${c.prioridad.toLowerCase()}`); return; }
  const ic = e.target.closest('.contact .pc-act'); if (ic && (ic.id === 'b-agregar' || ic.id === 'b-call')) return;
  if (ic && ic.id === 'b-editar') {
    abrirDialogo(`<h3>Editar contacto</h3><div class="frm"><label>Nombre<input id="ed-n" value="${esc(c.n)}"></label><label>Correo<input id="ed-c" type="email" value="${esc(c.ficha.correo || '')}" placeholder="correo@ejemplo.com"></label><label>Ciudad<input id="ed-ci" value="${esc(c.ficha.ciudad || '')}"></label></div>
      <div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" id="ed-ok">${I('check')}Guardar</button></div>`);
    setTimeout(() => document.getElementById('ed-n').focus(), 30); return;
  }
  // Transferir va en la tarjeta (6-oct); Silenciar pasó al menú «⋯» de la conversación.
  if (ic && ic.id === 'b-transferir') { st.tr = {a:'', nota:''}; dlgTransferir(); return; }
  if (ic && ic.id === 'b-silenciar') { const k = c.contactoId || c.id, ya = silenciado(c); AJ.silenciados = ya ? (AJ.silenciados || []).filter(x => x !== k) : [...(AJ.silenciados || []), k]; panel(c); toast(ya ? `Vuelven a sonar los mensajes de ${c.n}` : `Silenciaste a ${c.n}: sus mensajes no suenan ni avisan`); return; }
  if (ic) { if (ic.getAttribute('aria-label') === 'Ver contacto') irA('contactos'); return; }
});
document.getElementById('ov-x').addEventListener('click', e => {
  if (!e.target.closest('#ed-ok')) return;
  const c = CONV.find(x => x.id === st.sel); if (!c) return;
  const n = document.getElementById('ed-n').value.trim(), correo = document.getElementById('ed-c').value.trim(), ciudad = document.getElementById('ed-ci').value.trim();
  if (!n) { toast('Escribe el nombre'); document.getElementById('ed-n').focus(); return; }
  if (correo && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(correo)) { toast('Ese correo no es válido'); document.getElementById('ed-c').focus(); return; }
  c.n = n; c.ficha = {...c.ficha, correo, ciudad}; cerrarDialogo(); render(); toast('Contacto guardado');
});
document.addEventListener('click', e => {
  if (!e.target.closest('#b-filtro')) document.getElementById('m-filtro').hidden = true;
  if (!e.target.closest('#b-orden')) document.getElementById('m-orden').hidden = true;
  for (const k of MENUS_PANEL) if (!e.target.closest('#dd-' + k)) cerrarMenusPanel(k);
  if (!e.target.closest('#qr') && !e.target.closest('#b-qr') && e.target.id !== 'ta') document.getElementById('qr').hidden = true;
});

/* compositor */
const setModo = m => { st.modo = m; document.getElementById('m-r').setAttribute('aria-pressed', String(m === 'r')); document.getElementById('m-n').setAttribute('aria-pressed', String(m === 'n')); document.getElementById('box').classList.toggle('nt', m === 'n'); document.getElementById('enviar').innerHTML = I(m === 'n' ? 'note' : 'send') + (m === 'n' ? 'Guardar nota' : 'Enviar'); };
document.getElementById('m-r').addEventListener('click', () => setModo('r'));
document.getElementById('m-n').addEventListener('click', () => setModo('n'));
const qr = document.getElementById('qr'), ta = document.getElementById('ta');
function abrirQR(f){
  f = (f || '').toLowerCase();
  const T = [...(AJ.qr || []), ...QR];
  const L = T.filter(q => !f || q.t.toLowerCase().includes(f) || q.x.toLowerCase().includes(f));
  qr.innerHTML = `<div class="hd">Respuestas rápidas</div>` + (L.length ? L.map((q,i) => `<button type="button" data-qr="${T.indexOf(q)}" class="${i === 0 ? 'sel' : ''}"><b>/${esc(q.t)}</b><span>${esc(q.x)}</span></button>`).join('') : `<p class="muted" style="padding:8px">${T.length ? 'Nada coincide.' : 'Todavía no hay respuestas rápidas. Crea las tuyas en Mis ajustes; las del equipo las crea el líder.'}</p>`);
  qr.hidden = false;
}
document.getElementById('b-qr').addEventListener('click', e => { e.stopPropagation(); qr.hidden ? abrirQR('') : (qr.hidden = true); });
ta.addEventListener('input', () => { const m = ta.value.match(/(?:^|\s)\/([^\s]*)$/); if (m) abrirQR(m[1]); else qr.hidden = true; });
qr.addEventListener('click', e => { const b = e.target.closest('[data-qr]'); if (!b) return; ta.value = ta.value.replace(/(?:^|\s)\/[^\s]*$/, '') + [...(AJ.qr || []), ...QR][+b.dataset.qr].x; qr.hidden = true; ta.focus(); });
// Firma de Mi cuenta: el nombre corto en cursiva de WhatsApp al final de lo que se le envía al cliente.
const conFirma = t => AJ.firma ? `${t}\n\n_${AJ.corto || yo}${ESPACIO.nombre ? ' · ' + ESPACIO.nombre : ''}_` : t;
document.getElementById('enviar').addEventListener('click', () => {
  const t0 = ta.value.trim(); if (!t0) { ta.focus(); toast(st.modo === 'n' ? 'Escribe la nota antes de guardarla' : 'Escribe el mensaje antes de enviarlo'); return; }
  const t = st.modo === 'n' ? t0 : conFirma(t0);
  const c = CONV.find(x => x.id === st.sel); if (!c) return;
  if (st.modo !== 'n' && /cerrada/i.test(c.ventana) && sinPlantillas(c)) { toast(cerradaTxt(c)); return; }
  // Responder es lo que la marca como leída (el API manda las palomitas azules a WhatsApp).
  if (st.modo !== 'n') c.unread = 0;
  if (st.modo !== 'n' && /cerrada/i.test(c.ventana) && !st.tplUsada && !(st.adj && hayTpl('Enlace de pago'))) {
    toast(st.adj ? 'La ventana de 24 h está cerrada y falta la plantilla «Enlace de pago» aprobada por Meta. Créala en Plantillas.' : 'La ventana de 24 h está cerrada: retoma con una plantilla aprobada');
    return;
  }
  if (st.adj && st.modo !== 'n') {
    const cerr = /cerrada/i.test(c.ventana);
    c.msgs.push({out:t, link:st.adj, by:yo, h:'ahora', plantilla: cerr ? 'Enlace de pago' : null});
    if (!c.etq.includes('Pagado')) c.etq = ['Caliente'];
    const pn = st.adj.p; quitarAdjunto(); ta.value = ''; render();
    toast(cerr ? 'Sale con la plantilla «Enlace de pago». La venta queda a tu nombre.' : `Enlace de ${pn} en camino. La venta queda a tu nombre.`);
    return;
  }
  c.msgs.push(st.modo === 'n' ? {note:t, by:yo, h:'ahora'} : {out:t, by:yo, h:'ahora', ...(st.tplUsada ? {plantilla: st.tplUsada, vars: st.tplVars || {}} : {})});
  if (st.modo !== 'n') st.tplUsada = st.tplVars = null;
  ta.value = ''; chat(); lista();
});
/* ── Enlaces de pago: cómo se elige cuál mandar ──
   El botón no manda nada solo: abre el selector con el buscador. Arriba va lo
   sugerido para esta conversación, deducido del producto que pidió (mensajes,
   anuncio de origen) y de la forma de pago que mencionó (tarjeta, contado). Todos son los enlaces de la asesora del módulo Enlaces,
   así la venta queda a su nombre. */
const precio = n => n == null || n === '' ? 'Sin precio' : '$' + Number(n).toLocaleString('es-CO');
const etiquetaPago = x => x.m + (x.d ? ' · ' + x.d : '');
const totalEnlaces = () => CATALOGO.reduce((s, p) => s + p.pagos.length, 0);
const norm = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
function textoDe(c){
  return norm([c.ficha.origen, c.pauta && c.pauta.campana, c.pauta && c.pauta.anuncio]
    .concat(c.msgs.map(m => typeof m.in === 'string' ? m.in : m.in && m.in.trans || m.recepcion || m.note || '')).join(' '));
}
function sugeridos(c){
  const t = textoDe(c);
  // Un producto se sugiere si su nombre (o una palabra larga de su nombre) aparece en lo que la persona ha escrito.
  const quiere = CATALOGO.map((p, pi) => ({pi, ok: norm(p.p).split(/[^a-z0-9]+/).filter(w => w.length > 3).some(w => t.includes(w))})).filter(x => x.ok);
  const pago = /tarjeta/.test(t) ? 'Tarjeta' : /contado|pse|nequi|transferencia/.test(t) ? 'contado' : '';
  const out = [];
  quiere.forEach(({pi}) => CATALOGO[pi].pagos.forEach((x, mi) => { if (!pago || x.m.includes(pago)) out.push({pi, mi}); }));
  return out.slice(0, 4);
}
function razon(c){
  const t = textoDe(c), r = [];
  const p = CATALOGO.find(x => norm(x.p).split(/[^a-z0-9]+/).filter(w => w.length > 3).some(w => t.includes(w)));
  if (p) r.push('preguntó por ' + p.p);
  if (/tarjeta/.test(t)) r.push('mencionó tarjeta');
  if (c.pauta) r.push('llegó por la campaña ' + c.pauta.campana);
  return r.length ? 'Porque ' + r.join(', ') + '.' : 'Por lo que ha escrito en la conversación.';
}
const yaCompro = (c, p) => !!(c.ficha.compras && norm(c.ficha.compras.p).replace(/\s+/g, ' ').includes(norm(p.p).replace(/^combo \| /, '').replace(/\s+/g, ' ')));
function abrirEnlaces(filtro){
  const c = CONV.find(x => x.id === st.sel); const lk = document.getElementById('lk');
  const q = norm(filtro || '');
  const palabras = q.split(/\s+/).filter(Boolean);
  // Palabras cortas («g», «a», «b») deben ser palabra completa: si no, la «g» aparece dentro de «pago».
  const esta = (texto, w) => { w = w.replace(/[.$]/g, ''); if (!w) return true; return w.length <= 2 ? new RegExp('(^|[^a-z0-9])' + w + '($|[^a-z0-9])').test(texto) : texto.includes(w); };
  const coincide = (p, x) => palabras.every(w => esta(norm(p.p + ' ' + p.c + ' ' + etiquetaPago(x) + ' ' + (x.pr ?? '') + ' ' + (x.pr != null ? Number(x.pr).toLocaleString('es-CO') : '')), w));
  const marca = t => { let h = esc(t); palabras.forEach(w => { if (w.length > 1) h = h.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>'); }); return h; };
  const fila = (p, pi, idxs) => `<div class="prod"><div class="pn">${marca(p.p)}${yaCompro(c, p) ? '<span class="ya">Ya lo compró</span>' : ''}</div><div class="pm">${idxs.map(mi => `<button type="button" data-pick="${pi}-${mi}"${p.pagos[mi].url ? '' : ' disabled title="Este medio no tiene enlace en tu pestaña de la hoja de enlaces"'}><b>${esc(p.pagos[mi].m)}</b><span>${esc(p.pagos[mi].d)} · ${precio(p.pagos[mi].pr)}</span></button>`).join('')}</div></div>`;
  let h = '';
  if (!q) {
    const sg = sugeridos(c);
    if (sg.length) {
      const porProd = {}; sg.forEach(x => (porProd[x.pi] = porProd[x.pi] || []).push(x.mi));
      h += `<div class="lkg">Sugerido para ${esc(c.n.split(' ')[0])}</div><div class="sug"><p>${esc(razon(c))}</p>${Object.entries(porProd).map(([pi, mis]) => fila(CATALOGO[pi], pi, mis)).join('')}</div>`;
    }
  }
  const grupos = {};
  CATALOGO.forEach((p, pi) => { const mis = p.pagos.map((x, mi) => mi).filter(mi => !q || coincide(p, p.pagos[mi])); if (mis.length) (grupos[p.c] = grupos[p.c] || []).push(fila(p, pi, mis)); });
  const orden = [...new Set(CATALOGO.map(p => p.c))];
  const cuerpo = orden.filter(g => grupos[g]).map(g => `<div class="lkg">${g}</div>${grupos[g].join('')}`).join('');
  const falt = FALTANTES.filter(f => !q || palabras.every(w => esta(norm(f), w)));
  const faltHtml = falt.map(f => `<div class="falta">${I('lock')}${esc(f)}: te falta este enlace. Pídelo en el módulo Enlaces.</div>`).join('');
  h += q ? faltHtml + cuerpo : cuerpo + faltHtml;
  if (!h) h = q ? `<p class="muted" style="padding:14px 6px">Nada coincide con «${esc(filtro)}». Prueba con el nombre del producto o la forma de pago, por ejemplo «plan anual tarjeta».</p>` : `<p class="muted" style="padding:14px 6px">${crmCatalogoInfo.cargando ? 'Cargando tus enlaces…' : 'Todavía no tienes enlaces de pago. Pídelos en el módulo Enlaces.'}</p>`;
  if (crmCatalogoInfo.aviso) h = `<div class="falta">${I('lock')}${esc(crmCatalogoInfo.aviso)}</div>` + h;
  const cerr = /cerrada/i.test(c.ventana);
  lk.innerHTML = `<div class="lkh">${I('link')}<b>Mis enlaces de pago</b><small>${totalEnlaces()} enlaces de ${esc(yo)}</small></div>
    <label class="lks">${I('search')}<input id="lk-q" value="${esc(filtro || '')}" placeholder="Busca por producto, forma de pago o precio" autocomplete="off"></label>
    ${cerr ? `<div class="falta" style="margin:0 12px;color:var(--amber-ink)">${I('lock')}${hayTpl('Enlace de pago') ? 'La ventana de 24 h está cerrada: el enlace sale dentro de la plantilla «Enlace de pago».' : 'La ventana de 24 h está cerrada y todavía no hay una plantilla «Enlace de pago» aprobada por Meta: créala en Plantillas para poder mandar el enlace.'}</div>` : ''}
    <div class="lkb" id="lk-b">${h}</div>`;
  lk.hidden = false;
  const inp = document.getElementById('lk-q'); inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length);
  inp.addEventListener('input', () => { const v = inp.value; abrirEnlaces(v); });
}
function elegirEnlace(pi, mi){
  const c = CONV.find(x => x.id === st.sel); const p = CATALOGO[pi], x = p.pagos[mi]; if (!x || !x.url) return;
  st.adj = {p: p.p, m: etiquetaPago(x), pr: precio(x.pr), url: x.url};
  const adj = document.getElementById('adj');
  adj.innerHTML = `${I('link')}<span>${esc(p.p)}<small>${esc(etiquetaPago(x))} · ${precio(x.pr)} · enlace de ${esc(yo)}</small></span><button type="button" id="adj-x" aria-label="Quitar enlace">${I('x')}</button>`;
  adj.hidden = false;
  document.getElementById('lk').hidden = true;
  if (!ta.value.trim()) ta.value = `Aquí tienes el enlace de pago de ${p.p}:`;
  ta.focus();
  if (yaCompro(c, p)) toast(`${c.n.split(' ')[0]} ya compró este producto. Revisa antes de enviarlo.`);
}
function quitarAdjunto(){ st.adj = null; const a = document.getElementById('adj'); a.hidden = true; a.innerHTML = ''; }
document.getElementById('adj').addEventListener('click', e => { if (e.target.closest('#adj-x')) quitarAdjunto(); });
document.getElementById('lk').addEventListener('click', e => { e.stopPropagation(); const b = e.target.closest('[data-pick]'); if (!b) return; const [pi, mi] = b.dataset.pick.split('-').map(Number); elegirEnlace(pi, mi); });
document.addEventListener('click', e => { if (!e.target.closest('#lk') && !e.target.closest('#b-link') && !e.target.closest('[data-ver-enlaces]') && !e.target.closest('[data-pick]')) document.getElementById('lk').hidden = true; });
document.getElementById('b-link').addEventListener('click', e => { e.stopPropagation(); const lk = document.getElementById('lk'); if (!lk.hidden) { lk.hidden = true; return; } document.getElementById('qr').hidden = true; abrirEnlaces(''); });
/* Finalizar con encuesta: al cerrar, al cliente le llega
   por WhatsApp un formulario de dos preguntas. La primera califica al asesor (de 1 a 5)
   y es la que sirve para el control del equipo; la segunda es el NPS de la empresa. */
const ovRes = document.getElementById('ov-res');
// El texto de la encuesta sale de Ajustes del CRM > Encuesta al finalizar.
// ¿Hay una plantilla con ese nombre aprobada por Meta?
const hayTpl = n => PLANTILLAS.some(p => p.n === n && p.e === 'ok');
function encuestaTexto(c){ const e = CFG.encuesta, a = (c.asig || 'tu asesor').split(' ')[0]; return `¡Gracias por escribirnos! ¿Nos ayudas con dos preguntas? Toma menos de un minuto.\n\n1. ${e.p1.replace(/\{\{asesor\}\}/g, a)} Responde con un número del 1 al 5.\n2. ${e.p2} Responde con un número del 0 al 10.\n\nSi quieres, cuéntanos algo más en otro mensaje.`; }
function abrirFinalizar(){
  const c = CONV.find(x => x.id === st.sel);
  const cerr = /cerrada/i.test(c.ventana);
  const reciente = !!c.encuestada;
  const puede = !!CFG.encuesta.on && !cerr && !reciente && !!c.asig;
  st.resEnc = puede;
  const asesor = c.asig || 'tu asesor';
  // La vista previa es el mismo texto que sale por WhatsApp.
  document.getElementById('res-prev').innerHTML = `${esc(encuestaTexto(c))}<div class="tm">ahora</div>`;
  document.getElementById('res-b').innerHTML = `<div class="res-cab"><h3>Finalizar la conversación</h3><p>Con ${esc(c.n)}</p><button type="button" class="dlg-cerrar" id="res-x" aria-label="Cerrar">${I('x')}</button></div>
    <div class="opt"><div><b>Enviar encuesta de satisfacción</b><span>Dos preguntas por WhatsApp: cómo lo atendió ${esc(asesor)} y si recomendaría a ${esc(ESPACIO.nombre || 'la empresa')}. La respuesta queda en la conversación y en Informes.</span></div><button type="button" class="sw" id="res-sw" role="switch" aria-checked="${puede}" ${puede ? '' : 'disabled'} aria-label="Enviar encuesta"></button></div>
    ${!puede ? `<div class="why">${!CFG.encuesta.on ? 'La encuesta está apagada en Ajustes del CRM.' : cerr ? 'No se puede enviar: pasaron más de 24 horas desde su último mensaje. La encuesta sale solo con la conversación abierta, así no cuesta nada.' : reciente ? 'Ya respondió una encuesta en los últimos 30 días. Para no cansarlo, no se le manda otra.' : 'La conversación no tiene asesor asignado: no hay a quién calificar.'}</div>` : ''}
    <div class="opt"><div><b>Motivo del cierre</b><span>Sale en Informes.</span></div></div>
    <div class="ft"><button type="button" class="btn" id="res-x">Cancelar</button><button type="button" class="btn pri" id="res-ok">${I('check')}${puede ? 'Finalizar y enviar encuesta' : 'Finalizar'}</button></div>`;
  ovRes.hidden = false;
}
document.getElementById('cerrar').addEventListener('click', abrirFinalizar);
ovRes.addEventListener('click', e => {
  if (e.target === ovRes || e.target.closest('#res-x')) { ovRes.hidden = true; return; }
  const sw = e.target.closest('#res-sw'); if (sw && !sw.disabled) { st.resEnc = sw.getAttribute('aria-checked') !== 'true'; sw.setAttribute('aria-checked', String(st.resEnc)); document.getElementById('res-ok').innerHTML = I('check') + (st.resEnc ? 'Finalizar y enviar encuesta' : 'Finalizar'); return; }
  if (!e.target.closest('#res-ok')) return;
  const c = CONV.find(x => x.id === st.sel); ovRes.hidden = true;
  c.msgs.push({ev:'check', t:`Finalizada por ${yo} · ahora`});
  if (st.resEnc) {
    // Sale por WhatsApp como mensaje; la respuesta del cliente llega por el webhook y queda en la conversación.
    c.msgs.push({out: encuestaTexto(c), by: yo, encuesta: {asesor: c.asig}}, {ev:'star', t:'Encuesta de satisfacción enviada por WhatsApp'});
    c.encuestada = true; chat(); toast('Conversación finalizada. La encuesta sale por WhatsApp.');
  } else { chat(); toast('Conversación finalizada'); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') ovRes.hidden = true; });
// Atajos de teclado (Mi cuenta, Atajos de teclado): solo con una conversación abierta en la bandeja.
document.addEventListener('keydown', e => {
  if (st.pagina || !CONV.some(x => x.id === st.sel) || document.getElementById('app').classList.contains('sinchat')) return;
  if (!document.getElementById('ov-x').hidden || !ovRes.hidden || !document.getElementById('ov').hidden) return;
  // Enter envía en el computador (6-oct); Shift+Enter hace un salto de línea. En el celular, Enter sigue siendo salto de línea.
  const enterEnvia = e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.isComposing && !e.defaultPrevented && !matchMedia('(pointer: coarse)').matches;
  if (e.target.id === 'ta' && (enterEnvia || ((e.ctrlKey || e.metaKey) && e.key === 'Enter'))) { e.preventDefault(); document.getElementById('enviar').click(); return; }
  if (!e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.code === 'KeyN') { e.preventDefault(); setModo(st.modo === 'n' ? 'r' : 'n'); ta.focus(); }
  else if (e.code === 'KeyE') { e.preventDefault(); const bl = document.getElementById('b-link'); if (!bl.hidden) bl.click(); }
  else if (e.code === 'KeyR') { e.preventDefault(); document.getElementById('cerrar').click(); }
});

/* mensaje nuevo */

// Plantillas aprobadas por Meta como {n, x, c}: salen de PLANTILLAS (GET /crm/plantillas).
const TPL = [];
// Difusiones del equipo: se guardan como ajuste «difusiones».
const DIFUSIONES = [];
// Progreso real de cada difusión por id: lo escribe el motor del API en el ajuste «difusionesEstado» y llega con /inicio y en
// tiempo real (80-datos.js). La pantalla solo lo lee: nunca lo guarda de vuelta.
const DIF_ESTADO = {};
// Cifras y estado visibles de una difusión: los del motor; mientras el motor no la toma, «En cola».
function difVista(d){
  const s = d.id ? DIF_ESTADO[d.id] : null, cero = {env:0, ent:0, le:0, resp:0, fal:0, total:0, curso:false, motivo:''};
  if (!s) return d.id ? {...cero, est:'w', e:'En cola'} : {...cero, est:'b', e:'Error: se guardó sin los datos para enviarse. Créala de nuevo'};
  const [est, e] = s.estado === 'pausada' ? ['g', s.reanuda ? 'Pausada: fuera del horario permitido' : 'Pausada: ' + (s.motivo || 'sigue sola en un momento')]
    : s.estado === 'error' ? ['b', 'Error: ' + (s.motivo || 'no se pudo enviar')]
    : s.estado === 'terminada' ? ['ok', 'Enviada'] : s.estado === 'enviando' ? ['w', 'Enviando'] : ['w', 'En cola'];
  return {env: s.enviados || 0, ent: s.entregados || 0, le: s.leidos || 0, resp: s.respondieron || 0, fal: s.fallidos || 0, total: s.total || 0,
    curso: s.estado === 'enviando' || s.estado === 'pausada', est, e, motivo: s.motivo || ''};
}
// Plantillas de WhatsApp de Meta (GET /crm/plantillas) y los borradores de cada persona.
const PLANTILLAS = [];
const ov = document.getElementById('ov'), nmPara = document.getElementById('nm-para'), nmTxt = document.getElementById('nm-txt');
const nm = {via:null, tpl:null, contacto:null, adj:null};
function nmSug(){
  const q = nmPara.value.trim().toLowerCase(), qd = q.replace(/\D/g, '');
  const vistos = new Set();
  const L = q.length >= 2 ? [...ultimasConv(), ...CT_EXTRA].filter(x => { const k = x.contactoId || -x.id; if (vistos.has(k)) return false; const ok = String(x.n || '').toLowerCase().includes(q) || (qd.length >= 3 && String(x.tel || '').replace(/\D/g, '').includes(qd)) || (q.includes('@') && String(x.correo || (x.ficha || {}).correo || x.tel || '').toLowerCase().includes(q)); if (ok) vistos.add(k); return ok; }).slice(0,5) : [];
  document.getElementById('nm-sug').innerHTML = L.map(c => `<button type="button" data-nc="${c.id}"><span class="mini av" style="background:${AVC[Math.abs(c.id) % AVC.length]};color:#fff">${esc(ini(c.n))}</span>${esc(c.n)} · ${esc(c.tel || c.correo || '')}</button>`).join('');
  nm.contacto = null;
  // El aviso de las 24 horas es de WhatsApp: por correo no aplica.
  document.getElementById('nm-aviso').hidden = nmEsCorreo() || !(q.length >= 2 && !L.length);
}
function nmElegir(c){ nm.contacto = c; nmPara.value = `${c.n} · ${c.tel || c.correo || ''}`; document.getElementById('nm-sug').innerHTML = ''; document.getElementById('nm-aviso').hidden = nmEsCorreo() || (!!c.ventana && !/cerrada/i.test(c.ventana)); }
function pintarNmAdj(){ const a = document.getElementById('nm-adj'); if (!a) return; a.hidden = !nm.adj; a.innerHTML = nm.adj ? `${I('clip')}<span>${esc(nm.adj.n)}<small>${esc(nm.adj.t || '')}</small></span><button type="button" id="nm-adj-x" aria-label="Quitar el archivo">${I('x')}</button>` : ''; }
function nmAbrir(){ ov.hidden = false; nmPara.value = ''; nmTxt.value = ''; document.getElementById('nm-asunto').value = ''; nm.via = LINEAS.length === 1 ? LINEAS[0].id : null; nm.tpl = null; nm.vars = null; nm.contacto = null; nm.adj = null; pintarNmAdj(); document.getElementById('nm-via').innerHTML = nm.via ? `${esc(LINEAS[0].n)} · ${esc(LINEAS[0].tel)}` + I('chev') : (LINEAS.length ? 'Elige la línea de WhatsApp' : buzonesNm().length ? 'Elige el correo por donde sale' : 'Todavía no hay líneas conectadas') + I('chev'); document.getElementById('nm-via').classList.toggle('on', !!nm.via); document.getElementById('nm-tpl').innerHTML = 'Sin plantilla, mensaje libre' + I('chev'); document.getElementById('nm-tpl').classList.remove('on'); nmSug(); setTimeout(() => nmPara.focus(), 30);  nmModoVia(); }
function nmCerrar(){ ov.hidden = true; }
document.getElementById('nuevo').onclick = nmAbrir;
document.getElementById('nm-cancel').addEventListener('click', nmCerrar);
document.getElementById('nm-cerrar').addEventListener('click', nmCerrar);
ov.addEventListener('click', e => { if (e.target === ov) nmCerrar(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') nmCerrar(); });
nmPara.addEventListener('input', nmSug);
document.getElementById('nm-sug').addEventListener('click', e => {
  const b = e.target.closest('[data-nc]'); if (!b) return;
  const c = CONV.find(x => x.id === +b.dataset.nc) || CT_EXTRA.find(x => x.id === +b.dataset.nc); if (c) nmElegir(c);
});
// «Vía»: las líneas de WhatsApp y, si hay, los buzones de correo conectados (46-correo.js). Por correo no hay
// plantillas ni ventana de 24 horas; se pide el asunto y la dirección de la persona.
const buzonesNm = () => CX_CANALES.filter(x => x.canal === 'mail');
const nmEsCorreo = () => String(nm.via || '').startsWith('mail:');
function nmModoVia(){
  const correo = nmEsCorreo();
  document.getElementById('nm-asunto-f').hidden = !correo;
  document.getElementById('nm-tpl-f').hidden = correo;
  nmPara.placeholder = correo ? 'Escribe un nombre o un correo' : 'Escribe un nombre o un número de WhatsApp';
  if (correo) { nm.tpl = null; nm.vars = null; document.getElementById('nm-aviso').hidden = true; }
}
document.getElementById('nm-via').addEventListener('click', e => { e.stopPropagation(); const m = document.getElementById('nm-via-m'), bz = buzonesNm();
  m.innerHTML = (LINEAS.length ? LINEAS.map(l => `<button type="button" role="option" data-via="${esc(l.id)}" aria-selected="${nm.via === l.id}">${I('wa')}${esc(l.n)}<small>${esc(l.tel)}</small></button>`).join('') : `<div class="hd">Todavía no hay líneas de WhatsApp conectadas. Las conecta el líder en Ajustes del CRM.</div>`)
    + (bz.length ? `<div class="hd">Correo</div>` + bz.map(b => `<button type="button" role="option" data-via="mail:${esc(b.id)}" aria-selected="${nm.via === 'mail:' + b.id}">${I('mail')}${esc(b.nombre)}<small>Correo</small></button>`).join('') : '');
  m.hidden = !m.hidden; });
document.getElementById('nm-via-m').addEventListener('click', e => { const b = e.target.closest('[data-via]'); if (!b) return; nm.via = b.dataset.via; const el = document.getElementById('nm-via');
  if (nmEsCorreo()) { const bx = buzonesNm().find(x => 'mail:' + x.id === nm.via); el.innerHTML = `Correo · ${esc(bx ? bx.nombre : '')}` + I('chev'); }
  else { const l = LINEAS.find(x => x.id === nm.via); el.innerHTML = `${esc(l.n)} · ${esc(l.tel)}` + I('chev'); }
  el.classList.add('on'); document.getElementById('nm-via-m').hidden = true; nmModoVia(); });
document.getElementById('nm-tpl').addEventListener('click', e => { e.stopPropagation(); const m = document.getElementById('nm-tpl-m'); m.innerHTML = `<div class="hd">${TPL.length ? 'Plantillas aprobadas por Meta' : 'Todavía no hay plantillas aprobadas por Meta'}</div>` + TPL.map(t => `<button type="button" role="option" data-tpl="${esc(t.n)}" aria-selected="${nm.tpl === t.n}">${I('bolt')}${esc(t.n)}</button>`).join(''); m.hidden = !m.hidden; });
document.getElementById('nm-tpl-m').addEventListener('click', e => { const b = e.target.closest('[data-tpl]'); if (!b) return; const t = TPL.find(x => x.n === b.dataset.tpl); if (!t) return; document.getElementById('nm-tpl-m').hidden = true;
  const auto = {nombre: nm.contacto ? nm.contacto.n.split(' ')[0] : '', asesor: yo.split(' ')[0], producto: (nm.contacto && nm.contacto.campos && nm.contacto.campos.producto) || ''};
  pedirVars({n: t.n, b: t.x}, auto, vars => { nm.tpl = t.n; nm.vars = vars; const el = document.getElementById('nm-tpl'); el.innerHTML = esc(t.n) + I('chev'); el.classList.add('on'); nmTxt.value = llenarVars(t.x, vars); });
});
document.addEventListener('click', e => { if (!e.target.closest('#nm-via')) document.getElementById('nm-via-m').hidden = true; if (!e.target.closest('#nm-tpl')) document.getElementById('nm-tpl-m').hidden = true; });
document.getElementById('nm-send').addEventListener('click', async ev => {
  if (!nmPara.value.trim()) { toast(nmEsCorreo() ? 'Escribe el correo o elige un contacto' : 'Escribe el WhatsApp o elige un contacto'); nmPara.focus(); return; }
  if (nmEsCorreo()) {
    const texto = nmTxt.value.trim(); if (!texto && !nm.adj) { toast('Escribe el mensaje'); nmTxt.focus(); return; }
    const c = nm.contacto, dir = c ? '' : nmPara.value.trim(), asunto = document.getElementById('nm-asunto').value.trim();
    if (!c && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(dir)) { toast('Elige un contacto de la lista o escribe su correo completo'); nmPara.focus(); return; }
    if (!asunto) { toast('Escribe el asunto del correo'); document.getElementById('nm-asunto').focus(); return; }
    const bt = ev.currentTarget; bt.disabled = true;
    try {
      const conv = await crmConversacionNueva({contactoId: c ? c.contactoId : undefined, correo: dir || undefined, canal:'mail', conexion: nm.via.slice(5), asunto, datos:[{out: texto || ' ', by: yo, ...(nm.adj ? {file: nm.adj} : {})}]});
      nmCerrar(); st.sel = conv.id; st.vista = 'mias'; st.pagina = ''; st.carpeta = st.equipo = st.etq = st.linea = st.q = ''; st.menciones = false; st.est = 'abiertas'; document.getElementById('q').value = ''; render();
      toast('Conversación creada: el correo sale por el buzón');
    } catch (err) { toast(err.message); }
    finally { bt.disabled = false; }
    return;
  }
  if (!nm.via) { toast(LINEAS.length ? 'Elige por cuál línea sale el mensaje' : 'Todavía no hay líneas de WhatsApp conectadas'); return; }
  const texto = nmTxt.value.trim(); if (!texto && !nm.adj) { toast('Escribe el mensaje'); nmTxt.focus(); return; }
  const c = nm.contacto, tel = c ? '' : nmPara.value.trim();
  if (!c && tel.replace(/\D/g, '').length < 10) { toast('Elige un contacto de la lista o escribe su WhatsApp completo'); nmPara.focus(); return; }
  const tpl = nm.tpl != null ? TPL.find(x => x.n === nm.tpl) || null : null;
  // Sin conversación abierta en las últimas 24 horas, WhatsApp solo deja empezar con una plantilla aprobada.
  if ((!c || !c.ventana || /cerrada/i.test(c.ventana)) && !tpl) { toast('Elige una plantilla aprobada: WhatsApp solo deja empezar con una plantilla'); return; }
  const bt = ev.currentTarget; bt.disabled = true;
  try {
    const conv = await crmConversacionNueva({contactoId: c ? c.contactoId : undefined, tel: tel || undefined, linea: nm.via, canal:'wa', datos:[{out: texto || ' ', by: yo, ...(tpl ? {plantilla: tpl.n, vars: nm.vars || {}} : {}), ...(nm.adj ? {file: nm.adj} : {})}]});
    nmCerrar(); st.sel = conv.id; st.vista = 'mias'; st.pagina = ''; st.carpeta = st.equipo = st.etq = st.linea = st.q = ''; st.menciones = false; st.est = 'abiertas'; document.getElementById('q').value = ''; render();
    toast('Conversación creada: el mensaje sale por WhatsApp');
  } catch (err) { toast(err.message); }
  finally { bt.disabled = false; }
});

/* ── Arreglos de la auditoría de botones (25-sep) ── */
function pintarFicha(){
  const c = CONV.find(x => x.id === st.sel); if (!c) return; const f = c.ficha;
  const est = crmFichaExterna(c.contactoId), d = est && est.datos;
  const kv = (k, v) => v ? `<dt>${k}</dt><dd>${esc(v)}</dd>` : '';
  const compras = (d && d.compras) || f.compras;
  const comprasHtml = compras ? `<dl class="kv">${kv('Producto', compras.p)}${kv('Medio', compras.medio)}${compras.total ? kv('Cuotas', `${compras.pagadas} de ${compras.total}`) : ''}${kv('Estado', compras.estado)}${kv('Próxima', compras.prox)}</dl>` : `<p class="muted" style="margin:0">${!est || est.error ? 'No se pudieron consultar sus compras.' : !est.datos ? 'Buscando sus compras…' : 'Todavía no ha comprado.'}</p>`;
  const productos = d && d.productos && d.productos.length ? `<div class="hist" style="margin-top:8px">${d.productos.map(x => `<div><span>${esc(x.p)}${x.historico ? ' · anterior' : ''}</span><span>${esc(hcDia(x.fecha))}</span></div>`).join('')}</div>` : '';
  const plataforma = !est || est.cargando ? '<p class="muted" style="margin:0">Buscando en la plataforma…</p>'
    : est.error ? `<p class="muted" style="margin:0">${esc(est.error)}</p>`
    : d.externoId ? `<dl class="kv">${kv('Cliente', d.nombre)}${kv('Asesor', d.asesor)}${kv('Lo encontró por', {telefono:'su teléfono', correo:'su correo', representante:'el representante legal'}[d.via] || '')}</dl>${productos}`
    : '<p class="muted" style="margin:0">No aparece como cliente en la plataforma.</p>';
  const recup = d && d.recuperacion && d.recuperacion.length ? `<div class="fcard"><h4>${I('cart')}Recuperación de ventas</h4><div class="hist">${d.recuperacion.map(x => `<div><span>${esc(x.tipo)} · ${esc(x.producto)}</span><span>${esc(x.estado)}</span></div>`).join('')}</div></div>` : '';
  document.getElementById('ficha').innerHTML = `
    <div class="fcard"><h4>${I('user')}Datos</h4><dl class="kv">${kv('Ciudad', f.ciudad)}${kv(CANALES[c.canal] ? (c.canal === 'wa' ? 'WhatsApp' : CANALES[c.canal].n) : 'Contacto', c.tel)}${kv('Correo', f.correo)}${kv('Llegó por', f.origen)}</dl></div>
    <div class="fcard"><h4>${I('compass')}Lo que busca</h4><dl class="kv"><dt>Interés</dt><dd>${esc(f.interes || 'Sin dato')}</dd></dl>${f.nota ? `<p class="muted" style="margin:0">${esc(f.nota)}</p>` : ''}</div>
    ${c.pauta ? `<div class="fcard"><h4>${I('ad')}Anuncio de origen</h4><dl class="kv"><dt>Plataforma</dt><dd>${esc(c.pauta.plataforma)}</dd><dt>Campaña</dt><dd>${esc(c.pauta.campana)}</dd><dt>Anuncio</dt><dd>${esc(c.pauta.anuncio)}</dd></dl></div>` : ''}
    <div class="fcard"><h4>${I('user')}En la plataforma</h4>${plataforma}</div>
    <div class="fcard"><h4>${I('cart')}Compras</h4>${comprasHtml}</div>${recup}
    <div class="fcard"><h4>${I('chat')}Conversaciones anteriores</h4>${(h => h.length ? `<div class="pc-hist">${h.join('')}</div>` : '<p class="muted" style="margin:0">Es su primera conversación.</p>')(historial(c))}</div>`;
}
const chatOrig = chat;
chat = function(){ chatOrig(); if (document.getElementById('app').classList.contains('verficha')) pintarFicha(); };
// El enlace de pago de un mensaje se copia al tocar su tarjeta.
document.getElementById('msgs').addEventListener('click', e => { const lc = e.target.closest('.linkcard[data-url]'); if (lc) copiar(lc.dataset.url, 'Enlace copiado'); });
// Copiar al portapapeles de verdad.
async function copiar(texto, aviso = 'Copiado'){ try { await navigator.clipboard.writeText(texto); toast(aviso); } catch { const t = document.createElement('textarea'); t.value = texto; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select(); let ok = false; try { ok = document.execCommand('copy'); } catch {} t.remove(); toast(ok ? aviso : 'No se pudo copiar. Cópialo a mano: ' + texto); } }
// Estado de la lista: abiertas, pendientes, finalizadas
st.est = 'abiertas';
document.getElementById('b-est').addEventListener('click', e => { e.stopPropagation(); const m = document.getElementById('m-est'); m.innerHTML = [['abiertas','Abiertas'],['pendientes','Pendientes'],['finalizadas','Finalizadas']].map(([k,n]) => `<button type="button" data-est="${k}" aria-selected="${st.est === k}">${n}<small>${CONV.filter(c => okRol(c) && (c.est || 'abiertas') === k).length}</small></button>`).join(''); m.hidden = !m.hidden; });
document.getElementById('m-est').addEventListener('click', e => { const b = e.target.closest('[data-est]'); if (!b) return; st.est = b.dataset.est; document.getElementById('est-l').textContent = b.textContent.replace(/\d+$/, ''); document.getElementById('m-est').hidden = true; const pr = visibles()[0]; if (pr) st.sel = pr.id; render(); });
document.addEventListener('click', e => { if (!e.target.closest('#b-est')) document.getElementById('m-est').hidden = true; if (!e.target.closest('#b-tpl') && !e.target.closest('#tplp')) document.getElementById('tplp').hidden = true; if (!e.target.closest('#dd-eq')) { const m = document.getElementById('eq-m'); if (m) m.hidden = true; } });
// Plantillas desde el compositor
document.getElementById('b-tpl').addEventListener('click', e => {
  e.stopPropagation(); const p = document.getElementById('tplp'); if (!p.hidden) { p.hidden = true; return; }
  const c = CONV.find(x => x.id === st.sel);
  if (sinPlantillas(c)) { toast(`${CANALES[c.canal].n} no usa plantillas: son de WhatsApp`); return; }
  p.innerHTML = `<div class="hd">Plantillas aprobadas por Meta${/cerrada/i.test(c.ventana) ? ' · la ventana está cerrada, solo sirven estas' : ''}</div>` + (PLANTILLAS.some(x => x.e === 'ok') ? PLANTILLAS.filter(x => x.e === 'ok').map(x => `<button type="button" data-usar-tpl="${esc(x.n)}"><b>${esc(x.n)}</b><span>${esc(x.b.replace(/\{\{nombre\}\}/g, c.n.split(' ')[0]))}</span></button>`).join('') : '<p class="muted" style="padding:8px 10px;margin:0">Todavía no hay plantillas aprobadas por Meta.</p>');
  document.getElementById('qr').hidden = true; document.getElementById('lk').hidden = true; p.hidden = false;
});
// Las variables que el servidor llena solo (services/crm/whatsapp.ts valorVariable); las demás se piden aquí.
const varsDe = t => [...new Set([...String(t || '').matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map(m => m[1]))];
const llenarVars = (t, v) => String(t || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => v[k] || m);
// Pide los datos que faltan de la plantilla x (texto en x.b) y luego llama listo(vars).
function pedirVars(x, auto, listo){
  const faltan = varsDe(x.b).filter(v => !auto[v]);
  if (!faltan.length) { listo({...auto}); return; }
  st.tplPend = {faltan, auto, listo};
  abrirDialogo(`<h3>Completa la plantilla «${esc(x.n)}»</h3><p>WhatsApp la envía tal como Meta la aprobó. Estos datos van dentro del mensaje.</p>
    ${faltan.map((v, i) => `<div class="fld">${esc(/^\d+$/.test(v) ? 'Dato ' + v : v === 'enlace' ? 'Enlace' : v.charAt(0).toUpperCase() + v.slice(1))}<input id="tv-${i}" data-tv="${esc(v)}" autocomplete="off"></div>`).join('')}
    <div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" id="tv-ok">Usar la plantilla</button></div>`);
  document.getElementById('tv-0').focus();
}
document.getElementById('tplp').addEventListener('click', e => {
  const b = e.target.closest('[data-usar-tpl]'); if (!b) return;
  const c = CONV.find(x => x.id === st.sel), x = PLANTILLAS.find(y => y.e === 'ok' && y.n === b.dataset.usarTpl); if (!c || !x) return;
  document.getElementById('tplp').hidden = true;
  const auto = {nombre: c.n.split(' ')[0], asesor: (c.asig || yo).split(' ')[0], producto: (c.campos && c.campos.producto) || ''};
  pedirVars(x, auto, vars => { if (st.sel !== c.id) return; ta.value = llenarVars(x.b, vars); st.tplUsada = x.n; st.tplVars = vars; ta.focus(); });
});
document.getElementById('ov-x').addEventListener('click', e => {
  if (!e.target.closest('#tv-ok') || !st.tplPend) return;
  const {listo, auto, faltan} = st.tplPend, vars = {...auto};
  for (const el of document.querySelectorAll('[data-tv]')) vars[el.dataset.tv] = el.value.trim();
  const vacio = faltan.find(v => !vars[v]); if (vacio) { toast('Completa todos los datos de la plantilla'); document.querySelector(`[data-tv="${vacio}"]`).focus(); return; }
  st.tplPend = null; cerrarDialogo(); listo(vars);
});
// Finalizar deja la conversación en «Finalizadas»
ovRes.addEventListener('click', e => { if (e.target.closest('#res-ok')) { const c = CONV.find(x => x.id === st.sel); if (c) { c.est = 'finalizadas'; c.motivo = st.resMot || null; setTimeout(() => { const pr = visibles()[0]; if (pr) st.sel = pr.id; render(); }, 50); } } });
// Equipo de la conversación
document.getElementById('panel').addEventListener('click', e => {
  if (e.target.closest('#eq-b')) { e.stopPropagation(); if (abrirMenuPanel('eq')) { const c = CONV.find(x => x.id === st.sel); document.getElementById('eq-m').innerHTML = `<label class="pc-mq">${I('search')}<input id="eq-q" placeholder="Buscar equipo" autocomplete="off" aria-label="Buscar equipo"></label><div class="pc-ml" id="eq-l">${opcionesEquipo(c, '')}</div>`; document.getElementById('eq-q').focus(); } return; }
  // Cambiar de equipo: el API la deja sin asesor (si no es de ese equipo) y la reparte entre los conectados del equipo nuevo.
  const q = e.target.closest('[data-eq]'); if (q) { const c = CONV.find(x => x.id === st.sel); cerrarMenusPanel(); if (!c || q.dataset.eq === equipoConv(c)) return; c.equipo = q.dataset.eq; c.msgs.push({ev:'swap', t:`Pasó al equipo ${c.equipo} · ahora`}); render(); toast(`Pasó al equipo ${c.equipo}`); return; }
  if (e.target.closest('#p-min')) { document.getElementById('app').classList.add('panel-min'); document.getElementById('app').classList.remove('panel-on'); pintarPopen(); }
}, true);
function pintarPopen(){ let b = document.getElementById('popen'); const min = document.getElementById('app').classList.contains('panel-min'); if (!min) { if (b) b.remove(); return; } if (!b) { b = document.createElement('button'); b.id = 'popen'; b.type = 'button'; b.className = 'popen'; b.textContent = 'Contacto'; b.onclick = () => { document.getElementById('app').classList.remove('panel-min'); b.remove(); }; document.querySelector('.chat').style.position = 'relative'; document.querySelector('.chat').appendChild(b); } }

// Informes: las barras llevan a la bandeja filtrada
document.getElementById('page').addEventListener('click', e => { const a = e.target.closest('[data-f-etq]'); if (a) { st.etq = ''; filtrar('etq', a.dataset.fEtq); return; } const l = e.target.closest('[data-f-linea]'); if (l) { st.linea = ''; filtrar('linea', l.dataset.fLinea); } });

/* ── Los 7 puntos que faltaban frente a Trengo (25-sep) ── */
document.getElementById('canales').addEventListener('click', e => { const b = e.target.closest('[data-ch]'); if (b) filtrar('canal', b.dataset.ch); });
document.getElementById('tags').addEventListener('click', e => { const b = e.target.closest('[data-tg]'); if (b) filtrar('tag', b.dataset.tg); });
// Etiquetas y campos en el panel
document.getElementById('panel').addEventListener('click', e => {
  const c = CONV.find(x => x.id === st.sel); if (!c) return;
  if (e.target.closest('#tag-b')) { e.stopPropagation(); const m = document.getElementById('tag-m'); m.hidden = !m.hidden; if (!m.hidden) { m.style.left = ''; m.style.right = ''; const p = document.getElementById('panel').getBoundingClientRect(); if (m.getBoundingClientRect().left < p.left + 4) { m.style.left = '0'; m.style.right = 'auto'; } document.getElementById('tag-q').focus(); } return; }
  if (e.target.closest('#tag-q')) { e.stopPropagation(); return; }
  const cr = e.target.closest('[data-tag-crear]'); if (cr) { const n = cr.dataset.tagCrear; const PAL = ['#0891b2','#db2777','#ca8a04','#059669','#7c3aed','#dc2626','#2563eb','#ea580c','#475569']; ETIQS.push([n, PAL[ETIQS.length % PAL.length], eqDeConv(c)]); ETIQ_COL[n] = ETIQS[ETIQS.length - 1][1]; c.tags.push(n); render(); toast(`Etiqueta creada: ${n}`); return; }
  const ad = e.target.closest('[data-tag-add]'); if (ad) { c.tags.push(ad.dataset.tagAdd); render(); toast(`Etiqueta: ${ad.dataset.tagAdd}`); return; }
  const dl = e.target.closest('[data-tag-del]'); if (dl) { c.tags = c.tags.filter(t => t !== dl.dataset.tagDel); render(); toast(`Quitada: ${dl.dataset.tagDel}`); return; }
  const cop = e.target.closest('[data-cop]'); if (cop) { const [k, v] = cop.dataset.cop.split('::'); c.campos[k] = v; render(); toast(`${CAMPOS.find(f => f.k === k).n}: ${opsDe(CAMPOS.find(f => f.k === k)).find(([x]) => x === v)?.[1] ?? v}`); return; }
  if (e.target.closest('[data-guardar-campos]')) { document.querySelectorAll('#panel [data-campo]').forEach(i => { c.campos[i.dataset.campo] = i.value.trim(); }); toast('Datos del cliente guardados'); return; }
}, true);
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-prev-conv]'); if (!b) return;
  const o = CONV.find(x => x.id === +b.dataset.prevConv); if (!o) return;
  const fecha = hcDia((o._t && (o._t.finalizada || o._t.ultimo)) || Date.now()).toLowerCase();
  const cab = `<h3>Conversación del ${esc(fecha)} · ${esc((CANALES[o.canal] || {n:''}).n)}</h3><p>${o.motivo ? 'Finalizada: ' + esc(o.motivo) + '.' : 'Finalizada.'}${o.asig ? ' La atendió ' + esc(o.asig) + '.' : ''}</p>`;
  abrirDialogo(`${cab}<div class="tr"><p class="muted" style="margin:0">Cargando mensajes…</p></div><div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cerrar</button></div>`);
  try { const msgs = await crmMensajesDe(o.id); const tr = document.querySelector('#dlg-x .tr'); if (tr) { tr.innerHTML = msgs.map(burbuja).join('') || '<p class="muted" style="margin:0">Sin mensajes.</p>'; tr.scrollTop = tr.scrollHeight; } }
  catch (err) { const tr = document.querySelector('#dlg-x .tr'); if (tr) tr.innerHTML = `<p class="muted" style="margin:0">${esc(err.message)}</p>`; }
});
document.getElementById('panel').addEventListener('input', e => { if (e.target.id !== 'tag-q') return; const c = CONV.find(x => x.id === st.sel); document.getElementById('tag-l').innerHTML = listaTags(c, e.target.value); });
document.getElementById('panel').addEventListener('keydown', e => { if (e.target.id !== 'tag-q' || e.key !== 'Enter') return; e.preventDefault(); const b = document.querySelector('#tag-l button'); if (b) b.click(); });
document.addEventListener('click', e => { if (!e.target.closest('#dd-tag')) { const m = document.getElementById('tag-m'); if (m) m.hidden = true; } });
// Diálogo genérico
/* Logos de marca, tal como los publican las marcas (no los íconos de línea del CRM). */
const LOGO = {
  fb:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#0866FF" d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"/></svg>',
  wa:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg>',
  llave:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="15" r="4"/><path d="m10.85 12.15 8.65-8.65M16 7l3 3M13.5 9.5l2 2"/></svg>',
};
/* Logos de las marcas (simple-icons; la G de Google con sus cuatro colores), en blanco sobre el color de cada una. */
LOGO.ig = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M7.0301.084c-1.2768.0602-2.1487.264-2.911.5634-.7888.3075-1.4575.72-2.1228 1.3877-.6652.6677-1.075 1.3368-1.3802 2.127-.2954.7638-.4956 1.6365-.552 2.914-.0564 1.2775-.0689 1.6882-.0626 4.947.0062 3.2586.0206 3.6671.0825 4.9473.061 1.2765.264 2.1482.5635 2.9107.308.7889.72 1.4573 1.388 2.1228.6679.6655 1.3365 1.0743 2.1285 1.38.7632.295 1.6361.4961 2.9134.552 1.2773.056 1.6884.069 4.9462.0627 3.2578-.0062 3.668-.0207 4.9478-.0814 1.28-.0607 2.147-.2652 2.9098-.5633.7889-.3086 1.4578-.72 2.1228-1.3881.665-.6682 1.0745-1.3378 1.3795-2.1284.2957-.7632.4966-1.636.552-2.9124.056-1.2809.0692-1.6898.063-4.948-.0063-3.2583-.021-3.6668-.0817-4.9465-.0607-1.2797-.264-2.1487-.5633-2.9117-.3084-.7889-.72-1.4568-1.3876-2.1228C21.2982 1.33 20.628.9208 19.8378.6165 19.074.321 18.2017.1197 16.9244.0645 15.6471.0093 15.236-.005 11.977.0014 8.718.0076 8.31.0215 7.0301.0839m.1402 21.6932c-1.17-.0509-1.8053-.2453-2.2287-.408-.5606-.216-.96-.4771-1.3819-.895-.422-.4178-.6811-.8186-.9-1.378-.1644-.4234-.3624-1.058-.4171-2.228-.0595-1.2645-.072-1.6442-.079-4.848-.007-3.2037.0053-3.583.0607-4.848.05-1.169.2456-1.805.408-2.2282.216-.5613.4762-.96.895-1.3816.4188-.4217.8184-.6814 1.3783-.9003.423-.1651 1.0575-.3614 2.227-.4171 1.2655-.06 1.6447-.072 4.848-.079 3.2033-.007 3.5835.005 4.8495.0608 1.169.0508 1.8053.2445 2.228.408.5608.216.96.4754 1.3816.895.4217.4194.6816.8176.9005 1.3787.1653.4217.3617 1.056.4169 2.2263.0602 1.2655.0739 1.645.0796 4.848.0058 3.203-.0055 3.5834-.061 4.848-.051 1.17-.245 1.8055-.408 2.2294-.216.5604-.4763.96-.8954 1.3814-.419.4215-.8181.6811-1.3783.9-.4224.1649-1.0577.3617-2.2262.4174-1.2656.0595-1.6448.072-4.8493.079-3.2045.007-3.5825-.006-4.848-.0608M16.953 5.5864A1.44 1.44 0 1 0 18.39 4.144a1.44 1.44 0 0 0-1.437 1.4424M5.8385 12.012c.0067 3.4032 2.7706 6.1557 6.173 6.1493 3.4026-.0065 6.157-2.7701 6.1506-6.1733-.0065-3.4032-2.771-6.1565-6.174-6.1498-3.403.0067-6.156 2.771-6.1496 6.1738M8 12.0077a4 4 0 1 1 4.008 3.9921A3.9996 3.9996 0 0 1 8 12.0077"/></svg>';
LOGO.msg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M12 0C5.24 0 0 4.952 0 11.64c0 3.499 1.434 6.521 3.769 8.61a.96.96 0 0 1 .323.683l.065 2.135a.96.96 0 0 0 1.347.85l2.381-1.053a.96.96 0 0 1 .641-.046A13 13 0 0 0 12 23.28c6.76 0 12-4.952 12-11.64S18.76 0 12 0m6.806 7.44c.522-.03.971.567.63 1.094l-4.178 6.457a.707.707 0 0 1-.977.208l-3.87-2.504a.44.44 0 0 0-.49.007l-4.363 3.01c-.637.438-1.415-.317-.995-.966l4.179-6.457a.706.706 0 0 1 .977-.21l3.87 2.505c.15.097.344.094.491-.007l4.362-3.008a.7.7 0 0 1 .364-.13"/></svg>';
LOGO.tg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#26A5E4" d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>';
LOGO.tw = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#F22F46" d="M12 0C5.381-.008.008 5.352 0 11.971V12c0 6.64 5.359 12 12 12 6.64 0 12-5.36 12-12 0-6.641-5.36-12-12-12zm0 20.801c-4.846.015-8.786-3.904-8.801-8.75V12c-.014-4.846 3.904-8.786 8.75-8.801H12c4.847-.014 8.786 3.904 8.801 8.75V12c.015 4.847-3.904 8.786-8.75 8.801H12zm5.44-11.76c0 1.359-1.12 2.479-2.481 2.479-1.366-.007-2.472-1.113-2.479-2.479 0-1.361 1.12-2.481 2.479-2.481 1.361 0 2.481 1.12 2.481 2.481zm0 5.919c0 1.36-1.12 2.48-2.481 2.48-1.367-.008-2.473-1.114-2.479-2.48 0-1.359 1.12-2.479 2.479-2.479 1.361-.001 2.481 1.12 2.481 2.479zm-5.919 0c0 1.36-1.12 2.48-2.479 2.48-1.368-.007-2.475-1.113-2.481-2.48 0-1.359 1.12-2.479 2.481-2.479 1.358-.001 2.479 1.12 2.479 2.479zm0-5.919c0 1.359-1.12 2.479-2.479 2.479-1.367-.007-2.475-1.112-2.481-2.479 0-1.361 1.12-2.481 2.481-2.481 1.358 0 2.479 1.12 2.479 2.481z"/></svg>';
LOGO.tt = '<svg viewBox="-1.5 -1.5 27 27" aria-hidden="true"><path fill="#25F4EE" transform="translate(-.7 -.7)" d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/><path fill="#FE2C55" transform="translate(.7 .7)" d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/><path fill="#fff" d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>';
LOGO.g = '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
/* Cabecera de un diálogo con la marca del canal: ícono en su color, título y una línea que explica. */
const dlgCab = (clase, icono, titulo, sub) => `<div class="dlg-cab"><span class="marca ${clase}">${icono}</span><div><h3>${titulo}</h3>${sub ? `<p>${sub}</p>` : ''}</div></div>`;
/* Pasos de un asistente: los hechos llevan chulo; el actual, resaltado. */
const pasosHTML = (nombres, actual) => `<div class="pasos2" aria-label="Paso ${actual} de ${nombres.length}">${nombres.map((n, i) => `<div class="${i + 1 < actual ? 'hecho' : i + 1 === actual ? 'on' : ''}"${i + 1 === actual ? ' aria-current="step"' : ''}><i>${i + 1 < actual ? I('check') : i + 1}</i>${n}</div>`).join('')}</div>`;
// Todo diálogo lleva su botón de cerrar arriba a la derecha (además de Escape y el clic afuera).
function abrirDialogo(html, clase = ''){ const d = document.getElementById('dlg-x'); d.className = 'dlg' + (clase ? ' ' + clase : ''); d.innerHTML = `<button type="button" class="dlg-cerrar" data-cerrar-dlg="1" aria-label="Cerrar">${I('x')}</button>` + html; document.getElementById('ov-x').hidden = false; }
function cerrarDialogo(){ document.getElementById('ov-x').hidden = true; }
document.getElementById('ov-x').addEventListener('click', e => {
  if (e.target.id === 'ov-x' || e.target.closest('[data-cerrar-dlg]')) { cerrarDialogo(); return; }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarDialogo(); });
// Páginas nuevas de Ajustes
document.getElementById('page').addEventListener('click', e => {
  const ir = e.target.closest('[data-ir]'); if (ir) { st.pagina = ir.dataset.ir; render(); return; }
  if (e.target.closest('#r-nueva')) { st.reglaNueva = {n:'', cuando:R_CUANDO[0], si:[], ent:[]}; render(); return; }
  if (e.target.closest('#r-cancel')) { st.reglaNueva = null; render(); return; }
  const n = st.reglaNueva;
  const rc = e.target.closest('[data-r-cuando]'); if (rc) { n.n = document.getElementById('r-n').value; n.cuando = rc.dataset.rCuando; render(); return; }
  for (const q of ['si', 'ent']) {
    const Q = q === 'si' ? 'Si' : 'Ent';
    const rt = e.target.closest(`[data-r-tipo-${q}]`); if (rt) { n.n = document.getElementById('r-n').value; n['t_' + q] = rt.dataset['rTipo' + Q]; n['o_' + q] = ''; render(); return; }
    const ro = e.target.closest(`[data-r-obj-${q}]`); if (ro) { n.n = document.getElementById('r-n').value; n['o_' + q] = ro.dataset['rObj' + Q]; render(); return; }
  }
  const ra = e.target.closest('[data-r-agregar]'); if (ra && n) { const q = ra.dataset.rAgregar, tipo = reglaTipos(q).find(t => t[0] === n['t_' + q]); if (!tipo) return; n.n = document.getElementById('r-n').value; const v = tipo[2] ? tipo[2](n['o_' + q]) : tipo[0]; if (!n[q].includes(v)) n[q].push(v); n['t_' + q] = n['o_' + q] = ''; render(); return; }
  const rq = e.target.closest('[data-r-quitar]'); if (rq && n) { const [q, i] = rq.dataset.rQuitar.split(':'); n.n = document.getElementById('r-n').value; n[q].splice(+i, 1); render(); return; }
  if (e.target.closest('#r-ok')) { n.n = document.getElementById('r-n').value.trim(); if (!n.n) { toast('Ponle nombre a la regla'); return; } if (!n.ent.length) { toast('Elige al menos una acción en «Entonces»'); return; } REGLAS.unshift({n: n.n, cuando: n.cuando, si: n.si, ent: n.ent, on:true}); st.reglaNueva = null; render(); toast(`Regla «${n.n}» activa`); return; }
  const on = e.target.closest('[data-r-on]'); if (on) { const r = REGLAS[+on.dataset.rOn]; r.on = !r.on; render(); toast(`${r.n}: ${r.on ? 'activa' : 'apagada'}`); return; }
  const rd = e.target.closest('[data-r-del]'); if (rd) { const r = REGLAS.splice(+rd.dataset.rDel, 1)[0]; render(); toast(`Regla borrada: ${r.n}`); return; }
  const cft = e.target.closest('[data-cf-t]'); if (cft) { st.cfT = cft.dataset.cfT; const v = document.getElementById('cf-n').value; render(); document.getElementById('cf-n').value = v; return; }
  if (e.target.closest('#cf-add')) { const v = document.getElementById('cf-n').value.trim(); if (!v) { toast('Escribe el nombre del campo'); return; } const k = 'c' + Date.now(); CAMPOS.push({k, n:v, t:st.cfT || 'Texto'}); render(); toast(`Campo agregado: ${v}`); return; }
  const cd = e.target.closest('[data-campo-del]'); if (cd) { const f = CAMPOS.splice(+cd.dataset.campoDel, 1)[0]; render(); toast(`Campo borrado: ${f.n}`); return; }
  if (e.target.closest('#imp-go')) elegirArchivo('.xlsx,.xls,.csv', async f => { st.imp = {fase:'corriendo', archivo:f.name}; render(); try { const r = await crmSubir(f, '/crm/contactos/importar'); st.imp = {fase:'listo', archivo:f.name, res:r}; toast(`Importados ${r.nuevos} contactos nuevos y ${r.actualizados} actualizados`); } catch (err) { st.imp = {fase:'lista', error:err.message}; toast(err.message); } if (st.pagina === 'importar') render(); });
});

// Agregar un lead a contactos: los leads llegan sin guardar.
document.getElementById('panel').addEventListener('click', e => {
  if (!e.target.closest('#b-agregar')) return;
  const c = CONV.find(x => x.id === st.sel);
  const nombre = /^(Visitante|Mamá|Papá)/.test(c.n) ? '' : c.n;
  abrirDialogo(`<h3>Agregar a contactos</h3><p>Queda guardado con su ficha y aparece en Contactos.</p>
    <div class="frm"><label>Nombre<input id="nc-n" value="${esc(nombre)}" placeholder="${esc(c.n)}"></label>
    <label>${c.canal === 'wa' ? 'WhatsApp' : c.canal === 'mail' ? 'Correo' : 'Usuario o teléfono'}<input id="nc-t" value="${esc(c.tel)}"></label>
    <label>Correo${c.canal === 'mail' ? '' : ', opcional'}<input id="nc-c" placeholder="correo@ejemplo.com" value="${esc(c.ficha.correo || '')}"></label>
    <label>Ciudad<input id="nc-ci" value="${esc(c.ficha.ciudad === 'Sin dato' ? '' : (c.ficha.ciudad || ''))}"></label></div>
    <div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" id="nc-ok">${I('check')}Agregar</button></div>`);
  setTimeout(() => document.getElementById('nc-n').focus(), 30);
}, true);
document.getElementById('ov-x').addEventListener('click', e => {
  if (!e.target.closest('#nc-ok')) return;
  const c = CONV.find(x => x.id === st.sel); const n = document.getElementById('nc-n').value.trim();
  if (!n) { toast('Escribe el nombre'); document.getElementById('nc-n').focus(); return; }
  const tel = document.getElementById('nc-t').value.trim() || c.tel, correo = document.getElementById('nc-c').value.trim(), ci = document.getElementById('nc-ci').value.trim();
  if (correo && !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(correo)) { toast('Ese correo no es válido'); document.getElementById('nc-c').focus(); return; }
  const bt = e.target.closest('#nc-ok'); bt.disabled = true;
  crmAgregarContacto(c, {n, tel, correo, ciudad: ci}).then(() => { c.msgs.push({ev:'user', t:`${yo} lo agregó a contactos`}); cerrarDialogo(); render(); toast(`${n} quedó en contactos`); }, err => { bt.disabled = false; toast(err.message); });
});

// Etiquetas personalizadas: crear, renombrar, cambiar color y borrar.
function recolorEtiq(){ Object.keys(ETIQ_COL).forEach(k => delete ETIQ_COL[k]); ETIQS.forEach(([n, c]) => { ETIQ_COL[n] = colorOk(c); }); }
/* ── Puntos 2 a 7 del 25-sep: tablero en vivo, transferir, unir, no contactar, material y programar ── */
const conv = () => CONV.find(x => x.id === st.sel);
// «No contactar» puede venir como texto, como true o como {motivo, fecha}.
const ncTxt = v => typeof v === 'string' ? v : v && typeof v === 'object' ? [v.motivo, v.fecha].filter(Boolean).join(' · ') || 'lo pidió' : 'lo pidió';
// Qué pares se pueden unir, según el servidor: «a|b» → '' si se puede, o la razón.
const UNIBLE = new Map(), UNIBLE_PIDE = new Set();
const unibleClave = (a, b) => a < b ? `${a}|${b}` : `${b}|${a}`;
function unibleGuardar(a, b, motivo){ UNIBLE.set(unibleClave(a, b), motivo); }
function pintarAvisos(c){
  const el = document.getElementById('avisos'); if (!el) return;
  const parecidos = CONV.filter(o => o.id !== c.id && (!c.contactoId || o.contactoId !== c.contactoId) && norm(o.n) === norm(c.n) && !/^(Visitante|Mamá|Papá|Sin nombre|\+?\d)/.test(c.n));
  // Se sugiere unir solo con quien sí se puede (mismo nombre no basta: dos «Laura» con números distintos son dos personas).
  const dup = parecidos.find(o => UNIBLE.get(unibleClave(c.id, o.id)) === '');
  const faltan = parecidos.filter(o => !UNIBLE.has(unibleClave(c.id, o.id)) && !UNIBLE_PIDE.has(unibleClave(c.id, o.id)));
  if (faltan.length) {
    faltan.forEach(o => UNIBLE_PIDE.add(unibleClave(c.id, o.id)));
    crmUnibles(c.id, faltan.map(o => o.id)).then(r => { faltan.forEach(o => unibleGuardar(c.id, o.id, (r.motivos || {})[o.id] || '')); if (st.sel === c.id) pintarAvisos(c); }, () => {})
      .finally(() => faltan.forEach(o => UNIBLE_PIDE.delete(unibleClave(c.id, o.id))));
  }
  el.innerHTML = (c.noContactar ? `<div class="aviso2 rojo">${I('block')}<span class="sp">No contactar: ${esc(ncTxt(c.noContactar))}. No recibe difusiones ni plantillas.</span><button type="button" data-nc-quitar="1">Quitar</button></div>` : '')
    + (dup ? `<div class="aviso2 amb">${I('merge')}<span class="sp">Parece la misma persona que ${esc(dup.n)} en ${CANALES[dup.canal].n}.</span><button type="button" data-unir="${dup.id}">Unir</button></div>` : '');
}
// Unir: primero con quién sí se puede; las demás, en gris con la razón. Las reglas son las del servidor
// (GET …/unibles, las mismas que revisa al unir); si no responde, se muestran todas y el servidor igual revisa.
async function dlgUnir(c){
  const otros = CONV.filter(o => o.id !== c.id);
  let motivos = {};
  try { motivos = (await crmUnibles(c.id, otros.map(o => o.id))).motivos || {}; } catch { /* sin respuesta */ }
  if (st.sel !== c.id) return;
  otros.forEach(o => unibleGuardar(c.id, o.id, motivos[o.id] || ''));
  const si = otros.filter(o => !motivos[o.id]), no = otros.filter(o => motivos[o.id]);
  const item = o => `<span>${esc(o.n)} · ${esc(o.tel)}</span>${I(CANALES[o.canal].ic)}`;
  abrirDialogo(`<h3>Unir a ${esc(c.n)} con otro contacto</h3><p>Todo queda en un solo contacto: mensajes de los dos canales, etiquetas y compras.</p><div class="frm"><label>Buscar<input id="un-q" placeholder="Nombre, teléfono o usuario"></label></div><div id="un-l" style="display:grid;gap:6px;max-height:260px;overflow-y:auto">${si.map(o => `<button type="button" class="sel" data-unir-con="${o.id}">${item(o)}</button>`).join('')}${no.map(o => `<button type="button" class="sel" disabled data-unir-no="${o.id}"><span>${esc(o.n)} · ${esc(o.tel)}<span class="por">${esc(motivos[o.id])}</span></span>${I(CANALES[o.canal].ic)}</button>`).join('')}</div><div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button></div>`);
}
async function unir(destinoId, origenId){
  const d = CONV.find(x => x.id === destinoId), o = CONV.find(x => x.id === origenId); if (!d || !o) return;
  const principal = d.guardado || !o.guardado ? d : o, otra = principal === d ? o : d;
  try { await crmUnir(principal, otra); UNIBLE.clear(); st.sel = principal.id; render(); toast(`Unidas: ${principal.n} ahora tiene ${CANALES[principal.canal].n} y ${CANALES[otra.canal].n}`); }
  catch (err) { toast(err.message); }
}
document.getElementById('chat-avisos-host') || null;
document.querySelector('.chat').addEventListener('click', e => {
  const u = e.target.closest('[data-unir]'); if (u) { unir(st.sel, +u.dataset.unir); return; }
  if (e.target.closest('[data-nc-quitar]')) { const c = conv(); c.noContactar = null; c.msgs.push({ev:'block', t:`${yo} quitó «no contactar»`}); render(); toast('Ya se le puede escribir'); return; }
  const pc = e.target.closest('[data-prog-cancel]'); if (pc) { const c = conv(); c.msgs = c.msgs.filter(m => !m.prog || (m.pid || m._id) !== pc.dataset.progCancel); chat(); toast('Mensaje programado cancelado'); return; }
});
// Menú «Más»
document.getElementById('b-mas').addEventListener('click', e => {
  e.stopPropagation(); const m = document.getElementById('m-mas'); const c = conv();
  m.innerHTML = [['silenciar','bell-off', silenciado(c) ? 'Quitar el silencio' : 'Silenciar sus mensajes'],['unir','merge','Unir con otro contacto'],['nocontactar','block', c.noContactar ? 'Quitar «no contactar»' : 'No contactar'],['-'],['exportar','download','Exportar el chat'],['spam','shield-x','Marcar como spam','peligro'],['-'],['borrar','x','Borrar sus datos']].map(([k, ic, n, cls]) => k === '-' ? '<hr>' : `<button type="button" data-mas="${k}"${cls ? ` class="${cls}"` : ''}>${I(ic)}${n}</button>`).join('');
  m.hidden = !m.hidden;
});
document.addEventListener('click', e => { if (!e.target.closest('#b-mas')) document.getElementById('m-mas').hidden = true; if (!e.target.closest('#b-clip') && !e.target.closest('#matp')) document.getElementById('matp').hidden = true; if (!e.target.closest('#b-prog') && !e.target.closest('#progp')) document.getElementById('progp').hidden = true; });
const chipsSel = (lista, attr, sel) => ddSel(attr, lista, sel);
document.getElementById('m-mas').addEventListener('click', e => {
  const b = e.target.closest('[data-mas]'); if (!b) return; const c = conv(); document.getElementById('m-mas').hidden = true;
  if (b.dataset.mas === 'transferir') { st.tr = {a:'', nota:''}; dlgTransferir(); }
  if (b.dataset.mas === 'silenciar') { const k = c.contactoId || c.id, ya = silenciado(c); AJ.silenciados = ya ? (AJ.silenciados || []).filter(x => x !== k) : [...(AJ.silenciados || []), k]; panel(c); toast(ya ? `Vuelven a sonar los mensajes de ${c.n}` : `Silenciaste a ${c.n}: sus mensajes no suenan ni avisan`); }
  if (b.dataset.mas === 'unir') dlgUnir(c);
  if (b.dataset.mas === 'exportar') mjDlgExportar(c);
  if (b.dataset.mas === 'spam') mjDlgSpam(c);
  if (b.dataset.mas === 'nocontactar') { if (c.noContactar) { c.noContactar = null; render(); toast('Ya se le puede escribir'); return; } st.nc = 'Lo pidió el cliente'; dlgNoContactar(); }
  if (b.dataset.mas === 'borrar') abrirDialogo(`<h3>Borrar los datos de ${esc(c.n)}</h3><p>Se borran su contacto, sus conversaciones y su ficha. Queda solo el registro de que pidió el borrado y la fecha, como exige la ley de protección de datos. No se puede deshacer.</p><div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" style="background:#dc2626;border-color:#dc2626" id="borrar-ok">${I('x')}Borrar sus datos</button></div>`);
});
function dlgTransferir(){
  const c = conv(); const t = st.tr;
  abrirDialogo(`<h3>Transferir la conversación con ${esc(c.n)}</h3><div class="fld">A quién${chipsSel([...ASESORES.filter(a => a !== c.asig), ...EQUIPOS.filter(q => typeof EQ_CFG === 'undefined' || EQ_CFG.transferibles[q.n] !== false).map(q => 'Equipo ' + q.n)], 'data-tr-a', t.a)}</div>
    <div class="frm"><label>Nota para quien la recibe<input id="tr-nota" value="${esc(t.nota)}" placeholder="Ej. Ya le mandé el enlace de pago, falta confirmar"></label></div>
    <div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" id="tr-ok">${I('share')}Transferir</button></div>`);
}
function dlgNoContactar(){
  const c = conv();
  abrirDialogo(`<h3>No contactar a ${esc(c.n)}</h3><p>No recibe difusiones, plantillas ni mensajes programados. Si escribe, la conversación llega y se le responde normal.</p><div class="fld">Motivo${chipsSel(['Lo pidió el cliente','Número equivocado','Ya compró en otro lado','Otro'], 'data-nc-m', st.nc)}</div>
    <div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" id="nc-guardar">${I('block')}Marcar no contactar</button></div>`);
}
document.getElementById('ov-x').addEventListener('click', e => {
  const c = conv();
  const ta2 = e.target.closest('[data-tr-a]'); if (ta2) { st.tr.nota = document.getElementById('tr-nota').value; st.tr.a = ta2.dataset.trA; dlgTransferir(); return; }
  if (e.target.closest('#tr-ok')) { const nota = document.getElementById('tr-nota').value.trim(); if (!st.tr.a) { toast('Elige a quién se la pasas'); return; } if (!nota) { toast('Deja una nota para quien la recibe'); document.getElementById('tr-nota').focus(); return; }
    // A una persona, la nota la menciona para que le llegue el aviso; a un equipo, queda en la conversación.
    const eq = st.tr.a.startsWith('Equipo'); c.msgs.push({note: eq ? nota : `@${st.tr.a} ${nota}`, by: yo, h:'ahora'}, {ev:'swap', t:`${yo} la transfirió a ${st.tr.a} · ahora`}); if (eq) { c.equipo = st.tr.a.replace(/^Equipo /, ''); c.asig = null; } else c.asig = st.tr.a; cerrarDialogo(); render(); toast(eq ? `Transferida al ${st.tr.a.replace(/^E/, 'e')}. Tu nota quedó en la conversación.` : `Transferida a ${st.tr.a}. Le llega un aviso con tu nota.`); return; }
  const un = e.target.closest('[data-unir-con]'); if (un) { cerrarDialogo(); unir(c.id, +un.dataset.unirCon); return; }
  const nm2 = e.target.closest('[data-nc-m]'); if (nm2) { st.nc = nm2.dataset.ncM; dlgNoContactar(); return; }
  if (e.target.closest('#nc-guardar')) { c.noContactar = `${st.nc.toLowerCase()} · ${(p => `${p.d} ${HC_MES[p.m]}`)(hcPartes(Date.now()))}`; c.msgs.push({ev:'block', t:`${yo} la marcó como no contactar: ${st.nc.toLowerCase()}`}); cerrarDialogo(); render(); toast('Marcada como no contactar'); return; }
  if (e.target.closest('#borrar-ok')) { const n = c.n, bt = e.target.closest('#borrar-ok'); bt.disabled = true; crmBorrarDatos(c).then(() => { const pr = visibles()[0]; st.sel = pr ? pr.id : 0; cerrarDialogo(); render(); toast(`Datos de ${n} borrados. Queda el registro de la solicitud.`); }, err => { bt.disabled = false; toast(err.message); }); return; }
  const rd = e.target.closest('[data-rs-a]'); if (rd) { st.rs.a = rd.dataset.rsA; dlgReasignar(); return; }
  const rsol = e.target.closest('[data-rs-solo]'); if (rsol) { st.rs.solo = !st.rs.solo; dlgReasignar(); return; }
  if (e.target.closest('#rs-ok')) { if (!st.rs.a) { toast('Elige a quién se las pasas'); return; }
    const lista = CONV.filter(x => x.asig === st.rs.de && (x.est || 'abiertas') === 'abiertas' && (!st.rs.solo || x.espera));
    const enLinea = USUARIOS.filter(u => u.nombre !== st.rs.de && estadoDe(u) === 'En línea' && u.reparto !== false).map(u => u.nombre);
    if (st.rs.a === 'Reparto automático' && !enLinea.length) { toast('No hay nadie más en línea para repartirlas'); return; }
    lista.forEach((x, i) => { x.asig = st.rs.a === 'Reparto automático' ? enLinea[i % enLinea.length] : st.rs.a; x.msgs.push({ev:'swap', t:`El líder la pasó de ${st.rs.de} a ${x.asig} · ahora`}); });
    cerrarDialogo(); render(); toast(`${lista.length ? 'Conversaciones pasadas' : 'Listo'} de ${st.rs.de} a ${st.rs.a === 'Reparto automático' ? 'quienes están en línea' : st.rs.a}`); }
});
document.getElementById('ov-x').addEventListener('input', e => { if (e.target.id !== 'un-q') return; const q = norm(e.target.value); document.querySelectorAll('[data-unir-con], [data-unir-no]').forEach(b => { b.style.display = norm(b.textContent).includes(q) ? '' : 'none'; }); });
// Tablero en vivo: pasar conversaciones en bloque
function dlgReasignar(){
  const r = st.rs; const n = CONV.filter(x => x.asig === r.de && (x.est || 'abiertas') === 'abiertas' && (!r.solo || x.espera)).length;
  abrirDialogo(`<h3>Pasar las conversaciones de ${esc(r.de)}</h3><p>${n} ${n === 1 ? 'conversación' : 'conversaciones'} ${r.solo ? 'sin responder' : 'abiertas'}. Cada una queda con una nota de quién la tenía.</p>
    <div class="fld">A quién${chipsSel(['Reparto automático', ...ASESORES.filter(a => a !== r.de)], 'data-rs-a', r.a)}</div>
    <div class="tgr" style="display:flex;justify-content:space-between;align-items:center;font-size:13px"><span>Solo las que esperan respuesta</span><button type="button" class="tg" role="switch" data-rs-solo="1" aria-checked="${r.solo}"></button></div>
    <div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" id="rs-ok">${I('share')}Pasar ${n}</button></div>`);
}
document.getElementById('page').addEventListener('click', e => { const b = e.target.closest('[data-reasignar]'); if (b) { st.rs = {de: b.dataset.reasignar, a: 'Reparto automático', solo: false}; dlgReasignar(); } });
// Material desde la Nube
document.getElementById('b-clip').addEventListener('click', e => {
  e.stopPropagation(); const p = document.getElementById('matp'); if (!p.hidden) { p.hidden = true; return; }
  p.innerHTML = `<div class="hd">Material de ventas del equipo</div>` + (MATERIAL.length ? '' : '<p class="muted" style="padding:4px 10px 8px;margin:0">Todavía no hay material del equipo. El líder lo agrega en Ajustes del CRM, Archivos.</p>') + MATERIAL.map((m, i) => `<button type="button" data-mat="${i}"><b>${I(m.ic)} ${esc(m.n)}</b><span>${esc(m.t)}</span></button>`).join('') + `<button type="button" data-mat="pc"><b>${I('clip')} Subir desde el computador</b><span>Imágenes, PDF y videos</span></button>`;
  ['qr','lk','tplp','progp'].forEach(id => document.getElementById(id).hidden = true); p.hidden = false;
});
document.getElementById('matp').addEventListener('click', e => {
  const b = e.target.closest('[data-mat]'); if (!b) return; document.getElementById('matp').hidden = true;
  const c = conv(); if (!c) return;
  if (/cerrada/i.test(c.ventana)) { toast(cerradaTxt(c)); return; }
  if (b.dataset.mat === 'pc') { enviarArchivoPc(c); return; }
  const m = MATERIAL[+b.dataset.mat]; if (!m) return;
  c.msgs.push({out: ta.value.trim() || `Te comparto ${m.n.replace(/\.(pdf|mp4)$/, '')}`, file:{n:m.n, t:m.t, ic:m.ic, url:m.url, mime:m.mime}, by:yo, h:'ahora'}); ta.value = ''; chat(); lista(); toast(`Enviado: ${m.n}`);
});
// Programar un mensaje
function progOpciones(){
  const p = hcPartes(Date.now()), out = [];
  if (p.h * 60 + p.mi < 15 * 60 + 30) out.push(['hoy', hcFecha(p.y, p.m, p.d, 16)]);
  out.push(['manana7', hcFecha(p.y, p.m, p.d + 1, 7)], ['manana9', hcFecha(p.y, p.m, p.d + 1, 9)], ['lunes', hcFecha(p.y, p.m, p.d + ((8 - p.w) % 7 || 7), 8)]);
  return out;
}
const progTxt = f => { const d = hcDia(f); return `${d === 'Hoy' || d === 'Mañana' ? d : 'El ' + d.toLowerCase()} a las ${hcHora(f)}`; };
function programar(c, texto, para){
  if (para.getTime() <= Date.now()) { toast('Esa hora ya pasó. Elige una más adelante.'); return false; }
  const cuando = progTxt(para);
  c.msgs.push({prog: cuando, out: texto, by: yo, pid: 'p' + Date.now().toString(36), para: para.toISOString()});
  ta.value = ''; chat();
  toast(hcDias(para) ? `Programado para ${cuando.toLowerCase()}. Si para esa hora pasaron 24 h desde su último mensaje, WhatsApp no lo deja salir sin plantilla.` : `Programado para ${cuando.toLowerCase()}`);
  return true;
}
document.getElementById('b-prog').addEventListener('click', e => {
  e.stopPropagation(); const p = document.getElementById('progp'); if (!p.hidden) { p.hidden = true; return; }
  if (!ta.value.trim()) { toast('Escribe primero el mensaje que quieres programar'); ta.focus(); return; }
  p.innerHTML = `<div class="hd">Enviar más tarde</div>` + progOpciones().map(([k, f]) => `<button type="button" data-prog="${k}"><b>${esc(progTxt(f))}</b></button>`).join('') + `<button type="button" data-prog="otra"><b>Elegir fecha y hora</b><span>Día y hora en desplegables</span></button>`;
  ['qr','lk','tplp','matp'].forEach(id => document.getElementById(id).hidden = true); p.hidden = false;
});
document.getElementById('progp').addEventListener('click', e => {
  const b = e.target.closest('[data-prog]'); if (!b) return; document.getElementById('progp').hidden = true;
  const c = conv(); if (!c) return;
  if (b.dataset.prog === 'otra') { st.progOtra = {dia:'', hora:'', texto: ta.value.trim()}; dlgProgramar(); return; }
  const op = progOpciones().find(x => x[0] === b.dataset.prog); if (op) programar(c, ta.value.trim(), op[1]);
});
function dlgProgramar(){
  const x = st.progOtra;
  abrirDialogo(`<h3>Programar el mensaje</h3><p>${esc(x.texto.length > 140 ? x.texto.slice(0, 140) + '…' : x.texto)}</p>
    <div class="two3" style="grid-template-columns:1fr 1fr"><div class="fld">Día${ddSel('data-pg-dia', hcOpcionesDia(), x.dia, 'Elige el día')}</div><div class="fld">Hora${ddSel('data-pg-hora', hcOpcionesHora(), x.hora, 'Elige la hora')}</div></div>
    <div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" id="pg-ok">${I('clock')}Programar</button></div>`);
}
document.getElementById('ov-x').addEventListener('click', e => {
  const x = st.progOtra; if (!x) return;
  const d = e.target.closest('[data-pg-dia]'); if (d) { x.dia = d.dataset.pgDia; dlgProgramar(); return; }
  const h = e.target.closest('[data-pg-hora]'); if (h) { x.hora = h.dataset.pgHora; dlgProgramar(); return; }
  if (!e.target.closest('#pg-ok')) return;
  if (!x.dia || !x.hora) { toast('Elige el día y la hora'); return; }
  const c = conv(); if (c && programar(c, x.texto, hcDeOpciones(x.dia, x.hora))) { st.progOtra = null; cerrarDialogo(); }
});

/* ── Opciones de Ajustes del CRM, cada una con su página (25-sep) ── */
const CFG = {
  lineas: [],
  meta: {ig:true, fb:true, igEq:'Ventas', fbEq:'Ventas'},
  telegram: {on:true, eq:'Ventas'}, tiktok: {on:true, eq:'Ventas'},
  web: {on:false, color:'#1f93ff', saludo:'¡Hola! ¿En qué te podemos ayudar?', pedir:true, horario:true},
  correo: {on:true, firma:''},
  reparto: {metodo:'Por turnos', tope:25, minutos:15, ausente:true, familiares:true, conocido:true},
  horario: [['Lunes','7:00','22:00',true],['Martes','7:00','22:00',true],['Miércoles','7:00','22:00',true],['Jueves','7:00','22:00',true],['Viernes','7:00','22:00',true],['Sábado','7:00','22:00',true],['Domingo','7:00','22:00',true]],
  festivos: true, fuera: 'Estamos fuera de horario. Te respondemos desde las 7 a. m.',
  encuesta: {on:true, dias:30, aviso:true, p1:'¿Cómo te atendió {{asesor}}?', p2:'Del 0 al 10, ¿qué tan probable es que recomiendes {{empresa}} a un amigo?'},
  recepcion: {on:false, desde:'22:00', hasta:'7:00', resumen:true, enlaces:false, lineas:[]},
  pauta: [],
};
const sw = (k, on, extra = '') => `<button type="button" class="tg" role="switch" data-cfg-tg="${k}" aria-checked="${!!on}" ${extra}></button>`;
const fila = (t, d, der) => `<div class="row2"><span>${t}${d ? `<small>${d}</small>` : ''}</span>${der}</div>`;
function paginaCfg(k){
  const volver = `<button type="button" class="volver" data-ir="ajustes-crm">${I('back')}Ajustes del CRM</button>`;
  const cab = (t, d) => `${volver}<h2>${t}</h2><p class="sub">${d}</p>`;
  if (k === 'lineas') return `<div class="ajw ancho">${cab('Líneas de WhatsApp', 'Las líneas conectadas por la API de Meta. Cada una tiene su equipo y decide si el agente IA responde de noche.')}
    <div class="cfg">${CFG.lineas.map((x, i) => { const l = LINEAS.find(y => y.id === x.id); if (!l) return ''; return `<div class="box2"><h4>${I('wa')}${esc(l.n)} · ${esc(l.tel)}<span class="${l.estado === 'conectada' ? 'ok2' : 'pill'}" style="margin-left:auto">${l.estado === 'conectada' ? 'Conectada' : esc(hcMay(String(l.estado || 'Sin conectar')))}</span></h4>
      ${fila('Equipo que la atiende', '', ddSel('data-cfg-lineq', EQUIPOS.map(e => [`${i}|${e.n}`, e.n]), `${i}|${x.eq}`))}
      ${fila('El agente IA responde de noche', 'De 10 p. m. a 7 a. m.', sw('linea-recepcion-' + i, x.recepcion))}
      ${fila('Calidad según Meta', 'Si baja, Meta limita cuántos mensajes se pueden enviar', `<span class="${/green|alta|high/i.test(l.calidad || '') ? 'ok2' : 'pill'}">${esc({GREEN:'Alta', YELLOW:'Media', RED:'Baja'}[String(l.calidad || '').toUpperCase()] || l.calidad || 'Sin dato')}</span>`)}</div>`; }).join('') || '<p class="muted">Todavía no hay líneas conectadas.</p>'}
      <div><button type="button" class="btn" data-ir="cfg-lineas">${I('plus')}Conectar otra línea</button></div></div></div>`;
  // Instagram, Messenger, Telegram y TikTok tienen cada uno su página (45-canales.js).
  if (k === 'web') { const w = CFG.web, codigo = `<script src="${location.origin}/chat.js" data-espacio="${esc(ESPACIO.id)}" async><\/script>`; return `<div class="ajw ancho">${cab('Chat de la página web', 'Una burbuja de chat en la página y las landings. Lo que escriben llega a la bandeja y pasa por el flujo de bienvenida y el reparto como un WhatsApp. La respuesta les aparece en la misma burbuja, también si vuelven más tarde desde ese navegador.')}
    <div class="two3"><div class="cfg"><div class="box2">
      ${fila('<b>Chat activo</b>', w.on ? 'La burbuja se ve en las páginas donde se pegó el código' : 'Apagado, la burbuja no aparece aunque el código esté pegado', sw('web-on', w.on))}
      <label class="fld">Saludo<input data-cfg-in="web.saludo" value="${esc(w.saludo)}"></label>
      <label class="fld">Enlace a tu política de datos<input data-cfg-in="web.privacidad" type="url" placeholder="https://tuempresa.com/privacidad" value="${esc(w.privacidad || '')}"><span class="muted" style="font-size:12px">La Ley 1581 pide informar para qué usas los datos. Aparece como enlace debajo del formulario de la burbuja.</span></label>
      <div class="fld">Color<div style="display:flex;gap:6px">${['#1f93ff','#0f172a','#059669','#7c3aed','#dc2626'].map(c => `<button type="button" data-cfg-color="${c}" aria-label="Color" style="width:24px;height:24px;border-radius:50%;background:${c};outline:${w.color === c ? '2px solid var(--ink)' : 'none'};outline-offset:2px"></button>`).join('')}</div></div>
      ${fila('Pedir nombre y WhatsApp antes de chatear', 'Así el contacto queda completo desde el primer mensaje', sw('web-pedir', w.pedir))}
      ${fila('Mostrar solo en horario de atención', 'Fuera de horario sale un formulario para dejar el mensaje', sw('web-horario', w.horario))}</div>
      <div class="box2"><h4>${I('file')}Código para pegar en la página</h4><code>${esc(codigo)}</code><p class="muted" style="margin:0">Va antes de &lt;/body&gt;. El color y el saludo se cambian aquí, sin tocar la página.</p><div><button type="button" class="btn" data-cfg-copiar="${esc(codigo)}">${I('link')}Copiar código</button></div></div></div>
      <div class="wprev"><div class="card2"><div class="hd2" style="background:${colorOk(w.color)}">${esc(ESPACIO.nombre || 'Tu empresa')}</div><div class="bd2">${esc(w.saludo)}${w.pedir ? '<br><br><i>Escribe tu nombre y tu WhatsApp para empezar.</i>' : ''}</div></div><span class="fab" style="background:${colorOk(w.color)}">${I('chat')}</span></div></div></div>`; }
  if (k === 'reparto') { const r = CFG.reparto; return `<div class="ajw ancho">${cab('Equipos y reparto', 'Cómo se reparten las conversaciones nuevas entre los asesores conectados.')}
    <div class="two3"><div class="cfg"><div class="box2"><h4>${I('users')}Método de reparto</h4>${ddSel('data-cfg-metodo', ['Por turnos','Al que tenga menos','Manual'], r.metodo)}
      <p class="muted" style="margin:0">${r.metodo === 'Por turnos' ? 'Una para cada asesor conectado, en orden.' : r.metodo === 'Al que tenga menos' ? 'Va al asesor con menos conversaciones abiertas.' : 'Nadie la recibe sola: el líder la asigna.'}</p>
      ${fila('Tope de conversaciones abiertas por asesor', 'Al llegar al tope, deja de recibir nuevas', `<input class="inl" data-cfg-in="reparto.tope" value="${r.tope}">`)}
      ${fila('Si no responde en estos minutos, pasa al siguiente', '', `<input class="inl" data-cfg-in="reparto.minutos" value="${r.minutos}">`)}</div></div>
      <div class="cfg"><div class="box2"><h4>${I('flow')}Excepciones</h4>
      ${fila('No asignar a quien está ausente', '', sw('rep-ausente', r.ausente))}
      ${fila('Familiares al mismo asesor', 'Mamá, papá o hermanos van con quien ya atiende al cliente', sw('rep-familiares', r.familiares))}
      ${fila('Cliente conocido vuelve a su asesor', 'Si ya compró o ya habló con alguien, le llega a esa persona', sw('rep-conocido', r.conocido))}</div>
      <div class="box2"><h4>${I('users')}Equipos</h4>${EQUIPOS.map((e, i) => fila(e.n, (MIEMBROS[e.n] || []).join(', ') || 'Falta elegir quién lo atiende', `<button type="button" class="btn" data-eq-edit="${i}">Editar</button>`)).join('')}<div><button type="button" class="btn" data-eq-edit="nuevo">${I('plus')}Crear equipo</button></div></div></div></div></div>`; }
  if (k === 'etapas') return paginaEtapas();
  if (k === 'horario') return `<div class="ajw ancho">${cab('Horario de atención', 'Fuera de este horario responde el agente IA y el chat de la web muestra un formulario.')}
    <div class="two3"><div class="cfg"><div class="box2">${CFG.horario.map(([d, a, b, on], i) => `<div class="row2"><span style="width:100px">${d}</span><span style="display:flex;gap:6px;align-items:center;flex:1;justify-content:flex-end">${on ? `<input class="inl" data-cfg-hora="${i}|1" value="${a}"> a <input class="inl" data-cfg-hora="${i}|2" value="${b}">` : '<span class="muted">Cerrado</span>'}${sw('hor-' + i, on)}</span></div>`).join('')}</div></div>
      <div class="cfg"><div class="box2">${fila('Festivos de Colombia como domingo', '', sw('festivos', CFG.festivos))}<label class="fld">Mensaje fuera de horario<textarea data-cfg-in="fuera">${esc(CFG.fuera)}</textarea></label><div><button type="button" class="btn" data-cfg-accion="Horario guardado">${I('check')}Guardar</button></div></div></div></div></div>`;
  if (k === 'qr') { const q = norm(st.qrq || ''); const L = QR.map((x, i) => [x, i]).filter(([x]) => !q || norm(x.t + ' ' + x.x).includes(q)); return `<div class="ajw ancho">${cab('Respuestas rápidas del equipo', 'Las usa todo el equipo escribiendo / en el chat.')}
    <div class="cfg"><div class="box2"><div style="display:flex;gap:8px"><input id="cfg-qrq" value="${esc(st.qrq || '')}" placeholder="Buscar por atajo o texto"><button type="button" class="btn pri" data-cfg-qrnueva="1">${I('plus')}Nueva</button></div>
      ${st.qrNueva ? `<div class="two3" style="grid-template-columns:200px 1fr auto"><input id="cfg-qrt" placeholder="Atajo, ej. precio-g"><input id="cfg-qrx" placeholder="Texto que se inserta"><button type="button" class="btn pri" data-cfg-qradd="1">${I('check')}Guardar</button></div>` : ''}
      ${L.map(([x, i]) => `<div class="row2" style="border-top:1px solid var(--line2);padding-top:8px"><span style="flex:1;min-width:0"><b style="font-weight:600">/${esc(x.t)}</b><small>${esc(x.x)}</small></span><button type="button" class="btn ic" data-cfg-qrdel="${i}" aria-label="Borrar">${I('x')}</button></div>`).join('') || `<p class="muted">${QR.length ? 'Nada coincide.' : 'Todavía no hay respuestas del equipo. Crea la primera con «Nueva».'}</p>`}</div></div></div>`; }
  if (k === 'encuesta') { const e = CFG.encuesta; return `<div class="ajw ancho">${cab('Encuesta al finalizar', 'Sale por WhatsApp al finalizar una conversación, solo dentro de las 24 horas, así no cuesta nada.')}
    <div class="two3"><div class="cfg"><div class="box2">${fila('Enviar la encuesta', '', sw('enc-on', e.on))}
      <label class="fld">Pregunta sobre el asesor, de 1 a 5<input data-cfg-in="encuesta.p1" value="${esc(e.p1)}"></label>
      <label class="fld">Pregunta de recomendación, de 0 a 10<input data-cfg-in="encuesta.p2" value="${esc(e.p2)}"></label>
      ${fila('No repetir en estos días', '', `<input class="inl" data-cfg-in="encuesta.dias" value="${e.dias}">`)}
      ${fila('Avisar al líder si la calificación es de 2 o menos', '', sw('enc-aviso', e.aviso))}</div></div>
      <div class="phone"><div class="hd">Así le llega</div><div class="bub">${esc(e.p1.replace('{{asesor}}', (AJ.corto || yo).split(' ')[0]))}<br>Muy mal · Mal · Regular · Bien · Excelente<br><br>${esc(e.p2)}<br>0 1 2 3 4 5 6 7 8 9 10<div class="tm">ahora</div></div></div></div></div>`; }
  if (k === 'recepcion') { const a = CFG.recepcion; return `<div class="ajw ancho">${cab('Atención de noche', 'El agente IA del CRM atiende las líneas fuera de horario, deja un resumen y entrega la conversación al asesor en la mañana. Cómo habla y qué sabe se configura en Agentes IA.')}
    <div class="cfg"><div class="box2">${fila('El agente IA responde de noche', '', sw('recepcion-on', a.on))}
      ${fila('Desde', '', `<input class="inl" data-cfg-in="recepcion.desde" value="${esc(a.desde)}">`)}${fila('Hasta', '', `<input class="inl" data-cfg-in="recepcion.hasta" value="${esc(a.hasta)}">`)}
      ${fila('Líneas', '', LINEAS.length ? `<div class="chips2">${LINEAS.map(l => `<button type="button" data-cfg-recepcionlin="${esc(l.id)}" aria-pressed="${a.lineas.includes(l.id)}">${esc(l.n)}</button>`).join('')}</div>` : '<span class="muted">Todavía no hay líneas conectadas</span>')}
      ${fila('Dejar resumen en nota privada', '', sw('recepcion-resumen', a.resumen))}
      ${fila('Enviar enlaces de pago', 'Pendiente de tu decisión: hoy el agente no manda enlaces, solo informa y deja al asesor el cierre', sw('recepcion-enlaces', a.enlaces))}</div></div></div>`; }
  return '';
}
function cfgTg(k){
  const C = CFG;
  const m = {'meta-ig':() => C.meta.ig = !C.meta.ig, 'meta-fb':() => C.meta.fb = !C.meta.fb, 'tg-on':() => C.telegram.on = !C.telegram.on, 'tt-on':() => C.tiktok.on = !C.tiktok.on, 'meta-comentarios':() => C.meta.comentarios = !C.meta.comentarios, 'web-on':() => C.web.on = !C.web.on, 'web-pedir':() => C.web.pedir = !C.web.pedir, 'web-horario':() => C.web.horario = !C.web.horario, 'correo-on':() => C.correo.on = C.correo.on === false, 'rep-ausente':() => C.reparto.ausente = !C.reparto.ausente, 'rep-familiares':() => C.reparto.familiares = !C.reparto.familiares, 'rep-conocido':() => C.reparto.conocido = !C.reparto.conocido, 'festivos':() => C.festivos = !C.festivos, 'enc-on':() => C.encuesta.on = !C.encuesta.on, 'enc-aviso':() => C.encuesta.aviso = !C.encuesta.aviso, 'recepcion-on':() => C.recepcion.on = !C.recepcion.on, 'recepcion-resumen':() => C.recepcion.resumen = !C.recepcion.resumen, 'recepcion-enlaces':() => C.recepcion.enlaces = !C.recepcion.enlaces};
  if (m[k]) return m[k]();
  if (k.startsWith('linea-recepcion-')) { const x = C.lineas[+k.split('-')[2]]; return x.recepcion = !x.recepcion; }
  if (k.startsWith('hor-')) { const x = C.horario[+k.split('-')[1]]; return x[3] = !x[3]; }
}
document.getElementById('page').addEventListener('click', e => {
  const t = e.target;
  const ir = t.closest('[data-ir="ajustes-crm"]'); if (ir) { e.stopImmediatePropagation(); st.pagina = 'ajustes'; st.ajTab = 'crm'; render(); return; }
  if (!st.pagina.startsWith('cfg-')) return;
  const tg = t.closest('[data-cfg-tg]'); if (tg) { const v = cfgTg(tg.dataset.cfgTg); render(); toast(v ? 'Activado' : 'Apagado'); return; }
  const cp = t.closest('[data-cfg-copiar]'); if (cp) { copiar(cp.dataset.cfgCopiar, 'Copiado'); return; }
  const ac = t.closest('[data-cfg-accion]'); if (ac) { if (crmSoloLectura()) { toast(crmErrorSoloLectura().message); return; } crmSincronizar(); toast(ac.dataset.cfgAccion); return; }
  const le = t.closest('[data-cfg-lineq]'); if (le) { const [i, eq] = le.dataset.cfgLineq.split('|'); if (!CFG.lineas[+i]) return; CFG.lineas[+i].eq = eq; render(); toast(`La línea queda con ${eq}`); return; }
  const me = t.closest('[data-cfg-metaeq]'); if (me) { const [kk, eq] = me.dataset.cfgMetaeq.split('|'); CFG.meta[kk + 'Eq'] = eq; render(); return; }
  const co = t.closest('[data-cfg-color]'); if (co) { CFG.web.color = co.dataset.cfgColor; render(); return; }
  const mt = t.closest('[data-cfg-metodo]'); if (mt) { CFG.reparto.metodo = mt.dataset.cfgMetodo; render(); toast(`Reparto: ${CFG.reparto.metodo.toLowerCase()}`); return; }
  const su = t.closest('[data-cfg-subir]'); if (su) { const i = +su.dataset.cfgSubir; [ETQ[i - 1], ETQ[i]] = [ETQ[i], ETQ[i - 1]]; render(); return; }
  const ba = t.closest('[data-cfg-bajar]'); if (ba) { const i = +ba.dataset.cfgBajar; [ETQ[i + 1], ETQ[i]] = [ETQ[i], ETQ[i + 1]]; render(); return; }
  const ed = t.closest('[data-cfg-etdel]'); if (ed) { const i = +ed.dataset.cfgEtdel; const n = ETQ[i][0]; if (CONV.some(c => c.etq.includes(n))) { toast(`No se puede: hay conversaciones en «${n}». Muévelas primero.`); return; } ETQ.splice(i, 1); render(); toast(`Etapa borrada: ${n}`); return; }
  if (t.closest('[data-cfg-etadd]')) { const n = document.getElementById('cfg-etnueva').value.trim(); if (!n) { toast('Escribe el nombre de la etapa'); return; } ETQ.push([n, '#64748b']); COL[n] = '#64748b'; render(); toast(`Etapa agregada: ${n}`); return; }
  if (t.closest('[data-cfg-qrnueva]')) { st.qrNueva = true; render(); document.getElementById('cfg-qrt').focus(); return; }
  if (t.closest('[data-cfg-qradd]')) { const a = document.getElementById('cfg-qrt').value.trim().replace(/^\//, ''), x = document.getElementById('cfg-qrx').value.trim(); if (!a || !x) { toast('Escribe el atajo y el texto'); return; } QR.unshift({t:a, x}); st.qrNueva = false; render(); toast(`Agregada /${a}`); return; }
  const qd = t.closest('[data-cfg-qrdel]'); if (qd) { const q = QR.splice(+qd.dataset.cfgQrdel, 1)[0]; render(); toast(`Borrada /${q.t}`); return; }
  const al = t.closest('[data-cfg-recepcionlin]'); if (al) { const id = al.dataset.cfgRecepcionlin; CFG.recepcion.lineas = CFG.recepcion.lineas.includes(id) ? CFG.recepcion.lineas.filter(x => x !== id) : [...CFG.recepcion.lineas, id]; render(); return; }
}, true);
document.getElementById('page').addEventListener('change', e => {
  if (!st.pagina.startsWith('cfg-')) return;
  const inp = e.target.closest('[data-cfg-in]'); if (inp) { const [a, b] = inp.dataset.cfgIn.split('.'); if (b) CFG[a][b] = inp.value; else CFG[a] = inp.value; if (st.pagina === 'cfg-web' || st.pagina === 'cfg-encuesta') render(); toast('Guardado'); return; }
  const et = e.target.closest('[data-cfg-etapa]'); if (et) { const i = +et.dataset.cfgEtapa, viejo = ETQ[i][0], nuevo = et.value.trim(); if (!nuevo) { et.value = viejo; return; } ETQ[i][0] = nuevo; COL[nuevo] = colorOk(ETQ[i][1]); CONV.forEach(c => { c.etq = c.etq.map(x => x === viejo ? nuevo : x); }); render(); toast(`Etapa renombrada: ${nuevo}`); return; }
  const h = e.target.closest('[data-cfg-hora]'); if (h) { const [i, j] = h.dataset.cfgHora.split('|'); CFG.horario[+i][+j] = h.value; toast('Horario actualizado'); }
});
document.getElementById('page').addEventListener('input', e => { if (e.target.id === 'cfg-qrq') { st.qrq = e.target.value; const pos = e.target.selectionStart; render(); const n = document.getElementById('cfg-qrq'); n.focus(); n.setSelectionRange(pos, pos); } });
// Botón para volver a Ajustes desde las páginas de etiquetas, reglas, campos e importar
const renderOrig = render;
render = function(){ renderOrig(); if (['etiquetas','reglas','campos','importar','plantillas'].includes(st.pagina) && st.desdeAjustes) { const w = document.querySelector('#page .ajw, #page'); if (w && !w.querySelector('.volver')) w.insertAdjacentHTML('afterbegin', `<button type="button" class="volver" data-ir="ajustes-crm">${I('back')}Ajustes del CRM</button>`); } };
document.getElementById('page').addEventListener('click', e => { const b = e.target.closest('[data-ir]'); if (b && b.dataset.ir !== 'ajustes-crm') st.desdeAjustes = st.pagina === 'ajustes'; }, true);

// Buscador dentro de los desplegables largos.
function buscadorEnMenus(){
  document.querySelectorAll('.menu').forEach(m => {
    if (m.hidden || m.querySelector('.msearch')) return;
    const ops = [...m.querySelectorAll(':scope > button')];
    if (ops.length <= 6) return;
    const inp = document.createElement('input'); inp.className = 'msearch'; inp.placeholder = 'Buscar…'; inp.autocomplete = 'off';
    inp.style.cssText = 'border:1px solid var(--line);border-radius:8px;padding:7px 9px;font:inherit;font-size:13px;margin:2px 2px 4px;width:calc(100% - 4px)';
    inp.addEventListener('click', e => e.stopPropagation());
    inp.addEventListener('input', () => { const q = norm(inp.value); ops.forEach(b => { b.style.display = norm(b.textContent).includes(q) ? '' : 'none'; }); });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const b = ops.find(x => x.style.display !== 'none'); if (b) b.click(); } });
    const hd = m.querySelector(':scope > .hd'); hd ? hd.after(inp) : m.prepend(inp);
    setTimeout(() => inp.focus(), 0);
  });
}
document.addEventListener('click', () => setTimeout(buscadorEnMenus, 0), true);

/* ── Flujos (25-sep) ── */
function paginaFlujos(){
  const volver = `<button type="button" class="volver" data-ir="ajustes-crm">${I('back')}Ajustes del CRM</button>`;
  const f = FLUJOS.find(x => x.id === st.flujo);
  if (!f) return `<div class="ajw ancho">${volver}<div class="pg-h"><div><h2>Flujos</h2><p class="sub">Lo que pasa antes de que el lead llegue al asesor: saludar, preguntar su nombre, mostrar opciones y pasarlo al reparto. Así el asesor lo recibe ya con su nombre.</p></div><button type="button" class="btn pri" data-fl-nuevo="1">${I('plus')}Nuevo flujo</button></div>
    <div style="display:grid;gap:10px">${FLUJOS.map(x => `<div class="rule"><div class="rh">${I('flow')}<b style="cursor:pointer" data-fl-abrir="${x.id}">${esc(x.n)}</b><span class="pill">${x.pasos.length} pasos</span><button type="button" class="tg" role="switch" data-fl-on="${x.id}" aria-checked="${x.on}" aria-label="Activar ${esc(x.n)}"></button><button type="button" class="btn" data-fl-abrir="${x.id}">${I('pen')}Editar</button></div>
      <div class="rs"><span class="k">Cuándo</span><span class="v">${esc(x.cuando)}</span><span class="k">Canales</span>${x.canales.map(c => `<span class="v">${CANALES[c].n}</span>`).join('')}</div></div>`).join('')}</div>
    <p class="muted" style="margin-top:12px">Solo corre uno a la vez: si hay dos activos con el mismo «Cuándo», gana el de arriba.</p></div>`;
  const campoPaso = (p, i) => {
    if (p.t === 'ramas') return campoRamas(p, i);
    if (p.t === 'mensaje') return `<textarea data-fl-txt="${i}">${esc(p.txt)}</textarea><p class="muted" style="margin:0">Puedes usar {{nombre}} si ya se lo preguntaste.</p>`;
    if (p.t === 'pregunta') return `<textarea data-fl-txt="${i}">${esc(p.txt)}</textarea>
      <div class="two3" style="grid-template-columns:1fr 1fr"><div class="fld">Guardar la respuesta en${ddSel('data-fl-guardar', ['Nombre del contacto','Correo','Ciudad','Producto'].map(x => [`${i}|${x}`, x]), `${i}|${esc(p.guardar)}`)}</div><div class="fld">Validar${ddSel('data-fl-validar', ['Nombre y apellido','Texto libre','Correo','Número'].map(x => [`${i}|${x}`, x]), `${i}|${esc(p.validar)}`)}</div></div>
      ${p.validar !== 'Texto libre' ? `<label class="fld">Si la respuesta no sirve, pregunta de nuevo<input data-fl-reint="${i}" value="${esc(p.reintento || '')}"></label>` : ''}`;
    if (p.t === 'botones') return `<textarea data-fl-txt="${i}">${esc(p.txt)}</textarea><div class="ops">${p.ops.map((o, j) => `<input data-fl-op="${i}|${j}" value="${esc(o)}"><button type="button" class="btn ic" data-fl-opdel="${i}|${j}" aria-label="Quitar opción" style="width:28px;height:28px;padding:0">${I('x')}</button>`).join('')}${p.ops.length < 3 ? `<button type="button" class="btn" data-fl-opadd="${i}">${I('plus')}Opción</button>` : ''}</div><p class="muted" style="margin:0">WhatsApp permite hasta 3 botones por mensaje.</p>`;
    if (p.t === 'etiqueta') return `<div class="fld">Etiqueta${ddSel('data-fl-tag', ETIQS.map(([n]) => [`${i}|${n}`, n]), `${i}|${p.tag || ''}`)}</div>`;
    if (p.t === 'asignar') return `<div class="fld">A quién${ddSel('data-fl-asig', ['Reparto automático · equipo Ventas', 'Reparto automático · equipo Recuperación de ventas', ...ASESORES].map(x => [`${i}|${x}`, x]), `${i}|${esc(p.a)}`)}</div><p class="muted" style="margin:0">Aquí termina el flujo: el asesor recibe la conversación con lo que se respondió.</p>`;
    return '';
  };
  const nombreTipo = t => ({ramas:'Pregunta que reparte por área'})[t] || (TIPOS_PASO.find(x => x[0] === t) || [, t])[1];
  return `<div class="ajw ancho"><button type="button" class="volver" data-fl-lista="1">${I('back')}Flujos</button>
    <div class="pg-h"><div><h2>${esc(f.n)}</h2><p class="sub">${f.on ? 'Activo' : 'Apagado'} · ${f.pasos.length} pasos</p></div><button type="button" class="btn pri" data-fl-guardar-todo="1">${I('check')}Guardar</button></div>
    <div class="flw"><div style="display:grid;gap:0">
      <div class="box2" style="margin-bottom:14px">
        <div class="two3" style="grid-template-columns:1fr 1fr"><label class="fld">Nombre<input data-fl-nombre="1" value="${esc(f.n)}"></label><div class="fld">Cuándo se activa${ddSel('data-fl-cuando', ['Llega el primer mensaje de un número nuevo','Llega un mensaje fuera de horario','Llega desde un anuncio'], f.cuando)}</div></div>
        <div class="fld">Canales<div class="chips2">${Object.entries(CANALES).filter(([k]) => k !== 'mail').map(([k, v]) => `<button type="button" data-fl-canal="${k}" aria-pressed="${f.canales.includes(k)}">${v.n}</button>`).join('')}</div></div>
        <div class="row2"><span>Saltar si ya es un contacto conocido<small>Si ya habló con un asesor y todavía no ha comprado, le llega directo a esa persona. Los clientes van a la lista de opciones.</small></span><button type="button" class="tg" role="switch" data-fl-saltar="1" aria-checked="${f.saltarConocidos}"></button></div>
        <div class="row2"><span>Si no responde en estos minutos, pasarlo igual al asesor<small>Para que ningún lead quede esperando en el flujo</small></span><input class="inl" data-fl-espera="1" value="${f.espera}" style="width:80px;text-align:center;border:1px solid var(--line);border-radius:9px;padding:7px"></div>
        <div class="row2"><span>Flujo activo</span><button type="button" class="tg" role="switch" data-fl-on="${f.id}" aria-checked="${f.on}"></button></div>
        ${f.atajos ? atajosHTML(f) : ''}
      </div>
      ${f.pasos.map((p, i) => `${i ? '<div class="conector"></div>' : ''}<div class="paso"><div class="ph"><span class="num">${i + 1}</span>${nombreTipo(p.t)}<span class="acc"><button type="button" class="btn ic" data-fl-subir="${i}" aria-label="Subir" ${i ? '' : 'disabled'} style="transform:rotate(90deg)">${I('back')}</button><button type="button" class="btn ic" data-fl-bajar="${i}" aria-label="Bajar" ${i < f.pasos.length - 1 ? '' : 'disabled'} style="transform:rotate(-90deg)">${I('back')}</button><button type="button" class="btn ic" data-fl-del="${i}" aria-label="Borrar paso">${I('x')}</button></span></div>${campoPaso(p, i)}</div>`).join('')}
      <div class="conector"></div>
      <div style="display:flex;justify-content:center"><div class="fld" style="width:260px">${ddSel('data-fl-add', TIPOS_PASO, '', 'Agregar un paso')}</div></div>
    </div>
    <div class="fprev">${f.atajos ? `<div class="fld">Probar como${ddSel('data-flr-esc', ESCENARIOS, st.pruebaEsc || 'nuevo')}</div>` : ''}<div class="phone"><div class="hd">Así lo vive el cliente${st.prueba ? ' · prueba' : ''}</div><div class="chatp" id="fl-chat">${chatPrueba(f)}</div></div>
      <button type="button" class="btn ${st.prueba ? '' : 'pri'}" data-fl-probar="1">${st.prueba ? 'Reiniciar la prueba' : 'Probar el flujo'}</button></div></div></div>`;
}
function textoNombre(t){ return (st.prueba && st.prueba.nombre ? st.prueba.nombre.split(' ')[0] : yo.split(' ')[0]); }
function chatPrueba(f){
  const pr = st.prueba; const out = [];
  const msg = t => `<div class="bb">${esc(t.replace(/\{\{nombre\}\}/g, textoNombre()))}</div>`;
  if (!pr) {
    out.push(`<div class="bb yo">Hola, quiero información</div>`);
    for (const p of f.pasos) {
      if (p.t === 'mensaje') out.push(msg(p.txt));
      if (p.t === 'pregunta') { out.push(msg(p.txt)); out.push(`<div class="bb yo">${p.guardar === 'Nombre del contacto' ? esc(yo) : 'Mi respuesta'}</div>`); }
      if (p.t === 'botones') { out.push(msg(p.txt)); out.push(`<div class="opsb">${p.ops.map(o => `<button type="button" disabled>${esc(o)}</button>`).join('')}</div>`); }
      if (p.t === 'etiqueta') out.push(`<div class="bb ev">Se le pone la etiqueta «${esc(p.tag || '—')}»</div>`);
      if (p.t === 'asignar') out.push(`<div class="bb ev">Pasa a ${esc(p.a.replace(/^Reparto/, 'reparto'))}, con su nombre</div>`);
    }
    return out.join('');
  }
  out.push(`<div class="bb yo">Hola, quiero información</div>`);
  let i = 0;
  for (; i < f.pasos.length; i++) {
    const p = f.pasos[i];
    if (p.t === 'mensaje') { out.push(msg(p.txt)); continue; }
    if (p.t === 'etiqueta') { out.push(`<div class="bb ev">Etiqueta «${esc(p.tag || '—')}»</div>`); continue; }
    if (p.t === 'asignar') { out.push(`<div class="bb ev">Pasó a ${esc(p.a.replace(/^Reparto/, 'reparto'))}${pr.nombre ? ` como «${esc(pr.nombre)}»` : ''}. Fin del flujo.</div>`); break; }
    if (p.t === 'pregunta' || p.t === 'botones') {
      out.push(msg(p.txt)); const r = pr.resp[i];
      if (r && r.error) out.push(`<div class="bb yo">${esc(r.v)}</div>${msg(p.reintento || 'No te entendí, ¿me lo repites?')}`);
      if (r && r.ok) { out.push(`<div class="bb yo">${esc(r.v)}</div>`); continue; }
      if (p.t === 'botones') out.push(`<div class="opsb">${p.ops.map(o => `<button type="button" data-fl-resp="${i}|${esc(o)}">${esc(o)}</button>`).join('')}</div>`);
      else out.push(`<div class="resp"><input id="fl-in" data-fl-paso="${i}" placeholder="Escribe como si fueras el cliente"><button type="button" class="btn pri" data-fl-enviar="${i}">${I('send')}</button></div>`);
      break;
    }
  }
  return out.join('');
}
function responderPrueba(i, v){
  const f = FLUJOS.find(x => x.id === st.flujo); const p = f.pasos[i]; v = v.trim(); if (!v) return;
  let ok = true;
  if (p.t === 'pregunta') {
    if (p.validar === 'Nombre y apellido') ok = v.split(/\s+/).filter(w => /^[\p{L}'-]{2,}$/u.test(w)).length >= 2;
    if (p.validar === 'Correo') ok = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v);
    if (p.validar === 'Número') ok = /^\d[\d\s]*$/.test(v);
  }
  if (!ok && !(st.prueba.resp[i] && st.prueba.resp[i].error)) { st.prueba.resp[i] = {v, error:true}; }
  else { st.prueba.resp[i] = {v, ok:true}; if (p.guardar === 'Nombre del contacto') st.prueba.nombre = v.replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase()); }
  render(); const n = document.getElementById('fl-in'); if (n) n.focus();
}
document.getElementById('page').addEventListener('click', e => {
  if (st.pagina !== 'flujos') return;
  const t = e.target; const f = FLUJOS.find(x => x.id === st.flujo);
  const ab = t.closest('[data-fl-abrir]'); if (ab) { st.flujo = ab.dataset.flAbrir; st.prueba = null; render(); return; }
  if (t.closest('[data-fl-lista]')) { st.flujo = null; st.prueba = null; render(); return; }
  const on = t.closest('[data-fl-on]'); if (on) { const x = FLUJOS.find(y => y.id === on.dataset.flOn); x.on = !x.on; render(); toast(`${x.n}: ${x.on ? 'activo' : 'apagado'}`); return; }
  if (t.closest('[data-fl-nuevo]')) { const id = 'f' + FLUJOS.length; FLUJOS.push({id, n:'Flujo nuevo', on:false, cuando:'Llega el primer mensaje de un número nuevo', canales:['wa'], saltarConocidos:true, espera:10, pasos:[{t:'mensaje', txt:'¡Hola! Gracias por escribirnos.'}, {t:'asignar', a:'Reparto automático · equipo Ventas'}]}); st.flujo = id; render(); return; }
  if (!f) return;
  const g = (attr, fn) => { const b = t.closest(`[${attr}]`); if (!b) return false; fn(b.getAttribute(attr)); render(); return true; };
  if (g('data-fl-guardar', v => { const [i, x] = v.split('|'); f.pasos[+i].guardar = x; })) return;
  if (g('data-fl-validar', v => { const [i, x] = v.split('|'); f.pasos[+i].validar = x; })) return;
  if (g('data-fl-tag', v => { const [i, x] = v.split('|'); f.pasos[+i].tag = x; })) return;
  if (g('data-fl-asig', v => { const [i, x] = v.split('|'); f.pasos[+i].a = x; })) return;
  if (g('data-fl-cuando', v => { f.cuando = v; })) return;
  if (g('data-fl-canal', v => { f.canales = f.canales.includes(v) ? f.canales.filter(c => c !== v) : [...f.canales, v]; })) return;
  if (g('data-fl-saltar', () => { f.saltarConocidos = !f.saltarConocidos; })) return;
  if (g('data-fl-subir', v => { const i = +v; [f.pasos[i - 1], f.pasos[i]] = [f.pasos[i], f.pasos[i - 1]]; })) return;
  if (g('data-fl-bajar', v => { const i = +v; [f.pasos[i + 1], f.pasos[i]] = [f.pasos[i], f.pasos[i + 1]]; })) return;
  if (g('data-fl-del', v => { f.pasos.splice(+v, 1); toast('Paso borrado'); })) return;
  if (g('data-fl-opadd', v => { f.pasos[+v].ops.push('Opción nueva'); })) return;
  if (g('data-fl-opdel', v => { const [i, j] = v.split('|').map(Number); f.pasos[i].ops.splice(j, 1); })) return;
  if (g('data-fl-add', v => { const n = {mensaje:{t:'mensaje', txt:''}, pregunta:{t:'pregunta', txt:'', guardar:'Ciudad', validar:'Texto libre'}, botones:{t:'botones', txt:'', ops:['Opción 1','Opción 2']}, etiqueta:{t:'etiqueta', tag:(ETIQS[0] || [''])[0]}, asignar:{t:'asignar', a:'Reparto automático · equipo Ventas'}}[v]; const k = f.pasos.findIndex(p => p.t === 'asignar' || p.t === 'ramas'); if (k >= 0 && v !== 'asignar') f.pasos.splice(k, 0, n); else f.pasos.push(n); toast(`Paso agregado: ${TIPOS_PASO.find(x => x[0] === v)[1]}`); })) return;
  if (t.closest('[data-fl-probar]')) { st.prueba = {resp:{}, nombre:''}; render(); const n = document.getElementById('fl-in'); if (n) n.focus(); return; }
  const en = t.closest('[data-fl-enviar]'); if (en) { responderPrueba(+en.dataset.flEnviar, document.getElementById('fl-in').value); return; }
  const rb = t.closest('[data-fl-resp]'); if (rb) { const [i, v] = rb.dataset.flResp.split('|'); responderPrueba(+i, v); return; }
  if (t.closest('[data-fl-guardar-todo]')) { crmSincronizar(); toast(`Flujo «${f.n}» guardado${f.on ? ' y activo' : ''}`); return; }
}, true);
document.getElementById('page').addEventListener('keydown', e => { if (e.target.id === 'fl-in' && e.key === 'Enter') { e.preventDefault(); responderPrueba(+e.target.dataset.flPaso, e.target.value); } });
document.getElementById('page').addEventListener('change', e => {
  if (st.pagina !== 'flujos') return; const f = FLUJOS.find(x => x.id === st.flujo); if (!f) return; const t = e.target;
  if (t.dataset.flTxt !== undefined) { f.pasos[+t.dataset.flTxt].txt = t.value; render(); }
  else if (t.dataset.flReint !== undefined) { f.pasos[+t.dataset.flReint].reintento = t.value; }
  else if (t.dataset.flOp !== undefined) { const [i, j] = t.dataset.flOp.split('|').map(Number); f.pasos[i].ops[j] = t.value; render(); }
  else if (t.dataset.flNombre !== undefined) { f.n = t.value.trim() || f.n; render(); }
  else if (t.dataset.flEspera !== undefined) { f.espera = +t.value || f.espera; }
});


/* ── Contactos (25-sep): base de todas las personas, al estilo de respond.io pero con nuestros datos ── */
// Las etapas salen de ETQ (Ajustes > Etapas); estas tres se muestran aparte como perdidas.
const ETAPAS_PERDIDAS_BASE = ['No interesado/perdido','Sin respuesta','Link errado'];
const etapasPerdidas = () => nombresEtapas().filter(n => ETAPAS_PERDIDAS_BASE.includes(n));
const etapasActivas = () => nombresEtapas().filter(n => !ETAPAS_PERDIDAS_BASE.includes(n));
const ctFecha = dias => { if (dias === 0) return 'Hoy'; if (dias === 1) return 'Ayer'; const p = hcPartes(Date.now() - dias * 864e5); return `${p.d} ${['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][p.m]}`; };
// Personas sin conversación: llegan del API (contactos de GET /crm/inicio) con id = 1e9 + contactoId.
const CT_EXTRA = [];
function ctDe(c){
  return {id:c.id, conv:true, contactoId:c.contactoId, n:c.n, tel:c.tel, correo:c.ficha.correo || '', canal:c.canal, etapa:c.etq[0], asig:c.asig, producto:(c.campos && c.campos.producto) || '', empresa:(c.campos && c.campos.empresa) || '',
    ciudad:c.ficha.ciudad || '', origen:c.pauta ? `Anuncio de ${c.pauta.plataforma}` : c.ficha.origen, anuncio:!!c.pauta, tags:c.tags,
    cuotas:c.ficha.compras && c.ficha.compras.total ? [c.ficha.compras.pagadas, c.ficha.compras.total] : c.ficha.compras ? [1,1] : null,
    ultimoDias:c._t ? hcDias(c._t.ultimo || c._t.creado || Date.now()) : 0, agregadoDias:c._t ? hcDias(c._t.creado || Date.now()) : 0, guardado:c.guardado, noContactar:!!c.noContactar, spam:c.spam || null};
}
function ctTodos(){ return [...ultimasConv().map(ctDe), ...CT_EXTRA.map(x => ({...x, guardado:true, compro:!!x.cuotas}))].map(x => ({...x, compro:!!x.cuotas})); }
const SEGMENTOS = [
  {id:'nuevos', n:'Nuevos esta semana', f:c => c.agregadoDias <= 7},
  {id:'inactivos', n:'Sin mensajes hace más de 30 días', f:c => c.ultimoDias > 30},
  {id:'anuncio', n:'Vienen de un anuncio', f:c => c.anuncio},
  {id:'compraron', n:'Ya compraron', f:c => c.compro},
];
const CT_FILTROS = [
  ['etapa','Etapa', () => [...etapasActivas(), ...etapasPerdidas()]],
  ['asig','Asesor', () => ['Sin asignar', ...ASESORES]],
  ['producto','Producto', () => [...CATALOGO.map(x => x.p), ...FALTANTES]],
  ['origen','Origen', () => ['Anuncio', 'Enlace de venta de un asesor', 'Chat de la web', 'Correo', 'Otro']],
  ['canal','Canal', () => Object.keys(CANALES)],
  ['tag','Etiqueta', () => ETIQS.map(([n]) => n)],
  ['cuotas','Cuotas', () => ['Con cuotas pendientes','Al día','Sin compras']],
];
const etiquetaFiltro = (k, v) => k === 'canal' ? CANALES[v].n : v;
const origenDe = c => c.anuncio ? 'Anuncio' : /enlace de venta/i.test(c.origen) ? 'Enlace de venta de un asesor' : /web/i.test(c.origen) ? 'Chat de la web' : /Correo/.test(c.origen) ? 'Correo' : 'Otro';
function pasaFiltros(c, f){
  if (f.etapa && c.etapa !== f.etapa) return false;
  if (f.asig && (f.asig === 'Sin asignar' ? c.asig : c.asig !== f.asig)) return false;
  if (f.producto && c.producto !== f.producto) return false;
  if (f.origen && origenDe(c) !== f.origen) return false;
  if (f.canal && c.canal !== f.canal) return false;
  if (f.tag && !c.tags.includes(f.tag)) return false;
  if (f.cuotas === 'Con cuotas pendientes' && !(c.cuotas && c.cuotas[0] < c.cuotas[1])) return false;
  if (f.cuotas === 'Al día' && !(c.cuotas && c.cuotas[0] >= c.cuotas[1])) return false;
  if (f.cuotas === 'Sin compras' && c.cuotas) return false;
  return true;
}
const CT_COLS = [['etapa','Etapa'],['asig','Asesor'],['producto','Producto'],['empresa','Empresa'],['ciudad','Ciudad'],['origen','Origen'],['tags','Etiquetas'],['cuotas','Cuotas'],['ultimo','Último mensaje'],['agregado','Agregado']];
st.ct = {vista:'todos', q:'', f:{}, orden:{k:'ultimo', dir:1}, sel:new Set(), cols:new Set(CT_COLS.map(c => c[0])), filtrosAbiertos:false, propios:[]};
const segDe = id => SEGMENTOS.find(s => s.id === id) || st.ct.propios.find(s => s.id === id);
function ctVisibles(){
  const ct = st.ct, q = norm(ct.q.trim());
  let L = ctTodos();
  if (ct.vista.startsWith('seg:') && !segDe(ct.vista.slice(4))) ct.vista = 'todos';
  if (ct.vista.startsWith('etapa:') && !(ct.vista.slice(6) in COL)) ct.vista = 'todos';
  const v = ct.vista;
  // Lo marcado como spam (lote 7) solo sale en su vista.
  if (v === 'spam') L = L.filter(c => c.spam); else L = L.filter(c => !c.spam);
  if (v === 'spam') { /* ya filtrado */ }
  else if (v === 'todos') L = L.filter(c => c.guardado !== false && !c.noContactar);
  else if (v === 'sinagregar') L = L.filter(c => c.guardado === false);
  else if (v === 'nocontactar') L = L.filter(c => c.noContactar);
  else if (v.startsWith('etapa:')) L = L.filter(c => c.etapa === v.slice(6) && !c.noContactar);
  else if (v.startsWith('seg:')) { const s = segDe(v.slice(4)); L = L.filter(c => c.guardado !== false && !c.noContactar && (s.f ? s.f(c) : pasaFiltros(c, s.filtros) && (!s.q || norm(c.n + ' ' + c.tel + ' ' + c.correo).includes(norm(s.q))))); }
  L = L.filter(c => pasaFiltros(c, ct.f));
  if (q) L = L.filter(c => norm(c.n + ' ' + c.tel + ' ' + c.correo + ' ' + c.ciudad).includes(q) || String(c.numero) === q.replace(/^(n\.?\s*º?\s*|#|cliente\s*)/, '').trim());
  const o = ct.orden;
  // Lo recién agregado a mano va primero entre los del mismo día.
  const val = c => o.k === 'n' ? norm(c.n) : o.k === 'agregado' ? c.agregadoDias - (c.recien ? c.recien / 1e14 : 0) : c.ultimoDias - (c.recien ? c.recien / 1e14 : 0);
  return L.sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * o.dir);
}
function paginaContactos(){
  const el = document.getElementById('page'), ct = st.ct;
  const todos = ctTodos(), L = ctVisibles();
  const cuentaV = f => todos.filter(c => !c.spam && f(c)).length;
  const item = (v, label, n, extra = '') => `<button type="button" class="ctn ${ct.vista === v ? 'on' : ''}" data-ctv="${esc(v)}">${extra}<span>${esc(label)}</span><em>${n}</em></button>`;
  const nf = Object.values(ct.f).filter(Boolean).length;
  const titulo = ct.vista === 'todos' ? 'Todos los contactos' : ct.vista === 'sinagregar' ? 'Leads sin agregar' : ct.vista === 'nocontactar' ? 'No contactar' : ct.vista === 'spam' ? 'Spam' : ct.vista.startsWith('etapa:') ? ct.vista.slice(6) : segDe(ct.vista.slice(4)).n;
  const col = k => ct.cols.has(k);
  const flecha = k => ct.orden.k === k ? `<span class="ord">${ct.orden.dir === 1 ? '▲' : '▼'}</span>` : `<span class="ord gris">▲▼</span>`;
  const todosSel = L.length > 0 && L.every(c => ct.sel.has(c.id));
  const selN = [...ct.sel].filter(id => todos.some(c => c.id === id)).length;
  el.innerHTML = `<div class="ctw">
    <aside class="cts">
      <div class="cts-h"><b>Contactos</b></div>
      ${item('todos', 'Todos', cuentaV(c => c.guardado !== false && !c.noContactar), I('users'))}
      ${item('sinagregar', 'Leads sin agregar', cuentaV(c => c.guardado === false), I('user-plus'))}
      <div class="cts-sec">Etapas activas</div>
      ${etapasActivas().map(e => item('etapa:' + e, e, cuentaV(c => c.etapa === e && !c.noContactar), `<span class="dot" style="background:${COL[e]}"></span>`)).join('')}
      <div class="cts-sec">Etapas perdidas</div>
      ${etapasPerdidas().map(e => item('etapa:' + e, e, cuentaV(c => c.etapa === e && !c.noContactar), `<span class="dot" style="background:${COL[e]}"></span>`)).join('')}
      <div class="cts-sec" style="display:flex;align-items:center;justify-content:space-between">Segmentos<button type="button" id="ct-nuevo-seg" style="display:inline-flex;align-items:center;gap:4px;border:0;background:none;padding:2px 4px;border-radius:6px;font:inherit;font-size:12px;font-weight:600;color:var(--blue-ink);cursor:pointer">${I('plus')}Nuevo</button></div>
      ${SEGMENTOS.map(s => item('seg:' + s.id, s.n, cuentaV(c => c.guardado !== false && !c.noContactar && s.f(c)), I('filter'))).join('')}
      ${ct.propios.map(s => `<div class="ctn-w">${item('seg:' + s.id, s.n, cuentaV(c => c.guardado !== false && !c.noContactar && pasaFiltros(c, s.filtros)), I('star'))}<button type="button" class="ctn-x" data-ct-segdel="${s.id}" aria-label="Borrar segmento">${I('x')}</button></div>`).join('')}
      <div class="cts-sep"></div>
      ${item('nocontactar', 'No contactar', cuentaV(c => c.noContactar && !c.spam), I('block'))}
      ${item('spam', 'Spam', todos.filter(c => c.spam).length, I('shield-x'))}
    </aside>
    <section class="ctm">
      <div class="pg-h"><div><h2>${esc(titulo)}</h2><p class="sub">${L.length} ${L.length === 1 ? 'persona' : 'personas'}${ct.vista === 'sinagregar' ? ' que escribieron y el asesor todavía no agrega' : ''}</p></div>
        <div class="dd" style="position:relative"><div class="split"><button type="button" class="btn pri" id="ct-nuevo">${I('plus')}Agregar contacto</button><button type="button" class="btn pri ic" id="ct-mas-b" aria-label="Más opciones" aria-haspopup="menu">${I('chev')}</button></div>
          <div class="menu" id="ct-mas" hidden>${st.rol === 'l' ? `<button type="button" data-ct-acc="importar">${I('file')}Importar desde Excel</button>` : ''}<button type="button" data-ct-acc="exportar">${I('share')}Exportar esta lista a Excel</button></div></div>
      </div>
      <div class="ctbar">
        <label class="search ctq">${I('search')}<input id="ct-q" type="search" placeholder="Buscar por nombre, teléfono, correo o ciudad" value="${esc(ct.q)}" autocomplete="off"></label>
        <button type="button" class="btn ${ct.filtrosAbiertos || nf ? 'on' : ''}" id="ct-filtros">${I('filter')}Filtros${nf ? `<span class="cnt">${nf}</span>` : ''}</button>
        ${nf || ct.q.trim() ? `<button type="button" class="btn" id="ct-guardar-seg">${I('star')}Guardar como segmento</button>` : ''}
        <div class="dd" style="position:relative;margin-left:auto"><button type="button" class="btn" id="ct-cols-b" aria-haspopup="menu">${I('kanban')}Columnas</button>
          <div class="menu" id="ct-cols" hidden><div class="hd">Columnas que se ven</div>${CT_COLS.map(([k, n]) => `<button type="button" data-ct-col="${k}" role="menuitemcheckbox" aria-checked="${col(k)}"><span class="chk ${col(k) ? 'on' : ''}">${col(k) ? I('check') : ''}</span>${n}</button>`).join('')}</div></div>
      </div>
      ${ct.filtrosAbiertos ? `<div class="ctf">${CT_FILTROS.map(([k, n, ops]) => `<div class="fld">${n}${ddSel('data-ctf', [['' + k + '::', 'Cualquiera'], ...ops().map(v => [k + '::' + v, etiquetaFiltro(k, v)])], k + '::' + (ct.f[k] || ''), 'Cualquiera')}</div>`).join('')}</div>` : ''}
      ${nf ? `<div class="fchips">${Object.entries(ct.f).filter(([, v]) => v).map(([k, v]) => `<span class="fchip">${esc(CT_FILTROS.find(x => x[0] === k)[1])}: ${esc(etiquetaFiltro(k, v))}<button type="button" data-ct-quitar="${k}" aria-label="Quitar filtro">${I('x')}</button></span>`).join('')}<button type="button" class="fclear" data-ct-quitar="todo">Quitar todos</button></div>` : ''}
      ${selN ? `<div class="ctsel"><b>${selN} ${selN === 1 ? 'seleccionado' : 'seleccionados'}</b>
        <div class="fld">${ddSel('data-ctb-asig', ASESORES.map(a => [a, a]), '', 'Asignar a')}</div>
        <div class="fld">${ddSel('data-ctb-etapa', [...etapasActivas(), ...etapasPerdidas()].map(e => [e, e]), '', 'Cambiar etapa')}</div>
        <div class="fld">${ddSel('data-ctb-tag', ETIQS.map(([n]) => [n, n]), '', 'Agregar etiqueta')}</div>
        <button type="button" class="btn" data-ct-acc="difusion">${I('megaphone')}Enviar difusión</button>
        <button type="button" class="btn" data-ct-acc="exportar-sel">${I('share')}Exportar</button>
        <button type="button" class="btn" data-ct-acc="nocontactar-sel">${I('block')}No contactar</button>
        <button type="button" class="btn ic" data-ct-acc="limpiar-sel" aria-label="Quitar la selección">${I('x')}</button></div>` : ''}
      <div class="ctt-w"><table class="ctt"><thead><tr>
        <th class="cb"><button type="button" class="chk ${todosSel ? 'on' : ''}" data-ct-todos="1" aria-label="Seleccionar todos">${todosSel ? I('check') : ''}</button></th>
        <th class="nm"><button type="button" data-ct-ord="n">Nombre ${flecha('n')}</button></th>
        ${col('etapa') ? '<th>Etapa</th>' : ''}${col('asig') ? '<th>Asesor</th>' : ''}${col('producto') ? '<th>Producto</th>' : ''}${col('empresa') ? '<th>Empresa</th>' : ''}${col('ciudad') ? '<th>Ciudad</th>' : ''}${col('origen') ? '<th>Origen</th>' : ''}${col('tags') ? '<th>Etiquetas</th>' : ''}${col('cuotas') ? '<th>Cuotas</th>' : ''}
        ${col('ultimo') ? `<th><button type="button" data-ct-ord="ultimo">Último mensaje ${flecha('ultimo')}</button></th>` : ''}${col('agregado') ? `<th><button type="button" data-ct-ord="agregado">Agregado ${flecha('agregado')}</button></th>` : ''}
        <th class="ac"></th></tr></thead><tbody>
        ${L.length ? L.map(c => `<tr data-ct-fila="${c.id}" class="${ct.sel.has(c.id) ? 'sel' : ''}">
          <td class="cb"><button type="button" class="chk ${ct.sel.has(c.id) ? 'on' : ''}" data-ct-sel="${c.id}" aria-label="Seleccionar ${esc(c.n)}">${ct.sel.has(c.id) ? I('check') : ''}</button></td>
          <td class="nm"><span class="av" style="background:${AVC[c.id % AVC.length]}">${esc(ini(c.n))}<span class="ch">${I(CANALES[c.canal].ic)}</span></span><span class="nmt"><b>${esc(c.n)}</b><small>${esc(c.tel)}${c.guardado === false ? ' · sin agregar' : ''}</small></span></td>
          ${col('etapa') ? `<td><span class="lbl"><i style="background:${COL[c.etapa]}"></i>${esc(c.etapa)}</span></td>` : ''}
          ${col('asig') ? `<td>${c.asig ? esc(c.asig) : '<span class="gris">Sin asignar</span>'}</td>` : ''}
          ${col('producto') ? `<td class="prod">${c.producto ? esc(c.producto) : '<span class="gris">—</span>'}</td>` : ''}
          ${col('empresa') ? `<td>${c.empresa ? esc(c.empresa) : '<span class="gris">—</span>'}</td>` : ''}
          ${col('ciudad') ? `<td>${esc(c.ciudad)}</td>` : ''}
          ${col('origen') ? `<td>${esc(c.origen)}</td>` : ''}
          ${col('tags') ? `<td>${c.tags.length ? c.tags.map(t => `<span class="tagx"><i style="background:${ETIQ_COL[t]}"></i>${esc(t)}</span>`).join(' ') : '<span class="gris">—</span>'}</td>` : ''}
          ${col('cuotas') ? `<td>${c.cuotas ? (c.cuotas[0] < c.cuotas[1] ? `<span class="cuo pend">${c.cuotas[0]} de ${c.cuotas[1]}</span>` : `<span class="cuo ok">Al día</span>`) : '<span class="gris">Sin compras</span>'}</td>` : ''}
          ${col('ultimo') ? `<td class="num">${esc(ctFecha(c.ultimoDias))}</td>` : ''}
          ${col('agregado') ? `<td class="num">${esc(ctFecha(c.agregadoDias))}</td>` : ''}
          <td class="ac"><div class="dd" style="position:relative"><button type="button" class="btn ic sm" data-ct-menu="${c.id}" aria-label="Acciones">${I('more')}</button>
            <div class="menu" data-ct-menu-de="${c.id}" hidden>
              ${c.conv ? `<button type="button" data-ct-abrir="${c.id}">${I('chat')}Abrir conversación</button>` : `<button type="button" data-ct-escribir="${c.id}">${I('wa')}Escribir por WhatsApp</button>`}
              <button type="button" data-ct-ficha="${c.id}">${I('user')}Ver ficha</button>
              ${c.guardado === false ? `<button type="button" data-ct-agregar="${c.id}">${I('user-plus')}Agregar a contactos</button>` : ''}
              ${c.spam ? `<button type="button" data-ct-nospam="${c.id}">${I('shield-x')}Sacar de spam</button>` : `<button type="button" data-ct-nocont="${c.id}">${I('block')}${c.noContactar ? 'Quitar de no contactar' : 'Marcar no contactar'}</button>`}
            </div></div></td>
        </tr>`).join('') : `<tr><td colspan="14" class="vacio"><b>Nadie coincide</b><span>${nf || ct.q.trim() ? 'Prueba quitando algún filtro o cambiando la búsqueda.' : 'Todavía no hay personas en esta lista.'}</span>${nf ? '<button type="button" class="btn" data-ct-quitar="todo">Quitar filtros</button>' : ''}</td></tr>`}
      </tbody></table></div>
    </section></div>`;
}
// Cambia el dato en la conversación o en el contacto sin conversación.
function ctCambiar(id, fn){
  const cv = CONV.find(x => x.id === id);
  if (cv) { const o = {etapa:cv.etq[0], asig:cv.asig, tags:cv.tags, noContactar:!!cv.noContactar, guardado:cv.guardado}; fn(o); cv.etq = [o.etapa, ...cv.etq.slice(1).filter(e => e !== o.etapa)].filter(Boolean); cv.asig = o.asig; cv.tags = o.tags; cv.noContactar = o.noContactar ? (cv.noContactar || `marcado desde Contactos · ${(p => `${p.d} ${HC_MES[p.m]}`)(hcPartes(Date.now()))}`) : null; cv.guardado = o.guardado; return; }
  const x = CT_EXTRA.find(y => y.id === id); if (x) fn(x);
}
function descargarCsv(filas, nombre){
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const cols = ['Nombre','Teléfono','Correo','Etapa','Asesor','Producto','Empresa','Ciudad','Origen','Etiquetas','No contactar'];
  const csv = '﻿' + [cols.join(';'), ...filas.map(c => [c.n, c.tel, c.correo, c.etapa, c.asig || '', c.producto, c.empresa, c.ciudad, c.origen, (c.tags || []).join(', '), c.noContactar ? 'Sí' : ''].map(q).join(';'))].join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8'})); const a = document.createElement('a'); a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function ctFicha(id){
  const c = ctTodos().find(x => x.id === id); if (!c) return;
  const fila = (k, v) => v ? `<div class="kvr"><span>${k}</span><b>${esc(v)}</b></div>` : '';
  abrirDialogo(`<h3>${esc(c.n)}</h3><div class="kvl">${fila('Teléfono', c.tel)}${fila('Correo', c.correo)}${fila('Canal', CANALES[c.canal].n)}${fila('Etapa', c.etapa)}${fila('Asesor', c.asig || 'Sin asignar')}${fila('Producto', c.producto)}${fila('Empresa', c.empresa)}${fila('Ciudad', c.ciudad)}${fila('Origen', c.origen)}${fila('Cuotas', c.cuotas ? `${c.cuotas[0]} de ${c.cuotas[1]} pagadas` : 'Sin compras')}${fila('Último mensaje', ctFecha(c.ultimoDias))}</div>
    <div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cerrar</button>${c.conv ? `<button type="button" class="btn pri" data-ct-abrir="${c.id}">${I('chat')}Abrir conversación</button>` : `<button type="button" class="btn pri" data-ct-escribir="${c.id}">${I('wa')}Escribir por WhatsApp</button>`}</div>`);
}
function ctAbrirConv(id){ cerrarDialogo(); st.sel = id; st.vista = 'todas'; st.pagina = ''; st.carpeta = st.equipo = st.etq = st.linea = st.q = ''; st.menciones = false; st.est = 'abiertas'; document.getElementById('q').value = ''; render(); }
function ctEscribir(id){ const c = CONV.find(x => x.id === id) || CT_EXTRA.find(x => x.id === id); cerrarDialogo(); nmAbrir(); if (c) nmElegir(c); }
function ctNuevo(){
  abrirDialogo(`<h3>Agregar contacto</h3><div class="frm">
    <label>Nombre y apellido<input id="ctn-n" placeholder="Ej. Valentina Ruiz"></label>
    <div class="two3" style="grid-template-columns:1fr 1fr"><label>Celular<input id="ctn-tel" inputmode="tel" placeholder="+57 300 123 4567"></label><label>Correo<input id="ctn-mail" type="email" placeholder="correo@ejemplo.com"></label></div>
    <div class="two3" style="grid-template-columns:1fr 1fr"><div class="fld">Etapa${ddSel('data-ctn-etapa', [...etapasActivas(), ...etapasPerdidas()].map(e => [e, e]), st.ctNuevo.etapa)}</div><div class="fld">Asesor${ddSel('data-ctn-asig', ASESORES.map(a => [a, a]), st.ctNuevo.asig, 'Sin asignar')}</div></div>
    <div class="two3" style="grid-template-columns:1fr 1fr"><div class="fld">Producto de interés${ddSel('data-ctn-prod', [...CATALOGO.map(x => x.p), ...FALTANTES].map(p => [p, p]), st.ctNuevo.producto, 'Elige un producto')}</div><label>Ciudad<input id="ctn-ciudad" placeholder="Ej. Bucaramanga"></label></div>
    </div><div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" data-ct-guardar-nuevo="1">${I('check')}Agregar</button></div>`);
}
function ctImportar(){
  abrirDialogo(`<h3>Importar contactos desde Excel</h3><p>Sube un Excel o CSV con estas columnas: nombre, celular, correo, ciudad, producto, etapa y asesor. Solo nombre y celular son obligatorios. Si el celular ya existe, se actualiza en vez de duplicarse.</p>
    <label class="drop" id="ct-imp-drop">${I('file')}<span id="ct-imp-t">Toca para elegir el archivo</span><input type="file" id="ct-imp-f" accept=".xlsx,.xls,.csv" hidden></label>
    <div id="ct-imp-res" hidden class="aud"><b></b><span></span></div>
    <div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" id="ct-imp-go" disabled>${I('check')}Importar</button></div>`);
}
function ctGuardarSegmento(){
  const ct = st.ct, partes = Object.entries(ct.f).filter(([, v]) => v).map(([k, v]) => `${CT_FILTROS.find(x => x[0] === k)[1]}: ${etiquetaFiltro(k, v)}`);
  abrirDialogo(`<h3>Guardar como segmento</h3><p>Queda en la barra de la izquierda y se actualiza solo: quien cumpla estos filtros entra y quien deje de cumplirlos sale. También lo puedes usar como público de una difusión.</p>
    <div class="fchips" style="padding:0">${partes.map(p => `<span class="fchip" style="padding-right:10px">${esc(p)}</span>`).join('')}${ct.q.trim() ? `<span class="fchip" style="padding-right:10px">Búsqueda: ${esc(ct.q.trim())}</span>` : ''}</div>
    <div class="frm"><label>Nombre del segmento<input id="ct-seg-n" placeholder="Ej. Interesados en Medicina de Bucaramanga" value="${esc(partes.join(' · ').slice(0, 60))}"></label></div>
    <div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" data-ct-seg-ok="1">${I('check')}Guardar segmento</button></div>`);
}
st.ctNuevo = {etapa:'Nuevo lead', asig:'', producto:''};
document.getElementById('page').addEventListener('click', e => {
  if (st.pagina !== 'contactos') return;
  const t = e.target, ct = st.ct;
  const menuB = t.closest('[data-ct-menu]');
  document.querySelectorAll('[data-ct-menu-de],#ct-mas,#ct-cols').forEach(m => { const dueño = m.previousElementSibling; if (!menuB || m !== menuB.nextElementSibling) if (!(t.closest('#ct-mas-b') && m.id === 'ct-mas') && !(t.closest('#ct-cols-b, #ct-cols') && m.id === 'ct-cols')) m.hidden = true; });
  if (menuB) { const m = menuB.nextElementSibling; m.hidden = !m.hidden; return; }
  if (t.closest('#ct-mas-b')) { const m = document.getElementById('ct-mas'); m.hidden = !m.hidden; return; }
  if (t.closest('#ct-cols-b')) { const m = document.getElementById('ct-cols'); m.hidden = !m.hidden; return; }
  const cb = t.closest('[data-ct-col]'); if (cb) { const k = cb.dataset.ctCol; ct.cols.has(k) ? ct.cols.delete(k) : ct.cols.add(k); render(); document.getElementById('ct-cols').hidden = false; return; }
  const v = t.closest('[data-ctv]'); if (v) { ct.vista = v.dataset.ctv; ct.sel.clear(); render(); return; }
  const sd = t.closest('[data-ct-segdel]'); if (sd) { const s = ct.propios.find(x => x.id === sd.dataset.ctSegdel); ct.propios = ct.propios.filter(x => x !== s); if (ct.vista === 'seg:' + s.id) ct.vista = 'todos'; render(); toast(`Segmento «${s.n}» borrado`); return; }
  if (t.closest('#ct-filtros')) { ct.filtrosAbiertos = !ct.filtrosAbiertos; render(); return; }
  const f = t.closest('[data-ctf]'); if (f) { const [k, val] = f.dataset.ctf.split('::'); ct.f[k] = val; ct.sel.clear(); render(); return; }
  const qt = t.closest('[data-ct-quitar]'); if (qt) { if (qt.dataset.ctQuitar === 'todo') ct.f = {}; else delete ct.f[qt.dataset.ctQuitar]; render(); return; }
  if (t.closest('#ct-guardar-seg')) { ctGuardarSegmento(); return; }
  // «+ Nuevo» en Segmentos (6-oct): abre los filtros; con alguno puesto sale «Guardar como segmento».
  if (t.closest('#ct-nuevo-seg')) { st.ct.vista = 'todos'; st.ct.filtrosAbiertos = true; render(); toast('Elige los filtros y toca «Guardar como segmento»'); return; }
  if (t.closest('#ct-nuevo')) { st.ctNuevo = {etapa:'Nuevo lead', asig:'', producto:''}; ctNuevo(); return; }
  const o = t.closest('[data-ct-ord]'); if (o) { const k = o.dataset.ctOrd; ct.orden = ct.orden.k === k ? {k, dir:-ct.orden.dir} : {k, dir:k === 'n' ? 1 : 1}; render(); return; }
  if (t.closest('[data-ct-todos]')) { const L = ctVisibles(); const todos = L.every(c => ct.sel.has(c.id)); L.forEach(c => todos ? ct.sel.delete(c.id) : ct.sel.add(c.id)); render(); return; }
  const s = t.closest('[data-ct-sel]'); if (s) { const id = +s.dataset.ctSel; ct.sel.has(id) ? ct.sel.delete(id) : ct.sel.add(id); render(); return; }
  const ba = t.closest('[data-ctb-asig]'); if (ba) { const a = ba.dataset.ctbAsig, n = ct.sel.size; ct.sel.forEach(id => ctCambiar(id, x => { x.asig = a; })); ct.sel.clear(); render(); toast(`${n} ${n === 1 ? 'contacto asignado' : 'contactos asignados'} a ${a}`); return; }
  const be = t.closest('[data-ctb-etapa]'); if (be) { const et = be.dataset.ctbEtapa, n = ct.sel.size; ct.sel.forEach(id => ctCambiar(id, x => { x.etapa = et; })); ct.sel.clear(); render(); toast(`${n} ${n === 1 ? 'contacto pasó' : 'contactos pasaron'} a «${et}»`); return; }
  const bt = t.closest('[data-ctb-tag]'); if (bt) { const tg = bt.dataset.ctbTag, n = ct.sel.size; ct.sel.forEach(id => ctCambiar(id, x => { if (!x.tags.includes(tg)) x.tags = [...x.tags, tg]; })); ct.sel.clear(); render(); toast(`Etiqueta «${tg}» agregada a ${n} ${n === 1 ? 'contacto' : 'contactos'}`); return; }
  const acc = t.closest('[data-ct-acc]'); if (acc) {
    const a = acc.dataset.ctAcc;
    if (a === 'importar') { document.getElementById('ct-mas').hidden = true; ctImportar(); }
    else if (a === 'exportar') { document.getElementById('ct-mas').hidden = true; const L = ctVisibles(); if (ct.vista === 'todos' && !Object.values(ct.f).some(Boolean) && !ct.q.trim()) crmExportarContactos().then(() => toast('Se descargó el Excel de contactos'), err => toast(err.message)); else { descargarCsv(L, 'contactos-crm.csv'); toast(`Se descargó un archivo con ${L.length} contactos`); } }
    else if (a === 'exportar-sel') { const L = ctTodos().filter(c => ct.sel.has(c.id)); descargarCsv(L, 'contactos-elegidos.csv'); toast(`Se descargó un archivo con ${L.length} contactos`); }
    else if (a === 'limpiar-sel') { ct.sel.clear(); render(); }
    else if (a === 'nocontactar-sel') { const n = ct.sel.size; ct.sel.forEach(id => ctCambiar(id, x => { x.noContactar = true; })); ct.sel.clear(); render(); toast(`${n} ${n === 1 ? 'contacto marcado' : 'contactos marcados'} como no contactar`); }
    else if (a === 'difusion') { if (st.rol !== 'l') { toast('Las difusiones las envía el líder de Ventas'); return; } const n = ct.sel.size, ids = ctTodos().filter(c => ct.sel.has(c.id)).map(c => c.contactoId).filter(Boolean); ct.sel.clear(); st.pagina = 'difusiones'; st.dif = {paso:1, aud:new Set(), tpl:(TPL[0] || {}).n || '', linea:(LINEAS[0] || {}).id || null, cuando:'ahora', seleccion:n, ids, publico:'sel', n:`Difusión a ${n} contactos elegidos`}; render(); }
    return;
  }
  const ab = t.closest('[data-ct-abrir]'); if (ab) { ctAbrirConv(+ab.dataset.ctAbrir); return; }
  const es = t.closest('[data-ct-escribir]'); if (es) { ctEscribir(+es.dataset.ctEscribir); return; }
  const fi = t.closest('[data-ct-ficha]'); if (fi) { ctFicha(+fi.dataset.ctFicha); return; }
  const ag = t.closest('[data-ct-agregar]'); if (ag) { ctCambiar(+ag.dataset.ctAgregar, x => { x.guardado = true; }); render(); toast('Agregado a contactos'); return; }
  const ns = t.closest('[data-ct-nospam]'); if (ns) { mjSacarDeSpam(+ns.dataset.ctNospam); return; }
  const nc = t.closest('[data-ct-nocont]'); if (nc) { let ahora; ctCambiar(+nc.dataset.ctNocont, x => { x.noContactar = !x.noContactar; ahora = x.noContactar; }); render(); toast(ahora ? 'Marcado como no contactar: no le llegan difusiones ni recordatorios' : 'Ya se le puede volver a escribir'); return; }
  const fila = t.closest('[data-ct-fila]'); if (fila && !t.closest('.cb, .ac, .dsel, .menu')) { const id = +fila.dataset.ctFila; const c = ctTodos().find(x => x.id === id); c && c.conv ? ctAbrirConv(id) : ctFicha(id); }
});
document.getElementById('page').addEventListener('input', e => {
  if (st.pagina !== 'contactos' || e.target.id !== 'ct-q') return;
  st.ct.q = e.target.value; const pos = e.target.selectionStart; render(); const n = document.getElementById('ct-q'); n.focus(); n.setSelectionRange(pos, pos);
});
document.getElementById('ov-x').addEventListener('click', e => {
  const t = e.target;
  const ne = t.closest('[data-ctn-etapa]'); if (ne) { st.ctNuevo.etapa = ne.dataset.ctnEtapa; guardarCamposNuevo(); ctNuevo(); restaurarCamposNuevo(); return; }
  const na = t.closest('[data-ctn-asig]'); if (na) { st.ctNuevo.asig = na.dataset.ctnAsig; guardarCamposNuevo(); ctNuevo(); restaurarCamposNuevo(); return; }
  const np = t.closest('[data-ctn-prod]'); if (np) { st.ctNuevo.producto = np.dataset.ctnProd; guardarCamposNuevo(); ctNuevo(); restaurarCamposNuevo(); return; }
  if (t.closest('[data-ct-guardar-nuevo]')) {
    const n = document.getElementById('ctn-n').value.trim(), tel = document.getElementById('ctn-tel').value.trim();
    if (n.split(/\s+/).length < 2) { toast('Escribe nombre y apellido'); document.getElementById('ctn-n').focus(); return; }
    if (tel.replace(/\D/g, '').length < 10) { toast('Escribe un celular de 10 dígitos'); document.getElementById('ctn-tel').focus(); return; }
    const d10 = tel.replace(/\D/g, '').slice(-10), ya = ctTodos().find(x => String(x.tel || '').replace(/\D/g, '').slice(-10) === d10);
    if (ya) { toast(`Ese celular ya está en contactos: ${ya.n}`); document.getElementById('ctn-tel').focus(); return; }
    CT_EXTRA.unshift({id:-Date.now(), n, tel, correo:document.getElementById('ctn-mail').value.trim(), canal:'wa', etapa:st.ctNuevo.etapa, asig:st.ctNuevo.asig || null, producto:st.ctNuevo.producto, empresa:'', ciudad:document.getElementById('ctn-ciudad').value.trim(), origen:'Agregado a mano', tags:[], cuotas:null, ultimoDias:0, agregadoDias:0, recien:Date.now()});
    cerrarDialogo(); st.ct.vista = 'todos'; st.ct.orden = {k:'agregado', dir:1}; render(); toast(`${n} quedó en contactos`); return;
  }
  if (t.closest('#ct-imp-go')) {
    const f = (document.getElementById('ct-imp-f').files || [])[0], bt = t.closest('#ct-imp-go'); if (!f) return;
    bt.disabled = true; document.getElementById('ct-imp-t').textContent = `Importando ${f.name}…`;
    crmSubir(f, '/crm/contactos/importar').then(r => { const n = (r.errores || []).length; cerrarDialogo(); render(); toast(`Importados ${r.nuevos} contactos nuevos y ${r.actualizados} actualizados${n ? `; ${n} ${n === 1 ? 'fila' : 'filas'} con errores` : ''}`); },
      err => { bt.disabled = false; document.getElementById('ct-imp-t').textContent = f.name; const res = document.getElementById('ct-imp-res'); res.hidden = false; res.querySelector('b').textContent = 'No se pudo importar'; res.querySelector('span').textContent = err.message; });
    return;
  }
  if (t.closest('[data-ct-seg-ok]')) {
    const n = document.getElementById('ct-seg-n').value.trim(); if (!n) { toast('Ponle un nombre al segmento'); return; }
    const id = 'p' + Date.now(); st.ct.propios.push({id, n, filtros:{...st.ct.f}, q:st.ct.q.trim()}); st.ct.vista = 'seg:' + id; st.ct.f = {}; st.ct.q = ''; st.ct.filtrosAbiertos = false;
    cerrarDialogo(); render(); toast(`Segmento «${n}» guardado`); return;
  }
  const ab = t.closest('[data-ct-abrir]'); if (ab) { ctAbrirConv(+ab.dataset.ctAbrir); return; }
  const es = t.closest('[data-ct-escribir]'); if (es) { ctEscribir(+es.dataset.ctEscribir); return; }
});
document.getElementById('ov-x').addEventListener('change', e => {
  if (e.target.id !== 'ct-imp-f' || !e.target.files.length) return;
  document.getElementById('ct-imp-t').textContent = e.target.files[0].name; document.getElementById('ct-imp-res').hidden = true; document.getElementById('ct-imp-go').disabled = false;
});
let camposNuevo = {};
function guardarCamposNuevo(){ camposNuevo = Object.fromEntries(['ctn-n','ctn-tel','ctn-mail','ctn-ciudad'].map(id => [id, (document.getElementById(id) || {}).value || ''])); }
function restaurarCamposNuevo(){ Object.entries(camposNuevo).forEach(([id, v]) => { const el = document.getElementById(id); if (el) el.value = v; }); }


/* ── Reparto por área en el flujo de bienvenida: Ventas, Soporte de ventas y Soporte.
   Sin IA en este flujo: se reparte con dos botones, una lista y reglas sobre datos. Lo que no queda claro va al líder. ── */
document.head.insertAdjacentHTML('beforeend', `<style>
.rp{display:grid;gap:14px}
.rp-sec{display:grid;gap:8px}
.rp-h{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap}
.rp-h b{font-size:13px;font-weight:600}
.rp-h small{font-size:12px;color:var(--ink3)}
.rp-bts{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px}
.rp-bt{display:flex;align-items:center;gap:6px;flex-wrap:wrap;border:1px solid var(--line);border-radius:10px;padding:8px;background:#fafbfc}
.rp-bt input{flex:1;min-width:0;font-weight:500}
.rp-bt .rp-va{flex-basis:100%;font-size:12px;color:var(--ink3)}
.rp-bt .cnt20{font-size:11px;color:var(--ink4);font-variant-numeric:tabular-nums}
.rp-cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.8fr);gap:10px;align-items:start}
@media (max-width:1300px){.rp-cols{grid-template-columns:1fr}}
.rama-h b{font-size:12.5px;font-weight:600}
.ltab-w{overflow-x:auto}
.ltab{width:100%;border-collapse:collapse;font-size:12.5px;min-width:520px}
.ltab th{text-align:left;font-weight:600;color:var(--ink2);font-size:12px;padding:4px 5px}
.ltab td{padding:3px 5px;vertical-align:top}
.ltab td.eq{width:180px}
.ltab .dsel{min-width:0!important}
.ltab .cnt{display:block;font-size:10.5px;color:var(--ink4);text-align:right;font-variant-numeric:tabular-nums}
.ltab .btn.ic{width:28px;height:28px;padding:0}
.rpaso .solo{font-size:11px;color:var(--amber-ink)}
.fprev .lista-wa button span{display:block}
.fprev .lista-wa button small{display:block;font-size:11px;color:var(--ink3);line-height:1.35}
.fprev .chatp > *{flex-shrink:0}
</style>`);
const AREAS = ['Ventas', 'Soporte de ventas', 'Soporte'];
EQUIPOS[0].f = c => c.equipo ? c.equipo === 'Ventas' : !c.ficha.compras;
EQUIPOS[1].f = c => c.equipo ? c.equipo === 'Recuperación de ventas' : !!c.ficha.compras;
EQUIPOS.push({id:'soporte-ventas', n:'Soporte de ventas', f:c => c.equipo === 'Soporte de ventas'}, {id:'soporte', n:'Soporte', f:c => c.equipo === 'Soporte'});
(() => {
  const f = FLUJOS.find(x => x.id === 'bienvenida');
  f.pasos = [f.pasos[0], f.pasos[1], {t:'ramas',
    txt:'¡Gracias, {{nombre}}! ¿Ya eres cliente?',
    ops:[{op:'Quiero información', va:'ventas'}, {op:'Ya soy cliente', va:'lista'}],
    ventas:[
      {t:'mensaje', txt:'¡Con gusto! Un asesor te escribe en unos minutos para ayudarte.'}],
    saludoConocido:'¡Hola, {{nombre}}! Qué bueno leerte.',
    lista:{txt:'Por favor, toca «Ver opciones» y elige en qué te podemos ayudar.', boton:'Ver opciones', ops:[
      {t:'Pagos y cuotas', d:'Pagar una cuota o un pago que no pasó', eq:'Soporte de ventas'},
      {t:'Reembolsos y cambios', d:'Devolución o cambio de una compra', eq:'Soporte de ventas'},
      {t:'No me llegó mi compra', d:'Compraste y todavía no la recibes', eq:'Soporte de ventas'},
      {t:'Ayuda con mi compra', d:'Dudas de uso o algo que no funciona', eq:'Soporte'},
      {t:'Otra consulta', d:'Cualquier otra cosa en que te podamos ayudar', eq:'Soporte'},
      {t:'Comprar otra vez', d:'Conocer otros productos y precios', eq:'Ventas'}]},
    despues:{
      'Ventas':[{t:'mensaje', txt:'¡Con gusto! Un asesor te escribe en unos minutos.'}],
      'Soporte de ventas':[
        {t:'pregunta', txt:'Para buscar tu compra, ¿con qué correo la hiciste?', validar:'Correo', reintento:'Ese correo no parece completo, ¿me lo escribes de nuevo?', soloNuevos:true},
        {t:'mensaje', txt:'Gracias. Ya pasamos tu caso a soporte de ventas y te escriben en unos minutos.'}],
      'Soporte':[
        {t:'mensaje', txt:'Perfecto. Alguien de soporte te escribe en unos minutos.'}],
    },
  }];
  f.atajos = {anuncio:true, registrado:true, intentos:1};
})();
const NOMBRE_SUBPASO = {mensaje:'Mensaje', pregunta:'Pregunta', lista:'Lista de opciones'};
const ICONO_SUBPASO = {mensaje:'chat', pregunta:'pen', lista:'template'};
const TXT_REPETIR = 'Para poder ayudarte, elige una de las opciones, por favor.';

/* Editor del paso */
function subpasosHTML(i, ruta, pasos){
  return pasos.map((sp, k) => `<div class="rpaso"><span class="rpt">${I(ICONO_SUBPASO[sp.t])}${NOMBRE_SUBPASO[sp.t]}</span>
    <textarea data-rp-set="${i}|${ruta}.${k}.txt" rows="2">${esc(sp.txt)}</textarea>
    ${sp.t === 'pregunta' ? '<small>Revisa que sea un correo; si no, lo vuelve a pedir una vez</small>' : ''}
    ${sp.t === 'lista' ? `<small>Lista de WhatsApp con ${sp.ops.length} opciones: ${esc(sp.ops.join(', '))}</small>` : ''}
    ${sp.soloNuevos ? '<span class="solo">Solo si el número todavía no es de un cliente</span>' : ''}</div>`).join('');
}
function campoRamas(p, i){
  const L = p.lista;
  return `<div class="rp">
    <div class="rp-sec"><div class="rp-h"><b>Primero pregunta si ya es cliente</b><small>Botones de WhatsApp de hasta 20 letras</small></div>
      <textarea data-rp-set="${i}|txt" rows="2">${esc(p.txt)}</textarea>
      <div class="rp-bts">${p.ops.map((o, j) => `<div class="rp-bt"><span class="rbt" style="width:20px;height:20px;border-radius:50%;background:var(--blue);color:#fff;font-size:11px;font-weight:600;display:grid;place-items:center;flex:none">${j + 1}</span><input data-rp-op="${i}|${j}" value="${esc(o.op)}" maxlength="20" aria-label="Texto del botón ${j + 1}"><small class="cnt20" id="rpc-${i}-${j}">${o.op.length}/20</small><span class="rp-va">${o.va === 'ventas' ? 'Pasa a Ventas' : 'Le muestra la lista de clientes'}</span></div>`).join('')}</div>
    </div>
    <div class="rp-cols">
      <div class="rama"><div class="rama-h"><span class="rbt">1</span><b>Si elige «${esc(p.ops[0].op)}»</b></div>
        <div class="rsub">${subpasosHTML(i, 'ventas', p.ventas)}<div class="rpaso"><span class="rpt">${I('users')}Pasa al asesor</span><p>Reparto automático del equipo Ventas</p></div></div></div>
      <div class="rama"><div class="rama-h"><span class="rbt">2</span><b>Si elige «${esc(p.ops[1].op)}»</b></div>
        <label class="fld">Mensaje de la lista<textarea data-rp-set="${i}|lista.txt" rows="2">${esc(L.txt)}</textarea></label>
        <div class="two3" style="grid-template-columns:1fr 1fr"><label class="fld">Botón que abre la lista<input data-rp-set="${i}|lista.boton" value="${esc(L.boton)}" maxlength="20"></label>
          <label class="fld">Saludo si ya lo conocemos<input data-rp-set="${i}|saludoConocido" value="${esc(p.saludoConocido)}"></label></div>
        <div class="ltab-w"><table class="ltab"><thead><tr><th>Opción</th><th>Lo que dice debajo</th><th>Pasa a</th><th></th></tr></thead><tbody>
          ${L.ops.map((o, j) => `<tr><td><input data-rp-lt="${i}|${j}" value="${esc(o.t)}" maxlength="24" aria-label="Opción ${j + 1}"><small class="cnt" id="rplt-${i}-${j}">${o.t.length}/24</small></td>
            <td><input data-rp-ld="${i}|${j}" value="${esc(o.d)}" maxlength="72" aria-label="Descripción de la opción ${j + 1}"><small class="cnt" id="rpld-${i}-${j}">${o.d.length}/72</small></td>
            <td class="eq">${ddSel('data-rp-eq', AREAS.map(e => [`${i}|${j}|${e}`, e]), `${i}|${j}|${esc(o.eq)}`)}</td>
            <td><button type="button" class="btn ic" data-rp-ldel="${i}|${j}" aria-label="Quitar opción" ${L.ops.length > 1 ? '' : 'disabled'}>${I('x')}</button></td></tr>`).join('')}
        </tbody></table></div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">${L.ops.length < 10 ? `<button type="button" class="btn" data-rp-ladd="${i}">${I('plus')}Agregar opción</button>` : '<span></span>'}<small class="muted">WhatsApp permite hasta 10 opciones de 24 letras, con una descripción de hasta 72.</small></div>
      </div>
    </div>
    <div class="rp-sec"><div class="rp-h"><b>Después de elegir en la lista</b><small>Lo que pasa antes de que lo tome el asesor de cada equipo</small></div>
      <div class="ramas">${AREAS.map(eq => `<div class="rama"><div class="rama-h"><b>${esc(eq)}</b></div><div class="rsub">${subpasosHTML(i, 'despues.' + eq, p.despues[eq])}<div class="rpaso"><span class="rpt">${I('users')}Pasa al asesor</span><p>Reparto automático del equipo ${esc(eq)}</p></div></div></div>`).join('')}</div>
    </div>
  </div>`;
}
function atajosHTML(f){
  const a = f.atajos, tg = (k, t, s) => `<div class="row2"><span>${t}<small>${s}</small></span><button type="button" class="tg" role="switch" data-fl-atajo="${k}" aria-checked="${a[k]}"></button></div>`;
  return `<div class="atj"><b>Reglas del reparto</b>
    ${tg('anuncio', 'Si llega de un anuncio, pasa directo a Ventas', 'Después del nombre no se le hace ninguna pregunta')}
    ${tg('registrado', 'Si el número ya es de un cliente, va directo a la lista', 'No se le pregunta el nombre ni si ya es cliente, y tampoco el correo')}
    <div class="two3" style="grid-template-columns:1fr 1fr;align-items:end"><div class="fld">Si escribe en vez de elegir${ddSel('data-fl-intentos', [['1', 'Se le repiten las opciones 1 vez'], ['2', 'Se le repiten las opciones 2 veces']], String(a.intentos))}</div>
    <p class="muted" style="margin:0 0 8px">Si sigue sin elegir, queda sin asignar para que el líder la reparta.</p></div></div>`;
}
const ESCENARIOS = [['nuevo', 'Lead nuevo'], ['anuncio', 'Llega de un anuncio'], ['registrado', 'Ya es cliente']];

/* Prueba en el teléfono de la derecha */
function chatRamas(f){
  const pr = st.prueba, escn = st.pruebaEsc || 'nuevo', at = f.atajos || {}, out = [];
  const R = f.pasos.findIndex(p => p.t === 'ramas'), rp = f.pasos[R], L = rp.lista;
  const conocido = escn === 'registrado' && at.registrado, anuncio = escn === 'anuncio' && at.anuncio;
  const nombre = () => pr && pr.nombre ? pr.nombre.split(' ')[0] : yo.split(' ')[0];
  const tx = t => esc(t.replace(/\{\{nombre\}\}/g, nombre()));
  const msg = t => `<div class="bb">${tx(t)}</div>`, yoB = t => `<div class="bb yo">${esc(t)}</div>`, ev = t => `<div class="bb ev">${esc(t)}</div>`;
  const lista = (l, k) => `<div class="lista-wa"><div class="lh">${I('template')}${esc(l.boton)}</div>${l.ops.map((o, j) => { const t = typeof o === 'string' ? o : o.t, d = typeof o === 'string' ? '' : o.d;
    return `<button type="button" ${k != null ? `data-rp-elegir="${k}|${j}"` : 'disabled'}><span>${esc(t)}</span>${d ? `<small>${esc(d)}</small>` : ''}</button>`; }).join('')}</div>`;
  const botones = activo => `<div class="opsb">${rp.ops.map((o, j) => `<button type="button" ${activo ? `data-rp-op="${j}"` : 'disabled'}>${esc(o.op)}</button>`).join('')}</div>`;
  const escribir = ph => `<div class="resp"><input id="rp-in" placeholder="${ph}"><button type="button" class="btn pri" data-rp-escribir="1">${I('send')}</button></div>`;
  const asignar = eq => ev(`Pasa al reparto automático del equipo ${eq}, con su nombre y lo que eligió. Fin del flujo.`);

  if (escn === 'anuncio') { out.push(ev('Prueba: llegó desde un anuncio de Instagram')); out.push(yoB('Hola, quiero información')); }
  else if (escn === 'registrado') { out.push(ev('Prueba: el número es de un cliente que ya compró')); out.push(yoB('Hola, necesito ayuda')); }
  else out.push(yoB('Hola, quiero información'));

  // Vista sin probar: el recorrido de ejemplo, sin tocar nada.
  if (!pr) {
    if (!conocido) for (let i = 0; i < R; i++) { const p = f.pasos[i]; if (p.t === 'mensaje') out.push(msg(p.txt)); if (p.t === 'pregunta') { out.push(msg(p.txt)); out.push(yoB(yo)); } }
    if (anuncio) { out.push(ev('Viene de un anuncio: pasa directo a Ventas, sin preguntas')); out.push(msg(rp.ventas[rp.ventas.length - 1].txt)); out.push(asignar('Ventas')); return out.join(''); }
    if (conocido) { out.push(msg(`${rp.saludoConocido} ${L.txt}`)); out.push(lista(L)); }
    else { out.push(msg(rp.txt)); out.push(botones(false)); }
    out.push(ev('Toca «Probar el flujo» para recorrerlo.'));
    return out.join('');
  }

  pr.rp = pr.rp || {esc1:[], op:null, esc2:[], eleccion:null, sub:{}};
  const r = pr.rp;
  // Saludo y nombre (se saltan si ya es cliente).
  if (conocido) out.push(ev('Ya es cliente: no se le pregunta el nombre'));
  else for (let i = 0; i < R; i++) {
    const p = f.pasos[i];
    if (p.t === 'mensaje') { out.push(msg(p.txt)); continue; }
    if (p.t === 'pregunta') {
      out.push(msg(p.txt)); const x = pr.resp[i];
      if (x && x.error) out.push(yoB(x.v) + msg(p.reintento || 'No te entendí, ¿me lo repites?'));
      if (x && x.ok) { out.push(yoB(x.v)); continue; }
      out.push(`<div class="resp"><input id="fl-in" data-fl-paso="${i}" placeholder="Escribe como si fueras el cliente"><button type="button" class="btn pri" data-fl-enviar="${i}">${I('send')}</button></div>`);
      return out.join('');
    }
  }
  const correr = (pasos, clave) => {
    for (let k = 0; k < pasos.length; k++) {
      const p = pasos[k], x = r.sub[clave + k];
      if (p.soloNuevos && conocido) continue;
      if (p.t === 'mensaje') { out.push(msg(p.txt)); continue; }
      if (p.t === 'pregunta') {
        out.push(msg(p.txt));
        if (x && x.error) out.push(yoB(x.v) + msg(p.reintento));
        if (x && x.ok) { out.push(yoB(x.v)); continue; }
        out.push(`<div class="resp"><input id="rp-sin" data-rp-sub="${clave + k}" placeholder="Escribe como si fueras el cliente"><button type="button" class="btn pri" data-rp-subenv="${clave + k}">${I('send')}</button></div>`);
        return false;
      }
      if (p.t === 'lista') { out.push(msg(p.txt)); if (x && x.ok) { out.push(yoB(x.v)); continue; } out.push(lista(p, clave + k)); return false; }
    }
    return true;
  };
  // Lo que se escribe en vez de elegir: se repiten las opciones y, si insiste, queda para el líder.
  const escritos = (lst, repetir) => {
    for (let w = 0; w < lst.length; w++) {
      out.push(yoB(lst[w]));
      if (w >= at.intentos) { out.push(ev('No eligió ninguna opción: queda sin asignar para que el líder la reparta. Fin del flujo.')); return false; }
      out.push(msg(TXT_REPETIR)); repetir();
    }
    return true;
  };

  if (anuncio) {
    out.push(ev('Viene de un anuncio: pasa directo a Ventas, sin preguntas'));
    out.push(msg(rp.ventas[rp.ventas.length - 1].txt)); out.push(asignar('Ventas')); return out.join('');
  }
  let va = 'lista';
  if (!conocido) {
    out.push(msg(rp.txt));
    if (!escritos(r.esc1, () => out.push(botones(false)))) return out.join('');
    if (r.op == null) { out.push(botones(true)); out.push(escribir('O escribe como si fueras el cliente')); return out.join(''); }
    out.push(yoB(rp.ops[r.op].op)); va = rp.ops[r.op].va;
  }
  if (va === 'ventas') { if (correr(rp.ventas, 'v')) out.push(asignar('Ventas')); return out.join(''); }
  out.push(msg(conocido ? `${rp.saludoConocido} ${L.txt}` : L.txt));
  if (!escritos(r.esc2, () => out.push(lista(L)))) return out.join('');
  if (r.eleccion == null) { out.push(lista(L, 'L')); out.push(escribir('O escribe en vez de elegir')); return out.join(''); }
  const o = L.ops[r.eleccion]; out.push(yoB(o.t));
  if (correr(rp.despues[o.eq], 'd')) out.push(asignar(o.eq));
  return out.join('');
}
const chatPruebaBase = chatPrueba;
chatPrueba = function(f){ return f.pasos.some(p => p.t === 'ramas') ? chatRamas(f) : chatPruebaBase(f); };
function enfocar(id){ const n = document.getElementById(id); if (n) n.focus(); }
function rpEscribir(f, v){
  v = v.trim(); if (!v) return;
  const r = st.prueba.rp, conocido = (st.pruebaEsc || 'nuevo') === 'registrado' && f.atajos.registrado;
  if (!conocido && r.op == null) r.esc1.push(v); else r.esc2.push(v);
  render(); enfocar('rp-in');
}
function rpResponder(f, clave, v){
  v = v.trim(); if (!v) return;
  const r = st.prueba.rp, ok = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(v);
  r.sub[clave] = (!ok && !(r.sub[clave] && r.sub[clave].error)) ? {v, error:true} : {v, ok:true};
  render(); enfocar('rp-sin');
}
// Cambia un texto del paso a partir de una ruta como «lista.txt» o «despues.Soporte.1.txt».
function rpSet(p, ruta, v){
  const partes = ruta.split('.'); let o = p;
  for (let k = 0; k < partes.length - 1; k++) o = o[partes[k]];
  o[partes[partes.length - 1]] = v;
}
document.getElementById('page').addEventListener('click', e => {
  if (st.pagina !== 'flujos') return; const f = FLUJOS.find(x => x.id === st.flujo); if (!f) return; const t = e.target;
  const es = t.closest('[data-flr-esc]'); if (es) { st.pruebaEsc = es.dataset.flrEsc; st.prueba = null; render(); return; }
  // prueba
  if (st.prueba) {
    st.prueba.rp = st.prueba.rp || {esc1:[], op:null, esc2:[], eleccion:null, sub:{}};
    const b = t.closest('.fprev [data-rp-op]'); if (b) { st.prueba.rp.op = +b.dataset.rpOp; render(); return; }
    const el = t.closest('[data-rp-elegir]'); if (el) { const [k, j] = el.dataset.rpElegir.split('|'); const r = st.prueba.rp;
      if (k === 'L') r.eleccion = +j; else { const rp = f.pasos.find(p => p.t === 'ramas'); const pasos = k[0] === 'v' ? rp.ventas : rp.despues[rp.lista.ops[r.eleccion].eq]; r.sub[k] = {v:pasos[+k.slice(1)].ops[+j], ok:true}; }
      render(); return; }
    if (t.closest('[data-rp-escribir]')) { rpEscribir(f, document.getElementById('rp-in').value); return; }
    const se = t.closest('[data-rp-subenv]'); if (se) { rpResponder(f, se.dataset.rpSubenv, document.getElementById('rp-sin').value); return; }
  }
  // editor
  const rq = t.closest('[data-rp-eq]'); if (rq) { const [i, j, eq] = rq.dataset.rpEq.split('|'); const o = f.pasos[+i].lista.ops[+j]; o.eq = eq; render(); toast(`«${o.t}» ahora pasa a ${eq}`); return; }
  const ld = t.closest('[data-rp-ldel]'); if (ld) { const [i, j] = ld.dataset.rpLdel.split('|').map(Number); const L = f.pasos[i].lista; if (L.ops.length > 1) { const [x] = L.ops.splice(j, 1); st.prueba = null; render(); toast(`Quitaste «${x.t}» de la lista`); } return; }
  const la = t.closest('[data-rp-ladd]'); if (la) { const L = f.pasos[+la.dataset.rpLadd].lista; if (L.ops.length < 10) { L.ops.push({t:'Opción nueva', d:'', eq:'Ventas'}); st.prueba = null; render(); } return; }
  const at = t.closest('[data-fl-atajo]'); if (at) { const k = at.dataset.flAtajo; f.atajos[k] = !f.atajos[k]; st.prueba = null; render(); return; }
  const it = t.closest('[data-fl-intentos]'); if (it) { f.atajos.intentos = +it.dataset.flIntentos; st.prueba = null; render(); return; }
});
document.getElementById('page').addEventListener('keydown', e => {
  if (st.pagina !== 'flujos' || e.key !== 'Enter') return; const f = FLUJOS.find(x => x.id === st.flujo); if (!f || !st.prueba) return;
  if (e.target.id === 'rp-in') { e.preventDefault(); rpEscribir(f, e.target.value); }
  if (e.target.id === 'rp-sin') { e.preventDefault(); rpResponder(f, e.target.dataset.rpSub, e.target.value); }
});
document.getElementById('page').addEventListener('input', e => {
  if (st.pagina !== 'flujos') return; const d = e.target.dataset;
  const cnt = (id, max) => { const c = document.getElementById(id); if (c) c.textContent = `${e.target.value.length}/${max}`; };
  if (d.rpOp !== undefined) { const [i, j] = d.rpOp.split('|'); cnt(`rpc-${i}-${j}`, 20); }
  if (d.rpLt !== undefined) { const [i, j] = d.rpLt.split('|'); cnt(`rplt-${i}-${j}`, 24); }
  if (d.rpLd !== undefined) { const [i, j] = d.rpLd.split('|'); cnt(`rpld-${i}-${j}`, 72); }
});
// Se redibuja después del evento: si el cambio llega por perder el foco durante otro redibujo, no choca con él.
document.getElementById('page').addEventListener('change', e => {
  if (st.pagina !== 'flujos') return; const f = FLUJOS.find(x => x.id === st.flujo); if (!f) return; const t = e.target, d = t.dataset;
  if (d.rpOp !== undefined) { const [i, j] = d.rpOp.split('|').map(Number); const o = f.pasos[i].ops[j]; o.op = t.value.trim() || o.op; st.prueba = null; setTimeout(render); }
  else if (d.rpLt !== undefined) { const [i, j] = d.rpLt.split('|').map(Number); const o = f.pasos[i].lista.ops[j]; o.t = t.value.trim() || o.t; st.prueba = null; setTimeout(render); }
  else if (d.rpLd !== undefined) { const [i, j] = d.rpLd.split('|').map(Number); f.pasos[i].lista.ops[j].d = t.value.trim(); setTimeout(render); }
  else if (d.rpSet !== undefined) { const [i, ruta] = d.rpSet.split(/\|(.+)/); rpSet(f.pasos[+i], ruta, t.value); setTimeout(render); }
});


/* ── Datos reales (26-sep): ayudas de la pantalla que usan lo que llega del API ── */
// Una conversación por contacto: la más reciente (Embudo, Contactos, Conversación nueva).
function ultimasConv(){ const m = new Map(); for (const c of CONV) { if (!okRol(c)) continue; const k = c.contactoId || -c.id, o = m.get(k); if (!o || crmT(c) > crmT(o)) m.set(k, c); } return [...m.values()]; }
// «22:00» → «10 p. m.»
const horaCorta = t => { const [h, m] = String(t).split(':').map(Number); return hcHora(hcFecha(2026, 0, 1, h || 0, m || 0)).replace(':00 ', ' '); };
// «Lunes a domingo, 7 a. m. a 10 p. m.», sacado de Ajustes > Horario de atención.
function horarioTxt(){
  const on = CFG.horario.filter(h => h[3]); if (!on.length) return 'Cerrado todos los días';
  const hora = horaCorta;
  const dias = on.length === 7 ? 'Lunes a domingo' : on.map(h => h[0]).join(', ');
  return on.every(h => h[1] === on[0][1] && h[2] === on[0][2]) ? `${dias}, ${hora(on[0][1])} a ${hora(on[0][2])}` : `${dias}, con horas distintas por día`;
}

/* Informes: lo que da el API (GET /crm/informes) manda; lo que no da, se calcula de las conversaciones. */
function paginaInformes(el){
  const lider = st.rol === 'l', desde = Date.now() - 7 * 864e5, inf = crmInformes() || {}, e = inf.encuestas || {};
  const suyas = CONV.filter(okRol).filter(c => lider || c.asig === yo);
  const t = (c, k) => Date.parse((c._t || {})[k]) || 0;
  const nuevas = suyas.filter(c => t(c, 'creado') >= desde), fin = suyas.filter(c => c.est === 'finalizadas' && t(c, 'finalizada') >= desde), abiertas = suyas.filter(c => (c.est || 'abiertas') === 'abiertas');
  const cuenta = (lista, f) => { const m = {}; lista.forEach(c => { const k = f(c); if (k) m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const barras = (pares, col, attr) => { const max = Math.max(1, ...pares.map(p => p[1])); return pares.length ? pares.map(([n, v, c2]) => `<div${attr ? ` ${attr(n)} style="cursor:pointer" title="Ver en la bandeja"` : ''}><span>${esc(n)}</span><i style="width:${Math.round(v / max * 100)}%${c2 || col ? `;background:${c2 || col}` : ''}"></i><em>${v}</em></div>`).join('') : '<p class="muted" style="margin:0">Sin datos en estos días.</p>'; };
  const nNuevas = inf.nuevas ?? nuevas.length, nFin = inf.finalizadas ?? fin.length, par = (l, k = 'n') => (l || []).map(x => Array.isArray(x) ? x : [x[k], x.v ?? x.n]);
  const porDia = cuenta(nuevas, c => hcDia(t(c, 'creado'))), pico = porDia[0];
  const plat = c => !c.pauta ? 'Orgánico o sin dato' : /instagram/i.test(c.pauta.plataforma) ? 'Meta · Instagram' : /facebook/i.test(c.pauta.plataforma) ? 'Meta · Facebook' : c.pauta.plataforma;
  const colPlat = n => /^Meta/.test(n) ? '#1f93ff' : /tiktok/i.test(n) ? '#111827' : /google/i.test(n) ? '#eab308' : '#cbd5e1';
  const franja = h => h >= 6 && h < 12 ? '6 a 12' : h >= 12 && h < 18 ? '12 a 18' : h >= 18 && h < 22 ? '18 a 22' : '22 a 6';
  const porPauta = (inf.porOrigen ? par(inf.porOrigen) : cuenta(nuevas, plat)).map(([n, v]) => [n, v, colPlat(n)]);
  const porCampana = inf.porCampana ? par(inf.porCampana) : cuenta(nuevas.filter(c => c.pauta && c.pauta.campana), c => c.pauta.campana);
  const porHora = inf.porHora ? par(inf.porHora, 'h') : ['6 a 12', '12 a 18', '18 a 22', '22 a 6'].map(f => [f, nuevas.filter(c => franja(hcPartes(t(c, 'creado')).h) === f).length]);
  const porLinea = LINEAS.map(l => [l.n, abiertas.filter(c => c.linea === l.id).length, null, l.id]);
  const coma = v => String(Math.round(v * 10) / 10).replace('.', ',');
  const filasEnc = (inf.porAsesor || []).filter(r => r.encuestas).map(r => ({...r, asesor: r.nombre || r.asesor})).filter(r => lider || r.asesor === yo), coms = (e.comentarios || []).filter(x => lider || x.asesor === yo).slice(0, 6);
  const pctP = e.promotores ?? e.promotoresPct, pctD = e.detractores ?? e.detractoresPct;
  el.innerHTML = `<h2>Informes</h2><p class="sub">Últimos 7 días${lider ? ', todo el equipo' : ', tus conversaciones'}.</p>
    <div class="kpis"><div class="kpi"><span>Conversaciones nuevas</span><b>${nNuevas}</b><small>${pico ? `${pico[1]} solo ${/^(Hoy|Ayer)$/.test(pico[0]) ? pico[0].toLowerCase() : 'el ' + pico[0].toLowerCase()}` : 'en los últimos 7 días'}</small></div><div class="kpi"><span>Primera respuesta</span><b>${inf.primeraRespuestaMin != null ? Math.round(inf.primeraRespuestaMin) + ' min' : '—'}</b><small>promedio</small></div><div class="kpi"><span>Finalizadas</span><b>${nFin}</b><small>${abiertas.length ? Math.round(nFin / abiertas.length * 100) : 0} % de las abiertas</small></div><div class="kpi"><span>Atendidas por el agente IA de noche</span><b>${inf.atendidasIa ?? inf.ia ?? 0}</b><small>${esc(horaCorta(CFG.recepcion.desde))} a ${esc(horaCorta(CFG.recepcion.hasta))}</small></div></div>
    <div class="card" style="margin-bottom:16px"><h3 style="display:flex;align-items:center;gap:8px">${I('star')}Satisfacción de los clientes</h3>
      <p class="sub" style="margin:2px 0 14px">Encuesta al finalizar cada conversación, en los mismos 7 días.</p>
      <div class="kpis"><div class="kpi"><span>NPS de ${esc(ESPACIO.nombre || 'la empresa')}</span><b>${e.nps != null ? (e.nps > 0 ? '+' : '') + Math.round(e.nps) : '—'}</b><small>${pctP != null && e.respondidas ? `${Math.round(pctP)} % promotores · ${Math.round(pctD || 0)} % detractores` : 'sin respuestas todavía'}</small></div><div class="kpi"><span>Atención de los asesores</span><b>${e.atencion != null ? coma(e.atencion) + ' de 5' : '—'}</b><small>${e.atencion != null ? estrellas(Math.round(e.atencion)) : 'sin respuestas todavía'}</small></div><div class="kpi"><span>Respondieron</span><b>${e.enviadas ? Math.round((e.respondidas || 0) / e.enviadas * 100) + ' %' : '—'}</b><small>${(e.respondidas || 0).toLocaleString('es-CO')} de ${(e.enviadas || 0).toLocaleString('es-CO')} encuestas</small></div><div class="kpi"><span>Calificaciones bajas</span><b>${e.bajas || 0}</b><small>2 de 5 o menos · revisar</small></div></div>
      <div class="two">
        <div><table class="tb3"><thead><tr><th>Asesor</th><th>Encuestas</th><th>Atención</th><th>NPS</th><th>Detractores</th></tr></thead><tbody>
          ${filasEnc.length ? filasEnc.map(r => `<tr><td>${esc(r.asesor)}</td><td>${r.encuestas || 0}</td><td>${r.atencion != null ? estrellas(Math.round(r.atencion)) + ' ' + coma(r.atencion) : '—'}</td><td>${r.nps != null ? `<span class="nps ${r.nps >= 50 ? 'p' : r.nps >= 30 ? 'n' : 'd'}">${r.nps > 0 ? '+' : ''}${Math.round(r.nps)}</span>` : '—'}</td><td>${r.detractores || 0}</td></tr>`).join('') : '<tr><td colspan="5" class="muted">Todavía no hay encuestas respondidas.</td></tr>'}
        </tbody></table>${lider ? '' : '<p class="muted" style="margin-top:8px">Como asesora ves solo tus calificaciones. El líder ve las de todo el equipo.</p>'}</div>
        <div><h3 style="font-size:13px;margin:0 0 10px">Últimos comentarios</h3><div class="coms">${coms.length ? coms.map(x => `<div><span class="nps ${npsCls(x.nps)}">${x.nps}</span><span>${x.com ? `«${esc(x.com)}»` : '<span style="color:var(--ink4)">Sin comentario</span>'}<br><small>${esc(x.n)} sobre ${esc(x.asesor)} · ${estrellas(x.aten)}</small></span><small>${esc((cu => cu && Date.parse(cu) ? hcDia(cu).toLowerCase() : cu || '')(x.cuando || x.t))}</small></div>`).join('') : '<p class="muted" style="margin:0">Todavía no hay comentarios.</p>'}</div></div>
      </div>
    </div>
    <div class="two">
      <div class="card"><h3>Conversaciones abiertas por asesor</h3><div class="bars">${barras(cuenta(abiertas, c => c.asig || 'Sin asignar'))}</div></div>
      <div class="card"><h3>Conversaciones abiertas por etapa</h3><div class="bars">${barras(etapasQueVeo().map(([n, col]) => [n, abiertas.filter(c => c.etq[0] === n).length, col]).filter(x => x[1]), null, n => `data-f-etq="${esc(n)}"`)}</div></div>
      <div class="card"><h3>Conversaciones por pauta</h3><div class="bars">${barras(porPauta)}</div></div>
      <div class="card"><h3>Conversaciones por campaña</h3><div class="bars">${barras(porCampana)}</div></div>
      <div class="card"><h3>Conversaciones abiertas por línea</h3><div class="bars">${porLinea.length ? porLinea.map(([n, v, , id]) => `<div data-f-linea="${esc(id)}" style="cursor:pointer" title="Ver en la bandeja"><span>${esc(n)}</span><i style="width:${Math.round(v / Math.max(1, abiertas.length) * 100)}%"></i><em>${v}</em></div>`).join('') : '<p class="muted" style="margin:0">Todavía no hay líneas conectadas.</p>'}</div></div>
      <div class="card"><h3>Hora de llegada</h3><div class="bars">${barras(porHora)}</div></div>
    </div>`;
}

/* Compositor: emoji, nota de voz y archivos del computador */
document.querySelector('.box .bar [aria-label="Emoji"]').setAttribute('data-emo-abrir', '1');
document.querySelector('.nm .ft [aria-label="Emoji"]').setAttribute('data-emo-abrir', '1');
const EMOJIS = ['😊','😀','😂','😉','😅','😍','🥳','🤔','👋','🙌','👍','👏','🙏','💪','👀','✨','🎉','✅','📌','📍','📚','📝','🎓','📅','⏰','💳','💰','🚀','🔥','⭐','❤️','💙'];
function abrirEmojis(boton, campo){
  let p = document.getElementById('emop');
  if (!p) {
    p = document.createElement('div'); p.id = 'emop'; p.className = 'emop'; p.hidden = true; document.body.appendChild(p);
    p.addEventListener('click', e => { const b = e.target.closest('[data-emo]'); if (!b) return; const c = p._campo, v = b.dataset.emo, i = c.selectionStart ?? c.value.length, j = c.selectionEnd ?? i; c.value = c.value.slice(0, i) + v + c.value.slice(j); c.focus(); c.setSelectionRange(i + v.length, i + v.length); p.hidden = true; });
    document.addEventListener('click', e => { if (!e.target.closest('#emop') && !e.target.closest('[data-emo-abrir]')) p.hidden = true; });
  }
  if (!p.hidden && p._campo === campo) { p.hidden = true; return; }
  p._campo = campo; p.innerHTML = EMOJIS.map(x => `<button type="button" data-emo="${x}" aria-label="${x}">${x}</button>`).join('');
  const r = boton.getBoundingClientRect(); p.hidden = false; p.style.left = Math.max(8, Math.min(r.left, innerWidth - p.offsetWidth - 8)) + 'px'; p.style.top = Math.max(8, r.top - p.offsetHeight - 6) + 'px';
}
document.querySelector('.box .bar [data-emo-abrir]').addEventListener('click', e => { e.stopPropagation(); abrirEmojis(e.currentTarget, ta); });
document.querySelector('.nm .ft [data-emo-abrir]').addEventListener('click', e => { e.stopPropagation(); abrirEmojis(e.currentTarget, nmTxt); });
// Elegir un archivo del computador.
function elegirArchivo(accept, cb){ const i = document.createElement('input'); i.type = 'file'; i.accept = accept; i.hidden = true; document.body.appendChild(i); i.addEventListener('change', () => { const f = i.files && i.files[0]; i.remove(); if (f) cb(f); }); i.click(); }
const ACEPTA = 'image/*,video/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx';
function enviarArchivoPc(c){
  elegirArchivo(ACEPTA, async f => {
    toast(`Subiendo ${f.name}…`);
    try { const r = await crmSubir(f); c.msgs.push({out: ta.value.trim(), file:{n:r.n || f.name, t:r.t, url:r.url, mime:r.mime, ic:/^video/.test(r.mime || '') ? 'play' : 'file'}, by:yo, h:'ahora'}); ta.value = ''; if (st.sel === c.id) { chat(); lista(); } toast(`Enviado: ${r.n || f.name}`); }
    catch (err) { toast(err.message); }
  });
}
// Adjuntar en Conversación nueva.
document.querySelector('.nm .ft [aria-label="Adjuntar"]').addEventListener('click', () => elegirArchivo(ACEPTA, async f => {
  toast(`Subiendo ${f.name}…`);
  try { const r = await crmSubir(f); nm.adj = {n:r.n || f.name, t:r.t, url:r.url, mime:r.mime}; pintarNmAdj(); toast('Archivo listo para enviar'); } catch (err) { toast(err.message); }
}));
document.getElementById('ov').addEventListener('click', e => { if (e.target.closest('#nm-adj-x')) { nm.adj = null; pintarNmAdj(); } });
// Nota de voz: se graba en el navegador, se sube y sale como audio.
let grabacion = null;
async function notaDeVoz(boton){
  if (grabacion) { grabacion.rec.stop(); return; }
  if (notaLista) { URL.revokeObjectURL(notaLista.url); notaLista = null; }
  const c = conv(); if (!c) return;
  if (/cerrada/i.test(c.ventana)) { toast(cerradaTxt(c)); return; }
  if (!navigator.mediaDevices || !window.MediaRecorder) { toast('Este navegador no deja grabar audio'); return; }
  let flujo; try { flujo = await navigator.mediaDevices.getUserMedia({audio:true}); } catch { toast('Permite el micrófono para grabar la nota de voz'); return; }
  const tipo = ['audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'].find(t => MediaRecorder.isTypeSupported(t)) || '';
  const rec = new MediaRecorder(flujo, tipo ? {mimeType: tipo} : undefined), partes = [], inicio = Date.now(), adj = document.getElementById('adj');
  const pintar = () => { const s = Math.floor((Date.now() - inicio) / 1000); adj.innerHTML = `${I('mic')}<span>Grabando nota de voz · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}<small>Toca el micrófono otra vez para detenerla</small></span><button type="button" id="voz-x" aria-label="Cancelar la nota de voz">${I('x')}</button>`; adj.hidden = false; };
  grabacion = {rec, c, cancelada:false, t:setInterval(pintar, 500)};
  rec.ondataavailable = e => { if (e.data.size) partes.push(e.data); };
  rec.onstop = async () => {
    const g = grabacion; grabacion = null; clearInterval(g.t); flujo.getTracks().forEach(t => t.stop()); boton.classList.remove('rec'); boton.setAttribute('aria-pressed', 'false'); adj.hidden = true; adj.innerHTML = '';
    if (g.cancelada) { toast('Nota de voz cancelada'); return; }
    const dur = Math.round((Date.now() - inicio) / 1000); if (dur < 1 || !partes.length) { toast('La nota de voz quedó vacía'); return; }
    const mime = (rec.mimeType || tipo || 'audio/webm').split(';')[0], ext = mime.includes('ogg') ? 'ogg' : mime.includes('mp4') ? 'm4a' : 'webm';
    // Como en WhatsApp (6-oct): al detenerla no sale sola; se puede escuchar, borrar o enviar.
    const blob = new Blob(partes, {type: mime});
    notaLista = {c: g.c, blob, mime, ext, dur, url: URL.createObjectURL(blob)};
    pintarNotaLista();
  };
  rec.start(); boton.classList.add('rec'); boton.setAttribute('aria-pressed', 'true'); pintar();
}
document.querySelector('.box .bar [aria-label="Nota de voz"]').addEventListener('click', e => notaDeVoz(e.currentTarget));
document.getElementById('adj').addEventListener('click', e => { if (e.target.closest('#voz-x') && grabacion) { grabacion.cancelada = true; grabacion.rec.stop(); } });
// La nota grabada, lista para escuchar, borrar o enviar.
let notaLista = null;
function pintarNotaLista(){
  const adj = document.getElementById('adj'), n = notaLista; adj.replaceChildren();
  if (!n) { adj.hidden = true; return; }
  const m = Math.floor(n.dur / 60), s = String(n.dur % 60).padStart(2, '0');
  adj.insertAdjacentHTML('beforeend', `${I('mic')}<span style="display:flex;align-items:center;gap:10px;flex:1;min-width:0"><audio controls preload="metadata" src="${n.url}" style="height:34px;flex:1;min-width:0;max-width:340px"></audio><small style="white-space:nowrap">${m}:${s}</small></span><button type="button" class="btn" id="voz-borrar" aria-label="Borrar la nota de voz">${I('x')}Borrar</button><button type="button" class="btn pri" id="voz-enviar">${I('send')}Enviar</button>`);
  adj.hidden = false;
}
document.getElementById('adj').addEventListener('click', async e => {
  if (!notaLista) return;
  if (e.target.closest('#voz-borrar')) { URL.revokeObjectURL(notaLista.url); notaLista = null; pintarNotaLista(); toast('Nota de voz borrada'); return; }
  const b = e.target.closest('#voz-enviar'); if (!b) return;
  const n = notaLista; b.disabled = true; toast('Enviando la nota de voz…');
  try {
    const r = await crmSubir(new File([n.blob], `nota-de-voz.${n.ext}`, {type: n.mime}));
    n.c.msgs.push({out:'', audio:{url:r.url, dur:n.dur, mime:r.mime || n.mime}, by:yo, h:'ahora'}); n.c.unread = 0;
    URL.revokeObjectURL(n.url); notaLista = null; pintarNotaLista();
    if (st.sel === n.c.id) { chat(); lista(); } toast('Nota de voz enviada');
  } catch (err) { b.disabled = false; toast(err.message); }
});

// Los interruptores sin nombre toman el de su fila (Lunes, Flujo activo…), para que los lectores de pantalla digan qué prenden.
new MutationObserver(() => {
  document.querySelectorAll('[role="switch"]:not([aria-label]):not([aria-labelledby])').forEach(s => {
    const f = s.closest('.row2, .tgr, .opt, li'), t = f && f.querySelector('span, b');
    const n = t ? ([...t.childNodes].find(x => x.nodeType === 3 && x.textContent.trim()) || t.firstElementChild || t).textContent.trim() : '';
    if (n) s.setAttribute('aria-label', n);
  });
}).observe(document.body, {childList: true, subtree: true});

/* Ayuda al pasar el cursor o al llegar con el teclado (data-tip): qué hace cada botón del chat. */
(() => {
  const tip = document.createElement('div'); tip.className = 'tip'; tip.setAttribute('role', 'tooltip'); tip.hidden = true; document.body.appendChild(tip);
  let espera = null, sobre = null;
  const mostrar = el => {
    if (!el.isConnected || el.hidden) return;
    tip.textContent = el.dataset.tip; tip.hidden = false;
    const r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    const x = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 8)), arriba = r.top - h - 8;
    tip.style.left = x + 'px'; tip.style.top = (arriba >= 8 ? arriba : r.bottom + 8) + 'px';
  };
  const ocultar = () => { clearTimeout(espera); espera = null; sobre = null; tip.hidden = true; };
  document.addEventListener('mouseover', e => { const el = e.target.closest('[data-tip]'); if (el === sobre) return; ocultar(); if (!el) return; sobre = el; espera = setTimeout(() => mostrar(el), 300); });
  document.addEventListener('focusin', e => { const el = e.target.closest('[data-tip]'); if (el && el.matches(':focus-visible')) { ocultar(); sobre = el; mostrar(el); } });
  document.addEventListener('focusout', ocultar);
  document.addEventListener('mousedown', ocultar);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') ocultar(); });
  document.addEventListener('scroll', ocultar, true);
})();
