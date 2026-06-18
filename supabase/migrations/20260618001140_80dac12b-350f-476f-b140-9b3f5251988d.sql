
-- ============================================================
-- TABLA 1: inv_demanda_plaza
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inv_demanda_plaza (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_producto TEXT NOT NULL,
  almacen TEXT NOT NULL CHECK (almacen IN ('1001','1002','1003','1004')),
  periodo_inicio DATE NOT NULL,
  periodo_fin DATE NOT NULL,
  dias_periodo INTEGER NOT NULL,
  unidades_vendidas NUMERIC DEFAULT 0,
  unidades_traspaso_salida NUMERIC DEFAULT 0,
  demanda_diaria_promedio NUMERIC DEFAULT 0,
  demanda_mensual_promedio NUMERIC DEFAULT 0,
  coeficiente_variacion NUMERIC DEFAULT 0,
  num_meses_con_venta INTEGER DEFAULT 0,
  ultima_venta DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(codigo_producto, almacen, periodo_inicio)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inv_demanda_plaza TO authenticated;
GRANT ALL ON public.inv_demanda_plaza TO service_role;
ALTER TABLE public.inv_demanda_plaza ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demanda_select_auth" ON public.inv_demanda_plaza FOR SELECT TO authenticated USING (true);
CREATE POLICY "demanda_modify_admin_manager" ON public.inv_demanda_plaza FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE TRIGGER trg_inv_demanda_plaza_updated_at BEFORE UPDATE ON public.inv_demanda_plaza
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- TABLA 2: inv_minmax
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inv_minmax (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_producto TEXT NOT NULL,
  almacen TEXT NOT NULL CHECK (almacen IN ('1001','1002','1003','1004','hub_mxl','hub_tj')),
  clasificacion_abc TEXT CHECK (clasificacion_abc IN ('A','B','C')),
  demanda_diaria_hub NUMERIC DEFAULT 0,
  dias_cobertura_objetivo INTEGER DEFAULT 60,
  dias_stock_seguridad INTEGER DEFAULT 15,
  lead_time_dias INTEGER DEFAULT 32,
  minimo_calc NUMERIC DEFAULT 0,
  maximo_calc NUMERIC DEFAULT 0,
  cantidad_reorden_calc NUMERIC DEFAULT 0,
  minimo_manual NUMERIC,
  maximo_manual NUMERIC,
  cantidad_reorden_manual NUMERIC,
  minimo_efectivo NUMERIC GENERATED ALWAYS AS (COALESCE(minimo_manual, minimo_calc)) STORED,
  maximo_efectivo NUMERIC GENERATED ALWAYS AS (COALESCE(maximo_manual, maximo_calc)) STORED,
  cantidad_reorden_efectiva NUMERIC GENERATED ALWAYS AS (COALESCE(cantidad_reorden_manual, cantidad_reorden_calc)) STORED,
  ajustado_manualmente BOOLEAN DEFAULT false,
  notas TEXT,
  ultima_actualizacion_calc DATE,
  creado_por uuid REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(codigo_producto, almacen)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inv_minmax TO authenticated;
GRANT ALL ON public.inv_minmax TO service_role;
ALTER TABLE public.inv_minmax ENABLE ROW LEVEL SECURITY;

CREATE POLICY "minmax_select_auth" ON public.inv_minmax FOR SELECT TO authenticated USING (true);
CREATE POLICY "minmax_modify_admin_manager" ON public.inv_minmax FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE TRIGGER trg_inv_minmax_updated_at BEFORE UPDATE ON public.inv_minmax
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- TABLA 3: inv_restricciones
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inv_restricciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_producto TEXT,
  marca TEXT CHECK (marca IN ('chevron','phillips66')),
  tipo TEXT NOT NULL CHECK (tipo IN ('legal','stock_proveedor','logistica','otro')),
  descripcion TEXT NOT NULL,
  pedido_activo_id TEXT,
  fecha_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_fin DATE,
  activa BOOLEAN DEFAULT true,
  excluir_de_pedido BOOLEAN DEFAULT true,
  permitir_override BOOLEAN DEFAULT false,
  resuelta BOOLEAN DEFAULT false,
  fecha_resolucion DATE,
  notas_resolucion TEXT,
  creado_por uuid REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inv_restricciones TO authenticated;
GRANT ALL ON public.inv_restricciones TO service_role;
ALTER TABLE public.inv_restricciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "restricciones_select_auth" ON public.inv_restricciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "restricciones_modify_admin_manager" ON public.inv_restricciones FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE TRIGGER trg_inv_restricciones_updated_at BEFORE UPDATE ON public.inv_restricciones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- TABLA 4: inv_pedidos_activos_config
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inv_pedidos_activos_config (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  proveedor TEXT NOT NULL CHECK (proveedor IN ('chevron','phillips66')),
  fuente TEXT NOT NULL CHECK (fuente IN ('usa','cedis')),
  hub_almacen TEXT NOT NULL CHECK (hub_almacen IN ('1001','1002')),
  spokes_almacenes TEXT[] DEFAULT '{}',
  moneda TEXT DEFAULT 'MXN' CHECK (moneda IN ('MXN','USD')),
  lead_time_dias INTEGER NOT NULL DEFAULT 32,
  minimo_tarimas INTEGER NOT NULL DEFAULT 24,
  activo BOOLEAN DEFAULT true,
  pedido_actual_id uuid REFERENCES public.inv_pedidos(id),
  auto_abrir_al_cerrar BOOLEAN DEFAULT true,
  dias_anticipacion_apertura INTEGER DEFAULT 7,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inv_pedidos_activos_config TO authenticated;
GRANT ALL ON public.inv_pedidos_activos_config TO service_role;
ALTER TABLE public.inv_pedidos_activos_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pedidos_activos_select_auth" ON public.inv_pedidos_activos_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "pedidos_activos_modify_admin_manager" ON public.inv_pedidos_activos_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE TRIGGER trg_inv_pedidos_activos_config_updated_at BEFORE UPDATE ON public.inv_pedidos_activos_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- TABLA 5: inv_traspasos
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inv_traspasos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  almacen_origen TEXT NOT NULL CHECK (almacen_origen IN ('1001','1002','1003','1004')),
  almacen_destino TEXT NOT NULL CHECK (almacen_destino IN ('1001','1002','1003','1004')),
  estatus TEXT NOT NULL DEFAULT 'sugerido' CHECK (estatus IN ('sugerido','aprobado','enviado','recibido','cancelado')),
  fecha_sugerida DATE,
  fecha_envio DATE,
  fecha_recepcion DATE,
  viaje_id uuid,
  es_consolidado BOOLEAN DEFAULT false,
  total_skus INTEGER DEFAULT 0,
  notas TEXT,
  generado_automaticamente BOOLEAN DEFAULT true,
  aprobado_por uuid REFERENCES auth.users(id),
  creado_por uuid REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inv_traspasos TO authenticated;
GRANT ALL ON public.inv_traspasos TO service_role;
ALTER TABLE public.inv_traspasos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "traspasos_select_auth" ON public.inv_traspasos FOR SELECT TO authenticated USING (true);
CREATE POLICY "traspasos_modify_roles" ON public.inv_traspasos FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'manager')
    OR public.has_role(auth.uid(),'warehouse')
  )
  WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'manager')
    OR public.has_role(auth.uid(),'warehouse')
  );

