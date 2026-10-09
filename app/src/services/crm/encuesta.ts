import { randomInt } from 'node:crypto'
import { Prisma, type CrmLinea, type CrmMensaje } from '@prisma/client'
import { prisma, prismaGlobal } from './bd'
import { enEspacio, espacioActual } from './espacio'
import { guardarAjuste, leerAjuste } from './ajustes'
import { credDeLinea, credDeWaba, type CredMeta } from './credenciales'
import { ErrorMeta, VEINTICUATRO_H, graph } from './whatsapp'
import { emitirConv, emitirCrm, emitirMsg } from './tiempoReal'
import { alcanceDePersona, equipoDeConv, genteQueLidera, veConv, type Alcance } from './alcance'
import { leerEquipos, type EquiposNorm } from './equipos'
import { usuariosCrm } from './usuarios'
import { telDigitos, telVisible } from './formas'
import { motivoNoContactar } from './salientes'
import { avisar } from '../notificaciones'
import { AppError } from '../../utils/errors'
import { logger } from '../../utils/logger'

/**
 * Encuesta al finalizar con un formulario de WhatsApp.
 * Plan y contrato completos en docs/crm/api-core.md («Encuesta al finalizar (lote 6)») y docs/crm/api-whatsapp.md.
 *
 * - El formulario (WhatsApp Flows) se crea y publica una vez por cuenta de WhatsApp (WABA), con la API de Meta que el CRM
 *   ya usa: al prender o guardar la encuesta en Ajustes y, si falta, en el primer envío (asegurarFormulario).
 * - Al finalizar, la pantalla manda un evento `star` con `encuesta: true` por la cola de mensajes de la conversación; la
 *   ruta routes/crmEncuesta.ts lo atiende con enviarEncuesta: revisa las reglas (puedeEnviar), reserva los días por
 *   persona (contacto.extra._encuestaUltima) y manda el mensaje interactivo de tipo flow con el botón «Responder
 *   encuesta». Solo con la ventana de 24 h abierta: así no cuesta nada.
 * - La respuesta llega por el webhook como `interactive.nfm_reply` (entrantes.ts → respuestaFormulario): se guarda como
 *   tarjeta `csat` en la conversación de esa encuesta sin reabrirla, se avisa al líder si la atención es de 2 o menos y
 *   sale el mensaje de gracias.
 * - Informes › Encuestas (informeEncuestas) cuenta cada envío y su respuesta según el alcance de cada quien.
 *
 * Nada de esto toca schema.prisma: la configuración va en el ajuste `cfg` (clave `encuesta`), el estado de los
 * formularios en `_encuestaFormularios`, la fecha de la última encuesta en `contacto.extra`, cada envío como evento `ev`
 * y cada respuesta como `csat` en crm_mensajes, y el aviso en notificaciones.
 */

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})
const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const json = (v: unknown) => v as Prisma.InputJsonValue
const DIA = 86_400_000
/** Colombia no cambia de hora: UTC-5 fijo. */
const HORA_CO = 5 * 3_600_000

// ─── Configuración (cfg.encuesta) ────────────────────────────────────────────

export interface CfgEncuesta {
  /** «Enviar la encuesta al finalizar». */
  on: boolean
  /** «No volver a enviarla a la misma persona en»: días, de 1 a 365. */
  dias: number
  /** «Avisar al líder del equipo si califica con 2 o menos». */
  aviso: boolean
  /** «Mensaje con el botón». */
  msg: string
  /** «Pregunta sobre el asesor, de 1 a 5» (label del formulario: máximo 30). */
  p1: string
  /** «Pregunta de recomendación, de 0 a 10». */
  p2: string
  /** «Pedir un comentario». */
  comentario: boolean
  /** «Mensaje de gracias» (vacío = no se manda). */
  gracias: string
}

export const ENCUESTA_DEFECTO: CfgEncuesta = {
  on: true,
  dias: 30,
  aviso: true,
  msg: '¡Gracias por escribirnos, {{nombre}}! ¿Nos ayudas con dos preguntas sobre tu atención? Toma menos de un minuto.',
  p1: '¿Cómo te atendió {{asesor}}?',
  p2: 'Del 0 al 10, ¿qué tan probable es que recomiendes {{empresa}} a un amigo?',
  comentario: true,
  gracias: '¡Gracias por responder, {{nombre}}! Nos ayuda a mejorar.',
}
/** Topes de cada texto (los mismos `maxlength` de Ajustes). */
export const TOPES_ENCUESTA = { msg: 600, p1: 30, p2: 200, gracias: 300 } as const

/** Sin caracteres de control (menos los saltos de línea), con los saltos normalizados y sin espacios a los lados. */
function limpiarTexto(v: unknown, max: number): string {
  if (typeof v !== 'string') return ''
  return v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').replace(/\n{3,}/g, '\n\n').trim().slice(0, max).trim()
}

/** cfg.encuesta con la forma completa (igual que encCfg de la pantalla, 65-encuesta.js). Pura. */
export function normalizarEncuesta(valor: unknown, espacioId: string): CfgEncuesta {
  const v = obj(valor)
  const dias = Number(v.dias)
  const texto = (k: 'msg' | 'p1' | 'p2', vacioDefecto: boolean) => {
    const t = limpiarTexto(v[k], TOPES_ENCUESTA[k])
    return t || (vacioDefecto ? ENCUESTA_DEFECTO[k] : '')
  }
  const p2 = texto('p2', true)
  return {
    on: v.on !== false,
    dias: Number.isInteger(dias) && dias >= 1 && dias <= 365 ? dias : ENCUESTA_DEFECTO.dias,
    aviso: v.aviso !== false,
    msg: texto('msg', true),
    p1: texto('p1', true),
    p2,
    comentario: v.comentario !== false,
    // Sin clave: el defecto. Vacío a propósito: no se manda gracias.
    gracias: v.gracias === undefined || v.gracias === null ? ENCUESTA_DEFECTO.gracias : limpiarTexto(v.gracias, TOPES_ENCUESTA.gracias),
  }
}

/** La configuración de la encuesta del espacio actual, normalizada. */
export async function cfgEncuesta(): Promise<CfgEncuesta> {
  return normalizarEncuesta(obj(await leerAjuste('cfg')).encuesta, espacioActual())
}

// ─── Variables: {{nombre}}, {{asesor}}, {{empresa}} ─────────────────────────

export interface VariablesEncuesta { nombre: string; asesor: string; empresa: string }

/** La primera palabra de un nombre, si tiene alguna letra (un número o un correo no es un nombre). */
export const primeraPalabra = (n: string | null | undefined) => {
  const p = String(n ?? '').trim().split(/\s+/)[0] ?? ''
  return /\p{L}/u.test(p) && !p.includes('@') ? p : ''
}

/**
 * Pone las variables en el texto. Una variable vacía se quita con la coma y los espacios de antes: «¡Gracias por
 * escribirnos, {{nombre}}!» sin nombre queda «¡Gracias por escribirnos!». Después, espacios dobles a uno y recorte.
 * La pantalla usa la misma función para sus vistas previas.
 */
export function rellenar(t: string, vars: Partial<VariablesEncuesta>): string {
  let s = t
  for (const [k, v] of Object.entries(vars)) {
    const valor = String(v ?? '').trim()
    s = valor ? s.split(`{{${k}}}`).join(valor) : s.replace(new RegExp(`\\s*,?\\s*\\{\\{${k}\\}\\}`, 'g'), '')
  }
  return s.replace(/[ \t]{2,}/g, ' ').trim()
}

/** El nombre del espacio (la empresa que usa el CRM): sale en {{empresa}}. */
async function nombreEmpresa(): Promise<string> {
  const e = await prismaGlobal.crmEspacio.findUnique({ where: { id: espacioActual() }, select: { nombre: true } })
  return e?.nombre?.trim() ?? ''
}

/** Las variables de una conversación: el primer nombre del contacto y del asesor, y el nombre del espacio. */
export async function variablesDe(contactoNombre: string | null, asesorNombre: string | null): Promise<VariablesEncuesta> {
  return { nombre: primeraPalabra(contactoNombre), asesor: primeraPalabra(asesorNombre), empresa: await nombreEmpresa() }
}

/** La pregunta del asesor es el label del formulario: máximo 30. Si no cabe, se recorta el nombre; si ni así, el defecto. */
export const TOPE_PREGUNTA_ASESOR = 30
export function preguntaAsesor(p1: string, vars: VariablesEncuesta): string {
  for (const plantilla of [p1, ENCUESTA_DEFECTO.p1]) {
    const lleno = rellenar(plantilla, vars)
    if (lleno.length <= TOPE_PREGUNTA_ASESOR) return lleno
    for (let n = vars.asesor.length - 1; n >= 0; n--) {
      const corto = rellenar(plantilla, { ...vars, asesor: vars.asesor.slice(0, n) })
      if (corto.length <= TOPE_PREGUNTA_ASESOR) return corto
    }
  }
  return rellenar(ENCUESTA_DEFECTO.p1, { ...vars, asesor: '' }).slice(0, TOPE_PREGUNTA_ASESOR)
}

// ─── El formulario (Flow JSON) ───────────────────────────────────────────────

/** Sube con cada cambio del formulario: el nombre en Meta lleva la versión. */
export const VERSION_FORMULARIO = 1
export const NOMBRE_FORMULARIO = `encuesta_al_finalizar_v${VERSION_FORMULARIO}`
export const BOTON_FORMULARIO = 'Responder encuesta'
const PANTALLA = 'ENCUESTA'

