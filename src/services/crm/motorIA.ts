import Anthropic from '@anthropic-ai/sdk'
import type { Prisma } from '@prisma/client'
import { prisma, prismaGlobal } from './bd'
import { cuentaDe, espacioActual } from './espacio'
import { leerAjuste } from './ajustes'
import { cifrar, descifrar } from './cifrado'
import { emitirCrm } from './tiempoReal'
import { limitesDe } from './plan'
import { MODELO } from '../../config/ia'
import { logger } from '../../utils/logger'
import { AppError, ValidationError } from '../../utils/errors'

/**
 * Motor de IA de cada empresa (5-oct): Claude, Gemini u OpenAI con la clave de la cuenta de la empresa, que le paga
 * directo al proveedor (NexCode97 no cobra recargo ni revende uso). El proveedor solo pone el modelo: las instrucciones,
 * el conocimiento, las capacidades y los permisos de cada agente viven en el CRM y no cambian con el motor.
 *
 * Todo el CRM le habla a la IA con la forma de mensajes de Anthropic (`messages.create`). Con Claude se usa su SDK tal
 * cual; con OpenAI (API de Responses) y Gemini (su API compatible con OpenAI) un adaptador traduce el pedido y la
 * respuesta, herramientas incluidas, así los agentes, sus herramientas y sus permisos son los mismos con cualquier motor.
 *
 * Ajuste interno `_motorIA` = {activo, proveedores: {id: {secretos: cifrado, fin, modelos, desde, por}}}. La pantalla no
 * lo recibe (las claves con `_` no salen en /inicio): ve el estado con GET /crm/motor-ia, sin la clave.
 *
 * La clave del servidor (ANTHROPIC_API_KEY) solo mueve el espacio interno de NexCode97. Starter no trae IA: ahí no se
 * conecta ni corre ningún motor.
 */

const CLAVE = '_motorIA'
const TIEMPO_PRUEBA = 15_000

export type ProveedorId = 'claude' | 'gemini' | 'openai'
export interface Modelos { principal: string; rapido: string }
export interface Proveedor { id: ProveedorId; n: string; empresa: string; d: string }

export const PROVEEDORES: Proveedor[] = [
  { id: 'claude', n: 'Claude', empresa: 'Anthropic', d: 'Los modelos de Anthropic. Con los que se hicieron y probaron los agentes del CRM.' },
  { id: 'gemini', n: 'Gemini', empresa: 'Google', d: 'Los modelos de Google, con la clave de Google AI Studio.' },
  { id: 'openai', n: 'ChatGPT', empresa: 'OpenAI', d: 'Los modelos GPT de OpenAI, con la clave de su plataforma para desarrolladores.' },
]

/**
 * Los modelos que se prefieren, del mejor al de respaldo. Al conectar se elige el primero que la cuenta tenga; si no
 * tiene ninguno, el más nuevo de su lista que sirva para chatear. `principal` atiende a los clientes; `rapido` hace lo
 * que hoy hace Haiku (embudo, resúmenes, aprendizaje de la noche).
 */
const PREFERIDOS: Record<Exclude<ProveedorId, 'claude'>, { principal: string[]; rapido: string[] }> = {
  openai: { principal: ['gpt-6.1-sol', 'gpt-6-sol', 'gpt-6-astra', 'gpt-5.5', 'gpt-5.2', 'gpt-5.1', 'gpt-5'], rapido: ['gpt-6-luna', 'gpt-5.1-mini', 'gpt-5-mini'] },
  gemini: { principal: ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-flash'], rapido: ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash-lite'] },
}

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})
const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const esProveedor = (v: unknown): v is ProveedorId => PROVEEDORES.some(p => p.id === v)

// ─── Guardado ────────────────────────────────────────────────────────────────

interface Guardado { activo: ProveedorId | null; proveedores: Partial<Record<ProveedorId, Json>> }

async function guardado(): Promise<Guardado> {
  const v = obj(await leerAjuste<unknown>(CLAVE))
  const proveedores = Object.fromEntries(Object.entries(obj(v.proveedores)).filter(([k, x]) => esProveedor(k) && txt(obj(x).secretos)).map(([k, x]) => [k, obj(x)]))
  const activo = esProveedor(v.activo) && proveedores[v.activo] ? v.activo : null
  return { activo, proveedores }
}

