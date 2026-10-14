/* ── Por responder / Respondidas (maqueta aprobada el 6-oct): debajo de «Mías · Sin asignar · Todas», dos botones.
   Por responder: el cliente escribió y nadie le ha contestado (la conversación espera respuesta). Respondidas: la
   última palabra la tiene el equipo. Al responder, el chat pasa a Respondidas; si el cliente vuelve a escribir, la
   espera vuelve y regresa sola a Por responder. Solo con las abiertas; en Pendientes y Finalizadas no filtra. ── */
st.resp = 'por';
const respEsPor = c => !!c.esperaMin;
const respActivo = () => !st.menciones && (st.est || 'abiertas') === 'abiertas';
const visiblesSinResp = visibles;
// Al responder, la conversación espera 10 segundos antes de pasar a Respondidas (14-oct): así se alcanza a escribir y
// mandar otro mensaje. Escribir o enviar de nuevo reinicia la espera. Luego pasa a la siguiente por responder o, si no
// hay ninguna, el chat queda vacío.
const RESP_ESPERA = 10000;
let respFija = null, respReloj = null;
const respFiltrar = (L, fija) => respActivo() ? L.filter(c => (fija && respFija === c.id && c.id === st.sel) || (st.resp === 'por') === respEsPor(c)) : L;
function respSoltar(){
  clearTimeout(respReloj); respReloj = null;
  const id = respFija; if (!id) return;
  // Si quedó algo escrito sin enviar, no se le quita el chat: espera otro rato.
  if (st.sel === id && ta.value.trim()) { respEsperar(id); return; }
  respFija = null;
  if (st.sel === id && !visibles().some(c => c.id === id)) { const p = visibles()[0]; st.sel = p ? p.id : 0; }
  render();
}
function respEsperar(id){ respFija = id; clearTimeout(respReloj); respReloj = setTimeout(respSoltar, RESP_ESPERA); }
// Mientras se escribe en esa conversación, la espera vuelve a empezar.
ta.addEventListener('input', () => { if (respFija && respFija === st.sel) respEsperar(respFija); });
// Cubre todo lo que responde (texto, archivo, nota de voz, plantilla) y la confirmación del API: si la conversación abierta
// estaba por responder y deja de estarlo, empieza la espera en vez de desaparecer de una.
let respSelEraPor = null;
visibles = function(){
  const sel = CONV.find(x => x.id === st.sel);
  if (respActivo() && st.resp === 'por' && sel) {
    if (respEsPor(sel)) respSelEraPor = sel.id;
    else if (respSelEraPor === sel.id && respFija !== sel.id) { respSelEraPor = null; respEsperar(sel.id); }
  }
  return respFiltrar(visiblesSinResp.apply(this, arguments), true);
};
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
  st.resp = b.dataset.rp; const p = respFiltrar(visiblesSinResp(), false)[0]; if (p) st.sel = p.id; render();
}, true);
// Al responder deja de esperar aquí mismo (el API lo confirma con la conversación actualizada).
document.getElementById('enviar').addEventListener('click', () => {
  if (st.modo === 'n') return; const c = CONV.find(x => x.id === st.sel); if (!c || !ta.value.trim()) return;
  setTimeout(() => { if (c.msgs.some(m => m.out != null && m.h === 'ahora')) { if (respActivo() && st.resp === 'por') respEsperar(c.id); c.esperaMin = 0; c.espera = null; render(); } }, 0);
}, true);
