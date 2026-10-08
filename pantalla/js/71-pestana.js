/* Nombre de la pestaña (8-oct, opción B): «Página · Wali», según dónde se esté. Sale del título de la página
   (su h2) o de la opción marcada en el menú. */
const pestanaRenderBase = render;
render = function(){
  pestanaRenderBase.apply(this, arguments);
  try {
    const pg = document.getElementById('page');
    const enPagina = pg && !pg.hidden && pg.offsetParent !== null;
    const h2 = enPagina && pg.querySelector('h2');
    const menu = document.querySelector('#principal [aria-current="true"]');
    const t = (h2 && h2.textContent.trim()) || (menu && menu.textContent.replace(/\d+\s*$/, '').trim()) || 'Mi bandeja';
    const titulo = `${t.slice(0, 60)} · Wali`;
    if (document.title !== titulo) document.title = titulo;
  } catch (e) { /* el título nunca rompe la pantalla */ }
};
