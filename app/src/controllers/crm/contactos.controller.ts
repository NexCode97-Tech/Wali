import type { Request, Response } from 'express'
import { Prisma, type CrmContacto } from '@prisma/client'
import { z } from 'zod'
import * as XLSX from 'xlsx'
import { prisma } from '../../services/crm/bd'
import { ApiResponse } from '../../utils/response'
import { NotFoundError, ValidationError } from '../../utils/errors'
import { auditLog } from '../../utils/auditLogger'
import { contactoAFront, mapaNombres, telVisible } from '../../services/crm/formas'
import { idDeNombre } from '../../services/crm/usuarios'
import { emitirCrm } from '../../services/crm/tiempoReal'
import { fichaDeContacto } from '../../services/crm/fichaExterna'
import { contactoVisible, exigirContactoCompleto, exigirEscritura, exigirLider, idNum, mezclaProfunda, nombreArchivo, obj, txt, type Json } from './_comun'
import { alcanceDe, equiposDeReq, filtroContactos, genteQueLidera, reservaDeContacto, veContacto } from '../../services/crm/alcance'
import { actualizarContacto, correoValido, datosDeContacto, emitirContacto, exigirTelefonoLibre, telefonoValido } from './_contacto'
import { leerHoja } from './_hoja'
import { desbloquearEnWhatsapp } from './spam.controller'

/**
 * Contactos del CRM: crear, editar, borrar, importar desde Excel o CSV,
 * exportar, y el cruce con la plataforma (¿es cliente?, ¿cómo va con sus cuotas?).
 */

const contactoSchema = z.object({ contacto: z.record(z.unknown()) })
const cambiosSchema = z.object({ cambios: z.record(z.unknown()) })

async function salidaContacto(k: CrmContacto) {
  return contactoAFront(k, await mapaNombres())
}

export async function crearContacto(req: Request, res: Response) {
  exigirEscritura(req)
  const { contacto } = contactoSchema.parse(req.body)
  const c: Json = { ...contacto }
  delete c.contactoId; delete c.id
  if (!txt(c.tel) && !txt(c.correo)) throw new ValidationError('Falta el teléfono o el correo. Un contacto necesita al menos uno de los dos.')
  const datos = await datosDeContacto(c, null, true)
  const k = await prisma.crmContacto.create({
    data: {
      ...(datos as Prisma.CrmContactoUncheckedCreateInput),
      guardado: c.guardado === false ? false : true,
      canal: (datos.canal as string | undefined) ?? (txt(c.tel) ? 'wa' : 'mail'),
      asignadoId: (datos.asignadoId as string | null | undefined) ?? req.userId!,
    },
  })
  await emitirContacto(k.id, req.userId!)
  return ApiResponse.created(res, await salidaContacto(k))
}

export async function editarContacto(req: Request, res: Response) {
  exigirEscritura(req)
  const id = idNum(req.params.id, 'el contacto')
  // Un contacto reservado para los líderes no lo leen ni lo cambian las asesoras.
  await contactoVisible(req, id)
  const { cambios } = cambiosSchema.parse(req.body)
  // Sacar de spam (lote 7): si además estaba bloqueado en WhatsApp, se desbloquea antes de quitar la marca.
  if ('spam' in cambios && !cambios.spam) await desbloquearEnWhatsapp(id)
  // ficha, campos y extra se mezclan sobre la fila bloqueada, no sobre una copia leída antes.
  const { k, cambio } = await actualizarContacto(id, cambios, true)
  if (cambio) await emitirContacto(id, req.userId!)
  return ApiResponse.success(res, await salidaContacto(k))
}

export async function borrarContacto(req: Request, res: Response) {
  exigirEscritura(req)
  const id = idNum(req.params.id, 'el contacto')
  // Borrarlo se lleva todas sus conversaciones: tiene que verlo y ver todas sus conversaciones (29-sep).
  await contactoVisible(req, id)
  await exigirContactoCompleto(req, id)
  const k = await prisma.crmContacto.findUnique({ where: { id }, include: { conversaciones: { select: { id: true } } } })
  if (!k) throw new NotFoundError('Ese contacto ya no existe. Recarga Contactos.')
  await prisma.crmContacto.delete({ where: { id } })
  auditLog(req, 'DELETE', 'crm_contacto', String(id), { conversaciones: k.conversaciones.length })
  for (const c of k.conversaciones) emitirCrm({ tipo: 'conv-borrada', id: c.id }, req.userId!)
  emitirCrm({ tipo: 'contacto-borrado', id }, req.userId!)
  return ApiResponse.success(res, { id })
}

