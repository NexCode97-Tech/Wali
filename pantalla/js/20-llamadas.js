
/* ── Llamadas por WhatsApp (25-sep): conectar la línea desde el CRM, activar llamadas por línea, recibir y hacer llamadas.
   Reglas de Meta que se respetan aquí: la línea debe estar en la API oficial, la cuenta con límite de 2.000 y método de pago;
   para llamar al cliente hace falta su permiso (1 solicitud al día y 2 por semana, dura 7 días; 4 llamadas seguidas sin
   contestar lo quitan); las entrantes se contestan en menos de 30 segundos o van al buzón. Meta graba y transcribe si se pide
   en cada llamada, con un aviso hablado del propósito; el CRM guarda la copia porque Meta la borra a los 7 días.
   26-sep: conectar una línea es real (GET /crm/lineas/disponibles y POST /crm/lineas). Las llamadas no
   se activan en esta etapa: una línea solo llama cuando el API la marca con `llamadas: true` (Meta las activó y el CRM tiene
   con qué llamar). Mientras tanto el botón de llamar dice el motivo real. ── */
document.head.insertAdjacentHTML('beforeend', `<style>
.ll-sec{display:grid;gap:10px;border-top:1px solid var(--line2);padding-top:12px}
.ll-sec > .row2 > span > b{font-size:13px;font-weight:600}
.ll-req{display:grid;gap:8px}
.ll-ok{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;color:var(--green-ink)}
.ll-ok svg{width:14px;height:14px}
.ll-no{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;color:var(--red-ink)}
.ll-med{font-size:11.5px;font-weight:600;color:var(--amber-ink);background:var(--amber-soft);border-radius:6px;padding:2px 8px}
.ll-baja{font-size:11.5px;font-weight:600;color:var(--red-ink);background:var(--red-soft);border-radius:6px;padding:2px 8px}
.ll-nota{font-size:12px;color:var(--amber-ink);background:var(--amber-soft);border:1px solid var(--amber-line);border-radius:9px;padding:8px 10px}
.cx-list{display:grid;gap:8px;margin:4px 0 10px}
.cx-op{display:flex;align-items:center;gap:10px;width:100%;text-align:left;border:1px solid var(--line);border-radius:10px;padding:10px 12px;background:#fff}
.cx-op[aria-checked="true"]{border-color:#0b0b10;background:#fffde6}
.cx-op:disabled{opacity:.55;cursor:default}
.cx-op .rd{width:16px;height:16px;border-radius:50%;border:2px solid var(--ink4);flex:none}
.cx-op[aria-checked="true"] .rd{border-color:#0b0b10;box-shadow:inset 0 0 0 3px #fff;background:#0b0b10}
.cx-op b{display:block;font-size:14px;font-weight:400;color:var(--ink)}
.cx-lnk{align-self:flex-start;justify-self:start;text-align:left;border:0;background:none;padding:0;color:var(--blue-ink);font:inherit;font-size:13px;font-weight:500;cursor:pointer}
.cx-otra{display:grid;gap:10px;padding:14px;border:1px solid var(--line2);border-radius:12px;background:var(--bg2)}
.cx-op small{font-size:12px;color:var(--ink3)}
.cx-f{display:grid;gap:10px;margin:6px 0 12px}
.cx-f label{display:grid;gap:5px;font-size:12.5px;font-weight:600;color:var(--ink2)}
.cx-f input{border:1px solid var(--line);border-radius:9px;padding:8px 10px;font:inherit;font-size:13px;font-weight:400}
.cx-f small{font-weight:400;color:var(--ink3);font-size:12px}
.cx-falta{margin:-4px 0 12px;padding:9px 12px;border-radius:10px;background:#fffbeb;border:1px solid #fde68a;color:#92400e;font-size:12.5px;line-height:1.45}
.cx-prog{display:grid;gap:8px;margin:8px 0 12px;font-size:13px}
.cx-prog div{display:flex;align-items:center;gap:8px;color:var(--ink3)}
.cx-prog div.ok{color:var(--ink)}
.cx-prog div.mal{color:var(--red-ink)}
.cx-prog div svg{width:16px;height:16px}
.cx-prog div.ok svg{color:var(--green-ink)}
.cx-pasos{display:flex;gap:6px;font-size:12px;color:var(--ink3);margin-bottom:8px}
.cx-pasos span.on{color:var(--blue-ink);font-weight:600}
.cx-op.cx-grande{align-items:flex-start;padding:14px}
.cx-op.cx-grande > svg{width:22px;height:22px;flex:none;color:var(--blue-ink);margin-top:1px}
.cx-dato{display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:9px;padding:6px 6px 6px 10px;margin:6px 0;font-size:12.5px}
.cx-dato span{color:var(--ink3);flex:none}
.cx-dato code{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}
.cx-dato .btn.ic{width:28px;height:28px;padding:0}
.cx-ayuda{font-size:12.5px;color:var(--ink2);margin:0 0 10px}
.cx-ayuda summary{cursor:pointer;color:var(--blue-ink);font-weight:600}
.cx-ayuda ol{margin:8px 0 0;padding-left:18px;display:grid;gap:4px}
.cx-fila{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:4px}
.cx-fila b{font-size:14px;font-weight:600}
.cx-acc{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-top:10px}
.cx-acc > span:first-child{margin-right:auto}
.callrec{align-self:center;width:min(440px,100%);border:1px solid var(--line);border-radius:12px;background:#fff;padding:12px 14px;font-size:13px;display:grid;gap:8px}
.callrec .t{display:flex;align-items:center;gap:7px;font-weight:600}
.callrec .t svg{width:15px;height:15px;color:var(--green-ink)}
.callrec.perdida .t svg{color:var(--red-ink)}
.callrec .r{display:flex;justify-content:space-between;gap:10px;color:var(--ink2)}
.callrec .r span:last-child{color:var(--ink);font-variant-numeric:tabular-nums;text-align:right}
.callrec .wave{position:relative;overflow:hidden}
.callrec .wave i{position:absolute;inset:0 auto 0 0;width:0;background:rgba(31,147,255,.25);transition:width .25s linear}
.callrec .pl{cursor:pointer}
.callrec details summary{cursor:pointer;color:var(--blue-ink);font-size:12.5px;font-weight:500}
.callrec details p{margin:6px 0 0;font-size:12.5px;color:var(--ink2);line-height:1.5}
.callrec details p b{font-weight:600;color:var(--ink)}
.callrec .ft{font-size:11px;color:var(--ink4);text-align:right}
</style>`);

// Ajustes de llamadas (clave `llam`). `lineas` tiene los de cada línea: {on, icono, eq, buzon, grabar, desde}.
const LLAM = {
  lineas: {},
  saludo:'Hola, gracias por llamar. En este momento no podemos contestar. Déjanos tu mensaje y te devolvemos la llamada.',
  proposito:'mejorar la atención y dejar constancia de lo que acordemos',
};
const mmss = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
const lineaDe = id => LINEAS.find(l => l.id === id) || {id, n: id ? 'Línea desconectada' : 'Sin línea', tel: ''};
// Límite de mensajería según Meta (TIER_250, TIER_2K, TIER_UNLIMITED o un número) en número; null si Meta no lo dio.
function limiteNum(v){
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).toUpperCase();
  if (/UNLIMITED|ILIMITADO/.test(s)) return Infinity;
  const m = s.match(/(\d+(?:[.,]\d+)?)\s*([KM])?/); if (!m) return null;
  return parseFloat(m[1].replace(',', '.')) * (m[2] === 'M' ? 1e6 : m[2] === 'K' ? 1e3 : 1);
}
const fmtLimite = n => n === Infinity ? 'Sin límite' : n.toLocaleString('es-CO');
const CALIDAD_META = {GREEN:['Alta', 'ok2'], HIGH:['Alta', 'ok2'], YELLOW:['Media', 'll-med'], MEDIUM:['Media', 'll-med'], RED:['Baja', 'll-baja'], LOW:['Baja', 'll-baja']};
const calidadHTML = v => { const c = CALIDAD_META[String(v || '').toUpperCase()]; return c ? `<span class="${c[1]}">${c[0]}</span>` : '<span class="muted">Sin dato de Meta</span>'; };
const ESTADO_LINEA = {conectada:['Conectada', 'ok2'], error:['Con error', 'll-baja'], desconectada:['Desconectada', 'll-baja']};
const estadoLineaHTML = l => { const e = ESTADO_LINEA[l.estado] || [l.estado || 'Sin estado', 'pill']; return `<span class="${e[1]}" style="margin-left:auto">${esc(e[0])}</span>`; };
// Meta activó las llamadas en la línea y el CRM tiene con qué llamar: lo dice el API en la línea. En esta etapa no pasa.
const metaLlamadas = l => !!(l && l.llamadas === true);
const llamadasActivas = id => metaLlamadas(LINEAS.find(l => l.id === id)) && !!(LLAM.lineas[id] || {}).on;
// Cada línea tiene su fila en CFG.lineas (mensajes) y en LLAM.lineas (llamadas); si falta, se crea con los valores de siempre.
function ajLinea(id, eq = 'Ventas'){
  if (!CFG.lineas.some(x => x.id === id)) CFG.lineas.push({id, eq, recepcion:false});
  if (!LLAM.lineas[id]) LLAM.lineas[id] = {on:false, icono:true, eq, buzon:true, grabar:true};
}
const horaCfg = s => { const m = String(s || '').match(/^(\d{1,2}):(\d{2})$/); return m ? fmtMin(+m[1] * 60 + +m[2]) : String(s || ''); };

/* ── Líneas de WhatsApp (maqueta aprobada el 5-oct, «Líneas de WhatsApp» v7): resumen de tres datos, las líneas en
   grilla de 2 (filas de ícono, título, explicación y control), las cuentas de Meta conectadas, grabaciones y el botón
   «Conectar con Facebook» de la plataforma. El agente IA de noche se maneja en Atención de noche, no aquí. ── */
