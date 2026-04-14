
-- Create sequence starting at 10001
CREATE SEQUENCE IF NOT EXISTS public.cotizacion_number_seq START WITH 10001;

-- Create function to auto-assign cotizacion number
CREATE OR REPLACE FUNCTION public.auto_assign_cotizacion_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tipo_documento = 'cotizacion' AND (NEW.numero_cotizacion IS NULL OR NEW.numero_cotizacion = '') THEN
    NEW.numero_cotizacion := 'COT-' || nextval('public.cotizacion_number_seq')::text;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
CREATE TRIGGER trg_auto_cotizacion_number
BEFORE INSERT ON public.documentos
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_cotizacion_number();

-- Add unique constraint on numero_cotizacion
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_numero_cotizacion 
ON public.documentos (numero_cotizacion) 
WHERE numero_cotizacion IS NOT NULL AND is_active = true;
