import type { CrmLinea, Prisma } from '@prisma/client'
import { prisma } from './bd'
import { credDeLinea } from './credenciales'
import { graph } from './whatsapp'
import { aMinutos, festivosCO } from './reglas'
import { leerAjuste } from './ajustes'
import { ValidationError } from '../../utils/errors'

/**
 * Ajustes de llamadas por WhatsApp de una línea (Calling API de Meta, «Configure call settings»):
 * GET/POST /<PHONE_NUMBER_ID>/settings con el objeto `calling`. Lo que se guarda vive en Meta; en la línea
 * (`ajustes.llamadasMeta`) queda la última copia para pintar rápido y saber si están activas.
 * Meta: el timbre antes del buzón va de 0 a 30 s; el buzón necesita un saludo subido como audio/ogg (Opus),
 * menos de 1 minuto, con use_case=call_voicemail_announcement. call_hours reemplaza todo lo anterior al guardarse.
 */
type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})
const DIAS_META = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']

export interface AjustesLlamadas {
  activas: boolean
  /** call_icon_visibility: DEFAULT (se ve el botón) o DISABLE_ALL. */
  boton: boolean
  /** callback_permission_status: al llamar, WhatsApp le pide al cliente permiso para devolverle la llamada. */
  devolver: boolean
  /** Horario de llamadas: el mismo de atención del CRM o uno propio (filas [día, desde, hasta, abierto]). */
  horario: 'atencion' | 'propio'
  horarioPropio?: unknown[]
  buzon: boolean
  /** Segundos que timbra antes del buzón (0 a 30). */
  timbre: number
  /** Id del saludo del buzón ya subido a Meta. */
  saludoMediaId?: string
  /** Restricciones que Meta tenga puestas (p. ej. por baja tasa de contestadas). */
  restricciones?: { tipo: string; motivo: string; vence: number }[]
  sincronizado?: string
}

const POR_DEFECTO: AjustesLlamadas = { activas: false, boton: true, devolver: true, horario: 'atencion', buzon: false, timbre: 20 }

