
CREATE OR REPLACE FUNCTION public.recompute_documento_cobranza(_documento_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_total numeric;
  v_aplicado numeric;
  v_saldo numeric;
  v_venc date;
  v_tipo public.tipo_documento;
  v_estatus public.estatus_factura;
BEGIN
  SELECT total, fecha_vencimiento, tipo_documento, estatus_factura
    INTO v_total, v_venc, v_tipo, v_estatus
  FROM public.documentos WHERE id = _documento_id;

  IF v_total IS NULL THEN RETURN; END IF;

  -- Preserve cancelled facturas
  IF v_tipo = 'factura' AND v_estatus = 'cancelada'::public.estatus_factura THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(monto_aplicado),0) INTO v_aplicado
  FROM public.cobranza_aplicaciones
  WHERE documento_id = _documento_id AND estatus_aplicacion = 'activa';

  v_saldo := v_total - v_aplicado;

  IF v_tipo = 'factura' THEN
    IF v_saldo < 5 THEN
      UPDATE public.documentos
        SET saldo_pendiente_cobranza = 0,
            estado_cobranza = 'pagada'::public.estado_cobranza_doc,
            estatus_factura = 'pagada'::public.estatus_factura,
            updated_at = now()
      WHERE id = _documento_id;
    ELSIF v_aplicado > 0 THEN
      UPDATE public.documentos
        SET saldo_pendiente_cobranza = v_saldo,
            estado_cobranza = 'parcial'::public.estado_cobranza_doc,
            estatus_factura = 'parcial'::public.estatus_factura,
            updated_at = now()
      WHERE id = _documento_id;
    ELSIF v_venc IS NOT NULL AND v_venc < CURRENT_DATE THEN
      UPDATE public.documentos
        SET saldo_pendiente_cobranza = v_saldo,
            estado_cobranza = 'vencida'::public.estado_cobranza_doc,
            estatus_factura = 'vencida'::public.estatus_factura,
            updated_at = now()
      WHERE id = _documento_id;
    ELSE
      UPDATE public.documentos
        SET saldo_pendiente_cobranza = v_saldo,
            estado_cobranza = 'pendiente'::public.estado_cobranza_doc,
            estatus_factura = 'vigente'::public.estatus_factura,
            updated_at = now()
      WHERE id = _documento_id;
    END IF;
  ELSE
    UPDATE public.documentos
      SET saldo_pendiente_cobranza = v_saldo,
          estado_cobranza = CASE
            WHEN v_saldo <= 0 THEN 'pagada'::public.estado_cobranza_doc
            WHEN v_aplicado > 0 AND v_saldo > 0 THEN 'parcial'::public.estado_cobranza_doc
            ELSE 'pendiente'::public.estado_cobranza_doc
          END,
          updated_at = now()
    WHERE id = _documento_id;
  END IF;
END;
$function$;
