-- 1. Enum
DO $$ BEGIN
  CREATE TYPE public.estatus_recompra AS ENUM ('al_dia', 'proximo', 'vencido', 'en_riesgo', 'dormido', 'sin_historial');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Campos en companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS fecha_ultima_compra_chevron date,
  ADD COLUMN IF NOT EXISTS fecha_ultima_compra_phillips66 date,
  ADD COLUMN IF NOT EXISTS frecuencia_compra_chevron_dias integer,
  ADD COLUMN IF NOT EXISTS frecuencia_compra_phillips66_dias integer,
  ADD COLUMN IF NOT EXISTS ticket_promedio_chevron numeric,
  ADD COLUMN IF NOT EXISTS ticket_promedio_phillips66 numeric,
  ADD COLUMN IF NOT EXISTS proxima_recompra_chevron date,
  ADD COLUMN IF NOT EXISTS proxima_recompra_phillips66 date,
  ADD COLUMN IF NOT EXISTS estatus_recompra_chevron public.estatus_recompra DEFAULT 'sin_historial',
  ADD COLUMN IF NOT EXISTS estatus_recompra_phillips66 public.estatus_recompra DEFAULT 'sin_historial',
  ADD COLUMN IF NOT EXISTS total_facturas_chevron integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_facturas_phillips66 integer DEFAULT 0;

-- 3. Snapshot table
CREATE TABLE IF NOT EXISTS public.customer_repurchase_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  empresa_vendedora public.empresa_vendedora NOT NULL,
  fecha_ultima_compra date,
  frecuencia_dias integer,
  ticket_promedio numeric,
  total_facturas integer DEFAULT 0,
  proxima_recompra date,
  estatus public.estatus_recompra,
  calculado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, empresa_vendedora)
);

ALTER TABLE public.customer_repurchase_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view repurchase metrics" ON public.customer_repurchase_metrics;
CREATE POLICY "Authenticated can view repurchase metrics" ON public.customer_repurchase_metrics FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage repurchase metrics" ON public.customer_repurchase_metrics;
CREATE POLICY "Admins manage repurchase metrics" ON public.customer_repurchase_metrics FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Managers manage repurchase metrics" ON public.customer_repurchase_metrics;
CREATE POLICY "Managers manage repurchase metrics" ON public.customer_repurchase_metrics FOR ALL USING (has_role(auth.uid(), 'manager'::app_role));
DROP POLICY IF EXISTS "Sales manage repurchase metrics" ON public.customer_repurchase_metrics;
CREATE POLICY "Sales manage repurchase metrics" ON public.customer_repurchase_metrics FOR ALL USING (has_role(auth.uid(), 'sales'::app_role));

CREATE INDEX IF NOT EXISTS idx_repurchase_metrics_empresa ON public.customer_repurchase_metrics(empresa_id, empresa_vendedora);
CREATE INDEX IF NOT EXISTS idx_companies_proxima_chevron ON public.companies(proxima_recompra_chevron) WHERE proxima_recompra_chevron IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_companies_proxima_phillips66 ON public.companies(proxima_recompra_phillips66) WHERE proxima_recompra_phillips66 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documentos_empresa_vendedora_factura ON public.documentos(empresa_id, empresa_vendedora, tipo_documento, fecha_documento) WHERE tipo_documento = 'factura';

-- 4. Recalc function
CREATE OR REPLACE FUNCTION public.recalc_repurchase_for_company(_empresa_id uuid, _empresa_vendedora public.empresa_vendedora)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_last_date date; v_total int; v_ticket numeric; v_frecuencia int;
  v_proxima date; v_estatus public.estatus_recompra; v_dias_desde int;
  v_is_chevron boolean := (_empresa_vendedora = 'lumaggs_chevron'::public.empresa_vendedora);
