-- =====================================================================
--  SECCIÓN 6 · Permitir que los vendedores publiquen subastas
--  Se ejecuta UNA vez, después de seccion-5-usuarios.sql:
--    Supabase → SQL Editor → New query → pega esto → Run
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Regla nueva: una subasta dura como máximo 7 días.
--    CASO LÍMITE: alguien modifica la petición y manda una fecha de fin
--    del año 3000.
-- ---------------------------------------------------------------------
alter table subastas
  add constraint duracion_maxima_de_siete_dias
  check (fecha_de_finalizacion <= fecha_de_inicio + interval '7 days');


-- ---------------------------------------------------------------------
-- 2. Trigger que "limpia" cada subasta nueva ANTES de guardarla.
--    Hay datos que NO deben venir del navegador, porque alguien podría
--    cambiarlos. La base de datos los pone ella misma:
--     * id_del_vendedor = el usuario que inició sesión (auth.uid())
--     * fecha_de_inicio = ahora (el reloj del servidor, no el de la computadora)
--     * precio_actual   = precio_inicial (nadie ha pujado todavía)
--     * estado          = 'activa'   y   id_del_ganador = vacío
--    Si la subasta se crea desde el SQL Editor (como datos-prueba.sql),
--    no hay usuario con sesión (auth.uid() es null) y se respetan los datos.
-- ---------------------------------------------------------------------
create or replace function public.preparar_subasta_nueva()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.id_del_vendedor := auth.uid();
    new.fecha_de_inicio := now();
    new.precio_actual   := new.precio_inicial;
    new.estado          := 'activa';
    new.id_del_ganador  := null;
  end if;
  return new;
end;
$$;

create trigger antes_de_publicar_preparar_subasta
  before insert on subastas
  for each row
  execute function public.preparar_subasta_nueva();


-- ---------------------------------------------------------------------
-- 3. Permiso para insertar (como GRANT INSERT en MySQL).
--    Solo para usuarios con sesión iniciada ("authenticated"), nunca visitantes.
-- ---------------------------------------------------------------------
grant insert on subastas to authenticated;


-- ---------------------------------------------------------------------
-- 4. Política RLS: ¿quién puede insertar?
--    Solo un usuario cuyo perfil sea "vendedor" y que NO esté suspendido.
--    "with check" se revisa con la fila ya preparada por el trigger.
-- ---------------------------------------------------------------------
create policy "solo los vendedores activos publican"
  on subastas for insert
  to authenticated
  with check (
    exists (
      select 1
      from perfiles
      where perfiles.id = auth.uid()
        and perfiles.rol = 'vendedor'
        and perfiles.suspendido = false
    )
  );
