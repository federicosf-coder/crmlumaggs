
-- Recalcular unidades del CRM:
--  - Para deals tipo PRIMERA COMPRA: sumar documentos vinculados al deal (negocio_id) – no cancelados.
--  - Para deals tipo RECOMPRA: sumar documentos de la EMPRESA, filtrados por
--    empresa_vendedora (según la marca del pipeline) y por mes (mes_negocio = YYYY-MM
--    sobre fecha_documento). Excluir documentos cancelados.
--  El trigger ahora recalcula tanto el deal vinculado por negocio_id como el deal
--  de Recompra correspondiente al mes y empresa del documento.

CREATE OR REPLACE FUNCTION public.recalc_deal_units(p_deal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pipeline_type pipeline_type;
  v_company_id uuid;
  v_mes text;
  v_marca text;
  v_empresa_vendedora text;
BEGIN
  IF p_deal_id IS NULL THEN RETURN; END IF;

  SELECT d.pipeline_type, d.company_id, d.mes_negocio, p.marca
    INTO v_pipeline_type, v_company_id, v_mes, v_marca
    FROM public.crm_deals d
    LEFT JOIN public.crm_pipelines p ON p.id = d.pipeline_id
   WHERE d.id = p_deal_id;

  IF v_pipeline_type = 'recompra' THEN
    v_empresa_vendedora := CASE WHEN v_marca = 'phillips66' THEN 'galsa_phillips66' ELSE 'lumaggs_chevron' END;

    UPDATE public.crm_deals d
       SET cotizado_unidades = COALESCE((
             SELECT SUM(unidades_equivalentes_total) FROM public.documentos
              WHERE empresa_id = v_company_id
                AND is_active = true
                AND tipo_documento = 'cotizacion'
                AND empresa_vendedora::text = v_empresa_vendedora
                AND v_mes IS NOT NULL
                AND to_char(fecha_documento, 'YYYY-MM') = v_mes
                AND COALESCE(estatus_cotizacion::text,'') NOT IN ('rechazada','vencida')
           ),0),
           pedido_unidades = COALESCE((
             SELECT SUM(unidades_equivalentes_total) FROM public.documentos
              WHERE empresa_id = v_company_id
                AND is_active = true
                AND tipo_documento = 'pedido'
                AND empresa_vendedora::text = v_empresa_vendedora
                AND v_mes IS NOT NULL
                AND to_char(fecha_documento, 'YYYY-MM') = v_mes
                AND COALESCE(estatus_pedido::text,'') NOT IN ('cancelado')
           ),0),
           facturado_unidades = COALESCE((
             SELECT SUM(unidades_equivalentes_total) FROM public.documentos
              WHERE empresa_id = v_company_id
                AND is_active = true
                AND tipo_documento = 'factura'
                AND empresa_vendedora::text = v_empresa_vendedora
                AND v_mes IS NOT NULL
                AND to_char(fecha_documento, 'YYYY-MM') = v_mes
                AND COALESCE(estatus_factura::text,'') NOT IN ('cancelada')
           ),0),
           updated_at = now()
     WHERE d.id = p_deal_id;
  ELSE
    -- Primera compra: por negocio vinculado
    UPDATE public.crm_deals d
       SET cotizado_unidades = COALESCE((
             SELECT SUM(unidades_equivalentes_total) FROM public.documentos
              WHERE negocio_id = p_deal_id AND is_active = true
                AND tipo_documento = 'cotizacion'
                AND COALESCE(estatus_cotizacion::text,'') NOT IN ('rechazada','vencida')
           ),0),
           pedido_unidades = COALESCE((
             SELECT SUM(unidades_equivalentes_total) FROM public.documentos
              WHERE negocio_id = p_deal_id AND is_active = true
                AND tipo_documento = 'pedido'
                AND COALESCE(estatus_pedido::text,'') NOT IN ('cancelado')
           ),0),
           facturado_unidades = COALESCE((
             SELECT SUM(unidades_equivalentes_total) FROM public.documentos
              WHERE negocio_id = p_deal_id AND is_active = true
                AND tipo_documento = 'factura'
                AND COALESCE(estatus_factura::text,'') NOT IN ('cancelada')
           ),0),
           updated_at = now()
     WHERE d.id = p_deal_id;
  END IF;
END;
$$;

-- Helper: encontrar deals de Recompra que corresponden a un documento (empresa, marca, mes)
CREATE OR REPLACE FUNCTION public.recalc_recompra_deals_for_doc(
  p_empresa_id uuid,
  p_empresa_vendedora text,
  p_fecha date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mes text;
  r RECORD;
  v_marca text;
BEGIN
  IF p_empresa_id IS NULL OR p_fecha IS NULL THEN RETURN; END IF;
  v_mes := to_char(p_fecha, 'YYYY-MM');
  v_marca := CASE WHEN p_empresa_vendedora = 'galsa_phillips66' THEN 'phillips66' ELSE 'chevron' END;

  FOR r IN
    SELECT d.id
      FROM public.crm_deals d
      JOIN public.crm_pipelines p ON p.id = d.pipeline_id
     WHERE d.pipeline_type = 'recompra'
       AND d.company_id = p_empresa_id
       AND d.mes_negocio = v_mes
       AND p.marca = v_marca
  LOOP
    PERFORM public.recalc_deal_units(r.id);
  END LOOP;
END;
$$;

-- Trigger actualizado
CREATE OR REPLACE FUNCTION public.trg_documentos_recalc_deal_units()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.negocio_id IS NOT NULL THEN
      PERFORM public.recalc_deal_units(NEW.negocio_id);
    END IF;
    PERFORM public.recalc_recompra_deals_for_doc(NEW.empresa_id, NEW.empresa_vendedora::text, NEW.fecha_documento);
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.negocio_id IS NOT NULL THEN
      PERFORM public.recalc_deal_units(NEW.negocio_id);
    END IF;
    IF OLD.negocio_id IS NOT NULL AND NEW.negocio_id IS DISTINCT FROM OLD.negocio_id THEN
      PERFORM public.recalc_deal_units(OLD.negocio_id);
    END IF;
    PERFORM public.recalc_recompra_deals_for_doc(NEW.empresa_id, NEW.empresa_vendedora::text, NEW.fecha_documento);
    IF (OLD.empresa_id IS DISTINCT FROM NEW.empresa_id)
       OR (OLD.empresa_vendedora IS DISTINCT FROM NEW.empresa_vendedora)
       OR (OLD.fecha_documento IS DISTINCT FROM NEW.fecha_documento) THEN
      PERFORM public.recalc_recompra_deals_for_doc(OLD.empresa_id, OLD.empresa_vendedora::text, OLD.fecha_documento);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.negocio_id IS NOT NULL THEN
      PERFORM public.recalc_deal_units(OLD.negocio_id);
    END IF;
    PERFORM public.recalc_recompra_deals_for_doc(OLD.empresa_id, OLD.empresa_vendedora::text, OLD.fecha_documento);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_documentos_recalc_deal_units ON public.documentos;
CREATE TRIGGER trg_documentos_recalc_deal_units
AFTER INSERT OR UPDATE OR DELETE ON public.documentos
FOR EACH ROW EXECUTE FUNCTION public.trg_documentos_recalc_deal_units();

-- Backfill: recalcular TODOS los deals (especialmente los de Recompra que no tenían
-- documentos vinculados pero sí facturas en su mes)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.crm_deals LOOP
    PERFORM public.recalc_deal_units(r.id);
  END LOOP;
END $$;
