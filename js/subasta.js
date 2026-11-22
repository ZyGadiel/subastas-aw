// =====================================================================
//  DETALLE DE SUBASTA (subasta.html?id=7)
//  1. Lee el id de la dirección y carga la subasta, sus participantes y sus pujas.
//  2. Decide qué puede hacer quien está viendo: entrar, pujar o solo mirar.
//  3. Entra y puja con las funciones de la base de datos (supabase/seccion-7-puja.sql).
//  4. Escucha los cambios en TIEMPO REAL: si alguien puja desde otra
//     computadora, esta página se actualiza sola, sin recargar.
//  5. Cada segundo actualiza el tiempo restante.
// =====================================================================


// --- Elementos de la página ---
const mensajeDeLaSubasta = document.getElementById('mensaje-de-la-subasta');
const contenidoDeLaSubasta = document.getElementById('contenido-de-la-subasta');

const fotoDelProducto = document.getElementById('foto-del-producto');
const tituloDelProducto = document.getElementById('titulo-del-producto');
const categoriaDelProducto = document.getElementById('categoria-del-producto');
const descripcionDelProducto = document.getElementById('descripcion-del-producto');

const indicadorEnVivo = document.getElementById('indicador-en-vivo');
const textoDelPrecioInicial = document.getElementById('precio-inicial');
const textoDelPrecioActual = document.getElementById('precio-actual');
const textoDelIncrementoMinimo = document.getElementById('incremento-minimo');
const textoDelTiempoRestante = document.getElementById('tiempo-restante');
const textoDeLosLugaresOcupados = document.getElementById('lugares-ocupados');

const estadoDeTuParticipacion = document.getElementById('estado-de-tu-participacion');
const botonEntrarALaSubasta = document.getElementById('boton-entrar-a-la-subasta');
const formularioDePuja = document.getElementById('formulario-de-puja');
const campoDelMontoDeLaPuja = document.getElementById('monto-de-la-puja');
const textoDelMontoMinimo = document.getElementById('monto-minimo');
const botonPujar = formularioDePuja.querySelector('button[type="submit"]');
const mensajeDeLaPuja = document.getElementById('mensaje-de-la-puja');
const filasDelHistorial = document.getElementById('filas-del-historial');


// --- Datos que la página va guardando (se reemplazan en cada carga) ---
let perfilDelUsuario = null;           // quién está viendo (null = visitante sin sesión)
let subastaActual = null;              // la fila de la tabla "subastas"
let participantesDeLaSubasta = [];     // [{ id_del_usuario, numero_de_lugar }]
let pujasDeLaSubasta = [];             // [{ id_del_usuario, monto, fecha_de_la_puja }], la más nueva primero
let numeroDeLaUltimaCarga = 0;         // ver el CASO LÍMITE dentro de cargarSubasta()
let laSubastaYaTerminoEnPantalla = false;
let elProductoYaSeMostro = false;      // la foto, el título y la descripción no cambian


// ---------------------------------------------------------------------
// 1. Lee el id de la dirección: subasta.html?id=7  →  7
//    CASO LÍMITE: sin id, ?id=abc, ?id=-3 o ?id=1.5 → regresa null
// ---------------------------------------------------------------------
function leerIdDeLaDireccion() {
  const parametrosDeLaDireccion = new URLSearchParams(window.location.search);
  const textoDelId = parametrosDeLaDireccion.get('id') ?? '';

  // /^[0-9]+$/ = "solo dígitos, de principio a fin"
  if (!/^[0-9]+$/.test(textoDelId) || Number(textoDelId) === 0) {
    return null;
  }
  return Number(textoDelId);
}

const idDeLaSubasta = leerIdDeLaDireccion();


