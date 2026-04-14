
ALTER TABLE public.companies
ADD COLUMN plaza_id uuid REFERENCES public.plazas(id) ON DELETE SET NULL;
