import { prisma } from '../../config/prisma'
import { logger } from '../../utils/logger'
import { ValidationError } from '../../utils/errors'
import { broadcastUsuarios } from '../../utils/sseManager'
import { urlPublica } from '../../routes/acceso'

/**
 * Soporte (maqueta aprobada el 31-oct): la persona escribe desde el asistente «Ayuda de Wali» del CRM y el operador le
 * responde desde el panel de superadministrador. La respuesta vuelve al asistente (aviso en vivo y globito en el botón)
 * y le llega por correo. El contexto que se guarda es solo de uso: pantalla, lo que buscó en la ayuda y líneas caídas.
 */

export const TEMAS = ['mensajes', 'cobros', 'como', 'otra'] as const
export type Tema = typeof TEMAS[number]
export const numero = (id: number) => `S-${id + 1000}`
const URGENTE = /\b(urgente|urgencia|emergencia|ya mismo|lo antes posible|no funciona nada|nada funciona|se cay[oó]|est[aá] ca[ií]d[oa]|todo ca[ií]do)\b/i
const limpio = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ').trim().slice(0, max) : '')
const esc = (t: string) => t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
const CORREO_SOPORTE = () => process.env.CRM_CORREO_AYUDA || 'nexcode97@gmail.com'

async function enviarCorreo(para: string, asunto: string, html: string, texto: string) {
  if (!process.env.RESEND_API_KEY) { logger.warn({ evento: 'SOPORTE_SIN_CORREO', asunto }); return }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.CRM_CORREO_DE || process.env.RESEND_FROM_EMAIL || 'Wali <hola@nexcode97.com>', reply_to: CORREO_SOPORTE(), to: [para], subject: asunto, html, text: texto }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 200)}`)
  } catch (e) { logger.error({ evento: 'SOPORTE_CORREO_FALLO', err: (e as Error).message }) }
}
const caja = (cuerpo: string) => `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1f2937;max-width:560px">${cuerpo}</div>`

// ─── Desde el CRM ────────────────────────────────────────────────────────────

export interface NuevaSolicitud { tema: Tema; texto: string; pantalla?: string; busco?: string[]; adjunto?: string | null }

export async function crearSolicitud(espacioId: string, userId: string, d: NuevaSolicitud) {
  const texto = limpio(d.texto, 4000)
  if (texto.length < 3) throw new ValidationError('Cuéntanos qué pasa.')
  const [u, caidas, espacio] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { nombre: true, email: true, role: true } }),
    prisma.crmLinea.findMany({ where: { espacioId, estado: { not: 'conectada' } }, select: { nombre: true, updatedAt: true } }),
    prisma.crmEspacio.findUnique({ where: { id: espacioId }, select: { nombre: true } }),
  ])
  const contexto = {
    pantalla: limpio(d.pantalla, 60),
    busco: (Array.isArray(d.busco) ? d.busco : []).map(b => limpio(b, 120)).filter(Boolean).slice(-5),
    rol: u?.role ?? '',
    caidas: caidas.map(l => ({ nombre: l.nombre, desde: l.updatedAt.toISOString() })),
  }
  const s = await prisma.crmSolicitud.create({ data: {
    espacioId, userId, tema: d.tema, prioridad: URGENTE.test(texto) ? 'urgente' : 'normal',
    asunto: texto.split('\n')[0].slice(0, 120), contexto, adjunto: d.adjunto || null,
    mensajes: { create: { autor: 'cliente', autorNombre: u?.nombre ?? u?.email ?? 'Cliente', texto } },
  } })
  const panel = urlPublica() ? `${urlPublica()}/admin#soporte` : ''
  void enviarCorreo(CORREO_SOPORTE(), `${s.prioridad === 'urgente' ? '[Urgente] ' : ''}Soporte ${numero(s.id)} · ${espacio?.nombre ?? ''}`,
    caja(`<p><b>${esc(u?.nombre ?? u?.email ?? '')}</b> (${esc(espacio?.nombre ?? '')}) pidió ayuda:</p><p style="white-space:pre-wrap;background:#f6f7f9;border-radius:10px;padding:12px 14px">${esc(texto)}</p>${panel ? `<p><a href="${esc(panel)}">Responder en el panel</a></p>` : ''}`),
    `${u?.nombre ?? ''} (${espacio?.nombre ?? ''}) pidió ayuda:\n\n${texto}\n\n${panel}`)
  logger.info({ evento: 'SOPORTE_NUEVA', numero: numero(s.id), prioridad: s.prioridad })
  return { id: s.id, numero: numero(s.id), estado: s.estado, prioridad: s.prioridad }
}

/** Las solicitudes de la persona, con sus mensajes, para el asistente (pestaña «Solicitudes» y aviso). */
export async function misSolicitudes(userId: string) {
  const ss = await prisma.crmSolicitud.findMany({ where: { userId }, orderBy: { updatedAt: 'desc' }, take: 20, include: { mensajes: { orderBy: { createdAt: 'asc' } } } })
  return {
    sinVer: ss.filter(s => !s.vista).length,
    solicitudes: ss.map(s => ({
      id: s.id, numero: numero(s.id), tema: s.tema, estado: s.estado, asunto: s.asunto, vista: s.vista, creada: s.createdAt, actualizada: s.updatedAt,
      mensajes: s.mensajes.map(m => ({ autor: m.autor, nombre: m.autorNombre, texto: m.texto, en: m.createdAt })),
    })),
  }
}

