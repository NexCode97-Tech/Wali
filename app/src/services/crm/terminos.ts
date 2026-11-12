import type { CrmContacto, CrmLinea, Prisma } from '@prisma/client'
import { prisma, prismaGlobal } from './bd'
import { espacioActual, enEspacio } from './espacio'
import { guardarAjuste, leerAjuste } from './ajustes'
import { credDeLinea } from './credenciales'
import { graph } from './whatsapp'
import { crearYPublicar, listarFlows } from './encuesta'
import { guardarMensaje } from './salientes'
import { marcarAutorizacion } from './autorizacion'
import { logger } from '../../utils/logger'
import { esUrlDeWali } from '../almacen'

/**
 * Términos y condiciones de cada empresa (maqueta B aprobada el 5-nov, Protección de datos).
 *
 * La empresa sube un PDF y queda un enlace público que siempre abre la última versión. Si «Pedirlos antes de solicitar
 * una llamada» está encendido, quien no aceptó esa versión recibe primero un formulario de WhatsApp (Flow) con la casilla
 * y su enlace; si le falta la autorización de datos, trae también esa casilla. Al aceptar, sale solo el permiso de llamada:
 * Meta no deja modificar ese mensaje ni combinarlo con otros componentes, por eso son dos mensajes.
 *
 * Enviar formularios exige negocio verificado y buena calidad: si Meta no lo deja, sale un mensaje con el enlace y los
 * botones Acepto y No acepto. Todo va dentro de las 24 horas, sin plantillas.
 *
 * Nada toca schema.prisma: el ajuste `terminos`, el estado del formulario en `_terminosFormularios` y cada aceptación en
 * contacto.extra._terminos (con fecha, versión y cómo aceptó). Lo pendiente de enviar, en contacto.extra._terminosPend.
 */

type Json = Record<string, any>
const obj = (v: unknown): Json => (v && typeof v === 'object' && !Array.isArray(v) ? v as Json : {})
const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export interface VersionTerminos { version: number; url: string; nombre: string; cuando: string; por: string | null }
export interface CfgTerminos { pedir: boolean; actual: VersionTerminos | null; historial: VersionTerminos[] }

const CLAVE = 'terminos'
const CLAVE_FORMULARIOS = '_terminosFormularios'
const NOMBRE_FORMULARIO = 'terminos_y_condiciones_v1'
const PANTALLA = 'TERMINOS'
const TOKEN = /^tyc_(\d{1,12})_(\d{1,6})$/
const BOTON = /^tyc_(si|no)_(\d{1,12})_(\d{1,6})$/
const TEXTO_PEDIDO = (nombre: string) => `Hola${nombre ? ` ${nombre}` : ''}, para poder llamarte por WhatsApp primero necesitamos que aceptes nuestros términos y condiciones.`

const FORMULARIO_JSON = {
  version: '6.3',
  screens: [{
    id: PANTALLA, title: 'Términos y condiciones', terminal: true, success: true,
    data: {
      empresa: { type: 'string', __example__: 'Mi Empresa' },
      url: { type: 'string', __example__: 'https://walicrm.com/t/mi-empresa' },
      version: { type: 'string', __example__: '1' },
      pedir_datos: { type: 'boolean', __example__: true },
      texto_datos: { type: 'string', __example__: 'Autorizo a tratar mis datos personales.' },
    },
    layout: {
      type: 'SingleColumnLayout',
      children: [
        { type: 'TextSubheading', text: '${data.empresa}' },
        { type: 'TextBody', text: 'Léelos y acepta para que podamos llamarte por WhatsApp.' },
        {
          type: 'Form', name: 'f',
          children: [
            { type: 'OptIn', name: 'terminos', label: 'Acepto los términos y condiciones.', required: true, 'on-click-action': { name: 'open_url', url: '${data.url}' } },
            { type: 'If', condition: '${data.pedir_datos}', then: [
              { type: 'TextCaption', text: '${data.texto_datos}' },
              { type: 'OptIn', name: 'datos', label: 'Autorizo el tratamiento de mis datos personales.', required: true },
            ] },
            { type: 'Footer', label: 'Continuar', 'on-click-action': { name: 'complete', payload: { terminos: '${form.terminos}', datos: '${form.datos}', version: '${data.version}' } } },
          ],
        },
      ],
    },
  }],
}

