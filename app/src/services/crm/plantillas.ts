import { prisma } from './bd'
import { espacioActual } from './espacio'
import { AppError, NotFoundError, ValidationError } from '../../utils/errors'
import { leerAjuste, guardarAjuste } from './ajustes'
import { emitirCrm } from './tiempoReal'
import { archivoPermitido, baseGraph, graph, waConfigurado } from './whatsapp'
import { credDeWaba, type CredMeta } from './credenciales'

/**
 * Plantillas de WhatsApp del CRM (26-sep-2026): se leen y se crean en Meta,
 * en la cuenta (WABA) de cada línea conectada. Meta pide el nombre en
 * minúsculas y sin tildes («aviso_de_cuota»); el nombre con tildes que se
 * muestra en la pantalla se guarda en el ajuste `plantillasNombres`.
 * Cada plantilla es de unas líneas (20-oct, ajuste `plantillasLineas`, por slug): solo se envía desde ellas. Sin
 * entrada en el ajuste (las creadas directo en Meta o antes de esto) sirve en todas las líneas de su cuenta.
 */

type Json = Record<string, any>

export interface PlantillaMeta {
  id: string; name: string; language: string; status: string; category: string
  parameter_format?: string; components?: Json[]; rejected_reason?: string; waba: string
}

/** Forma de PLANTILLAS en la maqueta, más slug, idioma y las variables. */
export interface PlantillaFront {
  n: string; slug: string; c: string; e: 'ok' | 'w' | 'b' | 'g'; x: string; u: number; b: string
  idioma: string; id: string; waba: string; vars: string[]
  /** Encabezado con archivo («Con imagen» en el menú de plantillas del chat); sin él, no viene. */
  media?: 'imagen' | 'video' | 'gif' | 'documento'
  /** El archivo guardado del encabezado (plantillas con archivo creadas desde el CRM): sale con la plantilla. */
  mediaUrl?: string; mediaN?: string; mediaPeso?: number | null
  /** Las líneas donde se usa; null = todas las de su cuenta. */
  lineas: string[] | null
  /** Las cuentas de Meta donde existe (una plantilla de líneas de cuentas distintas vive en cada una). */
  wabas: string[]
  /** Estado tal cual lo da Meta, el motivo del rechazo y lo demás que el formulario necesita para editarla. */
  estadoMeta: string; motivo: string
  headTipo: '' | 'texto' | 'imagen' | 'video' | 'gif' | 'documento'; head: string; foot: string
  /** Vigencia de una de marketing, en segundos (null = la de Meta, 30 días). */
  vigencia: number | null
  btn: '' | 'Respuesta rápida' | 'Enlace' | 'Llamar'; btnTxt: string; btnUrl: string; btnTel: string
}

const MEDIA_CABECERA: Record<string, PlantillaFront['media']> = { IMAGE: 'imagen', VIDEO: 'video', GIF: 'gif', DOCUMENT: 'documento' }

/**
 * Encabezados con archivo (maqueta aprobada 21-oct, límites oficiales de Meta). El GIF es un MP4 corto que WhatsApp
 * repite sin sonido y Meta solo lo permite en marketing (API de Mensajes de marketing).
 */
const ARCHIVOS_CABECERA = {
  imagen: { formato: 'IMAGE', max: 5 * 1024 * 1024, tipos: /^image\/(jpeg|png)$/, nombre: 'la imagen', formatos: 'JPG o PNG' },
  video: { formato: 'VIDEO', max: 16 * 1024 * 1024, tipos: /^video\/mp4$/, nombre: 'el video', formatos: 'MP4' },
  gif: { formato: 'GIF', max: 3.5 * 1024 * 1024, tipos: /^video\/mp4$/, nombre: 'el GIF', formatos: 'MP4' },
  documento: { formato: 'DOCUMENT', max: 100 * 1024 * 1024, tipos: /^application\/pdf$/, nombre: 'el documento', formatos: 'PDF' },
} as const
type TipoArchivo = keyof typeof ARCHIVOS_CABECERA
const MB = (n: number) => `${String(n / 1024 / 1024).replace('.', ',')} MB`
const mayuscula = (t: string) => t[0].toUpperCase() + t.slice(1)
/** Vigencias que ofrece la pantalla para marketing (Meta acepta de 12 horas a 30 días). */
const VIGENCIAS = [43_200, 86_400, 604_800, 2_592_000]

async function vigenciasDePlantillas(): Promise<Record<string, number>> {
  const v = await leerAjuste<unknown>('plantillasVigencia')
  return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, number> : {}
}

