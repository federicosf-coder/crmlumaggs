ALTER TABLE public.inv_demanda_plaza
  DROP CONSTRAINT IF EXISTS inv_demanda_plaza_codigo_almacen_periodo_key;

ALTER TABLE public.inv_demanda_plaza
  ADD CONSTRAINT inv_demanda_plaza_codigo_almacen_periodo_key
  UNIQUE (codigo_producto, almacen, periodo_inicio);