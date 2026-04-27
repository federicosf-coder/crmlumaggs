-- Función para recalcular contadores de un deal
CREATE OR REPLACE FUNCTION public.recalc_deal_units(p_deal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_deal_id IS NULL THEN RETURN; END IF;
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
END;
$$;

-- Trigger de documentos
CREATE OR REPLACE FUNCTION public.trg_documentos_recalc_deal_units()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recalc_deal_units(NEW.negocio_id);
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.recalc_deal_units(NEW.negocio_id);
    IF NEW.negocio_id IS DISTINCT FROM OLD.negocio_id THEN
      PERFORM public.recalc_deal_units(OLD.negocio_id);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_deal_units(OLD.negocio_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_documentos_recalc_deal_units ON public.documentos;
CREATE TRIGGER trg_documentos_recalc_deal_units
AFTER INSERT OR UPDATE OR DELETE ON public.documentos
FOR EACH ROW EXECUTE FUNCTION public.trg_documentos_recalc_deal_units();

-- Backfill: recalcular para todos los deals con docs vinculados
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT negocio_id FROM public.documentos WHERE negocio_id IS NOT NULL LOOP
    PERFORM public.recalc_deal_units(r.negocio_id);
  END LOOP;
END $$;