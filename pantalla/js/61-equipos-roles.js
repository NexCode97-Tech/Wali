/* ── Equipos: líderes, roles y subequipos ──
   La página de cada equipo en Ajustes del CRM › Equipos y reparto: las personas con su rol en el equipo (el líder, que es
   automático, «Líder de <Equipo>», o el rol de los integrantes que escribe el líder), los subequipos con su forma de
   repartir, el nombre y el color, qué conversaciones recibe y cómo se reparte. La pestaña Personas dice qué ve cada quien
   en el CRM. Lo del equipo queda en un borrador (st.eqDraft) hasta «Guardar cambios», que lo pasa a EQ_CFG y MIEMBROS; de
   ahí lo manda 80-datos.js al API (PUT /crm/ajustes/equipos), que vuelve a revisar los permisos: el administrador sin
   equipo cambia todos los equipos y el líder solo los suyos.
   Reemplaza, reasignándolas, paginaEquipos, abrirEditorEquipo, editorEquipo, guardarEquipo, tabPersonas y los diálogos de
   personas de 40-ajustes.js. Las funciones compartidas de abajo las usa también 62-vistas-rol.js. Lo propio lleva eqr. */

// Lo nuevo del ajuste `equipos`: líderes por equipo, el rol de los integrantes y los subequipos (los pone 80-datos.js).
for (const k of ['lideres', 'roles', 'subequipos']) if (!EQ_CFG[k] || typeof EQ_CFG[k] !== 'object') EQ_CFG[k] = {};
// «Todos ven y cualquiera la toma» ya no existe (regla 4): quedan tres formas de repartir, en equipos y subequipos.
{ const i = METODOS_EQ.findIndex(m => m[0] === 'todos'); if (i >= 0) METODOS_EQ.splice(i, 1); }
// El alcance lo llena 80-datos.js con lo que manda el API (GET /crm/inicio y el evento `alcance`); mientras tanto, nada.
for (const [k, v] of [['todo', false], ['lidera', []], ['integra', []], ['administra', []], ['config', !!CRM_YO.esLider]]) if (!(k in ALCANCE)) ALCANCE[k] = v;

/* ── Funciones compartidas (también las usa 62-vistas-rol.js) ── */
/** Los líderes de un equipo (ids), solo los que siguen en el equipo. */
function lideresDe(eq){ const l = EQ_CFG.lideres && EQ_CFG.lideres[eq], ids = idsDe(eq); return Array.isArray(l) ? l.filter(id => ids.includes(id)) : []; }
/** Cómo se llama la gente del equipo que no es líder («Auditor», «Asesor»); si no hay uno escrito, «Integrante». */
function rolIntegrantesDe(eq){ const r = EQ_CFG.roles && EQ_CFG.roles[eq]; return typeof r === 'string' && r.trim() ? r.trim() : 'Integrante'; }
/** El rol del líder sale solo del nombre del equipo y no se edita. */
function nombreLiderDe(eq){ return `Líder de ${eq}`; }
/** 'lider', 'integrante' o null si la persona no es del equipo. */
function rolEnEquipo(id, eq){ if (!id || !idsDe(eq).includes(id)) return null; return lideresDe(eq).includes(id) ? 'lider' : 'integrante'; }
/** El nombre del rol de la persona en ese equipo, o '' si no es del equipo. */
function nombreRolDe(id, eq){ const r = rolEnEquipo(id, eq); return r === 'lider' ? nombreLiderDe(eq) : r ? rolIntegrantesDe(eq) : ''; }
/** Los subequipos de un equipo: [{id, n, ids, metodo}]. */
function subequiposDe(eq){ const l = EQ_CFG.subequipos && EQ_CFG.subequipos[eq]; return Array.isArray(l) ? l.filter(s => s && s.id && s.n) : []; }
/** El subequipo de una conversación, solo si es del equipo en que está ahora; si no, no tiene. */
function subequipoDeConv(c){ return c && c.subequipo ? subequiposDe(equipoConv(c)).find(s => s.id === c.subequipo) || null : null; }
/** ¿Esta persona cambia ese equipo? El administrador sin equipo, todos; el líder, los suyos. El API lo vuelve a revisar. */
function puedeAdministrarEquipo(eq){ return !!(ALCANCE.todo || (ALCANCE.lidera || []).includes(eq)); }
/** Los equipos que esta persona administra, en el orden de la pantalla. */
function equiposAdministrables(){ return EQUIPOS.map(e => e.n).filter(puedeAdministrarEquipo); }
/** ¿Es administrador de la plataforma (el visitante cuenta como administrador)? Sin equipo vería todo el CRM, así que
    solo un administrador sin equipo lo agrega a un equipo o lo saca de uno (el API lo exige). */
function eqrEsAdmin(p){ return !!p && (p.rol === 'ADMIN' || p.rol === 'VISITANTE'); }
const EQR_SOLO_ADMIN = 'Solo un administrador sin equipo lo agrega';
/** «A», «A y B», «A, B y C». */
function unirNombres(xs){ const l = (xs || []).filter(Boolean); return l.length > 1 ? `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}` : l[0] || ''; }
/** Qué ve una persona en el CRM (columna de Personas, maqueta RolesPersonas): {t, s}. El rol de la plataforma solo da
    alcance al administrador que no está en ningún equipo (el visitante cuenta como administrador). */
function queVeEnCrm(p){
  const admin = p.rol === 'ADMIN' || p.rol === 'VISITANTE', eqs = EQUIPOS.map(e => e.n);
  const lidera = eqs.filter(eq => rolEnEquipo(p.id, eq) === 'lider'), integra = eqs.filter(eq => rolEnEquipo(p.id, eq) === 'integrante');
  const aunque = 'En el CRM, aunque en la plataforma sea administrador';
  if (!lidera.length && !integra.length) return admin ? {t: 'Todo el CRM', s: 'Por ser administrador'} : {t: 'Solo lo que le asignen', s: ''};
  if (lidera.length) return {t: `Todo ${unirNombres(lidera)}`, s: integra.length ? `En ${unirNombres(integra)}, solo lo que le asignen` : admin ? aunque : 'Sus conversaciones, etiquetas y etapas'};
  return {t: 'Solo lo que le asignen', s: admin ? aunque : ''};
}

