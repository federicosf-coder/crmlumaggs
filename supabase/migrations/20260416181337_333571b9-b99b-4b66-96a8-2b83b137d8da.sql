ALTER TABLE public.documento_archivos_firmados
ADD COLUMN IF NOT EXISTS categoria TEXT NOT NULL DEFAULT 'firmado';

CREATE INDEX IF NOT EXISTS idx_doc_archivos_firmados_categoria
ON public.documento_archivos_firmados(documento_id, categoria);