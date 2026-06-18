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

  -- No-facturas: sólo recalcular saldo/estado_cobranza
  IF v_tipo <> 'factura' THEN
    SELECT COALESCE(SUM(monto_aplicado),0) INTO v_aplicado
    FROM public.cobranza_aplicaciones
    WHERE documento_id = _documento_id AND estatus_aplicacion = 'activa';
    v_saldo := v_total - v_aplicado;
    UPDATE public.documentos
      SET saldo_pendiente_cobranza = v_saldo,
          estado_cobranza = CASE
            WHEN v_saldo <= 0 THEN 'pagada'::public.estado_cobranza_doc
            WHEN v_aplicado > 0 AND v_saldo > 0 THEN 'parcial'::public.estado_cobranza_doc
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

  SELECT COALESCE(SUM(monto_aplicado),0) INTO v_aplicado
  FROM public.cobranza_aplicaciones
  WHERE documento_id = _documento_id AND estatus_aplicacion = 'activa';

  v_saldo := GREATEST(0, v_total - v_aplicado);

  -- Lógica unificada (idéntica a recalc_estatus_factura_value):
  --   pagada manual se preserva
  --   total>0 y saldo<=0 -> pagada
  --   saldo>0 y fecha_venc < hoy -> vencida
  --   resto -> vigente
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

-- Backfill: recalcular todas las facturas activas no canceladas para limpiar
-- cualquier 'parcial' o estatus inconsistente dejado por la versión anterior.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT id FROM public.documentos
    WHERE tipo_documento = 'factura'
      AND is_active = true
      AND COALESCE(estatus_factura::text,'') <> 'cancelada'
  LOOP
    PERFORM public.recompute_documento_cobranza(r.id);
  END LOOP;
END $$;