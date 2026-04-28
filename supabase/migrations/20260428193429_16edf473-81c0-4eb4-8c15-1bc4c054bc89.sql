-- 1) Asignar Tijuana a todas las empresas sin plaza
UPDATE public.companies
SET plaza_id = '86162f44-2b70-4f06-b6ae-51bc79103c75'
WHERE plaza_id IS NULL;

-- 2) Insertar en company_plazas si no existe
INSERT INTO public.company_plazas (company_id, plaza_id)
SELECT c.id, '86162f44-2b70-4f06-b6ae-51bc79103c75'
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.company_plazas cp WHERE cp.company_id = c.id
);

-- 3) Hacer plaza_id obligatorio
ALTER TABLE public.companies
ALTER COLUMN plaza_id SET NOT NULL;