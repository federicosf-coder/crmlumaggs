
-- Storage bucket para adjuntos de plantillas
INSERT INTO storage.buckets (id, name, public)
VALUES ('template-attachments', 'template-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Tabla de adjuntos
CREATE TABLE IF NOT EXISTS public.template_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.templates(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_template_attachments_template ON public.template_attachments(template_id);

ALTER TABLE public.template_attachments ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario autenticado puede ver los adjuntos (igual que las plantillas)
DROP POLICY IF EXISTS "Authenticated can view template attachments" ON public.template_attachments;
CREATE POLICY "Authenticated can view template attachments"
  ON public.template_attachments FOR SELECT
  TO authenticated USING (true);

-- Solo admins pueden gestionar (igual que templates)
DROP POLICY IF EXISTS "Admins manage template attachments" ON public.template_attachments;
CREATE POLICY "Admins manage template attachments"
  ON public.template_attachments FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Storage policies para bucket template-attachments
DROP POLICY IF EXISTS "Public can read template attachments" ON storage.objects;
CREATE POLICY "Public can read template attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'template-attachments');

DROP POLICY IF EXISTS "Admins upload template attachments" ON storage.objects;
CREATE POLICY "Admins upload template attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'template-attachments' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins update template attachments" ON storage.objects;
CREATE POLICY "Admins update template attachments"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'template-attachments' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins delete template attachments" ON storage.objects;
CREATE POLICY "Admins delete template attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'template-attachments' AND public.has_role(auth.uid(), 'admin'::app_role));
