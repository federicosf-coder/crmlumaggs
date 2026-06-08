
CREATE TABLE public.producto_linea_margenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  linea_id uuid UNIQUE REFERENCES public.product_option_values(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  margen_uf1 numeric NOT NULL DEFAULT 0,
  margen_uf2 numeric NOT NULL DEFAULT 0,
  margen_uf3 numeric NOT NULL DEFAULT 0,
  margen_uf4 numeric NOT NULL DEFAULT 0,
  margen_r1  numeric NOT NULL DEFAULT 0,
  margen_r2  numeric NOT NULL DEFAULT 0,
  margen_r3  numeric NOT NULL DEFAULT 0,
  margen_r4  numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Solo puede existir una fila "General" (linea_id NULL)
CREATE UNIQUE INDEX producto_linea_margenes_general_uidx
  ON public.producto_linea_margenes ((linea_id IS NULL)) WHERE linea_id IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.producto_linea_margenes TO authenticated;
GRANT ALL ON public.producto_linea_margenes TO service_role;

ALTER TABLE public.producto_linea_margenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view producto_linea_margenes"
  ON public.producto_linea_margenes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage producto_linea_margenes"
  ON public.producto_linea_margenes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers manage producto_linea_margenes"
  ON public.producto_linea_margenes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER trg_producto_linea_margenes_updated_at
  BEFORE UPDATE ON public.producto_linea_margenes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed fila General
INSERT INTO public.producto_linea_margenes (linea_id, nombre)
VALUES (NULL, 'General')
ON CONFLICT DO NOTHING;
