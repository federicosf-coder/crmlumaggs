-- 1) Enum pipeline_type (primera_compra, recompra)
DO $$ BEGIN
  CREATE TYPE public.pipeline_type AS ENUM ('primera_compra', 'recompra');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Columna en crm_pipelines
ALTER TABLE public.crm_pipelines
  ADD COLUMN IF NOT EXISTS pipeline_type public.pipeline_type;

-- 3) Columna en crm_deals (denormalizada para filtros rápidos)
ALTER TABLE public.crm_deals
  ADD COLUMN IF NOT EXISTS pipeline_type public.pipeline_type;

-- 4) Crear los 4 pipelines canónicos si no existen (idempotente por marca+pipeline_type)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_crm_pipeline_marca_type
  ON public.crm_pipelines(marca, pipeline_type)
  WHERE pipeline_type IS NOT NULL;

-- Crear pipeline Primera Compra y Recompra para cada marca
DO $$
DECLARE
  v_pipeline_id uuid;
  v_marca text;
  v_type public.pipeline_type;
  v_nombre text;
  marcas text[] := ARRAY['chevron', 'phillips66'];
  types public.pipeline_type[] := ARRAY['primera_compra'::public.pipeline_type, 'recompra'::public.pipeline_type];
BEGIN
  FOREACH v_marca IN ARRAY marcas LOOP
    FOREACH v_type IN ARRAY types LOOP
      v_nombre := CASE
        WHEN v_marca = 'chevron' AND v_type = 'primera_compra' THEN 'Chevron · Primera Compra'
        WHEN v_marca = 'chevron' AND v_type = 'recompra' THEN 'Chevron · Recompra'
        WHEN v_marca = 'phillips66' AND v_type = 'primera_compra' THEN 'Phillips 66 · Primera Compra'
        ELSE 'Phillips 66 · Recompra'
      END;

      SELECT id INTO v_pipeline_id FROM public.crm_pipelines
        WHERE marca = v_marca AND pipeline_type = v_type LIMIT 1;

      IF v_pipeline_id IS NULL THEN
        INSERT INTO public.crm_pipelines (nombre, marca, pipeline_type)
        VALUES (v_nombre, v_marca, v_type)
        RETURNING id INTO v_pipeline_id;

        IF v_type = 'primera_compra' THEN
          INSERT INTO public.crm_pipeline_stages (pipeline_id, name, color, position) VALUES
            (v_pipeline_id, 'Lead generado', '#6b7280', 0),
            (v_pipeline_id, 'Contactado', '#3b82f6', 1),
            (v_pipeline_id, 'Diagnóstico', '#8b5cf6', 2),
            (v_pipeline_id, 'Cotización enviada', '#a855f7', 3),
            (v_pipeline_id, 'Seguimiento', '#f59e0b', 4),
            (v_pipeline_id, 'Cerrado ganado', '#10b981', 5),
            (v_pipeline_id, 'Cerrado perdido', '#ef4444', 6);
        ELSE
          INSERT INTO public.crm_pipeline_stages (pipeline_id, name, color, position) VALUES
            (v_pipeline_id, 'Recompra programada', '#6b7280', 0),
            (v_pipeline_id, 'Por contactar', '#3b82f6', 1),
            (v_pipeline_id, 'Cotización enviada', '#a855f7', 2),
            (v_pipeline_id, 'Seguimiento', '#f59e0b', 3),
            (v_pipeline_id, 'Pedido confirmado', '#06b6d4', 4),
            (v_pipeline_id, 'Cerrado ganado', '#10b981', 5),
            (v_pipeline_id, 'Cerrado perdido', '#ef4444', 6);
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- 5) Backfill pipeline_type en deals existentes según tipo_negocio
UPDATE public.crm_deals SET pipeline_type = 'recompra'
  WHERE pipeline_type IS NULL AND tipo_negocio = 'recompra';
UPDATE public.crm_deals SET pipeline_type = 'primera_compra'
  WHERE pipeline_type IS NULL AND tipo_negocio IN ('prospecto','expansion','otro');