/**
 * Tablero 1 de la maqueta: título «Encuesta de atención», la pregunta del asesor con las 5 calificaciones, la
 * recomendación de 0 a 10 en un desplegable «Elige de 0 a 10», el comentario opcional y «Enviar». WhatsApp dibuja los
 * campos con su estilo; aquí se controlan el orden, los textos y el tipo de cada campo. Flow JSON 7.3, una pantalla, sin
 * Form (opcional desde la 4.0) y sin endpoint: el Footer hace `complete` y su payload llega en el webhook (nfm_reply).
 */
export const FORMULARIO_JSON = {
  version: '7.3',
  screens: [
    {
      id: PANTALLA,
      title: 'Encuesta de atención',
      terminal: true,
      success: true,
      data: {
        pregunta_asesor: { type: 'string', __example__: '¿Cómo te atendió Laura?' },
        pregunta_recomienda: { type: 'string', __example__: 'Del 0 al 10, ¿qué tan probable es que nos recomiendes a un amigo?' },
        pedir_comentario: { type: 'boolean', __example__: true },
      },
      layout: {
        type: 'SingleColumnLayout',
        children: [
          {
            type: 'RadioButtonsGroup',
            name: 'atencion',
            label: '${data.pregunta_asesor}',
            required: true,
            'data-source': [
              { id: '5', title: '⭐⭐⭐⭐⭐ Excelente' },
              { id: '4', title: '⭐⭐⭐⭐ Buena' },
              { id: '3', title: '⭐⭐⭐ Regular' },
              { id: '2', title: '⭐⭐ Mala' },
              { id: '1', title: '⭐ Muy mala' },
            ],
          },
          // Las preguntas que no son el label de un campo van en negrilla (font-weight de TextBody, documentado): en el
          // tablero 1 las tres preguntas tienen el mismo peso, y WhatsApp dibuja el label del RadioButtonsGroup como rótulo.
          { type: 'TextBody', text: '${data.pregunta_recomienda}', 'font-weight': 'bold' },
          {
            type: 'Dropdown',
            name: 'recomienda',
            label: 'Elige de 0 a 10',
            required: true,
            'data-source': [
              { id: '10', title: '10 · Muy probable' },
              ...[9, 8, 7, 6, 5, 4, 3, 2, 1].map(n => ({ id: String(n), title: String(n) })),
              { id: '0', title: '0 · Nada probable' },
            ],
          },
          { type: 'TextBody', text: '¿Quieres contarnos algo más?', 'font-weight': 'bold', visible: '${data.pedir_comentario}' },
          {
            type: 'TextArea',
            name: 'comentario',
            label: 'Tu comentario',
            'helper-text': 'Opcional',
            required: false,
            'max-length': 600,
            visible: '${data.pedir_comentario}',
          },
          {
            type: 'Footer',
            label: 'Enviar',
            'on-click-action': {
              name: 'complete',
              payload: { atencion: '${form.atencion}', recomienda: '${form.recomienda}', comentario: '${form.comentario}' },
            },
          },
        ],
      },
    },
  ],
} as const

// ─── Formularios por cuenta de WhatsApp (crm_ajustes `_encuestaFormularios`) ─

export interface RegistroFormulario {
  /** Id del formulario en Meta (null si nunca se creó). */
  id: string | null
  nombre: string
  version: number
  estado: 'listo' | 'error'
  /** Texto en español de por qué no está listo. */
  error: string | null
  /** Último intento. */
  en: string
  /** Última vez que se miró su estado en Meta. */
  revisado: string | null
  /** Desde cuándo se puede volver a intentar (null si está listo). */
  reintento: string | null
}
export type EstadoLinea = { estado: 'listo' | 'preparando' | 'error' | 'pendiente'; error: string | null; reintento: string | null }

const CLAVE_FORMULARIOS = '_encuestaFormularios'
/** Después de un rechazo de Meta: no se vuelve a intentar antes (salvo al guardar Ajustes). */
const ESPERA_REINTENTO = 10 * 60_000
/** Cada cuánto se revisa, al enviar, que el formulario siga publicado. */
const REVISION = 6 * 3_600_000
/** Guardar Ajustes vuelve a intentar un formulario en error, pero no más de una vez por minuto. */
const ESPERA_FORZADA = 60_000
const TIEMPO_META = 15_000

/** Un error que se explica solo, en español: el formulario no quedó o la encuesta no puede salir. */
class ErrorEncuesta extends Error {}

/** «El token no tiene…» → «el token no tiene…», para ir dentro de otra frase. Meta y WhatsApp se quedan como están. */
export function minuscula(t: string): string {
  const s = t.trim().replace(/\.+$/, '')
  if (/^(Meta|WhatsApp|Instagram|Messenger)\b/.test(s)) return s
  return s.charAt(0).toLowerCase() + s.slice(1)
}

async function leerRegistros(): Promise<Record<string, RegistroFormulario>> {
  return obj(await leerAjuste(CLAVE_FORMULARIOS)) as unknown as Record<string, RegistroFormulario>
}

/** Guarda el registro de una cuenta sin pisar el de las otras (dos cuentas pueden prepararse a la vez). */
async function guardarRegistro(waba: string, r: RegistroFormulario): Promise<void> {
  const espacio = espacioActual()
  const valor = JSON.stringify({ [waba]: r })
  await prismaGlobal.$executeRaw`
    INSERT INTO crm_ajustes (espacio_id, clave, valor, "updatedAt") VALUES (${espacio}, ${CLAVE_FORMULARIOS}, ${valor}::jsonb, now())
    ON CONFLICT (espacio_id, clave) DO UPDATE SET
      valor = (CASE WHEN jsonb_typeof(crm_ajustes.valor) = 'object' THEN crm_ajustes.valor ELSE '{}'::jsonb END) || EXCLUDED.valor,
      "updatedAt" = now()`
}

/** Las cuentas que se están preparando ahora (una promesa por espacio y cuenta: un solo intento a la vez). */
const enCurso = new Map<string, Promise<RegistroFormulario>>()
const claveCurso = (waba: string) => `${espacioActual()}|${waba}`

/** El estado de cada línea del espacio para la pantalla (regla 8 y el «why» del diálogo de finalizar). */
export async function formulariosPorLinea(): Promise<Record<string, EstadoLinea>> {
  const [lineas, regs] = await Promise.all([prisma.crmLinea.findMany({ select: { id: true, wabaId: true } }), leerRegistros()])
  const out: Record<string, EstadoLinea> = {}
  for (const l of lineas) {
    const r = regs[l.wabaId]
    if (enCurso.has(claveCurso(l.wabaId))) out[l.id] = { estado: 'preparando', error: null, reintento: null }
    else if (r && r.version === VERSION_FORMULARIO && (r.estado === 'listo' || r.estado === 'error')) out[l.id] = { estado: r.estado, error: r.error ?? null, reintento: r.reintento ?? null }
    else out[l.id] = { estado: 'pendiente', error: null, reintento: null }
  }
  return out
}

/** Cada cambio de estado de un formulario llega a toda la gente del espacio (evento `encuesta-formularios`). */
async function emitirFormularios(): Promise<void> {
  emitirCrm({ tipo: 'encuesta-formularios', formularios: await formulariosPorLinea() })
}

interface FlowMeta { id: string; name?: string; status?: string }

async function listarFlows(waba: string, cred: CredMeta): Promise<FlowMeta[]> {
  const todos: FlowMeta[] = []
  let after: string | undefined
  for (let i = 0; i < 20; i++) {
    const r = await graph<{ data?: FlowMeta[]; paging?: { next?: string; cursors?: { after?: string } } }>(`/${waba}/flows`, { cred, query: { fields: 'id,name,status', limit: 100, after }, timeoutMs: TIEMPO_META })
    todos.push(...(r.data ?? []).filter(f => f && f.id))
    if (!r.paging?.next || !r.paging.cursors?.after) break
    after = r.paging.cursors.after
  }
  return todos
}

/** Borra un borrador (solo se puede en DRAFT). Si no se deja, queda en el registro: no tumba nada. */
async function borrarBorrador(id: string, cred: CredMeta): Promise<void> {
  await graph(`/${id}`, { cred, method: 'DELETE', timeoutMs: TIEMPO_META }).catch(e => logger.warn(`[CRM encuesta] no se pudo borrar el borrador del formulario ${id}: ${(e as Error)?.message ?? e}`))
}

/** Crea el formulario con ese nombre y lo deja publicado. Devuelve su id. */
async function crearYPublicar(waba: string, nombre: string, cred: CredMeta): Promise<string> {
  const r = await graph<{ id?: string; success?: boolean; validation_errors?: { error?: string; message?: string }[] }>(`/${waba}/flows`, {
    cred, method: 'POST', timeoutMs: TIEMPO_META,
    body: { name: nombre, categories: ['SURVEY'], flow_json: JSON.stringify(FORMULARIO_JSON), publish: true },
  })
  if (!r.id) throw new ErrorEncuesta('Meta no devolvió el id del formulario')
  if (Array.isArray(r.validation_errors) && r.validation_errors.length) {
    await borrarBorrador(r.id, cred)
    const e = r.validation_errors[0]
    throw new ErrorEncuesta(`Meta no aceptó el formulario: ${txt(e?.message) || txt(e?.error) || 'error de validación'}`)
  }
  const f = await graph<{ status?: string }>(`/${r.id}`, { cred, query: { fields: 'id,name,status,validation_errors' }, timeoutMs: TIEMPO_META })
  if (f.status !== 'PUBLISHED') {
    try {
      await graph(`/${r.id}/publish`, { cred, method: 'POST', timeoutMs: TIEMPO_META })
    } catch (e) {
      await borrarBorrador(r.id, cred)
      throw e
    }
  }
  return r.id
}

