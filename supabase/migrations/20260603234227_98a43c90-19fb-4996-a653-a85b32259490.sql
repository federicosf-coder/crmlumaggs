DROP VIEW IF EXISTS public.crm_items_unified;
DROP TRIGGER IF EXISTS trg_documentos_auto_assign_negocio ON public.documentos;
ALTER TABLE public.crm_tasks       DROP COLUMN IF EXISTS deal_id CASCADE;
ALTER TABLE public.crm_activities  DROP COLUMN IF EXISTS deal_id CASCADE;
ALTER TABLE public.documentos      DROP COLUMN IF EXISTS negocio_id CASCADE;
ALTER TABLE public.documentos      DROP COLUMN IF EXISTS deal_id CASCADE;