-- Add editable display name to addresses
ALTER TABLE public.direcciones_empresa
  ADD COLUMN IF NOT EXISTS nombre text;

-- Backfill existing rows using: empresa | tipo | calle | ciudad (skip empties)
UPDATE public.direcciones_empresa d
SET nombre = (
  SELECT array_to_string(
    ARRAY(
      SELECT x FROM unnest(ARRAY[
        NULLIF(c.name, ''),
        NULLIF(d.tipo::text, ''),
        NULLIF(d.calle, ''),
        NULLIF(d.ciudad, '')
      ]) AS x WHERE x IS NOT NULL AND x <> ''
    ),
    ' | '
  )
  FROM public.companies c
  WHERE c.id = d.empresa_id
)
WHERE (d.nombre IS NULL OR d.nombre = '');