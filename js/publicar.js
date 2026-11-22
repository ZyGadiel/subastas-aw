// =====================================================================
//  PUBLICAR SUBASTA (publicar.html)
//  1. Revisa que quien entra sea un vendedor activo; si no, oculta el formulario.
//  2. Valida los datos con JavaScript (casos límite) antes de enviarlos.
//  3. Guarda la subasta en la base de datos.
//  La base de datos vuelve a revisar todo (reglas, trigger y política RLS):
//  la validación de JavaScript es para dar mensajes claros, no para seguridad.
// =====================================================================

const formularioDePublicacion = document.getElementById('formulario-de-publicacion');
const mensajeDePublicacion = document.getElementById('mensaje-de-publicacion');
const botonPublicar = formularioDePublicacion.querySelector('button[type="submit"]');

// Reglas del negocio (las mismas que están en el HTML con min / max / maxlength)
const PRECIO_MAXIMO = 10000000; // diez millones de pesos
const DURACIONES_PERMITIDAS_EN_MINUTOS = [2, 5, 60, 1440];
const CATEGORIAS_PERMITIDAS = Object.keys(NOMBRES_DE_LAS_CATEGORIAS);
const MILISEGUNDOS_POR_MINUTO = 60 * 1000;


// ---------------------------------------------------------------------
// 1. Solo los vendedores activos pueden ver el formulario.
//    (Aunque alguien lo muestre a la fuerza, la política RLS rechazaría la publicación.)
// ---------------------------------------------------------------------
async function revisarPermisoParaPublicar() {
  const perfil = await promesaDelPerfilDelUsuarioActual;

  if (!perfil) {
    mostrarMensaje(mensajeDePublicacion, 'Inicia sesión con una cuenta de vendedor para publicar.', 'aviso');
    return;
  }
  if (perfil.rol !== 'vendedor') {
    mostrarMensaje(mensajeDePublicacion, 'Solo las cuentas de vendedor pueden publicar subastas.', 'aviso');
    return;
  }
  if (perfil.suspendido) {
    mostrarMensaje(mensajeDePublicacion, 'Tu cuenta está suspendida. No puedes publicar.', 'error');
    return;
  }

  borrarMensaje(mensajeDePublicacion);
  formularioDePublicacion.hidden = false;
}


// ---------------------------------------------------------------------
// 2. Revisa los datos. Regresa un mensaje de error, o null si todo está bien.
// ---------------------------------------------------------------------
function validarDatosDeLaSubasta(subastaNueva, duracionEnMinutos) {
  // CASO LÍMITE: textos de puros espacios pasan el "required" del HTML
  if (subastaNueva.titulo === '') {
    return 'Escribe un título (no solo espacios).';
  }
  if (subastaNueva.descripcion === '') {
    return 'Escribe una descripción (no solo espacios).';
  }
  if (!CATEGORIAS_PERMITIDAS.includes(subastaNueva.categoria)) {
    return 'Elige una categoría de la lista.';
  }

  // CASO LÍMITE: texto donde se espera un número, negativos o cero.
  // Number.isFinite rechaza NaN (lo que da Number('abc')) e Infinity.
  if (!Number.isFinite(subastaNueva.precio_inicial) || subastaNueva.precio_inicial <= 0) {
    return 'El precio inicial debe ser un número mayor que cero.';
  }
  if (!Number.isFinite(subastaNueva.incremento_minimo) || subastaNueva.incremento_minimo <= 0) {
    return 'El incremento mínimo debe ser un número mayor que cero.';
  }

  // CASO LÍMITE: números gigantes
  if (subastaNueva.precio_inicial > PRECIO_MAXIMO) {
    return `El precio inicial no puede ser mayor que ${formatearDinero(PRECIO_MAXIMO)}.`;
  }

  // Regla del negocio: el incremento no puede ser mayor que el precio inicial
  if (subastaNueva.incremento_minimo > subastaNueva.precio_inicial) {
    return 'El incremento mínimo no puede ser mayor que el precio inicial.';
  }

  // CASO LÍMITE: type="url" acepta direcciones como "http://...", "ftp://..." o
  // "javascript:...". Solo se aceptan direcciones seguras https:// (o ninguna foto):
  // la página publicada es https y el navegador puede bloquear una foto http.
  // /^https:\/\/.+/ = "empieza con https:// y sigue algo más". Es la misma regla
  // que el pattern="https://.+" de publicar.html, para que las dos capas decidan igual.
  if (subastaNueva.url_de_la_foto !== null && !/^https:\/\/.+/.test(subastaNueva.url_de_la_foto)) {
    return 'La dirección de la foto debe empezar con https:// (o déjala vacía).';
  }

  if (!DURACIONES_PERMITIDAS_EN_MINUTOS.includes(duracionEnMinutos)) {
    return 'Elige una duración de la lista.';
  }

  return null;
}


// ---------------------------------------------------------------------
// 3. Al enviar el formulario
// ---------------------------------------------------------------------
async function publicarSubasta(eventoDeEnvio) {
  eventoDeEnvio.preventDefault();

  const datosDelFormulario = new FormData(formularioDePublicacion);
  const duracionEnMinutos = Number(datosDelFormulario.get('duracion_en_minutos'));
  const urlDeLaFoto = datosDelFormulario.get('url_de_la_foto').trim();

  // Los nombres de este objeto son iguales a las columnas de la tabla "subastas"
  const subastaNueva = {
    titulo: datosDelFormulario.get('titulo').trim(),
    descripcion: datosDelFormulario.get('descripcion').trim(),
    categoria: datosDelFormulario.get('categoria'),
    url_de_la_foto: urlDeLaFoto === '' ? null : urlDeLaFoto, // sin foto → null
    precio_inicial: Number(datosDelFormulario.get('precio_inicial')),
    incremento_minimo: Number(datosDelFormulario.get('incremento_minimo')),
    // precio_actual es obligatorio en la tabla; el trigger lo vuelve a poner igual al inicial
    precio_actual: Number(datosDelFormulario.get('precio_inicial')),
    fecha_de_finalizacion: new Date(Date.now() + duracionEnMinutos * MILISEGUNDOS_POR_MINUTO).toISOString(),
  };

  const mensajeDeError = validarDatosDeLaSubasta(subastaNueva, duracionEnMinutos);
  if (mensajeDeError) {
    mostrarMensaje(mensajeDePublicacion, mensajeDeError, 'error');
    return;
  }

  // CASO LÍMITE: doble clic → se publicaría dos veces. Deshabilitamos el botón.
  botonPublicar.disabled = true;
  mostrarMensaje(mensajeDePublicacion, 'Publicando tu subasta...', 'aviso');

  // Es como: INSERT INTO subastas (...) VALUES (...) RETURNING id;
  const { data: subastaGuardada, error: errorAlGuardar } = await baseDeDatos
    .from('subastas')
    .insert(subastaNueva)
    .select('id')
    .single();

  if (errorAlGuardar) {
    mostrarMensaje(mensajeDePublicacion, traducirErrorDeLaBaseDeDatos(errorAlGuardar), 'error');
    botonPublicar.disabled = false;
    return;
  }

  mostrarMensaje(
    mensajeDePublicacion,
    `¡Subasta #${subastaGuardada.id} publicada! Te llevamos al catálogo...`,
    'exito'
  );
  formularioDePublicacion.reset();
  setTimeout(() => {
    window.location.href = 'index.html';
  }, 1500);
}


revisarPermisoParaPublicar();
formularioDePublicacion.addEventListener('submit', publicarSubasta);
