// Transcriptor de notas de voz. El modelo de Anthropic no recibe audio y Gemini sí: el audio entra, sale texto.
// Es opcional: sin GEMINI_API_KEY las notas de voz se escuchan pero no se transcriben.

// Google retira modelos sin aviso (gemini-2.5-flash dejó de existir el 19-nov y respondía 404). Se prueban en orden
// y el que responda queda fijado mientras el servidor siga arriba; un 404 pasa al siguiente.
const MODELOS = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-flash']
let modeloBueno: string | null = null
const urlModelo = (m: string) => `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`

/** Falla del servicio (sin clave, clave mala, cuota, caída), no del audio: se avisa a Sentry y al cliente no se le muestran detalles. */
export class ErrorTranscriptor extends Error {}

export async function transcribirAudio(audio: Buffer, mime: string): Promise<string> {
  const llave = process.env.GEMINI_API_KEY
  if (!llave) throw new ErrorTranscriptor('Falta GEMINI_API_KEY: las notas de voz no se pueden transcribir')
  const cuerpo = JSON.stringify({
    contents: [{ parts: [
      { text: 'Transcribe este audio en español, tal cual lo dice la persona. Devuelve solo la transcripción, sin comentarios. Si no se entiende nada, devuelve [inaudible].' },
      { inline_data: { mime_type: mime.split(';')[0] || 'audio/webm', data: audio.toString('base64') } },
    ] }],
  })
  const orden = modeloBueno ? [modeloBueno, ...MODELOS.filter(m => m !== modeloBueno)] : MODELOS
  let res: Response | null = null
  for (const m of orden) {
    res = await fetch(urlModelo(m), {
      method: 'POST',
      headers: { 'x-goog-api-key': llave, 'Content-Type': 'application/json' },
      body: cuerpo,
      signal: AbortSignal.timeout(90_000),
    })
    if (res.status !== 404) { if (res.ok) modeloBueno = m; break }
  }
  if (!res || !res.ok) throw new ErrorTranscriptor(`Gemini respondió ${res?.status}: ${(await res?.text().catch(() => '') ?? '').slice(0, 300)}`)
  const datos = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  const texto = (datos.candidates?.[0]?.content?.parts ?? []).map(p => p.text ?? '').join('').trim()
  if (!texto || texto === '[inaudible]') throw new Error('No se entendió el audio')
  return texto
}
