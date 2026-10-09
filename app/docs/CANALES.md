# Canales

Todos se conectan desde el CRM, en Ajustes › Canales. Aquí está lo que hay que tener listo por fuera y las
direcciones de avisos (webhooks). `<crm>` es la dirección pública del servicio (`API_PUBLIC_URL`).

## WhatsApp (Cloud API de Meta)

1. Una app de Meta de tipo Empresa con el producto WhatsApp.
2. Un usuario del sistema con permiso sobre la cuenta de WhatsApp Business y un token permanente con
   `whatsapp_business_management` y `whatsapp_business_messaging`.
3. En el CRM, Ajustes › Canales › WhatsApp: se pega el token y el identificador de la cuenta. El CRM muestra la
   dirección de avisos y el texto de verificación para pegarlos en la app de Meta.

Avisos: `<crm>/api/crm/whatsapp/webhook/<clave de la conexión>`.

Las cuentas de tipo «App de WhatsApp Business» no se pueden registrar por la API: el número debe estar en una
cuenta de WhatsApp Business de la API en la nube.

Las plantillas, las difusiones y la encuesta al finalizar usan esta misma conexión.

## Instagram y Messenger

Con la misma app de Meta. Avisos: `<crm>/api/crm/meta/webhook/<clave>`. Instagram también se puede conectar con el
botón «Conectar con Instagram», que usa una app que configura el operador de la instalación; su regreso es
`<crm>/api/crm/instagram/regreso`.

## Telegram

Un bot creado con BotFather. Se pega su token en el CRM, que registra solo la dirección de avisos:
`<crm>/api/crm/telegram/webhook/<clave>`.

## TikTok

Una app de TikTok for Business con mensajes directos. Avisos: `<crm>/api/crm/tiktok/webhook`. Regreso de la
autorización: `<crm>/api/crm/tiktok/regreso`.

## Correo

Una cuenta con IMAP y SMTP (con contraseña de aplicación). El CRM lee la bandeja cada minuto y responde por SMTP.

## Chat de la página web

En Ajustes › Canales › Chat web se enciende y se copia el código:

```html
<script src="<crm>/chat.js" data-espacio="<id del espacio>" async></script>
```

## Enlaces de pauta

Enlaces cortos `<crm>/api/crm/w/<código>` que llevan a WhatsApp y registran de qué anuncio llegó cada lead.

## Operador de la instalación

La cuenta creada con `--operador` ve, además, la configuración de las apps de Meta, Instagram y TikTok que usan los
botones de conexión de todos los espacios. Se guarda en la tabla `config_app`.
