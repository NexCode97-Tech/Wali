import crypto from 'node:crypto'
import { prismaGlobal } from './bd'
import { espacioActual } from './espacio'
import type { EquiposNorm } from './equipos'
import { correoMarca, escaparHtml } from '../../utils/correoMarca'
import { logger } from '../../utils/logger'

/**
 * Invitaciones (6-oct): a quien agregan a un equipo o subequipo le llega un correo con el nombre de la empresa, los
 * equipos y el enlace para entrar. Si todavía no tiene contraseña (nunca entró), el botón es «Crear mi contraseña»:
 * un enlace de un solo uso que vence en 7 días y, al guardarla, lo deja dentro del CRM de esa empresa. Si ya entró
 * alguna vez, el botón lleva al inicio de sesión. Nunca se manda una contraseña por correo.
 *
 * Sin RESEND_API_KEY o CRM_URL no sale nada (queda en el registro): la persona igual puede entrar con «Olvidé mi
 * contraseña» cuando el correo esté activo.
 */

const DIAS_ENLACE = 7
const hash = (token: string) => crypto.createHash('sha256').update(token).digest('hex')
const urlCrm = () => { const v = (process.env.CRM_URL ?? '').trim().replace(/\/+$/, ''); return /^https?:\/\/[^\s"'<>?#]+$/.test(v) ? v : null }

async function enviarCorreo(para: string, asunto: string, html: string, texto: string) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.CRM_CORREO_DE || process.env.RESEND_FROM_EMAIL || 'NexCode97 <hola@nexcode97.com>', reply_to: process.env.CRM_CORREO_AYUDA || 'nexcode97@gmail.com', to: [para], subject: asunto, html, text: texto }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 200)}`)
}

/** Equipo → [equipo y sus subequipos nuevos] de cada persona que entró a un equipo o a un subequipo. */
function nuevosPorPersona(antes: EquiposNorm, despues: EquiposNorm): Map<string, string[]> {
  const out = new Map<string, string[]>()
  const sumar = (id: string, t: string) => { const l = out.get(id) ?? []; if (!l.includes(t)) l.push(t); out.set(id, l) }
  for (const [eq, ids] of Object.entries(despues.ids)) {
    const tenia = new Set(antes.ids[eq] ?? [])
    for (const id of ids) if (!tenia.has(id)) sumar(id, eq)
    for (const s of despues.subequipos[eq] ?? []) {
      const previo = (antes.subequipos[eq] ?? []).find(x => x.id === s.id)
      const habia = new Set(previo?.ids ?? [])
      for (const id of s.ids ?? []) if (!habia.has(id)) sumar(id, `${eq} · ${s.n}`)
    }
  }
  return out
}

const lista = (l: string[]) => (l.length < 2 ? l[0] : `${l.slice(0, -1).join(', ')} y ${l[l.length - 1]}`)

/** El correo de invitación. Sin equipos: lo agregaron al CRM de la empresa (por ejemplo, como su administrador). */
export async function invitar(userId: string, equipos: string[], empresa: string, quien: string) {
  if (!process.env.RESEND_API_KEY || !urlCrm()) { logger.warn({ evento: 'INVITACION_SIN_CORREO', userId }); return }
  const u = await prismaGlobal.user.findUnique({ where: { id: userId }, select: { id: true, email: true, nombre: true, ultimoIngreso: true, suspendido: true } })
  if (!u || u.suspendido) return
  const base = urlCrm()!
  let boton = { texto: 'Entrar al CRM', url: `${base}/entrar` }
  let aviso = `Entra con tu correo <strong style="color:#0a0a0d">${escaparHtml(u.email)}</strong> y tu contraseña. Si no la recuerdas, toca «Olvidé mi contraseña».`
  let textoAcceso = `Entra con tu correo (${u.email}) y tu contraseña: ${base}/entrar`
  if (!u.ultimoIngreso) {
    // Nunca entró: un enlace para crear su contraseña. Vale el último; uno nuevo anula los anteriores.
    const token = crypto.randomBytes(32).toString('base64url')
    await prismaGlobal.recuperacionClave.updateMany({ where: { userId: u.id, usado: null }, data: { usado: new Date() } })
    await prismaGlobal.recuperacionClave.create({ data: { userId: u.id, tokenHash: hash(token), expira: new Date(Date.now() + DIAS_ENLACE * 86_400_000) } })
    boton = { texto: 'Crear mi contraseña', url: `${base}/entrar?clave=${token}` }
    aviso = `<strong style="color:#0a0a0d">El enlace vence en ${DIAS_ENLACE} días</strong> y sirve una sola vez. Después entras siempre en ${escaparHtml(base)}/entrar con tu correo y tu contraseña.`
    textoAcceso = `Crea tu contraseña aquí (vence en ${DIAS_ENLACE} días y sirve una sola vez):\n${boton.url}\n\nDespués entras siempre en ${base}/entrar con tu correo (${u.email}) y tu contraseña.`
  }
  const nombre = (u.nombre ?? '').trim().split(/\s+/)[0]
  const hola = nombre ? `Hola, ${nombre}` : 'Hola'
  const donde = !equipos.length ? 'su equipo de trabajo' : `${equipos.length === 1 ? 'el equipo' : 'los equipos'} ${lista(equipos)}`
  await enviarCorreo(u.email, `Te agregaron al CRM de ${empresa}`,
    correoMarca({
      preencabezado: `${quien} te agregó a ${donde} en el CRM de ${empresa}.`,
      titulo: hola,
      parrafos: [
        `${escaparHtml(quien)} te agregó a <strong style="color:#0a0a0d">${escaparHtml(donde)}</strong> en el CRM de <strong style="color:#0a0a0d">${escaparHtml(empresa)}</strong>.`,
        'Desde ahí atiendes las conversaciones de los clientes por WhatsApp y los demás canales, junto con tu equipo.',
      ],
      boton,
      aviso,
      nota: 'Si no esperabas esta invitación, ignora este correo.',
    }),
    `${hola}.\n\n${quien} te agregó a ${donde} en el CRM de ${empresa}.\n\n${textoAcceso}\n\nNexCode97 · ${process.env.CRM_CORREO_AYUDA || 'nexcode97@gmail.com'}`)
  logger.info({ evento: 'INVITACION_ENVIADA', userId: u.id, equipos, conClave: !u.ultimoIngreso })
}

/** Después de guardar los equipos: un correo a cada persona que entró a un equipo o subequipo (menos a quien guardó). */
export async function invitarNuevos(antes: EquiposNorm, despues: EquiposNorm, por: string): Promise<void> {
  const nuevos = nuevosPorPersona(antes, despues)
  nuevos.delete(por)
  if (!nuevos.size) return
  if (!process.env.RESEND_API_KEY || !urlCrm()) { logger.warn({ evento: 'INVITACION_SIN_CORREO', personas: nuevos.size }); return }
  const espacio = espacioActual()
  const [e, q] = await Promise.all([
    prismaGlobal.crmEspacio.findUnique({ where: { id: espacio }, select: { nombre: true } }),
    prismaGlobal.user.findUnique({ where: { id: por }, select: { nombre: true, email: true } }),
  ])
  const empresa = e?.nombre || 'tu empresa', quien = (q?.nombre || q?.email || 'Tu administrador').trim()
  for (const [id, equipos] of nuevos) {
    await invitar(id, equipos, empresa, quien).catch(err => logger.error({ evento: 'INVITACION_FALLO', userId: id, err: (err as Error).message }))
  }
}
