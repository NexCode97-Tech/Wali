/* Plantillas de WhatsApp (maquetas aprobadas el 20-oct en «Maquetas Wali»: «Plantillas» y «Nueva plantilla»).
   La lista muestra cada plantilla como burbuja de chat, sus líneas, su estado y un menú ⋯ con Editar y Eliminar.
   Cada plantilla es de unas líneas: solo se envía desde ellas (plantillas.ts, ajuste plantillasLineas).
   El formulario arma el mensaje en tres bloques y lo muestra como llega en WhatsApp, en un iPhone.
   Todo lo que viene de los datos pasa por esc() antes de pintarse, como en el resto de la pantalla. */
document.head.insertAdjacentHTML('beforeend', `<style>
.tp-cab{margin-bottom:0}
.tp-costos{display:flex;gap:8px;flex-wrap:nowrap;margin-top:12px;overflow-x:auto;scrollbar-width:none}
.tp-costos > *{flex:none}
.tp-cab > div{max-width:none}
.tp-costo{display:inline-flex;align-items:center;gap:8px;height:28px;padding:0 11px;border-radius:999px;border:1px solid var(--line);font-size:12px;color:var(--ink2);line-height:1}
.tp-costo b{font-weight:600;color:var(--ink)}
.tp-costo i{width:7px;height:7px;border-radius:50%}
.tp-barra{display:flex;align-items:center;gap:10px;margin-top:22px;flex-wrap:nowrap;min-width:0}
.tp-barra > *{flex:none}
.tp-buscar{flex:0 1 240px!important;min-width:150px;display:flex;align-items:center;gap:8px;height:36px;border:1px solid var(--line);border-radius:10px;padding:0 12px;background:#fff}
.tp-buscar svg{width:16px;height:16px;color:var(--ink4);flex:none}
.tp-buscar input{border:0;outline:0;background:none;font:inherit;font-size:13px;color:var(--ink);width:100%;min-width:0}
.tp-tabs{display:inline-flex;gap:2px;background:var(--bg3);border-radius:999px;padding:3px}
.tp-tabs button{height:30px;padding:0 13px;border-radius:999px;font-size:13px;color:var(--ink3);display:inline-flex;align-items:center;gap:7px;border:0;background:none;cursor:pointer}
.tp-tabs button[aria-pressed="true"]{background:#fff;color:var(--ink);font-weight:500;box-shadow:0 1px 2px rgba(15,23,42,.1)}
.tp-tabs button span{min-width:20px;height:18px;padding:0 6px;border-radius:999px;background:rgba(15,23,42,.06);font-size:11.5px;font-weight:600;line-height:1;display:inline-flex;align-items:center;justify-content:center;font-variant-numeric:tabular-nums}
.tp-barra .tp-linea{min-width:170px!important}
.tp-barra .tp-nueva{margin-left:auto}
.tp-nueva{height:40px;padding:0 18px 0 14px;border-radius:10px;background:#FFD21F;color:#0b0b10;font-weight:600;font-size:13.5px;display:inline-flex;align-items:center;gap:8px;white-space:nowrap;border:0;cursor:pointer;box-shadow:0 1px 2px rgba(11,11,16,.12),0 4px 12px -4px rgba(230,217,0,.6)}
.tp-nueva svg{width:16px;height:16px}
.tp-nueva.grande{height:44px;padding:0 20px;font-size:14px}
.tp-lista{margin-top:16px;border:1px solid var(--line);border-radius:14px}
.tp-fila{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.45fr) minmax(0,1fr) 150px 64px 40px;gap:20px;align-items:center;padding:16px 18px;border-top:1px solid var(--line)}
.tp-fila:first-child{border-top:0}
.tp-fila.th{padding:10px 18px;background:var(--bg2);font-size:12px;font-weight:500;color:var(--ink3);border-radius:14px 14px 0 0}
.tp-fila[hidden]{display:none}
.tp-nom{min-width:0}
.tp-nom b{display:block;font-size:14px;font-weight:600;overflow-wrap:anywhere}
.tp-nom small{display:flex;align-items:center;gap:6px;margin-top:3px;font-size:12px;color:var(--ink3)}
.tp-nom small i{width:7px;height:7px;border-radius:50%}
.tp-chat{background-color:#f3f4f6;border-radius:12px;padding:10px;min-width:0}
.tp-burb{max-width:440px;padding:9px 12px 9px 13px;border-radius:12px;border-top-left-radius:4px;background:#fff;border:1px solid var(--line);font-size:13px;line-height:1.45;color:var(--ink);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.tp-var{background:#FFF4C2;border-radius:4px;padding:0 3px;font-weight:500}
.tp-lnc{display:flex;align-items:center;gap:10px;min-width:0}
.tp-caras{display:flex;flex:none}
.tp-cara{width:28px;height:28px;border-radius:50%;border:2px solid #fff;background:#25D366;color:#fff;line-height:0;display:flex;align-items:center;justify-content:center;box-sizing:border-box;flex:none}
.tp-cara + .tp-cara{margin-left:-9px}
.tp-cara svg{width:15px;height:15px;display:block;transform:translate(.4px,-.4px)}
.tp-lnt{min-width:0}
.tp-lnt b{display:block;font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tp-lnt b em{font-style:normal;font-size:11.5px;font-weight:600;color:var(--ink2);background:var(--bg3);border-radius:999px;padding:1px 7px;margin-left:4px}
.tp-lnt small{display:flex;align-items:center;gap:5px;font-size:12px;color:var(--ink3);white-space:nowrap;overflow:hidden}
.tp-lnt small i{width:7px;height:7px;border-radius:50%;flex:none}
.tp-est{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border-radius:999px;font-size:12px;font-weight:600;line-height:1;white-space:nowrap}
.tp-est i{width:7px;height:7px;border-radius:50%;background:currentColor}
.tp-est.ok{background:var(--green-soft);color:var(--green-ink)}
.tp-est.w{background:var(--amber-soft);color:var(--amber-ink)}
.tp-est.w i{animation:tp-pulso 1.6s ease-in-out infinite}
@keyframes tp-pulso{0%,100%{opacity:1}50%{opacity:.3}}
.tp-est.b{background:var(--red-soft);color:var(--red-ink)}
.tp-est.g{background:var(--bg3);color:var(--ink3)}
.tp-num{font-size:13.5px;font-weight:500;font-variant-numeric:tabular-nums}
.tp-acc{position:relative;display:flex;justify-content:flex-end}
.tp-mas{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;color:var(--ink3);border:0;background:none;cursor:pointer}
.tp-mas:hover,.tp-mas[aria-expanded="true"]{background:var(--bg3);color:var(--ink)}
.tp-mas svg{width:18px;height:18px}
.tp-menu{position:absolute;right:0;top:40px;z-index:6;min-width:200px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:5px;box-shadow:0 14px 30px -14px rgba(15,23,42,.35)}
.tp-menu[hidden]{display:none}
.tp-menu button{display:flex;align-items:center;gap:9px;width:100%;padding:8px 10px;border:0;background:none;border-radius:7px;font:inherit;font-size:13px;color:var(--ink);text-align:left;cursor:pointer}
.tp-menu button:hover{background:var(--hover)}
.tp-menu svg{width:15px;height:15px;color:var(--ink3)}
.tp-menu .tp-peligro{color:#dc2626;margin-top:4px;position:relative}
.tp-menu .tp-peligro::before{content:"";position:absolute;left:6px;right:6px;top:-3px;border-top:1px solid var(--line)}
.tp-menu .tp-peligro svg{color:#dc2626}
.tp-menu .tp-peligro:hover{background:#fef2f2}
.tp-motivo{grid-column:1/-1;display:flex;align-items:center;gap:10px;margin-top:-6px;padding:10px 12px;border-radius:10px;background:#fef2f2;font-size:12.5px;color:var(--ink2)}
.tp-motivo svg{width:16px;height:16px;color:var(--red-ink);flex:none}
.tp-motivo b{font-weight:600;color:var(--ink)}
.tp-nada{padding:22px 18px;font-size:13px;color:var(--ink3)}
.tp-vacio{margin-top:22px;border:1px solid var(--line);border-radius:16px;background:#fff;padding:44px 32px 36px;display:flex;flex-direction:column;align-items:center;text-align:center}
.tp-vacio h3{margin:22px 0 0;font-size:19px;font-weight:700;letter-spacing:-.015em}
.tp-vacio > p{margin:6px 0 0;font-size:13.5px;color:var(--ink3);max-width:60ch}
.tp-demo{width:330px;max-width:100%;border-radius:16px;background:#f3f4f6;padding:14px;text-align:left}
.tp-demo .b2{background:#fff;border:1px solid var(--line);border-radius:12px;border-top-left-radius:4px;padding:10px 12px;font-size:13px;line-height:1.45}
.tp-demo .b2 small{display:block;margin-top:6px;font-size:11.5px;color:var(--ink3)}
.tp-demo .bt{margin-top:6px;background:#fff;border:1px solid var(--line);border-radius:10px;padding:8px;text-align:center;font-size:13px;font-weight:500;color:#1f93ff}
.tp-pasos{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:26px 0;width:100%;max-width:760px;text-align:left}
.tp-paso{display:flex;gap:12px;align-items:flex-start;padding:14px;border-radius:12px;background:var(--bg2)}
.tp-paso .n{width:28px;height:28px;border-radius:50%;border:2px solid var(--line);background:#fff;color:var(--ink3);display:flex;align-items:center;justify-content:center;line-height:1;font-size:12px;font-weight:600;font-variant-numeric:tabular-nums;flex:none;box-sizing:border-box}
.tp-paso .n.on{background:#FFD21F;border-color:#FFD21F;color:#0b0b10}
.tp-paso b{display:block;font-size:13.5px;font-weight:600}
.tp-paso small{display:block;font-size:12.5px;color:var(--ink3);margin-top:1px}
.tp-vacio .nota{margin:12px 0 0;font-size:12.5px;color:var(--ink3)}
/* Formulario */
.tn{display:grid;grid-template-columns:minmax(0,1fr) 420px;gap:40px;margin-top:26px}
.tn-frm{display:grid;gap:22px;align-content:start;min-width:0}
.tn-sec{border:1px solid var(--line);border-radius:14px;padding:18px 20px;display:grid;gap:16px}
.tn-sec h3{margin:0;font-size:14px;font-weight:600;display:flex;align-items:center;justify-content:space-between}
.tn-sec h3 small{font-size:12.5px;font-weight:400;color:var(--ink3)}
.tn-campo{display:grid;gap:7px;min-width:0}
.tn-campo > label,.tn-campo > span:first-child{font-size:13px;font-weight:500;color:var(--ink)}
.tn-campo em{font-style:normal;font-weight:400;color:var(--ink3)}
.tn-campo input,.tn-campo textarea{width:100%;height:44px;border:1px solid var(--line);border-radius:10px;padding:0 14px;font:inherit;font-size:14px;color:var(--ink);background:#fff;transition:border-color .15s,box-shadow .15s;box-sizing:border-box}
.tn-campo textarea{height:auto;min-height:118px;padding:12px 14px;line-height:1.55;resize:vertical;border:0;border-radius:0;display:block}
.tn-campo input:focus{outline:0;border-color:#0b0b10;box-shadow:0 0 0 3px rgba(11,11,16,.08)}
.tn-ayuda{font-size:12.5px;color:var(--ink3)}
.tn-elige{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.tn-op{display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:#fff;text-align:left;font:inherit;color:inherit;cursor:pointer;min-width:0}
.tn-op[aria-checked="true"]{border-color:#0b0b10;box-shadow:inset 0 0 0 1px #0b0b10}
.tn-op:disabled{opacity:.55;cursor:not-allowed}
.tn-cb{width:18px;height:18px;border-radius:5px;border:2px solid var(--ink4);display:flex;align-items:center;justify-content:center;flex:none;color:#fff;box-sizing:border-box}
.tn-op[aria-checked="true"] .tn-cb{background:#0b0b10;border-color:#0b0b10}
.tn-cb svg{width:12px;height:12px;stroke-width:3}
.tn-op .tp-cara{border:0}
.tn-op b{display:block;font-size:13.5px;font-weight:500}
.tn-op small{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--ink3);font-variant-numeric:tabular-nums}
.tn-op small i{width:7px;height:7px;border-radius:50%;flex:none}
.tn-op.cat{align-items:flex-start}
.tn-rd{width:18px;height:18px;border-radius:50%;border:2px solid var(--ink4);flex:none;margin-top:1px;box-sizing:border-box}
.tn-op[aria-checked="true"] .tn-rd{border-color:#0b0b10;background:#0b0b10;box-shadow:inset 0 0 0 3px #fff}
.tn-op.cat small{display:block;margin-top:2px}
.tn-seg{display:inline-flex;gap:2px;background:var(--bg3);border-radius:999px;padding:3px;justify-self:start;flex-wrap:wrap}
.tn-seg button{height:30px;padding:0 14px;border-radius:999px;font:inherit;font-size:13px;color:var(--ink3);display:inline-flex;align-items:center;gap:6px;border:0;background:none;cursor:pointer}
.tn-seg button svg{width:15px;height:15px}
.tn-seg button[aria-pressed="true"]{background:#fff;color:var(--ink);font-weight:500;box-shadow:0 1px 2px rgba(15,23,42,.1)}
.tn-area{border:1px solid var(--line);border-radius:12px;overflow:hidden;transition:border-color .15s,box-shadow .15s}
.tn-area:focus-within{border-color:#0b0b10;box-shadow:0 0 0 3px rgba(11,11,16,.08)}
.tn-area textarea:focus{outline:0}
.tn-vars{display:flex;align-items:center;gap:6px;padding:8px 10px;border-top:1px solid var(--line2);background:var(--bg2);flex-wrap:wrap}
.tn-vars > span{font-size:12px;color:var(--ink3);margin-right:2px}
.tn-vars button{height:26px;padding:0 9px;border-radius:999px;border:1px dashed #d5d8e0;background:#fff;font:inherit;font-size:12px;font-weight:500;color:var(--ink2);cursor:pointer;line-height:1}
.tn-vars .cont{margin-left:auto;font-size:12px;color:var(--ink3);font-variant-numeric:tabular-nums}
.tn-video{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--line);border-radius:12px}
.tn-video .ic{width:36px;height:36px;border-radius:10px;background:var(--bg3);display:flex;align-items:center;justify-content:center;flex:none}
.tn-video .ic svg{width:18px;height:18px}
.tn-video b{display:block;font-size:13px;font-weight:500}
.tn-video small{display:block;font-size:12px;color:var(--ink3)}
.tn-video .x{margin-left:auto;width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#dc2626;border:0;background:none;cursor:pointer}
.tn-video .x svg{width:16px;height:16px}
.tn-aviso{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:12px;background:var(--amber-soft);border:1px solid var(--amber-line);font-size:12.5px;color:var(--ink2)}
.tn-aviso svg{width:16px;height:16px;color:var(--amber-ink);flex:none;margin-top:1px}
.tn-rev{display:grid;gap:8px;padding:14px 16px;border-radius:12px;background:var(--bg2)}
.tn-rev b{font-size:13px;font-weight:600}
.tn-rv{display:flex;align-items:center;gap:9px;font-size:12.5px;color:var(--ink2)}
.tn-rv .ok{width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex:none;background:#e8f8ee;color:#15803d}
.tn-rv.mal .ok{background:#fee2e2;color:#dc2626}
.tn-rv .ok svg{width:11px;height:11px;stroke-width:3}
.tn-pie{position:sticky;bottom:-24px;display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:22px;padding:14px 0;border-top:1px solid var(--line2);background:#fff;z-index:3;flex-wrap:wrap}
.tn-pie > span{font-size:12.5px;color:var(--ink3)}
.tn-pie > div{display:flex;gap:8px}
.tn-pie .btn{height:38px;padding:0 15px;border-radius:10px}
.tn-vista-tit{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px}
.tn-vista-tit b{font-size:13px;font-weight:600}
.tn-vista-tit span{font-size:12.5px;color:var(--ink3)}
/* iPhone 18 Pro Max con WhatsApp */
.tn-tel{position:sticky;top:12px;width:420px;height:900px;border-radius:68px;background:#1b1b1d;padding:12px;box-shadow:0 0 0 2px #3a3a3e,0 40px 80px -30px rgba(15,23,42,.45);box-sizing:border-box}
.tn-tel::before{content:"";position:absolute;left:-3px;top:180px;width:3px;height:64px;border-radius:2px;background:#2a2a2d;box-shadow:0 84px 0 #2a2a2d}
.tn-tel::after{content:"";position:absolute;right:-3px;top:230px;width:3px;height:100px;border-radius:2px;background:#2a2a2d}
.tn-pant{position:relative;width:100%;height:100%;border-radius:56px;overflow:hidden;background:#efeae2;display:flex;flex-direction:column;font-family:-apple-system,"SF Pro Text",Inter,system-ui,sans-serif}
.tn-isla{position:absolute;top:11px;left:50%;transform:translateX(-50%);width:124px;height:36px;border-radius:20px;background:#000;z-index:3}
.tn-estado{height:54px;display:flex;align-items:flex-end;justify-content:space-between;padding:0 34px 6px 42px;font-size:16px;font-weight:600;color:#000;background:#f6f6f6}
.tn-estado .der{display:flex;align-items:center;gap:6px}
.tn-estado svg{height:12px}
.tn-wcab{display:flex;align-items:center;gap:10px;padding:8px 14px 10px 8px;background:#f6f6f6;border-bottom:1px solid #dcdcdc}
.tn-wcab .atras{display:flex;align-items:center;color:#007aff}
.tn-wcab .atras svg{width:22px;height:22px;stroke-width:2.4}
.tn-wcab .ava{width:36px;height:36px;border-radius:50%;background:#FFD21F;display:flex;align-items:center;justify-content:center;line-height:1;font-weight:800;font-size:13px;color:#17140F;flex:none}
.tn-wcab .q{flex:1;min-width:0}
.tn-wcab .q b{display:flex;align-items:center;gap:4px;font-size:16px;font-weight:600;color:#000;white-space:nowrap;overflow:hidden}
.tn-wcab .q b svg{width:15px;height:15px;flex:none}
.tn-wcab .q small{display:block;font-size:12px;color:#8a8a8e}
.tn-wcab .ic{display:flex;gap:20px;color:#007aff}
.tn-wcab .ic svg{width:22px;height:22px}
.tn-fondo{flex:1;padding:12px 10px;display:flex;flex-direction:column;gap:8px;background-color:#efeae2;background-image:url(img/fondo-chat.png);background-size:288px auto;background-blend-mode:multiply;overflow:hidden}
.tn-dia{align-self:center;background:#fff;border-radius:8px;padding:3px 10px;font-size:12px;color:#54656f;box-shadow:0 1px .5px rgba(11,20,26,.13)}
.tn-cifra{align-self:center;max-width:90%;background:#fff8c6;border-radius:8px;padding:6px 10px;font-size:11.5px;line-height:1.4;color:#54656f;text-align:center;box-shadow:0 1px .5px rgba(11,20,26,.13)}
.tn-cifra svg{width:11px;height:11px;vertical-align:-1px;margin-right:3px}
.tn-msj{align-self:flex-start;max-width:84%;position:relative}
.tn-msj::before{content:"";position:absolute;left:-7px;top:0;border-top:9px solid #fff;border-left:8px solid transparent}
.tn-bur{background:#fff;border-radius:0 10px 10px 10px;padding:7px 9px 6px;box-shadow:0 1px .5px rgba(11,20,26,.13);color:#111b21;font-size:15.5px;line-height:1.35;white-space:pre-wrap;overflow-wrap:anywhere}
.tn-bur .h{font-weight:700;margin-bottom:3px}
.tn-bur .vid{height:150px;margin:-4px -6px 6px;border-radius:7px;background:#1f2937;display:flex;align-items:center;justify-content:center;color:#fff}
.tn-bur .vid svg{width:34px;height:34px}
.tn-bur .f{margin-top:5px;font-size:13px;color:#8696a0}
.tn-bur .t{display:flex;justify-content:flex-end;font-size:11px;color:#8696a0;margin-top:2px}
.tn-boton{margin-top:2px;background:#fff;border-radius:10px;box-shadow:0 1px .5px rgba(11,20,26,.13);height:40px;display:flex;align-items:center;justify-content:center;gap:7px;color:#027eb5;font-size:15px;font-weight:500}
.tn-boton svg{width:16px;height:16px;stroke-width:2.2}
.tn-escribir{display:flex;align-items:center;gap:12px;padding:8px 12px 30px;background:#f6f6f6;border-top:1px solid #dcdcdc;color:#007aff}
.tn-escribir svg{width:24px;height:24px}
.tn-escribir .campo2{flex:1;height:34px;border-radius:18px;background:#fff;border:1px solid #dcdcdc}
.tn-barrita{position:absolute;bottom:8px;left:50%;transform:translateX(-50%);width:140px;height:5px;border-radius:3px;background:#000}
/* La plantilla enviada en el chat del CRM: encabezado, pie y botón, como la recibió el cliente */
.ch-th{font-weight:700;margin-bottom:2px}
.ch-tf{margin-top:6px;font-size:12.5px;color:#5b5130}
.ch-tb{display:flex;flex-direction:column;gap:4px;margin:8px -6px -3px;padding-top:8px;border-top:1px solid rgba(11,11,16,.12);white-space:normal}
.ch-tb span{height:34px;border-radius:10px;background:rgba(255,255,255,.6);display:flex;align-items:center;justify-content:center;gap:7px;font-size:13.5px;font-weight:600;color:#0b0b10}
.ch-tb svg{width:15px;height:15px;stroke-width:2.2}
@media (max-width:1180px){.tn{grid-template-columns:1fr}.tn-tel{position:relative;margin:0 auto}.tp-fila{grid-template-columns:minmax(0,1fr) minmax(0,1fr) 140px 40px}.tp-fila > :nth-child(2),.tp-fila > :nth-child(5){display:none}}
@media (max-width:760px){.tp-pasos,.tn-elige{grid-template-columns:1fr}.tp-barra{overflow-x:auto}.tn-tel{transform:scale(.8);transform-origin:top center;margin-bottom:-180px}}
@media (prefers-reduced-motion:reduce){.tp-est.w i{animation:none}}
</style>`);

