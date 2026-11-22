// =====================================================================
//  PANEL DEL ADMINISTRADOR (administrador.html)
//  1. Revisa que quien entra sea administrador; si no, no muestra nada.
//  2. Carga al mismo tiempo las estadísticas, los usuarios y las publicaciones.
//  3. Suspende o reactiva usuarios y elimina publicaciones, siempre con
//     las funciones de supabase/seccion-10-administrador.sql (que vuelven
//     a revisar que sea administrador).
// =====================================================================

const mensajeDelAdministrador = document.getElementById('mensaje-del-administrador');
const contenidoDelAdministrador = document.getElementById('contenido-del-administrador');
const tarjetasDeEstadisticas = document.getElementById('tarjetas-de-estadisticas');
const mensajeDeUsuarios = document.getElementById('mensaje-de-usuarios');
const filasDeUsuarios = document.getElementById('filas-de-usuarios');
const mensajeDePublicaciones = document.getElementById('mensaje-de-publicaciones');
const filasDePublicaciones = document.getElementById('filas-de-publicaciones');

const NOMBRES_DE_LOS_ROLES = {
  comprador: 'Comprador',
  vendedor: 'Vendedor',
  administrador: 'Administrador',
};

let perfilDelAdministrador = null;


// ---------------------------------------------------------------------
// Crea una fila <tr> de una tabla. Cada celda puede ser un texto o un
// elemento ya creado (por ejemplo, un botón o un enlace).
// ---------------------------------------------------------------------
function crearFilaDeTabla(contenidosDeLasCeldas) {
  const fila = document.createElement('tr');
  for (const contenidoDeLaCelda of contenidosDeLasCeldas) {
    const celda = document.createElement('td');
    celda.append(contenidoDeLaCelda); // append acepta texto (como textContent) o elementos
    fila.append(celda);
  }
  return fila;
}

function crearBotonPequeno(textoDelBoton, esPeligroso) {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = esPeligroso ? 'boton-pequeno boton-peligroso' : 'boton-pequeno';
  boton.textContent = textoDelBoton;
  return boton;
}


// ---------------------------------------------------------------------
// 1. ESTADÍSTICAS: una tarjeta pequeña por número
// ---------------------------------------------------------------------
function mostrarEstadisticas(estadisticas) {
  const datosDeLasTarjetas = [
    ['Usuarios', estadisticas.usuarios],
    ['Compradores', estadisticas.compradores],
    ['Vendedores', estadisticas.vendedores],
    ['Usuarios suspendidos', estadisticas.suspendidos],
    ['Subastas activas', estadisticas.subastas_activas],
    ['Subastas vendidas', estadisticas.subastas_vendidas],
    ['Terminadas sin pujas', estadisticas.subastas_sin_pujas],
    ['Publicaciones eliminadas', estadisticas.subastas_eliminadas],
    ['Pujas en total', estadisticas.pujas],
    ['Total vendido', formatearDinero(estadisticas.total_vendido)],
    [`Ganancia de la página (${PORCENTAJE_DE_COMISION} %)`, formatearDinero(estadisticas.ganancia_por_comisiones)],
  ];

  const tarjetas = datosDeLasTarjetas.map(([nombreDeLaEstadistica, valorDeLaEstadistica]) => {
    const numero = document.createElement('span');
    numero.className = 'numero-de-la-estadistica';
    numero.textContent = valorDeLaEstadistica;

    const nombre = document.createElement('span');
    nombre.className = 'nombre-de-la-estadistica';
    nombre.textContent = nombreDeLaEstadistica;

    const tarjeta = document.createElement('div');
    tarjeta.className = 'tarjeta-de-estadistica';
    tarjeta.append(numero, nombre);
    return tarjeta;
  });

  tarjetasDeEstadisticas.replaceChildren(...tarjetas);
}


