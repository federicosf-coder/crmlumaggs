-- 0) Catálogo de marcas
CREATE TABLE IF NOT EXISTS public.proveedor_marcas (
  code text PRIMARY KEY,
  nombre text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proveedor_marcas TO authenticated;
GRANT ALL ON public.proveedor_marcas TO service_role;

INSERT INTO public.proveedor_marcas (code, nombre) VALUES
  ('chevron', 'Chevron'),
  ('phillips66', 'Phillips 66'),
  ('gonher', 'Gonher'),
  ('green_world', 'Green World'),
  ('pro_one', 'Pro One'),
  ('compass_blue', 'Compass Blue')
ON CONFLICT (code) DO NOTHING;

-- 1) Lotes de carga
CREATE TABLE IF NOT EXISTS public.proveedor_price_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marca text NOT NULL REFERENCES public.proveedor_marcas(code),
  tipo_lista text NOT NULL CHECK (tipo_lista IN ('general','especial','contable')),
  fecha_vigencia date,
  nombre_archivo text,
  subido_por uuid,
  total_filas_procesadas integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proveedor_price_uploads TO authenticated;
GRANT ALL ON public.proveedor_price_uploads TO service_role;

-- 2) Tabla maestra viva
CREATE TABLE IF NOT EXISTS public.proveedor_price_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marca text NOT NULL REFERENCES public.proveedor_marcas(code),
  codigo_proveedor text NOT NULL,
  producto_nombre text NOT NULL,
  empaque text,
  clasificacion_proveedor text,
  aplicacion text,
  uom_por_pkg numeric,

  costo_lista_general numeric,
  fecha_lista_general date,
  upload_id_general uuid REFERENCES public.proveedor_price_uploads(id),

  costo_lista_especial numeric,
  fecha_lista_especial date,
  upload_id_especial uuid REFERENCES public.proveedor_price_uploads(id),

  costo_contable numeric,
  fecha_costo_contable date,
  upload_id_contable uuid REFERENCES public.proveedor_price_uploads(id),
  precio_venta_contado_ref numeric,
  precio_venta_credito_ref numeric,
  margen_aplicado_ref numeric,

  vinculado_producto_id uuid REFERENCES public.productos(id),
  precio_clasificacion_id uuid REFERENCES public.precio_clasificaciones(id),

  activo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (marca, codigo_proveedor)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proveedor_price_items TO authenticated;
GRANT ALL ON public.proveedor_price_items TO service_role;

CREATE INDEX IF NOT EXISTS idx_ppi_marca ON public.proveedor_price_items(marca);
CREATE INDEX IF NOT EXISTS idx_ppi_vinculado ON public.proveedor_price_items(vinculado_producto_id);

CREATE TRIGGER trg_ppi_updated_at
  BEFORE UPDATE ON public.proveedor_price_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Lista de acceso explícita
CREATE TABLE IF NOT EXISTS public.proveedor_price_access (
  user_id uuid PRIMARY KEY,
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proveedor_price_access TO authenticated;
GRANT ALL ON public.proveedor_price_access TO service_role;

INSERT INTO public.proveedor_price_access (user_id, granted_by)
VALUES ('7de230e0-2c9f-4af8-98ee-32af6147dd25', '7de230e0-2c9f-4af8-98ee-32af6147dd25')
ON CONFLICT (user_id) DO NOTHING;

-- 4) Función de acceso + RLS
CREATE OR REPLACE FUNCTION public.has_proveedor_price_access(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.proveedor_price_access WHERE user_id = _user_id);
$$;

ALTER TABLE public.proveedor_marcas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proveedor_price_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proveedor_price_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proveedor_price_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acceso restringido - marcas" ON public.proveedor_marcas
  FOR ALL TO authenticated USING (public.has_proveedor_price_access(auth.uid()))
  WITH CHECK (public.has_proveedor_price_access(auth.uid()));

CREATE POLICY "Acceso restringido - items" ON public.proveedor_price_items
  FOR ALL TO authenticated USING (public.has_proveedor_price_access(auth.uid()))
  WITH CHECK (public.has_proveedor_price_access(auth.uid()));

CREATE POLICY "Acceso restringido - uploads" ON public.proveedor_price_uploads
  FOR ALL TO authenticated USING (public.has_proveedor_price_access(auth.uid()))
  WITH CHECK (public.has_proveedor_price_access(auth.uid()));

CREATE POLICY "Acceso restringido - access" ON public.proveedor_price_access
  FOR ALL TO authenticated USING (public.has_proveedor_price_access(auth.uid()))
  WITH CHECK (public.has_proveedor_price_access(auth.uid()));