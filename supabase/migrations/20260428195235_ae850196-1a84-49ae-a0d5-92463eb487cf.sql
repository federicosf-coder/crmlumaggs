ALTER TABLE public.whatsapp_templates
  ADD COLUMN IF NOT EXISTS variable_map jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.whatsapp_templates
  ADD COLUMN IF NOT EXISTS source_body text;

COMMENT ON COLUMN public.whatsapp_templates.variable_map IS
  'Array ordenado de placeholders nombrados. Index 0 = {{1}}, etc.';
COMMENT ON COLUMN public.whatsapp_templates.source_body IS
  'Cuerpo original con placeholders nombrados ({nombre_cliente}); se convierte a {{n}} al enviar a Meta.';