export async function cfgTerminos(): Promise<CfgTerminos> {
  const v = obj(await leerAjuste(CLAVE))
  const actual = obj(v.actual)
  return {
    pedir: v.pedir !== false,
    actual: actual.url ? actual as unknown as VersionTerminos : null,
    historial: Array.isArray(v.historial) ? v.historial as VersionTerminos[] : [],
  }
}

/** El enlace corto para los clientes: walicrm.com/t/<empresa> (web/next.config.ts lo reenvía al CRM). */
export function enlaceTerminos(baseCrm: string | null): string {
  const id = espacioActual()
  try { return baseCrm ? `${new URL(baseCrm).origin}/t/${id}` : `/t/${id}` } catch { return `/t/${id}` }
}

/** Lo que muestra la página de Protección de datos. */
export async function resumenTerminos(baseCrm: string | null) {
  const c = await cfgTerminos()
  const aceptaron = c.actual ? await prisma.crmContacto.count({ where: { extra: { path: ['_terminos', 'version'], equals: c.actual.version } } }) : 0
  return { pedir: c.pedir, actual: c.actual, aceptaron, enlace: c.actual ? enlaceTerminos(baseCrm) : '' }
}

export async function nuevaVersion(url: string, nombre: string, por: string | null, baseCrm: string | null) {
  const c = await cfgTerminos()
  const actual: VersionTerminos = { version: (c.actual?.version ?? 0) + 1, url, nombre: nombre.slice(0, 120), cuando: new Date().toISOString(), por }
  await guardarAjuste(CLAVE, { pedir: c.pedir, actual, historial: [...c.historial, actual] }, por)
  logger.info(`[CRM términos] ${espacioActual()} subió la versión ${actual.version}`)
  return resumenTerminos(baseCrm)
}

export async function cambiarPedir(pedir: boolean, por: string | null, baseCrm: string | null) {
  const c = await cfgTerminos()
  await guardarAjuste(CLAVE, { pedir, actual: c.actual, historial: c.historial }, por)
  return resumenTerminos(baseCrm)
}

/** La dirección del PDF vigente de una empresa, para el enlace público. null si no tiene o no existe. */
export async function pdfPublico(espacioId: string): Promise<string | null> {
  const e = await prismaGlobal.crmEspacio.findUnique({ where: { id: espacioId }, select: { id: true } })
  if (!e) return null
  return enEspacio(e.id, async () => {
    const u = (await cfgTerminos()).actual?.url ?? ''
    return esUrlDeWali(u) ? u : null
  })
}

/** Si a este contacto hay que pedirle los términos antes de la solicitud de llamada. */
export async function terminosDe(k: CrmContacto, baseCrm: string | null) {
  const c = await cfgTerminos()
  if (!c.pedir || !c.actual) return { requiere: false, version: c.actual?.version ?? null, enlace: c.actual ? enlaceTerminos(baseCrm) : '', aceptoEn: null as string | null }
  const a = obj(obj(k.extra)._terminos)
  const acepto = Number(a.version) === c.actual.version
  return { requiere: !acepto, version: c.actual.version, enlace: enlaceTerminos(baseCrm), aceptoEn: acepto ? txt(a.cuando) || null : null }
}