const CATEGORIA: Record<string, string> = { MARKETING: 'Marketing', UTILITY: 'Utilidad', AUTHENTICATION: 'Autenticación' }
const MOTIVO: Record<string, string> = {
  ABUSIVE_CONTENT: 'Meta lo considera contenido abusivo',
  INVALID_FORMAT: 'el formato no es válido',
  PROMOTIONAL: 'es promocional y se pidió como utilidad',
  TAG_CONTENT_MISMATCH: 'el contenido no coincide con la categoría',
  INCORRECT_CATEGORY: 'la categoría no es la correcta',
  SCAM: 'Meta lo considera engañoso',
  NONE: 'Meta no dio el motivo',
}

/** «Aviso de cuota» → aviso_de_cuota (lo que acepta Meta). */
export function slugPlantilla(n: string): string {
  return String(n ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 512)
}

const humanizar = (slug: string) => {
  const t = slug.replace(/_+/g, ' ').trim()
  return t ? t[0].toUpperCase() + t.slice(1) : slug
}

/** Las variables {{nombre}} de un texto, en orden y sin repetir. */
export function variablesDe(texto: string | null | undefined): string[] {
  const vistas: string[] = []
  for (const m of String(texto ?? '').matchAll(/\{\{\s*([^{}\s]+)\s*\}\}/g)) if (!vistas.includes(m[1])) vistas.push(m[1])
  return vistas
}

// Caché corto por cuenta: enviar una plantilla no debe pedirle la lista a Meta cada vez.
const cache = new Map<string, { en: number; lista: PlantillaMeta[] }>()
export function olvidarPlantillas() { cache.clear() }

async function plantillasDeWaba(waba: string, fresco = false): Promise<PlantillaMeta[]> {
  const c = cache.get(waba)
  if (!fresco && c && Date.now() - c.en < 60_000) return c.lista
  const lista: PlantillaMeta[] = []
  let despues: string | undefined
  const cred = await credDeWaba(waba)
  for (let pagina = 0; pagina < 20; pagina++) {
    // El `paging.next` de Meta trae el token en la URL: se sigue el cursor con la ruta propia.
    const r = await graph<{ data?: Json[]; paging?: { cursors?: { after?: string }; next?: string } }>(`/${encodeURIComponent(waba)}/message_templates`, {
      cred,
      query: { fields: 'id,name,language,status,category,parameter_format,components,rejected_reason', limit: 100, after: despues },
    })
    for (const p of r.data ?? []) lista.push({ ...(p as PlantillaMeta), waba })
    despues = r.paging?.next ? r.paging?.cursors?.after : undefined
    if (!despues) break
  }
  cache.set(waba, { en: Date.now(), lista })
  return lista
}

async function nombresVisibles(): Promise<Record<string, string>> {
  return (await leerAjuste<Record<string, string>>('plantillasNombres')) ?? {}
}

/** La plantilla de esa cuenta que la pantalla nombra (por nombre visible o por el de Meta). */
export async function buscarPlantilla(waba: string, nombre: string, idioma?: string): Promise<PlantillaMeta | null> {
  const nombres = await nombresVisibles()
  const buscado = nombre.trim().toLowerCase()
  const slug = slugPlantilla(nombre)
  const elegir = (lista: PlantillaMeta[]) => {
    const c = lista.filter(p => p.name === nombre || p.name === slug || (nombres[p.name] ?? '').trim().toLowerCase() === buscado)
    if (!c.length) return null
    const rango = (p: PlantillaMeta) => (idioma && p.language === idioma ? 0 : 2) + (p.status === 'APPROVED' ? 0 : 1) + (p.language.startsWith('es') ? 0 : 0.5)
    return c.sort((a, b) => rango(a) - rango(b))[0]
  }
  return elegir(await plantillasDeWaba(waba)) ?? elegir(await plantillasDeWaba(waba, true))
}

/** Cuántas veces se envió cada plantilla desde el CRM (por nombre visible, sin contar las fallidas). */
async function usos(): Promise<Map<string, number>> {
  const filas = await prisma.$queryRaw<{ n: string; c: number }[]>`
    SELECT datos->>'plantilla' AS n, COUNT(*)::int AS c FROM crm_mensajes
    WHERE espacio_id = ${espacioActual()} AND datos->>'plantilla' IS NOT NULL AND COALESCE(estado, '') <> 'fallido'
    GROUP BY 1`
  return new Map(filas.map(f => [f.n, Number(f.c)]))
}

async function lineasDePlantillas(): Promise<Record<string, string[]>> {
  const v = await leerAjuste<unknown>('plantillasLineas')
  return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, string[]> : {}
}

