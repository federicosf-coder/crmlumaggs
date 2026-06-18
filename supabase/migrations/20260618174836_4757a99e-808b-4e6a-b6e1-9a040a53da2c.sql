-- 1) Asegurar empresa_vendedora siempre poblada
UPDATE public.inv_niveles_inventario SET empresa_vendedora = 'lumaggs' WHERE empresa_vendedora IS NULL;
ALTER TABLE public.inv_niveles_inventario ALTER COLUMN empresa_vendedora SET DEFAULT 'lumaggs';
ALTER TABLE public.inv_niveles_inventario ALTER COLUMN empresa_vendedora SET NOT NULL;

-- 2) Reemplazar el unique de solo codigo_producto por (codigo_producto, empresa_vendedora)
ALTER TABLE public.inv_niveles_inventario DROP CONSTRAINT IF EXISTS inv_niveles_inventario_codigo_producto_key;
ALTER TABLE public.inv_niveles_inventario
  ADD CONSTRAINT inv_niveles_inventario_codigo_empresa_key
  UNIQUE (codigo_producto, empresa_vendedora);