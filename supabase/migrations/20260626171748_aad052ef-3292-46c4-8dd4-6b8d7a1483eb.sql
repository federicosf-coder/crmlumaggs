
CREATE TABLE IF NOT EXISTS public.short_links (
  code text PRIMARY KEY,
  target_url text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.short_links TO authenticated;
GRANT ALL ON public.short_links TO service_role;

ALTER TABLE public.short_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can insert short links"
  ON public.short_links FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated can read short links"
  ON public.short_links FOR SELECT TO authenticated
  USING (true);

-- Resolver público (sin login) usado por la pantalla /p/:code
CREATE OR REPLACE FUNCTION public.resolve_short_link(_code text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT target_url
  FROM public.short_links
  WHERE code = _code
    AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_short_link(text) TO anon, authenticated;

-- Creador con código aleatorio de 7 caracteres (alfanumérico mayúsculas)
CREATE OR REPLACE FUNCTION public.create_short_link(_target_url text, _expires_at timestamptz DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  _code text;
  _i int;
  _attempt int := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'auth required';
  END IF;
  LOOP
    _code := '';
    FOR _i IN 1..7 LOOP
      _code := _code || substr(_alphabet, 1 + floor(random() * length(_alphabet))::int, 1);
    END LOOP;
    BEGIN
      INSERT INTO public.short_links(code, target_url, created_by, expires_at)
      VALUES (_code, _target_url, auth.uid(), _expires_at);
      RETURN _code;
    EXCEPTION WHEN unique_violation THEN
      _attempt := _attempt + 1;
      IF _attempt > 10 THEN RAISE; END IF;
    END;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_short_link(text, timestamptz) TO authenticated;
