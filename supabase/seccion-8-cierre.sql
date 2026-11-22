-- =====================================================================
--  SECCIÓN 8 · Cierre automático de las subastas y ganador
--  Se ejecuta UNA vez, después de seccion-7-puja.sql:
--    Supabase → SQL Editor → New query → pega esto → Run
-- =====================================================================
--  ¿Quién cierra las subastas?
--  Una subasta termina a una hora exacta, pero la base de datos no hace
--  nada "sola" a esa hora. Por eso la cerramos de DOS formas:
--   1. RELOJ DEL SERVIDOR (pg_cron): cada minuto, PostgreSQL revisa y
--      cierra las subastas vencidas, aunque nadie tenga la página abierta.
--   2. LA PÁGINA: cuando el contador de subasta.html llega a cero, llama
--      a la misma función para que el ganador aparezca al instante,
--      sin esperar al siguiente minuto.
--  Las dos usan la misma función, y es segura de llamar muchas veces:
--  solo cierra subastas cuya hora ya pasó (según el reloj del servidor).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Función que cierra TODAS las subastas vencidas y elige su ganador.
--    Ganador = quien hizo la puja más alta. Sin pujas = sin ganador.
--    Regresa cuántas subastas cerró.
-- ---------------------------------------------------------------------
create or replace function public.cerrar_subastas_vencidas()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  id_de_la_subasta_vencida     bigint;
  id_del_ganador_encontrado    uuid;
  cantidad_de_subastas_cerradas integer := 0;
begin
  -- "for update" pone el CANDADO en cada subasta vencida.
  -- CASO LÍMITE: una puja que llegó en el último segundo y todavía se
  -- está guardando. La función pujar() tiene el candado de esa subasta,
  -- así que aquí esperamos a que termine; luego la puja ya cuenta
  -- para elegir al ganador.
  for id_de_la_subasta_vencida in
    select id
    from public.subastas
    where estado = 'activa'
      and fecha_de_finalizacion <= now()
    for update
  loop
    -- La puja más alta. Si hubiera empate, gana la que llegó primero.
    select id_del_usuario into id_del_ganador_encontrado
    from public.pujas
    where id_de_la_subasta = id_de_la_subasta_vencida
    order by monto desc, fecha_de_la_puja asc
    limit 1;
    -- CASO LÍMITE: nadie pujó → id_del_ganador_encontrado queda vacío (null)
    -- y la subasta termina sin ganador.

    update public.subastas
    set estado = 'finalizada',
        id_del_ganador = id_del_ganador_encontrado
    where id = id_de_la_subasta_vencida;

    cantidad_de_subastas_cerradas := cantidad_de_subastas_cerradas + 1;
  end loop;

  return cantidad_de_subastas_cerradas;
end;
$$;


-- ---------------------------------------------------------------------
-- 2. Permiso: cualquiera puede llamarla, incluso un visitante sin sesión
--    que está viendo la subasta. Es seguro porque la función no recibe
--    datos del usuario y solo cierra lo que ya debía cerrarse.
-- ---------------------------------------------------------------------
grant execute on function public.cerrar_subastas_vencidas() to anon, authenticated;


-- ---------------------------------------------------------------------
-- 3. pg_cron: el "despertador" de PostgreSQL (como el Programador de
--    tareas de Windows). '* * * * *' = cada minuto.
--    Si la tarea ya existe con ese nombre, se reemplaza (no se duplica).
-- ---------------------------------------------------------------------
create extension if not exists pg_cron;

select cron.schedule(
  'cerrar-subastas-vencidas',
  '* * * * *',
  'select public.cerrar_subastas_vencidas();'
);


-- ---------------------------------------------------------------------
-- 4. Cerrar ahora mismo las subastas de prueba que ya vencieron
-- ---------------------------------------------------------------------
select public.cerrar_subastas_vencidas() as subastas_cerradas;
