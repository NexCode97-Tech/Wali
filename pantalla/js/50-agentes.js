
/* ── Agentes IA: el primer contacto lo hace una IA que conversa natural, entiende qué necesita
   la persona y la pasa al equipo correcto. El flujo de botones «Bienvenida» queda de respaldo si el agente está apagado. ── */
document.querySelector('symbol').parentNode.insertAdjacentHTML('beforeend', '<symbol id="i-trash" viewBox="0 0 24 24"><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4h6v3"/></symbol><symbol id="i-power" viewBox="0 0 24 24"><path d="M12 3v8"/><path d="M6.4 7.4a8 8 0 1 0 11.2 0"/></symbol><symbol id="i-bot" viewBox="0 0 24 24"><rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 4.5V8M9 13h.01M15 13h.01M9.5 16h5"/><circle cx="12" cy="3.5" r="1"/></symbol>');
document.head.insertAdjacentHTML('beforeend', `<style>
.ag-w{max-width:1320px}
.ag-tb{width:100%;border-collapse:collapse;font-size:13px}
.ag-tb th{text-align:left;font-weight:600;color:var(--ink2);font-size:12px;padding:8px 10px;border-bottom:1px solid var(--line)}
.ag-tb td{padding:12px 10px;border-bottom:1px solid var(--line2);vertical-align:middle}
.ag-tb td.n{display:flex;align-items:center;gap:10px}
.ag-av{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;color:#fff;flex:none}
.ag-av svg{width:18px;height:18px}
.ag-bts{display:flex;gap:8px;justify-content:flex-end;align-items:center}
.ag-pw{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;border:1px solid var(--line);background:#fff;color:var(--ink4);transition:background .15s,color .15s}
.ag-pw:hover{border-color:var(--ink4);color:var(--ink2)}
.ag-pw.on{background:#16a34a;border-color:#16a34a;color:#fff}
.ag-pw.del:hover{border-color:#fca5a5;background:#fef2f2;color:#b91c1c}
.ag-pw.on:hover{background:#15803d}
.ag-pw svg{width:17px;height:17px;stroke-width:2.2}
.ag-est{font-size:11.5px;font-weight:600;border-radius:999px;padding:2px 9px}
.ag-est.on{background:var(--green-soft);color:var(--green-ink)}
.ag-est.off{background:var(--bg3);color:var(--ink3)}
.ag-tpls{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px}
.ag-tpl{border:1px solid var(--line);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:8px;min-height:220px;background:#fff}
.ag-tpl b{font-size:14.5px;font-weight:600}
.ag-tpl p{margin:0;font-size:12.5px;color:var(--ink3);line-height:1.5;flex:1}
.ag-tpl .btn{width:100%;justify-content:center}
.ag-tpl.cero{align-items:center;justify-content:center;text-align:center;background:var(--bg2)}
.ag-ed{display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:18px;align-items:start}
@media (max-width:1150px){.ag-ed{grid-template-columns:1fr}}
.ag-top{display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap}
.ag-top h2{margin:0;flex:1}
.ag-card{border:1px solid var(--line);border-radius:12px;background:#fff;padding:16px;display:grid;gap:10px;margin-bottom:14px}
.ag-card > h4{margin:0;display:flex;align-items:center;gap:8px;font-size:14px;font-weight:600}
.ag-card > h4 svg{width:17px;height:17px;color:var(--ink3)}
.ag-card > h4 .btn{margin-left:auto}
.ag-card ul{margin:0;padding-left:18px;font-size:13px;line-height:1.6;color:var(--ink2)}
.ag-card .lab{font-size:12.5px;font-weight:600;color:var(--ink2)}
.ag-acc{display:flex;flex-wrap:wrap;gap:6px}
.ag-card h4 .sp{flex:1}
.ag-hab .ft2{display:flex;justify-content:space-between;gap:8px}
.chips2.fijos{display:flex;flex-wrap:wrap;gap:6px}
.chips2.fijos span{font-size:12.5px;padding:4px 10px;border-radius:999px;background:var(--bg2);border:1px solid var(--line)}
.ag-mej{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:10px;padding:12px 0;border-top:1px solid var(--line)}
.ag-mej .tx{display:flex;flex-direction:column;gap:2px;min-width:0;flex:1 1 240px}
.ag-mej small{color:var(--ink3);font-size:12.5px}
.ag-tiempo{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:13px;color:var(--ink2)}
.ag-tiempo input[type=number]{width:72px;border:1px solid var(--line);border-radius:8px;padding:7px 9px;font:inherit}
.ag-pest{margin-bottom:12px}
.ag-sis{display:flex;align-items:center;gap:12px;border:1px solid var(--line2);border-radius:10px;padding:12px;background:var(--bg2);flex-wrap:wrap}
.ag-sis .tx{flex:1;min-width:200px;display:flex;flex-direction:column;gap:2px}
.ag-sis .tx b{font-size:13.5px;font-weight:600}
.ag-sis .tx small{font-size:12.5px;color:var(--ink3)}
.ag-sis .ic{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;flex:none}
.ag-sis .ic svg{width:18px;height:18px}
.ag-sis .btn.ic{width:30px;height:30px;padding:0}
.ag-acc button{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;border:1px solid var(--line);border-radius:8px;padding:5px 10px;background:var(--bg2);color:var(--ink3)}
.ag-acc button[aria-pressed="true"]{background:var(--blue-soft);border-color:#bcdcff;color:var(--blue-ink)}
.ag-acc button svg{width:14px;height:14px}
.ag-src{display:flex;align-items:center;gap:10px;border-top:1px solid var(--line2);padding-top:10px}
.ag-src:first-of-type{border-top:0;padding-top:0}
.ag-src > span{flex:1;min-width:0}
.ag-src small{display:block;font-size:12px;color:var(--ink3)}
.ag-src .btn.ic{width:30px;height:30px;padding:0}
.ag-temas{display:grid;gap:8px}
.ag-temas .tr{display:grid;grid-template-columns:minmax(0,1fr) 200px;gap:8px;align-items:center}
.ag-temas input{border:1px solid var(--line);border-radius:9px;padding:7px 10px;font:inherit;font-size:13px}
.ag-temas .dsel{min-width:0!important}
.ag-card textarea,.ag-card input.t{border:1px solid var(--line);border-radius:9px;padding:8px 10px;font:inherit;font-size:13px;width:100%}
.ag-lock{display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--ink3)}
.ag-lock svg{width:14px;height:14px}
.ag-chat{position:sticky;top:0;border:1px solid var(--line);border-radius:12px;background:#fff;display:flex;flex-direction:column;height:calc(100vh - 150px);min-height:560px}
.ag-chat .hd{display:flex;align-items:center;gap:6px;padding:10px 12px;border-bottom:1px solid var(--line)}
.ag-chat .hd button.tab{font-size:12.5px;font-weight:500;padding:5px 10px;border-radius:7px;color:var(--ink3)}
.ag-chat .hd button.tab[aria-selected="true"]{background:var(--blue-soft);color:var(--blue-ink)}
.ag-chat .hd .re{margin-left:auto;font-size:12.5px;color:var(--ink3);display:inline-flex;align-items:center;gap:5px}
.ag-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px;background:#efeae2}
.ag-msgs .vacio{padding:40px 10px}
.ag-m{max-width:85%;padding:7px 10px;border-radius:10px;font-size:13px;line-height:1.45;white-space:pre-wrap;box-shadow:0 1px 1px rgba(0,0,0,.07)}
.ag-m.yo{align-self:flex-end;background:#d9fdd3}
.ag-m.ia{align-self:flex-start;background:#fff}
.ag-m.ia .lb{display:block;font-size:11px;font-weight:600;color:var(--violet-ink, #5b3fd6);margin-bottom:2px}
.ag-m .fu{display:block;font-size:11px;color:var(--ink3);margin-top:4px}
.ag-acn{align-self:center;display:flex;align-items:center;gap:6px;font-size:11.5px;color:#54656f;background:rgba(255,255,255,.75);border-radius:999px;padding:3px 10px;max-width:95%;text-align:center}
.ag-acn svg{width:13px;height:13px}
.ag-acn.mal{color:var(--red-ink)}
.ag-esc{align-self:flex-start;background:#fff;border-radius:10px;padding:8px 12px;font-size:12px;color:var(--ink3)}
.ag-sug{display:flex;flex-wrap:wrap;gap:6px;padding:8px 10px 0}
.ag-sug button{font-size:12px;border:1px solid var(--line);border-radius:999px;padding:4px 10px;background:#fff;color:var(--ink2)}
.ag-in{display:flex;gap:8px;padding:10px}
.ag-in input{flex:1;border:1px solid var(--line);border-radius:999px;padding:9px 14px;font:inherit;font-size:13px}
.ag-in button{width:38px;height:38px;border-radius:50%;background:var(--blue);color:#fff;display:grid;place-items:center}
.ag-dat{flex:1;overflow-y:auto;padding:14px}
.ag-nota{margin-top:12px;background:var(--amber-soft);border:1px solid var(--amber-line);color:var(--amber-ink);border-radius:10px;padding:10px 12px;font-size:12.5px;line-height:1.5}
.m.iam{align-self:flex-end;background:#f3efff;border:1px solid #e1d8ff}
.m.iam .by{color:#5b3fd6}
.m.iam.fallo{background:var(--red-soft);color:var(--red-ink);border-color:#fecaca}
</style>`);

const AG_TPL = {
  recep:{n:'Recepcionista', c:'#7c5cff', ic:'users', d:'Identifica a la persona, sabe si ya es cliente y qué necesita, y lo pasa de una a Ventas con una nota. Si es de soporte, Ventas lo transfiere. Reemplaza el flujo de botones del primer contacto.',
    que:['Saluda y pregunta el nombre de forma natural, sin menús ni botones.', 'Revisa si el número ya es de un cliente y entiende en una frase qué necesita.', 'Pasa la conversación de una a Ventas con una nota: quién es, qué necesita y si parece de soporte.'],
    consejos:['Sin documentos solo identifica y pasa, así nadie espera. Con documentos también responde con ellos.', 'Si parece de soporte, lo marca en la nota para que Ventas lo transfiera rápido.', 'Deja las respuestas cortas: en WhatsApp se leen mejor.']},
  ventas:{n:'Agente de ventas', c:'#16a34a', ic:'cart', d:'Conversa con los leads, resuelve dudas de productos, precios y pagos con la base de conocimiento y pasa al asesor cuando la persona está lista para pagar.',
    que:['Descubre qué busca el lead y qué producto le interesa.', 'Recomienda el producto que le sirve según la base de conocimiento.', 'Pasa al asesor cuando la persona pide el enlace de pago, para que la venta quede a su nombre.'],
    consejos:['Incluye precios y formas de pago actualizados en la base de conocimiento.', 'Define en qué etapa del embudo queda cada conversación.', 'Elige el equipo que recibe a los leads listos para comprar.']},
  soporte:{n:'Agente de soporte', c:'#0891b2', ic:'bolt', d:'Responde las dudas de los clientes sobre lo que compraron con las fuentes de conocimiento y pasa a Soporte lo que no pueda resolver.',
    que:['Resuelve dudas frecuentes de uso, entregas, horarios y acceso.', 'Si no puede resolverlo, pasa a Soporte de ventas o a Soporte con el caso resumido.'],
    consejos:['Agrega las preguntas frecuentes de soporte y los horarios de atención.', 'Define cuántos intentos hace antes de pasar a una persona.']},
  cero:{n:'Agente nuevo', c:'#64748b', ic:'bot', d:'Un agente sin instrucciones de base.', que:['Escribe aquí qué hace tu agente.'], consejos:['Empieza por decir qué hace y a quién pasa las conversaciones.']},
};
const AG_ACC = [['datos', 'user', 'Recopilar y actualizar los datos del contacto'], ['equipo', 'users', 'Asignar a un equipo o asesor'], ['etapa', 'kanban', 'Actualizar la etapa del embudo'], ['nota', 'note', 'Dejar una nota interna al pasar'], ['inactivas', 'clock', 'Retomar conversaciones sin respuesta'], ['finalizar', 'check', 'Finalizar y resumir la conversación']];
// Tonos para cualquier empresa. El texto va tal cual a las instrucciones del agente. Un tono guardado que ya no está en la lista se sigue mostrando.
const AG_TONOS = ['Cercano y cálido, tutea a la persona', 'Amable y profesional, trata de usted', 'Formal y respetuoso, trata de usted', 'Juvenil y entusiasta, tutea a la persona', 'Directo y práctico, sin rodeos', 'Empático y paciente, ideal para soporte', 'Cercano, como un asesor colombiano'];
const AG_TONO_PROPIO = 'Otro, lo escribo yo';
// Un tono escrito a mano, o uno guardado que ya no está en la lista, se muestra como «Otro» con su texto.
const agTonoPropio = a => !!a.tonoPropio || (!!a.tono && !AG_TONOS.includes(a.tono));
const AG_IDIOMAS = ['Español', 'Inglés', 'Portugués', 'Francés'];
// Conocimiento: pestaña propia desde el 28-sep, antes era una tarjeta de Configuración.
const AG_PEST = [['config', 'Configuración'], ['kb', 'Conocimiento'], ['comp', 'Comportamiento'], ['hab', 'Habilidades'], ['cap', 'Capacidades'], ['mejorar', 'Mejorar']];
// «Dejar una nota interna al pasar» vive en Configuración como «Resumen al pasar»; «Retomar conversaciones sin respuesta» todavía no hace nada en el motor.
const AG_ACC_FUERA = ['nota', 'inactivas'];
// El contexto de la empresa, escrito en el agente (services/crm/agentes.ts, contextoDe).
const agContexto = a => a.contexto || '';
// Datos que pide antes de pasar: nombre, correo y los campos personalizados del CRM. Sin elegir (agentes de antes), el nombre.
const agRecopilar = a => Array.isArray(a.recopilar) ? a.recopilar : (a.acc && a.acc.datos !== false ? ['nombre'] : []);
const agDatosOps = () => [['nombre', 'Nombre y apellido'], ['correo', 'Correo'], ...CAMPOS.map(c => [c.k, c.n])];
// Si la persona deja de responder (motor: recordatorioMin e inactividad en agenteIA.ts). Por defecto, como antes: sin recordatorio y pasa a los 10 minutos.
const agRec = a => ({on:false, tras:1, unidad:'horas', ...(a.recordar || {})});
// «Responder siempre» (3-oct, opción A): canales vacíos = todos los del agente; pausa en minutos si un asesor escribe.
const agSiempre = a => ({on:false, canales:[], pausa:30, ...(a.siempre || {})});
const agCanalesAg = a => canalesConectados().filter(k => (a.canales || {})[k]);
const agIna = a => ({tras:10, unidad:'minutos', accion:'pasar', ...(a.inactivo || {})});
function nuevoAgente(tpl){
  const t = AG_TPL[tpl];
  return {id:'ag' + Date.now().toString(36) + Math.floor(Math.random() * 1e4), tpl, nombre:t.n, presenta:'', estado:'borrador', que:t.que.join('\n'),
    acc:{datos:true, equipo:true, etapa:tpl === 'ventas', nota:true, inactivas:tpl === 'ventas', finalizar:tpl === 'soporte'}, destino:'Ventas',
    tono:AG_TONOS[0], largo:'Cortas, de 1 a 3 líneas', emojis:true,
    pasa:{listo:true, persona:true, molesto:true, mensajes:true, enlace:true}, nMsj:'6',
    temas:[['Productos, precios y cómo comprar', 'Ventas'], ['Pagos, cuotas, reembolsos y entrega de lo que compró', 'Soporte de ventas'], ['Dudas de uso o algo que no funciona', 'Soporte']],
    canales:{wa:true, web:true}, cuando:'Siempre', kb:[],
    contexto: '', idioma:AG_IDIOMAS[0], criterios:'', adicionales:'', recopilar:['nombre'], silencioso:false};
}
// Agentes guardados (clave `agentes`) y quién atiende primero (clave `ag`). Empiezan vacíos: no hay datos de ejemplo.
const AGENTES = [];
const AG = {primer:'flujo'};
st.agV = 'lista'; st.agId = null; st.agTab = 'chat';
// Encendido = contesta de verdad en WhatsApp (motor en api/src/services/crm/agenteIA.ts). Apagado = 'pausado' (o 'borrador' sin publicar).
const agListo = a => a.estado === 'activo';
// canalConectado y canalesConectados viven en 10-nucleo.js: también los usa la barra lateral.
const canalesDeAgente = a => canalesConectados().filter(k => Array.isArray(a.canales) ? a.canales.includes(k) : !!(a.canales || {})[k]);
const agAtiende = a => canalesDeAgente(a).length > 0;
const canalesAgente = a => { const ks = canalesDeAgente(a); return ks.length ? ks.map(k => esc(CANALES[k].n)).join(', ') : '<span class="gris">Sin canales conectados</span>'; };
// Métricas con lo que ya está en CONV: los mensajes del agente (`ia`) y sus sugerencias de transferir (`sugT`). Sin datos, cero.
const tMsg = m => m && m._t ? Date.parse(m._t) : 0;
const deAgente = (m, a) => !a || !m.ag || m.ag === a.id;
const convsAgente = (a, desde) => CONV.filter(c => (c.msgs || []).some(m => m.ia && deAgente(m, a) && tMsg(m) >= desde));
const pasadaAsesor = c => !!c.asig || (c.msgs || []).some(m => m.sugT);
const burbujaAg = burbuja;
burbuja = function(m){
  if (m.sugT) {
    const c = CONV.find(x => x.id === st.sel), resuelta = m.sugT.hecha || (m._id && c && (c.msgs || []).some(x => x.sugTDe === m._id));
    if (resuelta) return '';
    return `<div class="csat" style="border-color:#e1d8ff;background:#faf8ff"><div class="t" style="color:#5b3fd6">${I('bot')}La IA cree que esta conversación es de ${esc(m.sugT.eq)}</div><div class="r"><span>Porque ${esc(m.sugT.por)}. Si es así, transfiérela: le llega con la nota.</span></div><div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn" data-sugt-no="1">No, la atiendo yo</button><button type="button" class="btn pri" data-sugt="1">${I('swap')}Transferir a ${esc(m.sugT.eq)}</button></div></div>`;
  }
  if (!m.ia) return burbujaAg(m);
  // El nombre que guardó el motor (m.agente) vale si el agente ya no está; el estado de envío es el real de WhatsApp.
  const ag = AGENTES.find(x => x.id === m.ag) || (!m.ag && !m.agente && AGENTES.length === 1 ? AGENTES[0] : null), fallo = m._estado === 'fallido';
  return `<div class="m iam${fallo ? ' fallo' : ''}"><span class="by">${I('bot')}${esc(ag ? ag.nombre : m.agente || 'Agente')} · IA</span>${esc(m.ia)}${fallo ? `<div class="err">${esc(m._error || 'No se pudo enviar')}</div>` : ''}<div class="ft">${esc(m.h || '')}${estadoEnvio(m)}</div></div>`;
};

