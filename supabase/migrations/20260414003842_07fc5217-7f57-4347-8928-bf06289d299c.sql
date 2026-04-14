
ALTER TYPE public.estatus_cotizacion ADD VALUE IF NOT EXISTS 'impresa';
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'modificar_pdf_cotizacion';
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'eliminar_pdf_cotizacion';
