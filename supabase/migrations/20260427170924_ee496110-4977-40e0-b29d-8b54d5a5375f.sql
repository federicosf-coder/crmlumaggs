ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS comm_email boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS comm_whatsapp boolean NOT NULL DEFAULT false;

UPDATE public.contacts
   SET comm_email = true
 WHERE comm_email = false AND email IS NOT NULL AND email <> '';

UPDATE public.contacts
   SET comm_whatsapp = true
 WHERE comm_whatsapp = false AND mobile IS NOT NULL AND mobile <> '';

UPDATE public.contacts
   SET comm_email = true
 WHERE comm_email = false AND comm_whatsapp = false;