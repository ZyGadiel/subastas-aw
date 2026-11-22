-- =====================================================================
--  SECCIÓN 10 · Administrador: suspender usuarios, eliminar publicaciones
--  y ver estadísticas
--  Se ejecuta UNA vez, después de seccion-9-busqueda.sql, y DESPUÉS de
--  crear la cuenta admin@subastas.com desde la página de registro:
--    Supabase → SQL Editor → New query → pega esto → Run
-- =====================================================================
--  Todo lo del administrador son funciones "security definer" (como en la
--  Sección 7). La primera línea de cada una revisa que quien la llama SEA
--  administrador; si no, la rechaza. Así, aunque alguien abra el panel a la
--  fuerza o llame a la función desde la consola, la base de datos dice que no.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Convertir la cuenta admin@subastas.com en administrador.
--    La página de registro NO deja elegir "administrador" (el trigger de
--    la Sección 5 lo cambia a comprador). Esta es la única forma: desde
--    aquí, con acceso al panel de Supabase.
-- ---------------------------------------------------------------------
update perfiles
set rol = 'administrador'
where id = (select id from auth.users where email = 'admin@subastas.com');


-- ---------------------------------------------------------------------
-- 2. ¿El usuario que llama es un administrador activo?
--    "stable" = dentro de una misma consulta siempre da lo mismo.
-- ---------------------------------------------------------------------
create or replace function public.es_administrador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfiles
    where id = auth.uid()
      and rol = 'administrador'
      and suspendido = false
  );
$$;


