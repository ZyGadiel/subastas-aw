-- =====================================================================
--  SUBASTAS AW · Esquema de la base de datos (PostgreSQL en Supabase)
--  Se ejecuta en: Supabase → SQL Editor → New query → Run
--  (Si las tablas ya existen, primero corre supabase/borrar-tablas.sql)
-- =====================================================================
--  Diferencias con MySQL que aparecen aquí:
--   * uuid            → identificador largo y aleatorio (Supabase lo usa para los usuarios)
--   * bigint generated always as identity  → equivale a INT AUTO_INCREMENT
--   * timestamptz     → fecha y hora con zona horaria (como DATETIME, pero sin confusiones de horario)
--   * numeric(10,2)   → igual que DECIMAL(10,2) en MySQL: ideal para dinero
--
--  Cada regla tiene nombre ("constraint nombre_de_la_regla"). Así, cuando la
--  base de datos rechaza algo, el error dice QUÉ regla se rompió y JavaScript
--  puede mostrar un mensaje claro.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. PERFILES: datos extra de cada usuario.
--    El correo y la contraseña NO van aquí: los guarda Supabase Auth
--    en su propia tabla (auth.users), cifrados. Nosotros solo enlazamos su id.
-- ---------------------------------------------------------------------
create table perfiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  nombre             varchar(50) not null,
  rol                text not null default 'comprador',
  suspendido         boolean not null default false,
  fecha_de_registro  timestamptz not null default now(),

  constraint rol_valido check (rol in ('comprador', 'vendedor', 'administrador'))
);


-- ---------------------------------------------------------------------
-- 2. SUBASTAS: cada producto publicado por un vendedor.
-- ---------------------------------------------------------------------
create table subastas (
  id                     bigint generated always as identity primary key,
  id_del_vendedor        uuid not null references perfiles (id),
  titulo                 varchar(80) not null,
  descripcion            varchar(500) not null,
  categoria              text not null,
  url_de_la_foto         text,
  precio_inicial         numeric(10, 2) not null,
  incremento_minimo      numeric(10, 2) not null,
  precio_actual          numeric(10, 2) not null,
  fecha_de_inicio        timestamptz not null default now(),
  fecha_de_finalizacion  timestamptz not null,
  estado                 text not null default 'activa',
  id_del_ganador         uuid references perfiles (id),
  fecha_de_creacion      timestamptz not null default now(),

  -- Reglas que la base de datos hace cumplir aunque el JavaScript falle:
  constraint categoria_valida
    check (categoria in ('electronica', 'hogar', 'ropa', 'deportes', 'otros')),
  constraint estado_valido
    check (estado in ('activa', 'finalizada', 'eliminada')),
  constraint precio_inicial_positivo
    check (precio_inicial > 0),
  constraint incremento_minimo_positivo
    check (incremento_minimo > 0),
  constraint precio_actual_no_menor_al_inicial          -- el precio nunca baja
    check (precio_actual >= precio_inicial),
  constraint finaliza_despues_de_iniciar                -- no puede terminar antes de empezar
    check (fecha_de_finalizacion > fecha_de_inicio)
);


-- ---------------------------------------------------------------------
-- 3. PARTICIPANTES: quién ocupó uno de los 5 lugares de cada subasta.
--    El "numero_de_lugar" (1 a 5) es lo que se muestra en pantalla
--    ("Participante 3") para no revelar el nombre real.
-- ---------------------------------------------------------------------
create table participantes (
  id_de_la_subasta  bigint not null references subastas (id) on delete cascade,
  id_del_usuario    uuid not null references perfiles (id),
  numero_de_lugar   smallint not null,
  fecha_de_ingreso  timestamptz not null default now(),

  -- Un usuario no puede entrar dos veces a la misma subasta
  constraint un_lugar_por_usuario primary key (id_de_la_subasta, id_del_usuario),
  -- Solo existen los lugares 1, 2, 3, 4 y 5
  constraint lugar_entre_uno_y_cinco check (numero_de_lugar between 1 and 5),
  -- Dos usuarios no pueden tener el mismo lugar en la misma subasta
  constraint lugar_no_repetido unique (id_de_la_subasta, numero_de_lugar)
);
-- Juntas, estas reglas garantizan el CUPO DE 5: solo existen los lugares 1..5,
-- y cada lugar se puede ocupar una sola vez. Aunque dos personas den clic al mismo
-- tiempo, la base de datos rechaza al que llegue segundo.


-- ---------------------------------------------------------------------
-- 4. PUJAS: el historial de ofertas.
-- ---------------------------------------------------------------------
create table pujas (
  id                bigint generated always as identity primary key,
  id_de_la_subasta  bigint not null references subastas (id) on delete cascade,
  id_del_usuario    uuid not null references perfiles (id),
  monto             numeric(10, 2) not null,
  fecha_de_la_puja  timestamptz not null default now(),

  constraint monto_positivo check (monto > 0)
);


-- =====================================================================
--  PERMISOS DE LA API (GRANT)
--  Supabase tiene dos "usuarios" de base de datos para el navegador
--  (sus nombres en inglés los define Supabase, no se pueden cambiar):
--   * anon          → visitante que NO ha iniciado sesión
--   * authenticated → usuario que SÍ inició sesión
--  Igual que GRANT en MySQL: primero se da permiso sobre la tabla,
--  y después RLS (abajo) decide QUÉ filas puede ver cada quien.
--  Por ahora solo lectura (SELECT); los demás permisos van en cada sección.
-- =====================================================================
grant select on perfiles, subastas, participantes, pujas to anon, authenticated;


-- =====================================================================
--  SEGURIDAD: Row Level Security (RLS)
--  En Supabase, el navegador habla DIRECTO con la base de datos.
--  Por eso hay que decir quién puede leer o escribir cada tabla.
--  Al activar RLS, por defecto NADIE puede hacer nada; luego abrimos
--  solo lo necesario con "policies" (políticas).
--
--  Por ahora solo abrimos LECTURA. Los permisos para escribir
--  (registrarse, publicar, pujar) los agregamos en la sección de cada función.
-- =====================================================================
alter table perfiles      enable row level security;
alter table subastas      enable row level security;
alter table participantes enable row level security;
alter table pujas         enable row level security;

-- Cada usuario solo puede ver SU propio perfil (privacidad).
-- auth.uid() = el id del usuario que inició sesión.
create policy "cada usuario ve solo su perfil"
  on perfiles for select
  using (auth.uid() = id);

-- Cualquiera, aunque no haya iniciado sesión, puede ver las subastas no eliminadas.
create policy "todos ven las subastas no eliminadas"
  on subastas for select
  using (estado <> 'eliminada');

-- Cualquiera puede ver cuántos lugares están ocupados y el historial de pujas.
-- Solo se ve el id del usuario (un uuid sin significado), nunca su nombre.
create policy "todos ven los participantes"
  on participantes for select
  using (true);

create policy "todos ven las pujas"
  on pujas for select
  using (true);
