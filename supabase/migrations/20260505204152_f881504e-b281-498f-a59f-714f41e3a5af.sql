UPDATE public.crm_deals d
SET potencial_unidades = sub.prom,
    updated_at = now()
FROM (
  SELECT d2.id AS deal_id, m.promedio_mensual_unidades AS prom
  FROM public.crm_deals d2
  JOIN public.crm_pipelines p ON p.id = d2.pipeline_id
  CROSS JOIN LATERAL public.get_company_metrics(d2.company_id, p.marca) m
  WHERE d2.pipeline_type = 'recompra'
    AND d2.company_id IS NOT NULL
) sub
WHERE d.id = sub.deal_id
  AND sub.prom > 0;