ALTER TABLE public.inv_costos_producto DROP CONSTRAINT inv_costos_producto_estado_check;
ALTER TABLE public.inv_costos_producto ADD CONSTRAINT inv_costos_producto_estado_check
  CHECK (estado = ANY (ARRAY['pendiente'::text, 'autorizado'::text, 'rechazado'::text, 'aplicado'::text, 'sin_producto'::text]));