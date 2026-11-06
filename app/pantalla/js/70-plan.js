/* ── Ajustes → Plan y pagos (rediseño «Estado de cuenta», opción A aprobada el 6-nov; antes v7 del 3-oct): el plan actual con su uso, los planes
   tal como salen en nexcode97.com/precios (los trae el servidor, una sola fuente), el historial de cobros y el
   recibo en PDF, que sale del datáfono imprimiendo. Pagar y cambiar de plan los hace el administrador; el pago es
   dentro de Wali con el checkout incrustado de Whop (pantalla «Pagar el plan»). ── */
document.head.insertAdjacentHTML('beforeend', `<style>

/* ── Pagar el plan dentro de Wali con Whop (maqueta «Pago con Whop», opción A, aprobada el 5-nov) ── */
.wpg-ca{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);gap:20px;margin-top:20px;align-items:start;max-width:1000px}
.wpg-res,.wpg-pago{border:1px solid var(--line);border-radius:18px;padding:20px;display:grid;gap:16px;align-content:start;background:#fff}
.wpg-res-h{display:flex;align-items:center;justify-content:space-between;gap:12px}.wpg-res-h b{font-size:18px;letter-spacing:-.01em}
.wpg-pill{font-size:12px;font-weight:700;padding:3px 9px;border-radius:999px;background:#FFF2B3;color:#5c4400}
.wpg-seg{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;border:1px solid var(--line);border-radius:12px}
.wpg-seg button{min-height:40px;display:flex;align-items:center;justify-content:center;gap:6px;border-radius:9px;font-weight:600;color:#6b7280;font-size:13.5px}
.wpg-seg button[aria-checked="true"]{background:#f3f4f6;color:#111827}.wpg-seg em{font-style:normal;font-size:11.5px;font-weight:700;color:#15803d;background:#dcfce7;padding:1px 6px;border-radius:999px}
.wpg-precio{display:flex;align-items:baseline;gap:8px}.wpg-precio b{font-size:34px;letter-spacing:-.03em}.wpg-precio small{color:#6b7280}
.wpg-lst{margin:0;padding:0;list-style:none;display:grid;gap:9px}.wpg-lst li{display:flex;gap:9px;color:#374151;font-size:13.5px}.wpg-lst svg{width:16px;height:16px;color:#16a34a;margin-top:2px;flex:none}
.wpg-tot{border-top:1px solid #eef0f4;padding-top:14px;display:grid;gap:8px;font-size:13.5px}.wpg-tot div{display:flex;justify-content:space-between;gap:12px;color:#4b5563}.wpg-tot .t{color:#111827;font-weight:700;font-size:15px}
.wpg-dato{display:flex;gap:10px;padding:12px 13px;border-radius:12px;background:#f7f8fa;font-size:13px;color:#374151;text-align:left}.wpg-dato svg{width:17px;height:17px;color:#6b7280;margin-top:1px;flex:none}
.wpg-pago h3{margin:0;font-size:16px}.wpg-whop{min-height:420px}.wpg-cargando{min-height:420px;display:grid;place-items:center;color:#6b7280;font-size:13.5px}
.wpg-seg-pie{display:flex;align-items:center;justify-content:center;gap:6px;font-size:12px;color:#6b7280}.wpg-seg-pie svg{width:14px;height:14px}
.wpg-resu{max-width:520px;margin:56px auto 0;text-align:center;display:grid;gap:14px;justify-items:center}
.wpg-cir{width:72px;height:72px;border-radius:50%;display:grid;place-items:center}.wpg-cir svg{width:34px;height:34px;stroke-width:2.4}.wpg-cir.ok{background:#FFD21F;color:#0a0a0d}.wpg-cir.mal{background:#fee2e2;color:#dc2626}
.wpg-resu h2{margin:4px 0 0;font-size:26px}.wpg-resu p{margin:0;color:#4b5563;font-size:15px}
.wpg-recibo{width:100%;border:1px solid var(--line);border-radius:16px;padding:6px 16px;text-align:left}.wpg-recibo div{display:flex;justify-content:space-between;gap:12px;padding:11px 0;border-top:1px solid #eef0f4;font-size:13.5px;color:#4b5563}.wpg-recibo div:first-child{border-top:0}.wpg-recibo b{color:#111827;font-weight:600}
.wpg-bts{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;width:100%}
@media (max-width:900px){.wpg-ca{grid-template-columns:minmax(0,1fr)}}
@media (max-width:560px){.wpg-lst{display:none}.wpg-res,.wpg-pago{padding:16px}.wpg-resu{margin-top:36px}.wpg-resu h2{font-size:22px}}

.pl-ok{display:flex;align-items:center;gap:10px;margin:0 0 16px;padding:12px 16px;border-radius:12px;background:var(--green-soft);color:var(--green-ink);font-size:13.5px;font-weight:600}
.pl-ok svg{width:18px;height:18px;flex:none}
.pl-actual{background:#fff;border:1px solid var(--line);border-radius:18px;overflow:hidden}
.pl-cab{display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;padding:22px 24px}
.pl-id{display:flex;align-items:center;gap:16px;min-width:0;flex:1 1 380px}
.pl-id > div{min-width:0;max-width:600px}
.pl-sello{flex:none;width:52px;height:52px;border-radius:14px;background:#0b0b10;color:#FFD21F;display:grid;place-items:center;font-size:24px;font-weight:800;letter-spacing:-.04em}
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
.pl-chip{font-size:11.5px;font-weight:700;padding:2px 9px;border-radius:999px;background:#FFD21F;color:#0b0b10}
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
.pl-plan .btn.amarillo{background:#FFD21F;border-color:#FFD21F;color:#0b0b10;font-weight:600}
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
.pl-soporte{margin:14px 0 0;text-align:center;font-size:13px;color:var(--ink3)}
.pl-soporte a{color:var(--ink);font-weight:600;text-decoration:underline;text-underline-offset:3px}
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
.pl-papel .logo{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:50%;background:#FFD21F;font-family:Inter,sans-serif;font-weight:800;font-size:13px;margin-bottom:4px}
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

/* ── Plan y pagos, opción A «Estado de cuenta» (maqueta aprobada el 6-nov). Una curva (ease-out-quint), tres duraciones. ── */
@property --pla-n{syntax:"<integer>";inherits:false;initial-value:0}
.pla{--pla-ease:cubic-bezier(.22,1,.36,1);--pla-sol2:#FFF6CC}
.pla > h2{margin-bottom:26px}
.pla-e{animation:pla-sube .64s var(--pla-ease) both}
.pla-e2{animation-delay:45ms}.pla-e3{animation-delay:90ms}.pla-e4{animation-delay:135ms}.pla-e5{animation-delay:180ms}.pla-e6{animation-delay:225ms}.pla-e7{animation-delay:270ms}
@keyframes pla-sube{from{opacity:0;transform:translateY(10px)}}
.pla-cnt{--pla-n:var(--to);counter-reset:pla var(--pla-n);animation:pla-cuenta 1.1s var(--pla-ease) .26s both;font-variant-numeric:tabular-nums}
.pla-cnt::after{content:counter(pla)}
@keyframes pla-cuenta{from{--pla-n:0}}
.pla-kick{margin:0;font-size:12px;font-weight:600;color:var(--ink3);letter-spacing:.02em}
.pla-ext{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:28px;align-items:end;padding:22px 0 26px;border-top:2px solid var(--ink)}
.pla-nom{margin:8px 0 12px;font-size:56px;font-weight:700;letter-spacing:-.045em;line-height:1;color:var(--ink)}
.pla-vivo{display:inline-flex;align-items:center;gap:8px;margin:0;font-size:13px;font-weight:600}
.pla-vivo i{position:relative;width:8px;height:8px;border-radius:50%;background:currentColor}
.pla-vivo.ok{color:var(--green-ink)}.pla-vivo.aviso{color:#b45309}.pla-vivo.mal{color:var(--red-ink)}.pla-vivo.neutro{color:var(--ink2)}
.pla-vivo.ok i::after{content:"";position:absolute;inset:-4px;border-radius:50%;border:2px solid currentColor;opacity:0;animation:pla-latido 2.4s var(--pla-ease) 1s infinite}
@keyframes pla-latido{0%{transform:scale(.6);opacity:.55}70%,100%{transform:scale(1.6);opacity:0}}
.pla-texto{margin:10px 0 0;color:var(--ink2);font-size:13.5px;max-width:62ch}.pla-texto b{color:var(--ink);font-weight:600}
.pla-acc{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.pla-ext-b{display:grid;gap:6px;justify-items:end;text-align:right}
.pla-monto{margin:0;display:flex;align-items:baseline;gap:8px;line-height:1;color:var(--ink)}
.pla-monto .pla-u{font-size:18px;font-weight:600;color:var(--ink3)}
.pla-monto .pla-cnt,.pla-monto .pla-txt{font-size:56px;font-weight:700;letter-spacing:-.045em}
.pla-monto .pla-txt{font-size:40px}
.pla-cuando{margin:0;display:flex;align-items:center;gap:7px;color:var(--ink2);font-size:13.5px}.pla-cuando svg{width:15px;height:15px}
.pla-regla{padding:4px 0 26px;border-bottom:1px solid var(--line)}
.pla-ticks{position:relative;display:grid;gap:4px;height:44px;align-items:end;padding-top:26px}
.pla-ticks i{display:block;height:16px;border-radius:3px;background:var(--line);transform-origin:bottom;animation:pla-crece .52s var(--pla-ease) both;animation-delay:calc(200ms + var(--k) * 11ms)}
.pla-ticks i.pasa{background:var(--ink3)}
.pla-ticks i.ya{background:#FFD21F;box-shadow:0 0 0 3px var(--pla-sol2)}
@keyframes pla-crece{from{transform:scaleY(0)}}
.pla-hoy{position:absolute;top:0;font-size:12px;font-weight:600;white-space:nowrap;animation:pla-sube .48s var(--pla-ease) .52s both}
.pla-hoy span{background:var(--ink);color:#fff;padding:3px 8px;border-radius:7px}
.pla-regla-p{display:flex;justify-content:space-between;gap:10px;margin-top:10px;font-size:12.5px;color:var(--ink3)}.pla-regla-p b{color:var(--ink)}
.pla-uso{display:grid;padding:8px 0 4px}
.pla-uso-f{display:grid;grid-template-columns:150px minmax(0,1fr) 120px;align-items:center;gap:16px;min-height:58px;border-bottom:1px solid var(--line2)}
.pla-uso-k{font-weight:500;color:var(--ink)}.pla-uso-f.off .pla-uso-k{color:var(--ink3)}
.pla-uso-v{text-align:right;color:var(--ink3);font-variant-numeric:tabular-nums}.pla-uso-v b{color:var(--ink);font-size:16px}
.pla-sillas{display:flex;flex-wrap:wrap;gap:8px}
.pla-silla{flex:none;width:34px;height:34px;border-radius:50%;border:1.5px dashed var(--ink3);display:block;animation:pla-pop .42s var(--pla-ease) both;animation-delay:calc(320ms + var(--k) * 50ms)}
.pla-silla.llena{border:0;background:var(--ink);color:#fff}.pla-silla.sobre{background:#d97706}
.pla-silla svg{display:block;width:100%;height:100%}.pla-silla text{fill:currentColor;font:600 13px Inter,system-ui,sans-serif;letter-spacing:.02em}
@keyframes pla-pop{from{transform:scale(.4);opacity:0}}
.pla-pista{display:block;height:8px;border-radius:99px;background:var(--line2);overflow:hidden}
.pla-pista span{display:block;height:100%;background:var(--ink);border-radius:99px;transform-origin:left;transform:scaleX(var(--w));animation:pla-llena .9s var(--pla-ease) .38s both}
@keyframes pla-llena{from{transform:scaleX(0)}}
.pla-abierto{display:block;height:0;border-top:1.5px dotted var(--line)}
.pla-cand{display:flex;align-items:center;gap:7px;color:var(--ink3);font-size:13px}.pla-cand svg{width:15px;height:15px}
.pla-esc{margin-top:40px}
.pla-esc-h{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap}
.pla-esc-h h3{margin:0;font-size:17px;font-weight:700;color:var(--ink)}.pla-esc-h p{margin:4px 0 0;color:var(--ink3);font-size:13.5px;max-width:62ch}
.pla-seg{display:inline-flex;gap:2px;padding:3px;border-radius:12px;background:var(--bg2);border:1px solid var(--line2)}
.pla-seg button{min-height:38px;padding:0 14px;border-radius:9px;font-weight:600;font-size:13px;color:var(--ink3);display:inline-flex;align-items:center;gap:7px;transition:background .32s var(--pla-ease),color .32s var(--pla-ease),box-shadow .32s var(--pla-ease)}
.pla-seg button[aria-checked="true"]{background:#fff;color:var(--ink);box-shadow:0 1px 2px rgba(15,15,20,.08),0 0 0 1px var(--line)}
.pla-seg em{font-style:normal;font-size:11px;font-weight:700;color:var(--green-ink);background:var(--green-soft);padding:1px 6px;border-radius:999px}
.pla-riel{position:relative;display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));margin-top:28px}
.pla-riel::before{content:"";position:absolute;left:12px;right:12px;top:11px;height:2px;background:var(--line)}
.pla-riel-f{position:absolute;left:12px;right:12px;top:11px;height:2px;background:var(--ink);transform-origin:left;transform:scaleX(var(--hasta));animation:pla-riel .7s var(--pla-ease) .42s both}
@keyframes pla-riel{from{transform:scaleX(0)}}
.pla .pla-paso{border:0;background:none;box-shadow:none;outline:0}
.pla-paso{position:relative;display:grid;gap:4px;justify-items:start;align-content:start;text-align:left;padding:0 16px 16px 0;border-radius:14px;color:var(--ink);animation:pla-sube .52s var(--pla-ease) both;animation-delay:calc(260ms + var(--k) * 60ms)}
.pla-pt{width:24px;height:24px;border-radius:50%;background:#fff;border:2px solid var(--line);margin-bottom:12px;transition:transform .32s var(--pla-ease),border-color .32s var(--pla-ease),background .32s var(--pla-ease),box-shadow .32s var(--pla-ease)}
.pla-paso.hecho .pla-pt{background:var(--ink);border-color:var(--ink)}
.pla-paso:hover .pla-pt{transform:scale(1.12)}
.pla-paso.sel .pla-pt{border-color:var(--ink);background:#FFD21F;box-shadow:0 0 0 6px var(--pla-sol2);transform:scale(1.08)}
.pla .pla-paso:focus-visible{outline:2px solid var(--ink);outline-offset:4px}
.pla-pn{font-size:18px;font-weight:700;letter-spacing:-.02em}
.pla-paso.sel .pla-pn{text-decoration:underline;text-decoration-color:#FFD21F;text-decoration-thickness:3px;text-underline-offset:5px}
.pla-pp{font-size:14px;font-weight:600;font-variant-numeric:tabular-nums}.pla-pp small{color:var(--ink3);font-weight:500}
.pla-pg{font-size:12.5px;color:var(--ink3);max-width:32ch}
.pla-det{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-top:8px;padding:18px 20px;border-radius:16px;background:var(--pla-sol2);flex-wrap:wrap;animation:pla-sube .32s var(--pla-ease) both}
.pla-det ul{margin:0;padding:0;list-style:none;display:flex;gap:10px 22px;flex-wrap:wrap}
.pla-det li{display:flex;align-items:center;gap:8px;font-size:13.5px;color:var(--ink2)}.pla-det li b{color:var(--ink)}.pla-det li svg{width:16px;height:16px;color:var(--green-ink);flex:none}
.pla .btn.pla-pri{background:#FFD21F;border-color:#FFD21F;color:#0b0b10;font-weight:600;min-height:44px;padding:0 18px;gap:8px}
.pla .btn.pla-pri svg{width:16px;height:16px;transition:transform .18s var(--pla-ease)}.pla .btn.pla-pri:hover svg{transform:translateX(3px)}
.pla .btn.pla-pri:hover{background:#f5c800;border-color:#f5c800}.pla .btn.pla-pri:disabled{opacity:.55;cursor:default}
.pla .btn{transition:transform .18s var(--pla-ease)}.pla .btn:active{transform:scale(.97)}
.pla-led{margin-top:40px}
.pla-led-h{display:flex;justify-content:space-between;align-items:center;gap:12px;padding-bottom:8px;border-bottom:2px solid var(--ink)}
.pla-led-h h3{margin:0;font-size:17px;font-weight:700;color:var(--ink)}
.pla-fan{border-color:transparent;background:none;color:var(--ink2)}
.pla-led-f{display:grid;grid-template-columns:110px auto minmax(24px,1fr) auto auto 40px;align-items:center;gap:14px;min-height:60px;border-bottom:1px solid var(--line2);font-size:13.5px;color:var(--ink)}
.pla-lf{color:var(--ink3);font-variant-numeric:tabular-nums}.pla-per{color:var(--ink3)}
.pla-dots{border-bottom:1.5px dotted var(--ink3);height:1px;opacity:.6}
.pla-lm{font-weight:700;font-variant-numeric:tabular-nums}
.pla-rec{width:40px;height:40px;border-radius:10px;display:grid;place-items:center;color:var(--ink2);transition:background .18s var(--pla-ease),color .18s var(--pla-ease)}.pla-rec:hover{background:var(--bg3);color:var(--ink)}.pla-rec svg{width:17px;height:17px}
.pla-vacio{margin:0;padding:28px 0;color:var(--ink3);font-size:13.5px}
.pla-fin{display:grid;gap:4px;margin-top:36px;padding-top:22px;border-top:1px solid var(--line2)}
.pla-nota{display:flex;gap:10px;margin:0;color:var(--ink2);font-size:13px;max-width:80ch}.pla-nota svg{width:17px;height:17px;flex:none;color:var(--green-ink);margin-top:2px}.pla-nota b{color:var(--ink)}
.pla .pl-soporte{text-align:left}
@media (max-width:900px){.pla-nom,.pla-monto .pla-cnt{font-size:48px}}
@media (max-width:640px){
  .pla-ext{grid-template-columns:1fr;gap:18px}.pla-ext-b{justify-items:start;text-align:left}.pla-nom,.pla-monto .pla-cnt{font-size:44px}.pla-monto .pla-txt{font-size:32px}
  .pla-ticks{gap:2px}.pla-hoy{transform:translateX(0)}
  .pla-uso-f{grid-template-columns:1fr auto;grid-template-areas:"k v" "b b";padding:12px 0;gap:10px}.pla-uso-k{grid-area:k}.pla-uso-v{grid-area:v}.pla-uso-f > :nth-child(2){grid-area:b}
  .pla-riel{grid-template-columns:1fr;gap:6px}.pla-riel::before,.pla-riel-f{display:none}
  .pla .pla-paso{grid-template-columns:24px 1fr auto;grid-template-areas:"t n p" "t g g";column-gap:12px;padding:12px;border:1px solid var(--line2)}
  .pla-pt{grid-area:t;margin:0}.pla-pn{grid-area:n;font-size:16px}.pla-pp{grid-area:p}.pla-pg{grid-area:g}.pla .pla-paso.sel{border-color:var(--ink)}
  .pla-det{flex-direction:column;align-items:stretch}.pla-det ul{flex-direction:column}.pla-det .btn{width:100%;justify-content:center}
  .pla-led-f{grid-template-columns:1fr auto 40px;grid-template-areas:"d m r" "f o r";row-gap:2px;padding:10px 0}.pla-lf{grid-area:f;font-size:12.5px}.pla-ld{grid-area:d}.pla-lm{grid-area:m}.pla-led-f .pl-pago{grid-area:o;justify-self:end}.pla-led-f > :last-child{grid-area:r}.pla-dots,.pla-per{display:none}
  .pla-acc .btn{flex:1;justify-content:center}
}
.pla-quieto .pla-e,.pla-quieto .pla-ticks i,.pla-quieto .pla-hoy,.pla-quieto .pla-silla,.pla-quieto .pla-pista span,.pla-quieto .pla-riel-f,.pla-quieto .pla-paso,.pla-quieto .pla-cnt{animation:none}
@media (prefers-reduced-motion:reduce){.pla *,.pla *::before,.pla *::after{animation:none!important;transition:none!important}}
</style>`);

