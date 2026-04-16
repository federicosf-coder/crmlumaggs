
CREATE TABLE public.email_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  descripcion text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.email_group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.email_groups(id) ON DELETE CASCADE,
  user_id uuid,
  nombre text,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (group_id, email)
);

CREATE INDEX idx_email_group_members_group ON public.email_group_members(group_id);

ALTER TABLE public.email_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view email_groups" ON public.email_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage email_groups" ON public.email_groups FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers manage email_groups" ON public.email_groups FOR ALL USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Accounting manage email_groups" ON public.email_groups FOR ALL USING (has_role(auth.uid(), 'accounting'::app_role));

CREATE POLICY "Authenticated can view email_group_members" ON public.email_group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage email_group_members" ON public.email_group_members FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers manage email_group_members" ON public.email_group_members FOR ALL USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Accounting manage email_group_members" ON public.email_group_members FOR ALL USING (has_role(auth.uid(), 'accounting'::app_role));

CREATE TRIGGER update_email_groups_updated_at
BEFORE UPDATE ON public.email_groups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.email_groups (nombre, descripcion) VALUES ('Contabilidad', 'Grupo destinatario de confirmaciones de pago');
