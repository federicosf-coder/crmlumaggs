UPDATE public.documentos
SET
  estatus_factura = 'pagada',
  saldo_pendiente_cobranza = 0,
  estado_cobranza = 'pagada',
  updated_at = now()
WHERE
  tipo_documento = 'factura'
  AND is_active = true
  AND COALESCE(estatus_factura::text, '') <> 'cancelada'
  AND fecha_vencimiento <= '2026-04-20';