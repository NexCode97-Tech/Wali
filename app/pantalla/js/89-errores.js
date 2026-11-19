/* ── Errores explicados (18-nov, pedido del usuario): todo error que muestre el CRM sale en español, con un título
   corto y «Ver motivo y solución», que abre qué pasó y qué hacer. Un solo catálogo para mensajes que no se entregaron,
   conexiones y líneas. Los de Meta se reconocen por su código («Meta 130497»); los propios del CRM, por su texto.
   El texto original queda abajo, pequeño, como «Detalle técnico», para soporte. ── */
(() => {
  const VM = 'https://business.facebook.com/wa/manage/home/';
  const CAT = {
    // Cuenta y negocio
    130497: {t: 'Meta limita los envíos a este país', m: 'Meta no deja que tu cuenta de WhatsApp les escriba a números de este país. Casi siempre pasa porque tu negocio todavía no ha pasado la verificación de Meta.', p: ['Entra a business.facebook.com con la cuenta dueña del negocio.', 'Ve a Configuración del negocio, Centro de seguridad, Verificación del negocio, y empieza o termina la verificación.', 'Sube el RUT o la cámara de comercio con el mismo nombre, dirección y teléfono que tienes en Meta.', 'Cuando Meta la apruebe (suele tardar unos días), vuelve a enviar el mensaje.']},
    141010: {t: 'Tu negocio no ha pasado la verificación de Meta', m: 'Mientras el negocio no esté verificado, Meta limita los números que puedes conectar y los mensajes que puede enviar tu WhatsApp, y puede rechazar algunos envíos.', p: ['Entra a business.facebook.com con la cuenta dueña del negocio.', 'Ve a Configuración del negocio, Centro de seguridad, Verificación del negocio, y empieza la verificación.', 'Sube el RUT o la cámara de comercio con el mismo nombre, dirección y teléfono que tienes en Meta.', 'Ten una página web con esos mismos datos. Es lo que más revisa Meta.', 'Meta suele responder en 2 a 5 días hábiles. Al aprobarla, el límite se quita solo.'], verif: true},
    131031: {t: 'Meta bloqueó tu cuenta de WhatsApp', m: 'Meta bloqueó la cuenta por un problema con sus políticas o por un incumplimiento reportado.', p: ['Abre WhatsApp Manager y revisa Calidad de la cuenta. Ahí dice el motivo.', 'Si crees que es un error, pide una revisión desde ese mismo aviso o escribe al soporte de Meta.']},
    131042: {t: 'Falta el método de pago de WhatsApp', m: 'Meta no puede cobrar los mensajes de tu cuenta. No hay tarjeta o la que hay fue rechazada.', p: ['Abre WhatsApp Manager, Configuración de pagos.', 'Agrega o actualiza la tarjeta de tu negocio.', 'Vuelve a enviar el mensaje.']},
    368: {t: 'Meta bloqueó tus envíos por un tiempo', m: 'Meta detectó algo que va contra sus políticas y pausó los envíos de la cuenta por un tiempo.', p: ['Revisa Calidad de la cuenta en WhatsApp Manager.', 'Espera a que termine la pausa antes de volver a enviar.']},
    131048: {t: 'Meta frenó los envíos por calidad', m: 'Varios clientes bloquearon o reportaron tus mensajes, y Meta bajó cuántos puedes enviar.', p: ['Escribe solo a quien espera tus mensajes y evita enviar lo mismo a muchos seguidos.', 'Revisa la calidad del número en WhatsApp Manager y espera a que mejore.']},
    // Ventana de 24 horas y permisos del cliente
    131047: {t: 'Pasaron más de 24 horas', m: 'WhatsApp solo deja escribir libre durante las 24 horas siguientes al último mensaje del cliente. Después, solo se puede abrir la conversación con una plantilla aprobada.', p: ['Toca «Enviar con plantilla» y elige una plantilla aprobada.', 'Cuando el cliente responda, vuelves a escribir libre.'], plantilla: true},
    470: {t: 'Pasaron más de 24 horas', m: 'WhatsApp solo deja escribir libre durante las 24 horas siguientes al último mensaje del cliente.', p: ['Envía una plantilla aprobada para abrir de nuevo la conversación.'], plantilla: true},
    131049: {t: 'Meta no entregó este mensaje de marketing', m: 'Para no saturar al cliente, Meta limita cuántos mensajes de marketing recibe de las empresas. Este no se entregó por ese límite.', p: ['No lo reenvíes de inmediato: espera unos días.', 'Si el cliente te escribe, puedes responderle normal.']},
    131050: {t: 'El cliente no quiere recibir marketing', m: 'El cliente pidió en WhatsApp dejar de recibir mensajes de marketing de tu empresa.', p: ['No le envíes más promociones.', 'Si él te escribe, puedes responderle normal.']},
    131026: {t: 'Este número no puede recibir el mensaje', m: 'El número no tiene WhatsApp, usa una versión muy vieja o no ha aceptado las condiciones nuevas de WhatsApp.', p: ['Confirma con el cliente que el número esté bien escrito y tenga WhatsApp.', 'Si no, contáctalo por otro canal.']},
    131021: {t: 'El mensaje va al mismo número que lo envía', m: 'El número del cliente es el mismo número de tu línea de WhatsApp.', p: ['Revisa el número del contacto.']},
    // Ritmo de envío
    131056: {t: 'Demasiados mensajes seguidos a este cliente', m: 'Le enviaste muchos mensajes al mismo número en poco tiempo y Meta pidió esperar.', p: ['Espera unos minutos y vuelve a intentar.'], r: true},
    130429: {t: 'Demasiados mensajes en poco tiempo', m: 'Tu línea llegó al ritmo máximo de envío que permite Meta.', p: ['Espera unos minutos y vuelve a intentar.'], r: true},
    80007: {t: 'Demasiados mensajes en poco tiempo', m: 'La cuenta llegó al máximo de envíos por hora que permite Meta.', p: ['Espera un rato y vuelve a intentar.'], r: true},
    4: {t: 'Demasiadas solicitudes a Meta', m: 'Meta pidió bajar el ritmo por un momento.', p: ['Espera unos minutos y vuelve a intentar.'], r: true},
    // Archivos
    131051: {t: 'WhatsApp no acepta este tipo de mensaje', m: 'El formato del mensaje o del archivo no lo admite WhatsApp.', p: ['Envíalo en otro formato, como imagen JPG o PNG, video MP4, documento PDF o audio MP3.']},
    131052: {t: 'No se pudo bajar el archivo', m: 'Meta no pudo abrir el archivo que enviaste.', p: ['Vuelve a adjuntar el archivo y envíalo otra vez.'], r: true},
    131053: {t: 'Meta no aceptó el archivo', m: 'El archivo está dañado, pesa más de lo permitido o su formato no es el que dice.', p: ['Revisa el tamaño. Imagen hasta 5 MB, video y audio hasta 16 MB, documento hasta 100 MB.', 'Guárdalo en otro formato y vuelve a enviarlo.']},
    // Plantillas
    132000: {t: 'La plantilla no tiene los datos completos', m: 'Faltan o sobran valores para los espacios de la plantilla (como el nombre del cliente).', p: ['Revisa la plantilla en Plantillas y llena todos sus espacios.']},
    132001: {t: 'La plantilla no existe o no está aprobada', m: 'Meta no encuentra esa plantilla en ese idioma, o todavía no la aprueba.', p: ['Abre Plantillas y revisa que esté aprobada.', 'Elige otra plantilla aprobada.']},
    132005: {t: 'La plantilla quedó muy larga', m: 'Con los datos puestos, el texto pasa del máximo que permite WhatsApp.', p: ['Usa datos más cortos o edita la plantilla.']},
    132007: {t: 'La plantilla va contra las políticas de Meta', m: 'Meta rechazó el contenido de la plantilla.', p: ['Revisa el motivo en WhatsApp Manager, Plantillas.', 'Crea otra con un texto distinto.']},
    132012: {t: 'Los datos de la plantilla no tienen la forma esperada', m: 'Un valor de la plantilla no tiene el formato que pide (por ejemplo, una fecha o un enlace).', p: ['Revisa los valores que llenaste en la plantilla.']},
    132015: {t: 'La plantilla está pausada', m: 'Meta pausó la plantilla porque muchos clientes la bloquearon o reportaron.', p: ['Usa otra plantilla mientras tanto.', 'Revisa en WhatsApp Manager cuándo se reactiva.']},
    132016: {t: 'La plantilla quedó desactivada', m: 'Meta desactivó la plantilla por baja calidad.', p: ['Crea una plantilla nueva con otro texto.']},
    // Conexión con Meta
    190: {t: 'La conexión con Meta venció', m: 'El permiso que le diste a Wali en Meta venció o se quitó.', p: ['Ve a Ajustes, Canales, y vuelve a conectar la cuenta.']},
    10: {t: 'Falta un permiso en Meta', m: 'La cuenta conectada no le dio a Wali el permiso que necesita para esto.', p: ['Vuelve a conectar la cuenta en Ajustes, Canales, y acepta todos los permisos.']},
    200: {t: 'Falta un permiso en Meta', m: 'La cuenta conectada no le dio a Wali el permiso que necesita para esto.', p: ['Vuelve a conectar la cuenta en Ajustes, Canales, y acepta todos los permisos.']},
    133010: {t: 'La línea no está registrada en WhatsApp', m: 'El número no terminó de registrarse para enviar mensajes desde Wali.', p: ['Ve a Ajustes, Líneas de WhatsApp, y vuelve a conectar el número.']},
    131045: {t: 'La línea no está registrada en WhatsApp', m: 'El número no terminó su registro en Meta.', p: ['Ve a Ajustes, Líneas de WhatsApp, y vuelve a conectar el número.']},
    // Fallas pasajeras de Meta
    131000: {t: 'Meta tuvo una falla', m: 'Algo falló del lado de Meta. No es un problema de tu cuenta.', p: ['Vuelve a intentar en unos minutos.'], r: true},
    131016: {t: 'WhatsApp no está disponible en este momento', m: 'El servicio de Meta está con problemas.', p: ['Vuelve a intentar en unos minutos.'], r: true},
    135000: {t: 'Meta tuvo una falla', m: 'Algo falló del lado de Meta.', p: ['Vuelve a intentar en unos minutos.'], r: true},
    1: {t: 'Meta tuvo una falla', m: 'Algo falló del lado de Meta.', p: ['Vuelve a intentar en unos minutos.'], r: true},
    2: {t: 'Meta no está disponible', m: 'El servicio de Meta está con problemas.', p: ['Vuelve a intentar en unos minutos.'], r: true},
    // Messenger e Instagram
    551: {t: 'Esta persona no está disponible', m: 'La persona no puede recibir mensajes de tu página ahora (bloqueó la página o desactivó su cuenta).', p: ['Contáctala por otro canal.']},
    2018278: {t: 'Pasaron más de 24 horas', m: 'Messenger e Instagram solo dejan responder durante las 24 horas siguientes al último mensaje de la persona.', p: ['Espera a que la persona vuelva a escribir.']},
    2534022: {t: 'Pasaron más de 24 horas', m: 'Instagram solo deja responder durante las 24 horas siguientes al último mensaje de la persona.', p: ['Espera a que la persona vuelva a escribir.']},
  };
  // Errores de Meta con código genérico (como 100) y el motivo real en el texto: se reconocen por el texto, antes del código.
  const POR_TEXTO = [
    [/no verificada|not verified|unverified/i, {t: 'Tu cuenta de WhatsApp Business no está verificada', m: 'Meta no deja registrar este número porque el negocio dueño de la cuenta de WhatsApp todavía no pasó la verificación. Las cuentas sin verificar tienen límite de números.', p: ['Entra a business.facebook.com con la cuenta dueña del negocio.', 'Ve a Configuración del negocio, Centro de seguridad, Verificación del negocio, y complétala con el RUT o la cámara de comercio.', 'Cuando Meta la apruebe (suele tardar unos días), vuelve a conectar el número.', 'Si tienes otra cuenta de WhatsApp Business ya verificada, puedes elegir esa al conectar.'], verif: true}],
    [/two.?step|dos pasos|\bpin\b/i, {t: 'El PIN no coincide', m: 'El PIN de 6 dígitos no es el de la verificación en dos pasos de este número.', p: ['Escribe el PIN que pusiste al activar la verificación en dos pasos.', 'Si no lo recuerdas, cámbialo en WhatsApp Manager, en el número, Configuración, Verificación en dos pasos.']}],
    [/already registered|ya está registrado|in use|en uso/i, {t: 'Este número ya está en uso en otro lugar', m: 'El número está registrado en otra cuenta o en la app de WhatsApp de un celular.', p: ['Si está en la app de WhatsApp de un celular, conéctalo como «Con tu app de WhatsApp Business».', 'Si está en otra plataforma, quítalo de allá primero.']}],
  ];
  // Errores propios del CRM, reconocidos por su texto.
  const PROPIOS = [
    [/limita los envíos de esta cuenta/i, {t: 'Meta limita los envíos de esta cuenta', m: 'Meta tiene la cuenta de WhatsApp con envíos limitados por un problema de calidad o de políticas.', p: ['Abre WhatsApp Manager y revisa Calidad de la cuenta. Ahí dice el motivo y qué hacer.']}],
    [/prueba gratis terminó|plan no está activo/i, {t: 'Tu plan no está activo', m: 'Con el plan vencido el CRM sigue funcionando y los mensajes de tus clientes siguen llegando, pero tus respuestas no salen.', p: ['Ve a Ajustes, Plan y pagos.', 'Elige o renueva tu plan.', 'Vuelve a enviar el mensaje.']}],
    [/24 horas/i, CAT[131047]],
    [/conexión se cortó|sin conexión|terminated|ECONNRESET|fetch failed|tiempo de espera/i, {t: 'Se cortó la conexión con Meta', m: 'La conexión se cayó mientras el mensaje salía. No es un problema de tu cuenta.', p: ['Toca Reintentar.'], r: true}],
    [/ya no tiene línea|no tiene línea|sin línea|línea se quitó/i, {t: 'La conversación ya no tiene línea', m: 'La línea de WhatsApp de esta conversación se quitó del CRM.', p: ['Conecta de nuevo la línea en Ajustes, Líneas de WhatsApp, o escríbele desde otra línea.']}],
    [/texto que lo acompaña no salió/i, {t: 'El texto de antes no salió', m: 'Este archivo iba después de un texto que no se entregó, y para no llegarle suelto al cliente no se envió.', p: ['Revisa el motivo del texto de arriba y vuelve a enviar los dos.']}],
    [/se quedó enviando|reinició/i, {t: 'El envío se interrumpió', m: 'El servidor se reinició mientras el mensaje salía.', p: ['Toca Reintentar.'], r: true}],
  ];

  /** La explicación de un error: {t, m, p[], codigo, tecnico, r (sirve reintentar), plantilla}. */
  window.errorExplicado = function(texto){
    const s = String(texto || '').trim();
    const c = s.match(/Meta (\d{1,8})/);
    let e = null;
    if (c) for (const [re, x] of POR_TEXTO) if (re.test(s)) { e = x; break; }
    if (!e && c) e = CAT[+c[1]] || null;
    if (!e) for (const [re, x] of PROPIOS) if (re.test(s)) { e = x; break; }
    if (!e) e = {t: c ? 'Meta no aceptó la solicitud' : (s.split(/[.(]/)[0] || 'No se pudo completar').slice(0, 80), m: c ? 'Meta rechazó la solicitud con un motivo que todavía no tenemos explicado.' : s, p: c ? ['Revisa el detalle técnico de abajo.', 'Si se repite, escríbenos a soporte con ese detalle.'] : ['Si se repite, escríbenos a soporte.']};
    // Meta a veces manda HTML en el texto: queda como texto limpio, y su enlace de ayuda como enlace aparte.
    const ayuda = (s.match(/href="(https:\/\/[^"]+)"/) || [])[1] || '';
    const limpio = s.replace(/<a [^>]*>([^<]*)<\/a>/g, '$1').replace(/<[^>]+>/g, '');
    // Un aviso armado por el CRM (solo «Meta 141010», sin texto de Meta) no lleva detalle técnico.
    const soloCodigo = /^Meta \d+$/.test(s);
    return {...e, codigo: c ? +c[1] : null, tecnico: !soloCodigo && (c || e.m !== s) ? limpio : '', ayuda: /^https:\/\/([\w-]+\.)*facebook\.com\//.test(ayuda) ? ayuda : ''};
  };
  /** El botón «Ver motivo y solución» para un error (va junto al título del error). */
  window.errorBoton = texto => `<button type="button" class="err-ver" data-err-ver="${esc(String(texto || ''))}">Ver motivo y solución</button>`;

  function dialogo(texto){
    const e = errorExplicado(texto);
    abrirDialogo(`<h3>${esc(e.t)}</h3>
      <div class="err-d"><div><b>Motivo</b><p>${esc(e.m)}</p></div>
      <div><b>Solución</b><ol>${e.p.map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>
      ${e.verif ? `<a class="err-link" href="https://business.facebook.com/settings/security" target="_blank" rel="noopener">${I('link')}Abrir el Centro de seguridad de Meta</a>` : e.codigo === 130497 || e.codigo === 141010 || e.codigo === 131031 || e.codigo === 131042 ? `<a class="err-link" href="${VM}" target="_blank" rel="noopener">${I('link')}Abrir WhatsApp Manager</a>` : ''}
      ${e.ayuda ? `<a class="err-link" href="${esc(e.ayuda)}" target="_blank" rel="noopener">${I('link')}Abrir la ayuda de Meta</a>` : ''}
      ${e.tecnico ? `<small class="err-tec">Detalle técnico${e.codigo ? ` · código de Meta ${e.codigo}` : ''}<br>${esc(e.tecnico)}</small>` : ''}</div>
      <div class="ft2"><button type="button" class="btn pri" data-cerrar-dlg="1">Entendido</button></div>`);
  }
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-err-ver]'); if (!b) return;
    ev.preventDefault(); ev.stopPropagation(); dialogo(b.dataset.errVer);
  }, true);

  document.head.insertAdjacentHTML('beforeend', `<style>
.err-ver{font:inherit;font-size:inherit;color:inherit;font-weight:600;text-decoration:underline;text-underline-offset:2px;background:none;border:0;padding:0;cursor:pointer;transition:opacity .15s}
.err-ver:hover{opacity:.8}.err-ver:active{transform:scale(.97)}
.err-d{display:grid;gap:14px;margin:4px 0 2px}
.err-d b{display:block;font-size:13px;color:var(--ink);margin-bottom:4px}
.err-d p{margin:0;color:var(--ink2);font-size:14px;line-height:1.5}
.err-d ol{margin:0;padding-left:20px;display:grid;gap:6px;color:var(--ink2);font-size:14px;line-height:1.5}
.err-link{display:inline-flex;align-items:center;gap:6px;font-weight:600;font-size:13.5px;color:var(--ink);text-decoration:none;justify-self:start}
.err-link:hover{text-decoration:underline;text-underline-offset:3px}.err-link svg{width:15px;height:15px}
.err-tec{display:block;color:var(--muted,#8a8f98);font-size:12px;line-height:1.45;word-break:break-word;border-top:1px solid var(--line);padding-top:10px}
</style>`);
})();
