-- STEP 1: Update company_has_sold_units (drop first due to param rename)
DROP FUNCTION IF EXISTS public.company_has_sold_units(uuid, public.empresa_vendedora);
CREATE OR REPLACE FUNCTION public.company_has_sold_units(_company_id uuid, _empresa_vendedora public.empresa_vendedora)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.documentos
    WHERE empresa_id = _company_id
      AND tipo_documento = 'factura'
      AND COALESCE(estatus_factura::text, '') <> 'cancelada'
      AND lower(empresa_vendedora::text) = lower(_empresa_vendedora::text)
      AND COALESCE(unidades_equivalentes_total, 0) > 0
  );
$$;

-- STEP 2: Reclassify primera_compra deals to recompra when units exist
DO $$
DECLARE
  rec RECORD;
  v_recompra_pipeline_id uuid;
  v_recompra_stage_id uuid;
  v_has_units_chevron boolean;
  v_has_units_phillips boolean;
BEGIN
  FOR rec IN
    SELECT DISTINCT d.id as deal_id, d.company_id, p.marca, d.pipeline_type,
                    d.title, d.owner_id, d.created_by, d.potencial_unidades
    FROM public.crm_deals d
    JOIN public.crm_pipelines p ON p.id = d.pipeline_id
    WHERE d.pipeline_type = 'primera_compra'
      AND d.company_id IS NOT NULL
  LOOP
    IF rec.marca = 'chevron' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.documentos
        WHERE empresa_id = rec.company_id
          AND tipo_documento = 'factura'
          AND COALESCE(estatus_factura::text,'') <> 'cancelada'
          AND lower(empresa_vendedora::text) IN ('lumaggs','lumaggs sa de cv')
          AND COALESCE(unidades_equivalentes_total, 0) > 0
      ) INTO v_has_units_chevron;
      IF v_has_units_chevron THEN
        SELECT id INTO v_recompra_pipeline_id FROM public.crm_pipelines
          WHERE marca = 'chevron' AND pipeline_type = 'recompra' LIMIT 1;
        SELECT id INTO v_recompra_stage_id FROM public.crm_pipeline_stages
          WHERE pipeline_id = v_recompra_pipeline_id ORDER BY position ASC LIMIT 1;
        UPDATE public.crm_deals
        SET pipeline_id = v_recompra_pipeline_id,
            pipeline_type = 'recompra',
            stage_id = v_recompra_stage_id,
            tipo_negocio = 'recompra',
            notes = COALESCE(notes, '') || ' [Reclasificado automáticamente a Recompra por unidades vendidas]',
            updated_at = now()
        WHERE id = rec.deal_id;
      END IF;
    ELSIF rec.marca = 'phillips66' THEN
      SELECT EXISTS (
        SELECT 1 FROM public.documentos
        WHERE empresa_id = rec.company_id
          AND tipo_documento = 'factura'
          AND COALESCE(estatus_factura::text,'') <> 'cancelada'
          AND lower(empresa_vendedora::text) IN ('galsa','galsa sa de cv')
          AND COALESCE(unidades_equivalentes_total, 0) > 0
      ) INTO v_has_units_phillips;
      IF v_has_units_phillips THEN
        SELECT id INTO v_recompra_pipeline_id FROM public.crm_pipelines
          WHERE marca = 'phillips66' AND pipeline_type = 'recompra' LIMIT 1;
        SELECT id INTO v_recompra_stage_id FROM public.crm_pipeline_stages
          WHERE pipeline_id = v_recompra_pipeline_id ORDER BY position ASC LIMIT 1;
        UPDATE public.crm_deals
        SET pipeline_id = v_recompra_pipeline_id,
            pipeline_type = 'recompra',
            stage_id = v_recompra_stage_id,
            tipo_negocio = 'recompra',
            notes = COALESCE(notes, '') || ' [Reclasificado automáticamente a Recompra por unidades vendidas]',
            updated_at = now()
        WHERE id = rec.deal_id;
      END IF;
    END IF;
  END LOOP;