let PLAN = null, planCargando = null;
st.plPeriodo = '';
const PL_NOMBRE = {starter:'Starter', growth:'Growth', business:'Business'};
// El correo de soporte de los cobros (debe verse dentro del producto).
const PL_SOPORTE = 'nexcode97@gmail.com';
// Si el sitio no respondió, la pantalla muestra al menos el nombre y el precio de cada plan.
const PL_RESPALDO = [
  {id:'starter', nombre:'Starter', mensual:99, anual:'950', ficha:[], incluye:[]},
  {id:'growth', nombre:'Growth', mensual:179, anual:'1.718', destacado:true, ficha:[], incluye:[]},
  {id:'business', nombre:'Business', mensual:299, anual:'2.870', ficha:[], incluye:[]},
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
    const dias = P.diasPrueba ?? 0, total = P.duracionPrueba || 10;
    return {sello:'P', nombre:'Prueba con todo', chip:['prueba', 'Prueba gratis'], texto:['Tu prueba termina el ', [plFecha(P.pruebaHasta, true)], '. Elige un plan antes para no perder el acceso.'],
      medidas:[['Prueba gratis', `${dias} ${dias === 1 ? 'día' : 'días'}`, `de ${total}`, Math.max(0, total - dias) / total * 100, null, '', dias <= 3], mUsuarios, mAgentes], acciones:[['pri', 'Elegir plan', 'planes']]};
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
  if (P.estado === 'pago-pendiente') return {sello:nombre[0], nombre, chip:['aviso', 'Pago pendiente'], texto:['No pudimos cobrar tu tarjeta. Lo volvemos a intentar en los próximos días; ', ['actualízala para no perder el acceso'], '.'],
    medidas:[mUsuarios, mAgentes, ['Próximo intento', plFecha(P.renuevaEl) || 'Pronto', null, null, plPrecioTxt(P.plan, P.periodo)]], acciones:[['pri', 'Actualizar tarjeta', 'portal']]};
  return {sello:nombre[0], nombre, chip: noRenueva ? ['aviso', 'No se renueva'] : ['activo', `Activo · ${P.periodo === 'anual' ? 'Anual' : 'Mensual'}`],
    texto: noRenueva ? ['Tu plan sigue activo hasta el ', [plFecha(P.renuevaEl, true)], ' y no se renueva.'] : [[plPrecioTxt(P.plan, P.periodo)], ' · se renueva solo, sin que hagas nada.'],
    medidas:[mUsuarios, mAgentes, [noRenueva ? 'Activo hasta' : 'Próximo cobro', plFecha(P.renuevaEl) || '—', null, null, noRenueva ? 'Sin más cobros' : plPrecioTxt(P.plan, P.periodo)]],
    acciones: noRenueva ? [['pri', `Renovar ${nombre}`, 'renovar']] : P.portal ? [['', 'Facturas y tarjeta', 'portal']] : []};
}

