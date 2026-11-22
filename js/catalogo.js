// =====================================================================
//  CATÁLOGO (index.html)
//  1. Lee la búsqueda y la categoría de la dirección (Sección 9).
//  2. Pide a Supabase las subastas activas que coinciden.
//  3. Crea una tarjeta por cada una.
//  4. Cada segundo actualiza el tiempo restante de todas las tarjetas.
// =====================================================================

const contenedorDeSubastas = document.getElementById('lista-de-subastas');
const mensajeDelCatalogo = document.getElementById('mensaje-del-catalogo');
const campoDelTextoABuscar = document.getElementById('texto-a-buscar');
const selectorDeCategoria = document.getElementById('filtro-de-categoria');
const resumenDeLaBusqueda = document.getElementById('resumen-de-la-busqueda');
const textoDelResumenDeLaBusqueda = document.getElementById('texto-del-resumen-de-la-busqueda');

const LONGITUD_MAXIMA_DE_LA_BUSQUEDA = 80; // igual que maxlength del HTML y el título de la subasta

// FOTO_POR_DEFECTO y LUGARES_POR_SUBASTA están en js/utilidades.js
// (también los usa la página de detalle, js/subasta.js)


// ---------------------------------------------------------------------
// 1. Lee los filtros de la dirección:
//    index.html?texto_a_buscar=bici&categoria=deportes
//    → { textoABuscar: 'bici', categoria: 'deportes' }
//    La dirección la puede escribir cualquiera a mano, así que se revisa.
// ---------------------------------------------------------------------
function leerFiltrosDeLaDireccion() {
  const parametrosDeLaDireccion = new URLSearchParams(window.location.search);

  // CASO LÍMITE: puros espacios → sin búsqueda; texto enorme → se recorta
  const textoABuscar = (parametrosDeLaDireccion.get('texto_a_buscar') ?? '')
    .trim()
    .slice(0, LONGITUD_MAXIMA_DE_LA_BUSQUEDA);

  // CASO LÍMITE: una categoría que no existe (?categoria=juguetes) → todas.
  // Object.hasOwn revisa solo nuestras categorías (no cosas como "toString").
  let categoria = parametrosDeLaDireccion.get('categoria') ?? '';
  if (!Object.hasOwn(NOMBRES_DE_LAS_CATEGORIAS, categoria)) {
    categoria = '';
  }

  return { textoABuscar, categoria };
}

// Vuelve a escribir la búsqueda en el formulario, para que el usuario vea qué buscó
function mostrarFiltrosEnElFormulario(filtros) {
  campoDelTextoABuscar.value = filtros.textoABuscar;
  selectorDeCategoria.value = filtros.categoria;
}

// En la búsqueda, % significa "cualquier texto" y _ "cualquier letra".
// CASO LÍMITE: si alguien busca "100%" o "mi_bici", esos signos deben contar
// como letras normales. La diagonal invertida \ le dice a PostgreSQL
// "este signo va tal cual".
// CASO LÍMITE: "Lámpara" y "lampara" deben encontrarse igual.
// Se deja el texto como la columna titulo_para_buscar de la base de datos
// (supabase/seccion-9-busqueda.sql): sin acentos y en minúsculas.
//   normalize('NFD') separa cada letra de su acento: "á" → "a" + "´"
//   y luego se borran los acentos sueltos (los caracteres \u0300 a \u036f).
function quitarAcentos(texto) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function escaparComodines(textoABuscar) {
  return textoABuscar.replace(/[\\%_]/g, (signo) => `\\${signo}`);
}


