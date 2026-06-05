
-- 1) Update recompute function: avance now uses month-current vs expected pace
CREATE OR REPLACE FUNCTION public.recompute_seguimiento_ventas(_company_id uuid, _ev empresa_vendedora)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_promedio numeric:=0; v_potencial numeric:=0;
  v_acum_mes numeric:=0; v_acum_ant numeric:=0; v_acum_anio numeric:=0; v_u30 numeric:=0;
  v_ultima date; v_dias int; v_ciclo numeric; v_ciclo_eff numeric; v_mult numeric;
  v_tiene boolean:=false; v_cot_total int:=0; v_cot_ultima date; v_cot_dias int;
  v_ritmo numeric; v_owner uuid;
  v_riesgo uuid; v_ritmo_id uuid; v_gestion uuid;
  v_act_ultima date; v_act_total int:=0; v_dias_act int; v_act_activas int:=0;
  v_prox_ts timestamptz; v_prox date; v_dias_gestion int;
  v_day_of_month int; v_days_in_month int; v_month_frac numeric;
BEGIN
  IF _company_id IS NULL OR _ev IS NULL THEN RETURN; END IF;

  SELECT COALESCE(AVG(u),0), COALESCE(MAX(u),0) INTO v_promedio, v_potencial
  FROM (SELECT date_trunc('month',fecha_documento) m, SUM(unidades_equivalentes_total) u
        FROM public.documentos
        WHERE empresa_id=_company_id AND empresa_vendedora=_ev AND tipo_documento='factura'
          AND is_active=true AND COALESCE(estatus_factura::text,'') NOT IN ('cancelada')
        GROUP BY 1) s;

  SELECT
    COALESCE(SUM(unidades_equivalentes_total) FILTER (WHERE date_trunc('month',fecha_documento)=date_trunc('month',now())),0),
    COALESCE(SUM(unidades_equivalentes_total) FILTER (WHERE date_trunc('month',fecha_documento)=date_trunc('month',now()-interval '1 month')),0),
    COALESCE(SUM(unidades_equivalentes_total) FILTER (WHERE date_trunc('year',fecha_documento)=date_trunc('year',now())),0),
    COALESCE(SUM(unidades_equivalentes_total) FILTER (WHERE fecha_documento >= (now()::date - 30)),0),
    MAX(fecha_documento)
  INTO v_acum_mes, v_acum_ant, v_acum_anio, v_u30, v_ultima
  FROM public.documentos
  WHERE empresa_id=_company_id AND empresa_vendedora=_ev AND tipo_documento='factura'
    AND is_active=true AND COALESCE(estatus_factura::text,'') NOT IN ('cancelada');

  v_tiene := v_ultima IS NOT NULL;
  v_dias := CASE WHEN v_ultima IS NOT NULL THEN (now()::date - v_ultima) END;

  SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY gap) INTO v_ciclo
  FROM (SELECT fecha_documento - LAG(fecha_documento) OVER (ORDER BY fecha_documento) AS gap
        FROM (SELECT DISTINCT fecha_documento FROM public.documentos
              WHERE empresa_id=_company_id AND empresa_vendedora=_ev AND tipo_documento='factura'
                AND is_active=true AND COALESCE(estatus_factura::text,'') NOT IN ('cancelada')) d) g
  WHERE gap IS NOT NULL;

  SELECT COUNT(*), MAX(fecha_documento) INTO v_cot_total, v_cot_ultima
  FROM public.documentos
  WHERE empresa_id=_company_id AND empresa_vendedora=_ev AND tipo_documento='cotizacion' AND is_active=true;
  v_cot_dias := CASE WHEN v_cot_ultima IS NOT NULL THEN (now()::date - v_cot_ultima) END;

  SELECT MAX(created_at)::date, COUNT(*) INTO v_act_ultima, v_act_total
  FROM public.crm_activities WHERE company_id = _company_id;
  v_dias_act := CASE WHEN v_act_ultima IS NOT NULL THEN (now()::date - v_act_ultima) END;

  SELECT COUNT(*) FILTER (WHERE completed = false) INTO v_act_activas
  FROM public.crm_tasks WHERE company_id = _company_id;

  SELECT MIN(due_date) INTO v_prox_ts
  FROM public.crm_tasks
  WHERE company_id = _company_id AND completed = false AND due_date IS NOT NULL AND due_date >= now();
  v_prox := v_prox_ts::date;

  SELECT user_id INTO v_owner FROM public.company_ejecutivos WHERE company_id=_company_id LIMIT 1;

  -- AVANCE: proporcional a días transcurridos del mes en curso
  v_day_of_month := EXTRACT(DAY FROM now())::int;
  v_days_in_month := EXTRACT(DAY FROM (date_trunc('month', now()) + interval '1 month - 1 day'))::int;
  v_month_frac := GREATEST(v_day_of_month::numeric / NULLIF(v_days_in_month,0), 1.0/NULLIF(v_days_in_month,0));

  IF v_promedio > 0 THEN
    v_ritmo := (v_acum_mes / (v_promedio * v_month_frac)) * 100;
  END IF;

  IF v_tiene THEN
    v_ciclo_eff := COALESCE(NULLIF(v_ciclo,0), 30);
    v_mult := v_dias::numeric / v_ciclo_eff;
    SELECT id INTO v_riesgo FROM public.seguimiento_estatus_catalogo
      WHERE ambito='con_venta' AND familia='riesgo' AND activo
        AND v_mult >= COALESCE(umbral_min,0) AND (umbral_max IS NULL OR v_mult < umbral_max)
      ORDER BY orden LIMIT 1;
    IF v_ritmo IS NOT NULL THEN
      SELECT id INTO v_ritmo_id FROM public.seguimiento_estatus_catalogo
        WHERE ambito='con_venta' AND familia IN ('ritmo','avance') AND activo
          AND v_ritmo >= COALESCE(umbral_min,0) AND (umbral_max IS NULL OR v_ritmo < umbral_max)
        ORDER BY orden LIMIT 1;
    END IF;
  ELSE
    v_dias_gestion := COALESCE(v_dias_act, v_cot_dias);
    IF v_dias_gestion IS NOT NULL THEN
      SELECT id INTO v_gestion FROM public.seguimiento_estatus_catalogo
        WHERE ambito='sin_venta' AND familia='gestion' AND activo
          AND v_dias_gestion >= COALESCE(umbral_min,0) AND (umbral_max IS NULL OR v_dias_gestion < umbral_max)
        ORDER BY orden LIMIT 1;
    END IF;
  END IF;

  INSERT INTO public.seguimiento_ventas AS sv (
    company_id, empresa_vendedora, tiene_venta, owner_id,
    promedio_historico_mensual, potencial, acum_mes, acum_mes_anterior, acum_anio,
    fecha_ultima_compra, dias_ultima_compra, ciclo_dias, ritmo_pct,
    cotizaciones_total, ultima_cotizacion_fecha, dias_ultima_cotizacion,
    actividades_activas, actividades_total, dias_ultima_actividad, ultima_actividad_fecha, proxima_tarea_fecha,
    estatus_riesgo_id, estatus_ritmo_id, estatus_gestion_id, ultima_actualizacion
  ) VALUES (
    _company_id, _ev, v_tiene, v_owner,
    round(v_promedio,2), round(v_potencial,2), round(v_acum_mes,2), round(v_acum_ant,2), round(v_acum_anio,2),
    v_ultima, v_dias, round(v_ciclo,1), round(v_ritmo,1),
    v_cot_total, v_cot_ultima, v_cot_dias,
    v_act_activas, v_act_total, v_dias_act, v_act_ultima, v_prox,
    v_riesgo, v_ritmo_id, v_gestion, now()
  )
  ON CONFLICT (company_id, empresa_vendedora) DO UPDATE SET
    tiene_venta=EXCLUDED.tiene_venta, owner_id=COALESCE(EXCLUDED.owner_id, sv.owner_id),
    promedio_historico_mensual=EXCLUDED.promedio_historico_mensual, potencial=EXCLUDED.potencial,
    acum_mes=EXCLUDED.acum_mes, acum_mes_anterior=EXCLUDED.acum_mes_anterior, acum_anio=EXCLUDED.acum_anio,
    fecha_ultima_compra=EXCLUDED.fecha_ultima_compra, dias_ultima_compra=EXCLUDED.dias_ultima_compra,
    ciclo_dias=EXCLUDED.ciclo_dias, ritmo_pct=EXCLUDED.ritmo_pct,
    cotizaciones_total=EXCLUDED.cotizaciones_total, ultima_cotizacion_fecha=EXCLUDED.ultima_cotizacion_fecha,
    dias_ultima_cotizacion=EXCLUDED.dias_ultima_cotizacion,
    actividades_activas=EXCLUDED.actividades_activas, actividades_total=EXCLUDED.actividades_total,
    dias_ultima_actividad=EXCLUDED.dias_ultima_actividad, ultima_actividad_fecha=EXCLUDED.ultima_actividad_fecha,
    proxima_tarea_fecha=EXCLUDED.proxima_tarea_fecha,
    estatus_riesgo_id=EXCLUDED.estatus_riesgo_id, estatus_ritmo_id=EXCLUDED.estatus_ritmo_id,
    estatus_gestion_id=EXCLUDED.estatus_gestion_id, ultima_actualizacion=now();
