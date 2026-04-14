CREATE OR REPLACE FUNCTION public.exec_raw_sql(query text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  EXECUTE query;
END;
$$;