
-- Tabla de configuración global (fila única)
CREATE TABLE public.precio_config_global (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  margen_uf1 numeric NOT NULL DEFAULT 0,
  margen_uf2 numeric NOT NULL DEFAULT 0,
  margen_uf3 numeric NOT NULL DEFAULT 0,
  margen_uf4 numeric NOT NULL DEFAULT 0,
  margen_r1 numeric NOT NULL DEFAULT 0,
  margen_r2 numeric NOT NULL DEFAULT 0,
  margen_r3 numeric NOT NULL DEFAULT 0,
  margen_r4 numeric NOT NULL DEFAULT 0,
  is_singleton boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT precio_config_global_singleton UNIQUE (is_singleton)
);

ALTER TABLE public.precio_config_global ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados pueden ver configuracion global"
  ON public.precio_config_global FOR SELECT TO authenticated USING (true);

CREATE POLICY "Solo admin actualiza configuracion global"
  ON public.precio_config_global FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Solo admin inserta configuracion global"
  ON public.precio_config_global FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_precio_config_global_updated_at
  BEFORE UPDATE ON public.precio_config_global
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.precio_config_global (margen_uf1, margen_uf2, margen_uf3, margen_uf4, margen_r1, margen_r2, margen_r3, margen_r4)
VALUES (0, 0, 0, 0, 0, 0, 0, 0);

-- Tabla de clasificaciones
CREATE TABLE public.precio_clasificaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  descripcion text,
  activo boolean NOT NULL DEFAULT true,
  margen_uf1 numeric NOT NULL DEFAULT 0,
  margen_uf2 numeric NOT NULL DEFAULT 0,
  margen_uf3 numeric NOT NULL DEFAULT 0,
  margen_uf4 numeric NOT NULL DEFAULT 0,
  margen_r1 numeric NOT NULL DEFAULT 0,
  margen_r2 numeric NOT NULL DEFAULT 0,
  margen_r3 numeric NOT NULL DEFAULT 0,
  margen_r4 numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.precio_clasificaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados pueden ver clasificaciones"
  ON public.precio_clasificaciones FOR SELECT TO authenticated USING (true);

CREATE POLICY "Solo admin inserta clasificaciones"
  ON public.precio_clasificaciones FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Solo admin actualiza clasificaciones"
  ON public.precio_clasificaciones FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Solo admin elimina clasificaciones"
  ON public.precio_clasificaciones FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_precio_clasificaciones_updated_at
  BEFORE UPDATE ON public.precio_clasificaciones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Columna en productos
ALTER TABLE public.productos
  ADD COLUMN precio_clasificacion_id uuid REFERENCES public.precio_clasificaciones(id) ON DELETE SET NULL;

CREATE INDEX idx_productos_precio_clasificacion ON public.productos(precio_clasificacion_id);
