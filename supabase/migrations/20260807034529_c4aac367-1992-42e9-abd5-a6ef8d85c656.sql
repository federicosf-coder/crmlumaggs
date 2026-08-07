ALTER TABLE public.inv_solicitudes_extraordinarias
  ALTER COLUMN codigo_producto DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS producto_descripcion text;

ALTER TABLE public.inv_solicitudes_extraordinarias
  ADD CONSTRAINT solext_codigo_o_descripcion CHECK (codigo_producto IS NOT NULL OR producto_descripcion IS NOT NULL);