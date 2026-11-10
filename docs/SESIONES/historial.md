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
- Respuestas rápidas (rayo y /): ya no se pintan todas de una. Salen 20, y al deslizar o bajar con las flechas llegan de a 20. El buscador filtra mientras se escribe, también de a 20. Sin cambio visual. Commit sin push, pendiente de aprobación.
- Desplegado en Railway el commit 8937ddb (respuestas rápidas de a 20). /health ok.
- Cobro por usuarios: el usuario aprobó el plan (precio según usuarios con la fórmula de /precios; al invitar por encima de los pagados se cobra la parte proporcional, siempre con aprobación explícita del cliente en pantalla; al quitar usuarios el precio baja en la renovación; Plan y pagos muestra usuarios y precio; anual con la misma lógica). Permiso `member:payment_methods:read` agregado por el usuario a la clave de Whop (verificado, ve la tarjeta guardada). Whop no deja cambiar precio ni plan de una membresía activa: se hace con membresía nueva que arranca al vencer la actual y se cancela la vieja.
- Maqueta «Cobro por usuarios» publicada en el lienzo Maquetas Wali: opción A (aprobación en la misma página y dentro del diálogo de invitar) y opción B (calculadora con celdas por usuario y cajón con el recibo), en MacBook, iPad Pro 11 e iPhone 17 Pro, con Play. Pendiente de aprobación.
- Maqueta de cobro por usuarios corregida: marcos sin desborde (faltaba box-sizing en los marcos), iniciales visibles, extracto apilado en el celular, calculadora B de 1 a 16 y formulario resumido en el celular durante la aprobación. Verificada con capturas de todos los estados.
- Maqueta de cobro: el usuario eligió la opción A. El diálogo de invitar ahora es el mismo modal de Personas (dos columnas, árbol de equipos, teléfono con país, «Queda en»), con el permiso del pago antes del pie. Se quitaron los tableros de la B. Foto de perfil de Wali para WhatsApp (640 × 640, W centrada y punto dentro del círculo) en Descargas.
- Maqueta de cobro por usuarios aprobada (opción A con el modal de Personas). Regla nueva en memoria: un solo componente por función, con el mismo diseño y textos.
- Cobro por usuarios, servidor (sin desplegar, sale junto con las pantallas): migración 0015 (usuarios pagados, bajada programada y de qué es cada cobro), precio con la fórmula de /precios (verificada de 3 a 40 usuarios), límites por usuarios pagados, pago inicial por usuarios con plan oculto propio, rutas /plan/usuarios/cotizar, /aprobar (cobra la parte proporcional solo con la aprobación) y /bajar (sin cobro, desde la renovación). El tope de usuarios ahora se revisa también al agregar a alguien a un equipo y al crear un espacio con administrador invitado, con un solo texto en los cuatro lugares.
- Maqueta de cobro: subir o bajar de usuarios con el plan pagado ahora va en un modal (misma estructura del de invitar), y en escritorio los modales se centran en el área de contenido, sin contar la barra lateral (en producción hoy se centran en toda la ventana).
- Cobro por usuarios, pantallas (sin desplegar): «Plan y pagos» con el bloque de Usuarios (Invitar persona y selector), el modal «Cambiar los usuarios del plan» (70-usuarios.js, con el permiso del pago y el botón de aprobar compartidos), el modal de invitar de Personas con el permiso antes de invitar (ruta /plan/usuarios/para-invitar), Pagos con «usuario adicional» y los usuarios de cada cobro, la página de pago con los usuarios y la escalera con precios según los usuarios de la cuenta (calculados en el servidor). Todos los modales del CRM se centran en el área de contenido, sin contar la barra lateral (--crm-nav-w medido en vivo).
- Desplegado 8103665 (cobro por usuarios completo). Migración 0015 aplicada, /health ok y sin errores en los registros. Pendiente: probar un cobro real de usuarios con un espacio pagado y decidir si se quita el botón repetido «Facturas y tarjeta» del extracto.
- «Facturas y tarjeta» queda solo en el encabezado de Pagos (se quitó del extracto), en la maqueta y en el código. Sin push.
- Maqueta «Cambiar medio de pago» en el lienzo (dentro de Wali, con el formulario seguro de Whop en modo setup, sin cobrar; Pagos con el renglón del medio de pago y el botón de Whop solo para Facturas). Se quitaron del lienzo los tableros del cobro por usuarios (ya en producción). Pendiente de aprobación; al construir hace falta el permiso member:payment_methods:manage en la clave de Whop.
- Maqueta: se quitó «Facturas» (Pagos ya trae cada cobro con su recibo) y se agregó «Cancelar plan» dentro de Wali con su modal (sigue activo hasta el fin del periodo, no se cobra más, no se borra nada); al cancelar, el extracto queda como en producción con «No se renueva», «Activo hasta» y «Renovar Starter». Pendiente de aprobación.
- Medio de pago y cancelar plan construidos (sin push): renglón del medio en Pagos y modal «Cambiar medio de pago» con el formulario de Whop en modo setup (setup intent + PATCH de la membresía, sin cobrar); «Actualizar tarjeta» abre el mismo modal; «Cancelar plan» con su modal de retención (seguir es la acción principal) y «Renovar» deshace la cancelación sin volver a pagar. Se quitó el botón de Whop. Rutas /plan/medio/preparar, /guardar, /confirmar, /plan/cancelar y /plan/reanudar. Falta el permiso member:payment_methods:manage en la clave de Whop.
- Desplegado 49f85a6 (medio de pago y cancelar plan dentro de Wali). Permiso member:payment_methods:manage verificado sin cambiar nada (Whop responde «medio no existe», no «sin permiso»). /health ok y sin errores. El lienzo Maquetas Wali quedó vacío.
- Bandeja (reporte de soporte S-1002 de Tatiana): al responder, el chat pasa a Respondidas de una vez pero sigue abierto en pantalla hasta que se abra otra conversación o se cierre; se quitó la espera de 10 s que saltaba a la siguiente. Soporte del superadmin: responder ya no pasa la solicitud a «En curso»; solo la mueven los botones. Sin push.
- Desplegado 5d07ace (chat abierto al responder en la bandeja y soporte que no cambia de pestaña al responder). /health ok.
- Maqueta «Soporte del superadmin como la bandeja del CRM» publicada (lista de solicitudes con tarjetas y franjas de espera, chat con burbujas y cuadro de responder, ficha como la de contacto, cifras en una franja; MacBook, iPad y iPhone). Pendiente de aprobación.
- Maqueta del superadmin: módulos en barra lateral como la del CRM (en iPad y celular con menú); las cifras de soporte salen de Soporte y se propone llevarlas a Resumen. Pendiente de aprobación.
