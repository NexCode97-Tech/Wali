import crypto from 'crypto'

/**
 * Cifrado de las claves de los canales que conecta cada espacio (tokens de Meta,
 * claves secretas de apps, contraseñas de correo): AES-256-GCM. Se guardan en
 * `crm_conexiones.secretos` y nunca salen del servidor.
 *
 * La llave es CRM_CLAVE_CIFRADO (32 bytes en hex o base64) si existe; si no, se
 * deriva de AUTH_SECRET con HKDF. Cada texto cifrado lleva la huella de la
 * llave con que se cifró: si la llave cambia, `descifrar` lo dice en vez de
 * devolver basura, y la conexión queda para volver a conectar.
 */
function llave(): Buffer {
  const propia = (process.env.CRM_CLAVE_CIFRADO ?? '').trim()
  if (propia) {
    const b = /^[0-9a-f]{64}$/i.test(propia) ? Buffer.from(propia, 'hex') : Buffer.from(propia, 'base64')
    if (b.length !== 32) throw new Error('CRM_CLAVE_CIFRADO debe tener 32 bytes (64 caracteres en hex)')
    return b
  }
  const base = process.env.AUTH_SECRET ?? ''
  if (!base) throw new Error('No hay con qué cifrar las claves de los canales: falta AUTH_SECRET')
  return Buffer.from(crypto.hkdfSync('sha256', base, 'crm-conexiones', 'claves de los canales del CRM', 32))
}

const huella = (k: Buffer) => crypto.createHash('sha256').update(k).digest('hex').slice(0, 8)

export function cifrar(datos: Record<string, unknown>): string {
  const k = llave()
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv('aes-256-gcm', k, iv)
  const cuerpo = Buffer.concat([c.update(JSON.stringify(datos), 'utf8'), c.final()])
  return ['v1', huella(k), iv.toString('base64'), c.getAuthTag().toString('base64'), cuerpo.toString('base64')].join(':')
}

export class LlaveCambiada extends Error {
  constructor() { super('Las claves de esta conexión se guardaron con otra llave de cifrado: vuelve a conectarla') }
}

export function descifrar<T = Record<string, unknown>>(texto: string | null | undefined): T {
  if (!texto) return {} as T
  const [v, h, iv, tag, cuerpo] = texto.split(':')
  if (v !== 'v1' || !iv || !tag || !cuerpo) throw new Error('Las claves de esta conexión están dañadas: vuelve a conectarla')
  const k = llave()
  if (h !== huella(k)) throw new LlaveCambiada()
  const d = crypto.createDecipheriv('aes-256-gcm', k, Buffer.from(iv, 'base64'))
  d.setAuthTag(Buffer.from(tag, 'base64'))
  return JSON.parse(Buffer.concat([d.update(Buffer.from(cuerpo, 'base64')), d.final()]).toString('utf8')) as T
}