// ---------------------------------------------------------------------
// 2. Pide las subastas a la base de datos. Es como este SQL:
//   SELECT id, titulo, ..., (cuántos participantes tiene)
//   FROM subastas
//   WHERE estado = 'activa' AND fecha_de_finalizacion > ahora
//     AND titulo_para_buscar ILIKE '%bici%'   ← solo si se buscó un texto
//                                              (el título sin acentos)
//     AND categoria = 'deportes'         ← solo si se eligió una categoría
//   ORDER BY fecha_de_finalizacion ASC;   ← las que terminan primero, arriba
//  ILIKE = LIKE sin importar mayúsculas: "BICI" encuentra "Bicicleta".
// ---------------------------------------------------------------------
async function cargarSubastasActivas(filtros) {
  mostrarMensaje(mensajeDelCatalogo, 'Cargando subastas...', 'aviso');

  const fechaYHoraActual = new Date().toISOString();

  // La consulta se arma por partes: primero lo que siempre va...
  let consultaDeSubastas = baseDeDatos
    .from('subastas')
    .select('id, titulo, categoria, url_de_la_foto, precio_actual, fecha_de_finalizacion, participantes(count)')
    .eq('estado', 'activa')
    .gt('fecha_de_finalizacion', fechaYHoraActual);

  // ...y luego los filtros, solo si el usuario los usó
  if (filtros.textoABuscar !== '') {
    const textoLimpio = escaparComodines(quitarAcentos(filtros.textoABuscar));
    consultaDeSubastas = consultaDeSubastas.ilike('titulo_para_buscar', `%${textoLimpio}%`);
  }
  if (filtros.categoria !== '') {
    consultaDeSubastas = consultaDeSubastas.eq('categoria', filtros.categoria);
  }

  // Supabase responde con { data, error } (nombres en inglés de la librería);
  // al recibirlos les ponemos nombres en español.
  const { data: subastasActivas, error: errorDeLaConsulta } = await consultaDeSubastas
    .order('fecha_de_finalizacion', { ascending: true });

  // CASO LÍMITE: la base de datos no responde o hay un error.
  // En lugar de dejar la pantalla en blanco, avisamos al usuario.
  if (errorDeLaConsulta) {
    console.error('Error al cargar las subastas:', errorDeLaConsulta);
    mostrarMensaje(
      mensajeDelCatalogo,
      'No pudimos cargar las subastas. Revisa tu conexión y recarga la página.',
      'error'
    );
    return;
  }

  const hayFiltros = filtros.textoABuscar !== '' || filtros.categoria !== '';
  mostrarResumenDeLaBusqueda(filtros, subastasActivas.length);

  // CASO LÍMITE: no hay resultados. El mensaje es distinto si se estaba buscando.
  if (subastasActivas.length === 0) {
    const textoDelAviso = hayFiltros
      ? 'No encontramos subastas activas con esa búsqueda. Prueba con otra palabra o quita los filtros.'
      : 'No hay subastas activas por ahora. ¡Vuelve pronto!';
    contenedorDeSubastas.replaceChildren();
    mostrarMensaje(mensajeDelCatalogo, textoDelAviso, 'aviso');
    return;
  }

  borrarMensaje(mensajeDelCatalogo);
  const tarjetas = subastasActivas.map(crearTarjetaDeSubasta);
  contenedorDeSubastas.replaceChildren(...tarjetas);
}


// ---------------------------------------------------------------------
// 3. Resumen arriba de las tarjetas: "2 resultados para «bici» en Deportes"
//    Solo aparece si hay algún filtro.
// ---------------------------------------------------------------------
function mostrarResumenDeLaBusqueda(filtros, cantidadDeResultados) {
  const hayFiltros = filtros.textoABuscar !== '' || filtros.categoria !== '';
  resumenDeLaBusqueda.hidden = !hayFiltros;
  if (!hayFiltros) {
    return;
  }

  let textoDelResumen = cantidadDeResultados === 1 ? '1 resultado' : `${cantidadDeResultados} resultados`;
  if (filtros.textoABuscar !== '') {
    textoDelResumen += ` para «${filtros.textoABuscar}»`;
  }
  if (filtros.categoria !== '') {
    textoDelResumen += ` en ${NOMBRES_DE_LAS_CATEGORIAS[filtros.categoria]}`;
  }
  // textContent: aunque alguien busque "<script>", se muestra como texto (evita XSS)
  textoDelResumenDeLaBusqueda.textContent = textoDelResumen;
}


