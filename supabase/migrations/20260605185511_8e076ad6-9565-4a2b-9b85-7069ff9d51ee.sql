ALTER TABLE public.automations DROP CONSTRAINT IF EXISTS automations_entity_type_check;
ALTER TABLE public.automations ADD CONSTRAINT automations_entity_type_check
  CHECK (entity_type = ANY (ARRAY['deal','company','document','contact','task','seguimiento_venta','payment','credit_request','entrega']));