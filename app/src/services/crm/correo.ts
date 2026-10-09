import crypto from 'crypto'
import dns from 'dns/promises'
import net from 'net'
import type { CrmConexion, Prisma } from '@prisma/client'
import { ImapFlow } from 'imapflow'
import { simpleParser, type ParsedMail } from 'mailparser'
import nodemailer from 'nodemailer'
import { prisma, prismaGlobal } from './bd'
import { enEspacio, espacioActual } from './espacio'
import { cifrar, descifrar } from './cifrado'
import { ErrorEnvio, archivoPermitido, audioParaWhatsapp, opcionesLista } from './whatsapp'
import { sinFormatoWa } from './paginas'
import { conexionAFront, emitirConexiones, type ConexionFront } from './conexiones'
import { leerAjuste } from './ajustes'
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors'
import { logger } from '../../utils/logger'
import { avisarLideres, primeraVez } from './avisosCrm'

/**
 * Correo en el CRM. Una conexión `tipo: 'correo'` es un buzón: el CRM entra por
 * IMAP (solo lectura: no marca nada como leído), trae cada minuto los correos nuevos de la bandeja
 * de entrada y responde por SMTP en el mismo hilo. Google (Gmail y Workspace) con clave de
 * aplicación; cualquier otro proveedor con sus servidores IMAP y SMTP. Outlook y Microsoft 365 ya
 * no dejan entrar con clave (piden el inicio de sesión de Microsoft): no se ofrecen todavía.
 * Guía: docs/crm/api-correo.md.
 */

type Json = Record<string, any>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})
const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const azar = (n: number) => crypto.randomBytes(n).toString('hex')
const json = (v: unknown) => v as Prisma.InputJsonValue

interface Servidor { host: string; port: number; secure: boolean }
export interface DatosCorreo {
  correo: string
  remitente: string
  proveedor: 'google' | 'otro'
  usuario: string
  imap: Servidor
  smtp: Servidor
  /** El buzón por UID: se traen los correos con UID mayor que `ultimoUid`, mientras UIDVALIDITY no cambie. */
  uidValidity: string
  ultimoUid: number
  revisado?: string
}

const GOOGLE = { imap: { host: 'imap.gmail.com', port: 993, secure: true }, smtp: { host: 'smtp.gmail.com', port: 465, secure: true } }
const CORREO = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i
const HOST = /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i
/** Solo para las pruebas locales (servidor de correo sin cifrado en la misma máquina). */
const pruebasLocales = () => process.env.CRM_CORREO_PRUEBAS === '1'

function claveDe(c: Pick<CrmConexion, 'secretos'>): string {
  try { return String(descifrar<{ clave?: string }>(c.secretos).clave ?? '') } catch { return '' }
}

/** Un servidor que diga el cliente no puede ser de la red interna (ni de la máquina donde corre el CRM). */
function privada(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)
  }
  const x = ip.toLowerCase()
  return x === '::1' || x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe80') || x.startsWith('::ffff:127.') || x.startsWith('::ffff:10.') || x.startsWith('::ffff:192.168.')
}
async function exigirHostPublico(host: string) {
  if (pruebasLocales() && (host === '127.0.0.1' || host === 'localhost')) return
  if (!HOST.test(host)) throw new ValidationError(`«${host}» no parece la dirección de un servidor de correo (por ejemplo, imap.tuempresa.com).`)
  let ips: { address: string }[]
  try { ips = await dns.lookup(host, { all: true }) } catch { throw new ValidationError(`No se encontró el servidor «${host}»: revisa que esté bien escrito.`) }
  if (!ips.length || ips.some(i => privada(i.address))) throw new ValidationError(`«${host}» no es un servidor de correo público.`)
}

function servidorDe(host: unknown, puerto: unknown, tipo: 'imap' | 'smtp'): Servidor {
  const h = txt(host).toLowerCase()
  const p = Number(puerto) || (tipo === 'imap' ? 993 : 465)
  const permitidos = tipo === 'imap' ? [993, 143] : [465, 587]
  if (!permitidos.includes(p) && !(pruebasLocales() && p > 1024)) throw new ValidationError(`El puerto de ${tipo.toUpperCase()} suele ser ${permitidos.join(' o ')}.`)
  // 993 y 465 van cifrados desde el principio; 143 y 587 se cifran con STARTTLS (obligatorio, ver abajo).
  return { host: h, port: p, secure: p === 993 || p === 465 }
}

