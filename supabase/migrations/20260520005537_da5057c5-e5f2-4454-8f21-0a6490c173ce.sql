ALTER TABLE public.entregas_programadas
  ADD COLUMN IF NOT EXISTS fecha_entrega_real_editada_por uuid,
  ADD COLUMN IF NOT EXISTS fecha_entrega_real_editada_at timestamptz;