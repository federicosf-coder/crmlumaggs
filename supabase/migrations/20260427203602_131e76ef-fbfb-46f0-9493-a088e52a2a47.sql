-- 1) Asegurar waba_id y status en ambas cuentas
UPDATE public.whatsapp_accounts
SET waba_id = '1997415320745040',
    status  = 'connected'
WHERE business_phone_number_id IN ('1128863556971458','498690943338066');

-- 2) Migrar phone_number_id viejo de Mexicali al nuevo
UPDATE public.whatsapp_conversations
SET business_phone_number_id = '1128863556971458'
WHERE business_phone_number_id = '1049668494904065';

UPDATE public.whatsapp_messages
SET business_phone_number_id = '1128863556971458'
WHERE business_phone_number_id = '1049668494904065';

-- 3) Backfill whatsapp_account_id en conversaciones y mensajes
UPDATE public.whatsapp_conversations c
SET whatsapp_account_id = a.id
FROM public.whatsapp_accounts a
WHERE c.business_phone_number_id = a.business_phone_number_id
  AND c.whatsapp_account_id IS DISTINCT FROM a.id;

UPDATE public.whatsapp_messages m
SET whatsapp_account_id = a.id
FROM public.whatsapp_accounts a
WHERE m.business_phone_number_id = a.business_phone_number_id
  AND m.whatsapp_account_id IS DISTINCT FROM a.id;

-- 4) Función reusable para reparar futuros desfases
CREATE OR REPLACE FUNCTION public.repair_whatsapp_account_links()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_conv int;
  v_msg int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can repair whatsapp account links';
  END IF;

  UPDATE public.whatsapp_conversations c
  SET whatsapp_account_id = a.id
  FROM public.whatsapp_accounts a
  WHERE c.business_phone_number_id = a.business_phone_number_id
    AND c.whatsapp_account_id IS DISTINCT FROM a.id;
  GET DIAGNOSTICS v_conv = ROW_COUNT;

  UPDATE public.whatsapp_messages m
  SET whatsapp_account_id = a.id
  FROM public.whatsapp_accounts a
  WHERE m.business_phone_number_id = a.business_phone_number_id
    AND m.whatsapp_account_id IS DISTINCT FROM a.id;
  GET DIAGNOSTICS v_msg = ROW_COUNT;

  RETURN jsonb_build_object('conversations_updated', v_conv, 'messages_updated', v_msg);
END;
$$;