/* ── Estilos de las maquetas (solo modo claro): rótulos en 600, datos y opciones en 400 ── */
document.head.insertAdjacentHTML('beforeend', `<style>
/* Página del equipo (RolesModeracion y RolesVentas) */
/* El ancho de contenido de la maqueta (1280 con 40 de margen a cada lado) cuando la pantalla alcanza. */
.ajw.ancho.eqr{max-width:1200px}
/* Personas: las cuatro columnas de RolesPersonas en un renglón y, además, «Máximo abiertas» y el lápiz, que existían y la
   maqueta no dibuja: con 1180 px el lápiz quedaba escondido a la derecha. Si la pantalla alcanza, la página se abre para
   que la tabla quepa entera; si no, se desliza dentro de su caja, como antes. */
.ajw.ancho:has(> .eqr-pt){max-width:1300px}
/* Como la maqueta: renglones de alto «normal» (el CRM usa 1,5), salvo donde ella dice otro. */
.eqr,.eqr-pt,.dlg.eqr-dlg{line-height:normal}
.eqr-top{display:flex;align-items:flex-end;gap:12px;margin-bottom:18px}
.eqr-top > .t{flex-grow:1;display:flex;flex-direction:column;gap:6px;min-width:0}
.eqr-top .volver.eqr-vol{display:inline-flex;align-items:center;gap:4px;margin:0;font-size:13px;font-weight:400;color:#0b0b10;align-self:flex-start}
.eqr-top .volver.eqr-vol svg{width:15px;height:15px}
.eqr-top h1{margin:0;font-size:21px;font-weight:600;display:flex;align-items:center;gap:10px;color:#1f2937;min-width:0;overflow-wrap:anywhere}
.eqr-cuadro{width:12px;height:12px;border-radius:50%;flex:none}
:is(.eqr,.eqr-dlg) .btn.eqr-b{height:38px;padding:0 16px;gap:6px;border:1px solid #e5e9f0;border-radius:10px;background:#fff;color:#1f2937;font-size:13.5px;font-weight:500}
:is(.eqr,.eqr-dlg) .btn.eqr-b:hover{background:#f3f6fa}
:is(.eqr,.eqr-dlg) .btn.eqr-b.pri{background:#0b0b10;border-color:#0b0b10;color:#fff}
:is(.eqr,.eqr-dlg) .btn.eqr-b.pri:hover{background:#e6da00;border-color:#e6da00}
:is(.eqr,.eqr-dlg) .btn.eqr-b svg{width:16px;height:16px}
.eqr-ed{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:18px;align-items:start}
@media (max-width:1100px){.eqr-ed{grid-template-columns:minmax(0,1fr)}}
.eqr-col{display:flex;flex-direction:column;gap:18px;min-width:0}
.eqr-card{border:1px solid #e5e9f0;border-radius:14px;background:#fff;padding:18px 20px;display:flex;flex-direction:column;gap:14px;min-width:0}
.eqr-card h4{margin:0;display:flex;align-items:center;gap:8px;font-size:15px;font-weight:600;color:#1f2937}
.eqr-card h4 > svg{width:17px;height:17px;color:#374151;flex:none}
.eqr-n{display:inline-grid;place-items:center;min-width:20px;height:20px;border-radius:999px;background:#f1f5f9;font-size:11px;font-weight:600;line-height:1;color:#4b5563;padding:0 6px;box-sizing:border-box}
.eqr-sp{flex-grow:1}
.eqr-desc{margin:0;font-size:13px;font-weight:400;line-height:1.5;color:#4b5563}
.eqr-desc.eqr-nota{font-size:12.5px}
.eqr-per{position:relative;display:flex;align-items:center;gap:12px;padding:12px 14px;border:1px solid #eef1f5;border-radius:12px;background:#f8fafc}
.eqr-per > .av{width:36px;height:36px;font-size:12px}
.eqr-tx{flex-grow:1;display:flex;flex-direction:column;gap:2px;min-width:0}
.eqr-tx b{font-size:14px;font-weight:400;color:#1f2937}
.eqr-tx small{font-size:12.5px;color:#6b7280}
.eqr-acc{display:flex;align-items:center;gap:12px;flex:none}
.eqr-rol{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 10px;border:1px solid #e5e9f0;border-radius:9px;background:#fff;font-size:12.5px;font-weight:400;color:#1f2937;white-space:nowrap}
.eqr-rol:hover{border-color:#cbd5e1}
.eqr-rol.lider{border-color:#f3e97a;background:#fffde6;color:#0b0b10}
.eqr-rol.abierto{border-color:#0b0b10;box-shadow:0 0 0 3px #fffde6}
.eqr-rol svg{width:13px;height:13px;flex:none}
.eqr-x{width:32px;height:32px;border:1px solid #e5e9f0;border-radius:9px;background:#fff;color:#6b7280;display:grid;place-items:center;flex:none}
.eqr-x:hover{background:#f3f6fa;color:#1f2937}
.eqr-x svg{width:14px;height:14px}
.eqr-rol > span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dlg .cx-op.eq-op:disabled,.dlg .cx-op.pa-op:disabled{opacity:.55;cursor:not-allowed}
/* Menú del rol (RolesRol): 320 px, alineado a la derecha, bajo la fila */
.eqr-menu{position:absolute;z-index:40;top:calc(100% + 9px);right:43px;width:334px;border:1px solid #e5e9f0;border-radius:12px;background:#fff;box-shadow:0 14px 30px -12px rgba(21,32,58,.35);padding:6px;display:flex;flex-direction:column;gap:2px}
.eqr-op{display:flex;align-items:flex-start;gap:10px;width:100%;padding:10px 12px;border-radius:9px;border:0;background:none;text-align:left;color:#1f2937}
.eqr-op:hover{background:#f3f6fa}
.eqr-op.sel,.eqr-op.sel:hover{background:#fffde6}
.eqr-op:focus-visible{outline:2px solid #0b0b10;outline-offset:-2px;border-radius:9px}
.eqr-op > span{flex-grow:1;display:flex;flex-direction:column;gap:2px;min-width:0}
.eqr-op b{font-size:13.5px;font-weight:400}
.eqr-op small{font-size:12px;color:#6b7280;line-height:1.4}
.eqr-op > svg{width:16px;height:16px;color:#0b0b10;flex:none;margin-top:2px}
.eqr-lnk{display:inline-flex;align-items:center;gap:4px;border:0;background:none;color:#0b0b10;font-size:13px;font-weight:500;padding:0;align-self:flex-start}
.eqr-lnk:hover{text-decoration:underline}
.eqr-card h4 .eqr-lnk{align-self:center}
/* En la maqueta el «+» de «Nuevo subequipo» toma el estilo de los íconos del título. */
.eqr-card h4 .eqr-lnk svg{width:17px;height:17px;color:#374151}
.eqr-lnk svg{width:15px;height:15px}
.eqr-agr{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600;color:#374151}
.eqr-agr > span{display:flex;align-items:center;gap:8px;height:42px;padding:0 12px;border:1px solid #e5e9f0;border-radius:10px;color:#6b7280;font-weight:400}
.eqr-agr > span:focus-within{border-color:#0b0b10;box-shadow:0 0 0 3px #fffde6}
.eqr-agr svg{width:15px;height:15px;flex:none}
.eqr-agr input{border:0;outline:none;flex-grow:1;min-width:0;height:auto;padding:1px 2px;font:inherit;font-size:13.5px;font-weight:400;line-height:normal;color:#1f2937;background:transparent}
.eqr-card .rq-res{margin-top:-6px}
/* Subequipos */
.eqr-sub{border:1px solid #e5e9f0;border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:10px}
.eqr-subc{display:flex;align-items:center;gap:10px;min-width:0}
.eqr-subc b{font-size:14px;font-weight:600;color:#1f2937;min-width:0;overflow-wrap:anywhere}
.eqr-subc small{font-size:12.5px;color:#6b7280;white-space:nowrap}
.eqr-sq{width:10px;height:10px;border-radius:50%;opacity:.6;flex:none}
.eqr .btn.eqr-b.eqr-bs{height:32px;padding:0 12px;font-size:12.5px}
.eqr-chips{display:flex;flex-wrap:wrap;gap:6px}
.eqr-chip{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 10px 0 4px;border:1px solid #e5e9f0;border-radius:999px;background:#fff;font-size:12.5px;font-weight:400;color:#1f2937;max-width:100%}
.eqr-chip > .av{width:20px;height:20px;font-size:9px}
/* Nombre y color, roles, qué recibe y cómo se reparte */
.eqr-nombre-t{display:flex;align-items:center;height:42px;padding:0 12px;border:1px solid #e5e9f0;border-radius:10px;font-size:14px;font-weight:400;color:#1f2937;min-width:0}
.eqr-in{height:42px;padding:0 12px;border:1px solid #e5e9f0;border-radius:10px;background:#fff;font:inherit;font-size:14px;font-weight:400;color:#1f2937;width:100%;outline:none}
.eqr-in:focus{border-color:#0b0b10;box-shadow:0 0 0 3px #fffde6}
.eqr-sw{display:flex;gap:10px;flex-wrap:wrap}
.eqr-sw button{width:28px;height:28px;border-radius:8px;border:0;padding:0;cursor:pointer}
.eqr-sw button[aria-pressed="true"]{box-shadow:0 0 0 2px #fff,0 0 0 4px #1f2937}
.eqr-sw button:focus-visible{border-radius:8px}
.eqr-campo{display:flex;flex-direction:column;gap:6px}
.eqr-et{font-size:13px;font-weight:600;color:#374151}
.eqr-auto{display:flex;align-items:center;gap:8px;height:42px;padding:0 12px;border:1px solid #eef1f5;border-radius:10px;background:#f8fafc;font-size:14px;font-weight:400;color:#1f2937;min-width:0}
.eqr-auto svg{width:15px;height:15px;color:#9ca3af;margin-left:auto;flex:none}
.eqr-campo input{height:42px;padding:0 12px;border:1px solid #e5e9f0;border-radius:10px;background:#fff;font:inherit;font-size:14px;font-weight:400;color:#1f2937;width:100%;outline:none}
.eqr-campo input:focus{border-color:#0b0b10;box-shadow:0 0 0 3px #fffde6}
.eqr-campo small{font-size:12.5px;font-weight:400;color:#6b7280;line-height:1.45}
.eqr-txt{font-size:13.5px;font-weight:400;color:#1f2937}
.eqr-dd{position:relative}
.eqr-sel{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;height:42px;padding:0 12px;border:1px solid #e5e9f0;border-radius:10px;background:transparent;font-size:13.5px;font-weight:400;color:#1f2937;text-align:left}
.eqr-sel:hover{border-color:#cbd5e1}
.eqr-sel.abierto{border-color:#0b0b10;box-shadow:0 0 0 3px #fffde6}
.eqr-sel svg{width:14px;height:14px;color:#6b7280;flex:none}
.eqr-menu.eqr-menu-m{left:0;right:0;width:auto;top:calc(100% + 6px)}
/* Personas: quién ve qué (RolesPersonas) */
.eqr-pdesc{margin:0 0 14px;font-size:13px;font-weight:400;line-height:1.5;color:#4b5563}
.eqr-tw{overflow-x:auto}
.eqr-tb{width:100%;border-collapse:collapse;font-size:13.5px;color:#1f2937}
.eqr-tb th{text-align:left;font-size:12px;font-weight:600;color:#6b7280;padding:10px 12px;border-bottom:1px solid #e5e9f0;white-space:nowrap}
.eqr-tb td{padding:12px;border-bottom:1px solid #eef1f5;vertical-align:middle;font-weight:400}
.eqr-tb td small{display:block;font-size:12px;color:#6b7280;margin-top:2px}
.eqr-pers{display:flex;align-items:center;gap:10px}
.eqr-pers > .av{width:30px;height:30px;font-size:11px}
.eqr-tags{display:flex;gap:6px;flex-wrap:wrap}
/* Como la maqueta, en un renglón: el nombre, el rol en la plataforma, qué ve y cada equipo con su rol (si una persona
   está en varios equipos, cada par baja entero). Si no cabe, la tabla se desliza dentro de su caja. */
.eqr-tb td:nth-child(1),.eqr-tb td:nth-child(2),.eqr-tb td:nth-child(4){white-space:nowrap}
.eqr-par{display:inline-flex;gap:6px;white-space:nowrap}
.eqr-tag{display:inline-flex;align-items:center;gap:6px;height:24px;padding:0 8px;border-radius:999px;background:#f1f5f9;font-size:12px;font-weight:400;color:#374151;white-space:nowrap}
.eqr-tag i{width:8px;height:8px;border-radius:50%;display:inline-block;flex:none}
.eqr-tag.lid{background:#fffde6;color:#0b0b10}
.eqr-sin{color:#6b7280}
.eqr-tb td.eqr-lap{text-align:right;width:1%}
.eqr-tb td.eqr-nadie{color:#6b7280;padding:16px 12px}
/* Diálogo de subequipo (Subequipo.dc.html): 600 px */
.dlg.eqr-dlg{width:600px;max-width:calc(100vw - 32px);padding:0;gap:0;display:flex;flex-direction:column;border:0;border-radius:18px;background:#fff;box-shadow:0 30px 60px -20px rgba(15,23,42,.45)}
.dlg.eqr-dlg > .dlg-cerrar{display:none}
.eqr-sqb{padding:26px 26px 20px;display:flex;flex-direction:column;gap:16px}
.eqr-sqh{display:flex;align-items:flex-start;gap:12px}
.eqr-sqh > div{flex-grow:1;display:flex;flex-direction:column;gap:2px;min-width:0}
.dlg.eqr-dlg h3{margin:0;padding:0;font-size:20px;font-weight:600;letter-spacing:normal;line-height:normal;color:#1f2937}
.eqr-sqh > div > span{font-size:13px;color:#6b7280}
/* La X de la maqueta es un botón con el relleno del navegador (1 x 6 px): 30 x 26 con el ícono en la línea de base. */
.eqr-sqx{display:flex;align-items:flex-start;height:26px;border:0;background:none;padding:1px 6px;color:#6b7280;cursor:pointer;flex:none}
.eqr-sqx:hover{color:#1f2937}
.eqr-sqx svg{display:block;width:18px;height:18px}
.eqr-lab{display:flex;flex-direction:column;gap:6px;font-size:13px;font-weight:600;color:#374151}
.eqr-lab input{height:42px;border:1px solid #e5e9f0;border-radius:10px;padding:0 12px;font:inherit;font-size:14px;font-weight:400;color:#1f2937;width:100%;outline:none}
.eqr-lab input:focus{border-color:#0b0b10;box-shadow:0 0 0 3px #fffde6}
.eqr-lab small{font-size:12px;font-weight:400;color:#6b7280}
.eqr-sqp{display:flex;flex-direction:column;gap:8px}
.eqr-sqp > span{font-size:13px;font-weight:600;color:#374151}
.eqr-sqp > small{font-size:12px;color:#6b7280}
.eqr-chk{display:flex;align-items:center;gap:12px;width:100%;border:1px solid #e5e9f0;border-radius:12px;padding:10px 14px;font-size:14px;font-weight:400;background:#fff;color:#000;cursor:pointer;text-align:left}
.eqr-chk:hover{border-color:#cbd5e1}
.eqr-chk > .av{width:28px;height:28px;font-size:10px}
.eqr-caja{width:18px;height:18px;border-radius:5px;border:2px solid #9ca3af;display:grid;place-items:center;flex:none;box-sizing:border-box}
.eqr-caja.on{background:#0b0b10;border-color:#0b0b10;color:#fff}
.eqr-caja svg{width:12px;height:12px}
.eqr-sel.eqr-sel2{height:44px;font-size:14px;background:#fff}
.eqr-sqft{display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:14px 26px;background:#f8fafc;border-top:1px solid #eef1f5;border-radius:0 0 18px 18px}
.dlg.eqr-dlg > .eqr-sqft:last-child{margin-bottom:0}
.eqr-sqft .btn.eqr-b{height:40px}
.eqr-dlg .btn.eqr-b.eqr-borrar{color:#b91c1c;border-color:#fecaca}
/* Celular (menos de 760 px, lote 3): nada se sale a lo ancho a 360, 390 y 430 px. */
@media (max-width:759.98px){
  .eqr-top{flex-wrap:wrap;justify-content:flex-end}
  .eqr-top > .t{flex-basis:100%}
  .eqr-card{padding:16px}
  .eqr-per{flex-wrap:wrap;row-gap:10px}
  .eqr-tx{flex-basis:calc(100% - 48px)}
  .eqr-acc{flex-basis:100%;justify-content:flex-end;min-width:0}
  /* Un rol largo (hasta 40 caracteres) o el líder de un equipo de nombre largo se recorta con puntos: la X queda a la vista. */
  .eqr-rol{min-width:0;max-width:100%}
  .eqr-menu{left:0;right:0;width:auto}
  .eqr-subc{flex-wrap:wrap;row-gap:6px}
  .eqr-card .rq-op{flex-wrap:wrap}
  .eqr-card .rq-op .tx{flex-basis:calc(100% - 44px)}
  .eqr-card .rq-op .btn{margin-left:auto}
  .eqr-tb{min-width:980px}
  .eqr-sqb{padding:20px 18px 16px}
  .eqr-sqft{flex-wrap:wrap;padding:12px 18px}
  .eqr-sqft .eqr-borrar{flex-basis:100%;justify-content:center}
  .eqr-sqft .eqr-sp{display:none}
}
</style>`);

