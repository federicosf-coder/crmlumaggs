-- 1) Recreate trigger to save deal_id into auto-created tasks
CREATE OR REPLACE FUNCTION public.trg_create_repurchase_opportunity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pipeline_id uuid; v_stage_id uuid; v_owner uuid; v_existing uuid; v_existing_task uuid; v_deal_id uuid;
BEGIN
  -- Chevron RECOMPRA
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
          INSERT INTO public.crm_deals (title, pipeline_id, stage_id, company_id, owner_id, created_by, tipo_negocio, pipeline_type, value, probability, close_date, proxima_fecha_seguimiento, notes)
          VALUES ('Recompra · ' || NEW.name || ' · ' || INITCAP(NEW.estatus_recompra_chevron::text),
                  v_pipeline_id, v_stage_id, NEW.id, v_owner, v_owner, 'recompra', 'recompra',
                  COALESCE(NEW.ticket_promedio_chevron, 0), 60,
                  COALESCE(NEW.proxima_recompra_chevron, CURRENT_DATE + 14),
                  COALESCE(NEW.proxima_recompra_chevron, CURRENT_DATE + 7),
                  'Generado automáticamente. Estatus Chevron: ' || NEW.estatus_recompra_chevron::text)
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

  v_pipeline_id := NULL; v_stage_id := NULL; v_owner := NULL; v_existing := NULL; v_existing_task := NULL; v_deal_id := NULL;
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
          INSERT INTO public.crm_deals (title, pipeline_id, stage_id, company_id, owner_id, created_by, tipo_negocio, pipeline_type, value, probability, close_date, proxima_fecha_seguimiento, notes)
          VALUES ('Recompra · ' || NEW.name || ' · ' || INITCAP(NEW.estatus_recompra_phillips66::text),
                  v_pipeline_id, v_stage_id, NEW.id, v_owner, v_owner, 'recompra', 'recompra',
                  COALESCE(NEW.ticket_promedio_phillips66, 0), 60,
                  COALESCE(NEW.proxima_recompra_phillips66, CURRENT_DATE + 14),
                  COALESCE(NEW.proxima_recompra_phillips66, CURRENT_DATE + 7),
                  'Generado automáticamente. Estatus Phillips66: ' || NEW.estatus_recompra_phillips66::text)
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

-- 2) Backfill: link existing auto tasks without deal_id to matching active deals
WITH candidates AS (
  SELECT t.id AS task_id,
         (
           SELECT d.id FROM public.crm_deals d
           WHERE d.company_id = t.company_id
             AND d.convertido_a_cliente = false
             AND (
               (t.title ILIKE 'Recompra%' AND d.pipeline_type = 'recompra')
               OR ((t.title ILIKE '%Primera Compra%' OR t.title ILIKE '%Prospecto%') AND d.pipeline_type = 'primera_compra')
             )
             AND (d.owner_id = t.user_id OR d.created_by = t.user_id OR TRUE)
           ORDER BY
             CASE WHEN d.owner_id = t.user_id THEN 0 ELSE 1 END,
             d.created_at DESC
           LIMIT 1
         ) AS deal_id
  FROM public.crm_tasks t
  WHERE t.deal_id IS NULL
    AND t.company_id IS NOT NULL
    AND (t.title ILIKE 'Recompra%' OR t.title ILIKE '%Primera Compra%' OR t.title ILIKE '%Prospecto%')
)
UPDATE public.crm_tasks t
SET deal_id = c.deal_id
FROM candidates c
WHERE t.id = c.task_id AND c.deal_id IS NOT NULL;