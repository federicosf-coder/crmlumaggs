ALTER TABLE public.crm_tasks
  ADD COLUMN IF NOT EXISTS parent_task_id uuid REFERENCES public.crm_tasks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS parent_category text,
  ADD COLUMN IF NOT EXISTS sequence_order int DEFAULT 0;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'crm_tasks_parent_category_check') THEN
    ALTER TABLE public.crm_tasks
      ADD CONSTRAINT crm_tasks_parent_category_check
      CHECK (parent_category IS NULL OR parent_category IN ('seguimiento','cobranza'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_crm_tasks_parent ON public.crm_tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_category ON public.crm_tasks(parent_category);

UPDATE public.crm_tasks SET parent_category = 'seguimiento' WHERE task_type = 'follow_up' AND parent_category IS NULL;
UPDATE public.crm_tasks SET parent_category = 'cobranza'    WHERE task_type = 'cobranza'  AND parent_category IS NULL;