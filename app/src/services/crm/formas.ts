import type { CrmContacto, CrmConversacion, CrmMensaje, CrmLinea } from '@prisma/client'
import { prisma } from './bd'
import { usuariosCrm } from './usuarios'

/**
 * De las filas de la base a los objetos que pinta la maqueta del CRM, con sus
 * mismos nombres (`n`, `tel`, `asig`, `etq`, `est`…). Contrato en
 * docs/crm/CONTRATO-CRM.md, sección 3.
 */

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})

/** 573001234567 → +57 300 123 4567. Otros países: + y los dígitos. */
export function telVisible(digitos: string | null | undefined): string {
  if (!digitos) return ''
  const d = digitos.replace(/\D/g, '')
  if (d.length === 12 && d.startsWith('57')) return `+57 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`
  return '+' + d
}

/** Cualquier forma de escribir un número → solo dígitos con indicativo (Colombia por defecto). */
export function telDigitos(tel: string | null | undefined): string | null {
  if (!tel) return null
  let d = String(tel).replace(/\D/g, '')
  if (!d) return null
  if (d.length === 10 && d.startsWith('3')) d = '57' + d
  return d
}

export async function mapaNombres(): Promise<Map<string, string>> {
  return new Map((await usuariosCrm()).map(u => [u.id, u.nombre]))
}

const FICHA_VACIA = { origen: '', interes: '', ciudad: '', nota: '', compras: null, previas: [] }
const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null)

/**
 * El token del formulario de la encuesta (lote 6) no sale a la pantalla: con él se reconoce la respuesta de WhatsApp, y
 * la pantalla no lo usa.
 */
function sinTokenEncuesta(d: Record<string, unknown>): Record<string, unknown> {
  const quitar = (k: 'encuesta' | 'csat') => {
    const x = d[k]
    if (!x || typeof x !== 'object' || Array.isArray(x) || !('token' in x)) return
    const { token: _t, ...resto } = x as Record<string, unknown>
    d = { ...d, [k]: resto }
  }
  quitar('encuesta'); quitar('csat')
  return d
}

export function msgAFront(m: CrmMensaje) {
  return {
    ...sinTokenEncuesta(obj(m.datos)),
    _id: m.id,
    _t: m.createdAt.toISOString(),
    _estado: m.estado ?? null,
    _error: m.error ?? null,
    _autorId: m.autorId ?? null,
    _prog: iso(m.programadoPara),
  }
}

export type ConvFila = CrmConversacion & { contacto: CrmContacto; mensajes?: CrmMensaje[] }

/** Cómo se muestra el contacto donde va el teléfono: el WhatsApp, el correo o el @usuario de Instagram. */
const contactoVisible = (k: CrmContacto) => telVisible(k.telefono) || k.correo || String(obj(k.ficha).usuario ?? '')

/** Los canales que salen por una conexión (Messenger, Instagram, Telegram, TikTok y correo). */
export const CANALES_CONEXION = ['fb', 'ig', 'tg', 'tt', 'mail']

/**
 * ¿La conversación tiene por dónde enviar? WhatsApp con su línea, el chat de la web, o Messenger,
 * Instagram, Telegram, TikTok y correo con su conexión.
 */
export const tieneSalida = (c: { canal: string; lineaId: string | null; conexionId?: string | null }) =>
  (c.canal === 'wa' && !!c.lineaId) || c.canal === 'web' || (CANALES_CONEXION.includes(c.canal) && !!c.conexionId)

/** El nombre del canal para los textos. */
export const nombreCanal = (canal: string) => ({ wa: 'WhatsApp', ig: 'Instagram', fb: 'Messenger', tg: 'Telegram', tt: 'TikTok', web: 'el chat de la web', mail: 'el correo' } as Record<string, string>)[canal] ?? canal

