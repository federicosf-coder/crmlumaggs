
ALTER TABLE public.credit_requests
  ADD COLUMN IF NOT EXISTS tipo_persona text
  CHECK (tipo_persona IN ('moral','fisica'));

CREATE OR REPLACE FUNCTION public.credit_request_completeness(req_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  r public.credit_requests;
  form_fields int := 12;
  form_filled int := 0;
  docs_required int := 0;
  docs_received int := 0;
  sigs_required int := 5;
  sigs_done int := 0;
  tipo text;
  is_moral boolean;
  is_fisica boolean;
BEGIN
  SELECT * INTO r FROM public.credit_requests WHERE id = req_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('form_pct',0,'docs_pct',0,'sigs_pct',0,
      'docs_received',0,'docs_required',0,'sigs_done',0,'sigs_required',sigs_required);
  END IF;

  tipo := COALESCE(r.tipo_persona, r.csf_tipo_persona, 'moral');
  is_moral := (tipo = 'moral');
  is_fisica := (tipo = 'fisica');

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
  IF (NOT COALESCE(r.aval_es_distinto, true)) OR r.aval_nombre IS NOT NULL THEN form_filled := form_filled+1; END IF;
  IF jsonb_array_length(COALESCE(r.datos_bancarios,'[]'::jsonb)) >= 1 THEN form_filled := form_filled+1; END IF;

  SELECT COUNT(*) INTO docs_required
  FROM public.credit_doc_types
  WHERE requerido=true AND is_active=true
    AND (NOT COALESCE(aplica_si_aval_distinto, false) OR COALESCE(r.aval_es_distinto, true))
    AND ((is_moral AND COALESCE(aplica_moral, true)) OR (is_fisica AND COALESCE(aplica_fisica, true)));

  SELECT COUNT(*) INTO docs_received
  FROM public.credit_request_docs d
  JOIN public.credit_doc_types t ON t.id=d.doc_type_id
  WHERE d.credit_request_id=req_id AND d.estado='recibido' AND t.requerido=true
    AND (NOT COALESCE(t.aplica_si_aval_distinto, false) OR COALESCE(r.aval_es_distinto, true))
    AND ((is_moral AND COALESCE(t.aplica_moral, true)) OR (is_fisica AND COALESCE(t.aplica_fisica, true)));

  IF is_fisica THEN
    sigs_required := 4;
  END IF;

  IF r.firma_solicitud_fecha IS NOT NULL THEN sigs_done := sigs_done+1; END IF;
  IF r.firma_buro_fecha IS NOT NULL THEN sigs_done := sigs_done+1; END IF;
  IF r.firma_confidencialidad_fecha IS NOT NULL THEN sigs_done := sigs_done+1; END IF;
  IF is_moral AND r.firma_subsistencia_fecha IS NOT NULL THEN sigs_done := sigs_done+1; END IF;
  IF r.firma_lfpiorpi_fecha IS NOT NULL THEN sigs_done := sigs_done+1; END IF;

  RETURN jsonb_build_object(
    'form_pct', ROUND((form_filled::numeric/form_fields)*100),
    'docs_pct', CASE WHEN docs_required=0 THEN 100 ELSE ROUND((docs_received::numeric/docs_required)*100) END,
    'sigs_pct', ROUND((sigs_done::numeric/sigs_required)*100),
    'docs_received', docs_received, 'docs_required', docs_required,
    'sigs_done', sigs_done, 'sigs_required', sigs_required,
    'tipo_persona', tipo
  );
END;
$function$;
