
-- Tables
CREATE TABLE IF NOT EXISTS public.company_productos_competencia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  producto_descripcion TEXT NOT NULL,
  marca_competencia TEXT,
  precio_actual NUMERIC,
  volumen_estimado NUMERIC,
  unidad_volumen TEXT,
  notas TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_prod_comp_company ON public.company_productos_competencia(company_id);

CREATE TABLE IF NOT EXISTS public.company_productos_competencia_fotos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID NOT NULL REFERENCES public.company_productos_competencia(id) ON DELETE CASCADE,
  url_foto TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_prod_comp_fotos_prod ON public.company_productos_competencia_fotos(producto_id);

ALTER TABLE public.company_productos_competencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_productos_competencia_fotos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view comp products"
  ON public.company_productos_competencia FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Sales+ insert comp products"
  ON public.company_productos_competencia FOR INSERT
  TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'sales'::app_role)
  );

CREATE POLICY "Sales+ update comp products"
  ON public.company_productos_competencia FOR UPDATE
  TO authenticated USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'sales'::app_role)
  );

CREATE POLICY "Sales+ delete comp products"
  ON public.company_productos_competencia FOR DELETE
  TO authenticated USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'sales'::app_role)
  );

CREATE POLICY "Auth users view comp product photos"
  ON public.company_productos_competencia_fotos FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Sales+ insert comp product photos"
  ON public.company_productos_competencia_fotos FOR INSERT
  TO authenticated WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'sales'::app_role)
  );

CREATE POLICY "Sales+ update comp product photos"
  ON public.company_productos_competencia_fotos FOR UPDATE
  TO authenticated USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'sales'::app_role)
  );

CREATE POLICY "Sales+ delete comp product photos"
  ON public.company_productos_competencia_fotos FOR DELETE
  TO authenticated USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
    OR public.has_role(auth.uid(), 'sales'::app_role)
  );

CREATE TRIGGER update_company_prod_comp_updated_at
  BEFORE UPDATE ON public.company_productos_competencia
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Companies columns
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS potencial_cliente TEXT,
  ADD COLUMN IF NOT EXISTS barrera_entrada TEXT;

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-fotos', 'company-fotos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read company-fotos') THEN
    CREATE POLICY "Public read company-fotos"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'company-fotos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Auth upload company-fotos') THEN
    CREATE POLICY "Auth upload company-fotos"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'company-fotos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Auth update company-fotos') THEN
    CREATE POLICY "Auth update company-fotos"
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = 'company-fotos');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Auth delete company-fotos') THEN
    CREATE POLICY "Auth delete company-fotos"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'company-fotos');
  END IF;
END$$;
