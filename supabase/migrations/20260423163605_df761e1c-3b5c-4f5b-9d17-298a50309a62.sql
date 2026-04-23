ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can view whatsapp_messages" ON public.whatsapp_messages;
CREATE POLICY "Authenticated can view whatsapp_messages"
  ON public.whatsapp_messages FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage whatsapp_messages" ON public.whatsapp_messages;
CREATE POLICY "Admins manage whatsapp_messages"
  ON public.whatsapp_messages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));