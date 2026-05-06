ALTER TABLE public.documentos ADD COLUMN IF NOT EXISTS fecha_entrega_real date;

CREATE TABLE IF NOT EXISTS public.documento_orden_compra_archivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL REFERENCES public.documentos(id) ON DELETE CASCADE,
  url_archivo text NOT NULL,
  nombre_archivo text NOT NULL,
  tipo_archivo text NOT NULL,
  usuario_carga uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  fecha_carga timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_doc_oc_doc ON public.documento_orden_compra_archivos(documento_id);
ALTER TABLE public.documento_orden_compra_archivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view doc_oc" ON public.documento_orden_compra_archivos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage doc_oc" ON public.documento_orden_compra_archivos FOR ALL USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Manager manage doc_oc" ON public.documento_orden_compra_archivos FOR ALL USING (has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "Sales manage doc_oc" ON public.documento_orden_compra_archivos FOR ALL USING (has_role(auth.uid(),'sales'::app_role));
CREATE POLICY "Warehouse manage doc_oc" ON public.documento_orden_compra_archivos FOR ALL USING (has_role(auth.uid(),'warehouse'::app_role));
CREATE POLICY "Delivery manage doc_oc" ON public.documento_orden_compra_archivos FOR ALL USING (has_role(auth.uid(),'delivery'::app_role));

CREATE TABLE IF NOT EXISTS public.documento_acuse_archivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL REFERENCES public.documentos(id) ON DELETE CASCADE,
  url_archivo text NOT NULL,
  nombre_archivo text NOT NULL,
  tipo_archivo text NOT NULL,
  usuario_carga uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  fecha_carga timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_doc_acuse_doc ON public.documento_acuse_archivos(documento_id);
ALTER TABLE public.documento_acuse_archivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth view doc_acuse" ON public.documento_acuse_archivos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage doc_acuse" ON public.documento_acuse_archivos FOR ALL USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Manager manage doc_acuse" ON public.documento_acuse_archivos FOR ALL USING (has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "Sales manage doc_acuse" ON public.documento_acuse_archivos FOR ALL USING (has_role(auth.uid(),'sales'::app_role));
CREATE POLICY "Warehouse manage doc_acuse" ON public.documento_acuse_archivos FOR ALL USING (has_role(auth.uid(),'warehouse'::app_role));
CREATE POLICY "Delivery manage doc_acuse" ON public.documento_acuse_archivos FOR ALL USING (has_role(auth.uid(),'delivery'::app_role));

INSERT INTO public.template_placeholders (key, label, description, source_table, source_field, example_value, applies_to, sort_order) VALUES
  ('{fecha_entrega_real}', 'Fecha de entrega real', 'Fecha real de entrega del documento corporativo', 'documentos', 'fecha_entrega_real', '15/05/2026', 'ambos', 180),
  ('{orden_compra_url}', 'URL Orden de compra', 'Liga al primer archivo de orden de compra adjunto', 'documento_orden_compra_archivos', 'url_archivo', 'https://...', 'email', 190),
  ('{acuse_url}', 'URL Comprobante acuse', 'Liga al primer archivo de comprobante acuse adjunto', 'documento_acuse_archivos', 'url_archivo', 'https://...', 'email', 200)
ON CONFLICT (key) DO NOTHING;