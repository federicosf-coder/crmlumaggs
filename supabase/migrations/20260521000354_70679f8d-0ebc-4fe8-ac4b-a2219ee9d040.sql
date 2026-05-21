ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS direccion_envio_id uuid REFERENCES public.direcciones_empresa(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documentos_direccion_envio_id
  ON public.documentos(direccion_envio_id);

COMMENT ON COLUMN public.documentos.direccion_envio_id IS
  'FK to direcciones_empresa. Required for a pedido to be schedulable and appear in the delivery pool. Enforced in app logic, not via DB constraint.';