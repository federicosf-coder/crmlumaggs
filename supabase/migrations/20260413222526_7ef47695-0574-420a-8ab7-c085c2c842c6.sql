
CREATE TABLE public.condiciones_comerciales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_vendedora public.empresa_vendedora NOT NULL UNIQUE,
  contenido text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.condiciones_comerciales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view condiciones"
ON public.condiciones_comerciales FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can manage condiciones"
ON public.condiciones_comerciales FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Managers can manage condiciones"
ON public.condiciones_comerciales FOR ALL
USING (public.has_role(auth.uid(), 'manager'::public.app_role));

-- Seed both rows
INSERT INTO public.condiciones_comerciales (empresa_vendedora, contenido) VALUES
  ('lumaggs_chevron', ''),
  ('galsa_phillips66', '');

CREATE TRIGGER update_condiciones_comerciales_updated_at
BEFORE UPDATE ON public.condiciones_comerciales
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
