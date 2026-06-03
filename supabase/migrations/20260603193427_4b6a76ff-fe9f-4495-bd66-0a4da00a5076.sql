
-- 1) resolve_documento_negocio inerte
CREATE OR REPLACE FUNCTION public.resolve_documento_negocio(
  _empresa_id uuid, _contacto_id uuid, _empresa_vendedora public.empresa_vendedora, _created_by uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  RETURN NULL;
END;
$function$;

-- 2) Drop FKs documentos -> crm_deals
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.table_schema='public' AND tc.table_name='documentos'
      AND tc.constraint_type='FOREIGN KEY' AND ccu.table_name='crm_deals'
  LOOP
    EXECUTE format('ALTER TABLE public.documentos DROP CONSTRAINT %I', r.constraint_name);
  END LOOP;
END $$;

-- 3) Drop triggers/functions de negocios
DROP FUNCTION IF EXISTS public.trg_create_repurchase_opportunity() CASCADE;
DROP FUNCTION IF EXISTS public.crm_convert_prospect_on_won() CASCADE;
DROP FUNCTION IF EXISTS public.sync_deal_pipeline_type() CASCADE;

-- 4) Drop tablas
DROP TABLE IF EXISTS public.crm_deals CASCADE;
DROP TABLE IF EXISTS public.crm_pipeline_stages CASCADE;
DROP TABLE IF EXISTS public.crm_pipelines CASCADE;

-- 5) Drop enum si ya no se usa
DROP TYPE IF EXISTS public.pipeline_type CASCADE;

-- 6a) merge_companies sin crm_deals/crm_pipelines
CREATE OR REPLACE FUNCTION public.merge_companies(_primary_id uuid, _duplicate_id uuid)
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
    RAISE EXCEPTION 'No autorizado para fusionar empresas';
  END IF;
  IF _primary_id IS NULL OR _duplicate_id IS NULL OR _primary_id = _duplicate_id THEN
    RAISE EXCEPTION 'IDs inválidos';
  END IF;

  UPDATE contacts SET company_id = _primary_id WHERE company_id = _duplicate_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('contacts', v);

  UPDATE documentos SET empresa_id = _primary_id WHERE empresa_id = _duplicate_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('documentos', v);

  UPDATE cobranza_pagos SET empresa_id = _primary_id WHERE empresa_id = _duplicate_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('cobranza_pagos', v);

  UPDATE crm_tasks SET company_id = _primary_id WHERE company_id = _duplicate_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('crm_tasks', v);

  UPDATE crm_activities SET company_id = _primary_id WHERE company_id = _duplicate_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('crm_activities', v);

  UPDATE direcciones_empresa SET empresa_id = _primary_id WHERE empresa_id = _duplicate_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('direcciones_empresa', v);

  INSERT INTO company_ejecutivos (company_id, user_id)
  SELECT _primary_id, user_id FROM company_ejecutivos
  WHERE company_id = _duplicate_id
    AND NOT EXISTS (SELECT 1 FROM company_ejecutivos ce2 WHERE ce2.company_id = _primary_id AND ce2.user_id = company_ejecutivos.user_id);
  DELETE FROM company_ejecutivos WHERE company_id = _duplicate_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('company_ejecutivos', v);

  INSERT INTO company_plazas (company_id, plaza_id)
  SELECT _primary_id, plaza_id FROM company_plazas
  WHERE company_id = _duplicate_id
    AND NOT EXISTS (SELECT 1 FROM company_plazas cp2 WHERE cp2.company_id = _primary_id AND cp2.plaza_id = company_plazas.plaza_id);
  DELETE FROM company_plazas WHERE company_id = _duplicate_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('company_plazas', v);

  UPDATE companies p SET
    razon_social = COALESCE(p.razon_social, d.razon_social),
    id_contpaq = COALESCE(p.id_contpaq, d.id_contpaq),
    industry = COALESCE(p.industry, d.industry),
    website = COALESCE(p.website, d.website),
    phone = COALESCE(p.phone, d.phone),
    email = COALESCE(p.email, d.email),
    address = COALESCE(p.address, d.address),
    city = COALESCE(p.city, d.city),
    state = COALESCE(p.state, d.state),
    zip_code = COALESCE(p.zip_code, d.zip_code),
    notes = CASE
      WHEN p.notes IS NULL OR p.notes = '' THEN d.notes
      WHEN d.notes IS NULL OR d.notes = '' THEN p.notes
      WHEN p.notes = d.notes THEN p.notes
      ELSE p.notes || E'\n---\n' || d.notes
    END,
    plaza_id = COALESCE(p.plaza_id, d.plaza_id),
    lista_precios = COALESCE(p.lista_precios, d.lista_precios),
    tipo_pago = COALESCE(p.tipo_pago, d.tipo_pago),
    metodo_pago = COALESCE(p.metodo_pago, d.metodo_pago),
    uso_cfdi = COALESCE(p.uso_cfdi, d.uso_cfdi),
    tipo_cliente_comercial = COALESCE(p.tipo_cliente_comercial, d.tipo_cliente_comercial),
    rol_lubricante = COALESCE(p.rol_lubricante, d.rol_lubricante),
    evaluacion_lubricante = COALESCE(p.evaluacion_lubricante, d.evaluacion_lubricante),
    riesgo_cambio_marca = COALESCE(p.riesgo_cambio_marca, d.riesgo_cambio_marca),
    origen_contacto = COALESCE(p.origen_contacto, d.origen_contacto),
    equipo = COALESCE(p.equipo, d.equipo),
    tipo_destino_lubricante = COALESCE(p.tipo_destino_lubricante, d.tipo_destino_lubricante),
    potencial_unidades = COALESCE(p.potencial_unidades, d.potencial_unidades),
    tomador_decision = COALESCE(p.tomador_decision, d.tomador_decision),
    industrias = (
      SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(p.industrias,'{}') || COALESCE(d.industrias,'{}')))
    ),
    updated_at = now()
  FROM companies d
  WHERE p.id = _primary_id AND d.id = _duplicate_id;

  DELETE FROM companies WHERE id = _duplicate_id;
  RETURN counts;
