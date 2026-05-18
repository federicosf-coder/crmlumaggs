
ALTER TABLE public.credit_doc_types ADD COLUMN IF NOT EXISTS permite_multiples boolean NOT NULL DEFAULT false;

UPDATE public.credit_doc_types
SET nombre = 'Identificación oficial',
    instrucciones_cliente = 'INE o pasaporte vigente del Representante Legal (Persona Moral) o del Solicitante (Persona Física). Sube ambos lados en un solo archivo.'
WHERE id = '928b4dc0-712c-422f-a298-487b2d9bcc89';

UPDATE public.credit_doc_types SET is_active = false WHERE id = '1f82b08c-8aa2-4033-9487-890fd90857b8';

UPDATE public.credit_doc_types SET permite_multiples = true
WHERE id IN (
  '25676396-bf77-477d-a18e-4aec4c8a4a69',
  'dc324ad8-80b9-4c96-ac0c-be917d74be5c',
  '13ef4b9f-2cc4-459b-bb20-a6b9cfffabbf',
  '2509777f-d885-4dee-b799-5d875030544d',
  'c9e1310c-507f-4166-b0b8-d4aaca9a7640',
  '9b46717e-08e6-4ef0-84b4-9964908e5cd7',
  '230fb182-d2dd-4250-9d0c-7d0f55b00a25'
);
