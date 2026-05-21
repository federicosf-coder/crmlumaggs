UPDATE public.credit_doc_templates
SET contenido_html = REPLACE(
                       REPLACE(
                         REPLACE(contenido_html, '#1a3e6e', '#b91c1c'),
                         '#dce6f1', '#fde8e8'
                       ),
                       'storage/v1/object/public/logos/lumaggs.png',
                       'storage/v1/object/public/logos/phillips66.png'
                     ),
    updated_at = now()
WHERE key = 'solicitud' AND entidad = 'galsa';