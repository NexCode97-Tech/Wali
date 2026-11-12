/* ── Por responder / Respondidas (maqueta aprobada el 6-oct): debajo de «Mías · Sin asignar · Todas», dos botones.
   Por responder: el cliente escribió y nadie le ha contestado (la conversación espera respuesta). Respondidas: la
   última palabra la tiene el equipo. Al responder, el chat pasa a Respondidas; si el cliente vuelve a escribir, la
   espera vuelve y regresa sola a Por responder. Solo con las abiertas; en Pendientes y Finalizadas no filtra. ── */
st.resp = 'por';
const respEsPor = c => !!c.esperaMin;
const respActivo = () => !st.menciones && (st.est || 'abiertas') === 'abiertas';
const visiblesSinResp = visibles;
// Al responder, la conversación pasa a Respondidas de una vez (sale de la lista de Por responder y cambian los
// contadores), pero el chat abierto NO se cierra (10-nov, reporte de soporte S-1002): sigue en pantalla hasta que la
// persona abra otra conversación o lo cierre. Antes se esperaban 10 segundos y luego saltaba a la siguiente, y quien
// se quedaba consultando algo antes de seguir perdía el chat. El chat abierto lo manda st.sel, no la lista.
// 11-nov (seguía pasando): chat() abre la que esté en st.sel solo si sigue en la lista; al pasar a Respondidas ya no
// estaba y la pantalla quedaba en «Elige una conversación» hasta que llegaba la actualización del servidor. Ahora,
// mientras se pinta el chat, la conversación que ya estaba abierta se sigue contando aunque haya salido de este filtro.
// La lista y los contadores no la ven: solo el chat.
let respAbierta = null, respEnChat = false;
const respFiltrar = L => respActivo() ? L.filter(c => (st.resp === 'por') === respEsPor(c) || (respEnChat && c.id === respAbierta && c.id === st.sel)) : L;
visibles = function(){ return respFiltrar(visiblesSinResp.apply(this, arguments)); };
const chatSinResp = chat;
chat = function(){ respEnChat = true; try { return chatSinResp.apply(this, arguments); } finally { respEnChat = false; respAbierta = document.getElementById('app').classList.contains('sinchat') ? null : st.sel; } };
document.head.insertAdjacentHTML('beforeend', `<style>
.rp-seg{display:flex;gap:6px;margin-top:10px}
.rp-seg[hidden]{display:none}
.rp-seg button{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:8px;height:32px;border-radius:9px;border:1px solid #e5e9f0;background:#fff;font:inherit;font-size:12.5px;font-weight:500;color:#4b5563;cursor:pointer;white-space:nowrap}
.rp-seg button[aria-pressed="true"]{border-color:#0b0b10;color:#0b0b10;box-shadow:inset 0 0 0 1px #0b0b10}
.rp-seg button .n{min-width:20px;height:20px;border-radius:999px;display:inline-grid;place-items:center;font-size:11px;font-weight:600;padding:0 6px;background:#f1f5f9;color:#4b5563}
.rp-seg button[data-rp="por"] .n{background:#FFD21F;color:#0b0b10}
</style>`);
function respPintar(){
  const tabs = document.getElementById('tabs'); if (!tabs) return;
  let s = document.querySelector('.rp-seg');
  if (!s) { tabs.insertAdjacentHTML('afterend', '<div class="rp-seg" role="group" aria-label="Por responder o respondidas"></div>'); s = document.querySelector('.rp-seg'); }
  s.hidden = !respActivo(); if (s.hidden) return;
  const base = visiblesSinResp(), por = base.filter(respEsPor).length;
  s.replaceChildren();
  s.insertAdjacentHTML('beforeend', `<button type="button" data-rp="por" aria-pressed="${st.resp === 'por'}">Por responder<span class="n">${por}</span></button><button type="button" data-rp="resp" aria-pressed="${st.resp === 'resp'}">Respondidas<span class="n">${base.length - por}</span></button>`);
}
const navSinResp = nav;
nav = function(){ const r = navSinResp.apply(this, arguments); respPintar(); return r; };
document.addEventListener('click', e => {
  const b = e.target.closest('.rp-seg [data-rp]'); if (!b) return;
  st.resp = b.dataset.rp; const p = respFiltrar(visiblesSinResp())[0]; if (p) st.sel = p.id; render();
}, true);
// Al responder deja de esperar aquí mismo (el API lo confirma con la conversación actualizada).
document.getElementById('enviar').addEventListener('click', () => {
  if (st.modo === 'n') return; const c = CONV.find(x => x.id === st.sel); if (!c || !ta.value.trim()) return;
  setTimeout(() => { if (c.msgs.some(m => m.out != null && m.h === 'ahora')) { c.esperaMin = 0; c.espera = null; render(); } }, 0);
}, true);