async function escribir(cambiar: (g: Guardado) => Guardado, por: string | null) {
  const espacio = espacioActual()
  const llave = { espacioId_clave: { espacioId: espacio, clave: CLAVE } }
  await prisma.$transaction(async tx => {
    // Dos pestañas a la vez no se pisan: la fila queda bloqueada mientras se lee y se escribe.
    await tx.$queryRaw`SELECT 1 FROM crm_ajustes WHERE espacio_id = ${espacio} AND clave = ${CLAVE} FOR UPDATE`
    const fila = await tx.crmAjuste.findUnique({ where: llave })
    const v = obj(fila?.valor)
    const antes: Guardado = { activo: esProveedor(v.activo) ? v.activo : null, proveedores: obj(v.proveedores) as Guardado['proveedores'] }
    const json = cambiar(antes) as unknown as Prisma.InputJsonValue
    await tx.crmAjuste.upsert({ where: llave, create: { espacioId: espacio, clave: CLAVE, valor: json, actualizadoPorId: por }, update: { valor: json, actualizadoPorId: por } })
  })
  cache.delete(espacio)
}

// ─── Plan: Starter no trae IA ────────────────────────────────────────────────

async function planDelEspacio(): Promise<{ conIA: boolean; interno: boolean }> {
  // El plan es de la cuenta (6-oct): un espacio de trabajo usa el de su cuenta.
  const e = await prismaGlobal.crmEspacio.findUnique({ where: { id: await cuentaDe(espacioActual()) }, select: { plan: true, estadoPlan: true, pruebaHasta: true } })
  if (!e) return { conIA: false, interno: false }
  const interno = e.estadoPlan === 'interno'
  // En la prueba de 10 días tiene todo (también el motor de IA).
  const lim = limitesDe(e)
  return { conIA: interno || lim.agentesIA > 0, interno }
}

// ─── Estado para la pantalla ─────────────────────────────────────────────────

export interface EstadoProveedor { id: ProveedorId; n: string; empresa: string; d: string; conectado: boolean; activo: boolean; fin: string | null; modelo: string | null; desde: string | null; por: string | null }
export interface EstadoMotor { disponible: boolean; servidor: boolean; proveedores: EstadoProveedor[] }

/** Qué motores hay, cuál está conectado y cuál usan los agentes (sin la clave, solo sus últimos 4 caracteres). */
export async function estadoMotor(): Promise<EstadoMotor> {
  const [g, plan] = await Promise.all([guardado(), planDelEspacio()])
  const ids = [...new Set(Object.values(g.proveedores).map(x => txt(x?.por)).filter(Boolean))]
  const nombres = new Map(ids.length ? (await prismaGlobal.user.findMany({ where: { id: { in: ids } }, select: { id: true, nombre: true, email: true } }))
    .map(u => [u.id, (u.nombre || u.email || '').trim()] as const) : [])
  return {
    disponible: plan.conIA,
    // El espacio interno de NexCode97 corre con la clave del servidor mientras no conecte una propia.
    servidor: plan.interno && !!process.env.ANTHROPIC_API_KEY && !g.activo,
    proveedores: PROVEEDORES.map(p => {
      const x = g.proveedores[p.id]
      const m = obj(x?.modelos)
      return {
        ...p, conectado: !!x, activo: g.activo === p.id, fin: x ? txt(x.fin) || null : null,
        modelo: x ? txt(m.principal) || null : null, desde: x ? txt(x.desde) || null : null, por: x ? nombres.get(txt(x.por)) || null : null,
      }
    }),
  }
}

async function avisar(por: string | null) {
  emitirCrm({ tipo: 'motor-ia', motorIA: await estadoMotor() }, por)
}

// ─── Probar la clave y elegir los modelos ────────────────────────────────────

