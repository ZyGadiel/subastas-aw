// =====================================================================
//  SESIÓN DEL USUARIO (se carga en TODAS las páginas)
//  1. Averigua si hay alguien con sesión iniciada y cuál es su perfil.
//  2. Ajusta el menú: muestra u oculta opciones según el usuario.
//  3. Maneja el botón "Cerrar sesión".
//  4. Traduce al español los errores de inicio de sesión y registro.
// =====================================================================


// ---------------------------------------------------------------------
// Regresa el perfil del usuario con sesión iniciada ({ id, nombre, rol, suspendido })
// o null si nadie ha iniciado sesión.
// Supabase guarda la sesión en el navegador, así que sigue activa
// aunque cambies de página o cierres la pestaña.
// ---------------------------------------------------------------------
async function obtenerPerfilDelUsuarioActual() {
  const { data: datosDeLaSesion } = await baseDeDatos.auth.getSession();
  const sesionActual = datosDeLaSesion.session;

  if (!sesionActual) {
    return null;
  }

  // Es como: SELECT id, nombre, rol, suspendido FROM perfiles WHERE id = '...' (una sola fila)
  // La política RLS "cada usuario ve solo su perfil" permite esta consulta.
  const { data: perfil, error: errorDeLaConsulta } = await baseDeDatos
    .from('perfiles')
    .select('id, nombre, rol, suspendido')
    .eq('id', sesionActual.user.id)
    .single();

  if (errorDeLaConsulta) {
    console.error('No se pudo leer el perfil del usuario:', errorDeLaConsulta);
    return null;
  }

  return perfil;
}

// La consulta se hace UNA sola vez por página. Los demás scripts esperan
// esta misma promesa con: const perfil = await promesaDelPerfilDelUsuarioActual;
const promesaDelPerfilDelUsuarioActual = obtenerPerfilDelUsuarioActual();


// ---------------------------------------------------------------------
// Muestra u oculta las opciones del menú según quién está viendo la página.
// El atributo "hidden" de HTML oculta un elemento.
// ---------------------------------------------------------------------
function actualizarMenuSegunElUsuario(perfil) {
  const hayUsuario = perfil !== null;
  const esVendedor = hayUsuario && perfil.rol === 'vendedor';
  const esAdministrador = hayUsuario && perfil.rol === 'administrador';

  document.getElementById('opcion-publicar').hidden = !esVendedor;
  // El administrador no publica ni puja: en lugar de "Mis subastas" ve "Administrar"
  document.getElementById('opcion-mis-subastas').hidden = !hayUsuario || esAdministrador;
  document.getElementById('opcion-administrar').hidden = !esAdministrador;
  document.getElementById('opcion-iniciar-sesion').hidden = hayUsuario;
  document.getElementById('opcion-registrarse').hidden = hayUsuario;
  document.getElementById('opcion-saludo').hidden = !hayUsuario;
  document.getElementById('opcion-cerrar-sesion').hidden = !hayUsuario;

  if (hayUsuario) {
    // CASO LÍMITE: el administrador suspendió la cuenta. Puede seguir viendo,
    // pero el saludo le avisa por qué ya no puede publicar ni pujar.
    const avisoDeSuspension = perfil.suspendido ? ' (cuenta suspendida)' : '';
    document.getElementById('saludo-al-usuario').textContent = `Hola, ${perfil.nombre}${avisoDeSuspension}`;
  } else {
    // Sección 15: "Iniciar sesión" y "Registrarse" recuerdan en qué página
    // estabas, para regresarte ahí al entrar (funciones en js/utilidades.js)
    const paginaParaRegresar = obtenerPaginaParaRegresarDespuesDeEntrar();
    document.querySelector('#opcion-iniciar-sesion a').href =
      crearDireccionConRegreso('iniciar-sesion.html', paginaParaRegresar);
    document.querySelector('#opcion-registrarse a').href =
      crearDireccionConRegreso('registro.html', paginaParaRegresar);
  }
}


// ---------------------------------------------------------------------
// Sección 17: marca en el menú la página donde estás, con
// aria-current="page". El CSS la pinta más oscura y los lectores de
// pantalla dicen "página actual".
// Se compara solo el nombre del archivo: "iniciar-sesion.html?volver=..."
// cuenta como "iniciar-sesion.html".
// ---------------------------------------------------------------------
function marcarPaginaActualEnElMenu() {
  const nombreDeLaPaginaActual = obtenerPaginaActual().split('?')[0];

  document.querySelectorAll('nav a').forEach((enlaceDelMenu) => {
    const nombreDeLaPaginaDelEnlace = enlaceDelMenu.getAttribute('href').split('?')[0];
    if (nombreDeLaPaginaDelEnlace === nombreDeLaPaginaActual) {
      enlaceDelMenu.setAttribute('aria-current', 'page');
    } else {
      enlaceDelMenu.removeAttribute('aria-current');
    }
  });
}


// ---------------------------------------------------------------------
// Cierra la sesión y regresa al catálogo
// ---------------------------------------------------------------------
async function cerrarSesion() {
  await baseDeDatos.auth.signOut();
  window.location.href = 'index.html';
}


// ---------------------------------------------------------------------
// Traduce los errores de Supabase Auth a mensajes claros en español.
// Supabase manda un "code" en inglés (por ejemplo "invalid_credentials").
// ---------------------------------------------------------------------
const MENSAJES_DE_ERROR_DE_AUTENTICACION = {
  invalid_credentials: 'Correo o contraseña incorrectos.',
  user_already_exists: 'Ya existe una cuenta con ese correo. Mejor inicia sesión.',
  email_exists: 'Ya existe una cuenta con ese correo. Mejor inicia sesión.',
  weak_password: 'La contraseña es muy débil. Usa al menos 6 caracteres.',
  email_address_invalid: 'El correo electrónico no es válido.',
  email_not_confirmed: 'Tu correo todavía no está confirmado. Revisa tu bandeja de entrada.',
  over_email_send_rate_limit: 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.',
  over_request_rate_limit: 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.',
};

function traducirErrorDeAutenticacion(errorDeAutenticacion) {
  console.error('Error de autenticación:', errorDeAutenticacion);

  // CASO LÍMITE: no hay internet o el servidor no responde
  if (errorDeAutenticacion.name === 'AuthRetryableFetchError') {
    return 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';
  }

  return (
    MENSAJES_DE_ERROR_DE_AUTENTICACION[errorDeAutenticacion.code] ??
    'Ocurrió un error inesperado. Inténtalo de nuevo.'
  );
}


// ---------------------------------------------------------------------
// Al abrir cualquier página
// ---------------------------------------------------------------------
document.getElementById('boton-cerrar-sesion').addEventListener('click', cerrarSesion);
marcarPaginaActualEnElMenu();
promesaDelPerfilDelUsuarioActual.then(actualizarMenuSegunElUsuario);