document.head.insertAdjacentHTML('beforeend', `<style>
.ln{display:grid;gap:22px}
.ln-cab{display:flex;align-items:flex-end;gap:16px;flex-wrap:wrap}
.ln-cab > div{flex:1 1 420px;min-width:0}
.ln-cab h2{margin:0}
.ln-cab .sub{margin:4px 0 0}
.ln-conectar{height:38px;padding:0 16px;border-radius:10px;background:#FFF200;color:#0b0b10;font-weight:600;font-size:13.5px;display:inline-flex;align-items:center;gap:8px;border:0;cursor:pointer;transition:background .15s}
.ln-conectar:hover{background:#e6d900}
.ln-conectar svg{width:16px;height:16px;transition:transform .35s cubic-bezier(.22,1,.36,1)}
.ln-conectar:hover svg{transform:rotate(90deg)}
.ln-res{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.ln-r{display:flex;align-items:center;gap:14px;padding:14px 16px;border:1px solid var(--line);border-radius:14px;background:#fff;min-width:0}
.ln-r .ic{width:38px;height:38px;border-radius:10px;display:grid;place-items:center;flex:none}
.ln-r .ic svg{width:21px;height:21px;display:block}
.ln-r .ic.wa{background:#25D366;color:#fff;border-radius:11px}
.ln-r .ic.meta{background:none}
.ln-r .ic.meta svg{width:34px;height:34px}
.ln-r .ic.tel{background:#fff1ea;color:#d9480f}
.ln-r .ic.tel svg{width:18px;height:18px}
.ln-r b{display:block;font-size:14px;font-weight:600}
.ln-r small{display:block;color:var(--ink3);font-size:12.5px}
.ln-tit{display:flex;justify-content:space-between;align-items:baseline;margin:0 0 -10px;font-size:13.5px;font-weight:600;color:var(--ink2)}
.ln-tit span{font-weight:500;color:var(--ink3)}
.ln-grilla{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:start}
.ln-card{border:1px solid var(--line);border-radius:14px;background:#fff;min-width:0}
.ln-card-cab{display:flex;align-items:center;gap:12px;padding:14px 16px;position:relative}
.ln-wa{width:38px;height:38px;border-radius:11px;background:#25D366;color:#fff;display:grid;place-items:center;flex:none}
.ln-wa svg{width:22px;height:22px;display:block}
.ln-card.mal .ln-wa{background:#b9bdc6}
.ln-nom{flex:1;min-width:0}
.ln-nom b{display:block;font-size:14.5px;font-weight:600}
.ln-nom span{display:block;color:var(--ink3);font-size:12px;font-variant-numeric:tabular-nums}
.ln-est{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;padding:3px 10px;border-radius:999px;white-space:nowrap}
.ln-est i{width:7px;height:7px;border-radius:50%;background:currentColor}
.ln-est{padding-left:0;padding-right:0}
.ln-est.ok{color:#16a34a}
.ln-est.ok i{background:#22c55e}
.ln-est.espera{color:#d97706}
.ln-est.mal{color:#dc2626}
.ln-mas{width:32px;height:32px;border-radius:8px;display:grid;place-items:center;color:var(--ink3);border:0;background:none;cursor:pointer}
.ln-mas:hover{background:var(--bg3);color:var(--ink)}
.ln-mas svg{width:18px;height:18px}
.ln-menu{position:absolute;right:12px;top:52px;z-index:5;min-width:210px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:5px;box-shadow:0 14px 30px -14px rgba(15,23,42,.35)}
.ln-menu[hidden]{display:none}
.ln-menu button{display:flex;align-items:center;gap:9px;width:100%;padding:8px 10px;border:0;background:none;border-radius:7px;font:inherit;font-size:13px;color:var(--ink);text-align:left;cursor:pointer}
.ln-menu button:hover{background:var(--hover)}
.ln-menu svg{width:15px;height:15px;color:var(--ink3)}
.ln-f{display:flex;align-items:center;gap:12px;padding:11px 16px;border-top:1px solid var(--line)}
.ln-f .fic{width:30px;height:30px;border-radius:8px;background:var(--bg3);color:var(--ink2);display:grid;place-items:center;flex:none}
.ln-f .fic svg{width:15px;height:15px;display:block}
.ln-f .ftx{flex:1;min-width:0}
.ln-f .ftx b{display:block;font-weight:500;font-size:13px}
.ln-f .ftx small{display:block;color:var(--ink3);font-size:12px}
.ln-f .ctl{flex:none;display:flex;align-items:center;gap:8px;font-weight:500;font-size:13px}
.ln-f .dsel{min-width:160px!important}
.ln-senal{display:inline-flex;align-items:flex-end;gap:3px;height:15px}
.ln-senal i{width:4px;border-radius:2px;background:#d5d8e0}
.ln-senal i:nth-child(1){height:5px}.ln-senal i:nth-child(2){height:10px}.ln-senal i:nth-child(3){height:15px}
.ln-senal.alta i{background:#15803d}
.ln-senal.media i:nth-child(-n+2){background:#b45309}
.ln-senal.baja i:nth-child(1){background:#b91c1c}
.ln-esc{display:inline-flex;gap:2px}
.ln-esc i{width:11px;height:5px;border-radius:2px;background:#d5d8e0}
.ln-esc i.on{background:var(--ink)}
.ln-lnk{border:0;background:none;padding:4px 0;color:var(--blue-ink);font:inherit;font-size:13px;font-weight:500;display:inline-flex;align-items:center;gap:4px;cursor:pointer}
.ln-lnk:hover{text-decoration:underline;text-underline-offset:3px}
.ln-lnk svg{width:14px;height:14px;transition:transform .25s cubic-bezier(.22,1,.36,1)}
.ln-lnk[aria-expanded="true"] svg{transform:rotate(180deg)}
.ln-sub{padding:2px 16px 12px 58px;display:grid;gap:8px}
.ln-req{display:flex;align-items:center;gap:10px;font-size:12.5px;color:var(--ink2);flex-wrap:wrap}
.ln-req svg{width:16px;height:16px;flex:none}
.ln-req.falta svg{color:var(--amber-ink)}
.ln-req.listo svg{color:var(--green-ink)}
.ln-req em{font-style:normal;margin-left:auto;color:var(--ink3);font-variant-numeric:tabular-nums}
.ln-req a{margin-left:auto;color:var(--blue-ink);font-weight:500;text-decoration:none}
.ln-sub .row2{padding:6px 0;border-top:1px dashed var(--line2)}
.ln-sub .row2:first-child{border-top:0}
.ln .tg[aria-checked="true"]{background:#1a9e4b}
.ln-sub .ll-ok{white-space:nowrap}
.ln-cuentas{border:1px solid var(--line);border-radius:14px;background:#fff;overflow:hidden}
.ln-cta{display:flex;align-items:center;gap:14px;padding:14px 16px;flex-wrap:wrap}
.ln-cta + .ln-cta,.ln-cta + .ln-nota,.ln-nota + .ln-cta,.ln-cta + .ln-hook,.ln-hook + .ln-cta,.ln-nota + .ln-hook{border-top:1px solid var(--line)}
.ln-cta .fic{width:38px;height:38px;border-radius:10px;background:var(--bg3);display:grid;place-items:center;flex:none}
.ln-cta .fic svg{width:21px;height:21px;display:block}
.ln-cta .ctx{flex:1 1 240px;min-width:0}
.ln-cta .ctx b{display:block;font-weight:600}
.ln-cta .ctx small{display:block;color:var(--ink3);font-size:12.5px;font-variant-numeric:tabular-nums}
.ln-chip{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;padding:3px 10px;border-radius:999px;border:1px solid var(--line);color:var(--ink2);white-space:nowrap}
.ln-chip svg{width:13px;height:13px}
.ln-chip.ok{color:var(--green-ink)}
.ln-chip.ambar{color:var(--amber-ink)}
.ln-chip.mal{background:var(--red-soft);border-color:#f5c2c2;color:var(--red-ink)}
.ln-cta .acc{display:flex;gap:6px}
.ln-nota{display:flex;align-items:center;gap:12px;padding:11px 16px;background:var(--red-soft);color:var(--ink2);font-size:13px;flex-wrap:wrap}
.ln-nota svg{width:17px;height:17px;color:var(--red-ink);flex:none}
.ln-nota span{flex:1 1 300px}
.ln-hook{padding:12px 16px;background:var(--bg2);display:grid;gap:8px}
.ln-hook p{margin:0;font-size:12.5px;color:var(--ink2)}
.ln-extra{display:flex;align-items:center;gap:14px;padding:14px 16px;border:1px solid var(--line);border-radius:14px;background:#fff;flex-wrap:wrap}
.ln-extra .fic{width:38px;height:38px;border-radius:10px;background:var(--bg3);color:var(--ink2);display:grid;place-items:center;flex:none}
.ln-extra .fic svg{width:18px;height:18px}
.ln-extra div{flex:1 1 260px;min-width:0}
.ln-extra b{display:block;font-weight:500}
.ln-extra small{color:var(--ink3);font-size:12.5px}
.ln-plat{border:1px solid var(--line);border-radius:14px;background:#fff;overflow:hidden}
.ln-plat-cab{display:flex;align-items:flex-start;gap:14px;padding:16px 18px 4px;flex-wrap:wrap}
.ln-plat-cab .fic{width:38px;height:38px;border-radius:10px;background:var(--bg3);display:grid;place-items:center;flex:none}
.ln-plat-cab .fic svg{width:21px;height:21px;display:block}
.ln-plat-cab div{flex:1 1 320px;min-width:0}
.ln-plat-cab h4{margin:0;font-size:14.5px;font-weight:600;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.ln-plat-cab p{margin:4px 0 0;color:var(--ink3);font-size:13px;max-width:72ch}
.ln-solo{font-size:11.5px;font-weight:600;padding:2px 9px;border-radius:999px;border:1px solid #d5d8e0;color:var(--ink2)}
.ln-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 18px;padding:14px 18px 4px}
.ln-campo label{display:block;font-size:13px;font-weight:600;margin-bottom:6px}
.ln-campo label small{font-weight:400;color:var(--ink3)}
.ln-campo input{width:100%;height:38px;border:1px solid #d5d8e0;border-radius:10px;padding:0 12px;font:inherit;font-size:13px;font-variant-numeric:tabular-nums;background:#fff;transition:border-color .15s,box-shadow .15s}
.ln-campo input:hover{border-color:var(--ink3)}
.ln-campo input:focus{outline:none;border-color:var(--blue-ink);box-shadow:0 0 0 3px rgba(25,118,210,.15)}
.ln-campo .ayuda{display:block;margin-top:5px;font-size:12px;color:var(--ink3)}
.ln-copiables{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 18px;margin:12px 18px 0;padding:12px 14px;border-radius:12px;background:var(--bg2)}
.ln-copiables p{grid-column:1/-1;margin:0;font-size:12.5px;color:var(--ink2)}
.ln-copiable small{display:block;font-size:12px;font-weight:600;color:var(--ink3);margin-bottom:4px}
.ln-copiable div{display:flex;align-items:center;gap:6px;background:#fff;border:1px solid var(--line);border-radius:9px;padding:5px 5px 5px 10px}
.ln-copiable code{flex:1;min-width:0;font-family:inherit;font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ln-copiable button{width:28px;height:28px;border-radius:7px;display:grid;place-items:center;color:var(--ink2);border:0;background:none;cursor:pointer;flex:none}
.ln-copiable button:hover{background:var(--bg3);color:var(--ink)}
.ln-copiable button svg{width:15px;height:15px}
.ln-plat-pie{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 18px 16px;flex-wrap:wrap}
.ln-plat-est{display:inline-flex;align-items:center;gap:8px;font-size:13px;font-weight:500;color:var(--amber-ink)}
.ln-plat-est.ok{color:var(--green-ink)}
.ln-plat-est i{width:7px;height:7px;border-radius:50%;background:currentColor}
@media (max-width:1100px){.ln-res,.ln-grilla{grid-template-columns:1fr}}
@media (max-width:600px){.ln-f{flex-wrap:wrap}.ln-f .ctl{width:100%;padding-left:42px}.ln-f .dsel{min-width:0!important;width:100%}.ln-form,.ln-copiables{grid-template-columns:1fr}.ln-sub{padding-left:16px}}
@media (prefers-reduced-motion:reduce){.ln-conectar svg,.ln-lnk svg{transition:none}}
</style>`);

