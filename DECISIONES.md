# Diario de decisiones

Las decisiones importantes del proyecto y por qué las tomé.

---

## 21 nov 2026 — Publicar en GitHub Pages

**Decisión:** la página se publica con **GitHub Pages** desde la rama `main`: https://zygadiel.github.io/subastas-aw/

**Por qué:**
- El proyecto es HTML, CSS y JavaScript sin compilar: GitHub Pages solo tiene que servir los archivos tal cual, gratis y desde el mismo repositorio que se entrega.
- La base de datos ya está en internet (Supabase), así que no hace falta otro servidor.
- Cada `git push` a `main` actualiza la página sola en uno o dos minutos.

**Cuidados:** GitHub Pages distingue mayúsculas en los nombres de archivo (Windows no); todas las rutas son relativas (`css/estilos.css`, no `/css/estilos.css`) porque la página vive en la carpeta `/subastas-aw/`; y en el código solo está la llave **pública** de Supabase, que está pensada para ir en el navegador. La seguridad la ponen las políticas RLS y las funciones, no esconder la llave.

---

## 21 nov 2026 — Administrador: suspender y ocultar, nunca borrar

**Decisión:** el administrador **suspende** usuarios (`suspendido = true`) y **elimina** publicaciones marcándolas como `estado = 'eliminada'`. No se borra ninguna fila.

**Por qué:**
- Las pujas, los lugares y las ventas apuntan al usuario (llaves foráneas). Si se borrara, el historial de las subastas quedaría con huecos. Lo comprobé cuando Supabase no me dejó borrar una cuenta de prueba que ya había pujado.
- Un error se puede corregir: "Reactivar" devuelve la cuenta tal como estaba.
- Lo que hace la suspensión ya estaba programado desde antes: la política de publicar (Sección 6) y las funciones de entrar y pujar (Sección 7) revisan `suspendido`.

**¿Quién es administrador?** La cuenta `admin@subastas.com`, convertida con un `update` desde el SQL Editor. El registro de la página nunca permite elegir ese rol.

**Seguridad:** todo pasa por funciones `security definer` cuya primera línea revisa `es_administrador()`. Ocultar el panel con JavaScript es solo para la vista; la base de datos rechaza a quien no sea administrador aunque llame a las funciones desde la consola.

---

## 21 nov 2026 — Búsqueda: en la dirección y sin acentos

**Decisión 1: la búsqueda viaja en la dirección** (`index.html?texto_a_buscar=bici&categoria=deportes`). El formulario usa `method="get"`, que es lo que el navegador hace por defecto, y `js/catalogo.js` lee los parámetros.

**Por qué:** el botón "Atrás" regresa a la búsqueda anterior, al recargar no se pierde y el enlace se puede compartir. Además, no hace falta JavaScript para enviar el formulario.

**Decisión 2: buscar sin importar acentos ni mayúsculas.** La base de datos guarda una columna calculada `titulo_para_buscar` (con la extensión `unaccent`) y la búsqueda usa `ILIKE` sobre ella.

**Por qué:** mucha gente escribe sin acentos ("lampara", "audifonos"). Lo encontré al probar: "lampara" no encontraba "Lámpara de escritorio". Se eligió una columna calculada (`generated ... stored`) porque se llena sola al publicar y nadie la puede escribir mal.

**Qué se busca:** solo el título (no la descripción). Es lo que la gente espera en un catálogo y evita resultados por palabras sueltas de las descripciones.

---

## 21 nov 2026 — Mis subastas: una página, dos vistas

**Decisión:** una sola página (`mis-subastas.html`) que muestra una lista distinta según el rol: el vendedor ve lo que publicó y el comprador las subastas donde ocupó un lugar.

**Por qué:**
- Cada usuario tiene un solo rol, así que no hace falta una página por rol; el menú queda más corto ("Mis subastas" para todos).
- Las tarjetas usan el mismo diseño que el catálogo, con una etiqueta de color para el estado.

