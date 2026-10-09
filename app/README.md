# CRM de conversaciones

Bandeja compartida para atender clientes por WhatsApp, Instagram, Messenger, Telegram, TikTok, correo y un chat
para páginas web, con equipos, reparto automático, flujos, plantillas, difusiones, agentes IA, encuesta de
satisfacción, embudo, informes y enlaces de pauta.

Es multiempresa: cada empresa tiene su **espacio de trabajo** y nada se ve de uno a otro.

## Qué hay en el repositorio

| Carpeta | Qué es |
|---|---|
| `src/` | El servidor (Node, Express, TypeScript): el API en `/api` y las pantallas. |
| `src/services/crm/` | La lógica: canales, reparto, reglas, flujos, agentes IA, encuesta, informes. |
| `src/controllers/crm/`, `src/routes/` | Las rutas del API. |
| `pantalla/` | Las pantallas, en HTML y JavaScript sin compilar. `crm.html` y `js/` son el CRM; `paginas/` el inicio de sesión, el marco y los usuarios; `chat/` la burbuja del chat web. |
| `prisma/` | El esquema de la base de datos (PostgreSQL) y sus migraciones. |
| `scripts/` | `crear-espacio.ts`: crea una empresa con su primer administrador. |
| `docs/` | Arquitectura, canales y puntos de extensión. |

Todo corre en **un solo servicio** más una base PostgreSQL.

## Arranque

Requisitos: Node 20 o superior, pnpm y PostgreSQL 14 o superior.

```bash
pnpm install
cp .env.example .env          # y llena DATABASE_URL y AUTH_SECRET
pnpm db:generate
pnpm db:migrate               # crea las tablas
pnpm crear-espacio --id acme --nombre "Acme S. A." --correo ana@acme.com --admin "Ana Pérez" --operador
pnpm dev                      # http://localhost:3000
```

`crear-espacio` muestra una sola vez la contraseña del administrador (o usa la de `--clave`). Con esa cuenta se
entra y, desde el menú de la cuenta, **Usuarios**, se crean las demás.

En producción: `pnpm build` y `pnpm start`, detrás de HTTPS.

## Cuentas y roles

| Rol | Qué puede |
|---|---|
| Administrador | Ve todo, cambia la configuración y gestiona las cuentas. |
| Líder | Cambia la configuración general. Ve lo de sus equipos. |
| Agente | Atiende las conversaciones que tiene asignadas. |
| Solo lectura | Ve todo, pero no puede cambiar nada. |

Dentro del CRM, en Ajustes › Equipos, cada persona es además integrante o líder de sus equipos, y eso decide qué
conversaciones ve. Una cuenta no se borra: se suspende, y lo que tenía abierto vuelve al reparto.

El **operador** (`--operador`) es quien administra la instalación: configura lo que es común a todos los espacios,
como las apps de Meta, Instagram y TikTok para los botones de conexión.

## Qué necesita cada función

| Función | Necesita |
|---|---|
| Adjuntos, fotos de perfil, audios | Cuenta de Cloudinary (`CLOUDINARY_*`) |
| WhatsApp, Instagram, Messenger | Una app de Meta; se conecta desde Ajustes › Canales |
| Telegram, TikTok, correo, chat web | Se conectan desde Ajustes › Canales |
| Agentes IA, sugerencias, embudo automático | `ANTHROPIC_API_KEY` |
| Transcripción de notas de voz | `GEMINI_API_KEY` |

Sin esas llaves el CRM arranca igual y esas funciones quedan apagadas. Ver `docs/CANALES.md`.

## Documentación

- `docs/ARQUITECTURA.md`: cómo está armado, los espacios, la sesión, el tiempo real y los procesos programados.
- `docs/CANALES.md`: cómo se conecta cada canal y qué dirección de avisos (webhook) usa.
- `docs/EXTENSION.md`: dónde conectar el sistema de la empresa (ficha del cliente, catálogo de enlaces de pago, pagos).
