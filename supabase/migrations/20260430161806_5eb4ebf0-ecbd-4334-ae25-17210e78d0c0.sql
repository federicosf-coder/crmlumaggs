-- Deduplicate entregas_programadas keeping the most recent (by created_at, then id)
WITH ranked AS (
  SELECT id, documento_id,
         ROW_NUMBER() OVER (
           PARTITION BY documento_id
           ORDER BY created_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM public.entregas_programadas
  WHERE documento_id IS NOT NULL
)
DELETE FROM public.entregas_programadas e
USING ranked r
WHERE e.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_entregas_programadas_documento_id
  ON public.entregas_programadas(documento_id);