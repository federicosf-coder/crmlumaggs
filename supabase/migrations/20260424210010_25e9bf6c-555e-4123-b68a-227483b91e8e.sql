-- 1) Catálogo de plantillas WhatsApp LOCALES (separado de whatsapp_templates de Meta)
CREATE TABLE IF NOT EXISTS public.whatsapp_message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('seguimiento_cotizacion','recompra','expansion','prospecto','cobranza','entrega','general')),
  mensaje TEXT NOT NULL,
  meta_template_id UUID REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  activo BOOLEAN NOT NULL DEFAULT true,
  orden INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_msg_templates_tipo ON public.whatsapp_message_templates(tipo) WHERE activo = true;

ALTER TABLE public.whatsapp_message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view whatsapp_message_templates"
  ON public.whatsapp_message_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage whatsapp_message_templates"
  ON public.whatsapp_message_templates FOR ALL USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Managers manage whatsapp_message_templates"
  ON public.whatsapp_message_templates FOR ALL USING (has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "Sales manage whatsapp_message_templates"
  ON public.whatsapp_message_templates FOR ALL USING (has_role(auth.uid(),'sales'::app_role));

CREATE TRIGGER trg_whatsapp_message_templates_updated_at
  BEFORE UPDATE ON public.whatsapp_message_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Estado WhatsApp en tareas CRM
DO $$ BEGIN
  CREATE TYPE public.whatsapp_task_status AS ENUM ('pendiente','enviado','respondido','no_respondio');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.crm_tasks
  ADD COLUMN IF NOT EXISTS mensaje_sugerido TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_status public.whatsapp_task_status NOT NULL DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS whatsapp_last_sent_at TIMESTAMPTZ;

-- 3) Estado follow-up cotización en documentos (solo cotización)
DO $$ BEGIN
  CREATE TYPE public.cotizacion_followup_status AS ENUM ('enviada','seguimiento_1','seguimiento_2','seguimiento_3','vencida','sin_actividad');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS follow_up_status public.cotizacion_followup_status NOT NULL DEFAULT 'sin_actividad',
  ADD COLUMN IF NOT EXISTS whatsapp_last_sent_at TIMESTAMPTZ;

-- 4) Seed de plantillas básicas
INSERT INTO public.whatsapp_message_templates (nombre, tipo, mensaje, orden) VALUES
('Seguimiento cotización inicial','seguimiento_cotizacion',
 'Hola {{contacto_nombre}}, soy {{ejecutivo_nombre}} de {{empresa_vendedora}}. Te comparto la cotización {{folio_cotizacion}} por un total de {{total_cotizacion}}. Quedo atento a cualquier duda.', 1),
('Seguimiento cotización 1','seguimiento_cotizacion',
 'Hola {{contacto_nombre}}, ¿pudiste revisar la cotización {{folio_cotizacion}}? Quedo atento para resolver cualquier duda.', 2),
('Seguimiento cotización 2','seguimiento_cotizacion',
 'Hola {{contacto_nombre}}, quería confirmar si seguimos avanzando con la cotización {{folio_cotizacion}}. Si necesitas ajustes, con gusto los preparamos.', 3),
('Cotización por vencer','seguimiento_cotizacion',
 'Hola {{contacto_nombre}}, la cotización {{folio_cotizacion}} vence el {{fecha_vencimiento}}. ¿Te gustaría que apartemos producto o ajustemos condiciones?', 4),
('Recompra próxima','recompra',
 'Hola {{contacto_nombre}}, buen día. Te escribo para revisar si ya necesitas programar tu próximo pedido de {{producto_categoria}}. Quedo atento.', 1),
('Recompra vencida','recompra',
 'Hola {{contacto_nombre}}, hace tiempo no tenemos pedido de {{producto_categoria}}. ¿Podemos agendar una llamada para apoyarte con tu próximo abasto?', 2),
('Expansión cross-sell','expansion',
 'Hola {{contacto_nombre}}, revisando sus compras vimos que actualmente manejan {{producto_categoria}}. También podemos apoyarles con líneas complementarias para optimizar su operación.', 1),
('Prospecto inicial','prospecto',
 'Hola {{contacto_nombre}}, soy {{ejecutivo_nombre}} de {{empresa_vendedora}}. Me gustaría conocer sus necesidades de lubricantes para preparar una propuesta a su medida.', 1),
('Cobranza recordatorio','cobranza',
 'Hola {{contacto_nombre}}, te recuerdo amablemente la factura {{folio_cotizacion}} con vencimiento {{fecha_vencimiento}}. Cualquier comprobante de pago lo podemos procesar enseguida.', 1),
('Confirmación entrega','entrega',
 'Hola {{contacto_nombre}}, tu pedido {{folio_cotizacion}} está programado para entrega. ¿Puedes confirmarnos un horario de recepción?', 1)
ON CONFLICT DO NOTHING;