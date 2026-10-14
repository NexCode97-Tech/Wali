import crypto from 'node:crypto'
import { prismaGlobal } from './bd'
import { espacioActual } from './espacio'
import type { EquiposNorm } from './equipos'
import { correoMarca, escaparHtml, marcaCorreo } from '../../utils/correoMarca'
import { logger } from '../../utils/logger'
import { avisar } from '../notificaciones'

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
  // «al equipo Ventas», «a los equipos Ventas y Soporte» o «a su equipo de trabajo» (14-oct: antes decía «a el equipo»).
  const donde = !equipos.length ? 'a su equipo de trabajo' : `${equipos.length === 1 ? 'al equipo' : 'a los equipos'} ${lista(equipos)}`
  const marca = marcaCorreo()
  await enviarCorreo(u.email, `Te agregaron al CRM de ${marca}`,
    correoMarca({
      preencabezado: `${quien} te agregó ${donde} de ${empresa} en ${marca}.`,
      titulo: hola,
      parrafos: [
        `${escaparHtml(quien)} te agregó <strong style="color:#0a0a0d">${escaparHtml(donde)}</strong> de <strong style="color:#0a0a0d">${escaparHtml(empresa)}</strong> en el CRM de ${escaparHtml(marca)}.`,
        'Desde ahí atiendes las conversaciones de los clientes por WhatsApp y los demás canales, junto con tu equipo.',
      ],
      boton,
      aviso,
      nota: 'Si no esperabas esta invitación, ignora este correo.',
    }),
    `${hola}.\n\n${quien} te agregó ${donde} de ${empresa} en el CRM de ${marca}.\n\n${textoAcceso}\n\n${marca} · ${process.env.CRM_CORREO_AYUDA || 'nexcode97@gmail.com'}`)
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

/**
 * Aceptó la invitación (14-oct): la primera vez que entra, cada administrador de los espacios donde la agregaron
 * recibe un aviso en la campana y un correo. Quien se registró sola (la dueña de una empresa nueva) no le avisa a nadie.
 */
export async function avisarQueEntro(userId: string): Promise<void> {
  const u = await prismaGlobal.user.findUnique({ where: { id: userId }, select: { nombre: true, email: true } })
  if (!u) return
  const quien = (u.nombre || u.email).trim()
  const espacios = await prismaGlobal.crmMiembro.findMany({ where: { userId }, select: { espacioId: true, espacio: { select: { nombre: true } } } })
  for (const { espacioId, espacio } of espacios) {
    const miembros = await prismaGlobal.crmMiembro.findMany({ where: { espacioId, userId: { not: userId } }, select: { userId: true } })
    const admins = await prismaGlobal.user.findMany({ where: { id: { in: miembros.map(m => m.userId) }, role: 'ADMIN', suspendido: false }, select: { id: true, nombre: true, email: true } })
    for (const a of admins) {
      await avisar({ userId: a.id, autorId: userId, tipo: 'CRM_INVITACION_ACEPTADA', titulo: `${quien} ya entró al CRM`, texto: `Aceptó la invitación y ya puede atender conversaciones en ${espacio.nombre}.`, url: '/' })
      if (!process.env.RESEND_API_KEY || !urlCrm() || !a.email) continue
      const hola = a.nombre ? `Hola, ${a.nombre.split(' ')[0]}` : 'Hola'
      await enviarCorreo(a.email, `${quien} aceptó la invitación a ${marcaCorreo()}`,
        correoMarca({
          preencabezado: `${quien} ya entró al CRM de ${espacio.nombre}.`,
          titulo: hola,
          parrafos: [
            `<strong style="color:#0a0a0d">${escaparHtml(quien)}</strong> aceptó la invitación y ya entró al CRM de <strong style="color:#0a0a0d">${escaparHtml(espacio.nombre)}</strong>.`,
            'Desde ahora le pueden llegar conversaciones según las reglas de reparto de su equipo.',
          ],
          boton: { texto: 'Ver el equipo', url: `${urlCrm()}/` },
        }),
        `${hola}.

${quien} aceptó la invitación y ya entró al CRM de ${espacio.nombre}.

Entra al CRM: ${urlCrm()}/`,
      ).catch(e => logger.warn({ evento: 'AVISO_INGRESO_CORREO_FALLO', para: a.id, err: (e as Error).message }))
    }
  }
  logger.info({ evento: 'INVITACION_ACEPTADA', userId, espacios: espacios.length })
}
