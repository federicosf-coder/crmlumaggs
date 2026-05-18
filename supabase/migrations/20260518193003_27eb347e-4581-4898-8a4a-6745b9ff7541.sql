-- ============================================================
-- MÓDULO: Solicitudes de Crédito — estructura completa
-- ============================================================

-- 1. Enums (app_module ya fue extendido con 'credito' en migración previa)
CREATE TYPE public.credito_tipo AS ENUM ('cescemex','directo');

CREATE TYPE public.credito_estado AS ENUM (
  'borrador','portal_enviado','llenando_formulario',
  'en_revision_cs','en_credito_cobranza','revision_lista_69',
  'en_cescemex','en_direccion','en_juridico',
  'contrato_enviado','contrato_firmado','activo','rechazado','cancelado'
);

CREATE TYPE public.credito_doc_estado AS ENUM ('pendiente','recibido','rechazado','vencido');

CREATE TYPE public.credito_visibilidad AS ENUM ('publica','interna');

-- ============================================================
-- 2. TABLA: credit_requests
-- ============================================================
CREATE TABLE public.credit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folio text UNIQUE,
  company_id uuid NOT NULL REFERENCES public.companies(id),
  tipo public.credito_tipo,
  estado public.credito_estado NOT NULL DEFAULT 'borrador',
  fecha_limite date,

  -- Datos generales
  razon_social text,
  nombre_comercial text,
  rfc text,
  telefono text,
  correo_contacto text,
  domicilio_fiscal text,
  ciudad_fiscal text,
  estado_fiscal text,
  antiguedad text,
  domicilio_comercial text,
  ciudad_comercial text,
  giro_comercial text,
  monto_solicitado numeric,
  dias_credito integer,

  -- Personas morales
  accionistas jsonb NOT NULL DEFAULT '[]'::jsonb,
  escritura_constitutiva text,
  datos_registro text,
  ultima_asamblea text,
  administrador_presidente text,

  -- Datos bancarios y referencias
  datos_bancarios jsonb NOT NULL DEFAULT '[]'::jsonb,
  referencias_comerciales jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Aval
  aval_nombre text,
  aval_direccion text,
  aval_ciudad text,
  aval_relacion text,
  aval_regimen_conyugal text,

  -- Representante legal
  rep_legal_nombre text,
  rep_legal_curp text,
  rep_legal_rfc text,
  rep_legal_tipo_id text,
  rep_legal_num_id text,
  rep_legal_fecha_nacimiento date,
  rep_legal_pais_nacimiento text,

  -- LFPIORPI
  lfpiorpi_beneficiario_controlador boolean,
  lfpiorpi_tiene_documentacion boolean,
  lfpiorpi_fecha_firma date,
  lfpiorpi_lugar_firma text,

  -- CSF extraído
  csf_rfc text,
  csf_razon_social text,
  csf_regimen_fiscal text,
  csf_domicilio text,
  csf_cp text,
  csf_actividad_economica text,
  csf_fecha_inicio_operaciones date,
  csf_tipo_persona text,
  csf_parseado boolean NOT NULL DEFAULT false,

  -- Workflow
  created_by uuid REFERENCES auth.users(id),
  assigned_cs uuid REFERENCES auth.users(id),
  assigned_credito uuid REFERENCES auth.users(id),
  direccion_aprobo boolean NOT NULL DEFAULT false,
  direccion_aprobo_fecha timestamptz,
  direccion_aprobo_por uuid REFERENCES auth.users(id),
  lista_69_ok boolean,
  lista_69_fecha timestamptz,
  lista_69_por uuid REFERENCES auth.users(id),
  cescemex_resultado text,
  cescemex_fecha timestamptz,
  fecha_contrato_enviado timestamptz,
  fecha_contrato_firmado timestamptz,
  fecha_activacion timestamptz,
  motivo_rechazo text,

  -- Firmas
  firma_solicitud_fecha timestamptz,
  firma_solicitud_nombre text,
  firma_buro_fecha timestamptz,
  firma_buro_nombre text,
  firma_confidencialidad_fecha timestamptz,
  firma_confidencialidad_nombre text,
  firma_subsistencia_fecha timestamptz,
  firma_subsistencia_nombre text,
  firma_lfpiorpi_fecha timestamptz,
  firma_lfpiorpi_nombre text,

  -- Portal cliente
  client_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  client_email text,
  client_nombre_contacto text,
  ultimo_recordatorio_enviado timestamptz,
  recordatorio_count integer NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. TABLA: credit_request_parties
