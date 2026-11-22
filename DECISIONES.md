# Diario de decisiones

Las decisiones importantes del proyecto y por qué las tomé.

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