// ---------------------------------------------------------------------
// 2. Pide a la base de datos la subasta, sus participantes y sus pujas.
//    Las 3 consultas se hacen AL MISMO TIEMPO con Promise.all (más rápido
//    que una después de otra).
// ---------------------------------------------------------------------
async function cargarSubasta() {
  // CASO LÍMITE: llegan dos avisos de tiempo real casi juntos y se hacen dos
  // cargas. Si la primera tarda más y termina al final, mostraría datos viejos.
  // Cada carga lleva un número, y solo se muestra la más reciente.
  numeroDeLaUltimaCarga += 1;
  const numeroDeEstaCarga = numeroDeLaUltimaCarga;

  const [respuestaDeLaSubasta, respuestaDeLosParticipantes, respuestaDeLasPujas] = await Promise.all([
    // SELECT ... FROM subastas WHERE id = 7   (una fila o ninguna)
    baseDeDatos
      .from('subastas')
      .select('id, id_del_vendedor, titulo, descripcion, categoria, url_de_la_foto, precio_inicial, incremento_minimo, precio_actual, fecha_de_finalizacion, estado')
      .eq('id', idDeLaSubasta)
      .maybeSingle(),
    // SELECT id_del_usuario, numero_de_lugar FROM participantes WHERE id_de_la_subasta = 7
    baseDeDatos
      .from('participantes')
      .select('id_del_usuario, numero_de_lugar')
      .eq('id_de_la_subasta', idDeLaSubasta),
    // SELECT ... FROM pujas WHERE id_de_la_subasta = 7 ORDER BY fecha_de_la_puja DESC
    baseDeDatos
      .from('pujas')
      .select('id, id_del_usuario, monto, fecha_de_la_puja')
      .eq('id_de_la_subasta', idDeLaSubasta)
      .order('fecha_de_la_puja', { ascending: false }),
  ]);

  if (numeroDeEstaCarga !== numeroDeLaUltimaCarga) {
    return; // ya hay una carga más nueva; esta se descarta
  }

  // CASO LÍMITE: sin internet o la base de datos no responde
  const errorDeLaConsulta =
    respuestaDeLaSubasta.error ?? respuestaDeLosParticipantes.error ?? respuestaDeLasPujas.error;
  if (errorDeLaConsulta) {
    console.error('Error al cargar la subasta:', errorDeLaConsulta);
    mostrarMensaje(
      mensajeDeLaSubasta,
      'No pudimos cargar la subasta. Revisa tu conexión y recarga la página.',
      'error'
    );
    return;
  }

  // CASO LÍMITE: el id no existe, o la subasta fue eliminada
  // (la política RLS oculta las eliminadas, así que llega vacía)
  if (!respuestaDeLaSubasta.data) {
    contenidoDeLaSubasta.hidden = true;
    mostrarMensaje(mensajeDeLaSubasta, 'Esta subasta no existe o fue eliminada.', 'error');
    return;
  }

  subastaActual = respuestaDeLaSubasta.data;
  participantesDeLaSubasta = respuestaDeLosParticipantes.data;
  pujasDeLaSubasta = respuestaDeLasPujas.data;

  borrarMensaje(mensajeDeLaSubasta);
  mostrarSubasta();
}


// ---------------------------------------------------------------------
// Funciones de apoyo (preguntas que nos hacemos varias veces)
// ---------------------------------------------------------------------

// ¿Ya terminó? Por estado o porque ya pasó la hora de finalización
function subastaTerminada() {
  return (
    subastaActual.estado !== 'activa' ||
    new Date(subastaActual.fecha_de_finalizacion) <= new Date()
  );
}

// Regresa el número de lugar (1 a 5) de un usuario, o null si no participa
function buscarLugarDelUsuario(idDelUsuario) {
  const participante = participantesDeLaSubasta.find(
    (participanteDeLaLista) => participanteDeLaLista.id_del_usuario === idDelUsuario
  );
  return participante ? participante.numero_de_lugar : null;
}

// Monto mínimo de la siguiente puja = precio actual + incremento mínimo.
// CASO LÍMITE: en JavaScript 1500.1 + 50.2 = 1550.3000000000002;
// redondeamos a centavos para que el número salga limpio.
function calcularMontoMinimo() {
  const montoMinimo = Number(subastaActual.precio_actual) + Number(subastaActual.incremento_minimo);
  return Math.round(montoMinimo * 100) / 100;
}

// ¿El usuario que está viendo tiene la puja más alta? (la más nueva es la más alta)
function usuarioVaGanando() {
  return perfilDelUsuario !== null && pujasDeLaSubasta[0]?.id_del_usuario === perfilDelUsuario.id;
}

// "2026-11-21T18:42:05Z" → "10:42:05 a.m." (con la hora de la computadora del usuario)
function formatearHora(fechaYHora) {
  return new Date(fechaYHora).toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}


// ---------------------------------------------------------------------
// 3. Muestra en la página los datos que se cargaron
// ---------------------------------------------------------------------
function mostrarSubasta() {
  // El producto se dibuja una sola vez. Si se volviera a poner la foto en cada
  // actualización, una foto rota que ya cambió por la de defecto volvería a romperse.
  if (!elProductoYaSeMostro) {
    mostrarDetalleDelProducto();
    elProductoYaSeMostro = true;
  }
  mostrarEstadoDeLaSubasta();
  mostrarOpcionesDeParticipacion();
  mostrarHistorialDePujas();
  contenidoDeLaSubasta.hidden = false;
}

