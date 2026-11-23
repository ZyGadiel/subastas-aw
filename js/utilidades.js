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

// ---------------------------------------------------------------------
// FOTO DEL PRODUCTO (Sección 18). La usan el catálogo, el detalle de la
// subasta y Mis subastas.
//   * Con foto: un <img>.
//   * Sin foto, o si la foto no carga: un recuadro "Sin foto" hecho con CSS
//     (.foto-por-defecto). Antes era una imagen de placehold.co: dependía de
//     otra página de internet y no cambiaba en modo oscuro.
// ---------------------------------------------------------------------
function crearFotoPorDefecto(tituloDelProducto) {
  const fotoPorDefecto = document.createElement('div');
  fotoPorDefecto.className = 'foto-por-defecto';
  // role="img" + aria-label: los lectores de pantalla lo anuncian como una
  // imagen, igual que el alt de un <img>. (setAttribute no interpreta HTML:
  // aunque el título traiga "<script>", es solo texto.)
  fotoPorDefecto.setAttribute('role', 'img');
  fotoPorDefecto.setAttribute('aria-label', `${tituloDelProducto}: sin foto`);

  const textoSinFoto = document.createElement('span');
  textoSinFoto.textContent = 'Sin foto';
  fotoPorDefecto.append(textoSinFoto);
  return fotoPorDefecto;
}

function crearFotoDelProducto(urlDeLaFoto, tituloDelProducto) {
  // CASO LÍMITE: la subasta se publicó sin foto
  if (!urlDeLaFoto) {
    return crearFotoPorDefecto(tituloDelProducto);
  }

  const foto = document.createElement('img');
  foto.src = urlDeLaFoto;
  foto.alt = `Foto de ${tituloDelProducto}`;
  foto.loading = 'lazy'; // la foto se descarga hasta que está cerca de verse

  // CASO LÍMITE: la dirección de la foto está rota (la borraron, no es una
  // imagen, no hay internet...) → se cambia por el recuadro "Sin foto".
  // replaceWith pone el recuadro exactamente donde estaba la foto.
  foto.onerror = () => {
    foto.replaceWith(crearFotoPorDefecto(tituloDelProducto));
  };
  return foto;
}

// Cupo máximo de participantes por subasta (también lo garantiza la base de datos)
const LUGARES_POR_SUBASTA = 5;

// La página cobra una comisión del 3 % sobre el precio final de venta
const PORCENTAJE_DE_COMISION = 3;

// Comisión de un precio, redondeada a centavos: 1310 → 39.30
function calcularComision(precioFinal) {
  return Math.round(Number(precioFinal) * PORCENTAJE_DE_COMISION) / 100;
}

// El último minuto de una subasta (para pintar el tiempo de rojo)
const MILISEGUNDOS_DEL_ULTIMO_MINUTO = 60 * 1000;