// ─── Importar ────────────────────────────────────────────────────────────────

const MAX_FILAS = 10_000

const plano = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

/** Nombres de columna aceptados (sin tildes ni mayúsculas) → campo. */
const COLUMNAS: [string, string[]][] = [
  ['nombre', ['nombre', 'nombre completo', 'name', 'full name', 'contacto', 'cliente', 'nombre del cliente']],
  ['nombres', ['nombres', 'primer nombre', 'first name']],
  ['apellidos', ['apellidos', 'apellido', 'last name']],
  ['tel', ['telefono', 'tel', 'celular', 'whatsapp', 'movil', 'numero', 'phone', 'telefono celular', 'numero de whatsapp', 'numero de celular', 'mobile']],
  ['correo', ['correo', 'email', 'e mail', 'correo electronico', 'mail']],
  ['ciudad', ['ciudad', 'city', 'municipio']],
  ['etapa', ['etapa', 'etapa del embudo']],
  ['etiquetas', ['etiquetas', 'etiqueta', 'tags', 'tag']],
  ['asesor', ['asesor', 'asesora', 'asignado', 'asignada', 'agente', 'vendedor']],
  ['producto', ['producto', 'producto de interes', 'servicio', 'interes']],
  ['empresa', ['empresa', 'compania', 'organizacion', 'razon social']],
  ['origen', ['origen', 'fuente', 'como llego', 'canal de origen']],

]
const campoDe = (encabezado: string) => {
  const p = plano(encabezado)
  return COLUMNAS.find(([, alias]) => alias.includes(p))?.[0] ?? null
}

/** Topes por celda: un Excel no puede meter textos enormes en la ficha. */
const corto = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max)
const esUnico = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'

