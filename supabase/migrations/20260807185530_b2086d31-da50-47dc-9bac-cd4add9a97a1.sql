CREATE TABLE IF NOT EXISTS public.entregas_corporativas_calendarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente text NOT NULL,
  nombre_archivo text NOT NULL,
  storage_path text NOT NULL,
  extraido_por_ia boolean NOT NULL DEFAULT true,
  datos_extraidos jsonb,
  subido_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.entregas_corporativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  calendario_id uuid REFERENCES public.entregas_corporativas_calendarios(id) ON DELETE SET NULL,
  cliente text NOT NULL,
  codigo_producto text NOT NULL,
  nombre_producto text,
  cantidad numeric NOT NULL,
  fecha_programada date NOT NULL,
  estatus text NOT NULL DEFAULT 'programada' CHECK (estatus IN ('programada','entregada','cancelada')),
  pdf_entrega_path text,
  evidencia_firmada_path text,
  factura_referencia text,
  notificado_at timestamptz,
  notificado_por uuid,
  notas text,
  creado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente, codigo_producto, fecha_programada)
);

CREATE INDEX IF NOT EXISTS idx_entcorp_codigo ON public.entregas_corporativas(codigo_producto);
CREATE INDEX IF NOT EXISTS idx_entcorp_estatus ON public.entregas_corporativas(estatus);

ALTER TABLE public.entregas_corporativas_calendarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entregas_corporativas ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.entregas_corporativas_calendarios TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entregas_corporativas TO authenticated;

CREATE POLICY "entcorp_cal_select" ON public.entregas_corporativas_calendarios FOR SELECT TO authenticated USING (true);
CREATE POLICY "entcorp_cal_write" ON public.entregas_corporativas_calendarios FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'warehouse'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'warehouse'::app_role));

CREATE POLICY "entcorp_select" ON public.entregas_corporativas FOR SELECT TO authenticated USING (true);
CREATE POLICY "entcorp_write" ON public.entregas_corporativas FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'warehouse'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'warehouse'::app_role));

CREATE TRIGGER trg_entcorp_updated_at
  BEFORE UPDATE ON public.entregas_corporativas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "entcorp_bucket_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'entregas-corporativas');
CREATE POLICY "entcorp_bucket_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'entregas-corporativas');
CREATE POLICY "entcorp_bucket_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'entregas-corporativas');
CREATE POLICY "entcorp_bucket_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'entregas-corporativas');
