/* ── Tema NexCode97 (maquetas aprobadas el 3-oct: «NexCode97 CRM · Bandeja» y «Panel del contacto»): barra lateral
   negra, fondos claros con las columnas como tarjetas, amarillo de la marca para lo principal y negro para lo
   seleccionado. Va en su propio <style> al final del <head> para quedar por encima de los estilos que agregan
   57-celular-menu y 68-marco; los selectores llevan #app para ganar sin !important. Las tarjetas solo en escritorio:
   en celular el CRM conserva su diseño de una columna. ── */
(() => {
  const css = `
#app{--nx-amarillo:#FFF200;--nx-amarillo-2:#e6d900;--nx-negro:#0b0b10;--nx-negro-2:#15151c;--nx-negro-3:#22222c;--nx-gris:#f2f4f6;--nx-violeta:#7c3aed;--nx-txt:#c9c9d3;--nx-mut:#7d7d8a}
:focus-visible{outline-color:#7c3aed}

/* ── Barra lateral negra (también como cajón en celular) ── */
#app .nav{background:var(--nx-negro);border-right:0;color:var(--nx-txt);scrollbar-color:var(--nx-negro-3) transparent}
#app .nav .brand{color:#fff}
#app .nav .nueva-conv{height:40px;border-radius:12px;border-color:var(--nx-amarillo);background:var(--nx-amarillo);color:var(--nx-negro);font-weight:700}
#app .nav .nueva-conv:hover{background:var(--nx-amarillo-2);border-color:var(--nx-amarillo-2)}
#app .nav .sec{color:var(--nx-mut);text-transform:uppercase;letter-spacing:.08em;border-bottom:0}
/* Sin «Canales» ni «Líneas de WhatsApp» en la barra (5-oct). Quedan en el HTML porque el código los sigue llenando. */
#app .nav div:has(> #canales),#app .nav #sec-lineas{display:none}
#app .nav li button{color:var(--nx-txt);position:relative}
#app .nav li button:hover{background:var(--nx-negro-2)}
#app .nav li button[aria-current="true"]{background:var(--nx-negro-3);color:#fff}
#app .nav li button[aria-current="true"]::before{content:"";position:absolute;left:0;top:9px;bottom:9px;width:3px;border-radius:3px;background:var(--nx-amarillo)}
#app .nav li button .n,#app .nav li button .tw{color:var(--nx-mut)}
#app .nav li button[aria-current="true"] .n{color:#fff}
#app .nav .me{border-top-color:var(--nx-negro-3)}
#app .nav .me .cu-nom,#app .nav .me b{color:#fff}
#app .nav .me .cu-fila.mc-cuenta:hover,#app .nav .me .cu-fila.mc-cuenta[aria-expanded="true"]{background:var(--nx-negro-2)}
#app .nav .me .cu-est{background:var(--nx-negro-2);border-color:var(--nx-negro-3);color:#e4e4ea}
#app .nav .me .cu-est:hover{border-color:#3a3a46}
#app .nav .me .cu-est #me-e{color:#e4e4ea;font-size:13px}
#app .nav .me .cu-est[aria-expanded="true"]{border-color:var(--nx-amarillo);box-shadow:0 0 0 3px rgba(255,242,0,.25)}
#app .nav .me #b-ajustes{background:var(--nx-negro-2);border:1px solid var(--nx-negro-3);color:var(--nx-txt)}
#app .nav .me #b-ajustes:hover{background:var(--nx-negro-3);color:#fff}
#app .nav .brand .mc-campana{color:var(--nx-txt)}
#app .nav .brand .mc-campana:hover,#app .nav .brand .mc-campana[aria-expanded="true"]{background:var(--nx-negro-2)}
#app .nav .cj-cerrar{color:var(--nx-txt)}

/* ── Lista ── */
#app .list-h{padding-bottom:12px;border-bottom:1px solid var(--line2)}
#app .tabs{gap:4px;border-bottom:0;background:#f6f7f9;border-radius:11px;padding:3px}
#app .tabs button{flex:1;justify-content:center;height:30px;padding:0;margin:0;border-bottom:0;border-radius:9px;color:var(--ink2)}
#app .tabs button[aria-pressed="true"]{background:var(--nx-negro);color:#fff}
#app .tabs button[aria-pressed="true"] .n{background:rgba(255,255,255,.16);color:#fff}
#app .search:focus-within{border-color:var(--nx-negro)}
#app .it[aria-current="true"]{background:#fffde0;box-shadow:inset 0 0 0 1px #f2e86b}
#app .it .tj-cnt{background:var(--nx-violeta)}
#app .it.unread .tj-l1 time{color:var(--nx-violeta)}

/* ── Chat ── */
#app .subtabs button[aria-pressed="true"]{color:var(--ink);border-bottom-color:var(--nx-negro)}
#app .m.out{background:var(--nx-negro);color:#f4f4f6}
#app .m.out .ft .leido{color:var(--nx-amarillo)}
#app .btn.pri{background:var(--nx-amarillo);border-color:var(--nx-amarillo);color:var(--nx-negro);font-weight:600}
#app .btn.pri:hover{background:var(--nx-amarillo-2);border-color:var(--nx-amarillo-2);color:var(--nx-negro)}

/* ── Panel del contacto: foto, nombre y ticket centrados; acciones en círculos; datos en un bloque gris ── */
#app .ptitle{font-size:11.5px;letter-spacing:.07em;text-transform:uppercase;color:var(--ink3);border-bottom:0}
#app .ptitle svg{color:var(--ink3)}
#app .contact{padding-top:6px}
#app .pc-who{flex-direction:column;text-align:center;gap:10px}
#app .pc-who .av{width:64px;height:64px;font-size:20px}
#app .pc-who small{margin-top:3px;font-size:12.5px;color:var(--ink2)}
#app .pc-who small strong{font-weight:600;color:var(--ink)}
#app .pc-acts{gap:8px}
#app .pc-act{height:auto;border:0;background:none;gap:5px;font-weight:500}
#app .pc-act svg{width:38px;height:38px;padding:11px;border-radius:50%;background:#f6f7f9;color:var(--ink);box-sizing:border-box}
#app .pc-act:hover{background:none}
#app .pc-act:hover svg{background:var(--nx-negro);color:var(--nx-amarillo)}
#app .pc-act.pri{background:none;color:var(--ink2)}
#app .pc-act.pri svg{background:var(--nx-amarillo);color:var(--nx-negro)}
#app .pc-act.on{background:none;color:var(--ink2)}
#app .pc-act.on svg{background:var(--nx-negro);color:var(--nx-amarillo)}
#app .pc-info{background:#f6f7f9;border-radius:14px;padding:4px 12px}
#app .pc-ps[aria-expanded="true"]{border-color:var(--nx-negro);box-shadow:0 0 0 3px rgba(255,242,0,.45)}

/* ── Escritorio: barra negra a todo lo alto y las columnas como tarjetas sobre un fondo claro redondeado ── */
@media (min-width:1001px){
  html,body{background:var(--nx-negro,#0b0b10)}
  #app.app{--navw:236px;position:relative;background:var(--nx-negro)}
  #app.app::before{content:"";position:absolute;top:8px;right:8px;bottom:8px;left:var(--navw);background:var(--nx-gris);border-radius:20px}
  #app > .list,#app > .chat,#app > .panel,#app > .page{position:relative;z-index:1;margin:18px 5px;border:1px solid #e5e8ec;border-radius:16px;background:#fff;min-height:0}
  #app > .list,#app > .chat{overflow:hidden}
  #app > .list{margin-left:18px}
  #app > .panel{margin-right:18px}
  #app.app.pg > .page{margin:18px}
  #app.app.panel-min > .panel{margin:0;border:0}
  #app.app.panel-min > .chat{margin-right:18px}
}
@media (min-width:1001px) and (max-width:1360px){
  #app.app{--navw:220px}
  #app > .chat{margin-right:18px}
}`;
  const st = document.createElement('style');
  st.id = 'tema-nexcode97';
  st.textContent = css;
  document.head.append(st);
})();
