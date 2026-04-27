ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS email2 TEXT,
  ADD COLUMN IF NOT EXISTS tel_emp TEXT,
  ADD COLUMN IF NOT EXISTS comm_email2 BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS comm_cel BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS comm_tel BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS comm_tel_emp BOOLEAN NOT NULL DEFAULT false;

-- Backfill: where comm_whatsapp was true and mobile present, also mark comm_cel
UPDATE public.contacts
  SET comm_cel = true
  WHERE comm_cel = false AND mobile IS NOT NULL AND length(trim(mobile)) > 0 AND comm_whatsapp = true;