// =====================================================================
//  CATÁLOGO (index.html)
//  1. Lee la búsqueda y la categoría de la dirección (Sección 9).
//  2. Pide a Supabase las subastas activas que coinciden.
//  3. Crea una tarjeta por cada una.
//  4. Cada segundo actualiza el tiempo restante de todas las tarjetas.
//  5. Muestra la mini lista de las últimas subastas terminadas (Sección 14).
//  6. Muestra la portada de bienvenida solo a los visitantes (Sección 15).
// =====================================================================

const contenedorDeSubastas = document.getElementById('lista-de-subastas');
const mensajeDelCatalogo = document.getElementById('mensaje-del-catalogo');
const campoDelTextoABuscar = document.getElementById('texto-a-buscar');
const formularioDeBusqueda = document.getElementById('formulario-de-busqueda');
// Las pastillas de categoría son botones de opción con name="categoria".
// formulario.elements.categoria los agrupa: leer o escribir su .value
// marca la pastilla que tiene ese valor.
const pastillasDeCategoria = formularioDeBusqueda.elements.categoria;
const resumenDeLaBusqueda = document.getElementById('resumen-de-la-busqueda');
const textoDelResumenDeLaBusqueda = document.getElementById('texto-del-resumen-de-la-busqueda');

const LONGITUD_MAXIMA_DE_LA_BUSQUEDA = 80; // igual que maxlength del HTML y el título de la subasta

// crearFotoDelProducto y LUGARES_POR_SUBASTA están en js/utilidades.js
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
  pastillasDeCategoria.value = filtros.categoria; // '' = la pastilla "Todas"
}

// Al elegir una pastilla se busca en ese momento (sin tener que dar "Buscar").
// requestSubmit envía el formulario igual que el botón: la dirección
// cambia a index.html?texto_a_buscar=...&categoria=hogar
formularioDeBusqueda.addEventListener('change', (eventoDeCambio) => {
  if (eventoDeCambio.target.name === 'categoria') {
    formularioDeBusqueda.requestSubmit();
  }
});

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
  tarjeta.className = 'tarjeta-de-subasta tarjeta-clicable'; // toda la tarjeta lleva al detalle

  // Foto del producto, o el recuadro "Sin foto" si no tiene o no carga
  // (crearFotoDelProducto está en js/utilidades.js)
  const fotoDelProducto = crearFotoDelProducto(subasta.url_de_la_foto, subasta.titulo);

  // Sección 16 (diseño minimalista): sin etiquetas repetidas ("Precio actual:",
  // "Categoría:"...). Cada dato se entiende por su lugar y su tamaño:
  //   ELECTRÓNICA                 ← categoría pequeña
  //   Audífonos inalámbricos      ← título (es el enlace)
  //   $850.00                     ← precio grande
  //   🕐 00:12:30 · 3 de 5 lugares
  const cuerpoDeLaTarjeta = document.createElement('div');
  cuerpoDeLaTarjeta.className = 'cuerpo-de-la-tarjeta';

  // Categoría
  const categoriaDeLaTarjeta = document.createElement('p');
  categoriaDeLaTarjeta.className = 'categoria-de-la-tarjeta';
  categoriaDeLaTarjeta.textContent = NOMBRES_DE_LAS_CATEGORIAS[subasta.categoria] ?? subasta.categoria;

  // Título con el enlace al detalle (el id viaja en la dirección: subasta.html?id=7).
  // TODA la tarjeta se puede clicar: el CSS estira este enlace para que la
  // cubra (.tarjeta-de-subasta h2 a::after), pero sigue siendo UN solo enlace
  // cuyo nombre es el título.
  const enlaceAlDetalle = document.createElement('a');
  enlaceAlDetalle.href = `subasta.html?id=${subasta.id}`;
  enlaceAlDetalle.textContent = subasta.titulo;
  const tituloDelProducto = document.createElement('h2');
  tituloDelProducto.append(enlaceAlDetalle);

  // Precio actual, grande
  const precioDeLaTarjeta = document.createElement('p');
  precioDeLaTarjeta.className = 'precio-de-la-tarjeta';
  precioDeLaTarjeta.textContent = formatearDinero(subasta.precio_actual);

  // Tiempo restante: guardamos la fecha de fin en un atributo data-
  // para que actualizarTiemposRestantes() la encuentre cada segundo
  // (y la pinte de rojo en el último minuto: ver js/utilidades.js)
  const tiempoRestante = document.createElement('span');
  tiempoRestante.className = 'tiempo-de-la-tarjeta';
  tiempoRestante.dataset.fechaDeFinalizacion = subasta.fecha_de_finalizacion;
  tiempoRestante.textContent = formatearTiempoRestante(subasta.fecha_de_finalizacion);

  // Lugares ocupados. Supabase regresa el conteo así: participantes: [{ count: 3 }]
  const lugaresOcupados = subasta.participantes[0]?.count ?? 0;
  const subastaLlena = lugaresOcupados >= LUGARES_POR_SUBASTA;
  const lugaresDeLaTarjeta = document.createElement('span');
  lugaresDeLaTarjeta.textContent = subastaLlena
    ? 'Llena (puedes verla)'
    : `${lugaresOcupados} de ${LUGARES_POR_SUBASTA} lugares`;

  const datosDeLaTarjeta = document.createElement('p');
  datosDeLaTarjeta.className = 'datos-de-la-tarjeta';
  datosDeLaTarjeta.append(tiempoRestante, lugaresDeLaTarjeta);

  cuerpoDeLaTarjeta.append(categoriaDeLaTarjeta, tituloDelProducto, precioDeLaTarjeta, datosDeLaTarjeta);
  tarjeta.append(fotoDelProducto, cuerpoDeLaTarjeta);
  return tarjeta;
}


