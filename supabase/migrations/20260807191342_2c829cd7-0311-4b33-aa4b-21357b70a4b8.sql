CREATE TABLE IF NOT EXISTS public.entregas_corporativas_ubicaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente text NOT NULL,
  nombre text NOT NULL,
  direccion text,
  lat numeric,
  lng numeric,
  instrucciones text,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.entregas_corporativas_ubicaciones ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entregas_corporativas_ubicaciones TO authenticated;
GRANT ALL ON public.entregas_corporativas_ubicaciones TO service_role;

CREATE POLICY "entcorp_ubic_select" ON public.entregas_corporativas_ubicaciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "entcorp_ubic_write" ON public.entregas_corporativas_ubicaciones FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'warehouse'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'warehouse'::app_role));

CREATE TRIGGER trg_entcorp_ubic_updated_at
  BEFORE UPDATE ON public.entregas_corporativas_ubicaciones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.entregas_corporativas_ubicaciones (cliente, nombre)
VALUES ('Kenworth', 'Planta Kenworth (única)')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.entregas_corporativas_lineas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entrega_id uuid NOT NULL,
  codigo_producto text NOT NULL,
  nombre_producto text,
  cantidad numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.entregas_corporativas_lineas ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entregas_corporativas_lineas TO authenticated;
GRANT ALL ON public.entregas_corporativas_lineas TO service_role;

CREATE POLICY "entcorp_lineas_select" ON public.entregas_corporativas_lineas FOR SELECT TO authenticated USING (true);
CREATE POLICY "entcorp_lineas_write" ON public.entregas_corporativas_lineas FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'warehouse'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'warehouse'::app_role));

DO $$
DECLARE
  r record;
  v_new_id uuid;
BEGIN
  FOR r IN
    SELECT DISTINCT cliente, fecha_programada FROM public.entregas_corporativas
  LOOP
    SELECT id INTO v_new_id FROM public.entregas_corporativas
      WHERE cliente = r.cliente AND fecha_programada = r.fecha_programada
      ORDER BY created_at ASC LIMIT 1;

    INSERT INTO public.entregas_corporativas_lineas (entrega_id, codigo_producto, nombre_producto, cantidad)
    SELECT v_new_id, codigo_producto, nombre_producto, cantidad
    FROM public.entregas_corporativas
    WHERE cliente = r.cliente AND fecha_programada = r.fecha_programada;

    DELETE FROM public.entregas_corporativas
    WHERE cliente = r.cliente AND fecha_programada = r.fecha_programada AND id <> v_new_id;
  END LOOP;
END $$;

ALTER TABLE public.entregas_corporativas
  ADD COLUMN IF NOT EXISTS ubicacion_id uuid REFERENCES public.entregas_corporativas_ubicaciones(id),
  ADD COLUMN IF NOT EXISTS lugar_entrega_texto text;

ALTER TABLE public.entregas_corporativas DROP CONSTRAINT IF EXISTS entregas_corporativas_cliente_codigo_producto_fecha_progra_key;

ALTER TABLE public.entregas_corporativas
  DROP COLUMN IF EXISTS codigo_producto,
  DROP COLUMN IF EXISTS nombre_producto,
  DROP COLUMN IF EXISTS cantidad;

CREATE UNIQUE INDEX IF NOT EXISTS entcorp_cliente_ubic_fecha_uniq
  ON public.entregas_corporativas (cliente, COALESCE(ubicacion_id, '00000000-0000-0000-0000-000000000000'::uuid), fecha_programada);

CREATE INDEX IF NOT EXISTS idx_entcorp_lineas_entrega ON public.entregas_corporativas_lineas(entrega_id);