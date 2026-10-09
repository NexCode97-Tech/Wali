
/* ── Protección de datos y reglas de contacto (25-sep), verificadas con las fuentes oficiales:
   Ley 1581 de 2012 y Decreto 1377 de 2013: autorización previa, expresa e informada; el silencio no cuenta; con menores autoriza el representante legal.
   Ley 2300 de 2023, art. 5 par. 3: llamadas y mensajes comerciales de lunes a viernes de 7 a. m. a 7 p. m. y sábados de 8 a. m. a 3 p. m.
   Registro de Números Excluidos de la CRC: consultarlo antes de un contacto comercial, salvo que la persona haya autorizado a la empresa.
   26-sep: la hora es la real de Colombia y los festivos se calculan para cualquier año. La autorización se pide por WhatsApp
   de verdad; desde el 28-sep, si la persona responde «Autorizo» queda marcada sola (api autorizacion.ts), y si responde
   otra cosa la marca una persona del equipo. ── */
document.head.insertAdjacentHTML('beforeend', `<style>
.pd-lista{display:grid;gap:6px}
.pd-lista .row2{border-top:1px solid var(--line2);padding-top:8px}
.pd-fest{display:flex;flex-wrap:wrap;gap:6px}
.pd-fest span{font-size:12px;border:1px solid var(--line);border-radius:999px;padding:2px 10px;color:var(--ink2)}
.pd-est{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:600;border-radius:999px;padding:2px 10px}
.pd-est.no{background:var(--amber-soft);color:var(--amber-ink)}
.pd-est.si{background:var(--green-soft);color:var(--green-ink)}
</style>`);

const DIAS_SEM = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
const MESES_C = ['ene.','feb.','mar.','abr.','may.','jun.','jul.','ago.','sept.','oct.','nov.','dic.'];
const isoF = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const fmtMin = m => `${((Math.floor(m / 60) + 11) % 12) + 1}${m % 60 ? ':' + String(m % 60).padStart(2, '0') : ''} ${m < 720 ? 'a. m.' : 'p. m.'}`;
// Hora real de Colombia (America/Bogota), sin importar la zona del computador.
function ahoraCO(){
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {timeZone:'America/Bogota', year:'numeric', month:'numeric', day:'numeric', hour:'numeric', minute:'numeric', hourCycle:'h23', weekday:'short'}).formatToParts(new Date()).map(x => [x.type, x.value]));
  return {y:+p.year, m:+p.month, d:+p.day, h:+p.hour % 24, mi:+p.minute, wd:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(p.weekday)};
}
// Día de Colombia (AAAA-MM-DD) de un instante, y comienzo del día de hace `n` días en milisegundos (Colombia es UTC−5 todo el año).
const FMT_DIA_CO = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Bogota', year:'numeric', month:'2-digit', day:'2-digit'});
const diaColombia = t => { const d = new Date(t); return isNaN(d) ? '' : FMT_DIA_CO.format(d); };
const inicioDiaColombia = (n = 0) => { const t = ahoraCO(); return Date.UTC(t.y, t.m - 1, t.d - n, 5); };
// Festivos de Colombia de cualquier año (Ley 51 de 1983): los fijos, los que pasan al lunes siguiente (Ley Emiliani)
// y los que dependen de la Pascua (Jueves y Viernes Santo fijos; Ascensión, Corpus Christi y Sagrado Corazón al lunes).
const FESTIVOS_AÑO = {};
function festivosCO(y){
  if (FESTIVOS_AÑO[y]) return FESTIVOS_AÑO[y];
  const dia = (mes, d) => new Date(Date.UTC(y, mes - 1, d));
  const alLunes = f => { f.setUTCDate(f.getUTCDate() + (8 - f.getUTCDay()) % 7); return f; };
  // Domingo de Pascua, calendario gregoriano (algoritmo anónimo de Meeus).
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, n = Math.floor((a + 11 * h + 22 * l) / 451);
  const mesP = Math.floor((h + l - 7 * n + 114) / 31), diaP = ((h + l - 7 * n + 114) % 31) + 1, pascua = x => dia(mesP, diaP + x);
  const L = [dia(1, 1), dia(5, 1), dia(7, 20), dia(8, 7), dia(12, 8), dia(12, 25),
    ...[[1, 6], [3, 19], [6, 29], [8, 15], [10, 12], [11, 1], [11, 11]].map(([mes, dd]) => alLunes(dia(mes, dd))),
    pascua(-3), pascua(-2), alLunes(pascua(39)), alLunes(pascua(60)), alLunes(pascua(68))];
  return FESTIVOS_AÑO[y] = L.map(x => x.toISOString().slice(0, 10)).sort();
}
const esFestivo = (y, m, d) => festivosCO(y).includes(isoF(y, m, d));
// Franja permitida para contacto comercial ese día, en minutos; null si no se puede (domingo o festivo).
function franjaLegal(dt){
  if (esFestivo(dt.getFullYear(), dt.getMonth() + 1, dt.getDate()) || dt.getDay() === 0) return null;
  return dt.getDay() === 6 ? [8 * 60, 15 * 60] : [7 * 60, 19 * 60];
}
function horarioLegal(t = ahoraCO()){
  const hoy = new Date(t.y, t.m - 1, t.d), v = franjaLegal(hoy), min = t.h * 60 + t.mi;
  if (v && min >= v[0] && min < v[1]) return {ok:true};
  const motivo = esFestivo(t.y, t.m, t.d) ? 'Hoy es festivo.' : t.wd === 0 ? 'Hoy es domingo.' : v && min < v[0] ? 'Todavía no empieza el horario permitido.' : 'Ya pasó el horario permitido de hoy.';
  // `para`: el momento (ISO) en que vuelve a abrir la franja permitida, para un recordatorio.
  const para = (dias, minutos) => new Date(Date.UTC(t.y, t.m - 1, t.d + dias, 0, minutos) + 5 * 3600e3).toISOString();
  if (v && min < v[0]) return {ok:false, motivo, siguiente:`hoy a las ${fmtMin(v[0])}`, para:para(0, v[0])};
  const dt = new Date(hoy);
  for (let i = 1; i <= 10; i++) { dt.setDate(dt.getDate() + 1); const w = franjaLegal(dt); if (w) return {ok:false, motivo, siguiente:`${i === 1 ? 'mañana' : 'el ' + DIAS_SEM[dt.getDay()] + ' ' + dt.getDate()} a las ${fmtMin(w[0])}`, para:para(i, w[0])}; }
  return {ok:false, motivo, siguiente:'el próximo día hábil', para:null};
}

