
-- =========================================
-- INVENTARIO: TABLAS
-- =========================================

CREATE TABLE public.inv_kardex_cargas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('unidades','valorizado','cedis')),
  empresa_vendedora TEXT NOT NULL CHECK (empresa_vendedora IN ('lumaggs','galsa')),
  fecha_archivo DATE,
  fecha_vencimiento DATE,
  nombre_archivo TEXT NOT NULL,
  url_archivo TEXT,
  total_skus_procesados INTEGER DEFAULT 0,
  total_skus_actualizados INTEGER DEFAULT 0,
  total_skus_error INTEGER DEFAULT 0,
  estatus TEXT NOT NULL DEFAULT 'procesando' CHECK (estatus IN ('procesando','completado','error')),
  notas TEXT,
  creado_por uuid REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inv_kardex_cargas TO authenticated;
GRANT ALL ON public.inv_kardex_cargas TO service_role;

CREATE TABLE public.inv_kardex_lineas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carga_id uuid NOT NULL REFERENCES public.inv_kardex_cargas(id) ON DELETE CASCADE,
  codigo_producto TEXT NOT NULL,
  nombre_producto TEXT,
  stock_almacen_1001 NUMERIC DEFAULT 0,
  stock_almacen_1002 NUMERIC DEFAULT 0,
  stock_almacen_1003 NUMERIC DEFAULT 0,
  stock_almacen_1004 NUMERIC DEFAULT 0,
  stock_total NUMERIC DEFAULT 0,
  costo_promedio NUMERIC,
  valor_total NUMERIC,
  estatus_linea TEXT DEFAULT 'ok' CHECK (estatus_linea IN ('ok','sku_nuevo','error')),
  mensaje_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inv_kardex_lineas TO authenticated;
GRANT ALL ON public.inv_kardex_lineas TO service_role;

CREATE TABLE public.inv_niveles_inventario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_producto TEXT NOT NULL UNIQUE,
  nombre_producto TEXT,
  unidad TEXT,
  empresa_vendedora TEXT CHECK (empresa_vendedora IN ('lumaggs','galsa')),
  fuente_suministro TEXT CHECK (fuente_suministro IN ('usa','cedis','closa','europe')),
  lead_time_dias INTEGER DEFAULT 32,
  presentacion TEXT CHECK (presentacion IN ('tambor','cubeta','caja_12u','caja_6u','caja_3u','granel','otro')),
  piezas_por_tarima INTEGER,
  clasificacion_abc TEXT CHECK (clasificacion_abc IN ('A','B','C')),
  stock_almacen_1001 NUMERIC DEFAULT 0,
  stock_almacen_1002 NUMERIC DEFAULT 0,
  stock_almacen_1003 NUMERIC DEFAULT 0,
  stock_almacen_1004 NUMERIC DEFAULT 0,
  stock_total NUMERIC DEFAULT 0,
  costo_promedio NUMERIC,
  valor_total_inventario NUMERIC,
  venta_mensual_promedio NUMERIC DEFAULT 0,
  consumo_hub_mensual NUMERIC DEFAULT 0,
  dias_cobertura NUMERIC,
  rotacion_anual NUMERIC,
  coeficiente_variacion NUMERIC,
  estatus_inventario TEXT DEFAULT 'ok' CHECK (estatus_inventario IN ('pedir','ok','sobrestock','muerto','inactivo')),
  fecha_ultimo_kardex DATE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inv_niveles_inventario TO authenticated;
GRANT ALL ON public.inv_niveles_inventario TO service_role;

CREATE TABLE public.inv_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_vendedora TEXT NOT NULL CHECK (empresa_vendedora IN ('lumaggs','galsa')),
  proveedor TEXT NOT NULL CHECK (proveedor IN ('chevron','phillips66')),
  fuente TEXT CHECK (fuente IN ('usa','cedis')),
  almacen_destino TEXT NOT NULL CHECK (almacen_destino IN ('1001','1002')),
  numero_po_interno TEXT,
  numero_orden_proveedor TEXT,
  fecha_pedido DATE,
  fecha_despacho DATE,
  fecha_entrega_estimada DATE,
  fecha_entrega_real DATE,
  total_tarimas INTEGER DEFAULT 0,
  total_monto NUMERIC,
  moneda TEXT DEFAULT 'MXN' CHECK (moneda IN ('MXN','USD')),
  estatus TEXT NOT NULL DEFAULT 'borrador' CHECK (estatus IN ('borrador','enviado','confirmado_proveedor','en_transito','recibido_parcial','cerrado','cancelado')),
  notas TEXT,
  generado_desde_sugeridos BOOLEAN DEFAULT false,
  creado_por uuid REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inv_pedidos TO authenticated;
