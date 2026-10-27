import { Prisma, type CrmContacto } from '@prisma/client'
import { prisma } from './bd'
import { filtroContactos, type Alcance } from './alcance'
import { leerAjuste } from './ajustes'
import { contactoAFront, mapaNombres, telDigitos } from './formas'
import { idDeNombre } from './usuarios'

/**
 * Contactos paginados (maqueta aprobada «Contactos rediseñados», dirección C, 27-oct). La página de Contactos ya no
 * arma la lista con todo lo que trae /inicio: el servidor busca, filtra, cuenta y ordena, y manda de a 25, 50 o 100.
 * Solo salen los contactos guardados a propósito (`guardado`), con las mismas reglas de quién ve qué (filtroContactos).
 * Para ordenar por el último mensaje (que vive en las conversaciones) se leen primero solo los ids con su fecha, se
 * ordenan aquí y se traen completos los de la página: aguanta decenas de miles sin cargar la base.
 */

type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})
const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const DIA = 86_400_000
type W = Prisma.CrmContactoWhereInput

export interface ParamsLista {
  vista: string; q: string
  f: { etapa?: string; asig?: string; canal?: string; tag?: string; origen?: string; producto?: string }
  orden: 'ultimo' | 'n' | 'agregado'; dir: 1 | -1
  pagina: number; tam: number
}

const sinSpam: W = { NOT: { extra: { path: ['spam'], not: Prisma.AnyNull } } }
const conSpam: W = { extra: { path: ['spam'], not: Prisma.AnyNull } }
const contactable: W = { noContactar: { equals: Prisma.AnyNull } }
const base: W = { AND: [{ guardado: true }, sinSpam, contactable] }
const desde = (dias: number) => new Date(Date.now() - dias * DIA)

/** Origen como lo muestra la pantalla (origenDe): Anuncio, Enlace de venta, Chat de la web, Correo u Otro. */
function porOrigen(o: string): W {
  const ficha = (s: string): W => ({ ficha: { path: ['origen'], string_contains: s } })
  const enlace: W = { OR: [ficha('enlace de venta'), ficha('Enlace de venta')] }
  const web: W = { OR: [ficha('web'), ficha('Web')] }
  const correo = ficha('Correo')
  // «No dice X» incluye a quien no tiene origen escrito (en SQL, NOT de un NULL deja la fila por fuera).
  const sinOrigen: W = { ficha: { path: ['origen'], equals: Prisma.AnyNull } }
  const no = (w: W): W => ({ OR: [sinOrigen, { NOT: w }] })
  const anuncio: W = { pauta: { not: Prisma.AnyNull } }
  const sinPauta: W = { pauta: { equals: Prisma.AnyNull } }
  if (o === 'Anuncio') return anuncio
  if (o === 'Enlace de venta de un asesor') return { AND: [sinPauta, enlace] }
  if (o === 'Chat de la web') return { AND: [sinPauta, no(enlace), web] }
  if (o === 'Correo') return { AND: [sinPauta, no(enlace), no(web), correo] }
  return { AND: [sinPauta, no(enlace), no(web), no(correo)] }
}

/** Una condición de un segmento propio ([campo, «es»/«no es», valor], 76-contactos.js). */
async function condicion([k, op, v]: [string, string, string]): Promise<W> {
  let w: W
  if (k === 'etapa') w = { etapa: v }
  else if (k === 'asig') w = v === 'Sin asignar' ? { asignadoId: null } : { asignadoId: (await idDeNombre(v)) ?? '—' }
  else if (k === 'canal') w = { canal: v }
  else if (k === 'tag') w = { tags: { has: v } }
  else if (k === 'origen') w = porOrigen(v)
  else if (k === 'producto') w = { campos: { path: ['producto'], equals: v } }
  else if (k === 'ultimo') w = v === 'menos7' ? { conversaciones: { some: { ultimoMensajeAt: { gte: desde(7) } } } } : { conversaciones: { none: { ultimoMensajeAt: { gte: desde(30) } } } }
  else w = {}
  return op === 'no es' ? { NOT: w } : w
}

