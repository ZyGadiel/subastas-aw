-- =====================================================================
--  DATOS DE PRUEBA para ver el catálogo funcionando.
--
--  ANTES de correr esto, crea un usuario de prueba en Supabase:
--    Authentication → Users → Add user → Create new user
--    Email: vendedor@prueba.com   (contraseña: la que tú quieras)
--    ✅ Auto Confirm User
--
--  Después: SQL Editor → New query → pega esto → Run
--  Se puede correr varias veces: cada vez agrega 4 subastas nuevas.
-- =====================================================================

-- 1. Perfil del vendedor de prueba (si ya existe, no hace nada)
insert into perfiles (id, nombre, rol)
select id, 'Vendedor de prueba', 'vendedor'
from auth.users
where email = 'vendedor@prueba.com'
on conflict (id) do nothing;

-- 2. Cuatro subastas con distintas duraciones.
--    "now() + interval '...'" = la fecha de ahora más ese tiempo.
--    "values (...) as productos_de_prueba (...)" es una tabla temporal escrita a mano.
insert into subastas
  (id_del_vendedor, titulo, descripcion, categoria, url_de_la_foto,
   precio_inicial, incremento_minimo, precio_actual, fecha_de_finalizacion)
select
  vendedor_de_prueba.id,
  productos_de_prueba.titulo,
  productos_de_prueba.descripcion,
  productos_de_prueba.categoria,
  productos_de_prueba.url_de_la_foto,
  productos_de_prueba.precio_inicial,
  productos_de_prueba.incremento_minimo,
  productos_de_prueba.precio_inicial,                 -- el precio actual empieza igual al inicial
  now() + productos_de_prueba.duracion
from perfiles as vendedor_de_prueba
cross join (values
  ('Bicicleta de montaña', 'Rodada 29, frenos de disco, poco uso.', 'deportes',
     'https://picsum.photos/seed/bici/600/400', 1000.00, 50.00, interval '2 hours'),
  ('Audífonos inalámbricos', 'Cancelación de ruido, con estuche de carga.', 'electronica',
     'https://picsum.photos/seed/audifonos/600/400', 800.00, 25.00, interval '30 minutes'),
  ('Lámpara de escritorio', 'Luz LED con 3 intensidades.', 'hogar',
     'https://picsum.photos/seed/lampara/600/400', 250.00, 10.00, interval '1 day'),
  ('Chamarra de mezclilla', 'Talla M, como nueva.', 'ropa',
     null, 400.00, 20.00, interval '10 minutes')
) as productos_de_prueba
  (titulo, descripcion, categoria, url_de_la_foto, precio_inicial, incremento_minimo, duracion)
where vendedor_de_prueba.id = (select id from auth.users where email = 'vendedor@prueba.com');

-- 3. Comprobar: debe mostrar las subastas que acabas de crear
select id, titulo, precio_actual, fecha_de_finalizacion
from subastas
order by id;