**Cómo se consulta:**
- Vendedor: `subastas` donde `id_del_vendedor` soy yo.
- Comprador: `participantes` donde `id_del_usuario` soy yo, pidiendo también su subasta (como un JOIN). Para saber si va ganando, una sola consulta de `pujas` con `in (...)` para todas sus subastas, en lugar de una consulta por subasta.
- Se recarga cada 30 segundos en lugar de usar tiempo real: aquí no hace falta ver cada puja al instante, solo los cambios de estado.

---

## 21 nov 2026 — Cierre automático: pg_cron + la página

**Decisión:** las subastas se cierran con una función de la base de datos (`cerrar_subastas_vencidas`) que se llama de dos formas:
1. **pg_cron**, cada minuto, desde el servidor. Así se cierran aunque nadie esté viendo la página.
2. **La página de la subasta**, cuando su contador llega a cero. Así el ganador aparece al instante y no hasta el siguiente minuto. Gracias al tiempo real, todas las pantallas abiertas se actualizan.

**Por qué no solo con JavaScript:** si cerrar dependiera del navegador, una subasta que nadie está viendo nunca se cerraría. Y si solo fuera pg_cron, el ganador tardaría hasta un minuto en aparecer, lo que se ve mal en la demo.

**Reglas que elegí:**
- Gana la puja más alta; si hubiera empate, la que llegó primero (en la práctica no hay empates porque cada puja debe superar a la anterior).
- Sin pujas = termina sin ganador.
- Comisión de la página: 3 % del precio final. Solo el vendedor ve el desglose (comisión y lo que recibe).
- Cualquiera puede llamar a la función (incluso sin sesión) porque no recibe datos y solo cierra lo que ya venció según el reloj del servidor.

---

## 21 nov 2026 — Modo oscuro con variables de CSS

**Decisión:** el modo oscuro cambia solo los **valores** de las variables de color (`:root[data-tema="oscuro"]` en `css/estilos.css`). `js/tema.js` pone `data-tema="claro"` u `"oscuro"` en la etiqueta `<html>`.

**Por qué:**
- Gracias a que desde la Sección 3 todos los colores son variables, no hubo que repetir cada regla para el modo oscuro: bastó un segundo juego de colores.
- Los textos de colores (verde, rojo, amarillo, enlaces) son más claros en modo oscuro para que se lean sobre fondo oscuro; los fondos de los botones se quedan oscuros para que su texto blanco siga leyéndose.

**Comportamiento:**
- La primera vez se usa el modo de la computadora o del celular (`prefers-color-scheme`).
- El botón 🌙 / ☀️ del menú cambia el tema y la elección se guarda en el navegador (`localStorage`), así se mantiene en todas las páginas y la próxima visita.
- `js/tema.js` se carga en el `<head>` (no al final como los demás scripts) para aplicar el tema antes de que se dibuje la página y evitar un destello blanco.

---

## 21 nov 2026 — Correo con dominio completo

**Decisión:** el correo del registro y del inicio de sesión debe tener la forma `ejemplo@dominio.algo`.

**Por qué:** `type="email"` acepta `ejemplo@ejemplo`, que es válido en redes internas pero no en internet. Un correo así no puede recibir mensajes y llena la base de datos de cuentas inútiles.

**Cómo (dos capas, como en Publicar):**
1. **HTML:** atributo `pattern` + `title` con un ejemplo. El navegador avisa antes de enviar.
2. **JavaScript:** `esCorreoValido` en `js/utilidades.js` revisa otra vez, por si alguien borra el `pattern`. En el inicio de sesión, además, evita preguntarle al servidor por un correo que no puede existir.

Supabase Auth hace una tercera revisión del formato al registrar (`email_address_invalid`).

---

## 21 nov 2026 — Puja rápida y lista de posiciones

**Decisión:** en el detalle de la subasta agregué un botón **"Pujar el mínimo"** y una lista de **posiciones** debajo del producto.

**Por qué:**
- En una subasta de pocos minutos, escribir el monto es lento y fácil de equivocar. Con un clic se puja exactamente precio actual + incremento. El campo para escribir otra cantidad se queda para quien quiera pujar más alto.
- El historial completo está hasta abajo; la lista de posiciones aprovecha el espacio libre debajo del producto y deja ver de un vistazo quién va ganando.

