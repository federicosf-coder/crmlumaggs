ALTER TABLE public.whatsapp_campaigns
  ADD COLUMN IF NOT EXISTS audience_id uuid NULL REFERENCES public.whatsapp_audiences(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS audience_name text NULL,
  ADD COLUMN IF NOT EXISTS audience_filters jsonb NULL,
  ADD COLUMN IF NOT EXISTS exclude_recent boolean NULL;