CREATE OR REPLACE FUNCTION public.trg_documentos_recalc_deal_units()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN COALESCE(NEW, OLD);
END;
$function$;