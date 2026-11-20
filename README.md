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

## Cómo correrlo

Abrir `index.html` con la extensión *Live Server* de VS Code.

## Documentación del proceso

- [Bitácora de IA](BITACORA_IA.md): qué le pedí a la IA, qué acepté y qué rechacé.
- [Diario de decisiones](DECISIONES.md): por qué hice las cosas como las hice.

## Autor

Josue Gadiel Rodriguez Hernandez
