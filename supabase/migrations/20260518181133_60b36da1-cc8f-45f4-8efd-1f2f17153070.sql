-- Función para recalcular estatus_factura
CREATE OR REPLACE FUNCTION public.recalc_estatus_factura_value(
  p_estatus_actual text,
  p_total numeric,
  p_saldo numeric,
  p_fecha_vencimiento date
) RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  -- Nunca tocamos canceladas
  IF p_estatus_actual = 'cancelada' THEN
    RETURN 'cancelada';
  END IF;

  -- Pagada: saldo en 0
  IF COALESCE(p_total, 0) > 0 AND COALESCE(p_saldo, 0) <= 0 THEN
    RETURN 'pagada';
  END IF;

  -- Vencida: fecha pasada y aún con saldo
  IF p_fecha_vencimiento IS NOT NULL
     AND p_fecha_vencimiento < CURRENT_DATE
     AND COALESCE(p_saldo, 0) > 0 THEN
    RETURN 'vencida';
  END IF;

  -- Parcial: hay abonos pero no se ha liquidado
  IF COALESCE(p_total, 0) > 0
     AND COALESCE(p_saldo, 0) > 0
     AND COALESCE(p_saldo, 0) < COALESCE(p_total, 0) THEN
    RETURN 'parcial';
  END IF;

  -- Aún dentro del plazo
  RETURN 'vigente';
END;
$$;

-- Trigger BEFORE INSERT/UPDATE para mantener el estatus al vuelo
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

  NEW.estatus_factura := v_nuevo::estatus_factura_enum;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_estatus_factura ON public.documentos;
CREATE TRIGGER trg_sync_estatus_factura
BEFORE INSERT OR UPDATE OF total, saldo_pendiente_cobranza, fecha_vencimiento, estatus_factura, tipo_documento
ON public.documentos
FOR EACH ROW
EXECUTE FUNCTION public.trg_sync_estatus_factura();

-- Job batch para recalcular diariamente (llamado por cron)
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
    )::estatus_factura_enum
    WHERE d.tipo_documento = 'factura'
      AND d.is_active = true
      AND d.estatus_factura IS DISTINCT FROM
        public.recalc_estatus_factura_value(
          d.estatus_factura::text, d.total, d.saldo_pendiente_cobranza, d.fecha_vencimiento
        )::estatus_factura_enum
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_count FROM upd;
  RETURN v_count;
END;
$$;