-- Audit log table for user merges
CREATE TABLE public.user_merge_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_user_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  performed_by uuid,
  source_email text,
  target_email text,
  affected_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_merge_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage user_merge_log"
ON public.user_merge_log FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Helper: count related records that block deletion
CREATE OR REPLACE FUNCTION public.user_related_counts(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
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
  SELECT count(*) INTO v FROM crm_deals WHERE created_by = _user_id OR owner_id = _user_id;
  result := result || jsonb_build_object('crm_deals', v);
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
$$;

-- Merge users: reassigns all references from source to target, then deletes source
CREATE OR REPLACE FUNCTION public.merge_users(_source_user_id uuid, _target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  counts jsonb := '{}'::jsonb;
  v int;
  source_email text;
  target_email text;
BEGIN
  -- Authorization
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

  -- Reassign ownership/created_by/etc
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

  UPDATE crm_deals SET created_by = _target_user_id WHERE created_by = _source_user_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('crm_deals.created_by', v);

  UPDATE crm_deals SET owner_id = _target_user_id WHERE owner_id = _source_user_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('crm_deals.owner_id', v);

  UPDATE crm_pipelines SET created_by = _target_user_id WHERE created_by = _source_user_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('crm_pipelines.created_by', v);

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

  -- Repartidores: link source's repartidor records to target user (if any)
  UPDATE repartidores SET user_id = _target_user_id WHERE user_id = _source_user_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('repartidores.user_id', v);

  -- Junction tables: insert target if missing, then delete source rows (avoids unique conflicts)
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

  -- Roles: copy missing roles to target, delete source roles
  INSERT INTO user_roles (user_id, role)
  SELECT _target_user_id, role FROM user_roles
  WHERE user_id = _source_user_id
    AND NOT EXISTS (SELECT 1 FROM user_roles ur2 WHERE ur2.user_id = _target_user_id AND ur2.role = user_roles.role);
  DELETE FROM user_roles WHERE user_id = _source_user_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('user_roles', v);

  -- Delete source profile
  DELETE FROM profiles WHERE user_id = _source_user_id;

  -- Delete source auth user
  DELETE FROM auth.users WHERE id = _source_user_id;

  -- Audit log
  INSERT INTO user_merge_log (source_user_id, target_user_id, performed_by, source_email, target_email, affected_counts)
  VALUES (_source_user_id, _target_user_id, auth.uid(), source_email, target_email, counts);

  RETURN counts;
END;
$$;

-- Delete user safely (admin only) — fails if any related counts > 0
CREATE OR REPLACE FUNCTION public.delete_user_safe(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c jsonb;
  k text;
  v int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own account';
  END IF;

  c := public.user_related_counts(_user_id);
  FOR k, v IN SELECT * FROM jsonb_each_text(c) LOOP
    IF v::int > 0 THEN
      RAISE EXCEPTION 'Cannot delete user: has related records (%). Deactivate instead.', c::text;
    END IF;
  END LOOP;

  DELETE FROM user_roles WHERE user_id = _user_id;
  DELETE FROM profiles WHERE user_id = _user_id;
  DELETE FROM auth.users WHERE id = _user_id;
END;
$$;