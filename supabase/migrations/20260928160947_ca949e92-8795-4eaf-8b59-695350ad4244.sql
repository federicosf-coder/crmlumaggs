CREATE TABLE public.grupos_comerciales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX grupos_comerciales_nombre_key ON public.grupos_comerciales (lower(nombre));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.grupos_comerciales TO authenticated;
GRANT ALL ON public.grupos_comerciales TO service_role;

ALTER TABLE public.grupos_comerciales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view grupos comerciales"
  ON public.grupos_comerciales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can create grupos comerciales"
  ON public.grupos_comerciales FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update grupos comerciales"
  ON public.grupos_comerciales FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins can delete grupos comerciales"
  ON public.grupos_comerciales FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_grupos_comerciales_updated_at
  BEFORE UPDATE ON public.grupos_comerciales
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.companies
  ADD COLUMN grupo_comercial_id UUID REFERENCES public.grupos_comerciales(id) ON DELETE SET NULL;

CREATE INDEX idx_companies_grupo_comercial ON public.companies (grupo_comercial_id);