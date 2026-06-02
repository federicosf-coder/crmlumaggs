-- Catálogo de estatus para el módulo de Seguimiento a Ventas
CREATE TABLE IF NOT EXISTS public.seguimiento_estatus_catalogo (
  id          uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ambito      text NOT NULL CHECK (ambito IN ('con_venta','sin_venta')),
  familia     text NOT NULL CHECK (familia IN ('riesgo','ritmo','gestion')),
  nombre      text NOT NULL,
  color       text NOT NULL DEFAULT '#6b7280',
  unidad      text NOT NULL CHECK (unidad IN ('multiplo_ciclo','porcentaje','dias')),
  umbral_min  numeric,
  umbral_max  numeric,
  es_urgente  boolean NOT NULL DEFAULT false,
  orden       integer NOT NULL DEFAULT 0,
  activo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_seg_estatus UNIQUE (ambito, familia, nombre)
);

GRANT SELECT ON public.seguimiento_estatus_catalogo TO authenticated;
GRANT ALL ON public.seguimiento_estatus_catalogo TO service_role;

CREATE INDEX IF NOT EXISTS idx_seg_estatus_lookup
  ON public.seguimiento_estatus_catalogo (ambito, familia, orden) WHERE activo;

ALTER TABLE public.seguimiento_estatus_catalogo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated view seg estatus" ON public.seguimiento_estatus_catalogo;
CREATE POLICY "Authenticated view seg estatus"
  ON public.seguimiento_estatus_catalogo FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage seg estatus" ON public.seguimiento_estatus_catalogo;
CREATE POLICY "Admins manage seg estatus"
  ON public.seguimiento_estatus_catalogo FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'manager'::app_role));

DROP TRIGGER IF EXISTS trg_seg_estatus_updated ON public.seguimiento_estatus_catalogo;
CREATE TRIGGER trg_seg_estatus_updated
  BEFORE UPDATE ON public.seguimiento_estatus_catalogo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.seguimiento_estatus_catalogo
  (ambito, familia, nombre, color, unidad, umbral_min, umbral_max, es_urgente, orden) VALUES
  ('con_venta','riesgo','En ritmo',      '#10b981','multiplo_ciclo', 0,    1.0,  false, 1),
  ('con_venta','riesgo','Por contactar', '#f59e0b','multiplo_ciclo', 1.0,  1.5,  false, 2),
  ('con_venta','riesgo','En riesgo',     '#f97316','multiplo_ciclo', 1.5,  2.5,  true,  3),
  ('con_venta','riesgo','Dormido',       '#ef4444','multiplo_ciclo', 2.5,  NULL, true,  4),
  ('con_venta','ritmo','Urgente',        '#ef4444','porcentaje', 0,   25,   true,  1),
  ('con_venta','ritmo','Atrasado',       '#f97316','porcentaje', 25,  50,   false, 2),
  ('con_venta','ritmo','Activo',         '#f59e0b','porcentaje', 50,  75,   false, 3),
  ('con_venta','ritmo','En ritmo',       '#84cc16','porcentaje', 75,  100,  false, 4),
  ('con_venta','ritmo','Meta cumplida',  '#10b981','porcentaje', 100, NULL, false, 5),
  ('sin_venta','gestion','En gestión',   '#10b981','dias', 0,   14,   false, 1),
  ('sin_venta','gestion','Por reactivar','#f59e0b','dias', 14,  45,   false, 2),
  ('sin_venta','gestion','Frío',         '#f97316','dias', 45,  90,   true,  3),
  ('sin_venta','gestion','Descartado',   '#ef4444','dias', 90,  NULL, true,  4)
ON CONFLICT (ambito, familia, nombre) DO NOTHING;