-- Reparar 17 facturas de crédito sin saldo inicializado
UPDATE public.documentos
SET saldo_pendiente_cobranza = total,
    estado_cobranza = 'pendiente',
    updated_at = now()
WHERE tipo_documento = 'factura'
  AND is_active = true
  AND numero_factura IN (
    'TIJ2635','TIJ2623','TIJ2625','TIJ2629','TIJ2630','TIJ2631','TIJ2632',
    'TIJ2614','TIJ2616','TIJ2619','TIJ2620','TIJ2622','TIJ2618',
    'TIJ2445','TIJ2407','TIJ2322','TJ3203'
  )
  AND COALESCE(saldo_pendiente_cobranza, 0) = 0
  AND estado_cobranza IS NULL
  AND total > 0;
