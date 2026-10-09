import type { Request, Response } from 'express'
import { dispararReglas } from '../../services/crm/reglas'
import { comoPdf, comoTexto, comoZip, renglones, type OpcionesExportar } from '../../services/crm/exportarChat'
import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma, prismaGlobal } from '../../services/crm/bd'
import { ApiResponse } from '../../utils/response'
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors'
import { auditLog } from '../../utils/auditLogger'
import { logger } from '../../utils/logger'
import { usuariosEnCrm } from '../../utils/sseManager'
import { avisar } from '../../services/notificaciones'
import { convAFront, contactoAFront, lineaAFront, mapaNombres, msgAFront, cargarConv, telVisible, ULTIMO_VISIBLE } from '../../services/crm/formas'
import { usuariosCrm, idDeNombre, nombreDe } from '../../services/crm/usuarios'
import { leerAjuste, leerPreferencias } from '../../services/crm/ajustes'
import { emitirConv, emitirCrm, emitirMsg } from '../../services/crm/tiempoReal'
import { waConfigurado } from '../../services/crm/whatsapp'
import { listarConexiones, canalesConectados } from '../../services/crm/conexiones'
import { avisarMencionesAlRecibir, guardarMensaje, motivoNoContactar, tipoDe, validarDesdePantalla } from '../../services/crm/salientes'
import { contactoVisible, convVigente, convVisible, exigirContactoCompleto, exigirEscritura, exigirLiderDeConv, exigirVerConv, idNum, mensajeReservado, mezclaProfunda, obj, txt, type Json } from './_comun'
import { alcanceDe, alcanceDePersona, alcanceParaFront, equipoDeConv, equiposDeReq, filtroContactos, filtroConvs, fueraDeLidera, genteQueLidera, lideraConv, reservaDeContacto, veConv, type Alcance } from '../../services/crm/alcance'
import { miembrosDe, repartir, tomarAlResponder } from '../../services/crm/reparto'
import { agenteDeEquipo } from '../../services/crm/agenteIA'
import { equipoDeCanal } from '../../services/crm/entrantes'
import type { Subequipo } from '../../services/crm/equipos'
import { esAudioIn, transcribirMensaje } from '../../services/crm/transcripciones'
import { actualizarContacto, CANALES, CLAVES_CONTACTO, emitirContacto, telefonoValido } from './_contacto'

/**
 * Bandeja del CRM: carga inicial, mensajes y cambios de cada conversación.
 * Formas en docs/crm/CONTRATO-CRM.md §3 y §4; extras en docs/crm/api-core.md.
 */

// ─── GET /inicio ─────────────────────────────────────────────────────────────

