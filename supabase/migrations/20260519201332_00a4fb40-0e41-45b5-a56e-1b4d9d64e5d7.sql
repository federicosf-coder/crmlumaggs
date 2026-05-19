ALTER TABLE public.credit_requests
  ADD COLUMN IF NOT EXISTS sync_telefono_contacto boolean NOT NULL DEFAULT false;