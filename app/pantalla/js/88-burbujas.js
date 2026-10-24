/* Burbujas como WhatsApp (maqueta aprobada «Burbujas como WhatsApp», 24-oct, y «Mensajes rediseñados»): el nombre de
   quien envía va arriba, dentro de la primera burbuja, y la hora y los chulitos abajo a la derecha, dentro de la última
   (sin el estado en palabras). Lo que no se entregó y las filas sin burbuja de texto (solo foto o archivo) quedan como estaban.
   Se aplica sobre lo que arma pintarChat (ya escapado), así vale igual en la bandeja, en el cajón del embudo y en el celular.
   Se lee con DOMParser: un documento aparte e inerte, nada se ejecuta. */
const wbPintarSin = pintarChat;
pintarChat = function(c){
  const doc = new DOMParser().parseFromString(`<body>${wbPintarSin.apply(this, arguments)}</body>`, 'text/html');
  for (const f of doc.body.querySelectorAll('.ch-fila')) {
    const meta = f.querySelector(':scope > .ch-col > .ch-meta');
    if (!meta || meta.classList.contains('mal')) continue;
    const bs = f.querySelectorAll(':scope > .ch-col .ch-b');
    if (!bs.length) continue;
    const b = meta.querySelector(':scope > b'), est = meta.querySelector(':scope > .est'), rq = meta.querySelector(':scope > .ch-rq');
    // Lo que va después de los chulitos es el estado en palabras; lo de antes (sin nombre ni separadores) es la hora.
    let estado = '';
    if (est) for (let n = est.nextSibling; n; n = n.nextSibling) estado += n.textContent;
    const antes = [...meta.childNodes].filter(n => n !== b && n !== est && n !== rq && !(est && (est.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING)));
    const hora = antes.map(n => n.textContent).join('').replace(/·/g, ' ').replace(/\s+/g, ' ').trim();
    const nombre = doc.createElement('span');
    nombre.className = 'wb-n';
    nombre.textContent = b ? b.textContent : '';
    const av = f.querySelector(':scope > .ch-av');
    if (!f.classList.contains('yo') && av && av.style.background) nombre.style.setProperty('--wb-c', av.style.background);
    if (nombre.textContent) bs[0].prepend(nombre);
    const pie = doc.createElement('span');
    pie.className = 'wb-t' + (est && est.classList.contains('leido') ? ' leido' : '');
    const parte = (cls, tx) => { const s = doc.createElement('span'); if (cls) s.className = cls; s.textContent = tx; pie.append(s); };
    // Sin «Enviado / Entregado / Leído» en palabras (24-oct): los chulitos lo dicen; queda como texto para lectores de pantalla.
    if (estado.trim() && est) est.setAttribute('aria-label', estado.trim());
    if (rq) { parte('rq', rq.textContent); parte('', '·'); }
    if (hora) parte('', hora);
    if (est) pie.append(est);
    bs[bs.length - 1].append(pie);
    meta.remove();
  }
  return doc.body.innerHTML;
};
document.head.insertAdjacentHTML('beforeend', `<style>
.wb-n{display:block;font-size:12.5px;font-weight:700;margin-bottom:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ch-b.in .wb-n{color:var(--wb-c,#db2777)}
.ch-b.out .wb-n{color:#8a6d00}
.ch-b.ia .wb-n{color:#6d4fc2}
.wb-t{display:flex;justify-content:flex-end;align-items:center;gap:5px;margin:5px 0 -2px;font-size:11px;line-height:1;color:#6b7280;white-space:nowrap;font-variant-numeric:tabular-nums}
.ch-b.out .wb-t{color:#7a6a2c}
.wb-t .est{display:inline-flex}
.wb-t .est svg{width:16px;height:11px;stroke-width:1.6}
.wb-t.leido .est{color:#1f93ff}
.wb-t .st{font-weight:500}
.wb-t .rq{color:var(--blue-ink)}
</style>`);
