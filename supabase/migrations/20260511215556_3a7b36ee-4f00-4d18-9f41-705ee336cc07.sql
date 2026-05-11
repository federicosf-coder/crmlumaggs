ALTER TABLE public.crm_tasks
  ADD COLUMN IF NOT EXISTS task_status text NOT NULL DEFAULT 'planned',
  ADD COLUMN IF NOT EXISTS reschedule_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reschedule_reason text;

ALTER TABLE public.crm_tasks
  DROP CONSTRAINT IF EXISTS crm_tasks_task_status_check;
ALTER TABLE public.crm_tasks
  ADD CONSTRAINT crm_tasks_task_status_check
  CHECK (task_status IN ('planned','done','cancelled','rescheduled'));

CREATE INDEX IF NOT EXISTS idx_crm_tasks_task_type ON public.crm_tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_task_status ON public.crm_tasks(task_status);

UPDATE public.crm_tasks SET task_status = 'done' WHERE completed = true AND task_status = 'planned';