UPDATE public.credit_doc_templates
SET contenido_html = REPLACE(
  contenido_html,
  '<thead><tr><th style="width:70%;text-align:left">Nombre accionistas</th><th style="width:30%;text-align:right">No. acciones</th></tr></thead>',
  '<thead><tr><th style="width:70% !important;text-align:left !important">Nombre accionistas</th><th style="width:30% !important;text-align:right !important">No. acciones</th></tr></thead>'
),
updated_at = now()
WHERE key = 'solicitud' AND entidad = 'lumaggs';