-- ============================================================
CREATE TABLE public.credit_request_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_request_id uuid NOT NULL REFERENCES public.credit_requests(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  email text NOT NULL,
  rol_descripcion text,
  client_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  ultimo_acceso timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 4. TABLA: credit_doc_types
-- ============================================================
CREATE TABLE public.credit_doc_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  instrucciones_cliente text,
  aplica_moral boolean NOT NULL DEFAULT true,
  aplica_fisica boolean NOT NULL DEFAULT true,
  aplica_cescemex boolean NOT NULL DEFAULT true,
  aplica_directo boolean NOT NULL DEFAULT true,
  requerido boolean NOT NULL DEFAULT true,
  vigencia_dias integer,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 5. TABLA: credit_request_docs
-- ============================================================
CREATE TABLE public.credit_request_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_request_id uuid NOT NULL REFERENCES public.credit_requests(id) ON DELETE CASCADE,
  doc_type_id uuid REFERENCES public.credit_doc_types(id),
  party_id uuid REFERENCES public.credit_request_parties(id),
  nombre_personalizado text,
  estado public.credito_doc_estado NOT NULL DEFAULT 'pendiente',
  visibilidad public.credito_visibilidad NOT NULL DEFAULT 'publica',
  url_archivo text,
  nombre_archivo text,
  tipo_archivo text,
  notas_rechazo text,
  fecha_vencimiento date,
  subido_por uuid REFERENCES auth.users(id),
  subido_por_cliente boolean NOT NULL DEFAULT false,
  aprobado_por uuid REFERENCES auth.users(id),
  aprobado_fecha timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 6. TABLA: credit_request_comments
-- ============================================================
CREATE TABLE public.credit_request_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_request_id uuid NOT NULL REFERENCES public.credit_requests(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  party_id uuid REFERENCES public.credit_request_parties(id),
  contenido text NOT NULL,
  visibilidad public.credito_visibilidad NOT NULL DEFAULT 'interna',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 7. TABLA: credit_request_history
-- ============================================================
CREATE TABLE public.credit_request_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_request_id uuid NOT NULL REFERENCES public.credit_requests(id) ON DELETE CASCADE,
  estado_anterior public.credito_estado,
  estado_nuevo public.credito_estado NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  nota text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 8. TABLA: credit_client_sessions
-- ============================================================
CREATE TABLE public.credit_client_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_request_id uuid NOT NULL REFERENCES public.credit_requests(id) ON DELETE CASCADE,
  party_id uuid REFERENCES public.credit_request_parties(id),
  email text NOT NULL,
  otp_code text NOT NULL,
  otp_expires_at timestamptz NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 9. Folio auto-generation
-- ============================================================
CREATE OR REPLACE FUNCTION public.generate_credito_folio()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE seq int;
BEGIN
  SELECT COUNT(*) + 1 INTO seq
  FROM public.credit_requests
  WHERE date_part('year', created_at) = date_part('year', now());
  NEW.folio := 'CR-' || to_char(now(),'YYYY') || '-' || lpad(seq::text,4,'0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_credito_folio
BEFORE INSERT ON public.credit_requests
FOR EACH ROW WHEN (NEW.folio IS NULL)
EXECUTE FUNCTION public.generate_credito_folio();

-- ============================================================
-- 10. Completeness scoring
-- ============================================================
CREATE OR REPLACE FUNCTION public.credit_request_completeness(req_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r public.credit_requests;
  form_fields int := 12;
  form_filled int := 0;
  docs_required int := 0;
  docs_received int := 0;
  sigs_required int := 5;
  sigs_done int := 0;
BEGIN
  SELECT * INTO r FROM public.credit_requests WHERE id = req_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('form_pct',0,'docs_pct',0,'sigs_pct',0,
      'docs_received',0,'docs_required',0,'sigs_done',0,'sigs_required',sigs_required);
  END IF;

  IF r.razon_social IS NOT NULL THEN form_filled := form_filled+1; END IF;
  IF r.rfc IS NOT NULL THEN form_filled := form_filled+1; END IF;
  IF r.telefono IS NOT NULL THEN form_filled := form_filled+1; END IF;
  IF r.correo_contacto IS NOT NULL THEN form_filled := form_filled+1; END IF;
  IF r.domicilio_fiscal IS NOT NULL THEN form_filled := form_filled+1; END IF;
  IF r.domicilio_comercial IS NOT NULL THEN form_filled := form_filled+1; END IF;
  IF r.giro_comercial IS NOT NULL THEN form_filled := form_filled+1; END IF;
  IF r.rep_legal_nombre IS NOT NULL THEN form_filled := form_filled+1; END IF;
  IF r.rep_legal_rfc IS NOT NULL THEN form_filled := form_filled+1; END IF;
  IF jsonb_array_length(COALESCE(r.referencias_comerciales,'[]'::jsonb)) >= 2 THEN form_filled := form_filled+1; END IF;
  IF r.aval_nombre IS NOT NULL THEN form_filled := form_filled+1; END IF;
  IF jsonb_array_length(COALESCE(r.datos_bancarios,'[]'::jsonb)) >= 1 THEN form_filled := form_filled+1; END IF;

  SELECT COUNT(*) INTO docs_required
  FROM public.credit_doc_types WHERE requerido=true AND is_active=true;

  SELECT COUNT(*) INTO docs_received
  FROM public.credit_request_docs d
  JOIN public.credit_doc_types t ON t.id=d.doc_type_id
  WHERE d.credit_request_id=req_id AND d.estado='recibido' AND t.requerido=true;

  IF r.firma_solicitud_fecha IS NOT NULL THEN sigs_done := sigs_done+1; END IF;
  IF r.firma_buro_fecha IS NOT NULL THEN sigs_done := sigs_done+1; END IF;
  IF r.firma_confidencialidad_fecha IS NOT NULL THEN sigs_done := sigs_done+1; END IF;
  IF r.firma_subsistencia_fecha IS NOT NULL THEN sigs_done := sigs_done+1; END IF;
  IF r.firma_lfpiorpi_fecha IS NOT NULL THEN sigs_done := sigs_done+1; END IF;

  RETURN jsonb_build_object(
    'form_pct', ROUND((form_filled::numeric/form_fields)*100),
    'docs_pct', CASE WHEN docs_required=0 THEN 100 ELSE ROUND((docs_received::numeric/docs_required)*100) END,
    'sigs_pct', ROUND((sigs_done::numeric/sigs_required)*100),
    'docs_received', docs_received, 'docs_required', docs_required,
    'sigs_done', sigs_done, 'sigs_required', sigs_required
  );
END;
$$;

-- ============================================================
-- 11. Token validation helper (used by RLS and edge functions)
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_credit_token(_token uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.credit_requests WHERE client_token = _token
  UNION ALL
  SELECT credit_request_id FROM public.credit_request_parties WHERE client_token = _token
  LIMIT 1;
$$;

-- ============================================================
-- 12. updated_at triggers
-- ============================================================
CREATE TRIGGER trg_credit_requests_updated_at
BEFORE UPDATE ON public.credit_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_credit_doc_types_updated_at
BEFORE UPDATE ON public.credit_doc_types
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_credit_request_docs_updated_at
BEFORE UPDATE ON public.credit_request_docs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 13. Indexes
-- ============================================================
CREATE INDEX idx_cr_company ON public.credit_requests(company_id);
CREATE INDEX idx_cr_estado ON public.credit_requests(estado);
CREATE INDEX idx_cr_token ON public.credit_requests(client_token);
CREATE INDEX idx_crd_request ON public.credit_request_docs(credit_request_id);
CREATE INDEX idx_crc_request ON public.credit_request_comments(credit_request_id);
CREATE INDEX idx_crp_token ON public.credit_request_parties(client_token);

-- ============================================================
-- 14. RLS — Enable
-- ============================================================
ALTER TABLE public.credit_requests           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_request_parties    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_doc_types          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_request_docs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_request_comments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_request_history    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_client_sessions    ENABLE ROW LEVEL SECURITY;

-- credit_requests
CREATE POLICY "credit_requests admin/manager all"
ON public.credit_requests FOR ALL
TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'))
WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));

CREATE POLICY "credit_requests cs/accounting select"
ON public.credit_requests FOR SELECT
TO authenticated
USING (has_role(auth.uid(),'customer_service') OR has_role(auth.uid(),'accounting'));

CREATE POLICY "credit_requests cs/accounting update"
ON public.credit_requests FOR UPDATE
TO authenticated
USING (has_role(auth.uid(),'customer_service') OR has_role(auth.uid(),'accounting'))
WITH CHECK (has_role(auth.uid(),'customer_service') OR has_role(auth.uid(),'accounting'));

CREATE POLICY "credit_requests sales select own"
ON public.credit_requests FOR SELECT
TO authenticated
USING (has_role(auth.uid(),'sales') AND created_by = auth.uid());

CREATE POLICY "credit_requests sales insert"
ON public.credit_requests FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(),'sales') AND created_by = auth.uid());

CREATE POLICY "credit_requests sales update own"
ON public.credit_requests FOR UPDATE
TO authenticated
USING (has_role(auth.uid(),'sales') AND created_by = auth.uid())
WITH CHECK (has_role(auth.uid(),'sales') AND created_by = auth.uid());

-- credit_request_parties
CREATE POLICY "credit_request_parties internal all"
ON public.credit_request_parties FOR ALL
TO authenticated
USING (
  has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')
  OR has_role(auth.uid(),'customer_service') OR has_role(auth.uid(),'accounting')
  OR EXISTS (
    SELECT 1 FROM public.credit_requests r
    WHERE r.id = credit_request_parties.credit_request_id
      AND has_role(auth.uid(),'sales') AND r.created_by = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')
  OR has_role(auth.uid(),'customer_service') OR has_role(auth.uid(),'accounting')
  OR EXISTS (
    SELECT 1 FROM public.credit_requests r
    WHERE r.id = credit_request_parties.credit_request_id
      AND has_role(auth.uid(),'sales') AND r.created_by = auth.uid()
  )
);

-- credit_doc_types
CREATE POLICY "credit_doc_types select authenticated"
ON public.credit_doc_types FOR SELECT
TO authenticated USING (true);

CREATE POLICY "credit_doc_types admin/manager manage"
ON public.credit_doc_types FOR ALL
TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'))
WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));

