
-- Add enum value
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'catalogo_extendido';

-- Column on productos
ALTER TABLE public.productos ADD COLUMN IF NOT EXISTS es_para_cotizar boolean NOT NULL DEFAULT false;

-- 1. catalogo_externo_productos
CREATE TABLE public.catalogo_externo_productos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_proveedor text,
  nombre text NOT NULL,
  empaque text,
  familia text,
  aplicacion text,
  uom text,
  precio_lista_mxn numeric,
  precio_lista_usd numeric,
  precio_por_uom numeric,
  empresa_vendedora text NOT NULL CHECK (empresa_vendedora IN ('lumaggs','galsa')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogo_externo_productos TO authenticated;
GRANT ALL ON public.catalogo_externo_productos TO service_role;
ALTER TABLE public.catalogo_externo_productos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view catalogo externo"
  ON public.catalogo_externo_productos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin/Manager can insert catalogo externo"
  ON public.catalogo_externo_productos FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "Admin/Manager can update catalogo externo"
  ON public.catalogo_externo_productos FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "Admin/Manager can delete catalogo externo"
  ON public.catalogo_externo_productos FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));

CREATE TRIGGER update_catalogo_externo_productos_updated_at
  BEFORE UPDATE ON public.catalogo_externo_productos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. solicitudes_producto
CREATE TABLE public.solicitudes_producto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catalogo_producto_id uuid REFERENCES public.catalogo_externo_productos(id),
  empresa_vendedora text NOT NULL CHECK (empresa_vendedora IN ('lumaggs','galsa')),
  nombre_producto text NOT NULL,
  marca_externa text,
  descripcion_adicional text,
  cantidad_solicitada numeric NOT NULL,
  unidad text NOT NULL DEFAULT 'litros',
  justificacion text NOT NULL,
  fotos_urls text[] NOT NULL DEFAULT '{}',
  estatus text NOT NULL DEFAULT 'solicitado' CHECK (estatus IN ('solicitado','aprobado','pedido','recibido','rechazado')),
  motivo_rechazo text,
  solicitado_por uuid REFERENCES auth.users(id),
  aprobado_por uuid REFERENCES auth.users(id),
  fecha_aprobacion timestamptz,
  fecha_pedido timestamptz,
  fecha_recepcion timestamptz,
  notas_internas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.solicitudes_producto TO authenticated;
GRANT ALL ON public.solicitudes_producto TO service_role;
ALTER TABLE public.solicitudes_producto ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view solicitudes producto"
  ON public.solicitudes_producto FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert solicitudes producto"
  ON public.solicitudes_producto FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin/Manager/Warehouse can update solicitudes producto"
  ON public.solicitudes_producto FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(),'admin'::app_role)
    OR has_role(auth.uid(),'manager'::app_role)
    OR has_role(auth.uid(),'warehouse'::app_role)
  );
CREATE POLICY "Admin can delete solicitudes producto"
  ON public.solicitudes_producto FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER update_solicitudes_producto_updated_at
  BEFORE UPDATE ON public.solicitudes_producto
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
