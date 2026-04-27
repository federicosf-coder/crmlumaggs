ALTER TABLE public.whatsapp_accounts
  ADD COLUMN IF NOT EXISTS waba_id text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'disconnected';

CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_waba_id ON public.whatsapp_accounts(waba_id);