CREATE TRIGGER trg_inv_traspasos_updated_at BEFORE UPDATE ON public.inv_traspasos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- TABLA 6: inv_traspaso_lineas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inv_traspaso_lineas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  traspaso_id uuid NOT NULL REFERENCES public.inv_traspasos(id) ON DELETE CASCADE,
  codigo_producto TEXT NOT NULL,
  nombre_producto TEXT,
  cantidad_sugerida NUMERIC NOT NULL,
  cantidad_aprobada NUMERIC,
  cantidad_enviada NUMERIC,
  cantidad_recibida NUMERIC,
  unidad TEXT,
  motivo TEXT,
  stock_origen_actual NUMERIC,
  stock_destino_actual NUMERIC,
  minimo_destino NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inv_traspaso_lineas TO authenticated;
GRANT ALL ON public.inv_traspaso_lineas TO service_role;
ALTER TABLE public.inv_traspaso_lineas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "traspaso_lineas_select_auth" ON public.inv_traspaso_lineas FOR SELECT TO authenticated USING (true);
CREATE POLICY "traspaso_lineas_modify_roles" ON public.inv_traspaso_lineas FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'manager')
    OR public.has_role(auth.uid(),'warehouse')
  )
  WITH CHECK (
    public.has_role(auth.uid(),'admin')
    OR public.has_role(auth.uid(),'manager')
    OR public.has_role(auth.uid(),'warehouse')
  );

