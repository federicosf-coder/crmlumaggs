-- 1. inv_reclamos: recepcion opcional + campos PROBID
ALTER TABLE public.inv_reclamos ALTER COLUMN recepcion_id DROP NOT NULL;
ALTER TABLE public.inv_reclamos ALTER COLUMN tipo_reclamo SET DEFAULT 'faltante';
ALTER TABLE public.inv_reclamos ALTER COLUMN estatus SET DEFAULT 'borrador';

ALTER TABLE public.inv_reclamos
  ADD COLUMN IF NOT EXISTS cliente_nombre text NOT NULL DEFAULT 'LUMAGGS',
  ADD COLUMN IF NOT EXISTS no_pedido_factura text,
  ADD COLUMN IF NOT EXISTS factura_recibida_id uuid REFERENCES public.chevron_facturas_recibidas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fecha_reclamo date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS fecha_recepcion date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS remitente_nombre text,
  ADD COLUMN IF NOT EXISTS remitente_email text,
  ADD COLUMN IF NOT EXISTS domicilio_recoleccion text,
  ADD COLUMN IF NOT EXISTS contacto_recoleccion text,
  ADD COLUMN IF NOT EXISTS correo_recoleccion text,
  ADD COLUMN IF NOT EXISTS nota_credito_id uuid REFERENCES public.chevron_facturas_recibidas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nota_credito_folio text,
  ADD COLUMN IF NOT EXISTS nota_credito_monto numeric,
  ADD COLUMN IF NOT EXISTS fecha_envio timestamptz;

ALTER TABLE public.inv_reclamos DROP CONSTRAINT IF EXISTS inv_reclamos_estatus_check;
ALTER TABLE public.inv_reclamos ADD CONSTRAINT inv_reclamos_estatus_check
  CHECK (estatus = ANY (ARRAY['borrador','enviado','aceptado','rechazado','en_aclaracion','abierto','enviado_proveedor','en_revision','resuelto','cerrado']));

ALTER TABLE public.inv_reclamos DROP CONSTRAINT IF EXISTS inv_reclamos_tipo_reclamo_check;

CREATE INDEX IF NOT EXISTS idx_inv_reclamos_factura ON public.inv_reclamos(factura_recibida_id);

-- 2. inv_reclamo_lineas: campos PROBID
ALTER TABLE public.inv_reclamo_lineas ALTER COLUMN cantidad_afectada DROP NOT NULL;
ALTER TABLE public.inv_reclamo_lineas DROP CONSTRAINT IF EXISTS inv_reclamo_lineas_tipo_problema_check;

ALTER TABLE public.inv_reclamo_lineas
  ADD COLUMN IF NOT EXISTS tipo_producto text NOT NULL DEFAULT 'Empacado',
  ADD COLUMN IF NOT EXISTS descripcion text,
  ADD COLUMN IF NOT EXISTS empaque text,
  ADD COLUMN IF NOT EXISTS tipo_aviso text NOT NULL DEFAULT 'Faltante',
  ADD COLUMN IF NOT EXISTS cantidad_solicitada numeric,
  ADD COLUMN IF NOT EXISTS cantidad_recibida numeric,
  ADD COLUMN IF NOT EXISTS diferencia numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unidad text NOT NULL DEFAULT 'Piezas',
  ADD COLUMN IF NOT EXISTS facturar_intercambiado text;

CREATE INDEX IF NOT EXISTS idx_inv_reclamo_lineas_reclamo ON public.inv_reclamo_lineas(reclamo_id);

-- 3. Seguimiento de correos
CREATE TABLE IF NOT EXISTS public.inv_reclamo_seguimiento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reclamo_id uuid NOT NULL REFERENCES public.inv_reclamos(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'envio',
  from_email text,
  destinatarios text[],
  cc text[],
  asunto text,
  cuerpo text,
  estatus_envio text NOT NULL DEFAULT 'enviado',
  error_mensaje text,
  nota text,
  creado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inv_reclamo_seguimiento TO authenticated;
GRANT ALL ON public.inv_reclamo_seguimiento TO service_role;
ALTER TABLE public.inv_reclamo_seguimiento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view reclamo_seguimiento" ON public.inv_reclamo_seguimiento
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage reclamo_seguimiento" ON public.inv_reclamo_seguimiento
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Manager manage reclamo_seguimiento" ON public.inv_reclamo_seguimiento
  FOR ALL TO authenticated USING (has_role(auth.uid(),'manager'::app_role)) WITH CHECK (has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "Warehouse manage reclamo_seguimiento" ON public.inv_reclamo_seguimiento
  FOR ALL TO authenticated USING (has_role(auth.uid(),'warehouse'::app_role)) WITH CHECK (has_role(auth.uid(),'warehouse'::app_role));

CREATE INDEX IF NOT EXISTS idx_inv_reclamo_seguimiento_reclamo ON public.inv_reclamo_seguimiento(reclamo_id);

-- 4. Catálogo de opciones editables
CREATE TABLE IF NOT EXISTS public.inv_reclamo_opciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campo text NOT NULL,
  valor text NOT NULL,
  orden integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campo, valor)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inv_reclamo_opciones TO authenticated;
GRANT ALL ON public.inv_reclamo_opciones TO service_role;
ALTER TABLE public.inv_reclamo_opciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated view reclamo_opciones" ON public.inv_reclamo_opciones
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage reclamo_opciones" ON public.inv_reclamo_opciones
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Manager manage reclamo_opciones" ON public.inv_reclamo_opciones
  FOR ALL TO authenticated USING (has_role(auth.uid(),'manager'::app_role)) WITH CHECK (has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "Warehouse manage reclamo_opciones" ON public.inv_reclamo_opciones
  FOR ALL TO authenticated USING (has_role(auth.uid(),'warehouse'::app_role)) WITH CHECK (has_role(auth.uid(),'warehouse'::app_role));

CREATE TRIGGER trg_inv_reclamo_opciones_updated_at BEFORE UPDATE ON public.inv_reclamo_opciones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.inv_reclamo_opciones (campo, valor, orden) VALUES
  ('tipo_producto','Empacado',1),
  ('tipo_producto','Granel',2),
  ('tipo_aviso','Dañado',1),
  ('tipo_aviso','Faltante',2),
  ('unidad','Piezas',1),
  ('unidad','Litros',2)
ON CONFLICT (campo, valor) DO NOTHING;

-- 5. Acceso a facturas Chevron para roles de inventario
CREATE POLICY "Inventario view chevron facturas" ON public.chevron_facturas_recibidas
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'warehouse'::app_role));

CREATE POLICY "Inventario update chevron facturas" ON public.chevron_facturas_recibidas
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'warehouse'::app_role));

-- 6. Warehouse puede actualizar pedidos (vincular factura)
CREATE POLICY "Warehouse manage pedidos" ON public.inv_pedidos
  FOR ALL TO authenticated USING (has_role(auth.uid(),'warehouse'::app_role)) WITH CHECK (has_role(auth.uid(),'warehouse'::app_role));