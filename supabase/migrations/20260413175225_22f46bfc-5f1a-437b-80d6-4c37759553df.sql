
CREATE TYPE public.tipo_direccion AS ENUM ('envio', 'fiscal', 'comercial');

CREATE TABLE public.direcciones_empresa (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tipo tipo_direccion NOT NULL DEFAULT 'envio',
  calle TEXT NOT NULL,
  ciudad TEXT,
  estado TEXT,
  codigo_postal TEXT,
  referencia TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.direcciones_empresa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view direcciones" ON public.direcciones_empresa FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage direcciones" ON public.direcciones_empresa FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Managers can manage direcciones" ON public.direcciones_empresa FOR ALL USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Sales can manage direcciones" ON public.direcciones_empresa FOR ALL USING (has_role(auth.uid(), 'sales'::app_role));

CREATE TRIGGER update_direcciones_updated_at BEFORE UPDATE ON public.direcciones_empresa FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
