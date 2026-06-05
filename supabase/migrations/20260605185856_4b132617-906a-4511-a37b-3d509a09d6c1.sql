ALTER TABLE public.automation_actions DROP CONSTRAINT IF EXISTS automation_actions_action_type_check;
ALTER TABLE public.automation_actions ADD CONSTRAINT automation_actions_action_type_check
  CHECK (action_type = ANY (ARRAY[
    'send_email','send_whatsapp','send_whatsapp_personalizado','send_whatsapp_api_local',
    'send_notification','create_task','update_deal_stage','update_field','create_deal',
    'close_deal','create_activity_log','assign_owner','update_company_field',
    'update_deal_field','create_recompra_deal'
  ]));