
-- Add missing enum values
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'inventario.kardex';
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'inventario.niveles';
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'inventario.pedidos';
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'inventario.pedidos.sugeridos';
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'inventario.pedidos.elaborados';
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'inventario.pedidos.recibidos';
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'inventario.pedidos.reclamos';
ALTER TYPE public.access_level ADD VALUE IF NOT EXISTS 'lectura';