export function convAFront(c: ConvFila, nombres: Map<string, string>) {
  const k = c.contacto
  const ultimo = c.mensajes?.[0]
  // `_encuestaReserva` (el token de la encuesta que está saliendo, lote 6) no sale a la pantalla.
  const { _encuestaReserva: _r, ...extraK } = obj(k.extra)
  return {
    ...extraK,
    ...obj(c.extra),
    id: c.id,
    contactoId: k.id,
    numero: k.numero,
    n: k.nombre || contactoVisible(k) || 'Sin nombre',
    tel: contactoVisible(k),
    canal: c.canal,
    linea: c.lineaId,
    conexion: c.conexionId ?? null,
    asig: c.asignadoId ? nombres.get(c.asignadoId) ?? null : null,
    asigId: c.asignadoId,
    equipo: c.equipo,
    etq: k.etapa ? [k.etapa] : [],
    tags: k.tags ?? [],
    est: c.estado,
    soloLider: c.soloLider,
    prioridad: c.prioridad,
    motivo: c.motivoFin,
    pauta: k.pauta ?? null,
    ficha: { ...FICHA_VACIA, correo: k.correo ?? '', ...obj(k.ficha) },
    campos: obj(k.campos),
    recs: Array.isArray(c.recs) ? c.recs : [],
    menor: k.menor,
    aut: k.autorizacion ?? null,
    rep: k.representante ?? null,
    rne: k.rne ?? null,
    noContactar: k.noContactar ?? null,
    permisoLlamada: k.permisoLlamada ?? null,
    guardado: k.guardado,
    encuestada: c.encuestada,
    unread: c.noLeidos,
    _t: {
      creado: iso(c.createdAt),
      ultimo: iso(c.ultimoMensajeAt ?? c.createdAt),
      entrante: iso(c.ultimoEntranteAt),
      espera: iso(c.esperaDesde),
      finalizada: iso(c.finalizadaAt),
    },
    msgs: ultimo ? [msgAFront(ultimo)] : [],
    _parcial: true,
  }
}

export function contactoAFront(k: CrmContacto, nombres: Map<string, string>) {
  return {
    ...obj(k.extra),
    contactoId: k.id,
    numero: k.numero,
    n: k.nombre || contactoVisible(k) || 'Sin nombre',
    tel: telVisible(k.telefono) || '',
    correo: k.correo ?? '',
    canal: k.canal,
    etapa: k.etapa,
    asig: k.asignadoId ? nombres.get(k.asignadoId) ?? null : null,
    asigId: k.asignadoId,
    campos: obj(k.campos),
    ficha: { ...FICHA_VACIA, ...obj(k.ficha) },
    tags: k.tags ?? [],
    pauta: k.pauta ?? null,
    menor: k.menor,
    aut: k.autorizacion ?? null,
    rep: k.representante ?? null,
    rne: k.rne ?? null,
    noContactar: k.noContactar ?? null,
    guardado: k.guardado,
    _t: { creado: iso(k.createdAt), ultimo: iso(k.updatedAt) },
  }
}

/** La línea sin nada sensible: id, nombre, número y estado según Meta. */
export function lineaAFront(l: CrmLinea) {
  return {
    id: l.id, n: l.nombre, tel: l.telefono, estado: l.estado, calidad: l.calidad, limite: l.limite,
    phoneNumberId: l.phoneNumberId, conexionId: l.conexionId, wabaId: l.wabaId, ajustes: obj(l.ajustes),
  }
}

/**
 * El último mensaje que sirve de vista previa en la lista: lo que escribió el contacto, el equipo o la IA.
 * Los eventos (asignaciones, autorizaciones) y las notas no cuentan: si fueran lo último, la lista quedaría sin texto.
 */
export const ULTIMO_VISIBLE = { orderBy: { createdAt: 'desc' as const }, take: 1, where: { tipo: { in: ['in', 'out', 'ia', 'recepcion'] } } }

/** Una conversación lista para la pantalla, con su último mensaje. */
export async function cargarConv(id: number, nombres?: Map<string, string>) {
  const c = await prisma.crmConversacion.findUnique({
    where: { id },
    include: { contacto: true, mensajes: ULTIMO_VISIBLE },
  })
  if (!c) return null
  return convAFront(c, nombres ?? await mapaNombres())
}
