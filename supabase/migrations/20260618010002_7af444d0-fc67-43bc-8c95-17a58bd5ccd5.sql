
-- BUCKET MANUAL: crear en Supabase Storage Dashboard: 'inventario-archivos' (privado)

-- =========================
-- TABLA 1: inv_archivos_referencia
-- =========================
CREATE TABLE IF NOT EXISTS public.inv_archivos_referencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN (
    'kardex_movimientos',
    'inventario_actual',
    'costos_galper_lumaggs',
    'precios_especiales_lumaggs',
    'lista_general_lumaggs',
    'costos_galper_galsa',
    'lista_general_galsa',
    'costos_galper_gonher',
    'lista_general_gonher',
    'otro'
  )),
  empresa TEXT CHECK (empresa IN ('lumaggs', 'galsa', 'ambas')),
  nombre_archivo TEXT NOT NULL,
  descripcion TEXT,
  fecha_vigencia_inicio DATE,
  fecha_vigencia_fin DATE,
  es_activo BOOLEAN DEFAULT true,
  total_registros INTEGER DEFAULT 0,
  registros_procesados INTEGER DEFAULT 0,
  registros_con_error INTEGER DEFAULT 0,
  estatus TEXT DEFAULT 'pendiente' CHECK (estatus IN ('pendiente','procesando','completado','error')),
  storage_path TEXT,
  notas TEXT,
  subido_por uuid REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inv_archivos_referencia TO authenticated;
GRANT ALL ON public.inv_archivos_referencia TO service_role;

ALTER TABLE public.inv_archivos_referencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inv_archivos_referencia_select_auth"
  ON public.inv_archivos_referencia FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "inv_archivos_referencia_insert_admin_mgr"
  ON public.inv_archivos_referencia FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "inv_archivos_referencia_update_admin_mgr"
  ON public.inv_archivos_referencia FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "inv_archivos_referencia_delete_admin_mgr"
  ON public.inv_archivos_referencia FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER trg_inv_archivos_referencia_updated_at
  BEFORE UPDATE ON public.inv_archivos_referencia
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- TABLA 2: inv_costos_producto
-- =========================
CREATE TABLE IF NOT EXISTS public.inv_costos_producto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_producto TEXT NOT NULL,
  empresa TEXT NOT NULL CHECK (empresa IN ('lumaggs', 'galsa')),

  costo_galper NUMERIC,
  costo_galper_fecha DATE,
  costo_especial NUMERIC,
  costo_especial_fecha DATE,
  costo_lista NUMERIC,
  costo_lista_fecha DATE,

  costo_efectivo NUMERIC,
  costo_efectivo_fuente TEXT CHECK (costo_efectivo_fuente IN ('galper','especial','max_galper_especial','lista','manual')),

  costo_manual NUMERIC,
  costo_manual_notas TEXT,

  costo_anterior NUMERIC,
  variacion_absoluta NUMERIC,
  variacion_porcentual NUMERIC,

  precio_propuesto_uf1 NUMERIC,
  precio_propuesto_uf2 NUMERIC,
  precio_propuesto_uf3 NUMERIC,
  precio_propuesto_uf4 NUMERIC,
  precio_propuesto_r1 NUMERIC,
  precio_propuesto_r2 NUMERIC,
  precio_propuesto_r3 NUMERIC,
  precio_propuesto_r4 NUMERIC,
  precio_propuesto_galper NUMERIC,

  nivel_alerta TEXT DEFAULT 'normal' CHECK (nivel_alerta IN ('bloqueo','alerta','aviso','normal')),
  razones_alerta TEXT[],

  estado TEXT DEFAULT 'pendiente' CHECK (estado IN ('pendiente','autorizado','rechazado','aplicado')),
  autorizado_por uuid REFERENCES auth.users(id),
  autorizado_at TIMESTAMPTZ,
  notas_autorizacion TEXT,

  lote_id uuid,
  archivo_galper_id uuid REFERENCES public.inv_archivos_referencia(id),
  archivo_especial_id uuid REFERENCES public.inv_archivos_referencia(id),
  archivo_lista_id uuid REFERENCES public.inv_archivos_referencia(id),
  nombre_en_archivo TEXT,
  nombre_en_catalogo TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(codigo_producto, empresa, lote_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inv_costos_producto TO authenticated;
GRANT ALL ON public.inv_costos_producto TO service_role;

ALTER TABLE public.inv_costos_producto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inv_costos_producto_select_auth"
  ON public.inv_costos_producto FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "inv_costos_producto_insert_admin_mgr"
  ON public.inv_costos_producto FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "inv_costos_producto_update_admin_mgr"
  ON public.inv_costos_producto FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "inv_costos_producto_delete_admin_mgr"
  ON public.inv_costos_producto FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER trg_inv_costos_producto_updated_at
  BEFORE UPDATE ON public.inv_costos_producto
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- TABLA 3: inv_costos_historial
-- =========================
CREATE TABLE IF NOT EXISTS public.inv_costos_historial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_producto TEXT NOT NULL,
  empresa TEXT NOT NULL,
  costo_anterior NUMERIC,
  costo_nuevo NUMERIC,
  fuente TEXT,
  lote_id uuid,
  precio_uf1_anterior NUMERIC,
  precio_uf1_nuevo NUMERIC,
  aplicado_por uuid REFERENCES auth.users(id),
  aplicado_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT ON public.inv_costos_historial TO authenticated;
GRANT ALL ON public.inv_costos_historial TO service_role;

ALTER TABLE public.inv_costos_historial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inv_costos_historial_select_auth"
  ON public.inv_costos_historial FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "inv_costos_historial_insert_admin_mgr"
  ON public.inv_costos_historial FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

-- Sin políticas de UPDATE/DELETE -> tabla efectivamente inmutable

-- =========================
-- ÍNDICES
-- =========================
CREATE INDEX IF NOT EXISTS idx_inv_archivos_ref_tipo ON public.inv_archivos_referencia(tipo, es_activo);
CREATE INDEX IF NOT EXISTS idx_inv_costos_prod_codigo ON public.inv_costos_producto(codigo_producto);
CREATE INDEX IF NOT EXISTS idx_inv_costos_prod_lote ON public.inv_costos_producto(lote_id);
CREATE INDEX IF NOT EXISTS idx_inv_costos_prod_estado ON public.inv_costos_producto(estado, nivel_alerta);
CREATE INDEX IF NOT EXISTS idx_inv_costos_prod_empresa ON public.inv_costos_producto(empresa);
CREATE INDEX IF NOT EXISTS idx_inv_costos_hist_codigo ON public.inv_costos_historial(codigo_producto);

-- =========================
-- PERMISOS DEL MÓDULO
-- =========================
INSERT INTO public.role_module_permissions (role, module, access_level) VALUES
  ('admin','inventario.costos','todos'),
  ('manager','inventario.costos','todos'),
  ('accounting','inventario.costos','lectura'),
  ('warehouse','inventario.costos','ninguno'),
  ('sales','inventario.costos','ninguno')
ON CONFLICT (role, module) DO NOTHING;
