import { jsPDF } from 'jspdf'
import JSZip from 'jszip'
import type { CrmContacto, CrmConversacion, CrmMensaje } from '@prisma/client'
import { logger } from '../../utils/logger'

/**
 * Exportar el chat (lote 7, tablero 3). Texto como el que exporta WhatsApp o PDF con la forma del chat
 * (fechas y quién escribió), con o sin notas privadas y eventos; con «archivos», un .zip con el chat y las
 * fotos, audios, videos y documentos de la conversación.
 */
type Json = Record<string, unknown>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})
const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export interface OpcionesExportar { formato: 'pdf' | 'txt'; notas: boolean; eventos: boolean; archivos: boolean }
type Conv = CrmConversacion & { contacto: CrmContacto }

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
/** Colombia no cambia de hora: UTC-5. */
const bog = (d: Date) => new Date(d.getTime() - 5 * 3_600_000)
const hora = (d: Date) => { const b = bog(d), h = b.getUTCHours(); return `${((h + 11) % 12) + 1}:${String(b.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}` }
const diaCorto = (d: Date) => { const b = bog(d); return `${b.getUTCDate()}/${b.getUTCMonth() + 1}/${String(b.getUTCFullYear()).slice(2)}` }
const diaLargo = (d: Date) => { const b = bog(d); return `${b.getUTCDate()} de ${MESES[b.getUTCMonth()]} de ${b.getUTCFullYear()}` }
const diaClave = (d: Date) => bog(d).toISOString().slice(0, 10)

interface Linea {
  tipo: 'in' | 'out' | 'nota' | 'ev'
  quien: string
  texto: string
  cuando: Date
  archivo?: { url: string; nombre: string }
}

const EXT: Record<string, string> = { img: 'jpg', video: 'mp4', audio: 'ogg' }
function extDe(url: string, defecto: string): string {
  const m = url.split('?')[0].match(/\.([a-z0-9]{2,5})$/i)
  return m ? m[1].toLowerCase() : defecto
}

