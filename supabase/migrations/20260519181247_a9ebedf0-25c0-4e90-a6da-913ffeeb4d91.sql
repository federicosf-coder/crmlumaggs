ALTER TABLE public.credit_requests
  ADD COLUMN IF NOT EXISTS bc_confirmacion_no_existe boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS bc_es_representante_legal boolean;