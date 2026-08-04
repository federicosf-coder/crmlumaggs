CREATE TABLE IF NOT EXISTS public.automatizacion_eventos_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clave text NOT NULL UNIQUE,
  etiqueta text NOT NULL,
  categoria text NOT NULL CHECK (categoria IN ('cobranza','credito','seguimiento_ventas','inventario_entregas')),
  descripcion text,
  requiere_umbral boolean NOT NULL DEFAULT false,
  umbral_label text,
  umbral_default integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.automatizacion_eventos_catalogo TO authenticated;
GRANT ALL ON public.automatizacion_eventos_catalogo TO service_role;

ALTER TABLE public.automatizacion_eventos_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eventos_catalogo_select_auth" ON public.automatizacion_eventos_catalogo
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "eventos_catalogo_all_admin_mgr" ON public.automatizacion_eventos_catalogo
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));

CREATE TRIGGER trg_eventos_catalogo_updated_at
  BEFORE UPDATE ON public.automatizacion_eventos_catalogo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.automatizacion_eventos_catalogo (clave, etiqueta, categoria, requiere_umbral, umbral_label, umbral_default) VALUES
  ('cobranza_factura_vencida','Factura vencida','cobranza',false,null,null),
  ('cobranza_pago_sin_aplicar','Pago sin aplicar','cobranza',true,'Días sin aplicar',5),
  ('credito_solicitud_aprobada','Solicitud de crédito aprobada','credito',false,null,null),
  ('credito_solicitud_rechazada','Solicitud de crédito rechazada','credito',false,null,null),
  ('credito_documento_faltante','Documento faltante en checklist','credito',true,'Días sin completar',3),
  ('seguimiento_riesgo_critico','Riesgo crítico en seguimiento','seguimiento_ventas',false,null,null),
  ('seguimiento_ritmo_critico','Ritmo crítico/dormido','seguimiento_ventas',false,null,null),
  ('seguimiento_recompra_vencida','Recompra vencida','seguimiento_ventas',false,null,null),
  ('inventario_costos_pendiente','Archivo de costos pendiente de autorización','inventario_entregas',true,'Días pendiente',2),
  ('entrega_sin_confirmar','Entrega sin confirmar','inventario_entregas',true,'Horas sin confirmar',24)
ON CONFLICT (clave) DO NOTHING;

ALTER TABLE public.automatizacion_ejecuciones
  ADD COLUMN IF NOT EXISTS entidad_tipo text,
  ADD COLUMN IF NOT EXISTS entidad_id uuid,
  ADD COLUMN IF NOT EXISTS evento_clave text;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_ejecucion_automatizacion_entidad_evento
  ON public.automatizacion_ejecuciones (automatizacion_id, entidad_id, evento_clave)
  WHERE entidad_id IS NOT NULL;