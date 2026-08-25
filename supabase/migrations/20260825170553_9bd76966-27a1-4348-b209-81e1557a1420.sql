UPDATE public.templates
SET body = '<div style="font-family:Arial,sans-serif;font-size:14px;color:#1f2937;line-height:1.45;max-width:640px;">
<h2 style="margin:0 0 8px;font-size:17px;">Apoyo con autorización de precio</h2>
<p style="margin:0 0 14px;">Buen día, {ejecutivo} de su apoyo con autorización de precio para el cliente <strong>{cliente}</strong> (Razón social: {razon_social}), pedido {numero_pedido}.</p>
<h3 style="margin:0 0 4px;font-size:14px;">Productos</h3>
<div style="margin:0 0 14px;">{productos_lista}</div>
<p style="margin:0 0 4px;color:#6b7280;font-size:12px;">Costo y margen de utilidad son datos del CRM, calculados automáticamente.</p>
<h3 style="margin:0 0 4px;font-size:14px;">Histórico de compra del cliente (unidades equivalentes)</h3>
<div style="margin:0 0 6px;">{historico_lista}</div>
<p style="margin:0 0 14px;">Acumulado desde {fecha_acumulado_desde}: <strong>{acumulado_unidades}</strong> unidades &nbsp;·&nbsp; Promedio mensual: <strong>{promedio_mensual}</strong> unidades</p>
<h3 style="margin:0 0 4px;font-size:14px;">Justificación</h3>
<p style="margin:0 0 14px;white-space:pre-wrap;">{justificacion}</p>
<h3 style="margin:0 0 4px;font-size:14px;">Clasificación del cliente</h3>
<div style="margin:0 0 14px;">{clasificacion_lista}</div>
<h3 style="margin:0 0 4px;font-size:14px;">Detalles de facturación</h3>
<div style="margin:0 0 14px;">{facturacion_lista}</div>
<h3 style="margin:0 0 4px;font-size:14px;">Pedido / cotización original (PDF)</h3>
<div style="margin:0 0 14px;">{documento_pdf_lista}</div>
<h3 style="margin:0 0 4px;font-size:14px;">Evidencia adjunta</h3>
<div style="margin:0 0 14px;">{evidencias_lista}</div>
<hr style="border:none;border-top:1px solid #e5e7eb;margin:14px 0;">
<p style="margin:0;color:#6b7280;font-size:12px;">Cualquier duda o aclaración quedo a sus órdenes. Este correo fue generado por Lumaggs CRM.</p>
</div>',
updated_at = now()
WHERE system_key = 'autorizacion_precio';