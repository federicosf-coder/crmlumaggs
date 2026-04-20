-- Add new value to tipo_documento enum
ALTER TYPE public.tipo_documento ADD VALUE IF NOT EXISTS 'entrega_corporativa';

-- Create new status enum for entrega corporativa
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estatus_entrega_corporativa') THEN
    CREATE TYPE public.estatus_entrega_corporativa AS ENUM (
      'solicitada',
      'programada',
      'entregada',
      'acuse_enviado'
    );
  END IF;
END$$;

-- Add new columns to documentos
ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS estatus_entrega_corporativa public.estatus_entrega_corporativa,
  ADD COLUMN IF NOT EXISTS fecha_oc_cliente date;