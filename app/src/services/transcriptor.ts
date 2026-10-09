// Transcriptor de notas de voz. El modelo de Anthropic no recibe audio y Gemini sí: el audio entra, sale texto.
// Es opcional: sin GEMINI_API_KEY las notas de voz se escuchan pero no se transcriben.

const GEMINI = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

export async function transcribirAudio(audio: Buffer, mime: string): Promise<string> {
  const llave = process.env.GEMINI_API_KEY
  if (!llave) throw new Error('No hay transcriptor de audio configurado (GEMINI_API_KEY)')
  const res = await fetch(GEMINI, {
    method: 'POST',
    headers: { 'x-goog-api-key': llave, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [
        { text: 'Transcribe este audio en español, tal cual lo dice la persona. Devuelve solo la transcripción, sin comentarios. Si no se entiende nada, devuelve [inaudible].' },
        { inline_data: { mime_type: mime.split(';')[0] || 'audio/webm', data: audio.toString('base64') } },
      ] }],
    }),
    signal: AbortSignal.timeout(90_000),
  })
  if (!res.ok) throw new Error(`El servicio de transcripción respondió ${res.status}`) // sin nombre del proveedor: el error puede llegar a la pantalla
  const datos = await res.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
  const texto = (datos.candidates?.[0]?.content?.parts ?? []).map(p => p.text ?? '').join('').trim()
  if (!texto || texto === '[inaudible]') throw new Error('No se entendió el audio')
  return texto
}
