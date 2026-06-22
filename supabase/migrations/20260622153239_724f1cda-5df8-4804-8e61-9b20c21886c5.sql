-- Corregir recalc_estatus_factura_value para respetar 'pagada' manual
-- (facturas marcadas como pagadas sin tener pagos registrados)
CREATE OR REPLACE FUNCTION public.recalc_estatus_factura_value(
  p_estatus_actual text,
  p_total numeric,
  p_saldo numeric,
  p_fecha_vencimiento date
) RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- Cancelada siempre se preserva
  IF p_estatus_actual = 'cancelada' THEN
    RETURN 'cancelada';
  END IF;

  -- Pagada manual: si el estatus actual ya es 'pagada' pero el saldo
  -- calculado es > 0 (sin pagos registrados), respetar el estatus manual
  IF p_estatus_actual = 'pagada' AND COALESCE(p_saldo, 0) >= 5 THEN
    RETURN 'pagada';
  END IF;

  -- Pagada por pagos reales: saldo < 5
  IF COALESCE(p_saldo, 0) < 5 THEN
    RETURN 'pagada';
  END IF;

  -- Vencida: tiene saldo y ya pasó la fecha de vencimiento
  IF p_fecha_vencimiento IS NOT NULL AND p_fecha_vencimiento < CURRENT_DATE THEN
    RETURN 'vencida';
  END IF;

  -- Vigente: tiene saldo pero aún no vence
  RETURN 'vigente';
END;
$$;

-- Corregir recompute_documento_cobranza para respetar 'pagada' manual
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
  v_nuevo text;
BEGIN
  SELECT total, fecha_vencimiento, tipo_documento, estatus_factura
    INTO v_total, v_venc, v_tipo, v_estatus
  FROM public.documentos WHERE id = _documento_id;

  IF v_total IS NULL THEN RETURN; END IF;

  -- No-facturas: solo recalcular saldo/estado_cobranza
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
            ELSE 'pendiente'::public.estado_cobranza_doc
          END,
          updated_at = now()
    WHERE id = _documento_id;
    RETURN;
  END IF;

  -- Facturas: respetar cancelada
  IF v_estatus = 'cancelada'::public.estatus_factura THEN
    RETURN;
  END IF;

  -- Facturas: respetar pagada manual (pagada sin pagos registrados)
  -- Solo recalcular el saldo pero NO cambiar el estatus si ya es 'pagada'
  SELECT COALESCE(SUM(monto_aplicado),0) INTO v_aplicado
  FROM public.cobranza_aplicaciones
  WHERE documento_id = _documento_id AND estatus_aplicacion = 'activa';

  v_saldo := GREATEST(0, v_total - v_aplicado);

  -- Si ya está pagada manualmente (saldo >= 5 pero estatus = pagada),
  -- solo actualizar el saldo, NO cambiar el estatus
  IF v_estatus = 'pagada'::public.estatus_factura AND v_saldo >= 5 THEN
    UPDATE public.documentos
      SET saldo_pendiente_cobranza = v_saldo,
          updated_at = now()
    WHERE id = _documento_id;
    RETURN;
  END IF;

  -- Para el resto, calcular el nuevo estatus normalmente
  v_nuevo := public.recalc_estatus_factura_value(
    COALESCE(v_estatus::text, 'vigente'),
    v_total,
    v_saldo,
    v_venc
  );

  UPDATE public.documentos
    SET saldo_pendiente_cobranza = v_saldo,
        estatus_factura = v_nuevo::public.estatus_factura,
        estado_cobranza = CASE
          WHEN v_nuevo = 'pagada' THEN 'pagada'::public.estado_cobranza_doc
          WHEN v_nuevo = 'vencida' THEN 'vencida'::public.estado_cobranza_doc
          ELSE 'pendiente'::public.estado_cobranza_doc
        END,
        updated_at = now()
  WHERE id = _documento_id;
END;
$function$;

-- También corregir el job de pg_cron que recalcula diariamente
-- para que excluya facturas pagadas manualmente (pagadas sin pagos)
-- El job actual probablemente llama a una función batch — corregirla:
CREATE OR REPLACE FUNCTION public.recalcular_estatus_facturas_batch()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id FROM public.documentos
    WHERE tipo_documento = 'factura'
      AND is_active = true
      -- Excluir canceladas y pagadas manuales (pagadas con saldo >= 5)
      AND COALESCE(estatus_factura::text, '') NOT IN ('cancelada')
      AND NOT (
        estatus_factura::text = 'pagada'
        AND COALESCE(saldo_pendiente_cobranza, 0) >= 5
      )
  LOOP
    PERFORM public.recompute_documento_cobranza(r.id);
  END LOOP;
END;
$$;