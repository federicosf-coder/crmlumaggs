
-- Create documentos storage bucket (public read for simple URL access)
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos', 'documentos', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for the documentos bucket
CREATE POLICY "Documentos public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'documentos');

CREATE POLICY "Authenticated can upload documentos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documentos');

CREATE POLICY "Authenticated can update documentos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'documentos');

CREATE POLICY "Authenticated can delete documentos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'documentos');