// El logo de Meta con su degradado oficial. Cada copia lleva su propio id de degradado.
let lnMetaN = 0;
const logoMeta = () => { const id = 'meta-deg-' + (++lnMetaN); return LOGO_META.replace('__ID__', id).replace('__ID__', id); };
const LOGO_META = '<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="__ID__" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#0064E0"/><stop offset="1" stop-color="#0082FB"/></linearGradient></defs><path fill="url(#__ID__)" d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z"/></svg>';
const LN_IC = {
  equipo: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.8 3 2.6 3.5 5.2"/></svg>',
  senal: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 19v-3M10 19v-7M15 19V8M20 19V4"/></svg>',
  escalera: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h5v-5h5v-5h5V5h3"/></svg>',
  reloj: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  copiar: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h8"/></svg>',
  alerta: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17h.01"/></svg>',
};
// Los niveles de Meta para conversaciones nuevas al día.
const LN_NIVELES = [250, 2000, 10000, 100000, Infinity];
const lnNivel = n => { if (n == null) return -1; let i = 0; LN_NIVELES.forEach((v, k) => { if (n >= v) i = k; }); return i; };
const lnCalidad = v => { const s = String(v || '').toUpperCase(); return /GREEN|HIGH/.test(s) ? ['alta', 'Alta'] : /YELLOW|MEDIUM/.test(s) ? ['media', 'Media'] : /RED|LOW/.test(s) ? ['baja', 'Baja'] : ['', 'Sin dato']; };
const lnCuentaDe = l => conexionesWa().find(c => c.id === l.conexionId) || null;
const lnLineasDe = c => LINEAS.filter(l => l.conexionId === c.id).length || c.lineas || 0;
st.lnAbierto = st.lnAbierto || {};

/* Cuentas de Meta conectadas: cómo se conectó cada una, si Meta ya manda los avisos, revisar y desconectar */
function cajaCuentasMeta(){
  const cs = conexionesWa(); if (!cs.length) return '';
  return `<div class="ln-tit">Cuentas de Meta <span>${cs.length}</span></div><div class="ln-cuentas">${cs.map(c => {
    const n = lnLineasDe(c), avisos = c.ultimoAviso ? `último mensaje ${cuandoKB(c.ultimoAviso)}` : (c.verificado || c.modo === 'meta') ? 'todavía no llega ningún mensaje' : 'Meta no ha verificado los avisos';
    const est = c.estado === 'conectada' ? `<span class="ln-chip ok">${I('check')}${c.modo === 'meta' ? 'Conectada con Facebook' : 'Conectada con los datos de la app'}</span>`
      : c.estado === 'error' ? `<span class="ln-chip mal">${LN_IC.alerta}Con un problema</span>` : `<span class="ln-chip ambar">${LN_IC.reloj}Pendiente</span>`;
    const llamadasOk = LINEAS.some(l => l.conexionId === c.id && metaLlamadas(l)), limOk = LINEAS.some(l => l.conexionId === c.id && (limiteNum(l.limite) || 0) >= 2000);
    const req = llamadasOk ? 2 : limOk ? 1 : 0;
    const manualPendiente = c.modo === 'manual' && c.webhookUrl && (c.estado === 'error' || (!c.verificado && !c.ultimoAviso && c.webhookApp !== 'otro'));
    return `<div class="ln-cta"><span class="fic">${logoMeta()}</span><div class="ctx"><b>${esc(cxNombre(c))}</b><small>${c.appId ? `App ${esc(c.appId)} · ` : ''}${c.cuentas} ${c.cuentas === 1 ? 'cuenta' : 'cuentas'} de WhatsApp · ${n} ${n === 1 ? 'línea' : 'líneas'} · ${avisos}</small></div>
      ${est}<span class="ln-chip ${req === 2 ? 'ok' : 'ambar'}">${I('phone')}Llamadas: ${req} de 2 requisitos</span>
      <div class="acc"><button type="button" class="btn" data-cxm-revisar="${c.id}">${I('swap')}Revisar</button><button type="button" class="btn" data-cxm-quitar="${c.id}">${I('x')}Desconectar</button></div></div>
      ${c.error ? `<div class="ln-nota">${LN_IC.alerta}<span>${esc(c.error)}</span></div>` : ''}
      ${manualPendiente ? `<div class="ln-hook"><p>Si Meta no manda los mensajes solo: en tu app de Meta ve a WhatsApp, Configuración, Webhook; pega esta dirección y este código y suscríbete al campo «messages».</p>${lnCopiable('Dirección de avisos', c.webhookUrl)}${lnCopiable('Código de verificación', c.verifyToken || '')}</div>` : ''}`;
  }).join('')}</div>`;
}
const lnCopiable = (etq, v) => `<div class="ln-copiable"><small>${etq}</small><div><code>${esc(v)}</code><button type="button" data-cx-copiar="${esc(v)}" aria-label="Copiar ${etq}">${LN_IC.copiar}</button></div></div>`;

/* El botón «Conectar con Facebook» usa la app de Meta de la plataforma: la configura su administrador, una sola vez. */
st.provCfg = null;
function cajaProveedor(){
  if (!CRM_YO.operador) return '';
  const p = st.provCfg;
  if (!p) { crmApi('GET', '/crm/conexiones/proveedor').then(d => { st.provCfg = d; if (st.pagina === 'cfg-lineas') render(); }).catch(() => {}); return ''; }
  const estado = p.listo && p.listoPaginas ? ['ok', 'Activo para WhatsApp, Instagram y Messenger'] : p.listo ? ['ok', 'Activo para WhatsApp'] : p.listoPaginas ? ['', 'Falta la configuración de WhatsApp'] : ['', 'Sin configurar'];
  return `<section class="ln-plat" aria-label="Botón Conectar con Facebook de la plataforma">
    <div class="ln-plat-cab"><span class="fic">${logoMeta()}</span><div><h4>Botón «Conectar con Facebook» de la plataforma <span class="ln-solo">Solo tú lo ves</span></h4>
      <p>La app de Meta que usan todas las empresas del CRM para conectar WhatsApp, Instagram y Messenger con un clic. Se configura una sola vez.</p></div></div>
    <div class="ln-form">
      <div class="ln-campo"><label for="pv-app">Identificador de la app <small>(App ID)</small></label><input id="pv-app" value="${esc(p.appId || '')}" inputmode="numeric" autocomplete="off" placeholder="Ej. 1234567890123456"><span class="ayuda">Configuración de la app → Básica</span></div>
      <div class="ln-campo"><label for="pv-sec">Clave secreta de la app</label><input id="pv-sec" type="password" value="" autocomplete="new-password" placeholder="${p.conClave ? 'Guardada: déjala vacía para no cambiarla' : '32 letras y números'}"><span class="ayuda">Se guarda cifrada y no se vuelve a mostrar</span></div>
      <div class="ln-campo"><label for="pv-cfg">Configuración de WhatsApp <small>(config_id)</small></label><input id="pv-cfg" value="${esc(p.configId || '')}" inputmode="numeric" autocomplete="off" placeholder="Ej. 1234567890123456"><span class="ayuda">Facebook Login for Business → Configuraciones → registro integrado</span></div>
      <div class="ln-campo"><label for="pv-cfgp">Configuración de Instagram y Messenger <small>(config_id)</small></label><input id="pv-cfgp" value="${esc(p.configPaginas || '')}" inputmode="numeric" autocomplete="off" placeholder="Ej. 1234567890123456"><span class="ayuda">Otra configuración, para páginas</span></div>
    </div>
    ${p.verifyToken ? `<div class="ln-copiables"><p>En la app de Meta, WhatsApp → Configuración → Webhook: pega esta dirección y este código y suscríbete a «messages», «message_template_status_update» y «phone_number_quality_update». Para Instagram y Messenger, la dirección de páginas con el mismo código.</p>
      ${lnCopiable('Dirección de avisos', p.webhookUrl)}${lnCopiable('Código de verificación', p.verifyToken)}${p.webhookPaginas ? lnCopiable('Dirección de páginas', p.webhookPaginas) : ''}</div>` : ''}
    <div class="ln-plat-pie"><span class="ln-plat-est ${estado[0]}"><i></i>${estado[1]}</span><button type="button" class="btn pri" data-pv-guardar="1">${I('check')}Guardar</button></div>
  </section>`;
}

