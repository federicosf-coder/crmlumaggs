-- 1) Add whatsapp_account_id columns
ALTER TABLE public.whatsapp_messages
  ADD COLUMN IF NOT EXISTS whatsapp_account_id uuid REFERENCES public.whatsapp_accounts(id) ON DELETE SET NULL;

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS whatsapp_account_id uuid REFERENCES public.whatsapp_accounts(id) ON DELETE SET NULL;

-- 2) Backfill from business_phone_number_id
UPDATE public.whatsapp_messages m
SET whatsapp_account_id = a.id
FROM public.whatsapp_accounts a
WHERE m.whatsapp_account_id IS NULL
  AND m.business_phone_number_id IS NOT NULL
  AND a.business_phone_number_id = m.business_phone_number_id;

UPDATE public.whatsapp_conversations c
SET whatsapp_account_id = a.id
FROM public.whatsapp_accounts a
WHERE c.whatsapp_account_id IS NULL
  AND c.business_phone_number_id IS NOT NULL
  AND a.business_phone_number_id = c.business_phone_number_id;

-- 3) Indexes
CREATE INDEX IF NOT EXISTS idx_wa_msg_account_id
  ON public.whatsapp_messages (whatsapp_account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wa_conv_account_id
  ON public.whatsapp_conversations (whatsapp_account_id);

-- 4) RLS: permitir a usuarios autenticados insertar mensajes (necesario para envíos desde la app)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'whatsapp_messages'
      AND policyname = 'Authenticated can insert whatsapp_messages'
  ) THEN
    CREATE POLICY "Authenticated can insert whatsapp_messages"
      ON public.whatsapp_messages
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;