import type { Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma, prismaGlobal, llaveAjuste, llavePreferencia } from '../../services/crm/bd'
import { espacioActual, usuariosDeEspacio } from '../../services/crm/espacio'
import { ApiResponse } from '../../utils/response'
import { AppError, ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors'
import { listarSinRespuesta, quitarSinRespuesta } from '../../services/crm/mejorar'
import { logger } from '../../utils/logger'
import { guardarAjuste, leerPreferencias } from '../../services/crm/ajustes'
import { emitirAlcance, emitirConv, emitirCrm, olvidarGenteCrm } from '../../services/crm/tiempoReal'
import { usuariosCrm } from '../../services/crm/usuarios'
import { leerWeb, extraerTexto, TIPOS_DOC, EXT_DOC, MENSAJE_TIPOS } from '../../services/crm/kb'
import { probarAgente } from '../../services/crm/agentes'
import { alcanceDe, alcanceDePersona, alcanceParaFront, entraPorRol, sincronizarMiembros, type Alcance } from '../../services/crm/alcance'
import { normalizarEquipos, type EquiposNorm } from '../../services/crm/equipos'
import { conectarShopify, conectarCalendario, conectarHotmart, desconectar, estadoIntegraciones } from '../../services/crm/integraciones'
import { invitarNuevos } from '../../services/crm/invitaciones'
import { limiteUsuarios } from '../../services/crm/plan'
import { cuentaDe, usuariosDeCuenta } from '../../services/crm/espacio'
import { cifrarClave } from '../../routes/auth'
import crypto from 'node:crypto'
import { conectarMotor, conOpciones, desconectarMotor, estadoMotor, motorIA, usarMotor } from '../../services/crm/motorIA'
import { convVigente, esLider, exigirAdminEquipos, exigirEscritura, exigirLider, nombreArchivo, obj, subirACloudinary, tamanoLegible } from './_comun'

/**
 * Ajustes del equipo, preferencias de cada persona, archivos adjuntos, base de
 * conocimiento y chat de prueba de los agentes.
 */

/** Claves de la maqueta (contrato §4, «Claves de ajustes»). */
export const CLAVES_AJUSTE = new Set([
  'etapas', 'etiquetas', 'respuestas', 'campos', 'reglas', 'flujos', 'cfg', 'cvcfg', 'pd', 'llam', 'llcfg',
  'cn', 'equipos', 'agentes', 'ag', 'kb', 'difusiones', 'segmentos',
  // Carpetas de la barra: las del CRM escondidas y las propias con sus condiciones (6-oct).
  'carpetas',
  // Archivos del equipo para «Enviar material» (Ajustes > Archivos).
  'material',
])
/** Lo único que una asesora cambia del equipo: las etiquetas que crea y sus segmentos guardados. */
const DE_ASESORAS = new Set(['etiquetas', 'segmentos'])
const MAX_AJUSTE = 8 * 1024 * 1024
/** Lo que puede pesar un ajuste que también cambian las asesoras. */
const MAX_AJUSTE_ASESORAS = 100 * 1024

// ─── Forma de los ajustes que se pintan en la pantalla ───────────────────────
//
// Nombres y colores de etiquetas y etapas, y los segmentos, se pintan en la
// bandeja de todo el equipo: se guarda solo la forma esperada (colores
// #rrggbb, textos con tope, sin caracteres de control). Lo que sobre se descarta.

const COLOR = /^#[0-9a-f]{6}$/i
const sinControl = (t: string) => !/[\u0000-\u001f\u007f]/.test(t)

const texto = (que: string, max: number) => z.string({ invalid_type_error: `${que} debe ser un texto`, required_error: `falta ${que.toLowerCase()}` })
  .trim()
  .min(1, `${que} no puede quedar vacío`)
  .max(max, `${que} puede tener máximo ${max} caracteres`)
  .refine(sinControl, `${que} tiene caracteres que no se pueden guardar`)

const nombreYColor = (que: string) => z.tuple([
  texto(`El nombre de la ${que}`, 60),
  z.string({ invalid_type_error: `El color de la ${que} debe ser un color como #2563eb` }).regex(COLOR, `El color de la ${que} debe ser un color como #2563eb`),
], { invalid_type_error: `Cada ${que} va como [nombre, color]` })

const FORMAS: Record<string, { schema: z.ZodTypeAny; elemento: string }> = {
  etiquetas: {
    elemento: 'etiqueta',
    // Desde el 28-sep cada etiqueta puede ser de un equipo: [nombre, color, equipo]; sin equipo es para todos.
    schema: z.array(z.union([nombreYColor('etiqueta'), z.tuple([
      texto('El nombre de la etiqueta', 60),
      z.string({ invalid_type_error: 'El color de la etiqueta debe ser un color como #2563eb' }).regex(COLOR, 'El color de la etiqueta debe ser un color como #2563eb'),
      texto('El equipo de la etiqueta', 60),
    ])], { invalid_type_error: 'Cada etiqueta va como [nombre, color] o [nombre, color, equipo]' }), { invalid_type_error: '«etiquetas» debe ser una lista de [nombre, color, equipo]' }).max(200, 'Caben máximo 200 etiquetas'),
  },
  etapas: {
    elemento: 'etapa',
    // Desde el 28-sep cada etapa es de un equipo: [nombre, color, equipo]; sin equipo es de Ventas.
    schema: z.array(z.union([nombreYColor('etapa'), z.tuple([
      texto('El nombre de la etapa', 60),
      z.string({ invalid_type_error: 'El color de la etapa debe ser un color como #2563eb' }).regex(COLOR, 'El color de la etapa debe ser un color como #2563eb'),
      texto('El equipo de la etapa', 60),
    ])], { invalid_type_error: 'Cada etapa va como [nombre, color] o [nombre, color, equipo]' }), { invalid_type_error: '«etapas» debe ser una lista de [nombre, color, equipo]' }).max(200, 'Caben máximo 200 etapas'),
  },
  segmentos: {
    elemento: 'segmento',
    schema: z.array(z.object({
      id: z.string({ invalid_type_error: 'El identificador del segmento no es válido' }).regex(/^[\w-]{1,40}$/, 'El identificador del segmento no es válido'),
      n: texto('El nombre del segmento', 80),
      filtros: z.record(
        z.string().regex(/^[a-z]{1,20}$/i, 'Un filtro del segmento no es válido'),
        z.string({ invalid_type_error: 'Un filtro del segmento debe ser un texto' }).max(200, 'Un filtro del segmento puede tener máximo 200 caracteres').refine(sinControl, 'Un filtro del segmento tiene caracteres que no se pueden guardar').nullable(),
      ).refine(f => Object.keys(f).length <= 20, 'Un segmento puede tener máximo 20 filtros').optional().default({}),
      q: z.string({ invalid_type_error: 'La búsqueda del segmento debe ser un texto' }).max(200, 'La búsqueda del segmento puede tener máximo 200 caracteres').refine(sinControl, 'La búsqueda del segmento tiene caracteres que no se pueden guardar').optional().default(''),
    }, { invalid_type_error: 'Cada segmento va como {id, n, filtros, q}' }), { invalid_type_error: '«segmentos» debe ser una lista' }).max(100, 'Caben máximo 100 segmentos guardados'),
  },
  equipos: {
    elemento: 'equipo',
    schema: z.object({
      miembros: z.record(
        texto('El nombre del equipo', 80),
        z.array(texto('El nombre de cada integrante', 200), { invalid_type_error: 'Los integrantes de cada equipo van en una lista de nombres' }).max(300, 'Un equipo puede tener máximo 300 integrantes'),
        { invalid_type_error: '«miembros» debe tener los integrantes de cada equipo', required_error: 'falta «miembros» con los integrantes de cada equipo' },
      ),
    }, { invalid_type_error: '«equipos» debe ser {miembros: {equipo: [nombres]}}' }).passthrough(),
  },
}

/** Mensajes de zod que no traen uno propio, en español. */
const errorEs: z.ZodErrorMap = issue => {
  if (issue.code === 'invalid_type') return { message: issue.received === 'undefined' ? 'falta un dato' : 'un dato no tiene el tipo esperado' }
  if (issue.code === 'too_big') return { message: `hay un dato más largo de lo permitido (máximo ${issue.maximum})` }
  if (issue.code === 'too_small') return { message: 'hay un dato vacío o más corto de lo permitido' }
  if (issue.code === 'invalid_string') return { message: 'hay un texto con un formato que no es válido' }
  return { message: 'no tiene la forma esperada' }
}

function conForma(clave: string, valor: unknown): unknown {
  const f = FORMAS[clave]
  // null = volver a lo de fábrica (la pantalla usa sus valores por defecto).
  if (!f || valor === null) return valor
  const r = f.schema.safeParse(valor, { errorMap: errorEs })
  if (r.success) return r.data
  const i = r.error.issues[0]
  const donde = typeof i.path[0] === 'number' ? ` (${f.elemento} ${i.path[0] + 1})` : ''
  throw new ValidationError(`No se guardó «${clave}»: ${i.message.charAt(0).toLowerCase()}${i.message.slice(1)}${donde}.`)
}

/**
 * Equipos por id (además de por nombre, que es lo que pinta la pantalla):
 * `ids: {equipo: [userIds]}`. Si alguien cambia su nombre, el reparto y la
 * pantalla lo siguen encontrando. También se guarda `porNombre: {nombre: id}`
 * con cada nombre resuelto: si una pantalla abierta desde antes del cambio
 * trae el nombre viejo, se usa el id que ese nombre tenía, si esa persona
 * sigue activa. Un nombre que no es de nadie activo no entra en `ids`.
 *
 * Desde el 28-sep (Equipos y reparto nuevo) la pantalla manda los ids de cada equipo, y un equipo puede
 * sumar a cualquier persona de la plataforma: quien no es de Ventas queda como miembro del espacio y entra
 * al CRM solo para sus equipos (alcance.ts). Además viajan `colores`, `metodos` (turnos, menos, lider),
 * `transferibles` y `topes` por persona. Los equipos sin ids (pantallas viejas) van por nombre.
 *
 * Desde el 29-sep (roles dentro de los equipos) viajan también `lideres`, `roles` y `subequipos`, y lo guardado
 * queda normalizado (equipos.ts: valores iniciales, 'todos' pasa a 'turnos', subequipos solo con gente del
 * equipo). Un PUT sin esas claves (una pantalla abierta desde antes de subir) conserva lo guardado. Quién guarda:
 * - El administrador sin equipo: todo, como siempre (crear, renombrar y borrar equipos, transferencias).
 * - El líder de un equipo: solo los equipos que lidera (personas, líderes, rol, subequipos, forma de repartir,
 *   color y el máximo de su gente). Lo de los otros equipos y las transferencias se toma de lo guardado, sin
 *   error (así una pantalla con datos viejos no pisa otro equipo). Crear, renombrar o borrar equipos: 403.
 */
interface GuardadoEquipos { valor: EquiposNorm; antes: EquiposNorm; quitados: string[] }

/** Lo que manda un líder, equipo por equipo: de los que lidera, lo pedido; del resto, lo guardado. */
function mezclarDeLider(valor: Record<string, unknown>, antes: EquiposNorm, a: Alcance): Record<string, unknown> {
  const equipos = Object.keys(antes.miembros)
  const pedidos = Object.keys(obj(valor.miembros))
  if (pedidos.length !== equipos.length || pedidos.some(eq => !equipos.includes(eq))) {
    throw new ForbiddenError('Solo un administrador sin equipo crea, renombra o borra equipos.')
  }
  const de = (k: string) => obj(valor[k])
  // Sin la clave (o sin el equipo dentro de ella): lo guardado.
  const pedidoO = <T>(k: 'lideres' | 'roles' | 'subequipos', eq: string, guardado: T) => (de(k)[eq] !== undefined && de(k)[eq] !== null ? de(k)[eq] : guardado)
  // Un subequipo nuevo que llega con el id de uno de otro equipo recibe uno nuevo (el de allá conserva el suyo).
  const ajenos = new Set(equipos.filter(eq => !a.lidera.includes(eq)).flatMap(eq => antes.subequipos[eq].map(x => x.id)))
  const out = {
    miembros: {} as Record<string, unknown>, ids: {} as Record<string, unknown>, lideres: {} as Record<string, unknown>, roles: {} as Record<string, unknown>,
    subequipos: {} as Record<string, unknown>, metodos: {} as Record<string, unknown>, colores: {} as Record<string, unknown>,
    transferibles: { ...antes.transferibles }, porNombre: antes.porNombre,
  }
  for (const eq of equipos) {
    if (a.lidera.includes(eq)) {
      out.miembros[eq] = de('miembros')[eq]
      if (Array.isArray(de('ids')[eq])) out.ids[eq] = de('ids')[eq]
      out.lideres[eq] = pedidoO('lideres', eq, antes.lideres[eq])
      out.roles[eq] = pedidoO('roles', eq, antes.roles[eq])
      const subs = pedidoO('subequipos', eq, antes.subequipos[eq])
      out.subequipos[eq] = Array.isArray(subs) ? subs.map(x => (ajenos.has(String(obj(x).id)) ? { ...obj(x), id: undefined } : x)) : []
      if (de('metodos')[eq] !== undefined) out.metodos[eq] = de('metodos')[eq]
      if (de('colores')[eq] !== undefined) out.colores[eq] = de('colores')[eq]
    } else {
      out.miembros[eq] = antes.miembros[eq]
      out.ids[eq] = antes.ids[eq]
      out.lideres[eq] = antes.lideres[eq]
      out.roles[eq] = antes.roles[eq]
      out.subequipos[eq] = antes.subequipos[eq]
      if (eq in antes.metodos) out.metodos[eq] = antes.metodos[eq]
      if (eq in antes.colores) out.colores[eq] = antes.colores[eq]
    }
  }
  return out
}

async function equiposConIds(valorPedido: Record<string, unknown>, previo: unknown, a: Alcance): Promise<GuardadoEquipos> {
  const usuarios0 = await usuariosCrm(true)
  const antes = normalizarEquipos(previo, usuarios0)
  // Sin lideres, roles o subequipos (pantalla de antes de subir), o sin un equipo dentro de ellos: lo guardado de ese
  // equipo (un equipo nuevo, sin nada guardado, toma los valores iniciales).
  const conservar = (k: 'lideres' | 'roles' | 'subequipos') => {
    const pedido = obj(valorPedido[k]), guardado = obj(obj(previo)[k])
    return Object.fromEntries(Object.keys(obj(valorPedido.miembros)).map(eq => [eq, pedido[eq] !== undefined && pedido[eq] !== null ? pedido[eq] : guardado[eq]]))
  }
  const valor = a.todo
    ? { ...valorPedido, lideres: conservar('lideres'), roles: conservar('roles'), subequipos: conservar('subequipos') }
    : mezclarDeLider(valorPedido, antes, a)
  const miembros = obj(valor.miembros) as Record<string, string[]>
  const pedidos = obj(valor.ids)
  // Los colaboradores no pueden entrar al CRM por nada: el API los frena (middleware/auth.ts).
  const idsPedidos = [...new Set(Object.values(pedidos).flatMap(v => (Array.isArray(v) ? v.map(String) : [])))].slice(0, 3000)
  const validos = new Set(idsPedidos.length ? (await prismaGlobal.user.findMany({ where: { id: { in: idsPedidos }, suspendido: false }, select: { id: true } })).map(u => u.id) : [])
  const ids: Record<string, string[]> = {}
  const porNombreDe: Record<string, string[]> = {}
  for (const eq of Object.keys(miembros)) {
    if (Array.isArray(pedidos[eq])) ids[eq] = [...new Set((pedidos[eq] as unknown[]).map(String).filter(id => validos.has(id)))]
    else porNombreDe[eq] = Array.isArray(miembros[eq]) ? miembros[eq] : []
  }
  if (Object.keys(porNombreDe).length) {
    const usuarios = await usuariosCrm(true)
    const actual = new Map(usuarios.map(u => [u.nombre.toLowerCase(), u.id]))
    const activos = new Set(usuarios.map(u => u.id))
    const antesPorNombre = new Map(Object.entries(obj(obj(previo).porNombre)).map(([n, id]) => [n.toLowerCase(), String(id)]))
    for (const [eq, nombres] of Object.entries(porNombreDe)) {
      const lista: string[] = []
      for (const n of nombres) {
        const k = String(n).trim().toLowerCase()
        const deAntes = antesPorNombre.get(k)
        const id = actual.get(k) ?? (deAntes && activos.has(deAntes) ? deAntes : null)
        if (id && !lista.includes(id)) lista.push(id)
      }
      ids[eq] = lista
    }
  }
  if (!a.todo) {
    // Un líder no mete en su equipo a un administrador que no estaba: lo dejaría sin ver el resto del CRM y sin
    // poder administrarlo. Eso lo decide un administrador sin equipo.
    const nuevos = [...new Set(a.lidera.flatMap(eq => (ids[eq] ?? []).filter(id => !(antes.ids[eq] ?? []).includes(id))))]
    if (nuevos.length && await prismaGlobal.user.count({ where: { id: { in: nuevos }, role: { in: ['ADMIN', 'LECTOR'] } } })) {
      throw new ForbiddenError('Solo un administrador sin equipo puede agregar a un administrador a un equipo.')
    }
    // Ni lo saca (30-sep): sin equipo, un administrador ve y administra todo el CRM, así que sacarlo (o sacarse a sí
    // mismo, como Orlando de Moderación) le daría más alcance, no menos. Eso también lo decide un administrador sin equipo.
    const salen = [...new Set(a.lidera.flatMap(eq => (antes.ids[eq] ?? []).filter(id => !(ids[eq] ?? []).includes(id))))]
    if (salen.length && await prismaGlobal.user.count({ where: { id: { in: salen }, suspendido: false, role: { in: ['ADMIN', 'LECTOR'] } } })) {
      throw new ForbiddenError('Solo un administrador sin equipo puede sacar a un administrador de un equipo.')
    }
    // El máximo por persona: del pedido para la gente que queda en los equipos que lidera; el resto, lo guardado.
    const suyos = new Set(a.lidera.flatMap(eq => ids[eq] ?? []))
    const topes: Record<string, unknown> = {}
    for (const [id, t] of Object.entries(antes.topes)) if (!suyos.has(id)) topes[id] = t
    for (const [id, t] of Object.entries(obj(valorPedido.topes))) if (suyos.has(id)) topes[id] = t
    valor.topes = topes
  }
  // Roles y subequipos con forma inválida o nombres repetidos: 400 antes de cambiar nada.
  normalizarEquipos({ ...valor, ids }, usuarios0, { estricto: true })
  // Quien entra por un equipo queda como miembro del espacio (o deja de serlo) antes de ponerle nombre:
  // así aparece en la lista de personas del CRM con el mismo nombre que ven todos.
  const { quitados } = await sincronizarMiembros(ids)
  olvidarGenteCrm()
  const usuarios = await usuariosCrm(true)
  const nombre = new Map(usuarios.map(u => [u.id, u.nombre]))
  const miembrosOut: Record<string, string[]> = {}
  const porNombre: Record<string, string> = {}
  for (const [eq, lista] of Object.entries(ids)) {
    ids[eq] = lista.filter(id => nombre.has(id))
    miembrosOut[eq] = ids[eq].map(id => nombre.get(id)!)
    for (const id of ids[eq]) porNombre[nombre.get(id)!] = id
  }
  return { valor: normalizarEquipos({ ...valor, miembros: miembrosOut, ids, porNombre }, usuarios), antes, quitados }
}

/**
 * Después de guardar los equipos: a quien le cambió el alcance (administrador sin equipo, lo que lidera o integra,
 * o los equipos que administra) le llega `{tipo:'alcance', alcance}` y su pantalla se vuelve a cargar; a quien
 * perdió el acceso al CRM, `alcance: null`. Va en la cola del tiempo real, después del evento `ajuste`.
 */
async function avisarAlcances(antes: EquiposNorm, despues: EquiposNorm, quitados: string[], por: string) {
  try {
    const gente = new Set(await usuariosDeEspacio(espacioActual()))
    const personas = [...new Set([...gente, ...quitados])]
    if (!personas.length) return
    const filas = await prismaGlobal.user.findMany({ where: { id: { in: personas } }, select: { id: true, role: true } })
    const igual = (x: string[], y: string[]) => x.length === y.length && x.every((e, i) => e === y[i])
    for (const u of filas) {
      if (!gente.has(u.id)) { emitirAlcance(u.id, null, por); continue }
      const a0 = alcanceDePersona(u.id, u.role, antes), a1 = alcanceDePersona(u.id, u.role, despues)
      const f0 = alcanceParaFront(a0, antes), f1 = alcanceParaFront(a1, despues)
      if (a0.todo !== a1.todo || !igual(a0.lidera, a1.lidera) || !igual(a0.integra, a1.integra) || !igual(f0.administra, f1.administra)) emitirAlcance(u.id, f1, por)
    }
  } catch (e) {
    logger.warn(`[CRM equipos] no se pudo avisar el alcance nuevo: ${(e as Error)?.message ?? e}`)
  }
}

/**
 * El administrador sin equipo le cambió el nombre a un equipo o lo borró (30-sep): sus conversaciones van con él, todas
 * (también las finalizadas que ya no viajan en /crm/inicio), en bloque y sin repartir, con su persona y su subequipo.
 * Las de un equipo que desaparece sin nombre nuevo pasan a Ventas («quedan sin equipo»), donde las ven su líder y el
 * reparto. La pantalla manda `renombres: {nombre guardado: nombre nuevo}` junto al ajuste; uno que no corresponde (el
 * viejo sigue, o el nuevo ya existía) no mueve nada. Las vigentes salen por el tiempo real, después del ajuste.
 */
async function moverConversaciones(antes: EquiposNorm, despues: EquiposNorm, pedidos: Record<string, unknown>, por: string) {
  try {
    const eran = Object.keys(antes.miembros), son = Object.keys(despues.miembros)
    const destino = new Map<string, string | null>()
    for (const [viejo, nuevo] of Object.entries(pedidos)) {
      if (typeof nuevo !== 'string' || !eran.includes(viejo) || son.includes(viejo) || !son.includes(nuevo) || eran.includes(nuevo)) continue
      if ([...destino.values()].includes(nuevo)) continue
      destino.set(viejo, nuevo)
    }
    // Sin equipo es Ventas (equipoDeConv); se escribe «Ventas» para que el reparto no mire la línea, que puede seguir
    // diciendo el equipo borrado. Un espacio sin Ventas las deja sin equipo.
    for (const eq of eran) if (!son.includes(eq) && !destino.has(eq)) destino.set(eq, son.includes('Ventas') ? 'Ventas' : null)
    const vigentes: number[] = []
    for (const [viejo, nuevo] of destino) {
      const filas = await prisma.crmConversacion.findMany({ where: { AND: [{ equipo: viejo }, convVigente()] }, select: { id: true } })
      await prisma.crmConversacion.updateMany({ where: { equipo: viejo }, data: { equipo: nuevo } })
      vigentes.push(...filas.map(f => f.id))
    }
    for (const id of vigentes) await emitirConv(id, por)
  } catch (e) {
    logger.warn(`[CRM equipos] no se pudieron pasar las conversaciones del equipo: ${(e as Error)?.message ?? e}`)
  }
}

// ─── Datos de una persona para editarla desde Equipos y reparto ──────────────

/**
 * GET /crm/personas/:id (configuración general, administradores sin equipo y líderes de equipo): nombre, correo y
 * teléfono de una persona del CRM, y si quien pregunta puede
 * cambiarlos. Se guardan con PATCH /auth/usuarios/:id/perfil, que ya decide los permisos: el administrador edita a
 * cualquiera; el líder de ventas, solo a asesores. El teléfono vive en la ficha de asesor o en la de marketing.
 */
export async function verPersona(req: Request, res: Response) {
  await exigirAdminEquipos(req, 'ver los datos de las personas')
  const id = String(req.params.id || '').slice(0, 40)
  const u = await prismaGlobal.user.findUnique({ where: { id }, select: { id: true, nombre: true, email: true, role: true, suspendido: true, telefono: true } })
  if (!u || u.suspendido) throw new NotFoundError('Esa persona ya no existe o está suspendida.')
  // Solo la gente del espacio.
  const enCrm = (await usuariosCrm()).some(x => x.id === id)
  if (!enCrm) throw new NotFoundError('Esa persona no se puede agregar al CRM.')
  const editable = req.userRole === 'ADMIN' || (req.userRole === 'LIDER' && u.role === 'AGENTE')
  return ApiResponse.success(res, {
    id: u.id, nombre: u.nombre ?? '', email: u.email, rol: u.role,
    telefono: u.telefono ?? '', conTelefono: true, editable, enCrm,
  })
}

// ─── Personas de la plataforma para agregar a un equipo ─────────────────────

const NOMBRE_ROL: Record<string, string> = { ADMIN: 'Administrador', LIDER: 'Líder', AGENTE: 'Agente', LECTOR: 'Solo lectura' }
const plano = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * GET /crm/personas?q= (configuración general, administradores sin equipo y líderes de equipo): a quién se puede
 * agregar a un equipo: la gente del espacio.
 */
export async function buscarPersonas(req: Request, res: Response) {
  await exigirAdminEquipos(req, 'agregar personas a los equipos')
  const q = String(req.query.q ?? '').trim().slice(0, 60)
  const espacio = espacioActual()
  const soloEspacio = (await prismaGlobal.crmMiembro.findMany({ where: { espacioId: espacio }, select: { userId: true } })).map(m => m.userId)
  const filas = await prismaGlobal.user.findMany({
    where: {
      suspendido: false,
      id: { in: soloEspacio },
      ...(q ? { OR: [{ nombre: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }] } : {}),
    },
    select: { id: true, nombre: true, email: true, role: true, image: true },
    orderBy: { nombre: 'asc' }, take: q ? 50 : 300,
  })
  const enCrm = new Set((await usuariosCrm()).map(u => u.id))
  return ApiResponse.success(res, filas.map(u => ({
    id: u.id, nombre: (u.nombre || u.email).trim(), email: u.email, foto: u.image, rol: u.role, rolNombre: NOMBRE_ROL[u.role] ?? u.role,
    cargo: null, enCrm: enCrm.has(u.id), porRol: entraPorRol(u.role),
  })))
}

/**
 * Invitar a alguien que todavía no está en el CRM (6-oct): crea su cuenta dentro de este espacio (o, si ya tiene cuenta
 * en otra empresa, la suma a esta) y devuelve la persona para elegirle equipos. El correo de invitación, con el enlace
 * para crear su contraseña, sale al guardarla en un equipo (invitaciones.ts). Entra como integrante (AGENTE).
 */
const invitarSchema = z.object({
  nombre: z.string().trim().min(2, 'Escribe el nombre completo').max(80),
  email: z.string().trim().toLowerCase().email('Ese correo no parece completo').max(200),
})
export async function invitarPersona(req: Request, res: Response) {
  exigirEscritura(req)
  await exigirAdminEquipos(req, 'invitar personas al CRM')
  const p = invitarSchema.safeParse(req.body, { errorMap: errorEs })
  if (!p.success) throw new ValidationError(p.error.issues[0].message)
  const { nombre, email } = p.data
  const espacio = espacioActual()
  const miembros = await prismaGlobal.crmMiembro.findMany({ where: { espacioId: espacio }, select: { userId: true } })
  const existe = await prismaGlobal.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true, nombre: true, email: true, role: true, image: true, suspendido: true } })
  if (existe && miembros.some(m => m.userId === existe.id)) throw new ValidationError('Esa persona ya está en el CRM: búscala por su nombre o su correo.')
  if (existe?.suspendido) throw new ValidationError('Esa cuenta está suspendida. Escríbenos para revisarla.')
  const tope = await limiteUsuarios(espacio)
  // El límite es de la cuenta: personas sumadas entre todos sus espacios de trabajo (alguien de otro espacio no suma).
  const enCuenta = await usuariosDeCuenta(await cuentaDe(espacio))
  if (!(existe && enCuenta.includes(existe.id)) && enCuenta.length >= tope) throw new ForbiddenError(`Tu plan incluye ${tope} usuarios y ya están en uso. Sube de plan en Ajustes, Plan y pagos, para agregar más.`)
  const u = existe ?? await prismaGlobal.user.create({
    // Sin contraseña que alguien conozca: la crea la persona con el enlace del correo.
    data: { nombre, email, role: 'AGENTE', passwordHash: await cifrarClave(crypto.randomBytes(32).toString('base64url')) },
    select: { id: true, nombre: true, email: true, role: true, image: true, suspendido: true },
  })
  await prismaGlobal.crmMiembro.create({ data: { espacioId: espacio, userId: u.id } })
  olvidarGenteCrm()
  await usuariosCrm(true)
  return ApiResponse.created(res, { id: u.id, nombre: (u.nombre || u.email).trim(), email: u.email, foto: u.image, rol: u.role, rolNombre: NOMBRE_ROL[u.role] ?? u.role, cargo: null, enCrm: true, porRol: entraPorRol(u.role), nueva: !existe })
}

