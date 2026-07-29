CREATE TABLE public.lead_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  dominio_permitido text,
  api_key_hash text NOT NULL,
  api_key_prefix text NOT NULL,
  plaza_id uuid REFERENCES public.plazas(id),
  marca text,
  notificar_whatsapp text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX lead_sources_api_key_hash_idx ON public.lead_sources(api_key_hash);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_sources TO authenticated;
GRANT ALL ON public.lead_sources TO service_role;
ALTER TABLE public.lead_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage lead sources" ON public.lead_sources
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role));
CREATE TRIGGER update_lead_sources_updated_at BEFORE UPDATE ON public.lead_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.lead_sources(id) ON DELETE SET NULL,
  nombre text NOT NULL,
  telefono text,
  email text,
  empresa_nombre text,
  mensaje text,
  interes text,
  ciudad text,
  estado_region text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  page_url text,
  referrer text,
  ip text,
  user_agent text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  crm_task_id uuid REFERENCES public.crm_tasks(id) ON DELETE SET NULL,
  estatus text NOT NULL DEFAULT 'nuevo',
  responsable_id uuid,
  tomado_at timestamptz,
  primer_contacto_at timestamptz,
  descartado_motivo text,
  alerta_enviada_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX leads_estatus_idx ON public.leads(estatus);
CREATE INDEX leads_created_at_idx ON public.leads(created_at DESC);
CREATE INDEX leads_email_idx ON public.leads(lower(email));
CREATE INDEX leads_telefono_idx ON public.leads(telefono);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view leads" ON public.leads
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert leads" ON public.leads
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update leads" ON public.leads
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins can delete leads" ON public.leads
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS origen_lead text;

CREATE OR REPLACE FUNCTION public.recompute_lead_sla()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_pend int; v_alert int; v_frio int; v_rec int;
BEGIN
  UPDATE public.leads SET estatus = 'recuperacion'
  WHERE primer_contacto_at IS NULL
    AND estatus NOT IN ('atendido','descartado','recuperacion')
    AND created_at < now() - interval '72 hours';
  GET DIAGNOSTICS v_rec = ROW_COUNT;

  UPDATE public.leads SET estatus = 'frio'
  WHERE primer_contacto_at IS NULL
    AND estatus NOT IN ('atendido','descartado','recuperacion','frio')
    AND created_at < now() - interval '24 hours';
  GET DIAGNOSTICS v_frio = ROW_COUNT;

  UPDATE public.leads SET estatus = 'alerta'
  WHERE primer_contacto_at IS NULL
    AND estatus IN ('nuevo','pendiente_atencion')
    AND created_at < now() - interval '1 hour';
  GET DIAGNOSTICS v_alert = ROW_COUNT;

  UPDATE public.leads SET estatus = 'pendiente_atencion'
  WHERE primer_contacto_at IS NULL
    AND estatus = 'nuevo'
    AND created_at < now() - interval '15 minutes';
  GET DIAGNOSTICS v_pend = ROW_COUNT;

  RETURN jsonb_build_object('pendientes', v_pend, 'alertas', v_alert, 'frios', v_frio, 'recuperacion', v_rec);
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.recompute_lead_sla() TO authenticated, service_role;