/* Una línea: encabezado con su estado y menú, y las filas de equipo, calidad, límite y llamadas. */
function tarjetaLinea(l, lim){
  const i = CFG.lineas.findIndex(x => x.id === l.id), x = CFG.lineas[i] || {id:l.id, eq:'Ventas'};
  const c = LLAM.lineas[l.id] || {on:false, icono:true, eq:'Ventas', buzon:true, grabar:true}, cx = lnCuentaDe(l);
  const meta = metaLlamadas(l), puede = meta && lim != null && lim >= 2000, on = meta && !!c.on;
  const est = l.estado !== 'conectada' ? ['mal', l.estado === 'desconectada' ? 'Desconectada' : 'Sin conexión'] : cx && !cx.ultimoAviso ? ['espera', 'Esperando mensajes'] : ['ok', 'Conectada'];
  const cal = lnCalidad(l.calidad), ln = limiteNum(l.limite), niv = lnNivel(ln);
  const ab = st.lnAbierto[l.id] || '';
  const nueva = on && c.desde && Date.now() - Date.parse(c.desde) < 7 * 864e5;
  return `<article class="ln-card ${est[0] === 'mal' ? 'mal' : ''}">
    <div class="ln-card-cab"><span class="ln-wa">${LOGO.wa}</span><div class="ln-nom"><b>${esc(l.n)}</b><span>${esc(l.tel)}${cx ? ` · ${esc(cxNombre(cx))}` : ''}</span></div>
      <span class="ln-est ${est[0]}"><i></i>${est[1]}</span>
      <button type="button" class="ln-mas" data-ln-menu="${l.id}" aria-haspopup="menu" aria-expanded="${st.lnMenu === l.id}" aria-label="Más acciones de ${esc(l.n)}">${I('more')}</button>
      <div class="ln-menu" role="menu" ${st.lnMenu === l.id ? '' : 'hidden'}><button type="button" role="menuitem" data-ln-ver="${l.id}">${I('inbox')}Ver sus conversaciones</button><button type="button" role="menuitem" data-cx-copiar="${esc(l.tel)}">${LN_IC.copiar}Copiar el número</button></div></div>
    <div class="ln-f"><span class="fic">${LN_IC.equipo}</span><div class="ftx"><b>Equipo que la atiende</b><small>Le llegan sus conversaciones nuevas</small></div><div class="ctl">${ddSel('data-cfg-lineq', EQUIPOS.map(e => [`${i}|${e.n}`, e.n]), `${i}|${x.eq}`)}</div></div>
    <div class="ln-f"><span class="fic">${LN_IC.senal}</span><div class="ftx"><b>Calidad según Meta</b><small>Si baja, Meta limita cuántos mensajes envías</small></div><div class="ctl"><span class="ln-senal ${cal[0]}" aria-hidden="true"><i></i><i></i><i></i></span>${cal[1]}</div></div>
    <div class="ln-f"><span class="fic">${LN_IC.escalera}</span><div class="ftx"><b>Límite de Meta</b><small>${niv < 0 ? 'Meta todavía no lo ha informado' : `Nivel ${niv + 1} de 5${niv < 4 ? `, el siguiente es ${fmtLimite(LN_NIVELES[niv + 1])}` : ''}`}</small></div>
      <div class="ctl"><span class="ln-esc" aria-hidden="true">${LN_NIVELES.map((_, n) => `<i class="${n <= niv ? 'on' : ''}"></i>`).join('')}</span><span>${ln == null ? 'Sin dato' : `${fmtLimite(ln)} al día`}</span></div></div>
    <div class="ln-f"><span class="fic">${I('phone')}</span><div class="ftx"><b>Llamadas</b><small>${!meta ? 'Meta todavía no las activa en esta línea' : on ? 'Tus clientes ven el botón de llamar' : 'Apagadas en esta línea'}</small></div>
      <div class="ctl">${puede ? `${on ? `<button type="button" class="ln-lnk" data-ln-abrir="${l.id}|aj" aria-expanded="${ab === 'aj'}">Ajustes${I('chev')}</button>` : ''}<button type="button" class="tg" role="switch" data-ll-on="${l.id}" aria-checked="${on}" aria-label="Llamadas por WhatsApp en ${esc(l.n)}"></button>`
        : `<button type="button" class="ln-lnk" data-ln-abrir="${l.id}|req" aria-expanded="${ab === 'req'}">Ver requisitos${I('chev')}</button>`}</div></div>
    ${ab === 'req' && !puede ? `<div class="ln-sub">
      <div class="ln-req ${lim != null && lim >= 2000 ? 'listo' : 'falta'}">${lim != null && lim >= 2000 ? I('check') : LN_IC.reloj}Límite de 2.000 conversaciones al día<em>${lim == null ? 'Sin dato de Meta' : lim >= 2000 ? 'Listo' : `${fmtLimite(lim)} de 2.000`}</em></div>
      <div class="ln-req falta">${LN_IC.reloj}Método de pago en la cuenta de WhatsApp<a href="https://business.facebook.com/wa/manage/" target="_blank" rel="noopener noreferrer">Revisar en Meta</a></div>
      <div class="ln-req ${meta ? 'listo' : 'falta'}">${meta ? I('check') : LN_IC.reloj}Meta activa las llamadas en la línea<em>${meta ? 'Listo' : 'Pendiente'}</em></div></div>` : ''}
    ${ab === 'aj' && on ? `<div class="ln-sub">
      ${nueva ? '<div class="ll-nota">Activadas hace poco. Meta puede tardar hasta 7 días en mostrar el botón de llamar en los teléfonos.</div>' : ''}
      ${fila('Mostrar el botón de llamar en WhatsApp', 'Si se oculta, el cliente solo puede llamar desde un botón que le mande el asesor', `<button type="button" class="tg" role="switch" data-ll-tg="${l.id}|icono" aria-checked="${c.icono}" aria-label="Mostrar el botón de llamar"></button>`)}
      ${fila('Quién contesta', 'Suena a los asesores conectados de ese equipo; el primero que contesta se la queda', ddSel('data-ll-eq', EQUIPOS.map(e => [`${l.id}|${e.n}`, e.n]), `${l.id}|${c.eq}`))}
      ${fila('Horario para recibir llamadas', 'El mismo horario de atención del CRM', `<button type="button" class="btn" data-ir="cfg-horario">Cambiar</button>`)}
      ${fila('Horario para llamar a clientes', 'Lunes a viernes de 7 a. m. a 7 p. m. y sábados de 8 a. m. a 3 p. m.; nunca domingos ni festivos (Ley 2300)', `<span class="ll-ok">${I('lock')}Fijo por ley</span>`)}
      ${fila('Buzón de voz si nadie contesta en 30 segundos', 'El mensaje de voz llega a la conversación, transcrito', `<button type="button" class="tg" role="switch" data-ll-tg="${l.id}|buzon" aria-checked="${c.buzon}" aria-label="Buzón de voz"></button>`)}
      ${fila('Grabar y transcribir las llamadas', 'Solo si el contacto autorizó sus datos', `<button type="button" class="tg" role="switch" data-ll-tg="${l.id}|grabar" aria-checked="${c.grabar}" aria-label="Grabar y transcribir"></button>`)}</div>` : ''}
  </article>`;
}

/* Página «Líneas de WhatsApp» */
function paginaLineas(){
  const volver = `<button type="button" class="volver" data-ir="ajustes-crm">${I('back')}Ajustes del CRM</button>`;
  const lims = LINEAS.map(l => limiteNum(l.limite)).filter(n => n != null), lim = lims.length ? Math.max(...lims) : null;
  // Pintar no escribe ajustes: el visitante de solo lectura entraba en un bucle de pintar y revertir.
  if (!crmSoloLectura()) LINEAS.forEach(l => ajLinea(l.id));
  const cs = conexionesWa(), conectadas = LINEAS.filter(l => l.estado === 'conectada').length;
  const conLlamadas = LINEAS.filter(l => metaLlamadas(l) && (LLAM.lineas[l.id] || {}).on).length;
  const problemas = cs.filter(c => c.estado === 'error').length, ultimo = cs.map(c => c.ultimoAviso).filter(Boolean).sort().pop();
  const resumen = LINEAS.length ? `<div class="ln-res">
      <div class="ln-r"><span class="ic wa">${LOGO.wa}</span><span><b>${conectadas} de ${LINEAS.length} ${LINEAS.length === 1 ? 'línea' : 'líneas'}</b><small>conectadas y recibiendo mensajes</small></span></div>
      <div class="ln-r"><span class="ic meta">${logoMeta()}</span><span><b>${cs.length} ${cs.length === 1 ? 'cuenta de Meta' : 'cuentas de Meta'}</b><small>${problemas ? `${problemas} con un problema` : ultimo ? `El último mensaje llegó ${cuandoKB(ultimo)}` : 'Esperando el primer mensaje'}</small></span></div>
      <div class="ln-r"><span class="ic tel">${I('phone')}</span><span><b>${conLlamadas ? `Llamadas en ${conLlamadas} ${conLlamadas === 1 ? 'línea' : 'líneas'}` : 'Llamadas apagadas'}</b><small>${conLlamadas ? 'Tus clientes pueden llamarte' : 'Requisitos de Meta por revisar'}</small></span></div>
    </div>` : '';
  return `<div class="ajw ancho">${volver}<div class="ln">
    <div class="ln-cab"><div><h2>Líneas de WhatsApp</h2><p class="sub">Las líneas conectadas por la API oficial de Meta. Aquí se conecta cada línea, se elige su equipo y se activan sus llamadas.</p></div>
      <button type="button" class="ln-conectar" data-ll-conectar="1">${I('plus')}Conectar línea</button></div>
    ${resumen}
    ${LINEAS.length ? `<div class="ln-tit">Líneas <span>${LINEAS.length}</span></div><div class="ln-grilla">${LINEAS.map(l => tarjetaLinea(l, lim)).join('')}</div>`
      : `<div class="box2"><div class="vacio">${I('wa')}<b>Ninguna línea conectada</b><p>Conecta la cuenta de WhatsApp Business de tu empresa y elige sus números. Meta te cobra los mensajes directo, sin recargo.</p><button type="button" class="ln-conectar" data-ll-conectar="1">${I('plus')}Conectar línea</button></div></div>`}
    ${cajaCuentasMeta()}
    <div class="ln-extra"><span class="fic">${I('mic')}</span><div><b>Grabaciones, buzón de voz y horario</b><small>Se configuran para todas las líneas en la página Llamadas.</small></div><button type="button" class="btn" data-ir="cfg-llamadas">Abrir</button></div>
    ${cajaProveedor()}
  </div></div>`;
}
const paginaCfgBase = paginaCfg;
paginaCfg = function(k){ return k === 'lineas' ? paginaLineas() : paginaCfgBase(k); };

document.getElementById('page').addEventListener('click', e => {
  if (st.pagina !== 'cfg-lineas') return; const t = e.target;
  if (t.closest('[data-ll-conectar]')) { abrirConexion('Ventas'); return; }
  const mn = t.closest('[data-ln-menu]'); if (mn) { st.lnMenu = st.lnMenu === mn.dataset.lnMenu ? null : mn.dataset.lnMenu; render(); return; }
  const vr = t.closest('[data-ln-ver]'); if (vr) { st.lnMenu = null; st.linea = ''; filtrar('linea', vr.dataset.lnVer); return; }
  const ab = t.closest('[data-ln-abrir]'); if (ab) { const [id, k] = ab.dataset.lnAbrir.split('|'); st.lnAbierto[id] = st.lnAbierto[id] === k ? '' : k; render(); return; }
  if (st.lnMenu && !t.closest('.ln-menu')) { st.lnMenu = null; render(); }
  const cpy = t.closest('[data-cx-copiar]'); if (cpy) { copiar(cpy.dataset.cxCopiar, 'Copiado'); return; }
  const rv = t.closest('[data-cxm-revisar]'); if (rv && !rv.disabled) { rv.disabled = true;
    crmApi('POST', `/crm/conexiones/${rv.dataset.cxmRevisar}/revisar`).then(c => { mezclarConexion(c); toast(c.estado === 'conectada' ? 'La cuenta de Meta está bien' : 'La cuenta de Meta tiene un problema'); render(); })
      .catch(err => { toast(err.message || 'No se pudo revisar'); rv.disabled = false; }); return; }
  const qt = t.closest('[data-cxm-quitar]'); if (qt) { const c = CONEXIONES.find(x => x.id === qt.dataset.cxmQuitar); if (!c) return;
    abrirDialogo(`<h3>Desconectar ${esc(cxNombre(c))}</h3><p>Sus ${c.lineas} ${c.lineas === 1 ? 'línea sale' : 'líneas salen'} del CRM y dejan de llegar sus mensajes. Las conversaciones que ya hay se quedan.</p><div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" style="background:#dc2626;border-color:#dc2626" data-cxm-quitarok="${c.id}">${I('x')}Desconectar</button></div>`); return; }
  if (t.closest('[data-pv-guardar]')) { const v = id => (document.getElementById(id) || {}).value || '';
    crmApi('PUT', '/crm/conexiones/proveedor', {appId:v('pv-app').trim(), configId:v('pv-cfg').trim(), configPaginas:v('pv-cfgp').trim(), appSecret:v('pv-sec').trim()})
      .then(p => { st.provCfg = p; render(); toast('Botón de Meta guardado'); }).catch(err => toast(err.message || 'No se pudo guardar')); return; }
  const on = t.closest('[data-ll-on]'); if (on && !on.disabled) { const id = on.dataset.llOn, c = LLAM.lineas[id]; c.on = !c.on; c.desde = c.on ? new Date().toISOString() : null; st.lnAbierto[id] = c.on ? 'aj' : ''; render(); toast(c.on ? 'Llamadas activadas en ' + lineaDe(id).n : 'Llamadas apagadas en ' + lineaDe(id).n); return; }
  const tg = t.closest('[data-ll-tg]'); if (tg) { const [id, k] = tg.dataset.llTg.split('|'); LLAM.lineas[id][k] = !LLAM.lineas[id][k]; render(); toast(LLAM.lineas[id][k] ? 'Activado' : 'Apagado'); return; }
  const eq = t.closest('[data-ll-eq]'); if (eq) { const [id, n] = eq.dataset.llEq.split('|'); LLAM.lineas[id].eq = n; render(); toast(`Las llamadas de ${lineaDe(id).n} suenan a ${n}`); return; }
});
document.getElementById('page').addEventListener('input', e => { if (['cfg-lineas', 'cfg-llamadas'].includes(st.pagina) && e.target.dataset.llIn === 'proposito') { const c = document.getElementById('ll-prop-c'); if (c) c.textContent = `${e.target.value.length}/250`; } });
document.getElementById('page').addEventListener('change', e => {
  if (!['cfg-lineas', 'cfg-llamadas'].includes(st.pagina) || !e.target.dataset.llIn) return;
  LLAM[e.target.dataset.llIn] = e.target.value.trim() || LLAM[e.target.dataset.llIn]; toast('Guardado');
});

