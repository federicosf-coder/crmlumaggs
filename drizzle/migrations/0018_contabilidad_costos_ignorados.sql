CREATE TABLE public.contabilidad_costos_ignorados (
  producto_id uuid PRIMARY KEY REFERENCES public.productos(id) ON DELETE CASCADE,
  ignorado_por uuid DEFAULT auth.uid(),
  ignorado_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.contabilidad_costos_ignorados TO authenticated;
GRANT ALL ON public.contabilidad_costos_ignorados TO service_role;
ALTER TABLE public.contabilidad_costos_ignorados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Costos ignorados por roles permitidos" ON public.contabilidad_costos_ignorados FOR ALL TO authenticated
  USING (public.contabilidad_costos_permitido()) WITH CHECK (public.contabilidad_costos_permitido());

CREATE OR REPLACE FUNCTION public.contabilidad_costos_listar()
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
 IF NOT public.contabilidad_costos_permitido() THEN RAISE EXCEPTION 'Sin permiso para consultar costos' USING ERRCODE='42501'; END IF;
 RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',p.id,'codigo',p.codigo,'nombre_producto',p.nombre_producto,'marca_id',p.marca_id,'marca',COALESCE(m.value,'Sin marca'),'clasificacion',COALESCE(c.nombre,'Sin clasificación'),'costo_actual',p.costo_actual,'fecha_registro',COALESCE(p.costo_registro_at,p.created_at),'precios',public.contabilidad_precios_snapshot(p),'activo',COALESCE(p.is_active,true),'ignorado',(i.producto_id IS NOT NULL),'empresas',COALESCE((SELECT jsonb_agg(em.empresa_vendedora) FROM public.empresa_marcas em WHERE em.marca_id=p.marca_id),CASE WHEN lower(COALESCE(m.value,''))='chevron' THEN '["lumaggs_chevron"]'::jsonb ELSE '["galsa_phillips66"]'::jsonb END)) ORDER BY p.codigo,p.id) FROM public.productos p LEFT JOIN public.product_option_values m ON m.id=p.marca_id LEFT JOIN public.precio_clasificaciones c ON c.id=p.precio_clasificacion_id LEFT JOIN public.contabilidad_costos_ignorados i ON i.producto_id=p.id),'[]'::jsonb);
END; $function$;