// ---------------------------------------------------------------------
// 2. USUARIOS: tabla con botón "Suspender" o "Reactivar"
// ---------------------------------------------------------------------
function mostrarUsuarios(usuarios) {
  const filas = usuarios.map((usuario) => {
    const textoDelEstado = usuario.suspendido ? 'Suspendido' : 'Activo';

    // CASO LÍMITE: al administrador (y a sí mismo) no se le puede suspender
    let celdaDeAccion = '—';
    if (usuario.rol !== 'administrador') {
      const textoDelBoton = usuario.suspendido ? 'Reactivar' : 'Suspender';
      const botonDeSuspension = crearBotonPequeno(textoDelBoton, !usuario.suspendido);
      botonDeSuspension.addEventListener('click', () =>
        cambiarSuspension(usuario, !usuario.suspendido, botonDeSuspension)
      );
      celdaDeAccion = botonDeSuspension;
    }

    return crearFilaDeTabla([
      usuario.nombre,
      usuario.correo,
      NOMBRES_DE_LOS_ROLES[usuario.rol] ?? usuario.rol,
      textoDelEstado,
      celdaDeAccion,
    ]);
  });

  filasDeUsuarios.replaceChildren(...filas);
}

async function cambiarSuspension(usuario, suspender, botonDeSuspension) {
  // Confirmar antes: suspender a alguien por error sería muy molesto para él
  const preguntaDeConfirmacion = suspender
    ? `¿Suspender a ${usuario.nombre}? Ya no podrá publicar, entrar a subastas ni pujar.`
    : `¿Reactivar a ${usuario.nombre}?`;
  if (!window.confirm(preguntaDeConfirmacion)) {
    return;
  }

  // CASO LÍMITE: doble clic
  botonDeSuspension.disabled = true;

  const { error: errorAlCambiar } = await baseDeDatos.rpc('cambiar_suspension_del_usuario', {
    id_del_usuario_elegido: usuario.id,
    suspender: suspender,
  });

  if (errorAlCambiar) {
    mostrarMensaje(mensajeDeUsuarios, traducirErrorDeLaBaseDeDatos(errorAlCambiar), 'error');
    botonDeSuspension.disabled = false;
    return;
  }

  const textoDelCambio = suspender ? 'quedó suspendido' : 'fue reactivado';
  mostrarMensaje(mensajeDeUsuarios, `${usuario.nombre} ${textoDelCambio}.`, 'exito');
  await cargarPanel(); // las estadísticas también cambian
}


// ---------------------------------------------------------------------
// 3. PUBLICACIONES: tabla con botón "Eliminar"
//    nombresDeLosUsuarios: id → nombre, para mostrar quién vende cada una
// ---------------------------------------------------------------------
function describirEstadoDeLaPublicacion(publicacion) {
  if (publicacion.estado === 'finalizada') {
    return publicacion.id_del_ganador ? 'Vendida' : 'Sin pujas';
  }
  if (new Date(publicacion.fecha_de_finalizacion) <= new Date()) {
    return 'Cerrando...';
  }
  return 'En curso';
}

function mostrarPublicaciones(publicaciones, nombresDeLosUsuarios) {
  // CASO LÍMITE: no hay publicaciones
  if (publicaciones.length === 0) {
    filasDePublicaciones.replaceChildren();
    mostrarMensaje(mensajeDePublicaciones, 'Todavía no hay publicaciones.', 'aviso');
    return;
  }

  const filas = publicaciones.map((publicacion) => {
    const enlaceALaSubasta = document.createElement('a');
    enlaceALaSubasta.href = `subasta.html?id=${publicacion.id}`;
    enlaceALaSubasta.textContent = publicacion.titulo; // textContent: evita XSS

    const botonEliminar = crearBotonPequeno('Eliminar', true);
    botonEliminar.addEventListener('click', () => eliminarPublicacion(publicacion, botonEliminar));

    return crearFilaDeTabla([
      enlaceALaSubasta,
      nombresDeLosUsuarios.get(publicacion.id_del_vendedor) ?? '—',
      describirEstadoDeLaPublicacion(publicacion),
      formatearDinero(publicacion.precio_actual),
      botonEliminar,
    ]);
  });

  filasDePublicaciones.replaceChildren(...filas);
}