/* Menú y páginas */
const paginaAgBase = pagina;
pagina = function(){ if (st.pagina === 'agentes') { document.getElementById('page').innerHTML = paginaAgentes(); const ms = document.getElementById('ag-msgs'); if (ms) ms.scrollTop = ms.scrollHeight; return; } paginaAgBase(); };
function paginaAgentes(){
  if (st.agV === 'plantillas') return `<div class="ajw ancho ag-w"><button type="button" class="volver" data-ag-ir="lista">${I('back')}Agentes IA</button><h2>Plantillas de agentes IA</h2><p class="sub">Parte de una plantilla pensada para un objetivo o crea tu propio agente desde cero.</p>
    <div class="ag-tpls">${['recep', 'ventas', 'soporte'].map(k => { const t = AG_TPL[k]; return `<div class="ag-tpl"><span class="ag-av" style="background:${t.c}">${I(t.ic)}</span><b>${t.n}</b><p>${esc(t.d)}</p><button type="button" class="btn" data-ag-usar="${k}">Usar plantilla</button></div>`; }).join('')}
      <div class="ag-tpl cero"><b>Crear uno desde cero</b><p style="flex:none">Un agente con tus propias instrucciones.</p><button type="button" class="btn" data-ag-usar="cero" style="width:auto">${I('bot')}Empezar desde cero</button></div></div></div>`;
  if (st.agV === 'editor') { const a = AGENTES.find(x => x.id === st.agId); if (a) return editorAgente(a); st.agV = 'lista'; }
  const listos = AGENTES.filter(a => agListo(a) && agAtiende(a)), hoy = inicioDiaColombia(0);
  return `<div class="ajw ancho ag-w"><div class="pg-h"><div><h2>Agentes IA</h2><p class="sub">Atienden a tus clientes al principio, en lenguaje natural, y los pasan al asesor correcto con todo listo.</p></div><button type="button" class="btn pri" data-ag-ir="plantillas">${I('plus')}Crear agente</button></div>
    <div class="cfg"><div class="box2">${fila('<b>Quién atiende primero</b>', AG.primer === 'agente' ? 'El flujo de botones «Bienvenida» queda de respaldo: atiende si el agente está apagado o falla.' : 'El agente no atiende el primer contacto; se usa el flujo de botones.', ddSel('data-ag-primer', [['agente', listos.length ? `El agente «${esc(listos[0].nombre)}»` : 'Un agente IA (ninguno encendido)'], ['flujo', 'El flujo de botones «Bienvenida»']], AG.primer))}</div>
    <div class="box2">${AGENTES.length ? `<table class="ag-tb"><thead><tr><th>Agente</th><th>Estado</th><th>Canales</th><th>Conversaciones hoy</th><th>Pasadas a un asesor</th><th></th></tr></thead><tbody>
      ${AGENTES.map(a => { const t = AG_TPL[a.tpl] || AG_TPL.cero, cs = convsAgente(a, hoy), pas = cs.filter(pasadaAsesor).length, on = agListo(a); return `<tr><td class="n"><span class="ag-av" style="background:${t.c}">${I(t.ic)}</span><span><b style="font-weight:600">${esc(a.nombre)}</b><br><small class="muted">${esc(t.n)}</small></span></td>
        <td><span class="ag-est ${on ? 'on' : 'off'}">${on ? 'Encendido' : 'Apagado'}</span></td>
        <td>${canalesAgente(a)}</td><td>${cs.length}</td><td>${cs.length ? Math.round(pas / cs.length * 100) + ' %' : '—'}</td>
        <td><div class="ag-bts"><button type="button" class="btn" data-ag-editar="${a.id}">${I('pen')}Editar</button><button type="button" class="ag-pw${on ? ' on' : ''}" data-ag-onoff="${a.id}" aria-pressed="${on}" aria-label="${on ? 'Apagar' : 'Encender'} ${esc(a.nombre)}" title="${on ? 'Encendido: contesta en sus canales. Toca para apagarlo' : 'Apagado: toca para encenderlo'}">${I('power')}</button><button type="button" class="ag-pw del" data-ag-borrar="${a.id}" aria-label="Eliminar ${esc(a.nombre)}" title="Eliminar el agente">${I('trash')}</button></div></td></tr>`; }).join('')}
    </tbody></table>` : `<div class="vacio">${I('bot')}<b>Todavía no hay agentes</b><p>La Recepcionista saluda, entiende qué necesita la persona y la pasa a Ventas con una nota.</p><button type="button" class="btn pri" data-ag-usar="recep">Crear la Recepcionista</button></div>`}</div></div></div>`;
}
function editorAgente(a){
  const t = AG_TPL[a.tpl] || AG_TPL.cero, ed = st.agEdit, tgl = (k, lab) => `<button type="button" class="tg" role="switch" data-ag-pasa="${k}" aria-checked="${a.pasa[k]}" aria-label="${lab}"></button>`;
  const sw = (attr, on, lab) => `<button type="button" class="tg" role="switch" ${attr} aria-checked="${!!on}" aria-label="${esc(lab)}"></button>`;
  const pest = AG_PEST.some(([k]) => k === st.agPest) ? st.agPest : 'config';
  const propio = agTonoPropio(a), pide = agRecopilar(a), rec = agRec(a), ina = agIna(a);
  const tabs = `<div class="cn-tabs ag-pest" role="tablist" aria-label="Partes del agente">${AG_PEST.map(([k, n]) => `<button type="button" role="tab" aria-selected="${pest === k}" data-ag-pest="${k}">${n}${k === 'kb' && kbCuenta(a) ? `<span class="kb-n">${kbCuenta(a)}</span>` : ''}</button>`).join('')}</div>`;
  const config = `<div class="ag-card"><h4>${I('wa')}Dónde atiende</h4>
        <div class="fld">Canales<div class="chips2">${canalesConectados().length ? canalesConectados().map(k => `<button type="button" data-ag-canal="${k}" aria-pressed="${!!(a.canales || {})[k]}">${CANALES[k].n}</button>`).join('') : ''}</div>${canalesConectados().length ? '' : `<p class="muted" style="margin:4px 0 0">Todavía no hay canales conectados al CRM. Se conectan en Ajustes del CRM, Canales.</p><div style="margin-top:6px"><button type="button" class="btn" data-ir="cfg-canales">${I('share')}Ir a Canales</button></div>`}</div>
        ${fila('Cuándo atiende', '', ddSel('data-ag-cuando', ['Siempre', 'Solo fuera del horario de atención', 'Solo en el horario de atención'], a.cuando))}
        ${fila('Equipo del agente', 'Atiende primero lo que entra a ese equipo y al terminar lo pasa a su gente', ddSel('data-ag-eq', [['', 'Todos los equipos'], ...EQUIPOS.map(e => [e.n, e.n])], (a.equipoAg || {}).equipo || ''))}
        ${(a.equipoAg || {}).equipo && ((EQ_CFG.subequipos || {})[a.equipoAg.equipo] || []).length ? fila('Subequipo', 'Solo lo que se pasa a ese subequipo', ddSel('data-ag-sub', [['', 'Todo el equipo'], ...EQ_CFG.subequipos[a.equipoAg.equipo].map(s => [s.id, s.n])], a.equipoAg.sub || '')) : ''}
        ${fila('Contactos que ya tienen asesor', 'Si habló con un asesor en los últimos 30 días, va directo a esa persona', '<span class="ag-lock">' + I('lock') + 'No los atiende</span>')}</div>
      <div class="ag-card"><h4>${I('bolt')}Responder siempre</h4>
        ${fila('Responder siempre', 'Responde en estos canales aunque la conversación tenga asesor. Si un asesor escribe, se pausa en esa conversación.', sw('data-ag-siempre="1"', agSiempre(a).on, 'Responder siempre'))}
        ${agSiempre(a).on ? `<div class="fld">En qué canales<div class="chips2">${agCanalesAg(a).map(k => `<button type="button" data-ag-sie-canal="${k}" aria-pressed="${!agSiempre(a).canales.length || agSiempre(a).canales.includes(k)}">${CANALES[k].n}</button>`).join('') || '<span class="muted">Primero elige sus canales arriba</span>'}</div></div>
        <div class="ag-tiempo"><span>Si un asesor escribe, se pausa</span><input type="number" min="5" max="1440" data-ag-num="pausa" value="${esc(agSiempre(a).pausa)}" aria-label="Minutos de pausa"><span>minutos</span></div>
        ${(() => { const otro = AGENTES.find(x => x !== a && x.siempre && x.siempre.on && agCanalesAg(x).some(k => agCanalesAg(a).includes(k))); return otro ? `<p class="muted" style="margin:6px 0 0">«${esc(otro.nombre)}» también responde siempre en alguno de estos canales. Responde el del equipo de la conversación; si los dos son generales, el primero de la lista.</p>` : ''; })()}` : ''}</div>
      <div class="ag-card"><h4>${I('clock')}Si la persona deja de responder</h4>
        ${fila('Recordatorio', 'Le escribe una sola vez para retomar la conversación donde quedó', sw('data-ag-rec="1"', rec.on, 'Recordatorio si no responde'))}
        ${rec.on ? `<div class="ag-tiempo"><span>Después de</span><input type="number" min="1" max="${rec.unidad === 'horas' ? 23 : 1380}" data-ag-num="recordar" value="${esc(rec.tras)}" aria-label="Tiempo del recordatorio">${ddSel('data-ag-unidad', [['recordar|minutos', 'minutos'], ['recordar|horas', 'horas']], `recordar|${rec.unidad}`)}</div>` : ''}
        <span class="lab">${rec.on ? 'Si sigue sin responder después del recordatorio' : 'Si no responde'}</span>
        <div class="ag-tiempo"><span>Después de</span><input type="number" min="1" max="${ina.unidad === 'horas' ? 168 : 10080}" data-ag-num="inactivo" value="${esc(ina.tras)}" aria-label="Tiempo sin respuesta">${ddSel('data-ag-unidad', [['inactivo|minutos', 'minutos'], ['inactivo|horas', 'horas']], `inactivo|${ina.unidad}`)}${ddSel('data-ag-accion', [['pasar', 'Pasa a un asesor'], ['finalizar', 'Finaliza la conversación']], ina.accion)}</div></div>
      <div class="ag-card"><h4>${I('web')}Idioma y traspaso</h4>
        ${fila('Idioma predeterminado', 'Responde en el idioma en que le escriben; si no lo reconoce, en este', ddSel('data-ag-idioma', AG_IDIOMAS, a.idioma || AG_IDIOMAS[0]))}
        ${fila('Resumen al pasar a un asesor', 'Deja una nota interna con quién es, qué necesita y lo que ya se sabe', sw('data-ag-acc="nota"', a.acc.nota, 'Resumen al pasar a un asesor'))}</div>`;
  const comp = `<div class="ag-card"><h4><span class="ag-av" style="background:${t.c};width:28px;height:28px">${I(t.ic)}</span>${esc(a.nombre)}<button type="button" class="btn" data-ag-edit="1">${I('pen')}${ed ? 'Listo' : 'Editar'}</button></h4>
        <span class="lab">Descripción del puesto</span>
        ${ed ? `<label class="fld">Nombre del agente<input class="t" data-ag-in="nombre" value="${esc(a.nombre)}"></label>
          <label class="fld">Qué hace, una instrucción por línea<textarea data-ag-in="que" rows="5">${esc(a.que)}</textarea></label>`
          : `<ul>${a.que.split('\n').filter(Boolean).map(x => `<li>${esc(x)}</li>`).join('')}</ul>`}
        <span class="lab">Consejos para configurarlo</span><ul>${t.consejos.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>
      <div class="ag-card"><h4>${I('folder')}Contexto de la empresa</h4>
        <label class="fld">A qué se dedica, a quién le vende, qué ofrece y las reglas del negocio<textarea data-ag-in="contexto" rows="4" placeholder="Ej. Somos una tienda de muebles en Bogotá. Vendemos por internet y entregamos en todo el país.">${esc(agContexto(a))}</textarea></label></div>
      <div class="ag-card"><h4>${I('chat')}Cómo habla</h4>
        <label class="fld">Se presenta como<input class="t" data-ag-in="presenta" value="${esc(a.presenta)}" placeholder="Ej. Sofía, del equipo de ${esc(ESPACIO.nombre || 'tu empresa')}"></label>
        ${fila('Tono', '', ddSel('data-ag-tono', [...AG_TONOS, AG_TONO_PROPIO], propio ? AG_TONO_PROPIO : a.tono))}
        ${propio ? `<label class="fld">Describe el tono<input class="t" data-ag-in="tono" value="${esc(a.tono || '')}" placeholder="Ej. Alegre y motivador, trata de usted a los papás"></label>` : ''}
        ${fila('Largo de las respuestas', '', ddSel('data-ag-largo', ['Cortas, de 1 a 3 líneas', 'Medianas, hasta 5 líneas'], a.largo))}
        ${fila('Usa emojis con moderación', '', `<button type="button" class="tg" role="switch" data-ag-emo="1" aria-checked="${a.emojis}" aria-label="Emojis"></button>`)}
        ${fila('Si le preguntan si es una persona, dice que es un asistente virtual', 'Suena natural, pero no se hace pasar por humano', '<span class="ag-lock">' + I('lock') + 'Siempre</span>')}</div>
      ${a.tpl === 'recep' ? `<div class="ag-card"><h4>${I('users')}A quién pasa</h4>
        ${fila('Pasa siempre a', 'En cuanto sabe quién es y qué necesita', ddSel('data-ag-dest', EQUIPOS.map(e => [e.n, e.n]), a.destino))}
        <span class="lab">Si parece de otro equipo, lo marca en la nota</span>
        <div class="ag-temas">${a.temas.filter(([, eq]) => eq !== a.destino).map(([tx, eq]) => { const i = a.temas.findIndex(x => x[1] === eq); return `<div class="tr"><input data-ag-tema="${i}" value="${esc(tx)}" aria-label="Temas de ${esc(eq)}"><span class="muted">${esc(eq)}</span></div>`; }).join('')}</div>
        <p class="muted" style="margin:0">El asesor de ${esc(a.destino)} ve la sugerencia en la conversación y la transfiere con un toque, con la nota incluida.</p>
        ${fila('Si pide hablar con una persona, pasa sin terminar de preguntar', '', tgl('persona', 'Si pide hablar con una persona'))}</div>` : `<div class="ag-card"><h4>${I('users')}Cuándo pasa a un asesor</h4>
        <span class="lab">Qué cubre cada equipo</span>
        <div class="ag-temas">${a.temas.map(([tx, eq], i) => `<div class="tr"><input data-ag-tema="${i}" value="${esc(tx)}" aria-label="Temas del equipo ${esc(eq)}">${ddSel('data-ag-teq', AREAS.map(x => [`${i}|${x}`, x]), `${i}|${eq}`)}</div>`).join('')}</div>
        ${fila('Cuando ya sabe a qué equipo va', 'Pasa con una nota interna que resume el caso', tgl('listo', 'Cuando ya sabe a qué equipo va'))}
        ${fila('Si pide hablar con una persona', '', tgl('persona', 'Si pide hablar con una persona'))}
        ${fila('Si se molesta o se queja', '', tgl('molesto', 'Si se molesta o se queja'))}
        ${fila('Si pide el enlace de pago', 'Así la venta queda a nombre del asesor', tgl('enlace', 'Si pide el enlace de pago'))}
        ${fila(`Si después de ${esc(a.nMsj)} mensajes no lo ha resuelto`, '', tgl('mensajes', 'Si no lo resuelve'))}
        <label class="fld">Otros casos en que pasa a un asesor, uno por línea<textarea data-ag-in="criterios" rows="3" placeholder="Ej. Pide un reembolso&#10;Se queja de un cobro">${esc(a.criterios || '')}</textarea></label>
        ${fila('Traspaso silencioso', 'Pasa la conversación sin despedirse ni avisarle a la persona', sw('data-ag-sil="1"', a.silencioso, 'Traspaso silencioso'))}</div>`}
      <div class="ag-card"><h4>${I('user')}Datos que pide antes de pasar</h4>
        <p class="muted" style="margin:0">Pide solo los que falten, uno o dos por mensaje, y los guarda en el contacto.</p>
        <div class="chips2">${agDatosOps().map(([k, n]) => `<button type="button" data-ag-dato="${esc(k)}" aria-pressed="${pide.includes(k)}">${esc(n)}</button>`).join('')}</div></div>
      <div class="ag-card"><h4>${I('note')}Instrucciones adicionales</h4>
        <label class="fld">Reglas que valen en toda conversación, una por línea<textarea data-ag-in="adicionales" rows="4" placeholder="Ej. Llama a la persona por su nombre&#10;No prometas descuentos que no estén en los documentos">${esc(a.adicionales || '')}</textarea></label></div>`;
  const cap = `<div class="ag-card"><h4>${I('bolt')}Lo que puede hacer en el CRM</h4>
        <div class="ag-acc">${AG_ACC.filter(([k]) => !AG_ACC_FUERA.includes(k)).map(([k, ic, n]) => `<button type="button" aria-pressed="${!!a.acc[k]}" data-ag-acc="${k}">${I(a.acc[k] ? 'check' : ic)}${n}</button>`).join('')}</div></div>
      ${consultasHTML(a, sw)}`;
  return `<div class="ajw ancho ag-w"><div class="ag-top"><button type="button" class="volver" data-ag-ir="lista" style="margin:0">${I('back')}Agentes IA</button><h2>${a.estado && a.estado !== 'borrador' ? 'Editar' : 'Crear'} agente IA</h2>
      <button type="button" class="btn" data-ag-ir="lista">Cancelar</button><button type="button" class="btn pri" data-ag-publicar="1">${I('check')}Publicar</button></div>
    <div class="ag-ed"><div>${tabs}
      ${pest === 'config' ? config : pest === 'kb' ? conocimientoHTML(a) : pest === 'comp' ? comp : pest === 'hab' ? habilidadesHTML(a) : pest === 'cap' ? cap : mejorarHTML(a)}
    </div>
    ${chatPruebaAgente(a)}</div></div>`;
}

