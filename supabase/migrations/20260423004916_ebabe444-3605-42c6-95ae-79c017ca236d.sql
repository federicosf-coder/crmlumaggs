-- Add forma_pago (SAT catalog) to documentos and companies
ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS forma_pago text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS forma_pago text;