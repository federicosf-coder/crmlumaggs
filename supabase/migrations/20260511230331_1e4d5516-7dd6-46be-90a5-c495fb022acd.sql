-- CHANGE 1: subtasks/checklist for crm_tasks
CREATE TABLE IF NOT EXISTS public.crm_task_subtasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.crm_tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_task_subtasks_task ON public.crm_task_subtasks(task_id);

ALTER TABLE public.crm_task_subtasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view subtasks" ON public.crm_task_subtasks;
CREATE POLICY "Authenticated can view subtasks"
  ON public.crm_task_subtasks
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated can manage subtasks" ON public.crm_task_subtasks;
CREATE POLICY "Authenticated can manage subtasks"
  ON public.crm_task_subtasks
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- CHANGE 2: trigger to auto-create cobranza task on overdue document
CREATE OR REPLACE FUNCTION public.auto_create_cobranza_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_existing uuid;
BEGIN
  IF NEW.estado_cobranza = 'vencida'::public.estado_cobranza_doc
     AND (OLD.estado_cobranza IS NULL OR OLD.estado_cobranza <> 'vencida'::public.estado_cobranza_doc) THEN

    SELECT user_id INTO v_owner
    FROM public.company_ejecutivos
    WHERE company_id = NEW.empresa_id
    LIMIT 1;

    IF v_owner IS NULL THEN
      v_owner := NEW.created_by;
    END IF;

    SELECT id INTO v_existing
    FROM public.crm_tasks
    WHERE company_id = NEW.empresa_id
      AND task_type = 'cobranza'
      AND task_status = 'planned'
      AND completed = false
    LIMIT 1;

    IF v_existing IS NULL AND v_owner IS NOT NULL THEN
      INSERT INTO public.crm_tasks (
        user_id, title, description, due_date,
        priority, company_id, task_type, task_status, recurrence
      ) VALUES (
        v_owner,
        'Cobranza · ' || COALESCE((SELECT name FROM public.companies WHERE id = NEW.empresa_id), 'Cliente'),
        'Documento vencido. Saldo pendiente: $' || COALESCE(NEW.saldo_pendiente_cobranza::text, '0'),
        now() + interval '1 day',
        'high',
        NEW.empresa_id,
        'cobranza',
        'planned',
        'none'
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_cobranza_task ON public.documentos;
CREATE TRIGGER trg_auto_cobranza_task
AFTER UPDATE OF estado_cobranza ON public.documentos
FOR EACH ROW EXECUTE FUNCTION public.auto_create_cobranza_task();