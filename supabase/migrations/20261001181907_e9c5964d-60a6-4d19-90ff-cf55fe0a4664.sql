ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS created_by uuid DEFAULT auth.uid();

CREATE OR REPLACE FUNCTION public.leads_ejecutivo_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
    NEW.responsable_id := COALESCE(NEW.responsable_id, auth.uid());
    RETURN NEW;
  END IF;
  IF NEW.responsable_id IS DISTINCT FROM OLD.responsable_id
     AND OLD.responsable_id IS NOT NULL
     AND auth.uid() IS NOT NULL
     AND NOT (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'customer_service')) THEN
    RAISE EXCEPTION 'Solo Servicio al Cliente o Administrador pueden cambiar el ejecutivo asignado';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS leads_ejecutivo_guard ON public.leads;
CREATE TRIGGER leads_ejecutivo_guard BEFORE INSERT OR UPDATE ON public.leads
FOR EACH ROW EXECUTE FUNCTION public.leads_ejecutivo_guard();