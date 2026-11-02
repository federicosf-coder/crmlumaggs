CREATE OR REPLACE FUNCTION public.contpaq_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM user_roles WHERE user_id=auth.uid() AND role::text IN ('admin','master')) $$;
CREATE OR REPLACE FUNCTION public.contpaq_ver_usuario(_usuario uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT auth.uid() IS NOT NULL AND (public.contpaq_admin() OR auth.uid()=_usuario OR EXISTS(SELECT 1 FROM team_managers m JOIN team_members t ON t.team_id=m.team_id WHERE m.user_id=auth.uid() AND t.user_id=_usuario)) $$;
CREATE TABLE public.contpaq_cargas(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), marca text NOT NULL CHECK(marca IN ('lumaggs_chevron','galsa_phillips66')), tipo text NOT NULL CHECK(tipo IN ('clientes','agentes','ventas')), archivo text NOT NULL, ruta text NOT NULL, hash text NOT NULL, filas integer NOT NULL DEFAULT 0, creado_por uuid, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(marca,tipo,hash));
GRANT SELECT,INSERT ON public.contpaq_cargas TO authenticated; GRANT ALL ON public.contpaq_cargas TO service_role;
ALTER TABLE public.contpaq_cargas ENABLE ROW LEVEL SECURITY;
CREATE POLICY cargas_admin ON public.contpaq_cargas TO authenticated USING(public.contpaq_admin()) WITH CHECK(public.contpaq_admin());
CREATE TABLE public.contpaq_clientes(marca text NOT NULL, codigo text NOT NULL, nombre text NOT NULL, rfc text, PRIMARY KEY(marca,codigo));
GRANT SELECT ON public.contpaq_clientes TO authenticated; GRANT ALL ON public.contpaq_clientes TO service_role;
ALTER TABLE public.contpaq_clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY clientes_admin ON public.contpaq_clientes FOR SELECT TO authenticated USING(public.contpaq_admin());
CREATE TABLE public.contpaq_agentes(marca text NOT NULL, codigo text NOT NULL, nombre text NOT NULL, persona_id uuid REFERENCES public.rvs_personas(id), PRIMARY KEY(marca,codigo));
GRANT SELECT ON public.contpaq_agentes TO authenticated; GRANT ALL ON public.contpaq_agentes TO service_role;
ALTER TABLE public.contpaq_agentes ENABLE ROW LEVEL SECURITY;
CREATE POLICY agentes_admin ON public.contpaq_agentes FOR SELECT TO authenticated USING(public.contpaq_admin());
CREATE TABLE public.contpaq_productos(marca text NOT NULL, codigo text NOT NULL, nombre text NOT NULL, producto_id uuid REFERENCES public.productos(id), PRIMARY KEY(marca,codigo));
GRANT SELECT ON public.contpaq_productos TO authenticated; GRANT ALL ON public.contpaq_productos TO service_role;
ALTER TABLE public.contpaq_productos ENABLE ROW LEVEL SECURITY;
CREATE POLICY productos_admin ON public.contpaq_productos FOR SELECT TO authenticated USING(public.contpaq_admin());
CREATE TABLE public.contpaq_ventas(marca text NOT NULL, serie text NOT NULL, folio text NOT NULL, fecha date NOT NULL, cliente_codigo text NOT NULL, agente_codigo text NOT NULL, concepto text NOT NULL, estado text NOT NULL, moneda text NOT NULL, tc numeric NOT NULL, lineas jsonb NOT NULL, carga_id uuid REFERENCES public.contpaq_cargas(id), PRIMARY KEY(marca,serie,folio));
GRANT SELECT ON public.contpaq_ventas TO authenticated; GRANT ALL ON public.contpaq_ventas TO service_role;
ALTER TABLE public.contpaq_ventas ENABLE ROW LEVEL SECURITY;
CREATE POLICY ventas_visibles ON public.contpaq_ventas FOR SELECT TO authenticated USING(public.contpaq_admin() OR EXISTS(SELECT 1 FROM public.contpaq_agentes a JOIN public.rvs_personas p ON p.id=a.persona_id WHERE a.marca=contpaq_ventas.marca AND a.codigo=contpaq_ventas.agente_codigo AND public.contpaq_ver_usuario(p.user_id)));
CREATE INDEX contpaq_ventas_fecha ON public.contpaq_ventas(marca,agente_codigo,fecha);
CREATE TABLE public.contpaq_cortes(marca text NOT NULL, usuario_id uuid NOT NULL, mes date NOT NULL, historico jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(marca,usuario_id,mes));
GRANT SELECT ON public.contpaq_cortes TO authenticated; GRANT ALL ON public.contpaq_cortes TO service_role;
ALTER TABLE public.contpaq_cortes ENABLE ROW LEVEL SECURITY;
CREATE POLICY cortes_visibles ON public.contpaq_cortes FOR SELECT TO authenticated USING(public.contpaq_ver_usuario(usuario_id));
CREATE OR REPLACE FUNCTION public.contpaq_normalizar(_nombre text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT regexp_replace(translate(upper(regexp_replace(trim(_nombre),'\s*-\s*(PSM|DDA|DAG|PGA)$','','i')),'ÁÉÍÓÚÜÑ','AEIOUUN'),'\s+',' ','g') $$;
CREATE OR REPLACE FUNCTION public.contpaq_importar(_marca text,_tipo text,_archivo text,_ruta text,_hash text,_filas jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c uuid; r jsonb; l jsonb; pid uuid; n integer:=0;
BEGIN
 IF NOT public.contpaq_admin() THEN RAISE EXCEPTION 'Solo administradores pueden cargar archivos'; END IF;
 IF _marca NOT IN ('lumaggs_chevron','galsa_phillips66') OR _tipo NOT IN ('clientes','agentes','ventas') OR jsonb_typeof(_filas)<>'array' OR jsonb_array_length(_filas)=0 OR jsonb_array_length(_filas)>50000 OR _hash !~ '^[a-f0-9]{64}$' OR length(_archivo)>255 OR _ruta NOT LIKE _marca||'/%' THEN RAISE EXCEPTION 'Archivo inválido'; END IF;
 SELECT id INTO c FROM contpaq_cargas WHERE marca=_marca AND tipo=_tipo AND hash=_hash;
 IF c IS NOT NULL THEN RETURN jsonb_build_object('repetido',true,'filas',0); END IF;
 INSERT INTO contpaq_cargas(marca,tipo,archivo,ruta,hash,creado_por) VALUES(_marca,_tipo,_archivo,_ruta,_hash,auth.uid()) RETURNING id INTO c;
 FOR r IN SELECT value FROM jsonb_array_elements(_filas) LOOP
  IF _tipo IN ('clientes','agentes') AND (coalesce(r->>'codigo','')='' OR coalesce(r->>'nombre','')='') THEN RAISE EXCEPTION 'Código o nombre vacío'; END IF;
  IF _tipo='clientes' THEN
   INSERT INTO contpaq_clientes VALUES(_marca,r->>'codigo',r->>'nombre',r->>'rfc') ON CONFLICT(marca,codigo) DO UPDATE SET nombre=excluded.nombre,rfc=excluded.rfc;
  ELSIF _tipo='agentes' THEN
   pid:=NULL;
   SELECT min(id::text)::uuid INTO pid FROM rvs_personas WHERE is_active AND (public.contpaq_normalizar(nombre_reporte)=public.contpaq_normalizar(r->>'nombre') OR EXISTS(SELECT 1 FROM unnest(aliases) a WHERE public.contpaq_normalizar(a)=public.contpaq_normalizar(r->>'nombre'))) HAVING count(*)=1;
   INSERT INTO contpaq_agentes VALUES(_marca,r->>'codigo',r->>'nombre',pid) ON CONFLICT(marca,codigo) DO UPDATE SET nombre=excluded.nombre,persona_id=coalesce(contpaq_agentes.persona_id,excluded.persona_id);
  ELSE
   IF coalesce(r->>'cliente','')='' OR coalesce(r->>'agente','')='' OR coalesce(r->>'folio','')='' OR jsonb_typeof(r->'lineas')<>'array' OR jsonb_array_length(r->'lineas')=0 THEN RAISE EXCEPTION 'Documento incompleto'; END IF;
   IF NOT EXISTS(SELECT 1 FROM contpaq_clientes WHERE marca=_marca AND codigo=r->>'cliente') THEN RAISE EXCEPTION 'Cliente % sin catálogo',r->>'cliente'; END IF;
   FOR l IN SELECT value FROM jsonb_array_elements(r->'lineas') LOOP
    IF coalesce(l->>'codigo_producto','')='' OR coalesce(l->>'producto','')='' OR (l->>'cantidad')::numeric<0 THEN RAISE EXCEPTION 'Producto inválido'; END IF;
    pid:=NULL;
    SELECT min(id::text)::uuid INTO pid FROM productos WHERE codigo=l->>'codigo_producto' HAVING count(*)=1;
    INSERT INTO contpaq_productos VALUES(_marca,l->>'codigo_producto',l->>'producto',pid) ON CONFLICT(marca,codigo) DO UPDATE SET nombre=excluded.nombre,producto_id=coalesce(contpaq_productos.producto_id,excluded.producto_id);
   END LOOP;
   INSERT INTO contpaq_ventas VALUES(_marca,r->>'serie',r->>'folio',(r->>'fecha')::date,r->>'cliente',r->>'agente',r->>'concepto',r->>'estado',r->>'moneda',(r->>'tc')::numeric,r->'lineas',c)
   ON CONFLICT(marca,serie,folio) DO UPDATE SET fecha=excluded.fecha,cliente_codigo=excluded.cliente_codigo,agente_codigo=excluded.agente_codigo,concepto=excluded.concepto,estado=excluded.estado,moneda=excluded.moneda,tc=excluded.tc,lineas=excluded.lineas,carga_id=excluded.carga_id;
  END IF;
  n:=n+1;
 END LOOP;
 UPDATE contpaq_cargas SET filas=n WHERE id=c;
 RETURN jsonb_build_object('repetido',false,'filas',n);
END $$;
CREATE OR REPLACE FUNCTION public.contpaq_vincular(_marca text,_codigo text,_tipo text,_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.contpaq_admin() THEN RAISE EXCEPTION 'Sin permiso'; END IF;
 IF _tipo='agente' THEN UPDATE contpaq_agentes SET persona_id=_id WHERE marca=_marca AND codigo=_codigo;
 ELSIF _tipo='producto' THEN UPDATE contpaq_productos SET producto_id=_id WHERE marca=_marca AND codigo=_codigo;
 ELSE RAISE EXCEPTION 'Tipo inválido'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.contpaq_asignar_usuario(_marca text,_codigo text,_usuario uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a contpaq_agentes; pid uuid;
BEGIN
 IF NOT public.contpaq_admin() THEN RAISE EXCEPTION 'Sin permiso'; END IF;
 IF _usuario IS NOT NULL AND NOT EXISTS(SELECT 1 FROM profiles WHERE user_id=_usuario AND is_active) THEN RAISE EXCEPTION 'Selecciona una cuenta activa'; END IF;
 SELECT * INTO a FROM contpaq_agentes WHERE marca=_marca AND codigo=_codigo FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Agente no encontrado'; END IF;
 IF a.codigo='253' OR a.codigo LIKE 'C%' OR upper(a.nombre)='NINGUNO' THEN RAISE EXCEPTION 'Esta cuenta no es una persona'; END IF;
 pid:=a.persona_id;
 IF pid IS NULL THEN
  INSERT INTO rvs_personas(nombre_reporte,nombre_normalizado,nombre_mostrar,user_id,sin_clasificar) VALUES(a.nombre,public.contpaq_normalizar(a.nombre),a.nombre,_usuario,true) RETURNING id INTO pid;
  UPDATE contpaq_agentes SET persona_id=pid WHERE marca=_marca AND codigo=_codigo;
 ELSE UPDATE rvs_personas SET user_id=_usuario,updated_at=now() WHERE id=pid;
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.contpaq_facturas(_marca text,_usuario uuid,_inicio date,_fin date) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce(jsonb_agg(jsonb_build_object('empresa_id',q.codigo,'cliente',q.nombre,'fecha',q.fecha,'unidades',q.unidades)),'[]'::jsonb) FROM (
 SELECT c.codigo,c.nombre,v.fecha,sum((l->>'cantidad')::numeric*pr.unidades_equivalentes) unidades FROM contpaq_ventas v
 JOIN contpaq_agentes a ON a.marca=v.marca AND a.codigo=v.agente_codigo JOIN rvs_personas rp ON rp.id=a.persona_id
 JOIN contpaq_clientes c ON c.marca=v.marca AND c.codigo=v.cliente_codigo
 CROSS JOIN LATERAL jsonb_array_elements(v.lineas) l JOIN contpaq_productos cp ON cp.marca=v.marca AND cp.codigo=l->>'codigo_producto'
 JOIN productos p ON p.id=cp.producto_id JOIN presentaciones pr ON pr.id=p.presentacion_id
 WHERE public.contpaq_ver_usuario(_usuario) AND v.marca=_marca AND rp.user_id=_usuario AND v.fecha>=_inicio AND v.fecha<_fin AND v.estado='Afectado' AND v.concepto ILIKE 'Facturacion%' GROUP BY c.codigo,c.nombre,v.fecha) q $$;
CREATE OR REPLACE FUNCTION public.contpaq_guia(_marca text,_usuario uuid,_mes date) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE h jsonb; actual jsonb; faltantes integer;
BEGIN
 IF NOT public.contpaq_ver_usuario(_usuario) THEN RAISE EXCEPTION 'Sin permiso para este ejecutivo'; END IF;
 IF _marca NOT IN ('lumaggs_chevron','galsa_phillips66') OR extract(day from _mes)<>1 THEN RAISE EXCEPTION 'Corte inválido'; END IF;
 SELECT count(*) INTO faltantes FROM contpaq_ventas v JOIN contpaq_agentes a ON a.marca=v.marca AND a.codigo=v.agente_codigo JOIN rvs_personas rp ON rp.id=a.persona_id CROSS JOIN LATERAL jsonb_array_elements(v.lineas) l LEFT JOIN contpaq_productos cp ON cp.marca=v.marca AND cp.codigo=l->>'codigo_producto' LEFT JOIN productos p ON p.id=cp.producto_id LEFT JOIN presentaciones pr ON pr.id=p.presentacion_id WHERE v.marca=_marca AND rp.user_id=_usuario AND v.fecha>=_mes-interval '12 months' AND v.fecha<_mes+interval '1 month' AND v.estado='Afectado' AND v.concepto ILIKE 'Facturacion%' AND pr.unidades_equivalentes IS NULL;
 IF faltantes>0 THEN RAISE EXCEPTION 'Hay % partidas sin unidades equivalentes. Vincula los productos en Catálogos antes de generar.',faltantes; END IF;
 SELECT historico INTO h FROM contpaq_cortes WHERE marca=_marca AND usuario_id=_usuario AND mes=_mes;
 IF h IS NULL THEN
  h:=public.contpaq_facturas(_marca,_usuario,(_mes-interval '12 months')::date,_mes);
  IF jsonb_array_length(h)>0 THEN
   INSERT INTO contpaq_cortes VALUES(_marca,_usuario,_mes,h,now()) ON CONFLICT DO NOTHING;
   SELECT historico INTO h FROM contpaq_cortes WHERE marca=_marca AND usuario_id=_usuario AND mes=_mes;
  END IF;
 END IF;
 actual:=public.contpaq_facturas(_marca,_usuario,_mes,(_mes+interval '1 month')::date);
 RETURN h||actual;
END $$;
REVOKE ALL ON FUNCTION public.contpaq_importar(text,text,text,text,text,jsonb),public.contpaq_vincular(text,text,text,uuid),public.contpaq_asignar_usuario(text,text,uuid),public.contpaq_facturas(text,uuid,date,date),public.contpaq_guia(text,uuid,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.contpaq_importar(text,text,text,text,text,jsonb),public.contpaq_vincular(text,text,text,uuid),public.contpaq_asignar_usuario(text,text,uuid),public.contpaq_guia(text,uuid,date) TO authenticated;
CREATE POLICY contpaq_archivos_select ON storage.objects FOR SELECT TO authenticated USING(bucket_id='contpaq-originales' AND public.contpaq_admin());
CREATE POLICY contpaq_archivos_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='contpaq-originales' AND public.contpaq_admin());