INSERT INTO public.user_roles (user_id, role) VALUES
('46e604e9-9ae9-4c84-b861-6c8f5aff0e33','customer_service'),
('f6d869bc-b8c3-4885-beea-a05ef406e6dd','customer_service'),
('45273656-0329-4933-8349-62fc3b96b121','warehouse'),
('c2206b21-08eb-4329-9ab1-26ab2f9812da','customer_service')
ON CONFLICT (user_id, role) DO NOTHING;