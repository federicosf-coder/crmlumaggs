
-- Sede enum
DO $$ BEGIN
  CREATE TYPE public.sede_contacto AS ENUM ('mexicali','tijuana');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add sede column on contacts (nullable)
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS sede public.sede_contacto;

-- Catalog table for intereses/giros
CREATE TABLE IF NOT EXISTS public.intereses_giro (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.intereses_giro ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read intereses_giro" ON public.intereses_giro;
CREATE POLICY "Auth read intereses_giro" ON public.intereses_giro
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage intereses_giro" ON public.intereses_giro;
CREATE POLICY "Admins manage intereses_giro" ON public.intereses_giro
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

DROP TRIGGER IF EXISTS trg_intereses_giro_upd ON public.intereses_giro;
CREATE TRIGGER trg_intereses_giro_upd BEFORE UPDATE ON public.intereses_giro
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.intereses_giro (nombre) VALUES ('Galsa'),('Chevron'),('Gasolinera'),('Restaurante')
  ON CONFLICT (nombre) DO NOTHING;

-- Junction table contact <-> interes
CREATE TABLE IF NOT EXISTS public.contacto_intereses (
  contacto_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  interes_id uuid NOT NULL REFERENCES public.intereses_giro(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contacto_id, interes_id)
);

CREATE INDEX IF NOT EXISTS idx_contacto_intereses_interes ON public.contacto_intereses(interes_id);

ALTER TABLE public.contacto_intereses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth read contacto_intereses" ON public.contacto_intereses;
CREATE POLICY "Auth read contacto_intereses" ON public.contacto_intereses
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Auth manage contacto_intereses" ON public.contacto_intereses;
CREATE POLICY "Auth manage contacto_intereses" ON public.contacto_intereses
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'manager'::app_role)
    OR public.has_role(auth.uid(),'sales'::app_role)
    OR public.has_role(auth.uid(),'customer_service'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'manager'::app_role)
    OR public.has_role(auth.uid(),'sales'::app_role)
    OR public.has_role(auth.uid(),'customer_service'::app_role)
  );