// ─── Guardar un ajuste (con control de versión opcional) ─────────────────────

const ajusteSchema = z.object({
  valor: z.unknown(),
  /**
   * El `updatedAt` del ajuste que la pantalla tenía cuando empezó a cambiarlo
   * (null si nunca vio uno guardado). Si viene y otra persona guardó después,
   * no se pisa: 409 con lo último guardado.
   */
  base: z.string().datetime({ offset: true }).nullable().optional(),
})

type Escritura = { ok: true; updatedAt: Date } | { ok: false }

async function escribirAjuste(clave: string, valor: unknown, por: string, base: string | null | undefined): Promise<Escritura> {
  const json = (valor ?? Prisma.JsonNull) as Prisma.InputJsonValue
  if (base === undefined) return { ok: true, updatedAt: (await guardarAjuste(clave, valor ?? null, por)).updatedAt }
  if (base === null) {
    try {
      const f = await prisma.crmAjuste.create({ data: { clave, valor: json, actualizadoPorId: por } })
      return { ok: true, updatedAt: f.updatedAt }
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return { ok: false }
      throw e
    }
  }
  // Escritura condicional: solo si lo guardado sigue siendo lo que la pantalla vio.
  // En la misma transacción se lee la hora nueva (la fila queda bloqueada hasta el final).
  return prisma.$transaction(async tx => {
    const r = await tx.crmAjuste.updateMany({ where: { clave, updatedAt: new Date(base) }, data: { valor: json, actualizadoPorId: por } })
    if (!r.count) return { ok: false } as const
    const f = await tx.crmAjuste.findUnique({ where: llaveAjuste(clave), select: { updatedAt: true } })
    return { ok: true, updatedAt: f!.updatedAt } as const
  })
}

