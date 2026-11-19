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
- `localStorage` para guardar los datos en el navegador

## Cómo correrlo

Abrir `index.html` en el navegador (o usar la extensión *Live Server* de VS Code).

## Documentación del proceso

- [Bitácora de IA](BITACORA_IA.md): qué le pedí a la IA, qué acepté y qué rechacé.
- [Diario de decisiones](DECISIONES.md): por qué hice las cosas como las hice.

## Autor

Josue Gadiel Rodriguez Hernandez
