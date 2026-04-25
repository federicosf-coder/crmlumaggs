-- Enums
DO $$ BEGIN
  CREATE TYPE public.template_type AS ENUM ('email', 'whatsapp');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.template_category AS ENUM (
    'seguimiento_cotizacion','recompra','expansion','prospecto',
    'cobranza','entrega','pago','credito','general'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.placeholder_scope AS ENUM ('email','whatsapp','ambos');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabla templates
CREATE TABLE IF NOT EXISTS public.templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type public.template_type NOT NULL,
  category public.template_category NOT NULL DEFAULT 'general',
  subject TEXT,
  body TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT templates_email_subject_required
    CHECK (type <> 'email' OR (subject IS NOT NULL AND length(trim(subject)) > 0))
);

CREATE INDEX IF NOT EXISTS idx_templates_type_active ON public.templates(type, is_active);
CREATE INDEX IF NOT EXISTS idx_templates_category ON public.templates(category);

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view templates"
  ON public.templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage templates"
  ON public.templates FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers manage templates"
  ON public.templates FOR ALL
  USING (public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Sales can create templates"
  ON public.templates FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'sales'::app_role) AND created_by = auth.uid());

CREATE POLICY "Sales update own templates"
  ON public.templates FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'sales'::app_role) AND created_by = auth.uid())
  WITH CHECK (public.has_role(auth.uid(), 'sales'::app_role) AND created_by = auth.uid());

CREATE TRIGGER update_templates_updated_at
  BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabla template_placeholders
CREATE TABLE IF NOT EXISTS public.template_placeholders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  source_table TEXT,
  source_field TEXT,
  example_value TEXT,
  applies_to public.placeholder_scope NOT NULL DEFAULT 'ambos',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.template_placeholders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view placeholders"
  ON public.template_placeholders FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage placeholders"
  ON public.template_placeholders FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers manage placeholders"
  ON public.template_placeholders FOR ALL
  USING (public.has_role(auth.uid(), 'manager'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER update_template_placeholders_updated_at
  BEFORE UPDATE ON public.template_placeholders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed placeholders iniciales
INSERT INTO public.template_placeholders (key, label, description, applies_to, sort_order, example_value) VALUES
  ('{nombre_cliente}', 'Nombre del cliente', 'Nombre/razón social de la empresa', 'ambos', 10, 'Transportes ABC'),
  ('{nombre_empresa}', 'Nombre de la empresa', 'Alias de nombre del cliente', 'ambos', 20, 'Transportes ABC'),
  ('{nombre_contacto}', 'Nombre del contacto', 'Nombre completo del contacto', 'ambos', 30, 'Juan Pérez'),
  ('{telefono_contacto}', 'Teléfono del contacto', 'Teléfono o WhatsApp del contacto', 'ambos', 40, '+52 55 1234 5678'),
  ('{correo_contacto}', 'Correo del contacto', 'Email del contacto', 'email', 50, 'juan@empresa.com'),
  ('{fecha}', 'Fecha actual', 'Fecha del día', 'ambos', 60, '24/04/2026'),
  ('{fecha_vencimiento}', 'Fecha de vencimiento', 'Fecha de vencimiento de cotización/factura', 'ambos', 70, '30/04/2026'),
  ('{folio_cotizacion}', 'Folio de cotización', 'Número de cotización', 'ambos', 80, 'COT-1234'),
  ('{total_cotizacion}', 'Total de cotización', 'Monto total con formato MXN', 'ambos', 90, '$45,000.00'),
  ('{producto}', 'Producto', 'Producto o categoría principal', 'ambos', 100, 'Aceite 15W40'),
  ('{categoria_producto}', 'Categoría de producto', 'Categoría del producto', 'ambos', 110, 'Lubricantes diésel'),
  ('{ejecutivo}', 'Ejecutivo de venta', 'Nombre del ejecutivo asignado', 'ambos', 120, 'María González'),
  ('{plaza}', 'Plaza', 'Plaza/ciudad asignada', 'ambos', 130, 'Monterrey'),
  ('{direccion_entrega}', 'Dirección de entrega', 'Dirección completa de entrega', 'ambos', 140, 'Av. Reforma 123, CDMX'),
  ('{estatus_documento}', 'Estatus del documento', 'Estado actual del documento', 'ambos', 150, 'Pendiente'),
  ('{saldo_pendiente}', 'Saldo pendiente', 'Saldo pendiente de cobranza', 'ambos', 160, '$12,500.00'),
  ('{liga_documento}', 'Liga al documento', 'URL al PDF o documento', 'email', 170, 'https://...')
ON CONFLICT (key) DO NOTHING;

-- Agregar template_id a crm_activities (historial)
ALTER TABLE public.crm_activities
  ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_crm_activities_template ON public.crm_activities(template_id);