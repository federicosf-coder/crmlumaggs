
-- 1) Junction tables
CREATE TABLE IF NOT EXISTS public.crm_activity_seguimiento (
  activity_id uuid NOT NULL REFERENCES public.crm_activities(id) ON DELETE CASCADE,
  seguimiento_venta_id uuid NOT NULL REFERENCES public.seguimiento_ventas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (activity_id, seguimiento_venta_id)
);
CREATE INDEX IF NOT EXISTS idx_act_seg ON public.crm_activity_seguimiento(seguimiento_venta_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_activity_seguimiento TO authenticated;
GRANT ALL ON public.crm_activity_seguimiento TO service_role;
ALTER TABLE public.crm_activity_seguimiento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view act_seg" ON public.crm_activity_seguimiento FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage act_seg" ON public.crm_activity_seguimiento FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'sales'::app_role) OR has_role(auth.uid(),'customer_service'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'sales'::app_role) OR has_role(auth.uid(),'customer_service'::app_role));

CREATE TABLE IF NOT EXISTS public.crm_task_seguimiento (
  task_id uuid NOT NULL REFERENCES public.crm_tasks(id) ON DELETE CASCADE,
  seguimiento_venta_id uuid NOT NULL REFERENCES public.seguimiento_ventas(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, seguimiento_venta_id)
);
CREATE INDEX IF NOT EXISTS idx_task_seg ON public.crm_task_seguimiento(seguimiento_venta_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_task_seguimiento TO authenticated;
GRANT ALL ON public.crm_task_seguimiento TO service_role;
ALTER TABLE public.crm_task_seguimiento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view task_seg" ON public.crm_task_seguimiento FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage task_seg" ON public.crm_task_seguimiento FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'sales'::app_role) OR has_role(auth.uid(),'customer_service'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'sales'::app_role) OR has_role(auth.uid(),'customer_service'::app_role));

-- Migrate existing links if columns exist
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='crm_activities' AND column_name='seguimiento_venta_id') THEN
    INSERT INTO public.crm_activity_seguimiento (activity_id, seguimiento_venta_id)
    SELECT id, seguimiento_venta_id FROM public.crm_activities WHERE seguimiento_venta_id IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='crm_tasks' AND column_name='seguimiento_venta_id') THEN
    INSERT INTO public.crm_task_seguimiento (task_id, seguimiento_venta_id)
    SELECT id, seguimiento_venta_id FROM public.crm_tasks WHERE seguimiento_venta_id IS NOT NULL
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- 2) Motivos de perdida
CREATE TABLE IF NOT EXISTS public.motivos_perdida (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('total','parcial')),
  color text NOT NULL DEFAULT '#ef4444',
  activo boolean NOT NULL DEFAULT true,
  orden integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_motivo_perdida UNIQUE (tipo, nombre)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.motivos_perdida TO authenticated;
GRANT ALL ON public.motivos_perdida TO service_role;
ALTER TABLE public.motivos_perdida ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view motivos_perdida" ON public.motivos_perdida FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage motivos_perdida" ON public.motivos_perdida FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'sales'::app_role) OR has_role(auth.uid(),'customer_service'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'sales'::app_role) OR has_role(auth.uid(),'customer_service'::app_role));

CREATE TRIGGER trg_motivos_perdida_updated_at BEFORE UPDATE ON public.motivos_perdida
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.motivos_perdida (nombre, tipo, orden) VALUES
  ('Cambió de proveedor','total',1),
  ('Cerró / dejó de operar','total',2),
  ('Ya no maneja la marca','total',3),
  ('Sin disponibilidad de producto','total',4),
  ('Precio','parcial',1),
  ('Disponibilidad','parcial',2),
  ('Tiempo de entrega','parcial',3),
  ('Crédito / cobranza','parcial',4)
ON CONFLICT (tipo, nombre) DO NOTHING;

-- 3) Marca de perdida en seguimiento_ventas
ALTER TABLE public.seguimiento_ventas
  ADD COLUMN IF NOT EXISTS perdido boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_perdida_id uuid REFERENCES public.motivos_perdida(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fecha_perdida date,
  ADD COLUMN IF NOT EXISTS nota_perdida text;

-- 4) Bitacora seguimiento_perdidas
CREATE TABLE IF NOT EXISTS public.seguimiento_perdidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seguimiento_venta_id uuid NOT NULL REFERENCES public.seguimiento_ventas(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('total','parcial')),
  motivo_id uuid REFERENCES public.motivos_perdida(id) ON DELETE SET NULL,
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  unidades_estimadas numeric,
  nota text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_seg_perdidas ON public.seguimiento_perdidas(seguimiento_venta_id, fecha DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seguimiento_perdidas TO authenticated;
GRANT ALL ON public.seguimiento_perdidas TO service_role;
ALTER TABLE public.seguimiento_perdidas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated view seg_perdidas" ON public.seguimiento_perdidas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff manage seg_perdidas" ON public.seguimiento_perdidas FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'sales'::app_role) OR has_role(auth.uid(),'customer_service'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role) OR has_role(auth.uid(),'sales'::app_role) OR has_role(auth.uid(),'customer_service'::app_role));
