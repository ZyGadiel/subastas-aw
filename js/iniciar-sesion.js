// =====================================================================
//  INICIAR SESIÓN (iniciar-sesion.html)
// =====================================================================

const formularioDeInicioDeSesion = document.getElementById('formulario-de-inicio-de-sesion');
const mensajeDeInicioDeSesion = document.getElementById('mensaje-de-inicio-de-sesion');
const botonEntrar = formularioDeInicioDeSesion.querySelector('button[type="submit"]');

// Sección 15: a dónde regresar al entrar (viene en ?volver=; si no, el catálogo).
// La función revisa que sea una página de este sitio (js/utilidades.js).
const paginaParaVolver = obtenerPaginaParaVolver();
const textoDelRegreso = paginaParaVolver === PAGINA_PARA_VOLVER_POR_DEFECTO
  ? 'Te llevamos al catálogo...'
  : 'Te regresamos a donde estabas...';


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
  // Sección 20: si tarda más de 8 segundos, se avisa (js/utilidades.js)
  const cancelarAvisoDeConexionLenta = avisarSiLaConexionEstaLenta(mensajeDeInicioDeSesion);

  // signInWithPassword es la función de Supabase para iniciar sesión con correo y contraseña
  const { error: errorDelInicioDeSesion } = await baseDeDatos.auth.signInWithPassword({
    email: correo,
    password: contrasena,
  });

  cancelarAvisoDeConexionLenta();

  if (errorDelInicioDeSesion) {
    mostrarMensaje(
      mensajeDeInicioDeSesion,
      traducirErrorDeAutenticacion(errorDelInicioDeSesion),
      'error'
    );
    botonEntrar.disabled = false;
    return;
  }

  mostrarMensaje(mensajeDeInicioDeSesion, `¡Listo! ${textoDelRegreso}`, 'exito');
  setTimeout(() => {
    window.location.href = paginaParaVolver;
  }, 800);
}


// Si alguien que YA inició sesión abre esta página, lo mandamos a donde iba
promesaDelPerfilDelUsuarioActual.then((perfil) => {
  if (perfil) {
    window.location.href = paginaParaVolver;
  }
});

// "¿No tienes cuenta? Regístrate" conserva el ?volver=
document.getElementById('enlace-al-registro').href =
  crearDireccionConRegreso('registro.html', paginaParaVolver);

formularioDeInicioDeSesion.addEventListener('submit', iniciarSesion);

// Botón "Mostrar / Ocultar" de la contraseña (la función está en js/utilidades.js)
activarBotonVerContrasena(
  document.getElementById('contrasena'),
  document.getElementById('boton-ver-contrasena')
);
