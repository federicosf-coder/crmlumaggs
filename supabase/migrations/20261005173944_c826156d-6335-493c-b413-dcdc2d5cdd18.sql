CREATE OR REPLACE FUNCTION public.list_ejecutivos_activos()
RETURNS TABLE(user_id uuid, full_name text, plaza_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.user_id, p.full_name, p.plaza_id FROM public.profiles p
  WHERE p.is_active = true AND auth.uid() IS NOT NULL
  ORDER BY p.full_name
$$;
REVOKE ALL ON FUNCTION public.list_ejecutivos_activos() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.list_ejecutivos_activos() TO authenticated;