
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS unread_alert_sent_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS idx_wa_conversations_unread_monitor
  ON public.whatsapp_conversations (last_inbound_at)
  WHERE unread_count > 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_schema='public' AND table_name='whatsapp_settings'
      AND constraint_name LIKE '%unassigned_strategy%'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE public.whatsapp_settings DROP CONSTRAINT ' || quote_ident(constraint_name)
      FROM information_schema.constraint_column_usage
      WHERE table_schema='public' AND table_name='whatsapp_settings'
        AND constraint_name LIKE '%unassigned_strategy%'
      LIMIT 1
    );
  END IF;
END $$;

ALTER TABLE public.whatsapp_settings
  ADD CONSTRAINT whatsapp_settings_unassigned_strategy_check
  CHECK (unassigned_strategy IN ('notify_admin','round_robin','notify_team','none'));