/* ── Opción A «Estado de cuenta» (maqueta aprobada el 6-nov): el plan se lee como un extracto, con la regla del
   periodo, los puestos del equipo, la escalera de planes y los pagos en renglones. ── */
const plaPrecio = (id, periodo) => { const p = plDe(id); return periodo === 'anual' ? `USD ${p.anual}` : `USD ${p.mensual}`; };

// Lo grande de la derecha: el próximo cobro, los días de prueba, cuándo venció…
function plaLado(P, v){
  const nombre = PL_NOMBRE[P.plan] || 'Starter', per = P.periodo === 'anual' ? 'anual' : 'mensual';
  const noRenueva = P.estado === 'cancelado' || P.cancelaAlFinal;
  if (P.estado === 'interno') return {k:'Cobro', u:'', n:null, txt:'Sin cobro', sub:'Espacio interno de NexCode97'};
  if (P.estado === 'prueba' && P.vigente) return {k:'Prueba gratis', u:'', n:P.diasPrueba ?? 0, unidad:(P.diasPrueba === 1 ? 'día' : 'días'), sub:`Termina el ${plFecha(P.pruebaHasta, true)}`};
  if (!P.vigente) return {k:'Venció', u:'', n:null, txt:plFecha(P.estado === 'prueba' ? P.pruebaHasta : P.renuevaEl) || '—', sub:'No se borró nada'};
  const precio = String(per === 'anual' ? plDe(P.plan).anual : plDe(P.plan).mensual), n = /^\d+$/.test(precio) ? +precio : null;
  if (P.estado === 'pago-pendiente') return {k:'Próximo intento', u:'USD', n, txt:precio, sub:P.renuevaEl ? plFechaDia(P.renuevaEl) : 'En los próximos días'};
  if (noRenueva) return {k:'Activo hasta', u:'', n:null, txt:plFecha(P.renuevaEl) || '—', sub:'Sin más cobros'};
  return {k:'Próximo cobro', u:'USD', n, txt:precio, sub:P.renuevaEl ? plFechaDia(P.renuevaEl) : ''};
}
const PL_DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const plFechaDia = iso => { const b = new Date(new Date(iso).getTime() - 5 * 3600e3); const d = PL_DIAS[b.getUTCDay()]; return `${d[0].toUpperCase()}${d.slice(1)} ${plFecha(iso, true).replace(/ de \d{4}$/, '')}`; };

