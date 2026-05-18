
ALTER TABLE public.credit_requests
  ADD COLUMN IF NOT EXISTS aval_es_distinto boolean NOT NULL DEFAULT true;

ALTER TABLE public.credit_doc_types
  ADD COLUMN IF NOT EXISTS aplica_si_aval_distinto boolean NOT NULL DEFAULT false;

INSERT INTO public.credit_doc_types
  (nombre, instrucciones_cliente, aplica_moral, aplica_fisica, aplica_cescemex, aplica_directo, requerido, sort_order, is_active, permite_multiples, aplica_si_aval_distinto)
VALUES
  ('Identificación oficial del Aval',
   'INE o pasaporte vigente del Aval / Obligado Solidario. Sube ambos lados en un solo archivo.',
   true, true, true, true, true, 110, true, false, true),
  ('Comprobante de domicilio del Aval',
   'Predial, agua, luz o teléfono. No mayor a 3 meses. A nombre del Aval / Obligado Solidario.',
   true, true, true, true, true, 120, true, true, true);
