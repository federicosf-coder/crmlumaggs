CREATE TABLE IF NOT EXISTS public.entregas_corporativas_evidencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entrega_id uuid NOT NULL REFERENCES public.entregas_corporativas(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  nombre_archivo text NOT NULL,
  subido_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entcorp_evid_entrega ON public.entregas_corporativas_evidencias(entrega_id);

ALTER TABLE public.entregas_corporativas_evidencias ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entregas_corporativas_evidencias TO authenticated;

CREATE POLICY "entcorp_evid_select" ON public.entregas_corporativas_evidencias FOR SELECT TO authenticated USING (true);
CREATE POLICY "entcorp_evid_write" ON public.entregas_corporativas_evidencias FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'warehouse'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'warehouse'::app_role));

-- Migrar evidencia única ya subida (si existe) a la nueva tabla
INSERT INTO public.entregas_corporativas_evidencias (entrega_id, storage_path, nombre_archivo, subido_por)
SELECT id, evidencia_firmada_path, split_part(evidencia_firmada_path, '/', -1), notificado_por
FROM public.entregas_corporativas
WHERE evidencia_firmada_path IS NOT NULL;