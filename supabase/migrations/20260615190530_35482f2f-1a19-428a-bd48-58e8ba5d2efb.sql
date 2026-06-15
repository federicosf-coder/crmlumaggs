
CREATE TABLE public.template_document_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.template_document_catalog TO authenticated;
GRANT ALL ON public.template_document_catalog TO service_role;

ALTER TABLE public.template_document_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read catalog docs"
  ON public.template_document_catalog FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Authenticated can insert catalog docs"
  ON public.template_document_catalog FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update catalog docs"
  ON public.template_document_catalog FOR UPDATE TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "Authenticated can delete catalog docs"
  ON public.template_document_catalog FOR DELETE TO authenticated USING (TRUE);

CREATE TRIGGER update_template_document_catalog_updated_at
  BEFORE UPDATE ON public.template_document_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "tdc_read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'template-document-catalog');

CREATE POLICY "tdc_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'template-document-catalog');

CREATE POLICY "tdc_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'template-document-catalog');

CREATE POLICY "tdc_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'template-document-catalog');
