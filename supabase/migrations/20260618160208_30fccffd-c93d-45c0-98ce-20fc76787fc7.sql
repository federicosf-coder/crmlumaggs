ALTER TABLE public.contacts DROP CONSTRAINT IF EXISTS contacts_whatsapp_phone_unique;
DROP INDEX IF EXISTS public.contacts_whatsapp_phone_unique;
DROP INDEX IF EXISTS public.contacts_whatsapp_phone_key;