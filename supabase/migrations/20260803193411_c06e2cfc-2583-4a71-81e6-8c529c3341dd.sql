CREATE POLICY "Acceso restringido - ver archivos proveedor"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'proveedor-price-lists' AND public.has_proveedor_price_access(auth.uid()));

CREATE POLICY "Acceso restringido - subir archivos proveedor"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'proveedor-price-lists' AND public.has_proveedor_price_access(auth.uid()));

CREATE POLICY "Acceso restringido - borrar archivos proveedor"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'proveedor-price-lists' AND public.has_proveedor_price_access(auth.uid()));

ALTER TABLE public.proveedor_price_uploads
  ADD COLUMN IF NOT EXISTS storage_path text;

CREATE OR REPLACE FUNCTION public.upsert_proveedor_price_row(
  _marca text,
  _codigo_proveedor text,
  _producto_nombre text,
  _empaque text,
  _clasificacion_proveedor text,
  _tipo_lista text,
  _costo numeric,
  _fecha_vigencia date,
  _upload_id uuid,
  _precio_venta_contado_ref numeric DEFAULT NULL,
  _precio_venta_credito_ref numeric DEFAULT NULL,
  _margen_aplicado_ref numeric DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_proveedor_price_access(auth.uid()) THEN
    RAISE EXCEPTION 'Sin acceso a listas de precios de proveedor';
  END IF;

  INSERT INTO public.proveedor_price_items (
    marca, codigo_proveedor, producto_nombre, empaque, clasificacion_proveedor, created_by
  ) VALUES (
    _marca, _codigo_proveedor, _producto_nombre, _empaque, _clasificacion_proveedor, auth.uid()
  )
  ON CONFLICT (marca, codigo_proveedor) DO UPDATE SET
    producto_nombre = EXCLUDED.producto_nombre,
    empaque = EXCLUDED.empaque,
    clasificacion_proveedor = EXCLUDED.clasificacion_proveedor;

  IF _tipo_lista = 'especial' THEN
    UPDATE public.proveedor_price_items SET
      costo_lista_especial = _costo, fecha_lista_especial = _fecha_vigencia, upload_id_especial = _upload_id
    WHERE marca = _marca AND codigo_proveedor = _codigo_proveedor;
  ELSIF _tipo_lista = 'general' THEN
    UPDATE public.proveedor_price_items SET
      costo_lista_general = _costo, fecha_lista_general = _fecha_vigencia, upload_id_general = _upload_id
    WHERE marca = _marca AND codigo_proveedor = _codigo_proveedor;
  ELSIF _tipo_lista = 'contable' THEN
    UPDATE public.proveedor_price_items SET
      costo_contable = _costo, fecha_costo_contable = _fecha_vigencia, upload_id_contable = _upload_id,
      precio_venta_contado_ref = COALESCE(_precio_venta_contado_ref, precio_venta_contado_ref),
      precio_venta_credito_ref = COALESCE(_precio_venta_credito_ref, precio_venta_credito_ref),
      margen_aplicado_ref = COALESCE(_margen_aplicado_ref, margen_aplicado_ref)
    WHERE marca = _marca AND codigo_proveedor = _codigo_proveedor;
  END IF;
END;
$$;