/* ── Íconos de las maquetas (trazo 1,8) ── */
const eqrSvg = (d, t = 16, w = 1.8) => `<svg viewBox="0 0 24 24" width="${t}" height="${t}" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const EQR_IC = {
  personas: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0"/><path d="M16 5.2a3.2 3.2 0 0 1 0 5.6"/><path d="M17.5 14a5.5 5.5 0 0 1 3 5"/>',
  subequipos: '<rect x="3" y="4" width="8" height="7" rx="2"/><rect x="13" y="4" width="8" height="7" rx="2"/><rect x="8" y="14" width="8" height="7" rx="2"/>',
  roles: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/><path d="M17 4l1.5 1.5L21 3"/>',
  candado: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  abajo: '<path d="M6 9l6 6 6-6"/>', arriba: '<path d="M6 15l6-6 6 6"/>', atras: '<path d="M15 18l-6-6 6-6"/>',
  x: '<path d="M6 6l12 12"/><path d="M18 6L6 18"/>', chulo: '<path d="M5 12l5 5 9-10"/>', mas: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  lupa: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  papelera: '<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
};

/* ── Formas de repartir ── */
const eqrMetodo = k => METODOS_EQ.find(m => m[0] === k) || METODOS_EQ[0];
// La forma de un equipo: la suya o la general. Un «todos» guardado de antes se lee como «Por turnos» (el API ya lo cambia).
const eqrMetodoDe = eq => eqrMetodo(metodoDe(eq))[0];
// En el diálogo de subequipo la explicación habla del subequipo (maqueta Subequipo.dc.html).
const EQR_SUB_DESC = {turnos: 'Una conversación para cada persona conectada del subequipo, en orden.', menos: 'Le llega a la persona conectada del subequipo con menos conversaciones abiertas.', lider: 'Nadie la recibe sola: queda sin asignar hasta que un líder o administrador la entrega.'};

/* ── Borrador del equipo abierto ── */
st.eqrMenu = null; st.eqrSq = null;
// El nombre que se muestra (el que se está escribiendo; si se borró, el guardado). Vacío solo en un equipo nuevo.
const eqrNom = x => String(x.n || '').trim() || x.orig || '';
// El nombre dentro de una frase: se actualiza mientras se escribe (eqrPintarNombre). Sin nombre, «este equipo».
const eqrNomSpan = (x, inicio) => `<span data-eqr-nom="${inicio ? 'M' : 'm'}">${esc(eqrNom(x) || (inicio ? 'Este equipo' : 'este equipo'))}</span>`;
const eqrFoto = x => JSON.stringify([x.n, x.color, x.ids, x.lineas, x.transferible, x.metodo, x.lideres, x.rol, x.subs]);
const eqrCambiado = x => !!x && eqrFoto(x) !== x._foto;
function eqrBorrador(nombre){
  const eq = nombre ? EQUIPOS.find(e => e.n === nombre) : null, i = eq ? EQUIPOS.indexOf(eq) : EQUIPOS.length, ids = eq ? [...idsDe(eq.n)] : [];
  const x = {orig: eq ? eq.n : '', n: eq ? eq.n : '', color: colorDe(eq ? eq.n : '', i), ids, lineas: eq ? lineasDe(eq.n).map(l => l.id) : [],
    transferible: eq ? EQ_CFG.transferibles[eq.n] !== false : true, metodo: eq ? eqrMetodoDe(eq.n) : eqrMetodo(metodoGeneral())[0],
    lideres: eq ? lideresDe(eq.n) : [], rol: eq ? rolIntegrantesDe(eq.n) : 'Integrante',
    subs: eq ? subequiposDe(eq.n).map(s => ({id: s.id, n: s.n, ids: (Array.isArray(s.ids) ? s.ids : []).filter(id => ids.includes(id)), metodo: eqrMetodo(s.metodo)[0]})) : [],
    verTodas: false};
  x._foto = eqrFoto(x);
  return x;
}
// Sacar a alguien del equipo (en el borrador) lo quita también de los líderes y de los subequipos.
function eqrQuitar(x, id){ x.ids = x.ids.filter(y => y !== id); x.lideres = x.lideres.filter(y => y !== id); x.subs.forEach(s => { s.ids = s.ids.filter(y => y !== id); }); }
// Lo mismo en lo guardado (EQ_CFG), para los diálogos de Personas.
function eqrSacarDe(eq, id){
  if (Array.isArray(EQ_CFG.lideres[eq])) EQ_CFG.lideres[eq] = EQ_CFG.lideres[eq].filter(y => y !== id);
  if (Array.isArray(EQ_CFG.subequipos[eq])) EQ_CFG.subequipos[eq] = EQ_CFG.subequipos[eq].map(s => ({...s, ids: (s.ids || []).filter(y => y !== id)}));
}
function eqrCerrarEditor(){
  st.eqVer = null; st.eqDraft = null; st.eqBusca = null; st.eqrMenu = null;
  // El diálogo de subequipo abierto es de ese borrador: se cierra con él (si no, sus botones ya no harían nada).
  if (st.eqrSq) { st.eqrSq = null; cerrarDialogo(); }
}

/* ── Lista de equipos (pestañas Equipos, Personas y, con la configuración general, Reglas del reparto) ── */
const eqrPersonasVisibles = () => { const adm = equiposAdministrables(); return personasCrm().filter(p => ALCANCE.todo || adm.some(eq => idsDe(eq).includes(p.id))); };
const eqrTabs = adm => `<div class="cn-bar"><div class="cn-tabs" role="tablist" aria-label="Equipos y reparto">${[['equipos', 'Equipos', adm.length], ['personas', 'Personas', eqrPersonasVisibles().length], ...(ALCANCE.config ? [['reglas', 'Reglas del reparto', null]] : [])].map(([k, n, c]) => `<button type="button" role="tab" aria-selected="${st.repTab === k}" data-rep-tab="${k}">${n}${c != null ? `<span class="kb-n">${c}</span>` : ''}</button>`).join('')}</div></div>`;
paginaEquipos = function(){
  const volver = `<button type="button" class="volver" data-ir="ajustes-crm">${I('back')}Ajustes del CRM</button>`;
  if (st.eqVer !== null && st.eqDraft) return editorEquipo();
  if (st.repTab === 'reglas' && !ALCANCE.config) st.repTab = 'equipos';
  const adm = equiposAdministrables();
  const cab = `${volver}<h2>Equipos y reparto</h2><p class="sub">Quién atiende las conversaciones y cómo se reparten entre las personas de cada equipo.</p>`;
  if (st.repTab === 'personas') return `<div class="ajw ancho">${cab}${eqrTabs(adm)}${tabPersonas()}</div>`;
  if (st.repTab === 'reglas') return `<div class="ajw ancho">${cab}${eqrTabs(adm)}${tabReglas()}</div>`;
  const q = norm(st.repQ || '');
  const lista = EQUIPOS.map((e, i) => ({e, i})).filter(({e}) => adm.includes(e.n) && (!q || norm(e.n).includes(q) || idsDe(e.n).some(id => norm((personaDe(id) || {}).nombre || '').includes(q))));
  const filas = lista.map(({e, i}) => {
    const ps = idsDe(e.n).map(personaDe).filter(Boolean);
    const personas = ps.length ? `<span style="display:flex;align-items:center;gap:10px"><span class="rq-stack">${ps.slice(0, 5).map(avPer).join('')}${ps.length > 5 ? `<span class="av mas" title="${ps.length - 5} más">+${ps.length - 5}</span>` : ''}</span><span class="rq-d">${ps.length} ${ps.length === 1 ? 'persona' : 'personas'}</span></span>`
      : `<span style="display:flex;flex-direction:column;align-items:flex-start;gap:4px"><span class="rq-warn">${svgAviso}Nadie lo atiende</span><button type="button" class="rq-lnk" data-eq-abrir="${esc(e.n)}">Agregar personas</button></span>`;
    return `<div class="rq-f eqs"><span class="rq-eq"><span class="rq-dot" style="background:${colorOk(colorDe(e.n, i))}"></span>${esc(e.n)}</span>${personas}<span class="rq-d">${recibeHTML(e.n)}</span><span class="rq-d">${esc(eqrMetodo(eqrMetodoDe(e.n))[1])}</span><button type="button" class="btn" data-eq-abrir="${esc(e.n)}">Editar</button></div>`;
  }).join('');
  return `<div class="ajw ancho">${cab}${eqrTabs(adm)}
    <div class="rq-bar"><label class="cn-q">${I('search')}<input id="rep-q" value="${esc(st.repQ || '')}" placeholder="Buscar un equipo o una persona" autocomplete="off" aria-label="Buscar un equipo o una persona"></label><span class="sp"></span>${ALCANCE.todo ? `<button type="button" class="btn pri" data-eq-abrir="">${I('plus')}Crear equipo</button>` : ''}</div>
    <div class="rq-t"><div class="rq-f eqs hd"><span>Equipo</span><span>Personas</span><span>Qué conversaciones recibe</span><span>Cómo se reparte</span><span></span></div>${filas || `<p class="muted" style="margin:0;padding:16px 18px">${q ? 'Nada coincide con la búsqueda.' : 'Todavía no tienes equipos a tu cargo.'}</p>`}</div></div>`;
};

/* ── Página del equipo (RolesModeracion y RolesVentas; el menú del rol, RolesRol) ── */
abrirEditorEquipo = function(nombre){
  if (nombre ? !puedeAdministrarEquipo(nombre) : !ALCANCE.todo) { toast(nombre ? `Solo el líder de ${nombre} o un administrador cambia este equipo` : 'Solo un administrador sin equipo crea equipos'); return; }
  st.eqVer = nombre || ''; st.eqDraft = eqrBorrador(nombre || ''); st.eqBusca = {q: '', res: [], cargando: false}; st.eqrMenu = null;
  render(); window.scrollTo && window.scrollTo(0, 0);
  const pg = document.getElementById('page'); if (pg) pg.scrollTop = 0;
};
editorEquipo = function(){
  const x = st.eqDraft, nuevo = !x.orig, todo = !!ALCANCE.todo, abierto = st.eqrMenu;
  const lid = new Set(x.lideres.filter(id => x.ids.includes(id)));
  // Los líderes primero; después la gente en el orden del equipo (el de los turnos).
  const personas = [...x.ids.filter(id => lid.has(id)), ...x.ids.filter(id => !lid.has(id))].map(personaDe).filter(Boolean);
  const vis = x.verTodas || personas.length <= 5 ? personas : personas.slice(0, 5);
  const rolTxt = String(x.rol || '').trim() || 'Integrante';
  const fila = p => {
    const esLid = lid.has(p.id), subs = x.subs.filter(s => s.ids.includes(p.id)).map(s => s.n), k = 'rol:' + p.id, ab = abierto === k;
    const det = esLid ? `Ve todas las conversaciones de ${eqrNomSpan(x)}` : subs.length ? `${esc(subs.join(' · '))} · ve solo lo que le asignen` : 'Ve solo lo que le asignen';
    const ops = [['lider', `Líder de ${eqrNomSpan(x)}`, `Ve todas las conversaciones de ${eqrNomSpan(x)}, las reasigna y administra sus subequipos`], ['integrante', `<span data-eqr-rolt>${esc(rolTxt)}</span>`, 'Ve solo las conversaciones que le asignen']];
    const menu = ab ? `<div class="eqr-menu" role="listbox" aria-label="Rol en ${esc(eqrNom(x) || 'el equipo')}">${ops.map(([v, b, s]) => { const sel = (v === 'lider') === esLid; return `<button type="button" class="eqr-op${sel ? ' sel' : ''}" role="option" aria-selected="${sel}" data-eqr-rolop="${esc(p.id)}" data-v="${v}"><span><b>${b}</b><small>${s}</small></span>${sel ? eqrSvg(EQR_IC.chulo) : ''}</button>`; }).join('')}</div>` : '';
    return `<div class="eqr-per">${avPer(p)}<span class="eqr-tx"><b>${esc(p.nombre)}</b><small>${det}</small></span><span class="eqr-acc"><button type="button" class="eqr-rol${esLid ? ' lider' : ''}${ab ? ' abierto' : ''}" data-eqr-abrir="${esc(k)}" aria-haspopup="listbox" aria-expanded="${ab}">${esLid ? `<span>Líder de ${eqrNomSpan(x)}</span>` : `<span data-eqr-rolt>${esc(rolTxt)}</span>`}${eqrSvg(ab ? EQR_IC.arriba : EQR_IC.abajo, 13)}</button><button type="button" class="eqr-x" data-eqr-quitar="${esc(p.id)}" aria-label="Quitar a ${esc(p.nombre)}">${eqrSvg(EQR_IC.x, 14)}</button></span>${menu}</div>`;
  };
  // La búsqueda de «Agregar persona» (GET /crm/personas), con los resultados de antes.
  const B = st.eqBusca || {q: '', res: []};
  const res = B.q.trim() ? (B.cargando && !B.res.length ? '<p class="muted" style="margin:0;padding:10px 12px">Buscando…</p>'
      : B.error ? `<p class="muted" style="margin:0;padding:10px 12px">${esc(B.error)}</p>`
      : B.res.length ? B.res.map(p => { const ya = x.ids.includes(p.id), adm = !ya && !todo && eqrEsAdmin(p); return `<div class="rq-op">${avPer(p)}<span class="tx">${esc(p.nombre)}<small>${esc(adm ? EQR_SOLO_ADMIN : p.cargo ? p.cargo + ', según el organigrama' : (p.enCrm ? 'Ya está en el CRM' : 'Todavía no entra al CRM'))}</small></span><span class="rq-rol">${esc(p.rolNombre || ROL_NOMBRE[p.rol] || p.rol)}</span><button type="button" class="btn" data-eq-add="${esc(p.id)}" ${ya || adm ? 'disabled' : ''}>${ya ? 'Ya está' : `${I('plus')}Agregar`}</button></div>`; }).join('')
      : '<p class="muted" style="margin:0;padding:10px 12px">Nadie coincide. Los colaboradores no aparecen: no pueden entrar al CRM.</p>') : '';
  const cardPersonas = `<section class="eqr-card" aria-label="Personas del equipo"><h4>${eqrSvg(EQR_IC.personas, 17)}Personas del equipo<span class="eqr-n">${personas.length}</span></h4>
      <p class="eqr-desc">El líder de ${eqrNomSpan(x)} ve todas las conversaciones del equipo, las reasigna entre su gente y administra sus subequipos. Cada <span data-eqr-rolm>${esc(rolTxt.toLowerCase())}</span> ve solo las conversaciones que le asignen.</p>
      ${vis.map(fila).join('') || '<p class="muted" style="margin:0">Todavía nadie. Búscalas abajo.</p>'}
      ${vis.length < personas.length ? `<button type="button" class="eqr-lnk" data-eqr-vertodas="1">Ver las ${personas.length} personas</button>` : ''}
      <label class="eqr-agr">Agregar persona<span>${eqrSvg(EQR_IC.lupa, 15)}<input id="eq-busca" value="${esc(B.q)}" placeholder="Escribe un nombre o un correo" aria-label="Agregar persona" autocomplete="off"></span></label>
      ${res ? `<div class="rq-res" id="eq-res">${res}</div>` : ''}</section>`;
  const cardSubs = `<section class="eqr-card" aria-label="Subequipos"><h4>${eqrSvg(EQR_IC.subequipos, 17)}Subequipos<span class="eqr-n">${x.subs.length}</span><span class="eqr-sp"></span><button type="button" class="eqr-lnk" data-eqr-subnuevo="1">${eqrSvg(EQR_IC.mas, 15)}Nuevo subequipo</button></h4>
      <p class="eqr-desc">${x.subs.length ? `Grupos dentro de ${eqrNomSpan(x)}. Una conversación del equipo se puede pasar a un subequipo y se reparte solo entre su gente; el líder y los administradores las ven todas.` : `${eqrNomSpan(x, true)} todavía no tiene subequipos.`}</p>
      ${x.subs.map(s => { const gente = s.ids.filter(id => x.ids.includes(id)).map(personaDe).filter(Boolean);
        return `<div class="eqr-sub"><div class="eqr-subc"><span class="eqr-sq" style="background:${colorOk(x.color)}"></span><b>${esc(s.n)}</b><small>· ${esc(eqrMetodo(s.metodo)[1])}</small><span class="eqr-sp"></span><button type="button" class="btn eqr-b eqr-bs" data-eqr-subeditar="${esc(s.id)}" aria-label="Editar ${esc(s.n)}">Editar</button></div>${gente.length ? `<div class="eqr-chips">${gente.map(p => `<span class="eqr-chip">${avPer(p)}${esc(p.nombre)}</span>`).join('')}</div>` : ''}</div>`; }).join('')}</section>`;
  // Nombre y líneas: solo el administrador sin equipo (tocan otros equipos); el líder los ve en texto y sí cambia el color.
  const cardNombre = `<section class="eqr-card" aria-label="Nombre y color"><h4>Nombre y color</h4>
      ${todo ? `<input class="eqr-in" id="eq-nombre" value="${esc(x.n)}" placeholder="Ej. Moderación" maxlength="80" autocomplete="off" aria-label="Nombre del equipo">` : `<span class="eqr-nombre-t">${esc(x.orig)}</span>`}
      <div class="eqr-sw" role="group" aria-label="Color del equipo">${COLORES_EQ.map(([c, n]) => `<button type="button" style="background:${c}" data-eq-color="${c}" aria-pressed="${x.color === c}" aria-label="${n}"></button>`).join('')}</div></section>`;
  const cardRoles = `<section class="eqr-card" aria-label="Roles del equipo"><h4>${eqrSvg(EQR_IC.roles, 17)}Roles del equipo</h4>
      <div class="eqr-campo"><span class="eqr-et">Líder</span><span class="eqr-auto"><span>Líder de ${eqrNomSpan(x)}</span>${eqrSvg(EQR_IC.candado, 15)}</span><small>Sale solo del nombre del equipo.</small></div>
      <label class="eqr-campo"><span class="eqr-et">Rol de los integrantes</span><input id="eqr-rol" value="${esc(x.rol)}" maxlength="40" autocomplete="off"><small>Cómo se llama la gente del equipo. Lo escribes tú.</small></label></section>`;
  let recibe;
  if (todo) {
    const ocupada = id => { const l = CFG.lineas.find(y => y.id === id); return l && l.eq && l.eq !== x.orig ? l.eq : null; };
    recibe = (LINEAS.length ? LINEAS.map(l => { const otro = ocupada(l.id); return `<label class="rq-chk"><input type="checkbox" data-eq-linea="${esc(l.id)}" ${x.lineas.includes(l.id) ? 'checked' : ''}><span>${esc(l.n)} · ${esc(l.tel)}${otro && !x.lineas.includes(l.id) ? `<small class="rq-sub">Hoy la atiende ${esc(otro)}</small>` : ''}</span></label>`; }).join('')
      : '<p class="rq-ayuda">Todavía no hay líneas de WhatsApp conectadas. Cuando conectes una, la eliges aquí.</p>')
      + `<label class="rq-chk"><input type="checkbox" data-eq-transf="1" ${x.transferible ? 'checked' : ''}><span>Las que le transfieren otros equipos</span></label>`;
  } else {
    // Como las maquetas: con una línea, «nombre · teléfono» (Moderación); con varias, sus nombres juntos (Ventas).
    const ls = lineasDe(x.orig), partes = ls.length === 1 ? [`${ls[0].n} · ${ls[0].tel}`] : ls.length ? [ls.map(l => l.n).join(' · ')] : [];
    if (x.orig === 'Ventas' && !partes.length) partes.push('Las que llegan sin un equipo propio');
    if (x.transferible) partes.push('Las que le transfieren otros equipos');
    recibe = partes.length ? partes.map(t => `<span class="eqr-txt">${esc(t)}</span>`).join('') : '<span class="eqr-txt rq-sub">Ninguna todavía</span>';
  }
  const cardRecibe = `<section class="eqr-card" aria-label="Qué conversaciones recibe"><h4>Qué conversaciones recibe</h4>${recibe}</section>`;
  const m = eqrMetodo(x.metodo), abM = abierto === 'metodo';
  const cardReparto = `<section class="eqr-card" aria-label="Cómo se reparte"><h4>Cómo se reparte</h4>
      <div class="eqr-dd"><button type="button" class="eqr-sel${abM ? ' abierto' : ''}" data-eqr-abrir="metodo" aria-haspopup="listbox" aria-expanded="${abM}"><span>${esc(m[1])}</span>${eqrSvg(abM ? EQR_IC.arriba : EQR_IC.abajo, 14)}</button>
      ${abM ? `<div class="eqr-menu eqr-menu-m" role="listbox" aria-label="Cómo se reparte">${METODOS_EQ.map(([k, n, d]) => `<button type="button" class="eqr-op${k === m[0] ? ' sel' : ''}" role="option" aria-selected="${k === m[0]}" data-eqr-metodo="${k}"><span><b>${esc(n)}</b><small>${esc(d)}</small></span>${k === m[0] ? eqrSvg(EQR_IC.chulo) : ''}</button>`).join('')}</div>` : ''}</div>
      <p class="eqr-desc eqr-nota">Lo que llega sin subequipo se reparte entre toda la gente del equipo. Cada subequipo tiene su propia forma de repartir.</p></section>`;
  const borrar = todo && !nuevo && x.orig !== 'Ventas' ? `<div><button type="button" class="btn" data-eq-borrar="1" style="color:#b91c1c;border-color:#fecaca">${eqrSvg(EQR_IC.papelera, 18, 1.75)}Eliminar equipo</button></div>` : '';
  return `<div class="ajw ancho eqr"><div class="eqr-top"><div class="t"><button type="button" class="volver eqr-vol" data-eq-cerrar="1">${eqrSvg(EQR_IC.atras, 15)}Equipos y reparto</button><h1><span class="eqr-cuadro" style="background:${colorOk(x.color)}"></span><span data-eqr-nom="T">${esc(eqrNom(x) || 'Equipo nuevo')}</span></h1></div>
      <button type="button" class="btn eqr-b" data-eq-cerrar="1">Cancelar</button><button type="button" class="btn eqr-b pri" data-eq-guardar2="1">${eqrSvg(EQR_IC.chulo)}${nuevo ? 'Crear equipo' : 'Guardar cambios'}</button></div>
    <div class="eqr-ed"><div class="eqr-col">${cardPersonas}${cardSubs}${borrar}</div><div class="eqr-col">${cardNombre}${cardRoles}${cardRecibe}${cardReparto}</div></div></div>`;
};
guardarEquipo = function(){
  const x = st.eqDraft; if (!x) return;
  const todo = !!ALCANCE.todo;
  if (x.orig ? !puedeAdministrarEquipo(x.orig) : !todo) { toast(x.orig ? `Solo el líder de ${x.orig} o un administrador cambia este equipo` : 'Solo un administrador sin equipo crea equipos'); return; }
  if (x.orig && !EQUIPOS.some(q => q.n === x.orig)) { eqrCerrarEditor(); render(); toast('Ese equipo ya no existe: otra persona lo borró o le cambió el nombre'); return; }
  const nm = document.getElementById('eq-nombre'); if (todo && nm) x.n = nm.value;
  const ri = document.getElementById('eqr-rol'); if (ri) x.rol = ri.value;
  const n = todo ? String(x.n || '').trim() : x.orig, rol = String(x.rol || '').trim();
  if (!n) { toast('Escribe el nombre del equipo'); return; }
  if (n !== x.orig && EQUIPOS.some(q => q.n === n)) { toast('Ya hay un equipo con ese nombre'); return; }
  const viejo = x.orig;
  if (!viejo) EQUIPOS.push({id: 'eq-' + norm(n).replace(/[^a-z0-9]+/g, '-'), n, f: c => c.equipo === n});
  else if (n !== viejo) {
    // Cambiar el nombre (solo el administrador sin equipo): lo lleva todo lo del equipo, también sus etapas y etiquetas.
    const q = EQUIPOS.find(e => e.n === viejo); q.n = n; if (q.id !== 'ventas' && q.id !== 'recuperacion') q.f = c => c.equipo === n;
    // Sus conversaciones las pasa el API en bloque al guardar (sin repartirlas ni quitarles su persona o su subequipo);
    // aquí solo cambian en pantalla (80-datos.js, crmRenombrarEquipo).
    if (typeof crmRenombrarEquipo === 'function') crmRenombrarEquipo(viejo, n); else CONV.forEach(c => { if (c.equipo === viejo) c.equipo = n; });
    CFG.lineas.forEach(l => { if (l.eq === viejo) l.eq = n; }); Object.values(LLAM.lineas).forEach(l => { if (l.eq === viejo) l.eq = n; });
    for (const k of ['ids', 'colores', 'metodos', 'transferibles', 'lideres', 'roles', 'subequipos']) if (EQ_CFG[k] && viejo in EQ_CFG[k]) { EQ_CFG[k][n] = EQ_CFG[k][viejo]; delete EQ_CFG[k][viejo]; }
    const M = {}; for (const [k, v] of Object.entries(MIEMBROS)) M[k === viejo ? n : k] = v; for (const k of Object.keys(MIEMBROS)) delete MIEMBROS[k]; Object.assign(MIEMBROS, M);
    ETQ.forEach(e => { if (eqDeEtapa(e) === viejo) e[2] = n; });
    ETIQS.forEach(e => { if (eqDeEtiq(e) === viejo) e[2] = n; });
  }
  const ids = [...x.ids];
  EQ_CFG.ids[n] = ids;
  EQ_CFG.lideres[n] = x.lideres.filter(id => ids.includes(id));
  // Vacío: el API pone el rol inicial (Asesor, Auditor o Integrante) y vuelve con el evento del ajuste.
  EQ_CFG.roles[n] = rol;
  EQ_CFG.subequipos[n] = x.subs.map(s => ({id: s.id, n: s.n, ids: s.ids.filter(id => ids.includes(id)), metodo: s.metodo}));
  MIEMBROS[n] = ids.map(id => (personaDe(id) || {}).nombre).filter(Boolean);
  EQ_CFG.colores[n] = x.color; EQ_CFG.metodos[n] = x.metodo;
  if (todo) {
    EQ_CFG.transferibles[n] = x.transferible;
    // Las líneas marcadas pasan a este equipo; las que se desmarcaron vuelven a Ventas.
    CFG.lineas.forEach(l => { if (x.lineas.includes(l.id)) l.eq = n; else if (l.eq === n) l.eq = 'Ventas'; });
  }
  eqrCerrarEditor(); render();
  toast(viejo ? `Equipo guardado: ${n}` : `Equipo creado: ${n}`);
};

/* ── Menús propios del rol y de la forma de repartir: listbox con teclado (flechas, Inicio, Fin, Enter y Escape) ── */
function eqrAbrirMenu(k){
  st.eqrMenu = k; render();
  const m = document.querySelector('#page .eqr-menu'); if (!m) return;
  const s = m.querySelector('[aria-selected="true"]') || m.querySelector('[role="option"]'); if (s) s.focus({preventScroll: true});
  m.scrollIntoView({block: 'nearest'});
}
// Cierra el menú sin volver a pintar la página (así no se pierde el foco de lo que se tocó); devuelve su botón.
function eqrCerrarMenuDom(){
  const k = st.eqrMenu; st.eqrMenu = null; if (!k) return null;
  document.querySelectorAll('#page .eqr-menu').forEach(m => m.remove());
  const b = document.querySelector(`#page [data-eqr-abrir="${CSS.escape(k)}"]`);
  if (b) { b.classList.remove('abierto'); b.setAttribute('aria-expanded', 'false'); const s = b.querySelector(':scope > svg'); if (s) s.outerHTML = eqrSvg(EQR_IC.abajo, b.classList.contains('eqr-sel') ? 14 : 13); }
  return b;
}
const eqrFoco = sel => { const b = document.querySelector('#page ' + sel); if (b) b.focus({preventScroll: true}); };
// El nombre y el rol se ven cambiar en toda la página mientras se escriben, sin volver a pintarla.
function eqrPintarNombre(x){ const n = eqrNom(x); document.querySelectorAll('#page [data-eqr-nom]').forEach(s => { const k = s.dataset.eqrNom; s.textContent = n || (k === 'T' ? 'Equipo nuevo' : k === 'M' ? 'Este equipo' : 'este equipo'); }); }
function eqrPintarRol(x){ const r = String(x.rol || '').trim() || 'Integrante'; document.querySelectorAll('#page [data-eqr-rolt]').forEach(s => { s.textContent = r; }); document.querySelectorAll('#page [data-eqr-rolm]').forEach(s => { s.textContent = r.toLowerCase(); }); }