GRANT ALL ON public.inv_pedidos TO service_role;

CREATE TABLE public.inv_pedido_lineas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.inv_pedidos(id) ON DELETE CASCADE,
  codigo_producto TEXT NOT NULL,
  nombre_producto TEXT,
  presentacion TEXT,
  piezas_por_tarima INTEGER,
  cantidad_solicitada NUMERIC NOT NULL,
  unidad_pedido TEXT,
  tarimas INTEGER,
  precio_unitario NUMERIC,
  moneda TEXT DEFAULT 'MXN',
  precio_neto NUMERIC,
  cantidad_confirmada NUMERIC,
  cantidad_recibida NUMERIC DEFAULT 0,
  estatus_linea TEXT DEFAULT 'pendiente' CHECK (estatus_linea IN ('pendiente','confirmada','recibida_completa','recibida_parcial','faltante','cancelada')),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inv_pedido_lineas TO authenticated;
GRANT ALL ON public.inv_pedido_lineas TO service_role;

CREATE TABLE public.inv_pedido_archivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.inv_pedidos(id) ON DELETE CASCADE,
  tipo_archivo TEXT CHECK (tipo_archivo IN ('confirmacion_proveedor','pedido_interno','factura_proveedor','otro')),
  nombre_archivo TEXT NOT NULL,
  url_archivo TEXT NOT NULL,
  extraido_por_ia BOOLEAN DEFAULT false,
  datos_extraidos JSONB,
  usuario_carga uuid REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inv_pedido_archivos TO authenticated;
GRANT ALL ON public.inv_pedido_archivos TO service_role;

CREATE TABLE public.inv_recepciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.inv_pedidos(id) ON DELETE RESTRICT,
  fecha_recepcion DATE NOT NULL DEFAULT CURRENT_DATE,
  almacen_recepcion TEXT NOT NULL CHECK (almacen_recepcion IN ('1001','1002','1003','1004')),
  recibido_por uuid REFERENCES auth.users(id),
  total_skus_pedidos INTEGER,
  total_skus_recibidos_completos INTEGER DEFAULT 0,
  total_skus_con_diferencia INTEGER DEFAULT 0,
  tiene_reclamo BOOLEAN DEFAULT false,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inv_recepciones TO authenticated;
GRANT ALL ON public.inv_recepciones TO service_role;

CREATE TABLE public.inv_recepcion_lineas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recepcion_id uuid NOT NULL REFERENCES public.inv_recepciones(id) ON DELETE CASCADE,
  pedido_linea_id uuid REFERENCES public.inv_pedido_lineas(id),
  codigo_producto TEXT NOT NULL,
  nombre_producto TEXT,
  cantidad_pedida NUMERIC NOT NULL,
  cantidad_recibida NUMERIC NOT NULL DEFAULT 0,
  diferencia NUMERIC,
  tipo_diferencia TEXT CHECK (tipo_diferencia IN ('completo','faltante','sobrante','dañado','incorrecto')),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inv_recepcion_lineas TO authenticated;
GRANT ALL ON public.inv_recepcion_lineas TO service_role;

CREATE TABLE public.inv_reclamos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recepcion_id uuid NOT NULL REFERENCES public.inv_recepciones(id) ON DELETE RESTRICT,
  pedido_id uuid NOT NULL REFERENCES public.inv_pedidos(id),
  empresa_vendedora TEXT NOT NULL CHECK (empresa_vendedora IN ('lumaggs','galsa')),
  tipo_reclamo TEXT NOT NULL CHECK (tipo_reclamo IN ('faltante','dañado','incorrecto','otro')),
  estatus TEXT NOT NULL DEFAULT 'abierto' CHECK (estatus IN ('abierto','enviado_proveedor','en_revision','resuelto','cerrado')),
  descripcion TEXT,
  total_skus_afectados INTEGER DEFAULT 0,
  resolucion TEXT,
  fecha_envio_proveedor DATE,
  fecha_resolucion DATE,
  creado_por uuid REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inv_reclamos TO authenticated;
