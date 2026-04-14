
-- Junction table: company <-> ejecutivo de venta
CREATE TABLE public.company_ejecutivos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, user_id)
);

ALTER TABLE public.company_ejecutivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view company_ejecutivos" ON public.company_ejecutivos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage company_ejecutivos" ON public.company_ejecutivos FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers can manage company_ejecutivos" ON public.company_ejecutivos FOR ALL USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Sales can manage company_ejecutivos" ON public.company_ejecutivos FOR ALL USING (has_role(auth.uid(), 'sales'::app_role));
CREATE POLICY "CS can manage company_ejecutivos" ON public.company_ejecutivos FOR ALL USING (has_role(auth.uid(), 'customer_service'::app_role));

-- Junction table: contact <-> ejecutivo de venta
CREATE TABLE public.contact_ejecutivos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_id UUID NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(contact_id, user_id)
);

ALTER TABLE public.contact_ejecutivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view contact_ejecutivos" ON public.contact_ejecutivos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage contact_ejecutivos" ON public.contact_ejecutivos FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers can manage contact_ejecutivos" ON public.contact_ejecutivos FOR ALL USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Sales can manage contact_ejecutivos" ON public.contact_ejecutivos FOR ALL USING (has_role(auth.uid(), 'sales'::app_role));
CREATE POLICY "CS can manage contact_ejecutivos" ON public.contact_ejecutivos FOR ALL USING (has_role(auth.uid(), 'customer_service'::app_role));
