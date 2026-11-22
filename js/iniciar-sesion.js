// =====================================================================
//  INICIAR SESIÓN (iniciar-sesion.html)
// =====================================================================

const formularioDeInicioDeSesion = document.getElementById('formulario-de-inicio-de-sesion');
const mensajeDeInicioDeSesion = document.getElementById('mensaje-de-inicio-de-sesion');
const botonEntrar = formularioDeInicioDeSesion.querySelector('button[type="submit"]');


async function iniciarSesion(eventoDeEnvio) {
  eventoDeEnvio.preventDefault();

  const datosDelFormulario = new FormData(formularioDeInicioDeSesion);
  const correo = datosDelFormulario.get('correo').trim();
  const contrasena = datosDelFormulario.get('contrasena');

  // CASO LÍMITE: correo incompleto. Así ni siquiera se pregunta al servidor.
  if (!esCorreoValido(correo)) {
    mostrarMensaje(mensajeDeInicioDeSesion, MENSAJE_DE_CORREO_INVALIDO, 'error');
    return;
  }

  // CASO LÍMITE: doble clic → deshabilitamos el botón mientras esperamos
  botonEntrar.disabled = true;
  mostrarMensaje(mensajeDeInicioDeSesion, 'Entrando...', 'aviso');

  // signInWithPassword es la función de Supabase para iniciar sesión con correo y contraseña
  const { error: errorDelInicioDeSesion } = await baseDeDatos.auth.signInWithPassword({
    email: correo,
    password: contrasena,
  });

  if (errorDelInicioDeSesion) {
    mostrarMensaje(
      mensajeDeInicioDeSesion,
      traducirErrorDeAutenticacion(errorDelInicioDeSesion),
      'error'
    );
    botonEntrar.disabled = false;
    return;
  }

  mostrarMensaje(mensajeDeInicioDeSesion, '¡Listo! Te llevamos al catálogo...', 'exito');
  setTimeout(() => {
    window.location.href = 'index.html';
  }, 800);
}


// Si alguien que YA inició sesión abre esta página, lo mandamos al catálogo
promesaDelPerfilDelUsuarioActual.then((perfil) => {
  if (perfil) {
    window.location.href = 'index.html';
  }
});

formularioDeInicioDeSesion.addEventListener('submit', iniciarSesion);
