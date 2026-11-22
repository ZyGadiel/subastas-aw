-- =====================================================================
--  SECCIÓN 7 · Entrar a una subasta, pujar y ver todo en tiempo real
--  Se ejecuta UNA vez, después de seccion-6-publicar.sql:
--    Supabase → SQL Editor → New query → pega esto → Run
-- =====================================================================
--  ¿Por qué FUNCIONES y no un simple INSERT desde JavaScript?
--  Entrar y pujar no son "guardar una fila": hay que REVISAR varias cosas
--  y luego escribir en DOS tablas, todo junto y sin que otra persona se
--  meta en medio. Por ejemplo, al pujar:
--    1. ¿la subasta sigue activa?   2. ¿el usuario está participando?
--    3. ¿el monto alcanza el mínimo?   4. guardar la puja   5. subir el precio
--  Si eso lo hiciera el navegador, alguien podría saltarse los pasos 1 a 3.
--  Una función de la base de datos (como un procedimiento almacenado de
--  MySQL) hace todo en el servidor y en una sola transacción.
--
--  Supabase llama a estas funciones desde JavaScript con:
--    baseDeDatos.rpc('nombre_de_la_funcion', { parametros })
--
--  "security definer" = la función corre con permisos de su dueño (el
--  administrador de la base de datos). Así el usuario NO necesita permiso
--  de INSERT/UPDATE en las tablas: solo puede escribir a través de estas
--  funciones, que revisan todas las reglas antes.
--
--  Los mensajes de "raise exception" ya están en español: JavaScript los
--  muestra tal cual (su código de error es P0001).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. ENTRAR A LA SUBASTA: ocupar uno de los 5 lugares.
--    Regresa el número de lugar que le tocó al usuario (1 a 5).
-- ---------------------------------------------------------------------
create or replace function public.entrar_a_la_subasta(id_de_la_subasta_elegida bigint)
returns smallint
language plpgsql
security definer
set search_path = ''
as $$
declare
  id_del_usuario_actual  uuid := auth.uid();
  perfil_del_usuario     public.perfiles%rowtype;
  subasta_elegida        public.subastas%rowtype;
  lugar_que_ya_tenia     smallint;
  lugares_ocupados       integer;
begin
  -- ¿Quién es? (CASO LÍMITE: alguien llama a la función sin iniciar sesión)
  if id_del_usuario_actual is null then
    raise exception 'Inicia sesión para entrar a la subasta.';
  end if;

  select * into perfil_del_usuario
  from public.perfiles
  where id = id_del_usuario_actual;

  if not found then
    raise exception 'No encontramos tu perfil. Cierra sesión y vuelve a entrar.';
  end if;
  if perfil_del_usuario.suspendido then
    raise exception 'Tu cuenta está suspendida. No puedes participar.';
  end if;
  -- Solo los compradores participan (así el vendedor no puede pujar en su propia subasta)
  if perfil_del_usuario.rol <> 'comprador' then
    raise exception 'Solo las cuentas de comprador pueden participar en subastas.';
  end if;

  -- "for update" pone un CANDADO a la fila de la subasta hasta que termine
  -- esta función. CASO LÍMITE: si 2 personas dan clic al mismo tiempo para
  -- el último lugar, la segunda espera a que la primera termine, y entonces
  -- ya ve los 5 lugares ocupados. Nadie se "cuela" como sexto.
  select * into subasta_elegida
  from public.subastas
  where id = id_de_la_subasta_elegida
  for update;

  if not found or subasta_elegida.estado = 'eliminada' then
    raise exception 'Esa subasta no existe o fue eliminada.';
  end if;
  -- La hora la pone el servidor (now()), no la computadora del usuario
  if subasta_elegida.estado <> 'activa' or subasta_elegida.fecha_de_finalizacion <= now() then
    raise exception 'Esta subasta ya terminó.';
  end if;

  -- CASO LÍMITE: ya estaba dentro (por ejemplo, dio clic dos veces).
  -- No es un error: le regresamos el lugar que ya tenía.
  select numero_de_lugar into lugar_que_ya_tenia
  from public.participantes
  where id_de_la_subasta = id_de_la_subasta_elegida
    and id_del_usuario = id_del_usuario_actual;

  if found then
    return lugar_que_ya_tenia;
  end if;

  -- CASO LÍMITE: la subasta ya está llena
  select count(*) into lugares_ocupados
  from public.participantes
  where id_de_la_subasta = id_de_la_subasta_elegida;

  if lugares_ocupados >= 5 then
    raise exception 'La subasta ya tiene sus 5 lugares ocupados. Puedes seguir viéndola.';
  end if;

  -- Los lugares se dan en orden de llegada: el primero es el 1, el segundo el 2...
  insert into public.participantes (id_de_la_subasta, id_del_usuario, numero_de_lugar)
  values (id_de_la_subasta_elegida, id_del_usuario_actual, lugares_ocupados + 1);

  return lugares_ocupados + 1;
