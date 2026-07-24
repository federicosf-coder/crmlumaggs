ALTER TABLE public.credit_requests
  ADD COLUMN IF NOT EXISTS cescemex_share_token text,
  ADD COLUMN IF NOT EXISTS cescemex_share_expires_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_requests_cescemex_token
  ON public.credit_requests(cescemex_share_token) WHERE cescemex_share_token IS NOT NULL;