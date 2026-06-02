-- Seguimiento a Ventas — Parte 2

CREATE TABLE IF NOT EXISTS public.seguimiento_ventas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  empresa_vendedora public.empresa_vendedora NOT NULL,
  tiene_venta boolean NOT NULL DEFAULT false,
  owner_id uuid,
  promedio_historico_mensual numeric NOT NULL DEFAULT 0,
  potencial numeric NOT NULL DEFAULT 0,
  acum_mes numeric NOT NULL DEFAULT 0,
  acum_mes_anterior numeric NOT NULL DEFAULT 0,
  acum_anio numeric NOT NULL DEFAULT 0,
  fecha_ultima_compra date,
  dias_ultima_compra integer,
  ciclo_dias numeric,
  ritmo_pct numeric,
  cotizaciones_total integer NOT NULL DEFAULT 0,
  ultima_cotizacion_fecha date,
  dias_ultima_cotizacion integer,
  estatus_riesgo_id  uuid REFERENCES public.seguimiento_estatus_catalogo(id) ON DELETE SET NULL,
  estatus_ritmo_id   uuid REFERENCES public.seguimiento_estatus_catalogo(id) ON DELETE SET NULL,
  estatus_gestion_id uuid REFERENCES public.seguimiento_estatus_catalogo(id) ON DELETE SET NULL,
  estatus_manual_id  uuid REFERENCES public.seguimiento_estatus_catalogo(id) ON DELETE SET NULL,
  estatus_manual boolean NOT NULL DEFAULT false,
  ultima_actualizacion timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_seguimiento_empresa_marca UNIQUE (company_id, empresa_vendedora)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seguimiento_ventas TO authenticated;
GRANT ALL ON public.seguimiento_ventas TO service_role;

CREATE INDEX IF NOT EXISTS idx_seg_ventas_marca ON public.seguimiento_ventas (empresa_vendedora, tiene_venta);
CREATE INDEX IF NOT EXISTS idx_seg_ventas_owner ON public.seguimiento_ventas (owner_id);

ALTER TABLE public.seguimiento_ventas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated view seguimiento" ON public.seguimiento_ventas;
CREATE POLICY "Authenticated view seguimiento"
  ON public.seguimiento_ventas FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Staff manage seguimiento" ON public.seguimiento_ventas;
CREATE POLICY "Staff manage seguimiento"
  ON public.seguimiento_ventas FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role)
      OR has_role(auth.uid(),'sales'::app_role) OR has_role(auth.uid(),'customer_service'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role)
      OR has_role(auth.uid(),'sales'::app_role) OR has_role(auth.uid(),'customer_service'::app_role));

DROP TRIGGER IF EXISTS trg_seg_ventas_updated ON public.seguimiento_ventas;
CREATE TRIGGER trg_seg_ventas_updated
  BEFORE UPDATE ON public.seguimiento_ventas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Función de cálculo
