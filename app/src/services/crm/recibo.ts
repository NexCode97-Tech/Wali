import { jsPDF } from 'jspdf'
import type { CrmPago } from '@prisma/client'

/**
 * El recibo en PDF de un cobro del plan (Ajustes → Plan y pagos → Descargar). Es un comprobante del pago: la
 * factura con impuestos la emite Creem, que cobra como Merchant of Record, y está en su portal de pagos.
 */
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
/** Colombia no cambia de hora: UTC-5. */
const bog = (d: Date) => new Date(d.getTime() - 5 * 3_600_000)
const dia = (d: Date) => { const b = bog(d); return `${b.getUTCDate()} ${MESES[b.getUTCMonth()]} ${b.getUTCFullYear()}` }
export const dinero = (centavos: number, moneda: string) =>
  `${moneda} ${(centavos / 100).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const NOMBRES: Record<string, string> = { starter: 'Starter', growth: 'Growth', business: 'Business' }

export const nombreRecibo = (p: Pick<CrmPago, 'numero'>) => `Recibo-NX-${p.numero}.pdf`

export function reciboPdf(p: CrmPago, empresa: string, correo: string): Buffer {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  const ancho = doc.internal.pageSize.getWidth(), m = 22
  const tinta: [number, number, number] = [15, 15, 23], gris: [number, number, number] = [107, 112, 128]

  // Encabezado oscuro con la marca y la franja amarilla.
  doc.setFillColor(11, 11, 16); doc.rect(0, 0, ancho, 40, 'F')
  doc.setFillColor(255, 210, 31); doc.rect(0, 40, ancho, 2.2, 'F')
  doc.setFillColor(255, 210, 31); doc.circle(m + 6, 20, 6, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(11, 11, 16); doc.text('N', m + 6, 22.2, { align: 'center' })
  doc.setFontSize(15); doc.setTextColor(255, 255, 255); doc.text('NexCode97', m + 16, 19)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(201, 201, 211); doc.text('CRM · nexcode97.com', m + 16, 24.5)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(255, 210, 31); doc.text('RECIBO DE PAGO', ancho - m, 19, { align: 'right' })
  doc.setFont('helvetica', 'normal'); doc.setTextColor(255, 255, 255); doc.text(`NX-${p.numero}`, ancho - m, 24.5, { align: 'right' })

  // Para quién y cuándo.
  let y = 60
  const par = (etq: string, val: string, x: number) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...gris); doc.text(etq.toUpperCase(), x, y)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...tinta); doc.text(val, x, y + 6)
  }
  par('Empresa', empresa.slice(0, 48), m)
  par('Fecha del pago', dia(p.fecha), ancho / 2 + 10)
  y += 18
  par('Correo', correo.slice(0, 48), m)
  par('Estado', p.estado === 'reembolsado' ? 'Reembolsado' : 'Pagado', ancho / 2 + 10)

  // Detalle.
  y += 22
  doc.setDrawColor(229, 231, 238); doc.setLineWidth(0.3)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...gris)
  doc.text('CONCEPTO', m, y); doc.text('MONTO', ancho - m, y, { align: 'right' })
  y += 3; doc.line(m, y, ancho - m, y); y += 9
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...tinta)
  doc.text(`Plan ${NOMBRES[p.plan] ?? p.plan} · ${p.periodo === 'anual' ? 'anual' : 'mensual'}`, m, y)
  doc.text(dinero(p.subtotal, p.moneda), ancho - m, y, { align: 'right' })
  if (p.desde && p.hasta) { doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...gris); doc.text(`Del ${dia(p.desde)} al ${dia(p.hasta)}`, m, y + 5.5) }
  y += 14; doc.line(m, y, ancho - m, y); y += 9

  const fila = (etq: string, val: string, fuerte = false) => {
    doc.setFont('helvetica', fuerte ? 'bold' : 'normal'); doc.setFontSize(fuerte ? 13 : 10.5); doc.setTextColor(...(fuerte ? tinta : gris))
    doc.text(etq, ancho - m - 60, y); doc.setTextColor(...tinta); doc.text(val, ancho - m, y, { align: 'right' }); y += fuerte ? 10 : 7
  }
  fila('Subtotal', dinero(p.subtotal, p.moneda))
  fila('Impuestos', dinero(p.impuestos, p.moneda))
  doc.line(ancho - m - 60, y - 3, ancho - m, y - 3); y += 3
  fila('Total pagado', dinero(p.total, p.moneda), true)
  if (p.reembolso) { doc.setTextColor(185, 28, 28); fila('Reembolsado', `- ${dinero(p.reembolso, p.moneda)}`) }

  // Sello.
  const sello = p.estado === 'reembolsado' ? 'REEMBOLSADO' : 'PAGADO'
  const verde: [number, number, number] = p.estado === 'reembolsado' ? [185, 28, 28] : [22, 163, 74]
  doc.setDrawColor(...verde); doc.setLineWidth(0.8); doc.setTextColor(...verde); doc.setFont('helvetica', 'bold'); doc.setFontSize(14)
  const w = doc.getTextWidth(sello) + 10
  doc.roundedRect(m, y - 12, w, 11, 1.5, 1.5, 'S'); doc.text(sello, m + 5, y - 4.4)

  // Nota legal.
  y += 16
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.8); doc.setTextColor(...gris)
  doc.text(doc.splitTextToSize('Este recibo es un comprobante del pago de tu plan del CRM. El cobro lo procesa Creem como Merchant of Record: la factura con los impuestos de tu país la emite Creem y la encuentras en el CRM, en Ajustes > Plan y pagos > Facturas y tarjeta.', ancho - 2 * m), m, y)

  // Pie.
  doc.setFontSize(8.5); doc.text('NexCode97 · www.nexcode97.com · ¿Dudas con un cobro? Escríbenos a nexcode97@gmail.com', ancho / 2, doc.internal.pageSize.getHeight() - 14, { align: 'center' })
  return Buffer.from(doc.output('arraybuffer'))
}
