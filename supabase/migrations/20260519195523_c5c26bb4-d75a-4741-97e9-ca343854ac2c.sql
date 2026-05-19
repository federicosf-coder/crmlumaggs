ALTER TABLE public.credit_requests
  ADD COLUMN IF NOT EXISTS solicita_lumaggs boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS solicita_galsa boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS monto_solicitado_lumaggs numeric,
  ADD COLUMN IF NOT EXISTS monto_solicitado_galsa numeric,
  ADD COLUMN IF NOT EXISTS firma_solicitud_lumaggs_fecha timestamp with time zone,
  ADD COLUMN IF NOT EXISTS firma_solicitud_lumaggs_nombre text,
  ADD COLUMN IF NOT EXISTS firma_solicitud_lumaggs_doc_id uuid,
  ADD COLUMN IF NOT EXISTS firma_solicitud_galsa_fecha timestamp with time zone,
  ADD COLUMN IF NOT EXISTS firma_solicitud_galsa_nombre text,
  ADD COLUMN IF NOT EXISTS firma_solicitud_galsa_doc_id uuid;

UPDATE public.credit_requests cr
   SET solicita_lumaggs = true,
       monto_solicitado_lumaggs = COALESCE(cr.monto_solicitado_lumaggs, cr.monto_solicitado),
       firma_solicitud_lumaggs_fecha = COALESCE(cr.firma_solicitud_lumaggs_fecha, cr.firma_solicitud_fecha),
       firma_solicitud_lumaggs_nombre = COALESCE(cr.firma_solicitud_lumaggs_nombre, cr.firma_solicitud_nombre),
       firma_solicitud_lumaggs_doc_id = COALESCE(cr.firma_solicitud_lumaggs_doc_id, cr.firma_solicitud_doc_id)
 WHERE cr.solicita_lumaggs = false AND cr.solicita_galsa = false;