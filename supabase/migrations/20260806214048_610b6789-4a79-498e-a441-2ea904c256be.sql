-- Constraint único para poder actualizar líneas de pedido sin duplicar al re-subir el mismo PO
ALTER TABLE public.inv_pedido_lineas
  ADD CONSTRAINT inv_pedido_lineas_pedido_codigo_uniq UNIQUE (pedido_id, codigo_producto);