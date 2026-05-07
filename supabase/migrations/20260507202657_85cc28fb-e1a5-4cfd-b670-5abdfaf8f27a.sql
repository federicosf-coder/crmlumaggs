ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS primary_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_companies_primary_contact_id ON public.companies(primary_contact_id);