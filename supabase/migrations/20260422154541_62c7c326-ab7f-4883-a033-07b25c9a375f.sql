-- Paso 1 de reemplazo de documentos / documento_productos
-- Crea tablas de staging vacías y respaldos completos de las tablas actuales.
-- No borra ni modifica datos productivos todavía.

-- Backups completos (snapshot)
CREATE TABLE IF NOT EXISTS public.documentos_backup_2026_04_22 AS
  TABLE public.documentos WITH NO DATA;
INSERT INTO public.documentos_backup_2026_04_22 SELECT * FROM public.documentos;

CREATE TABLE IF NOT EXISTS public.documento_productos_backup_2026_04_22 AS
  TABLE public.documento_productos WITH NO DATA;
INSERT INTO public.documento_productos_backup_2026_04_22 SELECT * FROM public.documento_productos;

-- Staging (misma estructura, sin constraints rígidos para validar primero)
DROP TABLE IF EXISTS public._stg_documentos;
DROP TABLE IF EXISTS public._stg_documento_productos;
CREATE TABLE public._stg_documentos (LIKE public.documentos INCLUDING DEFAULTS);
CREATE TABLE public._stg_documento_productos (LIKE public.documento_productos INCLUDING DEFAULTS);

-- RLS permisivo solo para que el pooler pueda insertar; se eliminarán al final
ALTER TABLE public._stg_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public._stg_documento_productos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stg_all_docs" ON public._stg_documentos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "stg_all_docprods" ON public._stg_documento_productos FOR ALL USING (true) WITH CHECK (true);

-- Backups con RLS de solo-admin para que no queden expuestos
ALTER TABLE public.documentos_backup_2026_04_22 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documento_productos_backup_2026_04_22 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backup_admin_only_docs" ON public.documentos_backup_2026_04_22
  FOR ALL USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "backup_admin_only_docprods" ON public.documento_productos_backup_2026_04_22
  FOR ALL USING (public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));