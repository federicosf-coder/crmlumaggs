-- 1. Add module to enum
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'biblioteca';

-- 2. Categorías
CREATE TABLE public.biblioteca_categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  descripcion TEXT,
  color TEXT DEFAULT '#6366f1',
  icono TEXT DEFAULT 'Folder',
  orden INT DEFAULT 0,
  solo_admin BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Archivos
CREATE TABLE public.biblioteca_archivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id UUID REFERENCES public.biblioteca_categorias(id) ON DELETE SET NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  marca TEXT CHECK (marca IN ('chevron','phillips66','ambas','na')) DEFAULT 'na',
  vigencia_desde DATE,
  vigencia_hasta DATE,
  etiquetas TEXT[] DEFAULT '{}',
  estado TEXT NOT NULL DEFAULT 'vigente' CHECK (estado IN ('vigente','obsoleto','archivado')),
  current_version_id UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_biblioteca_archivos_categoria ON public.biblioteca_archivos(categoria_id);
CREATE INDEX idx_biblioteca_archivos_estado ON public.biblioteca_archivos(estado);
CREATE INDEX idx_biblioteca_archivos_etiquetas ON public.biblioteca_archivos USING GIN(etiquetas);

-- 4. Versiones
CREATE TABLE public.biblioteca_versiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  archivo_id UUID NOT NULL REFERENCES public.biblioteca_archivos(id) ON DELETE CASCADE,
  version INT NOT NULL,
  storage_path TEXT NOT NULL,
  nombre_archivo TEXT NOT NULL,
  size_bytes BIGINT,
  mime_type TEXT,
  notas_cambio TEXT,
  subido_por UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(archivo_id, version)
);

CREATE INDEX idx_biblioteca_versiones_archivo ON public.biblioteca_versiones(archivo_id);

ALTER TABLE public.biblioteca_archivos
  ADD CONSTRAINT fk_biblioteca_archivos_current_version
  FOREIGN KEY (current_version_id) REFERENCES public.biblioteca_versiones(id) ON DELETE SET NULL;

-- 5. Triggers updated_at
CREATE TRIGGER trg_biblioteca_categorias_updated_at
  BEFORE UPDATE ON public.biblioteca_categorias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_biblioteca_archivos_updated_at
  BEFORE UPDATE ON public.biblioteca_archivos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. RLS
ALTER TABLE public.biblioteca_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biblioteca_archivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biblioteca_versiones ENABLE ROW LEVEL SECURITY;

-- Categorías
CREATE POLICY "biblioteca_cat_select" ON public.biblioteca_categorias
  FOR SELECT TO authenticated
  USING (
    NOT solo_admin
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );

CREATE POLICY "biblioteca_cat_admin_all" ON public.biblioteca_categorias
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Archivos
CREATE POLICY "biblioteca_arch_select" ON public.biblioteca_archivos
  FOR SELECT TO authenticated
  USING (
    categoria_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.biblioteca_categorias c
      WHERE c.id = categoria_id
        AND (NOT c.solo_admin
             OR public.has_role(auth.uid(), 'admin'::app_role)
             OR public.has_role(auth.uid(), 'manager'::app_role))
    )
  );

CREATE POLICY "biblioteca_arch_insert" ON public.biblioteca_archivos
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "biblioteca_arch_update" ON public.biblioteca_archivos
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );

CREATE POLICY "biblioteca_arch_delete" ON public.biblioteca_archivos
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );

-- Versiones
CREATE POLICY "biblioteca_ver_select" ON public.biblioteca_versiones
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.biblioteca_archivos a WHERE a.id = archivo_id)
  );

CREATE POLICY "biblioteca_ver_insert" ON public.biblioteca_versiones
  FOR INSERT TO authenticated
  WITH CHECK (
    subido_por = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.biblioteca_archivos a
      WHERE a.id = archivo_id
        AND (a.created_by = auth.uid()
             OR public.has_role(auth.uid(), 'admin'::app_role)
             OR public.has_role(auth.uid(), 'manager'::app_role))
    )
  );

CREATE POLICY "biblioteca_ver_delete" ON public.biblioteca_versiones
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'manager'::app_role)
  );

-- 7. Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('biblioteca','biblioteca', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "biblioteca_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'biblioteca');

CREATE POLICY "biblioteca_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'biblioteca' AND owner = auth.uid());

CREATE POLICY "biblioteca_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'biblioteca'
    AND (owner = auth.uid()
         OR public.has_role(auth.uid(), 'admin'::app_role)
         OR public.has_role(auth.uid(), 'manager'::app_role))
  );

CREATE POLICY "biblioteca_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'biblioteca'
    AND (owner = auth.uid()
         OR public.has_role(auth.uid(), 'admin'::app_role)
         OR public.has_role(auth.uid(), 'manager'::app_role))
  );