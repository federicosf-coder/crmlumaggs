CREATE TABLE public.credit_privacy_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_request_id uuid NOT NULL REFERENCES public.credit_requests(id) ON DELETE CASCADE,
  aviso_version text NOT NULL,
  aviso_hash text NOT NULL,
  firmante_nombre text NOT NULL,
  firmante_puesto text,
  firmante_email text,
  firma_trazo text NOT NULL,
  ip text,
  user_agent text,
  signed_at timestamptz NOT NULL DEFAULT now(),
  evidencia_xml text NOT NULL,
  evidencia_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.credit_privacy_consents(credit_request_id);
GRANT SELECT ON public.credit_privacy_consents TO authenticated;
GRANT ALL ON public.credit_privacy_consents TO service_role;
ALTER TABLE public.credit_privacy_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios internos ven consentimientos" ON public.credit_privacy_consents
FOR SELECT TO authenticated USING (true);