/** El formulario de esa cuenta de WhatsApp: se crea y publica la primera vez (como la encuesta). */
async function formularioDe(linea: CrmLinea): Promise<string> {
  const waba = txt(linea.wabaId)
  if (!waba) throw new Error('La línea no tiene cuenta de WhatsApp')
  const guardados = obj(await leerAjuste(CLAVE_FORMULARIOS))
  if (txt(guardados[waba])) return txt(guardados[waba])
  const cred = await credDeLinea(linea)
  const ya = (await listarFlows(waba, cred)).find(f => f.name === NOMBRE_FORMULARIO && f.status === 'PUBLISHED')
  const id = ya?.id ?? await crearYPublicar(waba, NOMBRE_FORMULARIO, cred, FORMULARIO_JSON, ['OTHER'])
  await guardarAjuste(CLAVE_FORMULARIOS, { ...guardados, [waba]: id }, null)
  return id
}

/**
 * Manda los términos y deja guardada la solicitud de llamada, que sale sola al aceptar. Primero con el formulario; si
 * Meta no lo deja, con el enlace y dos botones. Devuelve por cuál salió.
 */
export async function enviarTerminos(convId: number, userId: string, textoSolicitud: string, baseCrm: string | null, empresa: string): Promise<'formulario' | 'botones'> {
  const conv = await prisma.crmConversacion.findUnique({ where: { id: convId }, include: { contacto: true, linea: true } })
  if (!conv?.linea) throw new Error('La conversación no tiene línea de WhatsApp')
  const k = conv.contacto
  const c = await cfgTerminos()
  if (!c.actual) throw new Error('La empresa no tiene términos subidos')
  const enlace = enlaceTerminos(baseCrm)
  const nombre = (k.nombre ?? '').trim().split(/\s+/)[0] ?? ''
  const cuerpo = TEXTO_PEDIDO(nombre)
  await prisma.crmContacto.update({ where: { id: k.id }, data: { extra: { ...obj(k.extra), _terminosPend: { conv: convId, texto: textoSolicitud, autorId: userId, version: c.actual.version, cuando: new Date().toISOString() } } as Prisma.InputJsonValue } })

  let via: 'formulario' | 'botones' = 'formulario'
  try {
    const flowId = await formularioDe(conv.linea)
    const pd = obj(await leerAjuste('pd'))
    const destino = k.telefono ? { to: k.telefono } : { recipient: k.waUid ?? '' }
    await graph(`/${conv.linea.phoneNumberId}/messages`, {
      cred: await credDeLinea(conv.linea), method: 'POST',
      body: {
        messaging_product: 'whatsapp', recipient_type: 'individual', ...destino, type: 'interactive',
        interactive: {
          type: 'flow', body: { text: cuerpo },
          action: { name: 'flow', parameters: {
            flow_message_version: '3', flow_token: `tyc_${convId}_${c.actual.version}`, flow_id: flowId, flow_cta: 'Revisar y aceptar', flow_action: 'navigate', mode: 'published',
            flow_action_payload: { screen: PANTALLA, data: { empresa: empresa || 'Términos', url: enlace, version: String(c.actual.version), pedir_datos: !k.autorizacion, texto_datos: txt(pd.texto) || 'Autorizo a tratar mis datos personales.' } },
          } },
        },
      },
    })
    await guardarMensaje(convId, { ev: 'lock', t: `Términos y condiciones enviados por WhatsApp (versión ${c.actual.version})` }, { autorId: userId })
  } catch (e) {
    // Sin verificar, con mala calidad o con el formulario rechazado: la misma aceptación con botones.
    logger.warn(`[CRM términos] sin formulario en la conversación ${convId}: ${(e as Error)?.message ?? e}`)
    via = 'botones'
    await guardarMensaje(convId, {
      bot: `${cuerpo} Léelos aquí: ${enlace}`,
      botones: [{ t: 'Acepto', id: `tyc_si_${convId}_${c.actual.version}` }, { t: 'No acepto', id: `tyc_no_${convId}_${c.actual.version}` }],
    }, { autorId: userId })
  }
  return via
}

