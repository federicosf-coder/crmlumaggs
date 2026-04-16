ALTER TABLE public.direcciones_empresa
ADD COLUMN IF NOT EXISTS pais text,
ADD COLUMN IF NOT EXISTS direccion_completa text;