/* Autorización de datos de cada contacto: viene guardada en el contacto (c.aut, c.rep, c.rne) */
// Menor de edad: por la edad de sus campos; si no la hay, lo que tenga guardado el contacto.
function menorDeEdad(c){
  const e = parseInt((c.campos || {}).edad, 10); if (e > 0) return e < 18;
  return !!c.menor;
}
// Si «Menores de edad: pedirla al representante legal» está encendido (Protección de datos), el menor necesita la autorización del representante legal.
const pideRepresentante = c => PD.menores !== false && menorDeEdad(c);
const nombrePila = c => /^\+?\d/.test(c.n || '') ? '' : String(c.n || '').split(' ')[0];
function puedeGrabar(c){
  const L = LLAM.lineas[c.linea] || {};
  if (!L.grabar) return {ok:false, motivo:'la grabación está apagada en esta línea'};
  // La autorización de datos se toma en la misma llamada: WhatsApp avisa en voz alta el propósito antes de grabar (6-oct).
  return {ok:true};
}
function filaGrabacion(c){
  const p = puedeGrabar(c);
  return fila('Grabación', p.ok ? 'WhatsApp avisa en voz alta el propósito antes de grabar' : `No se grabará: ${p.motivo}`, p.ok ? '<span class="ll-ok">Sí</span>' : p.pedir ? `<button type="button" class="btn" data-ll-aut="1">Pedir autorización</button>` : '<span class="muted">No</span>');
}
// Estado de los datos en la ficha del contacto (maqueta del panel, 28-sep): recuadro con Pedir y Ya autorizó, o una línea verde.
function marcarDatosFicha(){
  const panel = document.getElementById('panel'), cont = panel && panel.querySelector('.contact'); if (!cont || cont.querySelector('.pc-dat')) return;
  const c = CONV.find(x => x.id === st.sel); if (!c) return;
  const menor = pideRepresentante(c);
  const caja = (cls, ic, t, pedir) => `<div class="pc-aut pc-dat ${cls}"><span class="h">${I(ic)}${t}</span><span class="bt"><button type="button" class="pc-sb" data-ll-aut="1">${pedir}</button><button type="button" class="pc-sb" data-aut-marcar="1">Ya autorizó</button></span></div>`;
  const h = c.rne && !c.aut ? caja('rojo', 'block', 'En el Registro de Números Excluidos', 'Pedir')
    : !c.aut ? caja('', 'lock', 'Sin autorización de datos', 'Pedir')
    : menor && !c.rep ? caja('', 'lock', 'Menor de edad · falta el representante legal', 'Pedir al representante legal')
    : `<span class="pc-ok pc-dat">${I('shield-ok')}Datos autorizados${c.aut.via ? ' · ' + esc(c.aut.via) : ''}${menor ? ' · representante legal' : ''}</span>`;
  cont.insertAdjacentHTML('beforeend', h);
}
const repintarDatosFicha = () => { const p = document.getElementById('panel'), v = p && p.querySelector('.pc-dat'); if (v) v.remove(); marcarDatosFicha(); };
// Sin el recuadro de autorización en la ficha (6-oct): la autorización queda en la grabación de la llamada.

