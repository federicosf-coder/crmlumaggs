DROP POLICY IF EXISTS "Acceso restringido - ver archivos proveedor" ON storage.objects;
DROP POLICY IF EXISTS "Acceso restringido - subir archivos proveedor" ON storage.objects;
DROP POLICY IF EXISTS "Acceso restringido - borrar archivos proveedor" ON storage.objects;

DROP TABLE IF EXISTS public.proveedor_price_items CASCADE;
DROP TABLE IF EXISTS public.proveedor_price_uploads CASCADE;
DROP TABLE IF EXISTS public.proveedor_price_access CASCADE;
DROP TABLE IF EXISTS public.proveedor_marcas CASCADE;

DROP FUNCTION IF EXISTS public.upsert_proveedor_price_row(text, text, text, text, text, text, numeric, date, uuid, numeric, numeric, numeric);
DROP FUNCTION IF EXISTS public.has_proveedor_price_access(uuid);