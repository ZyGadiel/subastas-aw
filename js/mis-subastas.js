// =====================================================================
//  MIS SUBASTAS (mis-subastas.html)
//  Cada quien ve una lista distinta según su rol:
//   * VENDEDOR:  las subastas que publicó, si se vendieron, la comisión
//                del 3 % y cuánto recibe.
//   * COMPRADOR: las subastas en las que ocupó un lugar, si va ganando,
//                si lo superaron, si ganó o si perdió.
//  Cada 30 segundos se vuelve a cargar, para ver las que se cierran.
// =====================================================================

const tituloDeMisSubastas = document.getElementById('titulo-de-mis-subastas');
const resumenDeMisSubastas = document.getElementById('resumen-de-mis-subastas');
const mensajeDeMisSubastas = document.getElementById('mensaje-de-mis-subastas');
const listaDeMisSubastas = document.getElementById('lista-de-mis-subastas');

const SEGUNDOS_ENTRE_ACTUALIZACIONES = 30;

let perfilDelUsuario = null;
let esLaPrimeraCarga = true;   // solo la primera vez se muestra "Cargando..."


// ---------------------------------------------------------------------
// ¿En qué momento está una subasta?
//   'en-curso'  → activa y con tiempo
//   'cerrando'  → el tiempo ya pasó, pero el servidor aún no la cierra
//                 (pg_cron la cierra en menos de un minuto)
//   'terminada' → finalizada
// ---------------------------------------------------------------------
function obtenerMomentoDeLaSubasta(subasta) {
  if (subasta.estado === 'finalizada') {
    return 'terminada';
  }
  if (new Date(subasta.fecha_de_finalizacion) <= new Date()) {
    return 'cerrando';
  }
  return 'en-curso';
}


// ---------------------------------------------------------------------
// Construye una tarjeta (mismo diseño que el catálogo).
// datosDeLaTarjeta = {
//   subasta,                         la fila de la tabla "subastas"
//   textoDeLaEtiqueta, tipoDeEtiqueta    'exito', 'error', 'aviso' o 'neutra'
//   renglones,                       textos que van debajo del título
// }
// Como en el catálogo, todo se escribe con textContent (evita XSS).
// ---------------------------------------------------------------------
function crearTarjetaDeMiSubasta(datosDeLaTarjeta) {
  const { subasta, textoDeLaEtiqueta, tipoDeEtiqueta, renglones } = datosDeLaTarjeta;

  const tarjeta = document.createElement('article');
  tarjeta.className = 'tarjeta-de-subasta';

  const fotoDelProducto = document.createElement('img');
  fotoDelProducto.src = subasta.url_de_la_foto || FOTO_POR_DEFECTO;
  fotoDelProducto.alt = `Foto de ${subasta.titulo}`;
  fotoDelProducto.loading = 'lazy';
  fotoDelProducto.onerror = () => {
    fotoDelProducto.onerror = null;
    fotoDelProducto.src = FOTO_POR_DEFECTO;
  };

  const etiquetaDeEstado = document.createElement('span');
  etiquetaDeEstado.className = `etiqueta-de-estado etiqueta-${tipoDeEtiqueta === 'neutra' ? 'neutra' : 'de-' + tipoDeEtiqueta}`;
  etiquetaDeEstado.textContent = textoDeLaEtiqueta;

  const tituloDelProducto = document.createElement('h2');
  tituloDelProducto.textContent = subasta.titulo;

  const parrafos = renglones.map((textoDelRenglon) => {
    const parrafo = document.createElement('p');
    parrafo.textContent = textoDelRenglon;
    return parrafo;
  });

  // Si sigue en curso, un renglón con el tiempo restante que se actualiza cada segundo
  if (obtenerMomentoDeLaSubasta(subasta) === 'en-curso') {
    const tiempoRestante = document.createElement('span');
    tiempoRestante.dataset.fechaDeFinalizacion = subasta.fecha_de_finalizacion;
    tiempoRestante.textContent = formatearTiempoRestante(subasta.fecha_de_finalizacion);
    const parrafoDeTiempo = document.createElement('p');
    parrafoDeTiempo.append('Tiempo restante: ', tiempoRestante);
    parrafos.push(parrafoDeTiempo);
  }

  const enlaceAlDetalle = document.createElement('a');
  enlaceAlDetalle.className = 'enlace-ver-subasta'; // botón "Ver subasta" (css: .enlace-ver-subasta)
  enlaceAlDetalle.href = `subasta.html?id=${subasta.id}`;
  enlaceAlDetalle.textContent = 'Ver subasta';

  tarjeta.append(fotoDelProducto, etiquetaDeEstado, tituloDelProducto, ...parrafos, enlaceAlDetalle);
  return tarjeta;
}


