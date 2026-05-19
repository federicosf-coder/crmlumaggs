ALTER TABLE public.credit_requests
  ADD COLUMN IF NOT EXISTS poder_representante_requerido boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS registro_publico_requerido boolean NOT NULL DEFAULT false;

-- Backfill: where poder_en_acta_constitutiva is false, the poder was required separately
UPDATE public.credit_requests
   SET poder_representante_requerido = true
 WHERE poder_en_acta_constitutiva IS FALSE;