
-- Índices idempotentes
CREATE INDEX IF NOT EXISTS idx_inv_prod_prov_producto ON public.inv_producto_proveedor(producto_id);
CREATE INDEX IF NOT EXISTS idx_inv_prod_prov_contpaqi ON public.inv_producto_proveedor(codigo_contpaqi);
CREATE INDEX IF NOT EXISTS idx_inv_prod_prov_prov_conf ON public.inv_producto_proveedor(proveedor, confirmado);

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_inv_producto_proveedor_updated_at ON public.inv_producto_proveedor;
CREATE TRIGGER trg_inv_producto_proveedor_updated_at
BEFORE UPDATE ON public.inv_producto_proveedor
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Permisos por rol
INSERT INTO public.role_module_permissions (role, module, access_level) VALUES
  ('admin','inventario.mapeo','todos'),
  ('manager','inventario.mapeo','todos'),
  ('warehouse','inventario.mapeo','lectura'),
  ('accounting','inventario.mapeo','ninguno'),
  ('sales','inventario.mapeo','lectura'),
  ('customer_service','inventario.mapeo','ninguno'),
  ('delivery','inventario.mapeo','ninguno')
ON CONFLICT DO NOTHING;

-- Auto-mapeo Chevron: códigos del catálogo que coinciden exactamente con kardex
INSERT INTO public.inv_producto_proveedor (producto_id, proveedor, codigo_proveedor, codigo_contpaqi, confirmado)
SELECT p.id, 'chevron', p.codigo, inv.codigo_producto, true
FROM public.productos p
INNER JOIN public.inv_niveles_inventario inv ON inv.codigo_producto = p.codigo
WHERE NOT EXISTS (
  SELECT 1 FROM public.inv_producto_proveedor m
  WHERE m.codigo_contpaqi = inv.codigo_producto AND m.proveedor = 'chevron'
)
ON CONFLICT DO NOTHING;
