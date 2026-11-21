// =====================================================================
//  CONEXIÓN CON SUPABASE
//  Este archivo se carga en TODAS las páginas, antes que los demás scripts.
//  Crea la variable global "baseDeDatos", que los demás archivos usan
//  para consultar la base de datos.
// =====================================================================

// Dirección del proyecto: Supabase → Connect (o Project Settings → API).
const DIRECCION_DEL_PROYECTO_SUPABASE = 'https://syrnzaehedhbwppngimq.supabase.co';

// Llave pública ("Publishable key"): Supabase → Project Settings → API Keys.
// Esta llave SÍ puede ir en el código: está hecha para el navegador y solo
// permite lo que las políticas de seguridad (RLS) dejen hacer.
// ⚠️ NUNCA pongas aquí la llave secreta ("Secret key") ni la contraseña de la base de datos.
const LLAVE_PUBLICA_SUPABASE = 'sb_publishable_2HLPEcpp1h6HvqXJZjWp6A_GTwZOrMf';

// "supabase" (global) viene de la librería que se carga desde el CDN en el HTML.
// createClient es su función (en inglés) que arma el objeto con el que hacemos consultas.
const baseDeDatos = supabase.createClient(DIRECCION_DEL_PROYECTO_SUPABASE, LLAVE_PUBLICA_SUPABASE);
