
-- Collaborators for activities
CREATE TABLE public.crm_activity_collaborators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  activity_id UUID NOT NULL REFERENCES public.crm_activities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(activity_id, user_id)
);

ALTER TABLE public.crm_activity_collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view activity_collaborators" ON public.crm_activity_collaborators FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage activity_collaborators" ON public.crm_activity_collaborators FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers can manage activity_collaborators" ON public.crm_activity_collaborators FOR ALL USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Sales can manage activity_collaborators" ON public.crm_activity_collaborators FOR ALL USING (has_role(auth.uid(), 'sales'::app_role));
CREATE POLICY "Users can manage own activity_collaborators" ON public.crm_activity_collaborators FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Activity owners can manage collaborators" ON public.crm_activity_collaborators FOR ALL USING (
  EXISTS (SELECT 1 FROM public.crm_activities WHERE id = activity_id AND user_id = auth.uid())
);

-- Collaborators for tasks
CREATE TABLE public.crm_task_collaborators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.crm_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(task_id, user_id)
);

ALTER TABLE public.crm_task_collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view task_collaborators" ON public.crm_task_collaborators FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage task_collaborators" ON public.crm_task_collaborators FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers can manage task_collaborators" ON public.crm_task_collaborators FOR ALL USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Sales can manage task_collaborators" ON public.crm_task_collaborators FOR ALL USING (has_role(auth.uid(), 'sales'::app_role));
CREATE POLICY "Users can manage own task_collaborators" ON public.crm_task_collaborators FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Task owners can manage collaborators" ON public.crm_task_collaborators FOR ALL USING (
  EXISTS (SELECT 1 FROM public.crm_tasks WHERE id = task_id AND user_id = auth.uid())
);
