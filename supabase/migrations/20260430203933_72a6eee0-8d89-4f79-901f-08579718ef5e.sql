-- Add response rules and alert columns to whatsapp_settings
ALTER TABLE public.whatsapp_settings
  ADD COLUMN IF NOT EXISTS notification_delay_minutes integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS unassigned_strategy text NOT NULL DEFAULT 'notify_admin',
  ADD COLUMN IF NOT EXISTS admin_phone text,
  ADD COLUMN IF NOT EXISTS critical_escalation_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS critical_escalation_hours integer NOT NULL DEFAULT 4,
  ADD COLUMN IF NOT EXISTS supervisor_phone text,
  ADD COLUMN IF NOT EXISTS alert_template_name text,
  ADD COLUMN IF NOT EXISTS alert_template_language text DEFAULT 'es_MX';

ALTER TABLE public.whatsapp_settings
  DROP CONSTRAINT IF EXISTS whatsapp_settings_unassigned_strategy_check;
ALTER TABLE public.whatsapp_settings
  ADD CONSTRAINT whatsapp_settings_unassigned_strategy_check
  CHECK (unassigned_strategy IN ('notify_admin','round_robin','notify_team'));

ALTER TABLE public.whatsapp_settings
  DROP CONSTRAINT IF EXISTS whatsapp_settings_notification_delay_check;
ALTER TABLE public.whatsapp_settings
  ADD CONSTRAINT whatsapp_settings_notification_delay_check
  CHECK (notification_delay_minutes IN (5,15,30,60));

-- Notification queue table for pending WhatsApp alerts
CREATE TABLE IF NOT EXISTS public.whatsapp_notification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid,
  contact_phone text,
  recipient_user_id uuid,
  recipient_phone text,
  notification_type text NOT NULL DEFAULT 'no_response',
  status text NOT NULL DEFAULT 'pending',
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz,
  cancelled_at timestamptz,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_notif_queue_status_check CHECK (status IN ('pending','sent','cancelled','failed'))
);

CREATE INDEX IF NOT EXISTS idx_wa_notif_queue_pending
  ON public.whatsapp_notification_queue (scheduled_for)
  WHERE status = 'pending';

ALTER TABLE public.whatsapp_notification_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated view notif queue" ON public.whatsapp_notification_queue;
CREATE POLICY "Authenticated view notif queue"
  ON public.whatsapp_notification_queue FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage notif queue" ON public.whatsapp_notification_queue;
CREATE POLICY "Admins manage notif queue"
  ON public.whatsapp_notification_queue FOR ALL
  TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));

CREATE TRIGGER whatsapp_notification_queue_updated_at
  BEFORE UPDATE ON public.whatsapp_notification_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();