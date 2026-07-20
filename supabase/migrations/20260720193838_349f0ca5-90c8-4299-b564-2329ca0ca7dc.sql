
CREATE TABLE public.whatsapp_routing_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  wa_phone TEXT NOT NULL,
  business_phone_number_id TEXT NOT NULL,
  mensaje_original TEXT,
  zona_seleccionada TEXT,
  telefono_destino TEXT,
  estado TEXT NOT NULL DEFAULT 'esperando_zona',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (wa_phone, business_phone_number_id)
);
GRANT SELECT ON public.whatsapp_routing_sessions TO authenticated;
GRANT ALL ON public.whatsapp_routing_sessions TO service_role;
ALTER TABLE public.whatsapp_routing_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view routing sessions"
  ON public.whatsapp_routing_sessions FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