BEGIN
  SELECT MAX(fecha_documento), COUNT(*), AVG(total) INTO v_last_date, v_total, v_ticket
  FROM public.documentos
  WHERE empresa_id = _empresa_id AND empresa_vendedora = _empresa_vendedora
    AND tipo_documento = 'factura' AND is_active = true
    AND COALESCE(estatus_factura::text, '') <> 'cancelada';

  IF v_last_date IS NULL OR v_total = 0 THEN
    IF v_is_chevron THEN
      UPDATE public.companies SET fecha_ultima_compra_chevron=NULL, frecuencia_compra_chevron_dias=NULL,
        ticket_promedio_chevron=NULL, proxima_recompra_chevron=NULL, estatus_recompra_chevron='sin_historial', total_facturas_chevron=0
      WHERE id = _empresa_id;
    ELSE
      UPDATE public.companies SET fecha_ultima_compra_phillips66=NULL, frecuencia_compra_phillips66_dias=NULL,
        ticket_promedio_phillips66=NULL, proxima_recompra_phillips66=NULL, estatus_recompra_phillips66='sin_historial', total_facturas_phillips66=0
      WHERE id = _empresa_id;
    END IF;
    RETURN;
  END IF;

  IF v_total >= 2 THEN
    SELECT GREATEST(1, ROUND(AVG(dias_entre))::int) INTO v_frecuencia FROM (
      SELECT EXTRACT(DAY FROM (fecha_documento::timestamp - LAG(fecha_documento::timestamp) OVER (ORDER BY fecha_documento)))::int AS dias_entre
      FROM public.documentos
      WHERE empresa_id = _empresa_id AND empresa_vendedora = _empresa_vendedora
        AND tipo_documento = 'factura' AND is_active = true
        AND COALESCE(estatus_factura::text, '') <> 'cancelada'
    ) t WHERE dias_entre IS NOT NULL AND dias_entre > 0;
  ELSE
    v_frecuencia := NULL;
  END IF;

  IF v_frecuencia IS NOT NULL THEN
    v_proxima := v_last_date + (v_frecuencia || ' days')::interval;
    v_dias_desde := (CURRENT_DATE - v_last_date)::int;
    IF v_dias_desde >= v_frecuencia * 2 THEN v_estatus := 'dormido';
    ELSIF v_dias_desde >= ROUND(v_frecuencia * 1.5) THEN v_estatus := 'en_riesgo';
    ELSIF v_dias_desde > v_frecuencia THEN v_estatus := 'vencido';
    ELSIF (v_proxima - CURRENT_DATE) <= 7 THEN v_estatus := 'proximo';
    ELSE v_estatus := 'al_dia';
    END IF;
  ELSE
    v_proxima := NULL; v_estatus := 'al_dia';
  END IF;

  IF v_is_chevron THEN
    UPDATE public.companies SET fecha_ultima_compra_chevron=v_last_date, frecuencia_compra_chevron_dias=v_frecuencia,
      ticket_promedio_chevron=v_ticket, proxima_recompra_chevron=v_proxima, estatus_recompra_chevron=v_estatus, total_facturas_chevron=v_total
    WHERE id = _empresa_id;
  ELSE
    UPDATE public.companies SET fecha_ultima_compra_phillips66=v_last_date, frecuencia_compra_phillips66_dias=v_frecuencia,
      ticket_promedio_phillips66=v_ticket, proxima_recompra_phillips66=v_proxima, estatus_recompra_phillips66=v_estatus, total_facturas_phillips66=v_total
    WHERE id = _empresa_id;
  END IF;

  INSERT INTO public.customer_repurchase_metrics (empresa_id, empresa_vendedora, fecha_ultima_compra, frecuencia_dias, ticket_promedio, total_facturas, proxima_recompra, estatus)
  VALUES (_empresa_id, _empresa_vendedora, v_last_date, v_frecuencia, v_ticket, v_total, v_proxima, v_estatus)
  ON CONFLICT (empresa_id, empresa_vendedora) DO UPDATE SET
    fecha_ultima_compra=EXCLUDED.fecha_ultima_compra, frecuencia_dias=EXCLUDED.frecuencia_dias,
    ticket_promedio=EXCLUDED.ticket_promedio, total_facturas=EXCLUDED.total_facturas,
    proxima_recompra=EXCLUDED.proxima_recompra, estatus=EXCLUDED.estatus, calculado_en=now();
END; $$;

