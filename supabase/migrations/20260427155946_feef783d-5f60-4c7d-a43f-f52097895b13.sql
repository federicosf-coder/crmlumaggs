CREATE TABLE IF NOT EXISTS public.whatsapp_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_phone_number_id text NOT NULL UNIQUE,
  label text NOT NULL,
  color text NOT NULL DEFAULT '#10b981',
  display_phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read whatsapp accounts"
  ON public.whatsapp_accounts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage whatsapp accounts"
  ON public.whatsapp_accounts FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_whatsapp_accounts_updated_at
  BEFORE UPDATE ON public.whatsapp_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();