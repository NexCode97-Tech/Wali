/* ── Ajustes → Plan y pagos (maqueta aprobada el 3-oct, «Plan y pagos» v7): el plan actual con su uso, los planes
   tal como salen en nexcode97.com/precios (los trae el servidor, una sola fuente), el historial de cobros de Creem y
   el recibo en PDF, que sale del datáfono imprimiendo. Pagar y cambiar de plan los hace el administrador; el pago es
   en la página de Creem y vuelve a /?ir=cfg-plan&pago=ok. ── */
document.head.insertAdjacentHTML('beforeend', `<style>
.pl{max-width:1080px}
.pl-ok{display:flex;align-items:center;gap:10px;margin:0 0 16px;padding:12px 16px;border-radius:12px;background:var(--green-soft);color:var(--green-ink);font-size:13.5px;font-weight:600}
.pl-ok svg{width:18px;height:18px;flex:none}
.pl-actual{background:#fff;border:1px solid var(--line);border-radius:18px;overflow:hidden}
.pl-cab{display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;padding:22px 24px}
.pl-id{display:flex;align-items:center;gap:16px;min-width:0;flex:1 1 380px}
.pl-id > div{min-width:0;max-width:600px}
.pl-sello{flex:none;width:52px;height:52px;border-radius:14px;background:#0b0b10;color:#FFF200;display:grid;place-items:center;font-size:24px;font-weight:800;letter-spacing:-.04em}
.pl-fila{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.pl-fila h3{margin:0;font-size:22px;font-weight:700;letter-spacing:-.02em;line-height:1.2;color:var(--ink)}
.pl-est{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;padding:3px 10px;border-radius:999px;background:var(--bg3);color:var(--ink2)}
.pl-est i{width:7px;height:7px;border-radius:50%;background:currentColor}
.pl-est.prueba,.pl-est.aviso{background:#fff4e0;color:#b45309}
.pl-est.activo{background:var(--green-soft);color:var(--green-ink)}
.pl-est.activo i{box-shadow:0 0 0 3px rgba(34,197,94,.2)}
.pl-est.vencido{background:var(--red-soft);color:var(--red-ink)}
.pl-id p{margin:4px 0 0;color:var(--ink2);font-size:13.5px}
.pl-id p b{color:var(--ink);font-weight:600}
.pl-acc{display:flex;gap:8px;flex-wrap:wrap;flex:none}
.pl-nota{font-size:12.5px;color:var(--ink3);max-width:260px}
.pl-medidas{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-top:1px solid var(--line);background:var(--bg2)}
.pl-medida{padding:16px 24px 18px;min-width:0}
.pl-medida + .pl-medida{border-left:1px solid var(--line)}
.pl-medida small{display:block;font-size:12px;font-weight:600;color:var(--ink3)}
.pl-medida b{display:block;margin-top:4px;font-size:20px;font-weight:700;letter-spacing:-.02em;line-height:1.25;color:var(--ink);font-variant-numeric:tabular-nums}
.pl-medida b span{font-size:13.5px;font-weight:600;color:var(--ink3);letter-spacing:0}
.pl-medida b.apagado{color:var(--ink3);font-size:16px}
.pl-barra{margin-top:10px;height:6px;border-radius:999px;background:var(--line);overflow:hidden}
.pl-barra span{display:block;height:100%;border-radius:999px;background:#0b0b10;transform-origin:left;animation:pl-llenar .9s cubic-bezier(.22,1,.36,1)}
.pl-barra.alerta span{background:#d97706}
@keyframes pl-llenar{from{transform:scaleX(0)}}
.pl-medida em{display:flex;align-items:center;gap:6px;margin-top:8px;font-style:normal;font-size:12.5px;color:var(--ink2)}
.pl-medida em.mal{color:var(--red-ink);font-weight:600}
.pl-sec{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin:30px 0 14px}
.pl-sec h3{margin:0;font-size:17px;font-weight:700;color:var(--ink)}
.pl-sec p{margin:3px 0 0;font-size:13px;color:var(--ink3)}
.pl-switch{display:inline-flex;align-items:center;gap:12px;padding:8px 14px;border:1px solid var(--line);border-radius:999px;background:#fff;font-size:14px;font-weight:600}
.pl-switch span{color:var(--ink3);transition:color .2s}
.pl-switch span.on{color:var(--ink)}
.pl-switch button{position:relative;width:46px;height:26px;border-radius:999px;background:var(--line);transition:background .25s}
.pl-switch button::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.25);transition:transform .3s cubic-bezier(.22,1,.36,1)}
.pl-switch button[aria-checked="true"]{background:#0b0b10}
.pl-switch button[aria-checked="true"]::after{transform:translateX(20px)}
.pl-switch em{font-style:normal;font-size:11.5px;font-weight:700;color:var(--green-ink);background:var(--green-soft);padding:2px 8px;border-radius:999px}
.pl-planes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.pl-plan{background:#fff;border:1px solid var(--line);border-radius:16px;padding:20px;display:flex;flex-direction:column;gap:12px;min-width:0}
.pl-plan.pl-sel{border-color:#0b0b10;box-shadow:0 0 0 1px #0b0b10}
.pl-tope{display:flex;align-items:center;justify-content:space-between;gap:8px}
.pl-tope h4{margin:0;font-size:17px;font-weight:700;color:var(--ink)}
.pl-chip{font-size:11.5px;font-weight:700;padding:2px 9px;border-radius:999px;background:#FFF200;color:#0b0b10}
.pl-chip.gris{background:var(--bg3);color:var(--ink2)}
.pl-precio{display:flex;align-items:baseline;gap:6px}
.pl-precio b{font-size:32px;font-weight:800;letter-spacing:-.03em;color:var(--ink);font-variant-numeric:tabular-nums}
.pl-precio span{color:var(--ink3);font-size:13px}
.pl-eq{margin:-6px 0 0;font-size:12.5px;color:var(--ink3);min-height:19px}
.pl-eq b{color:var(--green-ink);font-weight:600}
.pl-ficha{margin:0;border-top:1px solid var(--line);font-size:13px}
.pl-ficha div{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--line)}
.pl-ficha dt{color:var(--ink2)}
.pl-ficha dd{margin:0;font-weight:600;text-align:right;color:var(--ink)}
.pl-ficha dd.si{color:var(--green-ink)}
.pl-ficha dd.no{color:var(--ink3);font-weight:500}
.pl-base{margin:4px 0 -4px;font-size:12.5px;font-weight:700;color:var(--ink)}
.pl-plan ul{margin:0;padding:0;list-style:none;display:grid;gap:7px;font-size:13.5px;color:var(--ink2)}
.pl-plan li{display:flex;gap:8px}
.pl-plan li svg{flex:none;width:15px;height:15px;margin-top:3px;color:var(--ink)}
.pl-plan .btn{justify-content:center;margin-top:auto;height:40px}
.pl-plan .btn.amarillo{background:#FFF200;border-color:#FFF200;color:#0b0b10;font-weight:600}
.pl-plan .btn.amarillo:hover{background:#e6d900;border-color:#e6d900}
.pl-plan .btn:disabled{opacity:.55;cursor:default}
.pl-caja{background:#fff;border:1px solid var(--line);border-radius:16px;overflow:hidden}
.pl-caja-cab{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding:18px 20px;border-bottom:1px solid var(--line)}
.pl-caja-cab h3{margin:0;font-size:17px;font-weight:700;color:var(--ink)}
.pl-caja-cab p{margin:3px 0 0;font-size:13px;color:var(--ink3)}
.pl-tabla{width:100%;border-collapse:collapse;font-size:13.5px}
.pl-tabla th{text-align:left;font-size:12px;font-weight:600;color:var(--ink3);padding:10px 20px;background:var(--bg2);border-bottom:1px solid var(--line)}
.pl-tabla td{padding:13px 20px;border-bottom:1px solid var(--line2);color:var(--ink);font-variant-numeric:tabular-nums}
.pl-tabla tr:last-child td{border-bottom:0}
.pl-tabla .der{text-align:right}
.pl-tabla .gris{color:var(--ink2)}
.pl-pago{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;padding:2px 9px;border-radius:999px}
.pl-pago i{width:6px;height:6px;border-radius:50%;background:currentColor}
.pl-pago.pagado{background:var(--green-soft);color:var(--green-ink)}
.pl-pago.rechazado{background:var(--red-soft);color:var(--red-ink)}
.pl-pago.reembolsado{background:var(--bg3);color:var(--ink2)}
.pl-desc{display:inline-flex;align-items:center;gap:6px;font-weight:600;color:var(--ink);text-decoration:underline;text-underline-offset:3px}
.pl-desc svg{width:15px;height:15px}
.pl-vacio{margin:0;padding:34px 20px;text-align:center;color:var(--ink3);font-size:13.5px}
.pl-pie{display:flex;gap:10px;align-items:flex-start;margin-top:16px;padding:14px 18px;border:1px solid var(--line);border-radius:14px;background:#fff;font-size:13px;color:var(--ink2)}
.pl-pie svg{width:18px;height:18px;flex:none;color:var(--green-ink);margin-top:1px}
.pl-pie b{color:var(--ink)}
.pl-carga{padding:60px 16px;text-align:center;color:var(--ink3)}
@media (max-width:900px){.pl-planes{grid-template-columns:1fr}.pl-medidas{grid-template-columns:1fr}.pl-medida + .pl-medida{border-left:0;border-top:1px solid var(--line)}.pl-tabla .pl-opc{display:none}.pl-tabla th,.pl-tabla td{padding-left:12px;padding-right:12px}}
@media (prefers-reduced-motion:reduce){.pl-barra span{animation:none}}

/* Modal del datáfono: imprime el recibo y al terminar lo descarga. */
.pl-fondo{position:fixed;inset:0;z-index:200;background:rgba(11,11,16,.62);display:grid;place-items:center;padding:16px;animation:pl-aparecer .25s ease-out}
.pl-fondo[hidden]{display:none}
.pl-modal{position:relative;width:min(420px,100%);max-height:calc(100dvh - 32px);overflow-y:auto;background:#fff;border-radius:22px;padding:22px 24px 24px;box-shadow:0 30px 80px -20px rgba(0,0,0,.5);animation:pl-subir .35s cubic-bezier(.22,1,.36,1)}
@keyframes pl-aparecer{from{opacity:0}}
@keyframes pl-subir{from{transform:translateY(16px);opacity:0}}
.pl-cerrar{position:absolute;top:12px;right:12px;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;color:var(--ink2)}
.pl-cerrar:hover{background:var(--bg3)}
.pl-cerrar svg{width:18px;height:18px}
.pl-escena{display:flex;flex-direction:column;align-items:center;padding-top:8px}
.pl-salida{width:236px;padding-top:10px;overflow:hidden;display:flex;align-items:flex-end;justify-content:center;margin-bottom:-6px}
.pl-papel{position:relative;width:212px;background:#fff;color:#1d1d24;font-family:"Courier New",ui-monospace,monospace;font-size:11.5px;line-height:1.45;padding:16px 16px 18px;box-shadow:0 0 0 1px #ececf1,0 6px 18px rgba(0,0,0,.12);transform:translateY(100%)}
.pl-papel::before{content:"";position:absolute;left:0;right:0;top:-7px;height:8px;background:linear-gradient(135deg,transparent 5px,#fff 0) 0 0/10px 8px repeat-x,linear-gradient(225deg,transparent 5px,#fff 0) 0 0/10px 8px repeat-x}
.pl-imprime .pl-papel{animation:pl-imprimir 2.6s steps(26,end) forwards}
.pl-listo .pl-papel{transform:none}
@keyframes pl-imprimir{to{transform:translateY(0)}}
.pl-papel .c{text-align:center}
.pl-papel .logo{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:50%;background:#FFF200;font-family:Inter,sans-serif;font-weight:800;font-size:13px;margin-bottom:4px}
.pl-papel hr{border:0;border-top:1px dashed #b9bcc8;margin:8px 0}
.pl-papel .l{display:flex;justify-content:space-between;gap:8px}
.pl-papel .tot{font-size:13px;font-weight:700}
.pl-papel .sello{display:inline-block;margin-top:6px;border:1.5px solid #16a34a;color:#16a34a;font-weight:700;padding:1px 8px;border-radius:4px;transform:rotate(-4deg);font-family:Inter,sans-serif;font-size:11px;letter-spacing:.06em}
.pl-papel .sello.rojo{border-color:#b91c1c;color:#b91c1c}
.pl-pos{position:relative;width:236px;background:linear-gradient(#26262f,#15151b);border-radius:20px 20px 26px 26px;padding:16px 18px 18px;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 18px 30px -12px rgba(0,0,0,.45)}
.pl-imprime .pl-pos{animation:pl-vibrar .12s linear infinite}
@keyframes pl-vibrar{50%{transform:translateX(.6px)}}
.pl-ranura{height:8px;border-radius:999px;background:#07070a;box-shadow:inset 0 2px 3px rgba(0,0,0,.8);margin:-6px 6px 12px}
.pl-pantalla{height:54px;border-radius:10px;background:#0c1a10;box-shadow:inset 0 0 0 2px #0a0a0e;display:grid;place-items:center;color:#9cf7b0;font-family:"Courier New",ui-monospace,monospace;font-size:13px;font-weight:700;letter-spacing:.04em;text-shadow:0 0 8px rgba(156,247,176,.6)}
.pl-pantalla.error{color:#fca5a5;text-shadow:0 0 8px rgba(252,165,165,.6);background:#1f0c0c}
.pl-teclas{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:12px}
.pl-teclas i{height:16px;border-radius:6px;background:#2d2d38;box-shadow:inset 0 -2px 0 rgba(0,0,0,.35)}
.pl-teclas i:nth-last-child(3){background:#b42318}.pl-teclas i:nth-last-child(2){background:#c99a06}.pl-teclas i:nth-last-child(1){background:#15803d}
.pl-m-pie{text-align:center;margin-top:18px}
.pl-m-pie h4{margin:0;font-size:18px;font-weight:700;color:var(--ink)}
.pl-m-pie p{margin:4px 0 0;color:var(--ink2);font-size:13.5px}
.pl-descarga{margin:14px auto 0;height:6px;border-radius:999px;background:var(--bg3);overflow:hidden;max-width:260px}
.pl-descarga span{display:block;height:100%;width:0;background:#16a34a;border-radius:999px;transition:width .9s cubic-bezier(.22,1,.36,1)}
.pl-de-nuevo{margin-top:12px;font-weight:600;font-size:13px;color:var(--ink2);text-decoration:underline;text-underline-offset:3px}
.pl-confirmar{display:flex;gap:8px;justify-content:flex-end;margin-top:18px}
.pl-modal h4.t{margin:0 30px 6px 0;font-size:18px;font-weight:700;color:var(--ink)}
.pl-modal p.t{margin:0;color:var(--ink2);font-size:13.5px;line-height:1.55}
@media (prefers-reduced-motion:reduce){.pl-imprime .pl-papel{animation:none;transform:none}.pl-imprime .pl-pos{animation:none}}
</style>`);