-- credit_request_docs
CREATE POLICY "credit_request_docs internal all"
ON public.credit_request_docs FOR ALL
TO authenticated
USING (
  has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')
  OR has_role(auth.uid(),'customer_service') OR has_role(auth.uid(),'accounting')
  OR EXISTS (
    SELECT 1 FROM public.credit_requests r
    WHERE r.id = credit_request_docs.credit_request_id
      AND has_role(auth.uid(),'sales') AND r.created_by = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')
  OR has_role(auth.uid(),'customer_service') OR has_role(auth.uid(),'accounting')
  OR EXISTS (
    SELECT 1 FROM public.credit_requests r
    WHERE r.id = credit_request_docs.credit_request_id
      AND has_role(auth.uid(),'sales') AND r.created_by = auth.uid()
  )
);

-- credit_request_comments
CREATE POLICY "credit_request_comments internal all"
ON public.credit_request_comments FOR ALL
TO authenticated
USING (
  has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')
  OR has_role(auth.uid(),'customer_service') OR has_role(auth.uid(),'accounting')
  OR EXISTS (
    SELECT 1 FROM public.credit_requests r
    WHERE r.id = credit_request_comments.credit_request_id
      AND has_role(auth.uid(),'sales') AND r.created_by = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')
  OR has_role(auth.uid(),'customer_service') OR has_role(auth.uid(),'accounting')
  OR EXISTS (
    SELECT 1 FROM public.credit_requests r
    WHERE r.id = credit_request_comments.credit_request_id
      AND has_role(auth.uid(),'sales') AND r.created_by = auth.uid()
  )
);

-- credit_request_history
CREATE POLICY "credit_request_history internal select"
ON public.credit_request_history FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')
  OR has_role(auth.uid(),'customer_service') OR has_role(auth.uid(),'accounting')
  OR EXISTS (
    SELECT 1 FROM public.credit_requests r
    WHERE r.id = credit_request_history.credit_request_id
      AND has_role(auth.uid(),'sales') AND r.created_by = auth.uid()
  )
);

CREATE POLICY "credit_request_history internal insert"
ON public.credit_request_history FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')
  OR has_role(auth.uid(),'customer_service') OR has_role(auth.uid(),'accounting')
  OR EXISTS (
    SELECT 1 FROM public.credit_requests r
    WHERE r.id = credit_request_history.credit_request_id
      AND has_role(auth.uid(),'sales') AND r.created_by = auth.uid()
  )
);