/* Chat de prueba: responde el modelo de IA de verdad con las instrucciones del agente (POST /crm/agentes/probar) */
function agReiniciar(){ st.agChat = {msgs:[], datos:{}, fase:'', escribiendo:false}; }
function chatPruebaAgente(a){
  if (!st.agChat) agReiniciar();
  const ch = st.agChat, nom = ((a.presenta || '').split(',')[0] || a.nombre).trim();
  const tabs = `<button type="button" class="tab" role="tab" aria-selected="${st.agTab === 'chat'}" data-ag-tab="chat">Chatear</button><button type="button" class="tab" role="tab" aria-selected="${st.agTab === 'datos'}" data-ag-tab="datos">Datos del contacto</button><button type="button" class="re" data-ag-re="1">${I('swap')}Reiniciar</button>`;
  if (st.agTab === 'datos') { const d = ch.datos;
    return `<aside class="ag-chat"><div class="hd">${tabs}</div><div class="ag-dat"><dl class="kv">${[['Nombre', d.nombre], ['Correo de la compra', d.correo], ['Equipo', d.equipo]].map(([k, v]) => `<dt>${k}</dt><dd class="${v ? '' : 'vacio'}">${esc(v || '—')}</dd>`).join('')}</dl>${d.nota ? `<div class="ag-nota"><b>Nota interna</b><br>${esc(d.nota)}</div>` : ''}</div></aside>`; }
  const cuerpo = ch.msgs.length ? ch.msgs.map(m => m.yo ? `<div class="ag-m yo">${esc(m.yo)}</div>` : m.ia ? `<div class="ag-m ia"><span class="lb">${esc(nom)} · IA</span>${esc(m.ia)}${m.fu ? `<span class="fu">Fuente: ${esc(m.fu)}</span>` : ''}</div>` : `<div class="ag-acn${m.mal ? ' mal' : ''}">${I(m.ic || 'check')}${esc(m.acn)}</div>`).join('') + (ch.escribiendo ? `<div class="ag-esc">${esc(nom)} está escribiendo…</div>` : '')
    : `<div class="vacio">${I('bot')}<b>Prueba tu agente</b><p>Escríbele como si fueras un cliente y mira cómo responde y a quién pasa la conversación.</p></div>`;
  const sug = ch.msgs.length ? [] : a.tpl === 'recep' ? ['Hola, quiero información', 'No me ha llegado mi compra', 'Tengo un problema con mi pedido', '¿Eres un robot?'] : ['Hola, quiero información', 'No me ha llegado mi compra', 'Tengo un problema con mi pedido', 'Quiero hablar con una persona'];
  const cerrado = ch.fase === 'pasada';
  return `<aside class="ag-chat"><div class="hd">${tabs}</div><div class="ag-msgs" id="ag-msgs">${cuerpo}</div>
    ${sug.length ? `<div class="ag-sug">${sug.map(x => `<button type="button" data-ag-sug="${esc(x)}">${esc(x)}</button>`).join('')}</div>` : ''}
    <form class="ag-in" id="ag-form"><input id="ag-in" placeholder="${cerrado ? 'La conversación ya la tiene un asesor' : 'Escribe como si fueras el cliente'}" autocomplete="off" ${cerrado ? 'disabled' : ''} aria-label="Mensaje de prueba"><button type="submit" aria-label="Enviar" ${cerrado ? 'disabled' : ''}>${I('send')}</button></form>
    <p class="muted" style="margin:0 12px 10px;font-size:11.5px">Lo que pasa aquí es solo de prueba: no cambia contactos reales.</p></aside>`;
}
// Repinta solo el chat de prueba, para no borrar lo que se esté escribiendo en el resto del editor.
function pintarChatAg(a){
  const el = document.querySelector('#page .ag-chat');
  if (!el || st.pagina !== 'agentes' || st.agV !== 'editor') return;
  el.outerHTML = chatPruebaAgente(a);
  const ms = document.getElementById('ag-msgs'); if (ms) ms.scrollTop = ms.scrollHeight;
}
function agResponder(a, t){
  const ch = st.agChat; if (!ch || ch.escribiendo || ch.fase === 'pasada') return;
  ch.msgs.push({yo:t});
  const historial = ch.msgs.filter(m => m.yo || m.ia).map(m => m.yo ? {rol:'cliente', texto:m.yo} : {rol:'agente', texto:m.ia});
  ch.escribiendo = true; pintarChatAg(a);
  // Primero se guarda lo que haya en la base de conocimiento: el servidor la lee de lo guardado.
  crmGuardarYa('kb', 'agentes').then(() => crmApi('POST', '/crm/agentes/probar', {agente:a, historial}))
    .then(r => {
      if (st.agChat !== ch) return;
      for (const c of (r && Array.isArray(r.consultas) ? r.consultas : [])) ch.msgs.push({acn: c.ok ? `Consultó ${c.n}` : `No pudo consultar ${c.n}`, ic:'search', mal:!c.ok});
      if (r && r.texto) ch.msgs.push({ia:r.texto});
      if (r && r.datos && typeof r.datos === 'object') Object.assign(ch.datos, r.datos);
      if (r && r.pasar) {
        const eq = r.pasar.equipo || a.destino || 'Ventas'; ch.datos.equipo = eq; if (r.pasar.nota) ch.datos.nota = r.pasar.nota;
        ch.msgs.push({acn:`Pasó la conversación a ${eq}`, ic:'users'}); if (r.pasar.nota) ch.msgs.push({acn:'Dejó una nota interna con el resumen', ic:'note'});
        if (r.pasar.sinRespuesta) ch.msgs.push({acn:`No lo encontró en sus documentos: «${r.pasar.sinRespuesta}»`, ic:'folder'});
        ch.fase = 'pasada';
      }
    })
    .catch(err => { if (st.agChat === ch) ch.msgs.push({acn:`No respondió: ${err.message || 'el servidor no contestó'}`, ic:'x', mal:true}); })
    .finally(() => { if (st.agChat !== ch) return; ch.escribiendo = false; pintarChatAg(a); const n = document.getElementById('ag-in'); if (n && !n.disabled) n.focus(); });
}

/* Eventos */
document.getElementById('page').addEventListener('click', e => {
  if (st.pagina !== 'agentes') return; const t = e.target;
  const ir = t.closest('[data-ag-ir]'); if (ir) { st.agV = ir.dataset.agIr; st.agEdit = false; render(); return; }
  const us = t.closest('[data-ag-usar]'); if (us) { const a = nuevoAgente(us.dataset.agUsar); AGENTES.push(a); st.agId = a.id; st.agV = 'editor'; st.agEdit = us.dataset.agUsar === 'cero'; agReiniciar(); render(); return; }
  const edt = t.closest('[data-ag-editar]'); if (edt) { st.agId = edt.dataset.agEditar; st.agV = 'editor'; st.agEdit = false; agReiniciar(); render(); return; }
  const bo = t.closest('[data-ag-borrar]'); if (bo) { const a = AGENTES.find(x => x.id === bo.dataset.agBorrar); if (!a) return;
    abrirDialogo(`<h3>Eliminar «${esc(a.nombre)}»</h3><p>Se borra el agente con sus instrucciones y su configuración, y no se puede deshacer.${agListo(a) ? ' Está encendido: si está atendiendo conversaciones, pasan a una persona del equipo.' : ''}</p>
      <div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" style="background:#dc2626;border-color:#dc2626" data-ag-borrar-ok="${a.id}">${I('trash')}Eliminar</button></div>`);
    return; }
  const oo = t.closest('[data-ag-onoff]'); if (oo) { const a = AGENTES.find(x => x.id === oo.dataset.agOnoff); if (!a) return;
    if (agListo(a)) { a.estado = 'pausado'; render(); toast(`${a.nombre} quedó apagado: ya no contesta`); return; }
    if (!canalesConectados().length) { toast('Conecta un canal al CRM (Ajustes del CRM, Canales) para encender el agente'); return; }
    if (!agAtiende(a)) { toast(`Marca un canal en «Dónde atiende» de ${a.nombre} para encenderlo`); return; }
    a.estado = 'activo'; render();
    toast(AG.primer === 'agente' ? `${a.nombre} quedó encendido: contesta en WhatsApp` : `${a.nombre} quedó encendido. Para que atienda el primer contacto, elígelo en «Quién atiende primero»`); return; }
  const pr = t.closest('[data-ag-primer]'); if (pr) { AG.primer = pr.dataset.agPrimer; render(); toast(AG.primer === 'agente' ? 'El primer contacto lo atiende el agente IA' : 'El primer contacto lo atiende el flujo de botones'); return; }
  const a = AGENTES.find(x => x.id === st.agId); if (!a) return;
  if (t.closest('[data-ag-publicar]')) { st.agV = 'lista';
    if (agListo(a)) { render(); toast(`${a.nombre} quedó guardado: los cambios ya aplican en WhatsApp`); return; }
    a.estado = 'pausado'; render();
    toast(LINEAS.length ? `${a.nombre} quedó guardado y apagado. Enciéndelo con el botón de encendido para que conteste en WhatsApp` : `${a.nombre} quedó guardado. Conecta una línea de WhatsApp para encender el agente`); return; }
  if (t.closest('[data-ag-edit]')) { st.agEdit = !st.agEdit; render(); return; }
  const ac = t.closest('[data-ag-acc]'); if (ac) { const k = ac.dataset.agAcc; a.acc[k] = !a.acc[k]; render(); toast(`${AG_ACC.find(x => x[0] === k)[2]}: ${a.acc[k] ? 'sí' : 'no'}`); return; }
  const cn = t.closest('[data-ag-canal]'); if (cn) { a.canales[cn.dataset.agCanal] = !a.canales[cn.dataset.agCanal];
    // Sin WhatsApp no contesta en ningún lado: un agente encendido queda apagado, así la lista no dice «Encendido» sin serlo.
    if (!agAtiende(a) && agListo(a)) { a.estado = 'pausado'; render(); toast(`${a.nombre} quedó apagado: sin canales no contesta`); return; }
    render(); return; }
  const pa = t.closest('[data-ag-pasa]'); if (pa) { a.pasa[pa.dataset.agPasa] = !a.pasa[pa.dataset.agPasa]; render(); toast(a.pasa[pa.dataset.agPasa] ? 'Activado' : 'Apagado'); return; }
  if (t.closest('[data-ag-emo]')) { a.emojis = !a.emojis; render(); return; }
  const pe = t.closest('[data-ag-pest]'); if (pe) { st.agPest = pe.dataset.agPest; if (st.agPest === 'mejorar') mejorarCargar(a); render(); return; }
  if (t.closest('[data-hab-nueva]')) { const hs = Array.isArray(a.habilidades) ? a.habilidades : (a.habilidades = []); if (hs.length >= 10) { toast('Caben máximo 10 habilidades'); return; }
    const h = {id:'hb' + Date.now().toString(36), on:true, n:'', cuando:'', pasos:'', equipo:'', etiqueta:'', etapa:''}; hs.push(h); st.habEdit = h.id; render(); setTimeout(() => { const x = document.querySelector(`[data-hab-in="${h.id}|n"]`); if (x) x.focus(); }, 30); return; }
  const he = t.closest('[data-hab-edit]'); if (he) { st.habEdit = he.dataset.habEdit; render(); return; }
  if (t.closest('[data-hab-listo]')) { const h = (a.habilidades || []).find(x => x.id === st.habEdit); st.habEdit = null; render(); if (h && !(h.n && h.cuando && h.pasos)) toast('Falta el nombre, cuándo la usa o los pasos: mientras tanto el agente no la usa'); return; }
  const hon = t.closest('[data-hab-on]'); if (hon) { const h = (a.habilidades || []).find(x => x.id === hon.dataset.habOn); if (h) { h.on = h.on === false; render(); toast(h.on ? `${h.n || 'La habilidad'}: prendida` : `${h.n || 'La habilidad'}: apagada`); } return; }
  const hb = t.closest('[data-hab-borrar]'); if (hb) { const i = (a.habilidades || []).findIndex(x => x.id === hb.dataset.habBorrar); if (i >= 0) { const [x] = a.habilidades.splice(i, 1); st.habEdit = null; render(); toast(`Habilidad borrada: ${x.n || 'sin nombre'}`); } return; }
  for (const [attr, campo] of [['habEq', 'equipo'], ['habEtq', 'etiqueta'], ['habEta', 'etapa']]) { const x = t.closest(`[data-${attr.replace(/[A-Z]/g, m => '-' + m.toLowerCase())}]`); if (x) { const [id, v] = x.dataset[attr].split('|'); const h = (a.habilidades || []).find(y => y.id === id); if (h) { h[campo] = v; render(); } return; } }
  const mv = t.closest('[data-mej-ver]'); if (mv) { const id = +mv.dataset.mejVer; if (!CONV.some(c => c.id === id)) { toast('Esa conversación ya no está en la bandeja'); return; } st.sel = id; irA('todas'); return; }
  const mn = t.closest('[data-mej-no]'); if (mn) { mejorarQuitar(mn.dataset.mejNo, 'Descartada'); return; }
  const ms = t.closest('[data-mej-si]'); if (ms) { const x = (st.agMej && st.agMej.lista || []).find(y => y.id === ms.dataset.mejSi); if (!x) return;
    abrirDialogo(`<h3>Enseñarle la respuesta</h3><p>«${esc(x.pregunta)}»</p><div class="cx-f"><label>La respuesta, como quieres que la diga<textarea id="mej-r" rows="5"></textarea></label></div><p class="muted">Queda en su base de conocimiento y la usa desde el siguiente mensaje.</p><div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" data-mej-guardar="${x.id}">${I('check')}Guardar en su base</button></div>`);
    setTimeout(() => { const r = document.getElementById('mej-r'); if (r) r.focus(); }, 30); return; }
  const to = t.closest('[data-ag-tono]'); if (to) { const v = to.dataset.agTono; if (v === AG_TONO_PROPIO) { if (!agTonoPropio(a)) a.tono = ''; a.tonoPropio = true; } else { a.tono = v; a.tonoPropio = false; } render(); return; }
  const idi = t.closest('[data-ag-idioma]'); if (idi) { a.idioma = idi.dataset.agIdioma; render(); toast(`Si no reconoce el idioma, responde en ${a.idioma.toLowerCase()}`); return; }
  if (t.closest('[data-ag-rec]')) { a.recordar = {...agRec(a), on:!agRec(a).on}; render(); toast(a.recordar.on ? 'Le escribirá una vez para retomar la conversación' : 'Sin recordatorio'); return; }
  const un = t.closest('[data-ag-unidad]'); if (un) { const [k, u] = un.dataset.agUnidad.split('|'); const cur = k === 'recordar' ? agRec(a) : agIna(a); a[k] = {...cur, unidad:u, tras: u === 'horas' && k === 'recordar' ? Math.min(+cur.tras || 1, 23) : cur.tras}; render(); return; }
  const acn = t.closest('[data-ag-accion]'); if (acn) { a.inactivo = {...agIna(a), accion:acn.dataset.agAccion}; render(); toast(a.inactivo.accion === 'finalizar' ? 'Si no responde, finaliza la conversación' : 'Si no responde, pasa a un asesor'); return; }
  if (t.closest('[data-ag-sil]')) { a.silencioso = !a.silencioso; render(); toast(a.silencioso ? 'Traspaso silencioso: pasa sin despedirse' : 'Al pasar se despide de la persona'); return; }
  const dt = t.closest('[data-ag-dato]'); if (dt) { const k = dt.dataset.agDato, l = agRecopilar(a).slice(); const i = l.indexOf(k); if (i >= 0) l.splice(i, 1); else l.push(k); a.recopilar = l; render(); return; }
  const la = t.closest('[data-ag-largo]'); if (la) { a.largo = la.dataset.agLargo; render(); return; }
  const cu = t.closest('[data-ag-cuando]'); if (cu) { a.cuando = cu.dataset.agCuando; render(); return; }
  const eqb = t.closest('[data-ag-eq]'); if (eqb) { const v = eqb.dataset.agEq; a.equipoAg = v ? {equipo:v, sub:null} : null; render(); toast(v ? `Atiende primero lo que entra a ${v}` : 'Atiende todos los equipos'); return; }
  const sbb = t.closest('[data-ag-sub]'); if (sbb) { a.equipoAg = {...(a.equipoAg || {}), sub: sbb.dataset.agSub || null}; render(); return; }
  if (t.closest('[data-ag-siempre]')) { const s = agSiempre(a); a.siempre = {...s, on:!s.on}; render(); toast(a.siempre.on ? 'Responde siempre en sus canales' : 'Ya no responde por encima de los asesores'); return; }
  const sc = t.closest('[data-ag-sie-canal]'); if (sc) { const s = agSiempre(a), todos = agCanalesAg(a), k = sc.dataset.agSieCanal; let L = s.canales.length ? s.canales.filter(x => todos.includes(x)) : [...todos]; L = L.includes(k) ? L.filter(x => x !== k) : [...L, k]; if (!L.length) { toast('Elige al menos un canal'); return; } a.siempre = {...s, canales: L.length === todos.length ? [] : L}; render(); return; }
  const de = t.closest('[data-ag-dest]'); if (de) { a.destino = de.dataset.agDest; render(); toast(`Pasa siempre a ${a.destino}`); return; }
  const te = t.closest('[data-ag-teq]'); if (te) { const [i, eq] = te.dataset.agTeq.split('|'); a.temas[+i][1] = eq; render(); toast(`Pasa a ${eq}`); return; }
  const tb = t.closest('[data-ag-tab]'); if (tb) { st.agTab = tb.dataset.agTab; render(); return; }
  if (t.closest('[data-ag-re]')) { agReiniciar(); st.agTab = 'chat'; render(); return; }
  const sg = t.closest('[data-ag-sug]'); if (sg) { agResponder(a, sg.dataset.agSug); return; }
});
document.getElementById('page').addEventListener('submit', e => {
  if (e.target.id !== 'ag-form') return; e.preventDefault();
  const a = AGENTES.find(x => x.id === st.agId), v = document.getElementById('ag-in').value.trim(); if (!a || !v || !st.agChat || st.agChat.escribiendo) return;
  agResponder(a, v); const n = document.getElementById('ag-in'); if (n) n.focus();
});
document.getElementById('page').addEventListener('change', e => {
  if (st.pagina !== 'agentes') return; const a = AGENTES.find(x => x.id === st.agId); if (!a) return; const t = e.target;
  if (t.dataset.agIn) { a[t.dataset.agIn] = t.value; setTimeout(render); return; }
  if (t.dataset.agTema !== undefined) { a.temas[+t.dataset.agTema][0] = t.value; toast('Guardado'); }
  if (t.dataset.habIn) { const [id, campo] = t.dataset.habIn.split('|'); const h = (a.habilidades || []).find(x => x.id === id); if (h) { h[campo] = t.value.slice(0, campo === 'pasos' ? 5000 : 500); setTimeout(render); } return; }
  if (t.dataset.agNum === 'pausa') { a.siempre = {...agSiempre(a), pausa: Math.max(5, Math.min(1440, Math.round(+t.value) || 30))}; setTimeout(render); return; }
  if (t.dataset.agNum) { const k = t.dataset.agNum, cur = k === 'recordar' ? agRec(a) : agIna(a), n = Math.max(1, Math.min(+t.max || 10080, Math.round(+t.value) || 1)); a[k] = {...cur, tras:n}; setTimeout(render); }
});

