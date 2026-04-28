
CREATE TABLE IF NOT EXISTS public.crm_deal_change_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id uuid NOT NULL,
  user_id uuid,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  action text NOT NULL DEFAULT 'bulk_update',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_deal_change_logs_deal ON public.crm_deal_change_logs(deal_id);
CREATE INDEX IF NOT EXISTS idx_crm_deal_change_logs_user ON public.crm_deal_change_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_deal_change_logs_created ON public.crm_deal_change_logs(created_at DESC);

ALTER TABLE public.crm_deal_change_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_change_logs"
ON public.crm_deal_change_logs FOR SELECT
TO authenticated USING (true);

CREATE POLICY "auth_insert_change_logs"
ON public.crm_deal_change_logs FOR INSERT
TO authenticated WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "admin_update_change_logs"
ON public.crm_deal_change_logs FOR UPDATE
TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_delete_change_logs"
ON public.crm_deal_change_logs FOR DELETE
TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