END;
$function$;

-- 6b) merge_users sin crm_deals/crm_pipelines
CREATE OR REPLACE FUNCTION public.merge_users(_source_user_id uuid, _target_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  counts jsonb := '{}'::jsonb;
  v int;
  source_email text;
  target_email text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can merge users';
  END IF;
  IF _source_user_id = _target_user_id THEN
    RAISE EXCEPTION 'Source and target must be different';
  END IF;
  IF _source_user_id IS NULL OR _target_user_id IS NULL THEN
    RAISE EXCEPTION 'Source and target are required';
  END IF;

  SELECT email INTO source_email FROM profiles WHERE user_id = _source_user_id;
  SELECT email INTO target_email FROM profiles WHERE user_id = _target_user_id;

  UPDATE documentos SET created_by = _target_user_id WHERE created_by = _source_user_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('documentos.created_by', v);

  UPDATE documentos SET ejecutivo_venta_id = _target_user_id WHERE ejecutivo_venta_id = _source_user_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('documentos.ejecutivo_venta_id', v);

  UPDATE cobranza_pagos SET creado_por = _target_user_id WHERE creado_por = _source_user_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('cobranza_pagos.creado_por', v);

  UPDATE cobranza_aplicaciones SET creado_por = _target_user_id WHERE creado_por = _source_user_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('cobranza_aplicaciones.creado_por', v);

  UPDATE cobranza_pago_archivos SET usuario_carga = _target_user_id WHERE usuario_carga = _source_user_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('cobranza_pago_archivos.usuario_carga', v);

  UPDATE companies SET created_by = _target_user_id WHERE created_by = _source_user_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('companies.created_by', v);

  UPDATE contacts SET created_by = _target_user_id WHERE created_by = _source_user_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('contacts.created_by', v);

  UPDATE crm_tasks SET user_id = _target_user_id WHERE user_id = _source_user_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('crm_tasks.user_id', v);

  UPDATE crm_activities SET user_id = _target_user_id WHERE user_id = _source_user_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('crm_activities.user_id', v);

  UPDATE productos SET created_by = _target_user_id WHERE created_by = _source_user_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('productos.created_by', v);

  UPDATE documento_archivos_firmados SET usuario_carga = _target_user_id WHERE usuario_carga = _source_user_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('documento_archivos_firmados.usuario_carga', v);

  UPDATE documento_direccion_bitacora SET usuario_id = _target_user_id WHERE usuario_id = _source_user_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('documento_direccion_bitacora.usuario_id', v);

  UPDATE email_groups SET created_by = _target_user_id WHERE created_by = _source_user_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('email_groups.created_by', v);

  UPDATE email_group_members SET user_id = _target_user_id WHERE user_id = _source_user_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('email_group_members.user_id', v);

  UPDATE rutas_entrega SET created_by = _target_user_id WHERE created_by = _source_user_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('rutas_entrega.created_by', v);

  UPDATE system_settings SET updated_by = _target_user_id WHERE updated_by = _source_user_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('system_settings.updated_by', v);

  UPDATE repartidores SET user_id = _target_user_id WHERE user_id = _source_user_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('repartidores.user_id', v);

  INSERT INTO company_ejecutivos (company_id, user_id)
  SELECT company_id, _target_user_id FROM company_ejecutivos
  WHERE user_id = _source_user_id
    AND NOT EXISTS (SELECT 1 FROM company_ejecutivos ce2 WHERE ce2.company_id = company_ejecutivos.company_id AND ce2.user_id = _target_user_id);
  DELETE FROM company_ejecutivos WHERE user_id = _source_user_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('company_ejecutivos', v);

  INSERT INTO contact_ejecutivos (contact_id, user_id)
  SELECT contact_id, _target_user_id FROM contact_ejecutivos
  WHERE user_id = _source_user_id
    AND NOT EXISTS (SELECT 1 FROM contact_ejecutivos ce2 WHERE ce2.contact_id = contact_ejecutivos.contact_id AND ce2.user_id = _target_user_id);
  DELETE FROM contact_ejecutivos WHERE user_id = _source_user_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('contact_ejecutivos', v);

  INSERT INTO team_members (team_id, user_id)
  SELECT team_id, _target_user_id FROM team_members
  WHERE user_id = _source_user_id
    AND NOT EXISTS (SELECT 1 FROM team_members tm2 WHERE tm2.team_id = team_members.team_id AND tm2.user_id = _target_user_id);
  DELETE FROM team_members WHERE user_id = _source_user_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('team_members', v);

  INSERT INTO crm_task_collaborators (task_id, user_id)
  SELECT task_id, _target_user_id FROM crm_task_collaborators
  WHERE user_id = _source_user_id
    AND NOT EXISTS (SELECT 1 FROM crm_task_collaborators c2 WHERE c2.task_id = crm_task_collaborators.task_id AND c2.user_id = _target_user_id);
  DELETE FROM crm_task_collaborators WHERE user_id = _source_user_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('crm_task_collaborators', v);

  INSERT INTO crm_activity_collaborators (activity_id, user_id)
  SELECT activity_id, _target_user_id FROM crm_activity_collaborators
  WHERE user_id = _source_user_id
    AND NOT EXISTS (SELECT 1 FROM crm_activity_collaborators c2 WHERE c2.activity_id = crm_activity_collaborators.activity_id AND c2.user_id = _target_user_id);
  DELETE FROM crm_activity_collaborators WHERE user_id = _source_user_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('crm_activity_collaborators', v);

  INSERT INTO user_roles (user_id, role)
  SELECT _target_user_id, role FROM user_roles
  WHERE user_id = _source_user_id
    AND NOT EXISTS (SELECT 1 FROM user_roles ur2 WHERE ur2.user_id = _target_user_id AND ur2.role = user_roles.role);
  DELETE FROM user_roles WHERE user_id = _source_user_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('user_roles', v);

  DELETE FROM profiles WHERE user_id = _source_user_id;
  DELETE FROM auth.users WHERE id = _source_user_id;

  INSERT INTO user_merge_log (source_user_id, target_user_id, performed_by, source_email, target_email, affected_counts)
  VALUES (_source_user_id, _target_user_id, auth.uid(), source_email, target_email, counts);

  RETURN counts;
END;
$function$;

-- 6c) user_related_counts sin crm_deals
CREATE OR REPLACE FUNCTION public.user_related_counts(_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb := '{}'::jsonb;
  v int;
BEGIN
  SELECT count(*) INTO v FROM documentos WHERE created_by = _user_id OR ejecutivo_venta_id = _user_id;
  result := result || jsonb_build_object('documentos', v);
  SELECT count(*) INTO v FROM cobranza_pagos WHERE creado_por = _user_id;
  result := result || jsonb_build_object('cobranza_pagos', v);
  SELECT count(*) INTO v FROM cobranza_aplicaciones WHERE creado_por = _user_id;
  result := result || jsonb_build_object('cobranza_aplicaciones', v);
  SELECT count(*) INTO v FROM crm_tasks WHERE user_id = _user_id;
  result := result || jsonb_build_object('crm_tasks', v);
  SELECT count(*) INTO v FROM crm_activities WHERE user_id = _user_id;
  result := result || jsonb_build_object('crm_activities', v);
  SELECT count(*) INTO v FROM companies WHERE created_by = _user_id;
  result := result || jsonb_build_object('companies', v);
  SELECT count(*) INTO v FROM contacts WHERE created_by = _user_id;
  result := result || jsonb_build_object('contacts', v);
  SELECT count(*) INTO v FROM company_ejecutivos WHERE user_id = _user_id;
  result := result || jsonb_build_object('company_ejecutivos', v);
  SELECT count(*) INTO v FROM contact_ejecutivos WHERE user_id = _user_id;
  result := result || jsonb_build_object('contact_ejecutivos', v);
  SELECT count(*) INTO v FROM repartidores WHERE user_id = _user_id;
  result := result || jsonb_build_object('repartidores', v);
  SELECT count(*) INTO v FROM team_members WHERE user_id = _user_id;
  result := result || jsonb_build_object('team_members', v);
  RETURN result;
END;
$function$;
