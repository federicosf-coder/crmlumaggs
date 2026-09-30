ALTER TABLE public.inv_reclamos
  ADD COLUMN IF NOT EXISTS id_reclamo_proveedor text,
  ADD COLUMN IF NOT EXISTS id_reclamo_fecha timestamp with time zone;