export async function inicio(req: Request, res: Response) {
  // Quién ve qué (alcance.ts): el administrador sin equipo, todo; el líder, su equipo; los demás, lo asignado.
  const alcance = await alcanceDe(req)
  const eqs = await equiposDeReq(req)
  const config = alcance.config
  const [usuarios, lineas, ajustesFilas, pref, convs, nombres, prefs] = await Promise.all([
    usuariosCrm(),
    prisma.crmLinea.findMany({ orderBy: { createdAt: 'asc' } }),
    // Las claves con «_» son internas (gasto y perfiles de la IA, marcas de procesos) y crecen cada día: ni se leen.
    // El «_» va escapado: en LIKE, un «_» suelto es cualquier carácter y dejaría fuera todos los ajustes.
    prisma.crmAjuste.findMany({ where: { NOT: { clave: { startsWith: '\\_' } } } }),
    leerPreferencias(req.userId!),
    prisma.crmConversacion.findMany({
      where: {
        AND: [convVigente(), filtroConvs(alcance)],
      },
      include: { contacto: true, mensajes: ULTIMO_VISIBLE },
      orderBy: [{ ultimoMensajeAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
    }),
    mapaNombres(),
    prisma.crmPreferencia.findMany(),
  ])
  const conContacto = [...new Set(convs.map(c => c.contactoId))]
  // Finalizadas de antes del lote 6b (sin `finPor`): quién la finalizó sale del evento «Finalizada por …» del chat.
  const sinQuien = convs.filter(c => c.estado === 'finalizadas' && !('finPor' in obj(c.extra))).map(c => c.id)
  if (sinQuien.length) {
    const evs = await prisma.crmMensaje.findMany({
      where: { conversacionId: { in: sinQuien }, tipo: 'ev', datos: { path: ['t'], string_starts_with: 'Finalizada por ' } },
      orderBy: { createdAt: 'desc' }, select: { conversacionId: true, datos: true },
    })
    const quien = new Map<number, string>()
    for (const e of evs) if (!quien.has(e.conversacionId)) quien.set(e.conversacionId, txt(obj(e.datos).t).replace(/^Finalizada por /, '').split(/ · |: /)[0].trim())
    for (const c of convs) { const q = quien.get(c.id); if (q) c.extra = { ...obj(c.extra), finPor: q } }
  }
  // Contactos sueltos (sin conversación vigente en la bandeja): los suyos, los de conversaciones que ve (de
  // cualquier fecha) y los de la gente de los equipos que lidera; nunca los reservados para otros líderes.
  const contactos = await prisma.crmContacto.findMany({
    where: { AND: [{ id: { notIn: conContacto } }, filtroContactos(alcance, genteQueLidera(alcance, eqs))] },
    orderBy: { updatedAt: 'desc' },
  })
  // Conectado = tiene el CRM abierto ahora (no otra página de la plataforma).
  const conectados = usuariosEnCrm()
  const prefDe = new Map(prefs.map(p => [p.userId, obj(p.valor)]))
  const ajustes: Json = {}
  // La base de conocimiento (con el texto completo de documentos y sitios) solo la usan las páginas de la
  // configuración general. Los equipos van normalizados (con líderes, roles y subequipos; equipos.ts).
  for (const a of ajustesFilas) {
    if (a.clave.startsWith('_') || (a.clave === 'kb' && !config)) continue
    ajustes[a.clave] = a.clave === 'equipos' ? eqs : a.valor
  }

  return ApiResponse.success(res, {
    usuarios: usuarios.map(u => {
      const p = prefDe.get(u.id) ?? {}
      return {
        id: u.id, nombre: u.nombre, foto: u.foto, rol: u.rol,
        estado: typeof p.estado === 'string' ? p.estado : 'En línea',
        reparto: p.reparto !== false,
        conectado: conectados.has(u.id),
      }
    }),
    lineas: lineas.map(lineaAFront),
    ajustes,
    pref,
    conversaciones: convs.map(c => convAFront(c, nombres)),
    contactos: contactos.map(k => contactoAFront(k, nombres)),
    waConfigurado: await waConfigurado(),
    espacio: await prismaGlobal.crmEspacio.findUnique({ where: { id: req.espacioId! }, select: { id: true, nombre: true } }),
    // Las cuentas de Meta conectadas: las administra la configuración general (Líneas de WhatsApp).
    conexiones: config ? await listarConexiones() : [],
    // Messenger, Instagram, Telegram y TikTok conectados (sin claves): para todos.
    canales: await canalesConectados(),
    // Qué ve y qué administra en el CRM (siempre un objeto desde el 29-sep).
    alcance: alcanceParaFront(alcance, eqs),
    ahora: new Date().toISOString(),
  })
}

// ─── Mensajes ────────────────────────────────────────────────────────────────

export async function listarMensajes(req: Request, res: Response) {
  const id = idNum(req.params.id)
  await convVisible(req, id)
  const filas = await prisma.crmMensaje.findMany({ where: { conversacionId: id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })
  return ApiResponse.success(res, filas.map(msgAFront))
}

/**
 * GET /crm/conversaciones/:id/exportar?formato=pdf|txt&notas=1&eventos=1&archivos=1 (lote 7): descarga el chat.
 * Con `archivos`, un .zip con el chat y sus fotos, audios, videos y documentos.
 */
export async function exportarChat(req: Request, res: Response) {
  const id = idNum(req.params.id)
  const c = await convVisible(req, id)
  const si = (v: unknown) => v === '1' || v === 'true'
  const op: OpcionesExportar = { formato: req.query.formato === 'txt' ? 'txt' : 'pdf', notas: si(req.query.notas), eventos: si(req.query.eventos), archivos: si(req.query.archivos) }
  const filas = await prisma.crmMensaje.findMany({ where: { conversacionId: id }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] })
  const lineas = renglones(c, filas, op)
  const base = `Chat con ${(c.contacto.nombre || c.contacto.telefono || 'cliente').replace(/[^\p{L}\p{N} ._-]+/gu, '').trim().slice(0, 60) || 'cliente'}`
  const chat = op.formato === 'txt' ? comoTexto(c, lineas) : comoPdf(c, lineas)
  const nombreChat = `${base}.${op.formato}`
  let cuerpo: Buffer, nombre: string, tipo: string
  if (op.archivos) { cuerpo = await comoZip(nombreChat, chat, lineas); nombre = `${base}.zip`; tipo = 'application/zip' }
  else { cuerpo = typeof chat === 'string' ? Buffer.from(chat, 'utf8') : chat; nombre = nombreChat; tipo = op.formato === 'txt' ? 'text/plain; charset=utf-8' : 'application/pdf' }
  auditLog(req, 'CREATE', 'crm_exportar_chat', String(id), { formato: op.formato, archivos: op.archivos, notas: op.notas, eventos: op.eventos })
  res.setHeader('Content-Type', tipo)
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(nombre)}`)
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition')
  return res.send(cuerpo)
}

const mensajeSchema = z.object({ datos: z.record(z.unknown()) })

export async function enviarMensaje(req: Request, res: Response) {
  exigirEscritura(req)
  const id = idNum(req.params.id)
  await convVisible(req, id)
  const { datos } = mensajeSchema.parse(req.body)
  if (JSON.stringify(datos).length > 200_000) throw new ValidationError('El mensaje es demasiado grande. Si es un archivo, súbelo primero con «Adjuntar».')
  // Lista blanca: mensajes, notas, programados, eventos y llamadas, con sus claves validadas.
  // Lote 7 (tablero 7): con una plantilla, «Cuando responda, mandar una nota de voz». El audio queda pendiente en la
  // conversación y sale apenas la persona conteste (entrantes.ts), porque WhatsApp no deja notas de voz en plantillas.
  const voz = obj(datos.vozAlResponder)
  const vozUrl = txt(voz.url)
  if (vozUrl && !/^https:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\//.test(vozUrl)) throw new ValidationError('Sube otra vez el audio de la nota de voz: no quedó en la Nube del CRM.')
  if (vozUrl && !datos.plantilla) throw new ValidationError('La nota de voz para cuando responda va con una plantilla.')
  const m = await guardarMensaje(id, validarDesdePantalla(datos), { autorId: req.userId! })
  if (m.tipo === 'out') await tomarAlResponder(id, req.userId!)
  if (vozUrl && m.tipo === 'out') {
    const pendiente = { _vozAlResponder: { url: vozUrl, mime: txt(voz.mime) || null, n: txt(voz.n).slice(0, 200) || null, por: req.userId!, by: (await nombreDe(req.userId!)) || null, tras: m.id } }
    await prisma.$executeRaw`UPDATE crm_conversaciones SET extra = COALESCE(extra, '{}'::jsonb) || ${JSON.stringify(pendiente)}::jsonb WHERE id = ${id}`
    const ev = await prisma.crmMensaje.create({ data: { conversacionId: id, tipo: 'ev', autorId: req.userId!, datos: { ev: 'mic', t: 'Cuando responda, le sale una nota de voz' } } })
    emitirMsg(id, ev, null)
  }
  return ApiResponse.created(res, msgAFront(m))
}

export async function borrarMensaje(req: Request, res: Response) {
  exigirEscritura(req)
  const id = idNum(req.params.id)
  const c = await convVisible(req, id)
  const m = await prisma.crmMensaje.findUnique({ where: { id: String(req.params.msgId) } })
  if (!m || m.conversacionId !== id) throw new NotFoundError('Ese mensaje ya no existe. Recarga la conversación.')
  if (m.tipo !== 'prog') throw new ValidationError('Solo se pueden borrar mensajes programados que todavía no han salido. Los enviados quedan en la conversación.')
  if (m.autorId && m.autorId !== req.userId && !lideraConv(await alcanceDe(req), c)) throw new ForbiddenError(`Solo quien programó el mensaje o un líder de ${equipoDeConv(c)} puede cancelarlo.`)
  const r = await prisma.crmMensaje.deleteMany({ where: { id: m.id, tipo: 'prog' } })
  if (!r.count) throw new ValidationError('Ese mensaje programado ya salió. Ya no se puede cancelar.')
  emitirCrm({ tipo: 'msg-borrado', convId: id, msgId: m.id }, req.userId!)
  return ApiResponse.success(res, { id: m.id })
}

// ─── PATCH /conversaciones/:id ───────────────────────────────────────────────

const ESTADOS = ['abiertas', 'pendientes', 'finalizadas'] as const
/** Lo que calcula la pantalla o viene del sistema: nunca se guarda desde un PATCH. */
const IGNORAR = new Set(['id', 'contactoId', 'msgs', 'unread', 'hora', 'min', 'espera', 'esperaMin', 'ventana', 'canal', 'motivo'])

const cambiosSchema = z.object({ cambios: z.record(z.unknown()) })

export async function editarConversacion(req: Request, res: Response) {
  exigirEscritura(req)
  const id = idNum(req.params.id)
  const previa = await convVisible(req, id)
  const { cambios } = cambiosSchema.parse(req.body)
  const alcance = await alcanceDe(req)
  const eqs = await equiposDeReq(req)

  // 1. Lo que no depende de la fila: se valida antes de bloquearla.
  const aContacto: Json = {}
  const conv: Prisma.CrmConversacionUncheckedUpdateInput = {}
  const extraCambios: Json = {}
  let nuevoAsignado: string | null | undefined
  for (const [k, v] of Object.entries(cambios)) {
    if (CLAVES_CONTACTO.has(k)) { aContacto[k] = v; continue }
    switch (k) {
      case 'asig': case 'asigId': {
        const uid = k === 'asig' ? await idDeNombre(txt(v) || null) : (txt(v) || null)
        if (v && !uid) throw new ValidationError(`No encontré a «${String(v)}» entre las personas de Ventas. Elígela de la lista.`)
        if (uid && !(await usuariosCrm()).some(u => u.id === uid)) throw new ValidationError('Esa persona no está en el equipo de Ventas. Elígela de la lista.')
        nuevoAsignado = uid
        conv.asignadoId = uid
        break
      }
      case 'equipo': conv.equipo = txt(v) || null; break
      // El subequipo se valida con la fila bloqueada (abajo): tiene que ser del equipo que la conversación tenga.
      case 'subequipo': break
      case 'est':
        if (!ESTADOS.includes(v as typeof ESTADOS[number])) throw new ValidationError('El estado debe ser abiertas, pendientes o finalizadas.')
        break
      case 'prioridad': conv.prioridad = txt(v) || null; break
      case 'recs':
        if (!Array.isArray(v)) throw new ValidationError('Los recordatorios deben ser una lista.')
        conv.recs = v as Prisma.InputJsonValue
        break
      case 'encuestada': conv.encuestada = Boolean(v); break
      case 'soloLider':
        // Marcar o quitar «solo líder»: el líder del equipo de la conversación o un administrador sin equipo.
        await exigirLiderDeConv(req, previa, 'marcar una conversación como solo para líderes')
        conv.soloLider = Boolean(v)
        break
      case 'linea': {
        const lid = txt(v) || null
        if (lid && !(await prisma.crmLinea.findUnique({ where: { id: lid }, select: { id: true } }))) throw new ValidationError('Esa línea de WhatsApp ya no existe. Elige otra de la lista.')
        conv.lineaId = lid
        break
      }
      default:
        if (IGNORAR.has(k) || k.startsWith('_')) break
        extraCambios[k] = v === undefined ? null : v
    }
  }

  // Cambio de equipo: se leen antes las personas del equipo nuevo (el ajuste `equipos`).
  const equipoNuevo = 'equipo' in cambios ? txt(cambios.equipo) || null : undefined
  const miembrosNuevo = equipoNuevo ? new Set((await miembrosDe(equipoNuevo)).map(u => u.id)) : null
  // Pasarla a un subequipo (29-sep): su id, o null / '' para quitarla del subequipo.
  const subPedido = 'subequipo' in cambios ? txt(cambios.subequipo) || null : undefined
  let reparteEquipo = false

  // 2. Con la conversación (y su contacto) bloqueados y leídos en ese instante: `extra`,
  //    `ficha` y `campos` se mezclan sobre lo guardado, no sobre la copia leída al empezar.
  const { c, contactoCambio } = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM crm_conversaciones WHERE id = ${id} FOR UPDATE`
    const c = await tx.crmConversacion.findUnique({ where: { id } })
    if (!c) throw new NotFoundError('Esa conversación ya no existe. Recarga la bandeja.')
    // Otra persona pudo quitársela, pasarla a otro equipo o volverla «solo líder» mientras tanto.
    exigirVerConv(alcance, c)
    if ('est' in cambios) {
      const v = cambios.est as string
      conv.estado = v
      if (v === 'finalizadas') {
        if (c.estado !== 'finalizadas') conv.finalizadaAt = new Date()
        conv.motivoFin = txt(cambios.motivo) || c.motivoFin || null
        conv.esperaDesde = null
      } else {
        conv.finalizadaAt = null
        conv.motivoFin = null
      }
    } else if ('motivo' in cambios && c.estado === 'finalizadas') {
      conv.motivoFin = txt(cambios.motivo) || null
    }
    // El subequipo: tiene que ser del equipo con que queda la conversación (sin equipo = Ventas). Cambiar de equipo
    // sin decir subequipo la saca del que tenía (queda null para que las otras pantallas limpien el suyo).
    const cambiaEquipo = equipoNuevo !== undefined && equipoNuevo !== (c.equipo ?? null)
    const equipoFinal = equipoNuevo !== undefined ? equipoNuevo : c.equipo
    const eqSub = equipoDeConv({ equipo: equipoFinal })
    const subAntes = obj(c.extra).subequipo ?? null
    let sub: Subequipo | null | undefined
    if (subPedido !== undefined) {
      if (subPedido === null) sub = null
      else {
        sub = (eqs.subequipos[eqSub] ?? []).find(x => x.id === subPedido)
        if (!sub) throw new ValidationError(`Ese subequipo no es de ${eqSub}. Elige uno de la lista.`)
        // Sin equipo es Ventas: queda escrito, así el reparto y la pantalla la ven en el mismo equipo.
        if (!equipoFinal) conv.equipo = eqSub
      }
    } else if (cambiaEquipo && subAntes) sub = null
    if (sub !== undefined && (sub?.id ?? null) !== subAntes) extraCambios.subequipo = sub ? sub.id : null
    const cambiaSub = !!sub && sub.id !== subAntes
    // Pasó a otro equipo o a un subequipo: si quien la tiene no es de ahí, queda sin asesor y se reparte entre esa
    // gente conectada. Esperando desde el cambio, así el reparto de cada minuto la sigue ofreciendo si no hay nadie conectado.
    const delEquipo = new Set(eqs.ids[eqSub] ?? [])
    const destino = sub ? new Set(sub.ids.filter(u => delEquipo.has(u))) : cambiaEquipo ? miembrosNuevo : null
    if ((cambiaSub || cambiaEquipo) && destino && c.estado !== 'finalizadas') {
      const quien = nuevoAsignado !== undefined ? nuevoAsignado : c.asignadoId
      if (!quien || !destino.has(quien)) {
        conv.asignadoId = null
        nuevoAsignado = undefined
        conv.esperaDesde = c.esperaDesde ?? new Date()
        reparteEquipo = true
      }
    }
    if (Object.keys(extraCambios).length) conv.extra = mezclaProfunda(c.extra, extraCambios, false) as Prisma.InputJsonValue
    // En el equipo (o subequipo) nuevo el reparto empieza de cero: sin los que ya se probaron ni la constancia de «nadie disponible».
    if (reparteEquipo) { const { _reparto, ...resto } = obj(conv.extra !== undefined ? conv.extra : c.extra); void _reparto; conv.extra = resto as Prisma.InputJsonValue }
    let contactoCambio = false
    // Asignar la conversación también deja a esa persona como dueña del contacto (para «cliente conocido»).
    if (Object.keys(aContacto).length || nuevoAsignado) {
      const r = await actualizarContacto(c.contactoId, aContacto, false, nuevoAsignado ? { asignadoId: nuevoAsignado } : {}, tx)
      contactoCambio = r.cambio && Object.keys(aContacto).length > 0
    }
    if (Object.keys(conv).length) await tx.crmConversacion.update({ where: { id }, data: conv })
    return { c, contactoCambio }
  }, { timeout: 20_000 })

  // Si el equipo (o subequipo) al que pasó tiene agente IA, la toma él; si no, se reparte entre su gente.
  if (reparteEquipo && !(await agenteDeEquipo(id))) await repartir(id)
  const nombres = await mapaNombres()
  const salida = await cargarConv(id, nombres)
  emitirCrm({ tipo: 'conv', conv: salida }, req.userId!)
  // El contacto cambió: sus otras conversaciones (las que están en la bandeja) también se ven distintas.
  if (contactoCambio) {
    const otras = await prisma.crmConversacion.findMany({ where: { contactoId: c.contactoId, id: { not: id }, ...convVigente() }, select: { id: true } })
    for (const o of otras) await emitirConv(o.id, req.userId!)
  }
  if (nuevoAsignado && nuevoAsignado !== c.asignadoId && nuevoAsignado !== req.userId) {
    const pref = await leerPreferencias(nuevoAsignado)
    if (pref.asignada !== false) {
      avisar({
        userId: nuevoAsignado, autorId: req.userId!, tipo: 'TAREA_ASIGNADA', titulo: 'Te asignaron una conversación',
        texto: `${(await nombreDe(req.userId!)) ?? 'Alguien del equipo'} te asignó la conversación con ${previa.contacto.nombre || telVisible(previa.contacto.telefono) || 'un contacto'}.`,
        url: `/?conv=${id}`,
      }).catch(e => logger.warn(`[CRM] aviso de asignación: ${(e as Error)?.message}`))
    }
  }
  // Quien la recibe no la veía (30-sep): la nota que lo menciona y va antes de la asignación (la de «Transferir») no le
  // sonó, porque una mención no da acceso. Le suena ahora que es suya.
  if (nuevoAsignado && nuevoAsignado !== c.asignadoId) {
    const rol = (await usuariosCrm()).find(u => u.id === nuevoAsignado)?.rol
    if (!veConv(alcanceDePersona(nuevoAsignado, rol, eqs), c)) {
      avisarMencionesAlRecibir(id, nuevoAsignado, req.userId!).catch(e => logger.warn(`[CRM] aviso de mención al asignar: ${(e as Error)?.message}`))
    }
  }
  // Reglas automáticas de lo que cambió (sin frenar la respuesta).
  void (async () => {
    if (nuevoAsignado && nuevoAsignado !== c.asignadoId) await dispararReglas('asignada', id, { asignadoId: nuevoAsignado, antes: c.asignadoId })
    const etapaNueva = (salida as { etq?: string[] } | null)?.etq?.[0] ?? null
    if ('etq' in cambios && etapaNueva !== (previa.contacto.etapa ?? null)) await dispararReglas('etapa', id, { antes: previa.contacto.etapa, etapa: etapaNueva })
    if (cambios.est === 'finalizadas' && c.estado !== 'finalizadas') await dispararReglas('finalizada', id, { motivo: txt(cambios.motivo) || null, por: (await nombreDe(req.userId!)) || null })
  })().catch(e => logger.warn(`[CRM reglas] ${id}: ${(e as Error)?.message}`))
  return ApiResponse.success(res, salida)
}

