// =====================================================================
//  MODO OSCURO (se carga en el <head> de TODAS las páginas)
//  1. Antes de dibujar la página decide el tema: el que el usuario eligió
//     la última vez o, si nunca eligió, el de su computadora o celular.
//  2. El botón 🌙 / ☀️ del menú cambia entre claro y oscuro.
//  3. La elección se guarda en el navegador (localStorage) para la próxima vez.
//  Los colores de cada tema están en la sección 1 de css/estilos.css.
// =====================================================================

// Nombre con el que se guarda la elección en el navegador
const CLAVE_DEL_TEMA_GUARDADO = 'subastas-aw-tema';

// Pregunta del navegador: ¿la computadora o el celular está en modo oscuro?
const consultaDelModoOscuroDelSistema = window.matchMedia('(prefers-color-scheme: dark)');


// ---------------------------------------------------------------------
// Leer y guardar la elección.
// CASO LÍMITE: algunos navegadores (modo privado, cookies bloqueadas)
// no dejan usar localStorage y lanzan un error. Con try/catch la página
// sigue funcionando; solo no se recuerda el tema.
// ---------------------------------------------------------------------
function leerTemaGuardado() {
  try {
    return localStorage.getItem(CLAVE_DEL_TEMA_GUARDADO);
  } catch {
    return null;
  }
}

function guardarTema(tema) {
  try {
    localStorage.setItem(CLAVE_DEL_TEMA_GUARDADO, tema);
  } catch {
    // No se pudo guardar: el tema funciona igual en esta página
  }
}


// ---------------------------------------------------------------------
// ¿Con qué tema empieza la página?
// ---------------------------------------------------------------------
function obtenerTemaInicial() {
  const temaGuardado = leerTemaGuardado();

  // CASO LÍMITE: alguien escribió otro valor a mano en localStorage → se ignora
  if (temaGuardado === 'claro' || temaGuardado === 'oscuro') {
    return temaGuardado;
  }
  return consultaDelModoOscuroDelSistema.matches ? 'oscuro' : 'claro';
}


// ---------------------------------------------------------------------
// Aplica un tema: pone data-tema="claro" u "oscuro" en <html>
// (el CSS cambia los colores) y actualiza el ícono del botón.
// ---------------------------------------------------------------------
function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;

  const botonDeModoOscuro = document.getElementById('boton-de-modo-oscuro');
  if (!botonDeModoOscuro) {
    return; // todavía no existe: este script corre antes que el <body>
  }

  // El ícono muestra a qué modo se cambia al dar clic
  const textoDeAyuda = tema === 'oscuro' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro';
  botonDeModoOscuro.textContent = tema === 'oscuro' ? '☀️' : '🌙';
  botonDeModoOscuro.title = textoDeAyuda;                       // al pasar el mouse
  botonDeModoOscuro.setAttribute('aria-label', textoDeAyuda);   // para lectores de pantalla
}

function cambiarTema() {
  const temaNuevo = document.documentElement.dataset.tema === 'oscuro' ? 'claro' : 'oscuro';
  aplicarTema(temaNuevo);
  guardarTema(temaNuevo);
}


// ---------------------------------------------------------------------
// Al abrir cualquier página
// ---------------------------------------------------------------------

// Se aplica YA, antes de que se dibuje el <body>. Si esperáramos, la página
// se vería blanca un instante y luego oscura (un "parpadeo" molesto).
aplicarTema(obtenerTemaInicial());

// Cuando el HTML terminó de cargar, el botón ya existe: le ponemos su
// ícono y su función. (DOMContentLoaded = "ya se leyó todo el HTML")
document.addEventListener('DOMContentLoaded', () => {
  aplicarTema(document.documentElement.dataset.tema);
  document.getElementById('boton-de-modo-oscuro').addEventListener('click', cambiarTema);
});

// CASO LÍMITE: el usuario cambia el modo de su computadora con la página
// abierta. Si nunca eligió un tema en nuestro botón, lo seguimos.
consultaDelModoOscuroDelSistema.addEventListener('change', () => {
  if (leerTemaGuardado() === null) {
    aplicarTema(obtenerTemaInicial());
  }
});
