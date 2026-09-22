-- PASO 2: marcar el camino automático como de confianza
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
            ELSE 'pendiente'::public.estado_cobranza_doc
          END,
          updated_at = now()
    WHERE id = _documento_id;
    RETURN;
  END IF;

  IF v_estatus = 'cancelada'::public.estatus_factura THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(monto_aplicado),0) INTO v_aplicado
  FROM public.cobranza_aplicaciones
  WHERE documento_id = _documento_id AND estatus_aplicacion = 'activa';

  v_saldo := GREATEST(0, v_total - v_aplicado);

  IF v_estatus = 'pagada'::public.estatus_factura AND v_saldo >= 5 THEN
    UPDATE public.documentos
      SET saldo_pendiente_cobranza = v_saldo,
          updated_at = now()
    WHERE id = _documento_id;
    RETURN;
  END IF;

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
          WHEN v_saldo < 5 THEN 'pagada'::public.estado_cobranza_doc
          WHEN v_aplicado > 0 AND v_saldo >= 5 THEN 'parcial'::public.estado_cobranza_doc
          ELSE 'pendiente'::public.estado_cobranza_doc
        END,
        updated_at = now()
  WHERE id = _documento_id;
END;
$function$;

-- PASO 3: candado. Nombre 'trg_a_bloquear_factura_pagada_manual' para que corra antes de trg_sync_estatus_factura (orden alfabético)
CREATE OR REPLACE FUNCTION public.bloquear_factura_pagada_manual()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tipo_documento IS DISTINCT FROM 'factura' THEN
    RETURN NEW;
  END IF;

  IF NEW.estatus_factura = 'pagada'::public.estatus_factura
     AND OLD.estatus_factura IS DISTINCT FROM 'pagada'::public.estatus_factura
     AND COALESCE(current_setting('app.saldo_recompute', true), '') IS DISTINCT FROM 'true'
     AND COALESCE(NEW.saldo_pendiente_cobranza, 0) >= 5
     AND auth.uid() IS NOT NULL
     AND NOT public.has_role(auth.uid(), 'master'::public.app_role)
  THEN
    RAISE EXCEPTION 'Solo un Usuario Master puede marcar una factura como pagada manualmente.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_a_bloquear_factura_pagada_manual ON public.documentos;
CREATE TRIGGER trg_a_bloquear_factura_pagada_manual
BEFORE UPDATE OF estatus_factura ON public.documentos
FOR EACH ROW EXECUTE FUNCTION public.bloquear_factura_pagada_manual();

-- PASO 4: auditoría de estatus_factura
ALTER TABLE public.documentos_estatus_historial
  ADD COLUMN IF NOT EXISTS estatus_factura_anterior text,
  ADD COLUMN IF NOT EXISTS estatus_factura_nuevo text;

ALTER TABLE public.documentos_estatus_historial
  ALTER COLUMN estatus_anterior DROP NOT NULL,
  ALTER COLUMN estatus_nuevo DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.log_estatus_pedido_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tipo_documento = 'pedido' AND OLD.estatus_pedido IS DISTINCT FROM NEW.estatus_pedido THEN
    INSERT INTO public.documentos_estatus_historial (documento_id, estatus_anterior, estatus_nuevo, cambiado_por)
    VALUES (NEW.id, OLD.estatus_pedido, NEW.estatus_pedido, auth.uid());
  END IF;

  IF NEW.tipo_documento = 'factura' AND OLD.estatus_factura IS DISTINCT FROM NEW.estatus_factura THEN
    INSERT INTO public.documentos_estatus_historial (documento_id, estatus_anterior, estatus_nuevo, estatus_factura_anterior, estatus_factura_nuevo, cambiado_por)
    VALUES (NEW.id, NULL, NULL, OLD.estatus_factura::text, NEW.estatus_factura::text, auth.uid());
  END IF;

  RETURN NEW;
END;
$function$;