END; $function$;

-- 2) Trigger fn for crm_activities + crm_tasks: refresh both empresa_vendedora rows for the company
CREATE OR REPLACE FUNCTION public.trg_crm_refresh_seguimiento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cid uuid;
  v_ev empresa_vendedora;
BEGIN
  v_cid := CASE WHEN TG_OP='DELETE' THEN OLD.company_id ELSE NEW.company_id END;
  IF v_cid IS NULL THEN
    RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
  END IF;
  FOR v_ev IN SELECT unnest(ARRAY['lumaggs','galsa']::empresa_vendedora[]) LOOP
    BEGIN
      PERFORM public.recompute_seguimiento_ventas(v_cid, v_ev);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_activities_refresh_seguimiento ON public.crm_activities;
CREATE TRIGGER trg_crm_activities_refresh_seguimiento
AFTER INSERT OR UPDATE OR DELETE ON public.crm_activities
FOR EACH ROW EXECUTE FUNCTION public.trg_crm_refresh_seguimiento();

DROP TRIGGER IF EXISTS trg_crm_tasks_refresh_seguimiento ON public.crm_tasks;
CREATE TRIGGER trg_crm_tasks_refresh_seguimiento
AFTER INSERT OR UPDATE OR DELETE ON public.crm_tasks
FOR EACH ROW EXECUTE FUNCTION public.trg_crm_refresh_seguimiento();

-- 3) Daily recompute cron (runs 09:00 UTC = ~03:00 America/Mexico_City)
DO $$
BEGIN
  PERFORM cron.unschedule('recompute-seguimiento-ventas-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'recompute-seguimiento-ventas-daily',
  '0 9 * * *',
  $$SELECT public.recompute_all_seguimiento_ventas();$$
);
