
-- Enums
CREATE TYPE public.empresa_vendedora AS ENUM ('lumaggs_chevron', 'galsa_phillips66');
CREATE TYPE public.tipo_documento AS ENUM ('cotizacion', 'pedido', 'factura');
CREATE TYPE public.estatus_cotizacion AS ENUM ('borrador', 'enviada', 'aceptada', 'rechazada', 'vencida');
CREATE TYPE public.estatus_pedido AS ENUM ('pendiente', 'confirmado', 'en_proceso', 'enviado', 'entregado', 'cancelado');
CREATE TYPE public.estatus_factura AS ENUM ('pendiente', 'pagada', 'parcial', 'vencida', 'cancelada');
CREATE TYPE public.tipo_pago AS ENUM ('contado', 'credito', 'credito_cescemex');
CREATE TYPE public.uso_cfdi AS ENUM ('G01', 'G02', 'G03', 'I01', 'I02', 'I03', 'I04', 'I05', 'I06', 'I07', 'I08', 'D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10', 'P01', 'S01', 'CP01', 'CN01');
CREATE TYPE public.metodo_pago_sat AS ENUM ('PUE', 'PPD');

-- Plazas
CREATE TABLE public.plazas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.plazas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view plazas" ON public.plazas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage plazas" ON public.plazas FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers can manage plazas" ON public.plazas FOR ALL USING (has_role(auth.uid(), 'manager'::app_role));
CREATE TRIGGER update_plazas_updated_at BEFORE UPDATE ON public.plazas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Documentos
CREATE TABLE public.documentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_vendedora empresa_vendedora NOT NULL,
  plaza_id UUID REFERENCES public.plazas(id),
  tipo_documento tipo_documento NOT NULL DEFAULT 'cotizacion',
  created_by UUID,
  ejecutivo_venta_id UUID,
  empresa_id UUID REFERENCES public.companies(id),
  contacto_id UUID REFERENCES public.contacts(id),
  fecha_documento DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE,
  iva_porcentaje NUMERIC NOT NULL DEFAULT 16,
  numero_cotizacion TEXT,
  numero_pedido TEXT,
  numero_factura TEXT,
  estatus_cotizacion estatus_cotizacion DEFAULT 'borrador',
  estatus_pedido estatus_pedido,
  estatus_factura estatus_factura,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  iva_importe NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  unidades_equivalentes_total NUMERIC NOT NULL DEFAULT 0,
  negocio_crm TEXT,
  notas TEXT,
  pdf_url TEXT,
  numero_oc_cliente TEXT,
  direccion_envio TEXT,
  cotizacion_original_id UUID REFERENCES public.documentos(id),
  tipo_pago tipo_pago,
  uso_cfdi uso_cfdi,
  metodo_pago metodo_pago_sat,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view documentos" ON public.documentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage documentos" ON public.documentos FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers can manage documentos" ON public.documentos FOR ALL USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Sales can manage documentos" ON public.documentos FOR ALL USING (has_role(auth.uid(), 'sales'::app_role));
CREATE TRIGGER update_documentos_updated_at BEFORE UPDATE ON public.documentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Documento Productos (line items)
CREATE TABLE public.documento_productos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  documento_id UUID NOT NULL REFERENCES public.documentos(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES public.productos(id),
  cantidad NUMERIC NOT NULL DEFAULT 1,
  precio_unitario NUMERIC NOT NULL DEFAULT 0,
  descuento_porcentaje NUMERIC NOT NULL DEFAULT 0,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  unidades_equivalentes NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.documento_productos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view doc products" ON public.documento_productos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage doc products" ON public.documento_productos FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers can manage doc products" ON public.documento_productos FOR ALL USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Sales can manage doc products" ON public.documento_productos FOR ALL USING (has_role(auth.uid(), 'sales'::app_role));

-- Storage bucket for PDFs and delivery photos
INSERT INTO storage.buckets (id, name, public) VALUES ('document-files', 'document-files', true);
CREATE POLICY "Authenticated can upload doc files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'document-files');
CREATE POLICY "Anyone can view doc files" ON storage.objects FOR SELECT USING (bucket_id = 'document-files');
CREATE POLICY "Authenticated can update doc files" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'document-files');
CREATE POLICY "Authenticated can delete doc files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'document-files');

-- Fotos de entrega
CREATE TABLE public.documento_fotos_entrega (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  documento_id UUID NOT NULL REFERENCES public.documentos(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  nombre TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.documento_fotos_entrega ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view delivery photos" ON public.documento_fotos_entrega FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage delivery photos" ON public.documento_fotos_entrega FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers can manage delivery photos" ON public.documento_fotos_entrega FOR ALL USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Sales can manage delivery photos" ON public.documento_fotos_entrega FOR ALL USING (has_role(auth.uid(), 'sales'::app_role));
