CREATE TABLE IF NOT EXISTS public.inv_costos_producto_ignorados (
  codigo_producto text PRIMARY KEY,
  empresa text,
  motivo text,
  ignorado_por uuid,
  ignorado_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.inv_costos_producto_ignorados TO authenticated;
GRANT ALL ON public.inv_costos_producto_ignorados TO service_role;

ALTER TABLE public.inv_costos_producto_ignorados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inv_costos_ignorados_select_auth" ON public.inv_costos_producto_ignorados
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "inv_costos_ignorados_insert_admin_mgr" ON public.inv_costos_producto_ignorados
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "inv_costos_ignorados_delete_admin_mgr" ON public.inv_costos_producto_ignorados
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));