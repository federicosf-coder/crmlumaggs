-- ============================================================
-- 1) Extender enum product_option_type con nuevos catálogos CRM
-- ============================================================
ALTER TYPE public.product_option_type ADD VALUE IF NOT EXISTS 'estatus_cliente';
ALTER TYPE public.product_option_type ADD VALUE IF NOT EXISTS 'prioridad_cliente';
ALTER TYPE public.product_option_type ADD VALUE IF NOT EXISTS 'segmento_cliente';
ALTER TYPE public.product_option_type ADD VALUE IF NOT EXISTS 'tipo_cliente';
ALTER TYPE public.product_option_type ADD VALUE IF NOT EXISTS 'contacto_rol';
ALTER TYPE public.product_option_type ADD VALUE IF NOT EXISTS 'contacto_influencia';
ALTER TYPE public.product_option_type ADD VALUE IF NOT EXISTS 'origen_prospecto';
ALTER TYPE public.product_option_type ADD VALUE IF NOT EXISTS 'motivo_perdida';

-- ============================================================
-- 2) Enum nuevo para tipo de negocio del deal
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.tipo_negocio_crm AS ENUM ('prospecto','expansion','recompra','otro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 3) Extender crm_deals
-- ============================================================
ALTER TABLE public.crm_deals
  ADD COLUMN IF NOT EXISTS tipo_negocio public.tipo_negocio_crm NOT NULL DEFAULT 'prospecto',
  ADD COLUMN IF NOT EXISTS origen_prospecto_id uuid REFERENCES public.product_option_values(id),
  ADD COLUMN IF NOT EXISTS motivo_perdida_id uuid REFERENCES public.product_option_values(id),
  ADD COLUMN IF NOT EXISTS categoria_interes_id uuid REFERENCES public.product_option_values(id),
  ADD COLUMN IF NOT EXISTS volumen_mensual_estimado numeric,
  ADD COLUMN IF NOT EXISTS proxima_fecha_seguimiento date,
  ADD COLUMN IF NOT EXISTS convertido_a_cliente boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fecha_conversion timestamptz;

CREATE INDEX IF NOT EXISTS idx_crm_deals_tipo_negocio ON public.crm_deals(tipo_negocio);
CREATE INDEX IF NOT EXISTS idx_crm_deals_proxima_seg ON public.crm_deals(proxima_fecha_seguimiento);

-- ============================================================
-- 4) Extender companies con campos comerciales
-- ============================================================
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS estatus_cliente_id uuid REFERENCES public.product_option_values(id),
  ADD COLUMN IF NOT EXISTS prioridad_cliente_id uuid REFERENCES public.product_option_values(id),
  ADD COLUMN IF NOT EXISTS segmento_id uuid REFERENCES public.product_option_values(id),
  ADD COLUMN IF NOT EXISTS tipo_cliente_id uuid REFERENCES public.product_option_values(id),
  ADD COLUMN IF NOT EXISTS fecha_ultima_compra date,
  ADD COLUMN IF NOT EXISTS frecuencia_compra_dias integer,
  ADD COLUMN IF NOT EXISTS ticket_promedio numeric,
  ADD COLUMN IF NOT EXISTS volumen_mensual_estimado numeric,
  ADD COLUMN IF NOT EXISTS customer_score integer,
  ADD COLUMN IF NOT EXISTS fecha_conversion_cliente timestamptz;

CREATE INDEX IF NOT EXISTS idx_companies_estatus_cliente ON public.companies(estatus_cliente_id);
CREATE INDEX IF NOT EXISTS idx_companies_prioridad ON public.companies(prioridad_cliente_id);

-- ============================================================
-- 5) Extender contacts
-- ============================================================
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS rol_id uuid REFERENCES public.product_option_values(id),
  ADD COLUMN IF NOT EXISTS influencia_id uuid REFERENCES public.product_option_values(id);

-- ============================================================
-- 6) Trigger: cuando un deal de tipo prospecto pasa a etapa "Ganado"
--    -> marca empresa como cliente_nuevo y registra conversión
-- ============================================================
CREATE OR REPLACE FUNCTION public.crm_convert_prospect_on_won()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stage_name text;
  v_estatus_id uuid;
BEGIN
  IF NEW.tipo_negocio <> 'prospecto' OR NEW.company_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.stage_id IS NOT DISTINCT FROM OLD.stage_id THEN
    RETURN NEW;
  END IF;

  SELECT lower(name) INTO v_stage_name
  FROM public.crm_pipeline_stages WHERE id = NEW.stage_id;

  IF v_stage_name = 'ganado' AND NEW.convertido_a_cliente = false THEN
    SELECT id INTO v_estatus_id
    FROM public.product_option_values
    WHERE option_type = 'estatus_cliente' AND lower(value) = 'cliente_nuevo'
    LIMIT 1;

    UPDATE public.companies
    SET estatus_cliente_id = COALESCE(v_estatus_id, estatus_cliente_id),
        fecha_conversion_cliente = COALESCE(fecha_conversion_cliente, now()),
        updated_at = now()
    WHERE id = NEW.company_id;

    NEW.convertido_a_cliente := true;
    NEW.fecha_conversion := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_convert_prospect_on_won ON public.crm_deals;
CREATE TRIGGER trg_crm_convert_prospect_on_won
BEFORE INSERT OR UPDATE ON public.crm_deals
FOR EACH ROW EXECUTE FUNCTION public.crm_convert_prospect_on_won();