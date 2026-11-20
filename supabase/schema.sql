-- =====================================================================
--  SUBASTAS AW · Esquema de la base de datos (PostgreSQL en Supabase)
--  Se ejecuta UNA vez en: Supabase → SQL Editor → New query → Run
-- =====================================================================
--  Diferencias con MySQL que aparecen aquí:
--   * uuid            → identificador largo y aleatorio (Supabase lo usa para los usuarios)
--   * bigint generated always as identity  → equivale a INT AUTO_INCREMENT
--   * timestamptz     → fecha y hora con zona horaria (como DATETIME, pero sin confusiones de horario)
--   * numeric(10,2)   → igual que DECIMAL(10,2) en MySQL: ideal para dinero
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. PERFILES: datos extra de cada usuario.
--    El correo y la contraseña NO van aquí: los guarda Supabase Auth
--    en su propia tabla (auth.users), cifrados. Nosotros solo enlazamos su id.
-- ---------------------------------------------------------------------
create table perfiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  nombre      varchar(50) not null,
  rol         text not null default 'comprador'
                check (rol in ('comprador', 'vendedor', 'admin')),
  suspendido  boolean not null default false,
  creado_en   timestamptz not null default now()
);


-- ---------------------------------------------------------------------
-- 2. SUBASTAS: cada producto publicado por un vendedor.
-- ---------------------------------------------------------------------
create table subastas (
  id                 bigint generated always as identity primary key,
  vendedor_id        uuid not null references perfiles (id),
  titulo             varchar(80) not null,
  descripcion        varchar(500) not null,
  categoria          text not null
                       check (categoria in ('electronica', 'hogar', 'ropa', 'deportes', 'otros')),
  foto_url           text,
  precio_inicial     numeric(10, 2) not null check (precio_inicial > 0),
  incremento_minimo  numeric(10, 2) not null check (incremento_minimo > 0),
  precio_actual      numeric(10, 2) not null,
  inicia_en          timestamptz not null default now(),
  termina_en         timestamptz not null,
  estado             text not null default 'activa'
                       check (estado in ('activa', 'finalizada', 'eliminada')),
  ganador_id         uuid references perfiles (id),
  creado_en          timestamptz not null default now(),

  -- Reglas que la base de datos hace cumplir aunque el JavaScript falle:
  check (precio_actual >= precio_inicial),   -- el precio nunca baja del inicial
  check (termina_en > inicia_en)             -- no puede terminar antes de empezar
);


-- ---------------------------------------------------------------------
-- 3. PARTICIPANTES: quién ocupó uno de los 5 lugares de cada subasta.
--    El "numero" (1 a 5) es lo que se muestra en pantalla
--    ("Participante 3") para no revelar el nombre real.
-- ---------------------------------------------------------------------
create table participantes (
  subasta_id  bigint not null references subastas (id) on delete cascade,
  usuario_id  uuid not null references perfiles (id),
  numero      smallint not null check (numero between 1 and 5),
  unido_en    timestamptz not null default now(),

  primary key (subasta_id, usuario_id),   -- un usuario no puede entrar dos veces a la misma subasta
  unique (subasta_id, numero)             -- dos usuarios no pueden tener el mismo lugar
);
-- Juntas, estas dos reglas garantizan el CUPO DE 5: solo existen los lugares 1..5,
-- y cada lugar se puede ocupar una sola vez. Aunque dos personas den clic al mismo
-- tiempo, la base de datos rechaza al que llegue segundo.


-- ---------------------------------------------------------------------
-- 4. PUJAS: el historial de ofertas.
-- ---------------------------------------------------------------------
create table pujas (
  id          bigint generated always as identity primary key,
  subasta_id  bigint not null references subastas (id) on delete cascade,
  usuario_id  uuid not null references perfiles (id),
  monto       numeric(10, 2) not null check (monto > 0),
  creado_en   timestamptz not null default now()
);


-- =====================================================================
--  PERMISOS DE LA API (GRANT)
--  Supabase tiene dos "usuarios" de base de datos para el navegador:
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
create policy "ver mi perfil"
  on perfiles for select
  using (auth.uid() = id);

-- Cualquiera, aunque no haya iniciado sesión, puede ver las subastas no eliminadas.
create policy "ver subastas publicas"
  on subastas for select
  using (estado <> 'eliminada');

-- Cualquiera puede ver cuántos lugares están ocupados y el historial de pujas.
-- Solo se ve el id del usuario (un uuid sin significado), nunca su nombre.
create policy "ver participantes"
  on participantes for select
  using (true);

create policy "ver pujas"
  on pujas for select
  using (true);
