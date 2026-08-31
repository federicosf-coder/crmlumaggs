ALTER TABLE public.rvs_personas ADD COLUMN IF NOT EXISTS nombre_mostrar text;

UPDATE public.rvs_personas
SET nombre_mostrar = btrim(regexp_replace(nombre_reporte, '\s*-\s*[A-Za-z0-9]{1,6}\s*$', ''))
WHERE nombre_mostrar IS NULL;