document.getElementById('page').addEventListener('click', e => {
  if (st.pagina !== 'cfg-reparto') return;
  const t = e.target;
  if (t.closest('[data-eq-cerrar]')) { st.eqrMenu = null; return; }   // 40-ajustes.js cierra la página del equipo
  const x = st.eqDraft; if (!x) return;
  if (st.eqrMenu && !t.closest('.eqr-menu, [data-eqr-abrir]')) eqrCerrarMenuDom();
  const ab = t.closest('[data-eqr-abrir]'); if (ab) { const k = ab.dataset.eqrAbrir; if (st.eqrMenu === k) { const b = eqrCerrarMenuDom(); if (b) b.focus(); } else eqrAbrirMenu(k); return; }
  const ro = t.closest('[data-eqr-rolop]'); if (ro) {
    const id = ro.dataset.eqrRolop, lider = ro.dataset.v === 'lider';
    x.lideres = x.lideres.filter(y => y !== id);
    // El líder ve todo el equipo: sale de los subequipos (el diálogo de subequipo solo ofrece integrantes).
    if (lider) { x.lideres.push(id); x.subs.forEach(s => { s.ids = s.ids.filter(y => y !== id); }); }
    st.eqrMenu = null; render(); eqrFoco(`[data-eqr-abrir="${CSS.escape('rol:' + id)}"]`); return;
  }
  const me = t.closest('[data-eqr-metodo]'); if (me) { x.metodo = eqrMetodo(me.dataset.eqrMetodo)[0]; st.eqrMenu = null; render(); eqrFoco('[data-eqr-abrir="metodo"]'); return; }
  const qu = t.closest('[data-eqr-quitar]'); if (qu) {
    // Un administrador lo saca solo un administrador sin equipo (el API lo exige): la X se ve como en la maqueta y avisa.
    if (!ALCANCE.todo && eqrEsAdmin(personaDe(qu.dataset.eqrQuitar))) { toast('Solo un administrador sin equipo puede sacar a un administrador de un equipo'); return; }
    eqrQuitar(x, qu.dataset.eqrQuitar); render(); return;
  }
  if (t.closest('[data-eqr-vertodas]')) { x.verTodas = true; render(); return; }
  if (t.closest('[data-eqr-subnuevo]')) { eqrAbrirSub(null); return; }
  const se = t.closest('[data-eqr-subeditar]'); if (se) { eqrAbrirSub(se.dataset.eqrSubeditar); return; }
  // Quien se acaba de agregar (40-ajustes.js) queda a la vista aunque la lista estuviera recogida.
  if (t.closest('[data-eq-add]') && !x.verTodas) { x.verTodas = true; render(); }
});
// Un clic fuera de la página cierra el menú. El camino del evento es el del momento del clic: si ese clic repintó la
// página (abrir el menú la repinta), su botón ya no está en ella, pero el clic sí fue adentro.
document.addEventListener('click', e => {
  if (!st.eqrMenu || e.composedPath().includes(document.getElementById('page'))) return;
  eqrCerrarMenuDom();
});
document.getElementById('page').addEventListener('keydown', e => {
  if (st.pagina !== 'cfg-reparto' || !st.eqDraft || !e.target.closest) return;
  const m = e.target.closest('.eqr-menu');
  if (m) {
    const ops = [...m.querySelectorAll('[role="option"]')], i = ops.indexOf(document.activeElement);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const j = e.key === 'Home' ? 0 : e.key === 'End' ? ops.length - 1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + ops.length) % ops.length; if (ops[j]) ops[j].focus(); return; }
    if (e.key === 'Escape') { e.preventDefault(); const b = eqrCerrarMenuDom(); if (b) b.focus(); return; }
    if (e.key === 'Tab') { const b = eqrCerrarMenuDom(); if (b) b.focus(); }
    return;
  }
  const b = e.target.closest('[data-eqr-abrir]');
  if (b && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); if (st.eqrMenu !== b.dataset.eqrAbrir) eqrAbrirMenu(b.dataset.eqrAbrir); }
});
document.getElementById('page').addEventListener('input', e => {
  if (st.pagina !== 'cfg-reparto' || !st.eqDraft) return;
  const x = st.eqDraft, t = e.target;
  if (t.id === 'eqr-rol') { x.rol = t.value; eqrPintarRol(x); return; }
  if (t.id === 'eq-nombre') { x.n = t.value; eqrPintarNombre(x); }
});
// Eliminar un equipo (40-ajustes.js): se van también sus líderes, su rol y sus subequipos.
document.getElementById('ov-x').addEventListener('click', e => {
  if (!e.target.closest('[data-eq-borrar-ok]')) return;
  const borrados = new Set(['lideres', 'roles', 'subequipos'].flatMap(k => Object.keys(EQ_CFG[k] || {})).filter(q => !(q in MIEMBROS)));
  for (const k of ['lideres', 'roles', 'subequipos']) for (const q of Object.keys(EQ_CFG[k] || {})) if (!(q in MIEMBROS)) delete EQ_CFG[k][q];
  // Sus conversaciones pasan a Ventas («quedan sin equipo»): el API las pasa al guardar; aquí, en pantalla.
  if (typeof crmRenombrarEquipo === 'function') for (const q of borrados) crmRenombrarEquipo(q, null);
  st.eqrMenu = null;
});

