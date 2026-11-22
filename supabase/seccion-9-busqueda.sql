-- =====================================================================
--  SECCIÓN 9 · Búsqueda sin importar acentos ni mayúsculas
--  Se ejecuta UNA vez, después de seccion-8-cierre.sql:
--    Supabase → SQL Editor → New query → pega esto → Run
-- =====================================================================
--  CASO LÍMITE: mucha gente escribe sin acentos. Con un ILIKE normal,
--  buscar "lampara" NO encuentra "Lámpara de escritorio", porque para
--  la computadora "a" y "á" son letras distintas.
--
--  Solución: una columna extra con el título "limpio" (sin acentos y en
--  minúsculas) que la base de datos calcula sola. La página busca en esa
--  columna, también con el texto limpio.
--    "Lámpara de escritorio"  →  "lampara de escritorio"
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. unaccent: extensión de PostgreSQL que quita acentos ("á" → "a", "ñ" → "n")
-- ---------------------------------------------------------------------
create extension if not exists unaccent with schema extensions;


-- ---------------------------------------------------------------------
-- 2. Función que quita los acentos.
--    "immutable" = con el mismo texto siempre da el mismo resultado.
--    PostgreSQL lo exige para usarla en una columna calculada (paso 3).
-- ---------------------------------------------------------------------
create or replace function public.quitar_acentos(texto text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select extensions.unaccent('extensions.unaccent'::regdictionary, texto);
$$;


-- ---------------------------------------------------------------------
-- 3. Columna calculada ("generated ... stored"): se llena sola al publicar
--    y se actualiza sola si cambia el título. Nadie la escribe a mano.
--    También se llena para las subastas que ya existen.
-- ---------------------------------------------------------------------
alter table subastas
  add column titulo_para_buscar text
  generated always as (lower(public.quitar_acentos(titulo))) stored;
