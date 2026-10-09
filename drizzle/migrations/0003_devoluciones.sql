CREATE TABLE public.devolucion_motivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  orden int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.devolucion_motivos TO authenticated;
GRANT ALL ON public.devolucion_motivos TO service_role;
ALTER TABLE public.devolucion_motivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "motivos lectura" ON public.devolucion_motivos FOR SELECT TO authenticated USING (true);
CREATE POLICY "motivos admin" ON public.devolucion_motivos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));
INSERT INTO public.devolucion_motivos (nombre, orden) VALUES
 ('Producto no es el requerido',1),('Producto no es el solicitado',2),('Producto o envase presenta daños',3);

CREATE SEQUENCE public.devoluciones_folio_seq;
CREATE TABLE public.devoluciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folio text UNIQUE,
  documento_id uuid NOT NULL REFERENCES public.documentos(id) ON DELETE CASCADE,
  empresa_id uuid,
  motivo_id uuid REFERENCES public.devolucion_motivos(id),
  motivo_otro text,
  fecha_venta date,
  fecha_solicitud date NOT NULL DEFAULT current_date,
  comentarios text,
  estado text NOT NULL DEFAULT 'solicitada',
  resolucion_tipo text,
  resolucion_ref text,
  resolucion_monto numeric,
  resolucion_fecha date,
  resolucion_notas text,
  plazo_excedido boolean NOT NULL DEFAULT false,
  recoleccion_responsable text,
  recoleccion_fecha date,
  recibido_almacen boolean NOT NULL DEFAULT false,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.devoluciones(documento_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.devoluciones TO authenticated;
GRANT ALL ON public.devoluciones TO service_role;
GRANT USAGE ON SEQUENCE public.devoluciones_folio_seq TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.devoluciones_before() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' AND NEW.folio IS NULL THEN
    NEW.folio := 'DEV-' || lpad(nextval('public.devoluciones_folio_seq')::text, 4, '0');
  END IF;
  IF NEW.estado NOT IN ('solicitada','en_revision','autorizada','rechazada','resuelta') THEN
    RAISE EXCEPTION 'Estado inválido';
  END IF;
  IF NEW.resolucion_tipo IS NOT NULL AND NEW.resolucion_tipo NOT IN ('nota_credito','reembolso','cambio_producto') THEN
    RAISE EXCEPTION 'Resolución inválida';
  END IF;
  SELECT d.empresa_id, d.fecha_documento INTO NEW.empresa_id, NEW.fecha_venta FROM public.documentos d WHERE d.id = NEW.documento_id;
  NEW.plazo_excedido := NEW.fecha_venta IS NOT NULL AND NEW.fecha_solicitud - NEW.fecha_venta > 15;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_devoluciones_before BEFORE INSERT OR UPDATE ON public.devoluciones FOR EACH ROW EXECUTE FUNCTION public.devoluciones_before();

CREATE OR REPLACE FUNCTION public.can_view_devolucion(_dev_doc uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS (SELECT 1 FROM public.documentos d WHERE d.id=_dev_doc
    AND public.can_view_documento(auth.uid(), d.empresa_id, d.created_by, d.ejecutivo_venta_id))
$$;

ALTER TABLE public.devoluciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dev select" ON public.devoluciones FOR SELECT TO authenticated USING (public.can_view_devolucion(documento_id));
CREATE POLICY "dev insert" ON public.devoluciones FOR INSERT TO authenticated WITH CHECK (public.can_view_devolucion(documento_id));
CREATE POLICY "dev update" ON public.devoluciones FOR UPDATE TO authenticated USING (public.can_view_devolucion(documento_id));
CREATE POLICY "dev delete" ON public.devoluciones FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE TABLE public.devolucion_lineas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  devolucion_id uuid NOT NULL REFERENCES public.devoluciones(id) ON DELETE CASCADE,
  documento_producto_id uuid REFERENCES public.documento_productos(id) ON DELETE SET NULL,
  producto_id uuid,
  cantidad_facturada numeric,
  cantidad numeric NOT NULL,
  lote text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.devolucion_lineas TO authenticated;
GRANT ALL ON public.devolucion_lineas TO service_role;
ALTER TABLE public.devolucion_lineas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lineas all" ON public.devolucion_lineas FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.devoluciones v WHERE v.id=devolucion_id AND public.can_view_devolucion(v.documento_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.devoluciones v WHERE v.id=devolucion_id AND public.can_view_devolucion(v.documento_id)));

CREATE TABLE public.devolucion_archivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  devolucion_id uuid NOT NULL REFERENCES public.devoluciones(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  nombre_archivo text,
  mime_type text,
  tipo text NOT NULL DEFAULT 'evidencia',
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.devolucion_archivos TO authenticated;
GRANT ALL ON public.devolucion_archivos TO service_role;
ALTER TABLE public.devolucion_archivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "archivos all" ON public.devolucion_archivos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.devoluciones v WHERE v.id=devolucion_id AND public.can_view_devolucion(v.documento_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.devoluciones v WHERE v.id=devolucion_id AND public.can_view_devolucion(v.documento_id)));

CREATE POLICY "devoluciones storage rw" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id='devoluciones') WITH CHECK (bucket_id='devoluciones');