# Verificación de Google para Wali CRM

Para quitar el aviso «Google no ha verificado esta aplicación» que sale al conectar Google Calendar.

## Por qué sale el aviso

Wali pide a Google estos permisos:

| Permiso | Tipo para Google | Para qué lo usa Wali |
|---|---|---|
| `openid`, `email`, `profile` | Básico | Entrar a Wali con Google |
| `calendar.events` | Sensible | Crear, mover y borrar los eventos de los recordatorios de seguimiento que la persona agenda en Wali |
| `calendar.freebusy` | Sensible | Ver qué horas están libres u ocupadas, para que el agente de IA ofrezca citas |

Los permisos sensibles necesitan que Google revise la app. Mientras no la revise:

- sale el aviso a todos;
- se puede seguir con «Configuración avanzada» y luego «Ir a walicrm.com»;
- solo pueden conectar hasta 100 personas en total.

Wali no pide permisos restringidos (Gmail, Drive). Por eso no hace falta la auditoría de seguridad de pago, solo la revisión.

## Paso 1. Cambiar la política de privacidad

La política está en https://www.nexcode97.com/privacidad, que vive en el repositorio de NexCode97.

Hoy su sección «7. Datos de Google» dice que Wali solo usa nombre, correo y foto, y en otra parte dice «No accedemos a tu Gmail, tus contactos, tus archivos». Google rechaza la verificación si la política no nombra los permisos que pide la app.

Hay que reemplazar la sección 7 por este texto:

> **7. Datos de Google**
>
> El uso y la transferencia que hacemos de la información recibida de las API de Google se ajustan a la [Política de datos de usuario de los servicios de las API de Google](https://developers.google.com/terms/api-services-user-data-policy), incluidos los requisitos de uso limitado.
>
> **Inicio de sesión con Google.** Usamos tu nombre, tu correo y tu foto de perfil solo para iniciar tu sesión y mostrar tu perfil en el CRM.
>
> **Google Calendar.** Si tú decides conectar tu Google Calendar en Wali, nos das dos permisos:
>
> - Ver y editar los eventos de tu calendario (`calendar.events`). Lo usamos solo para crear, mover y borrar los eventos de los recordatorios de seguimiento que tú agendas desde Wali. No leemos ni cambiamos tus otros eventos.
> - Ver si tus horas están libres u ocupadas (`calendar.freebusy`). Lo usamos solo para que el agente de inteligencia artificial de tu empresa ofrezca citas en horas en que estás libre. No vemos el título, los invitados ni el detalle de tus eventos.
>
> Guardamos el permiso de Google cifrado y nunca sale de nuestros servidores. No usamos tus datos de Google para publicidad, no los vendemos, no los compartimos con terceros y no los usamos para entrenar modelos de inteligencia artificial. Puedes desconectar Google Calendar en cualquier momento desde Wali (Ajustes del CRM, Integraciones) o desde tu cuenta de Google (myaccount.google.com/permissions). Al desconectarlo devolvemos el permiso a Google.
>
> No accedemos a tu Gmail, tus contactos ni tus archivos de Google Drive.

También hay que borrar la frase vieja «No accedemos a tu Gmail, tus contactos, tus archivos…» de la parte de inicio de sesión, para que no se contradiga con lo nuevo.

## Paso 2. Revisar la pantalla de consentimiento

Se hace en https://console.cloud.google.com, proyecto «Wali CRM», en Google Auth Platform (antes «Pantalla de consentimiento de OAuth»).

1. **Información de la marca (Branding):**
   - Nombre de la app: `Wali CRM`.
   - Logo: el de Wali, cuadrado, de 120 × 120 px.
   - Correo de asistencia: el de soporte.
   - Página principal: `https://walicrm.com`.
   - Política de privacidad: `https://www.nexcode97.com/privacidad`.
   - Términos del servicio: `https://www.nexcode97.com/terminos`.
2. **Dominios autorizados:** `walicrm.com` y `nexcode97.com`. Los dos tienen que estar verificados en Google Search Console con la misma cuenta de Google del proyecto.
3. **Público (Audience):** que el estado sea «En producción». Si está en «Prueba», solo entran los usuarios de prueba que estén en la lista.
4. **Acceso a datos (Data access):** agregar exactamente estos permisos y ninguno más:
   - `.../auth/userinfo.email`, `.../auth/userinfo.profile`, `openid`
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/calendar.freebusy`

## Paso 3. Textos para el formulario de Google

Google pide estos textos en inglés.

**Para qué se usa `calendar.events`:**

> Wali CRM is a customer messaging CRM. Sales agents can create follow-up reminders for a customer conversation. When an agent chooses to sync a reminder with Google Calendar, Wali creates an event in the agent's own primary calendar, moves it if the reminder is rescheduled, and deletes it if the reminder is removed. Wali only creates, updates and deletes the events it created; it does not read or change any other event.

**Para qué se usa `calendar.freebusy`:**

> Businesses using Wali CRM can let their AI assistant offer appointment times to customers. The business admin connects their own Google Calendar, and Wali queries only free/busy information for the admin's primary calendar to avoid offering times that are already taken. Wali never reads event titles, attendees, descriptions or any other event details; it only receives busy time ranges.

**Cómo se protegen los datos:**

> OAuth refresh tokens are encrypted at rest and never leave our servers. Google user data is not sold, not used for advertising, not shared with third parties and not used to train AI models. Users can disconnect at any time from Wali (CRM settings, Integrations) or from their Google account; on disconnect we revoke the token with Google.

## Paso 4. Video de demostración

Google pide un video subido a YouTube, como «No listado». Debe mostrar todo el flujo con la URL visible en el navegador.

Guion:

1. Abrir `https://walicrm.com` y entrar con Google.
2. Ir a Ajustes del CRM, luego Integraciones, luego Google Calendar.
3. Ajustar los días y las horas de las citas y tocar «Continuar con Google».
4. En la pantalla de Google, mostrar de cerca el nombre «Wali CRM» y la lista de permisos. Google exige que se lea bien el client ID en la URL de esa pantalla.
5. Aceptar y volver a Wali: la integración queda conectada.
6. Mostrar el uso de `calendar.freebusy`: un chat de prueba donde el agente de IA ofrece horas libres.
7. Mostrar el uso de `calendar.events`: en una conversación, crear un recordatorio con «Agendar en Google Calendar» y abrir Google Calendar para ver el evento creado.
8. Mostrar cómo se desconecta: Integraciones, luego Google Calendar, luego Desconectar.

Se graba con una cuenta de prueba, nunca con datos de clientes reales.

## Paso 5. Enviar y esperar

En Google Auth Platform, Verification Center, tocar «Prepare for verification» o «Submit for verification». Se pega lo anterior y el enlace del video.

Google responde por correo, normalmente entre 3 y 10 días hábiles. A veces pide cambios. Mientras tanto, el atajo «Configuración avanzada», luego «Ir a walicrm.com», sigue funcionando.
