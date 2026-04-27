ALTER TABLE public.rutas_entrega
  ADD COLUMN IF NOT EXISTS ruta_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ruta_started_by UUID,
  ADD COLUMN IF NOT EXISTS estatus TEXT;