export async function importarContactos(req: Request, res: Response) {
  exigirEscritura(req)
  // Importar en bloque es de líderes: además la librería de Excel (xlsx 0.18.5) tiene fallas conocidas
  // con archivos manipulados, así que solo gente de confianza sube archivos (y con tope de tamaño y filas).
  exigirLider(req, 'importar contactos')
  const archivo = req.file
  if (!archivo) throw new ValidationError('Falta el archivo. Súbelo en el campo «archivo» (Excel o CSV).')
  const nombre = nombreArchivo(archivo)
  if (!/\.(xlsx|xls|csv|txt)$/i.test(nombre)) throw new ValidationError('Ese tipo de archivo no se puede importar. Usa Excel (.xlsx) o CSV.')
  // Celdas como texto (sin notación científica), con tope de tamaño, de memoria y de filas: ver _hoja.ts.
  const filas = await leerHoja(archivo.buffer, nombre, MAX_FILAS)
  if (!filas.length) throw new ValidationError('El archivo no tiene filas. La primera fila debe ser de encabezados y los contactos van debajo.')
  if (filas.length > MAX_FILAS) throw new ValidationError(`El archivo tiene más de ${MAX_FILAS.toLocaleString('es-CO')} filas, el máximo por importación. Divídelo en varios archivos.`)
  // Un contacto que ya existe solo se cambia si quien importa lo ve (alcance.ts).
  const alcance = await alcanceDe(req)
  const gente = alcance.todo ? [] : genteQueLidera(alcance, await equiposDeReq(req))

  const encabezados = Object.keys(filas[0])
  const mapa = new Map(encabezados.map(h => [h, campoDe(h)]))
  const reconocidos = new Set([...mapa.values()].filter(Boolean))
  if (!reconocidos.has('tel') && !reconocidos.has('correo')) {
    throw new ValidationError(`No encontré una columna de teléfono ni de correo. Encabezados del archivo: ${encabezados.slice(0, 12).join(', ')}. Nombra una columna «Teléfono» (o Celular, WhatsApp) o «Correo».`)
  }

  let nuevos = 0, actualizados = 0
  const errores: { fila: number; motivo: string }[] = []
  const tocados: number[] = []
  const asesores = new Map<string, string | null>()

  for (let i = 0; i < filas.length; i++) {
    const numFila = i + 2 // la fila 1 es de encabezados
    const f: Json = {}
    for (const [h, v] of Object.entries(filas[i])) { const c = mapa.get(h); if (c && txt(String(v ?? ''))) f[c] = corto(v, 500) }
    if (!Object.keys(f).length) continue
    try {
      const tel = f.tel ? telefonoValido(f.tel) : null
      const correo = f.correo ? correoValido(f.correo) : null
      if (!tel && !correo) { errores.push({ fila: numFila, motivo: 'Falta el teléfono y el correo' }); continue }
      const nombreC = corto(txt(f.nombre) || [txt(f.nombres), txt(f.apellidos)].filter(Boolean).join(' '), 120) || null
      const etapa = f.etapa ? corto(f.etapa, 80) : null
      let asignadoId: string | null = null
      if (f.asesor) {
        const clave = String(f.asesor).toLowerCase()
        if (!asesores.has(clave)) asesores.set(clave, await idDeNombre(String(f.asesor)))
        asignadoId = asesores.get(clave) ?? null
        if (!asignadoId) errores.push({ fila: numFila, motivo: `Se importó sin asesor: no encontré a «${f.asesor}» en Ventas` })
      }
      const tags = f.etiquetas ? [...new Set(String(f.etiquetas).split(/[,;|]/).map(t => corto(t, 60)).filter(Boolean))].slice(0, 50) : []
      const fichaNueva: Json = {}
      for (const k of ['ciudad', 'origen']) if (f[k]) fichaNueva[k] = f[k]
      const camposNuevos: Json = {}
      for (const k of ['producto', 'empresa']) if (f[k]) camposNuevos[k] = f[k]

      let existente = tel ? await prisma.crmContacto.findFirst({ where: { telefono: tel }, select: { id: true } }) : null
      if (!existente && correo) existente = await prisma.crmContacto.findFirst({ where: { correo: { equals: correo, mode: 'insensitive' } }, orderBy: { updatedAt: 'desc' }, select: { id: true } })

      if (existente) {
        const id = existente.id
        // Un contacto reservado para los líderes de otro equipo, o que no ve, no se cambia (ni por archivo).
        if (!alcance.todo) {
          const reservado = await reservaDeContacto(alcance, id)
          if (reservado) { errores.push({ fila: numFila, motivo: `Es un contacto reservado para los líderes de ${reservado}: no se cambió` }); continue }
          if (!(await veContacto(alcance, id, gente))) { errores.push({ fila: numFila, motivo: 'Es un contacto de otro equipo: no se cambió' }); continue }
        }
        // Solo se llenan datos que vengan en el archivo; lo que ya hay no se borra con celdas vacías.
        // Se mezcla sobre la fila bloqueada y leída en ese instante (etiquetas, ficha y campos).
        await prisma.$transaction(async tx => {
          await tx.$queryRaw`SELECT id FROM crm_contactos WHERE id = ${id} FOR UPDATE`
          const k = await tx.crmContacto.findUnique({ where: { id } })
          if (!k) throw new NotFoundError('El contacto se borró mientras se importaba')
          if (tel && !k.telefono) await exigirTelefonoLibre(tel, id)
          await tx.crmContacto.update({
            where: { id },
            data: {
              ...(nombreC ? { nombre: nombreC } : {}),
              ...(tel && !k.telefono ? { telefono: tel } : {}),
              ...(correo ? { correo } : {}),
              ...(etapa ? { etapa } : {}),
              ...(asignadoId ? { asignadoId } : {}),
              ...(tags.length ? { tags: [...new Set([...k.tags, ...tags])] } : {}),
              ...(Object.keys(fichaNueva).length ? { ficha: mezclaProfunda(k.ficha, fichaNueva) as Prisma.InputJsonValue } : {}),
              ...(Object.keys(camposNuevos).length ? { campos: mezclaProfunda(k.campos, camposNuevos) as Prisma.InputJsonValue } : {}),
              guardado: true,
            },
          })
        }, { timeout: 20_000 })
        actualizados++
        tocados.push(id)
      } else {
        const k = await prisma.crmContacto.create({
          data: {
            nombre: nombreC, telefono: tel, correo, etapa, asignadoId,
            tags, ficha: fichaNueva as Prisma.InputJsonValue, campos: camposNuevos as Prisma.InputJsonValue,
            guardado: true, canal: tel ? 'wa' : 'mail',
          },
        })
        nuevos++
        tocados.push(k.id)
      }
    } catch (e) {
      const motivo = esUnico(e) ? 'Ese teléfono ya es de otro contacto (se creó mientras se importaba)' : (e as Error)?.message ?? 'Error desconocido'
      errores.push({ fila: numFila, motivo: motivo.slice(0, 300) })
    }
  }

  // Tiempo real: uno por uno si son pocos; si son muchos, un solo aviso para recargar.
  const unicos = [...new Set(tocados)]
  if (unicos.length <= 300) for (const id of unicos) await emitirContacto(id, req.userId!)
  else emitirCrm({ tipo: 'contactos-importados', nuevos, actualizados }, req.userId!)
  auditLog(req, 'CREATE', 'crm_contactos_importados', undefined, { archivo: nombre, nuevos, actualizados, errores: errores.length })
  return ApiResponse.success(res, { nuevos, actualizados, errores })
}