/* Flujos: la Bienvenida queda de respaldo mientras el agente atiende primero */
const renderAg = render;
render = function(){ renderAg();
  if (st.pagina === 'flujos' && !st.flujo && AG.primer === 'agente') { const b = document.querySelector('#page [data-fl-abrir="bienvenida"]'); if (b && !b.parentNode.querySelector('.resp-ag')) b.insertAdjacentHTML('afterend', '<span class="pill resp-ag">Respaldo del agente IA</span>'); }
};

document.getElementById('msgs').addEventListener('click', e => {
  const si = e.target.closest('[data-sugt]'), no = e.target.closest('[data-sugt-no]'); if (!si && !no) return;
  const c = CONV.find(x => x.id === st.sel), m = c && c.msgs.find(x => x.sugT && !x.sugT.hecha && !(x._id && c.msgs.some(y => y.sugTDe === x._id))); if (!m) return;
  // La respuesta queda como un evento nuevo en la conversación (los mensajes guardados no se editan).
  const resolver = t => { m.sugT.hecha = true; c.msgs.push({ev:'swap', t, sugTDe:m._id || null}); };
  if (no) { resolver(`${yo} la sigue atendiendo en ${c.equipo || 'Ventas'}`); chat(); return; }
  const eq = m.sugT.eq, as = (MIEMBROS[eq] || []).find(n => USUARIOS.some(u => u.nombre === n)) || null;
  c.equipo = eq; c.asig = as; resolver(`${yo} la transfirió a ${eq}${as ? ' · ' + as : ''}, con la nota de la IA`);
  render(); toast(`Transferida a ${eq}${as ? ': le llega a ' + as : ''}`);
});

// Eliminar un agente: se quita de la lista (ajuste «agentes»); las conversaciones que atendía las pasa el motor a una persona.
document.getElementById('ov-x').addEventListener('click', e => {
  const ok = e.target.closest('[data-ag-borrar-ok]'); if (!ok) return;
  const i = AGENTES.findIndex(x => x.id === ok.dataset.agBorrarOk); if (i < 0) { cerrarDialogo(); return; }
  const [a] = AGENTES.splice(i, 1);
  // Su base de conocimiento se va con él, salvo la que use otro agente.
  for (const id of a.kb || []) if (!AGENTES.some(x => (x.kb || []).includes(id))) { const j = KB.findIndex(k => k.id === id); if (j >= 0) KB.splice(j, 1); }
  if (st.agId === a.id) { st.agId = null; st.agV = 'lista'; }
  cerrarDialogo(); render(); toast(`${a.nombre} quedó eliminado`);
});

/* «Mejorar» (28-sep, como Trengo): lo que el agente no encontró en su base (GET /crm/agentes/mejorar).
   Se responde aquí y queda como fragmento en su base de conocimiento; o se descarta. */
function mejorarCargar(a){
  st.agMej = {ag:a.id, lista:(st.agMej && st.agMej.ag === a.id ? st.agMej.lista : null), cargando:true};
  crmApi('GET', `/crm/agentes/mejorar?ag=${encodeURIComponent(a.id)}`)
    .then(l => { if (st.agMej && st.agMej.ag === a.id) st.agMej = {ag:a.id, lista:Array.isArray(l) ? l : [], cargando:false}; })
    .catch(err => { if (st.agMej && st.agMej.ag === a.id) st.agMej = {ag:a.id, lista:[], cargando:false, error:err.message}; })
    .finally(() => { if (st.pagina === 'agentes' && st.agPest === 'mejorar') render(); });
}
function mejorarHTML(a){
  const M = st.agMej && st.agMej.ag === a.id ? st.agMej : null;
  if (!M) setTimeout(() => mejorarCargar(a));
  const cuerpo = !M || (M.cargando && !M.lista) ? '<p class="muted" style="margin:0">Cargando…</p>'
    : M.error ? `<p class="muted" style="margin:0">No se pudo cargar: ${esc(M.error)}</p>`
    : M.lista.length ? M.lista.map(x => `<div class="ag-mej"><div class="tx"><b>${esc(x.pregunta)}</b><small>${esc(cuandoKB(x.t))} · ${x.n || 1} ${(x.n || 1) === 1 ? 'vez' : 'veces'}</small></div><div class="ag-bts"><button type="button" class="btn" data-mej-ver="${x.conv}">Ver conversación</button><button type="button" class="btn" data-mej-no="${esc(x.id)}">Descartar</button><button type="button" class="btn pri" data-mej-si="${esc(x.id)}">Responder</button></div></div>`).join('')
    : `<div class="vacio">${I('check')}<b>Nada pendiente</b><p>Aquí aparecen las preguntas que el agente no encuentre en sus documentos.</p></div>`;
  return `<div class="ag-card"><h4>${I('bolt')}Lo que no supo responder</h4>
      <p class="muted" style="margin:0">Preguntas que no encontró en sus documentos y por las que pasó la conversación a un asesor. Escribe la respuesta y la usa desde el siguiente mensaje.</p>
      ${cuerpo}</div>`;
}
function mejorarQuitar(id, aviso){
  return crmApi('DELETE', `/crm/agentes/mejorar/${encodeURIComponent(id)}`)
    .then(() => { if (st.agMej) st.agMej.lista = (st.agMej.lista || []).filter(x => x.id !== id); render(); if (aviso) toast(aviso); })
    .catch(err => toast(err.message));
}
document.getElementById('ov-x').addEventListener('click', e => {
  const g = e.target.closest('[data-mej-guardar]'); if (!g) return;
  const a = AGENTES.find(x => x.id === st.agId), x = (st.agMej && st.agMej.lista || []).find(y => y.id === g.dataset.mejGuardar), r = (document.getElementById('mej-r') || {}).value || '';
  if (!a || !x) return;
  if (!r.trim()) { toast('Escribe la respuesta'); return; }
  const k = kbAsegurar(a); k.frag.push({t:x.pregunta, x:r.trim()});
  cerrarDialogo(); render();
  // Primero queda guardada en su base; después sale de la lista.
  crmGuardarYa('kb', 'agentes').then(() => mejorarQuitar(x.id, 'Listo: el agente ya lo sabe'));
});

/* Habilidades (28-sep, los Skills de Trengo): procesos para casos concretos, con lo que hace al terminar.
   Mandan sobre las demás instrucciones salvo las reglas fijas (api/src/services/crm/agentes.ts, habilidadesDe). */
function habilidadesHTML(a){
  const hs = Array.isArray(a.habilidades) ? a.habilidades : [];
  const eqOps = h => [['', 'No pasa la conversación'], ...EQUIPOS.map(e => [e.n, `Pasa a ${e.n}`])].map(([v, n]) => [`${h.id}|${v}`, n]);
  const etqOps = h => [['', 'Sin etiqueta'], ...ETIQS.map(([n]) => [n, `Etiqueta ${n}`])].map(([v, n]) => [`${h.id}|${v}`, n]);
  const etaOps = h => [['', 'No cambia la etapa'], ...nombresEtapas().map(n => [n, `Etapa ${n}`])].map(([v, n]) => [`${h.id}|${v}`, n]);
  const completa = h => h.n && h.cuando && h.pasos;
  const tarjeta = h => st.habEdit === h.id
    ? `<div class="ag-card ag-hab"><h4>${I('bolt')}${esc(h.n || 'Habilidad nueva')}</h4>
        <label class="fld">Nombre<input class="t" data-hab-in="${h.id}|n" value="${esc(h.n)}" placeholder="Ej. Reembolsos"></label>
        <label class="fld">Cuándo la usa<input class="t" data-hab-in="${h.id}|cuando" value="${esc(h.cuando)}" placeholder="Ej. La persona pide que le devuelvan el dinero"></label>
        <label class="fld">Pasos, uno por línea<textarea rows="7" maxlength="5000" data-hab-in="${h.id}|pasos" placeholder="Ej. Pregunta el correo con el que compró&#10;Pregunta hace cuántos días compró&#10;Explica que la garantía es de 7 días">${esc(h.pasos)}</textarea><small class="muted">${(h.pasos || '').length.toLocaleString('es-CO')} de 5.000 caracteres</small></label>
        <span class="lab">Al terminar</span>
        <div class="ag-tiempo">${ddSel('data-hab-eq', eqOps(h), `${h.id}|${h.equipo || ''}`)}${ddSel('data-hab-etq', etqOps(h), `${h.id}|${h.etiqueta || ''}`)}${ddSel('data-hab-eta', etaOps(h), `${h.id}|${h.etapa || ''}`)}</div>
        <div class="ft2"><button type="button" class="btn" data-hab-borrar="${h.id}">${I('x')}Borrar</button><button type="button" class="btn pri" data-hab-listo="1">${I('check')}Listo</button></div></div>`
    : `<div class="ag-card ag-hab"><h4>${I('bolt')}${esc(h.n || 'Sin nombre')}<span class="sp"></span><button type="button" class="tg" role="switch" data-hab-on="${h.id}" aria-checked="${h.on !== false}" aria-label="Usar ${esc(h.n || 'esta habilidad')}"></button><button type="button" class="btn" data-hab-edit="${h.id}">${I('pen')}Editar</button></h4>
        ${completa(h) ? `<p style="margin:0"><b>Cuándo:</b> ${esc(h.cuando)}</p><p class="muted" style="margin:0;white-space:pre-line">${esc(h.pasos.length > 220 ? h.pasos.slice(0, 220) + '…' : h.pasos)}</p>
        ${h.equipo || h.etiqueta || h.etapa ? `<div class="chips2 fijos">${[h.equipo ? `Pasa a ${h.equipo}` : '', h.etiqueta ? `Etiqueta ${h.etiqueta}` : '', h.etapa ? `Etapa ${h.etapa}` : ''].filter(Boolean).map(x => `<span>${esc(x)}</span>`).join('')}</div>` : ''}`
        : '<p class="muted" style="margin:0">Le falta el nombre, cuándo la usa o los pasos: mientras tanto el agente no la usa.</p>'}</div>`;
  return `<div class="ag-card"><h4>${I('bolt')}Habilidades<span class="sp"></span>${hs.length < 10 ? `<button type="button" class="btn" data-hab-nueva="1">${I('plus')}Nueva habilidad</button>` : ''}</h4>
      <p class="muted" style="margin:0">Procesos para casos concretos: cuándo usarlos, qué pasos seguir y qué hacer al terminar. Mandan sobre las demás instrucciones, salvo las reglas fijas. Hasta 10.</p></div>
    ${hs.length ? hs.map(tarjeta).join('') : `<div class="ag-card"><div class="vacio">${I('bolt')}<b>Todavía no tiene habilidades</b><p>Por ejemplo, «Reembolsos»: cuándo alguien pide que le devuelvan el dinero, qué preguntarle y a qué equipo pasarlo.</p></div></div>`}`;
}

/* Integraciones: otras plataformas de la empresa que los agentes
   consultan en solo lectura, de una lista fija de sistemas aprobados (api/src/services/crm/integraciones.ts). Se conectan en
   Ajustes del CRM › Integraciones (cfg-integraciones); en Capacidades de cada agente salen solo las conectadas y ahí se
   elige cuáles usa (`a.consultas`). Las claves se guardan cifradas en el servidor y no vuelven aquí. */
