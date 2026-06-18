ALTER TABLE public.contacts 
  ADD COLUMN IF NOT EXISTS contacto_cobranza BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contacto_credito BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.contacts.contacto_cobranza IS 'Persona responsable de gestionar cobranza con esta empresa';
COMMENT ON COLUMN public.contacts.contacto_credito IS 'Persona responsable de trámites de crédito con esta empresa';