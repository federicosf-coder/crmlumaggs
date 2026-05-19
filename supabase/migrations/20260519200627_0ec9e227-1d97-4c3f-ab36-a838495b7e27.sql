ALTER TABLE public.credit_requests
  ADD COLUMN IF NOT EXISTS estado_cuenta_requerido boolean NOT NULL DEFAULT false;