const TP_IC = {
  buscar: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  editar: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/></svg>',
  borrar: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"/></svg>',
  alerta: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17h.01"/></svg>',
  chulo: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 5 5L20 7"/></svg>',
  x: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  responder: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-2"/></svg>',
  enlace: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  llamar: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z"/></svg>',
  texto: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6h14M12 6v13"/></svg>',
  video: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3"/></svg>',
  plantilla: '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h6"/></svg>',
};
const TP_CAT_COL = {Marketing:'#7c3aed', Utilidad:'#0284c7'};
// Los mismos datos de ejemplo con los que Meta revisa la plantilla (plantillas.ts, EJEMPLOS).
const TP_EJ = {nombre:'Valentina', asesor:'Sara', producto:'Calendario G 2026', enlace:'walicrm.com', fecha:'5 de octubre', valor:'$150.000', curso:'Plan anual', hora:'4:00 p. m.'};
const TP_VARS = ['nombre', 'producto', 'fecha', 'asesor', 'enlace'];
st.tp = st.tp || {estado:'', linea:'', q:'', menu:null};

/** ¿Se puede enviar desde esa línea? Sin líneas guardadas, sirve en todas (las creadas en Meta). */
const tplEnLinea = (p, lineaId) => !p || !Array.isArray(p.lineas) || !p.lineas.length || !lineaId || p.lineas.includes(lineaId);
const tpClave = p => p.borrador ? 'b:' + p.n : p.slug;
const tpEquipo = id => (CFG.lineas.find(x => x.id === id) || {}).eq || '';
const tpCaras = n => Array.from({length: Math.max(1, Math.min(3, n))}, () => `<span class="tp-cara">${LOGO.wa}</span>`).join('');
const tpCuerpo = b => esc(b || '').replace(/\{\{\s*(\w+)\s*\}\}/g, '<span class="tp-var">$1</span>');
function tpEstado(p){
  if (p.borrador) return ['g', 'Borrador'];
  if (p.e === 'ok') return ['ok', 'Aprobada'];
  if (p.e === 'w') return ['w', 'En revisión en Meta'];
  if (p.e === 'b') return ['b', p.estadoMeta === 'DISABLED' ? 'Deshabilitada' : 'Rechazada'];
  return ['g', String(p.x || 'Pausada').split(':')[0]];
}
function tpLineasCelda(p){
  if (!Array.isArray(p.lineas) || !p.lineas.length) {
    const k = LINEAS.filter(l => !p.wabas || !l.wabaId || p.wabas.includes(l.wabaId)).length || LINEAS.length;
    return `<div class="tp-lnc"><span class="tp-caras">${tpCaras(Math.min(2, k))}</span><span class="tp-lnt"><b>Todas las líneas</b><small>${k} ${k === 1 ? 'línea' : 'líneas'}</small></span></div>`;
  }
  const ls = p.lineas.map(id => LINEAS.find(l => l.id === id)).filter(Boolean);
  if (!ls.length) return '<span class="muted" style="font-size:12.5px">Su línea ya no está conectada</span>';
  const eqs = [...new Set(ls.map(l => tpEquipo(l.id)).filter(Boolean))];
  return `<div class="tp-lnc"><span class="tp-caras">${tpCaras(ls.length)}</span><span class="tp-lnt"><b>${esc(ls[0].n)}${ls.length > 1 ? `<em>+${ls.length - 1}</em>` : ''}</b><small>${eqs.map(e => `<i style="background:${colorEquipo(e)}"></i>${esc(e)}`).join(' ')}</small></span></div>`;
}
function tpCuentas(){
  const c = {todas: PLANTILLAS.length, ok: 0, w: 0, b: 0};
  PLANTILLAS.forEach(p => { if (!p.borrador && c[p.e] != null) c[p.e]++; });
  return c;
}
const tpVisible = p => (!st.tp.estado || (!p.borrador && p.e === st.tp.estado)) && (!st.tp.linea || tplEnLinea(p, st.tp.linea));
const tpBusca = p => norm(`${p.n} ${p.b || ''} ${p.c || ''}`);
// Las plantillas las crean, editan y borran los líderes (las rutas del servidor son solo para ellos).
const puedeEditarTpl = () => st.rol === 'l';

