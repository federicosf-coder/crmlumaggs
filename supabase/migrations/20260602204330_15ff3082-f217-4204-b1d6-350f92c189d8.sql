CREATE OR REPLACE FUNCTION public.resolve_documento_negocio(
  _empresa_id uuid, _contacto_id uuid, _empresa_vendedora public.empresa_vendedora, _created_by uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE v_deal_id uuid;
BEGIN
  IF _empresa_id IS NULL OR _empresa_vendedora IS NULL THEN RETURN NULL; END IF;
  SELECT d.id INTO v_deal_id
  FROM public.crm_deals d
  JOIN public.crm_pipelines p ON p.id = d.pipeline_id
  WHERE d.company_id = _empresa_id
    AND p.marca = public.brand_from_empresa_vendedora(_empresa_vendedora)
  ORDER BY d.created_at DESC LIMIT 1;
  RETURN v_deal_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_or_create_deal_recompra_mes(
  p_company_id uuid, p_marca text, p_mes text DEFAULT to_char(now(),'YYYY-MM')
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_create_repurchase_opportunity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.crm_convert_prospect_on_won()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  RETURN NEW;
END;
$function$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='documentos' AND column_name='negocio_id' AND is_nullable='NO') THEN
    EXECUTE 'ALTER TABLE public.documentos ALTER COLUMN negocio_id DROP NOT NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='documentos' AND column_name='deal_id' AND is_nullable='NO') THEN
    EXECUTE 'ALTER TABLE public.documentos ALTER COLUMN deal_id DROP NOT NULL';
  END IF;
END $$;