/**
 * Los estados en que el formulario se puede mandar. THROTTLED también: Meta lo limita a 10 envíos por hora, pero sigue
 * sirviendo, y uno publicado no se puede borrar (solo deprecar), así que no se crea otro por eso.
 */
const UTILIZABLE = new Set(['PUBLISHED', 'THROTTLED'])

/**
 * Busca o crea el formulario publicado de la cuenta: si ya hay uno con el nombre en PUBLISHED (o THROTTLED), se usa; un
 * borrador con ese nombre se borra y se vuelve a crear; uno en DEPRECATED o BLOCKED deja el nombre ocupado y se prueba
 * con `_2`, `_3`…
 */
async function buscarOCrear(waba: string, cred: CredMeta): Promise<{ id: string; nombre: string }> {
  const lista = await listarFlows(waba, cred)
  for (let n = 1; n <= 20; n++) {
    const nombre = n === 1 ? NOMBRE_FORMULARIO : `${NOMBRE_FORMULARIO}_${n}`
    const iguales = lista.filter(f => f.name === nombre)
    const publicado = iguales.find(f => UTILIZABLE.has(f.status ?? ''))
    if (publicado) return { id: publicado.id, nombre }
    if (iguales.some(f => f.status !== 'DRAFT')) continue
    for (const f of iguales) await borrarBorrador(f.id, cred)
    return { id: await crearYPublicar(waba, nombre, cred), nombre }
  }
  throw new ErrorEncuesta('la cuenta de WhatsApp ya tiene demasiados formularios de encuesta retirados')
}

/** Sigue publicado (o limitado) en Meta? true / false; null si no se pudo saber (Meta no respondió): se deja como estaba. */
async function siguePublicado(id: string, cred: CredMeta): Promise<boolean | null> {
  try {
    const f = await graph<{ status?: string }>(`/${id}`, { cred, query: { fields: 'id,status' }, timeoutMs: TIEMPO_META })
    return UTILIZABLE.has(f.status ?? '')
  } catch (e) {
    return e instanceof ErrorMeta ? false : null
  }
}

export interface OpcionesFormulario {
  /** Guardar Ajustes con la encuesta prendida: un formulario en error se vuelve a intentar sin esperar los 10 minutos. */
  forzar?: boolean
  /** El envío falló por el formulario: se revisa en Meta aunque no hayan pasado 6 h. */
  vencido?: boolean
}

/**
 * El formulario de una cuenta de WhatsApp, listo para usar: lo busca, lo crea o lo publica si hace falta. Nunca lanza:
 * si Meta no lo acepta, queda `error` con el texto en español y `reintento` en 10 minutos. Un solo intento a la vez por
 * cuenta: quien llega mientras otro lo prepara, espera el mismo resultado.
 */
export function asegurarFormulario(waba: string, op: OpcionesFormulario = {}): Promise<RegistroFormulario> {
  const clave = claveCurso(waba)
  const ya = enCurso.get(clave)
  if (ya) return ya
  const p = prepararUno(waba, op)
  enCurso.set(clave, p)
  p.finally(() => { if (enCurso.get(clave) === p) enCurso.delete(clave) }).catch(() => undefined)
  return p
}

async function prepararUno(waba: string, op: OpcionesFormulario): Promise<RegistroFormulario> {
  // Deja el turno libre para que asegurarFormulario guarde la promesa antes de que esta lea nada.
  await Promise.resolve()
  const ahora = Date.now()
  const reg = (await leerRegistros())[waba]
  const vigente = reg && reg.version === VERSION_FORMULARIO
  if (vigente && reg.estado === 'listo' && reg.id && !op.vencido && ahora - Date.parse(reg.revisado ?? reg.en) < REVISION) return reg
  if (vigente && reg.estado === 'error' && !op.vencido) {
    const espera = op.forzar ? Date.parse(reg.en) + ESPERA_FORZADA : Date.parse(reg.reintento ?? '') || 0
    if (espera > ahora) return reg
  }

  let cred: CredMeta
  try {
    cred = await credDeWaba(waba)
  } catch (e) {
    const r = await fallo(waba, reg, (e as Error)?.message ?? String(e))
    setImmediate(() => { void emitirFormularios().catch(() => undefined) })
    return r
  }

  // Revisión: el que ya estaba listo sigue publicado.
  if (vigente && reg.estado === 'listo' && reg.id) {
    const sigue = await siguePublicado(reg.id, cred)
    if (sigue !== false) {
      const r: RegistroFormulario = { ...reg, revisado: sigue ? new Date().toISOString() : reg.revisado }
      await guardarRegistro(waba, r)
      return r
    }
    logger.warn(`[CRM encuesta] el formulario ${reg.id} de la cuenta ${waba} ya no está publicado: se vuelve a crear`)
  }

  // Desde aquí se habla con Meta para crearlo: la pantalla lo ve «preparando».
  void emitirFormularios().catch(() => undefined)
  try {
    const { id, nombre } = await buscarOCrear(waba, cred)
    const en = new Date().toISOString()
    const r: RegistroFormulario = { id, nombre, version: VERSION_FORMULARIO, estado: 'listo', error: null, en, revisado: en, reintento: null }
    await guardarRegistro(waba, r)
    logger.info(`[CRM encuesta] formulario ${id} (${nombre}) listo en la cuenta ${waba}`)
    return r
  } catch (e) {
    const texto = e instanceof ErrorEncuesta || e instanceof AppError ? e.message : `no se pudo hablar con Meta: ${(e as Error)?.message ?? e}`
    return fallo(waba, reg, texto)
  } finally {
    // Después de guardar y de soltar el turno (asegurarFormulario), con el estado final.
    setImmediate(() => { void emitirFormularios().catch(() => undefined) })
  }
}

async function fallo(waba: string, reg: RegistroFormulario | undefined, texto: string): Promise<RegistroFormulario> {
  const en = new Date()
  const r: RegistroFormulario = {
    id: null, nombre: reg?.nombre ?? NOMBRE_FORMULARIO, version: VERSION_FORMULARIO, estado: 'error',
    error: minuscula(texto).slice(0, 500), en: en.toISOString(), revisado: null,
    reintento: new Date(en.getTime() + ESPERA_REINTENTO).toISOString(),
  }
  await guardarRegistro(waba, r)
  logger.warn(`[CRM encuesta] el formulario de la cuenta ${waba} no quedó listo: ${texto}`)
  return r
}

/** Las cuentas de WhatsApp de las líneas del espacio (sin la línea de Alma). */
async function cuentasDelEspacio(): Promise<string[]> {
  const lineas = await prisma.crmLinea.findMany({ where: { conexionId: { not: null } }, select: { wabaId: true, phoneNumberId: true, telefono: true } })
  return [...new Set(lineas.map(l => l.wabaId).filter(Boolean))]
}

/** Prepara el formulario de cada cuenta del espacio (al prender o guardar la encuesta en Ajustes). */
export async function prepararFormularios(op: OpcionesFormulario = {}): Promise<void> {
  for (const waba of await cuentasDelEspacio()) await asegurarFormulario(waba, op)
}

// ─── Encuestas de antes (texto): migración única a _encuestaUltima ──────────

const CLAVE_MIGRADA = '_encuestaMigrada'
const migrando = new Map<string, Promise<void>>()

/**
 * Una sola vez por espacio: a cada contacto sin `_encuestaUltima` que tenga encuestas de texto enviadas (eventos `star`
 * no fallidos) se le escribe la fecha de la más nueva, para que los días sin repetir también las cuenten. Corre antes de
 * armar /crm/inicio (routes/crmEncuesta.ts), así la pantalla ya trae `_encuestaUltima` desde la primera carga.
 */
export function migrarUltimas(): Promise<void> {
  const espacio = espacioActual()
  const ya = migrando.get(espacio)
  if (ya) return ya
  // Solo se guarda mientras corre: después, la bandera `_encuestaMigrada` de la base es la que dice si ya se hizo.
  const p = (async () => {
    if (await leerAjuste(CLAVE_MIGRADA)) return
    const n = await prismaGlobal.$executeRaw`
      UPDATE crm_contactos k
      SET extra = jsonb_set(CASE WHEN jsonb_typeof(k.extra) = 'object' THEN k.extra ELSE '{}'::jsonb END, '{_encuestaUltima}',
                            to_jsonb(to_char(u.ultima, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))
      FROM (
        SELECT c.contacto_id, max(m."createdAt") AS ultima
        FROM crm_mensajes m JOIN crm_conversaciones c ON c.id = m.conversacion_id
        WHERE m.espacio_id = ${espacio} AND m.tipo = 'ev' AND m.datos->>'ev' = 'star' AND m.estado IS DISTINCT FROM 'fallido'
        GROUP BY c.contacto_id
      ) u
      WHERE k.id = u.contacto_id AND k.espacio_id = ${espacio} AND NOT (COALESCE(k.extra, '{}'::jsonb) ? '_encuestaUltima')`
    await guardarAjuste(CLAVE_MIGRADA, new Date().toISOString(), null)
    if (n) logger.info(`[CRM encuesta] ${n} contactos con encuestas de antes quedaron con la fecha de la última`)
  })()
  migrando.set(espacio, p)
  p.finally(() => { if (migrando.get(espacio) === p) migrando.delete(espacio) }).catch(() => undefined)
  return p
}

// ─── Reglas: ¿sale la encuesta? ──────────────────────────────────────────────

/** Días de calendario en Colombia entre dos momentos (hoy = 0). */
export function diasCalendario(desde: number, hasta: number): number {
  const dia = (t: number) => Math.floor((t - HORA_CO) / DIA)
  return Math.max(0, dia(hasta) - dia(desde))
}

