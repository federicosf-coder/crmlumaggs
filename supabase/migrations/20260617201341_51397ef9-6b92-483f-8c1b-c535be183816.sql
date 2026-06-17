-- Tablas para registrar solicitudes de cotización de clientes desde WhatsApp / panel
CREATE TABLE public.cliente_solicitudes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  contacto_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  whatsapp_conversation_id uuid REFERENCES public.whatsapp_conversations(id) ON DELETE SET NULL,
  empresa_vendedora text CHECK (empresa_vendedora IN ('lumaggs','galsa')),
  titulo text,
  estatus text NOT NULL DEFAULT 'abierta' CHECK (estatus IN ('abierta','cotizada','cerrada')),
  documento_id uuid REFERENCES public.documentos(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_solicitudes TO authenticated;
GRANT ALL ON public.cliente_solicitudes TO service_role;
ALTER TABLE public.cliente_solicitudes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth select cliente_solicitudes"
  ON public.cliente_solicitudes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert cliente_solicitudes"
  ON public.cliente_solicitudes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update cliente_solicitudes"
  ON public.cliente_solicitudes FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Admin/Manager delete cliente_solicitudes"
  ON public.cliente_solicitudes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'manager'::app_role));

CREATE TRIGGER update_cliente_solicitudes_updated_at
  BEFORE UPDATE ON public.cliente_solicitudes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_cliente_solicitudes_empresa ON public.cliente_solicitudes(empresa_id);

-- Líneas de productos por solicitud
CREATE TABLE public.cliente_solicitud_lineas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id uuid NOT NULL REFERENCES public.cliente_solicitudes(id) ON DELETE CASCADE,
  producto_id uuid NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  cantidad numeric NOT NULL DEFAULT 1,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_solicitud_lineas TO authenticated;
GRANT ALL ON public.cliente_solicitud_lineas TO service_role;
ALTER TABLE public.cliente_solicitud_lineas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth select cliente_solicitud_lineas"
  ON public.cliente_solicitud_lineas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth insert cliente_solicitud_lineas"
  ON public.cliente_solicitud_lineas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth update cliente_solicitud_lineas"
  ON public.cliente_solicitud_lineas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Auth delete cliente_solicitud_lineas"
  ON public.cliente_solicitud_lineas FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_cliente_solicitud_lineas_solicitud ON public.cliente_solicitud_lineas(solicitud_id);