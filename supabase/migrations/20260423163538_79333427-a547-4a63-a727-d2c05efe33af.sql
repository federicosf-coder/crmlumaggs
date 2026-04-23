-- ========== 1. Extender contacts ==========
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS whatsapp_phone text;

CREATE UNIQUE INDEX IF NOT EXISTS contacts_whatsapp_phone_unique
  ON public.contacts (whatsapp_phone)
  WHERE whatsapp_phone IS NOT NULL;

-- ========== 2. Conversaciones ==========
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_phone text NOT NULL UNIQUE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  wa_profile_name text,
  assigned_to uuid,
  last_inbound_at timestamptz,
  last_outbound_at timestamptz,
  last_message_preview text,
  unread_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_conversations_contact_idx
  ON public.whatsapp_conversations(contact_id);
CREATE INDEX IF NOT EXISTS whatsapp_conversations_assigned_idx
  ON public.whatsapp_conversations(assigned_to);
CREATE INDEX IF NOT EXISTS whatsapp_conversations_last_inbound_idx
  ON public.whatsapp_conversations(last_inbound_at DESC NULLS LAST);

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view whatsapp_conversations" ON public.whatsapp_conversations;
CREATE POLICY "Authenticated can view whatsapp_conversations"
  ON public.whatsapp_conversations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Authenticated can insert whatsapp_conversations" ON public.whatsapp_conversations;
CREATE POLICY "Authenticated can insert whatsapp_conversations"
  ON public.whatsapp_conversations FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Authenticated can update whatsapp_conversations" ON public.whatsapp_conversations;
CREATE POLICY "Authenticated can update whatsapp_conversations"
  ON public.whatsapp_conversations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Admins can delete whatsapp_conversations" ON public.whatsapp_conversations;
CREATE POLICY "Admins can delete whatsapp_conversations"
  ON public.whatsapp_conversations FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS whatsapp_conversations_updated_at ON public.whatsapp_conversations;
CREATE TRIGGER whatsapp_conversations_updated_at
  BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== 3. Extender whatsapp_messages ==========
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS template_name text,
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS media_type text,
  ADD COLUMN IF NOT EXISTS wa_profile_name text,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS created_by uuid;

CREATE INDEX IF NOT EXISTS whatsapp_messages_conversation_idx
  ON public.whatsapp_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS whatsapp_messages_contact_idx
  ON public.whatsapp_messages(contact_id);

-- ========== 4. Templates ==========
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_template_id text,
  name text NOT NULL,
  language text NOT NULL DEFAULT 'es_MX',
  category text,
  status text NOT NULL DEFAULT 'PENDING',
  body text,
  components jsonb,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, language)
);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view whatsapp_templates" ON public.whatsapp_templates;
CREATE POLICY "Authenticated can view whatsapp_templates"
  ON public.whatsapp_templates FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage whatsapp_templates" ON public.whatsapp_templates;
CREATE POLICY "Admins manage whatsapp_templates"
  ON public.whatsapp_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

DROP TRIGGER IF EXISTS whatsapp_templates_updated_at ON public.whatsapp_templates;
CREATE TRIGGER whatsapp_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== 5. Campañas ==========
CREATE TABLE IF NOT EXISTS public.whatsapp_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  template_id uuid REFERENCES public.whatsapp_templates(id) ON DELETE RESTRICT,
  template_name text NOT NULL,
  template_language text NOT NULL DEFAULT 'es_MX',
  template_variables jsonb,
  status text NOT NULL DEFAULT 'draft',
  total_recipients int NOT NULL DEFAULT 0,
  sent_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  skipped_count int NOT NULL DEFAULT 0,
  created_by uuid,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view whatsapp_campaigns" ON public.whatsapp_campaigns;
CREATE POLICY "Authenticated can view whatsapp_campaigns"
  ON public.whatsapp_campaigns FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage whatsapp_campaigns" ON public.whatsapp_campaigns;
CREATE POLICY "Admins manage whatsapp_campaigns"
  ON public.whatsapp_campaigns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

DROP TRIGGER IF EXISTS whatsapp_campaigns_updated_at ON public.whatsapp_campaigns;
CREATE TRIGGER whatsapp_campaigns_updated_at
  BEFORE UPDATE ON public.whatsapp_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== 6. Destinatarios de campaña ==========
