CREATE OR REPLACE FUNCTION public.factura_restore_saldo_on_pending()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo_documento = 'factura'
     AND OLD.estatus_factura = 'pagada'
     AND NEW.estatus_factura = 'pendiente' THEN
    NEW.saldo_pendiente_cobranza := COALESCE(NEW.total, 0);
    NEW.estado_cobranza := 'pendiente'::public.estado_cobranza_doc;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_factura_restore_saldo_on_pending ON public.documentos;

CREATE TRIGGER trg_factura_restore_saldo_on_pending
BEFORE UPDATE OF estatus_factura ON public.documentos
FOR EACH ROW
EXECUTE FUNCTION public.factura_restore_saldo_on_pending();