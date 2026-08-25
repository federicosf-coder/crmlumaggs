UPDATE public.templates
SET body = replace(
      replace(
        body,
        'Buen día, {ejecutivo} de su apoyo con autorización de precio',
        'Buen día, de su apoyo con autorización de precio'
      ),
      '<hr style="border:none;border-top:1px solid #e5e7eb;margin:14px 0;">',
      '<p style="margin:0 0 14px;"><strong>Ejecutivo:</strong> {ejecutivo}</p><hr style="border:none;border-top:1px solid #e5e7eb;margin:14px 0;">'
    ),
    updated_at = now()
WHERE system_key = 'autorizacion_precio';