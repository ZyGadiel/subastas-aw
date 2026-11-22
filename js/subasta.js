// =====================================================================
//  DETALLE DE SUBASTA (subasta.html?id=7)
//  1. Lee el id de la dirección y carga la subasta, sus participantes y sus pujas.
//  2. Decide qué puede hacer quien está viendo: entrar, pujar o solo mirar.
//  3. Entra y puja con las funciones de la base de datos (supabase/seccion-7-puja.sql).
//     Se puede pujar el mínimo con un clic o escribir otra cantidad.
//     Las posiciones (quién va ganando) se ven junto al formulario.
//  4. Escucha los cambios en TIEMPO REAL: si alguien puja desde otra
//     computadora, esta página se actualiza sola, sin recargar.
//  5. Cada segundo actualiza el tiempo restante. Cuando llega a cero, pide
//     a la base de datos cerrar la subasta y muestra al ganador (Sección 8).
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
const botonPujarElMinimo = document.getElementById('boton-pujar-el-minimo');
const textoDeLaPujaRapida = document.getElementById('monto-de-la-puja-rapida');
const listaDePosiciones = document.getElementById('lista-de-posiciones');
const seccionDelResultado = document.getElementById('resultado-de-la-subasta');
const textoDelResultado = document.getElementById('texto-del-resultado');
const detalleDelResultado = document.getElementById('detalle-del-resultado');
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
let cierreEnCurso = false;             // ¿ya le pedimos a la base de datos cerrar la subasta?


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
      .select('id, id_del_vendedor, titulo, descripcion, categoria, url_de_la_foto, precio_inicial, incremento_minimo, precio_actual, fecha_de_finalizacion, estado, id_del_ganador')
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

