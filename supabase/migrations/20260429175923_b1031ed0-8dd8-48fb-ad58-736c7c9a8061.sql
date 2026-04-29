
-- 1) whatsapp_templates: header + rejection
ALTER TABLE public.whatsapp_templates
  ADD COLUMN IF NOT EXISTS header_type text NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS header_image_url text,
  ADD COLUMN IF NOT EXISTS header_text text,
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS quality_score text;

-- header_type allowed values: NONE, TEXT, IMAGE, VIDEO, DOCUMENT
ALTER TABLE public.whatsapp_templates
  DROP CONSTRAINT IF EXISTS whatsapp_templates_header_type_check;
ALTER TABLE public.whatsapp_templates
  ADD CONSTRAINT whatsapp_templates_header_type_check
  CHECK (header_type IN ('NONE','TEXT','IMAGE','VIDEO','DOCUMENT'));

-- 2) whatsapp_campaigns: header image + selector de línea
ALTER TABLE public.whatsapp_campaigns
  ADD COLUMN IF NOT EXISTS header_image_url text,
  ADD COLUMN IF NOT EXISTS business_phone_number_id text;

-- 3) Bucket público para imágenes promocionales de marketing
INSERT INTO storage.buckets (id, name, public)
VALUES ('marketing-promos', 'marketing-promos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Policies del bucket: lectura pública, escritura para autenticados
DROP POLICY IF EXISTS "marketing-promos public read" ON storage.objects;
CREATE POLICY "marketing-promos public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'marketing-promos');

DROP POLICY IF EXISTS "marketing-promos auth insert" ON storage.objects;
CREATE POLICY "marketing-promos auth insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'marketing-promos');

DROP POLICY IF EXISTS "marketing-promos auth update" ON storage.objects;
CREATE POLICY "marketing-promos auth update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'marketing-promos')
  WITH CHECK (bucket_id = 'marketing-promos');

DROP POLICY IF EXISTS "marketing-promos auth delete" ON storage.objects;
CREATE POLICY "marketing-promos auth delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'marketing-promos');
