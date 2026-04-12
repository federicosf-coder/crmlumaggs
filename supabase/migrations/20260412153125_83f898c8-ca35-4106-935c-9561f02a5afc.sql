
-- Enum for option types
CREATE TYPE public.product_option_type AS ENUM (
  'marca', 'aplicacion', 'uso', 'formula', 'viscosidad', 'categoria', 'linea'
);

-- Presentaciones table
CREATE TABLE public.presentaciones (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre text NOT NULL,
  unidades_equivalentes numeric NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.presentaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view presentaciones" ON public.presentaciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage presentaciones" ON public.presentaciones FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers can manage presentaciones" ON public.presentaciones FOR ALL USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Warehouse can manage presentaciones" ON public.presentaciones FOR ALL USING (has_role(auth.uid(), 'warehouse'::app_role));

CREATE TRIGGER update_presentaciones_updated_at BEFORE UPDATE ON public.presentaciones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Product option values table
CREATE TABLE public.product_option_values (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  option_type product_option_type NOT NULL,
  value text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(option_type, value)
);
ALTER TABLE public.product_option_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view options" ON public.product_option_values FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage options" ON public.product_option_values FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers can manage options" ON public.product_option_values FOR ALL USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Warehouse can manage options" ON public.product_option_values FOR ALL USING (has_role(auth.uid(), 'warehouse'::app_role));

-- Productos table
CREATE TABLE public.productos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo text NOT NULL UNIQUE,
  nombre_producto text NOT NULL,
  descripcion text,
  presentacion_id uuid REFERENCES public.presentaciones(id),
  is_active boolean NOT NULL DEFAULT true,
  unidades_equivalentes numeric GENERATED ALWAYS AS (NULL) STORED,
  marca_id uuid REFERENCES public.product_option_values(id),
  aplicacion_id uuid REFERENCES public.product_option_values(id),
  uso_id uuid REFERENCES public.product_option_values(id),
  formula_id uuid REFERENCES public.product_option_values(id),
  viscosidad_id uuid REFERENCES public.product_option_values(id),
  categoria_id uuid REFERENCES public.product_option_values(id),
  linea_id uuid REFERENCES public.product_option_values(id),
  costo_actual numeric NOT NULL DEFAULT 0,
  precio_base_uf1 numeric NOT NULL DEFAULT 0,
  precio_uf2 numeric NOT NULL DEFAULT 0,
  precio_uf3 numeric NOT NULL DEFAULT 0,
  precio_uf4 numeric NOT NULL DEFAULT 0,
  precio_r1 numeric NOT NULL DEFAULT 0,
  precio_r2 numeric NOT NULL DEFAULT 0,
  precio_r3 numeric NOT NULL DEFAULT 0,
  precio_r4 numeric NOT NULL DEFAULT 0,
  precio_lista_galper numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view productos" ON public.productos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage productos" ON public.productos FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers can manage productos" ON public.productos FOR ALL USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Warehouse can manage productos" ON public.productos FOR ALL USING (has_role(auth.uid(), 'warehouse'::app_role));

CREATE TRIGGER update_productos_updated_at BEFORE UPDATE ON public.productos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
