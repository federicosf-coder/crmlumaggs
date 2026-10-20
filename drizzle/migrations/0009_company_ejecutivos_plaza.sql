ALTER TABLE public.company_ejecutivos ADD COLUMN IF NOT EXISTS plaza_id uuid NULL REFERENCES public.plazas(id) ON DELETE SET NULL;
UPDATE public.company_ejecutivos ce SET plaza_id = p.plaza_id FROM public.profiles p WHERE p.user_id = ce.user_id AND ce.plaza_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_company_ejecutivos_company_plaza ON public.company_ejecutivos(company_id, plaza_id);
COMMENT ON COLUMN public.company_ejecutivos.plaza_id IS 'Plaza en la que este ejecutivo atiende a la empresa; define a quién se atribuyen facturas de esa plaza.';