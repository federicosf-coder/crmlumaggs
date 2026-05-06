ALTER TABLE public.automations DROP CONSTRAINT IF EXISTS automations_trigger_type_check;
ALTER TABLE public.automations ADD CONSTRAINT automations_trigger_type_check
CHECK (trigger_type = ANY (ARRAY[
  'existing_button_click','button_click','on_save','on_create','on_field_change',
  'on_stage_change','on_status_change','date_reached','days_before_date',
  'days_after_date','deal_stalled','month_start','month_end','month_day',
  'daily_at_time','field_value_reaches'
]));