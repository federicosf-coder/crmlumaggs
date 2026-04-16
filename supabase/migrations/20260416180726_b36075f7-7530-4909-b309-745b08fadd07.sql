-- Add coordinates to documentos for delivery location tracking
ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS direccion_envio_lat numeric,
  ADD COLUMN IF NOT EXISTS direccion_envio_lng numeric;

-- Create bitácora table for address change traceability
CREATE TABLE IF NOT EXISTS public.documento_direccion_bitacora (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL,
  direccion_anterior text,
  direccion_nueva text NOT NULL,
  latitud numeric,
  longitud numeric,
  origen text NOT NULL DEFAULT 'manual',
  usuario_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.documento_direccion_bitacora ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view bitacora direccion"
  ON public.documento_direccion_bitacora FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can manage bitacora direccion"
  ON public.documento_direccion_bitacora FOR ALL USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Managers can manage bitacora direccion"
  ON public.documento_direccion_bitacora FOR ALL USING (has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "Sales can manage bitacora direccion"
  ON public.documento_direccion_bitacora FOR ALL USING (has_role(auth.uid(),'sales'::app_role));
CREATE POLICY "Delivery can manage bitacora direccion"
  ON public.documento_direccion_bitacora FOR ALL USING (has_role(auth.uid(),'delivery'::app_role));
CREATE POLICY "Warehouse can manage bitacora direccion"
  ON public.documento_direccion_bitacora FOR ALL USING (has_role(auth.uid(),'warehouse'::app_role));

CREATE INDEX IF NOT EXISTS idx_bitacora_direccion_doc ON public.documento_direccion_bitacora(documento_id);