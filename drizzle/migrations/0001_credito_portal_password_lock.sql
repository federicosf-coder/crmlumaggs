ALTER TABLE public.credit_requests
  ADD COLUMN IF NOT EXISTS portal_password_hash text,
  ADD COLUMN IF NOT EXISTS portal_temp_password text DEFAULT upper(substr(md5(gen_random_uuid()::text), 1, 8)),
  ADD COLUMN IF NOT EXISTS portal_must_change boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS portal_failed_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS portal_locked_until timestamptz,
  ADD COLUMN IF NOT EXISTS portal_password_changed_at timestamptz NOT NULL DEFAULT now();

UPDATE public.credit_requests
  SET portal_temp_password = upper(substr(md5(gen_random_uuid()::text), 1, 8))
  WHERE portal_temp_password IS NULL AND portal_password_hash IS NULL;

CREATE TABLE IF NOT EXISTS public.credit_portal_sessions (
  session_token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_request_id uuid NOT NULL REFERENCES public.credit_requests(id) ON DELETE CASCADE,
  password_ok boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '12 hours')
);
GRANT ALL ON public.credit_portal_sessions TO service_role;
ALTER TABLE public.credit_portal_sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_cps_req ON public.credit_portal_sessions(credit_request_id);