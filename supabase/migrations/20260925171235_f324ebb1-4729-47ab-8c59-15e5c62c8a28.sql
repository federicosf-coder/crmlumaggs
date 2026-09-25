DROP POLICY IF EXISTS "Customer service can update pagos" ON public.cobranza_pagos;
CREATE POLICY "Customer service can update pagos"
ON public.cobranza_pagos
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'customer_service'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'customer_service'::app_role));

GRANT SELECT, INSERT, UPDATE ON public.cobranza_pagos TO authenticated;