const opcionesImap = (s: Servidor, usuario: string, clave: string) => ({
  host: s.host, port: s.port, secure: s.secure, auth: { user: usuario, pass: clave }, logger: false as const,
  // Sin cifrado no se manda una clave: en los puertos sin TLS se exige STARTTLS (salvo el servidor de pruebas local).
  ...(s.secure ? {} : { doSTARTTLS: pruebasLocales() ? false : true }),
  connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 60_000,
})
const transporteSmtp = (s: Servidor, usuario: string, clave: string) => nodemailer.createTransport({
  host: s.host, port: s.port, secure: s.secure, auth: { user: usuario, pass: clave },
  requireTLS: !s.secure && !pruebasLocales(), ignoreTLS: !s.secure && pruebasLocales(),
  connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 60_000,
})

/** Qué pasó al entrar, dicho para quien conecta. */
function porQueNoEntra(e: unknown, s: Servidor, proveedor: string, tipo: 'IMAP' | 'SMTP'): string {
  const err = e as Json
  const t = `${txt(err?.responseText)} ${txt(err?.response)} ${txt(err?.message)}`.toLowerCase()
  if (err?.authenticationFailed || err?.code === 'EAUTH' || /auth|credentials|password|login/.test(t)) {
    return proveedor === 'google'
      ? 'Google no aceptó la clave. Usa una clave de aplicación (no la clave normal de la cuenta): se crea en myaccount.google.com/apppasswords y la cuenta necesita la verificación en dos pasos.'
      : `El servidor de ${tipo} no aceptó el usuario o la clave. Revísalos; si el correo tiene verificación en dos pasos, usa una clave de aplicación.`
  }
  if (/enotfound|eai_again/.test(t) || err?.code === 'ENOTFOUND') return `No se encontró el servidor ${s.host}.`
  if (/timeout|etimedout/.test(t) || err?.code === 'ETIMEDOUT') return `El servidor ${s.host}:${s.port} no respondió a tiempo. Revisa la dirección y el puerto de ${tipo}.`
  if (/econnrefused/.test(t) || err?.code === 'ECONNREFUSED') return `El servidor ${s.host}:${s.port} rechazó la conexión. Revisa el puerto de ${tipo}.`
  if (/starttls|tls|certificate|ssl/.test(t)) return `No se pudo hablar cifrado con ${s.host}:${s.port} por ${tipo}. Prueba con el puerto ${tipo === 'IMAP' ? '993' : '465'}.`
  return `No se pudo entrar por ${tipo} a ${s.host}: ${txt(err?.message) || 'error desconocido'}`
}

async function probarImap(s: Servidor, usuario: string, clave: string, proveedor: string) {
  const cliente = new ImapFlow(opcionesImap(s, usuario, clave))
  cliente.on('error', () => { /* el error de conexión llega por la promesa */ })
  try {
    await cliente.connect()
    const buzon = await cliente.mailboxOpen('INBOX', { readOnly: true })
    return { uidValidity: String(buzon.uidValidity), uidNext: Number(buzon.uidNext) || 1 }
  } catch (e) {
    throw new ValidationError(porQueNoEntra(e, s, proveedor, 'IMAP'))
  } finally {
    await cliente.logout().catch(() => cliente.close())
  }
}
async function probarSmtp(s: Servidor, usuario: string, clave: string, proveedor: string) {
  const t = transporteSmtp(s, usuario, clave)
  try { await t.verify() } catch (e) { throw new ValidationError(porQueNoEntra(e, s, proveedor, 'SMTP')) } finally { t.close() }
}

// ─── Conectar, revisar ───────────────────────────────────────────────────────

