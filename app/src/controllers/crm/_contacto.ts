import type { CrmContacto, Prisma } from '@prisma/client'
import { prisma, type TxCrm } from '../../services/crm/bd'
import { ConflictError, NotFoundError, ValidationError } from '../../utils/errors'
import { telDigitos, telVisible, contactoAFront, mapaNombres } from '../../services/crm/formas'
import { idDeNombre, usuariosCrm } from '../../services/crm/usuarios'
import { emitirConv, emitirCrm } from '../../services/crm/tiempoReal'
import { convVigente, mezclaProfunda, obj, txt, type Json } from './_comun'

/**
 * De los nombres de la maqueta (`n`, `tel`, `etq`, `aut`…) a las columnas de
 * `crm_contactos`. Lo que no es columna va a `extra`.
 */

export const CANALES = ['wa', 'ig', 'fb', 'web', 'mail'] as const

/** Claves de la pantalla que son del contacto (contrato §4, PATCH de conversación). */
export const CLAVES_CONTACTO = new Set(['n', 'tel', 'ficha', 'campos', 'tags', 'etq', 'etapa', 'menor', 'aut', 'rep', 'rne', 'noContactar', 'permisoLlamada', 'guardado', 'correo', 'pauta'])

const json = (v: unknown) => (v === null || v === undefined ? null : v) as Prisma.InputJsonValue

export function telefonoValido(tel: unknown): string | null {
  const s = txt(tel)
  if (!s) return null
  // 5.73001E+11: Excel lo recortó a 6 cifras; quitarle lo que no es dígito daría otro número.
  if (/^[+\s]*\d+(?:[.,]\d+)?\s*e\s*[+-]?\d+\s*$/i.test(s)) throw new ValidationError(`El teléfono «${s}» viene en notación científica y le faltan cifras. En el Excel, pon la columna del teléfono como texto y escribe el número completo.`)
  const d = telDigitos(s)
  if (!d || d.length < 7 || d.length > 15) throw new ValidationError(`El teléfono «${s}» no parece válido. Escríbelo con indicativo, por ejemplo +57 300 123 4567.`)
  return d
}

export function correoValido(correo: unknown): string | null {
  const s = txt(correo).toLowerCase()
  if (!s) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new ValidationError(`El correo «${s}» no es válido. Revisa que tenga @ y el dominio completo.`)
  return s
}

/** ¿El número ya es de otro contacto? */
export async function exigirTelefonoLibre(tel: string | null, contactoId?: number) {
  if (!tel) return
  const otro = await prisma.crmContacto.findFirst({ where: { telefono: tel }, select: { id: true, nombre: true, conversaciones: { where: { soloLider: true }, select: { id: true }, take: 1 } } })
  if (otro && otro.id !== contactoId) {
    // El nombre de un contacto reservado para los líderes no se muestra.
    if (otro.conversaciones.length) throw new ConflictError(`El número ${telVisible(tel)} ya es de un contacto reservado para los líderes de Ventas. Pídele a tu líder que revise si son la misma persona.`)
    throw new ConflictError(`El número ${telVisible(tel)} ya es de otro contacto (${otro.nombre || 'sin nombre'}). Si son la misma persona, únelos con «Unir» en lugar de repetir el número.`)
  }
}

const etiquetas = (v: unknown): string[] => {
  if (!Array.isArray(v)) throw new ValidationError('Las etiquetas deben ser una lista de textos.')
  return [...new Set(v.map(x => txt(x)).filter(Boolean))].slice(0, 50)
}

/**
 * Traduce los cambios de la pantalla a datos del contacto. `extraLibre`:
 * las claves desconocidas van a `contacto.extra` (rutas de Contactos); en el
 * PATCH de conversación esas van a la conversación, así que no se pasan aquí.
 * `ficha`, `campos` y `extra` se MEZCLAN sobre `actual` (subclave por
 * subclave, `null` borra): `actual` tiene que ser la fila leída con el candado
 * puesto (actualizarContacto), no una copia de antes.
 */
