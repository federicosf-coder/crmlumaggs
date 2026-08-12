CREATE TABLE public.seguimiento_ventas_ignorados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_vendedora public.empresa_vendedora NOT NULL,
  company_id uuid NOT NULL,
  razon text,
  ignorado_por uuid,
  ignorado_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seguimiento_ventas_ignorados TO authenticated;
GRANT ALL ON public.seguimiento_ventas_ignorados TO service_role;

ALTER TABLE public.seguimiento_ventas_ignorados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view ventas ignorados" ON public.seguimiento_ventas_ignorados FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage ventas ignorados" ON public.seguimiento_ventas_ignorados FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX idx_seg_ventas_ignorados_empresa ON public.seguimiento_ventas_ignorados (empresa_vendedora, is_active);

CREATE TRIGGER update_seguimiento_ventas_ignorados_updated_at
BEFORE UPDATE ON public.seguimiento_ventas_ignorados
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();