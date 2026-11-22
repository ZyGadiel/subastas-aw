// =====================================================================
//  REGISTRO (registro.html)
//  Crea la cuenta en Supabase Auth. El perfil (nombre y rol) lo crea
//  la base de datos con el trigger de supabase/seccion-5-usuarios.sql.
// =====================================================================

const formularioDeRegistro = document.getElementById('formulario-de-registro');
const mensajeDeRegistro = document.getElementById('mensaje-de-registro');
const botonCrearCuenta = formularioDeRegistro.querySelector('button[type="submit"]');


async function registrarUsuario(eventoDeEnvio) {
  // Evita que el formulario recargue la página (su comportamiento normal)
  eventoDeEnvio.preventDefault();

  // FormData lee todos los campos del formulario por su atributo "name"
  const datosDelFormulario = new FormData(formularioDeRegistro);
  const nombre = datosDelFormulario.get('nombre').trim();
  const correo = datosDelFormulario.get('correo').trim();
  const contrasena = datosDelFormulario.get('contrasena');
  const rol = datosDelFormulario.get('rol');

  // CASO LÍMITE: un nombre de puros espacios pasa el "required" del HTML,
  // pero después de trim() queda vacío.
  if (nombre === '') {
    mostrarMensaje(mensajeDeRegistro, 'Escribe tu nombre (no solo espacios).', 'error');
    return;
  }

  // CASO LÍMITE: doble clic. Deshabilitamos el botón mientras esperamos
  // la respuesta, así no se manda el registro dos veces.
  botonCrearCuenta.disabled = true;
  mostrarMensaje(mensajeDeRegistro, 'Creando tu cuenta...', 'aviso');

  // signUp es la función de Supabase para registrar.
  // "options.data" son datos extra que el trigger usa para crear el perfil.
  const { data: datosDelRegistro, error: errorDelRegistro } = await baseDeDatos.auth.signUp({
    email: correo,
    password: contrasena,
    options: {
      data: { nombre: nombre, rol: rol },
    },
  });

  if (errorDelRegistro) {
    mostrarMensaje(mensajeDeRegistro, traducirErrorDeAutenticacion(errorDelRegistro), 'error');
    botonCrearCuenta.disabled = false;
    return;
  }

  // Si en Supabase está activada la confirmación por correo, todavía no hay sesión
  if (!datosDelRegistro.session) {
    mostrarMensaje(
      mensajeDeRegistro,
      'Cuenta creada. Revisa tu correo para confirmarla y después inicia sesión.',
      'exito'
    );
    formularioDeRegistro.reset();
    botonCrearCuenta.disabled = false;
    return;
  }

  mostrarMensaje(mensajeDeRegistro, `¡Bienvenido, ${nombre}! Te llevamos al catálogo...`, 'exito');
  setTimeout(() => {
    window.location.href = 'index.html';
  }, 1200);
}


// Si alguien que YA inició sesión abre esta página, lo mandamos al catálogo
promesaDelPerfilDelUsuarioActual.then((perfil) => {
  if (perfil) {
    window.location.href = 'index.html';
  }
});

formularioDeRegistro.addEventListener('submit', registrarUsuario);
