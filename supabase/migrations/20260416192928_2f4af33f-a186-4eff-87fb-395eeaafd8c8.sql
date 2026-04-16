-- Add plaza_id to profiles for default user plaza
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS plaza_id uuid REFERENCES public.plazas(id) ON DELETE SET NULL;

-- Ensure a "Plaza Predeterminada" exists
INSERT INTO public.plazas (nombre, is_active)
SELECT 'Plaza Predeterminada', true
WHERE NOT EXISTS (SELECT 1 FROM public.plazas WHERE nombre = 'Plaza Predeterminada');