CREATE OR REPLACE FUNCTION public.rvs_merge_personas(_master uuid, _dupes uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _moved int := 0;
  _summed int := 0;
BEGIN
  IF NOT (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'customer_service')) THEN
    RAISE EXCEPTION 'permiso_denegado';
  END IF;

  _dupes := array_remove(_dupes, _master);
  IF _dupes IS NULL OR array_length(_dupes, 1) IS NULL THEN
    RETURN jsonb_build_object('moved', 0, 'summed', 0);
  END IF;

  -- Sumar en filas existentes del master (mismo mes/marca)
  WITH agg AS (
    SELECT anio_mes, marca,
           SUM(unidades) u, SUM(venta) v, SUM(costo) c, SUM(utilidad) ut
    FROM rvs_ventas_mes
    WHERE persona_id = ANY(_dupes)
      AND (anio_mes, marca) IN (SELECT anio_mes, marca FROM rvs_ventas_mes WHERE persona_id = _master)
    GROUP BY anio_mes, marca
  )
  UPDATE rvs_ventas_mes m
  SET unidades = m.unidades + agg.u,
      venta = m.venta + agg.v,
      costo = m.costo + agg.c,
      utilidad = m.utilidad + agg.ut,
      margen = CASE WHEN (m.venta + agg.v) <> 0 THEN ((m.utilidad + agg.ut) / (m.venta + agg.v)) * 100 ELSE NULL END
  FROM agg
  WHERE m.persona_id = _master AND m.anio_mes = agg.anio_mes AND m.marca = agg.marca;
  GET DIAGNOSTICS _summed = ROW_COUNT;

  DELETE FROM rvs_ventas_mes
  WHERE persona_id = ANY(_dupes)
    AND (anio_mes, marca) IN (SELECT anio_mes, marca FROM rvs_ventas_mes WHERE persona_id = _master);

  -- Consolidar duplicados internos entre los dupes antes de mover
  WITH agg2 AS (
    SELECT anio_mes, marca,
           SUM(unidades) u, SUM(venta) v, SUM(costo) c, SUM(utilidad) ut,
           MIN(id::text)::uuid keep_id,
           MAX(plaza_id::text)::uuid pl
    FROM rvs_ventas_mes
    WHERE persona_id = ANY(_dupes)
    GROUP BY anio_mes, marca
  ), del AS (
    DELETE FROM rvs_ventas_mes r
    USING agg2
    WHERE r.persona_id = ANY(_dupes) AND r.anio_mes = agg2.anio_mes AND r.marca = agg2.marca AND r.id <> agg2.keep_id
    RETURNING 1
  )
  UPDATE rvs_ventas_mes r
  SET persona_id = _master,
      unidades = agg2.u, venta = agg2.v, costo = agg2.c, utilidad = agg2.ut,
      margen = CASE WHEN agg2.v <> 0 THEN (agg2.ut / agg2.v) * 100 ELSE NULL END,
      plaza_id = COALESCE(r.plaza_id, agg2.pl)
  FROM agg2
  WHERE r.id = agg2.keep_id;
  GET DIAGNOSTICS _moved = ROW_COUNT;

  -- Conservar nombres alternativos
  UPDATE rvs_personas m
  SET aliases = (
    SELECT ARRAY(SELECT DISTINCT x FROM unnest(
      m.aliases || ARRAY(SELECT nombre_reporte FROM rvs_personas WHERE id = ANY(_dupes))
                || ARRAY(SELECT unnest(aliases) FROM rvs_personas WHERE id = ANY(_dupes))
    ) x WHERE x IS NOT NULL AND x <> '')
  )
  WHERE m.id = _master;

  DELETE FROM rvs_personas WHERE id = ANY(_dupes);

  RETURN jsonb_build_object('moved', _moved, 'summed', _summed);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rvs_merge_personas(uuid, uuid[]) TO authenticated;