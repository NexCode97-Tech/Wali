# Reglas de Meta para Wali (WhatsApp Business Platform)

Leído de la documentación oficial el 2026-10-20 (`developers.facebook.com/documentation/business-messaging/whatsapp/llms.txt`, 302 páginas; copia local en `C:\Users\nexco\Documents\meta-docs-whatsapp\txt`). **Antes de construir algo que toque Meta, se revisa aquí y en la página original.** Si una regla no está aquí, se busca en la copia local antes de suponerla.

## Cuentas (modelo nuevo, sep-oct 2026)

- La antigua WABA se partió en dos: **WhatsApp account (WAAC)**, que guarda el número, el perfil y el catálogo, y **Messaging account**, que guarda las plantillas, el cobro, los webhooks y las analíticas. El ID de WABA de siempre es ahora el ID de la Messaging account.
- **El registro integrado crea una Messaging account por cada socio.** Wali tiene la suya en cada número que se conecta por el botón. Por eso un número conectado «a mano» no deja crear plantillas por API (error 100/2388339).
- **Las plantillas no se comparten entre Messaging accounts.** Una cuenta nueva empieza vacía; para copiarlas está la API de migración (solo aprobadas con calidad GREEN o UNKNOWN, y entre cuentas del mismo negocio).
- **Cada Messaging account tiene su propio método de pago.** Sin método de pago no envía mensajes pagos. Se revisa con `GET /<MESSAGING_ACCOUNT_ID>?fields=primary_funding_id`.
- `messaging_account_id` en el envío solo hace falta si el token llega a más de una Messaging account en el mismo número. Para Wali (un token por conexión), no hace falta. Será obligatorio en esos casos desde la fase 2 (primer semestre de 2027).
- En la fase 3 (primer semestre de 2028), las APIs que llevan el ID del número en la ruta pasan a usar el ID de la WAAC. Hay que planearlo en 2027.
- El PIN de 6 dígitos de verificación en dos pasos se está retirando en los números que ya califican. Se sigue mandando un `pin` de 6 dígitos al registrar, pero Meta ya no lo valida en esos números.

## Registro integrado (botón «Conectar WhatsApp»)

- **Versión 4.** La 2 y la 3 se retiraron el 2026-10-15, y Meta atiende como v4 cualquier pedido a ellas. En v4 `extras` va vacío (`{}`). Los productos se eligen en la configuración de Facebook Login for Business. Para coexistencia (app de WhatsApp Business) se sigue usando `featureType: "whatsapp_business_app_onboarding"`.
- **El código que devuelve el registro vence en 30 segundos.** Hay que cambiarlo por el token en el servidor de una vez.
- **Pasos obligatorios del proveedor de tecnología después del registro:**
  1. Cambiar el código por el token de negocio.
  2. Suscribir la app con `POST /<WABA_ID>/subscribed_apps`.
  3. Registrar el número con `POST /<PHONE_ID>/register`.
  4. Pedirle al cliente que agregue un **método de pago**.
- **Es obligatorio estar suscrito al webhook `account_update`**: llega cuando un cliente termina el registro.
- El mensaje `WA_EMBEDDED_SIGNUP` trae los eventos `FINISH`, `FINISH_ONLY_WABA`, `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING`, `CANCEL` (con `current_step`) y `ERROR` (con `error_code` y `session_id`). Cerrar la ventana en la última pantalla cuenta como terminado.
- La página que abre la ventana debe estar en **Allowed domains** y en **Valid OAuth redirect URIs**, con HTTPS. La página no puede cortar `window.opener` (en Wali: COOP `same-origin-allow-popups`).

## Plantillas

### Crear
- Nombre: `^[a-z0-9_]+$`, hasta 512 caracteres. **Único por idioma.** Si se repite, sale el error 100/2388024.
- Hasta **100 plantillas por hora** por Messaging account. Tope de 250 plantillas (negocio sin verificar) o 6.000 (verificado y con nombre visible aprobado).
- Categorías: MARKETING, UTILITY y AUTHENTICATION.
  - **Si se pide UTILITY y Meta ve marketing, la aprueba como MARKETING**, sin preguntar (desde 2025-04-09).
  - Meta además puede pasar una plantilla de utilidad a marketing después de aprobarla. Avisa con el webhook `template_category_update`.
  - Utilidad solo vale si no es promocional y es sobre algo específico del usuario (pedido, cuenta, cita) o crítico.
  - Si hay abuso de categorías: aviso, luego tope de envíos de utilidad, luego se quita la utilidad (`account_update`).
