ALTER TABLE public.credit_requests
  ADD COLUMN IF NOT EXISTS sync_correo_contacto boolean NOT NULL DEFAULT false;