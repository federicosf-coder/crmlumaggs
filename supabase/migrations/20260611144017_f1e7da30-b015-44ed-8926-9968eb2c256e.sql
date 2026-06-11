-- Add per-uom price columns
ALTER TABLE public.catalogo_externo_productos
  ADD COLUMN IF NOT EXISTS precio_por_uom_mxn numeric,
  ADD COLUMN IF NOT EXISTS precio_por_uom_usd numeric;

-- Pricing helper based on precio_clasificaciones + precio_config_global margins.
CREATE OR REPLACE FUNCTION public.calcular_precios_catalogo_externo(
  p_costo numeric,
  p_clasificacion_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  m record;
  result jsonb := '{}'::jsonb;
  levels text[] := ARRAY['uf1','uf2','uf3','uf4','r1','r2','r3','r4'];
  lvl text;
  mg numeric;
  price numeric;
BEGIN
  IF p_costo IS NULL OR p_costo <= 0 THEN RETURN NULL; END IF;
  IF p_clasificacion_id IS NOT NULL THEN
    SELECT * INTO m FROM public.precio_clasificaciones WHERE id=p_clasificacion_id;
  END IF;
  IF NOT FOUND OR p_clasificacion_id IS NULL THEN
    SELECT * INTO m FROM public.precio_config_global LIMIT 1;
  END IF;
  IF NOT FOUND THEN RETURN NULL; END IF;
  FOREACH lvl IN ARRAY levels LOOP
    EXECUTE format('SELECT ($1).margen_%I', lvl) INTO mg USING m;
    IF mg IS NULL OR mg>=100 THEN price:=0;
    ELSE price:=round(p_costo/(1-mg/100),2);
    END IF;
    result := result || jsonb_build_object(lvl, price);
  END LOOP;
  RETURN result;
END;
$$;