/* Conectar línea (26-sep, CRM independiente): 1. la cuenta de Meta de la empresa, con el botón de Meta o con los datos
   de su app (POST /crm/conexiones/whatsapp…); 2. el número; 3. nombre, equipo y PIN; 4. registrarlo (POST /crm/lineas). */
// Cuentas de Meta conectadas del espacio (GET /crm/inicio `conexiones` y el evento `conexiones`).
const CONEXIONES = [];
const conexionesWa = () => CONEXIONES.filter(c => c.tipo === 'whatsapp');
const cxUsable = c => c && c.estado !== 'desconectada';
function abrirConexion(eq){
  const usables = conexionesWa().filter(cxUsable);
  const x = st.cx = {paso:1, conexionId:usables.length === 1 ? usables[0].id : (usables[0] || {}).id || null, nueva:!usables.length, manual:false,
    app:{appId:'', appSecret:'', token:'', wabaId:''}, pideWaba:false, enviandoCx:false, errorCx:'', avisoCx:null, prov:null, fbCargando:false,
    cargando:false, error:'', configurado:true, numeros:[], sel:null, preferido:null, nombre:'', eq, pin:'', llamadas:true, estado:'', linea:null};
  crmApi('GET', '/crm/conexiones/proveedor').then(p => { x.prov = p; }).catch(() => { x.prov = {listo:false}; })
    .finally(() => { if (st.cx === x && x.paso === 1 && !document.getElementById('ov-x').hidden) pintarConexion(); });
  pintarConexion();
}
function buscarNumeros(x){
  x.cargando = true; x.error = '';
  crmApi('GET', '/crm/lineas/disponibles?conexionId=' + encodeURIComponent(x.conexionId || ''))
    .then(d => {
      x.configurado = !!(d && d.configurado); x.numeros = ((d && d.numeros) || []).filter(n => !LINEAS.some(l => l.phoneNumberId === n.phoneNumberId));
      // Con el botón de Meta ya se sabe qué número eligió: se salta la lista.
      if (x.preferido && x.numeros.some(n => n.phoneNumberId === x.preferido && n.ok)) { x.sel = x.preferido; x.preferido = null; if (x.paso === 2) x.paso = 3; }
    })
    .catch(err => { x.error = err.message || 'No respondió el servidor'; })
    .finally(() => { x.cargando = false; if (st.cx === x && (x.paso === 2 || x.paso === 3) && !document.getElementById('ov-x').hidden) pintarConexion(); });
}
const numeroSel = x => x.numeros.find(n => n.phoneNumberId === x.sel) || {};
const cxNombre = c => c.modo === 'meta' ? 'WhatsApp conectado con Meta' : c.nombre;
const cxDetalle = c => [c.modo === 'meta' ? 'Con el botón de Meta' : `App de Meta ${c.appId || ''}`.trim(), `${c.cuentas} ${c.cuentas === 1 ? 'cuenta' : 'cuentas'} de WhatsApp`, c.lineas ? `${c.lineas} ${c.lineas === 1 ? 'línea' : 'líneas'} en el CRM` : ''].filter(Boolean).join(' · ');
const datoCopiable = (etq, v) => `<div class="cx-dato"><span>${etq}</span><code>${esc(v)}</code><button type="button" class="btn ic" data-cx-copiar="${esc(v)}" aria-label="Copiar ${etq}">${I('share')}</button></div>`;
function pasoCuenta(x){
  const usables = conexionesWa().filter(cxUsable);
  if (!x.nueva && usables.length) return `<p>Elige la cuenta de Meta del número que vas a conectar.</p>
    <div class="cx-list">${usables.map(c => `<button type="button" class="cx-op" role="radio" aria-checked="${x.conexionId === c.id}" data-cx-cuenta="${c.id}"><span class="rd"></span><span><b>${esc(cxNombre(c))}</b><small>${esc(cxDetalle(c))}${c.estado === 'error' ? ' · con un problema: revísala en Líneas de WhatsApp' : ''}</small></span></button>`).join('')}
      <button type="button" class="cx-op" data-cx-nueva="1"><span class="rd"></span><span><b>Conectar otra cuenta de Meta</b><small>Otra cuenta de WhatsApp Business o la de otra app</small></span></button></div>`;
  if (x.avisoCx) { const c = x.avisoCx; return `<div class="ll-nota">${esc(c.error || 'Las claves están bien, pero falta configurar el aviso de mensajes.')}</div>
    <p>Configúralo a mano en tu app de Meta: en WhatsApp, Configuración, Webhook, pega esta dirección y este código, y suscríbete al campo «messages».</p>
    ${datoCopiable('Dirección', c.webhookUrl || '')}${datoCopiable('Código de verificación', c.verifyToken || '')}
    <p class="muted">Cuando Meta la verifique, los mensajes empiezan a llegar. Mientras tanto ya puedes elegir el número.</p>`; }
  const prov = x.prov, fbListo = prov && prov.listo;
  if (!x.manual) return `<p>Elige cómo conectar la cuenta de WhatsApp Business de tu empresa.</p>
    <div class="cx-list">
      <button type="button" class="opc" data-cx-fb="1" ${fbListo && !x.fbCargando ? '' : 'disabled'}><span class="marca fb">${LOGO.fb}</span><span class="tx"><b>${x.fbCargando ? 'Abriendo Facebook…' : 'Continuar con Facebook'}${fbListo ? '<span class="etq-rec">Recomendado</span>' : prov == null ? '' : '<span class="etq-pronto">No disponible todavía</span>'}</b><small>${prov == null ? 'Revisando…' : fbListo ? 'Inicias sesión con Facebook, eliges o creas el número y listo.' : 'Se activa cuando Meta apruebe este CRM. Mientras tanto, usa los datos de tu app.'}</small></span>${fbListo ? I('chev', 'i ch') : ''}</button>
      <button type="button" class="opc" data-cx-coex="1" ${fbListo && !x.fbCargando ? '' : 'disabled'}><span class="marca wa">${I('wa')}</span><span class="tx"><b>${x.fbCargando && x.coex ? 'Abriendo Meta…' : 'Con tu app de WhatsApp Business'}${fbListo ? '<span class="etq-rec">Escaneas un QR</span>' : prov == null ? '' : '<span class="etq-pronto">No disponible todavía</span>'}</b><small>${prov == null ? 'Revisando…' : fbListo ? 'El número sigue funcionando en tu celular y también en el CRM. Escaneas un QR desde la app.' : 'Se activa cuando Meta apruebe este CRM.'}</small></span>${fbListo ? I('chev', 'i ch') : ''}</button>
      <button type="button" class="opc" data-cx-manual="1"><span class="marca neutra">${LOGO.llave}</span><span class="tx"><b>Con los datos de tu app de Meta</b><small>Si ya tienes una app en developers.facebook.com: pegas su identificador, su clave secreta y un token.</small></span>${I('chev', 'i ch')}</button>
    </div>${x.errorCx ? `<div class="ll-nota">${esc(x.errorCx)}</div>` : ''}`;
  const a = x.app;
  return `<div class="cx-f">
      <label>Identificador de la app (App ID)<input id="cx-app" value="${esc(a.appId)}" inputmode="numeric" autocomplete="off" placeholder="Ej. 1234567890123456"></label>
      <label>Clave secreta de la app<input id="cx-sec" type="password" value="${esc(a.appSecret)}" autocomplete="new-password" placeholder="32 letras y números"></label>
      <label>Token del usuario del sistema<input id="cx-tok" type="password" value="${esc(a.token)}" autocomplete="new-password" placeholder="Empieza por EAA…"><small>Se guarda cifrado y no se vuelve a mostrar.</small></label>
      ${x.pideWaba ? `<label>Identificador de la cuenta de WhatsApp Business<input id="cx-waba" value="${esc(a.wabaId || '')}" inputmode="numeric" autocomplete="off" placeholder="Ej. 1234567890123456"><small>Está en tu app de Meta, en WhatsApp, Configuración de la API, junto al número.</small></label>` : ''}</div>
    <p class="cx-falta" id="cx-falta" role="status"${faltaCx(x) ? '' : ' hidden'}>${esc(faltaCx(x))}</p>
    <details class="cx-ayuda"><summary>Cómo conseguir estos datos</summary><ol>
      <li>En developers.facebook.com crea una app de tipo Negocio (o usa la que ya tienes) y agrégale el producto WhatsApp.</li>
      <li>En Configuración de la app, Básica, copia el identificador de la app y la clave secreta.</li>
      <li>En la configuración de tu negocio en Meta, Usuarios del sistema: crea uno con rol de administrador, asígnale la app y la cuenta de WhatsApp, y genera un token sin vencimiento con los permisos whatsapp_business_management y whatsapp_business_messaging.</li>
      <li>Pega los tres datos aquí. El CRM configura el resto solo.</li></ol></details>
    ${x.errorCx ? `<div class="ll-nota">${esc(x.errorCx)}</div>` : ''}`;
}
/**
 * Conectar con los datos de la app: qué le falta a lo escrito para poder conectar ('' si está completo). Mientras no se
 * ha escrito nada en un campo no se le reclama (salvo con `todo`, que es lo que decide el botón).
 */
