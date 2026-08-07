CREATE TABLE IF NOT EXISTS public.inv_solicitudes_extraordinarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_producto text NOT NULL,
  cantidad numeric NOT NULL,
  tipo text NOT NULL DEFAULT 'unica' CHECK (tipo IN ('unica','recurrente')),
  motivo text NOT NULL,
  estatus text NOT NULL DEFAULT 'pendiente' CHECK (estatus IN ('pendiente','aprobada','en_espera','rechazada')),
  activo boolean NOT NULL DEFAULT true,
  solicitado_por uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revisado_por uuid,
  revisado_at timestamptz,
  notas_revision text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_solext_codigo ON public.inv_solicitudes_extraordinarias(codigo_producto);

ALTER TABLE public.inv_solicitudes_extraordinarias ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON public.inv_solicitudes_extraordinarias TO authenticated;

CREATE POLICY "solext_select_auth" ON public.inv_solicitudes_extraordinarias
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "solext_insert_auth" ON public.inv_solicitudes_extraordinarias
  FOR INSERT TO authenticated WITH CHECK (solicitado_por = auth.uid());

CREATE POLICY "solext_update_reviewer_or_owner" ON public.inv_solicitudes_extraordinarias
  FOR UPDATE TO authenticated USING (
    has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'warehouse'::app_role)
    OR (solicitado_por = auth.uid() AND estatus = 'pendiente')
  );

CREATE TRIGGER trg_solext_updated_at
  BEFORE UPDATE ON public.inv_solicitudes_extraordinarias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();