END $$;

-- STEP 3: Create recompra deals for companies with units but no deal
DO $$
DECLARE
  rec RECORD;
  v_pipeline_id uuid;
  v_stage_id uuid;
  v_owner uuid;
  v_potencial numeric;
BEGIN
  FOR rec IN
    SELECT DISTINCT c.id AS company_id, c.name AS company_name, c.created_by
    FROM public.companies c
    WHERE EXISTS (
      SELECT 1 FROM public.documentos d
      WHERE d.empresa_id = c.id
        AND d.tipo_documento = 'factura'
        AND COALESCE(d.estatus_factura::text,'') <> 'cancelada'
        AND lower(d.empresa_vendedora::text) IN ('lumaggs','lumaggs sa de cv')
        AND COALESCE(d.unidades_equivalentes_total, 0) > 0
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.crm_deals d
      JOIN public.crm_pipelines p ON p.id = d.pipeline_id
      WHERE d.company_id = c.id AND p.marca = 'chevron' AND d.pipeline_type = 'recompra'
    )
  LOOP
    SELECT id INTO v_pipeline_id FROM public.crm_pipelines
      WHERE marca = 'chevron' AND pipeline_type = 'recompra' LIMIT 1;
    SELECT id INTO v_stage_id FROM public.crm_pipeline_stages
      WHERE pipeline_id = v_pipeline_id ORDER BY position ASC LIMIT 1;
    SELECT user_id INTO v_owner FROM public.company_ejecutivos WHERE company_id = rec.company_id LIMIT 1;
    IF v_owner IS NULL THEN v_owner := rec.created_by; END IF;
    SELECT COALESCE(promedio_mensual_unidades, 0) INTO v_potencial
      FROM public.get_company_metrics(rec.company_id, 'chevron') LIMIT 1;
    INSERT INTO public.crm_deals (
      title, pipeline_id, stage_id, company_id, owner_id, created_by,
      pipeline_type, tipo_negocio, potencial_unidades, value, probability, close_date, notes
    ) VALUES (
      rec.company_name || ' - Recompra Chevron',
      v_pipeline_id, v_stage_id, rec.company_id, v_owner, COALESCE(v_owner, rec.created_by),
      'recompra', 'recompra', NULLIF(v_potencial, 0), 0, 50,
      CURRENT_DATE + 30,
      'Generado automáticamente por reclasificación de unidades vendidas.'
    );
  END LOOP;

  FOR rec IN
    SELECT DISTINCT c.id AS company_id, c.name AS company_name, c.created_by
    FROM public.companies c
    WHERE EXISTS (
      SELECT 1 FROM public.documentos d
      WHERE d.empresa_id = c.id
        AND d.tipo_documento = 'factura'
        AND COALESCE(d.estatus_factura::text,'') <> 'cancelada'
        AND lower(d.empresa_vendedora::text) IN ('galsa','galsa sa de cv')
        AND COALESCE(d.unidades_equivalentes_total, 0) > 0
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.crm_deals d
      JOIN public.crm_pipelines p ON p.id = d.pipeline_id
      WHERE d.company_id = c.id AND p.marca = 'phillips66' AND d.pipeline_type = 'recompra'
    )
  LOOP
    SELECT id INTO v_pipeline_id FROM public.crm_pipelines
      WHERE marca = 'phillips66' AND pipeline_type = 'recompra' LIMIT 1;
    SELECT id INTO v_stage_id FROM public.crm_pipeline_stages
      WHERE pipeline_id = v_pipeline_id ORDER BY position ASC LIMIT 1;
    SELECT user_id INTO v_owner FROM public.company_ejecutivos WHERE company_id = rec.company_id LIMIT 1;
    IF v_owner IS NULL THEN v_owner := rec.created_by; END IF;
    SELECT COALESCE(promedio_mensual_unidades, 0) INTO v_potencial
      FROM public.get_company_metrics(rec.company_id, 'phillips66') LIMIT 1;
    INSERT INTO public.crm_deals (
      title, pipeline_id, stage_id, company_id, owner_id, created_by,
      pipeline_type, tipo_negocio, potencial_unidades, value, probability, close_date, notes
    ) VALUES (
      rec.company_name || ' - Recompra Phillips 66',
      v_pipeline_id, v_stage_id, rec.company_id, v_owner, COALESCE(v_owner, rec.created_by),
      'recompra', 'recompra', NULLIF(v_potencial, 0), 0, 50,
      CURRENT_DATE + 30,
      'Generado automáticamente por reclasificación de unidades vendidas.'
    );
  END LOOP;