/**
 * ¿La última encuesta todavía bloquea? Por días de calendario en Colombia, igual que el texto: con la última el 1 de
 * octubre y 7 días, sale desde el 8 de octubre a cualquier hora («la próxima puede salir desde el 8 de octubre»).
 * La pantalla (encPuede de 65-encuesta.js) cuenta igual.
 */
export const bloqueanDias = (ultima: number, ahora: number, dias: number) => diasCalendario(ultima, ahora) < dias

/** «ya se le envió una encuesta hace 12 días» / «hace 1 día» / «hoy». */
export function motivoDias(ultima: number, ahora: number): string {
  const n = diasCalendario(ultima, ahora)
  return n === 0 ? 'ya se le envió una encuesta hoy' : `ya se le envió una encuesta hace ${n} ${n === 1 ? 'día' : 'días'}`
}

type ConvEncuesta = Prisma.CrmConversacionGetPayload<{ include: { contacto: true; linea: true } }>

const MOTIVO_VENTANA = 'pasaron más de 24 horas desde su último mensaje'

/**
 * La ventana de 24 h es de Meta por línea y cliente (como armarCuerpo en whatsapp.ts): el último mensaje del cliente en
 * cualquier conversación suya de esa línea, leído de la base en el momento (y `otro`, lo que ya se tenía a mano).
 */
async function ventanaAbierta(contactoId: number, lineaId: string | null, ahora = Date.now(), otro: Date | null = null): Promise<boolean> {
  const r = await prisma.crmConversacion.aggregate({ where: { contactoId, lineaId }, _max: { ultimoEntranteAt: true } })
  const entrante = Math.max(otro?.getTime() ?? 0, r._max.ultimoEntranteAt?.getTime() ?? 0)
  return entrante > 0 && ahora - entrante <= VEINTICUATRO_H
}

/**
 * Las reglas de 2.2, en orden; la primera que falle es el motivo (null = sale). Las mismas de encPuede en la pantalla.
 * La regla de los días se vuelve a mirar con el contacto bloqueado al reservar.
 */
export async function puedeEnviar(c: ConvEncuesta, cfg: CfgEncuesta, ahora = Date.now()): Promise<string | null> {
  if (!cfg.on) return 'la encuesta está apagada en Ajustes del CRM'
  if (c.canal !== 'wa') return 'la encuesta sale solo por WhatsApp'
  if (!c.linea) return 'la conversación no tiene una línea de WhatsApp conectada'
  if (!c.contacto.telefono) return 'el contacto no tiene número de WhatsApp'
  if (motivoNoContactar(c.contacto.noContactar) !== null) return 'pidió no ser contactado'
  if (!c.asignadoId) return 'la conversación no tiene asesor asignado'
  if (!(await ventanaAbierta(c.contactoId, c.lineaId, ahora, c.ultimoEntranteAt))) return MOTIVO_VENTANA
  const ultima = Date.parse(txt(obj(c.contacto.extra)._encuestaUltima))
  if (ultima && bloqueanDias(ultima, ahora, cfg.dias)) return motivoDias(ultima, ahora)
  const reg = (await leerRegistros())[c.linea.wabaId]
  if (reg && reg.version === VERSION_FORMULARIO && reg.estado === 'error' && Date.parse(reg.reintento ?? '') > ahora && !enCurso.has(claveCurso(c.linea.wabaId))) {
    return `el formulario no está listo en WhatsApp (${reg.error ?? 'Meta no lo aceptó'})`
  }
  return null
}

// ─── Envío ───────────────────────────────────────────────────────────────────

const LETRAS = 'abcdefghijklmnopqrstuvwxyz0123456789'
const nuevoToken = (convId: number) => `enc_${convId}_${Array.from({ length: 12 }, () => LETRAS[randomInt(LETRAS.length)]).join('')}`
const TOKEN = /^enc_(\d+)_([a-z0-9]{12})$/
export const TEXTO_ENVIADA = 'Encuesta enviada por WhatsApp'
const textoNoSalio = (motivo: string) => `La encuesta no salió: ${minuscula(motivo)}.`

/** Las conversaciones vigentes del contacto (las que /crm/inicio manda), para que vean su `_encuestaUltima` nuevo. */
async function emitirDelContacto(contactoId: number, por: string | null): Promise<void> {
  const convs = await prisma.crmConversacion.findMany({
    where: { contactoId, OR: [{ estado: { not: 'finalizadas' } }, { finalizadaAt: { gte: new Date(Date.now() - 60 * DIA) } }] },
    select: { id: true }, orderBy: { createdAt: 'desc' }, take: 20,
  })
  for (const c of convs) await emitirConv(c.id, por)
}

/**
 * Reserva los días por persona con el contacto bloqueado: si otra encuesta salió (o está saliendo) dentro de los días,
 * devuelve el motivo. Si no, deja `_encuestaUltima = ahora` y `_encuestaReserva = token` (sin pisar el resto de extra).
 */
async function reservar(contactoId: number, token: string, dias: number, ahora: Date): Promise<{ motivo: string | null; previa: string | null }> {
  const espacio = espacioActual()
  return prismaGlobal.$transaction(async tx => {
    const filas = await tx.$queryRaw<{ extra: unknown }[]>`SELECT extra FROM crm_contactos WHERE id = ${contactoId} AND espacio_id = ${espacio} FOR UPDATE`
    const previa = txt(obj(filas[0]?.extra)._encuestaUltima) || null
    const t = previa ? Date.parse(previa) : 0
    if (t && bloqueanDias(t, ahora.getTime(), dias)) return { motivo: motivoDias(t, ahora.getTime()), previa }
    const marca = JSON.stringify({ _encuestaUltima: ahora.toISOString(), _encuestaReserva: token })
    await tx.$executeRaw`UPDATE crm_contactos SET extra = (CASE WHEN jsonb_typeof(extra) = 'object' THEN extra ELSE '{}'::jsonb END) || ${marca}::jsonb WHERE id = ${contactoId} AND espacio_id = ${espacio}`
    return { motivo: null, previa }
  }, { maxWait: 15_000, timeout: 15_000 })
}

/** Meta aceptó: la fecha queda y se quita la reserva. */
async function confirmarReserva(contactoId: number, token: string): Promise<void> {
  const espacio = espacioActual()
  await prismaGlobal.$executeRaw`UPDATE crm_contactos SET extra = extra - '_encuestaReserva' WHERE id = ${contactoId} AND espacio_id = ${espacio} AND extra->>'_encuestaReserva' = ${token}`
}

/** No salió: vuelve la fecha de antes (o ninguna), solo si la reserva sigue siendo la de este envío. */
async function soltarReserva(contactoId: number, token: string, previa: string | null): Promise<void> {
  const espacio = espacioActual()
  if (previa) {
    await prismaGlobal.$executeRaw`UPDATE crm_contactos SET extra = jsonb_set(extra - '_encuestaReserva', '{_encuestaUltima}', to_jsonb(${previa}::text)) WHERE id = ${contactoId} AND espacio_id = ${espacio} AND extra->>'_encuestaReserva' = ${token}`
  } else {
    await prismaGlobal.$executeRaw`UPDATE crm_contactos SET extra = extra - '_encuestaUltima' - '_encuestaReserva' WHERE id = ${contactoId} AND espacio_id = ${espacio} AND extra->>'_encuestaReserva' = ${token}`
  }
}

interface DatosEnvio { linea: CrmLinea; telefono: string; flowId: string; token: string; cuerpo: string; data: Json }

/** El mensaje interactivo de tipo flow: solo cuerpo y el botón «Responder encuesta» (tablero 1, sin header ni footer). */
async function mandarFormulario(d: DatosEnvio): Promise<{ wamid: string; waIdCliente: string | null }> {
  const cred = await credDeLinea(d.linea)
  const r = await graph<{ messages?: { id?: string }[]; contacts?: { wa_id?: string }[] }>(`/${d.linea.phoneNumberId}/messages`, {
    cred, method: 'POST', timeoutMs: TIEMPO_META,
    body: {
      messaging_product: 'whatsapp', recipient_type: 'individual', to: d.telefono,
      type: 'interactive',
      interactive: {
        type: 'flow',
        body: { text: d.cuerpo },
        action: {
          name: 'flow',
          parameters: {
            flow_message_version: '3',
            flow_token: d.token,
            flow_id: d.flowId,
            flow_cta: BOTON_FORMULARIO,
            flow_action: 'navigate',
            mode: 'published',
            flow_action_payload: { screen: PANTALLA, data: d.data },
          },
        },
      },
    },
  })
  const wamid = r.messages?.[0]?.id
  if (!wamid) throw new ErrorEncuesta('Meta no devolvió el id del mensaje')
  return { wamid, waIdCliente: telDigitos(r.contacts?.[0]?.wa_id) }
}

/** ¿El error de Meta habla del formulario? (vencido, retirado o de otra cuenta): se asegura de nuevo y se reintenta. */
const esDelFormulario = (e: unknown) => e instanceof ErrorMeta && /flow/i.test(`${e.textoMeta} ${e.message}`)

/**
 * Lo que pide la pantalla al finalizar (evento `star` con `encuesta: true`). Nunca lanza por un motivo de negocio:
 * si no puede salir, guarda el evento «La encuesta no salió: {motivo}.» (fallido, no cuenta en Informes ni gasta los
 * días). Si puede, guarda «Encuesta enviada por WhatsApp» y lo manda a Meta en segundo plano: el evento lleva el wamid y
 * su estado, y si Meta no lo acepta pasa a «La encuesta no salió: …». `cid`: el de la pantalla (no se guarda dos veces).
 */
