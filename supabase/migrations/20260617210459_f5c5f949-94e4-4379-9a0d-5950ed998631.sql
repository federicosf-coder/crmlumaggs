ALTER TABLE public.presentaciones
  ADD COLUMN IF NOT EXISTS pallet_chevron integer,
  ADD COLUMN IF NOT EXISTS pallet_phillips integer;