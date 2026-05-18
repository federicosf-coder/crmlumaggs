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

CREATE OR REPLACE FUNCTION public.recalc_estatus_factura_batch()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH upd AS (
    UPDATE public.documentos d
    SET estatus_factura = public.recalc_estatus_factura_value(
      d.estatus_factura::text, d.total, d.saldo_pendiente_cobranza, d.fecha_vencimiento
    )::estatus_factura
    WHERE d.tipo_documento = 'factura'
      AND d.is_active = true
      AND d.estatus_factura IS DISTINCT FROM
        public.recalc_estatus_factura_value(
          d.estatus_factura::text, d.total, d.saldo_pendiente_cobranza, d.fecha_vencimiento
        )::estatus_factura
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM upd;
  RETURN v_count;
END;
$$;