
-- Add new modules to enum
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'tareas';
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'actividades';