-- 5. Trigger documentos
CREATE OR REPLACE FUNCTION public.trg_recalc_repurchase_on_documento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.tipo_documento = 'factura' AND OLD.empresa_id IS NOT NULL THEN
      PERFORM public.recalc_repurchase_for_company(OLD.empresa_id, OLD.empresa_vendedora);
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.tipo_documento = 'factura' AND NEW.empresa_id IS NOT NULL THEN
    PERFORM public.recalc_repurchase_for_company(NEW.empresa_id, NEW.empresa_vendedora);
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.empresa_id IS NOT NULL AND OLD.tipo_documento = 'factura' AND
     (OLD.empresa_id IS DISTINCT FROM NEW.empresa_id OR OLD.empresa_vendedora IS DISTINCT FROM NEW.empresa_vendedora) THEN
    PERFORM public.recalc_repurchase_for_company(OLD.empresa_id, OLD.empresa_vendedora);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS recalc_repurchase_on_documento ON public.documentos;
CREATE TRIGGER recalc_repurchase_on_documento
AFTER INSERT OR UPDATE OF fecha_documento, total, empresa_id, empresa_vendedora, tipo_documento, estatus_factura, is_active OR DELETE
ON public.documentos FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_repurchase_on_documento();

-- 6. Trigger oportunidad recompra
CREATE OR REPLACE FUNCTION public.trg_create_repurchase_opportunity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pipeline_id uuid; v_stage_id uuid; v_owner uuid; v_existing uuid; v_existing_task uuid;
BEGIN
  -- Chevron
  IF NEW.estatus_recompra_chevron IS DISTINCT FROM OLD.estatus_recompra_chevron
     AND NEW.estatus_recompra_chevron IN ('proximo','vencido','en_riesgo','dormido') THEN
    SELECT id INTO v_pipeline_id FROM public.crm_pipelines WHERE marca = 'chevron' LIMIT 1;
    IF v_pipeline_id IS NOT NULL THEN
      SELECT id INTO v_stage_id FROM public.crm_pipeline_stages WHERE pipeline_id = v_pipeline_id ORDER BY position ASC LIMIT 1;
      SELECT user_id INTO v_owner FROM public.company_ejecutivos WHERE company_id = NEW.id LIMIT 1;
      IF v_owner IS NULL THEN v_owner := NEW.created_by; END IF;
      IF v_owner IS NOT NULL AND v_stage_id IS NOT NULL THEN
        SELECT id INTO v_existing FROM public.crm_deals
          WHERE company_id = NEW.id AND pipeline_id = v_pipeline_id
            AND tipo_negocio = 'recompra' AND convertido_a_cliente = false LIMIT 1;
        IF v_existing IS NULL THEN
          INSERT INTO public.crm_deals (title, pipeline_id, stage_id, company_id, owner_id, created_by, tipo_negocio, value, probability, close_date, proxima_fecha_seguimiento, notes)
          VALUES ('Recompra · ' || NEW.name || ' · ' || INITCAP(NEW.estatus_recompra_chevron::text),
                  v_pipeline_id, v_stage_id, NEW.id, v_owner, v_owner, 'recompra',
                  COALESCE(NEW.ticket_promedio_chevron, 0), 60,
                  COALESCE(NEW.proxima_recompra_chevron, CURRENT_DATE + 14),
                  COALESCE(NEW.proxima_recompra_chevron, CURRENT_DATE + 7),
                  'Generado automáticamente. Estatus Chevron: ' || NEW.estatus_recompra_chevron::text);
        END IF;
        SELECT id INTO v_existing_task FROM public.crm_tasks
          WHERE company_id = NEW.id AND completed = false AND title LIKE 'Recompra · %' LIMIT 1;
        IF v_existing_task IS NULL THEN
          INSERT INTO public.crm_tasks (user_id, title, description, due_date, priority, company_id)
          VALUES (v_owner,
                  'Recompra · ' || NEW.name || ' (' || NEW.estatus_recompra_chevron::text || ')',
                  'Cliente Chevron en estatus ' || NEW.estatus_recompra_chevron::text || '. Última compra: ' || COALESCE(NEW.fecha_ultima_compra_chevron::text, 'sin registro'),
                  COALESCE(NEW.proxima_recompra_chevron::timestamptz, now() + interval '3 days'),
                  CASE WHEN NEW.estatus_recompra_chevron IN ('en_riesgo','dormido') THEN 'high' ELSE 'medium' END,
                  NEW.id);
        END IF;
      END IF;
    END IF;
  END IF;

  -- Phillips66
  v_pipeline_id := NULL; v_stage_id := NULL; v_owner := NULL; v_existing := NULL; v_existing_task := NULL;
  IF NEW.estatus_recompra_phillips66 IS DISTINCT FROM OLD.estatus_recompra_phillips66
     AND NEW.estatus_recompra_phillips66 IN ('proximo','vencido','en_riesgo','dormido') THEN
    SELECT id INTO v_pipeline_id FROM public.crm_pipelines WHERE marca = 'phillips66' LIMIT 1;
    IF v_pipeline_id IS NOT NULL THEN
      SELECT id INTO v_stage_id FROM public.crm_pipeline_stages WHERE pipeline_id = v_pipeline_id ORDER BY position ASC LIMIT 1;
      SELECT user_id INTO v_owner FROM public.company_ejecutivos WHERE company_id = NEW.id LIMIT 1;
      IF v_owner IS NULL THEN v_owner := NEW.created_by; END IF;
      IF v_owner IS NOT NULL AND v_stage_id IS NOT NULL THEN
        SELECT id INTO v_existing FROM public.crm_deals
          WHERE company_id = NEW.id AND pipeline_id = v_pipeline_id
            AND tipo_negocio = 'recompra' AND convertido_a_cliente = false LIMIT 1;
        IF v_existing IS NULL THEN
          INSERT INTO public.crm_deals (title, pipeline_id, stage_id, company_id, owner_id, created_by, tipo_negocio, value, probability, close_date, proxima_fecha_seguimiento, notes)
          VALUES ('Recompra · ' || NEW.name || ' · ' || INITCAP(NEW.estatus_recompra_phillips66::text),
                  v_pipeline_id, v_stage_id, NEW.id, v_owner, v_owner, 'recompra',
                  COALESCE(NEW.ticket_promedio_phillips66, 0), 60,
                  COALESCE(NEW.proxima_recompra_phillips66, CURRENT_DATE + 14),
                  COALESCE(NEW.proxima_recompra_phillips66, CURRENT_DATE + 7),
                  'Generado automáticamente. Estatus Phillips66: ' || NEW.estatus_recompra_phillips66::text);
        END IF;
        SELECT id INTO v_existing_task FROM public.crm_tasks
          WHERE company_id = NEW.id AND completed = false AND title LIKE 'Recompra · %' LIMIT 1;
        IF v_existing_task IS NULL THEN
          INSERT INTO public.crm_tasks (user_id, title, description, due_date, priority, company_id)
          VALUES (v_owner,
                  'Recompra · ' || NEW.name || ' (' || NEW.estatus_recompra_phillips66::text || ')',
                  'Cliente Phillips66 en estatus ' || NEW.estatus_recompra_phillips66::text || '. Última compra: ' || COALESCE(NEW.fecha_ultima_compra_phillips66::text, 'sin registro'),
                  COALESCE(NEW.proxima_recompra_phillips66::timestamptz, now() + interval '3 days'),
                  CASE WHEN NEW.estatus_recompra_phillips66 IN ('en_riesgo','dormido') THEN 'high' ELSE 'medium' END,
                  NEW.id);
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS create_repurchase_opportunity ON public.companies;
CREATE TRIGGER create_repurchase_opportunity
AFTER UPDATE OF estatus_recompra_chevron, estatus_recompra_phillips66 ON public.companies
FOR EACH ROW EXECUTE FUNCTION public.trg_create_repurchase_opportunity();

-- 7. Backfill
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT empresa_id, empresa_vendedora FROM public.documentos
    WHERE tipo_documento = 'factura' AND empresa_id IS NOT NULL AND is_active = true
  LOOP
    PERFORM public.recalc_repurchase_for_company(r.empresa_id, r.empresa_vendedora);
  END LOOP;
END $$;