export async function enviarEncuesta(convId: number, autorId: string | null, cid: string | null = null): Promise<CrmMensaje> {
  if (cid) {
    const ya = await prisma.crmMensaje.findFirst({ where: { conversacionId: convId, tipo: 'ev', datos: { path: ['cid'], equals: cid } } })
    if (ya) return ya
  }
  await migrarUltimas().catch(e => logger.warn(`[CRM encuesta] migración de encuestas de antes: ${(e as Error)?.message ?? e}`))
  const c = await prisma.crmConversacion.findUnique({ where: { id: convId }, include: { contacto: true, linea: true } })
  if (!c) throw new AppError('Esa conversación ya no existe. Recarga la bandeja.', 404)
  const cfg = await cfgEncuesta()
  const usuarios = await usuariosCrm()
  const asesor = c.asignadoId ? usuarios.find(u => u.id === c.asignadoId)?.nombre ?? null : null
  const ahora = new Date()
  const encuesta: Json = {
    v: 2, token: null, asesorId: c.asignadoId, asesor, equipo: equipoDeConv(c), lineaId: c.lineaId,
    flowId: null, respondida: null, csatId: null,
  }
  const base: Json = { ev: 'star', ...(cid ? { cid } : {}) }

  const noSale = async (motivo: string) => {
    const m = await prisma.crmMensaje.create({
      data: { conversacionId: convId, tipo: 'ev', autorId, estado: 'fallido', error: motivo.slice(0, 1000), datos: json({ ...base, t: textoNoSalio(motivo), encuesta: { ...encuesta, fallo: minuscula(motivo) } }) },
    })
    emitirMsg(convId, m, autorId)
    logger.info(`[CRM encuesta] conversación ${convId}: no sale (${motivo})`)
    return m
  }

  const motivo = await puedeEnviar(c, cfg, ahora.getTime())
  if (motivo) return noSale(motivo)
  const token = nuevoToken(convId)
  const reserva = await reservar(c.contactoId, token, cfg.dias, ahora)
  if (reserva.motivo) return noSale(reserva.motivo)

  const ev = await prisma.crmMensaje.create({
    data: { conversacionId: convId, tipo: 'ev', autorId, estado: 'enviando', datos: json({ ...base, t: TEXTO_ENVIADA, encuesta: { ...encuesta, token } }) },
  })
  emitirMsg(convId, ev, autorId)
  emitirCrm({ tipo: 'encuestas' }, autorId)
  void salir(ev, c, cfg, token, reserva.previa, asesor, autorId).catch(e => logger.error(`[CRM encuesta] envío ${ev.id}: ${(e as Error)?.message ?? e}`))
  return ev
}

/** El envío a Meta, después de responderle a la pantalla. Deja el evento enviado o «no salió» y avisa en vivo. */
async function salir(ev: CrmMensaje, c: ConvEncuesta, cfg: CfgEncuesta, token: string, previa: string | null, asesor: string | null, autorId: string | null): Promise<void> {
  const linea = c.linea!
  const datos = obj(ev.datos)
  // 1. Lo de Meta: el formulario y el mensaje. Si algo falla aquí, no salió: se suelta la reserva y el evento lo dice.
  let enviado: { wamid: string; waIdCliente: string | null; flowId: string }
  try {
    let reg = await asegurarFormulario(linea.wabaId)
    if (reg.estado !== 'listo' || !reg.id) throw new ErrorEncuesta(`el formulario no está listo en WhatsApp (${reg.error ?? 'Meta no lo aceptó'})`)
    const vars = await variablesDe(c.contacto.nombre, asesor)
    const envio = (flowId: string): DatosEnvio => ({
      linea, telefono: c.contacto.telefono!, flowId, token,
      cuerpo: rellenar(cfg.msg, vars).slice(0, 1024),
      data: {
        pregunta_asesor: preguntaAsesor(cfg.p1, vars),
        pregunta_recomienda: rellenar(cfg.p2, vars).slice(0, 300),
        pedir_comentario: cfg.comentario,
      },
    })
    // La primera vez por cuenta, preparar el formulario puede tardar: la ventana de 24 h se mira otra vez justo antes de
    // mandar, para no intentar nunca con la ventana cerrada.
    const mandar = async (flowId: string) => {
      if (!(await ventanaAbierta(c.contactoId, c.lineaId))) throw new ErrorEncuesta(MOTIVO_VENTANA)
      return { ...(await mandarFormulario(envio(flowId))), flowId }
    }
    try {
      enviado = await mandar(reg.id)
    } catch (e) {
      if (!esDelFormulario(e)) throw e
      // Meta dice que el formulario no sirve (retirado, de otra cuenta…): se revisa, se rehace si hace falta y una vez más.
      logger.warn(`[CRM encuesta] Meta rechazó el formulario ${reg.id} al enviar: ${(e as Error).message}`)
      reg = await asegurarFormulario(linea.wabaId, { vencido: true })
      if (reg.estado !== 'listo' || !reg.id) throw new ErrorEncuesta(`el formulario no está listo en WhatsApp (${reg.error ?? 'Meta no lo aceptó'})`)
      enviado = await mandar(reg.id)
    }
  } catch (e) {
    const motivo = e instanceof ErrorEncuesta || e instanceof AppError ? e.message : `no se pudo hablar con Meta: ${(e as Error)?.message ?? e}`
    logger.warn(`[CRM encuesta] conversación ${c.id}: la encuesta no salió (${motivo})`)
    await soltarReserva(c.contactoId, token, previa).catch(x => logger.error(`[CRM encuesta] no se pudo soltar la reserva del contacto ${c.contactoId}: ${(x as Error)?.message ?? x}`))
    const f = await prisma.crmMensaje.update({
      where: { id: ev.id },
      data: { estado: 'fallido', error: motivo.slice(0, 1000), datos: json({ ...datos, t: textoNoSalio(motivo), encuesta: { ...obj(datos.encuesta), fallo: minuscula(motivo) } }) },
    })
    emitirMsg(c.id, f, autorId)
    await emitirDelContacto(c.contactoId, autorId)
    emitirCrm({ tipo: 'encuestas' }, autorId)
    return
  }

  // 2. Meta lo aceptó: al cliente ya le llegó. Desde aquí nada suelta la reserva ni dice «no salió»; si la base falla,
  // se reintenta y, si no, queda en el registro.
  const { wamid, waIdCliente, flowId } = enviado
  const enc = { ...obj(datos.encuesta), flowId }
  const f = await conReintento(`guardar el envío ${wamid} en el evento ${ev.id}`, () =>
    prisma.crmMensaje.update({ where: { id: ev.id }, data: { waId: wamid, estado: 'enviado', error: null, datos: json({ ...datos, encuesta: enc }) } }))
  await conReintento(`confirmar la reserva del contacto ${c.contactoId}`, () => confirmarReserva(c.contactoId, token))
  await conReintento(`marcar encuestada la conversación ${c.id}`, () => prisma.crmConversacion.update({ where: { id: c.id }, data: { encuestada: true } }))
  if (f) emitirMsg(c.id, f, autorId)
  if (waIdCliente && waIdCliente !== c.contacto.telefono) {
    await prisma.crmContacto.update({ where: { id: c.contactoId }, data: { telefono: waIdCliente } })
      .catch(e => logger.warn(`[CRM encuesta] no se pudo guardar el wa_id ${waIdCliente} del contacto ${c.contactoId}: ${(e as Error).message}`))
  }
  await emitirDelContacto(c.contactoId, autorId).catch(e => logger.warn(`[CRM encuesta] aviso en vivo del contacto ${c.contactoId}: ${(e as Error)?.message ?? e}`))
  emitirCrm({ tipo: 'encuestas' }, autorId)
  logger.info(`[CRM encuesta] conversación ${c.id}: encuesta enviada (${wamid})`)
}

/** Tres intentos (al momento, a los 0,5 s y a los 2 s); si no, queda en el registro y devuelve null. */
async function conReintento<T>(que: string, f: () => Promise<T>): Promise<T | null> {
  for (const espera of [0, 500, 2000]) {
    if (espera) await new Promise(r => setTimeout(r, espera))
    try { return await f() } catch (e) { logger.error(`[CRM encuesta] no se pudo ${que}: ${(e as Error)?.message ?? e}`) }
  }
  return null
}

/**
 * Meta avisó después que la encuesta no llegó (estado `failed` del wamid, entrantes.ts procesarEstado): el evento dice
 * «La encuesta no salió: {error}.», y se recalculan la última encuesta del contacto y `encuestada`.
 */
export async function encuestaNoLlego(f: CrmMensaje): Promise<void> {
  const d = obj(f.datos)
  const enc = obj(d.encuesta)
  if (d.ev !== 'star' || enc.v !== 2 || enc.respondida) return
  const motivo = minuscula(f.error || 'Meta no la entregó')
  const nuevo = await prisma.crmMensaje.update({ where: { id: f.id }, data: { datos: json({ ...d, t: textoNoSalio(motivo), encuesta: { ...enc, fallo: motivo } }) } })
  const conv = await prisma.crmConversacion.findUnique({ where: { id: f.conversacionId }, select: { id: true, contactoId: true } })
  emitirMsg(f.conversacionId, nuevo)
  if (!conv) return
  await recalcularDespuesDeFallo(conv)
  logger.info(`[CRM encuesta] la encuesta ${f.id} no llegó: ${motivo}`)
}

