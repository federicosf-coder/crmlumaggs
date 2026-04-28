-- =====================================================
-- FASE 1: Sistema unificado de Tareas/Actividades CRM
-- =====================================================

-- 1. Enums
DO $$ BEGIN
  CREATE TYPE public.crm_item_kind AS ENUM ('tarea', 'actividad');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crm_item_type AS ENUM (
    'call', 'email', 'meeting', 'note', 'field_visit',
    'whatsapp', 'follow_up', 'task', 'visita', 'otro'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crm_item_status AS ENUM (
    'pendiente', 'en_progreso', 'completada', 'cancelada', 'vencida'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crm_item_priority AS ENUM ('baja', 'media', 'alta', 'urgente');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Tabla principal unificada
CREATE TABLE IF NOT EXISTS public.crm_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind public.crm_item_kind NOT NULL DEFAULT 'tarea',
  type public.crm_item_type NOT NULL DEFAULT 'task',
  status public.crm_item_status NOT NULL DEFAULT 'pendiente',
  priority public.crm_item_priority NOT NULL DEFAULT 'media',

  title TEXT NOT NULL,
  description TEXT,
  resultado TEXT,                         -- resultado al finalizar
  notas_internas TEXT,

  -- Relaciones
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  deal_id UUID REFERENCES public.crm_deals(id) ON DELETE SET NULL,
  pipeline_id UUID REFERENCES public.crm_pipelines(id) ON DELETE SET NULL,

  -- Usuarios
  created_by UUID NOT NULL,               -- autor
  assigned_to UUID,                       -- responsable principal
  completed_by UUID,                      -- quien terminó

  -- Fechas
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT now(),
  fecha_programada TIMESTAMPTZ,           -- cuándo se ejecutará
  fecha_vencimiento TIMESTAMPTZ,          -- deadline
  fecha_terminacion TIMESTAMPTZ,          -- cuándo se finalizó realmente
  fecha_actividad TIMESTAMPTZ,            -- para actividades ya ocurridas

  -- Marca / contexto
  marca TEXT,                             -- 'chevron' | 'phillips66' | null
  origen TEXT,                            -- 'manual' | 'whatsapp' | 'email' | 'sistema'

  -- Comunicación
  canal TEXT,                             -- 'email', 'whatsapp', 'tel', etc
  mensaje_sugerido TEXT,
  whatsapp_status TEXT,
  whatsapp_last_sent_at TIMESTAMPTZ,

  -- Metadata libre
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_items_kind ON public.crm_items(kind);
CREATE INDEX IF NOT EXISTS idx_crm_items_status ON public.crm_items(status);
CREATE INDEX IF NOT EXISTS idx_crm_items_company ON public.crm_items(company_id);
CREATE INDEX IF NOT EXISTS idx_crm_items_contact ON public.crm_items(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_items_deal ON public.crm_items(deal_id);
CREATE INDEX IF NOT EXISTS idx_crm_items_assigned ON public.crm_items(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_items_created_by ON public.crm_items(created_by);
CREATE INDEX IF NOT EXISTS idx_crm_items_fecha_venc ON public.crm_items(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_crm_items_fecha_creacion ON public.crm_items(fecha_creacion);
CREATE INDEX IF NOT EXISTS idx_crm_items_marca ON public.crm_items(marca);

-- 3. Tabla de colaboradores
CREATE TABLE IF NOT EXISTS public.crm_item_collaborators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.crm_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_crm_item_collab_user ON public.crm_item_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_crm_item_collab_item ON public.crm_item_collaborators(item_id);

-- 4. Trigger updated_at
DROP TRIGGER IF EXISTS trg_crm_items_updated_at ON public.crm_items;
CREATE TRIGGER trg_crm_items_updated_at
  BEFORE UPDATE ON public.crm_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Trigger auto-completar metadata al cerrar
CREATE OR REPLACE FUNCTION public.crm_items_handle_completion()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- Al pasar a completada
  IF NEW.status = 'completada' AND (OLD.status IS DISTINCT FROM 'completada') THEN
    IF NEW.fecha_terminacion IS NULL THEN
      NEW.fecha_terminacion := now();
    END IF;
    IF NEW.completed_by IS NULL THEN
      NEW.completed_by := COALESCE(auth.uid(), NEW.assigned_to, NEW.created_by);
    END IF;
  END IF;

  -- Si se reabre, limpiar
  IF NEW.status <> 'completada' AND OLD.status = 'completada' THEN
    NEW.fecha_terminacion := NULL;
    NEW.completed_by := NULL;
  END IF;

  -- Auto-marcar vencida en update (opcional, sólo si sigue pendiente)
  IF NEW.status = 'pendiente'
     AND NEW.fecha_vencimiento IS NOT NULL
     AND NEW.fecha_vencimiento < now() THEN
    -- no forzamos a vencida automáticamente para no romper filtros, pero podemos
    NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_items_completion ON public.crm_items;
CREATE TRIGGER trg_crm_items_completion
  BEFORE UPDATE ON public.crm_items
  FOR EACH ROW EXECUTE FUNCTION public.crm_items_handle_completion();

-- 6. RLS
ALTER TABLE public.crm_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_item_collaborators ENABLE ROW LEVEL SECURITY;

-- Helper: ¿el usuario tiene acceso a este item?
CREATE OR REPLACE FUNCTION public.user_can_access_crm_item(_user_id uuid, _item_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.crm_items i
    WHERE i.id = _item_id
      AND (
        i.created_by = _user_id
        OR i.assigned_to = _user_id
        OR EXISTS (SELECT 1 FROM public.crm_item_collaborators c WHERE c.item_id = i.id AND c.user_id = _user_id)
        OR (i.company_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.company_ejecutivos ce
              WHERE ce.company_id = i.company_id AND ce.user_id = _user_id
           ))
        OR public.has_role(_user_id, 'admin'::app_role)
        OR public.has_role(_user_id, 'manager'::app_role)
      )
  )
$$;

-- SELECT: autor, asignado, colaborador, ejecutivo de empresa, admin, manager
DROP POLICY IF EXISTS "crm_items_select" ON public.crm_items;
CREATE POLICY "crm_items_select" ON public.crm_items
FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR assigned_to = auth.uid()
  OR EXISTS (SELECT 1 FROM public.crm_item_collaborators c WHERE c.item_id = crm_items.id AND c.user_id = auth.uid())
  OR (company_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.company_ejecutivos ce
        WHERE ce.company_id = crm_items.company_id AND ce.user_id = auth.uid()
     ))
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
);

-- INSERT: cualquiera autenticado, debe ser created_by = auth.uid()
DROP POLICY IF EXISTS "crm_items_insert" ON public.crm_items;
CREATE POLICY "crm_items_insert" ON public.crm_items
FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

-- UPDATE: autor, asignado, colaborador, admin, manager
DROP POLICY IF EXISTS "crm_items_update" ON public.crm_items;
CREATE POLICY "crm_items_update" ON public.crm_items
FOR UPDATE TO authenticated
USING (
  created_by = auth.uid()
  OR assigned_to = auth.uid()
  OR EXISTS (SELECT 1 FROM public.crm_item_collaborators c WHERE c.item_id = crm_items.id AND c.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
);

-- DELETE: autor, admin
DROP POLICY IF EXISTS "crm_items_delete" ON public.crm_items;
CREATE POLICY "crm_items_delete" ON public.crm_items
FOR DELETE TO authenticated
USING (
  created_by = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- Colaboradores
DROP POLICY IF EXISTS "crm_item_collab_select" ON public.crm_item_collaborators;
CREATE POLICY "crm_item_collab_select" ON public.crm_item_collaborators
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.user_can_access_crm_item(auth.uid(), item_id)
);

DROP POLICY IF EXISTS "crm_item_collab_insert" ON public.crm_item_collaborators;
CREATE POLICY "crm_item_collab_insert" ON public.crm_item_collaborators
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.crm_items i
    WHERE i.id = item_id
      AND (i.created_by = auth.uid() OR i.assigned_to = auth.uid()
           OR public.has_role(auth.uid(), 'admin'::app_role)
           OR public.has_role(auth.uid(), 'manager'::app_role))
  )
);

DROP POLICY IF EXISTS "crm_item_collab_delete" ON public.crm_item_collaborators;
CREATE POLICY "crm_item_collab_delete" ON public.crm_item_collaborators
FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.crm_items i
    WHERE i.id = item_id
      AND (i.created_by = auth.uid()
           OR public.has_role(auth.uid(), 'admin'::app_role)
           OR public.has_role(auth.uid(), 'manager'::app_role))
  )
);

