ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS costo_registro_at timestamptz;
CREATE TABLE public.contabilidad_costos_historial (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), producto_id uuid NOT NULL REFERENCES public.productos(id), codigo text NOT NULL, nombre_producto text NOT NULL, marca_id uuid, costo_anterior numeric, costo_nuevo numeric, precios_anteriores jsonb NOT NULL, precios_nuevos jsonb NOT NULL, fuente text NOT NULL DEFAULT 'catalogo', realizado_por uuid, realizado_at timestamptz NOT NULL DEFAULT now(), lote_id uuid
);
GRANT SELECT ON public.contabilidad_costos_historial TO authenticated;
GRANT ALL ON public.contabilidad_costos_historial TO service_role;
ALTER TABLE public.contabilidad_costos_historial ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.contabilidad_costos_permitido() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS (SELECT 1 FROM public.user_roles r JOIN public.role_costos_visibility v ON v.role=r.role WHERE r.user_id=auth.uid() AND r.role IN ('master','accounting') AND v.puede_ver_costos);
$$;
REVOKE ALL ON FUNCTION public.contabilidad_costos_permitido() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.contabilidad_costos_permitido() TO authenticated;
CREATE POLICY contabilidad_historial_lectura ON public.contabilidad_costos_historial FOR SELECT TO authenticated USING (public.contabilidad_costos_permitido());
CREATE INDEX contabilidad_historial_fecha ON public.contabilidad_costos_historial(realizado_at DESC);
CREATE OR REPLACE FUNCTION public.contabilidad_precios_snapshot(p public.productos) RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT jsonb_build_object('UF1',p.precio_base_uf1,'UF2',p.precio_uf2,'UF3',p.precio_uf3,'UF4',p.precio_uf4,'R1',p.precio_r1,'R2',p.precio_r2,'R3',p.precio_r3,'R4',p.precio_r4,'Galper',p.precio_lista_galper);
$$;
CREATE OR REPLACE FUNCTION public.contabilidad_costos_fecha() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF (to_jsonb(NEW)-'updated_at'-'costo_registro_at') IS DISTINCT FROM (to_jsonb(OLD)-'updated_at'-'costo_registro_at') THEN NEW.costo_registro_at:=now(); ELSE NEW.costo_registro_at:=OLD.costo_registro_at; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER contabilidad_costos_fecha BEFORE UPDATE ON public.productos FOR EACH ROW EXECUTE FUNCTION public.contabilidad_costos_fecha();
CREATE OR REPLACE FUNCTION public.contabilidad_costos_auditar() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF OLD.costo_actual IS DISTINCT FROM NEW.costo_actual OR public.contabilidad_precios_snapshot(OLD) IS DISTINCT FROM public.contabilidad_precios_snapshot(NEW) THEN
 INSERT INTO public.contabilidad_costos_historial(producto_id,codigo,nombre_producto,marca_id,costo_anterior,costo_nuevo,precios_anteriores,precios_nuevos,fuente,realizado_por,lote_id)
 VALUES(NEW.id,NEW.codigo,NEW.nombre_producto,NEW.marca_id,OLD.costo_actual,NEW.costo_actual,public.contabilidad_precios_snapshot(OLD),public.contabilidad_precios_snapshot(NEW),COALESCE(NULLIF(current_setting('app.costos_fuente',true),''),'catalogo'),auth.uid(),NULLIF(current_setting('app.costos_lote',true),'')::uuid);
 END IF; RETURN NEW;
END; $$;
CREATE TRIGGER contabilidad_costos_auditar AFTER UPDATE ON public.productos FOR EACH ROW EXECUTE FUNCTION public.contabilidad_costos_auditar();
CREATE OR REPLACE FUNCTION public.contabilidad_costos_listar() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.contabilidad_costos_permitido() THEN RAISE EXCEPTION 'Sin permiso para consultar costos' USING ERRCODE='42501'; END IF;
 RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',p.id,'codigo',p.codigo,'nombre_producto',p.nombre_producto,'marca_id',p.marca_id,'marca',COALESCE(m.value,'Sin marca'),'clasificacion',COALESCE(c.nombre,'Sin clasificación'),'costo_actual',p.costo_actual,'fecha_registro',COALESCE(p.costo_registro_at,p.created_at),'precios',public.contabilidad_precios_snapshot(p),'empresas',COALESCE((SELECT jsonb_agg(em.empresa_vendedora) FROM public.empresa_marcas em WHERE em.marca_id=p.marca_id),CASE WHEN lower(COALESCE(m.value,''))='chevron' THEN '["lumaggs_chevron"]'::jsonb ELSE '["galsa_phillips66"]'::jsonb END)) ORDER BY p.codigo,p.id) FROM public.productos p LEFT JOIN public.product_option_values m ON m.id=p.marca_id LEFT JOIN public.precio_clasificaciones c ON c.id=p.precio_clasificacion_id),'[]'::jsonb);