// Igual que en el catálogo: textContent (no innerHTML) para evitar XSS
function mostrarDetalleDelProducto() {
  document.title = `Subastas AW | ${subastaActual.titulo}`;
  fotoDelProducto.src = subastaActual.url_de_la_foto || FOTO_POR_DEFECTO;
  fotoDelProducto.alt = `Foto de ${subastaActual.titulo}`;
  tituloDelProducto.textContent = subastaActual.titulo;
  categoriaDelProducto.textContent =
    NOMBRES_DE_LAS_CATEGORIAS[subastaActual.categoria] ?? subastaActual.categoria;
  descripcionDelProducto.textContent = subastaActual.descripcion;
}

function mostrarEstadoDeLaSubasta() {
  textoDelPrecioInicial.textContent = formatearDinero(subastaActual.precio_inicial);
  textoDelPrecioActual.textContent = formatearDinero(subastaActual.precio_actual);
  textoDelIncrementoMinimo.textContent = formatearDinero(subastaActual.incremento_minimo);
  textoDeLosLugaresOcupados.textContent = `${participantesDeLaSubasta.length} / ${LUGARES_POR_SUBASTA}`;
  textoDelTiempoRestante.textContent = formatearTiempoRestante(subastaActual.fecha_de_finalizacion);
}

// Decide qué ve cada quien en la caja "Participar".
// El orden de las preguntas importa: la primera que se cumple gana.
// (Esto es para dar mensajes claros; la base de datos vuelve a revisar todo.)
function mostrarOpcionesDeParticipacion() {
  botonEntrarALaSubasta.hidden = true;
  formularioDePuja.hidden = true;

  if (subastaTerminada()) {
    mostrarMensaje(estadoDeTuParticipacion, 'Esta subasta ya terminó. Ya no se aceptan pujas.', 'aviso');
    return;
  }
  if (!perfilDelUsuario) {
    mostrarMensaje(estadoDeTuParticipacion, 'Inicia sesión con una cuenta de comprador para participar.', 'aviso');
    return;
  }
  if (perfilDelUsuario.id === subastaActual.id_del_vendedor) {
    mostrarMensaje(estadoDeTuParticipacion, 'Esta es tu subasta: aquí puedes ver cómo van las pujas.', 'aviso');
    return;
  }
  if (perfilDelUsuario.rol !== 'comprador') {
    mostrarMensaje(estadoDeTuParticipacion, 'Solo las cuentas de comprador pueden participar en subastas.', 'aviso');
    return;
  }
  if (perfilDelUsuario.suspendido) {
    mostrarMensaje(estadoDeTuParticipacion, 'Tu cuenta está suspendida. No puedes participar.', 'error');
    return;
  }

  const lugarDelUsuario = buscarLugarDelUsuario(perfilDelUsuario.id);

  // Ya está participando
  if (lugarDelUsuario !== null) {
    // CASO LÍMITE: quien va ganando no puede subirse el precio a sí mismo
    if (usuarioVaGanando()) {
      mostrarMensaje(
        estadoDeTuParticipacion,
        `Eres el Participante ${lugarDelUsuario}. ¡Vas ganando! Podrás volver a pujar si alguien te supera.`,
        'exito'
      );
      return;
    }

    mostrarMensaje(estadoDeTuParticipacion, `Eres el Participante ${lugarDelUsuario}.`, 'exito');
    const montoMinimo = calcularMontoMinimo();
    textoDelMontoMinimo.textContent = formatearDinero(montoMinimo);
    campoDelMontoDeLaPuja.min = montoMinimo; // el navegador tampoco deja enviar menos
    formularioDePuja.hidden = false;
    return;
  }

  // No participa todavía: ¿quedan lugares?
  const lugaresLibres = LUGARES_POR_SUBASTA - participantesDeLaSubasta.length;
  if (lugaresLibres <= 0) {
    mostrarMensaje(
      estadoDeTuParticipacion,
      'La subasta está llena (5 de 5 lugares). Puedes seguir viéndola.',
      'aviso'
    );
    return;
  }

  const textoDeLugaresLibres = lugaresLibres === 1 ? 'Queda 1 lugar' : `Quedan ${lugaresLibres} lugares`;
  mostrarMensaje(estadoDeTuParticipacion, `${textoDeLugaresLibres}. Entra para poder pujar.`, 'aviso');
  botonEntrarALaSubasta.hidden = false;
}