CREATE OR REPLACE FUNCTION public.recompute_seguimiento_ventas(
  _company_id uuid, _ev public.empresa_vendedora
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_promedio numeric:=0; v_potencial numeric:=0;
  v_acum_mes numeric:=0; v_acum_ant numeric:=0; v_acum_anio numeric:=0;
  v_ultima date; v_dias int; v_ciclo numeric; v_ciclo_eff numeric; v_mult numeric;
  v_tiene boolean:=false; v_cot_total int:=0; v_cot_ultima date; v_cot_dias int;
  v_ritmo numeric; v_meta numeric; v_dia int; v_dim int; v_owner uuid;
  v_riesgo uuid; v_ritmo_id uuid; v_gestion uuid;
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
    MAX(fecha_documento)
  INTO v_acum_mes, v_acum_ant, v_acum_anio, v_ultima
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

  SELECT user_id INTO v_owner FROM public.company_ejecutivos WHERE company_id=_company_id LIMIT 1;

  v_dia := EXTRACT(DAY FROM now())::int;
  v_dim := EXTRACT(DAY FROM (date_trunc('month',now())+interval '1 month - 1 day'))::int;
  IF v_promedio > 0 THEN
    v_meta := v_promedio * (v_dia::numeric / v_dim::numeric);
    IF v_meta > 0 THEN v_ritmo := (v_acum_mes / v_meta) * 100; END IF;
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
        WHERE ambito='con_venta' AND familia='ritmo' AND activo
          AND v_ritmo >= COALESCE(umbral_min,0) AND (umbral_max IS NULL OR v_ritmo < umbral_max)
        ORDER BY orden LIMIT 1;
    END IF;
  ELSE
    IF v_cot_dias IS NOT NULL THEN
      SELECT id INTO v_gestion FROM public.seguimiento_estatus_catalogo
        WHERE ambito='sin_venta' AND familia='gestion' AND activo
          AND v_cot_dias >= COALESCE(umbral_min,0) AND (umbral_max IS NULL OR v_cot_dias < umbral_max)
        ORDER BY orden LIMIT 1;
    END IF;
  END IF;

  INSERT INTO public.seguimiento_ventas AS sv (
    company_id, empresa_vendedora, tiene_venta, owner_id,
    promedio_historico_mensual, potencial, acum_mes, acum_mes_anterior, acum_anio,
    fecha_ultima_compra, dias_ultima_compra, ciclo_dias, ritmo_pct,
    cotizaciones_total, ultima_cotizacion_fecha, dias_ultima_cotizacion,
    estatus_riesgo_id, estatus_ritmo_id, estatus_gestion_id, ultima_actualizacion
  ) VALUES (
    _company_id, _ev, v_tiene, v_owner,
    round(v_promedio,2), round(v_potencial,2), round(v_acum_mes,2), round(v_acum_ant,2), round(v_acum_anio,2),
    v_ultima, v_dias, round(v_ciclo,1), round(v_ritmo,1),
    v_cot_total, v_cot_ultima, v_cot_dias,
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
    estatus_riesgo_id=EXCLUDED.estatus_riesgo_id, estatus_ritmo_id=EXCLUDED.estatus_ritmo_id,
    estatus_gestion_id=EXCLUDED.estatus_gestion_id, ultima_actualizacion=now();
END; $$;

-- Trigger de refresco al tocar facturas/cotizaciones
CREATE OR REPLACE FUNCTION public.trg_documentos_refresh_seguimiento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP='DELETE' THEN
    IF OLD.tipo_documento IN ('factura','cotizacion') AND OLD.empresa_id IS NOT NULL AND OLD.empresa_vendedora IS NOT NULL THEN
      PERFORM public.recompute_seguimiento_ventas(OLD.empresa_id, OLD.empresa_vendedora);
    END IF;
    RETURN OLD;
  END IF;

  IF NEW.tipo_documento IN ('factura','cotizacion') AND NEW.empresa_id IS NOT NULL AND NEW.empresa_vendedora IS NOT NULL THEN
    PERFORM public.recompute_seguimiento_ventas(NEW.empresa_id, NEW.empresa_vendedora);
  END IF;

  IF TG_OP='UPDATE' AND OLD.empresa_id IS NOT NULL AND OLD.empresa_vendedora IS NOT NULL
     AND OLD.tipo_documento IN ('factura','cotizacion')
     AND (OLD.empresa_id IS DISTINCT FROM NEW.empresa_id OR OLD.empresa_vendedora IS DISTINCT FROM NEW.empresa_vendedora) THEN
    PERFORM public.recompute_seguimiento_ventas(OLD.empresa_id, OLD.empresa_vendedora);
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_documentos_refresh_seguimiento ON public.documentos;
CREATE TRIGGER trg_documentos_refresh_seguimiento
  AFTER INSERT OR UPDATE OR DELETE ON public.documentos
  FOR EACH ROW EXECUTE FUNCTION public.trg_documentos_refresh_seguimiento();