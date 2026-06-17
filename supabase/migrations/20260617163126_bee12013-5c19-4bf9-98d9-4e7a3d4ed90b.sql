ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'inventario.mapeo';

COMMIT;

CREATE TABLE public.inv_producto_proveedor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID REFERENCES public.productos(id) ON DELETE SET NULL,
  proveedor TEXT NOT NULL CHECK (proveedor IN ('chevron','phillips66')),
  codigo_proveedor TEXT NOT NULL,
  codigo_contpaqi TEXT NOT NULL,
  piezas_por_tarima INTEGER,
  confirmado BOOLEAN DEFAULT false,
  notas TEXT,
  creado_por UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(proveedor, codigo_proveedor),
  UNIQUE(codigo_contpaqi)
);

CREATE INDEX idx_inv_prod_prov_producto ON public.inv_producto_proveedor(producto_id);
CREATE INDEX idx_inv_prod_prov_codigo_contpaqi ON public.inv_producto_proveedor(codigo_contpaqi);
CREATE INDEX idx_inv_prod_prov_confirmado ON public.inv_producto_proveedor(confirmado);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inv_producto_proveedor TO authenticated;
GRANT ALL ON public.inv_producto_proveedor TO service_role;

ALTER TABLE public.inv_producto_proveedor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read mapeo"
  ON public.inv_producto_proveedor FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin/manager can insert mapeo"
  ON public.inv_producto_proveedor FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/manager can update mapeo"
  ON public.inv_producto_proveedor FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/manager can delete mapeo"
  ON public.inv_producto_proveedor FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER update_inv_producto_proveedor_updated_at
  BEFORE UPDATE ON public.inv_producto_proveedor
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.role_module_permissions (role, module, access_level) VALUES
('admin','inventario.mapeo','todos'),
('manager','inventario.mapeo','todos'),
('warehouse','inventario.mapeo','lectura'),
('accounting','inventario.mapeo','ninguno'),
('sales','inventario.mapeo','lectura'),
('customer_service','inventario.mapeo','ninguno'),
('delivery','inventario.mapeo','ninguno')
ON CONFLICT DO NOTHING;