// Actualiza el tiempo restante de todas las tarjetas. Se ejecuta cada segundo.
// Busca todos los elementos que tienen el atributo data-fecha-de-finalizacion.
// (Lo usan el catálogo y Mis subastas.)
function actualizarTiemposRestantes() {
  document.querySelectorAll('[data-fecha-de-finalizacion]').forEach((tiempoRestante) => {
    const fechaDeFinalizacion = tiempoRestante.dataset.fechaDeFinalizacion;
    tiempoRestante.textContent = formatearTiempoRestante(fechaDeFinalizacion);

    // Sección 16: en el ÚLTIMO MINUTO el tiempo se pinta de rojo (clase
    // tiempo-por-acabar). Es el único color de alerta de la tarjeta, así
    // que llama la atención justo cuando importa y no cansa la vista el resto del tiempo.
    const milisegundosRestantes = new Date(fechaDeFinalizacion) - new Date();
    const quedaMenosDeUnMinuto = milisegundosRestantes > 0 && milisegundosRestantes <= MILISEGUNDOS_DEL_ULTIMO_MINUTO;
    tiempoRestante.classList.toggle('tiempo-por-acabar', quedaMenosDeUnMinuto);
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


// ---------------------------------------------------------------------
// Botón "Mostrar / Ocultar" de la contraseña (registro e inicio de sesión).
// El truco es cambiar el type del campo:
//   type="password" → se ven puntitos      type="text" → se ven las letras
// El valor escrito no cambia, solo cómo se muestra.
// ---------------------------------------------------------------------
function mostrarUOcultarContrasena(campoDeLaContrasena, botonVerContrasena, mostrar) {
  campoDeLaContrasena.type = mostrar ? 'text' : 'password';
  botonVerContrasena.textContent = mostrar ? 'Ocultar' : 'Mostrar';
  // aria-pressed y aria-label: los lectores de pantalla dicen si está activado y qué hace
  botonVerContrasena.setAttribute('aria-pressed', String(mostrar));
  botonVerContrasena.setAttribute('aria-label', mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña');
}

function activarBotonVerContrasena(campoDeLaContrasena, botonVerContrasena) {
  botonVerContrasena.addEventListener('click', () => {
    const estaOculta = campoDeLaContrasena.type === 'password';
    mostrarUOcultarContrasena(campoDeLaContrasena, botonVerContrasena, estaOculta);
  });

  // CASO LÍMITE: el usuario envía el formulario con la contraseña visible.
  // Se vuelve a ocultar: así no queda a la vista mientras sale "¡Listo!" y
  // el navegador la sigue reconociendo como contraseña para ofrecer guardarla.
  campoDeLaContrasena.form.addEventListener('submit', () => {
    mostrarUOcultarContrasena(campoDeLaContrasena, botonVerContrasena, false);
  });
}

// ---------------------------------------------------------------------
// REGRESAR A LA MISMA PÁGINA DESPUÉS DE INICIAR SESIÓN (Sección 15)
// Ejemplo: un visitante está viendo la subasta 11 y da clic en "Iniciar sesión".
//   Va a:            iniciar-sesion.html?volver=subasta.html%3Fid%3D11
//   Al entrar, va a: subasta.html?id=11   (y no al catálogo)
// ---------------------------------------------------------------------
const PAGINA_PARA_VOLVER_POR_DEFECTO = 'index.html';

// CASO LÍMITE: alguien comparte un enlace con ?volver=https://pagina-falsa.com
// para que, después de iniciar sesión, la persona termine en OTRA página que
// imita a la nuestra (se llama "redirección abierta"). Solo aceptamos páginas
// de ESTE sitio:   nombre-de-la-pagina.html   y, si acaso, sus datos ?id=11&...
// El patrón no deja pasar "/" ni ":", así que "https://..." y "javascript:..." no pasan.
const PATRON_DE_PAGINA_PROPIA = /^[a-z-]+\.html(\?[A-Za-z0-9_=&%.+-]*)?$/;

function esPaginaPropiaParaVolver(pagina) {
  // CASO LÍMITE: volver a iniciar sesión o al registro haría un círculo sin fin
  return (
    PATRON_DE_PAGINA_PROPIA.test(pagina) &&
    !pagina.startsWith('iniciar-sesion.html') &&
    !pagina.startsWith('registro.html')
  );
}

// Lee el ?volver= de la dirección actual. Si no viene o no es válido → el catálogo.
function obtenerPaginaParaVolver() {
  const paginaPedida = new URLSearchParams(window.location.search).get('volver') ?? '';
  return esPaginaPropiaParaVolver(paginaPedida) ? paginaPedida : PAGINA_PARA_VOLVER_POR_DEFECTO;
}

// La página donde está el usuario ahora, por ejemplo "subasta.html?id=11".
// (En GitHub Pages la dirección es /subastas-aw/subasta.html: nos quedamos
// con lo que va después de la última "/".)
function obtenerPaginaActual() {
  const nombreDeLaPagina = window.location.pathname.split('/').pop() || PAGINA_PARA_VOLVER_POR_DEFECTO;
  return nombreDeLaPagina + window.location.search;
}

// ¿A dónde debe regresar quien da clic en "Iniciar sesión" desde ESTA página?
// Normalmente aquí mismo. Pero si ya estamos en iniciar sesión o en el
// registro, se pasa el ?volver= que ya traíamos (así no se pierde al
// cambiar de una a la otra).
function obtenerPaginaParaRegresarDespuesDeEntrar() {
  const paginaActual = obtenerPaginaActual();
  return esPaginaPropiaParaVolver(paginaActual) ? paginaActual : obtenerPaginaParaVolver();
}

// ('iniciar-sesion.html', 'subasta.html?id=11') → 'iniciar-sesion.html?volver=subasta.html%3Fid%3D11'
// encodeURIComponent "escapa" el ? y el = de la página para que no se
// confundan con los de la dirección de afuera.
function crearDireccionConRegreso(paginaDeDestino, paginaParaVolver) {
  if (paginaParaVolver === PAGINA_PARA_VOLVER_POR_DEFECTO) {
    return paginaDeDestino; // regresar al catálogo ya es lo normal: no hace falta ?volver=
  }
  return `${paginaDeDestino}?volver=${encodeURIComponent(paginaParaVolver)}`;
}


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
