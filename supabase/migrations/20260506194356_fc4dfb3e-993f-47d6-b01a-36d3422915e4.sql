
-- Quitar políticas recursivas que referencian la tabla padre y causan "infinite recursion"
DROP POLICY IF EXISTS "Task owners can manage collaborators" ON public.crm_task_collaborators;
DROP POLICY IF EXISTS "Auth view task_collaborators via parent" ON public.crm_task_collaborators;
DROP POLICY IF EXISTS "Activity owners can manage collaborators" ON public.crm_activity_collaborators;
DROP POLICY IF EXISTS "Auth view activity_collaborators via parent" ON public.crm_activity_collaborators;

-- Quitar la política duplicada antigua sobre las tablas padre (la nueva "Auth view ... by access" la reemplaza)
DROP POLICY IF EXISTS "Users can view crm_tasks" ON public.crm_tasks;
DROP POLICY IF EXISTS "Users can view crm_activities" ON public.crm_activities;