const FORMA: Record<ProveedorId, { re: RegExp; ayuda: string }> = {
  claude: { re: /^sk-ant-[A-Za-z0-9_-]{20,}$/, ayuda: 'La clave de Claude empieza por «sk-ant-». Cópiala de nuevo en la Consola de Anthropic, en API Keys.' },
  gemini: { re: /^[A-Za-z0-9_-]{30,60}$/, ayuda: 'La clave de Gemini se copia en Google AI Studio, en «Get API key». Pégala completa, sin espacios.' },
  openai: { re: /^sk-[A-Za-z0-9_-]{20,}$/, ayuda: 'La clave de OpenAI empieza por «sk-». Cópiala de nuevo en la plataforma de OpenAI, en API keys.' },
}

async function listarModelos(id: ProveedorId, clave: string): Promise<string[]> {
  const url = id === 'claude' ? 'https://api.anthropic.com/v1/models?limit=100'
    : id === 'openai' ? 'https://api.openai.com/v1/models'
      : 'https://generativelanguage.googleapis.com/v1beta/openai/models'
  const headers: Record<string, string> = id === 'claude' ? { 'x-api-key': clave, 'anthropic-version': '2023-06-01' } : { Authorization: `Bearer ${clave}` }
  let r: Response
  try { r = await fetch(url, { headers, signal: AbortSignal.timeout(TIEMPO_PRUEBA) }) } catch {
    throw new AppError(`${nombreDe(id)} no respondió. Intenta de nuevo en un momento.`, 502)
  }
  if (r.status === 400 || r.status === 401 || r.status === 403) throw new ValidationError(`${nombreDe(id)} no aceptó esa clave. Revisa que esté completa y activa en tu cuenta.`)
  if (!r.ok) throw new AppError(`${nombreDe(id)} respondió con un error (${r.status}). Intenta de nuevo en un momento.`, 502)
  const j = obj(await r.json().catch(() => ({})))
  return (Array.isArray(j.data) ? j.data : []).map(m => txt(obj(m).id).replace(/^models\//, '')).filter(Boolean)
}

const nombreDe = (id: ProveedorId) => PROVEEDORES.find(p => p.id === id)!.n

/** Sirve para chatear con herramientas (fuera audio, imagen, voz, búsqueda, inserciones y modelos viejos). */
const deChat = (id: ProveedorId, m: string) => id === 'openai'
  ? /^gpt-[5-9]/.test(m) && !/(audio|realtime|transcribe|tts|image|search|instruct|codex|embedding|nano|chat-latest|pro\b)/.test(m)
  : /^gemini-[2-9]/.test(m) && !/(image|tts|audio|live|embedding|vision|exp|preview)/.test(m)

function elegirModelos(id: Exclude<ProveedorId, 'claude'>, lista: string[]): Modelos {
  const pref = PREFERIDOS[id]
  const hay = new Set(lista)
  const utiles = lista.filter(m => deChat(id, m) && !/\d{4}-\d{2}-\d{2}|-\d{3}$/.test(m)).sort((a, b) => b.localeCompare(a, 'en', { numeric: true }))
  const rapidos = utiles.filter(m => /(mini|lite|luna)/.test(m))
  const fuertes = utiles.filter(m => !/(mini|lite|luna)/.test(m))
  const principal = pref.principal.find(m => hay.has(m)) ?? fuertes[0] ?? utiles[0]
  if (!principal) throw new ValidationError(`Esa cuenta de ${nombreDe(id)} no tiene modelos de chat disponibles. Revisa en tu cuenta que la clave tenga acceso a los modelos.`)
  const rapido = pref.rapido.find(m => hay.has(m)) ?? rapidos[0] ?? principal
  return { principal, rapido }
}

/** Prueba la clave con el proveedor (si no la acepta, no se guarda), la guarda cifrada y deja ese motor en uso. */
export async function conectarMotor(id: unknown, entrada: { clave?: unknown }, por: string | null): Promise<EstadoMotor> {
  if (!esProveedor(id)) throw new ValidationError('Ese proveedor de IA no está en la lista.')
  if (!(await planDelEspacio()).conIA) throw new AppError('El motor de IA viene desde el plan Growth. Mejora tu plan en Ajustes, Plan y pagos.', 403)
  const clave = txt(entrada.clave)
  if (!clave) throw new ValidationError(`Pega la clave de ${nombreDe(id)}.`)
  if (clave.length > 300 || /\s/.test(clave) || !FORMA[id].re.test(clave)) throw new ValidationError(FORMA[id].ayuda)
  const lista = await listarModelos(id, clave)
  // Con Claude el CRM pide cada modelo por su nombre (el de los agentes y Haiku para lo liviano): no se cambia nada.
  const modelos: Modelos = id === 'claude' ? { principal: MODELO, rapido: 'claude-haiku-4-5' } : elegirModelos(id, lista)
  await escribir(g => ({
    activo: id,
    proveedores: { ...g.proveedores, [id]: { secretos: cifrar({ clave }), fin: clave.slice(-4), modelos, desde: new Date().toISOString(), por } },
  }), por)
  logger.info(`[CRM motor IA] ${espacioActual()}: conectado ${id} (${modelos.principal} / ${modelos.rapido})`)
  await avisar(por)
  return estadoMotor()
}

/** Cambia el motor que usan los agentes por otro ya conectado. */
export async function usarMotor(id: unknown, por: string | null): Promise<EstadoMotor> {
  if (!esProveedor(id)) throw new ValidationError('Ese proveedor de IA no está en la lista.')
  const g = await guardado()
  if (!g.proveedores[id]) throw new ValidationError(`Primero conecta ${nombreDe(id)}.`)
  await escribir(x => ({ ...x, activo: id }), por)
  await avisar(por)
  return estadoMotor()
}

/** Borra la clave. Si era el motor en uso, pasa a otro conectado (si hay); si no, los agentes quedan sin motor. */
export async function desconectarMotor(id: unknown, por: string | null): Promise<EstadoMotor> {
  if (!esProveedor(id)) throw new ValidationError('Ese proveedor de IA no está en la lista.')
  await escribir(g => {
    const proveedores = { ...g.proveedores }
    delete proveedores[id]
    const quedan = PROVEEDORES.map(p => p.id).filter(p => txt(obj(proveedores[p]).secretos))
    return { activo: g.activo && g.activo !== id ? g.activo : quedan[0] ?? null, proveedores }
  }, por)
  await avisar(por)
  return estadoMotor()
}

// ─── El motor de la empresa actual ───────────────────────────────────────────

export type ClienteMotor = Pick<Anthropic, 'messages'>
export interface Motor {
  cliente: ClienteMotor
  proveedor: ProveedorId
  /** La empresa paga su propio uso: no cuenta para el tope diario de la clave del servidor. */
  propio: boolean
}

const cache = new Map<string, { motor: Motor | null; hasta: number }>()
const CACHE_MS = 30_000
let servidor: ClienteMotor | null = null

/**
 * El motor de la empresa actual: el que conectó y está en uso; si no conectó ninguno y es el espacio interno de
 * NexCode97, la clave del servidor (o CRM_IA_URL, el Claude falso de las pruebas locales). Si no, null: la IA no corre.
 */
export async function motorIA(): Promise<Motor | null> {
  const espacio = espacioActual()
  const c = cache.get(espacio)
  if (c && Date.now() < c.hasta) return c.motor
  let motor: Motor | null = null
  try {
    const [g, plan] = await Promise.all([guardado(), planDelEspacio()])
    const x = g.activo ? g.proveedores[g.activo] : undefined
    if (plan.conIA && g.activo && x) {
      const { clave } = descifrar<{ clave?: string }>(txt(x.secretos))
      const m = obj(x.modelos)
      const modelos: Modelos = { principal: txt(m.principal), rapido: txt(m.rapido) || txt(m.principal) }
      if (clave) motor = { cliente: crearCliente(g.activo, txt(clave), modelos), proveedor: g.activo, propio: true }
    } else if (plan.interno && (process.env.ANTHROPIC_API_KEY || process.env.CRM_IA_URL)) {
      // Sin reintentos del SDK: también reintenta los pedidos que vencen por tiempo, que Anthropic pudo haber cobrado.
      servidor ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || 'prueba-local', baseURL: process.env.CRM_IA_URL || undefined, maxRetries: 0 })
      motor = { cliente: servidor, proveedor: 'claude', propio: false }
    }
  } catch (e) {
    logger.warn(`[CRM motor IA] ${espacio}: no se pudo leer el motor (${(e as Error).message})`)
  }
  cache.set(espacio, { motor, hasta: Date.now() + CACHE_MS })
  return motor
}