/* Pedir la autorización por WhatsApp (al cliente o a su representante legal). Queda pendiente hasta que alguien del equipo la marque. */
function textoAutorizacion(c, rep){
  const n1 = nombrePila(c);
  return rep
    ? `Hola. Te escribimos de ${ESPACIO.nombre || 'nuestra empresa'} porque ${n1 || 'tu hijo o tu hija'} es menor de edad y, para grabar sus llamadas, necesitamos la autorización de su papá, su mamá o su representante legal.\n\n${PD.texto}\n\nSi estás de acuerdo, responde «Autorizo» a este mensaje.`
    : `Hola${n1 ? ', ' + n1 : ''}. Para seguir atendiéndote necesitamos tu autorización para el tratamiento de tus datos.\n\n${PD.texto}\n\nSi estás de acuerdo, responde «Autorizo» a este mensaje.`;
}
const ventanaAut = c => !c._t || (!!c._t.entrante && Date.now() - Date.parse(c._t.entrante) < 864e5);
function pedirAutorizacion(c, tel){
  if (!pideRepresentante(c) || !c.aut) {
    if (!ventanaAut(c)) { toast('Pasaron más de 24 horas desde su último mensaje: WhatsApp solo deja enviarle una plantilla'); return; }
    c.msgs.push({out:textoAutorizacion(c, false), by:yo, h:'ahora'});
    c.msgs.push({ev:'lock', t:`Se le pidió la autorización de datos a ${nombrePila(c) || c.n} por WhatsApp. Si responde «Autorizo», queda marcada sola.`});
    chat(); toast('Solicitud de autorización enviada'); return;
  }
  // El representante legal nunca le ha escrito a la línea: WhatsApp solo deja empezar con una plantilla aprobada.
  const tpl = TPL.find(t => t.n === TPL_REP);
  if (!tpl) { toast(`Falta la plantilla «${TPL_REP}» aprobada por Meta. Créala en Plantillas con el texto de la autorización.`); return; }
  const vars = {menor: nombrePila(c) || c.n.split(' ')[0]};
  toast('Enviando la solicitud al representante legal…');
  crmApi('POST', '/crm/conversaciones', {tel, n:`Representante de ${c.n}`, linea:c.linea, canal:'wa', datos:[{out:llenarVars(tpl.x, vars), plantilla:tpl.n, vars, by:yo}]})
    .then(esperarEnvio)
    .then(m => {
      if (!m || m._estado === 'fallido') { toast(`No le llegó al representante legal: ${(m && m._error) || 'WhatsApp no confirmó el envío'}`); return; }
      c.msgs.push({ev:'lock', t:`Se le pidió la autorización de datos a su representante legal (${tel}) por WhatsApp. Si responde «Autorizo», queda marcada sola.`});
      if (st.sel === c.id && !st.pagina) chat();
      toast(m._estado === 'enviando' ? 'La solicitud sigue saliendo: revisa la conversación del representante legal' : 'Solicitud enviada al representante legal');
    })
    .catch(err => toast(`No se pudo enviar al representante legal: ${err.message}`));
}
const TPL_REP = 'Autorización del representante legal';
// El envío por WhatsApp corre aparte: se espera (hasta ~20 s) a que el mensaje quede enviado o fallido.
async function esperarEnvio(conv){
  let m = conv && (conv.msgs || []).filter(x => x.out != null).slice(-1)[0];
  for (let i = 0; i < 8 && conv && conv.id && (!m || m._estado === 'enviando'); i++) {
    await new Promise(r => setTimeout(r, 2500));
    const l = await crmApi('GET', `/crm/conversaciones/${conv.id}/mensajes`).catch(() => null);
    m = (l || []).filter(x => x.out != null).slice(-1)[0] || m;
  }
  return m;
}
// Marcar la autorización cuando llega la respuesta: queda con la fecha, el medio y el texto que se autorizó.
const VIAS_AUT = ['Respondió por WhatsApp', 'Formulario web', 'Formulario impreso', 'Por escrito'];
function dlgMarcarAut(c){
  const x = st.autMarca, menor = pideRepresentante(c);
  return `<h3>Marcar la autorización de datos</h3><p>Márcala solo cuando la persona haya respondido que autoriza. Queda guardada con la fecha y el texto de la autorización.</p>
    <div class="cx-f">${menor ? `<div class="fld">Quién autorizó${ddSel('data-aut-quien', [['titular', nombrePila(c) || 'El cliente'], ['representante', 'Su representante legal']], x.quien)}</div>` : ''}
      <div class="fld">Cómo autorizó${ddSel('data-aut-via', VIAS_AUT, x.via)}</div></div>
    <div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" data-aut-ok="1">${I('check')}Marcar</button></div>`;
}
document.addEventListener('click', e => {
  const a = e.target.closest('[data-ll-aut]');
  if (a) {
    e.stopPropagation();
    const c = CONV.find(x => x.id === st.sel); if (!c) return;
    const necesitaRep = pideRepresentante(c) && c.aut, tel = c.campos && c.campos.telRepresentante;
    if (necesitaRep && !tel) {
      abrirDialogo(`<h3>Autorización del representante legal</h3><p>${esc(c.n)} es menor de edad. Para grabar sus llamadas, la autorización la tiene que dar su papá, su mamá o su representante legal.</p>
        <label class="fld">WhatsApp del representante legal<input id="aut-tel" inputmode="tel" placeholder="Ej. +57 310 555 0199"></label>
        <p class="muted">Le llega por WhatsApp la plantilla «${TPL_REP}» para que responda; donde diga {{menor}} va el nombre del menor. El número queda guardado en «Datos del cliente».</p>
        <div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" data-aut-enviar="1">${I('send')}Enviar</button></div>`);
      return;
    }
    cerrarDialogo(); pedirAutorizacion(c, tel); return;
  }
  const env = e.target.closest('[data-aut-enviar]');
  if (env) {
    e.stopPropagation();
    const c = CONV.find(x => x.id === st.sel), tel = document.getElementById('aut-tel').value.trim(); if (!c) return;
    if (tel.replace(/\D/g, '').length < 10) { toast('Escribe el WhatsApp completo del representante legal'); return; }
    c.campos = c.campos || {}; c.campos.telRepresentante = tel; cerrarDialogo(); pedirAutorizacion(c, tel); return;
  }
  if (e.target.closest('[data-aut-marcar]')) {
    e.stopPropagation();
    const c = CONV.find(x => x.id === st.sel); if (!c) return;
    st.autMarca = {quien: pideRepresentante(c) && c.aut ? 'representante' : 'titular', via: VIAS_AUT[0]};
    abrirDialogo(dlgMarcarAut(c)); return;
  }
  const mq = e.target.closest('[data-aut-quien], [data-aut-via]');
  if (mq && st.autMarca) {
    e.stopPropagation();
    const c = CONV.find(x => x.id === st.sel); if (!c) return;
    if (mq.dataset.autQuien) st.autMarca.quien = mq.dataset.autQuien; else st.autMarca.via = mq.dataset.autVia;
    abrirDialogo(dlgMarcarAut(c)); return;
  }
  if (e.target.closest('[data-aut-ok]') && st.autMarca) {
    e.stopPropagation();
    const c = CONV.find(x => x.id === st.sel); if (!c) return;
    const x = st.autMarca, reg = {via:x.via, fecha:new Date().toISOString(), texto:PD.texto, por:yo};
    const rep = pideRepresentante(c) && x.quien === 'representante';
    if (rep) { c.rep = reg; if (!c.aut) c.aut = reg; } else c.aut = reg;
    c.msgs.push({ev:'lock', t:`${yo} marcó la autorización de datos${rep ? ' del representante legal' : ''} · ${x.via}`});
    st.autMarca = null; cerrarDialogo();
    if (st.sel === c.id && !st.pagina) { chat(); repintarDatosFicha(); }
    toast('Autorización marcada'); return;
  }
  const r = e.target.closest('[data-ll-recordar]');
  if (r) {
    e.stopPropagation(); const c = CONV.find(x => x.id === st.sel); if (!c) return; cerrarDialogo();
    const cuando = r.dataset.llRecordar; c.recs = c.recs || [];
    c.recs.push({t:`Llamar a ${nombrePila(c) || c.n}`, cuando:cuando[0].toUpperCase() + cuando.slice(1), para:r.dataset.para || null, estado:'futuro', hecho:false});
    c.msgs.push({ev:'bell', t:`${yo} programó un recordatorio: llamar ${cuando}`}); chat(); toast(`Te lo recuerdo ${cuando}`);
  }
}, true);

