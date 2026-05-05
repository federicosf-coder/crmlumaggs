ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS system_key TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_templates_system_key ON public.templates (system_key) WHERE system_key IS NOT NULL;

INSERT INTO public.templates (name, type, category, subject, body, description, is_active, system_key)
VALUES
('Notificación de Pago Registrado', 'email', 'pago',
 'Pago registrado – {nombre_cliente} por {monto_pago}',
 '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
  <h1 style="font-size:22px;margin:0 0 16px">Pago registrado</h1>
  <p style="font-size:14px;color:#475569;line-height:1.6">Se ha registrado un nuevo pago de <strong>{nombre_cliente}</strong>{registrado_por} por <strong>{registrado_por}</strong>{/registrado_por}.</p>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin:8px 0">
    <p style="margin:6px 0;font-size:13px"><strong>Cliente:</strong> {nombre_cliente}</p>
    <p style="margin:6px 0;font-size:13px"><strong>Monto:</strong> {monto_pago}</p>
    <p style="margin:6px 0;font-size:13px"><strong>Fecha de pago:</strong> {fecha_pago}</p>
    <p style="margin:6px 0;font-size:13px"><strong>Forma de pago:</strong> {tipo_pago}</p>
    <p style="margin:6px 0;font-size:13px"><strong>Referencia:</strong> {referencia_pago}</p>
    <p style="margin:6px 0;font-size:13px"><strong>Banco:</strong> {banco}</p>
  </div>
  <h2 style="font-size:15px;margin:24px 0 8px">Observaciones</h2>
  <p style="font-size:14px;color:#475569;line-height:1.6">{observaciones}</p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
  <p style="font-size:12px;color:#94a3b8">Registrado por {registrado_por}.</p>
</div>',
 'Email enviado a contabilidad cuando se registra un pago en cobranza.',
 true, 'pago_registrado_contabilidad'),
('Pago Validado', 'email', 'pago',
 'Pago validado – {nombre_cliente}',
 '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
  <h1 style="font-size:22px;margin:0 0 16px">Pago validado</h1>
  <p style="font-size:14px;color:#475569;line-height:1.6">El pago de <strong>{nombre_cliente}</strong> ha sido validado.</p>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin:8px 0">
    <p style="margin:6px 0;font-size:13px"><strong>Cliente:</strong> {nombre_cliente}</p>
    <p style="margin:6px 0;font-size:13px"><strong>Monto:</strong> {monto_pago}</p>
    <p style="margin:6px 0;font-size:13px"><strong>Fecha de pago:</strong> {fecha_pago}</p>
    <p style="margin:6px 0;font-size:13px"><strong>Forma de pago:</strong> {tipo_pago}</p>
    <p style="margin:6px 0;font-size:13px"><strong>Referencia:</strong> {referencia_pago}</p>
    <p style="margin:6px 0;font-size:13px"><strong>Banco:</strong> {banco}</p>
  </div>
  <h2 style="font-size:15px;margin:24px 0 8px">Observaciones</h2>
  <p style="font-size:14px;color:#475569;line-height:1.6">{observaciones}</p>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0" />
  <p style="font-size:12px;color:#94a3b8">Validado por {registrado_por}.</p>
</div>',
 'Email enviado al notificar la validación de un pago.',
 true, 'pago_validado_notificacion')
ON CONFLICT (system_key) DO UPDATE SET
  subject = EXCLUDED.subject,
  body = EXCLUDED.body;