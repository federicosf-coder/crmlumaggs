ALTER TABLE public.whatsapp_campaigns
  ADD COLUMN IF NOT EXISTS header_document_url text,
  ADD COLUMN IF NOT EXISTS header_document_filename text;

CREATE TABLE IF NOT EXISTS public.whatsapp_numeros_bloqueados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_phone text NOT NULL UNIQUE,
  motivo text NOT NULL DEFAULT 'no_existe',
  detalle text,
  error_code integer,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  activo boolean NOT NULL DEFAULT true,
  detectado_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_numeros_bloqueados TO authenticated;
GRANT ALL ON public.whatsapp_numeros_bloqueados TO service_role;

ALTER TABLE public.whatsapp_numeros_bloqueados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados pueden ver numeros bloqueados"
  ON public.whatsapp_numeros_bloqueados FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin/manager pueden agregar numeros bloqueados"
  ON public.whatsapp_numeros_bloqueados FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/manager pueden editar numeros bloqueados"
  ON public.whatsapp_numeros_bloqueados FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Admin/manager pueden borrar numeros bloqueados"
  ON public.whatsapp_numeros_bloqueados FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER update_whatsapp_numeros_bloqueados_updated_at
  BEFORE UPDATE ON public.whatsapp_numeros_bloqueados
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_wa_bloqueados_activo ON public.whatsapp_numeros_bloqueados (wa_phone) WHERE activo;