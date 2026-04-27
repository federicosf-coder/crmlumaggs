-- Drop legacy single-column uniqueness on wa_phone
ALTER TABLE public.whatsapp_conversations
  DROP CONSTRAINT IF EXISTS whatsapp_conversations_wa_phone_key;

-- Allow same wa_phone to have one conversation per business line
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_conversations_wa_phone_business_uidx
  ON public.whatsapp_conversations (wa_phone, business_phone_number_id);

-- Rename account label for clarity in the inbox tabs
UPDATE public.whatsapp_accounts
   SET label = 'Chevron'
 WHERE business_phone_number_id = '498690943338066';