function faltaCx(x, todo){
  const a = x.app, id = a.appId.trim(), sec = a.appSecret.trim(), tok = a.token.trim(), waba = (a.wabaId || '').trim();
  const f = [];
  if ((id || todo) && !/^\d{5,30}$/.test(id)) f.push('el identificador de la app son solo números');
  if ((sec || todo) && sec.length !== 32) f.push(sec ? `la clave secreta de Meta tiene 32 caracteres y esta tiene ${sec.length}: cópiala de nuevo en Configuración de la app, Básica, con «Mostrar»` : 'falta la clave secreta');
  if ((tok || todo) && tok.length < 40) f.push(tok ? 'el token parece incompleto: cópialo entero, empieza por EAA' : 'falta el token');
  if (x.pideWaba && (waba || todo) && !/^\d{5,30}$/.test(waba)) f.push('el identificador de la cuenta de WhatsApp Business son solo números');
  if (!f.length) return '';
  const t = f.join('; ');
  return t.charAt(0).toUpperCase() + t.slice(1) + '.';
}
function pintarConexion(){
  const x = st.cx, pasos = pasosHTML(['Cuenta', 'Número', 'Datos', 'Conexión'], x.paso);
  const cab = (titulo, sub) => dlgCab('wa', LOGO.wa, titulo, sub);
  const tel = esc(numeroSel(x).tel || '');
  let h = '';
  if (x.paso === 1) {
    const usables = conexionesWa().filter(cxUsable), eligiendo = !x.nueva && usables.length;
    const listoManual = !faltaCx(x, true);
    const pie = x.avisoCx ? `<button type="button" class="btn pri" data-cx-seguir="1">Elegir el número</button>`
      : eligiendo ? `<button type="button" class="btn pri" data-cx-ir="2" ${x.conexionId ? '' : 'disabled'}>Siguiente</button>`
      : x.manual ? `<button type="button" class="btn atras" data-cx-atrasman="1">Atrás</button><button type="button" class="btn pri" data-cx-conectarcuenta="1" ${listoManual && !x.enviandoCx ? '' : 'disabled'}>${x.enviandoCx ? 'Conectando…' : `${I('check')}Conectar cuenta`}</button>`
      : (usables.length ? `<button type="button" class="btn atras" data-cx-volvercuentas="1">Atrás</button>` : '');
    h = `${cab('Conectar WhatsApp', x.manual ? 'Pega los datos de tu app de Meta: el CRM configura el resto' : 'Conecta tu cuenta de WhatsApp Business y elige el número')}${pasos}${pasoCuenta(x)}<div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button>${pie}</div>`;
  }
  if (x.paso === 2) {
    const cuerpo = x.cargando ? '<p class="muted">Buscando los números de la cuenta de Meta…</p>'
      : x.error ? `<p>No se pudo consultar la cuenta de Meta: ${esc(x.error)}</p><div><button type="button" class="btn" data-cx-reintentar="1">${I('swap')}Volver a intentar</button></div>`
      : !x.numeros.length ? '<p>Esa cuenta de WhatsApp no tiene números libres para conectar.</p><p class="muted">Primero se agrega el número en el administrador de WhatsApp de Meta y se verifica con el código que llega por SMS. Después aparece aquí.</p>'
      : `<p>Estos son los números de la cuenta de WhatsApp que todavía no están en el CRM.</p>
        <div class="cx-list">${x.numeros.map(d => `<button type="button" class="cx-op" role="radio" aria-checked="${x.sel === d.phoneNumberId}" data-cx-sel="${esc(d.phoneNumberId)}" ${d.ok ? '' : 'disabled'}><span class="rd"></span><span><b>${esc(d.tel)}</b><small>${d.nombre ? esc(d.nombre) + ' · ' : ''}${esc(d.estadoMeta || (d.ok ? 'Verificado' : 'Falta verificarlo'))}</small></span></button>`).join('')}</div>
        <p class="muted">¿No aparece el número? Primero se agrega en el administrador de WhatsApp de Meta y se verifica con el código que llega por SMS. Después aparece aquí.</p>`;
    // Otra cuenta de WhatsApp en la misma conexión (28-sep): Meta no siempre dice todas las cuentas del token.
    const cxc = CONEXIONES.find(c => c.id === x.conexionId);
    const otra = x.cargando || !cxc || cxc.modo !== 'manual' ? ''
      : x.otraWaba ? `<div class="cx-otra"><label class="fld">Identificador de la otra cuenta de WhatsApp Business<input id="cx-waba2" value="${esc(x.waba2 || '')}" inputmode="numeric" autocomplete="off" placeholder="Solo números"><small class="muted">Está en tu app de Meta, en WhatsApp, Configuración de la API, junto al número. La cuenta tiene que estar asignada al usuario del sistema con control total.</small></label>
          ${x.errorWaba ? `<div class="ll-nota">${esc(x.errorWaba)}</div>` : ''}<div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" class="btn" data-cx-otra-no="1">Cancelar</button><button type="button" class="btn pri" data-cx-otra-ok="1" ${x.enviandoWaba || !/^\d{5,30}$/.test(x.waba2 || '') ? 'disabled' : ''}>${x.enviandoWaba ? 'Agregando…' : 'Agregar la cuenta'}</button></div></div>`
      : '<button type="button" class="cx-lnk" data-cx-otra="1">¿El número está en otra cuenta de WhatsApp Business? Agrégala</button>';
    h = `${cab('Elige el número', 'Los números de la cuenta que todavía no están en el CRM')}${pasos}${cuerpo}${otra}
    <div class="ft2"><button type="button" class="btn atras" data-cx-ir="1">Atrás</button><button type="button" class="btn pri" data-cx-ir="3" ${x.sel ? '' : 'disabled'}>Siguiente</button></div>`;
  }
  const sinPin = !!(x.coex && numeroSel(x) && numeroSel(x).phoneNumberId === x.coexNum);
  if (x.paso === 3) h = `${cab(`Conectar ${tel}`, sinPin ? 'Ponle nombre y elige el equipo que la atiende' : 'Ponle nombre, elige el equipo que la atiende y confirma con el PIN')}${pasos}
    <div class="cx-f"><label>Nombre de la línea<input id="cx-n" value="${esc(x.nombre)}" placeholder="Ej. Soporte 1"></label>
      <div class="fld">Equipo que la atiende${ddSel('data-cx-eq', EQUIPOS.map(e => [e.n, e.n]), x.eq)}</div>
      ${sinPin ? '<p class="muted" style="margin:0">Este número sigue en tu app de WhatsApp Business: lo que respondas desde el celular también queda en el CRM.</p>' : ''}<label${sinPin ? ' hidden' : ''}>PIN de seguridad de 6 dígitos<input id="cx-pin" value="${esc(x.pin)}" inputmode="numeric" maxlength="6" placeholder="Ej. 482913"><small>Es la verificación en dos pasos del número en Meta. Se usa solo para registrarlo; el CRM no lo guarda.</small></label>
      ${fila('Activar llamadas por WhatsApp', 'Se prenden cuando Meta las active en la línea, con el botón de llamar visible y el horario de atención', `<button type="button" class="tg" role="switch" data-cx-llam="1" aria-checked="${x.llamadas}" aria-label="Activar llamadas"></button>`)}</div>
    <div class="ft2"><button type="button" class="btn atras" data-cx-ir="2">Atrás</button><button type="button" class="btn pri" data-cx-conectar="1" ${x.nombre.trim() && (sinPin || /^\d{6}$/.test(x.pin)) ? '' : 'disabled'}>${I('check')}Conectar</button></div>`;
  if (x.paso === 4) {
    // Maqueta aprobada «CRM · línea conectada» (28-sep): tres estados centrados, sin la barra de pasos.
    const L = x.linea, lim = L ? limiteNum(L.limite) : null, n = numeroSel(x);
    const ic = {ok:`<span class="lc-t ok">${I('check')}</span>`, pend:`<span class="lc-t pend">${I('clock')}</span>`, gira:'<span class="lc-t gira"></span>', espera:'<span class="lc-t espera"></span>', mal:`<span class="lc-t mal">${I('x')}</span>`};
    const tarea = (icono, texto, gris) => `<span class="lc-tarea${gris ? ' gris' : ''}">${icono}${texto}</span>`;
    if (x.estado === 'listo') {
      const eqI = EQUIPOS.findIndex(e => e.n === x.eq), color = colorOk(colorDe(x.eq, eqI));
      const ne = String(n.nombreEstado || '').toUpperCase(), enRevision = ne === 'PENDING_REVIEW';
      const chipNombre = enRevision ? '<span class="lc-chip rev">En revisión</span>' : ne === 'DECLINED' ? '<span class="lc-chip mal">Rechazado</span>' : /APPROVED|AVAILABLE_WITHOUT_REVIEW/.test(ne) ? '<span class="lc-chip ok">Aprobado</span>' : '';
      const cal = CALIDAD_META[String(L.calidad || '').toUpperCase()];
      const filaDato = (t, d, der) => `<div class="lc-fila"><span class="lc-q"><b>${t}</b><small>${d}</small></span>${der}</div>`;
      const sinDato = '<span class="lc-chip">Sin dato todavía</span>';
      h = `<div class="lc-hero"><span class="lc-wa">${LOGO.wa}<span class="lc-badge">${I('check')}</span></span><h3>Línea conectada</h3><p>${esc(x.nombre.trim())} ya recibe y envía mensajes desde el CRM.</p></div>
        <div class="lc-card">
          <div class="lc-cab"><span class="lc-wa2">${LOGO.wa}</span><span class="lc-n"><b>${esc(x.nombre.trim())}</b><small>${tel}</small></span><span class="lc-eq"><i style="background:${color}"></i>${esc(x.eq)}</span></div>
          ${filaDato('Nombre visible', 'Lo que ven las personas en WhatsApp', `<span class="lc-v">${n.nombre ? `<span>${esc(n.nombre)}</span>` : ''}${chipNombre || (n.nombre ? '' : sinDato)}</span>`)}
          ${filaDato('Calidad', 'Meta la calcula con los primeros mensajes', cal ? `<span class="lc-chip ${cal[0] === 'Alta' ? 'ok' : cal[0] === 'Media' ? 'rev' : 'mal'}">${cal[0]}</span>` : sinDato)}
          ${filaDato('Límite diario', 'Conversaciones nuevas que puede abrir al día', lim == null ? sinDato : `<span class="lc-v"><span>${fmtLimite(lim)}</span></span>`)}
        </div>
        <div class="lc-tareas">${tarea(ic.ok, 'Número registrado en la API de Meta')}${tarea(ic.ok, `Los mensajes llegan a la bandeja del equipo ${esc(x.eq)}`)}${x.llamadas ? (metaLlamadas(L) ? tarea(ic.ok, 'Llamadas por WhatsApp activas') : tarea(ic.pend, 'Llamadas por WhatsApp: se prenden cuando Meta las active en la línea', true)) : ''}</div>
        <div class="lc-nota">${I('chat')}<span><b>Haz una prueba:</b> escríbele al ${tel} desde tu WhatsApp y contesta desde el CRM.${enRevision ? ' Mientras Meta aprueba el nombre visible, la persona ve solo el número.' : ''}</span></div>
        <div class="ft2"><button type="button" class="btn" data-lc-lineas="1">Ver en Líneas de WhatsApp</button><button type="button" class="btn pri" data-cerrar-dlg="1">Listo</button></div>`;
    } else if (x.estado === 'error') {
      h = `<div class="lc-hero"><span class="lc-mal"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8v5"/><path d="M12 16.5h.01"/><circle cx="12" cy="12" r="9"/></svg></span><h3>No se pudo conectar la línea</h3><p>Meta no dejó terminar la conexión de ${tel}.</p></div>
        <div class="lc-error"><b>Lo que respondió Meta</b><span>${esc(x.error)}</span></div>
        <div class="lc-card lc-tareas pad">${tarea(ic.mal, 'Registrar el número en la API de Meta')}${tarea(ic.espera, 'Recibir los mensajes en el CRM', true)}</div>
        <div class="ft2 entre"><button type="button" class="btn" data-cx-ir="3">${I('back')}Atrás</button><button type="button" class="btn pri" data-cx-conectar="1"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 5v6h-6"/></svg>Volver a intentar</button></div>`;
    } else {
      h = `<div class="lc-hero"><span class="lc-gira"></span><h3>Conectando la línea</h3><p>${tel} · esto tarda unos segundos, no cierres la ventana.</p></div>
        <div class="lc-card lc-tareas pad">${tarea(ic.gira, 'Registrando el número en la API de Meta…')}${tarea(ic.espera, 'Recibir los mensajes en el CRM', true)}</div>
        <div class="ft2"><button type="button" class="btn pri" disabled>Listo</button></div>`;
    }
    abrirDialogo(h, `ancho dlg-lc${x.estado === 'listo' || x.estado === 'error' ? '' : ' cargando'}`);
    return;
  }
  abrirDialogo(h, 'ancho');
}
/* Paso 4 de «Conectar WhatsApp» (maqueta «CRM · línea conectada», 28-sep). */
document.head.insertAdjacentHTML('beforeend', `<style>
.dlg.dlg-lc{padding:32px 28px 0;gap:20px}
.dlg.dlg-lc.cargando .dlg-cerrar{display:none}
.dlg.dlg-lc .ft2{margin:2px -28px 0;padding:14px 28px}
.dlg.dlg-lc .ft2.entre{justify-content:space-between}
.dlg.dlg-lc .ft2 .btn{height:40px;font-size:13.5px}
.dlg.dlg-lc .ft2 .btn svg{width:16px;height:16px}
.lc-hero{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center}
.dlg.dlg-lc .lc-hero h3{margin:8px 0 0;padding:0;font-size:22px;font-weight:600}
.dlg.dlg-lc .lc-hero p{margin:0;font-size:14px;line-height:1.5;color:#4b5563}
.lc-wa{position:relative;width:60px;height:60px;border-radius:18px;background:#25D366;color:#fff;display:grid;place-items:center}
.lc-wa > svg{width:32px;height:32px}
.lc-badge{position:absolute;right:-6px;bottom:-6px;width:26px;height:26px;border-radius:50%;background:#16a34a;border:3px solid #fff;display:grid;place-items:center;box-sizing:content-box}
.lc-badge svg{width:13px;height:13px;color:#fff;stroke-width:3.2}
.lc-mal{width:60px;height:60px;border-radius:50%;background:#fee2e2;color:#dc2626;display:grid;place-items:center}
.lc-mal svg{width:28px;height:28px}
.lc-gira{width:60px;height:60px;border-radius:50%;border:4px solid #d6e9ff;border-top-color:#0b0b10;box-sizing:border-box;animation:lc-gira .9s linear infinite}
@keyframes lc-gira{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){.lc-gira,.lc-t.gira{animation-duration:2.4s}}
.lc-card{border:1px solid #eef1f5;border-radius:14px;background:#f8fafc;display:flex;flex-direction:column}
.lc-card.pad{padding:16px;gap:12px}
.lc-cab{display:flex;align-items:center;gap:12px;padding:14px 16px}
.lc-wa2{width:40px;height:40px;border-radius:12px;background:#fff;border:1px solid #eef1f5;color:#25D366;display:grid;place-items:center;flex:none;box-sizing:border-box}
.lc-wa2 svg{width:22px;height:22px}
.lc-n{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0}
.lc-n b{font-size:15px;font-weight:600;color:var(--ink)}
.lc-n small{font-size:13px;color:#6b7280}
.lc-eq{display:inline-flex;align-items:center;gap:7px;height:28px;padding:0 12px;border:1px solid #e5e9f0;border-radius:999px;background:#fff;font-size:12.5px;color:var(--ink);white-space:nowrap}
.lc-eq i{width:9px;height:9px;border-radius:50%;display:inline-block}
.lc-fila{display:flex;align-items:center;gap:16px;padding:12px 16px;border-top:1px solid #eef1f5}
.lc-q{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0}
.lc-q b{font-size:13px;font-weight:600;color:#374151}
.lc-q small{font-size:12px;color:#6b7280}
.lc-v{display:flex;align-items:center;gap:8px;font-size:13.5px;font-weight:400;color:var(--ink)}
.lc-chip{font-size:11.5px;font-weight:500;color:#4b5563;background:#eef1f5;border-radius:999px;padding:3px 10px;white-space:nowrap}
.lc-chip.rev{color:#92400e;background:#fef3c7}
.lc-chip.ok{color:#166534;background:#dcfce7}
.lc-chip.mal{color:#991b1b;background:#fee2e2}
.lc-tareas{display:flex;flex-direction:column;gap:10px}
.lc-tarea{display:flex;align-items:center;gap:10px;font-size:13.5px;color:var(--ink)}
.lc-tarea.gris{color:#4b5563}
.lc-card .lc-tarea.gris{color:#6b7280}
.lc-t{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;flex:none;box-sizing:border-box}
.lc-t svg{width:13px;height:13px;stroke-width:3}
.lc-t.ok{background:#dcfce7;color:#16a34a}
.lc-t.pend{background:#f1f5f9;color:#6b7280}
.lc-t.pend svg{stroke-width:2.2}
.lc-t.mal{background:#fee2e2;color:#dc2626}
.lc-t.mal svg{width:12px;height:12px}
.lc-t.gira{border:2.5px solid #d6e9ff;border-top-color:#0b0b10;animation:lc-gira .9s linear infinite}
.lc-t.espera{border:2px dashed #cbd5e1}
.lc-nota{display:flex;gap:12px;align-items:flex-start;padding:14px 16px;border-radius:12px;background:#eef6ff;color:#1e3a5f;font-size:13px;line-height:1.55}
.lc-nota > svg{width:18px;height:18px;flex:none;margin-top:1px;color:#0b0b10}
.lc-nota b{font-weight:600}
.lc-error{display:flex;flex-direction:column;gap:6px;padding:14px 16px;border:1px solid #fecaca;border-radius:12px;background:#fef2f2}
.lc-error b{font-size:12px;font-weight:600;color:#991b1b}
.lc-error span{font-size:13.5px;line-height:1.55;color:#7f1d1d}
</style>`);
document.getElementById('ov-x').addEventListener('click', e => { if (!e.target.closest('[data-lc-lineas]')) return; cerrarDialogo(); st.pagina = 'cfg-lineas'; render(); });
document.getElementById('ov-x').addEventListener('click', e => {
  const x = st.cx; if (!x || x.paso !== 2) return;
  if (e.target.closest('[data-cx-otra]')) { x.otraWaba = true; x.errorWaba = ''; pintarConexion(); setTimeout(() => { const i = document.getElementById('cx-waba2'); if (i) i.focus(); }, 30); return; }
  if (e.target.closest('[data-cx-otra-no]')) { x.otraWaba = false; x.waba2 = ''; x.errorWaba = ''; pintarConexion(); return; }
  const ok = e.target.closest('[data-cx-otra-ok]'); if (!ok || ok.disabled) return;
  x.enviandoWaba = true; x.errorWaba = ''; pintarConexion();
  crmApi('POST', `/crm/conexiones/${encodeURIComponent(x.conexionId)}/cuentas`, {wabaId:(x.waba2 || '').trim()})
    .then(c => { mezclarConexion(c); x.otraWaba = false; x.waba2 = ''; toast('Cuenta de WhatsApp agregada'); x.sel = null; buscarNumeros(x); })
    .catch(err => { x.errorWaba = err.message || 'Meta no respondió'; })
    .finally(() => { x.enviandoWaba = false; if (st.cx === x && !document.getElementById('ov-x').hidden) pintarConexion(); });
});
document.getElementById('ov-x').addEventListener('input', e => {
  if (e.target.id !== 'cx-waba2' || !st.cx) return;
  e.target.value = e.target.value.replace(/\D/g, ''); st.cx.waba2 = e.target.value;
  const b = document.querySelector('[data-cx-otra-ok]'); if (b) b.disabled = st.cx.enviandoWaba || !/^\d{5,30}$/.test(st.cx.waba2);
});
function mezclarConexion(c){ const i = CONEXIONES.findIndex(x => x.id === c.id); if (i >= 0) CONEXIONES[i] = c; else CONEXIONES.push(c); }
function conectarCuenta(x){
  x.enviandoCx = true; x.errorCx = ''; pintarConexion();
  crmApi('POST', '/crm/conexiones/whatsapp', {appId:x.app.appId.trim(), appSecret:x.app.appSecret.trim(), token:x.app.token.trim(), ...(x.pideWaba ? {wabaId:(x.app.wabaId || '').trim()} : {})})
    .then(c => {
      mezclarConexion(c); x.conexionId = c.id; x.app = {appId:'', appSecret:'', token:'', wabaId:''}; x.pideWaba = false;
      if (c.estado === 'error') { x.avisoCx = c; toast('Cuenta conectada; falta el aviso de mensajes'); return; }
      toast('Cuenta de Meta conectada'); x.paso = 2; x.sel = null; buscarNumeros(x);
    })
    // Meta no dijo la cuenta del token: se pide su identificador (conexiones.ts, conectarWhatsappManual).
    .catch(err => { x.errorCx = err.message || 'Meta no respondió'; if ((err.campos || []).includes('wabaId') || /identificador de la cuenta de WhatsApp Business/.test(err.message || '')) x.pideWaba = true; })
    .finally(() => { x.enviandoCx = false; if (st.cx === x && !document.getElementById('ov-x').hidden) pintarConexion(); });
}
/* El botón de Meta (registro integrado de WhatsApp): el SDK de Facebook abre la ventana de Meta y devuelve un código,
   la cuenta de WhatsApp y el número elegido. El CRM cambia el código por el acceso (POST /crm/conexiones/whatsapp/meta). */