// La regla del periodo: un tick por día (por mes si es anual); el de hoy en amarillo.
function plaRegla(P){
  const DIA = 864e5, ahora = Date.now();
  let total, hecho, desde, hasta, unidad = 'día';
  if (P.estado === 'prueba' && P.vigente && P.pruebaHasta) {
    total = Math.max(P.duracionPrueba || 10, P.diasPrueba || 0); hasta = P.pruebaHasta; desde = new Date(new Date(hasta).getTime() - total * DIA).toISOString();
    hecho = Math.min(total, Math.max(1, total - (P.diasPrueba ?? 0) + 1));
  } else if (P.vigente && P.estado !== 'interno' && P.renuevaEl) {
    const anual = P.periodo === 'anual'; hasta = P.renuevaEl;
    const ult = (P.historial || []).find(h => h.estado === 'pagado' && h.desde && h.hasta);
    desde = ult && Math.abs(new Date(ult.hasta) - new Date(hasta)) < 3 * DIA ? ult.desde : new Date(new Date(hasta).getTime() - (anual ? 365 : 30) * DIA).toISOString();
    const largo = Math.max(1, new Date(hasta) - new Date(desde));
    if (anual) { total = 12; unidad = 'mes'; hecho = Math.min(12, Math.max(1, Math.ceil((ahora - new Date(desde)) / largo * 12))); }
    else { total = Math.max(1, Math.round(largo / DIA)); hecho = Math.min(total, Math.max(1, Math.ceil((ahora - new Date(desde)) / DIA))); }
  } else return '';
  const quedan = Math.max(0, total - hecho);
  const ticks = Array.from({length: total}, (_, k) => `<i style="--k:${k}" class="${k < hecho - 1 ? 'pasa' : k === hecho - 1 ? 'ya' : ''}"></i>`).join('');
  const pos = Math.min(92, Math.max(0, (hecho - 1) / total * 100));
  const pl = unidad === 'mes' ? (quedan === 1 ? 'mes' : 'meses') : (quedan === 1 ? 'día' : 'días');
  return `<section class="pla-regla pla-e pla-e3" aria-label="${esc(`Periodo: ${unidad} ${hecho} de ${total}`)}">
    <div class="pla-ticks" style="grid-template-columns:repeat(${total},minmax(0,1fr))">${ticks}<b class="pla-hoy" style="left:${pos}%"><span>Hoy · ${unidad} ${hecho} de ${total}</span></b></div>
    <div class="pla-regla-p"><span>${esc(plFecha(desde).replace(/ \d{4}$/, ''))}</span><span>Quedan <b class="pla-cnt" style="--to:${quedan}"></b> ${pl}${P.estado === 'prueba' ? ' de prueba' : ' pagados'}</span><span>${esc(plFecha(hasta).replace(/ \d{4}$/, ''))}</span></div></section>`;
}