export async function datosDeContacto(cambios: Json, actual: CrmContacto | null, extraLibre: boolean): Promise<Prisma.CrmContactoUncheckedUpdateInput> {
  const d: Prisma.CrmContactoUncheckedUpdateInput = {}
  const extraCambios: Json = {}
  let tocoExtra = false
  for (const [k, v] of Object.entries(cambios)) {
    switch (k) {
      case 'n': d.nombre = txt(v).slice(0, 120) || null; break
      case 'tel': {
        const tel = telefonoValido(v)
        await exigirTelefonoLibre(tel, actual?.id)
        d.telefono = tel
        break
      }
      case 'correo': d.correo = correoValido(v); break
      case 'canal':
        if (!CANALES.includes(v as typeof CANALES[number])) throw new ValidationError(`El canal «${String(v)}» no existe. Usa wa, ig, fb, web o mail.`)
        d.canal = v as string
        break
      case 'etq': d.etapa = Array.isArray(v) ? (txt(v[0]) || null) : (txt(v) || null); break
      case 'etapa': d.etapa = txt(v) || null; break
      case 'tags': d.tags = etiquetas(v); break
      case 'campos':
        if (v !== null && (typeof v !== 'object' || Array.isArray(v))) throw new ValidationError('«campos» debe ser un objeto con los datos del contacto.')
        d.campos = mezclaProfunda(actual?.campos, v) as Prisma.InputJsonValue
        break
      case 'ficha': {
        if (v !== null && (typeof v !== 'object' || Array.isArray(v))) throw new ValidationError('«ficha» debe ser un objeto con los datos del contacto.')
        const f = { ...obj(v) }
        // El correo de la ficha es la columna `correo` del contacto.
        if ('correo' in f) { if (!('correo' in cambios)) d.correo = correoValido(f.correo); delete f.correo }
        d.ficha = mezclaProfunda(actual?.ficha, f) as Prisma.InputJsonValue
        break
      }
      case 'menor': d.menor = Boolean(v); break
      case 'guardado': d.guardado = Boolean(v); break
      case 'aut': d.autorizacion = json(v); break
      case 'rep': d.representante = json(v); break
      case 'rne': d.rne = json(v); break
      case 'noContactar': d.noContactar = v === false || v === '' ? json(null) : json(v); break
      case 'permisoLlamada': d.permisoLlamada = json(v); break
      case 'pauta': d.pauta = json(v); break
      case 'asig': case 'asigId': {
        const id = k === 'asig' ? await idDeNombre(txt(v) || null) : (txt(v) || null)
        if (v && !id) throw new ValidationError(`No encontré a «${String(v)}» entre las personas de Ventas. Elígela de la lista.`)
        if (id && !(await usuariosCrm()).some(u => u.id === id)) throw new ValidationError('Esa persona no está en el equipo de Ventas. Elígela de la lista.')
        d.asignadoId = id
        break
      }
      default:
        // El número de cliente lo pone la base de datos: nadie lo cambia.
        if (!extraLibre || k.startsWith('_') || ['contactoId', 'id', '_t', 'numero'].includes(k)) break
        extraCambios[k] = v === undefined ? null : v
        tocoExtra = true
    }
  }
  if (tocoExtra) d.extra = mezclaProfunda(actual?.extra, extraCambios, false) as Prisma.InputJsonValue
  return d
}

/**
 * Cambia un contacto con su fila bloqueada (SELECT … FOR UPDATE) y leída
 * dentro de la misma transacción: `ficha`, `campos` y `extra` se mezclan sobre
 * lo que hay en ese instante, no sobre una copia leída antes. `fijos` son
 * datos ya resueltos que se ponen tal cual (por ejemplo, el asesor).
 * `tx`: si ya hay una transacción abierta, se usa esa.
 */
export async function actualizarContacto(
  id: number, cambios: Json, extraLibre: boolean,
  fijos: Prisma.CrmContactoUncheckedUpdateInput = {}, tx?: TxCrm,
): Promise<{ k: CrmContacto; cambio: boolean }> {
  const hacer = async (t: TxCrm) => {
    await t.$queryRaw`SELECT id FROM crm_contactos WHERE id = ${id} FOR UPDATE`
    const actual = await t.crmContacto.findUnique({ where: { id } })
    if (!actual) throw new NotFoundError('Ese contacto ya no existe. Recarga Contactos.')
    const datos = { ...(Object.keys(cambios).length ? await datosDeContacto(cambios, actual, extraLibre) : {}), ...fijos }
    if (!Object.keys(datos).length) return { k: actual, cambio: false }
    return { k: await t.crmContacto.update({ where: { id }, data: datos }), cambio: true }
  }
  return tx ? hacer(tx) : prisma.$transaction(hacer, { timeout: 20_000 })
}

/**
 * Tras cambiar un contacto: si tiene conversaciones vigentes (las mismas que
 * trae /inicio), se emiten, porque ahí vive en la pantalla; si no, se emite
 * como contacto suelto (`CT_EXTRA`), igual que lo manda /inicio. Así una
 * conversación finalizada hace más de 60 días no reaparece en la bandeja.
 * Excepción: un contacto reservado para los líderes sin conversaciones
 * vigentes no sale como contacto suelto (le llegaría a las asesoras); se
 * emiten sus conversaciones «solo líder», que el tiempo real manda solo a los líderes.
 */
export async function emitirContacto(contactoId: number, por: string | null) {
  const k = await prisma.crmContacto.findUnique({
    where: { id: contactoId },
    include: { conversaciones: { select: { id: true, soloLider: true, estado: true, finalizadaAt: true } } },
  })
  if (!k) return null
  const vigentes = await prisma.crmConversacion.findMany({ where: { contactoId, ...convVigente() }, select: { id: true } })
  if (vigentes.length) {
    for (const c of vigentes) await emitirConv(c.id, por)
  } else if (k.conversaciones.some(c => c.soloLider)) {
    for (const c of k.conversaciones) if (c.soloLider) await emitirConv(c.id, por)
  } else {
    emitirCrm({ tipo: 'contacto', contacto: contactoAFront(k, await mapaNombres()) }, por)
  }
  return k
}
