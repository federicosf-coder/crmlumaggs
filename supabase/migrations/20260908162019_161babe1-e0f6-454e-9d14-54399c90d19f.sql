
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id uuid, _roles app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles))
$$;

-- ============ COMPANIES ============
DROP POLICY IF EXISTS "Accounting can manage companies" ON public.companies;
DROP POLICY IF EXISTS "Admins can manage companies" ON public.companies;
DROP POLICY IF EXISTS "CS can manage companies" ON public.companies;
DROP POLICY IF EXISTS "Managers can manage companies" ON public.companies;
DROP POLICY IF EXISTS "Sales can manage companies" ON public.companies;
DROP POLICY IF EXISTS "Auth view companies by access" ON public.companies;

CREATE POLICY "Staff can manage companies" ON public.companies FOR ALL
USING (public.has_any_role((select auth.uid()), ARRAY['admin','manager','sales','customer_service','accounting']::app_role[]))
WITH CHECK (public.has_any_role((select auth.uid()), ARRAY['admin','manager','sales','customer_service','accounting']::app_role[]));

CREATE POLICY "Auth view companies by access" ON public.companies FOR SELECT
USING (public.can_view_company((select auth.uid()), id, created_by));

-- ============ CONTACTS ============
DROP POLICY IF EXISTS "Admins can manage contacts" ON public.contacts;
DROP POLICY IF EXISTS "CS can manage contacts" ON public.contacts;
DROP POLICY IF EXISTS "Managers can manage contacts" ON public.contacts;
DROP POLICY IF EXISTS "Sales can manage contacts" ON public.contacts;
DROP POLICY IF EXISTS "Auth view contacts by access" ON public.contacts;

CREATE POLICY "Staff can manage contacts" ON public.contacts FOR ALL
USING (public.has_any_role((select auth.uid()), ARRAY['admin','manager','sales','customer_service']::app_role[]))
WITH CHECK (public.has_any_role((select auth.uid()), ARRAY['admin','manager','sales','customer_service']::app_role[]));

CREATE POLICY "Auth view contacts by access" ON public.contacts FOR SELECT
USING (public.can_view_contact((select auth.uid()), id, company_id, created_by));

-- ============ COMPANY_EJECUTIVOS ============
DROP POLICY IF EXISTS "Admins can manage company_ejecutivos" ON public.company_ejecutivos;
DROP POLICY IF EXISTS "CS can manage company_ejecutivos" ON public.company_ejecutivos;
DROP POLICY IF EXISTS "Managers can manage company_ejecutivos" ON public.company_ejecutivos;
DROP POLICY IF EXISTS "Sales can manage company_ejecutivos" ON public.company_ejecutivos;

CREATE POLICY "Staff can manage company_ejecutivos" ON public.company_ejecutivos FOR ALL
USING (public.has_any_role((select auth.uid()), ARRAY['admin','manager','sales','customer_service']::app_role[]))
WITH CHECK (public.has_any_role((select auth.uid()), ARRAY['admin','manager','sales','customer_service']::app_role[]));

-- ============ DOCUMENTOS ============
DROP POLICY IF EXISTS "Admins can manage documentos" ON public.documentos;
DROP POLICY IF EXISTS "Managers can manage documentos" ON public.documentos;
DROP POLICY IF EXISTS "Sales can manage documentos" ON public.documentos;
DROP POLICY IF EXISTS "CustomerService can manage documentos" ON public.documentos;
DROP POLICY IF EXISTS "Accounting can manage facturas" ON public.documentos;
DROP POLICY IF EXISTS "Accounting can update pedidos" ON public.documentos;
DROP POLICY IF EXISTS "Auth view documentos by access" ON public.documentos;

CREATE POLICY "Staff can manage documentos" ON public.documentos FOR ALL
USING (public.has_any_role((select auth.uid()), ARRAY['admin','manager','sales','customer_service']::app_role[]))
WITH CHECK (public.has_any_role((select auth.uid()), ARRAY['admin','manager','sales','customer_service']::app_role[]));

CREATE POLICY "Accounting can manage facturas" ON public.documentos FOR ALL
USING (tipo_documento = 'factura'::tipo_documento AND public.has_role((select auth.uid()), 'accounting'::app_role))
WITH CHECK (tipo_documento = 'factura'::tipo_documento AND public.has_role((select auth.uid()), 'accounting'::app_role));

CREATE POLICY "Accounting can update pedidos" ON public.documentos FOR UPDATE
USING (tipo_documento = 'pedido'::tipo_documento AND public.has_role((select auth.uid()), 'accounting'::app_role))
WITH CHECK (tipo_documento = 'pedido'::tipo_documento AND public.has_role((select auth.uid()), 'accounting'::app_role));

CREATE POLICY "Auth view documentos by access" ON public.documentos FOR SELECT
USING (
  public.has_any_role((select auth.uid()), ARRAY['admin','manager','accounting']::app_role[])
  OR created_by = (select auth.uid())
  OR ejecutivo_venta_id = (select auth.uid())
  OR empresa_id IN (SELECT ce.company_id FROM public.company_ejecutivos ce WHERE ce.user_id = (select auth.uid()))
);

-- ============ INDEXES ============
CREATE INDEX IF NOT EXISTS idx_companies_active_name ON public.companies (is_active, name);
CREATE INDEX IF NOT EXISTS idx_companies_created_by ON public.companies (created_by);
CREATE INDEX IF NOT EXISTS idx_contacts_created_by ON public.contacts (created_by);
CREATE INDEX IF NOT EXISTS idx_company_ejecutivos_user_id ON public.company_ejecutivos (user_id);
CREATE INDEX IF NOT EXISTS idx_documentos_list ON public.documentos (is_active, empresa_vendedora, tipo_documento, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documentos_created_by ON public.documentos (created_by);
CREATE INDEX IF NOT EXISTS idx_documentos_ejecutivo_venta_id ON public.documentos (ejecutivo_venta_id);
CREATE INDEX IF NOT EXISTS idx_documentos_empresa_id ON public.documentos (empresa_id);