-- ---------------------------------------------------------------------
-- 3. Lista de usuarios con su correo.
--    El correo está en auth.users (de Supabase Auth), que el navegador no
--    puede leer. Esta función sí, pero solo se la da al administrador.
-- ---------------------------------------------------------------------
create or replace function public.listar_usuarios()
returns table (
  id                 uuid,
  nombre             text,
  correo             text,
  rol                text,
  suspendido         boolean,
  fecha_de_registro  timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.es_administrador() then
    raise exception 'Solo el administrador puede ver la lista de usuarios.';
  end if;

  return query
    select perfiles.id,
           perfiles.nombre::text,
           usuarios_de_supabase.email::text,
           perfiles.rol,
           perfiles.suspendido,
           perfiles.fecha_de_registro
    from public.perfiles
    join auth.users as usuarios_de_supabase on usuarios_de_supabase.id = perfiles.id
    order by perfiles.fecha_de_registro desc;
end;
$$;


-- ---------------------------------------------------------------------
-- 4. Suspender o reactivar a un usuario.
--    Un usuario suspendido no puede publicar (política de la Sección 6),
--    ni entrar a subastas ni pujar (funciones de la Sección 7).
--    No se BORRA: su historial de pujas y ventas se conserva.
-- ---------------------------------------------------------------------
create or replace function public.cambiar_suspension_del_usuario(
  id_del_usuario_elegido uuid,
  suspender boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  perfil_elegido public.perfiles%rowtype;
begin
  if not public.es_administrador() then
    raise exception 'Solo el administrador puede suspender usuarios.';
  end if;

  -- CASO LÍMITE: el administrador se suspende a sí mismo y se queda sin panel
  if id_del_usuario_elegido = auth.uid() then
    raise exception 'No puedes suspender tu propia cuenta.';
  end if;

  select * into perfil_elegido
  from public.perfiles
  where id = id_del_usuario_elegido;

  if not found then
    raise exception 'Ese usuario no existe.';
  end if;
  if perfil_elegido.rol = 'administrador' then
    raise exception 'No puedes suspender a otro administrador.';
  end if;

  update public.perfiles
  set suspendido = suspender
  where id = id_del_usuario_elegido;

  return suspender;
end;
$$;


-- ---------------------------------------------------------------------
-- 5. Eliminar una publicación (por ejemplo, un producto prohibido).
--    Tampoco se borra la fila: se marca como 'eliminada'. La política RLS
--    de schema.sql la oculta de todos, y pujar() ya no la acepta.
-- ---------------------------------------------------------------------
create or replace function public.eliminar_subasta(id_de_la_subasta_elegida bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  estado_de_la_subasta text;
begin
  if not public.es_administrador() then
    raise exception 'Solo el administrador puede eliminar publicaciones.';
  end if;

  -- Candado: si alguien está pujando en este momento, esperamos a que termine
  select estado into estado_de_la_subasta
  from public.subastas
  where id = id_de_la_subasta_elegida
  for update;

  -- CASO LÍMITE: doble clic, o dos administradores al mismo tiempo
  if not found or estado_de_la_subasta = 'eliminada' then
    raise exception 'Esa publicación no existe o ya fue eliminada.';
  end if;

  update public.subastas
  set estado = 'eliminada'
  where id = id_de_la_subasta_elegida;
end;
$$;


-- ---------------------------------------------------------------------
-- 6. Estadísticas de la página, en un solo objeto JSON.
--    json_build_object('nombre', valor, ...) arma algo como:
--    { "usuarios": 7, "subastas_activas": 2, ... }
--    La ganancia de la página es el 3 % de cada venta, redondeado a
--    centavos venta por venta (así coincide con lo que ve cada vendedor).
-- ---------------------------------------------------------------------
create or replace function public.obtener_estadisticas()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.es_administrador() then
    raise exception 'Solo el administrador puede ver las estadísticas.';
  end if;

  return json_build_object(
    'usuarios',            (select count(*) from public.perfiles),
    'compradores',         (select count(*) from public.perfiles where rol = 'comprador'),
    'vendedores',          (select count(*) from public.perfiles where rol = 'vendedor'),
    'suspendidos',         (select count(*) from public.perfiles where suspendido),
    'subastas_activas',    (select count(*) from public.subastas where estado = 'activa'),
    'subastas_vendidas',   (select count(*) from public.subastas
                             where estado = 'finalizada' and id_del_ganador is not null),
    'subastas_sin_pujas',  (select count(*) from public.subastas
                             where estado = 'finalizada' and id_del_ganador is null),
    'subastas_eliminadas', (select count(*) from public.subastas where estado = 'eliminada'),
    'pujas',               (select count(*) from public.pujas),
    'total_vendido',       (select coalesce(sum(precio_actual), 0) from public.subastas
                             where estado = 'finalizada' and id_del_ganador is not null),
    'ganancia_por_comisiones', (select coalesce(sum(round(precio_actual * 0.03, 2)), 0) from public.subastas
                             where estado = 'finalizada' and id_del_ganador is not null)
  );
end;
$$;


-- ---------------------------------------------------------------------
-- 7. Permisos: solo usuarios con sesión pueden llamarlas (y adentro cada
--    función revisa que sea administrador).
-- ---------------------------------------------------------------------
revoke execute on function public.es_administrador() from public, anon;
revoke execute on function public.listar_usuarios() from public, anon;
revoke execute on function public.cambiar_suspension_del_usuario(uuid, boolean) from public, anon;
revoke execute on function public.eliminar_subasta(bigint) from public, anon;
revoke execute on function public.obtener_estadisticas() from public, anon;

grant execute on function public.es_administrador() to authenticated;
grant execute on function public.listar_usuarios() to authenticated;
grant execute on function public.cambiar_suspension_del_usuario(uuid, boolean) to authenticated;
grant execute on function public.eliminar_subasta(bigint) to authenticated;
grant execute on function public.obtener_estadisticas() to authenticated;


-- ---------------------------------------------------------------------
-- 8. Comprobar: debe salir una fila con rol "administrador".
--    Si sale vacío, la cuenta admin@subastas.com no existe todavía:
--    créala en registro.html y vuelve a correr solo el paso 1.
-- ---------------------------------------------------------------------
select perfiles.nombre, perfiles.rol, usuarios_de_supabase.email
from perfiles
join auth.users as usuarios_de_supabase on usuarios_de_supabase.id = perfiles.id
where perfiles.rol = 'administrador';
