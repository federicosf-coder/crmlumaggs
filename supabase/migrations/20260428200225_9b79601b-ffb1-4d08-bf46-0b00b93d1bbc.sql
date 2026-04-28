ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS plaza_id uuid;

-- Backfill desde la empresa
UPDATE public.crm_deals d
SET plaza_id = c.plaza_id
FROM public.companies c
WHERE d.company_id = c.id AND d.plaza_id IS NULL AND c.plaza_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_crm_deals_plaza_id ON public.crm_deals(plaza_id);