/** Los mensajes de la conversación, ya como renglones. Lo que no se pidió (notas, eventos) no sale. */
export function renglones(c: Conv, mensajes: CrmMensaje[], op: OpcionesExportar): Linea[] {
  const cliente = c.contacto.nombre || c.contacto.telefono || c.contacto.correo || 'Cliente'
  const out: Linea[] = []
  let n = 0
  const archivo = (url: unknown, nombre: string, ext: string) => {
    const u = txt(url)
    if (!/^https?:\/\//.test(u)) return undefined
    n++
    const limpio = nombre.replace(/[^\p{L}\p{N}._ -]+/gu, '').trim().slice(0, 60)
    const conExt = /\.[a-z0-9]{2,5}$/i.test(limpio) ? limpio : `${limpio || 'archivo'}.${extDe(u, ext)}`
    return { url: u, nombre: `${String(n).padStart(3, '0')} ${conExt}` }
  }
  for (const m of mensajes) {
    const d = obj(m.datos), cuando = m.createdAt
    if (d.prog || d.sugT || d.d) continue
    if (d.note != null) { if (op.notas) out.push({ tipo: 'nota', quien: txt(d.by) || 'Equipo', texto: String(d.note), cuando }); continue }
    if (d.ev != null) { if (op.eventos && txt(d.t)) out.push({ tipo: 'ev', quien: '', texto: txt(d.t).replace(/ · ahora$/, ''), cuando }); continue }
    if (d.csat) { const s = obj(d.csat); out.push({ tipo: 'in', quien: cliente, texto: `Respondió la encuesta: atención ${s.aten ?? '—'} de 5, recomendaría ${s.nps ?? '—'} de 10${txt(s.com) ? `. «${txt(s.com)}»` : ''}`, cuando }); continue }
    if (d.call) { if (op.eventos) out.push({ tipo: 'ev', quien: '', texto: 'Llamada de WhatsApp', cuando }); continue }
    if (d.in != null) {
      if (typeof d.in === 'string') { out.push({ tipo: 'in', quien: cliente, texto: (txt(d.asunto) ? `${txt(d.asunto)}\n` : '') + d.in, cuando }); continue }
      const x = obj(d.in), cap = txt(x.cap)
      if (x.img) out.push({ tipo: 'in', quien: cliente, texto: x.sticker ? 'Sticker' : `Imagen${cap ? `: ${cap}` : ''}`, cuando, archivo: archivo(x.img, x.sticker ? 'sticker' : 'imagen', x.sticker ? 'webp' : EXT.img) })
      else if (x.video) out.push({ tipo: 'in', quien: cliente, texto: `Video${cap ? `: ${cap}` : ''}`, cuando, archivo: archivo(x.video, 'video', EXT.video) })
      else if (x.doc) out.push({ tipo: 'in', quien: cliente, texto: `Documento: ${txt(x.n) || 'archivo'}${cap ? `. ${cap}` : ''}`, cuando, archivo: archivo(x.doc, txt(x.n) || 'documento', 'pdf') })
      else out.push({ tipo: 'in', quien: cliente, texto: `Nota de voz${txt(x.trans) ? `: ${txt(x.trans)}` : ''}`, cuando, archivo: archivo(x.url, 'nota de voz', EXT.audio) })
      continue
    }
    const deIa = txt(d.ia) || txt(d.recepcion) || txt(d.bot)
    if (deIa) { out.push({ tipo: 'out', quien: d.bot != null ? `Flujo${txt(d.flujo) ? ` ${txt(d.flujo)}` : ''}` : txt(d.agente) || 'Agente IA', texto: deIa, cuando }); continue }
    if (d.out != null || d.file || d.audio) {
      const quien = txt(d.by) || 'Equipo', f = obj(d.file), a = obj(d.audio)
      const partes = [txt(d.out)]
      let arch: Linea['archivo']
      if (d.audio) { partes.push('Nota de voz'); arch = archivo(a.url, 'nota de voz', EXT.audio) }
      else if (d.file) { partes.push(`Archivo: ${txt(f.n) || 'archivo'}`); arch = archivo(f.url, txt(f.n) || 'archivo', 'bin') }
      out.push({ tipo: 'out', quien, texto: partes.filter(Boolean).join('\n') || '(sin texto)', cuando, archivo: arch })
    }
  }
  return out
}

export function comoTexto(c: Conv, lineas: Linea[]): string {
  const cab = `Chat con ${c.contacto.nombre || 'Cliente'}${c.contacto.telefono ? ` (${c.contacto.telefono})` : ''}. Exportado el ${diaLargo(new Date())}.`
  const cuerpo = lineas.map(l => {
    const f = `[${diaCorto(l.cuando)}, ${hora(l.cuando)}]`
    const adj = l.archivo ? ` (archivo: ${l.archivo.nombre})` : ''
    if (l.tipo === 'ev') return `${f} · ${l.texto}`
    if (l.tipo === 'nota') return `${f} Nota privada de ${l.quien}: ${l.texto}`
    return `${f} ${l.quien}: ${l.texto}${adj}`
  })
  return [cab, '', ...cuerpo, ''].join('\n')
}

/** Helvetica de jsPDF solo trae Latin-1: los emojis y otros símbolos se quitan para que no salgan como basura. */
const latin = (s: string) => s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').replace(/[–—]/g, '-').replace(/[^\n -ÿ]/g, '').replace(/[ \t]+/g, ' ')

export function comoPdf(c: Conv, lineas: Linea[]): Buffer {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 16, ANCHO = 118
  let y = M
  const salto = (alto: number) => { if (y + alto > H - M) { doc.addPage(); y = M } }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(31, 41, 55)
  doc.text(latin(`Chat con ${c.contacto.nombre || 'Cliente'}`), M, y + 4); y += 9
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(107, 114, 128)
  const mensajes = lineas.filter(l => l.tipo === 'in' || l.tipo === 'out').length
  doc.text(latin([c.contacto.telefono || c.contacto.correo || '', `${mensajes} ${mensajes === 1 ? 'mensaje' : 'mensajes'}`, `Exportado el ${diaLargo(new Date())}`].filter(Boolean).join(' · ')), M, y + 2); y += 8
  doc.setDrawColor(229, 233, 240); doc.line(M, y, W - M, y); y += 6

  let dia = ''
  for (const l of lineas) {
    const k = diaClave(l.cuando)
    if (k !== dia) {
      dia = k; salto(12)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(107, 114, 128)
      doc.text(latin(diaLargo(l.cuando)), W / 2, y + 2, { align: 'center' }); y += 8
    }
    if (l.tipo === 'ev') {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(107, 114, 128)
      const t = doc.splitTextToSize(latin(`${l.texto} · ${hora(l.cuando)}`), W - 2 * M - 30) as string[]
      salto(t.length * 4 + 3)
      doc.text(t, W / 2, y + 2, { align: 'center' }); y += t.length * 4 + 3
      continue
    }
    const cuerpo = latin(l.texto + (l.archivo ? `\n[${l.archivo.nombre}]` : '')) || ' '
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
    const renglonesTexto = doc.splitTextToSize(cuerpo, ANCHO - 8) as string[]
    const pie = latin(l.tipo === 'nota' ? `Nota privada · ${l.quien} · ${hora(l.cuando)}` : `${l.quien} · ${hora(l.cuando)}`)
    // Un mensaje muy largo se parte entre páginas, de a trozos que caben.
    let resto = renglonesTexto
    while (resto.length) {
      const caben = Math.max(1, Math.floor((H - M - y - 12) / 4.6))
      if (caben < 3 && resto.length > caben) { doc.addPage(); y = M; continue }
      const trozo = resto.slice(0, caben); resto = resto.slice(caben)
      const alto = trozo.length * 4.6 + 5
      const ancho = Math.min(ANCHO, Math.max(...trozo.map(t => doc.getTextWidth(t))) + 8)
      const x = l.tipo === 'in' ? M : W - M - ancho
      if (l.tipo === 'in') doc.setFillColor(241, 245, 249)
      else if (l.tipo === 'nota') doc.setFillColor(255, 251, 235)
      else doc.setFillColor(31, 147, 255)
      doc.roundedRect(x, y, ancho, alto, 2.5, 2.5, 'F')
      if (l.tipo === 'out') doc.setTextColor(255, 255, 255); else doc.setTextColor(31, 41, 55)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10)
      doc.text(trozo, x + 4, y + 5.4)
      y += alto + 1.5
      if (!resto.length) {
        doc.setFontSize(8); doc.setTextColor(107, 114, 128)
        doc.text(pie, l.tipo === 'in' ? M + 1 : W - M - 1, y + 2.2, { align: l.tipo === 'in' ? 'left' : 'right' })
        y += 7
      }
      if (resto.length) { doc.addPage(); y = M }
    }
  }
  return Buffer.from(doc.output('arraybuffer'))
}

