ALTER TABLE public.inv_reclamos ALTER COLUMN pedido_id DROP NOT NULL;
ALTER TABLE public.inv_reclamos ADD COLUMN devolucion_id uuid REFERENCES public.devoluciones(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX inv_reclamos_devolucion_uniq ON public.inv_reclamos(devolucion_id) WHERE devolucion_id IS NOT NULL;
ALTER TABLE public.devoluciones ADD COLUMN autorizada_por uuid, ADD COLUMN autorizada_at timestamptz;

CREATE OR REPLACE FUNCTION public.devoluciones_autorizacion_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.estado IN ('autorizada','rechazada') AND (TG_OP='INSERT' OR OLD.estado IS DISTINCT FROM NEW.estado) THEN
    IF auth.uid() IS NOT NULL AND NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) THEN
      RAISE EXCEPTION 'Solo gerencia puede autorizar o rechazar devoluciones';
    END IF;
    IF NEW.estado='autorizada' THEN NEW.autorizada_por := auth.uid(); NEW.autorizada_at := now(); END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_devoluciones_autorizacion BEFORE INSERT OR UPDATE ON public.devoluciones FOR EACH ROW EXECUTE FUNCTION public.devoluciones_autorizacion_guard();