/* ── Diálogo de subequipo (Subequipo.dc.html): nuevo o editar; queda en el borrador hasta «Guardar cambios» ── */
function eqrAbrirSub(id){
  const x = st.eqDraft; if (!x) return;
  if (!id && x.subs.length >= 30) { toast('Un equipo puede tener máximo 30 subequipos'); return; }
  const s = id ? x.subs.find(y => y.id === id) : null; if (id && !s) return;
  st.eqrSq = {id: s ? s.id : null, n: s ? s.n : '', ids: s ? [...s.ids] : [], metodo: s ? eqrMetodo(s.metodo)[0] : 'turnos', abierto: false};
  eqrPintarSub(); setTimeout(() => { const i = document.getElementById('eqr-sq-n'); if (i) i.focus(); }, 30);
}
function eqrDlgSub(){
  const S = st.eqrSq, x = st.eqDraft, nom = eqrNom(x) || 'este equipo';
  // Solo los integrantes: el líder ya ve todas las conversaciones del equipo.
  const gente = x.ids.filter(id => !x.lideres.includes(id)).map(personaDe).filter(Boolean);
  const m = eqrMetodo(S.metodo), chulo = eqrSvg(EQR_IC.chulo, 12, 3);
  return `<div class="eqr-sqb"><div class="eqr-sqh"><div><h3>${S.id ? 'Editar subequipo' : 'Nuevo subequipo'}</h3><span>Dentro de ${esc(nom)}</span></div><button type="button" class="eqr-sqx" data-cerrar-dlg="1" aria-label="Cerrar">${eqrSvg(EQR_IC.x, 18, 2)}</button></div>
    <label class="eqr-lab">Nombre<input id="eqr-sq-n" value="${esc(S.n)}" placeholder="Ej. Moderación de salas" maxlength="60" autocomplete="off"></label>
    <div class="eqr-sqp" role="group" aria-labelledby="eqr-sq-pt"><span id="eqr-sq-pt">Personas</span>${gente.map(p => { const on = S.ids.includes(p.id); return `<button type="button" class="eqr-chk" role="checkbox" aria-checked="${on}" data-eqr-sq-per="${esc(p.id)}"><span class="eqr-caja${on ? ' on' : ''}">${on ? chulo : ''}</span>${avPer(p)}${esc(p.nombre)}</button>`; }).join('')}
      <small>Solo salen las personas de ${esc(nom)}. Una persona puede estar en más de un subequipo.</small></div>
    <div class="eqr-lab"><span id="eqr-sq-mt">Cómo se reparte</span><div class="eqr-dd"><button type="button" class="eqr-sel eqr-sel2${S.abierto ? ' abierto' : ''}" data-eqr-sq-abrir="1" aria-haspopup="listbox" aria-expanded="${!!S.abierto}" aria-labelledby="eqr-sq-mt eqr-sq-mv"><span id="eqr-sq-mv">${esc(m[1])}</span>${eqrSvg(S.abierto ? EQR_IC.arriba : EQR_IC.abajo, 14, 2)}</button>
      ${S.abierto ? `<div class="eqr-menu eqr-menu-m" role="listbox" aria-labelledby="eqr-sq-mt">${METODOS_EQ.map(([k, n]) => `<button type="button" class="eqr-op${k === m[0] ? ' sel' : ''}" role="option" aria-selected="${k === m[0]}" data-eqr-sq-metodo="${k}"><span><b>${esc(n)}</b><small>${esc(EQR_SUB_DESC[k] || '')}</small></span>${k === m[0] ? eqrSvg(EQR_IC.chulo) : ''}</button>`).join('')}</div>` : ''}</div>
      <small>${esc(EQR_SUB_DESC[m[0]] || '')}</small></div></div>
    <div class="eqr-sqft">${S.id ? `<button type="button" class="btn eqr-b eqr-borrar" data-eqr-sq-borrar="1">${eqrSvg(EQR_IC.papelera, 16, 2)}Eliminar subequipo</button><span class="eqr-sp"></span>` : ''}<button type="button" class="btn eqr-b" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn eqr-b pri" data-eqr-sq-ok="1">${S.id ? `${eqrSvg(EQR_IC.chulo, 16, 2)}Guardar cambios` : `${eqrSvg(EQR_IC.mas, 16, 2)}Crear subequipo`}</button></div>`;
}
function eqrPintarSub(){ if (st.eqrSq && st.eqDraft) abrirDialogo(eqrDlgSub(), 'eqr-dlg'); }
function eqrIdSub(){
  const usados = new Set([...Object.values(EQ_CFG.subequipos || {}).flat(), ...(st.eqDraft ? st.eqDraft.subs : [])].map(s => s && s.id));
  let id; do id = 'sq-' + Date.now().toString(36).slice(-6) + Math.random().toString(36).slice(2, 6); while (usados.has(id));
  return id;
}
function eqrGuardarSub(){
  const S = st.eqrSq, x = st.eqDraft; if (!S || !x) return;
  const nm = document.getElementById('eqr-sq-n'); if (nm) S.n = nm.value;
  const n = S.n.trim().replace(/\s+/g, ' ');
  if (!n) { toast('Escribe el nombre del subequipo'); if (nm) nm.focus(); return; }
  if (x.subs.some(s => s.id !== S.id && norm(s.n) === norm(n))) { toast(`${eqrNom(x) || 'Este equipo'} ya tiene un subequipo «${n}».`); if (nm) nm.focus(); return; }
  const ids = S.ids.filter(id => x.ids.includes(id) && !x.lideres.includes(id));
  if (!ids.length) { toast('Elige al menos una persona'); return; }
  if (S.id) { const s = x.subs.find(y => y.id === S.id); if (s) Object.assign(s, {n, ids, metodo: S.metodo}); }
  else x.subs.push({id: eqrIdSub(), n, ids, metodo: S.metodo});
  st.eqrSq = null; cerrarDialogo(); render();
}
document.getElementById('ov-x').addEventListener('click', e => {
  const S = st.eqrSq; if (!S || !e.target.closest('.eqr-dlg')) return;
  const t = e.target, nm = document.getElementById('eqr-sq-n'); if (nm) S.n = nm.value;
  const pe = t.closest('[data-eqr-sq-per]'); if (pe) {
    const id = pe.dataset.eqrSqPer, on = !S.ids.includes(id); S.ids = on ? [...S.ids, id] : S.ids.filter(y => y !== id);
    pe.setAttribute('aria-checked', String(on)); const c = pe.querySelector('.eqr-caja'); if (c) { c.classList.toggle('on', on); c.innerHTML = on ? eqrSvg(EQR_IC.chulo, 12, 3) : ''; }
    return;
  }
  if (t.closest('[data-eqr-sq-abrir]')) { S.abierto = !S.abierto; eqrPintarSub(); eqrFocoSub(S.abierto); return; }
  const me = t.closest('[data-eqr-sq-metodo]'); if (me) { S.metodo = eqrMetodo(me.dataset.eqrSqMetodo)[0]; S.abierto = false; eqrPintarSub(); eqrFocoSub(false); return; }
  if (S.abierto && !t.closest('.eqr-dd')) { S.abierto = false; eqrPintarSub(); }
  if (t.closest('[data-eqr-sq-ok]')) { eqrGuardarSub(); return; }
  if (t.closest('[data-eqr-sq-borrar]')) {
    const s = eqrSubDe(S.id); if (s) { st.eqDraft.subs = st.eqDraft.subs.filter(y => y !== s); st.eqrSq = null; cerrarDialogo(); render(); }
  }
});
const eqrSubDe = id => (st.eqDraft && id ? st.eqDraft.subs.find(y => y.id === id) : null) || null;
// Con el menú abierto, el foco va a la opción elegida; al cerrarlo, vuelve al botón.
function eqrFocoSub(abierto){
  const d = document.getElementById('dlg-x'); if (!d) return;
  const el = abierto ? (d.querySelector('.eqr-menu [aria-selected="true"]') || d.querySelector('.eqr-menu [role="option"]')) : d.querySelector('[data-eqr-sq-abrir]');
  if (el) el.focus({preventScroll: !abierto});
}
document.getElementById('ov-x').addEventListener('keydown', e => {
  const S = st.eqrSq; if (!S || !e.target.closest || !e.target.closest('.eqr-dlg')) return;
  const m = e.target.closest('.eqr-menu');
  if (m) {
    const ops = [...m.querySelectorAll('[role="option"]')], i = ops.indexOf(document.activeElement);
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const j = e.key === 'Home' ? 0 : e.key === 'End' ? ops.length - 1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + ops.length) % ops.length; if (ops[j]) ops[j].focus(); return; }
    // Escape cierra solo el menú, no el diálogo.
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); S.abierto = false; eqrPintarSub(); eqrFocoSub(false); return; }
    if (e.key === 'Tab') { e.preventDefault(); S.abierto = false; eqrPintarSub(); eqrFocoSub(false); }
    return;
  }
  if (e.target.closest('[data-eqr-sq-abrir]') && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); if (!S.abierto) { S.abierto = true; eqrPintarSub(); eqrFocoSub(true); } return; }
  if (S.abierto && e.key === 'Escape') { e.stopPropagation(); S.abierto = false; eqrPintarSub(); eqrFocoSub(false); }
});
document.getElementById('ov-x').addEventListener('input', e => { if (e.target.id === 'eqr-sq-n' && st.eqrSq) st.eqrSq.n = e.target.value; });