// Privacidad: nunca se muestra el nombre real, solo "Participante 3".
// Si es el usuario que está viendo, se agrega "(tú)".
function obtenerNombreParaMostrar(idDelUsuario) {
  let nombreParaMostrar = `Participante ${buscarLugarDelUsuario(idDelUsuario)}`;
  if (perfilDelUsuario && idDelUsuario === perfilDelUsuario.id) {
    nombreParaMostrar += ' (tú)';
  }
  return nombreParaMostrar;
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
  mostrarResultadoDeLaSubasta();
  mostrarOpcionesDeParticipacion();
  mostrarPosiciones();
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
    // CASO LÍMITE: el tiempo ya pasó pero la base de datos aún no la cierra
    const textoDelCierre = subastaActual.estado === 'finalizada'
      ? 'Esta subasta ya terminó. Ya no se aceptan pujas.'
      : 'El tiempo terminó. Calculando el ganador...';
    mostrarMensaje(estadoDeTuParticipacion, textoDelCierre, 'aviso');
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
    textoDeLaPujaRapida.textContent = formatearDinero(montoMinimo);
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

// ---------------------------------------------------------------------
// RESULTADO (Sección 8): solo aparece cuando la subasta ya se cerró.
// Cada quien ve un mensaje distinto:
//   * el ganador:      "¡Ganaste esta subasta!"
//   * el vendedor:     a quién se vendió, la comisión del 3 % y lo que recibe
//   * los demás:       "Ganó el Participante 3 con $1,310.00"
//   * sin pujas:       "Terminó sin pujas"
// ---------------------------------------------------------------------
function mostrarResultadoDeLaSubasta() {
  if (subastaActual.estado !== 'finalizada') {
    seccionDelResultado.hidden = true;
    return;
  }
  seccionDelResultado.hidden = false;

  const precioFinal = Number(subastaActual.precio_actual);
  const idDelGanador = subastaActual.id_del_ganador;
  const esElVendedor = perfilDelUsuario !== null && perfilDelUsuario.id === subastaActual.id_del_vendedor;
  const esElGanador = perfilDelUsuario !== null && perfilDelUsuario.id === idDelGanador;

  // CASO LÍMITE: nadie pujó
  if (!idDelGanador) {
    textoDelResultado.textContent = 'La subasta terminó sin pujas. No hubo ganador.';
    detalleDelResultado.textContent = esElVendedor ? 'Puedes volver a publicar tu producto.' : '';
    return;
  }

  const nombreDelGanador = obtenerNombreParaMostrar(idDelGanador);

  if (esElGanador) {
    textoDelResultado.textContent = '¡Ganaste esta subasta! 🎉';
    detalleDelResultado.textContent = `Tu puja ganadora fue de ${formatearDinero(precioFinal)}.`;
  } else if (esElVendedor) {
    const comision = calcularComision(precioFinal);
    textoDelResultado.textContent = `Vendido a ${nombreDelGanador} por ${formatearDinero(precioFinal)}.`;
    detalleDelResultado.textContent =
      `Comisión de la página (${PORCENTAJE_DE_COMISION} %): ${formatearDinero(comision)}. ` +
      `Tú recibes: ${formatearDinero(precioFinal - comision)}.`;
  } else {
    textoDelResultado.textContent = `Ganó ${nombreDelGanador} con ${formatearDinero(precioFinal)}.`;
    detalleDelResultado.textContent = '';
  }
}


// ---------------------------------------------------------------------
// POSICIONES: una lista corta con los 5 lugares, ordenada de quien va
// ganando a quien no ha pujado, y al final los lugares libres.
//   1º  Participante 3 (tú)   $1,600.00
//   2º  Participante 1        $1,550.00
//   —   Participante 2        Sin pujas
//   —   Lugar libre
// ---------------------------------------------------------------------
function calcularPosiciones() {
  // La puja más alta de cada participante. Las pujas vienen de la más nueva a
  // la más vieja y el precio solo sube, así que la primera que encontramos
  // de cada usuario es la más alta.
  const pujaMasAltaDeCadaUsuario = new Map(); // id_del_usuario → monto
  for (const puja of pujasDeLaSubasta) {
    if (!pujaMasAltaDeCadaUsuario.has(puja.id_del_usuario)) {
      pujaMasAltaDeCadaUsuario.set(puja.id_del_usuario, Number(puja.monto));
    }
  }

  const posiciones = participantesDeLaSubasta.map((participante) => ({
    idDelUsuario: participante.id_del_usuario,
    numeroDeLugar: participante.numero_de_lugar,
    montoMasAlto: pujaMasAltaDeCadaUsuario.get(participante.id_del_usuario) ?? null,
  }));

  // Ordenar: primero los que pujaron (del monto mayor al menor);
  // después los que no han pujado, por su número de lugar.
  posiciones.sort((primera, segunda) => {
    if (primera.montoMasAlto === null && segunda.montoMasAlto === null) {
      return primera.numeroDeLugar - segunda.numeroDeLugar;
    }
    if (primera.montoMasAlto === null) return 1;   // sin pujas → hacia abajo
    if (segunda.montoMasAlto === null) return -1;
    return segunda.montoMasAlto - primera.montoMasAlto;
  });

  return posiciones;
}

function mostrarPosiciones() {
  const renglones = calcularPosiciones().map((posicion, indice) => {
    const tienePujas = posicion.montoMasAlto !== null;
    // Cuando la subasta ya cerró, el primer lugar lleva un trofeo
    const esElGanador = subastaActual.estado === 'finalizada' && indice === 0 && tienePujas;
    let textoDeLaPosicion = tienePujas ? `${indice + 1}º` : '—';
    if (esElGanador) {
      textoDeLaPosicion = '🏆';
    }
    const textoDelMonto = tienePujas ? formatearDinero(posicion.montoMasAlto) : 'Sin pujas';
    const renglon = crearRenglonDePosicion(
      textoDeLaPosicion,
      obtenerNombreParaMostrar(posicion.idDelUsuario),
      textoDelMonto
    );

    if (indice === 0 && tienePujas) {
      renglon.className = 'posicion-ganadora';
    } else if (!tienePujas) {
      renglon.className = 'posicion-sin-pujas';
    }
    return renglon;
  });

  // Los lugares que nadie ha ocupado
  const lugaresLibres = LUGARES_POR_SUBASTA - participantesDeLaSubasta.length;
  for (let contadorDeLugaresLibres = 1; contadorDeLugaresLibres <= lugaresLibres; contadorDeLugaresLibres += 1) {
    const renglonLibre = crearRenglonDePosicion('—', 'Lugar libre', '');
    renglonLibre.className = 'lugar-libre';
    renglones.push(renglonLibre);
  }

  listaDePosiciones.replaceChildren(...renglones);
}

// Un renglón <li> con tres partes: posición, nombre y monto
function crearRenglonDePosicion(textoDeLaPosicion, textoDelNombre, textoDelMonto) {
  const numeroDePosicion = document.createElement('span');
  numeroDePosicion.className = 'numero-de-posicion';
  numeroDePosicion.textContent = textoDeLaPosicion;

  const nombreEnLaPosicion = document.createElement('span');
  nombreEnLaPosicion.className = 'nombre-en-la-posicion';
  nombreEnLaPosicion.textContent = textoDelNombre;

  const montoEnLaPosicion = document.createElement('span');
  montoEnLaPosicion.className = 'monto-en-la-posicion';
  montoEnLaPosicion.textContent = textoDelMonto;

  const renglon = document.createElement('li');
  renglon.append(numeroDePosicion, nombreEnLaPosicion, montoEnLaPosicion);
  return renglon;
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

function crearFilaDelHistorial(puja, esLaPujaMasAlta) {
  const nombreParaMostrar = obtenerNombreParaMostrar(puja.id_del_usuario);

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
// 5. Pujar. Hay dos formas, y las dos terminan en enviarPuja(monto):
//    a) Botón "Pujar el mínimo": un clic, sin escribir nada.
//    b) Escribir otra cantidad en el campo y dar "Pujar esta cantidad".
// ---------------------------------------------------------------------
function pujarElMinimo() {
  // El mínimo se calcula en el momento del clic, con el precio más reciente.
  // CASO LÍMITE: si alguien pujó un instante antes y la página aún no se
  // enteraba, la base de datos rechaza la puja, la página se recarga y el
  // botón ya muestra el mínimo nuevo.
  enviarPuja(calcularMontoMinimo());
}

function pujarLaCantidadEscrita(eventoDeEnvio) {
  eventoDeEnvio.preventDefault();
  enviarPuja(Number(campoDelMontoDeLaPuja.value));
}

async function enviarPuja(montoOfrecido) {
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

  // CASO LÍMITE: doble clic → dos pujas. Deshabilitamos LOS DOS botones mientras
  // se envía (si no, se podría dar clic en uno y luego en el otro).
  botonPujar.disabled = true;
  botonPujarElMinimo.disabled = true;
  mostrarMensaje(mensajeDeLaPuja, 'Enviando tu puja...', 'aviso');

  const { data: precioNuevo, error: errorAlPujar } = await baseDeDatos.rpc('pujar', {
    id_de_la_subasta_elegida: idDeLaSubasta,
    monto_ofrecido: montoOfrecido,
  });

  botonPujar.disabled = false;
  botonPujarElMinimo.disabled = false;

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

  // Ya pasó la hora pero sigue "activa" en la base de datos → pedimos cerrarla
  if (terminoAhora && subastaActual.estado === 'activa') {
    pedirCierreDeLaSubasta();
  }
}


// ---------------------------------------------------------------------
// 8. Cierre (Sección 8): le pide a la base de datos cerrar las subastas
//    vencidas. El servidor también lo hace solo cada minuto (pg_cron);
//    esto es para que el ganador aparezca en el mismo segundo.
//    No hace falta recargar aquí: al cerrarse, la subasta cambia y el
//    tiempo real (punto 6) avisa a TODAS las pantallas abiertas.
// ---------------------------------------------------------------------
async function pedirCierreDeLaSubasta() {
  // CASO LÍMITE: el reloj llama a esta función cada segundo; solo se pide una vez
  if (cierreEnCurso) {
    return;
  }
  cierreEnCurso = true;

  const { error: errorAlCerrar } = await baseDeDatos.rpc('cerrar_subastas_vencidas');
  if (errorAlCerrar) {
    console.error('No se pudo cerrar la subasta:', errorAlCerrar);
  }
  await cargarSubasta();

  // CASO LÍMITE: el reloj de esta computadora va adelantado y el servidor
  // todavía no la cierra. Se vuelve a intentar en 5 segundos.
  setTimeout(() => {
    cierreEnCurso = false;
  }, 5000);
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
botonPujarElMinimo.addEventListener('click', pujarElMinimo);
formularioDePuja.addEventListener('submit', pujarLaCantidadEscrita);
iniciarPagina();