// Uso: puestos del equipo (hasta 15), barra para lo demás.
function plaUso(P){
  const uso = P.uso || {usuarios:0, agentesIA:0, espacios:1}, lim = P.limites || {};
  const fila = (k, cuerpo, v, off) => `<div class="pla-uso-f${off ? ' off' : ''}"><span class="pla-uso-k">${k}</span>${cuerpo}<span class="pla-uso-v">${v}</span></div>`;
  // Sin límite no hay barra que llenar: una línea punteada dice que sigue abierto.
  const barra = (n, t) => t ? `<span class="pla-pista"><span style="--w:${Math.min(1, n / t)}"></span></span>` : '<span class="pla-abierto" aria-hidden="true"></span>';
  let personas;
  if (lim.usuarios && lim.usuarios <= 15) {
    const nombres = (typeof USUARIOS !== 'undefined' ? USUARIOS : []).map(u => u.nombre).filter(Boolean);
    const n = uso.usuarios, tope = Math.max(lim.usuarios, n);
    personas = `<span class="pla-sillas" aria-hidden="true">${Array.from({length: tope}, (_, k) => k < n
      ? `<span class="pla-silla llena${k >= lim.usuarios ? ' sobre' : ''}" style="--k:${k}"><svg viewBox="0 0 40 40"><text x="20" y="20" dy="0.36em" text-anchor="middle">${esc(ini(nombres[k] || '') || '·')}</text></svg></span>`
      : `<span class="pla-silla" style="--k:${k}"></span>`).join('')}</span>`;
    personas = fila('Personas', personas, `<b>${n}</b> de ${lim.usuarios}`);
  } else personas = fila('Personas', barra(1, 0), `<b>${uso.usuarios}</b>${lim.usuarios ? ` de ${lim.usuarios}` : ' · sin límite'}`);
  const esp = fila('Espacios', barra(uso.espacios || 1, lim.espacios || 0), `<b>${uso.espacios || 1}</b>${lim.espacios ? ` de ${lim.espacios}` : ' · sin límite'}`);
  const ag = lim.agentesIA === 0
    ? fila('Agentes de IA', `<span class="pla-cand">${I('lock')}Llegan con Growth</span>`, '—', true)
    : fila('Agentes de IA', barra(uso.agentesIA, lim.agentesIA || 0), `<b>${uso.agentesIA}</b>${lim.agentesIA ? ` de ${lim.agentesIA}` : ' · sin límite'}`);
  return `<section class="pla-uso pla-e pla-e4" aria-label="Uso">${personas}${esp}${ag}</section>`;
}

// Escalera de planes: un escalón por plan; el elegido abre lo que ganas frente al tuyo.
function plaEscalera(P){
  if (P.estado === 'interno') return '';
  const cat = plCatalogo(), per = st.plPeriodo === 'anual' ? 'anual' : 'mensual', anual = per === 'anual';
  const noRenueva = P.estado === 'cancelado' || P.cancelaAlFinal;
  const pagado = P.vigente && ['activo', 'pago-pendiente', 'cancelado'].includes(P.estado);
  const iActual = P.estado === 'prueba' ? -1 : cat.findIndex(p => p.id === P.plan);
  if (!st.plVer || !cat.some(p => p.id === st.plVer)) st.plVer = (cat[iActual + 1] || cat.find(p => p.destacado) || cat[0]).id;
  const mio = p => pagado && !noRenueva && p.id === P.plan && (P.periodo || 'mensual') === per;
  const fichaDe = p => Object.fromEntries((p.ficha || []).map(f => [f.k, f]));
  const actual = iActual >= 0 ? cat[iActual] : null, fA = actual ? fichaDe(actual) : {};
  const gana = p => {
    if (actual && p.id === actual.id) return 'Tu plan';
    const d = (p.ficha || []).filter(f => !fA[f.k] || fA[f.k].v !== f.v).slice(0, 2).map(f => `${f.k}: ${f.v}`);
    return d.join(' · ') || (p.incluye || [])[0] || '';
  };
  const pasos = cat.map((p, k) => `<button type="button" class="pla-paso${p.id === st.plVer ? ' sel' : ''}${k <= iActual ? ' hecho' : ''}" data-pl-ver="${esc(p.id)}" aria-pressed="${p.id === st.plVer}" style="--k:${k}">
    <span class="pla-pt" aria-hidden="true"></span><span class="pla-pn">${esc(p.nombre)}</span><span class="pla-pp">USD ${esc(anual ? p.anual : String(p.mensual))} <small>${anual ? 'al año' : 'al mes'}</small></span><span class="pla-pg">${esc(gana(p))}</span></button>`).join('');
  const sel = cat.find(p => p.id === st.plVer) || cat[0];
  const difs = actual && sel.id !== actual.id ? (sel.ficha || []).filter(f => !fA[f.k] || fA[f.k].v !== f.v) : (sel.ficha || []);
  const lista = (difs.length ? difs.slice(0, 4).map(f => `<li>${I('check')}<span>${esc(f.k)}: <b>${esc(f.v)}</b></span></li>`) : (sel.incluye || []).slice(0, 4).map(x => `<li>${I('check')}<span>${esc(x)}</span></li>`)).join('');
  const txt = mio(sel) ? 'Tu plan actual' : pagado && !noRenueva ? `Cambiar a ${sel.nombre}` : sel.id === P.plan && P.estado !== 'prueba' ? `Renovar ${sel.nombre}` : `Elegir ${sel.nombre}`;
  const boton = `<button type="button" class="btn pla-pri" data-pl-pagar="${esc(sel.id)}" ${mio(sel) || !P.administra ? 'disabled' : ''} ${!P.administra ? 'title="Solo el administrador puede cambiar el plan"' : ''}>${esc(txt)}${mio(sel) ? '' : I('next')}</button>`;
  const ayuda = pagado && !noRenueva ? `Tu plan cambia hoy. El nuevo precio se cobra el ${esc(plFecha(P.renuevaEl, true))}, cuando termina lo que ya pagaste.`
    : P.estado === 'prueba' && P.vigente ? `Eliges hoy y el primer cobro es el ${esc(plFecha(P.pruebaHasta, true))}, cuando termina tu prueba.`
    : 'Pagas con tarjeta, Apple Pay, Google Pay o PayPal. Cancelas cuando quieras.';
  const iRiel = Math.max(0, iActual);
  return `<section class="pla-esc pla-e pla-e5" id="pl-planes" aria-label="Planes">
    <div class="pla-esc-h"><div><h3>${pagado && !noRenueva ? 'Sube cuando tu equipo crezca' : 'Elige tu plan'}</h3><p>${ayuda}</p></div>
      <div class="pla-seg" role="radiogroup" aria-label="Cómo pagas"><button type="button" role="radio" aria-checked="${!anual}" data-pl-per="mensual">Mensual</button><button type="button" role="radio" aria-checked="${anual}" data-pl-per="anual">Anual <em>−20 %</em></button></div></div>
    <div class="pla-riel" style="--n:${cat.length}"><span class="pla-riel-f" style="--hasta:${iActual < 0 ? 0 : (iRiel + .5) / cat.length}"></span>${pasos}</div>
    <div class="pla-det" data-k="${esc(sel.id + per)}"><ul>${lista}</ul>${boton}</div>
  </section>`;
}

