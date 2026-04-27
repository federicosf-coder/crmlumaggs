-- Extender crm_activities para registrar metadata de WhatsApp enviado desde negocio
ALTER TABLE public.crm_activities
  ADD COLUMN IF NOT EXISTS documento_id uuid,
  ADD COLUMN IF NOT EXISTS destinatario_phone text,
  ADD COLUMN IF NOT EXISTS message_type text,
  ADD COLUMN IF NOT EXISTS channel text,
  ADD COLUMN IF NOT EXISTS wa_message_id text,
  ADD COLUMN IF NOT EXISTS wa_conversation_id uuid;

CREATE INDEX IF NOT EXISTS crm_activities_deal_id_idx ON public.crm_activities (deal_id);
CREATE INDEX IF NOT EXISTS crm_activities_documento_id_idx ON public.crm_activities (documento_id);