// ---------------------------------------------------------------------
// VENDEDOR: las subastas que publicó
// ---------------------------------------------------------------------
async function cargarMisPublicaciones() {
  tituloDeMisSubastas.textContent = 'Mis publicaciones';

  // SELECT ..., (cuántos participantes) FROM subastas
  // WHERE id_del_vendedor = 'yo' ORDER BY fecha_de_creacion DESC
  const { data: misPublicaciones, error: errorDeLaConsulta } = await baseDeDatos
    .from('subastas')
    .select('id, titulo, url_de_la_foto, precio_actual, fecha_de_finalizacion, estado, id_del_ganador, participantes(count)')
    .eq('id_del_vendedor', perfilDelUsuario.id)
    .order('fecha_de_creacion', { ascending: false });

  if (errorDeLaConsulta) {
    mostrarErrorDeCarga(errorDeLaConsulta);
    return;
  }
  // CASO LÍMITE: todavía no ha publicado nada
  if (misPublicaciones.length === 0) {
    mostrarListaVacia('Todavía no has publicado ninguna subasta. ¡Publica la primera desde "Publicar"!');
    return;
  }

  let cantidadEnCurso = 0;
  let cantidadVendidas = 0;
  let totalQueRecibes = 0;

  const tarjetas = misPublicaciones.map((subasta) => {
    const momentoDeLaSubasta = obtenerMomentoDeLaSubasta(subasta);
    const precioActual = Number(subasta.precio_actual);
    const lugaresOcupados = subasta.participantes[0]?.count ?? 0;

    if (momentoDeLaSubasta === 'en-curso') {
      cantidadEnCurso += 1;
      return crearTarjetaDeMiSubasta({
        subasta,
        textoDeLaEtiqueta: 'En curso',
        tipoDeEtiqueta: 'aviso',
        renglones: [
          `Precio actual: ${formatearDinero(precioActual)}`,
          `Lugares ocupados: ${lugaresOcupados} / ${LUGARES_POR_SUBASTA}`,
        ],
      });
    }
    if (momentoDeLaSubasta === 'cerrando') {
      return crearTarjetaDeMiSubasta({
        subasta,
        textoDeLaEtiqueta: 'Cerrando...',
        tipoDeEtiqueta: 'neutra',
        renglones: ['El tiempo terminó. En unos segundos aparece el resultado.'],
      });
    }
    // CASO LÍMITE: terminó sin pujas
    if (!subasta.id_del_ganador) {
      return crearTarjetaDeMiSubasta({
        subasta,
        textoDeLaEtiqueta: 'Sin pujas',
        tipoDeEtiqueta: 'neutra',
        renglones: ['Terminó sin pujas. Puedes volver a publicar el producto.'],
      });
    }

    const comision = calcularComision(precioActual);
    cantidadVendidas += 1;
    totalQueRecibes += precioActual - comision;
    return crearTarjetaDeMiSubasta({
      subasta,
      textoDeLaEtiqueta: 'Vendida',
      tipoDeEtiqueta: 'exito',
      renglones: [
        `Precio final: ${formatearDinero(precioActual)}`,
        `Comisión (${PORCENTAJE_DE_COMISION} %): ${formatearDinero(comision)}`,
        `Recibes: ${formatearDinero(precioActual - comision)}`,
      ],
    });
  });

  const textoDePublicaciones = misPublicaciones.length === 1 ? '1 subasta' : `${misPublicaciones.length} subastas`;
  const textoDeVendidas = cantidadVendidas === 1 ? '1 vendida' : `${cantidadVendidas} vendidas`;
  resumenDeMisSubastas.textContent =
    `Publicaste ${textoDePublicaciones} · ${cantidadEnCurso} en curso · ${textoDeVendidas} · ` +
    `Recibes en total: ${formatearDinero(totalQueRecibes)}`;
  mostrarTarjetas(tarjetas);
}


