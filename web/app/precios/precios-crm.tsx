"use client";

import { useEffect, useRef, useState } from "react";
import { COMPARATIVA, PLANES, PREGUNTAS, USUARIOS_MIN, precioPorUsuarios } from "@/lib/precios-crm";
import s from "./precios.module.css";

const REGISTRO = "/crm/entrar?registro=1";
/** Growth y Business: crear la cuenta y, al entrar, el CRM lleva al pago de ese plan y periodo (crm/pantalla/js/70-plan.js). */
const pagar = (plan: string, anual: boolean, usuarios?: number) => `${REGISTRO}&pagar=${plan}&periodo=${anual ? "anual" : "mensual"}${usuarios ? `&usuarios=${usuarios}` : ""}`;
const USUARIOS_MAX = 20;
const usd = (v: number) => `USD ${v.toLocaleString("es-CO")}`;

/** El precio cuenta hasta el valor nuevo (ease-out-quart) en vez de saltar; sin animación si se pide menos movimiento. */
function useContador(fin: number, lento: boolean) {
  const [v, setV] = useState(fin);
  const desde = useRef(fin);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { desde.current = fin; setV(fin); return; }
    const ini = desde.current, t0 = performance.now(), dur = lento ? 700 : 350;
    let raf = 0;
    const paso = (t: number) => { const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4), x = Math.round(ini + (fin - ini) * e); desde.current = x; setV(x); if (k < 1) raf = requestAnimationFrame(paso); };
    raf = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(raf);
  }, [fin, lento]);
  return v;
}

/** Texto que entra deslizando cuando cambia. */
const Desliza = ({ t, className }: { t: string; className?: string }) => <span key={t} className={`${s.desliza} ${className ?? ""}`}>{t}</span>;
const VENTAS = "https://wa.me/573006359008";

const Ok = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const Guion = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 12h10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
const Flecha = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const Mas = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>;
const Estrella = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11.1 2.9a1 1 0 0 1 1.8 0l2.3 4.7 5.2.8a1 1 0 0 1 .6 1.7l-3.8 3.7.9 5.2a1 1 0 0 1-1.5 1l-4.6-2.4-4.6 2.4a1 1 0 0 1-1.5-1l.9-5.2-3.8-3.7a1 1 0 0 1 .6-1.7l5.2-.8z" fill="currentColor" /></svg>;
const Icono = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;

/* Confeti al activar el pago anual: estalla desde el interruptor, cae con gravedad y se desvanece. */
const COLORES = ["#FFD21F", "#FFD21F", "#f4f4f6", "#4ade80", "#E6BC12"];
type Pieza = { x: number; y: number; vx: number; vy: number; g: number; rot: number; vr: number; w: number; h: number; c: string; vida: number; redondo: boolean };

function useConfeti() {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const piezas = useRef<Pieza[]>([]);
  const animando = useRef(false);

  const cuadro = () => {
    const c = lienzo.current, cx = c?.getContext("2d");
    if (!c || !cx) return;
    cx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of piezas.current) {
      p.vx *= 0.985; p.vy = p.vy * 0.985 + p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.vida -= 0.009;
      cx.save(); cx.globalAlpha = Math.max(0, Math.min(1, p.vida * 1.6)); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.fillStyle = p.c;
      if (p.redondo) { cx.beginPath(); cx.arc(0, 0, p.h, 0, 6.28); cx.fill(); } else cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.rot * 2)) + 1);
      cx.restore();
    }
    piezas.current = piezas.current.filter((p) => p.vida > 0 && p.y < innerHeight + 40);
    if (piezas.current.length) requestAnimationFrame(cuadro);
    else { animando.current = false; cx.clearRect(0, 0, innerWidth, innerHeight); }
  };

  const lanzar = (origen: HTMLElement) => {
    const c = lienzo.current, cx = c?.getContext("2d");
    if (!c || !cx || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const d = Math.min(devicePixelRatio || 1, 2);
    c.width = innerWidth * d; c.height = innerHeight * d; cx.setTransform(d, 0, 0, d, 0, 0);
    const r = origen.getBoundingClientRect(), x0 = r.left + r.width / 2, y0 = r.top + r.height / 2;
    for (let i = 0; i < 170; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1, vel = 7 + Math.random() * 11;
      piezas.current.push({ x: x0, y: y0, vx: Math.cos(ang) * vel, vy: Math.sin(ang) * vel, g: 0.28 + Math.random() * 0.12, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.35,
        w: 6 + Math.random() * 6, h: 3 + Math.random() * 4, c: COLORES[i % COLORES.length], vida: 1, redondo: Math.random() < 0.25 });
    }
    if (!animando.current) { animando.current = true; requestAnimationFrame(cuadro); }
  };

  useEffect(() => () => { piezas.current = []; }, []);
  return { lienzo, lanzar };
}

