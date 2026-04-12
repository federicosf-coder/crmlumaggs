
-- Access level enum
CREATE TYPE public.access_level AS ENUM ('todos', 'equipo', 'propio', 'ninguno');

-- Module enum
CREATE TYPE public.app_module AS ENUM (
  'directorio', 'crm_chevron', 'crm_phillips66', 'cotizaciones',
  'inventario', 'entregas', 'transferencias', 'facturacion',
  'productos', 'proyectos', 'capacitacion', 'reportes'
);

-- Permissions table
CREATE TABLE public.role_module_permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role public.app_role NOT NULL,
  module public.app_module NOT NULL,
  access_level public.access_level NOT NULL DEFAULT 'ninguno',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(role, module)
);

ALTER TABLE public.role_module_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view permissions"
  ON public.role_module_permissions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can manage permissions"
  ON public.role_module_permissions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_role_module_permissions_updated_at
  BEFORE UPDATE ON public.role_module_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default permissions: all roles get 'ninguno' for all modules
INSERT INTO public.role_module_permissions (role, module, access_level)
SELECT r.role, m.module, 'ninguno'::public.access_level
FROM unnest(ARRAY['admin','manager','sales','delivery','warehouse','customer_service','accounting']::public.app_role[]) AS r(role)
CROSS JOIN unnest(ARRAY['directorio','crm_chevron','crm_phillips66','cotizaciones','inventario','entregas','transferencias','facturacion','productos','proyectos','capacitacion','reportes']::public.app_module[]) AS m(module);

-- Set admin to 'todos' for everything
UPDATE public.role_module_permissions SET access_level = 'todos' WHERE role = 'admin';