// ---------------------------------------------------------------------
// COMPRADOR: las subastas en las que ocupó un lugar
// ---------------------------------------------------------------------
async function cargarMisParticipaciones() {
  tituloDeMisSubastas.textContent = 'Subastas en las que participo';

  // Desde "participantes" se pide también la subasta de cada lugar.
  // Es como un JOIN: participantes JOIN subastas ON participantes.id_de_la_subasta = subastas.id
  const { data: misLugares, error: errorDeLosLugares } = await baseDeDatos
    .from('participantes')
    .select('numero_de_lugar, subastas(id, titulo, url_de_la_foto, precio_actual, fecha_de_finalizacion, estado, id_del_ganador)')
    .eq('id_del_usuario', perfilDelUsuario.id);

  if (errorDeLosLugares) {
    mostrarErrorDeCarga(errorDeLosLugares);
    return;
  }

  // CASO LÍMITE: si una subasta fue eliminada, la política RLS la oculta y
  // llega vacía (null). Esas se quitan de la lista.
  const misParticipaciones = misLugares
    .filter((lugar) => lugar.subastas !== null)
    .sort((primera, segunda) =>
      new Date(segunda.subastas.fecha_de_finalizacion) - new Date(primera.subastas.fecha_de_finalizacion)
    );

  // CASO LÍMITE: todavía no entra a ninguna subasta
  if (misParticipaciones.length === 0) {
    mostrarListaVacia('Todavía no participas en ninguna subasta. Busca una en el catálogo y da clic en "Entrar".');
    return;
  }

  // Para las que siguen en curso: ¿quién hizo la última puja (la más alta)?
  // Una sola consulta para todas: WHERE id_de_la_subasta IN (3, 6, 7)
  const idsDeMisSubastas = misParticipaciones.map((lugar) => lugar.subastas.id);
  const { data: pujasDeMisSubastas, error: errorDeLasPujas } = await baseDeDatos
    .from('pujas')
    .select('id_de_la_subasta, id_del_usuario')
    .in('id_de_la_subasta', idsDeMisSubastas)
    .order('fecha_de_la_puja', { ascending: false });

  if (errorDeLasPujas) {
    mostrarErrorDeCarga(errorDeLasPujas);
    return;
  }

  // id de la subasta → id de quien va ganando (la primera puja de cada subasta es la más nueva)
  const quienVaGanandoCadaSubasta = new Map();
  for (const puja of pujasDeMisSubastas) {
    if (!quienVaGanandoCadaSubasta.has(puja.id_de_la_subasta)) {
      quienVaGanandoCadaSubasta.set(puja.id_de_la_subasta, puja.id_del_usuario);
    }
  }

  let cantidadGanadas = 0;
  let totalAPagar = 0;

  const tarjetas = misParticipaciones.map((lugar) => {
    const subasta = lugar.subastas;
    const momentoDeLaSubasta = obtenerMomentoDeLaSubasta(subasta);
    const precioActual = Number(subasta.precio_actual);
    const renglonDelLugar = `Eres el Participante ${lugar.numero_de_lugar}`;

    if (momentoDeLaSubasta === 'en-curso') {
      const idDeQuienVaGanando = quienVaGanandoCadaSubasta.get(subasta.id);
      let textoDeLaEtiqueta = 'En curso · sin pujas';
      let tipoDeEtiqueta = 'aviso';
      if (idDeQuienVaGanando === perfilDelUsuario.id) {
        textoDeLaEtiqueta = 'Vas ganando';
        tipoDeEtiqueta = 'exito';
      } else if (idDeQuienVaGanando) {
        textoDeLaEtiqueta = 'Te superaron';
        tipoDeEtiqueta = 'error';
      }
      return crearTarjetaDeMiSubasta({
        subasta,
        textoDeLaEtiqueta,
        tipoDeEtiqueta,
        renglones: [renglonDelLugar, `Precio actual: ${formatearDinero(precioActual)}`],
      });
    }
    if (momentoDeLaSubasta === 'cerrando') {
      return crearTarjetaDeMiSubasta({
        subasta,
        textoDeLaEtiqueta: 'Cerrando...',
        tipoDeEtiqueta: 'neutra',
        renglones: [renglonDelLugar, 'El tiempo terminó. En unos segundos aparece el resultado.'],
      });
    }
    if (subasta.id_del_ganador === perfilDelUsuario.id) {
      cantidadGanadas += 1;
      totalAPagar += precioActual;
      return crearTarjetaDeMiSubasta({
        subasta,
        textoDeLaEtiqueta: 'Ganaste 🎉',
        tipoDeEtiqueta: 'exito',
        renglones: [renglonDelLugar, `Pagas: ${formatearDinero(precioActual)}`],
      });
    }
    return crearTarjetaDeMiSubasta({
      subasta,
      textoDeLaEtiqueta: 'No ganaste',
      tipoDeEtiqueta: 'neutra',
      renglones: [renglonDelLugar, `Precio final: ${formatearDinero(precioActual)}`],
    });
  });

  const textoDeParticipaciones =
    misParticipaciones.length === 1 ? '1 subasta' : `${misParticipaciones.length} subastas`;
  resumenDeMisSubastas.textContent =
    `Participas en ${textoDeParticipaciones} · Ganaste ${cantidadGanadas} · ` +
    `Total a pagar: ${formatearDinero(totalAPagar)}`;
  mostrarTarjetas(tarjetas);
}