// Tabla del historial: la puja más nueva (la más alta) arriba y resaltada
function mostrarHistorialDePujas() {
  // CASO LÍMITE: todavía no hay pujas → una fila con un aviso, no una tabla vacía
  if (pujasDeLaSubasta.length === 0) {
    const celdaDeAviso = document.createElement('td');
    celdaDeAviso.colSpan = 3; // ocupa las 3 columnas
    celdaDeAviso.textContent = 'Todavía no hay pujas. ¡La primera puede ser la tuya!';
    const filaDeAviso = document.createElement('tr');
    filaDeAviso.append(celdaDeAviso);
    filasDelHistorial.replaceChildren(filaDeAviso);
    return;
  }

  const filas = pujasDeLaSubasta.map((puja, posicion) => crearFilaDelHistorial(puja, posicion === 0));
  filasDelHistorial.replaceChildren(...filas);
}

// Privacidad: nunca se muestra el nombre, solo "Participante 3".
// Si la puja es del usuario que está viendo, agrega "(tú)".
function crearFilaDelHistorial(puja, esLaPujaMasAlta) {
  const lugarDeQuienPujo = buscarLugarDelUsuario(puja.id_del_usuario);
  let nombreParaMostrar = `Participante ${lugarDeQuienPujo}`;
  if (perfilDelUsuario && puja.id_del_usuario === perfilDelUsuario.id) {
    nombreParaMostrar += ' (tú)';
  }

  const fila = document.createElement('tr');
  if (esLaPujaMasAlta) {
    fila.className = 'puja-mas-alta';
  }

  const textosDeLasCeldas = [nombreParaMostrar, formatearDinero(puja.monto), formatearHora(puja.fecha_de_la_puja)];
  for (const textoDeLaCelda of textosDeLasCeldas) {
    const celda = document.createElement('td');
    celda.textContent = textoDeLaCelda;
    fila.append(celda);
  }
  return fila;
}


// ---------------------------------------------------------------------
// 4. Entrar a la subasta: ocupar uno de los 5 lugares
// ---------------------------------------------------------------------
async function entrarALaSubasta() {
  // CASO LÍMITE: doble clic. (Aunque pasara, la función de la base de datos
  // regresa el mismo lugar en vez de dar dos.)
  botonEntrarALaSubasta.disabled = true;
  mostrarMensaje(mensajeDeLaPuja, 'Apartando tu lugar...', 'aviso');

  // Es como llamar a un procedimiento almacenado: CALL entrar_a_la_subasta(7)
  const { data: numeroDeLugar, error: errorAlEntrar } = await baseDeDatos.rpc('entrar_a_la_subasta', {
    id_de_la_subasta_elegida: idDeLaSubasta,
  });

  botonEntrarALaSubasta.disabled = false;

  if (errorAlEntrar) {
    // Por ejemplo: alguien más ocupó el último lugar un segundo antes
    mostrarMensaje(mensajeDeLaPuja, traducirErrorDeLaBaseDeDatos(errorAlEntrar), 'error');
  } else {
    mostrarMensaje(mensajeDeLaPuja, `¡Listo! Ocupas el lugar ${numeroDeLugar} de ${LUGARES_POR_SUBASTA}.`, 'exito');
  }
  await cargarSubasta(); // en los dos casos, mostramos cómo quedó la subasta
}


