import { prisma } from './bd'
import { espacioActual } from './espacio'
import { AppError, ValidationError } from '../../utils/errors'
import { leerAjuste, guardarAjuste } from './ajustes'
import { emitirCrm } from './tiempoReal'
import { archivoPermitido, baseGraph, graph, waConfigurado } from './whatsapp'
import { credDeWaba, type CredMeta } from './credenciales'

/**
 * Plantillas de WhatsApp del CRM (26-sep-2026): se leen y se crean en Meta,
 * en la cuenta (WABA) de cada línea conectada. Meta pide el nombre en
 * minúsculas y sin tildes («aviso_de_cuota»); el nombre con tildes que se
 * muestra en la pantalla se guarda en el ajuste `plantillasNombres`.
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
  media?: 'imagen' | 'video' | 'documento'
  /** El archivo guardado del encabezado (plantillas con video creadas desde el CRM): sale con la plantilla. */
  mediaUrl?: string; mediaN?: string
}

const MEDIA_CABECERA: Record<string, PlantillaFront['media']> = { IMAGE: 'imagen', VIDEO: 'video', DOCUMENT: 'documento' }

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

function aFront(p: PlantillaMeta, nombres: Record<string, string>, u: Map<string, number>, guardados: Record<string, { url: string; n?: string }> = {}): PlantillaFront | null {
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
  return {
    n, slug: p.name, c: CATEGORIA[p.category] ?? p.category, e, x, u: u.get(n) ?? 0, b: cuerpo,
    idioma: p.language, id: p.id, waba: p.waba, vars: variablesDe(cuerpo),
    ...(media ? { media } : {}),
    ...(media && guardados[p.name]?.url ? { mediaUrl: guardados[p.name].url, mediaN: guardados[p.name].n ?? '' } : {}),
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
  const [nombres, u, guardados] = await Promise.all([nombresVisibles(), usos(), mediaDePlantillas()])
  const salida: PlantillaFront[] = []
  for (const waba of wabas) {
    for (const p of await plantillasDeWaba(waba, true)) {
      const f = aFront(p, nombres, u, guardados)
      if (f) salida.push(f)
    }
  }
  return salida
}

const EJEMPLOS: Record<string, string> = {
  nombre: 'Valentina', asesor: 'Sara', producto: 'Calendario G 2026', enlace: 'https://pay.hotmart.com/ejemplo',
  fecha: '5 de octubre', valor: '$150.000', curso: 'Plan anual', hora: '4:00 p. m.',
}

/** El archivo guardado de cada plantilla con encabezado de video (ajuste `plantillasMedia`, por slug). */
export async function mediaDePlantillas(): Promise<Record<string, { url: string; n?: string; mime?: string; peso?: number | null }>> {
  const v = await leerAjuste<unknown>('plantillasMedia')
  return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, { url: string; n?: string; mime?: string; peso?: number | null }> : {}
}

/**
 * Sube el archivo de muestra de un encabezado a Meta (carga reanudable de la app del token) y devuelve su
 * `header_handle`, que es lo que pide la creación de una plantilla con video.
 */
async function muestraEnMeta(cred: CredMeta, archivo: Buffer, nombre: string): Promise<string> {
  const app = await graph<{ id?: string }>('/app', { cred, query: { fields: 'id' } })
  if (!app.id) throw new ValidationError('Meta no dijo de qué app es el token: revisa la conexión de WhatsApp en Ajustes del CRM, Canales')
  const sesion = await graph<{ id?: string }>(`/${app.id}/uploads`, { cred, method: 'POST', query: { file_name: nombre.replace(/[^\w.-]+/g, '_').slice(0, 80) || 'video.mp4', file_length: archivo.length, file_type: 'video/mp4' } })
  if (!sesion.id) throw new ValidationError('Meta no aceptó el video de la plantilla. Intenta de nuevo.')
  const r = await fetch(`${baseGraph()}/${sesion.id}`, { method: 'POST', headers: { Authorization: `OAuth ${cred.token}`, file_offset: '0' }, body: new Uint8Array(archivo), signal: AbortSignal.timeout(120_000) })
  const j = await r.json().catch(() => ({})) as { h?: string; error?: { message?: string } }
  if (!r.ok || !j.h) throw new ValidationError(`Meta no recibió el video de la plantilla${j.error?.message ? `: ${j.error.message}` : ''}. Intenta de nuevo.`)
  return j.h
}

/** Crea la plantilla en Meta (en cada cuenta de las líneas conectadas). Solo líderes. */
export async function crearPlantilla(entrada: { n?: unknown; c?: unknown; b?: unknown; head?: unknown; foot?: unknown; btn?: unknown; btnTxt?: unknown; btnUrl?: unknown; btnTel?: unknown; video?: unknown }, por: string | null): Promise<PlantillaFront> {
  if (!(await waConfigurado())) throw new AppError('Primero conecta WhatsApp en Ajustes del CRM, Canales', 409)
  const n = String(entrada.n ?? '').trim()
  const slug = slugPlantilla(n)
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

  const wabas = await wabasConectadas()
  if (!wabas.length) throw new ValidationError('Primero conecta una línea de WhatsApp: la plantilla se crea en la cuenta de esa línea')

  // Encabezado, pie y botón que arma la pantalla (límites de Meta: 60, 60 y 25 caracteres).
  const head = String(entrada.head ?? '').trim()
  const foot = String(entrada.foot ?? '').trim()
  if (head.length > 60) throw new ValidationError('El encabezado pasa de 60 caracteres, el máximo de Meta')
  if (foot.length > 60) throw new ValidationError('El pie pasa de 60 caracteres, el máximo de Meta')
  if (/\{\{/.test(head) || /\{\{/.test(foot)) throw new ValidationError('El encabezado y el pie van sin variables: pon las variables en el mensaje')
  // Encabezado con video (lote 7, tablero 7): MP4 de hasta 16 MB, ya subido a la Nube del CRM. No va con encabezado de texto.
  const video = entrada.video && typeof entrada.video === 'object' ? entrada.video as Record<string, unknown> : null
  const videoUrl = String(video?.url ?? '').trim()
  if (video) {
    if (!archivoPermitido(videoUrl)) throw new ValidationError('Sube el video otra vez: no quedó en la Nube del CRM')
    if (head) throw new ValidationError('Con video, el encabezado de texto no va: quita uno de los dos')
    if (Number(video.peso) > 16 * 1024 * 1024) throw new ValidationError('El video pasa de 16 MB, el máximo de WhatsApp')
  }
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
      ...(handle ? [{ type: 'HEADER', format: 'VIDEO', example: { header_handle: [handle] } }] : []),
      {
        type: 'BODY', text: b,
        ...(vars.length ? { example: { body_text_named_params: vars.map(v => ({ param_name: v, example: EJEMPLOS[v] ?? 'dato de ejemplo' })) } } : {}),
      },
      ...(foot ? [{ type: 'FOOTER', text: foot }] : []),
      ...(boton ? [{ type: 'BUTTONS', buttons: [boton] }] : []),
    ],
  })
  // El video de muestra se baja una vez de la Nube y se sube a Meta con el token de cada cuenta.
  let videoBuf: Buffer | null = null
  if (video) {
    const r = await fetch(videoUrl.replace(/\.[a-z0-9]{2,5}(\?.*)?$/i, '') + '.mp4', { signal: AbortSignal.timeout(60_000) }).catch(() => null)
    if (!r || !r.ok) throw new ValidationError('No se pudo leer el video de la Nube del CRM. Súbelo otra vez.')
    videoBuf = Buffer.from(await r.arrayBuffer())
    if (videoBuf.length > 16 * 1024 * 1024) throw new ValidationError('El video pasa de 16 MB, el máximo de WhatsApp')
  }
  let cuerpo = armar(null)
  let creada: { id?: string; status?: string; category?: string } = {}
  for (const waba of wabas) {
    const cred = await credDeWaba(waba)
    if (videoBuf) cuerpo = armar(await muestraEnMeta(cred, videoBuf, String(video?.n ?? 'video.mp4')))
    const r = await graph<{ id?: string; status?: string; category?: string }>(`/${encodeURIComponent(waba)}/message_templates`, { cred, method: 'POST', body: cuerpo })
    if (!creada.id) creada = { ...r }
  }
  const nombres = await nombresVisibles()
  await guardarAjuste('plantillasNombres', { ...nombres, [slug]: n }, por)
  // El video de la plantilla queda guardado: sale con ella cada vez que se envía (whatsapp.ts lo toma de aquí).
  if (video) await guardarAjuste('plantillasMedia', { ...(await mediaDePlantillas()), [slug]: { url: videoUrl, n: String(video.n ?? 'video.mp4').slice(0, 200), mime: 'video/mp4', peso: videoBuf?.length ?? null } }, por)
  olvidarPlantillas()
  emitirCrm({ tipo: 'plantillas' }, por)
  const f = aFront({
    id: creada.id ?? '', name: slug, language: 'es', status: creada.status ?? 'PENDING', category: creada.category ?? categoria,
    parameter_format: 'NAMED', components: cuerpo.components, waba: wabas[0],
  }, { ...nombres, [slug]: n }, new Map())
  return f ?? { n, slug, c: CATEGORIA[categoria], e: 'w', x: 'En revisión en Meta', u: 0, b, idioma: 'es', id: creada.id ?? '', waba: wabas[0], vars }
}