/* Página «Protección de datos» */
const PD = {rneInscrito:false, rneOn:true, texto:'Autorizo a tratar mis datos personales para contactarme por WhatsApp, llamadas y correo con información de sus productos y servicios, y a grabar las llamadas para mejorar la atención, según su política de tratamiento de datos.', menores:true};
function paginaDatos(){
  const volver = `<button type="button" class="volver" data-ir="ajustes-crm">${I('back')}Ajustes del CRM</button>`;
  const con = CONV.filter(c => c.canal === 'wa' || c.canal === 'ig' || c.canal === 'fb');
  const sinAut = con.filter(c => !c.aut).length, menSin = con.filter(c => pideRepresentante(c) && c.aut && !c.rep).length, rne = CONV.filter(c => c.rne);
  const hoy = ahoraCO(), prox = [...festivosCO(hoy.y), ...festivosCO(hoy.y + 1)].filter(f => f >= isoF(hoy.y, hoy.m, hoy.d)).slice(0, 5).map(f => { const [, m, d] = f.split('-').map(Number); return `${d} ${MESES_C[m - 1]}`; });
  return `<div class="ajw ancho">${volver}<h2>Protección de datos</h2><p class="sub">Lo que exige la ley colombiana para contactar, llamar y grabar a los clientes. El CRM lo aplica solo.</p>
    <div class="two3" style="align-items:start"><div class="cfg">
      <div class="box2"><h4>${I('lock')}Autorización de datos</h4>
        <label class="fld">Texto de la autorización<textarea data-pd-texto="1" rows="4">${esc(PD.texto)}</textarea></label>
        ${fila('Dónde se pide', 'En los formularios de la empresa y por WhatsApp cuando falta', '')}
        ${fila('Menores de edad: pedirla al representante legal', 'La ley exige que autorice el papá, la mamá o el representante legal', `<button type="button" class="tg" role="switch" data-pd-tg="menores" aria-checked="${PD.menores}" aria-label="Pedir al representante legal"></button>`)}
        ${fila('Contactos sin autorización', 'No se les graba ninguna llamada', `<b>${sinAut}</b>`)}
        ${fila('Menores sin autorización del representante legal', 'Se les puede atender, pero no se graba', `<b>${menSin}</b>`)}
        <p class="muted" style="margin:0">La política de tratamiento de datos de la empresa tiene que mencionar la grabación de llamadas y su propósito.</p></div>
      <div class="box2"><h4>${I('clock')}Horario para contactar con fines comerciales</h4>
        ${fila('Lunes a viernes', '', '7 a. m. a 7 p. m.')}${fila('Sábados', '', '8 a. m. a 3 p. m.')}${fila('Domingos y festivos', '', 'No se contacta')}
        <div class="fld">Próximos festivos<div class="pd-fest">${prox.map(x => `<span>${x}</span>`).join('')}</div></div>
        <p class="muted" style="margin:0">Lo fija la Ley 2300 de 2023 y no se puede cambiar. Aplica a las llamadas que hace el asesor y a las difusiones. No aplica cuando el cliente escribe o llama.</p></div>
    </div><div class="cfg">
      <div class="box2"><h4>${I('block')}Registro de Números Excluidos</h4>
        <p class="muted" style="margin:0">Es el registro de la CRC donde las personas inscriben su número para no recibir mensajes ni llamadas comerciales. Desde abril de 2024 hay que consultarlo antes de contactar, también por WhatsApp.</p>
        ${fila('La empresa está inscrita para consultarlo', 'La inscripción se hace en tramitescrcom.gov.co', PD.rneInscrito ? `<span style="display:flex;align-items:center;gap:8px"><span class="pd-est si">Inscrito</span><button type="button" class="btn" data-pd-inscrito="0">Desmarcar</button></span>` : `<button type="button" class="btn" data-pd-inscrito="1">Marcar como inscrito</button>`)}
        ${fila('No contactar a los números del registro', 'Salvo que hayan autorizado a la empresa. Si escriben primero, se les responde por el chat', `<button type="button" class="tg" role="switch" data-pd-tg="rneOn" aria-checked="${PD.rneOn}" aria-label="No contactar a los números del registro"></button>`)}
        <div class="fld">Contactos en el registro<div class="pd-lista">${rne.map(c => fila(esc(c.n), `${esc(c.tel)} · ${c.aut ? 'autorizó a la empresa' : 'no ha autorizado'}`, c.aut ? '<span class="pd-est si">Se puede contactar</span>' : '<span class="pd-est no">Sin llamadas ni difusiones</span>')).join('') || '<p class="muted" style="margin:0">Ningún contacto está marcado en el registro.</p>'}</div></div>
        <p class="muted" style="margin:0">Cómo se consulta el registro, por servicio web o por descarga, se confirma con la CRC al inscribir a la empresa.</p></div>
    </div></div></div>`;
}
const paginaCfgLegal = paginaCfg;
paginaCfg = function(k){ return k === 'datos' ? paginaDatos() : paginaCfgLegal(k); };
document.getElementById('page').addEventListener('click', e => {
  if (st.pagina !== 'cfg-datos') return;
  const tg = e.target.closest('[data-pd-tg]'); if (tg) { PD[tg.dataset.pdTg] = !PD[tg.dataset.pdTg]; render(); toast(PD[tg.dataset.pdTg] ? 'Activado' : 'Apagado'); return; }
  const ins = e.target.closest('[data-pd-inscrito]'); if (ins) { PD.rneInscrito = ins.dataset.pdInscrito === '1'; render(); toast(PD.rneInscrito ? 'La empresa queda como inscrita en el registro' : 'La empresa queda como no inscrita en el registro'); }
});
document.getElementById('page').addEventListener('change', e => { if (st.pagina === 'cfg-datos' && e.target.dataset.pdTexto) { PD.texto = e.target.value; toast('Texto guardado'); } });