// ─── Exportar ────────────────────────────────────────────────────────────────

const fecha = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '')

export async function exportarContactos(req: Request, res: Response) {
  // Solo los contactos que ve (alcance.ts): el administrador sin equipo, toda la base; el líder, los de su equipo;
  // los demás, los suyos y los de sus conversaciones. Nunca los reservados para los líderes de otro equipo.
  const alcance = await alcanceDe(req)
  const where: Prisma.CrmContactoWhereInput = filtroContactos(alcance, alcance.todo ? [] : genteQueLidera(alcance, await equiposDeReq(req)))
  const [contactos, nombres] = await Promise.all([
    prisma.crmContacto.findMany({ where, orderBy: { createdAt: 'asc' }, include: { conversaciones: { select: { ultimoMensajeAt: true }, orderBy: { ultimoMensajeAt: 'desc' }, take: 1 } } }),
    mapaNombres(),
  ])
  const filas = contactos.map(k => {
    const ficha = obj(k.ficha), campos = obj(k.campos)
    const nc = k.noContactar
    return {
      Nombre: k.nombre ?? '',
      Teléfono: telVisible(k.telefono),
      Correo: k.correo ?? '',
      Canal: k.canal,
      Etapa: k.etapa ?? '',
      Etiquetas: k.tags.join(', '),
      Asesor: k.asignadoId ? nombres.get(k.asignadoId) ?? '' : '',
      Ciudad: txt(ficha.ciudad),
      Origen: txt(ficha.origen),
      Producto: txt(campos.producto),
      Empresa: txt(campos.empresa),
      'No contactar': nc ? (typeof nc === 'string' ? nc : txt(obj(nc).motivo) || 'Sí') : '',
      Creado: fecha(k.createdAt),
      'Último mensaje': fecha(k.conversaciones[0]?.ultimoMensajeAt),
    }
  })
  const hoja = XLSX.utils.json_to_sheet(filas.length ? filas : [{ Nombre: '', Teléfono: '', Correo: '' }])
  hoja['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 30 }, { wch: 6 }, { wch: 16 }, { wch: 24 }, { wch: 20 }, { wch: 16 }, { wch: 24 }, { wch: 28 }, { wch: 8 }, { wch: 24 }, { wch: 18 }, { wch: 12 }, { wch: 14 }]
  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja, 'Contactos')
  const buffer = XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }) as Buffer
  auditLog(req, 'CREATE', 'crm_contactos_exportados', undefined, { filas: filas.length })
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  res.setHeader('Content-Disposition', `attachment; filename="contactos-crm-${new Date().toISOString().slice(0, 10)}.xlsx"`)
  return res.send(buffer)
}

// ─── Cruce con la plataforma ─────────────────────────────────────────────────

export async function fichaExternaDeContacto(req: Request, res: Response) {
  const id = idNum(req.params.contactoId, 'el contacto')
  // Compras, pagos y casos de recuperación: de un contacto reservado, solo los líderes.
  await contactoVisible(req, id)
  const r = await fichaDeContacto(id)
  if (!r) throw new NotFoundError('Ese contacto ya no existe. Recarga la bandeja.')
  if (r.cambio) await emitirContacto(id, req.userId!)
  return ApiResponse.success(res, r.ficha)
}
