-- ============================================================
-- CRM Recompra: nuevas etapas, mes_negocio, columnas de unidades
-- y constraint 1 deal por (empresa, marca, mes)
-- ============================================================

-- 1) Nuevas columnas en crm_deals
ALTER TABLE public.crm_deals
  ADD COLUMN IF NOT EXISTS mes_negocio text,
  ADD COLUMN IF NOT EXISTS cotizado_unidades numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pedido_unidades numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS facturado_unidades numeric NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_crm_deals_mes_negocio ON public.crm_deals(mes_negocio);
CREATE INDEX IF NOT EXISTS idx_crm_deals_pipeline_type_mes ON public.crm_deals(pipeline_type, mes_negocio);

-- Backfill mes_negocio para recompras existentes (YYYY-MM por created_at)
UPDATE public.crm_deals
   SET mes_negocio = to_char(created_at, 'YYYY-MM')
 WHERE pipeline_type = 'recompra'
   AND mes_negocio IS NULL;

-- 2) Resolver duplicados (misma empresa+marca+mes en recompra): conservar el más reciente
WITH ranked AS (
  SELECT d.id,
         row_number() OVER (
           PARTITION BY d.company_id, p.marca, d.mes_negocio
           ORDER BY d.updated_at DESC, d.created_at DESC
         ) as rn
  FROM public.crm_deals d
  JOIN public.crm_pipelines p ON p.id = d.pipeline_id
  WHERE d.pipeline_type = 'recompra'
    AND d.company_id IS NOT NULL
    AND d.mes_negocio IS NOT NULL
)
UPDATE public.crm_deals d
   SET mes_negocio = mes_negocio || '-dup-' || substr(d.id::text, 1, 8)
  FROM ranked r
 WHERE d.id = r.id AND r.rn > 1;

-- 3) Mapear etapas existentes a nuevas etapas para ambos pipelines de recompra
DO $$
DECLARE
  pipe RECORD;
  v_inicio uuid;
  v_porcomprar uuid;
  v_cotnego uuid;
  v_pedidoproc uuid;
  v_compraparcial uuid;
  v_comprascerradas uuid;
  v_perdido uuid;
BEGIN
  FOR pipe IN SELECT id FROM public.crm_pipelines WHERE pipeline_type = 'recompra' LOOP

    -- Renombrar las etapas existentes según el mapeo
    UPDATE public.crm_pipeline_stages SET name='Inicio',                color='#6b7280', position=0 WHERE pipeline_id=pipe.id AND name='Recompra programada';
    UPDATE public.crm_pipeline_stages SET name='Por Comprar',           color='#3b82f6', position=1 WHERE pipeline_id=pipe.id AND name='Por contactar';
    UPDATE public.crm_pipeline_stages SET name='Cotización / Negociación', color='#a855f7', position=2 WHERE pipeline_id=pipe.id AND name='Cotización enviada';
    UPDATE public.crm_pipeline_stages SET name='Pedido en Proceso',    color='#06b6d4', position=3 WHERE pipeline_id=pipe.id AND name='Pedido confirmado';
    UPDATE public.crm_pipeline_stages SET name='Compras Cerradas',     color='#10b981', position=5 WHERE pipeline_id=pipe.id AND name='Cerrado ganado';
    UPDATE public.crm_pipeline_stages SET name='Perdido',              color='#ef4444', position=6 WHERE pipeline_id=pipe.id AND name='Cerrado perdido';

    -- "Seguimiento" se fusiona con "Cotización / Negociación": mover deals y borrar
    SELECT id INTO v_cotnego FROM public.crm_pipeline_stages
      WHERE pipeline_id=pipe.id AND name='Cotización / Negociación' LIMIT 1;
    IF v_cotnego IS NOT NULL THEN
      UPDATE public.crm_deals d SET stage_id = v_cotnego
        FROM public.crm_pipeline_stages s
       WHERE d.stage_id = s.id AND s.pipeline_id = pipe.id AND s.name = 'Seguimiento';
      DELETE FROM public.crm_pipeline_stages WHERE pipeline_id=pipe.id AND name='Seguimiento';
    END IF;

    -- Insertar "Compra Parcial" en posición 4 si no existe
    IF NOT EXISTS (SELECT 1 FROM public.crm_pipeline_stages WHERE pipeline_id=pipe.id AND name='Compra Parcial') THEN
      INSERT INTO public.crm_pipeline_stages(pipeline_id, name, color, position)
      VALUES (pipe.id, 'Compra Parcial', '#f59e0b', 4);
    END IF;

  END LOOP;
END $$;