async function eliminarPublicacion(publicacion, botonEliminar) {
  const preguntaDeConfirmacion =
    `¿Eliminar "${publicacion.titulo}"? Desaparecerá del catálogo y ya no aceptará pujas. ` +
    'Esto no se puede deshacer desde la página.';
  if (!window.confirm(preguntaDeConfirmacion)) {
    return;
  }

  botonEliminar.disabled = true;

  const { error: errorAlEliminar } = await baseDeDatos.rpc('eliminar_subasta', {
    id_de_la_subasta_elegida: publicacion.id,
  });

  if (errorAlEliminar) {
    mostrarMensaje(mensajeDePublicaciones, traducirErrorDeLaBaseDeDatos(errorAlEliminar), 'error');
    botonEliminar.disabled = false;
    return;
  }

  mostrarMensaje(mensajeDePublicaciones, `"${publicacion.titulo}" fue eliminada.`, 'exito');
  await cargarPanel();
}


// ---------------------------------------------------------------------
// 4. Carga todo el panel. Las 3 consultas van al mismo tiempo (Promise.all).
// ---------------------------------------------------------------------
async function cargarPanel() {
  const [respuestaDeEstadisticas, respuestaDeUsuarios, respuestaDePublicaciones] = await Promise.all([
    baseDeDatos.rpc('obtener_estadisticas'),
    baseDeDatos.rpc('listar_usuarios'),
    // Las publicaciones eliminadas ya no salen: la política RLS las oculta
    baseDeDatos
      .from('subastas')
      .select('id, titulo, id_del_vendedor, estado, precio_actual, fecha_de_finalizacion, id_del_ganador')
      .order('fecha_de_creacion', { ascending: false }),
  ]);

  // CASO LÍMITE: sin internet, o el SQL de la Sección 10 todavía no se ejecutó
  const errorDeLaConsulta =
    respuestaDeEstadisticas.error ?? respuestaDeUsuarios.error ?? respuestaDePublicaciones.error;
  if (errorDeLaConsulta) {
    mostrarMensaje(mensajeDelAdministrador, traducirErrorDeLaBaseDeDatos(errorDeLaConsulta), 'error');
    return;
  }

  // id → nombre (Map es como un diccionario)
  const nombresDeLosUsuarios = new Map(
    respuestaDeUsuarios.data.map((usuario) => [usuario.id, usuario.nombre])
  );

  borrarMensaje(mensajeDelAdministrador);
  mostrarEstadisticas(respuestaDeEstadisticas.data);
  mostrarUsuarios(respuestaDeUsuarios.data);
  mostrarPublicaciones(respuestaDePublicaciones.data, nombresDeLosUsuarios);
  contenidoDelAdministrador.hidden = false;
}


// ---------------------------------------------------------------------
// Al abrir la página: solo el administrador ve el panel
// ---------------------------------------------------------------------
async function iniciarPagina() {
  perfilDelAdministrador = await promesaDelPerfilDelUsuarioActual;

  if (!perfilDelAdministrador) {
    mostrarMensaje(mensajeDelAdministrador, 'Inicia sesión con la cuenta de administrador.', 'aviso');
    return;
  }
  // CASO LÍMITE: un comprador o vendedor escribe administrador.html a mano
  if (perfilDelAdministrador.rol !== 'administrador') {
    mostrarMensaje(mensajeDelAdministrador, 'Solo el administrador puede ver esta página.', 'error');
    return;
  }

  mostrarMensaje(mensajeDelAdministrador, 'Cargando el panel...', 'aviso');
  await cargarPanel();
}

iniciarPagina();
