
-- 1. Add 'vigente' to estatus_factura enum if missing
ALTER TYPE public.estatus_factura ADD VALUE IF NOT EXISTS 'vigente';
