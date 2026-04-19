CREATE TYPE public.vehiculo_icon AS ENUM ('pickup', 'truck');

ALTER TABLE public.vehiculos
  ADD COLUMN icon public.vehiculo_icon NOT NULL DEFAULT 'truck',
  ADD COLUMN color text NOT NULL DEFAULT '#3b82f6';