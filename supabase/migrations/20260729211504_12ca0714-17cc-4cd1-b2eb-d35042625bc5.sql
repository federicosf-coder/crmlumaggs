DROP INDEX IF EXISTS public.lead_integration_events_leadgen_idx;
ALTER TABLE public.lead_integration_events
  ADD CONSTRAINT lead_integration_events_leadgen_key UNIQUE (leadgen_id);