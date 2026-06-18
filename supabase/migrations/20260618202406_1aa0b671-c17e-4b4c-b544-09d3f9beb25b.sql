
-- Trigger: cuando el total de un documento factura cambia, recalcular saldo/estatus
CREATE OR REPLACE FUNCTION public.factura_recompute_on_total_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo_documento = 'factura'
     AND COALESCE(NEW.estatus_factura::text, '') <> 'cancelada'
     AND COALESCE(NEW.total, 0) IS DISTINCT FROM COALESCE(OLD.total, 0) THEN
    PERFORM public.recompute_documento_cobranza(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_factura_recompute_on_total_change ON public.documentos;
CREATE TRIGGER trg_factura_recompute_on_total_change
AFTER UPDATE OF total ON public.documentos
FOR EACH ROW
EXECUTE FUNCTION public.factura_recompute_on_total_change();

-- Backfill: resincronizar todas las facturas no canceladas
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id FROM public.documentos
    WHERE tipo_documento = 'factura'
      AND COALESCE(estatus_factura::text, '') <> 'cancelada'
  LOOP
    PERFORM public.recompute_documento_cobranza(r.id);
  END LOOP;
END $$;
