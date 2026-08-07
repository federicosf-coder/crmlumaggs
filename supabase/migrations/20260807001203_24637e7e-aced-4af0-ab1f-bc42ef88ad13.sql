CREATE TABLE IF NOT EXISTS public.inv_pedido_requerido_ignorados (
  codigo_producto text PRIMARY KEY,
  motivo text,
  ignorado_por uuid,
  ignorado_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inv_pedido_requerido_ignorados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ipri_select_auth" ON public.inv_pedido_requerido_ignorados
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ipri_insert_admin_mgr" ON public.inv_pedido_requerido_ignorados
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'warehouse'::app_role));

CREATE POLICY "ipri_delete_admin_mgr" ON public.inv_pedido_requerido_ignorados
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'warehouse'::app_role));