END $$;

-- STEP 4: Refresh potencial_unidades on all recompra deals
UPDATE public.crm_deals d
SET potencial_unidades = (
  SELECT COALESCE(promedio_mensual_unidades, 0)
  FROM public.get_company_metrics(
    d.company_id,
    CASE WHEN p.marca = 'chevron' THEN 'chevron' ELSE 'phillips66' END
  )
  LIMIT 1
),
updated_at = now()
FROM public.crm_pipelines p
WHERE d.pipeline_id = p.id
  AND d.pipeline_type = 'recompra'
  AND d.company_id IS NOT NULL;

-- STEP 5: Update resolve_documento_negocio
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
AS $$
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
  IF _empresa_id IS NULL OR _empresa_vendedora IS NULL THEN RETURN NULL; END IF;
  v_brand := public.brand_from_empresa_vendedora(_empresa_vendedora);
  v_has_units := public.company_has_sold_units(_empresa_id, _empresa_vendedora);
  v_target_type := CASE WHEN v_has_units THEN 'recompra' ELSE 'primera_compra' END::public.pipeline_type;
  SELECT id INTO v_pipeline_id FROM public.crm_pipelines
    WHERE marca = v_brand AND pipeline_type = v_target_type ORDER BY created_at ASC LIMIT 1;
  IF v_pipeline_id IS NULL THEN RETURN NULL; END IF;
  SELECT id INTO v_deal_id FROM public.crm_deals
    WHERE company_id = _empresa_id AND pipeline_id = v_pipeline_id
    ORDER BY created_at DESC LIMIT 1;
  IF v_deal_id IS NOT NULL THEN RETURN v_deal_id; END IF;
  SELECT name INTO v_company_name FROM public.companies WHERE id = _empresa_id;
  IF v_company_name IS NULL THEN v_company_name := 'Empresa'; END IF;
  SELECT user_id INTO v_owner FROM public.company_ejecutivos WHERE company_id = _empresa_id LIMIT 1;
  IF v_owner IS NULL THEN v_owner := _created_by; END IF;
  SELECT id INTO v_stage_id FROM public.crm_pipeline_stages
    WHERE pipeline_id = v_pipeline_id ORDER BY position ASC LIMIT 1;
  SELECT COALESCE(promedio_mensual_unidades, 0) INTO v_potencial
    FROM public.get_company_metrics(_empresa_id, v_brand) LIMIT 1;
  INSERT INTO public.crm_deals (
    title, pipeline_id, stage_id, company_id, contact_id, owner_id, created_by,
    tipo_negocio, pipeline_type, potencial_unidades, value, probability, close_date, notes
  ) VALUES (
    v_company_name || CASE WHEN v_has_units THEN ' - Recompra' ELSE ' - Primera Compra' END,
    v_pipeline_id, v_stage_id, _empresa_id, _contacto_id, v_owner, v_owner,
    CASE WHEN v_has_units THEN 'recompra' ELSE 'prospecto' END::public.tipo_negocio_crm,
    v_target_type,
    NULLIF(v_potencial, 0),
    0, 10, CURRENT_DATE + 14,
    'Generado automáticamente al crear documento.'
  ) RETURNING id INTO v_deal_id;
  RETURN v_deal_id;
END;
$$;