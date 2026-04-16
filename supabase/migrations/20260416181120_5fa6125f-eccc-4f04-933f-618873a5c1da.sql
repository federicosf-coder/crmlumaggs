CREATE TABLE public.cobranza_pago_archivos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pago_id UUID NOT NULL REFERENCES public.cobranza_pagos(id) ON DELETE CASCADE,
  url_archivo TEXT NOT NULL,
  nombre_archivo TEXT NOT NULL,
  tipo_archivo TEXT NOT NULL,
  usuario_carga UUID,
  fecha_carga TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cobranza_pago_archivos_pago ON public.cobranza_pago_archivos(pago_id);

ALTER TABLE public.cobranza_pago_archivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view pago archivos" ON public.cobranza_pago_archivos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage pago archivos" ON public.cobranza_pago_archivos FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers can manage pago archivos" ON public.cobranza_pago_archivos FOR ALL USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Accounting can manage pago archivos" ON public.cobranza_pago_archivos FOR ALL USING (has_role(auth.uid(), 'accounting'::app_role));