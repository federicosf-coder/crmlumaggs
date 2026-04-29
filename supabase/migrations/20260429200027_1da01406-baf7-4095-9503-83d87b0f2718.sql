-- Soporte para botones interactivos en plantillas WhatsApp
ALTER TABLE public.whatsapp_templates
  ADD COLUMN IF NOT EXISTS buttons jsonb DEFAULT '[]'::jsonb;

-- Marca de "No contactar" para campañas de marketing
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS no_contactar boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS no_contactar_fecha timestamp with time zone,
  ADD COLUMN IF NOT EXISTS no_contactar_motivo text;

CREATE INDEX IF NOT EXISTS idx_contacts_no_contactar ON public.contacts (no_contactar) WHERE no_contactar = true;