GRANT ALL ON public.inv_reclamos TO service_role;

CREATE TABLE public.inv_reclamo_lineas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reclamo_id uuid NOT NULL REFERENCES public.inv_reclamos(id) ON DELETE CASCADE,
  codigo_producto TEXT NOT NULL,
  nombre_producto TEXT,
  cantidad_afectada NUMERIC NOT NULL,
  tipo_problema TEXT CHECK (tipo_problema IN ('faltante','dañado','incorrecto')),
  descripcion_problema TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inv_reclamo_lineas TO authenticated;
GRANT ALL ON public.inv_reclamo_lineas TO service_role;

CREATE TABLE public.inv_reclamo_archivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reclamo_id uuid NOT NULL REFERENCES public.inv_reclamos(id) ON DELETE CASCADE,
  nombre_archivo TEXT NOT NULL,
  url_archivo TEXT NOT NULL,
  tipo_archivo TEXT DEFAULT 'imagen',
  usuario_carga uuid REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inv_reclamo_archivos TO authenticated;
GRANT ALL ON public.inv_reclamo_archivos TO service_role;

-- =========================================
-- INDEXES
-- =========================================
CREATE INDEX idx_inv_niveles_empresa ON public.inv_niveles_inventario(empresa_vendedora);
CREATE INDEX idx_inv_niveles_estatus ON public.inv_niveles_inventario(estatus_inventario);
CREATE INDEX idx_inv_niveles_abc ON public.inv_niveles_inventario(clasificacion_abc);
CREATE INDEX idx_inv_pedidos_empresa_estatus ON public.inv_pedidos(empresa_vendedora, estatus);
CREATE INDEX idx_inv_pedidos_almacen ON public.inv_pedidos(almacen_destino);
CREATE INDEX idx_inv_pedidos_fecha ON public.inv_pedidos(fecha_pedido);
CREATE INDEX idx_inv_pedido_lineas_pedido ON public.inv_pedido_lineas(pedido_id);
CREATE INDEX idx_inv_pedido_lineas_codigo ON public.inv_pedido_lineas(codigo_producto);
CREATE INDEX idx_inv_recepciones_pedido ON public.inv_recepciones(pedido_id);
CREATE INDEX idx_inv_reclamos_pedido ON public.inv_reclamos(pedido_id);
CREATE INDEX idx_inv_reclamos_estatus ON public.inv_reclamos(estatus);
CREATE INDEX idx_inv_kardex_cargas_empresa ON public.inv_kardex_cargas(empresa_vendedora);

-- =========================================
-- RLS
-- =========================================
ALTER TABLE public.inv_kardex_cargas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inv_kardex_lineas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inv_niveles_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inv_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inv_pedido_lineas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inv_pedido_archivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inv_recepciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inv_recepcion_lineas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inv_reclamos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inv_reclamo_lineas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inv_reclamo_archivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view kardex_cargas" ON public.inv_kardex_cargas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage kardex_cargas" ON public.inv_kardex_cargas FOR ALL USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Manager manage kardex_cargas" ON public.inv_kardex_cargas FOR ALL USING (has_role(auth.uid(),'manager'::app_role)) WITH CHECK (has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "Warehouse manage kardex_cargas" ON public.inv_kardex_cargas FOR ALL USING (has_role(auth.uid(),'warehouse'::app_role)) WITH CHECK (has_role(auth.uid(),'warehouse'::app_role));