/** Los segmentos de fábrica y los propios del espacio (ajuste `segmentos`). */
async function segmentos(): Promise<{ id: string; w: W }[]> {
  const guardados = await leerAjuste('segmentos')
  const propios = Array.isArray(guardados) ? guardados as Json[] : []
  const out: { id: string; w: W }[] = [
    { id: 'nuevos', w: { createdAt: { gte: desde(7) } } },
    { id: 'inactivos', w: { conversaciones: { none: { ultimoMensajeAt: { gte: desde(30) } } } } },
    { id: 'anuncio', w: { pauta: { not: Prisma.AnyNull } } },
    { id: 'compraron', w: { ficha: { path: ['compras'], not: Prisma.AnyNull } } },
  ]
  for (const s of propios) {
    const id = txt(s.id); if (!id) continue
    if (Array.isArray(s.reglas)) {
      const conds = await Promise.all((s.reglas as [string, string, string][]).filter(r => Array.isArray(r) && r.length === 3).map(condicion))
      out.push({ id, w: !conds.length ? {} : s.modo === 'alguna' ? { OR: conds } : { AND: conds } })
    } else {
      // Segmentos de antes (filtros guardados como los de la barra).
      out.push({ id, w: await filtros(obj(s.filtros) as ParamsLista['f']) })
    }
  }
  return out
}

/** Lo que se pide en la barra (etapa, miembro, canal, etiqueta, origen, producto). */
async function filtros(f: ParamsLista['f']): Promise<W> {
  const and: W[] = []
  if (f.etapa) and.push({ etapa: f.etapa })
  if (f.asig) and.push(f.asig === 'Sin asignar' ? { asignadoId: null } : { asignadoId: (await idDeNombre(f.asig)) ?? '—' })
  if (f.canal) and.push({ canal: f.canal })
  if (f.tag) and.push({ tags: { has: f.tag } })
  if (f.origen) and.push(porOrigen(f.origen))
  if (f.producto) and.push({ campos: { path: ['producto'], equals: f.producto } })
  return and.length ? { AND: and } : {}
}

/** Sin tildes y en minúsculas, como busca la pantalla («florez» encuentra a «Flórez»). */
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
/**
 * La búsqueda: nombre, teléfono, correo, ciudad o el número de cliente. Se hace sobre los ids ya filtrados (no en
 * SQL), porque la base distingue tildes y la gente busca sin ellas.
 */