/** Qué decir cuando no hay motor (eventos de la conversación y errores del chat de prueba). */
export const SIN_MOTOR = 'no hay un motor de IA conectado (Ajustes del CRM, Integraciones, Motor de IA)'

/** El mismo cliente con un tiempo máximo y reintentos fijos en cada llamada. */
export function conOpciones(c: ClienteMotor, op: { timeout?: number; maxRetries?: number }): ClienteMotor {
  return { messages: { create: ((p: Anthropic.MessageCreateParamsNonStreaming, o?: Json) => c.messages.create(p, { ...op, ...(o ?? {}) })) } as unknown as Anthropic['messages'] }
}

/** El cliente de un proveedor con su clave (también lo usan las pruebas de la traducción). */
export function crearCliente(id: ProveedorId, clave: string, modelos: Modelos): ClienteMotor {
  if (id === 'claude') return new Anthropic({ apiKey: clave, maxRetries: 0 })
  const crear = id === 'openai' ? llamarOpenAI : llamarGemini
  return { messages: { create: ((p: Anthropic.MessageCreateParamsNonStreaming, o?: { timeout?: number; maxRetries?: number }) => conReintento(() => crear(clave, modelos, p, o?.timeout ?? 60_000), o?.maxRetries ?? 0)) } as unknown as Anthropic['messages'] }
}

