CREATE TABLE public.crm_task_evidencias (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.crm_tasks(id) ON DELETE CASCADE,
  user_id uuid,
  storage_path text NOT NULL,
  file_name text,
  captured_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_task_evidencias_task ON public.crm_task_evidencias(task_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_task_evidencias TO authenticated;
GRANT ALL ON public.crm_task_evidencias TO service_role;

ALTER TABLE public.crm_task_evidencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados ven evidencias" ON public.crm_task_evidencias
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuarios autenticados agregan evidencias" ON public.crm_task_evidencias
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Autor o admin elimina evidencias" ON public.crm_task_evidencias
  FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Autenticados leen evidencias de visita" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'visita-evidencias');
CREATE POLICY "Autenticados suben evidencias de visita" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'visita-evidencias');
CREATE POLICY "Autenticados borran evidencias de visita" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'visita-evidencias');