function busca(q: string): ((k: { nombre: string | null; telefono: string | null; correo: string | null; ficha: unknown; numero: number }) => boolean) | null {
  const s = norm(q.trim().slice(0, 80)); if (!s) return null
  const dig = telDigitos(s) ?? ''
  const num = s.replace(/^(n\.?\s*º?\s*|#|cliente\s*)/i, '').trim()
  return k => norm(`${k.nombre ?? ''} ${k.correo ?? ''} ${String(obj(k.ficha).ciudad ?? '')}`).includes(s)
    || (dig.length >= 3 && (k.telefono ?? '').includes(dig))
    || (/^\d{1,9}$/.test(num) && k.numero === Number(num))
}

/** La vista de la izquierda: todos, nuevos, mis contactos, una etapa, un segmento, no contactar o spam. */
function porVista(vista: string, yo: string, segs: { id: string; w: W }[]): W {
  if (vista === 'spam') return conSpam
  if (vista === 'nocontactar') return { AND: [{ guardado: true }, sinSpam, { noContactar: { not: Prisma.AnyNull } }] }
  if (vista === 'mios') return { AND: [base, { asignadoId: yo }] }
  if (vista.startsWith('etapa:')) return { AND: [base, { etapa: vista.slice(6) }] }
  if (vista.startsWith('seg:')) { const s = segs.find(x => x.id === vista.slice(4)); return s ? { AND: [base, s.w] } : base }
  if (vista === 'nuevos') return { AND: [base, segs[0].w] }
  return base
}

/** La lista de una página, el total y los conteos de cada vista. */
export async function listaContactos(a: Alcance, gente: string[], p: ParamsLista, etapas: string[]) {
  const ve = filtroContactos(a, gente)
  const segs = await segmentos()
  const where: W = { AND: [ve, porVista(p.vista, a.userId, segs), await filtros(p.f)] }

  // 1. Solo ids, fechas y lo que se busca de todos los que cumplen; 2. se busca y se ordena; 3. se traen completos
  // los de la página.
  const pasa = busca(p.q)
  const leidas = await prisma.crmContacto.findMany({
    where, select: { id: true, nombre: true, createdAt: true, ...(pasa ? { telefono: true, correo: true, ficha: true, numero: true } : {}), conversaciones: { select: { ultimoMensajeAt: true }, orderBy: { ultimoMensajeAt: { sort: 'desc', nulls: 'last' } }, take: 1 } },
  })
  const claves = pasa ? leidas.filter(k => pasa(k as never)) : leidas
  const ult = (c: typeof claves[number]) => c.conversaciones[0]?.ultimoMensajeAt?.getTime() ?? 0
  const val = (c: typeof claves[number]) => p.orden === 'n' ? (c.nombre ?? '').toLocaleLowerCase('es') : p.orden === 'agregado' ? -c.createdAt.getTime() : -ult(c)
  claves.sort((x, y) => { const a1 = val(x), b1 = val(y); return (a1 > b1 ? 1 : a1 < b1 ? -1 : y.id - x.id) * p.dir })
  const total = claves.length
  const paginas = Math.max(1, Math.ceil(total / p.tam))
  const pagina = Math.min(Math.max(1, p.pagina), paginas)
  const ids = claves.slice((pagina - 1) * p.tam, pagina * p.tam).map(c => c.id)
  const filas = ids.length ? await prisma.crmContacto.findMany({
    where: { id: { in: ids } },
    include: { conversaciones: { select: { id: true, ultimoMensajeAt: true, lineaId: true, estado: true }, orderBy: { ultimoMensajeAt: { sort: 'desc', nulls: 'last' } }, take: 1 } },
  }) : []
  const porId = new Map(filas.map(k => [k.id, k]))
  const nombres = await mapaNombres()

  // Conteos de la izquierda (sin la búsqueda ni los filtros de la barra, como siempre).
  const contar = (w: W) => prisma.crmContacto.count({ where: { AND: [ve, w] } })
  const [todos, nuevos, mios, nocontactar, spam, porEtapa, porSeg] = await Promise.all([
    contar(base), contar({ AND: [base, segs[0].w] }), contar({ AND: [base, { asignadoId: a.userId }] }),
    contar(porVista('nocontactar', a.userId, segs)), contar(conSpam),
    Promise.all(etapas.map(e => contar({ AND: [base, { etapa: e }] }))),
    Promise.all(segs.map(s => contar({ AND: [base, s.w] }))),
  ])
  return {
    filas: ids.map(id => porId.get(id)).filter((k): k is CrmContacto & { conversaciones: { id: number; ultimoMensajeAt: Date | null; lineaId: string | null; estado: string }[] } => !!k).map(k => {
      const c = k.conversaciones[0]
      return { ...contactoAFront(k, nombres), convId: c?.id ?? null, linea: c?.lineaId ?? null, ultimo: (c?.ultimoMensajeAt ?? null)?.toISOString() ?? null, creado: k.createdAt.toISOString() }
    }),
    total, pagina, paginas, tam: p.tam,
    conteos: { todos, nuevos, mios, nocontactar, spam, etapas: Object.fromEntries(etapas.map((e, i) => [e, porEtapa[i]])), segmentos: Object.fromEntries(segs.map((s, i) => [s.id, porSeg[i]])) },
  }
}
