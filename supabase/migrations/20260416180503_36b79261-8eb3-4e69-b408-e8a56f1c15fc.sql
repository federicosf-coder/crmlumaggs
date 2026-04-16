-- Tabla para múltiples archivos firmados por documento (entrega)
CREATE TABLE public.documento_archivos_firmados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  documento_id UUID NOT NULL,
  tipo_archivo TEXT NOT NULL,
  nombre_archivo TEXT NOT NULL,
  url_archivo TEXT NOT NULL,
  fecha_carga TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  usuario_carga UUID
);

CREATE INDEX idx_doc_arch_firmados_documento ON public.documento_archivos_firmados(documento_id);

ALTER TABLE public.documento_archivos_firmados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view archivos firmados"
ON public.documento_archivos_firmados FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage archivos firmados"
ON public.documento_archivos_firmados FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can manage archivos firmados"
ON public.documento_archivos_firmados FOR ALL
USING (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Sales can manage archivos firmados"
ON public.documento_archivos_firmados FOR ALL
USING (has_role(auth.uid(), 'sales'::app_role));

CREATE POLICY "Delivery can manage archivos firmados"
ON public.documento_archivos_firmados FOR ALL
USING (has_role(auth.uid(), 'delivery'::app_role));

CREATE POLICY "Warehouse can manage archivos firmados"
ON public.documento_archivos_firmados FOR ALL
USING (has_role(auth.uid(), 'warehouse'::app_role));