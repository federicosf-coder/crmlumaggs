ALTER TABLE public.cobranza_pagos ADD COLUMN IF NOT EXISTS empresa_vendedora public.empresa_vendedora;

UPDATE public.cobranza_pagos p
SET empresa_vendedora = sub.ev
FROM (
  SELECT DISTINCT ON (a.pago_id) a.pago_id, d.empresa_vendedora AS ev
  FROM public.cobranza_aplicaciones a
  JOIN public.documentos d ON d.id = a.documento_id
  ORDER BY a.pago_id, a.created_at
) sub
WHERE p.id = sub.pago_id AND p.empresa_vendedora IS NULL;