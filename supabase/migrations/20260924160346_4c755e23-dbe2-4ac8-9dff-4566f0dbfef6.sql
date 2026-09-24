-- 1) Limpieza de filas cruzadas en cero
DELETE FROM public.inv_niveles_inventario n
USING public.productos p
JOIN public.product_option_values pov ON pov.id = p.marca_id AND pov.option_type = 'marca'
WHERE p.codigo = n.codigo_producto
  AND COALESCE(n.stock_almacen_1001,0) = 0
  AND COALESCE(n.stock_almacen_1002,0) = 0
  AND COALESCE(n.stock_almacen_1003,0) = 0
  AND COALESCE(n.stock_almacen_1004,0) = 0
  AND COALESCE(n.stock_almacen_1005,0) = 0
  AND COALESCE(n.stock_almacen_1006,0) = 0
  AND COALESCE(n.stock_almacen_1007,0) = 0
  AND COALESCE(n.stock_total,0) = 0
  AND EXISTS (
    SELECT 1 FROM public.inv_niveles_inventario o
    WHERE o.codigo_producto = n.codigo_producto
      AND o.empresa_vendedora <> n.empresa_vendedora
  )
  AND (
    (lower(pov.value) LIKE '%chevron%' AND n.empresa_vendedora = 'galsa')
    OR (lower(pov.value) NOT LIKE '%chevron%' AND n.empresa_vendedora = 'lumaggs')
  );

-- 2) Candado: descartar filas en cero mal asignadas por marca en futuras cargas
CREATE OR REPLACE FUNCTION public.inv_niveles_bloquear_marca_cruzada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_marca text;
  v_empresa_correcta text;
  v_stock numeric;
BEGIN
  v_stock := COALESCE(NEW.stock_almacen_1001,0) + COALESCE(NEW.stock_almacen_1002,0)
           + COALESCE(NEW.stock_almacen_1003,0) + COALESCE(NEW.stock_almacen_1004,0)
           + COALESCE(NEW.stock_almacen_1005,0) + COALESCE(NEW.stock_almacen_1006,0)
           + COALESCE(NEW.stock_almacen_1007,0) + COALESCE(NEW.stock_total,0);

  -- Solo descartamos filas sin existencia; con inventario real nunca se pierde el dato
  IF v_stock <> 0 THEN
    RETURN NEW;
  END IF;

  SELECT pov.value INTO v_marca
  FROM public.productos p
  JOIN public.product_option_values pov
    ON pov.id = p.marca_id AND pov.option_type = 'marca'
  WHERE p.codigo = NEW.codigo_producto
  LIMIT 1;

  IF v_marca IS NULL THEN
    RETURN NEW;
  END IF;

  v_empresa_correcta := CASE WHEN lower(v_marca) LIKE '%chevron%' THEN 'lumaggs' ELSE 'galsa' END;

  IF NEW.empresa_vendedora <> v_empresa_correcta THEN
    RETURN NULL; -- se descarta la fila cruzada en cero
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inv_niveles_bloquear_marca_cruzada ON public.inv_niveles_inventario;
CREATE TRIGGER trg_inv_niveles_bloquear_marca_cruzada
BEFORE INSERT OR UPDATE ON public.inv_niveles_inventario
FOR EACH ROW EXECUTE FUNCTION public.inv_niveles_bloquear_marca_cruzada();