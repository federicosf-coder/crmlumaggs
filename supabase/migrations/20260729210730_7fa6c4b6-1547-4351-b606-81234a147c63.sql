CREATE TABLE public.lead_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  tipo text NOT NULL DEFAULT 'facebook_lead_ads',
  descripcion text,
  source_id uuid REFERENCES public.lead_sources(id) ON DELETE SET NULL,
  automation_id uuid REFERENCES public.automations(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_integrations TO authenticated;
GRANT ALL ON public.lead_integrations TO service_role;
ALTER TABLE public.lead_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage lead integrations" ON public.lead_integrations
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE TABLE public.lead_integration_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES public.lead_integrations(id) ON DELETE CASCADE,
  page_id text NOT NULL,
  page_name text,
  page_access_token text,
  token_expira_at timestamptz,
  subscribed_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (integration_id, page_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_integration_pages TO authenticated;
GRANT ALL ON public.lead_integration_pages TO service_role;
ALTER TABLE public.lead_integration_pages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage lead integration pages" ON public.lead_integration_pages
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE TABLE public.lead_integration_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES public.lead_integrations(id) ON DELETE CASCADE,
  page_id text NOT NULL,
  form_id text NOT NULL,
  form_name text,
  field_map jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_id, form_id)
);
CREATE INDEX lead_integration_forms_route_idx ON public.lead_integration_forms (page_id, form_id) WHERE is_active;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_integration_forms TO authenticated;
GRANT ALL ON public.lead_integration_forms TO service_role;
ALTER TABLE public.lead_integration_forms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage lead integration forms" ON public.lead_integration_forms
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE TABLE public.lead_integration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid REFERENCES public.lead_integrations(id) ON DELETE SET NULL,
  page_id text,
  form_id text,
  leadgen_id text,
  payload jsonb,
  resultado text NOT NULL DEFAULT 'recibido',
  error text,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX lead_integration_events_leadgen_idx ON public.lead_integration_events (leadgen_id) WHERE leadgen_id IS NOT NULL;
GRANT SELECT ON public.lead_integration_events TO authenticated;
GRANT ALL ON public.lead_integration_events TO service_role;
ALTER TABLE public.lead_integration_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read lead integration events" ON public.lead_integration_events
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER update_lead_integrations_updated_at BEFORE UPDATE ON public.lead_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_lead_integration_pages_updated_at BEFORE UPDATE ON public.lead_integration_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_lead_integration_forms_updated_at BEFORE UPDATE ON public.lead_integration_forms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.list_lead_integration_pages()
RETURNS TABLE (
  id uuid, integration_id uuid, page_id text, page_name text,
  tiene_token boolean, token_expira_at timestamptz, subscribed_at timestamptz,
  is_active boolean, created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.integration_id, p.page_id, p.page_name,
         (p.page_access_token IS NOT NULL) AS tiene_token,
         p.token_expira_at, p.subscribed_at, p.is_active, p.created_at
  FROM public.lead_integration_pages p
  WHERE has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role)
$$;
REVOKE ALL ON FUNCTION public.list_lead_integration_pages() FROM public;
GRANT EXECUTE ON FUNCTION public.list_lead_integration_pages() TO authenticated;