CREATE TRIGGER trg_inv_traspaso_lineas_updated_at BEFORE UPDATE ON public.inv_traspaso_lineas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- ÍNDICES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_inv_demanda_plaza_sku ON public.inv_demanda_plaza(codigo_producto);
CREATE INDEX IF NOT EXISTS idx_inv_demanda_plaza_almacen ON public.inv_demanda_plaza(almacen);
CREATE INDEX IF NOT EXISTS idx_inv_minmax_sku ON public.inv_minmax(codigo_producto);
CREATE INDEX IF NOT EXISTS idx_inv_minmax_almacen ON public.inv_minmax(almacen);
CREATE INDEX IF NOT EXISTS idx_inv_restricciones_sku ON public.inv_restricciones(codigo_producto);
CREATE INDEX IF NOT EXISTS idx_inv_restricciones_activa ON public.inv_restricciones(activa);
CREATE INDEX IF NOT EXISTS idx_inv_traspasos_estatus ON public.inv_traspasos(estatus);
CREATE INDEX IF NOT EXISTS idx_inv_traspasos_destino ON public.inv_traspasos(almacen_destino);
CREATE INDEX IF NOT EXISTS idx_inv_traspasos_viaje ON public.inv_traspasos(viaje_id);
CREATE INDEX IF NOT EXISTS idx_inv_traspaso_lineas_traspaso ON public.inv_traspaso_lineas(traspaso_id);

-- ============================================================
-- DATOS INICIALES: 5 pedidos permanentes
-- ============================================================
INSERT INTO public.inv_pedidos_activos_config (id, nombre, proveedor, fuente, hub_almacen, spokes_almacenes, moneda, lead_time_dias, minimo_tarimas) VALUES
('CHV-MXL-NAL', 'Chevron Mexicali Nacional', 'chevron', 'cedis', '1001', ARRAY['1003'], 'MXN', 14, 24),
('CHV-MXL-IMP', 'Chevron Mexicali Importado', 'chevron', 'usa', '1001', ARRAY['1003'], 'MXN', 32, 24),
('CHV-TJ-NAL', 'Chevron Tijuana Nacional', 'chevron', 'cedis', '1002', ARRAY['1004'], 'MXN', 14, 24),
('CHV-TJ-IMP', 'Chevron Tijuana Importado', 'chevron', 'usa', '1002', ARRAY['1004'], 'MXN', 32, 24),
('P66-MXL-IMP', 'Phillips 66 Mexicali Importado', 'phillips66', 'usa', '1001', ARRAY['1002','1003','1004'], 'USD', 28, 0)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- PERMISOS por rol y módulo
-- ============================================================
INSERT INTO public.role_module_permissions (role, module, access_level) VALUES
('admin','inventario.demanda','todos'),
('admin','inventario.minmax','todos'),
('admin','inventario.restricciones','todos'),
('admin','inventario.traspasos','todos'),
('admin','inventario.dashboard_red','todos'),
('manager','inventario.demanda','todos'),
('manager','inventario.minmax','todos'),
('manager','inventario.restricciones','todos'),
('manager','inventario.traspasos','todos'),
('manager','inventario.dashboard_red','todos'),
('warehouse','inventario.demanda','lectura'),
('warehouse','inventario.minmax','lectura'),
('warehouse','inventario.restricciones','lectura'),
('warehouse','inventario.traspasos','todos'),
('warehouse','inventario.dashboard_red','lectura'),
('accounting','inventario.demanda','lectura'),
('accounting','inventario.minmax','lectura'),
('accounting','inventario.restricciones','lectura'),
('accounting','inventario.traspasos','lectura'),
('accounting','inventario.dashboard_red','lectura'),
('sales','inventario.demanda','lectura'),
('sales','inventario.minmax','lectura'),
('sales','inventario.restricciones','lectura'),
('sales','inventario.traspasos','ninguno'),
('sales','inventario.dashboard_red','lectura')
ON CONFLICT DO NOTHING;