/** Las encuestas que sí cuentan: eventos `star` que no quedaron fallidos (también las de texto de antes). */
const ENCUESTAS_BUENAS = { tipo: 'ev', datos: { path: ['ev'], equals: 'star' }, OR: [{ estado: null }, { estado: { not: 'fallido' } }] } satisfies Prisma.CrmMensajeWhereInput

/**
 * La última encuesta del contacto vuelve a ser la más nueva que sí salió (o ninguna), sin reserva; y el `encuestada` de la
 * conversación, si en ella queda otra que salió. Avisa en vivo (conv de las conversaciones del contacto y encuestas).
 */
async function recalcularDespuesDeFallo(conv: { id: number; contactoId: number }): Promise<void> {
  const [ultima, otraAqui] = await Promise.all([
    prisma.crmMensaje.findFirst({ where: { ...ENCUESTAS_BUENAS, conversacion: { contactoId: conv.contactoId } }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    prisma.crmMensaje.count({ where: { ...ENCUESTAS_BUENAS, conversacionId: conv.id } }),
  ])
  await ponerUltima(conv.contactoId, ultima?.createdAt ?? null)
  await prisma.crmConversacion.update({ where: { id: conv.id }, data: { encuestada: otraAqui > 0 } })
  await emitirDelContacto(conv.contactoId, null)
  emitirCrm({ tipo: 'encuestas' })
}

/** Deja `_encuestaUltima` del contacto en esa fecha (o la quita) y quita `_encuestaReserva`, sin tocar el resto de extra. */
async function ponerUltima(contactoId: number, fecha: Date | null): Promise<void> {
  const espacio = espacioActual()
  if (fecha) {
    await prismaGlobal.$executeRaw`UPDATE crm_contactos SET extra = jsonb_set((CASE WHEN jsonb_typeof(extra) = 'object' THEN extra ELSE '{}'::jsonb END) - '_encuestaReserva', '{_encuestaUltima}', to_jsonb(${fecha.toISOString()}::text)) WHERE id = ${contactoId} AND espacio_id = ${espacio}`
  } else {
    await prismaGlobal.$executeRaw`UPDATE crm_contactos SET extra = extra - '_encuestaUltima' - '_encuestaReserva' WHERE id = ${contactoId} AND espacio_id = ${espacio}`
  }
}

/** Una encuesta que sigue «enviando» o una reserva sin terminar después de esto quedó colgada (el API se reinició). */
const COLGADA_MIN = 10
const MOTIVO_COLGADA = 'el servidor se reinició antes de enviarla'

/**
 * Cada minuto (procesos.ts): si el API se reinició mientras una encuesta salía (salir() corre en segundo plano), el
 * evento queda «enviando» y la persona con los días reservados sin haber recibido nada. Pasados 10 minutos:
 * - el evento sin wamid pasa a «La encuesta no salió: el servidor se reinició antes de enviarla.» (fallido) y se
 *   recalcula la última encuesta del contacto;
 * - una reserva de un contacto que no terminó (sin evento, o con su evento ya resuelto) se resuelve igual: la última
 *   encuesta vuelve a ser la más nueva que salió.
 * Devuelve cuántas arregló.
 */
export async function barrerEncuestasColgadas(minutos = COLGADA_MIN): Promise<number> {
  const limite = new Date(Date.now() - minutos * 60_000)
  let n = 0
  const colgados = await prisma.crmMensaje.findMany({
    where: { tipo: 'ev', estado: 'enviando', waId: null, createdAt: { lt: limite }, datos: { path: ['encuesta', 'v'], equals: 2 } },
    select: { id: true, conversacionId: true, datos: true }, orderBy: { createdAt: 'asc' }, take: 100,
  })
  for (const x of colgados) {
    const d = obj(x.datos)
    const r = await prisma.crmMensaje.updateMany({
      where: { id: x.id, estado: 'enviando', waId: null },
      data: { estado: 'fallido', error: MOTIVO_COLGADA, datos: json({ ...d, t: textoNoSalio(MOTIVO_COLGADA), encuesta: { ...obj(d.encuesta), fallo: MOTIVO_COLGADA } }) },
    })
    if (!r.count) continue
    n++
    const f = await prisma.crmMensaje.findUnique({ where: { id: x.id } })
    if (f) emitirMsg(x.conversacionId, f, null)
    const conv = await prisma.crmConversacion.findUnique({ where: { id: x.conversacionId }, select: { id: true, contactoId: true } })
    if (conv) await recalcularDespuesDeFallo(conv)
    logger.warn(`[CRM encuesta] la encuesta ${x.id} se quedó enviando (el API se reinició): queda como no salió`)
  }
  // Reservas sin terminar: `_encuestaUltima` es la hora de la reserva.
  const espacio = espacioActual()
  const reservas = await prismaGlobal.$queryRaw<{ id: number; token: string }[]>`
    SELECT id, extra->>'_encuestaReserva' AS token FROM crm_contactos
    WHERE espacio_id = ${espacio} AND jsonb_typeof(extra) = 'object' AND extra ? '_encuestaReserva'
      AND COALESCE(NULLIF(extra->>'_encuestaUltima', ''), '1970-01-01')::timestamptz < ${limite}
    LIMIT 100`
  for (const k of reservas) {
    const ev = await prisma.crmMensaje.findFirst({ where: { tipo: 'ev', datos: { path: ['encuesta', 'token'], equals: k.token } }, select: { estado: true } })
    if (ev?.estado === 'enviando') continue // la toma el paso de arriba en la próxima vuelta
    const ultima = await prisma.crmMensaje.findFirst({ where: { ...ENCUESTAS_BUENAS, conversacion: { contactoId: k.id } }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } })
    await ponerUltima(k.id, ultima?.createdAt ?? null)
    n++
    await emitirDelContacto(k.id, null)
    logger.warn(`[CRM encuesta] la reserva de días del contacto ${k.id} no terminó (el API se reinició): se soltó`)
  }
  return n
}

// ─── Respuesta (nfm_reply) ───────────────────────────────────────────────────

/** Lo que trae el webhook de la respuesta del formulario (entrantes.ts WaMensaje). */
export interface MensajeFormulario {
  id: string
  interactive?: { type?: string; nfm_reply?: { name?: string; body?: string; response_json?: string } }
  context?: { from?: string; id?: string }
}

/** 1 a 5 / 0 a 10, como número o texto («5»); null si no vale. */
function entero(v: unknown, min: number, max: number): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\s*\d{1,3}\s*$/.test(v) ? Number(v) : NaN
  return Number.isInteger(n) && n >= min && n <= max ? n : null
}

const TOPE_COMENTARIO = 600
/** El comentario limpio (sin caracteres de control, máximo 600); vacío o sin resolver = sin comentario. */
function comentarioLimpio(v: unknown): string {
  const t = limpiarTexto(typeof v === 'number' ? String(v) : v, TOPE_COMENTARIO)
  return /^\$\{form\.\w+\}$/.test(t) ? '' : t
}

interface Avisados { personas: { id: string; nombre: string }[]; equipo: string | null }

/**
 * A quién se avisa una calificación baja: los líderes del equipo de la encuesta que ven hoy la conversación (si pasó a
 * otro equipo, el líder de antes ya no la abre ni la ve en Informes); si no queda ninguno, los administradores sin
 * equipo (no el visitante), que ven todo. Al asesor calificado no se le avisa por ser el asesor (sí si es el líder).
 */
async function destinatarios(equipo: string, asesorId: string | null, conv: { equipo: string | null; asignadoId: string | null; soloLider: boolean }): Promise<Avisados> {
  const [eqs, usuarios] = await Promise.all([leerEquipos(), usuariosCrm()])
  const activos = new Map(usuarios.map(u => [u.id, u]))
  const lideres = (eqs.lideres[equipo] ?? []).map(id => activos.get(id))
    .filter((u): u is NonNullable<typeof u> => Boolean(u) && veConv(alcanceDePersona(u!.id, u!.rol, eqs), conv))
  if (lideres.length) return { personas: lideres.map(u => ({ id: u.id, nombre: u.nombre })), equipo }
  const admins = usuarios.filter(u => u.rol === 'ADMIN' && u.id !== asesorId && alcanceDePersona(u.id, u.rol, eqs).todo)
  return { personas: admins.map(u => ({ id: u.id, nombre: u.nombre })), equipo: null }
}

/**
 * La respuesta del formulario (`interactive.nfm_reply`). false si no es de la encuesta (otro formulario): sigue como
 * mensaje normal. Si es de la encuesta, true siempre: no abre ni reabre nada y no corre flujos, agente, reglas ni
 * reparto. Corre dentro de la fila del contacto (entrantes.ts enFila) y después del chequeo del wamid repetido.
 */
