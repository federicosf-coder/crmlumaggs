ALTER TABLE public.credit_requests
  ADD COLUMN IF NOT EXISTS bc_tipo_persona text,
  ADD COLUMN IF NOT EXISTS bc_data jsonb NOT NULL DEFAULT '{}'::jsonb;