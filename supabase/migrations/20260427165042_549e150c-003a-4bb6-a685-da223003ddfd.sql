CREATE OR REPLACE FUNCTION public.brand_from_empresa_vendedora(_ev public.empresa_vendedora)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN _ev = 'lumaggs_chevron'::public.empresa_vendedora THEN 'chevron' ELSE 'phillips66' END
$$;