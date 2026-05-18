
CREATE OR REPLACE FUNCTION public.resolve_documento_negocio(_empresa_id uuid, _contacto_id uuid, _empresa_vendedora empresa_vendedora, _created_by uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_brand text;
  v_target_type public.pipeline_type;
  v_pipeline_id uuid;
  v_deal_id uuid;
  v_has_units boolean;
BEGIN
  IF _empresa_id IS NULL OR _empresa_vendedora IS NULL THEN RETURN NULL; END IF;
  v_brand := public.brand_from_empresa_vendedora(_empresa_vendedora);
  v_has_units := public.company_has_sold_units(_empresa_id, _empresa_vendedora);
  v_target_type := CASE WHEN v_has_units THEN 'recompra' ELSE 'primera_compra' END::public.pipeline_type;
  SELECT id INTO v_pipeline_id FROM public.crm_pipelines
    WHERE marca = v_brand AND pipeline_type = v_target_type ORDER BY created_at ASC LIMIT 1;
  IF v_pipeline_id IS NULL THEN RETURN NULL; END IF;
  -- Solo buscar un deal existente; NO crear uno nuevo (se crea explícitamente desde el UI vía diálogo)
  SELECT id INTO v_deal_id FROM public.crm_deals
    WHERE company_id = _empresa_id AND pipeline_id = v_pipeline_id
    ORDER BY created_at DESC LIMIT 1;
  RETURN v_deal_id;
END;
$function$;
