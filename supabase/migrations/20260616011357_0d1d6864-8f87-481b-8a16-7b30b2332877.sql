CREATE OR REPLACE FUNCTION public.resolve_template_placeholders(
  _documento_id UUID DEFAULT NULL,
  _contacto_id UUID DEFAULT NULL,
  _pago_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_doc       documentos%ROWTYPE;
  v_company   companies%ROWTYPE;
  v_contact   contacts%ROWTYPE;
  v_ejecutivo profiles%ROWTYPE;
  v_creador   profiles%ROWTYPE;
  v_plaza     plazas%ROWTYPE;
  v_entrega   entregas_programadas%ROWTYPE;
  v_rep       repartidores%ROWTYPE;
  v_pago      cobranza_pagos%ROWTYPE;
  v_comp_url  TEXT;
  v_acuse_url TEXT;
  v_oc_url    TEXT;
  v_doc_url   TEXT;
  v_dir       TEXT;
  v_folio     TEXT;
  v_contact_name TEXT;
BEGIN
  IF _documento_id IS NOT NULL THEN
    SELECT * INTO v_doc FROM documentos WHERE id = _documento_id;
    IF v_doc.empresa_id IS NOT NULL THEN
      SELECT * INTO v_company FROM companies WHERE id = v_doc.empresa_id;
    END IF;
    IF v_doc.plaza_id IS NOT NULL THEN
      SELECT * INTO v_plaza FROM plazas WHERE id = v_doc.plaza_id;
    END IF;
    IF v_doc.ejecutivo_venta_id IS NOT NULL THEN
      SELECT * INTO v_ejecutivo FROM profiles WHERE user_id = v_doc.ejecutivo_venta_id;
    END IF;
    IF v_doc.created_by IS NOT NULL THEN
      SELECT * INTO v_creador FROM profiles WHERE user_id = v_doc.created_by;
    END IF;
    IF v_doc.contacto_id IS NOT NULL AND _contacto_id IS NULL THEN
      SELECT * INTO v_contact FROM contacts WHERE id = v_doc.contacto_id;
    END IF;
    SELECT * INTO v_entrega FROM entregas_programadas WHERE documento_id = _documento_id ORDER BY created_at DESC LIMIT 1;
    IF v_entrega.repartidor_id IS NOT NULL THEN
      SELECT * INTO v_rep FROM repartidores WHERE id = v_entrega.repartidor_id;
    END IF;
    SELECT url_archivo INTO v_acuse_url FROM documento_acuse_archivos
      WHERE documento_id = _documento_id ORDER BY fecha_carga DESC LIMIT 1;
    SELECT url_archivo INTO v_oc_url FROM documento_orden_compra_archivos
      WHERE documento_id = _documento_id ORDER BY fecha_carga DESC LIMIT 1;
    SELECT url_archivo INTO v_doc_url FROM documento_archivos_firmados
      WHERE documento_id = _documento_id ORDER BY fecha_carga DESC LIMIT 1;
    v_folio := COALESCE(NULLIF(v_doc.numero_factura,''), NULLIF(v_doc.numero_pedido,''), NULLIF(v_doc.numero_cotizacion,''));
  END IF;
  IF _contacto_id IS NOT NULL THEN
    SELECT * INTO v_contact FROM contacts WHERE id = _contacto_id;
  END IF;
  -- Fallback: si tenemos contacto pero no compañía cargada, cargar la del contacto
  IF v_company.id IS NULL AND v_contact.company_id IS NOT NULL THEN
    SELECT * INTO v_company FROM companies WHERE id = v_contact.company_id;
  END IF;
  v_contact_name := NULLIF(trim(COALESCE(v_contact.first_name,'') || ' ' || COALESCE(v_contact.last_name,'')), '');
  IF _pago_id IS NOT NULL THEN
    SELECT * INTO v_pago FROM cobranza_pagos WHERE id = _pago_id;
    SELECT url_archivo INTO v_comp_url FROM cobranza_pago_archivos
      WHERE pago_id = _pago_id ORDER BY fecha_carga DESC LIMIT 1;
    -- Fallback: cargar empresa desde el pago si aún no se ha cargado
    IF v_company.id IS NULL AND v_pago.empresa_id IS NOT NULL THEN
      SELECT * INTO v_company FROM companies WHERE id = v_pago.empresa_id;
    END IF;
  END IF;
  v_dir := COALESCE(v_doc.direccion_envio, '');
  RETURN jsonb_build_object(
    '{fecha}',                      to_char(now(), 'DD/MM/YYYY'),
    '{nombre_cliente}',             COALESCE(v_company.name, ''),
    '{nombre_empresa}',             COALESCE(v_company.name, ''),
    '{razon_social}',               COALESCE(v_company.razon_social, ''),
    '{rfc_cliente}',                COALESCE(v_company.razon_social, ''),
    '{id_contpaq}',                 COALESCE(v_company.id_contpaq, ''),
    '{nombre_empresa_vendedora}',   COALESCE(CASE v_doc.empresa_vendedora::text WHEN 'lumaggs_chevron' THEN 'Lumaggs' WHEN 'galsa_phillips66' THEN 'GALSA' ELSE v_doc.empresa_vendedora::text END, ''),
    '{nombre_contacto}',            COALESCE(v_contact_name, ''),
    '{telefono_contacto}',          COALESCE(v_contact.phone, v_contact.mobile, ''),
    '{correo_contacto}',            COALESCE(v_contact.email, ''),
    '{ejecutivo}',                  COALESCE(v_ejecutivo.full_name, ''),
    '{telefono_ejecutivo}',         COALESCE(v_ejecutivo.phone, ''),
    '{correo_ejecutivo}',           COALESCE(v_ejecutivo.email, ''),
    '{registrado_por}',             COALESCE(v_creador.full_name, ''),
    '{plaza}',                      COALESCE(v_plaza.nombre, ''),
    '{folio_cotizacion}',           COALESCE(v_doc.numero_cotizacion, ''),
    '{folio_documento}',            COALESCE(v_folio, ''),
    '{numero_factura}',             COALESCE(v_doc.numero_factura, ''),
    '{numero_pedido}',              COALESCE(v_doc.numero_pedido, ''),
    '{total_cotizacion}',           COALESCE(to_char(v_doc.total, 'FM$999,999,990.00'), ''),
    '{total_documento}',            COALESCE(to_char(v_doc.total, 'FM$999,999,990.00'), ''),
    '{subtotal_documento}',         COALESCE(to_char(v_doc.subtotal, 'FM$999,999,990.00'), ''),
    '{estatus_documento}',          COALESCE(v_doc.estatus_pedido::text, v_doc.estatus_cotizacion::text, v_doc.estatus_factura::text, ''),
    '{fecha_documento}',            COALESCE(to_char(v_doc.fecha_documento, 'DD/MM/YYYY'), ''),
    '{fecha_vencimiento}',          COALESCE(to_char(v_doc.fecha_vencimiento, 'DD/MM/YYYY'), ''),
    '{saldo_pendiente}',            COALESCE(to_char(v_doc.saldo_pendiente_cobranza, 'FM$999,999,990.00'), ''),
    '{observaciones}',              COALESCE(v_doc.notas, ''),
    '{instrucciones_entrega}',      COALESCE(v_entrega.notas, ''),
    '{numero_oc_cliente}',          COALESCE(v_doc.numero_oc_cliente, ''),
    '{fecha_oc_cliente}',           COALESCE(to_char(v_doc.fecha_oc_cliente, 'DD/MM/YYYY'), ''),
    '{fecha_entrega_solicitada}',   COALESCE(to_char(v_doc.fecha_entrega_programada, 'DD/MM/YYYY'), ''),
    '{fecha_entrega_programada}',   COALESCE(to_char(COALESCE(v_entrega.fecha_entrega, v_doc.fecha_entrega_programada), 'DD/MM/YYYY'), ''),
    '{direccion_envio}',            v_dir,
    '{repartidor}',                 COALESCE(v_rep.nombre, ''),
    '{telefono_repartidor}',        COALESCE(v_rep.telefono, ''),
    '{url_acuse}',                  COALESCE(v_acuse_url, ''),
    '{url_orden_compra}',           COALESCE(v_oc_url, ''),
    '{url_documento_firmado}',      COALESCE(v_doc_url, ''),
    '{monto_pago}',                 COALESCE(to_char(v_pago.monto, 'FM$999,999,990.00'), ''),
    '{fecha_pago}',                 COALESCE(to_char(v_pago.fecha_pago, 'DD/MM/YYYY'), ''),
    '{metodo_pago}',                COALESCE(v_pago.metodo_pago::text, ''),
    '{referencia_pago}',            COALESCE(v_pago.referencia, ''),
    '{url_comprobante_pago}',       COALESCE(v_comp_url, '')
  );
END;
$$;