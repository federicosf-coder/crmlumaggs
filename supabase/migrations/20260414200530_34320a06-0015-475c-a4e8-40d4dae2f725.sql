
-- Update estatus_pedido enum: drop and recreate
ALTER TYPE public.estatus_pedido RENAME TO estatus_pedido_old;
CREATE TYPE public.estatus_pedido AS ENUM ('confirmado_cliente', 'validado_contabilidad', 'programado_entrega', 'entregado', 'cancelado');

-- Migrate existing data
ALTER TABLE public.documentos ALTER COLUMN estatus_pedido TYPE public.estatus_pedido USING 
  CASE estatus_pedido::text
    WHEN 'pendiente' THEN 'confirmado_cliente'::public.estatus_pedido
    WHEN 'confirmado' THEN 'confirmado_cliente'::public.estatus_pedido
    WHEN 'en_proceso' THEN 'validado_contabilidad'::public.estatus_pedido
    WHEN 'enviado' THEN 'programado_entrega'::public.estatus_pedido
    WHEN 'entregado' THEN 'entregado'::public.estatus_pedido
    WHEN 'cancelado' THEN 'cancelado'::public.estatus_pedido
    ELSE NULL
  END;

DROP TYPE public.estatus_pedido_old;

-- Vehicles table
CREATE TABLE public.vehiculos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  placas TEXT,
  tipo TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.vehiculos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view vehiculos" ON public.vehiculos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage vehiculos" ON public.vehiculos FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers can manage vehiculos" ON public.vehiculos FOR ALL USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Delivery can manage vehiculos" ON public.vehiculos FOR ALL USING (has_role(auth.uid(), 'delivery'::app_role));
CREATE POLICY "Warehouse can manage vehiculos" ON public.vehiculos FOR ALL USING (has_role(auth.uid(), 'warehouse'::app_role));

-- Drivers table
CREATE TABLE public.repartidores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  telefono TEXT,
  licencia TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.repartidores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view repartidores" ON public.repartidores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage repartidores" ON public.repartidores FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers can manage repartidores" ON public.repartidores FOR ALL USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Delivery can manage repartidores" ON public.repartidores FOR ALL USING (has_role(auth.uid(), 'delivery'::app_role));
CREATE POLICY "Warehouse can manage repartidores" ON public.repartidores FOR ALL USING (has_role(auth.uid(), 'warehouse'::app_role));

-- Delivery schedules table
CREATE TABLE public.entregas_programadas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  documento_id UUID NOT NULL REFERENCES public.documentos(id) ON DELETE CASCADE,
  vehiculo_id UUID NOT NULL REFERENCES public.vehiculos(id),
  repartidor_id UUID NOT NULL REFERENCES public.repartidores(id),
  fecha_entrega DATE NOT NULL,
  orden_ruta INTEGER NOT NULL DEFAULT 0,
  fecha_entrega_real TIMESTAMP WITH TIME ZONE,
  notas TEXT,
  evidencia_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(documento_id)
);
ALTER TABLE public.entregas_programadas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view entregas_programadas" ON public.entregas_programadas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage entregas_programadas" ON public.entregas_programadas FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers can manage entregas_programadas" ON public.entregas_programadas FOR ALL USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Sales can manage entregas_programadas" ON public.entregas_programadas FOR ALL USING (has_role(auth.uid(), 'sales'::app_role));
CREATE POLICY "Delivery can manage entregas_programadas" ON public.entregas_programadas FOR ALL USING (has_role(auth.uid(), 'delivery'::app_role));
CREATE POLICY "Warehouse can manage entregas_programadas" ON public.entregas_programadas FOR ALL USING (has_role(auth.uid(), 'warehouse'::app_role));
