DROP INDEX IF EXISTS entcorp_cliente_ubic_fecha_uniq;

CREATE UNIQUE INDEX entcorp_cliente_ubic_fecha_pedido_uniq
  ON public.entregas_corporativas (
    cliente,
    COALESCE(ubicacion_id, '00000000-0000-0000-0000-000000000000'::uuid),
    fecha_programada,
    COALESCE(numero_pedido, '')
  );