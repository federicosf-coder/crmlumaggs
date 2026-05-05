
-- Bucket privado para archivos recibidos por WhatsApp
INSERT INTO storage.buckets (id, name, public)
VALUES ('whatsapp-media', 'whatsapp-media', false)
ON CONFLICT (id) DO NOTHING;

-- Columnas adicionales para metadatos de media
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS media_filename text,
  ADD COLUMN IF NOT EXISTS media_mime_type text,
  ADD COLUMN IF NOT EXISTS media_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS media_storage_path text;

-- Políticas RLS para el bucket whatsapp-media (solo usuarios autenticados)
DROP POLICY IF EXISTS "Authenticated can read whatsapp-media" ON storage.objects;
CREATE POLICY "Authenticated can read whatsapp-media"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'whatsapp-media');

DROP POLICY IF EXISTS "Authenticated can upload whatsapp-media" ON storage.objects;
CREATE POLICY "Authenticated can upload whatsapp-media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'whatsapp-media');
