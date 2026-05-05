-- Helper function to compute company-level commercial metrics by brand
CREATE OR REPLACE FUNCTION public.get_company_metrics(_company_id uuid, _marca text)
RETURNS TABLE(
  total_unidades NUMERIC,
  promedio_mensual_unidades NUMERIC,
  total_subtotal NUMERIC,
  promedio_mensual_subtotal NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ev public.empresa_vendedora;
BEGIN
  IF _company_id IS NULL OR _marca IS NULL THEN
    RETURN QUERY SELECT 0::numeric, 0::numeric, 0::numeric, 0::numeric;
    RETURN;
  END IF;

  v_ev := CASE WHEN _marca = 'phillips66' THEN 'galsa_phillips66'::public.empresa_vendedora
               ELSE 'lumaggs_chevron'::public.empresa_vendedora END;

  RETURN QUERY
  WITH base AS (
    SELECT
      date_trunc('month', fecha_documento) AS mes,
      COALESCE(unidades_equivalentes_total, 0) AS u,
      COALESCE(subtotal, ROUND(total / 1.16, 2)) AS s
    FROM public.documentos
    WHERE empresa_id = _company_id
      AND empresa_vendedora = v_ev
      AND tipo_documento = 'factura'
      AND is_active = true
      AND COALESCE(estatus_factura::text, '') NOT IN ('cancelada')
  ),
  monthly AS (
    SELECT mes, SUM(u) AS mu, SUM(s) AS ms FROM base GROUP BY mes
  )
  SELECT
    COALESCE((SELECT SUM(u) FROM base), 0)::numeric,
    COALESCE((SELECT AVG(mu) FROM monthly), 0)::numeric,
    COALESCE((SELECT SUM(s) FROM base), 0)::numeric,
    COALESCE((SELECT AVG(ms) FROM monthly), 0)::numeric;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_company_metrics(uuid, text) TO authenticated, anon, service_role;

-- Update get_or_create_deal_recompra_mes to use get_company_metrics
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

  SELECT name INTO v_company_name FROM public.companies WHERE id = p_company_id;
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

  -- Use the unified get_company_metrics function
  SELECT promedio_mensual_unidades INTO v_potencial
    FROM public.get_company_metrics(p_company_id, p_marca);

  INSERT INTO public.crm_deals (
    title, pipeline_id, stage_id, company_id, owner_id,
    pipeline_type, tipo_negocio, mes_negocio,
    potencial_unidades, value, probability
  ) VALUES (
    COALESCE(v_company_name, 'Cliente') || ' - Recompra ' || trim(v_mes_label),
    v_pipeline_id, v_stage_id, p_company_id, v_owner,
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

-- Update resolve_documento_negocio to populate potencial_unidades from get_company_metrics
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
  v_stage_id uuid;
  v_deal_id uuid;
  v_company_name text;
  v_owner uuid;
  v_has_units boolean;
  v_potencial numeric;
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

  SELECT promedio_mensual_unidades INTO v_potencial
    FROM public.get_company_metrics(_empresa_id, v_brand);

  INSERT INTO public.crm_deals (
    title, pipeline_id, stage_id, company_id, contact_id, owner_id, created_by,
    tipo_negocio, pipeline_type, value, probability, close_date, notes, potencial_unidades
  ) VALUES (
    v_company_name || CASE WHEN v_has_units THEN ' - Recompra' ELSE ' - Primera Compra' END,
    v_pipeline_id, v_stage_id, _empresa_id, _contacto_id, v_owner, v_owner,
    CASE WHEN v_has_units THEN 'recompra'::public.tipo_negocio_crm ELSE 'prospecto'::public.tipo_negocio_crm END,
    v_target_type,
    0, 10, CURRENT_DATE + 14,
    'Generado automáticamente al crear documento.',
    NULLIF(v_potencial, 0)
  ) RETURNING id INTO v_deal_id;

  RETURN v_deal_id;
END;
$function$;

-- Update trg_create_repurchase_opportunity to set potencial_unidades from get_company_metrics
CREATE OR REPLACE FUNCTION public.trg_create_repurchase_opportunity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pipeline_id uuid; v_stage_id uuid; v_owner uuid; v_existing uuid; v_existing_task uuid; v_deal_id uuid;
  v_potencial numeric;
BEGIN
  IF NEW.estatus_recompra_chevron IS DISTINCT FROM OLD.estatus_recompra_chevron
     AND NEW.estatus_recompra_chevron IN ('proximo','vencido','en_riesgo','dormido') THEN
    SELECT id INTO v_pipeline_id FROM public.crm_pipelines
      WHERE marca = 'chevron' AND pipeline_type = 'recompra' LIMIT 1;
    IF v_pipeline_id IS NOT NULL THEN
      SELECT id INTO v_stage_id FROM public.crm_pipeline_stages
        WHERE pipeline_id = v_pipeline_id ORDER BY position ASC LIMIT 1;
      SELECT user_id INTO v_owner FROM public.company_ejecutivos WHERE company_id = NEW.id LIMIT 1;
      IF v_owner IS NULL THEN v_owner := NEW.created_by; END IF;
      IF v_owner IS NOT NULL AND v_stage_id IS NOT NULL THEN
        SELECT id INTO v_existing FROM public.crm_deals
          WHERE company_id = NEW.id AND pipeline_id = v_pipeline_id
            AND tipo_negocio = 'recompra' AND convertido_a_cliente = false LIMIT 1;
        IF v_existing IS NULL THEN
          SELECT promedio_mensual_unidades INTO v_potencial
            FROM public.get_company_metrics(NEW.id, 'chevron');
          INSERT INTO public.crm_deals (title, pipeline_id, stage_id, company_id, owner_id, created_by, tipo_negocio, pipeline_type, value, probability, close_date, proxima_fecha_seguimiento, notes, potencial_unidades)
          VALUES ('Recompra · ' || NEW.name || ' · ' || INITCAP(NEW.estatus_recompra_chevron::text),
                  v_pipeline_id, v_stage_id, NEW.id, v_owner, v_owner, 'recompra', 'recompra',
                  COALESCE(NEW.ticket_promedio_chevron, 0), 60,
                  COALESCE(NEW.proxima_recompra_chevron, CURRENT_DATE + 14),
                  COALESCE(NEW.proxima_recompra_chevron, CURRENT_DATE + 7),
                  'Generado automáticamente. Estatus Chevron: ' || NEW.estatus_recompra_chevron::text,
                  NULLIF(v_potencial, 0))
          RETURNING id INTO v_deal_id;
        ELSE
          v_deal_id := v_existing;
        END IF;
        SELECT id INTO v_existing_task FROM public.crm_tasks
          WHERE company_id = NEW.id AND completed = false AND title LIKE 'Recompra · %' LIMIT 1;
        IF v_existing_task IS NULL THEN
          INSERT INTO public.crm_tasks (user_id, title, description, due_date, priority, company_id, deal_id)
          VALUES (v_owner,
                  'Recompra · ' || NEW.name || ' (' || NEW.estatus_recompra_chevron::text || ')',
                  'Cliente Chevron en estatus ' || NEW.estatus_recompra_chevron::text || '. Última compra: ' || COALESCE(NEW.fecha_ultima_compra_chevron::text, 'sin registro'),
                  COALESCE(NEW.proxima_recompra_chevron::timestamptz, now() + interval '3 days'),
                  CASE WHEN NEW.estatus_recompra_chevron IN ('en_riesgo','dormido') THEN 'high' ELSE 'medium' END,
                  NEW.id, v_deal_id);
        END IF;
      END IF;
    END IF;
  END IF;

  v_pipeline_id := NULL; v_stage_id := NULL; v_owner := NULL; v_existing := NULL; v_existing_task := NULL; v_deal_id := NULL; v_potencial := NULL;
  IF NEW.estatus_recompra_phillips66 IS DISTINCT FROM OLD.estatus_recompra_phillips66
     AND NEW.estatus_recompra_phillips66 IN ('proximo','vencido','en_riesgo','dormido') THEN
    SELECT id INTO v_pipeline_id FROM public.crm_pipelines
      WHERE marca = 'phillips66' AND pipeline_type = 'recompra' LIMIT 1;
    IF v_pipeline_id IS NOT NULL THEN
      SELECT id INTO v_stage_id FROM public.crm_pipeline_stages
        WHERE pipeline_id = v_pipeline_id ORDER BY position ASC LIMIT 1;
      SELECT user_id INTO v_owner FROM public.company_ejecutivos WHERE company_id = NEW.id LIMIT 1;
      IF v_owner IS NULL THEN v_owner := NEW.created_by; END IF;
      IF v_owner IS NOT NULL AND v_stage_id IS NOT NULL THEN
        SELECT id INTO v_existing FROM public.crm_deals
          WHERE company_id = NEW.id AND pipeline_id = v_pipeline_id
            AND tipo_negocio = 'recompra' AND convertido_a_cliente = false LIMIT 1;
        IF v_existing IS NULL THEN
          SELECT promedio_mensual_unidades INTO v_potencial
            FROM public.get_company_metrics(NEW.id, 'phillips66');
          INSERT INTO public.crm_deals (title, pipeline_id, stage_id, company_id, owner_id, created_by, tipo_negocio, pipeline_type, value, probability, close_date, proxima_fecha_seguimiento, notes, potencial_unidades)
          VALUES ('Recompra · ' || NEW.name || ' · ' || INITCAP(NEW.estatus_recompra_phillips66::text),
                  v_pipeline_id, v_stage_id, NEW.id, v_owner, v_owner, 'recompra', 'recompra',
                  COALESCE(NEW.ticket_promedio_phillips66, 0), 60,
                  COALESCE(NEW.proxima_recompra_phillips66, CURRENT_DATE + 14),
                  COALESCE(NEW.proxima_recompra_phillips66, CURRENT_DATE + 7),
                  'Generado automáticamente. Estatus Phillips66: ' || NEW.estatus_recompra_phillips66::text,
                  NULLIF(v_potencial, 0))
          RETURNING id INTO v_deal_id;
        ELSE
          v_deal_id := v_existing;
        END IF;
        SELECT id INTO v_existing_task FROM public.crm_tasks
          WHERE company_id = NEW.id AND completed = false AND title LIKE 'Recompra · %' LIMIT 1;
        IF v_existing_task IS NULL THEN
          INSERT INTO public.crm_tasks (user_id, title, description, due_date, priority, company_id, deal_id)
          VALUES (v_owner,
                  'Recompra · ' || NEW.name || ' (' || NEW.estatus_recompra_phillips66::text || ')',
                  'Cliente Phillips66 en estatus ' || NEW.estatus_recompra_phillips66::text || '. Última compra: ' || COALESCE(NEW.fecha_ultima_compra_phillips66::text, 'sin registro'),
                  COALESCE(NEW.proxima_recompra_phillips66::timestamptz, now() + interval '3 days'),
                  CASE WHEN NEW.estatus_recompra_phillips66 IN ('en_riesgo','dormido') THEN 'high' ELSE 'medium' END,
                  NEW.id, v_deal_id);
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END; $function$;