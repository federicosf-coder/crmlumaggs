
-- Status enum
CREATE TYPE public.training_status AS ENUM ('pendiente','enviado','aprobado','rechazado');

-- Courses
CREATE TABLE public.training_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  descripcion text,
  url_externa text,
  plaza_id uuid REFERENCES public.plazas(id) ON DELETE SET NULL,
  obligatorio boolean NOT NULL DEFAULT false,
  icon text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.training_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can view active courses"
ON public.training_courses FOR SELECT
TO authenticated
USING (
  is_active = true
  OR public.has_role(auth.uid(),'admin'::app_role)
  OR public.has_role(auth.uid(),'manager'::app_role)
);

CREATE POLICY "Admins manage courses"
ON public.training_courses FOR ALL
TO authenticated
USING (public.has_role(auth.uid(),'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_training_courses_updated
BEFORE UPDATE ON public.training_courses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- User trainings
CREATE TABLE public.user_trainings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.training_courses(id) ON DELETE CASCADE,
  status public.training_status NOT NULL DEFAULT 'pendiente',
  fecha_realizacion date,
  evidencia_path text,
  evidencia_mime text,
  admin_comentarios text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);

ALTER TABLE public.user_trainings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own trainings; admins/managers see all"
ON public.user_trainings FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(),'admin'::app_role)
  OR public.has_role(auth.uid(),'manager'::app_role)
);

CREATE POLICY "Users create own trainings"
ON public.user_trainings FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own trainings; admins all"
ON public.user_trainings FOR UPDATE
TO authenticated
USING (
  user_id = auth.uid()
  OR public.has_role(auth.uid(),'admin'::app_role)
)
WITH CHECK (
  user_id = auth.uid()
  OR public.has_role(auth.uid(),'admin'::app_role)
);

CREATE POLICY "Admins delete trainings"
ON public.user_trainings FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER trg_user_trainings_updated
BEFORE UPDATE ON public.user_trainings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_user_trainings_user ON public.user_trainings(user_id);
CREATE INDEX idx_user_trainings_course ON public.user_trainings(course_id);
CREATE INDEX idx_user_trainings_status ON public.user_trainings(status);

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('training-evidence','training-evidence', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload own evidence"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'training-evidence'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users read own evidence; admins/managers all"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'training-evidence'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'manager'::app_role)
  )
);

CREATE POLICY "Users update own evidence"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'training-evidence'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users delete own; admins all"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'training-evidence'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(),'admin'::app_role)
  )
);
