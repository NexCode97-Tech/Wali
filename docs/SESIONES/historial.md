# Historial de sesiones — Wali

## 2026-10-14 / 2026-10-15
- WhatsApp de NexCode97 conectado de punta a punta; Cloudinary configurado (fotos, stickers y audios se guardan).
- CRM_URL pasa a https://walicrm.com/crm (enlaces de correos y login con Google en el dominio de Wali).
- SEO: Search Console verificado (TXT en el DNS de Vercel), sitemap enviado, redirecciones de .html, favicon de 512 px, imagen para compartir 1200×630, contraste de textos.
- Chat: notas de voz estilo Wali (burbuja con borde de avance, onda real, punto naranja, velocidad), grabación nueva en el compositor, íconos de documentos por tipo, fotos y videos enviados se ven en el chat, arrastrar y pegar archivos, adjuntos que esperan a «Enviar», emojis más pequeños.
- Por responder: la conversación respondida espera 10 s antes de pasar a Respondidas.
- Marca: el punto de la «i» de wali en naranja (#FF4D1A) en la web y en el CRM.
- Revisión de la app de Meta enviada el 2026-10-15 (whatsapp_business_messaging, whatsapp_business_management, public_profile). Cuenta del revisor: espacio «revisor-meta» (estado interno).

## Pendientes
- Respuesta de Meta a la revisión (plazo ~20 días). Al aprobarse, probar crear plantillas desde el CRM (hoy da 100/2388339).
- Proyecto de Google nuevo para que la cuenta de servicio del calendario diga Wali.
- Partners: forma de pago de comisiones, panel de referidos, destino del formulario.
- Autoridad SEO: Perfil de Empresa en Google, directorios, enlace desde nexcode97.com.

## 2026-10-20 / 2026-11-10
- Pagos: Whop reemplazó a Creem. Checkout incrustado con tarjeta, Google Pay, Apple Pay y PayPal (este último pendiente de aprobación de Whop); página de Plan y pagos rediseñada; cupones en Whop.
- Bandeja: selección múltiple con barra de acciones (transferir, etapa, etiqueta, finalizar y más), menús pegados a su botón y hoja inferior en el celular.
- Flujos de equipo: botón «Nuevo flujo» en la fila del título; en el celular solo el ícono.
- Login: al elegir destino ya no ofrece autocompletar.
- Imagen para compartir de walicrm.com con el letrero real.

## Pendientes (10-nov)
- PayPal en Whop, cobro por número de usuarios, registrar reembolsos.
- Probar en producción las acciones en lote que faltan.
- Migrar la configuración de Railway antes del 2026-12-01.

## 2026-11-10 (sesión en la carpeta Wali)
- Bandeja › selección múltiple: «Finalizar» en lote ahora deja en cada chat el evento «Finalizada por X · Motivo: Y», igual que finalizar de a una (el servidor ya guardaba quién y el motivo). Falta desplegar.
- Railway: se generó `.railway/railway.ts` con `railway config migrate` (SDK `railway` 3.16.0 instalado solo en `.railway/` con pnpm). El plan no cambia nada real. Falta el paso de corte (`config migrate cutover` y `config apply`), que espera la aprobación del usuario.
- Whop: la membresía de prueba `mem_AZaSdP8gg3PkM7` sigue activa y se renueva sola el 2026-12-06.
- Las pruebas en producción de las acciones en lote quedaron pendientes porque la extensión de Chrome no estaba conectada.
- Railway: configuración pasada a infraestructura como código (`.railway/railway.ts`), aplicada y al día; se borró `app/railway.json`.
- Whop: la membresía de prueba `mem_AZaSdP8gg3PkM7` quedó cancelada al final del periodo (sigue activa hasta el 2026-12-06 y no se renueva). El espacio de NexCode97 es «interno» y no lo toca.
- Se borró el artifact viejo de muestra (Qu8rGiYawxsRSFwi1RXUJV).
- Sitio: `@vercel/analytics` agregado al layout. Falta que el usuario encienda Web Analytics en el panel de Vercel (proyecto wali).
- Decidido: finalizar en lote no manda la encuesta.
- Desplegado en Railway el commit dc39573 (arreglo de Finalizar en lote y la configuración nueva). /health responde ok.