export async function guardarAjusteRuta(req: Request, res: Response) {
  exigirEscritura(req)
  const clave = String(req.params.clave)
  if (!CLAVES_AJUSTE.has(clave)) throw new ValidationError(`«${clave}» no es un ajuste del CRM. Las claves válidas son: ${[...CLAVES_AJUSTE].join(', ')}.`)
  // Los equipos los cambian el administrador sin equipo (todos) y los líderes (los suyos; equiposConIds). El resto
  // de la configuración, la configuración general (rol ADMIN o LIDER_VENTAS), como siempre.
  const alcance = clave === 'equipos' ? await alcanceDe(req) : null
  if (alcance && !alcance.todo && !alcance.lidera.length) throw new ForbiddenError('Solo los líderes de cada equipo y los administradores cambian los equipos. Pídeselo a tu líder.')
  if (!alcance && !esLider(req) && !DE_ASESORAS.has(clave)) throw new ForbiddenError(`Solo los líderes de Ventas cambian «${clave}». Pídeselo a tu líder.`)
  const { valor: crudo, base } = ajusteSchema.parse(req.body)
  if (crudo === undefined) throw new ValidationError('Falta «valor» con el ajuste a guardar.')
  const crudoTam = JSON.stringify(crudo ?? null).length
  const tope = DE_ASESORAS.has(clave) ? MAX_AJUSTE_ASESORAS : MAX_AJUSTE
  if (crudoTam > tope) throw new ValidationError(`El ajuste «${clave}» pesa ${tamanoLegible(crudoTam)} y el máximo es ${tamanoLegible(tope)}.${clave === 'kb' ? ' Quita documentos o sitios largos de la base de conocimiento.' : ''}`)
  let valor = conForma(clave, crudo)
  // Los números disponibles de llamadas salen de Meta, no se guardan.
  if (clave === 'llam' && valor && typeof valor === 'object' && !Array.isArray(valor)) {
    const { disponibles: _d, ...resto } = valor as Record<string, unknown>
    void _d
    valor = resto
  }
  let equipos: GuardadoEquipos | null = null
  if (alcance) {
    const previo = (await prisma.crmAjuste.findUnique({ where: llaveAjuste(clave), select: { valor: true } }))?.valor
    equipos = await equiposConIds(valor as Record<string, unknown>, previo, alcance)
    valor = equipos.valor
  }
  const tam = JSON.stringify(valor ?? null).length
  if (tam > MAX_AJUSTE) throw new ValidationError(`El ajuste «${clave}» pesa ${tamanoLegible(tam)} y el máximo es 8 MB. Si es la base de conocimiento, quita documentos o sitios largos.`)

  const r = await escribirAjuste(clave, valor, req.userId!, base)
  if (!r.ok) {
    const actual = await prisma.crmAjuste.findUnique({ where: llaveAjuste(clave), select: { valor: true, updatedAt: true } })
    let guardado: unknown = actual?.valor ?? null
    if (equipos && actual) {
      // No se guardó: la membresía del espacio vuelve a ser la de los equipos guardados.
      const guardados = normalizarEquipos(actual.valor, await usuariosCrm(true))
      guardado = guardados
      await sincronizarMiembros(guardados.ids).catch(e => logger.warn(`[CRM equipos] miembros tras el choque: ${(e as Error)?.message ?? e}`))
      olvidarGenteCrm()
    }
    return res.status(409).json({
      success: false,
      error: `Otra persona guardó «${clave}» mientras tú lo cambiabas. Se trajo lo último guardado: revisa tus cambios y vuelve a guardar.`,
      data: { clave, valor: guardado, updatedAt: actual?.updatedAt.toISOString() ?? null },
    })
  }
  const updatedAt = r.updatedAt.toISOString()
  // Los alcances del tiempo real se vuelven a leer ya con lo guardado: un evento que salió entre el primer olvido
  // (equiposConIds) y esta escritura pudo dejar guardados por 15 s los de antes.
  if (equipos) olvidarGenteCrm()
  emitirCrm({ tipo: 'ajuste', clave, valor: valor ?? null, updatedAt }, req.userId!)
  // A quien le cambió el rol en un equipo o salió del CRM: su alcance nuevo, en vivo.
  if (equipos) await avisarAlcances(equipos.antes, equipos.valor, equipos.quitados, req.userId!)
  // A quien entró a un equipo o subequipo le llega la invitación por correo (6-oct), sin hacer esperar el guardado.
  if (equipos) void invitarNuevos(equipos.antes, equipos.valor, req.userId!).catch(e => logger.error(`[CRM invitaciones] ${(e as Error).message}`))
  // Un equipo con nombre nuevo o borrado (solo el administrador sin equipo): sus conversaciones van con él.
  if (equipos && alcance?.todo) await moverConversaciones(equipos.antes, equipos.valor, obj(obj(crudo).renombres), req.userId!)
  return ApiResponse.success(res, { clave, valor: valor ?? null, updatedAt })
}