let fbSdk = null;
function cargarSdkFacebook(appId){
  if (fbSdk) return fbSdk;
  fbSdk = new Promise((ok, mal) => {
    window.fbAsyncInit = () => { try { FB.init({appId, autoLogAppEvents:true, xfbml:false, version:'v21.0'}); ok(); } catch (e) { mal(e); } };
    const s = document.createElement('script'); s.src = 'https://connect.facebook.net/es_LA/sdk.js'; s.async = true; s.crossOrigin = 'anonymous';
    s.onerror = () => { fbSdk = null; mal(new Error('No se pudo abrir Meta. Revisa la conexión a internet o si un bloqueador lo impide')); };
    document.head.appendChild(s);
  });
  return fbSdk;
}
function conectarConFacebook(x, coex){
  const p = x.prov; if (!p || !p.listo) return;
  x.coex = !!coex; x.fbCargando = true; x.errorCx = ''; pintarConexion();
  let sesion = {};
  const oir = ev => {
    if (!/(^|\.)facebook\.com$/.test(new URL(ev.origin).hostname)) return;
    try { const d = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data; if (d && d.type === 'WA_EMBEDDED_SIGNUP') {
      if (d.event === 'FINISH' || d.event === 'FINISH_ONLY_WABA' || d.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING') sesion = d.data || {};
      if (d.event === 'CANCEL') x.errorCx = d.data && d.data.current_step ? 'Se cerró la ventana de Meta antes de terminar.' : 'Se canceló la conexión con Meta.';
    } } catch { /* otro mensaje de Facebook */ }
  };
  window.addEventListener('message', oir);
  cargarSdkFacebook(p.appId).then(() => new Promise(ok => FB.login(r => ok(r), {config_id:p.configId, response_type:'code', override_default_response_type:true, extras:{setup:{}, featureType:coex ? 'whatsapp_business_app_onboarding' : '', sessionInfoVersion:'3'}})))
    .then(r => {
      const code = r && r.authResponse && r.authResponse.code;
      if (!code) throw new Error(x.errorCx || 'No se terminó la conexión con Meta.');
      // El número llega por el mensaje de Meta; a veces después de la respuesta: se le da un momento.
      return new Promise(ok => setTimeout(ok, sesion.waba_id ? 0 : 800)).then(() =>
        crmApi('POST', '/crm/conexiones/whatsapp/meta', {code, wabaId:sesion.waba_id || '', phoneNumberId:sesion.phone_number_id || '', coexistencia:!!coex}));
    })
    .then(c => { mezclarConexion(c); x.conexionId = c.id; x.preferido = c.phoneNumberId || null; x.coexNum = coex ? c.phoneNumberId || null : null; x.paso = 2; x.sel = null; toast(coex ? 'Tu app de WhatsApp Business quedó conectada' : 'Cuenta de WhatsApp conectada con Meta'); buscarNumeros(x); })
    .catch(err => { x.errorCx = err.message || 'No se pudo conectar con Meta'; })
    .finally(() => { window.removeEventListener('message', oir); x.fbCargando = false; if (st.cx === x && !document.getElementById('ov-x').hidden) pintarConexion(); });
}
function conectarLinea(x){
  const n = numeroSel(x);
  x.paso = 4; x.estado = 'conectando'; x.error = ''; pintarConexion();
  crmApi('POST', '/crm/lineas', {conexionId:x.conexionId, phoneNumberId:n.phoneNumberId, wabaId:n.wabaId, nombre:x.nombre.trim(), equipo:x.eq, pin:x.pin, llamadas:x.llamadas, coexistencia:!!(x.coex && n.phoneNumberId === x.coexNum)})
    .then(L => {
      x.linea = L; x.estado = 'listo';
      if (!LINEAS.some(l => l.id === L.id)) LINEAS.push(L);
      ajLinea(L.id, x.eq);
      const c = LLAM.lineas[L.id]; if (x.llamadas && !c.on) { c.on = true; c.desde = new Date().toISOString(); }
      if (st.pagina && st.pagina.startsWith('cfg-')) render(); toast(`Línea conectada: ${x.nombre.trim()}`);
    })
    .catch(err => { x.estado = 'error'; x.error = err.message || 'Meta no respondió'; })
    .finally(() => { if (st.cx === x && !document.getElementById('ov-x').hidden) pintarConexion(); });
}
document.getElementById('ov-x').addEventListener('click', e => {
  const x = st.cx; if (!x) return; const t = e.target;
  const cp = t.closest('[data-cx-copiar]'); if (cp) { copiar(cp.dataset.cxCopiar, 'Copiado'); return; }
  if (t.closest('[data-cx-reintentar]')) { buscarNumeros(x); pintarConexion(); return; }
  const cu = t.closest('[data-cx-cuenta]'); if (cu) { x.conexionId = cu.dataset.cxCuenta; pintarConexion(); return; }
  if (t.closest('[data-cx-nueva]')) { x.nueva = true; x.manual = false; x.errorCx = ''; pintarConexion(); return; }
  if (t.closest('[data-cx-volvercuentas]')) { x.nueva = false; x.errorCx = ''; pintarConexion(); return; }
  if (t.closest('[data-cx-manual]')) { x.manual = true; x.errorCx = ''; pintarConexion(); return; }
  if (t.closest('[data-cx-atrasman]')) { x.manual = false; x.errorCx = ''; pintarConexion(); return; }
  const fb = t.closest('[data-cx-fb]'); if (fb && !fb.disabled) { conectarConFacebook(x); return; }
  const co = t.closest('[data-cx-coex]'); if (co && !co.disabled) { conectarConFacebook(x, true); return; }
  const cc = t.closest('[data-cx-conectarcuenta]'); if (cc && !cc.disabled) { conectarCuenta(x); return; }
  if (t.closest('[data-cx-seguir]')) { x.avisoCx = null; x.paso = 2; x.sel = null; buscarNumeros(x); pintarConexion(); return; }
  const s = t.closest('[data-cx-sel]'); if (s && !s.disabled) { x.sel = s.dataset.cxSel; pintarConexion(); return; }
  const ir = t.closest('[data-cx-ir]'); if (ir && !ir.disabled) { const p = +ir.dataset.cxIr; if (p === 2 && x.paso === 1) { x.sel = null; buscarNumeros(x); } x.paso = p; pintarConexion(); return; }
  const eq = t.closest('[data-cx-eq]'); if (eq) { x.eq = eq.dataset.cxEq; pintarConexion(); return; }
  if (t.closest('[data-cx-llam]')) { x.llamadas = !x.llamadas; pintarConexion(); return; }
  const cn = t.closest('[data-cx-conectar]'); if (cn && !cn.disabled && x.estado !== 'conectando') { conectarLinea(x); return; }
});
// Desconectar una cuenta de Meta (confirmado en el diálogo): sus líneas salen del CRM; las conversaciones se quedan.
document.getElementById('ov-x').addEventListener('click', e => {
  const b = e.target.closest('[data-cxm-quitarok]'); if (!b || b.disabled) return; b.disabled = true;
  crmApi('DELETE', `/crm/conexiones/${b.dataset.cxmQuitarok}`)
    .then(() => { const i = CONEXIONES.findIndex(c => c.id === b.dataset.cxmQuitarok); if (i >= 0) CONEXIONES.splice(i, 1); cerrarDialogo(); render(); toast('Cuenta de Meta desconectada'); })
    .catch(err => { b.disabled = false; toast(err.message || 'No se pudo desconectar'); });
});
document.getElementById('ov-x').addEventListener('input', e => {
  const x = st.cx; if (!x) return;
  if (e.target.id === 'cx-n') { x.nombre = e.target.value; }
  if (e.target.id === 'cx-pin') { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); x.pin = e.target.value; }
  if (e.target.id === 'cx-app') { e.target.value = e.target.value.replace(/\D/g, ''); x.app.appId = e.target.value; }
  if (e.target.id === 'cx-sec') x.app.appSecret = e.target.value;
  if (e.target.id === 'cx-tok') x.app.token = e.target.value;
  if (e.target.id === 'cx-waba') { e.target.value = e.target.value.replace(/\D/g, ''); x.app.wabaId = e.target.value; }
  const b = document.querySelector('[data-cx-conectar]'); if (b && x.paso === 3) b.disabled = !(x.nombre.trim() && ((x.coex && numeroSel(x) && numeroSel(x).phoneNumberId === x.coexNum) || /^\d{6}$/.test(x.pin)));
  const bc = document.querySelector('[data-cx-conectarcuenta]'); if (bc) bc.disabled = x.enviandoCx || !!faltaCx(x, true);
  // Qué le falta a cada dato, en vivo: el botón deshabilitado sin explicación no dice nada (6-oct).
  const fa = document.getElementById('cx-falta'); if (fa) { const t = faltaCx(x); fa.textContent = t; fa.hidden = !t; }
});