async function conReintento<T>(f: () => Promise<T>, reintentos: number): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await f() } catch (e) {
      const s = e instanceof Anthropic.APIError ? e.status : undefined
      if (i >= reintentos || e instanceof Anthropic.APIConnectionTimeoutError || !(s === 429 || (s && s >= 500))) throw e
      await new Promise(r => setTimeout(r, 1_500))
    }
  }
}

// ─── Traducción: de la forma de Anthropic a OpenAI y Gemini ─────────────────

/** Haiku hace lo liviano; lo demás va con el modelo principal de la cuenta. */
const modeloPara = (pedido: string, m: Modelos) => (/haiku/i.test(pedido) ? m.rapido : m.principal)

/** Lo que piensa el modelo también gasta de la salida: se le deja espacio para que la respuesta no quede cortada. */
const ESPACIO_RAZONAR = 4_000

function textoSistema(s: Anthropic.MessageCreateParamsNonStreaming['system']): string {
  if (!s) return ''
  return typeof s === 'string' ? s : s.map(b => b.text).join('\n\n')
}

const textoBloques = (c: Anthropic.MessageParam['content']) => (typeof c === 'string' ? c
  : c.map(b => (b.type === 'text' ? b.text : '')).filter(Boolean).join('\n'))

function salidaHerramienta(b: Anthropic.ToolResultBlockParam): string {
  const c = b.content
  const t = typeof c === 'string' ? c : Array.isArray(c) ? c.map(x => (x.type === 'text' ? x.text : '')).join('\n') : ''
  return b.is_error ? `Error: ${t}` : t
}

const esquemaFormato = (p: Anthropic.MessageCreateParamsNonStreaming) => {
  const f = obj(obj((p as unknown as Json).output_config).format)
  return f.type === 'json_schema' && f.schema ? f.schema as Json : null
}

/** Un error del proveedor con la misma forma que los de Anthropic, así quien llama los trata igual. */
async function errorDe(r: Response, quien: string): Promise<InstanceType<typeof Anthropic.APIError>> {
  const cuerpo = await r.json().catch(() => ({}))
  const msg = txt(obj(obj(cuerpo).error).message) || txt(obj(Array.isArray(cuerpo) ? cuerpo[0] : {}).message) || `${quien} respondió ${r.status}`
  return Anthropic.APIError.generate(r.status, obj(cuerpo), msg.slice(0, 300), r.headers)
}