/** Dejó constancia de la aceptación y, si había una solicitud esperando, la manda. */
async function aceptar(convId: number, k: CrmContacto, version: number, via: string, cuando: Date, conDatos: boolean) {
  const c = await cfgTerminos()
  const pend = obj(obj(k.extra)._terminosPend)
  const { _terminosPend: _fuera, ...extra } = obj(k.extra)
  await prisma.crmContacto.update({ where: { id: k.id }, data: { extra: { ...extra, _terminos: { version, cuando: cuando.toISOString(), via, url: c.historial.find(v => v.version === version)?.url ?? c.actual?.url ?? null } } as Prisma.InputJsonValue } })
  await guardarMensaje(convId, { ev: 'check', t: `${k.nombre || 'El cliente'} aceptó los términos y condiciones (versión ${version})` }, { autorId: null })
  if (conDatos) await marcarAutorizacion(convId, k, cuando, via)
  if (!pend.conv) return
  try {
    const { permiso, pedirPermiso } = await import('./llamadasVivo')
    const destino = Number(pend.conv)
    const p = await permiso(destino)
    if (p.estado === 'permanent') return
    if (!p.puedePedir) { await guardarMensaje(destino, { ev: 'block', t: 'WhatsApp deja mandar 1 solicitud al día y 2 por semana: la solicitud de llamada no salió. Intenta más adelante.' }, { autorId: null }); return }
    await pedirPermiso(destino, txt(pend.autorId), txt(pend.texto))
  } catch (e) {
    logger.warn(`[CRM términos] la solicitud de llamada no salió en la conversación ${convId}: ${(e as Error)?.message ?? e}`)
    await guardarMensaje(convId, { ev: 'block', t: 'Aceptó los términos, pero la solicitud de llamada no salió. Envíala de nuevo.' }, { autorId: null })
  }
}

/** La respuesta del formulario (nfm_reply). true si era de términos, aunque no se pueda usar. */
export async function respuestaTerminos(m: { interactive?: { nfm_reply?: { response_json?: string } } }, cuando: Date): Promise<boolean> {
  let r: Json
  try { r = obj(JSON.parse(String(m.interactive?.nfm_reply?.response_json ?? ''))) } catch { return false }
  const token = txt(r.flow_token)
  if (!token.startsWith('tyc_')) return false
  const t = token.match(TOKEN)
  if (!t) return true
  const si = (v: unknown) => v === true || v === 'true'
  const conv = await prisma.crmConversacion.findUnique({ where: { id: Number(t[1]) }, include: { contacto: true } })
  if (!conv) { logger.info(`[CRM términos] la conversación ${t[1]} ya no existe: se ignora`); return true }
  // Responder el formulario es un mensaje del cliente: la ventana de 24 h vuelve a empezar y sale la solicitud.
  await prisma.crmConversacion.update({ where: { id: conv.id }, data: { ultimoEntranteAt: cuando } })
  if (si(r.terminos)) await aceptar(conv.id, conv.contacto, Number(t[2]), 'Formulario de WhatsApp', cuando, si(r.datos) && !conv.contacto.autorizacion)
  return true
}

/** La respuesta con los botones: el mensaje ya quedó en el chat. */
export async function botonTerminos(id: string, cuando: Date): Promise<void> {
  const b = id.match(BOTON)
  if (!b) return
  const conv = await prisma.crmConversacion.findUnique({ where: { id: Number(b[2]) }, include: { contacto: true } })
  if (!conv) return
  if (b[1] === 'si') { await aceptar(conv.id, conv.contacto, Number(b[3]), 'Botón «Acepto» de WhatsApp', cuando, false); return }
  const { _terminosPend: _fuera, ...extra } = obj(conv.contacto.extra)
  await prisma.crmContacto.update({ where: { id: conv.contactoId }, data: { extra: extra as Prisma.InputJsonValue } })
  await guardarMensaje(conv.id, { ev: 'block', t: `${conv.contacto.nombre || 'El cliente'} no aceptó los términos y condiciones: no se le envía la solicitud de llamada` }, { autorId: null })
}