/** Conecta (o vuelve a conectar) un buzón. Prueba que entra y que puede enviar antes de guardar nada. */
export async function conectarCorreo(entrada: Json, por: string | null): Promise<ConexionFront> {
  const proveedor = txt(entrada.proveedor)
  if (proveedor === 'outlook') throw new ValidationError('Outlook y Microsoft 365 ya no dejan entrar con clave: piden el inicio de sesión de Microsoft, que todavía no está en el CRM.')
  if (proveedor !== 'google' && proveedor !== 'otro') throw new ValidationError('Elige el proveedor del correo.')
  const correo = txt(entrada.correo).toLowerCase()
  if (!CORREO.test(correo) || correo.length > 200) throw new ValidationError('Escribe el correo completo, por ejemplo ventas@tuempresa.com.')
  // Google muestra la clave de aplicación en grupos de cuatro con espacios: se quitan.
  const clave = proveedor === 'google' ? String(entrada.clave ?? '').replace(/\s+/g, '') : String(entrada.clave ?? '')
  if (!clave || clave.length > 300) throw new ValidationError(proveedor === 'google' ? 'Pega la clave de aplicación de 16 letras.' : 'Escribe la clave del correo.')
  const usuario = txt(entrada.usuario) || correo
  const remitente = txt(entrada.remitente).slice(0, 80)
  const { imap, smtp } = proveedor === 'google' ? GOOGLE : { imap: servidorDe(entrada.imapHost, entrada.imapPuerto, 'imap'), smtp: servidorDe(entrada.smtpHost, entrada.smtpPuerto, 'smtp') }
  if (proveedor === 'otro') { await exigirHostPublico(imap.host); await exigirHostPublico(smtp.host) }

  const otra = await prismaGlobal.crmConexion.findFirst({ where: { espacioId: { not: espacioActual() }, tipo: 'correo', datos: { path: ['correo'], equals: correo } }, select: { id: true } })
  if (otra) throw new ConflictError('Ese correo ya está conectado en otro espacio del CRM')

  const buzon = await probarImap(imap, usuario, clave, proveedor)
  await probarSmtp(smtp, usuario, clave, proveedor)

  const previa = await prisma.crmConexion.findFirst({ where: { tipo: 'correo', datos: { path: ['correo'], equals: correo } } })
  const dp = obj(previa?.datos) as Partial<DatosCorreo>
  // Solo lo que llegue desde ahora: conectar no trae el historial del buzón.
  const ultimoUid = previa && dp.uidValidity === buzon.uidValidity ? Number(dp.ultimoUid) || 0 : buzon.uidNext - 1
  const datos: DatosCorreo = { correo, remitente, proveedor, usuario, imap, smtp, uidValidity: buzon.uidValidity, ultimoUid, revisado: new Date().toISOString() }
  const c = previa
    ? await prisma.crmConexion.update({ where: { id: previa.id }, data: { nombre: correo, secretos: cifrar({ clave }), datos: json(datos), estado: 'conectada', error: null, verificadoEn: new Date() }, include: { _count: { select: { lineas: true } } } })
    : await prisma.crmConexion.create({ data: { tipo: 'correo', modo: 'manual', nombre: correo, clave: azar(24), secretos: cifrar({ clave }), datos: json(datos), estado: 'conectada', verificadoEn: new Date() }, include: { _count: { select: { lineas: true } } } })
  logger.info(`[CRM correo] ${correo} conectado (${proveedor}), por ${por}`)
  await emitirConexiones(por)
  return conexionAFront(c)
}

/** «Revisar»: vuelve a entrar, prueba el envío y trae lo que haya llegado. */
export async function revisarCorreo(id: string, por: string | null): Promise<ConexionFront> {
  const c = await prisma.crmConexion.findUnique({ where: { id } })
  if (!c || c.tipo !== 'correo') throw new NotFoundError('Ese correo ya no está conectado')
  const d = obj(c.datos) as DatosCorreo
  let error: string | null = null
  try {
    await probarSmtp(d.smtp, d.usuario, claveDe(c), d.proveedor)
    await leerBuzon(c, true)
  } catch (e) { error = (e as Error).message }
  const f = await prisma.crmConexion.findUniqueOrThrow({ where: { id } })
  const final = error
    ? await prisma.crmConexion.update({ where: { id }, data: { estado: 'error', error }, include: { _count: { select: { lineas: true } } } })
    : await prisma.crmConexion.update({ where: { id }, data: { estado: 'conectada', error: null, verificadoEn: new Date(), datos: f.datos as Prisma.InputJsonValue }, include: { _count: { select: { lineas: true } } } })
  await emitirConexiones(por)
  return conexionAFront(final)
}

// ─── Lo que llega ────────────────────────────────────────────────────────────

const leyendo = new Set<string>()
const MAX_POR_VUELTA = 30
const MAX_CORREO = 25 * 1024 * 1024

/**
 * Trae los correos nuevos de la bandeja de entrada (UID mayor que el último visto) y los pasa a la
 * bandeja del CRM. El buzón se abre en solo lectura. Si el servidor cambió UIDVALIDITY (el buzón se
 * reconstruyó), se empieza desde lo que llegue en adelante, sin repetir el historial.
 */
