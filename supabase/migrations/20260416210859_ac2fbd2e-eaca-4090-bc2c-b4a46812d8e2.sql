
-- Simple key-value system settings table
CREATE TABLE public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view system_settings"
ON public.system_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage system_settings"
ON public.system_settings FOR ALL
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers manage system_settings"
ON public.system_settings FOR ALL
USING (public.has_role(auth.uid(), 'manager'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Accounting manage system_settings"
ON public.system_settings FOR ALL
USING (public.has_role(auth.uid(), 'accounting'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'accounting'::app_role));

CREATE TRIGGER update_system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed empty default recipient lists
INSERT INTO public.system_settings (key, value, description) VALUES
  ('destinatarios_default_contado', '[]'::jsonb, 'Correos por defecto para validación de pagos de contado'),
  ('destinatarios_default_credito_directo', '[]'::jsonb, 'Correos por defecto para validación de pagos de crédito directo'),
  ('destinatarios_default_credito_cescemex', '[]'::jsonb, 'Correos por defecto para validación de pagos de crédito Cescemex')
ON CONFLICT (key) DO NOTHING;
