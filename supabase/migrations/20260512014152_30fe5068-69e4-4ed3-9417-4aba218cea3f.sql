
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS plaza_id uuid REFERENCES public.plazas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_plaza_id ON public.contacts(plaza_id);

-- Backfill from sede enum (only mexicali/tijuana exist)
UPDATE public.contacts c
SET plaza_id = p.id
FROM public.plazas p
WHERE c.plaza_id IS NULL
  AND c.sede IS NOT NULL
  AND lower(p.nombre) = lower(c.sede::text);

-- Backfill from company plaza for the rest
UPDATE public.contacts c
SET plaza_id = co.plaza_id
FROM public.companies co
WHERE c.plaza_id IS NULL
  AND c.company_id = co.id
  AND co.plaza_id IS NOT NULL;

-- Trigger: inherit plaza from company when not set
CREATE OR REPLACE FUNCTION public.contact_inherit_plaza_from_company()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.plaza_id IS NULL AND NEW.company_id IS NOT NULL THEN
    SELECT plaza_id INTO NEW.plaza_id FROM public.companies WHERE id = NEW.company_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contact_inherit_plaza ON public.contacts;
CREATE TRIGGER trg_contact_inherit_plaza
BEFORE INSERT OR UPDATE OF company_id, plaza_id ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.contact_inherit_plaza_from_company();