/** GET /crm/ajustes/versiones → { clave: updatedAt } de los ajustes guardados (la `base` de cada PUT). */
export async function versionesAjustes(_req: Request, res: Response) {
  const filas = await prisma.crmAjuste.findMany({ where: { clave: { in: [...CLAVES_AJUSTE] } }, select: { clave: true, updatedAt: true } })
  return ApiResponse.success(res, Object.fromEntries(filas.map(f => [f.clave, f.updatedAt.toISOString()])))
}

// ─── Preferencias propias ────────────────────────────────────────────────────

const ESTADOS = ['En línea', 'Ocupada', 'Ausente']
const prefSchema = z.object({ valor: z.record(z.unknown()) })

export async function guardarPreferencias(req: Request, res: Response) {
  exigirEscritura(req)
  const { valor } = prefSchema.parse(req.body)
  const nuevo: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(valor)) {
    // Nada de contraseñas ni datos de verificación en las preferencias.
    if (/pwd|clave|contrase|password|codigo|correoPend/i.test(k)) continue
    nuevo[k] = v
  }
  if ('estado' in nuevo && !ESTADOS.includes(String(nuevo.estado))) throw new ValidationError('El estado debe ser «En línea», «Ocupada» o «Ausente».')
  if (JSON.stringify(nuevo).length > 200_000) throw new ValidationError('Las preferencias pesan demasiado. Revisa las respuestas rápidas propias: ¿alguna es muy larga?')
  const antes = await leerPreferencias(req.userId!)
  const valorFinal = { ...antes, ...nuevo }
  await prisma.crmPreferencia.upsert({
    where: llavePreferencia(req.userId!),
    create: { userId: req.userId!, valor: valorFinal as Prisma.InputJsonValue },
    update: { valor: valorFinal as Prisma.InputJsonValue },
  })
  const estadoAntes = typeof antes.estado === 'string' ? antes.estado : 'En línea'
  if ('estado' in nuevo && nuevo.estado !== estadoAntes) emitirCrm({ tipo: 'pref', userId: req.userId!, estado: nuevo.estado }, req.userId!)
  return ApiResponse.success(res, valorFinal)
}

