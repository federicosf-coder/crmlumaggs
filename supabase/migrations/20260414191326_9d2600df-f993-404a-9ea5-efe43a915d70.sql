
-- Add commercial fields to companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS uso_cfdi public.uso_cfdi DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS metodo_pago public.metodo_pago_sat DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tipo_pago public.tipo_pago DEFAULT NULL;

-- Create junction table for multiple plazas per company
CREATE TABLE public.company_plazas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plaza_id uuid NOT NULL REFERENCES public.plazas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, plaza_id)
);

ALTER TABLE public.company_plazas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view company_plazas" ON public.company_plazas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage company_plazas" ON public.company_plazas FOR ALL USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Managers can manage company_plazas" ON public.company_plazas FOR ALL USING (has_role(auth.uid(), 'manager'));
CREATE POLICY "Sales can manage company_plazas" ON public.company_plazas FOR ALL USING (has_role(auth.uid(), 'sales'));
CREATE POLICY "CS can manage company_plazas" ON public.company_plazas FOR ALL USING (has_role(auth.uid(), 'customer_service'));