// ---------------------------------------------------------------------
// 5. ÚLTIMAS SUBASTAS TERMINADAS (Sección 14): la mini lista de la izquierda.
//    No depende de la búsqueda: siempre muestra las últimas que cerraron.
//    Por privacidad no se dice quién ganó, solo si se vendió y en cuánto.
// ---------------------------------------------------------------------
const listaDeUltimasSubastas = document.getElementById('lista-de-ultimas-subastas');
const mensajeDeUltimasSubastas = document.getElementById('mensaje-de-ultimas-subastas');

const CANTIDAD_DE_ULTIMAS_SUBASTAS = 5;
const MILISEGUNDOS_POR_MINUTO = 60 * 1000;

// "Hace 5 min", "Hace 3 h", "Hace 2 días": cuánto pasó desde que terminó
function describirHaceCuantoTermino(fechaDeFinalizacion) {
  const minutosQuePasaron = Math.floor((new Date() - new Date(fechaDeFinalizacion)) / MILISEGUNDOS_POR_MINUTO);

  // CASO LÍMITE: acaba de terminar (o el reloj de la computadora va atrasado
  // y la resta da negativa) → "Hace un momento"
  if (minutosQuePasaron < 1) {
    return 'Hace un momento';
  }
  if (minutosQuePasaron < 60) {
    return `Hace ${minutosQuePasaron} min`;
  }
  const horasQuePasaron = Math.floor(minutosQuePasaron / 60);
  if (horasQuePasaron < 24) {
    return `Hace ${horasQuePasaron} h`;
  }
  const diasQuePasaron = Math.floor(horasQuePasaron / 24);
  return diasQuePasaron === 1 ? 'Hace 1 día' : `Hace ${diasQuePasaron} días`;
}

