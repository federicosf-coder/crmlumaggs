
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS industrias text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS equipo text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tipo_destino_lubricante text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS potencial_unidades text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tomador_decision text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS riesgo_cambio_marca text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS origen_contacto text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS evaluacion_lubricante text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS rol_lubricante text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tipo_cliente_comercial text DEFAULT NULL;