/* ── En vivo: lo que otra persona guarda y el alcance propio que cambia ── */
document.addEventListener('crm:evento', e => {
  const d = e.detail || {}; if (d.tipo !== 'ajuste' || d.clave !== 'equipos') return;
  // La página del equipo sin cambios se rehace con lo nuevo; con cambios, se conserva lo que se está haciendo.
  const x = st.eqDraft; if (!x || !x.orig || eqrCambiado(x)) return;
  if (!EQUIPOS.some(q => q.n === x.orig) || !puedeAdministrarEquipo(x.orig)) { eqrCerrarEditor(); return; }
  const n = eqrBorrador(x.orig); n.verTodas = x.verTodas; st.eqDraft = n;
});
document.addEventListener('crm:alcance', () => {
  const x = st.eqDraft;
  if (x && (x.orig ? !puedeAdministrarEquipo(x.orig) : !ALCANCE.todo)) eqrCerrarEditor();
  if (st.repTab === 'reglas' && !ALCANCE.config) st.repTab = 'equipos';
  if (st.perEq && !puedeAdministrarEquipo(st.perEq)) st.perEq = '';
});

/* ── Personas: quién ve qué en el CRM (RolesPersonas), con el buscador, el filtro por equipo, «Agregar persona»,
   «Máximo abiertas» y el lápiz de antes. El líder ve solo a la gente de sus equipos. ── */
