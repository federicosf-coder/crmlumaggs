UPDATE public.credit_doc_templates
SET contenido_html = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
  contenido_html,
  '<tr><th>Nombre comercial</th><td>{{nombre_comercial}}</td><th style="width:11%">RFC</th><td style="width:22%">{{rfc}}</td></tr>',
  '<tr><th style="width:18%">Nombre comercial</th><td>{{nombre_comercial}}</td><th style="width:13%">RFC</th><td style="width:22%">{{rfc}}</td></tr>'
),
  '<tr><th>Teléfono(s)</th><td>{{telefono}}</td><th>Correo</th><td>{{correo}}</td></tr>',
  '<tr><th style="width:18%">Teléfono(s)</th><td>{{telefono}}</td><th style="width:13%">Correo</th><td>{{correo}}</td></tr>'
),
  '<tr><th>Ciudad / Estado</th><td>{{ciudad}} / {{estado}}</td><th>Antigüedad</th><td>{{antiguedad}}</td></tr>',
  '<tr><th style="width:18%">Ciudad / Estado</th><td>{{ciudad}} / {{estado}}</td><th style="width:13%">Antigüedad</th><td>{{antiguedad}}</td></tr>'
),
  '<tr><th>Ciudad</th><td>{{municipio}}</td><th>Giro comercial</th><td>{{giro_comercial}}</td></tr>',
  '<tr><th style="width:18%">Ciudad</th><td>{{municipio}}</td><th style="width:13%">Giro comercial</th><td>{{giro_comercial}}</td></tr>'
),
  '<tr><th>Monto de crédito</th><td>{{monto_credito}}</td><th>Días de crédito</th><td>{{dias_credito}}</td></tr>',
  '<tr><th style="width:18%">Monto de crédito</th><td>{{monto_credito}}</td><th style="width:13%">Días de crédito</th><td>{{dias_credito}}</td></tr>'
),
  '<tr><th>Ciudad</th><td>{{aval_ciudad}}</td><th>Relación con el solicitante</th><td>{{aval_relacion}}</td></tr>',
  '<tr><th style="width:18%">Ciudad</th><td>{{aval_ciudad}}</td><th style="width:22%">Relación con el solicitante</th><td>{{aval_relacion}}</td></tr>'
),
updated_at = now()
WHERE key='solicitud' AND entidad='lumaggs';