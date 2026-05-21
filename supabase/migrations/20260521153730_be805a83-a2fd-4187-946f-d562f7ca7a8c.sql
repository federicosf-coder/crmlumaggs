ALTER TABLE public.rutas_entrega
  ADD COLUMN IF NOT EXISTS ruta_started_at_editada_por uuid,
  ADD COLUMN IF NOT EXISTS ruta_started_at_editada_at timestamptz,
  ADD COLUMN IF NOT EXISTS ruta_finished_at_editada_por uuid,
  ADD COLUMN IF NOT EXISTS ruta_finished_at_editada_at timestamptz;