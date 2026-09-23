CREATE TABLE public.plaza_responsables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plaza_id uuid NOT NULL REFERENCES public.plazas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, plaza_id)
);
GRANT SELECT ON public.plaza_responsables TO authenticated;
GRANT ALL ON public.plaza_responsables TO service_role;
ALTER TABLE public.plaza_responsables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read plaza_responsables" ON public.plaza_responsables FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage plaza_responsables" ON public.plaza_responsables FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));