tabPersonas = function(){
  const q = norm(st.perQ || ''), tope = CFG.reparto.tope, adm = equiposAdministrables();
  if (st.perEq && !adm.includes(st.perEq)) st.perEq = '';
  // Como la maqueta: primero quien no tiene equipo; después cada equipo, sus líderes arriba y su gente en el orden del equipo.
  const orden = p => { const eq = EQUIPOS.find(e => idsDe(e.n).includes(p.id)); return eq ? [EQUIPOS.indexOf(eq), rolEnEquipo(p.id, eq.n) === 'lider' ? 0 : 1, idsDe(eq.n).indexOf(p.id)] : [-1, 0, 0]; };
  const lista = eqrPersonasVisibles().filter(p => (!q || norm(p.nombre).includes(q)) && (!st.perEq || idsDe(st.perEq).includes(p.id)))
    .map(p => ({p, o: orden(p)})).sort((a, b) => a.o[0] - b.o[0] || a.o[1] - b.o[1] || a.o[2] - b.o[2]).map(y => y.p);
  const filas = lista.map(p => {
    const eqs = EQUIPOS.map(e => e.n).filter(eq => idsDe(eq).includes(p.id)), v = queVeEnCrm(p);
    const tags = eqs.length ? eqs.map(eq => { const l = rolEnEquipo(p.id, eq) === 'lider'; return `<span class="eqr-par"><span class="eqr-tag"><i style="background:${colorEquipo(eq)}"></i>${esc(eq)}</span><span class="eqr-tag${l ? ' lid' : ''}">${esc(l ? nombreLiderDe(eq) : rolIntegrantesDe(eq))}</span></span>`; }).join('') : '<span class="eqr-sin">Sin equipo</span>';
    return `<tr><td><span class="eqr-pers">${avPer(p)}${esc(p.nombre)}</span></td><td>${esc(ROL_NOMBRE[p.rol] || p.rol || '')}</td><td><span class="eqr-tags">${tags}</span></td><td>${esc(v.t)}${v.s ? `<small>${esc(v.s)}</small>` : ''}</td>
      <td><input class="rq-num" data-per-tope="${esc(p.id)}" value="${esc(EQ_CFG.topes[p.id] || '')}" placeholder="${tope}" inputmode="numeric" aria-label="Máximo de conversaciones abiertas de ${esc(p.nombre)}"></td>
      <td class="eqr-lap"><button type="button" class="btn ic" data-per-eq="${esc(p.id)}" aria-label="Editar a ${esc(p.nombre)}" title="Editar">${I('pen')}</button></td></tr>`;
  }).join('');
  return `<div class="eqr-pt"><p class="eqr-pdesc">Quién entra al CRM y qué ve. Los administradores que no están en ningún equipo ven todo; los demás ven lo que les da su rol en el equipo.</p>
    <div class="rq-bar"><label class="cn-q">${I('search')}<input id="per-q" value="${esc(st.perQ || '')}" placeholder="Buscar una persona" autocomplete="off" aria-label="Buscar una persona"></label>
      ${ddSel('data-per-filtro', [['', 'Todos los equipos'], ...adm.map(n => [n, n])], st.perEq)}<span class="sp"></span>${adm.length ? `<button type="button" class="btn pri" data-per-agregar="1">${I('plus')}Agregar persona</button>` : ''}</div>
    <div class="eqr-tw"><table class="eqr-tb"><thead><tr><th>Persona</th><th>Rol en la plataforma</th><th>Equipo y rol</th><th>Qué ve en el CRM</th><th>Máximo abiertas</th><th></th></tr></thead>
      <tbody>${filas || `<tr><td colspan="6" class="eqr-nadie">${q || st.perEq ? 'Nadie coincide con la búsqueda.' : 'Todavía no hay nadie en tus equipos.'}</td></tr>`}</tbody></table></div>
    <p class="rq-ayuda" style="margin-top:10px">Sin un máximo propio, cada persona usa el general de ${tope}${ALCANCE.config ? ' (Reglas del reparto)' : ''}.</p></div>`;
};

/* ── Diálogos de Personas: solo los equipos que esta persona administra; lo de los demás equipos no se toca ── */
dlgPersona = function(){
  const D = st.peDlg, p = personaDe(D.id) || {nombre: '', rol: ''};
  const d = D.datos, off = !d || !d.editable ? 'disabled' : '';
  const cuerpo = D.cargando ? '<p class="muted">Cargando sus datos…</p>' : D.error ? `<p class="muted">No se pudieron cargar sus datos: ${esc(D.error)}</p>` : `
    <div class="cx-f"><label>Nombre<input id="pe-n" value="${esc(d.nombre)}" ${off} autocomplete="off"></label>
      <label>Correo<input id="pe-c" type="email" value="${esc(d.email)}" ${off} autocomplete="off"><small class="muted">Es el correo con el que entra a la plataforma.</small></label>
      <div class="fld">Teléfono de contacto${campoTel('pe-t', d.telefono || '', {deshabilitado: !d.editable || !d.conTelefono, placeholder: d.conTelefono ? '300 123 4567' : 'No tiene ficha de asesor ni de marketing'})}</div></div>
    ${d.editable ? '' : '<p class="muted" style="margin:0">Solo un administrador puede cambiar los datos de esta persona.</p>'}`;
  const tope = D.tope !== undefined ? D.tope : (EQ_CFG.topes[D.id] || '');
  return `<h3>Editar a ${esc(p.nombre || (d && d.nombre) || 'esta persona')}</h3>
    <div class="rq-m">${avPer({...p, id: D.id})}<span class="tx"><b class="per-n">${esc(p.nombre || (d && d.nombre) || '')}</b><small>${esc(ROL_NOMBRE[p.rol] || p.rol || '')} · ${porRol(p.rol) ? 'entra al CRM por su rol' : 'entra al CRM por sus equipos'}</small></span></div>
    ${cuerpo}
    <div class="fld">Equipos<div class="cx-list">${equiposAdministrables().map(n => `<button type="button" class="cx-op eq-op" role="checkbox" aria-checked="${(D.sel || []).includes(n)}" data-pe-eq="${esc(n)}"${!ALCANCE.todo && eqrEsAdmin(p) ? ' disabled title="Solo un administrador sin equipo cambia los equipos de un administrador"' : ''}><span class="eq-caja">${I('check')}</span><span class="eq-nom">${esc(n)}</span></button>`).join('')}</div></div>
    <div class="cx-f"><label>Máximo de conversaciones abiertas<input id="pe-tope" inputmode="numeric" value="${esc(tope)}" placeholder="${CFG.reparto.tope}, el general" autocomplete="off"></label></div>
    <div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" data-pe-guardar="1" ${D.guardando ? 'disabled' : ''}>${I('check')}${D.guardando ? 'Guardando…' : 'Guardar'}</button></div>`;
};
// Deja a la persona en los equipos marcados de los que esta persona administra; al salir de uno, sale de sus líderes y subequipos.
function eqrMembresias(id, elegidos){
  let cambio = false;
  for (const eq of equiposAdministrables()) {
    const estaba = idsDe(eq).includes(id), queda = elegidos.includes(eq); if (estaba === queda) continue;
    const ids = idsDe(eq).filter(y => y !== id); if (queda) ids.push(id);
    EQ_CFG.ids[eq] = ids; MIEMBROS[eq] = ids.map(y => (personaDe(y) || {}).nombre).filter(Boolean);
    if (!queda) eqrSacarDe(eq, id);
    cambio = true;
  }
  return cambio;
}
guardarPersona = async function(){
  const D = st.peDlg; if (!D || D.guardando) return;
  const d = D.datos, cambios = {};
  // Los equipos de un administrador los cambia solo un administrador sin equipo (el API lo exige): nada se guarda a medias.
  if (!ALCANCE.todo && eqrEsAdmin(personaDe(D.id)) && equiposAdministrables().some(eq => idsDe(eq).includes(D.id) !== (D.sel || []).includes(eq))) { toast('Solo un administrador sin equipo cambia los equipos de un administrador'); return; }
  if (d && d.editable) {
    const n = document.getElementById('pe-n').value.trim(), c = document.getElementById('pe-c').value.trim().toLowerCase(), t = valorTel('pe-t');
    if (n.length < 2) { toast('Escribe el nombre completo'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(c)) { toast('Ese correo no parece completo'); return; }
    if (d.conTelefono && t && t.replace(/\D/g, '').length < 7) { toast('El teléfono está incompleto'); return; }
    if (n !== d.nombre) cambios.nombre = n;
    if (c !== String(d.email).toLowerCase()) cambios.email = c;
    if (d.conTelefono && t && t !== normalTel(d.telefono)) cambios.telefono = t;
  }
  if (Object.keys(cambios).length) {
    D.guardando = true; abrirDialogo(dlgPersona(), 'dlg-per');
    try { await crmApi('PATCH', `/auth/usuarios/${encodeURIComponent(D.id)}/perfil`, cambios); }
    catch (err) { D.guardando = false; abrirDialogo(dlgPersona(), 'dlg-per'); toast(err.message || 'No se pudieron guardar los datos'); return; }
    if (cambios.nombre) renombrarPersona(D.id, (personaDe(D.id) || {}).nombre || d.nombre, cambios.nombre);
  }
  const topeTxt = ((document.getElementById('pe-tope') || {}).value || '').trim(), topeAntes = EQ_CFG.topes[D.id] || '';
  if (topeTxt && !(Math.round(+topeTxt) >= 1 && Math.round(+topeTxt) <= 500)) { toast('El máximo va de 1 a 500'); return; }
  const topeCambio = String(topeTxt ? Math.round(+topeTxt) : '') !== String(topeAntes);
  if (topeCambio) { if (topeTxt) EQ_CFG.topes[D.id] = Math.round(+topeTxt); else delete EQ_CFG.topes[D.id]; }
  const eqCambio = eqrMembresias(D.id, D.sel || []);
  st.peDlg = null; cerrarDialogo(); render();
  toast(Object.keys(cambios).length || topeCambio || eqCambio ? 'Cambios guardados' : 'Sin cambios');
};
dlgAgregarPersona = function(){
  const A = st.pa, p = A.sel, d = A.datos, f = A.form || {};
  const lista = A.cargando && !A.res.length ? '<p class="muted" style="margin:0;padding:12px">Cargando…</p>'
    : A.error ? `<p class="muted" style="margin:0;padding:12px">${esc(A.error)}</p>`
    : A.res.length ? A.res.map(x => { const adm = !ALCANCE.todo && eqrEsAdmin(x); return `<button type="button" class="cx-op pa-op" data-pa-sel="${esc(x.id)}"${adm ? ' disabled' : ''}>${avPer(x)}<span style="flex:1;min-width:0"><b>${esc(x.nombre)}</b><small>${esc(adm ? `${x.rolNombre || ROL_NOMBRE[x.rol] || x.rol} · ${EQR_SOLO_ADMIN}` : [x.rolNombre || ROL_NOMBRE[x.rol] || x.rol, x.cargo || x.email].filter(Boolean).join(' · '))}</small></span>${x.enCrm ? '<span class="rq-rol">Ya está en el CRM</span>' : ''}</button>`; }).join('')
    : '<p class="muted" style="margin:0;padding:12px">Nadie coincide. Los colaboradores no aparecen: no pueden entrar al CRM.</p>';
  const off = !d || !d.editable ? 'disabled' : '';
  const datos = !p ? '' : A.cargandoDatos ? '<p class="muted" style="margin:0">Cargando sus datos…</p>' : !d ? `<p class="muted" style="margin:0">${esc(A.errorDatos || 'No se pudieron cargar sus datos.')}</p>` : `
    <div class="cx-f"><label>Nombre<input id="pa-n" value="${esc(f.nombre ?? d.nombre)}" ${off} autocomplete="off"></label>
      <label>Correo<input id="pa-c" type="email" value="${esc(f.email ?? d.email)}" ${off} autocomplete="off"><small class="muted">Es el correo con el que entra a la plataforma.</small></label>
      <div class="fld">Teléfono de contacto${campoTel('pa-t', f.telefono ?? (d.telefono || ''), {deshabilitado: !d.editable || !d.conTelefono, placeholder: d.conTelefono ? '300 123 4567' : 'No tiene ficha de asesor ni de marketing'})}</div></div>
    ${d.editable ? '' : '<p class="muted" style="margin:0">Solo un administrador puede cambiar los datos de esta persona.</p>'}`;
  const puede = p && (A.eqs || []).length && !A.guardando;
  return `<h3>Agregar persona</h3><p>Elige a alguien de la plataforma, revisa sus datos y elige sus equipos. Entra como integrante: ve solo lo que le asignen.</p>
    ${!p ? `<label class="cn-q" style="margin:0">${I('search')}<input id="pa-q" value="${esc(A.q)}" placeholder="Buscar por nombre o correo" autocomplete="off" aria-label="Buscar una persona de la plataforma"></label>
      <div class="cx-list" style="max-height:320px;overflow-y:auto">${lista}</div>`
    : `<div class="rq-m">${avPer(p)}<span class="tx"><b class="per-n">${esc(p.nombre)}</b><small>${esc([p.rolNombre || ROL_NOMBRE[p.rol] || p.rol, p.cargo].filter(Boolean).join(' · '))}</small></span><button type="button" class="btn" data-pa-cambiar="1">Cambiar</button></div>
      ${datos}
      <div class="fld">Equipos<div class="cx-list">${equiposAdministrables().map(n => `<button type="button" class="cx-op eq-op" role="checkbox" aria-checked="${(A.eqs || []).includes(n)}" data-pa-eq="${esc(n)}"><span class="eq-caja">${I('check')}</span><span class="eq-nom">${esc(n)}</span></button>`).join('')}</div></div>
      <div class="cx-f"><label>Máximo de conversaciones abiertas<input id="pa-tope" inputmode="numeric" value="${esc(f.tope ?? (EQ_CFG.topes[p.id] || ''))}" placeholder="${CFG.reparto.tope}, el general" autocomplete="off"></label></div>`}
    <div class="ft2"><button type="button" class="btn" data-cerrar-dlg="1">Cancelar</button><button type="button" class="btn pri" data-pa-guardar="1" ${puede ? '' : 'disabled'}>${I('plus')}${A.guardando ? 'Agregando…' : 'Agregar'}</button></div>`;
};
elegirPa = function(id){
  const A = st.pa, p = A.res.find(x => x.id === id); if (!p) return;
  if (!ALCANCE.todo && eqrEsAdmin(p)) { toast(EQR_SOLO_ADMIN); return; }
  A.sel = p; A.datos = null; A.form = {}; A.cargandoDatos = true; A.errorDatos = ''; A.eqs = equiposDePersona(id).filter(puedeAdministrarEquipo); delete TEL_PAIS['pa-t'];
  pintarPa();
  crmApi('GET', `/crm/personas/${encodeURIComponent(id)}`)
    .then(d => { if (st.pa === A && A.sel === p) A.datos = d; })
    .catch(err => { if (st.pa === A) A.errorDatos = err.message; })
    .finally(() => { if (st.pa === A && A.sel === p) { A.cargandoDatos = false; pintarPa(); } });
};
guardarAgregar = async function(){
  const A = st.pa; if (!A || !A.sel || A.guardando) return; leerPa();
  const p = A.sel, d = A.datos, f = A.form || {}, cambios = {}, elegidos = (A.eqs || []).filter(puedeAdministrarEquipo);
  if (!elegidos.length) { toast('Elige al menos un equipo'); return; }
  if (!ALCANCE.todo && eqrEsAdmin(p) && equiposAdministrables().some(eq => idsDe(eq).includes(p.id) !== elegidos.includes(eq))) { toast(EQR_SOLO_ADMIN); return; }
  const tope = String(f.tope || '').trim();
  if (tope && !(Math.round(+tope) >= 1 && Math.round(+tope) <= 500)) { toast('El máximo va de 1 a 500'); return; }
  if (d && d.editable) {
    const n = String(f.nombre ?? d.nombre).trim(), c = String(f.email ?? d.email).trim().toLowerCase(), t = String(f.telefono ?? d.telefono ?? '').trim();
    if (n.length < 2) { toast('Escribe el nombre completo'); return; }
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(c)) { toast('Ese correo no parece completo'); return; }
    if (d.conTelefono && t && t.replace(/\D/g, '').length < 7) { toast('El teléfono está incompleto'); return; }
    if (n !== d.nombre) cambios.nombre = n;
    if (c !== String(d.email).toLowerCase()) cambios.email = c;
    if (d.conTelefono && t && t !== normalTel(d.telefono)) cambios.telefono = t;
  }
  if (Object.keys(cambios).length) {
    A.guardando = true; pintarPa();
    try { await crmApi('PATCH', `/auth/usuarios/${encodeURIComponent(p.id)}/perfil`, cambios); }
    catch (err) { A.guardando = false; pintarPa(); toast(err.message || 'No se pudieron guardar sus datos'); return; }
    if (cambios.nombre) { renombrarPersona(p.id, p.nombre, cambios.nombre); p.nombre = cambios.nombre; }
  }
  PERSONAS_EXTRA[p.id] = {...(PERSONAS_EXTRA[p.id] || {}), nombre: p.nombre, rol: p.rol, foto: p.foto || null};
  eqrMembresias(p.id, elegidos);
  if (tope) EQ_CFG.topes[p.id] = Math.round(+tope);
  st.pa = null; cerrarDialogo(); render();
  toast(`${p.nombre} quedó en ${unirNombres(elegidos)}`);
};