// ─── Archivos adjuntos ───────────────────────────────────────────────────────

export async function subirArchivo(req: Request, res: Response) {
  exigirEscritura(req)
  const f = req.file
  if (!f) throw new ValidationError('Falta el archivo. Súbelo en el campo «archivo».')
  const n = nombreArchivo(f)
  let url: string
  try {
    url = await subirACloudinary(f.buffer, n, f.mimetype)
  } catch (e) {
    logger.error(`[CRM archivos] Cloudinary: ${(e as Error)?.message ?? e}`)
    throw new AppError('No se pudo guardar el archivo en la nube. Intenta de nuevo en un momento; si sigue fallando, avisa al administrador.', 502)
  }
  return ApiResponse.created(res, { url, n, t: tamanoLegible(f.size), mime: f.mimetype, bytes: f.size })
}

// ─── Base de conocimiento ────────────────────────────────────────────────────
//
// Leer sitios y documentos solo sirve para llenar el ajuste `kb`, que es de
// los líderes: las asesoras no hacen que el servidor salga a internet.

const webSchema = z.object({ url: z.string().min(3).max(2000) })

export async function leerSitio(req: Request, res: Response) {
  exigirEscritura(req)
  exigirLider(req, 'cargar la base de conocimiento')
  const { url } = webSchema.parse(req.body)
  return ApiResponse.success(res, await leerWeb(url))
}

