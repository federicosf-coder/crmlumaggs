
CREATE TABLE public.industrias_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  clave TEXT NOT NULL UNIQUE,
  etiqueta TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  ordering INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.industrias_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "industrias_catalog read for authenticated"
  ON public.industrias_catalog FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "industrias_catalog admin insert"
  ON public.industrias_catalog FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "industrias_catalog admin update"
  ON public.industrias_catalog FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "industrias_catalog admin delete"
  ON public.industrias_catalog FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER industrias_catalog_updated_at
  BEFORE UPDATE ON public.industrias_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.industrias_catalog (clave, etiqueta, ordering) VALUES
  ('Agroindustria (campos, empacadoras, maquinaria)','Agroindustria (campos, empacadoras, maquinaria)',10),
  ('Construcción (obra civil, maquinaria, movimiento de tierra)','Construcción (obra civil, maquinaria, movimiento de tierra)',20),
  ('Detalle / autoservicio (supermercados, mercados)','Detalle / autoservicio (supermercados, mercados)',30),
  ('Distribuidor o revendedor de lubricantes','Distribuidor o revendedor de lubricantes',40),
  ('Entrega Corporativa','Entrega Corporativa',50),
  ('Flota interna (consumo propio)','Flota interna (consumo propio)',60),
  ('Gasolinera','Gasolinera',70),
  ('Gobierno','Gobierno',80),
  ('Gruas','Gruas',90),
  ('Industria – alimentos','Industria – alimentos',100),
  ('Industria – energía','Industria – energía',110),
  ('Industria – metalmecánica','Industria – metalmecánica',120),
  ('Industria – plásticos','Industria – plásticos',130),
  ('Industria – Maquiladora, Procesos varios','Industria – Maquiladora, Procesos varios',140),
  ('Marítimo','Marítimo',150),
  ('Minería','Minería',160),
  ('Refaccionaria diesel','Refaccionaria diesel',170),
  ('Refaccionaria gasolina','Refaccionaria gasolina',180),
  ('Revendedor / comercio industrial','Revendedor / comercio industrial',190),
  ('Servicio automotriz – taller automotriz','Servicio automotriz – taller automotriz',200),
  ('Servicio automotriz – taller diésel','Servicio automotriz – taller diésel',210),
  ('Servicio transmisiones','Servicio transmisiones',220),
  ('Transporte – carga','Transporte – carga',230),
  ('Transporte – logística / paquetería','Transporte – logística / paquetería',240),
  ('Transporte – personal / pasajeros','Transporte – personal / pasajeros',250)
ON CONFLICT (clave) DO NOTHING;
