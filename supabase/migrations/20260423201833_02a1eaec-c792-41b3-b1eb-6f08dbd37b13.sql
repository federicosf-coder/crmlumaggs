-- Add GPS columns for delivery confirmation
ALTER TABLE public.entregas_programadas
  ADD COLUMN IF NOT EXISTS delivered_latitude numeric,
  ADD COLUMN IF NOT EXISTS delivered_longitude numeric;

-- Defensive validation: lat/lng ranges when set
CREATE OR REPLACE FUNCTION public.validate_entrega_delivered_coords()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.delivered_latitude IS NOT NULL AND (NEW.delivered_latitude < -90 OR NEW.delivered_latitude > 90) THEN
    RAISE EXCEPTION 'delivered_latitude fuera de rango (-90, 90): %', NEW.delivered_latitude;
  END IF;
  IF NEW.delivered_longitude IS NOT NULL AND (NEW.delivered_longitude < -180 OR NEW.delivered_longitude > 180) THEN
    RAISE EXCEPTION 'delivered_longitude fuera de rango (-180, 180): %', NEW.delivered_longitude;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_entrega_delivered_coords ON public.entregas_programadas;
CREATE TRIGGER trg_validate_entrega_delivered_coords
BEFORE INSERT OR UPDATE ON public.entregas_programadas
FOR EACH ROW
EXECUTE FUNCTION public.validate_entrega_delivered_coords();