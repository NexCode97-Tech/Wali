import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import vm from 'node:vm'
import { logger } from '../../utils/logger'

/**
 * Ayuda de Wali, búsqueda por significado. Un modelo pequeño y abierto (multilingual-e5-small, cuantizado) corre aquí,
 * en el servidor: sin API de Claude ni de nadie y sin costo por pregunta. Convierte cada forma de preguntar de las guías
 * (pantalla/js/89-ayuda-guias.js) y cada pregunta en un vector; la guía más cercana es la que más se parece en
 * significado aunque no comparta palabras. La pantalla la combina con su buscador de palabras (fusión por rango).
 * Arranca solo poco después de prender el servidor; si falla, la ayuda sigue con el buscador de palabras.
 */

const MODELO = 'Xenova/multilingual-e5-small'
type Guia = { id: string; t: string; q?: string[] }
type Indice = { vec: (textos: string[], pre: string) => Promise<number[][]>; frases: number[][]; duenos: string[] }

let cargando: Promise<Indice> | null = null

function guias(): Guia[] {
  const codigo = readFileSync(join(process.cwd(), 'pantalla', 'js', '89-ayuda-guias.js'), 'utf8')
  const ctx: { G?: Guia[] } = {}
  vm.runInNewContext(`${codigo}\nthis.G = AYUDA_GUIAS;`, ctx, { timeout: 2000 })
  return ctx.G ?? []
}

async function cargar(): Promise<Indice> {
  const t0 = Date.now()
  const tr = await import('@huggingface/transformers')
  tr.env.cacheDir = join(tmpdir(), 'wali-modelos')
  const emb = await tr.pipeline('feature-extraction', MODELO, { dtype: 'q8' })
  const vec = async (textos: string[], pre: string) => (await emb(textos.map(t => pre + t), { pooling: 'mean', normalize: true })).tolist() as number[][]
  const textos: string[] = [], duenos: string[] = []
  for (const g of guias()) for (const f of [g.t, ...(g.q ?? [])]) { textos.push(f); duenos.push(g.id) }
  const frases: number[][] = []
  for (let i = 0; i < textos.length; i += 64) frases.push(...await vec(textos.slice(i, i + 64), 'passage: '))
  logger.info(`[CRM ayuda] búsqueda por significado lista: ${textos.length} frases en ${((Date.now() - t0) / 1000).toFixed(1)} s`)
  return { vec, frases, duenos }
}

/** Prepara el modelo (una sola vez). Si falla, se puede intentar otra vez en la siguiente pregunta. */
export function prepararAyudaSemantica(): Promise<Indice> {
  if (!cargando) cargando = cargar().catch(e => { cargando = null; throw e })
  return cargando
}

/** Las guías más parecidas en significado: [id, similitud de 0 a 1], de mayor a menor. */
export async function buscarPorSignificado(q: string, cuantas = 12): Promise<[string, number][]> {
  const ix = await prepararAyudaSemantica()
  const [v] = await ix.vec([q], 'query: ')
  const mejor = new Map<string, number>()
  ix.frases.forEach((f, i) => {
    let s = 0; for (let k = 0; k < f.length; k++) s += f[k] * v[k]
    if (s > (mejor.get(ix.duenos[i]) ?? -1)) mejor.set(ix.duenos[i], s)
  })
  return [...mejor].sort((a, b) => b[1] - a[1]).slice(0, cuantas).map(([id, s]) => [id, Math.round(s * 1000) / 1000])
}

/** Al prender el servidor: se prepara en segundo plano, sin frenar el arranque. */
export function calentarAyudaSemantica() {
  setTimeout(() => { prepararAyudaSemantica().catch(e => logger.warn(`[CRM ayuda] la búsqueda por significado no arrancó: ${(e as Error)?.message ?? e}`)) }, 8000)
}