/** ¿La plantilla se puede enviar desde esa línea? Sin líneas guardadas, sí (sirve en toda su cuenta). */
export async function plantillaEnLinea(slug: string, lineaId: string): Promise<boolean> {
  const l = (await lineasDePlantillas())[slug]
  return !Array.isArray(l) || !l.length || l.includes(lineaId)
}

const TIPO_BOTON: Record<string, PlantillaFront['btn']> = { QUICK_REPLY: 'Respuesta rápida', URL: 'Enlace', PHONE_NUMBER: 'Llamar' }

function aFront(p: PlantillaMeta, nombres: Record<string, string>, u: Map<string, number>, guardados: Record<string, { url: string; n?: string; peso?: number | null }> = {}, lineas: Record<string, string[]> = {}, vigencias: Record<string, number> = {}): PlantillaFront | null {
  const n = nombres[p.name] ?? humanizar(p.name)
  const cuerpo = String((p.components ?? []).find(c => String(c.type).toUpperCase() === 'BODY')?.text ?? '')
  let e: PlantillaFront['e']; let x: string
  switch (p.status) {
    case 'APPROVED': e = 'ok'; x = 'Aprobada'; break
    case 'PENDING': case 'IN_APPEAL': e = 'w'; x = 'En revisión en Meta'; break
    case 'REJECTED': e = 'b'; x = `Rechazada: ${MOTIVO[p.rejected_reason ?? 'NONE'] ?? String(p.rejected_reason).toLowerCase().replace(/_/g, ' ')}`; break
    case 'PAUSED': e = 'g'; x = 'Pausada'; break
    case 'DISABLED': e = 'b'; x = 'Deshabilitada por Meta'; break
    case 'LIMIT_EXCEEDED': e = 'g'; x = 'Pausada: se pasó el límite de Meta'; break
    default: return null // PENDING_DELETION, DELETED, ARCHIVED: ya no existe para la pantalla
  }
  const cabecera = (p.components ?? []).find(c => String(c.type).toUpperCase() === 'HEADER')
  const media = MEDIA_CABECERA[String(cabecera?.format ?? '').toUpperCase()]
  const pie = (p.components ?? []).find(c => String(c.type).toUpperCase() === 'FOOTER')
  const boton = ((p.components ?? []).find(c => String(c.type).toUpperCase() === 'BUTTONS')?.buttons ?? [])[0] as Json | undefined
  const formato = String(cabecera?.format ?? '').toUpperCase()
  return {
    n, slug: p.name, c: CATEGORIA[p.category] ?? p.category, e, x, u: u.get(n) ?? 0, b: cuerpo,
    idioma: p.language, id: p.id, waba: p.waba, vars: variablesDe(cuerpo),
    ...(media ? { media } : {}),
    ...(media && guardados[p.name]?.url ? { mediaUrl: guardados[p.name].url, mediaN: guardados[p.name].n ?? '', mediaPeso: guardados[p.name].peso ?? null } : {}),
    lineas: Array.isArray(lineas[p.name]) && lineas[p.name].length ? lineas[p.name] : null, wabas: [p.waba],
    estadoMeta: p.status, motivo: p.status === 'REJECTED' ? (MOTIVO[p.rejected_reason ?? 'NONE'] ?? String(p.rejected_reason).toLowerCase().replace(/_/g, ' ')) : '',
    headTipo: media ?? (formato === 'TEXT' ? 'texto' : ''), head: formato === 'TEXT' ? String(cabecera?.text ?? '') : '', foot: String(pie?.text ?? ''),
    vigencia: p.category === 'MARKETING' && vigencias[p.name] ? vigencias[p.name] : null,
    btn: TIPO_BOTON[String(boton?.type ?? '').toUpperCase()] ?? '', btnTxt: String(boton?.text ?? ''), btnUrl: String(boton?.url ?? ''), btnTel: String(boton?.phone_number ?? ''),
  }
}

async function wabasConectadas(): Promise<string[]> {
  const filas = await prisma.crmLinea.findMany({ select: { wabaId: true }, distinct: ['wabaId'] })
  return filas.map(f => f.wabaId)
}

