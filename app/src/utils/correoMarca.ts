/**
 * La plantilla de los correos del CRM (recuperar la contraseña y los que vengan): cabecera oscura con el logo,
 * franja amarilla, cuerpo blanco y pie con quién lo envía. Hecha con tablas y estilos en línea, que es lo que
 * respetan Gmail, Outlook y Apple Mail. El logo va por URL pública (CRM_CORREO_LOGO): los clientes de correo no
 * muestran imágenes incrustadas en base64.
 */
export const escaparHtml = (t: string) => t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))

const LOGO = () => process.env.CRM_CORREO_LOGO || 'https://www.nexcode97.com/email/logo-nexcode97.png'
const SITIO = () => process.env.CRM_CORREO_SITIO || 'https://www.nexcode97.com'
const AYUDA = () => process.env.CRM_CORREO_AYUDA || 'nexcode97@gmail.com'
const FUENTE = "Inter,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"

export interface CorreoMarca {
  /** El texto que Gmail muestra junto al asunto, antes de abrir el correo. */
  preencabezado: string
  titulo: string
  /** Párrafos en HTML ya escapado. */
  parrafos: string[]
  boton?: { texto: string; url: string }
  /** Recuadro gris debajo del botón (por ejemplo, cuándo vence el enlace). */
  aviso?: string
  /** Párrafo final en gris (por ejemplo, «si no fuiste tú…»). */
  nota?: string
}

export function correoMarca(c: CorreoMarca): string {
  const p = (html: string) => `<p style="margin:0 0 16px;font-family:${FUENTE};font-size:15px;line-height:1.6;color:#33333e">${html}</p>`
  const boton = c.boton ? `
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px">
            <tr><td bgcolor="#FFD21F" style="border-radius:10px">
              <a href="${escaparHtml(c.boton.url)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${FUENTE};font-size:15px;font-weight:700;color:#0a0a0d;text-decoration:none;border-radius:10px">${escaparHtml(c.boton.texto)}</a>
            </td></tr>
          </table>` : ''
  const aviso = c.aviso ? `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px">
            <tr><td bgcolor="#f4f4f6" style="border-radius:10px;padding:14px 16px;font-family:${FUENTE};font-size:13.5px;line-height:1.5;color:#4b4b57">${c.aviso}</td></tr>
          </table>` : ''
  const respaldo = c.boton ? `
          <p style="margin:0 0 20px;font-family:${FUENTE};font-size:12.5px;line-height:1.55;color:#6f6f7c">¿El botón no funciona? Copia y pega este enlace en tu navegador:<br>
            <a href="${escaparHtml(c.boton.url)}" target="_blank" style="color:#0a0a0d;word-break:break-all">${escaparHtml(c.boton.url)}</a></p>` : ''
  const nota = c.nota ? `<p style="margin:0;font-family:${FUENTE};font-size:13px;line-height:1.55;color:#6f6f7c">${c.nota}</p>` : ''
  const sitio = SITIO(), ayuda = AYUDA()
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escaparHtml(c.titulo)}</title>
</head>
<body style="margin:0;padding:0;background:#ececf0">
  <div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all">${escaparHtml(c.preencabezado)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ececf0">
    <tr><td align="center" style="padding:32px 12px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
        <tr><td bgcolor="#0a0a0d" style="border-radius:16px 16px 0 0;padding:26px 32px">
          <a href="${escaparHtml(sitio)}" target="_blank"><img src="${escaparHtml(LOGO())}" width="150" height="42" alt="NexCode97" style="display:block;border:0;outline:none;width:150px;height:auto"></a>
        </td></tr>
        <tr><td bgcolor="#FFD21F" height="4" style="font-size:0;line-height:0">&nbsp;</td></tr>
        <tr><td bgcolor="#ffffff" style="padding:36px 32px 28px">
          <h1 style="margin:0 0 16px;font-family:${FUENTE};font-size:22px;line-height:1.3;font-weight:700;color:#0a0a0d">${escaparHtml(c.titulo)}</h1>
          ${c.parrafos.map(p).join('\n          ')}${boton}${aviso}${respaldo}
          ${nota}
        </td></tr>
        <tr><td bgcolor="#ffffff" style="border-radius:0 0 16px 16px;padding:0 32px 28px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-top:1px solid #e6e6ec;padding-top:18px;font-family:${FUENTE};font-size:12px;line-height:1.6;color:#8a8a96">
            ¿Dudas? Escríbenos a <a href="mailto:${escaparHtml(ayuda)}" style="color:#4b4b57">${escaparHtml(ayuda)}</a>.<br>
            NexCode97 · Bucaramanga, Colombia · <a href="${escaparHtml(sitio)}/privacidad" target="_blank" style="color:#4b4b57">Política de privacidad</a>
          </td></tr></table>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}
