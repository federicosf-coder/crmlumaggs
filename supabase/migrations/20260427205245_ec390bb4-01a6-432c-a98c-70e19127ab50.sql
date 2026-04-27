ALTER TABLE public.rutas_entrega
  ADD COLUMN IF NOT EXISTS ruta_finished_at timestamptz,
  ADD COLUMN IF NOT EXISTS ruta_finished_by uuid;