/** Todas las plantillas de las cuentas de las líneas conectadas. */
export async function listarPlantillas(): Promise<PlantillaFront[]> {
  if (!(await waConfigurado())) return []
  const wabas = await wabasConectadas()
  if (!wabas.length) return []
  const [nombres, u, guardados, lineas, vigencias] = await Promise.all([nombresVisibles(), usos(), mediaDePlantillas(), lineasDePlantillas(), vigenciasDePlantillas()])
  // Una plantilla de líneas de cuentas distintas existe en cada cuenta: sale una sola vez, con todas sus cuentas.
  const porSlug = new Map<string, PlantillaFront>()
  for (const waba of wabas) {
    for (const p of await plantillasDeWaba(waba, true)) {
      const f = aFront(p, nombres, u, guardados, lineas, vigencias)
      if (!f) continue
      const ya = porSlug.get(f.slug + '|' + f.idioma)
      if (ya) ya.wabas.push(waba); else porSlug.set(f.slug + '|' + f.idioma, f)
    }
  }
  return [...porSlug.values()]
}

const EJEMPLOS: Record<string, string> = {
  nombre: 'Valentina', asesor: 'Sara', producto: 'Calendario G 2026', enlace: 'https://pay.hotmart.com/ejemplo',
  fecha: '5 de octubre', valor: '$150.000', curso: 'Plan anual', hora: '4:00 p. m.',
}

/** El archivo guardado de cada plantilla con encabezado de imagen, video, GIF o documento (ajuste `plantillasMedia`, por slug). */
export async function mediaDePlantillas(): Promise<Record<string, { url: string; n?: string; mime?: string; peso?: number | null }>> {
  const v = await leerAjuste<unknown>('plantillasMedia')
  return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, { url: string; n?: string; mime?: string; peso?: number | null }> : {}
}

/**
 * Sube el archivo de muestra de un encabezado a Meta (carga reanudable de la app del token) y devuelve su
 * `header_handle`, que es lo que pide la creación de una plantilla con video.
 */
async function muestraEnMeta(cred: CredMeta, m: Muestra): Promise<string> {
  const app = await graph<{ id?: string }>('/app', { cred, query: { fields: 'id' } })
  if (!app.id) throw new ValidationError('Meta no dijo de qué app es el token: revisa la conexión de WhatsApp en Ajustes del CRM, Canales')
  const def = ARCHIVOS_CABECERA[m.tipo]
  const sesion = await graph<{ id?: string }>(`/${app.id}/uploads`, { cred, method: 'POST', query: { file_name: m.nombre.replace(/[^\w.-]+/g, '_').slice(0, 80) || 'archivo', file_length: m.buf.length, file_type: m.mime } })
  if (!sesion.id) throw new ValidationError(`Meta no aceptó ${def.nombre} de la plantilla. Intenta de nuevo.`)
  const r = await fetch(`${baseGraph()}/${sesion.id}`, { method: 'POST', headers: { Authorization: `OAuth ${cred.token}`, file_offset: '0' }, body: new Uint8Array(m.buf), signal: AbortSignal.timeout(120_000) })
  const j = await r.json().catch(() => ({})) as { h?: string; error?: { message?: string } }
  if (!r.ok || !j.h) throw new ValidationError(`Meta no recibió ${def.nombre} de la plantilla${j.error?.message ? `: ${j.error.message}` : ''}. Intenta de nuevo.`)
  return j.h
}

type EntradaPlantilla = { n?: unknown; c?: unknown; b?: unknown; head?: unknown; foot?: unknown; btn?: unknown; btnTxt?: unknown; btnUrl?: unknown; btnTel?: unknown; video?: unknown; media?: unknown; vigencia?: unknown; lineas?: unknown }
/** El archivo de muestra del encabezado, ya bajado de la Nube. */
type Muestra = { tipo: TipoArchivo; buf: Buffer; mime: string; nombre: string }