-- 4) Constraint único: 1 deal de recompra por empresa, marca y mes
-- Usamos un índice único parcial sobre (company_id, pipeline_id, mes_negocio)
-- con pipeline_type = 'recompra'
CREATE UNIQUE INDEX IF NOT EXISTS uq_crm_deals_recompra_mes
  ON public.crm_deals(company_id, pipeline_id, mes_negocio)
  WHERE pipeline_type = 'recompra' AND company_id IS NOT NULL AND mes_negocio IS NOT NULL;

-- 5) Función: get_or_create_deal_recompra_mes
-- Devuelve (crea si no existe) el deal de recompra de la empresa+marca para un mes dado
CREATE OR REPLACE FUNCTION public.get_or_create_deal_recompra_mes(
  p_company_id uuid,
  p_marca text,
  p_mes text DEFAULT to_char(now(), 'YYYY-MM')
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pipeline_id uuid;
  v_stage_id uuid;
  v_deal_id uuid;
  v_company_name text;
  v_owner uuid;
  v_potencial numeric;
  v_mes_label text;
BEGIN
  IF p_company_id IS NULL OR p_marca IS NULL OR p_mes IS NULL THEN
    RETURN NULL;
  END IF;

  -- Buscar deal existente
  SELECT d.id INTO v_deal_id
    FROM public.crm_deals d
    JOIN public.crm_pipelines p ON p.id = d.pipeline_id
   WHERE d.company_id = p_company_id
     AND p.marca = p_marca
     AND d.pipeline_type = 'recompra'
     AND d.mes_negocio = p_mes
   LIMIT 1;

  IF v_deal_id IS NOT NULL THEN
    RETURN v_deal_id;
  END IF;

  -- Pipeline de recompra para esa marca
  SELECT id INTO v_pipeline_id
    FROM public.crm_pipelines
   WHERE marca = p_marca AND pipeline_type = 'recompra'
   LIMIT 1;

  IF v_pipeline_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Primera etapa (Inicio)
  SELECT id INTO v_stage_id
    FROM public.crm_pipeline_stages
   WHERE pipeline_id = v_pipeline_id
   ORDER BY position ASC
   LIMIT 1;

  -- Datos auxiliares
  SELECT name INTO v_company_name FROM public.companies WHERE id = p_company_id;
  v_mes_label := to_char(to_date(p_mes || '-01', 'YYYY-MM-DD'), 'TMMonth YYYY');

  -- Último ejecutivo asignado (preferimos el del último deal de recompra de la empresa+marca)
  SELECT d.owner_id INTO v_owner
    FROM public.crm_deals d
    JOIN public.crm_pipelines p ON p.id = d.pipeline_id
   WHERE d.company_id = p_company_id AND p.marca = p_marca AND d.owner_id IS NOT NULL
   ORDER BY d.created_at DESC
   LIMIT 1;

  IF v_owner IS NULL THEN
    SELECT user_id INTO v_owner FROM public.company_ejecutivos
      WHERE company_id = p_company_id LIMIT 1;
  END IF;

  -- Potencial = promedio mensual histórico de unidades facturadas para esa marca
  SELECT COALESCE(AVG(monthly_units), 0) INTO v_potencial
  FROM (
    SELECT date_trunc('month', fecha_documento) m,
           SUM(unidades_equivalentes_total) monthly_units
      FROM public.documentos
     WHERE empresa_id = p_company_id
       AND tipo_documento = 'factura'
       AND is_active = true
       AND COALESCE(estatus_factura::text,'') NOT IN ('cancelada')
       AND empresa_vendedora::text = CASE WHEN p_marca='chevron' THEN 'lumaggs' ELSE 'galsa' END
     GROUP BY 1
  ) sub;

  INSERT INTO public.crm_deals (
    title, pipeline_id, stage_id, company_id, owner_id,
    pipeline_type, tipo_negocio, mes_negocio,
    potencial_unidades, value, probability
  ) VALUES (
    COALESCE(v_company_name, 'Cliente') || ' - Recompra ' || trim(v_mes_label),
    v_pipeline_id, v_stage_id, p_company_id, v_owner,
    'recompra'::public.pipeline_type,
    'recompra'::public.tipo_negocio_crm,
    p_mes,
    NULLIF(v_potencial, 0),
    0, 50
  )
  ON CONFLICT (company_id, pipeline_id, mes_negocio) WHERE pipeline_type='recompra'
  DO UPDATE SET updated_at = now()
  RETURNING id INTO v_deal_id;

  RETURN v_deal_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_deal_recompra_mes(uuid, text, text) TO authenticated, anon, service_role;