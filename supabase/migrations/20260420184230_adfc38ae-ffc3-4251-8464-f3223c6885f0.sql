
-- Bulk update: facturas pendientes con fecha <= 2026-03-31
UPDATE public.documentos
SET estado_cobranza = 'pagada',
    saldo_pendiente_cobranza = 0,
    updated_at = now()
WHERE tipo_documento = 'factura'
  AND estado_cobranza = 'pendiente'
  AND fecha_documento <= '2026-03-31'
  AND is_active = true;

-- Log the bulk operation
INSERT INTO public.system_settings (key, value, description, updated_at)
VALUES (
  'bulk_update_facturas_2026_03_31',
  jsonb_build_object(
    'action', 'bulk_close_facturas',
    'criteria', 'tipo_documento=factura, estado_cobranza=pendiente, fecha_documento<=2026-03-31',
    'affected_ids', (SELECT jsonb_agg(id) FROM public.documentos WHERE tipo_documento = 'factura' AND estado_cobranza = 'pagada' AND fecha_documento <= '2026-03-31' AND numero_factura = 'TIJ2424'),
    'executed_at', now()::text,
    'fields_changed', 'estado_cobranza→pagada, saldo_pendiente_cobranza→0'
  ),
  'Registro de actualización masiva de facturas pendientes al 31/03/2026',
  now()
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