function plaPagos(P){
  const H = P.historial || [];
  const filas = H.length ? H.map(h => `<div class="pla-led-f">
      <span class="pla-lf">${esc(plFecha(h.fecha))}</span>
      <span class="pla-ld">${esc(PL_NOMBRE[h.plan] || h.plan)} ${h.periodo === 'anual' ? 'anual' : 'mensual'}${h.desde && h.hasta ? ` <span class="pla-per">· ${esc(plFecha(h.desde).replace(/ \d{4}$/, ''))} a ${esc(plFecha(h.hasta).replace(/ \d{4}$/, ''))}</span>` : ''}${h.cupon ? ` <span class="pla-per">· cupón ${esc(h.cupon)}</span>` : ''}</span>
      <span class="pla-dots" aria-hidden="true"></span>
      <span class="pla-lm">${esc(plDinero(h.total, h.moneda))}</span>
      <span class="pl-pago ${esc(h.estado)}"><i></i>${esc({pagado:'Pagado', rechazado:'Rechazado', reembolsado:'Reembolsado'}[h.estado] || h.estado)}</span>
      ${h.estado === 'rechazado' || !P.administra ? '<span></span>' : `<button type="button" class="pla-rec" data-pl-recibo="${+h.numero}" aria-label="Descargar el recibo del ${esc(plFecha(h.fecha))}">${I('download')}</button>`}</div>`).join('')
    : '<p class="pla-vacio">Todavía no tienes pagos. Cuando elijas un plan, cada cobro aparecerá aquí con su recibo.</p>';
  return `<section class="pla-led pla-e pla-e6" aria-label="Pagos"><div class="pla-led-h"><h3>Pagos</h3>${P.portal && P.administra ? `<button type="button" class="btn pla-fan" data-pl-acc="portal">${I('link')}Facturas y tarjeta</button>` : ''}</div>${filas}</section>`;
}

function paginaPlan(){
  const volver = `<button type="button" class="volver" data-ir="ajustes-crm">${I('back')}Ajustes del CRM</button>`;
  const cab = `${volver}<h2>Plan y pagos</h2>`;
  if (!PLAN) {
    cargarPlan().then(() => { if (st.pagina === 'cfg-plan') render(); }, err => { if (st.pagina === 'cfg-plan') { st.plError = err.message; render(); } });
    return `<div class="ajw ancho pl pla">${cab}<div class="pl-carga">${st.plError ? `${esc(st.plError)}<br><br><button type="button" class="btn" data-pl-reintentar="1">Intentar de nuevo</button>` : 'Cargando tu plan…'}</div></div>`;
  }
  if (st.plResultado) return plPaginaResultado(PLAN);
  if (st.plPago) return plPaginaPago(PLAN);
  const P = PLAN, v = planVista(P), lado = plaLado(P, v);
  // La entrada corre al abrir la página; si se vuelve a dibujar (elegir escalón, mensual/anual) solo se anima lo que cambia.
  const quieto = !!document.querySelector('#page .pla-ext');
  const ok = st.pagoOk ? `<div class="pl-ok" role="status">${I('check')}${P.estado === 'activo' ? `¡Pago recibido! Tu plan ${esc(PL_NOMBRE[P.plan] || '')} quedó activo.` : 'Pago recibido. Estamos activando tu plan, tarda unos segundos…'}</div>` : '';
  const acciones = P.administra ? v.acciones.filter(([, , a]) => a !== 'planes').map(([c, t, a]) => `<button type="button" class="btn ${c === 'pri' ? 'pla-pri' : ''}" data-pl-acc="${a}">${a === 'portal' ? I('link') : ''}${esc(t)}</button>`).join('')
    : v.acciones.length ? '<span class="pl-nota">Solo el administrador del espacio puede pagar o cambiar el plan.</span>' : '';
  const tono = {activo:'ok', prueba:'aviso', aviso:'aviso', vencido:'mal'}[v.chip[0]] || 'neutro';
  const grande = lado.n != null ? `<span class="pla-cnt" style="--to:${lado.n}"></span>${lado.unidad ? `<span class="pla-u">${esc(lado.unidad)}</span>` : ''}` : `<span class="pla-txt">${esc(lado.txt)}</span>`;
  const extracto = `<section class="pla-ext pla-e pla-e2" aria-label="Tu plan">
    <div class="pla-ext-a"><p class="pla-kick">Tu plan</p><h3 class="pla-nom">${esc(v.nombre)}</h3>
      <p class="pla-vivo ${tono}"><i></i>${esc(v.chip[1])}</p>
      <p class="pla-texto">${v.texto.map(x => Array.isArray(x) ? `<b>${esc(x[0])}</b>` : esc(x)).join('')}</p>
      ${acciones ? `<div class="pla-acc">${acciones}</div>` : ''}</div>
    <div class="pla-ext-b"><p class="pla-kick">${esc(lado.k)}</p><p class="pla-monto">${lado.u ? `<span class="pla-u">${lado.u}</span>` : ''}${grande}</p>${lado.sub ? `<p class="pla-cuando">${['Próximo cobro', 'Próximo intento', 'Prueba gratis'].includes(lado.k) ? I('calendar') : ''}${esc(lado.sub)}</p>` : ''}</div></section>`;
  return `<div class="ajw ancho pl pla${quieto ? ' pla-quieto' : ''}">${cab}${ok}${extracto}${plaRegla(P)}${plaUso(P)}${plaEscalera(P)}${plaPagos(P)}
    <footer class="pla-fin pla-e pla-e7"><p class="pla-nota">${I('chat')}<span><b>WhatsApp y la IA se pagan aparte, directo a cada proveedor.</b> Meta cobra los mensajes en tu propia cuenta y la IA en tu cuenta del proveedor, sin recargo de NexCode97.</span></p>
    <p class="pl-soporte">¿Dudas con tu plan o un cobro? Escríbenos a <a href="mailto:${PL_SOPORTE}">${PL_SOPORTE}</a> y te respondemos en máximo 3 días hábiles.</p></footer>
  </div>`;
}

const paginaCfgPl = paginaCfg;
paginaCfg = function(k){ return k === 'plan' ? paginaPlan() : paginaCfgPl(k); };


/* ── Pagar el plan dentro de Wali (maqueta «Pago con Whop», opción A, 5-nov) ──
   El servidor prepara el pago (POST /crm/plan/pagar → la configuración ch_ de Whop) y aquí se monta el checkout de
   Whop. Si quedan días de la prueba o del periodo pagado, el primer cobro espera a que terminen. El plan se activa con
   el aviso de Whop al servidor, nunca desde el navegador. */