export async function marcarLeida(req: Request, res: Response) {
  const id = idNum(req.params.id)
  const c = await convVisible(req, id)
  if (c.noLeidos) await prisma.crmConversacion.update({ where: { id }, data: { noLeidos: 0 } })
  const salida = await cargarConv(id)
  if (c.noLeidos) emitirCrm({ tipo: 'conv', conv: salida }, req.userId!)
  return ApiResponse.success(res, salida)
}

// ─── POST /conversaciones (nueva) ────────────────────────────────────────────

const nuevaSchema = z.object({
  contactoId: z.number().int().positive().optional(),
  tel: z.string().max(40).optional(),
  n: z.string().max(120).optional(),
  linea: z.string().nullable().optional(),
  canal: z.enum(CANALES).default('wa'),
  datos: z.array(z.record(z.unknown())).max(20).default([]),
  /** Correo: la dirección de la persona, el buzón por el que sale y el asunto. */
  correo: z.string().max(200).optional(),
  conexion: z.string().max(40).optional(),
  asunto: z.string().max(200).optional(),
})

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i

/** El equipo que atiende lo que entra por esa línea o ese canal (igual que entrantes.ts); null si no se sabe. */
async function equipoDelLugar(canal: string, lineaId: string | null): Promise<string | null> {
  const cfg = obj(await leerAjuste('cfg'))
  if (canal === 'wa') {
    if (!lineaId) return null
    const eq = (Array.isArray(cfg.lineas) ? cfg.lineas : []).map(obj).find(l => l.id === lineaId)?.eq
    if (txt(eq)) return txt(eq)
    const l = await prisma.crmLinea.findUnique({ where: { id: lineaId }, select: { ajustes: true } })
    return txt(obj(l?.ajustes).equipo) || txt(obj(l?.ajustes).eq) || 'Ventas'
  }
  if (canal === 'web') return txt(obj(cfg.web).eq) || 'Ventas'
  return equipoDeCanal(cfg, canal)
}

