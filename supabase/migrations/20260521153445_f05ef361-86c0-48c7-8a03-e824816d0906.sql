CREATE OR REPLACE FUNCTION public.recalc_estatus_factura_value(p_estatus_actual text, p_total numeric, p_saldo numeric, p_fecha_vencimiento date)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
BEGIN
  IF p_estatus_actual = 'cancelada' THEN
    RETURN 'cancelada';
  END IF;

  -- Respetar marcado manual como pagada aunque no haya pago registrado (saldo > 0)
  IF p_estatus_actual = 'pagada' THEN
    RETURN 'pagada';
  END IF;

  IF COALESCE(p_total, 0) > 0 AND COALESCE(p_saldo, 0) <= 0 THEN
    RETURN 'pagada';
  END IF;

  IF p_fecha_vencimiento IS NOT NULL
     AND p_fecha_vencimiento < CURRENT_DATE
     AND COALESCE(p_saldo, 0) > 0 THEN
    RETURN 'vencida';
  END IF;

  RETURN 'vigente';
END;
$function$;