const PP_SCRIPT = 'https://cdn.whop.com/elements/amber/elements.js';
let ppMontado = '', ppElemento = null;
const ppDinero = c => `USD ${(c / 100).toLocaleString('es-CO', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
const ppHoyEsCobro = x => new Date(x.primerCobro).getTime() - Date.now() < 36e5;
function ppCupon(){
  try { const c = JSON.parse(localStorage.getItem('wali-cupon') || 'null'); return c && c.hasta > Date.now() && /^[A-Z0-9]{3,30}$/.test(c.c) ? c.c : ''; } catch { return ''; }
}

function plPaginaPago(P){
  const x = st.plPago, p = plDe(x.plan), anual = x.periodo === 'anual';
  const vol = `<button type="button" class="volver" data-pp-volver="1">${I('back')}Plan y pagos</button>`;
  const cab = `${vol}<h2>Pagar el plan ${esc(p.nombre)}</h2><p class="sub">Tu equipo sigue trabajando sin cortes. Pagas con tarjeta, Apple Pay, Google Pay o PayPal.</p>`;
  const hoy = ppHoyEsCobro(x), fecha = plFecha(x.primerCobro, true);
  const sig = new Date(new Date(x.primerCobro).getTime() + (anual ? 365 : 30) * 864e5).toISOString();
  const lst = (p.incluye || []).slice(0, 4);
  const res = `<div class="wpg-res"><div class="wpg-res-h"><b>Plan ${esc(p.nombre)}</b>${p.destacado ? '<span class="wpg-pill">Más elegido</span>' : ''}</div>
    <div class="wpg-seg" role="radiogroup" aria-label="Periodo"><button type="button" role="radio" aria-checked="${!anual}" data-pp-periodo="mensual">Mensual</button><button type="button" role="radio" aria-checked="${anual}" data-pp-periodo="anual">Anual <em>−20 %</em></button></div>
    <div class="wpg-precio"><b>USD ${esc(anual ? p.anual : String(p.mensual))}</b><small>${anual ? 'al año' : 'al mes'}</small></div>
    ${lst.length ? `<ul class="wpg-lst">${lst.map(t => `<li>${I('check')}${esc(t)}</li>`).join('')}</ul>` : ''}
    <div class="wpg-tot"><div><span>${esc(p.nombre)} ${anual ? 'anual' : 'mensual'}</span><span>${esc(ppDinero(x.total))}</span></div><div><span>Impuestos</span><span>Se calculan al pagar</span></div><div class="t"><span>Hoy pagas</span><span>${esc(ppDinero(hoy ? x.total : 0))}</span></div></div>
    <div class="wpg-dato">${I('calendar')}<span>${hoy ? `Se renueva el <b>${esc(plFecha(sig, true))}</b> por ${esc(ppDinero(x.total))}.` : `Tu primer cobro es el <b>${esc(fecha)}</b> por ${esc(ppDinero(x.total))}, cuando terminan los días que ya tienes.`} Cancelas cuando quieras desde Plan y pagos.</span></div></div>`;
  const pago = `<div class="wpg-pago" aria-label="Pago"><h3>Pago</h3><div class="wpg-whop" id="wpg-whop"><div class="wpg-cargando">Cargando el pago seguro…</div></div><div class="wpg-seg-pie">${I('lock')}Pago seguro procesado por Whop</div></div>`;
  return `<div class="ajw ancho wpg" id="wpg-raiz">${cab}<div class="wpg-ca">${res}${pago}</div></div>`;
}
function plPaginaResultado(P){
  const r = st.plResultado, vol = `<button type="button" class="volver" data-pp-volver="1">${I('back')}Plan y pagos</button>`;
  if (r.ok) {
    const nombre = PL_NOMBRE[r.plan] || PL_NOMBRE[P.plan] || '', espera = r.primerCobro && !ppHoyEsCobro(r);
    const filas = [['Plan', `${nombre} ${r.periodo === 'anual' ? 'anual' : 'mensual'}`], espera ? ['Primer cobro', plFecha(r.primerCobro, true)] : ['Pagado', r.total ? ppDinero(r.total) : ''], espera ? ['', ''] : ['Próximo cobro', plFecha(P.renuevaEl, true) || 'Lo confirmamos en unos segundos']].filter(f => f[1]);
    return `<div class="ajw ancho pl">${vol}<div class="wpg-resu" role="status"><div class="wpg-cir ok">${I('check')}</div><h2>Listo, ya estás en ${esc(nombre)}</h2>
      <p>${espera ? 'Guardamos tu medio de pago. No te cobramos nada hasta que terminen los días que ya tienes.' : 'Recibimos tu pago. Te enviamos el recibo a tu correo.'}</p>
      <div class="wpg-recibo">${filas.map(([a, b]) => `<div><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join('')}</div>
      <div class="wpg-bts">${(P.historial || []).some(h => h.estado === 'pagado') ? '<button type="button" class="btn" data-wpg-recibo="1">Ver recibo</button>' : ''}<button type="button" class="btn pri" data-pp-crm="1">Volver al CRM</button></div></div></div>`;
  }
  const prueba = P.estado === 'prueba' && P.vigente;
  return `<div class="ajw ancho pl">${vol}<div class="wpg-resu" role="alert"><div class="wpg-cir mal">${I('x')}</div><h2>No se pudo hacer el pago</h2>
    <p>No te cobramos nada. Tu banco no aprobó la compra: prueba con otra tarjeta, con Apple Pay o con Google Pay.</p>
    ${prueba ? `<div class="wpg-dato">${I('clock')}<span>Tu prueba gratis sigue activa hasta el <b>${esc(plFecha(P.pruebaHasta, true))}</b>, así que tu equipo no pierde nada mientras tanto.</span></div>` : ''}
    <div class="wpg-bts"><button type="button" class="btn" data-pp-volver="1">Volver a Plan y pagos</button><button type="button" class="btn pri" data-pp-reintentar="1">Intentar de nuevo</button></div></div></div>`;
}
function ppCargarScript(){
  if (window.WhopElements) return Promise.resolve();
  if (ppCargarScript.p) return ppCargarScript.p;
  ppCargarScript.p = new Promise((ok, mal) => {
    const s = document.createElement('script'); s.src = PP_SCRIPT; s.setAttribute('data-whop-elements', ''); s.onload = () => ok(); s.onerror = () => { ppCargarScript.p = null; mal(new Error('No se pudo cargar el pago seguro. Revisa tu conexión e intenta de nuevo.')); };
    document.head.appendChild(s);
  });
  return ppCargarScript.p;
}
// Monta el checkout de Whop una sola vez por pago: mientras se paga, la página no se vuelve a pintar (render, abajo).
async function ppMontar(){
  const x = st.plPago, caja = document.getElementById('wpg-whop');
  if (!x || !caja || ppMontado === x.checkout) return;
  ppMontado = x.checkout;
  try {
    await ppCargarScript();
    if (st.plPago !== x) return;
    if (ppElemento && ppElemento.unmount) try { ppElemento.unmount(); } catch { /* ya no estaba */ }
    caja.replaceChildren();
    const handle = window.WhopElements().checkout.create({
      checkoutConfiguration: x.checkout,
      // El cupón del enlace (?cupon=…, guardado 30 días) va ya escrito en el checkout de Whop.
      ...(ppCupon() ? {promoCode: ppCupon()} : {}),
      returnUrl: `${location.origin}__BASE__/?ir=cfg-plan&pago=whop`,
      locale: 'es',
      // El resumen del plan ya está a la izquierda: de Whop quedan el total con impuestos, el código de descuento y el pago.
      appearance: {theme: {appearance: 'light', accentColor: 'yellow', grayColor: 'gray', dangerColor: 'red'}, variables: {'--radius': '10px'},
        classes: {'whop-CheckoutSummaryHead': {display: 'none'}, 'whop-CheckoutItem': {display: 'none'}, 'whop-CheckoutPrice': {display: 'none'}, 'whop-CheckoutPayButton': {background: '#FFD21F', color: '#0a0a0d', fontWeight: '700'}}},
      onComplete: c => { if (st.plPago !== x) return; st.plResultado = {ok: true, plan: x.plan, periodo: x.periodo, total: x.total, primerCobro: x.primerCobro, pago: c && c.paymentId}; st.plPago = null; ppMontado = ''; render(); plEsperarActivo(x.plan); },
    });
    ppElemento = handle.create('checkout', {buyerEmail: x.email || undefined}); ppElemento.mount('#wpg-whop');
  } catch (err) { ppMontado = ''; caja.replaceChildren(); caja.insertAdjacentHTML('beforeend', `<div class="wpg-cargando">${esc(err.message)}</div>`); }
}
async function ppPreparar(plan, periodo){
  const r = await crmApi('POST', '/crm/plan/pagar', {plan, periodo});
  st.plPago = r; st.plResultado = null; ppMontado = ''; render();
}
/* ── Pagar, cambiar de plan y el portal ── */
async function plPagar(id){
  const P = PLAN, periodo = st.plPeriodo, nombre = PL_NOMBRE[id];
  const cambio = P.vigente && ['activo', 'pago-pendiente'].includes(P.estado) && !P.cancelaAlFinal;
  if (cambio && !(await plConfirmar(`Cambiar a ${nombre}`, `Tu plan pasa a ${nombre} ${periodo} (${plPrecioTxt(id, periodo)}). Lo que ya pagaste se respeta: el nuevo plan empieza a cobrarse cuando termina tu periodo actual.`, `Cambiar a ${nombre}`))) return;
  try { toast('Abriendo el pago seguro…'); await ppPreparar(id, periodo); window.scrollTo(0, 0); }
  catch (err) { toast(err.message); }
}
async function plPortal(){
  // La pestaña se abre antes de la llamada: si se abre después, el navegador la bloquea.
  const w = window.open('', '_blank');
  try { const r = await crmApi('POST', '/crm/plan/portal'); if (w) { w.opener = null; w.location.href = r.url; } else window.top.location.href = r.url; }
  catch (err) { if (w) w.close(); toast(err.message); }
}
// Después de pagar, Whop avisa al servidor en unos segundos: se vuelve a preguntar hasta ver el plan activo.
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
  if (t.closest('[data-pp-volver]')) { st.plPago = null; st.plResultado = null; ppMontado = ''; render(); return; }
  if (t.closest('[data-pp-crm]')) { st.plResultado = null; st.pagina = ''; render(); return; }
  if (t.closest('[data-wpg-recibo]')) { const h = (PLAN.historial || []).find(y => y.estado === 'pagado'); if (h) plRecibo(h.numero); return; }
  if (t.closest('[data-pp-reintentar]')) { const r = st.plResultado || {}; st.plResultado = null; ppPreparar(r.plan || PLAN.plan, r.periodo || st.plPeriodo).catch(err => toast(err.message)); return; }
  const pd = t.closest('[data-pp-periodo]'); if (pd && st.plPago && pd.dataset.ppPeriodo !== st.plPago.periodo) { st.plPeriodo = pd.dataset.ppPeriodo; ppPreparar(st.plPago.plan, pd.dataset.ppPeriodo).catch(err => toast(err.message)); return; }
  if (t.closest('[data-pl-periodo]')) { st.plPeriodo = st.plPeriodo === 'anual' ? 'mensual' : 'anual'; render(); return; }
  const pv = t.closest('[data-pl-ver]'); if (pv) { st.plVer = pv.dataset.plVer; render(); return; }
  const pp = t.closest('[data-pl-per]'); if (pp) { st.plPeriodo = pp.dataset.plPer; render(); return; }
  const pg = t.closest('[data-pl-pagar]'); if (pg && !pg.disabled) { plPagar(pg.dataset.plPagar); return; }
  const rc = t.closest('[data-pl-recibo]'); if (rc) { plRecibo(+rc.dataset.plRecibo); return; }
  const ac = t.closest('[data-pl-acc]'); if (!ac) return;
  const a = ac.dataset.plAcc;
  if (a === 'portal') plPortal();
  else if (a === 'renovar') plPagar(PLAN.plan);
  else if (a === 'planes') { const s = document.getElementById('pl-planes'); if (s) s.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'start'}); }
});