export async function marcarVistas(userId: string) {
  await prisma.crmSolicitud.updateMany({ where: { userId, vista: false }, data: { vista: true } })
}

/** «Ya quedó» (resuelta) o «Sigo con el problema» (se reabre, con lo que escriba). Solo sobre sus propias solicitudes. */
export async function clienteCambia(userId: string, id: number, accion: 'resuelta' | 'abierta', texto?: string) {
  const s = await prisma.crmSolicitud.findFirst({ where: { id, userId }, include: { mensajes: false } })
  if (!s) throw new ValidationError('Esa solicitud no existe.')
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { nombre: true, email: true } })
  const t = limpio(texto, 4000)
  await prisma.crmSolicitud.update({ where: { id }, data: {
    estado: accion, resueltaAt: accion === 'resuelta' ? new Date() : null, vista: true,
    ...(accion === 'abierta' ? { mensajes: { create: { autor: 'cliente', autorNombre: u?.nombre ?? u?.email ?? 'Cliente', texto: t || 'Sigo con el problema.' } } } : {}),
  } })
}

// ─── Desde el panel de superadministrador ───────────────────────────────────

const HORA = 3_600_000
/** Todas las solicitudes con lo necesario para la bandeja, más las cifras de arriba. */
export async function listaSoporte() {
  const ss = await prisma.crmSolicitud.findMany({ orderBy: { updatedAt: 'desc' }, take: 400, include: { mensajes: { orderBy: { createdAt: 'desc' }, take: 1 }, espacio: { select: { id: true, nombre: true, logo: true, cuentaId: true } } } })
  const usuarios = new Map((await prisma.user.findMany({ where: { id: { in: [...new Set(ss.map(s => s.userId))] } }, select: { id: true, nombre: true, email: true } })).map(u => [u.id, u]))
  const ahora = Date.now(), semana = ahora - 7 * 24 * HORA
  const filas = ss.map(s => {
    const ultimo = s.mensajes[0], u = usuarios.get(s.userId)
    return {
      id: s.id, numero: numero(s.id), tema: s.tema, prioridad: s.prioridad, estado: s.estado, asunto: s.asunto,
      persona: u?.nombre ?? u?.email ?? '', empresa: s.espacio.nombre, empresaId: s.espacio.cuentaId ?? s.espacio.id, logo: s.espacio.logo,
      creada: s.createdAt, actualizada: s.updatedAt,
      // Espera respuesta desde: el último mensaje es de la persona y no está resuelta.
      espera: s.estado !== 'resuelta' && ultimo?.autor === 'cliente' ? ultimo.createdAt : null,
      nueva: !s.primeraRespuestaAt && s.estado === 'abierta',
    }
  })
  const recientes = ss.filter(s => s.primeraRespuestaAt && s.createdAt.getTime() >= semana)
  const resueltas = ss.filter(s => s.resueltaAt && s.resueltaAt.getTime() >= semana)
  const hoy = new Date(ahora - 5 * HORA); const iniHoy = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()) + 5 * HORA
  return {
    solicitudes: filas,
    abiertas: filas.filter(f => f.estado === 'abierta').length, enCurso: filas.filter(f => f.estado === 'en_curso').length, resueltasTotal: filas.filter(f => f.estado === 'resuelta').length,
    nuevasHoy: ss.filter(s => s.createdAt.getTime() >= iniHoy).length,
    esperanMas4h: filas.filter(f => f.espera && ahora - new Date(f.espera).getTime() > 4 * HORA),
    primeraRespuestaMin: recientes.length ? Math.round(recientes.reduce((t, s) => t + (s.primeraRespuestaAt!.getTime() - s.createdAt.getTime()), 0) / recientes.length / 60_000) : null,
    resueltasSemana: resueltas.length,
    mismoDia: resueltas.length ? resueltas.filter(s => s.resueltaAt!.getTime() - s.createdAt.getTime() < 24 * HORA).length / resueltas.length : null,
  }
}

