
-- Add new estatus_pedido values
ALTER TYPE public.estatus_pedido ADD VALUE IF NOT EXISTS 'espera_autorizacion_precio' AFTER 'confirmado_cliente';
ALTER TYPE public.estatus_pedido ADD VALUE IF NOT EXISTS 'precio_autorizado' AFTER 'espera_autorizacion_precio';

-- Add programable_entrega to crm_tasks
ALTER TABLE public.crm_tasks ADD COLUMN IF NOT EXISTS programable_entrega boolean NOT NULL DEFAULT false;

-- Create ruta_repartidores junction table
CREATE TABLE IF NOT EXISTS public.ruta_repartidores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ruta_id UUID NOT NULL REFERENCES public.rutas_entrega(id) ON DELETE CASCADE,
  repartidor_id UUID NOT NULL REFERENCES public.repartidores(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(ruta_id, repartidor_id)
);

ALTER TABLE public.ruta_repartidores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view ruta_repartidores" ON public.ruta_repartidores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage ruta_repartidores" ON public.ruta_repartidores FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers can manage ruta_repartidores" ON public.ruta_repartidores FOR ALL USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Delivery can manage ruta_repartidores" ON public.ruta_repartidores FOR ALL USING (has_role(auth.uid(), 'delivery'::app_role));
CREATE POLICY "Warehouse can manage ruta_repartidores" ON public.ruta_repartidores FOR ALL USING (has_role(auth.uid(), 'warehouse'::app_role));
CREATE POLICY "Sales can manage ruta_repartidores" ON public.ruta_repartidores FOR ALL USING (has_role(auth.uid(), 'sales'::app_role));

-- Add future capacity fields to rutas_entrega
ALTER TABLE public.rutas_entrega ADD COLUMN IF NOT EXISTS capacidad_kg numeric DEFAULT NULL;
ALTER TABLE public.rutas_entrega ADD COLUMN IF NOT EXISTS capacidad_volumen numeric DEFAULT NULL;
