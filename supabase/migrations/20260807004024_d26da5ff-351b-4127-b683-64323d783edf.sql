CREATE TABLE IF NOT EXISTS public.inv_fuentes_suministro (
  code text PRIMARY KEY,
  nombre text NOT NULL,
  lead_time_dias integer NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.inv_fuentes_suministro (code, nombre, lead_time_dias) VALUES
  ('usa', 'USA (Importación)', 25),
  ('cedis', 'CEDIS (Nacional)', 10),
  ('closa', 'CLOSA', 25),
  ('europe', 'Europa', 25)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.inv_fuentes_suministro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ifs_select_auth" ON public.inv_fuentes_suministro
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ifs_update_admin_mgr" ON public.inv_fuentes_suministro
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

GRANT SELECT ON public.inv_fuentes_suministro TO authenticated;
GRANT UPDATE ON public.inv_fuentes_suministro TO authenticated;