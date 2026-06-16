ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS limite_credito numeric NOT NULL DEFAULT 0;