**Cómo:** los dos botones llaman a la misma función (`enviarPuja`), así que las validaciones y la llamada a la base de datos están en un solo lugar. La base de datos no cambió: la función `pujar` de la Sección 7 sigue revisando todo.

---

## 21 nov 2026 — Pujar: funciones en la base de datos + tiempo real

**Decisión:** entrar a una subasta y pujar se hacen con dos funciones de PostgreSQL (`entrar_a_la_subasta` y `pujar`, en `supabase/seccion-7-puja.sql`) que JavaScript llama con `baseDeDatos.rpc(...)`. El navegador **no** tiene permiso de `INSERT` en `participantes` ni en `pujas`.

**Por qué:**
- Pujar no es solo guardar una fila: hay que revisar que la subasta siga activa, que el usuario participe y que el monto alcance el mínimo, y luego guardar la puja **y** subir el precio. Si lo hiciera el navegador, alguien podría saltarse las revisiones.
- **Carreras (dos personas al mismo tiempo):** las funciones bloquean la fila de la subasta con `select ... for update`. Si dos compradores pujan en el mismo segundo, el segundo espera y luego ve el precio nuevo; si su monto ya no alcanza, se rechaza. Lo mismo con el último de los 5 lugares.
- La hora que cuenta es la del servidor (`now()`), no la de la computadora del usuario.

**Reglas del negocio que elegí:**
- Solo las cuentas de **comprador** participan (así el vendedor no puede pujar en su propia subasta).
- Los lugares se dan por orden de llegada (1 al 5). Si ya estabas dentro, te regresa tu mismo lugar.
- Monto mínimo = precio actual + incremento mínimo (también en la primera puja).
- Quien va ganando no puede volver a pujar hasta que alguien lo supere.

**Tiempo real:** las tablas `subastas`, `participantes` y `pujas` se agregaron a la publicación `supabase_realtime`. La página escucha los cambios de **su** subasta y, en cada aviso, vuelve a cargar todo (más simple que actualizar pedazos y siempre queda igual que la base de datos). La etiqueta "En vivo" indica que la conexión está activa.

**Privacidad:** el historial muestra "Participante 3", nunca el nombre. La tabla `perfiles` sigue siendo visible solo para su dueño.

---

## 21 nov 2026 — Publicar: tres capas de validación

**Decisión:** cada subasta nueva se revisa en tres lugares:
1. **HTML** (`required`, `min`, `max`, `maxlength`): el navegador avisa antes de enviar.
2. **JavaScript** (`validarDatosDeLaSubasta` en `js/publicar.js`): mensajes claros para lo que el HTML no detecta (textos de puros espacios, incremento mayor que el precio).
3. **Base de datos** (reglas con nombre, trigger `antes_de_publicar_preparar_subasta` y política RLS): la única capa que no se puede saltar, porque cualquiera puede modificar el JavaScript desde su navegador.

**Datos que no vienen del navegador:** el trigger pone el vendedor (`auth.uid()`), la fecha de inicio (reloj del servidor), el precio actual y el estado. Así nadie puede publicar a nombre de otro ni empezar una subasta con un precio inflado.

**Reglas del negocio que elegí:**
- Duraciones: 2 min (para la demo), 5 min, 1 hora o 1 día. La base de datos permite máximo 7 días.
- El precio inicial va de $1 a $10,000,000.
- El incremento mínimo no puede ser mayor que el precio inicial.

**Mensajes de error:** `traducirErrorDeLaBaseDeDatos` (en `js/utilidades.js`) busca el nombre de la regla rota en el error de PostgreSQL y muestra su mensaje en español.

---

## 21 nov 2026 — Usuarios: Supabase Auth + trigger que crea el perfil

**Decisión:** el registro y el inicio de sesión los hace Supabase Auth. El perfil (nombre y rol) lo crea la base de datos con un trigger (`al_registrarse_crear_perfil`), no JavaScript.

**Por qué:**
- No guardo contraseñas yo: Supabase las guarda cifradas. Programarlo yo sería menos seguro.
- Si JavaScript insertara el perfil, alguien podría modificar la petición y registrarse como `administrador`. El trigger solo acepta `comprador` o `vendedor`; cualquier otro valor se convierte en `comprador`.