async function pedir(url: string, clave: string, cuerpo: Json, tiempo: number, quien: string): Promise<Json> {
  let r: Response
  try {
    r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo), signal: AbortSignal.timeout(tiempo) })
  } catch (e) {
    if ((e as Error)?.name === 'TimeoutError' || (e as Error)?.name === 'AbortError') throw new Anthropic.APIConnectionTimeoutError()
    throw new Anthropic.APIConnectionError({ message: `${quien} no respondió`, cause: e as Error })
  }
  if (!r.ok) throw await errorDe(r, quien)
  return obj(await r.json().catch(() => ({})))
}

function mensaje(model: string, content: Anthropic.ContentBlock[], stop: Anthropic.StopReason, entrada: number, salida: number): Anthropic.Message {
  return {
    id: `msg_${Date.now().toString(36)}`, type: 'message', role: 'assistant', model, content, stop_reason: stop, stop_sequence: null,
    usage: { input_tokens: entrada, output_tokens: salida, cache_creation_input_tokens: 0, cache_read_input_tokens: 0 },
  } as unknown as Anthropic.Message
}

const leerArgs = (s: unknown): Json => { try { return obj(JSON.parse(String(s || '{}'))) } catch { return {} } }

/** OpenAI, API de Responses: la única que deja usar herramientas con los modelos que razonan. Sin guardar nada allá. */
async function llamarOpenAI(clave: string, modelos: Modelos, p: Anthropic.MessageCreateParamsNonStreaming, tiempo: number): Promise<Anthropic.Message> {
  const input: Json[] = []
  for (const m of p.messages) {
    if (typeof m.content === 'string') { input.push({ role: m.role, content: m.content }); continue }
    const texto = textoBloques(m.content)
    if (m.role === 'assistant') {
      if (texto) input.push({ role: 'assistant', content: texto })
      for (const b of m.content) if (b.type === 'tool_use') input.push({ type: 'function_call', call_id: b.id, name: b.name, arguments: JSON.stringify(b.input ?? {}) })
    } else {
      for (const b of m.content) if (b.type === 'tool_result') input.push({ type: 'function_call_output', call_id: b.tool_use_id, output: salidaHerramienta(b) })
      if (texto) input.push({ role: 'user', content: texto })
    }
  }
  const tools = (p.tools ?? []).filter((t): t is Anthropic.Tool => 'input_schema' in t)
    .map(t => ({ type: 'function', name: t.name, description: t.description ?? '', parameters: t.input_schema, strict: !!t.strict }))
  const tc = p.tool_choice
  const esquema = esquemaFormato(p)
  const model = modeloPara(String(p.model), modelos)
  const j = await pedir('https://api.openai.com/v1/responses', clave, {
    model, input, store: false, reasoning: { effort: 'low' },
    max_output_tokens: (p.max_tokens || 1024) + ESPACIO_RAZONAR,
    ...(textoSistema(p.system) ? { instructions: textoSistema(p.system) } : {}),
    ...(tools.length ? { tools, tool_choice: !tc || tc.type === 'auto' ? 'auto' : tc.type === 'none' ? 'none' : tc.type === 'any' ? 'required' : { type: 'function', name: tc.name } } : {}),
    ...(esquema ? { text: { format: { type: 'json_schema', name: 'respuesta', schema: esquema, strict: false } } } : {}),
  }, tiempo, 'OpenAI')
  const content: Anthropic.ContentBlock[] = []
  let negado = false
  for (const it of Array.isArray(j.output) ? j.output.map(obj) : []) {
    if (it.type === 'message') for (const c of (Array.isArray(it.content) ? it.content.map(obj) : [])) {
      if (c.type === 'output_text' && txt(c.text)) content.push({ type: 'text', text: String(c.text), citations: null } as Anthropic.TextBlock)
      if (c.type === 'refusal') negado = true
    }
    if (it.type === 'function_call') content.push({ type: 'tool_use', id: txt(it.call_id) || `call_${content.length}`, name: txt(it.name), input: leerArgs(it.arguments) } as Anthropic.ToolUseBlock)
  }
  const u = obj(j.usage)
  const cortado = j.status === 'incomplete' && obj(j.incomplete_details).reason === 'max_output_tokens'
  const stop: Anthropic.StopReason = negado && !content.length ? 'refusal' : content.some(b => b.type === 'tool_use') ? 'tool_use' : cortado ? 'max_tokens' : 'end_turn'
  return mensaje(model, content, stop, Number(u.input_tokens) || 0, Number(u.output_tokens) || 0)
}

