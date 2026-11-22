-- =====================================================================
--  SECCIÓN 5 · Crear el perfil automáticamente cuando alguien se registra
--  Se ejecuta UNA vez, después de schema.sql:
--    Supabase → SQL Editor → New query → pega esto → Run
-- =====================================================================
--  ¿Cómo funciona el registro?
--   1. JavaScript llama a Supabase Auth con correo, contraseña, nombre y rol.
--   2. Supabase Auth guarda el correo y la contraseña (cifrada) en auth.users.
--   3. ESTE TRIGGER se dispara justo después y crea la fila en "perfiles"
--      con el nombre y el rol.
--
--  ¿Por qué un trigger y no un INSERT desde JavaScript?
--   * Si JavaScript hiciera el INSERT, alguien podría modificar la petición
--     y registrarse como "administrador". Aquí la base de datos decide.
--   * El perfil se crea siempre, aunque el navegador se cierre a la mitad.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Función que crea el perfil.
--  * "security definer" = se ejecuta con permisos del dueño de la base de
--    datos, porque el usuario recién creado todavía no tiene permiso de
--    escribir en "perfiles".
--  * "set search_path = ''" obliga a escribir public.perfiles completo
--    (recomendación de seguridad de Supabase para funciones así).
--  * new.raw_user_meta_data = los datos extra que mandó JavaScript
--    (nombre y rol). "->>" saca un valor de ese JSON como texto.
-- ---------------------------------------------------------------------
create or replace function public.crear_perfil_del_usuario_nuevo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  nombre_elegido text := trim(new.raw_user_meta_data ->> 'nombre');
  rol_elegido    text := new.raw_user_meta_data ->> 'rol';
begin
  -- Solo se permite elegir comprador o vendedor. Cualquier otra cosa
  -- (incluido "administrador") se convierte en comprador.
  if rol_elegido is null or rol_elegido not in ('comprador', 'vendedor') then
    rol_elegido := 'comprador';
  end if;

  -- CASO LÍMITE: nombre vacío o de puros espacios
  if nombre_elegido is null or nombre_elegido = '' then
    nombre_elegido := 'Usuario sin nombre';
  end if;

  insert into public.perfiles (id, nombre, rol)
  values (new.id, left(nombre_elegido, 50), rol_elegido);  -- left(..., 50): máximo 50 letras

  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- El trigger: "después de insertar un usuario en auth.users,
-- ejecuta la función de arriba para esa fila".
-- ---------------------------------------------------------------------
create trigger al_registrarse_crear_perfil
  after insert on auth.users
  for each row
  execute function public.crear_perfil_del_usuario_nuevo();
