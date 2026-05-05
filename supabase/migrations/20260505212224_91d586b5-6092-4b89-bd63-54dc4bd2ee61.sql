
DROP FUNCTION IF EXISTS public.get_company_metrics(uuid, text);

CREATE OR REPLACE FUNCTION public.get_company_metrics(_company_id uuid, _marca text DEFAULT NULL)
RETURNS TABLE(
  marca_label           text,
  total_unidades        numeric,
  promedio_mensual_unidades numeric,
  total_subtotal        numeric,
  promedio_mensual_subtotal numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH base AS (
    SELECT
      CASE
        WHEN lower(empresa_vendedora::text) IN ('lumaggs','lumaggs sa de cv') THEN 'chevron'
        WHEN lower(empresa_vendedora::text) IN ('galsa','galsa sa de cv') THEN 'phillips66'
        ELSE lower(empresa_vendedora::text)
      END AS marca_key,
      date_trunc('month', fecha_documento) AS mes,
      COALESCE(unidades_equivalentes_total, 0) AS uds,
      COALESCE(subtotal, total / 1.16, 0)      AS sub
    FROM public.documentos
    WHERE empresa_id = _company_id
      AND tipo_documento = 'factura'
      AND COALESCE(estatus_factura::text, '') <> 'cancelada'
      AND (_marca IS NULL
           OR CASE
                WHEN lower(_marca) IN ('chevron','lumaggs') THEN lower(empresa_vendedora::text) IN ('lumaggs','lumaggs sa de cv')
                WHEN lower(_marca) IN ('phillips66','galsa') THEN lower(empresa_vendedora::text) IN ('galsa','galsa sa de cv')
                ELSE true
              END)
  ),
  por_mes AS (
    SELECT marca_key, mes,
           SUM(uds) AS uds_mes,
           SUM(sub) AS sub_mes
    FROM base
    GROUP BY marca_key, mes
  ),
  agg AS (
    SELECT marca_key,
           COALESCE(SUM(uds_mes), 0)  AS s_total_uds,
           COALESCE(AVG(uds_mes), 0)  AS s_avg_uds,
           COALESCE(SUM(sub_mes), 0)  AS s_total_sub,
           COALESCE(AVG(sub_mes), 0)  AS s_avg_sub
    FROM por_mes
    GROUP BY marca_key
  )
  SELECT
    CASE agg.marca_key
      WHEN 'chevron'    THEN 'Chevron'
      WHEN 'phillips66' THEN 'Phillips 66'
      ELSE agg.marca_key
    END,
    agg.s_total_uds,
    agg.s_avg_uds,
    agg.s_total_sub,
    agg.s_avg_sub
  FROM agg
  WHERE _marca IS NULL
     OR (lower(_marca) IN ('chevron','lumaggs') AND agg.marca_key = 'chevron')
     OR (lower(_marca) IN ('phillips66','galsa')  AND agg.marca_key = 'phillips66');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_company_metrics(uuid, text) TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION public.get_company_saldo_vencido(_company_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(saldo_pendiente_cobranza), 0)
  FROM public.documentos
  WHERE empresa_id = _company_id
    AND tipo_documento = 'factura'
    AND estado_cobranza = 'vencida'
    AND saldo_pendiente_cobranza > 0
    AND COALESCE(estatus_factura::text, '') <> 'cancelada';
$$;

GRANT EXECUTE ON FUNCTION public.get_company_saldo_vencido(uuid) TO authenticated, anon, service_role;

UPDATE public.crm_deals d
SET potencial_unidades = (
  SELECT promedio_mensual_unidades
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
