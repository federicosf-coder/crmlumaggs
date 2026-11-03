CREATE OR REPLACE FUNCTION public.contpaq_folio_clave(_t text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT regexp_replace(regexp_replace(upper(coalesce(_t,'')),'[^A-Z0-9]','','g'),'^([A-Z]*)0*','\1')
$$;

CREATE OR REPLACE FUNCTION public.contpaq_facturas(_marca text, _usuario uuid, _inicio date, _fin date)
 RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
WITH crm AS (
  SELECT d.id, public.contpaq_folio_clave(d.numero_factura) clave, d.fecha_documento fecha,
         coalesce(nullif(co.id_contpaq,''), co.id::text) codigo,
         coalesce(nullif(co.name,''), co.razon_social, 'Sin cliente') nombre
  FROM documentos d LEFT JOIN companies co ON co.id=d.empresa_id
  WHERE public.contpaq_ver_usuario(_usuario) AND d.tipo_documento='factura' AND d.empresa_vendedora::text=_marca
    AND d.ejecutivo_venta_id=_usuario AND d.fecha_documento>=_inicio AND d.fecha_documento<_fin
    AND coalesce(d.estatus_factura::text,'') NOT IN ('cancelada','refacturacion_rfc','refacturado_remision')
),
crm_u AS (
  SELECT c.codigo,c.nombre,c.fecha,sum(dp.cantidad*coalesce(pr.unidades_equivalentes,0)) unidades
  FROM crm c JOIN documento_productos dp ON dp.documento_id=c.id
  LEFT JOIN productos p ON p.id=dp.producto_id LEFT JOIN presentaciones pr ON pr.id=p.presentacion_id
  GROUP BY 1,2,3
),
cq AS (
  SELECT c.codigo, coalesce(nullif(co.name,''), c.nombre) nombre, v.fecha,
         sum((l->>'cantidad')::numeric*pr.unidades_equivalentes) unidades
  FROM contpaq_ventas v
  JOIN contpaq_agentes a ON a.marca=v.marca AND a.codigo=v.agente_codigo JOIN rvs_personas rp ON rp.id=a.persona_id
  JOIN contpaq_clientes c ON c.marca=v.marca AND c.codigo=v.cliente_codigo
  LEFT JOIN LATERAL (SELECT name FROM companies WHERE id_contpaq=c.codigo ORDER BY updated_at DESC NULLS LAST LIMIT 1) co ON true
  CROSS JOIN LATERAL jsonb_array_elements(v.lineas) l JOIN contpaq_productos cp ON cp.marca=v.marca AND cp.codigo=l->>'codigo_producto'
  JOIN productos p ON p.id=cp.producto_id JOIN presentaciones pr ON pr.id=p.presentacion_id
  WHERE public.contpaq_ver_usuario(_usuario) AND v.marca=_marca AND rp.user_id=_usuario AND v.fecha>=_inicio AND v.fecha<_fin
    AND v.estado='Afectado' AND v.concepto ILIKE 'Facturacion%'
    AND NOT EXISTS (SELECT 1 FROM documentos d WHERE d.tipo_documento='factura' AND d.empresa_vendedora::text=v.marca
        AND d.numero_factura IS NOT NULL AND public.contpaq_folio_clave(d.numero_factura)=public.contpaq_folio_clave(v.serie||v.folio))
  GROUP BY 1,2,3
),
todo AS (SELECT * FROM crm_u UNION ALL SELECT * FROM cq)
SELECT coalesce(jsonb_agg(jsonb_build_object('empresa_id',codigo,'cliente',nombre,'fecha',fecha,'unidades',unidades)),'[]'::jsonb)
FROM (SELECT codigo, max(nombre) nombre, fecha, sum(unidades) unidades FROM todo GROUP BY codigo, fecha) q
$function$;