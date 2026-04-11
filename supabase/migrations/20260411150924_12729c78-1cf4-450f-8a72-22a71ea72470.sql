
-- Create companies table
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  industry TEXT,
  website TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create contacts table
CREATE TABLE public.contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  mobile TEXT,
  job_title TEXT,
  department TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_contacts_updated_at BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS for companies
CREATE POLICY "Authenticated can view companies" ON public.companies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage companies" ON public.companies FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Managers can manage companies" ON public.companies FOR ALL USING (public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Sales can manage companies" ON public.companies FOR ALL USING (public.has_role(auth.uid(), 'sales'));
CREATE POLICY "CS can manage companies" ON public.companies FOR ALL USING (public.has_role(auth.uid(), 'customer_service'));

-- RLS for contacts
CREATE POLICY "Authenticated can view contacts" ON public.contacts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage contacts" ON public.contacts FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Managers can manage contacts" ON public.contacts FOR ALL USING (public.has_role(auth.uid(), 'manager'));
CREATE POLICY "Sales can manage contacts" ON public.contacts FOR ALL USING (public.has_role(auth.uid(), 'sales'));
CREATE POLICY "CS can manage contacts" ON public.contacts FOR ALL USING (public.has_role(auth.uid(), 'customer_service'));

-- Indexes
CREATE INDEX idx_contacts_company_id ON public.contacts(company_id);
CREATE INDEX idx_companies_name ON public.companies(name);
CREATE INDEX idx_contacts_last_name ON public.contacts(last_name);