- Variables con nombre: minúsculas y guion bajo (`{{first_name}}`), y **cada una con su ejemplo**.
- Motivos comunes de rechazo:
  - variables al principio o al final, o seguidas;
  - variables con caracteres especiales (`#`, `$`, `%`);
  - **demasiadas variables para lo corto del mensaje**;
  - pedir datos sensibles completos (tarjeta, cédula);
  - amenazas;
  - **cuerpo y pie iguales a los de otra plantilla (duplicada)**.
- La revisión toma **hasta 24 horas**. El resultado llega por `message_template_status_update`.

### Componentes
- **Encabezado** (opcional, uno solo):
  - TEXT: hasta 60 caracteres y 1 variable.
  - IMAGE, VIDEO o DOCUMENT: la muestra se sube con la Resumable Upload API y va en `header_handle`.
  - LOCATION: un mapa; la dirección se pone al enviar. Solo en Utilidad o Marketing.
  - GIF: solo con la API de Mensajes de marketing.
- **Archivos al enviar:**
  - imagen JPEG o PNG, 8 bits RGB(A), hasta 5 MB;
  - video MP4 o 3GP (H.264 y AAC), hasta 16 MB;
  - documento PDF, DOC(X), XLS(X), PPT(X) o TXT, hasta 100 MB.
- **Cuerpo**: obligatorio, hasta 1.024 caracteres, varias variables.
- **Pie**: hasta 60 caracteres, sin variables.
- **Botones**:
  - hasta 10 en total;
  - respuesta rápida: hasta 10, texto de 25;
  - URL: hasta 2, texto de 25, URL de 2.000 con 1 variable al final (codificada);
  - teléfono: 1, número de hasta 20;
  - copiar código: 1, hasta 20.
  - Las respuestas rápidas van juntas, antes o después de los otros botones, sin mezclarse.
  - Con más de 3 botones, WhatsApp muestra 2 y «Ver todas las opciones».
  - Con 4 o más botones, o respuesta rápida junto a otro tipo, la plantilla **no se ve en WhatsApp de escritorio**.

### Editar
- **Solo se pueden editar las APPROVED, REJECTED o PAUSED.** Las que están en revisión (PENDING) no.
- Se puede cambiar la categoría, los componentes (se reemplazan todos) o el tiempo de vida.
- A una aprobada **no se le puede cambiar la categoría**.
- Aprobadas: **1 edición cada 24 horas y 10 cada 30 días**. Rechazadas o pausadas: sin límite.
- Al editarla vuelve a revisión y no se puede enviar hasta que la aprueben.

### Eliminar
- Requiere `whatsapp_business_management`. Por nombre se borran todos los idiomas.
- **Las DISABLED no se pueden eliminar.**
- Después de borrar una aprobada, **ese nombre no se puede usar durante 30 días**.
- Si había mensajes sin entregar, queda en PENDING_DELETION y Meta sigue intentando entregarlos durante 30 días.

### Vida de la plantilla
- **Calidad** (`quality_score`): GREEN, YELLOW, RED o UNKNOWN (las nuevas empiezan en UNKNOWN).
  - En RED se **pausa** 3 horas la primera vez, 6 horas la segunda, y la tercera queda **DISABLED**.
  - Una pausada no se envía; la API la rechaza.
- **Ritmo de envío (pacing)**: los envíos de plantillas nuevas o sin GREEN pueden quedar retenidos.
  - La respuesta del envío trae `message_status: held_for_quality_assessment`.
  - Si la calidad sale mala, se pausa y los envíos retenidos fallan con el error 132015.
- **Archivado**: después de 12 meses sin uso se archiva sola, y a los 28 días se borra. Se puede desarchivar.
- **Tiempo de vida (TTL)** por defecto: 30 días. Utilidad se puede ajustar entre 30 segundos y 12 horas.
- **Límite por usuario de marketing**: Meta limita cuántos mensajes de marketing recibe cada persona (error 131049; esperar 24 horas antes de reintentar). **Los números de Estados Unidos (+1) no reciben marketing.**

## Mensajes y ventana de 24 horas