// ---------------------------------------------------------------------
// Construye el <article> de una subasta.
// Usamos textContent (y NO innerHTML) para los datos que escribió un usuario:
// así, si alguien pone código HTML en el título, se muestra como texto
// y no se ejecuta (evita ataques XSS).
// ---------------------------------------------------------------------
function crearTarjetaDeSubasta(subasta) {
  const tarjeta = document.createElement('article');
  tarjeta.className = 'tarjeta-de-subasta';

  // Foto del producto
  const fotoDelProducto = document.createElement('img');
  fotoDelProducto.src = subasta.url_de_la_foto || FOTO_POR_DEFECTO;
  fotoDelProducto.alt = `Foto de ${subasta.titulo}`;
  fotoDelProducto.loading = 'lazy'; // la foto se descarga hasta que está cerca de verse
  // CASO LÍMITE: la dirección de la foto está rota → ponemos la foto por defecto (una sola vez)
  fotoDelProducto.onerror = () => {
    fotoDelProducto.onerror = null;
    fotoDelProducto.src = FOTO_POR_DEFECTO;
  };

  // Título
  const tituloDelProducto = document.createElement('h2');
  tituloDelProducto.textContent = subasta.titulo;

  // Categoría
  const nombreDeLaCategoria = NOMBRES_DE_LAS_CATEGORIAS[subasta.categoria] ?? subasta.categoria;
  const parrafoDeCategoria = document.createElement('p');
  parrafoDeCategoria.textContent = `Categoría: ${nombreDeLaCategoria}`;

  // Precio actual
  const precioActualResaltado = document.createElement('strong');
  precioActualResaltado.textContent = formatearDinero(subasta.precio_actual);
  const parrafoDePrecio = document.createElement('p');
  parrafoDePrecio.append('Precio actual: ', precioActualResaltado);

  // Tiempo restante: guardamos la fecha de fin en un atributo data-
  // para que actualizarTiemposRestantes() la encuentre cada segundo
  const tiempoRestante = document.createElement('span');
  tiempoRestante.dataset.fechaDeFinalizacion = subasta.fecha_de_finalizacion;
  tiempoRestante.textContent = formatearTiempoRestante(subasta.fecha_de_finalizacion);
  const parrafoDeTiempo = document.createElement('p');
  parrafoDeTiempo.append('Tiempo restante: ', tiempoRestante);

  // Lugares ocupados. Supabase regresa el conteo así: participantes: [{ count: 3 }]
  const lugaresOcupados = subasta.participantes[0]?.count ?? 0;
  const parrafoDeLugares = document.createElement('p');
  parrafoDeLugares.textContent = `Lugares ocupados: ${lugaresOcupados} / ${LUGARES_POR_SUBASTA}`;

  // Enlace al detalle. El id viaja en la dirección: subasta.html?id=7
  const subastaLlena = lugaresOcupados >= LUGARES_POR_SUBASTA;
  const enlaceAlDetalle = document.createElement('a');
  enlaceAlDetalle.href = `subasta.html?id=${subasta.id}`;
  enlaceAlDetalle.textContent = subastaLlena ? 'Ver subasta (llena)' : 'Ver subasta';

  tarjeta.append(
    fotoDelProducto,
    tituloDelProducto,
    parrafoDeCategoria,
    parrafoDePrecio,
    parrafoDeTiempo,
    parrafoDeLugares,
    enlaceAlDetalle
  );
  return tarjeta;
}


// Al abrir la página: leer los filtros, cargar las subastas y arrancar el reloj
// (actualizarTiemposRestantes está en js/utilidades.js)
const filtrosDeLaBusqueda = leerFiltrosDeLaDireccion();
mostrarFiltrosEnElFormulario(filtrosDeLaBusqueda);
cargarSubastasActivas(filtrosDeLaBusqueda);
setInterval(actualizarTiemposRestantes, 1000);
