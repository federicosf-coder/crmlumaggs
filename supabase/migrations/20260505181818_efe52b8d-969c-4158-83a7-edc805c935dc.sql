
-- ============================================================
-- 1) BUCKET document-files: privado + SELECT solo autenticados
-- ============================================================
UPDATE storage.buckets SET public = false WHERE id = 'document-files';

DROP POLICY IF EXISTS "Anyone can view doc files" ON storage.objects;
DROP POLICY IF EXISTS "Public can view doc files" ON storage.objects;
DROP POLICY IF EXISTS "Auth users can view doc files" ON storage.objects;

CREATE POLICY "Auth users can view doc files"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'document-files');

-- ============================================================
-- 2) Helper: ¿el usuario puede ver un registro de un módulo
--    según el dueño (created_by / owner_id / user_id)?
-- ============================================================
CREATE OR REPLACE FUNCTION public.module_owner_allows(_user_id uuid, _module app_module, _owner uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR public.has_role(_user_id, 'manager'::app_role)
    OR CASE public.get_user_module_access(_user_id, _module)
         WHEN 'todos'   THEN true
         WHEN 'equipo'  THEN _owner = ANY(public.get_user_team_member_ids(_user_id))
         WHEN 'propio'  THEN _owner = _user_id
         ELSE false
       END
$$;

-- Empresa: además permite a ejecutivos asignados verla
CREATE OR REPLACE FUNCTION public.can_view_company(_user_id uuid, _company_id uuid, _created_by uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR public.has_role(_user_id, 'manager'::app_role)
    OR CASE public.get_user_module_access(_user_id, 'directorio'::app_module)
         WHEN 'todos'  THEN true
         WHEN 'equipo' THEN
           _created_by = ANY(public.get_user_team_member_ids(_user_id))
           OR EXISTS (SELECT 1 FROM public.company_ejecutivos ce
                       WHERE ce.company_id = _company_id
                         AND ce.user_id = ANY(public.get_user_team_member_ids(_user_id)))
         WHEN 'propio' THEN
           _created_by = _user_id
           OR EXISTS (SELECT 1 FROM public.company_ejecutivos ce
                       WHERE ce.company_id = _company_id AND ce.user_id = _user_id)
         ELSE false
       END
$$;

-- Contacto: company ejecutivo o contact ejecutivo
CREATE OR REPLACE FUNCTION public.can_view_contact(_user_id uuid, _contact_id uuid, _company_id uuid, _created_by uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR public.has_role(_user_id, 'manager'::app_role)
    OR CASE public.get_user_module_access(_user_id, 'directorio'::app_module)
         WHEN 'todos'  THEN true
         WHEN 'equipo' THEN
           _created_by = ANY(public.get_user_team_member_ids(_user_id))
           OR EXISTS (SELECT 1 FROM public.company_ejecutivos ce
                       WHERE ce.company_id = _company_id
                         AND ce.user_id = ANY(public.get_user_team_member_ids(_user_id)))
           OR EXISTS (SELECT 1 FROM public.contact_ejecutivos ke
                       WHERE ke.contact_id = _contact_id
                         AND ke.user_id = ANY(public.get_user_team_member_ids(_user_id)))
         WHEN 'propio' THEN
           _created_by = _user_id
           OR EXISTS (SELECT 1 FROM public.company_ejecutivos ce
                       WHERE ce.company_id = _company_id AND ce.user_id = _user_id)
           OR EXISTS (SELECT 1 FROM public.contact_ejecutivos ke
                       WHERE ke.contact_id = _contact_id AND ke.user_id = _user_id)
         ELSE false
       END
$$;

-- Documento: cualquier módulo de doc (cotizaciones/facturacion/pedidos) + dueño/ejec
CREATE OR REPLACE FUNCTION public.can_view_documento(
  _user_id uuid, _empresa_id uuid, _created_by uuid, _ejecutivo_venta_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR public.has_role(_user_id, 'manager'::app_role)
    OR public.module_owner_allows(_user_id, 'cotizaciones'::app_module, _created_by)
    OR public.module_owner_allows(_user_id, 'cotizaciones'::app_module, _ejecutivo_venta_id)
    OR public.module_owner_allows(_user_id, 'facturacion'::app_module, _created_by)
    OR public.module_owner_allows(_user_id, 'facturacion'::app_module, _ejecutivo_venta_id)
    OR public.module_owner_allows(_user_id, 'pedidos'::app_module, _created_by)
    OR public.module_owner_allows(_user_id, 'pedidos'::app_module, _ejecutivo_venta_id)
    OR (
      _empresa_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.company_ejecutivos ce
                   WHERE ce.company_id = _empresa_id AND ce.user_id = _user_id)
    )
$$;

-- Deal CRM: cualquiera de los módulos crm_chevron/crm_phillips66 + dueño/owner
CREATE OR REPLACE FUNCTION public.can_view_crm_deal(
  _user_id uuid, _created_by uuid, _owner_id uuid, _company_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR public.has_role(_user_id, 'manager'::app_role)
    OR public.module_owner_allows(_user_id, 'crm_chevron'::app_module, _created_by)
    OR public.module_owner_allows(_user_id, 'crm_chevron'::app_module, _owner_id)
    OR public.module_owner_allows(_user_id, 'crm_phillips66'::app_module, _created_by)
    OR public.module_owner_allows(_user_id, 'crm_phillips66'::app_module, _owner_id)
    OR (
      _company_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM public.company_ejecutivos ce
                   WHERE ce.company_id = _company_id AND ce.user_id = _user_id)
    )
$$;

-- ============================================================
-- 3) Reemplazar políticas SELECT abiertas por las nuevas
-- ============================================================

-- companies
DROP POLICY IF EXISTS "Authenticated can view companies" ON public.companies;
CREATE POLICY "Auth view companies by access"
ON public.companies FOR SELECT TO authenticated
USING (public.can_view_company(auth.uid(), id, created_by));

-- contacts
DROP POLICY IF EXISTS "Authenticated can view contacts" ON public.contacts;
CREATE POLICY "Auth view contacts by access"
ON public.contacts FOR SELECT TO authenticated
USING (public.can_view_contact(auth.uid(), id, company_id, created_by));

-- documentos
DROP POLICY IF EXISTS "Authenticated can view documentos" ON public.documentos;
CREATE POLICY "Auth view documentos by access"
ON public.documentos FOR SELECT TO authenticated
USING (public.can_view_documento(auth.uid(), empresa_id, created_by, ejecutivo_venta_id));

-- documento_productos: derivar del documento padre
DROP POLICY IF EXISTS "Authenticated can view doc products" ON public.documento_productos;
CREATE POLICY "Auth view doc products via parent"
ON public.documento_productos FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.documentos d
  WHERE d.id = documento_id
    AND public.can_view_documento(auth.uid(), d.empresa_id, d.created_by, d.ejecutivo_venta_id)
));