export async function respuestaFormulario(linea: CrmLinea, m: MensajeFormulario, tel: string, cuando: Date): Promise<boolean> {
  let r: Json
  try { r = obj(JSON.parse(String(m.interactive?.nfm_reply?.response_json ?? ''))) } catch { return false }
  const token = txt(r.flow_token)
  if (!token.startsWith('enc_')) return false

  const mt = token.match(TOKEN)
  if (!mt) { logger.info(`[CRM encuesta] respuesta con un token que no es válido (${token.slice(0, 40)}): se ignora`); return true }
  const incluir = { conversacion: { include: { contacto: true } } } as const
  const porToken: Prisma.CrmMensajeWhereInput = { tipo: 'ev', datos: { path: ['encuesta', 'token'], equals: token } }
  let ev = await prisma.crmMensaje.findFirst({ where: { ...porToken, conversacionId: Number(mt[1]) }, include: incluir })
  if (!ev) {
    // La conversación se unió a otra: el evento viajó con sus mensajes.
    const k = await prisma.crmContacto.findFirst({ where: { telefono: tel }, select: { id: true } })
    if (k) ev = await prisma.crmMensaje.findFirst({ where: { ...porToken, conversacion: { contactoId: k.id } }, include: incluir })
  }
  if (!ev || ev.conversacion.contacto.telefono !== tel) {
    logger.info(`[CRM encuesta] respuesta ${m.id} con el token ${token}: no hay una encuesta de ese número, se ignora`)
    return true
  }
  // La respuesta llega por la línea que mandó el formulario (el cliente responde en ese chat): por otra, no es de esta encuesta.
  const lineaEnc = txt(obj(obj(ev.datos).encuesta).lineaId)
  if (lineaEnc && lineaEnc !== linea.id) {
    logger.warn(`[CRM encuesta] respuesta ${m.id} con el token ${token} por la línea ${linea.id}, y la encuesta salió por ${lineaEnc}: se ignora`)
    return true
  }
  // context.id es el wamid del mensaje que abrió el formulario. No se exige (si Meta lo escribiera distinto se perderían
  // respuestas buenas), pero queda en el registro.
  if (m.context?.id && ev.waId && m.context.id !== ev.waId) logger.warn(`[CRM encuesta] respuesta ${m.id}: context.id ${m.context.id} no es el wamid ${ev.waId} de la encuesta`)
  const aten = entero(r.atencion, 1, 5)
  const nps = entero(r.recomienda, 0, 10)
  if (aten === null || nps === null) {
    logger.warn(`[CRM encuesta] respuesta ${m.id} con datos que no valen (atención ${String(r.atencion)}, recomienda ${String(r.recomienda)}): se ignora`)
    return true
  }
  const com = comentarioLimpio(r.comentario)
  const enc0 = obj(obj(ev.datos).encuesta)
  if (enc0.respondida) { logger.info(`[CRM encuesta] la encuesta ${ev.id} ya tenía respuesta: se ignora ${m.id}`); return true }

  const cfg = await cfgEncuesta()
  const equipo = txt(enc0.equipo) || equipoDeConv(ev.conversacion)
  const asesorId = txt(enc0.asesorId) || null
  const asesor = txt(enc0.asesor) || null
  const aviso: Avisados = aten <= 2 && cfg.aviso ? await destinatarios(equipo, asesorId, ev.conversacion) : { personas: [], equipo: null }
  const csatDatos = {
    csat: {
      asesor, asesorId, equipo, aten, nps, com, enc: ev.id, token, baja: aten <= 2,
      avisados: aviso.personas.map(p => p.nombre), avisoEquipo: aviso.personas.length ? aviso.equipo : null, via: 'formulario',
    },
  }

  const espacio = espacioActual()
  let hecho: { csat: CrmMensaje; ev: CrmMensaje; convId: number } | null
  try {
    hecho = await prismaGlobal.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM crm_mensajes WHERE id = ${ev!.id} AND espacio_id = ${espacio} FOR UPDATE`
      const fila = await tx.crmMensaje.findFirst({ where: { id: ev!.id, espacioId: espacio } })
      if (!fila) return null
      const d = obj(fila.datos)
      const enc = obj(d.encuesta)
      if (enc.respondida) return null // la primera respuesta es la que cuenta
      const csat = await tx.crmMensaje.create({ data: { espacioId: espacio, conversacionId: fila.conversacionId, tipo: 'csat', autorId: null, waId: m.id, createdAt: cuando, datos: json(csatDatos) } })
      const evNuevo = await tx.crmMensaje.update({ where: { id: fila.id }, data: { datos: json({ ...d, encuesta: { ...enc, respondida: cuando.toISOString(), csatId: csat.id } }) } })
      // La respuesta abre la ventana de Meta. Nada más cambia: ni el estado, ni la espera, ni los no leídos, ni el asesor.
      // Si la conversación de la encuesta es de otra línea (se unió a otra), su ventana no se toca: la de Meta es por línea.
      const conv = await tx.crmConversacion.findFirst({ where: { id: fila.conversacionId, espacioId: espacio }, select: { ultimoEntranteAt: true, lineaId: true } })
      const masTarde = conv?.lineaId === linea.id && (!conv.ultimoEntranteAt || cuando > conv.ultimoEntranteAt)
      await tx.crmConversacion.update({ where: { id: fila.conversacionId }, data: { encuestada: true, ...(masTarde ? { ultimoEntranteAt: cuando } : {}) } })
      return { csat, ev: evNuevo, convId: fila.conversacionId }
    }, { maxWait: 15_000, timeout: 15_000 })
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return true // ya estaba (Meta reintentó)
    throw e
  }
  if (!hecho) { logger.info(`[CRM encuesta] la encuesta ${ev.id} ya tenía respuesta: se ignora ${m.id}`); return true }

  emitirMsg(hecho.convId, hecho.csat)
  emitirMsg(hecho.convId, hecho.ev)
  await emitirConv(hecho.convId)
  emitirCrm({ tipo: 'encuestas' })
  logger.info(`[CRM encuesta] respuesta de la conversación ${hecho.convId}: atención ${aten}, recomienda ${nps}`)

  // Calificación baja: a la campana de cada líder (o administrador sin equipo), con el enlace a la conversación.
  if (aviso.personas.length) {
    const k = ev.conversacion.contacto
    const quien = txt(k.nombre) || telVisible(k.telefono) || 'Un contacto'
    const texto = `Calificación baja: ${quien} le dio ${aten} de 5 a la atención de ${asesor || 'su asesor'}.`
    for (const p of aviso.personas) {
      await avisar({ userId: p.id, tipo: 'CAMBIOS_PEDIDOS', titulo: 'Calificación baja', texto, url: `/?conv=${hecho.convId}&aviso=encuesta` })
    }
  }

  // El gracias: por texto (la ventana está abierta), si no está vacío. No se guarda en la conversación (tablero 4).
  const vars = await variablesDe(ev.conversacion.contacto.nombre, asesor)
  const gracias = rellenar(cfg.gracias, vars).slice(0, 4096)
  if (gracias) {
    try {
      await graph(`/${linea.phoneNumberId}/messages`, {
        cred: await credDeLinea(linea), method: 'POST', timeoutMs: TIEMPO_META,
        body: { messaging_product: 'whatsapp', recipient_type: 'individual', to: tel, type: 'text', text: { body: gracias, preview_url: false } },
      })
    } catch (e) {
      logger.warn(`[CRM encuesta] el gracias de la conversación ${hecho.convId} no salió: ${(e as Error)?.message ?? e}`)
    }
  }
  return true
}

// ─── Informes › Encuestas ────────────────────────────────────────────────────

export interface FiltrosInforme { dias: number; equipo: string; asesor: string; respuestas: 'todas' | 'bajas' | 'comentario'; limite: number }

/** `lider`: la calificación baja se le avisó a un líder de equipo (csat.avisados con avisoEquipo). */
interface Respuesta { id: string; t: Date; aten: number | null; nps: number | null; com: string; lider: boolean }
interface Fila {
  /** Una encuesta enviada en el periodo (false: una respuesta de antes sin su envío enlazado, cuenta por su fecha). */
  enviada: boolean
  conv: { id: number; equipo: string | null; asignadoId: string | null; soloLider: boolean }
  cliente: string
  asesorId: string | null
  asesor: string | null
  equipo: string
  resp: Respuesta | null
}

const promedio = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : null)
const pct = (n: number, de: number) => (de ? Math.round((n / de) * 100) : null)
/** NPS = % promotores (9 y 10) − % detractores (0 a 6), como informes.controller. */
const npsDe = (xs: number[]) => (xs.length ? Math.round(((xs.filter(x => x >= 9).length - xs.filter(x => x <= 6).length) / xs.length) * 100) : null)
const notaCsat = (v: unknown, min: number, max: number) => {
  if (v === null || v === undefined || v === '') return null
  const x = Number(v)
  return Number.isFinite(x) && x >= min && x <= max ? x : null
}

/**
 * GET /crm/encuestas: una fila por encuesta enviada en el periodo (eventos `star` no fallidos, también los de texto de
 * antes) con su respuesta si la tiene, según lo que ve cada quien: todo (administrador sin equipo), las de las
 * conversaciones que ve más las que lo califican (quien lidera) o solo las que lo califican (los demás).
 */
export async function informeEncuestas(a: Alcance, eqs: EquiposNorm, f: FiltrosInforme) {
  const hasta = new Date()
  const desde = new Date(hasta.getTime() - f.dias * DIA)
  const yo = a.userId
  const selConv = { select: { id: true, equipo: true, asignadoId: true, soloLider: true, contacto: { select: { nombre: true, telefono: true } } } } as const
  const [usuarios, cfg, eventos, viejos] = await Promise.all([
    usuariosCrm(),
    cfgEncuesta(),
    prisma.crmMensaje.findMany({
      where: { tipo: 'ev', createdAt: { gte: desde, lte: hasta }, datos: { path: ['ev'], equals: 'star' }, OR: [{ estado: null }, { estado: { not: 'fallido' } }] },
      select: { id: true, datos: true, autorId: true, createdAt: true, conversacion: selConv },
    }),
    // Las respuestas de antes (encuesta de texto): sin enlace a su envío, cuentan por su propia fecha.
    prisma.crmMensaje.findMany({
      where: { tipo: 'csat', autorId: null, createdAt: { gte: desde, lte: hasta } },
      select: { id: true, datos: true, createdAt: true, conversacion: selConv },
    }),
  ])
  const nombreDe = new Map(usuarios.map(u => [u.id, u.nombre]))
  const idDe = new Map(usuarios.map(u => [u.nombre.toLowerCase(), u.id]))
  const nombreContacto = (k: { nombre: string | null; telefono: string | null }) => txt(k.nombre) || telVisible(k.telefono) || 'Sin nombre'
  const convDe = (c: { id: number; equipo: string | null; asignadoId: string | null; soloLider: boolean }) => ({ id: c.id, equipo: c.equipo, asignadoId: c.asignadoId, soloLider: c.soloLider })

  const csatIds = eventos.map(e => txt(obj(obj(e.datos).encuesta).csatId)).filter(Boolean)
  const nuevos = csatIds.length ? await prisma.crmMensaje.findMany({ where: { id: { in: csatIds }, tipo: 'csat' }, select: { id: true, datos: true, createdAt: true } }) : []
  const csatPorId = new Map(nuevos.map(m => [m.id, m]))
  const respuestaDe = (m: { id: string; datos: unknown; createdAt: Date }): Respuesta => {
    const c = obj(obj(m.datos).csat)
    const lider = Array.isArray(c.avisados) && c.avisados.some(x => txt(x)) && Boolean(txt(c.avisoEquipo))
    return { id: m.id, t: m.createdAt, aten: notaCsat(c.aten, 1, 5), nps: notaCsat(c.nps, 0, 10), com: txt(c.com), lider }
  }

  const filas: Fila[] = []
  for (const e of eventos) {
    const enc = obj(obj(e.datos).encuesta)
    const conv = convDe(e.conversacion)
    if (enc.v === 2) {
      const csat = csatPorId.get(txt(enc.csatId))
      const asesorId = txt(enc.asesorId) || null
      filas.push({
        enviada: true, conv, cliente: nombreContacto(e.conversacion.contacto), asesorId,
        asesor: (asesorId ? nombreDe.get(asesorId) : null) ?? (txt(enc.asesor) || null),
        equipo: txt(enc.equipo) || equipoDeConv(conv), resp: csat ? respuestaDe(csat) : null,
      })
    } else {
      // Encuesta de texto de antes: el asesor es quien finalizó (una aproximación) y el equipo, el de la conversación.
      filas.push({ enviada: true, conv, cliente: nombreContacto(e.conversacion.contacto), asesorId: e.autorId, asesor: e.autorId ? nombreDe.get(e.autorId) ?? null : null, equipo: equipoDeConv(conv), resp: null })
    }
  }
  for (const m of viejos) {
    const c = obj(obj(m.datos).csat)
    if (c.enc) continue
    const conv = convDe(m.conversacion)
    const porNombre = txt(c.asesor) ? idDe.get(txt(c.asesor).toLowerCase()) ?? null : null
    const asesorId = porNombre ?? conv.asignadoId
    filas.push({ enviada: false, conv, cliente: nombreContacto(m.conversacion.contacto), asesorId, asesor: txt(c.asesor) || (asesorId ? nombreDe.get(asesorId) ?? null : null), equipo: equipoDeConv(conv), resp: respuestaDe(m) })
  }

  // Alcance.
  const vista: 'todo' | 'equipo' | 'propio' = a.todo ? 'todo' : a.lidera.length ? 'equipo' : 'propio'
  const mia = (x: Fila) => x.asesorId === yo && (!x.conv.soloLider || veConv(a, x.conv))
  const visibles = filas.filter(x => a.todo || (a.lidera.length && veConv(a, x.conv)) || mia(x))

  // Opciones de los filtros (antes de filtrar por equipo y asesor).
  const ordenEquipos = Object.keys(eqs.miembros)
  const propios = visibles.filter(x => x.asesorId === yo).map(x => x.equipo)
  const equiposSet = new Set(a.todo ? [...ordenEquipos, ...visibles.map(x => x.equipo)] : a.lidera.length ? [...a.lidera, ...propios] : [...a.equipos, ...propios])
  const equipos = [...equiposSet].sort((x, y) => {
    const ix = ordenEquipos.indexOf(x), iy = ordenEquipos.indexOf(y)
    return (ix < 0 ? 999 : ix) - (iy < 0 ? 999 : iy) || x.localeCompare(y, 'es')
  })
  const idsAsesores = a.todo ? [...new Set(visibles.map(x => x.asesorId).filter((x): x is string => Boolean(x)))] : a.lidera.length ? [...new Set([...genteQueLidera(a, eqs), yo])] : [yo]
  const nombreFila = new Map(visibles.filter(x => x.asesorId && x.asesor).map(x => [x.asesorId!, x.asesor!]))
  const asesores = idsAsesores.map(id => ({ id, nombre: nombreDe.get(id) ?? nombreFila.get(id) ?? 'Sin nombre' })).sort((x, y) => x.nombre.localeCompare(y.nombre, 'es'))

  // Filtros de periodo (ya), equipo y asesor: aplican a todo.
  const elegidas = visibles.filter(x => (!f.equipo || x.equipo === f.equipo) && (!f.asesor || x.asesorId === f.asesor))
  const respondidas = elegidas.filter(x => x.resp)
  const atenciones = respondidas.map(x => x.resp!.aten).filter((x): x is number => x != null)
  const recomienda = respondidas.map(x => x.resp!.nps).filter((x): x is number => x != null)
  const enviadas = elegidas.filter(x => x.enviada).length
  const kpis = {
    enviadas,
    respondidas: respondidas.length,
    pctRespondieron: enviadas ? Math.min(100, pct(respondidas.length, enviadas)!) : null,
    atencion: promedio(atenciones),
    nAtencion: atenciones.length,
    nps: npsDe(recomienda),
    promotores: pct(recomienda.filter(x => x >= 9).length, recomienda.length),
    detractores: pct(recomienda.filter(x => x <= 6).length, recomienda.length),
    bajas: atenciones.filter(x => x <= 2).length,
    // De las bajas, las que sí se le avisaron a un líder: «· se avisó al líder» solo sale si son todas.
    bajasLider: respondidas.filter(x => x.resp!.aten != null && x.resp!.aten <= 2 && x.resp!.lider).length,
  }

  const grupos = new Map<string, Fila[]>()
  for (const x of elegidas) if (x.asesorId) grupos.set(x.asesorId, [...(grupos.get(x.asesorId) ?? []), x])
  const porAsesor = [...grupos.entries()].map(([id, xs]) => {
    const r = xs.filter(x => x.resp)
    const at = r.map(x => x.resp!.aten).filter((x): x is number => x != null)
    const np = r.map(x => x.resp!.nps).filter((x): x is number => x != null)
    return { id, nombre: nombreDe.get(id) ?? xs.find(x => x.asesor)?.asesor ?? 'Sin nombre', enviadas: xs.filter(x => x.enviada).length, respondidas: r.length, atencion: promedio(at), nps: npsDe(np), bajas: at.filter(x => x <= 2).length }
  }).filter(p => p.enviadas > 0).sort((x, y) => y.enviadas - x.enviadas || x.nombre.localeCompare(y.nombre, 'es'))

  const porEstrellas: Record<string, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  for (const n of atenciones) porEstrellas[String(n)] = (porEstrellas[String(n)] ?? 0) + 1

  // La lista: el filtro de respuestas solo aplica aquí. De la más nueva a la más vieja.
  const lista = respondidas
    .filter(x => f.respuestas === 'bajas' ? x.resp!.aten != null && x.resp!.aten <= 2 : f.respuestas === 'comentario' ? Boolean(x.resp!.com) : true)
    .sort((x, y) => y.resp!.t.getTime() - x.resp!.t.getTime())
  const respuestas = lista.slice(0, f.limite).map(x => ({
    id: x.resp!.id, t: x.resp!.t.toISOString(), convId: veConv(a, x.conv) ? x.conv.id : null,
    cliente: x.cliente, asesor: x.asesor, asesorId: x.asesorId, equipo: x.equipo,
    aten: x.resp!.aten, nps: x.resp!.nps, com: x.resp!.com,
  }))

  return {
    desde: desde.toISOString(), hasta: hasta.toISOString(), dias: f.dias, vista, aviso: cfg.aviso,
    opciones: { equipos, asesores },
    kpis, porAsesor, porEstrellas, respuestas, totalRespuestas: lista.length,
  }
}

/**
 * Una encuesta de texto de antes (la manda una pestaña que no se recargó desde el despliegue, o el finalizar de un canal
 * que no es WhatsApp): también cuenta para los días sin repetir de la persona. Lo llama la ruta cuando el evento `star`
 * de esa encuesta quedó guardado. Si hay un formulario saliendo (reserva), no se toca: ese envío decide la fecha.
 */
export function contarEncuestaDeTexto(espacio: string, convId: number): Promise<void> {
  return enEspacio(espacio, async () => {
    const c = await prisma.crmConversacion.findUnique({ where: { id: convId }, select: { contactoId: true } })
    if (!c) return
    const ahora = new Date().toISOString()
    const n = await prismaGlobal.$executeRaw`
      UPDATE crm_contactos SET extra = jsonb_set(CASE WHEN jsonb_typeof(extra) = 'object' THEN extra ELSE '{}'::jsonb END, '{_encuestaUltima}', to_jsonb(${ahora}::text))
      WHERE id = ${c.contactoId} AND espacio_id = ${espacio} AND NOT (COALESCE(extra, '{}'::jsonb) ? '_encuestaReserva')`
    if (n) await emitirDelContacto(c.contactoId, null)
  })
}

/** Para los procesos que corren fuera de una petición (el enganche de Ajustes): dentro del espacio dado. */
export function prepararFormulariosEn(espacio: string, op: OpcionesFormulario = {}): Promise<void> {
  return enEspacio(espacio, async () => {
    if (!(await cfgEncuesta()).on) return
    await prepararFormularios(op)
  })
}
