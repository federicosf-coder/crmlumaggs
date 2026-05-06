Create a Supabase migration that adds the function public.resolve_template_placeholders. Do not modify any existing files.
sqlCREATE OR REPLACE FUNCTION public.resolve_template_placeholders(
  _documento_id uuid DEFAULT NULL,
  _contacto_id  uuid DEFAULT NULL,
  _pago_id      uuid DEFAULT NULL
)
RETURNS jsonb
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
  v_dir       TEXT;
BEGIN
  -- Documento y sus relaciones
  IF _documento_id IS NOT NULL THEN
    SELECT * INTO v_doc FROM documentos WHERE id = _documento_id;
    SELECT * INTO v_company FROM companies WHERE id = v_doc.empresa_id;
    SELECT * INTO v_plaza FROM plazas WHERE id = v_doc.plaza_id;
    SELECT * INTO v_ejecutivo FROM profiles WHERE user_id = v_doc.ejecutivo_venta_id;
    SELECT * INTO v_creador FROM profiles WHERE user_id = v_doc.created_by;
    SELECT * INTO v_entrega FROM entregas_programadas WHERE documento_id = _documento_id LIMIT 1;
    IF v_entrega.repartidor_id IS NOT NULL THEN
      SELECT * INTO v_rep FROM repartidores WHERE id = v_entrega.repartidor_id;
    END IF;
  END IF;

  -- Contacto
  IF _contacto_id IS NOT NULL THEN
    SELECT * INTO v_contact FROM contacts WHERE id = _contacto_id;
  END IF;

  -- Pago
  IF _pago_id IS NOT NULL THEN
    SELECT * INTO v_pago FROM cobranza_pagos WHERE id = _pago_id;
    SELECT url_archivo INTO v_comp_url FROM cobranza_pago_archivos
      WHERE pago_id = _pago_id ORDER BY fecha_carga DESC LIMIT 1;
  END IF;

  v_dir := COALESCE(v_doc.direccion_envio, '');

  RETURN jsonb_build_object(
    -- Fecha
    '{fecha}',                      to_char(now(), 'DD/MM/YYYY'),
    -- Empresa
    '{nombre_cliente}',             COALESCE(v_company.name, ''),
    '{nombre_empresa}',             COALESCE(v_company.name, ''),
    '{rfc_cliente}',                COALESCE(v_company.rfc, ''),
    '{nombre_empresa_vendedora}',   COALESCE(CASE v_doc.empresa_vendedora::text
                                      WHEN 'lumaggs' THEN 'Lumaggs'
                                      WHEN 'galsa'   THEN 'GALSA'
                                      ELSE v_doc.empresa_vendedora::text END, ''),
    -- Contacto
    '{nombre_contacto}',            COALESCE(v_contact.full_name, ''),
    '{telefono_contacto}',          COALESCE(v_contact.phone, ''),
    '{correo_contacto}',            COALESCE(v_contact.email, ''),
    -- Ejecutivo
    '{ejecutivo}',                  COALESCE(v_ejecutivo.full_name, ''),
    '{telefono_ejecutivo}',         COALESCE(v_ejecutivo.phone, ''),
    '{correo_ejecutivo}',           COALESCE(v_ejecutivo.email, ''),
    '{registrado_por}',             COALESCE(v_creador.full_name, ''),
    '{plaza}',                      COALESCE(v_plaza.nombre, ''),
    -- Documento
    '{folio_cotizacion}',           COALESCE(v_doc.folio, ''),
    '{numero_factura}',             COALESCE(v_doc.numero_factura, ''),
    '{total_cotizacion}',           COALESCE(to_char(v_doc.total, 'FM$999,999,990.00'), ''),
    '{estatus_documento}',          COALESCE(v_doc.estatus_pedido::text, ''),
    '{fecha_vencimiento}',          COALESCE(to_char(v_doc.fecha_vencimiento, 'DD/MM/YYYY'), ''),
    '{saldo_pendiente}',            COALESCE(to_char(v_doc.saldo_pendiente_cobranza, 'FM$999,999,990.00'), ''),
    '{observaciones}',              COALESCE(v_doc.notas, ''),
    '{instrucciones_entrega}',      COALESCE(v_doc.instrucciones_entrega, ''),
    '{numero_oc_cliente}',          COALESCE(v_doc.numero_oc_cliente, ''),
    '{fecha_oc_cliente}',           COALESCE(to_char(v_doc.fecha_oc_cliente, 'DD/MM/YYYY'), ''),
    '{fecha_entrega_solicitada}',   COALESCE(to_char(v_doc.fecha_entrega_solicitada, 'DD/MM/YYYY'), ''),
    '{acuse_url}',                  COALESCE(v_doc.acuse_url, ''),
    '{orden_compra_url}',           COALESCE(v_doc.orden_compra_url, ''),
    '{url_documento}',              COALESCE(v_doc.documento_url, ''),
    '{liga_documento}',             COALESCE(v_doc.documento_url, ''),
    '{url_factura_pdf}',            COALESCE(v_doc.url_factura_pdf, ''),
    -- Dirección completa
    '{direccion_entrega}',          v_dir,
    '{direccion_entrega_completa}', v_dir,
    -- Dirección desglosada (misma fuente, el frontend parsea si necesita)
    '{direccion_entrega_calle}',    v_dir,
    '{direccion_entrega_colonia}',  v_dir,
    '{direccion_entrega_ciudad}',   v_dir,
    '{direccion_entrega_cp}',       v_dir,
    '{direccion_entrega_estado}',   v_dir,
    -- Entrega
    '{fecha_entrega_programada}',   COALESCE(to_char(v_entrega.fecha_entrega, 'DD/MM/YYYY'), ''),
    '{fecha_entrega_real}',         COALESCE(to_char(v_entrega.fecha_entrega_real, 'DD/MM/YYYY'), ''),
    '{estatus_entrega}',            COALESCE(v_entrega.estatus_entrega, ''),
    '{repartidor}',                 COALESCE(v_rep.nombre, ''),
    -- Pago
    '{monto_pago}',                 COALESCE(to_char(v_pago.monto_total, 'FM$999,999,990.00'), ''),
    '{fecha_pago}',                 COALESCE(to_char(v_pago.fecha_pago, 'DD/MM/YYYY'), ''),
    '{tipo_pago}',                  COALESCE(v_pago.tipo_pago, ''),
    '{referencia_pago}',            COALESCE(v_pago.referencia_pago, ''),
    '{banco}',                      COALESCE(v_pago.banco, ''),
    '{monto_aplicado}',             COALESCE(to_char(v_pago.monto_aplicado, 'FM$999,999,990.00'), ''),
    '{monto_disponible}',           COALESCE(to_char(v_pago.monto_disponible, 'FM$999,999,990.00'), ''),
    '{url_comprobante}',            COALESCE(v_comp_url, '')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_template_placeholders(uuid, uuid, uuid) TO authenticated;
