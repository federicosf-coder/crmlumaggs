-- Trigger para forzar mayúsculas en companies.name y companies.razon_social
CREATE OR REPLACE FUNCTION public.companies_uppercase_names()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.name IS NOT NULL THEN
    NEW.name := upper(NEW.name);
  END IF;
  IF NEW.razon_social IS NOT NULL THEN
    NEW.razon_social := upper(NEW.razon_social);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_companies_uppercase_names ON public.companies;
CREATE TRIGGER trg_companies_uppercase_names
BEFORE INSERT OR UPDATE OF name, razon_social ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.companies_uppercase_names();

-- Backfill: convertir registros existentes a mayúsculas
UPDATE public.companies
SET name = upper(name)
WHERE name IS NOT NULL AND name <> upper(name);

UPDATE public.companies
SET razon_social = upper(razon_social)
WHERE razon_social IS NOT NULL AND razon_social <> upper(razon_social);