// ---------------------------------------------------------------------
// 5. Pujar
// ---------------------------------------------------------------------
async function enviarPuja(eventoDeEnvio) {
  eventoDeEnvio.preventDefault();

  const montoOfrecido = Number(campoDelMontoDeLaPuja.value);
  const montoMinimo = calcularMontoMinimo();

  // CASO LÍMITE: texto, vacío, cero o negativo
  if (!Number.isFinite(montoOfrecido) || montoOfrecido <= 0) {
    mostrarMensaje(mensajeDeLaPuja, 'Escribe un monto válido (solo números).', 'error');
    return;
  }
  // CASO LÍMITE: menos del mínimo
  if (montoOfrecido < montoMinimo) {
    mostrarMensaje(mensajeDeLaPuja, `Tu puja debe ser de al menos ${formatearDinero(montoMinimo)}.`, 'error');
    return;
  }
  // CASO LÍMITE: el tiempo se acabó mientras escribía
  if (subastaTerminada()) {
    mostrarMensaje(mensajeDeLaPuja, 'Esta subasta ya terminó. Ya no se aceptan pujas.', 'error');
    mostrarOpcionesDeParticipacion();
    return;
  }

  // CASO LÍMITE: doble clic → dos pujas. Deshabilitamos el botón mientras se envía.
  botonPujar.disabled = true;
  mostrarMensaje(mensajeDeLaPuja, 'Enviando tu puja...', 'aviso');

  const { data: precioNuevo, error: errorAlPujar } = await baseDeDatos.rpc('pujar', {
    id_de_la_subasta_elegida: idDeLaSubasta,
    monto_ofrecido: montoOfrecido,
  });

  botonPujar.disabled = false;

  if (errorAlPujar) {
    // Por ejemplo: alguien pujó más alto mientras escribías
    mostrarMensaje(mensajeDeLaPuja, traducirErrorDeLaBaseDeDatos(errorAlPujar), 'error');
  } else {
    mostrarMensaje(mensajeDeLaPuja, `¡Tu puja de ${formatearDinero(precioNuevo)} quedó registrada!`, 'exito');
    formularioDePuja.reset();
  }
  await cargarSubasta();
}


// ---------------------------------------------------------------------
// 6. TIEMPO REAL: Supabase avisa cada vez que cambia algo de ESTA subasta
//    (una puja nueva, un participante nuevo o un cambio en la subasta).
//    En cada aviso volvemos a cargar todo: es más simple y siempre queda
//    igual que en la base de datos.
//    filter: 'id_de_la_subasta=eq.7' = solo los cambios de la subasta 7
// ---------------------------------------------------------------------
function escucharCambiosEnTiempoReal() {
  const filtroDeEstaSubasta = `id_de_la_subasta=eq.${idDeLaSubasta}`;

  // Supabase llama "channel" (canal) a la conexión que recibe los avisos.
  // Los nombres 'postgres_changes', 'INSERT', 'UPDATE' y 'SUBSCRIBED' son de la librería.
  baseDeDatos
    .channel(`subasta-${idDeLaSubasta}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'pujas', filter: filtroDeEstaSubasta },
      cargarSubasta
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'participantes', filter: filtroDeEstaSubasta },
      cargarSubasta
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'subastas', filter: `id=eq.${idDeLaSubasta}` },
      cargarSubasta
    )
    .subscribe((estadoDeLaConexion) => {
      const conexionActiva = estadoDeLaConexion === 'SUBSCRIBED';
      indicadorEnVivo.hidden = !conexionActiva;

      // CASO LÍMITE: se fue el internet un rato y volvió. Mientras no hubo
      // conexión pudimos perdernos pujas, así que recargamos todo.
      if (conexionActiva) {
        cargarSubasta();
      }
    });
}


// ---------------------------------------------------------------------
// 7. Reloj: cada segundo actualiza el tiempo restante
// ---------------------------------------------------------------------
function actualizarReloj() {
  textoDelTiempoRestante.textContent = formatearTiempoRestante(subastaActual.fecha_de_finalizacion);

  // CASO LÍMITE: el tiempo se acaba con la página abierta → se oculta el
  // formulario en ese mismo segundo, sin esperar a que el usuario recargue.
  const terminoAhora = subastaTerminada();
  if (terminoAhora && !laSubastaYaTerminoEnPantalla) {
    mostrarOpcionesDeParticipacion();
  }
  laSubastaYaTerminoEnPantalla = terminoAhora;
}


// ---------------------------------------------------------------------
// Al abrir la página
// ---------------------------------------------------------------------
async function iniciarPagina() {
  if (idDeLaSubasta === null) {
    mostrarMensaje(
      mensajeDeLaSubasta,
      'La dirección no indica qué subasta ver. Regresa al catálogo y elige una.',
      'error'
    );
    return;
  }

  perfilDelUsuario = await promesaDelPerfilDelUsuarioActual;
  await cargarSubasta();

  // Si no se pudo cargar (no existe o no hay internet), no tiene caso seguir
  if (!subastaActual) {
    return;
  }
  escucharCambiosEnTiempoReal();
  setInterval(actualizarReloj, 1000);
}

// CASO LÍMITE: la dirección de la foto está rota → foto por defecto (una sola vez)
fotoDelProducto.onerror = () => {
  fotoDelProducto.onerror = null;
  fotoDelProducto.src = FOTO_POR_DEFECTO;
};

botonEntrarALaSubasta.addEventListener('click', entrarALaSubasta);
formularioDePuja.addEventListener('submit', enviarPuja);
iniciarPagina();
