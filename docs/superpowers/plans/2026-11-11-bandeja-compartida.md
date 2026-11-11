# Bandeja compartida (CRM y Soporte del superadmin) · plan

> Se ejecuta en esta misma sesión, paso por paso (executing-plans). Sin subagentes. Commit por fase, push solo con aprobación.

**Objetivo:** que la bandeja del CRM (`app/pantalla/crm.html` + `js/*.js`) y el módulo Soporte del superadmin
(`app/pantalla/paginas/admin.html`) usen un solo código para la ficha de la derecha, sus botones, sus animaciones y las
burbujas del chat. El resto del superadmin (Resumen, Analíticas, Empresas, Finanzas, Cupones) no se toca.

**Arquitectura:** un archivo nuevo `app/pantalla/compartido/bandeja.js` que mete su CSS en `<head>` y expone `window.WB`.
`src/paginas.ts` lo pone al principio de los scripts del CRM y lo inyecta en `admin.html` por el marcador
`/*BANDEJA_COMPARTIDA*/`. Cada pantalla solo le pone las clases `wb-*` a su DOM.

**Medidas acordadas (11-nov):** la ficha mide lo que mide en el CRM: 297 px visibles (columna de 320 px con 5 px de
margen a la izquierda y 18 px a la derecha). La lista queda pendiente de que el usuario elija.

## Archivos
- Crear `app/pantalla/compartido/bandeja.js`: CSS y `WB` (ícono del panel, botones ocultar y mostrar, estado
  recordado en `localStorage` con la clave `wali-ficha-oculta`, animación de cajón, título de la ficha).
- Modificar `app/src/paginas.ts`: leer el archivo compartido y meterlo en las dos pantallas.
- Modificar `app/pantalla/js/10-nucleo.js`: el título de la ficha con `WB.botonOcultar()`, sin `pintarPopen`, y el
  botón para mostrar en `.chat-h .acts`.
- Modificar `app/pantalla/crm.html`: quitar `.pbtn`, `.popen` y `.app.panel-min .panel{display:none}`.
- Modificar `app/pantalla/js/69-tema.js`: la columna se cierra con transición (márgenes incluidos) y el título de la
  ficha sin mayúsculas sostenidas.
- Modificar `app/pantalla/paginas/admin.html`: usar `WB` y las clases `wb-*`; la ficha a 297 px; borrar sus
  `.sx-tfi`, `.sx-tfi-in` y la transición propia.

## Fase 1 · Ficha de la derecha en computador (este paso)
1. Crear `compartido/bandeja.js` con:
   - `.wb-ficha` (la columna) y `.wb-ficha-oculta` (estado en el contenedor de la grilla). Al ocultar: opacidad 0,
     `translateX(28px)`, desenfoque de 3 px y visibilidad oculta al final; curva iOS `cubic-bezier(.32,.72,0,1)`, 420 ms.
     Al mostrar, lo contrario. `prefers-reduced-motion` solo cambia la opacidad.
   - `.wb-ocultar` (dentro del título de la ficha) y `.wb-mostrar` (en la cabecera del chat, visible solo con la
     ficha oculta y con entrada `scale(.9) → 1`). Presión `scale(.92)`.
   - `.wb-fh`: el título de la ficha, en 12.5 px, peso 600 y gris, sin mayúsculas sostenidas.
   - Todo esto solo por encima de 1360 px, que es donde la ficha es columna.
   - `WB.ocultarFicha(contenedor, v)`, `WB.fichaOculta()`, `WB.botonOcultar(attrs)` y `WB.botonMostrar(attrs)`.
2. `paginas.ts`: `const BANDEJA = () => readFileSync(join(PANTALLA, 'compartido', 'bandeja.js'), 'utf8')`; en
   `armarCrm` va `BANDEJA() + '\n' + js`; en `/admin` va `.replace('/*BANDEJA_COMPARTIDA*/', () => BANDEJA())`.
3. CRM: `#panel` con la clase `wb-ficha`; título `<div class="ptitle wb-fh">Contacto${WB.botonOcultar('data-wb-ficha="1"')}</div>`;
   en `.chat-h .acts`, `WB.botonMostrar('data-wb-ficha="0"')`; un clic en `[data-wb-ficha]` llama a
   `WB.ocultarFicha(app, valor)` y pone o quita `panel-min`. Al cargar se aplica `WB.fichaOculta()`. Se borran
   `pintarPopen`, `.popen` y `.pbtn`.
4. Superadmin: `.sx-ficha` con `wb-ficha`, `.sx-det` alterna `wb-ficha-oculta`, columna de 297 px y los botones de `WB`.
5. Comprobar con `node --check` (scripts sueltos y concatenados) y `tsc`. Commit.

## Fase 2 · Tablet y celular: tocar el nombre abre la ficha como cajón con velo (CRM y Soporte)
## Fase 3 · Burbujas: el CSS de `.ch-fila`, `.ch-col`, `.ch-b` y `.ch-meta` pasa al archivo compartido, sin tope de ancho; Soporte usa esas clases
## Fase 4 · Columna de la lista, pestañas y Filtrar (cuando el usuario elija la medida de la lista)
## Fase 5 · Barra lateral plegable

Cada fase se verifica con la lista de [[lista-antes-de-mostrar]] antes de pedir el push.
