DROP POLICY IF EXISTS "credit_request_docs internal all" ON public.credit_request_docs;

CREATE POLICY "credit_request_docs internal all"
ON public.credit_request_docs
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'customer_service'::app_role)
  OR has_role(auth.uid(), 'accounting'::app_role)
  OR (
    has_role(auth.uid(), 'sales'::app_role)
    AND EXISTS (
      SELECT 1 FROM credit_requests r
      WHERE r.id = credit_request_docs.credit_request_id
        AND (r.created_by = auth.uid() OR public.is_credit_request_responsable(r.id, auth.uid()))
    )
  )
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'manager'::app_role)
  OR has_role(auth.uid(), 'customer_service'::app_role)
  OR has_role(auth.uid(), 'accounting'::app_role)
  OR (
    has_role(auth.uid(), 'sales'::app_role)
    AND EXISTS (
      SELECT 1 FROM credit_requests r
      WHERE r.id = credit_request_docs.credit_request_id
        AND (r.created_by = auth.uid() OR public.is_credit_request_responsable(r.id, auth.uid()))
    )
  )
);