const MAX_ARCHIVO = 30 * 1024 * 1024
const MAX_TOTAL = 250 * 1024 * 1024

/** El .zip: el chat y la carpeta «archivos». Lo que no se pudo bajar queda listado en «no-descargados.txt». */
export async function comoZip(nombreChat: string, chat: Buffer | string, lineas: Linea[]): Promise<Buffer> {
  const zip = new JSZip()
  zip.file(nombreChat, chat)
  const faltan: string[] = []
  let total = 0
  for (const l of lineas) {
    if (!l.archivo) continue
    try {
      const r = await fetch(l.archivo.url, { signal: AbortSignal.timeout(30_000) })
      if (!r.ok) throw new Error(`respondió ${r.status}`)
      const b = Buffer.from(await r.arrayBuffer())
      if (b.length > MAX_ARCHIVO) throw new Error('pesa más de 30 MB')
      if (total + b.length > MAX_TOTAL) throw new Error('el .zip ya llegó a 250 MB')
      total += b.length
      zip.file(`archivos/${l.archivo.nombre}`, b)
    } catch (e) {
      logger.warn(`[CRM exportar] ${l.archivo.url}: ${(e as Error)?.message ?? e}`)
      faltan.push(`${l.archivo.nombre}: ${(e as Error)?.message ?? 'no se pudo descargar'}`)
    }
  }
  if (faltan.length) zip.file('no-descargados.txt', ['Estos archivos no se pudieron descargar:', '', ...faltan, ''].join('\n'))
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}
