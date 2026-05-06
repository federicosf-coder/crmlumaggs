
CREATE TABLE public.automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  entity_type text NOT NULL CHECK (entity_type IN ('deal','company','document','contact','task')),
  trigger_type text NOT NULL CHECK (trigger_type IN ('button_click','on_save','on_create','on_field_change','on_stage_change','on_status_change','date_reached','days_before_date','days_after_date','deal_stalled','month_start','month_end','month_day','daily_at_time','field_value_reaches')),
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  run_count integer NOT NULL DEFAULT 0,
  last_run_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.automation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  action_type text NOT NULL CHECK (action_type IN ('send_email','send_whatsapp','send_notification','create_task','update_deal_stage','update_field','create_deal','close_deal','create_activity_log','assign_owner','update_company_field','update_deal_field','create_recompra_deal')),
  action_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  entity_id uuid,
  entity_type text,
  entity_label text,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success','failed','skipped')),
  triggered_by text NOT NULL DEFAULT 'system' CHECK (triggered_by IN ('system','user','cron')),
  error_message text,
  actions_executed integer NOT NULL DEFAULT 0,
  run_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_automation_actions_automation_id ON public.automation_actions(automation_id, position);
CREATE INDEX idx_automation_runs_automation_id ON public.automation_runs(automation_id, run_at DESC);

ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

-- automations policies
CREATE POLICY "automations_select_authenticated" ON public.automations
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "automations_all_admin_manager" ON public.automations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

-- automation_actions policies
CREATE POLICY "automation_actions_select_authenticated" ON public.automation_actions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "automation_actions_all_admin_manager" ON public.automation_actions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

-- automation_runs policies
CREATE POLICY "automation_runs_select_authenticated" ON public.automation_runs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "automation_runs_all_admin_manager" ON public.automation_runs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER update_automations_updated_at
  BEFORE UPDATE ON public.automations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