/** Revisa lo que llega del formulario y arma los componentes de Meta. Crear y editar usan lo mismo; al editar, el slug no cambia. */
function armarPlantilla(entrada: EntradaPlantilla, slugFijo?: string) {
  const n = String(entrada.n ?? '').trim()
  const slug = slugFijo ?? slugPlantilla(n)
  if (!n || !slug) throw new ValidationError('Ponle un nombre a la plantilla')
  if (n.length > 200) throw new ValidationError('El nombre de la plantilla es demasiado largo')
  const cat = String(entrada.c ?? '').trim().toLowerCase()
  const categoria = cat === 'marketing' ? 'MARKETING' : cat === 'utilidad' ? 'UTILITY' : null
  if (!categoria) {
    throw new ValidationError(cat.startsWith('autenticaci')
      ? 'Las plantillas de autenticación tienen un formato fijo de Meta y no se crean desde aquí'
      : 'La categoría debe ser Marketing o Utilidad')
  }
  // Meta pide variables en minúsculas, con guion bajo y sin tildes: {{Nombre}} → {{nombre}}.
  const b = String(entrada.b ?? '').trim().replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_t, v: string) => `{{${slugPlantilla(v)}}}`)
  if (!b) throw new ValidationError('Escribe el mensaje de la plantilla')
  if (b.length > 1024) throw new ValidationError('El mensaje pasa de 1.024 caracteres, el máximo de Meta para una plantilla')
  if (/\{\{\s*\}\}/.test(b)) throw new ValidationError('Hay una variable vacía: escribe su nombre entre las llaves, por ejemplo {{nombre}}')
  if (/^\{\{/.test(b) || /\}\}$/.test(b)) throw new ValidationError('Las variables no pueden ir al principio ni al final del mensaje: Meta la rechaza')
  if (/\}\}\s*\{\{/.test(b)) throw new ValidationError('Dos variables seguidas no se pueden: pon texto entre ellas')
  const vars = variablesDe(b)

  // Encabezado, pie y botón que arma la pantalla (límites de Meta: 60, 60 y 25 caracteres).
  const head = String(entrada.head ?? '').trim()
  const foot = String(entrada.foot ?? '').trim()
  if (head.length > 60) throw new ValidationError('El encabezado pasa de 60 caracteres, el máximo de Meta')
  if (foot.length > 60) throw new ValidationError('El pie pasa de 60 caracteres, el máximo de Meta')
  if (/\{\{/.test(head) || /\{\{/.test(foot)) throw new ValidationError('El encabezado y el pie van sin variables: pon las variables en el mensaje')
  // Encabezado con archivo, ya subido a la Nube del CRM: {tipo, url, n, mime, peso}. Las llamadas viejas mandan `video`.
  const crudo = entrada.media && typeof entrada.media === 'object' ? entrada.media as Record<string, unknown>
    : entrada.video && typeof entrada.video === 'object' ? { ...(entrada.video as Record<string, unknown>), tipo: 'video' } : null
  const media = crudo ? { tipo: String(crudo.tipo ?? '') as TipoArchivo, url: String(crudo.url ?? '').trim(), n: String(crudo.n ?? '').slice(0, 200), mime: String(crudo.mime ?? ''), peso: Number(crudo.peso) || null } : null
  if (media) {
    const def = ARCHIVOS_CABECERA[media.tipo]
    if (!def) throw new ValidationError('El encabezado debe ser texto, imagen, video, GIF o documento')
    if (media.tipo === 'gif' && categoria !== 'MARKETING') throw new ValidationError('Meta solo permite GIF en plantillas de marketing')
    if (!archivoPermitido(media.url)) throw new ValidationError(`Sube ${def.nombre} otra vez: no quedó en la Nube del CRM`)
    if (head) throw new ValidationError(`Con ${def.nombre.replace(/^(la|el) /, '')}, el encabezado de texto no va: quita uno de los dos`)
    if (media.peso && media.peso > def.max) throw new ValidationError(`${mayuscula(def.nombre)} pasa de ${MB(def.max)}, el máximo de WhatsApp`)
  }
  // Vigencia (solo marketing): si WhatsApp no lo entrega en ese tiempo, no se entrega ni se cobra. 30 días es la de Meta.
  const v = Number(entrada.vigencia) || null
  if (v && !VIGENCIAS.includes(v)) throw new ValidationError('La vigencia debe ser de 12 horas, 1 día, 7 días o 30 días')
  const vigencia = categoria === 'MARKETING' && v && v !== 2_592_000 ? v : null
  const tipoBoton = String(entrada.btn ?? '').trim()
  const textoBoton = String(entrada.btnTxt ?? '').trim()
  let boton: Record<string, string> | null = null
  if (tipoBoton) {
    if (!textoBoton) throw new ValidationError('Escribe el texto del botón')
    if (textoBoton.length > 25) throw new ValidationError('El texto del botón pasa de 25 caracteres, el máximo de Meta')
    if (tipoBoton === 'Respuesta rápida') boton = { type: 'QUICK_REPLY', text: textoBoton }
    else if (tipoBoton === 'Enlace') {
      const url = String(entrada.btnUrl ?? '').trim()
      if (!/^https:\/\/[^\s{}]+\.[^\s{}]+$/i.test(url)) throw new ValidationError('Escribe el enlace del botón completo, empezando por https://')
      boton = { type: 'URL', text: textoBoton, url }
    } else if (tipoBoton === 'Llamar') {
      const tel = String(entrada.btnTel ?? '').replace(/[^\d+]/g, '')
      const conPais = tel.startsWith('+') ? tel : /^3\d{9}$/.test(tel) ? `+57${tel}` : `+${tel}`
      if (!/^\+\d{10,15}$/.test(conPais)) throw new ValidationError('Escribe el número del botón de llamar con indicativo, por ejemplo +57 300 123 4567')
      boton = { type: 'PHONE_NUMBER', text: textoBoton, phone_number: conPais }
    } else throw new ValidationError('El botón debe ser de respuesta rápida, de enlace o de llamar')
  }

  const armar = (handle: string | null) => ({
    name: slug, language: 'es', category: categoria, parameter_format: 'NAMED',
    components: [
      ...(head ? [{ type: 'HEADER', format: 'TEXT', text: head }] : []),
      ...(handle && media ? [{ type: 'HEADER', format: ARCHIVOS_CABECERA[media.tipo].formato, example: { header_handle: [handle] } }] : []),
      {
        type: 'BODY', text: b,
        ...(vars.length ? { example: { body_text_named_params: vars.map(v => ({ param_name: v, example: EJEMPLOS[v] ?? 'dato de ejemplo' })) } } : {}),
      },
      ...(foot ? [{ type: 'FOOTER', text: foot }] : []),
      ...(boton ? [{ type: 'BUTTONS', buttons: [boton] }] : []),
    ],
    ...(vigencia ? { message_send_ttl_seconds: vigencia } : {}),
  })
  return { n, slug, categoria, b, vars, media, vigencia, armar }
}

/**
 * Baja de la Nube el archivo de muestra del encabezado (se sube a Meta con el token de cada cuenta). El video y el GIF
 * se piden en MP4 (la Nube lo convierte); la imagen y el PDF, tal cual.
 */
async function muestraDeNube(media: { tipo: TipoArchivo; url: string; n: string; mime: string }): Promise<Muestra> {
  const def = ARCHIVOS_CABECERA[media.tipo]
  const esVideo = media.tipo === 'video' || media.tipo === 'gif'
  const url = esVideo ? media.url.replace(/\.[a-z0-9]{2,5}(\?.*)?$/i, '') + '.mp4' : media.url
  const r = await fetch(url, { signal: AbortSignal.timeout(90_000) }).catch(() => null)
  if (!r || !r.ok) throw new ValidationError(`No se pudo leer ${def.nombre} de la Nube del CRM. Súbelo otra vez.`)
  const buf = Buffer.from(await r.arrayBuffer())
  const mime = esVideo ? 'video/mp4' : (media.mime || r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()
  if (!def.tipos.test(mime)) throw new ValidationError(`${mayuscula(def.nombre)} debe ser ${def.formatos}`)
  if (buf.length > def.max) throw new ValidationError(`${mayuscula(def.nombre)} pasa de ${MB(def.max)}, el máximo de WhatsApp`)
  return { tipo: media.tipo, buf, mime, nombre: media.n || (esVideo ? 'video.mp4' : media.tipo === 'documento' ? 'documento.pdf' : 'imagen.jpg') }
}

/** Guarda (o quita) el archivo del encabezado y la vigencia de una plantilla. Sin `muestra`, el archivo guardado no cambia. */
async function guardarExtras(slug: string, media: { url: string; n: string } | null, muestra: Muestra | null, vigencia: number | null, por: string | null) {
  const guardados = await mediaDePlantillas()
  if (media && muestra) guardados[slug] = { url: media.url, n: media.n || muestra.nombre, mime: muestra.mime, peso: muestra.buf.length }
  else if (!media) delete guardados[slug]
  await guardarAjuste('plantillasMedia', guardados, por)
  const vigencias = await vigenciasDePlantillas()
  if (vigencia) vigencias[slug] = vigencia; else delete vigencias[slug]
  await guardarAjuste('plantillasVigencia', vigencias, por)
}

/** Las líneas elegidas en el formulario y sus cuentas de Meta. Sin el campo (llamadas viejas), null: todas. */
async function lineasElegidas(valor: unknown): Promise<{ ids: string[]; wabas: string[] } | null> {
  if (valor === undefined || valor === null) return null
  const ids = Array.isArray(valor) ? [...new Set(valor.map(v => String(v ?? '').trim()).filter(Boolean))] : []
  if (!ids.length) throw new ValidationError('Elige al menos una línea donde se use la plantilla')
  const filas = await prisma.crmLinea.findMany({ where: { id: { in: ids } }, select: { id: true, wabaId: true } })
  if (filas.length !== ids.length) throw new ValidationError('Una de las líneas elegidas ya no está conectada: recarga y elige otra vez')
  return { ids, wabas: [...new Set(filas.map(f => f.wabaId))] }
}

async function guardarLineas(slug: string, ids: string[] | null, por: string | null) {
  const todas = await lineasDePlantillas()
  if (ids) todas[slug] = ids; else delete todas[slug]
  await guardarAjuste('plantillasLineas', todas, por)
}

/** Crea la plantilla en Meta, en la cuenta de cada línea elegida. Solo líderes. */
export async function crearPlantilla(entrada: EntradaPlantilla, por: string | null): Promise<PlantillaFront> {
  if (!(await waConfigurado())) throw new AppError('Primero conecta WhatsApp en Ajustes del CRM, Canales', 409)
  const { n, slug, categoria, b, vars, media, vigencia, armar } = armarPlantilla(entrada)
  const elegidas = await lineasElegidas(entrada.lineas)
  const wabas = elegidas ? elegidas.wabas : await wabasConectadas()
  if (!wabas.length) throw new ValidationError('Primero conecta una línea de WhatsApp: la plantilla se crea en la cuenta de esa línea')
  // El archivo de muestra se baja una vez de la Nube y se sube a Meta con el token de cada cuenta.
  const muestra = media ? await muestraDeNube(media) : null
  let cuerpo = armar(null)
  let creada: { id?: string; status?: string; category?: string } = {}
  for (const waba of wabas) {
    const cred = await credDeWaba(waba)
    if (muestra) cuerpo = armar(await muestraEnMeta(cred, muestra))
    const r = await graph<{ id?: string; status?: string; category?: string }>(`/${encodeURIComponent(waba)}/message_templates`, { cred, method: 'POST', body: cuerpo })
    if (!creada.id) creada = { ...r }
  }
  const nombres = await nombresVisibles()
  await guardarAjuste('plantillasNombres', { ...nombres, [slug]: n }, por)
  if (elegidas) await guardarLineas(slug, elegidas.ids, por)
  // El archivo de la plantilla queda guardado: sale con ella cada vez que se envía (whatsapp.ts lo toma de aquí).
  if (media || vigencia) await guardarExtras(slug, media, muestra, vigencia, por)
  olvidarPlantillas()
  emitirCrm({ tipo: 'plantillas' }, por)
  const f = aFront({
    id: creada.id ?? '', name: slug, language: 'es', status: creada.status ?? 'PENDING', category: creada.category ?? categoria,
    parameter_format: 'NAMED', components: cuerpo.components, waba: wabas[0],
  }, { ...nombres, [slug]: n }, new Map(), media && muestra ? { [slug]: { url: media.url, n: media.n, peso: muestra.buf.length } } : {}, elegidas ? { [slug]: elegidas.ids } : {}, vigencia ? { [slug]: vigencia } : {})
  if (f) f.wabas = wabas
  return f ?? { n, slug, c: CATEGORIA[categoria], e: 'w', x: 'En revisión en Meta', u: 0, b, idioma: 'es', id: creada.id ?? '', waba: wabas[0], vars,
    lineas: elegidas?.ids ?? null, wabas, estadoMeta: 'PENDING', motivo: '', headTipo: '', head: '', foot: '', vigencia, btn: '', btnTxt: '', btnUrl: '', btnTel: '' }
}

/** Lo que Meta compara de una plantilla: sin los ejemplos ni el archivo de muestra. */
function firma(componentes: Json[] | undefined): string {
  return JSON.stringify((componentes ?? []).map(c => ({
    t: String(c.type).toUpperCase(), f: String(c.format ?? '').toUpperCase(), x: String(c.text ?? ''),
    b: (c.buttons ?? []).map((k: Json) => [String(k.type).toUpperCase(), String(k.text ?? ''), String(k.url ?? ''), String(k.phone_number ?? '')]),
  })))
}

/**
 * Edita una plantilla (20-oct). Cambiar solo el nombre o las líneas es del CRM y no pasa por Meta. Cambiar el texto
 * la manda otra vez a revisión de Meta en cada cuenta donde exista (Meta deja editar una aprobada una vez al día y 10
 * veces al mes, y no deja cambiarle la categoría). Si se agregan líneas de otra cuenta, se crea también allá.
 */
export async function editarPlantilla(slug: string, entrada: EntradaPlantilla, por: string | null): Promise<PlantillaFront> {
  if (!(await waConfigurado())) throw new AppError('Primero conecta WhatsApp en Ajustes del CRM, Canales', 409)
  const existentes: PlantillaMeta[] = []
  for (const waba of await wabasConectadas()) existentes.push(...(await plantillasDeWaba(waba, true)).filter(p => p.name === slug))
  if (!existentes.length) throw new NotFoundError('Esa plantilla ya no existe en Meta')
  const { n, categoria, media, vigencia, armar } = armarPlantilla(entrada, slug)
  const aprobada = existentes.some(p => p.status === 'APPROVED')
  if (aprobada && categoria !== existentes[0].category) throw new ValidationError('A una plantilla aprobada no se le puede cambiar la categoría: crea una nueva con la otra categoría')
  const elegidas = await lineasElegidas(entrada.lineas)
  const guardados = await mediaDePlantillas()
  const vigenciaAntes = (await vigenciasDePlantillas())[slug] ?? null
  const cambioArchivo = !!media && guardados[slug]?.url !== media.url
  const cambioVigencia = vigenciaAntes !== vigencia
  const cambioTexto = cambioArchivo || cambioVigencia || firma(existentes[0].components) !== firma(armar(media ? 'x' : null).components)
  if (cambioTexto && existentes.some(p => !['APPROVED', 'REJECTED', 'PAUSED'].includes(p.status))) {
    throw new ValidationError('Meta no deja cambiar el texto mientras la plantilla está en revisión o deshabilitada. Puedes cambiar el nombre y las líneas.')
  }
  const muestra = media && (cambioTexto || elegidas) ? await muestraDeNube({ ...media, url: media.url || guardados[slug]?.url || '' }) : null
  if (cambioTexto) {
    for (const p of existentes) {
      const cred = await credDeWaba(p.waba)
      const cuerpo = armar(muestra ? await muestraEnMeta(cred, muestra) : null)
      await graph(`/${encodeURIComponent(p.id)}`, { cred, method: 'POST', body: {
        components: cuerpo.components, ...(p.status === 'APPROVED' ? {} : { category: categoria }),
        // Quitar la vigencia es volver a la de Meta (30 días).
        ...(categoria === 'MARKETING' ? { message_send_ttl_seconds: vigencia ?? 2_592_000 } : {}),
      } })
    }
  }
  // Líneas de una cuenta donde la plantilla no existe todavía: se crea allá con el texto nuevo.
  for (const waba of (elegidas?.wabas ?? []).filter(w => !existentes.some(p => p.waba === w))) {
    const cred = await credDeWaba(waba)
    await graph(`/${encodeURIComponent(waba)}/message_templates`, { cred, method: 'POST', body: armar(muestra ? await muestraEnMeta(cred, muestra) : null) })
  }
  await guardarAjuste('plantillasNombres', { ...(await nombresVisibles()), [slug]: n }, por)
  if (elegidas) await guardarLineas(slug, elegidas.ids, por)
  if (cambioArchivo || (!media && guardados[slug]) || cambioVigencia) await guardarExtras(slug, media, cambioArchivo ? muestra : null, vigencia, por)
  olvidarPlantillas()
  emitirCrm({ tipo: 'plantillas' }, por)
  const f = (await listarPlantillas()).find(x => x.slug === slug)
  if (!f) throw new NotFoundError('Esa plantilla ya no existe en Meta')
  return f
}

/** Borra la plantilla en Meta, en cada cuenta donde exista. Es inmediato y no pasa por revisión; Meta no deja usar ese nombre por 30 días. */
export async function eliminarPlantilla(slug: string, por: string | null): Promise<{ slug: string }> {
  if (!(await waConfigurado())) throw new AppError('Primero conecta WhatsApp en Ajustes del CRM, Canales', 409)
  let borradas = 0
  for (const waba of await wabasConectadas()) {
    const deEsta = (await plantillasDeWaba(waba, true)).filter(p => p.name === slug)
    if (!deEsta.length) continue
    if (deEsta.every(p => p.status === 'DISABLED')) throw new ValidationError('Meta no deja eliminar una plantilla deshabilitada')
    await graph(`/${encodeURIComponent(waba)}/message_templates`, { cred: await credDeWaba(waba), method: 'DELETE', query: { name: slug } })
    borradas++
  }
  if (!borradas) throw new NotFoundError('Esa plantilla ya no existe en Meta')
  const nombres = await nombresVisibles(); delete nombres[slug]
  await guardarAjuste('plantillasNombres', nombres, por)
  await guardarLineas(slug, null, por)
  const media = await mediaDePlantillas()
  if (media[slug]) { delete media[slug]; await guardarAjuste('plantillasMedia', media, por) }
  const vigencias = await vigenciasDePlantillas()
  if (vigencias[slug]) { delete vigencias[slug]; await guardarAjuste('plantillasVigencia', vigencias, por) }
  olvidarPlantillas()
  emitirCrm({ tipo: 'plantillas' }, por)
  return { slug }
}