-- 6) Migrar deals al pipeline correcto y mapear a etapas equivalentes
-- Mapeo: cada deal va al pipeline (marca, pipeline_type) y se asigna a una etapa por nombre normalizado.
WITH src AS (
  SELECT d.id AS deal_id, d.stage_id AS old_stage_id, d.pipeline_type, p.marca,
         lower(s.name) AS old_stage_name
  FROM public.crm_deals d
  JOIN public.crm_pipelines p ON p.id = d.pipeline_id
  LEFT JOIN public.crm_pipeline_stages s ON s.id = d.stage_id
), tgt AS (
  SELECT s.deal_id,
         np.id AS new_pipeline_id,
         (
           SELECT ns.id FROM public.crm_pipeline_stages ns
           WHERE ns.pipeline_id = np.id
             AND lower(ns.name) = CASE
               WHEN s.old_stage_name LIKE '%ganado%' THEN 'cerrado ganado'
               WHEN s.old_stage_name LIKE '%perdido%' THEN 'cerrado perdido'
               WHEN s.old_stage_name LIKE '%negociaci%' AND s.pipeline_type = 'primera_compra' THEN 'seguimiento'
               WHEN s.old_stage_name LIKE '%negociaci%' AND s.pipeline_type = 'recompra' THEN 'seguimiento'
               WHEN s.old_stage_name LIKE '%propuesta%' THEN 'cotización enviada'
               WHEN s.old_stage_name LIKE '%calificad%' AND s.pipeline_type = 'primera_compra' THEN 'diagnóstico'
               WHEN s.old_stage_name LIKE '%calificad%' AND s.pipeline_type = 'recompra' THEN 'por contactar'
               WHEN s.old_stage_name LIKE '%prospecto%' AND s.pipeline_type = 'primera_compra' THEN 'lead generado'
               WHEN s.old_stage_name LIKE '%prospecto%' AND s.pipeline_type = 'recompra' THEN 'recompra programada'
               ELSE CASE WHEN s.pipeline_type = 'primera_compra' THEN 'lead generado' ELSE 'recompra programada' END
             END
           LIMIT 1
         ) AS new_stage_id
  FROM src s
  JOIN public.crm_pipelines np ON np.marca = s.marca AND np.pipeline_type = s.pipeline_type
)
UPDATE public.crm_deals d
SET pipeline_id = t.new_pipeline_id,
    stage_id = COALESCE(t.new_stage_id, d.stage_id),
    updated_at = now()
FROM tgt t
WHERE d.id = t.deal_id;

-- 7) Hacer pipeline_type NOT NULL en deals (todos ya migrados)
ALTER TABLE public.crm_deals ALTER COLUMN pipeline_type SET NOT NULL;
ALTER TABLE public.crm_deals ALTER COLUMN pipeline_type SET DEFAULT 'primera_compra';

-- 8) Mantener pipeline_type sincronizado con su pipeline (trigger)
CREATE OR REPLACE FUNCTION public.sync_deal_pipeline_type()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_type public.pipeline_type;
BEGIN
  SELECT pipeline_type INTO v_type FROM public.crm_pipelines WHERE id = NEW.pipeline_id;
  IF v_type IS NOT NULL THEN
    NEW.pipeline_type := v_type;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_deal_pipeline_type ON public.crm_deals;
CREATE TRIGGER trg_sync_deal_pipeline_type
BEFORE INSERT OR UPDATE OF pipeline_id ON public.crm_deals
FOR EACH ROW EXECUTE FUNCTION public.sync_deal_pipeline_type();

-- 9) Actualizar trigger de recompra para usar el pipeline RECOMPRA específico
CREATE OR REPLACE FUNCTION public.trg_create_repurchase_opportunity()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pipeline_id uuid; v_stage_id uuid; v_owner uuid; v_existing uuid; v_existing_task uuid;
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

  v_pipeline_id := NULL; v_stage_id := NULL; v_owner := NULL; v_existing := NULL; v_existing_task := NULL;
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
END; $function$;

-- 10) Trigger crm_convert_prospect_on_won: detectar 'cerrado ganado' o 'ganado'
CREATE OR REPLACE FUNCTION public.crm_convert_prospect_on_won()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF (v_stage_name = 'ganado' OR v_stage_name = 'cerrado ganado') AND NEW.convertido_a_cliente = false THEN
    SELECT id INTO v_estatus_id
    FROM public.product_option_values
    WHERE option_type = 'estatus_cliente' AND lower(value) IN ('cliente_nuevo','cliente nuevo','cliente_activo','cliente activo')
    ORDER BY (lower(value) LIKE 'cliente_nuevo%') DESC
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
$function$;