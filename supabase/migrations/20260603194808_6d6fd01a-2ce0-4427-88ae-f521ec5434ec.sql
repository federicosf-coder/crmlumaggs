
-- A) Reparar merge_contacts: quitar referencias a crm_deals/pipelines, conservar crm_tasks/crm_activities
CREATE OR REPLACE FUNCTION public.merge_contacts(_primary_id uuid, _duplicate_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  counts jsonb := '{}'::jsonb;
  v int;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
       OR public.has_role(auth.uid(), 'manager'::app_role)
       OR public.has_role(auth.uid(), 'sales'::app_role)
       OR public.has_role(auth.uid(), 'customer_service'::app_role)) THEN
    RAISE EXCEPTION 'No autorizado para fusionar contactos';
  END IF;
  IF _primary_id IS NULL OR _duplicate_id IS NULL OR _primary_id = _duplicate_id THEN
    RAISE EXCEPTION 'IDs inválidos';
  END IF;

  UPDATE documentos SET contacto_id = _primary_id WHERE contacto_id = _duplicate_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('documentos', v);

  UPDATE crm_tasks SET contact_id = _primary_id WHERE contact_id = _duplicate_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('crm_tasks', v);

  UPDATE crm_activities SET contact_id = _primary_id WHERE contact_id = _duplicate_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('crm_activities', v);

  INSERT INTO contact_ejecutivos (contact_id, user_id)
  SELECT _primary_id, user_id FROM contact_ejecutivos
  WHERE contact_id = _duplicate_id
    AND NOT EXISTS (SELECT 1 FROM contact_ejecutivos ce2 WHERE ce2.contact_id = _primary_id AND ce2.user_id = contact_ejecutivos.user_id);
  DELETE FROM contact_ejecutivos WHERE contact_id = _duplicate_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('contact_ejecutivos', v);

  UPDATE contacts p SET
    email = COALESCE(p.email, d.email),
    phone = COALESCE(p.phone, d.phone),
    mobile = COALESCE(p.mobile, d.mobile),
    job_title = COALESCE(p.job_title, d.job_title),
    department = COALESCE(p.department, d.department),
    company_id = COALESCE(p.company_id, d.company_id),
    notes = CASE
      WHEN p.notes IS NULL OR p.notes = '' THEN d.notes
      WHEN d.notes IS NULL OR d.notes = '' THEN p.notes
      WHEN p.notes = d.notes THEN p.notes
      ELSE p.notes || E'\n---\n' || d.notes
    END,
    updated_at = now()
  FROM contacts d
  WHERE p.id = _primary_id AND d.id = _duplicate_id;

  DELETE FROM contacts WHERE id = _duplicate_id;
  RETURN counts;
END;
$function$;

-- B) Eliminar funciones residuales (CASCADE elimina triggers dependientes)
DROP FUNCTION IF EXISTS public.recalc_deal_units(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.recalc_recompra_deals_for_doc(uuid, text, date) CASCADE;
DROP FUNCTION IF EXISTS public.seed_crm_pipeline(text, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.seed_crm_pipeline(text, uuid, text) CASCADE;

-- C) Desagendar cron job de generate-monthly-recompra-deals
SELECT cron.unschedule('generate-monthly-recompra-deals');