// Al entrar a la página se trae el plan fresco (el uso y los cobros cambian); al volver de pagar, se espera a Whop.
const renderPl = render;
let plAntes = '';
render = function(){
  if (st.pagina === 'cfg-plan' && st.plPago && ppMontado === st.plPago.checkout && document.getElementById('wpg-raiz')) { nav(); return; }
  if (st.pagina !== 'cfg-plan') { st.plPago = null; ppMontado = ''; }
  const entra = st.pagina === 'cfg-plan' && plAntes !== 'cfg-plan';
  plAntes = st.pagina;
  if (entra && PLAN && !st.pagoOk) cargarPlan().then(() => { if (st.pagina === 'cfg-plan') render(); }, () => {});
  if (st.pagina !== 'cfg-plan') st.pagoOk = false;
  renderPl();
  if (st.pagina === 'cfg-plan' && st.plPago) ppMontar();
};
// Al cargar: si vuelve de pagar, se espera a Whop; si eligió un plan en nexcode97.com/precios (lo guardan
// entrar.html o abrirDesdeAviso en la pestaña), se abre Plan y pagos y se lleva al pago de ese plan, una sola vez.
crmListo.then(() => {
  let pend = null;
  try { pend = JSON.parse(sessionStorage.getItem('crm-pagar') || 'null'); sessionStorage.removeItem('crm-pagar'); } catch { /* sin almacenamiento */ }
  if (st.plVuelta) { const s = st.plVuelta; st.plVuelta = ''; st.pagina = 'cfg-plan'; if (s === 'succeeded') { st.plResultado = {ok: true}; plEsperarActivo(''); } else if (s === 'failed' || s === 'canceled') st.plResultado = {ok: false}; else st.pagoOk = true; render(); if (st.pagoOk) plEsperarActivo(''); return; }
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
