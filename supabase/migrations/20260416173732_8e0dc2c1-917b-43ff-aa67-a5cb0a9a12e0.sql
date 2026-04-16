
-- Add new values to tipo_direccion enum
ALTER TYPE public.tipo_direccion ADD VALUE IF NOT EXISTS 'sucursal';
ALTER TYPE public.tipo_direccion ADD VALUE IF NOT EXISTS 'principal';

-- Add new columns to direcciones_empresa
ALTER TABLE public.direcciones_empresa
  ADD COLUMN IF NOT EXISTS coordenadas_lat numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS coordenadas_lng numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS codigo_google text DEFAULT NULL;