-- 7. Vista unificada (legacy + nueva tabla)
CREATE OR REPLACE VIEW public.crm_items_unified
WITH (security_invoker = on) AS
SELECT
  i.id,
  i.kind,
  i.type::text                            AS type,
  i.status::text                          AS status,
  i.priority::text                        AS priority,
  i.title,
  i.description,
  i.resultado,
  i.company_id,
  i.contact_id,
  i.deal_id,
  i.pipeline_id,
  i.created_by,
  i.assigned_to,
  i.completed_by,
  i.fecha_creacion,
  i.fecha_programada,
  i.fecha_vencimiento,
  i.fecha_terminacion,
  i.fecha_actividad,
  i.marca,
  i.origen,
  i.canal,
  'crm_items'::text                       AS source_table
FROM public.crm_items i

UNION ALL

SELECT
  t.id,
  'tarea'::public.crm_item_kind           AS kind,
  'task'::text                            AS type,
  CASE
    WHEN t.completed THEN 'completada'
    WHEN t.due_date IS NOT NULL AND t.due_date < now() THEN 'vencida'
    ELSE 'pendiente'
  END                                     AS status,
  COALESCE(t.priority, 'media')           AS priority,
  t.title,
  t.description,
  NULL::text                              AS resultado,
  t.company_id,
  t.contact_id,
  t.deal_id,
  NULL::uuid                              AS pipeline_id,
  t.user_id                               AS created_by,
  t.user_id                               AS assigned_to,
  CASE WHEN t.completed THEN t.user_id ELSE NULL END AS completed_by,
  t.created_at                            AS fecha_creacion,
  t.due_date                              AS fecha_programada,
  t.due_date                              AS fecha_vencimiento,
  CASE WHEN t.completed THEN t.updated_at ELSE NULL END AS fecha_terminacion,
  NULL::timestamptz                       AS fecha_actividad,
  NULL::text                              AS marca,
  'legacy'::text                          AS origen,
  NULL::text                              AS canal,
  'crm_tasks'::text                       AS source_table
FROM public.crm_tasks t

UNION ALL

SELECT
  a.id,
  'actividad'::public.crm_item_kind       AS kind,
  a.type::text                            AS type,
  'completada'::text                      AS status,
  'media'::text                           AS priority,
  a.title,
  a.description,
  NULL::text                              AS resultado,
  a.company_id,
  a.contact_id,
  a.deal_id,
  NULL::uuid                              AS pipeline_id,
  a.user_id                               AS created_by,
  a.user_id                               AS assigned_to,
  a.user_id                               AS completed_by,
  a.created_at                            AS fecha_creacion,
  a.activity_date                         AS fecha_programada,
  NULL::timestamptz                       AS fecha_vencimiento,
  a.activity_date                         AS fecha_terminacion,
  a.activity_date                         AS fecha_actividad,
  NULL::text                              AS marca,
  'legacy'::text                          AS origen,
  NULL::text                              AS canal,
  'crm_activities'::text                  AS source_table
FROM public.crm_activities a;

GRANT SELECT ON public.crm_items_unified TO authenticated;