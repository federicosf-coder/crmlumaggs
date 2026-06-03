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

  -- Resolver colisión del índice único parcial uq_crm_deals_recompra_mes
  -- renombrando mes_negocio en los deals del duplicado que chocarían con el principal.
  UPDATE public.crm_deals s
     SET mes_negocio = s.mes_negocio || '-merge-' || substr(s.id::text, 1, 8)
   WHERE s.company_id = _duplicate_id
     AND s.pipeline_type = 'recompra'
     AND s.company_id IS NOT NULL
     AND s.mes_negocio IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM public.crm_deals t
        WHERE t.company_id = _primary_id
          AND t.pipeline_type = 'recompra'
          AND t.pipeline_id = s.pipeline_id
          AND t.mes_negocio = s.mes_negocio
     );

  UPDATE crm_deals SET company_id = _primary_id WHERE company_id = _duplicate_id;
  GET DIAGNOSTICS v = ROW_COUNT; counts := counts || jsonb_build_object('crm_deals', v);

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