const INTEG = {lista:null, cargando:false, error:''};
/* Lo que la pantalla muestra de cada sistema, con el logo real de la marca (la llama de Hotmart, de hotmart.com). */
const INTEG_UI = {
  hotmart:{logo:'<svg viewBox="-4.49 0.00 31.96 31.96" aria-hidden="true"><path fill="#FF4000" d="M11.4892 26.2887C8.2052 26.2887 5.54065 23.5637 5.54065 20.2035C5.54065 16.8433 8.20241 14.1182 11.4892 14.1182C14.7759 14.1182 17.4377 16.8433 17.4377 20.2035C17.4377 23.5637 14.7759 26.2887 11.4892 26.2887ZM22.285 15.0148C21.874 13.5556 21.2797 12.1326 20.4287 10.7264C20.4287 10.7264 19.6261 9.39738 19.2894 8.99467C19.2075 8.89051 19.0401 9.00584 19.1034 9.12395C19.1992 9.32205 19.2847 9.56386 19.2243 9.80381C19.1257 10.093 18.803 10.2967 18.5044 10.1916C18.4254 10.1582 18.351 10.1116 18.2849 10.0428C17.978 9.72661 17.8218 9.20579 17.6218 8.54268C17.4433 7.95396 17.2247 7.21923 16.8248 6.42591C16.1784 5.13781 15.4111 4.54073 15.3814 4.51562C15.3432 4.48586 15.2884 4.48586 15.2474 4.51562C15.2065 4.54631 15.1898 4.5956 15.2065 4.64489C15.2093 4.65605 15.532 5.71815 14.9108 6.52171C14.6643 6.8435 14.2867 7.03602 13.8477 7.06392C13.4069 7.09089 12.9716 6.9458 12.7084 6.68446C12.0593 6.03251 11.983 4.87647 11.996 4.24591C12.037 2.14309 12.6722 0.670843 13.0042 0.183503C13.034 0.142582 13.0321 0.0849194 12.9986 0.0430678C12.9661 0.00400622 12.914 -0.0118044 12.8675 0.00958644C10.2959 1.12749 8.43306 3.03128 7.48349 5.51727C6.94686 6.9951 6.71435 7.66937 6.52463 8.09347C6.34978 8.48129 6.18795 8.66079 6.02334 8.75938C5.93312 8.81425 5.82059 8.84494 5.70805 8.85052C5.54065 8.83378 4.71105 8.68032 5.43369 7.29271C5.49414 7.17738 5.33511 7.05927 5.24768 7.15506L4.67757 7.78284C4.65246 7.81074 4.62549 7.83771 4.60038 7.86561L4.50458 7.9707C4.48784 7.99024 4.47482 8.00605 4.46087 8.02558C2.66404 10.0791 1.40756 12.7046 0.683992 15.1348C0.0366861 17.4729 -0.00516555 19.3358 0.000414671 20.0463V20.2035C0.000414671 23.3433 1.19458 26.2934 3.36622 28.5152C5.53507 30.7334 8.4219 31.9582 11.4892 31.9582C14.5564 31.9582 17.4433 30.7362 19.6121 28.5152C21.781 26.2943 22.9779 23.3433 22.9779 20.2026C22.9779 18.2011 22.7203 16.5726 22.285 15.0139"/></svg>', cat:'Pagos y ventas', res:'Compras de tus clientes por su correo: producto, estado del pago, fecha y cuotas.',
    ayuda:'Con las credenciales de desarrollador de tu cuenta', para:'Para que los agentes IA consulten las compras de tus clientes',
    pasos:['En Hotmart, entra a Herramientas y luego a Credenciales de desarrollador.', 'Crea una credencial nueva.', 'Copia aquí el Client ID y el Client Secret.']},
  // La bolsa de Shopify, de su marca.
  shopify:{logo:'<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#7AB55C" d="M15.337 23.979l7.216-1.561s-2.604-17.613-2.625-17.73c-.018-.116-.114-.192-.211-.192s-1.929-.136-1.929-.136-1.275-1.274-1.439-1.411c-.045-.037-.075-.057-.121-.074l-.914 21.104h.023zM11.71 11.305s-.81-.424-1.774-.424c-1.447 0-1.504.906-1.504 1.141 0 1.232 3.24 1.715 3.24 4.629 0 2.295-1.44 3.76-3.406 3.76-2.354 0-3.54-1.465-3.54-1.465l.646-2.086s1.245 1.066 2.28 1.066c.675 0 .975-.545.975-.932 0-1.619-2.654-1.694-2.654-4.359-.034-2.237 1.571-4.416 4.827-4.416 1.257 0 1.875.361 1.875.361l-.945 2.715-.02.01zM11.17.83c.136 0 .271.038.405.135-.984.465-2.064 1.639-2.508 3.992-.656.213-1.293.405-1.889.578C7.697 3.75 8.951.84 11.17.84V.83zm1.235 2.949v.135c-.754.232-1.583.484-2.394.736.466-1.777 1.333-2.645 2.085-2.971.193.501.309 1.176.309 2.1zm.539-2.234c.694.074 1.141.867 1.429 1.755-.349.114-.735.231-1.158.366v-.252c0-.752-.096-1.371-.271-1.871v.002zm2.992 1.289c-.02 0-.06.021-.078.021s-.289.075-.714.21c-.423-1.233-1.176-2.37-2.508-2.37h-.115C12.135.209 11.669 0 11.265 0 8.159 0 6.675 3.877 6.21 5.846c-1.194.365-2.063.636-2.16.674-.675.213-.694.232-.772.87-.075.462-1.83 14.063-1.83 14.063L15.009 24l.927-21.166z"/></svg>',
    cat:'Tienda en línea', ayuda:'Con una app personalizada de tu tienda', para:'Para que los agentes IA consulten los pedidos de tus clientes',
    pasos:['En Shopify, entra a Configuración, Apps y canales de venta, Desarrollar apps, y crea una app.', 'En Configuración de la API de Admin, dale solo el permiso read_orders (leer pedidos) e instálala.', 'Copia aquí el dominio de tu tienda (termina en .myshopify.com) y el token de acceso de la API de Admin.']},
  // El ícono oficial de Google Calendar (2020).
  gcal:{logo:'<svg viewBox="0 0 200 200" aria-hidden="true"><g transform="translate(3.75 3.75)"><path fill="#fff" d="M148.882 43.618l-47.368-5.263-57.895 5.263L38.355 96.25l5.263 52.632 52.632 6.579 52.632-6.579 5.263-53.947z"/><path fill="#1A73E8" d="M65.211 125.276c-3.934-2.658-6.658-6.539-8.145-11.671l9.132-3.763c.829 3.158 2.276 5.605 4.342 7.342 2.053 1.737 4.553 2.592 7.474 2.592 2.987 0 5.553-.908 7.697-2.724s3.224-4.132 3.224-6.934c0-2.868-1.132-5.211-3.395-7.026s-5.105-2.724-8.5-2.724h-5.276v-9.039H76.5c2.921 0 5.382-.789 7.382-2.368 2-1.579 3-3.737 3-6.487 0-2.447-.895-4.395-2.684-5.855s-4.053-2.197-6.803-2.197c-2.684 0-4.816.711-6.395 2.145s-2.724 3.197-3.447 5.276l-9.039-3.763c1.197-3.395 3.395-6.395 6.618-8.987 3.224-2.592 7.342-3.895 12.342-3.895 3.697 0 7.026.711 9.974 2.145 2.947 1.434 5.263 3.421 6.934 5.947 1.671 2.539 2.5 5.382 2.5 8.539 0 3.224-.776 5.947-2.329 8.184-1.553 2.237-3.461 3.947-5.724 5.145v.539c2.987 1.25 5.421 3.158 7.342 5.724 1.908 2.566 2.868 5.632 2.868 9.211s-.908 6.776-2.724 9.579c-1.816 2.803-4.329 5.013-7.513 6.618-3.197 1.605-6.789 2.421-10.776 2.421-4.618.013-8.881-1.316-12.815-3.974zM121.25 79.961l-9.974 7.25-5.013-7.605 17.987-12.974h6.895v61.197h-9.895z"/><path fill="#EA4335" d="M148.882 196.25l47.368-47.368-23.684-10.526-23.684 10.526-10.526 23.684z"/><path fill="#34A853" d="M33.092 172.566l10.526 23.684h105.263v-47.368H43.618z"/><path fill="#4285F4" d="M12.039-3.75C3.316-3.75-3.75 3.316-3.75 12.039v136.842l23.684 10.526 23.684-10.526V43.618h105.263l10.526-23.684L148.882-3.75z"/><path fill="#188038" d="M-3.75 148.882v31.579c0 8.724 7.066 15.789 15.789 15.789h31.579v-47.368z"/><path fill="#FBBC04" d="M148.882 43.618v105.263h47.368V43.618l-23.684-10.526z"/><path fill="#1967D2" d="M196.25 43.618V12.039c0-8.724-7.066-15.789-15.789-15.789h-31.579v47.368z"/></g></svg>',
    cat:'Agenda', ayuda:'Compartiendo tu calendario con el CRM', para:'Para que los agentes IA ofrezcan los horarios libres de tu agenda'},
};
const integLogo = id => (INTEG_UI[id] || {}).logo || I('plug');
function integCargar(){
  if (INTEG.cargando) return; INTEG.cargando = true;
  crmApi('GET', '/crm/integraciones')
    .then(l => { INTEG.lista = Array.isArray(l) ? l : []; INTEG.error = ''; })
    .catch(err => { INTEG.error = err.message || 'el servidor no contestó'; })
    .finally(() => { INTEG.cargando = false; if ((st.pagina === 'agentes' && st.agV === 'editor' && st.agPest === 'cap') || st.pagina === 'cfg-integraciones' || st.pagina === 'ajustes') render(); });
}
const integPedir = () => { if (!INTEG.lista && !INTEG.cargando && !INTEG.error) setTimeout(integCargar); };
const integConectadas = () => (INTEG.lista || []).filter(s => s.conectado);
/** La tarjeta de Ajustes del CRM: cuántas hay conectadas. */
function integResumen(){
  integPedir();
  const n = integConectadas().length;
  return `Otras plataformas de tu empresa que los agentes IA pueden consultar${INTEG.lista ? ` · ${n} ${n === 1 ? 'conectada' : 'conectadas'}` : ''}`;
}
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fechaCorta = iso => { const p = new Intl.DateTimeFormat('en-CA', {timeZone:'America/Bogota', year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date(iso)).split('-'); return `${Number(p[2])} ${MESES_CORTOS[Number(p[1]) - 1]} ${p[0]}`; };
document.head.insertAdjacentHTML('beforeend', `<style>
.ig-sec{display:flex;flex-direction:column;gap:10px;margin-top:22px}
.ig-sec > h4{margin:0;display:flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:#6b7280}
.ig-n{display:inline-grid;place-items:center;min-width:20px;height:20px;border-radius:999px;background:#f1f5f9;font-size:11px;font-weight:600;color:#4b5563;padding:0 6px;box-sizing:border-box}
.ig-lista{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px}
.ig-c{display:flex;flex-direction:column;gap:12px;padding:18px;border:1px solid #e5e9f0;border-radius:14px;background:#fff}
.ig-cab{display:flex;align-items:center;gap:12px}
.ig-logo{width:48px;height:48px;border-radius:12px;border:1px solid #eef1f5;background:#fff;display:grid;place-items:center;flex:none;box-sizing:border-box}
.ig-logo img,.ig-logo svg{width:28px;height:28px;object-fit:contain}
.ig-nom{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0}
.ig-nom b{font-size:15px;font-weight:600;color:var(--ink)}
.ig-nom small{font-size:12px;color:#6b7280}
.ig-est{font-size:11.5px;font-weight:500;border-radius:999px;padding:2px 10px;white-space:nowrap}
.ig-est.off{color:#4b5563;background:#f1f5f9}
.ig-est.on{color:#166534;background:#dcfce7}
.ig-c > p{margin:0;font-size:13px;line-height:1.5;color:#374151}
.ig-kv{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 12px;margin:0;font-size:12.5px}
.ig-kv dt{font-weight:600;color:#374151}
.ig-kv dd{margin:0;color:#374151}
.ig-pie{display:flex;align-items:center;gap:8px;padding-top:12px;border-top:1px solid #eef1f5;font-size:12.5px;color:#6b7280}
.ig-pie .sp{flex:1}
.ig-pie .btn{height:36px;padding:0 14px;border-radius:9px;font-size:13px;font-weight:500}
.ig-pie .btn svg{width:16px;height:16px}
.page p.ig-sub{margin:0;max-width:none;font-size:13.5px;line-height:1.5;color:#4b5563}
/* Conectar: el diálogo de 600 px de la maqueta, con el logo, los pasos y las dos claves. */
.dlg.dlg-ig h3{font-size:20px}
.dlg.dlg-ig .ig-dcab{display:flex;align-items:center;gap:14px;padding-right:36px}
.dlg.dlg-ig .ig-dcab > div{display:flex;flex-direction:column;gap:2px}
.dlg.dlg-ig .ig-dcab span{font-size:13px;color:#6b7280}
.ig-pasos{display:flex;flex-direction:column;gap:10px;padding:14px;border:1px solid #eef1f5;border-radius:12px;background:#f8fafc}
.ig-paso{display:flex;gap:12px;align-items:flex-start;font-size:13.5px;line-height:1.5;color:#374151}
.ig-paso i{width:22px;height:22px;border-radius:50%;background:#e8f3ff;color:#1976d2;font-style:normal;font-size:12px;font-weight:600;display:grid;place-items:center;flex:none}
.ig-f{display:flex;flex-direction:column;gap:12px}
.ig-f label{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600;color:#374151}
.ig-f input{height:42px;border:1px solid #e5e9f0;border-radius:10px;padding:0 12px;font:inherit;font-size:14px;font-weight:400;color:var(--ink);box-sizing:border-box;width:100%}
.ig-f input:focus{outline:none;border-color:var(--blue);box-shadow:0 0 0 3px var(--blue-soft)}
.dlg.dlg-ig p.ig-nota{display:flex;gap:8px;align-items:flex-start;font-size:12.5px;line-height:1.5;color:#6b7280}
.ig-nota svg{width:15px;height:15px;flex:none;margin-top:2px}
.dlg.dlg-ig .ft2 .btn{height:40px}
/* Capacidades: solo las conectadas, con su logo, y el enlace para administrarlas. */
.ag-card > h4 .ig-adm{margin-left:auto;display:inline-flex;align-items:center;gap:4px;color:#1976d2;font-size:13px;font-weight:500;background:none;border:0;padding:0;cursor:pointer}
.ag-card > h4 .ig-adm svg{width:15px;height:15px;color:currentColor}
.ag-card > p.ig-txt{margin:0;font-size:13.5px;line-height:1.55;color:#4b5563}
.ag-sis{gap:14px;padding:14px 16px;border:1px solid #eef1f5;border-radius:12px;background:#f8fafc}
.ag-sis .ig-logo{width:40px;height:40px;border-radius:10px}
.ag-sis .ig-logo img,.ag-sis .ig-logo svg{width:24px;height:24px}
.ag-sis .tx b{font-size:14px}
.ag-sis .tx small{font-size:13px;color:#4b5563}
.ag-sis .ag-lock{font-size:13px;color:#4b5563;gap:6px}
.ag-sis .ag-lock svg{width:15px;height:15px}
.ag-sis .tg{width:38px;height:22px}
.ag-sis .tg::after{top:3px;left:3px}
.ag-sis .tg[aria-checked="true"]::after{left:19px}
.ig-vacio{display:flex;flex-direction:column;align-items:center;gap:8px;padding:22px 16px;border:1px dashed #dbe2ea;border-radius:12px;text-align:center}
.ig-vacio .ig-ic{width:44px;height:44px;border-radius:12px;background:#f1f5f9;color:#4b5563;display:grid;place-items:center}
.ig-vacio .ig-ic svg{width:22px;height:22px}
.ig-vacio b{font-size:14px;font-weight:600}
.ig-vacio span.t{font-size:13px;line-height:1.5;color:#4b5563;max-width:520px}
.ig-vacio .btn{margin-top:6px;height:36px;padding:0 14px;border-radius:9px;font-size:13px;font-weight:500}
.ig-vacio .btn svg{width:16px;height:16px}
</style>`);

/* La página de Integraciones (Ajustes del CRM › Integraciones). */
function paginaIntegraciones(){
  integPedir();
  const volver = `<button type="button" class="volver" data-ir="ajustes-crm">${I('back')}Ajustes del CRM</button>`;
  const cab = `${volver}<h2>Integraciones</h2><p class="sub ig-sub">Conecta otras plataformas que usa tu empresa. Los agentes IA pueden consultar las que estén conectadas; en Capacidades de cada agente eliges cuáles usa. Solo consultan: nunca crean, cambian ni borran nada.</p>`;
  if (!INTEG.lista) return `<div class="ajw ancho">${cab}<p class="muted">${INTEG.error ? `No se pudo cargar: ${esc(INTEG.error)}` : 'Cargando…'}</p></div>`;
  const incluida = '';
  const tarjeta = s => { const u = INTEG_UI[s.id] || {};
    const usan = AGENTES.filter(a => (a.consultas || []).some(id => s.consultas.some(c => c.id === id))).map(a => a.nombre).filter(Boolean);
    return `<article class="ig-c"><div class="ig-cab"><span class="ig-logo">${integLogo(s.id)}</span><span class="ig-nom"><b>${esc(s.n)}</b><small>${esc(u.cat || 'Otras plataformas')}</small></span><span class="ig-est ${s.conectado ? 'on' : 'off'}">${s.conectado ? 'Conectada' : 'Sin conectar'}</span></div>
      <p>${esc(u.res || s.d)}</p>
      ${s.conectado ? `<dl class="ig-kv">${(s.datos || []).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}<dt>La usan</dt><dd>${usan.length ? esc(usan.join(', ')) : 'Ningún agente todavía'}</dd>${s.desde ? `<dt>Conectada</dt><dd>${esc(fechaCorta(s.desde))}${s.por ? `, por ${esc(s.por)}` : ''}</dd>` : ''}</dl>
        <div class="ig-pie"><span class="sp"></span><button type="button" class="btn" data-integ-quitar="${esc(s.id)}">${I('x')}Desconectar</button></div>`
      : `<div class="ig-pie"><span class="sp">${esc(u.ayuda || '')}</span><button type="button" class="btn" data-integ-conectar="${esc(s.id)}">${I('link')}Conectar</button></div>`}</article>`; };
  // Una sola sección, con las conectadas primero: el estado de cada una lo dice su etiqueta (5-oct).
  const todas = [...INTEG.lista.filter(s => s.conectado), ...INTEG.lista.filter(s => !s.conectado)];
  const sec = (t, n, html) => `<section class="ig-sec"><h4>${t} <span class="ig-n">${n}</span></h4><div class="ig-lista">${html}</div></section>`;
  return `<div class="ajw ancho">${cab}${todas.length ? sec('Plataformas', todas.length, incluida + todas.map(tarjeta).join('')) : ''}</div>`;
}
const paginaCfgInteg = paginaCfg;
paginaCfg = function(k){ return k === 'integraciones' ? paginaIntegraciones() : paginaCfgInteg(k); };

/* Capacidades del agente: solo las integraciones conectadas; conectar y desconectar se hace en Integraciones. */
function consultasHTML(a, sw){
  integPedir();
  const on = id => (a.consultas || []).includes(id);
  const incluida = '';
  const filas = integConectadas().map(s => `<div class="ag-sis"><span class="ig-logo">${integLogo(s.id)}</span><span class="tx"><b>${esc(s.n)}</b><small>${esc(s.d.replace(/\.$/, ''))}</small></span>${s.consultas.map(c => sw(`data-ag-consulta="${esc(c.id)}"`, on(c.id), `Usar ${s.n}`)).join('')}</div>`).join('');
  const adm = `<button type="button" class="ig-adm" data-ir="cfg-integraciones">Administrar integraciones${I('next')}</button>`;
  const cuerpo = !INTEG.lista && !incluida ? `<p class="muted" style="margin:0">${INTEG.error ? `No se pudo cargar: ${esc(INTEG.error)}` : 'Cargando…'}</p>`
    : incluida || filas ? `<p class="ig-txt">Mientras conversa, el agente puede consultar datos en vivo en las integraciones conectadas. Solo consulta: nunca crea, cambia ni borra nada. Aquí eliges cuáles usa este agente.</p>${incluida}${filas}`
    : `<div class="ig-vacio"><span class="ig-ic">${I('plug')}</span><b>Todavía no hay integraciones conectadas</b><span class="t">Cuando conectes otra plataforma en Ajustes del CRM, Integraciones, aparece aquí para que elijas si este agente la consulta.</span><button type="button" class="btn" data-ir="cfg-integraciones">Ir a Integraciones${I('next')}</button></div>`;
  return `<div class="ag-card"><h4>${I('plug')}Integraciones${incluida || filas ? adm : ''}</h4>${cuerpo}</div>`;
}
document.getElementById('page').addEventListener('click', e => {
  if (st.pagina !== 'agentes' || st.agV !== 'editor') return; const t = e.target, a = AGENTES.find(x => x.id === st.agId); if (!a) return;
  const ir = t.closest('[data-ir="cfg-integraciones"]'); if (ir) { e.stopImmediatePropagation(); st.pagina = 'cfg-integraciones'; render(); return; }
  const cs = t.closest('[data-ag-consulta]'); if (cs) { const id = cs.dataset.agConsulta, l = (a.consultas || []).filter(x => x !== id);
    if (l.length === (a.consultas || []).length) l.push(id); a.consultas = l; render();
    const s = (INTEG.lista || []).find(x => x.consultas.some(c => c.id === id)); toast(l.includes(id) ? `${a.nombre} ya puede consultar ${s ? s.n : 'esa integración'}` : `${a.nombre} ya no consulta ${s ? s.n : 'esa integración'}`); return; }
}, true);
document.getElementById('page').addEventListener('click', e => {
  if (st.pagina !== 'cfg-integraciones') return; const t = e.target;
  const cn = t.closest('[data-integ-conectar]'); if (cn) { const s = (INTEG.lista || []).find(x => x.id === cn.dataset.integConectar), u = s && INTEG_UI[s.id]; if (!s || !u) return;
    abrirDialogo(`<div class="ig-dcab"><span class="ig-logo">${integLogo(s.id)}</span><div><h3>Conectar ${esc(s.n)}</h3><span>${esc(u.para)}</span></div></div>
      <div class="ig-pasos">${u.pasos.map((p, i) => `<span class="ig-paso"><i>${i + 1}</i>${esc(p)}</span>`).join('')}</div>
      <div class="ig-f"><label>Client ID<input id="hm-id" placeholder="Pégalo aquí" autocomplete="off" spellcheck="false"></label><label>Client Secret<input id="hm-sec" type="password" placeholder="Pégalo aquí" autocomplete="new-password" spellcheck="false"></label></div>
      <p class="ig-nota">${I('lock')}Se guardan cifradas y no se vuelven a mostrar. Solo se usan para consultar: nada se crea, cambia ni borra en ${esc(s.n)}.</p>
      <div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" data-integ-guardar="${esc(s.id)}">${I('link')}Conectar</button></div>`, 'dlg-per dlg-ig');
    setTimeout(() => { const x = document.getElementById('hm-id'); if (x) x.focus(); }, 30); return; }
  const qt = t.closest('[data-integ-quitar]'); if (qt) { const s = (INTEG.lista || []).find(x => x.id === qt.dataset.integQuitar); if (!s) return;
    abrirDialogo(`<h3>Desconectar ${esc(s.n)}</h3><p>Se borran las credenciales guardadas y ningún agente podrá consultar ${esc(s.n)} hasta que la conectes de nuevo.</p><div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" style="background:#dc2626;border-color:#dc2626" data-integ-quitar-ok="${esc(s.id)}">${I('x')}Desconectar</button></div>`); }
});
document.getElementById('ov-x').addEventListener('click', e => {
  const g = e.target.closest('[data-integ-guardar]'), q = e.target.closest('[data-integ-quitar-ok]'); if (!g && !q) return;
  if (g) { const id = (document.getElementById('hm-id') || {}).value || '', sec = (document.getElementById('hm-sec') || {}).value || '';
    if (!id.trim() || !sec.trim()) { toast('Escribe el Client ID y el Client Secret'); return; }
    const s = (INTEG.lista || []).find(x => x.id === g.dataset.integGuardar); g.disabled = true; g.textContent = 'Conectando…';
    crmApi('POST', `/crm/integraciones/${encodeURIComponent(g.dataset.integGuardar)}`, {clientId:id.trim(), clientSecret:sec.trim()})
      .then(l => { INTEG.lista = Array.isArray(l) ? l : INTEG.lista; cerrarDialogo(); render(); toast(`${s ? s.n : 'La integración'} quedó conectada. Elige en Capacidades qué agentes la usan.`); })
      .catch(err => { g.disabled = false; g.innerHTML = `${I('link')}Conectar`; toast(err.message); });
    return; }
  const id = q.dataset.integQuitarOk; q.disabled = true;
  crmApi('DELETE', `/crm/integraciones/${encodeURIComponent(id)}`)
    .then(l => { INTEG.lista = Array.isArray(l) ? l : INTEG.lista; cerrarDialogo(); render(); toast('Quedó desconectada'); })
    .catch(err => { q.disabled = false; toast(err.message); });
});

/* Shopify (6-oct): el dominio de la tienda y el token de su app personalizada (solo lectura de pedidos). */
document.getElementById('page').addEventListener('click', e => {
  if (st.pagina !== 'cfg-integraciones') return;
  const cn = e.target.closest('[data-integ-conectar="shopify"]'); if (!cn) return;
  e.stopImmediatePropagation();
  const s = (INTEG.lista || []).find(x => x.id === 'shopify'), u = INTEG_UI.shopify; if (!s) return;
  abrirDialogo(`<div class="ig-dcab"><span class="ig-logo">${integLogo('shopify')}</span><div><h3>Conectar Shopify</h3><span>${esc(u.para)}</span></div></div>
    <div class="ig-pasos">${u.pasos.map((p, i) => `<span class="ig-paso"><i>${i + 1}</i>${esc(p)}</span>`).join('')}</div>
    <div class="ig-f"><label>Dominio de la tienda<input id="sp-tienda" placeholder="mitienda.myshopify.com" autocomplete="off" spellcheck="false"></label><label>Token de acceso de la API de Admin<input id="sp-token" type="password" placeholder="shpat_…" autocomplete="new-password" spellcheck="false"></label></div>
    <p class="ig-nota">${I('lock')}Se guarda cifrado y no se vuelve a mostrar. Solo se usa para consultar: nada se crea, cambia ni cancela en tu tienda.</p>
    <div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" data-sp-guardar="1">${I('link')}Conectar</button></div>`, 'dlg-per dlg-ig');
  setTimeout(() => { const x = document.getElementById('sp-tienda'); if (x) x.focus(); }, 30);
}, true);
document.getElementById('ov-x').addEventListener('click', e => {
  const g = e.target.closest('[data-sp-guardar]'); if (!g) return;
  const v = id => ((document.getElementById(id) || {}).value || '').trim();
  if (!v('sp-tienda') || !v('sp-token')) { toast('Escribe el dominio de la tienda y el token'); return; }
  g.disabled = true; g.textContent = 'Conectando…';
  crmApi('POST', '/crm/integraciones/shopify', {tienda: v('sp-tienda'), token: v('sp-token')})
    .then(l => { INTEG.lista = Array.isArray(l) ? l : INTEG.lista; cerrarDialogo(); render(); toast('Shopify quedó conectado. Elige en Capacidades qué agentes lo usan.'); })
    .catch(err => { g.disabled = false; g.textContent = ''; g.insertAdjacentHTML('beforeend', `${I('link')}Conectar`); toast(err.message); });
});

/* Google Calendar (6-oct): se conecta compartiendo el calendario con el correo del CRM («Ver solo información de
   disponible/ocupado») y diciendo cuánto dura cada cita, en qué horario y días se dan, y el enlace para reservar. */
const GC_DIAS = [[1, 'L'], [2, 'M'], [3, 'M'], [4, 'J'], [5, 'V'], [6, 'S'], [0, 'D']];
const GC_DIAS_N = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
document.head.insertAdjacentHTML('beforeend', `<style>
.gc-cuenta{display:flex;align-items:center;gap:8px;margin-top:6px;padding:8px 10px;border:1px solid #e5e9f0;border-radius:9px;background:#fff;font-size:12.5px;font-family:ui-monospace,monospace;word-break:break-all}
.gc-cuenta button{margin-left:auto;flex:none;height:28px;padding:0 10px;border-radius:7px;font:inherit;font-family:Inter,system-ui,sans-serif;font-size:12px}
.gc-fila{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.ig-f select{height:42px;border:1px solid #e5e9f0;border-radius:10px;padding:0 10px;font:inherit;font-size:14px;font-weight:400;background:#fff}
.gc-dias{display:flex;gap:6px;flex-wrap:wrap}
.gc-dias button{width:38px;height:38px;border-radius:10px;border:1px solid #e5e9f0;background:#fff;font-weight:600;font-size:13px;color:#4b5563;cursor:pointer}
.gc-dias button[aria-pressed="true"]{background:var(--nx-negro,#0b0b10);border-color:var(--nx-negro,#0b0b10);color:#fff}
.ig-f .gc-op{font-weight:400;color:#6b7280}
@media (max-width:560px){.gc-fila{grid-template-columns:1fr}}
</style>`);
document.getElementById('page').addEventListener('click', e => {
  if (st.pagina !== 'cfg-integraciones') return;
  const cn = e.target.closest('[data-integ-conectar="gcal"]'); if (!cn) return;
  e.stopImmediatePropagation();
  const s = (INTEG.lista || []).find(x => x.id === 'gcal'); if (!s) return;
  const sin = !s.cuenta;
  const pasos = ['En Google Calendar, abre la configuración del calendario de las citas y entra a «Compartir con personas o grupos específicos».', 'Agrega este correo con el permiso «Ver solo información de disponible/ocupado (ocultar detalles)»:', 'Escribe aquí el ID del calendario: para el principal es el correo de tu cuenta de Google. Está en la misma configuración, en «Integrar el calendario».'];
  abrirDialogo(`<div class="ig-dcab"><span class="ig-logo">${integLogo('gcal')}</span><div><h3>Conectar Google Calendar</h3><span>${esc(INTEG_UI.gcal.para)}</span></div></div>
    ${sin ? `<div class="mt-aviso">${I('lock')}<span>Google Calendar todavía no está disponible en este CRM. Escríbenos y lo activamos.</span></div>` : `<div class="ig-pasos">${pasos.map((p, i) => `<span class="ig-paso"><i>${i + 1}</i><span>${esc(p)}${i === 1 ? `<span class="gc-cuenta" id="gc-cuenta">${esc(s.cuenta)}<button type="button" class="btn" data-gc-copiar="1">Copiar</button></span>` : ''}</span></span>`).join('')}</div>`}
    <div class="ig-f"><label>ID del calendario<input id="gc-cal" type="email" placeholder="agenda@tuempresa.com" autocomplete="off" spellcheck="false"></label>
      <div class="gc-fila"><label>Cada cita dura<select id="gc-dur">${[15, 20, 30, 45, 60, 90, 120].map(m => `<option value="${m}"${m === 30 ? ' selected' : ''}>${m < 60 ? m + ' minutos' : m === 60 ? '1 hora' : (m / 60) + ' horas'}</option>`).join('')}</select></label>
        <label>Desde<input id="gc-desde" type="time" value="08:00" step="900"></label><label>Hasta<input id="gc-hasta" type="time" value="18:00" step="900"></label></div>
      <label>Días de citas<span class="gc-dias" id="gc-dias">${GC_DIAS.map(([d, l]) => `<button type="button" data-gc-dia="${d}" aria-pressed="${d >= 1 && d <= 5}" aria-label="${GC_DIAS_N[d]}">${l}</button>`).join('')}</span></label>
      <label>Enlace para reservar <span class="gc-op">(opcional)</span><input id="gc-enlace" type="url" placeholder="https://calendar.app.google/… o tu página de Calendly" autocomplete="off"></label></div>
    <p class="ig-nota">${I('lock')}El CRM solo ve si cada hora está libre u ocupada, nunca el detalle de tus citas, y no agenda nada. Con el enlace, el agente lo comparte para que la persona reserve; sin él, pasa la conversación a tu equipo con la hora que eligió.</p>
    <div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" data-gc-guardar="1"${sin ? ' disabled' : ''}>${I('link')}Conectar</button></div>`, 'dlg-per dlg-ig');
  setTimeout(() => { const x = document.getElementById('gc-cal'); if (x) x.focus(); }, 30);
}, true);
document.getElementById('ov-x').addEventListener('click', e => {
  const d = e.target.closest('[data-gc-dia]'); if (d) { d.setAttribute('aria-pressed', String(d.getAttribute('aria-pressed') !== 'true')); return; }
  if (e.target.closest('[data-gc-copiar]')) { const s = (INTEG.lista || []).find(x => x.id === 'gcal'); try { navigator.clipboard.writeText(s.cuenta); toast('Correo copiado'); } catch { toast('No se pudo copiar: selecciónalo y cópialo'); } return; }
  const g = e.target.closest('[data-gc-guardar]'); if (!g) return;
  const v = id => ((document.getElementById(id) || {}).value || '').trim();
  const dias = [...document.querySelectorAll('#gc-dias [aria-pressed="true"]')].map(b => Number(b.dataset.gcDia));
  if (!v('gc-cal')) { toast('Escribe el ID del calendario'); return; }
  if (!dias.length) { toast('Elige al menos un día para las citas'); return; }
  g.disabled = true; g.textContent = 'Revisando el calendario…';
  crmApi('POST', '/crm/integraciones/gcal', {calendario: v('gc-cal'), duracion: Number(v('gc-dur')), desde: v('gc-desde'), hasta: v('gc-hasta'), dias, enlace: v('gc-enlace')})
    .then(l => { INTEG.lista = Array.isArray(l) ? l : INTEG.lista; cerrarDialogo(); render(); toast('Google Calendar quedó conectado. Elige en Capacidades qué agentes lo usan.'); })
    .catch(err => { g.disabled = false; g.textContent = ''; g.insertAdjacentHTML('beforeend', `${I('link')}Conectar`); toast(err.message); });
});

/* ── Motor de IA (5-oct): Claude, Gemini u OpenAI con la clave de la cuenta de la empresa, que le paga directo al
   proveedor (api/src/services/crm/motorIA.ts). El proveedor solo pone el modelo: instrucciones, conocimiento,
   capacidades y permisos de cada agente siguen en el CRM. Va arriba en Integraciones, con los logos reales de cada
   marca. La clave se guarda cifrada y no vuelve aquí (solo sus últimos 4 caracteres). Starter no trae IA. ── */
const MOTOR = {estado:null, cargando:false, error:''};
let motorLogoN = 0;
const MOTOR_UI = {
  claude:{logo:() => '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#D97757" d="m4.7144 15.9555 4.7174-2.6471.079-.2307-.079-.1275h-.2307l-.7893-.0486-2.6956-.0729-2.3375-.0971-2.2646-.1214-.5707-.1215-.5343-.7042.0546-.3522.4797-.3218.686.0608 1.5179.1032 2.2767.1578 1.6514.0972 2.4468.255h.3886l.0546-.1579-.1336-.0971-.1032-.0972L6.973 9.8356l-2.55-1.6879-1.3356-.9714-.7225-.4918-.3643-.4614-.1578-1.0078.6557-.7225.8803.0607.2246.0607.8925.686 1.9064 1.4754 2.4893 1.8336.3643.3035.1457-.1032.0182-.0728-.164-.2733-1.3539-2.4467-1.445-2.4893-.6435-1.032-.17-.6194c-.0607-.255-.1032-.4674-.1032-.7285L6.287.1335 6.6997 0l.9957.1336.419.3642.6192 1.4147 1.0018 2.2282 1.5543 3.0296.4553.8985.2429.8318.091.255h.1579v-.1457l.1275-1.706.2368-2.0947.2307-2.6957.0789-.7589.3764-.9107.7468-.4918.5828.2793.4797.686-.0668.4433-.2853 1.8517-.5586 2.9021-.3643 1.9429h.2125l.2429-.2429.9835-1.3053 1.6514-2.0643.7286-.8196.85-.9046.5464-.4311h1.0321l.759 1.1293-.34 1.1657-1.0625 1.3478-.8804 1.1414-1.2628 1.7-.7893 1.36.0729.1093.1882-.0183 2.8535-.607 1.5421-.2794 1.8396-.3157.8318.3886.091.3946-.3278.8075-1.967.4857-2.3072.4614-3.4364.8136-.0425.0304.0486.0607 1.5482.1457.6618.0364h1.621l3.0175.2247.7892.522.4736.6376-.079.4857-1.2142.6193-1.6393-.3886-3.825-.9107-1.3113-.3279h-.1822v.1093l1.0929 1.0686 2.0035 1.8092 2.5075 2.3314.1275.5768-.3218.4554-.34-.0486-2.2039-1.6575-.85-.7468-1.9246-1.621h-.1275v.17l.4432.6496 2.3436 3.5214.1214 1.0807-.17.3521-.6071.2125-.6679-.1214-1.3721-1.9246L14.38 17.959l-1.1414-1.9428-.1397.079-.674 7.2552-.3156.3703-.7286.2793-.6071-.4614-.3218-.7468.3218-1.4753.3886-1.9246.3157-1.53.2853-1.9004.17-.6314-.0121-.0425-.1397.0182-1.4328 1.9672-2.1796 2.9446-1.7243 1.8456-.4128.164-.7164-.3704.0667-.6618.4008-.5889 2.386-3.0357 1.4389-1.882.929-1.0868-.0062-.1579h-.0546l-6.3385 4.1164-1.1293.1457-.4857-.4554.0608-.7467.2307-.2429 1.9064-1.3114Z"/></svg>',
    cat:'Anthropic', ayuda:'Con la clave de la Consola de Anthropic', clave:'sk-ant-…',
    pasos:['Entra a console.anthropic.com con la cuenta de tu empresa.', 'En Billing agrega un método de pago y, si quieres, un límite de gasto por mes.', 'En API Keys crea una clave nueva y pégala aquí.']},
  gemini:{logo:() => { const id = 'mt-gem-' + (++motorLogoN); return `<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#4796E3"/><stop offset=".55" stop-color="#9177C7"/><stop offset="1" stop-color="#CA6673"/></linearGradient></defs><path fill="url(#${id})" d="M11.04 19.32Q12 21.51 12 24q0-2.49.93-4.68.96-2.19 2.58-3.81t3.81-2.55Q21.51 12 24 12q-2.49 0-4.68-.93a12.3 12.3 0 0 1-3.81-2.58 12.3 12.3 0 0 1-2.58-3.81Q12 2.49 12 0q0 2.49-.96 4.68-.93 2.19-2.55 3.81a12.3 12.3 0 0 1-3.81 2.58Q2.49 12 0 12q2.49 0 4.68.96 2.19.93 3.81 2.55t2.55 3.81"/></svg>`; },
    cat:'Google', ayuda:'Con la clave de Google AI Studio', clave:'AIza…',
    pasos:['Entra a aistudio.google.com con la cuenta de Google de tu empresa.', 'Toca «Get API key» y crea una clave en un proyecto.', 'Activa la facturación de ese proyecto: en el nivel gratis los límites son bajos y Google puede usar los mensajes para mejorar sus productos.', 'Pega la clave aquí.']},
  openai:{logo:() => '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#111114" d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/></svg>',
    cat:'OpenAI', ayuda:'Con la clave de la plataforma de OpenAI', clave:'sk-…',
    pasos:['Entra a platform.openai.com con la cuenta de tu empresa.', 'En Billing agrega un método de pago y un límite de gasto por mes.', 'En API keys crea una clave nueva y pégala aquí.']},
};
const motorLogo = id => (MOTOR_UI[id] ? MOTOR_UI[id].logo() : I('bolt'));
function motorCargar(){
  if (MOTOR.cargando) return; MOTOR.cargando = true;
  crmApi('GET', '/crm/motor-ia')
    .then(e => { MOTOR.estado = e && Array.isArray(e.proveedores) ? e : null; MOTOR.error = MOTOR.estado ? '' : 'respuesta inesperada'; })
    .catch(err => { MOTOR.error = err.message || 'el servidor no contestó'; })
    .finally(() => { MOTOR.cargando = false; if (st.pagina === 'cfg-integraciones' || st.pagina === 'agentes') render(); });
}
const motorPedir = () => { if (!MOTOR.estado && !MOTOR.cargando && !MOTOR.error) setTimeout(motorCargar); };
document.head.insertAdjacentHTML('beforeend', `<style>
.ig-sec > p.mt-sub{margin:0 0 2px;font-size:13px;line-height:1.5;color:#4b5563;max-width:760px}
.ig-est.uso{color:#166534;background:#dcfce7}
.ig-est.uso::before{content:"";display:inline-block;width:6px;height:6px;border-radius:50%;background:#22c55e;margin-right:6px;vertical-align:1px}
.ig-c.mt-uso{border-color:#bbf7d0}
.ig-kv dd.mt-mono{font-variant-numeric:tabular-nums;letter-spacing:.02em}
.ig-pie .btn.pri{background:var(--nx-negro,#0b0b10);border-color:var(--nx-negro,#0b0b10);color:#fff}
.ig-pie .btn[disabled]{opacity:.5;cursor:not-allowed}
.mt-aviso{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid #fde68a;border-radius:12px;background:#fffbeb;font-size:13px;line-height:1.5;color:#92400e}
.mt-aviso svg{width:16px;height:16px;flex:none}
.mt-aviso span{flex:1}
.mt-aviso .btn{height:34px;padding:0 12px;border-radius:9px;font-size:13px;font-weight:500;flex:none}
.mt-aviso.info{border-color:#e5e9f0;background:#f8fafc;color:#374151}
</style>`);
function motorSeccion(){
  motorPedir();
  const t = '<h4>Motor de IA</h4><p class="mt-sub">El modelo que mueve a tus agentes IA, las sugerencias y el embudo automático. Conectas la cuenta de tu empresa y el proveedor te cobra directo lo que uses; NexCode97 no cobra recargo. Las instrucciones, el conocimiento y los permisos de cada agente siguen en el CRM, con cualquier motor.</p>';
  if (!MOTOR.estado) return `<section class="ig-sec">${t}<p class="muted" style="margin:0">${MOTOR.error ? `No se pudo cargar: ${esc(MOTOR.error)}` : 'Cargando…'}</p></section>`;
  const e = MOTOR.estado;
  // Aquí solo el candado de Starter; el aviso de que falta motor va en Agentes IA, que es donde se nota.
  const aviso = !e.disponible ? `<div class="mt-aviso">${I('lock')}<span>El motor de IA viene desde el plan Growth. Starter no trae agentes ni respuestas con IA.</span><button type="button" class="btn" data-ir="cfg-plan">Ver planes</button></div>` : '';
  const tarjeta = p => { const u = MOTOR_UI[p.id] || {};
    const est = p.activo ? '<span class="ig-est uso">En uso</span>' : p.conectado ? '<span class="ig-est off">Conectado</span>' : '<span class="ig-est off">Sin conectar</span>';
    const kv = p.conectado ? `<dl class="ig-kv">${p.modelo ? `<dt>Modelo</dt><dd>${esc(p.modelo)}</dd>` : ''}<dt>Clave</dt><dd class="mt-mono">•••• ${esc(p.fin || '')}</dd>${p.desde ? `<dt>Conectado</dt><dd>${esc(fechaCorta(p.desde))}${p.por ? `, por ${esc(p.por)}` : ''}</dd>` : ''}</dl>` : '';
    const pie = p.conectado
      ? `<div class="ig-pie"><span class="sp">${p.activo ? 'Lo usan los agentes de este CRM' : ''}</span>${p.activo ? '' : `<button type="button" class="btn pri" data-motor-usar="${esc(p.id)}">${I('check')}Usar este</button>`}<button type="button" class="btn" data-motor-quitar="${esc(p.id)}">${I('x')}Desconectar</button></div>`
      : `<div class="ig-pie"><span class="sp">${esc(u.ayuda || '')}</span><button type="button" class="btn" data-motor-conectar="${esc(p.id)}"${e.disponible ? '' : ' disabled'}>${I('link')}Conectar</button></div>`;
    return `<article class="ig-c${p.activo ? ' mt-uso' : ''}"><div class="ig-cab"><span class="ig-logo">${motorLogo(p.id)}</span><span class="ig-nom"><b>${esc(p.n)}</b><small>${esc(u.cat || p.empresa)}</small></span>${est}</div><p>${esc(p.d)}</p>${kv}${pie}</article>`; };
  return `<section class="ig-sec">${t}${aviso}<div class="ig-lista">${e.proveedores.map(tarjeta).join('')}</div></section>`;
}
// Va arriba de las demás integraciones; el texto de la cabecera ya no dice que todo es solo de consulta.
const paginaIntegSinMotor = paginaIntegraciones;
paginaIntegraciones = function(){
  const h = paginaIntegSinMotor();
  const i = h.indexOf('<section class="ig-sec">'), sec = motorSeccion();
  const conMotor = i < 0 ? h.replace(/<\/div>$/, sec + '</div>') : h.slice(0, i) + sec + h.slice(i);
  return conMotor.replace('Conecta otras plataformas que usa tu empresa. Los agentes IA pueden consultar las que estén conectadas; en Capacidades de cada agente eliges cuáles usa. Solo consultan: nunca crean, cambian ni borran nada.',
    'El motor de IA de tus agentes y las otras plataformas que usa tu empresa. Las plataformas solo se consultan: los agentes nunca crean, cambian ni borran nada en ellas; en Capacidades de cada agente eliges cuáles usa.');
};
/* «Modelo y consumo» en Capacidades de cada agente (6-oct): con qué motor y modelo responde y dónde se ve lo que gasta
   (lo cobra el proveedor directo a la empresa). Se cambia en Integraciones › Motor de IA. */
const MOTOR_CONSUMO = {claude:'https://console.anthropic.com/settings/usage', gemini:'https://aistudio.google.com/usage', openai:'https://platform.openai.com/usage'};
const consultasSinMotor = consultasHTML;
consultasHTML = function(a, sw){
  const h = consultasSinMotor(a, sw);
  motorPedir();
  const e = MOTOR.estado, p = e && e.proveedores.find(x => x.activo);
  const adm = `<button type="button" class="ig-adm" data-ir="cfg-integraciones">${p ? 'Cambiar motor' : 'Conectar un motor'}${I('next')}</button>`;
  const cuerpo = !e ? `<p class="muted" style="margin:0">${MOTOR.error ? 'No se pudo cargar el motor de IA.' : 'Cargando…'}</p>`
    : p ? `<div class="ag-sis"><span class="ig-logo">${motorLogo(p.id)}</span><span class="tx"><b>${esc(p.n)}${p.modelo ? ' · ' + esc(p.modelo) : ''}</b><small>Lo que usa este agente lo cobra ${esc(p.empresa)} directo a tu empresa. <a href="${MOTOR_CONSUMO[p.id]}" target="_blank" rel="noopener noreferrer">Ver el consumo en ${esc(p.empresa)}</a></small></span></div>`
    : e.servidor ? '<p class="ig-txt">Este agente usa la clave de NexCode97 mientras no conectes un motor de IA propio.</p>'
    : '<p class="ig-txt">Sin un motor de IA conectado, este agente no responde: las conversaciones pasan a tu equipo.</p>';
  return h + `<div class="ag-card"><h4>${I('bolt')}Modelo y consumo${adm}</h4>${cuerpo}</div>`;
};
/* En Agentes IA (Panel de control): si no hay motor, los agentes no responden; el aviso lleva a conectarlo. */
const paginaAgentesSinMotor = paginaAgentes;
paginaAgentes = function(){
  const h = paginaAgentesSinMotor();
  if (st.agV === 'editor' || st.agV === 'plantillas') return h;
  motorPedir();
  const e = MOTOR.estado; if (!e || !e.disponible) return h;
  const aviso = e.servidor ? `<div class="mt-aviso info">${I('bolt')}<span>Tus agentes usan la clave de NexCode97 mientras no conectes un motor de IA propio.</span><button type="button" class="btn" data-ir="cfg-integraciones">Ver motores</button></div>`
    : !e.proveedores.some(p => p.activo) ? `<div class="mt-aviso">${I('bolt')}<span>Sin un motor de IA conectado, los agentes no responden: las conversaciones pasan a tu equipo.</span><button type="button" class="btn" data-ir="cfg-integraciones">Conectar un motor</button></div>` : '';
  return aviso ? h.replace('<div class="cfg">', '<div class="cfg">' + aviso) : h;
};
const motorBotonConectar = b => { b.disabled = false; b.textContent = ''; b.insertAdjacentHTML('beforeend', `${I('link')}Conectar`); };
document.getElementById('page').addEventListener('click', e => {
  if (st.pagina !== 'cfg-integraciones' || !MOTOR.estado) return; const t = e.target;
  const cn = t.closest('[data-motor-conectar]'); if (cn) { const p = MOTOR.estado.proveedores.find(x => x.id === cn.dataset.motorConectar), u = p && MOTOR_UI[p.id]; if (!p || !u) return;
    abrirDialogo(`<div class="ig-dcab"><span class="ig-logo">${motorLogo(p.id)}</span><div><h3>Conectar ${esc(p.n)}</h3><span>Para que tus agentes IA respondan con los modelos de ${esc(p.empresa)}</span></div></div>
      <div class="ig-pasos">${u.pasos.map((x, i) => `<span class="ig-paso"><i>${i + 1}</i>${esc(x)}</span>`).join('')}</div>
      <div class="ig-f"><label>Clave de API<input id="mt-clave" type="password" placeholder="${esc(u.clave)}" autocomplete="new-password" spellcheck="false"></label></div>
      <p class="ig-nota">${I('lock')}Se guarda cifrada y no se vuelve a mostrar. ${esc(p.empresa)} le cobra directo a tu empresa lo que usen los agentes; ponle un límite de gasto en tu cuenta.</p>
      <div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" data-motor-guardar="${esc(p.id)}">${I('link')}Conectar</button></div>`, 'dlg-per dlg-ig');
    setTimeout(() => { const x = document.getElementById('mt-clave'); if (x) x.focus(); }, 30); return; }
  const us = t.closest('[data-motor-usar]'); if (us) { const p = MOTOR.estado.proveedores.find(x => x.id === us.dataset.motorUsar); us.disabled = true;
    crmApi('POST', `/crm/motor-ia/${encodeURIComponent(us.dataset.motorUsar)}/usar`)
      .then(r => { MOTOR.estado = r; render(); toast(`Los agentes ya responden con ${p ? p.n : 'ese motor'}`); })
      .catch(err => { us.disabled = false; toast(err.message); }); return; }
  const qt = t.closest('[data-motor-quitar]'); if (qt) { const p = MOTOR.estado.proveedores.find(x => x.id === qt.dataset.motorQuitar); if (!p) return;
    const otro = MOTOR.estado.proveedores.find(x => x.conectado && x.id !== p.id);
    abrirDialogo(`<h3>Desconectar ${esc(p.n)}</h3><p>Se borra la clave guardada. ${p.activo ? (otro ? `Los agentes pasan a responder con ${esc(otro.n)}.` : 'Los agentes IA dejan de responder y las conversaciones pasan a tu equipo hasta que conectes otro motor.') : 'Los agentes siguen con el motor que está en uso.'}</p><div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" style="background:#dc2626;border-color:#dc2626" data-motor-quitar-ok="${esc(p.id)}">${I('x')}Desconectar</button></div>`); }
});
document.getElementById('ov-x').addEventListener('click', e => {
  const g = e.target.closest('[data-motor-guardar]'), q = e.target.closest('[data-motor-quitar-ok]'); if (!g && !q) return;
  if (g) { const clave = ((document.getElementById('mt-clave') || {}).value || '').trim();
    if (!clave) { toast('Pega la clave de API'); return; }
    const p = MOTOR.estado.proveedores.find(x => x.id === g.dataset.motorGuardar); g.disabled = true; g.textContent = 'Probando la clave…';
    crmApi('POST', `/crm/motor-ia/${encodeURIComponent(g.dataset.motorGuardar)}`, {clave})
      .then(r => { MOTOR.estado = r; cerrarDialogo(); render(); toast(`${p ? p.n : 'El motor'} quedó conectado y en uso`); })
      .catch(err => { motorBotonConectar(g); toast(err.message); });
    return; }
  const id = q.dataset.motorQuitarOk; q.disabled = true;
  crmApi('DELETE', `/crm/motor-ia/${encodeURIComponent(id)}`)
    .then(r => { MOTOR.estado = r; cerrarDialogo(); render(); toast('Quedó desconectado'); })
    .catch(err => { q.disabled = false; toast(err.message); });
});

/* ── Chat rediseñado (28-sep, maqueta aprobada «CRM · chat rediseñado»): los mensajes seguidos de la misma persona
   van agrupados, con su avatar al lado; debajo del grupo, quién, la hora y el estado (o por qué no se entregó, con
   «Reintentar»). Notas internas en ámbar, agente IA en morado, eventos discretos y avisos en un recuadro. Las notas
   de voz traen su reproductor y la transcripción solo se saca al tocar «Ver transcripción». ── */
const CH_SVG_ALERTA = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><path d="M12 16.5h.01"/></svg>';
const CH_SVG_ROBOT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V5"/><circle cx="12" cy="4" r="1"/><path d="M9 14h.01"/><path d="M15 14h.01"/></svg>';
const CH_ESTADO = {enviando:['clock', 'Enviando'], enviado:['check', 'Enviado'], entregado:['check2', 'Entregado'], leido:['check2', 'Leído']};
const chDur = new Map();   // duración de cada nota de voz, para no esperar a reproducirla
const chFmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function chAvatarPersona(nombre){
  const u = USUARIOS.find(x => x.nombre === nombre);
  return `<span class="av ch-av" style="background:${colorPersona(nombre)}">${fotoAv(u && u.foto, nombre || '?')}</span>`;
}
function chAudio(url){
  if (!url) return `<span class="ch-sinaudio">${I('mic')}Nota de voz</span>`;
  const d = chDur.get(url);
  if (d == null && !chDur.has(url)) { chDur.set(url, null); const a = new Audio(); a.preload = 'metadata'; a.src = url;
    a.addEventListener('loadedmetadata', () => { if (isFinite(a.duration)) { chDur.set(url, a.duration); document.querySelectorAll(`.ch-audio[data-audio="${CSS.escape(url)}"] .dur`).forEach(e => { e.textContent = chFmt(a.duration); }); } }); }
  return `<div class="ch-audio" data-audio="${esc(url)}"><button type="button" class="pl" data-ch-play="1" aria-label="Reproducir nota de voz">${I('play')}</button><span class="wave"><i></i></span><span class="dur">${d ? chFmt(d) : '0:00'}</span></div>`;
}
let chSonando = null;
document.getElementById('msgs').addEventListener('click', e => {
  const b = e.target.closest('[data-ch-play]'); if (!b) return;
  const box = b.closest('.ch-audio'), url = box.dataset.audio;
  if (chSonando && chSonando.url === url) { if (chSonando.a.paused) chSonando.a.play(); else chSonando.a.pause(); return; }
  if (chSonando) chSonando.a.pause();
  const a = new Audio(url); chSonando = {url, a};
  const pintar = () => document.querySelectorAll(`.ch-audio[data-audio="${CSS.escape(url)}"]`).forEach(x => {
    const w = x.querySelector('.wave i'); if (w) w.style.width = a.duration ? `${Math.min(100, a.currentTime / a.duration * 100)}%` : '0';
    const t = x.querySelector('.dur'); if (t) t.textContent = chFmt(a.paused && !a.currentTime ? (a.duration || 0) : a.currentTime);
    const p = x.querySelector('[data-ch-play]'); if (p) { p.innerHTML = I(a.paused ? 'play' : 'pause'); p.setAttribute('aria-label', a.paused ? 'Reproducir nota de voz' : 'Pausar nota de voz'); }
  });
  ['timeupdate', 'play', 'pause', 'ended', 'loadedmetadata'].forEach(ev => a.addEventListener(ev, pintar));
  a.addEventListener('ended', () => { a.currentTime = 0; pintar(); });
  a.play().catch(() => toast('No se pudo reproducir la nota de voz'));
});
function chBloqueIn(c, m, ult){
  const x = m.in, u = ult ? ' ult' : '';
  if (typeof x !== 'object') return `<div class="ch-b in${u}">${m.asunto ? `<span class="ch-asunto">${I('mail')}${esc(m.asunto)}</span>` : ''}${esc(x)}</div>`;
  const cap = x.cap ? `<div class="ch-b in${u}">${esc(x.cap)}</div>` : '';
  if (x.img) return `<a class="ch-img${x.sticker ? ' stk' : ''}${u && !cap ? u : ''}" href="${esc(x.img)}" target="_blank" rel="noopener"><img src="${esc(x.img)}" alt="${x.sticker ? 'Sticker' : 'Imagen'}" loading="lazy"></a>${cap}`;
  if (x.video) return `<div class="ch-b in media${u && !cap ? u : ''}"><video controls preload="metadata" src="${esc(x.video)}"></video></div>${cap}`;
  if (x.doc) return `<a class="ch-file in${u && !cap ? u : ''}" href="${esc(x.doc)}" target="_blank" rel="noopener"><span class="ic">${I('file')}</span><span class="tx"><b>${esc(x.n || 'Documento')}</b><small>Abrir el archivo</small></span></a>${cap}`;
  const id = m._id || '', trans = typeof x.trans === 'string' && x.trans.trim();
  return `<div class="ch-b in ch-voz${u}">${chAudio(x.url)}${trans ? `<div class="ch-trans"><b>Transcripción:</b> ${esc(trans)}</div>` : x.url && id ? `<button type="button" class="ch-vertrans" data-ch-trans="${esc(id)}">${m._transc ? 'Transcribiendo…' : 'Ver transcripción'}</button>` : ''}</div>${cap}`;
}
const chTipoIn = m => { const x = m.in; if (typeof x !== 'object') return ''; return x.sticker ? 'Sticker · ' : x.img ? 'Imagen · ' : x.video ? 'Video · ' : x.doc ? 'Documento · ' : 'Nota de voz · '; };
function chBloqueOut(m, ult){
  const fallo = m._estado === 'fallido', u = ult ? ' ult' : '';
  let texto = String(m.out || ''); if (m.link && m.link.url && texto.endsWith(m.link.url)) texto = texto.slice(0, -m.link.url.length).trim();
  const plantilla = m.plantilla ? `<span class="ch-pl">Plantilla «${esc(m.plantilla)}»</span>` : '';
  if (m.file && !fallo) return `${texto || plantilla ? `<div class="ch-b out">${plantilla}${esc(texto)}</div>` : ''}<a class="ch-file out${u}"${m.file.url ? ` href="${esc(m.file.url)}" target="_blank" rel="noopener"` : ''}><span class="ic">${I(m.file.ic || 'file')}</span><span class="tx"><b>${esc(m.file.n)}</b><small>${esc(m.file.t || 'Abrir el archivo')}</small></span></a>`;
  const extra = m.audio ? chAudio(m.audio.url)
    : m.link ? `<div class="linkcard"${m.link.url ? ` data-url="${esc(m.link.url)}" title="Copiar el enlace"` : ''}><span class="lc">${I('link')}</span><span><b>${esc(m.link.p)}</b><span>${esc(m.link.m)} · ${esc(m.link.pr)} · enlace de ${esc(m.by || yo)}</span></span></div>`
    : m.file ? `<div class="ch-fnombre">${I(m.file.ic || 'file')}${esc(m.file.n)}</div>` : '';
  return `<div class="ch-b out${fallo ? ' fallo' : ''}${m.audio ? ' ch-voz' : ''}${u}">${plantilla}${esc(texto)}${extra}</div>`;
}
function chMetaOut(c, m, i){
  if (m._estado === 'fallido') {
    const e = String(m._error || 'No se pudo enviar'), ventana = /24 horas|131047|plantilla/i.test(e);
    const accion = ventana ? '<button type="button" class="ch-acc" data-ch-plantilla="1">Enviar con plantilla</button>'
      : !m.file && !m.audio && !m.link && typeof m.out === 'string' && m.out.trim() ? `<button type="button" class="ch-acc" data-ch-reintentar="${i}">Reintentar</button>` : '';
    return `<span class="ch-meta mal">${CH_SVG_ALERTA}<span>No se entregó: ${esc(e)}${accion ? ' · ' + accion : ''}</span></span>`;
  }
  const est = CH_ESTADO[m._estado] || (m._id ? CH_ESTADO.enviado : CH_ESTADO.enviando);
  return `<span class="ch-meta"><b>${esc(m.by || yo)}</b>· ${esc(m.h || '')} ·${m.rq ? `<span class="ch-rq">Respuesta rápida /${esc(m.rq)}</span>·` : ''}<span class="est${m._estado === 'leido' ? ' leido' : ''}">${I(est[0])}</span>${est[1]}</span>`;
}
function chSuelto(m){
  if (m.d) return `<div class="ch-dia">${esc(m.d)}</div>`;
  if (m.ev) {
    if (m.ev === 'clock' && /^Sin asignar/i.test(m.t || '')) { const [a, ...r] = String(m.t).split('. '); return `<div class="ch-aviso">${I('clock')}<span><b>${esc(a)}.</b> ${esc(r.join('. '))}</span></div>`; }
    // «Asignada a X…» y «X la tomó al responder» llevan la foto de X en vez del ícono (48-barra.js).
    return `<div class="ch-ev">${chFotoEvento(m) || I(m.ev)}<span>${esc(m.t)}</span></div>`;
  }
  if (m.note) return `<div class="ch-nota"><span class="cab">${I('lock')}Nota interna de ${esc(m.by || 'el equipo')} · solo la ve el equipo${m.h ? ' · ' + esc(m.h) : ''}</span><div class="tx">${esc(m.note)}</div></div>`;
  return burbuja(m);
}
function pintarChat(c){
  const ms = c.msgs, out = [];
  const lado = m => m.call || m.sugT || m.csat || m.prog || m.d || m.ev || m.note ? null : m.in != null ? 'in' : m.out != null ? 'out' : m.ia ? 'ia' : m.recepcion ? 'recepcion' : m.bot ? 'bot' : null;
  const quien = m => { const l = lado(m); return l === 'out' ? 'o:' + (m.by || yo) : l === 'ia' ? 'ia:' + (m.ag || m.agente || '') : l === 'bot' ? 'bot:' + (m.flujo || '') : l; };
  for (let i = 0; i < ms.length; ) {
    const m = ms[i], l = lado(m);
    if (!l) { out.push(chSuelto(m)); i++; continue; }
    const g = [i]; let j = i + 1;
    while (j < ms.length && lado(ms[j]) === l && quien(ms[j]) === quien(m) && ms[j]._estado !== 'fallido' && ms[j - 1]._estado !== 'fallido') { g.push(j); j++; }
    const ult = ms[g[g.length - 1]];
    if (l === 'in') {
      out.push(`<div class="ch-fila"><span class="av ch-av" style="background:${AVC[c.id % AVC.length]}">${esc(ini(c.n))}</span><div class="ch-col">${g.map((k, n) => chBloqueIn(c, ms[k], n === g.length - 1)).join('')}<span class="ch-meta"><b>${esc(c.n)}</b>· ${chTipoIn(ult)}${esc(ult.h || '')}</span></div></div>`);
    } else if (l === 'out') {
      out.push(`<div class="ch-fila yo"><div class="ch-col">${g.map((k, n) => chBloqueOut(ms[k], n === g.length - 1)).join('')}${chMetaOut(c, ult, g[g.length - 1])}</div>${chAvatarPersona(m.by || yo)}</div>`);
    } else {
      // Agente IA, recepcionista de noche o un flujo: a la derecha, en morado.
      const ag = l === 'ia' ? (AGENTES.find(x => x.id === m.ag) || (!m.ag && !m.agente && AGENTES.length === 1 ? AGENTES[0] : null)) : null;
      const nombre = l === 'ia' ? `${ag ? ag.nombre : m.agente || 'Agente'} · agente IA` : l === 'recepcion' ? 'Recepcionista · agente IA · fuera de horario' : `Flujo${m.flujo ? ' · ' + m.flujo : ''}`;
      const cuerpo = k => { const x = ms[k], txtM = l === 'ia' ? x.ia : l === 'recepcion' ? x.recepcion : x.bot, fallo = x._estado === 'fallido';
        const ops = l === 'bot' && Array.isArray(x.botones) ? x.botones.map(b => typeof b === 'string' ? b : b && b.t).filter(Boolean) : [];
        return `<div class="ch-b ia${fallo ? ' fallo' : ''}${k === g[g.length - 1] ? ' ult' : ''}">${esc(txtM)}${ops.length ? `<div class="ch-ops">${ops.map(o => `<span>${esc(o)}</span>`).join('')}</div>` : ''}</div>`; };
      const meta = ult._estado === 'fallido' ? `<span class="ch-meta mal">${CH_SVG_ALERTA}<span>No se entregó: ${esc(ult._error || 'No se pudo enviar')}</span></span>` : `<span class="ch-meta"><b class="ia">${esc(nombre)}</b>· ${esc(ult.h || '')}</span>`;
      out.push(`<div class="ch-fila yo"><div class="ch-col">${g.map(cuerpo).join('')}${meta}</div><span class="av ch-av ch-robot">${l === 'bot' ? I('flow') : CH_SVG_ROBOT}</span></div>`);
    }
    i = j;
  }
  return out.join('');
}
document.getElementById('msgs').addEventListener('click', e => {
  const c = CONV.find(x => x.id === st.sel); if (!c) return;
  const tr = e.target.closest('[data-ch-trans]');
  if (tr) { const m = c.msgs.find(x => x._id === tr.dataset.chTrans); if (!m || m._transc) return; m._transc = true; chat();
    crmApi('POST', `/crm/conversaciones/${c.id}/mensajes/${encodeURIComponent(m._id)}/transcripcion`)
      .then(r => { if (m.in && typeof m.in === 'object') m.in.trans = r.trans; })
      .catch(err => toast(err.message))
      .finally(() => { m._transc = false; if (st.sel === c.id) chat(); });
    return; }
  const re = e.target.closest('[data-ch-reintentar]');
  if (re) { const m = c.msgs[+re.dataset.chReintentar]; if (!m || m._estado !== 'fallido') return;
    const nuevo = {out:m.out, by:yo, h:'ahora'};
    const quitar = () => { c.msgs = c.msgs.filter(x => x !== m); };
    if (m._id) crmApi('DELETE', `/crm/conversaciones/${c.id}/mensajes/${encodeURIComponent(m._id)}`).catch(() => {});
    quitar(); c.msgs.push(nuevo); render(); toast('Reenviando…'); return; }
  if (e.target.closest('[data-ch-plantilla]')) { const b = document.getElementById('b-tpl'); if (b) b.click(); }
});
document.head.insertAdjacentHTML('beforeend', `<style>
#msgs.msgs{gap:16px;padding:22px 28px;background:#f7f8fa}
.ch-fila{display:flex;align-items:flex-end;gap:10px;max-width:100%}
.ch-fila.yo{justify-content:flex-end}
.ch-av{width:32px;height:32px;font-size:11px;flex:none;align-self:flex-end;margin-bottom:21px}
.ch-av img{width:100%;height:100%;border-radius:50%;object-fit:cover}
.ch-robot{background:#ede9fe;color:#6d4fc2}
.ch-robot svg{width:16px;height:16px}
.ch-col{display:flex;flex-direction:column;gap:3px;max-width:min(520px,78%);min-width:0}
.ch-fila.yo .ch-col{align-items:flex-end}
.ch-fila:not(.yo) .ch-col{align-items:flex-start}
.ch-b{padding:9px 14px;border-radius:16px;font-size:14px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;max-width:100%;box-sizing:border-box}
.ch-b.in{background:#fff;border:1px solid #e5e9f0;color:var(--ink);box-shadow:0 1px 1px rgba(15,23,42,.04)}
.ch-b.in.ult{border-bottom-left-radius:6px}
.ch-b.out{background:#1f93ff;color:#fff}
.ch-b.out.ult{border-bottom-right-radius:6px}
.ch-b.ia{background:#f5f3ff;border:1px solid #e4defc;color:var(--ink)}
.ch-b.ia.ult{border-bottom-right-radius:6px}
.ch-b.fallo,.ch-b.out.fallo{background:#fef2f2;border:1px solid #fecaca;color:#7f1d1d}
.ch-b.media{padding:6px}
.ch-b.media video{display:block;max-width:min(300px,100%);border-radius:10px}
.ch-asunto,.ch-pl{display:flex;align-items:center;gap:6px;font-size:11.5px;font-weight:500;opacity:.85;margin-bottom:3px}
.ch-asunto svg{width:13px;height:13px}
.ch-img{display:block;border-radius:16px;overflow:hidden;border:1px solid #e5e9f0;background:#dfe5ec;max-width:260px}
.ch-img.ult{border-bottom-left-radius:6px}
.ch-img img{display:block;max-width:260px;max-height:320px;object-fit:cover}
.ch-img.stk{background:transparent;border:0}
.ch-img.stk img{max-width:140px}
.ch-file{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:16px;text-decoration:none;min-width:260px;box-sizing:border-box}
.ch-file.out{background:#1f93ff;color:#fff}
.ch-file.out.ult{border-bottom-right-radius:6px}
.ch-file.in{background:#fff;border:1px solid #e5e9f0;color:var(--ink)}
.ch-file.in.ult{border-bottom-left-radius:6px}
.ch-file .ic{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;flex:none}
.ch-file.out .ic{background:rgba(255,255,255,.18)}
.ch-file.in .ic{background:#f1f5f9;color:#4b5563}
.ch-file .ic svg{width:18px;height:18px}
.ch-file .tx{display:flex;flex-direction:column;gap:1px;min-width:0}
.ch-file b{font-size:13.5px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ch-file small{font-size:12px;opacity:.85}
.ch-fnombre{display:flex;align-items:center;gap:6px;font-size:12.5px;margin-top:4px}
.ch-fnombre svg{width:14px;height:14px}
.ch-voz{display:flex;flex-direction:column;gap:8px;min-width:300px}
.ch-audio{display:flex;align-items:center;gap:10px}
.ch-audio .pl{width:34px;height:34px;border:0;border-radius:50%;background:#1f93ff;color:#fff;display:grid;place-items:center;cursor:pointer;flex:none}
.ch-b.out .ch-audio .pl{background:#fff;color:#1f93ff}
.ch-audio .pl svg{width:13px;height:13px;fill:currentColor;stroke:none}
.ch-audio .wave{position:relative;flex:1;height:24px;background:repeating-linear-gradient(90deg,#94a3b8 0 2px,transparent 2px 5px);border-radius:2px;opacity:.6;overflow:hidden}
.ch-b.out .ch-audio .wave{background:repeating-linear-gradient(90deg,#fff 0 2px,transparent 2px 5px);opacity:.75}
.ch-audio .wave i{position:absolute;inset:0 auto 0 0;width:0;background:rgba(31,147,255,.35)}
.ch-audio .dur{font-size:12px;color:#6b7280;min-width:30px;text-align:right}
.ch-b.out .ch-audio .dur{color:#fff;opacity:.85}
.ch-sinaudio{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:#6b7280}
.ch-sinaudio svg{width:14px;height:14px}
.ch-trans{font-size:12.5px;line-height:1.5;color:#4b5563;padding-top:8px;border-top:1px dashed #d1d9e2;white-space:normal}
.ch-trans b{font-weight:600;color:#374151}
.ch-vertrans{align-self:flex-start;border:0;background:none;padding:0;font:inherit;font-size:12.5px;font-weight:500;color:#1976d2;cursor:pointer}
.ch-meta{display:flex;align-items:center;flex-wrap:wrap;gap:6px;font-size:11.5px;color:#6b7280;padding:0 4px}
.ch-meta b{font-weight:500;color:#4b5563}
.ch-meta b.ia{color:#6d4fc2}
.ch-meta .ch-rq{color:var(--blue-ink)}
.ch-meta .est{display:inline-flex}
.ch-meta .est svg{width:15px;height:15px;stroke-width:2}
.ch-meta .est svg:has(use[href="#i-check2"]){width:18px;height:12px;stroke-width:1.5}
.ch-meta .est.leido{color:#1f93ff}
.ch-meta.mal{color:#b91c1c}
.ch-meta.mal{flex-wrap:nowrap;align-items:flex-start;max-width:440px}
.ch-fila.yo .ch-meta.mal{text-align:right}
.ch-meta.mal > span{min-width:0}
.ch-meta.mal > svg{width:14px;height:14px;flex:none;margin-top:1px}
.ch-acc{border:0;background:none;padding:0;font:inherit;font-size:11.5px;font-weight:500;color:#1976d2;cursor:pointer}
.ch-ops{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
.ch-ops span{border:1px solid #d9d1fb;border-radius:6px;padding:2px 8px;font-size:12px;color:#6d4fc2;background:#fff}
.ch-dia{display:flex;align-items:center;gap:12px;font-size:12px;font-weight:500;color:#6b7280}
.ch-dia::before,.ch-dia::after{content:"";flex:1;height:1px;background:#e5e9f0}
.ch-ev{align-self:center;display:flex;align-items:center;gap:8px;font-size:12.5px;color:#6b7280;text-align:center;max-width:90%}
.ch-ev svg{width:14px;height:14px;flex:none}
.ch-ev > span:last-child{min-width:0;overflow-wrap:anywhere}
.ch-aviso{align-self:center;display:flex;align-items:flex-start;gap:10px;max-width:560px;padding:10px 14px;border:1px solid #fde68a;border-radius:12px;background:#fffbeb;font-size:12.5px;line-height:1.5;color:#92400e}
.ch-aviso svg{width:16px;height:16px;flex:none;margin-top:1px}
.ch-aviso b{font-weight:600}
.ch-nota{display:flex;flex-direction:column;gap:6px;padding:12px 16px;border:1px solid #fde68a;border-radius:12px;background:#fffbeb}
.ch-nota .cab{display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#92400e}
.ch-nota .cab svg{width:14px;height:14px}
.ch-nota .tx{font-size:13.5px;line-height:1.5;color:var(--ink);white-space:pre-wrap;overflow-wrap:anywhere}
</style>`);
