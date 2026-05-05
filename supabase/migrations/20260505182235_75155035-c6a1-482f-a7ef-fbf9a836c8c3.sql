
-- crm_tasks
DROP POLICY IF EXISTS "Authenticated can view crm_tasks" ON public.crm_tasks;
DROP POLICY IF EXISTS "Auth view crm_tasks by access" ON public.crm_tasks;

CREATE POLICY "Auth view crm_tasks by access"
ON public.crm_tasks
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.crm_task_collaborators c
    WHERE c.task_id = crm_tasks.id AND c.user_id = auth.uid()
  )
);

-- crm_activities
DROP POLICY IF EXISTS "Authenticated can view crm_activities" ON public.crm_activities;
DROP POLICY IF EXISTS "Auth view crm_activities by access" ON public.crm_activities;

CREATE POLICY "Auth view crm_activities by access"
ON public.crm_activities
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.crm_activity_collaborators c
    WHERE c.activity_id = crm_activities.id AND c.user_id = auth.uid()
  )
);