/* ── Invitar por correo (6-oct): en «Agregar persona», quien todavía no tiene cuenta se invita con su nombre y su
   correo. El API crea su cuenta en este espacio (POST /crm/personas/invitar) y aquí se le eligen los equipos como a
   cualquiera; al guardarla en un equipo le llega el correo con el enlace para crear su contraseña y entrar. ── */
const dlgAgregarSinInvitar = dlgAgregarPersona;
dlgAgregarPersona = function(){
  const h = dlgAgregarSinInvitar(), A = st.pa;
  const sinPie = () => h.slice(0, h.lastIndexOf('<div class="ft2">'));
  if (A.sel) return h.replace('<div class="ft2">', `<p class="muted" style="margin:0;font-size:12.5px">Al agregarla a un equipo le llega un correo con el enlace para entrar${A.sel.nueva ? ' y crear su contraseña' : ''}.</p><div class="ft2">`);
  const v = A.inv || {};
  const caja = A.inv
    ? `<div class="pa-inv"><b>Invitar por correo</b><div class="cx-f" style="margin:0"><label>Nombre completo<input id="pa-inv-n" value="${esc(v.nombre || '')}" autocomplete="off"></label><label>Correo<input id="pa-inv-c" type="email" value="${esc(v.email || '')}" autocomplete="off" placeholder="nombre@empresa.com"></label>
        <div class="fld">Teléfono (opcional)${campoTel('pa-inv-t', v.telefono || '', {placeholder: '300 123 4567'})}</div></div>
        <div class="fld">Equipos<div class="cx-list">${equiposAdministrables().map(n => `<button type="button" class="cx-op eq-op" role="checkbox" aria-checked="${(v.eqs || []).includes(n)}" data-pa-inv-eq="${esc(n)}"><span class="eq-caja">${I('check')}</span><span class="eq-nom">${esc(n)}</span></button>`).join('')}</div></div>
        <p class="muted" style="margin:0;font-size:12.5px">Le llega un correo con el enlace para crear su contraseña y entrar. Entra como integrante: ve solo lo que le asignen.</p></div>`
    : `<button type="button" class="pa-inv-abrir" data-pa-inv-abrir="1">${I('plus')}¿No está en la lista? Invitar por correo</button>`;
  if (A.inv) return sinPie().replace(/<label class="cn-q"[\s\S]*$/, '') + `${caja}<div class="ft2"><button type="button" class="btn" data-pa-inv-cerrar="1">Cancelar</button><button type="button" class="btn pri" data-pa-invitar="1"${v.enviando ? ' disabled' : ''}>${I('send')}${v.enviando ? 'Enviando…' : 'Enviar invitación'}</button></div>`;
  return sinPie() + caja;
};
document.head.insertAdjacentHTML('beforeend', `<style>
.pa-inv-abrir{display:flex;align-items:center;gap:8px;width:100%;padding:10px 12px;border:1px dashed #cbd5e1;border-radius:10px;background:#fff;color:var(--ink2);font:inherit;font-size:13.5px;font-weight:500;cursor:pointer}
.pa-inv-abrir:hover{border-color:#94a3b8;background:#f8fafc}
.pa-inv-abrir svg{width:16px;height:16px}
.pa-inv{display:flex;flex-direction:column;gap:10px;padding:14px;border:1px solid #e5e9f0;border-radius:12px;background:#f8fafc}
.pa-inv > b{font-size:13.5px}
</style>`);
document.getElementById('ov-x').addEventListener('input', e => {
  const A = st.pa; if (!A || !A.inv) return;
  if (e.target.id === 'pa-inv-n') A.inv.nombre = e.target.value;
  if (e.target.id === 'pa-inv-c') A.inv.email = e.target.value;
  if (e.target.id === 'pa-inv-t') A.inv.telefono = valorTel('pa-inv-t');
});
document.getElementById('ov-x').addEventListener('click', e => {
  const A = st.pa; if (!A) return;
  const ie = e.target.closest('[data-pa-inv-eq]'); if (ie && A.inv) { const n = ie.dataset.paInvEq, s = A.inv.eqs || []; A.inv.telefono = valorTel('pa-inv-t'); A.inv.eqs = s.includes(n) ? s.filter(x => x !== n) : [...s, n]; pintarPa(); return; }
  if (e.target.closest('[data-pa-inv-abrir]')) { delete TEL_PAIS['pa-inv-t']; A.inv = {nombre: '', email: /@/.test(A.q || '') ? A.q.trim() : '', eqs: equiposAdministrables().length === 1 ? [...equiposAdministrables()] : []}; pintarPa(); setTimeout(() => { const x = document.getElementById('pa-inv-n'); if (x) x.focus(); }, 30); return; }
  if (e.target.closest('[data-pa-inv-cerrar]')) { A.inv = null; pintarPa(); return; }
  if (!e.target.closest('[data-pa-invitar]') || !A.inv || A.inv.enviando) return;
  const nombre = (A.inv.nombre || '').trim(), email = (A.inv.email || '').trim().toLowerCase();
  if (nombre.length < 2) { toast('Escribe el nombre completo'); return; }
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email)) { toast('Ese correo no parece completo'); return; }
  const telefono = valorTel('pa-inv-t'); A.inv.telefono = telefono;
  if (telefono && telefono.replace(/\D/g, '').length < 7) { toast('El teléfono está incompleto'); return; }
  const eqs = (A.inv.eqs || []).filter(puedeAdministrarEquipo); if (!eqs.length) { toast('Elige al menos un equipo'); return; }
  A.inv.enviando = true; pintarPa();
  // Al quedar en un equipo le llega el correo de invitación (invitaciones.ts, al guardar los equipos).
  crmApi('POST', '/crm/personas/invitar', {nombre, email, telefono: telefono.replace(/[^\d+]/g, '')})
    .then(p => { if (st.pa !== A) return; PERSONAS_EXTRA[p.id] = {...(PERSONAS_EXTRA[p.id] || {}), nombre: p.nombre, rol: p.rol, foto: p.foto || null}; eqrMembresias(p.id, eqs); st.pa = null; cerrarDialogo(); render(); toast(`Le enviamos la invitación a ${p.nombre} (${email})`); })
    .catch(err => { if (st.pa !== A) return; A.inv.enviando = false; pintarPa(); toast(err.message || 'No se pudo invitar'); });
});
