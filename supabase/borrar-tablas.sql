-- =====================================================================
--  ⚠️ BORRA TODAS LAS TABLAS DEL PROYECTO Y SUS DATOS. NO SE PUEDE DESHACER.
--  Úsalo solo cuando quieras empezar desde cero, por ejemplo después de
--  cambiar supabase/schema.sql. Orden para reiniciar:
--    1) este archivo   2) schema.sql   3) datos-prueba.sql
--  Los usuarios de Authentication (auth.users) NO se borran.
-- =====================================================================
drop table if exists pujas, participantes, subastas, perfiles cascade;
