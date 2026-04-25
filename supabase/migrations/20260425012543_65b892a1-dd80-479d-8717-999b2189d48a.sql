-- Add potencial_unidades to crm_deals
ALTER TABLE public.crm_deals
ADD COLUMN IF NOT EXISTS potencial_unidades numeric;

-- Backfill from volumen_mensual_estimado where empty
UPDATE public.crm_deals
SET potencial_unidades = volumen_mensual_estimado
WHERE potencial_unidades IS NULL
  AND volumen_mensual_estimado IS NOT NULL;

COMMENT ON COLUMN public.crm_deals.potencial_unidades IS
  'Meta editable de unidades equivalentes esperadas para la oportunidad. Independiente del histórico volumen_mensual_estimado.';