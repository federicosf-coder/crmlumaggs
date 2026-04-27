CREATE OR REPLACE FUNCTION public.resolve_documento_negocio(
  _empresa_id uuid,
  _contacto_id uuid,
  _empresa_vendedora public.empresa_vendedora,
  _created_by uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_brand text;
  v_target_type public.pipeline_type;
  v_pipeline_id uuid;
  v_stage_id uuid;
  v_deal_id uuid;
  v_company_name text;
  v_owner uuid;
  v_has_units boolean;
BEGIN
  IF _empresa_id IS NULL OR _empresa_vendedora IS NULL THEN
    RETURN NULL;
  END IF;

  v_brand := public.brand_from_empresa_vendedora(_empresa_vendedora);
  v_has_units := public.company_has_sold_units(_empresa_id, _empresa_vendedora);
  v_target_type := CASE WHEN v_has_units THEN 'recompra'::public.pipeline_type
                        ELSE 'primera_compra'::public.pipeline_type END;

  SELECT id INTO v_pipeline_id
  FROM public.crm_pipelines
  WHERE marca = v_brand AND pipeline_type = v_target_type
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_pipeline_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_deal_id
  FROM public.crm_deals
  WHERE company_id = _empresa_id
    AND pipeline_id = v_pipeline_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_deal_id IS NOT NULL THEN
    RETURN v_deal_id;
  END IF;

  SELECT name INTO v_company_name FROM public.companies WHERE id = _empresa_id;
  IF v_company_name IS NULL THEN v_company_name := 'Empresa'; END IF;

  SELECT user_id INTO v_owner FROM public.company_ejecutivos WHERE company_id = _empresa_id LIMIT 1;
  IF v_owner IS NULL THEN v_owner := _created_by; END IF;

  SELECT id INTO v_stage_id
  FROM public.crm_pipeline_stages
  WHERE pipeline_id = v_pipeline_id
  ORDER BY position ASC LIMIT 1;

  INSERT INTO public.crm_deals (
    title, pipeline_id, stage_id, company_id, contact_id, owner_id, created_by,
    tipo_negocio, pipeline_type, value, probability, close_date, notes
  ) VALUES (
    v_company_name || CASE WHEN v_has_units THEN ' - Recompra' ELSE ' - Primera Compra' END,
    v_pipeline_id, v_stage_id, _empresa_id, _contacto_id, v_owner, v_owner,
    CASE WHEN v_has_units THEN 'recompra'::public.tipo_negocio_crm ELSE 'prospecto'::public.tipo_negocio_crm END,
    v_target_type,
    0, 10, CURRENT_DATE + 14,
    'Generado automáticamente al crear documento.'
  ) RETURNING id INTO v_deal_id;

  RETURN v_deal_id;
END;
$function$;