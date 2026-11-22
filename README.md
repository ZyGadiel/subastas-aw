# Subastas AW

Proyecto final de **Aplicaciones Web** (UABC FIAD Ensenada, 2026-2).

Plataforma de subastas en línea donde los vendedores publican productos y los compradores pujan por ellos.

## ¿Cómo funciona?

- Cada subasta acepta **solo 5 participantes**; los lugares se asignan por orden de llegada.
- El vendedor define el **precio inicial**, el **incremento mínimo** y la **duración**.
- Quien no alcanzó lugar puede **ver la subasta** sin ver los datos personales de los participantes.
- Al terminar el tiempo, la subasta **se cierra sola** y gana la puja más alta.
- La página cobra una **comisión del 3 %** sobre la venta.

## Tipos de usuario

| Rol | Puede |
|---|---|
| Comprador | Registrarse, buscar y filtrar productos, entrar a subastas, pujar, ver si ganó |
| Vendedor | Publicar productos con fotos, ver participantes (anónimos) y el ganador |
| Administrador | Suspender usuarios, eliminar publicaciones, ver estadísticas |

## Tecnologías

- HTML, CSS y JavaScript (sin frameworks)
- [Supabase](https://supabase.com): base de datos PostgreSQL en la nube, inicio de sesión y actualizaciones en tiempo real

## Base de datos

El esquema completo (tablas, reglas y permisos) está en [`supabase/schema.sql`](supabase/schema.sql).

| Tabla | Guarda |
|---|---|
| `perfiles` | Nombre, rol y si el usuario está suspendido (el correo y la contraseña los guarda Supabase Auth) |
| `subastas` | Los productos publicados, sus precios, duración y estado |
| `participantes` | Quién ocupa cada uno de los 5 lugares de una subasta |
| `pujas` | El historial de ofertas |

### Archivos SQL (se ejecutan en Supabase → SQL Editor, en este orden)

| Orden | Archivo | Qué hace |
|---|---|---|
| 1 | [`supabase/schema.sql`](supabase/schema.sql) | Crea las 4 tablas, sus reglas y los permisos de lectura |
| 2 | [`supabase/seccion-5-usuarios.sql`](supabase/seccion-5-usuarios.sql) | Trigger que crea el perfil al registrarse |
| 3 | [`supabase/seccion-6-publicar.sql`](supabase/seccion-6-publicar.sql) | Permiso para que los vendedores publiquen, trigger que prepara la subasta y límite de 7 días |
| — | [`supabase/datos-prueba.sql`](supabase/datos-prueba.sql) | Opcional: 4 subastas de ejemplo |
| — | [`supabase/borrar-tablas.sql`](supabase/borrar-tablas.sql) | ⚠️ Borra todo para empezar de cero |

## Estructura del código

| Archivo | Qué hace |
|---|---|
| `js/conexion-a-supabase.js` | Crea la conexión `baseDeDatos` (se carga en todas las páginas) |
| `js/utilidades.js` | Formato de dinero y tiempo, mensajes para el usuario |
| `js/sesion.js` | Sabe quién inició sesión, ajusta el menú y cierra sesión |
| `js/catalogo.js` | Lista de subastas activas (`index.html`) |
| `js/registro.js` | Crear cuenta (`registro.html`) |
| `js/iniciar-sesion.js` | Iniciar sesión (`iniciar-sesion.html`) |
| `js/publicar.js` | Validar y guardar una subasta nueva (`publicar.html`) |
| `css/estilos.css` | Todos los estilos, divididos en 8 secciones numeradas |

## Cómo correrlo

Abrir `index.html` en el navegador (doble clic o con la extensión *Live Server* de VS Code).

## Documentación del proceso

- [Bitácora de IA](BITACORA_IA.md): qué le pedí a la IA, qué acepté y qué rechacé.
- [Diario de decisiones](DECISIONES.md): por qué hice las cosas como las hice.

## Autor

Josue Gadiel Rodriguez Hernandez