export async function subirDocumento(req: Request, res: Response) {
  exigirEscritura(req)
  exigirLider(req, 'cargar la base de conocimiento')
  const f = req.file
  if (!f) throw new ValidationError(`Falta el documento. Súbelo en el campo «archivo». ${MENSAJE_TIPOS}`)
  const n = nombreArchivo(f)
  if (!TIPOS_DOC.has(f.mimetype) && !EXT_DOC.test(n)) throw new ValidationError(`Ese tipo de archivo no se puede leer. ${MENSAJE_TIPOS}`)
  // Primero se lee (si no se puede leer, no se sube nada).
  const { texto, paginas, recortado } = await extraerTexto(f.buffer, f.mimetype, n)
  let url: string
  try {
    url = await subirACloudinary(f.buffer, n, /\.pdf$/i.test(n) ? 'application/pdf' : f.mimetype)
  } catch (e) {
    logger.error(`[CRM kb] Cloudinary: ${(e as Error)?.message ?? e}`)
    throw new AppError('Se leyó el documento pero no se pudo guardar en la nube. Intenta de nuevo en un momento.', 502)
  }
  return ApiResponse.created(res, { url, n, t: tamanoLegible(f.size), texto, paginas, ...(recortado ? { recortado: true } : {}) })
}

// ─── Agentes: chat de prueba ─────────────────────────────────────────────────
//
// Cada mensaje de prueba es una llamada pagada al modelo. Solo los líderes
// (la página Agentes es de ellos), con los campos que entran al prompt
// acotados, máximo PRUEBAS_POR_MINUTO (routes/crm.ts) y PRUEBAS_POR_DIA por
// persona. El día se cuenta en hora de Colombia y queda en la base (ajuste
// interno `_pruebasAgente`), así que no se reinicia con un despliegue.

