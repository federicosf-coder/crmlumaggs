
-- Short code generator for credit_requests
CREATE OR REPLACE FUNCTION public.generate_credit_short_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
  exists_already boolean;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..7 LOOP
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM public.credit_requests WHERE short_code = code) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN code;
END;
$$;

-- Add short_code + contact_id columns
ALTER TABLE public.credit_requests
  ADD COLUMN IF NOT EXISTS short_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;

-- Backfill short codes for existing rows
UPDATE public.credit_requests
SET short_code = public.generate_credit_short_code()
WHERE short_code IS NULL;

-- Trigger to auto-generate short_code on insert
CREATE OR REPLACE FUNCTION public.set_credit_short_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.short_code IS NULL THEN
    NEW.short_code := public.generate_credit_short_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_credit_short_code ON public.credit_requests;
CREATE TRIGGER trg_set_credit_short_code
BEFORE INSERT ON public.credit_requests
FOR EACH ROW
EXECUTE FUNCTION public.set_credit_short_code();

CREATE INDEX IF NOT EXISTS idx_credit_requests_short_code ON public.credit_requests(short_code);

-- Public RPC to resolve short_code -> client_token (for short URLs)
CREATE OR REPLACE FUNCTION public.resolve_credit_short_code(code text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT client_token FROM public.credit_requests WHERE short_code = code LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_credit_short_code(text) TO anon, authenticated;