-- credit_client_sessions — only admin/manager directly; edge functions use service role
CREATE POLICY "credit_client_sessions admin/manager all"
ON public.credit_client_sessions FOR ALL
TO authenticated
USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'))
WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));

-- ============================================================
-- 15. Seed: credit_doc_types
-- ============================================================
INSERT INTO public.credit_doc_types
  (nombre, instrucciones_cliente, aplica_moral, aplica_fisica, requerido, vigencia_dias, sort_order)
VALUES
('Constancia de Situación Fiscal (CSF)',
 'Descárgala en sat.gob.mx con tu RFC y contraseña. Sube el PDF completo.',
 true,true,true,NULL,10),
('Opinión de Cumplimiento SAT (32-D)',
 'Debe ser POSITIVA y del mes en curso. Descárgala en sat.gob.mx.',
 true,true,true,30,20),
('Identificación oficial del Representante Legal',
 'INE o pasaporte vigente. Sube ambos lados en un solo archivo.',
 true,false,true,NULL,30),
('Identificación oficial (Persona Física)',
 'INE o pasaporte vigente. Sube ambos lados en un solo archivo.',
 false,true,true,NULL,35),
('Comprobante de domicilio',
 'Predial, agua, luz o teléfono. No mayor a 3 meses. A nombre del solicitante.',
 true,true,true,90,40),