**Confirmación por correo desactivada:** en Supabase desactivé *Confirm email* para que la demo sea inmediata (el plan gratis solo manda unos pocos correos por hora). En una página real la dejaría activada para comprobar que el correo existe. El código funciona en los dos casos: si no hay sesión después de registrarse, pide revisar el correo.

**Casos límite cubiertos:** nombre de puros espacios, doble clic en "Crear cuenta" o "Entrar" (el botón se deshabilita), correo ya registrado, contraseña incorrecta y falta de internet (mensajes en español).

---

## 20 nov 2026 — Nombres claros y en español en todo el código

**Decisión:** todos los nombres que invento (variables, funciones, ids, clases, variables de CSS, columnas de la base de datos y archivos) son descriptivos, completos y en español. Sin abreviaturas ni letras sueltas: `baseDeDatos` en lugar de `db`, `fecha_de_finalizacion` en lugar de `termina_en`, `iniciar-sesion.html` en lugar de `login.html`.

**Por qué:** en la presentación tengo que ubicar y explicar cada parte del proyecto. Si el nombre dice exactamente qué es, lo encuentro y lo explico más rápido. También facilita que la IA entienda el código en el cambio en vivo.

**Excepciones (inglés obligatorio):**
- Lo que es del lenguaje o de una librería: `document.createElement`, `textContent`, `select`, `count`, `createClient`.
- `index.html`: los servidores y GitHub Pages buscan exactamente ese nombre.
- `id` en las tablas: es el nombre estándar de la llave primaria y Supabase lo usa así en sus usuarios.
- `anon` y `authenticated`: son los nombres de los roles que define Supabase.

**Cómo se aplicó:** la base de datos se reinició con `supabase/borrar-tablas.sql` y se volvió a crear con el `schema.sql` corregido, porque solo tenía datos de prueba.

---

## 19 nov 2026 — Base de datos: Supabase (reemplaza la decisión de `localStorage`)

**Decisión:** guardar los datos en Supabase, una base de datos PostgreSQL en la nube.

**Por qué:**
- El proyecto requiere base de datos, y la primera propuesta (`localStorage`) no la tenía.
- En una subasta, todos los usuarios deben ver las mismas pujas al mismo tiempo; con `localStorage` cada navegador tenía sus propios datos.
- Ya conozco SQL por MySQL, y PostgreSQL se escribe casi igual.
- No tengo que programar un servidor: JavaScript se conecta directo, como con la PokeAPI en los laboratorios.
- Incluye inicio de sesión y tiempo real, y la página se puede publicar gratis en GitHub Pages.

**Alternativa que descarté:** Node + Express + MySQL. La conozco más (MySQL), pero tendría que aprender a hacer un servidor y no podría desplegarla fácilmente en 4 días.

**Reglas importantes en la base de datos (no solo en JavaScript):**
- El cupo de 5 se garantiza con las reglas `lugar_entre_uno_y_cinco` (`check (numero_de_lugar between 1 and 5)`) y `lugar_no_repetido` (`unique (id_de_la_subasta, numero_de_lugar)`): aunque dos personas den clic al mismo tiempo, la base de datos rechaza al segundo.
- Row Level Security (RLS): como el navegador habla directo con la base de datos, cada tabla dice quién puede leer o escribir.

---

## 18 nov 2026 — ~~Sin backend: datos en `localStorage`~~ (reemplazada el 19 nov)

**Decisión:** no usar servidor ni base de datos; guardar usuarios, subastas y pujas en el `localStorage` del navegador.

**Por qué:** tengo 4 días para entregar, en clase vimos HTML, CSS y JS, y prefiero un proyecto sencillo que domine.

**Consecuencia (limitación conocida):** los datos solo existen en el navegador donde se usa la página. Dos personas en computadoras distintas no ven las mismas subastas. Para eso haría falta un servidor y una base de datos.

---

## 18 nov 2026 — Desarrollo por secciones

**Decisión:** construir el proyecto en partes pequeñas y hacer un commit al terminar cada una.

**Por qué:** así puedo probar cada parte antes de seguir, y el historial de commits muestra el avance del proyecto.
