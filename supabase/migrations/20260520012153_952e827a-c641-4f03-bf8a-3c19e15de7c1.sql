-- Para cada formato actualmente con entidad='ambas', crear dos filas (lumaggs y galsa) con el mismo contenido,
-- y eliminar la fila original 'ambas'. Las filas que ya sean lumaggs/galsa no se tocan.

WITH ambas AS (
  SELECT * FROM public.credit_doc_templates WHERE entidad = 'ambas'
)
INSERT INTO public.credit_doc_templates (
  key, entidad, nombre, contenido_html, header_html, footer_html, pagina_tamano, activo
)
SELECT
  a.key,
  ent.entidad::text,
  a.nombre || CASE WHEN ent.entidad = 'lumaggs' THEN ' · Lumaggs' ELSE ' · Galsa' END,
  a.contenido_html,
  a.header_html,
  a.footer_html,
  a.pagina_tamano,
  a.activo
FROM ambas a
CROSS JOIN (VALUES ('lumaggs'), ('galsa')) AS ent(entidad)
WHERE NOT EXISTS (
  SELECT 1 FROM public.credit_doc_templates t
  WHERE t.key = a.key AND t.entidad = ent.entidad
);

DELETE FROM public.credit_doc_templates WHERE entidad = 'ambas';