('Acta Constitutiva',
 'Todas las páginas incluyendo datos de notaría. Lo más legible posible.',
 true,false,true,NULL,50),
('Poder del Representante Legal',
 'Debe incluir facultades para firmar títulos de crédito (Art. 9 LGTOC).',
 true,false,true,NULL,60),
('Fotos del negocio',
 'Fotos exteriores: fachada, almacenes, vehículos, calles circundantes.',
 true,true,true,NULL,70),
('Croquis Google Maps',
 'Captura de Google Maps con tu ubicación marcada. Si es zona rural, anota referencias.',
 true,true,true,NULL,80),
('Estado de cuenta bancario',
 'Los 3 meses más recientes de la cuenta principal de la empresa.',
 true,true,false,90,90),
('Registro Público de la Propiedad',
 'Solo si se ofrecen propiedades como garantía.',
 true,true,false,NULL,100);

-- ============================================================
-- 16. Seed: role_module_permissions for 'credito'
-- ============================================================
INSERT INTO public.role_module_permissions (role, module, access_level) VALUES
  ('admin'::app_role,'credito'::app_module,'todos'::access_level),
  ('manager'::app_role,'credito'::app_module,'todos'::access_level),
  ('sales'::app_role,'credito'::app_module,'propio'::access_level),
  ('customer_service'::app_role,'credito'::app_module,'todos'::access_level),
  ('accounting'::app_role,'credito'::app_module,'todos'::access_level)
ON CONFLICT (role, module) DO NOTHING;

-- ============================================================
-- 17. Storage bucket: credit-docs (private)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('credit-docs', 'credit-docs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies — internal users only (anon writes happen via edge function with service role)
CREATE POLICY "credit-docs internal select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'credit-docs'
  AND (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')
    OR has_role(auth.uid(),'customer_service') OR has_role(auth.uid(),'accounting')
    OR has_role(auth.uid(),'sales')
  )
);

CREATE POLICY "credit-docs internal insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'credit-docs'
  AND (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')
    OR has_role(auth.uid(),'customer_service') OR has_role(auth.uid(),'accounting')
    OR has_role(auth.uid(),'sales')
  )
);

CREATE POLICY "credit-docs internal update"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'credit-docs'
  AND (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager')
    OR has_role(auth.uid(),'customer_service') OR has_role(auth.uid(),'accounting')
    OR has_role(auth.uid(),'sales')
  )
);

CREATE POLICY "credit-docs internal delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'credit-docs'
  AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'))
);