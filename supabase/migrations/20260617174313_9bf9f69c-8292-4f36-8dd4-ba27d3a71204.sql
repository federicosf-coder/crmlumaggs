
-- 1) Tabla de responsables
CREATE TABLE IF NOT EXISTS public.credit_request_responsables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_request_id uuid NOT NULL REFERENCES public.credit_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  assigned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (credit_request_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_crr_request ON public.credit_request_responsables(credit_request_id);
CREATE INDEX IF NOT EXISTS idx_crr_user ON public.credit_request_responsables(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.credit_request_responsables TO authenticated;
GRANT ALL ON public.credit_request_responsables TO service_role;

ALTER TABLE public.credit_request_responsables ENABLE ROW LEVEL SECURITY;

-- 2) Función helper SECURITY DEFINER para evitar recursión en RLS
CREATE OR REPLACE FUNCTION public.is_credit_request_responsable(_req_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.credit_request_responsables
    WHERE credit_request_id = _req_id AND user_id = _user_id
  )
$$;

-- 3) Políticas para credit_request_responsables
DROP POLICY IF EXISTS "crr admin manager all" ON public.credit_request_responsables;
CREATE POLICY "crr admin manager all" ON public.credit_request_responsables
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));

DROP POLICY IF EXISTS "crr cs accounting select" ON public.credit_request_responsables;
CREATE POLICY "crr cs accounting select" ON public.credit_request_responsables
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'customer_service'::app_role) OR has_role(auth.uid(),'accounting'::app_role));

DROP POLICY IF EXISTS "crr sales select own" ON public.credit_request_responsables;
CREATE POLICY "crr sales select own" ON public.credit_request_responsables
  FOR SELECT TO authenticated
  USING (public.is_credit_request_responsable(credit_request_id, auth.uid()));

-- 4) Actualizar RLS de credit_requests para considerar responsables
DROP POLICY IF EXISTS "credit_requests sales select own" ON public.credit_requests;
CREATE POLICY "credit_requests sales select own" ON public.credit_requests
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(),'sales'::app_role) AND (
      created_by = auth.uid()
      OR public.is_credit_request_responsable(id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "credit_requests sales update own" ON public.credit_requests;
CREATE POLICY "credit_requests sales update own" ON public.credit_requests
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(),'sales'::app_role) AND (
      created_by = auth.uid()
      OR public.is_credit_request_responsable(id, auth.uid())
    )
  );

-- 5) Trigger AFTER INSERT en credit_requests: heredar ejecutivos de la empresa + creador
CREATE OR REPLACE FUNCTION public.credit_request_seed_responsables()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Ejecutivos de la empresa
  IF NEW.company_id IS NOT NULL THEN
    INSERT INTO public.credit_request_responsables (credit_request_id, user_id, assigned_by)
    SELECT NEW.id, ce.user_id, NEW.created_by
    FROM public.company_ejecutivos ce
    WHERE ce.company_id = NEW.company_id AND ce.user_id IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;
  -- Creador (si existe y no estaba)
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.credit_request_responsables (credit_request_id, user_id, assigned_by)
    VALUES (NEW.id, NEW.created_by, NEW.created_by)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_credit_request_seed_responsables ON public.credit_requests;
CREATE TRIGGER trg_credit_request_seed_responsables
  AFTER INSERT ON public.credit_requests
  FOR EACH ROW EXECUTE FUNCTION public.credit_request_seed_responsables();

-- 6) Backfill para solicitudes existentes
INSERT INTO public.credit_request_responsables (credit_request_id, user_id, assigned_by)
SELECT cr.id, ce.user_id, cr.created_by
FROM public.credit_requests cr
JOIN public.company_ejecutivos ce ON ce.company_id = cr.company_id
WHERE ce.user_id IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.credit_request_responsables (credit_request_id, user_id, assigned_by)
SELECT cr.id, cr.created_by, cr.created_by
FROM public.credit_requests cr
WHERE cr.created_by IS NOT NULL
ON CONFLICT DO NOTHING;

-- 7) Asegurar Bersain Velazquez en SERVICIOS REFRIGERADOS FD
INSERT INTO public.credit_request_responsables (credit_request_id, user_id, assigned_by)
SELECT cr.id, 'af4a53e4-af1d-4033-a06b-a3494860858c'::uuid, cr.created_by
FROM public.credit_requests cr
JOIN public.companies c ON c.id = cr.company_id
WHERE c.name ILIKE '%REFRIGERADOS FD%'
ON CONFLICT DO NOTHING;
