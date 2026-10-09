# Arquitectura

Un solo servicio de Node (Express) y una base PostgreSQL. El servicio entrega el API (`/api`), las pantallas y la
burbuja del chat web.

## Espacios de trabajo

Cada empresa es un espacio (`crm_espacios`). Las tablas del CRM llevan `espacio_id` y toda consulta pasa por
`src/services/crm/bd.ts`, que la acota sola al espacio en que corre la petición (`espacio.ts`, con
`AsyncLocalStorage`). Una consulta sin espacio falla: es preferible un error a mezclar datos de dos empresas.

- Una cuenta (`usuarios`) entra a un solo espacio, el de su fila en `crm_miembros`.
- Los avisos de los canales (webhooks) llegan sin sesión: el espacio sale de la conexión o la línea a la que le
  escribieron.
- Los procesos programados recorren todos los espacios, uno tras otro.

## Sesión

- `POST /api/auth/login` deja una cookie httpOnly con un JWT de 30 días.
- La pantalla no lee la cookie: pide con ella un token de una hora (`GET /api/auth/token`) y llama al API con
  `Authorization: Bearer`.
- `src/middleware/auth.ts` valida el token y que la cuenta siga activa en cada petición, así una suspensión aplica
  de inmediato.
- La cuenta de solo lectura se autoriza como administrador y se le corta cualquier escritura.

## Quién ve qué

El rol de la cuenta (`ADMIN`, `LIDER`, `AGENTE`, `LECTOR`) decide la configuración general. Las conversaciones que ve
cada persona las deciden sus equipos (ajuste `equipos`, `src/services/crm/alcance.ts`):

- Administrador sin equipo: todo.
- Líder de un equipo: todo lo de ese equipo.
- Integrante: lo que tiene asignado.

## Pantallas

`src/paginas.ts` las sirve y exige sesión.

- `/entrar`: inicio de sesión.
- `/`: el marco (barra con la marca, la campana y la cuenta) con el CRM en un iframe. El CRM se dibuja a 1600 px de
  ancho lógico y se encoge entero en pantallas de escritorio más angostas; en celular usa su diseño de una columna.
- `/app`: el CRM. `pantalla/crm.html` lleva el HTML y el CSS; los archivos de `pantalla/js/` se pegan en orden en un
  solo `<script>` y comparten el ámbito global. El orden está en `SCRIPTS` (`src/paginas.ts`): los archivos de número
  mayor envuelven funciones de los anteriores.
- `/usuarios`: las cuentas del espacio, solo para el administrador.
- `/chat.js`: la burbuja del chat web, pública.

En desarrollo los archivos de `pantalla/` se leen en cada petición: basta recargar el navegador.

## Tiempo real

Server-Sent Events en `/api/eventos`. Como `EventSource` no admite cabeceras, la pantalla pide un ticket de un solo
uso (`POST /api/eventos/ticket`) y abre la conexión con él. Los eventos del CRM salen de
`src/services/crm/tiempoReal.ts` y solo llegan a quien puede ver esa conversación.

Con más de una instancia del servidor, los eventos de una no llegan a las pestañas conectadas a otra: hoy está
pensado para una sola instancia.

## Procesos programados

`src/services/crm/procesos.ts`, dentro del mismo servicio (se apagan con `SIN_JOBS=1`):

- Cada minuto: reintento de avisos de canales, mensajes programados, recordatorios, reparto de lo sin asignar,
  flujos y agentes vencidos, difusiones, lectura de correos y embudo automático.
- Cada diez minutos: conversaciones de cuentas suspendidas, cierre automático, regla de 48 horas sin respuesta,
  resumen diario, renovación de tokens de Instagram y aprendizaje de «Mi IA».

## Secretos

Las claves de los canales (tokens de Meta, contraseñas de correo) se guardan cifradas con AES-256-GCM en
`crm_conexiones.secretos` (`src/services/crm/cifrado.ts`) y nunca salen del servidor. La llave es
`CRM_CLAVE_CIFRADO` o, si falta, se deriva de `AUTH_SECRET`: cambiar esa llave obliga a reconectar los canales.
