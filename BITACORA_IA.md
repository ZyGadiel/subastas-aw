# Bitácora de IA

Registro de cómo usé la inteligencia artificial durante el proyecto.
Herramienta: **Claude (Claude Code, app de escritorio)**.

> Cómo llenar cada entrada: qué le pedí, qué me propuso, qué acepté, qué rechacé o cambié (y por qué), y si encontré algún error.

---

## 18 nov 2026 — Sección 0: Planeación

**Qué le pedí:** ayuda para organizar el proyecto final en partes, empezando por lo básico, y entender cada paso.

**Qué me propuso:**
Hacer el proyecto con HTML, CSS y JavaScript sin frameworks, guardando los datos en `localStorage`, porque es lo que vimos en clase y lo puedo explicar.
Dividirlo en 11 secciones (de la 0 a la 10), con un commit por cada avance.

**Qué acepté:** la división en secciones y usar solo HTML, CSS y JS.

**Qué rechacé o cambié:**
me propuso crear la carpeta en Documentos y preferí ponerla en mi carpeta de clases._

**Errores de la IA que detecté:**
ninguno por ahora_

---

## 18 nov 2026 — Sección 1: Estructura HTML

**Qué le pedí:** crear las páginas base del sitio sin estilos ni JavaScript.

**Qué me propuso:**
5 páginas: `index.html` (catálogo), `subasta.html` (detalle y pujas), `publicar.html`, `login.html` y `registro.html`.
Usar etiquetas semánticas (`header`, `nav`, `main`, `article`, `section`, `footer`).
Poner `required`, `min` y `maxlength` en los formularios como primera defensa contra casos límite.
No dejar elegir el rol de administrador en el registro.
Trabajar en una rama (`seccion-1-html`) y luego unirla a `main`.

**Qué acepté:** acepte que dividiera las secciones en sub-ramas para evitar afectar la rama principal

**Qué rechacé o cambié:** de momento nada.

---

## 19 nov 2026 — Sección 2: Base de datos

**Qué le pedí:** cambiar el plan para usar una base de datos, porque el proyecto la requiere.

**Qué me propuso:**
 Usar Supabase (PostgreSQL) en lugar de Node + Express + MySQL.
 4 tablas: `perfiles`, `subastas`, `participantes` y `pujas` (archivo `supabase/schema.sql`).
 Hacer cumplir el cupo de 5 con reglas de la base de datos (`check` + `unique`), no solo con JavaScript.
  Activar Row Level Security y, por ahora, permitir solo lectura.

**Qué acepté:** decidi solo darle el permiso de select (minimo privilegio)

**Qué rechacé o cambié:** darle todos los permisos completos en supabase (mi base de datos)

**Errores de la IA que detecté:** niguno de momento

---

## 20 nov 2026 — Sección 3: Estilos (CSS)

**Qué le pedí:** darle diseño al sitio con lo que vimos en clase (hojas de estilo, Flexbox y responsive).

**Qué me propuso:**
Un solo archivo `css/estilos.css` enlazado en las 5 páginas, ordenado en 8 secciones.
Variables CSS (`:root`) para los colores, así se cambian en un solo lugar.
Enfoque *mobile first*: estilos base para celular y `@media (min-width: 768px)` / `(min-width: 1024px)` para tablet y computadora.
Tarjetas del catálogo con Flexbox: 1 por fila en celular, 2 en tablet y 3 en computadora.
Detalle de subasta en 2 columnas en pantallas grandes.
Un estilo para botones deshabilitados (`button:disabled`), que usaremos para evitar el doble clic.

**Error de la IA que se corrigió:** en la primera versión, la única tarjeta del catálogo se estiraba a todo el ancho de la pantalla (`flex: 1 1 260px` la dejaba crecer). Se cambió a un ancho fijo por columnas con `calc()`.

**Qué acepté:** el cambio para redimensionar la pagina y no se modificara mal al usar otro dispositivo

**Qué rechacé o cambié:** nada de momento.

---

## 20 nov 2026 — Sección 4: Catálogo desde la base de datos

**Qué le pedí:** conectar el JavaScript con Supabase y que el catálogo muestre las subastas reales.

**Qué me propuso:**
Cargar la librería de Supabase desde un CDN con versión fija (`@2.49.4`) y crear la conexión en `js/supabase.js`.
Poner en el código solo la URL y la *publishable key* (nunca la *secret key*), porque RLS protege los datos.
`js/utilidades.js` con funciones reutilizables: formato de dinero, tiempo restante y mensajes.
`js/catalogo.js`: consulta las subastas activas, crea las tarjetas con `createElement` y `textContent` (no `innerHTML`, para evitar XSS) y actualiza los relojes cada segundo con `setInterval`.
Manejar los casos límite: mensaje de "Cargando...", mensaje si no hay subastas, mensaje si falla la conexión y foto por defecto si la imagen no carga.
Un archivo `supabase/datos-prueba.sql` para llenar la base con 4 subastas de ejemplo.

**Qué acepté:** la creacion de los js donde se maneja la base de datos.

**Qué rechacé o cambié:** los nombres de las varibles y funciones. a nombres claros y entendibles.

---

## 21 nov 2026 — Sección 5: Registro e inicio de sesión

**Qué le pedí:** que los usuarios puedan crear cuenta, iniciar y cerrar sesión, y que el menú cambie según quién esté conectado.

**Qué me propuso:**
- Usar Supabase Auth (`signUp`, `signInWithPassword`, `signOut`) en lugar de guardar contraseñas yo.
- Un trigger en la base de datos (`supabase/seccion-5-usuarios.sql`) que crea el perfil al registrarse y no deja elegir el rol `administrador`.
- `js/sesion.js` en todas las páginas: obtiene el perfil una sola vez (`promesaDelPerfilDelUsuarioActual`), muestra "Hola, nombre" y "Cerrar sesión", y solo muestra "Publicar" a los vendedores.
- Traducir los errores de Supabase (vienen en inglés) a mensajes en español.
- Deshabilitar el botón mientras se espera la respuesta (caso límite del doble clic) y rechazar nombres de puros espacios.
- Desactivar la confirmación por correo en Supabase para la demo.

**Qué acepté:** _(llénalo tú)_

**Qué rechacé o cambié:** _(llénalo tú)_
