
-- CRM Pipelines
CREATE TABLE public.crm_pipelines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  marca TEXT NOT NULL CHECK (marca IN ('chevron', 'phillips66')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_pipelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view crm_pipelines" ON public.crm_pipelines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage crm_pipelines" ON public.crm_pipelines FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers can manage crm_pipelines" ON public.crm_pipelines FOR ALL USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Sales can manage crm_pipelines" ON public.crm_pipelines FOR ALL USING (has_role(auth.uid(), 'sales'::app_role));

-- CRM Pipeline Stages
CREATE TABLE public.crm_pipeline_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_id UUID NOT NULL REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6b7280',
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_pipeline_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view crm_pipeline_stages" ON public.crm_pipeline_stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage crm_pipeline_stages" ON public.crm_pipeline_stages FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers can manage crm_pipeline_stages" ON public.crm_pipeline_stages FOR ALL USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Sales can manage crm_pipeline_stages" ON public.crm_pipeline_stages FOR ALL USING (has_role(auth.uid(), 'sales'::app_role));

-- CRM Deals (Negocios)
CREATE TABLE public.crm_deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  pipeline_id UUID NOT NULL REFERENCES public.crm_pipelines(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES public.crm_pipeline_stages(id),
  company_id UUID REFERENCES public.companies(id),
  contact_id UUID REFERENCES public.contacts(id),
  owner_id UUID,
  value NUMERIC NOT NULL DEFAULT 0,
  probability INTEGER NOT NULL DEFAULT 50,
  close_date DATE,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view crm_deals" ON public.crm_deals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage crm_deals" ON public.crm_deals FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers can manage crm_deals" ON public.crm_deals FOR ALL USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Sales can manage crm_deals" ON public.crm_deals FOR ALL USING (has_role(auth.uid(), 'sales'::app_role));
CREATE POLICY "CS can manage crm_deals" ON public.crm_deals FOR ALL USING (has_role(auth.uid(), 'customer_service'::app_role));

-- CRM Activities
CREATE TABLE public.crm_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID REFERENCES public.crm_deals(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('call', 'email', 'meeting', 'note')),
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view crm_activities" ON public.crm_activities FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage crm_activities" ON public.crm_activities FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers can manage crm_activities" ON public.crm_activities FOR ALL USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Sales can manage crm_activities" ON public.crm_activities FOR ALL USING (has_role(auth.uid(), 'sales'::app_role));
CREATE POLICY "Users can manage own crm_activities" ON public.crm_activities FOR ALL USING (auth.uid() = user_id);

-- CRM Tasks
CREATE TABLE public.crm_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMPTZ,
  completed BOOLEAN NOT NULL DEFAULT false,
  deal_id UUID REFERENCES public.crm_deals(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view crm_tasks" ON public.crm_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage crm_tasks" ON public.crm_tasks FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers can manage crm_tasks" ON public.crm_tasks FOR ALL USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Sales can manage crm_tasks" ON public.crm_tasks FOR ALL USING (has_role(auth.uid(), 'sales'::app_role));
CREATE POLICY "Users can manage own crm_tasks" ON public.crm_tasks FOR ALL USING (auth.uid() = user_id);

-- Updated_at triggers
CREATE TRIGGER update_crm_pipelines_updated_at BEFORE UPDATE ON public.crm_pipelines
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_deals_updated_at BEFORE UPDATE ON public.crm_deals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_tasks_updated_at BEFORE UPDATE ON public.crm_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for deals
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_deals;

-- Seed default pipeline function
CREATE OR REPLACE FUNCTION public.seed_crm_pipeline(p_marca TEXT, p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pipeline_id UUID;
BEGIN
  INSERT INTO public.crm_pipelines (nombre, marca, created_by)
  VALUES (
    CASE WHEN p_marca = 'chevron' THEN 'Pipeline Chevron' ELSE 'Pipeline Phillips 66' END,
    p_marca,
    p_user_id
  )
  RETURNING id INTO v_pipeline_id;

  INSERT INTO public.crm_pipeline_stages (pipeline_id, name, color, position) VALUES
    (v_pipeline_id, 'Prospecto', '#6b7280', 0),
    (v_pipeline_id, 'Calificado', '#3b82f6', 1),
    (v_pipeline_id, 'Propuesta', '#8b5cf6', 2),
    (v_pipeline_id, 'Negociación', '#f59e0b', 3),
    (v_pipeline_id, 'Ganado', '#10b981', 4),
    (v_pipeline_id, 'Perdido', '#ef4444', 5);

  RETURN v_pipeline_id;
END;
$$;
