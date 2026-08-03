CREATE TABLE public.productos_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  marca_id uuid REFERENCES public.product_option_values(id),
  descripcion text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_productos_base_marca ON public.productos_base(marca_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.productos_base TO authenticated;
GRANT ALL ON public.productos_base TO service_role;

ALTER TABLE public.productos_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view productos_base" ON public.productos_base FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage productos_base" ON public.productos_base FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers can manage productos_base" ON public.productos_base FOR ALL USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Warehouse can manage productos_base" ON public.productos_base FOR ALL USING (has_role(auth.uid(), 'warehouse'::app_role));

CREATE TRIGGER update_productos_base_updated_at BEFORE UPDATE ON public.productos_base FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.productos ADD COLUMN producto_base_id uuid REFERENCES public.productos_base(id);
CREATE INDEX idx_productos_producto_base_id ON public.productos(producto_base_id);