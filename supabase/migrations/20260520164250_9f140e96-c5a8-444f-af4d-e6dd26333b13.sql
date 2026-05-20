CREATE OR REPLACE FUNCTION public.trg_sync_estatus_factura()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_nuevo text;
BEGIN
  IF NEW.tipo_documento IS DISTINCT FROM 'factura' THEN
    RETURN NEW;
  END IF;

  -- En UPDATE: si solo cambió estatus_factura, respetamos el cambio manual
  IF TG_OP = 'UPDATE'
     AND NEW.estatus_factura IS DISTINCT FROM OLD.estatus_factura
     AND NEW.total IS NOT DISTINCT FROM OLD.total
     AND NEW.saldo_pendiente_cobranza IS NOT DISTINCT FROM OLD.saldo_pendiente_cobranza
     AND NEW.fecha_vencimiento IS NOT DISTINCT FROM OLD.fecha_vencimiento
     AND NEW.tipo_documento IS NOT DISTINCT FROM OLD.tipo_documento
  THEN
    RETURN NEW;
  END IF;

  v_nuevo := public.recalc_estatus_factura_value(
    COALESCE(NEW.estatus_factura::text, 'vigente'),
    NEW.total,
    NEW.saldo_pendiente_cobranza,
    NEW.fecha_vencimiento
  );

  NEW.estatus_factura := v_nuevo::estatus_factura;
  RETURN NEW;
END;
$$;