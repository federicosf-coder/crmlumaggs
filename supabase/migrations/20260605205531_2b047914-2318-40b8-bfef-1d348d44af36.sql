CREATE OR REPLACE FUNCTION public.trg_crm_refresh_seguimiento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_cid uuid;
  v_ev empresa_vendedora;
BEGIN
  v_cid := CASE WHEN TG_OP='DELETE' THEN OLD.company_id ELSE NEW.company_id END;
  IF v_cid IS NULL THEN
    RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
  END IF;
  FOR v_ev IN SELECT unnest(ARRAY['lumaggs_chevron','galsa_phillips66']::empresa_vendedora[]) LOOP
    BEGIN
      PERFORM public.recompute_seguimiento_ventas(v_cid, v_ev);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END;
$function$;