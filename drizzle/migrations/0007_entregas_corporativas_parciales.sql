ALTER TABLE public.entregas_corporativas_lineas ADD COLUMN cantidad_entregada numeric NOT NULL DEFAULT 0;
UPDATE public.entregas_corporativas_lineas l SET cantidad_entregada = GREATEST(0, COALESCE(l.cantidad,0)) FROM public.entregas_corporativas e WHERE e.id=l.entrega_id AND e.estatus='entregada';
ALTER TABLE public.entregas_corporativas_lineas ADD CONSTRAINT entcorp_cantidad_entregada_check CHECK (cantidad_entregada >= 0 AND cantidad_entregada <= GREATEST(0,COALESCE(cantidad,0)));
ALTER TABLE public.entregas_corporativas DROP CONSTRAINT entregas_corporativas_estatus_check;
ALTER TABLE public.entregas_corporativas ADD CONSTRAINT entregas_corporativas_estatus_check CHECK (estatus IN ('programada','entregada','entregada_parcial','cancelada'));
ALTER TABLE public.entregas_corporativas ADD COLUMN entrega_registrada_at timestamptz, ADD COLUMN entrega_registrada_por uuid;
CREATE OR REPLACE FUNCTION public.registrar_entrega_corporativa(p_entrega_id uuid, p_lineas jsonb, p_factura text DEFAULT NULL) RETURNS text LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE e public.entregas_corporativas; l public.entregas_corporativas_lineas; item jsonb; v_cantidad numeric; v_previa numeric; v_estado text; v_count integer; v_changed boolean := false;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Inicia sesión para registrar una entrega'; END IF;
 SELECT * INTO e FROM public.entregas_corporativas WHERE id=p_entrega_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Entrega no disponible o sin permisos'; END IF;
 IF e.estatus NOT IN ('programada','entregada_parcial') THEN RAISE EXCEPTION 'La entrega ya no está pendiente. Actualiza la pantalla'; END IF;
 IF e.ubicacion_id IS NULL THEN RAISE EXCEPTION 'Asigna una ubicación antes de registrar la entrega'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.entregas_corporativas_evidencias WHERE entrega_id=e.id) AND e.evidencia_firmada_path IS NULL THEN RAISE EXCEPTION 'Sube una evidencia antes de registrar la entrega'; END IF;
 IF p_lineas IS NULL OR jsonb_typeof(p_lineas)<>'array' OR jsonb_array_length(p_lineas)=0 THEN RAISE EXCEPTION 'No hay productos para registrar'; END IF;
 PERFORM id FROM public.entregas_corporativas_lineas WHERE entrega_id=e.id ORDER BY id FOR UPDATE;
 SELECT count(*) INTO v_count FROM public.entregas_corporativas_lineas WHERE entrega_id=e.id;
 IF v_count<>jsonb_array_length(p_lineas) OR (SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(p_lineas) x)<>v_count THEN RAISE EXCEPTION 'Los productos cambiaron. Actualiza la pantalla'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_lineas) LOOP
  SELECT * INTO l FROM public.entregas_corporativas_lineas WHERE id=(item->>'id')::uuid AND entrega_id=e.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Producto no disponible'; END IF;
  v_cantidad := (item->>'cantidad')::numeric; v_previa := (item->>'previa')::numeric;
  IF v_previa IS NULL OR v_previa<>l.cantidad_entregada THEN RAISE EXCEPTION 'Otro usuario actualizó esta entrega. Actualiza la pantalla'; END IF;
  IF v_cantidad IS NULL OR v_cantidad::text IN ('NaN','Infinity','-Infinity') OR v_cantidad<0 OR v_cantidad+l.cantidad_entregada>GREATEST(0,COALESCE(l.cantidad,0)) THEN RAISE EXCEPTION 'Cantidad entregada fuera de rango'; END IF;
  IF v_cantidad>0 THEN
   UPDATE public.entregas_corporativas_lineas SET cantidad_entregada=cantidad_entregada+v_cantidad WHERE id=l.id;
   IF NOT FOUND THEN RAISE EXCEPTION 'Sin permisos para actualizar productos'; END IF;
   v_changed:=true;
  END IF;
 END LOOP;
 IF NOT v_changed THEN RAISE EXCEPTION 'Captura al menos una cantidad entregada'; END IF;
 SELECT CASE WHEN bool_and(cantidad_entregada>=GREATEST(0,COALESCE(cantidad,0))) THEN 'entregada' ELSE 'entregada_parcial' END INTO v_estado FROM public.entregas_corporativas_lineas WHERE entrega_id=e.id;
 UPDATE public.entregas_corporativas SET estatus=v_estado, factura_referencia=COALESCE(NULLIF(btrim(p_factura),''),factura_referencia), entrega_registrada_at=now(), entrega_registrada_por=auth.uid() WHERE id=e.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Sin permisos para registrar la entrega'; END IF;
 RETURN v_estado;
END $$;
REVOKE ALL ON FUNCTION public.registrar_entrega_corporativa(uuid,jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.registrar_entrega_corporativa(uuid,jsonb,text) TO authenticated;
GRANT ALL ON FUNCTION public.registrar_entrega_corporativa(uuid,jsonb,text) TO service_role;