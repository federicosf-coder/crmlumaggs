CREATE OR REPLACE FUNCTION public.generate_credito_folio()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  yr text := to_char(now(),'YYYY');
  next_seq int;
BEGIN
  IF NEW.folio IS NOT NULL AND NEW.folio <> '' THEN
    RETURN NEW;
  END IF;
  LOOP
    SELECT COALESCE(MAX( (regexp_replace(folio, '^CR-\d{4}-', ''))::int ), 0) + 1
      INTO next_seq
    FROM public.credit_requests
    WHERE folio LIKE 'CR-' || yr || '-%';
    NEW.folio := 'CR-' || yr || '-' || lpad(next_seq::text, 4, '0');
    IF NOT EXISTS (SELECT 1 FROM public.credit_requests WHERE folio = NEW.folio) THEN
      RETURN NEW;
    END IF;
  END LOOP;
END;
$function$;