end;
$$;


-- ---------------------------------------------------------------------
-- 2. PUJAR: ofrecer un monto mayor.
--    Regla: monto mínimo = precio actual + incremento mínimo.
--    Regresa el nuevo precio actual.
-- ---------------------------------------------------------------------
create or replace function public.pujar(id_de_la_subasta_elegida bigint, monto_ofrecido numeric)
returns numeric
language plpgsql
security definer
set search_path = ''
as $$
declare
  id_del_usuario_actual     uuid := auth.uid();
  subasta_elegida           public.subastas%rowtype;
  monto_redondeado          numeric := round(monto_ofrecido, 2);   -- centavos, como el dinero
  monto_minimo              numeric;
  id_de_quien_va_ganando    uuid;
begin
  if id_del_usuario_actual is null then
    raise exception 'Inicia sesión para pujar.';
  end if;

  -- CASO LÍMITE: monto vacío, cero o negativo
  if monto_redondeado is null or monto_redondeado <= 0 then
    raise exception 'El monto de la puja debe ser mayor que cero.';
  end if;

  if exists (
    select 1 from public.perfiles
    where id = id_del_usuario_actual and suspendido = true
  ) then
    raise exception 'Tu cuenta está suspendida. No puedes pujar.';
  end if;

  -- CANDADO en la subasta. CASO LÍMITE: dos pujas al mismo tiempo.
  -- La segunda espera, y cuando le toca ya ve el precio nuevo:
  -- si su monto ya no alcanza el mínimo, se rechaza.
  select * into subasta_elegida
  from public.subastas
  where id = id_de_la_subasta_elegida
  for update;

  if not found or subasta_elegida.estado = 'eliminada' then
    raise exception 'Esa subasta no existe o fue eliminada.';
  end if;
  -- CASO LÍMITE: puja en el último segundo, cuando el reloj del servidor ya marcó el final
  if subasta_elegida.estado <> 'activa' or subasta_elegida.fecha_de_finalizacion <= now() then
    raise exception 'Esta subasta ya terminó. Ya no se aceptan pujas.';
  end if;

  -- Solo puja quien ocupó uno de los 5 lugares
  if not exists (
    select 1 from public.participantes
    where id_de_la_subasta = id_de_la_subasta_elegida
      and id_del_usuario = id_del_usuario_actual
  ) then
    raise exception 'Primero entra a la subasta para poder pujar.';
  end if;

  -- CASO LÍMITE: el que va ganando quiere subirse el precio a sí mismo
  select id_del_usuario into id_de_quien_va_ganando
  from public.pujas
  where id_de_la_subasta = id_de_la_subasta_elegida
  order by monto desc
  limit 1;

  if id_de_quien_va_ganando = id_del_usuario_actual then
    raise exception 'Ya tienes la puja más alta. Espera a que alguien te supere.';
  end if;

  -- CASO LÍMITE: monto menor al mínimo (el % se reemplaza por el número)
  monto_minimo := subasta_elegida.precio_actual + subasta_elegida.incremento_minimo;
  if monto_redondeado < monto_minimo then
    raise exception 'Tu puja debe ser de al menos $%.', to_char(monto_minimo, 'FM999,999,990.00');
  end if;

  -- Todo bien: se guarda la puja y sube el precio (en la misma transacción).
  -- CASO LÍMITE: un número gigante no cabe en numeric(10,2) y la base de
  -- datos lo rechaza con el error 22003 ("El número es demasiado grande").
  insert into public.pujas (id_de_la_subasta, id_del_usuario, monto)
  values (id_de_la_subasta_elegida, id_del_usuario_actual, monto_redondeado);

  update public.subastas
  set precio_actual = monto_redondeado
  where id = id_de_la_subasta_elegida;

  return monto_redondeado;
end;
$$;


-- ---------------------------------------------------------------------
-- 3. Permisos: solo los usuarios con sesión pueden llamar a las funciones.
--    Por defecto PostgreSQL deja que todos (public) ejecuten funciones;
--    primero se lo quitamos a todos y luego se lo damos a "authenticated".
-- ---------------------------------------------------------------------
revoke execute on function public.entrar_a_la_subasta(bigint) from public, anon;
revoke execute on function public.pujar(bigint, numeric) from public, anon;

grant execute on function public.entrar_a_la_subasta(bigint) to authenticated;
grant execute on function public.pujar(bigint, numeric) to authenticated;


-- ---------------------------------------------------------------------
-- 4. TIEMPO REAL (Supabase Realtime)
--    Una "publicación" es la lista de tablas cuyos cambios Supabase
--    transmite a los navegadores conectados. Al agregarlas aquí, cuando
--    alguien puja, todas las pantallas abiertas de esa subasta se enteran
--    al instante, sin recargar la página.
--    Realtime respeta las políticas RLS: cada quien solo recibe los
--    cambios de las filas que tiene permiso de ver.
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table subastas, participantes, pujas;