/**
 * El equipo de una conversación nueva (29-sep): el de la línea o el canal si la persona es de ese equipo; si no,
 * su primer equipo. Quien no está en ningún equipo (el administrador o no), el de la línea o el canal (sin línea =
 * Ventas): así quién la ve si queda sin asignar (su equipo) y quién la recibe del reparto (el de su línea) coinciden
 * (30-sep). Queda asignada a quien la crea, así que siempre la ve.
 */
function equipoParaNueva(a: Alcance, deLugar: string | null): string | null {
  if (a.todo || !a.equipos.length) return deLugar
  if (deLugar && a.equipos.includes(deLugar)) return deLugar
  return a.equipos[0]
}

/** Un correo nuevo desde la bandeja: el contacto por su dirección, el buzón conectado y el asunto. */
async function nuevoCorreo(req: Request, res: Response, body: z.infer<typeof nuevaSchema>, datos: Json[]) {
  const yo = req.userId!
  const alcance = await alcanceDe(req)
  // Elegido de la lista: solo un contacto que esta persona ve (el id solo no alcanza para traer uno de otro equipo).
  let contacto = body.contactoId ? await contactoVisible(req, body.contactoId) : null
  const correo = (contacto?.correo || txt(body.correo)).toLowerCase()
  if (!CORREO_VALIDO.test(correo)) throw new ValidationError(contacto ? 'Ese contacto no tiene correo: agrégaselo en su ficha.' : 'Escribe el correo completo de la persona, por ejemplo ana@gmail.com.')
  if (!contacto) {
    contacto = await prisma.crmContacto.findFirst({ where: { correo }, orderBy: { createdAt: 'asc' } })
      ?? await prisma.crmContacto.create({ data: { correo, nombre: txt(body.n) || null, canal: 'mail', asignadoId: yo, ficha: { origen: 'Correo' } } })
  }
  const reservadoCorreo = await reservaDeContacto(alcance, contacto.id)
  if (reservadoCorreo) throw new ForbiddenError(mensajeReservado(reservadoCorreo))
  const nc = motivoNoContactar(contacto.noContactar)
  if (datos.some(d => ['out', 'prog'].includes(tipoDe(d) ?? '')) && nc !== null) {
    throw new ValidationError(`${contacto.nombre || 'Este contacto'} pidió no ser contactado${nc ? ` (${nc})` : ''}. Si vuelve a escribir, respóndele desde su conversación; si ya lo autorizó, quita «No contactar» en su ficha.`)
  }
  const buzones = await prisma.crmConexion.findMany({ where: { tipo: 'correo', estado: { not: 'desconectada' } }, select: { id: true } })
  const cx = body.conexion ? buzones.find(b => b.id === body.conexion) : buzones.length === 1 ? buzones[0] : null
  if (!cx) throw new ValidationError(buzones.length ? 'Elige por cuál correo sale el mensaje.' : 'Todavía no hay un correo conectado: conéctalo en Ajustes del CRM, Canales.')
  const asunto = txt(body.asunto)
  let conv = await prisma.crmConversacion.findFirst({ where: { contactoId: contacto.id, canal: 'mail', conexionId: cx.id, estado: { not: 'finalizadas' } }, orderBy: { createdAt: 'desc' } })
  // Una conversación que no ve (de otro equipo, sin asignar o de otra persona) no se retoma: se la pasa un líder.
  if (conv) {
    if (conv.soloLider && !lideraConv(alcance, conv)) throw new ForbiddenError(`Ese contacto ya tiene una conversación reservada para los líderes de ${equipoDeConv(conv)}.`)
    if (!veConv(alcance, conv)) throw new ForbiddenError(`Ese contacto ya tiene una conversación abierta con ${equipoDeConv(conv)}. Pídele a un líder que te la pase.`)
    // Un asunto nuevo empieza un hilo nuevo en el correo de la persona.
    const extra = obj(conv.extra)
    conv = await prisma.crmConversacion.update({
      where: { id: conv.id },
      data: { ...(conv.asignadoId ? {} : { asignadoId: yo }), ...(asunto && asunto !== txt(extra.asunto) ? { extra: { ...extra, asunto, mailMid: null, mailRefs: [] } as Prisma.InputJsonValue } : {}) },
    })
  } else {
    const equipo = equipoParaNueva(alcance, await equipoDelLugar('mail', null))
    conv = await prisma.crmConversacion.create({
      data: { contactoId: contacto.id, canal: 'mail', conexionId: cx.id, asignadoId: yo, estado: 'abiertas', ultimoMensajeAt: new Date(), extra: { asunto: asunto || '' }, ...(equipo ? { equipo } : {}) },
    })
  }
  if (!contacto.asignadoId) await prisma.crmContacto.update({ where: { id: contacto.id }, data: { asignadoId: yo } })
  for (const d of datos) await guardarMensaje(conv.id, d, { autorId: yo })
  const salida = await cargarConv(conv.id)
  emitirCrm({ tipo: 'conv', conv: salida }, yo)
  return ApiResponse.created(res, salida)
}