function paginaPlantillas(){
  const costos = `<div class="tp-costos"><span class="tp-costo"><i style="background:${TP_CAT_COL.Marketing}"></i>Marketing <b>0,0125 USD</b> por envío</span><span class="tp-costo"><i style="background:${TP_CAT_COL.Utilidad}"></i>Utilidad <b>0,0008 USD</b> por envío</span><span class="tp-costo">Precios de Meta en Colombia</span></div>`;
  const cab = `<div class="pg-h tp-cab"><div><h2>Plantillas de WhatsApp</h2><p class="sub">Los mensajes con los que tu empresa puede escribir primero. Meta las revisa antes de usarlas, casi siempre en minutos.</p>${PLANTILLAS.length ? costos : ''}</div></div>`;
  const nueva = cls => `<button type="button" class="tp-nueva${cls ? ' ' + cls : ''}" data-tp-nueva="1">${I('plus')}Nueva plantilla</button>`;
  if (!PLANTILLAS.length) return `${cab}<div class="tp-vacio">
      <div class="tp-demo"><div class="b2">Hola, <span class="tp-var">nombre</span>. Te recordamos tu cita de mañana a las 10:00 a. m.<small>${esc(ESPACIO.nombre || 'Tu empresa')}</small></div><div class="bt">Confirmar</div></div>
      <h3>Crea tu primera plantilla</h3>
      <p>Con una plantilla le escribes primero a un cliente, o le respondes cuando ya pasaron 24 horas desde su último mensaje.</p>
      <div class="tp-pasos"><div class="tp-paso"><span class="n on">1</span><div><b>Escribe el mensaje</b><small>Y elige desde qué líneas se envía</small></div></div>
        <div class="tp-paso"><span class="n">2</span><div><b>Meta la revisa</b><small>Casi siempre en minutos, a veces unas horas</small></div></div>
        <div class="tp-paso"><span class="n">3</span><div><b>Úsala</b><small>En difusiones y al escribirle a un cliente</small></div></div></div>
      ${puedeEditarTpl() ? nueva('grande') : ''}
      <p class="nota">Utilidad: 0,0008 USD por envío · Marketing: 0,0125 USD por envío (precios de Meta en Colombia).</p></div>`;
  const c = tpCuentas(), tab = (k, t, n) => `<button type="button" data-tp-estado="${k}" aria-pressed="${st.tp.estado === k}">${t} <span>${n}</span></button>`;
  if (st.tp.linea && !LINEAS.some(l => l.id === st.tp.linea)) st.tp.linea = '';
  const barra = `<div class="tp-barra">
      <label class="tp-buscar">${TP_IC.buscar}<input id="tp-q" value="${esc(st.tp.q)}" placeholder="Buscar plantilla" aria-label="Buscar plantilla" autocomplete="off"></label>
      <div class="tp-tabs" role="group" aria-label="Filtrar por estado">${tab('', 'Todas', c.todas)}${tab('ok', 'Aprobadas', c.ok)}${tab('w', 'En revisión', c.w)}${tab('b', 'Rechazadas', c.b)}</div>
      ${LINEAS.length > 1 ? ddSel('data-tp-linea', [['', 'Línea: Todas'], ...LINEAS.map(l => [l.id, 'Línea: ' + l.n])], st.tp.linea).replace('class="dd dsel"', 'class="dd dsel tp-linea"') : ''}
      ${puedeEditarTpl() ? nueva() : ''}</div>`;
  const q = norm(st.tp.q), lista = PLANTILLAS.filter(tpVisible);
  const filas = lista.map(p => {
    const [e, et] = tpEstado(p), k = tpClave(p), ab = st.tp.menu === k;
    return `<div class="tp-fila" data-tp-q="${esc(tpBusca(p))}"${q && !tpBusca(p).includes(q) ? ' hidden' : ''}>
      <div class="tp-nom"><b>${esc(p.n)}</b><small>${p.c ? `<i style="background:${TP_CAT_COL[p.c] || '#9ca3af'}"></i>${esc(p.c)}` : ''}${p.borrador ? ' · Solo tú lo ves' : ' · Español'}</small></div>
      <div class="tp-chat"><div class="tp-burb">${tpCuerpo(p.b) || '<span class="muted">Sin texto todavía</span>'}</div></div>
      ${tpLineasCelda(p)}
      <span><span class="tp-est ${e}"><i></i>${esc(et)}</span></span>
      <div class="tp-num">${p.u ? p.u.toLocaleString('es-CO') : '—'}</div>
      <div class="tp-acc">${puedeEditarTpl() ? `<button type="button" class="tp-mas" data-tp-menu="${esc(k)}" aria-haspopup="menu" aria-expanded="${ab}" aria-label="Más acciones de ${esc(p.n)}">${I('more')}</button>
        <div class="tp-menu" role="menu" ${ab ? '' : 'hidden'}><button type="button" role="menuitem" data-tp-editar="${esc(k)}">${TP_IC.editar}Editar</button><button type="button" role="menuitem" class="tp-peligro" data-tp-borrar="${esc(k)}">${TP_IC.borrar}Eliminar</button></div>` : ''}</div>
      ${p.e === 'b' && p.motivo ? `<div class="tp-motivo">${TP_IC.alerta}<span><b>Por qué la rechazó Meta:</b> ${esc(p.motivo)}.</span></div>` : ''}
    </div>`;
  }).join('');
  return `${cab}${barra}<div class="tp-lista"><div class="tp-fila th"><span>Plantilla</span><span>Así la recibe el cliente</span><span>Líneas</span><span>Estado</span><span>Envíos</span><span></span></div>
    ${filas || '<div class="tp-nada">Ninguna plantilla coincide con estos filtros.</div>'}</div>`;
}

