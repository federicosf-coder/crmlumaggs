-- 1) Add column + FK + index
ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS negocio_id uuid REFERENCES public.crm_deals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documentos_negocio_id ON public.documentos(negocio_id);

-- 2) Helper: detect brand from empresa_vendedora
CREATE OR REPLACE FUNCTION public.brand_from_empresa_vendedora(_ev public.empresa_vendedora)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN _ev = 'lumaggs_chevron'::public.empresa_vendedora THEN 'chevron' ELSE 'phillips66' END
$$;

-- 3) Helper: company has sold units?
CREATE OR REPLACE FUNCTION public.company_has_sold_units(_empresa_id uuid, _ev public.empresa_vendedora)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.documentos d
    JOIN public.documento_productos dp ON dp.documento_id = d.id
    WHERE d.empresa_id = _empresa_id
      AND d.empresa_vendedora = _ev
      AND d.tipo_documento = 'factura'
      AND d.is_active = true
      AND COALESCE(d.estatus_factura::text, '') <> 'cancelada'
      AND COALESCE(dp.unidades_equivalentes, dp.cantidad, 0) > 0
  )
$$;

-- 4) Resolve / auto-create the negocio for a documento
CREATE OR REPLACE FUNCTION public.resolve_documento_negocio(
  _empresa_id uuid,
  _contacto_id uuid,
  _empresa_vendedora public.empresa_vendedora,
  _created_by uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

  -- Pick the matching pipeline for brand + type
  SELECT id INTO v_pipeline_id
  FROM public.crm_pipelines
  WHERE marca = v_brand AND pipeline_type = v_target_type
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_pipeline_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Try to find latest existing deal for this company in that pipeline
  SELECT id INTO v_deal_id
  FROM public.crm_deals
  WHERE company_id = _empresa_id
    AND pipeline_id = v_pipeline_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_deal_id IS NOT NULL THEN
    RETURN v_deal_id;
  END IF;

  -- Need to auto-create. Get company name + owner
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
    CASE WHEN v_has_units THEN 'recompra'::public.tipo_negocio ELSE 'prospecto'::public.tipo_negocio END,
    v_target_type,
    0, 10, CURRENT_DATE + 14,
    'Generado automáticamente al crear documento.'
  ) RETURNING id INTO v_deal_id;

  RETURN v_deal_id;
END;
$$;

-- 5) Trigger: auto-assign negocio_id on INSERT/UPDATE if empty
CREATE OR REPLACE FUNCTION public.documentos_auto_assign_negocio()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Only auto-assign when negocio_id is NULL (don't overwrite manual selection)
  IF NEW.negocio_id IS NULL AND NEW.empresa_id IS NOT NULL AND NEW.empresa_vendedora IS NOT NULL THEN
    NEW.negocio_id := public.resolve_documento_negocio(
      NEW.empresa_id, NEW.contacto_id, NEW.empresa_vendedora, COALESCE(NEW.created_by, auth.uid())
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_documentos_auto_assign_negocio ON public.documentos;
CREATE TRIGGER trg_documentos_auto_assign_negocio
BEFORE INSERT OR UPDATE OF empresa_id, empresa_vendedora, negocio_id ON public.documentos
FOR EACH ROW EXECUTE FUNCTION public.documentos_auto_assign_negocio();

-- 6) Backfill function for existing documentos without negocio_id
CREATE OR REPLACE FUNCTION public.backfill_documentos_negocio_id()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  rec record;
  v_deal uuid;
  v_count int := 0;
  v_skipped int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can run the backfill';
  END IF;
  FOR rec IN
    SELECT id, empresa_id, contacto_id, empresa_vendedora, created_by
    FROM public.documentos
    WHERE negocio_id IS NULL AND empresa_id IS NOT NULL AND empresa_vendedora IS NOT NULL
    ORDER BY fecha_documento ASC NULLS LAST, created_at ASC
  LOOP
    v_deal := public.resolve_documento_negocio(rec.empresa_id, rec.contacto_id, rec.empresa_vendedora, rec.created_by);
    IF v_deal IS NOT NULL THEN
      UPDATE public.documentos SET negocio_id = v_deal WHERE id = rec.id;
      v_count := v_count + 1;
    ELSE
      v_skipped := v_skipped + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('updated', v_count, 'skipped', v_skipped);
END;
$$;