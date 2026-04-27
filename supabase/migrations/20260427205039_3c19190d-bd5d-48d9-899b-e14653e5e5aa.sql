-- 1. Migrar plantillas legacy a la nueva tabla templates (tipo whatsapp)
INSERT INTO public.templates (name, type, category, body, is_active, created_by, created_at, updated_at)
SELECT
  wmt.nombre,
  'whatsapp'::template_type,
  wmt.tipo::template_category,
  wmt.mensaje,
  wmt.activo,
  wmt.created_by,
  wmt.created_at,
  wmt.updated_at
FROM public.whatsapp_message_templates wmt
WHERE NOT EXISTS (
  SELECT 1 FROM public.templates t
  WHERE t.type = 'whatsapp'::template_type
    AND lower(t.name) = lower(wmt.nombre)
);

-- 2. Eliminar tabla legacy
DROP TABLE IF EXISTS public.whatsapp_message_templates CASCADE;