/* ── El formulario ── */
function tplDesde(p){
  const lineas = Array.isArray(p.lineas) && p.lineas.length ? p.lineas.filter(id => LINEAS.some(l => l.id === id))
    : LINEAS.filter(l => !p.wabas || !l.wabaId || p.wabas.includes(l.wabaId)).map(l => l.id);
  return {nombre:p.n, cat:p.c === 'Marketing' ? 'Marketing' : 'Utilidad', lineas:new Set(lineas), headTipo:p.headTipo || (p.head ? 'texto' : ''), head:p.head || '', body:p.b || '', foot:p.foot || '',
    btn:p.btn || '', btnTxt:p.btnTxt || '', btnUrl:p.btnUrl || '', btnTel:p.btnTel || '',
    video:p.headTipo === 'video' && p.mediaUrl ? {n:p.mediaN || 'video.mp4', url:p.mediaUrl} : null,
    editar:p.borrador ? null : p.slug, borradorDe:p.borrador ? p.n : null, aprobada:!p.borrador && p.estadoMeta === 'APPROVED'};
}
function tnNueva(){
  return {nombre:'', cat:'Utilidad', lineas:new Set(LINEAS.length === 1 ? [LINEAS[0].id] : []), headTipo:'', head:'', body:'Hola, {{nombre}}. ', foot:ESPACIO.nombre || '',
    btn:'', btnTxt:'', btnUrl:'', btnTel:'', video:null, editar:null, borradorDe:null, aprobada:false};
}
const tnTextoBoton = t => t.btnTxt || (t.btn === 'Enlace' ? 'Ver más' : t.btn === 'Llamar' ? 'Llamar' : 'Sí, quiero información');
const tnLlenar = s => esc(s || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => esc(TP_EJ[k] || k));
/** Las reglas de Meta que más rechazan, revisadas mientras se escribe. */
function tnReglas(t){
  const b = String(t.body || '').trim(), todo = `${t.head} ${b} ${t.foot} ${t.btnTxt}`;
  const raras = varsDe(b).filter(v => !(v in TP_EJ));
  return [
    [!/^\{\{/.test(b) && !/\}\}[.!?¿¡\s]*$/.test(b) && !/\}\}\s*\{\{/.test(b), 'Las variables no van al principio ni al final del mensaje, ni dos seguidas', 'Mueve la variable: Meta rechaza las que van al principio, al final o pegadas'],
    [!/\b[A-ZÁÉÍÓÚÑ]{4,}\b/.test(todo) && !/\b(gratis|garantizad[oa]s?|100 ?%)/i.test(todo), 'Sin mayúsculas sostenidas ni promesas sin condiciones', 'Quita las palabras en mayúsculas sostenidas o las promesas como «gratis» o «garantizado»'],
    [!raras.length, 'Cada variable tiene un ejemplo para que Meta la revise', `Usa las variables de la lista: {{${raras[0] || ''}}} no tiene ejemplo`],
  ];
}
function tnVista(t){
  const ic = {'Respuesta rápida':TP_IC.responder, Enlace:TP_IC.enlace, Llamar:TP_IC.llamar}[t.btn] || '';
  return `<span class="tn-dia">Hoy</span><span class="tn-cifra"><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>Los mensajes y las llamadas están cifrados de extremo a extremo.</span>
    <div class="tn-msj"><div class="tn-bur">${t.headTipo === 'video' ? `<div class="vid">${I('play')}</div>` : ''}${t.headTipo === 'texto' && t.head.trim() ? `<div class="h">${esc(t.head)}</div>` : ''}${tnLlenar(t.body) || '<span style="color:#8696a0">Escribe el mensaje…</span>'}${t.foot.trim() ? `<div class="f">${esc(t.foot)}</div>` : ''}<span class="t">${hcHora(Date.now())}</span></div>
    ${t.btn ? `<div class="tn-boton">${ic}${esc(tnTextoBoton(t))}</div>` : ''}</div>`;
}
const tnRevision = t => `<b>Antes de enviarla a Meta</b>${tnReglas(t).map(([ok, si, no]) => `<div class="tn-rv${ok ? '' : ' mal'}"><span class="ok">${ok ? TP_IC.chulo : TP_IC.x}</span>${esc(ok ? si : no)}</div>`).join('')}`;
function tnRefrescar(){
  const t = st.tplNueva; if (!t) return;
  const v = document.getElementById('tn-chat'); if (v) v.innerHTML = tnVista(t);
  const r = document.getElementById('tn-rev'); if (r) r.innerHTML = tnRevision(t);
  const c = document.getElementById('tn-cont'); if (c) c.textContent = `${String(t.body || '').length.toLocaleString('es-CO')} / 1.024`;
}
function plantillaNueva(){
  const t = st.tplNueva, el = document.getElementById('page');
  const marca = (ESPACIO.nombre || 'Tu empresa').trim(), ini = marca.charAt(0).toUpperCase();
  const linea = l => { const eq = tpEquipo(l.id); return `<button type="button" class="tn-op" role="checkbox" aria-checked="${t.lineas.has(l.id)}" data-tn-linea="${esc(l.id)}"><span class="tn-cb">${TP_IC.chulo}</span><span class="tp-cara">${LOGO.wa}</span><span style="min-width:0"><b>${esc(l.n)}</b><small>${esc(l.tel || '')}${eq ? ` · <i style="background:${colorEquipo(eq)}"></i>${esc(eq)}` : ''}</small></span></button>`; };
  const cat = (k, precio, d) => `<button type="button" class="tn-op cat" role="radio" aria-checked="${t.cat === k}" data-tn-cat="${k}" ${t.aprobada && t.cat !== k ? 'disabled' : ''}><span class="tn-rd"></span><span><b>${k} · ${precio}</b><small>${d}</small></span></button>`;
  const seg = (attr, ops, val) => ops.map(([v, txt, ic]) => `<button type="button" ${attr}="${v}" aria-pressed="${val === v}">${ic || ''}${txt}</button>`).join('');
  el.innerHTML = `<div class="pg-h"><div><h2>${t.editar ? 'Editar plantilla' : 'Nueva plantilla'}</h2><p class="sub">Escribe el mensaje, elige sus líneas y mándalo a Meta para aprobación.</p></div><button type="button" class="btn" id="t-x">${I('back')}Volver a plantillas</button></div>
    <div class="tn"><div class="tn-frm">
      ${t.aprobada ? `<div class="tn-aviso">${TP_IC.alerta}<span>Si cambias el texto, vuelve a revisión de Meta y no se puede enviar hasta que la apruebe. Meta deja editar una plantilla aprobada una vez al día y hasta 10 veces al mes. Cambiar solo el nombre o las líneas no pasa por Meta.</span></div>` : ''}
      <section class="tn-sec"><h3>Datos</h3>
        <div class="tn-campo"><label for="t-n">Nombre interno <em>· solo lo ve tu equipo</em></label><input id="t-n" value="${esc(t.nombre)}" placeholder="Ej. Recordatorio de pago" autocomplete="off"></div>
        <div class="tn-campo"><span>Líneas donde se usa</span>
          ${LINEAS.length ? `<div class="tn-elige" role="group" aria-label="Líneas donde se usa">${LINEAS.map(linea).join('')}</div><span class="tn-ayuda">Solo se podrá enviar desde estas líneas, en difusiones y al escribirle a un cliente.</span>`
            : '<span class="tn-ayuda">Primero conecta una línea de WhatsApp en Ajustes del CRM, Líneas de WhatsApp.</span>'}</div>
        <div class="tn-campo"><span>Categoría${t.aprobada ? ' <em>· fija: Meta no deja cambiarla en una aprobada</em>' : ''}</span>
          <div class="tn-elige" role="radiogroup" aria-label="Categoría">${cat('Utilidad', '0,0008 USD', 'Avisos de algo que el cliente ya pidió: citas, pagos, pedidos')}${cat('Marketing', '0,0125 USD', 'Promociones, ofertas y mensajes para volver a escribir')}</div></div>
      </section>
      <section class="tn-sec"><h3>Mensaje</h3>
        <div class="tn-campo"><span>Encabezado <em>· opcional</em></span>
          <div class="tn-seg" role="group" aria-label="Tipo de encabezado">${seg('data-tn-head', [['', 'Ninguno'], ['texto', 'Texto', TP_IC.texto], ['video', 'Video', TP_IC.video]], t.headTipo)}</div>
          ${t.headTipo === 'texto' ? `<input id="t-h" value="${esc(t.head)}" placeholder="Ej. Te recordamos" maxlength="60" aria-label="Texto del encabezado">` : ''}
          ${t.headTipo === 'video' ? (t.video ? `<div class="tn-video"><span class="ic">${TP_IC.video}</span><span style="min-width:0"><b>${esc(t.video.n)}</b><small>${t.video.subiendo ? 'Subiendo…' : `Video${t.video.peso ? ' · ' + esc(tamano(t.video.peso)) : ''} · máximo 16 MB`}</small></span><button type="button" class="x" id="t-vx" aria-label="Quitar el video">${I('x')}</button></div>`
            : `<div><button type="button" class="btn" id="t-vadd">${I('clip')}Agregar video</button> <span class="tn-ayuda">MP4 de hasta 16 MB</span></div>`) : ''}</div>
        <div class="tn-campo"><label for="t-b">Cuerpo</label>
          <div class="tn-area"><textarea id="t-b" maxlength="1024">${esc(t.body)}</textarea>
            <div class="tn-vars"><span>Insertar:</span>${TP_VARS.map(v => `<button type="button" data-var="${v}">{{${v}}}</button>`).join('')}<span class="cont" id="tn-cont">${String(t.body || '').length.toLocaleString('es-CO')} / 1.024</span></div></div></div>
        <div class="tn-campo"><label for="t-f">Pie <em>· opcional</em></label><input id="t-f" value="${esc(t.foot)}" maxlength="60" autocomplete="off"></div>
      </section>
      <section class="tn-sec"><h3>Botón <small>Opcional</small></h3>
        <div class="tn-seg" role="group" aria-label="Tipo de botón">${seg('data-tn-btn', [['', 'Sin botón'], ['Respuesta rápida', 'Respuesta rápida'], ['Enlace', 'Enlace'], ['Llamar', 'Llamar']], t.btn)}</div>
        ${t.btn ? `<div class="tn-campo"><label for="t-bt">Texto del botón <em>· hasta 25 letras</em></label><input id="t-bt" value="${esc(t.btnTxt)}" maxlength="25" placeholder="${t.btn === 'Enlace' ? 'Ver más' : t.btn === 'Llamar' ? 'Llamar a mi asesor' : 'Sí, quiero información'}"></div>` : ''}
        ${t.btn === 'Enlace' ? `<div class="tn-campo"><label for="t-bu">Enlace del botón</label><input id="t-bu" value="${esc(t.btnUrl)}" placeholder="https://www.tuempresa.com"></div>` : ''}
        ${t.btn === 'Llamar' ? `<div class="tn-campo"><span>Número a llamar</span>${campoTel('t-bl', t.btnTel || '')}</div>` : ''}
      </section>
      <div class="tn-rev" id="tn-rev">${tnRevision(t)}</div>
    </div>
    <div><div class="tn-vista-tit"><b>Así lo ve el cliente</b><span>Con datos de ejemplo</span></div>
      <div class="tn-tel" aria-label="Vista previa en WhatsApp"><div class="tn-pant"><span class="tn-isla"></span>
        <div class="tn-estado"><span>9:41</span><span class="der"><svg viewBox="0 0 18 12" aria-hidden="true"><rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/><rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/></svg><svg viewBox="0 0 16 12" aria-hidden="true"><path d="M8 11.5 5.6 9a3.4 3.4 0 0 1 4.8 0Z"/><path d="M3.4 6.8a6.5 6.5 0 0 1 9.2 0l-1.2 1.2a4.8 4.8 0 0 0-6.8 0Z"/><path d="M1.1 4.5a9.8 9.8 0 0 1 13.8 0l-1.2 1.2a8.1 8.1 0 0 0-11.4 0Z"/></svg><svg viewBox="0 0 27 12" aria-hidden="true"><rect x=".5" y=".5" width="22" height="11" rx="3.5" fill="none" stroke="#000" stroke-opacity=".4"/><rect x="2" y="2" width="17" height="8" rx="2"/><path d="M24.5 4v4a2 2 0 0 0 0-4Z" fill-opacity=".4"/></svg></span></div>
        <div class="tn-wcab"><span class="atras">${I('back')}</span><span class="ava">${esc(ini)}</span><span class="q"><b>${esc(marca)}<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#25D366" d="M12 1.5 14.6 4l3.5-.4.9 3.4 3.1 1.7-1.3 3.3 1.3 3.3-3.1 1.7-.9 3.4-3.5-.4L12 22.5 9.4 20l-3.5.4-.9-3.4-3.1-1.7L3.2 12 1.9 8.7 5 7l.9-3.4 3.5.4Z"/><path d="m8 12 3 3 5-6" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></b><small>Cuenta de empresa</small></span><span class="ic">${TP_IC.video}${TP_IC.llamar}</span></div>
        <div class="tn-fondo" id="tn-chat">${tnVista(t)}</div>
        <div class="tn-escribir">${I('plus')}<span class="campo2"></span><svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4Z"/><circle cx="12" cy="13" r="3.5"/></svg>${I('mic')}</div>
        <span class="tn-barrita"></span></div></div></div></div>
    <div class="tn-pie"><span>${t.editar ? 'Si solo cambias el nombre o las líneas, se guarda al instante.' : 'Meta la revisa, casi siempre en minutos. Te avisamos cuando la apruebe.'}</span><div>${t.editar ? '' : '<button type="button" class="btn" id="t-guardar">Guardar borrador</button>'}<button type="button" class="btn pri" id="t-meta">${t.editar ? `${I('check')}Guardar cambios` : `${I('send')}Enviar a Meta`}</button></div></div>`;
}

