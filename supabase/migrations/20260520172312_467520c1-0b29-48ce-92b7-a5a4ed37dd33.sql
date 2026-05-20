UPDATE public.credit_doc_types 
SET instrucciones_cliente = 'Sólo cuando el Poder no está acreditado en Acta Constitutiva o se requiere poder adicional. Debe incluir facultades para firmar títulos de crédito (Art. 9 LGTOC).'
WHERE nombre = 'Poder del Representante Legal';