
ALTER TABLE public._stg_prod_map ENABLE ROW LEVEL SECURITY;

ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;

DROP POLICY IF EXISTS "Authenticated can view pagos" ON public.cobranza_pagos;
CREATE POLICY "Restricted view pagos"
  ON public.cobranza_pagos FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'accounting'::app_role)
    OR has_role(auth.uid(), 'sales'::app_role)
  );

DROP POLICY IF EXISTS "Authenticated can view email_group_members" ON public.email_group_members;
CREATE POLICY "Restricted view email_group_members"
  ON public.email_group_members FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'accounting'::app_role)
  );

DROP POLICY IF EXISTS "Authenticated can view repartidores" ON public.repartidores;
CREATE POLICY "Restricted view repartidores"
  ON public.repartidores FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'delivery'::app_role)
    OR has_role(auth.uid(), 'warehouse'::app_role)
    OR has_role(auth.uid(), 'customer_service'::app_role)
    OR has_role(auth.uid(), 'sales'::app_role)
  );

DROP POLICY IF EXISTS "Authenticated can view whatsapp_settings" ON public.whatsapp_settings;
CREATE POLICY "Admins/managers can view whatsapp_settings"
  ON public.whatsapp_settings FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
  );

DROP POLICY IF EXISTS "Authenticated can view whatsapp_conversations" ON public.whatsapp_conversations;
DROP POLICY IF EXISTS "Authenticated can update whatsapp_conversations" ON public.whatsapp_conversations;
CREATE POLICY "WA users view whatsapp_conversations"
  ON public.whatsapp_conversations FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'customer_service'::app_role)
    OR has_role(auth.uid(), 'sales'::app_role)
  );
CREATE POLICY "WA users update whatsapp_conversations"
  ON public.whatsapp_conversations FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'customer_service'::app_role)
    OR has_role(auth.uid(), 'sales'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'customer_service'::app_role)
    OR has_role(auth.uid(), 'sales'::app_role)
  );

DROP POLICY IF EXISTS "Authenticated can view whatsapp_messages" ON public.whatsapp_messages;
CREATE POLICY "WA users view whatsapp_messages"
  ON public.whatsapp_messages FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'customer_service'::app_role)
    OR has_role(auth.uid(), 'sales'::app_role)
  );

DROP POLICY IF EXISTS "Authenticated can delete doc files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update doc files" ON storage.objects;
CREATE POLICY "Role-scoped delete doc files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'document-files'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'sales'::app_role)
      OR has_role(auth.uid(), 'customer_service'::app_role)
    )
  );
CREATE POLICY "Role-scoped update doc files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'document-files'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'sales'::app_role)
      OR has_role(auth.uid(), 'customer_service'::app_role)
    )
  );

DROP POLICY IF EXISTS "Authenticated can delete documentos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update documentos" ON storage.objects;
CREATE POLICY "Role-scoped delete documentos bucket"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'documentos'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'sales'::app_role)
      OR has_role(auth.uid(), 'customer_service'::app_role)
    )
  );
CREATE POLICY "Role-scoped update documentos bucket"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documentos'
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'sales'::app_role)
      OR has_role(auth.uid(), 'customer_service'::app_role)
    )
  );