-- crm_deals
DROP POLICY IF EXISTS "Authenticated can view crm_deals" ON public.crm_deals;
CREATE POLICY "Auth view crm_deals by access"
ON public.crm_deals FOR SELECT TO authenticated
USING (public.can_view_crm_deal(auth.uid(), created_by, owner_id, company_id));

-- crm_tasks: dueño (user_id), colaboradores, o brand access
DROP POLICY IF EXISTS "Authenticated can view crm_tasks" ON public.crm_tasks;
CREATE POLICY "Auth view crm_tasks by access"
ON public.crm_tasks FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.crm_task_collaborators c
              WHERE c.task_id = crm_tasks.id AND c.user_id = auth.uid())
  OR public.module_owner_allows(auth.uid(), 'tareas'::app_module, user_id)
  OR public.module_owner_allows(auth.uid(), 'crm_chevron'::app_module, user_id)
  OR public.module_owner_allows(auth.uid(), 'crm_phillips66'::app_module, user_id)
);

-- crm_activities: similar
DROP POLICY IF EXISTS "Authenticated can view crm_activities" ON public.crm_activities;
CREATE POLICY "Auth view crm_activities by access"
ON public.crm_activities FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
  OR user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.crm_activity_collaborators c
              WHERE c.activity_id = crm_activities.id AND c.user_id = auth.uid())
  OR public.module_owner_allows(auth.uid(), 'actividades'::app_module, user_id)
  OR public.module_owner_allows(auth.uid(), 'crm_chevron'::app_module, user_id)
  OR public.module_owner_allows(auth.uid(), 'crm_phillips66'::app_module, user_id)
);

-- crm_task_collaborators: visible si el usuario puede ver la tarea
DROP POLICY IF EXISTS "Authenticated can view task_collaborators" ON public.crm_task_collaborators;
CREATE POLICY "Auth view task_collaborators via parent"
ON public.crm_task_collaborators FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.crm_tasks t
  WHERE t.id = task_id
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role)
      OR t.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.crm_task_collaborators c2
                  WHERE c2.task_id = t.id AND c2.user_id = auth.uid())
      OR public.module_owner_allows(auth.uid(), 'tareas'::app_module, t.user_id)
    )
));

-- crm_activity_collaborators
DROP POLICY IF EXISTS "Authenticated can view activity_collaborators" ON public.crm_activity_collaborators;
CREATE POLICY "Auth view activity_collaborators via parent"
ON public.crm_activity_collaborators FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.crm_activities a
  WHERE a.id = activity_id
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role)
      OR a.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.crm_activity_collaborators c2
                  WHERE c2.activity_id = a.id AND c2.user_id = auth.uid())
      OR public.module_owner_allows(auth.uid(), 'actividades'::app_module, a.user_id)
    )
));
