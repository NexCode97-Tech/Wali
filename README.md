# Wali

CRM multicanal (WhatsApp, Instagram, Messenger, Telegram, TikTok, correo y chat web) con agentes de IA. Producto de NexCode97.

- `app/`: el CRM (Express + Prisma + PostgreSQL), desplegado en Railway (servicio `wali`), servido en `/crm`.
- `web/`: el sitio de Wali (Next.js), desplegado en Vercel (proyecto `wali`). Reenvía `/crm` al CRM.
