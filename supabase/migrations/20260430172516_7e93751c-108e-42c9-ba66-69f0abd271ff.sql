-- 1) Add completed_at column to crm_tasks
ALTER TABLE public.crm_tasks
ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;

-- 2) Backfill: for tasks already completed, use updated_at as best-known proxy
UPDATE public.crm_tasks
SET completed_at = updated_at
WHERE completed = true AND completed_at IS NULL;

-- 3) Trigger function: set completed_at when completed flips false->true; clear when reverted
CREATE OR REPLACE FUNCTION public.set_crm_task_completed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.completed = true AND NEW.completed_at IS NULL THEN
      NEW.completed_at := now();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF COALESCE(OLD.completed, false) = false AND NEW.completed = true THEN
      NEW.completed_at := now();
    ELSIF COALESCE(OLD.completed, false) = true AND NEW.completed = false THEN
      NEW.completed_at := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_crm_task_completed_at ON public.crm_tasks;
CREATE TRIGGER trg_set_crm_task_completed_at
BEFORE INSERT OR UPDATE OF completed ON public.crm_tasks
FOR EACH ROW
EXECUTE FUNCTION public.set_crm_task_completed_at();

-- 4) Index to query completed tasks by period efficiently
CREATE INDEX IF NOT EXISTS idx_crm_tasks_completed_at ON public.crm_tasks(completed_at) WHERE completed = true;