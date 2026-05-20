CREATE OR REPLACE FUNCTION public.get_or_create_deal_recompra_mes(p_company_id uuid, p_marca text, p_mes text DEFAULT to_char(now(), 'YYYY-MM'::text))
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pipeline_id uuid;
  v_stage_id uuid;
  v_deal_id uuid;
  v_company_name text;
  v_owner uuid;
  v_potencial numeric;
  v_mes_label text;
  v_plaza_id uuid;
  v_empresa_vendedora text;
BEGIN
  IF p_company_id IS NULL OR p_marca IS NULL OR p_mes IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT d.id INTO v_deal_id
    FROM public.crm_deals d
    JOIN public.crm_pipelines p ON p.id = d.pipeline_id
   WHERE d.company_id = p_company_id
     AND p.marca = p_marca
     AND d.pipeline_type = 'recompra'
     AND d.mes_negocio = p_mes
   LIMIT 1;

  IF v_deal_id IS NOT NULL THEN
    RETURN v_deal_id;
  END IF;

  SELECT id INTO v_pipeline_id
    FROM public.crm_pipelines
   WHERE marca = p_marca AND pipeline_type = 'recompra'
   LIMIT 1;

  IF v_pipeline_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO v_stage_id
    FROM public.crm_pipeline_stages
   WHERE pipeline_id = v_pipeline_id
   ORDER BY position ASC
   LIMIT 1;

  SELECT name, plaza_id INTO v_company_name, v_plaza_id FROM public.companies WHERE id = p_company_id;
  v_mes_label := to_char(to_date(p_mes || '-01', 'YYYY-MM-DD'), 'TMMonth YYYY');

  SELECT d.owner_id INTO v_owner
    FROM public.crm_deals d
    JOIN public.crm_pipelines p ON p.id = d.pipeline_id
   WHERE d.company_id = p_company_id AND p.marca = p_marca AND d.owner_id IS NOT NULL
   ORDER BY d.created_at DESC
   LIMIT 1;

  IF v_owner IS NULL THEN
    SELECT user_id INTO v_owner FROM public.company_ejecutivos
      WHERE company_id = p_company_id LIMIT 1;
  END IF;

  -- Plaza: priorizar el último documento (factura) de la empresa para esa marca
  v_empresa_vendedora := CASE WHEN p_marca = 'phillips66' THEN 'galsa_phillips66' ELSE 'lumaggs_chevron' END;
  SELECT doc.plaza_id INTO v_plaza_id
    FROM public.documentos doc
   WHERE doc.empresa_id = p_company_id
     AND doc.tipo_documento = 'factura'
     AND doc.is_active = true
     AND doc.empresa_vendedora = v_empresa_vendedora
     AND doc.plaza_id IS NOT NULL
   ORDER BY doc.fecha_documento DESC NULLS LAST, doc.created_at DESC
   LIMIT 1;

  -- Fallback: plaza registrada en la empresa
  IF v_plaza_id IS NULL THEN
    SELECT plaza_id INTO v_plaza_id FROM public.companies WHERE id = p_company_id;
  END IF;

  SELECT promedio_mensual_unidades INTO v_potencial
    FROM public.get_company_metrics(p_company_id, p_marca);

  INSERT INTO public.crm_deals (
    title, pipeline_id, stage_id, company_id, owner_id, plaza_id,
    pipeline_type, tipo_negocio, mes_negocio,
    potencial_unidades, value, probability
  ) VALUES (
    COALESCE(v_company_name, 'Cliente') || ' - Recompra ' || trim(v_mes_label),
    v_pipeline_id, v_stage_id, p_company_id, v_owner, v_plaza_id,
    'recompra'::public.pipeline_type,
    'recompra'::public.tipo_negocio_crm,
    p_mes,
    NULLIF(v_potencial, 0),
    0, 50
  )
  ON CONFLICT (company_id, pipeline_id, mes_negocio) WHERE pipeline_type='recompra'
  DO UPDATE SET updated_at = now()
  RETURNING id INTO v_deal_id;

  RETURN v_deal_id;
END;
$function$;