
-- Auto-completion trigger for whatsapp_campaigns
CREATE OR REPLACE FUNCTION public.whatsapp_campaign_autocomplete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign_id uuid;
  v_total int;
  v_sent int;
  v_failed int;
  v_skipped int;
  v_status text;
BEGIN
  v_campaign_id := COALESCE(NEW.campaign_id, OLD.campaign_id);
  IF v_campaign_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT total_recipients, status INTO v_total, v_status
  FROM public.whatsapp_campaigns WHERE id = v_campaign_id;

  IF v_status IN ('completed', 'paused', 'draft', 'scheduled') THEN
    RETURN NEW;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE status IN ('sent','delivered','read')),
    COUNT(*) FILTER (WHERE status = 'failed'),
    COUNT(*) FILTER (WHERE status = 'skipped')
  INTO v_sent, v_failed, v_skipped
  FROM public.whatsapp_campaign_recipients
  WHERE campaign_id = v_campaign_id;

  IF v_total > 0 AND (v_sent + v_failed + v_skipped) >= v_total THEN
    UPDATE public.whatsapp_campaigns
    SET status = 'completed',
        finished_at = COALESCE(finished_at, now()),
        sent_count = v_sent,
        failed_count = v_failed,
        skipped_count = v_skipped
    WHERE id = v_campaign_id AND status NOT IN ('completed','paused');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_whatsapp_campaign_autocomplete ON public.whatsapp_campaign_recipients;
CREATE TRIGGER trg_whatsapp_campaign_autocomplete
AFTER INSERT OR UPDATE OF status ON public.whatsapp_campaign_recipients
FOR EACH ROW EXECUTE FUNCTION public.whatsapp_campaign_autocomplete();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_campaigns;
ALTER TABLE public.whatsapp_campaigns REPLICA IDENTITY FULL;