// ---------------------------------------------------------------------
// Funciones de apoyo para mostrar la lista, la lista vacía o un error
// ---------------------------------------------------------------------
function mostrarTarjetas(tarjetas) {
  borrarMensaje(mensajeDeMisSubastas);
  listaDeMisSubastas.replaceChildren(...tarjetas);
}

function mostrarListaVacia(textoDelAviso) {
  resumenDeMisSubastas.textContent = '';
  listaDeMisSubastas.replaceChildren();
  mostrarMensaje(mensajeDeMisSubastas, textoDelAviso, 'aviso');
}

// CASO LÍMITE: sin internet. Si ya había una lista, se deja como estaba
// y solo se avisa; así no desaparece todo por un error de un momento.
function mostrarErrorDeCarga(errorDeLaConsulta) {
  console.error('Error al cargar mis subastas:', errorDeLaConsulta);
  mostrarMensaje(
    mensajeDeMisSubastas,
    'No pudimos cargar tus subastas. Revisa tu conexión; lo intentaremos de nuevo en unos segundos.',
    'error'
  );
}


// ---------------------------------------------------------------------
// Elige qué lista cargar según el rol
// ---------------------------------------------------------------------
async function cargarMisSubastas() {
  if (esLaPrimeraCarga) {
    mostrarMensaje(mensajeDeMisSubastas, 'Cargando tus subastas...', 'aviso');
    esLaPrimeraCarga = false;
  }

  if (perfilDelUsuario.rol === 'vendedor') {
    await cargarMisPublicaciones();
  } else {
    await cargarMisParticipaciones();
  }
}

async function iniciarPagina() {
  perfilDelUsuario = await promesaDelPerfilDelUsuarioActual;

  // CASO LÍMITE: alguien escribe mis-subastas.html sin haber iniciado sesión
  if (!perfilDelUsuario) {
    mostrarMensaje(mensajeDeMisSubastas, 'Inicia sesión para ver tus subastas.', 'aviso');
    return;
  }
  // CASO LÍMITE: el administrador no publica ni puja
  if (perfilDelUsuario.rol !== 'vendedor' && perfilDelUsuario.rol !== 'comprador') {
    mostrarMensaje(mensajeDeMisSubastas, 'Esta página es para compradores y vendedores.', 'aviso');
    return;
  }

  await cargarMisSubastas();
  setInterval(actualizarTiemposRestantes, 1000);
  // Cada 30 segundos se recarga la lista: así aparecen las subastas que se cierran
  setInterval(cargarMisSubastas, SEGUNDOS_ENTRE_ACTUALIZACIONES * 1000);
}

iniciarPagina();