export const PRUEBAS_POR_DIA = 100
const CLAVE_PRUEBAS = '_pruebasAgente'
/** El API corta la respuesta a los 30 s: la llamada al modelo no puede durar más. */
const TIEMPO_MODELO_MS = 25_000

/** Un campo que puede venir vacío (null o sin mandar). */
const opcional = <T extends z.ZodTypeAny>(s: T) => z.preprocess(v => (v === null ? undefined : v), s.optional())
const corto = (max: number) => opcional(z.string().max(max, `hay un texto del agente de más de ${max} caracteres`))

const agenteSchema = z.object({
  nombre: corto(120),
  presenta: corto(300),
  que: corto(6000),
  tono: corto(300),
  largo: corto(300),
  destino: corto(120),
  emojis: opcional(z.boolean()),
  pasa: opcional(z.object({
    listo: opcional(z.boolean()), persona: opcional(z.boolean()), molesto: opcional(z.boolean()),
    mensajes: opcional(z.boolean()), enlace: opcional(z.boolean()),
  })),
  nMsj: opcional(z.union([z.number().int().min(0).max(1000), z.string().regex(/^\d{0,4}$/, 'el número de mensajes antes de pasar no es válido')])),
  temas: opcional(z.array(z.tuple([z.string().max(300, 'hay un tema de más de 300 caracteres'), z.string().max(120)])).max(30, 'caben máximo 30 temas')),
  kb: opcional(z.array(z.string().max(80)).max(50, 'caben máximo 50 colecciones')),
  acc: opcional(z.object({ datos: opcional(z.boolean()) })),
  tpl: corto(20),
  contexto: corto(4000),
  idioma: corto(40),
  criterios: corto(3000),
  adicionales: corto(4000),
  recopilar: opcional(z.array(z.string().max(60)).max(20, 'caben máximo 20 datos para recopilar')),
  silencioso: opcional(z.boolean()),
  habilidades: opcional(z.array(z.object({
    id: opcional(z.string().max(40)), on: opcional(z.boolean()), n: corto(80), cuando: corto(500), pasos: corto(5000),
    equipo: corto(120), etiqueta: corto(60), etapa: corto(120),
  })).max(10, 'caben máximo 10 habilidades')),
  consultas: opcional(z.array(z.string().max(40)).max(10, 'caben máximo 10 consultas')),
})

const probarSchema = z.object({
  agente: agenteSchema,
  historial: z.array(z.object({ rol: z.enum(['cliente', 'agente']), texto: z.string().max(4000, 'hay un mensaje de más de 4.000 caracteres') })).min(1).max(60),
})

