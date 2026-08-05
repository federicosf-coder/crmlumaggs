ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS costo_mercado_vigente numeric,
  ADD COLUMN IF NOT EXISTS costo_mercado_fecha date,
  ADD COLUMN IF NOT EXISTS costo_mercado_pendiente_baja boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS costo_mercado_pendiente_desde date,
  ADD COLUMN IF NOT EXISTS costo_confirmado_en_ultima_lista boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS costo_confirmado_fecha date;