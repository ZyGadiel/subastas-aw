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

// Imagen que se usa si la subasta no tiene foto o si la foto no carga
const FOTO_POR_DEFECTO = 'https://placehold.co/600x400?text=Sin+foto';

// Cupo máximo de participantes por subasta (también lo garantiza la base de datos)
const LUGARES_POR_SUBASTA = 5;

// La página cobra una comisión del 3 % sobre el precio final de venta
const PORCENTAJE_DE_COMISION = 3;

// Comisión de un precio, redondeada a centavos: 1310 → 39.30
function calcularComision(precioFinal) {
  return Math.round(Number(precioFinal) * PORCENTAJE_DE_COMISION) / 100;
}

// Actualiza el tiempo restante de todas las tarjetas. Se ejecuta cada segundo.
// Busca todos los elementos que tienen el atributo data-fecha-de-finalizacion.
// (Lo usan el catálogo y Mis subastas.)
function actualizarTiemposRestantes() {
  document.querySelectorAll('[data-fecha-de-finalizacion]').forEach((tiempoRestante) => {
    tiempoRestante.textContent = formatearTiempoRestante(tiempoRestante.dataset.fechaDeFinalizacion);
  });
}

// Nombres para mostrar de las categorías guardadas en la base de datos
const NOMBRES_DE_LAS_CATEGORIAS = {
  electronica: 'Electrónica',
  hogar: 'Hogar',
  ropa: 'Ropa',
  deportes: 'Deportes',
  otros: 'Otros',
};

// ---------------------------------------------------------------------
// ¿El correo tiene la forma ejemplo@dominio.algo?
// type="email" del navegador acepta "ejemplo@ejemplo" (sin punto), que es
// válido en redes internas pero no en internet. Esta expresión regular pide:
//   [^@\s]+          algo antes de la @ (sin espacios ni otra @)
//   @                 la arroba
//   [^@\s.]+         el nombre del dominio (sin puntos seguidos)
//   (\.[^@\s.]+)*    subdominios opcionales: correo.uabc...
//   \.[A-Za-z]{2,}    un punto y al menos 2 letras al final: .com, .mx, .edu
// ---------------------------------------------------------------------
const PATRON_DE_CORREO_VALIDO = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)*\.[A-Za-z]{2,}$/;

function esCorreoValido(correo) {
  return PATRON_DE_CORREO_VALIDO.test(correo);
}

const MENSAJE_DE_CORREO_INVALIDO = 'Escribe un correo completo, por ejemplo: ejemplo@correo.com';

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


// ---------------------------------------------------------------------
// Traduce los errores de la base de datos a mensajes claros en español.
// Cuando una regla (constraint) se rompe, el mensaje de PostgreSQL trae
// su nombre, por ejemplo: violates check constraint "precio_inicial_positivo".
// Por eso les pusimos nombres claros en supabase/schema.sql.
// ---------------------------------------------------------------------
const MENSAJES_DE_LAS_REGLAS_DE_LA_BASE_DE_DATOS = {
  precio_inicial_positivo: 'El precio inicial debe ser mayor que cero.',
  incremento_minimo_positivo: 'El incremento mínimo debe ser mayor que cero.',
  categoria_valida: 'Elige una categoría de la lista.',
  finaliza_despues_de_iniciar: 'La subasta debe terminar después de empezar.',
  duracion_maxima_de_siete_dias: 'Una subasta puede durar como máximo 7 días.',
  lugar_entre_uno_y_cinco: 'La subasta ya tiene sus 5 lugares ocupados.',
  lugar_no_repetido: 'Ese lugar se acaba de ocupar. Inténtalo de nuevo.',
  un_lugar_por_usuario: 'Ya estás participando en esta subasta.',
  monto_positivo: 'El monto de la puja debe ser mayor que cero.',
};

// Códigos de error de PostgreSQL que nos interesan
const CODIGO_DE_PERMISO_DENEGADO = '42501';   // la política RLS no lo permitió
const CODIGO_DE_NUMERO_DEMASIADO_GRANDE = '22003';
// "raise exception" de nuestras funciones (supabase/seccion-7-puja.sql).
// Su mensaje ya está escrito en español para el usuario.
const CODIGO_DE_REGLA_DEL_NEGOCIO = 'P0001';

function traducirErrorDeLaBaseDeDatos(errorDeLaBaseDeDatos) {
  console.error('Error de la base de datos:', errorDeLaBaseDeDatos);
  const textoDelError = errorDeLaBaseDeDatos.message ?? '';

  // ¿El error menciona alguna de nuestras reglas con nombre?
  for (const [nombreDeLaRegla, mensaje] of Object.entries(MENSAJES_DE_LAS_REGLAS_DE_LA_BASE_DE_DATOS)) {
    if (textoDelError.includes(nombreDeLaRegla)) {
      return mensaje;
    }
  }

  if (errorDeLaBaseDeDatos.code === CODIGO_DE_REGLA_DEL_NEGOCIO) {
    return textoDelError;
  }
  if (errorDeLaBaseDeDatos.code === CODIGO_DE_PERMISO_DENEGADO) {
    return 'No tienes permiso para hacer esto. ¿Iniciaste sesión con la cuenta correcta?';
  }
  if (errorDeLaBaseDeDatos.code === CODIGO_DE_NUMERO_DEMASIADO_GRANDE) {
    return 'El número es demasiado grande.';
  }
  // CASO LÍMITE: sin internet, el navegador responde "Failed to fetch"
  if (textoDelError.includes('Failed to fetch')) {
    return 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';
  }
  return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
}
