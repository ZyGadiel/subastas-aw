// =====================================================================
//  UTILIDADES: funciones pequeñas que se usan en varias páginas.
// =====================================================================

// Formatea un número como dinero mexicano: 1500 → "$1,500.00"
// (Intl.NumberFormat es una herramienta del navegador para dar formato a números)
const formateadorDeDinero = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
});

function formatearDinero(cantidad) {
  return formateadorDeDinero.format(Number(cantidad));
}

// Recibe la fecha en que termina una subasta y regresa el tiempo que falta como texto.
// Ejemplos: "2d 03:15:09", "00:04:59", "Finalizada"
function formatearTiempoRestante(fechaDeFinalizacion) {
  const milisegundosRestantes = new Date(fechaDeFinalizacion) - new Date();

  if (milisegundosRestantes <= 0) {
    return 'Finalizada';
  }

  const segundosRestantes = Math.floor(milisegundosRestantes / 1000);
  const dias = Math.floor(segundosRestantes / 86400);              // 86400 segundos = 1 día
  const horas = Math.floor((segundosRestantes % 86400) / 3600);    // 3600 segundos = 1 hora
  const minutos = Math.floor((segundosRestantes % 3600) / 60);
  const segundos = segundosRestantes % 60;

  // padStart agrega un 0 a la izquierda: 5 → "05"
  const relojConFormato = [horas, minutos, segundos]
    .map((numero) => String(numero).padStart(2, '0'))
    .join(':');

  return dias > 0 ? `${dias}d ${relojConFormato}` : relojConFormato;
}

// Nombres para mostrar de las categorías guardadas en la base de datos
const NOMBRES_DE_LAS_CATEGORIAS = {
  electronica: 'Electrónica',
  hogar: 'Hogar',
  ropa: 'Ropa',
  deportes: 'Deportes',
  otros: 'Otros',
};

// Muestra un mensaje en un elemento de la página.
// tipoDeMensaje: 'error', 'exito' o 'aviso'
// (los colores están en la sección 7 de css/estilos.css: .mensaje-de-error, etc.)
function mostrarMensaje(elementoDelMensaje, textoDelMensaje, tipoDeMensaje) {
  elementoDelMensaje.textContent = textoDelMensaje;
  elementoDelMensaje.className = `mensaje-de-${tipoDeMensaje}`;
}

// Borra el mensaje de un elemento
function borrarMensaje(elementoDelMensaje) {
  elementoDelMensaje.textContent = '';
  elementoDelMensaje.className = '';
}
