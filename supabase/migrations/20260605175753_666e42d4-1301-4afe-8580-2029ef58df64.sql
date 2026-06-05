CREATE OR REPLACE FUNCTION public.contacts_propercase_names()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.first_name IS NOT NULL THEN
    NEW.first_name := initcap(lower(NEW.first_name));
  END IF;
  IF NEW.last_name IS NOT NULL THEN
    NEW.last_name := initcap(lower(NEW.last_name));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contacts_propercase_names ON public.contacts;
CREATE TRIGGER trg_contacts_propercase_names
BEFORE INSERT OR UPDATE OF first_name, last_name ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.contacts_propercase_names();

UPDATE public.contacts
SET first_name = initcap(lower(first_name))
WHERE first_name IS NOT NULL AND first_name <> initcap(lower(first_name));

UPDATE public.contacts
SET last_name = initcap(lower(last_name))
WHERE last_name IS NOT NULL AND last_name <> initcap(lower(last_name));