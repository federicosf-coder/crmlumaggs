DROP POLICY IF EXISTS "Auth view documentos by access" ON public.documentos;

CREATE POLICY "Auth view documentos by access"
ON public.documentos
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'accounting'::app_role)
  OR created_by = auth.uid()
  OR ejecutivo_venta_id = auth.uid()
  OR empresa_id IN (
    SELECT company_id FROM public.company_ejecutivos WHERE user_id = auth.uid()
  )
);