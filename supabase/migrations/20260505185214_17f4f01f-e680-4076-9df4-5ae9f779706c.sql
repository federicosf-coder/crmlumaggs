DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.documentos
  WHERE tipo_documento = 'factura'
    AND estatus_factura::text ILIKE 'pagad%'
    AND saldo_pendiente_cobranza > 0
    AND is_active = true;

  UPDATE public.documentos
  SET saldo_pendiente_cobranza = 0,
      estado_cobranza = 'pagada',
      updated_at = now()
  WHERE tipo_documento = 'factura'
    AND estatus_factura::text ILIKE 'pagad%'
    AND saldo_pendiente_cobranza > 0
    AND is_active = true;

  INSERT INTO public.system_settings (key, value, description)
  VALUES (
    'bulk_fix_saldo_facturas_pagad_ilike_2026_05',
    jsonb_build_object(
      'action', 'bulk_update',
      'criteria', jsonb_build_object(
        'tipo_documento', 'factura',
        'estatus_factura_match', 'ILIKE pagad%',
        'saldo_pendiente_cobranza_gt', 0,
        'is_active', true
      ),
      'affected_count', v_count,
      'executed_at', now(),
      'fields_changed', jsonb_build_array('saldo_pendiente_cobranza', 'estado_cobranza', 'updated_at')
    ),
    'Ajuste de saldo a 0 para facturas con estatus pagado (ILIKE pagad%) sin aplicación de cobranza registrada'
  )
  ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      description = EXCLUDED.description,
      updated_at = now();
END $$;