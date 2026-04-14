
CREATE TABLE public.empresa_marcas (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_vendedora public.empresa_vendedora NOT NULL,
  marca_id uuid NOT NULL REFERENCES public.product_option_values(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (empresa_vendedora, marca_id)
);

ALTER TABLE public.empresa_marcas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view empresa_marcas"
  ON public.empresa_marcas FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can manage empresa_marcas"
  ON public.empresa_marcas FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers can manage empresa_marcas"
  ON public.empresa_marcas FOR ALL
  USING (public.has_role(auth.uid(), 'manager'));