// Es como este SQL:
//   SELECT id, titulo, precio_actual, fecha_de_finalizacion, id_del_ganador
//   FROM subastas
//   WHERE estado = 'finalizada'
//   ORDER BY fecha_de_finalizacion DESC   ← la que terminó más recientemente, arriba
//   LIMIT 5;
// (Las eliminadas no salen: la política RLS las oculta.)
async function cargarUltimasSubastasTerminadas() {
  mostrarMensaje(mensajeDeUltimasSubastas, 'Cargando...', 'aviso');

  const { data: ultimasSubastas, error: errorDeLaConsulta } = await baseDeDatos
    .from('subastas')
    .select('id, titulo, precio_actual, fecha_de_finalizacion, id_del_ganador')
    .eq('estado', 'finalizada')
    .order('fecha_de_finalizacion', { ascending: false })
    .limit(CANTIDAD_DE_ULTIMAS_SUBASTAS);

  // CASO LÍMITE: falla la conexión. Solo se avisa en la mini lista;
  // el catálogo de la derecha sigue funcionando.
  if (errorDeLaConsulta) {
    console.error('Error al cargar las últimas subastas:', errorDeLaConsulta);
    mostrarMensaje(mensajeDeUltimasSubastas, 'No pudimos cargar esta lista.', 'error');
    return;
  }

  // CASO LÍMITE: todavía no ha terminado ninguna subasta
  if (ultimasSubastas.length === 0) {
    mostrarMensaje(mensajeDeUltimasSubastas, 'Todavía no ha terminado ninguna subasta.', 'aviso');
    return;
  }

  borrarMensaje(mensajeDeUltimasSubastas);
  listaDeUltimasSubastas.replaceChildren(...ultimasSubastas.map(crearRenglonDeSubastaTerminada));
}

// Un renglón <li>:   Bicicleta de montaña          ← enlace al detalle
//                    Vendida en $1,310.00          ← o "Terminó sin pujas"
//                    Hace 5 min
// Como en las tarjetas: textContent, nunca innerHTML (evita XSS)
function crearRenglonDeSubastaTerminada(subasta) {
  const enlaceALaSubasta = document.createElement('a');
  enlaceALaSubasta.href = `subasta.html?id=${subasta.id}`;
  enlaceALaSubasta.textContent = subasta.titulo;

  // CASO LÍMITE: terminó sin pujas → no hubo venta
  const resultadoDeLaSubasta = document.createElement('span');
  resultadoDeLaSubasta.className = 'detalle-de-la-subasta-terminada';
  if (subasta.id_del_ganador) {
    resultadoDeLaSubasta.classList.add('subasta-terminada-vendida');
    resultadoDeLaSubasta.textContent = `Vendida en ${formatearDinero(subasta.precio_actual)}`;
  } else {
    resultadoDeLaSubasta.textContent = 'Terminó sin pujas';
  }

  const haceCuantoTermino = document.createElement('span');
  haceCuantoTermino.className = 'detalle-de-la-subasta-terminada';
  haceCuantoTermino.textContent = describirHaceCuantoTermino(subasta.fecha_de_finalizacion);

  const renglon = document.createElement('li');
  renglon.append(enlaceALaSubasta, resultadoDeLaSubasta, haceCuantoTermino);
  return renglon;
}


// ---------------------------------------------------------------------
// 6. PORTADA DE BIENVENIDA (Sección 15): la ve solo quien NO ha iniciado
//    sesión. Quien ya tiene cuenta ya sabe cómo funciona: para él estorbaría.
//    perfil = null → visitante.
// ---------------------------------------------------------------------
const portadaDeBienvenida = document.getElementById('portada-de-bienvenida');

function mostrarPortadaSegunElUsuario(perfil) {
  // CASO LÍMITE: justo después de publicar un cambio, el navegador puede tener
  // guardada una copia VIEJA de index.html (sin portada) y este JavaScript
  // nuevo. GitHub Pages deja guardar los archivos hasta 10 minutos. Sin esta
  // revisión saldría un error en la consola; así, simplemente no se muestra.
  if (!portadaDeBienvenida) {
    return;
  }
  portadaDeBienvenida.hidden = perfil !== null;
}


// Al abrir la página: leer los filtros, cargar las subastas y arrancar el reloj
// (actualizarTiemposRestantes está en js/utilidades.js)
promesaDelPerfilDelUsuarioActual.then(mostrarPortadaSegunElUsuario);
const filtrosDeLaBusqueda = leerFiltrosDeLaDireccion();
mostrarFiltrosEnElFormulario(filtrosDeLaBusqueda);
cargarSubastasActivas(filtrosDeLaBusqueda);
cargarUltimasSubastasTerminadas(); // las dos cargas van al mismo tiempo
setInterval(actualizarTiemposRestantes, 1000);
