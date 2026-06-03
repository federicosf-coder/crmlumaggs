ALTER TABLE public.crm_tasks
  ADD COLUMN IF NOT EXISTS seguimiento_venta_id uuid
  REFERENCES public.seguimiento_ventas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_crm_tasks_seguimiento ON public.crm_tasks(seguimiento_venta_id);

ALTER TABLE public.crm_activities
  ADD COLUMN IF NOT EXISTS seguimiento_venta_id uuid
  REFERENCES public.seguimiento_ventas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_crm_activities_seguimiento ON public.crm_activities(seguimiento_venta_id);

DO $$
DECLARE has_deal boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_tasks' AND column_name='deal_id') INTO has_deal;
  IF has_deal THEN
    EXECUTE $q$
      UPDATE public.crm_tasks t
      SET seguimiento_venta_id = sv.id
      FROM public.crm_deals d
      JOIN public.crm_pipelines p ON p.id = d.pipeline_id
      JOIN public.seguimiento_ventas sv
        ON sv.company_id = d.company_id
       AND sv.empresa_vendedora::text = CASE WHEN p.marca='chevron' THEN 'lumaggs' ELSE 'galsa' END
      WHERE t.deal_id = d.id AND t.seguimiento_venta_id IS NULL
    $q$;
  END IF;

  SELECT EXISTS(SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='crm_activities' AND column_name='deal_id') INTO has_deal;
  IF has_deal THEN
    EXECUTE $q$
      UPDATE public.crm_activities a
      SET seguimiento_venta_id = sv.id
      FROM public.crm_deals d
      JOIN public.crm_pipelines p ON p.id = d.pipeline_id
      JOIN public.seguimiento_ventas sv
        ON sv.company_id = d.company_id
       AND sv.empresa_vendedora::text = CASE WHEN p.marca='chevron' THEN 'lumaggs' ELSE 'galsa' END
      WHERE a.deal_id = d.id AND a.seguimiento_venta_id IS NULL
    $q$;
  END IF;
END $$;

UPDATE public.crm_tasks t
SET seguimiento_venta_id = sv.id
FROM public.seguimiento_ventas sv
WHERE t.seguimiento_venta_id IS NULL AND t.company_id IS NOT NULL
  AND sv.company_id = t.company_id
  AND (SELECT count(*) FROM public.seguimiento_ventas s2 WHERE s2.company_id = t.company_id) = 1;

UPDATE public.crm_activities a
SET seguimiento_venta_id = sv.id
FROM public.seguimiento_ventas sv
WHERE a.seguimiento_venta_id IS NULL AND a.company_id IS NOT NULL
  AND sv.company_id = a.company_id
  AND (SELECT count(*) FROM public.seguimiento_ventas s2 WHERE s2.company_id = a.company_id) = 1;

DO $$
DECLARE t_null int; a_null int;
BEGIN
  SELECT count(*) INTO t_null FROM public.crm_tasks WHERE seguimiento_venta_id IS NULL AND company_id IS NOT NULL;
  SELECT count(*) INTO a_null FROM public.crm_activities WHERE seguimiento_venta_id IS NULL AND company_id IS NOT NULL;
  RAISE NOTICE 'Sin enlazar -> tareas: %, actividades: %', t_null, a_null;
END $$;