async function leerBuzon(c: CrmConexion, lanzar = false): Promise<number> {
  if (leyendo.has(c.id)) return 0
  leyendo.add(c.id)
  const d = obj(c.datos) as DatosCorreo
  const cliente = new ImapFlow(opcionesImap(d.imap, d.usuario, claveDe(c)))
  cliente.on('error', () => { /* llega por la promesa */ })
  let n = 0
  try {
    try { await cliente.connect() } catch (e) { throw new ValidationError(porQueNoEntra(e, d.imap, d.proveedor, 'IMAP')) }
    const lock = await cliente.getMailboxLock('INBOX', { readOnly: true })
    try {
      const buzon = cliente.mailbox && typeof cliente.mailbox === 'object' ? cliente.mailbox : null
      const uidValidity = String(buzon?.uidValidity ?? '')
      const uidNext = Number(buzon?.uidNext) || 1
      let ultimo = Number(d.ultimoUid) || 0
      if (uidValidity && uidValidity !== d.uidValidity) {
        logger.warn(`[CRM correo] ${d.correo}: el buzón cambió (UIDVALIDITY); se sigue con lo nuevo`)
        await guardarAvance(c, { uidValidity, ultimoUid: uidNext - 1 })
        return 0
      }
      if (uidNext - 1 <= ultimo) { await guardarAvance(c, {}); return 0 }
      const cfg = obj(await leerAjuste('cfg'))
      const encendido = obj(cfg.correo).on !== false
      const uids: number[] = []
      for await (const m of cliente.fetch(`${ultimo + 1}:*`, { uid: true, size: true }, { uid: true })) {
        if (m.uid > ultimo) uids.push(m.uid)
      }
      uids.sort((a, b) => a - b)
      const { procesarCorreoEntrante } = await import('./entrantes')
      for (const uid of uids.slice(0, MAX_POR_VUELTA)) {
        try {
          if (encendido) {
            const m = await cliente.fetchOne(String(uid), { uid: true, source: true, size: true }, { uid: true })
            if (m && m.source && (m.size ?? m.source.length) <= MAX_CORREO) {
              const correo = await simpleParser(m.source)
              if (await procesarCorreoEntrante(c, normalizar(correo, d, uid))) n++
            } else if (m && m.source) logger.warn(`[CRM correo] ${d.correo}: el correo ${uid} pesa más de 25 MB, no entra`)
          }
        } catch (e) {
          logger.error(`[CRM correo] ${d.correo}: no se pudo pasar el correo ${uid}: ${(e as Error).message}`)
        }
        ultimo = uid
        await guardarAvance(c, { ultimoUid: ultimo })
      }
    } finally { lock.release() }
    if (c.estado !== 'conectada') {
      await prisma.crmConexion.update({ where: { id: c.id }, data: { estado: 'conectada', error: null } })
      await emitirConexiones(null)
    }
    return n
  } catch (e) {
    const msg = (e as Error).message
    logger.warn(`[CRM correo] ${d.correo}: ${msg}`)
    if (lanzar) throw e
    if (c.estado !== 'error' || c.error !== msg) {
      await prisma.crmConexion.update({ where: { id: c.id }, data: { estado: 'error', error: msg } })
      await emitirConexiones(null)
      if (c.estado !== 'error' && primeraVez(`correo|${c.id}`, 6 * 3_600_000)) {
        await avisarLideres({ tipo: 'CAMBIOS_PEDIDOS', titulo: 'Un correo del CRM dejó de funcionar', texto: `El correo ${d.correo} no se pudo revisar: ${msg.replace(/[.\s]+$/, '')}. Revísalo en Ajustes del CRM, Canales.`, url: '/?ir=cfg-canales' })
          .catch(e2 => logger.warn(`[CRM correo] aviso: ${(e2 as Error)?.message ?? e2}`))
      }
    }
    return n
  } finally {
    leyendo.delete(c.id)
    await cliente.logout().catch(() => cliente.close())
  }
}

async function guardarAvance(c: CrmConexion, cambios: Partial<DatosCorreo>) {
  const f = await prisma.crmConexion.findUnique({ where: { id: c.id }, select: { datos: true } })
  await prisma.crmConexion.update({ where: { id: c.id }, data: { datos: json({ ...obj(f?.datos), ...cambios, revisado: new Date().toISOString() }), ultimoEventoEn: new Date() } })
}

