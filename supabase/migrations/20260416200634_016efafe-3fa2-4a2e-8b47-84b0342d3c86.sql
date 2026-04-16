CREATE OR REPLACE FUNCTION public.recompute_pago_balance(_pago_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_total numeric; v_aplicado numeric;
BEGIN
  SELECT monto_total INTO v_total FROM public.cobranza_pagos WHERE id = _pago_id;
  IF v_total IS NULL THEN RETURN; END IF;
  SELECT COALESCE(SUM(monto_aplicado),0) INTO v_aplicado
  FROM public.cobranza_aplicaciones WHERE pago_id = _pago_id AND estatus_aplicacion = 'activa';
  UPDATE public.cobranza_pagos
  SET monto_aplicado = v_aplicado,
      monto_disponible = v_total - v_aplicado,
      estado_pago = (CASE
        WHEN estado_pago = 'cancelado'::public.estado_pago_cobranza THEN 'cancelado'
        WHEN v_aplicado = 0 THEN 'no_aplicado'
        WHEN v_aplicado >= v_total THEN 'aplicado_total'
        ELSE 'aplicado_parcial' END)::public.estado_pago_cobranza,
      updated_at = now()
  WHERE id = _pago_id;
END; $function$;