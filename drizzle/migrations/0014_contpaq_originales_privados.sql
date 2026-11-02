CREATE TABLE public.contpaq_originales(hash text PRIMARY KEY, nombre text NOT NULL, contenido text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.contpaq_originales TO authenticated; GRANT ALL ON public.contpaq_originales TO service_role;
ALTER TABLE public.contpaq_originales ENABLE ROW LEVEL SECURITY;
CREATE POLICY originales_admin ON public.contpaq_originales FOR SELECT TO authenticated USING(public.contpaq_admin());
CREATE OR REPLACE FUNCTION public.contpaq_guardar_original(_hash text,_nombre text,_contenido text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF NOT public.contpaq_admin() THEN RAISE EXCEPTION 'Sin permiso'; END IF;
 IF _hash !~ '^[a-f0-9]{64}$' OR length(_nombre)>255 OR length(_contenido)>42000000 OR length(_contenido)=0 OR length(_contenido)%4<>0 OR _contenido !~ '^[A-Za-z0-9+/]*={0,2}$' THEN RAISE EXCEPTION 'Archivo inválido'; END IF;
 INSERT INTO contpaq_originales VALUES(_hash,_nombre,_contenido,now()) ON CONFLICT DO NOTHING;
 END $$;
REVOKE ALL ON FUNCTION public.contpaq_guardar_original(text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.contpaq_guardar_original(text,text,text) TO authenticated;