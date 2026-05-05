ALTER TABLE public.whatsapp_templates ADD COLUMN IF NOT EXISTS header_video_url TEXT;
ALTER TABLE public.whatsapp_campaigns ADD COLUMN IF NOT EXISTS header_video_url TEXT;