/* Difusiones: horario permitido y registro de excluidos */
function diasPermitidos(){
  const t = ahoraCO(), out = [], dt = new Date(t.y, t.m - 1, t.d);
  for (let i = 0; out.length < 8 && i < 20; i++, dt.setDate(dt.getDate() + 1)) {
    const w = franjaLegal(dt); if (!w) continue;
    const desde = i === 0 ? Math.ceil((t.h * 60 + t.mi + 1) / 30) * 30 : w[0]; if (desde > w[1] - 30) continue;
    const et = `${DIAS_SEM[dt.getDay()][0].toUpperCase()}${DIAS_SEM[dt.getDay()].slice(1)} ${dt.getDate()} de ${MESES_C[dt.getMonth()]}`;
    out.push([isoF(dt.getFullYear(), dt.getMonth() + 1, dt.getDate()), i === 0 ? 'Hoy, ' + et.toLowerCase() : et, Math.max(desde, w[0]), w[1]]);
  }
  return out;
}
const difusionBase = difusion;
difusion = function(){
  difusionBase();
  const d = st.dif, el = document.getElementById('page');
  const aud = el.querySelector('.aud span'); if (aud) aud.textContent = 'Se descuentan las que pidieron no recibir mensajes, los números del Registro de Números Excluidos que no han autorizado a la empresa y las que ya recibieron esta plantilla en los últimos 7 días.';
  if (d.paso !== 3) return;
  const hl = horarioLegal(); if (!d.cuando || (d.cuando === 'ahora' && !hl.ok)) d.cuando = hl.ok ? 'ahora' : 'prog';
  const dias = diasPermitidos(); if (!dias.find(x => x[0] === d.dia)) d.dia = dias[0][0];
  const dia = dias.find(x => x[0] === d.dia), horas = []; for (let m = dia[2]; m <= dia[3] - 30; m += 30) horas.push([String(m), fmtMin(m)]);
  if (!horas.find(x => x[0] === d.hora)) d.hora = horas[0][0];
  const cu = el.querySelector('[data-cuando]'), fc = cu && cu.closest('.fld');
  if (fc) fc.outerHTML = `<div class="fld">Cuándo${ddSel('data-dcu', [['ahora', hl.ok ? 'Ahora' : 'Ahora no: fuera del horario permitido'], ['prog', 'Programar']], d.cuando)}</div>
    ${d.cuando === 'prog' ? `<div class="two3" style="grid-template-columns:1fr 1fr"><div class="fld">Día${ddSel('data-ddia', dias.map(x => [x[0], x[1]]), d.dia)}</div><div class="fld">Hora${ddSel('data-dhora', horas, d.hora)}</div></div>` : ''}
    <p class="muted" style="margin:0">Solo se muestran los días y las horas que permite la Ley 2300: lunes a viernes de 7 a. m. a 7 p. m. y sábados de 8 a. m. a 3 p. m. Si no alcanza a salir completa, se pausa y sigue el siguiente día permitido.</p>`;
  const dt = el.querySelector('input[type="datetime-local"]'); if (dt) dt.closest('label').remove();
  const ri = el.querySelector('[data-ritmo]'), fr = ri && ri.closest('.chips2');
  if (fr) fr.outerHTML = ddSel('data-drit', [['200', '200 por hora, recomendado'], ['500', '500 por hora']], String(d.ritmo || 200));
};
document.getElementById('page').addEventListener('click', e => {
  const d = st.dif; if (!d) return; const t = e.target;
  const cu = t.closest('[data-dcu]'); if (cu) { if (cu.dataset.dcu === 'ahora' && !horarioLegal().ok) { toast(`Ahora no se puede enviar: ${horarioLegal().motivo} Prográmala.`); return; } d.cuando = cu.dataset.dcu; render(); return; }
  const di = t.closest('[data-ddia]'); if (di) { d.dia = di.dataset.ddia; d.hora = null; render(); return; }
  const ho = t.closest('[data-dhora]'); if (ho) { d.hora = ho.dataset.dhora; render(); return; }
  const ri = t.closest('[data-drit]'); if (ri) { d.ritmo = +ri.dataset.drit; render(); return; }
  if (t.closest('#d-go') && d.paso === 3) {
    if (d.cuando === 'ahora' && horarioLegal().ok) return;
    e.stopPropagation();
    if (d.cuando === 'ahora') { toast(`Ahora no se puede enviar: ${horarioLegal().motivo}`); return; }
    const dia = diasPermitidos().find(x => x[0] === d.dia), min = +d.hora, cuando = `${dia[1]} · ${fmtMin(min)}`;
    // Lo mismo que la de «Ahora» (difNueva, 10-nucleo.js), con `para` = el día y la hora elegidos en hora de Colombia (−05:00).
    const para = `${dia[0]}T${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}:00-05:00`;
    if (!TPL[d.tpl]) { toast('Falta una plantilla aprobada por Meta'); return; }
    const nueva = difNueva(d, {f: cuando, e: 'Programada', para});
    if (!nueva.total) { toast('Esta difusión no tiene a quién enviarle: revisa el público'); return; }
    DIFUSIONES.unshift(nueva);
    st.dif = null; render(); toast(`Difusión programada: ${cuando.toLowerCase()}`);
  }
}, true);
