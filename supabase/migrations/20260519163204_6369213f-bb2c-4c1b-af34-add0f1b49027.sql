-- Coordenadas por defecto de cada plaza (punto de partida de la ruta)
ALTER TABLE public.plazas
  ADD COLUMN IF NOT EXISTS lat numeric,
  ADD COLUMN IF NOT EXISTS lng numeric;

-- Tracking de distancia y tiempo por entrega programada
ALTER TABLE public.entregas_programadas
  ADD COLUMN IF NOT EXISTS km_desde_anterior numeric,
  ADD COLUMN IF NOT EXISTS tiempo_estimado_min integer,
  ADD COLUMN IF NOT EXISTS tiempo_real_min integer;