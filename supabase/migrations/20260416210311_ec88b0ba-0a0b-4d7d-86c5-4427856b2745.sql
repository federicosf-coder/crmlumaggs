-- 1) Enum para estatus de pago
DO $$ BEGIN
  CREATE TYPE public.estatus_pago_cobranza AS ENUM ('recibido', 'enviado_validar', 'validado', 'aplicado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Columna en cobranza_pagos
ALTER TABLE public.cobranza_pagos
  ADD COLUMN IF NOT EXISTS estatus_pago public.estatus_pago_cobranza NOT NULL DEFAULT 'recibido';

-- 3) Asegurar 3 grupos de correo default
INSERT INTO public.email_groups (nombre, descripcion, is_active)
SELECT v.nombre, v.descripcion, true
FROM (VALUES
  ('Cobranza Contado', 'Destinatarios para validación de pagos de contado'),
  ('Cobranza Crédito Directo', 'Destinatarios para validación de pagos de crédito directo'),
  ('Cobranza Cescemex', 'Destinatarios para validación de pagos de crédito Cescemex')
) AS v(nombre, descripcion)
WHERE NOT EXISTS (SELECT 1 FROM public.email_groups eg WHERE eg.nombre = v.nombre);