
CREATE TABLE public.rvs_reportes_intake (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  marca text,
  anio_mes text,
  fecha_recibido timestamptz NOT NULL DEFAULT now(),
  storage_path text,
  mime_type text,
  remitente_email text,
  asunto_email text,
  resend_email_id text,
  estatus text NOT NULL DEFAULT 'pendiente' CHECK (estatus IN ('pendiente','procesado','error')),
  payload_extraido jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rvs_reportes_intake TO authenticated;
GRANT ALL ON public.rvs_reportes_intake TO service_role;
ALTER TABLE public.rvs_reportes_intake ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rvs_intake_auth_all" ON public.rvs_reportes_intake FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.rvs_ventas_mes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id uuid NOT NULL REFERENCES public.rvs_personas(id) ON DELETE CASCADE,
  anio_mes text NOT NULL,
  marca text NOT NULL CHECK (marca IN ('galsa','lumaggs')),
  unidades numeric NOT NULL DEFAULT 0,
  venta numeric NOT NULL DEFAULT 0,
  costo numeric NOT NULL DEFAULT 0,
  utilidad numeric NOT NULL DEFAULT 0,
  margen numeric,
  plaza_id uuid REFERENCES public.plazas(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (persona_id, anio_mes, marca)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rvs_ventas_mes TO authenticated;
GRANT ALL ON public.rvs_ventas_mes TO service_role;
ALTER TABLE public.rvs_ventas_mes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rvs_ventas_mes_auth_all" ON public.rvs_ventas_mes FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.rvs_ventas_mes_plaza (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plaza_id uuid REFERENCES public.plazas(id) ON DELETE SET NULL,
  sucursal_reporte text,
  anio_mes text NOT NULL,
  marca text NOT NULL CHECK (marca IN ('galsa','lumaggs')),
  unidades numeric NOT NULL DEFAULT 0,
  venta numeric NOT NULL DEFAULT 0,
  costo numeric NOT NULL DEFAULT 0,
  utilidad numeric NOT NULL DEFAULT 0,
  margen numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plaza_id, anio_mes, marca)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rvs_ventas_mes_plaza TO authenticated;
GRANT ALL ON public.rvs_ventas_mes_plaza TO service_role;
ALTER TABLE public.rvs_ventas_mes_plaza ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rvs_ventas_mes_plaza_auth_all" ON public.rvs_ventas_mes_plaza FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_rvs_reportes_intake_updated BEFORE UPDATE ON public.rvs_reportes_intake FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_rvs_ventas_mes_updated BEFORE UPDATE ON public.rvs_ventas_mes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_rvs_ventas_mes_plaza_updated BEFORE UPDATE ON public.rvs_ventas_mes_plaza FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "rvs_reportes_auth_read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'rvs-reportes');
CREATE POLICY "rvs_reportes_auth_write" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'rvs-reportes');