/** Las filas del horario del CRM → weekly_operating_hours de Meta (HHMM). Una franja que pasa la medianoche se parte en dos. */
function semanaMeta(filas: unknown[]): { day_of_week: string; open_time: string; close_time: string }[] {
  const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}${String(m % 60).padStart(2, '0')}`
  const out: { day_of_week: string; open_time: string; close_time: string }[] = []
  filas.slice(0, 7).forEach((f, i) => {
    if (!Array.isArray(f) || !f[3]) return
    const de = aMinutos(f[1]), a = aMinutos(f[2])
    if (de === null || a === null || de === a) return
    if (de < a) out.push({ day_of_week: DIAS_META[i], open_time: hhmm(de), close_time: hhmm(Math.min(a, 1439)) })
    else {
      out.push({ day_of_week: DIAS_META[i], open_time: hhmm(de), close_time: '2359' })
      if (a > 0) out.push({ day_of_week: DIAS_META[(i + 1) % 7], open_time: '0000', close_time: hhmm(a) })
    }
  })
  return out
}

/** Festivos de Colombia de este año y el siguiente, cerrados todo el día. */
function festivosMeta(): { date: string; start_time: string; end_time: string }[] {
  const y = new Date().getUTCFullYear(), hoy = new Date().toISOString().slice(0, 10)
  return [...festivosCO(y), ...festivosCO(y + 1)].filter(d => d >= hoy).map(date => ({ date, start_time: '0000', end_time: '2359' }))
}

/** Lo que Meta devuelve en `calling` → nuestros ajustes. */
function desdeMeta(c: Json, antes: AjustesLlamadas): AjustesLlamadas {
  const vm = obj(c.voicemail), audio = obj(obj(vm.audio).default)
  const lista = Array.isArray(obj(c.restrictions).restrictions_list) ? obj(c.restrictions).restrictions_list as Json[] : []
  return {
    ...antes,
    activas: c.status === 'ENABLED',
    boton: c.call_icon_visibility !== 'DISABLE_ALL',
    devolver: c.callback_permission_status !== 'DISABLED',
    buzon: vm.status === 'ENABLED',
    timbre: typeof audio.timeout_seconds === 'number' ? audio.timeout_seconds : antes.timbre,
    saludoMediaId: audio.announcement_media_id != null ? String(audio.announcement_media_id) : antes.saludoMediaId,
    restricciones: lista.map(r => ({ tipo: String(r.type ?? ''), motivo: String(r.reason ?? ''), vence: Number(r.expiration ?? 0) })),
    sincronizado: new Date().toISOString(),
  }
}

const guardados = (l: CrmLinea): AjustesLlamadas => ({ ...POR_DEFECTO, ...obj(obj(l.ajustes).llamadasMeta) as Partial<AjustesLlamadas> })

async function guardarEnLinea(l: CrmLinea, a: AjustesLlamadas): Promise<CrmLinea> {
  return prisma.crmLinea.update({ where: { id: l.id }, data: { ajustes: { ...obj(l.ajustes), llamadasMeta: a } as unknown as Prisma.InputJsonValue } })
}

/** Lee de Meta los ajustes de llamadas de la línea y deja la copia en la línea. */
export async function leerLlamadas(l: CrmLinea): Promise<{ linea: CrmLinea; ajustes: AjustesLlamadas }> {
  const cred = await credDeLinea(l)
  const r = await graph<Json>(`/${l.phoneNumberId}/settings`, { cred })
  const ajustes = desdeMeta(obj(r.calling), guardados(l))
  return { linea: await guardarEnLinea(l, ajustes), ajustes }
}

/** Cambia en Meta los ajustes de llamadas de la línea (solo lo que llega) y los vuelve a leer. */
export async function cambiarLlamadas(l: CrmLinea, cambios: Partial<AjustesLlamadas>): Promise<{ linea: CrmLinea; ajustes: AjustesLlamadas }> {
  const a: AjustesLlamadas = { ...guardados(l), ...cambios }
  if (!Number.isInteger(a.timbre) || a.timbre < 0 || a.timbre > 30) throw new ValidationError('Meta deja timbrar entre 0 y 30 segundos antes del buzón')
  if (a.buzon && !a.saludoMediaId) throw new ValidationError('Para el buzón de voz falta el saludo: grábalo o súbelo primero')
  const filas = a.horario === 'propio' && Array.isArray(a.horarioPropio) ? a.horarioPropio : (obj(await leerAjuste('cfg')).horario as unknown[] | undefined) ?? []
  const semana = semanaMeta(filas)
  const calling: Json = {
    status: a.activas ? 'ENABLED' : 'DISABLED',
    call_icon_visibility: a.boton ? 'DEFAULT' : 'DISABLE_ALL',
    callback_permission_status: a.devolver ? 'ENABLED' : 'DISABLED',
    // Sin filas guardadas no se restringe: Meta abriría las llamadas solo en las horas que se manden.
    call_hours: semana.length ? { status: 'ENABLED', timezone_id: 'America/Bogota', weekly_operating_hours: semana, holiday_schedule: festivosMeta() } : { status: 'DISABLED' },
    voicemail: a.buzon
      ? { status: 'ENABLED', triggers: ['REJECT', 'TIMEOUT'], audio: { default: { announcement_media_id: Number(a.saludoMediaId), timeout_seconds: a.timbre } } }
      : { status: 'DISABLED' },
  }
  const cred = await credDeLinea(l)
  await graph(`/${l.phoneNumberId}/settings`, { cred, method: 'POST', body: { calling } })
  const linea = await guardarEnLinea(l, a)
  return leerLlamadas(linea)
}

/**
 * Sube el saludo del buzón a Meta (audio/ogg Opus, menos de 1 minuto) con el uso exclusivo de buzón, que no
 * vence a los 30 días como los demás archivos. Devuelve el id que va en `saludoMediaId`.
 */
export async function subirSaludo(l: CrmLinea, audio: Buffer, nombre = 'saludo.ogg'): Promise<string> {
  const cred = await credDeLinea(l)
  const form = new FormData()
  form.set('messaging_product', 'whatsapp')
  form.set('use_case', 'call_voicemail_announcement')
  form.set('type', 'audio/ogg')
  form.set('file', new Blob([new Uint8Array(audio)], { type: 'audio/ogg' }), nombre)
  const r = await graph<Json>(`/${l.phoneNumberId}/media`, { cred, method: 'POST', body: form })
  if (!r.id) throw new ValidationError('Meta no devolvió el saludo subido')
  return String(r.id)
}

export { POR_DEFECTO as LLAMADAS_POR_DEFECTO }
