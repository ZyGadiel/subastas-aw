# Diario de decisiones

Las decisiones importantes del proyecto y por qué las tomé.

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
