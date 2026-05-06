DROP POLICY IF EXISTS "Authenticated can view crm_task_collaborators" ON public.crm_task_collaborators;
CREATE POLICY "Authenticated can view crm_task_collaborators" ON public.crm_task_collaborators FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated can manage crm_task_collaborators" ON public.crm_task_collaborators;
CREATE POLICY "Authenticated can manage crm_task_collaborators" ON public.crm_task_collaborators FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'sales'::app_role) OR has_role(auth.uid(),'customer_service'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'sales'::app_role) OR has_role(auth.uid(),'customer_service'::app_role));

DROP POLICY IF EXISTS "Authenticated can view crm_activity_collaborators" ON public.crm_activity_collaborators;
CREATE POLICY "Authenticated can view crm_activity_collaborators" ON public.crm_activity_collaborators FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated can manage crm_activity_collaborators" ON public.crm_activity_collaborators;
CREATE POLICY "Authenticated can manage crm_activity_collaborators" ON public.crm_activity_collaborators FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'sales'::app_role) OR has_role(auth.uid(),'customer_service'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'sales'::app_role) OR has_role(auth.uid(),'customer_service'::app_role));

DROP POLICY IF EXISTS "Users can view crm_tasks" ON public.crm_tasks;
DROP POLICY IF EXISTS "Admins can manage crm_tasks" ON public.crm_tasks;
DROP POLICY IF EXISTS "Managers can manage crm_tasks" ON public.crm_tasks;
DROP POLICY IF EXISTS "Sales can manage crm_tasks" ON public.crm_tasks;
DROP POLICY IF EXISTS "CS can manage crm_tasks" ON public.crm_tasks;
CREATE POLICY "Users can view crm_tasks" ON public.crm_tasks FOR SELECT TO authenticated USING (user_id=auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR EXISTS (SELECT 1 FROM public.crm_task_collaborators WHERE task_id=crm_tasks.id AND user_id=auth.uid()));
CREATE POLICY "Admins can manage crm_tasks" ON public.crm_tasks FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Managers can manage crm_tasks" ON public.crm_tasks FOR ALL TO authenticated USING (has_role(auth.uid(),'manager'::app_role)) WITH CHECK (has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "Sales can manage crm_tasks" ON public.crm_tasks FOR ALL TO authenticated USING (has_role(auth.uid(),'sales'::app_role)) WITH CHECK (has_role(auth.uid(),'sales'::app_role));
CREATE POLICY "CS can manage crm_tasks" ON public.crm_tasks FOR ALL TO authenticated USING (has_role(auth.uid(),'customer_service'::app_role)) WITH CHECK (has_role(auth.uid(),'customer_service'::app_role));

DROP POLICY IF EXISTS "Users can view crm_activities" ON public.crm_activities;
DROP POLICY IF EXISTS "Admins can manage crm_activities" ON public.crm_activities;
DROP POLICY IF EXISTS "Managers can manage crm_activities" ON public.crm_activities;
DROP POLICY IF EXISTS "Sales can manage crm_activities" ON public.crm_activities;
DROP POLICY IF EXISTS "CS can manage crm_activities" ON public.crm_activities;
CREATE POLICY "Users can view crm_activities" ON public.crm_activities FOR SELECT TO authenticated USING (user_id=auth.uid() OR has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR EXISTS (SELECT 1 FROM public.crm_activity_collaborators WHERE activity_id=crm_activities.id AND user_id=auth.uid()));
CREATE POLICY "Admins can manage crm_activities" ON public.crm_activities FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Managers can manage crm_activities" ON public.crm_activities FOR ALL TO authenticated USING (has_role(auth.uid(),'manager'::app_role)) WITH CHECK (has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "Sales can manage crm_activities" ON public.crm_activities FOR ALL TO authenticated USING (has_role(auth.uid(),'sales'::app_role)) WITH CHECK (has_role(auth.uid(),'sales'::app_role));
CREATE POLICY "CS can manage crm_activities" ON public.crm_activities FOR ALL TO authenticated USING (has_role(auth.uid(),'customer_service'::app_role)) WITH CHECK (has_role(auth.uid(),'customer_service'::app_role));