
CREATE OR REPLACE FUNCTION public.seed_crm_pipeline(p_marca text, p_user_id uuid, p_nombre text DEFAULT NULL)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pipeline_id UUID;
  v_nombre TEXT;
BEGIN
  v_nombre := COALESCE(p_nombre, 
    CASE WHEN p_marca = 'chevron' THEN 'Pipeline Chevron' ELSE 'Pipeline Phillips 66' END
  );

  INSERT INTO public.crm_pipelines (nombre, marca, created_by)
  VALUES (v_nombre, p_marca, p_user_id)
  RETURNING id INTO v_pipeline_id;

  INSERT INTO public.crm_pipeline_stages (pipeline_id, name, color, position) VALUES
    (v_pipeline_id, 'Prospecto', '#6b7280', 0),
    (v_pipeline_id, 'Calificado', '#3b82f6', 1),
    (v_pipeline_id, 'Propuesta', '#8b5cf6', 2),
    (v_pipeline_id, 'Negociación', '#f59e0b', 3),
    (v_pipeline_id, 'Ganado', '#10b981', 4),
    (v_pipeline_id, 'Perdido', '#ef4444', 5);

  RETURN v_pipeline_id;
END;
$function$;
