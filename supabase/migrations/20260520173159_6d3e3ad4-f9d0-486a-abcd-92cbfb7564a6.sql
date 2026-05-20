
ALTER TABLE public.credit_requests
  ADD COLUMN IF NOT EXISTS rpp_solicitante_encontrado boolean,
  ADD COLUMN IF NOT EXISTS rpp_solicitante_doc_path text,
  ADD COLUMN IF NOT EXISTS rpp_solicitante_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS rpp_aval_encontrado boolean,
  ADD COLUMN IF NOT EXISTS rpp_aval_doc_path text,
  ADD COLUMN IF NOT EXISTS rpp_aval_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS resumen_empresa text,
  ADD COLUMN IF NOT EXISTS resumen_empresa_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS resumen_empresa_generated_by uuid;
