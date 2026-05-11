ALTER TABLE public.crm_tasks
  ADD COLUMN IF NOT EXISTS task_type text NOT NULL DEFAULT 'call',
  ADD COLUMN IF NOT EXISTS recurrence text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS origen_tarea_id uuid NULL REFERENCES public.crm_tasks(id) ON DELETE SET NULL;

ALTER TABLE public.crm_tasks
  DROP CONSTRAINT IF EXISTS crm_tasks_task_type_check;
ALTER TABLE public.crm_tasks
  ADD CONSTRAINT crm_tasks_task_type_check
  CHECK (task_type IN ('call','email','meeting','field_visit','whatsapp','note','cobranza','follow_up'));

ALTER TABLE public.crm_tasks
  DROP CONSTRAINT IF EXISTS crm_tasks_recurrence_check;
ALTER TABLE public.crm_tasks
  ADD CONSTRAINT crm_tasks_recurrence_check
  CHECK (recurrence IN ('none','daily','weekly','monthly'));

CREATE INDEX IF NOT EXISTS idx_crm_tasks_origen
  ON public.crm_tasks(origen_tarea_id)
  WHERE origen_tarea_id IS NOT NULL;