CREATE OR REPLACE FUNCTION public.factura_restore_saldo_on_pending()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_aplicado numeric; v_saldo numeric;
BEGIN
  IF NEW.tipo_documento <> 'factura' OR NEW.estatus_factura IS NOT DISTINCT FROM OLD.estatus_factura THEN
    RETURN NEW;
  END IF;
  IF NEW.estatus_factura = 'pagada' THEN
    NEW.saldo_pendiente_cobranza := 0;
    NEW.estado_cobranza := 'pagada'::public.estado_cobranza_doc;
  ELSIF OLD.estatus_factura = 'pagada' AND NEW.estatus_factura <> 'cancelada' THEN
    SELECT COALESCE(SUM(monto_aplicado),0) INTO v_aplicado
      FROM public.cobranza_aplicaciones
     WHERE documento_id = NEW.id AND estatus_aplicacion = 'activa';
    v_saldo := GREATEST(0, COALESCE(NEW.total,0) - v_aplicado);
    NEW.saldo_pendiente_cobranza := v_saldo;
    NEW.estado_cobranza := CASE
      WHEN v_saldo < 5 THEN 'pagada'::public.estado_cobranza_doc
      WHEN v_aplicado > 0 THEN 'parcial'::public.estado_cobranza_doc
      ELSE 'pendiente'::public.estado_cobranza_doc END;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.recompute_documento_cobranza(_documento_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric; v_aplicado numeric; v_saldo numeric; v_venc date;
  v_tipo public.tipo_documento; v_estatus public.estatus_factura; v_nuevo text;
BEGIN
  PERFORM set_config('app.saldo_recompute', 'true', true);
  SELECT total, fecha_vencimiento, tipo_documento, estatus_factura
    INTO v_total, v_venc, v_tipo, v_estatus
  FROM public.documentos WHERE id = _documento_id;
  IF v_total IS NULL THEN RETURN; END IF;

  IF v_tipo <> 'factura' THEN
    SELECT COALESCE(SUM(monto_aplicado),0) INTO v_aplicado
    FROM public.cobranza_aplicaciones
    WHERE documento_id = _documento_id AND estatus_aplicacion = 'activa';
    v_saldo := v_total - v_aplicado;
    UPDATE public.documentos
      SET saldo_pendiente_cobranza = v_saldo,
          estado_cobranza = CASE
            WHEN v_saldo < 5 THEN 'pagada'::public.estado_cobranza_doc
            WHEN v_aplicado > 0 AND v_saldo >= 5 THEN 'parcial'::public.estado_cobranza_doc
            ELSE 'pendiente'::public.estado_cobranza_doc END,
          updated_at = now()
    WHERE id = _documento_id;
    RETURN;
  END IF;

  IF v_estatus = 'cancelada'::public.estatus_factura THEN RETURN; END IF;

  IF v_estatus = 'pagada'::public.estatus_factura THEN
    UPDATE public.documentos
      SET saldo_pendiente_cobranza = 0,
          estado_cobranza = 'pagada'::public.estado_cobranza_doc,
          updated_at = now()
    WHERE id = _documento_id;
    RETURN;
  END IF;

  SELECT COALESCE(SUM(monto_aplicado),0) INTO v_aplicado
  FROM public.cobranza_aplicaciones
  WHERE documento_id = _documento_id AND estatus_aplicacion = 'activa';
  v_saldo := GREATEST(0, v_total - v_aplicado);

  v_nuevo := public.recalc_estatus_factura_value(COALESCE(v_estatus::text, 'vigente'), v_total, v_saldo, v_venc);

  UPDATE public.documentos
    SET saldo_pendiente_cobranza = v_saldo,
        estatus_factura = v_nuevo::public.estatus_factura,
        estado_cobranza = CASE
          WHEN v_saldo < 5 THEN 'pagada'::public.estado_cobranza_doc
          WHEN v_aplicado > 0 AND v_saldo >= 5 THEN 'parcial'::public.estado_cobranza_doc
          ELSE 'pendiente'::public.estado_cobranza_doc END,
        updated_at = now()
  WHERE id = _documento_id;
END;
$function$;