const diaBogota = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

/**
 * Suma una prueba a la cuenta del día de esta persona, con la fila bloqueada
 * (dos pestañas a la vez no se saltan el tope). `delta` -1 la devuelve.
 * Devuelve cuántas lleva hoy, o null si ya llegó al tope.
 */
async function contarPrueba(userId: string, delta: 1 | -1): Promise<number | null> {
  return prisma.$transaction(async tx => {
    await tx.crmAjuste.upsert({ where: llaveAjuste(CLAVE_PRUEBAS), create: { clave: CLAVE_PRUEBAS, valor: {} }, update: {} })
    const filas = await tx.$queryRaw<{ valor: unknown }[]>`SELECT valor FROM crm_ajustes WHERE espacio_id = ${espacioActual()} AND clave = ${CLAVE_PRUEBAS} FOR UPDATE`
    const guardado = obj(filas[0]?.valor)
    const dia = diaBogota()
    const cuentas = guardado.dia === dia ? { ...obj(guardado.n) } : {}
    const antes = Number(cuentas[userId]) || 0
    if (delta === 1 && antes >= PRUEBAS_POR_DIA) return null
    const ahora = Math.max(0, antes + delta)
    cuentas[userId] = ahora
    await tx.crmAjuste.update({ where: llaveAjuste(CLAVE_PRUEBAS), data: { valor: { dia, n: cuentas } as Prisma.InputJsonValue } })
    return ahora
  })
}

// ─── Agentes: «Mejorar» (preguntas que el agente no encontró en su base) ─────
export async function mejorarLista(req: Request, res: Response) {
  exigirLider(req, 'ver lo que el agente no supo responder')
  const ag = typeof req.query.ag === 'string' ? req.query.ag.slice(0, 80) : undefined
  return ApiResponse.success(res, await listarSinRespuesta(ag))
}
export async function mejorarQuitar(req: Request, res: Response) {
  exigirEscritura(req)
  exigirLider(req, 'quitar preguntas de Mejorar')
  const id = String(req.params.id || '').slice(0, 40)
  if (!(await quitarSinRespuesta(id))) throw new NotFoundError('Esa pregunta ya no está en la lista. Recarga la página.')
  return ApiResponse.success(res, { ok: true })
}

export async function probarAgenteRuta(req: Request, res: Response) {
  exigirEscritura(req)
  exigirLider(req, 'probar los agentes IA')
  const parsed = probarSchema.safeParse(req.body, { errorMap: errorEs })
  if (!parsed.success) throw new ValidationError(`No se pudo probar el agente: ${parsed.error.issues[0].message}.`)
  const { agente, historial } = parsed.data

  const llevaHoy = await contarPrueba(req.userId!, 1)
  if (llevaHoy === null) {
    throw new AppError(`Llegaste a las ${PRUEBAS_POR_DIA} pruebas del agente de hoy. Mañana puedes seguir probando.`, 429)
  }
  // Con el motor de IA de la empresa, sin esperar más de 25 s ni reintentar. Sin motor, probarAgente responde 503 con su texto.
  const motor = await motorIA()
  const cliente = motor ? conOpciones(motor.cliente, { timeout: TIEMPO_MODELO_MS, maxRetries: 0 }) : undefined
  try {
    return ApiResponse.success(res, await probarAgente(agente as Parameters<typeof probarAgente>[0], historial, cliente))
  } catch (e) {
    // Lo que no llegó al modelo (sin clave, historial sin mensaje del cliente) no cuenta.
    const estado = e instanceof AppError ? e.statusCode : 500
    if (estado === 400 || estado === 503) await contarPrueba(req.userId!, -1).catch(() => undefined)
    throw e
  }
}

// ─── Capacidades: consultas de solo lectura a los sistemas aprobados (integraciones.ts) ─────
export async function integracionesLista(req: Request, res: Response) {
  exigirLider(req, 'ver las conexiones con otros sistemas')
  return ApiResponse.success(res, await estadoIntegraciones())
}
export async function integracionHotmart(req: Request, res: Response) {
  exigirEscritura(req)
  exigirLider(req, 'conectar Hotmart')
  const b = obj(req.body)
  return ApiResponse.success(res, await conectarHotmart({ clientId: b.clientId, clientSecret: b.clientSecret }, req.userId ?? null))
}
export async function integracionShopify(req: Request, res: Response) {
  exigirEscritura(req)
  exigirLider(req, 'conectar Shopify')
  const b = obj(req.body)
  return ApiResponse.success(res, await conectarShopify({ tienda: b.tienda, token: b.token }, req.userId ?? null))
}
export async function integracionCalendario(req: Request, res: Response) {
  exigirEscritura(req)
  exigirLider(req, 'conectar Google Calendar')
  return ApiResponse.success(res, await conectarCalendario(obj(req.body), req.userId ?? null))
}
export async function integracionQuitar(req: Request, res: Response) {
  exigirEscritura(req)
  exigirLider(req, 'desconectar otros sistemas')
  return ApiResponse.success(res, await desconectar(String(req.params.sistema || '').slice(0, 40), req.userId ?? null))
}

// ─── Motor de IA de la empresa: Claude, Gemini u OpenAI con la clave de su cuenta (motorIA.ts) ─────
export async function motorLista(req: Request, res: Response) {
  exigirLider(req, 'ver el motor de IA')
  return ApiResponse.success(res, await estadoMotor())
}
export async function motorConectar(req: Request, res: Response) {
  exigirEscritura(req)
  exigirLider(req, 'conectar el motor de IA')
  return ApiResponse.success(res, await conectarMotor(String(req.params.proveedor || '').slice(0, 20), { clave: obj(req.body).clave }, req.userId ?? null))
}
export async function motorUsar(req: Request, res: Response) {
  exigirEscritura(req)
  exigirLider(req, 'cambiar el motor de IA')
  return ApiResponse.success(res, await usarMotor(String(req.params.proveedor || '').slice(0, 20), req.userId ?? null))
}
export async function motorQuitar(req: Request, res: Response) {
  exigirEscritura(req)
  exigirLider(req, 'desconectar el motor de IA')
  return ApiResponse.success(res, await desconectarMotor(String(req.params.proveedor || '').slice(0, 20), req.userId ?? null))
}