/**
 * Gemini, con su API compatible con OpenAI (Chat Completions). Con Gemini 3 cada llamada a una herramienta trae una
 * firma de lo que pensó (`extra_content`) que hay que devolverle igual en la vuelta siguiente: viaja en el bloque.
 */
async function llamarGemini(clave: string, modelos: Modelos, p: Anthropic.MessageCreateParamsNonStreaming, tiempo: number): Promise<Anthropic.Message> {
  const messages: Json[] = []
  const sistema = textoSistema(p.system)
  if (sistema) messages.push({ role: 'system', content: sistema })
  for (const m of p.messages) {
    if (typeof m.content === 'string') { messages.push({ role: m.role, content: m.content }); continue }
    const texto = textoBloques(m.content)
    if (m.role === 'assistant') {
      const llamadas = m.content.filter((b): b is Anthropic.ToolUseBlockParam => b.type === 'tool_use')
        .map(b => ({ id: b.id, type: 'function', function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) }, ...((b as unknown as Json)._extra ? { extra_content: (b as unknown as Json)._extra } : {}) }))
      messages.push({ role: 'assistant', content: texto || null, ...(llamadas.length ? { tool_calls: llamadas } : {}) })
    } else {
      for (const b of m.content) if (b.type === 'tool_result') messages.push({ role: 'tool', tool_call_id: b.tool_use_id, content: salidaHerramienta(b) })
      if (texto) messages.push({ role: 'user', content: texto })
    }
  }
  const tools = (p.tools ?? []).filter((t): t is Anthropic.Tool => 'input_schema' in t)
    .map(t => ({ type: 'function', function: { name: t.name, description: t.description ?? '', parameters: t.input_schema } }))
  const tc = p.tool_choice
  const esquema = esquemaFormato(p)
  const model = modeloPara(String(p.model), modelos)
  const j = await pedir('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', clave, {
    model, messages, reasoning_effort: 'low', max_tokens: (p.max_tokens || 1024) + ESPACIO_RAZONAR,
    ...(tools.length ? { tools, tool_choice: !tc || tc.type === 'auto' ? 'auto' : tc.type === 'none' ? 'none' : tc.type === 'any' ? 'required' : { type: 'function', function: { name: tc.name } } } : {}),
    ...(esquema ? { response_format: { type: 'json_schema', json_schema: { name: 'respuesta', schema: esquema } } } : {}),
  }, tiempo, 'Gemini')
  const ch = obj(Array.isArray(j.choices) ? j.choices[0] : null)
  const msg = obj(ch.message)
  const content: Anthropic.ContentBlock[] = []
  if (txt(msg.content)) content.push({ type: 'text', text: String(msg.content), citations: null } as Anthropic.TextBlock)
  for (const t of (Array.isArray(msg.tool_calls) ? msg.tool_calls.map(obj) : [])) {
    const f = obj(t.function)
    content.push({ type: 'tool_use', id: txt(t.id) || `call_${content.length}`, name: txt(f.name), input: leerArgs(f.arguments), ...(t.extra_content ? { _extra: t.extra_content } : {}) } as unknown as Anthropic.ToolUseBlock)
  }
  const u = obj(j.usage)
  const fin = txt(ch.finish_reason)
  const stop: Anthropic.StopReason = content.some(b => b.type === 'tool_use') ? 'tool_use' : fin === 'length' ? 'max_tokens' : fin === 'content_filter' && !content.length ? 'refusal' : 'end_turn'
  return mensaje(model, content, stop, Number(u.prompt_tokens) || 0, Number(u.completion_tokens) || 0)
}
