UPDATE public.credit_doc_templates
SET contenido_html = replace(contenido_html, E'\\n', '')
WHERE key = 'solicitud' AND entidad IN ('lumaggs','galsa');