CREATE TABLE IF NOT EXISTS public.whatsapp_campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.whatsapp_campaigns(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  wa_phone text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  wa_message_id text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_campaign_recipients_campaign_idx
  ON public.whatsapp_campaign_recipients(campaign_id, status);

ALTER TABLE public.whatsapp_campaign_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view whatsapp_campaign_recipients" ON public.whatsapp_campaign_recipients;
CREATE POLICY "Authenticated can view whatsapp_campaign_recipients"
  ON public.whatsapp_campaign_recipients FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage whatsapp_campaign_recipients" ON public.whatsapp_campaign_recipients;
CREATE POLICY "Admins manage whatsapp_campaign_recipients"
  ON public.whatsapp_campaign_recipients FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

-- ========== 7. Respuestas rápidas ==========
CREATE TABLE IF NOT EXISTS public.whatsapp_quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shortcut text NOT NULL,
  content text NOT NULL,
  is_global boolean NOT NULL DEFAULT false,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_quick_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view whatsapp_quick_replies" ON public.whatsapp_quick_replies;
CREATE POLICY "Authenticated can view whatsapp_quick_replies"
  ON public.whatsapp_quick_replies FOR SELECT TO authenticated
  USING (is_global = true OR user_id = auth.uid());
DROP POLICY IF EXISTS "Users manage own quick_replies" ON public.whatsapp_quick_replies;
CREATE POLICY "Users manage own quick_replies"
  ON public.whatsapp_quick_replies FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Admins manage global quick_replies" ON public.whatsapp_quick_replies;
CREATE POLICY "Admins manage global quick_replies"
  ON public.whatsapp_quick_replies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

DROP TRIGGER IF EXISTS whatsapp_quick_replies_updated_at ON public.whatsapp_quick_replies;
CREATE TRIGGER whatsapp_quick_replies_updated_at
  BEFORE UPDATE ON public.whatsapp_quick_replies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== 8. Reglas de bot por keyword ==========
CREATE TABLE IF NOT EXISTS public.whatsapp_keyword_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL,
  match_type text NOT NULL DEFAULT 'contains',
  reply_text text,
  reply_template_name text,
  reply_template_language text DEFAULT 'es_MX',
  is_active boolean NOT NULL DEFAULT true,
  priority int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_keyword_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view whatsapp_keyword_rules" ON public.whatsapp_keyword_rules;
CREATE POLICY "Authenticated can view whatsapp_keyword_rules"
  ON public.whatsapp_keyword_rules FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage whatsapp_keyword_rules" ON public.whatsapp_keyword_rules;
CREATE POLICY "Admins manage whatsapp_keyword_rules"
  ON public.whatsapp_keyword_rules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

DROP TRIGGER IF EXISTS whatsapp_keyword_rules_updated_at ON public.whatsapp_keyword_rules;
CREATE TRIGGER whatsapp_keyword_rules_updated_at
  BEFORE UPDATE ON public.whatsapp_keyword_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== 9. Settings globales ==========
CREATE TABLE IF NOT EXISTS public.whatsapp_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  business_hours jsonb NOT NULL DEFAULT '{
    "timezone": "America/Mexico_City",
    "monday":    {"enabled": true,  "start": "09:00", "end": "18:00"},
    "tuesday":   {"enabled": true,  "start": "09:00", "end": "18:00"},
    "wednesday": {"enabled": true,  "start": "09:00", "end": "18:00"},
    "thursday":  {"enabled": true,  "start": "09:00", "end": "18:00"},
    "friday":    {"enabled": true,  "start": "09:00", "end": "18:00"},
    "saturday":  {"enabled": false, "start": "09:00", "end": "14:00"},
    "sunday":    {"enabled": false, "start": "09:00", "end": "14:00"}
  }'::jsonb,
  away_template_name text,
  away_template_language text DEFAULT 'es_MX',
  bot_enabled boolean NOT NULL DEFAULT true,
  away_enabled boolean NOT NULL DEFAULT true,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.whatsapp_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.whatsapp_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view whatsapp_settings" ON public.whatsapp_settings;
CREATE POLICY "Authenticated can view whatsapp_settings"
  ON public.whatsapp_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admins manage whatsapp_settings" ON public.whatsapp_settings;
CREATE POLICY "Admins manage whatsapp_settings"
  ON public.whatsapp_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));

DROP TRIGGER IF EXISTS whatsapp_settings_updated_at ON public.whatsapp_settings;
CREATE TRIGGER whatsapp_settings_updated_at
  BEFORE UPDATE ON public.whatsapp_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== 10. Log de auto-respuestas ==========
CREATE TABLE IF NOT EXISTS public.whatsapp_auto_replies_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_phone text NOT NULL,
  reason text NOT NULL,
  template_name text,
  sent_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS whatsapp_auto_replies_log_phone_idx
  ON public.whatsapp_auto_replies_log(wa_phone, sent_at DESC);

ALTER TABLE public.whatsapp_auto_replies_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view whatsapp_auto_replies_log" ON public.whatsapp_auto_replies_log;
CREATE POLICY "Authenticated can view whatsapp_auto_replies_log"
  ON public.whatsapp_auto_replies_log FOR SELECT TO authenticated USING (true);

-- ========== 11. Realtime (idempotente) ==========
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'whatsapp_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'whatsapp_conversations'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_conversations';
  END IF;
END $$;

ALTER TABLE public.whatsapp_messages REPLICA IDENTITY FULL;
ALTER TABLE public.whatsapp_conversations REPLICA IDENTITY FULL;