# Puntos de extensión

El CRM funciona solo. Estos son los sitios previstos para conectarlo con los sistemas de la empresa que lo usa.

## Ficha externa del contacto

`src/services/crm/fichaExterna.ts`, función `fichaDeContacto(contactoId)`.

Devuelve lo que otro sistema sabe de la persona (qué compró, cómo va con sus pagos, quién la atiende). De fábrica
devuelve `null`. Al implementarla:

- Buscar a la persona por `telefono` o `correo` del contacto.
- Devolver la ficha con la forma `FichaExterna` y decir en `via` por dónde se halló.
- Guardar `contacto.externoId` (el id en ese sistema) y `ficha.compras`: los usan los filtros de la bandeja.
- Poner `FICHA_EXTERNA = true` para que los agentes IA reciban la herramienta de búsqueda.

La pantalla la muestra en la pestaña de la ficha y en el panel del contacto.

## Catálogo de enlaces de pago

`src/controllers/crm/catalogo.controller.ts`, `GET /api/crm/catalogo`.

Alimenta el botón «Enlace de pago» del cuadro de escribir. De fábrica la lista sale vacía y el botón no se muestra.
Forma: `{ catalogo: [{ p, c, id, pagos: [{ m, d, pr, url }] }], faltantes, fuente, asesor }`.

## Pagos confirmados

`src/services/crm/reglas.ts`, función `reglasPorPago(pago, espacioId)`.

La integración de pagos de la empresa la llama cuando confirma un pago: corre las reglas automáticas con el
disparador «Se confirma un pago» sobre la conversación del comprador.

## Integraciones que consultan los agentes IA

`src/services/crm/integraciones.ts`. Cada integración declara sus consultas y los agentes las reciben como
herramientas de solo lectura. Viene una de ejemplo (Hotmart, por credenciales del espacio).