export function PreciosCrm() {
  const [anual, setAnual] = useState(false);
  const [usuarios, setUsuarios] = useState(USUARIOS_MIN);
  const [cambioAnual, setCambioAnual] = useState(false);
  const interruptor = useRef<HTMLButtonElement>(null);
  const { lienzo, lanzar } = useConfeti();
  const calc = precioPorUsuarios(usuarios);
  const elegido = PLANES.find((p) => p.id === calc.plan)!;
  const cifra = useContador(anual ? Math.round(calc.mensual * 12 * 0.8) : calc.mensual, cambioAnual);
  const detalle = anual ? `Equivale a ${usd(Math.round(calc.mensual * 0.8))} al mes` : calc.extra ? `15 incluidos + ${calc.extra} extra a USD 20` : `${usuarios} usuarios incluidos`;
  const pct = ((usuarios - USUARIOS_MIN) / (USUARIOS_MAX - USUARIOS_MIN)) * 100;

  const cambiar = (a: boolean) => {
    setCambioAnual(a !== anual);
    setAnual(a);
    if (a && !anual && interruptor.current) lanzar(interruptor.current);
  };

  return (
    <div className={s.raiz}>
      <canvas ref={lienzo} className={s.confeti} aria-hidden="true" />
      <div className={s.escena}>
        <div className={s.envoltura}>
          <header className={s.cab}>
            <h1>Un precio fijo por el CRM. <span>Lo demás, directo y sin recargo.</span></h1>
            <p>Pagas solo por la plataforma. WhatsApp se lo pagas a Meta y la IA a su proveedor, cada uno con tu propia cuenta y a su tarifa oficial: sin recargos, sin saldos que se agotan y sin límite de conversaciones.</p>
          </header>

          <section className={s.calc} aria-label="Calcula tu plan">
            <div>
              <h2 className={s.calcT}>¿Cuántas personas de tu equipo usarán el CRM?</h2>
              <div className={s.cuantos}><b className={s.num}>{usuarios === USUARIOS_MAX ? `${USUARIOS_MAX}+` : usuarios}</b><span>usuarios</span></div>
              <input className={s.rango} type="range" min={USUARIOS_MIN} max={USUARIOS_MAX} value={usuarios} aria-label="Usuarios" aria-valuetext={`${usuarios} usuarios`}
                style={{ ["--p" as string]: `${pct}%` }} onChange={(e) => { setCambioAnual(false); setUsuarios(Number(e.target.value)); }} />
              <div className={s.marcas}>
                <div className={calc.plan === "starter" ? s.on : undefined}>3 a 5 · Starter</div>
                <div className={calc.plan === "growth" ? s.on : undefined}>6 a 10 · Growth</div>
                <div className={calc.plan === "business" && !calc.extra ? s.on : undefined}>11 a 15 · Business</div>
                <div className={calc.extra ? s.on : undefined}>16+ · Business</div>
              </div>
              <div className={s.interruptor}>
                <button type="button" className={`${s.lbl} ${!anual ? s.activo : ""}`} onClick={() => cambiar(false)}>Mensual</button>
                <button type="button" role="switch" aria-checked={anual} aria-label="Pagar anual con 20 % de descuento" className={s.sw} ref={interruptor} onClick={() => cambiar(!anual)}>
                  <span className={s.perilla} />
                </button>
                <button type="button" className={`${s.lbl} ${anual ? s.activo : ""}`} onClick={() => cambiar(true)}>Anual <span className={s.menos}>−20 %</span></button>
              </div>
            </div>
            <div className={s.res}>
              <small>Tu plan</small>
              <Desliza t={elegido.nombre} className={s.resPlan} />
              <div className={s.resPx}><b className={s.num}>{usd(cifra)}</b><Desliza t={anual ? "al año" : "al mes"} /></div>
              <Desliza t={detalle} className={s.resDet} />
              <a className={s.ctaCalc} href={elegido.prueba ? REGISTRO : pagar(elegido.id, anual, usuarios)}>{elegido.cta} <Flecha /></a>
            </div>
          </section>

          <section className={s.planes} aria-label="Planes">
            {PLANES.map((p) => (
              <article key={p.id} className={`${s.plan} ${p.id === calc.plan ? s.estrella : s.apagado}`}>
                {p.destacado && <span className={s.insignia}><Estrella />Más elegido</span>}
                <h2>{p.nombre}</h2>
                <p className={s.para}>{p.para}</p>
                <p className={s.rangoPlan}>{p.rango}</p>
                <div className={s.precio}>
                  <span className={s.por}>desde</span>
                  {anual && <span className={`${s.antes} ${s.num}`}>{p.anualSinDescuento}</span>}
                  <span className={`${s.cifra} ${s.num}`}><small>$</small><span className={s.valor}>{anual ? p.anual : p.mensual}</span></span>
                  <span className={s.por}>USD<br />{anual ? "al año" : "al mes"}</span>
                </div>
                <p className={`${s.notaPrecio} ${s.num}`}>{anual ? <>Equivale a {p.equivaleMes} al mes · <b>{p.ahorro}</b></> : "Facturado cada mes"}</p>
                <a className={s.cta} href={p.prueba ? REGISTRO : pagar(p.id, anual)}>{p.cta} <Flecha /></a>
                {p.prueba && <p className={s.letra}>10 días gratis con todo · sin tarjeta</p>}
                <dl className={s.ficha}>
                  {p.ficha.map((f) => <div key={f.k}><dt>{f.k}</dt><dd className={f.tono ? s[f.tono] : undefined}>{f.v}</dd></div>)}
                </dl>
                <ul className={s.lista}>
                  {p.base && <li className={s.base}>{p.base}</li>}
                  {p.incluye.map((x) => <li key={x}><Ok />{x}</li>)}
                </ul>
              </article>
            ))}
          </section>

          <section className={s.empresa} aria-label="Enterprise">
            <div>
              <h2>Enterprise</h2>
              <p>Para grupos con varias empresas o marcas, operaciones muy grandes o integraciones con tus propios sistemas. Armamos el plan contigo.</p>
              <div className={s.chips}><span>Varias marcas</span><span>Desarrollos a la medida</span><span>Servidor dedicado</span><span>Acuerdo de servicio</span><span>Gerente de cuenta</span></div>
            </div>
            <a className={s.cta} href={VENTAS} target="_blank" rel="noopener noreferrer">Hablar con ventas <Flecha /></a>
          </section>

          <section className={s.seccion} aria-labelledby="t-compara">
            <h2 className={s.tituloSec} id="t-compara">Compara los planes en detalle</h2>
            <p className={s.sub}>Todos incluyen conversaciones y líneas de WhatsApp ilimitadas. La diferencia está en el tamaño del equipo, la automatización y la IA.</p>
            <div className={s.tablaCaja}>
              <table>
                <thead><tr><th scope="col">Función</th>{PLANES.map((p) => <th scope="col" key={p.id} className={p.destacado ? s.marcado : undefined}>{p.nombre}<small className={s.num}>desde USD {p.mensual}</small></th>)}</tr></thead>
                <tbody>
                  {COMPARATIVA.map((g) => [
                    <tr className={s.grupo} key={g.grupo}><th colSpan={4} scope="colgroup">{g.grupo}</th></tr>,
                    ...g.filas.map(([f, ...v]) => (
                      <tr key={f}>
                        <th scope="row">{f}</th>
                        {v.map((x, i) => (
                          <td key={i} className={i === 1 ? s.colG : undefined}>
                            {x === true ? <span className={s.si}><Ok /></span> : x === false ? <span className={s.no}><Guion /></span> : x}
                          </td>
                        ))}
                      </tr>
                    )),
                  ])}
                </tbody>
              </table>
            </div>
          </section>

          <section className={`${s.seccion} ${s.recargo}`} aria-labelledby="t-recargo">
            <div className={s.txt}>
              <h2 className={s.tituloSec} id="t-recargo">Otros CRM te revenden los mensajes y la IA. Nosotros no.</h2>
              <p>Conectas tu propia cuenta de WhatsApp Business y tu propia cuenta de IA. Cada proveedor te cobra directo a tu tarjeta, a su tarifa oficial. Tu factura del CRM es siempre la misma, uses poco o mucho.</p>
              <ul>
                {["0 % de recargo sobre conversaciones y plantillas de WhatsApp", "0 % de recargo sobre las respuestas de la IA", "Sin créditos prepagados ni saldos que se vencen", "Tus cuentas son tuyas, aunque cambies de CRM"].map((x) => <li key={x}><Ok />{x}</li>)}
              </ul>
            </div>
            <div className={s.facturas} aria-label="Ejemplo de cómo se ve el cobro en cada caso">
              <div className={`${s.factura} ${s.otros}`}>
                <header><b>Otros CRM</b><span>Factura mensual</span></header>
                <div className={s.linea}><span>Plan del CRM</span><em>Fijo</em></div>
                <div className={s.linea}><span>Mensajes de WhatsApp</span><em className={s.alerta}>Tarifa + recargo</em></div>
                <div className={s.linea}><span>Créditos de IA</span><em className={s.alerta}>Paquetes</em></div>
                <div className={s.linea}><span>Recarga de saldo</span><em className={s.alerta}>Prepago</em></div>
                <div className={s.pieF}><span>Total</span><span>Variable</span></div>
                <p className={s.meta}>El costo sube con cada conversación y el saldo se agota.</p>
              </div>
              <div className={s.factura}>
                <span className={s.sello}>NexCode97</span>
                <header><b>Tu factura</b><span>Factura mensual</span></header>
                <div className={s.linea}><span>Plan del CRM</span><em>Fijo</em></div>
                <div className={s.linea}><span>Mensajes de WhatsApp</span><em>USD 0</em></div>
                <div className={s.linea}><span>Créditos de IA</span><em>USD 0</em></div>
                <div className={s.linea}><span>Recargas</span><em>No existen</em></div>
                <div className={s.pieF}><span>Total</span><span>Siempre igual</span></div>
                <p className={s.meta}>WhatsApp y la IA te cobran aparte, directo y sin intermediarios.</p>
              </div>
            </div>
          </section>

          <section className={s.seccion} aria-label="Garantías">
            <div className={s.confianza}>
              <div><Icono d="M3 8a2.5 2.5 0 0 1 2.5-2.5h13A2.5 2.5 0 0 1 21 8v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16zM3 10h18M7 15h4" /><b>Pago seguro</b><span>Tarjeta de crédito o débito. Impuestos de tu país calculados al pagar.</span></div>
              <div><Icono d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l4-4-4-4M14 12H4" /><b>Sin permanencia</b><span>Cancela cuando quieras desde Ajustes. Tus datos se pueden exportar.</span></div>
              <div><Icono d="M12 3 5 6v5.5c0 4.4 3 8.3 7 9.5 4-1.2 7-5.1 7-9.5V6l-7-3ZM9 12l2 2 4-4" /><b>Datos protegidos</b><span>Cada empresa en su propio espacio. Cumplimos la Ley 1581 de Colombia.</span></div>
              <div><Icono d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.6-5.1A8.5 8.5 0 1 1 21 11.5ZM8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" /><b>Soporte en español</b><span>Te acompañamos a conectar WhatsApp, tu cuenta de IA y tu primer agente.</span></div>
            </div>
          </section>

          <section className={`${s.seccion} ${s.faq}`} aria-labelledby="t-faq">
            <div className={s.intro}>
              <h2 className={s.tituloSec} id="t-faq">Preguntas frecuentes</h2>
              <p>¿No encuentras tu respuesta? Escríbenos y te ayudamos a elegir el plan.</p>
            </div>
            <div className={s.listaQ}>
              {PREGUNTAS.map(([q, r]) => <details key={q}><summary>{q}<Mas /></summary><p>{r}</p></details>)}
            </div>
          </section>

          <section className={s.cierre} aria-label="Empezar">
            <div>
              <h2>Atiende todos tus canales desde hoy.</h2>
              <p>Prueba 10 días gratis con todas las funciones, sin tarjeta. Conectas tu WhatsApp en minutos.</p>
            </div>
            <a className={s.cta} href={REGISTRO}>Probar Starter gratis <Flecha /></a>
          </section>

          <p className={s.legal}>Precios en dólares estadounidenses. NexCode97 · nexcode97.com</p>
        </div>
      </div>
    </div>
  );
}
