-- Enums
DO $$ BEGIN
  CREATE TYPE public.estado_pago_cobranza AS ENUM ('registrado','no_aplicado','aplicado_parcial','aplicado_total','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.estatus_aplicacion_cobranza AS ENUM ('activa','cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.tipo_doc_cobranza AS ENUM ('factura','pedido','cotizacion');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.estado_cobranza_doc AS ENUM ('pendiente','parcial','pagada','vencida','cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend documentos
ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS saldo_pendiente_cobranza numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estado_cobranza public.estado_cobranza_doc;

UPDATE public.documentos
SET saldo_pendiente_cobranza = total
WHERE saldo_pendiente_cobranza = 0 AND total > 0;

-- cobranza_pagos
CREATE TABLE IF NOT EXISTS public.cobranza_pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE RESTRICT,
  plaza_id uuid REFERENCES public.plazas(id),
  fecha_pago date NOT NULL DEFAULT CURRENT_DATE,
  monto_total numeric NOT NULL CHECK (monto_total > 0),
  moneda text NOT NULL DEFAULT 'MXN',
  tipo_pago text,
  referencia_pago text,
  banco text,
  observaciones text,
  estado_pago public.estado_pago_cobranza NOT NULL DEFAULT 'no_aplicado',
  monto_aplicado numeric NOT NULL DEFAULT 0,
  monto_disponible numeric NOT NULL DEFAULT 0,
  creado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cobranza_pagos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view pagos" ON public.cobranza_pagos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage pagos" ON public.cobranza_pagos FOR ALL USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Managers can manage pagos" ON public.cobranza_pagos FOR ALL USING (has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "Accounting can manage pagos" ON public.cobranza_pagos FOR ALL USING (has_role(auth.uid(),'accounting'::app_role));
CREATE TRIGGER trg_cobranza_pagos_updated BEFORE UPDATE ON public.cobranza_pagos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_cobranza_pagos_empresa ON public.cobranza_pagos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_cobranza_pagos_estado ON public.cobranza_pagos(estado_pago);

-- cobranza_aplicaciones
CREATE TABLE IF NOT EXISTS public.cobranza_aplicaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pago_id uuid NOT NULL REFERENCES public.cobranza_pagos(id) ON DELETE CASCADE,
  tipo_documento public.tipo_doc_cobranza NOT NULL,
  documento_id uuid NOT NULL REFERENCES public.documentos(id) ON DELETE RESTRICT,
  monto_aplicado numeric NOT NULL CHECK (monto_aplicado > 0),
  fecha_aplicacion date NOT NULL DEFAULT CURRENT_DATE,
  observaciones text,
  origen_aplicacion text,
  estatus_aplicacion public.estatus_aplicacion_cobranza NOT NULL DEFAULT 'activa',
  creado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cobranza_aplicaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view aplicaciones" ON public.cobranza_aplicaciones FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage aplicaciones" ON public.cobranza_aplicaciones FOR ALL USING (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Managers can manage aplicaciones" ON public.cobranza_aplicaciones FOR ALL USING (has_role(auth.uid(),'manager'::app_role));
CREATE POLICY "Accounting can manage aplicaciones" ON public.cobranza_aplicaciones FOR ALL USING (has_role(auth.uid(),'accounting'::app_role));
CREATE TRIGGER trg_cobranza_aplicaciones_updated BEFORE UPDATE ON public.cobranza_aplicaciones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_aplic_pago ON public.cobranza_aplicaciones(pago_id);
CREATE INDEX IF NOT EXISTS idx_aplic_doc ON public.cobranza_aplicaciones(documento_id);

-- Recompute pago
CREATE OR REPLACE FUNCTION public.recompute_pago_balance(_pago_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total numeric; v_aplicado numeric;
BEGIN
  SELECT monto_total INTO v_total FROM public.cobranza_pagos WHERE id = _pago_id;
  IF v_total IS NULL THEN RETURN; END IF;
  SELECT COALESCE(SUM(monto_aplicado),0) INTO v_aplicado
  FROM public.cobranza_aplicaciones WHERE pago_id = _pago_id AND estatus_aplicacion = 'activa';
  UPDATE public.cobranza_pagos
  SET monto_aplicado = v_aplicado,
      monto_disponible = v_total - v_aplicado,
      estado_pago = CASE
        WHEN estado_pago = 'cancelado' THEN 'cancelado'
        WHEN v_aplicado = 0 THEN 'no_aplicado'
        WHEN v_aplicado >= v_total THEN 'aplicado_total'
        ELSE 'aplicado_parcial' END,
      updated_at = now()
  WHERE id = _pago_id;
END; $$;

-- Recompute documento
CREATE OR REPLACE FUNCTION public.recompute_documento_cobranza(_documento_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_total numeric; v_aplicado numeric; v_saldo numeric; v_venc date; v_tipo public.tipo_documento;
BEGIN
  SELECT total, fecha_vencimiento, tipo_documento INTO v_total, v_venc, v_tipo FROM public.documentos WHERE id = _documento_id;
  IF v_total IS NULL THEN RETURN; END IF;
  SELECT COALESCE(SUM(monto_aplicado),0) INTO v_aplicado
  FROM public.cobranza_aplicaciones WHERE documento_id = _documento_id AND estatus_aplicacion = 'activa';
  v_saldo := v_total - v_aplicado;
  UPDATE public.documentos
  SET saldo_pendiente_cobranza = v_saldo,
      estado_cobranza = CASE
        WHEN v_saldo <= 0 THEN 'pagada'::public.estado_cobranza_doc
        WHEN v_aplicado > 0 AND v_saldo > 0 THEN 'parcial'::public.estado_cobranza_doc
        WHEN v_tipo = 'factura' AND v_venc IS NOT NULL AND v_venc < CURRENT_DATE AND v_saldo > 0 THEN 'vencida'::public.estado_cobranza_doc
        ELSE 'pendiente'::public.estado_cobranza_doc END,
      updated_at = now()
  WHERE id = _documento_id;
END; $$;

-- Validation trigger
CREATE OR REPLACE FUNCTION public.cobranza_aplicacion_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pago_total numeric; v_aplicado_otros numeric; v_doc_total numeric; v_aplicado_doc_otros numeric;
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.estatus_aplicacion = 'activa' THEN
    SELECT monto_total INTO v_pago_total FROM public.cobranza_pagos WHERE id = NEW.pago_id;
    SELECT COALESCE(SUM(monto_aplicado),0) INTO v_aplicado_otros
    FROM public.cobranza_aplicaciones
    WHERE pago_id = NEW.pago_id AND estatus_aplicacion = 'activa'
      AND (TG_OP = 'INSERT' OR id <> NEW.id);
    IF (v_aplicado_otros + NEW.monto_aplicado) > v_pago_total THEN
      RAISE EXCEPTION 'La aplicación excede el monto disponible del pago';
    END IF;
    SELECT total INTO v_doc_total FROM public.documentos WHERE id = NEW.documento_id;
    SELECT COALESCE(SUM(monto_aplicado),0) INTO v_aplicado_doc_otros
    FROM public.cobranza_aplicaciones
    WHERE documento_id = NEW.documento_id AND estatus_aplicacion = 'activa'
      AND (TG_OP = 'INSERT' OR id <> NEW.id);
    IF (v_aplicado_doc_otros + NEW.monto_aplicado) > v_doc_total THEN
      RAISE EXCEPTION 'La aplicación excede el saldo pendiente del documento';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.cobranza_aplicacion_after_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_pago_balance(OLD.pago_id);
    PERFORM public.recompute_documento_cobranza(OLD.documento_id);
    RETURN OLD;
  ELSE
    PERFORM public.recompute_pago_balance(NEW.pago_id);
    PERFORM public.recompute_documento_cobranza(NEW.documento_id);
    IF TG_OP = 'UPDATE' THEN
      IF OLD.pago_id <> NEW.pago_id THEN PERFORM public.recompute_pago_balance(OLD.pago_id); END IF;
      IF OLD.documento_id <> NEW.documento_id THEN PERFORM public.recompute_documento_cobranza(OLD.documento_id); END IF;
    END IF;
    RETURN NEW;
  END IF;
END; $$;

DROP TRIGGER IF EXISTS trg_cobranza_aplicacion_validate ON public.cobranza_aplicaciones;
CREATE TRIGGER trg_cobranza_aplicacion_validate
  BEFORE INSERT OR UPDATE OR DELETE ON public.cobranza_aplicaciones
  FOR EACH ROW EXECUTE FUNCTION public.cobranza_aplicacion_trigger();

DROP TRIGGER IF EXISTS trg_cobranza_aplicacion_recompute ON public.cobranza_aplicaciones;
CREATE TRIGGER trg_cobranza_aplicacion_recompute
  AFTER INSERT OR UPDATE OR DELETE ON public.cobranza_aplicaciones
  FOR EACH ROW EXECUTE FUNCTION public.cobranza_aplicacion_after_trigger();

-- Default permissions
INSERT INTO public.role_module_permissions (role, module, access_level) VALUES
  ('admin','cobranza','todos'),
  ('manager','cobranza','todos'),
  ('accounting','cobranza','todos'),
  ('sales','cobranza','propio'),
  ('customer_service','cobranza','ninguno'),
  ('warehouse','cobranza','ninguno'),
  ('delivery','cobranza','ninguno')
ON CONFLICT DO NOTHING;