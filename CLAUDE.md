# Instrucciones para la IA (Claude Code)

Claude Code lee este archivo solo al abrir el proyecto. Aquí está lo que la IA debe saber para ayudarme sin volver a explicarle todo.

## El proyecto

- **Subastas AW**: proyecto final de Aplicaciones Web (UABC FIAD 2026-2, prof. Carlos Laurence Escobar Erunez). AW = Aplicaciones Web.
- Página publicada: https://zygadiel.github.io/subastas-aw/ (GitHub Pages, rama `main`). Repositorio: https://github.com/ZyGadiel/subastas-aw
- HTML, CSS y JavaScript sin frameworks + Supabase (PostgreSQL, Auth, Realtime, pg_cron). Todo está explicado en `README.md` (mapa del sistema, archivos SQL en orden, estructura del código y tabla de casos límite).
- Por qué se hizo cada cosa: `DECISIONES.md` (lo más nuevo arriba). Qué le pedí a la IA: `BITACORA_IA.md` (en orden, Sección 0 a 16).
- Entregado en Classroom el 21 nov 2026.

## La presentación (miércoles 25 nov, soy el #19)

12 minutos: demo en la versión desplegada + un caso límite que elige el profe (3 min), mapa del sistema: llevarlo al archivo donde vive algo (2 min), **cambio en vivo con la IA** (5 min, 6 puntos: cómo lo pido, si reviso lo que devuelve y si lo pruebo), y una pregunta sobre la bitácora (2 min). Debo tener abiertos: el proyecto en el editor, la página desplegada, la IA con sesión iniciada y GitHub en la pestaña de commits.

Durante el cambio en vivo: hacer cambios pequeños y claros, explicar qué se cambió y en qué archivo, probarlo en el navegador y, si hace falta, subirlo con `git push` (GitHub Pages se actualiza en 1 o 2 minutos).

## Cómo quiero trabajar

- Respóndeme **en español**, paso a paso y explicando **el porqué** de cada cosa. Estoy aprendiendo.
- **Nombres claros en español** en todo el código: variables, funciones, ids, clases de CSS, variables de CSS, columnas y alias de SQL y nombres de archivo. Sin abreviaturas y sin inglés, salvo lo que exige el lenguaje o una librería (`data`, `error`, `id`, `anon`, `authenticated`, `index.html`). Que los nombres digan lo que guardan (`precioActual`, no `p`).
- Yo hago los commits. Una rama por cambio (`seccion-N-descripcion`), y al final me das los comandos: `git add .`, `git commit`, `git push -u origin <rama>`, `git switch main`, `git merge <rama>`, `git push`.
- Cada cambio lleva su entrada en `BITACORA_IA.md` (qué pedí, qué propuso la IA, y huecos "Qué acepté / Qué rechacé" que lleno yo) y, si es una decisión, en `DECISIONES.md` (arriba).
- Me levanto a las 5:30: si es tarde (después de las 23:00), sugiéreme parar.

## Convenciones del código (respétalas en cualquier cambio)

- Scripts clásicos que comparten variables globales. Orden en cada página: Supabase (CDN, versión 2.49.4) → `js/conexion-a-supabase.js` (`baseDeDatos`) → `js/utilidades.js` → `js/sesion.js` → el script de la página. `js/tema.js` va en el `<head>`.
- Datos escritos por usuarios siempre con `textContent` o `createElement`, nunca `innerHTML` (evita XSS).
- Mensajes con `mostrarMensaje(elemento, texto, 'error' | 'exito' | 'aviso')`. Errores de la base de datos con `traducirErrorDeLaBaseDeDatos`: las reglas tienen nombre (constraints) y las funciones lanzan `raise exception` con el mensaje ya en español (código P0001).
- Los casos límite se marcan con un comentario `// CASO LÍMITE:` y se validan en tres capas: HTML, JavaScript y base de datos.
- Botones que envían algo: deshabilitarlos mientras esperan (doble clic).
- CSS mobile first, 8 secciones numeradas; los colores son variables en la sección 1 (claro en `:root`, oscuro en `:root[data-tema="oscuro"]`). Nunca escribir un color directo en una regla.
- Escribir en la base de datos solo con políticas RLS o funciones `security definer` que revisan permisos. En el código solo va la llave **pública** de Supabase; nunca la secreta ni la contraseña de la base de datos.

## Supabase

- Los archivos de `supabase/` se corren a mano en Supabase → SQL Editor, en el orden del README. La IA no tiene acceso al panel de Supabase: si un cambio necesita SQL, dame el archivo y yo lo corro.
- "Confirm email" está desactivado (Authentication). El administrador es `admin@subastas.com` (se convirtió con SQL; el registro nunca permite ese rol).
- Los usuarios con pujas no se pueden borrar (llaves foráneas): se suspenden desde el panel del administrador.

## Para probar

- Servir la carpeta: `python -m http.server 5500` y abrir `http://127.0.0.1:5500`. Si una página se ve vieja después de un cambio: **Ctrl + F5**.
- Para probar pujas en tiempo real: dos ventanas (una normal y una de incógnito) con dos cuentas de comprador, y una subasta de 2 minutos publicada con una cuenta de vendedor.
- Si edito `BITACORA_IA.md` o `DECISIONES.md` en el editor mientras la IA también los cambia, recargar el archivo antes de guardar (una vez se borró una entrada así).