export async function nuevaConversacion(req: Request, res: Response) {
  exigirEscritura(req)
  const body = nuevaSchema.parse(req.body)
  const yo = req.userId!
  // Lista blanca de lo que se manda (igual que POST /conversaciones/:id/mensajes).
  const datos = body.datos.map(validarDesdePantalla)
  if (body.canal === 'mail') return nuevoCorreo(req, res, body, datos)

  // 1. El contacto: el que se eligió (solo uno que esta persona ve: el id solo no alcanza para traer uno de otro
  //    equipo), o el del número (se crea si no existe).
  let contacto = body.contactoId ? await contactoVisible(req, body.contactoId) : null
  if (!contacto) {
    const tel = telefonoValido(body.tel)
    if (!tel) throw new ValidationError('Falta el número. Elige un contacto o escribe su WhatsApp con indicativo.')
    contacto = await prisma.crmContacto.findFirst({ where: { telefono: tel } })
    if (!contacto) {
      contacto = await prisma.crmContacto.create({ data: { telefono: tel, nombre: txt(body.n) || null, canal: body.canal, asignadoId: yo } })
        .catch(async e => {
          // Lo creó otra persona en el mismo instante: se usa ese.
          const otro = await prisma.crmContacto.findFirst({ where: { telefono: tel } })
          if (!otro) throw e
          return otro
        })
    }
  }
  // Un contacto con una conversación «solo líder» es de los líderes de ese equipo: nadie más le abre otra.
  const alcance = await alcanceDe(req)
  const reservado = await reservaDeContacto(alcance, contacto.id)
  if (reservado) throw new ForbiddenError(mensajeReservado(reservado))
  const saleAlgo = datos.some(d => ['out', 'prog'].includes(tipoDe(d) ?? ''))
  const nc = motivoNoContactar(contacto.noContactar)
  if (saleAlgo && nc !== null) {
    throw new ValidationError(`${contacto.nombre || 'Este contacto'} pidió no ser contactado${nc ? ` (${nc})` : ''}. Si vuelve a escribir, respóndele desde su conversación; si ya lo autorizó, quita «No contactar» en su ficha.`)
  }

  // 2. La línea: la elegida o, si solo hay una, esa.
  let lineaId: string | null = null
  if (body.linea) {
    const l = await prisma.crmLinea.findUnique({ where: { id: body.linea }, select: { id: true } })
    if (!l) throw new ValidationError('Esa línea de WhatsApp ya no existe. Elige otra de la lista.')
    lineaId = l.id
  } else if (body.canal === 'wa') {
    const todas = await prisma.crmLinea.findMany({ select: { id: true }, take: 2 })
    if (todas.length === 1) lineaId = todas[0].id
  }

  // 3. La conversación: si ya hay una abierta con ese contacto por ese canal y esa línea, se sigue ahí.
  //    Una conversación es de una línea (la ventana de 24 h de Meta es por número): la abierta en
  //    otra línea no se reutiliza ni se cambia de línea; una sin línea sí toma la pedida.
  let conv = await prisma.crmConversacion.findFirst({
    where: { contactoId: contacto.id, canal: body.canal, estado: { not: 'finalizadas' }, ...(lineaId ? { OR: [{ lineaId }, { lineaId: null }] } : {}) },
    orderBy: [{ lineaId: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
  })
  // Una conversación que no ve (de otro equipo, sin asignar o de otra persona) no se retoma: se la pasa un líder.
  if (conv) {
    if (conv.soloLider && !lideraConv(alcance, conv)) throw new ForbiddenError(`Ese contacto ya tiene una conversación reservada para los líderes de ${equipoDeConv(conv)}.`)
    if (!veConv(alcance, conv)) throw new ForbiddenError(`Ese contacto ya tiene una conversación abierta con ${equipoDeConv(conv)}. Pídele a un líder que te la pase.`)
    conv = await prisma.crmConversacion.update({
      where: { id: conv.id },
      data: { estado: 'abiertas', finalizadaAt: null, motivoFin: null, ...(lineaId && !conv.lineaId ? { lineaId } : {}), ...(conv.asignadoId ? {} : { asignadoId: yo }) },
    })
  } else {
    const equipo = equipoParaNueva(alcance, await equipoDelLugar(body.canal, lineaId))
    conv = await prisma.crmConversacion.create({
      data: { contactoId: contacto.id, canal: body.canal, lineaId, asignadoId: yo, estado: 'abiertas', ultimoMensajeAt: new Date(), ...(equipo ? { equipo } : {}) },
    })
  }
  if (!contacto.asignadoId) await prisma.crmContacto.update({ where: { id: contacto.id }, data: { asignadoId: yo } })

  // 4. Los mensajes, en orden; cada uno se emite y, si es de salida, se envía.
  for (const d of datos) await guardarMensaje(conv.id, d, { autorId: yo })
  const salida = await cargarConv(conv.id)
  emitirCrm({ tipo: 'conv', conv: salida }, yo)
  return ApiResponse.created(res, salida)
}

// ─── DELETE /conversaciones/:id ──────────────────────────────────────────────

export async function borrarConversacion(req: Request, res: Response) {
  exigirEscritura(req)
  const id = idNum(req.params.id)
  const c = await convVisible(req, id)
  const conDatos = req.query.datos === '1' || req.query.datos === 'true'
  if (conDatos) {
    // Solicitud de borrado de datos (Ley 1581): se va el contacto con todas sus conversaciones, así que solo
    // quien las ve todas (igual que al borrar el contacto).
    await exigirContactoCompleto(req, c.contactoId)
    const convs = await prisma.crmConversacion.findMany({ where: { contactoId: c.contactoId }, select: { id: true } })
    await prisma.crmContacto.delete({ where: { id: c.contactoId } })
    auditLog(req, 'DELETE', 'crm_contacto', String(c.contactoId), { motivo: 'borrado de datos pedido desde el CRM', conversaciones: convs.length })
    for (const x of convs) emitirCrm({ tipo: 'conv-borrada', id: x.id }, req.userId!)
    emitirCrm({ tipo: 'contacto-borrado', id: c.contactoId }, req.userId!)
    return ApiResponse.success(res, { id, contactoId: c.contactoId, datos: true })
  }
  await prisma.crmConversacion.delete({ where: { id } })
  auditLog(req, 'DELETE', 'crm_conversacion', String(id))
  emitirCrm({ tipo: 'conv-borrada', id }, req.userId!)
  // Si el contacto quedó sin conversaciones, pasa a la lista de contactos sueltos.
  await emitirContacto(c.contactoId, req.userId!)
  return ApiResponse.success(res, { id, contactoId: c.contactoId, datos: false })
}

// ─── POST /conversaciones/:id/unir ───────────────────────────────────────────

const unirSchema = z.object({ otraId: z.coerce.number().int().positive() })

const mezclar = (base: Json, otro: Json): Json => {
  const out: Json = { ...otro }
  for (const [k, v] of Object.entries(base)) if (v !== null && v !== undefined && v !== '') out[k] = v
  return out
}
const RANGO_ESTADO: Record<string, number> = { abiertas: 3, pendientes: 2, finalizadas: 1 }
const masTarde = (x: Date | null, y: Date | null) => (!x ? y : !y ? x : x > y ? x : y)

/**
 * `extra` del contacto que queda al unir dos (gana A, el que queda). La última encuesta (lote 6, días sin repetir por
 * persona) es la más reciente de las dos, y la reserva de una encuesta que está saliendo solo se conserva si es de A: la
 * de B apunta a un contacto que se borra.
 */
function extraUnido(extraB: Record<string, unknown>, extraA: Record<string, unknown>): Record<string, unknown> {
  const { _encuestaReserva: _rb, ...b } = extraB
  const out: Record<string, unknown> = { ...b, ...extraA }
  const fechas = [extraA._encuestaUltima, extraB._encuestaUltima].filter((v): v is string => typeof v === 'string' && Date.parse(v) > 0)
  if (fechas.length) out._encuestaUltima = fechas.reduce((x, y) => (Date.parse(y) > Date.parse(x) ? y : x))
  return out
}
const masTemprano = (x: Date | null, y: Date | null) => (!x ? y : !y ? x : x < y ? x : y)

// Qué no se puede unir. Cada número de WhatsApp es un contacto y cada línea, una conversación; lo mismo
// con las cuentas de Messenger, Instagram, Telegram y TikTok (cada una tiene su id por página o bot) y con
// cada cuenta conectada: si no, la unión se deshace sola con el próximo mensaje y las respuestas salen a una
// persona o por una línea equivocadas. La usan «Unir» y la ventana que elige con quién (GET …/unibles).
type ParaUnir = {
  contactoId: number; canal: string; lineaId: string | null; conexionId: string | null
  contacto: { telefono: string | null; fbId: string | null; igId: string | null; tgId: string | null; ttId: string | null; correo: string | null }
}
const REDES_UNIR = [['fbId', 'Messenger'], ['igId', 'Instagram'], ['tgId', 'Telegram'], ['ttId', 'TikTok']] as const
const CONEXION_UNIR: Record<string, { corto: string; largo: string }> = {
  fb: { corto: 'Otra página de Facebook', largo: 'Son conversaciones de dos páginas de Facebook distintas: no se pueden unir, porque cada página tiene su propia ventana de 24 horas. Responde cada una desde su página.' },
  ig: { corto: 'Otra cuenta de Instagram conectada', largo: 'Son conversaciones de dos cuentas de Instagram conectadas distintas: no se pueden unir, porque cada cuenta tiene su propia ventana de 24 horas. Responde cada una desde su cuenta.' },
  tg: { corto: 'Otro bot de Telegram', largo: 'Son conversaciones de dos bots de Telegram distintos: no se pueden unir, porque las respuestas saldrían por uno solo. Responde cada una desde su bot.' },
  tt: { corto: 'Otra cuenta de TikTok conectada', largo: 'Son conversaciones de dos cuentas de TikTok conectadas distintas: no se pueden unir, porque las respuestas saldrían por una sola. Responde cada una desde su cuenta.' },
  mail: { corto: 'Otro buzón de correo', largo: 'Son conversaciones de dos buzones de correo distintos: no se pueden unir, porque las respuestas saldrían por uno solo. Responde cada una desde su buzón.' },
}
export function motivoNoUnir(a: ParaUnir, b: ParaUnir): { corto: string; largo: string } | null {
  const dos = a.contactoId !== b.contactoId
  if (dos && a.contacto.telefono && b.contacto.telefono && a.contacto.telefono !== b.contacto.telefono) {
    return { corto: 'Otro número de WhatsApp', largo: `Son dos números de WhatsApp distintos (${telVisible(a.contacto.telefono)} y ${telVisible(b.contacto.telefono)}): no se pueden unir, porque las respuestas le llegarían a un solo número. Deja cada número en su contacto.` }
  }
  if (a.lineaId && b.lineaId && a.lineaId !== b.lineaId) {
    return { corto: 'Otra línea de WhatsApp', largo: 'Son conversaciones de dos líneas de WhatsApp distintas: no se pueden unir, porque cada línea tiene su propia ventana de 24 horas. Responde cada una desde su línea.' }
  }
  for (const [campo, red] of REDES_UNIR) {
    if (dos && a.contacto[campo] && b.contacto[campo] && a.contacto[campo] !== b.contacto[campo]) {
      return { corto: `Otra cuenta de ${red}`, largo: `Son dos cuentas de ${red} distintas: no se pueden unir, porque las respuestas le llegarían a una sola. Deja cada cuenta en su contacto.` }
    }
  }
  if (a.conexionId && b.conexionId && a.conexionId !== b.conexionId) {
    return CONEXION_UNIR[a.canal === b.canal ? a.canal : ''] ?? { corto: 'Otra cuenta conectada', largo: 'Son conversaciones de dos cuentas conectadas distintas: no se pueden unir, porque las respuestas saldrían por una sola. Responde cada una desde donde llegó.' }
  }
  // Dos conversaciones de correo con direcciones distintas son como dos números: la respuesta iría a una sola.
  const correo = (x: ParaUnir) => (x.contacto.correo || '').trim().toLowerCase()
  if (dos && a.canal === 'mail' && b.canal === 'mail' && correo(a) && correo(b) && correo(a) !== correo(b)) {
    return { corto: 'Otro correo', largo: `Son dos correos distintos (${a.contacto.correo} y ${b.contacto.correo}): no se pueden unir, porque las respuestas le llegarían a uno solo. Deja cada correo en su contacto.` }
  }
  return null
}

// ─── GET /conversaciones/:id/unibles?ids=1,2,3 ── de esas, cuáles no se pueden unir con esta y por qué ──
export async function unibles(req: Request, res: Response) {
  const id = idNum(req.params.id)
  const ids = [...new Set(String(req.query.ids ?? '').split(',').map(Number).filter(n => Number.isInteger(n) && n > 0 && n !== id))].slice(0, 2000)
  const a = await convVisible(req, id)
  const alcance = await alcanceDe(req)
  // Solo las que ve: de las ajenas no se dice nada (ni siquiera por qué no se unirían).
  const otras = ids.length ? await prisma.crmConversacion.findMany({ where: { AND: [{ id: { in: ids } }, filtroConvs(alcance)] }, include: { contacto: true } }) : []
  // Unir mueve todas las conversaciones del contacto: con una reservada para los líderes de un equipo que no lidera, no.
  const reservados = alcance.todo || !otras.length ? new Set<number>() : new Set((await prisma.crmConversacion.findMany({
    where: { contactoId: { in: [a.contactoId, ...otras.map(o => o.contactoId)] }, soloLider: true, ...fueraDeLidera(alcance) }, select: { contactoId: true },
  })).map(x => x.contactoId))
  const motivos: Record<number, string> = {}
  for (const b of otras) {
    if (reservados.has(a.contactoId) || reservados.has(b.contactoId)) { motivos[b.id] = 'Reservado para los líderes'; continue }
    const m = motivoNoUnir(a, b)
    if (m) motivos[b.id] = m.corto
  }
  return ApiResponse.success(res, { motivos })
}

export async function unirConversaciones(req: Request, res: Response) {
  exigirEscritura(req)
  const id = idNum(req.params.id)
  const { otraId } = unirSchema.parse(req.body)
  if (otraId === id) throw new ValidationError('No se puede unir una conversación consigo misma. Elige la otra conversación del contacto.')
  const alcance = await alcanceDe(req)
  const [a0, b0] = await Promise.all([convVisible(req, id), convVisible(req, otraId)])
  // Unir mueve todas las conversaciones del contacto: con una reservada para los líderes de un equipo que no lidera, no.
  for (const k of new Set([a0.contactoId, b0.contactoId])) {
    const reservado = await reservaDeContacto(alcance, k)
    if (reservado) throw new ForbiddenError(mensajeReservado(reservado))
  }
  const motivo = motivoNoUnir(a0, b0)
  if (motivo) throw new ConflictError(motivo.largo)

  const nombreOtra = b0.contacto.nombre || telVisible(b0.contacto.telefono) || b0.contacto.correo || 'otro contacto'

  await prisma.$transaction(async tx => {
    // Las dos conversaciones (y sus contactos) quedan bloqueadas mientras se unen: un mensaje que
    // entra a la otra espera y no queda colgado de una conversación borrada a mitad de camino.
    await tx.$queryRaw`SELECT id FROM crm_conversaciones WHERE id IN (${id}, ${otraId}) ORDER BY id FOR UPDATE`
    const [a, b] = await Promise.all([
      tx.crmConversacion.findUnique({ where: { id } }),
      tx.crmConversacion.findUnique({ where: { id: otraId } }),
    ])
    if (!a || !b) throw new NotFoundError('Una de las dos conversaciones ya no existe. Recarga la bandeja.')
    // Con las filas bloqueadas: alguien pudo quitársela o pasarla a otro equipo mientras tanto.
    exigirVerConv(alcance, a)
    exigirVerConv(alcance, b)
    const dosContactos = a.contactoId !== b.contactoId
    if (dosContactos) {
      const ids = [a.contactoId, b.contactoId].sort((x, y) => x - y)
      await tx.$queryRaw`SELECT id FROM crm_contactos WHERE id IN (${ids[0]}, ${ids[1]}) ORDER BY id FOR UPDATE`
    }

    // 1. La unida queda con lo más vivo de las dos: el estado más activo, la espera más antigua,
    //    «solo líder» si cualquiera lo era, y los datos de la principal completados con los de la otra.
    const estado = (RANGO_ESTADO[a.estado] ?? 0) >= (RANGO_ESTADO[b.estado] ?? 0) ? a.estado : b.estado
    const finalizada = estado === 'finalizadas'
    await tx.crmConversacion.update({
      where: { id: a.id },
      data: {
        estado,
        finalizadaAt: finalizada ? masTarde(a.finalizadaAt, b.finalizadaAt) : null,
        motivoFin: finalizada ? (a.motivoFin ?? b.motivoFin) : null,
        soloLider: a.soloLider || b.soloLider,
        prioridad: a.prioridad ?? b.prioridad,
        equipo: a.equipo ?? b.equipo,
        encuestada: a.encuestada || b.encuestada,
        ultimoMensajeAt: masTarde(a.ultimoMensajeAt, b.ultimoMensajeAt),
        ultimoEntranteAt: masTarde(a.ultimoEntranteAt, b.ultimoEntranteAt),
        noLeidos: a.noLeidos + b.noLeidos,
        esperaDesde: finalizada ? null : masTemprano(a.esperaDesde, b.esperaDesde),
        asignadoId: a.asignadoId ?? b.asignadoId,
        lineaId: a.lineaId ?? b.lineaId,
        recs: [...(Array.isArray(a.recs) ? a.recs : []), ...(Array.isArray(b.recs) ? b.recs : [])] as Prisma.InputJsonValue,
        extra: mezclaProfunda(b.extra, a.extra, false) as Prisma.InputJsonValue,
      },
    })
    // 2. Los mensajes de la otra pasan a esta, justo antes de borrarla (con el candado puesto).
    await tx.crmMensaje.updateMany({ where: { conversacionId: b.id }, data: { conversacionId: a.id } })
    await tx.crmConversacion.delete({ where: { id: b.id } })

    // 3. Si eran dos contactos distintos, todo queda en uno solo (con las filas leídas bajo el candado).
    if (dosContactos) {
      const [ka, kb] = await Promise.all([
        tx.crmContacto.findUnique({ where: { id: a.contactoId } }),
        tx.crmContacto.findUnique({ where: { id: b.contactoId } }),
      ])
      if (!ka || !kb) throw new NotFoundError('Uno de los dos contactos ya no existe. Recarga la bandeja.')
      await tx.crmConversacion.updateMany({ where: { contactoId: kb.id }, data: { contactoId: ka.id } })
      const extraA = obj(ka.extra)
      const otrosCanales = [...new Set([...(Array.isArray(extraA.otrosCanales) ? extraA.otrosCanales.map(String) : []), `${kb.canal}: ${telVisible(kb.telefono) || kb.correo || kb.nombre || kb.id}`])]
      await tx.crmContacto.delete({ where: { id: kb.id } })
      await tx.crmContacto.update({
        where: { id: ka.id },
        data: {
          nombre: ka.nombre || kb.nombre,
          telefono: ka.telefono || kb.telefono,
          fbId: ka.fbId || kb.fbId,
          igId: ka.igId || kb.igId,
          correo: ka.correo || kb.correo,
          etapa: ka.etapa || kb.etapa,
          asignadoId: ka.asignadoId || kb.asignadoId,
          externoId: ka.externoId || kb.externoId,
          tags: [...new Set([...ka.tags, ...kb.tags])],
          campos: mezclar(obj(ka.campos), obj(kb.campos)) as Prisma.InputJsonValue,
          ficha: mezclar(obj(ka.ficha), obj(kb.ficha)) as Prisma.InputJsonValue,
          pauta: (ka.pauta ?? kb.pauta ?? undefined) as Prisma.InputJsonValue | undefined,
          menor: ka.menor || kb.menor,
          guardado: ka.guardado || kb.guardado,
          autorizacion: (ka.autorizacion ?? kb.autorizacion ?? undefined) as Prisma.InputJsonValue | undefined,
          representante: (ka.representante ?? kb.representante ?? undefined) as Prisma.InputJsonValue | undefined,
          rne: (ka.rne ?? kb.rne ?? undefined) as Prisma.InputJsonValue | undefined,
          noContactar: (ka.noContactar ?? kb.noContactar ?? undefined) as Prisma.InputJsonValue | undefined,
          permisoLlamada: (ka.permisoLlamada ?? kb.permisoLlamada ?? undefined) as Prisma.InputJsonValue | undefined,
          extra: { ...extraUnido(obj(kb.extra), extraA), otrosCanales } as Prisma.InputJsonValue,
        },
      })
    }
  }, { timeout: 20_000 })

  emitirCrm({ tipo: 'conv-borrada', id: otraId }, req.userId!)
  // El evento «merge» queda en el chat y emite la conversación ya unida.
  await guardarMensaje(id, { ev: 'merge', t: `Se unió con ${nombreOtra}` }, { autorId: req.userId! })
  // Quien ya tenía esta conversación abierta no tiene los mensajes que llegaron de la otra:
  // `_recargar` le pide a la pantalla volver a pedir GET …/mensajes.
  const unida = await cargarConv(id)
  if (unida) emitirCrm({ tipo: 'conv', conv: { ...unida, _recargar: true } }, req.userId!)
  // Si eran dos contactos, sus demás conversaciones (las de los dos) cambiaron de datos de contacto.
  if (a0.contactoId !== b0.contactoId) {
    const otras = await prisma.crmConversacion.findMany({ where: { contactoId: a0.contactoId, id: { not: id }, ...convVigente() }, select: { id: true } })
    for (const x of otras) await emitirConv(x.id, req.userId!)
    emitirCrm({ tipo: 'contacto-borrado', id: b0.contactoId }, req.userId!)
  }
  return ApiResponse.success(res, unida ?? await cargarConv(id))
}

/** POST /crm/conversaciones/:id/mensajes/:msgId/transcripcion: la transcripción de una nota de voz, a pedido. */
export async function transcribirNota(req: Request, res: Response) {
  const convId = idNum(req.params.id)
  await convVisible(req, convId)
  const m = await prisma.crmMensaje.findFirst({ where: { id: String(req.params.msgId), conversacionId: convId } })
  if (!m || !esAudioIn(m.datos)) throw new NotFoundError('Esa nota de voz ya no está en la conversación.')
  try {
    return ApiResponse.success(res, { trans: await transcribirMensaje(m) })
  } catch (e) {
    throw new ValidationError(`No se pudo transcribir: ${(e as Error).message}`)
  }
}