document.getElementById('page').addEventListener('input', e => {
  if (st.pagina !== 'plantillas') return;
  const t = st.tplNueva, x = e.target;
  if (!t) { if (x.id === 'tp-q') { st.tp.q = x.value; const q = norm(x.value); document.querySelectorAll('.tp-fila[data-tp-q]').forEach(f => { f.hidden = !!q && !f.dataset.tpQ.includes(q); }); } return; }
  const k = {'t-n':'nombre', 't-h':'head', 't-b':'body', 't-f':'foot', 't-bt':'btnTxt', 't-bu':'btnUrl'}[x.id];
  if (k) { t[k] = x.value; tnRefrescar(); }
  if (x.closest && x.closest('#t-bl')) t.btnTel = valorTel('t-bl');
});
document.getElementById('page').addEventListener('click', e => {
  if (st.pagina !== 'plantillas') return;
  const x = e.target, t = st.tplNueva;
  if (!t) {
    if (x.closest('[data-tp-nueva]')) { st.tplNueva = tnNueva(); st.tp.menu = null; render(); return; }
    const es = x.closest('[data-tp-estado]'); if (es) { st.tp.estado = es.dataset.tpEstado; render(); return; }
    const li = x.closest('[data-tp-linea]'); if (li) { st.tp.linea = li.dataset.tpLinea; render(); return; }
    const mn = x.closest('[data-tp-menu]'); if (mn) { st.tp.menu = st.tp.menu === mn.dataset.tpMenu ? null : mn.dataset.tpMenu; render(); return; }
    const ed = x.closest('[data-tp-editar]'); if (ed) { const p = PLANTILLAS.find(q => tpClave(q) === ed.dataset.tpEditar); st.tp.menu = null; if (p) { st.tplNueva = tplDesde(p); render(); } return; }
    const br = x.closest('[data-tp-borrar]'); if (br) { const p = PLANTILLAS.find(q => tpClave(q) === br.dataset.tpBorrar); st.tp.menu = null; render(); if (p) tpConfirmarBorrar(p); return; }
    if (st.tp.menu && !x.closest('.tp-menu')) { st.tp.menu = null; render(); }
    return;
  }
  if (x.closest('#t-x')) { st.tplNueva = null; render(); return; }
  const ln = x.closest('[data-tn-linea]'); if (ln) { const id = ln.dataset.tnLinea; t.lineas.has(id) ? t.lineas.delete(id) : t.lineas.add(id); ln.setAttribute('aria-checked', String(t.lineas.has(id))); return; }
  const ct = x.closest('[data-tn-cat]'); if (ct && !ct.disabled) { t.cat = ct.dataset.tnCat; render(); return; }
  const hd = x.closest('[data-tn-head]'); if (hd) { t.headTipo = hd.dataset.tnHead; render(); return; }
  const bt = x.closest('[data-tn-btn]'); if (bt) { t.btn = bt.dataset.tnBtn; render(); return; }
  const va = x.closest('[data-var]'); if (va) { const ta = document.getElementById('t-b'), p = ta.selectionStart ?? ta.value.length; ta.value = ta.value.slice(0, p) + '{{' + va.dataset.var + '}}' + ta.value.slice(ta.selectionEnd ?? p); t.body = ta.value; ta.focus(); const n = p + va.dataset.var.length + 4; ta.setSelectionRange(n, n); tnRefrescar(); return; }
  if (x.closest('#t-vx')) { t.video = null; render(); return; }
  if (x.closest('#t-vadd')) { tnElegirVideo(t); return; }
  if (x.closest('#t-guardar')) { tnBorrador(t); return; }
  const go = x.closest('#t-meta'); if (go && !go.disabled) tnEnviar(t, go);
});
function tnElegirVideo(t){
  const i = document.createElement('input'); i.type = 'file'; i.accept = 'video/mp4'; i.hidden = true; document.body.appendChild(i);
  i.addEventListener('cancel', () => i.remove());
  i.addEventListener('change', () => { const f = (i.files || [])[0]; i.remove(); if (!f) return;
    if (!/^video\/mp4$/.test(f.type || '') && !/\.mp4$/i.test(f.name)) { toast('El video debe ser MP4'); return; }
    if (f.size > 16 * 1024 * 1024) { toast('El video pasa de 16 MB, el máximo de WhatsApp'); return; }
    const v = t.video = {n: f.name, peso: f.size, subiendo: true}; render();
    crmSubir(f).then(r => { Object.assign(v, {n: r.n || f.name, url: r.url, peso: r.bytes || f.size}); delete v.subiendo; }, err => { if (t.video === v) t.video = null; toast(`No se pudo subir el video. ${err.message}`); })
      .finally(() => { if (st.tplNueva === t) render(); }); });
  i.click();
}
// Los borradores son de cada persona (quedan en sus preferencias, AJ.borradores).
function tnBorrador(t){
  const b = {n: t.nombre.trim() || 'Plantilla sin nombre', c: t.cat, e:'g', x:'Borrador', u:0, b: t.body, headTipo: t.headTipo, head: t.head, foot: t.foot, btn: t.btn, btnTxt: t.btnTxt, btnUrl: t.btnUrl, btnTel: t.btnTel, lineas:[...t.lineas], borrador:true};
  AJ.borradores = [b, ...(AJ.borradores || []).filter(x => x.n !== b.n && x.n !== t.borradorDe)];
  crmPlantillas().catch(() => {}).finally(() => { st.tplNueva = null; render(); toast('Plantilla guardada como borrador'); });
}
async function tnEnviar(t, bt){
  if (!t.nombre.trim() || !t.body.trim()) { toast('Ponle nombre y cuerpo a la plantilla'); return; }
  if (LINEAS.length && !t.lineas.size) { toast('Elige al menos una línea donde se use la plantilla'); return; }
  const conVideo = t.headTipo === 'video'; if (conVideo && (!t.video || !t.video.url)) { toast(t.video ? 'Espera a que termine de subir el video' : 'Agrega el video del encabezado'); return; }
  const datos = {n: t.nombre.trim(), c: t.cat, b: t.body, head: t.headTipo === 'texto' ? t.head : '', foot: t.foot || '', btn: t.btn || '', btnTxt: t.btn ? (t.btnTxt || tnTextoBoton(t)) : '', btnUrl: t.btnUrl || '', btnTel: t.btnTel || '',
    lineas: [...t.lineas], ...(conVideo ? {video: {url: t.video.url, n: t.video.n, peso: t.video.peso}} : {})};
  bt.disabled = true;
  try {
    if (t.editar) await crmApi('PUT', `/crm/plantillas/${encodeURIComponent(t.editar)}`, datos);
    else await crmApi('POST', '/crm/plantillas', datos);
    AJ.borradores = (AJ.borradores || []).filter(x => x.n !== datos.n && x.n !== t.borradorDe);
    st.tplNueva = null; await crmPlantillas(); render();
    toast(t.editar ? 'Plantilla guardada' : 'Plantilla enviada a Meta: queda «En revisión»');
  } catch (err) { bt.disabled = false; toast(err.message); }
}
function tpConfirmarBorrar(p){
  const boton = `<button type="button" class="btn pri" style="background:#dc2626;border-color:#dc2626;color:#fff" data-tp-borrarok="${esc(tpClave(p))}">${TP_IC.borrar}Eliminar</button>`;
  if (p.borrador) { abrirDialogo(`<h3>Eliminar el borrador «${esc(p.n)}»</h3><p>Se borra solo de tus borradores. Meta nunca lo vio.</p><div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button>${boton}</div>`); return; }
  const enCola = DIFUSIONES.filter(d => d.t === p.n && (v => v.curso || v.e === 'En cola')(difVista(d))).length;
  abrirDialogo(`<h3>Eliminar «${esc(p.n)}»</h3><p>Se borra en Meta al instante y ya no se puede enviar desde ninguna línea. Los mensajes que ya se enviaron se quedan en las conversaciones.</p>
    <p class="muted">Meta no deja usar el nombre «${esc(p.slug)}» durante 30 días.</p>
    ${enCola ? `<div class="tn-aviso">${TP_IC.alerta}<span>${enCola === 1 ? 'Una difusión en cola usa' : `${enCola} difusiones en cola usan`} esta plantilla y no se ${enCola === 1 ? 'va' : 'van'} a poder enviar.</span></div>` : ''}
    <div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button>${boton}</div>`);
}
document.getElementById('ov-x').addEventListener('click', async e => {
  const b = e.target.closest('[data-tp-borrarok]'); if (!b || b.disabled) return;
  const k = b.dataset.tpBorrarok, p = PLANTILLAS.find(q => tpClave(q) === k); if (!p) { cerrarDialogo(); return; }
  if (p.borrador) { AJ.borradores = (AJ.borradores || []).filter(x => x.n !== p.n); const i = PLANTILLAS.indexOf(p); if (i >= 0) PLANTILLAS.splice(i, 1); cerrarDialogo(); render(); toast('Borrador eliminado'); return; }
  b.disabled = true;
  try { await crmApi('DELETE', `/crm/plantillas/${encodeURIComponent(p.slug)}`); cerrarDialogo(); await crmPlantillas(); render(); toast('Plantilla eliminada'); }
  catch (err) { b.disabled = false; toast(err.message || 'No se pudo eliminar'); }
});
