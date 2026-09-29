UPDATE public.companies
SET forma_pago = '99',
    metodo_pago = 'PPD'::metodo_pago_sat
WHERE tipo_pago IN ('credito_cescemex'::tipo_pago, 'credito_directo'::tipo_pago)
  AND (forma_pago IS DISTINCT FROM '99' OR metodo_pago IS DISTINCT FROM 'PPD'::metodo_pago_sat);