END; $$;
CREATE OR REPLACE FUNCTION public.contabilidad_costos_aplicar(p_cambios jsonb, p_fuente text DEFAULT 'edicion', p_recalcular boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE item jsonb; p public.productos; nuevo public.productos; margenes jsonb; costo numeric; precios jsonb; claves text[]:=ARRAY['UF1','UF2','UF3','UF4','R1','R2','R3','R4']; clave text; margen numeric; precio numeric; n integer:=0; lote uuid:=gen_random_uuid();
BEGIN
 IF NOT public.contabilidad_costos_permitido() THEN RAISE EXCEPTION 'Sin permiso para modificar costos' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_cambios)<>'array' OR jsonb_array_length(p_cambios)=0 OR jsonb_array_length(p_cambios)>5000 THEN RAISE EXCEPTION 'Selecciona entre 1 y 5000 productos'; END IF;
 IF (SELECT count(*) FROM jsonb_array_elements(p_cambios))<>(SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(p_cambios)) THEN RAISE EXCEPTION 'Productos repetidos'; END IF;
 PERFORM set_config('app.costos_fuente',CASE WHEN p_recalcular THEN 'recalculo' WHEN p_fuente='carga' THEN 'carga' ELSE 'edicion' END,true);
 PERFORM set_config('app.costos_lote',lote::text,true);
 FOR item IN SELECT value FROM jsonb_array_elements(p_cambios) ORDER BY value->>'id' LOOP
 SELECT * INTO p FROM public.productos WHERE id=(item->>'id')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Producto no encontrado'; END IF;
 IF NOT (item ? 'costo_anterior') OR (item->>'costo_anterior')::numeric IS DISTINCT FROM p.costo_actual THEN RAISE EXCEPTION 'El costo de % cambió; actualiza la lista antes de guardar',p.codigo; END IF;
 costo:=CASE WHEN p_recalcular THEN p.costo_actual ELSE (item->>'costo')::numeric END;
 IF costo IS NULL OR costo<0 OR costo::text IN ('NaN','Infinity','-Infinity') OR round(costo,2)<>costo THEN RAISE EXCEPTION 'Costo inválido para %',p.codigo; END IF;
 IF NOT p_recalcular AND costo IS NOT DISTINCT FROM p.costo_actual THEN CONTINUE; END IF;
 margenes:=NULL;
 SELECT to_jsonb(m) INTO margenes FROM public.producto_linea_margenes m WHERE m.linea_id=p.linea_id AND m.activo LIMIT 1;
 IF margenes IS NULL THEN SELECT to_jsonb(m) INTO margenes FROM public.producto_linea_margenes m WHERE m.linea_id IS NULL LIMIT 1; END IF;
 IF margenes IS NULL THEN SELECT to_jsonb(m) INTO margenes FROM public.precio_clasificaciones m WHERE m.id=p.precio_clasificacion_id; END IF;
 IF margenes IS NULL THEN SELECT to_jsonb(m) INTO margenes FROM public.precio_config_global m LIMIT 1; END IF;
 IF margenes IS NULL THEN RAISE EXCEPTION 'No hay reglas de precios para %',p.codigo; END IF;
 precios:='{}'::jsonb;
 FOREACH clave IN ARRAY claves LOOP
 margen:=COALESCE((margenes->>('margen_'||lower(clave)))::numeric,0);
 precio:=CASE WHEN margen>=100 THEN 0 ELSE ceil(round(costo/(1-margen/100),2)/5)*5 END;
 precios:=precios||jsonb_build_object(clave,precio);
 END LOOP;
 UPDATE public.productos SET costo_actual=costo,precio_base_uf1=(precios->>'UF1')::numeric,precio_uf2=(precios->>'UF2')::numeric,precio_uf3=(precios->>'UF3')::numeric,precio_uf4=(precios->>'UF4')::numeric,precio_r1=(precios->>'R1')::numeric,precio_r2=(precios->>'R2')::numeric,precio_r3=(precios->>'R3')::numeric,precio_r4=(precios->>'R4')::numeric WHERE id=p.id RETURNING * INTO nuevo;
 IF p.costo_actual IS DISTINCT FROM nuevo.costo_actual OR public.contabilidad_precios_snapshot(p) IS DISTINCT FROM public.contabilidad_precios_snapshot(nuevo) THEN n:=n+1; END IF;
 END LOOP;
 RETURN jsonb_build_object('actualizados',n,'lote_id',lote);
END; $$;
REVOKE ALL ON FUNCTION public.contabilidad_costos_listar(), public.contabilidad_costos_aplicar(jsonb,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.contabilidad_costos_listar(), public.contabilidad_costos_aplicar(jsonb,text,boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.contabilidad_costos_auditar(),public.contabilidad_costos_fecha() FROM PUBLIC,anon,authenticated;