/* Registro de cada llamada en la conversación */
const burbujaBase = burbuja;
burbuja = function(m){
  if (!m.call) return burbujaBase(m);
  const k = m.call, perdida = k.estado !== 'ok';
  const titulo = k.estado === 'buzon' ? 'Llamada perdida · dejó un mensaje de voz' : k.estado === 'perdida' ? 'Llamada perdida' : k.estado === 'nocontesto' ? 'Llamada por WhatsApp · no contestó' : `${k.dir === 'in' ? 'Llamada entrante' : 'Llamada saliente'} por WhatsApp · ${mmss(k.dur || 0)}`;
  const audio = k.audio && /^https:\/\//.test(k.audio) ? `<audio controls preload="none" src="${esc(k.audio)}" style="width:100%;margin-top:6px"></audio>` : '';
  return `<div class="callrec ${perdida ? 'perdida' : ''}"><div class="t">${I('phone')}${titulo}</div>
    ${k.estado === 'ok' ? `<div class="r"><span>Atendió</span><span>${esc(k.quien)}</span></div>` : ''}
    <div class="r"><span>Línea</span><span>${esc(lineaDe(k.linea).n)}</span></div>
    ${k.sinGrabar ? `<div class="r"><span>Grabación</span><span>No se grabó: ${esc(k.sinGrabar)}</span></div>` : ''}
    ${audio}${k.trans ? `<details><summary>${k.estado === 'buzon' ? 'Ver lo que dijo' : 'Ver transcripción'}</summary>${k.trans.map(([q, x]) => `<p>${q ? `<b>${esc(q)}:</b> ` : ''}${esc(x)}</p>`).join('')}</details>` : ''}
    <div class="ft">${m.h || ''}</div></div>`;
};

/* Botón de llamar de la conversación: dice el motivo real cuando no se puede llamar */
function motivoSinLlamar(c){
  const l = LINEAS.find(x => x.id === c.linea);
  if (!l) return 'Esta conversación no tiene una línea de WhatsApp conectada.';
  if (!metaLlamadas(l)) return `Las llamadas por WhatsApp todavía no están activadas en Meta para la línea ${l.n}.`;
  if (!(LLAM.lineas[l.id] || {}).on) return `Las llamadas están apagadas en la línea ${l.n}.`;
  return 'El CRM todavía no tiene con qué hacer la llamada desde el navegador.';
}
document.addEventListener('click', e => {
  if (!e.target.closest('#b-call')) return;
  e.stopPropagation();
  const c = CONV.find(x => x.id === st.sel); if (!c) return;
  if (c.canal !== 'wa') { toast(`Las llamadas van por WhatsApp; ${(CANALES[c.canal] || {n:'este canal'}).n} no permite llamar`); return; }
  const hl = horarioLegal();
  if (llamadasActivas(c.linea) && !hl.ok) { abrirDialogo(`<h3>Ahora no se puede llamar a ${esc(c.n)}</h3><p>${esc(hl.motivo)} La Ley 2300 solo permite llamadas de venta de lunes a viernes de 7 a. m. a 7 p. m. y los sábados de 8 a. m. a 3 p. m., nunca domingos ni festivos.</p><p class="muted">Si el cliente te llama, sí puedes contestar: esa restricción es solo para las llamadas que hace el asesor.</p><div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cerrar</button><button type="button" class="btn pri" data-ll-recordar="${esc(hl.siguiente)}" data-para="${hl.para || ''}">${I('bell')}Recordarme ${esc(hl.siguiente)}</button></div>`); return; }
  if (llamadasActivas(c.linea) && PD.rneOn && c.rne && !c.aut) { abrirDialogo(`<h3>No se puede llamar a ${esc(c.n)}</h3><p>Su número está en el Registro de Números Excluidos de la CRC y no ha autorizado a la empresa. No se le puede llamar ni incluir en difusiones.</p><p class="muted">Como escribió primero, sí le puedes responder por el chat. Si autoriza sus datos, se le puede llamar.</p><div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Entendido</button><button type="button" class="btn pri" data-ll-aut="1">${I('send')}Pedirle autorización</button></div>`); return; }
  abrirDialogo(`<h3>Llamar a ${esc(c.n)}</h3><p>${esc(motivoSinLlamar(c))} Mientras tanto, escríbele por el chat.</p>${st.rol === 'l' ? '<p class="muted">Las llamadas de cada línea se ven en Ajustes del CRM, Líneas de WhatsApp.</p>' : ''}<div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Entendido</button></div>`);
}, true);
