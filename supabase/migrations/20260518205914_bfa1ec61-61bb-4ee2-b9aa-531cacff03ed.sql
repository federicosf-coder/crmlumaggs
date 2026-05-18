
-- Add validity type to doc types (dias = fecha_emision + vigencia_dias; fin_mes_emision = último día del mes de emisión)
ALTER TABLE public.credit_doc_types
  ADD COLUMN IF NOT EXISTS validez_tipo text NOT NULL DEFAULT 'dias' CHECK (validez_tipo IN ('dias','fin_mes_emision'));

-- Add fecha_emision and metadata (extracted info for verification) to docs
ALTER TABLE public.credit_request_docs
  ADD COLUMN IF NOT EXISTS fecha_emision date,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Seed sensible defaults for known doc types (no-op if names differ)
UPDATE public.credit_doc_types
  SET vigencia_dias = 60
  WHERE (nombre ILIKE '%constancia de situación fiscal%' OR nombre ILIKE '%csf%')
    AND (vigencia_dias IS NULL OR vigencia_dias = 0);

UPDATE public.credit_doc_types
  SET vigencia_dias = 90
  WHERE nombre ILIKE '%comprobante de domicilio%'
    AND (vigencia_dias IS NULL OR vigencia_dias = 0);

UPDATE public.credit_doc_types
  SET validez_tipo = 'fin_mes_emision', vigencia_dias = NULL
  WHERE nombre ILIKE '%opinión de cumplimiento%' OR nombre ILIKE '%32-d%' OR nombre ILIKE '%opinion de cumplimiento%';