- Cuando el cliente escribe o llama, se abre una **ventana de 24 horas** que se reinicia con cada mensaje suyo. Dentro de ella se puede mandar cualquier mensaje; fuera, solo plantillas. Solo se escribe a quien dio su permiso (opt-in).
- Teléfonos siempre con **+ e indicativo**. Sin el +, Meta antepone el indicativo del número de la empresa.
- El orden de entrega no está garantizado. Si importa, se espera el `delivered` antes de mandar el siguiente.
- Archivos: los IDs que devuelve la API duran 30 días, los que llegan en webhooks 7 días, y las URL de descarga 5 minutos. El tope de archivo recibido es de 100 MB (error 131052). Si el tipo MIME no coincide, sale el error 131053.
- Velocidad: 80 mensajes por segundo por número (20 si el número está en coexistencia). Error 130429 si se pasa.

## Límites de mensajería (cambiaron el 2025-10-07)

- Son **por portafolio de empresa**, compartidos por todos sus números:
  - 250 para empezar;
  - 2.000 al verificar el negocio o con 2.000 entregas de calidad en 30 días;
  - luego 10.000, 100.000 e ilimitado, automático si se usa al menos la mitad del límite en 7 días con buena calidad.
- El campo `messaging_limit_tier` **está obsoleto**. Se usa `whatsapp_business_manager_messaging_limit` (valor tipo `TIER_250`).
- Los cambios llegan por `business_capability_update` (`max_daily_conversations_per_business`).

## Precios (desde el 2026-10-01, por mensaje entregado)

- **Colombia, USD**: Marketing 0,0125 · Utilidad 0,0008 · Autenticación 0,0008 · Servicio 0,0008. Fuente: la tarifa oficial de Meta en XLSX.
- **Servicio** (respuestas normales en la ventana): se cobran **desde el mensaje 1.001 de cada mes por número**. Los primeros 1.000 son gratis.
- **Si la Messaging account no tiene método de pago, Meta deja de entregar cuando se acaba lo gratis.**
- La utilidad dentro de la ventana también se cobra desde el 2026-10-01.
- No se cobra:
  - en la ventana gratis de anuncios Click to WhatsApp, durante 7 días desde la primera respuesta;
  - los mensajes del cliente a la empresa.
- Los cambios de precio solo pueden ocurrir el día 1 de enero, abril, julio u octubre.

## Permisos y webhooks

- `whatsapp_business_management` (cuentas y plantillas) y `whatsapp_business_messaging` (enviar y recibir), ambos con acceso avanzado. Wali ya los tiene aprobados (2026-10-15).
- La app CRM está suscrita a `messages`, `message_template_status_update`, `message_template_quality_update`, `template_category_update` y `phone_number_quality_update`.
- Desde el 2026-10-20 también recibe `account_update` (obligatorio para el registro integrado; también avisa restricciones y sanciones), `business_capability_update` (límites) y `account_alerts`.
- Los webhooks se reintentan hasta 7 días. Meta pide una latencia media menor a 250 ms.

## Sanciones

- Spam o políticas incumplidas llevan a: aviso, luego bloqueos de 1 a 30 días, luego cierre de la cuenta. Llegan por `account_update`. Se apelan en Business Support Home.

## Pendientes de Wali según estas reglas (2026-10-20)

1. **Hecho:** plantillas por línea, editar y eliminar.
2. **Hecho (2026-10-20):** no dejar editar el texto de una plantilla en revisión (PENDING) y no ofrecer «Eliminar» en una DISABLED.
3. **Hecho (2026-10-20):** usar `whatsapp_business_manager_messaging_limit` en vez de `messaging_limit_tier`, porque hoy el límite sale «Sin dato».
4. **Hecho (2026-10-20):** dejar el registro integrado en v4: `extras` sin `sessionInfoVersion`; solo `featureType` para coexistencia.
5. **Hecho (2026-10-20):** app suscrita a `account_update`, `business_capability_update` y `account_alerts` (verificado con el MCP de Meta).
6. ~~Avisar en Wali cuando la Messaging account no tiene método de pago~~. No se puede: `primary_funding_id` solo lo pueden leer los Solution Partners (error 10, probado el 2026-10-20). Wali le recuerda al cliente agregarlo al conectar.
7. **Agregar:** encabezado con imagen y con documento.
8. **Agregar:** revisar en el formulario que las variables no sean demasiadas para lo corto del texto, y que no se repita una plantilla existente.