/** Cada minuto: los buzones conectados de todos los espacios, cada uno en el suyo. */
export async function leerCorreos(): Promise<number> {
  const cxs = await prismaGlobal.crmConexion.findMany({ where: { tipo: 'correo', estado: { not: 'desconectada' } } })
  let n = 0
  for (const c of cxs) {
    // Un buzón que no deja entrar se reintenta cada 15 minutos, no cada minuto: los proveedores bloquean a quien insiste.
    if (c.estado === 'error' && Date.now() - c.updatedAt.getTime() < 15 * 60_000) continue
    n += await enEspacio(c.espacioId, () => leerBuzon(c)).catch(e => { logger.error(`[CRM correo] ${c.nombre}: ${(e as Error).message}`); return 0 })
  }
  return n
}

export interface CorreoEntrante {
  de: string
  nombre: string
  asunto: string
  texto: string
  mid: string
  refs: string[]
  fecha: Date
  adjuntos: { nombre: string; mime: string; buffer: Buffer }[]
  /** Respuesta automática, boletín o rebote: no abre conversación. */
  automatico: boolean
  propio: boolean
}

/** Lo que la persona escribió, sin el correo anterior citado debajo. */
export function sinCitado(texto: string): string {
  const lineas = texto.replace(/\r\n/g, '\n').split('\n')
  const corte = lineas.findIndex((l, i) => /^\s*(El|On|Le|Am)\s.{4,250}(escribió|wrote|a écrit|schrieb)\s*:\s*$/i.test(l)
    || (/^\s*(El|On)\s.{4,200}$/i.test(l) && /(escribió|wrote)\s*:\s*$/i.test(lineas[i + 1] ?? ''))
    || /^-{2,}\s*(Original Message|Mensaje original|Forwarded message|Mensaje reenviado)\s*-{2,}/i.test(l)
    || /^_{20,}\s*$/.test(l)
    || (/^\s*(De|From):\s.+/i.test(l) && /^\s*(Enviado|Sent|Fecha|Date):\s/i.test(lineas[i + 1] ?? '')))
  const propias = (corte >= 0 ? lineas.slice(0, corte) : lineas).filter(l => !/^\s*>/.test(l))
  return propias.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

function normalizar(m: ParsedMail, d: DatosCorreo, uid: number): CorreoEntrante {
  const de = (m.from?.value?.[0]?.address ?? '').toLowerCase()
  const cab = (k: string) => txt(String(m.headers.get(k) ?? '')).toLowerCase()
  const auto = cab('auto-submitted'), prec = cab('precedence')
  const automatico = (auto !== '' && auto !== 'no') || /bulk|junk|list|auto_reply/.test(prec) 
    // mailparser junta List-Id, List-Unsubscribe y demás en «list»: son boletines y listas de correo.
    || m.headers.has('list') || m.headers.has('list-id') || m.headers.has('list-unsubscribe')
    || m.headers.has('x-autoreply') || m.headers.has('x-autorespond') || /^(mailer-daemon|postmaster|no-?reply|noreply)@/i.test(de)
  const refs = Array.isArray(m.references) ? m.references : m.references ? [m.references] : []
  return {
    de, nombre: txt(m.from?.value?.[0]?.name).slice(0, 120), asunto: txt(m.subject).slice(0, 300) || '(sin asunto)',
    texto: sinCitado(txt(m.text)).slice(0, 20_000),
    mid: txt(m.messageId) || `<${d.correo}-${uid}@crm>`, refs: refs.map(String).slice(-10),
    fecha: m.date instanceof Date && !isNaN(m.date.getTime()) ? m.date : new Date(),
    // Los adjuntos de verdad: sin las imágenes de la firma que van pegadas al cuerpo.
    adjuntos: (m.attachments ?? []).filter(a => !(a.related || (a.contentDisposition === 'inline' && a.cid))).slice(0, 10)
      .filter(a => a.size <= 20 * 1024 * 1024)
      .map(a => ({ nombre: txt(a.filename) || 'adjunto', mime: txt(a.contentType) || 'application/octet-stream', buffer: a.content })),
    automatico, propio: de === d.correo,
  }
}

// ─── Lo que sale ─────────────────────────────────────────────────────────────

interface MsgCorreo { id: string; datos: unknown; conversacion: { id: number; conexionId: string | null; extra: unknown; contacto: { correo: string | null; nombre: string | null } } }

/** Envía por correo un CrmMensaje de salida ya guardado, en el hilo del último correo de la persona. */
export async function enviarPorCorreo(m: MsgCorreo): Promise<{ id: string; extra: string[] }> {
  const c = m.conversacion
  const SIN = 'El correo de esta conversación ya no está conectado al CRM: vuelve a conectarlo en Ajustes del CRM, Canales'
  if (!c.conexionId) throw new ErrorEnvio(SIN)
  const cx = await prisma.crmConexion.findUnique({ where: { id: c.conexionId } })
  if (!cx || cx.tipo !== 'correo') throw new ErrorEnvio(SIN)
  const d = obj(cx.datos) as DatosCorreo
  const para = txt(c.contacto.correo)
  if (!CORREO.test(para)) throw new ErrorEnvio('El contacto no tiene un correo al que responder')
  const datos = obj(m.datos)
  if (txt(datos.plantilla)) throw new ErrorEnvio('Las plantillas son de WhatsApp: por correo se escribe normal')

  let texto = sinFormatoWa(txt(datos.out) || txt(datos.bot) || txt(datos.ia) || txt(datos.recepcion))
  const url = txt(obj(datos.link).url)
  if (url && !texto.includes(url)) texto = texto ? `${texto}\n${url}` : url
  // Los botones y las listas de flujos y agentes van numerados: el correo no tiene botones.
  const botones = Array.isArray(datos.botones) ? datos.botones.map((b: unknown) => (typeof b === 'string' ? b : txt(obj(b).t) || txt(obj(b).title))).filter(Boolean) : []
  const lista = Array.isArray(obj(datos.lista).ops) ? opcionesLista(obj(datos.lista)).map(o => `${o.t}${txt(o.d) ? `: ${txt(o.d)}` : ''}`) : []
  const opciones = botones.length ? botones : lista
  if (opciones.length) texto = `${texto || 'Elige una opción y respóndenos con su número:'}\n\n${opciones.map((o: string, i: number) => `${i + 1}. ${o}`).join('\n')}`
  const adjuntos: { filename: string; href: string }[] = []
  const archivo = obj(datos.file), audio = obj(datos.audio)
  if (txt(archivo.url)) {
    if (!archivoPermitido(txt(archivo.url))) throw new ErrorEnvio('El archivo no está en la Nube del CRM: vuelve a adjuntarlo')
    adjuntos.push({ filename: txt(archivo.n) || 'archivo', href: txt(archivo.url) })
  } else if (txt(audio.url)) {
    adjuntos.push({ filename: 'nota-de-voz.mp3', href: audioParaWhatsapp(txt(audio.url), 'mp3') })
  }
  if (!texto && !adjuntos.length) throw new ErrorEnvio('El mensaje está vacío')

  const cfg = obj(await leerAjuste('cfg'))
  const firma = txt(obj(cfg.correo).firma)
  const cuerpo = `${texto}${firma ? `\n\n--\n${firma}` : ''}`
  const extra = obj(c.extra)
  const asunto = txt(extra.asunto)
  const espacio = await prismaGlobal.crmEspacio.findUnique({ where: { id: espacioActual() }, select: { nombre: true } })
  const refs = (Array.isArray(extra.mailRefs) ? extra.mailRefs : []).map(String).filter(Boolean)
  const t = transporteSmtp(d.smtp, d.usuario, claveDe(cx))
  try {
    const r = await t.sendMail({
      from: { name: d.remitente || espacio?.nombre || d.correo, address: d.correo },
      to: c.contacto.nombre ? { name: c.contacto.nombre, address: para } : para,
      // «Re:» solo cuando responde a un correo de la persona; uno que empieza el CRM va con su asunto tal cual.
      subject: asunto ? (txt(extra.mailMid) && !/^re:/i.test(asunto) ? `Re: ${asunto}` : asunto) : `Mensaje de ${d.remitente || espacio?.nombre || d.correo}`,
      text: cuerpo,
      ...(txt(extra.mailMid) ? { inReplyTo: txt(extra.mailMid), references: refs.length ? refs : [txt(extra.mailMid)] } : {}),
      ...(adjuntos.length ? { attachments: adjuntos } : {}),
    })
    const mid = txt(r.messageId)
    // La respuesta de la persona vendrá con este correo en sus referencias.
    await prisma.crmConversacion.update({ where: { id: c.id }, data: { extra: json({ ...extra, mailRefs: [...refs, mid].filter(Boolean).slice(-10) }) } })
    return { id: `mail:${mid || azar(8)}`, extra: [] }
  } catch (e) {
    throw new ErrorEnvio(porQueNoEntra(e, d.smtp, d.proveedor, 'SMTP'))
  } finally { t.close() }
}
