ALTER TABLE public.documento_autorizaciones_precio
  ADD COLUMN IF NOT EXISTS datos_cliente_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;