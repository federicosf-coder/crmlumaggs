REVOKE EXECUTE ON FUNCTION public.rvs_merge_personas(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rvs_merge_personas(uuid, uuid[]) TO authenticated;