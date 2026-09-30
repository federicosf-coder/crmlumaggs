WITH calc AS (
  SELECT d.id, coalesce(d.unidades_equivalentes_total,0) h,
    sum(CASE WHEN coalesce(dp.unidades_equivalentes,0)=0 AND dp.cantidad>0 THEN dp.cantidad*coalesce(pr.unidades_equivalentes,0) ELSE coalesce(dp.unidades_equivalentes,0) END) n
  FROM public.documentos d
  JOIN public.documento_productos dp ON dp.documento_id=d.id
  LEFT JOIN public.productos p ON p.id=dp.producto_id
  LEFT JOIN public.presentaciones pr ON pr.id=p.presentacion_id
  WHERE d.id IN (SELECT documento_id FROM public.documento_productos WHERE coalesce(unidades_equivalentes,0)=0 AND cantidad>0)
  GROUP BY d.id, d.unidades_equivalentes_total
)
UPDATE public.documento_productos dp
SET unidades_equivalentes = dp.cantidad*pr.unidades_equivalentes
FROM public.productos p, public.presentaciones pr, calc c
WHERE p.id=dp.producto_id AND pr.id=p.presentacion_id AND c.id=dp.documento_id
  AND coalesce(dp.unidades_equivalentes,0)=0 AND dp.cantidad>0
  AND coalesce(pr.unidades_equivalentes,0)>0
  AND c.n >= c.h - 0.01;