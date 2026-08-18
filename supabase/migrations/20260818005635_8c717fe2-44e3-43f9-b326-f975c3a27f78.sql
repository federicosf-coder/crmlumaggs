CREATE OR REPLACE FUNCTION public.cobranza_aplicacion_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_pago_total numeric; v_aplicado_otros numeric; v_doc_total numeric; v_aplicado_doc_otros numeric; v_tol numeric := 5;
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.estatus_aplicacion = 'activa' THEN
    SELECT monto_total INTO v_pago_total FROM public.cobranza_pagos WHERE id = NEW.pago_id;
    SELECT COALESCE(SUM(monto_aplicado),0) INTO v_aplicado_otros
    FROM public.cobranza_aplicaciones
    WHERE pago_id = NEW.pago_id AND estatus_aplicacion = 'activa'
      AND (TG_OP = 'INSERT' OR id <> NEW.id);
    IF (v_aplicado_otros + NEW.monto_aplicado) > (v_pago_total + v_tol) THEN
      RAISE EXCEPTION 'La aplicación excede el monto disponible del pago';
    END IF;
    SELECT total INTO v_doc_total FROM public.documentos WHERE id = NEW.documento_id;
    SELECT COALESCE(SUM(monto_aplicado),0) INTO v_aplicado_doc_otros
    FROM public.cobranza_aplicaciones
    WHERE documento_id = NEW.documento_id AND estatus_aplicacion = 'activa'
      AND (TG_OP = 'INSERT' OR id <> NEW.id);
    IF (v_aplicado_doc_otros + NEW.monto_aplicado) > (v_doc_total + v_tol) THEN
      RAISE EXCEPTION 'La aplicación excede el saldo pendiente del documento';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END; $$;