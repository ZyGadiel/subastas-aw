// =====================================================================
//  CATÁLOGO (index.html)
//  1. Pide a Supabase las subastas activas.
//  2. Crea una tarjeta por cada una.
//  3. Cada segundo actualiza el tiempo restante de todas las tarjetas.
// =====================================================================

const contenedorDeSubastas = document.getElementById('lista-de-subastas');
const mensajeDelCatalogo = document.getElementById('mensaje-del-catalogo');

// FOTO_POR_DEFECTO y LUGARES_POR_SUBASTA están en js/utilidades.js
// (también los usa la página de detalle, js/subasta.js)


// ---------------------------------------------------------------------
// Pide las subastas a la base de datos. Es como este SQL:
//   SELECT id, titulo, ..., (cuántos participantes tiene)
//   FROM subastas
//   WHERE estado = 'activa' AND fecha_de_finalizacion > ahora
//   ORDER BY fecha_de_finalizacion ASC;   ← las que terminan primero, arriba
// ---------------------------------------------------------------------
async function cargarSubastasActivas() {
  mostrarMensaje(mensajeDelCatalogo, 'Cargando subastas...', 'aviso');

  const fechaYHoraActual = new Date().toISOString();

  // Supabase responde con { data, error } (nombres en inglés de la librería);
  // al recibirlos les ponemos nombres en español.
  const { data: subastasActivas, error: errorDeLaConsulta } = await baseDeDatos
    .from('subastas')
    .select('id, titulo, categoria, url_de_la_foto, precio_actual, fecha_de_finalizacion, participantes(count)')
    .eq('estado', 'activa')
    .gt('fecha_de_finalizacion', fechaYHoraActual)
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

  // CASO LÍMITE: todavía no hay ninguna subasta.
  if (subastasActivas.length === 0) {
    mostrarMensaje(mensajeDelCatalogo, 'No hay subastas activas por ahora. ¡Vuelve pronto!', 'aviso');
    return;
  }

  borrarMensaje(mensajeDelCatalogo);
  const tarjetas = subastasActivas.map(crearTarjetaDeSubasta);
  contenedorDeSubastas.replaceChildren(...tarjetas);
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


// Al abrir la página: cargar las subastas y arrancar el reloj
// (actualizarTiemposRestantes está en js/utilidades.js)
cargarSubastasActivas();
setInterval(actualizarTiemposRestantes, 1000);
