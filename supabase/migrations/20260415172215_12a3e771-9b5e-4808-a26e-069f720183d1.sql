
-- Create rutas_entrega table
CREATE TABLE public.rutas_entrega (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plaza_id UUID NOT NULL REFERENCES public.plazas(id),
  vehiculo_id UUID NOT NULL REFERENCES public.vehiculos(id),
  repartidor_id UUID NOT NULL REFERENCES public.repartidores(id),
  fecha_entrega DATE NOT NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.rutas_entrega ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated can view rutas_entrega"
  ON public.rutas_entrega FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage rutas_entrega"
  ON public.rutas_entrega FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can manage rutas_entrega"
  ON public.rutas_entrega FOR ALL USING (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Sales can manage rutas_entrega"
  ON public.rutas_entrega FOR ALL USING (has_role(auth.uid(), 'sales'::app_role));

CREATE POLICY "Delivery can manage rutas_entrega"
  ON public.rutas_entrega FOR ALL USING (has_role(auth.uid(), 'delivery'::app_role));

CREATE POLICY "Warehouse can manage rutas_entrega"
  ON public.rutas_entrega FOR ALL USING (has_role(auth.uid(), 'warehouse'::app_role));

-- Timestamp trigger
CREATE TRIGGER update_rutas_entrega_updated_at
  BEFORE UPDATE ON public.rutas_entrega
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add ruta_id to entregas_programadas
ALTER TABLE public.entregas_programadas
  ADD COLUMN ruta_id UUID REFERENCES public.rutas_entrega(id) ON DELETE CASCADE;
