-- 1. Add tipos array column to direcciones_empresa
ALTER TABLE public.direcciones_empresa
  ADD COLUMN IF NOT EXISTS tipos text[] NOT NULL DEFAULT '{}'::text[];

-- Backfill tipos from existing tipo
UPDATE public.direcciones_empresa
SET tipos = ARRAY[tipo::text]
WHERE (tipos IS NULL OR array_length(tipos, 1) IS NULL) AND tipo IS NOT NULL;

-- 2. Catalog table for editable address types
CREATE TABLE IF NOT EXISTS public.tipos_direccion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clave text NOT NULL UNIQUE,
  etiqueta text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tipos_direccion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view tipos_direccion"
  ON public.tipos_direccion FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage tipos_direccion"
  ON public.tipos_direccion FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can manage tipos_direccion"
  ON public.tipos_direccion FOR ALL
  USING (has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER update_tipos_direccion_updated_at
  BEFORE UPDATE ON public.tipos_direccion
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.tipos_direccion (clave, etiqueta) VALUES
  ('envio', 'Entrega'),
  ('fiscal', 'Fiscal'),
  ('comercial', 'Comercial'),
  ('sucursal', 'Sucursal'),
  ('principal', 'Principal')
ON CONFLICT (clave) DO NOTHING;