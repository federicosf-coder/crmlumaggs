CREATE OR REPLACE FUNCTION public.trg_documento_productos_sync_ue()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _doc uuid; _sum numeric; _n int;
BEGIN
  _doc := COALESCE(NEW.documento_id, OLD.documento_id);
  SELECT COALESCE(SUM(unidades_equivalentes),0), COUNT(*) INTO _sum, _n
    FROM documento_productos WHERE documento_id = _doc;
  IF _sum > 0 OR _n = 0 THEN
    UPDATE documentos SET unidades_equivalentes_total = _sum
     WHERE id = _doc AND COALESCE(unidades_equivalentes_total,0) IS DISTINCT FROM _sum;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.documento_id IS DISTINCT FROM NEW.documento_id THEN
    SELECT COALESCE(SUM(unidades_equivalentes),0), COUNT(*) INTO _sum, _n
      FROM documento_productos WHERE documento_id = OLD.documento_id;
    IF _sum > 0 OR _n = 0 THEN
      UPDATE documentos SET unidades_equivalentes_total = _sum
       WHERE id = OLD.documento_id AND COALESCE(unidades_equivalentes_total,0) IS DISTINCT FROM _sum;
    END IF;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_documento_productos_sync_ue ON public.documento_productos;
CREATE TRIGGER trg_documento_productos_sync_ue
AFTER INSERT OR UPDATE OF unidades_equivalentes, documento_id OR DELETE ON public.documento_productos
FOR EACH ROW EXECUTE FUNCTION public.trg_documento_productos_sync_ue();

-- Backfill: documentos con encabezado en 0/distinto pero líneas con unidades
UPDATE public.documentos d SET unidades_equivalentes_total = s.total
FROM (SELECT documento_id, SUM(unidades_equivalentes) total FROM public.documento_productos GROUP BY documento_id) s
WHERE s.documento_id = d.id AND s.total > 0
  AND abs(COALESCE(d.unidades_equivalentes_total,0) - s.total) > 0.001;