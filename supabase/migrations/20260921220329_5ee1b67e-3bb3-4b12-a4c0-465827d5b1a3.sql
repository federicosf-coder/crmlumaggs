CREATE OR REPLACE FUNCTION public.documentos_init_saldo_factura()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo_documento = 'factura'
     AND COALESCE(NEW.total, 0) > 0
     AND COALESCE(NEW.saldo_pendiente_cobranza, 0) = 0
     AND COALESCE(NEW.estatus_factura::text, 'vigente') <> 'pagada'
     AND COALESCE(NEW.estatus_factura::text, 'vigente') <> 'cancelada' THEN
    NEW.saldo_pendiente_cobranza := NEW.total;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_documentos_init_saldo_factura ON public.documentos;
CREATE TRIGGER trg_documentos_init_saldo_factura
BEFORE INSERT ON public.documentos
FOR EACH ROW EXECUTE FUNCTION public.documentos_init_saldo_factura();