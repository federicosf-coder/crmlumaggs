-- Add business phone number ID tracking for multi-account WhatsApp
ALTER TABLE public.whatsapp_conversations 
  ADD COLUMN IF NOT EXISTS business_phone_number_id text;

ALTER TABLE public.whatsapp_messages 
  ADD COLUMN IF NOT EXISTS business_phone_number_id text;

ALTER TABLE public.whatsapp_templates 
  ADD COLUMN IF NOT EXISTS business_phone_number_id text;

ALTER TABLE public.whatsapp_templates 
  ADD COLUMN IF NOT EXISTS waba_id text;

CREATE INDEX IF NOT EXISTS idx_wa_conv_phone_id 
  ON public.whatsapp_conversations(business_phone_number_id);
CREATE INDEX IF NOT EXISTS idx_wa_msg_phone_id 
  ON public.whatsapp_messages(business_phone_number_id);
CREATE INDEX IF NOT EXISTS idx_wa_tpl_phone_id 
  ON public.whatsapp_templates(business_phone_number_id);

COMMENT ON COLUMN public.whatsapp_conversations.business_phone_number_id IS 
  'Meta phone_number_id of the business line that owns this conversation (for multi-account support)';
COMMENT ON COLUMN public.whatsapp_messages.business_phone_number_id IS 
  'Meta phone_number_id of the business line through which this message was sent/received';
COMMENT ON COLUMN public.whatsapp_templates.business_phone_number_id IS 
  'Meta phone_number_id this template is authorized for (filters template selector per account)';