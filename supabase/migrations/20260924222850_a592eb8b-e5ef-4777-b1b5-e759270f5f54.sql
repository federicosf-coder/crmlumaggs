CREATE POLICY "Customer service can read comprobantes-intake storage" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'comprobantes-intake' AND public.has_role(auth.uid(), 'customer_service'::app_role));

CREATE POLICY "Customer service can view pagos" ON public.cobranza_pagos FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'customer_service'::app_role));
CREATE POLICY "Customer service can insert pagos" ON public.cobranza_pagos FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'customer_service'::app_role));
CREATE POLICY "Customer service can insert aplicaciones" ON public.cobranza_aplicaciones FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'customer_service'::app_role));
CREATE POLICY "Customer service can insert pago archivos" ON public.cobranza_pago_archivos FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'customer_service'::app_role));
CREATE POLICY "Customer service can update comprobantes_intake" ON public.comprobantes_intake FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'customer_service'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'customer_service'::app_role));

CREATE OR REPLACE FUNCTION public.get_plaza_remitente(_user_id uuid, _email text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT plaza_id FROM public.profiles WHERE _user_id IS NOT NULL AND user_id = _user_id LIMIT 1),
    (SELECT plaza_id FROM public.profiles WHERE _email IS NOT NULL AND lower(email) = lower(trim(_email)) AND plaza_id IS NOT NULL LIMIT 1)
  )
$$;
REVOKE EXECUTE ON FUNCTION public.get_plaza_remitente(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_plaza_remitente(uuid, text) TO authenticated;