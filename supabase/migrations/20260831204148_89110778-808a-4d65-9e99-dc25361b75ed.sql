INSERT INTO public.role_module_permissions (role, module, access_level)
SELECT r.role, 'reporte_ventas_sistema'::public.app_module,
       CASE WHEN r.role IN ('admin','manager','accounting') THEN 'todos'::public.access_level ELSE 'ninguno'::public.access_level END
FROM (VALUES ('admin'::public.app_role),('manager'::public.app_role),('sales'::public.app_role),('delivery'::public.app_role),('warehouse'::public.app_role),('customer_service'::public.app_role),('accounting'::public.app_role)) AS r(role)
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_module_permissions p
  WHERE p.role = r.role AND p.module = 'reporte_ventas_sistema'::public.app_module
);