/** Una solicitud con su conversación, la persona, la empresa y lo que pidió antes. */
export async function detalleSoporte(id: number) {
  const s = await prisma.crmSolicitud.findUnique({ where: { id }, include: { mensajes: { orderBy: { createdAt: 'asc' } }, espacio: { select: { id: true, nombre: true, logo: true, cuentaId: true } } } })
  if (!s) return null
  const cuentaId = s.espacio.cuentaId ?? s.espacio.id
  const [u, cuenta, caidas, antes] = await Promise.all([
    prisma.user.findUnique({ where: { id: s.userId }, select: { nombre: true, email: true, role: true } }),
    prisma.crmEspacio.findUnique({ where: { id: cuentaId }, select: { plan: true, periodo: true, estadoPlan: true, cancelaAlFinal: true } }),
    prisma.crmLinea.findMany({ where: { espacioId: s.espacioId, estado: { not: 'conectada' } }, select: { nombre: true, updatedAt: true } }),
    prisma.crmSolicitud.findMany({ where: { userId: s.userId, id: { not: id } }, orderBy: { createdAt: 'desc' }, take: 3, select: { id: true, asunto: true, estado: true, createdAt: true, resueltaAt: true } }),
  ])
  return {
    id: s.id, numero: numero(s.id), tema: s.tema, prioridad: s.prioridad, estado: s.estado, asunto: s.asunto, creada: s.createdAt, adjunto: s.adjunto,
    contexto: s.contexto,
    persona: { nombre: u?.nombre ?? u?.email ?? '', correo: u?.email ?? '', rol: u?.role ?? '' },
    empresa: { id: cuentaId, nombre: s.espacio.nombre, logo: s.espacio.logo, plan: cuenta?.plan ?? '', periodo: cuenta?.periodo ?? null, estado: cuenta?.estadoPlan ?? '', cancelaAlFinal: !!cuenta?.cancelaAlFinal },
    caidas: caidas.map(l => ({ nombre: l.nombre, desde: l.updatedAt })),
    mensajes: s.mensajes.map(m => ({ autor: m.autor, nombre: m.autorNombre, texto: m.texto, en: m.createdAt })),
    antes: antes.map(a => ({ numero: numero(a.id), asunto: a.asunto, estado: a.estado, creada: a.createdAt, minutos: a.resueltaAt ? Math.round((a.resueltaAt.getTime() - a.createdAt.getTime()) / 60_000) : null })),
  }
}

/** La respuesta del equipo: queda en la conversación, avisa en vivo al asistente de la persona y le llega por correo. */
export async function responderSoporte(id: number, texto: string, quien: string) {
  const t = limpio(texto, 4000)
  if (t.length < 2) throw new ValidationError('Escribe la respuesta.')
  const s = await prisma.crmSolicitud.findUnique({ where: { id } })
  if (!s) throw new ValidationError('Esa solicitud no existe.')
  const nombre = quien.split(' ')[0] || 'Soporte'
  await prisma.crmSolicitud.update({ where: { id }, data: {
    estado: s.estado === 'resuelta' ? 'resuelta' : 'en_curso', vista: false, primeraRespuestaAt: s.primeraRespuestaAt ?? new Date(),
    mensajes: { create: { autor: 'soporte', autorNombre: nombre, texto: t } },
  } })
  broadcastUsuarios(new Set([s.userId]), 'soporte-respuesta', { id, numero: numero(id) })
  const u = await prisma.user.findUnique({ where: { id: s.userId }, select: { email: true, nombre: true } })
  if (u?.email) {
    const ir = urlPublica() ? `${urlPublica()}/?ayuda=solicitudes` : ''
    void enviarCorreo(u.email, `Soporte de Wali te respondió (${numero(id)})`,
      caja(`<p>Hola${u.nombre ? ', ' + esc(u.nombre.split(' ')[0]) : ''}. ${esc(nombre)}, del equipo de Wali, respondió tu solicitud <b>${numero(id)}</b>:</p><p style="white-space:pre-wrap;background:#fff8d6;border:1px solid #fde68a;border-radius:10px;padding:12px 14px">${esc(t)}</p>${ir ? `<p>También la ves en Wali, en el botón de ayuda. <a href="${esc(ir)}">Abrir Wali</a></p>` : ''}<p style="color:#6b7280;font-size:13px">Si sigues con el problema, respóndelo desde Wali o contesta este correo.</p>`),
      `${nombre}, del equipo de Wali, respondió tu solicitud ${numero(id)}:\n\n${t}\n\n${ir}`)
  }
}

export async function cambiarEstadoSoporte(id: number, estado: 'abierta' | 'en_curso' | 'resuelta') {
  const s = await prisma.crmSolicitud.findUnique({ where: { id }, select: { id: true } })
  if (!s) throw new ValidationError('Esa solicitud no existe.')
  await prisma.crmSolicitud.update({ where: { id }, data: { estado, resueltaAt: estado === 'resuelta' ? new Date() : null } })
}

/** Las preguntas que el asistente no entendió, de todas las empresas (ajuste `_ayuda` de cada espacio). */
export async function sinEntender() {
  const filas = await prisma.crmAjuste.findMany({ where: { clave: '_ayuda' }, select: { valor: true, espacio: { select: { id: true, nombre: true, cuentaId: true } } } })
  const todas: { q: string; en: string; empresa: string; empresaId: string }[] = []
  for (const f of filas) {
    const v = f.valor as { sinRespuesta?: { q?: unknown; en?: unknown }[] } | null
    for (const p of Array.isArray(v?.sinRespuesta) ? v!.sinRespuesta : []) {
      if (typeof p?.q === 'string' && typeof p?.en === 'string') todas.push({ q: p.q, en: p.en, empresa: f.espacio.nombre, empresaId: f.espacio.cuentaId ?? f.espacio.id })
    }
  }
  return todas.sort((a, b) => b.en.localeCompare(a.en)).slice(0, 300)
}