let PLAN = null, planCargando = null;
st.plPeriodo = '';
const PL_NOMBRE = {starter:'Starter', growth:'Growth', business:'Business'};
// Si el sitio no respondió, la pantalla muestra al menos el nombre y el precio de cada plan.
const PL_RESPALDO = [
  {id:'starter', nombre:'Starter', mensual:99, anual:'950', ficha:[], incluye:[]},
  {id:'growth', nombre:'Growth', mensual:259, anual:'2.490', destacado:true, ficha:[], incluye:[]},
  {id:'business', nombre:'Business', mensual:459, anual:'4.390', ficha:[], incluye:[]},
];
// «4 oct 2026» o, larga, «4 de octubre de 2026», en la hora de Colombia (UTC-5, sin cambio de hora).
const PL_MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const plFecha = (iso, larga) => {
  if (!iso) return '';
  const b = new Date(new Date(iso).getTime() - 5 * 3600e3), d = b.getUTCDate(), m = PL_MESES[b.getUTCMonth()], y = b.getUTCFullYear();
  return larga ? `${d} de ${m} de ${y}` : `${d} ${m.slice(0, 3)} ${y}`;
};
const plDinero = (centavos, moneda = 'USD') => `${moneda} ${(centavos / 100).toLocaleString('es-CO', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
const plCatalogo = () => (PLAN && Array.isArray(PLAN.catalogo) && PLAN.catalogo.length ? PLAN.catalogo : PL_RESPALDO);
const plDe = id => plCatalogo().find(p => p.id === id) || PL_RESPALDO.find(p => p.id === id) || PL_RESPALDO[0];
const plPrecioTxt = (id, periodo) => { const p = plDe(id); return periodo === 'anual' ? `USD ${p.anual} al año` : `USD ${p.mensual} al mes`; };

function cargarPlan(){
  if (planCargando) return planCargando;
  planCargando = crmApi('GET', '/crm/plan').then(d => {
    PLAN = d; if (!st.plPeriodo) st.plPeriodo = d.periodo === 'anual' ? 'anual' : 'mensual';
    return d;
  }).finally(() => { planCargando = null; });
  return planCargando;
}

/* El plan, en palabras: el estado que se ve, el texto, las tres medidas y los botones.
   Medida: [etiqueta, valor, total, porcentaje, nota, tono de la nota, barra en alerta]. */
function planVista(P){
  const nombre = PL_NOMBRE[P.plan] || 'Starter';
  const cancelado = P.estado === 'cancelado', vencido = !P.vigente, noRenueva = cancelado || P.cancelaAlFinal;
  const uso = P.uso || {usuarios:0, agentesIA:0}, lim = P.limites || {};
  const mUsuarios = lim.usuarios ? ['Usuarios', String(uso.usuarios), `de ${lim.usuarios}`, Math.min(100, uso.usuarios / lim.usuarios * 100), null, '', uso.usuarios >= lim.usuarios] : ['Usuarios', String(uso.usuarios), null, null, 'Sin límite'];
  const mAgentes = lim.agentesIA === 0 ? ['Agentes de IA', 'No incluye', null, null, 'Desde Growth'] : lim.agentesIA ? ['Agentes de IA', String(uso.agentesIA), `de ${lim.agentesIA}`, Math.min(100, uso.agentesIA / lim.agentesIA * 100)] : ['Agentes de IA', String(uso.agentesIA), null, null, 'Sin límite'];
  if (P.estado === 'interno') return {sello:'N', nombre, chip:['', 'Interno'], texto:['Espacio de NexCode97: todo incluido y sin cobro.'],
    medidas:[['Usuarios', String(uso.usuarios), null, null, 'Sin límite'], ['Agentes de IA', String(uso.agentesIA), null, null, 'Sin límite'], ['Cobro', 'Sin cobro', null, null, 'Espacio interno']], acciones:[]};
  if (P.estado === 'prueba' && !vencido) {
    const dias = P.diasPrueba ?? 0;
    return {sello:'S', nombre:'Starter', chip:['prueba', 'Prueba gratis'], texto:['Tu prueba termina el ', [plFecha(P.pruebaHasta, true)], '. Elige un plan antes para no perder el acceso.'],
      medidas:[['Prueba gratis', `${dias} ${dias === 1 ? 'día' : 'días'}`, 'de 14', Math.max(0, 14 - dias) / 14 * 100, null, '', dias <= 3], mUsuarios, mAgentes], acciones:[['pri', 'Elegir plan', 'planes']]};
  }
  if (vencido) {
    const cuando = P.estado === 'prueba' ? P.pruebaHasta : P.renuevaEl, rechazo = P.estado === 'vencido';
    const texto = P.estado === 'prueba' ? ['Tu prueba gratis terminó. Elige un plan para seguir atendiendo; ', ['no se borró nada'], '.']
      : cancelado ? ['Tu plan se canceló. Elige un plan para volver a atender; ', ['no se borró nada'], '.']
      : ['El último cobro no se pudo hacer. Actualiza tu tarjeta para seguir atendiendo; ', ['no se borró nada'], '.'];
    return {sello:nombre[0], nombre, chip:['vencido', 'Vencido'], texto,
      medidas:[['Venció', plFecha(cuando) || '—', null, null, rechazo ? 'Cobro rechazado' : '', rechazo ? 'mal' : ''], mUsuarios, ['Conversaciones', 'Guardadas', null, null, 'Todo sigue ahí']],
      acciones:[...(P.portal && rechazo ? [['', 'Actualizar tarjeta', 'portal']] : []), ['pri', P.estado === 'prueba' ? 'Elegir plan' : `Renovar ${nombre}`, P.estado === 'prueba' ? 'planes' : 'renovar']]};
  }
  if (P.estado === 'pago-pendiente') return {sello:nombre[0], nombre, chip:['aviso', 'Pago pendiente'], texto:['No pudimos cobrar tu tarjeta. Creem lo vuelve a intentar en los próximos días; ', ['actualízala para no perder el acceso'], '.'],
    medidas:[mUsuarios, mAgentes, ['Próximo intento', plFecha(P.renuevaEl) || 'Pronto', null, null, plPrecioTxt(P.plan, P.periodo)]], acciones:[['pri', 'Actualizar tarjeta', 'portal']]};
  return {sello:nombre[0], nombre, chip: noRenueva ? ['aviso', 'No se renueva'] : ['activo', `Activo · ${P.periodo === 'anual' ? 'Anual' : 'Mensual'}`],
    texto: noRenueva ? ['Tu plan sigue activo hasta el ', [plFecha(P.renuevaEl, true)], ' y no se renueva.'] : [[plPrecioTxt(P.plan, P.periodo)], ' · se renueva solo, sin que hagas nada.'],
    medidas:[mUsuarios, mAgentes, [noRenueva ? 'Activo hasta' : 'Próximo cobro', plFecha(P.renuevaEl) || '—', null, null, noRenueva ? 'Sin más cobros' : plPrecioTxt(P.plan, P.periodo)]],
    acciones: noRenueva ? [['pri', `Renovar ${nombre}`, 'renovar']] : P.portal ? [['', 'Facturas y tarjeta', 'portal']] : []};
}

function plMedida([etq, valor, total, pct, nota, tono, alerta]){
  return `<div class="pl-medida"><small>${esc(etq)}</small><b class="${valor === 'No incluye' ? 'apagado' : ''}">${esc(valor)}${total ? ` <span>${esc(total)}</span>` : ''}</b>${
    pct != null ? `<div class="pl-barra${alerta ? ' alerta' : ''}" role="img" aria-label="${esc(`${etq}: ${valor}${total ? ' ' + total : ''}`)}"><span style="width:${Math.max(2, Math.round(pct))}%"></span></div>` : ''}${
    nota ? `<em class="${tono === 'mal' ? 'mal' : ''}">${esc(nota)}</em>` : ''}</div>`;
}

function plTarjeta(p, P){
  const anual = st.plPeriodo === 'anual', noRenueva = P.estado === 'cancelado' || P.cancelaAlFinal;
  const pagado = P.vigente && ['activo', 'pago-pendiente', 'cancelado'].includes(P.estado);
  const mio = pagado && !noRenueva && p.id === P.plan && (P.periodo || 'mensual') === st.plPeriodo;
  const actual = p.id === P.plan && P.estado !== 'prueba';
  const txt = mio ? 'Tu plan actual' : pagado && !noRenueva ? `Cambiar a ${p.nombre}` : actual ? `Renovar ${p.nombre}` : `Elegir ${p.nombre}`;
  const ficha = (p.ficha || []).length ? `<dl class="pl-ficha">${p.ficha.map(f => `<div><dt>${esc(f.k)}</dt><dd class="${f.tono === 'si' ? 'si' : f.tono === 'no' ? 'no' : ''}">${esc(f.v)}</dd></div>`).join('')}</dl>` : '';
  return `<article class="pl-plan${actual || (P.estado === 'prueba' && p.destacado) ? ' pl-sel' : ''}">
    <div class="pl-tope"><h4>${esc(p.nombre)}</h4>${actual ? '<span class="pl-chip gris">Tu plan</span>' : p.destacado ? '<span class="pl-chip">Más elegido</span>' : ''}</div>
    <div class="pl-precio"><b>USD ${esc(anual ? p.anual : String(p.mensual))}</b><span>${anual ? 'al año' : 'al mes'}</span></div>
    <p class="pl-eq">${anual && p.equivaleMes ? `Equivale a ${esc(p.equivaleMes)} al mes · <b>${esc(p.ahorro || '')}</b>` : ''}</p>
    ${ficha}${p.base ? `<p class="pl-base">${esc(p.base)}</p>` : ''}
    ${(p.incluye || []).length ? `<ul>${p.incluye.map(x => `<li>${I('check')}${esc(x)}</li>`).join('')}</ul>` : ''}
    <button type="button" class="btn${p.destacado && !mio ? ' amarillo' : ''}" data-pl-pagar="${esc(p.id)}" ${mio || !P.administra ? 'disabled' : ''} ${!P.administra ? 'title="Solo el administrador puede cambiar el plan"' : ''}>${txt}</button>
  </article>`;
}

function plHistorial(P){
  const H = P.historial || [];
  if (!H.length) return '<p class="pl-vacio">Todavía no tienes pagos. Cuando elijas un plan, cada cobro aparecerá aquí con su recibo.</p>';
  return `<table class="pl-tabla"><thead><tr><th>Fecha</th><th>Plan</th><th class="pl-opc">Periodo</th><th class="der">Monto</th><th>Estado</th><th>Recibo</th></tr></thead><tbody>${H.map(h => `<tr>
    <td>${esc(plFecha(h.fecha))}</td>
    <td>${esc(PL_NOMBRE[h.plan] || h.plan)} · ${h.periodo === 'anual' ? 'anual' : 'mensual'}</td>
    <td class="pl-opc gris">${h.desde && h.hasta ? `${esc(plFecha(h.desde))} – ${esc(plFecha(h.hasta))}` : h.estado === 'rechazado' ? 'Cobro rechazado' : '—'}</td>
    <td class="der">${esc(plDinero(h.total, h.moneda))}</td>
    <td><span class="pl-pago ${esc(h.estado)}"><i></i>${esc({pagado:'Pagado', rechazado:'Rechazado', reembolsado:'Reembolsado'}[h.estado] || h.estado)}</span></td>
    <td>${h.estado === 'rechazado' || !P.administra ? '<span class="gris">—</span>' : `<button type="button" class="pl-desc" data-pl-recibo="${+h.numero}">${I('download')}Descargar</button>`}</td></tr>`).join('')}</tbody></table>`;
}

function paginaPlan(){
  const volver = `<button type="button" class="volver" data-ir="ajustes-crm">${I('back')}Ajustes del CRM</button>`;
  const cab = `${volver}<h2>Plan y pagos</h2><p class="sub">Tu plan del CRM, tus pagos y tus recibos.</p>`;
  if (!PLAN) {
    cargarPlan().then(() => { if (st.pagina === 'cfg-plan') render(); }, err => { if (st.pagina === 'cfg-plan') { st.plError = err.message; render(); } });
    return `<div class="ajw ancho pl">${cab}<div class="pl-carga">${st.plError ? `${esc(st.plError)}<br><br><button type="button" class="btn" data-pl-reintentar="1">Intentar de nuevo</button>` : 'Cargando tu plan…'}</div></div>`;
  }
  const P = PLAN, v = planVista(P);
  const ok = st.pagoOk ? `<div class="pl-ok" role="status">${I('check')}${P.estado === 'activo' ? `¡Pago recibido! Tu plan ${esc(PL_NOMBRE[P.plan] || '')} quedó activo.` : 'Pago recibido. Estamos activando tu plan, tarda unos segundos…'}</div>` : '';
  const acciones = P.administra ? v.acciones.map(([c, t, a]) => `<button type="button" class="btn ${c}" data-pl-acc="${a}">${a === 'portal' ? I('link') : ''}${esc(t)}</button>`).join('')
    : v.acciones.length ? '<span class="pl-nota">Solo el administrador del espacio puede pagar o cambiar el plan.</span>' : '';
  const cambia = P.vigente && P.estado !== 'prueba';
  const planes = P.estado === 'interno' ? '' : `
    <div class="pl-sec" id="pl-planes"><div><h3>${cambia ? 'Cambia de plan cuando quieras' : 'Elige tu plan'}</h3><p>${cambia ? 'Si subes de plan pagas solo la diferencia del periodo.' : 'Pagas con tarjeta, Apple Pay, Google Pay o PayPal. Cancelas cuando quieras.'}</p></div>
      <div class="pl-switch"><span class="${st.plPeriodo === 'anual' ? '' : 'on'}">Mensual</span><button type="button" role="switch" aria-checked="${st.plPeriodo === 'anual'}" aria-label="Pagar anual" data-pl-periodo="1"></button><span class="${st.plPeriodo === 'anual' ? 'on' : ''}">Anual</span><em>−20 %</em></div></div>
    <div class="pl-planes">${plCatalogo().map(p => plTarjeta(p, P)).join('')}</div>`;
  return `<div class="ajw ancho pl">${cab}${ok}
    <section class="pl-actual" aria-label="Plan actual">
      <div class="pl-cab"><div class="pl-id"><div class="pl-sello" aria-hidden="true">${esc(v.sello)}</div><div>
        <div class="pl-fila"><h3>${esc(v.nombre)}</h3><span class="pl-est ${v.chip[0]}"><i></i>${esc(v.chip[1])}</span></div>
        <p>${v.texto.map(x => Array.isArray(x) ? `<b>${esc(x[0])}</b>` : esc(x)).join('')}</p></div></div>
        <div class="pl-acc">${acciones}</div></div>
      <div class="pl-medidas">${v.medidas.map(plMedida).join('')}</div>
    </section>
    ${planes}
    <div class="pl-sec"></div>
    <section class="pl-caja"><div class="pl-caja-cab"><div><h3>Historial de pagos</h3><p>Cada cobro del CRM con su recibo. Los impuestos aparecen según tu país.</p></div>${P.portal && P.administra ? `<button type="button" class="btn" data-pl-acc="portal">${I('link')}Facturas en el portal</button>` : ''}</div>${plHistorial(P)}</section>
    <div class="pl-pie">${I('chat')}<span><b>WhatsApp y la IA se pagan aparte, directo a cada proveedor.</b> Meta te cobra los mensajes de WhatsApp en tu propia cuenta y la IA se cobra en tu cuenta del proveedor, sin recargo de NexCode97.</span></div>
  </div>`;
}

const paginaCfgPl = paginaCfg;
paginaCfg = function(k){ return k === 'plan' ? paginaPlan() : paginaCfgPl(k); };

/* ── Pagar, cambiar de plan y el portal de Creem ── */
async function plPagar(id){
  const P = PLAN, periodo = st.plPeriodo, nombre = PL_NOMBRE[id];
  const cambio = P.vigente && ['activo', 'pago-pendiente'].includes(P.estado) && !P.cancelaAlFinal;
  if (cambio && !(await plConfirmar(`Cambiar a ${nombre}`, `Tu plan pasa a ${nombre} ${periodo} (${plPrecioTxt(id, periodo)}). Se cobra o se abona solo la diferencia del periodo que va corriendo, en la tarjeta que ya tienes.`, `Cambiar a ${nombre}`))) return;
  try {
    toast(cambio ? 'Cambiando tu plan…' : 'Abriendo el pago seguro…');
    const r = await crmApi('POST', '/crm/plan/pagar', {plan:id, periodo});
    if (r && r.url) { window.top.location.href = r.url; return; }
    toast(`Listo: tu plan pasa a ${nombre}`); st.pagoOk = true; plEsperarActivo(id);
  } catch (err) { toast(err.message); }
}
async function plPortal(){
  // La pestaña se abre antes de la llamada: si se abre después, el navegador la bloquea.
  const w = window.open('', '_blank');
  try { const r = await crmApi('POST', '/crm/plan/portal'); if (w) { w.opener = null; w.location.href = r.url; } else window.top.location.href = r.url; }
  catch (err) { if (w) w.close(); toast(err.message); }
}
// Después de pagar, Creem avisa al servidor en unos segundos: se vuelve a preguntar hasta ver el plan activo.
function plEsperarActivo(esperado, intento = 0){
  cargarPlan().then(P => {
    plAvisarMarco();
    if (st.pagina === 'cfg-plan') render();
    const listo = P.estado === 'activo' && (!esperado || P.plan === esperado);
    if (!listo && intento < 12) setTimeout(() => plEsperarActivo(esperado, intento + 1), 3000);
  }, () => {});
}
// El aviso de arriba (prueba o plan vencido) lo pinta el marco, fuera del CRM.
function plAvisarMarco(){ try { if (window.parent !== window && window.parent.CRM_MARCO && window.parent.CRM_MARCO.plan) window.parent.CRM_MARCO.plan(); } catch { /* sin marco */ } }

/* ── Modal: confirmar y el datáfono ── */
const plModal = (() => { const d = document.createElement('div'); d.className = 'pl-fondo'; d.hidden = true; document.body.appendChild(d); return d; })();
let plFoco = null, plT1 = 0, plT2 = 0, plResolver = null;
function plAbrir(html, foco){
  plFoco = document.activeElement;
  plModal.replaceChildren();
  plModal.insertAdjacentHTML('beforeend', `<div class="pl-modal" role="dialog" aria-modal="true" aria-labelledby="pl-m-t"><button type="button" class="pl-cerrar" data-pl-cerrar="1" aria-label="Cerrar">${I('x')}</button>${html}</div>`);
  plModal.hidden = false; (plModal.querySelector(foco) || plModal.querySelector('.pl-cerrar')).focus();
}
function plCerrar(){
  clearTimeout(plT1); clearTimeout(plT2); plModal.hidden = true; plModal.replaceChildren();
  if (plResolver) { plResolver(false); plResolver = null; }
  if (plFoco && plFoco.focus) plFoco.focus();
}
function plConfirmar(titulo, texto, boton){
  return new Promise(res => {
    plAbrir(`<h4 class="t" id="pl-m-t">${esc(titulo)}</h4><p class="t">${esc(texto)}</p><div class="pl-confirmar"><button type="button" class="btn" data-pl-cerrar="1">Cancelar</button><button type="button" class="btn pri" data-pl-si="1">${esc(boton)}</button></div>`, '[data-pl-si]');
    plResolver = res;
  });
}

async function plRecibo(numero){
  const h = (PLAN.historial || []).find(x => x.numero === numero); if (!h) return;
  const linea = (a, b, c) => `<div class="l${c ? ' ' + c : ''}"><span>${esc(a)}</span><span>${esc(b)}</span></div>`;
  plAbrir(`<div class="pl-escena pl-imprime" id="pl-escena">
      <div class="pl-salida"><div class="pl-papel" id="pl-papel">
        <div class="c"><span class="logo">N</span><div>NEXCODE97 CRM</div><div>nexcode97.com</div></div><hr>
        ${linea('Recibo', 'NX-' + h.numero)}${linea('Fecha', plFecha(h.fecha))}<hr>
        <div>${esc(PL_NOMBRE[h.plan] || h.plan)} · ${h.periodo === 'anual' ? 'anual' : 'mensual'}</div>${h.desde && h.hasta ? `<div>${esc(plFecha(h.desde))} – ${esc(plFecha(h.hasta))}</div>` : ''}<hr>
        ${linea('Subtotal', plDinero(h.subtotal, h.moneda))}${linea('Impuestos', plDinero(h.impuestos, h.moneda))}${linea('TOTAL', plDinero(h.total, h.moneda), 'tot')}<hr>
        <div class="c"><span class="sello${h.estado === 'reembolsado' ? ' rojo' : ''}">${h.estado === 'reembolsado' ? 'REEMBOLSADO' : 'PAGADO'}</span></div><div class="c">¡Gracias por tu pago!</div>
      </div></div>
      <div class="pl-pos" aria-hidden="true"><div class="pl-ranura"></div><div class="pl-pantalla" id="pl-pos-txt">IMPRIMIENDO</div><div class="pl-teclas">${'<i></i>'.repeat(12)}</div></div>
    </div>
    <div class="pl-m-pie" aria-live="polite"><h4 id="pl-m-t">Imprimiendo tu recibo</h4><p id="pl-m-txt">Un momento, lo estamos preparando.</p>
      <div class="pl-descarga" id="pl-barra" hidden><span></span></div><button type="button" class="pl-de-nuevo" id="pl-otra" data-pl-otra="${+h.numero}" hidden>Descargar de nuevo</button></div>`);
  // La ranura mide lo que mide el recibo (ya visible): así sale completo, con el corte dentado incluido.
  const papel = document.getElementById('pl-papel'); papel.parentNode.style.height = (papel.offsetHeight + 10) + 'px';
  const pdf = plTraerRecibo(numero); pdf.catch(() => {});
  await new Promise(r => { plT1 = setTimeout(r, matchMedia('(prefers-reduced-motion: reduce)').matches ? 300 : 2800); });
  if (plModal.hidden) return;
  const escena = document.getElementById('pl-escena'); escena.classList.remove('pl-imprime'); escena.classList.add('pl-listo');
  plBajar(pdf);
}
function plTraerRecibo(numero){
  return crmFetch('GET', `/crm/plan/recibo/${numero}`).then(async r => {
    if (!r.ok) await crmLeer(r);
    const nombre = ((r.headers.get('Content-Disposition') || '').match(/filename="?([^";]+)"?/) || [])[1] || `Recibo-NX-${numero}.pdf`;
    return {nombre, blob: await r.blob()};
  });
}
async function plBajar(pdf){
  const el = id => document.getElementById(id), barra = el('pl-barra'), sp = barra.querySelector('span');
  barra.hidden = false; sp.style.width = '0'; void sp.offsetWidth; sp.style.width = '100%';
  el('pl-m-t').textContent = 'Descargando tu recibo'; el('pl-m-txt').textContent = 'Preparando el PDF…';
  try {
    const [{nombre, blob}] = await Promise.all([pdf, new Promise(r => { plT2 = setTimeout(r, 900); })]);
    if (plModal.hidden) return;
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
    el('pl-pos-txt').textContent = 'LISTO'; el('pl-m-t').textContent = 'Recibo descargado';
    el('pl-m-txt').textContent = `Se guardó ${nombre} en tus descargas.`; el('pl-otra').textContent = 'Descargar de nuevo'; el('pl-otra').hidden = false;
  } catch (err) {
    if (plModal.hidden) return;
    barra.hidden = true; el('pl-pos-txt').textContent = 'ERROR'; el('pl-pos-txt').classList.add('error');
    el('pl-m-t').textContent = 'No se pudo descargar'; el('pl-m-txt').textContent = err.message; el('pl-otra').textContent = 'Intentar de nuevo'; el('pl-otra').hidden = false;
  }
}

plModal.addEventListener('click', e => {
  if (e.target === plModal || e.target.closest('[data-pl-cerrar]')) { plCerrar(); return; }
  if (e.target.closest('[data-pl-si]')) { const r = plResolver; plResolver = null; plCerrar(); if (r) r(true); return; }
  const o = e.target.closest('[data-pl-otra]');
  if (o) { o.hidden = true; const t = document.getElementById('pl-pos-txt'); t.classList.remove('error'); t.textContent = 'IMPRIMIENDO'; plBajar(plTraerRecibo(+o.dataset.plOtra)); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !plModal.hidden) plCerrar(); });

document.getElementById('page').addEventListener('click', e => {
  if (st.pagina !== 'cfg-plan') return;
  const t = e.target;
  if (t.closest('[data-pl-reintentar]')) { st.plError = ''; render(); return; }
  if (t.closest('[data-pl-periodo]')) { st.plPeriodo = st.plPeriodo === 'anual' ? 'mensual' : 'anual'; render(); return; }
  const pg = t.closest('[data-pl-pagar]'); if (pg && !pg.disabled) { plPagar(pg.dataset.plPagar); return; }
  const rc = t.closest('[data-pl-recibo]'); if (rc) { plRecibo(+rc.dataset.plRecibo); return; }
  const ac = t.closest('[data-pl-acc]'); if (!ac) return;
  const a = ac.dataset.plAcc;
  if (a === 'portal') plPortal();
  else if (a === 'renovar') plPagar(PLAN.plan);
  else if (a === 'planes') { const s = document.getElementById('pl-planes'); if (s) s.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'start'}); }
});

// Al entrar a la página se trae el plan fresco (el uso y los cobros cambian); al volver de pagar, se espera a Creem.
const renderPl = render;
let plAntes = '';
render = function(){
  const entra = st.pagina === 'cfg-plan' && plAntes !== 'cfg-plan';
  plAntes = st.pagina;
  if (entra && PLAN && !st.pagoOk) cargarPlan().then(() => { if (st.pagina === 'cfg-plan') render(); }, () => {});
  if (st.pagina !== 'cfg-plan') st.pagoOk = false;
  renderPl();
};
// Al cargar: si vuelve de pagar, se espera a Creem; si eligió un plan en nexcode97.com/precios (lo guardan
// entrar.html o abrirDesdeAviso en la pestaña), se abre Plan y pagos y se lleva al pago de ese plan, una sola vez.
crmListo.then(() => {
  let pend = null;
  try { pend = JSON.parse(sessionStorage.getItem('crm-pagar') || 'null'); sessionStorage.removeItem('crm-pagar'); } catch { /* sin almacenamiento */ }
  if (st.pagoOk) { plEsperarActivo(''); return; }
  if (!pend || !PL_NOMBRE[pend.plan]) return;
  const periodo = pend.periodo === 'anual' ? 'anual' : 'mensual', nombre = PL_NOMBRE[pend.plan];
  st.pagina = 'cfg-plan'; st.sel = null; st.plPeriodo = periodo; render();
  cargarPlan().then(P => {
    st.plPeriodo = periodo; if (st.pagina === 'cfg-plan') render();
    if (P.estado === 'interno') { toast('Tu espacio es interno: no necesita plan'); return; }
    if (!P.administra) { toast('Solo el administrador del espacio puede pagar el plan'); return; }
    if (P.vigente && ['activo', 'pago-pendiente'].includes(P.estado) && !P.cancelaAlFinal && P.plan === pend.plan && P.periodo === periodo) { toast(`Ya tienes el plan ${nombre}`); return; }
    plPagar(pend.plan);
  }, err => toast(err.message));
});
