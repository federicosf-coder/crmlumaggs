
ALTER TABLE public.credit_requests
  ADD COLUMN IF NOT EXISTS rep_legal_vencimiento_id date;