CREATE POLICY "Authenticated view kardex_lineas" ON public.inv_kardex_lineas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage kardex_lineas" ON public.inv_kardex_lineas FOR ALL USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Manager manage kardex_lineas" ON public.inv_kardex_lineas FOR ALL USING (has_role(auth.uid(),'manager'::app_role)) WITH CHECK (has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "Warehouse manage kardex_lineas" ON public.inv_kardex_lineas FOR ALL USING (has_role(auth.uid(),'warehouse'::app_role)) WITH CHECK (has_role(auth.uid(),'warehouse'::app_role));

CREATE POLICY "Authenticated view niveles" ON public.inv_niveles_inventario FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage niveles" ON public.inv_niveles_inventario FOR ALL USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Manager manage niveles" ON public.inv_niveles_inventario FOR ALL USING (has_role(auth.uid(),'manager'::app_role)) WITH CHECK (has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "Warehouse manage niveles" ON public.inv_niveles_inventario FOR ALL USING (has_role(auth.uid(),'warehouse'::app_role)) WITH CHECK (has_role(auth.uid(),'warehouse'::app_role));

CREATE POLICY "Authenticated view pedidos" ON public.inv_pedidos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage pedidos" ON public.inv_pedidos FOR ALL USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Manager manage pedidos" ON public.inv_pedidos FOR ALL USING (has_role(auth.uid(),'manager'::app_role)) WITH CHECK (has_role(auth.uid(),'manager'::app_role));

CREATE POLICY "Authenticated view pedido_lineas" ON public.inv_pedido_lineas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage pedido_lineas" ON public.inv_pedido_lineas FOR ALL USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Manager manage pedido_lineas" ON public.inv_pedido_lineas FOR ALL USING (has_role(auth.uid(),'manager'::app_role)) WITH CHECK (has_role(auth.uid(),'manager'::app_role));

CREATE POLICY "Authenticated view pedido_archivos" ON public.inv_pedido_archivos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage pedido_archivos" ON public.inv_pedido_archivos FOR ALL USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Manager manage pedido_archivos" ON public.inv_pedido_archivos FOR ALL USING (has_role(auth.uid(),'manager'::app_role)) WITH CHECK (has_role(auth.uid(),'manager'::app_role));

CREATE POLICY "Authenticated view recepciones" ON public.inv_recepciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage recepciones" ON public.inv_recepciones FOR ALL USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Manager manage recepciones" ON public.inv_recepciones FOR ALL USING (has_role(auth.uid(),'manager'::app_role)) WITH CHECK (has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "Warehouse manage recepciones" ON public.inv_recepciones FOR ALL USING (has_role(auth.uid(),'warehouse'::app_role)) WITH CHECK (has_role(auth.uid(),'warehouse'::app_role));

CREATE POLICY "Authenticated view recepcion_lineas" ON public.inv_recepcion_lineas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage recepcion_lineas" ON public.inv_recepcion_lineas FOR ALL USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Manager manage recepcion_lineas" ON public.inv_recepcion_lineas FOR ALL USING (has_role(auth.uid(),'manager'::app_role)) WITH CHECK (has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "Warehouse manage recepcion_lineas" ON public.inv_recepcion_lineas FOR ALL USING (has_role(auth.uid(),'warehouse'::app_role)) WITH CHECK (has_role(auth.uid(),'warehouse'::app_role));

CREATE POLICY "Authenticated view reclamos" ON public.inv_reclamos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage reclamos" ON public.inv_reclamos FOR ALL USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Manager manage reclamos" ON public.inv_reclamos FOR ALL USING (has_role(auth.uid(),'manager'::app_role)) WITH CHECK (has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "Warehouse manage reclamos" ON public.inv_reclamos FOR ALL USING (has_role(auth.uid(),'warehouse'::app_role)) WITH CHECK (has_role(auth.uid(),'warehouse'::app_role));

CREATE POLICY "Authenticated view reclamo_lineas" ON public.inv_reclamo_lineas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage reclamo_lineas" ON public.inv_reclamo_lineas FOR ALL USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Manager manage reclamo_lineas" ON public.inv_reclamo_lineas FOR ALL USING (has_role(auth.uid(),'manager'::app_role)) WITH CHECK (has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "Warehouse manage reclamo_lineas" ON public.inv_reclamo_lineas FOR ALL USING (has_role(auth.uid(),'warehouse'::app_role)) WITH CHECK (has_role(auth.uid(),'warehouse'::app_role));

CREATE POLICY "Authenticated view reclamo_archivos" ON public.inv_reclamo_archivos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage reclamo_archivos" ON public.inv_reclamo_archivos FOR ALL USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Manager manage reclamo_archivos" ON public.inv_reclamo_archivos FOR ALL USING (has_role(auth.uid(),'manager'::app_role)) WITH CHECK (has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "Warehouse manage reclamo_archivos" ON public.inv_reclamo_archivos FOR ALL USING (has_role(auth.uid(),'warehouse'::app_role)) WITH CHECK (has_role(auth.uid(),'warehouse'::app_role));

-- =========================================
-- TRIGGERS updated_at
-- =========================================
CREATE TRIGGER trg_inv_kardex_cargas_updated_at BEFORE UPDATE ON public.inv_kardex_cargas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_inv_niveles_inventario_updated_at BEFORE UPDATE ON public.inv_niveles_inventario FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_inv_pedidos_updated_at BEFORE UPDATE ON public.inv_pedidos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_inv_pedido_lineas_updated_at BEFORE UPDATE ON public.inv_pedido_lineas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_inv_recepciones_updated_at BEFORE UPDATE ON public.inv_recepciones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_inv_reclamos_updated_at BEFORE UPDATE ON public.inv_reclamos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- PERMISOS por rol
-- =========================================
INSERT INTO public.role_module_permissions (role, module, access_level) VALUES
  ('admin','inventario','todos'),
  ('admin','inventario.kardex','todos'),
  ('admin','inventario.niveles','todos'),
  ('admin','inventario.pedidos','todos'),
  ('admin','inventario.pedidos.sugeridos','todos'),
  ('admin','inventario.pedidos.elaborados','todos'),
  ('admin','inventario.pedidos.recibidos','todos'),
  ('admin','inventario.pedidos.reclamos','todos'),
  ('manager','inventario','todos'),
  ('manager','inventario.kardex','todos'),
  ('manager','inventario.niveles','todos'),
  ('manager','inventario.pedidos','todos'),
  ('manager','inventario.pedidos.sugeridos','todos'),
  ('manager','inventario.pedidos.elaborados','todos'),
  ('manager','inventario.pedidos.recibidos','todos'),
  ('manager','inventario.pedidos.reclamos','todos'),
  ('warehouse','inventario','todos'),
  ('warehouse','inventario.kardex','todos'),
  ('warehouse','inventario.niveles','todos'),
  ('warehouse','inventario.pedidos','lectura'),
  ('warehouse','inventario.pedidos.sugeridos','lectura'),
  ('warehouse','inventario.pedidos.elaborados','lectura'),
  ('warehouse','inventario.pedidos.recibidos','todos'),
  ('warehouse','inventario.pedidos.reclamos','todos'),
  ('accounting','inventario','lectura'),
  ('accounting','inventario.kardex','lectura'),
  ('accounting','inventario.niveles','lectura'),
  ('accounting','inventario.pedidos','lectura'),
  ('accounting','inventario.pedidos.sugeridos','ninguno'),
  ('accounting','inventario.pedidos.elaborados','lectura'),
  ('accounting','inventario.pedidos.recibidos','lectura'),
  ('accounting','inventario.pedidos.reclamos','lectura'),
  ('sales','inventario','lectura'),
  ('sales','inventario.kardex','ninguno'),
  ('sales','inventario.niveles','lectura'),
  ('sales','inventario.pedidos','lectura'),
  ('sales','inventario.pedidos.sugeridos','lectura'),
  ('sales','inventario.pedidos.elaborados','lectura'),
  ('sales','inventario.pedidos.recibidos','lectura'),
  ('sales','inventario.pedidos.reclamos','lectura'),
  ('customer_service','inventario','ninguno'),
  ('customer_service','inventario.kardex','ninguno'),
  ('customer_service','inventario.niveles','ninguno'),
  ('customer_service','inventario.pedidos','ninguno'),
  ('customer_service','inventario.pedidos.sugeridos','ninguno'),
  ('customer_service','inventario.pedidos.elaborados','ninguno'),
  ('customer_service','inventario.pedidos.recibidos','ninguno'),
  ('customer_service','inventario.pedidos.reclamos','ninguno'),
  ('delivery','inventario','ninguno'),
  ('delivery','inventario.kardex','ninguno'),
  ('delivery','inventario.niveles','ninguno'),
  ('delivery','inventario.pedidos','ninguno'),
  ('delivery','inventario.pedidos.sugeridos','ninguno'),
  ('delivery','inventario.pedidos.elaborados','ninguno'),
  ('delivery','inventario.pedidos.recibidos','ninguno'),
  ('delivery','inventario.pedidos.reclamos','ninguno')
ON CONFLICT (role, module) DO NOTHING;
