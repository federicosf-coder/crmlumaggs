
-- Add company_id to crm_activities
ALTER TABLE public.crm_activities ADD COLUMN company_id uuid REFERENCES public.companies(id);

-- Add company_id to crm_tasks  
ALTER TABLE public.crm_tasks ADD COLUMN company_id uuid REFERENCES public.companies(id);
