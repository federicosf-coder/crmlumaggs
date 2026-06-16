ALTER TABLE public.templates
  ADD COLUMN IF NOT EXISTS source_module TEXT NOT NULL DEFAULT 'general';

ALTER TABLE public.template_placeholders
  ADD COLUMN IF NOT EXISTS source_modules TEXT[] NOT NULL DEFAULT ARRAY['general'];

UPDATE public.template_placeholders SET source_modules = ARRAY['cotizacion','cobranza','entrega','seguimiento','empresa','general'] WHERE key = '{nombre_empresa}';
UPDATE public.template_placeholders SET source_modules = ARRAY['cotizacion','cobranza','entrega','seguimiento','empresa','general'] WHERE key = '{nombre_cliente}';
UPDATE public.template_placeholders SET source_modules = ARRAY['cotizacion','cobranza','entrega','seguimiento','empresa','general'] WHERE key = '{nombre_contacto}';
UPDATE public.template_placeholders SET source_modules = ARRAY['cotizacion','cobranza','entrega','seguimiento','empresa','general'] WHERE key = '{telefono_contacto}';
UPDATE public.template_placeholders SET source_modules = ARRAY['cotizacion','cobranza','entrega','seguimiento','empresa','general'] WHERE key = '{correo_contacto}';
UPDATE public.template_placeholders SET source_modules = ARRAY['cotizacion','cobranza','entrega','seguimiento','empresa','general'] WHERE key = '{fecha}';
UPDATE public.template_placeholders SET source_modules = ARRAY['cotizacion','cobranza','entrega','seguimiento','empresa','general'] WHERE key = '{ejecutivo}';
UPDATE public.template_placeholders SET source_modules = ARRAY['cotizacion','cobranza','entrega','seguimiento','empresa','general'] WHERE key = '{plaza}';
UPDATE public.template_placeholders SET source_modules = ARRAY['cotizacion','cobranza'] WHERE key = '{fecha_vencimiento}';
UPDATE public.template_placeholders SET source_modules = ARRAY['cotizacion','cobranza','entrega'] WHERE key = '{folio_cotizacion}';
UPDATE public.template_placeholders SET source_modules = ARRAY['cotizacion'] WHERE key = '{total_cotizacion}';
UPDATE public.template_placeholders SET source_modules = ARRAY['cotizacion'] WHERE key = '{producto}';
UPDATE public.template_placeholders SET source_modules = ARRAY['cotizacion'] WHERE key = '{categoria_producto}';
UPDATE public.template_placeholders SET source_modules = ARRAY['cotizacion','cobranza'] WHERE key = '{estatus_documento}';
UPDATE public.template_placeholders SET source_modules = ARRAY['cobranza'] WHERE key = '{saldo_pendiente}';
UPDATE public.template_placeholders SET source_modules = ARRAY['entrega'] WHERE key = '{direccion_entrega}';
UPDATE public.template_placeholders SET source_modules = ARRAY['cotizacion','cobranza','entrega'] WHERE key = '{liga_documento}';